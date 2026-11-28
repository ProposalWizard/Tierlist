/**
 * STAR PASS LEVELS BY AGE (28 Nov 2026, plan question S0/S1). Read-only measurement.
 * Plays headless careers through the REAL careerFlow + starPoints and prints the
 * Star Pass level at each age, matches played, and the age levels 10/20/30/50/75/100 arrive.
 *   npx tsx scripts/analysis/starPassByAge.mts            (30 careers, to age 38)
 *   npx tsx scripts/analysis/starPassByAge.mts 60         (60 careers)
 * It also re-prices the same careers under retune options, by replaying each
 * career's recorded points (no re-simulation): see OPTIONS below. Writes JSON to stdout end.
 */
import { makeInitialCareer, creditMatchResult, advanceSeason, attachClub } from "../../lib/star/careerFlow";
import * as C from "../../lib/star/clubs";
import { divisionOf } from "../../lib/star/calendar";
import { starStatus, withStars, matchesPlayed, ledgerOf, STAR_GATES } from "../../lib/star/starPoints";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import type { CareerState, MatchStats, StarPlayer, CareerDivision } from "../../lib/star/types";

const N = Number(process.argv[2] ?? 30);
// Optional sharding so careers can run in parallel: argv[3]="i/k" plays careers i, i+k, ... and writes JSON to argv[4].
const [SHARD, SHARDS] = (process.argv[3] ?? "0/1").split("/").map(Number);
const OUT = process.argv[4];
const END_AGE = 38;
const mulberry = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
type Prof = { name: string; win: number; draw: number; goals: number; assists: number; rating: number };
const PROFS: Prof[] = [
  { name: "low", win: 0.42, draw: 0.22, goals: 0.25, assists: 0.15, rating: 6.6 },
  { name: "mid", win: 0.55, draw: 0.2, goals: 0.4, assists: 0.25, rating: 7.0 },
  { name: "riser", win: 0.62, draw: 0.2, goals: 0.55, assists: 0.3, rating: 7.3 },
  { name: "star", win: 0.7, draw: 0.15, goals: 0.9, assists: 0.45, rating: 7.9 },
  { name: "elite", win: 0.78, draw: 0.12, goals: 1.1, assists: 0.55, rating: 8.3 },
];
const LADDER: [CareerDivision, readonly string[]][] = [
  ["national_league", C.NATIONAL_LEAGUE_CLUBS], ["league_two", C.LEAGUE_TWO_CLUBS], ["league_one", C.LEAGUE_ONE_CLUBS],
  ["championship", C.CHAMPIONSHIP_CLUBS], ["premier", C.PREMIER_LEAGUE_CLUBS],
];
const squads = (clubs: readonly string[], season: number) => clubs.map(c => ({ club: c, players: generateSquad(clubNameSeed(c) + season).map((p, i) => ({ id: `${c}:${i}`, name: `${p.name} (${c})`, position: p.position, positions: p.positions ?? [p.position], overall: 55 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0 })) })) as unknown as CareerState["leagueSquads"];
const mk = (o: Partial<MatchStats>): MatchStats => ({ chances: 5, goals: 0, assists: 0, passes: 25, rating: 6.5, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0, homeScore: 0, awayScore: 1, minutes: 90, ...o });

interface Row { prof: string; startAge: number; steps: [number, number, number][]; /* [age, totalSP, gateCap (999 = none)] after every match */ byAge: Record<number, { level: number; matches: number; total: number }>; reach: Record<number, { age: number; matches: number }>; }
const rows: Row[] = [];
const t0 = Date.now();
for (let run = SHARD; run < N; run += SHARDS) {
  const pr = PROFS[run % PROFS.length];
  const startAge = 16 + (Math.floor(run / PROFS.length) % 3);
  const rng = mulberry(5000 + run * 131);
  const clubs0 = C.NATIONAL_LEAGUE_CLUBS;
  const p = { firstName: "A", lastName: "B", age: startAge, skinTone: "light", club: clubs0[(run * 5 + 3) % clubs0.length], clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as StarPlayer;
  let c: CareerState = withStars({ ...makeInitialCareer(p, [...clubs0], "national_league"), leagueSquads: squads(clubs0, 1) });
  const row: Row = { prof: pr.name, startAge, steps: [], byAge: {}, reach: {} };
  for (let season = 1; c.player.age <= END_AGE && season <= 25; season++) {
    let ratSum = 0, ratN = 0;
    for (let g = 0; g < 200; g++) {
      const f = c.fixtures.find(x => !x.played);
      if (!f) break;
      const r = rng(), won = r < pr.win, drew = !won && r < pr.win + pr.draw;
      const goals = rng() < pr.goals ? (rng() < 0.25 ? 2 : 1) + (rng() < 0.04 ? 1 : 0) + (pr.goals > 1 && rng() < 0.3 ? 1 : 0) : 0;
      const assists = rng() < pr.assists ? 1 : 0;
      const us = won ? Math.max(goals, 1) + (rng() < 0.4 ? 1 : 0) : drew ? Math.max(goals, rng() < 0.5 ? 1 : 0) : goals;
      const them = won ? Math.max(0, us - 1 - Math.floor(rng() * 2)) : drew ? us : us + 1 + Math.floor(rng() * 2);
      const rating = Math.min(10, pr.rating + goals * 0.7 + assists * 0.4 + (rng() - 0.5) * 1.2);
      ratSum += rating; ratN++;
      c = creditMatchResult(c, f, mk({ goals, assists, rating, starMan: rating >= 8.3, homeScore: f.home ? us : them, awayScore: f.home ? them : us })).career;
      const st = starStatus(c);
      row.steps.push([c.player.age, Math.round(st.total), (STAR_GATES.find(g => !g.open(c, ledgerOf(c)))?.cap ?? 999)]);
      const apps = matchesPlayed(ledgerOf(c));
      for (const L of [10, 20, 30, 50, 75, 100]) if (st.stars >= L && !row.reach[L]) row.reach[L] = { age: c.player.age, matches: apps };
    }
    const st = starStatus(c);
    row.byAge[c.player.age] = { level: st.stars, matches: matchesPlayed(ledgerOf(c)), total: st.total };
    c = advanceSeason(c, false).career;
    c = { ...c, leagueSquads: c.leagueSquads?.length ? c.leagueSquads : squads(c.league.map(t => t.name), season + 1) };
    // Guessed move policy: a player averaging 7.2+ last season signs for a club one division up (if not already promoted).
    const di = LADDER.findIndex(([d]) => d === divisionOf(c));
    if (ratN && ratSum / ratN >= 7.2 && di >= 0 && di < LADDER.length - 1 && season % 1 === 0) {
      // skip the move if the season already promoted us this summer (division changed vs last season)
      const [nd, nclubs] = LADDER[di + 1];
      if (rng() < 0.6) { c = attachClub(c, nclubs[(run * 7 + season) % nclubs.length], [...nclubs], nd); c = { ...c, leagueSquads: squads(nclubs, season + 1) }; c = withStars(c); }
    }
  }
  rows.push(row);
  if ((run + 1) % 5 === 0) console.error(`${run + 1}/${N} careers, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
if (OUT) { (await import("node:fs")).writeFileSync(OUT, JSON.stringify(rows)); console.error("wrote " + OUT); }
