import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, StarPlayer } from "../../lib/star/types";
import {
  careerStoreBuy, careerStoreEquip, careerStoreUnequip, careerStoreState, careerPriceContext, careerBuyCoinPack,
  careerConvertCoins, addCoins, shownInCareer, wearBoughtBoot, careerBootStatus, applyStoreState,
} from "../../lib/star/store/career";
import { basePrice, findItem, bootsAtLevel, BOOSTS } from "../../lib/star/store/catalogue";
import { priceNow } from "../../lib/star/store/purchase";
import { dailySpecials } from "../../lib/star/store/daily";
import { KIB_CANS, kibCanPrice } from "../../lib/star/shopData";
import { coinsToStars } from "../../lib/star/store/coins";
import { careerPenaltyRunup, careerFreeKickRunup, ownedPenaltyRunups, ownedFreeKickRunups } from "../../lib/star/runupStyles";

/**
 * THE STORE ON A REAL CAREER (lib/star/store/career.ts) — ★ is career.money,
 * a bought run-up is in ownedAnimations (Settings → Run-ups), equipping sets
 * the run-up the match plays, a KIB can lands in kibCans, a boot goes on your
 * feet the Boots shop's way, and an old save with no Coins reads as 0.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function freshStore() {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
}
freshStore();
const { saveCareer, loadCareer } = await import("../../lib/star/storage");

const player = { firstName: "Store", lastName: "Tester", age: 18, position: "CAM", club: "Arsenal", nationality: "England" } as StarPlayer;
const base = makeInitialCareer(player, ["Arsenal", "Chelsea", "Liverpool", "Man City"]);
// A day with no discount on what we buy, so prices are the full ones.
const DAY = "2026-09-28";
const specialsToday = new Set(dailySpecials(DAY).map((s) => s.itemId));
const pick = <T extends { id: string }>(xs: T[]) => xs.find((x) => !specialsToday.has(x.id))!;

const rich = (c: CareerState): CareerState => ({ ...c, money: 10_000_000, coins: 100_000, contract: { ...c.contract, wage: 500 } });
const c0 = rich(base);
const ctx = careerPriceContext(c0);
check(ctx.weeklyWage === 500, `prices use the career's real wage (${ctx.weeklyWage})`);

// ── A penalty run-up, with ★ ───────────────────────────────────────────────
const penaltyId = ["stroll", "skip", "sprint", "stutter", "two_step", "arc"].find((id) => !specialsToday.has(id))!;
const pItem = findItem(penaltyId)!;
const pPrice = basePrice(pItem, ctx);
const b1 = careerStoreBuy(c0, penaltyId, "stars", DAY);
check(b1.ok, `buying ${penaltyId} with ★ works (${b1.reason})`);
check(b1.career.money === c0.money - pPrice.stars, `★ deducted exactly: ${c0.money} − ${pPrice.stars} = ${b1.career.money}`);
check(b1.career.coins === c0.coins, "Coins untouched by a ★ buy");
check((b1.career.ownedAnimations ?? []).includes(penaltyId), "the run-up is in ownedAnimations");
check(ownedPenaltyRunups(b1.career.ownedAnimations).some((s) => s.id === penaltyId), "Settings → Run-ups lists it");
check(careerPenaltyRunup(b1.career) === "standard", "buying doesn't equip it");
check(!careerStoreBuy(b1.career, penaltyId, "stars", DAY).ok, "can't buy the same run-up twice");

const e1 = careerStoreEquip(b1.career, penaltyId);
check(e1.ok && e1.career.penaltyRunup === penaltyId, "equipping sets career.penaltyRunup");
check(careerPenaltyRunup(e1.career) === penaltyId, "the match's reader returns it");
check(careerFreeKickRunup(e1.career) === "fk_standard", "the free-kick run-up is left alone");
check(!careerStoreEquip(c0, "arc").ok || c0.ownedAnimations?.includes("arc"), "can't equip one you don't own");

// ── A free-kick run-up, with Coins ────────────────────────────────────────
const fkId = ["fk_power_stance", "fk_stance_sprint", "fk_calm_curl", "fk_stutter_curl", "fk_angled_whip", "fk_long_diagonal"].find((id) => !specialsToday.has(id))!;
const fkPrice = basePrice(findItem(fkId)!, ctx);
const b2 = careerStoreBuy(e1.career, fkId, "coins", DAY);
check(b2.ok, `buying ${fkId} with Coins works`);
check(b2.career.coins === e1.career.coins! - fkPrice.coins, `Coins deducted exactly: ${e1.career.coins} − ${fkPrice.coins} = ${b2.career.coins}`);
check(b2.career.money === e1.career.money, "★ untouched by a Coins buy");
const e2 = careerStoreEquip(b2.career, fkId);
check(e2.career.freeKickRunup === fkId && e2.career.penaltyRunup === penaltyId, "free-kick run-up equipped, penalty one kept");
check(ownedFreeKickRunups(e2.career.ownedAnimations).some((s) => s.id === fkId), "Settings lists the free-kick run-up");

// ── Not enough money ──────────────────────────────────────────────────────
const poor = { ...c0, money: 0, coins: 0 };
const f1 = careerStoreBuy(poor, penaltyId, "stars", DAY);
check(!f1.ok && f1.career === poor && f1.reason === "Not enough ★.", "can't buy with no ★, and nothing changes");
check(!careerStoreBuy(poor, penaltyId, "coins", DAY).ok, "can't buy with no Coins");

// ── A KIB can lands in kibCans, at the real shop's price ──────────────────
const can = KIB_CANS[0];
const canItem = BOOSTS.find((b) => b.canId === can.id)!;
const canPrice = priceNow(canItem, ctx, careerStoreState(c0), DAY).price.stars;
const k1 = careerStoreBuy(c0, canItem.id, "stars", DAY);
check(k1.ok, "buying a KIB can works");
check(k1.career.kibCans[can.id] === c0.kibCans[can.id] + 1, `kibCans.${can.id}: ${c0.kibCans[can.id]} → ${k1.career.kibCans[can.id]}`);
if (!specialsToday.has(canItem.id)) check(canPrice === kibCanPrice(can, 500), `same price as the real shop (★${canPrice} vs ★${kibCanPrice(can, 500)})`);
check(k1.career.money === c0.money - canPrice, "★ deducted for the can");
check(careerStoreBuy(k1.career, canItem.id, "stars", DAY).career.kibCans[can.id] === c0.kibCans[can.id] + 2, "cans can be bought again (+1 each)");

// ── Ideas not in the game yet aren't sold ─────────────────────────────────
check(!shownInCareer(findItem("training-boost")!) && !shownInCareer(findItem("stat-can")!), "Training Boost and Stat Can hidden");
check(!careerStoreBuy(c0, "stat-can", "stars", DAY).ok, "and can't be bought");

// ── Boots: the Boots shop's rule ──────────────────────────────────────────
const boot = pick(bootsAtLevel(ctx.level)).boot;
const bt1 = careerStoreBuy(c0, boot.id, "stars", DAY);
check(bt1.ok && bt1.career.currentBoot.id === boot.id && bt1.career.currentBoot.matches === boot.matches, "a bought boot goes on your feet");
check(bt1.career.money === c0.money - boot.price, "at the Boots shop's ★ price");
const bt2 = careerStoreBuy(bt1.career, boot.id, "coins", DAY);
check(bt2.ok && bt2.career.currentBoot.matches === boot.matches * 2, "buying the same pair again stacks its matches");
check(careerBootStatus(bt2.career, boot.id) === `Wearing · ${boot.matches * 2} matches left`, "boot card says Wearing");
check(wearBoughtBoot({ ...boot, id: "other", matches: 5 }, boot).matches === boot.matches, "a different pair replaces the old one");

// ── Accessories ───────────────────────────────────────────────────────────
const acc = pick([{ id: "headband-white" }, { id: "tape-white" }, { id: "sleeves-black" }]).id;
const a1 = careerStoreBuy(c0, acc, "stars", DAY);
check(a1.ok && (a1.career.ownedAccessories ?? []).includes(acc), "an accessory goes into ownedAccessories");
check(!(a1.career.ownedAnimations ?? []).includes(acc), "…not ownedAnimations");
const a2 = careerStoreEquip(a1.career, acc);
const slot = (findItem(acc) as { slot: string }).slot;
check(a2.career.equippedAccessories?.[slot] === acc, "wearing it sets equippedAccessories");
check(careerStoreUnequip(a2.career, slot as never).equippedAccessories?.[slot] === undefined, "taking it off clears the slot");

// ── Daily special: discounted once per career per day ─────────────────────
const special = dailySpecials(DAY).find((s) => { const it = findItem(s.itemId); return it && shownInCareer(it) && it.kind !== "boost"; });
if (special) {
  const it = findItem(special.itemId)!;
  const full = basePrice(it, ctx).stars;
  const s1 = careerStoreBuy(c0, it.id, "stars", DAY);
  check(s1.ok && c0.money - s1.career.money < full, `today's special is cheaper (${c0.money - s1.career.money} < ${full})`);
  check((s1.career.storeSpecialsBought?.[DAY] ?? []).includes(it.id), "the special is marked used on the career");
  const other = { ...rich(base) };
  check(careerStoreBuy(other, it.id, "stars", DAY).ok, "another career still gets it");
}

// ── Coins: packs (test mode) and swapping ─────────────────────────────────
const p1 = careerBuyCoinPack({ ...c0, coins: 0 }, "handful");
check(p1.ok && p1.career.coins === 100, `the Handful pack adds 100 Coins (${p1.career.coins})`);
const p2 = careerBuyCoinPack({ ...c0, coins: 0 }, "bag");
check(p2.career.coins === 1100 && p2.career.storeFirstPackBought === true, "first pack: the Bag doubles, once");
check(careerBuyCoinPack(p2.career, "bag").career.coins === 1100 + 550, "second time it doesn't");
const sw = careerConvertCoins(c0, 100);
check(sw.ok && sw.career.coins === c0.coins! - 100 && sw.career.money === c0.money + coinsToStars(100, 500), `100 Coins → ★${coinsToStars(100, 500)} at a ★500 wage`);
check(!careerConvertCoins({ ...c0, coins: 50 }, 100).ok, "can't swap Coins you don't have");
check(addCoins({ ...c0, coins: undefined }, 500).coins === 500, "dev + Coins from none");

// ── A career with no store fields at all reads cleanly ────────────────────
const bare = { ...base } as CareerState;
delete (bare as { coins?: number }).coins;
const st = careerStoreState(bare);
check(st.coins === 0 && st.owned.length === 0 && Object.keys(st.equipped).length === 0, "no store fields → empty locker, 0 Coins");
check(applyStoreState(bare, st).money === bare.money, "round trip keeps money");

// ── An old save without `coins` loads as 0 ────────────────────────────────
{
  const old = { ...base } as CareerState & { coins?: number };
  delete old.coins;
  saveCareer(old, "store-test");
  const loaded = loadCareer("store-test");
  check(loaded?.coins === 0, `an old save loads with 0 Coins (${loaded?.coins})`);
  saveCareer({ ...base, coins: 250 }, "store-test");
  check(loadCareer("store-test")?.coins === 250, "Coins survive save → load");
}

if (problems.length) { console.error("storeCareer FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("storeCareer: all passed");
