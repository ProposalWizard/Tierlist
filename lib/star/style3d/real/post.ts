/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H's BROADCAST PASS — what turns a render into a TV picture.
 *
 *   1. the scene into a half-float target (4× MSAA on High: clean edges)
 *   2. a half-size copy (soft focus for the far stands)
 *   3. real bloom: bright parts down a chain of ever smaller copies and back
 *      up (a wide, smooth glow round floodlights and sun glints, not a ring)
 *   4. one last pass: soft focus on the far stands by depth, the bloom, ACES,
 *      a broadcast S-curve, a cool-shadow / warm-light split, saturation,
 *      sharpening (High) or FXAA edge smoothing (Medium), vignette, then the
 *      broadcast colour grade (a 3D LUT matched to the benchmark pictures,
 *      lib/star/look + tools/look/build_lut.py), fine grain
 *
 * Low quality: none of it (ACES straight to the screen, as before).
 */
import type { Quality3d } from "../../three3d/quality";
import { tierLookNew } from "../../three3d/tierLook";
import { gradeExposure, gradeToneMapGlsl } from "./toneGrade";
import { setToonSkinMark, toonSkinFixOn, TOON_SKIN_MARK, TOON_SKIN } from "../toon/shader";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/** A 4-tap box down (with a soft threshold on the first bloom step). */
const DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform vec2 texel; uniform float thresh, knee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb
         + texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  if (thresh > 0.0) {
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - thresh + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    c *= max(soft, br - thresh) / max(br, 1e-4);
  }
  gl_FragColor = vec4(min(c, vec3(64.0)), 1.0);
}`;

/** A 9-tap tent up, added onto the bigger level. */
const UP = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 4.0;
  c += (texture2D(tSrc, vUv + vec2(texel.x, 0.0)).rgb + texture2D(tSrc, vUv - vec2(texel.x, 0.0)).rgb
      + texture2D(tSrc, vUv + vec2(0.0, texel.y)).rgb + texture2D(tSrc, vUv - vec2(0.0, texel.y)).rgb) * 2.0;
  c += texture2D(tSrc, vUv + texel).rgb + texture2D(tSrc, vUv - texel).rgb
     + texture2D(tSrc, vUv + vec2(texel.x, -texel.y)).rgb + texture2D(tSrc, vUv + vec2(-texel.x, texel.y)).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}`;

const FINAL = /* glsl */ `
precision highp float;
uniform sampler2D tColor, tDepth, tSoft, tBloom;
uniform vec2 res;
uniform float cNear, cFar, exposure, bloom, contrast, sat, vignette, grain, time, sharpen, fxaa, fxSharp, dofOnce, dof, dofNear, dofFar, useDepth, lite, bloomThresh, menClean, skinFix;
uniform vec3 tint, lift, shadowTint, lightTint;
uniform sampler2D tLut;
uniform float lutAmt;
varying vec2 vUv;
// a 32-cube LUT laid out as a 1024 x 32 strip (blue picks the tile, red across it, green down it)
vec3 lut32(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  float b = c.b * 31.0, b0 = floor(b), b1 = min(b0 + 1.0, 31.0);
  float u = c.r * 31.0 + 0.5, v = (c.g * 31.0 + 0.5) / 32.0;
  vec3 lo = texture2D(tLut, vec2((b0 * 32.0 + u) / 1024.0, v)).rgb;
  vec3 hi = texture2D(tLut, vec2((b1 * 32.0 + u) / 1024.0, v)).rgb;
  return mix(lo, hi, b - b0);
}
float linD(float d) { float z = d * 2.0 - 1.0; return (2.0 * cNear * cFar) / (cFar + cNear - z * (cFar - cNear)); }
vec3 aces(vec3 x) { x *= exposure; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
// the alpha of the last scene() read: 0.5 marks a Style A match man (toon/shader.ts, MEN_MARK)
float gA;
bool isMan(float a) { return abs(a - 0.5) < 0.12; }
// bare skin (toon/shader.ts TOON_SKIN): its alpha mark, and the curve by brightness only (hue kept)
float skinOf(float a) { return skinFix > 0.5 ? 1.0 - smoothstep(0.03, 0.09, abs(a - ${TOON_SKIN_MARK.toFixed(2)})) : 0.0; }
vec3 acesHue(vec3 x) { float m = max(max(x.r, x.g), x.b); return x * (aces(vec3(m)).r / max(m, 1e-5)); }
vec3 scene(vec2 uv) {
  vec4 t4 = texture2D(tColor, uv);
  gA = t4.a;
  vec3 c = t4.rgb;
  if (dof > 0.0 && useDepth > 0.5 && dofOnce < 0.5) {
    float d = linD(texture2D(tDepth, uv).r);
    float k = smoothstep(dofNear, dofFar, d) * dof;
    c = mix(c, texture2D(tSoft, uv).rgb, k);
  }
  if (lite < 0.5 && dofOnce < 0.5) c += texture2D(tBloom, uv).rgb * bloom;
  float sk = skinOf(gA);
  return toSRGB(sk > 0.0 ? mix(aces(c), acesHue(c), sk) : aces(c));
}
void main() {
  vec2 px = 1.0 / res;
  vec3 c = scene(vUv);
  float aM = gA;
  // lite (Medium, 9 Oct 2026): no bloom chain; a light 8-tap glow here instead, added once
  vec3 glow = vec3(0.0);
  if (lite > 0.5 && bloom > 0.0) {
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.7854;
      vec2 o = vec2(cos(a), sin(a)) * 0.008 * vec2(res.y / res.x, 1.0);
      glow += max(texture2D(tColor, vUv + o).rgb - bloomThresh, 0.0);
    }
    glow = toSRGB(aces(glow * bloom * 0.18)) ;
  }
  if (fxaa > 0.5) {
    vec3 nw = scene(vUv + vec2(-1.0, 1.0) * px); float aNW = gA;
    vec3 ne = scene(vUv + vec2(1.0, 1.0) * px); float aNE = gA;
    vec3 sw = scene(vUv + vec2(-1.0, -1.0) * px); float aSW = gA;
    vec3 se = scene(vUv + vec2(1.0, -1.0) * px); float aSE = gA;
    // Medium, Style A men (menClean): inside a man no smoothing and no sharpen (his flat cel bands
    // and kit edges stay clean, not smeared or crunchy); his outline against the grass is still
    // smoothed, never sharpened. Uses the alphas of the reads above: no extra texture read.
    bool manC = menClean > 0.5 && isMan(aM);
    bool manAll = manC && isMan(aNW) && isMan(aNE) && isMan(aSW) && isMan(aSE);
    bool manAny = menClean > 0.5 && (manC || isMan(aNW) || isMan(aNE) || isMan(aSW) || isMan(aSE));
    float lNW = luma(nw), lNE = luma(ne), lSW = luma(sw), lSE = luma(se), lM = luma(c);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    if (!manAll && lMax - lMin > max(0.04, lMax * 0.12)) {
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
      vec3 a = 0.5 * (scene(vUv + dir * (1.0 / 3.0 - 0.5)) + scene(vUv + dir * (2.0 / 3.0 - 0.5)));
      vec3 b = a * 0.5 + 0.25 * (scene(vUv + dir * -0.5) + scene(vUv + dir * 0.5));
      float lb = luma(b);
      c = (lb < lMin || lb > lMax) ? a : b;
    }
    // 3D quality look New (12 Oct 2026): a light sharpen after the smoothing, from the four corner
    // samples FXAA has already read (no extra texture reads)
    if (fxSharp > 0.0 && !manAny) c = max(c + (c - (nw + ne + sw + se) * 0.25) * fxSharp, 0.0);
  } else if (sharpen > 0.0) {
    vec3 n = scene(vUv + vec2(0.0, px.y)) + scene(vUv - vec2(0.0, px.y)) + scene(vUv + vec2(px.x, 0.0)) + scene(vUv - vec2(px.x, 0.0));
    c = max(c + (c - n * 0.25) * sharpen, 0.0);
  }
  // Medium New: the bloom and the far stands' soft focus once, on the centre, added as a change to the
  // smoothed picture (before: the bloom was read again inside every one of FXAA's 5-9 reads)
  if (dofOnce > 0.5) {
    vec3 raw = texture2D(tColor, vUv).rgb, lin = raw;
    if (dof > 0.0 && useDepth > 0.5) {
      float k = smoothstep(dofNear, dofFar, linD(texture2D(tDepth, vUv).r)) * dof;
      if (k > 0.001) lin = mix(lin, texture2D(tSoft, vUv).rgb, k);
    }
    c = max(c + toSRGB(aces(lin + texture2D(tBloom, vUv).rgb * bloom)) - toSRGB(aces(raw)), 0.0);
  }
  c += glow;
  // the grade: S-curve, split tone, saturation (bare skin is spared most of the tint, split tone and
  // colour cube and all of the extra colour: the place keeps its light, his face keeps its tone)
  float skS = skinOf(aM), skK = skS * ${TOON_SKIN.gradeOff.toFixed(2)};
  c = c * mix(tint, vec3(1.0), skK) + lift * (1.0 - skK);
  vec3 s = c * c * (3.0 - 2.0 * c);
  c = mix(c, s, clamp(contrast - 1.0, 0.0, 1.0) * 2.0);
  float l = luma(c);
  c *= mix(mix(shadowTint, lightTint, smoothstep(0.15, 0.75, l)), vec3(1.0), skK);
  c = mix(vec3(luma(c)), c, mix(sat, ${TOON_SKIN.sat.toFixed(2)}, skS));
  vec2 v = vUv - 0.5;
  c *= 1.0 - vignette * dot(v, v) * 1.5;
  if (lutAmt > 0.0) c = mix(c, lut32(c), lutAmt * (1.0 - skK));
  c += (hash(gl_FragCoord.xy + fract(time) * 91.0) - 0.5) * grain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export interface HGrade {
  exposure: number; bloom: number; bloomThresh: number; contrast: number; sat: number;
  tint: [number, number, number]; lift: [number, number, number]; vignette: number;
  /** The broadcast colour grade (lib/star/look/params.ts lookLut) and how much of it, 0..1. */
  lut?: any; lutAmt?: number;
  /** A multiple of the tier's own sharpening (High only; 1 = as it was). */
  sharpen?: number;
  /** Film grain (texture pack Retro 90s); as built 0.012. */
  grain?: number;
  /** Which grade the no-pass tone map uses (toneGrade.ts gradeSlot): Low copies High's colour. */
  slot?: number;
}

export type HPostMode = "full" | "lite" | "off";

export interface HPost {
  render(scene: any, camera: any, g: HGrade): void;
  /**
   * The governor's say (three3d/governor.ts): full = the tier's own pass
   * (High: exactly as before); lite = ONE pass after the scene (grade, FXAA
   * unless MSAA, a light glow; no half-size copy, no bloom chain, no depth
   * blur); off = straight to the screen (ACES), as Low always was.
   */
  setMode(m: HPostMode): void;
  /**
   * Where the scene itself is drawn (its own picture before the pass), or
   * null when it goes straight to the screen. A scene's shaders differ by
   * target (a picture: no tone mapping, linear colour), so a warm-up must
   * compile them FOR this target, or the first frame builds every shader
   * again (speed job B: the garden's 11 s first frame, 9 Oct 2026).
   */
  sceneTarget(): any | null;
  dispose(): void;
}

/**
 * The broadcast grade without a pass (3D quality look New, 12 Oct 2026): three's own
 * ACES, then the S-curve, split tone, saturation and a touch of warmth, inside the
 * tone map every lit material already runs. Used when the pass is off (Low, and the
 * emergency rungs): an ALU cost per pixel, no extra target, no extra draw. Fixed
 * numbers (golden-hour broadcast, between day and night): a shader built once keeps
 * them, so they are not per time of day. No colour cube (it needs a texture).
 */
// (round 2: High's own chain per place and time of day, toneGrade.ts; slot 0 keeps round 1's fixed grade)
let gradeToneMapInstalled = false;
/** Puts the grade into three's CustomToneMapping (once a page). Returns the tone mapping to use. */
export function gradeToneMapping(T: any): number {
  if (!gradeToneMapInstalled && T.ShaderChunk?.tonemapping_pars_fragment) {
    const src: string = T.ShaderChunk.tonemapping_pars_fragment;
    const stub = "vec3 CustomToneMapping( vec3 color ) { return color; }";
    if (src.includes(stub)) T.ShaderChunk.tonemapping_pars_fragment = src.replace(stub, gradeToneMapGlsl());
    gradeToneMapInstalled = true;
  }
  return T.ShaderChunk?.tonemapping_pars_fragment?.includes("ACESFilmicToneMapping( color );") ? T.CustomToneMapping : T.ACESFilmicToneMapping;
}

/** Medium (3D quality look New): leave the Style A men out of FXAA's insides and the sharpen. ?menclean=0 on test pages shows before. */
export const MEN_CLEAN = { on: typeof window === "undefined" || new URLSearchParams(window.location.search).get("menclean") !== "0" };
if (typeof window !== "undefined") (window as unknown as { __menClean?: typeof MEN_CLEAN }).__menClean = MEN_CLEAN;

export function makeHPost(T: any, renderer: any, tier: Quality3d, o: { msaa?: number } = {}): HPost {
  const msaa = renderer.capabilities?.isWebGL2 === false ? 0 : o.msaa ?? (tier === "high" ? 4 : 0);
  // 3D quality look New: Medium buys High's look back where it costs next to nothing
  const fresh = tierLookNew();
  const medNew = fresh && tier === "medium";
  const levels = tier === "high" ? 5 : 3;
  const offTM = fresh ? gradeToneMapping(T) : T.ACESFilmicToneMapping;
  const mk = (o: { depth?: boolean; samples?: number } = {}) => {
    const rt = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: !!o.depth, samples: o.samples ?? 0 });
    if (o.depth) {
      rt.depthTexture = new T.DepthTexture(4, 4);
      rt.depthTexture.type = T.UnsignedIntType;
    }
    return rt;
  };
  const main = mk({ depth: true, samples: msaa });
  const soft = mk();
  const chain = Array.from({ length: levels }, () => mk());
  const quadScene = new T.Scene();
  const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  quadScene.add(quad);
  const du = { tSrc: { value: null as any }, texel: { value: new T.Vector2() }, thresh: { value: 0 }, knee: { value: 0.5 } };
  const downMat = new T.ShaderMaterial({ uniforms: du, vertexShader: VERT, fragmentShader: DOWN, depthTest: false, depthWrite: false });
  const uu = { tSrc: { value: null as any }, texel: { value: new T.Vector2() } };
  const upMat = new T.ShaderMaterial({ uniforms: uu, vertexShader: VERT, fragmentShader: UP, depthTest: false, depthWrite: false, blending: T.AdditiveBlending, transparent: true });
  const fu: Record<string, { value: any }> = {
    tColor: { value: null }, tDepth: { value: null }, tSoft: { value: null }, tBloom: { value: null },
    res: { value: new T.Vector2() }, cNear: { value: 0.1 }, cFar: { value: 300 }, exposure: { value: 1 }, bloom: { value: 0.3 },
    contrast: { value: 1 }, sat: { value: 1 }, vignette: { value: 0.2 }, grain: { value: 0.012 }, time: { value: 0 },
    sharpen: { value: tier === "high" ? 0.22 : msaa ? 0.14 : 0 }, fxSharp: { value: 0 }, dofOnce: { value: 0 }, fxaa: { value: tier === "medium" && !msaa ? 1 : 0 },
    dof: { value: tier === "high" ? 0.75 : 0 }, dofNear: { value: 58 }, dofFar: { value: 95 }, useDepth: { value: 1 },
    tint: { value: new T.Vector3(1, 1, 1) }, lift: { value: new T.Vector3() },
    shadowTint: { value: new T.Vector3(0.97, 1.0, 1.04) }, lightTint: { value: new T.Vector3(1.03, 1.0, 0.97) },
    tLut: { value: null }, lutAmt: { value: 0 }, lite: { value: 0 }, bloomThresh: { value: 1 }, menClean: { value: 0 }, skinFix: { value: 0 },
  };
  const finalMat = new T.ShaderMaterial({ uniforms: fu, vertexShader: VERT, fragmentShader: FINAL, depthTest: false, depthWrite: false });
  const size = new T.Vector2();
  const t0 = performance.now();
  let depthOk = true;
  let mode: HPostMode = tier === "low" ? "off" : "full";
  // the frame drawn straight to the screen: shaders built (compile) for the tone map it will use
  if (mode === "off" && fresh) renderer.toneMapping = offTM;

  const vig = makeVignette(T, renderer);
  const pass = (mat: any, target: any) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };

  return {
    setMode(m) { mode = tier === "low" ? "off" : m; },
    sceneTarget() { return mode === "off" ? null : main; },
    render(scene, camera, g) {
      if (mode === "off") {
        renderer.toneMapping = offTM;
        // round 2: the slot rides on the exposure (the tone map's only per-frame number), split in the shader
        renderer.toneMappingExposure = offTM === T.CustomToneMapping ? gradeExposure(g.exposure, g.slot ?? 0) : g.exposure;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        renderer.toneMappingExposure = g.exposure;
        // and High's vignette, as a darkening ring drawn over the edges (no pass, no picture read)
        if (fresh && (g.slot ?? 0) > 0 && g.vignette > 0.001) vig.draw(g.vignette);
        return;
      }
      renderer.getDrawingBufferSize(size);
      const w = Math.max(16, size.x), h = Math.max(16, size.y);
      if (main.width !== w || main.height !== h) {
        main.setSize(w, h);
        soft.setSize(Math.max(8, w >> 1), Math.max(8, h >> 1));
        chain.forEach((rt, i) => rt.setSize(Math.max(4, w >> (i + 2)), Math.max(4, h >> (i + 2))));
      }
      const tm = renderer.toneMapping;
      renderer.toneMapping = T.NoToneMapping;
      const auto = renderer.autoClear;
      renderer.autoClear = true;
      renderer.setRenderTarget(main);
      setToonSkinMark(true);
      renderer.render(scene, camera);
      setToonSkinMark(false);
      fu.skinFix.value = toonSkinFixOn() ? 1 : 0;
      if (mode === "lite") {
        fu.tColor.value = main.texture; fu.tDepth.value = main.depthTexture; fu.tSoft.value = main.texture; fu.tBloom.value = main.texture;
        fu.useDepth.value = 0; fu.lite.value = 1; fu.dof.value = 0; fu.bloomThresh.value = g.bloomThresh;
        fu.fxaa.value = msaa ? 0 : 1; fu.sharpen.value = 0; fu.fxSharp.value = fresh && !msaa ? 0.12 : 0; fu.dofOnce.value = 0;
        fu.res.value.set(w, h); fu.cNear.value = camera.near; fu.cFar.value = camera.far;
        fu.exposure.value = g.exposure; fu.bloom.value = g.bloom * 0.6; fu.contrast.value = g.contrast; fu.sat.value = g.sat;
        fu.vignette.value = g.vignette; fu.time.value = (performance.now() - t0) / 1000; fu.grain.value = g.grain ?? 0.012;
        fu.tint.value.set(...g.tint); fu.lift.value.set(...g.lift);
        fu.tLut.value = g.lut ?? null; fu.lutAmt.value = g.lut ? (g.lutAmt ?? 1) : 0;
        pass(finalMat, null);
        renderer.toneMapping = tm;
        renderer.autoClear = auto;
        return;
      }
      // Medium New: the far stands' soft focus is back (the half-size copy is drawn anyway), and a light sharpen after FXAA
      fu.lite.value = 0; fu.dof.value = tier === "high" ? 0.75 : medNew ? 0.6 : 0; fu.fxaa.value = tier === "medium" && !msaa ? 1 : 0;
      fu.fxSharp.value = medNew && !msaa ? 0.45 * (g.sharpen ?? 1) : 0;
      fu.dofOnce.value = medNew ? 1 : 0;
      // 3D quality look New, Medium: Style A men kept clean (no smoothing inside, no sharpen on them); Old: as before
      fu.menClean.value = medNew && MEN_CLEAN.on ? 1 : 0;
      // half size copy, then the bloom chain
      du.tSrc.value = main.texture; du.texel.value.set(0.5 / w, 0.5 / h); du.thresh.value = 0;
      pass(downMat, soft);
      du.tSrc.value = soft.texture; du.texel.value.set(1 / soft.width, 1 / soft.height); du.thresh.value = g.bloomThresh; du.knee.value = g.bloomThresh * 0.5;
      pass(downMat, chain[0]);
      du.thresh.value = 0;
      for (let i = 1; i < chain.length; i++) {
        du.tSrc.value = chain[i - 1].texture; du.texel.value.set(1 / chain[i - 1].width, 1 / chain[i - 1].height);
        pass(downMat, chain[i]);
      }
      renderer.autoClear = false;
      for (let i = chain.length - 1; i > 0; i--) {
        uu.tSrc.value = chain[i].texture; uu.texel.value.set(1 / chain[i].width, 1 / chain[i].height);
        pass(upMat, chain[i - 1]);
      }
      renderer.autoClear = true;
      fu.tColor.value = main.texture; fu.tDepth.value = main.depthTexture; fu.tSoft.value = soft.texture; fu.tBloom.value = chain[0].texture;
      fu.useDepth.value = depthOk ? 1 : 0;
      fu.res.value.set(w, h); fu.cNear.value = camera.near; fu.cFar.value = camera.far;
      fu.exposure.value = g.exposure; fu.bloom.value = g.bloom * 0.6; fu.contrast.value = g.contrast; fu.sat.value = g.sat;
      fu.vignette.value = g.vignette; fu.time.value = (performance.now() - t0) / 1000; fu.grain.value = g.grain ?? 0.012;
      fu.tint.value.set(...g.tint); fu.lift.value.set(...g.lift);
      fu.sharpen.value = (tier === "high" ? 0.22 : 0) * (g.sharpen ?? 1);
      fu.tLut.value = g.lut ?? null; fu.lutAmt.value = g.lut ? (g.lutAmt ?? 1) : 0;
      pass(finalMat, null);
      renderer.toneMapping = tm;
      renderer.autoClear = auto;
    },
    dispose() {
      main.depthTexture?.dispose(); main.dispose(); soft.dispose(); chain.forEach((c) => c.dispose());
      downMat.dispose(); upMat.dispose(); finalMat.dispose(); quad.geometry.dispose(); vig.dispose();
      void depthOk; depthOk = false;
    },
  };
}

/**
 * High's vignette with no pass (3D quality look New, round 2): a grid over the
 * screen's edges, each vertex darkening by High's own formula (v·1.5·r², r from
 * the centre in screen units), multiplied onto what is already drawn. The
 * middle, where it would darken by under ~3%, is left out of the mesh, so those
 * pixels are not touched. One draw, no texture; the fill is a single multiply.
 */
export const VIGNETTE_CUT = 0.03;
const VIG_N = 12;
/** The grid cells the vignette draws for strength v (the rest of the screen is not touched). */
export function vignetteCells(v: number, n = VIG_N): number[] {
  const r0 = VIGNETTE_CUT / Math.max(1e-3, 1.5 * v), out: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let mx = 0;
    for (const [a, b] of [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]]) { const x = a / n - 0.5, y = b / n - 0.5; mx = Math.max(mx, x * x + y * y); }
    if (mx > r0) out.push(j * n + i);
  }
  return out;
}
function makeVignette(T: any, renderer: any) {
  const N = VIG_N;
  let mesh: any = null, sc: any = null, cam: any = null, lastV = -1;
  const pos: number[] = [], r2: number[] = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = i / N - 0.5, y = j / N - 0.5;
    pos.push(x * 2, y * 2, 0); r2.push(x * x + y * y);
  }
  const index = (v: number) => {
    const idx: number[] = [];
    for (const c of vignetteCells(v, N)) {
      const i = c % N, j = Math.floor(c / N), at = (a: number, b: number) => b * (N + 1) + a;
      idx.push(at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j), at(i + 1, j + 1), at(i, j + 1));
    }
    return idx;
  };
  return {
    draw(v: number) {
      if (!mesh) {
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        geo.setAttribute("r2", new T.Float32BufferAttribute(r2, 1));
        const mat = new T.ShaderMaterial({
          uniforms: { v: { value: 0 } },
          vertexShader: `attribute float r2; uniform float v; varying float vD;
void main() { vD = max(0.0, v * 1.5 * r2 - ${VIGNETTE_CUT.toFixed(4)}); gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: `varying float vD; void main() { gl_FragColor = vec4(vec3(1.0 - vD), 1.0); }`,
          depthTest: false, depthWrite: false, blending: T.CustomBlending,
          blendSrc: T.ZeroFactor, blendDst: T.SrcColorFactor, blendEquation: T.AddEquation,
        });
        mesh = new T.Mesh(geo, mat); mesh.frustumCulled = false;
        sc = new T.Scene(); sc.add(mesh);
        cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      }
      if (Math.abs(v - lastV) > 0.02) { mesh.geometry.setIndex(index(v)); lastV = v; }
      mesh.material.uniforms.v.value = v;
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(sc, cam);
      renderer.autoClear = auto;
    },
    dispose() { mesh?.geometry.dispose(); mesh?.material.dispose(); },
  };
}
