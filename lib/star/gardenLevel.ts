/**
 * THE GARDEN GROWS WITH YOUR HOME — and what goes in its trophy room.
 *
 * Harry, 2 Oct 2026: "upgrade the garden … garden looking ass." The garden
 * (components/star/GardenScreen.tsx) shows real data only, so how big and how
 * nice it is comes from the homes you have actually bought in the shop
 * (`career.ownedItems`, the "homes" group in lifestyleLevels.ts). No new
 * field, no new mechanic: the best home you own picks the garden.
 *
 *   tier 0  no home / a small flat   fence, small lawn, bird bath
 *   tier 1  a bigger flat, a house   hedge, mown stripes, flower beds
 *   tier 2  a detached house         patio, lamps, a pond
 *   tier 3  a mansion / estate       stone wall, topiary, a fountain
 *   tier 4  the top homes            manor with columns, a big fountain
 *
 * The horse's stable grows the same way off the "stable" item (0 = none).
 */
import type { CareerState, OwnedItem, Trophy } from "./types";
import { LIFESTYLE_LEVELS, baseIdOf } from "./shopDefaults";
import { trophyArt } from "./trophyArt";

export type GardenTier = 0 | 1 | 2 | 3 | 4;

/** Garden tier for each home family, level 1 → level 5. */
const HOME_TIERS: Record<string, [GardenTier, GardenTier, GardenTier, GardenTier, GardenTier]> = {
  "flat-1": [0, 0, 0, 1, 1],
  "flat-2": [0, 0, 1, 1, 1],
  penthouse: [1, 1, 1, 2, 2],
  "house-1": [1, 1, 2, 2, 3],
  "house-2": [3, 3, 4, 4, 4],
  estate: [2, 3, 3, 4, 4],
};

/** An item's shop level. One bought before levels existed has none stored:
 *  read it off the catalogue entry with the same id instead. */
function levelOf(item: OwnedItem): number {
  if (item.level && item.level >= 1) return Math.min(5, item.level);
  const cat = LIFESTYLE_LEVELS.find((l) => l.id === item.id);
  return cat?.level ?? 1;
}

/** How grand the garden is, from the best home you own. */
export function gardenTier(owned: OwnedItem[] | undefined): GardenTier {
  let best: GardenTier = 0;
  for (const item of owned ?? []) {
    const tiers = HOME_TIERS[baseIdOf(item)];
    if (!tiers) continue;
    const t = tiers[levelOf(item) - 1];
    if (t > best) best = t;
  }
  return best;
}

/** The stable's level, 1-5, or 0 when you have not bought one. */
export function stableLevel(owned: OwnedItem[] | undefined): number {
  let best = 0;
  for (const item of owned ?? []) if (baseIdOf(item) === "stable") best = Math.max(best, levelOf(item));
  return best;
}

export interface ShelfTrophy {
  name: string;
  count: number;
  /** The real picture (public/star/trophies), or null — drawn as a plain cup. */
  art: string | null;
}

/** Shelf order: the biggest prizes first, then by how many you have. */
const PRESTIGE = [
  "Ballon d'Or", "World Cup", "Champions League", "Premier League", "Europa League",
  "FA Cup", "Golden Boot", "Player of the Season", "League Cup", "Championship",
  "League One", "League Two", "National League", "Player of the Month",
];

/**
 * One shelf spot per competition you have won, with how many times — so a
 * long career's thirty medals read as a cabinet, not a pile. The Ballon d'Or
 * count lives on its own field (`career.ballonDorWins`), so it is added here.
 */
export function trophyShelf(trophies: Trophy[] | undefined, ballonDors: number): ShelfTrophy[] {
  const counts = new Map<string, number>();
  for (const t of trophies ?? []) counts.set(t.competition, (counts.get(t.competition) ?? 0) + 1);
  if (ballonDors > 0) counts.set("Ballon d'Or", Math.max(ballonDors, counts.get("Ballon d'Or") ?? 0));
  const rank = (n: string) => { const i = PRESTIGE.indexOf(n); return i < 0 ? PRESTIGE.length : i; };
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count, art: trophyArt(name) }))
    .sort((a, b) => rank(a.name) - rank(b.name) || b.count - a.count || a.name.localeCompare(b.name));
}

/** Everything the garden reads, in one place. */
export function gardenData(career: CareerState) {
  return {
    tier: gardenTier(career.ownedItems),
    stable: stableLevel(career.ownedItems),
    shelf: trophyShelf(career.trophies, career.ballonDorWins ?? 0),
    trophyCount: (career.trophies ?? []).length,
  };
}
