import type { Outcome, Scenario } from "../canvasEngine";
import type { FiveMatchState, PassageEvent } from "./match";
import { resultOf } from "./match";
import { halfwayY, type MatchRules } from "./rules";
import { SCORE_BASE, SCORE_DIFFICULTY_SPAN } from "../trial";

/**
 * WHAT YOU ACTUALLY DID, AS A NUMBER.
 *
 * Two jobs, kept apart on purpose: judging one touch, and turning a match's
 * worth of touches into the single 0-100 the watching clubs see.
 *
 * ── The rule the whole thing is built on ──
 *
 * A score is PERFORMANCE RELATIVE TO WHAT WAS ASKED. A finish into the corner
 * past a good keeper is worth more than the same finish into an empty net; a
 * miss costs less when the chance was never really on. That is why difficulty
 * is carried around and stored rather than thrown away once a stage is set up.
 *
 * `fiveASideScore` really is the same shape as trial.ts's `stageScore`, and
 * stays that way by importing its constants rather than by saying so — the
 * claim used to be written here while the two formulas had quietly diverged.
 *
 * ── The second rule, added after measuring ──
 *
 * WHAT YOU DID HAS TO BEAT WHAT YOU DID NOT DO. A completed pass keeps the
 * ball, costs no opposition attack and costs no clock, so if it is also worth
 * as much as a shot then the best way to play is to never shoot at all. It
 * was, and it measured: 46/100 for six minutes of passing sideways to a
 * goalless draw, against 84/100 for a striker who shot all afternoon and did
 * not score once. Goals and the result carry the afternoon now — see
 * GOAL_BONUS, WIN_BONUS, SHOT_WEIGHT and the pass caps below, and
 * tests/star/fiveASide.mts for the before-and-after numbers.
 */

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** Shots are judged by where they crossed the line, so a finish into the
 *  corner beats a finish down the middle. The engine hands this back on the
 *  ball; null when it never got there. */
export function shotPlacementQuality(
  outcome: Outcome | "out", crossX: number | null, rules: MatchRules,
): number {
  const half = (rules.goal.x2 - rules.goal.x1) / 2;
  const centre = (rules.goal.x1 + rules.goal.x2) / 2;

  if (outcome === "goal" || outcome === "rebound") {
    if (crossX === null) return 0.7;
    // How far toward a post: 0 dead centre, 1 right against one. Measured
    // against THIS goal rather than a full-size one — on a small goal the
    // corners are much closer together and a finish two metres off centre is
    // already a very good one.
    const fromCentre = Math.min(1, Math.abs(crossX - centre) / Math.max(0.5, half));
    return Math.max(0.55, Math.min(1, 0.55 + fromCentre * 0.45));
  }
  if (outcome === "saved" || outcome === "tipped") return 0.34;
  if (outcome === "caught") return 0.24;
  if (outcome === "post") return 0.42;
  if (outcome === "blocked") return 0.16;
  if (outcome === "wide" || outcome === "over") {
    if (crossX === null) return 0.08;
    const miss = crossX < rules.goal.x1 ? rules.goal.x1 - crossX
      : crossX > rules.goal.x2 ? crossX - rules.goal.x2 : 0;
    return Math.max(0.04, 0.2 * Math.max(0, 1 - miss / 4));
  }
  return 0.05;
}

/**
 * What one touch was worth, 0-1.
 *
 * A pass is judged on the two things the engine already works out at the
 * moment it arrives: how hard the ball was, and whether it was the ambitious
 * one of the balls that were on. Those are `passDifficulty` and `passAmbition`
 * — real engine fields, not a second opinion invented here.
 *
 * It used to take the better of the two flatly, on the reasoning that a simple
 * ball that was the right ball should score and so should a hard ball into a
 * tight space. Both halves of that are still true, but on a five-a-side pitch
 * `passAmbition` is degenerate and the flat maximum made a two-metre nudge
 * worth 0.99 — see the `delivered` branch for the measurement and the fix.
 */
export function passageQuality(
  outcome: Outcome | "out",
  scenario: Scenario,
  crossX: number | null,
  rules: MatchRules,
): number {
  switch (outcome) {
    case "goal":
    case "rebound":
    case "saved":
    case "caught":
    case "tipped":
    case "post":
    case "wide":
    case "over":
      return shotPlacementQuality(outcome, crossX, rules);
    case "delivered": {
      const difficulty = clamp01(scenario.passDifficulty ?? 0);
      const ambition = clamp01(scenario.passAmbition ?? 0);
      // ── Why ambition is not trusted on its own here ──
      //
      // `passAmbition` is a RELATIVE question — "of the balls that were on,
      // was that the brave one" — and it is exactly right in a full match,
      // where the most advanced option is genuinely up the pitch. On a
      // 24 x 36 pitch with three team-mates standing a few metres apart it
      // degenerates: the engine gives full marks to any ball that goes more
      // than two metres forward to the furthest-forward man. MEASURED, by
      // playing a real match out through the engine: eleven consecutive
      // two-metre nudges scored `passAmbition` 0.94, 0.98, then 0.99 every
      // single touch after that, for a ball that travelled four metres in
      // total. `passDifficulty` — which is absolute (forward/25 + length/45)
      // — read 0.13 for the same passes, which is the honest number.
      //
      // So ambition only counts once the ball was genuinely a ball.
      const merit = difficulty >= PASS_AMBITION_BAR
        ? Math.max(difficulty, ambition)
        : difficulty;
      const full = 0.45 + 0.55 * merit;
      if (merit >= PASS_AMBITION_BAR) return full;
      // Below the bar it is keeping the ball, which is worth something and is
      // not worth what a shot is. Deeper is worth less, because a safe ball in
      // your own half is not even progress.
      const ownHalf = scenario.ball.y > halfwayY(rules);
      return Math.min(full, ownHalf ? OWN_HALF_PASS_CAP : SAFE_PASS_CAP);
    }
    case "touchOn":
      // Kept it, went again. Not nothing, not much.
      return 0.4;
    case "blocked":
      return 0.16;
    case "tackled":
      return 0.05;
    case "offside":
      return 0.1;
    case "short":
      return 0.12;
    case "out":
      return 0.08;
    default:
      return 0.05;
  }
}

/**
 * How ambitious a completed pass has to be before it is judged on the full
 * curve rather than capped as a safe one. Read against `passDifficulty`,
 * which is absolute — roughly "eight metres forward, or a long ball across".
 */
export const PASS_AMBITION_BAR = 0.30;
/**
 * What a safe, completed ball is worth at most.
 *
 * Deliberately below `shotPlacementQuality`'s "saved" (0.34) and above its
 * "caught" (0.24), and that ordering is the whole point rather than a
 * coincidence of tuning: keeping the ball is worth more than a shot the keeper
 * gathered at his chest and less than one he had to go and get. A cap ABOVE
 * "saved" is the incentive this rebalance exists to remove, and the match
 * suite asserts the ordering directly so it cannot drift back.
 */
export const SAFE_PASS_CAP = 0.30;
/** …and in your own half, where it has not even made ground. */
export const OWN_HALF_PASS_CAP = 0.20;

/**
 * HOW MUCH MORE A TOUCH AT GOAL COUNTS THAN A SAFE ONE.
 *
 * The mean used to be flat, and that is what made refusing to shoot a
 * strategy: a pass keeps the ball, costs no opposition attack, and counted
 * exactly as much toward your afternoon as the shot you did not take. A scout
 * does not watch a striker that way. A shot is the thing he is there to judge,
 * so it carries more of the verdict — the good ones AND the bad ones.
 */
export const SHOT_WEIGHT = 2.5;

/**
 * A goal you scored yourself, or one you set up, is worth more than the
 * placement alone says — it is the thing the whole move was for.
 *
 * Was 0.05 — which is roughly what one extra completed pass was worth, so a
 * goal moved the mark about as much as remembering to pass to somebody.
 * MEASURED, over 200 real matches played out through the engine (see
 * tests/star/fiveASide.mts): a striker who had a dozen shots and did not score
 * scored 83.7, and one who scored and won 97.7 — the goals were not visible in
 * the number at all. Three goals now carry 0.54 of the 1.0.
 */
export const GOAL_BONUS = 0.18;
/**
 * Setting one up. Worth REAL points, and worth more than a tap-in.
 *
 * Was 0.25 and then applied as `ASSIST_BONUS * assists * 0.2`, which made an
 * assist worth 0.05 — the same as a goal, and a fifth of what its own name
 * said. Caught in review. The 0.2 is gone and the constant means what it says.
 */
export const ASSIST_BONUS = 0.12;
/**
 * Winning. Raised with the goal bonus and for the same reason: the result is
 * what the afternoon was for, and a 0-0 kept-ball draw should not be able to
 * out-score a win. A draw is worth a token, not a result.
 */
export const WIN_BONUS = 0.24;
export const DRAW_BONUS = 0.04;

/**
 * Which outcomes are a touch AT GOAL, for `SHOT_WEIGHT`.
 *
 * Deliberately only the unambiguous ones. "blocked" and "tackled" can each be
 * either a smothered shot or a pass cut out, and the engine does not say
 * which; counting them as shots would let a player inflate the weight of
 * touches he never aimed at the goal. Left at weight 1, which under-counts a
 * genuinely blocked shot — the conservative direction.
 */
const SHOT_OUTCOMES: ReadonlySet<string> = new Set([
  "goal", "rebound", "saved", "caught", "tipped", "post", "wide", "over",
]);

/** Was this touch a shot? See SHOT_OUTCOMES. */
export function isShotOutcome(outcome: Outcome | "out"): boolean {
  return SHOT_OUTCOMES.has(outcome);
}

/**
 * How well you played, 0-1, BEFORE any allowance for how hard it was.
 *
 * Kept as its own function because two callers need it and they need it to be
 * the same number: the stage score below scales it by difficulty, and the
 * trial (which applies its OWN difficulty scaling) needs the unscaled one.
 * The first version computed the scaled score and then divided the difficulty
 * back out, which does not undo it — the goal and result bonuses were never
 * scaled in the first place, so dividing the total over-corrected and the
 * "raw" quality drifted with difficulty after all. Measured: 0.843 at the
 * easiest against 0.769 at the hardest, for the identical afternoon.
 *
 * A match you never touched the ball in scores zero, not a draw bonus. You did
 * not draw that game; you were on the pitch while it was drawn.
 */
export function rawQuality(state: FiveMatchState): number {
  const events = state.events;
  if (!events.length) return 0;

  // Weighted, not flat — see SHOT_WEIGHT. A player who mixes passes and shots
  // is judged mostly on the shots; a player who only passes is judged on his
  // passes, which is the same number it always was for him.
  let weighted = 0, weight = 0;
  for (const e of events) {
    const w = isShotOutcome(e.outcome) ? SHOT_WEIGHT : 1;
    weighted += w * clamp01(e.quality);
    weight += w;
  }
  const mean = weighted / weight;
  const goals = events.filter(e => e.goal).length;
  const assists = events.filter(e => e.assist).length;
  const result = resultOf(state);

  const raw = mean
    + GOAL_BONUS * Math.min(goals, 3)
    + ASSIST_BONUS * Math.min(assists, 2)
    + (result === "win" ? WIN_BONUS : result === "draw" ? DRAW_BONUS : 0);

  return Math.max(0, Math.min(1, raw));
}

/**
 * The five-a-side's own 0-100, for any screen that wants to show one.
 *
 * Deliberately NOT a formula of its own. It used to carry a second copy of the
 * old `quality x (0.70 + 0.60 x difficulty)` shape, and when `trial.ts` fixed
 * that shape — it capped a flawless afternoon at 70 on an easy roll and
 * saturated at 100 from about 78% quality upward on a hard one, hiding the top
 * quarter of skill — this file kept quoting the old one. Two numbers for the
 * same performance, a few seconds apart on two screens, is a bug to whoever is
 * looking at them. So the constants are imported rather than restated.
 *
 * This does NOT feed the trial's own score, and must not start to:
 * `TrialSequence` throws the summary's `.score` away and hands `stageScore`
 * the unscaled `stageQualityFrom` instead, because applying difficulty at both
 * ends was a real bug once already. This number is for display.
 */
export function fiveASideScore(state: FiveMatchState, difficulty: number): number {
  const d = Math.max(0, Math.min(1, Number.isFinite(difficulty) ? difficulty : 0));
  const worth = SCORE_BASE + SCORE_DIFFICULTY_SPAN * d;
  return Math.round(100 * Math.max(0, Math.min(1, rawQuality(state) * worth)));
}

/** Everything the trial needs to record about this stage. */
export interface FiveASideSummary {
  score: number;
  goals: number;
  assists: number;
  result: "win" | "draw" | "loss";
  scoreline: [number, number];
  touches: number;
  difficulty: number;
}

export function summarise(state: FiveMatchState, difficulty: number): FiveASideSummary {
  return {
    score: fiveASideScore(state, difficulty),
    goals: state.events.filter(e => e.goal).length,
    assists: state.events.filter(e => e.assist).length,
    result: resultOf(state),
    scoreline: [...state.score],
    touches: state.events.length,
    difficulty,
  };
}

/** What `recordStage` wants: the unscaled 0-1 quality, because the trial
 *  applies its own difficulty scaling on top and applying it twice would
 *  punish a hard trial twice over. */
export function stageQualityFrom(state: FiveMatchState): number {
  return rawQuality(state);
}

export type { PassageEvent };
