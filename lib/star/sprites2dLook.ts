/**
 * SETTINGS → LOOK → "2D players: Current | Style A" (one phone at a time).
 *
 * Harry, 9 Oct 2026: "remake the 2D frames but have it as an option in settings
 * with the current 2D as the priority." Current (the default, in every preset):
 * the 2D match draws today's sprites exactly. Style A: the same clips, frame
 * counts, timings and facings baked again on the Style A body
 * (tools/sprites/new/bake-new.mjs styleA → public/star/sprites/index-a.json,
 * atlas-0a/1a, mask-0a/1a), at the same height on the pitch. Read once per page
 * load (the sprites load once).
 */
import { useSyncExternalStore } from "react";

export type Sprites2dLook = "current" | "stylea";
const KEY = "star-look-sprites2d";
export const SPRITES2D_DEFAULT: Sprites2dLook = "current";
let cached: Sprites2dLook | null = null;
const listeners = new Set<() => void>();

export function sprites2dLook(): Sprites2dLook {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY); } catch { v = null; }
  cached = v === "stylea" ? "stylea" : SPRITES2D_DEFAULT;
  return cached;
}
export function setSprites2dLook(v: Sprites2dLook) {
  try { localStorage.setItem(KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}
/** A test page's choice for this page only. */
export function previewSprites2dLook(v: Sprites2dLook) { cached = v; listeners.forEach((f) => f()); }
/** The index file the 2D match reads under this look. */
export function spriteIndexFile(look: Sprites2dLook = sprites2dLook()): string {
  return look === "stylea" ? "index-a.json" : "index.json";
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cached = null; listeners.forEach((f) => f()); } });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useSprites2dLook = () => useSyncExternalStore(subscribe, sprites2dLook, () => SPRITES2D_DEFAULT);
