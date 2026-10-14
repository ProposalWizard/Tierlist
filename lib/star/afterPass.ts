/**
 * Settings → "After you pass: Auto run | Joystick" (Harry, 14 Oct 2026:
 * "once you've passed the ball off, and this should be a toggle … As soon as
 * you pass the ball off, you should then get a joystick, and you can still
 * continue moving in that play").
 *
 * Only does anything with Chances: New (lib/star/newChances.ts).
 * Auto run = the play-on as it was (lib/star/playOn.ts: after a build-up you
 * run into the box on your own; the default).
 * Joystick = after any pass in a chance with a goal in it, a thumb stick
 * bottom-left steers you; the team-mate reads where you are (playOn.ts
 * "THE JOYSTICK").
 *
 * A setting per phone, stored like the Chances setting. `?afterpass=auto|stick`
 * on any page overrides it for that page only.
 */
import { useSyncExternalStore } from "react";

export type AfterPassMode = "auto" | "stick";

export const AFTER_PASS_KEY = "star-after-pass";
export const AFTER_PASS_DEFAULT: AfterPassMode = "auto";
const VALUES: readonly AfterPassMode[] = ["auto", "stick"];
export const AFTER_PASS_NAMES: Record<AfterPassMode, string> = { auto: "Auto run", stick: "Joystick" };

export function parseAfterPassMode(v: string | null | undefined): AfterPassMode | null {
  return v && (VALUES as readonly string[]).includes(v) ? (v as AfterPassMode) : null;
}

function urlOverride(): AfterPassMode | null {
  try {
    if (typeof location === "undefined") return null;
    return parseAfterPassMode(new URLSearchParams(location.search).get("afterpass"));
  } catch { return null; }
}

let cached: AfterPassMode | null = null;
const listeners = new Set<() => void>();
const FORCED_KEY = "__starAfterPassForced";
const forcedMode = (): AfterPassMode | null => (globalThis as Record<string, unknown>)[FORCED_KEY] as AfterPassMode | null ?? null;

export function afterPassMode(): AfterPassMode {
  const forced = forcedMode();
  if (forced) return forced;
  const u = urlOverride();
  if (u) return u;
  if (cached === null) {
    let v: string | null = null;
    try { v = typeof localStorage === "undefined" ? null : localStorage.getItem(AFTER_PASS_KEY); } catch { v = null; }
    cached = parseAfterPassMode(v) ?? AFTER_PASS_DEFAULT;
  }
  return cached;
}

/** True when "After you pass" is set to Joystick. */
export const afterPassStickOn = () => afterPassMode() === "stick";

export function setAfterPassMode(v: AfterPassMode) {
  try { localStorage.setItem(AFTER_PASS_KEY, v); } catch { /* in-memory still changes */ }
  cached = v;
  listeners.forEach((f) => f());
}

/** Tests only: force a mode with no browser (null clears it). */
export function forceAfterPassMode(v: AfterPassMode | null) {
  (globalThis as Record<string, unknown>)[FORCED_KEY] = v;
  listeners.forEach((f) => f());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === AFTER_PASS_KEY) { cached = null; listeners.forEach((f) => f()); }
  });
}
export const onAfterPassMode = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useAfterPassMode = () => useSyncExternalStore(onAfterPassMode, afterPassMode, () => AFTER_PASS_DEFAULT);
