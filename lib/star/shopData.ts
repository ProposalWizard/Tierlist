import type { Boot, OwnedItem } from "./types";
import { applyPriceOverrides } from "./tuningStore";
import {
  KIB_CANS_DEFAULT, BOOTS_CATALOGUE_DEFAULT, LIFESTYLE_ITEMS_DEFAULT,
  PRICE_SPECS, shopTierOf, KIB_CAN_TIERS,
} from "./shopDefaults";
import { KIB_CAN_WAGE_WEEKS, WAGE_FLOOR } from "./economy";

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
export { PRICE_SPECS, shopTierOf, KIB_CAN_TIERS };

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
  /**
   * A can that gives a boot ability instead of energy (owners, 23 Sep 2026):
   * Premium gives NS-Swerve's curve, Elite gives NS-Maestro's Touch Mode, for
   * the next match you actually play. Absent: an energy can (`restore`).
   */
  effect?: "curve" | "extraTouch";
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

/** What a can does, in the words the shop and dashboard show. */
export function kibCanEffectLabel(can: KibCan): string {
  if (can.effect === "curve") return "Swerve boots' curve for your next match";
  if (can.effect === "extraTouch") return "Touch boots' extra touch for your next match";
  return `+${can.restore} energy`;
}


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

/**
 * WHAT A CAN COSTS YOU — a slice of your OWN weekly wage (owners, 21 Sep
 * 2026: "the more your wage increases, the more the cans are priced at, so
 * they're always worth something"). A National League player on ★25 a week
 * pays about ★12 for a Basic; a Premier League star pays thousands. The
 * catalogue's own `price` is only the fallback before a contract exists.
 */
export function kibCanPrice(can: KibCan, weeklyWage: number): number {
  const wage = Math.max(WAGE_FLOOR, weeklyWage || 0);
  return Math.max(1, Math.round(wage * KIB_CAN_WAGE_WEEKS[can.id]));
}
