/**
 * The eight texture packs added on 14 Oct 2026 (Harry: "I want that to go to like
 * 8, 9, 10, 11, 12 texture packs", and earlier "one between Cartoon and Light").
 *
 * Each is DATA for the same machinery the first four use (look.ts applyDials and
 * render): the grass colour, the pitch's wet / blade / stripe / frost dials, the
 * light (sun, sky light, reflections, rim), the baked shade, the cast shadow,
 * the sky and the fog, a stadium tint, and the broadcast grade. Nothing here
 * touches a man, the keeper, the goal or the ball, or any size: the men only
 * see the light and the grade, so every pack keeps them readable.
 *
 * The first four (real, light, cartoon, bright) keep their own hand-written
 * branches in look.ts, byte for byte as they were.
 *
 * Pure numbers: no three.js, so a test can check them (tests/star/texturePacks.mts).
 */
import type { TimeOfDay } from "./assets";

export type V3 = [number, number, number];

export interface PackSpec {
  /** The flat cel world (Cartoon's pitch, toon stadium, painted sky, no bake). */
  flat?: boolean;
  /** Always this light, whatever the match picks (Night, Sunset). */
  tod?: TimeOfDay;
  /** The live cast shadows' strength, × as built. 0 = none at all (like Cartoon and Bright). */
  cast: number;
  /** The look's two mown shades: × mul, + add (0..255), then mixed toward `toward` by k. Flat packs set `flatGrass`. */
  grass?: { mul: V3; add?: V3; toward?: { hex: string; k: number } };
  flatGrass?: [string, string];
  /** The pitch dials: wet glint × the look's and + wetAdd; blades and stripes × the look's; frost 0..1 (pitch.ts uFrost). */
  wet: number; wetAdd?: number; blades?: number; stripes?: number; frost?: number;
  /** The light, × the look's own. */
  hemi: number; env: number; sun?: number; rim?: number;
  /** The sun's colour instead of the time of day's. */
  sunColor?: string;
  /** The baked light: ambient occlusion and the stands' shade over the pitch, × the look's. */
  bake?: { ao: number; shade: number };
  /** The sky's brightness, × the look's. */
  sky?: number;
  /** The air (three's fog) instead of the time of day's: colour, start, end in metres. */
  fog?: { color: string; near: number; far: number };
  /** The stadium's own colours (not the crowd, not the nets): × mul, then toward a colour by k. */
  stadium?: { mul?: V3; toward?: { hex: string; k: number } };
  /** The broadcast grade, from the look's own (see packGrade). */
  grade: PackGrade;
}

export interface PackGrade {
  /** Start from a clean picture (no LUT, curve, tint or vignette): Cartoon's way. */
  clean?: boolean;
  exposure?: number;
  /** contrast = 1 + (look's − 1) × keep + add */
  contrastKeep?: number; contrastAdd?: number;
  sat?: number;
  /** tint = (1 + (look's − 1) × keep) × mul */
  tintKeep?: number; tintMul?: V3;
  liftAdd?: V3;
  vignette?: number; bloom?: number; lut?: number; sharpen?: number;
  /** Film grain, absolute (as built 0.012). */
  grain?: number;
}

export type ExtraPack = "soft" | "broadcast" | "sunset" | "night" | "rain" | "winter" | "retro" | "pastel";

export const PACK_SPECS: Record<ExtraPack, PackSpec> = {
  // half way between Cartoon and Light: real grass but smooth and bright, soft faint shadows, half the grade
  soft: {
    cast: 0.4,
    grass: { mul: [0.97, 1.16, 1.02], add: [3, 11, 3], toward: { hex: "#52b143", k: 0.45 } },
    wet: 0.3, blades: 0.45, stripes: 1.25,
    hemi: 1.8, env: 1.0,
    bake: { ao: 0.35, shade: 0.12 },
    grade: { exposure: 1.03, contrastKeep: 0.45, sat: 1.06, tintKeep: 0.35, liftAdd: [0.006, 0.006, 0.006], vignette: 0.2, lut: 0.5, bloom: 0.7 },
  },
  // the TV picture turned up: deep green, strong stripes, crisp and punchy, no vignette
  broadcast: {
    cast: 1,
    grass: { mul: [0.95, 1.12, 0.9], add: [0, 6, 0] },
    wet: 1, blades: 1.1, stripes: 1.7,
    hemi: 1.05, env: 1.0, sun: 1.08,
    bake: { ao: 0.9, shade: 0.3 },
    grade: { exposure: 1.06, contrastAdd: 0.08, sat: 1.22, tintKeep: 0.6, liftAdd: [0.004, 0.004, 0.004], vignette: 0, sharpen: 1.6 },
  },
  // always golden hour, warmer: an orange sun, long shadows, a glow
  sunset: {
    tod: "golden", cast: 1,
    grass: { mul: [1.12, 1.02, 0.72], add: [12, 6, 0] },
    wet: 1, hemi: 0.95, env: 0.9, sun: 1.08, sunColor: "#ff9a55",
    bake: { ao: 0.85, shade: 0.35 },
    sky: 1.15,
    stadium: { mul: [1.08, 0.96, 0.84] },
    grade: { exposure: 1.03, tintMul: [1.13, 0.98, 0.8], sat: 1.15, vignette: 1.0, bloom: 1.8, lut: 0.7 },
  },
  // always a floodlit night: the four lamp banks, the wet glint, a glow off the lights
  night: {
    tod: "night", cast: 1,
    grass: { mul: [1, 1.04, 1] },
    wet: 1.2, hemi: 1.15, env: 1.05,
    bake: { ao: 0.85, shade: 0.35 },
    grade: { exposure: 1.06, bloom: 1.4, vignette: 0.6 },
  },
  // overcast and wet: a dark soaked pitch that shines, grey sky, mist in the stands, faint shadows
  rain: {
    cast: 0.35,
    grass: { mul: [0.8, 0.9, 0.84] },
    wet: 1, wetAdd: 0.75, blades: 0.8,
    hemi: 1.6, env: 1.1, sun: 0.55, sunColor: "#dfe6ee",
    bake: { ao: 0.7, shade: 0.1 },
    sky: 0.7, fog: { color: "#8f9aa3", near: 40, far: 230 },
    stadium: { mul: [0.92, 0.95, 1.0] },
    grade: { exposure: 1.06, contrastKeep: 0.8, sat: 0.8, tintMul: [0.95, 0.99, 1.06], vignette: 0.8, lut: 0.6 },
  },
  // a cold clear day: pale cool grass, frost along the edges and in the corners, white air
  winter: {
    cast: 0.7,
    grass: { mul: [0.82, 0.93, 0.96], add: [10, 12, 16] },
    wet: 0.4, stripes: 0.85, frost: 0.5,
    hemi: 1.5, env: 1.15, sun: 0.9, sunColor: "#f2f6ff",
    bake: { ao: 0.8, shade: 0.25 },
    sky: 1.05, fog: { color: "#d9e2ea", near: 60, far: 300 },
    stadium: { mul: [0.95, 0.98, 1.04] },
    grade: { exposure: 1.05, tintMul: [0.95, 0.99, 1.07], sat: 0.85, liftAdd: [0.004, 0.006, 0.01] },
  },
  // a 90s TV broadcast: washed yellowy colours, soft picture, glowing lights, grain, a heavy edge
  retro: {
    cast: 0.8,
    grass: { mul: [1.02, 0.94, 0.76], add: [8, 4, 0] },
    wet: 0.6, blades: 0.6, stripes: 1.2,
    hemi: 1.2, env: 0.95,
    bake: { ao: 0.8, shade: 0.3 },
    stadium: { mul: [1.04, 1.0, 0.9] },
    grade: { sat: 0.72, contrastKeep: 0.6, tintMul: [1.06, 1.02, 0.86], liftAdd: [0.02, 0.018, 0.012], vignette: 1.8, bloom: 1.8, sharpen: 0, lut: 0.3, grain: 0.06 },
  },
  // the cartoon world in soft pastel colours: mint grass, chalky stands, gentle light
  pastel: {
    flat: true, cast: 0,
    flatGrass: ["#68bf78", "#7acb88"],
    wet: 0,
    hemi: 1.9, env: 0.75,
    stadium: { toward: { hex: "#f4ecff", k: 0.38 } },
    grade: { clean: true, exposure: 1.0, contrastAdd: -0.06, sat: 0.8, liftAdd: [0.015, 0.015, 0.02], bloom: 0.3 },
  },
};

const hexRgb = (hex: string): V3 => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (c: V3) => `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("")}`;

/** One mown shade through a pack's grass recipe. */
export function packGrass(hex: string, g: NonNullable<PackSpec["grass"]>): string {
  const c = hexRgb(hex).map((x, i) => x * g.mul[i] + (g.add?.[i] ?? 0)) as V3;
  if (g.toward) { const t = hexRgb(g.toward.hex); for (let i = 0; i < 3; i++) c[i] += (t[i] - c[i]) * g.toward.k; }
  return rgbHex(c);
}

/** A colour (0..1 floats) through a pack's stadium tint. */
export function packStadium(c: V3, s: NonNullable<PackSpec["stadium"]>): V3 {
  const o = c.map((x, i) => x * (s.mul?.[i] ?? 1)) as V3;
  if (s.toward) { const t = hexRgb(s.toward.hex).map((x) => x / 255); for (let i = 0; i < 3; i++) o[i] += (t[i] - o[i]) * s.toward.k; }
  return o;
}

export interface GradeIn {
  exposure: number; bloom: number; contrast: number; sat: number;
  tint: V3; lift: V3; vignette: number; lutAmt: number; sharpen: number;
}
/** The look's own grade through a pack's grade recipe. */
export function packGrade<G extends GradeIn>(g0: G, s: PackGrade): G & { grain?: number } {
  const g = s.clean ? { ...g0, bloom: g0.bloom * 0.3, contrast: 1, tint: [1, 1, 1] as V3, lift: [0, 0, 0] as V3, vignette: 0, lutAmt: 0, sharpen: 0 } : { ...g0 };
  const tk = s.tintKeep ?? 1, tm = s.tintMul ?? [1, 1, 1], la = s.liftAdd ?? [0, 0, 0];
  return {
    ...g,
    exposure: g.exposure * (s.exposure ?? 1),
    contrast: 1 + (g.contrast - 1) * (s.contrastKeep ?? 1) + (s.contrastAdd ?? 0),
    sat: g.sat * (s.sat ?? 1),
    tint: g.tint.map((t, i) => (1 + (t - 1) * tk) * tm[i]) as V3,
    lift: g.lift.map((l, i) => l + la[i]) as V3,
    vignette: g.vignette * (s.vignette ?? 1),
    bloom: g.bloom * (s.bloom ?? 1),
    lutAmt: g.lutAmt * (s.lut ?? 1),
    sharpen: g.sharpen * (s.sharpen ?? 1),
    ...(s.grain !== undefined ? { grain: s.grain } : {}),
  };
}
