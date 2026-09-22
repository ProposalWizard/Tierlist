import type { Boot, OwnedItem } from "./types";
import type { KibCan } from "./shopData";
import type { ShopTierId, PriceBandId } from "./economy";
import {
  bandPrice, tierPrice, bootMatchesFor,
  RATING_CONVERTER_WEEKS, RATING_CONVERTER_TIERS,
} from "./economy";

/**
 * THE RAW SHOP CATALOGUES — before any /star-tuning-dev price override.
 *
 * Split out from shopData.ts so the tuning editor has one real place to read
 * "what price did this item ship with" from (for its reset-to-default
 * button and its diff display) without duplicating the same literal array
 * a second time. shopData.ts imports these and wraps them in
 * applyPriceOverrides; nothing else should import from here directly.
 *
 * ── NOT ONE PRICE IN THIS FILE IS TYPED IN ANY MORE ──
 *
 * It used to be forty-odd hand-written absolute figures, and the complaint
 * that killed them was exact: "there's stuff in the store from all the way
 * up to 5K and nothing has changed in the store. There's no tiered items,
 * there's no change to the boots, nothing." Both halves were true. The
 * catalogue was a flat list with no grouping in the data and none in the UI,
 * and because every figure was independent of every income in the game,
 * "how many weeks of my money is this" was a question nobody could answer
 * anywhere — including the people setting the prices.
 *
 * Every entry below now names three things instead of a price:
 *
 *     tier   whose money it is priced against (economy.ts's SHOP_TIERS)
 *     band   how big a purchase it is         (economy.ts's PRICE_BANDS)
 *     at     where in that band it sits, 0-1
 *
 * and `bandPrice` turns those into a round number that is provably inside
 * the band it claims. Retuning the game's money is now editing economy.ts
 * and nothing else: every figure here moves with it, and the RATIOS — which
 * are the actual design — cannot drift, because they are the only thing
 * written down.
 *
 * `tests/star/economy.mts` walks every entry in this file and checks it.
 */

/** What an entry says about itself instead of naming a price. */
export interface PriceSpec {
  tier: ShopTierId;
  band: PriceBandId;
  /** 0 = the cheap end of that band at that tier, 1 = the dear end. */
  at: number;
}


// ═══════════════════════════════════════════════════════════════════════
//  KIB CANS
// ═══════════════════════════════════════════════════════════════════════

/**
 * The cans are the one thing in the shop that does NOT get cheaper as you
 * climb, so they are priced off `RATING_CONVERTER_WEEKS` rather than off a
 * band. See economy.ts: a consumable that converts money into rating has to
 * cost a rich player MORE of his week than it cost a poor one, or the late
 * game simply buys past the growth curve.
 *
 * Energy cans convert money into availability, which is the softer version
 * of the same thing, so they climb too — just more gently.
 */
export const KIB_CAN_TIERS = RATING_CONVERTER_TIERS.energy;

const canPrice = (which: "energy", i: number) =>
  tierPrice(RATING_CONVERTER_TIERS[which][i], RATING_CONVERTER_WEEKS[which][i]);

export const KIB_CANS_DEFAULT: KibCan[] = [
  { id: "basic", name: "Basic KIB Can", price: canPrice("energy", 0), restore: 25, color: "bg-orange-400", image: "/star/kib-basic.png" },
  { id: "premium", name: "Premium KIB Can", price: canPrice("energy", 1), restore: 50, color: "bg-blue-400", image: "/star/kib-premium.png" },
  { id: "elite", name: "Elite KIB Can", price: canPrice("energy", 2), restore: 100, color: "bg-purple-400", image: "/star/kib-elite.png" },
];


// ═══════════════════════════════════════════════════════════════════════
//  BOOTS
// ═══════════════════════════════════════════════════════════════════════

/**
 * THE BOOT LADDER — three-ish pairs per rung, weakest at the bottom.
 *
 * Every boot sits in the `upgrade` band of its own tier, which is what
 * makes the sentence "a pair of boots is the thing you save for" true at
 * every point in the career rather than only at one of them: roughly
 * twenty weeks of non-league income at the bottom, and a few weeks of
 * top-flight income at the top, for the boot that belongs to you at the
 * time.
 *
 * ── Why the `at` values climb within each tier and never overlap ──
 *
 * Each rung deliberately occupies a slice of its own band ABOVE the slice
 * the rung below it reached, so the catalogue reads as one strictly
 * ascending price list even though the five tiers' bands overlap in
 * absolute stars. Without that, NS-Flash (a better boot, a rung up) would
 * have undercut NS-Blast, which is the kind of thing a player notices
 * immediately and reads as a bug rather than as a band.
 *
 * ── `matches` is NOT typed in ──
 *
 * It is derived from the price by `bootMatchesFor` (economy.ts), which is
 * what keeps a boot's cost PER MATCH a fixed small fraction of a week at
 * every tier. The old catalogue had price spanning 80× against durability
 * spanning 3×, which made the cheapest boots in the game cost about three
 * weeks' wages per match — unaffordable exactly where affordability was the
 * whole point. See BOOT_WEEKS_PER_MATCH for the full account, including why
 * cheap boots now last far longer than dear ones.
 */
interface BootSpec {
  id: string;
  name: string;
  pace: number;
  power: number;
  technique: number;
  tier: ShopTierId;
  /** Where in this tier's `upgrade` band it sits, 0-1. */
  at: number;
  curve?: boolean;
  extraTouch?: boolean;
  /** Hand-set durability, overriding the price-derived one. Set directly by
   *  the owners (21 Sep 2026): the lower three tiers lasted far too long. */
  matches?: number;
  /** Multiplies the band price — used once, to make NS-Pure a genuinely
   *  affordable first pair ("one of the boots should cost about half"). */
  priceFactor?: number;
}

const BOOT_SPECS: BootSpec[] = [
  // ── Starter: non-league money. One pair, saved for, worn for two seasons.
  { id: "starter", name: "NS-Pure", pace: 5, power: 5, technique: 5, tier: "starter", at: 0.15, priceFactor: 0.5, matches: 35 },
  { id: "control", name: "NS-Control", pace: 5, power: 5, technique: 10, tier: "starter", at: 0.55, matches: 30 },
  { id: "attacker", name: "NS-Blast", pace: 10, power: 10, technique: 5, tier: "starter", at: 1, matches: 30 },

  // ── Semi-Pro: League Two money.
  { id: "speed", name: "NS-Flash", pace: 10, power: 5, technique: 10, tier: "semi_pro", at: 0.45, matches: 25 },
  { id: "power", name: "NS-Thunder", pace: 5, power: 10, technique: 10, tier: "semi_pro", at: 0.7, matches: 30 },

  // ── Pro: League One money.
  { id: "elite", name: "NS-Elite", pace: 10, power: 10, technique: 10, tier: "pro", at: 0.45, matches: 14 },
  { id: "pro", name: "NS-Pro", pace: 15, power: 15, technique: 10, tier: "pro", at: 0.7, matches: 17 },
  { id: "legend", name: "NS-Legend", pace: 15, power: 15, technique: 15, tier: "pro", at: 1, matches: 20 },

  // ── Elite: Championship money.
  { id: "meteor", name: "NS-Meteor", pace: 20, power: 15, technique: 15, tier: "elite", at: 0.55 },
  { id: "vapor", name: "NS-Vapor", pace: 15, power: 20, technique: 20, tier: "elite", at: 1 },

  // ── World Class: top-flight money.
  { id: "phantom", name: "NS-Phantom", pace: 20, power: 20, technique: 20, tier: "world_class", at: 0.55 },
  { id: "galaxy", name: "NS-Galaxy", pace: 25, power: 25, technique: 25, tier: "world_class", at: 0.8 },
  // Both of these are a whole extra ability rather than a stat boost (curve
  // for NS-Swerve, Touch Mode for NS-Maestro — see Boot.curve/extraTouch and
  // CanvasMatch.tsx), so both sit at the top of world_class's own band
  // instead of on the stat-per-star curve the rest follow — tied for the
  // most any boot in this game can cost without leaving the band boots
  // live in. Moved up from Semi-Pro (23 Sep 2026): "the NS-Swerve boots
  // should be worth the same as the NS-Maestro boots."
  { id: "curl", name: "NS-Swerve", pace: 5, power: 5, technique: 10, tier: "world_class", at: 1, curve: true, matches: 15 },
  { id: "maestro", name: "NS-Maestro", pace: 20, power: 20, technique: 30, tier: "world_class", at: 1, extraTouch: true },
];

export const BOOTS_CATALOGUE_DEFAULT: Boot[] = BOOT_SPECS.map((spec) => {
  const band = bandPrice(spec.tier, "upgrade", spec.at);
  const price = spec.priceFactor ? Math.round((band * spec.priceFactor) / 5) * 5 : band;
  return {
    id: spec.id,
    name: spec.name,
    pace: spec.pace,
    power: spec.power,
    technique: spec.technique,
    matches: spec.matches ?? bootMatchesFor(price, spec.tier),
    price,
    ...(spec.curve ? { curve: true } : {}),
    ...(spec.extraTouch ? { extraTouch: true } : {}),
  };
});

// ═══════════════════════════════════════════════════════════════════════
//  LIFESTYLE
// ═══════════════════════════════════════════════════════════════════════

/**
 * A PHONE AND A PRIVATE ISLAND ON ONE LADDER.
 *
 * Lifestyle is the widest catalogue in the game — a factor of ten thousand
 * from the first item to the last — and it is the one place the four bands
 * alone are not a dense enough ladder, because the gap between the top of
 * `consumable` and the bottom of `upgrade` is a twentyfold jump with
 * nothing in it.
 *
 * What fills it is the OTHER axis. A band at a different tier is a
 * different price: the `consumable` band runs ★16-30 at starter money and
 * ★60-125 at top-flight money, so walking up the tiers inside one band
 * gives a smooth ramp without inventing a fifth band for it. That is why an
 * early item can be anchored at `world_class` — it is not a claim about who
 * buys a Tablet, it is which slice of the ladder its price belongs in.
 *
 * Within each of the three categories the prices ascend strictly with
 * `lifestyleValue`, which `tests/star/economy.mts` checks — a list where a
 * better item is cheaper reads as a bug however defensible the band was.
 */
interface LifestyleSpec {
  id: string;
  name: string;
  category: OwnedItem["category"];
  lifestyleValue: number;
  tier: ShopTierId;
  band: PriceBandId;
  at: number;
}

/**
 * ── FOUR ENTRIES RE-TIERED, 19 Sep 2026: a latent bug the sharper top rungs
 *    exposed rather than caused ──
 *
 * `tests/star/economy.mts` holds one rule over every catalogue: within a
 * category, a thing worth more must not cost less. Four entries were
 * breaking it and had been for as long as they have existed — they only
 * passed while the wage ladder was a single flat multiple, where the
 * numbers happened to land the right way round.
 *
 * `DIVISION_STEP_INTO` then made the Championship and Premier League rungs
 * steeper, which lifted every `elite` and `world_class` price with them and
 * left `starter`/`semi_pro`/`pro` exactly where they were. The four
 * inversions fell out immediately:
 *
 *   Mansion       LV100, priced at `pro` — the best house in the game on
 *                 League One money, ★108,000 against a ★221,000 Beach Villa
 *                 worth a quarter as much. Now `elite`, ★280,000, which
 *                 sits properly between the villa and the Country Estate.
 *   Classic Car   LV42 at ★110,000 against a ★151,000 LV30 Sports Car.
 *                 Same band and tier, moved to the top of its band.
 *   Tablet        LV8, and Music Player LV6, were both anchored to
 *                 top-flight money — ★825 and ★600, above a ★650 LV9
 *                 Smartwatch. A tablet and a music player are not
 *                 Premier-League-money objects; both moved to `elite`.
 *
 * None of this is a tuning preference. Each one was a thing that cost more
 * and did less, which is a strictly dominated choice and the one shape a
 * shop must never contain.
 */
const LIFESTYLE_SPECS: LifestyleSpec[] = [
  // ── Items ────────────────────────────────────────────────────────────
  { id: "phone", name: "Phone", category: "item", lifestyleValue: 3, tier: "starter", band: "consumable", at: 0.5 },
  { id: "console", name: "Games Console", category: "item", lifestyleValue: 5, tier: "pro", band: "consumable", at: 0.3 },
  // Priced identically to the Games Console above, on purpose: the two are
  // worth exactly the same `lifestyleValue`, and charging more for one of
  // them would make it strictly dominated — a worse buy in every respect,
  // which is the one thing a catalogue must never contain. Same money, same
  // bump, pick whichever you like the look of.
  { id: "headphones", name: "Headphones", category: "item", lifestyleValue: 5, tier: "pro", band: "consumable", at: 0.3 },
  { id: "music", name: "Music Player", category: "item", lifestyleValue: 6, tier: "elite", band: "consumable", at: 0.5 },
  { id: "tablet", name: "Tablet", category: "item", lifestyleValue: 8, tier: "elite", band: "consumable", at: 1 },
  { id: "smartwatch", name: "Smartwatch", category: "item", lifestyleValue: 9, tier: "starter", band: "upgrade", at: 0 },
  { id: "tv", name: "TV", category: "item", lifestyleValue: 10, tier: "starter", band: "upgrade", at: 0.3 },
  { id: "gaming-pc", name: "Gaming PC", category: "item", lifestyleValue: 11, tier: "starter", band: "upgrade", at: 0.6 },
  { id: "suit", name: "Designer Suit", category: "item", lifestyleValue: 12, tier: "starter", band: "upgrade", at: 0.95 },
  { id: "silver", name: "Silver Chain", category: "item", lifestyleValue: 14, tier: "semi_pro", band: "upgrade", at: 0.5 },
  { id: "art", name: "Art Piece", category: "item", lifestyleValue: 18, tier: "pro", band: "upgrade", at: 0.35 },
  { id: "gold", name: "Gold Watch", category: "item", lifestyleValue: 20, tier: "pro", band: "upgrade", at: 0.9 },
  { id: "diamond", name: "Diamond Necklace", category: "item", lifestyleValue: 40, tier: "semi_pro", band: "aspirational", at: 0 },
  { id: "rolex", name: "Diamond Rolex", category: "item", lifestyleValue: 62, tier: "pro", band: "aspirational", at: 0.1 },

  // ── Vehicles ─────────────────────────────────────────────────────────
  { id: "bike", name: "Motorbike", category: "vehicle", lifestyleValue: 4, tier: "starter", band: "upgrade", at: 0.15 },
  { id: "car-1", name: "Family Car", category: "vehicle", lifestyleValue: 5, tier: "semi_pro", band: "upgrade", at: 0.15 },
  { id: "car-2", name: "Hatchback", category: "vehicle", lifestyleValue: 12, tier: "pro", band: "upgrade", at: 0.5 },
  { id: "suv", name: "Luxury SUV", category: "vehicle", lifestyleValue: 22, tier: "elite", band: "aspirational", at: 0 },
  { id: "car-3", name: "Sports Car", category: "vehicle", lifestyleValue: 30, tier: "world_class", band: "aspirational", at: 0.2 },
  { id: "classic", name: "Classic Car", category: "vehicle", lifestyleValue: 42, tier: "pro", band: "endgame", at: 1 },
  { id: "car-4", name: "Supercar", category: "vehicle", lifestyleValue: 60, tier: "elite", band: "endgame", at: 0.1 },
  { id: "jet", name: "Private Jet", category: "vehicle", lifestyleValue: 120, tier: "world_class", band: "endgame", at: 0.6 },

  // ── Property ─────────────────────────────────────────────────────────
  { id: "flat-1", name: "Studio Flat", category: "property", lifestyleValue: 10, tier: "pro", band: "upgrade", at: 1 },
  { id: "flat-2", name: "City Apartment", category: "property", lifestyleValue: 25, tier: "semi_pro", band: "aspirational", at: 0.1 },
  { id: "penthouse", name: "Penthouse", category: "property", lifestyleValue: 40, tier: "pro", band: "aspirational", at: 0.5 },
  { id: "stable", name: "Horse Stable", category: "property", lifestyleValue: 45, tier: "elite", band: "aspirational", at: 0.5 },
  { id: "house-1", name: "Suburban House", category: "property", lifestyleValue: 55, tier: "world_class", band: "aspirational", at: 0.6 },
  { id: "villa", name: "Beach Villa", category: "property", lifestyleValue: 75, tier: "world_class", band: "aspirational", at: 1 },
  { id: "house-2", name: "Mansion", category: "property", lifestyleValue: 100, tier: "elite", band: "endgame", at: 0 },
  { id: "estate", name: "Country Estate", category: "property", lifestyleValue: 140, tier: "elite", band: "endgame", at: 0.5 },
  { id: "island", name: "Private Island", category: "property", lifestyleValue: 250, tier: "world_class", band: "endgame", at: 1 },
];

export const LIFESTYLE_ITEMS_DEFAULT: OwnedItem[] = LIFESTYLE_SPECS.map((spec) => {
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    price: bandPrice(spec.tier, spec.band, spec.at),
    lifestyleValue: spec.lifestyleValue,
  };
});

/** Every catalogue's specs, by item id — the tiering the shop UI groups on
 *  and the thing `tests/star/economy.mts` holds every price to. Built from
 *  the same spec arrays the prices themselves come from, so the two can
 *  never disagree about which band an entry was priced in. */
export const PRICE_SPECS: Record<string, Record<string, PriceSpec>> = {
  boots: Object.fromEntries(
    BOOT_SPECS.map((s) => [s.id, { tier: s.tier, band: "upgrade" as PriceBandId, at: s.at }]),
  ),
  lifestyle: Object.fromEntries(
    LIFESTYLE_SPECS.map((s) => [s.id, { tier: s.tier, band: s.band, at: s.at }]),
  ),
};

/** Which tier an item belongs to, for the shop's own grouping. Falls back
 *  to the cheapest tier for an id the catalogue no longer has — a saved
 *  career can be carrying an item that has since been renamed away. */
export function shopTierOf(catalogue: "boots" | "lifestyle", id: string): ShopTierId {
  return PRICE_SPECS[catalogue]?.[id]?.tier ?? "starter";
}
