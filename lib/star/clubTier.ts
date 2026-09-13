import type { CareerState } from "./types";
import { divisionOf } from "./clubs";

/**
 * WHAT COMPETITION TIER A CLUB IS ACTUALLY IN, RIGHT NOW.
 *
 * Split out of investments.ts so both `clubValuation` (investments.ts) and
 * `playerMarketValue` (marketValue.ts) can share the exact same "how
 * prestigious is this club" read without one importing the other —
 * marketValue.ts needs it for a player's small club-reputation tilt, and
 * investments.ts needs it for the club's own valuation; a straight
 * investments.ts → marketValue.ts → investments.ts import would cycle.
 */
export type ClubTier = "champions" | "europa" | "premier" | "championship" | "other";

export function tierOf(club: string, career: CareerState): ClubTier {
  // Actually playing in it THIS season outranks the static list — a club
  // punching above its usual competition (or currently in one at all) is
  // worth what it's doing now, not its long-run reputation bucket.
  if (career.euroState?.competition === "Champions League" && career.euroState.clubs.some(c => c.name === club)) return "champions";
  if (career.euroState?.competition === "Europa League" && career.euroState.clubs.some(c => c.name === club)) return "europa";
  const div = divisionOf(club);
  if (div === "champions") return "champions";
  if (div === "europa") return "europa";
  if (div === "championship") return "championship";
  if (div === "premier") return "premier";
  return "other";
}

// Prestige premium/discount by tier, layered on top of raw squad strength —
// a Champions League regular is worth more than a Championship promotion
// hopeful at the same nominal strength, the same way real club valuations
// carry a competition premium independent of the current XI's quality.
export const TIER_MULTIPLIER: Record<ClubTier, number> = {
  champions: 1.25, europa: 0.85, premier: 1.0, championship: 0.3, other: 0.55,
};
