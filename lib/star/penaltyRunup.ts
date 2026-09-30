/**
 * THE RUN-UP — every penalty and every direct free kick (v0.15).
 *
 * Harry, 27 Sep 2026: "Your player starts a few steps away from the ball. You
 * pick your corner, and then there's a little 3 seconds, maybe, or 2 seconds,
 * where your player walks up to the penalty … maybe you have a small timer,
 * like a 1-second timer … In the time that you're walking up to the ball,
 * maybe the goalie can take a step to the right, maybe you can take a step to
 * the left … add that into every penalty, every mode." He saw it filmed and
 * kept it, permanent, and asked for "the animation change for the free kicks
 * as well".
 *
 * ── The flow ──
 *
 *  1. You stand a few steps back from the ball, a little to one side.
 *  2. You drag back to aim, exactly as before. Letting go no longer opens the
 *     strike screen straight away —
 *  3. — you run up (`RUNUP.runupS`). On a PENALTY the keeper may hop (below)
 *     and a sideways drag anywhere on the pitch swings your aim (up to
 *     `RUNUP.nudgeMaxM` either way along the goal line). A free kick is the
 *     jog only: your aim is the aim you let go with.
 *  4. At the ball the strike screen opens with a 1-second countdown
 *     (`RUNUP.timerS`, everywhere: the match, the trial, a shootout). Tap
 *     before it runs out; if it runs out, you scuff it (`scuffStrike`).
 *  5. The kick itself is the same launch() as ever.
 *
 * ── The keeper during a penalty run-up: ONE decision ──
 *
 * The keeper brain (keeperBrain.ts, `brainRunUp`) may take one small hop
 * toward the side he reads from your arrow, on about half of kicks (a
 * little more for a better keeper). It is only a hop — it buys him no ground
 * — but it is his choice: if he dives, he dives that way, whatever you do
 * with your aim after it. A keeper who did not hop decides at the strike,
 * off your real kick. Either way the dive is the penalty rule set's
 * (penaltyKeeper.ts), thrown once by the brain. There is no second keeper
 * system here.
 *
 * A free kick keeps its own keeper and wall (kindRules/freeKick.ts), untouched.
 *
 * Pure: no React, no canvas. CanvasMatch wires it in.
 */
import type { Ball, Vec2 } from "./canvasEngine";
import { CX } from "./pitch";

export const RUNUP = {
  /**
   * Seconds from letting go of the aim to your boot reaching the ball.
   * Harry said "2 or 3". A real run-up of four to six strides takes about
   * 1.5-2.5 s. 2.4 s leaves time to react after the keeper's hop, and
   * doesn't drag.
   */
  runupS: 2.4,
  /** Where you start: this far back from the ball… */
  startBack: 3.4,
  /** …and this many degrees off the straight line behind it, to one side. */
  startAngleDeg: 32,
  /** Where your standing foot ends: beside and just behind the ball. */
  plantSide: 0.5,
  plantBack: 0.35,

  /** The nudge (penalties only): how far your aim can swing either way, metres along the goal line. */
  nudgeMaxM: 3.0,
  /**
   * How much finger it takes: 1.0 would move the aim exactly under your
   * finger across the goal; 1.5 needs half as much again, which is steadier
   * on a phone.
   */
  nudgeFingerRatio: 1.5,

  /** The strike screen's countdown for a penalty, seconds — the same everywhere.
   *  1.8 (was 1.0): Mikey, 28 Sep 2026, "make it 1.8 times slower… someone
   *  who's 55 should still be able to react… a penalty still favours the
   *  attacker." */
  timerS: 1.8,
  /** A free kick's countdown, seconds (Harry, 27 Sep 2026: "increase the
   *  timer on free kicks to around 3 seconds"). */
  freeKickTimerS: 3.0,

  /**
   * A scuff (the countdown ran out): this share of the power you set…
   * Re-tuned for the v0.15 keeper (who dives almost every time, once): the
   * prototype's 35 % / 10° still scored 63.5 % against 75.7 % for a proper
   * strike; 30 % / 18° scores 52.1 % (1,500 kicks, keeper 62 —
   * tests/star/penaltyRunup.mts).
   */
  scuffPower: 0.3,
  /** …and up to this many degrees off your line, either way. */
  scuffAngleDeg: 18,
} as const;

/** The dead balls you run up to: a penalty and a direct free kick. */
export function hasRunup(kind: string): boolean {
  return kind === "penalty" || kind === "free_kick";
}

/** Only a penalty lets you swing your aim during the run-up. */
export function canNudge(kind: string): boolean {
  return kind === "penalty";
}

// ── Where you walk ───────────────────────────────────────────────────────

export interface RunupPath { from: Vec2; to: Vec2 }

/** Straight back from the ball, away from the goal (the goal's centre is CX, 0). */
export function backDir(ball: Vec2): Vec2 {
  const dx = ball.x - CX, dy = ball.y;
  const L = Math.hypot(dx, dy);
  return L > 1e-6 ? { x: dx / L, y: dy / L } : { x: 0, y: 1 };
}

/**
 * Which side of the ball you run up from: the side the picture already put
 * you on, or your left — a right-footer's run-up — when it put you dead
 * behind it (a penalty always does: kindRules/penalty.ts).
 */
export function sideOf(ball: Vec2, player: Vec2): number {
  const b = backDir(ball);
  // Sideways = the back direction turned a quarter; + = to the right of a
  // taker facing the goal.
  const drawn = (player.x - ball.x) * b.y - (player.y - ball.y) * b.x;
  return Math.abs(drawn) > 0.2 ? Math.sign(drawn) : -1;
}

/** Where you stand before the run-up: a few steps back and to one side. */
export function standBack(ball: Vec2, player: Vec2): Vec2 {
  return standBackAt(ball, player, RUNUP.startBack, RUNUP.startAngleDeg);
}

/**
 * The same, `back` metres from the ball and `angleDeg` off the straight line
 * behind it — how far back and how wide a run-up STYLE starts
 * (lib/star/runupStyles.ts). `standBack` is this at the standard numbers.
 */
export function standBackAt(ball: Vec2, player: Vec2, back: number, angleDeg: number): Vec2 {
  const side = sideOf(ball, player);
  const b = backDir(ball);
  const a = (angleDeg * Math.PI) / 180;
  // Rotate "straight back" by the run-up angle toward your side.
  const s = side * Math.sin(a), c = Math.cos(a);
  const d = { x: b.x * c + b.y * s, y: b.y * c - b.x * s };
  return { x: ball.x + d.x * back, y: ball.y + d.y * back };
}

/** Where your standing foot lands: beside the ball, just behind it. */
export function plantBeside(ball: Vec2, player: Vec2): Vec2 {
  const side = sideOf(ball, player);
  const b = backDir(ball);
  return {
    x: ball.x + b.y * side * RUNUP.plantSide + b.x * RUNUP.plantBack,
    y: ball.y - b.x * side * RUNUP.plantSide + b.y * RUNUP.plantBack,
  };
}

/** Start a few steps back and to one side; finish with your standing foot beside the ball. */
export function runupPath(ball: Vec2, player: Vec2): RunupPath {
  return { from: standBack(ball, player), to: plantBeside(ball, player) };
}

/** Where you are `u` of the way through the run-up (0..1): a jog that sets off and slows to plant. */
export function playerAt(p: RunupPath, u: number): Vec2 {
  const t = Math.max(0, Math.min(1, u));
  // Ease in and out, but not all the way to a standstill at either end —
  // a run-up is a jog, not a glide.
  const e = 0.18 * t + 0.82 * (t * t * (3 - 2 * t));
  return { x: p.from.x + (p.to.x - p.from.x) * e, y: p.from.y + (p.to.y - p.from.y) * e };
}

// ── Where it's going ─────────────────────────────────────────────────────

/** Where a kick from `ball` along `dir` crosses the goal line. */
export function goalLineX(ball: Vec2, dir: Vec2): number {
  if (!(dir.y < -1e-6)) return ball.x + Math.sign(dir.x || 1) * 99;
  return ball.x + (dir.x / dir.y) * (0 - ball.y);
}

/** The aim swung so it crosses the goal line `nudgeM` further along. Unit length. */
export function nudgedDir(ball: Vec2, dir: Vec2, nudgeM: number): Vec2 {
  const x = goalLineX(ball, dir) + clamp(nudgeM, -RUNUP.nudgeMaxM, RUNUP.nudgeMaxM);
  const dx = x - ball.x, dy = 0 - ball.y, L = Math.hypot(dx, dy) || 1;
  return { x: dx / L, y: dy / L };
}

/**
 * Metres of nudge for a sideways finger movement of `dxPx` CSS pixels, on a
 * canvas `widthPx` wide showing `viewWidthM` metres of pitch.
 */
export function nudgeFromDrag(dxPx: number, widthPx: number, viewWidthM: number): number {
  if (!(widthPx > 0) || !(viewWidthM > 0)) return 0;
  return (dxPx / widthPx) * viewWidthM / RUNUP.nudgeFingerRatio;
}

// ── Too slow ─────────────────────────────────────────────────────────────

export interface Scuff {
  dir: Vec2;
  power: number;
  contact: { cx: number; cy: number };
  /** How far off your line it went, degrees (signed). */
  angleDeg: number;
}

/**
 * The countdown ran out: the game strikes it for you, badly. Under a third
 * of the power you set, up to 18° off your line, on the top half of the ball
 * (a low, toe-poked roller) somewhere across it — the same launch() as any
 * kick.
 */
export function scuffStrike(dir: Vec2, power: number, rng: () => number): Scuff {
  const angleDeg = (rng() * 2 - 1) * RUNUP.scuffAngleDeg;
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a), s = Math.sin(a);
  return {
    dir: { x: dir.x * c - dir.y * s, y: dir.x * s + dir.y * c },
    power: power * RUNUP.scuffPower,
    contact: { cx: (rng() * 2 - 1) * 0.6, cy: -0.5 - rng() * 0.4 },
    angleDeg,
  };
}

// ── Item 5r: a cheeky miss ───────────────────────────────────────────────

/** The middle third of the goal, metres either side of the centre. */
export const MIDDLE_HALF_WIDTH = 1.2;

export type CheekyKind = "penalty-middle" | "chip";

/**
 * A chip: struck soft and steep. Measured off launch(): a Panenka (40-45 %
 * power, under the ball) leaves at 12-14 m/s and climbs at 8-10 m/s; a
 * driven shot leaves at 20-30 m/s.
 */
export function isChip(ball: Ball): boolean {
  const h = Math.hypot(ball.vel.x, ball.vel.y);
  return h > 1 && h <= 18 && ball.vz >= 0.35 * h;
}

/**
 * What kind of "cheeky" strike this is, if any, the instant it's struck
 * (Harry's option (c)): a penalty chipped or driven down the middle, or a
 * chip at goal in open play. A free kick or a corner is a set piece, not
 * open play — lifting one over a wall is ordinary technique — so neither
 * counts. `centreX` is the middle of the goal.
 */
export function cheekyStrike(kind: string, ball: Ball, centreX: number, atGoal: boolean): CheekyKind | null {
  if (kind === "penalty") {
    if (isChip(ball)) return "chip";
    const x = goalLineX(ball.pos, ball.vel);
    return Math.abs(x - centreX) <= MIDDLE_HALF_WIDTH ? "penalty-middle" : null;
  }
  if (kind === "free_kick" || kind === "corner") return null;
  return atGoal && isChip(ball) ? "chip" : null;
}

/** A cheeky strike that didn't go in. */
export function isCheekyMiss(outcome: string): boolean {
  return outcome !== "goal" && outcome !== "rebound";
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
}

/** How long the strike screen gives you after a run-up, for this kind of kick. */
export function strikeTimerFor(kind: string | undefined): number {
  return kind === "free_kick" ? RUNUP.freeKickTimerS : RUNUP.timerS;
}
