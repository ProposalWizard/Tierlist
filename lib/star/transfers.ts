import type { CareerState, Contract } from "./types";
import { kitsOf } from "./kits";
import { sortLeague } from "./season";
import { generateSquad, clubNameSeed } from "./squadData";
import { assignSquadNumber } from "./recognition";
import { makeManager, bossOnArrival } from "./manager";
import { offerClauses, canTriggerClause } from "./contracts";
import { isDerby, strongestTier } from "./rivalries";

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
  /** Clauses this club is willing to write in. */
  clauses: Partial<import("./types").Contract>;
  /** True when they met your release clause rather than being talked into it. */
  viaClause?: boolean;
  /** Where they finished last season, so the player can see what they are joining. */
  position: number;
  /** Why they want you. */
  pitch: string;
  /**
   * Which division this offer is actually from.
   *
   * Absent from the ordinary summer window, where every offer is by
   * definition from your own division. Set by generateRelegationOffers,
   * where it is not — an offer can come from a Premier League club while
   * you are in the Championship, and the UI needs to say so correctly
   * rather than guess it from a strength gap that a strong Championship
   * survivor could cross just as easily as a real top-flight side.
   */
  division?: "championship" | "premier";
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

/**
 * How likely your own club's rival even looks your way, whatever your
 * reputation says — 1 for no rivalry at all. The same shape as
 * leagueTransfers.ts's `rivalrySellChance`, read from the other side: a big
 * club selling to its rival and a big club COURTING its rival's player are
 * the same reluctance from two different desks.
 */
export function rivalInterestOdds(playerClub: string, suitorClub: string): number {
  const tier = strongestTier(playerClub, suitorClub);
  const derby = isDerby(playerClub, suitorClub);
  if (!tier && !derby) return 1;
  return tier === "R1" ? 0.05 : tier === "R2" ? 0.2 : tier === "R3" ? 0.5 : 0.55; // derby-only, no tier
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
      // A release clause is a price at which the club cannot say no, so a side
      // that can meet it comes for you whatever your reputation says — even a
      // rival, the one thing a release clause is actually FOR.
      if (canTriggerClause(career.contract, team.strength, career.contract.wage)) return true;
      // Your own club's biggest rival essentially never comes calling — the
      // same reluctance the other nineteen clubs' own transfer business
      // already has (see leagueTransfers.ts's rivalrySellChance), applied to
      // interest shown in YOU rather than a sale of somebody else.
      if (rng() > rivalInterestOdds(career.player.club, team.name)) return false;
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
      clauses: offerClauses(career, wage, rng),
      viaClause: canTriggerClause(career.contract, team.strength, career.contract.wage),
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
    ...offer.clauses,
  };
  const record: TransferRecord = {
    season: career.season,
    from: career.player.club,
    to: offer.club,
    fee: offer.signingFee,
  };

  const manager = makeManager(career, offer.club, career.season + 1);

  return {
    ...career,
    player: { ...career.player, club: offer.club, clubBadge: null },
    // A different club is a different shirt. Signing for Everton and playing on
    // in red would be a strange way to be unveiled — and the media graphics
    // build their palette off these two.
    kitPrimary: kitsOf(offer.club).home.shirt,
    kitSecondary: kitsOf(offer.club).home.trim,
    // A different club is a different man in the dugout, and he has never picked
    // you either.
    manager,
    managerNews: null,
    contract,
    money: career.money + offer.signingFee,
    relationships: {
      ...career.relationships,
      team: MOVE_RESET.team,
      boss: Math.min(MOVE_RESET.boss, bossOnArrival(career)),
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
