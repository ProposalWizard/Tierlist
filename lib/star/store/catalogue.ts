/**
 * THE STORE CATALOGUE (test area: /star-store-dev).
 *
 * Harry, 27 Sep 2026: "a test area for a dynamic store with animations and
 * daily specials, animations, accessories, unlockable through both pay and
 * pay to win, a section to buy coins for real money that work with in game
 * scaling."
 *
 * Four kinds of thing, two of them cosmetic and two that genuinely help:
 *
 *   animation   a penalty run-up style                 cosmetic, owned once
 *   accessory   headband, sleeves, boots colour, …     cosmetic, owned once
 *   boost       cans, training boost, a stat can       helps you win, used up
 *   boot        the real shop's boots at your level    helps you win, owned
 *
 * Every price is in WEEKS OF YOUR OWN WAGE (see coins.ts): the ★ price is
 * that many weeks of your wage, the Coin price is that many weeks at
 * COINS_PER_WAGE_WEEK. The two exceptions reuse the real shop's numbers
 * instead of inventing a second price: KIB cans (priced off your wage
 * already, shopData.ts `kibCanPrice`) and boots (a fixed ★ price per level,
 * shopDefaults.ts) — for those the Coin price is worked out from the ★ one.
 *
 * Nothing here is wired into a career. The test page keeps its own wallet.
 */
import { KIB_CANS, kibCanPrice, kibCanEffectLabel, BOOTS_ALL_LEVELS, baseIdOf } from "../shopData";
import type { Boot } from "../types";
import { coinPriceForStars, coinPriceForWeeks, starPriceForWeeks } from "./coins";
import { PENALTY_RUNUPS, FREE_KICK_RUNUPS, DEFAULT_PENALTY_RUNUP, DEFAULT_FREE_KICK_RUNUP, type PenaltyRunupId, type FreeKickRunupId } from "../runupStyles";

export type Rarity = "common" | "rare" | "epic" | "legendary";

/** What a cosmetic costs, in weeks of your wage. Coins: ×50 → 50/150/300/600. */
export const RARITY_WEEKS: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 6,
  legendary: 12,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary",
};

// ── Animations ─────────────────────────────────────────────────────────────

// The real run-up lists (lib/star/runupStyles.ts) — the same ids, names and
// descriptions the game uses. Two sets (Harry, 27 Sep 2026): penalty run-ups
// and free-kick run-ups, each with its own equipped slot. The store only adds
// a rarity (its price band) to each.
export type RunupStyleId = PenaltyRunupId;
export type FreeKickStyleId = FreeKickRunupId;
export type AnimationId = RunupStyleId | FreeKickStyleId;
export type AnimationSet = "penalty" | "free_kick";

export interface AnimationItem {
  kind: "animation";
  id: AnimationId;
  set: AnimationSet;
  name: string;
  blurb: string;
  rarity: Rarity;
  /** The standard one of each set: free, everyone owns it. */
  free?: boolean;
}

export const ANIMATION_SET_LABEL: Record<AnimationSet, string> = {
  penalty: "Penalty run-ups",
  free_kick: "Free-kick run-ups",
};

const ANIMATION_RARITY: Record<AnimationId, Rarity> = {
  standard: "common", stroll: "rare", skip: "epic", sprint: "epic", stutter: "rare", two_step: "common", arc: "legendary",
  fk_standard: "common", fk_power_stance: "legendary", fk_stance_sprint: "epic", fk_calm_curl: "legendary",
  fk_stutter_curl: "epic", fk_angled_whip: "rare", fk_long_diagonal: "epic",
};

export const ANIMATIONS: AnimationItem[] = [
  ...PENALTY_RUNUPS.map((r): AnimationItem => ({
    kind: "animation", set: "penalty", id: r.id, name: r.name, blurb: r.blurb,
    rarity: ANIMATION_RARITY[r.id], free: r.id === DEFAULT_PENALTY_RUNUP || undefined,
  })),
  ...FREE_KICK_RUNUPS.map((r): AnimationItem => ({
    kind: "animation", set: "free_kick", id: r.id, name: r.name, blurb: r.blurb,
    rarity: ANIMATION_RARITY[r.id], free: r.id === DEFAULT_FREE_KICK_RUNUP || undefined,
  })),
];

export const DEFAULT_RUNUP: RunupStyleId = DEFAULT_PENALTY_RUNUP;
export const DEFAULT_FREE_KICK: FreeKickStyleId = DEFAULT_FREE_KICK_RUNUP;

/** The free one of each set — owned by everyone. */
export const FREE_ANIMATIONS: AnimationId[] = ANIMATIONS.filter((a) => a.free).map((a) => a.id);

// ── Accessories ────────────────────────────────────────────────────────────

/** One of each can be worn at once. */
export type AccessorySlot = "head" | "neck" | "arms" | "wrists" | "hands" | "boots" | "armband" | "celebration";

export const SLOT_LABEL: Record<AccessorySlot, string> = {
  head: "Head", neck: "Neck", arms: "Sleeves", wrists: "Wrists", hands: "Hands",
  boots: "Boots", armband: "Armband", celebration: "Celebration",
};

export type Celebration = "arms_out" | "knee_slide" | "hands_up";

export interface AccessoryItem {
  kind: "accessory";
  id: string;
  name: string;
  slot: AccessorySlot;
  rarity: Rarity;
  /** Main colour of the thing, for the preview. */
  color: string;
  /** Second colour (stripes, a "C", trim). */
  color2?: string;
  /** Rainbow armband and similar: drawn as bands of these. */
  stripes?: string[];
  /** A celebration: the pose it strikes. */
  celebration?: Celebration;
}

export const ACCESSORIES: AccessoryItem[] = [
  { kind: "accessory", id: "headband-white", name: "Sweatband", slot: "head", rarity: "common", color: "#f8fafc" },
  { kind: "accessory", id: "headband-ninja", name: "Ninja Headband", slot: "head", rarity: "rare", color: "#0b0f19", color2: "#dc2626" },
  { kind: "accessory", id: "snood-black", name: "Snood", slot: "neck", rarity: "rare", color: "#111827" },
  { kind: "accessory", id: "sleeves-black", name: "Long Sleeves", slot: "arms", rarity: "common", color: "#111827" },
  { kind: "accessory", id: "sleeves-white", name: "White Base Layer", slot: "arms", rarity: "rare", color: "#f1f5f9" },
  { kind: "accessory", id: "tape-white", name: "Wrist Tape", slot: "wrists", rarity: "common", color: "#f8fafc" },
  { kind: "accessory", id: "gloves-black", name: "Winter Gloves", slot: "hands", rarity: "rare", color: "#111827" },
  { kind: "accessory", id: "gloves-gold", name: "Gold Gloves", slot: "hands", rarity: "epic", color: "#fbbf24", color2: "#92400e" },
  { kind: "accessory", id: "boots-blackout", name: "Blackout Boots", slot: "boots", rarity: "common", color: "#0a0a0a" },
  { kind: "accessory", id: "boots-volt", name: "Volt Boots", slot: "boots", rarity: "rare", color: "#d9f99d", color2: "#65a30d" },
  { kind: "accessory", id: "boots-gold", name: "Chrome Gold Boots", slot: "boots", rarity: "legendary", color: "#facc15", color2: "#a16207" },
  { kind: "accessory", id: "armband-classic", name: "Captain's Armband", slot: "armband", rarity: "rare", color: "#facc15", color2: "#111827" },
  { kind: "accessory", id: "armband-rainbow", name: "Rainbow Armband", slot: "armband", rarity: "epic", color: "#ef4444",
    stripes: ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#8b5cf6"] },
  { kind: "accessory", id: "celeb-hands-up", name: "Hands Up", slot: "celebration", rarity: "common", color: "#34d399", celebration: "hands_up" },
  { kind: "accessory", id: "celeb-arms-out", name: "Aeroplane", slot: "celebration", rarity: "rare", color: "#38bdf8", celebration: "arms_out" },
  { kind: "accessory", id: "celeb-knee-slide", name: "Knee Slide", slot: "celebration", rarity: "legendary", color: "#f472b6", celebration: "knee_slide" },
];

// ── Boosts (these genuinely help) ──────────────────────────────────────────

export type BoostId = "kib-basic" | "kib-premium" | "kib-elite" | "training-boost" | "stat-can";

export interface BoostItem {
  kind: "boost";
  id: BoostId;
  name: string;
  effect: string;
  /** Not a thing the real game has yet — shown with a NEW tag. */
  newToGame?: boolean;
  /** For KIB cans: the real shop's can, priced by the real shop. */
  canId?: "basic" | "premium" | "elite";
  /** Flat-colour art / picture, reused from the real shop for cans. */
  color: string;
  image?: string;
}

/**
 * The stat can raises power and technique, so it converts money into RATING —
 * economy.ts's `RATING_CONVERTER_WEEKS` rule: that kind of thing must cost
 * MORE of your week the higher you climb, or a rich player buys straight past
 * the growth curve. Weeks of wage by shop level 1-5.
 */
export const STAT_CAN_WEEKS_BY_LEVEL = [2, 2.5, 3, 4, 5] as const;
export const TRAINING_BOOST_WEEKS = 1.5;

export const BOOSTS: BoostItem[] = [
  ...KIB_CANS.map((c): BoostItem => ({
    kind: "boost", id: `kib-${c.id}` as BoostId, name: c.name, effect: kibCanEffectLabel(c),
    canId: c.id, color: c.color, image: c.image,
  })),
  { kind: "boost", id: "training-boost", name: "Training Boost", effect: "Double what training gives you, for one week",
    newToGame: true, color: "bg-emerald-500" },
  { kind: "boost", id: "stat-can", name: "Stat Can", effect: "+3 Power and Technique for your next 2 matches",
    newToGame: true, color: "bg-rose-500" },
];

// ── Boots: the real shop's boots, at your level ────────────────────────────

export interface BootItem {
  kind: "boot";
  id: string;
  boot: Boot;
}

/** Every boot the real shop sells at this level (1-5), in the shop's order. */
export function bootsAtLevel(level: number): BootItem[] {
  const seen = new Set<string>();
  const out: BootItem[] = [];
  for (const b of BOOTS_ALL_LEVELS) {
    if (b.level !== level) continue;
    const base = baseIdOf(b);
    if (seen.has(base)) continue;
    seen.add(base);
    out.push({ kind: "boot", id: b.id, boot: b });
  }
  return out;
}

export type StoreItem = AnimationItem | AccessoryItem | BoostItem | BootItem;

/** Every item that can be looked up by id (boots at every level included). */
export function findItem(id: string): StoreItem | undefined {
  return ANIMATIONS.find((a) => a.id === id)
    ?? ACCESSORIES.find((a) => a.id === id)
    ?? BOOSTS.find((b) => b.id === id)
    ?? (() => {
      const boot = BOOTS_ALL_LEVELS.find((b) => b.id === id);
      return boot ? ({ kind: "boot", id: boot.id, boot } as BootItem) : undefined;
    })();
}

export function itemName(item: StoreItem): string {
  return item.kind === "boot" ? item.boot.name : item.name;
}

/** Cosmetic (look only) vs helps you win. Shown on every card. */
export function isPayToWin(item: StoreItem): boolean {
  return item.kind === "boost" || item.kind === "boot";
}

/** Owned once and kept (animations, accessories, boots) vs used up (boosts). */
export function isConsumable(item: StoreItem): boolean {
  return item.kind === "boost";
}

// ── Prices ─────────────────────────────────────────────────────────────────

export interface PriceContext {
  /** The player's weekly wage, in ★ — drives every scaled price. */
  weeklyWage: number;
  /** Shop level 1-5 (National League 1 … Premier League 5). */
  level: number;
}

export interface Price {
  stars: number;
  coins: number;
  /** Weeks of wages this is, for the "about N weeks" line. */
  weeks: number;
}

export const FREE: Price = { stars: 0, coins: 0, weeks: 0 };

function fromWeeks(weeks: number, ctx: PriceContext): Price {
  return { stars: starPriceForWeeks(weeks, ctx.weeklyWage), coins: coinPriceForWeeks(weeks), weeks };
}

function fromStars(stars: number, ctx: PriceContext): Price {
  const wage = Math.max(1, ctx.weeklyWage);
  return { stars, coins: coinPriceForStars(stars, ctx.weeklyWage), weeks: stars / wage };
}

/** Full price, before any daily discount. */
export function basePrice(item: StoreItem, ctx: PriceContext): Price {
  switch (item.kind) {
    case "animation":
      return item.free ? FREE : fromWeeks(RARITY_WEEKS[item.rarity], ctx);
    case "accessory":
      return fromWeeks(RARITY_WEEKS[item.rarity], ctx);
    case "boot":
      return fromStars(item.boot.price, ctx);
    case "boost": {
      if (item.canId) {
        const can = KIB_CANS.find((c) => c.id === item.canId);
        return can ? fromStars(kibCanPrice(can, ctx.weeklyWage), ctx) : FREE;
      }
      if (item.id === "training-boost") return fromWeeks(TRAINING_BOOST_WEEKS, ctx);
      const lvl = Math.max(1, Math.min(5, Math.round(ctx.level))) - 1;
      return fromWeeks(STAT_CAN_WEEKS_BY_LEVEL[lvl], ctx);
    }
  }
}

/** A price with a percentage off, rounded the same way (never below 1). */
export function discounted(p: Price, percentOff: number): Price {
  if (!(percentOff > 0) || p.stars === 0) return p;
  const k = 1 - Math.min(90, percentOff) / 100;
  const stars = Math.max(1, Math.round(p.stars * k));
  const coins = Math.max(5, Math.round((p.coins * k) / 5) * 5);
  return { stars, coins, weeks: p.weeks * k };
}
