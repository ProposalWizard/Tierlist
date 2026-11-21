/**
 * CRASH-LOOP GUARD (Mikey, 19 Nov 2026: the app closed after the trial and would
 * not open again). A crash inside the phone's graphics code closes the app before
 * any error screen can show, and reopening went straight back to the same screen.
 *
 * Each risky part writes a mark before it starts and clears it once it has run
 * for a moment. If the app dies in between, the mark is still there next launch:
 * that part is left out for that launch (its plain fallback is used) and tried
 * again on the next. Twice in a row switches it off and the app says which part
 * it was; it comes back by itself after a few launches, or at once with
 * Settings → "Turn back on". A single slow start never switches anything off
 * for good (21 Nov 2026).
 */
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { createMMKV } from "react-native-mmkv";

export type RiskyPart = "3d" | "badges" | "player-drawing" | "goal-video";
export const PART_NAMES: Record<RiskyPart, string> = {
  "3d": "the 3D player and 3D scenes",
  badges: "the club badges",
  "player-drawing": "the drawn player",
  "goal-video": "goal videos",
};
const kv = createMMKV({ id: "knowitball-safety" });
const RUNNING = "running:";
const OFF = "off:";
/** How many launches IN A ROW the part was still starting when the app closed. */
const STRIKES = "strikes:";
/** Launches left before a switched-off part is tried again by itself. */
const WAIT = "wait:";
/**
 * ONE slow start is not a crash loop (the app closed in its first seconds for any
 * reason: swiped away, the phone was busy). The first time, the part is left out
 * for that launch only and tried again on the next one. Only when it happens on
 * the next try too is it switched off; then it is tried again by itself after
 * RETRY_AFTER launches.
 */
const STRIKES_TO_OFF = 2;
const RETRY_AFTER = 4;

const num = (k: string) => Number(kv.getString(k) ?? "0") || 0;

// What was still starting when the app last closed.
const trippedNow: RiskyPart[] = [];
const skipThisLaunch = new Set<RiskyPart>();
for (const k of kv.getAllKeys()) {
  if (!k.startsWith(RUNNING)) continue;
  const part = k.slice(RUNNING.length) as RiskyPart;
  kv.remove(k);
  const strikes = num(STRIKES + part) + 1;
  kv.set(STRIKES + part, String(strikes));
  skipThisLaunch.add(part);
  if (strikes >= STRIKES_TO_OFF) { kv.set(OFF + part, "1"); kv.set(WAIT + part, String(RETRY_AFTER)); trippedNow.push(part); }
}
// A part that is switched off comes back by itself after a few launches (one strike
// left: if it closes the app again, it is off again at once).
for (const k of kv.getAllKeys()) {
  if (!k.startsWith(OFF)) continue;
  const part = k.slice(OFF.length) as RiskyPart;
  if (skipThisLaunch.has(part)) continue;
  const left = (kv.getString(WAIT + part) === undefined ? RETRY_AFTER : num(WAIT + part)) - 1;
  if (left <= 0) { kv.remove(k); kv.remove(WAIT + part); kv.set(STRIKES + part, String(STRIKES_TO_OFF - 1)); }
  else kv.set(WAIT + part, String(left));
}
/** Parts switched off at this launch, after closing twice in a row while starting (shown once). */
export function justTripped(): RiskyPart[] { return trippedNow; }
/** True when the part's plain fallback must be used (switched off, or left out for this launch). */
export function partOff(part: RiskyPart): boolean { return skipThisLaunch.has(part) || kv.getString(OFF + part) === "1"; }
/** Parts that are switched off (until "Turn back on" or the next automatic try). */
export function partsSwitchedOff(): RiskyPart[] {
  return (Object.keys(PART_NAMES) as RiskyPart[]).filter((p) => kv.getString(OFF + p) === "1");
}
export function turnPartBackOn(part: RiskyPart) {
  kv.remove(OFF + part); kv.remove(WAIT + part); kv.remove(STRIKES + part);
  skipThisLaunch.delete(part);
  const i = trippedNow.indexOf(part);
  if (i >= 0) trippedNow.splice(i, 1);
}

/** The longest a part may stay marked "starting": an app still alive after this did not crash at start. */
const MARK_MAX_MS = 12000;
const watchdog = new Map<RiskyPart, ReturnType<typeof setTimeout>>();
function start(part: RiskyPart) {
  kv.set(RUNNING + part, "1");
  // A draw that React throws away never runs its clean-up: the mark must not outlive it.
  const old = watchdog.get(part);
  if (old) clearTimeout(old);
  watchdog.set(part, setTimeout(() => { watchdog.delete(part); kv.remove(RUNNING + part); }, MARK_MAX_MS));
}
function done(part: RiskyPart) { kv.remove(RUNNING + part); }
/** It ran for its settle time: a good start. Earlier closes are forgotten. */
function settled(part: RiskyPart) { done(part); kv.remove(STRIKES + part); }
// Leaving the app (Home button, another app) while a part is starting is not a crash.
try {
  AppState.addEventListener("change", (s) => {
    if (s === "active") return;
    for (const k of kv.getAllKeys()) if (k.startsWith(RUNNING)) kv.remove(k);
  });
} catch { /* no app state here (a test) */ }

/**
 * Use in a risky component: returns false when the part is switched off (use the
 * fallback). While mounted, the part is marked as starting until `settleMs` has
 * passed without a crash. `delayMs` waits before saying yes, so parts that start
 * together on one screen start one after another and a crash names the right one.
 */
export function useRiskyPart(part: RiskyPart, opts: { settleMs?: number; delayMs?: number } = {}): boolean {
  const off = partOff(part);
  // no wait: marked at once, during the first draw, since the crash can come in it
  const [go, setGo] = useState(() => { if (!off && !opts.delayMs) { start(part); return true; } return false; });
  useEffect(() => {
    if (off) return;
    let t1: ReturnType<typeof setTimeout> | undefined;
    const t0 = setTimeout(() => {
      if (opts.delayMs) { start(part); setGo(true); }
      t1 = setTimeout(() => settled(part), opts.settleMs ?? 4000);
    }, opts.delayMs ?? 0);
    // closing the screen before it settled is not a crash: clear the mark
    return () => { clearTimeout(t0); if (t1) clearTimeout(t1); done(part); };
  }, [off, part, opts.delayMs, opts.settleMs]);
  return !off && go;
}
