/**
 * ACHIEVEMENTS ACROSS WHOLE CAREERS (Roadmap #4, 11 Oct 2026).
 *
 * Plays seeded careers end to end through the real reducers
 * (creditMatchResult, advanceSeason) for three kinds of player — average,
 * good, star — starting in League Two the way a real career starts low, and
 * reports how many achievements each has by season 1, 5 and 20. The table is
 * printed so the spread can be judged; the assertions hold the shape: a star
 * has more than an average player, nobody has half the list after a season,
 * and every season adds something for a star.
 *
 * Measured, not real football: goals, assists, ratings and how each goal went
 * in come from a seeded roll per profile, not from the match engine. Nobody
 * trains, shops, or moves club here, so skill, shop and transfer achievements
 * stay locked in this table. What it measures is the ACHIEVEMENT LIST against
 * a believable run of results.
 */
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { finaliseMatch } from "../../lib/star/matchStats";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { LEAGUE_TWO_CLUBS } from "../../lib/star/clubs";
import { typicalWeeklyWage, goalBonusFor, assistBonusFor } from "../../lib/star/economy";
import { divisionOf } from "../../lib/star/calendar";
import { ACHIEVEMENTS } from "../../lib/star/achievements";
import type { CareerState, GoalEvent, LeagueSquad, LeaguePlayer, StarPlayer, OppGoalEvent } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function rngOf(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Profile { name: string; goalP: number; assistP: number; rating: number; teamFor: number; teamAgainst: number }
export const PROFILES: Profile[] = [
  { name: "average", goalP: 0.22, assistP: 0.15, rating: 6.5, teamFor: 1.2, teamAgainst: 1.4 },
  { name: "good", goalP: 0.45, assistP: 0.28, rating: 7.1, teamFor: 1.6, teamAgainst: 1.1 },
  { name: "star", goalP: 0.85, assistP: 0.42, rating: 7.8, teamFor: 2.1, teamAgainst: 0.8 },
];

/** How a goal went in, weighted roughly like a striker's goals. */
const HOWS: [string, number][] = [
  ["one_on_one", 20], ["cutback", 14], ["through_ball", 12], ["header", 12], ["rebound", 8], ["byline_cross", 8],
  ["penalty", 6], ["volley", 5], ["tight_angle", 5], ["long_range", 5], ["corner", 3], ["free_kick", 2],
];
const HOW_TOTAL = HOWS.reduce((s, [, w]) => s + w, 0);
function pickHow(rng: () => number): string {
  let r = rng() * HOW_TOTAL;
  for (const [h, w] of HOWS) { if ((r -= w) < 0) return h; }
  return "one_on_one";
}

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, skinTone: "light",
    club: LEAGUE_TWO_CLUBS[3], clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function leagueSquadsFor(clubs: readonly string[], season: number): LeagueSquad[] {
  return clubs.map((c): LeagueSquad => ({
    club: c,
    players: generateSquad(clubNameSeed(c) + season).map((p, i): LeaguePlayer => ({
      id: `${c}:${i}`, name: `${p.name} (${c})`, position: p.position,
      positions: p.positions ?? [p.position],
      overall: 60 + (clubNameSeed(p.name) % 22), goals: 0, assists: 0,
    })),
  }));
}

/** Poisson-ish count from a mean. */
function count(rng: () => number, mean: number): number {
  let n = 0, p = Math.exp(-mean), s = p;
  const u = rng();
  while (u > s && n < 9) { n++; p *= mean / n; s += p; }
  return n;
}

/** One played career, calling `onSeason` after each rollover. */
export function playCareer(profile: Profile, seed: number, seasons: number, onSeason?: (c: CareerState, season: number) => void): CareerState {
  const rng = rngOf(seed);
  let c: CareerState = { ...makeInitialCareer(player(), [...LEAGUE_TWO_CLUBS], "league_two"), leagueSquads: leagueSquadsFor(LEAGUE_TWO_CLUBS, 1) };
  for (let season = 1; season <= seasons; season++) {
    // The wage of an ordinary first-teamer in the division played in (the
    // scout-offer and renewal screens set the real one; nobody negotiates here).
    const wage = Math.round(typicalWeeklyWage(divisionOf(c)));
    c = { ...c, contract: { ...c.contract, wage, goalBonus: goalBonusFor(wage), assistBonus: assistBonusFor(wage) } };
    let guard = 0;
    while (guard++ < 200) {
      const fx = c.fixtures.find(f => !f.played);
      if (!fx) break;
      const goals = count(rng, profile.goalP);
      const assists = count(rng, profile.assistP);
      const us = goals + count(rng, profile.teamFor * 0.7);
      const them = count(rng, profile.teamAgainst);
      const events: GoalEvent[] = [];
      for (let g = 0; g < goals; g++) {
        const how = pickHow(rng);
        const distance = how === "long_range" ? 22 + Math.round(rng() * 12) : how === "penalty" ? 11 : 6 + Math.round(rng() * 12);
        const finish = rng() < 0.08 ? (rng() < 0.5 ? "chip" : "curl") : undefined;
        events.push({ minute: 1 + Math.floor(rng() * 90), scorer: "Test Player", isUserGoal: true, how, distance, ...(finish ? { finish } : {}) } as GoalEvent);
      }
      for (let g = goals; g < us; g++) {
        events.push({ minute: 1 + Math.floor(rng() * 90), scorer: "A Mate", isUserGoal: false, assist: g - goals < assists ? "Test Player" : undefined });
      }
      const opp: OppGoalEvent[] = Array.from({ length: them }, (_, i) => ({ minute: 1 + Math.floor(rng() * 90), scorerId: `o${i}`, scorer: "Them" }));
      const stats = finaliseMatch(4 + goals, goals, Math.min(assists, us - goals), Math.floor(rng() * 7), 90,
        us, them, c, events, null, opp, fx);
      stats.rating = Math.max(4, Math.min(10, profile.rating + (rng() - 0.5) * 1.6 + goals * 0.6));
      stats.homeScore = fx.home ? us : them;
      stats.awayScore = fx.home ? them : us;
      c = creditMatchResult(c, fx, stats).career;
    }
    c = advanceSeason(c, false).career;
    onSeason?.(c, season);
  }
  return c;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const SEEDS = [11, 22, 33];
  const at = [1, 5, 20];
  const table: Record<string, Record<number, number[]>> = {};
  const t0 = Date.now();
  const known = new Set(ACHIEVEMENTS.map(a => a.id));
  for (const p of PROFILES) {
    table[p.name] = { 1: [], 5: [], 20: [] };
    for (const seed of SEEDS) {
      playCareer(p, seed * 7919 + p.name.length, 20, (c, s) => {
        if (at.includes(s)) table[p.name][s].push(c.achievements.filter(id => known.has(id)).length);
      });
    }
  }
  const avg = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length) * 10) / 10;
  console.log(`Achievements unlocked (of ${ACHIEVEMENTS.length}), mean of ${SEEDS.length} seeded careers from League Two — ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log("profile   season1  season5  season20");
  for (const p of PROFILES) {
    console.log(`${p.name.padEnd(9)} ${String(avg(table[p.name][1])).padStart(7)}  ${String(avg(table[p.name][5])).padStart(7)}  ${String(avg(table[p.name][20])).padStart(8)}`);
  }
  check(avg(table.star[20]) > avg(table.average[20]), "a star career unlocks more than an average one by season 20");
  check(avg(table.star[5]) > avg(table.star[1]) && avg(table.star[20]) > avg(table.star[5]), "a star keeps unlocking things through the career");
  check(avg(table.star[1]) < ACHIEVEMENTS.length * 0.5, "nobody has half the list after one season");
  check(avg(table.star[20]) < ACHIEVEMENTS.length, "nobody has the whole list from results alone");

  if (problems.length) { console.log("FAIL"); for (const p of problems) console.log("  ✗ " + p); process.exit(1); }
  console.log("PASS");
}
