import { mulberry32 } from "./season";

/**
 * THE TRIAL — one afternoon that decides who, if anybody, signs you.
 *
 * The career used to open on a single penalty you took until it went in. You
 * could not fail it, it asked nothing of you, and it told the clubs watching
 * absolutely nothing — everybody arrived at the same club on the same wage
 * however they had played.
 *
 * A trial is five stages on the live match engine, each scored on HOW WELL
 * YOU DID, against an afternoon whose difficulty decides how hard doing well
 * was — and one number at the end that decides who comes in for you. Fail it
 * badly enough and nobody does (see §3.7 of
 * STAR_CAREER_OPENING_AND_ECONOMY.md — the free-agent life).
 *
 * That is a correction of the original "scored relative to what you were
 * asked for", which had difficulty re-pricing the result as well as setting
 * it, and so put the top of the ladder out of reach on an easy roll and made
 * the top quarter of skill invisible on a hard one. `stageScore` carries the
 * full account and the measurements.
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
 *
 * **That anti-cheat used to run backwards, and this is the fix.** The reload
 * bump went into `difficultyFor`, and `stageScore` multiplied every stage by
 * its difficulty — so each resume raised the multiplier on every stage still
 * to come. Measured on seed 0: perfect play with ten resumes scored 81, the
 * same perfect play with none scored 73. Farming the app was worth +8. The
 * bump now goes only where it belongs — into what the stage ASKS, which the
 * drills read — and is kept out of the score entirely (`scoringDifficultyFor`).
 * What a resume costs instead is a straight haircut on the quality recorded
 * (`reloadQualityHaircut`), so it can only ever subtract.
 *
 * ── A resume is only a resume if it interrupted something ──
 *
 * `noteReload` used to charge for any load of an unfinished trial. Two of
 * those are innocent and were being billed anyway: the very first load after
 * career creation (nothing has been played yet — there is nothing to retry),
 * and a phone evicting a backgrounded tab, which iOS does routinely. A charge
 * now needs a stage genuinely under way with no result yet — see
 * `resumeInterrupted`, which says exactly how much of that is provable today
 * and what is still missing.
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
  /**
   * 0-1, how well you actually did — after `reloadQualityHaircut` and before
   * anything to do with difficulty.
   *
   * The haircut is folded in here rather than applied to the score on its own
   * so that the three stored numbers still explain each other: `score` is
   * exactly `stageScore(quality, difficulty-without-the-reload-bump)`. A
   * result that could not be recomputed from its own fields is a result
   * nobody can check.
   */
  quality: number;
  /**
   * 0-1, what was asked of you — the full figure the drills were actually
   * built from, reload bump included, so the result card's "they made that
   * hard" line is telling the truth about the afternoon you played.
   *
   * Deliberately NOT what the score was computed from: see `stageScore` and
   * `scoringDifficultyFor` for why those are two different numbers now.
   */
  difficulty: number;
  /** 0-100, what the watching clubs saw. See `stageScore`. */
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
  /**
   * How many resumes were CHARGED for. See the note above and
   * `resumeInterrupted` — a load that interrupted nothing is not one of
   * these. This is the number `difficultyFor` and `reloadQualityHaircut`
   * both read, and the only one that costs the player anything.
   */
  reloads: number;
  /**
   * How many resumes were SEEN, charged or not.
   *
   * Kept separately because "was this trial ever loaded before" is the one
   * thing that tells an untouched trial's first load (career just created,
   * innocent) apart from its second (you have been sitting inside stage one
   * and walked out of it). Optional: a trial saved before this existed simply
   * has none, and reads as zero.
   */
  resumes?: number;
  /**
   * Which stage the player is actually INSIDE, if any — `null` between
   * stages, absent when nobody has said.
   *
   * The precise version of "did this resume interrupt anything". Set by
   * `beginStage` when a stage screen opens, cleared by `recordStage`.
   *
   * **Nothing sets it yet.** `components/star/TrialSequence.tsx` is the one
   * place that knows a stage screen has opened, and it is not this file's to
   * edit; until it calls `beginStage`, `resumeInterrupted` falls back to what
   * the trial's own data can prove (see there). The fallback gets the
   * first-load case right and the backgrounded-tab case wrong, which is the
   * whole reason this field exists.
   */
  inProgress?: TrialStage | null;
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
 * Each charged resume makes the trial this much harder, capped.
 *
 * Deliberately small and deliberately capped: at +0.03 a go, somebody whose
 * train went into a tunnel twice is playing a trial 3 % harder, which is
 * nothing. Somebody re-opening the app fifteen times to farm an easy roll
 * hits the cap and is playing a meaningfully harder afternoon than they
 * would have had if they had just played it.
 *
 * This raises what the stage ASKS and nothing else. It is deliberately absent
 * from the score — see `scoringDifficultyFor`.
 */
export const RELOAD_DIFFICULTY_STEP = 0.03;
export const RELOAD_DIFFICULTY_CAP = 0.15;

/**
 * …and takes this much off the quality that gets recorded.
 *
 * The half of the anti-cheat that can only ever hurt. The difficulty bump
 * above is capped, which is right — a harder afternoon is still an afternoon
 * you can play well — but a cap on its own means resume number six is free,
 * and free is exactly what a farmer is looking for. So there is a second,
 * uncapped-in-count cost: 2 % off the recorded quality per charged resume,
 * for as many as you take.
 *
 * Floored at 0.6 so it stays a cost rather than a lockout. Somebody who has
 * genuinely re-opened the app twenty times has a trial they can still pass;
 * they just cannot win it. Lose signal twice and you pay 4 %, which is
 * inside the noise of a single penalty.
 */
export const RELOAD_QUALITY_STEP = 0.02;
export const RELOAD_QUALITY_FLOOR = 0.6;

/**
 * What a stage is worth, at the easiest possible afternoon and at the hardest.
 *
 * `SCORE_BASE` is the whole of the ceiling fix. It used to be 0.70: a stage
 * rolled at difficulty 0 could not score above 70 however flawlessly it was
 * played, and difficulty comes out at exactly 0 for about one stage roll in
 * nine. That meant a Premier League offer — appetite peaks at 96, see
 * scoutOffers.ts — was unreachable on a dice roll the player never saw and
 * could do nothing about. Perfect play now scores 95 on the kindest roll and
 * 100 on the cruellest, so the top of the ladder is always in reach and the
 * difficulty roll decides how hard it is to get there rather than whether it
 * is possible at all.
 *
 * The 0.05 that is left is not a reward for difficulty so much as a
 * tie-break: two identical afternoons should not be literally identical when
 * one of them was harder. The design story — "a 70 on a hard day means more
 * than a 70 on an easy day" — is carried by the difficulty LABEL on the
 * result card (TrialSequence.tsx reads `TrialStageResult.difficulty` for
 * exactly this), which is where it belongs: a sentence can say that without
 * quietly making the number mean two different things.
 */
export const SCORE_BASE = 0.95;
export const SCORE_DIFFICULTY_SPAN = 0.05;

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
    resumes: 0,
    startedAt: Date.now(),
  };
}

/**
 * How hard a given stage is, all in: the trial's own character, this stage's
 * own roll, and whatever the player has added by re-opening the app.
 *
 * **This is what the stage ASKS.** Every drill ladder reads it — keeper
 * strength, wall distance, how many options the vision stage shows, how long
 * you get — so a farmed trial genuinely plays harder. It is not what the
 * stage is scored against; `scoringDifficultyFor` is.
 */
export function difficultyFor(trial: TrialProgress, stage: TrialStage): number {
  const reloadBump = Math.min(
    RELOAD_DIFFICULTY_CAP,
    Math.max(0, trial.reloads) * RELOAD_DIFFICULTY_STEP,
  );
  return clamp01(trial.baseDifficulty + (trial.stageRolls[stage] ?? 0) + reloadBump);
}

/**
 * The same stage's difficulty with the reload bump taken back out — the one
 * the score is computed from.
 *
 * The bug this exists to kill: difficulty was both what the stage asked AND
 * the score's multiplier, so re-opening the app raised the multiplier on
 * every stage still to come. Ten resumes turned a perfect trial on seed 0
 * from 73 into 81. The anti-cheat paid.
 *
 * Splitting the two is what lets a resume make the afternoon harder without
 * making it worth more: the drills read `difficultyFor`, the scoring reads
 * this, and the cost of resuming lives entirely in `reloadQualityHaircut`.
 */
export function scoringDifficultyFor(trial: TrialProgress, stage: TrialStage): number {
  return clamp01(trial.baseDifficulty + (trial.stageRolls[stage] ?? 0));
}

/**
 * What re-opening the app takes off the quality that gets recorded.
 *
 * 1 with no charged resumes, so a player who simply played their trial is
 * never touched by any of this.
 */
export function reloadQualityHaircut(reloads: number): number {
  const charged = Number.isFinite(reloads) ? Math.max(0, reloads) : 0;
  return Math.max(RELOAD_QUALITY_FLOOR, 1 - RELOAD_QUALITY_STEP * charged);
}

/** Whether a sharp keeper is standing in this particular stage. */
export function keeperBonusFor(trial: TrialProgress, stage: TrialStage): number {
  return trial.adversity === "sharp-keeper" && trial.adversityStage === stage
    ? SHARP_KEEPER_BONUS
    : 0;
}

/**
 * What a stage was worth, 0-100.
 *
 * **The score is what you did, and difficulty decides how hard that was to
 * do.** That is a correction of the shape this used to have, and the reason
 * for it is worth keeping written down, because the old shape reads sensible
 * and measured badly at both ends:
 *
 *   score = quality × (0.70 + 0.60 × difficulty)
 *
 * Difficulty was doing two jobs at once — making the drills harder AND
 * re-pricing the result — and the two multiplied. Measured over 10,000 stage
 * rolls, difficulty has a median of 0.34 and comes out at exactly 0 for 11.6 %
 * of them. At the bottom that meant a flawless stage capped at 70 and a
 * flawless TRIAL at 70-73, on a roll the player never sees: the Premier
 * League's appetite peaks at 96 (scoutOffers.ts), so the best outcome in the
 * game was unreachable through no fault of anybody's. At the top the product
 * ran past 1 and got clamped, so from about 78 % quality upward on a hard
 * roll every performance scored the same 100 — the top quarter of skill was
 * invisible and a very good player got the same offer as a perfect one.
 *
 * So: strictly increasing in quality across the whole range at every
 * difficulty, no plateau at either end, and perfect play lands on 95-100
 * whatever was rolled. What difficulty still changes is everything the drills
 * do with `difficultyFor` — the quality itself is genuinely harder to earn on
 * a hard afternoon, which is the honest place for that to bite. The story is
 * told in words on the result card, off the stored `difficulty`.
 */
export function stageScore(quality: number, difficulty: number): number {
  const worth = SCORE_BASE + SCORE_DIFFICULTY_SPAN * clamp01(difficulty);
  return Math.round(100 * clamp01(clamp01(quality) * worth));
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
 *
 * Note which difficulty goes where: the stage STORES the one it was actually
 * played at (reload bump and all, so the result card is honest about the
 * afternoon) and is SCORED on the one without it, so no amount of re-opening
 * the app can raise this number. What re-opening does do is take a slice off
 * the quality before it is written down.
 */
export function recordStage(
  trial: TrialProgress, stage: TrialStage, quality: number,
): TrialProgress {
  if (trial.results[stage]) return trial;
  const played = clamp01(quality) * reloadQualityHaircut(trial.reloads);
  return {
    ...trial,
    // Only clear an in-progress marker that somebody is actually keeping. If
    // this wrote `inProgress: null` onto a trial nobody sets it on, every
    // later resume would read as "between stages" and the anti-cheat would
    // silently stop charging from stage two onward.
    ...(trial.inProgress !== undefined ? { inProgress: null } : null),
    results: {
      ...trial.results,
      [stage]: {
        quality: played,
        difficulty: difficultyFor(trial, stage),
        score: stageScore(played, scoringDifficultyFor(trial, stage)),
        decidedAt: Date.now(),
      },
    },
  };
}

/**
 * Say which stage the player has just walked into, so a resume out of it can
 * be told apart from a resume that interrupted nothing.
 *
 * Wanted by `components/star/TrialSequence.tsx` — that component is the only
 * thing that knows a stage screen has opened — and not called from anywhere
 * yet. See `TrialProgress.inProgress`.
 */
export function beginStage(trial: TrialProgress, stage: TrialStage): TrialProgress {
  if (trial.inProgress === stage) return trial;
  return { ...trial, inProgress: stage };
}

/**
 * Did this load actually interrupt anything?
 *
 * The bar the anti-cheat is supposed to clear, and did not: a charge needs a
 * stage genuinely under way with no result yet. Two loads that were being
 * billed and should not have been —
 *
 *  - **the first load after career creation.** Nothing has been played, so
 *    there is nothing to retry and nothing to farm.
 *  - **a phone evicting a backgrounded tab.** iOS discards backgrounded tabs
 *    routinely; coming back to one is not a decision the player made.
 *
 * What is provable from the trial's own data, and what is not, stated plainly
 * because the difference matters:
 *
 *  - With `inProgress` kept (nothing keeps it yet — see `beginStage`) both
 *    cases are exact. Backgrounding the app on a between-stages result card
 *    leaves `inProgress` at null and costs nothing.
 *  - Without it, the fallback below can still prove the first-load case: an
 *    untouched trial being loaded for the first time has interrupted nothing,
 *    while a SECOND load of a still-untouched trial means the player has been
 *    sitting inside stage one and walked out of it, which is the exact thing
 *    the design set out to charge for. It cannot tell an eviction from a
 *    deliberate close, so mid-trial evictions still cost — the same as they
 *    did before, and the reason `inProgress` is worth wiring.
 */
export function resumeInterrupted(trial: TrialProgress): boolean {
  // Nothing left to walk back into.
  if (trialComplete(trial)) return false;

  if (trial.inProgress !== undefined) {
    return trial.inProgress !== null && !trial.results[trial.inProgress];
  }

  // A stage has genuinely been played, or a five-a-side is sitting half
  // finished — either way this load came back into a trial under way.
  if (trial.fiveASide !== undefined) return true;
  if (Object.keys(trial.results).length > 0) return true;

  // Untouched. The first sighting is the load right after career creation;
  // anything after that is a walk-out of stage one.
  return (trial.resumes ?? 0) > 0;
}

/**
 * Count a resume. See the note at the top of the file.
 *
 * Every resume is SEEN (`resumes`) — that is what lets the next one know it
 * is not the first. Only one that interrupted something is CHARGED
 * (`reloads`), and only the charged ones cost anything.
 */
export function noteReload(trial: TrialProgress): TrialProgress {
  const charge = resumeInterrupted(trial);
  return {
    ...trial,
    resumes: (trial.resumes ?? 0) + 1,
    reloads: trial.reloads + (charge ? 1 : 0),
  };
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
