import type { CareerState } from "./types";
import type { TransferOffer } from "./transfers";
import { reputation } from "./transfers";
import { offerClauses } from "./contracts";
import { membershipOf, estimateClubStrength, type DivisionMembership } from "./promotion";
import { sortLeague } from "./season";
import { divisionOf, divisionAbove, type CareerDivision } from "./calendar";

/**
 * A NEW CLUB, BECAUSE THE OLD ONE IS GONE.
 *
 * The ordinary summer transfer window (lib/star/transfers.ts) is optional —
 * turn every offer down and you simply stay. Relegation out of the National
 * League cannot work that way: the four-club pool your old club drops into
 * has no fixtures, no table, no season, so "stay" is not a real option. This
 * is the offer list for the screen that replaces the ordinary window when
 * that happens (RelegationMove.tsx), called BEFORE advanceSeason runs so the
 * player's club is already a real one by the time the ladder resolves who
 * plays where.
 *
 * Generalized 18 September 2026 from a Championship-only dead end: League
 * One, League Two and the National League are now real playable divisions,
 * so the only boundary left with nowhere real to land is the National
 * League's own — everything else just carries on into next season's real
 * fixtures. The shape (a handful of same-tier survivor offers, an
 * occasional rare look-in from the tier above) is unchanged; only which
 * tier it fires from is now whichever one the career is actually leaving.
 *
 * Always at least two same-tier offers: relegation does not mean nobody
 * wants you, it means your CLUB went down, and one poor season's table
 * position says little about an individual player. A look-in from the tier
 * above is the exception, not the rule — reputation has to be genuinely
 * high, and even then it is a roll of the dice, the way one relegated
 * player moving UP a division in real football actually is rare rather
 * than routine.
 */

function positionOf(name: string, ordered: string[]): number {
  const at = ordered.indexOf(name);
  return at >= 0 ? at + 1 : ordered.length;
}

function buildOffer(
  career: CareerState, club: string, strength: number, position: number,
  rng: () => number, tier: CareerDivision, sameTier: boolean,
): TransferOffer {
  const mine = career.league.find(t => t.name === career.player.club)?.strength
    ?? estimateClubStrength(career, career.player.club);
  const rep = reputation(career);
  const step = strength - mine;
  // Same real-money rescale as transfers.ts's own offer formula, 14 Sep
  // 2026 — the flat reputation bumps need to move roughly in step with the
  // wage itself now that it's a real weekly figure, not a token addition
  // on top of a wage that started at ★1.
  const wage = Math.max(1, Math.round(career.contract.wage * (1 + Math.max(0.05, step / 45)) + rep * 85));
  const seasons = 2 + Math.floor(rng() * 3);
  return {
    club,
    strength,
    position,
    wage,
    goalBonus: Math.max(1, Math.round(career.contract.goalBonus + rep * 62)),
    assistBonus: Math.max(1, Math.round(career.contract.assistBonus + rep * 42)),
    seasons,
    signingFee: Math.round(wage * seasons * (0.4 + rng() * 0.6)),
    clauses: offerClauses(career, wage, rng),
    division: tier,
    pitch: sameTier
      ? `${club} want someone who has already proven himself at this level.`
      : `${club} think relegation says nothing about what you can actually do.`,
  };
}

const MEMBERSHIP_KEY: Record<CareerDivision, keyof DivisionMembership | null> = {
  premier: "premier", championship: "championship", league_one: "leagueOne",
  league_two: "leagueTwo", national_league: "nationalLeague",
};

export function generateRelegationOffers(career: CareerState, rng: () => number): TransferOffer[] {
  const rep = reputation(career);
  const members = membershipOf(career);
  const table = sortLeague(career.league);
  const names = table.map(t => t.name);
  const you = career.player.club;
  const fromDivision = divisionOf(career);
  const fromKey = MEMBERSHIP_KEY[fromDivision] ?? "nationalLeague";
  const fromClubs = members[fromKey];
  const bottomFour = names.slice(-Math.min(4, names.length));

  // Every other club in the tier you're leaving, ranked by how close its
  // strength sits to what your reputation would actually command — not
  // simply the strongest sides, which would make every relegation read the
  // same regardless of how the season actually went for you.
  const survivors = fromClubs.filter(c => !bottomFour.includes(c) && c !== you);
  const sameTierCandidates = survivors
    .map(name => ({ name, strength: estimateClubStrength(career, name) }))
    .sort((a, b) => Math.abs(a.strength - rep * 0.85) - Math.abs(b.strength - rep * 0.85));
  const sameTierCount = Math.min(sameTierCandidates.length, 2 + (rng() < 0.4 ? 1 : 0));
  const sameTierPicks = sameTierCandidates.slice(0, Math.max(1, sameTierCount));

  const offers: TransferOffer[] = sameTierPicks.map(({ name, strength }) =>
    buildOffer(career, name, strength, positionOf(name, names), rng, fromDivision, true));

  // A genuinely outstanding season down there gets noticed above it — rare,
  // and never the majority case.
  const aboveDivision = divisionAbove(fromDivision);
  const aboveKey = aboveDivision ? MEMBERSHIP_KEY[aboveDivision] : null;
  if (aboveDivision && aboveKey && rep >= 74 && rng() < 0.35) {
    const aboveClubs = members[aboveKey];
    const aboveByStrength = [...aboveClubs]
      .map(name => ({ name, strength: estimateClubStrength(career, name) }))
      .sort((a, b) => a.strength - b.strength);
    // A weaker side in the tier above is the realistic suitor for a player
    // stepping straight up out of a relegated team.
    const pick = aboveByStrength[Math.floor(rng() * Math.min(4, aboveByStrength.length))];
    if (pick) {
      offers.unshift(buildOffer(
        career, pick.name, pick.strength, positionOf(pick.name, [...aboveClubs]), rng, aboveDivision, false,
      ));
    }
  }

  return offers;
}
