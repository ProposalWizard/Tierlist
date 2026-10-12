/**
 * OFC — World Cup qualifying and the OFC Nations Cup.
 *
 * WORLD CUP QUALIFYING (2026 format): the four lowest-ranked play a one-venue
 * semi-final and final; the winner joins the other seven in two groups of
 * four (each plays the others once); the top two of each group play
 * semi-finals and a final. The winner qualifies, the runner-up goes to the
 * inter-confederation play-off.
 *
 * OFC NATIONS CUP (every four years, 2028 next): eight teams. The four
 * lowest-ranked play a one-venue semi-final and final in March for the last
 * place. Two groups of four, semi-finals, third place, final, in June.
 */
import { rngFor, pots, drawGroups } from "./engine";
import { type World, dayAfter, noon } from "./world";
import { nationsIn } from "./nations";
import { matchday, matchdays, groupStage, groupTables, bracket, tournament, plusDays } from "./build";
import { ofcHosts, worldCupHosts } from "./hosts";
import { fillTo } from "./uefa";
import type { WcqResult } from "./worldCup";

export function ofcNations(): string[] {
  return nationsIn("OFC").map((n) => n.name);
}

/** Four lowest-ranked in a one-venue semi-final and final; `then` gets the rest and the winner. */
function preliminary(w: World, ed: string, comp: "World Cup Qualifier" | "OFC Nations Cup", field: string[], dates: [number, number], then: (top: string[], winner: string | null) => void): void {
  const byRank = [...field].sort((a, b) => w.rankOf(a) - w.rankOf(b));
  if (byRank.length < 11) { then(byRank, null); return; }
  const low = byRank.slice(-4), top = byRank.slice(0, -4);
  bracket(w, {
    edition: ed, comp, names: ["Preliminary Semi-Final", "Preliminary Final"], dates,
    importance: () => (comp === "World Cup Qualifier" ? 25 : 35), level: "et-pens", neutral: true, archive: false,
  }, [low[0], low[3], low[1], low[2]], (r) => then(top, r.winner));
}

export function ofcWorldCupQualifying(w: World, wcYear: number, slots: { direct: number; ic: number }, onDone: (r: WcqResult) => void): void {
  const ed = `WCQ-OFC-${wcYear}`;
  const hosts = worldCupHosts(wcYear);
  const field = ofcNations().filter((n) => !hosts.includes(n));
  const so = matchdays([[wcYear - 2, "sepoct"]]);
  const r2Dates = [so[2], so[3], matchday(wcYear - 2, "nov", 0)!];
  const r3Dates = [matchday(wcYear - 1, "mar", 0)!, matchday(wcYear - 1, "mar", 1)!];
  let groups: Record<string, string[]> = {};
  w.at(noon(Date.UTC(wcYear - 2, 7, 1)), () => {
    preliminary(w, ed, "World Cup Qualifier", field, [so[0], so[1]], (top, win) => {
      const f = [...top, ...(win ? [win] : [])];
      const gs = drawGroups(pots(f, 2), 2, rngFor(`draw|${ed}`));
      groups = { A: gs[0], B: gs[1] };
      groupStage(w, { edition: ed, comp: "World Cup Qualifier", importance: 25, groups, dates: r2Dates, rounds: "single", neutral: true, label: "Second Round · Group" });
    });
  });
  w.at(dayAfter(r2Dates[2]), () => {
    const T = groupTables(w, ed, groups, "h2h");
    bracket(w, {
      edition: ed, comp: "World Cup Qualifier", names: ["Third Round Semi-Final", "Third Round Final"],
      dates: r3Dates, importance: () => 25, level: "et-pens", neutral: true, archive: false,
    }, [T.A[0].name, T.B[1].name, T.B[0].name, T.A[1].name], (r) => onDone({
      direct: [r.winner].slice(0, slots.direct), ic: [r.runnerUp].slice(0, slots.ic),
    }));
  });
}

export function ofcNationsCup(w: World, year: number): void {
  const ed = `OFCNC-${year}`;
  const hosts = ofcHosts(year);
  const mar = [matchday(year, "mar", 0)!, matchday(year, "mar", 1)!] as [number, number];
  const start = plusDays(matchday(year, "jun", 1)!, 6);
  let entrants: string[] = [];
  w.at(noon(Date.UTC(year, 1, 1)), () => {
    preliminary(w, ed, "OFC Nations Cup", ofcNations(), mar, (top, win) => {
      entrants = [...top, ...(win ? [win] : [])];
    });
  });
  w.at(noon(Date.UTC(year, 3, 10)), () => {
    const field = fillTo(w, entrants, 8, ofcNations());
    const qHosts = hosts.filter((h) => field.includes(h));
    const seeded = [...qHosts, ...field.filter((n) => !qHosts.includes(n)).sort((a, b) => w.rankOf(a) - w.rankOf(b))];
    const gs = drawGroups(pots(seeded, 2), 2, rngFor(`draw|${ed}`), () => true, qHosts.length ? { 0: [qHosts[0]] } : {});
    tournament(w, {
      edition: ed, comp: "OFC Nations Cup", groups: { A: gs[0], B: gs[1] },
      groupDates: [start, plusDays(start, 3), plusDays(start, 6)],
      names: ["Semi-Final", "Final"], koDates: [plusDays(start, 10), plusDays(start, 14)],
      groupImportance: 35, koImportance: () => 40, tie: "h2h", thirds: 0, hosts: qHosts, thirdPlace: true,
    });
  });
}
