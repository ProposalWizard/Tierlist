/**
 * Settings → "Chances: Old | New" (Harry, 14 Oct 2026: "the new scenario stuff
 * should be the top toggle under textures for now").
 *
 * New = the chance comes from the match (the scenario plan of 14 Oct 2026):
 * the drawing is put on the side of the pitch the match radar says the move
 * is on, the kind follows the radar's own weights instead of the even bag,
 * thin kinds are swapped for the nearest kind with drawings, and some chances
 * (one-on-ones, some long shots, crosses with you in the middle) get a short
 * build-up of passes before they are yours.
 * Old = the game exactly as before (the default).
 *
 * A setting per phone, like the texture pack. Not a three.js file.
 * `?chances=old|new` on any page overrides it for that page only.
 */
import { useSyncExternalStore } from "react";
import { fhrOn, onFhrMode } from "./fhr/toggle";

export type ChancesMode = "old" | "new";

export const CHANCES_KEY = "star-chances-mode";
export const CHANCES_DEFAULT: ChancesMode = "old";
const VALUES: readonly ChancesMode[] = ["old", "new"];
export const CHANCES_NAMES: Record<ChancesMode, string> = { old: "Old", new: "New" };

export function parseChancesMode(v: string | null | undefined): ChancesMode | null {
  return v && (VALUES as readonly string[]).includes(v) ? (v as ChancesMode) : null;
}

function urlOverride(): ChancesMode | null {
  try {
    if (typeof location === "undefined") return null;
    return parseChancesMode(new URLSearchParams(location.search).get("chances"));
  } catch { return null; }
}

let cached: ChancesMode | null = null;
const listeners = new Set<() => void>();
// The test switch lives on globalThis: tsx can load this file twice (once for
// the test's own import, once for the game file's), and both must agree.
const FORCED_KEY = "__starChancesForced";
const forcedMode = (): ChancesMode | null => (globalThis as Record<string, unknown>)[FORCED_KEY] as ChancesMode | null ?? null;

export function chancesMode(): ChancesMode {
  const forced = forcedMode();
  if (forced) return forced;
  // Full highlights rebuild: On (lib/star/fhr/toggle.ts) includes Chances: New,
  // so the two switches never fight (Harry, 19 Oct 2026). Off: untouched.
  if (fhrOn()) return "new";
  const u = urlOverride();
  if (u) return u;
  if (cached === null) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(CHANCES_KEY); } catch { v = null; }
    cached = parseChancesMode(v) ?? CHANCES_DEFAULT;
  }
  return cached;
}

/** True when the new chances are switched on. */
export const newChancesOn = () => chancesMode() === "new";

export function setChancesMode(v: ChancesMode) {
  try { localStorage.setItem(CHANCES_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

/** Tests only: force a mode with no browser (null clears it). */
export function forceChancesMode(v: ChancesMode | null) {
  (globalThis as Record<string, unknown>)[FORCED_KEY] = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === CHANCES_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}
// The rebuild switch moves this one too, so anything showing Chances re-reads.
onFhrMode(() => listeners.forEach((f) => f()));
export const onChancesMode = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useChancesMode = () => useSyncExternalStore(onChancesMode, chancesMode, () => CHANCES_DEFAULT);
