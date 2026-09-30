import type { CareerState, Fixture, MatchStats, Skills } from "./types";
import { divisionOf, type CareerDivision } from "./calendar";
import { clubReputation } from "./clubReputation";
import { CLUB_DATABASE } from "./data/footballClubDatabase";
import { RECORDS, recordBeaten } from "./records";
import { fameOf } from "./fame";
import { ACHIEVEMENTS } from "./achievements";
import { starsOf as trainingStarsOf, totalStars } from "./trainingLevels";

/**
 * THE STAR RATING — your career, 1.0 to 10.0★ (Mikey, 30 Sep 2026).
 *
 * Two numbers now, with two jobs:
 *  - `career.starRating` is unchanged: your ABILITY on the old 1-5 scale,
 *    worked out from your skills (rating.ts). Selection, wages, set pieces,
 *    transfers and everything else that read it still do, so nothing about
 *    how the game plays moved. Screens show it as "Overall" (displayOverall).
 *  - `career.stars` (this file) is what the game now CALLS the star rating:
 *    your journey. It only ever goes up.
 *
 * How it works, in the order this file is written:
 *  1. Everything earns Star Points (SP). Match points are multiplied by the
 *     stage they were earned on (National League ×1 … Champions League ×5).
 *  2. SP turn into stars on a curve (STAR_THRESHOLDS): each star costs more.
 *  3. Star gates: you can't pass 2.9 / 3.9 / 4.9 / 5.9 until you've played 10
 *     league games at that level OR HIGHER (so jumping straight from the
 *     National League to the Championship opens three gates at once), and
 *     6.9 / 7.9 / 8.9 need trophies and Ballon d'Or placings. Points above a
 *     gate are banked and paid out the moment it opens.
 *  4. From 9.0 there is no gate and no points: the last star is ten Legend
 *     tasks, 0.1★ each. 10.0★ is having done everything in the game.
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

export const MATCH_SP = {
  play: 5, start: 3, win: 3, draw: 1, goal: 12, assist: 8, hatTrick: 20, starMan: 20,
  /** A match rating of this or better… */
  highRating: 8, /** …is worth this. */ highRatingSp: 8,
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
export const TROPHY_SP: Record<string, number> = {
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
};
export const OTHER_TROPHY_SP = 100;
export const PROMOTION_SP = 300;

const DIV_ORDER: CareerDivision[] = ["national_league", "league_two", "league_one", "championship", "premier"];
/** Individual awards, by the division they were won in (bottom to top). */
export const AWARD_SP: Record<string, number[]> = {
  "Player of the Month": [50, 100, 150, 200, 250],
  "Golden Boot": [200, 500, 800, 1100, 1500],
  "Player of the Season": [300, 700, 1100, 1500, 2000],
};
export const BALLON_SP = { win: 6000, top3: 2500, top10: 1000 };

export const MILESTONES = {
  apps: [[50, 100], [100, 200], [250, 400], [500, 800]],
  goals: [[50, 200], [100, 400], [200, 800], [300, 1500]],
  caps: [[1, 400], [25, 300], [50, 600], [100, 1200]],
} as const;
export const PREMIER_DEBUT_SP = 500;
export const BIGGER_CLUB_SP_PER_POINT = 10;
export const RECORD_SP = 2500;
export const ACHIEVEMENT_SP = 60;
export const SKILL_MAXED_SP = 200;
export const TRAINING_STAR_SP = 3;

/** Your best fame level so far: Rising Star, National Name, Global Star, Icon. */
export const FAME_SP: [number, number][] = [[25, 150], [40, 400], [60, 1000], [80, 2500]];
export const CLUB_OWNER_SP = 1500;
export const TOP_ITEM_SP = 300;
export const ISLAND_SP = 1000;
export const PRESIDENT_SP = 3000;

const SKILLS: (keyof Skills)[] = ["pace", "power", "technique", "vision", "freeKick"];
const stepSum = (n: number, steps: readonly (readonly [number, number])[]) => steps.reduce((s, [at, sp]) => s + (n >= at ? sp : 0), 0);
const count = (career: CareerState, competition: string) => career.trophies.filter(t => t.competition === competition).length;
const ownsClub = (career: CareerState) => (career.investments ?? []).some(i => i.percent >= 50.1);
const topItems = (career: CareerState) => (career.ownedItems ?? []).filter(i => i.level === 5);
const ownsIsland = (career: CareerState) => topItems(career).some(i => (i.baseId ?? i.id) === "island");

export interface StarBreakdown { match: number; trophies: number; awards: number; milestones: number; status: number }

/** Star Points as the career stands right now (before the high-water mark). */
export function livePoints(career: CareerState): StarBreakdown {
  const led = ledgerOf(career);
  const match = Math.round(Object.entries(led.tiers).reduce((s, [tier, t]) => s + tallySp(t!) * TIER_MULT[tier as StarTier], 0));

  const trophies = career.trophies.reduce((s, t) => s + (TROPHY_SP[t.competition] ?? OTHER_TROPHY_SP), 0)
    + led.promotions * PROMOTION_SP;

  const awards = (career.awards ?? []).reduce((s, a) => {
    const row = AWARD_SP[a.kind];
    if (!row) return s;
    return s + row[Math.max(0, DIV_ORDER.indexOf(a.division ?? "national_league"))];
  }, 0) + led.ballonRanks.reduce((s, r) => s + (r === 1 ? BALLON_SP.win : r <= 3 ? BALLON_SP.top3 : BALLON_SP.top10), 0);

  const cs = career.careerStats;
  const milestones = stepSum(cs.appearances, MILESTONES.apps) + stepSum(cs.goals, MILESTONES.goals)
    + stepSum(career.caps ?? 0, MILESTONES.caps)
    + ((led.tiers.premier?.apps ?? 0) > 0 ? PREMIER_DEBUT_SP : 0)
    + Math.max(0, (led.maxRep ?? 0) - (led.firstRep ?? led.maxRep ?? 0)) * BIGGER_CLUB_SP_PER_POINT
    + RECORDS.filter(r => recordBeaten(career, r)).length * RECORD_SP
    // "first-contract" comes with signing, so it earns nothing: a career starts on exactly 1.0★.
    + career.achievements.filter(id => id !== "first-contract").length * ACHIEVEMENT_SP
    + SKILLS.filter(k => career.skills[k] >= 100).length * SKILL_MAXED_SP
    + SKILLS.reduce((s, k) => s + totalStars(trainingStarsOf(career, k)), 0) * TRAINING_STAR_SP;

  const fame = fameOf(career);
  const status = FAME_SP.reduce((s, [min, sp]) => (fame >= min ? sp : s), 0)
    + (ownsClub(career) ? CLUB_OWNER_SP : 0)
    + topItems(career).reduce((s, i) => s + ((i.baseId ?? i.id) === "island" ? ISLAND_SP : TOP_ITEM_SP), 0)
    + (career.governingBodyPresidencies?.length ? PRESIDENT_SP : 0);

  return { match, trophies, awards, milestones, status };
}

// ── 2. Points to stars ──────────────────────────────────────────────────────

/** Total SP needed for 1.0★, 2.0★ … 10.0★. Each star costs more than the last. */
// Set against played-out careers (tests/star/starPoints.mts), not by hand: a
// regular's season is worth about 1,000 SP in the National League, 1,450 in
// League Two, 2,000 in League One, 3,300 in the Championship and 5,500 in the
// Premier League (cups and Europe included); a star's Premier League season
// with trophies and awards is 12,000-15,000. The last entry only closes the
// table: past 9.0 the rating comes from the Legend tasks.
export const STAR_THRESHOLDS = [0, 600, 2000, 4500, 8500, 14000, 30000, 55000, 95000, 150000];

/** Stars for a points total, to one decimal, rounded down. Capped at 9.0:
 *  the last star is the Legend tasks, not points. */
export function starsFromPoints(sp: number): number {
  for (let i = STAR_THRESHOLDS.length - 2; i >= 0; i--) {
    if (sp >= STAR_THRESHOLDS[i]) {
      const span = STAR_THRESHOLDS[i + 1] - STAR_THRESHOLDS[i];
      const stars = i + 1 + (sp - STAR_THRESHOLDS[i]) / span;
      return Math.min(9, Math.floor(stars * 10 + 1e-9) / 10);
    }
  }
  return 1;
}

/** SP at which a star value (one decimal, up to 9.0) is reached. */
export function pointsForStars(stars: number): number {
  const s = Math.max(1, Math.min(9, stars));
  const i = Math.min(STAR_THRESHOLDS.length - 2, Math.floor(s + 1e-9) - 1);
  return Math.round(STAR_THRESHOLDS[i] + (s - (i + 1)) * (STAR_THRESHOLDS[i + 1] - STAR_THRESHOLDS[i]));
}

// ── 3. Star gates ───────────────────────────────────────────────────────────

export interface StarGate { cap: number; need: string; open: (career: CareerState, led: StarLedger) => boolean }

export const GATE_GAMES = 10;
const gamesAtOrAbove = (led: StarLedger, div: CareerDivision) =>
  DIV_ORDER.slice(DIV_ORDER.indexOf(div)).reduce((s, d) => s + (led.tiers[d]?.apps ?? 0), 0);
const MAJOR = ["Premier League", "FA Cup", "League Cup", "Champions League", "Europa League", "Conference League"];

/** In order. "Or higher" is what lets a jump of two divisions open two gates. */
export const STAR_GATES: StarGate[] = [
  { cap: 2.9, need: `Play ${GATE_GAMES} league games in League Two or higher`, open: (_c, l) => gamesAtOrAbove(l, "league_two") >= GATE_GAMES },
  { cap: 3.9, need: `Play ${GATE_GAMES} league games in League One or higher`, open: (_c, l) => gamesAtOrAbove(l, "league_one") >= GATE_GAMES },
  { cap: 4.9, need: `Play ${GATE_GAMES} league games in the Championship or higher`, open: (_c, l) => gamesAtOrAbove(l, "championship") >= GATE_GAMES },
  { cap: 5.9, need: `Play ${GATE_GAMES} Premier League games`, open: (_c, l) => gamesAtOrAbove(l, "premier") >= GATE_GAMES },
  { cap: 6.9, need: "Win a major trophy, or play in the Champions League", open: (c, l) => l.uclApps > 0 || c.trophies.some(t => MAJOR.includes(t.competition)) },
  { cap: 7.9, need: "Win the Premier League or Champions League, and finish top 10 in a Ballon d'Or", open: (c, l) => (count(c, "Premier League") + count(c, "Champions League") > 0) && l.ballonRanks.length > 0 },
  { cap: 8.9, need: "Win the Ballon d'Or, or finish top 3 twice", open: (c, l) => c.ballonDorWins > 0 || l.ballonRanks.includes(1) || l.ballonRanks.filter(r => r <= 3).length >= 2 },
];

// ── 4. The last star: Legend tasks ──────────────────────────────────────────

export interface LegendTask { id: string; label: string; done: (career: CareerState, led: StarLedger) => boolean; progress: (career: CareerState, led: StarLedger) => string }

export const LEGEND = { ballons: 4, ucl: 3, titles: 5, trophies: 20, clubStature: 95, goalsAssists: 500, reputation: 95, fame: 80 };

/** Ten tasks, 0.1★ each, from 9.0 to 10.0. Add one here when the game grows. */
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
  stars: number;
  /** Banked total, by category (each the best it has ever been). */
  points: StarBreakdown;
  total: number;
  /** What your points alone would make you, before any gate. */
  ungated: number;
  /** The gate holding you, if one is. */
  gate: StarGate | null;
  /** 0-1 of the way to the next 0.1★ (points below 9.0, tasks above). */
  toNext: number;
  /** SP still needed for the next 0.1★ (0 when gated, or at 9.0 and above). */
  spToNext: number;
  legendDone: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function starStatus(career: CareerState): StarStatus {
  const led = ledgerOf(career);
  const best = career.starBest;
  const live = livePoints(career);
  const points: StarBreakdown = {
    match: Math.max(live.match, best?.match ?? 0),
    trophies: Math.max(live.trophies, best?.trophies ?? 0),
    awards: Math.max(live.awards, best?.awards ?? 0),
    milestones: Math.max(live.milestones, best?.milestones ?? 0),
    status: Math.max(live.status, best?.status ?? 0),
  };
  const total = points.match + points.trophies + points.awards + points.milestones + points.status;
  const ungated = starsFromPoints(total);

  const gate = STAR_GATES.find(g => !g.open(career, led)) ?? null;
  let stars = gate ? Math.min(ungated, gate.cap) : ungated;

  const legendDone = Array.from(new Set([
    ...(best?.legend ?? []),
    ...LEGEND_TASKS.filter(t => t.done(career, led)).map(t => t.id),
  ]));
  // The last star: only once points and every gate have taken you to 9.0.
  if (stars >= 9) stars = round1(9 + Math.floor((10 * legendDone.length) / LEGEND_TASKS.length) / 10);
  stars = Math.max(stars, best?.stars ?? 1);

  let toNext = 0, spToNext = 0;
  if (stars >= 9) toNext = stars >= 10 ? 1 : ((10 * legendDone.length) / LEGEND_TASKS.length) % 1;
  else if (gate && stars >= gate.cap) toNext = 1;
  else {
    const from = pointsForStars(stars), to = pointsForStars(round1(stars + 0.1));
    toNext = Math.max(0, Math.min(1, (total - from) / Math.max(1, to - from)));
    spToNext = Math.max(0, to - total);
  }
  return { stars, points, total, ungated, gate: gate && stars >= gate.cap ? gate : null, toNext, spToNext, legendDone };
}

/** The star rating to show. */
export function starsNow(career: CareerState): number {
  return starStatus(career).stars;
}

/**
 * Bank the star rating onto the career: the high-water marks, the biggest
 * club so far, and the division on any award that doesn't carry one yet.
 * Safe to call as often as you like.
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
  return { ...next, stars: st.stars, starBest: { ...st.points, stars: st.stars, legend: st.legendDone } };
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
