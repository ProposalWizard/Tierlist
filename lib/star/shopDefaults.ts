import type { Boot, OwnedItem } from "./types";
import type { KibCan } from "./shopData";

/**
 * THE RAW SHOP CATALOGUES — before any /star-tuning-dev price override.
 *
 * Split out from shopData.ts so the tuning editor has one real place to read
 * "what price did this item ship with" from (for its reset-to-default
 * button and its diff display) without duplicating the same literal array
 * a second time. shopData.ts imports these and wraps them in
 * applyPriceOverrides; nothing else should import from here directly.
 */

// Prices below are in real money, on the same personal-spending scale as
// careerFlow.ts's starting money/wage (rescaled 14 Sep 2026) — every price
// here is its pre-rescale value × 2000, the same multiplier that took the
// starting wage from ★1 to ★2000/week. That keeps how many weeks' wage each
// item costs completely unchanged (a can is still a small weekly buy, a
// private island is still a career-defining splurge), just expressed in
// real money instead of small placeholder numbers. Personal spending uses a
// much smaller multiplier than club-level money (transfer fees, club
// valuations) because a real footballer's own wallet — even a legend's — is
// nowhere near a club's finances.
export const KIB_CANS_DEFAULT: KibCan[] = [
  { id: "basic", name: "Basic KIB Can", price: 6000, restore: 25, color: "bg-orange-400", image: "/star/kib-basic.png" },
  { id: "premium", name: "Premium KIB Can", price: 12000, restore: 50, color: "bg-blue-400", image: "/star/kib-premium.png" },
  { id: "elite", name: "Elite KIB Can", price: 24000, restore: 100, color: "bg-purple-400", image: "/star/kib-elite.png" },
];

export const BOOTS_CATALOGUE_DEFAULT: Boot[] = [
  { id: "starter", name: "NS-Pure", pace: 5, power: 5, technique: 5, matches: 3, price: 6000 },
  { id: "attacker", name: "NS-Blast", pace: 10, power: 10, technique: 5, matches: 5, price: 10000 },
  { id: "control", name: "NS-Control", pace: 5, power: 5, technique: 10, matches: 5, price: 10000 },
  { id: "speed", name: "NS-Flash", pace: 10, power: 5, technique: 10, matches: 5, price: 20000 },
  { id: "power", name: "NS-Thunder", pace: 5, power: 10, technique: 10, matches: 5, price: 20000 },
  // Not a stat boost — a whole extra ability. Priced against NS-Elite/NS-Pro
  // (similar matches, similar power/technique) rather than against the pure
  // stat-per-star curve the rest of the catalogue follows.
  { id: "curl", name: "NS-Swerve", pace: 5, power: 5, technique: 10, matches: 6, price: 40000, curve: true },
  { id: "elite", name: "NS-Elite", pace: 10, power: 10, technique: 10, matches: 7, price: 30000 },
  { id: "pro", name: "NS-Pro", pace: 15, power: 15, technique: 10, matches: 7, price: 30000 },
  { id: "legend", name: "NS-Legend", pace: 15, power: 15, technique: 15, matches: 7, price: 50000 },
  { id: "meteor", name: "NS-Meteor", pace: 20, power: 15, technique: 15, matches: 8, price: 70000 },
  { id: "vapor", name: "NS-Vapor", pace: 15, power: 20, technique: 20, matches: 8, price: 80000 },
  { id: "phantom", name: "NS-Phantom", pace: 20, power: 20, technique: 20, matches: 10, price: 120000 },
  { id: "galaxy", name: "NS-Galaxy", pace: 25, power: 25, technique: 25, matches: 10, price: 200000 },
];

export const LIFESTYLE_ITEMS_DEFAULT: OwnedItem[] = [
  { id: "phone", name: "Phone", category: "item", price: 10000, lifestyleValue: 3 },
  { id: "console", name: "Games Console", category: "item", price: 20000, lifestyleValue: 5 },
  { id: "headphones", name: "Headphones", category: "item", price: 24000, lifestyleValue: 5 },
  { id: "music", name: "Music Player", category: "item", price: 30000, lifestyleValue: 6 },
  { id: "tablet", name: "Tablet", category: "item", price: 40000, lifestyleValue: 8 },
  { id: "smartwatch", name: "Smartwatch", category: "item", price: 44000, lifestyleValue: 9 },
  { id: "tv", name: "TV", category: "item", price: 50000, lifestyleValue: 10 },
  { id: "gaming-pc", name: "Gaming PC", category: "item", price: 56000, lifestyleValue: 11 },
  { id: "suit", name: "Designer Suit", category: "item", price: 60000, lifestyleValue: 12 },
  { id: "silver", name: "Silver Chain", category: "item", price: 70000, lifestyleValue: 14 },
  { id: "art", name: "Art Piece", category: "item", price: 90000, lifestyleValue: 18 },
  { id: "gold", name: "Gold Watch", category: "item", price: 100000, lifestyleValue: 20 },
  { id: "diamond", name: "Diamond Necklace", category: "item", price: 200000, lifestyleValue: 40 },
  { id: "rolex", name: "Diamond Rolex", category: "item", price: 320000, lifestyleValue: 62 },

  { id: "bike", name: "Motorbike", category: "vehicle", price: 20000, lifestyleValue: 4 },
  { id: "car-1", name: "Family Car", category: "vehicle", price: 30000, lifestyleValue: 5 },
  { id: "car-2", name: "Hatchback", category: "vehicle", price: 80000, lifestyleValue: 12 },
  { id: "suv", name: "Luxury SUV", category: "vehicle", price: 140000, lifestyleValue: 22 },
  { id: "car-3", name: "Sports Car", category: "vehicle", price: 200000, lifestyleValue: 30 },
  { id: "classic", name: "Classic Car", category: "vehicle", price: 300000, lifestyleValue: 42 },
  { id: "car-4", name: "Supercar", category: "vehicle", price: 500000, lifestyleValue: 60 },
  { id: "jet", name: "Private Jet", category: "vehicle", price: 1200000, lifestyleValue: 120 },

  { id: "flat-1", name: "Studio Flat", category: "property", price: 60000, lifestyleValue: 10 },
  { id: "flat-2", name: "City Apartment", category: "property", price: 160000, lifestyleValue: 25 },
  { id: "penthouse", name: "Penthouse", category: "property", price: 280000, lifestyleValue: 40 },
  { id: "stable", name: "Horse Stable", category: "property", price: 300000, lifestyleValue: 45 },
  { id: "house-1", name: "Suburban House", category: "property", price: 400000, lifestyleValue: 55 },
  { id: "villa", name: "Beach Villa", category: "property", price: 640000, lifestyleValue: 75 },
  { id: "house-2", name: "Mansion", category: "property", price: 1000000, lifestyleValue: 100 },
  { id: "estate", name: "Country Estate", category: "property", price: 1500000, lifestyleValue: 140 },
  { id: "island", name: "Private Island", category: "property", price: 3000000, lifestyleValue: 250 },
];
