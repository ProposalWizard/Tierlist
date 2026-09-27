import {
  COINS_PER_WAGE_WEEK, coinsToStars, coinPriceForStars, coinPriceForWeeks, starPriceForWeeks,
  coinValueLine, COIN_PACKS, packBonusPercent, packCoinsNow,
} from "../../lib/star/store/coins";
import { typicalWeeklyWage } from "../../lib/star/economy";

/**
 * STORE COINS — a Coin is worth the same slice of a career at every stage.
 * Harry, 27 Sep 2026: "a section to buy coins for real money that work with
 * in game scaling."
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 100 Coins is two weeks' wages at every stage of the ladder.
const stages = ["national_league", "league_two", "league_one", "championship", "premier"] as const;
for (const d of stages) {
  const wage = Math.round(typicalWeeklyWage(d));
  const stars = coinsToStars(100, wage);
  check(stars === 2 * wage, `${d}: 100 Coins = 2 weeks (${stars} vs wage ${wage})`);
  const line = coinValueLine(wage);
  check(line.weeks === 100 / COINS_PER_WAGE_WEEK && line.stars === stars, `${d}: the page's maths line agrees`);
}

// A price written in weeks costs the SAME Coins whoever you are.
for (const w of [0.5, 1, 3, 6, 12]) {
  check(coinPriceForWeeks(w) === Math.round(w * COINS_PER_WAGE_WEEK / 5) * 5, `${w} weeks → fixed Coin price`);
}
// …and a ★ price that is N weeks of your wage costs N weeks of Coins.
for (const wage of [25, 256, 6336, 29831]) {
  const stars = 3 * wage;
  check(coinPriceForStars(stars, wage) === 150, `3 weeks of ★ at wage ${wage} = 150 Coins (got ${coinPriceForStars(stars, wage)})`);
}

// Never cheaper to pay Coins than to swap Coins → ★ and pay stars.
for (const wage of [25, 80, 256, 1152, 6336]) {
  for (const stars of [13, 365, 999, 1200, 27_500, 35_000]) {
    const coins = coinPriceForStars(stars, wage);
    check(coinsToStars(coins, wage) >= stars, `wage ${wage}, ★${stars}: ${coins} Coins swap to at least the price`);
    check(coins % 5 === 0 && coins >= 5, `wage ${wage}, ★${stars}: Coin price is a clean step`);
  }
}

// ★ prices from weeks scale with the wage and round cleanly.
check(starPriceForWeeks(1, 25) === 25, `1 week at ★25 = ★25 (${starPriceForWeeks(1, 25)})`);
check(starPriceForWeeks(12, 6336) === 76_000, `12 weeks at ★6,336 = ★76,000 (${starPriceForWeeks(12, 6336)})`);

// A zero / missing wage never makes Coins worthless.
check(coinsToStars(100, 0) > 0, "no wage yet still gives stars");
check(coinPriceForStars(100, 0) > 0, "no wage yet still has a Coin price");

// Packs: bigger packs, bigger bonus; one best value; one first-purchase double.
const bonuses = COIN_PACKS.map(packBonusPercent);
for (let i = 1; i < bonuses.length; i++) check(bonuses[i] > bonuses[i - 1], `pack ${i} has a bigger bonus than pack ${i - 1} (${bonuses.join(", ")})`);
check(bonuses[0] === 0, "the smallest pack is the base rate");
check(COIN_PACKS.filter((p) => p.bestValue).length === 1, "exactly one best-value pack");
check(COIN_PACKS.filter((p) => p.firstPurchaseDouble).length === 1, "exactly one first-purchase double");
const dbl = COIN_PACKS.find((p) => p.firstPurchaseDouble)!;
check(packCoinsNow(dbl, false) === dbl.coins * 2 && packCoinsNow(dbl, true) === dbl.coins, "double only the first time");
check(COIN_PACKS.length >= 5 && COIN_PACKS.length <= 6, "5–6 packs");

if (problems.length) { console.error("storeCoins FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log(`storeCoins: all passed (bonuses ${bonuses.join("/")}%)`);
