import type { CareerState } from "./types";
import type { TransferOffer } from "./transfers";
import { reputation, rivalInterestOdds } from "./transfers";
import { membershipOf, estimateClubStrength, type DivisionMembership } from "./promotion";
import { sortLeague } from "./season";
import { ALL_DIVISIONS, divisionOf, divisionRank, DIVISION_ORDER, type CareerDivision } from "./calendar";
import { clubReputation, clubStanding } from "./clubReputation";
import { offerClauses, rescaleClauses } from "./contracts";
import { offerWageFor, offerStanding, weeklyWageFor, goalBonusFor, assistBonusFor, signingOnFee } from "./economy";
import { playerMarketValue } from "./marketValue";
import { playerOverall, squadNeed, positionGroup, CROWDED_AT, AFFORD_SHARE } from "./transferRequest";
import { januaryWindowOpen } from "./januaryTransfer";

/**
 * THE CLUBS INTERESTED IN YOU (rebuilt 18 Oct 2026, replacing "Find a new club").
 *
 * Asked for directly: transfers happen only in the windows (the summer break
 * and January), the clubs come to you, and the screen is New Star Soccer's:
 * nation → league → club → negotiate. Not asking a league any week; not
 * clubs judging you on your overall rating alone.
 *
 * ── Your season decides how high clubs can come from ──
 *
 * Your season gets a REACH, 0-3 (`seasonReach`): goals and assists a game for
 * a forward, match rating for everyone, a little for Star Man awards. Its
 * whole part is the hard ceiling, in divisions above yours:
 *
 *   Poor    (reach < 0)  your division and below, smaller clubs only
 *   Steady  (0)          your division
 *   Good    (1)          + the division above
 *   Great   (2)          + two above
 *   Crazy   (3)          + three above (about 2 goals a game for a striker)
 *
 * ── Which clubs, inside that ceiling ──
 *
 * Every club has an AIM (`clubAim`), on the same scale as you: its division's
 * level, plus a little for being a big club (reputation within its division)
 * and a little for having finished high. So Man United after 16th still aim
 * above West Ham after 15th, and Brighton after 14th aim lower than a
 * similar-sized Brentford after 8th. A club wants you when your level (your
 * division + your reach − EDGE) reaches its aim, give or take a little:
 *
 *   + a gap in your position (nobody better than you there)
 *   − three or more better than you there (crowded)
 *   ± a small seeded wobble per club, so the line is not a ruler
 *
 * The levels: National League North/South 0, National League 1, League Two 2,
 * League One 3, Championship 4, Premier League 5.
 *
 * ── January ──
 *
 * Same rules, on the season so far, with reach capped at 1 (one division up)
 * and 6 games needed. Climbing big happens in the summer.
 *
 * Everything is seeded by season and window, so the list is the same each
 * time you open it. A club that walks away in talks is gone for the window.
 */

// ── The numbers ─────────────────────────────────────────────────────────────

/** The most divisions above yours a club can come from, after a crazy season. */
export const MAX_REACH = 3;
/** January: at most one division up. */
export const JANUARY_MAX_REACH = 1;
/** Fewer games than this and the season says nothing: reach is capped at 0. */
export const MIN_APPS_SUMMER = 10;
export const MIN_APPS_JANUARY = 6;
/** How far reputation and finishing position move a club's aim (each ±). */
export const AIM_REPUTATION = 0.3;
export const AIM_FINISH = 0.3;
/** A gap in your position helps; a crowded position all but rules a club out. */
export const NEED_BONUS = 0.25;
export const CROWDED_PENALTY = 0.6;
/** The seeded wobble, ±. */
export const WOBBLE = 0.25;
/**
 * Your level sits this far under division + reach, so a division you have
 * only just reached opens with its smaller, lower-finishing clubs and fills
 * up as the season gets better (reach 1.0: a few; 1.5: about half; 1.9: most).
 */
export const EDGE = 0.5;

export type WindowKind = "summer" | "january";

export type SeasonGrade = "Poor" | "Steady" | "Good" | "Great" | "Crazy";

// ── Levels ──────────────────────────────────────────────────────────────────

/** 0 for North/South, 5 for the Premier League. */
export function levelOf(division: CareerDivision): number {
  return DIVISION_ORDER.length - divisionRank(division);
}

const MEMBERSHIP_KEY: Record<CareerDivision, keyof DivisionMembership> = {
  premier: "premier", championship: "championship", league_one: "leagueOne",
  league_two: "leagueTwo", national_league: "nationalLeague",
  national_league_north: "nationalLeagueNorth", national_league_south: "nationalLeagueSouth",
};

/** Every club in a division this season. */
export function membersOf(career: CareerState, division: CareerDivision): string[] {
  return division === divisionOf(career)
    ? career.league.map(t => t.name)
    : [...membershipOf(career)[MEMBERSHIP_KEY[division]]];
}

// ── Your season ─────────────────────────────────────────────────────────────

/** Straight lines between points; flat past both ends. */
function curve(x: number, pts: [number, number][]): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) {
      const [x0, y0] = pts[i - 1];
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Goals + half the assists, a game → reach. 2 a game is the crazy season. */
export const CONTRIBUTION_CURVE: [number, number][] = [[0, -0.5], [0.25, 0], [0.5, 1], [1, 2], [2, 3]];
/** Average match rating → reach. */
export const RATING_CURVE: [number, number][] = [[6.0, -0.5], [6.6, 0], [7.2, 1], [7.8, 2], [8.5, 3]];

export interface SeasonReport {
  apps: number;
  goals: number;
  assists: number;
  /** Average match rating, or null with no rated games. */
  rating: number | null;
  starMan: number;
  /** 0-3 (below 0 for a poor season). */
  reach: number;
  grade: SeasonGrade;
  /** How many divisions above yours can show interest. */
  ceiling: number;
}

export function gradeOf(reach: number): SeasonGrade {
  return reach < 0 ? "Poor" : reach < 1 ? "Steady" : reach < 2 ? "Good" : reach < 3 ? "Great" : "Crazy";
}

/** Your season (or, in January, your season so far), as a reach. */
export function seasonReport(career: CareerState, window: WindowKind = "summer"): SeasonReport {
  const s = career.seasonStats;
  const apps = s.appearances;
  const rating = s.ratingCount > 0 ? s.totalRating / s.ratingCount : null;
  const perGame = apps > 0 ? (s.goals + 0.5 * s.assists) / apps : 0;
  const ratingReach = rating === null ? 0 : curve(rating, RATING_CURVE);
  const group = positionGroup(career.player.position);
  let reach: number;
  if (group === "ATT") {
    reach = 0.7 * curve(perGame, CONTRIBUTION_CURVE) + 0.3 * ratingReach;
  } else if (group === "MID" || group === "WIDE") {
    // A midfielder's goals count for more: half a goal a game from midfield
    // is a forward's three-quarters.
    reach = 0.4 * curve(perGame * 1.5, CONTRIBUTION_CURVE) + 0.6 * ratingReach;
  } else {
    reach = ratingReach;
  }
  // Star Man most weeks: a little more.
  if (apps > 0) reach += 0.5 * Math.min(1, s.starMan / apps);
  const minApps = window === "january" ? MIN_APPS_JANUARY : MIN_APPS_SUMMER;
  if (apps < minApps) reach = Math.min(reach, 0);
  reach = Math.max(-1, Math.min(MAX_REACH, reach));
  const cap = window === "january" ? JANUARY_MAX_REACH : MAX_REACH;
  const ceiling = Math.max(0, Math.min(cap, Math.floor(reach)));
  return { apps, goals: s.goals, assists: s.assists, rating, starMan: s.starMan, reach, grade: gradeOf(reach), ceiling };
}

// ── A club's aim ────────────────────────────────────────────────────────────

/** A seeded 0-1 number for (season, window, club, salt). */
function seeded(career: CareerState, window: WindowKind, club: string, salt: number): number {
  let h = 2166136261 ^ (career.season * 2654435761) ^ (window === "january" ? 977 : 31) ^ salt;
  for (let i = 0; i < club.length; i++) { h ^= club.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Where a club finished (or, in January, where it sits): the real table for
 * your division; for the others, its strength with a seeded shake, since the
 * game does not play those leagues out week by week.
 */
export function finishOf(career: CareerState, division: CareerDivision, club: string, window: WindowKind = "summer"): { position: number; of: number } {
  if (division === divisionOf(career)) {
    const table = sortLeague(career.league);
    const at = table.findIndex(t => t.name === club);
    if (at >= 0) return { position: at + 1, of: table.length };
  }
  const names = membersOf(career, division);
  const order = names
    .map(n => ({ n, s: estimateClubStrength(career, n) + (seeded(career, window, n, 7) - 0.5) * 12 }))
    .sort((a, b) => b.s - a.s);
  const at = order.findIndex(o => o.n === club);
  return { position: at >= 0 ? at + 1 : order.length, of: order.length };
}

/** How good a player a club is looking for, on the same scale as your level. */
export function clubAim(career: CareerState, division: CareerDivision, club: string, window: WindowKind = "summer"): number {
  const standing = clubStanding(club, division); // 0 smallest .. 1 biggest in the division
  const { position, of } = finishOf(career, division, club, window);
  const finish = of > 1 ? (position - 1) / (of - 1) : 0.5; // 0 top .. 1 bottom
  return levelOf(division) + (standing - 0.5) * 2 * AIM_REPUTATION + (0.5 - finish) * 2 * AIM_FINISH;
}

// ── The list ────────────────────────────────────────────────────────────────

export type InterestRole = "Star man" | "First team" | "Rotation" | "Squad player";

export interface InterestedClub {
  club: string;
  division: CareerDivision;
  position: number;
  of: number;
  role: InterestRole;
  /** One plain sentence from the club. */
  why: string;
  /** What your club gets for you. */
  fee: number;
  offer: TransferOffer;
  /** In the Champions/Europa/Conference League this season (the NSS "CHAMPS" tag). */
  europe?: string;
}

export interface InterestLeague {
  division: CareerDivision;
  clubs: InterestedClub[];
}

export interface WindowInterest {
  window: WindowKind;
  key: string;
  report: SeasonReport;
  /** Leagues with at least one club in, highest first. */
  leagues: InterestLeague[];
}

export function windowKey(career: CareerState, window: WindowKind): string {
  return `${career.season}-${window}`;
}

/** Clubs that walked away in talks, this window. */
export function walkedAway(career: CareerState, window: WindowKind): string[] {
  const w = career.transferWindow;
  return w && w.key === windowKey(career, window) ? w.walkedAway : [];
}

/** Talks broke down: the club is off the list until the next window. */
export function markWalkedAway(career: CareerState, window: WindowKind, club: string): CareerState {
  const key = windowKey(career, window);
  const prev = career.transferWindow?.key === key ? career.transferWindow.walkedAway : [];
  return { ...career, transferWindow: { key, walkedAway: [...prev.filter(c => c !== club), club] } };
}

function roleFor(margin: number): InterestRole {
  return margin >= 0.9 ? "Star man" : margin >= 0.45 ? "First team" : margin >= 0.15 ? "Rotation" : "Squad player";
}

const GROUP_WORD = { GK: "keeper", DEF: "defender", MID: "midfielder", WIDE: "winger", ATT: "striker" } as const;

function whyLine(role: InterestRole, gap: boolean, group: keyof typeof GROUP_WORD, step: number): string {
  if (gap) return `We need a ${GROUP_WORD[group]}. You'd walk into the side.`;
  if (step >= 2) return "Nobody's had a season like yours. We want you up here.";
  if (role === "Star man") return "You'd be the player we build around.";
  if (role === "First team") return "You'd start most weeks.";
  if (role === "Rotation") return "You'd be in the rotation and play your way in.";
  return "You'd have to fight for a place.";
}

/** The club's European competition this season, if the game knows it. */
function europeOf(career: CareerState, club: string): string | undefined {
  const e = career.euroState;
  if (e && e.clubs.some(c => c.name === club)) return e.competition;
  return undefined;
}

/** The order the NSS screen lists them in: biggest first. */
function sortClubs(a: InterestedClub, b: InterestedClub): number {
  return clubReputation(b.club) - clubReputation(a.club) || a.position - b.position;
}

/**
 * Every club interested in you, this window. Empty leagues are left out.
 * Your own club, clubs that walked away and rivals that won't deal are never in it.
 */
export function windowInterest(career: CareerState, window: WindowKind): WindowInterest {
  const report = seasonReport(career, window);
  const own = divisionOf(career);
  const yourLevel = levelOf(own);
  const age = career.player.age;
  const ageAdj = age <= 21 ? 0.15 : age <= 29 ? 0 : age <= 31 ? -0.1 : -0.15 * (age - 31);
  const you = yourLevel + report.reach - EDGE + ageAdj;
  const gone = new Set(walkedAway(career, window));
  const overall = playerOverall(career);
  const group = positionGroup(career.player.position);
  const rep = reputation(career);
  const ownStrength = estimateClubStrength(career, career.player.club);
  const leagues: InterestLeague[] = [];

  // Up to the ceiling above. A division down only after a poor or steady
  // season: after a good one nobody steps down, and 24 clubs below would
  // bury the clubs that matter.
  const lowest = report.reach < 1 ? yourLevel - 1 : yourLevel;
  const divisions = ALL_DIVISIONS
    .filter(d => {
      const lv = levelOf(d);
      return lv >= lowest && lv <= yourLevel + report.ceiling;
    })
    .sort((a, b) => levelOf(b) - levelOf(a));

  for (const division of divisions) {
    const clubs: InterestedClub[] = [];
    for (const club of membersOf(career, division)) {
      if (club === career.player.club || gone.has(club)) continue;
      if (seeded(career, window, club, 3) > rivalInterestOdds(career.player.club, club)) continue;
      const need = squadNeed(career, club, overall);
      const gap = need.known && need.better === 0;
      const crowded = need.known && need.better >= CROWDED_AT;
      const wobble = (seeded(career, window, club, 11) - 0.5) * 2 * WOBBLE;
      const aim = clubAim(career, division, club, window);
      const margin = you + wobble + (gap ? NEED_BONUS : 0) - (crowded ? CROWDED_PENALTY : 0) - aim;
      if (margin < 0) continue;

      // Terms: the same wage rules as every other offer in the game.
      const strength = estimateClubStrength(career, club);
      const step = strength - ownStrength;
      const theirPay = weeklyWageFor(club, division, offerStanding(rep, step), career);
      if (career.contract.wage > 0 && theirPay < career.contract.wage * AFFORD_SHARE) continue;
      const wage = theirPay < career.contract.wage
        ? Math.max(1, Math.round(theirPay))
        : offerWageFor(club, division, rep, step, career.contract.wage, career);
      let s = Math.floor(seeded(career, window, club, 19) * 2 ** 31) || 1;
      const dealRng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      const role = roleFor(margin);
      const { position, of } = finishOf(career, division, club, window);
      const why = whyLine(role, gap, group, levelOf(division) - yourLevel);
      const fee = Math.max(1, playerMarketValue({ overall, age }, career.player.club, career));
      const offer: TransferOffer = {
        club,
        strength,
        position,
        wage,
        goalBonus: goalBonusFor(wage),
        assistBonus: assistBonusFor(wage),
        seasons: 2 + Math.floor(dealRng() * 3),
        signingFee: Math.max(1, Math.round(signingOnFee(club, wage) * (0.8 + dealRng() * 0.4))),
        clauses: offerClauses(career, wage, dealRng),
        division,
        pitch: why,
        transferFee: fee,
      };
      clubs.push({ club, division, position, of, role, why, fee, offer, europe: europeOf(career, club) });
    }
    if (clubs.length) leagues.push({ division, clubs: clubs.sort(sortClubs) });
  }
  return { window, key: windowKey(career, window), report, leagues };
}

/** Is the January list open right now (the window is open and you haven't moved this January)? */
export function januaryListOpen(career: CareerState): boolean {
  if (!januaryWindowOpen(career)) return false;
  return !(career.transfers ?? []).some(t => t.season === career.season && t.window === "january");
}

/**
 * A loan that hit its number: the parent club wants you back. It goes at the
 * top of its league's list (and brings the league in if nobody else there did).
 */
export function withRecall(interest: WindowInterest, recall: TransferOffer | null, career: CareerState): WindowInterest {
  if (!recall?.division || recall.club === career.player.club) return interest;
  const division = recall.division;
  const { position, of } = finishOf(career, division, recall.club, interest.window);
  const entry: InterestedClub = {
    club: recall.club, division, position, of, role: "First team", why: recall.pitch, fee: 0,
    offer: { ...recall, position },
  };
  const leagues = interest.leagues.map(l => ({ ...l, clubs: l.clubs.filter(c => c.club !== recall.club) }));
  const at = leagues.find(l => l.division === division);
  if (at) at.clubs = [entry, ...at.clubs];
  else leagues.push({ division, clubs: [entry] });
  return { ...interest, leagues: leagues.filter(l => l.clubs.length).sort((a, b) => levelOf(b.division) - levelOf(a.division)) };
}

/** The offer, at the wage agreed in talks (bonuses and clauses follow the wage). */
export function withAgreedWage(offer: TransferOffer, wage: number): TransferOffer {
  if (wage === offer.wage) return offer;
  return {
    ...offer, wage,
    goalBonus: goalBonusFor(wage),
    assistBonus: assistBonusFor(wage),
    clauses: rescaleClauses(offer.clauses, offer.wage, wage),
  };
}

/** Every club on the list, in one flat array. */
export function allInterested(interest: WindowInterest): InterestedClub[] {
  return interest.leagues.flatMap(l => l.clubs);
}
