/**
 * LOW's COLOUR = HIGH's COLOUR, WITHOUT A PASS (3D quality look New, round 2, 12 Oct 2026).
 *
 * Harry: "put full focus on the medium/low look". Low draws straight to the
 * screen (no broadcast pass), so its grade lives in three's CustomToneMapping,
 * which every lit material already runs once a pixel. Round 1 put a fixed,
 * golden-ish grade there on three's own ACES: Low came out greener, flatter and
 * warm even at night. Round 2 runs HIGH's OWN chain there, for each place and
 * time of day:
 *   the same ACES as the pass (not three's), the same tint and lift, S-curve,
 *   cool-shadow / warm-light split, saturation, and the broadcast colour grade
 *   (the 32³ LUT), the LUT as a 10-term colour polynomial fitted to it
 *   (scripts: the fit is in the handbook; weighted mean error 0.04–0.06 of full
 *   scale), so no texture is read.
 * Which grade: the tone map has one global number a frame, the exposure. So the
 * pass writes `exposure + 16 × slot` (gradeExposure) and the shader splits it.
 * A slot is a place + time of day (gradeSlot). Slot 0 = round 1's fixed grade.
 * The vignette needs the screen size, so it is a separate cheap overlay (post.ts).
 */
import type { TimeOfDay } from "./assets";
import { TODS } from "./tod";
import { lookParams } from "../../look/params";

export interface ToneGrade {
  contrast: number; sat: number;
  tint: [number, number, number]; lift: [number, number, number];
  /** Which broadcast LUT (or none) and how much of it. */
  lut: TimeOfDay | null; lutAmt: number;
}

/** The garden / shop / casino grades (enhance.ts uses these for its pass too). */
export const ENHANCE_GRADES: Record<TimeOfDay | "indoor", { exposure: number; bloom: number; bloomThresh: number; contrast: number; sat: number; tint: [number, number, number]; lift: [number, number, number]; vignette: number }> = {
  day: { exposure: 1, bloom: 0.25, bloomThresh: 1.5, contrast: 1.07, sat: 1.04, tint: [1, 1, 0.99], lift: [0, 0.003, 0.008], vignette: 0.2 },
  golden: { exposure: 1, bloom: 0.4, bloomThresh: 1.2, contrast: 1.08, sat: 1.06, tint: [1.03, 1.0, 0.95], lift: [0.008, 0.004, 0], vignette: 0.26 },
  night: { exposure: 1, bloom: 0.7, bloomThresh: 0.9, contrast: 1.1, sat: 1.04, tint: [0.98, 1, 1.05], lift: [0, 0.003, 0.012], vignette: 0.32 },
  indoor: { exposure: 1, bloom: 0.35, bloomThresh: 1.1, contrast: 1.06, sat: 1.05, tint: [1.02, 1, 0.97], lift: [0.004, 0.002, 0], vignette: 0.24 },
};
/** enhance.ts's default share of the LUT outdoors. */
export const ENHANCE_LUT_AMT = 0.8;

/**
 * The broadcast LUTs (public/star/look/lut-*.png) as a colour polynomial:
 * out = c0 + c1 r + c2 g + c3 b + c4 r² + c5 g² + c6 b² + c7 rg + c8 rb + c9 gb,
 * fitted by least squares over the whole cube, weighted to low-saturation colours
 * (grass, crowd, skin, kit whites are mostly there).
 */
const LUT_FIT: Record<TimeOfDay, number[][]> = {
  // weighted mean error 0.059 (0..1), 95th percentile 0.177
  day: [[-0.23620, -0.22695, -0.22668], [0.91180, 0.23795, 0.18556], [1.44190, 1.92600, 1.25025], [-0.12996, -0.10237, 0.65959], [0.28557, 0.17547, 0.13819], [-0.49840, -0.41797, -0.68936], [0.15136, 0.15940, 0.13133], [-0.80766, -0.66344, -0.60643], [0.16059, 0.05440, 0.17739], [-0.28679, -0.13419, -0.01784]],
  // weighted mean error 0.036 (0..1), 95th percentile 0.110
  golden: [[-0.19629, -0.18323, -0.17809], [1.16123, 0.24876, 0.23814], [0.91094, 1.66367, 0.71479], [0.04397, 0.08781, 1.05156], [0.13722, 0.07783, 0.00997], [-0.15241, -0.34037, -0.40369], [0.05988, 0.01410, 0.01291], [-0.78577, -0.47554, -0.31404], [0.04849, -0.03139, -0.02178], [-0.27480, -0.09089, -0.15137]],
  // weighted mean error 0.036 (0..1), 95th percentile 0.111
  night: [[-0.18285, -0.18216, -0.18829], [1.16181, 0.25254, 0.25483], [0.82438, 1.66583, 0.77615], [0.04585, 0.08390, 1.06111], [0.14351, 0.06119, 0.00197], [-0.31393, -0.32014, -0.31548], [0.05746, 0.02407, 0.00614], [-0.62108, -0.46933, -0.39904], [-0.06482, -0.01752, -0.00195], [-0.10062, -0.12791, -0.23077]],
};
const LUT_ORDER: TimeOfDay[] = ["day", "golden", "night"];

export type GradePlace = "stadium" | "enhance";
const TOD_INDEX: Record<TimeOfDay | "indoor", number> = { day: 0, golden: 1, night: 2, indoor: 3 };
/** 1..3 the stadium's day/golden/night, 4..7 the garden-type day/golden/night/indoor. 0 = round 1's fixed grade. */
export function gradeSlot(place: GradePlace, tod: TimeOfDay | "indoor"): number {
  if (place === "stadium") return tod === "indoor" ? 0 : 1 + TOD_INDEX[tod];
  return 4 + TOD_INDEX[tod];
}
export const GRADE_SLOTS = 8;

/** The grade each slot carries (the stadium's comes from tod.ts × the tuned dials, exactly as the pass reads them). */
export function slotGrade(slot: number): ToneGrade | null {
  if (slot >= 1 && slot <= 3) {
    const tod = LUT_ORDER[slot - 1], L = TODS[tod], p = lookParams(tod);
    return { contrast: L.contrast * p.contrast, sat: L.sat * p.sat, tint: L.tint, lift: L.lift, lut: tod, lutAmt: p.lut };
  }
  if (slot >= 4 && slot <= 7) {
    const k = (["day", "golden", "night", "indoor"] as const)[slot - 4], G = ENHANCE_GRADES[k];
    return { contrast: G.contrast, sat: G.sat, tint: G.tint, lift: G.lift, lut: k === "indoor" ? null : k, lutAmt: k === "indoor" ? 0 : ENHANCE_LUT_AMT };
  }
  return null;
}

/** The exposure the tone map is given: the real one plus the slot (split again in the shader). */
export const gradeExposure = (exposure: number, slot: number) => Math.min(15.99, Math.max(0, exposure)) + 16 * slot;

const f = (x: number) => { const s = x.toFixed(5); return s.includes(".") ? s : `${s}.0`; };
const v3 = (a: number[]) => `vec3(${a.map(f).join(", ")})`;

/** The GLSL that replaces three's empty CustomToneMapping. */
export function gradeToneMapGlsl(): string {
  const tints: string[] = [], lifts: string[] = [], ps: string[] = [];
  for (let s = 0; s < GRADE_SLOTS; s++) {
    const g = slotGrade(s);
    tints.push(v3(g?.tint ?? [1, 1, 1])); lifts.push(v3(g?.lift ?? [0, 0, 0]));
    ps.push(`vec4(${f(g?.contrast ?? 1)}, ${f(g?.sat ?? 1)}, ${f(g && g.lut ? g.lutAmt : 0)}, ${f(g && g.lut ? LUT_ORDER.indexOf(g.lut) : 0)})`);
  }
  const lut = LUT_ORDER.flatMap((t) => LUT_FIT[t].map(v3));
  return /* glsl */ `const vec3 HG_TINT[${GRADE_SLOTS}] = vec3[${GRADE_SLOTS}](${tints.join(", ")});
const vec3 HG_LIFT[${GRADE_SLOTS}] = vec3[${GRADE_SLOTS}](${lifts.join(", ")});
const vec4 HG_P[${GRADE_SLOTS}] = vec4[${GRADE_SLOTS}](${ps.join(", ")});
const vec3 HG_LUT[${lut.length}] = vec3[${lut.length}](${lut.join(", ")});
vec3 hgSRGB( vec3 c ) { return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0 ) ), vec3( 1.0 / 2.4 ) ) - 0.055, step( 0.0031308, c ) ); }
vec3 hgLinear( vec3 s ) { return mix( s / 12.92, pow( ( s + 0.055 ) / 1.055, vec3( 2.4 ) ), step( 0.04045, s ) ); }
vec3 CustomToneMapping( vec3 color ) {
  float te = toneMappingExposure;
  int k = int( floor( te / 16.0 + 1e-4 ) );
  if ( k <= 0 || k >= ${GRADE_SLOTS} ) {
    // round 1's fixed grade on three's own ACES
    vec3 c = ACESFilmicToneMapping( color );
    vec3 s = pow( max( c, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
    s = s * vec3( 1.025, 1.0, 0.965 ) + vec3( 0.006, 0.003, 0.0 );
    s = mix( s, s * s * ( 3.0 - 2.0 * s ), 0.24 );
    float l = dot( s, vec3( 0.299, 0.587, 0.114 ) );
    s *= mix( vec3( 0.97, 1.0, 1.04 ), vec3( 1.03, 1.0, 0.97 ), smoothstep( 0.15, 0.75, l ) );
    s = mix( vec3( dot( s, vec3( 0.299, 0.587, 0.114 ) ) ), s, 1.12 );
    return pow( clamp( s, 0.0, 1.0 ), vec3( 2.2 ) );
  }
  // High's own chain (post.ts FINAL): its ACES, tint + lift, S-curve, split tone, saturation, LUT
  vec3 x = color * ( te - float( k ) * 16.0 );
  vec3 s = hgSRGB( clamp( ( x * ( 2.51 * x + 0.03 ) ) / ( x * ( 2.43 * x + 0.59 ) + 0.14 ), 0.0, 1.0 ) );
  s = s * HG_TINT[ k ] + HG_LIFT[ k ];
  vec4 P = HG_P[ k ];
  s = mix( s, s * s * ( 3.0 - 2.0 * s ), clamp( P.x - 1.0, 0.0, 1.0 ) * 2.0 );
  s *= mix( vec3( 0.97, 1.0, 1.04 ), vec3( 1.03, 1.0, 0.97 ), smoothstep( 0.15, 0.75, dot( s, vec3( 0.299, 0.587, 0.114 ) ) ) );
  s = mix( vec3( dot( s, vec3( 0.299, 0.587, 0.114 ) ) ), s, P.y );
  if ( P.z > 0.0 ) {
    int b = int( P.w + 0.5 ) * 10;
    vec3 q = clamp( s, 0.0, 1.0 );
    vec3 L = HG_LUT[ b ] + HG_LUT[ b + 1 ] * q.r + HG_LUT[ b + 2 ] * q.g + HG_LUT[ b + 3 ] * q.b
      + HG_LUT[ b + 4 ] * ( q.r * q.r ) + HG_LUT[ b + 5 ] * ( q.g * q.g ) + HG_LUT[ b + 6 ] * ( q.b * q.b )
      + HG_LUT[ b + 7 ] * ( q.r * q.g ) + HG_LUT[ b + 8 ] * ( q.r * q.b ) + HG_LUT[ b + 9 ] * ( q.g * q.b );
    s = mix( s, L, P.z );
  }
  return hgLinear( clamp( s, 0.0, 1.0 ) );
}`;
}
