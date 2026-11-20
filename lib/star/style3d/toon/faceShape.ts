/**
 * FACE TYPES for the Style A people (Harry, 20 Nov 2026: "we need more face types"). Every head
 * shared one of two base faces; here a face is a set of small measured changes to the head's own
 * face, made on the mesh when the person is built (no new files): the nose (width, bridge, length),
 * the lips (fullness), the eyes (spacing, size, tilt), the brow ridge, the cheekbones, the cheeks,
 * the jaw and the chin. Pure (no three.js): tested in tests/star/peoplePresets.mts; put on a
 * person by faceShapeApply.ts.
 *
 * RUL-3D-010: features follow heritage, with real variety inside each and no caricature. Each
 * heritage draws from several faces (and shares some with others), the changes are millimetres,
 * and a person's own face is one of them scaled a little either way, so no group has "the" face.
 *
 * Only the front of the face below the brow moves. The skull, the ears, the sides and the back of
 * the head stay exactly where they are, so the modelled hair (hairStyles.ts) still fits; the picture,
 * the masks and the moving face are read from the head's own rest pose (the shader's aRest), so
 * eyes, brows, blinks, mouth and beard work as on the base head.
 */
import type { ToonFaceLandmarks } from "./faceLandmarks";

/** Every number is a change from the base face: 0 = as modelled. Lengths in metres, the rest shares. */
export interface FaceShape {
  /** The nose's wings wider (+) or narrower (share of their width). */
  noseW?: number;
  /** The bridge higher (+) or lower, metres. */
  noseBridge?: number;
  /** The tip lower (a longer nose, +) or higher, metres; and further out. */
  noseLen?: number;
  noseTip?: number;
  /** Fuller (+) or thinner lips (share of their height). */
  lips?: number;
  mouthW?: number;
  /** The mouth and upper jaw further forward, metres. */
  mid?: number;
  /** Eyes further apart (+), metres each; bigger (+, share); the outer corner higher (+), metres. */
  eyeGap?: number;
  eyeSize?: number;
  eyeTilt?: number;
  /** A heavier brow ridge, metres. */
  browRidge?: number;
  /** Cheekbones further out, metres; fuller lower cheeks, metres. */
  cheek?: number;
  full?: number;
  /** The jaw wider (+, share); the chin longer (metres), wider (share), further forward (metres). */
  jawW?: number;
  chinLen?: number;
  chinW?: number;
  chinZ?: number;
  /** THE OUTLINE: the lower face (below the ears, cheeks and jaw as seen from the front) wider (+) or narrower, a share; not multiplied by FACE_GAIN. */
  faceW?: number;
  /** The jaw tapering in towards the chin (+, a V) or squaring out (−), a share. */
  taper?: number;
  /** The lower face longer (+) or shorter, metres at the chin (the mouth and nose move their share); not multiplied by FACE_GAIN. */
  faceLen?: number;
}

export type ToonFaceId =
  | "base" | "a1" | "a2" | "a3" | "c1" | "s1" | "s2" | "e1" | "e2" | "e3" | "m1" | "m2" | "l1" | "l2" | "w1" | "w2" | "w3" | "w4" | "x1";

export const TOON_FACE_TYPES: Record<ToonFaceId, { label: string; shape: FaceShape }> = {
  base: { label: "As modelled", shape: {} },
  a1: { label: "Broad nose, full lips, wide cheekbones", shape: { noseW: 0.3, noseBridge: -0.003, lips: 0.45, mid: 0.003, cheek: 0.003, jawW: 0.02, faceW: 0.028 } },
  a2: { label: "High cheekbones, full lips, narrow jaw", shape: { noseW: 0.08, noseBridge: 0.001, lips: 0.35, cheek: 0.004, jawW: -0.035, chinLen: 0.003, eyeSize: 0.05, faceW: -0.03, taper: 0.08 } },
  a3: { label: "Broad nose, round cheeks, strong jaw", shape: { noseW: 0.22, lips: 0.28, full: 0.002, jawW: 0.03, browRidge: 0.002, faceW: 0.032 } },
  c1: { label: "Medium nose, fuller lips, soft chin", shape: { noseW: 0.14, lips: 0.3, noseBridge: -0.001, chinW: 0.05, eyeGap: 0.001, taper: 0.03 } },
  s1: { label: "Long high-bridged nose, large eyes", shape: { noseLen: 0.004, noseBridge: 0.003, noseW: 0.05, lips: 0.15, eyeSize: 0.08, browRidge: 0.001, faceW: -0.03, taper: 0.05 } },
  s2: { label: "Rounded nose, soft cheeks, large eyes", shape: { noseW: 0.12, noseLen: 0.002, lips: 0.2, full: 0.0015, eyeSize: 0.06, faceW: 0.021 } },
  e1: { label: "Low bridge, wide cheekbones, narrower eyes", shape: { noseBridge: -0.004, noseW: 0.08, noseLen: -0.002, cheek: 0.004, eyeSize: -0.1, eyeTilt: 0.0016, eyeGap: 0.0015, browRidge: -0.0015, lips: 0.05, faceW: 0.032 } },
  e2: { label: "Oval face, small nose, defined jaw", shape: { noseBridge: -0.003, noseW: -0.05, eyeSize: -0.06, eyeTilt: 0.001, jawW: -0.03, chinLen: 0.002, faceW: -0.02, taper: 0.1 } },
  e3: { label: "Round face, soft nose, full cheeks", shape: { noseBridge: -0.002, noseW: 0.1, full: 0.002, eyeSize: -0.05, eyeTilt: 0.0008, chinW: 0.05, faceW: 0.035, taper: -0.03 } },
  m1: { label: "Prominent high-bridged nose, heavy brow", shape: { noseBridge: 0.0045, noseLen: 0.005, noseTip: 0.002, browRidge: 0.003, lips: 0.12, eyeSize: 0.04, taper: 0.04 } },
  m2: { label: "Straight strong nose, wide jaw", shape: { noseBridge: 0.003, noseW: 0.1, noseLen: 0.003, jawW: 0.025, browRidge: 0.002, faceW: 0.035, taper: -0.03 } },
  l1: { label: "Medium-broad nose, cheekbones, strong jaw", shape: { noseW: 0.12, cheek: 0.003, jawW: 0.025, lips: 0.18, browRidge: 0.0015, faceW: 0.028 } },
  l2: { label: "Longer nose, narrower face", shape: { noseLen: 0.003, noseBridge: 0.002, jawW: -0.03, lips: 0.08, faceW: -0.05, taper: 0.06 } },
  w1: { label: "Narrow nose, thin lips, long chin", shape: { noseW: -0.14, noseBridge: 0.003, lips: -0.25, chinLen: 0.004, cheek: 0.001, faceW: -0.06, taper: 0.08 } },
  w2: { label: "Wide cheekbones, short nose, thin lips", shape: { cheek: 0.0045, noseLen: -0.002, noseW: 0.05, lips: -0.15, jawW: 0.02, faceW: 0.035 } },
  w3: { label: "Small upturned nose, round chin, full cheeks", shape: { noseW: -0.06, noseLen: -0.003, noseTip: 0.001, full: 0.002, chinW: 0.08, lips: -0.05, faceW: 0.021, taper: -0.04 } },
  w4: { label: "Heavy brow, big nose, wide jaw, big chin", shape: { browRidge: 0.0035, noseW: 0.1, noseLen: 0.003, jawW: 0.035, lips: -0.2, chinZ: 0.003, chinW: 0.04, faceW: 0.035, taper: -0.06 } },
  x1: { label: "Narrow jaw, cheekbones, pointed chin", shape: { jawW: -0.05, cheek: 0.004, chinW: -0.05, chinLen: 0.003, noseW: -0.08, faceW: -0.04, taper: 0.14 } },
};
export const TOON_FACE_IDS = Object.keys(TOON_FACE_TYPES) as ToonFaceId[];

/**
 * The faces each heritage draws from, each as often as it is listed (lib/star/people/presets.ts
 * Heritage). Several each, some shared between groups: variety inside every heritage.
 */
export const HERITAGE_FACES: Record<string, readonly ToonFaceId[]> = {
  black: ["a1", "a1", "a1", "a2", "a2", "a3", "a3", "a3", "c1", "c1", "base"],
  mixed: ["c1", "c1", "c1", "a3", "a2", "l1", "s2", "x1", "base", "base"],
  white: ["w1", "w1", "w2", "w2", "w3", "w3", "w4", "w4", "x1", "l2", "base", "base"],
  southAsian: ["s1", "s1", "s1", "s2", "s2", "s2", "m2", "base"],
  eastAsian: ["e1", "e1", "e1", "e2", "e2", "e2", "e3", "e3", "e3", "base"],
  mena: ["m1", "m1", "m1", "m2", "m2", "m2", "l2", "s1"],
  latin: ["l1", "l1", "l1", "l2", "l2", "l2", "w2", "c1", "base"],
};

/** Where a head's face is, for the rule below (its measured spots and the file's own face). */
export interface FaceFrame { eyeY: number; browY: number; chinY: number; mouthY: number; noseX: number; noseY: number; noseZ: number; eyeX: number; frontZ: number; collarY: number }
export function faceFrame(lm: ToonFaceLandmarks, face: { chinY: number; eyeY: number; browY: number; frontZ: number }, collarY: number): FaceFrame {
  return {
    eyeY: (lm.eyes[0][1] + lm.eyes[1][1]) / 2, browY: lm.browY, chinY: face.chinY, mouthY: lm.mouth[1],
    noseX: lm.nose[0], noseY: lm.nose[1], noseZ: lm.nose[2], eyeX: (Math.abs(lm.eyes[0][0]) + Math.abs(lm.eyes[1][0])) / 2, frontZ: face.frontZ, collarY,
  };
}

const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const bell = (d: number, s: number) => Math.exp(-(d * d) / (s * s));

/**
 * How much of the rule a point takes: 1 on the front of the face, 0 above the brow, on the ears,
 * the sides and the back of the head, and below the chin. The modelled hair only ever sits where this is 0.
 */
export function faceZone(p: readonly [number, number, number], F: FaceFrame): number {
  const [, y, z] = p;
  return sm(F.frontZ - 0.125, F.frontZ - 0.09, z) * sm(F.browY + 0.015, F.browY, y) * sm(F.chinY - 0.04, F.chinY - 0.012, y) * sm(F.collarY - 0.005, F.collarY + 0.025, y);
}

/** Every face type's numbers are multiplied by this (the first sheets read too alike at phone size; Harry's team asked for about twice the first numbers). */
export const FACE_GAIN = 2;

/**
 * How much of the outline's change a point takes: the cheeks and jaw below the ears, from the ears
 * forward. 0 on the ears, behind them, on the neck's back, above the ears' lobes and below the chin:
 * hanging hair (locs, braids) falls from the ears' own width, 2 to 3 cm clear of the jaw it widens
 * by a few millimetres (checked against every hair: tools/hair3d/README.md "Face types").
 */
export function faceOutlineZone(p: readonly [number, number, number], F: FaceFrame): number {
  const [, y, z] = p;
  return sm(F.frontZ - 0.19, F.frontZ - 0.155, z) * sm(F.eyeY - 0.05, F.eyeY - 0.085, y) * sm(F.chinY - 0.04, F.chinY - 0.012, y) * sm(F.collarY - 0.005, F.collarY + 0.025, y);
}

/** Where a rest-pose point (metres, his left +x, up +y, front +z) goes for this face, `k` times as strong. */
export function faceShapePoint(p: readonly [number, number, number], F: FaceFrame, S: FaceShape, k = 1): [number, number, number] {
  const W = faceZone(p, F) * k * FACE_GAIN;
  const O = faceOutlineZone(p, F) * k;
  if (W <= 0 && O <= 0) return [p[0], p[1], p[2]];
  const [x0, y, z] = p;
  // the outline first: the lower face wider or narrower, the jaw tapering to the chin or squaring out
  // (a wider face is bone, not jowl: the widening is over by the jaw's lower edge, so nothing hangs over the neck)
  const bone = sm(F.chinY - 0.012, F.chinY + 0.03, y);
  const x = x0 * (1 + O * (Math.max(0, S.faceW ?? 0) * bone + Math.min(0, S.faceW ?? 0) - (S.taper ?? 0) * sm(F.mouthY + 0.03, F.chinY + 0.005, y) * ((S.taper ?? 0) < 0 ? bone : 1)));
  // a longer or shorter lower face: the chin moves the most, the mouth and the nose their share, the eyes not at all
  const lenZone = Math.max(O, faceZone(p, F) * k * sm(F.eyeY - 0.02, F.eyeY - 0.06, y));
  const yLen = (S.faceLen ?? 0) * lenZone * sm(F.eyeY - 0.02, F.chinY, y);
  if (W <= 0) return [x, y - yLen, z];
  const s = x < 0 ? -1 : 1, ax = Math.abs(x);
  let dx = 0, dy = 0, dz = 0;
  const v = (n: number | undefined) => n ?? 0;
  // the nose: wings, bridge, tip
  const gW = bell(x - F.noseX, 0.03) * bell(y - (F.noseY + 0.006), 0.022) * sm(F.noseZ - 0.07, F.noseZ - 0.035, z);
  dx += (x - F.noseX) * v(S.noseW) * gW;
  dz += v(S.noseBridge) * bell(x - F.noseX, 0.015) * bell(y - (F.eyeY - 0.012), 0.024) * sm(F.noseZ - 0.09, F.noseZ - 0.05, z);
  const gT = bell(x - F.noseX, 0.02) * bell(y - F.noseY, 0.018) * sm(F.noseZ - 0.05, F.noseZ - 0.02, z);
  dy -= v(S.noseLen) * gT; dz += v(S.noseTip) * gT;
  // the mouth
  const gL = bell(x, 0.042) * bell(y - F.mouthY, 0.015) * sm(F.noseZ - 0.085, F.noseZ - 0.05, z);
  dy += (y - F.mouthY) * v(S.lips) * gL; dz += v(S.lips) * 0.006 * gL; dx += x * v(S.mouthW) * gL;
  dz += v(S.mid) * bell(x, 0.05) * bell(y - (F.mouthY + 0.004), 0.03);
  // the eyes
  const gE = bell(ax - F.eyeX, 0.03) * bell(y - F.eyeY, 0.02);
  dx += s * (v(S.eyeGap) + (ax - F.eyeX) * v(S.eyeSize)) * gE;
  dy += ((y - F.eyeY) * v(S.eyeSize) + v(S.eyeTilt) * ((ax - F.eyeX) / 0.02)) * gE;
  dz += v(S.browRidge) * bell(ax - 0.04, 0.036) * bell(y - (F.browY - 0.004), 0.011);
  // cheekbones and cheeks
  const gC = bell(ax - 0.066, 0.026) * bell(y - (F.eyeY - 0.035), 0.024);
  dx += s * v(S.cheek) * 0.7 * gC; dz += v(S.cheek) * 0.5 * gC;
  const gF = bell(ax - 0.058, 0.03) * bell(y - (F.mouthY + 0.02), 0.03);
  dx += s * v(S.full) * gF; dz += v(S.full) * 0.6 * gF;
  // the jaw and the chin
  dx += x * v(S.jawW) * sm(F.mouthY + 0.035, F.mouthY - 0.015, y) * (v(S.jawW) > 0 ? bone : 1);
  const gCh = bell(y - F.chinY, 0.024) * sm(0.065, 0.015, ax);
  dy -= v(S.chinLen) * gCh; dz += v(S.chinZ) * gCh; dx += x * v(S.chinW) * bell(y - F.chinY, 0.026);
  return [x + dx * W, y - yLen + dy * W, z + dz * W];
}

/** A stable 32-bit hash (FNV-1a; as bodies.ts hashId, kept here so this file stays on its own). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** A person's face: one of his heritage's faces, a little weaker or stronger (0.8 … 1.2). The same id, the same face. */
export function faceFor(id: string, heritage: string): { face: ToonFaceId; k: number } {
  const pool = HERITAGE_FACES[heritage] ?? ["base"];
  return { face: pool[hash(`${id}#face`) % pool.length], k: 0.8 + (hash(`${id}#facek`) % 1000) / 2500 };
}
