/**
 * THE STORE'S RULES — buying, equipping, Coin packs and swapping Coins for ★.
 *
 * Pure reducers over a small wallet-and-locker state. The test page
 * (/star-store-dev) keeps this state in its own browser storage and never
 * touches a career save; wiring it into a career later means mapping these
 * fields onto CareerState (money, runupStyle/ownedAnimations, …).
 *
 * Tested in tests/star/storePurchase.mts.
 */
import {
  basePrice, discounted, findItem, isConsumable, DEFAULT_RUNUP, DEFAULT_FREE_KICK, FREE_ANIMATIONS, ACCESSORIES,
  type AccessorySlot, type Price, type PriceContext, type StoreItem, type RunupStyleId, type FreeKickStyleId, type AnimationId,
} from "./catalogue";
import { COIN_PACKS, coinsToStars, packCoinsNow } from "./coins";
import { dailySpecials } from "./daily";

export type Currency = "stars" | "coins";

export interface StoreState {
  stars: number;
  coins: number;
  /** Ids owned for good: animations, accessories, boots. The two free
   *  Standard run-ups are implied. */
  owned: string[];
  /** Boost id → how many you are holding. */
  inventory: Record<string, number>;
  /** Equipped run-ups — one for penalties, one for free kicks. */
  penaltyRunup: RunupStyleId;
  freeKickRunup: FreeKickStyleId;
  /** One accessory per slot. */
  equipped: Partial<Record<AccessorySlot, string>>;
  /** Date key → special item ids already bought that day (one each). */
  specialsBought: Record<string, string[]>;
  /** The "first purchase: double" offer has been used. */
  firstPackBought: boolean;
  /** What was bought, newest first — the page's receipt list. */
  log: { at: number; what: string }[];
}

export const START_STATE: StoreState = {
  stars: 5_000,
  coins: 300,
  owned: [],
  inventory: {},
  penaltyRunup: DEFAULT_RUNUP,
  freeKickRunup: DEFAULT_FREE_KICK,
  equipped: {},
  specialsBought: {},
  firstPackBought: false,
  log: [],
};

export interface Result { ok: boolean; state: StoreState; reason?: string }

export function owns(state: StoreState, id: string): boolean {
  return FREE_ANIMATIONS.includes(id as AnimationId) || state.owned.includes(id);
}

/** Today's percentage off this item, if it is one of the date's specials. */
export function specialOff(itemId: string, dateKey: string): number {
  return dailySpecials(dateKey).find((s) => s.itemId === itemId)?.percentOff ?? 0;
}

/** What this item costs right now: its price, less today's special if any —
 *  unless that special has already been used today. */
export function priceNow(item: StoreItem, ctx: PriceContext, state: StoreState, dateKey: string): { price: Price; full: Price; percentOff: number } {
  const full = basePrice(item, ctx);
  const off = specialOff(item.id, dateKey);
  const used = (state.specialsBought[dateKey] ?? []).includes(item.id);
  const percentOff = off > 0 && !used ? off : 0;
  return { price: discounted(full, percentOff), full, percentOff };
}

function addLog(state: StoreState, what: string, now: number): StoreState["log"] {
  return [{ at: now, what }, ...state.log].slice(0, 30);
}

/** Buy one of something with one currency. */
export function buy(
  state: StoreState, itemId: string, currency: Currency, ctx: PriceContext, dateKey: string, now = Date.now(),
): Result {
  const item = findItem(itemId);
  if (!item) return { ok: false, state, reason: "Not in the store." };
  if (!isConsumable(item) && owns(state, item.id)) return { ok: false, state, reason: "You already own this." };

  const { price, percentOff } = priceNow(item, ctx, state, dateKey);
  const cost = currency === "stars" ? price.stars : price.coins;
  const have = currency === "stars" ? state.stars : state.coins;
  if (cost > have) {
    return { ok: false, state, reason: currency === "stars" ? "Not enough ★." : "Not enough Coins." };
  }

  const name = item.kind === "boot" ? item.boot.name : item.name;
  const next: StoreState = {
    ...state,
    stars: currency === "stars" ? state.stars - cost : state.stars,
    coins: currency === "coins" ? state.coins - cost : state.coins,
    owned: isConsumable(item) ? state.owned : [...state.owned, item.id],
    inventory: isConsumable(item) ? { ...state.inventory, [item.id]: (state.inventory[item.id] ?? 0) + 1 } : state.inventory,
    specialsBought: percentOff > 0
      ? { ...state.specialsBought, [dateKey]: [...(state.specialsBought[dateKey] ?? []), item.id] }
      : state.specialsBought,
    log: addLog(state, `${name} — ${currency === "stars" ? `★${cost.toLocaleString()}` : `${cost.toLocaleString()} Coins`}${percentOff ? ` (${percentOff}% off)` : ""}`, now),
  };
  return { ok: true, state: next };
}

/** Wear an owned accessory (replacing whatever was in its slot) or pick a run-up. */
export function equip(state: StoreState, itemId: string): Result {
  const item = findItem(itemId);
  if (!item) return { ok: false, state, reason: "Not in the store." };
  if (!owns(state, itemId)) return { ok: false, state, reason: "Buy it first." };
  if (item.kind === "animation") {
    return item.set === "penalty"
      ? { ok: true, state: { ...state, penaltyRunup: item.id as RunupStyleId } }
      : { ok: true, state: { ...state, freeKickRunup: item.id as FreeKickStyleId } };
  }
  if (item.kind === "accessory") return { ok: true, state: { ...state, equipped: { ...state.equipped, [item.slot]: item.id } } };
  return { ok: false, state, reason: "Nothing to equip." };
}

/** Take an accessory off. */
export function unequip(state: StoreState, slot: AccessorySlot): StoreState {
  const equipped = { ...state.equipped };
  delete equipped[slot];
  return { ...state, equipped };
}

/** Use one of a boost (the test page's stand-in for the career using it). */
export function spendBoost(state: StoreState, itemId: string): Result {
  const n = state.inventory[itemId] ?? 0;
  if (n <= 0) return { ok: false, state, reason: "You have none." };
  return { ok: true, state: { ...state, inventory: { ...state.inventory, [itemId]: n - 1 } } };
}

/** TEST MODE: "buying" a Coin pack just adds the Coins. Nothing is charged. */
export function buyCoinPack(state: StoreState, packId: string, now = Date.now()): Result {
  const pack = COIN_PACKS.find((p) => p.id === packId);
  if (!pack) return { ok: false, state, reason: "No such pack." };
  const add = packCoinsNow(pack, state.firstPackBought);
  return {
    ok: true,
    state: {
      ...state,
      coins: state.coins + add,
      firstPackBought: true,
      log: addLog(state, `${pack.name} pack — +${add.toLocaleString()} Coins (test, nothing charged)`, now),
    },
  };
}

/** Swap Coins for ★ at this player's rate. */
export function convertCoins(state: StoreState, coins: number, weeklyWage: number, now = Date.now()): Result {
  const n = Math.floor(coins);
  if (!(n > 0)) return { ok: false, state, reason: "Pick an amount." };
  if (n > state.coins) return { ok: false, state, reason: "Not enough Coins." };
  const stars = coinsToStars(n, weeklyWage);
  return {
    ok: true,
    state: {
      ...state,
      coins: state.coins - n,
      stars: state.stars + stars,
      log: addLog(state, `Swapped ${n.toLocaleString()} Coins → ★${stars.toLocaleString()}`, now),
    },
  };
}

/** Anything loaded from storage, made safe to use (old shapes, junk, nothing). */
export function sanitizeStoreState(raw: unknown): StoreState {
  if (!raw || typeof raw !== "object") return START_STATE;
  const r = raw as Partial<StoreState>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : d);
  const validAccessory = (slot: string, id: unknown) =>
    typeof id === "string" && ACCESSORIES.some((a) => a.id === id && a.slot === slot);
  const equipped: StoreState["equipped"] = {};
  if (r.equipped && typeof r.equipped === "object") {
    for (const [slot, id] of Object.entries(r.equipped)) if (validAccessory(slot, id)) equipped[slot as AccessorySlot] = id as string;
  }
  const anim = (id: unknown, set: "penalty" | "free_kick") => {
    const it = typeof id === "string" ? findItem(id) : undefined;
    return it?.kind === "animation" && it.set === set ? it.id : undefined;
  };
  // `runup` is this page's first shape (one slot) — it carries over as the penalty one.
  const old = (r as { runup?: unknown }).runup;
  const penaltyRunup = (anim(r.penaltyRunup, "penalty") ?? anim(old, "penalty") ?? DEFAULT_RUNUP) as RunupStyleId;
  const freeKickRunup = (anim(r.freeKickRunup, "free_kick") ?? DEFAULT_FREE_KICK) as FreeKickStyleId;
  return {
    stars: num(r.stars, START_STATE.stars),
    coins: num(r.coins, START_STATE.coins),
    owned: Array.isArray(r.owned) ? r.owned.filter((x): x is string => typeof x === "string") : [],
    inventory: r.inventory && typeof r.inventory === "object" ? { ...r.inventory } : {},
    penaltyRunup,
    freeKickRunup,
    equipped,
    specialsBought: r.specialsBought && typeof r.specialsBought === "object" ? { ...r.specialsBought } : {},
    firstPackBought: !!r.firstPackBought,
    log: Array.isArray(r.log) ? r.log.slice(0, 30) : [],
  };
}
