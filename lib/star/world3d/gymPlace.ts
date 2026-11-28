/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE GYM ROOM (Harry, 27 Nov 2026: "a gym based on the GTA 6 gym"; the plan:
 * docs/research/gym-compound-driving-2026-11-27.md phase 1, "the gym room alone"). On the world kit's
 * test page only (/star-world3d-dev?place=gym, RUL-UI-002); not in the career yet.
 *
 * A club gym, 10 × 8 m, in the living houses' look: rubber floor, painted walls with a stripe in your
 * colours, a mirror wall, strip lights, a high window, real-leaf plants (home3d/plants.ts). The kit:
 * a bench press on its own uprights, two treadmills, a heavy bag on a chain, a power rack loaded in
 * your colours, dumbbells, kettlebells, a plate tree, mats, a water cooler. Every still piece is
 * painted in vertex colours and joined into a few draws (one matte, one metal, one lit); the moving
 * pieces (the bar, the bag, the two belts) are one draw each.
 *
 * GymSession runs a mini-game (lib/star/gym/games.ts) on a machine: the fade in, "get ready", the
 * game on your thumb, your body posed to match (./gymPose.ts: lying on the bench pressing the bar,
 * running on the belt and falling off it, punching the bag), the camera shot, the fade out and the
 * result card. It runs inside the world kit's one frame (testScene.ts step): no loop of its own.
 */
import { plantMesh } from "../home3d/plants";
import { glowCanvas, wallCanvas, signCanvas, floorCanvas, viewCanvas } from "../home3d/textures";
import type { FloorKind, WindowView } from "../home3d/homes";
import type { HomeGymPlan } from "../gym/homeGym";
import { homeGymStart } from "../gym/homeGym";
import { startGame, stepGame, resultOf, botHold, GAME_NAMES, HOW_TO, TREADMILL, MAX_SECS, type GameState, type GymGameKind, type GameResult } from "../gym/games";
import { GYM2_KINDS, COPEN, type Gym2Kind, type Gym2State } from "../gym/games2";
import { STAT_OF, STAT_NAMES } from "../gym/progress";
import { Exercise2, GYM2, spot2 } from "./gymPoses2";
import { standObject, type SmartObject } from "./smartObject";
import { PoseBlend, ease } from "./gymPose";
import type { Npc } from "./npc";
import { poseFingers, fingersDeg, fingerTip, relaxHands } from "../people3d";
import type { XZ } from "../tapWalk";

/** What the room builder needs from the scene. */
export interface GymEnv {
  THREE: any;
  scene: any;
  prof: { anisotropy: number; shadows: boolean };
  /** Your club's colours (the stripe, the plates, the training tops). */
  kit: { shirt: string; trim: string };
  /** The sign over the mirror ("ARSENAL"). */
  club?: string;
  mergeGeometries: (g: any[]) => any;
  /** three's Reflector (a live mirror) and how sharp: 0 = no live mirror (Low), else its width in pixels. */
  Reflector?: any;
  mirrorPx?: number;
  /** The live mirror's picture as a share of the screen's own pixels (each way): Medium 0.5, High 0.75. The
   *  Reflector draws the room as the camera sees it (screen-shaped), so a mirror-shaped picture (wide and short)
   *  stretched each of its pixels 8 screen pixels tall: the blocks up close. Unset: the old mirror-shaped picture. */
  mirrorScale?: number;
  /** A HOME gym (gym/homeGym.ts): the tier's machines only, inside its own walls, in the house's look. Absent: the club gym. */
  home?: HomeGymLook;
}

/** A home gym's look: the plan (machines, walls, mirror, sauna) and the house's own finish (homes.ts RoomPreset). */
export interface HomeGymLook {
  plan: HomeGymPlan;
  floor: FloorKind;
  wall: string;
  trim: string;
  /** What the window looks out on. */
  view: WindowView;
  /** Ceiling height (the house's). */
  h: number;
}

export const GYM = {
  W2: 5, D2: 4, H: 3.2,
  /** The bench press: its middle across, the pad's head and foot ends, the pad's top. */
  bench: { x: -2.4, head: -1.95, foot: -0.72, top: 0.45 },
  /** Treadmills: across, the belt's front and back ends, the belt's top. */
  treadmills: [{ id: "treadmill", x: 2.55 }, { id: "treadmill2", x: 3.9 }],
  belt: { front: -2.3, back: -0.72, top: 0.2, consoleZ: -2.55 },
  bag: { x: -3.05, z: 1.45, r: 0.19, bottom: 0.52, top: 1.56 },
  cooler: { x: 4.45, z: 3.45 },
  mat: { x: 0.6, z: 1.5 },
};

/** Where you stand behind a treadmill (m behind the belt's back end): clear of its frame by more than a body's
 *  width (BODY_R 0.3 + 0.16), so the path finder can reach it; you walk up onto the belt from here. */
const TREAD_STAND = 0.6;

export interface GymRoomOut {
  objects: SmartObject[];
  solids: [number, number, number, number][];
  bounds: [number, number, number, number];
  you: { x: number; z: number; yaw: number };
  ceil: number;
  camBox: [number, number, number, number];
  sun: any;
  /** The live mirror (null on Low). */
  mirror: any;
  props: GymProps;
  /** Draws and triangles of the still room (for the report). */
  still: { meshes: number };
}

export interface GymProps {
  /** The barbell on the bench: world position of its middle. */
  bar: any;
  /** The racked spot (on the hooks). */
  barRack: { y: number; z: number };
  belts: { id: string; mat: any; speed: number }[];
  bag: { pivot: any; body: any; swing: { ax: number; az: number; vx: number; vz: number }; hit: (dx: number, dz: number, f: number) => void };
  /** Phase 2: the power rack's bar (its own draw: it goes on your back for the squat), the plyo box (scaled
   *  up as the box jumps go well), the Nordic ankle roller (set on your ankles). */
  rackBar: any;
  box: any;
  roller: any;
  tick: (dt: number) => void;
}

// ── pictures (small canvases, drawn once) ──
function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}
function rnd(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
/** Rubber gym tiles, 1 m each, dark with flecks. */
function rubberCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(256, 256);
  const r = rnd(41);
  g.fillStyle = "#2c2e33"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) { const k = r(); g.fillStyle = k < 0.15 ? "rgba(150,155,165,0.35)" : k < 0.3 ? "rgba(0,0,0,0.25)" : "rgba(80,84,92,0.3)"; g.fillRect(r() * 256, r() * 256, 2, 2); }
  g.fillStyle = "rgba(10,10,12,0.75)"; g.fillRect(0, 0, 256, 2); g.fillRect(0, 0, 2, 256);
  return c;
}
/** A treadmill belt: dark rubber slats (scrolled while it runs). */
function beltCanvas(): HTMLCanvasElement {
  const [c, g] = canvas(32, 128);
  g.fillStyle = "#16171a"; g.fillRect(0, 0, 32, 128);
  for (let y = 0; y < 128; y += 16) { g.fillStyle = "#2a2c31"; g.fillRect(0, y, 32, 3); }
  const r = rnd(7);
  for (let i = 0; i < 80; i++) { g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(r() * 32, r() * 128, 1, 1); }
  return c;
}

/** A colour a share darker (0.72 = 72% of it). */
function shadeOf(hex: string, k: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** A painter: boxes and cylinders in vertex colours, joined into one mesh (one draw). */
function painter(THREE: any, merge: (g: any[]) => any) {
  const parts: any[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
  const put = (g: any, colour: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one));
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    col.set(colour);
    const n = ng.attributes.position.count, cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
    ng.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    if (ng.attributes.uv) ng.deleteAttribute("uv");
    parts.push(ng);
  };
  return {
    box: (w: number, h: number, d: number, c: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => put(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz),
    cyl: (rt: number, rb: number, h: number, c: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, seg = 14) => put(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, rx, ry, rz),
    ball: (r: number, c: string, x: number, y: number, z: number, seg = 12) => put(new THREE.SphereGeometry(r, seg, Math.max(5, Math.round(seg * 0.7))), c, x, y, z),
    ring: (r: number, t: number, c: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => put(new THREE.TorusGeometry(r, t, 6, 16), c, x, y, z, rx, ry, rz),
    geo: (g: any, c: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => put(g, c, x, y, z, rx, ry, rz),
    get count() { return parts.length; },
    /** Join into one geometry (or null if empty). */
    merged(): any { if (!parts.length) return null; const g = merge(parts); for (const p of parts) p.dispose(); parts.length = 0; return g; },
  };
}

/** Build the gym into env.scene. */
export function buildGymRoom(env: GymEnv): GymRoomOut {
  const { THREE, scene, prof, kit } = env;
  const { W2, D2 } = GYM;
  // a home gym (gym/homeGym.ts): its own walls round the tier's machines (each machine keeps the club gym's spot)
  const home = env.home ?? null;
  const has = (k: GymGameKind) => !home || home.plan.kinds.includes(k);
  const [X0, X1, Z0, Z1] = home ? home.plan.box : [-W2, W2, -D2, D2];
  const H = home ? Math.max(2.55, home.h) : GYM.H;
  const RW = X1 - X0, RD = Z1 - Z0, CX = (X0 + X1) / 2, CZ = (Z0 + Z1) / 2;
  const doorX = home ? home.plan.doorX : 0;
  const garage = home?.plan.kind === "garage";
  const big = !home || home.plan.kind === "full" || home.plan.kind === "private";
  const solids: [number, number, number, number][] = [];
  const add = (m: any) => { scene.add(m); return m; };
  const tex = (cv: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = prof.anisotropy;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  let meshes = 0;
  const mesh = (g: any, m: any, o: { cast?: boolean; receive?: boolean } = {}) => { const me = new THREE.Mesh(g, m); me.castShadow = !!o.cast; me.receiveShadow = o.receive ?? true; meshes++; return add(me); };

  scene.background = new THREE.Color(home ? "#15130f" : "#101114");
  // ── light: the strip lights' cool white from above, warm daylight through the high window (west) ──
  scene.add(new THREE.HemisphereLight("#f2f5ff", "#3b3a3f", 1.15));
  const sun = new THREE.DirectionalLight("#fff1dc", 1.5);
  sun.position.set(X0 - 3, 6.5, CZ + 1.5);
  sun.target.position.set(CX + 0.5, 0, CZ);
  scene.add(sun, sun.target);
  sun.castShadow = prof.shadows;
  { const r = home ? Math.max(RW, RD) / 2 + 1.5 : 6.5; Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.5, far: 22 }); }
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;

  // ── floor, walls, ceiling ──
  // the floor: rubber tiles (the club, the garage); a home's own floor (its boards, oak, stone, marble), rubber mats under the kit
  const floorM = !home || garage ? new THREE.MeshStandardMaterial({ map: tex(rubberCanvas(), [RW, RD]), roughness: 0.92, ...(garage ? { color: "#b9bcc2" } : {}) })
    : new THREE.MeshStandardMaterial({ map: tex(floorCanvas(home.floor), [RW / 2, RD / 2]), roughness: home.floor === "marble" || home.floor === "stone" ? 0.35 : home.floor === "carpet" ? 0.95 : 0.6 });
  const floor = mesh(new THREE.PlaneGeometry(RW, RD), floorM);
  floor.rotation.x = -Math.PI / 2; floor.position.set(CX, 0, CZ);
  const wallParts: any[] = [];
  const wall = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const g = new THREE.PlaneGeometry(w, h);
    // the painted light's V runs up the wall: brighter high, darker at the floor
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (y - h / 2 + uv.getY(i) * h) / H);
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)));
    wallParts.push(g);
  };
  const DOOR = 0.62, DOOR_H = 2.2;
  wall(RW, H, CX, H / 2, Z0, 0); // north (the mirror covers most of it)
  wall(RD, H, X0, H / 2, CZ, Math.PI / 2); // west
  wall(RD, H, X1, H / 2, CZ, -Math.PI / 2); // east
  // south, with the doorway
  const dL = doorX - DOOR - X0, dR = X1 - (doorX + DOOR);
  wall(dL, H, X0 + dL / 2, H / 2, Z1, Math.PI);
  wall(dR, H, X1 - dR / 2, H / 2, Z1, Math.PI);
  wall(DOOR * 2, H - DOOR_H, doorX, DOOR_H + (H - DOOR_H) / 2, Z1, Math.PI);
  const wallPaint = home ? (garage ? "#d4d2cc" : home.wall) : "#d9dbd6";
  mesh(env.mergeGeometries(wallParts), new THREE.MeshStandardMaterial({ map: tex(wallCanvas(wallPaint)), roughness: 0.9 }));
  for (const g of wallParts) g.dispose();
  const ceil = mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ color: home && !garage ? "#e9e5dc" : "#3a3c41", roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(CX, H, CZ);
  solids.push([X0 - 1, X0, Z0 - 1, Z1 + 1], [X1, X1 + 1, Z0 - 1, Z1 + 1], [X0 - 1, X1 + 1, Z0 - 1, Z0], [X0 - 1, doorX - DOOR, Z1, Z1 + 1], [doorX + DOOR, X1 + 1, Z1, Z1 + 1]);

  const P = painter(THREE, env.mergeGeometries); // matte: frames, pads, mats, rubber
  const S = painter(THREE, env.mergeGeometries); // metal: steel, chrome
  const L = painter(THREE, env.mergeGeometries); // lit: strip lights, screens (no light of their own)
  const G: any[] = []; // floor glows under the lights (one additive draw)
  const steel = "#23252a", chrome = "#c9cdd3", pad = "#141518", plate = kit.shirt, plate2 = kit.trim;

  // the dark skirting, the club stripe at shoulder height round three walls, a door frame
  const skirt = home && !garage ? home.trim : "#1c1d21", frame = home && !garage ? home.trim : "#2a2b30";
  for (const [w, x, z, ry] of [[RW, CX, Z0 + 0.006, 0], [RD, X0 + 0.006, CZ, Math.PI / 2], [RD, X1 - 0.006, CZ, Math.PI / 2]] as [number, number, number, number][]) {
    P.box(w, 0.12, 0.012, skirt, x, 0.06, z, 0, ry);
    // the club's stripe in your colours (a home gym: the garage and the big rooms keep a thin one)
    if (!home) { P.box(w, 0.16, 0.012, plate, x, 2.45, z, 0, ry); P.box(w, 0.05, 0.012, plate2, x, 2.33, z, 0, ry); }
    else if (garage || big) P.box(w, 0.06, 0.012, plate, x, Math.min(2.3, H - 0.5), z, 0, ry);
  }
  for (const sx of [-1, 1]) P.box(0.08, DOOR_H, 0.16, frame, doorX + sx * (DOOR + 0.04), DOOR_H / 2, Z1 - 0.02);
  P.box(DOOR * 2 + 0.16, 0.08, 0.16, frame, doorX, DOOR_H + 0.04, Z1 - 0.02);
  // through the doorway: the corridor's lit wall (a home: the house's own paint and floor)
  L.box(DOOR * 2 + 0.4, DOOR_H + 0.1, 0.02, home ? shadeOf(home.wall, 0.72) : "#6d6a63", doorX, DOOR_H / 2, Z1 + 1.4);
  P.box(DOOR * 2 + 0.4, 0.02, 1.4, home ? "#5b4a3a" : "#3a3b40", doorX, 0.001, Z1 + 0.72);
  // a home: the hall's own side walls (seen at an angle the doorway showed the black behind them)
  if (home) for (const sx of [-1, 1]) L.box(0.04, DOOR_H + 0.1, 1.42, shadeOf(home.wall, 0.6), doorX + sx * (DOOR + 0.2), (DOOR_H + 0.1) / 2, Z1 + 0.72);

  // ── the mirror wall (north): dark glass from knee to above head, a chrome edge ──
  const withMirror = !home || home.plan.mirror;
  const MW = RW - 0.6, MH = 1.95;
  const glass = !withMirror ? null : mesh(new THREE.PlaneGeometry(MW, MH), new THREE.MeshStandardMaterial({ color: "#59616b", roughness: 0.06, metalness: 0.95, envMapIntensity: 1.6 }), { receive: false });
  glass?.position.set(CX, 1.28, Z0 + 0.012);
  // the live mirror (Medium and High): the room again, from behind the glass, at a low resolution and every
  // second frame on Medium (a wide, soft reflection reads as a gym mirror; Low keeps the glass above)
  let mirror: any = null;
  if (withMirror && env.Reflector && env.mirrorPx) {
    const scale = env.mirrorScale ?? 0;
    // screen-shaped from the first frame (resized to the real screen below); 4× smoothing only on the old mirror
    mirror = new env.Reflector(new THREE.PlaneGeometry(MW, MH), scale
      ? { textureWidth: 256, textureHeight: 512, color: 0xc4ccd4, clipBias: 0.003, multisample: 0 }
      : { textureWidth: env.mirrorPx, textureHeight: Math.round((env.mirrorPx * MH) / MW), color: 0xc4ccd4, clipBias: 0.003 });
    mirror.position.set(CX, 1.28, Z0 + 0.016);
    const every = !scale && env.mirrorPx <= 512 ? 2 : 1;
    const draw = mirror.onBeforeRender.bind(mirror);
    const rt = mirror.getRenderTarget?.(), buf = new THREE.Vector2();
    let n = 0, warm = 0;
    mirror.onBeforeRender = (...a: any[]) => {
      // the picture follows the screen's size (a turned phone, the frame governor's resolution steps)
      if (scale && rt) {
        a[0].getDrawingBufferSize(buf);
        const w = Math.max(64, Math.round(buf.x * scale)), h = Math.max(64, Math.round(buf.y * scale));
        if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
      }
      if (warm < 2 || n++ % every === 0) { warm++; draw(...a); }
    };
    meshes++;
    scene.add(mirror);
  }
  if (withMirror) {
    S.box(MW + 0.1, 0.035, 0.03, chrome, CX, 2.27, Z0 + 0.02);
    S.box(MW + 0.1, 0.035, 0.03, chrome, CX, 0.29, Z0 + 0.02);
    // the sign over it: your club's name (a home: its own name)
    const sign = mesh(new THREE.PlaneGeometry(1.9, 0.475), new THREE.MeshBasicMaterial({ map: tex(signCanvas(home ? home.plan.label.toUpperCase() : `${(env.club ?? "Club").toUpperCase()} GYM`)), toneMapped: false, transparent: true }), { receive: false });
    sign.position.set(CX - 1.2, Math.min(2.82, H - 0.3), Z0 + 0.02);
  }
  if (!home) {
    // the high window (west): daylight on a frosted strip
    L.box(0.02, 0.55, 3.6, "#f6efe0", -W2 + 0.012, 2.72, -0.2);
    P.box(0.05, 0.05, 3.7, "#2a2b30", -W2 + 0.03, 2.43, -0.2);
    P.box(0.05, 0.05, 3.7, "#2a2b30", -W2 + 0.03, 3.0, -0.2);
  } else if (!garage) {
    // the house's own window (west wall), the house's view through it, in a frame of its trim
    const ww = Math.min(1.8, RD - 1.4), wh = Math.min(1.2, H - 1.35), wy = 1.05 + wh / 2, wz = Z0 + RD * 0.42;
    const view = mesh(new THREE.PlaneGeometry(ww, wh), new THREE.MeshBasicMaterial({ map: tex(viewCanvas(home.view)), toneMapped: false }), { receive: false });
    view.rotation.y = Math.PI / 2; view.position.set(X0 + 0.014, wy, wz);
    for (const dy of [-1, 1]) P.box(0.05, 0.06, ww + 0.12, home.trim, X0 + 0.03, wy + dy * (wh / 2 + 0.03), wz);
    for (const dz of [-1, 1]) P.box(0.05, wh + 0.12, 0.06, home.trim, X0 + 0.03, wy, wz + dz * (ww / 2 + 0.03));
    P.box(0.04, 0.04, ww, home.trim, X0 + 0.03, wy, wz);
    P.box(0.16, 0.04, ww + 0.2, home.trim, X0 + 0.08, wy - wh / 2 - 0.06, wz);
  } else {
    // the garage: the roller door (east wall, shut), its slats, the guide rails and the drum box
    const rz0 = -3.4, rz1 = 0.6, rh = 2.45;
    P.box(0.03, rh, rz1 - rz0, "#8c9096", X1 - 0.02, rh / 2, (rz0 + rz1) / 2);
    for (let y = 0.15; y < rh; y += 0.15) P.box(0.04, 0.02, rz1 - rz0 - 0.02, "#6f7379", X1 - 0.03, y, (rz0 + rz1) / 2);
    for (const z of [rz0, rz1]) S.box(0.06, rh + 0.1, 0.08, steel, X1 - 0.04, (rh + 0.1) / 2, z);
    S.box(0.3, 0.32, rz1 - rz0 + 0.1, steel, X1 - 0.16, rh + 0.2, (rz0 + rz1) / 2);
  }
  // strip lights: rows over the floor, each with a soft glow below (a home: as many as its room is wide)
  const rows = home ? Math.max(1, Math.round(RW / 3.2)) : 3;
  const lx = (i: number) => (home ? X0 + (RW * (i + 0.5)) / rows : [-2.6, 0.3, 3.2][i]);
  const llen = home ? Math.max(1.2, RD - 1.6) : 5.6, lz = home ? CZ : -0.3;
  for (let i = 0; i < rows; i++) {
    const x = lx(i);
    L.box(0.12, 0.03, llen, "#f4f8ff", x, H - 0.02, lz);
    P.box(0.18, 0.04, llen + 0.1, "#2a2b30", x, H - 0.005, lz);
    const gq = new THREE.PlaneGeometry(home ? Math.min(2.6, RW / rows) : 2.6, llen + 0.6);
    gq.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    gq.applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0.006, lz));
    G.push(gq);
  }

  // ── the bench press (west of centre): a flat bench on its own uprights, the bar racked ──
  const B = GYM.bench;
  const padLen = B.foot - B.head;
  // (a home without the bench: its pieces are still made, the bar hidden; nothing solid)
  const BPm = has("bench") ? P : painter(THREE, env.mergeGeometries), BSm = has("bench") ? S : painter(THREE, env.mergeGeometries);
  BPm.box(0.32, 0.09, padLen, pad, B.x, B.top - 0.045, (B.head + B.foot) / 2);
  BPm.box(0.3, 0.02, padLen - 0.04, "#2a2b30", B.x, B.top - 0.1, (B.head + B.foot) / 2);
  BSm.box(0.08, 0.06, padLen - 0.1, steel, B.x, B.top - 0.14, (B.head + B.foot) / 2);
  for (const z of [B.head + 0.1, B.foot - 0.1]) {
    BSm.box(0.07, B.top - 0.17, 0.07, steel, B.x, (B.top - 0.17) / 2, z);
    BSm.box(0.5, 0.05, 0.08, steel, B.x, 0.025, z);
  }
  // the uprights (their hooks hold the bar over your shoulders); placed for the bar's line below
  const rackZ = B.head + 0.36, hookY = 1.07;
  for (const sx of [-1, 1]) {
    const ux = B.x + sx * 0.6;
    BSm.box(0.07, 1.25, 0.07, steel, ux, 0.625, rackZ);
    BSm.box(0.42, 0.05, 0.1, steel, ux, 0.025, rackZ);
    BSm.box(0.07, 0.07, 0.1, steel, ux - sx * 0.02, hookY - 0.04, rackZ + 0.05);
    BPm.box(0.04, 0.04, 0.04, plate, ux, 1.27, rackZ);
  }
  if (has("bench")) solids.push([B.x - 0.75, B.x + 0.75, B.head - 0.05, rackZ + 0.15], [B.x - 0.25, B.x + 0.25, B.head - 0.05, B.foot + 0.05]);
  // the barbell: its own mesh (it moves): the bar, collars, two plates each side in your colours
  const BP = painter(THREE, env.mergeGeometries);
  BP.cyl(0.015, 0.015, 2.0, chrome, 0, 0, 0, 0, 0, Math.PI / 2, 10);
  for (const sx of [-1, 1]) {
    BP.cyl(0.215, 0.215, 0.045, plate, sx * 0.72, 0, 0, 0, 0, Math.PI / 2, 22);
    BP.cyl(0.17, 0.17, 0.035, plate2, sx * 0.78, 0, 0, 0, 0, Math.PI / 2, 20);
    BP.cyl(0.05, 0.05, 0.02, "#1a1b1f", sx * 0.72, 0, 0, 0, 0, Math.PI / 2, 12);
    BP.cyl(0.032, 0.032, 0.05, chrome, sx * 0.83, 0, 0, 0, 0, Math.PI / 2, 10);
    BP.cyl(0.022, 0.022, 0.16, chrome, sx * 0.93, 0, 0, 0, 0, Math.PI / 2, 10);
  }
  const bar = mesh(BP.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.45, envMapIntensity: 1.1 }), { cast: true });
  bar.position.set(B.x, hookY + 0.02, rackZ);
  bar.visible = has("bench");
  if (!has("bench")) { BPm.merged()?.dispose(); BSm.merged()?.dispose(); }

  // ── the treadmills (east), facing the mirror; you fall off the back (south) ──
  const BL = GYM.belt;
  const beltT = tex(beltCanvas(), [1, 3]);
  const belts: GymProps["belts"] = [];
  const mills = !home ? GYM.treadmills : has("treadmill") ? GYM.treadmills.slice(0, 1) : [];
  for (const tm of mills) {
    const x = tm.x, z0 = BL.consoleZ, z1 = BL.back + 0.12, zc = (z0 + z1) / 2, len = z1 - z0;
    P.box(0.84, 0.16, len, "#2b2d32", x, 0.08, zc);
    for (const sx of [-1, 1]) P.box(0.12, 0.03, len - 0.2, "#3a3c42", x + sx * 0.36, 0.175, zc + 0.08);
    S.cyl(0.04, 0.04, 0.62, chrome, x, 0.13, z1 - 0.04, 0, 0, Math.PI / 2, 10);
    for (const sx of [-1, 1]) {
      P.box(0.06, 1.2, 0.07, "#3a3c42", x + sx * 0.38, 0.75, z0 + 0.08, -0.12);
      S.cyl(0.018, 0.018, 0.6, chrome, x + sx * 0.38, 1.05, z0 + 0.4, Math.PI / 2);
    }
    P.box(0.84, 0.32, 0.14, "#2b2d32", x, 1.38, z0 + 0.03, -0.45);
    L.box(0.42, 0.2, 0.012, "#3f9bff", x, 1.4, z0 + 0.105, -0.45);
    const bt = beltT.clone(); bt.needsUpdate = true;
    const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.9 });
    const belt = mesh(new THREE.PlaneGeometry(0.58, BL.back - BL.front + 0.25), bm);
    belt.rotation.x = -Math.PI / 2; belt.position.set(x, BL.top - 0.005, (BL.front + BL.back) / 2 - 0.05);
    belts.push({ id: tm.id, mat: bm, speed: 0 });
    solids.push([x - 0.46, x + 0.46, z0 - 0.1, z1 + 0.02]);
  }

  // ── the heavy bag (south-west), on a chain from a ceiling bracket, over mats ──
  const BG = GYM.bag;
  const MATS: [number, number, number, number, string, boolean][] = [[-3.05, 1.55, 2.4, 2.2, "#2b4f7a", has("bag")], [0.6, 1.5, 1.8, 0.9, "#2d6b6b", has("pushup") || has("plank")], [0.6, 2.5, 1.8, 0.9, "#2d6b6b", has("nordic") || has("mobility")]];
  for (const [x, z, w, d, c, on] of MATS) if (on) P.box(w, 0.025, d, c, x, 0.0125, z);
  // a home: rubber mats under the bench and the treadmill (its own floor round them)
  if (home && !garage) {
    if (has("bench")) P.box(1.7, 0.012, 2.1, "#25272c", B.x, 0.006, (B.head + B.foot) / 2 - 0.15);
    if (has("treadmill")) P.box(1.25, 0.012, 2.6, "#25272c", GYM.treadmills[0].x, 0.006, (BL.consoleZ + BL.back) / 2 + 0.1);
    if (has("squat")) P.box(1.9, 0.012, 1.8, "#25272c", 0.3, 0.006, -3.1);
  }
  // the bag hangs at the club's height (its game reads it); a taller home ceiling has a drop rod to it
  if (has("bag")) {
    S.box(0.5, 0.06, 0.12, steel, BG.x, GYM.H - 0.03, BG.z);
    if (H > GYM.H + 0.02) S.box(0.06, H - GYM.H, 0.06, steel, BG.x, (H + GYM.H) / 2, BG.z);
  }
  const pivot = new THREE.Group(); pivot.position.set(BG.x, GYM.H - 0.06, BG.z); scene.add(pivot);
  pivot.visible = has("bag");
  const BB = painter(THREE, env.mergeGeometries);
  const chainLen = GYM.H - 0.06 - BG.top - 0.12;
  BB.cyl(0.008, 0.008, chainLen, chrome, 0, -chainLen / 2, 0, 0, 0, 0, 6);
  for (const a of [0, 2.1, 4.2]) BB.cyl(0.005, 0.005, 0.2, chrome, Math.sin(a) * 0.08, -chainLen - 0.06, Math.cos(a) * 0.08, Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4, 5);
  const bagLen = BG.top - BG.bottom, bagMid = -(GYM.H - 0.06 - (BG.top + BG.bottom) / 2);
  BB.cyl(BG.r, BG.r, bagLen, "#7a1e22", 0, bagMid, 0, 0, 0, 0, 20);
  BB.cyl(BG.r * 0.9, BG.r, 0.05, "#5b1418", 0, bagMid + bagLen / 2 + 0.02, 0, 0, 0, 0, 20);
  BB.cyl(BG.r, BG.r * 0.9, 0.05, "#5b1418", 0, bagMid - bagLen / 2 - 0.02, 0, 0, 0, 0, 20);
  for (const y of [bagMid + bagLen * 0.3, bagMid - bagLen * 0.3]) BB.cyl(BG.r + 0.004, BG.r + 0.004, 0.05, "#1d1e22", 0, y, 0, 0, 0, 0, 20);
  const bagBody = new THREE.Mesh(BB.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 }));
  bagBody.castShadow = true; bagBody.receiveShadow = true; meshes++;
  pivot.add(bagBody);
  if (has("bag")) solids.push([BG.x - 0.32, BG.x + 0.32, BG.z - 0.32, BG.z + 0.32]);
  const swing = { ax: 0, az: 0, vx: 0, vz: 0 };

  // ── the power rack (north, the hero): steel frame, a bar loaded in your colours, a plate tree ──
  const rx = 0.3, rz = -D2 + 0.9, rw = 1.25, rd = 1.1, rh = 2.35;
  const RK = has("squat") ? S : painter(THREE, env.mergeGeometries), RP = has("squat") ? P : painter(THREE, env.mergeGeometries);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) RK.box(0.07, rh, 0.07, steel, rx + sx * rw / 2, rh / 2, rz + sz * rd / 2);
  for (const sz of [-1, 1]) RK.box(rw + 0.07, 0.07, 0.07, steel, rx, rh, rz + sz * rd / 2);
  for (const sx of [-1, 1]) RK.box(0.07, 0.07, rd + 0.07, steel, rx + sx * rw / 2, rh, rz);
  // the rack's bar is its own draw (phase 2: it goes onto your back for the squat), loaded in your colours
  const RB = painter(THREE, env.mergeGeometries);
  RB.cyl(GYM2.rack.r, GYM2.rack.r, 2.1, chrome, 0, 0, 0, 0, 0, Math.PI / 2, 10);
  for (const sx of [-1, 1]) {
    RB.cyl(0.225, 0.225, 0.05, plate, sx * 0.8, 0, 0, 0, 0, Math.PI / 2, 22);
    RB.cyl(0.2, 0.2, 0.04, plate2, sx * 0.86, 0, 0, 0, 0, Math.PI / 2, 20);
    RK.box(0.08, 0.06, 0.12, steel, rx + sx * rw / 2, 1.31, rz + rd / 2 - 0.02);
  }
  const rackBar = mesh(RB.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.45, envMapIntensity: 1.1 }), { cast: true });
  rackBar.position.set(GYM2.rack.x, GYM2.rack.y, GYM2.rack.z);
  rackBar.visible = has("squat");
  RP.box(rw - 0.1, 0.03, rd - 0.1, "#5a4630", rx, 0.015, rz);
  const ptx = rx + 1.15, ptz = -D2 + 0.45;
  RK.cyl(0.03, 0.03, 1.1, steel, ptx, 0.55, ptz, 0, 0, 0, 10);
  RK.box(0.5, 0.04, 0.5, steel, ptx, 0.02, ptz);
  for (const [y, rr, cc] of [[0.35, 0.225, plate], [0.41, 0.225, plate], [0.66, 0.16, plate2], [0.72, 0.16, plate2], [0.9, 0.12, "#1a1b1f"]] as [number, number, string][]) RP.cyl(rr, rr, 0.045, cc, ptx, y, ptz + 0.07, Math.PI / 2, 0, 0, 20);
  if (has("squat")) solids.push([rx - 0.75, rx + 0.75, rz - rd / 2 - 0.1, rz + rd / 2 + 0.15], [ptx - 0.3, ptx + 0.3, ptz - 0.3, ptz + 0.35]);
  else { RK.merged()?.dispose(); RP.merged()?.dispose(); }

  // ── phase 2's kit (gymPoses2.ts GYM2): a pull-up bar, a plyo box, an agility ladder, a landing pad, a mat for
  //    the Copenhagen, the Nordic ankle roller on the second mat ──
  const PU = GYM2.pull;
  if (has("pullup")) {
  for (const sx of [-1, 1]) {
    const px = PU.x + sx * (PU.half + 0.06);
    S.box(0.07, PU.y + 0.08, 0.07, steel, px, (PU.y + 0.08) / 2, PU.z);
    S.box(0.07, 0.05, 0.9, steel, px, 0.025, PU.z);
    S.box(0.05, 0.05, 0.6, steel, px, 0.42, PU.z, 0.7);
    P.box(0.05, 0.05, 0.05, plate, px, PU.y + 0.1, PU.z);
  }
  S.cyl(PU.r, PU.r, 2 * PU.half + 0.12, chrome, PU.x, PU.y, PU.z, 0, 0, Math.PI / 2, 12);
  for (const sx of [-1, 1]) solids.push([PU.x + sx * (PU.half + 0.06) - 0.1, PU.x + sx * (PU.half + 0.06) + 0.1, PU.z - 0.48, PU.z + 0.48]);
  }
  // the plyo box: its own draw, built from its base so it can grow taller (scale y) as the jumps go well
  const XB = GYM2.box;
  const BXP = painter(THREE, env.mergeGeometries);
  BXP.box(2 * XB.half, XB.h[0], 2 * XB.half, "#7a5a3a", 0, XB.h[0] / 2, 0);
  BXP.box(2 * XB.half + 0.004, 0.05, 2 * XB.half + 0.004, plate, 0, XB.h[0] - 0.08, 0);
  BXP.box(2 * XB.half - 0.04, 0.004, 2 * XB.half - 0.04, "#2a2b30", 0, XB.h[0] + 0.002, 0);
  const box = mesh(BXP.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { cast: true });
  box.position.set(XB.x, 0, XB.z);
  // the box is the box jumps' and the Copenhagen's (its top is the Copenhagen's bench)
  box.visible = has("boxjump") || has("copenhagen");
  if (box.visible) solids.push([XB.x - XB.half - 0.05, XB.x + XB.half + 0.05, XB.z - XB.half - 0.05, XB.z + XB.half + 0.05]);
  // the Copenhagen's mat, east of the box
  if (has("copenhagen")) P.box(1.0, 0.025, 0.6, "#2d6b6b", GYM2.copenMat.x, 0.0125, GYM2.copenMat.z);
  // the agility ladder: two yellow rails and the rungs, flat on the floor
  const LD = GYM2.ladder, lsq = (LD.x1 - LD.x0) / LD.squares;
  if (has("ladder")) {
    for (const sz of [-1, 1]) P.box(LD.x1 - LD.x0, 0.008, 0.03, "#e2b44a", (LD.x0 + LD.x1) / 2, 0.004, LD.z + sz * 0.22);
    for (let i = 0; i <= LD.squares; i++) P.box(0.03, 0.008, 0.44, "#e2b44a", LD.x0 + i * lsq, 0.005, LD.z);
  }
  // the landing pad: a round rubber mat with a ring painted on
  if (has("landing")) {
    P.cyl(GYM2.pad.r, GYM2.pad.r, 0.012, "#1d1e22", GYM2.pad.x, 0.006, GYM2.pad.z, 0, 0, 0, 24);
    P.ring(0.14, 0.008, plate, GYM2.pad.x, 0.013, GYM2.pad.z, Math.PI / 2, 0, 0);
  }
  // the Nordic ankle roller: two little posts at the second mat's west end and a padded roller (its own draw:
  // its height is set on your ankles when you kneel)
  const NR = GYM2.nordic;
  if (has("nordic")) for (const sz of [-1, 1]) S.box(0.05, 0.3, 0.05, steel, NR.rollerX, 0.15, GYM2.matB.z + sz * 0.33);
  const RL = painter(THREE, env.mergeGeometries);
  RL.cyl(0.045, 0.045, 0.62, pad, 0, 0, 0, Math.PI / 2, 0, 0, 14);
  RL.cyl(0.012, 0.012, 0.7, chrome, 0, 0, 0, Math.PI / 2, 0, 0, 8);
  const roller = mesh(RL.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { cast: true });
  roller.position.set(NR.rollerX, 0.2, GYM2.matB.z);
  roller.visible = has("nordic");

  // ── dumbbells (west wall), kettlebells, a medicine-ball crate, foam rollers ──
  const rackZ0Z1 = home ? home.plan.rack : ([-2.9, -0.6] as [number, number]);
  const dbx = X0 + 0.32, dbz0 = rackZ0Z1?.[0] ?? 0, dbz1 = rackZ0Z1?.[1] ?? 0;
  if (rackZ0Z1) {
  for (const y of [0.32, 0.66]) S.box(0.48, 0.04, dbz1 - dbz0, steel, dbx, y, (dbz0 + dbz1) / 2, 0, 0, y > 0.5 ? -0.25 : -0.12);
  for (const z of [dbz0 + 0.04, dbz1 - 0.04]) S.box(0.5, 0.74, 0.05, steel, dbx, 0.37, z);
  for (let i = 0; i < 6; i++) for (const [y, side] of [[0.34, -0.08], [0.69, 0.1]] as [number, number][]) {
    const z = dbz0 + 0.25 + i * ((dbz1 - dbz0 - 0.5) / 5);
    const r = 0.045 + i * 0.008;
    S.cyl(0.014, 0.014, 0.3, chrome, dbx + side, y + r, z, 0, 0, Math.PI / 2, 8);
    for (const e2 of [-0.13, 0.13]) P.cyl(r, r, 0.07, "#151619", dbx + side + e2, y + r, z, 0, 0, Math.PI / 2, 6);
  }
  solids.push([X0, dbx + 0.32, dbz0 - 0.05, dbz1 + 0.05]);
  } else {
    // the starter's corner: a pair of dumbbells on the floor by the mat
    for (const z of [1.25, 1.6]) {
      S.cyl(0.014, 0.014, 0.3, chrome, -0.75, 0.07, z, 0, 0, Math.PI / 2, 8);
      for (const e2 of [-0.13, 0.13]) P.cyl(0.07, 0.07, 0.07, "#151619", -0.75 + e2, 0.07, z, 0, 0, Math.PI / 2, 8);
    }
    solids.push([-0.95, -0.55, 1.1, 1.75]);
  }
  if (big) {
  for (let i = 0; i < 4; i++) {
    const kx = -W2 + 0.35, kz = -0.35 + i * 0.3, r = 0.095 + i * 0.012;
    P.ball(r, i % 2 ? "#151619" : plate, kx, r, kz, 10);
    S.ring(0.065, 0.014, steel, kx, r * 2 + 0.03, kz, 0, Math.PI / 2, 0);
  }
  solids.push([-W2, -W2 + 0.6, -0.55, 0.7]);
  // foam rollers and a med-ball by the mats
  for (let i = 0; i < 3; i++) P.cyl(0.075, 0.075, 0.45, ["#2d6b6b", "#e2b44a", "#1d1e22"][i], 1.75, 0.075, 1.15 + i * 0.2, 0, 0, Math.PI / 2, 10);
  P.ball(0.15, "#1d1e22", 1.8, 0.15, 2.0, 12);
  }

  // ── the water cooler (by the door): a blue bottle on a white stand, a stack of cups ──
  const CO = home ? { x: X1 - 0.55, z: Z1 - 0.55 } : GYM.cooler;
  if (big) {
  P.box(0.36, 0.95, 0.36, "#e8e8e6", CO.x, 0.475, CO.z);
  P.cyl(0.15, 0.15, 0.42, "#5aa6e6", CO.x, 1.17, CO.z, 0, 0, 0, 16);
  P.cyl(0.06, 0.1, 0.08, "#5aa6e6", CO.x, 0.97, CO.z, 0, 0, 0, 12);
  P.box(0.1, 0.05, 0.05, "#2b6cb0", CO.x - 0.19, 0.78, CO.z - 0.06);
  P.box(0.1, 0.05, 0.05, "#c53030", CO.x - 0.19, 0.78, CO.z + 0.06);
  P.cyl(0.035, 0.03, 0.24, "#f6f6f4", CO.x, 0.35, CO.z - 0.28, 0, 0, 0, 10);
  L.box(0.02, 0.18, 0.18, "#bfe3ff", CO.x - 0.185, 0.62, CO.z);
  solids.push([CO.x - 0.3, X1, CO.z - 0.4, Z1]);
  // a bench by the door to sit on (set dressing)
  const bnx = doorX + 2.6;
  P.box(1.2, 0.06, 0.36, "#8a6a48", bnx, 0.44, Z1 - 0.25);
  for (const sx of [-0.5, 0.5]) S.box(0.05, 0.42, 0.3, steel, bnx + sx, 0.21, Z1 - 0.25);
  solids.push([bnx - 0.65, bnx + 0.65, Z1 - 0.45, Z1]);
  }
  // speakers in the corners, a wall clock (a home: on the east wall; the window is on the west)
  if (home?.plan.kind !== "corner") for (const [x, z, ry] of [[X0 + 0.2, Z0 + 0.2, Math.PI / 4], [X1 - 0.2, Z0 + 0.2, -Math.PI / 4]] as [number, number, number][]) P.box(0.26, 0.4, 0.22, "#18191c", x, H - 0.45, z, 0, ry);
  {
    const cx = home ? X1 - 0.03 : -W2 + 0.03, sgn = home ? -1 : 1, cz = home ? CZ + 0.4 : 2.0;
    P.cyl(0.2, 0.2, 0.04, "#f2f2ef", cx, 2.0, cz, 0, 0, Math.PI / 2, 20);
    P.cyl(0.21, 0.21, 0.03, "#1d1e22", cx - sgn * 0.01, 2.0, cz, 0, 0, Math.PI / 2, 20);
    P.box(0.01, 0.12, 0.012, "#1d1e22", cx + sgn * 0.03, 2.04, cz);
    P.box(0.01, 0.012, 0.15, "#1d1e22", cx + sgn * 0.03, 2.0, cz + 0.06);
  }
  // the estate's sauna: a cedar door in the east wall with a little window and its sign (coming soon)
  const SAUNA = { x: X1, z: 1.6 };
  if (home?.plan.sauna) {
    P.box(0.06, 2.1, 0.9, "#a8723f", SAUNA.x - 0.03, 1.05, SAUNA.z);
    for (let i = -3; i <= 3; i++) P.box(0.065, 2.06, 0.012, "#8e5d31", SAUNA.x - 0.035, 1.05, SAUNA.z + i * 0.12);
    P.box(0.07, 0.36, 0.26, "#3b2a1c", SAUNA.x - 0.04, 1.55, SAUNA.z);
    L.box(0.02, 0.3, 0.2, "#f3b56a", SAUNA.x - 0.075, 1.55, SAUNA.z);
    S.box(0.05, 0.03, 0.18, chrome, SAUNA.x - 0.09, 1.0, SAUNA.z - 0.3);
    for (const dz of [-1, 1]) P.box(0.08, 2.2, 0.08, home.trim, SAUNA.x - 0.04, 1.1, SAUNA.z + dz * 0.49);
    P.box(0.08, 0.08, 1.06, home.trim, SAUNA.x - 0.04, 2.2, SAUNA.z);
    const ss = mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: tex(signCanvas("SAUNA")), toneMapped: false, transparent: true }), { receive: false });
    ss.rotation.y = -Math.PI / 2; ss.position.set(SAUNA.x - 0.02, 2.42, SAUNA.z);
  }

  // ── plants (real leaves, home3d/plants.ts), all three in one draw ──
  const plantParts: any[] = [];
  const PLANTS: [number, number, any, number][] = home ? [[X1 - 0.4, Z0 + 0.45, "monstera", Math.min(1.3, H - 1.0)], [X0 + 0.45, Z1 - 0.45, "fiddle", Math.min(1.6, H - 0.8)]]
    : [[W2 - 0.4, -D2 + 0.45, "monstera", 1.3], [-W2 + 0.45, D2 - 0.45, "fiddle", 1.6], [1.45, D2 - 0.35, "snake", 0.9]];
  for (const [x, z, kind, h] of PLANTS) {
    const pm = plantMesh(THREE, kind, Math.abs(x * 31 + z * 17), { h, pot: "#2b2c30" });
    pm.updateMatrix();
    const g = pm.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().makeTranslation(x, 0, z));
    plantParts.push(g);
    pm.geometry.dispose(); (pm.material as any)?.dispose?.();
    solids.push([x - 0.3, x + 0.3, z - 0.3, z + 0.3]);
  }
  mesh(env.mergeGeometries(plantParts), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.72, envMapIntensity: 0.6 }), { cast: true });
  for (const g of plantParts) g.dispose();

  // ── join the painters ──
  mesh(P.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), { cast: true });
  mesh(S.merged(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.3 }), { cast: true });
  mesh(L.merged(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), { receive: false });
  const glows = mesh(env.mergeGeometries(G), new THREE.MeshBasicMaterial({ map: tex(glowCanvas()), color: new THREE.Color("#dfe9ff").multiplyScalar(0.14), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), { receive: false });
  glows.renderOrder = 2;
  for (const g of G) g.dispose();

  // ── the things you can use ──
  const objects: SmartObject[] = [];
  const gameObj = (o: Parameters<typeof standObject>[0], game: GymGameKind) => { const so = standObject(o); so.game = game; objects.push(so); return so; };
  if (has("bench")) gameObj({ id: "bench", kind: "gym", label: "Bench press", front: [B.x + 0.62, B.foot + 0.15], face: [B.x, B.foot - 0.2], verb: "Start a set", lines: [HOW_TO.bench, "Builds Strength."], pickR: 0.8, pickH: 1.3 }, "bench");
  for (const tm of mills) {
    gameObj({ id: tm.id, kind: "gym", label: "Treadmill", front: [tm.x, BL.back + TREAD_STAND], face: [tm.x, BL.front], verb: "Start running", lines: [HOW_TO.treadmill, "Builds Cardio."], pickR: 0.55, pickH: 1.6 }, "treadmill");
  }
  // the team-mate's run (the world kit's routine): stood on the far belt's back half, 0.2 m up, jogging. Not tappable
  // (its pick is empty): you tap the treadmill itself, which says it is taken while he is on it.
  const run = standObject({ id: "treadmill2-belt", kind: "gym", label: "Treadmill", front: [GYM.treadmills[1].x, BL.back - 0.3], face: [GYM.treadmills[1].x, BL.front - 2], verb: "Run", loop: [{ clip: "jog", secs: 6 }], stay: [60, 90], who: "people", pickR: 0, pickH: 0 });
  run.slots[0].lift = BL.top;
  run.pick = { at: [99, 99], r: 0, h: 0 };
  if (!home) objects.push(run);
  if (has("bag")) gameObj({ id: "bag", kind: "gym", label: "Heavy bag", front: [BG.x + 0.66, BG.z], face: [BG.x, BG.z], verb: "Hit the bag", lines: [HOW_TO.bag, "Builds Focus."], pickR: 0.45, pickH: 2.0 }, "bag");
  // phase 2: the ten new exercises, each its own smart object (you walk to its spot; the fade; the game)
  const PICK: Record<Gym2Kind, [number, number, number, number]> = {
    pullup: [GYM2.pull.x, GYM2.pull.z, 0.6, 2.4], squat: [GYM2.rack.x, GYM2.rack.z - 0.4, 0.7, 2.2], pushup: [GYM2.matA.x - 0.35, GYM2.matA.z, 0.5, 0.5], plank: [GYM2.matA.x + 0.45, GYM2.matA.z, 0.45, 0.5],
    nordic: [GYM2.matB.x - 0.35, GYM2.matB.z, 0.5, 0.5], mobility: [GYM2.matB.x + 0.45, GYM2.matB.z, 0.45, 0.5], boxjump: [GYM2.box.x, GYM2.box.z, 0.35, 0.7], copenhagen: [GYM2.copenMat.x, GYM2.copenMat.z, 0.45, 0.4],
    ladder: [(GYM2.ladder.x0 + GYM2.ladder.x1) / 2, GYM2.ladder.z, 0.7, 0.3], landing: [GYM2.pad.x, GYM2.pad.z, 0.4, 0.3],
  };
  for (const k of GYM2_KINDS) {
    if (!has(k)) continue;
    const sp = spot2(k), pk = PICK[k];
    gameObj({ id: k, kind: "gym", label: GAME_NAMES[k], front: [sp.x, sp.z], face: [pk[0], pk[1]], verb: "Start", lines: [HOW_TO[k], `Builds ${STAT_NAMES[STAT_OF[k]]}.`], pickR: pk[2], pickH: pk[3] }, k);
  }
  if (big) objects.push(standObject({
    id: "cooler", kind: "fridge", label: "Water cooler", front: [CO.x - 0.62, CO.z], face: [CO.x, CO.z], verb: "Protein shake",
    lines: ["A shake after training: this week's gym points ×1.2."], enter: { clip: "pickup", speed: 1.6 }, loop: [{ clip: "idle", secs: 1.2 }],
    effect: { text: "Protein in. This week's gym points ×1.2." }, stay: [1.2, 1.2], pickR: 0.45, pickH: 1.5,
  }));
  if (home?.plan.sauna) objects.push(standObject({
    id: "sauna", kind: "spot", label: "Sauna", front: [SAUNA.x - 0.75, SAUNA.z], face: [SAUNA.x, SAUNA.z], verb: "Look in", lines: ["Cedar benches and hot stones."], pickR: 0.5, pickH: 2.1,
  }));
  if (!home) objects.push(standObject({
    id: "mat", kind: "gym", label: "Stretching mat", front: [-2.35, 2.35], face: [-2.35, -D2], verb: "Stretch", lines: ["Loosen up between sets."],
    loop: [{ clip: "stretch", or: ["idle"], secs: 6 }], effect: { mood: 1, text: "Loose." }, stay: [6, 6], pickR: 0.6, pickH: 0.6,
  }));

  const tick = (dt: number) => {
    for (const b of belts) if (b.speed > 0.01) { b.mat.map.offset.y += (b.speed * dt) / ((BL.back - BL.front + 0.25) / 3); }
    // the bag: a damped pendulum (two ways), from its chain
    const k = 9.81 / (GYM.H - BG.bottom - 0.3);
    swing.vx += (-k * swing.ax - 2.6 * swing.vx) * dt; swing.vz += (-k * swing.az - 2.6 * swing.vz) * dt;
    swing.ax += swing.vx * dt; swing.az += swing.vz * dt;
    // a heavy bag only rocks: at most 0.12 rad, and never more than 0.04 back towards where you stand (east):
    // it must never swing into you (RUL-3D-005)
    const a = Math.hypot(swing.ax, swing.az);
    if (a > 0.12) { swing.ax *= 0.12 / a; swing.az *= 0.12 / a; swing.vx *= 0.3; swing.vz *= 0.3; }
    if (swing.ax > 0.04) { swing.ax = 0.04; if (swing.vx > 0) swing.vx *= -0.3; }
    pivot.rotation.set(-swing.az, 0, swing.ax); // the bag's foot moves by (ax, az) × its length
  };
  const hit = (dx: number, dz: number, f: number) => { swing.vx += dx * f; swing.vz += dz * f; };

  return {
    objects, solids,
    bounds: [X0, X1, Z0, Z1],
    you: home ? homeGymStart(home.plan.tier) : { x: -0.2, z: D2 - 0.55, yaw: Math.PI },
    ceil: H - 0.15,
    camBox: [X0 + 0.2, X1 - 0.2, Z0 + 0.2, Z1 - 0.15],
    sun,
    mirror,
    props: { bar, barRack: { y: hookY + 0.02, z: rackZ }, belts, bag: { pivot, body: bagBody, swing, hit }, rackBar, box, roller, tick },
    still: { meshes },
  };
}

// ─────────────────────────────── the session ───────────────────────────────

/** What the game's screen shows this frame (components/star/GymHud.tsx draws it, no React state per frame). */
export interface GymHudFrame {
  kind: GymGameKind | null;
  title: string;
  how: string;
  /** "count" (get ready), "play", "end" (the last moment before the fade). */
  phase: "count" | "play" | "end" | "none";
  count: number;
  /** 0..1 black over the picture (the fade in and out). */
  fade: number;
  game: GameState | null;
  /** Seconds left in the game (or its cap). */
  left: number;
  hold: boolean;
}

export interface GymSessionOpts {
  /** The game's level (Strength / Cardio / Focus level, 1-4). */
  levelOf: (k: GymGameKind) => number;
  /** A finished game (or one stopped early: `quit`). */
  onResult: (r: GameResult, quit: boolean) => void;
  /** A clip's ground speed (m/s) on this body (jog, run, sprint), for the belt's speed. */
  clipSpeed: (name: string) => number;
  seed?: number;
}

type Phase = "none" | "in" | "count" | "play" | "end" | "out";

const FADE = 0.35;
/** "Get ready", then "Go!" (s). */
const COUNT = 1.1;

export class GymSession {
  phase: Phase = "none";
  kind: GymGameKind | null = null;
  game: GameState | null = null;
  hold = false;
  /** A film's thumb: the bot plays at this skill (null = your thumb). */
  bot: number | null = null;
  private t = 0;
  private obj: SmartObject | null = null;
  private pose: PoseBlend;
  private v: Record<string, any>;
  private lie = { y: 0, z: 0, chestTop: 0, barChest: 0, barTop: 0, barZ: 0, hipZ: 0, reach: 0.55 };
  private clip = "";
  private gloves: any[] = [];
  private gloveG: any = null;
  private gloveM: any = null;
  private lastHits = 0;
  private fall = { z: 0, y: 0, started: false };
  private quitting = false;
  /** The treadmill: no fade in, he steps up onto the belt from where he walked to (from, to, how long). */
  private stepOn: { x: number; z: number; tz: number; secs: number } | null = null;
  private result: GameResult | null = null;
  /** Deepest skin point inside the bench pad this set (cm), for the no-body-in-the-machine check. */
  benchPierceCm = 0;
  /** The worst gap between his grip (inside his curled fingers) and the bar this set (cm): his hands hold the bar
   *  at every point of the rep (Harry, 27 Nov 2026: "hands actually attach to the bars, we're not phasing through"). */
  gripGapCm = 0;
  /** The deepest any skin went into the bar (cm, past its surface) this set. */
  barPierceCm = 0;
  /** The deepest any skin went into the treadmill's rails, uprights or console this run (cm). */
  railPierceCm = 0;
  private checkN = 0;
  /** Phase 2's ten exercises: their poses and their contact numbers (./gymPoses2.ts). */
  ex2: Exercise2;

  constructor(private T: any, private room: GymRoomOut, private you: Npc, private o: GymSessionOpts) {
    this.pose = new PoseBlend(T);
    this.ex2 = new Exercise2(T, you, room);
    this.v = { a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), p: new T.Vector3(), up: new T.Vector3(0, 1, 0), x: new T.Vector3(1, 0, 0) };
  }

  get active() { return this.phase !== "none"; }
  /** Your thumb can play (the game is on). */
  get playing() { return this.phase === "play"; }

  /** Start on a machine (you are stood at its spot). */
  begin(obj: SmartObject) {
    if (this.active || !obj.game) return false;
    this.obj = obj; this.kind = obj.game as GymGameKind;
    this.phase = "in"; this.t = 0; this.quitting = false; this.result = null; this.benchPierceCm = 0; this.gripGapCm = 0; this.barPierceCm = 0; this.railPierceCm = 0;
    this.game = startGame(this.kind, this.o.levelOf(this.kind), (this.o.seed ?? 1) + Math.floor(Math.random() * 1000) * (this.bot === null ? 1 : 0));
    this.stepOn = null;
    if (this.game.kind === "treadmill") {
      // he walks up the back of the belt to his running spot (a walk's pace), no black screen
      const tz = this.beltZ(this.game.pos);
      const x = GYM.treadmills.find((t) => t.id === obj.id)?.x ?? this.you.x;
      this.stepOn = { x: this.you.x, z: this.you.z, tz, secs: Math.max(0.6, Math.hypot(this.you.x - x, this.you.z - tz) / 1.05) };
      this.you.act({ clip: "walk", or: ["jog"] }, 1e9);
    }
    return true;
  }
  /** Stop the game now (the ✕): it counts what was done. */
  quit() {
    if (this.phase === "play" || this.phase === "count") { this.quitting = true; this.phase = "end"; this.t = 0; }
  }

  /** One frame, BEFORE your body's clip is posed: the game, the fades, the props. */
  step(dt: number) {
    this.pose.restore();
    this.ex2.restore();
    const P = this.room.props;
    if (this.phase !== "none") this.t += dt;
    if (this.phase === "in" && this.stepOn) this.walkOn();
    if (this.phase === "in" && this.t >= (this.stepOn ? this.stepOn.secs : FADE)) { this.setUp(); this.phase = "count"; this.t = 0; }
    else if (this.phase === "count" && this.t >= COUNT) { this.phase = "play"; this.t = 0; }
    else if (this.phase === "play" && this.game) {
      const hold = this.bot !== null ? botHold(this.game, this.bot) : this.hold;
      this.game = stepGame(this.game, dt, hold);
      if (this.game.done) { this.phase = "end"; this.t = 0; }
    } else if (this.phase === "end" && this.t >= (this.quitting ? 0.3 : 1.1)) { this.phase = "out"; this.t = 0; }
    else if (this.phase === "out" && this.t >= FADE) { this.tearDown(); this.phase = "none"; this.t = 0; if (this.game) { this.result = resultOf(this.game); this.o.onResult(this.result, this.quitting); } }
    // the belt under you
    const mine = P.belts.find((b) => b.id === this.obj?.id);
    if (mine && this.kind === "treadmill" && this.game?.kind === "treadmill" && (this.phase === "count" || this.phase === "play" || this.phase === "end")) {
      const g = this.game;
      mine.speed = this.phase === "count" ? (this.t / COUNT) * (TREADMILL.kmh[0] / 3.6) : g.done && !g.fell ? Math.max(0, mine.speed - dt * 2) : g.kmh / 3.6;
    } else if (mine && this.phase !== "none") mine.speed = Math.max(0, mine.speed - dt * 3);
    // the bar: on the hooks, or in your hands
    if (this.kind === "bench" && this.game?.kind === "bench" && (this.phase === "count" || this.phase === "play" || this.phase === "end")) {
      const L = this.lie, g = this.game;
      const unrack = this.phase === "count" ? ease(this.t / 0.8) : 1;
      const bounce = g.flash.what === "bounce" ? 0.035 * Math.exp(-g.flash.age * 10) * Math.abs(Math.sin(g.flash.age * 30)) : 0;
      const y = L.barChest + (L.barTop - L.barChest) * g.bar + bounce;
      P.bar.position.set(GYM.bench.x, P.barRack.y + (y - P.barRack.y) * unrack, P.barRack.z + (L.barZ - P.barRack.z) * unrack);
    } else if (this.phase === "out" || this.phase === "none") P.bar.position.set(GYM.bench.x, P.barRack.y, P.barRack.z);
    // phase 2's props (the squat bar on your back, the box's height)
    if (this.game && isGym2(this.game)) this.ex2.props(this.game, this.phase === "count" || this.phase === "play" || this.phase === "end");
    else if (P.rackBar && this.phase === "none") P.rackBar.position.set(GYM2.rack.x, GYM2.rack.y, GYM2.rack.z);
    P.tick(dt);
  }

  /** One frame, AFTER your body's clip is posed: lie, run, fall, punch. */
  afterPose(dt: number) {
    const g = this.game;
    if (!g || !(this.phase === "count" || this.phase === "play" || this.phase === "end")) return;
    if (g.kind === "bench") this.poseBench();
    else if (g.kind === "treadmill") this.poseTreadmill(dt);
    else if (g.kind === "bag") this.poseBag();
    else this.ex2.apply(g, this.phase as "count" | "play" | "end", this.t, dt);
  }

  /** The camera glides into the game's shot (he walked on: no black screen to hide a cut). */
  get easeIn() { return !!this.stepOn; }

  /** The treadmill's walk on: up the back of the belt (a step up of the belt's height over its last 25 cm) to his spot. */
  private walkOn() {
    const so = this.stepOn!, you = this.you, BL = GYM.belt;
    const x = GYM.treadmills.find((t) => t.id === this.obj?.id)?.x ?? so.x;
    const k = Math.min(1, this.t / so.secs);
    you.x = so.x + (x - so.x) * k;
    you.z = so.z + (so.tz - so.z) * k;
    const dy = Math.PI - you.yaw;
    you.yaw += Math.atan2(Math.sin(dy), Math.cos(dy)) * Math.min(1, k * 4);
    // the deck's end is at BL.back + 0.12: up onto it from 25 cm before (his front foot lifts first)
    const up = Math.max(0, Math.min(1, (BL.back + 0.12 + 0.25 - you.z) / 0.3));
    you.y = BL.top * ease(up);
  }

  /** The camera's shot for this game (eye, look-at), or null: the follow camera. */
  shot(): { cam: [number, number, number]; look: [number, number, number] } | null {
    if (!(this.phase === "count" || this.phase === "play" || this.phase === "end" || (this.phase === "out" && this.t < FADE * 0.5))) return null;
    const B = GYM.bench;
    if (this.kind && (GYM2_KINDS as string[]).includes(this.kind)) return this.ex2.shot(this.kind as Gym2Kind, this.game && isGym2(this.game) ? this.game : null);
    if (this.kind === "bench") return { cam: [B.x + 1.25, 2.3, B.foot + 1.55], look: [B.x - 0.05, 0.74, this.lie.hipZ - 0.42] };
    if (this.kind === "treadmill") {
      const x = GYM.treadmills.find((t) => t.id === this.obj?.id)?.x ?? 2.55;
      // off the back: the camera backs off and looks down at where he lands
      if (this.game?.kind === "treadmill" && this.game.fell) return { cam: [x - 2.3, 2.15, 2.5], look: [x + 0.05, 0.45, -0.25] };
      return { cam: [x - 2.1, 1.7, 1.75], look: [x + 0.1, 0.8, -0.85] };
    }
    const BG = GYM.bag;
    return { cam: [BG.x + 2.35, 1.8, BG.z + 1.55], look: [BG.x + 0.3, 1.0, BG.z - 0.1] };
  }

  /** The screen's frame. */
  hud(): GymHudFrame {
    const k = this.kind;
    const walked = this.kind === "treadmill" && this.stepOn;
    let fade = this.phase === "in" ? (walked ? 0 : Math.min(1, this.t / FADE)) : this.phase === "out" ? Math.min(1, this.t / FADE) : this.phase === "count" ? (walked ? 0 : Math.max(0, 1 - this.t / FADE)) : 0;
    const g = this.game;
    // the Copenhagen's change of side happens behind a short black
    if (g?.kind === "copenhagen" && g.swapping > 0) fade = Math.max(fade, Math.sin(Math.min(1, 1 - g.swapping / COPEN.swap) * Math.PI));
    const dur = g ? MAX_SECS[g.kind] : 25;
    return {
      kind: this.active ? k : null, title: k ? GAME_NAMES[k] : "", how: k ? HOW_TO[k] : "",
      phase: this.phase === "count" ? "count" : this.phase === "play" ? "play" : this.phase === "end" ? "end" : "none",
      count: this.phase === "count" ? Math.max(0, COUNT - this.t) : 0,
      fade, game: g, left: g ? Math.max(0, dur - g.t) : 0,
      hold: g && (g.done || (g.kind === "treadmill" && g.fell)) ? false : this.bot !== null && g ? botHold(g, this.bot) : this.hold,
    };
  }

  // ── setting up and putting back ──
  private setUp() {
    const you = this.you, T = this.T;
    you.act({ clip: this.kind === "treadmill" ? "jog" : "idle" }, 1e9);
    this.clip = "";
    if (this.kind === "bench") {
      const B = GYM.bench;
      // measure his lying fit: stood straight, his body's back and chest depth, his hips' and shoulders' height
      you.place(B.x, 0, 0);
      you.update(0, { grid: null as any, book: null as any, bodies: () => [] } as any, true);
      you.root.updateMatrixWorld(true);
      const body: any = you.person.body;
      const loc = new T.Vector3();
      const hip = you.person.bones.Hips.getWorldPosition(new T.Vector3());
      const sh = you.person.bones.LeftArm.getWorldPosition(new T.Vector3());
      let back = 0, chest = 0;
      body.skeleton?.update?.();
      for (let i = 0; i < body.geometry.attributes.position.count; i += 3) {
        body.getVertexPosition(i, loc); loc.applyMatrix4(body.matrixWorld);
        if (loc.y < hip.y || loc.y > sh.y || Math.abs(loc.x - B.x) > 0.16) continue;
        back = Math.min(back, loc.z - you.z); chest = Math.max(chest, loc.z - you.z);
      }
      const hy = hip.y, sy = sh.y;
      // lying on his back (head to the north): the root's up is -z, his front is +y
      const hipZ = B.foot - 0.05;
      this.lie.y = B.top - back + 0.008;
      this.lie.z = hipZ + hy;
      this.lie.hipZ = hipZ;
      const shoulderZ = this.lie.z - sy;
      this.lie.chestTop = this.lie.y + chest;
      this.lie.barZ = shoulderZ + 0.24;
      this.lie.barChest = this.lie.chestTop + 0.055;
      // the top: his arms nearly straight from the shoulder to the grip (hands 0.4 out)
      const arm = you.person.bones.LeftArm, fore = you.person.bones.LeftForeArm, hand = you.person.bones.LeftHand;
      const a = arm.getWorldPosition(new T.Vector3()), b = fore.getWorldPosition(new T.Vector3()), c = hand.getWorldPosition(new T.Vector3());
      const reach = (a.distanceTo(b) + b.distanceTo(c)) * 0.96;
      this.lie.reach = reach;
      const dx = 0.4 - 0.17;
      this.lie.barTop = Math.max(this.lie.barChest + 0.25, this.lie.y + 0.02 + Math.sqrt(Math.max(0, reach * reach - dx * dx)) + 0.04);
      you.person.root.rotation.order = "YXZ";
      you.place(B.x, this.lie.z, 0);
      you.y = this.lie.y;
    } else if (this.kind === "treadmill") {
      const x = GYM.treadmills.find((t) => t.id === this.obj?.id)?.x ?? 2.55;
      const g = this.game as Extract<GameState, { kind: "treadmill" }>;
      you.place(x, this.beltZ(g.pos), Math.PI);
      you.y = GYM.belt.top;
      this.fall = { z: 0, y: 0, started: false };
    } else if (this.kind === "bag") {
      const BG = GYM.bag;
      you.place(BG.x + 0.62, BG.z, -Math.PI / 2);
      this.lastHits = 0;
      this.addGloves();
    } else {
      this.ex2.setUp(this.kind as Gym2Kind);
      const sp = spot2(this.kind as Gym2Kind);
      you.place(sp.x, sp.z, sp.yaw);
    }
  }
  private tearDown() {
    const you = this.you, o = this.obj;
    you.person.root.rotation.order = "XYZ";
    you.person.root.rotation.x = 0;
    you.person.root.rotation.z = 0;
    relaxHands(this.T, you.person);
    if (this.ex2.kind) this.ex2.tearDown();
    this.removeGloves();
    for (const b of this.room.props.belts) if (b.id === o?.id) b.speed = 0;
    you.act({ clip: "idle" }, 0.01);
    if (o) { const s = o.slots[0]; const at: XZ = o.game === "treadmill" ? [s.stand[0], GYM.belt.back + TREAD_STAND] : s.stand; you.place(at[0], at[1], o.game === "treadmill" ? Math.PI : s.facing); }
    you.y = 0;
    this.obj = null;
  }
  private beltZ(pos: number) { const BL = GYM.belt; return BL.front + (BL.back - BL.front) * Math.max(0, Math.min(1, pos)); }

  // ── the bench: lying, legs down to the floor, hands on the bar ──
  private poseBench() {
    const you = this.you, b = you.person.bones, T = this.T, B = GYM.bench, P = this.room.props;
    you.person.root.rotation.order = "YXZ";
    you.person.root.rotation.x = -Math.PI / 2;
    you.person.root.updateMatrixWorld(true);
    const t = this.v.a, pole = this.v.b;
    for (const sx of [-1, 1] as const) {
      const side = sx < 0 ? "Left" : "Right";
      // which way is his left in the world? his body's x (the root's), mirrored as it lies
      const wx = this.sideX(sx);
      // legs: feet flat on the floor beside the bench, knees up
      t.set(B.x + wx * 0.34, 0.1, this.lie.hipZ + 0.5);
      pole.set(B.x + wx * 0.42, 1.4, this.lie.hipZ + 0.55);
      this.pose.reach(b[`${side}UpLeg`], b[`${side}Leg`], b[`${side}Foot`], t, pole, 1);
      // arms: the wrists just under the bar, 0.4 m out; elbows out and down; then the hand closed round the bar
      t.set(P.bar.position.x + wx * 0.4, P.bar.position.y - 0.045, P.bar.position.z + 0.01);
      pole.set(B.x + wx * 0.95, P.bar.position.y - 0.6, P.bar.position.z + 0.35);
      this.pose.reach(b[`${side}Arm`], b[`${side}ForeArm`], b[`${side}Hand`], t, pole, 1);
      this.gripBar(side, wx, pole);
    }
    // the fit: in the first moments he settles onto the pad (lifted by however far his back or seat went into it)
    if (this.phase === "count" && this.t < 0.6 && this.checkN++ % 3 === 0) {
      // his back (hips to shoulders, not his arms) rests on the pad: its lowest skin point exactly on top
      const sh = b.LeftArm.getWorldPosition(this.v.c);
      const f = torsoFit(T, you, B.x, sh.z, this.lie.hipZ - 0.02, this.lie.barZ);
      if (f) {
        const up = B.top + 0.004 - f.minY;
        this.lie.y += up; you.y = this.lie.y; you.person.root.position.y = you.y;
        // the bar comes down to touch his chest, and goes up to his arms' length (hands 0.4 m out)
        this.lie.chestTop = f.chestY + up;
        this.lie.barChest = this.lie.chestTop + 0.03;
        const dx = 0.4 - Math.abs(sh.x - B.x);
        this.lie.barTop = Math.max(this.lie.barChest + 0.25, sh.y + up + Math.sqrt(Math.max(0, this.lie.reach * this.lie.reach - dx * dx)) + 0.045);
      }
    }
    you.y = this.lie.y;
    // the check: no skin inside the pad (below its top, inside its width and length; the back resting on it is allowed 1 cm)
    // (every 12th frame: it reads every skin point, about 5 ms on a slowed phone)
    if (this.phase === "play" && this.checkN++ % 12 === 0) {
      this.benchPierceCm = Math.max(this.benchPierceCm, padPierce(T, you, B));
      this.barPierceCm = Math.max(this.barPierceCm, barPierce(T, you, P.bar.position));
    }
  }

  /**
   * His hand on the bar: the hand turned so the fingers point up past the bar with the thumbs inwards and the
   * palm to his feet, the fingers curled round it, and the arm moved (twice) until the middle of that curl sits
   * on the bar's line: the bar is in his hand at every point of the rep, never beside it or through it.
   */
  private gripBar(side: "Left" | "Right", wx: number, pole: any) {
    const p = this.you.person, b = p.bones, T = this.T, P = this.room.props;
    const s = side === "Left" ? "L" : "R";
    const rig = p.fingers?.[s];
    const hand = b[`${side}Hand`];
    if (!rig || !hand) return;
    poseFingers(T, p, s, GRIP);
    const bar = this.v.p.set(P.bar.position.x + wx * 0.4, P.bar.position.y, P.bar.position.z);
    // the wrist's aim, moved by what is left over each time (so a reach that stops short is made up next time)
    const aim = hand.getWorldPosition(new T.Vector3());
    for (let k = 0; k < 8; k++) {
      this.aimHand(hand, rig, wx);
      const g = this.gripPoint(s);
      if (!g) return;
      const dy = bar.y - g.y, dz = bar.z - g.z;
      if (k === 7 || Math.hypot(dy, dz) < 0.002) { if (this.phase === "play") this.gripGapCm = Math.max(this.gripGapCm, +(Math.hypot(dy, dz) * 100).toFixed(1)); return; }
      aim.y += dy; aim.z += dz;
      this.pose.reach(b[`${side}Arm`], b[`${side}ForeArm`], hand, aim, pole, 1);
    }
  }
  /** Fingers straight up (the hand to the middle knuckle), the index knuckle towards the middle of the bar. */
  private aimHand(hand: any, rig: any, wx: number) {
    const T = this.T, H = new T.Vector3(), M = new T.Vector3(), I = new T.Vector3(), L = new T.Vector3(), q = new T.Quaternion();
    hand.getWorldPosition(H); rig.middle.bones[0].getWorldPosition(M);
    q.setFromUnitVectors(M.sub(H).normalize(), this.v.up);
    this.pose.rotWorld(hand, q);
    rig.index.bones[0].getWorldPosition(I); rig.little.bones[0].getWorldPosition(L);
    const ax = I.x - L.x, az = I.z - L.z;
    const want = Math.atan2(0, -wx), now = Math.atan2(az, ax);
    this.pose.turn(hand, this.v.up, -(want - now));
  }
  /** The middle of his closed hand: 3 cm out from the middle knuckle on the palm's side (inside the curl). */
  private gripPoint(s: "L" | "R") {
    const rig = this.you.person.fingers?.[s];
    const tip = fingerTip(this.T, this.you.person, s, "middle");
    if (!rig || !tip) return null;
    const m = rig.middle.bones[0].getWorldPosition(new this.T.Vector3());
    // the palm's side: the way the curled fingers go (flat on the floor, the hand points up)
    const pw = new this.T.Vector3(tip.x - m.x, 0, tip.z - m.z).normalize();
    return m.addScaledVector(pw, 0.03);
  }
  /** World x sign of his left (-1) or right (+1) side as he lies (from his own shoulders). */
  private sideX(sx: -1 | 1) {
    const b = this.you.person.bones;
    const l = b.LeftArm.getWorldPosition(this.v.c).x, r = b.RightArm.getWorldPosition(this.v.p).x;
    const leftSign = l >= r ? 1 : -1;
    return sx < 0 ? leftSign : -leftSign;
  }

  // ── the treadmill: running on the belt, and falling off it ──
  private poseTreadmill(dt: number) {
    const you = this.you, g = this.game as Extract<GameState, { kind: "treadmill" }>;
    const BL = GYM.belt;
    if (!g.fell) {
      const want = this.phase === "count" ? "jog" : g.kmh >= 14 ? "sprint" : g.kmh >= 10 ? "run" : "jog";
      if (want !== this.clip && you.play.has(want)) { you.act({ clip: want }, 1e9); this.clip = want; }
      const belt = this.room.props.belts.find((b) => b.id === this.obj?.id)?.speed ?? 0;
      const a = (you.person.actions as any)[this.clip];
      if (a) a.timeScale = Math.max(0.3, belt / Math.max(0.5, this.o.clipSpeed(this.clip)));
      you.z += (this.beltZ(g.pos) - you.z) * Math.min(1, dt * 12);
      you.y = BL.top;
      if (this.phase === "play" && this.checkN++ % 12 === 0) {
        const x = GYM.treadmills.find((t) => t.id === this.obj?.id)?.x ?? 2.55;
        this.railPierceCm = Math.max(this.railPierceCm, railPierce(this.T, you, x));
      }
      return;
    }
    // off the back: carried by the belt, dropped off its end, onto the floor on his back; a beat; up again
    if (!this.fall.started) {
      this.fall = { z: you.z, y: you.y, started: true };
      if (you.play.has("get_up_side")) {
        you.act({ clip: "get_up_side" }, 1e9);
        const a = (you.person.actions as any).get_up_side;
        const dur = a?.getClip().duration ?? 2;
        you.play.play("get_up_side", { from: Math.max(0, dur * 0.42), speed: -1.6, once: true, fade: 0.12 });
        this.clip = "fall";
      } else { you.act({ clip: "frustrated", or: ["idle"] }, 1e9); this.clip = "fall"; }
    }
    const ft = g.fellT;
    const carry = Math.min(0.85, ft * 1.7 - ft * ft * 0.6);
    you.z = this.fall.z + carry;
    const past = you.z > BL.back + 0.1;
    you.y += ((past ? 0 : BL.top) - you.y) * Math.min(1, dt * 14);
    if (ft > 1.25 && this.clip === "fall" && you.play.has("get_up_side")) {
      // back up: the get-up played forwards from where the fall left him
      you.play.play("get_up_side", { from: 0, speed: 1.4, once: true, fade: 0.2 });
      this.clip = "getup";
    }
  }

  // ── the heavy bag: a guard, jabs and crosses when the cursor is in the zone ──
  private poseBag() {
    const you = this.you, b = you.person.bones, g = this.game as Extract<GameState, { kind: "bag" }>;
    const BG = GYM.bag, P = this.room.props;
    // a boxer's bounce on the balls of his feet
    you.y = 0.012 * Math.abs(Math.sin(g.t * 6.5));
    you.person.root.position.y = you.y;
    you.person.root.updateMatrixWorld(true);
    const head = b.Head.getWorldPosition(this.v.a);
    const fx = Math.sin(you.yaw), fz = Math.cos(you.yaw);
    // his right, from his own shoulders
    const ra = b.RightArm.getWorldPosition(this.v.c), la = b.LeftArm.getWorldPosition(this.v.x);
    let rx = ra.x - la.x, rz = ra.z - la.z; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
    // the bag's skin facing you, at chest height (where it hangs now)
    const bc = P.bag.body.localToWorld(this.v.p.set(0, -(GYM.H - 0.06 - 1.28), 0));
    const dxy = Math.hypot(bc.x - you.x, bc.z - you.z) || 1;
    const toX = (bc.x - you.x) / dxy, toZ = (bc.z - you.z) / dxy;
    // the hit on the bag when a punch lands (once per punch)
    if (g.hits > this.lastHits && g.since > 0.09) { this.lastHits = g.hits; P.bag.hit(toX, toZ, 0.22 + Math.min(0.12, g.combo * 0.006)); }
    // a punch's reach: out in 0.09 s, back in 0.2 s
    const e = g.since < 0.09 ? g.since / 0.09 : Math.max(0, 1 - (g.since - 0.09) / 0.2);
    // the torso turns into the punch
    const spine = b.Spine2 ?? b.Spine1 ?? b.Spine;
    if (spine) this.pose.turn(spine, this.v.up, (g.hand ? 1 : -1) * 0.32 * ease(e));
    for (const sx of [-1, 1] as const) {
      const side = sx < 0 ? "Left" : "Right";
      const handI = sx < 0 ? 0 : 1;
      const guard = this.v.b.set(head.x + fx * 0.26 + rx * sx * 0.12, head.y - 0.13, head.z + fz * 0.26 + rz * sx * 0.12);
      const t = guard;
      if (g.hand === handI && e > 0) {
        // the wrist stops 0.1 m short of the bag's skin (the fist and glove are in front of it)
        const hit = this.v.c.set(bc.x - toX * (BG.r + 0.1) + rx * sx * 0.05, head.y - 0.32, bc.z - toZ * (BG.r + 0.1) + rz * sx * 0.05);
        t.lerp(hit, ease(e));
      }
      const pole = this.v.x.set(t.x - fx * 0.3 + rx * sx * 0.35, t.y - 0.6, t.z - fz * 0.3 + rz * sx * 0.35);
      this.pose.reach(b[`${side}Arm`], b[`${side}ForeArm`], b[`${side}Hand`], t, pole, 1);
    }
  }
  private addGloves() {
    const T = this.T;
    if (!this.gloveG) {
      const g = new T.SphereGeometry(0.075, 12, 9); g.scale(1.05, 1.25, 1.1); g.translate(0, 0.08, 0.012);
      this.gloveG = g; this.gloveM = new T.MeshStandardMaterial({ color: "#c81e1e", roughness: 0.45 });
    }
    for (const side of ["LeftHand", "RightHand"]) {
      const h = this.you.person.bones[side];
      if (!h) continue;
      const m = new T.Mesh(this.gloveG, this.gloveM);
      m.scale.setScalar(1 / this.you.person.unit);
      m.position.multiplyScalar(1 / this.you.person.unit);
      m.castShadow = true;
      h.add(m); this.gloves.push(m);
    }
  }
  private removeGloves() { for (const m of this.gloves) m.parent?.remove(m); this.gloves = []; }

  /** For the debug readout: where the body and the bar are (m). */
  info() {
    const b = this.you.person.bones, w = (n: string) => { const v = b[n]?.getWorldPosition(new this.T.Vector3()); return v ? [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)] : null; };
    const bar = this.room.props.bar.position;
    return { lie: Object.fromEntries(Object.entries(this.lie).map(([k, v]) => [k, +v.toFixed(3)])), bar: [+bar.x.toFixed(2), +bar.y.toFixed(2), +bar.z.toFixed(2)], head: w("Head"), lArm: w("LeftArm"), hips: w("Hips"), lHand: w("LeftHand"), rHand: w("RightHand"), lFoot: w("LeftFoot") };
  }

  dispose() { this.removeGloves(); this.gloveG?.dispose(); this.gloveM?.dispose(); }
}

const isGym2 = (g: GameState): g is Gym2State => (GYM2_KINDS as string[]).includes(g.kind);

/** The deepest any of his skin goes into the bench pad (cm): inside its width and length, below its top less 1 cm. */
function padPierce(T: any, you: Npc, B: typeof GYM.bench): number {
  const v = new T.Vector3();
  let deep = 0;
  for (const m of [you.person.body, you.person.body.parent?.getObjectByName?.("Cloth")].filter(Boolean) as any[]) {
    m.skeleton?.update?.();
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 4) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      if (Math.abs(v.x - B.x) > 0.16 || v.z < B.head || v.z > B.foot) continue;
      const d = B.top - 0.01 - v.y;
      if (d > 0 && v.y > B.top - 0.12) deep = Math.max(deep, d);
    }
  }
  return +(deep * 100).toFixed(1);
}

/**
 * His back as he lies (between his shoulders `zA` and hips `zB`, the middle strip only, arms left out):
 * the lowest skin point, and the top of his chest under the bar's line (`barZ`).
 */
function torsoFit(T: any, you: Npc, x0: number, zA: number, zB: number, barZ: number): { minY: number; chestY: number } | null {
  const v = new T.Vector3();
  let minY = Infinity, chestY = -Infinity;
  for (const m of [you.person.body, you.person.body.parent?.getObjectByName?.("Cloth")].filter(Boolean) as any[]) {
    m.skeleton?.update?.();
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 2) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      const dx = Math.abs(v.x - x0);
      if (dx < 0.15 && v.z > Math.min(zA, zB) && v.z < Math.max(zA, zB)) minY = Math.min(minY, v.y);
      if (dx < 0.1 && Math.abs(v.z - barZ) < 0.07) chestY = Math.max(chestY, v.y);
    }
  }
  return isFinite(minY) && isFinite(chestY) ? { minY, chestY } : null;
}

/** A closed hand round a bar (degrees per finger joint): the bar's 3 cm across fills the hook of the fingers. */
const GRIP = fingersDeg({ thumb: [18, 28, 25], index: [39, 49, 28], middle: [41, 50, 28], ring: [43, 52, 28], little: [46, 53, 28], thumbSwing: 28 });

/** The deepest any skin goes inside the bar (cm past its surface; its radius is 1.5 cm), his hands left out: they
 *  close round it (the web of a closed toon hand folds into the bar's middle, hidden inside the fist). Arms, chest,
 *  head: never. */
function barPierce(T: any, you: Npc, bar: any): number {
  const v = new T.Vector3();
  let deep = 0;
  for (const m of [you.person.body, you.person.body.parent?.getObjectByName?.("Cloth")].filter(Boolean) as any[]) {
    m.skeleton?.update?.();
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 2) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      if (Math.abs(v.x - bar.x) > 1.0) continue;
      const d = 0.015 - Math.hypot(v.y - bar.y, v.z - bar.z);
      if (d <= 0.004 || d <= deep) continue;
      if (/Hand/.test(m.skeleton?.bones[mainBone(m, i)]?.name ?? "")) continue;
      deep = d;
    }
  }
  return +(deep * 100).toFixed(1);
}

/** The bone that moves a skin point most. */
function mainBone(m: any, i: number): number {
  const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
  let bi = 0, bw = -1;
  if (!si || !sw) return 0;
  for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } }
  return bi;
}

/** The deepest any skin goes into a treadmill's side rails, front uprights or console (cm). */
function railPierce(T: any, you: Npc, x: number): number {
  const BL = GYM.belt, z0 = BL.consoleZ, v = new T.Vector3();
  // boxes [x0, x1, y0, y1, z0, z1] round the rails (r 1.8 cm), the uprights and the console's front face
  const boxes: number[][] = [];
  for (const sx of [-1, 1]) {
    boxes.push([x + sx * 0.38 - 0.018, x + sx * 0.38 + 0.018, 1.05 - 0.018, 1.05 + 0.018, z0 + 0.1, z0 + 0.7]);
    boxes.push([x + sx * 0.38 - 0.03, x + sx * 0.38 + 0.03, 0.2, 1.3, z0 + 0.04, z0 + 0.12]);
  }
  boxes.push([x - 0.42, x + 0.42, 1.25, 1.52, z0 - 0.1, z0 + 0.12]);
  let deep = 0;
  for (const m of [you.person.body, you.person.body.parent?.getObjectByName?.("Cloth")].filter(Boolean) as any[]) {
    m.skeleton?.update?.();
    const n = m.geometry.attributes.position.count;
    for (let i = 0; i < n; i += 3) {
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld);
      for (const [a, b2, c, d, e, f] of boxes) {
        if (v.x < a || v.x > b2 || v.y < c || v.y > d || v.z < e || v.z > f) continue;
        deep = Math.max(deep, Math.min(v.x - a, b2 - v.x, v.y - c, d - v.y, v.z - e, f - v.z));
      }
    }
  }
  return +(deep * 100).toFixed(1);
}
