/**
 * CONMEBOL — World Cup qualifying and the Copa América.
 *
 * WORLD CUP QUALIFYING (the 2026 format, read 12 Oct 2026): all ten play each
 * other home and away (18 matchdays) from the September–October window three
 * years before the World Cup. Top six qualify, seventh goes to the
 * inter-confederation play-off. Ties: overall goal difference, then goals,
 * then head-to-head. For 2030 Argentina, Paraguay and Uruguay qualify as
 * hosts, so the other seven play (14 matchdays) for three places and the
 * play-off (assumption: hosts count inside CONMEBOL's six, as the 2026 hosts
 * did inside CONCACAF's).
 *
 * COPA AMÉRICA (2024 format; 2028's is not confirmed): 16 teams, the ten of
 * CONMEBOL and six from CONCACAF (2024 took them from the CONCACAF Nations
 * League; here the four semi-finalists, then the two best-ranked other
 * quarter-finalists). Four groups of four, top two to the quarter-finals.
 * Level knockout games go straight to penalties; only the final has extra
 * time. A third-place match. Every four years, in Euro years.
 */
import { rngFor, shuffled, pots, drawGroups, doubleRoundRobin } from "./engine";
import { type World, dayAfter, noon } from "./world";
import { nationsIn } from "./nations";
import { matchdays, groupStage, groupTables, tournament, plusDays } from "./build";
import { worldCupHosts, copaHosts } from "./hosts";
import { secondFriday, fillTo } from "./uefa";
import type { WcqResult } from "./worldCup";

const letters = "ABCD";

export function conmebolNations(): string[] {
  return nationsIn("CONMEBOL").map((n) => n.name);
}

export function conmebolWorldCupQualifying(w: World, wcYear: number, slots: number, onDone: (r: WcqResult) => void): void {
  const ed = `WCQ-CONMEBOL-${wcYear}`;
  const hosts = worldCupHosts(wcYear);
  const field = conmebolNations().filter((n) => !hosts.includes(n));
  const direct = slots - (conmebolNations().length - field.length);
  const y = wcYear - 3;
  const all = matchdays([
    [y, "sepoct"], [y, "nov"], [y + 1, "mar"], [y + 1, "jun"], [y + 1, "sepoct"], [y + 1, "nov"],
    [y + 2, "mar"], [y + 2, "jun"], [y + 2, "sepoct"], [y + 2, "nov"],
  ]);
  const rounds = doubleRoundRobin(field).length;
  const dates = all.slice(0, rounds);
  w.at(noon(Date.UTC(y, 7, 1)), () => {
    const order = shuffled(field, rngFor(`draw|${ed}`));
    groupStage(w, {
      edition: ed, comp: "World Cup Qualifier", importance: 25, groups: { CONMEBOL: order },
      dates, rounds: "double", label: "",
    });
    w.facts.set(`${ed}:groups`, { CONMEBOL: order });
  });
  w.at(dayAfter(dates[dates.length - 1]), () => {
    const t = groupTables(w, ed, { CONMEBOL: field }, "overall").CONMEBOL.map((r) => r.name);
    w.facts.set(`${ed}:tables`, groupTables(w, ed, { CONMEBOL: field }, "overall"));
    onDone({ direct: t.slice(0, direct), ic: t.slice(direct, direct + 1) });
  });
}

export function copaAmerica(w: World, year: number): void {
  const ed = `COPA-${year}`;
  const hosts = copaHosts(year);
  const start = plusDays(secondFriday(year, 6), 7);
  w.at(noon(Date.UTC(year, 3, 15)), () => {
    const cnl = (w.facts.get(`CNL-${year - 2}:copa`) as string[] | undefined) ?? [];
    const guests = fillTo(w, cnl, 6, nationsIn("CONCACAF").map((n) => n.name));
    const field = [...conmebolNations(), ...guests];
    const qHosts = hosts.filter((h) => field.includes(h));
    const seeded = [...qHosts, ...field.filter((n) => !qHosts.includes(n)).sort((a, b) => w.rankOf(a) - w.rankOf(b))];
    const fixed: Record<number, string[]> = {};
    qHosts.forEach((h, i) => (fixed[i] = [h]));
    const groups = drawGroups(pots(seeded, 4), 4, rngFor(`draw|${ed}`), () => true, fixed);
    tournament(w, {
      edition: ed, comp: "Copa América",
      groups: Object.fromEntries(groups.map((g, i) => [letters[i], g])),
      groupDates: [start, plusDays(start, 4), plusDays(start, 8)],
      names: ["Quarter-Final", "Semi-Final", "Final"],
      koDates: [plusDays(start, 13), plusDays(start, 17), plusDays(start, 21)],
      groupImportance: 35, koImportance: (r) => (r >= 0 ? 40 : 35), tie: "overall", thirds: 0,
      hosts: qHosts, level: "pens", finalLevel: "et-pens", thirdPlace: true,
    });
  });
}
