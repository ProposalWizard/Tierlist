/**
 * Settings → Full highlights rebuild → "Real moment highlights: Off | On"
 * (Harry, 20 Oct 2026: "inside the real highlights toggle, there's another
 * toggle that is real moment highlights").
 *
 * Shown only while the rebuild is On, and only counts then: Off (the default)
 * changes nothing. On: some open-play chances are a REAL moment instead of a
 * drawn one: the ball and every man where they really stood, with the real 4 s
 * of play before it as the build-up (lib/star/fhr/realMomentHighlights.ts says
 * how many, and which).
 *
 * A setting per phone, never in a save. `?realmoments=on|off` on any page
 * overrides it for that page only.
 */
import { useSyncExternalStore } from "react";
import { fhrOn, onFhrMode } from "./toggle";

export type RealMomentsMode = "off" | "on";

export const REAL_MOMENTS_KEY = "star-real-moment-highlights";
export const REAL_MOMENTS_DEFAULT: RealMomentsMode = "off";

export function parseRealMomentsMode(v: string | null | undefined): RealMomentsMode | null {
  return v === "on" || v === "off" ? v : null;
}

function urlValue(): string | null {
  try {
    if (typeof location === "undefined") return null;
    return new URLSearchParams(location.search).get("realmoments");
  } catch { return null; }
}
function urlOverride(): RealMomentsMode | null {
  const v = urlValue();
  return v === "every" ? "on" : parseRealMomentsMode(v);
}

/**
 * Testing only: `?realmoments=every` on the page makes EVERY open-play chance
 * of a real-moment kind a real one (instead of 1 in 4), so a tester sees one
 * at once. Never stored; the setting itself has only Off | On.
 */
export const realMomentsEvery = () => urlValue() === "every";

let cached: RealMomentsMode | null = null;
const listeners = new Set<() => void>();
// On globalThis like toggle.ts: tsx can load this file twice, and a test's switch must reach the game's copy.
const FORCED_KEY = "__starRealMomentsForced";
const forced = (): RealMomentsMode | null => ((globalThis as Record<string, unknown>)[FORCED_KEY] as RealMomentsMode | null) ?? null;

/** The switch's own value (whatever the rebuild switch says). */
export function realMomentsMode(): RealMomentsMode {
  const f = forced();
  if (f) return f;
  const u = urlOverride();
  if (u) return u;
  if (cached === null) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(REAL_MOMENTS_KEY); } catch { v = null; }
    cached = parseRealMomentsMode(v) ?? REAL_MOMENTS_DEFAULT;
  }
  return cached;
}

/** True when real moments may be served: the rebuild is On AND this switch is On. */
export const realMomentsOn = () => fhrOn() && realMomentsMode() === "on";

export function setRealMomentsMode(v: RealMomentsMode) {
  try { localStorage.setItem(REAL_MOMENTS_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

/** Tests and the test pages only: force a mode for this run (null clears it). */
export function forceRealMomentsMode(v: RealMomentsMode | null) {
  (globalThis as Record<string, unknown>)[FORCED_KEY] = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === REAL_MOMENTS_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}
// The rebuild switch decides whether this one counts, so anything showing it re-reads.
onFhrMode(() => listeners.forEach((f) => f()));
export const onRealMomentsMode = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useRealMomentsMode = () => useSyncExternalStore(onRealMomentsMode, realMomentsMode, () => REAL_MOMENTS_DEFAULT);
