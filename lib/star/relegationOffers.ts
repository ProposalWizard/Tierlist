import type { CareerState } from "./types";
import type { TransferOffer } from "./transfers";
import { reputation } from "./transfers";
import { offerClauses } from "./contracts";
import { membershipOf, estimateClubStrength } from "./promotion";
import { sortLeague } from "./season";

/**
 * A NEW CLUB, BECAUSE THE OLD ONE IS GONE.
 *
 * The ordinary summer transfer window (lib/star/transfers.ts) is optional —
 * turn every offer down and you simply stay. Relegation out of the
 * Championship cannot work that way: the pool your old club drops into has
 * no fixtures, no table, no season, so "stay" is not a real option. This is
 * the offer list for the screen that replaces the ordinary window when that
 * happens (RelegationMove.tsx), called BEFORE advanceSeason runs so the
 * player's club is already a real one — Championship survivor or, rarely, a
 * Premier League side — by the time the ladder resolves who plays where.
 *
 * Always at least two Championship offers: relegation does not mean nobody
 * wants you, it means your CLUB went down, and one poor season's table
 * position says little about an individual player. A Premier League look-in
 * is the exception, not the rule — reputation has to be genuinely high, and
 * even then it is a roll of the dice, the way one relegated player moving
 * UP a division in real football actually is rare rather than routine.
 */

function positionOf(name: string, ordered: string[]): number {
  const at = ordered.indexOf(name);
  return at >= 0 ? at + 1 : ordered.length;
}

function buildOffer(
  career: CareerState, club: string, strength: number, position: number,
  rng: () => number, tier: "championship" | "premier",
): TransferOffer {
  const mine = career.league.find(t => t.name === career.player.club)?.strength
    ?? estimateClubStrength(career, career.player.club);
  const rep = reputation(career);
  const step = strength - mine;
  const wage = Math.max(1, Math.round(career.contract.wage * (1 + Math.max(0.05, step / 45)) + rep / 24));
  const seasons = 2 + Math.floor(rng() * 3);
  return {
    club,
    strength,
    position,
    wage,
    goalBonus: Math.max(1, Math.round(career.contract.goalBonus + rep / 32)),
    assistBonus: Math.max(1, Math.round(career.contract.assistBonus + rep / 48)),
    seasons,
    signingFee: Math.round(wage * seasons * (0.4 + rng() * 0.6)),
    clauses: offerClauses(career, wage, rng),
    division: tier,
    pitch: tier === "premier"
      ? `${club} think relegation says nothing about what you can actually do.`
      : `${club} want someone who has already proven himself at this level.`,
  };
}

export function generateRelegationOffers(career: CareerState, rng: () => number): TransferOffer[] {
  const rep = reputation(career);
  const members = membershipOf(career);
  const table = sortLeague(career.league);
  const names = table.map(t => t.name);
  const bottomThree = names.slice(-3);
  const you = career.player.club;

  // Every other Championship club, ranked by how close its strength sits to
  // what your reputation would actually command — not simply the strongest
  // sides, which would make every relegation read the same regardless of how
  // the season actually went for you.
  const survivors = members.championship.filter(c => !bottomThree.includes(c) && c !== you);
  const champCandidates = survivors
    .map(name => ({ name, strength: estimateClubStrength(career, name) }))
    .sort((a, b) => Math.abs(a.strength - rep * 0.85) - Math.abs(b.strength - rep * 0.85));
  const champCount = Math.min(champCandidates.length, 2 + (rng() < 0.4 ? 1 : 0));
  const champPicks = champCandidates.slice(0, Math.max(1, champCount));

  const offers: TransferOffer[] = champPicks.map(({ name, strength }) =>
    buildOffer(career, name, strength, positionOf(name, names), rng, "championship"));

  // A genuinely outstanding season down there gets noticed above it — rare,
  // and never the majority case.
  if (rep >= 74 && rng() < 0.35) {
    const plByStrength = [...members.premier]
      .map(name => ({ name, strength: estimateClubStrength(career, name) }))
      .sort((a, b) => a.strength - b.strength);
    // A weaker Premier League side is the realistic suitor for a player
    // stepping straight up out of a relegated Championship team.
    const pick = plByStrength[Math.floor(rng() * Math.min(4, plByStrength.length))];
    if (pick) {
      offers.unshift(buildOffer(
        career, pick.name, pick.strength, positionOf(pick.name, [...members.premier]), rng, "premier",
      ));
    }
  }

  return offers;
}
