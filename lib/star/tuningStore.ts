import { TUNABLES } from "./tuning";

/**
 * TUNING OVERRIDES — LOCAL TO THIS BROWSER.
 *
 * See tuning.ts's own header for the full picture. Two independent kinds of
 * override live here: a flat SCALAR override per registry key (`getTuning`),
 * and a per-item PRICE override for the shop catalogues (KIB cans, boots,
 * lifestyle items) — those are arrays of real items rather than bare
 * numbers, so overriding "one field on one row" needs a different shape
 * than overriding "one named number".
 */

const SCALAR_KEY = "star-tuning-v1";
const PRICE_KEY = "star-tuning-prices-v1";

type ScalarStore = Record<string, number>;
/** catalogue name → item id → overridden field → value */
type PriceStore = Record<string, Record<string, Record<string, number>>>;

/** Explicit, not exception-based — this file is reachable at MODULE LOAD
 *  time from lib/star/shopData.ts, which lib/star/careerFlow.ts imports,
 *  which is what nearly every tests/star/*.mts headless test imports.
 *  Node itself has carried a real, disk-backed `localStorage` global since
 *  v22 — not undefined, so a bare try/catch around it would not just fall
 *  back safely, it would silently read and write an actual local store
 *  file from every test run. Checking `typeof` first keeps a Node test
 *  environment (with no `localStorage` explicitly polyfilled, the
 *  established pattern this codebase's own tests already use) on the
 *  registry's plain defaults, exactly like a browser with nothing
 *  overridden yet. */
function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!hasLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full or blocked localStorage loses the override and nothing else —
    // the game still runs on the registry's own defaults.
  }
}

const DEFAULTS = new Map(TUNABLES.map(t => [t.key, t.default]));

/**
 * The effective value for a tuning key — the browser's own override if one
 * has been saved, otherwise the registry's default. This is what every
 * rewired constant in the game actually calls instead of hardcoding a
 * literal; on a browser with nothing overridden it returns exactly the
 * number the game always shipped with.
 */
export function getTuning(key: string): number {
  const fallback = DEFAULTS.get(key);
  if (fallback === undefined) {
    // A key with no registry entry is a real bug (a typo, or a def that
    // got renamed on one side and not the other) — 0 would silently break
    // gameplay in a way that's hard to trace, so this fails loudly instead,
    // in development, while still not crashing a real session.
    if (process.env.NODE_ENV !== "production") {
      console.error(`getTuning: no registry entry for "${key}"`);
    }
    return 0;
  }
  const v = readJson<ScalarStore>(SCALAR_KEY, {})[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function getTuningOverrides(): ScalarStore {
  return readJson<ScalarStore>(SCALAR_KEY, {});
}

export function setTuningOverride(key: string, value: number): void {
  const all = readJson<ScalarStore>(SCALAR_KEY, {});
  all[key] = value;
  writeJson(SCALAR_KEY, all);
}

export function resetTuning(key: string): void {
  const all = readJson<ScalarStore>(SCALAR_KEY, {});
  delete all[key];
  writeJson(SCALAR_KEY, all);
}

export function resetAllTuning(): void {
  writeJson(SCALAR_KEY, {});
  writeJson(PRICE_KEY, {});
}

// ── Shop catalogue price overrides ──────────────────────────────────────

export function getPriceOverride(catalogue: string, itemId: string, field: string): number | null {
  const all = readJson<PriceStore>(PRICE_KEY, {});
  const v = all[catalogue]?.[itemId]?.[field];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function setPriceOverride(catalogue: string, itemId: string, field: string, value: number): void {
  const all = readJson<PriceStore>(PRICE_KEY, {});
  all[catalogue] ??= {};
  all[catalogue][itemId] ??= {};
  all[catalogue][itemId][field] = value;
  writeJson(PRICE_KEY, all);
}

export function resetPriceOverride(catalogue: string, itemId: string, field: string): void {
  const all = readJson<PriceStore>(PRICE_KEY, {});
  if (all[catalogue]?.[itemId]) delete all[catalogue][itemId][field];
  writeJson(PRICE_KEY, all);
}

export function getCataloguePriceOverrides(catalogue: string): Record<string, Record<string, number>> {
  return readJson<PriceStore>(PRICE_KEY, {})[catalogue] ?? {};
}

/** Apply every saved price override for one catalogue onto its base rows —
 *  called once, at module load, by shopData.ts, so every existing reader
 *  of KIB_CANS/BOOTS_CATALOGUE/LIFESTYLE_ITEMS keeps working unchanged. */
export function applyPriceOverrides<T extends { id: string }>(catalogue: string, rows: readonly T[]): T[] {
  const overrides = getCataloguePriceOverrides(catalogue);
  if (Object.keys(overrides).length === 0) return [...rows];
  return rows.map(row => {
    const fields = overrides[row.id];
    if (!fields) return row;
    return { ...row, ...fields };
  });
}
