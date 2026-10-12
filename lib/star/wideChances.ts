/**
 * WIDE CHANCES — Settings → Look → "Wide chances: New | Old". One phone at a
 * time, Old by default until Harry decides (Leo, 11 Oct 2026).
 *
 * In Match view New, three kinds of chance leave a big block of empty grass
 * under the people even after the zoom (lib/star/matchView.ts, fitToPlay):
 * measured on a 390 px phone, 20° tilt, the grass below the lowest man was
 * 58% of the screen on a tight angle, 50% on a cutback and 55% on a penalty.
 * Their people stand in a strip about 20–25 m wide and much less deep near
 * the goal line, and a tall phone cannot show a wide, shallow strip without
 * a tall, empty picture.
 *
 * New: these three are watched SIDE-ON, the way corners and byline crosses
 * already are (the same turned camera, the same drawing), with the camera
 * fitted to the people. Nobody is cut off, the goal and keeper stay in, the
 * players and the ball stay today's size on screen, and the drag is read on
 * the screen exactly as before. Old: exactly the framing before this.
 */
import { useSyncExternalStore } from "react";

export type WideChances = "new" | "old";
export const WIDE_CHANCES_KEY = "star-wide-chances";
export const WIDE_CHANCES_DEFAULT: WideChances = "old";
let stored: WideChances | undefined;
let override: WideChances | null = null;
const listeners = new Set<() => void>();

function read(): WideChances {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(WIDE_CHANCES_KEY) : null;
    return v === "new" || v === "old" ? v : WIDE_CHANCES_DEFAULT;
  } catch {
    return WIDE_CHANCES_DEFAULT;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === WIDE_CHANCES_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

/** Has this phone ever chosen? (A Preview phone picks up New once if not.) */
export function wideChancesStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(WIDE_CHANCES_KEY) !== null; } catch { return false; }
}

export function wideChances(): WideChances {
  if (override) return override;
  if (stored === undefined) stored = read();
  return stored;
}

export function setWideChances(v: WideChances): void {
  try { localStorage.setItem(WIDE_CHANCES_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

/** Tests and measuring scripts only: force a value (null = the stored one). */
export function setWideChancesOverride(v: WideChances | null): void { override = v; }

export function useWideChances(): WideChances {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    wideChances, () => WIDE_CHANCES_DEFAULT,
  );
}
