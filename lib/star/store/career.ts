/**
 * THE STORE IN THE CAREER — the test area's rules, run on a real save.
 *
 * Harry, 28 Sep 2026: "add store aswell". The store (/star-store-dev) keeps
 * its own wallet; in the career the wallet IS the career:
 *
 *   ★                 career.money
 *   Coins             career.coins                 (new, 0 on older saves)
 *   run-ups owned     career.ownedAnimations       (Settings → Run-ups reads it)
 *   run-ups in use    career.penaltyRunup / freeKickRunup (the match reads them)
 *   accessories       career.ownedAccessories / equippedAccessories
 *   KIB cans held     career.kibCans               (the Home cans card reads it)
 *   boots             career.currentBoot           (the real shop's rule)
 *   specials used     career.storeSpecialsBought   (once a day, per career)
 *
 * Nothing here has its own buying logic. Each action turns the career into a
 * `StoreState`, runs the SAME pure reducer the test area runs (purchase.ts),
 * and writes the result back. The one extra step is a boot: the real shop
 * puts it on your feet (stacking the matches if it is the pair you already
 * wear), so a boot bought here does exactly that.
 *
 * Training Boost and Stat Can are priced ideas with no effect in the game
 * yet, so the career's store doesn't sell them (`shownInCareer`).
 *
 * Pure. Tested in tests/star/storeCareer.mts.
 */
import type { Boot, CareerState } from "../types";
import { divisionOf } from "../calendar";
import { baseIdOf } from "../shopData";
import { ruleBookFor } from "../ruleBook";
import { careerPenaltyRunup, careerFreeKickRunup } from "../runupStyles";
import { ANIMATIONS, ACCESSORIES, findItem, type AccessorySlot, type PriceContext, type StoreItem } from "./catalogue";
import { buy, equip, unequip, buyCoinPack, convertCoins, type Currency, type StoreState } from "./purchase";
import { shopLevelFor } from "./testArea";

/** The boosts that are only ideas so far — priced in the test area, not sold here. */
export const NOT_IN_CAREER_YET = new Set<string>(["training-boost", "stat-can"]);

/** The one line under accessories: they're on your store figure, not yet on the pitch. */
export const ACCESSORIES_IN_MATCH_NOTE = "Shows in matches soon";

export interface CareerStoreResult { ok: boolean; career: CareerState; reason?: string }

const KIB_KEYS = { basic: "kib-basic", premium: "kib-premium", elite: "kib-elite" } as const;

/** How many days of "special already used" to keep on the save. */
const SPECIAL_DAYS_KEPT = 7;

/** Your wage and your shop level — what every scaled price is worked out from. */
export function careerPriceContext(c: CareerState): PriceContext {
  return { weeklyWage: c.contract?.wage ?? 0, level: shopLevelFor(divisionOf(c)) };
}

/** Boots the FA has banned: only the Boots shop's black market sells them. */
function isBannedBoot(c: CareerState, boot: Boot): boolean {
  try {
    return ruleBookFor(c, "FA").bannedItems.includes(baseIdOf(boot));
  } catch {
    return false;
  }
}

/** Whether the career's store sells this. */
export function shownInCareer(item: StoreItem, c?: CareerState): boolean {
  if (item.kind === "boost" && NOT_IN_CAREER_YET.has(item.id)) return false;
  if (item.kind === "boot" && c && isBannedBoot(c, item.boot)) return false;
  return true;
}

/** The career, seen as the store's wallet-and-locker. */
export function careerStoreState(c: CareerState): StoreState {
  const equipped: StoreState["equipped"] = {};
  for (const [slot, id] of Object.entries(c.equippedAccessories ?? {})) {
    if (ACCESSORIES.some((a) => a.id === id && a.slot === slot)) equipped[slot as AccessorySlot] = id;
  }
  const kib = c.kibCans ?? { basic: 0, premium: 0, elite: 0 };
  return {
    stars: c.money,
    coins: Math.max(0, c.coins ?? 0),
    owned: [...(c.ownedAnimations ?? []), ...(c.ownedAccessories ?? [])],
    inventory: { [KIB_KEYS.basic]: kib.basic, [KIB_KEYS.premium]: kib.premium, [KIB_KEYS.elite]: kib.elite },
    penaltyRunup: careerPenaltyRunup(c),
    freeKickRunup: careerFreeKickRunup(c),
    equipped,
    specialsBought: c.storeSpecialsBought ?? {},
    firstPackBought: !!c.storeFirstPackBought,
    log: c.storeLog ?? [],
  };
}

const isAnimation = (id: string) => ANIMATIONS.some((a) => a.id === id);
const isAccessory = (id: string) => ACCESSORIES.some((a) => a.id === id);

/** A store state written back onto the career it came from. */
export function applyStoreState(c: CareerState, s: StoreState): CareerState {
  const days = Object.keys(s.specialsBought).sort().slice(-SPECIAL_DAYS_KEPT);
  return {
    ...c,
    money: s.stars,
    coins: s.coins,
    ownedAnimations: Array.from(new Set(s.owned.filter(isAnimation))),
    ownedAccessories: Array.from(new Set(s.owned.filter(isAccessory))),
    kibCans: {
      basic: s.inventory[KIB_KEYS.basic] ?? 0,
      premium: s.inventory[KIB_KEYS.premium] ?? 0,
      elite: s.inventory[KIB_KEYS.elite] ?? 0,
    },
    penaltyRunup: s.penaltyRunup,
    freeKickRunup: s.freeKickRunup,
    equippedAccessories: { ...s.equipped } as Record<string, string>,
    storeSpecialsBought: Object.fromEntries(days.map((d) => [d, s.specialsBought[d]])),
    storeFirstPackBought: s.firstPackBought,
    storeLog: s.log.slice(0, 30),
  };
}

/**
 * The real shop's boot rule (page.tsx's handleBuyBoot): the same pair you are
 * wearing stacks its matches; a different pair replaces what you wore.
 */
export function wearBoughtBoot(current: Boot, boot: Boot): Boot {
  return current.id === boot.id ? { ...boot, matches: current.matches + boot.matches } : { ...boot };
}

/** "Wearing · 3 matches left" on the boot you have on. */
export function careerBootStatus(c: CareerState, bootId: string): string | null {
  const b = c.currentBoot;
  if (!b || b.id !== bootId || b.matches <= 0) return null;
  return `Wearing · ${b.matches} match${b.matches === 1 ? "" : "es"} left`;
}

function wrap(c: CareerState, r: { ok: boolean; state: StoreState; reason?: string }): CareerStoreResult {
  return r.ok ? { ok: true, career: applyStoreState(c, r.state) } : { ok: false, career: c, reason: r.reason };
}

/** Buy one of something with ★ or Coins. */
export function careerStoreBuy(
  c: CareerState, itemId: string, currency: Currency, dateKey: string, now = Date.now(),
): CareerStoreResult {
  const item = findItem(itemId);
  if (!item || !shownInCareer(item, c)) return { ok: false, career: c, reason: "Not in the store." };
  const r = buy(careerStoreState(c), itemId, currency, careerPriceContext(c), dateKey, now);
  if (!r.ok) return { ok: false, career: c, reason: r.reason };
  const next = applyStoreState(c, r.state);
  if (item.kind === "boot") return { ok: true, career: { ...next, currentBoot: wearBoughtBoot(c.currentBoot, item.boot) } };
  return { ok: true, career: next };
}

/** Wear an owned accessory, or pick an owned run-up for its set. */
export function careerStoreEquip(c: CareerState, itemId: string): CareerStoreResult {
  return wrap(c, equip(careerStoreState(c), itemId));
}

export function careerStoreUnequip(c: CareerState, slot: AccessorySlot): CareerState {
  return applyStoreState(c, unequip(careerStoreState(c), slot));
}

/** TEST MODE ONLY (the screen gates it): a pack adds its Coins, nothing charged. */
export function careerBuyCoinPack(c: CareerState, packId: string, now = Date.now()): CareerStoreResult {
  return wrap(c, buyCoinPack(careerStoreState(c), packId, now));
}

/** Swap Coins for ★ at this career's wage. */
export function careerConvertCoins(c: CareerState, coins: number, now = Date.now()): CareerStoreResult {
  return wrap(c, convertCoins(careerStoreState(c), coins, careerPriceContext(c).weeklyWage, now));
}

/** Settings → Dev: top up Coins for testing. */
export function addCoins(c: CareerState, amount: number): CareerState {
  if (!(amount > 0)) return c;
  return { ...c, coins: Math.max(0, c.coins ?? 0) + Math.round(amount) };
}

/**
 * Whether the Coin packs just add Coins (development) or read "Coming soon"
 * (a production build). There is no payment code anywhere: in production a
 * pack does nothing at all. `NODE_ENV` is inlined at build time, so the
 * deployed game can never reach the test branch.
 */
export function coinPacksAreTestMode(): boolean {
  return process.env.NODE_ENV !== "production";
}
