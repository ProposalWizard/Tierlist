/**
 * THE WORLD CUP — every confederation's qualifying, the inter-confederation
 * play-off, the draw and the finals.
 *
 * Format (FIFA, the 2026 rules, read 12 Oct 2026): 48 teams, 12 groups of 4,
 * the top two and the eight best thirds to a round of 32, then the round of
 * 16, quarter-finals, semi-finals, third place and final; extra time and
 * penalties. Places: UEFA 16, CAF 9 (+1 play-off), AFC 8 (+1), CONMEBOL 6
 * (+1), CONCACAF 6 (+2), OFC 1 (+1); hosts count inside their own
 * confederation's places, as the 2026 hosts did inside CONCACAF's. 2030 and
 * later keep this until FIFA confirms otherwise (64 teams for 2030 was only
 * proposed).
 *
 * Inter-confederation play-off (March of the World Cup year, one venue): six
 * teams, the two best-ranked go straight to a path final; the other four
 * play semi-finals. Two winners qualify.
 *
 * Draw (the 2026 rules): four pots of 12 by FIFA ranking, hosts in pot 1 and
 * in the first groups; at most one team per confederation in a group, two for
 * UEFA. Here the draw is made in April, after the play-offs (the real draw is
 * in December with play-off placeholders — the groups come out the same way).
 */
import { rngFor, pots, drawGroups } from "./engine";
import { type World, dayAfter, noon } from "./world";
import { NATIONS, nationFor } from "./nations";
import { matchday, single, tournament, plusDays, utcNoon } from "./build";
import { worldCupHosts } from "./hosts";
import { uefaWorldCupQualifying, UEFA_WC_SLOTS, fillTo } from "./uefa";
import { conmebolWorldCupQualifying } from "./conmebol";
import { concacafWorldCupQualifying } from "./concacaf";
import { cafWorldCupQualifying } from "./caf";
import { afcWorldCupQualifying } from "./afc";
import { ofcWorldCupQualifying } from "./ofc";
import { winnerOf } from "./engine";

export interface WcqResult { direct: string[]; ic: string[] }

const letters = "ABCDEFGHIJKL";

export const WC_SLOTS = {
  UEFA: { direct: UEFA_WC_SLOTS, ic: 0 },
  CAF: { direct: 9, ic: 1 },
  AFC: { direct: 8, ic: 1 },
  CONMEBOL: { direct: 6, ic: 1 },
  CONCACAF: { direct: 6, ic: 2 },
  OFC: { direct: 1, ic: 1 },
} as const;

/** Opening day of each World Cup: the second Thursday of June. */
export function worldCupStart(year: number): number {
  const first = new Date(Date.UTC(year, 5, 1, 12));
  const toThu = (4 - first.getUTCDay() + 7) % 7;
  return first.getTime() + (toThu + 7) * 86_400_000;
}

export function worldCupCycle(w: World, year: number): void {
  const ed = `WC-${year}`;
  const hosts = worldCupHosts(year);
  const direct: string[] = [...hosts];
  const ic: string[] = [];
  const add = (r: WcqResult) => { direct.push(...r.direct); ic.push(...r.ic); };
  uefaWorldCupQualifying(w, year, (d) => direct.push(...d));
  conmebolWorldCupQualifying(w, year, WC_SLOTS.CONMEBOL.direct, add);
  concacafWorldCupQualifying(w, year, WC_SLOTS.CONCACAF, add);
  cafWorldCupQualifying(w, year, WC_SLOTS.CAF, add);
  afcWorldCupQualifying(w, year, WC_SLOTS.AFC, add);
  ofcWorldCupQualifying(w, year, WC_SLOTS.OFC, add);

  // Inter-confederation play-off, March.
  const md0 = matchday(year, "mar", 0)!, md1 = matchday(year, "mar", 1)!;
  const icWinners: string[] = [];
  w.at(noon(Date.UTC(year, 1, 1)), () => {
    const six = [...ic].sort((a, b) => w.rankOf(a) - w.rankOf(b));
    w.facts.set(`${ed}:icTeams`, six);
    if (six.length < 6) { icWinners.push(...six.slice(0, 2)); return; }
    const spec = { edition: `WCPO-${year}`, comp: "World Cup Play-Off" as const, importance: 25, level: "et-pens" as const, neutral: true };
    const sf1 = single(w, { ...spec, stage: "Semi-Final" }, six[2], six[5], md0, "SF1");
    const sf2 = single(w, { ...spec, stage: "Semi-Final" }, six[3], six[4], md0, "SF2");
    w.at(dayAfter(md0), () => {
      const f1 = single(w, { ...spec, stage: "Final" }, six[0], winnerOf(sf2)!, md1, "F1");
      const f2 = single(w, { ...spec, stage: "Final" }, six[1], winnerOf(sf1)!, md1, "F2");
      w.at(dayAfter(md1), () => icWinners.push(winnerOf(f1)!, winnerOf(f2)!));
    });
  });

  // Draw and finals.
  const start = worldCupStart(year);
  w.at(noon(Date.UTC(year, 3, 3)), () => {
    const everyone = NATIONS.filter((n) => !n.suspended).map((n) => n.name);
    const field = fillTo(w, [...direct, ...icWinners], 48, everyone);
    w.facts.set(`${ed}:qualified`, field);
    const qHosts = hosts.filter((h) => field.includes(h));
    const rest = field.filter((n) => !qHosts.includes(n)).sort((a, b) => w.rankOf(a) - w.rankOf(b));
    const seeded = [...qHosts, ...rest];
    const fixed: Record<number, string[]> = {};
    qHosts.forEach((h, i) => (fixed[i] = [h]));
    const confOf = (n: string) => nationFor(n)?.confederation ?? "?";
    const allowed = (t: string, g: string[]) => {
      const c = confOf(t);
      return g.filter((x) => confOf(x) === c).length < (c === "UEFA" ? 2 : 1);
    };
    const gs = drawGroups(pots(seeded, 12), 12, rngFor(`draw|${ed}`), allowed, fixed);
    tournament(w, {
      edition: ed, comp: "World Cup", groups: Object.fromEntries(gs.map((g, i) => [letters[i], g])),
      groupDates: [start, plusDays(start, 5), plusDays(start, 10)],
      names: ["Round of 32", "Round of 16", "Quarter-Final", "Semi-Final", "Final"],
      koDates: [plusDays(start, 15), plusDays(start, 20), plusDays(start, 25), plusDays(start, 30), plusDays(start, 35)],
      groupImportance: 50, koImportance: (r) => (r >= 2 ? 60 : 50), tie: "overall", thirds: 8,
      hosts: qHosts, thirdPlace: true,
    });
  });
  void utcNoon;
}
