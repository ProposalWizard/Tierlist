/**
 * WHAT EACH LEVEL OF A STYLE ITEM IS CALLED — display only.
 *
 * Harry, 30 Sep 2026 (review of Mikey v0.7): "Sports car for 5k, like what is
 * a level one sports car? … broken down motorbike, normal car, Tesla, sports
 * car, Lamborghini … instead of L1, L2, L3." Every item already comes in five
 * levels (shopDefaults.ts); this gives each level its own real name, so a
 * level 1 Sports Car reads as "Rusty Kit Car", not "Sports Car L1".
 *
 * Nothing here touches a price, a fame number or an id. Saves store items by
 * id ("car-3", "car-3-l1"…) and keep working; the name a save stored is
 * ignored in favour of the one below. No real brand names, on purpose.
 *
 * The shop groups are also display only: the data still has three categories
 * (item / vehicle / property). "Holiday" is Harry's own grouping (p7): the
 * private jet, the beach villa and the private island.
 */
import type { OwnedItem } from "./types";
import { ownedFame } from "./fame";

/** Five names per item, level 1 → level 5. */
export const LEVEL_NAMES: Record<string, [string, string, string, string, string]> = {
  // ── Drip (seen in public) ──
  suit: ["Charity-Shop Blazer", "High-Street Suit", "Tailored Suit", "Designer Suit", "Gold-Thread Suit"],
  silver: ["Thin Chain", "Silver Chain", "Thick Silver Chain", "Heavy Link Chain", "Iced-Out Chain"],
  gold: ["Steel Watch", "Gold-Plated Watch", "Solid Gold Watch", "Gold Chronograph", "Diamond-Bezel Watch"],
  rolex: ["Crystal Dial Watch", "Diamond Dial Watch", "Iced Bezel Watch", "Fully Iced Watch", "One-of-One Watch"],
  diamond: ["Crystal Pendant", "Diamond Pendant", "Diamond Necklace", "Diamond Collar", "Rare Pink Diamond"],
  art: ["Poster Print", "Framed Print", "Original Painting", "Gallery Piece", "Old Master"],
  // ── Gadgets (for you) ──
  phone: ["Old Brick Phone", "Flip Phone", "Smartphone", "Pro Smartphone", "Gold Smartphone"],
  console: ["Retro Handheld", "Second-Hand Console", "New Console", "Pro Console", "Gold Edition Console"],
  headphones: ["Cheap Earbuds", "Wired Headphones", "Wireless Headphones", "Studio Headphones", "Diamond Headphones"],
  music: ["Pocket Radio", "Music Player", "Bluetooth Speaker", "Hi-Fi Stack", "Home Studio"],
  tablet: ["Hand-Me-Down Tablet", "Basic Tablet", "Big-Screen Tablet", "Pro Tablet + Pen", "Gold Tablet"],
  smartwatch: ["Digital Watch", "Fitness Band", "Smartwatch", "Pro Smartwatch", "Titanium Smartwatch"],
  tv: ["Old Box TV", "Flat TV", "Big Smart TV", "Wall-Sized TV", "Home Cinema"],
  "gaming-pc": ["Old Laptop", "Gaming Laptop", "Gaming PC", "Glowing Battle Station", "Streaming Studio"],
  // ── Cars ──
  bike: ["Rusty Moped", "Scooter", "Road Bike", "Superbike", "Custom Chopper"],
  "car-1": ["Old Banger", "Family Estate", "Electric Saloon", "Executive Saloon", "Stretch Limo"],
  "car-2": ["Battered Hatchback", "City Hatchback", "Electric Hatchback", "Hot Hatch", "Rally Hatch"],
  suv: ["Muddy 4x4", "Family SUV", "Electric SUV", "Luxury SUV", "Six-Wheel SUV"],
  "car-3": ["Rusty Kit Car", "Used Coupé", "Sports Car", "Twin-Turbo GT", "Track Racer"],
  classic: ["Barn-Find Classic", "Classic Saloon", "Classic Roadster", "Vintage Racer", "Museum Classic"],
  "car-4": ["Second-Hand Supercar", "Supercar", "Open-Top Supercar", "Hypercar", "One-Off Hypercar"],
  // ── Homes ──
  // Climbs in size, not just polish (Harry, 1 Oct 2026: level 5 was still
  // "a studio" at ★263k, dearer than a two-bed apartment).
  "flat-1": ["Box Room", "Studio Flat", "One-Bed Flat", "Loft Conversion", "Riverside Loft"],
  "flat-2": ["Shared Flat", "City Apartment", "Two-Bed Apartment", "Duplex Apartment", "Sky Apartment"],
  penthouse: ["Top-Floor Flat", "Penthouse", "Roof-Terrace Penthouse", "Sky Penthouse", "Tower-Top Penthouse"],
  stable: ["Rented Paddock", "Small Stable", "Horse Stable", "Riding Centre", "Racing Stud"],
  "house-1": ["Terraced House", "Semi-Detached House", "Detached House", "Gated House", "Executive Home"],
  "house-2": ["Old Manor", "Mansion", "Gated Mansion", "Mega Mansion", "Palace"],
  estate: ["Farmhouse", "Country House", "Country Estate", "Manor Estate", "Castle Estate"],
  // ── Holiday ──
  jet: ["Light Aircraft", "Helicopter", "Small Jet", "Business Jet", "Private Airliner"],
  villa: ["Beach Hut", "Seaside Cottage", "Beach Villa", "Cliff-Top Villa", "Infinity-Pool Villa"],
  island: ["Sandbank", "Small Island", "Private Island", "Island Resort", "Island Chain"],
};

/** The item's own family name, where the data's one names a real brand. */
const FAMILY_NAME: Record<string, string> = { rolex: "Iced Watch" };

export type StyleGroup = "drip" | "gadgets" | "cars" | "homes" | "holiday";

export const STYLE_GROUPS: { id: StyleGroup; label: string; note: string }[] = [
  { id: "drip", label: "Drip", note: "Seen in public — this is where fame comes from." },
  { id: "gadgets", label: "Gadgets", note: "Less fame than drip — these are for you, not the cameras." },
  { id: "cars", label: "Cars", note: "Every level is a different car." },
  { id: "homes", label: "Homes", note: "Homes never wear out." },
  { id: "holiday", label: "Holiday", note: "Getting away — a jet, a villa, an island." },
];

const GROUP_OF: Record<string, StyleGroup> = {
  suit: "drip", silver: "drip", gold: "drip", rolex: "drip", diamond: "drip", art: "drip",
  phone: "gadgets", console: "gadgets", headphones: "gadgets", music: "gadgets", tablet: "gadgets",
  smartwatch: "gadgets", tv: "gadgets", "gaming-pc": "gadgets",
  jet: "holiday", villa: "holiday", island: "holiday",
};

export function styleGroupOf(item: Pick<OwnedItem, "id" | "baseId" | "category">): StyleGroup {
  const base = item.baseId ?? item.id;
  if (GROUP_OF[base]) return GROUP_OF[base];
  if (item.category === "vehicle") return "cars";
  if (item.category === "property") return "homes";
  return "gadgets";
}

/** The name to show for one level of one item. Falls back to the stored name. */
export function levelName(item: Pick<OwnedItem, "id" | "baseId" | "name" | "level">): string {
  const base = item.baseId ?? item.id;
  const names = LEVEL_NAMES[base];
  const lv = item.level ?? 0;
  if (names && lv >= 1 && lv <= 5) return names[lv - 1];
  return FAMILY_NAME[base] ?? item.name;
}

/** The item as a family ("Sports Car"), for headings. */
export function familyName(item: Pick<OwnedItem, "id" | "baseId" | "name">): string {
  const base = item.baseId ?? item.id;
  return FAMILY_NAME[base] ?? item.name;
}

/**
 * How much fame one thing you own is giving you RIGHT NOW: your fame from
 * everything, minus your fame without it. Same curve fame.ts uses, so the
 * numbers on screen add up to the total (near enough — the curve flattens).
 */
export function fameFromOwned(items: OwnedItem[] | undefined, item: OwnedItem): number {
  const all = items ?? [];
  return Math.max(0, ownedFame(all) - ownedFame(all.filter((o) => o !== item)));
}

/** "+0.2", "+1.4", "+12" — fame the way the shop shows it. */
export function fameText(n: number): string {
  if (n <= 0) return "+0";
  if (n < 10) return `+${n.toFixed(1)}`;
  return `+${Math.round(n)}`;
}
