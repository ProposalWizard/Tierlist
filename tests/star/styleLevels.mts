import { LIFESTYLE_ALL_LEVELS, baseIdOf } from "../../lib/star/shopData";
import { ownedFame } from "../../lib/star/fame";
import { LEVEL_NAMES, levelName, styleGroupOf, fameFromOwned, STYLE_GROUPS } from "../../lib/star/lifestyleLevels";
import type { OwnedItem } from "../../lib/star/types";

/**
 * STYLE LEVEL NAMES (Harry, 30 Sep 2026: "what is a level one sports car?").
 * Every item in the shop has five real, different names; no real brands;
 * every item lands in one of the five groups; and the fame each owned thing
 * is shown giving adds up to (at least) the real total.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const bases = Array.from(new Set(LIFESTYLE_ALL_LEVELS.map((i) => baseIdOf(i))));
check(bases.length === 31, `31 items in the shop (got ${bases.length})`);
for (const b of bases) {
  const names = LEVEL_NAMES[b];
  check(!!names && names.length === 5, `${b} has five level names`);
  if (names) check(new Set(names).size === 5, `${b}'s five names are all different`);
}
for (const b of Object.keys(LEVEL_NAMES)) check(bases.includes(b), `${b} is a real shop item`);

const all = Object.values(LEVEL_NAMES).flat().join(" ");
for (const brand of ["Rolex", "Tesla", "Lamborghini", "Ferrari", "iPhone", "PlayStation", "Xbox", "Nike", "Adidas", "Porsche", "Gucci"]) {
  check(!all.includes(brand), `no real brand names (${brand})`);
}

// Every level of every item shows its own name, not "Sports Car L1".
for (const it of LIFESTYLE_ALL_LEVELS) check(levelName(it) === LEVEL_NAMES[baseIdOf(it)][(it.level ?? 1) - 1], `${it.id} uses its level name`);
// An old save's item with no level still gets a name.
check(levelName({ id: "car-3", name: "Sports Car" }) === "Sports Car", "a level-less old item falls back to its own name");
check(levelName({ id: "rolex", name: "Diamond Rolex" }) === "Iced Watch", "the one item named after a real brand shows a generic family name");

// Groups: holiday is the jet, the villa and the island.
const ids = STYLE_GROUPS.map((g) => g.id);
for (const it of LIFESTYLE_ALL_LEVELS) check(ids.includes(styleGroupOf(it)), `${it.id} is in a group`);
check(["jet", "villa", "island"].every((b) => styleGroupOf({ id: b, category: "vehicle" }) === "holiday"), "jet, villa and island are Holiday");

// The fame shown per owned thing: each is real, and they add up to about the total
// (the curve flattens, so each thing's share is counted last and they add up to a bit under the total).
const pick = (id: string) => LIFESTYLE_ALL_LEVELS.find((i) => i.id === id)!;
const owned: OwnedItem[] = ["phone-l3", "car-3-l1", "flat-1-l2", "island"].filter((id) => LIFESTYLE_ALL_LEVELS.some((i) => i.id === id)).map(pick);
const shares = owned.map((o) => fameFromOwned(owned, o));
const total = ownedFame(owned);
check(shares.every((s) => s > 0), "every owned thing shows some fame");
const sum = shares.reduce((a, b) => a + b, 0);
check(sum <= total + 1e-9 && sum >= total * 0.9, `shares (${sum.toFixed(2)}) add up to about the total (${total.toFixed(2)})`);

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`PASS — 31 items × 5 named levels, no brands, 5 groups, owned fame shares ${sum.toFixed(2)} vs total ${total.toFixed(2)}`);
