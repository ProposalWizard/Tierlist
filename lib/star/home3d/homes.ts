/**
 * WHICH HOME YOU ARE IN, AND WHAT ITS ROOM LOOKS LIKE (Harry, 9 Oct 2026:
 * "imagine you actually had your current house with all your stuff and that's
 * where you change clothes").
 *
 * The home you own in the shop (the "homes" lifestyle items, shopDefaults.ts)
 * picks one of six room presets. Before you buy a home you live in a starter
 * flat. One parametric room (./scene.ts) takes the preset: its size, its
 * finish and what the windows look out on all grow with the tier.
 *
 *   starter    no home bought            small room, carpet, a street window
 *   flat       Studio Flat, City Apt.    laminate boards, a city window
 *   penthouse  Penthouse                 oak, a skyline window, a glass wall
 *   house      Suburban House            oak boards, a back-garden window
 *   villa      Beach Villa, Mansion      pale stone, a sea window, panelling
 *   estate     Country Estate, Island    marble and walnut, a view of the grounds
 *
 * Pure: no three.js here. Tested in tests/star/home3d.mts.
 */
import type { OwnedItem } from "../types";
import { baseIdOf } from "../shopDefaults";
import { levelName } from "../lifestyleLevels";

export type HomeTier = "starter" | "flat" | "penthouse" | "house" | "villa" | "estate";
/** Cheapest to grandest. */
export const HOME_TIERS: HomeTier[] = ["starter", "flat", "penthouse", "house", "villa", "estate"];

/** Which preset each home family in the shop gives. The stable is the horse's, not a home. */
export const HOME_FAMILY_TIER: Record<string, HomeTier> = {
  "flat-1": "flat",
  "flat-2": "flat",
  penthouse: "penthouse",
  "house-1": "house",
  villa: "villa",
  "house-2": "villa",
  estate: "estate",
  island: "estate",
};

/** What the main window looks out on. */
export type WindowView = "street" | "city" | "skyline" | "garden" | "sea" | "grounds";
/** What the floor is. */
export type FloorKind = "carpet" | "boards" | "oak" | "stone" | "marble";

export interface RoomPreset {
  tier: HomeTier;
  /** What the screen calls it when you own nothing better ("Starter flat"). */
  label: string;
  /** Room size, metres: width (x), depth (z), height. */
  w: number;
  d: number;
  h: number;
  floor: FloorKind;
  /** Wall paint, the lower panelling (or the same paint), and the trim. */
  wall: string;
  panel: string;
  trim: string;
  /** Panelling up to the dado rail. */
  panelled: boolean;
  /** Metal trim (brass, gold) on the wardrobe and the cabinet. */
  metal: string;
  view: WindowView;
  /** How many windows in the back wall either side of the cabinet (1 or 2). */
  backWindows: 1 | 2;
  /** Wardrobe length along the west wall, metres. */
  wardrobe: number;
  /** Trophy cabinet: columns × shelves (slots = cols × rows). */
  cabinet: { cols: number; rows: number };
  /** How many of your cars fit on the drive through the window. */
  cars: number;
  /** What is outside the drive window: a street kerb, a gravel drive, a stone forecourt. */
  drive: "street" | "drive" | "forecourt";
  /** A chandelier (one emissive piece, no real light). */
  chandelier: boolean;
  /** Plants in the corners. */
  plants: number;
}

const P: Record<HomeTier, RoomPreset> = {
  starter: {
    tier: "starter", label: "Starter flat", w: 5.2, d: 6.0, h: 2.55, floor: "carpet",
    wall: "#cfc6b8", panel: "#cfc6b8", trim: "#f2eee6", panelled: false, metal: "#9aa0a6",
    view: "street", backWindows: 1, wardrobe: 1.8, cabinet: { cols: 3, rows: 2 }, cars: 1, drive: "street", chandelier: false, plants: 1,
  },
  flat: {
    tier: "flat", label: "Flat", w: 6.0, d: 6.8, h: 2.65, floor: "boards",
    wall: "#d9d4ca", panel: "#d9d4ca", trim: "#f4f1ea", panelled: false, metal: "#a7adb3",
    view: "city", backWindows: 1, wardrobe: 2.2, cabinet: { cols: 3, rows: 3 }, cars: 1, drive: "street", chandelier: false, plants: 1,
  },
  penthouse: {
    tier: "penthouse", label: "Penthouse", w: 7.0, d: 7.6, h: 2.9, floor: "oak",
    wall: "#e4e0d8", panel: "#e4e0d8", trim: "#2b2b2e", panelled: false, metal: "#c9cdd2",
    view: "skyline", backWindows: 2, wardrobe: 2.6, cabinet: { cols: 4, rows: 3 }, cars: 2, drive: "street", chandelier: false, plants: 2,
  },
  house: {
    tier: "house", label: "House", w: 7.4, d: 8.0, h: 3.0, floor: "oak",
    wall: "#e6dccb", panel: "#e6dccb", trim: "#fbf8f2", panelled: false, metal: "#b08d57",
    view: "garden", backWindows: 2, wardrobe: 2.8, cabinet: { cols: 4, rows: 3 }, cars: 2, drive: "drive", chandelier: false, plants: 2,
  },
  villa: {
    tier: "villa", label: "Villa", w: 8.6, d: 9.2, h: 3.3, floor: "stone",
    wall: "#efe8dc", panel: "#d8cbb4", trim: "#fffaf0", panelled: true, metal: "#c8a24a",
    view: "sea", backWindows: 2, wardrobe: 3.4, cabinet: { cols: 4, rows: 4 }, cars: 3, drive: "drive", chandelier: true, plants: 3,
  },
  estate: {
    tier: "estate", label: "Estate", w: 10.0, d: 10.6, h: 3.7, floor: "marble",
    wall: "#e9e1d2", panel: "#5a3a24", trim: "#f6efe2", panelled: true, metal: "#d4af37",
    view: "grounds", backWindows: 2, wardrobe: 4.2, cabinet: { cols: 5, rows: 4 }, cars: 4, drive: "forecourt", chandelier: true, plants: 4,
  },
};

/** The room for a tier. */
export function roomPreset(tier: HomeTier): RoomPreset {
  return P[tier] ?? P.starter;
}

/** A tier from a query string (?tier=villa), or null. */
export function parseHomeTier(v: string | null | undefined): HomeTier | null {
  return v && (HOME_TIERS as string[]).includes(v) ? (v as HomeTier) : null;
}

/** The grandest home you own (its item), or null before you buy one. */
export function bestHome(owned: OwnedItem[] | undefined): OwnedItem | null {
  let best: OwnedItem | null = null;
  let bestRank = -1;
  for (const it of owned ?? []) {
    const t = HOME_FAMILY_TIER[baseIdOf(it)];
    if (!t) continue;
    const rank = HOME_TIERS.indexOf(t) * 10 + (it.level ?? 1);
    if (rank > bestRank) { bestRank = rank; best = it; }
  }
  return best;
}

/** Which room you live in, from the homes you own. */
export function homeTierOf(owned: OwnedItem[] | undefined): HomeTier {
  const b = bestHome(owned);
  return b ? HOME_FAMILY_TIER[baseIdOf(b)] : "starter";
}

/** The name the screen shows: the home's own level name ("Detached House"), or "Starter flat". */
export function homeNameOf(owned: OwnedItem[] | undefined): string {
  const b = bestHome(owned);
  return b ? levelName(b) : P.starter.label;
}

/** How many trophy slots the cabinet of a tier has. */
export function cabinetSize(tier: HomeTier): number {
  const c = roomPreset(tier).cabinet;
  return c.cols * c.rows;
}
