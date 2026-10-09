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
uniform float cNear, cFar, exposure, bloom, contrast, sat, vignette, grain, time, sharpen, fxaa, dof, dofNear, dofFar, useDepth;
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
vec3 scene(vec2 uv) {
  vec3 c = texture2D(tColor, uv).rgb;
  if (dof > 0.0 && useDepth > 0.5) {
    float d = linD(texture2D(tDepth, uv).r);
    float k = smoothstep(dofNear, dofFar, d) * dof;
    c = mix(c, texture2D(tSoft, uv).rgb, k);
  }
  c += texture2D(tBloom, uv).rgb * bloom;
  return toSRGB(aces(c));
}
void main() {
  vec2 px = 1.0 / res;
  vec3 c = scene(vUv);
  if (fxaa > 0.5) {
    vec3 nw = scene(vUv + vec2(-1.0, 1.0) * px), ne = scene(vUv + vec2(1.0, 1.0) * px);
    vec3 sw = scene(vUv + vec2(-1.0, -1.0) * px), se = scene(vUv + vec2(1.0, -1.0) * px);
    float lNW = luma(nw), lNE = luma(ne), lSW = luma(sw), lSE = luma(se), lM = luma(c);
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    if (lMax - lMin > max(0.04, lMax * 0.12)) {
      vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
      float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078);
      float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * px;
      vec3 a = 0.5 * (scene(vUv + dir * (1.0 / 3.0 - 0.5)) + scene(vUv + dir * (2.0 / 3.0 - 0.5)));
      vec3 b = a * 0.5 + 0.25 * (scene(vUv + dir * -0.5) + scene(vUv + dir * 0.5));
      float lb = luma(b);
      c = (lb < lMin || lb > lMax) ? a : b;
    }
  } else if (sharpen > 0.0) {
    vec3 n = scene(vUv + vec2(0.0, px.y)) + scene(vUv - vec2(0.0, px.y)) + scene(vUv + vec2(px.x, 0.0)) + scene(vUv - vec2(px.x, 0.0));
    c = max(c + (c - n * 0.25) * sharpen, 0.0);
  }
  // the grade: S-curve, split tone, saturation
  c = c * tint + lift;
  vec3 s = c * c * (3.0 - 2.0 * c);
  c = mix(c, s, clamp(contrast - 1.0, 0.0, 1.0) * 2.0);
  float l = luma(c);
  c *= mix(shadowTint, lightTint, smoothstep(0.15, 0.75, l));
  c = mix(vec3(luma(c)), c, sat);
  vec2 v = vUv - 0.5;
  c *= 1.0 - vignette * dot(v, v) * 1.5;
  if (lutAmt > 0.0) c = mix(c, lut32(c), lutAmt);
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
}

export interface HPost {
  render(scene: any, camera: any, g: HGrade): void;
  dispose(): void;
}

export function makeHPost(T: any, renderer: any, tier: Quality3d): HPost {
  const msaa = tier === "high" && renderer.capabilities?.isWebGL2 !== false ? 4 : 0;
  const levels = tier === "high" ? 5 : 3;
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
    sharpen: { value: tier === "high" ? 0.22 : 0 }, fxaa: { value: tier === "medium" ? 1 : 0 },
    dof: { value: tier === "high" ? 0.75 : 0 }, dofNear: { value: 58 }, dofFar: { value: 95 }, useDepth: { value: 1 },
    tint: { value: new T.Vector3(1, 1, 1) }, lift: { value: new T.Vector3() },
    shadowTint: { value: new T.Vector3(0.97, 1.0, 1.04) }, lightTint: { value: new T.Vector3(1.03, 1.0, 0.97) },
    tLut: { value: null }, lutAmt: { value: 0 },
  };
  const finalMat = new T.ShaderMaterial({ uniforms: fu, vertexShader: VERT, fragmentShader: FINAL, depthTest: false, depthWrite: false });
  const size = new T.Vector2();
  const t0 = performance.now();
  let depthOk = true;

  const pass = (mat: any, target: any) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); };

  return {
    render(scene, camera, g) {
      if (tier === "low") {
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = g.exposure;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
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
      renderer.render(scene, camera);
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
      fu.vignette.value = g.vignette; fu.time.value = (performance.now() - t0) / 1000;
      fu.tint.value.set(...g.tint); fu.lift.value.set(...g.lift);
      fu.sharpen.value = (tier === "high" ? 0.22 : 0) * (g.sharpen ?? 1);
      fu.tLut.value = g.lut ?? null; fu.lutAmt.value = g.lut ? (g.lutAmt ?? 1) : 0;
      pass(finalMat, null);
      renderer.toneMapping = tm;
      renderer.autoClear = auto;
    },
    dispose() {
      main.depthTexture?.dispose(); main.dispose(); soft.dispose(); chain.forEach((c) => c.dispose());
      downMat.dispose(); upMat.dispose(); finalMat.dispose(); quad.geometry.dispose();
      void depthOk; depthOk = false;
    },
  };
}
