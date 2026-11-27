/**
 * CRASH-LOOP GUARD (Mikey, 19 Nov 2026: the app closed after the trial and would
 * not open again). A crash inside the phone's graphics code closes the app before
 * any error screen can show, and reopening went straight back to the same screen.
 *
 * Each risky part writes a mark before it starts and clears it once it has run
 * for a moment. If the app dies in between, the mark is still there next launch:
 * nothing is said and the part starts again as normal (one quick close is not a
 * crash). Only when the SAME part is still starting on the very next launch too is
 * it switched off, and the app says which in one small line at the foot of the
 * screen; it comes back by itself after a few launches, or at once with
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
 * reason: swiped away, the phone was busy). The first time, nothing changes and
 * nothing is said. Only when it happens on the very next launch too is it switched off; then it is tried again by itself after
 * RETRY_AFTER launches.
 */
const STRIKES_TO_OFF = 2;
const RETRY_AFTER = 4;

/**
 * SAFE START (Mikey, 27 Nov 2026: the app closed at the signing's news report, then closed again ~5 s into the main menu on every launch).
 * If the last run ended while a 3D place was mounted (a breadcrumb trail was left), or while the "3d" part was still starting, this
 * launch starts with ALL 3D off ("3d" is off for this launch: every place shows its drawn / plain version, nothing makes a GL view
 * or a headshot). Not kept for later launches: the launch after a quiet one is normal. Settings -> "Turn back on" ends it at once.
 */
let safeBoot = false;
let safeBootWhy: string | null = null;
/** The plain sentence for the screen while this launch is a safe start, else null. */
export function safeBootNote(): string | null { return safeBoot ? `Safe start: the app closed last time while ${safeBootWhy}, so 3D is off for this start. Settings: Turn back on.` : null; }
export function isSafeBoot(): boolean { return safeBoot; }

const num = (k: string) => Number(kv.getString(k) ?? "0") || 0;

// What was still starting when the app last closed.
const trippedNow: RiskyPart[] = [];
const skipThisLaunch = new Set<RiskyPart>();
const stillStarting = new Set<RiskyPart>();
for (const k of kv.getAllKeys()) {
  if (!k.startsWith(RUNNING)) continue;
  stillStarting.add(k.slice(RUNNING.length) as RiskyPart);
  kv.remove(k);
}
// Two launches IN A ROW only: a strike from an older launch is forgotten when the
// launch after it closed with the part not starting (a normal quick close, a reload).
for (const k of kv.getAllKeys()) {
  if (!k.startsWith(STRIKES)) continue;
  if (!stillStarting.has(k.slice(STRIKES.length) as RiskyPart) && kv.getString(OFF + k.slice(STRIKES.length)) !== "1") kv.remove(k);
}
for (const part of stillStarting) {
  const strikes = num(STRIKES + part) + 1;
  kv.set(STRIKES + part, String(strikes));
  // The first time nothing is said and nothing is left out: the part starts again as
  // normal. If the app closes on it again on that very next launch, it is switched off.
  if (strikes >= STRIKES_TO_OFF) { skipThisLaunch.add(part); kv.set(OFF + part, "1"); kv.set(WAIT + part, String(RETRY_AFTER)); trippedNow.push(part); }
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
/** True when the part's plain fallback must be used (switched off, left out for this launch, or this is a SAFE START for "3d"). */
export function partOff(part: RiskyPart): boolean { return (part === "3d" && safeBoot) || skipThisLaunch.has(part) || kv.getString(OFF + part) === "1"; }
/** Parts that are switched off (until "Turn back on" or the next automatic try). */
export function partsSwitchedOff(): RiskyPart[] {
  return (Object.keys(PART_NAMES) as RiskyPart[]).filter((p) => kv.getString(OFF + p) === "1");
}
export function turnPartBackOn(part: RiskyPart) {
  if (part === "3d") safeBoot = false;
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
// The web build: a reload or a closed tab is not a crash either.
try {
  const w = globalThis as unknown as { addEventListener?: (n: string, f: () => void) => void; document?: unknown };
  if (w.document && w.addEventListener) w.addEventListener("pagehide", () => {
    for (const k of kv.getAllKeys()) if (k.startsWith(RUNNING)) kv.remove(k);
  });
} catch { /* not a browser */ }
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
export function useRiskyPart(part: RiskyPart, opts: { settleMs?: number; delayMs?: number; /** also off: the caller says no (a setting) and nothing is marked */ off?: boolean } = {}): boolean {
  const off = partOff(part) || opts.off === true;
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

// ── CRASH BREADCRUMBS (24 Nov 2026) ────────────────────────────────────────────────
// The guard above only knows THAT a part was starting when the app closed. Mikey's app closed after the trial's accept-offer
// and we cannot run Android here, so each 3D place also writes the LAST STEP it reached ("mounted", "gl context created",
// "scene starting", "event stamp", "setShot(shake)" …). MMKV is memory-mapped: a synchronous write survives a native crash.
// 24 Nov, second round (the app closed again, in the handshake, after a quiet 10 s had already cleared the trail): the trail is now
// kept through the WHOLE scene. It is cleared only when the place closes cleanly, fails in a way the app caught, the app goes to
// the background, or the place has run well for 10 s AFTER ITS LAST STEP (every new step starts that count again). A "pulse"
// (frame number and time, written at most twice a second) says whether frames were still running when the app closed.
// If a trail is still there on the next launch, the app closed mid-step: it is kept (Settings shows it until "Clear") and logged.
// None of this changes the crash-loop rules above.
const TRAIL = "trail:";
const PULSE = "pulse:";
const CLOSED = "closed-while";
const LAST_ERROR = "last-error";
const MAX_STEPS = 10;
/** A place that has run this long after its last step ran well: no crash, so no trail. */
export const TRAIL_QUIET_MS = 10000;
export interface TrailStep { step: string; at: number }
export interface ClosedWhile { place: string; steps: TrailStep[]; pulse?: { n: number; at: number } }
/** The JavaScript error that failed a 3D place over to its plain version (src/three/crashNet.ts), kept until "Clear". */
export interface LastError { place: string; source: string; message: string; stack: string[]; lastEvent: string | null; at: number; /** the last 5 steps before it, "HH:MM:SS step" */ steps?: string[] }
const trails = new Map<string, TrailStep[]>();
const quiet = new Map<string, ReturnType<typeof setTimeout>>();
const pulses = new Map<string, { n: number; last: number }>();
let activePlace: string | null = null;
let closedWhile: ClosedWhile | null = null;
let closedFresh = false;
let lastError: LastError | null = null;

const clock = (at: number) => new Date(at).toISOString().replace("T", " ").slice(0, 19);
function trailLine(c: ClosedWhile): string {
  const last = c.steps[c.steps.length - 1];
  const path = c.steps.map((s) => s.step).join(" > ");
  const pulse = c.pulse ? ` Frames were still running: frame ${c.pulse.n}, ${last && c.pulse.at >= last.at ? ((c.pulse.at - last.at) / 1000).toFixed(1) + " s after the last step" : "before the last step"}.` : "";
  return `Last time the app closed while: ${c.place} at ${last?.step ?? "the start"} (${clock(last?.at ?? Date.now())} UTC). Steps: ${path}.${pulse}`;
}
/** The one plain line that says where the app last closed (Settings shows it; copy it as it is). */
export function closedWhileLine(): string | null { return closedWhile ? trailLine(closedWhile) + (lastError ? " " + lastErrorLine(lastError) : "") : null; }
export function closedWhileInfo(): ClosedWhile | null { return closedWhile; }
/** True only on the launch that found a trail left behind (not on later launches that still show it). */
export function closedWhileFresh(): boolean { return closedFresh; }
export function lastErrorLine(e: LastError): string {
  return `Last error: ${e.message} (${e.source}, in ${e.place}${e.lastEvent ? `, after ${e.lastEvent}` : ""}, ${clock(e.at)} UTC). ${e.stack.slice(0, 3).join(" | ")}`;
}
/** The last error that failed a 3D place over (or null). */
export function lastErrorInfo(): LastError | null { return lastError; }
/** Settings → Clear. */
export function clearClosedWhile() { closedWhile = null; lastError = null; try { kv.remove(CLOSED); kv.remove(LAST_ERROR); } catch { /* nothing to clear */ } }
/** Written at once (MMKV is synchronous) when a 3D place is failed over because of an error. */
export function recordLastError(e: LastError) {
  try { lastError = e; kv.set(LAST_ERROR, JSON.stringify(e)); } catch { /* never stop the app */ }
}

try {
  // a trail left by the last run = the app closed in the middle of that step; the newest one is kept
  let newest: ClosedWhile | null = null;
  for (const k of kv.getAllKeys()) {
    if (!k.startsWith(TRAIL)) continue;
    try {
      const steps = JSON.parse(kv.getString(k) ?? "[]") as TrailStep[];
      const place = k.slice(TRAIL.length);
      const c: ClosedWhile = { place, steps };
      try { const raw = kv.getString(PULSE + place); if (raw) c.pulse = JSON.parse(raw) as { n: number; at: number }; } catch { /* no pulse */ }
      if (steps.length && (!newest || steps[steps.length - 1].at >= (newest.steps[newest.steps.length - 1]?.at ?? 0))) newest = c;
    } catch { /* a half-written trail */ }
    kv.remove(k);
  }
  for (const k of kv.getAllKeys()) if (k.startsWith(PULSE)) kv.remove(k);
  if (newest) { kv.set(CLOSED, JSON.stringify(newest)); closedFresh = true; safeBoot = true; safeBootWhy = `${newest.place} was on screen (it stopped at "${newest.steps[newest.steps.length - 1]?.step ?? "the start"}")`; }
  else if (stillStarting.has("3d")) { safeBoot = true; safeBootWhy = "a 3D part was still starting"; }
  const raw = kv.getString(CLOSED);
  if (raw) closedWhile = JSON.parse(raw) as ClosedWhile;
  const rawErr = kv.getString(LAST_ERROR);
  if (rawErr) lastError = JSON.parse(rawErr) as LastError;
  if (closedWhile) console.warn("[safety] " + trailLine(closedWhile));
  if (lastError) console.warn("[safety] " + lastErrorLine(lastError));
} catch { /* breadcrumbs must never stop the app */ }

function armQuiet(place: string) {
  const old = quiet.get(place);
  if (old) clearTimeout(old);
  const t = setTimeout(() => { quiet.delete(place); clearTrail(place); }, TRAIL_QUIET_MS);
  (t as unknown as { unref?: () => void }).unref?.();
  quiet.set(place, t);
}
/** The last step this place reached (cheap: one MMKV write). Safe to call from anywhere; never throws. Starts the 10 quiet seconds again. */
export function markStep(place: string, step: string) {
  try {
    activePlace = place;
    const t = trails.get(place) ?? [];
    t.push({ step, at: Date.now() });
    if (t.length > MAX_STEPS) t.shift();
    trails.set(place, t);
    kv.set(TRAIL + place, JSON.stringify(t));
    armQuiet(place);
  } catch { /* never stop the app */ }
}
/** Mark a step on the place that is starting now (for code that does not know which place asked, e.g. the asset reader). */
export function markStepHere(step: string) { if (activePlace && trails.has(activePlace)) markStep(activePlace, step); }
/** A frame was drawn: the frame number and time are written at most twice a second (not a step: it does not start the quiet count). */
export function notePulse(place: string) {
  try {
    if (!trails.has(place)) return;
    const p = pulses.get(place) ?? { n: 0, last: 0 };
    p.n++;
    pulses.set(place, p);
    const now = Date.now();
    if (now - p.last >= 500) { p.last = now; kv.set(PULSE + place, JSON.stringify({ n: p.n, at: now })); }
  } catch { /* never stop the app */ }
}
/** The last steps of the place that is running now (Settings shows the last 5 of the one that closed the app). */
export function currentTrail(place: string): TrailStep[] { return (trails.get(place) ?? []).slice(); }
/** The place closed cleanly, ran well for 10 s after its last step, or failed in a way the app caught: no crash, so no trail. */
export function clearTrail(place: string) {
  try {
    trails.delete(place);
    pulses.delete(place);
    const q = quiet.get(place);
    if (q) { clearTimeout(q); quiet.delete(place); }
    kv.remove(TRAIL + place);
    kv.remove(PULSE + place);
    if (activePlace === place) activePlace = null;
  } catch { /* nothing to clear */ }
}
function clearAllTrails() { for (const p of Array.from(trails.keys())) clearTrail(p); }
// leaving the app (Home button, swiping it away) is not a crash either
try { AppState.addEventListener("change", (s) => { if (s !== "active") clearAllTrails(); }); } catch { /* no app state here (a test) */ }
