/**
 * THE NATIONS — every FIFA member, its confederation and its strength.
 *
 * Source: the FIFA/Coca-Cola Men's World Ranking published 20 July 2026, the
 * last ranking before the game's first season (2026/27), saved as
 * data/fifa/ranking-2026-07-20.json (api.fifa.com). 211 nations: AFC 46,
 * CAF 54, CONCACAF 35, CONMEBOL 10, OFC 11, UEFA 55.
 *
 * Mikey, 12 Oct 2026: "research ... the FIFA rankings ... so instead of a
 * default of 60 for all of them ... a more accurate one", and "their strength
 * will go up or down depending on any players that get added to their
 * lineups" (strength.ts blends in the real players the save knows).
 *
 * Names: a nation is NAMED the way the game's nationality picker spells it
 * (lib/nationalities.ts ALL_NATIONALITIES, which is now exactly these 211),
 * and MATCHED through `nationalityKey`, so a player row that says "Türkiye",
 * "Turkey" or "TR" all find Turkey.
 *
 * Russia is a FIFA member but suspended from every FIFA and UEFA competition
 * (since 2022): it plays friendlies only.
 */
import ranking from "../../../data/fifa/ranking-2026-07-20.json";
import { ALL_NATIONALITIES, nationalityKey } from "../../nationalities";

export type Confederation = "AFC" | "CAF" | "CONCACAF" | "CONMEBOL" | "OFC" | "UEFA";

export interface Nation {
  /** The game's spelling (the nationality picker's). */
  name: string;
  /** FIFA's own spelling. */
  fifaName: string;
  /** FIFA's three-letter code. */
  code: string;
  confederation: Confederation;
  /** FIFA ranking position and points, 20 July 2026. */
  rank: number;
  points: number;
  /** Suspended from competitions (Russia). */
  suspended?: boolean;
}

const SUSPENDED = new Set(["RUS"]);

const PICKER_BY_KEY = new Map<string, string>();
for (const n of ALL_NATIONALITIES) {
  const k = nationalityKey(n);
  if (k) PICKER_BY_KEY.set(k, n);
}

export const NATIONS: Nation[] = (ranking as { teams: { rank: number; name: string; code: string; confederation: string; points: number }[] }).teams
  .map((t) => ({
    name: PICKER_BY_KEY.get(nationalityKey(t.name) ?? "") ?? t.name,
    fifaName: t.name,
    code: t.code,
    confederation: t.confederation as Confederation,
    rank: t.rank,
    points: t.points,
    ...(SUSPENDED.has(t.code) ? { suspended: true } : {}),
  }));

const BY_KEY = new Map<string, Nation>();
for (const n of NATIONS) {
  const k = nationalityKey(n.name);
  if (k) BY_KEY.set(k, n);
}

/** The nation for any spelling of a nationality, or null (not a FIFA nation). */
export function nationFor(nationality: string | null | undefined): Nation | null {
  const k = nationalityKey(nationality);
  return k ? BY_KEY.get(k) ?? null : null;
}

/** The game's spelling for any spelling, or the input when unknown. */
export function nationName(nationality: string): string {
  return nationFor(nationality)?.name ?? nationality;
}

/** Same nation? Compares spellings through the country key. */
export function sameNation(a: string | null | undefined, b: string | null | undefined): boolean {
  const ka = nationalityKey(a), kb = nationalityKey(b);
  return !!ka && ka === kb;
}

export function nationsIn(confederation: Confederation): Nation[] {
  return NATIONS.filter((n) => n.confederation === confederation && !n.suspended);
}

/**
 * Strength (the game's 40-92 team scale, the same one clubs use) from FIFA
 * ranking points, linear: San Marino (721) ≈ 41, the median (1192) ≈ 60,
 * Scotland (1491) ≈ 72, England (1923) ≈ 89, Spain (1996) ≈ 92.
 */
export function rankingStrength(points: number): number {
  return Math.max(40, Math.min(92, 40 + ((points - 700) / 1300) * 52));
}

/** A nation's ranking strength; an unknown name gets the median (60). */
export function baseStrength(nationality: string): number {
  const n = nationFor(nationality);
  return n ? rankingStrength(n.points) : 60;
}

/** FIFA ranking position (lower is better); unknown nations rank last. */
export function rankOf(nationality: string): number {
  return nationFor(nationality)?.rank ?? 999;
}
