/**
 * MATCH RADAR — Settings → Look → "Match radar: New | Old" (Leo v0.15).
 *
 * New: while the commentary runs between your chances, a small pitch at the
 * top of it shows the unseen match live — the ball moving zone to zone in the
 * colours of the side that has it, the momentum, and a flash for every shot
 * and goal (components/star/LiveMatchRadar.tsx). Old: no radar, the
 * commentary exactly as it was. One phone at a time.
 */
import { createContext, useContext, useSyncExternalStore } from "react";

export type MatchRadarLook = "new" | "old";

/**
 * A test page's own answer for the match it mounts (the PC match + radar
 * page reads the live radar's minutes, so its match always draws one). Only
 * inside the page's own wrapper, and never written to this phone's setting:
 * every real match, and every other screen, reads the setting as before.
 */
export const MatchRadarLookOverride = createContext<MatchRadarLook | null>(null);
export const MATCH_RADAR_KEY = "star-match-radar";
export const MATCH_RADAR_DEFAULT: MatchRadarLook = "old";
let stored: MatchRadarLook | undefined;
const listeners = new Set<() => void>();

function read(): MatchRadarLook {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(MATCH_RADAR_KEY) : null;
    return v === "new" || v === "old" ? v : MATCH_RADAR_DEFAULT;
  } catch {
    return MATCH_RADAR_DEFAULT;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === MATCH_RADAR_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function matchRadarLook(): MatchRadarLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setMatchRadarLook(v: MatchRadarLook): void {
  try { localStorage.setItem(MATCH_RADAR_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useMatchRadarLook(): MatchRadarLook {
  const forced = useContext(MatchRadarLookOverride);
  const saved = useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    matchRadarLook, () => MATCH_RADAR_DEFAULT,
  );
  return forced ?? saved;
}
