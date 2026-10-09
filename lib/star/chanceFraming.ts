/**
 * CHANCE FRAMING — Settings → Look → "Chance framing: Zoom | Old". One phone
 * at a time, Zoom by default.
 *
 * Harry, 9 Oct 2026 (option A of the zoom-to-play show-options): in Match
 * view New, about half the frame was empty grass below the play. "Zoom"
 * zooms the camera in where it is safe, so the screen ends about 6 m below
 * the lowest man (lib/star/matchView.ts, zoomToPlay). The canvas keeps its
 * size, the drag is read the same, and the men and the ball stay today's
 * size on screen (only the pitch zooms). No man, post or keeper is ever cut
 * off; side-on chances (corners, byline crosses) are not zoomed.
 * "Old" is exactly the framing before this. Every new look gets a toggle
 * and the old one stays (Harry, 3 Oct 2026).
 */
import { useSyncExternalStore } from "react";

export type ChanceFraming = "zoom" | "old";
export const CHANCE_FRAMING_KEY = "star-chance-framing";
export const CHANCE_FRAMING_DEFAULT: ChanceFraming = "zoom";
let stored: ChanceFraming | undefined;
const listeners = new Set<() => void>();

function read(): ChanceFraming {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(CHANCE_FRAMING_KEY) : null;
    return v === "zoom" || v === "old" ? v : CHANCE_FRAMING_DEFAULT;
  } catch {
    return CHANCE_FRAMING_DEFAULT;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CHANCE_FRAMING_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function chanceFraming(): ChanceFraming {
  if (stored === undefined) stored = read();
  return stored;
}

export function setChanceFraming(v: ChanceFraming): void {
  try { localStorage.setItem(CHANCE_FRAMING_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useChanceFraming(): ChanceFraming {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    chanceFraming, () => CHANCE_FRAMING_DEFAULT,
  );
}
