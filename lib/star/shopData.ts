import type { Boot, OwnedItem } from "./types";

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

export const KIB_CANS: KibCan[] = [
  { id: "basic", name: "Basic KIB Can", price: 3, restore: 25, color: "bg-orange-400", image: "/star/kib-basic.png" },
  { id: "premium", name: "Premium KIB Can", price: 6, restore: 50, color: "bg-purple-400", image: "/star/kib-premium.png" },
  { id: "elite", name: "Elite KIB Can", price: 12, restore: 100, color: "bg-emerald-400", image: "/star/kib-elite.png" },
];

export const BOOTS_CATALOGUE: Boot[] = [
  { id: "starter", name: "NS-Pure", pace: 5, power: 5, technique: 5, matches: 3, price: 3 },
  { id: "attacker", name: "NS-Blast", pace: 10, power: 10, technique: 5, matches: 5, price: 5 },
  { id: "control", name: "NS-Control", pace: 5, power: 5, technique: 10, matches: 5, price: 5 },
  { id: "speed", name: "NS-Flash", pace: 10, power: 5, technique: 10, matches: 5, price: 10 },
  { id: "power", name: "NS-Thunder", pace: 5, power: 10, technique: 10, matches: 5, price: 10 },
  { id: "elite", name: "NS-Elite", pace: 10, power: 10, technique: 10, matches: 7, price: 15 },
  { id: "pro", name: "NS-Pro", pace: 15, power: 15, technique: 10, matches: 7, price: 15 },
  { id: "legend", name: "NS-Legend", pace: 15, power: 15, technique: 15, matches: 7, price: 25 },
  { id: "meteor", name: "NS-Meteor", pace: 20, power: 15, technique: 15, matches: 8, price: 35 },
  { id: "vapor", name: "NS-Vapor", pace: 15, power: 20, technique: 20, matches: 8, price: 40 },
  { id: "phantom", name: "NS-Phantom", pace: 20, power: 20, technique: 20, matches: 10, price: 60 },
  { id: "galaxy", name: "NS-Galaxy", pace: 25, power: 25, technique: 25, matches: 10, price: 100 },
];

export const LIFESTYLE_ITEMS: OwnedItem[] = [
  { id: "phone", name: "Phone", category: "item", price: 5, lifestyleValue: 3 },
  { id: "console", name: "Games Console", category: "item", price: 10, lifestyleValue: 5 },
  { id: "headphones", name: "Headphones", category: "item", price: 12, lifestyleValue: 5 },
  { id: "music", name: "Music Player", category: "item", price: 15, lifestyleValue: 6 },
  { id: "tablet", name: "Tablet", category: "item", price: 20, lifestyleValue: 8 },
  { id: "smartwatch", name: "Smartwatch", category: "item", price: 22, lifestyleValue: 9 },
  { id: "tv", name: "TV", category: "item", price: 25, lifestyleValue: 10 },
  { id: "gaming-pc", name: "Gaming PC", category: "item", price: 28, lifestyleValue: 11 },
  { id: "suit", name: "Designer Suit", category: "item", price: 30, lifestyleValue: 12 },
  { id: "silver", name: "Silver Chain", category: "item", price: 35, lifestyleValue: 14 },
  { id: "art", name: "Art Piece", category: "item", price: 45, lifestyleValue: 18 },
  { id: "gold", name: "Gold Watch", category: "item", price: 50, lifestyleValue: 20 },
  { id: "diamond", name: "Diamond Necklace", category: "item", price: 100, lifestyleValue: 40 },
  { id: "rolex", name: "Diamond Rolex", category: "item", price: 160, lifestyleValue: 62 },

  { id: "bike", name: "Motorbike", category: "vehicle", price: 10, lifestyleValue: 4 },
  { id: "car-1", name: "Family Car", category: "vehicle", price: 15, lifestyleValue: 5 },
  { id: "car-2", name: "Hatchback", category: "vehicle", price: 40, lifestyleValue: 12 },
  { id: "suv", name: "Luxury SUV", category: "vehicle", price: 70, lifestyleValue: 22 },
  { id: "car-3", name: "Sports Car", category: "vehicle", price: 100, lifestyleValue: 30 },
  { id: "classic", name: "Classic Car", category: "vehicle", price: 150, lifestyleValue: 42 },
  { id: "car-4", name: "Supercar", category: "vehicle", price: 250, lifestyleValue: 60 },
  { id: "jet", name: "Private Jet", category: "vehicle", price: 600, lifestyleValue: 120 },

  { id: "flat-1", name: "Studio Flat", category: "property", price: 30, lifestyleValue: 10 },
  { id: "flat-2", name: "City Apartment", category: "property", price: 80, lifestyleValue: 25 },
  { id: "penthouse", name: "Penthouse", category: "property", price: 140, lifestyleValue: 40 },
  { id: "stable", name: "Horse Stable", category: "property", price: 150, lifestyleValue: 45 },
  { id: "house-1", name: "Suburban House", category: "property", price: 200, lifestyleValue: 55 },
  { id: "villa", name: "Beach Villa", category: "property", price: 320, lifestyleValue: 75 },
  { id: "house-2", name: "Mansion", category: "property", price: 500, lifestyleValue: 100 },
  { id: "estate", name: "Country Estate", category: "property", price: 750, lifestyleValue: 140 },
  { id: "island", name: "Private Island", category: "property", price: 1500, lifestyleValue: 250 },
];
