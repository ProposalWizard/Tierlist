import type { CareerState, Contract } from "./types";
import { sortLeague } from "./season";
import { generateSquad, clubNameSeed } from "./squadData";
import { assignSquadNumber } from "./recognition";

/**
 * TRANSFERS
 *
 * A `"season-transfer"` phase has been sitting unused in StarPhase since the
 * game was written, and the only thing in the codebase that mentioned moving
 * club was a dilemma where your agent asks how you feel about it. You signed for
 * one club at eighteen and finished your career there whatever you did.
 *
 * Clubs now come for you between seasons. Who comes is decided by what you are
 * worth to them: a side above you in the table needs a bigger reputation before
 * it is interested, so a move up is something you earn, and the ones below you
 * will take you on your name alone.
 *
 * Everything a move costs you is deliberate. A new dressing room does not know
 * you, and a new manager has not picked you before — so you arrive with your
 * relationships part-way reset, and the first weeks are spent proving it again.
 * Without that, moving every summer for a bigger wage would be strictly correct
 * and there would be no decision in it at all.
 */

export interface TransferOffer {
  club: string;
  strength: number;
  wage: number;
  goalBonus: number;
  assistBonus: number;
  seasons: number;
  /** Paid on signing. */
  signingFee: number;
  /** Where they finished last season, so the player can see what they are joining. */
  position: number;
  /** Why they want you. */
  pitch: string;
}

/** A move that happened, for the legacy screen. */
export interface TransferRecord {
  season: number;
  from: string;
  to: string;
  fee: number;
}

/**
 * How attractive the player is, 0-100.
 *
 * Reputation is most of it, because that is what a selling club sells and a
 * buying club buys. Goals and form are the evidence for it.
 */
export function reputation(career: CareerState): number {
  const form = career.form.length
    ? career.form.reduce((s, r) => s + r, 0) / career.form.length
    : 6.5;
  return Math.max(0, Math.min(100,
    (career.starRating / 5) * 100 * 0.45
    + Math.min(1, career.seasonStats.goals / 22) * 100 * 0.22
    + ((form - 5) / 4) * 100 * 0.18
    + Math.min(1, career.fame / 80) * 100 * 0.15,
  ));
}

/** What a club of this strength demands before it comes calling. */
function interestThreshold(strength: number, mine: number): number {
  // Judged against your own club, so the same player is a target for a smaller
  // side and a gamble for a bigger one.
  return Math.max(8, Math.min(96, 34 + (strength - mine) * 2.2));
}

/**
 * Who wants you this summer.
 *
 * At most three, best first. A contract running out brings more interest, the
 * way it does in football — a club that can have you for nothing is likelier to
 * ask.
 */
export function generateOffers(career: CareerState, rng: () => number): TransferOffer[] {
  const rep = reputation(career);
  const table = sortLeague(career.league);
  const mine = career.league.find(t => t.name === career.player.club)?.strength ?? 65;
  const expiring = career.contract.seasonsRemaining <= 1;

  const interested = table
    .map((t, i) => ({ team: t, position: i + 1 }))
    .filter(({ team }) => team.name !== career.player.club)
    .filter(({ team }) => {
      const need = interestThreshold(team.strength, mine) - (expiring ? 12 : 0);
      // A club that is interested does not always act on it.
      return rep >= need && rng() < 0.55 + (rep - need) / 240;
    })
    .sort((a, b) => b.team.strength - a.team.strength)
    .slice(0, 3);

  return interested.map(({ team, position }) => {
    const step = team.strength - mine;
    const wage = Math.max(1, Math.round(career.contract.wage * (1 + Math.max(0.1, step / 45)) + rep / 22));
    const seasons = 2 + Math.floor(rng() * 3);
    return {
      club: team.name,
      strength: team.strength,
      position,
      wage,
      goalBonus: Math.max(1, Math.round(career.contract.goalBonus + rep / 30)),
      assistBonus: Math.max(1, Math.round(career.contract.assistBonus + rep / 45)),
      seasons,
      signingFee: Math.round(wage * seasons * (0.6 + rng() * 0.8)),
      pitch: step > 6
        ? `${team.name} finished ${position}. They think you are ready for the step up.`
        : step < -6
          ? `${team.name} want you to be the player they build around.`
          : `${team.name} see you as an upgrade on what they have.`,
    };
  });
}

/**
 * What a move costs you beyond the football.
 *
 * A dressing room you have just walked into does not owe you anything, and a
 * manager who has never picked you has no reason to yet. These are the numbers
 * that stop "always take the biggest wage" from being the only sane play.
 */
export const MOVE_RESET = {
  /** Team-mates start from scratch. */
  team: 52,
  /** So does the manager, a little more generously — he signed you. */
  boss: 62,
  /** New supporters know your name but not much else. */
  fansCap: 55,
  matchFitness: -8,
} as const;

export function acceptOffer(career: CareerState, offer: TransferOffer): CareerState {
  const contract: Contract = {
    club: offer.club,
    wage: offer.wage,
    goalBonus: offer.goalBonus,
    assistBonus: offer.assistBonus,
    seasonsRemaining: offer.seasons,
  };
  const record: TransferRecord = {
    season: career.season,
    from: career.player.club,
    to: offer.club,
    fee: offer.signingFee,
  };

  return {
    ...career,
    player: { ...career.player, club: offer.club, clubBadge: null },
    contract,
    money: career.money + offer.signingFee,
    relationships: {
      ...career.relationships,
      team: MOVE_RESET.team,
      boss: MOVE_RESET.boss,
      fans: Math.min(career.relationships.fans, MOVE_RESET.fansCap),
    },
    matchFitness: Math.max(20, career.matchFitness + MOVE_RESET.matchFitness),
    // A new club is a new set of team-mates. Keeping the old squad sheet would
    // have you setting up players who are still at your previous club.
    squad: generateSquad(clubNameSeed(offer.club)),
    transfers: [...(career.transfers ?? []), record],
    // A new club is a new number and no armband. Both have to be earned again,
    // which is a large part of what a move actually costs.
    squadNumber: assignSquadNumber(career, offer.club),
    captain: false,
    clubAppearances: 0,
    // Star milestones are club-specific offers; a new contract resets the run.
    contractStarMilestones: [],
    contractFormOfferSeason: -1,
  };
}
