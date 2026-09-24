/**
 * THE PENALTY KEEPER READS YOUR KICK.
 *
 * Harry, 24 Sep 2026, choosing to put the trial keeper's guess into the real
 * game: *"yes but it needs work — the goalie should only start moving right
 * before the ball is released, based on where you aimed, with a percent
 * chance of diving the wrong way — not just spawn on the wrong side."*
 *
 * ── Why a penalty keeper has to move at all ──
 *
 * The engine only tests a save when the ball reaches the keeper's own line,
 * and until then nothing moves him. On a penalty that test is a static
 * "how far from where he stands", and measured on the real engine a strip
 * about 1.0-1.3 m inside each post cannot be saved at ANY keeper rating: a
 * corner converted 92 % against 64-71 % for the same shot in a one-on-one
 * (trialStages.ts, penaltyCommit, n = 250 a cell).
 *
 * ── What he does ──
 *
 * He stands in the middle until you strike it. At the strike he makes his
 * decision — `commitChance` that he goes at all, then `readChance` that he
 * goes the way you actually aimed (otherwise the other way) — and travels
 * `metres` along his line while the ball is in flight, using the engine's own
 * scramble movement (`scrambling`/`targetX`, public fields; canvasEngine.ts is
 * not touched). A shot aimed at him gets a coin-flip side if he goes.
 *
 * The distance is the trial's own measured 1.4 m: far enough that a correct
 * read puts the corner at the edge of his reach, short enough that he never
 * abandons the middle, so placement still means something. How OFTEN he goes
 * and how well he READS are the dials — and the ones a harder trial turns up.
 *
 * Pure: no React, no canvas. The random draw is handed in, so a goal replay
 * can apply the exact same decision again (see GoalReplay.penaltyRead).
 */
import type { Ball, Scenario } from "./canvasEngine";

export interface PenaltyReadSettings {
  /** Chance he moves at all before the ball reaches him. */
  commitChance: number;
  /** Given he goes: chance he goes the side you aimed. */
  readChance: number;
  /** How far along his line he travels. */
  metres: number;
}

/**
 * The real game's keeper, at a typical rating. Measured on the real engine
 * (tests/star/penaltyKeeper.mts): see that file's own table for what each
 * setting does to a corner, a shot 2 m out and a shot down the middle.
 */
export const PENALTY_READ_DEFAULT: PenaltyReadSettings = {
  commitChance: 0.8,
  readChance: 0.6,
  metres: 1.4,
};

/**
 * A better keeper reads you better — never perfectly, never worse than a coin
 * flip. +/- 0.1 across the rating range, centred on 62 (the engine's own
 * default keeper). An override (a harder trial rep) replaces any field.
 */
export function penaltyReadFor(keeperStrength: number, override?: Partial<PenaltyReadSettings>): PenaltyReadSettings {
  const k = Math.max(20, Math.min(99, Number.isFinite(keeperStrength) ? keeperStrength : 62));
  const base = {
    ...PENALTY_READ_DEFAULT,
    readChance: Math.max(0.5, Math.min(0.85, PENALTY_READ_DEFAULT.readChance + (k - 62) / 370)),
  };
  return {
    commitChance: clamp01(override?.commitChance ?? base.commitChance),
    readChance: clamp01(override?.readChance ?? base.readChance),
    metres: Math.max(0, Math.min(3.2, override?.metres ?? base.metres)),
  };
}

/** Where a struck ball is heading on the goal line — "where you aimed". */
export function aimedCrossX(ball: Ball): number {
  if (!(ball.vel.y < -0.01)) return ball.pos.x;
  return ball.pos.x + (ball.vel.x / ball.vel.y) * (0 - ball.pos.y);
}

/** What he decided, so a replay can do exactly the same. */
export interface PenaltyReadDecision {
  went: boolean;
  /** -1 left, +1 right (pitch x). 0 when he stayed. */
  side: number;
  /** Whether that was the side the ball is going. */
  correct: boolean;
  metres: number;
}

/**
 * Decide, at the strike. `roll` is two uniform draws in [0,1): whether he
 * goes, and whether he reads you. A shot aimed within half a metre of him has
 * no side to read, so the second draw picks one at random.
 */
export function decidePenaltyRead(sc: Scenario, ball: Ball, s: PenaltyReadSettings, roll: [number, number]): PenaltyReadDecision {
  const k = sc.keeper;
  if (k.done || !(s.metres > 0) || roll[0] >= s.commitChance) return { went: false, side: 0, correct: false, metres: 0 };
  const off = aimedCrossX(ball) - k.startX;
  const aimedSide = Math.abs(off) < 0.5 ? 0 : Math.sign(off);
  let side: number;
  let correct: boolean;
  if (aimedSide === 0) {
    side = roll[1] < 0.5 ? -1 : 1;
    correct = false;
  } else {
    correct = roll[1] < s.readChance;
    side = correct ? aimedSide : -aimedSide;
  }
  return { went: true, side, correct, metres: s.metres };
}

/** Set him going — the same fields the engine's own scramble uses. */
export function applyPenaltyRead(sc: Scenario, d: PenaltyReadDecision): void {
  const k = sc.keeper;
  if (!d.went || k.done) return;
  k.targetX = k.startX + d.side * d.metres;
  k.scrambling = true;
  k.saveDir = d.side;
  if (k.saveLunge <= 0) k.saveLunge = 0.001;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}
