import {
  freeKickDrill, visionDrill, strikeSpot, shotQuality,
  type FreeKickDrillConfig, type VisionDrillConfig,
} from "./trainingDrills";
import { difficultyFor, keeperBonusFor, type TrialProgress, type TrialStage } from "./trial";
import { CX, PEN_SPOT_Y } from "./pitch";

/**
 * THE FOUR STAGES BEFORE THE FIVE-A-SIDE.
 *
 * Penalties, free kicks, taking a man on, and finding the pass. What each one
 * ASKS of you, and what your attempt at it was WORTH — the numbers, with no
 * pictures. The screens read this; they do not decide any of it.
 *
 * ── Built on the ladders that already exist ──
 *
 * `trainingDrills.ts` already knows how to make a striking drill harder: how
 * far out to put the ball, how many men in the wall, how good the keeper is,
 * how long you get to pick a pass and how much better the right pass is than
 * the wrong one. Those ladders are tuned, they are already what training feels
 * like, and reusing them means the trial feels like the same game rather than
 * a separate one bolted onto the front of it.
 *
 * The one translation this file makes: a drill's ladder is indexed by YOUR
 * STAT (a vision-70 player gets the vision-70 drill). A trial is indexed by
 * how hard the DAY is — which is the same 0-1 scale pointed at a different
 * thing, so difficulty 0 asks the bottom rung of the ladder and difficulty 1
 * asks the top.
 *
 * ── Everything is scored relative to what was asked ──
 *
 * Each stage reports a 0-1 quality, never a pass/fail and never a score out of
 * a hundred. `trial.ts` applies the difficulty scaling on top; doing it here
 * as well would apply it twice, which is a mistake the five-a-side's own
 * scoring already made once and had to have measured out of it.
 */

/** A trial difficulty (0-1) as a rung on a drill's own ladder (0-100). */
export function ladderLevel(difficulty: number): number {
  return Math.max(0, Math.min(100, (Number.isFinite(difficulty) ? difficulty : 0) * 100));
}

/** How many attempts each stage gives you. Enough that one fluke neither makes
 *  nor breaks it; few enough that the whole trial is minutes, not an evening. */
export const REPS: Record<Exclude<TrialStage, "fiveASide">, number> = {
  penalties: 5,
  freeKicks: 4,
  dribbling: 3,
  vision: 6,
};

// ── 1. Penalties ────────────────────────────────────────────────────────

export interface PenaltySetup {
  /** Where the ball sits — the spot, always. */
  ball: { x: number; y: number };
  /** 0-100, how good the keeper is. */
  keeperStrength: number;
  /** Which way he is favouring, -1 left … 1 right. A keeper who guesses is
   *  what makes a penalty a decision rather than a formality; zero means he
   *  has not committed and you are simply picking a corner. */
  keeperLean: number;
}

/**
 * A penalty is the same kick every time, so difficulty lives entirely in the
 * keeper: how good he is, and whether he has read you.
 */
export function penaltySetup(trial: TrialProgress, rep: number): PenaltySetup {
  const d = difficultyFor(trial, "penalties");
  const bonus = keeperBonusFor(trial, "penalties");
  // Seeded off the trial and the rep, so the same penalty is the same penalty
  // however many times the app is closed and reopened.
  const wobble = Math.sin((trial.seed % 1000) + rep * 12.9898) * 43758.5453;
  const lean = (wobble - Math.floor(wobble)) * 2 - 1;
  return {
    ball: { x: CX, y: PEN_SPOT_Y },
    keeperStrength: Math.min(99, 45 + d * 45 + bonus),
    // He commits harder the better he is, which is what makes a good keeper
    // both easier to beat if you read him and harder if you do not.
    keeperLean: lean * (0.3 + d * 0.7),
  };
}

// ── 2. Free kicks ───────────────────────────────────────────────────────

export interface FreeKickSetup extends FreeKickDrillConfig {
  ball: { x: number; y: number };
}

export function freeKickSetup(trial: TrialProgress, rep: number): FreeKickSetup {
  const d = difficultyFor(trial, "freeKicks");
  const cfg = freeKickDrill(ladderLevel(d), rep);
  const withAdversity = {
    ...cfg,
    keeperStrength: Math.min(99, cfg.keeperStrength + keeperBonusFor(trial, "freeKicks")),
  };
  return { ...withAdversity, ball: strikeSpot(cfg.distance, cfg.offset) };
}

// ── 3. Taking a man on ──────────────────────────────────────────────────

export interface DribbleSetup {
  /** 0-100, fed straight to the first-person run. */
  oppStrength: number;
  /**
   * The waves, and therefore exactly how many men you face.
   *
   * Passed to the run rather than left to it. It used to only carry a total,
   * which was never handed over — so the run picked its own waves and the
   * scoring then divided the men you beat by a number unrelated to the men on
   * the screen. Beating everyone could score 0.72 while beating three of nine
   * scored 1.0. Caught in review.
   */
  waveSizes: number[];
  /** How many men that adds up to — what `dribbleQuality` divides by, and now
   *  genuinely the number you faced. */
  defenders: number;
}

/**
 * Deliberately thin, because the dribbling stage reuses the first-person run
 * UNMODIFIED. Everything about how it plays is already built and already
 * tuned; all a trial has to decide is who you are running at.
 */
export function dribbleSetup(trial: TrialProgress): DribbleSetup {
  const d = difficultyFor(trial, "dribbling");
  // Two to four waves, widening with the difficulty, capped at the run's own
  // ceiling of ten — a real match has eleven men and one of them is in goal.
  const waves = Math.round(2 + d * 2);
  const sizes: number[] = [];
  let total = 0;
  for (let i = 0; i < waves; i++) {
    const want = Math.max(1, Math.round(1 + d * 2 + (i === waves - 1 ? 1 : 0)));
    const room = Math.max(0, 10 - total);
    const take = Math.min(want, room);
    if (take <= 0) break;
    sizes.push(take);
    total += take;
  }
  return {
    oppStrength: 35 + d * 60,
    waveSizes: sizes,
    defenders: total,
  };
}

/** What a run was worth. `beaten` counts more than `cleared` on purpose: a man
 *  who takes on four and is stopped by the fifth has shown a scout more than
 *  one who walked through a gap. */
export function dribbleQuality(
  result: { cleared: boolean; beaten: number }, setup: DribbleSetup,
): number {
  const share = setup.defenders > 0 ? Math.min(1, result.beaten / setup.defenders) : 0;
  return Math.max(0, Math.min(1, share * 0.75 + (result.cleared ? 0.25 : 0)));
}

// ── 4. Finding the pass ─────────────────────────────────────────────────

export interface VisionSetup extends VisionDrillConfig {
  /** Which of the options is the right one. Seeded, so a reload cannot be
   *  used to see the answer and then restart. */
  correct: number;
}

export function visionSetup(trial: TrialProgress, rep: number): VisionSetup {
  const d = difficultyFor(trial, "vision");
  const cfg = visionDrill(ladderLevel(d), rep);
  const wobble = Math.sin((trial.seed % 997) * 7.13 + rep * 91.7) * 24634.6345;
  const pick = Math.floor((wobble - Math.floor(wobble)) * cfg.options);
  return { ...cfg, correct: Math.max(0, Math.min(cfg.options - 1, pick)) };
}

/**
 * What one pass was worth.
 *
 * Picking the right man is most of it, but not all of it: how quickly you saw
 * it counts too, because the whole point of the top of this ladder is that you
 * have under a second and the right ball is barely better than the wrong one.
 * Picking nothing at all scores zero — a scout learns nothing from a player
 * who never lifted his head.
 */
export function visionQuality(
  picked: number | null, setup: VisionSetup, tookSeconds: number,
): number {
  if (picked === null) return 0;
  if (picked !== setup.correct) {
    // A wrong pass is not worthless if it was at least a quick decision, but
    // it is close to it.
    return 0.08;
  }
  const speed = Math.max(0, Math.min(1, 1 - tookSeconds / Math.max(0.2, setup.window)));
  return Math.max(0, Math.min(1, 0.65 + speed * 0.35));
}

// ── Turning reps into the stage's own quality ───────────────────────────

/**
 * The mean of what you actually did.
 *
 * A mean rather than a best-of: a trial is watched, and a scout who sees one
 * good penalty and four bad ones has seen a player who scores one in five.
 */
export function meanQuality(reps: number[]): number {
  if (!reps.length) return 0;
  const clean = reps.map(q => (Number.isFinite(q) ? Math.max(0, Math.min(1, q)) : 0));
  return clean.reduce((s, q) => s + q, 0) / clean.length;
}

/** A struck-shot stage (penalties, free kicks) judges every attempt the same
 *  way, using the drills' own existing shot judgement. */
export function strikeQuality(outcome: string, crossX: number | null): number {
  return shotQuality(outcome, crossX);
}
