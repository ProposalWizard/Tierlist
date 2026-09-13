import type { CareerState } from "./types";
import { tierOf, TIER_MULTIPLIER } from "./clubTier";
import { getTuning } from "./tuningStore";

/**
 * PLAYER MARKET VALUE — WHAT A PLAYER IS ACTUALLY WORTH.
 *
 * Requested directly: an estimate a real transfer fee should land AROUND —
 * below or above is fine, but it has to mean something, not be a number
 * pulled from nowhere. Built off the same real inputs the request named:
 * overall rating, age, potential tier (`highPotential`/`worldClassPotential`,
 * already real fields — see squadData.ts/leagueSquads.ts), and a small tilt
 * for the club's own reputation ("just a bit").
 *
 * Deliberately mirrors `clubValuation`'s own shape (investments.ts) rather
 * than inventing a new pricing idiom: an exponential curve above a floor for
 * the rating (a few points at the very top are worth far more than a few
 * points in the middle), reusing that same file's `tierOf`/`TIER_MULTIPLIER`
 * for the club tilt instead of a second copy of "how prestigious is this
 * club."
 *
 * This is the ANCHOR a negotiation opens around (negotiation.ts) — not a
 * fixed price. It intentionally does NOT replace `leagueTransfers.ts`'s own
 * `feeFor` (the AI-vs-AI transfer market, which has its own tuned economy)
 * or `investments.ts`'s flat `transferFee` (a deliberately simple board-
 * action price) — this is the number shown to a human deciding whether an
 * offer is fair.
 */

interface ValuablePlayer {
  overall: number;
  age?: number;
  highPotential?: boolean;
  worldClassPotential?: boolean;
}

/**
 * Rating climbs value steeply near the top, same spirit as clubValuation's
 * `Math.pow(strength - 40, 1.9)` — a 90 isn't "10% more" than an 81, it's a
 * different market entirely.
 */
function ratingFactor(overall: number): number {
  const m = Math.max(1, overall - getTuning("marketValue.ratingFloor"));
  return Math.pow(m, getTuning("marketValue.ratingExponent"));
}

/**
 * A real curve, not a flat modifier — peak value in the prime years, a real
 * premium for a very young player who's already this good (years of resale
 * ahead), and a real decline past the prime that never quite reaches zero
 * (a legend still has some value at 38).
 */
function ageFactor(age: number): number {
  if (age <= 22) return 1 + (22 - age) * getTuning("marketValue.youthPremiumPerYear");
  if (age <= 28) return 1;
  const declineYears = age - 28;
  return Math.max(getTuning("marketValue.ageFloor"), 1 - declineYears * getTuning("marketValue.declinePerYear"));
}

/**
 * High/World Class Potential are worth more, but "the potential is closer
 * to already realized or not" the older the player already is — the same
 * flag on an 18-year-old and a 27-year-old shouldn't carry the same premium.
 */
function potentialFactor(age: number, highPotential?: boolean, worldClassPotential?: boolean): number {
  if (!highPotential && !worldClassPotential) return 1;
  const peak = worldClassPotential ? getTuning("marketValue.worldClassPeak") : getTuning("marketValue.highPotentialPeak");
  const youthWindow = getTuning("marketValue.potentialYouthWindow");
  const taper = age <= 23 ? 1 : age >= 23 + youthWindow ? 0.1 : 1 - ((age - 23) / youthWindow) * 0.9;
  return 1 + (peak - 1) * taper;
}

/** A small tilt for playing at a reputable club — real, but never the
 *  dominant term, matching "just a bit based upon the club." */
function clubFactor(club: string, career: CareerState): number {
  const mult = TIER_MULTIPLIER[tierOf(club, career)];
  // Compress the club-valuation tier spread (0.3-1.25x) down to a gentle
  // 0.9-1.1x tilt on a PLAYER's own value — a player doesn't get 4x more
  // valuable just because his club is Champions League tier, the way a
  // whole club's valuation reasonably does.
  return 0.9 + (mult - 0.3) / (1.25 - 0.3) * 0.2;
}

export function playerMarketValue(player: ValuablePlayer, club: string, career: CareerState): number {
  const age = player.age ?? 24;
  const value =
    ratingFactor(player.overall) *
    ageFactor(age) *
    potentialFactor(age, player.highPotential, player.worldClassPotential) *
    clubFactor(club, career) *
    getTuning("marketValue.scale");
  return Math.max(getTuning("marketValue.floor"), Math.round(value));
}
