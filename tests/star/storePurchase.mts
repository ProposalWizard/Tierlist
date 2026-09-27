import {
  START_STATE, buy, equip, unequip, spendBoost, buyCoinPack, convertCoins, owns, priceNow, sanitizeStoreState,
  type StoreState,
} from "../../lib/star/store/purchase";
import {
  ANIMATIONS, ACCESSORIES, BOOSTS, bootsAtLevel, basePrice, RARITY_WEEKS, isPayToWin, findItem,
} from "../../lib/star/store/catalogue";
import { dailySpecials } from "../../lib/star/store/daily";
import { KIB_CANS, kibCanPrice } from "../../lib/star/shopData";
import { COIN_PACKS, coinsToStars } from "../../lib/star/store/coins";

/** THE STORE'S RULES — buying with either currency, equipping, packs, swaps. */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const ctx = { weeklyWage: 256, level: 3 };
const DAY = "2026-09-27";
const rich: StoreState = { ...START_STATE, stars: 1_000_000, coins: 100_000 };

// Catalogue shape.
const pens = ANIMATIONS.filter((a) => a.set === "penalty").map((a) => a.id).join();
const fks = ANIMATIONS.filter((a) => a.set === "free_kick").map((a) => a.id).join();
check(pens === "standard,stroll,skip,sprint,stutter,two_step,arc", `the 7 penalty run-ups, in the contract's order (${pens})`);
check(fks === "fk_standard,fk_power_stance,fk_bale,fk_messi,fk_neymar,fk_maddison,fk_trent", `the 7 free-kick run-ups (${fks})`);
check(ANIMATIONS.filter((a) => a.free).map((a) => a.id).join() === "standard,fk_standard", "only the two Standards are free");
check(owns(START_STATE, "standard") && owns(START_STATE, "fk_standard"), "everyone owns both Standards");
check(basePrice(findItem("fk_standard")!, ctx).stars === 0, "free-kick Standard costs nothing");
check(new Set(ACCESSORIES.map((a) => a.id)).size === ACCESSORIES.length, "accessory ids unique");
check(ACCESSORIES.every((a) => !isPayToWin(a)) && ANIMATIONS.every((a) => !isPayToWin(a)), "cosmetics are cosmetic");
check(BOOSTS.every((b) => isPayToWin(b)), "boosts help you win");

// Prices: a cosmetic costs its rarity in weeks, both ways.
for (const a of ACCESSORIES) {
  const p = basePrice(a, ctx);
  check(p.coins === RARITY_WEEKS[a.rarity] * 50, `${a.id}: ${p.coins} Coins`);
  check(Math.abs(p.stars / (RARITY_WEEKS[a.rarity] * 256) - 1) <= 0.05, `${a.id}: ★${p.stars} ≈ ${RARITY_WEEKS[a.rarity]} weeks of ★256`);
}
// Boosts reuse the real shop's prices — never a second copy.
for (const c of KIB_CANS) {
  const b = BOOSTS.find((x) => x.canId === c.id)!;
  check(basePrice(b, ctx).stars === kibCanPrice(c, 256), `${c.id} can: the real shop's price`);
}
for (const bi of bootsAtLevel(3)) check(basePrice(bi, ctx).stars === bi.boot.price, `${bi.boot.name}: the real shop's price`);
check(bootsAtLevel(1).length === bootsAtLevel(5).length && bootsAtLevel(1).length >= 10, "every level sells the whole boot range");
// The stat can climbs in weeks with level (a rating converter).
const statWeeks = [1, 2, 3, 4, 5].map((level) => basePrice(findItem("stat-can")!, { weeklyWage: 100, level }).weeks);
for (let i = 1; i < 5; i++) check(statWeeks[i] > statWeeks[i - 1], `stat can costs more weeks at level ${i + 1} (${statWeeks.join("/")})`);

// Buying a cosmetic with ★, then again → refused. Coins path the same.
const acc = ACCESSORIES.find((a) => !dailySpecials(DAY).some((s) => s.itemId === a.id))!;
let r = buy(rich, acc.id, "stars", ctx, DAY);
check(r.ok && owns(r.state, acc.id), "buy with ★");
check(r.state.stars === rich.stars - basePrice(acc, ctx).stars && r.state.coins === rich.coins, "★ taken, Coins untouched");
check(!buy(r.state, acc.id, "coins", ctx, DAY).ok, "can't buy a cosmetic twice");
r = buy(rich, acc.id, "coins", ctx, DAY);
check(r.ok && r.state.coins === rich.coins - basePrice(acc, ctx).coins && r.state.stars === rich.stars, "buy with Coins");

// Not enough money → refused, state unchanged.
const poor = { ...START_STATE, stars: 0, coins: 0 };
const nope = buy(poor, acc.id, "stars", ctx, DAY);
check(!nope.ok && nope.state === poor && nope.reason === "Not enough ★.", "poor: no ★");
check(buy(poor, acc.id, "coins", ctx, DAY).reason === "Not enough Coins.", "poor: no Coins");

// Equip: only what you own, one per slot.
const two = ACCESSORIES.filter((a) => a.slot === "boots");
let s = rich;
for (const a of two) s = buy(s, a.id, "stars", ctx, DAY).state;
check(!equip(START_STATE, two[0].id).ok, "can't wear what you don't own");
s = equip(s, two[0].id).state; s = equip(s, two[1].id).state;
check(s.equipped.boots === two[1].id, "a second boot colour replaces the first");
check(unequip(s, "boots").equipped.boots === undefined, "take it off");
const sprint = buy(rich, "sprint", "coins", ctx, DAY).state;
const eqs = equip(sprint, "sprint").state;
check(eqs.penaltyRunup === "sprint" && eqs.freeKickRunup === "fk_standard", "a penalty run-up goes in the penalty slot only");
const trent = buy(eqs, "fk_trent", "coins", ctx, "2099-01-01").state;
const eqt = equip(trent, "fk_trent").state;
check(eqt.freeKickRunup === "fk_trent" && eqt.penaltyRunup === "sprint", "a free-kick run-up goes in its own slot, penalty kept");
check(equip(START_STATE, "standard").ok && equip(START_STATE, "fk_standard").ok, "both Standards can always be picked");
check(!equip(START_STATE, "fk_messi").ok, "can't pick a free-kick run-up you don't own");

// Boosts stack in the locker and get used up.
let bs = buy(rich, "kib-basic", "stars", ctx, DAY).state;
bs = buy(bs, "kib-basic", "coins", ctx, "2099-01-01").state;
check(bs.inventory["kib-basic"] === 2, "two cans held");
bs = spendBoost(bs, "kib-basic").state;
check(bs.inventory["kib-basic"] === 1 && !spendBoost({ ...bs, inventory: {} }, "kib-basic").ok, "use one; none left refuses");

// Daily specials: discounted once per day each.
const sp = dailySpecials(DAY)[0];
const item = findItem(sp.itemId)!;
const now1 = priceNow(item, ctx, rich, DAY);
check(now1.percentOff === sp.percentOff && now1.price.coins < now1.full.coins && now1.price.stars < now1.full.stars, `${sp.itemId}: ${sp.percentOff}% off both prices`);
const afterSpecial = buy(rich, sp.itemId, "stars", ctx, DAY).state;
check(afterSpecial.stars === rich.stars - now1.price.stars, "paid the special price");
check(priceNow(item, ctx, afterSpecial, DAY).percentOff === 0, "the special is used up for the day");
check(priceNow(item, ctx, rich, "2099-01-01").percentOff === 0 || dailySpecials("2099-01-01").some((x) => x.itemId === sp.itemId), "no discount on a day it isn't special");

// Coin packs (test mode) and the first-purchase double.
const dbl = COIN_PACKS.find((p) => p.firstPurchaseDouble)!;
let cp = buyCoinPack(START_STATE, dbl.id).state;
check(cp.coins === START_STATE.coins + dbl.coins * 2 && cp.firstPackBought, "first pack doubled");
cp = buyCoinPack(cp, dbl.id).state;
check(cp.coins === START_STATE.coins + dbl.coins * 3, "second time not doubled");
check(cp.log[0].what.includes("nothing charged"), "the receipt says it was a test");

// Swapping Coins for ★ at the player's rate.
const sw = convertCoins({ ...START_STATE, coins: 100, stars: 0 }, 100, 6336).state;
check(sw.coins === 0 && sw.stars === coinsToStars(100, 6336) && sw.stars === 12_672, `100 Coins → ★${sw.stars} in the Premier League`);
check(!convertCoins(START_STATE, START_STATE.coins + 1, 100).ok, "can't swap more than you have");

// Loading junk never breaks the page.
check(sanitizeStoreState(null) === START_STATE, "nothing saved → start state");
const junk = sanitizeStoreState({ stars: "lots", coins: -5, owned: [1, "arc"], equipped: { boots: "headband-white", head: "headband-white" }, runup: "moonwalk" });
check(junk.stars === START_STATE.stars && junk.coins === 0 && junk.owned.join() === "arc", "junk numbers and lists cleaned");
check(junk.equipped.head === "headband-white" && junk.equipped.boots === undefined && junk.penaltyRunup === "standard" && junk.freeKickRunup === "fk_standard", "wrong-slot and unknown ids dropped");
const oldShape = sanitizeStoreState({ runup: "arc", owned: ["arc"] });
check(oldShape.penaltyRunup === "arc", "the page's first one-slot save carries over as the penalty run-up");
check(sanitizeStoreState({ penaltyRunup: "fk_trent", freeKickRunup: "arc" }).penaltyRunup === "standard"
  && sanitizeStoreState({ penaltyRunup: "fk_trent", freeKickRunup: "arc" }).freeKickRunup === "fk_standard", "a run-up in the wrong set's slot is dropped");

if (problems.length) { console.error("storePurchase FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("storePurchase: all passed");
