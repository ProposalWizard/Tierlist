/**
 * AFC — World Cup qualifying (which doubles as Asian Cup qualifying) and the
 * Asian Cup.
 *
 * ASIAN CUP 2027 (AFC, read 12 Oct 2026): 7 January – 5 February 2027, the
 * real final-tournament groups. Saudi Arabia lost the hosting on 11 Oct 2026
 * and no new host is named, so it is played as neutral. 24 teams, top two
 * and four best thirds to the round of 16, no third-place match. Later
 * editions every four years (2031, 2035 …), also in January — mid-season,
 * so Asian players miss club games (Mikey: unavailable "until they get
 * knocked out").
 *
 * WORLD CUP QUALIFYING (2026 format):
 *   R1  the lowest-ranked play two-legged ties, leaving 36   (Sep–Oct, W−3)
 *   R2  9 groups of 4, home and away; top two go on         (to March W−2)
 *   R3  3 groups of 6, home and away; top two qualify       (to March W−1)
 *   R4  3rd and 4th: 2 groups of 3; winners qualify          (Sep–Oct W−1)
 *   R5  R4 runners-up, two legs → inter-confederation play-off (November)
 * The R3 teams qualify for the next Asian Cup; the R2 thirds and fourths play
 * a third round (6 groups of 3) for the last six places (the shape AFC used
 * for 2027; an assumption for later editions). A World Cup host in Asia
 * (Saudi Arabia 2034) skips qualifying and is given an Asian Cup place.
 */
import { rngFor, shuffled, pots, drawGroups, rankAcrossGroups } from "./engine";
import { type World, dayAfter, noon } from "./world";
import { nationsIn } from "./nations";
import {
  matchday, matchdays, groupStage, groupTables, placed, twoLegs, legsWinner, tournament, plusDays, utcNoon,
} from "./build";
import { ASIAN_CUP_2027, realList } from "./realData";
import { worldCupHosts } from "./hosts";
import { fillTo } from "./uefa";
import type { WcqResult } from "./worldCup";

const letters = "ABCDEFGHIJKL";

export function afcNations(): string[] {
  return nationsIn("AFC").map((n) => n.name);
}

export function asianCupStart(year: number): number {
  return year === 2027 ? utcNoon(2027, 1, 7) : utcNoon(year, 1, 9);
}

function asianCupFinals(w: World, year: number, groups: Record<string, string[]>, hosts: string[]): void {
  const ed = `AC-${year}`;
  const start = asianCupStart(year);
  tournament(w, {
    edition: ed, comp: "Asian Cup", groups,
    groupDates: [start, plusDays(start, 4), plusDays(start, 8)],
    names: ["Round of 16", "Quarter-Final", "Semi-Final", "Final"],
    koDates: [plusDays(start, 13), plusDays(start, 18), plusDays(start, 23), plusDays(start, 29)],
    groupImportance: 35, koImportance: (r) => (r >= 1 ? 40 : 35), tie: "h2h", thirds: 4, hosts,
  });
}

export function asianCup2027(w: World): void {
  w.at(noon(Date.UTC(2026, 7, 5)), () => {
    const groups = Object.fromEntries(Object.entries(ASIAN_CUP_2027).map(([g, t]) => [g, realList(t)]));
    asianCupFinals(w, 2027, groups, []);
  });
}

export function afcWorldCupQualifying(w: World, wcYear: number, slots: { direct: number; ic: number }, onDone: (r: WcqResult) => void): void {
  const ed = `WCQ-AFC-${wcYear}`;
  const acYear = wcYear + 1;
  const hosts = worldCupHosts(wcYear);
  const field0 = afcNations().filter((n) => !hosts.includes(n));
  const afcHosts = afcNations().filter((n) => hosts.includes(n));
  const direct = slots.direct - afcHosts.length;
  const so = (y: number) => matchdays([[y, "sepoct"]]);
  const r1Dates = [so(wcYear - 3)[0], so(wcYear - 3)[1]] as [number, number];
  const r2Dates = [so(wcYear - 3)[2], so(wcYear - 3)[3], ...matchdays([[wcYear - 3, "nov"], [wcYear - 2, "mar"]])];
  const r3Dates = matchdays([[wcYear - 2, "jun"], [wcYear - 2, "sepoct"], [wcYear - 2, "nov"], [wcYear - 1, "mar"]]);
  const acDates = matchdays([[wcYear - 2, "jun"], [wcYear - 2, "sepoct"]]);
  const r4Dates = so(wcYear - 1).slice(0, 3);
  const r5Dates = [matchday(wcYear - 1, "nov", 0)!, matchday(wcYear - 1, "nov", 1)!] as [number, number];
  let r1: ReturnType<typeof twoLegs>[] = [];
  let r2Seeded: string[] = [];
  let r2Groups: Record<string, string[]> = {};
  let r3Groups: Record<string, string[]> = {};
  let r4Groups: Record<string, string[]> = {};
  let acGroups: Record<string, string[]> = {};
  const acQualified: string[] = [...afcHosts];

  w.at(noon(Date.UTC(wcYear - 3, 7, 1)), () => {
    const byRank = [...field0].sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const k = Math.max(0, 2 * (byRank.length - 36));
    r2Seeded = byRank.slice(0, byRank.length - k);
    const low = byRank.slice(byRank.length - k);
    // Best of the low against worst of the low.
    r1 = [];
    for (let i = 0; i < low.length / 2; i++) {
      r1.push(twoLegs(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, stage: "First Round" },
        low[low.length - 1 - i], low[i], r1Dates, `R1-${i + 1}`));
    }
  });
  w.at(dayAfter(r1Dates[1]), () => {
    const field = [...r2Seeded, ...r1.map((t) => legsWinner(t)!)].sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const nG = Math.round(field.length / 4);
    r2Groups = Object.fromEntries(drawGroups(pots(field, nG), nG, rngFor(`draw2|${ed}`)).map((g, i) => [letters[i], g]));
    groupStage(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, groups: r2Groups, dates: r2Dates, rounds: "double", label: "Second Round · Group" });
  });
  w.at(dayAfter(r2Dates[r2Dates.length - 1]), () => {
    const T = groupTables(w, ed, r2Groups, "h2h");
    const adv = Object.values(T).flatMap((t) => t.slice(0, 2).map((r) => r.name)).sort((a, b) => w.rankOf(a) - w.rankOf(b));
    r3Groups = Object.fromEntries(drawGroups(pots(adv, 3), 3, rngFor(`draw3|${ed}`)).map((g, i) => [`R3-${letters[i]}`, g]));
    groupStage(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, groups: r3Groups, dates: r3Dates, rounds: "double", label: "Third Round · Group" });
    acQualified.push(...adv);
    // Asian Cup third round for the rest of R2's top four.
    const rest = Object.values(T).flatMap((t) => t.slice(2, 4).map((r) => r.name)).sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const nG = Math.max(1, Math.round(rest.length / 3));
    acGroups = Object.fromEntries(drawGroups(pots(rest, nG), nG, rngFor(`drawAC|${ed}`)).map((g, i) => [`AC-${letters[i]}`, g]));
    groupStage(w, { edition: `ACQ-${acYear}`, comp: "Asian Cup Qualifier", importance: 25, groups: acGroups, dates: acDates, rounds: "double", label: "Third Round · Group" });
  });
  w.at(dayAfter(acDates[acDates.length - 1]), () => {
    const T = groupTables(w, `ACQ-${acYear}`, acGroups, "h2h");
    const winners = placed(w, T, 0).map((r) => r.name);
    const ru = placed(w, T, 1).map((r) => r.name);
    const need = 24 - acQualified.length;
    acQualified.push(...[...winners, ...ru].slice(0, Math.max(0, need)));
    w.facts.set(`AC-${acYear}:qualified`, acQualified.slice(0, 24));
  });
  let r3Order: string[] = [];
  w.at(dayAfter(r3Dates[r3Dates.length - 1]), () => {
    const T = groupTables(w, ed, r3Groups, "h2h");
    r3Order = [0, 1].flatMap((p) => rankAcrossGroups(Object.values(T).map((t) => t[p]), w.rankOf).map((r) => r.name));
    const r4 = [2, 3].flatMap((p) => rankAcrossGroups(Object.values(T).map((t) => t[p]), w.rankOf).map((r) => r.name));
    const nG = Math.max(1, Math.round(r4.length / 3));
    r4Groups = Object.fromEntries(drawGroups(pots(r4, nG), nG, rngFor(`draw4|${ed}`)).map((g, i) => [`R4-${letters[i]}`, g]));
    groupStage(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, groups: r4Groups, dates: r4Dates, rounds: "single", label: "Fourth Round · Group", neutral: true });
  });
  w.at(dayAfter(r4Dates[r4Dates.length - 1]), () => {
    const T = groupTables(w, ed, r4Groups, "h2h");
    const r4w = rankAcrossGroups(Object.values(T).map((t) => t[0]), w.rankOf).map((r) => r.name);
    const r4r = rankAcrossGroups(Object.values(T).map((t) => t[1]), w.rankOf).map((r) => r.name);
    const order = [...r3Order, ...r4w];
    const out = order.slice(0, direct);
    const over = order.slice(direct);
    const [a, b] = shuffled(r4r, rngFor(`r5|${ed}`));
    const legs = twoLegs(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, stage: "Fifth Round" }, a, b, r5Dates, "R5");
    w.at(dayAfter(r5Dates[1]), () => onDone({ direct: out, ic: [...over, legsWinner(legs)!].slice(0, slots.ic) }));
  });

  // The Asian Cup that follows (January of the World Cup year + 1).
  w.at(noon(Date.UTC(acYear - 1, 9, 15)), () => {
    const q = fillTo(w, (w.facts.get(`AC-${acYear}:qualified`) as string[] | undefined) ?? [], 24, afcNations());
    const top = [...q].sort((a, b) => w.rankOf(a) - w.rankOf(b)).slice(0, 12);
    const host = top[Math.floor(rngFor(`host|AC-${acYear}`)() * top.length)];
    const seeded = [host, ...q.filter((n) => n !== host).sort((a, b) => w.rankOf(a) - w.rankOf(b))];
    const gs = drawGroups(pots(seeded, 6), 6, rngFor(`draw|AC-${acYear}`), () => true, { 0: [host] });
    asianCupFinals(w, acYear, Object.fromEntries(gs.map((g, i) => [letters[i], g])), [host]);
  });
}
