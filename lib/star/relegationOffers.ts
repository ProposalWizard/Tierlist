import type { CareerState } from "./types";
import type { TransferOffer } from "./transfers";
import { reputation } from "./transfers";
import { offerClauses } from "./contracts";
import { membershipOf, estimateClubStrength, type DivisionMembership } from "./promotion";
import { sortLeague } from "./season";
import { divisionOf, divisionAbove, type CareerDivision } from "./calendar";
import { offerWageFor, goalBonusFor, assistBonusFor, signingOnFee } from "./economy";

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
  // Read off the offering club, not off your last contract — the identical
  // compounding bug transfers.ts had, and the identical fix. `tier` is the
  // division THIS club is actually in, which matters more here than
  // anywhere else: half the point of a relegation offer is that it may come
  // from the division you have just dropped out of.
  const wage = offerWageFor(club, tier, rep, step, career.contract.wage, career);
  const seasons = 2 + Math.floor(rng() * 3);
  return {
    club,
    strength,
    position,
    wage,
    goalBonus: goalBonusFor(wage),
    assistBonus: assistBonusFor(wage),
    seasons,
    // Same `signingOnFee` as every other move, with the rng kept as a
    // little haggling — see transfers.ts.
    signingFee: Math.max(1, Math.round(signingOnFee(club, wage) * (0.7 + rng() * 0.4))),
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
  national_league_north: "nationalLeagueNorth", national_league_south: "nationalLeagueSouth",
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

  // Every other club in the tier you're leaving that will still be in it —
  // not the four going down, and not the champion or the play-off winner,
  // who go UP (an offer from them made a "relegation" a promotion). Ranked by
  // strength, and you are offered clubs around the rank your season earned:
  // a season of no goals gets the weakest, a great one the strongest (Mikey,
  // 8 Oct 2026: "if you got zero goals then obviously you should be getting
  // the worst possible clubs … if you were very good … big clubs"). Matching
  // reputation to raw strength did not do that: every club sits between 50
  // and 70, so any reputation under 60 got the same bottom clubs.
  const goingUp = new Set([names[0], career.playOffState?.promoted].filter((c): c is string => !!c));
  const survivors = fromClubs.filter(c => !bottomFour.includes(c) && c !== you && !goingUp.has(c));
  const ranked = survivors
    .map(name => ({ name, strength: estimateClubStrength(career, name) }))
    .sort((a, b) => a.strength - b.strength);
  const centre = Math.round((rep / 100) * (ranked.length - 1));
  const sameTierCount = Math.min(ranked.length, 2 + (rng() < 0.4 ? 1 : 0));
  const sameTierPicks = [...ranked]
    .map((c, i) => ({ c, d: Math.abs(i - centre) + rng() * 1.5 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(1, sameTierCount))
    .map(x => x.c);

  const offers: TransferOffer[] = sameTierPicks.map(({ name, strength }) =>
    buildOffer(career, name, strength, positionOf(name, names), rng, fromDivision, true));

  // A genuinely good season down there gets noticed above it: from
  // reputation 70 (25 in 100) up to 100 (every time), and a second club at
  // 90+. The better the season, the further up that division's table.
  const aboveDivision = divisionAbove(fromDivision);
  const aboveKey = aboveDivision ? MEMBERSHIP_KEY[aboveDivision] : null;
  if (aboveDivision && aboveKey) {
    const chance = Math.max(0, Math.min(1, (rep - 60) / 40));
    const count = rep >= 90 ? 2 : 1;
    const aboveClubs = members[aboveKey];
    const aboveRanked = [...aboveClubs]
      .map(name => ({ name, strength: estimateClubStrength(career, name) }))
      .sort((a, b) => a.strength - b.strength);
    // Reputation 70 reaches the weakest few; 100 reaches mid-table.
    const reach = Math.round(Math.max(0, (rep - 70) / 30) * (aboveRanked.length / 2));
    const taken = new Set<string>();
    for (let k = 0; k < count; k++) {
      if (rng() >= chance) continue;
      const i = Math.max(0, Math.min(aboveRanked.length - 1, reach - Math.floor(rng() * 4)));
      const pick = aboveRanked.slice(i).find(c => !taken.has(c.name)) ?? aboveRanked[i];
      if (!pick || taken.has(pick.name)) continue;
      taken.add(pick.name);
      offers.unshift(buildOffer(
        career, pick.name, pick.strength, positionOf(pick.name, [...aboveClubs]), rng, aboveDivision, false,
      ));
    }
  }

  return offers;
}
