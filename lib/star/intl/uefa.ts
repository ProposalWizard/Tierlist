/**
 * UEFA — the Nations League, Euro qualifying and the Euro, World Cup
 * qualifying and its play-offs.
 *
 * The two-year rhythm (real since 2018, unchanged in the 2026-2028 plans):
 *   autumn of an even year   Nations League league phase (6 matchdays)
 *   March of the odd year    Nations League quarter-finals and the
 *                            promotion/relegation play-offs
 *   June of the odd year     Nations League Finals; qualifying groups of 5 go on
 *   Mar–Nov of the odd year  qualifying groups (Euro or World Cup)
 *   March of the next year   qualifying play-offs
 *   June of the next year    the Euro or the World Cup
 *
 * NATIONS LEAGUE 2026–27 (UEFA regulations and draw, read 12 Oct 2026):
 *   Leagues A, B, C of 16 (groups of 4) and D of 6 (groups of 3), home and away.
 *   A: winners and runners-up → quarter-finals (two legs, March 2027, a winner
 *      against a runner-up from another group, the winner at home second);
 *      the two worst fourths go down; the two worst thirds and the two best
 *      fourths play the B runners-up (A/B play-offs, two legs).
 *   B: winners up; fourths play the C runners-up (B/C play-offs).
 *   C: winners up. D: all six move up (the 2028–29 edition has no League D).
 *   Finals (June 2027): semi-finals, third place, final.
 * NATIONS LEAGUE 2028–29 ON: three leagues of 18, three groups of 6 each
 *   (UEFA, approved). Details not published: each group plays once (five
 *   matchdays fit the autumn), A winners, runners-up and the two best thirds
 *   reach the quarter-finals, sixths go down, fifths play the runners-up below.
 *
 * QUALIFYING (Euro 2028 regulations, read 12 Oct 2026): 12 groups (6 of 4,
 *   6 of 5). The 24 teams busy in March (Nations League quarter-finals and
 *   play-offs) are drawn into the groups of 4, which start in September.
 *   Euro: 12 winners + 8 best runners-up qualify; up to two places are kept
 *   for hosts who miss out; the rest go through play-offs (paths of four).
 *   World Cup (2026 format, kept until UEFA confirms the new tiered one —
 *   Mikey: "switch to the new rules once they are confirmed"): 12 winners;
 *   the rest of Europe's places (16 minus hosts) through play-off paths from
 *   the runners-up and the best Nations League group winners.
 */
import { type Row, rngFor, shuffled, pots, drawGroups } from "./engine";
import { type World, dayAfter, noon } from "./world";
import { nationsIn } from "./nations";
import {
  matchdays, matchday, groupStage, groupTables, placedFair, twoLegs, legsWinner, legsLoser,
  bracket, tournament, utcNoon, plusDays,
} from "./build";
import { UNL_2026, realList } from "./realData";
import { euroHosts, worldCupHosts } from "./hosts";

const DAY = 86_400_000;
const letters = "ABCDEFGHIJKL";

export function uefaNations(): string[] {
  return nationsIn("UEFA").map((n) => n.name);
}

// ── Nations League ──────────────────────────────────────────────────────────

export interface NlOutcome {
  /** Next edition's leagues. */
  next: Record<string, string[]>;
  /** Every team in order: league, then group position, then points … */
  ranking: string[];
  /** League A–D group winners. */
  groupWinners: string[];
  /** Teams busy in the March after the league phase. */
  marchBusy: string[];
}

export function nationsLeague(w: World, year: number): void {
  const ed = `NL-${year}`;
  const autumn = year === 2026
    ? matchdays([[year, "sepoct"], [year, "nov"]])
    : matchdays([[year, "sepoct"], [year, "nov"]]).slice(0, 5);
  const mar = [matchday(year + 1, "mar", 0)!, matchday(year + 1, "mar", 1)!] as [number, number];
  const jun = [matchday(year + 1, "jun", 0)!, matchday(year + 1, "jun", 1)!];
  const groupsByLeague: Record<string, Record<string, string[]>> = {};

  const start = () => {
    let leagues: Record<string, string[]>;
    if (year === 2026) {
      for (const [g, teams] of Object.entries(UNL_2026)) {
        const L = g[0];
        (groupsByLeague[L] ??= {})[g] = realList(teams);
      }
    } else {
      leagues = (w.facts.get(`NL-${year - 2}:outcome`) as NlOutcome | undefined)?.next
        ?? defaultLeagues(w);
      const rng = rngFor(`draw|${ed}`);
      for (const [L, teams] of Object.entries(leagues)) {
        const seeded = [...teams].sort((a, b) => w.rankOf(a) - w.rankOf(b));
        const gs = drawGroups(pots(seeded, 3), 3, rng);
        groupsByLeague[L] = Object.fromEntries(gs.map((g, i) => [`${L}${i + 1}`, g]));
      }
    }
    w.facts.set(`${ed}:groups`, groupsByLeague);
    for (const [L, groups] of Object.entries(groupsByLeague)) {
      groupStage(w, {
        edition: ed, comp: "Nations League", importance: 15, groups, dates: autumn,
        rounds: year === 2026 ? "double" : "single", label: `League ${L} · Group`,
      });
    }
  };
  w.at(noon(Date.UTC(year, 7, 20)), start);

  w.at(dayAfter(autumn[autumn.length - 1]), () => {
    const T: Record<string, Record<string, Row[]>> = {};
    for (const [L, groups] of Object.entries(groupsByLeague)) T[L] = groupTables(w, ed, groups, "h2h");
    w.facts.set(`${ed}:tables`, T);
    const rng = rngFor(`after|${ed}`);
    const leagues = Object.keys(T).sort();
    const pos = (L: string, p: number) => placedFair(w, ed, T[L], p).map((r) => r.name);

    // Overall ranking: league by league, position by position.
    const ranking: string[] = [];
    for (const L of leagues) {
      const size = Math.max(...Object.values(T[L]).map((t) => t.length));
      for (let p = 0; p < size; p++) ranking.push(...pos(L, p));
    }
    const groupWinners = leagues.flatMap((L) => pos(L, 0));

    const next: Record<string, string[]> = {};
    const move = (team: string, to: string) => { (next[to] ??= []).push(team); };
    const busy: string[] = [];
    const tie = (stage: string) => ({ edition: ed, comp: "Nations League" as const, importance: 25, stage });
    const pendingPlayoffs: { upper: string; lower: string; legs: ReturnType<typeof twoLegs> }[] = [];
    // `upper` hosts the second leg; the winner plays in `upper`'s league next time.
    const playoff = (upperTeam: string, lowerTeam: string, upperL: string, lowerL: string, key: string) => {
      const legs = twoLegs(w, tie(`League ${upperL}/${lowerL} Play-Off`), lowerTeam, upperTeam, mar, key);
      pendingPlayoffs.push({ upper: upperL, lower: lowerL, legs });
      busy.push(upperTeam, lowerTeam);
    };

    let qfTeams: string[];
    if (year === 2026) {
      // A
      const winA = pos("A", 0), ruA = pos("A", 1), thA = pos("A", 2), foA = pos("A", 3);
      qfTeams = [...winA, ...ruA];
      for (const t of qfTeams) move(t, "A");
      for (const t of thA.slice(0, 2)) move(t, "A");
      for (const t of foA.slice(2)) move(t, "B");
      const abUpper = [...thA.slice(2), ...foA.slice(0, 2)];
      const ruB = shuffled(pos("B", 1), rng);
      abUpper.forEach((u, i) => playoff(u, ruB[i], "A", "B", `AB-${i + 1}`));
      for (const t of pos("B", 0)) move(t, "A");
      for (const t of pos("B", 2)) move(t, "B");
      const foB = pos("B", 3), ruC = shuffled(pos("C", 1), rng);
      foB.forEach((u, i) => playoff(u, ruC[i], "B", "C", `BC-${i + 1}`));
      for (const t of pos("C", 0)) move(t, "B");
      for (const t of [...pos("C", 2), ...pos("C", 3), ...pos("D", 0), ...pos("D", 1), ...pos("D", 2)]) move(t, "C");
    } else {
      const w1 = pos("A", 0), r1 = pos("A", 1), t1 = pos("A", 2);
      qfTeams = [...w1, ...r1, ...t1.slice(0, 2)];
      for (const L of ["A", "B", "C"]) {
        const up = L === "A" ? null : L === "B" ? "A" : "B";
        const down = L === "A" ? "B" : L === "B" ? "C" : null;
        const p = (k: number) => pos(L, k);
        // Winners go up (A's stay), sixths go down (C's stay).
        for (const t of p(0)) move(t, up ?? L);
        for (const t of [...p(2), ...p(3)]) move(t, L);
        for (const t of p(5)) move(t, down ?? L);
        if (L === "A") for (const t of p(1)) move(t, "A");
        if (down) {
          const lowerRu = shuffled(pos(down, 1), rng);
          p(4).forEach((u, i) => playoff(u, lowerRu[i], L, down, `${L}${down}-${i + 1}`));
        } else for (const t of p(4)) move(t, L);
        if (L === "C") for (const t of p(1)) if (!busy.includes(t)) move(t, L);
      }
    }

    // Quarter-finals: a winner against a runner-up from another group (2026);
    // from 2028 the four best seeded against the other four.
    const groupOf = new Map<string, string>();
    for (const [g, rows] of Object.entries(T.A)) for (const r of rows) groupOf.set(r.name, g);
    const seeded = qfTeams.slice(0, 4), unseeded = shuffled(qfTeams.slice(4), rng);
    const order: string[] = [];
    const used = new Set<string>();
    const fit = (k: number): boolean => {
      if (k === seeded.length) return true;
      for (const u of unseeded) {
        if (used.has(u) || groupOf.get(u) === groupOf.get(seeded[k])) continue;
        used.add(u); order[k] = u;
        if (fit(k + 1)) return true;
        used.delete(u);
      }
      return false;
    };
    if (!fit(0)) unseeded.forEach((u, k) => (order[k] = u));
    const draw = shuffled(seeded.map((s, k) => [order[k], s]), rng).flat();
    busy.push(...qfTeams);
    bracket(w, {
      edition: ed, comp: "Nations League", names: ["Quarter-Final", "Semi-Final", "Final"],
      dates: [mar, jun[0], jun[1]], importance: () => 25, level: "et-pens", neutral: true, thirdPlace: true,
    }, draw);

    w.at(dayAfter(mar[1]), () => {
      for (const p of pendingPlayoffs) {
        move(legsWinner(p.legs)!, p.upper);
        move(legsLoser(p.legs)!, p.lower);
      }
      const outcome: NlOutcome = { next, ranking, groupWinners, marchBusy: busy };
      w.facts.set(`${ed}:outcome`, outcome);
    });
    w.facts.set(`${ed}:ranking`, ranking);
    w.facts.set(`${ed}:groupWinners`, groupWinners);
    w.facts.set(`${ed}:marchBusy`, busy);
  });
}

function defaultLeagues(w: World): Record<string, string[]> {
  const all = uefaNations().sort((a, b) => w.rankOf(a) - w.rankOf(b));
  return { A: all.slice(0, 18), B: all.slice(18, 36), C: all.slice(36) };
}

// ── Qualifying groups ───────────────────────────────────────────────────────

/**
 * The 12 qualifying groups for a tournament in `tYear`, played in `tYear - 1`.
 * Teams busy in March go into the groups of 4 (which start in September).
 */
function qualifyingGroups(w: World, ed: string, comp: "Euro Qualifier" | "World Cup Qualifier", tYear: number, exclude: string[], onDone: (tables: Record<string, Row[]>, field: string[]) => void): void {
  const y = tYear - 1;
  const nlEd = `NL-${tYear - 2}`;
  w.at(noon(Date.UTC(tYear - 2, 11, 6)), () => {
    const nlRank = (w.facts.get(`${nlEd}:ranking`) as string[] | undefined) ?? [];
    const busySet = new Set((w.facts.get(`${nlEd}:marchBusy`) as string[] | undefined) ?? []);
    const field = uefaNations().filter((n) => !exclude.includes(n));
    const rankKey = (n: string) => { const i = nlRank.indexOf(n); return i < 0 ? 900 + w.rankOf(n) : i; };
    field.sort((a, b) => rankKey(a) - rankKey(b));
    const G = 12;
    const fives = Math.max(0, Math.min(G, field.length - 4 * G));
    const fours = G - fives;
    // Groups of 4 take the March-busy teams, topped up with the lowest-ranked others.
    let in4 = field.filter((n) => busySet.has(n));
    const others = field.filter((n) => !busySet.has(n));
    while (in4.length < 4 * fours && others.length) in4.push(others.pop()!);
    while (in4.length > 4 * fours) others.push(in4.pop()!);
    in4 = in4.sort((a, b) => rankKey(a) - rankKey(b));
    others.sort((a, b) => rankKey(a) - rankKey(b));
    const rng = rngFor(`draw|${ed}`);
    const g4 = fours > 0 ? drawGroups(pots(in4, fours), fours, rng) : [];
    const g5 = fives > 0 ? drawGroups(pots(others, fives), fives, rng) : [];
    const groups: Record<string, string[]> = {};
    g4.forEach((g, i) => (groups[letters[i]] = g));
    g5.forEach((g, i) => (groups[letters[fours + i]] = g));
    w.facts.set(`${ed}:groups`, groups);
    const dates5 = matchdays([[y, "mar"], [y, "jun"], [y, "sepoct"], [y, "nov"]]);
    const dates4 = matchdays([[y, "sepoct"], [y, "nov"]]);
    for (const [g, teams] of Object.entries(groups)) {
      groupStage(w, {
        edition: ed, comp, importance: 25, groups: { [g]: teams },
        dates: teams.length === 5 ? dates5 : dates4.length >= 2 * (teams.length - 1) ? dates4 : dates5,
        rounds: "double",
      });
    }
    const last = matchday(y, "nov", 1)!;
    w.at(dayAfter(last), () => {
      const tables = groupTables(w, ed, groups, "h2h");
      w.facts.set(`${ed}:tables`, tables);
      onDone(tables, field);
    });
  });
}

/** Play-off paths in March: semi-finals (better-ranked at home) then a final. */
function playoffPaths(w: World, ed: string, comp: "Euro Qualifier" | "World Cup Qualifier", year: number, teams: string[], paths: number, onDone: (winners: string[]) => void): void {
  if (paths <= 0) { onDone([]); return; }
  const rng = rngFor(`paths|${ed}`);
  const sorted = [...teams].sort((a, b) => w.rankOf(a) - w.rankOf(b)).slice(0, paths * 4);
  const top = sorted.slice(0, paths * 2), bottom = shuffled(sorted.slice(paths * 2), rng);
  const winners: string[] = [];
  for (let p = 0; p < paths; p++) {
    const a = [top[2 * p], bottom[2 * p], top[2 * p + 1], bottom[2 * p + 1]].filter(Boolean);
    if (a.length < 4) { if (a[0]) winners.push(a[0]); continue; }
    bracket(w, {
      edition: ed, comp, names: [`Play-Off Path ${p + 1} Semi-Final`, `Play-Off Path ${p + 1} Final`],
      dates: [matchday(year, "mar", 0)!, matchday(year, "mar", 1)!], importance: () => 25,
      level: "et-pens", archive: false,
    }, a, (r) => { winners.push(r.winner); if (winners.length === paths) onDone(winners); });
  }
  if (winners.length === paths) onDone(winners);
}

// ── Euro ────────────────────────────────────────────────────────────────────

export function euroCycle(w: World, euroYear: number): void {
  const ed = `EURO-${euroYear}`;
  const qed = `EUROQ-${euroYear}`;
  const hosts = euroHosts(euroYear).filter((h) => uefaNations().includes(h));
  const qualified: string[] = [];

  qualifyingGroups(w, qed, "Euro Qualifier", euroYear, [], (tables) => {
    const winners = Object.values(tables).map((t) => t[0].name);
    const ru = placedFair(w, qed, tables, 1).map((r) => r.name);
    qualified.push(...winners, ...ru.slice(0, 8));
    const missedHosts = hosts.filter((h) => !qualified.includes(h))
      .sort((a, b) => w.rankOf(a) - w.rankOf(b)).slice(0, 2);
    qualified.push(...missedHosts);
    const paths = Math.max(0, 24 - qualified.length);
    const nlRank = (w.facts.get(`NL-${euroYear - 2}:ranking`) as string[] | undefined) ?? [];
    const cands = [...ru.slice(8), ...nlRank].filter((n, i, a) => !qualified.includes(n) && a.indexOf(n) === i);
    playoffPaths(w, qed, "Euro Qualifier", euroYear, cands.slice(0, paths * 4), paths, (pw) => {
      qualified.push(...pw);
      w.facts.set(`${ed}:qualified`, [...qualified]);
    });
  });

  // The final tournament: draw after the play-offs.
  const start = euroYear === 2028 ? utcNoon(2028, 6, 9) : secondFriday(euroYear, 6);
  w.at(noon(Date.UTC(euroYear, 3, 2)), () => {
    const q = (w.facts.get(`${ed}:qualified`) as string[] | undefined) ?? qualified;
    const field = fillTo(w, q, 24, uefaNations());
    const qHosts = hosts.filter((h) => field.includes(h));
    const rest = field.filter((n) => !qHosts.includes(n)).sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const seeded = [...qHosts, ...rest];
    const fixed: Record<number, string[]> = {};
    qHosts.slice(0, 6).forEach((h, i) => (fixed[i] = [h]));
    const groups = drawGroups(pots(seeded, 6), 6, rngFor(`draw|${ed}`), () => true, fixed);
    tournament(w, {
      edition: ed, comp: "European Championship",
      groups: Object.fromEntries(groups.map((g, i) => [letters[i], g])),
      groupDates: [start, plusDays(start, 4), plusDays(start, 8)],
      names: ["Round of 16", "Quarter-Final", "Semi-Final", "Final"],
      koDates: [plusDays(start, 13), plusDays(start, 18), plusDays(start, 23), plusDays(start, 30)],
      groupImportance: 35, koImportance: (r) => (r >= 1 ? 40 : 35), tie: "h2h", thirds: 4, hosts: qHosts,
    });
  });
}

// ── World Cup qualifying ────────────────────────────────────────────────────

/** Europe's World Cup places (2026 allocation; hosts count inside it). */
export const UEFA_WC_SLOTS = 16;

export function uefaWorldCupQualifying(w: World, wcYear: number, onDone: (direct: string[]) => void): void {
  const qed = `WCQ-UEFA-${wcYear}`;
  const hosts = worldCupHosts(wcYear).filter((h) => uefaNations().includes(h));
  qualifyingGroups(w, qed, "World Cup Qualifier", wcYear, hosts, (tables) => {
    const winners = Object.values(tables).map((t) => t[0].name);
    const slots = UEFA_WC_SLOTS - hosts.length;
    const direct = winners.slice(0, slots);
    const paths = Math.max(0, slots - direct.length);
    const ru = placedFair(w, qed, tables, 1).map((r) => r.name);
    const nlWinners = ((w.facts.get(`NL-${wcYear - 2}:groupWinners`) as string[] | undefined) ?? [])
      .filter((n) => !direct.includes(n) && !ru.includes(n) && !hosts.includes(n));
    const cands = [...ru, ...nlWinners.slice(0, 4)];
    playoffPaths(w, qed, "World Cup Qualifier", wcYear, cands.slice(0, paths * 4), paths, (pw) => onDone([...direct, ...pw]));
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function secondFriday(year: number, month: number): number {
  const first = new Date(Date.UTC(year, month - 1, 1, 12));
  const toFri = (5 - first.getUTCDay() + 7) % 7;
  return first.getTime() + (toFri + 7) * DAY;
}

/**
 * A field of exactly `n`: the qualifiers, and if a rule ever leaves it short
 * (never with these rules; a guard so a season can't break) the best-ranked
 * of `pool` not in it.
 */
export function fillTo(w: World, q: string[], n: number, pool: string[]): string[] {
  const out = Array.from(new Set(q)).slice(0, n);
  if (out.length < n) {
    w.facts.set(`warn:${n}:${pool[0]}:${w.now}`, `filled ${n - out.length}`);
    for (const p of [...pool].sort((a, b) => w.rankOf(a) - w.rankOf(b))) {
      if (out.length >= n) break;
      if (!out.includes(p)) out.push(p);
    }
  }
  return out;
}
