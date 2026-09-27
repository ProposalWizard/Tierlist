/**
 * YOUR CHANCES, ONE LINE EACH (v0.15 items 26 and 36).
 *
 * Every chance that came to you in a match: the minute, what kind of chance
 * it was and how it went. Kept on MatchStats.chanceLog; the post-match screen
 * opens it when you tap your rating. The real match (CanvasMatch) and "Sim
 * this match" (simMatch.ts) both write it in this shape.
 */

export type ChanceOutcome =
  | "goal" | "assist" | "rebound" | "pass" | "setup" | "miss" | "lost" | "dribble" | "tackled" | "offside" | "touch";

export interface ChanceEntry { minute: number; kind: string; outcome: ChanceOutcome }

export const CHANCE_KIND_LABEL: Record<string, string> = {
  one_on_one: "One-on-one", tight_angle: "Tight angle", long_range: "Long shot",
  cutback: "Cutback", through_ball: "Through ball", byline_cross: "Cross from the byline",
  corner: "Corner", free_kick: "Free kick", penalty: "Penalty", buildup: "Build-up pass",
  midfield_pass: "Midfield pass", volley: "Volley", header: "Header", dribble: "Run at them",
};

export const CHANCE_OUTCOME_LABEL: Record<ChanceOutcome, string> = {
  goal: "⚽ Goal", assist: "🎯 Assist", rebound: "🎯 Assist (rebound)", pass: "✓ Pass found",
  setup: "✓ Found him — he missed", miss: "✗ Missed", lost: "✗ Lost it", dribble: "✓ Beat his man",
  tackled: "✗ Tackled", offside: "✗ Offside", touch: "✓ Kept it",
};

/** Green for a good outcome, red for a bad one. */
export function chanceOutcomeGood(o: string): boolean {
  return o === "goal" || o === "assist" || o === "rebound" || o === "pass" || o === "setup" || o === "dribble" || o === "touch";
}
