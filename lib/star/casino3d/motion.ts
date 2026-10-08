/**
 * HOW THE 3D CASINO'S GAMES MOVE — pure maths, no three.js (Harry, 8 Oct
 * 2026: "the next part of the 3D casino is having the games actually run
 * in 3D").
 *
 * The result of every round is rolled FIRST, by the same rules the flat
 * casino uses (lib/star/casinoRounds.ts → casinoRules.ts). These functions
 * then work out a path for the ball, the reels or the horses that ENDS on
 * that result. Nothing here decides anything: physics never picks the
 * winner. tests/star/casino3dGames.mts checks every path lands where the
 * roll said.
 *
 * Angles: the wheel and the reels count round in radians. A roulette
 * pocket's angle is measured on the wheel itself (it turns with the wheel);
 * the ball's angle `phi` is measured the same way, so "the ball is in pocket
 * n" is simply phi = pocketAngle(n).
 */
import { ROULETTE_ORDER, SLOTS_SYMBOLS } from "../casinoRules";

const TAU = Math.PI * 2;
const mod = (a: number, m = TAU) => ((a % m) + m) % m;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

// ═══════════════════════════════════════════════════════════════════════
//  ROULETTE
// ═══════════════════════════════════════════════════════════════════════

export const POCKET_STEP = TAU / ROULETTE_ORDER.length;

/** The angle of the middle of number n's pocket, on the wheel. */
export function pocketAngle(n: number): number {
  return (ROULETTE_ORDER.indexOf(n) + 0.5) * POCKET_STEP;
}

/** The number whose pocket sits at angle a on the wheel. */
export function pocketAt(a: number): number {
  return ROULETTE_ORDER[Math.floor(mod(a) / POCKET_STEP) % ROULETTE_ORDER.length];
}

export interface BallPlan {
  winner: number;
  phi0: number;
  phiEnd: number;
  /** Seconds from the throw to the ball at rest in its pocket. */
  T: number;
  trackR: number;
  pocketR: number;
}

/** The ball's path, thrown from angle phi0 (on the wheel), to rest in `winner`'s pocket. */
export function planBall(winner: number, phi0: number, o: { T?: number; revs?: number; trackR: number; pocketR: number }): BallPlan {
  const T = o.T ?? 5;
  const revs = o.revs ?? 7;
  // the ball runs the other way to the wheel: phi only goes down
  let end = pocketAngle(winner) + Math.floor(phi0 / TAU) * TAU;
  while (end > phi0 - revs * TAU) end -= TAU;
  return { winner, phi0, phiEnd: end, T, trackR: o.trackR, pocketR: o.pocketR };
}

/** Slows all the way to a stop at u = 1. */
const easeOut = (u: number) => 1 - Math.pow(1 - clamp01(u), 2.6);
const DROP = 0.58, SETTLE = 0.9;

/**
 * Where the ball is, t seconds after the throw: its angle on the wheel, its
 * distance from the middle and its height above the pockets. It runs round
 * the outer track, drops in at about 3 s, hops twice or three times across
 * the frets, and is still in its pocket from 90% of the way on.
 */
export function ballAt(p: BallPlan, t: number): { phi: number; r: number; y: number } {
  const u = clamp01(t / p.T);
  // it has reached its pocket by SETTLE, and rides round with the wheel after
  let phi = p.phi0 + (p.phiEnd - p.phi0) * easeOut(u / SETTLE);
  if (u < DROP) return { phi, r: p.trackR, y: 0.03 };
  if (u >= SETTLE) return { phi, r: p.pocketR, y: 0 };
  const v = (u - DROP) / (SETTLE - DROP);
  const fade = (1 - v) * (1 - v);
  const hop = Math.abs(Math.sin(v * Math.PI * 3)) * fade;
  phi += 0.16 * Math.sin(v * Math.PI * 3) * fade;
  const s = v * v * (3 - 2 * v);
  const r = p.trackR + (p.pocketR - p.trackR) * s + 0.035 * hop;
  return { phi, r, y: 0.03 * (1 - s) + 0.05 * hop };
}

// ═══════════════════════════════════════════════════════════════════════
//  SLOTS — a reel is a drum with the six symbols round it
// ═══════════════════════════════════════════════════════════════════════

export const REEL_FACES = SLOTS_SYMBOLS.length;
export const FACE_STEP = TAU / REEL_FACES;

/** The drum angle that shows face k square on in the window. */
export function faceAngle(k: number): number {
  return (k + 0.5) * FACE_STEP;
}

/** The face square on at drum angle a. */
export function faceAt(a: number): number {
  return Math.floor(mod(a) / FACE_STEP) % REEL_FACES;
}

export interface ReelPlan { phi0: number; speed: number; tStop: number; slow: number; brakeAt: number; end: number; symbol: number }

/** One reel: spins at `speed` (radians a second) from phi0, and comes to
 *  rest on `symbol` (an index of SLOTS_SYMBOLS) at tStop. */
export function planReel(symbol: number, phi0: number, tStop: number, speed = 22, slow = 0.55): ReelPlan {
  const brakeAt = phi0 + speed * (tStop - slow);
  // the first copy of the face far enough on to brake into smoothly (the
  // braking curve below never runs backwards for these distances)
  const minEnd = brakeAt + speed * slow * 0.5;
  const end = faceAngle(symbol) + Math.ceil((minEnd - faceAngle(symbol)) / TAU) * TAU;
  return { phi0, speed, tStop, slow, brakeAt, end, symbol };
}

/** The drum's angle t seconds after the pull: full speed, a braking curve
 *  that lands exactly on the face, then a little settle. */
export function reelAt(p: ReelPlan, t: number): number {
  const t0 = p.tStop - p.slow;
  if (t <= t0) return p.phi0 + p.speed * t;
  if (t < p.tStop) {
    // a cubic from (brakeAt, speed) to (end, 0)
    const s = (t - t0) / p.slow, D = p.end - p.brakeAt;
    const m0 = (p.speed * p.slow) / D;
    const h = (s ** 3 - 2 * s ** 2 + s) * m0 + (-2 * s ** 3 + 3 * s ** 2);
    return p.brakeAt + D * h;
  }
  const k = (t - p.tStop) / 0.22;
  if (k >= 1) return p.end;
  return p.end - 0.09 * Math.sin(Math.PI * k) * (1 - k);
}

// ═══════════════════════════════════════════════════════════════════════
//  HORSE RACING — the order the roll gave, run out on the big screen
// ═══════════════════════════════════════════════════════════════════════

/**
 * How long each horse takes to the line: the best score is the quickest
 * (the flat race's lanesFrom, twice as long so it can be watched).
 */
export function raceDurations(scores: readonly number[]): number[] {
  const lo = Math.min(...scores), hi = Math.max(...scores);
  return scores.map((s) => 7.2 - (hi > lo ? (s - lo) / (hi - lo) : 0.5) * 2.8);
}

/**
 * How far along the track a horse is (0 start, 1 the line). Each horse has
 * its own surge (`wobble`, −1 to 1, never enough to go backwards), so the
 * lead changes in the middle, but every horse reaches the line exactly at
 * its own time — so they cross in the order the roll gave.
 */
export function horseAt(t: number, duration: number, wobble: number): number {
  const s = clamp01(t / duration);
  // wobble is -1..1; at 0.25 the pace never drops below 1 - 0.25π > 0
  return Math.min(1, s + Math.max(-1, Math.min(1, wobble)) * 0.25 * Math.sin(Math.PI * s));
}

/** The order horses cross the line in (indexes), by the durations above. */
export function crossingOrder(durations: readonly number[]): number[] {
  return durations.map((d, i) => [d, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, i]) => i);
}

// ═══════════════════════════════════════════════════════════════════════
//  BLACKJACK — where each card lies on the felt (table-local metres)
// ═══════════════════════════════════════════════════════════════════════

/** Card i of a hand of n: yours near your edge, the dealer's near him. */
export function cardSpot(who: "player" | "dealer", i: number, n: number): { x: number; z: number; ry: number } {
  const gap = 0.17;
  const x = (i - (n - 1) / 2) * gap;
  return who === "player" ? { x, z: 0.98, ry: (i - (n - 1) / 2) * -0.04 } : { x, z: 0.46, ry: 0 };
}
