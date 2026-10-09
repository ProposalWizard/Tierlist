import { LIFESTYLE_LEVELS, BOOT_LEVELS, baseIdOf } from "../../lib/star/shopDefaults";
import {
  HOME_TIERS, HOME_FAMILY_TIER, roomPreset, homeTierOf, homeNameOf, parseHomeTier, cabinetSize, bestHome,
} from "../../lib/star/home3d/homes";
import { cabinetSlots, winsOf, CABINET_TARGETS } from "../../lib/star/home3d/trophies";
import {
  outfitOf, withOutfit, wornAt, DEFAULT_OUTFIT, CASUAL_SETS, carsOnDrive, bootChoices, CAR_LOD, BOOT_LOD,
} from "../../lib/star/home3d/outfits";
import { STARTER_APPS, appInstalled } from "../../lib/star/unlocks";
import type { CareerState } from "../../lib/star/types";

/**
 * 3D HOME (/star-home3d-dev, phase "home-3d") — the pure parts: which room
 * the home you own gives, the trophy cabinet from a career, and the wardrobe's
 * saved outfit (and what the garden, shop and training then show). The 3D
 * itself was checked in a browser.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── Tier → room preset ──────────────────────────────────────────────────
const lvl = (base: string, level: number) => LIFESTYLE_LEVELS.find((l) => baseIdOf(l) === base && (l.level ?? 1) === level)!;

check(homeTierOf([]) === "starter" && homeTierOf(undefined) === "starter", "no home bought: the starter flat");
check(homeNameOf([]) === "Starter flat", "no home bought: called Starter flat");
check(bestHome([lvl("car-3", 2)]) === null, "a car is not a home");
check(homeTierOf([lvl("stable", 3)]) === "starter", "the horse's stable is not a home");

// every home family the shop sells maps to a tier, and the families are in the shop
const propertyIds = new Set(LIFESTYLE_LEVELS.filter((l) => l.category === "property").map((l) => baseIdOf(l)));
for (const id of propertyIds) if (id !== "stable") check(!!HOME_FAMILY_TIER[id], `shop home ${id} has a room tier`);
for (const id of Object.keys(HOME_FAMILY_TIER)) check(propertyIds.has(id), `room tier key ${id} is a home the shop sells`);

const want: Record<string, string> = {
  "flat-1": "flat", "flat-2": "flat", penthouse: "penthouse", "house-1": "house", villa: "villa", "house-2": "villa", estate: "estate", island: "estate",
};
for (const [id, t] of Object.entries(want)) check(homeTierOf([lvl(id, 1)]) === t, `${id} → ${t}`);
// the grandest home wins, whatever order they were bought in
check(homeTierOf([lvl("estate", 1), lvl("flat-1", 5), lvl("house-1", 3)]) === "estate", "several homes: the grandest wins");
check(homeNameOf([lvl("flat-1", 1), lvl("house-1", 2)]) !== "Starter flat", "owning a house names the house");

// the room grows with the tier: size, height, cabinet and drive never shrink
for (let i = 1; i < HOME_TIERS.length; i++) {
  const a = roomPreset(HOME_TIERS[i - 1]), b = roomPreset(HOME_TIERS[i]);
  check(b.w * b.d >= a.w * a.d - 1e-9, `${b.tier} floor area ≥ ${a.tier}`);
  check(b.h >= a.h, `${b.tier} ceiling ≥ ${a.tier}`);
  check(cabinetSize(b.tier) >= cabinetSize(a.tier), `${b.tier} cabinet ≥ ${a.tier}`);
  check(b.cars >= a.cars && b.wardrobe >= a.wardrobe, `${b.tier} drive and wardrobe ≥ ${a.tier}`);
}
check(roomPreset("starter").view !== roomPreset("estate").view, "the window view changes with the tier");
check(new Set(HOME_TIERS.map((t) => roomPreset(t).floor)).size >= 4, "the finish (floor) changes with the tier");
check(parseHomeTier("villa") === "villa" && parseHomeTier("castle") === null && parseHomeTier(null) === null, "?tier= parses");

// ── Trophies from a career ──────────────────────────────────────────────
type Cab = Pick<CareerState, "trophies" | "awards" | "ballonDorWins">;
const empty: Cab = { trophies: [], awards: [], ballonDorWins: 0 };
const emptySlots = cabinetSlots(empty, 12);
check(emptySlots.length === 12 && emptySlots.every((s) => !s.won && s.count === 0), "empty career: every spot empty");
check(emptySlots[0].name === CABINET_TARGETS[0], "empty cabinet starts with the biggest target");
check(cabinetSlots(empty, 6).length === 6, "the cabinet never has more spots than shelves");

const full: Cab = {
  trophies: [
    { season: 1, competition: "Premier League", club: "A" }, { season: 2, competition: "Premier League", club: "A" },
    { season: 2, competition: "FA Cup", club: "A" }, { season: 3, competition: "League One", club: "A" },
    // the same win stored twice counts once
    { season: 2, competition: "FA Cup", club: "A" },
  ],
  awards: [
    { season: 1, kind: "Golden Boot", detail: "" },
    { season: 1, kind: "Player of the Month", week: 4, detail: "" }, { season: 1, kind: "Player of the Month", week: 8, detail: "" },
  ],
  ballonDorWins: 1,
} as unknown as Cab;
const w = winsOf(full);
check(w.get("Premier League") === 2, "two league titles count as 2");
check(w.get("FA Cup") === 1, "a trophy stored twice counts once");
check(w.get("Player of the Month") === 2, "two different months count as 2");
check(w.get("Ballon d'Or") === 1, "the Ballon d'Or counts from ballonDorWins");
const fs = cabinetSlots(full, 12);
const won = fs.filter((s) => s.won);
check(won.length === 6, `full: 6 different things won on the shelves (got ${won.length})`);
check(fs.some((s) => s.name === "League One" && s.won), "a non-target win (League One) still gets a spot");
check(fs.some((s) => !s.won), "spots left over show targets to win");
check(fs[0].name === "Ballon d'Or" && fs[0].won, "the biggest win comes first");
// a tiny cabinet: wins first, empty spots give way
const tiny = cabinetSlots(full, 3);
check(tiny.length === 3 && tiny.every((s) => s.won), "small cabinet: only wins, the empty spots give way");

// ── Outfit saving ───────────────────────────────────────────────────────
type Wear = Pick<CareerState, "outfit" | "currentBoot">;
const none: Wear = { outfit: undefined, currentBoot: null } as unknown as Wear;
check(JSON.stringify(outfitOf(none)) === JSON.stringify(DEFAULT_OUTFIT), "no choice yet: the default (kit)");
check(wornAt(none, "garden").kind === "kit", "no choice yet: the garden shows the kit, as before");

const c1 = withOutfit(none, { wear: "casual", casual: "coat" });
check(c1.outfit?.wear === "casual" && c1.outfit?.casual === "coat", "picking the coat saves it on the career");
check(none.outfit === undefined, "withOutfit does not change the old career");
const g = wornAt(c1, "garden"), s = wornAt(c1, "shop"), t = wornAt(c1, "training"), h = wornAt(c1, "home");
check(g.kind === "casual" && g.set.id === "coat", "garden shows the saved casual set");
check(s.kind === "casual" && s.set.id === "coat", "shop shows the saved casual set");
check(h.kind === "casual", "home shows the saved casual set");
check(t.kind === "kit", "training always shows the kit");

const c2 = withOutfit(c1, { wear: "kit", kit: "away" });
check(c2.outfit?.wear === "kit" && c2.outfit?.kit === "away" && c2.outfit?.casual === "coat", "back to the away kit keeps the last casual set");
const g2 = wornAt(c2, "garden");
check(g2.kind === "kit" && g2.kit === "away", "garden then shows the away kit");
// a saved choice survives the save file (JSON round trip) and junk is tidied
const back = JSON.parse(JSON.stringify(c2)) as Wear;
check(JSON.stringify(outfitOf(back)) === JSON.stringify(outfitOf(c2)), "the outfit survives a save and load");
const junk = outfitOf({ outfit: { wear: "pyjamas", casual: "toga", kit: "third" } } as unknown as Wear);
check(junk.wear === "kit" && junk.casual === "hoodie" && junk.kit === "home", "an unknown saved outfit falls back safely");
check(new Set(CASUAL_SETS.map((x) => x.id)).size === CASUAL_SETS.length && CASUAL_SETS.length >= 4, "four or more distinct casual sets");

// boots: plain, plus the pair you own; the kit shows your boot's colour
const boot = BOOT_LEVELS.find((b) => baseIdOf(b) === "speed")!;
const withBoot = { ...c2, currentBoot: { ...boot } } as Wear;
check(bootChoices(withBoot).length === 2 && bootChoices(none).length === 1, "boots rail: plain + the pair you own");
const kb = wornAt(withBoot, "training");
check(kb.kind === "kit" && kb.boots !== "#141416", "your own boots show their colour with the kit");
const plain = wornAt(withOutfit(withBoot, { boots: "plain" }), "training");
check(plain.kind === "kit" && plain.boots === "#141416", "plain boots are black");
for (const b of new Set(BOOT_LEVELS.map((x) => baseIdOf(x)))) check(!!BOOT_LOD[b], `boot ${b} has a light model for the shelf`);

// ── The drive ───────────────────────────────────────────────────────────
const cars = { ownedItems: [lvl("car-1", 1), lvl("car-4", 2), lvl("suv", 1), lvl("car-1", 3), lvl("jet", 1)] } as unknown as Pick<CareerState, "ownedItems">;
const drive = carsOnDrive(cars, 2);
check(drive.length === 2 && drive[0].id === "car-4" && drive[1].id === "suv", "the drive shows the best cars first, up to its room");
check(carsOnDrive(cars, 5).length === 3, "one spot per car family; the jet is not on the drive");
check(carsOnDrive(cars, 5).find((c) => c.id === "car-1")?.level === 3, "the best level of a car family");
for (const id of ["car-1", "car-2", "suv", "car-3", "classic", "car-4"]) check(!!CAR_LOD[id], `car ${id} has a light model`);

// ── Your house is on the phone from day one ─────────────────────────────
check(STARTER_APPS.includes("home-3d") && appInstalled({ unlocks: { apps: [] } } as unknown as Pick<CareerState, "unlocks">, "home-3d"), "Your house is on the phone from the start");

if (problems.length) {
  console.error(`home3d: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("home3d: rooms by tier, trophy cabinet, outfit saving, drive — all OK");
