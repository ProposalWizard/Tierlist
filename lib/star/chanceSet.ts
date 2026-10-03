/**
 * WHICH CHANCES THE MATCH SERVES — "new" or "classic". Settings → Chances.
 *
 * Harry's standing rule (1 Oct 2026): every new look gets a toggle and the old
 * one stays playable.
 *   - New (try it): the checked chance library (lib/star/chanceLibrary.ts),
 *     made for the new match view — about 100 pictures a kind, the rest of
 *     both teams on the pitch, dealt like a deck so a picture comes back as
 *     rarely as possible.
 *   - Classic (default): the chances exactly as they were — the team's drawings, nudged,
 *     with the 5-picture memory — and nothing else on the pitch.
 *
 * Like the match view (matchView.ts) this is a module-level value per device,
 * so every screen that plays the match follows it without a new prop.
 */
import { useSyncExternalStore } from "react";

export type ChanceSet = "new" | "classic";

/** THE ONE LINE: the chances everyone gets when nobody has chosen. */
// Harry, 3 Oct 2026: "I think most likely we won't have 11 players on the
// pitch at all times, I think just take our current scenarios and then zoom
// the pitch out." So the team's own drawings stay the default in the new
// zoomed-out view; the library is there to try, behind Settings → Chances.
export const CHANCE_SET_DEFAULT: ChanceSet = "classic";
export const CHANCE_SET_KEY = "star-chance-set";

let stored: ChanceSet | null | undefined;
const listeners = new Set<() => void>();

function readStored(): ChanceSet | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(CHANCE_SET_KEY);
    return v === "new" || v === "classic" ? v : null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", (e) => {
    if (e.key === CHANCE_SET_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

/** The chances to serve right now. */
export function chanceSet(): ChanceSet {
  if (stored === undefined) stored = readStored();
  return stored ?? CHANCE_SET_DEFAULT;
}

export function setChanceSet(v: ChanceSet): void {
  try { localStorage.setItem(CHANCE_SET_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Settings' copy of the choice, kept in step with other tabs. */
export function useChanceSet(): ChanceSet {
  return useSyncExternalStore(subscribe, chanceSet, () => CHANCE_SET_DEFAULT);
}
