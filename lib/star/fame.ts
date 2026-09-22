import type { CareerState, OwnedItem } from "./types";
import type { CareerDivision } from "./calendar";

/**
 * FAME — HOW MANY PEOPLE KNOW YOUR NAME. 0-100, SIX LEVELS.
 *
 * Rebuilt 21 Sep 2026, to the owners' spec:
 *
 *  - CAPPED AT 100. An endless number needs something new every so many
 *    points forever; a cap with six named levels gives every level a real
 *    unlock and makes 100 a genuine goal. It also lets fame go down.
 *  - PLAYING WELL EARNS NOTHING. "You shouldn't even get any fame from
 *    playing football… the only way is if you were by far the best player
 *    of all time." Fame comes from BIG MOMENTS: promotion, Europe, trophies,
 *    individual awards, the Ballon d'Or.
 *  - WHAT YOU OWN COUNTS (the old separate "lifestyle points" are gone —
 *    folded in here). Deliberately NOT capped at +10 — the owners expect to
 *    add far pricier items — but on a flattening curve, so owning more always
 *    helps and never alone gets you to 100.
 *  - ITEMS WEAR OUT. A worn-out item gives nothing until you replace it.
 *  - SCANDALS MAKE YOU MORE FAMOUS, NOT LESS (+1 to +4) — "this would
 *    actually, in real life, increase your fame." They cost REPUTATION
 *    instead (reputation.ts).
 *
 * `career.fame` stores EARNED fame only. What a player sees, and what every
 * system reads, is `fameOf(career)` = earned + what you own, capped at 100.
 * Keeping the two apart is what lets an item breaking take its share away
 * without eroding anything you actually won.
 */

export const FAME_MAX = 100;

export interface FameLevel { name: string; min: number }

export const FAME_LEVELS: FameLevel[] = [
  { name: "Unknown", min: 0 },
  { name: "Local Name", min: 10 },
  { name: "Rising Star", min: 25 },
  { name: "National Name", min: 40 },
  { name: "Global Star", min: 60 },
  { name: "Icon", min: 80 },
];

export function fameLevel(fame: number): FameLevel {
  let out = FAME_LEVELS[0];
  for (const l of FAME_LEVELS) if (fame >= l.min) out = l;
  return out;
}

export function nextFameLevel(fame: number): FameLevel | null {
  return FAME_LEVELS.find(l => l.min > fame) ?? null;
}

// ── What you own ────────────────────────────────────────────────────────────

/**
 * How many seasons an item lasts before it wears out. `null` = never.
 * The owners' guide: "a phone about 2 seasons, a car about 5, property never."
 */
const ITEM_LIFE_BY_ID: Record<string, number | null> = {
  phone: 2, console: 3, headphones: 2, music: 2, tablet: 3,
  smartwatch: 3, tv: 4, "gaming-pc": 3, suit: 2,
  // Jewellery, art and fine watches keep their value.
  silver: null, art: null, gold: null, diamond: null, rolex: null,
  // Vehicles: about five seasons; a classic car is the exception.
  classic: null,
};

export function itemLifeSeasons(item: Pick<OwnedItem, "id" | "category">): number | null {
  if (item.id in ITEM_LIFE_BY_ID) return ITEM_LIFE_BY_ID[item.id];
  if (item.category === "property") return null;
  if (item.category === "vehicle") return 5;
  return 3;
}

/** True once an item has run out of seasons. Items bought before wear
 *  existed (no `seasonsLeft`) never wear, rather than breaking on load. */
export function isWornOut(item: OwnedItem): boolean {
  return item.seasonsLeft === 0;
}

/**
 * Fame from everything you own that still works, off a flattening curve:
 *
 *     OWNED_FAME_MAX × (1 − e^(−total status / OWNED_FAME_SCALE))
 *
 * `lifestyleValue` is each item's status. A Phone (3) is worth about 0.2
 * fame; a Private Island (250) about 15; the entire current shop about 33.
 * A pricier item added later still helps, just by less each time — so the
 * shop matters a lot at the top, and can never on its own reach 100.
 */
export const OWNED_FAME_MAX = 40;
export const OWNED_FAME_SCALE = 500;

export function ownedStatus(items: OwnedItem[] | undefined): number {
  return (items ?? []).filter(i => !isWornOut(i)).reduce((s, i) => s + (i.lifestyleValue || 0), 0);
}

export function ownedFame(items: OwnedItem[] | undefined): number {
  const status = ownedStatus(items);
  return OWNED_FAME_MAX * (1 - Math.exp(-status / OWNED_FAME_SCALE));
}

/** What one item adds right now, on top of what you already own — for the
 *  shop to show "+N fame" honestly (the curve means it depends on what you
 *  have). */
export function fameGainFromBuying(items: OwnedItem[] | undefined, item: OwnedItem): number {
  const before = ownedFame(items);
  const after = ownedFame([...(items ?? []).filter(i => i.id !== item.id || !isWornOut(i)), { ...item, seasonsLeft: undefined }]);
  return Math.max(0, after - before);
}

// ── The one number everything reads ─────────────────────────────────────────

export function clampFame(n: number): number {
  return Math.max(0, Math.min(FAME_MAX, Number.isFinite(n) ? n : 0));
}

/** Your fame: what you've earned plus what you own, capped at 100, whole numbers. */
export function fameOf(career: Pick<CareerState, "fame" | "ownedItems">): number {
  return Math.round(clampFame((career.fame ?? 0) + ownedFame(career.ownedItems)));
}

// ── Big moments ─────────────────────────────────────────────────────────────

/** Fame for a trophy you won. Anything not listed (an unnamed cup) is worth 2. */
export const FAME_FOR_TROPHY: Record<string, number> = {
  "Premier League": 12,
  "Championship": 8,
  "League One": 6,
  "League Two": 5,
  "National League": 4,
  "Play-Offs": 3,
  "FA Cup": 8,
  "League Cup": 4,
  "Champions League": 15,
  "Europa League": 8,
  "Conference League": 5,
  "Community Shield": 1,
  "Super Cup": 1,
  "World Cup": 15,
  "European Championship": 12,
};

/** Fame for being promoted INTO this division. */
export const FAME_FOR_PROMOTION_TO: Partial<Record<CareerDivision, number>> = {
  league_two: 3,
  league_one: 4,
  championship: 6,
  premier: 10,
};

export const FAME_EVENTS = {
  qualifiedForEurope: 5,
  ballonDorWin: 15,
  ballonDorTopThree: 5,
  playerOfSeason: 4,
  youngPlayerOfSeason: 3,
  teamOfSeason: 2,
  goldenBoot: 3,
  playerOfMonth: 1,
  relegated: -5,
  benchedSeason: -4,
  /** A scandal or getting caught: a news story. Rolled 1-4. */
  scandalMin: 1,
  scandalMax: 4,
} as const;

/**
 * THE FADE. Your division has a natural level of fame. Sit above it at the
 * end of a season and your earned fame drops a fifth of the way back toward
 * it — drop to a small club and your name slowly fades. Nothing ever fades
 * you BELOW it.
 */
export const DIVISION_FAME_LEVEL: Record<CareerDivision, number> = {
  national_league: 15,
  league_two: 25,
  league_one: 35,
  championship: 50,
  premier: 75,
};
export const FAME_FADE_SHARE = 0.2;

export function fadedFame(earned: number, division: CareerDivision): number {
  const level = DIVISION_FAME_LEVEL[division] ?? 15;
  if (earned <= level) return earned;
  return earned - (earned - level) * FAME_FADE_SHARE;
}

/** Scandal fame, 1-4, from a random draw in [0,1). */
export function scandalFame(roll: number): number {
  const r = Math.max(0, Math.min(0.9999, Number.isFinite(roll) ? roll : 0));
  return FAME_EVENTS.scandalMin + Math.floor(r * (FAME_EVENTS.scandalMax - FAME_EVENTS.scandalMin + 1));
}

/** Add earned fame, never above 100 or below 0. */
export function addFame(earned: number, delta: number): number {
  return clampFame(earned + delta);
}

/** Wear everything you own down by one season. Called at season rollover. */
export function wearItems(items: OwnedItem[] | undefined): OwnedItem[] {
  return (items ?? []).map(i =>
    typeof i.seasonsLeft === "number" && i.seasonsLeft > 0 ? { ...i, seasonsLeft: i.seasonsLeft - 1 } : i);
}

/** A freshly bought item, stamped with how long it lasts. */
export function freshItem(item: OwnedItem): OwnedItem {
  const life = itemLifeSeasons(item);
  const { seasonsLeft: _drop, ...rest } = item;
  return life === null ? rest : { ...rest, seasonsLeft: life };
}
