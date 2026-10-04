import type { CareerState, Fixture, MatchStats, Skills } from "./types";
import { divisionOf, leagueNameFor, type CareerDivision } from "./calendar";
import { clubReputation } from "./clubReputation";
import { CLUB_DATABASE } from "./data/footballClubDatabase";
import { RECORDS, recordBeaten } from "./records";
import { fameOf } from "./fame";
import { ACHIEVEMENTS } from "./achievements";
import { starsOf as trainingStarsOf, totalStars } from "./trainingLevels";
import { xp, achievementXp, type MultKey } from "./xpConfig";
export { xp, setXpConfig, DEFAULT_XP, achievementXp } from "./xpConfig";

/**
 * THE STAR RATING — your career, 1 to 100 (Mikey, 30 Sep 2026; moved from
 * 1.0-10.0 to 1-100 for Harry, 1 Oct 2026: "each one level would have been
 * 10 levels now").
 *
 * Two numbers now, with two jobs:
 *  - `career.starRating` is unchanged: your ABILITY on the old 1-5 scale,
 *    worked out from your skills (rating.ts). Selection, wages, set pieces,
 *    transfers and everything else that read it still do, so nothing about
 *    how the game plays moved. Screens show it as "Overall" (displayOverall).
 *  - `career.stars` (this file) is what the game now CALLS the star rating:
 *    your journey, a whole number from 1 to 100. It goes up, and since
 *    1 Oct 2026 a run of poor matches can take it back down (see 2c).
 *
 * How it works, in the order this file is written:
 *  1. Everything earns Star Points (SP). Match points are multiplied by the
 *     stage they were earned on (National League ×1 … Champions League ×5).
 *  2. SP turn into levels on a curve (LEVEL_COST): about a match a level up
 *     to 4, then each level dearer than the last, so 60→61 takes 14-20× the
 *     matches 4→5 does (see STAR_CURVES).
 *  3. Star gates: you can't pass 29 / 39 / 49 / 59 until you've played 10
 *     league games at that level OR HIGHER (so jumping straight from the
 *     National League to the Championship opens three gates at once), and
 *     69 / 79 / 89 need trophies and Ballon d'Or placings. Points above a
 *     gate are banked and paid out the moment it opens.
 *  4. From 90 there is no gate and no points: the last ten levels are ten
 *     Legend tasks, one level each. 100 is having done everything in the game.
 *
 * A save from the 1.0-10.0 days is converted the first time it is read
 * (`bestOf`): its rating ×10, and its points carried so it keeps climbing
 * from where it was. Nothing it had is lost.
 *
 * ADDING SOMETHING NEW TO THE GAME (a World Cup, a lower-league cup…): give
 * its trophy a line in TROPHY_SP, and if it is a pinnacle, a Legend task.
 * Everything is derived from the career, so nothing else needs touching.
 *
 * Never-goes-down is a high-water mark (`career.starBest`), kept per category
 * so an island wearing out or a club stake sold can't take a star away. The
 * one thing that CAN take it down is form: a run of poor matches (2c below,
 * Harry, 1 Oct 2026, P14).
 */

// ── 1. What earns points ────────────────────────────────────────────────────

/**
 * Where a match was played, for its multiplier. "europe" is the Champions
 * League; "cup" is an old save's cup matches (before a cup took your league's
 * multiplier, Mikey 3 Oct 2026) and counts ×1.
 */
export type StarTier = CareerDivision | `cup_${CareerDivision}` | "cup" | "intl" | "europe" | "europa" | "conference";

/** A match's XP is multiplied by where it was played. The amounts live in
 *  the XP Book (lib/star/xpConfig.ts, /admin/star-xp). */
export function tierMult(tier: StarTier): number {
  const m = xp().mult;
  if (tier === "europe") return m.champions_league;
  if (tier === "europa") return m.europa_league;
  if (tier === "conference") return m.conference_league;
  if (tier === "intl") return m.intl;
  if (tier === "cup") return 1;
  if (tier.startsWith("cup_")) return m[tier.slice(4) as MultKey] ?? 1;
  return m[tier as MultKey] ?? 1;
}

/**
 * Every point value in this file is written in the old (Sep 2026) units and
 * multiplied by this, so the relative weights Mikey tuned stay readable.
 * Tuned against played-out careers (tests/star/starPoints.mts and the
 * measurement in that file's header), not by hand.
 */
export const SP_SCALE = 120;
const S = SP_SCALE;

/** The rating bonus counts each point above this. Fixed, because the
 *  ledger stores the points above it (TierTally.ratingPts). */
export const RATING_BONUS_FROM = 6;

export interface TierTally {
  apps: number; starts: number; wins: number; draws: number;
  goals: number; assists: number; hatTricks: number; starMan: number; high: number;
  /** Minutes on the pitch, and match-rating points above RATING_BONUS_FROM.
   *  Absent on a tally from before 3 Oct 2026: estimated from apps/starts/high. */
  minutes?: number;
  ratingPts?: number;
}
const EMPTY: TierTally = { apps: 0, starts: 0, wins: 0, draws: 0, goals: 0, assists: 0, hatTricks: 0, starMan: 0, high: 0, minutes: 0, ratingPts: 0 };

/** What the star rating needs remembering that the career didn't already keep. */
export interface StarLedger {
  tiers: Partial<Record<StarTier, TierTally>>;
  /** Champions League matches played (a gate reads it). */
  uclApps: number;
  /** Poor form (2c): Star Points lost to poor matches, and how many poor
   *  matches in a row without a good one. Absent until the first poor match. */
  slump?: { debt: number; streak: number };
  promotions: number;
  /** The divisions you went up from WITHOUT winning them (2nd, 3rd, play-offs).
   *  Each pays the XP Book's promotionShare of that league's title. */
  promotedFrom?: CareerDivision[];
  /** The standing of your first club, and of the biggest you've played for. */
  firstRep?: number;
  maxRep?: number;
  /** Your Ballon d'Or finish each year you were on the shortlist (1 = won). */
  ballonRanks: number[];
}

export interface StarBest {
  match: number; trophies: number; awards: number; milestones: number; status: number;
  stars: number;
  /** Legend tasks done. Sticky: a task done stays done. */
  legend: string[];
  /** 100 once this is on the 1-100 scale. Absent on a 1.0-10.0 save (see bestOf). */
  scale?: number;
  /** Points carried over from a 1.0-10.0 save, so its converted rating sits
   *  at the start of its level and keeps climbing. Set once, at conversion. */
  carry?: number;
  /** The one-level-a-match cap (MAX_RISE_PER_MATCH): `apps` is how many
   *  matches you had played when this window opened, `base` your rating then.
   *  Until you play again the rating can't pass base + 1. */
  win?: { apps: number; base: number };
}

/** The career's ledger; a save from before Star Points gets one rebuilt. */
export function ledgerOf(career: CareerState): StarLedger {
  return career.starLedger ?? ledgerFromHistory(career);
}

export const emptyLedger = (): StarLedger => ({ tiers: {}, uclApps: 0, promotions: 0, ballonRanks: [] });

/** How big a club is, 0-100, for clubs anywhere in the world. */
export function clubStature(club: string): number {
  if (!club) return 0;
  return Math.max(clubReputation(club), (CLUB_DATABASE[club]?.currentReputation ?? 0) * 10);
}

export function tierOfFixture(career: CareerState, fixture: Fixture): StarTier {
  const kind = fixture.kind ?? "league";
  if (kind === "europe") {
    if (fixture.competition === "Europa League") return "europa";
    if (fixture.competition === "Conference League") return "conference";
    return "europe";
  }
  if (kind === "international") return "intl";
  // A cup tie is worth what your league is (Mikey, 3 Oct 2026): a National
  // League side in the FA Cup is not playing at Premier League rates.
  if (kind === "cup") return `cup_${divisionOf(career)}`;
  return divisionOf(career); // league and play-off
}

function tallyFor(career: CareerState, stats: MatchStats): TierTally {
  // `homeScore` is YOURS whichever ground it was (see creditMatchResult).
  const won = stats.homeScore > stats.awayScore, drew = stats.homeScore === stats.awayScore;
  return {
    apps: 1,
    starts: career.status === "Substitute" ? 0 : 1,
    wins: won ? 1 : 0, draws: drew ? 1 : 0,
    goals: stats.goals, assists: stats.assists,
    hatTricks: stats.goals >= 3 ? 1 : 0,
    starMan: stats.starMan ? 1 : 0,
    high: stats.rating >= 8 ? 1 : 0,
    minutes: Math.max(0, Math.min(120, stats.minutes ?? (career.status === "Substitute" ? 25 : 90))),
    ratingPts: Math.max(0, stats.rating - RATING_BONUS_FROM),
  };
}

/** An old tally with its minutes and rating points filled in by estimate,
 *  so the next match can add to them. */
function withEstimates(t: TierTally): TierTally {
  return {
    ...t,
    minutes: t.minutes ?? (t.starts * 90 + (t.apps - t.starts) * 25),
    ratingPts: t.ratingPts ?? (t.high * 2.5 + (t.apps - t.high) * 0.8),
  };
}

/** A tally's XP at ×1. Minutes and rating points are estimated for a tally
 *  saved before they were kept (a start ~90 minutes, a sub ~25; a high
 *  rating ~2.5 points above 6, any other ~0.8). */
function tallySp(t: TierTally): number {
  const m = xp().match;
  const minutes = t.minutes ?? (t.starts * 90 + (t.apps - t.starts) * 25);
  const ratingPts = t.ratingPts ?? (t.high * 2.5 + (t.apps - t.high) * 0.8);
  return Math.round(minutes * m.perMinute + t.wins * m.win + t.draws * m.draw
    + t.goals * m.goal + t.assists * m.assist + ratingPts * m.ratingPerPoint);
}

/** What one match is worth, for the post-match screen. */
export function matchStarPoints(career: CareerState, fixture: Fixture, stats: MatchStats): { base: number; mult: number; total: number; tier: StarTier } {
  const tier = tierOfFixture(career, fixture);
  const base = tallySp(tallyFor(career, stats));
  return { base, mult: tierMult(tier), total: Math.round(base * tierMult(tier)), tier };
}

/** The ledger after a match. `career` is the career the match was played from. */
export function ledgerAfterMatch(career: CareerState, fixture: Fixture, stats: MatchStats): StarLedger {
  const led = ledgerOf(career);
  const tier = tierOfFixture(career, fixture);
  const add = tallyFor(career, stats), was = withEstimates(led.tiers[tier] ?? EMPTY);
  const now = Object.fromEntries((Object.keys(EMPTY) as (keyof TierTally)[]).map(k => [k, (was[k] ?? 0) + (add[k] ?? 0)])) as unknown as TierTally;
  return {
    ...led,
    tiers: { ...led.tiers, [tier]: now },
    uclApps: led.uclApps + (fixture.competition === "Champions League" ? 1 : 0),
    ...slumpAfterMatch(career, led, stats, Math.round(tallySp(add) * tierMult(tier))),
  };
}

// Every amount below lives in the XP Book: lib/star/xpConfig.ts (defaults)
// and /admin/star-xp (Mikey's edits, shared by every career). Mikey, 3 Oct
// 2026, took out the things that paid twice for one thing: appearance and goal
// milestones (every match and goal already pays), the 25/50/100-cap steps,
// "a bigger club" (its bigger multiplier already pays), and skills at 100
// (they are achievements already).

/** Your best fame level so far: Rising Star, National Name, Global Star, Icon. */
const SKILLS: (keyof Skills)[] = ["pace", "power", "technique", "vision", "freeKick"];
const DIV_ORDER: CareerDivision[] = ["national_league", "league_two", "league_one", "championship", "premier"];
const count = (career: CareerState, competition: string) => career.trophies.filter(t => t.competition === competition).length;
const ownsClub = (career: CareerState) => (career.investments ?? []).some(i => i.percent >= 50.1);
const topItems = (career: CareerState) => (career.ownedItems ?? []).filter(i => i.level === 5);
const ownsIsland = (career: CareerState) => topItems(career).some(i => (i.baseId ?? i.id) === "island");

export interface StarBreakdown { match: number; trophies: number; awards: number; milestones: number; status: number }

/** One named source of Star Points, so a screen can say where they came from. */
export interface StarLine {
  key: string;
  cat: keyof StarBreakdown;
  label: string;
  sp: number;
  /** How many of it (achievements, trophies…), for the label of a change. */
  n?: number;
}

const TIER_NAME: Record<StarTier, string> = {
  national_league_north: "National League North", national_league_south: "National League South",
  national_league: "National League", league_two: "League Two", league_one: "League One",
  championship: "Championship", premier: "Premier League", cup: "Cups", intl: "Internationals",
  europe: "Champions League", europa: "Europa League", conference: "Conference League",
  cup_national_league_north: "Cups (National League North)", cup_national_league_south: "Cups (National League South)",
  cup_national_league: "Cups (National League)", cup_league_two: "Cups (League Two)", cup_league_one: "Cups (League One)",
  cup_championship: "Cups (Championship)", cup_premier: "Cups (Premier League)",
};

/** Every source of Star Points, as the career stands right now. livePoints is their sum. */
export function pointLines(career: CareerState): StarLine[] {
  const led = ledgerOf(career);
  const out: StarLine[] = [];
  const add = (key: string, cat: keyof StarBreakdown, label: string, sp: number, n?: number) => { if (sp > 0) out.push({ key, cat, label, sp, n }); };

  for (const [tier, t] of Object.entries(led.tiers)) {
    add(`match:${tier}`, "match", `Matches · ${TIER_NAME[tier as StarTier]}`, Math.round(tallySp(t!) * tierMult(tier as StarTier)), t!.apps);
  }

  const X = xp();
  const byComp = new Map<string, number>();
  for (const t of career.trophies) byComp.set(t.competition, (byComp.get(t.competition) ?? 0) + 1);
  for (const [comp, n] of Array.from(byComp)) add(`trophy:${comp}`, "trophies", comp, n * (X.trophies[comp] ?? X.otherTrophy), n);
  // Going up without winning the league pays a share of that league's title
  // (Mikey, 3 Oct 2026). Winning it pays the title alone.
  const ups = led.promotedFrom ?? [];
  add("promotion", "trophies", "Promotion", Math.round(ups.reduce((s, d) => s + (X.trophies[leagueNameFor(d)] ?? 0) * X.promotionShare, 0)), ups.length);

  const byAward = new Map<string, { sp: number; n: number }>();
  for (const a of career.awards ?? []) {
    const row = X.awards[a.kind];
    if (!row) continue;
    const was = byAward.get(a.kind) ?? { sp: 0, n: 0 };
    byAward.set(a.kind, { sp: was.sp + (row[a.division ?? "national_league"] ?? 0), n: was.n + 1 });
  }
  for (const [kind, v] of Array.from(byAward)) add(`award:${kind}`, "awards", kind, v.sp, v.n);
  add("ballon", "awards", "Ballon d'Or placings", led.ballonRanks.reduce((s, r) => s + (r === 1 ? X.ballon.win : r <= 3 ? X.ballon.top3 : X.ballon.top10), 0), led.ballonRanks.length);

  add("caps", "milestones", "First cap", (career.caps ?? 0) >= 1 ? X.milestones.firstCap : 0);
  add("pl-debut", "milestones", "Premier League debut", (led.tiers.premier?.apps ?? 0) > 0 ? X.milestones.premierDebut : 0);
  const beaten = RECORDS.filter(r => recordBeaten(career, r));
  add("records", "milestones", "Records broken", beaten.reduce((s, r) => s + (X.records[r.id] ?? 0), 0), beaten.length);
  const ach = career.achievements;
  add("achievements", "milestones", "Achievements", ach.reduce((s, id) => s + achievementXp(id, X), 0), ach.filter(id => achievementXp(id, X) > 0).length);
  const tStars = SKILLS.reduce((s, k) => s + totalStars(trainingStarsOf(career, k)), 0);
  add("training", "milestones", "Training stars", tStars * X.trainingStar, tStars);

  const fame = fameOf(career);
  add("fame", "status", "Fame", X.fame.reduce((s, [min, sp]) => (fame >= min ? sp : s), 0));
  add("owner", "status", "Owning a club", ownsClub(career) ? X.clubOwner : 0);
  const top = topItems(career);
  add("items", "status", "Top-level things you own", top.reduce((s, i) => s + ((i.baseId ?? i.id) === "island" ? X.island : X.topItem), 0), top.length);
  add("president", "status", "A presidency", career.governingBodyPresidencies?.length ? X.president : 0);
  return out;
}

/** Star Points as the career stands right now (before the high-water mark). */
export function livePoints(career: CareerState): StarBreakdown {
  const b: StarBreakdown = { match: 0, trophies: 0, awards: 0, milestones: 0, status: 0 };
  for (const l of pointLines(career)) b[l.cat] += l.sp;
  return b;
}

// ── 2. Points to levels ─────────────────────────────────────────────────────

/** The top of the scale; 90 of it comes from points, the last 10 from Legend tasks. */
export const MAX_LEVEL = 100;
export const POINTS_CAP_LEVEL = 90;

/**
 * What each level costs (Harry, 1 Oct 2026: "almost impossible after like
 * level 4 to go more than 1 level and the curve should rapidly change so that
 * say level 60-61 is exponentially longer than 4-5").
 *
 * Levels 1→4 are cheap, about one a match. From 4 on every level costs
 * `grow` times the one before up to 60, then `growTop` times from 60 to 90.
 * Because a career earns more per match as it climbs, what matters is
 * MATCHES per level; measured on played-out careers (60 careers, 3 player
 * types, tests/star/starPoints.mts header) the recommended curve gives:
 *   1→4 about one a match, 4→5 in 1-2 matches, 10→11 in ~4, 30→31 in
 *   ~6, 60→61 in 20-27, 80→81 in ~28 — 60→61 is 14-20× 4→5. After level 4
 *   a match alone pays for a whole level 0.2-0.5% of the time. A riser is
 *   ~65 after twelve seasons, a star ~73; 9 of 20 stars reach 90 by season 20.
 *   11→20 is 304,000 SP and 81→90 is 12.7 million (Harry's earlier anchors
 *   were ~100,000 and ~10 million: the low one had to rise, or a level in the
 *   teens would still come every match or two).
 * The other two curves are a one-word switch (STAR_CURVE).
 */
export const STAR_CURVES = {
  /** 60→61 ~9-16× 4→5; a riser ~77 after twelve seasons, every star reaches 90 by season 14. */
  gentle: { start: 12_000, grow: 1.065, growTop: 1.04 },
  /** The one in the game. */
  recommended: { start: 15_000, grow: 1.075, growTop: 1.02 },
  /** 60→61 ~22-48× 4→5; nobody reaches 70 in twelve seasons. */
  brutal: { start: 20_000, grow: 1.085, growTop: 1.02 },
} as const;
export type StarCurve = keyof typeof STAR_CURVES;
export const STAR_CURVE: StarCurve = "recommended";
/** Fixed costs for the first levels, ahead of the curve. Empty now: Mikey,
 *  3 Oct 2026, "you go up loads of star rating levels right at the beginning"
 *  — 8,000/4,000/4,000 put a typical player on level 5 after 5 matches and
 *  level 10 after 24. On the curve (12,000/13,000/14,000) it is level 5 after
 *  about 9 matches and level 10 after about 30 (simulated, 1,000 careers). */
export const EARLY_LEVEL_COST: number[] = [];
/** Where the steeper climb gives way to the gentler top one. */
export const CURVE_KNEE = 60;

/** Rounded to two significant figures, so the numbers read cleanly. */
const twoFigures = (n: number) => { const p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; };

/** LEVEL_COST[L] = SP to go from level L to L+1, for L = 1…89 (index 0 unused). */
export function levelCosts(curve: StarCurve = STAR_CURVE): number[] {
  const { start, grow, growTop } = STAR_CURVES[curve];
  const out = [0];
  for (let L = 1; L < POINTS_CAP_LEVEL; L++) {
    out[L] = L <= EARLY_LEVEL_COST.length ? EARLY_LEVEL_COST[L - 1]
      : twoFigures(start * Math.pow(grow, Math.min(L, CURVE_KNEE) - 4) * Math.pow(growTop, Math.max(0, L - CURVE_KNEE)));
  }
  return out;
}
export const LEVEL_COST: number[] = levelCosts();

/** LEVEL_THRESHOLDS[L] = total SP to be on level L, for L = 1…90 (index 0 unused). */
export const LEVEL_THRESHOLDS: number[] = (() => {
  const t = [0, 0];
  for (let L = 2; L <= POINTS_CAP_LEVEL; L++) t[L] = t[L - 1] + LEVEL_COST[L - 1];
  return t;
})();

/** Level for a points total, rounded down. Capped at 90: the last ten are the
 *  Legend tasks, not points. */
export function levelFromPoints(sp: number): number {
  for (let L = POINTS_CAP_LEVEL; L >= 1; L--) if (sp >= LEVEL_THRESHOLDS[L]) return L;
  return 1;
}

/** SP at which a level (1…90) is reached. */
export function pointsForLevel(level: number): number {
  return LEVEL_THRESHOLDS[Math.max(1, Math.min(POINTS_CAP_LEVEL, Math.floor(level)))];
}

/** A name for each band of ten. About your career, never about the club or
 *  division you're at now (Harry, 1 Oct 2026: "2 STARS · Non-league regular"
 *  showed while he was in the Premier League). */
export const STAR_TITLES = ["Starting out", "Finding your feet", "Making a name", "Established", "Standout", "Star", "Big name", "Elite", "World class", "Legend in the making", "The Complete Career"];
export function starTitle(level: number): string {
  return STAR_TITLES[Math.max(0, Math.min(10, Math.floor(level / 10)))];
}

// ── 2b. One level a match, at most ─────────────────────────────────────────

/**
 * Harry, 1 Oct 2026: "you should never jump 2 levels, it should always be
 * longer than that." One match — with everything that lands with it before
 * your next one (a debut, achievements, a trophy, the season's awards) — can
 * lift the rating by this many levels at most. The points still bank: any
 * beyond the cap carry over and pay out one level per match after it.
 * A 1.0-10.0 save being converted is not a match: it keeps the level it had.
 */
export const MAX_RISE_PER_MATCH = 1;

/** Matches you have played, in every competition (the ledger counts them). */
export function matchesPlayed(led: StarLedger): number {
  return Object.values(led.tiers).reduce((s, t) => s + (t?.apps ?? 0), 0);
}

// ── 2c. Poor form costs you ─────────────────────────────────────────────────

/**
 * Harry, 1 Oct 2026 (P14): "I think you can be able to go down a little bit.
 * If you're having poor performances, eventually maybe you can even go down
 * a whole level."
 *
 * The rule (its numbers are on the question list):
 *  - A POOR match is a match rating under POOR_MATCH_RATING (5.5). It earns
 *    nothing — whatever it would have paid is taken straight back — and it
 *    costs SLUMP_SHARE (a fifth) of what your current level costs to climb.
 *    So five poor matches in a row cost about a whole level of points.
 *  - The points go at once, so the bar falls straight away. The LEVEL only
 *    drops once you have strung SLUMP_MATCHES (5) poor matches together,
 *    with no good match (GOOD_MATCH_RATING, 6.5+) in between. A match between
 *    the two neither adds to the run nor breaks it.
 *  - Never more than one level a match, never below level 1, and after a
 *    drop the run starts again — so a long slump costs about a level every
 *    five poor matches, not one a match.
 *  - The Legend levels (90 and up) are tasks you have done, not points, so
 *    form never touches them.
 * Good matches climb exactly as before: the lost points are simply a hole
 * the next good matches fill first.
 */
export const POOR_MATCH_RATING = 5.5;
export const GOOD_MATCH_RATING = 6.5;
export const SLUMP_SHARE = 0.2;
export const SLUMP_MATCHES = 5;

function slumpAfterMatch(career: CareerState, led: StarLedger, stats: MatchStats, matchSp: number): Pick<StarLedger, "slump"> | null {
  const was = led.slump ?? { debt: 0, streak: 0 };
  const level = starLevel(career);
  if (stats.rating < POOR_MATCH_RATING && level < POINTS_CAP_LEVEL) {
    const cost = LEVEL_COST[Math.max(1, Math.min(POINTS_CAP_LEVEL - 1, level))];
    return { slump: { debt: was.debt + matchSp + Math.round(cost * SLUMP_SHARE), streak: was.streak + 1 } };
  }
  if (stats.rating >= GOOD_MATCH_RATING && was.streak > 0) return { slump: { ...was, streak: 0 } };
  return led.slump ? { slump: was } : null;
}

// ── 3. Star gates ───────────────────────────────────────────────────────────

export interface StarGate { cap: number; need: string; open: (career: CareerState, led: StarLedger) => boolean }

export const GATE_GAMES = 10;
const gamesAtOrAbove = (led: StarLedger, div: CareerDivision) =>
  DIV_ORDER.slice(DIV_ORDER.indexOf(div)).reduce((s, d) => s + (led.tiers[d]?.apps ?? 0), 0);
const MAJOR = ["Premier League", "FA Cup", "League Cup", "Champions League", "Europa League", "Conference League"];

/** In order. "Or higher" is what lets a jump of two divisions open two gates. */
export const STAR_GATES: StarGate[] = [
  { cap: 29, need: `Play ${GATE_GAMES} league games in League Two or higher`, open: (_c, l) => gamesAtOrAbove(l, "league_two") >= GATE_GAMES },
  { cap: 39, need: `Play ${GATE_GAMES} league games in League One or higher`, open: (_c, l) => gamesAtOrAbove(l, "league_one") >= GATE_GAMES },
  { cap: 49, need: `Play ${GATE_GAMES} league games in the Championship or higher`, open: (_c, l) => gamesAtOrAbove(l, "championship") >= GATE_GAMES },
  { cap: 59, need: `Play ${GATE_GAMES} Premier League games`, open: (_c, l) => gamesAtOrAbove(l, "premier") >= GATE_GAMES },
  { cap: 69, need: "Win a major trophy, or play in the Champions League", open: (c, l) => l.uclApps > 0 || c.trophies.some(t => MAJOR.includes(t.competition)) },
  { cap: 79, need: "Win the Premier League or Champions League, and finish top 10 in a Ballon d'Or", open: (c, l) => (count(c, "Premier League") + count(c, "Champions League") > 0) && l.ballonRanks.length > 0 },
  { cap: 89, need: "Win the Ballon d'Or, or finish top 3 twice", open: (c, l) => c.ballonDorWins > 0 || l.ballonRanks.includes(1) || l.ballonRanks.filter(r => r <= 3).length >= 2 },
];

// ── 4. The last ten levels: Legend tasks ──────────────────────────────────────────

export interface LegendTask { id: string; label: string; done: (career: CareerState, led: StarLedger) => boolean; progress: (career: CareerState, led: StarLedger) => string }

export const LEGEND = { ballons: 4, ucl: 3, titles: 5, trophies: 20, clubStature: 95, goalsAssists: 500, reputation: 95, fame: 80 };

/** Ten tasks, one level each, from 90 to 100. Add one here when the game grows. */
export const LEGEND_TASKS: LegendTask[] = [
  { id: "ballons", label: `Win ${LEGEND.ballons} Ballon d'Ors`, done: c => c.ballonDorWins >= LEGEND.ballons, progress: c => `${c.ballonDorWins} / ${LEGEND.ballons}` },
  { id: "ucl", label: `Win ${LEGEND.ucl} Champions Leagues`, done: c => count(c, "Champions League") >= LEGEND.ucl, progress: c => `${count(c, "Champions League")} / ${LEGEND.ucl}` },
  { id: "titles", label: `Win ${LEGEND.titles} Premier League titles`, done: c => count(c, "Premier League") >= LEGEND.titles, progress: c => `${count(c, "Premier League")} / ${LEGEND.titles}` },
  { id: "trophies", label: `Win ${LEGEND.trophies} trophies`, done: c => c.trophies.length >= LEGEND.trophies, progress: c => `${c.trophies.length} / ${LEGEND.trophies}` },
  { id: "club", label: "Play for one of the world's biggest clubs", done: (_c, l) => (l.maxRep ?? 0) >= LEGEND.clubStature, progress: (_c, l) => `Biggest so far: ${l.maxRep ?? 0} / ${LEGEND.clubStature}` },
  { id: "numbers", label: `${LEGEND.goalsAssists} career goals and assists`, done: c => c.careerStats.goals + c.careerStats.assists >= LEGEND.goalsAssists, progress: c => `${c.careerStats.goals + c.careerStats.assists} / ${LEGEND.goalsAssists}` },
  { id: "achievements", label: "Unlock every achievement", done: c => ACHIEVEMENTS.every(a => c.achievements.includes(a.id)), progress: c => `${ACHIEVEMENTS.filter(a => c.achievements.includes(a.id)).length} / ${ACHIEVEMENTS.length}` },
  { id: "records", label: "Beat every record", done: c => RECORDS.every(r => recordBeaten(c, r)), progress: c => `${RECORDS.filter(r => recordBeaten(c, r)).length} / ${RECORDS.length}` },
  { id: "icon", label: "Icon fame and 95 reputation", done: c => fameOf(c) >= LEGEND.fame && c.reputation >= LEGEND.reputation, progress: c => `Fame ${Math.round(fameOf(c))} / ${LEGEND.fame} · Reputation ${Math.round(c.reputation)} / ${LEGEND.reputation}` },
  { id: "owner", label: "Own a club and a level-5 Private Island", done: c => ownsClub(c) && ownsIsland(c), progress: c => `Club ${ownsClub(c) ? "✓" : "✗"} · Island ${ownsIsland(c) ? "✓" : "✗"}` },
];

// ── Putting it together ─────────────────────────────────────────────────────

export interface StarStatus {
  /** The star rating, a whole number 1-100. */
  stars: number;
  /** Banked total, by category (each the best it has ever been). */
  points: StarBreakdown;
  /** Banked total, including any carry from a 1.0-10.0 save. */
  total: number;
  /** What your points alone would make you, before any gate. */
  ungated: number;
  /** The gate holding you, if one is. */
  gate: StarGate | null;
  /** 0-1 of the way to the next level (points below 90, tasks above). */
  toNext: number;
  /** SP still needed for the next level (0 when gated, or at 90 and above). */
  spToNext: number;
  legendDone: string[];
  /** Points carried over from a 1.0-10.0 save (see bestOf). */
  carry: number;
  /** Levels your points have already paid for that the one-level-a-match cap
   *  is holding back; they come one per match you play. */
  held: number;
  /** Star Points past the next level, carried to the matches after (0 unless held). */
  carried: number;
  /** The cap's window (see StarBest.win), to bank. */
  win: { apps: number; base: number };
}

/** True for a career saved on the 1.0-10.0 scale and not yet converted. */
export function isOldStarScale(career: Pick<CareerState, "stars" | "starBest">): boolean {
  if (career.starBest) return career.starBest.scale !== MAX_LEVEL;
  return career.stars !== undefined;
}

/**
 * The high-water marks on the 1-100 scale. A 1.0-10.0 save is converted here,
 * whenever it is read: its rating ×10 (2.9 → 29, 7.4 → 74), its banked points
 * into today's units, Legend tasks kept. `carry` is filled in by starStatus
 * once the live points are known.
 */
export function bestOf(career: Pick<CareerState, "stars" | "starBest">): StarBest | undefined {
  const b = career.starBest;
  if (!isOldStarScale(career)) return b;
  const level = Math.max(1, Math.min(MAX_LEVEL, Math.round((b?.stars ?? career.stars ?? 1) * 10)));
  return {
    match: (b?.match ?? 0) * S, trophies: (b?.trophies ?? 0) * S, awards: (b?.awards ?? 0) * S,
    milestones: (b?.milestones ?? 0) * S, status: (b?.status ?? 0) * S,
    stars: level, legend: b?.legend ?? [], scale: MAX_LEVEL,
  };
}

/** The star rating of any career, old save or new, without banking anything. */
export function starLevel(career: Pick<CareerState, "stars" | "starBest">): number {
  return isOldStarScale(career) ? bestOf(career)!.stars : (career.stars ?? 1);
}

export function starStatus(career: CareerState): StarStatus {
  const led = ledgerOf(career);
  const converting = isOldStarScale(career);
  const best = bestOf(career);
  const live = livePoints(career);
  const points: StarBreakdown = {
    match: Math.max(live.match, best?.match ?? 0),
    trophies: Math.max(live.trophies, best?.trophies ?? 0),
    awards: Math.max(live.awards, best?.awards ?? 0),
    milestones: Math.max(live.milestones, best?.milestones ?? 0),
    status: Math.max(live.status, best?.status ?? 0),
  };
  const earned = points.match + points.trophies + points.awards + points.milestones + points.status;
  // A converted save starts at the bottom of the level it had, not below it:
  // whatever its points fall short of that level is carried, once, for good.
  const carry = converting
    ? Math.max(0, pointsForLevel(Math.min(POINTS_CAP_LEVEL, best?.stars ?? 1)) - earned)
    : (best?.carry ?? 0);
  const total = Math.max(0, earned + carry - (led.slump?.debt ?? 0));
  const ungated = levelFromPoints(total);

  const gate = STAR_GATES.find(g => !g.open(career, led)) ?? null;
  let stars = gate ? Math.min(ungated, gate.cap) : ungated;

  const legendDone = Array.from(new Set([
    ...(best?.legend ?? []),
    ...LEGEND_TASKS.filter(t => t.done(career, led)).map(t => t.id),
  ]));
  // The last ten levels: only once points and every gate have taken you to 90.
  if (stars >= POINTS_CAP_LEVEL) stars = POINTS_CAP_LEVEL + Math.floor((10 * legendDone.length) / LEGEND_TASKS.length);
  stars = Math.min(MAX_LEVEL, stars);

  // One level a match at most. The window opens when a new match has been
  // played (the ledger's count moved on), at the rating banked before it.
  // No banked rating at all (a brand-new career) has nothing to hold back.
  const apps = matchesPlayed(led);
  const newWindow = !(best?.win && best.win.apps === apps);
  const win = !newWindow && best?.win ? best.win : { apps, base: best?.stars ?? stars };
  const reach = stars;
  stars = Math.min(stars, win.base + MAX_RISE_PER_MATCH);
  // The floor is the banked rating — except on the first look after a new
  // match, when a run of SLUMP_MATCHES poor ones lets it slip one level (2c).
  const banked = best?.stars ?? 1;
  const slipping = newWindow && !converting && banked < POINTS_CAP_LEVEL
    && (led.slump?.streak ?? 0) >= SLUMP_MATCHES;
  stars = Math.min(MAX_LEVEL, Math.max(stars, Math.max(1, banked - (slipping ? 1 : 0))));
  const held = Math.max(0, reach - stars);

  let toNext = 0, spToNext = 0, carried = 0;
  if (held > 0) {
    toNext = 1;
    carried = stars < POINTS_CAP_LEVEL ? Math.max(0, total - pointsForLevel(stars + 1)) : 0;
  } else if (stars >= POINTS_CAP_LEVEL) toNext = stars >= MAX_LEVEL ? 1 : ((10 * legendDone.length) / LEGEND_TASKS.length) % 1;
  else if (gate && stars >= gate.cap) toNext = 1;
  else {
    const from = pointsForLevel(stars), to = pointsForLevel(stars + 1);
    toNext = Math.max(0, Math.min(1, (total - from) / Math.max(1, to - from)));
    spToNext = Math.max(0, to - total);
  }
  return { stars, points, total, ungated, gate: gate && stars >= gate.cap && !held ? gate : null, toNext, spToNext, legendDone, carry, held, carried, win };
}

/** The star rating to show. */
export function starsNow(career: CareerState): number {
  return starStatus(career).stars;
}

/**
 * Where the Star Points between two moments of a career came from — what the
 * after-match card lists, so the number it shows is the number that moved
 * the rating (Harry, 1 Oct 2026: "+68 star points just took me from 1.0 to
 * 2.1" — the other ~600 were a Premier League debut and two achievements the
 * card never mentioned).
 */
export function starGain(before: CareerState, after: CareerState): { total: number; lines: StarLine[] } {
  const a = starStatus(before), b = starStatus(after);
  const total = Math.max(0, b.total - a.total);
  const was = new Map(pointLines(before).map(l => [l.key, l]));
  const lines: StarLine[] = [];
  for (const l of pointLines(after)) {
    // Only categories whose banked total actually moved (a sold club bought
    // back earns nothing twice).
    if (b.points[l.cat] <= a.points[l.cat]) continue;
    const prev = was.get(l.key);
    const sp = l.sp - (prev?.sp ?? 0);
    if (sp <= 0) continue;
    const n = l.n !== undefined ? l.n - (prev?.n ?? 0) : undefined;
    lines.push({ ...l, sp, n });
  }
  return { total, lines };
}

/**
 * Bank the star rating onto the career: the high-water marks, the biggest
 * club so far, and the division on any award that doesn't carry one yet.
 * Converts a 1.0-10.0 save the first time it runs. Safe to call as often as
 * you like.
 */
export function withStars(career: CareerState): CareerState {
  const led0 = ledgerOf(career);
  const rep = clubStature(career.player.club);
  const led: StarLedger = rep > 0
    ? { ...led0, firstRep: led0.firstRep ?? rep, maxRep: Math.max(led0.maxRep ?? 0, rep) }
    : led0;
  const div = career.player.club ? divisionOf(career) : undefined;
  const awards = career.awards?.some(a => !a.division) && div
    ? career.awards.map(a => (a.division ? a : { ...a, division: div }))
    : career.awards;
  const next: CareerState = { ...career, starLedger: led, awards };
  const st = starStatus(next);
  // A level just slipped (2c): the run of poor matches starts again.
  const dropped = st.stars < (bestOf(career)?.stars ?? st.stars);
  if (dropped && led.slump) next.starLedger = { ...led, slump: { ...led.slump, streak: 0 } };
  return {
    ...next, stars: st.stars,
    starBest: { ...st.points, stars: st.stars, legend: st.legendDone, scale: MAX_LEVEL, ...(st.carry > 0 ? { carry: st.carry } : {}), win: st.win },
  };
}

/**
 * A save from before Star Points: rebuild the ledger from what it kept.
 * It has no record of which division each old match was in, so its past
 * matches are all counted in the division it is in now, and starts, wins and
 * draws (never stored) are estimated from appearances.
 */
export function ledgerFromHistory(career: CareerState): StarLedger {
  const cs = career.careerStats;
  const led = emptyLedger();
  if (cs.appearances > 0 && career.player.club) {
    const avg = cs.ratingCount > 0 ? cs.totalRating / cs.ratingCount : 6.5;
    led.tiers[divisionOf(career)] = {
      apps: cs.appearances, starts: Math.round(cs.appearances * 0.8),
      wins: Math.round(cs.appearances * 0.4), draws: Math.round(cs.appearances * 0.25),
      goals: cs.goals, assists: cs.assists, hatTricks: cs.hatTricks, starMan: cs.starMan,
      high: avg >= 7.5 ? Math.round(cs.appearances * 0.3) : Math.round(cs.appearances * 0.1),
    };
  }
  led.ballonRanks = Array.from({ length: career.ballonDorWins }, () => 1);
  if (career.trophies.some(t => t.competition === "Champions League")) led.uclApps = 1;
  // Every club it has a season on file for counts towards "biggest club".
  const reps = [...(career.seasonArchive ?? []).map(r => clubStature(r.club)), clubStature(career.player.club)].filter(r => r > 0);
  if (reps.length) { led.firstRep = reps[0]; led.maxRep = Math.max(...reps); }
  return led;
}
