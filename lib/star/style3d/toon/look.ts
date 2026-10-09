/**
 * Settings → Look → "Player style: New | Old" (one phone at a time).
 *
 * Harry, 9 Oct 2026: "Style A becomes the Knowitball standard … it just needs
 * a new model cos I don't like that guy."
 *   New: Style A (cel shading, rim light, ink outline) on the three new bodies
 *        (C1 / C2 / C3, public/star/people3d/toon-c*.glb) for EVERY 3D person:
 *        players, managers, staff, presenters. The default.
 *   Old: exactly today's bodies and materials (3D people / 3D body decide them).
 */
import { useSyncExternalStore } from "react";

export type PlayerStyleLook = "new" | "old";

const KEY = "star-look-player-style";
const VALUES: readonly PlayerStyleLook[] = ["new", "old"];
export const PLAYER_STYLE_DEFAULT: PlayerStyleLook = "new"; // back to New: the glow-square / speck bug is fixed (toon/shader.ts, 9 Oct 2026)
let cached: PlayerStyleLook | null = null;
const listeners = new Set<() => void>();

export function playerStyleLook(): PlayerStyleLook {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY); } catch { v = null; }
  cached = v && (VALUES as readonly string[]).includes(v) ? (v as PlayerStyleLook) : PLAYER_STYLE_DEFAULT;
  return cached;
}
/** Has this phone ever stored a choice? (gameVersions: a Classic phone picks up Old once.) */
export function playerStyleStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(KEY) !== null; } catch { return false; }
}
/** A test page's choice for this page only: nothing is stored on the phone. */
export function previewPlayerStyleLook(v: PlayerStyleLook) {
  cached = v;
  listeners.forEach((f) => f());
}
export function setPlayerStyleLook(v: PlayerStyleLook) {
  try { localStorage.setItem(KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cached = null; listeners.forEach((f) => f()); } });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const usePlayerStyleLook = () => useSyncExternalStore(subscribe, playerStyleLook, () => PLAYER_STYLE_DEFAULT);
