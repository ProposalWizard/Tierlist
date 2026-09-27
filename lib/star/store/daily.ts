/**
 * DAILY SPECIALS — 3 or 4 items a day, cheaper than usual, the same for
 * everybody on the same day.
 *
 * Seeded by the DATE ONLY (never the player, never the time of day), so two
 * people who open the store on the same day see the same specials — which is
 * what makes "have you seen today's special?" a thing people can say to each
 * other. A new set arrives at midnight UTC.
 *
 * The pool is the level-independent part of the catalogue (animations,
 * accessories, boosts). Boots are left out: which boots you see depends on
 * your level, and a special has to be the same thing for everyone.
 *
 * Pure. Tested in tests/star/storeDaily.mts.
 */
import { ANIMATIONS, ACCESSORIES, BOOSTS, type Rarity } from "./catalogue";

export interface DailySpecial {
  itemId: string;
  percentOff: number;
  /** The first special is always a cosmetic, rare or better — the headline. */
  featured?: boolean;
}

/** The discounts a special can carry. */
export const SPECIAL_DISCOUNTS = [20, 25, 30, 40, 50] as const;

const MS_PER_DAY = 86_400_000;

/** "2026-09-27" for the UTC day `now` falls in, `dayOffset` days later. */
export function dateKeyFor(now: number, dayOffset = 0): string {
  const d = new Date(Math.floor(now / MS_PER_DAY) * MS_PER_DAY + dayOffset * MS_PER_DAY);
  return d.toISOString().slice(0, 10);
}

/** Milliseconds until the next set of specials (next midnight UTC). */
export function msUntilReset(now: number): number {
  return MS_PER_DAY - (now % MS_PER_DAY);
}

/** "5h 12m" / "12m 30s" — the countdown on the page. */
export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

/** djb2 → mulberry32: a stable little random stream from a string. */
function rngFor(key: string): () => number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h) ^ key.charCodeAt(i);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HEADLINE_RARITIES: Rarity[] = ["rare", "epic", "legendary"];

/** Everything a special can be, by id. Standard (free) is never a special. */
export function specialPool(): { cosmetics: { id: string; rarity: Rarity }[]; all: string[] } {
  const cosmetics = [
    ...ANIMATIONS.filter((a) => !a.free).map((a) => ({ id: a.id as string, rarity: a.rarity })),
    ...ACCESSORIES.map((a) => ({ id: a.id, rarity: a.rarity })),
  ];
  return { cosmetics, all: [...cosmetics.map((c) => c.id), ...BOOSTS.map((b) => b.id)] };
}

/** Today's specials for this date key. Same key → same list, always. */
export function dailySpecials(dateKey: string): DailySpecial[] {
  const rng = rngFor(`store-specials:${dateKey}`);
  const { cosmetics, all } = specialPool();
  const count = rng() < 0.5 ? 3 : 4;
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length) % xs.length];
  const discount = () => pick([...SPECIAL_DISCOUNTS]);

  const headlinePool = cosmetics.filter((c) => HEADLINE_RARITIES.includes(c.rarity));
  const headline = pick(headlinePool);
  const out: DailySpecial[] = [{ itemId: headline.id, percentOff: discount(), featured: true }];

  const rest = all.filter((id) => id !== headline.id);
  while (out.length < count && rest.length > 0) {
    const i = Math.floor(rng() * rest.length) % rest.length;
    const [id] = rest.splice(i, 1);
    out.push({ itemId: id, percentOff: discount() });
  }
  return out;
}
