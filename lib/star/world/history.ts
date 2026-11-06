/**
 * EVERY COMPETITION'S HISTORY (Mikey, 22 Oct 2026, 24:44): the winner and the
 * runner-up of every season played, for League → History. One row per season
 * per competition, written at the rollover from that season's summary
 * (summary.ts). Older saves had no such list: they fall back to last season's
 * summary and the winners kept in seasonHistory (no runner-up there). Pure.
 */
import type { CareerState } from "../types";
import { leagueNameFor } from "../calendar";
import type { WorldSummary } from "./types";

export interface CompHistoryRow {
  season: number;
  /** A league's name ("League One") or a cup's ("FA Cup", "Champions League"). */
  comp: string;
  winner: string;
  runnerUp?: string;
  /** A final's score, winner first: "2-1", "1-1 (4-3 pens)". */
  score?: string;
  /** Top scorer(s), ties kept (Mikey, 2 Nov 2026). Absent: not known. */
  scorers?: HistoryName[];
  /** Top assister(s), ties kept. */
  assisters?: HistoryName[];
  /** Player of the season: the Season Awards' (your league), else most goals
   *  + assists (leagues, Europe), else the best player in the final (cups). */
  best?: { name: string; club: string };
}

export interface HistoryName { name: string; club: string; n: number }

/** The rows one finished season gives: each league's top two, each final. */
export function historyRowsFromSummary(s: WorldSummary): CompHistoryRow[] {
  const out: CompHistoryRow[] = [];
  const lead = new Map((s.leaders ?? []).map((l) => [l.competition, l]));
  const named = (xs: { player: string; club: string; n: number }[]) => xs.map((x) => ({ name: x.player, club: x.club, n: x.n }));
  const withLeaders = (r: CompHistoryRow): CompHistoryRow => {
    const l = lead.get(r.comp);
    if (!l) return r;
    return {
      ...r,
      ...(l.scorers.length ? { scorers: named(l.scorers) } : {}),
      ...(l.assisters.length ? { assisters: named(l.assisters) } : {}),
      ...(l.best ? { best: { name: l.best.player, club: l.best.club } } : {}),
    };
  };
  for (const t of s.tables) {
    if (!t.division || t.rows.length < 2) continue;
    out.push(withLeaders({ season: s.season, comp: t.name, winner: t.rows[0].name, runnerUp: t.rows[1].name }));
  }
  for (const f of s.finals ?? []) {
    if (!f.winner) continue;
    const winHome = f.winner === f.home;
    const score = f.hs !== undefined && f.as !== undefined
      ? `${winHome ? f.hs : f.as}-${winHome ? f.as : f.hs}${f.pens ? ` (${winHome ? f.pens.home : f.pens.away}-${winHome ? f.pens.away : f.pens.home} pens)` : ""}`
      : undefined;
    out.push(withLeaders({ season: s.season, comp: f.competition, winner: f.winner, runnerUp: winHome ? f.away : f.home, ...(score ? { score } : {}) }));
  }
  return out;
}

/** Add a season's rows, never twice for the same season and competition. */
export function withSeasonHistory(rows: CompHistoryRow[] | undefined, s: WorldSummary | undefined): CompHistoryRow[] {
  const have = rows ?? [];
  if (!s) return have;
  const seen = new Set(have.map((r) => `${r.season}|${r.comp}`));
  return [...have, ...historyRowsFromSummary(s).filter((r) => !seen.has(`${r.season}|${r.comp}`))];
}

/** One competition's history, newest first, from everything the save holds. */
export function compHistoryFor(career: CareerState, comp: string): CompHistoryRow[] {
  const rows = withSeasonHistory(career.compHistory, career.lastWorld).filter((r) => r.comp === comp);
  const have = new Set(rows.map((r) => r.season));
  // Older seasons: the winners seasonHistory kept (your division's league, the cups, Europe).
  for (const h of career.seasonHistory ?? []) {
    if (have.has(h.season)) continue;
    const w = h.winners;
    const winner = comp === leagueNameFor(h.division) ? w.league
      : comp === "FA Cup" ? w.faCup : comp === "League Cup" ? w.leagueCup
      : comp === "Champions League" ? w.championsLeague : comp === "Europa League" ? w.europaLeague : undefined;
    if (winner) rows.push({ season: h.season, comp, winner });
  }
  return rows.sort((a, b) => b.season - a.season);
}
