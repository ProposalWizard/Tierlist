/**
 * THE COMPETITION ENGINE — one set of rules every international competition
 * is built from: round-robin fixtures, group tables and their tie-breakers,
 * ranking third-placed teams across groups, single and two-legged knockout
 * ties, and seeded pot draws with "not from the same confederation" style
 * rules.
 *
 * Everything is deterministic: a match's result comes from a seed made from
 * the match's id, so the whole international world can be replayed from the
 * save's small record (the strengths it was played at, and your own results)
 * instead of storing every one of thousands of results. See world.ts.
 *
 * Pure: no React, no storage.
 */
import { mulberry32 } from "../season";
import { clubNameSeed } from "../squadData";

export type Rng = () => number;

export function rngFor(id: string): Rng {
  return mulberry32(clubNameSeed(id));
}

// ── Scores ──────────────────────────────────────────────────────────────────

function poisson(lambda: number, rng: Rng): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L && k < 20);
  return k - 1;
}

/**
 * Goals a side expects, from the two strengths (the 40-92 scale). Linear in
 * the gap, the same shape the league simulation uses (a ratio compressed big
 * gaps): equal sides on neutral ground expect 1.25 each; each point of gap
 * moves it 0.05; at home +0.2 for you and −0.15 for them.
 */
export function expectedGoals(us: number, them: number, venue: "home" | "away" | "neutral"): number {
  const adv = venue === "home" ? 0.2 : venue === "away" ? -0.15 : 0;
  return Math.max(0.15, Math.min(4.6, 1.25 + (us - them) * 0.05 + adv));
}

export interface Score { hs: number; as: number }

export function ninety(homeStr: number, awayStr: number, neutral: boolean, rng: Rng): Score {
  return {
    hs: poisson(expectedGoals(homeStr, awayStr, neutral ? "neutral" : "home"), rng),
    as: poisson(expectedGoals(awayStr, homeStr, neutral ? "neutral" : "away"), rng),
  };
}

/** Thirty minutes: a third of the rate. */
export function extraTime(homeStr: number, awayStr: number, neutral: boolean, rng: Rng): Score {
  return {
    hs: poisson(expectedGoals(homeStr, awayStr, neutral ? "neutral" : "home") / 3, rng),
    as: poisson(expectedGoals(awayStr, homeStr, neutral ? "neutral" : "away") / 3, rng),
  };
}

/** A shoot-out: five each, then sudden death. The better side scores a shade more. */
export function shootout(homeStr: number, awayStr: number, rng: Rng): Score {
  const ph = Math.max(0.6, Math.min(0.85, 0.75 + (homeStr - awayStr) * 0.002));
  const pa = Math.max(0.6, Math.min(0.85, 0.75 + (awayStr - homeStr) * 0.002));
  let h = 0, a = 0;
  for (let i = 0; i < 5; i++) {
    if (rng() < ph) h++;
    if (rng() < pa) a++;
    if (h > a + (5 - i - 1) || a > h + (5 - i - 1)) break;
  }
  for (let sd = 0; h === a && sd < 30; sd++) {
    if (rng() < ph) h++;
    if (rng() < pa) a++;
  }
  if (h === a) h++;
  return { hs: h, as: a };
}

// ── Matches ─────────────────────────────────────────────────────────────────

export interface Match {
  id: string;
  home: string;
  away: string;
  /** Played on neutral ground (tournaments, one-venue play-offs). */
  neutral?: boolean;
  hs?: number;
  as?: number;
  /** Extra time was played. */
  et?: boolean;
  pens?: Score;
}

export function played(m: Match): boolean {
  return m.hs !== undefined && m.as !== undefined;
}

// ── Round robin ─────────────────────────────────────────────────────────────

/**
 * Every team plays every other once (circle method), as matchdays. With an
 * odd number one team rests each matchday. Homes alternate so nobody plays
 * too many in a row at home.
 */
export function singleRoundRobin(teams: string[]): [string, string][][] {
  const t = teams.length % 2 ? [...teams, ""] : [...teams];
  const n = t.length;
  const days: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const day: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (!a || !b) continue;
      day.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    days.push(day);
    t.splice(1, 0, t.pop()!);
  }
  return days;
}

/** Home and away: the single round robin, then again with homes swapped. */
export function doubleRoundRobin(teams: string[]): [string, string][][] {
  const first = singleRoundRobin(teams);
  return [...first, ...first.map((d) => d.map(([h, a]) => [a, h] as [string, string]))];
}

// ── Tables ──────────────────────────────────────────────────────────────────

export interface Row {
  name: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
}

/**
 * How ties on points are broken.
 *  - "h2h": head-to-head first (points, then goal difference, then goals,
 *    among the tied teams only), then overall goal difference and goals.
 *    UEFA, CAF, AFC.
 *  - "overall": overall goal difference and goals first, then head-to-head.
 *    FIFA World Cup, CONMEBOL, CONCACAF.
 * Then FIFA ranking (lower rank is better), which stands in for fair play
 * and drawing of lots.
 */
export type TieBreak = "h2h" | "overall";

function emptyRow(name: string): Row {
  return { name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
}

function addResult(rows: Map<string, Row>, m: Match) {
  if (!played(m)) return;
  const h = rows.get(m.home), a = rows.get(m.away);
  if (!h || !a) return;
  h.p++; a.p++; h.gf += m.hs!; h.ga += m.as!; a.gf += m.as!; a.ga += m.hs!;
  if (m.hs! > m.as!) { h.w++; a.l++; h.pts += 3; }
  else if (m.hs! < m.as!) { a.w++; h.l++; a.pts += 3; }
  else { h.d++; a.d++; h.pts++; a.pts++; }
}

export function table(teams: string[], matches: Match[], tie: TieBreak, rank: (n: string) => number): Row[] {
  const rows = new Map(teams.map((t) => [t, emptyRow(t)]));
  for (const m of matches) addResult(rows, m);
  const all = Array.from(rows.values());
  const overall = (x: Row, y: Row) => (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf;
  const h2hOrder = (group: Row[]): Row[] => {
    const names = new Set(group.map((r) => r.name));
    const mini = new Map(group.map((r) => [r.name, emptyRow(r.name)]));
    for (const m of matches) if (names.has(m.home) && names.has(m.away)) addResult(mini, m);
    return [...group].sort((x, y) => {
      const a = mini.get(x.name)!, b = mini.get(y.name)!;
      return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
        || overall(x, y) || rank(x.name) - rank(y.name) || x.name.localeCompare(y.name);
    });
  };
  const byPts = [...all].sort((x, y) => y.pts - x.pts);
  const out: Row[] = [];
  for (let i = 0; i < byPts.length;) {
    let j = i;
    while (j < byPts.length && byPts[j].pts === byPts[i].pts) j++;
    const group = byPts.slice(i, j);
    if (group.length === 1) out.push(group[0]);
    else if (tie === "h2h") out.push(...h2hOrder(group));
    else {
      // Overall goal difference and goals; any still level, head-to-head.
      const sorted = [...group].sort(overall);
      for (let a = 0; a < sorted.length;) {
        let b = a;
        while (b < sorted.length && overall(sorted[a], sorted[b]) === 0) b++;
        out.push(...(b - a > 1 ? h2hOrder(sorted.slice(a, b)) : sorted.slice(a, b)));
        a = b;
      }
    }
    i = j;
  }
  return out;
}

/**
 * Rank rows from different groups (the best third-placed teams). They never
 * met, so only points, goal difference, goals, then FIFA ranking. With
 * groups of different sizes, results against a group's last team are not
 * dropped here (every group in these competitions is the same size).
 */
export function rankAcrossGroups(rows: Row[], rank: (n: string) => number): Row[] {
  return [...rows].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf
    || rank(x.name) - rank(y.name));
}

// ── Knockout ties ───────────────────────────────────────────────────────────

/** What happens when a one-off knockout match is level after 90 minutes. */
export type LevelRule = "et-pens" | "pens";

export function winnerOf(m: Match): string | null {
  if (!played(m)) return null;
  if (m.hs! > m.as!) return m.home;
  if (m.as! > m.hs!) return m.away;
  if (m.pens) return m.pens.hs > m.pens.as ? m.home : m.away;
  return null;
}

export function loserOf(m: Match): string | null {
  const w = winnerOf(m);
  return w ? (w === m.home ? m.away : m.home) : null;
}

/** Play a one-off knockout match to a winner (unless it already has a result). */
export function playKnockout(m: Match, str: (n: string) => number, rule: LevelRule, rng: Rng): Match {
  if (played(m) && winnerOf(m)) return m;
  const hS = str(m.home), aS = str(m.away);
  const base = played(m) ? { hs: m.hs!, as: m.as! } : ninety(hS, aS, !!m.neutral, rng);
  const out: Match = { ...m, ...base };
  if (out.hs === out.as) {
    if (rule === "et-pens") {
      const e = extraTime(hS, aS, !!m.neutral, rng);
      out.et = true;
      out.hs! += e.hs; out.as! += e.as;
    }
    if (out.hs === out.as) out.pens = shootout(hS, aS, rng);
  }
  return out;
}

export interface TwoLegs { first: Match; second: Match }

/**
 * Who wins a two-legged tie: more goals over both legs; level, the second
 * leg had extra time and then penalties (no away-goals rule anywhere in
 * these competitions now).
 */
export function twoLegWinner(t: TwoLegs): string | null {
  if (!played(t.first) || !played(t.second)) return null;
  // second leg's home team is the first leg's away team
  const a = t.first.home, b = t.first.away;
  const ga = t.first.hs! + t.second.as!, gb = t.first.as! + t.second.hs!;
  if (ga > gb) return a;
  if (gb > ga) return b;
  if (t.second.pens) return t.second.pens.hs > t.second.pens.as ? t.second.home : t.second.away;
  return null;
}

/** Play whatever is unplayed of a two-legged tie. */
export function playTwoLegs(t: TwoLegs, str: (n: string) => number, rng: Rng): TwoLegs {
  const first = played(t.first) ? t.first : { ...t.first, ...ninety(str(t.first.home), str(t.first.away), false, rng) };
  let second: Match = played(t.second) ? t.second : { ...t.second, ...ninety(str(t.second.home), str(t.second.away), false, rng) };
  const a = first.home;
  const agg = () => [first.hs! + second.as!, first.as! + second.hs!];
  let [ga, gb] = agg();
  if (ga === gb && !second.pens) {
    if (!second.et) {
      const e = extraTime(str(second.home), str(second.away), false, rng);
      second = { ...second, et: true, hs: second.hs! + e.hs, as: second.as! + e.as };
      [ga, gb] = agg();
    }
    if (ga === gb) second = { ...second, pens: shootout(str(second.home), str(second.away), rng) };
  }
  void a;
  return { first, second };
}

// ── Draws ───────────────────────────────────────────────────────────────────

export function shuffled<T>(xs: T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Split teams, already in seeding order, into pots of `size`.
 */
export function pots(seeded: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < seeded.length; i += size) out.push(seeded.slice(i, i + size));
  return out;
}

/**
 * The classic group draw: one team from each pot into each group, in pot
 * order, with a rule saying whether a team may join a group (e.g. at most one
 * nation per confederation, two for UEFA). Backtracks when a draw would
 * leave a later team with nowhere legal to go — what the real draws do with
 * their "computer assistance". `fixed` places some teams before the draw
 * (hosts in group A, say). `sizes` lets groups differ (groups of 4 and 5).
 */
export function drawGroups(
  potList: string[][],
  groupCount: number,
  rng: Rng,
  allowed: (team: string, group: string[]) => boolean = () => true,
  fixed: Record<number, string[]> = {},
  sizes?: number[],
): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, (_, i) => [...(fixed[i] ?? [])]);
  const cap = (g: number) => sizes?.[g] ?? potList.length;
  const order = potList.flatMap((p) => shuffled(p, rng));
  const place = (k: number): boolean => {
    if (k >= order.length) return true;
    const team = order[k];
    const potIndex = potList.findIndex((p) => p.includes(team));
    // Groups this pot hasn't filled yet, from A onwards, so pots fill in order.
    for (let g = 0; g < groupCount; g++) {
      const grp = groups[g];
      if (grp.length >= cap(g)) continue;
      const fromSamePot = grp.filter((t) => potList[potIndex]?.includes(t)).length;
      if (fromSamePot >= 1) continue;
      if (!allowed(team, grp)) continue;
      grp.push(team);
      if (place(k + 1)) return true;
      grp.pop();
    }
    return false;
  };
  if (!place(0)) {
    // No legal draw exists: fall back to plain pot order (never seen with the
    // real rules; kept so a strange field can never crash a season).
    const gs: string[][] = Array.from({ length: groupCount }, (_, i) => [...(fixed[i] ?? [])]);
    order.forEach((t, i) => gs[i % groupCount].push(t));
    return gs;
  }
  return groups;
}
