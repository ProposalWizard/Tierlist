/**
 * AN INTERNATIONAL TOURNAMENT'S LEADERS, FOR ITS HISTORY TAB (Mikey, 2 Nov
 * 2026): the top scorer(s) and assister(s) of one edition, and its player of
 * the tournament (most goals + assists, then goals). Goals are named per
 * Ballon d'Or year (scorers.ts), so an edition is read from this year and the
 * last; an edition with any played match left unnamed (one from before the
 * career, or older than both years) gives null. Kept for good at each
 * rollover (`career.intlHistory`), since older years are not named again.
 * Pure.
 */
import type { CareerState } from "../types";
import { worldOf, intlOf } from "./career";
import { intlSeason } from "./scorers";
import type { CompKind, Final } from "./world";

export interface IntlEditionLeaders {
  edition: string;
  comp: CompKind;
  year: number;
  scorers: { name: string; club: string; n: number }[];
  assisters: { name: string; club: string; n: number }[];
  best?: { name: string; club: string };
}

/** One edition's leaders, or null when its goals are not all named. */
export function editionLeaders(career: CareerState, f: Final): IntlEditionLeaders | null {
  const w = worldOf(career);
  const ms = w.matches.filter((m) => m.edition === f.edition && m.hs != null);
  if (!ms.length) return null;
  const seasons = [career.season, career.season - 1].filter((s) => s >= 1).map((s) => intlSeason(career, s));
  const me = intlOf(career);
  const you = `${career.player.firstName} ${career.player.lastName}`;
  const t = new Map<string, { name: string; club: string; g: number; a: number }>();
  const at = (name: string, nation: string) => {
    const k = `${nation}|${name}`;
    return t.get(k) ?? t.set(k, { name, club: nation, g: 0, a: 0 }).get(k)!;
  };
  for (const m of ms) {
    const named = seasons.map((s) => s.goals.get(m.id)).find(Boolean);
    if (!named) return null;
    for (const [nation, list] of [[m.home, named.home], [m.away, named.away]] as const) {
      for (const goal of list) { at(goal.s, nation).g++; if (goal.a) at(goal.a, nation).a++; }
    }
    const mine = me.played[m.id]?.mine;
    if (mine) { at(you, me.nation).g += mine.g; at(you, me.nation).a += mine.a; }
  }
  const rows = Array.from(t.values());
  const lead = (k: "g" | "a") => {
    const top = Math.max(0, ...rows.map((r) => r[k]));
    return top <= 0 ? [] : rows.filter((r) => r[k] === top).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 3).map((r) => ({ name: r.name, club: r.club, n: top }));
  };
  const best = rows.slice().sort((x, y) => (y.g + y.a) - (x.g + x.a) || y.g - x.g || x.name.localeCompare(y.name))[0];
  return {
    edition: f.edition, comp: f.comp, year: f.year,
    scorers: lead("g"), assisters: lead("a"),
    ...(best && best.g + best.a > 0 ? { best: { name: best.name, club: best.club } } : {}),
  };
}

/** Every finished edition's leaders not kept yet, to add to `career.intlHistory`. */
export function newEditionLeaders(career: CareerState): IntlEditionLeaders[] {
  const have = new Set((career.intlHistory ?? []).map((r) => r.edition));
  const out: IntlEditionLeaders[] = [];
  for (const f of worldOf(career).finals) {
    if (have.has(f.edition)) continue;
    const l = editionLeaders(career, f);
    if (l) out.push(l);
  }
  return out;
}

/** An edition's leaders: kept ones first, else worked out now. */
export function leadersFor(career: CareerState, f: Final): IntlEditionLeaders | null {
  return (career.intlHistory ?? []).find((r) => r.edition === f.edition) ?? editionLeaders(career, f);
}
