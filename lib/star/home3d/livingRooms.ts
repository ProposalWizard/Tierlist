/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE LIVING HOUSES' ROOMS (Harry, 20 Nov 2026: "things like the fridge and couch + tv are
 * genuinely incredible, if we have this level of 3d throughout the game this is gonna be insane
 * ... we need 3D FOR ALL OF them"). homes.ts LIVING_ROOMS says which rooms each tier has:
 *
 *   starter    studio (bed, kitchenette, a small TV and sofa, wardrobe + mirror, the cabinet)
 *   flat       hallway nook, lounge (sofa + TV, the stocked fridge, the cabinet), bedroom, bathroom
 *   penthouse  open-plan lounge with its kitchen island, bedroom, bathroom, glass terrace
 *   house      hallway, lounge, kitchen, bedroom, bathroom, trophy room, garage
 *   villa      + dressing room, gym, games room, pool terrace
 *   estate     + cinema, the garden terrace onto the grounds
 *
 * Each room is dressed densely (rugs, lamps, plants, shelves with things, art, the corners
 * shaded) from the Kenney Furniture Kit (CC0, ./furniture.ts) and the room's own built pieces,
 * and says what in it can be USED (lib/star/world3d/smartObject.ts): sofa + TV, the stocked
 * fridge, bed, bathroom mirror, shower, coffee machine, treadmill, pool table, loungers, cinema
 * seats. What using it does to the room (the TV comes on, the fridge door swings open, the
 * shower runs) is its fx. Where team-mates who drop round sit is its guests.
 * Called from ./roomBuild.ts buildNew; the shell, the wardrobe, the cabinet and the drive
 * window are roomBuild's own. Every seat's numbers are measured on the game's own sofa
 * (seat top 0.445 m, the hips 0.16 m behind its front edge), and checked with the seat check.
 */
import { seatObject, tvObject, standObject, fwdOf, rightOf, type SmartObject } from "../world3d/smartObject";
import type { XZ } from "../tapWalk";
import type { Wall } from "./rooms";
import {
  shellOf, plant, floorLamp, sofa, painter, framedShirt, waterMat, disc, skyDome, wallWith, chandelier,
  type Ctx, type Kit, type WinSpec, type Box2,
} from "./roomBuild";
import { viewCanvas } from "./textures";
import { floorShade } from "./bakeShade";
import { homeGymOf } from "../gym/homeGym";

export interface RoomFx { on?: (v: boolean) => void; tick?: (dt: number) => void }
export interface GuestPlan { obj: string; slot?: string }
export interface LivingExtras { things: SmartObject[]; fx: Record<string, RoomFx>; guests: GuestPlan[] }
export interface LivingHooks {
  wardrobe: (metalM: any, len: number) => { WARD: { z0: number; z1: number; depth: number; h: number }; MIRROR: { z: number; w: number } };
  cabinet: (glassM: any) => { solids: Box2[] };
  driveWindow: (zc: number, w: number) => WinSpec;
}

/** The game's own sofa, measured (testScene.ts): seat top 0.445 m, the hips 0.16 m behind its front edge. */
const SOFA = { y: 0.445, front: 0.16, depth: 0.88 };
const cv = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")!] as const; };
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** The facing for a wall's inside: what a thing against it looks at. */
const INTO: Record<Wall, number> = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };

/** A bed: sit on it, or sleep till morning (the house's night; home3d/sleep.ts says what it does to the career). */
function bedSleeps(b: SmartObject, bed: NonNullable<SmartObject["bed"]>) {
  b.bed = bed;
  b.prompt.more = [{ id: "sleep", label: "Sleep till morning" }];
  b.prompt.lines = ["Get your head down, or just sit a minute."];
  b.effect = { text: "Five minutes off your feet." };
}

/** The game's sofa against any side, its seats and (optionally) a TV watched from it. */
function sofaSeats(c: Ctx, id: string, len: number, x: number, z: number, facing: number, o: { label?: string; fabric?: any } = {}): SmartObject {
  const f = fwdOf(facing);
  const dir = Math.abs(f[0]) > 0.5 ? (f[0] > 0 ? "e" : "w") : f[1] > 0 ? "s" : "n";
  c.solids.push(sofa(c.k, o.fabric ?? c.fabricM, len, x, z, dir as any, c.woodM));
  // the hips: the seat's front edge less 0.16 m
  const edge = SOFA.depth / 2 - SOFA.front;
  const seats = len > 1.9 ? 3 : 2;
  const s = seatObject({ id, label: o.label ?? "Sofa", at: [x + f[0] * edge, z + f[1] * edge], facing, seats, y: SOFA.y, spacing: Math.min(0.63, (len - 0.5) / seats), front: SOFA.front, verb: "Sit down", lines: ["Feet up for a bit."] });
  return s;
}

/** A painted picture for a wall: abstract shapes in a palette (no real art). One draw with its frame. */
function artPiece(c: Ctx, x: number, y: number, z: number, ry: number, w: number, h: number, seed: number, palette?: string[]) {
  const { k } = c;
  const { THREE } = k;
  const [can, g] = cv(256, Math.round(256 * (h / w)));
  const r = rnd(seed * 977 + 13);
  const pal = palette ?? [["#e9d8b8", "#c0603a", "#2f5a7a", "#e2b44a", "#1d2b3a"], ["#efe6da", "#7a8f6a", "#d9a36a", "#3c4a5c", "#b5523b"], ["#f2ece2", "#2a6b6b", "#e4b85c", "#c9785a", "#222222"]][seed % 3];
  g.fillStyle = pal[0]; g.fillRect(0, 0, can.width, can.height);
  for (let i = 0; i < 7; i++) {
    g.fillStyle = pal[1 + Math.floor(r() * (pal.length - 1))];
    g.globalAlpha = 0.65 + r() * 0.35;
    const kind = r();
    if (kind < 0.4) { g.beginPath(); g.arc(r() * can.width, r() * can.height, 20 + r() * 70, 0, Math.PI * 2); g.fill(); }
    else if (kind < 0.75) g.fillRect(r() * can.width * 0.8, r() * can.height * 0.8, 30 + r() * 120, 20 + r() * 110);
    else { g.lineWidth = 6 + r() * 14; g.strokeStyle = g.fillStyle; g.beginPath(); g.moveTo(r() * can.width, r() * can.height); g.quadraticCurveTo(r() * can.width, r() * can.height, r() * can.width, r() * can.height); g.stroke(); }
  }
  g.globalAlpha = 1;
  const t = k.tex(can);
  const holder = new THREE.Group();
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h), k.mat("#ffffff", { map: t, roughness: 0.85 }));
  pic.position.z = 0.03;
  holder.add(pic);
  const frameM = k.mat("#1d1a17", { roughness: 0.5 });
  const fr = (fw: number, fh: number, fx: number, fy: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.05), frameM); m.position.set(fx, fy, 0.02); holder.add(m); };
  fr(w + 0.08, 0.04, 0, h / 2 + 0.02); fr(w + 0.08, 0.04, 0, -h / 2 - 0.02); fr(0.04, h, -w / 2 - 0.02, 0); fr(0.04, h, w / 2 + 0.02, 0);
  holder.position.set(x, y, z);
  holder.rotation.y = ry;
  k.add(holder);
  // a picture light over it
  k.glow(k.glowT, "#ffe0a8", 0.16, w * 1.4, h * 1.2, x + Math.sin(ry) * 0.04, y + 0.1, z + Math.cos(ry) * 0.04, 0, ry);
}

/**
 * THE STOCKED FRIDGE (the world kit's, Harry: "genuinely incredible"): a dark drinks fridge, four
 * lit shelves of KIB cans (one instanced draw), a cool light strip and a glass door hinged on its
 * left that swings open while you take one. Its back to the wall, its door looking along `facing`.
 */
function drinksFridge(c: Ctx, id: string, x: number, z: number, facing: number, label = "Drinks fridge"): SmartObject {
  const { k } = c;
  const { THREE } = k;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = facing;
  const dark = k.mat("#2a2d33", { roughness: 0.4, metalness: 0.5 });
  const box = (w: number, h: number, d: number, m: any, bx: number, by: number, bz: number, parent: any = g) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(bx, by, bz); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  // the body (0.62 wide, 0.6 deep, 1.55 tall), its lit inside, shelves and cans
  box(0.62, 1.55, 0.46, dark, 0, 0.775, -0.07);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 1.38), k.mat("#000000", { emissive: "#cfe9ff", emissiveIntensity: 0.55 }));
  back.position.set(0, 0.79, 0.165); g.add(back);
  for (const sx of [-1, 1]) box(0.03, 1.5, 0.16, dark, sx * 0.295, 0.75, 0.24);
  box(0.62, 0.05, 0.16, dark, 0, 1.52, 0.24);
  box(0.62, 0.08, 0.16, dark, 0, 0.04, 0.24);
  const shelfM = k.mat("#dfe7ee", { roughness: 0.3, metalness: 0.2, emissive: "#9fc4e0", emissiveIntensity: 0.25 });
  const SH = [0.2, 0.52, 0.84, 1.16];
  for (const y of SH) box(0.56, 0.012, 0.14, shelfM, 0, y, 0.24);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.02), new THREE.MeshBasicMaterial({ color: "#e6f4ff", toneMapped: false }));
  strip.position.set(0, 1.46, 0.26); strip.rotation.x = -Math.PI / 2; g.add(strip);
  const canG = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12);
  const cans = new THREE.InstancedMesh(canG, k.mat("#ffffff", { roughness: 0.3, metalness: 0.7 }), SH.length * 6);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const KIB = ["#d7263d", "#e2b44a", "#2563eb"];
  let n = 0;
  SH.forEach((y, row) => { for (let i = 0; i < 6; i++) { m4.makeTranslation(-0.22 + i * 0.088, y + 0.066, 0.25); cans.setMatrixAt(n, m4); cans.setColorAt(n, col.set(KIB[(i + row) % 3])); n++; } });
  g.add(cans);
  const hinge = new THREE.Group();
  hinge.position.set(-0.3, 0, 0.33);
  g.add(hinge);
  const glass = k.mat("#bfe3ff", { transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.2 });
  box(0.58, 1.42, 0.02, glass, 0.29, 0.79, 0.01, hinge).castShadow = false;
  box(0.03, 1.42, 0.035, dark, 0.575, 0.79, 0.015, hinge);
  box(0.58, 0.04, 0.035, dark, 0.29, 1.49, 0.015, hinge);
  box(0.58, 0.04, 0.035, dark, 0.29, 0.09, 0.015, hinge);
  box(0.02, 0.5, 0.03, k.mat("#c9cdd2", { metalness: 0.9, roughness: 0.25 }), 0.53, 0.95, 0.05, hinge); // the handle
  k.add(g);
  c.keep.add(g);
  // the cool light it throws on the floor in front
  const f = fwdOf(facing);
  k.glow(k.patchT, "#cfe6ff", 0.16, 0.9, 0.9, x + f[0] * 0.6, 0.009, z + f[1] * 0.6, -Math.PI / 2, 0);
  const r = rightOf(facing);
  const hx = (Math.abs(f[0]) * 0.65 + Math.abs(r[0]) * 0.64) / 2, hz = (Math.abs(f[1]) * 0.65 + Math.abs(r[1]) * 0.64) / 2;
  c.solids.push([x - hx, x + hx, z - hz, z + hz]);
  let want = 0, a = 0;
  c.X!.fx[id] = { on: (v) => { want = v ? 1 : 0; }, tick: (dt) => { a += (want - a) * Math.min(1, dt * 5); hinge.rotation.y = -a * 1.75; } };
  // he stands 0.75 m off its glass (the reach bends him forward about half a metre: his head stays out)
  const front: XZ = [x + f[0] * (0.34 + 0.72), z + f[1] * (0.34 + 0.72)];
  return standObject({
    id, kind: "fridge", label, front, face: [x, z], verb: "Take a can", lines: ["Your KIB cans, cold."],
    enter: { clip: "pickup", speed: 1.7 }, loop: [{ clip: "idle", secs: 1.2 }],
    effect: { energy: 1, text: "Ice cold. Energy +1" }, stay: [1.2, 1.2], pickR: 0.6,
  });
}

/** A TV picture that comes on while someone watches: a match, two teams' dots, the ball, a score bug. */
function tvScreen(c: Ctx, id: string, x: number, y: number, z: number, w: number, h: number, facing: number) {
  const { k } = c;
  const { THREE } = k;
  const [can, g] = cv(320, 180);
  const t = k.tex(can);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
  scr.position.set(x, y, z); scr.rotation.y = facing; scr.visible = false;
  k.add(scr);
  c.keep.add(scr);
  const kit = c.inp.kits.home.shirt;
  let on = false, tt = 0, acc = 0;
  const draw = () => {
    g.fillStyle = "#2f7d32"; g.fillRect(0, 0, 320, 180);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#2b7330" : "#348a37"; g.fillRect(i * 40, 0, 40, 180); }
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 2; g.strokeRect(10, 14, 300, 152); g.beginPath(); g.moveTo(160, 14); g.lineTo(160, 166); g.stroke();
    g.beginPath(); g.arc(160, 90, 24, 0, Math.PI * 2); g.stroke();
    const bx = 160 + Math.sin(tt * 0.7) * 110, by = 90 + Math.sin(tt * 1.3) * 50;
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i < 3 ? kit : "#f2f2f2";
      g.beginPath(); g.arc(bx + Math.sin(tt * 0.9 + i * 2) * 40 + (i - 2.5) * 14, by + Math.cos(tt * 1.1 + i) * 30, 5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#fff"; g.beginPath(); g.arc(bx, by, 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(12, 16, 92, 20); g.fillStyle = "#fff"; g.font = "bold 13px sans-serif"; g.fillText(`KIB 1-0 ${String(Math.floor(tt / 2) % 90).padStart(2, "0")}'`, 18, 31);
    t.needsUpdate = true;
  };
  c.X!.fx[id] = {
    on: (v) => { on = v; scr.visible = v; if (v) draw(); },
    tick: (dt) => { if (!on) return; tt += dt; acc += dt; if (acc > 0.1) { acc = 0; draw(); } },
  };
}

/** Shaded corners: where walls meet the floor and the ceiling, and in the room's corners (painted, one draw). */
function aoCorners(c: Ctx, open: Wall[] = [], ceiling = true) {
  const { k, W2, D2, H } = c;
  const { THREE } = k;
  const [can, g] = cv(8, 64);
  const gr = g.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, "rgba(0,0,0,0.3)"); gr.addColorStop(0.45, "rgba(0,0,0,0.09)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 8, 64);
  const m = new THREE.MeshBasicMaterial({ map: k.tex(can), transparent: true, depthWrite: false, color: "#3a2a1c" });
  const put = (w: number, h: number, x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(x, y, z); me.rotation.set(rx, ry, rz, "YXZ"); me.renderOrder = 1;
    k.add(me);
  };
  const walls: [Wall, number, number, number, number][] = [["n", 0, -D2, W2 * 2, 0], ["s", 0, D2, W2 * 2, Math.PI], ["w", -W2, 0, D2 * 2, Math.PI / 2], ["e", W2, 0, D2 * 2, -Math.PI / 2]];
  for (const [wl, x, z, len, ry] of walls) {
    if (open.includes(wl)) continue;
    const fx = Math.sin(ry), fz = Math.cos(ry); // into the room
    // (the floor along the wall: the baked floor shade now, ./bakeShade.ts)
    // up the wall from the floor, and down it from the ceiling
    put(len, 0.32, x + fx * 0.012, 0.16, z + fz * 0.012, 0, ry, Math.PI);
    if (ceiling) put(len, 0.4, x + fx * 0.012, H - 0.2, z + fz * 0.012, 0, ry, 0);
    // the two vertical corners of this wall (dark towards the corner)
    for (const side of [-1, 1]) {
      const rx2 = Math.cos(ry), rz2 = -Math.sin(ry);
      put(0.36, H, x + rx2 * side * (len / 2 - 0.18) + fx * 0.013, H / 2, z + rz2 * side * (len / 2 - 0.18) + fz * 0.013, 0, ry, side > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  }
}

/** Swap the shell's generic floor shade for one baked from this room (./bakeShade.ts): 0 ms a frame. */
function bakeFloor(c: Ctx, open: Wall[]) {
  const { k, plan } = c;
  let plane: any = null;
  k.root.traverse((o: any) => { if (!plane && o.userData?.floorShade) plane = o; });
  if (!plane) return;
  const sh = floorShade(plan.w, plan.d, c.solids, open);
  const [can, g] = cv(sh.nx, sh.nz);
  const img = g.createImageData(sh.nx, sh.nz);
  for (let n = 0; n < sh.alpha.length; n++) { img.data[n * 4] = 20; img.data[n * 4 + 1] = 14; img.data[n * 4 + 2] = 8; img.data[n * 4 + 3] = Math.round(255 * sh.alpha[n]); }
  g.putImageData(img, 0, 0);
  plane.material.map?.dispose();
  plane.material.map = k.tex(can);
  plane.material.needsUpdate = true;
}

/** A table lamp (the kit's) that glows, and its pool of light. */
function tableLamp(c: Ctx, x: number, y: number, z: number, square = false) {
  c.F!.put(square ? "lampSquareTable" : "lampRoundTable", x, z, 0, { y, glow: "#ffcf8a", solid: false, cast: false });
  c.k.glow(c.k.glowT, "#ffcf8a", 0.16, 1.3, 1.3, x, y + 0.45, z, 0, 0);
  c.k.glow(c.k.patchT, "#ffd9a0", 0.14, 1.4, 1.4, x, 0.009, z, -Math.PI / 2, 0);
}

/** A tall lamp (the kit's) with its glow on the wall behind and the floor. */
function standLamp(c: Ctx, x: number, z: number, wallRy: number | null) {
  c.F!.put("lampRoundFloor", x, z, 0, { glow: "#ffcf8a", pad: 0.05 });
  c.k.glow(c.k.glowT, "#ffcf8a", 0.15, 1.6, 1.8, x, 1.5, z, 0, wallRy ?? 0);
  c.k.glow(c.k.patchT, "#ffd9a0", 0.16, 1.8, 1.8, x, 0.009, z, -Math.PI / 2, 0);
}

/** A shelf unit (the kit's open bookcase) filled: books, small plants, a radio. Its back to the wall, looking along `facing`. */
function filledShelf(c: Ctx, x: number, z: number, facing: number, low = false) {
  const F = c.F!;
  F.put(low ? "bookcaseOpenLow" : "bookcaseOpen", x, z, facing, { pad: 0.02 });
  const r = rightOf(facing), f = fwdOf(facing);
  const ys = low ? [0.05, 0.42, 0.8] : [0.05, 0.47, 0.9, 1.33, 1.76];
  ys.forEach((y, i) => {
    const items = ["books", "plantSmall1", "books", "radio", "plantSmall2", "books", "plantSmall3"];
    for (const [j, off] of [[0, -0.2], [1, 0.18]] as [number, number][]) {
      const it = items[(i * 2 + j) % items.length];
      if (it === "radio" && i === ys.length - 1) continue;
      if (it.startsWith("plantSmall")) { smallPlant(c, x + r[0] * off - f[0] * 0.02, y, z + r[1] * off - f[1] * 0.02); continue; }
      F.put(it, x + r[0] * off - f[0] * 0.02, z + r[1] * off - f[1] * 0.02, facing + (j ? 0.15 : -0.1), { y, solid: false, cast: false });
    }
  });
}

/** A small real-leaf plant on a shelf or a counter (a snake plant or a little monstera, ~0.35 m). */
function smallPlant(c: Ctx, x: number, y: number, z: number) {
  plant(c.k, c.potM, c.leafM, x, z, { y, h: 0.36, kind: Math.abs(Math.round(x * 5 + z * 3)) % 2 ? "snake" : "monstera", pot: "#e9e4da" });
}

/** A plant from the kit (taller and leafier than the built pot). */
/**
 * THE HOME GYM'S WAY IN (Harry, 28 Nov 2026; lib/star/gym/homeGym.ts). A thing whose card has "Start a workout":
 * the page opens your home gym of this house's level (the club gym's own machines and games). The thing's own
 * "use" stays what it was (a stretch, a run).
 */
function gymWayIn(c: Ctx, o: SmartObject) {
  const g = homeGymOf(c.R.tier);
  o.prompt.more = [{ id: "gym", label: "Start a workout" }];
  o.prompt.lines = [`${g.label}: ${g.kinds.length} exercises, the club gym's own.`, "Same numbers and limits as the club gym."];
  return o;
}

/** A folded towel in your club's colours and a water bottle, the home gym room's own (world3d/gymPlace.ts), in a painter's frame. */
function towelAndBottle(P: ReturnType<typeof painter>, club: string, tx: number, ty: number, tz: number, bx: number, by: number, bz: number) {
  P.box(0.34, 0.03, 0.24, "#f4f1ea", tx, ty + 0.015, tz);
  P.box(0.32, 0.03, 0.23, "#ebe6dc", tx + 0.01, ty + 0.045, tz);
  P.box(0.32, 0.012, 0.05, club, tx + 0.01, ty + 0.066, tz + 0.06);
  P.cyl(0.036, 0.036, 0.21, "#2f7fd0", bx, by + 0.105, bz, 0, 0, 0, 12);
  P.cyl(0.024, 0.028, 0.04, "#1d1e22", bx, by + 0.23, bz, 0, 0, 0, 10);
}

/** A kettlebell standing on the floor (a ball with a handle), in a painter's frame. */
function kettlebell(P: ReturnType<typeof painter>, r: number, colour: string, x: number, z: number, ry = 0) {
  P.ball(r, colour, x, r * 0.92, z, 12);
  P.box(r * 1.3, 0.03, r * 0.9, colour, x, 0.015, z);
  P.ring(r * 0.62, 0.016, colour, x, r * 1.85 + 0.03, z, 0, ry, 0);
}

/**
 * The workout corner of the smaller homes (starter, flat, penthouse, the house's garage), matched to the home gym it
 * opens (Harry, 28 Nov 2026): a teal mat, and past its far end the kit, all one draw and one little solid you walk round.
 *   starter, flat: a two-shelf dumbbell stand (two pairs), the folded towel in your club colours on top, a water
 *     bottle beside it; the flat adds a kettlebell.
 *   penthouse, house: a three-shelf rack (two pairs on each of two shelves), the towel and the bottle on its top
 *     shelf, a kettlebell; the penthouse adds a foam roller.
 * `alongX`: the mat's long side runs along x (else it runs along z and its far end is to the north). `front`: where
 * you stand for it. Nothing stands on the mat (he stretches there), nothing passes into anything (RUL-3D-005).
 */
function homeGymCorner(c: Ctx, x: number, z: number, alongX: boolean, front: XZ, face: XZ) {
  const { k, env, X: X0 } = c;
  const X = X0!;
  const P = painter(k, env);
  const club = c.inp.kits.home.shirt;
  const steel = "#26282c", iron = "#151619", chrome = "#c9cdd3";
  // the mat's own frame: local +x runs to its far end, local z across it
  P.at(x, z, alongX ? 0 : Math.PI / 2);
  P.box(1.6, 0.02, 0.7, "#2d6b6b", 0, 0.01, 0);
  P.box(1.54, 0.004, 0.02, "#3c8383", 0, 0.022, 0.29);
  /** A dumbbell lying with its handle along local x (the stand's depth), bells of radius r. */
  const dumbbell = (cx: number, y: number, cz: number, r: number) => {
    P.cyl(0.014, 0.014, 0.3, chrome, cx, y + r, cz, 0, 0, Math.PI / 2, 8);
    for (const e2 of [-0.12, 0.12]) P.cyl(r, r, 0.06, iron, cx + e2, y + r, cz, 0, 0, Math.PI / 2, 8);
  };
  const big = c.R.tier === "penthouse" || c.R.tier === "house";
  const kx = 1.03; // the kit's middle, 0.23 m past the mat's far end
  let box: [number, number, number, number]; // its footprint in the mat's frame: x0, x1, z0, z1
  if (!big) {
    // the stand: two side frames (a post and a foot), two shelves, a pair on each, the towel on its top
    const zs = [-0.26, 0.14], ys = [0.24, 0.5];
    for (const sz of zs) {
      P.box(0.04, 0.64, 0.04, steel, kx, 0.32, sz);
      P.box(0.34, 0.03, 0.05, steel, kx, 0.015, sz);
    }
    for (const y of ys) P.box(0.34, 0.025, zs[1] - zs[0] + 0.04, steel, kx, y, (zs[0] + zs[1]) / 2);
    P.box(0.34, 0.025, zs[1] - zs[0] + 0.04, steel, kx, 0.655, (zs[0] + zs[1]) / 2);
    for (const [y, r] of [[ys[0] + 0.0125, 0.06], [ys[1] + 0.0125, 0.045]] as [number, number][]) for (const cz of [-0.14, 0.02]) dumbbell(kx, y, cz, r);
    // the towel on the top shelf, the bottle on the floor beside the stand
    towelAndBottle(P, club, kx, 0.668, -0.06, kx, 0, 0.3);
    box = [kx - 0.2, kx + 0.2, -0.32, 0.36];
    if (c.R.tier === "flat") { kettlebell(P, 0.085, iron, kx - 0.02, -0.44); box[2] = -0.55; }
  } else {
    // the rack: two end frames, three shelves; two pairs on each of the lower two, the towel and bottle on the top
    const z0 = -0.4, z1 = 0.36, ys = [0.2, 0.46, 0.72];
    for (const sz of [z0, z1]) {
      P.box(0.05, 0.75, 0.05, steel, kx, 0.375, sz);
      P.box(0.38, 0.03, 0.06, steel, kx, 0.015, sz);
    }
    for (const y of ys) P.box(0.36, 0.025, z1 - z0 + 0.05, steel, kx, y, (z0 + z1) / 2);
    const cols = [-0.28, -0.1, 0.08, 0.25];
    cols.forEach((cz, i) => dumbbell(kx, ys[0] + 0.0125, cz, 0.07 - i * 0.004));
    cols.forEach((cz, i) => dumbbell(kx, ys[1] + 0.0125, cz, 0.05 - i * 0.003));
    towelAndBottle(P, club, kx, ys[2] + 0.0125, -0.16, kx, ys[2] + 0.0125, 0.2);
    // a kettlebell on the floor at the rack's end, in your colours
    kettlebell(P, 0.1, club, kx - 0.02, -0.6);
    box = [kx - 0.22, kx + 0.22, -0.74, 0.42];
    if (c.R.tier === "penthouse") {
      // a foam roller lying along the rack's open side, off the mat
      P.cyl(0.07, 0.07, 0.42, "#2d6b6b", kx, 0.07, 0.62, Math.PI / 2, 0, 0, 12);
      box[3] = 0.86;
    }
  }
  P.done({ roughness: 0.6 });
  // the kit's footprint in the room (a little solid: you walk round it)
  const cs = [[box[0], box[2]], [box[1], box[2]], [box[0], box[3]], [box[1], box[3]]].map(([u, v]) => (alongX ? [x + u, z + v] : [x + v, z - u]));
  const xs = cs.map((p) => p[0]), zs = cs.map((p) => p[1]);
  c.solids.push([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]);
  const o = standObject({
    id: "homegym", kind: "gym", label: homeGymOf(c.R.tier).label, front, face, verb: "Stretch", lines: [],
    loop: [{ clip: "stretch", or: ["idle"], secs: 6 }], effect: { mood: 1, text: "Loose." }, stay: [6, 6], pickR: 0.9, pickH: 0.6,
  });
  o.pick = { at: [x, z], r: 0.9, h: 0.6 };
  X.things.push(gymWayIn(c, o));
}

function kitPlant(c: Ctx, x: number, z: number, s = 1) {
  c.solids.push(plant(c.k, c.potM, c.leafM, x, z, { h: 1.3 * s, pot: c.R.tier === "estate" || c.R.tier === "villa" ? "#d8cfc0" : c.R.tier === "penthouse" ? "#2b2b30" : "#c4815a" }));
}

/** Bathroom and kitchen tiles: a grid on a light ground. */
function tileCanvas(ground: string, line: string, n = 8) {
  const [can, g] = cv(256, 256);
  g.fillStyle = ground; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = line; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) { const p = (i * 256) / n; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke(); }
  return can;
}

/** Tiles up a wall (to 1.25 m, or full height), round its doorways. */
function tileWalls(c: Ctx, walls: Wall[], top: number, colour = "#eef2f2") {
  const { k, W2, D2, plan } = c;
  const m = k.mat("#ffffff", { map: k.tex(tileCanvas(colour, "#9aa8ab"), [4, 2]), roughness: 0.3, envMapIntensity: 0.5 });
  for (const wl of walls) {
    const along = wl === "n" || wl === "s" ? "x" : "z";
    const at = wl === "n" ? -D2 + 0.012 : wl === "s" ? D2 - 0.012 : wl === "w" ? -W2 + 0.012 : W2 - 0.012;
    const len = along === "x" ? W2 * 2 : D2 * 2;
    const holes = plan.doors.filter((d) => d.wall === wl).map((d) => ({ c: along === "x" ? d.x : d.z, w: d.half * 2, y0: 0, y1: 2.15 }));
    wallWith(k, c.H, along, at, len, holes, m, 0.11, top, 0.012);
  }
}

// ── The rooms ───────────────────────────────────────────────────────────────

/** The starter flat: one room with a bed, a kitchenette, a small TV and sofa, the wardrobe and the cabinet. */
export function buildStudio(c: Ctx, h: LivingHooks) {
  const { k, env, R, plan, W2, D2, H, X: X0 } = c;
  const X = X0!;
  const F = c.F!;
  const shell = shellOf(k, env, R, plan, [
    { wall: "e", c: -0.35, w: 1.2, y0: 0.95, y1: Math.min(H - 0.3, 2.2), view: R.view },
    { wall: "w", c: 1.75, w: 1.3, y0: 0.95, y1: Math.min(H - 0.3, 2.2), view: R.view },
  ]);
  const { metalM, glassM } = shell;
  h.wardrobe(metalM, Math.min(R.wardrobe, 1.8));
  h.cabinet(glassM);
  // the bed: headboard on the east wall, its foot to the west
  const bx = W2 - 1.15, bz = -D2 + 1.0;
  F.put("bedDouble", bx, bz, -Math.PI / 2, { tint: { carpet: "#5d6f86" } });
  F.put("cabinetBedDrawerTable", W2 - 0.28, bz + 1.25, -Math.PI / 2);
  tableLamp(c, W2 - 0.28, 0.53, bz + 1.25);
  F.put("rugRound", bx - 1.3, bz + 0.3, 0, { s: 0.6, solid: false, tint: { carpet: "#c9b48e" } });
  artPiece(c, W2 - 0.03, 1.55, bz, -Math.PI / 2, 1.0, 0.7, 3);
  X.things.push(seatObject({ id: "bed", label: "Bed", at: [bx - 0.35, bz + 0.95 - 0.2], facing: 0, seats: 1, y: 0.54, front: 0.15, verb: "Sit on the bed", lines: ["Five minutes off your feet."], loop: [{ clip: "sit_down", hold: 1.55, secs: 6 }], stay: [8, 14] }));
  bedSleeps(X.things[X.things.length - 1], { at: [bx, bz], head: Math.PI / 2, top: 0.54, duvet: "#5d6f86" });
  // the kitchenette along the south wall (west of the front door): the stocked fridge, sink, hob, a coffee machine
  const kz = D2 - 0.45;
  X.things.push(drinksFridge(c, "fridge", -W2 + 0.38, D2 - 0.36, Math.PI));
  F.put("kitchenCabinet", -W2 + 1.15, kz, Math.PI, { tint: { wood: "#e9e3d8" } });
  F.put("kitchenSink", -W2 + 2.01, kz, Math.PI, { tint: { wood: "#e9e3d8" } });
  F.put("kitchenStove", -W2 + 2.87, kz, Math.PI, { tint: { wood: "#e9e3d8" } });
  for (const ux of [-W2 + 1.15, -W2 + 2.01, -W2 + 2.87]) F.put("kitchenCabinetUpper", ux, D2 - 0.23, Math.PI, { y: 1.5, solid: false, tint: { wood: "#e9e3d8" } });
  F.put("kitchenCoffeeMachine", -W2 + 1.15, kz + 0.12, Math.PI, { y: 0.9, solid: false });
  F.put("kitchenMicrowave", -W2 + 2.87, kz + 0.15, Math.PI, { y: 0.9 + 0.0, solid: false, s: 0.85 });
  k.glow(k.glowT, "#ffe6c0", 0.2, 2.6, 0.9, -W2 + 2.0, 1.2, D2 - 0.04, 0, Math.PI);
  X.things.push(coffeeThing("coffee", [-W2 + 1.15, kz - 0.45 - 0.55], [-W2 + 1.15, D2]));
  // the sofa facing the small TV on the east wall
  const sx = -0.85, sz = 1.25;
  const sofaObj = sofaSeats(c, "sofa", 2.0, sx, sz, Math.PI / 2);
  X.things.push(sofaObj);
  F.put("cabinetTelevision", W2 - 0.26, sz, -Math.PI / 2, { s: 0.8 });
  F.put("televisionModern", W2 - 0.26, sz, -Math.PI / 2, { y: 0.5, s: 0.72, solid: false });
  tvScreen(c, "tv", W2 - 0.26 - 0.1, 0.5 + 0.36, sz, 0.86, 0.46, -Math.PI / 2);
  X.things.push(tvObject({ id: "tv", at: [W2 - 0.3, sz], via: "sofa", lines: ["The weekend's highlights are on."] }));
  F.put("tableCoffee", 0.55, sz, Math.PI / 2, { s: 0.8, tint: { wood: c.wood } });
  F.put("rugRounded", 0.35, sz, Math.PI / 2, { s: 0.85, solid: false, tint: { carpet: "#7d6a58" } });
  standLamp(c, sx - 0.55, sz - 1.25, null);
  F.put("speakerSmall", W2 - 0.25, sz + 0.95, -Math.PI / 2);
  smallPlant(c, W2 - 0.25, 0.5, sz - 0.55);
  // the west wall: a low shelf of books and plants under the window, a tall plant
  filledShelf(c, -W2 + 0.27, 1.75, Math.PI / 2, true);
  kitPlant(c, -W2 + 0.35, 0.65);
  kitPlant(c, W2 - 0.4, D2 - 0.4, 0.9);
  F.put("coatRackStanding", 0.25 + 0.0, D2 - 0.35, Math.PI, {});
  artPiece(c, W2 - 0.03, 1.6, D2 - 0.9, -Math.PI / 2, 0.7, 0.9, 7);
  X.guests.push({ obj: "sofa", slot: "s0" });
  // the workout corner between the bed's foot and the sofa (lib/star/gym/homeGym.ts: the starter's gym)
  homeGymCorner(c, 0.6, -1.0, true, [0.3, -1.0], [0.3, 2.0]);
  return shell;
}

/** Make a coffee: stand at the machine, a cup comes into your hand. */
function coffeeThing(id: string, front: XZ, face: XZ): SmartObject {
  return standObject({
    id, kind: "counter", label: "Coffee machine", front, face, verb: "Make a coffee", lines: ["A flat white before training."],
    enter: { clip: "pickup", speed: 1.4 }, loop: [{ clip: "idle", secs: 1.4 }],
    effect: { energy: 1, text: "Fresh coffee. Energy +1" }, stay: [1.4, 1.4], pickR: 0.5,
  });
}

/**
 * THE RANGE (villa and estate kitchens, 28 Nov 2026): a range cooker built in the house's own style,
 * a pan of food on the front burner and a pot behind (the kit's wall cupboard over it, as before); where the chef cooks (houseRoutines.ts "cook" at the
 * hob). Its fx "hob": the ring under the pan glows and steam rises while someone cooks. Against the north wall,
 * front to +z, on the kit stove's footprint. One still draw (painter); the ring and the steam
 * are drawn only while it is on.
 */
function rangeCooker(c: Ctx, x: number, nz: number, size: [number, number, number] | null, style: "villa" | "estate"): SmartObject {
  const { k, env } = c;
  const { THREE } = k;
  const [w, , d] = size ?? [0.86, 0.9, 0.6];
  const zf = nz + d / 2;
  const top = 0.9;
  const S = style === "estate"
    ? { body: "#ebe2cc", trim: "#c9a45c", door: "#e2d7bd", top: "#18191c", ring: "#6b5a3c" }
    : { body: "#b8bdc3", trim: "#e3e6ea", door: "#1c1f23", top: "#111214", ring: "#3c3f44" };
  const P = painter(k, env);
  P.box(w - 0.01, top - 0.04, d, S.body, x, (top - 0.04) / 2, nz);
  P.box(w + 0.02, 0.04, d + 0.03, S.top, x, top - 0.02, nz + 0.01);
  if (style === "estate") {
    // two oven doors side by side, brass rails, a brass bar along the front
    for (const sx of [-1, 1]) {
      P.box(w * 0.42, 0.5, 0.02, S.door, x + sx * w * 0.235, 0.4, zf + 0.01);
      P.box(w * 0.3, 0.022, 0.022, S.trim, x + sx * w * 0.235, 0.6, zf + 0.04);
    }
    P.box(w * 0.92, 0.02, 0.02, S.trim, x, top - 0.09, zf + 0.05);
  } else {
    P.box(w * 0.82, 0.5, 0.02, S.door, x, 0.41, zf + 0.01);
    P.box(w * 0.66, 0.022, 0.022, S.trim, x, 0.71, zf + 0.05);
  }
  for (let i = 0; i < 5; i++) P.cyl(0.022, 0.022, 0.03, style === "estate" ? S.trim : "#2a2c30", x - w * 0.36 + i * w * 0.18, 0.8, zf + 0.02, Math.PI / 2, 0, 0, 10);
  // four burners; the pan on the front left, a pot on the back right
  const bx = w * 0.22, bzF = zf - d * 0.3, bzB = nz - d * 0.18;
  for (const [rx, rz] of [[-bx, bzF], [bx, bzF], [-bx, bzB], [bx, bzB]] as [number, number][]) P.ring(0.075, 0.006, S.ring, x + rx, top + 0.006, rz, Math.PI / 2);
  const pan: [number, number, number] = [x - bx, top + 0.035, bzF];
  P.cyl(0.13, 0.11, 0.05, "#2a2a2d", pan[0], top + 0.03, pan[2], 0, 0, 0, 18);
  P.cyl(0.112, 0.112, 0.012, "#e2b84e", pan[0], top + 0.05, pan[2], 0, 0, 0, 16);
  for (const [fx, fz, col] of [[0.04, 0.02, "#d64933"], [-0.05, -0.03, "#7cb342"], [0.0, -0.06, "#d64933"], [-0.03, 0.05, "#7cb342"]] as [number, number, string][]) P.ball(0.018, col, pan[0] + fx, top + 0.06, pan[2] + fz, 6);
  // the handle out to the left, a little up
  const handle: [number, number, number] = [pan[0] - 0.13 - 0.15, top + 0.06, pan[2] + 0.02];
  P.box(0.2, 0.02, 0.028, "#1d1d20", pan[0] - 0.13 - 0.09, top + 0.05, pan[2] + 0.01, 0, 0, 0.12);
  P.cyl(0.1, 0.1, 0.14, style === "estate" ? "#c9a45c" : "#9aa0a6", x + bx, top + 0.075, bzB, 0, 0, 0, 16);
  P.cyl(0.104, 0.104, 0.012, "#2a2a2d", x + bx, top + 0.15, bzB, 0, 0, 0, 16);
  P.done({ roughness: style === "estate" ? 0.5 : 0.35, metalness: style === "estate" ? 0.15 : 0.5 });
  c.solids.push([x - w / 2, x + w / 2, nz - d / 2, zf + 0.02]);
  // on while someone cooks: the ring under the pan glows, steam rises off the pan
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 6, 24), k.glowM("#ff5a1e", 2.2));
  glowRing.rotation.x = Math.PI / 2;
  glowRing.position.set(pan[0], top + 0.004, pan[2]);
  glowRing.visible = false;
  k.add(glowRing);
  const N = 16;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const steam = new THREE.Points(geo, new THREE.PointsMaterial({ map: k.glowT, size: 0.16, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, toneMapped: false }));
  steam.visible = false;
  steam.frustumCulled = false;
  k.add(steam);
  c.keep.add(glowRing); c.keep.add(steam);
  const life = Array.from({ length: N }, (_, i) => i / N);
  let on = false, amt = 0;
  c.X!.fx.hob = {
    on: (v) => { on = v; },
    tick: (dt) => {
      amt += ((on ? 1 : 0) - amt) * Math.min(1, dt * 2);
      glowRing.visible = steam.visible = amt > 0.02;
      if (!steam.visible) return;
      for (let i = 0; i < N; i++) {
        life[i] = (life[i] + dt / 2.4) % 1;
        const t = life[i], a = i * 2.4;
        pos[i * 3] = pan[0] + Math.sin(a + t * 3) * 0.04 * (0.5 + t);
        pos[i * 3 + 1] = pan[1] + 0.04 + t * 0.55;
        pos[i * 3 + 2] = pan[2] + Math.cos(a * 1.3 + t * 2) * 0.04 * (0.5 + t);
        const b = amt * 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.15));
        col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
  // he stands at the pan, close enough to stir it (the hands: npc.ts "cook")
  const front: XZ = [pan[0] + 0.06, zf + 0.36];
  const ob = standObject({
    id: "hob", kind: "counter", label: "Hob", front, face: [pan[0] + 0.06, nz], verb: "Cook something", lines: ["A pan on the go."],
    loop: [{ clip: "idle", secs: 4, gesture: "cook" }],
    effect: { text: "Eggs and peppers. Simple, done right." }, stay: [6, 6], pickR: 0.5,
  });
  ob.hands = { pan, handle };
  return ob;
}

/** The kitchen: a run of units on the north wall under a window, a tall fridge, the island with stools, a table. */
export function buildKitchen(c: Ctx, _h: LivingHooks) {
  const { k, env, R, plan, W2, D2, H, X: X0 } = c;
  const X = X0!;
  const F = c.F!;
  const shell = shellOf(k, env, R, plan, [{ wall: "n", c: -0.4, w: 1.6, y0: 1.05, y1: Math.min(H - 0.35, 2.3), view: R.view }]);
  tileWalls(c, ["n"], 1.0 + 0.02, "#f1ede6");
  const unit = R.tier === "estate" || R.tier === "villa" ? "#3c4a5c" : R.tier === "house" ? "#7a8f6a" : "#e9e3d8";
  const tint = { wood: unit };
  const nz = -D2 + 0.45;
  // the run under the window: drawers, sink (under the window), hob, cupboard, the drinks fridge in the corner
  const xs = [-W2 + 1.29, -0.4 - 0.86, -0.4, -0.4 + 0.86, -0.4 + 1.72];
  F.put("kitchenCabinetDrawer", xs[0], -D2 + 0.32, 0, { tint });
  F.put("kitchenCabinet", xs[1], nz, 0, { tint });
  F.put("kitchenSink", xs[2], nz, 0, { tint });
  // the villa and the estate: a proper range with a pan on it, where the chef cooks (28 Nov 2026: he used to
  // "cook" at the coffee machine); the house keeps the kit's stove
  const grand = R.tier === "estate" || R.tier === "villa";
  if (grand) X.things.push(rangeCooker(c, xs[3], nz, F.size("kitchenStove"), R.tier === "estate" ? "estate" : "villa"));
  else F.put("kitchenStove", xs[3], nz, 0, { tint });
  F.put("kitchenCabinet", xs[4], nz, 0, { tint });
  for (const ux of [xs[3], xs[4]]) F.put("kitchenCabinetUpper", ux, -D2 + 0.23, 0, { y: 1.5, solid: false, tint });
  F.put("kitchenCabinetUpper", xs[1], -D2 + 0.23, 0, { y: 1.5, solid: false, tint });
  F.put("kitchenCoffeeMachine", xs[4], nz - 0.1, 0, { y: 0.9, solid: false });
  F.put("kitchenBlender", xs[1] + 0.2, nz - 0.15, 0, { y: 0.9, solid: false });
  F.put("kitchenMicrowave", xs[0], -D2 + 0.3, 0, { y: 0.944, solid: false, s: 0.85 });
  k.glow(k.glowT, "#ffe6c0", 0.24, 3.8, 0.9, 0.2, 1.25, -D2 + 0.04, 0, 0); // under-cupboard light
  X.things.push(drinksFridge(c, "fridge", -W2 + 0.38, -D2 + 0.38, 0));
  // the tall fridge-freezer on the west wall
  F.put("kitchenFridge", -W2 + 0.32, -0.2, Math.PI / 2, { tint: { metal: "#d9dde2" } });
  F.put("kitchenCabinet", -W2 + 0.45, 0.66, Math.PI / 2, { tint });
  X.things.push(coffeeThing("coffee", [xs[4], nz + 0.45 + 0.55], [xs[4], -D2]));
  // the island with stools (your guests lean here), a fruit bowl
  const iz = 0.15;
  for (const ix of [-1.6, -0.74, 0.12]) F.put("kitchenBar", ix, iz, Math.PI, { tint });
  F.put("kitchenBarEnd", 0.12 + 0.53, iz, Math.PI, { tint });
  F.put("kitchenBarEnd", -1.6 - 0.53, iz, 0, { tint });
  const P = painter(k, env);
  P.box(3.0, 0.05, 0.62, "#ece6dc", -0.74, 0.865, iz + 0.05);
  P.cyl(0.16, 0.1, 0.08, "#2b2b30", -1.0, 0.93, iz);
  for (const [fx, fz, col] of [[-1.06, iz - 0.03, "#e2b44a"], [-0.96, iz + 0.04, "#d7263d"], [-1.0, iz - 0.06, "#7cb342"]] as [number, number, string][]) P.ball(0.045, col, fx, 0.99, fz);
  P.done({ roughness: 0.4 });
  for (const sxx of [-1.6, -0.74, 0.12]) F.put("stoolBar", sxx, iz + 0.62, Math.PI, { solid: true, pad: -0.05 });
  // a round table and chairs by the south wall (sit at it)
  const tx = W2 - 1.35, tz = D2 - 1.2;
  F.put("tableRound", tx, tz, 0, { s: 0.75, tint: { wood: c.wood } });
  const chairs: [number, number, number][] = [[tx - 0.75, tz, Math.PI / 2], [tx + 0.75, tz, -Math.PI / 2]];
  for (const [cx, cz, cf] of chairs) F.put("chairCushion", cx, cz, cf, { tint: { carpet: c.inp.kits.home.shirt } });
  // (the chairs are dressing for now: the walk to a seat tucked under the table is not solved)
  F.put("rugRound", tx, tz, 0, { s: 0.95, solid: false, tint: { carpet: "#b5523b" } });
  kitPlant(c, -W2 + 0.4, D2 - 0.4);
  F.put("trashcan", -W2 + 0.3, 1.35, Math.PI / 2, { s: 0.8 });
  artPiece(c, -W2 + 0.03, 1.6, D2 - 1.4, Math.PI / 2, 0.8, 0.6, 11);
  // a pendant over the island
  for (const px of [-1.4, -0.1]) {
    const pend = new k.THREE.Mesh(new k.THREE.CylinderGeometry(0.11, 0.17, 0.2, 16, 1, true), k.glowM("#ffd9a0", 1.6));
    pend.position.set(px, H - 0.8, iz); k.add(pend);
    k.box(0.012, 0.7, 0.012, shell.metalM, px, H - 0.35, iz);
  }
  k.glow(k.patchT, "#ffe0b0", 0.14, 3.2, 1.6, -0.74, 0.9, iz, -Math.PI / 2, 0);
  X.guests.push({ obj: "coffee" });
  return shell;
}

/** The bedroom: the bed between its lamps, the wardrobe (when there is no dressing room), a reading chair, a dresser. */
export function buildBedroom(c: Ctx, h: LivingHooks) {
  const { k, env, R, plan, W2, D2, H, X: X0, inp } = c;
  const X = X0!;
  const F = c.F!;
  const shell = shellOf(k, env, R, plan, [{ wall: "s", c: W2 * 0.6, w: 1.3, y0: 0.8, y1: Math.min(H - 0.35, 2.35), view: R.view }]);
  const { metalM } = shell;
  const hasWard = plan.spots.includes("wardrobe");
  if (hasWard) h.wardrobe(metalM, Math.min(R.wardrobe, plan.d - 2.6));
  // the bed against the north wall, its foot to the south; a lamp each side
  const bx = hasWard ? 0.35 : -0.2, bz = -D2 + 1.13;
  const duvet = R.tier === "estate" ? "#6b2a2a" : R.tier === "villa" ? "#e8e0d0" : R.tier === "penthouse" ? "#3a3d44" : "#5d6f86";
  F.put("bedDouble", bx, bz, 0, { tint: { carpet: duvet } });
  for (const s of [-1, 1]) {
    F.put("cabinetBedDrawerTable", bx + s * 1.25, -D2 + 0.26, 0);
    tableLamp(c, bx + s * 1.25, 0.53, -D2 + 0.26, s > 0);
  }
  artPiece(c, bx, 1.75, -D2 + 0.03, 0, 1.4, 0.6, 5);
  F.put("rugRectangle", bx, bz + 0.9, 0, { s: 0.9, solid: false, tint: { carpet: R.tier === "estate" ? "#c9b48e" : "#d9cbb4" } });
  // you sit on the bed's FOOT, facing into the room (the side had 0.6 m to the wall: no way in on the
  // flat, 21 Nov 2026), so the ottoman that stood there is gone
  X.things.push(seatObject({ id: "bed", label: "Bed", at: [bx, bz + 1.125 - 0.2], facing: 0, seats: 1, y: 0.54, front: 0.15, verb: "Sit on the bed", lines: ["Five minutes off your feet."], stay: [8, 14] }));
  bedSleeps(X.things[X.things.length - 1], { at: [bx, bz], head: Math.PI, top: 0.54, duvet });
  // a reading chair by the window, a plant, a dresser with your things
  F.put("loungeChair", W2 - 0.75, D2 - 1.1, -Math.PI * 0.75, { tint: { carpet: "#8a9a8a" } });
  standLamp(c, W2 - 0.35, D2 - 0.35, null);
  kitPlant(c, W2 - 0.4, -D2 + 0.45);
  const dx = hasWard ? W2 - 0.25 : -W2 + 0.25;
  F.put("sideTableDrawers", dx, 0.75, hasWard ? -Math.PI / 2 : Math.PI / 2, { tint: { wood: c.wood } });
  smallPlant(c, dx, 0.77, 0.5);
  F.put("books", dx, 1.0, 0.3, { y: 0.77, solid: false });
  if (!hasWard) { framedShirt(k, env, inp.kits.home, "", c.woodM, -W2 + 0.04, 1.65, 0.4, Math.PI / 2); filledShelf(c, -W2 + 0.27, -0.9, Math.PI / 2); }
  else artPiece(c, W2 - 0.03, 1.6, 0.4, -Math.PI / 2, 0.8, 1.0, 9);
  if (R.chandelier) chandelier(k, metalM, H, bx, bz + 1.2);
  // the flat and the penthouse: the workout corner by the bed's foot (gym/homeGym.ts; the bigger homes have a gym room)
  if (R.tier === "flat" || R.tier === "penthouse") homeGymCorner(c, 0.7, D2 - 1.2, false, [0.7, D2 - 1.0], [0.7, -D2]);
  return shell;
}

/** The bathroom: shower (step in, it runs), a bath on the grand tiers, basin and mirror, toilet, towels, tiles. */
export function buildBathroom(c: Ctx, _h: LivingHooks) {
  const { k, env, R, plan, W2, D2, H, X: X0 } = c;
  const X = X0!;
  const { THREE } = k;
  const F = c.F!;
  const shell = shellOf(k, env, R, plan, [{ wall: "n", c: -W2 * 0.35, w: 0.9, y0: 1.5, y1: Math.min(H - 0.3, 2.3), view: R.view }]);
  tileWalls(c, ["n", "s", "e", "w"], 1.3, R.tier === "estate" || R.tier === "villa" ? "#d9cfbf" : "#c9d8da");
  // the shower in the north-east corner: its tray, glass, the head; walk in and it runs
  const shx = W2 - 0.6, shz = -D2 + 0.6;
  F.put("shower", shx, shz, Math.PI / 2, { solid: false });
  c.solids.push([shx + 0.5, W2, shz - 0.6, shz + 0.6], [shx - 0.6, W2, -D2, shz - 0.5]);
  const water = new THREE.Group();
  const [can, g] = cv(32, 128);
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(220,240,255,${0.25 + Math.random() * 0.4})`; g.fillRect(Math.random() * 32, Math.random() * 128, 1.5, 14 + Math.random() * 30); }
  const wt = k.tex(can); wt.wrapS = wt.wrapT = THREE.RepeatWrapping;
  const wm = new THREE.MeshBasicMaterial({ map: wt, transparent: true, depthWrite: false, opacity: 0.85 });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.36, 1.95, 16, 1, true), wm);
  cone.position.set(shx, 1.0, shz); water.add(cone);
  water.visible = false; k.add(water); c.keep.add(water);
  c.X!.fx.shower = { on: (v) => { water.visible = v; }, tick: (dt) => { if (water.visible) wt.offset.y -= dt * 2.4; } };
  X.things.push(standObject({
    id: "shower", kind: "spot", label: "Shower", front: [shx, shz], face: [shx - 1, shz], verb: "Have a shower", lines: ["Hot water after training."],
    loop: [{ clip: "idle", secs: 2 }, { clip: "stretch", or: ["idle"], secs: 2.5 }], effect: { energy: 1, text: "Fresh. Energy +1" }, stay: [5, 5], pickR: 0.55, pickH: 2.2,
  }));
  X.things[X.things.length - 1].slots[0].lift = 0.1;
  // the bath along the north wall (the grand tiers), else a towel rail there
  if (plan.w > 3.85) { // the villa (3.89 m) and the estate; it missed the villa by a centimetre before
    const ts = Math.min(1, (plan.w - 1.4) / 2.4), tbx = -W2 + 1.22, tbz = -D2 + 0.58;
    F.put("bathtub", tbx, tbz, 0, { s: ts });
    smallPlant(c, -W2 + 0.25, 0.84, -D2 + 0.25);
    // run a bath (21 Nov 2026): the tub is 0.84 m tall (Kenney's model), so no sit or lie clip fits in
    // it without legs through the side or feet in the air; the soak happens off screen (a short dip to
    // dark, "Half an hour later"), and the tub is full of water when the picture comes back
    const bw = new THREE.Mesh(new THREE.PlaneGeometry(2.0 * ts, 0.78 * ts), new THREE.MeshStandardMaterial({ color: "#7fc4dc", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }));
    bw.rotation.x = -Math.PI / 2;
    bw.position.set(tbx, 0.62 * ts, tbz);
    bw.visible = false; k.add(bw); c.keep.add(bw);
    c.X!.fx.bath = { on: (v) => { if (v) bw.visible = true; } };
    X.things.push(standObject({
      id: "bath", kind: "spot", label: "Bath", front: [tbx + 0.3, tbz + 0.56 * ts + 0.45], face: [tbx + 0.3, -D2], verb: "Have a long soak", lines: ["Run it hot. Bubbles optional."],
      loop: [{ clip: "idle", secs: 3 }], effect: { mood: 1, text: "A long soak. Mood +1" }, stay: [3.2, 3.2], pickR: 0.9, pickH: 0.9,
    }));
  } else {
    const P = painter(k, env);
    for (const y of [0.9, 1.25]) P.cyl(0.015, 0.015, 0.9, "#c9cdd2", -W2 + 1.0, y, -D2 + 0.12, 0, 0, Math.PI / 2);
    P.box(0.5, 0.55, 0.04, "#f4efe6", -W2 + 0.8, 1.05, -D2 + 0.14);
    P.box(0.4, 0.5, 0.04, c.inp.kits.home.shirt, -W2 + 1.25, 1.0, -D2 + 0.15);
    P.done({ roughness: 0.6 });
    c.solids.push([-W2, -W2 + 1.6, -D2, -D2 + 0.25]);
  }
  // the basin and its mirror on the west wall (look at yourself)
  const bz = 0.1;
  F.put("bathroomSink", -W2 + 0.3, bz, Math.PI / 2, {});
  const mir = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.75), new THREE.MeshStandardMaterial({ color: "#9fb2bf", roughness: 0.04, metalness: 1, envMapIntensity: 1.6 }));
  mir.position.set(-W2 + 0.025, 1.55, bz); mir.rotation.y = Math.PI / 2; k.add(mir);
  k.box(0.03, 0.82, 0.69, k.mat("#1d1a17", { roughness: 0.5 }), -W2 + 0.012, 1.55, bz);
  k.glow(k.glowT, "#fff1d6", 0.3, 0.9, 0.5, -W2 + 0.03, 2.02, bz, 0, Math.PI / 2);
  F.put("bathroomCabinet", -W2 + 0.15, bz - 0.7, Math.PI / 2, { y: 1.2, solid: false });
  X.things.push(standObject({
    id: "mirror", kind: "mirror", label: "Mirror", front: [-W2 + 0.95, bz], face: [-W2, bz], verb: "Check your look", lines: ["Hair, teeth, ready."],
    loop: [{ clip: "idle", secs: 1.5 }, { clip: "nod", or: ["idle"], secs: 1.5 }], effect: { mood: 1, text: "Looking sharp. Mood +1" }, stay: [3, 3], pickR: 0.45,
  }));
  // the toilet in the south-west corner, a towel ladder, a bathmat, a plant
  F.put("toilet", W2 - 0.48, D2 - 0.55, -Math.PI / 2, {});
  F.put("rugRounded", 0.0, 0.2, 0, { s: 0.42, solid: false, tint: { carpet: "#9fc4c6" } });
  kitPlant(c, W2 - 0.32, 0.2, 0.75);
  F.put("trashcan", W2 - 0.25, D2 - 1.2, 0, { s: 0.55 });
  return shell;
}

/** The pool terrace: open to the sky on three sides, the pool, loungers with towels, parasols, an outdoor bar. */
export function buildPoolTerrace(c: Ctx, _h: LivingHooks) {
  const { k, env, R, plan, W2, D2, H, X: X0, solids } = c;
  const X = X0!;
  const { THREE } = k;
  const shell = shellOf(k, env, R, plan, [], { ceiling: false, open: ["s", "e", "w"], parapet: { h: 1.0, from: 0, glass: true } });
  skyDome(k, "#5f9fd8", "#cfe2ef");
  const seaM = new THREE.MeshBasicMaterial({ map: k.tex(viewCanvas(R.view === "grounds" ? "grounds" : "sea", { open: true })), fog: false, userData: { daylight: "view" } });
  for (const [x, z, ry] of [[0, D2 + 9, Math.PI], [W2 + 9, 0, -Math.PI / 2], [-W2 - 9, 0, Math.PI / 2]] as [number, number, number][]) k.plane(26, 12, seaM, x, 3.2, z, 0, ry);
  // the pool (water, its stone edge, steps, lights)
  const pw = Math.min(6.0, plan.w - 3.0), pd = Math.min(3.4, plan.d - 3.6), pcx = -0.4, pcz = 0.6;
  const P = painter(k, env);
  const stone = "#ece4d6";
  P.box(pw + 0.6, 0.12, 0.3, stone, pcx, 0.06, pcz - pd / 2 - 0.15);
  P.box(pw + 0.6, 0.12, 0.3, stone, pcx, 0.06, pcz + pd / 2 + 0.15);
  P.box(0.3, 0.12, pd, stone, pcx - pw / 2 - 0.15, 0.06, pcz);
  P.box(0.3, 0.12, pd, stone, pcx + pw / 2 + 0.15, 0.06, pcz);
  k.plane(pw, pd, waterMat(THREE), pcx, 0.04, pcz, -Math.PI / 2).receiveShadow = true;
  k.glow(k.glowT, "#8fe8ff", 0.35, pw * 0.8, pd * 0.7, pcx, 0.05, pcz, -Math.PI / 2, 0);
  solids.push([pcx - pw / 2 - 0.3, pcx + pw / 2 + 0.3, pcz - pd / 2 - 0.3, pcz + pd / 2 + 0.3]);
  // loungers along the north side (sit on one), towels in your colours, parasols
  const F = c.F!;
  const towel = [c.inp.kits.home.shirt, "#f4efe6", c.inp.kits.home.trim];
  const lz = -D2 + 1.25;
  const lxs = [-W2 + 1.4, -W2 + 2.5, -W2 + 3.6].filter((x) => x < W2 - 2.2);
  lxs.forEach((lx, i) => {
    F.put("loungeChairRelax", lx, lz, 0, { tint: { carpet: towel[i % 3] } });
    X.things.push(seatObject({ id: `lounger${i}`, label: "Lounger", at: [lx, lz - 0.05], facing: 0, seats: 1, y: 0.4, front: 0.15, verb: "Sunbathe", lines: ["Soak up the sun for a bit."] }));
    X.things[X.things.length - 1].effect = { mood: 1, text: "Topped up the tan. Mood +1" };
  });
  for (const [ux, uz, col] of [[(lxs[0] + (lxs[1] ?? lxs[0])) / 2, lz - 0.3, "#f4efe6"], [-W2 + 1.2, D2 - 1.3, c.inp.kits.home.shirt]] as [number, number, string][]) {
    P.cyl(0.025, 0.025, 2.3, "#d9d4ca", ux, 1.15, uz);
    P.cyl(0.02, 1.15, 0.35, col, ux, 2.3, uz, 0, 0, 0, 16);
    P.cyl(0.18, 0.22, 0.08, "#9a948a", ux, 0.04, uz);
    solids.push([ux - 0.15, ux + 0.15, uz - 0.15, uz + 0.15]);
  }
  // an outdoor bar by the house wall, east end: bottles, a can fridge
  const bxx = W2 - 1.5, bzz = -D2 + 0.45;
  P.box(1.8, 1.0, 0.6, "#3a2c22", bxx, 0.5, bzz);
  P.box(1.9, 0.05, 0.7, "#ece6dc", bxx, 1.02, bzz);
  for (let i = 0; i < 6; i++) P.cyl(0.035, 0.035, 0.26, ["#2f6a3a", "#7a3a1c", "#e2b44a"][i % 3], bxx - 0.7 + i * 0.12, 1.18, bzz - 0.15);
  solids.push([bxx - 0.95, bxx + 0.95, -D2, bzz + 0.35]);
  P.done({ roughness: 0.6 });
  for (const sxx of [bxx - 0.55, bxx + 0.15]) F.put("stoolBar", sxx, bzz + 0.6, Math.PI, {});
  kitPlant(c, -W2 + 0.45, -D2 + 0.45);
  kitPlant(c, W2 - 0.45, D2 - 0.45, 1.1);
  kitPlant(c, -W2 + 0.45, D2 - 0.45, 1.1);
  // string lights over it all (one glowing draw)
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), k.glowM("#ffe2a8", 2.4), 26);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 26; i++) { const t = i / 25; m4.makeTranslation(-W2 + 0.3 + t * (plan.w - 0.6), Math.min(H, 2.9) - Math.sin(t * Math.PI) * 0.35, -D2 + 0.25 + t * 0.2); bulbs.setMatrixAt(i, m4); }
  k.add(bulbs);
  c.intro = { cam: [W2 - 0.5, 2.6, D2 - 0.4], look: [pcx, 0.2, pcz - 0.6] };
  X.guests.push({ obj: "lounger1" });
  return shell;
}

/**
 * The living lounge: the TV wall (west) with speakers and your shirts, the sofa facing it, the stocked
 * fridge in the corner, the drive window, the cabinet on the north wall when there is no trophy room,
 * shelves, lamps, a reading chair. The penthouse's is open plan: its kitchen along the east wall, an
 * island with stools.
 */
export function buildLivingLounge(c: Ctx, h: LivingHooks) {
  const { k, env, R, plan, W2, D2, H, X: X0, inp, stuff } = c;
  const X = X0!;
  const F = c.F!;
  const pent = R.tier === "penthouse";
  const hasCab = plan.spots.includes("cabinet");
  const southDoor = plan.doors.some((d) => d.wall === "s");
  const wins: WinSpec[] = [];
  if (!pent) wins.push(h.driveWindow(-D2 * 0.38, Math.min(2.6, plan.d * 0.42)));
  if (!southDoor) wins.push({ wall: "s", c: -0.6, w: 2.2, y0: 0.6, y1: Math.min(H - 0.35, 2.35), view: R.view });
  if (pent) wins.push({ wall: "s", c: -W2 * 0.45, w: 3.2, y0: 0.15, y1: Math.min(H - 0.2, 2.6), view: "skyline" });
  const shell = shellOf(k, env, R, plan, wins);
  const { metalM, glassM } = shell;
  if (hasCab) h.cabinet(glassM);
  // the TV wall: a low unit, the TV (big once you bought one), speakers, your two shirts framed
  const tvW = stuff.tv ? 1.9 : 1.25, tvH = tvW * 0.56;
  k.box(0.42, 0.45, 2.2, c.woodM, -W2 + 0.22, 0.225, 0, { cast: true });
  k.box(0.06, tvH, tvW, k.mat("#0c0d10", { roughness: 0.25, metalness: 0.4 }), -W2 + 0.08, 1.35, 0);
  k.plane(tvW - 0.06, tvH - 0.06, k.mat("#000000", { emissive: "#1e3a5c", emissiveIntensity: 0.6, roughness: 0.2 }), -W2 + 0.115, 1.35, 0, 0, Math.PI / 2);
  tvScreen(c, "tv", -W2 + 0.12, 1.35, 0, tvW - 0.08, tvH - 0.08, Math.PI / 2);
  if (stuff.console) k.box(0.3, 0.07, 0.38, k.mat("#e8e8ea", { roughness: 0.4 }), -W2 + 0.22, 0.485, 0.6);
  c.solids.push([-W2, -W2 + 0.45, -1.12, 1.12]);
  for (const s of [-1, 1]) F.put("speaker", -W2 + 0.22, s * 1.35, Math.PI / 2, { s: 0.9 });
  smallPlant(c, -W2 + 0.22, 0.45, -0.7);
  F.put("books", -W2 + 0.22, -0.35, Math.PI / 2, { y: 0.45, solid: false });
  framedShirt(k, env, inp.kits.home, "", c.woodM, -W2 + 0.04, 1.75, -2.0, Math.PI / 2);
  framedShirt(k, env, inp.kits.away, "", c.woodM, -W2 + 0.04, 1.75, 2.0, Math.PI / 2);
  k.glow(k.glowT, "#ffe0a8", 0.22, 5.2, 2.0, -W2 + 0.06, 1.7, 0, 0, Math.PI / 2);
  // the sofa facing it (club-colour cushions), the coffee table, the rug, a side table and lamp at each end
  const sx = pent ? -W2 + 3.2 : Math.min(0.55, -W2 + 3.85), sz = 0.25;
  X.things.push(sofaSeats(c, "sofa", 2.3, sx, sz, -Math.PI / 2));
  X.things.push(tvObject({ id: "tv", at: [-W2 + 0.2, 0], via: "sofa", lines: ["The weekend's highlights are on."] }));
  const cushM = k.mat(inp.kits.home.shirt, { roughness: 0.95 });
  for (const dz of [-0.62, 0.62]) { const cu = k.box(0.14, 0.36, 0.38, cushM, sx + 0.06, 0.66, sz + dz, { cast: true }); cu.rotation.z = -0.22; }
  F.put("tableCoffeeGlass", sx - 1.15, sz, Math.PI / 2, { s: 0.85 });
  F.put("rugRounded", sx - 0.9, sz, Math.PI / 2, { s: 1.0, solid: false, tint: { carpet: R.tier === "estate" ? "#6b2a2a" : R.tier === "villa" ? "#c9b48e" : "#7d6a58" } });
  for (const s of [-1, 1]) { const tz = sz + s * 1.45; F.put("cabinetBedDrawerTable", sx + 0.1, tz, -Math.PI / 2); tableLamp(c, sx + 0.1, 0.53, tz, s > 0); }
  // the stocked fridge in the north-west corner
  X.things.push(drinksFridge(c, "fridge", -W2 + 0.4, -D2 + 0.38, 0));
  // the north wall: your art (no cabinet), a shelf of books, a floor lamp
  if (!hasCab) {
    const cinema = plan.doors.some((d) => d.to === "cinema");
    artPiece(c, cinema ? 0 : 0.6, 1.65, -D2 + 0.03, 0, cinema ? 1.0 : 1.4, cinema ? 0.75 : 0.9, stuff.art ? 2 : 17);
  }
  standLamp(c, W2 - 0.45, -D2 + 0.45, -Math.PI / 2);
  // a reading chair and a tall plant in the south-west, a shelf on the east wall
  F.put("loungeChair", -W2 + 1.0, D2 - 0.85, Math.PI * 0.8, { tint: { carpet: R.tier === "estate" ? "#2f3b4a" : "#8a9a8a" } });
  kitPlant(c, -W2 + 0.35, D2 - 0.35);
  if (!pent) {
    const eastFree = plan.doors.filter((d) => d.wall === "e").map((d) => d.z);
    const shz = Math.min(D2 - 0.6, Math.max(0.2, (eastFree.length ? Math.min(...eastFree) - 1.0 : 0.8)));
    if (shz > 0.1 && shz < D2 - 0.4) filledShelf(c, W2 - 0.27, shz, -Math.PI / 2);
  }
  // the penthouse's kitchen: a run along the east wall, an island with stools
  if (pent) {
    const tint = { wood: "#2a2a2e" };
    const ex = W2 - 0.45;
    const zs = [-D2 + 0.45, -D2 + 1.31, -D2 + 2.17, -D2 + 3.03];
    F.put("kitchenCabinet", ex, zs[0], -Math.PI / 2, { tint });
    F.put("kitchenSink", ex, zs[1], -Math.PI / 2, { tint });
    F.put("kitchenStove", ex, zs[2], -Math.PI / 2, { tint });
    F.put("kitchenCabinetDrawer", W2 - 0.32, zs[3], -Math.PI / 2, { tint });
    for (const z of zs) F.put("kitchenCabinetUpper", W2 - 0.23, z, -Math.PI / 2, { y: 1.55, solid: false, tint });
    F.put("kitchenCoffeeMachine", ex + 0.1, zs[0], -Math.PI / 2, { y: 0.9, solid: false });
    F.put("kitchenBlender", ex + 0.15, zs[3] - 0.2, -Math.PI / 2, { y: 0.944, solid: false });
    k.glow(k.glowT, "#ffe6c0", 0.24, 3.4, 0.9, W2 - 0.04, 1.25, -D2 + 1.7, 0, -Math.PI / 2);
    X.things.push(coffeeThing("coffee", [ex - 1.0, zs[0]], [W2, zs[0]]));
    const ix = W2 - 2.15;
    for (const z of [-D2 + 1.0, -D2 + 1.86, -D2 + 2.72]) F.put("kitchenBar", ix, z, Math.PI / 2, { tint });
    for (const z of [-D2 + 1.0, -D2 + 1.86, -D2 + 2.72]) F.put("stoolBar", ix - 0.6, z, Math.PI / 2, {});
    const P = painter(k, env);
    P.box(0.62, 0.05, 2.7, "#ece6dc", ix - 0.03, 0.865, -D2 + 1.86);
    P.cyl(0.16, 0.1, 0.08, "#2b2b30", ix, 0.93, -D2 + 1.5);
    P.done({ roughness: 0.35 });
    for (const pz of [-D2 + 1.2, -D2 + 2.5]) { const pend = new k.THREE.Mesh(new k.THREE.CylinderGeometry(0.11, 0.17, 0.2, 16, 1, true), k.glowM("#ffd9a0", 1.6)); pend.position.set(ix, H - 0.8, pz); k.add(pend); }
    k.glow(k.patchT, "#ffe0b0", 0.2, 1.4, 3.0, ix, 0.9, -D2 + 1.86, -Math.PI / 2, 0);
  }
  // the penthouse: a dining table between the sitting area and the kitchen, a big rug under it
  if (pent) {
    const dx = 1.0, dz = 1.6;
    F.put("rugRectangle", dx, dz, 0, { solid: false, tint: { carpet: "#b9a58a" } });
    F.put("table", dx, dz, 0, { tint: { wood: "#2a2a2e" } });
    for (const s2 of [-1, 1]) for (const ox of [-0.45, 0.45]) F.put("chairCushion", dx + ox, dz + s2 * 0.7, s2 < 0 ? 0 : Math.PI, { tint: { carpet: inp.kits.home.shirt, wood: "#2a2a2e" } });
    smallPlant(c, dx, 0.65, dz);
  }
  if (R.chandelier) chandelier(k, metalM, H, sx - 1.1, sz);
  X.guests.push({ obj: "sofa", slot: "s2" }, { obj: "sofa", slot: "s0" });
  return shell;
}

// ── The rooms that were already built: what can be used in them, and more dressing ──

/** After a room is built in a living house: the shaded corners, more set dressing, the things to use. */
export function livingFinish(c: Ctx, shell: { metalM: any; glassM: any }) {
  const { k, plan, W2, D2, X: X0, inp } = c;
  const X = X0!;
  const F = c.F!;
  const id = plan.id;
  const open: Wall[] = id === "terrace" ? ["n", "e", "w"] : id === "gardenTerrace" ? ["s", "e", "w"] : id === "poolTerrace" ? ["s", "e", "w"] : [];
  aoCorners(c, open, !(id === "terrace" || id === "gardenTerrace" || id === "poolTerrace"));
  void shell;
  // the floor's shade, baked from this room's walls and the things standing in it (after the dressing below)
  const bake = () => bakeFloor(c, open);
  if (id === "hallway") {
    F.put("rugRectangle", 0, 0.2, Math.PI / 2, { s: 0.85, solid: false, tint: { carpet: R(c) === "estate" ? "#6b2a2a" : "#7d4f3a" } });
    // either side of the trophy room's door: a little table with a lamp, and a tall plant
    F.put("cabinetBedDrawerTable", -W2 + 0.45, -D2 + 0.26, 0, { tint: { wood: c.wood } });
    tableLamp(c, -W2 + 0.45, 0.53, -D2 + 0.26);
    artPiece(c, -W2 + 0.55, 1.6, -D2 + 0.03, 0, 0.5, 0.7, 21);
    kitPlant(c, W2 - 0.4, -D2 + 0.4);
  } else if (id === "lounge") {
    // set by the living lounge itself (buildLounge in roomBuild)
  } else if (id === "dressing") {
    F.put("rugRound", 0.2, 0.9, 0, { solid: false, tint: { carpet: "#c9b48e" } });
    F.put("loungeChair", W2 - 0.7, D2 - 1.2, -Math.PI * 0.7, { tint: { carpet: "#e8e0d0" } });
    artPiece(c, W2 - 0.03, 1.7, 0.9, -Math.PI / 2, 0.9, 0.7, 15);
  } else if (id === "trophy") {
    F.put("rugRectangle", 0, 0.4, 0, { solid: false, tint: { carpet: "#6b2a2a" } });
    // sit on the bench and take it all in
    X.things.push(seatObject({ id: "bench", label: "Bench", at: [-W2 + 1.0, D2 - 0.375], facing: Math.PI, seats: 2, y: 0.42, front: 0.15, spacing: 0.6, verb: "Sit and look", lines: ["Every one of them earned."] }));
    X.things[X.things.length - 1].effect = { mood: 1, text: "Proud. Mood +1" };
  } else if (id === "garage") {
    F.put("trashcan", W2 - 0.35, D2 - 0.35, 0, { s: 0.7 });
    F.put("washer", -W2 + 0.45, D2 - 0.45, Math.PI / 2, {});
    // the house's garage gym: its way in is a mat by the workbench (gym/homeGym.ts); the villa and estate have a gym room
    if (c.R.tier === "house") homeGymCorner(c, -3.0, D2 - 0.5, true, [-3.2, D2 - 0.5], [-3.2, -D2]);
  } else if (id === "gym") {
    // the treadmill (east wall, roomBuild buildGym: belt top 0.2 m, its console to the north): run on it
    const tmx = W2 - 0.6, tmz = -D2 + 1.45;
    X.things.push(standObject({
      id: "treadmill", kind: "gym", label: "Treadmill", front: [tmx, tmz + 0.15], face: [tmx, tmz - 2], verb: "Go for a run", lines: ["Twenty minutes, steady pace."],
      loop: [{ clip: "jog", secs: 6 }], effect: { energy: -1, mood: 1, text: "Sharp. Fitness +1" }, stay: [6, 6], pickR: 0.6, pickH: 1.6,
    }));
    X.things[X.things.length - 1].slots[0].lift = 0.2;
    gymWayIn(c, X.things[X.things.length - 1]);
    // the mat: stretch
    F.put("rugRectangle", 0.4, D2 - 1.3, 0, { s: 0.55, solid: false, tint: { carpet: "#2a6b6b" } });
    X.things.push(standObject({
      id: "mat", kind: "gym", label: "Stretching mat", front: [0.4, D2 - 1.3], face: [0.4, -D2], verb: "Stretch", lines: ["Loosen the hamstrings."],
      loop: [{ clip: "stretch", or: ["idle"], secs: 6 }], effect: { mood: 1, text: "Loose. Fitness +1" }, stay: [6, 6], pickR: 0.6, pickH: 0.5,
    }));
    gymWayIn(c, X.things[X.things.length - 1]);
    // behind the mat, against the south wall: the folded towel in your colours, a water bottle and a foam roller,
    // as in the home gym it opens (the room's dumbbell rack and kettlebells are roomBuild buildGym's). One draw.
    {
      const G = painter(k, c.env);
      const sz = D2 - 0.42;
      towelAndBottle(G, inp.kits.home.shirt, 0.0, 0, sz, 0.32, 0, sz + 0.04);
      G.cyl(0.075, 0.075, 0.45, "#2d6b6b", 0.78, 0.075, sz, 0, 0, Math.PI / 2, 12);
      G.done({ roughness: 0.6 });
      c.solids.push([-0.22, 1.06, sz - 0.2, D2]);
    }
    // the plant on the east wall between the treadmill and the drinks fridge (it stood inside the fridge,
    // roomBuild buildGym's south-east corner: RUL-3D-005)
    kitPlant(c, W2 - 0.4, 0.9);
    F.put("speaker", -W2 + 0.3, -D2 + 0.3, Math.PI / 4, {});
    X.guests.push({ obj: "mat" });
  } else if (id === "games") {
    // the pool table (roomBuild buildGames): line up a shot from its south end
    const pz1 = D2 - 1.7, px0 = -W2 + 0.75, px1 = px0 + Math.min(3.2, W2 - 1.2);
    const tx = Math.min(W2 - 1.8, Math.max(px1 + 1.6, W2 * 0.4)), tz = -0.4;
    X.things.push(standObject({
      id: "pool", kind: "counter", label: "Pool table", front: [tx, tz + 1.27 + 0.62], face: [tx, tz], verb: "Line up a shot", lines: ["Black ball, top corner."],
      loop: [{ clip: "lean_table", or: ["idle"], secs: 3 }], effect: { mood: 1, text: "Cleared the table. Mood +1" }, stay: [5, 5], pickR: 1.0, pickH: 1.0,
    }));
    // the arcade cabinets and the darts (roomBuild buildGames' west half)
    const az = -D2 + 1.05;
    X.things.push(standObject({
      id: "arcade", kind: "counter", label: "Arcade", front: [-W2 + 1.1, az], face: [-W2, az], verb: "Play a game", lines: ["Beat your own high score."],
      loop: [{ clip: "idle", secs: 3 }], effect: { mood: 1, text: "New high score. Mood +1" }, stay: [6, 6], pickR: 0.55, pickH: 1.9,
    }));
    const dz = Math.min(D2 - 1.7, D2 - 1.4);
    X.things.push(standObject({
      id: "darts", kind: "counter", label: "Dartboard", front: [-W2 + 2.55, dz], face: [-W2, dz], verb: "Throw some darts", lines: ["Treble twenty, if you can."],
      loop: [{ clip: "idle", secs: 3 }], effect: { mood: 1, text: "One hundred and eighty! Mood +1" }, stay: [5, 5], pickR: 0.6, pickH: 2.2,
    }));
    void px0; void pz1; void px1;
    X.guests.push({ obj: "pool" });
  } else if (id === "cinema") {
    // the recliners (roomBuild buildCinema): front row, either side of the aisle; the screen plays while you sit
    const per = Math.max(2, Math.min(3, Math.floor((W2 - 0.6 - 0.35) / 0.85)));
    for (const side of [-1, 1]) {
      const xs = Array.from({ length: per }, (_, i) => side * (0.55 + 0.425 + i * 0.85));
      const mid = (xs[0] + xs[xs.length - 1]) / 2;
      X.things.push(seatObject({ id: side < 0 ? "seatsL" : "seatsR", label: "Cinema seat", at: [mid, -0.15 - 0.05], facing: Math.PI, seats: per, spacing: 0.85, y: 0.52, front: 0.15, verb: "Watch a film", lines: ["Lights down. Your goals on the big screen."] }));
    }
    X.things[X.things.length - 1].effect = { mood: 1, text: "What a film. Mood +1" };
    X.guests.push({ obj: "seatsL", slot: "s0" });
  } else if (id === "terrace" || id === "gardenTerrace") {
    kitPlant(c, -W2 + 0.5, (id === "terrace" ? D2 : -D2) * 0.6, 1.1);
  } else if (id === "nook") {
    F.put("rugRectangle", 0, 0.1, Math.PI / 2, { s: 0.5, solid: false, tint: { carpet: "#7d4f3a" } });
  }
  bake();
}
const R = (c: Ctx) => c.R.tier;
export type { Kit };
