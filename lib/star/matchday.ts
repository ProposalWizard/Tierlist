/**
 * MATCH DAY — your side's strength in the unseen match (v0.15 item 0).
 *
 * The unseen match (hiddenMatch.ts) was told `career.relationships.team`
 * (how well you get on with the dressing room, 60 on day one) as your side's
 * strength, so Chelsea played every match like a 60-rated side. It is now the
 * club's own league strength — the number the table, the scout report and
 * formationShape already use. The relationship keeps its real job: how well
 * team-mates combine inside a chance (buildScenario's `teamRelationship`).
 */

import type { CareerState, Fixture } from "./types";

/** Your side's strength for the unseen match. `fallback` = the old value. */
export function matchTeamStrength(
  career: Pick<CareerState, "league" | "player"> | null | undefined,
  fallback: number,
  _fixture?: Pick<Fixture, "kind"> | null,
): number {
  if (!career) return fallback;
  const own = career.league?.find((t) => t.name === career.player.club)?.strength;
  return typeof own === "number" && Number.isFinite(own) ? own : fallback;
}
