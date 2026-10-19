/**
 * Settings → "Full highlights rebuild: Off | On (test)" (Harry, 19 Oct 2026).
 *
 * The switch for the Full Highlights Rebuild (plan page, 19 Oct 2026). Off is
 * the game exactly as it is today. On is the rebuild's test path, one phase at
 * a time:
 *   · Phase 0: On also turns on "Chances: New" (lib/star/newChances.ts reads
 *     this switch), so the two switches never fight (Harry's answer 3).
 *   · Phase 1: Infinite Highlights' still is drawn with the real match's
 *     camera (lib/star/fhr/stillCamera.ts).
 *
 * A setting per phone, never in a save. Default Off. `?fhr=on|off` on any page
 * overrides it for that page only. Test page: /star-fhr-dev.
 */
import { useSyncExternalStore } from "react";

export type FhrMode = "off" | "on";

export const FHR_KEY = "star-fhr";
export const FHR_DEFAULT: FhrMode = "off";

export function parseFhrMode(v: string | null | undefined): FhrMode | null {
  return v === "on" || v === "off" ? v : null;
}

function urlOverride(): FhrMode | null {
  try {
    if (typeof location === "undefined") return null;
    return parseFhrMode(new URLSearchParams(location.search).get("fhr"));
  } catch { return null; }
}

let cached: FhrMode | null = null;
const listeners = new Set<() => void>();
// On globalThis for the same reason as newChances.ts: tsx can load this file
// twice, and a test's switch must reach the game's copy too.
const FORCED_KEY = "__starFhrForced";
const forced = (): FhrMode | null => ((globalThis as Record<string, unknown>)[FORCED_KEY] as FhrMode | null) ?? null;

export function fhrMode(): FhrMode {
  const f = forced();
  if (f) return f;
  const u = urlOverride();
  if (u) return u;
  if (cached === null) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(FHR_KEY); } catch { v = null; }
    cached = parseFhrMode(v) ?? FHR_DEFAULT;
  }
  return cached;
}

/** True when the rebuild's test path is switched on. */
export const fhrOn = () => fhrMode() === "on";

export function setFhrMode(v: FhrMode) {
  try { localStorage.setItem(FHR_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

/** Tests and the test page only: force a mode for this run (null clears it). */
export function forceFhrMode(v: FhrMode | null) {
  (globalThis as Record<string, unknown>)[FORCED_KEY] = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === FHR_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}
export const onFhrMode = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useFhrMode = () => useSyncExternalStore(onFhrMode, fhrMode, () => FHR_DEFAULT);
