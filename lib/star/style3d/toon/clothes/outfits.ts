/**
 * THE OUTFITS: where each garment is cut (landmarks of the body's own rest pose, metres), what SHAPE it has of its
 * own (build.ts GarmentSpec.shape: lofted legs and sleeves, swept torso, with each garment's ease and drop), and
 * which colours it takes (read from the uniforms dressPerson3d already set, so kit data, nation kits and people
 * presets drive them unchanged). Landmarks: the neck ring and collar line, the shoulder seam, the sleeve end the
 * file's kit measured (sleeveT), the wrist, the waist, the hem, the shorts end (shortsLoY), the sock top (sockY),
 * the boot top (bootY), the ankle.
 *
 * Silhouettes (Harry: "suits shouldn't look the same as hoodies"): kit = close; shirt = a little loose, hangs from
 * the chest; suit coat = structured shoulders, straight drop to below the hip; training jacket and hoodie = boxy,
 * the hoodie loosest with a hood; trousers = straight legs wider than the thigh, jeans slimmer, joggers tapered.
 */
import type * as THREE from "three";
import type { PersonMeta } from "../../../people3d";
import type { GarmentSpec } from "./build";
import type { ClothSlot } from "./index";

export type ClothKind = "kit" | "tracksuit" | "press" | "suit" | "polo" | "fan" | "hoodie" | "tee" | "shirt";
type V3 = [number, number, number];
type U = Record<string, { value: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
const NONE = -1;
const OFF = { neck: 1, sleeve: 1, hem: 1, leg: 1 };

/** Every cut line, from this body's own joints and kit lines. */
export function landmarks(meta: PersonMeta) {
  const j = (n: string) => (meta.joints[n] ?? [0, 0, 0]) as V3;
  const neck = j("neck"), hips = j("Hips"), sh = j("LeftArm");
  const mk = meta.kit as PersonMeta["kit"] & { collarY?: number; shortsLoY?: number; sleeveT?: number };
  const collarY = mk.collarY ?? neck[1] - 0.03;
  const upperArm = Math.hypot(...([0, 1, 2].map((k) => j("LeftForeArm")[k] - sh[k]) as V3));
  const LM = {
    neck, hips, collarY, upperArm, chestY: sh[1] - 0.09,
    sleeveShort: (mk.sleeveT ?? 0.62) + 0.04,
    wrist: 1.86,
    hem: hips[1] - 0.025,
    waist: hips[1] + 0.035,
    tuck: hips[1] + 0.015,
    shortsEnd: (mk.shortsLoY ?? 0.65) - 0.015,
    sockTop: meta.kit.sockY + 0.02,
    sockEnd: meta.kit.bootY + 0.006,
    shoeTop: meta.kit.bootY + 0.004,
    ankle: meta.kit.bootY + 0.03,
    seamX: Math.abs(sh[0]) - 0.035,
  };
  /** The neck opening: a ring round the neck's base, a low line lower at the front, never above the collar line; a V. */
  const neckRing = (pt: THREE.Vector3, rx: number, rzB: number, rzF: number, lift: number, vDepth = 0, vW = 0.07, drop = 0.035) => {
    const dx = pt.x - neck[0], dz = pt.z - (neck[2] + 0.012);
    const e = Math.hypot(dx / rx, dz / (dz > 0 ? rzF : rzB));
    const ring = (1 - e) * Math.min(rx, rzB);
    const front0 = Math.max(0, Math.min(1, (pt.z - neck[2]) / 0.06));
    const yLow = collarY + lift - drop * front0;
    const top = collarY - 0.004;
    let f = Math.max(Math.min(ring, pt.y - yLow), pt.y - top);
    if (vDepth > 0) {
      const front = Math.max(0, Math.min(1, (pt.z - neck[2]) / 0.05));
      const yV = top - vDepth * front * Math.max(0, 1 - Math.abs(dx) / vW);
      f = Math.max(f, (pt.y - yV) * 0.7);
    }
    return f;
  };
  return { LM, neckRing };
}
type LMs = ReturnType<typeof landmarks>["LM"];
type Ring = ReturnType<typeof landmarks>["neckRing"];

/** Long trousers: straight legs of their own (ease at thigh and hem), a waist that holds a tucked shirt. */
/** Long trousers: legs of their own (width × the leg's own size at thigh and hem; straight = drapes over knee and calf),
 *  a seat and waist shaped from the body (a touch over a tucked shirt). */
const trousers = (LM: LMs, k: [number, number], straight = false, seat = 1.06, cuff?: number): GarmentSpec => ({ name: "trousers", offset: 0.004, lip: 0.004,
  fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - (LM.waist + 0.01), sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.ankle - pt.y : NONE }),
  relax: [4, 10], shape: { legs: { top: k[0], hem: k[1], straight, cuff }, torso: { knots: [[0, seat, seat], [1, seat, seat]], hold: true } } });
const shoes = (LM: LMs): GarmentSpec => ({ name: "shoes", offset: 0.005, lip: 0.003,
  fields: (pt, arm, _a, leg) => (leg > 0.5 && arm < 0.5 ? { neck: pt.y - LM.shoeTop, sleeve: NONE, hem: NONE, leg: -pt.y - 0.001 } : OFF),
  relax: [2, 6], shape: { shoe: true } });
const longTop = (name: string, LM: LMs, ring: Ring, o: { off: number; neck: [number, number, number, number, number?, number?, number?]; hem: number; wrist?: number; shape: GarmentSpec["shape"]; collar?: GarmentSpec["collar"] }): GarmentSpec => ({
  name, offset: o.off, lip: 0.005, relax: [3, 10], collar: o.collar, shape: o.shape,
  fields: (pt, arm, armS) => ({ neck: ring(pt, o.neck[0], o.neck[1], o.neck[2], o.neck[3], o.neck[4] ?? 0, o.neck[5] ?? 0.07, o.neck[6] ?? 0.035), sleeve: arm > 0.5 ? (armS - (o.wrist ?? LM.wrist)) * LM.upperArm : NONE, hem: arm > 0.5 ? NONE : o.hem - pt.y, leg: NONE }),
});
const shortTop = (name: string, LM: LMs, ring: Ring, o: { off: number; hem: number; sleeve: number; shape: GarmentSpec["shape"]; collar?: GarmentSpec["collar"] }): GarmentSpec => ({
  name, offset: o.off, lip: 0.004, relax: [3, 10], collar: o.collar, shape: o.shape,
  fields: (pt, arm, armS) => ({ neck: ring(pt, 0.075, 0.066, 0.095, -0.028), sleeve: arm > 0.5 ? (armS - o.sleeve) * LM.upperArm : NONE, hem: arm > 0.5 ? NONE : o.hem - pt.y, leg: NONE }),
});

const C = (T: { r: number; g: number; b: number } | undefined, fb: [number, number, number]) => ({ r: T?.r ?? fb[0], g: T?.g ?? fb[1], b: T?.b ?? fb[2] });
type RGB = ReturnType<typeof C>;
function col(three: typeof THREE.Color, c: RGB, k = 1) { return new three(c.r * k, c.g * k, c.b * k); }
const same = (a: RGB, b: RGB) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.05;
const shoeSlot = (u: U, Color: typeof THREE.Color, fb: [number, number, number] = [0.02, 0.02, 0.02]): ClothSlot => ({ color: col(Color, C(u.uShoes?.value, fb)), trim: new Color(0.05, 0.045, 0.04), fabric: "cotton", bands: [0, 0, 0, 0.016] });

export interface OutfitDef {
  garments(meta: PersonMeta, variant: string): GarmentSpec[];
  slots(u: U, variant: string, Color: typeof THREE.Color, meta: PersonMeta): ClothSlot[];
}

export const OUTFITS: Record<ClothKind, OutfitDef> = {
  kit: {
    garments(meta, variant) {
      const { LM, neckRing } = landmarks(meta);
      const shape: GarmentSpec["shape"] = undefined;  // the kit as approved: close to the body
      const torso = (pt: THREE.Vector3, arm: number, armS: number) => ({
        neck: neckRing(pt, 0.075, 0.066, 0.095, -0.028),
        sleeve: arm > 0.5 ? (armS - LM.sleeveShort) * LM.upperArm : NONE,
        hem: arm > 0.5 ? NONE : LM.tuck - pt.y, leg: NONE,
      });
      const g: GarmentSpec[] = [];
      if (variant === "kit-sleeves") {
        g.push({ name: "shirt", offset: 0.007, lip: 0.004, shape, collar: { kind: "crew", h: 0.016, out: 0.010 }, fields: (pt, a, s) => ({ ...torso(pt, a, s), cut: Math.abs(pt.x) - LM.seamX }) });
        g.push({ name: "sleeves", offset: 0.007, lip: 0.004, shape, fields: (pt, a, s) => ({ ...torso(pt, a, s), cut: LM.seamX - Math.abs(pt.x) }) });
      } else g.push({ name: "shirt", offset: 0.007, lip: 0.004, shape, collar: { kind: "crew", h: 0.016, out: 0.010 }, fields: torso });
      g.push({ name: "shorts", offset: 0.014, lip: 0.005,
        fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - LM.waist, sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.shortsEnd - pt.y : NONE }) });
      g.push({ name: "socks", offset: 0.004, lip: 0.003, relax: [2, 8],
        fields: (pt, arm, _a, leg) => (leg > 0.5 && arm < 0.5 ? { neck: pt.y - LM.sockTop, sleeve: NONE, hem: LM.sockEnd - pt.y, leg: NONE } : OFF) });
      return g;
    },
    slots(u, variant, Color, meta) {
      const shirt = C(u.uShirt?.value, [0.6, 0.05, 0.05]), trim = C(u.uTrim?.value, [1, 1, 1]), shorts = C(u.uShorts?.value, [1, 1, 1]), socks = C(u.uSocks?.value, [0.6, 0.05, 0.05]);
      const code = Math.round(u.uPattern?.value?.x ?? 0), p2 = C(u.uPat2?.value, [1, 1, 1]);
      const { LM } = landmarks(meta);
      const pattern = code === 1 || code === 2 ? { kind: code as 1 | 2, color: col(Color, p2), width: code === 1 ? 0.045 : 0.05, centre: LM.chestY } : undefined;
      const s: ClothSlot[] = [{ color: col(Color, shirt), trim: col(Color, trim), fabric: "poly", bands: [0.012, variant === "kit-sleeves" ? 0 : 0.016, 0, 0], pattern }];
      if (variant === "kit-sleeves") s.push({ color: col(Color, p2), trim: col(Color, same(p2, shirt) ? trim : shirt), fabric: "poly", bands: [0, 0.016, 0, 0] });
      s.push({ color: col(Color, shorts), trim: col(Color, shorts, 0.82), fabric: "poly", bands: [0.03, 0, 0, 0] });
      s.push({ color: col(Color, socks), trim: col(Color, same(socks, trim) ? shirt : trim), fabric: "cotton", bands: [0.022, 0, 0, 0] });
      return s;
    },
  },
  tracksuit: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        longTop("jacket", LM, neckRing, { off: 0.012, neck: [0.074, 0.064, 0.085, -0.016], hem: LM.hips[1] - 0.075, collar: { kind: "crew", h: 0.042, out: -0.008 }, shape: { torso: { knots: [[-0.3, 1.07, 1.06], [0, 1.06, 1.05], [1, 1.04, 1.03]], boxy: 0.6, hem: LM.hips[1] - 0.075, hold: true } } }),
        trousers(LM, [1.07, 1.45], false, 1.05, 1.15), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const coat = C(u.uSuit?.value ? u.uSuitCoat?.value : u.uShirt?.value, [0.12, 0.13, 0.18]);
      let trim = C(u.uTrim?.value, [1, 1, 1]);
      if (same(trim, coat) || Math.abs(trim.r - coat.r) + Math.abs(trim.g - coat.g) + Math.abs(trim.b - coat.b) < 0.08) trim = { r: Math.min(1, coat.r * 2.6 + 0.08), g: Math.min(1, coat.g * 2.6 + 0.08), b: Math.min(1, coat.b * 2.6 + 0.08) };
      return [
        { color: col(Color, coat), trim: col(Color, trim), fabric: "poly", bands: [0, 0.035, 0.03, 0] },
        { color: col(Color, coat), trim: col(Color, coat, 0.8), fabric: "poly", bands: [0.028, 0, 0, 0.035] },
        shoeSlot(u, Color),
      ];
    },
  },
  press: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        longTop("shirt", LM, neckRing, { off: 0.004, neck: [0.07, 0.062, 0.08, -0.012], hem: LM.tuck, collar: { kind: "shirt", h: 0.022, out: 0.006, fold: 0.014 }, shape: undefined }),
        trousers(LM, [1.04, 1.3], false, 1.03), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const suit = !!u.uSuit?.value;
      const shirt = suit ? C(u.uSuitShirt?.value, [0.62, 0.72, 0.84]) : { r: 0.62, g: 0.72, b: 0.84 };
      const tr = suit ? C(u.uSuitTrousers?.value, [0.04, 0.045, 0.055]) : { r: 0.04, g: 0.045, b: 0.055 };
      return [
        { color: col(Color, shirt), trim: col(Color, shirt, 0.85), fabric: "cotton", bands: [0, 0.03, 0, 0] },
        { color: col(Color, tr), trim: new Color(0.03, 0.018, 0.01), fabric: "cotton", bands: [0.03, 0, 0, 0] },
        shoeSlot(u, Color),
      ];
    },
  },
  suit: {
    garments(meta, variant) {
      const { LM, neckRing } = landmarks(meta);
      return [
        { ...longTop("shirt", LM, neckRing, { off: 0.006, neck: [0.064, 0.058, 0.072, -0.004, 0, 0.07, 0.02], hem: LM.tuck, wrist: LM.wrist + 0.11, collar: { kind: "shirt", h: 0.026, out: -0.004, fold: 0 }, shape: { torso: { knots: [[0, 0.95, 0.96], [0.5, 0.97, 0.98], [1, 0.99, 0.99]] } } }),
          relax: [0, 8], armSmooth: 40, ...(variant === "suit-open" ? {} : { tie: { top: LM.collarY - 0.022, bottom: LM.waist + 0.02, w: 0.022 } }) },
        { ...longTop("coat", LM, neckRing, { off: 0.009, wrist: LM.wrist - 0.04, neck: [0.085, 0.072, 0.1, -0.03, 0.27, 0.11], hem: LM.hips[1] - 0.13, collar: { kind: "lapel", h: 0.024, out: 0.004, fold: 0.055 }, shape: { torso: { knots: [[-0.25, 1.08, 1.06], [0.0, 1.06, 1.05], [0.32, 1.02, 1.03], [1, 1.05, 1.04]], pad: 0.02, hem: LM.hips[1] - 0.06, hold: true } } }), armSmooth: 40 },
        trousers(LM, [1.05, 1.35], true, 1.03), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const coat = C(u.uSuitCoat?.value, [0.03, 0.035, 0.06]), tr = C(u.uSuitTrousers?.value, [0.03, 0.035, 0.06]);
      const shirt = C(u.uSuitShirt?.value, [0.9, 0.9, 0.88]), tie = C(u.uSuitTie?.value, [0.2, 0.02, 0.03]);
      return [
        // the collar a shade under the shirt (white on white read as no collar at all; a real collar's fold is in shadow)
        { color: col(Color, shirt), trim: col(Color, shirt, 0.86), trim2: col(Color, tie), fabric: "cotton" },
        { color: col(Color, coat), trim: col(Color, coat, 1.9), fabric: "wool" },
        { color: col(Color, tr), trim: col(Color, tr, 0.75), fabric: "cotton", bands: [0.025, 0, 0, 0] },
        shoeSlot(u, Color, [0.01, 0.01, 0.01]),
      ];
    },
  },
  polo: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        shortTop("polo", LM, neckRing, { off: 0.018, hem: LM.waist - 0.035, sleeve: LM.sleeveShort, collar: { kind: "polo", h: 0.02, out: 0.006, fold: 0.012 }, shape: undefined }),
        trousers(LM, [1.04, 1.3], false, 1.03), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const club = C(u.uShirt?.value, [0.4, 0.05, 0.05]), trim = C(u.uTrim?.value, [1, 1, 1]);
      return [
        { color: col(Color, club, 0.55), trim: col(Color, trim), fabric: "cotton", bands: [0, 0.012, 0, 0] },
        { color: new Color(0.42, 0.34, 0.2), trim: new Color(0.3, 0.24, 0.14), fabric: "cotton", bands: [0.025, 0, 0, 0] },
        shoeSlot(u, Color, [0.12, 0.07, 0.04]),
      ];
    },
  },
  fan: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        shortTop("shirt", LM, neckRing, { off: 0.018, hem: LM.waist - 0.04, sleeve: LM.sleeveShort + 0.08, collar: { kind: "crew", h: 0.016, out: 0.010 }, shape: undefined }),
        trousers(LM, [1.03, 1.22], false, 1.03), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const shirt = C(u.uShirt?.value, [0.6, 0.05, 0.05]), trim = C(u.uTrim?.value, [1, 1, 1]);
      return [
        { color: col(Color, shirt), trim: col(Color, trim), fabric: "poly", bands: [0.012, 0.016, 0, 0] },
        { color: new Color(0.045, 0.1, 0.22), trim: new Color(0.03, 0.06, 0.14), fabric: "cotton", bands: [0.025, 0, 0, 0] },
        shoeSlot(u, Color, [0.8, 0.78, 0.74]),
      ];
    },
  },
  // ── off the pitch at home (21 Nov 2026: "put them in houses") ──
  // tee: the fan's cut (crew collar, short sleeves, loose over the jeans), plain cotton, no crest.
  tee: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        shortTop("tee", LM, neckRing, { off: 0.016, hem: LM.waist - 0.04, sleeve: LM.sleeveShort + 0.06, collar: { kind: "crew", h: 0.012, out: 0.008 }, shape: undefined }),
        trousers(LM, [1.03, 1.22], false, 1.03), shoes(LM),
      ];
    },
    slots(_u, _v, Color) {
      return [
        { color: new Color(0.86, 0.85, 0.82), trim: new Color(0.74, 0.73, 0.7), fabric: "cotton", bands: [0.01, 0.012, 0, 0] },
        { color: new Color(0.045, 0.1, 0.22), trim: new Color(0.03, 0.06, 0.14), fabric: "cotton", bands: [0.025, 0, 0, 0] },
        shoeSlot(_u, Color, [0.8, 0.78, 0.74]),
      ];
    },
  },
  // shirt: the press shirt's cut (folded collar, long sleeves, tucked), chinos, shoes; no lanyard.
  shirt: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        longTop("shirt", LM, neckRing, { off: 0.004, neck: [0.07, 0.062, 0.08, -0.012], hem: LM.tuck, collar: { kind: "shirt", h: 0.022, out: 0.006, fold: 0.014 }, shape: undefined }),
        trousers(LM, [1.04, 1.3], false, 1.03), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      return [
        { color: new Color(0.6, 0.69, 0.82), trim: new Color(0.51, 0.59, 0.7), fabric: "cotton", bands: [0, 0.03, 0, 0] },
        { color: new Color(0.48, 0.38, 0.22), trim: new Color(0.34, 0.27, 0.16), fabric: "cotton", bands: [0.03, 0, 0, 0] },
        shoeSlot(u, Color, [0.07, 0.035, 0.015]),
      ];
    },
  },
  hoodie: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        longTop("hoodie", LM, neckRing, { off: 0.006, neck: [0.08, 0.07, 0.09, -0.02], hem: LM.hem - 0.02, wrist: LM.wrist - 0.02, collar: { kind: "hood", h: 0.035, out: -0.004 }, shape: { torso: { knots: [[0, 1.0, 1.0], [0.12, 1.1, 1.08], [0.6, 1.1, 1.08], [1, 1.07, 1.05]], boxy: 0.6 } } }),
        trousers(LM, [1.06, 1.3], false, 1.04, 1.12), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const club = C(u.uSuit?.value ? u.uSuitCoat?.value : u.uShirt?.value, [0.35, 0.36, 0.38]);
      return [
        { color: col(Color, club), trim: col(Color, club, 0.8), fabric: "cotton", bands: [0, 0.04, 0.05, 0] },
        { color: new Color(0.06, 0.065, 0.075), trim: new Color(0.04, 0.045, 0.05), fabric: "cotton", bands: [0.03, 0, 0, 0.04] },
        shoeSlot(u, Color, [0.8, 0.78, 0.74]),
      ];
    },
  },
};
