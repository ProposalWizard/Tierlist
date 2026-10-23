/**
 * EVERY INTERNATIONAL COMPETITION ON THE LEAGUE PAGE (Mikey, 22 Oct 2026,
 * 23:11-24:17): pick the Nations League, a qualifying campaign, the Euros or
 * the World Cup like any league, and see its current edition's group tables,
 * its results round by round, and the winner and runner-up of every final
 * the game has played. Read off the international world (career.ts worldOf);
 * nothing new is stored. Pure.
 */
import type { CareerState } from "../types";
import { worldOf, intlOf, type GroupView, type MatchView } from "./career";
import type { CompKind, WorldMatch } from "./world";
import { played, table } from "./engine";

/** The order they sit in the picker: finals first, then their qualifiers. */
const ORDER: CompKind[] = [
  "World Cup", "World Cup Qualifier", "World Cup Play-Off",
  "European Championship", "Euro Qualifier", "Nations League",
  "Copa América", "Africa Cup of Nations", "AFCON Qualifier",
  "Asian Cup", "Asian Cup Qualifier", "Gold Cup", "Gold Cup Qualifier",
  "CONCACAF Nations League", "OFC Nations Cup",
];

export interface IntlRound { name: string; matches: MatchView[]; played: boolean }

export interface IntlCompView {
  comp: CompKind;
  /** "Nations League 2026-27". */
  title: string;
  groups: GroupView[];
  rounds: IntlRound[];
  /** The round to open on: the latest one played, else the first. */
  openAt: number;
  history: { year: number; winner: string; runnerUp: string; score: string }[];
  /** Your nation is in this edition. */
  yours: boolean;
}

const view = (m: WorldMatch): MatchView => ({
  id: m.id, date: m.date, comp: m.comp, stage: m.stage, home: m.home, away: m.away, hs: m.hs, as: m.as,
  ...(m.pens ? { pens: `${m.pens.hs}-${m.pens.as} pens` } : {}),
});

/** The edition to show: one being played now, else the last one played, else the next. */
function currentEdition(ms: WorldMatch[]): string | null {
  const byEd = new Map<string, WorldMatch[]>();
  for (const m of ms) (byEd.get(m.edition) ?? byEd.set(m.edition, []).get(m.edition)!).push(m);
  const eds = Array.from(byEd.entries()).map(([id, list]) => ({
    id, done: list.filter(played).length, total: list.length,
    first: Math.min(...list.map((m) => m.date)), last: Math.max(...list.map((m) => m.date)),
  }));
  const live = eds.filter((e) => e.done > 0 && e.done < e.total).sort((a, b) => b.first - a.first)[0];
  if (live) return live.id;
  const past = eds.filter((e) => e.done === e.total && e.done > 0).sort((a, b) => b.last - a.last)[0];
  const next = eds.filter((e) => e.done === 0).sort((a, b) => a.first - b.first)[0];
  return (past ?? next)?.id ?? null;
}

/** Every competition the world has (friendlies left out), in picker order. */
export function intlCompetitions(career: CareerState): CompKind[] {
  const have = new Set(worldOf(career).matches.map((m) => m.comp));
  return ORDER.filter((c) => have.has(c));
}

/** One competition, its current edition. Null when it has no matches at all. */
export function intlCompView(career: CareerState, comp: CompKind): IntlCompView | null {
  const w = worldOf(career);
  const ed = currentEdition(w.matches.filter((m) => m.comp === comp));
  if (!ed) return null;
  const ms = w.edition(ed).slice().sort((a, b) => a.date - b.date);
  const years = Array.from(new Set(ms.map((m) => new Date(m.date).getUTCFullYear()))).sort();
  const title = `${comp} ${years.length > 1 ? `${years[0]}-${String(years[years.length - 1]).slice(2)}` : years[0]}`;

  // The groups, each as a table (the same tie rules the nation page uses).
  const tie = comp === "World Cup" || comp === "Copa América" || comp.startsWith("Gold") || comp === "CONCACAF Nations League" ? "overall" : "h2h";
  const groupNames = Array.from(new Set(ms.filter((m) => m.group).map((m) => m.group!)));
  const groups: GroupView[] = groupNames.map((g) => {
    const gm = ms.filter((m) => m.group === g);
    const teams = Array.from(new Set(gm.flatMap((m) => [m.home, m.away])));
    return {
      title: `Group ${g}`,
      rows: table(teams, gm, tie, w.rankOf).map((r) => ({ name: r.name, p: r.p, w: r.w, d: r.d, l: r.l, gd: r.gf - r.ga, pts: r.pts })),
    };
  });

  // Rounds: a group matchday is every group's games that day ("Matchday 2");
  // a knockout round is its stage ("Quarter-Final · Leg 1").
  const roundOf = (m: WorldMatch) => (m.group ? m.stage.split(" · ").slice(1).join(" · ") || m.stage : m.stage);
  const order: string[] = [];
  const byRound = new Map<string, WorldMatch[]>();
  for (const m of ms) {
    const r = roundOf(m);
    if (!byRound.has(r)) { byRound.set(r, []); order.push(r); }
    byRound.get(r)!.push(m);
  }
  const rounds: IntlRound[] = order.map((name) => {
    const list = byRound.get(name)!;
    return { name, matches: list.map(view), played: list.every(played) };
  });
  let openAt = 0;
  rounds.forEach((r, i) => { if (r.matches.some((m) => m.hs !== undefined)) openAt = i; });

  const history = w.finals.filter((f) => f.comp === comp).map((f) => {
    const winHome = f.home === f.winner;
    return {
      year: f.year, winner: f.winner, runnerUp: f.runnerUp,
      score: `${winHome ? f.hs : f.as}-${winHome ? f.as : f.hs}${f.et ? " aet" : ""}${f.pens ? ` (${Math.max(f.pens.hs, f.pens.as)}-${Math.min(f.pens.hs, f.pens.as)} pens)` : ""}`,
    };
  }).reverse();

  const nation = intlOf(career).nation;
  return { comp, title, groups, rounds, openAt, history, yours: ms.some((m) => m.home === nation || m.away === nation) };
}

/** The whole FIFA ranking now, with points. */
export function fullRanking(career: CareerState): { name: string; points: number }[] {
  const w = worldOf(career);
  return w.ranking().map((name) => ({ name, points: Math.round(w.points.get(name) ?? 0) }));
}
