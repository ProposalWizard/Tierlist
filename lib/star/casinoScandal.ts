/**
 * CASINO SCANDALS — a night at the tables can reach the papers.
 *
 * Mikey, 11 Oct 2026: "if you go to the casino, you have potential to have a
 * scandal come out to the press … a lot of it is based upon how many bets you
 * do, because bets are basically a way of determining how much time you spent
 * in the casino … I don't think it should be that dependent on how much you
 * lose or win … 25% is a good cap." Plan: patch-notes/mikey/casino-scandals.html.
 *
 *  - The CHANCE comes from the number of bets in one visit (time spent) and
 *    your fame: 2% for the first bet, +0.4% for each one after, × fame,
 *    capped at 25%. Money never changes the chance.
 *  - One roll when you leave the casino; at most one story a week; for 4
 *    weeks after a story the chance is halved (the press have moved on).
 *  - The COST climbs with each story in the same season (steps 1-4). A visit
 *    where you lost 8+ weeks' wages is one step worse; won 8+ weeks', one
 *    step milder. Step 4 also bans you from the casino for 8 weeks.
 *
 * Pure: the caller passes the dice.
 */
import type { CareerState } from "./types";
import { fameLevel, fameOf, addFame } from "./fame";
import { clampReputation } from "./reputation";
import { brandScandal } from "./sponsorDeals";

export const SCANDAL_BASE = 2;          // % for the first bet
export const SCANDAL_PER_BET = 0.4;     // % for each bet after the first
export const SCANDAL_CAP = 25;          // % — never more, at any fame
export const SCANDAL_COOLDOWN_WEEKS = 4;
export const BIG_MONEY_WEEKS = 8;       // weeks' wages that make a loss or a win "big"
export const CASINO_BAN_WEEKS = 8;

/** How closely the press follow you, by fame level. */
export const FAME_WATCH: Record<string, number> = {
  "Unknown": 0.25, "Local Name": 0.5, "Rising Star": 0.75,
  "National Name": 1, "Global Star": 1.25, "Icon": 1.5,
};

/** The chance (in %) that one visit of `bets` bets makes a story. */
export function scandalChance(bets: number, fame: number, cooling = false): number {
  if (bets < 1) return 0;
  const raw = SCANDAL_BASE + SCANDAL_PER_BET * (bets - 1);
  const p = Math.min(SCANDAL_CAP, raw * (FAME_WATCH[fameLevel(fame).name] ?? 1));
  return cooling ? p / 2 : p;
}

export type CasinoStoryKind = "spotted" | "lost" | "won";
export type CasinoStep = 1 | 2 | 3 | 4;

export interface CasinoScandalState {
  season: number;
  /** Stories this season (the ladder; starts again each season). */
  count: number;
  /** The week of the last story (season, week). */
  lastSeason?: number;
  lastWeek?: number;
  /** Banned from the casino until this week of this season. */
  banSeason?: number;
  banUntilWeek?: number;
}

/** What one story costs, step by step (the plan page, agreed 11 Oct 2026). */
export const STEP_COST: Record<CasinoStep, { reputation: number; boss: number; fans: number; team: number; fame: number; fineWeeks: number; sponsors: boolean; notClean: boolean; loseCaptaincy: boolean; ban: boolean }> = {
  1: { reputation: -3, boss: 0, fans: -2, team: 0, fame: 1, fineWeeks: 0, sponsors: false, notClean: false, loseCaptaincy: false, ban: false },
  2: { reputation: -8, boss: -6, fans: -5, team: 0, fame: 2, fineWeeks: 0, sponsors: true, notClean: true, loseCaptaincy: false, ban: false },
  3: { reputation: -15, boss: -12, fans: 0, team: -6, fame: 3, fineWeeks: 2, sponsors: true, notClean: true, loseCaptaincy: true, ban: false },
  4: { reputation: -15, boss: -12, fans: 0, team: -6, fame: 3, fineWeeks: 2, sponsors: true, notClean: true, loseCaptaincy: true, ban: true },
};

/** Which step a story is: its number this season, one up for a big loss, one down for a big win. */
export function stepFor(storyNumber: number, kind: CasinoStoryKind): CasinoStep {
  const shift = kind === "lost" ? 1 : kind === "won" ? -1 : 0;
  return Math.max(1, Math.min(4, storyNumber + shift)) as CasinoStep;
}

/** The headline kind for a visit: a big loss, a big win, or just being seen. */
export function storyKind(net: number, wage: number): CasinoStoryKind {
  const big = Math.max(1, wage) * BIG_MONEY_WEEKS;
  if (net <= -big) return "lost";
  if (net >= big) return "won";
  return "spotted";
}

/** Whether the club has banned you from the casino right now. */
export function casinoBanned(career: CareerState): boolean {
  const s = career.casinoScandal;
  return !!s && s.banSeason === career.season && (s.banUntilWeek ?? 0) > career.week;
}

/** Weeks of the ban left (0 when free to go). */
export function casinoBanWeeksLeft(career: CareerState): number {
  const s = career.casinoScandal;
  return casinoBanned(career) ? (s!.banUntilWeek! - career.week) : 0;
}

export interface CasinoStory {
  kind: CasinoStoryKind;
  step: CasinoStep;
  bets: number;
  /** Money won (+) or lost (−) that visit. */
  net: number;
}

/**
 * Roll for a story at the end of one visit. `roll` is a draw in [0, 1).
 * Returns the career with the costs applied and the story, or the career
 * unchanged and null.
 */
export function rollCasinoScandal(career: CareerState, bets: number, net: number, roll: number): { career: CareerState; story: CasinoStory | null } {
  if (bets < 1) return { career, story: null };
  const prev = career.casinoScandal;
  const state: CasinoScandalState = prev && prev.season === career.season ? { ...prev } : { season: career.season, count: 0 };
  const weeksSince = state.lastSeason === career.season && state.lastWeek !== undefined ? career.week - state.lastWeek : Infinity;
  if (weeksSince === 0) return { career, story: null };   // one story a week at most
  const p = scandalChance(bets, fameOf(career), weeksSince < SCANDAL_COOLDOWN_WEEKS) / 100;
  if (roll >= p) return { career, story: null };

  const kind = storyKind(net, career.contract.wage);
  const step = stepFor(state.count + 1, kind);
  const c = STEP_COST[step];
  state.count += 1;
  state.lastSeason = career.season;
  state.lastWeek = career.week;
  if (c.ban) { state.banSeason = career.season; state.banUntilWeek = career.week + CASINO_BAN_WEEKS; }

  let next: CareerState = c.sponsors ? brandScandal(career, "a casino story") : career;
  next = {
    ...next,
    money: Math.max(0, next.money - c.fineWeeks * Math.max(0, next.contract.wage)),
    reputation: clampReputation(next.reputation + c.reputation),
    fame: addFame(next.fame, c.fame),
    relationships: {
      ...next.relationships,
      boss: clampReputation(next.relationships.boss + c.boss),
      fans: clampReputation(next.relationships.fans + c.fans),
      team: clampReputation(next.relationships.team + c.team),
    },
    casinoScandal: state,
    ...(c.notClean ? { lastScandalSeason: next.season } : {}),
    ...(c.loseCaptaincy && next.captain ? { captain: false } : {}),
  };
  return { career: next, story: { kind, step, bets, net } };
}

// ── Counting bets in one visit ────────────────────────────────────────────
// Every game calls noteCasinoBet() when it takes a stake; leaving the casino
// reads and clears the count. One spin, one hand, one race, one Goalie Mode
// run or one competition bet is one bet.

let betsThisVisit = 0;

export function noteCasinoBet(): void {
  betsThisVisit += 1;
}

export function takeCasinoVisitBets(): number {
  const n = betsThisVisit;
  betsThisVisit = 0;
  return n;
}
