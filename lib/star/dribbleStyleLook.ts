/**
 * Settings → Match → "Dribble style: First-person | Top-down" (Leo's choice,
 * gameplay round v0.15, 11 Oct 2026: "show both and let Leo choose").
 *
 *   First-person: a dribble run in a career match is the chase-camera duel
 *                 (components/star/FirstPersonDribble.tsx), as before.
 *   Top-down:     the same run (the same waves, defenders, moves and result)
 *                 played inside the normal match view, drawn with the match's
 *                 own players and ball (CanvasMatch's "tdDribble" phase).
 * Both play the SAME run (lib/star/firstPersonDribble.ts); only the picture and
 * where your thumb goes differ. Default First-person until Leo picks.
 * "Dribble runs 3D" still applies to First-person only.
 */
import { useSyncExternalStore } from "react";

export type DribbleStyle = "firstperson" | "topdown";
export const DRIBBLE_STYLE_KEY = "star-look-dribble-style";
const FALLBACK: DribbleStyle = "firstperson";

let cached: DribbleStyle | null = null;
const listeners = new Set<() => void>();

export function dribbleStyle(): DribbleStyle {
  if (cached) return cached;
  let v: string | null = null;
  try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(DRIBBLE_STYLE_KEY); } catch { v = null; }
  cached = v === "firstperson" || v === "topdown" ? v : FALLBACK;
  return cached;
}

export function setDribbleStyle(v: DribbleStyle) {
  try { localStorage.setItem(DRIBBLE_STYLE_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === DRIBBLE_STYLE_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}

export function useDribbleStyle(): DribbleStyle {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    dribbleStyle, () => FALLBACK,
  );
}
