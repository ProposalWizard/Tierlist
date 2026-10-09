import { LIFESTYLE_LEVELS, BOOT_LEVELS, baseIdOf } from "../../lib/star/shopDefaults";
import {
  HOME_TIERS, HOME_FAMILY_TIER, roomPreset, homeTierOf, homeNameOf, parseHomeTier, cabinetSize, bestHome,
  roomsFor, type HomeTier, type RoomId,
} from "../../lib/star/home3d/homes";
import { roomPlan, spotsOf, trophySlotsByRoom, arrivalAt, arrivalDoor, homeStuffOf } from "../../lib/star/home3d/rooms";
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


// ── Rooms (Harry, 9 Oct 2026: "the bigger the house the bigger the space/rooms") ──
check(roomsFor("starter").length === 1 && roomsFor("starter")[0] === "main", "the starter flat stays one room");
check(JSON.stringify(roomsFor("flat")) === JSON.stringify(["nook", "main"]), "the flat: a hallway nook by the front door, then its one room");
check(roomsFor("penthouse").length === 3 && roomsFor("house").length === 4, "penthouse 3 rooms, house 4");
check(JSON.stringify(roomsFor("house")) === JSON.stringify(["hallway", "lounge", "dressing", "trophy"]), "the house: hallway, lounge, dressing room, trophy room");
for (const t of HOME_TIERS) check(JSON.stringify(roomsFor(t, "old")) === JSON.stringify(["main"]), `Old look: ${t} is the one room`);
// from the house up, each tier holds every room of the one below
for (const [a, b] of [["house", "villa"], ["villa", "estate"]] as const) {
  for (const r of roomsFor(a)) check(roomsFor(b).includes(r), `${b} has the ${a}'s ${r}`);
  check(roomsFor(b).length > roomsFor(a).length, `${b} has more rooms than ${a}`);
}
// every tier keeps everything you could stop at in the tier below (wardrobe, cabinet, drive)
const spotsOfTier = (t: HomeTier) => new Set(roomsFor(t).flatMap((r) => spotsOf(r, roomsFor(t))));
for (let i = 1; i < HOME_TIERS.length; i++) {
  const lo = spotsOfTier(HOME_TIERS[i - 1]), hi = spotsOfTier(HOME_TIERS[i]);
  lo.forEach((s) => check(hi.has(s), `${HOME_TIERS[i]} still has the ${s}`));
}
// the trophy slots add up to the tier's cabinet, in exactly one room
for (const t of HOME_TIERS) for (const look of ["new", "old"] as const) {
  const by = trophySlotsByRoom(t, roomsFor(t, look));
  const sum = Object.values(by).reduce((n, v) => n + (v ?? 0), 0);
  check(sum === cabinetSize(t), `${t} (${look}): trophy slots ${sum} = cabinet ${cabinetSize(t)}`);
  check(Object.keys(by).length === 1, `${t} (${look}): one room keeps the cabinet`);
}
// doorways: every door to a room has a door back; the first room has the front door; doors sit on their walls and never overlap
for (const t of HOME_TIERS) {
  const rs = roomsFor(t);
  const plans = new Map(rs.map((r) => [r, roomPlan(t, r, rs)]));
  check(plans.get(rs[0])!.doors.some((d) => d.to === "garden"), `${t}: the first room has the front door`);
  check(rs.slice(1).every((r) => !plans.get(r)!.doors.some((d) => d.to === "garden")), `${t}: only the first room has the front door`);
  plans.forEach((p, r) => {
    for (const d of p.doors) {
      if (d.to !== "garden") {
        check(rs.includes(d.to), `${t} ${r}: its door leads to a room of this home (${d.to})`);
        check(!!plans.get(d.to as RoomId)?.doors.some((b) => b.to === r), `${t}: ${r} → ${d.to} has a door back`);
      }
      const along = d.wall === "n" || d.wall === "s" ? d.x : d.z;
      const half = (d.wall === "n" || d.wall === "s" ? p.w : p.d) / 2;
      check(Math.abs(along) + d.half <= half - 0.3, `${t} ${r}: the ${d.to} door fits its wall`);
      const a = arrivalAt(d, 1.5);
      check(Math.abs(a.x) < p.w / 2 && Math.abs(a.z) < p.d / 2, `${t} ${r}: you arrive inside the room by the ${d.to} door`);
    }
    for (const d of p.doors) for (const e of p.doors) {
      if (d === e || d.wall !== e.wall) continue;
      const da = d.wall === "n" || d.wall === "s" ? d.x : d.z, ea = e.wall === "n" || e.wall === "s" ? e.x : e.z;
      check(Math.abs(da - ea) >= d.half + e.half + 0.3, `${t} ${r}: doors ${d.to} and ${e.to} do not overlap`);
    }
    // all rooms reachable from the first
  });
  const seenR = new Set<RoomId>([rs[0]]);
  const todo: RoomId[] = [rs[0]];
  while (todo.length) for (const d of plans.get(todo.pop()!)!.doors) if (d.to !== "garden" && !seenR.has(d.to)) { seenR.add(d.to); todo.push(d.to); }
  check(seenR.size === rs.length, `${t}: every room can be walked to from the front door`);
}
check(arrivalDoor(roomPlan("house", "lounge", roomsFor("house")), "hallway")?.to === "hallway", "from the hallway you arrive at the lounge's hallway door");

// your things, from the shop
const stuffCareer = { ownedItems: [lvl("rolex", 1), lvl("smartwatch", 1), lvl("diamond", 1), lvl("tv", 1), lvl("bike", 1)], kibCans: { basic: 2, premium: 1, elite: 0 } } as unknown as CareerState;
const st = homeStuffOf(stuffCareer);
check(st.watches.includes("luxury") && st.watches.includes("smart") && !st.watches.includes("gold"), "watches you own (and not the ones you don't)");
check(st.jewellery.join() === "diamond" && st.tv && st.bike && !st.jet && st.cans === 3, "jewellery, TV, bike, cans");
check(homeStuffOf({ ownedItems: [] } as unknown as CareerState).cans === 0, "nothing bought: empty plinths");

// ── Each room built headless: within budget, every path walkable, freed on dispose ──
{
  // a canvas that draws nothing (the room's pictures are drawn in a browser; here only their sizes matter)
  const ctx2d: any = new Proxy({}, {
    get: (_t, k) => k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} })
      : k === "measureText" ? () => ({ width: 10 })
        : k === "createImageData" || k === "getImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w, height: h })
          : () => undefined,
    set: () => true,
  });
  (globalThis as any).document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }) };
  const THREE: any = await import("three");
  const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const { Reflector }: any = await import("three/examples/jsm/objects/Reflector.js");
  const { buildRoom, roomFree } = await import("../../lib/star/home3d/roomBuild");
  const { buildGrid, findPath } = await import("../../lib/star/tapWalk");
  const career = {
    ...full, ownedItems: [lvl("car-3", 2), lvl("suv", 1), lvl("rolex", 1), lvl("gold", 1), lvl("diamond", 1), lvl("tv", 1), lvl("console", 1), lvl("art", 1), lvl("suit", 1)],
    kibCans: { basic: 5, premium: 2, elite: 1 }, currentBoot: { ...BOOT_LEVELS.find((b) => baseIdOf(b) === "speed")! },
  } as unknown as CareerState;
  const kit = { home: { shirt: "#c8102e", trim: "#ffffff" }, away: { shirt: "#f2d200", trim: "#101010" } };
  const env = (quality: "low" | "medium" | "high") => ({
    THREE, mergeGeometries, Reflector, prof: { anisotropy: 4 }, quality, envTex: null, doorOpen: true,
    glb: () => new Promise<any>(() => { /* not loaded in a test */ }),
  });
  const stats = (g: any) => {
    let draws = 0, tris = 0;
    const big = new Set<any>();
    g.traverse((o: any) => {
      if (!o.isMesh || !o.visible) return;
      const geo = o.geometry;
      const n = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      draws += Array.isArray(o.material) ? o.material.length : 1;
      tris += n * (o.isInstancedMesh ? o.count : 1);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.map?.image && m.map.image.width >= 1024) big.add(m.map);
    });
    return { draws, tris: Math.round(tris), big: big.size };
  };
  const table: string[] = [];
  for (const t of HOME_TIERS) for (const look of ["new", "old"] as const) {
    const rs = roomsFor(t, look);
    if (look === "old" && t !== "house" && t !== "estate") continue; // the old room: once small, once grand
    for (const id of rs) {
      const inp = {
        tier: t, rooms: rs, kits: kit, slots: cabinetSlots(career, cabinetSize(t)), cars: carsOnDrive(career, 4),
        boots: bootChoices(career), casual: CASUAL_SETS, stuff: homeStuffOf(career),
      };
      const room = buildRoom(env("medium"), inp, id);
      // the mirror counts once, and only in the dressing room (or the one room)
      let mirrors = 0;
      room.group.traverse((o: any) => { if (o.isMesh && o.camera && o.getRenderTarget) mirrors++; });
      check(mirrors === (id === "dressing" || id === "main" ? 1 : 0), `${t} ${id}: mirror only in the dressing room (got ${mirrors})`);
      const s = stats(room.group);
      table.push(`${t.padEnd(9)} ${look} ${id.padEnd(13)} draws ${String(s.draws).padStart(2)}  tris ${String(s.tris).padStart(6)}  1024-pictures ${s.big}`);
      if (id !== "main") {
        check(s.draws <= 50, `${t} ${id}: ${s.draws} draws (budget 50)`);
        check(s.tris <= 45000, `${t} ${id}: ${s.tris} triangles (budget 45k)`);
        check(s.big <= 2, `${t} ${id}: ${s.big} new 1024 pictures (budget 2)`);
      }
      // the walk grid: from the first door to every other door and to every spot
      const grid = buildGrid(-room.w2, room.w2, -room.d2, room.d2, 0.2, (x: number, z: number) => roomFree(room, x, z));
      const ins = room.doors.map((d) => ({ d, a: arrivalAt(d, 1.5) }));
      for (const { d, a } of ins) check(roomFree(room, a.x, a.z), `${t} ${id}: you arrive clear of the furniture by the ${d.to} door`);
      const from = ins[0]?.a ?? room.start;
      const goals: [string, [number, number]][] = [
        ...ins.slice(1).map(({ d, a }) => [`the ${d.to} door`, [a.x, a.z]] as [string, [number, number]]),
        ...room.plan.spots.map((sp) => [`the ${sp}`, room.standFor(sp, [from.x, from.z]).at] as [string, [number, number]]),
      ];
      for (const [what, at] of goals) {
        const p = findPath(grid, [from.x, from.z], at);
        const end = p?.[p.length - 1];
        check(!!p && !!end && Math.hypot(end[0] - at[0], end[1] - at[1]) < 0.45, `${t} ${id}: a walkable path to ${what}`);
      }
      // dispose frees everything it made
      const made: any[] = [];
      room.group.traverse((o: any) => {
        if (o.geometry) made.push(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { made.push(m); if (m.map) made.push(m.map); }
      });
      const freed = new Set<any>();
      for (const x of made) x.addEventListener?.("dispose", () => freed.add(x));
      room.dispose();
      const left = made.filter((x) => !freed.has(x));
      check(left.length === 0, `${t} ${id}: ${left.length} things not freed on dispose`);
      check(!room.group.parent, `${t} ${id}: the room's group is gone`);
    }
  }
  // a walk through every room of the estate and back again: nothing left behind
  {
    const rs = roomsFor("estate");
    const inp = { tier: "estate" as HomeTier, rooms: rs, kits: kit, slots: cabinetSlots(career, cabinetSize("estate")), cars: carsOnDrive(career, 4), boots: bootChoices(career), casual: CASUAL_SETS, stuff: homeStuffOf(career) };
    const scene = new THREE.Scene();
    let live = 0;
    for (const id of [...rs, ...rs.slice().reverse()]) {
      const room = buildRoom(env("high"), inp, id);
      scene.add(room.group);
      room.group.traverse((o: any) => { if (o.geometry) { live++; o.geometry.addEventListener("dispose", () => live--); } });
      room.dispose();
    }
    check(scene.children.length === 0, "after a loop through every room the scene is empty");
    check(live === 0, `after a loop through every room every shape is freed (${live} left)`);
  }
  // the mirror is off on Low
  {
    const rs = roomsFor("house");
    const room = buildRoom(env("low"), { tier: "house", rooms: rs, kits: kit, slots: [], cars: [], boots: [], casual: CASUAL_SETS }, "dressing");
    check(!room.mirror, "Low: no live mirror in the dressing room");
    room.dispose();
  }
  // every room of every tier has something built in it (no bare plinth-only room left)
  for (const t of HOME_TIERS) for (const id of roomsFor(t)) {
    const inp = { tier: t, rooms: roomsFor(t), kits: kit, slots: cabinetSlots(career, cabinetSize(t)), cars: carsOnDrive(career, 4), boots: bootChoices(career), casual: CASUAL_SETS, stuff: homeStuffOf(career) };
    const room = buildRoom(env("medium"), inp, id);
    check(stats(room.group).tris > 1000, `${t} ${id}: the room is furnished (${stats(room.group).tris} triangles)`);
    room.dispose();
  }
  // the room camera: the boom stops at the wall along its own line, never through it
  const { roomCamBoom, ROOM_CAM, openCamYaw } = await import("../../lib/star/home3d/scene");
  { // just through a doorway on the south wall, facing in: the camera swings off the wall behind him
    const y0 = 0; // straight behind him is +z, into the wall 1.2 m away
    const y = openCamYaw(0, 1.5, y0, ROOM_CAM.back, 3, 2.7);
    const boom = (yy: number) => roomCamBoom(0, 1.5, Math.sin(yy), Math.cos(yy), ROOM_CAM.back, 3, 2.7);
    check(boom(y) > boom(y0) + 0.5 && Math.abs(y - y0) <= 1.21, `camera: backed onto a wall it swings round for room (${boom(y0).toFixed(2)} → ${boom(y).toFixed(2)} m)`);
    check(openCamYaw(0, 0, 0, 3, 7, 7) === 0, "camera: with room behind him it stays straight behind");
  }
  check(Math.abs(roomCamBoom(0, 0, 0, 1, ROOM_CAM.back, 3, 3) - 3) < 1e-9, "camera: a wall 3 m behind cuts the boom to 3 m");
  check(roomCamBoom(0, 0, 0, 1, 2, 3, 3) === 2, "camera: no wall in reach, the full boom");
  check(roomCamBoom(0, 2.9, 0, 1, 4, 3, 3) === 0.6, "camera: backed onto a wall, the boom never goes under 0.6 m");
  { const t = roomCamBoom(1, 1, Math.SQRT1_2, Math.SQRT1_2, 9, 3, 3); check(Math.abs(1 + t * Math.SQRT1_2 - 3) < 1e-9, "camera: on a slant, it stops where its own line meets the wall"); }
  check(ROOM_CAM.back > 3.3 && ROOM_CAM.height > 2.35, "camera: further back and higher than before (3.3 m, 2.35 m)");
  if (process.env.HOME3D_TABLE || problems.length) console.log(table.join("\n"));
}

if (problems.length) {
  console.error(`home3d: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("home3d: rooms by tier, doorways, budgets, walk paths, dispose, trophy cabinet, outfit saving, drive — all OK");
