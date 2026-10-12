/**
 * BUILDING BLOCKS every competition is made of, on the World: group stages,
 * one-off and two-legged knockout ties, brackets that create their next round
 * once the last one is played, and whole tournaments (groups then knockout).
 *
 * Everything is added to the World as matches with dates, and as events that
 * run the day after a stage ends (that is when the next stage is known).
 */
import {
  type LevelRule, type TieBreak, type Row, table, rankAcrossGroups, singleRoundRobin,
  doubleRoundRobin, winnerOf, loserOf, twoLegWinner, played,
} from "./engine";
import { type World, type WorldMatch, type CompKind, noon, dayAfter } from "./world";
import { windowFor, type WindowKind } from "./windows";

const DAY = 86_400_000;

/** Noon on matchday `i` (0-based) of a FIFA window; null when no such window. */
export function matchday(year: number, kind: WindowKind, i: number): number | null {
  const w = windowFor(year, kind);
  if (!w || i >= w.matchdays.length) return null;
  return noon(w.matchdays[i]);
}

/** All matchday dates of these windows, in order. */
export function matchdays(windows: [number, WindowKind][]): number[] {
  const out: number[] = [];
  for (const [y, k] of windows) {
    const w = windowFor(y, k);
    if (w) out.push(...w.matchdays.map((d) => noon(d)));
  }
  return out;
}

export const utcNoon = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 12);
export const plusDays = (t: number, n: number) => t + n * DAY;

// ── Group stages ────────────────────────────────────────────────────────────

export interface GroupStageSpec {
  edition: string;
  comp: CompKind;
  importance: number;
  /** Group name → teams (in pot order: first is the top seed). */
  groups: Record<string, string[]>;
  /** One date per round. */
  dates: number[];
  rounds: "single" | "double";
  /** Only the first N rounds (a "Swiss" stage where nobody plays everyone). */
  maxRounds?: number;
  /** "Group", "League A Group" … shown before the group name. */
  label?: string;
  neutral?: boolean;
  hosts?: string[];
  /** Own fixture list per group (each inner array is one round). */
  schedule?: (teams: string[], group: string) => [string, string][][];
}

export function groupStage(w: World, s: GroupStageSpec): void {
  for (const [g, teams] of Object.entries(s.groups)) {
    let days = s.schedule ? s.schedule(teams, g) : s.rounds === "double" ? doubleRoundRobin(teams) : singleRoundRobin(teams);
    if (s.maxRounds) days = days.slice(0, s.maxRounds);
    if (days.length > s.dates.length) {
      throw new Error(`${s.edition} group ${g}: ${days.length} rounds, ${s.dates.length} dates`);
    }
    days.forEach((day, r) => {
      for (let [h, a] of day) {
        const hostIn = s.hosts?.includes(h) || s.hosts?.includes(a);
        if (s.neutral && s.hosts?.includes(a) && !s.hosts.includes(h)) [h, a] = [a, h];
        w.add({
          id: `${s.edition}|${g}|${r + 1}|${h}-${a}`,
          home: h, away: a, date: s.dates[r], comp: s.comp, edition: s.edition,
          stage: `${s.label ?? "Group"} ${g} · Matchday ${r + 1}`,
          importance: s.importance, group: g,
          ...(s.neutral ? { neutral: true } : {}),
          ...(s.neutral && hostIn ? { hostHome: true } : {}),
        });
      }
    });
  }
}

/** The table of one group, as it stands. */
export function groupTable(w: World, edition: string, group: string, teams: string[], tie: TieBreak): Row[] {
  const ms = w.edition(edition).filter((m) => m.group === group);
  return table(teams, ms, tie, w.rankOf);
}

/** Every group's final table, by group name. */
export function groupTables(w: World, edition: string, groups: Record<string, string[]>, tie: TieBreak): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  for (const [g, teams] of Object.entries(groups)) out[g] = groupTable(w, edition, g, teams, tie);
  return out;
}

/** The teams in position `pos` (0-based) of every group, ranked across groups. */
export function placed(w: World, tables: Record<string, Row[]>, pos: number): Row[] {
  const rows = Object.values(tables).map((t) => t[pos]).filter((r): r is Row => !!r);
  return rankAcrossGroups(rows, w.rankOf);
}

/**
 * Rank rows across groups of different sizes fairly: drop each team's results
 * against the bottom team of a bigger group (FIFA/UEFA's rule when groups
 * differ), then points, goal difference, goals, ranking.
 */
export function placedFair(w: World, edition: string, tables: Record<string, Row[]>, pos: number): Row[] {
  const sizes = Object.values(tables).map((t) => t.length);
  const min = Math.min(...sizes);
  const rows: Row[] = [];
  for (const [g, t] of Object.entries(tables)) {
    const r = t[pos];
    if (!r) continue;
    if (t.length === min) { rows.push(r); continue; }
    const drop = new Set(t.slice(min).map((x) => x.name));
    const ms = w.edition(edition).filter((m) => m.group === g && !drop.has(m.home) && !drop.has(m.away));
    const kept = t.filter((x) => !drop.has(x.name)).map((x) => x.name);
    const mine = table(kept, ms, "overall", w.rankOf).find((x) => x.name === r.name);
    rows.push(mine ?? r);
  }
  return rankAcrossGroups(rows, w.rankOf);
}

// ── Knockout ties ───────────────────────────────────────────────────────────

export interface TieSpec {
  edition: string;
  comp: CompKind;
  importance: number;
  stage: string;
  level?: LevelRule;
  neutral?: boolean;
  finalsKnockout?: boolean;
  hosts?: string[];
}

export function single(w: World, s: TieSpec, home: string, away: string, date: number, key: string): WorldMatch {
  if (s.neutral && s.hosts?.includes(away) && !s.hosts.includes(home)) [home, away] = [away, home];
  const hostIn = !!(s.hosts?.includes(home) || s.hosts?.includes(away));
  return w.add({
    id: `${s.edition}|${key}|${home}-${away}`,
    home, away, date, comp: s.comp, edition: s.edition, stage: s.stage,
    importance: s.importance, level: s.level ?? "et-pens",
    ...(s.neutral ? { neutral: true } : {}),
    ...(s.neutral && hostIn ? { hostHome: true } : {}),
    ...(s.finalsKnockout ? { finalsKnockout: true } : {}),
  });
}

export interface Leg2 { first: WorldMatch; second: WorldMatch }

/** A two-legged tie: `a` at home first, `b` hosts the second leg. */
export function twoLegs(w: World, s: TieSpec, a: string, b: string, dates: [number, number], key: string): Leg2 {
  const first = w.add({
    id: `${s.edition}|${key}|L1|${a}-${b}`, home: a, away: b, date: dates[0], comp: s.comp,
    edition: s.edition, stage: `${s.stage} · Leg 1`, importance: s.importance,
  });
  const second = w.add({
    id: `${s.edition}|${key}|L2|${b}-${a}`, home: b, away: a, date: dates[1], comp: s.comp,
    edition: s.edition, stage: `${s.stage} · Leg 2`, importance: s.importance, firstLeg: first.id,
  });
  return { first, second };
}

export function legsWinner(t: Leg2): string | null {
  return twoLegWinner(t);
}

export function legsLoser(t: Leg2): string | null {
  const win = twoLegWinner(t);
  return win ? (win === t.first.home ? t.first.away : t.first.home) : null;
}

// ── Brackets ────────────────────────────────────────────────────────────────

export interface BracketSpec {
  edition: string;
  comp: CompKind;
  /** Round names, first round to final ("Quarter-Final", "Semi-Final", "Final"). */
  names: string[];
  /** One date per round; a two-legged round takes [leg1, leg2]. */
  dates: (number | [number, number])[];
  importance: (round: number) => number;
  level?: LevelRule;
  /** The final alone goes to extra time (Copa América: other rounds go straight to penalties). */
  finalLevel?: LevelRule;
  neutral?: boolean;
  finalsKnockout?: boolean;
  hosts?: string[];
  /** A third-place match on the final's date. */
  thirdPlace?: boolean;
  /** Archive the final in the World's "Who won" list (default true). */
  archive?: boolean;
}

export interface BracketResult {
  winner: string;
  runnerUp: string;
  /** Losers by round (first round first). */
  losers: string[][];
  third?: string;
  final: WorldMatch;
}

/**
 * A knockout bracket: entrants pair off in order (0 v 1, 2 v 3 …), winners
 * meet in the same order. The first round is added now; each later round is
 * added the day after the round before ends.
 */
export function bracket(w: World, s: BracketSpec, entrants: string[], onDone?: (r: BracketResult) => void): void {
  const losers: string[][] = [];
  const play = (round: number, teams: string[]) => {
    const last = round === s.names.length - 1;
    const date = s.dates[round];
    const tie: TieSpec = {
      edition: s.edition, comp: s.comp, importance: s.importance(round), stage: s.names[round],
      level: last && s.finalLevel ? s.finalLevel : s.level, neutral: s.neutral,
      finalsKnockout: s.finalsKnockout, hosts: s.hosts,
    };
    const ties: (WorldMatch | Leg2)[] = [];
    for (let i = 0; i + 1 < teams.length; i += 2) {
      const key = `${s.names[round]}-${i / 2 + 1}`;
      ties.push(Array.isArray(date)
        ? twoLegs(w, tie, teams[i], teams[i + 1], date, key)
        : single(w, tie, teams[i], teams[i + 1], date, key));
    }
    const endDate = Array.isArray(date) ? date[1] : date;
    w.at(dayAfter(endDate), () => {
      const win = ties.map((t) => ("first" in t ? legsWinner(t) : winnerOf(t)));
      const lose = ties.map((t) => ("first" in t ? legsLoser(t) : loserOf(t)));
      if (win.some((x) => !x)) return; // cannot happen once every match is played
      losers.push(lose as string[]);
      if (last) {
        const fin = ties[0];
        const final = "first" in fin ? fin.second : fin;
        if (s.archive !== false) w.final(s.edition, s.comp, final);
        const out: BracketResult = { winner: win[0]!, runnerUp: lose[0]!, losers, final };
        if (third) {
          w.at(dayAfter(endDate) + 1, () => {
            out.third = winnerOf(third!) ?? undefined;
            onDone?.(out);
          });
        } else onDone?.(out);
        return;
      }
      // Semi-finals → third-place match on the final's date.
      if (s.thirdPlace && round === s.names.length - 2) {
        const fd = s.dates[round + 1];
        third = single(w, { ...tie, stage: "Third Place", importance: s.importance(round + 1) },
          lose[0]!, lose[1]!, Array.isArray(fd) ? fd[1] : fd, "Third");
      }
      play(round + 1, win as string[]);
    });
  };
  let third: WorldMatch | null = null;
  play(0, entrants);
}

// ── Tournaments ─────────────────────────────────────────────────────────────

/**
 * Pair the group-stage qualifiers for the first knockout round.
 * Winners play the best third-placed teams first (from other groups), then
 * runners-up; the runners-up left play each other. Pairs are laid into the
 * bracket so the group winners are spread across it (a simplification of the
 * fixed tables FIFA and UEFA publish; flagged in the plan).
 */
export function pairQualifiers(w: World, tables: Record<string, Row[]>, thirds: number): string[] {
  const groups = Object.keys(tables);
  const W = groups.map((g) => tables[g][0].name);
  const R = groups.map((g) => tables[g][1].name);
  const groupOf = new Map<string, string>();
  for (const g of groups) for (const r of tables[g]) groupOf.set(r.name, g);
  const T = placed(w, tables, 2).slice(0, thirds).map((r) => r.name);
  const pairs: [string, string][] = [];
  if (thirds === 0) {
    // A1 v B2, B1 v A2, C1 v D2 …
    for (let i = 0; i < W.length; i++) pairs.push([W[i], R[i ^ 1] ?? R[i]]);
  } else {
    // Winners of the first `thirds` groups take a third from another group.
    const wT = W.slice(0, thirds);
    const assign: string[] = [];
    const used = new Set<string>();
    const fit = (k: number): boolean => {
      if (k === wT.length) return true;
      for (const t of T) {
        if (used.has(t) || groupOf.get(t) === groupOf.get(wT[k])) continue;
        used.add(t); assign[k] = t;
        if (fit(k + 1)) return true;
        used.delete(t);
      }
      return false;
    };
    if (!fit(0)) T.forEach((t, k) => (assign[k] = t));
    wT.forEach((x, k) => pairs.push([x, assign[k]]));
    // Remaining winners take a runner-up from another group.
    const rLeft = [...R];
    for (const x of W.slice(thirds)) {
      const k = rLeft.findIndex((r) => groupOf.get(r) !== groupOf.get(x));
      pairs.push([x, rLeft.splice(k >= 0 ? k : 0, 1)[0]]);
    }
    // Runners-up left play each other.
    while (rLeft.length > 1) {
      const a = rLeft.shift()!;
      const k = rLeft.findIndex((r) => groupOf.get(r) !== groupOf.get(a));
      pairs.push([a, rLeft.splice(k >= 0 ? k : 0, 1)[0]]);
    }
  }
  // Spread: pair i goes to bracket slot bitReverse(i).
  const n = pairs.length;
  const bits = Math.round(Math.log2(n));
  const slots: [string, string][] = new Array(n);
  pairs.forEach((p, i) => {
    let r = 0;
    for (let b = 0; b < bits; b++) if (i & (1 << b)) r |= 1 << (bits - 1 - b);
    slots[r] = p;
  });
  return slots.flat();
}

export interface TournamentSpec {
  edition: string;
  comp: CompKind;
  groups: Record<string, string[]>;
  /** Three group matchdays. */
  groupDates: number[];
  /** Knockout rounds after the groups. */
  names: string[];
  koDates: number[];
  groupImportance: number;
  koImportance: (round: number) => number;
  tie: TieBreak;
  thirds: number;
  hosts: string[];
  level?: LevelRule;
  finalLevel?: LevelRule;
  thirdPlace?: boolean;
}

export function tournament(w: World, s: TournamentSpec, onDone?: (r: BracketResult) => void): void {
  groupStage(w, {
    edition: s.edition, comp: s.comp, importance: s.groupImportance, groups: s.groups,
    dates: s.groupDates, rounds: "single", neutral: true, hosts: s.hosts,
  });
  w.facts.set(`${s.edition}:groups`, s.groups);
  w.at(dayAfter(s.groupDates[s.groupDates.length - 1]), () => {
    const tables = groupTables(w, s.edition, s.groups, s.tie);
    w.facts.set(`${s.edition}:tables`, tables);
    bracket(w, {
      edition: s.edition, comp: s.comp, names: s.names, dates: s.koDates, importance: s.koImportance,
      level: s.level ?? "et-pens", finalLevel: s.finalLevel, neutral: true, finalsKnockout: true,
      hosts: s.hosts, thirdPlace: s.thirdPlace,
    }, pairQualifiers(w, tables, s.thirds), (r) => {
      w.facts.set(`${s.edition}:result`, r);
      onDone?.(r);
    });
  });
}

/** Has every match of this edition so far been played? */
export function allPlayed(ms: WorldMatch[]): boolean {
  return ms.every(played);
}
