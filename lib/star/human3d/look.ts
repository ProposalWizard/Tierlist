/**
 * Settings → Look → "3D body: Human | Before" (one phone at a time).
 *
 * Harry, 9 Oct 2026: "the player in-game model just doesn't even look human".
 *   Human:  the parametric human (lib/star/human3d/human.ts) in every 3D scene
 *           that uses the 3D people when "3D people" is New.
 *   Before: the one body exactly as it was (people3d.ts ONEBODY_FILES).
 * "3D people: Old" still gives each scene's old people, whatever this says.
 * Being tested: Preview only (lib/star/gameVersions.ts), so the default is Before.
 */
import { useSyncExternalStore } from "react";

export type HumanBodyLook = "human" | "before";

const KEY = "star-look-3d-body";
const VALUES: readonly HumanBodyLook[] = ["human", "before"];
const FALLBACK: HumanBodyLook = "before";
let cached: HumanBodyLook | null = null;
const listeners = new Set<() => void>();

export function humanBodyLook(): HumanBodyLook {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY); } catch { v = null; }
  cached = v && (VALUES as readonly string[]).includes(v) ? (v as HumanBodyLook) : FALLBACK;
  return cached;
}
/** A test page's choice for this page only: nothing is stored on the phone. */
export function previewHumanBodyLook(v: HumanBodyLook) {
  cached = v;
  listeners.forEach((f) => f());
}
export function setHumanBodyLook(v: HumanBodyLook) {
  try { localStorage.setItem(KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cached = null; listeners.forEach((f) => f()); } });
}
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useHumanBodyLook = () => useSyncExternalStore(subscribe, humanBodyLook, () => FALLBACK);
