/**
 * THE OVATION GREETINGS SWITCH — Settings → Look → "Ovation greetings:
 * New | Old". One phone at a time, New by default.
 *
 * Mikey, 8 Oct 2026: the hugs, dap-ups, pats and claps of the 3D standing
 * ovation, made in Blender with both men posed together
 * (tools/ovation3d/author_greetings.py → public/star/ovation3d/greetings.glb).
 * Old is the first version: every arm reached live in the game.
 * Every new look gets a toggle and the old one stays (Harry, 3 Oct 2026).
 */
import { useSyncExternalStore } from "react";

export type OvationMoves = "new" | "old";
export const OVATION_MOVES_KEY = "star-ovation-moves";
let stored: OvationMoves | undefined;
const listeners = new Set<() => void>();

function read(): OvationMoves {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(OVATION_MOVES_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === OVATION_MOVES_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function ovationMoves(): OvationMoves {
  if (stored === undefined) stored = read();
  return stored;
}

export function setOvationMoves(v: OvationMoves): void {
  try { localStorage.setItem(OVATION_MOVES_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useOvationMoves(): OvationMoves {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    ovationMoves, () => "new" as const,
  );
}
