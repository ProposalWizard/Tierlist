/**
 * COINS — THE PREMIUM CURRENCY, AND WHY IT IS WORTH THE SAME AT EVERY STAGE.
 *
 * Harry, 27 Sep 2026: "a section to buy coins for real money that work with
 * in game scaling."
 *
 * ★ (stars) is the money you earn by playing, and it is priced in WEEKS OF
 * YOUR OWN INCOME (economy.ts). A National League player earns ★25 a week, a
 * Premier League first-teamer ★6,336. If a Coin were worth a fixed number of
 * stars, the same £0.99 pack would be a fortune at the bottom and pocket
 * change at the top.
 *
 * So a Coin is pinned to TIME, not to stars:
 *
 *     COINS_PER_WAGE_WEEK Coins  =  one week of your current wage, in ★
 *
 * With 50 per week, 100 Coins is two weeks' wages whoever you are: ★50 in the
 * National League, ★512 in League One, ★12,672 in the Premier League. The
 * Coin price of anything sold for stars follows the same rule, so a boost
 * that costs you three weeks of wages costs 150 Coins at every stage.
 *
 * Pure: no React, no storage. Tested in tests/star/storeCoins.mts.
 */

/** One week of your own wage, in Coins. The one dial for Coin value. */
export const COINS_PER_WAGE_WEEK = 50;

/** Coin prices are rounded to this, so a price never reads "143 Coins". */
export const COIN_PRICE_STEP = 5;

/** The smallest wage the maths will use — a wage of 0 (no contract yet) must
 *  not make a Coin worth nothing. Matches economy.ts's WAGE_FLOOR. */
export const MIN_WAGE_FOR_COINS = 20;

function safeWage(weeklyWage: number): number {
  return Math.max(MIN_WAGE_FOR_COINS, Number.isFinite(weeklyWage) ? weeklyWage : 0);
}

/** How many stars these Coins turn into, for a player on this weekly wage. */
export function coinsToStars(coins: number, weeklyWage: number): number {
  if (!(coins > 0)) return 0;
  return Math.round((coins / COINS_PER_WAGE_WEEK) * safeWage(weeklyWage));
}

/**
 * The Coin price of something sold for this many stars, for this player.
 * Rounded UP to the step, so paying in Coins is never cheaper than earning
 * the stars and swapping (no free money from rounding).
 */
export function coinPriceForStars(stars: number, weeklyWage: number): number {
  if (!(stars > 0)) return 0;
  const raw = (stars / safeWage(weeklyWage)) * COINS_PER_WAGE_WEEK;
  return Math.max(COIN_PRICE_STEP, Math.ceil(raw / COIN_PRICE_STEP) * COIN_PRICE_STEP);
}

/** A price written in weeks of wages, as a Coin price. Fixed at every stage. */
export function coinPriceForWeeks(weeks: number): number {
  if (!(weeks > 0)) return 0;
  return Math.max(COIN_PRICE_STEP, Math.round((weeks * COINS_PER_WAGE_WEEK) / COIN_PRICE_STEP) * COIN_PRICE_STEP);
}

/**
 * A price written in weeks of wages, as a ★ price for this player. Rounded to
 * a clean step the same shape economy.ts's `priceStep` uses, so it reads like
 * every other price in the shop.
 */
export function starPriceForWeeks(weeks: number, weeklyWage: number): number {
  if (!(weeks > 0)) return 0;
  const raw = weeks * safeWage(weeklyWage);
  const step = raw < 20 ? 1 : raw < 100 ? 5 : raw < 1_000 ? 25 : raw < 10_000 ? 100 : raw < 100_000 ? 500 : 1_000;
  return Math.max(step, Math.round(raw / step) * step);
}

/** The one plain line the page shows: "100 Coins = about 2 weeks' wages …". */
export function coinValueLine(weeklyWage: number): { coins: number; weeks: number; stars: number } {
  const coins = 100;
  return { coins, weeks: coins / COINS_PER_WAGE_WEEK, stars: coinsToStars(coins, weeklyWage) };
}

// ── Real-money packs (TEST MODE — nothing is ever charged) ─────────────────

export interface CoinPack {
  id: string;
  name: string;
  /** Pounds. Display only: this page never takes a payment. */
  pounds: number;
  coins: number;
  bestValue?: boolean;
  /** Doubled the first time any pack is bought — the one "first purchase" offer. */
  firstPurchaseDouble?: boolean;
}

/**
 * The base rate every bonus is measured against: the smallest pack, 100
 * Coins for £0.99. At 50 Coins a week that is roughly 50p per week of wages.
 */
export const BASE_COINS_PER_POUND = 100 / 0.99;

export const COIN_PACKS: CoinPack[] = [
  { id: "handful", name: "Handful", pounds: 0.99, coins: 100 },
  { id: "pouch", name: "Pouch", pounds: 2.49, coins: 260 },
  { id: "bag", name: "Bag", pounds: 4.99, coins: 550, firstPurchaseDouble: true },
  { id: "chest", name: "Chest", pounds: 9.99, coins: 1_200 },
  { id: "vault", name: "Vault", pounds: 19.99, coins: 2_600 },
  { id: "stadium", name: "Stadium", pounds: 49.99, coins: 7_000, bestValue: true },
];

/** Extra Coins over the base rate, as a whole percentage (0 for the base pack). */
export function packBonusPercent(pack: CoinPack): number {
  const base = pack.pounds * BASE_COINS_PER_POUND;
  return Math.max(0, Math.round((pack.coins / base - 1) * 100));
}

/** What buying this pack would actually add right now. */
export function packCoinsNow(pack: CoinPack, firstPurchaseUsed: boolean): number {
  return pack.firstPurchaseDouble && !firstPurchaseUsed ? pack.coins * 2 : pack.coins;
}

export function formatPounds(p: number): string {
  return `£${p.toFixed(2)}`;
}
