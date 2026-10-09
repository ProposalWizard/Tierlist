/**
 * Settings → Look → "Cut-scene people: New | Old" (one phone at a time).
 *
 * Harry's standing rule (3 Oct 2026): every new look gets a toggle, default
 * New, and the old one stays exactly as it was.
 *   New: the cut-scene face (lib/star/cutscene/face.ts): painted skin, real
 *        eyes that blink and look, expressions; no face photo on the head.
 *   Old: the people exactly as the 3D scenes make them today (their own
 *        painted face, or the face picture laid over it).
 * Being tested: Preview only (lib/star/gameVersions.ts), so the default is Old.
 */
import { useSyncExternalStore } from "react";

export type CutscenePeopleLook = "new" | "old";

const KEY = "star-look-cutscene-people";
const VALUES: readonly CutscenePeopleLook[] = ["new", "old"];
const FALLBACK: CutscenePeopleLook = "old";

let cached: CutscenePeopleLook | null = null;
const listeners = new Set<() => void>();

export function cutscenePeopleLook(): CutscenePeopleLook {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY); } catch { v = null; }
  cached = v && (VALUES as readonly string[]).includes(v) ? (v as CutscenePeopleLook) : FALLBACK;
  return cached;
}

export function setCutscenePeopleLook(v: CutscenePeopleLook) {
  try { localStorage.setItem(KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY) { cached = null; listeners.forEach((f) => f()); } });
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useCutscenePeopleLook = () => useSyncExternalStore(subscribe, cutscenePeopleLook, () => FALLBACK);
