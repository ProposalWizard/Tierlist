/**
 * THE TROPHY CABINET IN YOUR 3D HOME — your real trophies and awards, one
 * shelf spot each with how many times you won it, and the big ones you have
 * not won yet as empty spots that say "Win it to fill this".
 *
 * Read from the career only: `trophies` (league, cups, Europe…), `awards`
 * (Golden Boot, Player of the Season, Player of the Month…) and
 * `ballonDorWins`. The same win stored twice (a trophy and an award with the
 * same name and season) counts once.
 *
 * Every trophy is drawn as a stylised model made in code (./scene.ts): no
 * real trophy's shape, no badges. Pure: tested in tests/star/home3d.mts.
 */
import type { CareerState } from "../types";

/** How a trophy is drawn. */
export type TrophyShape = "cup" | "jug" | "ball" | "boot" | "plaque" | "globe" | "star";

export interface CabinetSlot {
  name: string;
  /** Times won (0: an empty spot to aim at). */
  count: number;
  won: boolean;
  shape: TrophyShape;
  metal: "gold" | "silver";
}

/** The big ones, most prestigious first: always in the cabinet, won or not. */
export const CABINET_TARGETS = [
  "Ballon d'Or", "World Cup", "Champions League", "Premier League", "Europa League",
  "FA Cup", "Golden Boot", "Player of the Season", "League Cup", "Player of the Month",
  "Championship", "Community Shield",
];

/** Everything else you can win, in order, after the targets. */
const OTHERS = [
  "Conference League", "Super Cup", "European Championship", "Assist King", "Golden Glove",
  "Young Player of the Season", "League One", "League Two", "National League", "Play-Offs",
];

const SHAPE: Record<string, TrophyShape> = {
  "Ballon d'Or": "ball",
  "World Cup": "globe",
  "Champions League": "jug",
  "Europa League": "jug",
  "Conference League": "jug",
  "Golden Boot": "boot",
  "Golden Glove": "boot",
  "Player of the Season": "star",
  "Young Player of the Season": "star",
  "Player of the Month": "plaque",
  "Assist King": "plaque",
};
/** Silver pieces; everything else is gold. */
const SILVER = new Set(["Champions League", "Europa League", "Conference League", "FA Cup", "League Cup", "Premier League", "Championship", "League One", "League Two", "National League", "Community Shield", "Super Cup", "Play-Offs"]);

export function trophyShape(name: string): TrophyShape {
  return SHAPE[name] ?? "cup";
}
export function trophyMetal(name: string): "gold" | "silver" {
  return SILVER.has(name) ? "silver" : "gold";
}

/** How many times you won each thing (trophies + awards + Ballon d'Or), no double counting. */
export function winsOf(career: Pick<CareerState, "trophies" | "awards" | "ballonDorWins">): Map<string, number> {
  const seen = new Set<string>();
  const n = new Map<string, number>();
  const add = (name: string, key: string) => {
    if (!name || seen.has(key)) return;
    seen.add(key);
    n.set(name, (n.get(name) ?? 0) + 1);
  };
  for (const t of career.trophies ?? []) add(t.competition, `${t.competition}|${t.season}`);
  for (const a of career.awards ?? []) add(a.kind, `${a.kind}|${a.season}${a.week !== undefined ? `|w${a.week}` : ""}`);
  const bd = career.ballonDorWins ?? 0;
  if (bd > (n.get("Ballon d'Or") ?? 0)) n.set("Ballon d'Or", bd);
  return n;
}

/**
 * The cabinet's spots, `size` of them: everything you have won (targets first,
 * in prestige order, then the rest), with the targets you have not won filling
 * the spaces left as empty spots. When you have won more than fits, the
 * empty spots give way first, then the least prestigious wins.
 */
export function cabinetSlots(career: Pick<CareerState, "trophies" | "awards" | "ballonDorWins">, size: number): CabinetSlot[] {
  const wins = winsOf(career);
  const order = [...CABINET_TARGETS, ...OTHERS];
  const rank = (name: string) => { const i = order.indexOf(name); return i < 0 ? order.length : i; };
  const won = Array.from(wins.keys()).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const slot = (name: string): CabinetSlot => {
    const count = wins.get(name) ?? 0;
    return { name, count, won: count > 0, shape: trophyShape(name), metal: trophyMetal(name) };
  };
  const empties = CABINET_TARGETS.filter((t) => !wins.has(t));
  // the wins always get their spots first; empty targets fill what is left
  const keepWins = won.slice(0, size);
  const room = Math.max(0, size - keepWins.length);
  const names = [...keepWins, ...empties.slice(0, room)];
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(slot);
}
