/**
 * THE BALLON D'OR NIGHT'S LOOK SWITCH — Settings → Look → "Ballon d'Or night:
 * New | Old". One phone at a time, New by default.
 *
 * STAR_ROADMAP.md #7: "A real ceremony: your player walks up, a famous player
 * hosts and calls the winner up, the final three on podiums. Today it is text
 * that pops up." New: the ceremony on a stage (components/star/BallonDorNight.tsx,
 * 3D in lib/star/ballonDor3d.ts, a drawn stage when the phone can't run 3D),
 * then the result page. Old: components/star/BallonDor.tsx exactly as it was.
 * Every new look gets a toggle and the old one stays (Harry, 3 Oct 2026).
 */
import { useSyncExternalStore } from "react";

export type BallonDorNightLook = "new" | "old";
export const BALLON_DOR_NIGHT_KEY = "star-ballon-dor-night-look";
let stored: BallonDorNightLook | undefined;
const listeners = new Set<() => void>();

function read(): BallonDorNightLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(BALLON_DOR_NIGHT_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === BALLON_DOR_NIGHT_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function ballonDorNightLook(): BallonDorNightLook {
  return "new"; // Decided, no toggle (12 Oct 2026): the stored choice is ignored.
}

/** Has this phone ever stored a choice? (A Classic phone takes Old once: gameVersions.ts.) */
export function ballonDorNightStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(BALLON_DOR_NIGHT_KEY) !== null; } catch { return false; }
}

export function setBallonDorNightLook(v: BallonDorNightLook): void {
  try { localStorage.setItem(BALLON_DOR_NIGHT_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useBallonDorNightLook(): BallonDorNightLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    ballonDorNightLook, () => "new" as const,
  );
}
