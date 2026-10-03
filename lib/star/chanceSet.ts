/**
 * WHICH CHANCES THE MATCH SERVES — "new" or "classic". Settings → Chances.
 *
 * Harry's standing rule (1 Oct 2026): every new look gets a toggle and the old
 * one stays playable.
 *   - New (default): the checked chance library (lib/star/chanceLibrary.ts),
 *     made for the new match view — about 100 pictures a kind, the rest of
 *     both teams on the pitch, dealt like a deck so a picture comes back as
 *     rarely as possible.
 *   - Classic: the chances exactly as they were — the team's drawings, nudged,
 *     with the 5-picture memory — and nothing else on the pitch.
 *
 * Like the match view (matchView.ts) this is a module-level value per device,
 * so every screen that plays the match follows it without a new prop.
 *
 * THE PIN (Harry, 3 Oct 2026): "these new scenarios need to be separate to the
 * scenario gallery for now please - just in case they suck." The dev and test
 * screens (Play Area, Infinite Match, Infinite Highlights, the gallery's Play)
 * can Save and Commit a chance into the gallery's drawings, so they must never
 * be handed a New one. EnginePlay pins "classic" while it is on screen; the
 * real career match never mounts EnginePlay, so it keeps following Settings.
 * The pin only changes what is SERVED (`chanceSet()`); Settings still shows
 * and saves the phone's own choice (`chanceSetChoice()`).
 */
import { useSyncExternalStore } from "react";

export type ChanceSet = "new" | "classic";

/** THE ONE LINE: the chances everyone gets when nobody has chosen. */
export const CHANCE_SET_DEFAULT: ChanceSet = "new";
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

/** What this phone has chosen in Settings → Chances (ignores any pin). */
export function chanceSetChoice(): ChanceSet {
  if (stored === undefined) stored = readStored();
  return stored ?? CHANCE_SET_DEFAULT;
}

/** Pins in force, oldest first. The newest one wins; each is its own object,
 *  so two screens pinning at once (or React mounting an effect twice) each
 *  lift only their own. */
const pins: { set: ChanceSet }[] = [];

/**
 * Serve `set` whatever Settings says, until the returned function is called.
 * EnginePlay pins "classic" for as long as it is mounted.
 */
export function pinChanceSet(set: ChanceSet): () => void {
  const pin = { set };
  pins.push(pin);
  return () => {
    const i = pins.lastIndexOf(pin);
    if (i >= 0) pins.splice(i, 1);
  };
}

/** The pin in force, or null when none is. */
export function chanceSetPin(): ChanceSet | null {
  return pins.length ? pins[pins.length - 1].set : null;
}

/** The chances to serve right now: the newest pin, else the phone's choice. */
export function chanceSet(): ChanceSet {
  return chanceSetPin() ?? chanceSetChoice();
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
  return useSyncExternalStore(subscribe, chanceSetChoice, () => CHANCE_SET_DEFAULT);
}
