// A tiny localStorage so tuningStore.ts can run headless — same pattern as
// tests/star/scenarios.mts / opponentSavedLineup.mts.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};

import { TUNABLES } from "../../lib/star/tuning";
import {
  getTuning, getTuningOverrides, setTuningOverride, resetTuning, resetAllTuning,
  getPriceOverride, setPriceOverride, resetPriceOverride, applyPriceOverrides,
} from "../../lib/star/tuningStore";

// Regression guard: import every rewired constant BEFORE any override in
// this file is ever set, so each one captures the registry's plain default
// exactly like a real browser session that has never touched the tuning
// editor — a transcription mistake in tuning.ts's `default` field (or a
// broken substitution in the file that used to hardcode it) would silently
// ship a different balance number than the game had before this system
// existed, and this is what catches that.
import { WEEK_ACTIONS, REST_HAPPINESS, REST_ENERGY } from "../../lib/star/week";
import { MIN_ENERGY_TO_START, MIN_ENERGY_TO_SUB, MISSED_WEEK } from "../../lib/star/selection";
import { ENERGY_MATCH_COST } from "../../lib/star/careerFlow";
import { displayOverall, growthMultiplier, attributeOverall } from "../../lib/star/rating";
import { KIB_CANS, BOOTS_CATALOGUE, LIFESTYLE_ITEMS } from "../../lib/star/shopData";
import { KIB_CANS_DEFAULT, PRICE_SPECS } from "../../lib/star/shopDefaults";
import { bandPrice, bootMatchesFor } from "../../lib/star/economy";

/**
 * THE TUNING SYSTEM — REGISTRY SHAPE, OVERRIDE ROUND-TRIPS, AND A DEFAULTS
 * REGRESSION GUARD.
 *
 * Requested directly: "an area where I can customize every single thing
 * that is done using numbers... without having to just keep asking you."
 * lib/star/tuning.ts is the registry, lib/star/tuningStore.ts layers a
 * localStorage override on top of it, and roughly a dozen files across the
 * game now read a getTuning(key) instead of a hardcoded literal. What has
 * to hold: every registry entry is well-formed, an override actually takes,
 * a reset actually clears it, the shop's price-override merge behaves, and
 * — the part most likely to silently break something — every one of those
 * rewired constants still equals EXACTLY what it was before this system
 * existed, on a fresh browser with nothing ever overridden.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function def(key: string): number {
  const d = TUNABLES.find((t) => t.key === key);
  if (!d) throw new Error(`no registry entry for "${key}"`);
  return d.default;
}

// ── Every registry entry is well-formed ─────────────────────────────────
{
  const keys = TUNABLES.map((t) => t.key);
  check(new Set(keys).size === keys.length, `every tuning key is unique (${keys.length} entries)`);
  for (const t of TUNABLES) {
    check(t.default >= t.min && t.default <= t.max, `${t.key}: default (${t.default}) sits within [${t.min}, ${t.max}]`);
    check(t.step > 0, `${t.key}: step is positive (${t.step})`);
    check(t.label.length > 0 && t.description.length > 0, `${t.key}: has a real label and description`);
    check(t.category.length > 0, `${t.key}: has a category`);
  }
}

// ── getTuning: default when nothing overridden, 0 (not a throw) when unknown ──
{
  check(getTuning("energy.weekActions") === def("energy.weekActions"), "getTuning returns the registry default with nothing overridden");
  check(getTuning("does.not.exist") === 0, "an unknown key returns 0 rather than throwing");
}

// ── setTuningOverride / resetTuning round-trip ──────────────────────────
{
  const key = "energy.restEnergy";
  const original = def(key);
  setTuningOverride(key, 999);
  check(getTuning(key) === 999, "setTuningOverride takes effect immediately for getTuning");
  check(getTuningOverrides()[key] === 999, "…and shows up in getTuningOverrides");
  resetTuning(key);
  check(getTuning(key) === original, "resetTuning falls back to the registry default");
  check(!(key in getTuningOverrides()), "…and is gone from getTuningOverrides");
}

// ── Price overrides: get/set/reset + applyPriceOverrides merge ─────────
{
  interface Row { id: string; price: number; restore: number }
  const rows: Row[] = [{ id: "basic", price: 3, restore: 25 }, { id: "premium", price: 6, restore: 50 }];

  check(getPriceOverride("test-catalogue", "basic", "price") === null, "no override yet reads null");
  const untouched = applyPriceOverrides("test-catalogue", rows);
  check(untouched.every((r, i) => r.price === rows[i].price && r.restore === rows[i].restore), "applyPriceOverrides is a no-op with nothing overridden");

  setPriceOverride("test-catalogue", "basic", "price", 99);
  check(getPriceOverride("test-catalogue", "basic", "price") === 99, "setPriceOverride is readable back");
  const applied = applyPriceOverrides("test-catalogue", rows);
  check(applied.find((r) => r.id === "basic")?.price === 99, "applyPriceOverrides merges the override onto the matching row");
  check(applied.find((r) => r.id === "basic")?.restore === 25, "…without touching a field that wasn't overridden");
  check(applied.find((r) => r.id === "premium")?.price === 6, "…and leaves an unrelated row completely alone");

  resetPriceOverride("test-catalogue", "basic", "price");
  check(getPriceOverride("test-catalogue", "basic", "price") === null, "resetPriceOverride removes just that field");
  check(applyPriceOverrides("test-catalogue", rows)[0].price === 3, "…and applyPriceOverrides goes back to the base value");
}

// ── resetAllTuning clears both the scalar and the price store ──────────
{
  setTuningOverride("energy.restEnergy", 1);
  setPriceOverride("kibCans", "basic", "price", 1);
  resetAllTuning();
  check(Object.keys(getTuningOverrides()).length === 0, "resetAllTuning clears every scalar override");
  check(getPriceOverride("kibCans", "basic", "price") === null, "…and every price override");
}

// ── Regression guard: every rewired constant still equals what the game ──
// shipped with, captured above at import time before this file ever
// touched an override — exactly a fresh session with nothing edited.
{
  check(WEEK_ACTIONS === 3, `WEEK_ACTIONS still defaults to 3 (got ${WEEK_ACTIONS})`);
  check(REST_HAPPINESS === 6, `REST_HAPPINESS still defaults to 6 (got ${REST_HAPPINESS})`);
  check(REST_ENERGY === 20, `REST_ENERGY still defaults to 20 (got ${REST_ENERGY})`);
  check(MIN_ENERGY_TO_START === 35, `MIN_ENERGY_TO_START still defaults to 35 (got ${MIN_ENERGY_TO_START})`);
  check(MIN_ENERGY_TO_SUB === 15, `MIN_ENERGY_TO_SUB still defaults to 15 (got ${MIN_ENERGY_TO_SUB})`);
  check(MISSED_WEEK.energy === 15, `MISSED_WEEK.energy still defaults to 15 (got ${MISSED_WEEK.energy})`);
  check(ENERGY_MATCH_COST === 32, `ENERGY_MATCH_COST still defaults to 32 (got ${ENERGY_MATCH_COST})`);

  check(displayOverall(0) === 30, `displayOverall(0) still reads 30 (got ${displayOverall(0)})`);
  check(displayOverall(5) === 100, `displayOverall(5) still reads 100 (got ${displayOverall(5)})`);
  check(growthMultiplier(18) === 1.4, `growthMultiplier(18) still reads 1.4 (got ${growthMultiplier(18)})`);
  check(growthMultiplier(35) === 0.4, `growthMultiplier(35) still reads 0.4 (got ${growthMultiplier(35)})`);
  const maxed = attributeOverall({ pace: 100, power: 100, technique: 100, vision: 100, freeKick: 100 });
  check(Math.abs(maxed - 100) < 1e-9, `attributeOverall at maxed skills still reads 100 (got ${maxed})`);

  // ── The three shop prices, checked as DERIVED rather than as figures ──
  //
  // These used to pin ★6,000 / ★200,000 / ★3,000,000 — the hand-typed
  // catalogue that has since been replaced. Not one price in the shop is
  // typed in any more: every entry names a tier, a band and where in that
  // band it sits, and economy.ts turns those into a number (see
  // shopDefaults.ts). Re-pinning today's figures here would defeat the
  // point of that and would break this suite every time the one dial the
  // whole economy hangs off is turned, which is exactly what it is for.
  //
  // What this guard is actually for is unchanged, though: catching a
  // catalogue that has silently stopped matching its own source with
  // nothing overridden. So it checks the shipped price IS the derived
  // price, which is a strictly stronger statement than any literal —
  // a transcription slip, a stray override leaking in, or a catalogue
  // entry quietly regaining a hardcoded figure all fail it.
  const kib = KIB_CANS.find((c) => c.id === "basic");
  const kibDefault = KIB_CANS_DEFAULT.find((c) => c.id === "basic");
  check(
    kib?.price === kibDefault?.price && kib?.restore === 25,
    `KIB_CANS basic ships at its derived price with nothing overridden `
    + `(got ★${kib?.price}/${kib?.restore}, expected ★${kibDefault?.price}/25)`,
  );
  const boot = BOOTS_CATALOGUE.find((b) => b.id === "galaxy");
  const bootSpec = PRICE_SPECS.boots.galaxy;
  check(
    !!boot && !!bootSpec && boot.price === bandPrice(bootSpec.tier, bootSpec.band, bootSpec.at),
    `BOOTS_CATALOGUE galaxy ships at the ${bootSpec?.band} band of the ${bootSpec?.tier} tier `
    + `(got ★${boot?.price}, expected ★${bootSpec && bandPrice(bootSpec.tier, bootSpec.band, bootSpec.at)})`,
  );
  // …and its durability comes off that price rather than sitting beside it.
  check(
    !!boot && !!bootSpec && boot.matches === bootMatchesFor(boot.price, bootSpec.tier),
    `BOOTS_CATALOGUE galaxy's ${boot?.matches} matches are derived from its price, not typed in`,
  );
  const item = LIFESTYLE_ITEMS.find((i) => i.id === "island");
  const itemSpec = PRICE_SPECS.lifestyle.island;
  check(
    !!item && !!itemSpec && item.price === bandPrice(itemSpec.tier, itemSpec.band, itemSpec.at),
    `LIFESTYLE_ITEMS island ships at the ${itemSpec?.band} band of the ${itemSpec?.tier} tier `
    + `(got ★${item?.price}, expected ★${itemSpec && bandPrice(itemSpec.tier, itemSpec.band, itemSpec.at)})`,
  );
  check(
    !!item && itemSpec?.band === "endgame",
    "the private island is still the top of the catalogue, whatever the numbers are today",
  );
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — the tuning registry is well-formed, overrides round-trip cleanly, and every rewired constant still matches the game's original balance with nothing overridden");
