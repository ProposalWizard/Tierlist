import type { CareerState, LeagueResult, LeagueSquad } from "../types";
import { buildSeasonFixtures, mulberry32 } from "../season";
import { EURO_KO_SLOTS_WITH_R32, EURO_LEAGUE_PHASE_WEEKS, fixtureTimestamp } from "../calendar";
import { poolFor, simulate, sortEuro, type EuroStanding } from "../euro";
import { openEuroBracket, advanceEuroBracket, EURO_KO_ROUNDS } from "../euroBracket";
import { pickGoalIds } from "../leagueSquads";
import { shortNameOf } from "../realSquad";
import type { ScorerCounts, WorldEuro } from "./types";

/**
 * THE CHAMPIONS LEAGUE AND EUROPA LEAGUE YOU ARE NOT IN, PLAYED IN FULL
 * (Mikey, 19 Oct 2026: "simulate the entire Champions League run, from the
 * league to the knockouts to the final").
 *
 * The field is the season's real 36 (euro.ts poolFor — the same field your
 * own campaign would have had). Eight league-phase matchdays on the real
 * European dates: each club plays eight different opponents, four at home
 * (the first eight rounds of a 36-club round robin, so nobody meets twice).
 * Then UEFA's real bracket off the final table (euroBracket.ts), one round
 * at a time once the date of its last leg has come. Scores use Europe's own
 * match model (euro.ts simulate), as your campaign does.
 *
 * Replaces crownWithoutYou's single weighted pick, which also let an English
 * club that was never in the field win it (17.5% of Europa League winners,
 * measured 19 Oct 2026).
 */

type Comp = WorldEuro["competition"];
const COMP_SALT: Record<Comp, number> = { "Champions League": 211, "Europa League": 223 };

function seed(season: number, comp: Comp, step: number, salt = 0): number {
  return (Math.imul(season, 2246822519) ^ Math.imul(COMP_SALT[comp] + salt, 3266489917) ^ Math.imul(step + 1, 668265263)) >>> 0;
}

export function openWorldEuro(career: CareerState, competition: Comp): WorldEuro {
  const clubs = poolFor(competition, career);
  const table: EuroStanding[] = clubs.map(c => ({
    name: c.name, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, isYou: false,
  }));
  return { competition, clubs, table, matchdays: 0, koRounds: 0, scorers: {} };
}

/** The eight matchdays: rounds 1-8 of a round robin over a seeded order. */
function schedule(season: number, w: WorldEuro): { week: number; home: string; away: string }[] {
  const rng = mulberry32(seed(season, w.competition, 99));
  const order = w.clubs.map(c => c.name);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return buildSeasonFixtures(order).filter(f => f.week <= EURO_LEAGUE_PHASE_WEEKS.length);
}

function euroTime(career: CareerState, week: number): number {
  return fixtureTimestamp(career.player.startYear, career.season, week, "europe", "premier");
}

/** When a knockout round is settled: the date of its last leg. */
function koRoundTime(career: CareerState, round: string): number {
  const weeks = EURO_KO_SLOTS_WITH_R32.filter(s => s.round === round).map(s => s.week);
  return euroTime(career, Math.max(...weeks));
}

function add(counts: ScorerCounts, id: string, goal: boolean): void {
  const c = counts[id] ?? [0, 0];
  counts[id] = goal ? [c[0] + 1, c[1]] : [c[0], c[1] + 1];
}

function playMatchday(career: CareerState, w: WorldEuro, md: number, squadOf: (c: string) => LeagueSquad | undefined): WorldEuro {
  const strength = new Map(w.clubs.map(c => [c.name, c.strength]));
  const rows = new Map(w.table.map(r => [r.name, { ...r }]));
  const scoreRng = mulberry32(seed(career.season, w.competition, md));
  const nameRng = mulberry32(seed(career.season, w.competition, md, 7));
  const scorers: ScorerCounts = { ...w.scorers };
  const results: LeagueResult[] = [];
  const credit = (name: string, gf: number, ga: number) => {
    const r = rows.get(name);
    if (!r) return;
    r.played++; r.goalsFor += gf; r.goalsAgainst += ga;
    if (gf > ga) { r.won++; r.points += 3; } else if (gf === ga) { r.drawn++; r.points++; } else r.lost++;
  };
  for (const f of schedule(career.season, w)) {
    if (f.week !== md) continue;
    const [hs, as] = simulate(strength.get(f.home) ?? 75, strength.get(f.away) ?? 75, scoreRng);
    credit(f.home, hs, as);
    credit(f.away, as, hs);
    const hg = pickGoalIds(squadOf(f.home), hs, nameRng);
    const ag = pickGoalIds(squadOf(f.away), as, nameRng);
    for (const g of [...hg, ...ag]) { add(scorers, g.id, true); if (g.assistId) add(scorers, g.assistId, false); }
    const named = (gs: typeof hg) => gs.map(g => ({ m: g.m, s: shortNameOf(g.name), ...(g.assist ? { a: shortNameOf(g.assist) } : {}) }));
    results.push({ week: md, home: f.home, away: f.away, hs, as, ...(hg.length ? { hg: named(hg) } : {}), ...(ag.length ? { ag: named(ag) } : {}) });
  }
  return { ...w, table: w.table.map(r => rows.get(r.name) ?? r), matchdays: md, last: results, scorers };
}

/** Play every matchday and knockout round of one competition whose date has come. */
export function advanceWorldEuro(
  career: CareerState, w: WorldEuro, clock: number, squadOf: (c: string) => LeagueSquad | undefined,
): WorldEuro {
  let cur = w;
  while (cur.matchdays < EURO_LEAGUE_PHASE_WEEKS.length && euroTime(career, EURO_LEAGUE_PHASE_WEEKS[cur.matchdays]) <= clock) {
    cur = playMatchday(career, cur, cur.matchdays + 1, squadOf);
  }
  if (cur.matchdays < EURO_LEAGUE_PHASE_WEEKS.length || cur.winner) return cur;
  const str = (c: string) => cur.clubs.find(x => x.name === c)?.strength ?? 75;
  let bracket = cur.bracket ?? openEuroBracket(sortEuro(cur.table).map(r => r.name), mulberry32(seed(career.season, cur.competition, 50)));
  let koRounds = cur.koRounds;
  while (koRounds < EURO_KO_ROUNDS.length && koRoundTime(career, EURO_KO_ROUNDS[koRounds]) <= clock) {
    bracket = advanceEuroBracket(bracket, "", str, simulate, mulberry32(seed(career.season, cur.competition, 60 + koRounds)), koRounds);
    koRounds++;
  }
  if (bracket === cur.bracket && koRounds === cur.koRounds) return cur;
  return { ...cur, bracket, koRounds, ...(bracket.winner ? { winner: bracket.winner } : {}) };
}
