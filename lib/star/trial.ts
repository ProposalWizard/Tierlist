import { mulberry32 } from "./season";

/**
 * THE TRIAL — one afternoon that decides who, if anybody, signs you.
 *
 * The career used to open on a single penalty you took until it went in. You
 * could not fail it, it asked nothing of you, and it told the clubs watching
 * absolutely nothing — everybody arrived at the same club on the same wage
 * however they had played.
 *
 * A trial is five stages on the live match engine, each scored on how well
 * you did RELATIVE TO WHAT YOU WERE ASKED FOR, and one number at the end
 * that decides who comes in for you. Fail it badly enough and nobody does
 * (see §3.7 of STAR_CAREER_OPENING_AND_ECONOMY.md — the free-agent life).
 *
 * ── Everything random is seeded and stored ──
 *
 * The whole point of a difficulty roll is that it was not chosen by you. If
 * the roll happened live, closing the app and re-opening it would re-roll it,
 * and the optimal way to play would be to keep re-opening until the trial was
 * easy. So: one seed on the career, every roll derived from it, nothing
 * regenerated.
 *
 * ── Closing the app is not cheating, but farming it costs ──
 *
 * Decided directly, and it is worth quoting because it shaped the design:
 *
 *   "The more important thing from a refresh is that they don't lose
 *    progress. If people want to cheat we shouldn't necessarily stop them,
 *    but it should be difficult — maybe if someone refreshes more than once
 *    in a trial the difficulty gets bumped. If people are trying to cheat to
 *    get a better start, that means the game is pretty cool."
 *
 * So there is no lockout and no "you have already had your go". You come back
 * to exactly where you were. But `reloads` counts, and every resume past the
 * first quietly makes the rest of the trial harder — never announced, never
 * explained, capped so somebody who genuinely lost signal twice pays almost
 * nothing. See `difficultyFor`.
 */

export type TrialStage = "penalties" | "freeKicks" | "dribbling" | "vision" | "fiveASide";

/** The order they are played in, and the order the sequencer walks. */
export const TRIAL_STAGES: TrialStage[] = [
  "penalties", "freeKicks", "dribbling", "vision", "fiveASide",
];

export const STAGE_LABEL: Record<TrialStage, string> = {
  penalties: "Penalties",
  freeKicks: "Free kicks",
  dribbling: "Take him on",
  vision: "Find the pass",
  fiveASide: "Five-a-side",
};

/**
 * The one adversity event v1 ships, and why it is one rather than six.
 *
 * An earlier draft listed six — a heavy pitch, a hostile crowd, playing out
 * of position, and so on. Checked against the code, two of them had no
 * plumbing at all: nothing in the trial or the drills passes conditions to
 * any engine call, so "heavy pitch" is new plumbing in two components before
 * it is a feature. "The keeper is better than he should be" is a single
 * existing field (`keeperStrength`, already the dial every striking drill
 * turns), so it is real today. More can follow once the trial has shipped.
 */
export type TrialAdversity = "sharp-keeper" | null;

/** How much a sharp keeper is worth, in the same 0-100 units every drill's
 *  own ladder already speaks. */
export const SHARP_KEEPER_BONUS = 15;

export interface TrialStageResult {
  /** 0-1, how well you actually did. Raw performance, before difficulty. */
  quality: number;
  /** 0-1, what was asked of you — stored so a stage's score can be explained
   *  afterwards rather than being an unexplained number. */
  difficulty: number;
  /** 0-100, `quality` scaled by what it was worth. See `stageScore`. */
  score: number;
  decidedAt: number;
}

export interface TrialProgress {
  seed: number;
  /** 0-1, rolled once for the whole trial. */
  baseDifficulty: number;
  /** Per-stage offset from the base, so one trial can be easy on penalties
   *  and hard on the five-a-side rather than uniformly hard. */
  stageRolls: Record<TrialStage, number>;
  results: Partial<Record<TrialStage, TrialStageResult>>;
  adversity: TrialAdversity;
  /** Which stage the adversity lands on. A sharp keeper means nothing in the
   *  dribbling stage, so it is rolled onto a stage where it bites. */
  adversityStage: TrialStage | null;
  /** How many times this trial has been resumed. See the note above. */
  reloads: number;
  startedAt: number;
  /**
   * A five-a-side left half-played.
   *
   * The only stage long enough that closing the app in the MIDDLE of it costs
   * anything worth keeping — the other four are a handful of attempts you
   * would simply take again. Written at the end of every touch, so coming back
   * puts you on the same scoreline with the same clock rather than kicking off
   * again.
   *
   * Typed loosely on purpose: `lib/star/fiveASide/match.ts` imports from the
   * canvas engine, and making this file depend on all of that to name one
   * field would drag the whole match engine into everything that reads a
   * trial. The one place it is actually used narrows it.
   */
  fiveASide?: unknown;
}

/**
 * 0-1, and never NaN.
 *
 * The non-finite guard is not defensive padding — these numbers are written
 * onto the career and saved. `Math.max(0, Math.min(1, NaN))` is NaN, and a
 * NaN score would survive JSON, come back as `null` on the next load, and
 * quietly poison every average computed from it. A stage that somehow
 * produced nonsense should read as "you did nothing", which is at least a
 * true statement about a stage that did not work.
 */
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);

/**
 * Each resume past the first makes the trial this much harder, capped.
 *
 * Deliberately small and deliberately capped: at +0.03 a go, somebody whose
 * train went into a tunnel twice is playing a trial 3 % harder, which is
 * nothing. Somebody re-opening the app fifteen times to farm an easy roll
 * hits the cap and is playing a meaningfully harder afternoon than they
 * would have had if they had just played it.
 */
export const RELOAD_DIFFICULTY_STEP = 0.03;
export const RELOAD_DIFFICULTY_CAP = 0.15;

/**
 * A brand-new trial. Everything it will ever need to know is decided here,
 * from the seed, and never rolled again.
 *
 * The seed itself is the one genuinely live value — it has to be, or every
 * player in the world would get the same trial. It is stored the instant it
 * is drawn, which is what makes everything downstream reproducible.
 */
export function startTrial(seed: number = Math.floor(Math.random() * 0xffffffff)): TrialProgress {
  const rng = mulberry32(seed);

  // A trial is usually a fair test and occasionally a brutal one. The exponent
  // (1.6, not 2 — an earlier comment here said "squared" and was simply wrong)
  // leans the distribution easy-to-middling while leaving a real tail: most
  // trials are winnable, a few are the afternoon you were unlucky to draw.
  const baseDifficulty = clamp01(Math.pow(rng(), 1.6));

  const stageRolls = {} as Record<TrialStage, number>;
  for (const stage of TRIAL_STAGES) {
    // ±0.2 around the base. Wide enough that a trial has a shape — a stage
    // you found hard and one you breezed — without any stage escaping the
    // afternoon's overall character.
    stageRolls[stage] = (rng() - 0.5) * 0.4;
  }

  // Roughly a third of trials have something go against you.
  const adversity: TrialAdversity = rng() < 0.34 ? "sharp-keeper" : null;
  // Only the stages where a keeper actually stands between you and the goal.
  const keeperStages: TrialStage[] = ["penalties", "freeKicks", "fiveASide"];
  const adversityStage = adversity
    ? keeperStages[Math.floor(rng() * keeperStages.length)]
    : null;

  return {
    seed,
    baseDifficulty,
    stageRolls,
    results: {},
    adversity,
    adversityStage,
    reloads: 0,
    startedAt: Date.now(),
  };
}

/**
 * How hard a given stage is, all in: the trial's own character, this stage's
 * own roll, and whatever the player has added by re-opening the app.
 */
export function difficultyFor(trial: TrialProgress, stage: TrialStage): number {
  const reloadBump = Math.min(
    RELOAD_DIFFICULTY_CAP,
    Math.max(0, trial.reloads) * RELOAD_DIFFICULTY_STEP,
  );
  return clamp01(trial.baseDifficulty + (trial.stageRolls[stage] ?? 0) + reloadBump);
}

/** Whether a sharp keeper is standing in this particular stage. */
export function keeperBonusFor(trial: TrialProgress, stage: TrialStage): number {
  return trial.adversity === "sharp-keeper" && trial.adversityStage === stage
    ? SHARP_KEEPER_BONUS
    : 0;
}

/**
 * What a stage was worth.
 *
 * The shape §3.3 asks for, and the reason difficulty is stored rather than
 * discarded: **the score is performance relative to what was asked.** The
 * same finish is worth more against a keeper who was always going to save it,
 * and a miss costs less when the chance was never really on. At d = 0 a
 * perfect stage is worth 70; at d = 1 it is worth the full 100 — so a good
 * trial on an easy afternoon can still be beaten by a good trial on a hard
 * one, which is the whole point.
 */
export function stageScore(quality: number, difficulty: number): number {
  return Math.round(100 * clamp01(clamp01(quality) * (0.70 + 0.60 * clamp01(difficulty))));
}

/**
 * Write a stage's result onto the trial, the moment it is decided.
 *
 * **Idempotent on purpose.** This is what makes closing the app safe: the
 * result is already on the career before the next screen renders, so there is
 * nothing in flight to lose. A second call for a stage that already has a
 * result returns the trial untouched rather than overwriting it — so a resume
 * cannot quietly replace a bad score with a better one, and a double-fired
 * callback cannot either.
 */
export function recordStage(
  trial: TrialProgress, stage: TrialStage, quality: number,
): TrialProgress {
  if (trial.results[stage]) return trial;
  const difficulty = difficultyFor(trial, stage);
  return {
    ...trial,
    results: {
      ...trial.results,
      [stage]: {
        quality: clamp01(quality),
        difficulty,
        score: stageScore(quality, difficulty),
        decidedAt: Date.now(),
      },
    },
  };
}

/** Count a resume. See the note at the top of the file. */
export function noteReload(trial: TrialProgress): TrialProgress {
  return { ...trial, reloads: trial.reloads + 1 };
}

/** The first stage with no result yet, or null when the trial is over. */
export function nextStage(trial: TrialProgress): TrialStage | null {
  return TRIAL_STAGES.find(s => !trial.results[s]) ?? null;
}

export function trialComplete(trial: TrialProgress): boolean {
  return nextStage(trial) === null;
}

/**
 * The number the whole afternoon comes down to, 0-100 — what the watching
 * clubs actually saw.
 *
 * Every stage counts the same. That was a real choice: weighting the
 * five-a-side higher is tempting because it is the most football-like stage,
 * but it would make the other four feel like a warm-up you have to sit
 * through, and they are the stages that most directly test the five trained
 * stats. An unplayed stage counts as nothing rather than being skipped, so a
 * trial abandoned three stages in scores like a trial three-fifths played —
 * which it was.
 */
export function trialScore(trial: TrialProgress): number {
  const total = TRIAL_STAGES.reduce((sum, s) => sum + (trial.results[s]?.score ?? 0), 0);
  return Math.round(total / TRIAL_STAGES.length);
}
