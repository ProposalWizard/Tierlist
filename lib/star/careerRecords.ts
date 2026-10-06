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
import type { CareerBests, CareerState, Fixture, MatchStats, SeasonArchiveRow, SeasonHistoryRow, SeasonMate, SquadPlayer } from "./types";

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

const DEFENCE = new Set<SquadPlayer["position"]>(["CB", "LB", "RB"]);
const MIDFIELD = new Set<SquadPlayer["position"]>(["CDM", "CM", "CAM"]);

/**
 * A season's best team-mates, for its history row (see SeasonMate). Leo,
 * 6 Oct 2026, the farewell match: "your best team-mates from every club".
 *
 * Five at most: the top scorer and the top creator (when they did anything),
 * then the best keeper, defender and midfielder, so a whole side can be drawn
 * from the rows years later; then whoever is best. About 150 bytes each.
 */
export function bestMatesOf(squad: SquadPlayer[] | undefined, max = 5): SeasonMate[] {
  const pool = (squad ?? []).filter(p => p && typeof p.name === "string" && p.name.length > 0);
  if (pool.length === 0) return [];
  const ov = (p: SquadPlayer) => p.overall ?? 60;
  const worth = (p: SquadPlayer) => ov(p) + ((p.seasonGoals ?? 0) + (p.seasonAssists ?? 0)) * 0.6;
  const by = (f: (p: SquadPlayer) => number) => [...pool].sort((a, b) => f(b) - f(a) || ov(b) - ov(a));
  const picked: SquadPlayer[] = [];
  const take = (p: SquadPlayer | undefined) => { if (p && !picked.includes(p) && picked.length < max) picked.push(p); };
  const scorer = by(p => p.seasonGoals ?? 0)[0];
  if (scorer && (scorer.seasonGoals ?? 0) > 0) take(scorer);
  const creator = by(p => p.seasonAssists ?? 0).find(p => !picked.includes(p));
  if (creator && (creator.seasonAssists ?? 0) > 0) take(creator);
  take(by(ov).find(p => p.position === "GK" && !picked.includes(p)));
  take(by(ov).find(p => DEFENCE.has(p.position) && !picked.includes(p)));
  take(by(worth).find(p => MIDFIELD.has(p.position) && !picked.includes(p)));
  for (const p of by(worth)) take(p);
  return picked.map(p => ({
    id: p.id,
    name: p.name,
    position: p.position,
    ...(typeof p.overall === "number" ? { overall: p.overall } : {}),
    ...(p.imageUrl ? { face: p.imageUrl } : {}),
    goals: p.seasonGoals ?? 0,
    assists: p.seasonAssists ?? 0,
  }));
}

/**
 * The season about to end, as the world saw it (see SeasonHistoryRow).
 *
 * Pure: advanceSeason works out the table, the winners and the Ballon d'Or
 * (it already has all three) and this only decides what is kept. Europe's
 * winners are kept only when they are real for this save: in the Premier
 * League, or in that competition yourself. Outside the top flight,
 * resolveSeasonWinners builds England's European entrants off YOUR
 * division's table, so a Championship club can be named a Champions League
 * winner — not something to print on a career overview.
 */
export function historyRowFor(
  career: CareerState,
  facts: {
    /** The club the season was played for (default: this season's club). */
    club?: string;
    division: SeasonHistoryRow["division"];
    position: number;
    teams: number;
    move?: SeasonHistoryRow["move"];
    winners: NonNullable<CareerState["lastSeasonWinners"]>;
    ballonDor?: SeasonHistoryRow["ballonDor"];
    /** Your wage and money as the season ended (default: the career's now).
     *  Differs only after a move made at this rollover — see careerFlow.ts. */
    wage?: number;
    money?: number;
    /** The season's best team-mates (bestMatesOf). */
    mates?: SeasonMate[];
  },
): SeasonHistoryRow {
  const w = facts.winners;
  const inEurope = career.euroState?.competition;
  const realCL = facts.division === "premier" || inEurope === "Champions League";
  const realEL = facts.division === "premier" || inEurope === "Europa League";
  return {
    season: career.season,
    age: career.player.age,
    club: facts.club ?? career.thisSeasonClub ?? career.player.club,
    division: facts.division,
    position: facts.position,
    teams: facts.teams,
    move: facts.move ?? null,
    winners: {
      ...(w.league ? { league: w.league } : {}),
      ...(w.faCup ? { faCup: w.faCup } : {}),
      ...(w.leagueCup ? { leagueCup: w.leagueCup } : {}),
      ...(realCL && w.championsLeague ? { championsLeague: w.championsLeague } : {}),
      ...(realEL && w.europaLeague ? { europaLeague: w.europaLeague } : {}),
    },
    ...(facts.ballonDor ? { ballonDor: facts.ballonDor } : {}),
    ...(typeof career.stars === "number" ? { stars: career.stars } : {}),
    overall: career.starRating,
    fame: career.fame,
    money: facts.money ?? career.money,
    wage: facts.wage ?? career.contract.wage,
    caps: career.caps ?? 0,
    intlGoals: career.internationalGoals ?? 0,
    ...(facts.mates && facts.mates.length > 0 ? { mates: facts.mates } : {}),
  };
}

/** Finished seasons, then the one in progress (if you've played in it). */
export function allSeasons(career: CareerState): (SeasonArchiveRow & { live?: boolean })[] {
  const rows: (SeasonArchiveRow & { live?: boolean })[] = [...(career.seasonArchive ?? [])];
  // A retired career's last season is archived AND still in seasonStats
  // (closeFinalSeason, careerFlow.ts): list it once.
  if (career.seasonStats.appearances > 0 && !rows.some(r => r.season === career.season)) {
    rows.push({ ...archiveRowFor(career), live: true });
  }
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
