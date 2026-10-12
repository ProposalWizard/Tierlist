/**
 * CAF — Africa Cup of Nations qualifying and finals, World Cup qualifying.
 *
 * AFRICA CUP OF NATIONS (CAF, read 12 Oct 2026):
 *   2027: Kenya, Uganda, Tanzania, 19 June – 17 July 2027. Qualifying is the
 *     real draw (19 May 2026): 12 groups of four, home and away, matchdays
 *     in Sep–Oct and November 2026 and March 2027. Top two qualify, except
 *     in a host's group, where the host and the best other team go through.
 *   2028: June–July 2028 (on the FIFA calendar). Qualifying: the 12
 *     lowest-ranked play two-legged ties in June 2027, then 12 groups of
 *     four in Sep–Nov 2027.
 *   From 2032 every four years. Mikey asked for it in the winter break, as
 *   AFCONs usually were ("usually December–January … look it up"): the 2025
 *   edition was 21 Dec – 18 Jan, so 2032 on are played 20 Dec – 17 Jan, with
 *   qualifying from November two years before. (CAF has not fixed these
 *   dates; an assumption.)
 *   Finals: 24 teams, six groups, top two and four best thirds to the round
 *   of 16, extra time and penalties, a third-place match.
 *
 * WORLD CUP QUALIFYING (2026 format): nine groups of six, home and away
 * (10 matchdays, Sep–Oct two years before to June the year before). Group
 * winners qualify; the four best runners-up play a semi-final and final for
 * the inter-confederation play-off place. For 2030 Morocco qualifies as host
 * (assumed inside CAF's nine), so the eight best group winners qualify and
 * the ninth goes to the inter-confederation play-off instead of the
 * runners-up' play-off winner.
 */
import { rngFor, shuffled, pots, drawGroups } from "./engine";
import { type World, dayAfter, noon } from "./world";
import { nationsIn } from "./nations";
import {
  matchday, matchdays, groupStage, groupTables, placedFair, twoLegs, legsWinner, bracket, tournament,
  plusDays, utcNoon,
} from "./build";
import { AFCONQ_2027, realList } from "./realData";
import { afconHosts, worldCupHosts } from "./hosts";
import { fillTo } from "./uefa";
import type { WcqResult } from "./worldCup";

const letters = "ABCDEFGHIJKL";

export function cafNations(): string[] {
  return nationsIn("CAF").map((n) => n.name);
}

/** Start of each Africa Cup of Nations' finals. */
export function afconStart(year: number): number {
  if (year === 2027) return utcNoon(2027, 6, 19);
  if (year === 2028) return plusDays(matchday(2028, "jun", 1)!, 8);
  return utcNoon(year - 1, 12, 20);
}

export function afconYears(until: number): number[] {
  const out = [2027, 2028];
  for (let y = 2032; y <= until; y += 4) out.push(y);
  return out;
}

export function afcon(w: World, year: number): void {
  const qed = `AFCONQ-${year}`;
  const ed = `AFCON-${year}`;
  const hosts = afconHosts(year).map((h) => realList([h])[0]).filter(Boolean);
  const start = afconStart(year);
  let groupDates: number[];
  let prelimDates: [number, number] | null = null;
  if (year === 2027) groupDates = matchdays([[2026, "sepoct"]]).slice(0, 2).concat(matchdays([[2026, "nov"], [2027, "mar"]]));
  else if (year === 2028) { prelimDates = [matchday(2027, "jun", 0)!, matchday(2027, "jun", 1)!]; groupDates = matchdays([[2027, "sepoct"], [2027, "nov"]]); }
  else {
    prelimDates = [matchday(year - 2, "nov", 0)!, matchday(year - 2, "nov", 1)!];
    groupDates = [...matchdays([[year - 1, "mar"], [year - 1, "jun"]]), ...matchdays([[year - 1, "sepoct"]]).slice(0, 2)];
  }
  let groups: Record<string, string[]> = {};
  let r1: ReturnType<typeof twoLegs>[] = [];
  let seededField: string[] = [];

  const drawAndPlay = () => {
    if (year === 2027) {
      groups = Object.fromEntries(Object.entries(AFCONQ_2027).map(([g, t]) => [g, realList(t)]));
    } else {
      const field = [...seededField, ...r1.map((t) => legsWinner(t)!)].sort((a, b) => w.rankOf(a) - w.rankOf(b));
      const nG = Math.round(field.length / 4);
      // At most one host per group.
      const gs = drawGroups(pots(field, nG), nG, rngFor(`draw|${qed}`),
        (t, g) => !(hosts.includes(t) && g.some((x) => hosts.includes(x))));
      groups = Object.fromEntries(gs.map((g, i) => [letters[i], g]));
    }
    w.facts.set(`${qed}:groups`, groups);
    groupStage(w, { edition: qed, comp: "AFCON Qualifier", importance: 25, groups, dates: groupDates, rounds: "double" });
  };

  if (prelimDates) {
    w.at(noon(prelimDates[0] - 40 * 86_400_000), () => {
      const field = cafNations().sort((a, b) => w.rankOf(a) - w.rankOf(b));
      const k = Math.max(0, field.length - 42);
      seededField = field.slice(0, field.length - k);
      const low = shuffled(field.slice(field.length - k), rngFor(`pre|${qed}`));
      r1 = [];
      for (let i = 0; i + 1 < low.length; i += 2) {
        r1.push(twoLegs(w, { edition: qed, comp: "AFCON Qualifier", importance: 25, stage: "Preliminary Round" }, low[i], low[i + 1], prelimDates!, `P-${i / 2 + 1}`));
      }
    });
    w.at(dayAfter(prelimDates[1]), drawAndPlay);
  } else {
    w.at(noon(Date.UTC(2026, 7, 10)), drawAndPlay);
  }

  w.at(dayAfter(groupDates[groupDates.length - 1]), () => {
    const T = groupTables(w, qed, groups, "h2h");
    w.facts.set(`${qed}:tables`, T);
    const q: string[] = [];
    for (const t of Object.values(T)) {
      const names = t.map((r) => r.name);
      const host = names.find((n) => hosts.includes(n));
      if (host) q.push(host, names.filter((n) => n !== host)[0]);
      else q.push(names[0], names[1]);
    }
    for (const h of hosts) if (!q.includes(h)) q.push(h);
    const field = fillTo(w, q, 24, cafNations()).slice(0, 24);
    w.facts.set(`${ed}:qualified`, field);
    const qHosts = hosts.filter((h) => field.includes(h));
    const seeded = [...qHosts, ...field.filter((n) => !qHosts.includes(n)).sort((a, b) => w.rankOf(a) - w.rankOf(b))];
    const fixed: Record<number, string[]> = {};
    qHosts.forEach((h, i) => (fixed[i] = [h]));
    const gs = drawGroups(pots(seeded, 6), 6, rngFor(`draw|${ed}`), () => true, fixed);
    tournament(w, {
      edition: ed, comp: "Africa Cup of Nations",
      groups: Object.fromEntries(gs.map((g, i) => [letters[i], g])),
      groupDates: [start, plusDays(start, 4), plusDays(start, 8)],
      names: ["Round of 16", "Quarter-Final", "Semi-Final", "Final"],
      koDates: [plusDays(start, 12), plusDays(start, 16), plusDays(start, 20), plusDays(start, 28)],
      groupImportance: 35, koImportance: (r) => (r >= 1 ? 40 : 35), tie: "h2h", thirds: 4,
      hosts: qHosts, thirdPlace: true,
    });
  });
}

export function cafWorldCupQualifying(w: World, wcYear: number, slots: { direct: number; ic: number }, onDone: (r: WcqResult) => void): void {
  const ed = `WCQ-CAF-${wcYear}`;
  const hosts = worldCupHosts(wcYear);
  const field = cafNations().filter((n) => !hosts.includes(n));
  const direct = slots.direct - (cafNations().length - field.length);
  const dates = matchdays([[wcYear - 2, "sepoct"], [wcYear - 2, "nov"], [wcYear - 1, "mar"], [wcYear - 1, "jun"]]);
  const po = [matchday(wcYear - 1, "nov", 0)!, matchday(wcYear - 1, "nov", 1)!];
  let groups: Record<string, string[]> = {};
  w.at(noon(Date.UTC(wcYear - 2, 7, 1)), () => {
    const seeded = [...field].sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const gs = drawGroups(pots(seeded, 9), 9, rngFor(`draw|${ed}`));
    groups = Object.fromEntries(gs.map((g, i) => [letters[i], g]));
    groupStage(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, groups, dates, rounds: "double" });
  });
  w.at(dayAfter(dates[dates.length - 1]), () => {
    const T = groupTables(w, ed, groups, "h2h");
    w.facts.set(`${ed}:tables`, T);
    const winners = placedFair(w, ed, T, 0).map((r) => r.name);
    const ru = placedFair(w, ed, T, 1).map((r) => r.name).slice(0, 4);
    const out = winners.slice(0, direct);
    const over = winners.slice(direct);
    // The runners-up' play-off: 1 v 4, 2 v 3, then a final.
    bracket(w, {
      edition: ed, comp: "World Cup Qualifier", names: ["Play-Off Semi-Final", "Play-Off Final"],
      dates: po, importance: () => 25, level: "et-pens", neutral: true, archive: false,
    }, [ru[0], ru[3], ru[1], ru[2]], (r) => onDone({ direct: out, ic: [...over, r.winner].slice(0, slots.ic) }));
  });
}
