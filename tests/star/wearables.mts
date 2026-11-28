/**
 * WHAT YOU BUY, ON YOUR PLAYER (lib/star/wearables.ts; Harry, 28 Nov 2026). The pure parts:
 *  - every shop boot (every family, every level) maps to a look; the level ladder reads the same on every family;
 *  - every Style shop item is either worn (WEARABLE_ITEMS) or listed as not worn (NOT_WORN): none missing;
 *  - every wearable item at every level has a look, and a higher level is never plainer;
 *  - the wardrobe's Extras save and load (an old save with none, a save after a buy, a sold item, "none");
 *  - the Designer Suit appears on the Clothes rail only when owned, and falls back when it is gone;
 *  - the boot look survives the trip through the body's accessory (people3d.ts WornThing).
 */
import { BOOT_LEVELS, LIFESTYLE_LEVELS } from "../../lib/star/shopDefaults";
import {
  bootLookOf, bootWorn, bootLookFromWorn, BOOT_FAMILY, PLAIN_BOOTS, WEARABLE_ITEMS, NOT_WORN, UNSOLD_WEARABLES,
  accessoryLook, ownedWearables, wornExtras, designerSuitColours, designerSuitLevel, baseIdOf, levelOf,
} from "../../lib/star/wearables";
import { outfitOf, withOutfit, wornAt, casualSetsFor, CASUAL_SETS } from "../../lib/star/home3d/outfits";
import { homeSetCloth } from "../../lib/star/style3d/toon/clothes/casual";
import type { Boot, CareerState, OwnedItem } from "../../lib/star/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const HEX = /^#[0-9a-f]{6}$/i;

// ── boots ──
const families = new Set(BOOT_LEVELS.map((b) => b.baseId ?? b.id));
for (const f of families) check(!!BOOT_FAMILY[f], `boot family ${f} has a colourway`);
for (const b of BOOT_LEVELS) {
  const l = bootLookOf(b);
  check(l.family === (b.baseId ?? b.id), `${b.id}: its own family (got ${l.family})`);
  check(l.level === (b.level ?? 0), `${b.id}: level ${b.level} (got ${l.level})`);
  for (const k of ["upper", "sole", "studs", "accent"] as const) check(HEX.test(l[k]), `${b.id}: ${k} is a colour`);
  check(l.heel === (l.level >= 2) && l.flash === (l.level >= 3), `${b.id}: heel from L2, flash from L3`);
  // the same boot by its id alone (a save that lost baseId/level) reads the same
  const byId = bootLookOf({ id: b.id } as Boot);
  check(byId.family === l.family && byId.level === l.level, `${b.id}: read from its id alone (${byId.family} L${byId.level})`);
  const back = bootLookFromWorn(bootWorn(l));
  check(!!back && back.upper === l.upper && back.sole === l.sole && back.studs === l.studs && back.accent === l.accent && back.heel === l.heel && back.flash === l.flash, `${b.id}: the look survives the body's accessory`);
}
// every level of one family looks different from the level below it
for (const f of families) {
  const ls = [1, 2, 3, 4, 5].map((lv) => bootLookOf(BOOT_LEVELS.find((b) => (b.baseId ?? b.id) === f && b.level === lv)!));
  for (let i = 1; i < 5; i++) check(JSON.stringify({ ...ls[i], level: 0 }) !== JSON.stringify({ ...ls[i - 1], level: 0 }), `${f}: L${i + 1} looks different from L${i}`);
}
check(JSON.stringify(bootLookOf(null)) === JSON.stringify(PLAIN_BOOTS), "no boots: the plain pair");
check(bootLookOf({ id: "galaxy" } as Boot).family === "plain", "a boot the shop no longer sells: the plain pair");
check(bootLookFromWorn({ color: "#141416" }) === null, "a plain colour (every older caller) stays one colour");
// an old save's boot with no level: its own rung's level (NS-Flash is a Semi-Pro boot, level 2)
check(levelOf({ id: "speed" }, "boots") === 2 && bootLookOf({ id: "speed" } as Boot).level === 2, "an old boot with no level: its own rung");

// ── the Style shop: every item is worn or not ──
const shopBases = new Set(LIFESTYLE_LEVELS.filter((i) => i.category === "item").map((i) => i.baseId ?? i.id));
for (const b of shopBases) check(!!WEARABLE_ITEMS[b] !== (NOT_WORN as readonly string[]).includes(b), `shop item ${b}: worn or not worn (exactly one)`);
for (const b of Object.keys(WEARABLE_ITEMS)) check(shopBases.has(b), `wearable ${b} is a shop item`);
for (const b of Object.keys(UNSOLD_WEARABLES)) check(!shopBases.has(b), `${b} is still marked unsold but the shop sells it: move it to WEARABLE_ITEMS`);
const wearableLevels = LIFESTYLE_LEVELS.filter((i) => WEARABLE_ITEMS[i.baseId ?? i.id]);
check(wearableLevels.length === 9 * 5, `9 wearables × 5 levels in the shop, the cap and sunglasses included (got ${wearableLevels.length})`);
for (const b of ["cap", "shades"]) check(shopBases.has(b) && !!WEARABLE_ITEMS[b], `${b} is sold and worn`);
for (const it of wearableLevels) {
  const base = it.baseId ?? it.id, w = WEARABLE_ITEMS[base];
  if (w.kind === "suit") {
    const c = designerSuitColours(it.level ?? 1);
    check(Object.values(c).every((x) => HEX.test(x)), `${it.id}: suit colours`);
    continue;
  }
  const l = accessoryLook(base, it.level ?? 1);
  check(!!l, `${it.id}: has a look`);
  if (!l) continue;
  check(l.slot === w.slot && l.kind === w.kind, `${it.id}: worn on the ${w.slot}`);
  check([l.main, l.second, l.detail].every((x) => HEX.test(x)), `${it.id}: colours`);
  check(l.shine >= 0 && l.shine <= 1 && l.thick > 0 && l.thick < 0.01, `${it.id}: shine and thickness in range`);
}
// a higher level is never plainer: shine and stones never go down
for (const base of [...Object.keys(WEARABLE_ITEMS), ...Object.keys(UNSOLD_WEARABLES)]) {
  if (base === "suit") continue;
  for (let lv = 2; lv <= 5; lv++) {
    const a = accessoryLook(base, lv - 1)!, b = accessoryLook(base, lv)!;
    check(b.shine >= a.shine && b.stones >= a.stones && b.thick >= a.thick, `${base}: L${lv} at least as rich as L${lv - 1}`);
  }
}
for (const u of Object.keys(UNSOLD_WEARABLES)) check(!!accessoryLook(u, 3), `unsold design ${u} has a look`);

// ── owning and wearing ──
const item = (id: string): OwnedItem => { const it = LIFESTYLE_LEVELS.find((x) => x.id === id); if (!it) throw new Error(`no shop item ${id}`); return { ...it }; };
const goldL = LIFESTYLE_LEVELS.find((x) => (x.baseId ?? x.id) === "gold" && x.level === 5)!.id;
const silverL = LIFESTYLE_LEVELS.find((x) => (x.baseId ?? x.id) === "silver" && x.level === 1)!.id;
const smartL = LIFESTYLE_LEVELS.find((x) => (x.baseId ?? x.id) === "smartwatch" && x.level === 2)!.id;
const suitL = LIFESTYLE_LEVELS.find((x) => (x.baseId ?? x.id) === "suit" && x.level === 4)!.id;
type C = Pick<CareerState, "outfit" | "currentBoot" | "ownedItems">;
const oldSave = { outfit: { wear: "casual", casual: "tee", kit: "home", boots: "own" }, currentBoot: null, ownedItems: [item("phone"), item(goldL)] } as unknown as C;
check(outfitOf(oldSave).extras === undefined, "an old save loads with no Extras");
let w = wornAt(oldSave, "home");
check((w.extras ?? []).length === 1 && w.extras![0].kind === "watch" && w.extras![0].level === 5, "an old save that owns a Gold Watch L5 wears it (best owned, nothing picked)");
check((wornAt(oldSave, "training").extras ?? []).length === 0, "training: no watch or chain");
// buy a smartwatch and a chain: the best watch stays on the wrist, the chain goes on
const bought = { ...oldSave, ownedItems: [...oldSave.ownedItems, item(smartL), item(silverL), item(suitL)] } as C;
check(ownedWearables(bought).length === 4, "four wearables owned (watch, smartwatch, chain, suit)");
w = wornAt(bought, "garden");
check(w.extras!.map((x) => x.slot).join(",") === "wrist,neck", `wrist and neck worn (got ${w.extras!.map((x) => x.slot)})`);
// pick the smartwatch, take the chain off: saved, and survives a save + load
const picked = withOutfit(bought, { extras: { wrist: smartL, neck: "none" } });
const loaded = JSON.parse(JSON.stringify(picked)) as C;
check(JSON.stringify(outfitOf(loaded)) === JSON.stringify(outfitOf(picked)), "the Extras survive a save and load");
w = wornAt(loaded, "shop");
check(w.extras!.length === 1 && w.extras![0].kind === "smartwatch" && w.extras![0].level === 2, "the picked smartwatch, no chain");
// a picked item that is gone (sold): nothing on that wrist, never someone else's
const sold = { ...loaded, ownedItems: loaded.ownedItems.filter((i) => i.id !== smartL) } as C;
check(wornAt(sold, "home").extras!.every((x) => x.slot !== "wrist"), "a sold watch is not worn");
// junk in a save is dropped
check(outfitOf({ outfit: { wear: "kit", casual: "x", kit: "home", extras: { wrist: 7 as unknown as string, neck: "x".repeat(99) } } } as C).extras === undefined, "junk Extras are dropped");
// the Designer Suit: on the rail when owned, worn as a closed suit, falls back when gone
check(casualSetsFor(oldSave).length === CASUAL_SETS.length, "no suit owned: the five sets");
check(casualSetsFor(bought).some((s) => s.id === "designer"), "suit owned: on the Clothes rail");
check(designerSuitLevel(bought) === 4, "the suit's level");
const inSuit = withOutfit(bought, { wear: "casual", casual: "designer" });
w = wornAt(inSuit, "garden");
check(w.kind === "casual" && w.set.id === "designer", "wearing the Designer Suit");
check(homeSetCloth("designer", w.kind === "casual" ? w.set.colours({ shirt: "#f00", trim: "#fff" }) : {}).kind === "suit", "the Designer Suit is the cloth suit");
const gone = { ...inSuit, ownedItems: inSuit.ownedItems.filter((i) => i.id !== suitL) } as C;
w = wornAt(gone, "garden");
check(w.kind === "casual" && w.set.id === "hoodie", "the suit gone: the hoodie");
// kit worn: the boots' colourway rides along
const booted = { ...bought, outfit: { wear: "kit", casual: "hoodie", kit: "home" }, currentBoot: BOOT_LEVELS.find((b) => b.id.startsWith("maestro") && b.level === 4) } as unknown as C;
w = wornAt(booted, "training");
check(w.kind === "kit" && w.bootLook?.family === "maestro" && w.bootLook.level === 4, "training: your boots' look");
check(wornAt({ ...booted, outfit: { ...booted.outfit!, boots: "plain" } }, "home").kind === "kit" && (wornAt({ ...booted, outfit: { ...booted.outfit!, boots: "plain" } }, "home") as { bootLook?: { family: string } }).bootLook?.family === "plain", "the plain pair picked: plain");
// the cap and sunglasses: bought = worn on the head and face (the best you own); none bought = none worn
check(wornExtras(bought, undefined).every((x) => x.kind !== "shades" && x.kind !== "cap"), "not bought: no cap or sunglasses");
const capL = LIFESTYLE_LEVELS.find((x) => (x.baseId ?? x.id) === "cap" && x.level === 3)!.id;
const shadesL = LIFESTYLE_LEVELS.find((x) => (x.baseId ?? x.id) === "shades" && x.level === 5)!.id;
const withHead = { ...bought, ownedItems: [...bought.ownedItems, item(capL), item(shadesL)] } as C;
const ex = wornExtras(withHead, undefined);
check(ex.some((x) => x.kind === "cap" && x.slot === "head" && x.level === 3) && ex.some((x) => x.kind === "shades" && x.slot === "eyes" && x.level === 5), "bought: the cap on the head, the sunglasses on the face");
check(wornExtras(withHead, { head: "none" }).every((x) => x.kind !== "cap"), "the cap taken off in the wardrobe");
check(ownedWearables(withHead).filter((o) => o.slot === "head" || o.slot === "eyes").length === 2, "the wardrobe lists them (Head and Face rows)");
// an old save (no cap, no sunglasses, no Extras) loads and wears neither
check(wornAt(oldSave, "home").extras!.every((x) => x.slot !== "head" && x.slot !== "eyes"), "an old save: no cap or sunglasses");
check(baseIdOf({ id: "gold-l5" }) === "gold" && baseIdOf({ id: "car-1" }) === "car-1", "base ids from level ids");

if (problems.length) {
  console.error(`wearables: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`wearables: ${BOOT_LEVELS.length} boots and ${wearableLevels.length} wearable items mapped, none missing; Extras and the suit save and load — all OK`);
