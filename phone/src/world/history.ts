/**
 * THE REAL HISTORY UNDER EVERY HISTORY TAB, on the phone.
 * The website loads each file from data/competition-history when its tab
 * opens (lib/star/world/realHistory.ts loadRealHistory, a dynamic import the
 * phone's bundler cannot follow). The phone has every file inside the app
 * (about 600 KB), so here each one is a plain require, turned into lines by
 * the website's own linesFromFile and joined by its joinHistory.
 */
import { seasonStartYear } from "@/lib/star/calendar";

// -- Copied from lib/star/world/realHistory.ts (pure, unchanged) --
// That file cannot be bundled on the phone at all: its dynamic
// import of `${slug}.json` is rejected by the phone's bundler ("Invalid
// call"), so nothing on the phone may import it. These helpers are copied
// word for word; if realHistory.ts ever moves its loader into its own file,
// import them from there instead.

export interface HistoryLine {
  label: string; year: number; real: boolean; notHeld?: boolean;
  winner?: string; runnerUp?: string; score?: string;
  scorers?: { name: string; club: string; n: number }[];
  assisters?: { name: string; club: string; n: number }[];
  best?: { name: string; club: string };
  season?: number;
}
interface FileRow {
  season: string; status: "played" | "not_held";
  winner?: string | null; runner_up?: string | null; final_score?: string | null;
  top_scorer?: { name: string; team: string; goals: number }[] | null;
  top_assister?: { name: string; team: string; assists: number }[] | null;
  player_of_season?: { name: string; team: string } | null;
}
const labelYear = (label: string): number => parseInt(label.slice(0, 4), 10);
function linesFromFile(rows: FileRow[]): HistoryLine[] {
  return rows.map((r): HistoryLine => {
    const base = { label: r.season, year: labelYear(r.season), real: true };
    if (r.status === "not_held") return { ...base, notHeld: true };
    return {
      ...base,
      ...(r.winner ? { winner: r.winner } : {}),
      ...(r.runner_up ? { runnerUp: r.runner_up } : {}),
      ...(r.final_score ? { score: r.final_score } : {}),
      ...(r.top_scorer?.length ? { scorers: r.top_scorer.map((x) => ({ name: x.name, club: x.team, n: x.goals })) } : {}),
      ...(r.top_assister?.length ? { assisters: r.top_assister.map((x) => ({ name: x.name, club: x.team, n: x.assists })) } : {}),
      ...(r.player_of_season ? { best: { name: r.player_of_season.name, club: r.player_of_season.team } } : {}),
    };
  }).sort((a, b) => b.year - a.year);
}
/** Your career's seasons on top, then the real ones before it (never overlapping). */
export function joinHistory(career: HistoryLine[], real: HistoryLine[], firstYear: number): HistoryLine[] {
  const yours = career.filter((r) => r.year >= firstYear);
  const taken = new Set(yours.map((r) => r.year));
  const before = real.filter((r) => r.year < firstYear && !taken.has(r.year));
  return [...yours, ...before].sort((a, b) => b.year - a.year);
}
/** The calendar year your first season starts. */
export const careerFirstYear = (startYear: number): number => seasonStartYear(startYear, 1);
// ------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-require-imports */
const FILES: Record<string, () => { seasons?: unknown[] }> = {
  "Premier League": () => require("@/data/competition-history/premier-league.json"),
  "Championship": () => require("@/data/competition-history/championship.json"),
  "League One": () => require("@/data/competition-history/league-one.json"),
  "League Two": () => require("@/data/competition-history/league-two.json"),
  "National League": () => require("@/data/competition-history/national-league.json"),
  "National League North": () => require("@/data/competition-history/national-league-north.json"),
  "National League South": () => require("@/data/competition-history/national-league-south.json"),
  "FA Cup": () => require("@/data/competition-history/fa-cup.json"),
  "League Cup": () => require("@/data/competition-history/league-cup.json"),
  "Lower League Trophy": () => require("@/data/competition-history/lower-league-trophy.json"),
  "Community Shield": () => require("@/data/competition-history/community-shield.json"),
  "Champions League": () => require("@/data/competition-history/champions-league.json"),
  "Europa League": () => require("@/data/competition-history/europa-league.json"),
  "Super Cup": () => require("@/data/competition-history/super-cup.json"),
  "World Cup": () => require("@/data/competition-history/world-cup.json"),
  "European Championship": () => require("@/data/competition-history/european-championship.json"),
  "Nations League": () => require("@/data/competition-history/nations-league.json"),
  "Africa Cup of Nations": () => require("@/data/competition-history/africa-cup-of-nations.json"),
  "Asian Cup": () => require("@/data/competition-history/asian-cup.json"),
  "Gold Cup": () => require("@/data/competition-history/gold-cup.json"),
  "CONCACAF Nations League": () => require("@/data/competition-history/concacaf-nations-league.json"),
  "OFC Nations Cup": () => require("@/data/competition-history/ofc-nations-cup.json"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const cache = new Map<string, HistoryLine[]>();

/** A competition's real history, newest first; [] when there is none. */
export function realHistory(comp: string): HistoryLine[] {
  const hit = cache.get(comp);
  if (hit) return hit;
  let lines: HistoryLine[] = [];
  try {
    const f = FILES[comp]?.();
    lines = f ? linesFromFile((f.seasons ?? []) as FileRow[]) : [];
  } catch { lines = []; }
  cache.set(comp, lines);
  return lines;
}
