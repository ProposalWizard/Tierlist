import type { CareerState } from "./types";
import type { TransferOffer } from "./transfers";
import { reputation, rivalInterestOdds } from "./transfers";
import { membershipOf, estimateClubStrength, seasonLadder, type DivisionMembership, type LadderOutcome } from "./promotion";
import { sortLeague } from "./season";
import { ALL_DIVISIONS, divisionOf, divisionRank, DIVISION_ORDER, type CareerDivision } from "./calendar";
import { clubReputation, clubStanding } from "./clubReputation";
import { offerClauses, rescaleClauses } from "./contracts";
import { offerWageFor, offerStanding, weeklyWageFor, goalBonusFor, assistBonusFor, signingOnFee } from "./economy";
import { playerOverall, squadNeed, positionGroup, CROWDED_AT, AFFORD_SHARE } from "./transferRequest";

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
 *   D  (reach < 0)  your division and below, smaller clubs only
 *   C  (0)          your division
 *   B  (1)          + the division above
 *   A  (2)          + two above
 *   S  (3)          + three above (about 2 goals a game for a striker)
 *
 * Shown as a letter, S best (18 Oct 2026: "a classic lettering system …
 * makes you think, okay, I need to get an A next season instead of a B").
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
 * ── January (not in the game) ──
 *
 * Switched off 18 Oct 2026: "the only way you should be able to transfer is
 * from the summer window". The rules stay here for when it comes back: the
 * season so far, reach capped at 1 and 6 games needed. Nothing in the game
 * asks for a "january" list now.
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

export type SeasonGrade = "S" | "A" | "B" | "C" | "D";

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
  return reach < 0 ? "D" : reach < 1 ? "C" : reach < 2 ? "B" : reach < 3 ? "A" : "S";
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
// ── What your club is paid ──────────────────────────────────────────────────

/**
 * YOUR TRANSFER VALUE, by the league you play in (fixed 19 Oct 2026).
 *
 * Before: the fee ran your star-rating overall through playerMarketValue,
 * which is tuned for FIFA ratings (100 = the best player in the world). The
 * star overall reaches 100 at about 5 stars, so a National League striker on
 * ★30 a week showed "Your club gets ★406m", and every club offered the same.
 *
 * Now: each league has a band of what its players fetch, in the same money
 * as market values (real-world sized: a National League striker tens of
 * thousands, a Premier League one millions). Your star rating places you in
 * your league's band (low stars the bottom, 4.5+ stars near the top); youth
 * adds a little, age past 29 takes it away.
 */
export const FEE_BANDS: Record<number, [number, number]> = {
  0: [5_000, 75_000],          // National League North / South
  1: [10_000, 200_000],        // National League
  2: [25_000, 600_000],        // League Two
  3: [75_000, 2_500_000],      // League One
  4: [300_000, 15_000_000],    // Championship
  5: [3_000_000, 120_000_000], // Premier League
};
/** Each league a buyer sits above yours adds this share to the fee. */
export const FEE_PER_LEVEL_UP = 0.3;

/** Two significant figures: ★187,412 reads ★190k. */
function roundFee(v: number): number {
  if (v <= 0) return 0;
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / mag) * mag;
}

/** What you are worth in your own league, before any club's offer. */
export function yourTransferValue(career: CareerState): number {
  const [lo, hi] = FEE_BANDS[levelOf(divisionOf(career))] ?? FEE_BANDS[0];
  const t = Math.max(0, Math.min(1, (playerOverall(career) - 45) / 50));
  const age = career.player.age;
  const ageMult = age < 22 ? 1 + (22 - age) * 0.08 : age <= 29 ? 1 : Math.max(0.2, 1 - (age - 29) * 0.12);
  return roundFee(lo * Math.pow(hi / lo, t) * ageMult);
}

/** The fee one club pays your club: your value, more from a bigger league, a little either way per club. */
export function feeFrom(career: CareerState, division: CareerDivision, club: string, window: WindowKind): number {
  const up = Math.max(0, levelOf(division) - levelOf(divisionOf(career)));
  const wobble = 0.9 + seeded(career, window, club, 23) * 0.2;
  return Math.max(1, roundFee(yourTransferValue(career) * (1 + up * FEE_PER_LEVEL_UP) * wobble));
}

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

/**
 * How much a club wants you, strongest first (18 Oct 2026). It replaced
 * "Star man / First team / Rotation / Squad player", which read like a
 * promise of a place the game never kept: "keep the ability to understand
 * how much the club wants you by just changing the wording". It changes
 * nothing after you sign.
 */
export type InterestLevel = "Desperate" | "Very keen" | "Keen" | "Interested";

/** 4 for Desperate down to 1 for Interested (the bar on the screen). */
export const INTEREST_STEPS: Record<InterestLevel, number> = { Desperate: 4, "Very keen": 3, Keen: 2, Interested: 1 };

export interface InterestedClub {
  club: string;
  division: CareerDivision;
  position: number;
  of: number;
  /** How much they want you. */
  interest: InterestLevel;
  /** One plain sentence from the club. */
  why: string;
  /** What your club gets for you. */
  fee: number;
  offer: TransferOffer;
  /** In the Champions/Europa/Conference League this season (the NSS "CHAMPS" tag). */
  europe?: string;
  /** It changed league at the end of the season (the summer list is next season's leagues). */
  moved?: "promoted" | "relegated";
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
  /** Your league next season if you stay (after promotion or relegation). */
  ownDivision: CareerDivision;
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

function interestFor(margin: number): InterestLevel {
  return margin >= 0.9 ? "Desperate" : margin >= 0.45 ? "Very keen" : margin >= 0.15 ? "Keen" : "Interested";
}

const GROUP_WORD = { GK: "keeper", DEF: "defender", MID: "midfielder", WIDE: "winger", ATT: "striker" } as const;

function whyLine(level: InterestLevel, gap: boolean, group: keyof typeof GROUP_WORD, step: number): string {
  if (gap) return `We need a ${GROUP_WORD[group]}, and we want you.`;
  if (step >= 2) return "Nobody's had a season like yours. We want you up here.";
  if (level === "Desperate") return "We've wanted you all season.";
  if (level === "Very keen") return "You're top of our list.";
  if (level === "Keen") return "We like what we've seen.";
  return "We'd like to talk.";
}

/** The club's European competition this season, if the game knows it. */
function europeOf(career: CareerState, club: string): string | undefined {
  const e = career.euroState;
  if (e && e.clubs.some(c => c.name === club)) return e.competition;
  return undefined;
}

/** A league's list is A to Z (18 Oct 2026: "it should be ordered alphabetically"). */
function sortClubs(a: InterestedClub, b: InterestedClub): number {
  return a.club.localeCompare(b.club);
}

/** The keenest club in a league: the one the screen opens on. */
export function keenest(clubs: InterestedClub[]): InterestedClub | undefined {
  return [...clubs].sort((a, b) => INTEREST_STEPS[b.interest] - INTEREST_STEPS[a.interest] || clubReputation(b.club) - clubReputation(a.club))[0];
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

  // The summer list is NEXT season's leagues (Mikey, 19 Oct 2026: "whoever
  // got relegated from the Championship should be in the League One area").
  // The window opens before the rollover, so the clubs are moved here with
  // the rollover's own seed (seasonLadder): what you see is what happens.
  const next = window === "summer" ? safeLadder(career) : null;
  const ownNext = next?.division ?? own;
  const nextMembers = (d: CareerDivision): string[] => {
    if (!next) return membersOf(career, d);
    return d === ownNext ? next.clubs : [...next.divisions[MEMBERSHIP_KEY[d]]];
  };
  const before = previousDivisions(career);

  // Up to the ceiling above (always including your own league next season),
  // and always one league below yours: a player clubs above want is wanted
  // below too (Mikey, 19 Oct 2026).
  const lowest = levelOf(ownNext) - 1;
  const highest = Math.max(yourLevel + report.ceiling, levelOf(ownNext));
  const divisions = ALL_DIVISIONS
    .filter(d => {
      const lv = levelOf(d);
      return lv >= lowest && lv <= highest;
    })
    .sort((a, b) => levelOf(b) - levelOf(a));

  for (const division of divisions) {
    const clubs: InterestedClub[] = [];
    for (const club of nextMembers(division)) {
      if (club === career.player.club || gone.has(club)) continue;
      const was = before.get(club);
      const moved: InterestedClub["moved"] = was && was !== division
        ? (levelOf(division) > levelOf(was) ? "promoted" : "relegated") : undefined;
      if (seeded(career, window, club, 3) > rivalInterestOdds(career.player.club, club)) continue;
      const need = squadNeed(career, club, overall);
      const gap = need.known && need.better === 0;
      const crowded = need.known && need.better >= CROWDED_AT;
      const wobble = (seeded(career, window, club, 11) - 0.5) * 2 * WOBBLE;
      // A club that changed league is judged by its new league alone: where
      // it finished in the old one says nothing about its place in the new.
      const aim = moved ? levelOf(division) + (clubStanding(club, division) - 0.5) * 2 * AIM_REPUTATION : clubAim(career, was ?? division, club, window) - levelOf(was ?? division) + levelOf(division);
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
      const level = interestFor(margin);
      // Where it finished last season, in the league it played in.
      const { position, of } = finishOf(career, was ?? division, club, window);
      const why = whyLine(level, gap, group, levelOf(division) - yourLevel);
      const fee = feeFrom(career, division, club, window);
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
      clubs.push({ club, division, position, of, interest: level, why, fee, offer, europe: europeOf(career, club), ...(moved ? { moved } : {}) });
    }
    if (clubs.length) leagues.push({ division, clubs: clubs.sort(sortClubs) });
  }
  return { window, key: windowKey(career, window), report, leagues, ownDivision: ownNext };
}

/** Next season's ladder, or null if it can't be worked out (an odd old save). */
function safeLadder(career: CareerState): LadderOutcome | null {
  try { return seasonLadder(career); } catch { return null; }
}

/** The league each club played in this season. */
function previousDivisions(career: CareerState): Map<string, CareerDivision> {
  const out = new Map<string, CareerDivision>();
  const m = membershipOf(career);
  for (const d of ALL_DIVISIONS) for (const c of m[MEMBERSHIP_KEY[d]]) out.set(c, d);
  for (const t of career.league) out.set(t.name, divisionOf(career));
  return out;
}

/**
 * A loan that hit its number: the parent club wants you back. It goes into
 * its league's list (and brings the league in if nobody else there did).
 */
export function withRecall(interest: WindowInterest, recall: TransferOffer | null, career: CareerState): WindowInterest {
  if (!recall?.division || recall.club === career.player.club) return interest;
  const division = recall.division;
  const { position, of } = finishOf(career, division, recall.club, interest.window);
  const entry: InterestedClub = {
    club: recall.club, division, position, of, interest: "Desperate", why: recall.pitch, fee: 0,
    offer: { ...recall, position },
  };
  const leagues = interest.leagues.map(l => ({ ...l, clubs: l.clubs.filter(c => c.club !== recall.club) }));
  const at = leagues.find(l => l.division === division);
  if (at) at.clubs = [entry, ...at.clubs].sort(sortClubs);
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
