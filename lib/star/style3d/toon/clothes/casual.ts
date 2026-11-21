/**
 * OFF-PITCH CLOTHES for the house and the garden (Harry, 21 Nov 2026: "yes the clothes films are better, put them
 * in houses"; earlier: "why would someone … be wearing … a football kit … that doesn't make sense").
 *
 * Only a player on the pitch wears a match kit. At home:
 *   you         your saved home set (home3d/outfits.ts CASUAL_SETS) on the cloth pieces, its own colours kept
 *   team-mates  casual or club training wear, never a match kit and never a number
 *   family      muted casual (no club colours)
 * Picked from the person's id, so the same person always dresses the same. Pure: tests/star/home3d.mts.
 */
import type { ClothKind, ClothColours } from "./index";

export interface OffPitchWear { kind: ClothKind; colours: ClothColours }

/** Your home set (CASUAL_SETS id) → the cloth piece that cuts it, and its colours (from the set). */
export function homeSetCloth(id: string, c: Partial<Record<"main" | "second" | "accent" | "trousers" | "shoes" | "scarf", string>>): OffPitchWear {
  const main = c.main ?? "#7a7f87";
  const kind: ClothKind = id === "tee" ? "tee" : id === "shirt" ? "shirt" : id === "tracksuit" ? "tracksuit" : id === "coat" ? "suit" : "hoodie";
  return { kind, colours: { top: main, trim: id === "tracksuit" ? c.second : undefined, inner: c.second, trousers: c.trousers, shoes: c.shoes } };
}

const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };

/** A colour darker (k < 0) or lighter (k > 0), sRGB hex. */
export function shadeHex(hex: string, k: number): string {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const ch = (v: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? v * (1 + k) : v + (255 - v) * k)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, "0")).join("")}`;
}

// muted colours: the eye goes to you, not to the guests
const TEES = ["#ece9e2", "#22252b", "#7d828a", "#2e3a55", "#6f7556"];
const HOODS = ["#4b5563", "#2b2f36", "#3c4a5e", "#5c6152", "#8a7d6b"];
const SHIRTS = ["#c9d7ea", "#f1efe9", "#a9b8a0", "#d9cbb4"];
const JEANS = ["#34507a", "#2a3550", "#3f4650", "#1f2126"];
const CHINOS = ["#b79b6e", "#3a3f48", "#6d6552", "#2c3a4f"];
const JOGGERS = ["#2e3138", "#1c1e22", "#3a3f48"];
const TRAINERS = ["#f2f2ef", "#e8e4dc", "#1c1c1e"];

/**
 * What a guest wears at home. `mate`: a team-mate (a quarter in the club's training wear, the rest casual).
 * `family`: muted casual only. `training`: the club's training wear (a garden kick-about).
 */
export function offPitchWear(id: string, role: "mate" | "family" | "training", kit: { shirt: string; trim: string }): OffPitchWear {
  const h = hash(id), pick = <X>(a: X[], s: number) => a[(h >>> s) % a.length];
  const training = (): OffPitchWear => ({ kind: "tracksuit", colours: { top: shadeHex(kit.shirt, -0.55), trim: kit.trim, trousers: shadeHex(kit.shirt, -0.6), shoes: pick(TRAINERS, 9) } });
  if (role === "training") return training();
  const casual = ["tee", "hoodie", "shirt", "polo"] as const;
  const k = role === "mate" ? (h % 8 < 2 ? "training" : casual[(h >>> 3) % 4]) : casual[(h >>> 3) % 3];
  if (k === "training") return training();
  if (k === "tee") return { kind: "tee", colours: { top: pick(TEES, 5), trousers: pick(JEANS, 11), shoes: pick(TRAINERS, 9) } };
  if (k === "hoodie") return { kind: "hoodie", colours: { top: pick(HOODS, 5), trousers: pick(JOGGERS, 11), shoes: pick(TRAINERS, 9) } };
  if (k === "shirt") return { kind: "shirt", colours: { top: pick(SHIRTS, 5), trousers: pick(CHINOS, 11), shoes: "#3b2416" } };
  // the club polo (outfits.ts reads the kit's shirt for it, a shade under), chinos
  return { kind: "polo", colours: { trousers: pick(CHINOS, 11), shoes: "#3b2416" } };
}
