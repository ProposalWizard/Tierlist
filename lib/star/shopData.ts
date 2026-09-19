import type { Boot, OwnedItem } from "./types";
import { applyPriceOverrides } from "./tuningStore";
import {
  KIB_CANS_DEFAULT, STAT_KIB_CANS_DEFAULT, BOOTS_CATALOGUE_DEFAULT, LIFESTYLE_ITEMS_DEFAULT,
  PRICE_SPECS, shopTierOf, KIB_CAN_TIERS, STAT_CAN_TIERS,
} from "./shopDefaults";

/**
 * WHERE EACH ITEM SITS ON THE ONE CURVE.
 *
 * Re-exported through here rather than reached for in shopDefaults.ts
 * directly, for the same reason the catalogues themselves are: this file is
 * the shop's public face, and shopDefaults.ts is the un-overridden raw data
 * behind it. The shop UI groups the boots by `shopTierOf` and reads a
 * price back in weeks of the player's OWN income — which is the whole point
 * of pricing everything in weeks in the first place, and was previously a
 * number no screen could show because no screen had it.
 */
export { PRICE_SPECS, shopTierOf, KIB_CAN_TIERS, STAT_CAN_TIERS };

/**
 * KIB CANS.
 *
 * Restored — energy itself was rebuilt for real (a hard floor on selection,
 * regen only from a deliberate Rest/Skip choice, never automatic), and a can
 * is the third lever on top of those two: pay for a top-up rather than
 * spending one of the week's actions on it. Same three tiers and numbers the
 * old NRG Drinks shipped with; only the branding changed on request — "NRG"
 * to "KIB Cans" (KIB capitalised).
 */
export interface KibCan {
  id: "basic" | "premium" | "elite";
  name: string;
  price: number;
  restore: number;
  /** Flat-colour fallback, drawn until — or unless — `image` exists. */
  color: string;
  /** A real product shot, supplied directly (requested: "I can give you an
   *  image for each one"). Falls back to the flat `color` box via the
   *  image's own onError, same pattern TrialReward.tsx's contract art uses —
   *  drop the file in later and it upgrades automatically, no code change
   *  needed, and nothing breaks while it's still missing. */
  image: string;
}

/** Price and restore amount are both editable at /star-tuning-dev — see
 *  lib/star/tuningStore.ts's applyPriceOverrides. Everything else about a
 *  can (name, colour, art) stays fixed; those aren't game-balance numbers. */
export const KIB_CANS: KibCan[] = applyPriceOverrides("kibCans", KIB_CANS_DEFAULT);

/**
 * KIB STAT CANS — the same idea, a much bigger spend.
 *
 * Requested directly, alongside the energy cans above: "maybe even just
 * have 2 sets of cans, the normal ones going up in energy addition, and
 * then another set of those cans but costing WAYYY more and giving stat
 * boosts." A temporary boost to power AND technique — the two player
 * skills a boot already applies additively (see page.tsx's
 * effectivePower/effectiveTechnique) — for a handful of matches, then it
 * wears off. Deliberately a flat preset per tier rather than a user-picked
 * stat or a random one: the simplest version that still scales with can
 * quality the way asked ("+3, +5, etc").
 */
export interface StatKibCan {
  id: "basic" | "premium" | "elite";
  name: string;
  price: number;
  /** Added to BOTH power and technique while active. */
  boost: number;
  /** How many matches the boost lasts before it wears off. */
  matches: number;
  color: string;
  image: string;
}

export const STAT_KIB_CANS: StatKibCan[] = applyPriceOverrides("statKibCans", STAT_KIB_CANS_DEFAULT);

/**
 * Only `price` is editable at /star-tuning-dev — the stat boosts are the
 * boot's own identity, not a balance lever.
 *
 * `matches` is no longer typed in at all: it is DERIVED from the shipped
 * price (shopDefaults.ts, via economy.ts's `bootMatchesFor`), which is what
 * holds a boot's cost per match to a fixed small fraction of a week at
 * every tier. A price override here deliberately does NOT re-derive it —
 * the editor is for trying a price on for size, and silently changing how
 * long the boot lasts underneath the person doing that would make the
 * experiment unreadable. It does mean an overridden price is the one way
 * the cost-per-match invariant can be broken; that is a local, deliberate
 * act in a dev tool, and `tests/star/economy.mts` holds the shipped
 * catalogue to it.
 */
export const BOOTS_CATALOGUE: Boot[] = applyPriceOverrides("boots", BOOTS_CATALOGUE_DEFAULT);

/** Only `price` is editable at /star-tuning-dev, same reasoning as boots
 *  above — `lifestyleValue` is what an item IS, not a price to tune. */
export const LIFESTYLE_ITEMS: OwnedItem[] = applyPriceOverrides("lifestyle", LIFESTYLE_ITEMS_DEFAULT);
