// The Star Pass: claiming rewards and the Locker (Mikey, 2 Oct 2026).
import { rewardLevelsOf } from "../../lib/star/starPassRewards.ts";
import { claimableLevels, claimLevel, ownsCard, isUsing, equipCard, stopUsing, isClaimed } from "../../lib/star/starPassClaim.ts";
import { BUILT_IN_CATALOGUE, DEFAULT_PASS_LEVELS, CATEGORIES, findCard, fullCatalogue } from "../../lib/star/rewardCatalogue.ts";
import type { CareerState } from "../../lib/star/types.ts";

let fail = 0;
const check = (ok: boolean, msg: string) => { if (!ok) { fail++; console.log("  ✗ " + msg); } };
const career = (stars: number, extra: Partial<CareerState> = {}) => ({ stars, ...extra }) as unknown as CareerState;

// The catalogue holds unique ids, every card in a real category, every default level filled with a real card.
const ids = BUILT_IN_CATALOGUE.map((c) => c.id);
check(new Set(ids).size === ids.length, "catalogue ids are unique");
check(BUILT_IN_CATALOGUE.every((c) => CATEGORIES.some((k) => k.id === c.category)), "every card is in a listed category");
for (const [lv, id] of Object.entries(DEFAULT_PASS_LEVELS)) check(!!findCard(id, BUILT_IN_CATALOGUE), `level ${lv}'s card ${id} exists`);
check(BUILT_IN_CATALOGUE.length >= 25, `the catalogue starts with everything already in the game (${BUILT_IN_CATALOGUE.length} cards)`);

// Claimable: reached, a card there, not claimed yet.
check(claimableLevels(career(4), DEFAULT_PASS_LEVELS).length === 0, "nothing to claim before level 5");
check(JSON.stringify(claimableLevels(career(17), DEFAULT_PASS_LEVELS)) === "[5,10,15]", "levels 5, 10, 15 claimable at 17");
check(claimableLevels(career(30), { 5: "pass-hop-penalty" }).length === 1, "an empty level has nothing to claim");
// Any level can hold a reward (5 Oct 2026): 2, 4, 6 … or 1 to 9.
check(JSON.stringify(claimableLevels(career(7), { 1: "pass-hop-penalty", 2: "a", 4: "b", 6: "c", 8: "d" })) === "[1,2,4,6]", "odd levels claimable once reached");
check(claimableLevels(career(100), { 0: "x", 101: "y", 2.5: "z" } as Record<number, string>).length === 0, "levels outside 1-100 never count");
check(JSON.stringify(rewardLevelsOf({ 2: "a", 30: "b", 7: "c" })) === "[2,7,30,100]", "road stops: every filled level plus 100");
check(JSON.stringify(rewardLevelsOf({})) === "[100]", "empty layout: only the level 100 stand");

// Claiming each kind puts it where the rest of the game looks.
const cat = fullCatalogue();
let c = career(30);
for (const lv of [5, 10, 15, 20, 25]) c = claimLevel(c, lv, findCard(DEFAULT_PASS_LEVELS[lv], cat));
check(claimableLevels(c, DEFAULT_PASS_LEVELS).length === 0, "all five claimed");
check((c.ownedAnimations ?? []).includes("skip") && (c.ownedAnimations ?? []).includes("stutter"), "run-ups go to owned animations");
check(JSON.stringify(c.ownedRewards) === JSON.stringify(["pass-red-sports-car", "pass-star-ball", "pass-gold-aviators"]), "collectibles go to the Locker");
// Claiming twice changes nothing.
const again = claimLevel(c, 5, findCard("pass-hop-penalty", cat));
check(again === c, "claiming again does nothing");
check(claimLevel(career(3), 5, findCard("pass-hop-penalty", cat)).starPassClaimed === undefined, "can't claim a level not reached");

// Using.
const hop = findCard("pass-hop-penalty", cat)!, shades = findCard("pass-gold-aviators", cat)!, ball = findCard("pass-star-ball", cat)!;
c = equipCard(c, hop);
check(c.penaltyRunup === "skip" && isUsing(c, hop), "Use picks the run-up the match plays");
c = equipCard(c, shades); c = equipCard(c, ball);
check(isUsing(c, shades) && isUsing(c, ball), "one collectible per slot, both in use");
c = stopUsing(c, hop);
check(c.penaltyRunup === "standard", "stopping a run-up goes back to Standard");
check(equipCard(career(30), hop) === career(30) || !isUsing(equipCard(career(30), hop), hop), "can't use what you don't own");
check(ownsCard(c, hop) && isClaimed(c, 5), "owns what was claimed");

// An accessory from the store's list is worn through the store's own rules.
const band = cat.find((x) => x.id === "acc-headband-white")!;
let d = claimLevel(career(10), 5, band);
d = equipCard(d, band);
check(isUsing(d, band) && (d.equippedAccessories ?? {}).head === "headband-white", "a won accessory is worn like a bought one");

console.log(fail ? `${fail} failed` : "starPassClaim: all passed");
process.exit(fail ? 1 : 0);
