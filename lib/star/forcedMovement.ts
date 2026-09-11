import type { CareerState } from "./types";
import { membershipOf, estimateClubStrength } from "./promotion";
import { sortLeague } from "./season";
import { type GoverningBody, influenceIn } from "./governingBodies";
import { RULE_OVERRULE_INFLUENCE_THRESHOLD } from "./ruleBook";
import { isBodyPresident } from "./leadership";

/**
 * FORCED LEAGUE MOVEMENT — PHASE 6 OF STAR_POWER_POLITICS.MD, §4.4 #10.
 *
 * The worked example given directly: move Real Madrid into the Premier
 * League, replacing whoever finished 17th; that replaced club drops to the
 * Championship; a club is in turn relegated from the Championship into a
 * new holding tier ("limbo" — see promotion.ts's own `reconcileLadder`,
 * extended this phase to fold limbo returns back into next season's
 * promotion pool). Explicitly does NOT require owning the incoming club —
 * this is a high-enough-official power at the governing body, separate
 * from club ownership entirely, gated the same way overruling a Rule Book
 * vote is (see governingBodies.ts/ruleBook.ts): real influence, above a
 * deliberately high bar.
 *
 * ── One deliberate scope limit ──
 *
 * This never displaces the PLAYER's own club. Doing so mid-season would
 * mean the career's live `career.league`/`career.division` (the actual
 * table being played right now) disagreeing with `career.divisions` (the
 * meta-membership this function touches) until the next rollover
 * reconciles them — the exact kind of mid-season-relegation edge case the
 * rollout plan itself flagged Phase 6 as needing further sessions to work
 * through properly. Blocked outright here rather than half-handled.
 */

export function canForceClubMovement(career: CareerState, body: GoverningBody): boolean {
  return influenceIn(career, body) >= RULE_OVERRULE_INFLUENCE_THRESHOLD || isBodyPresident(career, body);
}

export interface ForcedMovementResult {
  career: CareerState;
  ok: boolean;
  reason?: string;
  displacedFromPremier?: string;
  displacedToLimbo?: string;
}

export function forceClubIntoPremierLeague(career: CareerState, incomingClub: string): ForcedMovementResult {
  if (!canForceClubMovement(career, "FA")) {
    return { career, ok: false, reason: "Not enough influence at the FA to force this" };
  }
  const members = membershipOf(career);
  if (members.premier.includes(incomingClub)) {
    return { career, ok: false, reason: "That club is already in the Premier League" };
  }

  // Whoever finished 17th is a real fact when the player's own division IS
  // the Premier League this season; otherwise there is no live table for
  // it (see promotion.ts's own header on why), so the weakest real
  // estimate stands in — the same principle `strengthTable` already uses
  // for every other un-simulated club.
  const playingInPremier = members.premier.includes(career.player.club) && career.league.some(t => t.name === career.player.club);
  const displacedFromPremier = playingInPremier
    ? sortLeague(career.league)[16]?.name
    : [...members.premier].sort((a, b) => estimateClubStrength(career, a) - estimateClubStrength(career, b))[0];

  if (!displacedFromPremier) return { career, ok: false, reason: "Could not find a club to displace" };
  if (displacedFromPremier === career.player.club) {
    return { career, ok: false, reason: "Can't force your own club out of the Premier League this way" };
  }

  const displacedToLimbo = [...members.championship].sort(
    (a, b) => estimateClubStrength(career, a) - estimateClubStrength(career, b),
  )[0];

  const premier = [...members.premier.filter(c => c !== displacedFromPremier), incomingClub];
  const championship = [...members.championship.filter(c => c !== displacedToLimbo), displacedFromPremier];

  return {
    career: {
      ...career,
      divisions: { premier, championship, pool: members.pool },
      limboClubs: [...(career.limboClubs ?? []), displacedToLimbo],
    },
    ok: true,
    displacedFromPremier,
    displacedToLimbo,
  };
}
