import type { Outcome, ScenarioKind } from "./canvasEngine";
import { BOX_DEPTH, BOX_L, BOX_R, SIX_DEPTH, SIX_L, SIX_R } from "./pitch";
import { getTuning } from "./tuningStore";

/**
 * WHAT KIND OF GOAL, PASS OR MISS (the ratings revamp, Mikey, 6 Oct 2026).
 *
 * The match counts each chance into one of these groups; matchStats.ts's
 * fairRating gives each group its own value. Pure, so it can be tested.
 */

/** Where a goal was struck from. `at` is where you kicked it (goal line at y = 0). */
export type GoalZone = "penalty" | "tapIn" | "box" | "outside";
export function goalZone(kind: ScenarioKind, at: { x: number; y: number } | null | undefined): GoalZone {
  if (kind === "penalty") return "penalty";
  if (!at) return "box";
  if (at.y <= SIX_DEPTH && at.x >= SIX_L && at.x <= SIX_R) return "tapIn";
  if (at.y <= BOX_DEPTH && at.x >= BOX_L && at.x <= BOX_R) return "box";
  return "outside";
}

/** How brave a completed pass was, from the match's own 0-1 reading of it
 *  (the larger of its difficulty and its ambition, as the match already uses). */
export type PassGrade = "safe" | "medium" | "ambitious";
export function passGrade(difficulty: number | undefined, ambition: number | undefined): PassGrade {
  const a = Math.max(difficulty ?? 0, ambition ?? 0);
  if (a >= getTuning("rating.passAmbitiousFrom")) return "ambitious";
  if (a < getTuning("rating.passSafeBelow")) return "safe";
  return "medium";
}

/** What kind of miss your own shot was. A one-on-one or a penalty counts as
 *  that whatever happened to it; otherwise saved/blocked/woodwork is "on". */
export type MissKind = "penalty" | "oneOnOne" | "on" | "off";
const ON_TARGET: ReadonlySet<Outcome> = new Set<Outcome>(["saved", "caught", "tipped", "post", "blocked"]);
export function missKind(kind: ScenarioKind, res: Outcome): MissKind {
  if (kind === "penalty") return "penalty";
  if (kind === "one_on_one") return "oneOnOne";
  return ON_TARGET.has(res) ? "on" : "off";
}
