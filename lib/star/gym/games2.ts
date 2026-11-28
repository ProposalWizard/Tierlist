/**
 * THE GYM'S TEN NEW MINI-GAMES (gym phase 2, Harry 28 Nov 2026: "there's pull-ups, squats, push-ups,
 * ab training, football-specific training as well, because a lot of the GTA one is just strength").
 * Same contract as games.ts: one thumb, 20 to 40 s, a pure step (state, dt, holding) → state, seeded,
 * frame-rate free (sub-steps of 1/120 s). A TAP is a press after a let-go (the step sees the edge).
 * Each one asks the thumb for something different from the bench (feather a weight), the treadmill
 * (hold against a belt) and the bag (keep a cursor in a wandering zone):
 *
 *   pullup      MASH, BUT NOT TOO MUCH. Each tap pulls you up the bar; gravity drags you down. Chin over the
 *               bar = a rep, then drop to a dead hang before the next counts. Every tap costs grip: mash
 *               and your hands give out (you drop off the bar).
 *   squat       LET GO ON TIME. Hold to sink with the bar on your back; let go inside the green depth band
 *               and you drive up. Too early: a half rep. Too late: stuck in the hole (a strike).
 *   pushup      ON THE BEAT. A metronome; tap on each beat. Three misses in a row and you are flat on the mat.
 *   plank       BREATHE. Hold to brace; the shake builds. A quick let-go (a breath) settles it; let go too
 *               long and your hips drop (a strike). Shake to the top: you collapse (a strike).
 *   nordic      SAVE IT FOR THE BOTTOM. You fall forward from your knees; holding brakes, but braking tires
 *               your hamstrings. Spend it where the fall is fastest. Too fast: you collapse onto your hands.
 *   copenhagen  FIGHT THE SAG. A side plank on a box: your hips sag harder the longer you hold; hold to lift
 *               them, keep them in the straight band. Two sides.
 *   boxjump     TIME THE SWING. A power needle swings; tap with it in the gold to land on the box. Short:
 *               you clip the box (a strike).
 *   ladder      READ THE RUNGS. The rungs come at you, unevenly, faster and faster: tap as each reaches your
 *               feet. Four misses in a row: you trip.
 *   landing     STICK IT. Tap to hop; tap again as the ring closes on your foot (the landing), then keep
 *               holding still on one leg. A heavy landing is a strike.
 *   mobility    TRACE. A slow line runs through a tube; hold to rise, let go to sink, and stay in the tube.
 *               Out of it too long: you pulled something.
 *
 * Test: tests/star/gym.mts.
 */
import type { GameResult } from "./games";

/**
 * FOOTBALL DRILLS WITH A BALL: NOT HERE (a later job). The one-engine rule (CLAUDE.md "ONE ENGINE",
 * RUL-ENG-002): anything with a ball must mount EnginePlay and run the real match, never a mini-game of its
 * own. The list for that job, each a gym "station" that hands off to EnginePlay with its own scenario:
 */
export const BALL_DRILLS_LATER = [
  { id: "rondo", what: "Rondo 5 v 2: quick passing under pressure", stat: "focus" },
  { id: "firstTouch", what: "First touch off the rebound wall", stat: "focus" },
  { id: "finishing", what: "Finishing from cut-backs, both feet", stat: "strength" },
  { id: "dribbleGates", what: "Dribble through cones at speed", stat: "cardio" },
  { id: "headers", what: "Heading from crosses (jump timing)", stat: "strength" },
  { id: "keeperReflex", what: "Keeper: reflex saves (keepers only)", stat: "resilience" },
] as const;

/** Exercises from the research list left out of this phase, and why (docs/research/gym-effects-2026-11-27.md section 3). */
export const CUT_FOR_NOW = [
  { id: "sled", why: "needs a 10 m strip the room hasn't got; the treadmill and the ladder already cover acceleration" },
  { id: "sprint", why: "the treadmill is the sprint (its belt speeds up to 14 km/h); a second running game would feel the same" },
  { id: "rdl", why: "a third barbell lift felt the same as the squat on the thumb" },
] as const;

export type Gym2Kind ="pullup" | "squat" | "pushup" | "plank" | "nordic" | "copenhagen" | "boxjump" | "ladder" | "landing" | "mobility";
export const GYM2_KINDS: Gym2Kind[] = ["pullup", "squat", "pushup", "plank", "nordic", "copenhagen", "boxjump", "ladder", "landing", "mobility"];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** A small seeded random (mulberry32), one number from a seed. */
function r1(seed: number): number {
  let t = (seed + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const SUB = 1 / 120;
function sub(dt: number, f: (h: number) => void) {
  let left = Math.max(0, Math.min(0.25, dt));
  while (left > 1e-9) { const h = Math.min(SUB, left); f(h); left -= h; }
}
type Flash = { what: string | null; age: number };
const flashNow = (what: string): Flash => ({ what, age: 0 });
const L = (level: number) => clamp(level, 1, 4);

interface Base { t: number; done: boolean; level: number; seed: number; prev: boolean; flash: Flash }
const base = (level: number, seed: number): Base => ({ t: 0, done: false, level: L(level), seed: seed >>> 0, prev: false, flash: { what: null, age: 9 } });

// ── pull-ups ──────────────────────────────────────────────────────────────
export const PULLUP = { reps: 10, maxSecs: 40, gravity: 2.6, tap: 0.9, fatigue: 0.035, vMax: 1.7, gripPerTap: 0.009, gripPerSec: 0.008, bottom: 0.08 } as const;
export interface PullupState extends Base { kind: "pullup"; y: number; v: number; reps: number; taps: number; grip: number; phase: "up" | "down"; dropped: boolean }
export const pullupStart = (level = 1, seed = 1): PullupState => ({ ...base(level, seed), kind: "pullup", y: 0, v: 0, reps: 0, taps: 0, grip: 1, phase: "up", dropped: false });
export function pullupStep(s0: PullupState, dt: number, hold: boolean): PullupState {
  if (s0.done) return s0;
  const s: PullupState = { ...s0, flash: { ...s0.flash } };
  const tap = hold && !s.prev; s.prev = hold;
  if (tap && !s.dropped) {
    // a tap pulls; pulling against a fall is half a pull. Tired arms pull less; a stronger man more.
    const k = (1 - PULLUP.fatigue * s.reps) * (1 + 0.06 * (s.level - 1)) * (s.v < -0.3 ? 0.5 : 1);
    if (s.phase === "up") s.v = Math.min(PULLUP.vMax, s.v + PULLUP.tap * k);
    else s.v = Math.min(0, s.v + PULLUP.tap * k * 0.4); // on the way down a tap only brakes
    s.taps++; s.grip -= PULLUP.gripPerTap;
  }
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    s.grip -= PULLUP.gripPerSec * h;
    if (s.dropped) { s.y = Math.max(0, s.y - h * 2); if (s.flash.age > 1.2) s.done = true; return; }
    s.v = clamp(s.v - PULLUP.gravity * h, -PULLUP.vMax, PULLUP.vMax);
    s.y += s.v * h;
    if (s.y <= 0) { s.y = 0; s.v = 0; if (s.phase === "down") { s.phase = "up"; } }
    if (s.phase === "down" && s.y <= PULLUP.bottom) s.phase = "up";
    if (s.y >= 1) {
      s.y = 1; s.v = Math.min(0, s.v);
      if (s.phase === "up") { s.reps++; s.phase = "down"; s.flash = flashNow("rep"); }
    }
    if (s.grip <= 0) { s.grip = 0; s.dropped = true; s.flash = flashNow("drop"); }
    if (s.reps >= PULLUP.reps || s.t >= PULLUP.maxSecs) s.done = true;
  });
  return s;
}
export function pullupResult(s: PullupState): GameResult {
  const quality = clamp((s.reps / PULLUP.reps) * 0.85 + s.grip * 0.15 - (s.dropped ? 0.1 : 0), 0, 1);
  return { kind: "pullup", quality: +quality.toFixed(3), failed: s.dropped, headline: s.dropped ? `Your grip went after ${s.reps} rep${s.reps === 1 ? "" : "s"}: you dropped off the bar` : `${s.reps} pull-up${s.reps === 1 ? "" : "s"}, ${Math.round(s.grip * 100)}% grip left` };
}

// ── squats ────────────────────────────────────────────────────────────────
export const SQUAT = { reps: 8, maxSecs: 40, band: 0.72, half0: 0.1, half1: 0.06, v0: 0.32, acc: 0.42, accPerRep: 0.035, drive: 1.0, rest: 1.0, strikesOut: 2 } as const;
export interface SquatState extends Base { kind: "squat"; d: number; v: number; phase: "top" | "down" | "up" | "rest"; reps: number; good: number; perfect: number; strikes: number; restT: number; half: number; jit: number; lastDepth: number }
export const squatStart = (level = 1, seed = 1): SquatState => ({ ...base(level, seed), kind: "squat", d: 0, v: 0, phase: "top", reps: 0, good: 0, perfect: 0, strikes: 0, restT: 0, half: SQUAT.half0, jit: 1, lastDepth: 0 });
export function squatStep(s0: SquatState, dt: number, hold: boolean): SquatState {
  if (s0.done) return s0;
  const s: SquatState = { ...s0, flash: { ...s0.flash } };
  const release = !hold && s.prev; s.prev = hold;
  if (s.phase === "top" && hold) { s.phase = "down"; s.v = SQUAT.v0; s.jit = 0.8 + 0.4 * r1(s.seed * 31 + s.reps * 7 + 1); }
  if (s.phase === "down" && release) {
    const lo = SQUAT.band - s.half, hi = SQUAT.band + s.half;
    s.lastDepth = s.d;
    if (s.d < lo) s.flash = flashNow("shallow");
    else if (s.d > hi) { s.strikes++; s.flash = flashNow("deep"); }
    else { s.reps++; s.good++; if (Math.abs(s.d - SQUAT.band) < s.half / 3) { s.perfect++; s.flash = flashNow("perfect"); } else s.flash = flashNow("good"); }
    s.phase = "up";
  }
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    if (s.phase === "down") {
      // heavier each rep: it sinks faster; a stronger man controls it a little more
      s.v += (SQUAT.acc + SQUAT.accPerRep * s.reps) * s.jit * (1 - 0.05 * (s.level - 1)) * h;
      s.d += s.v * h;
      if (s.d >= 1) { s.d = 1; s.strikes++; s.flash = flashNow("stuck"); s.lastDepth = 1; s.phase = "up"; }
    } else if (s.phase === "up") {
      s.d -= SQUAT.drive * h;
      if (s.d <= 0) { s.d = 0; s.phase = "rest"; s.restT = 0; }
    } else if (s.phase === "rest") {
      s.restT += h;
      if (s.restT >= SQUAT.rest) s.phase = "top";
    }
    const f = Math.min(1, s.reps / (SQUAT.reps - 1));
    s.half = SQUAT.half0 + (SQUAT.half1 - SQUAT.half0) * f;
    if (s.reps >= SQUAT.reps && s.phase !== "up" || s.strikes >= SQUAT.strikesOut && s.phase !== "up" || s.t >= SQUAT.maxSecs) s.done = true;
  });
  return s;
}
export function squatResult(s: SquatState): GameResult {
  const failed = s.strikes >= SQUAT.strikesOut;
  const quality = clamp((s.good + 0.5 * s.perfect) / (1.5 * SQUAT.reps) * 1.15 - (failed ? 0.15 : 0), 0, 1);
  return { kind: "squat", quality: +quality.toFixed(3), failed, headline: failed ? `Stuck in the hole twice after ${s.reps} rep${s.reps === 1 ? "" : "s"}` : `${s.reps} squats to depth, ${s.perfect} spot on` };
}

// ── push-ups ──────────────────────────────────────────────────────────────
export const PUSHUP = { secs: 30, beat0: 0.95, beat1: 0.62, perfect: 0.1, good: 0.2, missesOut: 3 } as const;
export interface PushupState extends Base { kind: "pushup"; next: number; beats: number; perfect: number; good: number; miss: number; row: number; combo: number; best: number; tapped: boolean; flat: boolean; last: number }
export const pushupStart = (level = 1, seed = 1): PushupState => ({ ...base(level, seed), kind: "pushup", next: 1.0, beats: 0, perfect: 0, good: 0, miss: 0, row: 0, combo: 0, best: 0, tapped: false, flat: false, last: 0 });
/** The gap between beats now (they speed up). */
export const pushupBeat = (t: number) => PUSHUP.beat0 + (PUSHUP.beat1 - PUSHUP.beat0) * clamp(t / PUSHUP.secs, 0, 1);
export function pushupStep(s0: PushupState, dt: number, hold: boolean): PushupState {
  if (s0.done) return s0;
  const s: PushupState = { ...s0, flash: { ...s0.flash } };
  const tap = hold && !s.prev; s.prev = hold;
  const win = (PUSHUP.good + 0.02 * (s.level - 1));
  if (tap && !s.flat) {
    const prevBeat = s.next - pushupBeat(s.t);
    const dNext = s.next - s.t, dPrev = s.t - prevBeat;
    const near = Math.min(Math.abs(dNext), Math.abs(dPrev));
    const isNext = Math.abs(dNext) <= Math.abs(dPrev);
    const already = isNext ? s.tapped : s.last === prevBeat;
    if (near <= win && !already) {
      if (near <= PUSHUP.perfect) { s.perfect++; s.flash = flashNow("perfect"); } else { s.good++; s.flash = flashNow("good"); }
      s.combo++; s.best = Math.max(s.best, s.combo); s.row = 0;
      if (isNext) s.tapped = true; else s.last = prevBeat;
    } else { s.miss++; s.row++; s.combo = 0; s.flash = flashNow("off"); }
  }
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    if (s.flat) { if (s.flash.age > 1.2) s.done = true; return; }
    // a beat that passed with no tap (its window shut)
    if (s.t > s.next + win) {
      if (!s.tapped) { s.miss++; s.row++; s.combo = 0; s.flash = flashNow("miss"); }
      s.beats++; s.last = s.next; s.tapped = false;
      s.next += pushupBeat(s.t);
    }
    if (s.row >= PUSHUP.missesOut) { s.flat = true; s.flash = flashNow("flat"); }
    if (s.t >= PUSHUP.secs) s.done = true;
  });
  return s;
}
export function pushupResult(s: PushupState): GameResult {
  const n = Math.max(1, s.beats);
  const quality = clamp((s.perfect + 0.65 * s.good) / n - (s.flat ? 0.15 : 0), 0, 1);
  return { kind: "pushup", quality: +quality.toFixed(3), failed: s.flat, headline: s.flat ? `Flat on the mat after ${s.perfect + s.good} push-ups` : `${s.perfect + s.good} push-ups on the beat, ${s.perfect} perfect, best run ${s.best}` };
}
/** 0 = arms straight, 1 = chest down: where the body is between beats (for the pose). */
export function pushupDepth(s: PushupState): number {
  if (s.flat) return 1;
  const gap = pushupBeat(s.t), into = 1 - clamp((s.next - s.t) / gap, 0, 1);
  // down through the first half of the gap, up again onto the beat
  return into < 0.5 ? Math.sin(into * Math.PI) : Math.sin(into * Math.PI) * 0.9 + 0.1 * (1 - into);
}

// ── plank (abs) ───────────────────────────────────────────────────────────
export const PLANK = { secs: 30, shake0: 0.11, shake1: 0.26, drain: 2.2, breath: 0.5, strikesOut: 3 } as const;
export interface PlankState extends Base { kind: "plank"; shake: number; off: number; braced: number; strikes: number; sag: number; breaths: number }
export const plankStart = (level = 1, seed = 1): PlankState => ({ ...base(level, seed), kind: "plank", shake: 0, off: 0, braced: 0, strikes: 0, sag: 0, breaths: 0 });
export function plankStep(s0: PlankState, dt: number, hold: boolean): PlankState {
  if (s0.done) return s0;
  const s: PlankState = { ...s0, flash: { ...s0.flash } };
  if (hold && !s.prev && s.off > 0.05 && s.off <= PLANK.breath) { s.breaths++; s.flash = flashNow("breath"); }
  s.prev = hold;
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    const f = s.t / PLANK.secs;
    if (hold) {
      s.off = 0; s.braced += h;
      // the shake builds faster as you tire; a surge now and then (seeded, every ~2.3 s)
      const k = Math.floor(s.t / 2.3), surge = (s.t % 2.3) < 0.5 && r1(s.seed + k * 13) > 0.45 ? 1.9 : 1;
      s.shake += (PLANK.shake0 + (PLANK.shake1 - PLANK.shake0) * f) * surge * (1 - 0.06 * (s.level - 1)) * h;
      s.sag = Math.max(0, s.sag - h * 3);
    } else {
      s.off += h;
      s.shake = Math.max(0, s.shake - PLANK.drain * h);
      s.sag = Math.min(1, s.sag + h * 1.6);
      // a breath too long drops the hips; still not bracing, again every 1.5 s
      const k0 = Math.floor((s.off - h - PLANK.breath) / 1.5), k1 = Math.floor((s.off - PLANK.breath) / 1.5);
      if (s.off > PLANK.breath && k1 > k0) { s.strikes++; s.flash = flashNow("sag"); }
    }
    if (s.shake >= 1) { s.shake = 0.45; s.strikes++; s.flash = flashNow("collapse"); }
    if (s.strikes >= PLANK.strikesOut || s.t >= PLANK.secs) s.done = true;
  });
  return s;
}
export function plankResult(s: PlankState): GameResult {
  const failed = s.strikes >= PLANK.strikesOut;
  const quality = clamp(s.braced / PLANK.secs * 1.08 - 0.12 * s.strikes, 0, 1);
  return { kind: "plank", quality: +quality.toFixed(3), failed, headline: failed ? `Your plank broke after ${Math.floor(s.t)} s` : `${Math.round(s.braced)} s braced, ${s.breaths} breaths, ${s.strikes} wobble${s.strikes === 1 ? "" : "s"}` };
}

// ── Nordic curls ──────────────────────────────────────────────────────────
export const NORDIC = { reps: 5, maxSecs: 40, g0: 0.12, g1: 1.25, brake: 1.7, drainHold: 0.3, regen: 0.3, safe: 0.45, crash: 0.8, back: 1.4, rest: 0.7, strikesOut: 2 } as const;
export interface NordicState extends Base { kind: "nordic"; a: number; v: number; ham: number; phase: "down" | "back" | "rest"; reps: number; clean: number; strikes: number; vPeak: number; restT: number; control: number }
export const nordicStart = (level = 1, seed = 1): NordicState => ({ ...base(level, seed), kind: "nordic", a: 0, v: 0, ham: 1, phase: "rest", reps: 0, clean: 0, strikes: 0, vPeak: 0, restT: 0.3, control: 0 });
export function nordicStep(s0: NordicState, dt: number, hold: boolean): NordicState {
  if (s0.done) return s0;
  const s: NordicState = { ...s0, flash: { ...s0.flash } };
  s.prev = hold;
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    if (s.phase === "down") {
      // the fall pulls harder the further forward you are; holding brakes by what your hamstrings have left
      const grav = NORDIC.g0 + NORDIC.g1 * s.a;
      const brake = hold ? NORDIC.brake * s.ham * (1 + 0.06 * (s.level - 1)) : 0;
      s.v = Math.max(0, s.v + (grav - brake) * h - s.v * 0.4 * h);
      s.a += s.v * h;
      s.ham = clamp(s.ham + (hold ? -NORDIC.drainHold : NORDIC.regen) * h, 0, 1);
      s.vPeak = Math.max(s.vPeak, s.v);
      if (s.v <= NORDIC.safe) s.control = Math.max(s.control, s.a);
      if (s.v > NORDIC.crash && s.a < 0.92) { s.strikes++; s.flash = flashNow("crash"); s.phase = "back"; }
      else if (s.a >= 1) {
        s.a = 1; s.reps++;
        if (s.vPeak <= NORDIC.safe) { s.clean++; s.flash = flashNow("clean"); } else s.flash = flashNow("rep");
        s.phase = "back";
      }
    } else if (s.phase === "back") {
      // pushed back up off the floor, the hamstrings get a little back
      s.a = Math.max(0, s.a - h / NORDIC.back); s.v = 0; s.ham = Math.min(1, s.ham + 0.2 * h);
      if (s.a <= 0) { s.phase = "rest"; s.restT = 0; }
    } else {
      s.restT += h; s.ham = Math.min(1, s.ham + 0.3 * h);
      if (s.restT >= NORDIC.rest && s.reps < NORDIC.reps && s.strikes < NORDIC.strikesOut) { s.phase = "down"; s.v = 0.02; s.vPeak = 0; s.control = 0; }
    }
    if (s.phase === "rest" && (s.reps >= NORDIC.reps || s.strikes >= NORDIC.strikesOut) || s.t >= NORDIC.maxSecs) s.done = true;
  });
  return s;
}
export function nordicResult(s: NordicState): GameResult {
  const failed = s.strikes >= NORDIC.strikesOut;
  const quality = clamp((s.reps + s.clean) / (2 * NORDIC.reps) - (failed ? 0.15 : 0), 0, 1);
  return { kind: "nordic", quality: +quality.toFixed(3), failed, headline: failed ? `Collapsed onto your hands twice (${s.reps} rep${s.reps === 1 ? "" : "s"} done)` : `${s.reps} Nordics, ${s.clean} lowered all the way under control` };
}

// ── Copenhagen plank ──────────────────────────────────────────────────────
export const COPEN = { side: 14, swap: 2, lo: 0.55, hi: 0.85, sag0: 0.5, sagGrow: 0.07, lift: 1.25, damp: 2.4, drop: 0.22 } as const;
export interface CopenState extends Base { kind: "copenhagen"; h: number; v: number; side: 0 | 1; sideT: number; swapping: number; inZone: number; drops: number; failed: boolean }
export const copenStart = (level = 1, seed = 1): CopenState => ({ ...base(level, seed), kind: "copenhagen", h: 0.7, v: 0, side: 0, sideT: 0, swapping: 0, inZone: 0, drops: 0, failed: false });
export function copenStep(s0: CopenState, dt: number, hold: boolean): CopenState {
  if (s0.done) return s0;
  const s: CopenState = { ...s0, flash: { ...s0.flash } };
  s.prev = hold;
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    if (s.swapping > 0) { s.swapping -= h; s.h += (0.7 - s.h) * Math.min(1, h * 4); s.v = 0; if (s.swapping <= 0) { s.side = 1; s.sideT = 0; } return; }
    s.sideT += h;
    // the sag grows the longer this side holds; a little seeded wobble
    const wob = 0.25 * Math.sin(s.t * 2.1 + (s.seed % 17)) + 0.18 * Math.sin(s.t * 3.7 + (s.seed % 23));
    const sag = (COPEN.sag0 + COPEN.sagGrow * s.sideT) * (1 - 0.05 * (s.level - 1)) + wob;
    s.v += ((hold ? COPEN.lift : 0) - sag - COPEN.damp * s.v) * h;
    s.h = clamp(s.h + s.v * h, 0, 1);
    if (s.h >= 1) s.v = Math.min(0, s.v);
    if (s.h >= COPEN.lo && s.h <= COPEN.hi) s.inZone += h;
    if (s.h <= COPEN.drop) { s.drops++; s.flash = flashNow("drop"); s.h = 0.6; s.v = 0; if (s.drops >= 3) { s.failed = true; s.done = true; } }
    if (s.side === 0 && s.sideT >= COPEN.side) { s.swapping = COPEN.swap; s.flash = flashNow("swap"); }
    if (s.side === 1 && s.sideT >= COPEN.side) s.done = true;
  });
  return s;
}
export function copenResult(s: CopenState): GameResult {
  const share = s.inZone / (2 * COPEN.side);
  const quality = clamp(share * 1.1 - 0.08 * s.drops, 0, 1);
  return { kind: "copenhagen", quality: +quality.toFixed(3), failed: s.failed, headline: s.failed ? `Your hips dropped three times: the plank is over` : `Both sides held, ${Math.round(share * 100)}% in the straight line` };
}

// ── box jumps ─────────────────────────────────────────────────────────────
export const BOXJUMP = { jumps: 10, maxSecs: 40, period0: 1.5, period1: 1.05, gold: [0.8, 0.95] as const, ok: 0.62, air: 0.75, down: 0.95, strikesOut: 2 } as const;
export interface BoxJumpState extends Base { kind: "boxjump"; needle: number; phase: "ready" | "air" | "down"; phaseT: number; power: number; jumps: number; gold: number; ok: number; strikes: number; height: number; streak: number; clock: number }
export const boxjumpStart = (level = 1, seed = 1): BoxJumpState => ({ ...base(level, seed), kind: "boxjump", needle: 0, phase: "ready", phaseT: 0, power: 0, jumps: 0, gold: 0, ok: 0, strikes: 0, height: 0, streak: 0, clock: 0 });
export const boxjumpPeriod = (s: Pick<BoxJumpState, "jumps">) => BOXJUMP.period0 + (BOXJUMP.period1 - BOXJUMP.period0) * clamp(s.jumps / (BOXJUMP.jumps - 1), 0, 1);
export function boxjumpStep(s0: BoxJumpState, dt: number, hold: boolean): BoxJumpState {
  if (s0.done) return s0;
  const s: BoxJumpState = { ...s0, flash: { ...s0.flash } };
  const tap = hold && !s.prev; s.prev = hold;
  if (tap && s.phase === "ready") {
    s.power = s.needle; s.phase = "air"; s.phaseT = 0; s.jumps++;
    const [g0, g1] = BOXJUMP.gold, widen = 0.015 * (s.level - 1);
    if (s.power >= g0 - widen && s.power <= g1 + widen) { s.gold++; s.streak++; s.flash = flashNow("gold"); if (s.streak % 3 === 0) s.height = Math.min(2, s.height + 1); }
    else if (s.power >= BOXJUMP.ok) { s.ok++; s.streak = 0; s.flash = flashNow(s.power > g1 ? "over" : "short"); }
    else { s.strikes++; s.streak = 0; s.flash = flashNow("clip"); }
  }
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    if (s.phase === "ready") { s.clock += h; s.needle = 0.5 - 0.5 * Math.cos((2 * Math.PI * s.clock) / boxjumpPeriod(s)); }
    else {
      s.phaseT += h;
      if (s.phase === "air" && s.phaseT >= BOXJUMP.air) { s.phase = "down"; s.phaseT = 0; }
      else if (s.phase === "down" && s.phaseT >= BOXJUMP.down) { s.phase = "ready"; s.phaseT = 0; s.clock = 0; s.needle = 0; }
    }
    if (s.phase === "ready" && (s.jumps >= BOXJUMP.jumps || s.strikes >= BOXJUMP.strikesOut) || s.t >= BOXJUMP.maxSecs) s.done = true;
  });
  return s;
}
export function boxjumpResult(s: BoxJumpState): GameResult {
  const failed = s.strikes >= BOXJUMP.strikesOut;
  const quality = clamp((s.gold + 0.5 * s.ok) / BOXJUMP.jumps + 0.05 * s.height - (failed ? 0.15 : 0), 0, 1);
  return { kind: "boxjump", quality: +quality.toFixed(3), failed, headline: failed ? `Clipped the box twice (${s.gold + s.ok} landed)` : `${s.gold} of ${s.jumps} jumps stuck clean${s.height ? `, the box went up ${s.height}` : ""}` };
}

// ── agility ladder ────────────────────────────────────────────────────────
export const LADDER = { secs: 25, lead: 1.4, win: 0.11, perfect: 0.05, missesOut: 4 } as const;
export interface LadderState extends Base { kind: "ladder"; /** the next rungs' times (s) */ rungs: number[]; made: number; hit: number; perfect: number; miss: number; row: number; combo: number; best: number; tripped: boolean; gen: number }
/** The rungs' rhythm: in-in-out, a quick double, a pause; gaps shrink from 0.5 to 0.27 s. Seeded. */
function moreRungs(s: LadderState) {
  while (s.rungs.length < 12) {
    const lastT = s.rungs.length ? s.rungs[s.rungs.length - 1] : 1.2;
    const f = clamp(lastT / LADDER.secs, 0, 1);
    const gap = 0.5 - 0.23 * f;
    const r = r1(s.seed * 97 + s.gen * 13);
    s.gen++;
    const g = r < 0.3 ? gap * 0.62 : r < 0.82 ? gap : gap * 1.55;
    s.rungs.push(+(lastT + g).toFixed(4));
  }
}
export function ladderStart(level = 1, seed = 1): LadderState {
  const s: LadderState = { ...base(level, seed), kind: "ladder", rungs: [], made: 0, hit: 0, perfect: 0, miss: 0, row: 0, combo: 0, best: 0, tripped: false, gen: 0 };
  moreRungs(s);
  return s;
}
export function ladderStep(s0: LadderState, dt: number, hold: boolean): LadderState {
  if (s0.done) return s0;
  const s: LadderState = { ...s0, rungs: s0.rungs.slice(), flash: { ...s0.flash } };
  const tap = hold && !s.prev; s.prev = hold;
  const win = LADDER.win + 0.01 * (s.level - 1);
  if (tap && !s.tripped) {
    const d = s.rungs.length ? s.rungs[0] - s.t : 9;
    if (Math.abs(d) <= win) {
      s.rungs.shift(); s.made++; s.hit++; s.combo++; s.best = Math.max(s.best, s.combo); s.row = 0;
      if (Math.abs(d) <= LADDER.perfect) { s.perfect++; s.flash = flashNow("perfect"); } else s.flash = flashNow("hit");
    } else { s.miss++; s.row++; s.combo = 0; s.flash = flashNow("off"); }
  }
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    if (s.tripped) { if (s.flash.age > 1.2) s.done = true; return; }
    while (s.rungs.length && s.rungs[0] < s.t - win) { s.rungs.shift(); s.made++; s.miss++; s.row++; s.combo = 0; s.flash = flashNow("miss"); }
    moreRungs(s);
    if (s.row >= LADDER.missesOut) { s.tripped = true; s.flash = flashNow("trip"); }
    if (s.t >= LADDER.secs) s.done = true;
  });
  return s;
}
export function ladderResult(s: LadderState): GameResult {
  const n = Math.max(1, s.made);
  const quality = clamp((s.hit + 0.4 * s.perfect) / (1.25 * n) * 1.1 - (s.tripped ? 0.15 : 0), 0, 1);
  return { kind: "ladder", quality: +quality.toFixed(3), failed: s.tripped, headline: s.tripped ? `Tripped in the ladder after ${s.hit} steps` : `${s.hit} of ${s.made} steps clean, best run ${s.best}` };
}

// ── landing balance ───────────────────────────────────────────────────────
export const LANDING = { hops: 6, maxSecs: 40, air: 0.8, perfect: 0.07, ok: 0.15, still: 1.5, reset: 0.7, strikesOut: 2 } as const;
export interface LandingState extends Base { kind: "landing"; phase: "ready" | "air" | "still" | "reset"; phaseT: number; hops: number; stuck: number; soft: number; strikes: number; landed: boolean; wobble: number; held: number; isSoft: boolean }
export const landingStart = (level = 1, seed = 1): LandingState => ({ ...base(level, seed), kind: "landing", phase: "ready", phaseT: 0, hops: 0, stuck: 0, soft: 0, strikes: 0, landed: false, wobble: 0, held: 0, isSoft: false });
export function landingStep(s0: LandingState, dt: number, hold: boolean): LandingState {
  if (s0.done) return s0;
  const s: LandingState = { ...s0, flash: { ...s0.flash } };
  const tap = hold && !s.prev; s.prev = hold;
  const okW = LANDING.ok + 0.01 * (s.level - 1);
  if (tap && s.phase === "ready" && s.phaseT > 0.25) { s.phase = "air"; s.phaseT = 0; s.hops++; s.landed = false; }
  else if (tap && s.phase === "air") {
    const d = Math.abs(LANDING.air - s.phaseT);
    if (d <= LANDING.perfect) { s.landed = true; s.flash = flashNow("stuck"); s.phase = "still"; s.phaseT = 0; s.wobble = 0; s.held = 0; s.isSoft = false; }
    else if (d <= okW) { s.landed = true; s.flash = flashNow("soft"); s.phase = "still"; s.phaseT = 0; s.wobble = 0.4; s.held = 0; s.isSoft = true; }
    else { s.strikes++; s.flash = flashNow("heavy"); s.phase = "reset"; s.phaseT = 0; }
  }
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h; s.phaseT += h;
    if (s.phase === "air" && s.phaseT > LANDING.air + okW) { s.strikes++; s.flash = flashNow("heavy"); s.phase = "reset"; s.phaseT = 0; }
    else if (s.phase === "still") {
      if (hold) { s.held += h; s.wobble = Math.max(0, s.wobble - h * 0.6); }
      else { s.wobble += h * 2.5; }
      if (s.wobble >= 1) { s.flash = flashNow("wobble"); s.phase = "reset"; s.phaseT = 0; }
      else if (s.held >= LANDING.still) { if (s.isSoft) s.soft++; else s.stuck++; s.flash = flashNow(s.isSoft ? "held-soft" : "held"); s.phase = "reset"; s.phaseT = 0; }
    } else if (s.phase === "reset" && s.phaseT >= LANDING.reset) { s.phase = "ready"; s.phaseT = 0; }
    if (s.phase === "ready" && (s.hops >= LANDING.hops || s.strikes >= LANDING.strikesOut) || s.t >= LANDING.maxSecs) s.done = true;
  });
  return s;
}
export function landingResult(s: LandingState): GameResult {
  const failed = s.strikes >= LANDING.strikesOut;
  const quality = clamp((s.stuck + 0.6 * s.soft) / LANDING.hops - (failed ? 0.15 : 0), 0, 1);
  return { kind: "landing", quality: +quality.toFixed(3), failed, headline: failed ? `Two heavy landings: knees first, so the drill stops` : `${s.stuck} landings stuck and held, ${s.soft} a bit soft` };
}

// ── mobility flow ─────────────────────────────────────────────────────────
export const MOBILITY = { secs: 28, half: 0.13, lift: 1.5, sink: 0.95, damp: 1.6, outMax: 1.5 } as const;
export interface MobilityState extends Base { kind: "mobility"; y: number; v: number; inTube: number; out: number; pulled: boolean }
/** The line to trace at time t (0..1), slow and smooth, seeded. */
export function mobilityPath(seed: number, t: number): number {
  const p = (seed % 89) * 0.17;
  return 0.5 + 0.22 * Math.sin(t * 0.45 + p) + 0.1 * Math.sin(t * 1.05 + p * 1.7) * Math.min(1, t / 6);
}
export const mobilityStart = (level = 1, seed = 1): MobilityState => ({ ...base(level, seed), kind: "mobility", y: mobilityPath(seed, 0), v: 0, inTube: 0, out: 0, pulled: false });
export function mobilityStep(s0: MobilityState, dt: number, hold: boolean): MobilityState {
  if (s0.done) return s0;
  const s: MobilityState = { ...s0, flash: { ...s0.flash } };
  s.prev = hold;
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h; s.flash.age += h;
    if (s.pulled) { if (s.flash.age > 1.2) s.done = true; return; }
    s.v += ((hold ? MOBILITY.lift : 0) - MOBILITY.sink - MOBILITY.damp * s.v) * h;
    s.y = clamp(s.y + s.v * h, 0, 1);
    if (s.y <= 0 || s.y >= 1) s.v = 0;
    const half = MOBILITY.half + 0.01 * (s.level - 1);
    if (Math.abs(s.y - mobilityPath(s.seed, s.t)) <= half) { s.inTube += h; s.out = 0; }
    else { s.out += h; if (s.out >= MOBILITY.outMax) { s.pulled = true; s.flash = flashNow("pulled"); } }
    if (s.t >= MOBILITY.secs) s.done = true;
  });
  return s;
}
export function mobilityResult(s: MobilityState): GameResult {
  const share = s.inTube / MOBILITY.secs;
  const quality = clamp(share * 1.08 - (s.pulled ? 0.15 : 0), 0, 1);
  return { kind: "mobility", quality: +quality.toFixed(3), failed: s.pulled, headline: s.pulled ? `Forced it out of the line: you felt something pull` : `${Math.round(share * 100)}% of the flow inside the line` };
}

// ── one door ──────────────────────────────────────────────────────────────
export type Gym2State = PullupState | SquatState | PushupState | PlankState | NordicState | CopenState | BoxJumpState | LadderState | LandingState | MobilityState;

export function start2(kind: Gym2Kind, level = 1, seed = 1): Gym2State {
  switch (kind) {
    case "pullup": return pullupStart(level, seed);
    case "squat": return squatStart(level, seed);
    case "pushup": return pushupStart(level, seed);
    case "plank": return plankStart(level, seed);
    case "nordic": return nordicStart(level, seed);
    case "copenhagen": return copenStart(level, seed);
    case "boxjump": return boxjumpStart(level, seed);
    case "ladder": return ladderStart(level, seed);
    case "landing": return landingStart(level, seed);
    case "mobility": return mobilityStart(level, seed);
  }
}
export function step2(s: Gym2State, dt: number, hold: boolean): Gym2State {
  switch (s.kind) {
    case "pullup": return pullupStep(s, dt, hold);
    case "squat": return squatStep(s, dt, hold);
    case "pushup": return pushupStep(s, dt, hold);
    case "plank": return plankStep(s, dt, hold);
    case "nordic": return nordicStep(s, dt, hold);
    case "copenhagen": return copenStep(s, dt, hold);
    case "boxjump": return boxjumpStep(s, dt, hold);
    case "ladder": return ladderStep(s, dt, hold);
    case "landing": return landingStep(s, dt, hold);
    case "mobility": return mobilityStep(s, dt, hold);
  }
}
export function result2(s: Gym2State): GameResult {
  switch (s.kind) {
    case "pullup": return pullupResult(s);
    case "squat": return squatResult(s);
    case "pushup": return pushupResult(s);
    case "plank": return plankResult(s);
    case "nordic": return nordicResult(s);
    case "copenhagen": return copenResult(s);
    case "boxjump": return boxjumpResult(s);
    case "ladder": return ladderResult(s);
    case "landing": return landingResult(s);
    case "mobility": return mobilityResult(s);
  }
}
/** The longest each can run (s), for the screen's clock. */
export const MAX_SECS2: Record<Gym2Kind, number> = { pullup: PULLUP.maxSecs, squat: SQUAT.maxSecs, pushup: PUSHUP.secs, plank: PLANK.secs, nordic: NORDIC.maxSecs, copenhagen: 2 * COPEN.side + COPEN.swap, boxjump: BOXJUMP.maxSecs, ladder: LADDER.secs, landing: LANDING.maxSecs, mobility: MOBILITY.secs };

export const HOW_TO2: Record<Gym2Kind, string> = {
  pullup: "Tap to pull. Chin over the bar, then drop to a dead hang. Every tap costs grip: don't mash.",
  squat: "Hold to sink. Let go in the green to drive up. Too late and you're stuck.",
  pushup: "Tap on the beat. Three misses in a row and you're flat on the mat.",
  plank: "Hold to brace. Let go for a quick breath when it shakes, never for long.",
  nordic: "Hold to brake the fall. Braking tires you: save it for the bottom.",
  copenhagen: "Hold to lift your hips. Keep them in the green; they sag more the longer you hold.",
  boxjump: "Tap when the needle is in the gold to land on the box.",
  ladder: "Tap as each rung reaches your feet. They come faster.",
  landing: "Tap to hop. Tap again as the ring closes to land, then hold still.",
  mobility: "Hold to rise, let go to sink. Stay inside the line.",
};
export const NAMES2: Record<Gym2Kind, string> = {
  pullup: "Pull-ups", squat: "Back squat", pushup: "Push-ups", plank: "Plank", nordic: "Nordic curls", copenhagen: "Copenhagen plank",
  boxjump: "Box jumps", ladder: "Agility ladder", landing: "Landing balance", mobility: "Mobility flow",
};

/**
 * A bot thumb for tests and films (skill 1 plays it well, 0 badly). Pure: reads the state only.
 * Taps are made by holding for part of a short cycle (so a tap is a press after a let-go).
 */
export function botHold2(s: Gym2State, skill = 1): boolean {
  const good = skill >= 0.5;
  switch (s.kind) {
    case "pullup": {
      // a steady 5 taps a second while pulling up, none on the way down; a bad thumb mashes at 12
      const rate = good ? (s.phase === "up" ? 5 : 0) : 12;
      return rate > 0 && (s.t * rate) % 1 < 0.5;
    }
    case "squat": {
      if (s.phase === "top") return s.restT >= 0 && ((s.t * 4) % 1 < 0.5);
      if (s.phase !== "down") return false;
      const aim = good ? SQUAT.band - s.v * 0.035 : 0.99;
      return s.d < aim;
    }
    case "pushup": {
      const off = good ? -0.02 : 0.32;
      const d = s.t - (s.next + off);
      return d >= 0 && d < 0.07;
    }
    case "plank": {
      if (!good) return true;
      // let go for a short breath when the shake is high (and come straight back)
      if (!s.prev) return s.off >= 0.2 || s.shake < 0.2;
      return s.shake < 0.78;
    }
    case "nordic": {
      if (!good) return false;
      // save the hamstrings early, brake hard once the fall gets quick
      return s.phase === "down" && s.v > 0.3 - 0.12 * s.a;
    }
    case "copenhagen": {
      const aim = good ? 0.7 : 0.1;
      return s.h < aim - (s.v > 0 ? 0.06 : -0.02);
    }
    case "boxjump": {
      if (s.phase !== "ready") return false;
      if (!good) return s.needle > 0.2 && s.needle < 0.45;
      const rising = Math.sin((2 * Math.PI * s.clock) / boxjumpPeriod(s)) > 0;
      return rising && s.needle >= 0.86 && s.needle <= 0.93;
    }
    case "ladder": {
      const d = s.rungs.length ? s.t - (s.rungs[0] + (good ? -0.015 : 0.2)) : -1;
      return d >= 0 && d < 0.04;
    }
    case "landing": {
      if (s.phase === "ready") return s.phaseT > 0.35 && s.phaseT < 0.42;
      if (s.phase === "air") return good ? s.phaseT >= LANDING.air - 0.02 && s.phaseT < LANDING.air + 0.05 : s.phaseT > 0.3 && s.phaseT < 0.35;
      if (s.phase === "still") return good;
      return false;
    }
    case "mobility": {
      const aim = good ? mobilityPath(s.seed, s.t + 0.35) : 0.95;
      return s.y < aim - s.v * 0.15;
    }
  }
}
