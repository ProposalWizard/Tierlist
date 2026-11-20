/**
 * THE OUTFITS: where each garment is cut (landmarks of the body's own rest pose, metres) and which colours it
 * takes (read from the uniforms dressPerson3d already set, so kit data, nation kits and people presets drive
 * them unchanged). Landmarks: the neck ring and collar line, the shoulder seam, the sleeve end the file's kit
 * measured (sleeveT), the wrist, the waist, the hem, the shorts end (shortsLoY), the sock top (sockY), the boot
 * top (bootY), the ankle. See build.ts for how a cut becomes cloth.
 */
import type * as THREE from "three";
import type { PersonMeta } from "../../../people3d";
import type { GarmentSpec } from "./build";
import type { ClothSlot } from "./index";

export type ClothKind = "kit" | "tracksuit" | "press" | "suit";
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
  const neckRing = (pt: THREE.Vector3, rx: number, rzB: number, rzF: number, lift: number, vDepth = 0, vW = 0.07) => {
    const dx = pt.x - neck[0], dz = pt.z - (neck[2] + 0.012);
    const e = Math.hypot(dx / rx, dz / (dz > 0 ? rzF : rzB));
    const ring = (1 - e) * Math.min(rx, rzB);
    const front0 = Math.max(0, Math.min(1, (pt.z - neck[2]) / 0.06));
    const yLow = collarY + lift - 0.035 * front0;
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

const trousers = (LM: ReturnType<typeof landmarks>["LM"], name = "trousers"): GarmentSpec => ({ name, offset: 0.009, lip: 0.004,
  fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - (LM.waist + 0.01), sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.ankle - pt.y : NONE }),
  relax: [4, 10], tube: true });
const shoes = (LM: ReturnType<typeof landmarks>["LM"]): GarmentSpec => ({ name: "shoes", offset: 0.005, lip: 0.003,
  fields: (pt, arm, _a, leg) => (leg > 0.5 && arm < 0.5 ? { neck: pt.y - LM.shoeTop, sleeve: NONE, hem: NONE, leg: -pt.y - 0.001 } : OFF),
  relax: [2, 6] });

const C = (T: { r: number; g: number; b: number } | undefined, fb: [number, number, number]) => ({ r: T?.r ?? fb[0], g: T?.g ?? fb[1], b: T?.b ?? fb[2] });
function col(three: typeof THREE.Color, c: { r: number; g: number; b: number }, k = 1) { return new three(c.r * k, c.g * k, c.b * k); }

export interface OutfitDef {
  garments(meta: PersonMeta, variant: string): GarmentSpec[];
  slots(u: U, variant: string, Color: typeof THREE.Color, meta: PersonMeta): ClothSlot[];
}

export const OUTFITS: Record<ClothKind, OutfitDef> = {
  kit: {
    garments(meta, variant) {
      const { LM, neckRing } = landmarks(meta);
      const torso = (pt: THREE.Vector3, arm: number, armS: number) => ({
        neck: neckRing(pt, 0.075, 0.066, 0.095, -0.028),
        sleeve: arm > 0.5 ? (armS - LM.sleeveShort) * LM.upperArm : NONE,
        hem: arm > 0.5 ? NONE : LM.tuck - pt.y, leg: NONE,
      });
      const g: GarmentSpec[] = [];
      if (variant === "kit-sleeves") {
        g.push({ name: "shirt", offset: 0.007, lip: 0.004, collar: { kind: "crew", h: 0.016, out: 0.010 }, fields: (pt, a, s) => ({ ...torso(pt, a, s), cut: Math.abs(pt.x) - LM.seamX }) });
        g.push({ name: "sleeves", offset: 0.007, lip: 0.004, fields: (pt, a, s) => ({ ...torso(pt, a, s), cut: LM.seamX - Math.abs(pt.x) }) });
      } else g.push({ name: "shirt", offset: 0.007, lip: 0.004, collar: { kind: "crew", h: 0.016, out: 0.010 }, fields: torso });
      g.push({ name: "shorts", offset: 0.014, lip: 0.005, fields: (pt, arm, _a, leg) => ({ neck: arm > 0.5 ? 1 : pt.y - LM.waist, sleeve: NONE, hem: NONE, leg: leg > 0.35 ? LM.shortsEnd - pt.y : NONE }) });
      g.push({ name: "socks", offset: 0.004, lip: 0.003, relax: [2, 8],
        fields: (pt, arm, _a, leg) => (leg > 0.5 && arm < 0.5 ? { neck: pt.y - LM.sockTop, sleeve: NONE, hem: LM.sockEnd - pt.y, leg: NONE } : OFF) });
      return g;
    },
    slots(u, variant, Color, meta) {
      const shirt = C(u.uShirt?.value, [0.6, 0.05, 0.05]), trim = C(u.uTrim?.value, [1, 1, 1]), shorts = C(u.uShorts?.value, [1, 1, 1]), socks = C(u.uSocks?.value, [0.6, 0.05, 0.05]);
      const code = Math.round(u.uPattern?.value?.x ?? 0), p2 = C(u.uPat2?.value, [1, 1, 1]);
      const { LM } = landmarks(meta);
      const pattern = code === 1 || code === 2 ? { kind: code as 1 | 2, color: col(Color, p2), width: code === 1 ? 0.045 : 0.05, centre: LM.chestY } : undefined;
      const same = (a: typeof shirt, b: typeof shirt) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 0.05;
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
        { name: "jacket", offset: 0.013, lip: 0.005, collar: { kind: "crew", h: 0.028, out: 0.003 }, relax: [3, 10],
          fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.074, 0.064, 0.085, -0.016), sleeve: arm > 0.5 ? (armS - LM.wrist) * LM.upperArm : NONE, hem: arm > 0.5 ? NONE : LM.hem - pt.y, leg: NONE }) },
        trousers(LM), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const coat = C(u.uSuit?.value ? u.uSuitCoat?.value : u.uShirt?.value, [0.12, 0.13, 0.18]);
      let trim = C(u.uTrim?.value, [1, 1, 1]);
      if (Math.abs(trim.r - coat.r) + Math.abs(trim.g - coat.g) + Math.abs(trim.b - coat.b) < 0.08) trim = { r: Math.min(1, coat.r * 2.6 + 0.08), g: Math.min(1, coat.g * 2.6 + 0.08), b: Math.min(1, coat.b * 2.6 + 0.08) };
      const sh = C(u.uShoes?.value, [0.02, 0.02, 0.02]);
      return [
        { color: col(Color, coat), trim: col(Color, trim), fabric: "poly", bands: [0, 0.035, 0.03, 0] },
        { color: col(Color, coat), trim: col(Color, trim), fabric: "poly", bands: [0.028, 0, 0, 0] },
        { color: col(Color, sh), trim: new Color(0.05, 0.045, 0.04), fabric: "cotton", bands: [0, 0, 0, 0.016] },
      ];
    },
  },
  press: {
    garments(meta) {
      const { LM, neckRing } = landmarks(meta);
      return [
        { name: "shirt", offset: 0.006, lip: 0.003, collar: { kind: "shirt", h: 0.022, out: 0.006, fold: 0.014 }, relax: [2, 8],
          fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.07, 0.062, 0.08, -0.012), sleeve: arm > 0.5 ? (armS - LM.wrist) * LM.upperArm : NONE, hem: arm > 0.5 ? NONE : LM.tuck - pt.y, leg: NONE }) },
        trousers(LM), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const suit = !!u.uSuit?.value;
      const shirt = suit ? C(u.uSuitShirt?.value, [0.62, 0.72, 0.84]) : { r: 0.62, g: 0.72, b: 0.84 };
      const tr = suit ? C(u.uSuitTrousers?.value, [0.04, 0.045, 0.055]) : { r: 0.04, g: 0.045, b: 0.055 };
      const sh = C(u.uShoes?.value, [0.02, 0.02, 0.02]);
      return [
        { color: col(Color, shirt), trim: col(Color, shirt, 0.85), fabric: "cotton", bands: [0, 0.03, 0, 0] },
        { color: col(Color, tr), trim: col(Color, tr, 0.8), fabric: "cotton", bands: [0.028, 0, 0, 0] },
        { color: col(Color, sh), trim: new Color(0.05, 0.045, 0.04), fabric: "cotton", bands: [0, 0, 0, 0.016] },
      ];
    },
  },
  suit: {
    garments(meta, variant) {
      const { LM, neckRing } = landmarks(meta);
      return [
        { name: "shirt", offset: 0.004, lip: 0.002, collar: { kind: "shirt", h: 0.022, out: 0.006, fold: 0.014 }, relax: [0, 8],
          ...(variant === "suit-open" ? {} : { tie: { top: LM.collarY - 0.035, bottom: LM.waist + 0.02, w: 0.022 } }),
          fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.07, 0.062, 0.08, -0.012), sleeve: arm > 0.5 ? (armS - LM.wrist - 0.06) * LM.upperArm : NONE, hem: arm > 0.5 ? NONE : LM.tuck - pt.y, leg: NONE }) },
        { name: "coat", offset: 0.016, lip: 0.005, collar: { kind: "lapel", h: 0.024, out: 0.004, fold: 0.05 }, relax: [4, 10],
          fields: (pt, arm, armS) => ({ neck: neckRing(pt, 0.085, 0.072, 0.1, -0.03, 0.27, 0.11), sleeve: arm > 0.5 ? (armS - LM.wrist) * LM.upperArm : NONE, hem: arm > 0.5 ? NONE : (LM.hips[1] - 0.12) - pt.y, leg: NONE }) },
        trousers(LM), shoes(LM),
      ];
    },
    slots(u, _v, Color) {
      const coat = C(u.uSuitCoat?.value, [0.03, 0.035, 0.06]), tr = C(u.uSuitTrousers?.value, [0.03, 0.035, 0.06]);
      const shirt = C(u.uSuitShirt?.value, [0.9, 0.9, 0.88]), tie = C(u.uSuitTie?.value, [0.2, 0.02, 0.03]), sh = C(u.uShoes?.value, [0.01, 0.01, 0.01]);
      return [
        { color: col(Color, shirt), trim: col(Color, shirt), trim2: col(Color, tie), fabric: "cotton" },
        { color: col(Color, coat), trim: col(Color, coat, 0.8), fabric: "wool" },
        { color: col(Color, tr), trim: col(Color, tr), fabric: "cotton" },
        { color: col(Color, sh), trim: new Color(0.05, 0.045, 0.04), fabric: "cotton", bands: [0, 0, 0, 0.016] },
      ];
    },
  },
};
