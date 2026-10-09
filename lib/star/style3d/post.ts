/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE STYLE PASS — one full-screen shader after the scene, cheap on phones.
 *
 * The scene is drawn into one render target (colour + depth). One pass then
 * does, in order: a small glow (16 taps), ACES tone mapping, sRGB, cel bands,
 * comic dots, the colour grade, depth-edge ink lines, palette + dither (pixel),
 * vignette and grain. Pixel style draws the scene small and the pass scales it
 * up with nearest-neighbour.
 *
 * Low quality: no pass at all (straight to the screen, ACES on), except the
 * pixel style, whose whole point is the small render (and that is cheaper).
 */
import type { PostLook } from "./styles";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 res;
uniform float cNear, cFar, exposure, time, dpr;
uniform float edge, edgeW, posterize, posterMix, halftone, grain, bloom, bloomThresh, sat, contrast, vignette, palette, dither;
uniform vec3 edgeColor, tint, lift, burstColor;
uniform float burst, impact, lite;
varying vec2 vUv;

float linD(float d) { float z = d * 2.0 - 1.0; return (2.0 * cNear * cFar) / (cFar + cNear - z * (cFar - cNear)); }
vec3 aces(vec3 x) { x *= exposure; return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float i = q.x + q.y * 4.0;
  // 0 8 2 10 / 12 4 14 6 / 3 11 1 9 / 15 7 13 5
  float v = 0.0;
  if (i < 0.5) v = 0.0; else if (i < 1.5) v = 8.0; else if (i < 2.5) v = 2.0; else if (i < 3.5) v = 10.0;
  else if (i < 4.5) v = 12.0; else if (i < 5.5) v = 4.0; else if (i < 6.5) v = 14.0; else if (i < 7.5) v = 6.0;
  else if (i < 8.5) v = 3.0; else if (i < 9.5) v = 11.0; else if (i < 10.5) v = 1.0; else if (i < 11.5) v = 9.0;
  else if (i < 12.5) v = 15.0; else if (i < 13.5) v = 7.0; else if (i < 14.5) v = 13.0; else v = 5.0;
  return (v + 0.5) / 16.0;
}

void main() {
  vec2 px = 1.0 / res;
  vec3 c = texture2D(tColor, vUv).rgb;

  // glow: two rings of bright samples
  if (bloom > 0.0) {
    vec3 b = vec3(0.0);
    float rad = 0.012;
    for (int i = 0; i < 16; i++) {
      if (lite > 0.5 && i >= 8) break;
      float a = float(i) * 0.3927 + (i >= 8 ? 0.2 : 0.0);
      float r = i < 8 ? rad : rad * 2.3;
      vec2 o = vec2(cos(a), sin(a)) * r * vec2(res.y / res.x, 1.0);
      vec3 s = texture2D(tColor, vUv + o).rgb;
      b += max(s - bloomThresh, 0.0) * (i < 8 ? 1.0 : 0.6);
    }
    c += b * bloom / 10.0;
  }

  c = toSRGB(aces(c));

  // cel bands, keeping the hue
  if (posterMix > 0.0) {
    float l = luma(c);
    float q = floor(l * posterize + 0.5) / posterize;
    c = mix(c, c * (q / max(l, 0.02)), posterMix);
  }

  // comic dots in the darker tones (screen space, 45 degrees)
  if (halftone > 0.0) {
    float l = luma(c);
    float cell = 5.0 * dpr;
    vec2 p = gl_FragCoord.xy;
    vec2 rp = vec2(p.x + p.y, p.x - p.y) * 0.7071 / cell;
    vec2 g = fract(rp) - 0.5;
    float r = sqrt(clamp(1.0 - l, 0.0, 1.0)) * 0.62;
    float dotm = 1.0 - smoothstep(r - 0.06, r + 0.02, length(g));
    c = mix(c, c * 0.28, dotm * halftone * smoothstep(0.85, 0.35, l));
  }

  // the grade
  c = c * tint + lift;
  c = (c - 0.5) * contrast + 0.5;
  c = mix(vec3(luma(c)), c, sat);

  // ink lines from depth jumps
  if (edge > 0.0) {
    vec2 o = px * edgeW;
    float dc = linD(texture2D(tDepth, vUv).r);
    float dl = linD(texture2D(tDepth, vUv - vec2(o.x, 0.0)).r);
    float dr = linD(texture2D(tDepth, vUv + vec2(o.x, 0.0)).r);
    float du = linD(texture2D(tDepth, vUv + vec2(0.0, o.y)).r);
    float dd = linD(texture2D(tDepth, vUv - vec2(0.0, o.y)).r);
    float e = (abs(dl - dr) + abs(du - dd)) / max(dc, 0.001);
    // near things get lines; the far crowd stays soft
    float far = smoothstep(150.0, 60.0, dc);
    c = mix(c, edgeColor, smoothstep(0.06, 0.2, e) * edge * far);
  }

  // palette + ordered dither (pixel)
  if (palette > 0.0) {
    float n = palette - 1.0;
    float d = (bayer4(vUv * res) - 0.5) * dither;
    c = floor(c * n + 0.5 + d) / n;
  }

  // energy burst: speed lines out from the middle
  if (burst > 0.0) {
    vec2 q = (vUv - vec2(0.5, 0.55)) * vec2(res.x / res.y, 1.0);
    float ang = atan(q.y, q.x);
    float ray = hash(vec2(floor(ang * 70.0), 3.0));
    float rays = smoothstep(0.82, 1.0, ray) * smoothstep(0.18, 0.6, length(q));
    c += burstColor * rays * burst * 1.2;
    c = mix(c, c + burstColor * 0.25, burst * smoothstep(0.7, 0.2, length(q)) * 0.4);
  }

  // impact frame: hard black and white, inverted
  if (impact > 0.0) { float l = luma(c); vec3 ink = vec3(step(0.45, l)); c = mix(c, 1.0 - ink * 0.92, impact); }

  if (vignette > 0.0) { vec2 v = vUv - 0.5; c *= 1.0 - vignette * dot(v, v) * 1.6; }
  if (grain > 0.0) c += (hash(gl_FragCoord.xy + fract(time) * 91.0) - 0.5) * grain;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export interface StylePost {
  render(scene: any, camera: any, look: PostLook, full: boolean, burst?: number, burstColor?: string, impact?: number, lite?: boolean): void;
  dispose(): void;
}

export function makeStylePost(T: any, renderer: any): StylePost {
  const mkRT = (nearest: boolean) => {
    const f = nearest ? T.NearestFilter : T.LinearFilter;
    // the scene is drawn into this target, so the screen's own antialias never reaches it:
    // 4× MSAA here (WebGL2) keeps edges smooth (9 Oct 2026); the pixel style stays crisp on purpose
    const samples = !nearest && renderer.capabilities?.isWebGL2 !== false ? 4 : 0;
    const rt = new T.WebGLRenderTarget(4, 4, { type: T.HalfFloatType, minFilter: f, magFilter: f, depthBuffer: true, samples });
    rt.depthTexture = new T.DepthTexture(4, 4);
    rt.depthTexture.type = T.UnsignedIntType;
    rt.depthTexture.minFilter = T.NearestFilter;
    rt.depthTexture.magFilter = T.NearestFilter;
    return rt;
  };
  const rts: Record<"lin" | "near", any> = { lin: mkRT(false), near: mkRT(true) };
  const u: Record<string, { value: any }> = {
    tColor: { value: null }, tDepth: { value: null }, res: { value: new T.Vector2(1, 1) },
    cNear: { value: 0.1 }, cFar: { value: 300 }, exposure: { value: 1 }, time: { value: 0 }, dpr: { value: 1 },
    edge: { value: 0 }, edgeW: { value: 1 }, posterize: { value: 4 }, posterMix: { value: 0 }, halftone: { value: 0 },
    grain: { value: 0 }, bloom: { value: 0 }, bloomThresh: { value: 1 }, sat: { value: 1 }, contrast: { value: 1 },
    vignette: { value: 0 }, palette: { value: 0 }, dither: { value: 0 },
    edgeColor: { value: new T.Color() }, burstColor: { value: new T.Color() }, burst: { value: 0 }, impact: { value: 0 }, lite: { value: 0 }, tint: { value: new T.Vector3(1, 1, 1) }, lift: { value: new T.Vector3() },
  };
  const mat = new T.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false });
  const quad = new T.Mesh(new T.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  const qs = new T.Scene();
  qs.add(quad);
  const qc = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new T.Vector2();
  const t0 = performance.now();

  return {
    render(scene, camera, look, full, burst = 0, burstColor = "#ffffff", impact = 0, lite = false) {
      u.lite.value = lite ? 1 : 0;
      renderer.getDrawingBufferSize(size);
      const dpr = renderer.getPixelRatio();
      if (!full && !look.pixel) {
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = look.exposure;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
        return;
      }
      const rt = look.pixel ? rts.near : rts.lin;
      const k = look.pixel ? 1 / (look.pixel * dpr) : 1;
      const w = Math.max(16, Math.round(size.x * k)), h = Math.max(16, Math.round(size.y * k));
      if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      renderer.toneMapping = T.NoToneMapping;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      u.tColor.value = rt.texture;
      u.tDepth.value = rt.depthTexture;
      u.res.value.set(w, h);
      u.cNear.value = camera.near; u.cFar.value = camera.far;
      u.time.value = (performance.now() - t0) / 1000;
      u.dpr.value = look.pixel ? 1 : dpr;
      u.exposure.value = look.exposure;
      // Low: the pass only scales the pixel picture up (no lines, glow or dots)
      const on = full ? 1 : 0;
      u.edge.value = look.edge * on; u.edgeW.value = look.edgeWidth;
      u.posterize.value = look.posterize || 4; u.posterMix.value = look.posterMix * on;
      u.halftone.value = look.halftone * on; u.grain.value = look.grain * on;
      u.bloom.value = look.bloom * on; u.bloomThresh.value = look.bloomThresh;
      u.sat.value = look.sat; u.contrast.value = look.contrast; u.vignette.value = look.vignette * on;
      u.palette.value = look.palette; u.dither.value = look.dither;
      u.edgeColor.value.set(look.edgeColor).convertLinearToSRGB();
      u.burst.value = burst * on; u.impact.value = impact; u.burstColor.value.set(burstColor).convertLinearToSRGB();
      u.tint.value.set(...look.tint); u.lift.value.set(...look.lift);
      renderer.render(qs, qc);
    },
    dispose() {
      rts.lin.dispose(); rts.near.dispose();
      rts.lin.depthTexture?.dispose(); rts.near.depthTexture?.dispose();
      mat.dispose(); quad.geometry.dispose();
    },
  };
}
