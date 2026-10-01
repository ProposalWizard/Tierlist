import {
  NATIONAL_LEAGUE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS,
} from "./clubs";
import type { CareerDivision } from "./calendar";
import { weeklyWageFor, goalBonusFor, assistBonusFor } from "./economy";
import { scoutedClubStrength, type ScoutOffer } from "./scoutOffers";
import { mulberry32 } from "./season";

/**
 * "A SCOUT HAS SPOTTED YOU" — where the trial sends you.
 *
 * Harry, 1 Oct 2026 (P36): "you don't get a trial rating, you just get
 * scouted. That's it, like a scout has spotted you." And (P63): "They just
 * get scouted randomly. If they score that final pen, maybe they have a
 * better chance of being in the National League rather than the non-league
 * south or north."
 *
 * So the trial no longer scores you onto a ladder. It ends, a scout has seen
 * you, and you start at a random club in one of the three bottom divisions.
 * The one thing you did that counts is the last penalty of the shootout:
 * score it and the National League is likelier.
 *
 * The odds are a judgement call, on the question list for Harry:
 *   scored the final pen — 50% National League, 25% North, 25% South
 *   missed it            — 20% National League, 40% North, 40% South
 *
 * Pure, and the only randomness is the `rng` passed in — so the career page
 * seeds it off the trial's own seed and a reload lands at the same club
 * rather than re-rolling (see `scoutedOfferForTrial`).
 */

export type ScoutedDivision = "national_league" | "national_league_north" | "national_league_south";

/** Chance of each division, by whether the final shootout penalty went in. */
export const SCOUTED_ODDS: Record<"scored" | "missed", Record<ScoutedDivision, number>> = {
  scored: { national_league: 0.5, national_league_north: 0.25, national_league_south: 0.25 },
  missed: { national_league: 0.2, national_league_north: 0.4, national_league_south: 0.4 },
};

const CLUBS_OF: Record<ScoutedDivision, readonly string[]> = {
  national_league: NATIONAL_LEAGUE_CLUBS,
  national_league_north: NATIONAL_LEAGUE_NORTH_CLUBS,
  national_league_south: NATIONAL_LEAGUE_SOUTH_CLUBS,
};

export interface ScoutedPlacement {
  /** The club that signs you. */
  club: string;
  division: ScoutedDivision;
  /** Every club in that division — what `attachClub`/`makeInitialCareer` need. */
  clubs: string[];
}

/**
 * Where a scout places you. Two rolls from `rng`: the division (by
 * SCOUTED_ODDS), then a club in it, every club equally likely.
 */
export function scoutedPlacement(finalPenScored: boolean, rng: () => number): ScoutedPlacement {
  const odds = SCOUTED_ODDS[finalPenScored ? "scored" : "missed"];
  const order: ScoutedDivision[] = ["national_league", "national_league_north", "national_league_south"];
  let roll = rng();
  let division: ScoutedDivision = order[order.length - 1];
  for (const d of order) {
    if (roll < odds[d]) { division = d; break; }
    roll -= odds[d];
  }
  const clubs = [...CLUBS_OF[division]];
  const club = clubs[Math.min(clubs.length - 1, Math.floor(rng() * clubs.length))];
  return { club, division, clubs };
}

/**
 * Did the final penalty of the trial's shootout go in?
 *
 * Reads `trial.finalPenScored` — the flag the rebuilt trial (W2, v0.23) sets
 * when its shootout ends. Until that exists, falls back to the shootout
 * stage's own result: half or more of your kicks scored counts as scoring
 * the last one. No shootout played at all reads as missed.
 */
export function finalPenScoredOf(trial: {
  finalPenScored?: boolean;
  results?: Partial<Record<string, { quality: number } | undefined>>;
} | null | undefined): boolean {
  if (!trial) return false;
  if (typeof trial.finalPenScored === "boolean") return trial.finalPenScored;
  const shootout = trial.results?.shootout;
  return !!shootout && shootout.quality >= 0.5;
}

/** The trial's own seed, salted the same way the old offer screen was, so
 *  the same trial always lands at the same club. */
const SCOUT_SALT = 0x5c0a7;

/**
 * The one offer a finished trial now brings: a ScoutOffer shaped exactly
 * like the ones the old trial-score ladder produced, so the manager talk,
 * the wage negotiation and the newspaper all work on it unchanged.
 *
 * The wage is a plain starter's wage at that club (STARTER_STANDING, the
 * economy's own default) — there is no trial score any more to make it
 * better or worse.
 */
export function scoutedOfferForTrial(trial: {
  seed: number;
  finalPenScored?: boolean;
  results?: Partial<Record<string, { quality: number } | undefined>>;
}): ScoutOffer {
  const placement = scoutedPlacement(finalPenScoredOf(trial), mulberry32(trial.seed ^ SCOUT_SALT));
  const division: CareerDivision = placement.division;
  const wage = weeklyWageFor(placement.club, division);
  return {
    club: placement.club,
    division,
    wage,
    goalBonus: goalBonusFor(wage),
    assistBonus: assistBonusFor(wage),
    seasons: 2,
    pitch: "A scout has spotted you. We'd like you here.",
    strength: scoutedClubStrength(placement.club, division),
  };
}
