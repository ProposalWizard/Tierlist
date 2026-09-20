import type { CareerState, LeagueSquad, LeaguePlayer, LeagueResult, Fixture } from "./types";
import { sortLeague } from "./season";
import { sortEuro } from "./euro";
import { groundFor, crowdFor } from "./stadiums";
import { tieWinner } from "./cups";
import { scoutTacticsFor, type ScoutTactics } from "./formationShape";

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
 *
 * ── A Champions/Europa League opponent reads from a different table ──
 *
 * Requested directly, after asking whether the game tracked real Champions
 * League fixtures at all: "can you do that with the scout report as well?
 * ...just for Champions League stats only." A European opponent is never in
 * `career.league`/`career.results` — those are the domestic division's own
 * data — so this used to render a real squad's `bestPlayer` card correctly
 * (that one only needs a static overall) while `topScorer`/`topAssister`/
 * `recentResults`/`table` all silently came back empty, because their goals
 * were never named anywhere (see `euro.ts`'s `simulateEuroMatchday`, which
 * now names them) and there was nowhere to read a European standings
 * position from either. `career.euroState.results`/`liveTable` are the
 * European analogues of `career.results`/`career.league` — deliberately the
 * same `LeagueResult` shape (see `EuroState.results`'s own note), so
 * `recentResultsFor`/`formFor` below are shared, unmodified, between both
 * branches; only WHICH table/results array feeds them differs.
 */

export interface ScoutPlayer {
  name: string;
  value: number;
  position: string;
  image?: string;
  /** The same three numbers on every card regardless of which one is the
   *  headline stat — real, tracked fields, not a fabricated "appearances"
   *  count (nothing in this game tracks per-player minutes for a squad you
   *  don't manage). */
  goals: number;
  assists: number;
  overall: number;
  /**
   * How many times this player did the thing the card is about (goals, for
   * the top scorer; assists, for the assist king) in each of the club's
   * last five league games this season — oldest first, most recent last, 0
   * meaning they didn't. A count rather than a yes/no so a brace or a hat
   * trick shows as more than a single strike did. As many entries as games
   * actually played, 0-5; absent for the best-player card, which has no
   * single relevant per-match event to track.
   */
  form?: number[];
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

/** One round the opponent has already played in THIS SAME cup competition
 *  this season — see `cupRunFor`. */
export interface CupRunEntry {
  round: string;
  opponent: string;
  result: "W" | "L";
  scoreFor: number;
  scoreAgainst: number;
  onPenalties: boolean;
}

export interface ScoutReport {
  club: string;
  ground: { name: string; crowd: number };
  /** Null when the opponent isn't in your own division's table — a cup
   *  shock against an outside club, mainly. */
  table: { position: number; of: number } | null;
  /**
   * The opponent's own results so far in THIS SAME cup competition this
   * season — set (a real array, possibly empty) ONLY for a cup fixture
   * (`fixture.kind === "cup"`); `null` for a league fixture, where a Cup
   * Run box makes no sense and the League Table box keeps its old job
   * instead. A league position tells you nothing about a cup draw, and an
   * opponent from outside your own division (the FA Cup's Round of 64 can
   * pit a Premier League career against a League Two club) has no league
   * table row for you at all — this replaces that box for a cup tie. Oldest
   * round first, same "oldest first" convention `recentResults` already
   * uses — the UI reverses it for display, same as Recent Form.
   */
  cupRun: CupRunEntry[] | null;
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
  /**
   * How they'll set up — formation, playstyle and where their line will sit
   * given the strength gap to you (see scoutTacticsFor, formationShape.ts).
   * The same three inputs the in-match block layer reads, so the report
   * matches what you actually face.
   */
  tactics: ScoutTactics;
}

/** The strength gap fed to the tactical read — mirrors page.tsx's own
 *  oppStrength calc (fixture override + home/away nudge) so the scout report
 *  describes the same block the match will build. */
function tacticsFrom(career: CareerState, opponent: string, fixture?: Fixture): ScoutTactics {
  const myStrength = career.league.find(t => t.name === career.player.club)?.strength ?? 65;
  const base = fixture?.opponentStrength
    ?? career.league.find(t => t.name === opponent)?.strength
    ?? 65;
  const oppStrength = Math.max(20, Math.min(99, base + (fixture ? (fixture.home ? -3 : 4) : 0)));
  return scoutTacticsFor(opponent, myStrength, oppStrength);
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

/** How many times did this named player score (or assist) in each of the
 *  club's last five league games — read off the same `hg`/`ag` scorer log
 *  the results page itself is built from, not a separate per-player
 *  history nothing else tracks. A brace or a hat trick counts as more than
 *  one, not just "yes". */
function formFor(playerName: string, club: string, results: LeagueResult[], kind: "scored" | "assisted"): number[] {
  const target = lastWord(playerName);
  return lastFive(club, results).map(r => {
    const goals = r.home === club ? r.hg : r.ag;
    if (!goals) return 0;
    return goals.filter(g => lastWord(kind === "scored" ? g.s : (g.a ?? "")) === target).length;
  });
}

/**
 * A fixed-size window of the table centred on the opponent — always
 * `radius * 2 + 1` rows (5, by default) when the division has that many
 * clubs, clamped by SLIDING the whole window rather than shrinking it: a
 * club sitting 20th in a 20-team division still gets 5 rows (16th-20th),
 * not just the 2 or 3 that a naive "radius each side, clamp each side
 * independently" produces once you're within `radius` of an edge.
 *
 * Takes just the three fields it actually reads rather than the full
 * `LeagueTeam` shape, so the same function works for a European standings
 * row (`EuroStanding`, sorted by `sortEuro`) without any adapting — both
 * shapes already carry `name`/`points`/`played`.
 */
function tableSnippetFor(
  table: { name: string; points: number; played: number }[],
  opponentIdx: number,
  radius = 2,
): TableRow[] {
  if (opponentIdx < 0) return [];
  const windowSize = Math.min(table.length, radius * 2 + 1);
  let start = opponentIdx - radius;
  if (start < 0) start = 0;
  if (start + windowSize > table.length) start = table.length - windowSize;
  const end = start + windowSize;
  return table.slice(start, end).map((t, i) => ({
    position: start + i + 1, club: t.name, points: t.points, played: t.played,
    isOpponent: start + i === opponentIdx,
  }));
}

/** The three player cards — shared between the domestic and European
 *  branches below; only which `results` log feeds the form strips differs. */
function playerCards(squad: LeagueSquad | undefined, opponent: string, results: LeagueResult[]) {
  const topScorer = squad ? best(squad.players, p => p.goals) : null;
  const topAssister = squad ? best(squad.players, p => p.assists) : null;
  const bestPlayer = squad ? best(squad.players, p => p.overall) : null;
  return {
    topScorer: topScorer && topScorer.goals > 0
      ? {
        name: topScorer.name, value: topScorer.goals, position: topScorer.position, image: topScorer.image,
        goals: topScorer.goals, assists: topScorer.assists, overall: topScorer.overall,
        form: formFor(topScorer.name, opponent, results, "scored"),
      }
      : null,
    topAssister: topAssister && topAssister.assists > 0
      ? {
        name: topAssister.name, value: topAssister.assists, position: topAssister.position, image: topAssister.image,
        goals: topAssister.goals, assists: topAssister.assists, overall: topAssister.overall,
        form: formFor(topAssister.name, opponent, results, "assisted"),
      }
      : null,
    bestPlayer: bestPlayer
      ? {
        name: bestPlayer.name, value: bestPlayer.overall, position: bestPlayer.position, image: bestPlayer.image,
        goals: bestPlayer.goals, assists: bestPlayer.assists, overall: bestPlayer.overall,
      }
      : null,
  };
}

/**
 * The opponent's own run in this cup competition so far this season —
 * pulled straight from the real `CupState.rounds` history the cup engine
 * already tracks for every club in the draw, not just you. Every round
 * before the one currently being drawn has a settled `hs`/`as` for every
 * tie in it (only YOUR tie in the current round can still be unplayed), so
 * filtering to settled ties naturally excludes the fixture about to be
 * played without needing to special-case it.
 */
function cupRunFor(career: CareerState, opponent: string, competition: string): CupRunEntry[] {
  const state = (career.cupState ?? []).find(s => s.competition === competition);
  if (!state) return [];
  const entries: CupRunEntry[] = [];
  for (const round of state.rounds) {
    for (const tie of round.ties) {
      if (tie.hs === undefined || tie.as === undefined) continue;
      if (tie.home !== opponent && tie.away !== opponent) continue;
      const home = tie.home === opponent;
      entries.push({
        round: round.name,
        opponent: home ? tie.away : tie.home,
        result: tieWinner(tie) === opponent ? "W" : "L",
        scoreFor: home ? tie.hs : tie.as,
        scoreAgainst: home ? tie.as : tie.hs,
        onPenalties: tie.pens !== undefined,
      });
    }
  }
  return entries;
}

export function scoutReportFor(career: CareerState, opponent: string, week: number, fixture?: Fixture): ScoutReport {
  const squad = squadFor(career, opponent);
  const g = groundFor(opponent);
  const ground = { name: g.name, crowd: crowdFor(opponent, week) };

  // A cup fixture (League Cup/FA Cup — the only two backed by a real
  // CupState) gets a Cup Run box instead of a League Table one — a league
  // position tells you nothing about a knockout draw, and the opponent may
  // not even be in your own division at all (the FA Cup's Round of 64 can
  // draw a League Two club into a Premier League career). See
  // ScoutReport.cupRun's own doc comment.
  if (fixture?.kind === "cup" && fixture.competition) {
    const cupRun = cupRunFor(career, opponent, fixture.competition);
    return {
      club: opponent,
      ground,
      table: null,
      cupRun,
      ...playerCards(squad, opponent, career.results ?? []),
      recentResults: recentResultsFor(opponent, career.results ?? []),
      tableSnippet: [],
      headToHead: career.headToHead?.[opponent] ?? null,
      tactics: tacticsFrom(career, opponent, fixture),
    };
  }

  // A Champions/Europa/Conference League opponent — never in the domestic
  // league table, but the campaign's own standings and fixture history
  // (see EuroState.results/liveTable) tell exactly the same kind of story.
  // `euro.clubs` always includes the PLAYER's own club too (marked `isYou`)
  // — excluded explicitly here, or a caller asking about a fixture whose
  // opponent happens to equal `career.player.club` (never a real fixture,
  // but exercised by this file's own test suite) would get scouted against
  // the European table instead of the domestic one.
  const euro = career.euroState;
  if (euro && opponent !== career.player.club && euro.clubs.some(c => c.name === opponent)) {
    const euroTable = sortEuro(euro.liveTable);
    const idx = euroTable.findIndex(r => r.name === opponent);
    const results = euro.results ?? [];
    return {
      club: opponent,
      ground,
      table: idx >= 0 ? { position: idx + 1, of: euroTable.length } : null,
      cupRun: null,
      ...playerCards(squad, opponent, results),
      recentResults: recentResultsFor(opponent, results),
      tableSnippet: tableSnippetFor(euroTable, idx),
      headToHead: career.headToHead?.[opponent] ?? null,
      tactics: tacticsFrom(career, opponent, fixture),
    };
  }

  const table = sortLeague(career.league);
  const idx = table.findIndex(t => t.name === opponent);
  const team = idx >= 0 ? table[idx] : null;
  const results = career.results ?? [];

  return {
    club: opponent,
    ground,
    table: team ? { position: idx + 1, of: table.length } : null,
    cupRun: null,
    ...playerCards(squad, opponent, results),
    recentResults: recentResultsFor(opponent, results),
    tableSnippet: tableSnippetFor(table, idx),
    headToHead: career.headToHead?.[opponent] ?? null,
    tactics: tacticsFrom(career, opponent, fixture),
  };
}
