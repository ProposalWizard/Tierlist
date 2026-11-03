/**
 * THE REAL HISTORY BEHIND EVERY HISTORY TAB (Mikey, 2 Nov 2026): the real
 * winners, runners-up, final scores, top scorers, top assisters and players
 * of the season before your career, from data/competition-history (read its
 * README). Shown under the seasons your career has played, so one list runs
 * from the first real season to today. Each file loads only when its tab is
 * opened. The joining rules are pure (`joinHistory`).
 */
import { seasonStartYear } from "../calendar";

export interface HistoryLine {
  /** "2025-26" (leagues, club cups) or "2024" (tournaments). */
  label: string;
  /** The calendar year it started, for ordering and joining. */
  year: number;
  real: boolean;
  notHeld?: boolean;
  winner?: string;
  runnerUp?: string;
  score?: string;
  scorers?: { name: string; club: string; n: number }[];
  assisters?: { name: string; club: string; n: number }[];
  best?: { name: string; club: string };
  /** Your career season number (in-game rows only). */
  season?: number;
}

/** Game competition name → file in data/competition-history. */
const SLUG: Record<string, string> = {
  "Premier League": "premier-league",
  "Championship": "championship",
  "League One": "league-one",
  "League Two": "league-two",
  "National League": "national-league",
  "National League North": "national-league-north",
  "National League South": "national-league-south",
  "FA Cup": "fa-cup",
  "League Cup": "league-cup",
  "Lower League Trophy": "lower-league-trophy",
  "Community Shield": "community-shield",
  "Champions League": "champions-league",
  "Europa League": "europa-league",
  "Super Cup": "super-cup",
  "World Cup": "world-cup",
  "European Championship": "european-championship",
  "Nations League": "nations-league",
  "Africa Cup of Nations": "africa-cup-of-nations",
  "Asian Cup": "asian-cup",
  "Gold Cup": "gold-cup",
  "CONCACAF Nations League": "concacaf-nations-league",
  "OFC Nations Cup": "ofc-nations-cup",
};

export const hasRealHistory = (comp: string): boolean => comp in SLUG;

interface FileRow {
  season: string;
  status: "played" | "not_held";
  winner?: string | null;
  runner_up?: string | null;
  final_score?: string | null;
  top_scorer?: { name: string; team: string; goals: number }[] | null;
  top_assister?: { name: string; team: string; assists: number }[] | null;
  player_of_season?: { name: string; team: string } | null;
}

/** "2025-26" / "1999-00" / "2024" → 2025 / 1999 / 2024. */
export const labelYear = (label: string): number => parseInt(label.slice(0, 4), 10);

/** A file's rows as history lines, newest first. */
export function linesFromFile(rows: FileRow[]): HistoryLine[] {
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

const cache = new Map<string, Promise<HistoryLine[]>>();

/** A competition's real history, newest first; [] when there is none. */
export function loadRealHistory(comp: string): Promise<HistoryLine[]> {
  const slug = SLUG[comp];
  if (!slug) return Promise.resolve([]);
  let p = cache.get(slug);
  if (!p) {
    p = import(`../../../data/competition-history/${slug}.json`)
      .then((m: { default?: { seasons: FileRow[] }; seasons?: FileRow[] }) => linesFromFile((m.default ?? m).seasons ?? []))
      .catch(() => { cache.delete(slug); return []; });
    cache.set(slug, p);
  }
  return p;
}

/**
 * One list: your career's seasons on top, then the real ones before it.
 * A real season from the year your career starts or later is left out (your
 * career plays that one), so the two never overlap.
 */
export function joinHistory(career: HistoryLine[], real: HistoryLine[], firstYear: number): HistoryLine[] {
  const yours = career.filter((r) => r.year >= firstYear);
  const taken = new Set(yours.map((r) => r.year));
  const before = real.filter((r) => r.year < firstYear && !taken.has(r.year));
  return [...yours, ...before].sort((a, b) => b.year - a.year);
}

/** The calendar year your first season starts (2026 for a 2026/27 start). */
export const careerFirstYear = (startYear: number): number => seasonStartYear(startYear, 1);
