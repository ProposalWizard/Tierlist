/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D CASINO — a walk-around room (Harry, 8 Oct 2026: "start work on
 * making the casino 3D and adding it to the garden/shop walkable area").
 *
 * You are the same footballer as in the 3D shop and the garden (the
 * people3d body in your skin, hair and kit; the old character.glb when the
 * shop's "3D shop player" is Old). The room, from the door:
 *   - the roulette table (left) with its wheel turning
 *   - the blackjack table (right), a half-moon with stools
 *   - a row of four slot machines down the left wall
 *   - the big horse-racing screen on the back wall, the race running live
 *   - the betting counter on the right wall (competition bets), its board
 *   - Goalie Mode as an arcade cabinet in the back-right corner
 * Walk up to a station and its card shows (components/star/Casino3D.tsx);
 * tap a station and he walks there and the game opens as he arrives.
 * Roulette, Slots, Blackjack and Horse racing PLAY IN THE ROOM (Harry, 8 Oct
 * 2026: "having the games actually run in 3D"): the camera glides in close
 * (`focus`), and the wheel, the reels, the cards and the big screen's race
 * (./games3d.ts) show what components/star/Casino3DTable.tsx rolled with
 * the flat casino's own rules. Bets and Goalie Mode still open their flat
 * screens (components/star/Casino.tsx, GoalieMode.tsx) over the room.
 *
 * Built from primitives and canvas paint only (./textures.ts): no model
 * files except the footballer the shop and garden already load, so the
 * room costs almost nothing to download. Everything that never moves is
 * merged by material (lib/star/freezeStatic.ts). No shadow maps: blob
 * shadows, a warm hemisphere, a fill, and two chandeliers' lights.
 *
 * Walk out through the doors (+z) and you are back in the garden at the
 * casino's doors (cb.onDoor).
 *
 * The people (Harry, 8 Oct 2026: "build all the animations for any new 3D
 * areas"), on the hand-made casino clips (lib/star/three3d/footballAnims.ts):
 *   - the roulette croupier: dealer_idle; spins the wheel (dealer_spin, the
 *     wheel speeds up as he lets go) when you walk up, and now and then
 *   - the blackjack dealer: dealer_idle; deals a few cards (dealer_deal)
 *     when you walk up, and now and then
 *   - a bartender behind the new bar in the back-left corner (bartender_idle)
 *   - punters on the first and last slot machines (slot_sit, slot_pull)
 *   - a punter leaning on the blackjack table (lean_table) who now and then
 *     cheers (cheer_win) or groans (groan_loss)
 *   - you: close a game and you cheer if your money went up, groan if it
 *     went down (ctrl.react, from Casino3D.tsx)
 * The staff and punters are the people3d body, so they only come with the
 * New 3D shop player (as the dealers did); your own reaction uses the clips
 * for whichever body you are. How many: Low the two dealers; Medium adds the
 * bartender, one slot punter and the leaner; High all six. Off screen they
 * are not worked out.
 */
import { neonCanvas, numberCanvas, blobCanvas } from "../shop3d/textures";
import { dressInKit, type KitColours } from "../shop3d/scene";
import { loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { buildGrid, findPath, TapWalker, makeTapMarker, type WalkGrid, type XZ } from "../tapWalk";
import { makeWalkClip } from "../walkClip";
import { freezeStatic } from "../freezeStatic";
import { TIER_PROFILES, quality3dTier, stepDownTier, type Quality3d } from "../three3d/quality";
import { DynamicResolution, rememberGpu, loadGltfCached } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { addClips, ClipPlayer, loadAnims3d } from "../three3d/footballAnims";
import {
  carpetCanvas, panelCanvas, feltCanvas, layoutCanvas, slotScreenCanvas, marqueeCanvas,
  oddsBoardCanvas, drawRaceScreen, goalieScreenCanvas,
} from "./textures";
import {
  type CasinoStation, type InRoomGame, ROOM, DOOR_HALF, DOOR_H, ROUL, BJ, SLOT_X, SLOT_Z, PLAY_SLOT, SCREEN, BETS, ARCADE, START, BAR,
  STAND, FOCUS, stationAt,
} from "./plan";
import { buildGames, type Games3D } from "./games3d";
export type { CasinoStation } from "./plan";


export interface CasinoCallbacks {
  onNear: (s: CasinoStation | null) => void;
  /** A tap-walk to a station arrived: open its game. */
  onArrive?: (s: CasinoStation) => void;
  onFps?: (fps: number) => void;
  /** He walked out through the doors. */
  onDoor?: () => void;
  /** The phone took the 3D away (iPhone Safari, short of memory). */
  onContextLost?: () => void;
}

export interface CasinoPlayer { look: "new" | "old"; skin?: string; hair?: string; hairStyle?: "short" | "long" | "buzz" | "none" }

export interface CasinoOptions {
  quality?: Quality3d;
  fixedStep?: number;
  player?: CasinoPlayer;
  kit: KitColours;
  number?: number;
}

export interface CasinoController {
  setStick: (x: number, y: number) => void;
  orbit: (dxPixels: number) => void;
  /** What station is under a tap, if any. */
  pick: (clientX: number, clientY: number) => CasinoStation | null;
  /** Tap to move: a station walks you up to it (cb.onArrive as you get
   *  there); the floor walks you there. */
  tap: (clientX: number, clientY: number) => { station: CasinoStation | null } | null;
  /** A game is open over the room: stop drawing (battery), keep everything. */
  setPaused: (p: boolean) => void;
  place: (x: number, z: number, yaw?: number) => void;
  where: () => { x: number; z: number; yaw: number; t: number };
  stats: () => { calls: number; triangles: number; pixelRatio: number; frames: number; quality: string; merged?: { before: number; after: number } };
  /** He just closed a game: cheer (+1, more money than he opened it with), groan (−1), or nothing (0). */
  react: (sign: number) => void;
  /** Play a game in the room: he stands (or sits) at it and the camera
   *  glides in close; null glides back out and he can walk again. */
  focus: (g: InRoomGame | null) => void;
  /** The games' moving parts (./games3d.ts), null until the room is built. */
  games: Games3D;
  /** The croupier / dealer / your own hand, for a round. */
  staff: (role: "croupier" | "dealer") => void;
  /** Sat at the slot machine: pull the lever (his arm and the lever). The
   *  reels should start `PULL_AT` seconds after. */
  pull: () => void;
  dispose: () => void;
}

// ── The plan: ./plan.ts (shared with the tests) ──

/** Things you can't walk through: boxes [minX, maxX, minZ, maxZ] and circles [x, z, r]. */
const BOXES: [number, number, number, number][] = [
  [ROUL.x - ROUL.rx, ROUL.x + ROUL.rx, ROUL.z - ROUL.rz, ROUL.z + ROUL.rz],
  [BJ.x - BJ.r, BJ.x + BJ.r, BJ.z - 0.75, BJ.z], // the dealer's side
  [-ROOM.x, SLOT_X + 0.42, SLOT_Z[0] - 0.6, SLOT_Z[SLOT_Z.length - 1] + 0.6],
  [BETS.x - 0.45, ROOM.x, BETS.z0 - 0.1, BETS.z1 + 0.1],
  [ARCADE.x - 0.6, ARCADE.x + 0.6, -ROOM.z, ARCADE.z + 0.5],
  [SCREEN.x - 2.9, SCREEN.x + 2.9, -ROOM.z, -6.55], // the brass rail before the screen
  [-2.65, -1.95, ROOM.z - 0.95, ROOM.z], // plants by the doors
  [1.95, 2.65, ROOM.z - 0.95, ROOM.z],
  [-ROOM.x, BAR.x + 0.3, BAR.z0, BAR.z1], // the bar and behind it
];
const CIRCLES: [number, number, number][] = [[BJ.x, BJ.z, BJ.r]];

const WALK = 1.55;
const JOG = 3.3;

/** Opens the casino; a part-built one is thrown away properly if anything fails. */
/** Seconds from pressing Spin at the slot machine to the reels going: the
 *  slot_pull clip's `pulled` moment (lib/star/three3d/footballAnims.ts). */
export const PULL_AT = 0.75;

export async function startCasino(container: HTMLElement, cb: CasinoCallbacks, opts: CasinoOptions): Promise<CasinoController> {
  const own: { renderer?: any } = {};
  try {
    return await buildCasino(container, cb, opts, own);
  } catch (e) {
    const r = own.renderer;
    if (r) { try { r.setAnimationLoop(null); r.dispose(); r.forceContextLoss(); r.domElement.remove(); } catch { /* already gone */ } }
    throw e;
  }
}

async function buildCasino(container: HTMLElement, cb: CasinoCallbacks, opts: CasinoOptions, own: { renderer?: any }): Promise<CasinoController> {
  let tier: Quality3d = opts.quality ?? quality3dTier();
  let prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");

  // ── Renderer (the shop's settings; no shadow maps here) ──
  const renderer = new THREE.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
  own.renderer = renderer;
  rememberGpu(renderer);
  const dpr = window.devicePixelRatio || 1;
  const stillPR = () => Math.min(dpr, prof.maxPixelRatio);
  let dynPR = Math.min(dpr, prof.movePixelRatio);
  const makeDyn = () => new DynamicResolution(
    { setPixelRatio: (v: number) => { dynPR = v; } },
    { maxPixelRatio: prof.movePixelRatio, minPixelRatio: prof.minPixelRatio, fpsCap: prof.fpsCap },
    { step: 0.125, devicePixelRatio: dpr },
  );
  let dyn = makeDyn();
  const movePR = () => Math.min(dpr, prof.movePixelRatio, dynPR);
  let pr = stillPR();
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = false;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  let disposed = false;
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  const BG = "#14070b";
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 16, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 50);

  // ── Light: warm, low, rich ──
  scene.add(new THREE.HemisphereLight("#ffd9b0", "#3a0e18", 0.95));
  const fill = new THREE.DirectionalLight("#ffe2c4", 0.55);
  fill.position.set(1, 6, 8);
  scene.add(fill);
  const chandelierAt: [number, number][] = [[ROUL.x, ROUL.z], [BJ.x, BJ.z + 0.6]];
  chandelierAt.forEach(([x, z], i) => {
    if (tier === "low" && i > 0) return;
    const pl = new THREE.PointLight("#ffcf8f", tier === "low" ? 26 : 18, 11, 1.4);
    pl.position.set(tier === "low" ? 0 : x, ROOM.h - 0.9, tier === "low" ? -1 : z);
    scene.add(pl);
  });

  // ── Materials and helpers ──
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o });
  const glow = (c: string, i = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  const canvasTex = (cv: HTMLCanvasElement, repeat?: [number, number]) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const add = (geo: any, m: any, x: number, y: number, z: number, parent: any = scene, rx = 0, ry = 0, rz = 0) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.rotation.set(rx, ry, rz);
    parent.add(me);
    return me;
  };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, parent: any = scene, ry = 0) =>
    add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, 0, ry);
  const plane = (w: number, h: number, m: any, x: number, y: number, z: number, ry = 0, parent: any = scene) =>
    add(new THREE.PlaneGeometry(w, h), m, x, y, z, parent, 0, ry);
  const basic = (t: any, o: any = {}) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false, ...o });
  const neon = (text: string, ink: string, w: number, x: number, y: number, z: number, ry: number) => {
    const cv = neonCanvas(text, ink);
    return plane(w, (w * cv.height) / cv.width, basic(canvasTex(cv), { transparent: true, depthWrite: false, fog: false }), x, y, z, ry);
  };
  const blobT = canvasTex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, opacity = 0.8) => {
    const m = add(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }), x, 0.012, z, scene, -Math.PI / 2);
    m.renderOrder = 1;
    return m;
  };
  const goldM = mat("#d4a94e", { roughness: 0.28, metalness: 0.9 });
  const darkWoodM = mat("#2c160d", { roughness: 0.45 });
  const blackM = mat("#121014", { roughness: 0.35, metalness: 0.25 });
  const leatherM = mat("#7a1020", { roughness: 0.55 });

  // ── The room ──
  const floor = add(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), mat("#ffffff", { map: canvasTex(carpetCanvas(), [ROOM.x / 0.7, ROOM.z / 0.7]), roughness: 0.95 }), 0, 0, 0, scene, -Math.PI / 2);
  void floor;
  const ceil = add(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), mat("#1d0c12", { roughness: 0.9 }), 0, ROOM.h, 0, scene, Math.PI / 2);
  void ceil;
  const paperM = mat("#5a1426", { roughness: 0.8 });
  const panelT = canvasTex(panelCanvas());
  const wall = (len: number, x: number, z: number, ry: number, y0 = 0, y1 = ROOM.h) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    const pt = panelT.clone(); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(len / 2.4, 1); pt.needsUpdate = true;
    const lo = Math.min(1.1, y1);
    if (y0 < lo) plane(len, lo - y0, mat("#ffffff", { map: pt, roughness: 0.55 }), 0, (y0 + lo) / 2, 0, 0, g);
    if (y1 > Math.max(lo, y0)) plane(len, y1 - Math.max(lo, y0), paperM, 0, (Math.max(lo, y0) + y1) / 2, 0, 0, g);
    if (y0 < 1.12 && y1 > 1.1) box(len, 0.07, 0.06, goldM, 0, 1.12, 0.03, g);
    if (y1 >= ROOM.h) box(len, 0.12, 0.1, goldM, 0, ROOM.h - 0.25, 0.05, g);
    return g;
  };
  wall(ROOM.x * 2, 0, -ROOM.z, 0);
  wall(ROOM.z * 2, -ROOM.x, 0, Math.PI / 2);
  wall(ROOM.z * 2, ROOM.x, 0, -Math.PI / 2);
  // the front wall, with the doorway in it
  const sideLen = ROOM.x - DOOR_HALF;
  wall(sideLen, -(DOOR_HALF + sideLen / 2), ROOM.z, Math.PI);
  wall(sideLen, DOOR_HALF + sideLen / 2, ROOM.z, Math.PI);
  wall(DOOR_HALF * 2, 0, ROOM.z, Math.PI, DOOR_H, ROOM.h);
  // the doorway: a gold frame and the garden's light beyond
  for (const sx of [-1, 1]) box(0.14, DOOR_H, 0.24, goldM, sx * (DOOR_HALF + 0.07), DOOR_H / 2, ROOM.z - 0.05);
  box(DOOR_HALF * 2 + 0.28, 0.14, 0.24, goldM, 0, DOOR_H + 0.07, ROOM.z - 0.05);
  plane(DOOR_HALF * 2, DOOR_H, new THREE.MeshBasicMaterial({ color: "#ffe6bf", toneMapped: false, fog: false }), 0, DOOR_H / 2, ROOM.z + 0.6, Math.PI);
  neon("KNOWITBALL CASINO", "#ff3d6e", 4.4, 0, 3.45, ROOM.z - 0.08, Math.PI);
  // tall gold pilasters round the walls
  for (const [x, z, ry] of [[-ROOM.x + 0.08, -4, Math.PI / 2], [-ROOM.x + 0.08, 0, Math.PI / 2], [ROOM.x - 0.08, -4, -Math.PI / 2], [ROOM.x - 0.08, 0, -Math.PI / 2], [-4.8, -ROOM.z + 0.08, 0], [3.4, -ROOM.z + 0.08, 0]] as [number, number, number][]) {
    box(0.36, ROOM.h, 0.12, goldM, x, ROOM.h / 2, z, scene, ry);
  }
  // plants in black pots either side of the doors
  for (const sx of [-1, 1]) {
    box(0.6, 0.6, 0.6, blackM, sx * 2.3, 0.3, ROOM.z - 0.55);
    box(0.66, 0.05, 0.66, goldM, sx * 2.3, 0.62, ROOM.z - 0.55);
    add(new THREE.IcosahedronGeometry(0.48, 2), mat("#2f6a2a", { roughness: 0.85, flatShading: true }), sx * 2.3, 1.15, ROOM.z - 0.55);
  }
  // chandeliers: a gold ring of lit drops
  const dropM = glow("#ffe2a6", 2.2);
  for (const [x, z] of chandelierAt) {
    add(new THREE.TorusGeometry(0.55, 0.04, 8, 28), goldM, x, ROOM.h - 0.95, z, scene, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), goldM, x, ROOM.h - 0.55, z);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      add(new THREE.IcosahedronGeometry(0.07, 1), dropM, x + Math.cos(a) * 0.55, ROOM.h - 1.05, z + Math.sin(a) * 0.55);
    }
    add(new THREE.IcosahedronGeometry(0.16, 1), dropM, x, ROOM.h - 1.15, z);
  }

  // things you can tap, by station
  const groups: Record<CasinoStation, any> = {} as any;
  const station = (id: CasinoStation) => { const g = new THREE.Group(); g.userData.station = id; scene.add(g); groups[id] = g; return g; };

  // ── Roulette ──
  const rg = station("roulette");
  {
    const g = new THREE.Group();
    g.position.set(ROUL.x, 0, ROUL.z);
    rg.add(g);
    const rim = add(new THREE.CylinderGeometry(1, 1, 0.14, 40), darkWoodM, 0, 0.8, 0, g);
    rim.scale.set(ROUL.rx, 1, ROUL.rz);
    const felt = add(new THREE.CylinderGeometry(1, 1, 0.02, 40), mat("#0f6b39", { roughness: 0.95 }), 0, 0.875, 0, g);
    felt.scale.set(ROUL.rx - 0.12, 1, ROUL.rz - 0.12);
    add(new THREE.PlaneGeometry(1.6, 0.8), basic(canvasTex(layoutCanvas()), { toneMapped: true }), 0.4, 0.888, 0, g, -Math.PI / 2);
    // the base and legs
    add(new THREE.CylinderGeometry(0.5, 0.65, 0.75, 20), darkWoodM, 0, 0.375, 0, g);
    // the wheel itself (numbered pockets, the ball) is games3d's
    rg.userData.table = g;
    // three stools on the player's side
    for (const dx of [-0.9, 0.2, 1.2]) {
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), leatherM, dx, 0.68, ROUL.rz + 0.5, g);
      add(new THREE.CylinderGeometry(0.03, 0.05, 0.64, 8), goldM, dx, 0.32, ROUL.rz + 0.5, g);
    }
    // a stack of chips
    for (const [cx, cz, c] of [[0.9, -0.3, "#e11d48"], [1.05, -0.2, "#2563eb"], [0.75, -0.15, "#111111"]] as [number, number, string][]) {
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 14), mat(c, { roughness: 0.5 }), cx, 0.93, cz, g);
    }
  }
  blob(ROUL.rx * 2.4, ROUL.rz * 2.6, ROUL.x, ROUL.z, 0.9);
  neon("ROULETTE", "#ff5a5a", 1.9, ROUL.x, 2.55, ROUL.z - 0.2, 0);

  // ── Blackjack: a half-moon table, the dealer's side to the back ──
  const bg = station("blackjack");
  {
    const g = new THREE.Group();
    g.position.set(BJ.x, 0, BJ.z);
    bg.add(g);
    bg.userData.table = g;
    add(new THREE.CylinderGeometry(BJ.r, BJ.r, 0.14, 40, 1, false, -Math.PI / 2, Math.PI), darkWoodM, 0, 0.8, 0, g);
    const felt = add(new THREE.CircleGeometry(BJ.r - 0.12, 40, Math.PI, Math.PI), basic(canvasTex(feltCanvas(["", "", "", "WINS PAY 1 TO 1", "Dealer stands on 17"])), { toneMapped: true }), 0, 0.875, 0, g, -Math.PI / 2);
    void felt;
    box(BJ.r * 2, 0.16, 0.12, darkWoodM, 0, 0.8, -0.04, g);
    add(new THREE.CylinderGeometry(0.45, 0.6, 0.75, 20), darkWoodM, 0, 0.375, 0.5, g);
    // the dealer's chip rack and the card shoe
    box(0.9, 0.08, 0.28, blackM, 0, 0.92, 0.2, g);
    for (let k = 0; k < 6; k++) add(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 12), mat(["#e11d48", "#2563eb", "#16a34a", "#111111", "#f59e0b", "#a855f7"][k], { roughness: 0.5 }), -0.32 + k * 0.13, 0.96, 0.2, g, 0, 0, Math.PI / 2);
    box(0.24, 0.14, 0.34, mat("#7a1020", { roughness: 0.4 }), 0.7, 0.95, 0.25, g);
    // cards dealt to two places
    const cardM = mat("#fbfbf8", { roughness: 0.5 });
    // (the middle, where you play, stays clear for the dealt cards)
    for (const [cx, cz, ry] of [[-1.02, 0.55, 0.9], [-0.94, 0.6, 0.7], [1.0, 0.56, -0.8]] as [number, number, number][]) {
      add(new THREE.BoxGeometry(0.14, 0.004, 0.2), cardM, cx, 0.89, cz, g, 0, ry);
    }
    // stools round the curve
    for (const a of [-1.25, -0.45, 0.45, 1.25]) {
      const sx = Math.sin(a) * (BJ.r + 0.42), sz = Math.cos(a) * (BJ.r + 0.42);
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), leatherM, sx, 0.68, sz, g);
      add(new THREE.CylinderGeometry(0.03, 0.05, 0.64, 8), goldM, sx, 0.32, sz, g);
    }
  }
  blob(BJ.r * 2.6, BJ.r * 1.8, BJ.x, BJ.z + 0.6, 0.9);
  neon("BLACKJACK", "#5ad1ff", 1.9, BJ.x, 2.55, BJ.z - 0.4, 0);

  // ── The slots: four machines down the left wall ──
  const sg = station("slots");
  const toppers: any[] = [];
  let playSlot: any = null;
  SLOT_Z.forEach((z, i) => {
    const g = new THREE.Group();
    g.position.set(SLOT_X, 0, z);
    g.rotation.y = Math.PI / 2; // facing into the room (+x)
    sg.add(g);
    if (i === PLAY_SLOT) playSlot = g;
    const body = mat(["#9b1020", "#c08a2a", "#5b21b6", "#9b1020"][i], { roughness: 0.35, metalness: 0.4 });
    box(1.0, 1.05, 0.75, body, 0, 0.525, 0, g);
    box(1.0, 0.85, 0.55, body, 0, 1.47, -0.1, g);
    box(1.04, 0.06, 0.8, goldM, 0, 1.06, 0, g);
    // the one you play has real reels (games3d); the others a painted glass
    if (i !== PLAY_SLOT) plane(0.78, 0.49, basic(canvasTex(slotScreenCanvas(i * 3 + 1))), 0, 1.45, 0.18, 0, g);
    box(0.86, 0.06, 0.06, goldM, 0, 1.72, 0.19, g);
    box(0.86, 0.06, 0.06, goldM, 0, 1.18, 0.19, g);
    // a sloped button deck with three lit buttons
    const deck = box(0.9, 0.05, 0.36, blackM, 0, 1.0, 0.28, g);
    deck.rotation.x = -0.35;
    for (const [bx, c] of [[-0.25, "#ef4444"], [0, "#facc15"], [0.25, "#22c55e"]] as [number, string][]) add(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), glow(c, 1.4), bx, 1.04, 0.32, g, -0.35);
    // the topper: a lit box with the name
    const topM = new THREE.MeshBasicMaterial({ map: canvasTex(marqueeCanvas(["777", "JACKPOT", "SLOTS", "LUCKY 7"][i], ["#7a0b16", "#7a5208", "#3b0b7a", "#7a0b16"][i], "#ffd27a")), toneMapped: false });
    topM.userData.keep = true;
    box(1.0, 0.36, 0.5, goldM, 0, 2.08, -0.1, g);
    toppers.push(plane(0.94, 0.3, topM, 0, 2.08, 0.155, 0, g));
    // the lever (the one you play: games3d's, so it can be pulled)
    if (i !== PLAY_SLOT) {
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), mat("#c9c9c9", { metalness: 0.9, roughness: 0.25 }), 0.55, 1.3, 0.05, g);
      add(new THREE.SphereGeometry(0.07, 12, 10), mat("#d1121e", { roughness: 0.3 }), 0.55, 1.57, 0.05, g);
    }
    // a stool
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), leatherM, 0, 0.66, 0.85, g);
    add(new THREE.CylinderGeometry(0.03, 0.05, 0.62, 8), goldM, 0, 0.31, 0.85, g);
  });
  blob(1.6, 5.6, SLOT_X + 0.3, (SLOT_Z[0] + SLOT_Z[SLOT_Z.length - 1]) / 2, 0.7);

  // ── The horse-racing screen on the back wall, running live ──
  const hg = station("horses");
  const raceCv = document.createElement("canvas");
  raceCv.width = 512; raceCv.height = 256;
  drawRaceScreen(raceCv, 0);
  const raceT = canvasTex(raceCv);
  const raceM = basic(raceT);
  raceM.userData.keep = true;
  const screenMesh = plane(SCREEN.w, SCREEN.h, raceM, SCREEN.x, SCREEN.y, -ROOM.z + 0.12, 0, hg);
  box(SCREEN.w + 0.3, SCREEN.h + 0.3, 0.1, blackM, SCREEN.x, SCREEN.y, -ROOM.z + 0.05, hg);
  for (const y of [SCREEN.y - SCREEN.h / 2 - 0.16, SCREEN.y + SCREEN.h / 2 + 0.16]) box(SCREEN.w + 0.4, 0.06, 0.14, goldM, SCREEN.x, y, -ROOM.z + 0.08, hg);
  // a brass rail before it
  for (let k = 0; k <= 4; k++) add(new THREE.CylinderGeometry(0.03, 0.03, 0.95, 8), goldM, SCREEN.x - 2.8 + k * 1.4, 0.475, -6.6, hg);
  add(new THREE.CylinderGeometry(0.035, 0.035, 5.7, 8), goldM, SCREEN.x, 0.95, -6.6, hg, 0, 0, Math.PI / 2);

  // ── The betting counter on the right wall ──
  const tg = station("bets");
  {
    const zc = (BETS.z0 + BETS.z1) / 2, len = BETS.z1 - BETS.z0;
    box(0.8, 1.05, len, darkWoodM, BETS.x, 0.525, zc, tg);
    box(0.9, 0.06, len + 0.1, mat("#efe6d4", { roughness: 0.25, metalness: 0.1 }), BETS.x, 1.08, zc, tg);
    box(0.04, 0.06, len, goldM, BETS.x - 0.42, 0.2, zc, tg);
    box(0.04, 0.06, len, goldM, BETS.x - 0.42, 0.95, zc, tg);
    plane(2.9, 1.8, basic(canvasTex(oddsBoardCanvas())), ROOM.x - 0.06, 2.25, zc, -Math.PI / 2, tg);
    box(0.08, 1.95, 3.05, goldM, ROOM.x - 0.02, 2.25, zc, tg);
    neon("BETS", "#7df59a", 1.6, ROOM.x - 0.08, 3.5, zc, -Math.PI / 2);
    // a little till and a pad of slips
    box(0.36, 0.26, 0.4, blackM, BETS.x + 0.1, 1.24, zc + 1.0, tg);
    box(0.3, 0.18, 0.02, glow("#5ce1a1", 1.3), BETS.x - 0.08, 1.3, zc + 1.0, tg, -Math.PI / 2);
    box(0.22, 0.03, 0.3, mat("#fff7d6"), BETS.x - 0.1, 1.12, zc - 0.6, tg);
  }
  blob(1.4, 4.2, BETS.x, (BETS.z0 + BETS.z1) / 2, 0.7);

  // ── Goalie Mode: an arcade cabinet ──
  const ag = station("goalie");
  {
    const g = new THREE.Group();
    g.position.set(ARCADE.x, 0, ARCADE.z);
    ag.add(g);
    const blueM = mat("#0b4a7a", { roughness: 0.4, metalness: 0.3 });
    box(1.1, 1.0, 0.85, blueM, 0, 0.5, 0, g);
    box(1.1, 0.95, 0.6, blueM, 0, 1.47, -0.12, g);
    for (const sx of [-1, 1]) box(0.05, 2.2, 0.9, goldM, sx * 0.57, 1.1, 0, g);
    const scr = plane(0.86, 0.66, basic(canvasTex(goalieScreenCanvas())), 0, 1.45, 0.19, 0, g);
    scr.rotation.x = -0.12;
    const deck = box(1.0, 0.06, 0.4, blackM, 0, 1.02, 0.35, g);
    deck.rotation.x = -0.3;
    for (const bx of [-0.2, 0.2]) add(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), glow("#38bdf8", 1.6), bx, 1.07, 0.38, g, -0.3);
    box(1.1, 0.42, 0.62, blackM, 0, 2.15, -0.12, g);
    plane(1.04, 0.36, basic(canvasTex(marqueeCanvas("GOALIE MODE", "#0b3a66", "#7dd3fc")), {}), 0, 2.15, 0.195, 0, g);
  }
  blob(1.6, 1.4, ARCADE.x, ARCADE.z + 0.2, 0.8);

  // ── The bar: a counter with a marble top, a mirrored back shelf of bottles ──
  {
    const zc = (BAR.z0 + BAR.z1) / 2, len = BAR.z1 - BAR.z0;
    box(0.6, BAR.top - 0.05, len, darkWoodM, BAR.x, (BAR.top - 0.05) / 2, zc);
    box(0.72, 0.05, len + 0.1, mat("#efe6d4", { roughness: 0.25, metalness: 0.1 }), BAR.x + 0.03, BAR.top - 0.025, zc);
    box(0.04, 0.05, len, goldM, BAR.x + 0.32, 0.18, zc);
    box(0.04, 0.05, len, goldM, BAR.x + 0.32, 0.9, zc);
    // the back shelf on the wall: a glow, two shelves, bottles
    const wx = -ROOM.x + 0.1;
    plane(len - 0.2, 1.3, glow("#ffb45a", 0.5), wx + 0.01, 1.9, zc, Math.PI / 2);
    for (const y of [1.45, 2.05]) box(0.28, 0.04, len - 0.2, darkWoodM, wx + 0.14, y, zc);
    const bottleC = ["#2f7a3a", "#7a3a14", "#c9b27a", "#3a5a8a", "#8a1a2a", "#e8e0c8"];
    for (let k = 0; k < 14; k++) {
      for (const y of [1.47, 2.07]) {
        const bz = BAR.z0 + 0.3 + (k * (len - 0.6)) / 13 + (y > 2 ? 0.1 : 0);
        add(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 8), mat(bottleC[(k + (y > 2 ? 3 : 0)) % bottleC.length], { roughness: 0.2, metalness: 0.1 }), wx + 0.14, y + 0.15, bz);
      }
    }
    // glasses on the counter, two stools in front
    for (const gzz of [zc - 0.9, zc + 0.4]) add(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 10), mat("#dfe9f0", { roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 }), BAR.x + 0.12, BAR.top + 0.05, gzz);
    for (const sz of [zc - 0.7, zc + 0.8]) {
      add(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 16), leatherM, BAR.x + 0.75, 0.74, sz);
      add(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 8), goldM, BAR.x + 0.75, 0.35, sz);
    }
    neon("BAR", "#ffb45a", 1.6, -ROOM.x + 0.08, 3.25, zc, Math.PI / 2);
  }
  blob(1.2, BAR.z1 - BAR.z0 + 0.6, BAR.x - 0.2, (BAR.z0 + BAR.z1) / 2, 0.6);

  // ── The footballer (the shop's, exactly) ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const newLook = (opts.player?.look ?? "new") === "new";
  let player: any, mixer: any, idleA: any, walkA: any, jogA: any;
  let person: Person3D | null = null;
  /** The casino's staff (newLook only): see "The dealers" below. */
  const dealers: Person3D[] = [];
  type NpcRole = "croupier" | "dealer" | "bartender" | "slots" | "leaner";
  /** Each person's clip player, what he does by default, and his next turn. */
  const npcs: { p: Person3D; pl: ClipPlayer; role: NpcRole; base: string; next: number; until: number; x: number; z: number }[] = [];
  /** Your reaction after a game (null if the clips didn't load). */
  let cheerA: any = null, groanA: any = null;
  /** Sat at the slot machine, and pulling its lever (null if not loaded). */
  let sitA: any = null, pullA: any = null;
  const circles: [number, number, number][] = [...CIRCLES];
  const numT = canvasTex(numberCanvas(opts.number ?? 10, "#ffffff"));
  if (newLook) {
    const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
    const model = playerModelFor(opts.player?.hairStyle);
    const [g, a, cas] = await Promise.all([
      loadPeople3d(loader, model, people3dLook()), loadPeople3d(loader, "anims"),
      loadAnims3d(loader, "casino").catch((e) => { console.error("casino clips", e); return null; }),
    ]);
    // ── The casino's people: the same body, on the casino clips. The tables
    // are 0.88 m high and the clips were made for a 0.97–1.02 m top, so the
    // two croupiers and the leaner are a touch smaller (0.9): their hands
    // land on the felt, not in the air above it. ──
    const SPOTS: { role: NpcRole; x: number; z: number; yaw: number; skin: string; shirt: string; trim: string; hair: string; scale: number }[] = [
      { role: "croupier", x: ROUL.x, z: ROUL.z - ROUL.rz - 0.42, yaw: 0, skin: "#e0ac69", shirt: "#141414", trim: "#f5f5f5", hair: "#1b1410", scale: 0.9 },
      { role: "dealer", x: BJ.x, z: BJ.z - 0.48, yaw: 0, skin: "#8d5524", shirt: "#141414", trim: "#f5f5f5", hair: "#1b1410", scale: 0.9 },
      { role: "bartender", x: BAR.x - 0.75, z: (BAR.z0 + BAR.z1) / 2 - 0.2, yaw: Math.PI / 2, skin: "#c68642", shirt: "#f4efe6", trim: "#2a1a10", hair: "#2b1b12", scale: 1 },
      { role: "slots", x: SLOT_X + 0.85, z: SLOT_Z[0], yaw: -Math.PI / 2, skin: "#5c3a1e", shirt: "#2f4f7a", trim: "#d9d0c0", hair: "#120c08", scale: 1 },
      { role: "leaner", x: 0, z: 0, yaw: 0, skin: "#f1c27d", shirt: "#6b1f2a", trim: "#1f1f1f", hair: "#4a2e1c", scale: 0.9 },
      { role: "slots", x: SLOT_X + 0.85, z: SLOT_Z[SLOT_Z.length - 1], yaw: -Math.PI / 2, skin: "#8d5524", shirt: "#3b3b3b", trim: "#c08a2a", hair: "#2b1b10", scale: 1 },
    ];
    {
      // the leaner: at the blackjack table's curve, between two stools on its
      // left, facing in (away from where you stand to play)
      const a = -0.85, r = BJ.r + 0.32;
      SPOTS[4].x = BJ.x + Math.sin(a) * r;
      SPOTS[4].z = BJ.z + Math.cos(a) * r;
      SPOTS[4].yaw = a + Math.PI;
    }
    const budget = !cas ? 2 : tier === "low" ? 2 : tier === "medium" ? 5 : 6;
    for (const sp of SPOTS.slice(0, budget)) {
      const d = makePerson3d(THREE, SkeletonUtils as any, g, a, { outline: prof.outlines ? 0.006 : 0, castShadow: false });
      dressPerson3d(THREE, d, { skin: sp.skin, hair: sp.hair, kit: { shirt: sp.shirt, trim: sp.trim }, number: null });
      relaxHands(THREE, d);
      if (cas) addClips(THREE, d, cas);
      d.root.position.set(sp.x, 0, sp.z);
      d.root.rotation.y = sp.yaw;
      d.root.scale.setScalar(sp.scale);
      scene.add(d.root);
      blob(0.8, 0.8, sp.x, sp.z, 0.7);
      dealers.push(d);
      circles.push([sp.x, sp.z, sp.role === "slots" ? 0.3 : 0.35]);
      const pl = new ClipPlayer(THREE, d.actions);
      const base = ({ croupier: "dealer_idle", dealer: "dealer_idle", bartender: "bartender_idle", slots: "slot_sit", leaner: "lean_table" } as const)[sp.role];
      if (!pl.play(base, { from: Math.random() * 3 })) pl.play("idle");
      npcs.push({ p: d, pl, role: sp.role, base, next: 3 + Math.random() * 6, until: 0, x: sp.x, z: sp.z });
    }
    person = makePerson3d(THREE, SkeletonUtils as any, g, a, { outline: prof.outlines ? 0.006 : 0, castShadow: false });
    player = person.root;
    mixer = person.mixer;
    idleA = person.actions.idle;
    walkA = mixer.clipAction(makeWalkClip(THREE, person.actions.jog.getClip(), person.actions.idle.getClip()));
    walkA.play(); walkA.setEffectiveWeight(0);
    jogA = person.actions.jog;
    dressPerson3d(THREE, person, { skin: opts.player?.skin ?? "#c68642", hair: opts.player?.hair ?? "#2b1b12", kit: opts.kit, number: numT });
    relaxHands(THREE, person);
    if (cas) {
      addClips(THREE, person, cas);
      cheerA = person.actions.cheer_win ?? null;
      groanA = person.actions.groan_loss ?? null;
      sitA = person.actions.slot_sit ?? null;
      pullA = person.actions.slot_pull ?? null;
    }
  } else {
    const [charGltf, animGltf]: any[] = await Promise.all([
      loadGltfCached(loader, "/star/shop3d/character.glb"),
      loadGltfCached(loader, "/star/shop3d/anims.glb"),
    ]);
    const kitU = {
      uShirt: { value: new THREE.Color(opts.kit.shirt) }, uTrim: { value: new THREE.Color(opts.kit.trim) },
      uBoot: { value: new THREE.Color("#141416") }, uNum: { value: numT },
      uPelvis: { value: new THREE.Vector3() }, uUp: { value: new THREE.Vector3(0, 1, 0) },
      uRight: { value: new THREE.Vector3(1, 0, 0) }, uFwd: { value: new THREE.Vector3(0, 0, 1) },
    };
    player = charGltf.scene;
    player.traverse((o: any) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      if (o.isSkinnedMesh && o.material?.name === "Skin") dressInKit(THREE, o, kitU);
      if (o.material?.name === "Hair") o.material.color.set("#4a2e1c");
    });
    mixer = new THREE.AnimationMixer(player);
    const clip = (n: string) => animGltf.animations.find((x: any) => x.name === n);
    const act = (n: string) => { const x = mixer.clipAction(clip(n)); x.play(); x.setEffectiveWeight(0); return x; };
    idleA = act("Idle_Loop"); walkA = act("Walk_Loop"); jogA = act("Jog_Fwd_Loop");
    // the old footballer's own cut of the casino clips (his reaction after a game)
    const casU: any = await loadAnims3d(loader, "casino", "ual").catch((e) => { console.error("casino clips (old body)", e); return null; });
    const take = (n: string) => { const c = casU?.animations?.find((x: any) => x.name === n); if (!c) return null; const x = mixer.clipAction(c); x.play(); x.setEffectiveWeight(0); return x; };
    cheerA = take("cheer_win");
    groanA = take("groan_loss");
    sitA = take("slot_sit");
    pullA = take("slot_pull");
  }
  if (disposed) throw new Error("disposed");
  player.position.set(START.x, 0, START.z);
  player.rotation.y = Math.PI;
  scene.add(player);
  const playerBlob = blob(0.9, 0.9, START.x, START.z, 0.9);
  idleA.setEffectiveWeight(1);

  // ── State ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0, yaw = Math.PI, camYaw = 0, orbitHold = 0;
  let near: CasinoStation | null = null;
  let frames = 0, fpsT0 = performance.now(), slowSeconds = 0, gameT = 0, drawn = 0;
  let paused = false;
  let leftByDoor = false;
  /** The game being played in the room (camera in close, no walking). */
  let focused: InRoomGame | null = null;
  /** Sat at the machine: the seat weight (0 standing … 1 sat), and a pull in progress. */
  let seat = 0, seatWant = 0, pullT = -1;
  const walker = new TapWalker();
  const marker = makeTapMarker(THREE, scene);
  let grid: WalkGrid | null = null;
  let faceTo: XZ | null = null;
  const stopWalk = () => { if (walker.active) { walker.cancel(); marker.fade(); } faceTo = null; };
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) return;
    if (paused || focused) return;
    if (down) { keys.add(k); stopWalk(); } else keys.delete(k);
    if (k.startsWith("arrow")) e.preventDefault();
  };
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener("keydown", kd);
  window.addEventListener("keyup", ku);
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? 62 : 54;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  const R = 0.32;
  const collide = (x: number, z: number) => {
    x = Math.max(-ROOM.x + R, Math.min(ROOM.x - R, x));
    const inDoor = !!cb.onDoor && Math.abs(x) < DOOR_HALF - 0.15;
    z = Math.max(-ROOM.z + R, Math.min(inDoor ? ROOM.z + 0.9 : ROOM.z - 0.4, z));
    if (inDoor && z > ROOM.z + 0.25 && !leftByDoor) { leftByDoor = true; cb.onDoor?.(); }
    for (const [x0, x1, z0, z1] of BOXES) {
      if (x > x0 - R && x < x1 + R && z > z0 - R && z < z1 + R) {
        const push = [x - (x0 - R), x1 + R - x, z - (z0 - R), z1 + R - z];
        const m = Math.min(...push);
        if (m === push[0]) x = x0 - R; else if (m === push[1]) x = x1 + R; else if (m === push[2]) z = z0 - R; else z = z1 + R;
      }
    }
    for (const [cx, cz, cr] of circles) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < cr + R && d > 1e-6) { x = cx + (dx / d) * (cr + R); z = cz + (dz / d) * (cr + R); }
    }
    return [x, z];
  };
  const isFree = (x: number, z: number) => {
    const r = R + 0.08;
    if (Math.abs(x) > ROOM.x - r || z < -ROOM.z + r || z > ROOM.z - 0.45) return false;
    for (const [x0, x1, z0, z1] of BOXES) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
    for (const [cx, cz, cr] of circles) if (Math.hypot(x - cx, z - cz) < cr + r) return false;
    return true;
  };
  const walkTo = (to: XZ, face: XZ | null, arrive?: () => void) => {
    grid ??= buildGrid(-ROOM.x, ROOM.x, -ROOM.z, ROOM.z, 0.25, isFree);
    const path = findPath(grid, [player.position.x, player.position.z], to);
    if (!path) return false;
    faceTo = null;
    walker.go(path, { onArrive: () => { marker.fade(); faceTo = face; arrive?.(); } });
    const g = path[path.length - 1];
    marker.show(g[0], g[1], 0.02);
    orbitHold = 0;
    return true;
  };

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let first = true;
  let acc = 0, busy = true, busyT = 0, stillT = 0, capAlways = false, raceAcc = 0, glideOut = 0;
  const stepDown = (): boolean => {
    const next = stepDownTier(tier);
    if (!next) return false;
    tier = next; prof = TIER_PROFILES[tier];
    dyn = makeDyn(); dynPR = Math.min(dpr, prof.movePixelRatio);
    pr = stillPR(); renderer.setPixelRatio(pr);
    if (!prof.outlines && person) person.outline.visible = false;
    if (!prof.outlines) for (const d of dealers) d.outline.visible = false;
    resize();
    return true;
  };
  const games = buildGames({
    THREE, renderer, roulTable: rg.userData.table, bjTable: bg.userData.table, slotMachine: playSlot,
    screenMat: raceM, screenIdle: raceT, tier, goldM, darkWoodM,
  });
  const frozen = freezeStatic(THREE, mergeGeometries, scene, new Set<any>([player, playerBlob, screenMesh, ...games.keep, ...toppers, ...dealers.map((d) => d.root)]));
  try { await renderer.compileAsync(scene, camera); } catch { /* compiled on first use */ }
  if (disposed) throw new Error("disposed");

  // ── The people's day ──
  let spinAt = 0;
  let react: { a: any; t: number; w: number; reps: number; out: boolean } | null = null;
  const frustum = new THREE.Frustum(), projM = new THREE.Matrix4(), sph = new THREE.Sphere(), v3 = new THREE.Vector3();
  /** One of the staff's or punters' own moves, now. */
  const staffMove = (role: NpcRole) => {
    for (const n of npcs) {
      if (n.role !== role || n.until > gameT || (n.pl.current !== n.base && n.pl.current !== "idle")) continue;
      if (role === "croupier" && n.pl.play("dealer_spin", { fade: 0.2, once: true, onEnd: () => n.pl.play(n.base, { fade: 0.3 }) })) {
        // the wheel picks up as his hand leaves it (the clip's `release`, 0.65 s)
        spinAt = gameT + 0.65;
        n.until = gameT + 1.6;
      } else if (role === "dealer" && n.pl.play("dealer_deal", { fade: 0.2 })) n.until = gameT + 2 + Math.floor(Math.random() * 2);
      else if (role === "slots" && n.pl.play("slot_pull", { fade: 0.15, once: true, onEnd: () => n.pl.play(n.base, { fade: 0.2 }) })) n.until = gameT + 1.4;
      else if (role === "leaner") {
        if (Math.random() < 0.5 ? n.pl.play("cheer_win", { fade: 0.25 }) : n.pl.play("groan_loss", { fade: 0.25, once: true, onEnd: () => n.pl.play(n.base, { fade: 0.35 }) })) n.until = gameT + 2.4;
      }
    }
  };
  const GAP: Record<NpcRole, [number, number]> = { croupier: [10, 16], dealer: [7, 12], bartender: [99, 99], slots: [5, 10], leaner: [9, 15] };
  const stepNpcs = (dt: number) => {
    if (!npcs.length) return;
    projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projM);
    for (const n of npcs) {
      // a timed move that loops (deal, cheer) ends here; a one-shot ends itself
      if (n.until && gameT >= n.until) {
        n.until = 0;
        if (n.pl.current === "dealer_deal" || n.pl.current === "cheer_win") n.pl.play(n.base, { fade: 0.3 });
      }
      n.next -= dt;
      if (n.next <= 0) {
        const [a, b] = GAP[n.role];
        n.next = a + Math.random() * (b - a);
        if (n.role !== "bartender") staffMove(n.role);
      }
      n.pl.update(dt);
      const seen = frustum.intersectsSphere(sph.set(v3.set(n.x, 1, n.z), 1.2));
      n.p.root.visible = seen;
      if (seen) n.p.mixer.update(dt);
    }
  };

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    if (paused) { clock.getDelta(); return; }
    let dt: number;
    if (opts.fixedStep) dt = opts.fixedStep;
    else {
      acc += Math.min(0.25, clock.getDelta());
      const cap = busy && !capAlways ? prof.fpsCap : prof.stillFps;
      if (cap < 60 && acc < 1 / (cap + 1)) return;
      dt = Math.min(0.05, acc);
      acc = 0;
    }
    gameT += dt;
    let ix = focused ? 0 : stick.x, iy = focused ? 0 : stick.y;
    if (keys.size && !focused) {
      ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      iy = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const m = Math.hypot(ix, iy) || 1;
      const run = keys.has("shift") ? 1 : 0.6;
      ix = (ix / m) * run; iy = (iy / m) * run;
    }
    let mag = Math.min(1, Math.hypot(ix, iy));
    let wantYaw: number | null = null;
    if (mag >= 0.08) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      wantYaw = Math.atan2(fx * iy + rx * ix, fz * iy + rz * ix);
    } else if (walker.active) {
      const st = walker.step(player.position.x, player.position.z, dt);
      if (st) {
        wantYaw = st.yaw;
        mag = st.push * Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(angDiff(yaw, st.yaw)))));
      } else if (!walker.active && marker.visible) marker.fade();
    }
    const target = mag < 0.08 ? 0 : mag < 0.75 ? WALK * (mag / 0.75) : WALK + (JOG - WALK) * ((mag - 0.75) / 0.25);
    speed += (target - speed) * Math.min(1, dt * 8);
    if (wantYaw !== null) yaw += angDiff(yaw, wantYaw) * Math.min(1, dt * 10);
    else if (faceTo && speed < 0.4) {
      const d = angDiff(yaw, Math.atan2(faceTo[0] - player.position.x, faceTo[1] - player.position.z));
      yaw += d * Math.min(1, dt * 5);
      if (Math.abs(d) < 0.03) faceTo = null;
    }
    marker.update(dt);
    const [nx, nz] = collide(player.position.x + Math.sin(yaw) * speed * dt, player.position.z + Math.cos(yaw) * speed * dt);
    player.position.x = nx; player.position.z = nz;
    player.rotation.y = yaw;
    playerBlob.position.set(nx, 0.012, nz);
    const wWalk = speed < WALK ? speed / WALK : Math.max(0, 1 - (speed - WALK) / (JOG - WALK));
    const wJog = speed <= WALK ? 0 : Math.min(1, (speed - WALK) / (JOG - WALK));
    // your reaction after a game: over the idle, until it ends or you move off
    if (react) {
      react.t += dt;
      const len = react.a.getClip().duration * react.reps;
      if (mag > 0.08 || walker.active || react.t >= len) react.out = true;
      react.w = react.out ? Math.max(0, react.w - dt / 0.25) : Math.min(1, react.w + dt / 0.2);
      react.a.setEffectiveWeight(react.w);
      if (react.out && react.w <= 0) { react.a.setEffectiveWeight(0); react = null; }
    }
    // sat at the slot machine: the seat pose (and the pull) over the rest
    seat += (seatWant - seat) * Math.min(1, dt * 6);
    let pullW = 0;
    if (pullT >= 0 && pullA) {
      pullT += dt;
      const len = pullA.getClip().duration;
      pullW = Math.min(1, pullT / 0.12, (len - pullT) / 0.2);
      if (pullT >= len) { pullT = -1; pullW = 0; pullA.setEffectiveWeight(0); }
      else { pullA.time = pullT; pullA.setEffectiveWeight(pullW * seat); }
    }
    if (sitA) sitA.setEffectiveWeight(seat * (1 - pullW));
    const keep = (1 - (react?.w ?? 0)) * (sitA ? 1 - seat : 1);
    idleA.setEffectiveWeight(Math.max(0, 1 - speed / WALK) * keep);
    walkA.setEffectiveWeight(wWalk * keep);
    jogA.setEffectiveWeight(wJog * keep);
    if (newLook) { const ts = Math.max(0.5, speed / (1.7 + 1.3 * wJog)); walkA.timeScale = ts; jogA.timeScale = ts; }
    else { walkA.timeScale = Math.max(0.6, speed / 1.45); jogA.timeScale = Math.max(0.8, speed / 3.2); }
    mixer.update(dt);
    stepNpcs(dt);

    // the room's life: the wheel turns, the toppers pulse, the race runs
    // (the games' own moving parts: ./games3d.ts)
    if (spinAt && gameT >= spinAt) { spinAt = 0; games.wheelKick(5); }
    games.update(dt);
    toppers.forEach((t, i) => t.material.color.setScalar(0.82 + 0.18 * Math.sin(gameT * 4 + i * 1.3)));
    raceAcc += dt;
    if (raceAcc > 1 / 10 && raceM.map === raceT) { raceAcc = 0; drawRaceScreen(raceCv, gameT); raceT.needsUpdate = true; }

    // the camera follows behind him, inside the room (or, playing a game,
    // glides in to the game's close-up)
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) camYaw += angDiff(camYaw, yaw + Math.PI) * Math.min(1, dt * 1.6);
    const cfx = -Math.sin(camYaw), cfz = -Math.cos(camYaw);
    want.set(player.position.x - cfx * 4.6, 2.85, player.position.z - cfz * 4.6);
    wantLook.set(player.position.x + cfx * 2.4, 1.0, player.position.z + cfz * 2.4);
    want.x = Math.max(-ROOM.x + 0.3, Math.min(ROOM.x - 0.3, want.x));
    want.z = Math.max(-ROOM.z + 0.3, Math.min(ROOM.z - 0.35, want.z));
    if (focused) { want.set(...FOCUS[focused].pos); wantLook.set(...FOCUS[focused].look); }
    const glide = focused || glideOut > 0 ? 2.6 : 5;
    if (glideOut > 0) glideOut -= dt;
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; }
    else { camPos.lerp(want, Math.min(1, dt * glide)); camLook.lerp(wantLook, Math.min(1, dt * (glide + 1))); }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    const now: CasinoStation | null = stationAt(player.position.x, player.position.z);
    if (now !== near) {
      near = now;
      cb.onNear(near);
      // you walk up: the croupier spins, the dealer deals
      if (near === "roulette") staffMove("croupier");
      if (near === "blackjack") staffMove("dealer");
    }

    renderer.render(scene, camera);
    drawn++;
    busy = speed > 0.05 || mag > 0.05 || walker.active || orbitHold > 0 || !!faceTo || camPos.distanceToSquared(want) > 1e-4
      || games.busy() || pullT >= 0 || Math.abs(seat - seatWant) > 0.01;
    if (busy) { busyT += dt; stillT = 0; } else { stillT += dt; busyT = 0; }
    if (!opts.fixedStep) {
      if (busy && !capAlways) dyn.frame(performance.now()); else dyn.pause();
      const wantPR = busyT > 0.25 ? movePR() : stillT > 0.5 ? stillPR() : pr;
      if (wantPR !== pr) { pr = wantPR; renderer.setPixelRatio(pr); }
    }
    frames++;
    const nowMs = performance.now();
    if (nowMs - fpsT0 >= 1000) {
      const fps = Math.round((frames * 1000) / (nowMs - fpsT0));
      cb.onFps?.(fps);
      frames = 0; fpsT0 = nowMs;
      if (!opts.fixedStep) {
        slowSeconds = fps < (busy && !capAlways && prof.fpsCap === 60 ? 28 : 22) ? slowSeconds + 1 : 0;
        if (slowSeconds >= 3) { slowSeconds = 0; if (!stepDown()) capAlways = true; }
      }
    }
  });

  const ray = new THREE.Raycaster();
  const aim = (px: number, py: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1), camera);
  };
  const pickStation = (): CasinoStation | null => {
    const hit = ray.intersectObjects(Object.values(groups), true)[0];
    for (let o = hit?.object; o; o = o.parent) if (o.userData?.station) return o.userData.station as CasinoStation;
    return null;
  };
  const ctrl: CasinoController = {
    setStick: (x, y) => { stick = { x, y }; if (Math.hypot(x, y) > 0.05) stopWalk(); },
    orbit: (dx) => { if (focused) return; camYaw -= dx * 0.008; orbitHold = 1.5; },
    pick: (px, py) => { aim(px, py); return pickStation(); },
    tap: (px, py) => {
      if (focused) return null;
      aim(px, py);
      const s = pickStation();
      if (s) {
        // already there: open it now; else walk up and open it on arrival
        if (near === s) { faceTo = STAND[s].face; cb.onArrive?.(s); return { station: s }; }
        walkTo(STAND[s].at, STAND[s].face, () => cb.onArrive?.(s));
        return { station: s };
      }
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (!hit || Math.abs(hit.x) > ROOM.x + 1 || Math.abs(hit.z) > ROOM.z + 1) return null;
      return walkTo([hit.x, hit.z], null) ? { station: null } : null;
    },
    setPaused: (p) => {
      paused = p;
      if (p) { stick = { x: 0, y: 0 }; keys.clear(); stopWalk(); speed = 0; }
      else { first = false; acc = 0; }
    },
    react: (sign) => {
      const a = sign > 0 ? cheerA : sign < 0 ? groanA : null;
      if (!a) return;
      if (react && react.a !== a) react.a.setEffectiveWeight(0);
      a.reset();
      a.setLoop(sign > 0 ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.play();
      a.setEffectiveWeight(0);
      // a win is two bounces of the cheer; a loss is the groan once
      react = { a, t: 0, w: 0, reps: sign > 0 ? 2 : 1, out: false };
      // turn round to the camera so the reaction is seen, not his back
      faceTo = [camPos.x, camPos.z];
    },
    games,
    focus: (gm) => {
      if (gm === focused) return;
      stopWalk(); stick = { x: 0, y: 0 }; keys.clear(); speed = 0;
      const was = focused;
      focused = gm;
      const at = (s: InRoomGame) => {
        const [x, z] = STAND[s].at, [fx, fz] = STAND[s].face;
        player.position.x = x; player.position.z = z;
        yaw = Math.atan2(fx - x, fz - z);
        player.rotation.y = yaw;
        playerBlob.position.set(x, 0.012, z);
      };
      if (gm) {
        at(gm);
        if (gm === "slots" && sitA) {
          // on the stool, facing the machine (where the slot punters sit)
          player.position.x = SLOT_X + 0.85; player.position.z = SLOT_Z[PLAY_SLOT];
          playerBlob.position.set(player.position.x, 0.012, player.position.z);
          yaw = -Math.PI / 2; player.rotation.y = yaw;
          sitA.reset(); sitA.play(); seatWant = 1; seat = 1;
        }
      } else {
        if (was === "slots") { seatWant = 0; seat = 0; pullT = -1; pullA?.setEffectiveWeight(0); sitA?.setEffectiveWeight(0); }
        if (was) {
          at(was);
          if (was === "horses") games.raceEnd();
          // the follow camera picks up from behind where he now faces
          camYaw = yaw + Math.PI; glideOut = 1.2;
        }
      }
    },
    staff: (role) => staffMove(role),
    pull: () => {
      // the lever is all the way down at the clip's `pulled` moment (PULL_AT)
      games.lever(PULL_AT * 2);
      if (pullA && seat > 0.5) { pullA.reset(); pullA.play(); pullA.setEffectiveWeight(0); pullT = 0; }
    },
    place: (x, z, y = yaw) => { stopWalk(); player.position.x = x; player.position.z = z; yaw = y; camYaw = y + Math.PI; first = true; },
    where: () => ({ x: player.position.x, z: player.position.z, yaw, t: gameT }),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), frames: drawn, quality: tier, merged: frozen }),
    dispose: () => {
      disposed = true;
      games.dispose();
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      marker.dispose();
      scene.traverse((o: any) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); });
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      // give the phone its 3D back now (the garden and the casino swap often)
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
  return ctrl;
}
