/**
 * CONCACAF — the Nations League, the Gold Cup and World Cup qualifying.
 *
 * NATIONS LEAGUE 2026–27 (CONCACAF, read 12 Oct 2026): League A 16, B 16,
 * C 9. Four of CONCACAF's 41 members are not FIFA nations (Martinique,
 * Guadeloupe, French Guiana, Saint Martin) and two more are not either
 * (Bonaire, Sint Maarten); the game only has FIFA nations, so the best-ranked
 * League B side stands in for Martinique in A, and the best League C side
 * moves up to B (leagues of 16, 12 and 7).
 *   A: the top four by ranking go straight to the quarter-finals; the other
 *      12 play two "Swiss" groups of six, four matches each (Sep–Oct). Top two
 *      → quarter-finals (two legs, November), 3rd–4th → Gold Cup preliminary
 *      round, 5th–6th go down to B and into the Play-In.
 *   B: groups of four, home and away. Winners (and the best runners-up, to
 *      fill A back up) go up and straight into the Gold Cup; the next two
 *      runners-up → Gold Cup preliminary round; fourths go down.
 *   C: groups, home and away. Winners (and the best runner-up) go up and play
 *      the A relegated teams in the Play-In (two legs, March); Play-In
 *      winners → Gold Cup preliminary round.
 *   Finals (March): semi-finals, third place, final.
 *
 * GOLD CUP (odd years): 16 teams. Direct: the four Nations League
 * quarter-final winners and the B group winners. The preliminary round
 * (one match on the June window's second matchday, best-ranked at home
 * against the worst) fills the rest;
 * if it is one short (an odd number), the best-ranked loser goes through.
 * Four groups of four, top two to the quarter-finals, extra time and
 * penalties. Hosted by the United States.
 *
 * WORLD CUP QUALIFYING (2026 format): the lowest-ranked play two-legged ties
 * (enough to leave 30), then six groups of five play each other once, top two
 * to the third round: three groups of four, home and away. 2026 had three
 * hosts; with none (2030), group winners and runners-up take the six places
 * and the two best thirds go to the inter-confederation play-off.
 */
import { type Row, rngFor, shuffled, pots, drawGroups, rankAcrossGroups, winnerOf, loserOf } from "./engine";
import { type World, dayAfter, noon } from "./world";
import { nationsIn } from "./nations";
import {
  matchday, matchdays, groupStage, groupTables, placed, twoLegs, legsWinner, legsLoser, bracket,
  tournament, plusDays, single,
} from "./build";
import { CNL_2026, realList } from "./realData";
import { worldCupHosts, GOLD_CUP_HOSTS } from "./hosts";
import { fillTo } from "./uefa";
import type { WcqResult } from "./worldCup";

const letters = "ABCDEFGHIJKL";

export function concacafNations(): string[] {
  return nationsIn("CONCACAF").map((n) => n.name);
}

interface CnlOutcome {
  next: Record<string, string[]>;
}

function startingLeagues(w: World): Record<string, string[]> {
  const A = realList(CNL_2026.A), B = realList(CNL_2026.B), C = realList(CNL_2026.C);
  const byRank = (xs: string[]) => [...xs].sort((a, b) => w.rankOf(a) - w.rankOf(b));
  while (A.length < 16 && B.length) { const t = byRank(B)[0]; A.push(t); B.splice(B.indexOf(t), 1); }
  while (B.length < 12 && C.length) { const t = byRank(C)[0]; B.push(t); C.splice(C.indexOf(t), 1); }
  return { A, B, C };
}

export function concacafNationsLeague(w: World, year: number): void {
  const ed = `CNL-${year}`;
  const sepoct = matchdays([[year, "sepoct"]]);
  const autumn = matchdays([[year, "sepoct"], [year, "nov"]]);
  const nov = [matchday(year, "nov", 0)!, matchday(year, "nov", 1)!] as [number, number];
  const mar = [matchday(year + 1, "mar", 0)!, matchday(year + 1, "mar", 1)!] as [number, number];
  let leagues: Record<string, string[]> = {};
  let byes: string[] = [];
  const groupsOf: Record<string, Record<string, string[]>> = {};

  w.at(noon(Date.UTC(year, 7, 15)), () => {
    leagues = year === 2026 ? startingLeagues(w)
      : (w.facts.get(`CNL-${year - 2}:outcome`) as CnlOutcome | undefined)?.next ?? startingLeagues(w);
    const rng = rngFor(`draw|${ed}`);
    const byRank = (xs: string[]) => [...xs].sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const A = byRank(leagues.A);
    byes = A.slice(0, 4);
    const swiss = drawGroups(pots(A.slice(4), 2), 2, rng);
    groupsOf.A = { A1: swiss[0], A2: swiss[1] };
    const nB = Math.max(1, Math.round(leagues.B.length / 4));
    groupsOf.B = Object.fromEntries(drawGroups(pots(byRank(leagues.B), nB), nB, rng).map((g, i) => [`B${i + 1}`, g]));
    const nC = Math.max(1, Math.round(leagues.C.length / 4));
    groupsOf.C = Object.fromEntries(drawGroups(pots(byRank(leagues.C), nC), nC, rng).map((g, i) => [`C${i + 1}`, g]));
    w.facts.set(`${ed}:groups`, { ...groupsOf, byes });
    groupStage(w, { edition: ed, comp: "CONCACAF Nations League", importance: 15, groups: groupsOf.A, dates: sepoct, rounds: "single", maxRounds: 4, label: "League A · Group" });
    groupStage(w, { edition: ed, comp: "CONCACAF Nations League", importance: 15, groups: groupsOf.B, dates: autumn, rounds: "double", label: "League B · Group" });
    groupStage(w, { edition: ed, comp: "CONCACAF Nations League", importance: 15, groups: groupsOf.C, dates: autumn, rounds: "double", label: "League C · Group" });
  });

  // League A: quarter-finals in November.
  w.at(dayAfter(sepoct[sepoct.length - 1]), () => {
    const T = groupTables(w, ed, groupsOf.A, "overall");
    const top2 = [...T.A1.slice(0, 2), ...T.A2.slice(0, 2)].map((r) => r.name);
    const order = shuffled(top2, rngFor(`qf|${ed}`));
    const entrants = byes.flatMap((b, i) => [order[i], b]);
    w.facts.set(`${ed}:qf`, [...byes, ...top2]);
    bracket(w, {
      edition: ed, comp: "CONCACAF Nations League", names: ["Quarter-Final", "Semi-Final", "Final"],
      dates: [nov, mar[0], mar[1]], importance: () => 25, level: "et-pens", neutral: true, thirdPlace: true,
    }, entrants, (r) => {
      const sf = [r.winner, r.runnerUp, ...(r.losers[1] ?? [])];
      const qfLosers = (r.losers[0] ?? []).sort((a, b) => w.rankOf(a) - w.rankOf(b));
      w.facts.set(`${ed}:copa`, [...sf, ...qfLosers].slice(0, 6));
      w.facts.set(`${ed}:qfWinners`, sf);
      w.facts.set(`${ed}:qfLosers`, qfLosers);
    });
  });

  // Leagues B and C finish in November; promotion, relegation, Play-In.
  w.at(dayAfter(autumn[autumn.length - 1]), () => {
    const TA = groupTables(w, ed, groupsOf.A, "overall");
    const TB = groupTables(w, ed, groupsOf.B, "overall");
    const TC = groupTables(w, ed, groupsOf.C, "overall");
    const at = (T: Record<string, Row[]>, p: number) => placed(w, T, p).map((r) => r.name);
    const relA = [...at(TA, 4), ...at(TA, 5)];
    const promB = [...at(TB, 0), ...at(TB, 1)].slice(0, relA.length);
    const relB = Object.values(TB).map((t) => t[t.length - 1].name).filter((n) => !promB.includes(n));
    const promC = [...at(TC, 0), ...at(TC, 1)].slice(0, relB.length);
    const next = {
      A: [...leagues.A.filter((n) => !relA.includes(n)), ...promB],
      B: [...leagues.B.filter((n) => !promB.includes(n) && !relB.includes(n)), ...relA, ...promC],
      C: [...leagues.C.filter((n) => !promC.includes(n)), ...relB],
    };
    w.facts.set(`${ed}:outcome`, { next } as CnlOutcome);
    w.facts.set(`${ed}:tables`, { ...TA, ...TB, ...TC });
    // Gold Cup routes.
    const goldDirectB = at(TB, 0);
    const prelimB = [...at(TB, 1)].filter((n) => !promB.includes(n)).slice(0, 2);
    const a34 = [...at(TA, 2), ...at(TA, 3)];
    w.facts.set(`${ed}:gold`, { directB: goldDirectB, prelim: [...a34, ...prelimB] });
    // Play-In (March): A relegated v C promoted, the A side at home second.
    const rng = rngFor(`playin|${ed}`);
    const c = shuffled(promC, rng);
    const ties = relA.slice(0, c.length).map((a, i) => twoLegs(w, {
      edition: ed, comp: "CONCACAF Nations League", importance: 15, stage: "Play-In",
    }, c[i], a, mar, `PI-${i + 1}`));
    const leftover = relA.slice(c.length);
    w.at(dayAfter(mar[1]), () => {
      const winners = [...ties.map((t) => legsWinner(t)!), ...leftover];
      const g = w.facts.get(`${ed}:gold`) as { directB: string[]; prelim: string[] };
      w.facts.set(`${ed}:gold`, { ...g, prelim: [...g.prelim, ...winners] });
      void legsLoser;
    });
  });
}

export function goldCup(w: World, year: number): void {
  const ed = `GOLD-${year}`;
  const cnl = `CNL-${year - 1}`;
  const jun = [matchday(year, "jun", 0)!, matchday(year, "jun", 1)!] as [number, number];
  const start = plusDays(jun[1], 6);
  const direct: string[] = [];
  const prelimWinners: string[] = [];
  w.at(noon(Date.UTC(year, 3, 20)), () => {
    const qfw = (w.facts.get(`${cnl}:qfWinners`) as string[] | undefined) ?? [];
    const qfl = (w.facts.get(`${cnl}:qfLosers`) as string[] | undefined) ?? [];
    const g = (w.facts.get(`${cnl}:gold`) as { directB: string[]; prelim: string[] } | undefined) ?? { directB: [], prelim: [] };
    direct.push(...qfw, ...g.directB);
    const prelim = Array.from(new Set([...qfl, ...g.prelim])).filter((n) => !direct.includes(n))
      .sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const need = 16 - direct.length;
    // One match each, the better-ranked at home, on the window's second
    // matchday (the first is World Cup qualifying in the year before one).
    const ties: ReturnType<typeof single>[] = [];
    const n = Math.floor(prelim.length / 2);
    for (let i = 0; i < n; i++) {
      ties.push(single(w, { edition: ed, comp: "Gold Cup Qualifier", importance: 25, stage: "Preliminary Round", level: "et-pens" },
        prelim[i], prelim[prelim.length - 1 - i], jun[1], `P-${i + 1}`));
    }
    const bye = prelim.length % 2 ? [prelim[n]] : [];
    w.at(dayAfter(jun[1]), () => {
      const wins = [...ties.map((t) => winnerOf(t)!), ...bye];
      const losers = ties.map((t) => loserOf(t)!).sort((a, b) => w.rankOf(a) - w.rankOf(b));
      prelimWinners.push(...[...wins, ...losers].slice(0, need));
      const field = fillTo(w, [...direct, ...prelimWinners], 16, concacafNations());
      const hosts = GOLD_CUP_HOSTS.filter((h) => field.includes(h));
      const seeded = [...hosts, ...field.filter((x) => !hosts.includes(x)).sort((a, b) => w.rankOf(a) - w.rankOf(b))];
      const fixed: Record<number, string[]> = {};
      hosts.forEach((h, i) => (fixed[i] = [h]));
      const groups = drawGroups(pots(seeded, 4), 4, rngFor(`draw|${ed}`), () => true, fixed);
      tournament(w, {
        edition: ed, comp: "Gold Cup", groups: Object.fromEntries(groups.map((x, i) => [letters[i], x])),
        groupDates: [start, plusDays(start, 4), plusDays(start, 8)],
        names: ["Quarter-Final", "Semi-Final", "Final"],
        koDates: [plusDays(start, 12), plusDays(start, 16), plusDays(start, 21)],
        groupImportance: 35, koImportance: () => 40, tie: "overall", thirds: 0, hosts,
      });
    });
  });
}

export function concacafWorldCupQualifying(w: World, wcYear: number, slots: { direct: number; ic: number }, onDone: (r: WcqResult) => void): void {
  const ed = `WCQ-CONCACAF-${wcYear}`;
  const hosts = worldCupHosts(wcYear);
  const field0 = concacafNations().filter((n) => !hosts.includes(n));
  const direct = slots.direct - (concacafNations().length - field0.length);
  const r1Dates = [matchday(wcYear - 3, "nov", 0)!, matchday(wcYear - 3, "nov", 1)!] as [number, number];
  const r2Dates = [
    matchday(wcYear - 2, "mar", 0)!, matchday(wcYear - 2, "mar", 1)!,
    matchday(wcYear - 2, "jun", 0)!, matchday(wcYear - 2, "jun", 1)!, matchday(wcYear - 1, "jun", 0)!,
  ];
  const r3Dates = matchdays([[wcYear - 1, "sepoct"], [wcYear - 1, "nov"]]);
  const r1: ReturnType<typeof twoLegs>[] = [];
  let r2Field: string[] = [];
  let r2Groups: Record<string, string[]> = {};
  let r3Groups: Record<string, string[]> = {};

  w.at(noon(Date.UTC(wcYear - 3, 9, 20)), () => {
    const byRank = [...field0].sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const k = Math.max(0, 2 * (byRank.length - 30));
    const low = byRank.slice(byRank.length - k);
    r2Field = byRank.slice(0, byRank.length - k);
    const rng = rngFor(`draw|${ed}`);
    const sh = shuffled(low, rng);
    for (let i = 0; i + 1 < sh.length; i += 2) {
      r1.push(twoLegs(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, stage: "First Round" }, sh[i], sh[i + 1], r1Dates, `R1-${i / 2 + 1}`));
    }
  });
  w.at(dayAfter(r1Dates[1]), () => {
    const field = [...r2Field, ...r1.map((t) => legsWinner(t)!)].sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const nG = Math.max(1, Math.round(field.length / 5));
    const gs = drawGroups(pots(field, nG), nG, rngFor(`draw2|${ed}`));
    r2Groups = Object.fromEntries(gs.map((g, i) => [letters[i], g]));
    groupStage(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, groups: r2Groups, dates: r2Dates, rounds: "single", label: "Second Round · Group" });
  });
  w.at(dayAfter(r2Dates[r2Dates.length - 1]), () => {
    const T = groupTables(w, ed, r2Groups, "overall");
    const adv = Object.values(T).flatMap((t) => t.slice(0, 2).map((r) => r.name)).sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const nG = Math.max(1, Math.round(adv.length / 4));
    const gs = drawGroups(pots(adv, nG), nG, rngFor(`draw3|${ed}`));
    r3Groups = Object.fromEntries(gs.map((g, i) => [`R3-${letters[i]}`, g]));
    groupStage(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, groups: r3Groups, dates: r3Dates, rounds: "double", label: "Third Round · Group" });
  });
  w.at(dayAfter(r3Dates[r3Dates.length - 1]), () => {
    const T = groupTables(w, ed, r3Groups, "overall");
    const order = [0, 1, 2, 3].flatMap((p) => rankAcrossGroups(Object.values(T).map((t) => t[p]).filter(Boolean), w.rankOf).map((r) => r.name));
    onDone({ direct: order.slice(0, direct), ic: order.slice(direct, direct + slots.ic) });
  });
}
