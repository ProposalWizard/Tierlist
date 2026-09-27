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
 * along his line while the ball is in flight, using the engine's own scramble
 * movement (`scrambling`/`targetX`, public fields; canvasEngine.ts is not
 * touched). A shot aimed at him gets a coin-flip side if he goes.
 *
 * ── The real match's keeper: the Premier League ruleset (26 Sep 2026) ──
 *
 * Harry's research: Premier League keepers save 17.7 % of penalties all-time
 * (407 / 2,296), 7.5 % in 2023/24; misses are rare. Keepers dive to one side
 * almost every time and guess (or read the body) rather than react to the ball,
 * so a shot down the middle scores about as often as one to the corner. The
 * old real-match keeper (goes 80 %, reads 60 %, travels a fixed 1.4 m) let in
 * 41 % of a realistic spread of penalties and was a wall down the middle
 * (13 %). This one:
 *
 *   - goes 96 % of the time, so the middle is usually open — and a chipped
 *     Panenka is caught when he is the one in twenty-five who stays;
 *   - reads you about as well as a real keeper does: roughly a coin flip, a
 *     little better for a good one (`readChance`);
 *   - dives a real distance, a different one every time — anywhere from 1 m
 *     to about 2.5 m of travel (`shortest`..`metres`), at the engine's own
 *     dive pace, so a hard shot beats a long dive before he has finished it;
 *   - while committed, only saves what his body gets to (`reach`): a man who
 *     has thrown himself one way cannot stretch back the other.
 *
 * So guessing right is often, not always, a save, and guessing wrong is a
 * goal. Measured on the real engine in tests/star/penaltyKeeper.mts.
 *
 * ── The trial keeper stays the old, harder one ──
 *
 * The trial is harder on purpose and ramps rep by rep through `commitChance`
 * and `readChance` (trialStages.ts, penaltyReadForTrial). Anything that passes
 * an override is built on the OLD keeper (`PENALTY_READ_TRIAL`: a fixed 1.4 m
 * dive at full reach), so the trial plays exactly as it did.
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
  /** How far along his line he travels — the LONGEST dive, when `shortest` is set. */
  metres: number;
  /**
   * The shortest dive. When set, each dive's length is drawn between this and
   * `metres` (a keeper does not land on the same spot every time). Absent =
   * always exactly `metres`, the old fixed dive.
   */
  shortest?: number;
  /**
   * His save radius while committed to a dive, as a share of the engine's own
   * (`Scenario.keeperReach`). Absent = 1, the old keeper.
   */
  reach?: number;
}

/**
 * The real game's keeper at a typical rating (62). See `penaltyReadFor` for how
 * the rating moves it, and tests/star/penaltyKeeper.mts for what it measures.
 */
export const PENALTY_READ_DEFAULT: PenaltyReadSettings = {
  commitChance: 0.96,
  readChance: 0.5,
  shortest: 1.0,
  metres: 2.5,
  reach: 0.35,
};

/**
 * The keeper a trial's override is built on: the old real-match keeper, which
 * the trial's own dials were measured against. Kept so the trial stays exactly
 * as hard as it was.
 */
export const PENALTY_READ_TRIAL: PenaltyReadSettings = {
  commitChance: 0.8,
  readChance: 0.6,
  metres: 1.4,
};

/**
 * The keeper for this rating.
 *
 * Real match (no override): a better keeper reads you a little better (0.50 at
 * 62 and below → 0.59 at 85, never worse than a coin flip) and his longest
 * dive covers more ground (2.17 m at 40 → 2.5 m at 62 → 2.85 m at 85). His
 * save radius already grows with his rating inside the engine.
 *
 * A trial (an override): the old keeper, `PENALTY_READ_TRIAL`, with his read
 * nudged +/- 0.1 across the rating range and whatever the override sets
 * replacing it field by field.
 */
export function penaltyReadFor(keeperStrength: number, override?: Partial<PenaltyReadSettings>): PenaltyReadSettings {
  const k = Math.max(20, Math.min(99, Number.isFinite(keeperStrength) ? keeperStrength : 62));
  if (!override) {
    const d = PENALTY_READ_DEFAULT;
    return {
      commitChance: d.commitChance,
      readChance: Math.max(0.5, Math.min(0.65, d.readChance + (k - 62) / 250)),
      shortest: d.shortest,
      metres: Math.max(2.0, Math.min(3.0, d.metres + (k - 62) * 0.015)),
      reach: d.reach,
    };
  }
  const base: PenaltyReadSettings = {
    ...PENALTY_READ_TRIAL,
    readChance: Math.max(0.5, Math.min(0.85, PENALTY_READ_TRIAL.readChance + (k - 62) / 370)),
  };
  const s: PenaltyReadSettings = {
    commitChance: clamp01(override.commitChance ?? base.commitChance),
    readChance: clamp01(override.readChance ?? base.readChance),
    metres: Math.max(0, Math.min(3.2, override.metres ?? base.metres)),
  };
  if (override.shortest !== undefined) s.shortest = Math.max(0, Math.min(s.metres, override.shortest));
  if (override.reach !== undefined) s.reach = Math.max(0.1, Math.min(1, override.reach));
  return s;
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
  /** Save radius while diving, as a share of the engine's own. Absent = 1. */
  reach?: number;
}

/**
 * Decide, at the strike. `roll` is two uniform draws in [0,1): whether he
 * goes, and whether he reads you. A shot aimed within half a metre of him has
 * no side to read, so the second draw picks one at random.
 *
 * How far this dive goes reuses the first draw: given he went (roll[0] <
 * commitChance), roll[0] / commitChance is itself uniform and independent of
 * the side draw — so no third random number is needed, and a replay that
 * saved the decision reproduces it exactly.
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
  const lo = s.shortest ?? s.metres;
  const metres = lo + (roll[0] / s.commitChance) * (s.metres - lo);
  const d: PenaltyReadDecision = { went: true, side, correct, metres };
  if (s.reach !== undefined && s.reach !== 1) d.reach = s.reach;
  return d;
}

/** Set him going — the same fields the engine's own scramble uses. */
export function applyPenaltyRead(sc: Scenario, d: PenaltyReadDecision): void {
  const k = sc.keeper;
  if (!d.went || k.done) return;
  k.targetX = k.startX + d.side * d.metres;
  k.scrambling = true;
  k.saveDir = d.side;
  if (k.saveLunge <= 0) k.saveLunge = 0.001;
  // Committed one way, he can't stretch back the other. Only set while he is
  // actually diving: a keeper who stays keeps his full reach.
  if (d.reach !== undefined && Number.isFinite(d.reach) && d.reach > 0) sc.keeperReach = d.reach;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}
