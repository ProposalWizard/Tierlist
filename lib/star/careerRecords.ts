/**
 * YOUR OWN RECORDS — the Stats page's "All seasons" and "Records" tabs.
 *
 * PROTOTYPE (home-screen proto, 27 Sep 2026). Harry: "season stats should
 * also have an all seasons tag which includes stats overall and per club and
 * all of your records (furthest goal, furthest assist, most goals in a game,
 * most in a season, motm awards, potm, balon dors, trophies etc."
 *
 * Pure functions only. `bestsAfterMatch` runs inside creditMatchResult,
 * `archiveRowFor` inside advanceSeason. Everything here is additive: a save
 * from before it simply has no history, and starts counting from now.
 *
 * MOTM is the game's existing "Star Man" (matchStats.ts: rating ≥ 8.5 or two
 * goals) — already counted in `careerStats.starMan`, so it is read, not
 * re-invented.
 */
import type { CareerBests, CareerState, Fixture, MatchStats, SeasonArchiveRow } from "./types";

const fullName = (c: CareerState) => `${c.player.firstName} ${c.player.lastName}`;

/** Your bests after one match. Every competition counts (club and country). */
export function bestsAfterMatch(
  career: CareerState,
  fixture: Fixture,
  stats: MatchStats,
  seasonGoals: number,
  seasonAssists: number,
): CareerBests {
  const b: CareerBests = { ...(career.careerBests ?? {}) };
  const season = career.season;
  const opponent = fixture.opponent;
  const me = fullName(career);
  for (const e of stats.goalEvents ?? []) {
    if (e.isUserGoal && e.distance !== undefined && e.distance > (b.furthestGoal?.metres ?? -1)) {
      b.furthestGoal = { metres: e.distance, season, opponent };
    }
    if (!e.isUserGoal && e.assist === me) {
      // The pass itself when the engine knew it; the strike's distance otherwise.
      const m = e.passLength ?? e.distance;
      if (m !== undefined && m > (b.furthestAssist?.metres ?? -1)) b.furthestAssist = { metres: m, season, opponent };
    }
  }
  if (stats.goals > 0 && stats.goals > (b.mostGoalsMatch?.goals ?? 0)) b.mostGoalsMatch = { goals: stats.goals, season, opponent };
  if (seasonGoals > 0 && seasonGoals > (b.mostGoalsSeason?.goals ?? 0)) b.mostGoalsSeason = { goals: seasonGoals, season };
  if (seasonAssists > 0 && seasonAssists > (b.mostAssistsSeason?.assists ?? 0)) b.mostAssistsSeason = { assists: seasonAssists, season };
  return b;
}

/** The season about to end, as one archive row. */
export function archiveRowFor(career: CareerState): SeasonArchiveRow {
  const s = career.seasonStats;
  return {
    season: career.season,
    club: career.thisSeasonClub ?? career.player.club,
    apps: s.appearances,
    goals: s.goals,
    assists: s.assists,
    avgRating: s.ratingCount > 0 ? Math.round((s.totalRating / s.ratingCount) * 100) / 100 : 0,
    motm: s.starMan,
  };
}

/** Finished seasons, then the one in progress (if you've played in it). */
export function allSeasons(career: CareerState): (SeasonArchiveRow & { live?: boolean })[] {
  const rows: (SeasonArchiveRow & { live?: boolean })[] = [...(career.seasonArchive ?? [])];
  if (career.seasonStats.appearances > 0) rows.push({ ...archiveRowFor(career), live: true });
  return rows;
}

export interface ClubTotals { club: string; seasons: number; apps: number; goals: number; assists: number }

/** Per club: the archive plus the season in progress. */
export function perClubTotals(career: CareerState): ClubTotals[] {
  const by = new Map<string, ClubTotals>();
  for (const r of allSeasons(career)) {
    const t = by.get(r.club) ?? { club: r.club, seasons: 0, apps: 0, goals: 0, assists: 0 };
    t.seasons += 1; t.apps += r.apps; t.goals += r.goals; t.assists += r.assists;
    by.set(r.club, t);
  }
  return Array.from(by.values()).sort((a, b) => b.apps - a.apps);
}

/** Trophies grouped by competition, most won first. */
export function trophiesByCompetition(career: CareerState): { competition: string; seasons: number[] }[] {
  const by = new Map<string, number[]>();
  for (const t of career.trophies) by.set(t.competition, [...(by.get(t.competition) ?? []), t.season]);
  return Array.from(by.entries()).map(([competition, seasons]) => ({ competition, seasons })).sort((a, b) => b.seasons.length - a.seasons.length);
}
