/**
 * THE SHOPPING STREET, phase 1 (28 Nov 2026): lib/star/street3d/plan.ts and how the career joins it.
 *
 *   1. every door leads to the right screen (3D shop, Cars aisle, Drip aisle, the barber's shop)
 *   2. you arrive somewhere you can stand, outside the right door, facing the street
 *   3. the doors: walking straight in goes through an open one (all four open since the barber did, 28 Nov)
 *   4. the street furniture never blocks a door; the people's walk points are all reachable, and
 *      the people keep to the pavements, crossing only on the zebra
 *   5. the windows show the shop's own items and prices (nothing invented)
 *   6. the career: the phase, the garden gate, the 3D shop's front doors, Back from an aisle returns
 *      to the street at that door (navReturn), the 3D shop's Back unchanged
 *   7. the one canvas: the street heals a lost 3D by the shared rule, stops when its screen closes,
 *      never takes the renderer from the place on screen; packed files only, no generated (paid) models
 *   8. its loading screen
 *
 *   npx tsx tests/star/street3d.mts
 */
import fs from "node:fs";
import {
  STREET_SHOPS, FRONT, ROAD, SOUTH, NORTH, ZEBRA_Z, WALK_BOX, LAMPS, TREES, BENCHES, PARKED, CAR_HALF,
  doorRoute, arrivalOf, doorwayAt, throughDoor, leftSouth, streetFree, streetSolids, walkPoints, walkerFree, crossesRoad,
  showroomCar, boutiqueWindow, shopOf, type StreetDoor,
} from "../../lib/star/street3d/plan";
import { LIFESTYLE_ALL_LEVELS, baseIdOf } from "../../lib/star/shopData";
import { openFrom, backFrom } from "../../lib/star/navReturn";
import { LOAD_VARIANTS } from "../../lib/star/loading/pick";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const read = (f: string) => fs.readFileSync(new URL("../../" + f, import.meta.url), "utf8");

// ── 1. doors lead to the right screens ──
check(JSON.stringify(doorRoute("shop")) === JSON.stringify({ kind: "phase", phase: "shop-3d" }), "the 3D shop's door opens the 3D shop");
check(JSON.stringify(doorRoute("cars")) === JSON.stringify({ kind: "menu", phase: "shop-lifestyle", cat: "cars" }), "the showroom opens the shop's Cars aisle");
check(JSON.stringify(doorRoute("drip")) === JSON.stringify({ kind: "menu", phase: "shop-lifestyle", cat: "drip" }), "the boutique opens the shop's Drip aisle");
check(JSON.stringify(doorRoute("barber")) === JSON.stringify({ kind: "phase", phase: "barber-3d" }), "the barber's door opens the barber's shop");
check(STREET_SHOPS.length === 4 && STREET_SHOPS.every((s) => s.opens) && shopOf("barber").opens, "four shops, four open doors (the barber is open)");
const menuCats = read("components/star/shop/MenuShop.tsx");
check(/\{ id: "cars"/.test(menuCats) && /\{ id: "drip"/.test(menuCats), "the Cars and Drip aisles exist in the shop");
// no real brands on the fascias (our own words only)
check(STREET_SHOPS.every((s) => /^(KNOWITBALL|KIB MOTORS|THE DRIP|BARBER)$/.test(s.name)), "fascias are our own names");

// ── 2. arrivals ──
for (const a of ["gate", "shop", "cars", "drip", "barber"] as const) {
  const [x, z, yaw] = arrivalOf(a);
  check(streetFree(x, z), `arrive ${a}: somewhere you can stand (${x.toFixed(2)}, ${z.toFixed(2)})`);
  check(!doorwayAt(x, z) || !throughDoor(doorwayAt(x, z)!, x), `arrive ${a}: not already through a door`);
  check(!leftSouth(z), `arrive ${a}: not already off the end of the street`);
  if (a !== "gate") {
    const s = shopOf(a as StreetDoor);
    const fx = Math.sin(yaw);
    check(Math.sign(fx) === -s.side, `arrive ${a}: facing away from the door, across the street`);
    check(Math.abs(z - s.z) < 0.01 && Math.abs(Math.abs(x) - (FRONT - 1.7)) < 0.01, `arrive ${a}: right outside its own door`);
  } else check(z > 15 && Math.abs(Math.cos(yaw) + 1) < 1e-6, "arrive from the garden: the bottom of the street, facing up it");
}

// ── 3. walking through a door ──
for (const s of STREET_SHOPS) {
  // walk from the arrival straight at the door
  const [x0, z0] = arrivalOf(s.id);
  let fired = false, x = x0;
  for (let k = 0; k < 80; k++) {
    x += s.side * 0.05;
    const d = doorwayAt(x, z0);
    if (d && d.id === s.id && throughDoor(d, x)) { fired = true; break; }
    if (!d && s.side * x > FRONT - 0.32) break; // the front stops you
  }
  check(fired, `${s.id}: walking straight in reaches the door`);
  if (!s.opens) check(s.side * x <= FRONT - 0.3, `${s.id}: shut, you stop at its glass (${(s.side * x).toFixed(2)})`);
  // beside the door you only meet the front
  const beside = s.z + s.doorHalf + 0.5;
  check(!doorwayAt(s.side * (FRONT - 0.2), beside), `${s.id}: beside the door is the front, not the doorway`);
}
check(leftSouth(SOUTH + 0.3) && !leftSouth(SOUTH - 0.3), "off the bottom of the street: back down the lane");

// ── 4. furniture, the walkers ──
const solids = streetSolids();
for (const s of STREET_SHOPS) {
  const [x, z] = arrivalOf(s.id);
  // the path from the door to the middle of the pavement is clear
  for (let u = 0.4; u <= 3.0; u += 0.2) check(streetFree(s.side * (FRONT - u), s.z, 0.32, solids), `${s.id}: nothing in the way ${u.toFixed(1)} m out from the door`);
  check(streetFree(x, z), `${s.id}: its arrival spot is clear`);
}
for (const [x, z] of [...LAMPS, ...TREES]) check(STREET_SHOPS.every((s) => Math.sign(x) !== s.side || Math.abs(z - s.z) > s.doorHalf + 1.0), `lamp/tree at (${x}, ${z}) clear of every door`);
for (const [x, z] of BENCHES) check([...LAMPS, ...TREES].every(([a, b]) => Math.abs(a - x) > 0.5 || Math.abs(b - z) > 1.3), `bench at (${x}, ${z}) clear of the lamps and trees`);
for (const c of PARKED) {
  check(Math.abs(c.x) + CAR_HALF[0] < ROAD && Math.abs(c.x) - CAR_HALF[0] > 0.3, `parked ${c.id}: in its lane, by the kerb`);
  check(Math.abs(c.z - ZEBRA_Z) > CAR_HALF[1] + 2.5, `parked ${c.id}: not on the zebra`);
}
const pts = walkPoints();
for (const [x, z] of pts) check(walkerFree(x, z, solids), `walk point (${x.toFixed(1)}, ${z.toFixed(1)}) a walker can stand on`);
// a walker can never be on the road away from the zebra, and is always allowed across it
check(!walkerFree(0, ZEBRA_Z + 6, solids) && !walkerFree(1.5, -10, solids), "walkers never step into the road between the cars");
check(walkerFree(0, ZEBRA_Z, solids) && walkerFree(-2.0, ZEBRA_Z + 0.5, solids), "walkers can use the zebra");
check(crossesRoad(-5.7, 5.7) && !crossesRoad(5.7, 6.4), "a walk to the other pavement is a crossing (by the zebra)");
// every walk point is reachable from every other along the walkers' own ground (a flood fill on a 0.25 m grid)
{
  const [x0, x1, z0] = WALK_BOX, z1 = SOUTH - 0.5, c = 0.25;
  const nx = Math.ceil((x1 - x0) / c), nz = Math.ceil((z1 - z0) / c);
  const free = (i: number, j: number) => walkerFree(x0 + i * c, z0 + j * c, solids);
  const seen = new Uint8Array(nx * nz);
  const cell = (x: number, z: number) => [Math.round((x - x0) / c), Math.round((z - z0) / c)];
  const [si, sj] = cell(pts[0][0], pts[0][1]);
  const q: number[] = [si + sj * nx];
  seen[q[0]] = 1;
  while (q.length) {
    const k = q.pop()!, i = k % nx, j = (k - i) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const kk = a + b * nx;
      if (!seen[kk] && free(a, b)) { seen[kk] = 1; q.push(kk); }
    }
  }
  const cut = pts.filter(([x, z]) => { const [i, j] = cell(x, z); return !seen[i + j * nx]; });
  check(cut.length === 0, `every walk point is reachable by the walkers (cut off: ${cut.map((p) => p.join(",")).join(" ")})`);
}

// ── 5. the windows: the shop's own items and prices ──
const lv1 = (id: string) => LIFESTYLE_ALL_LEVELS.find((x) => baseIdOf(x) === id && (x.level ?? 1) === 1)!;
const fresh = { ownedItems: [] };
const car0 = showroomCar(fresh);
check(car0.id === "car-1" && car0.price === lv1("car-1").price && car0.name === lv1("car-1").name, `a new career's showroom: the Family Car at the shop's price (${car0.name} ${car0.priceText})`);
const owns = (ids: string[]) => ({ ownedItems: ids.map((id) => ({ ...lv1(id) })) });
check(showroomCar(owns(["car-1", "car-2"])).id === "suv", "owning the first two cars: the showroom shows the SUV");
check(showroomCar(owns(["car-1", "car-2", "suv", "car-3", "classic", "car-4"])).id === "car-4", "owning every car: the supercar stays in the window");
const tags = boutiqueWindow(fresh);
check(tags.length === 2 && tags.every((t) => t.price === lv1(t.id).price && t.priceText.length > 1), `the boutique: two real tags (${tags.map((t) => `${t.name} ${t.priceText}`).join(", ")})`);
check(boutiqueWindow(owns(["cap"]))[0].id !== "cap", "the boutique moves on past what you own");

// ── 6. the career ──
const page = read("app/star-dev/page.tsx");
check(page.includes('const Street3D = lazyScreen(() => import("@/components/star/Street3D"), { fallback: loadingCover("street") });'), "the street is its own lazy screen with its own loading cover");
check(/if \(phase === "street-3d" && career\) \{[\s\S]{0,1600}<Street3D/.test(page), "phase street-3d shows the street");
check(page.includes('const toGardenGate = () => { setStreetArrive("gate"); setGardenArrive("street"); setPhase("garden"); };') && /onBack=\{toGardenGate\}\s*\n\s*onLeave=\{toGardenGate\}/.test(page), "Back and the lane both go to the garden's gate");
check(page.includes('onStreet={() => { setGardenArrive("gate"); setStreetArrive("gate"); setPhase("street-3d"); }}'), "the garden's gate opens the street at the bottom");
check(page.includes('if (shopFromStreet) { setShopFromStreet(false); setStreetArrive("shop"); setPhase("street-3d"); return; }'), "the 3D shop's front doors lead back to the street when you came in from it");
check(page.includes('setShopFromStreet(false); setShopAtDoor(true); setPhase("shop-3d");'), "… and to the garden when you came in from the garden");
check(page.includes('if (r.kind === "phase") { setStreetArrive(id); setShopFromStreet(true); setShopAtDoor(true); setPhase(r.phase); return; }'), "the street's shop door opens the 3D shop at its door");
check(page.includes('pushFrom({ phase: "street-3d", nav: activeNav }, r.phase)') && page.includes('menuStart ?? "drip"'), "the showroom and boutique doors open that aisle and remember the street as its way back");
// Back from the aisle: the remembered spot is the street (and you come out of the door you went in by: streetArrive)
{
  const st = openFrom([], { phase: "street-3d", nav: "home" }, "shop-lifestyle");
  const back = backFrom(st, "shop-lifestyle");
  check(back.spot?.phase === "street-3d", `Back from the aisle returns to the street (${back.spot?.phase})`);
}
const garden = read("lib/star/garden3d/scene.ts");
check(garden.includes("if (cb.onStreetGate && Math.abs(x) < 1.3 && z > LIMIT - 0.6)") && garden.includes("cb.onStreetGate();"), "the garden's gate walks you out to the street");
check(read("components/star/Garden3D.tsx").includes("High Street &#8250;"), "the garden's gate has its card");

// ── 7. the one canvas ──
const screen = read("components/star/Street3D.tsx");
const scene = read("lib/star/street3d/scene.ts");
check((screen.match(/afterLoss\(heal\.current, Date\.now\(\)\)/g) ?? []).length >= 1 && screen.includes("healReset(heal.current)"), "the street heals by the shared rule (two silent rebuilds a minute, then the tap)");
check(/build > 0 \? "low"/.test(screen), "a rebuild after a loss is built at Low");
check(screen.includes("m.dropSharedRenderer();") && screen.includes("HEAL_DELAY_MS"), "a rebuild waits, then starts on a fresh renderer");
check(/\.catch\(\(e\) => \{ if \(gone \|\| isAbandonedScene\(e\)\) return;[^}]*lost\(\); \}\)/.test(screen), "a failed build also goes through the heal (unless the screen has gone)");
check(screen.includes("isDead: () => gone"), "the screen tells the scene when it has closed");
check(screen.includes('<LoadingCurtain section="street"'), "the street's own loading screen");
check(scene.includes("const gone = () => !!opts.isDead?.() || abandonedContainer(container);"), "the scene knows when its screen has gone");
check(/if \(gone\(\)\) throw abandonedSceneError\(\);\s*\n\s*const \{ renderer, release, isOwner \} = acquireRenderer/.test(scene), "never takes the renderer once its screen has gone");
check(scene.includes("awaitSmoothFrame(renderer, { isDead: () => disposed || gone(), isOwner })"), "stops waiting for smooth frames that are not its own");
check(!/throw new Error\("disposed"\)/.test(scene), "every build checkpoint checks the screen (abandoned, not a plain error)");
const awaits = scene.split("\n").filter((l) => /\bawait\b/.test(l) && !/await breathe\(\)|await new Promise|awaitSmoothFrame|async|return await/.test(l));
const after = scene.split("\n");
for (const l of awaits) {
  const i = after.indexOf(l);
  const next = after.slice(i, i + 40).join("\n");
  check(/gone\(\)|breathe\(\)/.test(next) || /installAssetVersions|import\(/.test(l), `after "${l.trim().slice(0, 70)}" the scene checks it is still wanted`);
}
check(scene.includes("if (isOwner()) renderer.setAnimationLoop(frame);") && scene.includes("if (isOwner()) renderer.setAnimationLoop(null);"), "only the owner starts and stops the loop");
check(scene.includes('addEventListener("webglcontextlost"') && scene.includes('removeEventListener("webglcontextlost"'), "listens for a lost 3D (and stops on dispose)");
check(scene.includes("await withMeshopt(loader);"), "every model loads through the packed (meshopt) loader (RUL-3D-007)");
check(!/-hf\.glb|higgsfield/i.test(scene.replace(/\/\*[\s\S]*?\*\//g, "")), "no generated (paid-service) models asked for by name");
check(scene.includes("wornAt") || screen.includes('wornAt(career, "shop")'), "you wear your wardrobe outfit");

// ── 8. the loading screen ──
check((LOAD_VARIANTS.street ?? []).length >= 2 && LOAD_VARIANTS.street.every((v) => v.kind === "keepie" && v.still === "street"), "two keepie-uppie screens over the street's still");
check(fs.existsSync(new URL("../../public/star/loading/street.webp", import.meta.url)), "the street's still is in public/star/loading");
void NORTH;

if (problems.length) {
  console.log(`street3d: ${problems.length} problem(s)`);
  for (const p of problems) console.log("  ✗", p);
  process.exit(1);
}
console.log("street3d: all checks passed");
