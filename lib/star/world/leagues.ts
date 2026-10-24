import type { CareerState, LeagueTeam, LeagueResult, LeagueSquad } from "../types";
import { buildSeasonFixtures, mulberry32, simulateFixtureScore } from "../season";
import { ALL_DIVISIONS, fixtureTimestamp, type CareerDivision } from "../calendar";
import { membershipOf, ratingFor, type DivisionMembership } from "../promotion";
import { applyResult, ruleBookFor } from "../ruleBook";
import { pickGoalIds } from "../leagueSquads";
import { shortNameOf } from "../realSquad";
import type { ScorerCounts, WorldLeague } from "./types";

/**
 * EVERY ENGLISH LEAGUE YOU ARE NOT IN, PLAYED ON ITS OWN DATES.
 *
 * Each division keeps its own table and its own double round-robin
 * (season.ts buildSeasonFixtures — the schedule your own league uses). A
 * round is played once its real date (calendar.ts fixtureTimestamp, the
 * division's own calendar: the Premier League's 38 rounds and international
 * breaks, 46 rounds below) is at or before the clock.
 *
 * A round's scores come from its own seed (season, division, round) and the
 * ratings taken when the world opened, so it comes out the same whenever it
 * is played: live, week by week, or all at once at the season's end.
 * Scorers are named on a second seed so a squad arriving late can't move a
 * score.
 */

export const MEMBER_KEY: Record<CareerDivision, keyof DivisionMembership> = {
  premier: "premier", championship: "championship", league_one: "leagueOne", league_two: "leagueTwo",
  national_league: "nationalLeague", national_league_north: "nationalLeagueNorth",
  national_league_south: "nationalLeagueSouth",
};

const DIV_INDEX: Record<CareerDivision, number> = {
  premier: 1, championship: 2, league_one: 3, league_two: 4,
  national_league: 5, national_league_north: 6, national_league_south: 7,
};

function emptyTeam(name: string, strength: number): LeagueTeam {
  return { name, strength, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

/** A fresh table for every division but yours, rated now. */
export function openWorldLeagues(career: CareerState, yours: CareerDivision): WorldLeague[] {
  const members = membershipOf(career);
  const out: WorldLeague[] = [];
  for (const division of ALL_DIVISIONS) {
    if (division === yours) continue;
    const clubs = [...members[MEMBER_KEY[division]]];
    if (clubs.length < 2) continue;
    const teams = clubs.map(c => emptyTeam(c, ratingFor(career, c, members)));
    const rounds = (clubs.length - (clubs.length % 2 === 0 ? 1 : 0)) * 2;
    out.push({ division, clubs, teams, played: 0, rounds, scorers: {} });
  }
  return out;
}

export function roundSeed(season: number, division: CareerDivision, round: number, salt = 0): number {
  return (Math.imul(season, 2654435761) ^ Math.imul(DIV_INDEX[division] * 97 + salt, 40503) ^ Math.imul(round, 2246822519)) >>> 0;
}

function addScorer(counts: ScorerCounts, id: string, goal: boolean): void {
  const c = counts[id] ?? [0, 0];
  counts[id] = goal ? [c[0] + 1, c[1]] : [c[0], c[1] + 1];
}

/** Play one round of one league. Returns a new WorldLeague. */
export function playWorldRound(
  career: CareerState, lg: WorldLeague, round: number, squadOf: (club: string) => LeagueSquad | undefined,
): WorldLeague {
  const rules = ruleBookFor(career, "FA");
  const scoreRng = mulberry32(roundSeed(career.season, lg.division, round));
  const nameRng = mulberry32(roundSeed(career.season, lg.division, round, 13));
  const byName = new Map(lg.teams.map(t => [t.name, { ...t }]));
  const scorers: ScorerCounts = { ...lg.scorers };
  const results: LeagueResult[] = [];
  for (const f of buildSeasonFixtures(lg.clubs)) {
    if (f.week !== round) continue;
    const H = byName.get(f.home), A = byName.get(f.away);
    if (!H || !A) continue;
    const sc = simulateFixtureScore(H.strength, A.strength, scoreRng);
    H.goalsFor += sc.home; H.goalsAgainst += sc.away;
    A.goalsFor += sc.away; A.goalsAgainst += sc.home;
    const o = applyResult(rules, H, A, sc.home, sc.away, H.strength, A.strength, scoreRng);
    Object.assign(H, o.home); Object.assign(A, o.away);
    const hg = pickGoalIds(squadOf(f.home), sc.home, nameRng);
    const ag = pickGoalIds(squadOf(f.away), sc.away, nameRng);
    for (const g of [...hg, ...ag]) {
      addScorer(scorers, g.id, true);
      if (g.assistId) addScorer(scorers, g.assistId, false);
    }
    const named = (gs: typeof hg) => gs.map(g => ({
      m: g.m, s: shortNameOf(g.name), ...(g.assist ? { a: shortNameOf(g.assist) } : {}),
    }));
    results.push({
      week: round, home: f.home, away: f.away, hs: sc.home, as: sc.away,
      ...(hg.length ? { hg: named(hg) } : {}), ...(ag.length ? { ag: named(ag) } : {}),
    });
  }
  return {
    ...lg,
    teams: lg.teams.map(t => byName.get(t.name) ?? t),
    played: round,
    last: results,
    scorers,
  };
}

/** The real date a world round is played on. */
export function worldRoundTime(career: CareerState, division: CareerDivision, round: number): number {
  return fixtureTimestamp(career.player.startYear, career.season, round, "league", division);
}

/** Play every round of every world league whose date has come. */
export function advanceWorldLeagues(
  career: CareerState, leagues: WorldLeague[], clock: number, squadOf: (club: string) => LeagueSquad | undefined,
): WorldLeague[] {
  let changed = false;
  const next = leagues.map((lg) => {
    let cur = lg;
    while (cur.played < cur.rounds && worldRoundTime(career, cur.division, cur.played + 1) <= clock) {
      cur = playWorldRound(career, cur, cur.played + 1, squadOf);
      changed = true;
    }
    return cur;
  });
  return changed ? next : leagues;
}

/**
 * One past round's scores, replayed (League → Results ‹ Round ›). A round's
 * scores come only from its own seed and the season's fixed ratings, so this
 * is exactly what was played. Only the latest round keeps scorers (`last`).
 */
export function worldRoundResults(career: CareerState, lg: WorldLeague, round: number): LeagueResult[] {
  if (round === lg.played && lg.last) return lg.last;
  return playWorldRound(career, lg, round, () => undefined).last ?? [];
}
