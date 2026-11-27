/**
 * THE GYM'S THREE MINI-GAMES (Harry, 27 Nov 2026: "a gym based on the GTA 6 gym"; the plan:
 * docs/research/gym-compound-driving-2026-11-27.md, phase 1). Each is a small phone game of its own,
 * one thumb, 20 to 40 seconds. Not football, so not the match engine (RUL-ENG-002 is about football).
 *
 *   bench      PRESS AND HOLD to push the bar up; LET GO and it comes down under its own weight.
 *              Lower it slowly: short holds brake it (feathering). Drop it too fast onto your chest
 *              and it bounces: a strike. Two strikes and the set ends (a "tweak", GTA's
 *              "let go too fast and you hurt yourself"). A rep counts at the top (the click) and
 *              again when it comes down under control. 8 reps a set.
 *   treadmill  The belt carries you BACK; HOLD to run forward. Keep your marker inside the green
 *              zone, which drifts a little. The belt speeds up every 8 seconds. Off the back edge
 *              and you fall off (San Andreas' loved fail, kept on purpose): the run ends.
 *   bag        A cursor sinks to the left; HOLD to push it right. Keep it in the pink zone (it wanders
 *              and jumps): while it is in, your punches land and the combo grows (GTA 6's heavy bag).
 *
 * Every game is a pure step function: (state, dt, holding) → state. The scene (world3d/gymPlace.ts)
 * reads the state each frame to pose your body and the machine, and the screen draws its meter.
 * Seeded and frame-rate free (fixed sub-steps), so a film and a test get the same run.
 * Test: tests/star/gym.mts.
 */

export type GymGameKind = "bench" | "treadmill" | "bag";

/** What one finished game gave: a grade 0..1 and the words for the result card. */
export interface GameResult {
  kind: GymGameKind;
  /** 0..1: how well it went (the progress model turns it into stat points). */
  quality: number;
  /** "5 clean reps", "Fell off at 12 km/h". */
  headline: string;
  /** Ended badly (two strikes on the bench, fell off the treadmill). */
  failed: boolean;
}

// ── shared ────────────────────────────────────────────────────────────────

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** A small seeded random (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Sub-steps of at most 1/120 s, so a slow phone frame plays the same game as a fast one. */
const SUB = 1 / 120;
function sub(dt: number, f: (h: number) => void) {
  let left = Math.max(0, Math.min(0.25, dt));
  while (left > 1e-9) { const h = Math.min(SUB, left); f(h); left -= h; }
}

// ── bench press ───────────────────────────────────────────────────────────

export const BENCH = {
  reps: 8,
  /** The longest a set may take (s). */
  maxSecs: 40,
  /** The bar's fall when you let go (bar heights a second², 0 = on the chest, 1 = arms locked). */
  gravity: 2.4,
  /** The push while you hold, first rep (heights/s²); each rep after is a little weaker (fatigue). */
  push: 5.2,
  fatigue: 0.05,
  /** Arriving on the chest faster than this (heights/s) is a bounce: a strike. */
  safeLand: 0.75,
  /** A controlled lowering takes at least this long from the top (s). Faster still counts, but is not "clean". */
  slowDown: 1.0,
  strikesOut: 2,
  /** How fast the bar may move at all (heights/s). */
  vMax: 2.2,
} as const;

export interface BenchState {
  kind: "bench";
  t: number;
  /** The bar: 0 on the chest, 1 locked out. */
  bar: number;
  /** Its speed (heights/s, + up). */
  v: number;
  phase: "up" | "down" | "rest";
  reps: number;
  /** Reps lowered slowly (the tempo). */
  clean: number;
  strikes: number;
  /** Time the bar has been coming down this rep (s). */
  downT: number;
  /** The last thing that happened, for the screen ("click", "bounce", "slow", "rep"), and how long ago. */
  flash: { what: "click" | "bounce" | "clean" | "fast" | null; age: number };
  done: boolean;
  /** Your Strength level (1-4): a stronger lifter pushes harder. */
  level: number;
}

export function benchStart(level = 1): BenchState {
  return { kind: "bench", t: 0, bar: 0.02, v: 0, phase: "rest", reps: 0, clean: 0, strikes: 0, downT: 0, flash: { what: null, age: 9 }, done: false, level: clamp(level, 1, 4) };
}

/** How hard you push this rep (fatigue lowers it, Strength raises it). */
export function benchPush(s: Pick<BenchState, "reps" | "level">): number {
  return BENCH.push * (1 - BENCH.fatigue * s.reps) * (1 + 0.06 * (s.level - 1));
}

export function benchStep(s0: BenchState, dt: number, hold: boolean): BenchState {
  if (s0.done) return s0;
  const s: BenchState = { ...s0, flash: { ...s0.flash } };
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h;
    s.flash.age += h;
    const a = (hold ? benchPush(s) : 0) - BENCH.gravity;
    s.v = clamp(s.v + a * h, -BENCH.vMax, BENCH.vMax);
    s.bar += s.v * h;
    if (s.phase === "down") s.downT += h;
    if (s.bar >= 1) {
      s.bar = 1; s.v = Math.min(0, s.v);
      if (s.phase !== "down") {
        // the click at the top: the rep is up
        if (s.phase === "up") { s.flash = { what: "click", age: 0 }; }
        s.phase = "down"; s.downT = 0;
      }
    }
    if (s.phase === "rest" && s.bar > 0.08) s.phase = "up";
    if (s.bar <= 0) {
      const land = -s.v;
      s.bar = 0; s.v = 0;
      if (s.phase === "down") {
        if (land > BENCH.safeLand) {
          // dropped onto the chest: a bounce, the rep does not count
          s.strikes++;
          s.flash = { what: "bounce", age: 0 };
        } else {
          s.reps++;
          const slow = s.downT >= BENCH.slowDown;
          if (slow) s.clean++;
          s.flash = { what: slow ? "clean" : "fast", age: 0 };
        }
        s.phase = "rest";
      } else if (s.phase === "up") s.phase = "rest"; // let go halfway: back down, no rep, no harm
    }
    if (s.reps >= BENCH.reps || s.strikes >= BENCH.strikesOut || s.t >= BENCH.maxSecs) s.done = true;
  });
  return s;
}

export function benchResult(s: BenchState): GameResult {
  const failed = s.strikes >= BENCH.strikesOut;
  const quality = clamp((s.reps + s.clean) / (2 * BENCH.reps) - (failed ? 0.15 : 0), 0, 1);
  const headline = failed ? (s.reps ? `Too fast! ${s.reps} rep${s.reps === 1 ? "" : "s"}, then the bar bounced off your chest twice` : "Too fast! The bar bounced off your chest twice")
    : s.reps >= BENCH.reps ? `${s.reps} reps, ${s.clean} lowered slowly`
    : `${s.reps} rep${s.reps === 1 ? "" : "s"} before the time ran out`;
  return { kind: "bench", quality: +quality.toFixed(3), headline, failed };
}

// ── treadmill ─────────────────────────────────────────────────────────────

export const TREADMILL = {
  secs: 30,
  /** Belt speed by stage (km/h), one stage every 8 s. */
  kmh: [8, 10, 12, 14],
  stageSecs: 8,
  /** How far the belt carries you back at each speed (belt lengths a second, at 8 km/h). */
  drift: 0.17,
  /** How much faster than the belt you run while you hold (×drift). Falls as the belt speeds up. */
  run: 2.0,
  /** How quickly your pace follows your thumb (per s): a bit of lag makes you overshoot. */
  follow: 3.2,
  /** The green zone's width at the start and at the end. */
  zone0: 0.34,
  zone1: 0.2,
} as const;

export interface TreadmillState {
  kind: "treadmill";
  t: number;
  /** Where you are on the belt: 0 at the front (the console), 1 at the back edge (off you go). */
  pos: number;
  /** Your speed relative to the belt (belt lengths/s, + towards the front). */
  v: number;
  /** The green zone's middle and half-width. */
  zone: number;
  half: number;
  /** Seconds in the zone. */
  inZone: number;
  /** The belt now (km/h). */
  kmh: number;
  fell: boolean;
  /** Seconds since you fell (the screen's fall moment), -1 before. */
  fellT: number;
  /** Bumped the console this run (a small one, no harm). */
  bumps: number;
  done: boolean;
  seed: number;
  level: number;
}

export function treadmillStart(level = 1, seed = 1): TreadmillState {
  return { kind: "treadmill", t: 0, pos: 0.45, v: 0, zone: 0.45, half: TREADMILL.zone0 / 2, inZone: 0, kmh: TREADMILL.kmh[0], fell: false, fellT: -1, bumps: 0, done: false, seed, level: clamp(level, 1, 4) };
}

export function treadmillStep(s0: TreadmillState, dt: number, hold: boolean): TreadmillState {
  if (s0.done) return s0;
  const s: TreadmillState = { ...s0 };
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h;
    if (s.fell) { s.fellT += h; s.pos = Math.min(1.6, s.pos + h * 1.4); if (s.fellT > 2.2) s.done = true; return; }
    const stage = Math.min(TREADMILL.kmh.length - 1, Math.floor(s.t / TREADMILL.stageSecs));
    s.kmh = TREADMILL.kmh[stage];
    const k = s.kmh / TREADMILL.kmh[0];
    const drift = TREADMILL.drift * k;
    // a fitter runner has more in his legs as it speeds up
    const run = drift * (TREADMILL.run - 0.12 * stage + 0.08 * (s.level - 1));
    const want = hold ? run - drift : -drift;
    s.v += (want - s.v) * Math.min(1, TREADMILL.follow * h);
    s.pos -= s.v * h;
    if (s.pos < 0.04) { if (s.v > 0.05) s.bumps++; s.pos = 0.04; s.v = Math.min(0, s.v); }
    // the zone drifts slowly (two slow waves, seeded) and narrows
    const p = (s.seed % 97) * 0.13;
    const f = s.t / TREADMILL.secs;
    s.half = (TREADMILL.zone0 + (TREADMILL.zone1 - TREADMILL.zone0) * f) / 2;
    s.zone = clamp(0.45 + 0.13 * Math.sin(s.t * 0.55 + p) + 0.06 * Math.sin(s.t * 1.37 + p * 2), 0.2 + s.half, 0.85 - s.half);
    if (Math.abs(s.pos - s.zone) <= s.half) s.inZone += h;
    if (s.pos >= 1) { s.fell = true; s.fellT = 0; }
    if (s.t >= TREADMILL.secs) s.done = true;
  });
  return s;
}

export function treadmillResult(s: TreadmillState): GameResult {
  const ran = Math.min(s.t, TREADMILL.secs);
  const share = s.inZone / TREADMILL.secs;
  const quality = clamp(share * (s.fell ? 0.85 : 1) + (s.fell ? 0 : 0.1), 0, 1);
  const headline = s.fell ? `You fell off at ${s.kmh} km/h after ${Math.floor(ran)} s` : `${TREADMILL.secs} s run, up to ${s.kmh} km/h, ${Math.round(share * 100)}% in the zone`;
  return { kind: "treadmill", quality: +quality.toFixed(3), headline, failed: s.fell };
}

// ── heavy bag ─────────────────────────────────────────────────────────────

export const BAG = {
  secs: 25,
  /** The cursor sinks left when you let go, rises right while you hold (per s²). */
  sink: 1.6,
  lift: 3.4,
  vMax: 1.1,
  /** The zone's half-width, start and end. */
  half0: 0.13,
  half1: 0.085,
  /** A punch lands every this many seconds while in the zone. */
  punchEvery: 0.42,
} as const;

export interface BagState {
  kind: "bag";
  t: number;
  /** The cursor (0..1) and its speed. */
  x: number;
  v: number;
  /** The zone's middle and half-width; where it is heading next. */
  zone: number;
  half: number;
  goal: number;
  inZone: number;
  /** Punches landed, the combo now and the best combo. */
  hits: number;
  combo: number;
  best: number;
  /** Time to the next punch; which hand threw the last one (0 left jab, 1 right cross); seconds since it. */
  next: number;
  hand: 0 | 1;
  since: number;
  done: boolean;
  seed: number;
  /** Seeded random's state. */
  r: number;
  level: number;
}

export function bagStart(level = 1, seed = 1): BagState {
  return { kind: "bag", t: 0, x: 0.3, v: 0, zone: 0.5, half: BAG.half0, goal: 0.5, inZone: 0, hits: 0, combo: 0, best: 0, next: BAG.punchEvery, hand: 1, since: 9, done: false, seed, r: seed >>> 0, level: clamp(level, 1, 4) };
}

export function bagStep(s0: BagState, dt: number, hold: boolean): BagState {
  if (s0.done) return s0;
  const s: BagState = { ...s0 };
  sub(dt, (h) => {
    if (s.done) return;
    s.t += h;
    s.since += h;
    s.v = clamp(s.v + ((hold ? BAG.lift : 0) - BAG.sink) * h, -BAG.vMax, BAG.vMax);
    s.x += s.v * h;
    if (s.x <= 0) { s.x = 0; s.v = Math.max(0, s.v); }
    if (s.x >= 1) { s.x = 1; s.v = Math.min(0, s.v); }
    // the zone glides to its goal; a new goal now and then (seeded)
    const f = s.t / BAG.secs;
    s.half = BAG.half0 + (BAG.half1 - BAG.half0) * f;
    s.zone += (s.goal - s.zone) * Math.min(1, h * (0.9 + f * 1.2));
    if (Math.abs(s.goal - s.zone) < 0.02) {
      const r = rng(s.r); const u = r(); s.r = Math.floor(r() * 4294967295);
      s.goal = clamp(0.15 + u * 0.7, 0.12 + s.half, 0.88 - s.half);
    }
    const inside = Math.abs(s.x - s.zone) <= s.half;
    if (inside) {
      s.inZone += h;
      s.next -= h;
      if (s.next <= 0) {
        s.next += BAG.punchEvery * (1 - 0.05 * (s.level - 1));
        s.hits++; s.combo++; s.best = Math.max(s.best, s.combo);
        s.hand = s.hand ? 0 : 1; s.since = 0;
      }
    } else {
      if (s.combo) s.combo = 0;
      s.next = Math.max(s.next, 0.15);
    }
    if (s.t >= BAG.secs) s.done = true;
  });
  return s;
}

export function bagResult(s: BagState): GameResult {
  const share = s.inZone / BAG.secs;
  const quality = clamp(share * 0.85 + Math.min(1, s.best / 20) * 0.15, 0, 1);
  return { kind: "bag", quality: +quality.toFixed(3), headline: `${s.hits} punches landed, best combo ${s.best}`, failed: false };
}

// ── one door for the scene ────────────────────────────────────────────────

export type GameState = BenchState | TreadmillState | BagState;

export function startGame(kind: GymGameKind, level = 1, seed = 1): GameState {
  return kind === "bench" ? benchStart(level) : kind === "treadmill" ? treadmillStart(level, seed) : bagStart(level, seed);
}
export function stepGame(s: GameState, dt: number, hold: boolean): GameState {
  return s.kind === "bench" ? benchStep(s, dt, hold) : s.kind === "treadmill" ? treadmillStep(s, dt, hold) : bagStep(s, dt, hold);
}
export function resultOf(s: GameState): GameResult {
  return s.kind === "bench" ? benchResult(s) : s.kind === "treadmill" ? treadmillResult(s) : bagResult(s);
}
/** The words under each game's meter: what your thumb does. */
export const HOW_TO: Record<GymGameKind, string> = {
  bench: "Hold to push up. Let go to lower. Tap to brake: lower it slowly.",
  treadmill: "Hold to run. Let go and the belt takes you back. Stay in the green.",
  bag: "Hold to push right. Let go to drift left. Keep it in the pink.",
};
export const GAME_NAMES: Record<GymGameKind, string> = { bench: "Bench press", treadmill: "Treadmill", bag: "Heavy bag" };

/**
 * A bot thumb for tests and films: how a decent player plays each game. `skill` 0..1: 1 plays
 * it well, 0 lets go too early. Pure: reads the state only.
 */
export function botHold(s: GameState, skill = 1): boolean {
  if (s.kind === "bench") {
    if (s.phase === "rest" || s.phase === "up") return true;
    // coming down: brake whenever it falls faster than a slow, safe speed
    const target = skill >= 0.5 ? -0.55 : -1.6;
    return s.v < target;
  }
  if (s.kind === "treadmill") {
    const aim = skill >= 0.5 ? s.zone : 1.2; // a bad runner aims off the back
    return s.pos > aim + (s.v > 0 ? 0.04 : -0.02);
  }
  const aim = s.zone + (skill >= 0.5 ? 0 : 0.4);
  return s.x < aim - (s.v > 0 ? 0.05 : -0.01);
}
