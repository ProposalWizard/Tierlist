import type { CareerState, LeaguePlayer } from "./types";
import type { TransferOffer } from "./transfers";
import { reputation, rivalInterestOdds } from "./transfers";
import { fameOf } from "./fame";
import { displayOverall } from "./rating";
import { membershipOf, estimateClubStrength, type DivisionMembership } from "./promotion";
import { sortLeague } from "./season";
import { divisionOf, divisionAbove, ALL_DIVISIONS, type CareerDivision } from "./calendar";
import { offerClauses, rescaleClauses } from "./contracts";
import {
  offerWageFor, weeklyWageFor, offerStanding, goalBonusFor, assistBonusFor, signingOnFee,
} from "./economy";

/**
 * ── 18 Oct 2026: the asking screen is gone ──
 * "Find a new club" (ask a league any week) was replaced by the transfer
 * window's list of interested clubs: lib/star/transferInterest.ts and
 * components/star/TransferHub.tsx ("It should only be in the transfer
 * windows, which are January and the summer"). Nothing in the game calls
 * askForMove/summerWindowOffers any more; squadNeed, positionGroup,
 * playerOverall and the constants below are still used by transferInterest.ts.
 *
 * ASKING FOR A MOVE (roadmap #2, Leo 11 Oct 2026).
 *
 * Before this, a move was something that happened TO you: up to three clubs
 * at the end of a season, or you stayed. Now you can pick a league (any of
 * the seven English divisions this career can play) and, if you want, one
 * club in it, and ask. Every club answers yes or no, with a reason.
 *
 * What a club weighs, in one number (`score`, higher is better for you):
 *
 *   your overall (displayOverall, 30-100) − the club's level (its strength)
 *   + a little for form, fame and youth, − a little for age   (capped ±8)
 *   ± squad need: 3+ players in your position better than you is −6;
 *                 nobody better than you there is +3.
 *
 * They say yes at `YES_LINE` (−4) or above, give or take a small seeded
 * wobble. So a 60 asking a Premier League club (level ~78-86) is at best
 * −10: always no. An 85 is around 0 to +7: mostly yes.
 *
 * WHEN IT HAPPENS. While the January window is open, an agreed deal can be
 * signed there and then ("Join now"): you join the new club mid-season, at
 * the week you are at (januaryTransfer.ts). Otherwise it is signed in the
 * SUMMER window, at the end of the season: it sits at the top of the
 * end-of-season offers screen.
 *
 * WHAT IT COSTS. Asking upsets your manager: −8 for sounding out a whole
 * league, −4 for one club. One ask a week. A club that says no can be asked
 * again after `REFUSAL_COOLDOWN_WEEKS`.
 */

// ── The numbers ─────────────────────────────────────────────────────────────

export const YES_LINE = -4;
export const ADJUST_CAP = 8;
export const CROWDED_PENALTY = 6;
export const NEED_BONUS = 3;
/** Players in your position better than you before a club calls itself full. */
export const CROWDED_AT = 3;
export const ASK_LEAGUE_BOSS_COST = 8;
export const ASK_CLUB_BOSS_COST = 4;
export const REFUSAL_COOLDOWN_WEEKS = 6;
/** How often an interested club simply isn't looking right now. */
export const NOT_LOOKING_CHANCE = 0.25;
/** A club whose own pay is under this share of yours cannot afford you. */
export const AFFORD_SHARE = 0.35;

// ── State kept on the career ────────────────────────────────────────────────

export type ReplyReason = "level" | "crowded" | "rival" | "money" | "not-looking" | "age" | "talks";

export type SquadRole = "Star man" | "First team" | "Rotation" | "Squad player";

export interface ClubReply {
  club: string;
  division: CareerDivision;
  strength: number;
  yes: boolean;
  /** One plain sentence, from the club. */
  message: string;
  reason?: ReplyReason;
  role?: SquadRole;
  offer?: TransferOffer;
}

export interface TransferRequestState {
  /** The week of the last ask: one ask a week. */
  lastAsk?: { season: number; week: number };
  /** The league last asked, so the screen reopens on it. */
  league?: CareerDivision;
  /** The most recent answers. */
  replies: ClubReply[];
  /** Club → the week ordinal (`weekOrdinal`) from which it can be asked again. */
  refused: Record<string, number>;
  /** A deal you said yes to. Signed in the summer window. */
  agreed?: TransferOffer;
  /** How many times you have asked, this career. */
  asks: number;
}

export function emptyRequest(): TransferRequestState {
  return { replies: [], refused: {}, asks: 0 };
}

export function requestOf(career: CareerState): TransferRequestState {
  return career.transferRequest ?? emptyRequest();
}

/** A single comparable number for "this week of this season". */
export function weekOrdinal(season: number, week: number): number {
  return season * 100 + week;
}

// ── Who is in a league ──────────────────────────────────────────────────────

const MEMBERSHIP_KEY: Record<CareerDivision, keyof DivisionMembership> = {
  premier: "premier", championship: "championship", league_one: "leagueOne",
  league_two: "leagueTwo", national_league: "nationalLeague",
  national_league_north: "nationalLeagueNorth", national_league_south: "nationalLeagueSouth",
};

/** The leagues you can ask about: every English division this career can play. */
export const ASKABLE_LEAGUES: readonly CareerDivision[] = ALL_DIVISIONS;

/** Every club in a division this season, strongest first, never your own. */
export function clubsIn(career: CareerState, division: CareerDivision): { club: string; strength: number }[] {
  const names = division === divisionOf(career)
    ? career.league.map(t => t.name)
    : membershipOf(career)[MEMBERSHIP_KEY[division]];
  return names
    .filter(n => n !== career.player.club)
    .map(club => ({ club, strength: estimateClubStrength(career, club) }))
    .sort((a, b) => b.strength - a.strength);
}

/** Where a club sits in its own division: the real table for yours, strength for the rest. */
function positionIn(career: CareerState, division: CareerDivision, club: string): number {
  if (division === divisionOf(career)) {
    const at = sortLeague(career.league).findIndex(t => t.name === club);
    if (at >= 0) return at + 1;
  }
  const ordered = [
    ...clubsIn(career, division),
    { club: career.player.club, strength: estimateClubStrength(career, career.player.club) },
  ].filter((c, i, a) => a.findIndex(x => x.club === c.club) === i)
    .filter(c => division !== divisionOf(career) || c.club !== career.player.club)
    .sort((a, b) => b.strength - a.strength);
  const at = ordered.findIndex(c => c.club === club);
  return at >= 0 ? at + 1 : ordered.length;
}

// ── Squad need, from real squad data where the career has it ────────────────

type Group = "GK" | "DEF" | "MID" | "WIDE" | "ATT";

export function positionGroup(position: string): Group {
  switch (position) {
    case "GK": return "GK";
    case "CB": case "LB": case "RB": case "LWB": case "RWB": return "DEF";
    case "CDM": case "CM": case "CAM": return "MID";
    case "LW": case "RW": case "LM": case "RM": return "WIDE";
    default: return "ATT";
  }
}

const GROUP_WORD: Record<Group, string> = {
  GK: "keepers", DEF: "defenders", MID: "midfielders", WIDE: "wingers", ATT: "strikers",
};

const NUMBER_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

export interface SquadNeed {
  /** False when this career holds no squad for the club. */
  known: boolean;
  /** Players in your position group who are better than you. */
  better: number;
  group: Group;
}

export function squadNeed(career: CareerState, club: string, overall: number): SquadNeed {
  const group = positionGroup(career.player.position);
  const squad = [...(career.leagueSquads ?? []), ...(career.externalSquads ?? [])]
    .find(s => s.club === club);
  if (!squad || squad.players.length === 0) return { known: false, better: 0, group };
  const better = squad.players
    .filter((p: LeaguePlayer) => positionGroup(p.position) === group && p.overall >= overall)
    .length;
  return { known: true, better, group };
}

// ── One club's answer ───────────────────────────────────────────────────────

/** Your overall on the same 30-100 scale every screen shows. */
export function playerOverall(career: CareerState): number {
  return displayOverall(career.starRating);
}

/** Form, fame and age, as one adjustment capped at ±ADJUST_CAP. */
export function personalAdjustment(career: CareerState): number {
  const form = career.form.length
    ? career.form.reduce((s, r) => s + r, 0) / career.form.length
    : 6.5;
  const formAdj = Math.max(-5, Math.min(5, (form - 6.8) * 4));
  const fameAdj = Math.min(1, Math.max(0, fameOf(career) / 100)) * 4;
  const age = career.player.age;
  const ageAdj = age <= 20 ? 4 : age <= 23 ? 2 : age <= 29 ? 0 : age <= 31 ? -2 : -(age - 31) * 3;
  return Math.max(-ADJUST_CAP, Math.min(ADJUST_CAP, formAdj + fameAdj + ageAdj));
}

function roleFor(score: number): SquadRole {
  return score >= 10 ? "Star man" : score >= 4 ? "First team" : score >= YES_LINE + 3 ? "Rotation" : "Squad player";
}

const ROLE_PITCH: Record<SquadRole, string> = {
  "Star man": "You'd be the player we build around.",
  "First team": "You'd start most weeks.",
  Rotation: "You'd be in the rotation and play your way in.",
  "Squad player": "You'd have to fight for a place.",
};

/**
 * One club's answer. Draws exactly four numbers from `rng` whatever the
 * outcome, so a club's answer never shifts the clubs after it.
 */
export function judgeClub(
  career: CareerState, club: string, division: CareerDivision, rng: () => number,
): ClubReply {
  const rRival = rng();
  const rNoise = rng();
  const rLooking = rng();
  const rDeal = rng();

  const overall = playerOverall(career);
  const strength = estimateClubStrength(career, club);
  const need = squadNeed(career, club, overall);
  const crowded = need.known && need.better >= CROWDED_AT;
  const wanted = need.known && need.better === 0;
  const score = overall - strength + personalAdjustment(career)
    - (crowded ? CROWDED_PENALTY : 0) + (wanted ? NEED_BONUS : 0);
  const wobbled = score + (rNoise - 0.5) * 4;
  const base = { club, division, strength };

  if (rRival > rivalInterestOdds(career.player.club, club)) {
    return { ...base, yes: false, reason: "rival", message: `Not from ${career.player.club}. Not ever.` };
  }
  if (wobbled < YES_LINE) {
    if (crowded && overall - strength >= YES_LINE) {
      const n = NUMBER_WORD[need.better] ?? String(need.better);
      return { ...base, yes: false, reason: "crowded", message: `We have ${n} ${GROUP_WORD[need.group]} better than you.` };
    }
    if (career.player.age >= 32 && overall - strength >= YES_LINE) {
      return { ...base, yes: false, reason: "age", message: "We're building a younger side." };
    }
    return {
      ...base, yes: false, reason: "level",
      message: wobbled < YES_LINE - 8 ? "You're not good enough for us yet." : "Close. Have a big season and ask again.",
    };
  }
  const rep = reputation(career);
  const step = strength - estimateClubStrength(career, career.player.club);
  const theirPay = weeklyWageFor(club, division, offerStanding(rep, step), career);
  if (career.contract.wage > 0 && theirPay < career.contract.wage * AFFORD_SHARE) {
    return { ...base, yes: false, reason: "money", message: "We can't pay what you're on." };
  }
  if (rLooking < NOT_LOOKING_CHANCE) {
    const g = GROUP_WORD[need.group];
    return { ...base, yes: false, reason: "not-looking", message: `We're not looking for ${g} right now.` };
  }

  const role = roleFor(score);
  // A club that pays less than you are on offers what it pays: a step down
  // is a pay cut. One that pays more uses the ordinary offer wage, which
  // never goes under what you are on now.
  const wage = theirPay < career.contract.wage
    ? Math.max(1, Math.round(theirPay))
    : offerWageFor(club, division, rep, step, career.contract.wage, career);
  // A seeded stream of its own for the terms, so the clause roll cannot
  // change how many numbers the decision above used.
  let s = Math.floor(rDeal * 2 ** 31) || 1;
  const dealRng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const seasons = 2 + Math.floor(dealRng() * 3);
  const offer: TransferOffer = {
    club,
    strength,
    position: positionIn(career, division, club),
    wage,
    goalBonus: goalBonusFor(wage),
    assistBonus: assistBonusFor(wage),
    seasons,
    signingFee: Math.max(1, Math.round(signingOnFee(club, wage) * (0.8 + dealRng() * 0.4))),
    clauses: offerClauses(career, wage, dealRng),
    division,
    pitch: `${ROLE_PITCH[role]} The move you asked for.`,
  };
  return { ...base, yes: true, role, message: ROLE_PITCH[role], offer };
}

// ── Asking ──────────────────────────────────────────────────────────────────

export type AskBlock =
  | { ok: true }
  | { ok: false; why: "asked-this-week" | "agreed" | "no-club" };

export function canAsk(career: CareerState): AskBlock {
  if (!career.player.club || career.league.length === 0) return { ok: false, why: "no-club" };
  const req = requestOf(career);
  if (req.agreed) return { ok: false, why: "agreed" };
  if (req.lastAsk && req.lastAsk.season === career.season && req.lastAsk.week === career.week) {
    return { ok: false, why: "asked-this-week" };
  }
  return { ok: true };
}

/** Weeks until this club can be asked again (0 = now). */
export function weeksUntilAskable(career: CareerState, club: string): number {
  const until = requestOf(career).refused[club];
  if (until === undefined) return 0;
  const now = weekOrdinal(career.season, career.week);
  // A new season counts as having waited long enough.
  if (Math.floor(until / 100) < career.season) return 0;
  return Math.max(0, until - now);
}

/** A seed for one ask, stable for the week (asking twice is blocked anyway). */
export function askSeed(career: CareerState): number {
  return career.season * 104729 + career.week * 7919 + Math.round(career.fame);
}

/**
 * Ask a whole league (`club` absent) or one club. Returns the career with
 * the answers stored and the manager's mood paid. Clubs still cooling off
 * after a no are skipped. Your own club is never asked.
 */
export function askForMove(
  career: CareerState, division: CareerDivision, club: string | undefined, rng: () => number,
): CareerState {
  if (!canAsk(career).ok) return career;
  const req = requestOf(career);
  const now = weekOrdinal(career.season, career.week);
  const targets = clubsIn(career, division)
    .filter(c => !club || c.club === club)
    .filter(c => weeksUntilAskable(career, c.club) === 0);
  if (targets.length === 0) return career;

  const replies = targets.map(t => judgeClub(career, t.club, division, rng));
  const refused = { ...req.refused };
  for (const r of replies) {
    if (r.yes) delete refused[r.club];
    else refused[r.club] = now + REFUSAL_COOLDOWN_WEEKS;
  }
  const cost = club ? ASK_CLUB_BOSS_COST : ASK_LEAGUE_BOSS_COST;
  return {
    ...career,
    relationships: { ...career.relationships, boss: Math.max(0, career.relationships.boss - cost) },
    transferRequest: {
      ...req,
      lastAsk: { season: career.season, week: career.week },
      league: division,
      replies: [...replies].sort((a, b) => Number(b.yes) - Number(a.yes) || b.strength - a.strength),
      refused,
      asks: req.asks + 1,
    },
  };
}

/** Say yes to a club's offer, at its own wage or a wage you talked them to. */
export function agreeMove(career: CareerState, offer: TransferOffer, agreedWage?: number): CareerState {
  const req = requestOf(career);
  const wage = agreedWage ?? offer.wage;
  const agreed: TransferOffer = wage === offer.wage ? offer : {
    ...offer,
    wage,
    goalBonus: goalBonusFor(wage),
    assistBonus: assistBonusFor(wage),
    clauses: rescaleClauses(offer.clauses, offer.wage, wage),
  };
  return { ...career, transferRequest: { ...req, agreed } };
}

/** Talks over terms broke down: the club withdraws and cools off. */
export function talksFailed(career: CareerState, club: string): CareerState {
  const req = requestOf(career);
  const now = weekOrdinal(career.season, career.week);
  return {
    ...career,
    transferRequest: {
      ...req,
      replies: req.replies.map(r => r.club === club
        ? { ...r, yes: false, reason: "talks" as const, message: "Talks broke down. We've moved on.", offer: undefined, role: undefined }
        : r),
      refused: { ...req.refused, [club]: now + REFUSAL_COOLDOWN_WEEKS },
    },
  };
}

/** Call off an agreed move. No extra cost: the damage was done by asking. */
export function callOffMove(career: CareerState): CareerState {
  const req = requestOf(career);
  if (!req.agreed) return career;
  return { ...career, transferRequest: { ...req, agreed: undefined } };
}

/** The summer window has been and gone: the deal is signed or turned down. */
export function clearAfterWindow(career: CareerState): CareerState {
  if (!career.transferRequest) return career;
  return { ...career, transferRequest: { ...career.transferRequest, agreed: undefined, replies: [] } };
}

// ── The end-of-season window ────────────────────────────────────────────────

/** How many extra clubs come in after a good season. */
export function bonusOfferCount(career: CareerState): number {
  const rep = reputation(career);
  return rep >= 75 ? 2 : rep >= 55 ? 1 : 0;
}

/**
 * More and better offers when you have been good: clubs from the division
 * above (and the top of your own) who would say yes if you asked. Same rules
 * as an ask; nothing here costs you anything.
 */
export function bonusSummerOffers(career: CareerState, rng: () => number, taken: string[] = []): TransferOffer[] {
  const n = bonusOfferCount(career);
  if (n === 0) return [];
  const own = divisionOf(career);
  const above = divisionAbove(own);
  const pool: { club: string; division: CareerDivision }[] = [
    ...(above ? clubsIn(career, above).map(c => ({ club: c.club, division: above })) : []),
    ...clubsIn(career, own).map(c => ({ club: c.club, division: own })),
  ].filter(c => !taken.includes(c.club));
  const yes = pool
    .map(c => judgeClub(career, c.club, c.division, rng))
    .filter(r => r.yes && r.offer)
    // A step up a division first: that is what a good season earns.
    .sort((a, b) => Number(b.division !== own) - Number(a.division !== own) || b.strength - a.strength)
    .slice(0, n);
  return yes.map(r => ({
    ...r.offer!,
    // Same-division offers keep the ordinary window's look (no league line).
    division: r.division === own ? undefined : r.division,
    pitch: `${r.club} have watched your season. ${r.message}`,
  }));
}

/**
 * Everything on the table when the season ends: the deal you agreed first,
 * then the ordinary offers, then the extra clubs a good season brings. One
 * card per club.
 */
export function summerWindowOffers(
  career: CareerState, ordinary: TransferOffer[], rng: () => number,
): TransferOffer[] {
  const agreed = requestOf(career).agreed;
  const first = agreed && agreed.club !== career.player.club
    ? [{ ...agreed, pitch: "The move you asked for. Terms agreed." }]
    : [];
  const base = [...first, ...ordinary];
  const seen = new Set<string>();
  const unique = base.filter(o => (seen.has(o.club) ? false : (seen.add(o.club), true)));
  const extra = bonusSummerOffers(career, rng, [...Array.from(seen), career.player.club]);
  return [...unique, ...extra];
}
