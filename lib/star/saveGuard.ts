/**
 * SAVE GUARD — is this cloud save something the game could really have made?
 *
 * Harry, 7 Oct 2026: a career is worked out on the player's own device and
 * sent to the server whole. Anybody can open the browser's developer tools,
 * change `money` (or skills, or trophies) in the local save, refresh, and the
 * edited save used to go straight into the cloud. "We need to fix that…
 * ideally everything is safe and working."
 *
 * The server cannot replay the game, but it does keep the LAST TRUSTED save
 * for the same account and slot. This file compares the incoming save with
 * that one and asks, field by field: given how much of the season has passed
 * since then (and how much real time), could the game's own rules have moved
 * this number this far? Every limit is written from the rule that moves the
 * field (a wage is paid per week, a training star is earned per session, a
 * trophy is won per season), then made generous, and then checked against
 * simulated honest careers in tests/star/saveGuard.mts, which must produce
 * no findings at all.
 *
 * Pure: no database, no fetch, no React. app/api/star/career/route.ts calls
 * `checkSave` and does the storing and the logging.
 *
 * ── Three modes (env STAR_SAVE_GUARD) ──
 *
 *   observe (default)  store the save as sent, but return the findings so
 *                      the route can log them (star_save_flags). This is how
 *                      we learn the real false-alarm rate before acting.
 *   enforce            any field outside its limit goes back to the last
 *                      trusted value (money: to the most honest play could
 *                      have earned), and the route tells the game to reload.
 *   off                no checks at all.
 *
 * ── Two kinds of finding ──
 *
 *   cheat  outside every limit. Clamped in enforce mode.
 *   watch  unusual but possible: a big casino win, the calendar moving back
 *          (a player picking an older copy after a save clash). Logged only.
 *
 * ── The casino ──
 *
 * The casino lets a player stake the whole bank, again and again, at up to
 * 35× (roulette), 20× (slots) or ~3,500× (a 1-in-4,000 horse). So no money
 * limit can be exact. Money above what play could have earned is treated as
 * LUCK, measured in powers of ten (×10 = 1, ×1,000 = 3), and spent from a
 * luck allowance that holds ×2,000 and refills over a week. A real lucky
 * night fits; doing it every save does not. The route shares one allowance
 * across all of an account's slots.
 *
 * ── The casino on the server (8 Oct 2026) ──
 *
 * Once star_casino.sql has run, a signed-in player's casino is rolled and
 * paid by the server (app/api/star/casino/play), one row per play in
 * star_casino_plays. Then the luck allowance is not used at all: the route
 * passes `casinoNet`, the net the server itself recorded for this account
 * and slot since the last trusted save, and money above what play could earn
 * is allowed only up to that (plus what earlier saves were owed and had not
 * shown yet, `casinoCredit`). An edited bank no longer passes as "luck".
 * Without the table (`casinoNet` null) everything works as before.
 *
 * ── Real time ──
 *
 * The calendar cannot move faster than the game can be played. Weeks claimed
 * beyond `MIN_SECONDS_PER_WEEK` of real time since the last trusted save earn
 * nothing (no wages, no training), so editing the week forward buys nothing.
 */

import { DIVISION_BASE_WAGE, PREMIER_WAGE_CAP, REPUTATION_PREMIUM_MAX,
  SIGNING_ON_WEEKS_MAX, WAGE_FLOOR, standingMultiplier, tierWeeklyIncome, typicalWeeklyWage } from "./economy";
import { TRAINING_LEVELS, SKILL_MAX, skillFromStars, starsFromSkill } from "./trainingLevels";
import { BOOT_LEVELS, BOOTS_CATALOGUE_DEFAULT, KIB_CANS_DEFAULT, LIFESTYLE_LEVELS, LIFESTYLE_ITEMS_DEFAULT } from "./shopDefaults";
import { computeStarRating } from "./rating";
import type { CareerState } from "./types";

// ═══════════════════════════════════════════════════════════════════════
//  THE LIMITS — each one with the rule it comes from
// ═══════════════════════════════════════════════════════════════════════

/** A season is 38-46 league weeks, then the cup finals, play-offs and
 *  European finals after it (honest saves reach week 66). 100 per season
 *  keeps the calendar index strictly increasing. */
export const WEEKS_PER_SEASON_INDEX = 100;

/** Fastest honest pace: "Sim this match", then the post-match screens. A
 *  week cannot honestly take less than this. */
export const MIN_SECONDS_PER_WEEK = 4;
/** Weeks allowed on top of the real-time pace (a save just before and just
 *  after a match, a rollover). */
export const FREE_WEEKS = 3;

/** A week's money, as weeks of wage: the wage itself, goal and assist money
 *  (a hat-trick and two assists is 0.44), appearance money, sponsor pay and
 *  brand targets. economy.ts's TOTAL_INCOME_MULTIPLE is 1.4 on average;
 *  this is the most a single week can hold, with room to spare. */
export const WEEK_INCOME_WAGES = 6;
/** One-off money that can land between any two saves without a week
 *  passing: signing several sponsor categories at once (each 0.5-3 weeks of
 *  wage), a brand's signing-on (2 weeks), a sponsor objective bonus. */
export const SAVE_LUMP_WAGES = 30;
/** Money that only arrives at a season rollover: the loyalty bonus, every
 *  sponsor's season fee, Player-of-the-Season style rewards. */
export const SEASON_LUMP_WAGES = 40;
/** A move to a new club pays a signing-on fee of up to 12 weeks of wage. */
export const SIGNING_WAGES = SIGNING_ON_WEEKS_MAX + 2;
/** Flat money per week that does not follow the wage: a dilemma pays at most
 *  40 units of 0.1 week of elite income (dilemmas.ts, "Take the money"). */
export const FLAT_PER_WEEK = Math.round(40 * 0.1 * tierWeeklyIncome("elite"));
/** The testimonial (retirement.ts): ~1,000 points × 0.06 weeks of top-flight
 *  income at most. Paid once, when the career retires. */
export const TESTIMONIAL_MAX = Math.round(1200 * 0.06 * tierWeeklyIncome("world_class"));

/** A wage can rise this many times over in one save (a transfer two
 *  divisions up, a big renewal), or to the top wage two divisions up. */
export const WAGE_JUMP = 15;

/** Club stakes and owned clubs: a stake can be sold for at most this many
 *  times what was paid for it (the club's value grows with its squad). */
export const STAKE_GROWTH = 6;

/** The longest odds a competition bet can be placed at (tuning.ts's slider
 *  maximum for betting.maxOdds). */
export const MAX_BET_ODDS = 10_000;
/** The smallest casino chip (Casino.tsx BET_STEPS). */
export const MIN_STAKE = 2_000;

/** Luck allowance, in powers of ten: ×2,000 at most (two all-in roulette
 *  numbers in a row is ×1,296), refilling over a week. */
export const LUCK_CAP = Math.log10(2_000);
export const LUCK_REFILL_MS = 7 * 24 * 60 * 60 * 1000;
/** Saves closer together than this mean the game was online and saving as
 *  it went, so a casino win and a purchase cannot share one save. */
export const LONG_GAP_MS = 10 * 60 * 1000;
/** Server-recorded casino winnings a save has not shown yet are kept for this
 *  long (the bank only reaches the save when the player leaves the casino,
 *  and a horse race or a bet can save in between). */
export const CASINO_CREDIT_MS = 24 * 60 * 60 * 1000;

/** Training: two sessions a week (week.ts), counted as three to be safe.
 *  A session earns at most three new stars (trainingLevels.ts) and moves a
 *  skill by at most five points (two from new stars, three won back from
 *  decay). */
export const SESSIONS_PER_WEEK = 3;
export const FREE_SESSIONS = 3;
export const STARS_PER_SESSION = 3;
export const SKILL_PER_SESSION = 5;
/** A dilemma can add a skill point or two outside training (dilemmas.ts:
 *  "technique: 2" at most), so a skill may sit above its stars by this much
 *  per save, on top of what it already sat above them by. */
export const DILEMMA_SKILL = 2;

/** Matches a week can hold (league, cup, Europe, international). */
export const MATCHES_PER_WEEK = 3;
export const GOALS_PER_MATCH = 10;

/** Fame and reputation moves seen in honest play, made generous. */
export const FAME_PER_WEEK = 2;
export const FAME_PER_SEASON = 100;
export const FAME_LUMP = 40;
export const REP_PER_WEEK = 1;
export const REP_PER_SEASON = 25;
export const REP_LUMP = 15;

/** Silverware: at most this many trophies in one season (league, two cups,
 *  Europe, a Super Cup, a Community Shield, a new competition, Nations),
 *  one a week through the season, and a few on the same day (the league is
 *  handed over at the end, with a final that same week). */
export const TROPHIES_PER_SEASON = 9;
export const TROPHIES_PER_WEEK = 1;
export const TROPHY_LUMP = 3;
/** Monthly and season awards in one season. */
export const AWARDS_PER_SEASON = 30;
export const ACHIEVEMENTS_LUMP = 10;
export const ACHIEVEMENTS_PER_WEEK = 3;

/** Star rating can sit at most this far above what its own inputs give. */
export const STAR_RATING_SLACK = 0.05;

/** A shop item must have cost at least this share of its catalogue price
 *  (tuning can lower prices on a developer's own browser). */
export const PRICE_FLOOR_SHARE = 0.5;

// ═══════════════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════════════

export type GuardMode = "observe" | "enforce" | "off";

export function guardModeFrom(env: string | undefined | null): GuardMode {
  const v = (env ?? "").trim().toLowerCase();
  return v === "enforce" || v === "off" ? v : "observe";
}

export interface GuardFinding {
  /** The save field, e.g. "money" or "skills.pace". */
  field: string;
  level: "cheat" | "watch";
  was: number | null;
  now: number;
  limit: number;
  why: string;
}

/** Luck left, in powers of ten, and when it was last worked out. */
export interface LuckState {
  left: number;
  at: number;
}

/** Kept inside the stored career by the server (never trusted from the
 *  client: the route always replaces it). */
export interface ServerGuard {
  v: 1;
  luck: LuckState;
  /** Casino winnings the server recorded that no save has shown yet
   *  (server casino only). Spent as the bank rises. */
  casino?: { credit: number; at: number };
  /** Last time this save was checked (ms). */
  at: number;
}

export interface GuardContext {
  mode: GuardMode;
  /** Admins and testers: no checks (they have Add Money and god mode). */
  exempt?: boolean;
  now?: number;
  /** When the trusted save was stored (the row's updated_at), ms. */
  prevSavedAt?: number | null;
  /** The account's luck allowance (the route takes the lowest across slots). */
  luck?: LuckState | null;
  /** Net casino result the SERVER recorded for this account and slot since
   *  the last trusted save (star_casino_plays). null/undefined: the table
   *  is not there, so the luck allowance is used instead. */
  casinoNet?: number | null;
}

/** The handful of numbers worth logging next to a finding. */
export interface KeyNumbers {
  season: number; week: number; money: number; wage: number;
  starRating: number; fame: number; reputation: number;
  skills: number; trophies: number;
}

export interface GuardResult {
  /** No "cheat" findings. */
  ok: boolean;
  /** The save to store: the one sent, or (enforce) a corrected copy. */
  clamped: Record<string, unknown>;
  /** Fields put back (enforce only). Empty when nothing changed. */
  corrected: string[];
  findings: GuardFinding[];
  /** What the comparison was against. */
  against: "previous" | "new-career";
  prevKeys: KeyNumbers | null;
  nextKeys: KeyNumbers;
  guard: ServerGuard;
}

type Raw = Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════════════
//  SMALL READERS — the save is untrusted JSON, so nothing is assumed
// ═══════════════════════════════════════════════════════════════════════

const isObj = (v: unknown): v is Raw => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const SKILL_KEYS = ["pace", "power", "technique", "vision", "freeKick"] as const;
type SkillKey = (typeof SKILL_KEYS)[number];

/** Is this even shaped like a career? */
export function looksLikeCareer(v: unknown): v is Raw {
  return isObj(v) && v.version === 2 && isObj(v.player) && isObj(v.skills) && isObj(v.contract)
    && typeof v.season === "number" && typeof v.money === "number";
}

function skillsOf(c: Raw): Record<SkillKey, number> {
  const s = isObj(c.skills) ? c.skills : {};
  return Object.fromEntries(SKILL_KEYS.map(k => [k, num(s[k], 40)])) as Record<SkillKey, number>;
}

/** Stars earned on one skill (trainingLevels.ts's own rule for an old save
 *  with none saved: read them off the number). */
function starsOf(c: Raw, k: SkillKey, skill: number): number {
  const saved = isObj(c.trainingStars) ? c.trainingStars[k] : undefined;
  const levels = Array.isArray(saved) && saved.length === TRAINING_LEVELS
    ? saved.map(x => Math.max(0, Math.min(3, num(x))))
    : starsFromSkill(skill);
  return levels.reduce((a, b) => a + b, 0);
}

function wageOf(c: Raw): number { return num(isObj(c.contract) ? c.contract.wage : 0); }
function division(c: Raw): string { return typeof c.division === "string" ? c.division : "premier"; }

/** A number that only ever goes up through a career: season, then the
 *  fixture week, plus the weeks spent without a club (attachClub moves the
 *  week back to 1 and adds what it took off to gardenWeeks). */
export function calendarIndex(c: Raw): number {
  return num(c.season, 1) * WEEKS_PER_SEASON_INDEX + num(c.week, 1) + num(c.gardenWeeks, 0);
}

/** Game weeks between two saves. Across a rollover, the weeks left in the
 *  old season (after week 40, none) plus the weeks into the new one. */
export function weeksBetween(prev: Raw, next: Raw): number {
  const garden = Math.max(0, num(next.gardenWeeks) - num(prev.gardenWeeks));
  const seasons = num(next.season, 1) - num(prev.season, 1);
  if (seasons < 0) return 0;
  if (seasons === 0) return Math.max(0, num(next.week, 1) - num(prev.week, 1)) + garden;
  return Math.max(0, SEASON_END_WEEK - num(prev.week, 1)) + SEASON_WEEKS * (seasons - 1) + num(next.week, 1) + garden;
}

/** A Premier League season's last league week is 38-40; longer divisions
 *  run to 46 and their play-offs beyond. Weeks before this one at a rollover
 *  are counted as still to play. */
export const SEASON_END_WEEK = 40;
export const SEASON_WEEKS = 46;

function careerStat(c: Raw, k: string): number {
  return num(isObj(c.careerStats) ? c.careerStats[k] : 0);
}

export function keyNumbers(c: Raw): KeyNumbers {
  const sk = skillsOf(c);
  return {
    season: num(c.season), week: num(c.week), money: num(c.money), wage: wageOf(c),
    starRating: num(c.starRating), fame: num(c.fame), reputation: num(c.reputation),
    skills: SKILL_KEYS.reduce((a, k) => a + sk[k], 0), trophies: arr(c.trophies).length,
  };
}

/** A career that has only just begun: first season, nothing won. */
export function isFreshCareer(c: Raw): boolean {
  return num(c.season, 1) === 1 && c.retired !== true && arr(c.trophies).length === 0
    && num(c.ballonDorWins) === 0 && careerStat(c, "appearances") <= 60;
}

function samePlayer(a: Raw, b: Raw): boolean {
  const pa = isObj(a.player) ? a.player : {}, pb = isObj(b.player) ? b.player : {};
  return pa.firstName === pb.firstName && pa.lastName === pb.lastName && pa.startYear === pb.startYear;
}

/** What every career looks like before a ball is kicked (careerFlow.ts's
 *  makeIdentity): no money, every skill at its start, nothing won. */
export function genesisOf(next: Raw): Raw {
  return {
    version: 2, player: next.player, season: 1, week: 1, gardenWeeks: 0, money: 0,
    division: next.division,
    skills: { pace: 40, power: 40, technique: 40, vision: 40, freeKick: 40 },
    contract: { wage: 0 }, starRating: 0, fame: 1, reputation: 0,
    trophies: [], awards: [], achievements: [], ballonDorWins: 0,
    careerStats: { appearances: 0, goals: 0, assists: 0 },
    kibCans: { basic: 2, premium: 0, elite: 0 }, ownedItems: [],
    currentBoot: next.currentBoot && isObj(next.currentBoot) && next.currentBoot.id === BOOTS_CATALOGUE_DEFAULT[0]?.id
      ? next.currentBoot : { id: BOOTS_CATALOGUE_DEFAULT[0]?.id, matches: 0 },
    investments: [], competitionBets: [], transfers: [], coins: next.coins,
  };
}

/** The best wage the game pays in a division (economy.ts's own formula at
 *  star standing, top club premium), doubled. The Premier League has its
 *  own hard cap. */
export function wageCeiling(div: string, honours = true): number {
  // Without last season's title, a Champions League or a Ballon d'Or, the
  // best Premier League wage is the biggest club's star wage at 5★.
  if (div === "premier") return honours ? PREMIER_WAGE_CAP
    : Math.round(DIVISION_BASE_WAGE.premier * Math.sqrt(13.53) * standingMultiplier(1) * 1.5 * 1.25);
  const base = (DIVISION_BASE_WAGE as Record<string, number>)[div] ?? DIVISION_BASE_WAGE.national_league;
  return Math.round(base * (1 + REPUTATION_PREMIUM_MAX) * standingMultiplier(1) * 2);
}

const UP_TWO: Record<string, string> = {
  premier: "premier", championship: "premier", league_one: "premier", league_two: "championship",
  national_league: "league_one", national_league_north: "league_two", national_league_south: "league_two",
};

// ═══════════════════════════════════════════════════════════════════════
//  PRICES — what a newly owned thing must have cost
// ═══════════════════════════════════════════════════════════════════════

/** The cheapest the shop has ever listed each id at: the same id can sit in
 *  both the plain catalogue and the levelled one, at different prices. */
function cheapest<T extends { id: string }>(rows: T[], pick: (r: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.id, Math.min(m.get(r.id) ?? Infinity, pick(r)));
  return m;
}
const BOOT_PRICE = cheapest([...BOOTS_CATALOGUE_DEFAULT, ...BOOT_LEVELS], b => b.price);
/** Most matches a pair gives, so a stacked pair is never over-counted. */
const BOOT_MATCHES = new Map<string, number>();
for (const b of [...BOOTS_CATALOGUE_DEFAULT, ...BOOT_LEVELS]) BOOT_MATCHES.set(b.id, Math.max(BOOT_MATCHES.get(b.id) ?? 0, b.matches));
const ITEM_PRICE = cheapest([...LIFESTYLE_ITEMS_DEFAULT, ...LIFESTYLE_LEVELS], i => i.price);
const KIB_PRICE: Record<string, number> = Object.fromEntries(KIB_CANS_DEFAULT.map(k => [k.id, k.price]));


/** Money a save must have spent to own what it owns now that it did not
 *  before. Kib cans and boots can also come from the Coins store, so they
 *  count only when no Coins were spent. */
export function requiredSpend(prev: Raw, next: Raw): { spend: number; parts: string[] } {
  let spend = 0;
  const parts: string[] = [];
  const coinsSpent = num(prev.coins) > num(next.coins)
    || arr(next.storeLog).length !== arr(prev.storeLog).length;

  if (!coinsSpent) {
    const pk = isObj(prev.kibCans) ? prev.kibCans : {}, nk = isObj(next.kibCans) ? next.kibCans : {};
    for (const t of ["basic", "premium", "elite"]) {
      const more = Math.max(0, num(nk[t]) - num(pk[t]));
      if (more > 0) { spend += more * (KIB_PRICE[t] ?? 0) * PRICE_FLOOR_SHARE; parts.push("kibCans"); }
    }
    const pb = isObj(prev.currentBoot) ? prev.currentBoot : {}, nb = isObj(next.currentBoot) ? next.currentBoot : {};
    const id = String(nb.id ?? "");
    const price = BOOT_PRICE.get(id) ?? 0;
    if (price > 0) {
      const per = Math.max(1, BOOT_MATCHES.get(id) ?? 1);
      const pairs = id !== String(pb.id ?? "")
        ? (num(nb.matches) > 0 ? Math.max(1, Math.floor(num(nb.matches) / per)) : 0)
        : Math.max(0, Math.floor((num(nb.matches) - num(pb.matches)) / per));
      if (pairs > 0) { spend += pairs * price * PRICE_FLOOR_SHARE; parts.push("currentBoot"); }
    }
  }

  // A new item, or a worn-out one bought again (its seasons left go back up).
  const had = new Map(arr(prev.ownedItems).filter(isObj).map(o => [String(o.id), o]));
  for (const o of arr(next.ownedItems)) {
    if (!isObj(o)) continue;
    const was = had.get(String(o.id));
    if (was && !(o.seasonsLeft !== undefined && num(o.seasonsLeft) > num(was.seasonsLeft, Infinity))) continue;
    const p = ITEM_PRICE.get(String(o.id)) ?? num(o.price);
    if (p > 0) { spend += p * PRICE_FLOOR_SHARE; if (!parts.includes("ownedItems")) parts.push("ownedItems"); }
  }

  const stakes = new Map(arr(prev.investments).filter(isObj).map(s => [String(s.club), s]));
  for (const s of arr(next.investments).filter(isObj)) {
    const was = stakes.get(String(s.club));
    const more = num(s.percent) - num(was?.percent);
    if (more > 1e-6) {
      const val = Math.max(num(was?.avgBuyValuation), num(s.avgBuyValuation), 1);
      spend += (more / 100) * val * PRICE_FLOOR_SHARE;
      if (!parts.includes("investments")) parts.push("investments");
    }
  }

  const bets = new Set(arr(prev.competitionBets).filter(isObj).map(b => String(b.id)));
  for (const b of arr(next.competitionBets).filter(isObj)) {
    if (!bets.has(String(b.id))) { spend += Math.max(0, num(b.stake)); if (!parts.includes("competitionBets")) parts.push("competitionBets"); }
  }
  return { spend, parts };
}

/** Money that can come out of things already owned: selling club stakes,
 *  a president's wage drawn from an owned club's budget, competition bets
 *  that settled. */
export function liquidation(prev: Raw, next: Raw): number {
  let out = 0;
  const now = new Map(arr(next.investments).filter(isObj).map(s => [String(s.club), num(s.percent)]));
  for (const s of arr(prev.investments).filter(isObj)) {
    const sold = num(s.percent) - (now.get(String(s.club)) ?? 0);
    if (sold > 0) out += (sold / 100) * num(s.avgBuyValuation) * STAKE_GROWTH;
  }
  const po = isObj(prev.ownedClubs) ? prev.ownedClubs : {}, no = isObj(next.ownedClubs) ? next.ownedClubs : {};
  for (const [club, st] of Object.entries(po)) {
    const was = isObj(st) ? num(st.budget) : 0;
    const left = isObj(no[club]) ? num((no[club] as Raw).budget) : 0;
    out += Math.max(0, was - left);
  }
  const still = new Set(arr(next.competitionBets).filter(isObj).map(b => String(b.id)));
  for (const b of arr(prev.competitionBets).filter(isObj)) {
    if (!still.has(String(b.id))) out += Math.max(0, num(b.stake)) * Math.min(MAX_BET_ODDS, Math.max(1, num(b.odds, 1)));
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
//  THE CHECK
// ═══════════════════════════════════════════════════════════════════════

export function refillLuck(luck: LuckState | null | undefined, now: number): LuckState {
  if (!luck || !Number.isFinite(luck.left) || !Number.isFinite(luck.at)) return { left: LUCK_CAP, at: now };
  const gained = Math.max(0, now - luck.at) / LUCK_REFILL_MS * LUCK_CAP;
  return { left: Math.min(LUCK_CAP, Math.max(0, luck.left) + gained), at: now };
}

/** Read the server's own bookkeeping out of a stored save. */
export function readServerGuard(stored: unknown): ServerGuard | null {
  if (!isObj(stored) || !isObj(stored.serverGuard)) return null;
  const g = stored.serverGuard;
  const l = isObj(g.luck) ? g.luck : null;
  if (!l) return null;
  const c = isObj(g.casino) ? g.casino : null;
  return {
    v: 1, luck: { left: num(l.left, LUCK_CAP), at: num(l.at, 0) }, at: num(g.at, 0),
    ...(c ? { casino: { credit: Math.max(0, num(c.credit)), at: num(c.at, 0) } } : {}),
  };
}

export function checkSave(prevIn: unknown, nextIn: unknown, ctx: GuardContext): GuardResult {
  const now = ctx.now ?? Date.now();
  const next: Raw = isObj(nextIn) ? { ...nextIn } : {};
  delete next.serverGuard; // never the client's to write
  const findings: GuardFinding[] = [];
  const corrected: string[] = [];
  let luck = refillLuck(ctx.luck ?? readServerGuard(prevIn)?.luck ?? null, now);
  // The server casino's record (see "The casino on the server" above).
  const ledger = ctx.casinoNet != null && Number.isFinite(ctx.casinoNet);
  const carried = readServerGuard(prevIn)?.casino;
  let casinoCredit = ledger
    ? Math.max(0, (carried && now - carried.at < CASINO_CREDIT_MS ? carried.credit : 0) + (ctx.casinoNet as number))
    : 0;

  // A deleted slot keeps its last trusted career as a tombstone (see the
  // route's DELETE), so deleting and re-uploading an edited copy is still
  // compared with what was there.
  const prevSrc = isObj(prevIn) && prevIn.tombstone === true ? prevIn.last : prevIn;
  const prevFull = looksLikeCareer(prevSrc) ? prevSrc : null;
  const fresh = isFreshCareer(next);
  // A new career in this slot (after "Delete & start over"): it starts again
  // from nothing, so it is checked against nothing. Appearances never go
  // down inside one career, so an old save with only its calendar wound
  // back is NOT mistaken for a new one.
  // A different player arriving in a deleted slot is a different career too
  // (a save clash's "keep both" copies into a free slot).
  const fromTombstone = prevSrc !== prevIn;
  const newCareer = !prevFull
    || (fresh && (num(prevFull.season, 1) > 1 || !samePlayer(prevFull, next)
      || careerStat(next, "appearances") < careerStat(prevFull, "appearances")))
    || (fromTombstone && !samePlayer(prevFull, next));
  const prev: Raw = newCareer ? genesisOf(next) : prevFull!;

  const finish = (clamped: Raw): GuardResult => {
    const guard: ServerGuard = { v: 1, luck, at: now, ...(ledger ? { casino: { credit: Math.max(0, casinoCredit), at: now } } : {}) };
    clamped.serverGuard = guard;
    return {
      ok: !findings.some(f => f.level === "cheat"), clamped, corrected, findings,
      against: newCareer ? "new-career" : "previous",
      prevKeys: prevFull ? keyNumbers(prevFull) : null, nextKeys: keyNumbers(next), guard,
    };
  };

  if (ctx.mode === "off" || ctx.exempt) return finish(next);

  const flag = (field: string, level: GuardFinding["level"], was: number | null, nowV: number, limit: number, why: string) =>
    findings.push({ field, level, was, now: nowV, limit: Math.round(limit * 100) / 100, why });

  // ── Structure: real numbers in their real ranges ──
  const money = num(next.money, NaN);
  if (!Number.isFinite(money) || money < 0) flag("money", "cheat", num(prev.money), num(next.money, -1), 0, "money is not a real, non-negative number");
  const skills = skillsOf(next);
  for (const k of SKILL_KEYS) {
    if (skills[k] < 0 || skills[k] > SKILL_MAX) flag(`skills.${k}`, "cheat", null, skills[k], SKILL_MAX, "a skill is outside 0-100");
  }
  if (num(next.starRating) > 5 || num(next.starRating) < 0) flag("starRating", "cheat", null, num(next.starRating), 5, "star rating is outside 0-5");
  if (num(next.reputation) > 100 || num(next.reputation) < 0) flag("reputation", "cheat", null, num(next.reputation), 100, "reputation is outside 0-100");

  // ── How much game has passed, and how much real time ──
  const rawWeeks = weeksBetween(prev, next);
  if (calendarIndex(next) < calendarIndex(prev) && !newCareer) {
    flag("season", "watch", calendarIndex(prev), calendarIndex(next), calendarIndex(prev),
      "the calendar went backwards (an older copy picked after a save clash, or an edit)");
  }
  let weeks = Math.max(0, rawWeeks);
  let seasons = Math.max(0, num(next.season, 1) - num(prev.season, 1));
  if (newCareer && !fresh) {
    // Played somewhere the server never saw (offline, before cloud saves, or
    // copied from another slot). Checked only against what its own seasons
    // allow — real time cannot be checked — and noted so it can be looked at.
    flag("season", "watch", null, num(next.season, 1), num(next.season, 1),
      `a career already ${num(next.season, 1)} season(s) in, uploaded here for the first time`);
  }
  if (ctx.prevSavedAt != null && Number.isFinite(ctx.prevSavedAt) && !newCareer) {
    const paceCap = FREE_WEEKS + Math.max(0, now - ctx.prevSavedAt) / 1000 / MIN_SECONDS_PER_WEEK;
    if (weeks > paceCap) {
      flag("week", "watch", calendarIndex(prev), calendarIndex(next), calendarIndex(prev) + paceCap,
        "the calendar moved faster than the game can be played; the extra weeks earn nothing");
      weeks = paceCap;
      seasons = Math.min(seasons, 1 + Math.floor(paceCap / 30));
    }
  }
  const sessions = FREE_SESSIONS + SESSIONS_PER_WEEK * weeks;
  const matches = 2 + MATCHES_PER_WEEK * weeks;
  const seasonOrWeek = seasons + (weeks > 0 ? 1 : 0);

  const out: Raw = { ...next };
  const putBack = (field: string, value: unknown) => {
    if (ctx.mode !== "enforce") return;
    out[field] = value;
    if (!corrected.includes(field)) corrected.push(field);
  };

  // ── Wage ──
  const prevWage = wageOf(prev), nextWage = wageOf(next);
  // STARTER_CONTRACT (careerFlow.ts) pays a typical Premier League wage when
  // a club is attached without an agreed one, whatever the division.
  const wageLimit = Math.min(PREMIER_WAGE_CAP, Math.max(prevWage * WAGE_JUMP, typicalWeeklyWage("premier"),
    wageCeiling(UP_TWO[division(prev)] ?? "premier", division(prev) === "premier"),
    newCareer ? wageCeiling(division(next), !isFreshCareer(next)) : 0));
  if (nextWage > wageLimit + 1) {
    flag("contract.wage", "cheat", prevWage, nextWage, wageLimit, "the wage rose further than any contract or transfer pays");
    putBack("contract", { ...(isObj(next.contract) ? next.contract : {}), wage: prevWage });
  }
  const wageRef = Math.max(WAGE_FLOOR, prevWage, Math.min(nextWage, wageLimit));

  // ── Money ──
  const moves = Math.max(0, arr(next.transfers).length - arr(prev.transfers).length)
    + (String(isObj(next.contract) ? next.contract.club : "") !== String(isObj(prev.contract) ? prev.contract.club : "") ? 1 : 0);
  const testimonial = next.retired === true && prev.retired !== true ? TESTIMONIAL_MAX : 0;
  const earned = wageRef * (WEEK_INCOME_WAGES * weeks + SAVE_LUMP_WAGES + SEASON_LUMP_WAGES * seasons
      + SIGNING_WAGES * Math.min(moves, 1 + seasons))
    + FLAT_PER_WEEK * (weeks + 1) + testimonial + liquidation(prev, next);
  const { spend, parts } = requiredSpend(prev, next);
  const bound = num(prev.money) + earned;
  const total = (Number.isFinite(money) ? money : 0) + spend;
  // New things must be paid for out of money the save really had. Casino
  // luck cannot pay for them while the game is online and saving every few
  // seconds (the casino and the shop are separate saves); after a long gap
  // (offline play) a win and a spend can share one save.
  const longGap = ctx.prevSavedAt == null || now - ctx.prevSavedAt > LONG_GAP_MS;
  if (ledger && Number.isFinite(money) && money >= 0) {
    // The server rolled and paid every casino game: winnings are allowed up
    // to what it recorded, never more, and luck is not needed.
    const ceiling = bound + casinoCredit;
    // Any rise in the bank spends the credit first, so it cannot pile up
    // unused and later cover an edit.
    const rise = Math.max(0, total - num(prev.money));
    if (total > ceiling) {
      flag("money", "cheat", num(prev.money), money, ceiling,
        spend > 0 ? `more money (plus ★${Math.round(spend)} of new ${parts.join(", ")}) than play and the server's casino record give (casino ★${Math.round(casinoCredit)})`
          : `more money than play and the server's casino record give (casino ★${Math.round(casinoCredit)})`);
      if (ctx.mode === "enforce") {
        if (ceiling < spend && prevFull) {
          for (const f of parts) putBack(f, prevFull[f]);
          putBack("money", Math.min(money, Math.max(0, ceiling)));
        } else {
          putBack("money", Math.min(money, Math.max(0, ceiling - spend)));
        }
      }
      casinoCredit = 0;
    } else {
      if (total > bound) {
        flag("money", "watch", num(prev.money), money, bound,
          `above what play could earn by ★${Math.round(total - bound)}: casino winnings the server recorded (★${Math.round(casinoCredit)})`);
      }
      casinoCredit = Math.max(0, casinoCredit - rise);
    }
  } else if (Number.isFinite(money) && spend > 0 && spend > bound && !longGap) {
    flag(parts[0] ?? "money", "cheat", null, Math.round(spend), bound,
      `new ${parts.join(", ")} worth ★${Math.round(spend)} with only ★${Math.round(bound)} to pay for them`);
    if (ctx.mode === "enforce" && prevFull) for (const f of parts) putBack(f, prevFull[f]);
    if (ctx.mode === "enforce") putBack("money", Math.min(money, Math.max(0, bound)));
  } else if (Number.isFinite(money) && total > bound) {
    // What luck multiplied: online, the bank the save already had (this
    // save's own pay is added on top, not gambled — the casino is its own
    // save); after a long gap, everything it could have had.
    const luckUsed = longGap
      ? Math.log10(total / Math.max(bound, MIN_STAKE))
      : Math.log10(Math.max(1, total - earned) / Math.max(num(prev.money), MIN_STAKE));
    if (luckUsed <= luck.left) {
      luck = { left: luck.left - Math.max(0, luckUsed), at: now };
      flag("money", "watch", num(prev.money), money, bound, `above what play could earn by ×${(10 ** luckUsed).toFixed(1)}: casino luck (allowance left ×${(10 ** luck.left).toFixed(0)})`);
    } else {
      flag("money", "cheat", num(prev.money), money, bound * 10 ** luck.left,
        spend > 0 ? `more money (plus ★${Math.round(spend)} of new ${parts.join(", ")}) than play and luck could give`
          : "more money than play and luck could give");
      const honest = Math.max(0, bound - spend);
      if (ctx.mode === "enforce") {
        if (bound < spend && prevFull) {
          // Cannot have afforded what it now owns: those go back too.
          for (const f of parts) putBack(f, prevFull[f]);
          putBack("money", Math.min(money, Math.max(0, bound)));
        } else {
          putBack("money", Math.min(money, honest));
        }
      }
    }
  } else if (!Number.isFinite(money) || money < 0) {
    putBack("money", Math.max(0, num(prev.money)));
  }

  // ── Skills and training stars ──
  const prevSkills = skillsOf(prev);
  let starsGained = 0, skillGained = 0;
  for (const k of SKILL_KEYS) {
    const ns = starsOf(next, k, skills[k]), ps = starsOf(prev, k, prevSkills[k]);
    starsGained += Math.max(0, ns - ps);
    skillGained += Math.max(0, skills[k] - prevSkills[k]);
    // Above its stars only by what it was already above them (earlier
    // dilemmas), plus one more dilemma.
    const ceiling = Math.max(skillFromStars(ns), prevSkills[k]) + DILEMMA_SKILL;
    if (skills[k] > ceiling) {
      flag(`skills.${k}`, "cheat", prevSkills[k], skills[k], ceiling, "a skill above what its training stars give");
    }
  }
  const starLimit = STARS_PER_SESSION * sessions, skillLimit = SKILL_PER_SESSION * sessions + DILEMMA_SKILL;
  if (starsGained > starLimit) flag("trainingStars", "cheat", null, starsGained, starLimit, "more training stars than the sessions allow");
  if (skillGained > skillLimit) flag("skills", "cheat", null, skillGained, skillLimit, "skills rose faster than training allows");
  if (anyCheat(findings, "skills", "trainingStars")) {
    putBack("skills", prev.skills);
    putBack("trainingStars", prev.trainingStars);
  }

  // ── Trophies, awards, Ballon d'Or, achievements, career totals ──
  const pt = arr(prev.trophies), nt = arr(next.trophies);
  const trophyLimit = TROPHY_LUMP + TROPHIES_PER_WEEK * weeks + TROPHIES_PER_SEASON * seasons;
  const seenTrophy = new Set<string>();
  let doubled = 0;
  for (const t of nt) {
    const key = isObj(t) ? `${num(t.season)}|${String(t.competition)}` : "";
    if (seenTrophy.has(key)) doubled++;
    seenTrophy.add(key);
  }
  const prevDoubled = (() => { const s = new Set<string>(); let d = 0; for (const t of pt) { const k = isObj(t) ? `${num(t.season)}|${String(t.competition)}` : ""; if (s.has(k)) d++; s.add(k); } return d; })();
  if (nt.length - pt.length > trophyLimit || doubled > prevDoubled
    || nt.some(t => isObj(t) && num(t.season) > num(next.season, 1))) {
    flag("trophies", "cheat", pt.length, nt.length, pt.length + trophyLimit, "trophies added that no season could have won");
    putBack("trophies", prevFull ? prevFull.trophies : nt.slice(0, pt.length));
  }
  const pa = arr(prev.awards).length, na = arr(next.awards).length;
  if (na - pa > AWARDS_PER_SEASON * seasonOrWeek) {
    flag("awards", "cheat", pa, na, pa + AWARDS_PER_SEASON * seasonOrWeek, "awards added faster than they are given");
    putBack("awards", prevFull ? prevFull.awards : arr(next.awards).slice(0, pa));
  }
  const pb = num(prev.ballonDorWins), nb = num(next.ballonDorWins);
  if (nb - pb > seasons + 1 || nb > num(next.season, 1)) {
    flag("ballonDorWins", "cheat", pb, nb, Math.min(pb + seasons + 1, num(next.season, 1)), "more Ballon d'Or wins than seasons");
    putBack("ballonDorWins", pb);
  }
  const pAch = arr(prev.achievements).length, nAch = arr(next.achievements).length;
  const achLimit = ACHIEVEMENTS_LUMP + ACHIEVEMENTS_PER_WEEK * weeks;
  if (nAch - pAch > achLimit) {
    flag("achievements", "cheat", pAch, nAch, pAch + achLimit, "achievements unlocked faster than play allows");
    putBack("achievements", prevFull ? prevFull.achievements : arr(next.achievements).slice(0, pAch));
  }
  const dApps = careerStat(next, "appearances") - careerStat(prev, "appearances");
  const dGoals = careerStat(next, "goals") - careerStat(prev, "goals");
  const dAssists = careerStat(next, "assists") - careerStat(prev, "assists");
  if (dApps > matches || dGoals > GOALS_PER_MATCH * matches || dAssists > GOALS_PER_MATCH * matches) {
    flag("careerStats", "cheat", careerStat(prev, "goals"), careerStat(next, "goals"),
      careerStat(prev, "goals") + GOALS_PER_MATCH * matches, "more appearances, goals or assists than the matches played");
    putBack("careerStats", prev.careerStats);
  }

  // ── Fame and reputation ──
  const fameLimit = FAME_LUMP + FAME_PER_WEEK * weeks + FAME_PER_SEASON * seasons;
  if (num(next.fame) - num(prev.fame) > fameLimit) {
    flag("fame", "cheat", num(prev.fame), num(next.fame), num(prev.fame) + fameLimit, "fame rose faster than matches and trophies give it");
    putBack("fame", num(prev.fame));
  }
  const repLimit = REP_LUMP + REP_PER_WEEK * weeks + REP_PER_SEASON * seasons;
  if (num(next.reputation) - num(prev.reputation) > repLimit) {
    flag("reputation", "cheat", num(prev.reputation), num(next.reputation), num(prev.reputation) + repLimit, "reputation rose faster than the game gives it");
    putBack("reputation", num(prev.reputation));
  } else if (num(next.reputation) > 100 || num(next.reputation) < 0) {
    putBack("reputation", Math.max(0, Math.min(100, num(prev.reputation))));
  }

  // ── New competition bets must be at real odds ──
  if (arr(next.competitionBets).some(b => isObj(b) && (num(b.odds) > MAX_BET_ODDS || num(b.stake) < 0))) {
    flag("competitionBets", "cheat", null, MAX_BET_ODDS, MAX_BET_ODDS, "a bet at odds the bookmaker never offers");
    putBack("competitionBets", prevFull ? prevFull.competitionBets : []);
  }

  // ── Star rating: worked out from skills and honours, never typed in ──
  const sr = num(next.starRating);
  try {
    const own = computeStarRating(out as unknown as CareerState);
    const allowed = Math.max(num(prev.starRating), own) + STAR_RATING_SLACK;
    if (sr > allowed) {
      flag("starRating", "cheat", num(prev.starRating), sr, allowed, "star rating above what skills and honours give");
      putBack("starRating", Math.min(sr, Math.max(num(prev.starRating), own)));
    } else if (corrected.length > 0 && ctx.mode === "enforce") {
      // Anything above was put back: the rating follows it down.
      out.starRating = Math.min(sr, Math.max(num(prev.starRating), own));
    }
  } catch {
    // An oddly shaped save: the rating check is skipped, nothing else is.
  }

  return finish(ctx.mode === "enforce" && corrected.length > 0 ? out : next);
}

function anyCheat(findings: GuardFinding[], ...fields: string[]): boolean {
  return findings.some(f => f.level === "cheat" && fields.some(x => f.field === x || f.field.startsWith(`${x}.`)));
}
