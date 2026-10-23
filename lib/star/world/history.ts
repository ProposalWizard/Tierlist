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
}

/** The rows one finished season gives: each league's top two, each final. */
export function historyRowsFromSummary(s: WorldSummary): CompHistoryRow[] {
  const out: CompHistoryRow[] = [];
  for (const t of s.tables) {
    if (!t.division || t.rows.length < 2) continue;
    out.push({ season: s.season, comp: t.name, winner: t.rows[0].name, runnerUp: t.rows[1].name });
  }
  for (const f of s.finals ?? []) {
    if (!f.winner) continue;
    const winHome = f.winner === f.home;
    const score = f.hs !== undefined && f.as !== undefined
      ? `${winHome ? f.hs : f.as}-${winHome ? f.as : f.hs}${f.pens ? ` (${winHome ? f.pens.home : f.pens.away}-${winHome ? f.pens.away : f.pens.home} pens)` : ""}`
      : undefined;
    out.push({ season: s.season, comp: f.competition, winner: f.winner, runnerUp: winHome ? f.away : f.home, ...(score ? { score } : {}) });
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
