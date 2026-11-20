/**
 * THE FACE SYSTEM — a FaceId: one person's own face as about fifty numbers and three colours
 * (Harry, 20 Nov 2026, on the face mock-ups: "the faces look a lot more emotive and interesting
 * … how hair's looking, the eyes, the eyebrows, the nose, and everything look better"; and what
 * had to be fixed: "the actual mould of the face, the skin tone, the patchiness of beards … how
 * it's merging with the face shape and how facial hair looks").
 *
 * The 12 Style A heads share 8 painted faces. With a FaceId the head's own painted eyes, brows,
 * lips and beard are painted out and each person's own are DRAWN in the body's shader
 * (faceIdShader.ts) on the head's surface, from these numbers; the mould (jaw, chin, cheeks,
 * nose, face length) is moved on his own copy of the mesh (faceIdApply.ts).
 *
 *   faceIdFor(id, heritage, { … })   the same id → the same face, always
 *   FACE_EMOTIONS                    8 emotions as blends of 14 numbers (blendEmotions)
 *
 * RUL-3D-010: features follow heritage and are never picked apart from it, with real variety
 * inside each heritage and NO caricature: every heritage draws each feature from several
 * shapes, most shapes are shared between heritages, and every number is kept inside FACE_LIMITS.
 * RUL-3D-009: the toon style and the head's proportions stay.
 *
 * Pure (no three.js). Tested in tests/star/peoplePresets.mts.
 */
import type { FaceParams } from "../../cutscene/face";
import { NEUTRAL_FACE } from "../../cutscene/face";
import { TOON_FACE_TYPES, type FaceShape, type ToonFaceId } from "./faceShape";

export type EyeShape = "round" | "almond" | "hooded" | "narrow" | "deepSet" | "downturned" | "upturned" | "monolid";
export type IrisName = "nearBlack" | "darkBrown" | "brown" | "lightBrown" | "hazel" | "amber" | "green" | "greyGreen" | "blue" | "lightBlue" | "grey";
export type BrowStyle = "straight" | "softArch" | "highArch" | "angled" | "rounded" | "flatThick";
export type BeardStyle = "none" | "stubble" | "heavyStubble" | "boxed" | "full" | "goatee" | "circle" | "strap" | "moustache" | "faded";

/** One person's face. Lengths in metres on the head (rest pose); shares 0..1 unless said. */
export interface FaceId {
  // ── eyes (12) ──
  eyeShape: EyeShape;
  /** Half the opening's width; how far it opens above and below its centre line. */
  eyeW: number; eyeUp: number; eyeLow: number;
  /** The outer corner higher (+) or lower (−): a slope. */
  eyeTilt: number;
  /** Each eye further out (+) or in (−); higher (+) or lower. */
  eyeGap: number; eyeDy: number;
  irisR: number;
  /** The fold above the lid: 0 none (a single lid) … 1 a clear one. */
  crease: number;
  /** The lid's skin over the top of the opening 0 … 1. */
  hood: number;
  /** How round the opening's top is (0 flat … 1 a full arc); the inner corner dropped 0 … 1. */
  eyeRound: number; eyeInner: number;
  /** The socket's own shade (deep-set) 0 … 1. */
  socket: number;
  /** The lash line's weight 0.4 … 1.4; the line under the eye 0 … 1. */
  lash: number; underEye: number;
  irisName: IrisName;
  /** sRGB hex. */
  iris: string;
  // ── brows (10) ──
  browStyle: BrowStyle;
  /** Height above the eye; thickness; the arch's height; the outer end higher (+) or lower. */
  browH: number; browT: number; browArch: number; browTilt: number;
  /** Length (in eye half-widths); the inner end further out (+) or in; how thin the tail gets; where the arch peaks. */
  browLen: number; browGap: number; browTaper: number; browPeak: number;
  /** How full the brow's hair is 0.6 … 1. */
  browDensity: number;
  brow: string;
  // ── lips (6) ──
  /** Half the mouth's width, a share of the head's own; the upper and lower lip's height. */
  mouthW: number; lipUp: number; lipLow: number;
  /** How strongly the lips are coloured 0.5 … 1; the mouth higher (+) or lower. */
  lipTone: number; mouthDy: number;
  lip: string;
  // ── marks (7) ──
  freckles: number; age: number; blush: number;
  /** A mole: 0 none, else where (x from the middle of the face, y from the mouth line). */
  mole: number; moleX: number; moleY: number;
  // ── facial hair (8) ──
  beardStyle: BeardStyle;
  /** Cover on the cheeks and jaw, the chin, the upper lip 0 … 1. */
  beardCheek: number; beardChin: number; beardMous: number;
  /** How full the hair is (0.3 light stubble … 1 a full beard) and how long (0 stubble … 1). */
  beardDensity: number; beardLen: number;
  /** The cheek line 0 low … 1 high; 1 = only a band along the jaw (a chin strap); a patch under the lip. */
  beardLine: number; beardStrap: number; beardSoul: number;
  // ── the mould (13): moved on the mesh ──
  faceType: ToonFaceId;
  /** The outline's build (FACE_BUILDS). */
  faceBuild: FaceBuild;
  shape: Required<Pick<FaceShape, "jawW" | "chinLen" | "chinW" | "cheek" | "full" | "noseW" | "noseLen" | "noseBridge" | "noseTip" | "faceLen" | "browRidge" | "lips" | "faceW" | "taper">> & FaceShape;
}

/** Nothing leaves these (RUL-3D-010: never caricature). The mould's are on the summed shape. */
export const FACE_LIMITS = {
  eyeW: [0.0158, 0.0204], eyeUp: [0.0054, 0.0114], eyeLow: [0.0038, 0.0076], eyeTilt: [-0.13, 0.19], eyeGap: [-0.003, 0.0035], eyeDy: [-0.0015, 0.0015],
  irisR: [0.0066, 0.0088], browH: [0.0165, 0.0255], browT: [0.0036, 0.0078], browArch: [0, 0.0068], browTilt: [-0.005, 0.0065], browLen: [1.9, 2.5],
  mouthW: [0.88, 1.14], lipUp: [0.0026, 0.0066], lipLow: [0.004, 0.0086],
  shape: {
    jawW: [-0.07, 0.05], chinLen: [-0.005, 0.008], chinW: [-0.14, 0.16], cheek: [-0.004, 0.009], full: [-0.002, 0.003], noseW: [-0.35, 0.55], noseLen: [-0.006, 0.008],
    noseBridge: [-0.007, 0.008], noseTip: [-0.003, 0.004], faceLen: [-0.01, 0.014], browRidge: [-0.0015, 0.0045], lips: [-0.3, 0.5], faceW: [-0.09, 0.055], taper: [-0.08, 0.18],
  },
} as const;

/**
 * The eye shapes. They must read apart in a small picture (a 120 px face), so they differ in the
 * opening's height and length, its slope, how round its top is, the fold and the socket's shade,
 * each inside FACE_LIMITS.
 */
const EYE_SHAPES: Record<EyeShape, { eyeW: number; eyeUp: number; eyeLow: number; eyeTilt: number; crease: number; hood: number; socket: number; round: number; inner: number; browH?: number }> = {
  round: { eyeW: 0.0166, eyeUp: 0.0108, eyeLow: 0.0072, eyeTilt: 0.01, crease: 1, hood: 0, socket: 0.2, round: 1, inner: 0 },
  almond: { eyeW: 0.0196, eyeUp: 0.0084, eyeLow: 0.005, eyeTilt: 0.09, crease: 0.9, hood: 0.05, socket: 0.3, round: 0.55, inner: 0.15 },
  hooded: { eyeW: 0.018, eyeUp: 0.0084, eyeLow: 0.0052, eyeTilt: 0.02, crease: 0, hood: 1, socket: 0.5, round: 0.45, inner: 0 },
  narrow: { eyeW: 0.0198, eyeUp: 0.0058, eyeLow: 0.004, eyeTilt: 0.08, crease: 0.35, hood: 0.25, socket: 0.15, round: 0.15, inner: 0.3 },
  deepSet: { eyeW: 0.017, eyeUp: 0.0078, eyeLow: 0.0052, eyeTilt: 0, crease: 0.9, hood: 0.3, socket: 1, round: 0.6, inner: 0, browH: -0.0035 },
  downturned: { eyeW: 0.0182, eyeUp: 0.0088, eyeLow: 0.0056, eyeTilt: -0.11, crease: 0.85, hood: 0.15, socket: 0.35, round: 0.65, inner: 0 },
  upturned: { eyeW: 0.0188, eyeUp: 0.0084, eyeLow: 0.0048, eyeTilt: 0.17, crease: 0.8, hood: 0.05, socket: 0.25, round: 0.5, inner: 0.25 },
  monolid: { eyeW: 0.0186, eyeUp: 0.007, eyeLow: 0.0046, eyeTilt: 0.11, crease: 0, hood: 0.4, socket: 0.1, round: 0.2, inner: 0.7 },
};

export const IRIS_COLOURS: Record<IrisName, string> = {
  nearBlack: "#2a170c", darkBrown: "#3d2412", brown: "#5a3518", lightBrown: "#7a4c20", hazel: "#7d6a30", amber: "#96681f",
  green: "#5d8a56", greyGreen: "#77886a", blue: "#4c84bc", lightBlue: "#7da8cf", grey: "#8292a0",
};

const BROW_STYLES: Record<BrowStyle, { browT: number; browArch: number; browTilt: number; browTaper: number; browPeak: number }> = {
  straight: { browT: 0.0054, browArch: 0.0008, browTilt: 0.001, browTaper: 0.55, browPeak: 0.9 },
  softArch: { browT: 0.0052, browArch: 0.003, browTilt: 0.002, browTaper: 0.45, browPeak: 0.8 },
  highArch: { browT: 0.0046, browArch: 0.0058, browTilt: 0.0045, browTaper: 0.3, browPeak: 0.72 },
  angled: { browT: 0.0058, browArch: 0.0036, browTilt: -0.002, browTaper: 0.5, browPeak: 0.62 },
  rounded: { browT: 0.005, browArch: 0.0048, browTilt: 0.0005, browTaper: 0.42, browPeak: 1 },
  flatThick: { browT: 0.007, browArch: 0.0012, browTilt: 0, browTaper: 0.62, browPeak: 0.9 },
};

type Pool<T extends string> = readonly (readonly [T, number])[];
/** What each heritage draws from, and how often. Several each, most shared: variety inside every heritage. */
export const HERITAGE_FEATURES: Record<string, { eyes: Pool<EyeShape>; iris: Pool<IrisName>; brows: Pool<BrowStyle>; lipUp: [number, number]; lipLow: [number, number]; browT: number; freckles: number }> = {
  black: {
    eyes: [["round", 3], ["almond", 3], ["hooded", 2], ["deepSet", 1], ["downturned", 1], ["upturned", 1]],
    iris: [["nearBlack", 5], ["darkBrown", 10], ["brown", 4], ["hazel", 1]],
    brows: [["straight", 3], ["softArch", 3], ["angled", 2], ["rounded", 2], ["flatThick", 2], ["highArch", 1]],
    lipUp: [0.0042, 0.0064], lipLow: [0.006, 0.0084], browT: 1.05, freckles: 0.03,
  },
  mixed: {
    eyes: [["almond", 3], ["round", 2], ["hooded", 2], ["upturned", 1], ["deepSet", 1], ["downturned", 1]],
    iris: [["darkBrown", 6], ["brown", 5], ["lightBrown", 3], ["hazel", 3], ["green", 1], ["amber", 1]],
    brows: [["softArch", 3], ["straight", 2], ["angled", 2], ["rounded", 2], ["highArch", 1], ["flatThick", 1]],
    lipUp: [0.0038, 0.006], lipLow: [0.0054, 0.008], browT: 1, freckles: 0.1,
  },
  white: {
    eyes: [["almond", 2], ["round", 2], ["hooded", 2], ["deepSet", 3], ["downturned", 2], ["narrow", 1]],
    iris: [["blue", 5], ["lightBlue", 2], ["grey", 3], ["green", 3], ["greyGreen", 1], ["hazel", 3], ["brown", 4], ["lightBrown", 2], ["darkBrown", 1]],
    brows: [["straight", 3], ["softArch", 3], ["angled", 2], ["rounded", 1], ["flatThick", 2], ["highArch", 1]],
    lipUp: [0.0026, 0.0048], lipLow: [0.004, 0.0066], browT: 0.95, freckles: 0.16,
  },
  southAsian: {
    eyes: [["almond", 3], ["round", 3], ["deepSet", 2], ["hooded", 1], ["downturned", 1]],
    iris: [["darkBrown", 8], ["nearBlack", 3], ["brown", 5], ["lightBrown", 1], ["hazel", 1]],
    brows: [["softArch", 3], ["straight", 2], ["flatThick", 3], ["angled", 2], ["rounded", 1], ["highArch", 1]],
    lipUp: [0.0034, 0.0056], lipLow: [0.005, 0.0076], browT: 1.1, freckles: 0.02,
  },
  eastAsian: {
    eyes: [["monolid", 3], ["narrow", 2], ["almond", 2], ["hooded", 2], ["upturned", 1], ["round", 1]],
    iris: [["darkBrown", 9], ["nearBlack", 5], ["brown", 3]],
    brows: [["straight", 4], ["softArch", 2], ["angled", 2], ["flatThick", 1], ["rounded", 1]],
    lipUp: [0.003, 0.0052], lipLow: [0.0046, 0.0072], browT: 0.92, freckles: 0.03,
  },
  mena: {
    eyes: [["almond", 3], ["deepSet", 2], ["round", 2], ["hooded", 1], ["downturned", 1]],
    iris: [["darkBrown", 6], ["brown", 6], ["lightBrown", 2], ["hazel", 3], ["green", 1], ["amber", 1]],
    brows: [["flatThick", 3], ["softArch", 3], ["angled", 2], ["straight", 2], ["rounded", 1], ["highArch", 1]],
    lipUp: [0.0032, 0.0054], lipLow: [0.0048, 0.0074], browT: 1.12, freckles: 0.03,
  },
  latin: {
    eyes: [["almond", 3], ["round", 2], ["hooded", 1], ["deepSet", 1], ["upturned", 1], ["downturned", 1]],
    iris: [["darkBrown", 6], ["brown", 6], ["lightBrown", 2], ["hazel", 3], ["green", 1], ["amber", 1]],
    brows: [["softArch", 3], ["straight", 2], ["angled", 2], ["flatThick", 2], ["rounded", 1], ["highArch", 1]],
    lipUp: [0.0032, 0.0056], lipLow: [0.0048, 0.0076], browT: 1.04, freckles: 0.05,
  },
};

/**
 * THE FACE'S BUILD (Harry, 20 Nov 2026, on the first sheet: "there's not many normal looking faces …
 * analyse some footballers"). Footballers are athletes: lean faces, cheekbones that show, a defined
 * jaw. From the usual measures of adult men's faces (used as statistics only, never one person's
 * face): the jaw's width is about 0.75 to 0.85 of the cheekbones' width, the face about 1.3 to 1.4
 * times as high as it is wide, each eye about a fifth of the face's width, the nose about a third of
 * its height. A build sets the OUTLINE (how wide the lower face is, how it tapers to the chin, how
 * full the cheeks are); the nose, lips and eyes stay his heritage's. Most players get one of the
 * lean builds; the soft and heavy ones are rare, and mostly staff and fans.
 */
export type FaceBuild = "athletic" | "angular" | "square" | "long" | "youth" | "broad" | "soft" | "heavy";
export const FACE_BUILDS: Record<FaceBuild, { label: string; shape: FaceShape }> = {
  athletic: { label: "Lean, athletic (the usual footballer)", shape: { faceW: -0.055, taper: 0.08, full: -0.0014, cheek: 0.002, jawW: -0.01, chinLen: 0.001 } },
  angular: { label: "Angular, cheekbones that show", shape: { faceW: -0.07, taper: 0.12, full: -0.0018, cheek: 0.005, chinLen: 0.002 } },
  square: { label: "Square jaw, lean", shape: { faceW: -0.035, taper: -0.02, jawW: 0.015, full: -0.0013, chinW: 0.08, cheek: 0.002 } },
  long: { label: "Narrow, long face", shape: { faceW: -0.07, taper: 0.08, faceLen: 0.009, chinLen: 0.003, full: -0.0012 } },
  youth: { label: "Young and slim (17 to 21)", shape: { faceW: -0.05, taper: 0.1, chinLen: -0.002, faceLen: -0.003, cheek: 0.001 } },
  broad: { label: "Broad and strong, not fat", shape: { faceW: -0.02, jawW: 0.025, taper: -0.01, full: -0.001, cheek: 0.003, chinW: 0.06 } },
  soft: { label: "Average, a little fuller (older staff)", shape: { faceW: 0, full: 0.001, taper: 0 } },
  heavy: { label: "Round and heavy (rare)", shape: { faceW: 0.04, full: 0.0022, taper: -0.04 } },
};
const BUILD_POOL: Record<"player" | "other", Pool<FaceBuild>> = {
  player: [["athletic", 40], ["angular", 15], ["square", 13], ["long", 11], ["youth", 4], ["broad", 9], ["soft", 3], ["heavy", 1]],
  other: [["athletic", 20], ["angular", 8], ["square", 10], ["long", 8], ["broad", 12], ["soft", 28], ["heavy", 14]],
};
/** The outline's sliders: a build sets these, with a little of his own either way. */
const OUTLINE: Partial<Record<keyof FaceShape, number>> = { faceW: 0.014, taper: 0.03, full: 0.0005, cheek: 0.0015, jawW: 0.012, chinLen: 0.0025, chinW: 0.05, faceLen: 0.004 };
/**
 * What undoes the two re-shaped heads' own puff under a lean build (the broad-jaw and round-face head
 * files are wide and full below the cheekbones; on those files a lean build starts from here).
 */
export const HEAD_LEAN: Record<string, FaceShape> = { h7: { faceW: -0.05, full: -0.001 }, h9: { faceW: -0.085, full: -0.0024, taper: 0.04 } };

/** A stable 32-bit hash (FNV-1a, as bodies.ts hashId; kept here so this file stays on its own). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  // a last scramble: FNV's low bits barely change between ids that differ in one digit
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}
const clamp = (x: number, r: readonly [number, number] | readonly number[]) => Math.min(r[1], Math.max(r[0], x));
function pick<T extends string>(pool: Pool<T>, u: number): T {
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let x = u * total;
  for (const [v, w] of pool) { x -= w; if (x < 0) return v; }
  return pool[pool.length - 1][0];
}
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, "0")).join("")}`;
}
const lum = (h: string) => (0.2126 * parseInt(h.slice(1, 3), 16) + 0.7152 * parseInt(h.slice(3, 5), 16) + 0.0722 * parseInt(h.slice(5, 7), 16)) / 255;

export interface FaceIdContext {
  /** His skin as painted (sRGB hex) and his hair colour (with its grey). */
  skin: string;
  hair: string;
  /** The hair's own colour before any grey, if known (the brows keep more of it). */
  hairBase?: string;
  /** "ginger", "blond" … (freckles follow it). */
  hairId?: string;
  age?: number;
  /** What the preset says he wears on his chin (presets.ts beardOf). */
  beard?: "none" | "stubble" | "short" | "full";
  /** His heritage's face type and its strength (faceShape.ts faceFor). */
  faceType?: ToonFaceId;
  faceK?: number;
  /** A player (most are lean) or anyone else. */
  role?: string;
}

/** The facial hair for a preset's beard word: several ways to wear each, picked by the id. */
function beardFor(id: string, word: FaceIdContext["beard"], u: (w: string) => number): Pick<FaceId, "beardStyle" | "beardCheek" | "beardChin" | "beardMous" | "beardDensity" | "beardLen" | "beardLine" | "beardStrap" | "beardSoul"> {
  const B = (beardStyle: BeardStyle, beardCheek: number, beardChin: number, beardMous: number, beardDensity: number, beardLen: number, beardLine: number, beardStrap = 0, beardSoul = 0) =>
    ({ beardStyle, beardCheek, beardChin, beardMous, beardDensity, beardLen, beardLine, beardStrap, beardSoul });
  const line = 0.3 + 0.5 * u("bline");
  if (!word || word === "none") return B("none", 0, 0, 0, 0, 0, 0);
  if (word === "stubble") return u("bstyle") < 0.7 ? B("stubble", 1, 1, 1, 0.4 + 0.15 * u("bd"), 0, line) : B("heavyStubble", 1, 1, 1, 0.6 + 0.12 * u("bd"), 0.15, line);
  if (word === "full") return B("full", 1, 1, 1, 1, 0.85 + 0.15 * u("bl"), 0.6 + 0.3 * u("bline"), 0, 1);
  const k = u("bstyle");
  if (k < 0.4) return B("boxed", 1, 1, 1, 0.9, 0.5, 0.2 + 0.4 * u("bline"), 0, 1);
  if (k < 0.58) return B("faded", 0.5, 1, 1, 0.85, 0.4, line, 0, 1);
  if (k < 0.74) return B("goatee", 0, 1, 1, 0.92, 0.5, 0, 0, 1);
  if (k < 0.86) return B("circle", 0, 1, 1, 0.9, 0.45, 0, 0, 0);
  if (k < 0.95) return B("strap", 1, 1, u("bm") < 0.5 ? 1 : 0, 0.9, 0.4, 0, 1, 0);
  return B("moustache", 0.35, 0.35, 1, 0.9, 0.5, line);
}

/**
 * A person's face from his id (the same id → the same face) inside his heritage's features.
 * `ctx` is what the rest of his look already says: skin, hair, age, beard.
 */
export function faceIdFor(id: string, heritage: string, ctx: FaceIdContext): FaceId {
  const H = HERITAGE_FEATURES[heritage] ?? HERITAGE_FEATURES.white;
  const u = (what: string) => hash(`${id}#fi-${what}`) / 4294967296;
  /** −1 … 1, more often near 0. */
  const j = (what: string) => (u(what) + u(`${what}b`) - 1);
  /** −1 … 1, evenly: the mould's sliders use their whole range. */
  const jw = (what: string) => u(what) * 2 - 1;
  const L = FACE_LIMITS;

  // eyes
  const eyeShape = pick(H.eyes, u("eye"));
  const E = EYE_SHAPES[eyeShape];
  const size = 1 + 0.06 * j("eyesize");
  const light = lum(ctx.skin);
  let irisName = pick(H.iris, u("iris"));
  // fair and ginger hair goes with light eyes a little more often (still any colour)
  if (heritage === "white" && (ctx.hairId === "blond" || ctx.hairId === "fair" || ctx.hairId === "ginger") && (irisName === "darkBrown" || irisName === "brown") && u("iris2") < 0.5) irisName = pick([["blue", 3], ["green", 2], ["grey", 2], ["hazel", 1]], u("iris3"));
  const iris = mixHex(IRIS_COLOURS[irisName], u("irisv") < 0.5 ? "#1c120a" : "#b9a37a", 0.1 * u("irisk"));

  // brows: the hair's own colour, darker where it is fair or grey so the face keeps its features
  const browStyle = pick(H.brows, u("brow"));
  const BS = BROW_STYLES[browStyle];
  const hairBase = ctx.hairBase ?? ctx.hair;
  const browBase = mixHex(hairBase, ctx.hair, 0.45);
  const brow = mixHex(browBase, "#1c1410", lum(browBase) > 0.3 ? 0.45 : lum(browBase) > 0.16 ? 0.25 : 0);

  // lips: his skin towards a rose (light skin) or a deep brown-rose (dark skin)
  const lip = mixHex(ctx.skin, light > 0.5 ? "#b4584f" : light > 0.32 ? "#8a4338" : "#5a2c2a", 0.5 + 0.14 * j("liphue"));
  const lipK = u("lipfull");
  const lipUp = H.lipUp[0] + (H.lipUp[1] - H.lipUp[0]) * lipK;
  const lipLow = H.lipLow[0] + (H.lipLow[1] - H.lipLow[0]) * clamp(lipK + 0.25 * j("liplow"), [0, 1]);

  // marks
  const age = ctx.age ?? 27;
  const fr = H.freckles * (ctx.hairId === "ginger" ? 4 : ctx.hairId === "blond" || ctx.hairId === "chestnut" ? 1.4 : 1);
  const freckles = u("freckle") < fr ? 0.45 + 0.55 * u("frecklek") : 0;
  const moleOn = u("mole") < 0.13;
  const moleSpot = Math.floor(u("molespot") * 4);

  // the mould: the OUTLINE from his build (most players lean), a little of his own either way; the nose,
  // lips and brow ridge from his heritage's face type plus his own sliders
  const faceType = ctx.faceType ?? "base";
  const T = TOON_FACE_TYPES[faceType]?.shape ?? {};
  const k = ctx.faceK ?? 1;
  const S = L.shape;
  const young = age <= 21 && ctx.role === "player";
  const faceBuild = young && u("build-y") < 0.45 ? "youth" : pick(BUILD_POOL[ctx.role === "player" ? "player" : "other"], u("build"));
  const B = FACE_BUILDS[faceBuild].shape;
  const own = (key: keyof typeof S, amount: number, bias = 0) => key in OUTLINE
    ? clamp(((B[key] as number | undefined) ?? 0) + (OUTLINE[key] ?? 0) * jw(`s-${key}`), S[key])
    : clamp(((T[key] as number | undefined) ?? 0) * k * 0.7 + bias + amount * jw(`s-${key}`), S[key]);
  const shape: FaceId["shape"] = {
    ...Object.fromEntries(Object.entries(T).filter(([key]) => !(key in OUTLINE)).map(([key, v]) => [key, (v as number) * k * 0.7])),
    jawW: own("jawW", 0), chinLen: own("chinLen", 0), chinW: own("chinW", 0), cheek: own("cheek", 0), full: own("full", 0),
    noseW: own("noseW", 0.3, 0.03), noseLen: own("noseLen", 0.005, 0.0005), noseBridge: own("noseBridge", 0.005), noseTip: own("noseTip", 0.003), faceLen: own("faceLen", 0), browRidge: own("browRidge", 0.002),
    lips: clamp(((T.lips ?? 0) * k) * 0.6 + (lipK - 0.5) * 0.3, S.lips), faceW: own("faceW", 0), taper: own("taper", 0),
  };

  return {
    eyeShape,
    eyeW: clamp(E.eyeW * size, L.eyeW), eyeUp: clamp(E.eyeUp * size * (1 + 0.08 * j("eyeup")), L.eyeUp), eyeLow: clamp(E.eyeLow * size * (1 + 0.08 * j("eyelow")), L.eyeLow),
    eyeRound: clamp(E.round + 0.12 * j("round"), [0, 1]), eyeInner: clamp(E.inner + 0.1 * j("inner"), [0, 1]),
    eyeTilt: clamp(E.eyeTilt + 0.025 * j("tilt"), L.eyeTilt), eyeGap: clamp(0.0028 * j("gap"), L.eyeGap), eyeDy: clamp(0.0012 * j("eyedy"), L.eyeDy),
    irisR: clamp(0.0076 * (0.5 + 0.5 * size) * (1 + 0.07 * j("irisr")) * (eyeShape === "round" ? 1.06 : eyeShape === "narrow" ? 0.94 : 1), L.irisR),
    crease: clamp(E.crease + 0.15 * j("crease"), [0, 1]), hood: clamp(E.hood + 0.15 * j("hood") + Math.max(0, age - 45) * 0.012, [0, 1]), socket: clamp(E.socket + 0.2 * j("socket"), [0, 1]),
    lash: clamp(0.85 + 0.35 * j("lash"), [0.4, 1.4]), underEye: clamp(Math.max(0, age - 40) / 22 + (u("tired") < 0.14 ? 0.5 : 0), [0, 1]),
    irisName, iris,
    browStyle,
    browH: clamp(0.0212 + (E.browH ?? 0) + 0.002 * j("browh") + BS.browArch * 0.15, L.browH), browT: clamp(BS.browT * H.browT * (1 + 0.14 * j("browt")), L.browT),
    browArch: clamp(BS.browArch * (1 + 0.2 * j("arch")), L.browArch), browTilt: clamp(BS.browTilt + 0.0012 * j("browtilt"), L.browTilt),
    browLen: clamp(2.22 + 0.2 * j("browlen"), L.browLen), browGap: clamp(0.06 * j("browgap"), [-0.08, 0.08]), browTaper: clamp(BS.browTaper + 0.08 * j("taper"), [0.22, 0.7]), browPeak: BS.browPeak,
    browDensity: clamp(0.86 + 0.14 * j("browd") - Math.max(0, age - 50) * 0.006, [0.6, 1]),
    brow,
    mouthW: clamp(1 + 0.1 * j("mouthw"), L.mouthW), lipUp: clamp(lipUp, L.lipUp), lipLow: clamp(lipLow, L.lipLow), lipTone: clamp(0.72 + 0.2 * j("liptone"), [0.5, 1]), mouthDy: 0.001 * j("mouthdy"),
    lip,
    freckles, age: clamp((age - 38) / 22, [0, 1]), blush: light > 0.45 ? clamp(0.25 + 0.35 * j("blush"), [0, 0.7]) : clamp(0.1 + 0.15 * j("blush"), [0, 0.3]),
    mole: moleOn ? 1 : 0, moleX: [0.034, -0.03, 0.022, -0.04][moleSpot] + 0.004 * j("molex"), moleY: [0.03, 0.012, -0.022, 0.045][moleSpot] + 0.003 * j("moley"),
    ...beardFor(id, ctx.beard, u),
    faceType, faceBuild, shape,
  };
}

/** Two faces a person would tell apart at a glance share none of these words: a coarse name for a face (the variety count). */
export function faceIdKey(f: FaceId): string {
  const b3 = (x: number, r: readonly number[]) => (x < r[0] + (r[1] - r[0]) / 3 ? "-" : x > r[1] - (r[1] - r[0]) / 3 ? "+" : "0");
  const S = FACE_LIMITS.shape;
  return [f.eyeShape, f.irisName, f.browStyle, f.faceBuild, b3(f.browT, FACE_LIMITS.browT), b3(f.lipLow, FACE_LIMITS.lipLow), f.beardStyle, f.freckles > 0 ? "f" : "", f.mole ? "m" : "", f.age > 0.3 ? "a" : "",
    `j${b3(f.shape.faceW, S.faceW)}`, `n${b3(f.shape.noseW, S.noseW)}`, `c${b3(f.shape.chinLen, S.chinLen)}`, `l${b3(f.shape.faceLen, S.faceLen)}`].join("|");
}

// ── Emotions ──────────────────────────────────────────────────────────────

/** Today's twelve face numbers (cutscene/face.ts FaceParams) plus two: a one-sided smile and one brow up. */
export interface FaceEmotion extends FaceParams {
  /** The smile on one side only (his left +) −1 … 1. */
  smirk: number;
  /** One brow higher than the other (his left +) −1 … 1. */
  browAsym: number;
}
export const NEUTRAL_EMOTION: FaceEmotion = { ...NEUTRAL_FACE, smirk: 0, browAsym: 0 };
export type EmotionName = "neutral" | "happy" | "proud" | "angry" | "sad" | "worried" | "smug" | "shocked";
/** Where the eyes go with an emotion (added to wherever he is looking): across, up. */
export const EMOTION_GAZE: Record<EmotionName, [number, number]> = {
  neutral: [0, 0], happy: [0, 0], proud: [0, 0.25], angry: [0, -0.1], sad: [0, -0.65], worried: [0.7, 0], smug: [-0.45, 0], shocked: [0, 0.05],
};
const N = NEUTRAL_EMOTION;
export const FACE_EMOTIONS: Record<EmotionName, FaceEmotion> = {
  neutral: N,
  happy: { ...N, smile: 0.95, open: 0.42, wide: 0.6, teeth: 0.2, cheek: 0.9, lidLow: 0.55, lid: 0.9, browUp: 0.35 },
  proud: { ...N, smile: 0.6, press: 0.2, cheek: 0.4, lidLow: 0.3, lid: 0.85, browUp: 0.2 },
  angry: { ...N, smile: -0.45, press: 0.8, browAngry: 1, lid: 0.74, lidLow: 0.45 },
  sad: { ...N, smile: -0.75, browSad: 1, lid: 0.64, press: 0.2 },
  worried: { ...N, smile: -0.3, browSad: 0.8, browUp: 0.3, lid: 1.15, press: 0.5, open: 0.1 },
  smug: { ...N, smile: 0.35, smirk: 0.7, browUp: 0.45, browAsym: 0.9, lid: 0.68, lidLow: 0.25 },
  shocked: { ...N, smile: -0.1, open: 1, browUp: 1, lid: 1.4, wide: -0.3 },
};
export const EMOTION_NAMES = Object.keys(FACE_EMOTIONS) as EmotionName[];
const EKEYS = Object.keys(NEUTRAL_EMOTION) as (keyof FaceEmotion)[];

/** A weighted blend of emotions (weights need not add to 1: the rest is neutral). */
export function blendEmotions(w: Partial<Record<EmotionName, number>>): FaceEmotion {
  const o = { ...NEUTRAL_EMOTION };
  for (const [name, wt] of Object.entries(w) as [EmotionName, number][]) {
    if (!wt) continue;
    const e = FACE_EMOTIONS[name];
    for (const key of EKEYS) o[key] += (e[key] - NEUTRAL_EMOTION[key]) * wt;
  }
  return o;
}
/** The eyes' offset for a blend of emotions. */
export function emotionGaze(w: Partial<Record<EmotionName, number>>): [number, number] {
  let x = 0, y = 0;
  for (const [name, wt] of Object.entries(w) as [EmotionName, number][]) { x += EMOTION_GAZE[name][0] * (wt ?? 0); y += EMOTION_GAZE[name][1] * (wt ?? 0); }
  return [x, y];
}
