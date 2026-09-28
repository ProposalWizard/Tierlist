/**
 * The /star-store-dev test controls: which stage of a career the page is
 * pretending you are at. The division sets your shop level (1-5, the same
 * mapping the real shop opens on) and a typical wage for it; the wage can
 * then be typed over. Nothing here reads or writes a career.
 */
import { typicalWeeklyWage } from "../economy";
import { SHOP_TIERS } from "../economy";
import type { CareerDivision } from "../calendar";

export interface StoreTestSettings {
  division: CareerDivision;
  weeklyWage: number;
  /** "Skip a day": how many days ahead of today the specials are. */
  dayOffset: number;
}

export const STORE_DIVISIONS: { id: CareerDivision; label: string }[] = [
  { id: "national_league", label: "National League" },
  { id: "league_two", label: "League Two" },
  { id: "league_one", label: "League One" },
  { id: "championship", label: "Championship" },
  { id: "premier", label: "Premier League" },
];

/** Shop level 1-5 for a division — National League 1 … Premier League 5,
 *  exactly how Shop.tsx picks the level it opens on. */
export function shopLevelFor(division: CareerDivision): number {
  return Math.max(1, SHOP_TIERS.findIndex((t) => t.anchor === division) + 1);
}

/** An ordinary first-teamer's wage in this division, rounded to a whole ★. */
export function typicalWageFor(division: CareerDivision): number {
  return Math.round(typicalWeeklyWage(division));
}

export const DEFAULT_TEST_SETTINGS: StoreTestSettings = {
  division: "league_one",
  weeklyWage: typicalWageFor("league_one"),
  dayOffset: 0,
};

export function sanitizeTestSettings(raw: unknown): StoreTestSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_TEST_SETTINGS;
  const r = raw as Partial<StoreTestSettings>;
  const division = STORE_DIVISIONS.some((d) => d.id === r.division) ? (r.division as CareerDivision) : DEFAULT_TEST_SETTINGS.division;
  const wage = typeof r.weeklyWage === "number" && r.weeklyWage > 0 ? Math.round(r.weeklyWage) : typicalWageFor(division);
  const dayOffset = typeof r.dayOffset === "number" && Number.isFinite(r.dayOffset) ? Math.max(0, Math.min(365, Math.round(r.dayOffset))) : 0;
  return { division, weeklyWage: wage, dayOffset };
}
