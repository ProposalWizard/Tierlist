/**
 * WHAT YOU BUY, ON YOUR PLAYER (Harry, 28 Nov 2026: "buying boots/accessories needs to translate onto your guy
 * (on the home screen for boots; in your wardrobe / wearable for the rest)").
 *
 * Pure: every shop boot and every wearable shop item → how it looks on the 3D player. The 3D side reads these
 * looks and nothing else (boots: the body shader's boot paint, people3d.ts dressPerson3d; the rest:
 * style3d/toon/accessories.ts). Tested in tests/star/wearables.mts (every shop item mapped, none missing).
 *
 * ONE STYLE FOR EVERY LEVEL (the same ladder on every item, so a level reads the same everywhere):
 *   L1  plain: one colour, dark rubber, no detail
 *   L2  a second colour (a boot's heel, a watch's coloured strap)
 *   L3  the item's own metal or flash, a light sole, a bit of shine
 *   L4  bright metal, thicker, more shine
 *   L5  gold or platinum with stones, the most shine
 *
 * Boots: your CURRENT pair (career.currentBoot, any level; worn out still shows) on the existing boot (painted on
 * the body below the boot line): upper, sole, studs, an accent on the heel (L2+) and a flash down the outside (L3+).
 * No boots = the plain black pair.
 */
import type { Boot, CareerState, OwnedItem } from "./types";
import { levelOfTier, PRICE_SPECS } from "./shopDefaults";

/** The base item of a level entry ("speed" for "speed-l3"), from its baseId or its id. */
export function baseIdOf(x: { id: string; baseId?: string }): string {
  return x.baseId ?? x.id.replace(/-l[1-5]$/, "");
}

// ═══════════════════════════════════════════════════════════════════════
//  BOOTS
// ═══════════════════════════════════════════════════════════════════════

export interface BootLook {
  /** The boot's own colour (sRGB hex). */
  upper: string;
  /** The sole's edge and the studs. */
  sole: string;
  studs: string;
  /** The heel and the flash. */
  accent: string;
  heel: boolean;
  flash: boolean;
  level: number;
  /** Which boot (shop base id), or "plain". */
  family: string;
}

/** Each boot family's own two colours (the upper as in the shop, shop3d/catalogue.ts BOOT_COLOURS, and its accent). */
export const BOOT_FAMILY: Record<string, { upper: string; accent: string; name: string }> = {
  starter: { upper: "#f4f4f2", accent: "#2a4fd6", name: "NS-Pure" },
  speed: { upper: "#ffd21f", accent: "#16161a", name: "NS-Flash" },
  power: { upper: "#e8322b", accent: "#f4f4f2", name: "NS-Thunder" },
  control: { upper: "#2f7bff", accent: "#f4f4f2", name: "NS-Control" },
  elite: { upper: "#1b1b1f", accent: "#d9a92c", name: "NS-Elite" },
  curl: { upper: "#19c2b4", accent: "#ff5aa5", name: "NS-Swerve" },
  maestro: { upper: "#9b4dff", accent: "#ffd21f", name: "NS-Maestro" },
};

export const PLAIN_BOOTS: BootLook = { upper: "#141416", sole: "#141416", studs: "#141416", accent: "#141416", heel: false, flash: false, level: 0, family: "plain" };

const GOLD = "#e8bf4a", SILVER = "#cfd5dc", DARK_SOLE = "#26272b", LIGHT_SOLE = "#ecebe6";

/** The level of a boot or item. Absent (bought before levels, 27 Sep 2026): the level of its own rung, from the
 *  catalogue it is in (a Gold Watch was a Pro item = level 3). */
export function levelOf(x: { id?: string; baseId?: string; level?: number } | null | undefined, catalogue: "boots" | "lifestyle" = "lifestyle"): number {
  const fromId = x?.id ? /-l([1-5])$/.exec(x.id) : null;
  if (x?.level == null && fromId) return Number(fromId[1]);
  if (x?.level == null && x?.id) {
    const spec = PRICE_SPECS[catalogue]?.[baseIdOf({ id: x.id, baseId: x.baseId })];
    if (spec) return levelOfTier(spec.tier);
  }
  const l = Math.round(x?.level ?? 1);
  return Math.max(1, Math.min(5, Number.isFinite(l) ? l : 1));
}

/** Two sRGB hex colours within ~a fifth of each other (per channel sum). */
function near(a: string, b: string): boolean {
  const n = (h: string) => { const v = parseInt(h.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  const x = n(a), y = n(b);
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 150;
}

/** A boot (any family, any level) → its look on your feet. Null / unknown id / no id = the plain black pair. */
export function bootLookOf(boot: Pick<Boot, "id" | "level" | "baseId"> | null | undefined): BootLook {
  if (!boot || !boot.id) return { ...PLAIN_BOOTS };
  const family = baseIdOf(boot);
  const f = BOOT_FAMILY[family];
  if (!f) return { ...PLAIN_BOOTS };
  const level = levelOf(boot, "boots");
  const dark = family === "elite";
  // gold on a yellow or gold boot would vanish: those keep their own accent and wear gold only on the studs
  const goldish = near(f.upper, GOLD) || near(f.accent, GOLD);
  return {
    upper: f.upper,
    sole: level >= 4 ? (dark ? (level >= 5 ? GOLD : SILVER) : f.accent) : level >= 3 ? (dark ? DARK_SOLE : LIGHT_SOLE) : DARK_SOLE,
    studs: level >= 5 ? GOLD : level >= 4 ? SILVER : level >= 3 ? "#8b8f96" : DARK_SOLE,
    accent: level >= 5 && !goldish ? GOLD : f.accent,
    heel: level >= 2,
    flash: level >= 3,
    level,
    family,
  };
}

/** The boot look as the body's "boots" accessory (people3d.ts WornThing): colour, sole, then [accent, studs, flags]. */
export function bootWorn(b: BootLook): { slot: "boots"; color: string; color2: string; stripes: string[] } {
  return { slot: "boots", color: b.upper, color2: b.sole, stripes: [b.accent, b.studs, `${b.heel ? 1 : 0}${b.flash ? 1 : 0}`] };
}

/** Back from a WornThing (people3d.ts reads this): null when it carries only a colour (every older caller). */
export function bootLookFromWorn(w: { color: string; color2?: string; stripes?: string[] } | undefined): BootLook | null {
  if (!w || !w.color2 || !w.stripes || w.stripes.length < 3) return null;
  const flags = w.stripes[2] ?? "00";
  return { upper: w.color, sole: w.color2, accent: w.stripes[0], studs: w.stripes[1], heel: flags[0] === "1", flash: flags[1] === "1", level: 0, family: "worn" };
}

// ═══════════════════════════════════════════════════════════════════════
//  ACCESSORIES AND STYLE ITEMS
// ═══════════════════════════════════════════════════════════════════════

/** Where a thing is worn. "outfit" is a whole set of clothes (the Clothes rail), the rest sit on the body. */
export type WearSlot = "wrist" | "neck" | "eyes" | "head" | "outfit";
export type AccessoryKind = "smartwatch" | "watch" | "luxwatch" | "chain" | "necklace" | "headphones" | "shades" | "cap";

/**
 * Every shop item a person could wear (lib/star/shopDefaults.ts LIFESTYLE_SPECS, base ids), and where.
 * The rest of the Style shop is not worn: Phone, Games Console, Music Player, Tablet, TV, Gaming PC, Art Piece
 * (things in the house), every vehicle and every property. tests/star/wearables.mts holds this list to the shop.
 */
export const WEARABLE_ITEMS: Record<string, { slot: WearSlot; kind: AccessoryKind | "suit"; label: string }> = {
  smartwatch: { slot: "wrist", kind: "smartwatch", label: "Smartwatch" },
  gold: { slot: "wrist", kind: "watch", label: "Gold Watch" },
  rolex: { slot: "wrist", kind: "luxwatch", label: "Diamond Rolex" },
  silver: { slot: "neck", kind: "chain", label: "Silver Chain" },
  diamond: { slot: "neck", kind: "necklace", label: "Diamond Necklace" },
  headphones: { slot: "neck", kind: "headphones", label: "Headphones" },
  suit: { slot: "outfit", kind: "suit", label: "Designer Suit" },
  // sold since 28 Nov 2026 (Harry: "yes add caps and sunglasses to the shop")
  shades: { slot: "eyes", kind: "shades", label: "Sunglasses" },
  cap: { slot: "head", kind: "cap", label: "Cap" },
};
/** Shop items that are NOT worn (checked by the test: every shop item is in one of the two lists). */
export const NOT_WORN = ["phone", "console", "music", "tablet", "tv", "gaming-pc", "art"] as const;

/**
 * Built and ready, NOT SOLD: the shop has no sunglasses and no caps (28 Nov 2026). Test pages can put them on
 * (`?extras=shades,cap`); the game never does until they are shop items. One line each to sell them: add the
 * item to LIFESTYLE_SPECS with this id and move it into WEARABLE_ITEMS.
 */
export const UNSOLD_WEARABLES: Record<string, { slot: WearSlot; kind: AccessoryKind; label: string }> = {};

/** One accessory's look (colours sRGB hex). The 3D side draws every kind from these numbers only. */
export interface AccessoryLook {
  kind: AccessoryKind;
  slot: Exclude<WearSlot, "outfit">;
  level: number;
  /** The main material: a strap, a chain, a band, a frame, a crown. */
  main: string;
  /** The second: a watch's case, the headphone cups, a cap's brim, the lenses. */
  second: string;
  /** A watch's face, a pendant, a cap's badge. */
  detail: string;
  /** How many stones (0 = none). */
  stones: number;
  /** 0..1: how shiny (the 3D side's highlight). */
  shine: number;
  /** A chain's thickness, metres (L1 thin → L5 thick). */
  thick: number;
}

const STEEL = "#8f959c", SILV = "#c9ced5", GOLDM = "#d6b35a", BRIGHT = "#e9cc78", PLAT = "#e9edf2", ROSE = "#d99a7a";
const L = (level: number, a: string[]) => a[Math.max(0, Math.min(a.length - 1, level - 1))];
const SHINE = [0.25, 0.4, 0.6, 0.8, 1];

/** An accessory (shop base id, or an unsold design's id) at a level → its look. Null: not an accessory. */
export function accessoryLook(baseId: string, level: number): AccessoryLook | null {
  const w = WEARABLE_ITEMS[baseId] ?? UNSOLD_WEARABLES[baseId];
  if (!w || w.kind === "suit" || w.slot === "outfit") return null;
  const lv = Math.max(1, Math.min(5, Math.round(level) || 1));
  const shine = SHINE[lv - 1];
  const base = { kind: w.kind as AccessoryKind, slot: w.slot as AccessoryLook["slot"], level: lv, shine, stones: 0, thick: 0.0035 };
  switch (w.kind) {
    case "smartwatch": // a rubber strap, a dark screen with a lit dial
      return { ...base, main: L(lv, ["#1d1f24", "#2b3a55", "#f1f1ee", SILV, GOLDM]), second: L(lv, ["#3a3d44", STEEL, SILV, PLAT, BRIGHT]), detail: L(lv, ["#3fb6ff", "#3fb6ff", "#5cf0c8", "#ffffff", "#ffe28a"]) };
    case "watch": // gold: a leather strap (L1-2) then a gold bracelet, a light dial
      return { ...base, main: L(lv, ["#5a3a22", "#2a1c14", GOLDM, BRIGHT, ROSE]), second: L(lv, [GOLDM, GOLDM, BRIGHT, BRIGHT, ROSE]), detail: L(lv, ["#f4efe2", "#f6f0dc", "#efe3c0", "#f2f2ee", "#f7f4ee"]), stones: lv >= 4 ? (lv - 3) * 4 : 0 };
    case "luxwatch": // diamond: steel to platinum, diamonds round the bezel from L1, more each level
      return { ...base, main: L(lv, [STEEL, SILV, GOLDM, BRIGHT, PLAT]), second: L(lv, [SILV, GOLDM, BRIGHT, PLAT, PLAT]), detail: L(lv, ["#f2f2ee", "#e9edf2", "#efe3c0", "#dfe8f2", "#f7f9fc"]), stones: [4, 6, 8, 12, 16][lv - 1], shine: Math.min(1, shine + 0.1) };
    case "chain": // silver: thin steel to a thick platinum chain with a pendant
      return { ...base, main: L(lv, [STEEL, SILV, SILV, PLAT, PLAT]), second: L(lv, [STEEL, SILV, SILV, PLAT, PLAT]), detail: L(lv, [STEEL, SILV, SILV, PLAT, "#ffffff"]), thick: [0.0009, 0.0011, 0.0013, 0.0015, 0.0018][lv - 1], stones: lv >= 5 ? 1 : 0 };
    case "necklace": // diamond: a fine chain, a pendant with stones, more each level
      return { ...base, main: L(lv, [SILV, SILV, GOLDM, BRIGHT, PLAT]), second: L(lv, [SILV, GOLDM, GOLDM, BRIGHT, PLAT]), detail: "#ffffff", thick: 0.0008, stones: [1, 3, 5, 7, 9][lv - 1], shine: Math.min(1, shine + 0.15) };
    case "headphones": // round the neck: a band, two cups
      return { ...base, main: L(lv, ["#1b1c20", "#f1f1ee", "#c43b3b", SILV, GOLDM]), second: L(lv, ["#2a2c31", "#d8d8d4", "#1b1c20", "#2a2c31", "#16161a"]), detail: L(lv, ["#3a3d44", "#bfbfbb", "#f1f1ee", STEEL, BRIGHT]) };
    case "shades":
      return { ...base, main: L(lv, ["#16161a", "#16161a", GOLDM, SILV, BRIGHT]), second: L(lv, ["#1c2430", "#2a1f17", "#3b2a14", "#1f3a5a", "#2a2a2e"]), detail: L(lv, ["#16161a", "#16161a", GOLDM, SILV, BRIGHT]) };
    case "cap":
      return { ...base, main: L(lv, ["#6b7280", "#2e3a55", "#f1efe9", "#16161a", "#16161a"]), second: L(lv, ["#4b5160", "#2e3a55", "#16161a", "#16161a", "#16161a"]), detail: L(lv, ["#22252b", "#f1efe9", GOLDM, SILV, GOLDM]) };
  }
  return null;
}

/** The Designer Suit, by level: coat, trousers, shirt, tie (sRGB hex). One consistent ladder: grey → ivory. */
export function designerSuitColours(level: number): { coat: string; trousers: string; shirt: string; tie: string } {
  const lv = Math.max(1, Math.min(5, Math.round(level) || 1));
  return [
    { coat: "#4a4f57", trousers: "#3e434b", shirt: "#f2f2ef", tie: "#1f2a44" },
    { coat: "#1f2a44", trousers: "#1b2438", shirt: "#f2f2ef", tie: "#7a1d2b" },
    { coat: "#17181c", trousers: "#141518", shirt: "#f4f4f2", tie: "#9aa0a8" },
    { coat: "#17203a", trousers: "#141b30", shirt: "#f4f4f2", tie: "#c99a2e" },
    { coat: "#e6dcc6", trousers: "#16161a", shirt: "#f7f6f2", tie: "#16161a" },
  ][lv - 1];
}

// ═══════════════════════════════════════════════════════════════════════
//  WHAT YOU OWN, AND WHAT YOU WEAR
// ═══════════════════════════════════════════════════════════════════════

export interface OwnedWearable { id: string; baseId: string; level: number; slot: WearSlot; label: string }

/** Every wearable item you own (each level its own), best first within a slot. */
export function ownedWearables(career: Pick<CareerState, "ownedItems">): OwnedWearable[] {
  const seen = new Set<string>();
  const out: OwnedWearable[] = [];
  for (const it of career.ownedItems ?? []) {
    const baseId = baseIdOf(it);
    const w = WEARABLE_ITEMS[baseId];
    if (!w || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push({ id: it.id, baseId, level: levelOf(it), slot: w.slot, label: w.label });
  }
  return out.sort((a, b) => a.slot.localeCompare(b.slot) || b.level - a.level || a.label.localeCompare(b.label));
}

/** The body slots the wardrobe's Extras rail offers (an empty slot is not shown). */
export const BODY_SLOTS = ["wrist", "neck", "eyes", "head"] as const;
export type BodySlot = (typeof BODY_SLOTS)[number];
/** What you picked per body slot: an owned item id, or "none". Absent: the best you own is worn (so a new buy shows). */
export type ExtrasChoice = Partial<Record<BodySlot, string>>;

/**
 * What you wear on the body. A picked item you no longer own is dropped (sold, or a save from another device).
 * `unsold`: test pages only (UNSOLD_WEARABLES ids, any level 1-5 as "shades-l3").
 */
export function wornExtras(career: Pick<CareerState, "ownedItems">, choice: ExtrasChoice | undefined, unsold: string[] = tryOn): AccessoryLook[] {
  const owned = ownedWearables(career);
  const out: AccessoryLook[] = [];
  for (const slot of BODY_SLOTS) {
    const pick = choice?.[slot];
    if (pick === "none") continue;
    const mine = owned.filter((o) => o.slot === slot);
    const it = (pick && mine.find((o) => o.id === pick)) || (pick === undefined ? mine[0] : undefined);
    const look = it ? accessoryLook(it.baseId, it.level) : null;
    if (look) out.push(look);
  }
  for (const u of unsold) {
    const m = /^([a-z]+)(?:-l([1-5]))?$/.exec(u);
    const wi = m ? WEARABLE_ITEMS[m[1]] ?? UNSOLD_WEARABLES[m[1]] : undefined;
    if (!m || !wi || wi.slot === "outfit") continue;
    const look = accessoryLook(m[1], Number(m[2] ?? 3));
    if (look && !out.some((o) => o.slot === look.slot)) out.push(look);
  }
  return out;
}

let tryOn: string[] = [];
/** Test pages only (?extras=shades,cap-l4): unsold designs put on as well. The game never calls this. */
export function setTryOn(list: string[]) { tryOn = list.filter((x) => /^[a-z]+(-l[1-5])?$/.test(x)).slice(0, 4); }

/** The best Designer Suit you own (its level), or 0. */
export function designerSuitLevel(career: Pick<CareerState, "ownedItems">): number {
  return Math.max(0, ...(career.ownedItems ?? []).filter((it: OwnedItem) => baseIdOf(it) === "suit").map((it) => levelOf(it)));
}
