import type { CareerState, LeagueSquad, LeaguePlayer, LeagueResult, LeagueTeam } from "./types";
import { sortLeague } from "./season";
import { groundFor, crowdFor } from "./stadiums";

/**
 * THE SCOUT REPORT.
 *
 * What the pre-match screen tells you about who you're about to play —
 * requested directly, with a real-game screenshot as the reference for the
 * shape of it: top scorer, assist king, best player (each with a form strip
 * — did they actually score/assist in their last few games), the
 * opponent's own last five results, where they sit in the table, and your
 * own history against them.
 *
 * Everything here is read straight off data the game already tracks —
 * leagueSquads/externalSquads, career.results (the division's own weekly
 * results log, which already names every scorer and assister — see
 * LeagueResult), the league table, headToHead. An earlier version of this
 * derived "strengths and weaknesses" from squad overalls; dropped on
 * request in favour of this — real results are a stronger, less
 * second-guessable scouting story than a derived stat category anyway.
 */

export interface ScoutPlayer {
  name: string;
  value: number;
  position: string;
  image?: string;
  /**
   * Did this player do the thing the card is about (score, for the top
   * scorer; assist, for the assist king) in each of the club's last few
   * league games this season — oldest first, most recent last. As many
   * entries as games actually played, 0-5; absent for the best-player card,
   * which has no single relevant per-match event to track.
   */
  form?: boolean[];
}

export interface RecentResult {
  week: number;
  opponent: string;
  result: "W" | "D" | "L";
  scoreFor: number;
  scoreAgainst: number;
}

export interface TableRow {
  position: number;
  club: string;
  points: number;
  played: number;
  isOpponent: boolean;
}

export interface ScoutReport {
  club: string;
  ground: { name: string; crowd: number };
  /** Null when the opponent isn't in your own division's table — a cup
   *  shock against an outside club, mainly. */
  table: { position: number; of: number } | null;
  topScorer: ScoutPlayer | null;
  topAssister: ScoutPlayer | null;
  bestPlayer: ScoutPlayer | null;
  /** Oldest first, most recent last — same order VersusScreen's own form
   *  chips read. However many league games the opponent has actually
   *  played this season, 0-5. */
  recentResults: RecentResult[];
  /** A few rows of the table either side of the opponent — empty when
   *  they're not in it (see `table`). */
  tableSnippet: TableRow[];
  headToHead: { wins: number; draws: number; losses: number } | null;
}

function squadFor(career: CareerState, club: string): LeagueSquad | undefined {
  return (career.leagueSquads ?? []).find(s => s.club === club)
    ?? (career.externalSquads ?? []).find(s => s.club === club);
}

function best(players: LeaguePlayer[], value: (p: LeaguePlayer) => number): LeaguePlayer | null {
  return players.reduce<LeaguePlayer | null>((top, p) => (top === null || value(p) > value(top) ? p : top), null);
}

/** The club's own league games this season, oldest first, capped at the
 *  last five — the same slice both recentResultsFor and formFor read. */
function lastFive(club: string, results: LeagueResult[]): LeagueResult[] {
  return results
    .filter(r => r.home === club || r.away === club)
    .sort((a, b) => a.week - b.week)
    .slice(-5);
}

function recentResultsFor(club: string, results: LeagueResult[]): RecentResult[] {
  return lastFive(club, results).map(r => {
    const home = r.home === club;
    const scoreFor = home ? r.hs : r.as;
    const scoreAgainst = home ? r.as : r.hs;
    const result: RecentResult["result"] = scoreFor > scoreAgainst ? "W" : scoreFor === scoreAgainst ? "D" : "L";
    return { week: r.week, opponent: home ? r.away : r.home, result, scoreFor, scoreAgainst };
  });
}

/** The results log never carries a full name — it's trimmed to a bare
 *  surname by one of two different helpers depending on whether the goal
 *  was scored in a match you actually played (`surname()`,
 *  lib/star/media/grammar.ts) or one simulated without you
 *  (`shortNameOf()`, lib/star/realSquad.ts) — and those two don't always
 *  agree on a multi-word surname ("Dijk" vs "van Dijk"). Comparing on just
 *  the final word is the one thing both agree on, and squad names rarely
 *  collide on a surname alone. */
function lastWord(s: string): string {
  const parts = s.trim().split(/\s+/);
  return parts[parts.length - 1];
}

/** Did this named player score (or assist) in each of the club's last five
 *  league games — read off the same `hg`/`ag` scorer log the results page
 *  itself is built from, not a separate per-player history nothing else
 *  tracks. */
function formFor(playerName: string, club: string, results: LeagueResult[], kind: "scored" | "assisted"): boolean[] {
  const target = lastWord(playerName);
  return lastFive(club, results).map(r => {
    const goals = r.home === club ? r.hg : r.ag;
    if (!goals) return false;
    return goals.some(g => lastWord(kind === "scored" ? g.s : (g.a ?? "")) === target);
  });
}

function tableSnippetFor(table: LeagueTeam[], opponentIdx: number, radius = 2): TableRow[] {
  if (opponentIdx < 0) return [];
  const start = Math.max(0, opponentIdx - radius);
  const end = Math.min(table.length, opponentIdx + radius + 1);
  return table.slice(start, end).map((t, i) => ({
    position: start + i + 1, club: t.name, points: t.points, played: t.played,
    isOpponent: i + start === opponentIdx,
  }));
}

export function scoutReportFor(career: CareerState, opponent: string, week: number): ScoutReport {
  const squad = squadFor(career, opponent);
  const table = sortLeague(career.league);
  const idx = table.findIndex(t => t.name === opponent);
  const team = idx >= 0 ? table[idx] : null;
  const results = career.results ?? [];

  const topScorer = squad ? best(squad.players, p => p.goals) : null;
  const topAssister = squad ? best(squad.players, p => p.assists) : null;
  const bestPlayer = squad ? best(squad.players, p => p.overall) : null;

  const g = groundFor(opponent);
  return {
    club: opponent,
    ground: { name: g.name, crowd: crowdFor(opponent, week) },
    table: team ? { position: idx + 1, of: table.length } : null,
    topScorer: topScorer && topScorer.goals > 0
      ? {
        name: topScorer.name, value: topScorer.goals, position: topScorer.position, image: topScorer.image,
        form: formFor(topScorer.name, opponent, results, "scored"),
      }
      : null,
    topAssister: topAssister && topAssister.assists > 0
      ? {
        name: topAssister.name, value: topAssister.assists, position: topAssister.position, image: topAssister.image,
        form: formFor(topAssister.name, opponent, results, "assisted"),
      }
      : null,
    bestPlayer: bestPlayer
      ? { name: bestPlayer.name, value: bestPlayer.overall, position: bestPlayer.position, image: bestPlayer.image }
      : null,
    recentResults: recentResultsFor(opponent, results),
    tableSnippet: tableSnippetFor(table, idx),
    headToHead: career.headToHead?.[opponent] ?? null,
  };
}
