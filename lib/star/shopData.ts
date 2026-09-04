import type { Boot, OwnedItem } from "./types";
import { applyPriceOverrides } from "./tuningStore";
import { KIB_CANS_DEFAULT, BOOTS_CATALOGUE_DEFAULT, LIFESTYLE_ITEMS_DEFAULT } from "./shopDefaults";

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

/** Only `price` is editable at /star-tuning-dev — the stat boosts and
 *  durability are the boot's own identity, not a balance lever. */
export const BOOTS_CATALOGUE: Boot[] = applyPriceOverrides("boots", BOOTS_CATALOGUE_DEFAULT);

/** Only `price` is editable at /star-tuning-dev, same reasoning as boots
 *  above — `lifestyleValue` is what an item IS, not a price to tune. */
export const LIFESTYLE_ITEMS: OwnedItem[] = applyPriceOverrides("lifestyle", LIFESTYLE_ITEMS_DEFAULT);
