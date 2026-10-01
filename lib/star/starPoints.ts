import type { CareerState, Fixture, MatchStats, Skills } from "./types";
import { divisionOf, type CareerDivision } from "./calendar";
import { clubReputation } from "./clubReputation";
import { CLUB_DATABASE } from "./data/footballClubDatabase";
import { RECORDS, recordBeaten } from "./records";
import { fameOf } from "./fame";
import { ACHIEVEMENTS } from "./achievements";
import { starsOf as trainingStarsOf, totalStars } from "./trainingLevels";

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
 *    your journey, a whole number from 1 to 100. It only ever goes up.
 *
 * How it works, in the order this file is written:
 *  1. Everything earns Star Points (SP). Match points are multiplied by the
 *     stage they were earned on (National League ×1 … Champions League ×5).
 *  2. SP turn into levels on a curve (LEVEL_THRESHOLDS): each level costs more
 *     than the one before — 10,000 SP a level at the start, 1.1 million a
 *     level in the 80s (Harry: 11→20 "about 100,000", 81→90 "about 10 million").
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
 * so an island wearing out or a club stake sold can't take a star away.
 */

// ── 1. What earns points ────────────────────────────────────────────────────

export type StarTier = CareerDivision | "cup" | "intl" | "europe";

/** A match's points are multiplied by where it was played. */
export const TIER_MULT: Record<StarTier, number> = {
  national_league: 1, league_two: 1.5, league_one: 2, championship: 3, premier: 4,
  cup: 4, intl: 4, europe: 5,
};

/**
 * Every point value in this file is written in the old (Sep 2026) units and
 * multiplied by this, so the relative weights Mikey tuned stay readable.
 * Tuned against played-out careers (tests/star/starPoints.mts and the
 * measurement in that file's header), not by hand.
 */
export const SP_SCALE = 120;
const S = SP_SCALE;

export const MATCH_SP = {
  play: 5 * S, start: 3 * S, win: 3 * S, draw: 1 * S, goal: 12 * S, assist: 8 * S, hatTrick: 20 * S, starMan: 20 * S,
  /** A match rating of this or better… */
  highRating: 8, /** …is worth this. */ highRatingSp: 8 * S,
};

export interface TierTally {
  apps: number; starts: number; wins: number; draws: number;
  goals: number; assists: number; hatTricks: number; starMan: number; high: number;
}
const EMPTY: TierTally = { apps: 0, starts: 0, wins: 0, draws: 0, goals: 0, assists: 0, hatTricks: 0, starMan: 0, high: 0 };

/** What the star rating needs remembering that the career didn't already keep. */
export interface StarLedger {
  tiers: Partial<Record<StarTier, TierTally>>;
  /** Champions League matches played (a gate reads it). */
  uclApps: number;
  promotions: number;
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
  if (kind === "europe") return "europe";
  if (kind === "international") return "intl";
  if (kind === "cup") return "cup";
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
    high: stats.rating >= MATCH_SP.highRating ? 1 : 0,
  };
}

function tallySp(t: TierTally): number {
  return t.apps * MATCH_SP.play + t.starts * MATCH_SP.start + t.wins * MATCH_SP.win + t.draws * MATCH_SP.draw
    + t.goals * MATCH_SP.goal + t.assists * MATCH_SP.assist + t.hatTricks * MATCH_SP.hatTrick
    + t.starMan * MATCH_SP.starMan + t.high * MATCH_SP.highRatingSp;
}

/** What one match is worth, for the post-match screen. */
export function matchStarPoints(career: CareerState, fixture: Fixture, stats: MatchStats): { base: number; mult: number; total: number; tier: StarTier } {
  const tier = tierOfFixture(career, fixture);
  const base = tallySp(tallyFor(career, stats));
  return { base, mult: TIER_MULT[tier], total: Math.round(base * TIER_MULT[tier]), tier };
}

/** The ledger after a match. `career` is the career the match was played from. */
export function ledgerAfterMatch(career: CareerState, fixture: Fixture, stats: MatchStats): StarLedger {
  const led = ledgerOf(career);
  const tier = tierOfFixture(career, fixture);
  const add = tallyFor(career, stats), was = led.tiers[tier] ?? EMPTY;
  const now = Object.fromEntries((Object.keys(EMPTY) as (keyof TierTally)[]).map(k => [k, was[k] + add[k]])) as unknown as TierTally;
  return {
    ...led,
    tiers: { ...led.tiers, [tier]: now },
    uclApps: led.uclApps + (fixture.competition === "Champions League" ? 1 : 0),
  };
}

/** Flat points for silverware. A trophy not listed here is worth OTHER_TROPHY_SP. */
const scaleAll = <T extends Record<string, number>>(o: T): T =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v * S])) as T;

export const TROPHY_SP: Record<string, number> = scaleAll({
  "National League": 250, "League Two": 350, "League One": 500, "Championship": 800,
  "Premier League": 2000,
  "Community Shield": 150, "Super Cup": 150,
  // The League Cup and the Conference League are a level; so are the FA Cup
  // and the Europa League (Mikey, 30 Sep 2026).
  "League Cup": 900, "Conference League": 900,
  "FA Cup": 1200, "Europa League": 1300,
  "Champions League": 3000,
  "World Cup": 3000, "European Championship": 2000,
  "Play-Offs": 0, // the promotion it wins is paid below
});
export const OTHER_TROPHY_SP = 100 * S;
export const PROMOTION_SP = 300 * S;

const DIV_ORDER: CareerDivision[] = ["national_league", "league_two", "league_one", "championship", "premier"];
/** Individual awards, by the division they were won in (bottom to top). */
export const AWARD_SP: Record<string, number[]> = {
  "Player of the Month": [50, 100, 150, 200, 250].map(n => n * S),
  "Golden Boot": [200, 500, 800, 1100, 1500].map(n => n * S),
  "Player of the Season": [300, 700, 1100, 1500, 2000].map(n => n * S),
};
export const BALLON_SP = scaleAll({ win: 6000, top3: 2500, top10: 1000 });

const steps = (xs: [number, number][]) => xs.map(([at, sp]) => [at, sp * S] as [number, number]);
export const MILESTONES = {
  apps: steps([[50, 100], [100, 200], [250, 400], [500, 800]]),
  goals: steps([[50, 200], [100, 400], [200, 800], [300, 1500]]),
  caps: steps([[1, 400], [25, 300], [50, 600], [100, 1200]]),
};
// Both of these were the ones that made a first match look like it moved the
// rating ten times what the card said (Harry, 1 Oct 2026: "+68 star points
// just took me from 1.0 to 2.1"): a Premier League debut was worth more than
// a whole star, and the four achievements a first match unlocks almost
// another. Cut down, and the card now lists them (starGain).
export const PREMIER_DEBUT_SP = 150 * S;
export const BIGGER_CLUB_SP_PER_POINT = 10 * S;
export const RECORD_SP = 2500 * S;
export const ACHIEVEMENT_SP = 20 * S;
export const SKILL_MAXED_SP = 200 * S;
export const TRAINING_STAR_SP = 3 * S;

/** Your best fame level so far: Rising Star, National Name, Global Star, Icon. */
export const FAME_SP: [number, number][] = steps([[25, 150], [40, 400], [60, 1000], [80, 2500]]);
export const CLUB_OWNER_SP = 1500 * S;
export const TOP_ITEM_SP = 300 * S;
export const ISLAND_SP = 1000 * S;
export const PRESIDENT_SP = 3000 * S;

const SKILLS: (keyof Skills)[] = ["pace", "power", "technique", "vision", "freeKick"];
const stepSum = (n: number, steps: readonly (readonly [number, number])[]) => steps.reduce((s, [at, sp]) => s + (n >= at ? sp : 0), 0);
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
  national_league: "National League", league_two: "League Two", league_one: "League One",
  championship: "Championship", premier: "Premier League", cup: "Cups", intl: "Internationals", europe: "Europe",
};

/** Every source of Star Points, as the career stands right now. livePoints is their sum. */
export function pointLines(career: CareerState): StarLine[] {
  const led = ledgerOf(career);
  const out: StarLine[] = [];
  const add = (key: string, cat: keyof StarBreakdown, label: string, sp: number, n?: number) => { if (sp > 0) out.push({ key, cat, label, sp, n }); };

  for (const [tier, t] of Object.entries(led.tiers)) {
    add(`match:${tier}`, "match", `Matches · ${TIER_NAME[tier as StarTier]}`, Math.round(tallySp(t!) * TIER_MULT[tier as StarTier]), t!.apps);
  }

  const byComp = new Map<string, number>();
  for (const t of career.trophies) byComp.set(t.competition, (byComp.get(t.competition) ?? 0) + 1);
  for (const [comp, n] of Array.from(byComp)) add(`trophy:${comp}`, "trophies", comp, n * (TROPHY_SP[comp] ?? OTHER_TROPHY_SP), n);
  add("promotion", "trophies", "Promotion", led.promotions * PROMOTION_SP, led.promotions);

  const byAward = new Map<string, { sp: number; n: number }>();
  for (const a of career.awards ?? []) {
    const row = AWARD_SP[a.kind];
    if (!row) continue;
    const was = byAward.get(a.kind) ?? { sp: 0, n: 0 };
    byAward.set(a.kind, { sp: was.sp + row[Math.max(0, DIV_ORDER.indexOf(a.division ?? "national_league"))], n: was.n + 1 });
  }
  for (const [kind, v] of Array.from(byAward)) add(`award:${kind}`, "awards", kind, v.sp, v.n);
  add("ballon", "awards", "Ballon d'Or placings", led.ballonRanks.reduce((s, r) => s + (r === 1 ? BALLON_SP.win : r <= 3 ? BALLON_SP.top3 : BALLON_SP.top10), 0), led.ballonRanks.length);

  const cs = career.careerStats;
  add("apps", "milestones", "Appearance milestones", stepSum(cs.appearances, MILESTONES.apps));
  add("goals", "milestones", "Goal milestones", stepSum(cs.goals, MILESTONES.goals));
  add("caps", "milestones", "International caps", stepSum(career.caps ?? 0, MILESTONES.caps));
  add("pl-debut", "milestones", "Premier League debut", (led.tiers.premier?.apps ?? 0) > 0 ? PREMIER_DEBUT_SP : 0);
  add("bigger-club", "milestones", "A bigger club", Math.max(0, (led.maxRep ?? 0) - (led.firstRep ?? led.maxRep ?? 0)) * BIGGER_CLUB_SP_PER_POINT);
  const records = RECORDS.filter(r => recordBeaten(career, r)).length;
  add("records", "milestones", "Records broken", records * RECORD_SP, records);
  // "first-contract" comes with signing, so it earns nothing: a career starts on exactly 1.
  const ach = career.achievements.filter(id => id !== "first-contract").length;
  add("achievements", "milestones", "Achievements", ach * ACHIEVEMENT_SP, ach);
  const maxed = SKILLS.filter(k => career.skills[k] >= 100).length;
  add("maxed", "milestones", "Skills at 100", maxed * SKILL_MAXED_SP, maxed);
  const tStars = SKILLS.reduce((s, k) => s + totalStars(trainingStarsOf(career, k)), 0);
  add("training", "milestones", "Training stars", tStars * TRAINING_STAR_SP, tStars);

  const fame = fameOf(career);
  add("fame", "status", "Fame", FAME_SP.reduce((s, [min, sp]) => (fame >= min ? sp : s), 0));
  add("owner", "status", "Owning a club", ownsClub(career) ? CLUB_OWNER_SP : 0);
  const top = topItems(career);
  add("items", "status", "Top-level things you own", top.reduce((s, i) => s + ((i.baseId ?? i.id) === "island" ? ISLAND_SP : TOP_ITEM_SP), 0), top.length);
  add("president", "status", "A presidency", career.governingBodyPresidencies?.length ? PRESIDENT_SP : 0);
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

/** What one level costs in each band: 1→10, 10→20 … 80→90. Each band costs
 *  more a level than the one below. 10→60 are the old 1.0-6.0 star costs ×200
 *  (600 SP a star at the bottom = 12,000 a level); the top two are pushed up
 *  to Harry's shape: 11→20 is 108,000 SP, 81→90 is 9.9 million. */
export const LEVEL_COST = [10_000, 12_000, 28_000, 50_000, 80_000, 110_000, 320_000, 550_000, 1_100_000];

/** LEVEL_THRESHOLDS[L] = total SP to be on level L, for L = 1…90 (index 0 unused). */
export const LEVEL_THRESHOLDS: number[] = (() => {
  const t = [0, 0];
  for (let L = 2; L <= POINTS_CAP_LEVEL; L++) {
    // The step INTO level L is priced by the band L-1 sits in: 1→2 … 9→10 are
    // the first band (nine steps), 10→11 … 19→20 the second, and so on.
    t[L] = t[L - 1] + LEVEL_COST[L - 1 < 10 ? 0 : Math.floor((L - 1) / 10)];
  }
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
  const total = earned + carry;
  const ungated = levelFromPoints(total);

  const gate = STAR_GATES.find(g => !g.open(career, led)) ?? null;
  let stars = gate ? Math.min(ungated, gate.cap) : ungated;

  const legendDone = Array.from(new Set([
    ...(best?.legend ?? []),
    ...LEGEND_TASKS.filter(t => t.done(career, led)).map(t => t.id),
  ]));
  // The last ten levels: only once points and every gate have taken you to 90.
  if (stars >= POINTS_CAP_LEVEL) stars = POINTS_CAP_LEVEL + Math.floor((10 * legendDone.length) / LEGEND_TASKS.length);
  stars = Math.min(MAX_LEVEL, Math.max(stars, best?.stars ?? 1));

  let toNext = 0, spToNext = 0;
  if (stars >= POINTS_CAP_LEVEL) toNext = stars >= MAX_LEVEL ? 1 : ((10 * legendDone.length) / LEGEND_TASKS.length) % 1;
  else if (gate && stars >= gate.cap) toNext = 1;
  else {
    const from = pointsForLevel(stars), to = pointsForLevel(stars + 1);
    toNext = Math.max(0, Math.min(1, (total - from) / Math.max(1, to - from)));
    spToNext = Math.max(0, to - total);
  }
  return { stars, points, total, ungated, gate: gate && stars >= gate.cap ? gate : null, toNext, spToNext, legendDone, carry };
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
  return {
    ...next, stars: st.stars,
    starBest: { ...st.points, stars: st.stars, legend: st.legendDone, scale: MAX_LEVEL, ...(st.carry > 0 ? { carry: st.carry } : {}) },
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
