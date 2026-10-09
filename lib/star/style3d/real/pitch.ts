/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * LOOK H's PITCH — one plane, one shader, no tiling you can see.
 *
 *   - real grass (ambientCG Grass004) at two scales, so the repeat never lines up
 *   - mown stripes: 18 bands down the pitch, each a shade lighter or darker AND
 *     a touch shinier or duller (real stripes are blades lying two ways), plus
 *     a faint cross-cut
 *   - big soft patches of colour (no pitch is one green), worn goalmouths, a
 *     scuffed penalty spot and centre spot
 *   - every line painted INTO the grass from its exact distance (no strips): a
 *     clean 12 cm edge at any zoom, a little uneven, the grass showing through
 *   - wet: the lights glint off it (night)
 *
 * World metres: X across (−34..34), Z out from the near goal line (0..105).
 */
import type { GrassMaps } from "./assets";

export const PITCH_LEN = 105;
export const PITCH_HALF_W = 34;

const VERT_HEAD = /* glsl */ `varying vec2 vH;`;
const VERT_POS = /* glsl */ `vH = (modelMatrix * vec4(transformed, 1.0)).xz;`;

const FRAG_HEAD = /* glsl */ `
varying vec2 vH;
uniform sampler2D tGCol, tGNrm, tGOrh;
uniform vec3 uGrassA, uGrassB, uLine, uDirt;
uniform float uWet, uL, uHW, uStripes, uLines;
float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
float fbm3(vec2 p) { return vn(p) * 0.55 + vn(p * 2.03 + 7.1) * 0.3 + vn(p * 4.1 + 3.3) * 0.15; }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float sdArc(vec2 p, vec2 c, float r) { return abs(length(p - c) - r); }
// distance to the nearest painted line (centre of the line)
float pitchD(vec2 p) {
  float L = uL, W = uHW;
  float d = sdSeg(p, vec2(-W, 0.0), vec2(W, 0.0));
  d = min(d, sdSeg(p, vec2(-W, L), vec2(W, L)));
  d = min(d, sdSeg(p, vec2(-W, 0.0), vec2(-W, L)));
  d = min(d, sdSeg(p, vec2(W, 0.0), vec2(W, L)));
  d = min(d, sdSeg(p, vec2(-W, L * 0.5), vec2(W, L * 0.5)));
  d = min(d, sdArc(p, vec2(0.0, L * 0.5), 9.15));
  d = min(d, max(length(p - vec2(0.0, L * 0.5)) - 0.12, 0.0));
  // both ends (mirror the far one onto the near one)
  vec2 q = vec2(p.x, p.y > L * 0.5 ? L - p.y : p.y);
  float six = 3.66 + 5.5, box = 3.66 + 16.5;
  d = min(d, sdSeg(q, vec2(-six, 0.0), vec2(-six, 5.5)));
  d = min(d, sdSeg(q, vec2(six, 0.0), vec2(six, 5.5)));
  d = min(d, sdSeg(q, vec2(-six, 5.5), vec2(six, 5.5)));
  d = min(d, sdSeg(q, vec2(-box, 0.0), vec2(-box, 16.5)));
  d = min(d, sdSeg(q, vec2(box, 0.0), vec2(box, 16.5)));
  d = min(d, sdSeg(q, vec2(-box, 16.5), vec2(box, 16.5)));
  d = min(d, max(length(q - vec2(0.0, 11.0)) - 0.11, 0.0));
  // the D: the spot's circle, outside the box only
  float dD = sdArc(q, vec2(0.0, 11.0), 9.15);
  d = min(d, q.y > 16.5 ? dD : 1e3);
  // corner arcs (quarter circles inside the pitch)
  vec2 cq = vec2(W - abs(q.x), q.y);
  d = min(d, (cq.x > 0.0 && cq.y > 0.0) ? abs(length(cq) - 1.0) : 1e3);
  return d;
}
float gPaint = 0.0;
float gStripe = 0.0;
float gWear = 0.0;
`;

const FRAG_MAP = /* glsl */ `
{
  vec2 P = vH;
  vec2 tuv = P / 1.55;
  vec3 d1 = texture2D(tGCol, tuv).rgb * 2.0;
  vec3 d2 = texture2D(tGCol, P / 4.7 + vec2(0.37, 0.11)).rgb * 2.0;
  vec3 det = mix(d1, d2, 0.38);
  vec4 orh = texture2D(tGOrh, tuv);
  // stripes down the pitch, and a faint cross-cut
  float band = floor(P.y / (uL / 18.0));
  gStripe = mod(band, 2.0);
  float cross = mod(floor((P.x + uHW) / (68.0 / 10.0)), 2.0);
  float inPitch = step(-uHW - 1.2, P.x) * step(P.x, uHW + 1.2) * step(-1.2, P.y) * step(P.y, uL + 1.2);
  vec3 g = mix(uGrassA, uGrassB, mix(0.5, gStripe, uStripes * inPitch));
  g *= 1.0 + (cross - 0.5) * 0.035 * inPitch * uStripes;
  // big soft patches: no pitch is one green
  float m1 = fbm3(P * 0.03), m2 = fbm3(P * 0.11 + 4.0);
  g *= 0.9 + 0.14 * m1 + 0.05 * (m2 - 0.5);
  // tufts and clumps at hand size: what makes it read as grass, not felt
  float tuft = vn(P * 2.6) * 0.6 + vn(P * 6.1 + 2.0) * 0.4;
  g *= 0.96 + 0.08 * tuft;
  g = mix(g, g * vec3(0.9, 1.05, 0.8), smoothstep(0.62, 0.9, vn(P * 0.9 + 9.0)) * 0.18);
  g = mix(g, g * vec3(1.06, 1.02, 0.86), smoothstep(0.55, 0.8, m1) * 0.35);
  // wear: goalmouths, the spots, the centre
  vec2 q = vec2(P.x, P.y > uL * 0.5 ? uL - P.y : P.y);
  float wm = exp(-pow((q.x) / 4.2, 2.0) - pow((q.y - 3.2) / 3.0, 2.0));
  wm += 0.55 * exp(-pow(q.x / 1.6, 2.0) - pow((q.y - 11.0) / 1.2, 2.0));
  wm += 0.35 * exp(-pow(P.x / 3.0, 2.0) - pow((P.y - uL * 0.5) / 2.2, 2.0));
  wm += 0.25 * exp(-pow(P.x / 9.0, 2.0) - pow((q.y - 9.0) / 5.0, 2.0));
  float wn = fbm3(P * 1.7);
  gWear = clamp(wm * smoothstep(0.3, 0.75, wn + wm * 0.35), 0.0, 1.0) * inPitch;
  g = mix(g, uDirt, gWear * 0.75);
  vec3 col = g * mix(vec3(1.0), det, 0.85) * (0.82 + 0.18 * orh.r);
  // lines, painted into the grass
  float d = pitchD(P);
  float aa = max(fwidth(d), 0.004);
  float lw = 0.06 + (vn(P * 2.3) - 0.5) * 0.008;
  gPaint = (1.0 - smoothstep(lw - aa * 0.75, lw + aa * 0.75, d)) * uLines;
  float through = mix(1.0, clamp(det.g, 0.55, 1.25), 0.35) * (0.86 + 0.14 * vn(P * 9.0));
  col = mix(col, uLine * through * (1.0 - gWear * 0.35), gPaint);
  diffuseColor.rgb = col;
}
`;

const FRAG_ROUGH = /* glsl */ `
float roughnessFactor = mix(0.97, 0.86, gStripe) * (0.85 + 0.15 * texture2D(tGOrh, vH / 1.55).g);
roughnessFactor = mix(roughnessFactor, 0.62, gPaint * 0.6);
roughnessFactor = mix(roughnessFactor, 1.0, gWear * 0.6);
roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.55, uWet);
`;

const FRAG_NORMAL = /* glsl */ `
{
  vec3 nT = texture2D(tGNrm, vH / 1.55).xyz * 2.0 - 1.0;
  nT.xy *= 0.75 * (1.0 - gPaint * 0.6);
  vec3 Tv = normalize((viewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz);
  vec3 Bv = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
  vec3 Nv = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  normal = normalize(Tv * nT.x + Bv * nT.y + Nv * nT.z);
}
`;

export interface RealPitch {
  mesh: any;
  material: any;
  setLook(o: { grass: [string, string]; wet: number }): void;
  dispose(): void;
}

/**
 * The pitch, plus a run-off of the same grass out to `w × l` metres.
 * `lines: false` (a training patch) leaves the grass bare.
 */
export function buildRealPitch(T: any, maps: GrassMaps, o: { w?: number; l?: number; lines?: boolean; stripes?: boolean } = {}): RealPitch {
  const w = o.w ?? 104, l = o.l ?? 141;
  const u: Record<string, { value: any }> = {
    tGCol: { value: maps.col }, tGNrm: { value: maps.nrm }, tGOrh: { value: maps.orh },
    uGrassA: { value: new T.Color("#3d7a2a") }, uGrassB: { value: new T.Color("#4b8c33") },
    uLine: { value: new T.Color("#f2f4ee") }, uDirt: { value: new T.Color("#6b5a3a") },
    uWet: { value: 0 }, uL: { value: PITCH_LEN }, uHW: { value: PITCH_HALF_W },
    uStripes: { value: o.stripes === false ? 0 : 1 }, uLines: { value: o.lines === false ? 0 : 1 },
  };
  const mat = new T.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (sh: any) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
      .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>\n${VERT_POS}`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      .replace("#include <map_fragment>", `#include <map_fragment>\n${FRAG_MAP}`)
      .replace("#include <roughnessmap_fragment>", FRAG_ROUGH)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>\n${FRAG_NORMAL}`);
  };
  mat.customProgramCacheKey = () => "h-pitch-v1";
  const mesh = new T.Mesh(new T.PlaneGeometry(w, l), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0, PITCH_LEN / 2);
  mesh.receiveShadow = true;
  mesh.name = "h-pitch";
  return {
    mesh, material: mat,
    setLook(lk) {
      u.uGrassA.value.set(lk.grass[0]); u.uGrassB.value.set(lk.grass[1]);
      u.uWet.value = lk.wet;
    },
    dispose() { mesh.geometry.dispose(); mat.dispose(); },
  };
}
