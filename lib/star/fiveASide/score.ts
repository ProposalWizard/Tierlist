import type { Outcome, Scenario } from "../canvasEngine";
import type { FiveMatchState, PassageEvent } from "./match";
import { resultOf } from "./match";
import type { MatchRules } from "./rules";

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
 * is carried around and stored rather than thrown away once a stage is set up
 * — see trial.ts's `stageScore`, which applies the same shape at the level of
 * a whole stage.
 */

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
 * — real engine fields, not a second opinion invented here — and taking the
 * better of them is deliberate: a simple ball that was the right ball should
 * score, and so should a hard ball into a tight space.
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
    case "delivered":
      return 0.45 + 0.55 * Math.max(
        Math.max(0, Math.min(1, scenario.passDifficulty ?? 0)),
        Math.max(0, Math.min(1, scenario.passAmbition ?? 0)),
      );
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

/** A goal you scored yourself, or one you set up, is worth more than the
 *  placement alone says — it is the thing the whole move was for. */
export const GOAL_BONUS = 0.05;
export const ASSIST_BONUS = 0.25;
export const WIN_BONUS = 0.10;
export const DRAW_BONUS = 0.03;

/**
 * The whole stage, 0-100.
 *
 * Deliberately NOT a plain average of your touches: a five-a-side you won 3-0
 * having done everything asked of you should beat one you lost 0-3 with the
 * same shot placement, because the scouts watching are watching a game, not a
 * shooting drill.
 *
 * `difficulty` scales the whole thing rather than any one part, so the same
 * afternoon is worth more when the opposition were better — the rule stated
 * at the top of this file.
 */
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

  const mean = events.reduce((sum, e) => sum + Math.max(0, Math.min(1, e.quality)), 0) / events.length;
  const goals = events.filter(e => e.goal).length;
  const assists = events.filter(e => e.assist).length;
  const result = resultOf(state);

  const raw = mean
    + GOAL_BONUS * Math.min(goals, 3)
    + ASSIST_BONUS * Math.min(assists, 2) * 0.2
    + (result === "win" ? WIN_BONUS : result === "draw" ? DRAW_BONUS : 0);

  return Math.max(0, Math.min(1, raw));
}

export function fiveASideScore(state: FiveMatchState, difficulty: number): number {
  const d = Math.max(0, Math.min(1, Number.isFinite(difficulty) ? difficulty : 0));
  return Math.round(100 * Math.max(0, Math.min(1, rawQuality(state) * (0.70 + 0.60 * d))));
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
