/**
 * OTHER SCORES DURING YOUR MATCH (v0.15 plan item 35).
 *
 * Harry: "In a title race or relegation battle, other scores pop up mid-game,
 * at the right minute, not after."
 *
 * The rest of the division's games used to be played only once yours was
 * over (creditMatchResult → playLeagueWeek), off the same random stream as
 * your own result — so nothing about them could be known during your match.
 * They now run on a stream of their own (`otherGamesRng`), seeded by season
 * and week alone. That makes them knowable at kick-off: `previewOtherGames`
 * plays exactly the same games, on the same stream and the same squads, and
 * gets exactly the scores and scorers the league table records at full time.
 *
 * What the match screen does with them (Harry's decisions, 27 Sep):
 *   - a goal pops up as your clock passes its minute, ONLY for a club you
 *     have ticked (matchDayPrefs.ts's followedTeams — none by default), one
 *     card at a time;
 *   - a button opens every game in the division as it stands right now
 *     (`scoresAt`), Football Manager style.
 */
import type { CareerState, Fixture, LeagueResult } from "./types";
import { playLeagueWeek, mulberry32 } from "./season";
import { ruleBookFor } from "./ruleBook";

/** The other games' own seed: season and week, nothing about your match. */
export function otherGamesSeed(season: number, week: number): number {
  return (Math.imul(season, 104729) + Math.imul(week, 7919) + 0x2f1d) >>> 0;
}
export function otherGamesRng(season: number, week: number): () => number {
  return mulberry32(otherGamesSeed(season, week));
}

/**
 * Every other game in your division this week, played now, exactly as the
 * league will record them at full time. Empty for a cup/Europe/international
 * night (the league does not move then).
 */
export function previewOtherGames(career: CareerState, fixture: Fixture): LeagueResult[] {
  if ((fixture.kind ?? "league") !== "league") return [];
  const league = career.league.map(t => ({ ...t }));
  const squads = (career.leagueSquads ?? []).map(sq => ({ ...sq, players: sq.players.map(p => ({ ...p })) }));
  const round = playLeagueWeek(league, fixture.week, {
    club: career.player.club, opponent: fixture.opponent, home: fixture.home, scored: 0, conceded: 0,
  }, mulberry32(1), squads, ruleBookFor(career, "FA"), otherGamesRng(career.season, fixture.week));
  return round.results.filter(r => r.home !== career.player.club && r.away !== career.player.club);
}

export interface LiveGoal {
  minute: number;
  home: string;
  away: string;
  /** The score in that game once this goal is in. */
  hs: number;
  as: number;
  scoredBy: "home" | "away";
  scorer?: string;
}

/** Every goal in every other game this week, in minute order. */
export function liveScoresFor(career: CareerState, fixture: Fixture): LiveGoal[] {
  return goalsOf(career, fixture, previewOtherGames(career, fixture));
}

function goalsOf(career: CareerState, fixture: Fixture, results: LeagueResult[]): LiveGoal[] {
  const out: LiveGoal[] = [];
  // Named goals carry their minute. A club with no squad on file scores
  // unnamed goals; give those a minute off the same week's seed.
  const fill = mulberry32(otherGamesSeed(career.season, fixture.week) ^ 0x51f);
  for (const r of results) {
    const side = (list: LeagueResult["hg"], count: number, scoredBy: "home" | "away") => {
      const named = (list ?? []).map(g => ({ m: g.m, s: g.s as string | undefined, scoredBy }));
      while (named.length < count) named.push({ m: 2 + Math.floor(fill() * 88), s: undefined, scoredBy });
      return named;
    };
    const goals = [...side(r.hg, r.hs, "home"), ...side(r.ag, r.as, "away")]
      .sort((x, y) => x.m - y.m || (x.scoredBy === "home" ? -1 : 1));
    let hs = 0, as = 0;
    for (const g of goals) {
      if (g.scoredBy === "home") hs++; else as++;
      out.push({ minute: g.m, home: r.home, away: r.away, hs, as, scoredBy: g.scoredBy, scorer: g.s });
    }
  }
  return out.sort((x, y) => x.minute - y.minute);
}

/** The other games this week (fixture order) and every goal in them, played once. */
export function liveWeekFor(career: CareerState, fixture: Fixture): { fixtures: { home: string; away: string }[]; goals: LiveGoal[] } {
  const results = previewOtherGames(career, fixture);
  return { fixtures: results.map(r => ({ home: r.home, away: r.away })), goals: goalsOf(career, fixture, results) };
}

/** Only the goals for clubs you have ticked. */
export function goalsForFollowed(goals: LiveGoal[], followed: readonly string[]): LiveGoal[] {
  if (!followed.length) return [];
  const f = new Set(followed);
  return goals.filter(g => f.has(g.home) || f.has(g.away));
}

export interface LiveScoreRow {
  home: string;
  away: string;
  hs: number;
  as: number;
  /** The minute of the latest goal, if any. */
  lastGoal?: number;
}

/** Every game as it stands at `minute`: the score from the goals already in. */
export function scoresAt(fixtures: { home: string; away: string }[], goals: LiveGoal[], minute: number): LiveScoreRow[] {
  return fixtures.map(fx => {
    let hs = 0, as = 0, lastGoal: number | undefined;
    for (const g of goals) {
      if (g.home !== fx.home || g.away !== fx.away || g.minute > minute) continue;
      hs = g.hs; as = g.as; lastGoal = g.minute;
    }
    return { home: fx.home, away: fx.away, hs, as, ...(lastGoal !== undefined ? { lastGoal } : {}) };
  });
}
