/**
 * BUYING IN THE SHOP, the phone's port of app/star-dev/page.tsx's shop
 * handlers (handleBuyKib, handleUseCan, handleBuyBoot, handleBuyItem,
 * handleBuyFromBlackMarket). Each is a pure career → result function over the
 * same lib/star data and rules (shopData, fame, sponsorDeals, corruption,
 * unlocks); the screens call them and hand the career to setCareer().
 * tools/world-check.ts runs them headless against a fresh career.
 */
import type { Boot, CareerState, OwnedItem } from "@/lib/star/types";
import { KIB_CANS, LIFESTYLE_ALL_LEVELS, BOOTS_ALL_LEVELS, kibCanPrice, baseIdOf, type KibCan } from "@/lib/star/shopData";
import { freshItem, isWornOut } from "@/lib/star/fame";
import { bootPrice } from "@/lib/star/sponsorDeals";
import { rollCaught, applyGettingCaught, blackMarketPrice, LAWYER_FEE } from "@/lib/star/corruption";
import { isOpen, recordPhoneBought } from "@/lib/star/unlocks";
import { isStory } from "@/lib/star/story";
import { mulberry32 } from "@/lib/star/season";

export interface Bought { career: CareerState; ok: boolean; reason?: string; /** The unlock chain fired: a line to show. */ unlocked?: string }
const no = (career: CareerState, reason: string): Bought => ({ career, ok: false, reason });

/** One KIB can into the cupboard (handleBuyKib). */
export function buyKib(career: CareerState, can: KibCan): Bought {
  const price = kibCanPrice(can, career.contract.wage ?? 0);
  if (career.money < price) return no(career, "Not enough money");
  return { ok: true, career: { ...career, money: career.money - price, kibCans: { ...career.kibCans, [can.id]: (career.kibCans[can.id] ?? 0) + 1 } } };
}

/** Drink a can (handleUseCan): energy, and Premium/Elite give their ability. */
export function drinkCan(career: CareerState, id: KibCan["id"]): Bought {
  if (!career.kibCans[id]) return no(career, "None left");
  const can = KIB_CANS.find((c) => c.id === id)!;
  if (can.effect && career.kibAbility?.[can.effect]) return no(career, "That ability is already waiting");
  if (!can.effect && career.energy >= 100) return no(career, "Energy is full");
  return {
    ok: true,
    career: {
      ...career,
      kibCans: { ...career.kibCans, [id]: career.kibCans[id] - 1 },
      ...(can.effect ? { kibAbility: { ...career.kibAbility, [can.effect]: true } } : {}),
      energy: Math.min(100, career.energy + can.restore),
    },
  };
}

/** The boots on sale, at your price (a boot deal takes money off: sponsorDeals.bootPrice). */
export function bootsForSale(career: CareerState): Boot[] {
  return BOOTS_ALL_LEVELS.map((b) => ({ ...b, price: bootPrice(career, b.price) }));
}

/** Buy boots (handleBuyBoot): the same pair again stacks the matches left. */
export function buyBoot(career: CareerState, boot: Boot): Bought {
  if (career.money < boot.price) return no(career, "Not enough money");
  const stacking = career.currentBoot.id === boot.id;
  return {
    ok: true,
    career: {
      ...career,
      money: career.money - boot.price,
      currentBoot: stacking ? { ...boot, matches: career.currentBoot.matches + boot.matches } : { ...boot },
    },
  };
}

/** Banned boots from the black market (handleBuyFromBlackMarket): lawyers make getting caught less likely. */
export function buyBlackMarket(career: CareerState, boot: Boot, useLawyers: boolean): Bought {
  const price = blackMarketPrice(boot.price) + (useLawyers ? LAWYER_FEE : 0);
  if (price > career.money) return no(career, "Not enough money");
  const stacking = career.currentBoot.id === boot.id;
  let next: CareerState = {
    ...career,
    money: career.money - price,
    currentBoot: stacking ? { ...boot, matches: career.currentBoot.matches + boot.matches } : { ...boot },
  };
  const rng = mulberry32(career.season * 33301 + career.week * 419 + boot.id.length);
  if (rollCaught("blackMarket", useLawyers, rng)) next = applyGettingCaught(next, "blackMarket", price, `Caught buying banned boots (${boot.name})`);
  return { ok: true, career: next };
}

/** The level of a style item you own (0 = none). */
export function ownedLevelOf(career: CareerState, base: string): number {
  const owned = career.ownedItems.find((o) => baseIdOf(o) === base);
  return owned ? (owned.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === owned.id)?.level ?? 0) : 0;
}

/**
 * Buy a style item (handleBuyItem). You own one level of each item: a higher
 * level replaces yours; the same or lower only replaces a worn-out one.
 * The phone opens the Phone and the App Store (the unlock chain).
 */
export function buyItem(career: CareerState, item: OwnedItem): Bought {
  const base = item.baseId ?? item.id;
  const owned = career.ownedItems.find((o) => (o.baseId ?? o.id) === base);
  const ownedLevel = owned ? (owned.level ?? LIFESTYLE_ALL_LEVELS.find((l) => l.id === owned.id)?.level ?? 0) : 0;
  if (career.money < item.price) return no(career, "Not enough money");
  if (owned && !isWornOut(owned) && (item.level ?? 0) <= ownedLevel && ownedLevel > 0) return no(career, "You have this or better");
  if (owned && !isWornOut(owned) && owned.id === item.id) return no(career, "You have this");
  const bought: CareerState = {
    ...career,
    money: career.money - item.price,
    ownedItems: [...career.ownedItems.filter((o) => (o.baseId ?? o.id) !== base), freshItem(item)],
    happiness: Math.min(100, career.happiness + Math.floor(item.lifestyleValue / 3)),
  };
  if (base === "phone" && isStory(career)) return { ok: true, career: recordPhoneBought(bought), unlocked: "Kickabout is on it" };
  if (base === "phone" && !isOpen(career, "phone")) return { ok: true, career: recordPhoneBought(bought), unlocked: "Phone and App Store unlocked" };
  return { ok: true, career: bought };
}

/** The style families (bases) in shop order, each with its levels low to high. */
export const STYLE_BASES: Map<string, OwnedItem[]> = (() => {
  const seen = new Map<string, OwnedItem[]>();
  for (const i of LIFESTYLE_ALL_LEVELS) {
    const b = baseIdOf(i);
    if (!seen.has(b)) seen.set(b, []);
    seen.get(b)!.push(i);
  }
  seen.forEach((v) => { v.sort((a, b) => (a.level ?? 0) - (b.level ?? 0)); });
  return seen;
})();

/** The boot families in the website showroom's order. */
export const BOOT_ORDER = ["starter", "speed", "power", "control", "elite", "curl", "maestro"];
