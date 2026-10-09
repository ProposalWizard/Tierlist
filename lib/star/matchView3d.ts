/**
 * Settings → Look → "Match view 3D: On | Off" (Harry, 9 Oct 2026: "I can't
 * see the new top down in game?").
 *
 *   On:  the career match is drawn in 3D (lib/star/style3d/engineView.ts) over
 *        the real 2D match, which keeps running underneath, invisible, and
 *        takes every touch — exactly as on /star-style-dev → "Real game".
 *        Nothing about the football changes; only the picture.
 *   Off: the 2D match, as it was.
 * Being tested: On in Preview only (lib/star/gameVersions.ts), so the default is Off.
 */
import { useSyncExternalStore } from "react";

export type MatchView3d = "on" | "off";

export const MATCH_VIEW_3D_KEY = "star-look-match-3d";
const VALUES: readonly MatchView3d[] = ["on", "off"];
const FALLBACK: MatchView3d = "off";

let cached: MatchView3d | null = null;
const listeners = new Set<() => void>();

/** True once this phone has a stored choice (a Preview phone picks the new row up once). */
export function matchView3dStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(MATCH_VIEW_3D_KEY) !== null; } catch { return false; }
}

export function matchView3d(): MatchView3d {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(MATCH_VIEW_3D_KEY); } catch { v = null; }
  cached = v && (VALUES as readonly string[]).includes(v) ? (v as MatchView3d) : FALLBACK;
  return cached;
}

export function setMatchView3d(v: MatchView3d) {
  try { localStorage.setItem(MATCH_VIEW_3D_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === MATCH_VIEW_3D_KEY) { cached = null; listeners.forEach((f) => f()); } });
}

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useMatchView3d = () => useSyncExternalStore(subscribe, matchView3d, () => FALLBACK);
