/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D SHOP — a walk-around showroom (Harry, 1 Oct 2026: "I kinda had a
 * different idea of actually playing a 3d person going shopping"; 2 Oct:
 * "the 3D model of the car and the boots was so bad … take the model that we
 * built and make it bigger").
 *
 * You are a footballer in kit, in a warm, dim showroom with a spotlight on
 * everything for sale: seven boots on plinths, a car on a turntable, a KIB
 * can fridge and a counter with the watches and jewellery in light boxes.
 * Walk up to a display (or tap it) and its card opens — the card is the
 * page's own HTML (components/star/Shop3D.tsx), not drawn here.
 *
 * The boots and cars are the SAME Blender models the shop pictures are
 * rendered from, exported small (tools/shop3d/export_items.py →
 * public/star/shop3d/items/*.glb, Draco-compressed). The watches and
 * jewellery have no 3D model: they are the shop pictures, in light boxes.
 *
 * three.js is the site's own `three` package, loaded only when this opens
 * (a dynamic import, so it is its own chunk and costs nothing anywhere
 * else). The render loop is three's `renderer.setAnimationLoop` on a WebGL
 * canvas; nothing here plays football — there is no ball and no match.
 *
 * The character is CC0: Quaternius' Universal Base Characters body + hair,
 * animated with clips from his Universal Animation Library (same skeleton) —
 * see public/star/shop3d/LICENSE.txt and tools/shop3d/build_assets.py.
 */
import type { Display, DisplayId } from "./catalogue";
import { CAN_COLOURS } from "./catalogue";
import { kitMasks, type V3 } from "./kit";
import { floorCanvas, numberCanvas, labelCanvas, blobCanvas, neonCanvas, poolCanvas } from "./textures";
import { formatMoney } from "../money";
import { loadPeople3d, makePerson3d, dressPerson3d, playerModelFor, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { buildGrid, findPath, TapWalker, makeTapMarker, type WalkGrid, type XZ } from "../tapWalk";
import { makeWalkClip } from "../walkClip";
import { freezeStatic } from "../freezeStatic";
import { TIER_PROFILES, quality3dTier, stepDownTier, shadowSizeFor, type Quality3d } from "../three3d/quality";
import { DynamicResolution, rememberGpu } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { withMocapOwn } from "../three3d/footballAnims";
import { look3dStyle } from "../look3dStyle";
import { dressShopH } from "./hRoom";
import { OrbitCam, CAM_MIN_Y } from "../three3d/orbitCam";

export interface KitColours { shirt: string; trim: string }

export interface ShopCallbacks {
  onNear: (id: DisplayId | null) => void;
  onFps: (fps: number) => void;
  /** He walked out through the shop's open doorway (the bright doors at the
   *  front). Given only in a career: it leads out into the 3D garden (Mikey,
   *  3 Oct 2026). Without it the doorway stays a wall you can't pass. */
  onDoor?: () => void;
  /** The phone took the 3D away (iPhone Safari, short of memory). */
  onContextLost?: () => void;
}

export interface Picked { display: DisplayId; index: number }

export interface ShopController {
  /** Joystick: x right, y forward, each -1..1. */
  setStick: (x: number, y: number) => void;
  setKit: (kit: KitColours) => void;
  /** Which item on a display is picked: its plinth lights up / the car swaps. */
  select: (display: DisplayId, index: number) => void;
  /** Which level of the picked item the card shows (the light boxes swap picture). */
  setLevel: (display: DisplayId, index: number, level: number) => void;
  /** Which item on a display you are standing nearest. */
  nearestItem: (display: DisplayId) => number;
  /** He reaches out — the "buy" gesture. */
  playBuy: () => void;
  /** A card is open: the camera moves in on the picked item. */
  setCardOpen: (open: boolean) => void;
  /** The "Owned" chip on each item's floating tag (item id → text, e.g. "Owned L2"). */
  setOwned: (owned: Record<string, string>) => void;
  /** Drag on the view: left/right swings the camera round, up/down tilts it (lib/star/three3d/orbitCam.ts). */
  orbit: (dxPixels: number, dyPixels?: number) => void;
  /** What is under a tap at (x, y) in page pixels, if anything. */
  pick: (clientX: number, clientY: number) => Picked | null;
  /** Tap to move: a tap on a display walks you up to it (its card opens as
   *  you arrive); on the floor, walks you there. `item`: what was tapped. */
  tap?: (clientX: number, clientY: number) => { item: Picked | null } | null;
  /** Walk up to this display item (its card opens as you arrive). */
  walkToItem?: (p: Picked) => boolean;
  /** For checking: is a tap-walk going on, and where to. */
  walking?: () => { to: [number, number] | null; active: boolean };
  /** For checking: stand him at (x, z), facing yaw (radians). */
  place: (x: number, z: number, yaw?: number) => void;
  /** For checking: where he is. */
  where: () => { x: number; z: number; yaw: number; camYaw: number; t: number };
  /** Filming only: [wall-clock ms, game seconds] for every frame drawn. */
  filmLog: () => [number, number][];
  /** What one frame costs to draw: draw calls and triangles. */
  stats: () => { calls: number; triangles: number; pixelRatio: number; loaded: number; shadowRenders?: number; frames?: number; merged?: { before: number; after: number }; quality?: string };
  dispose: () => void;
}

/** Room: x -6..6, z -8..8 (door at +z). Metres. */
const ROOM = { x: 6, z: 8, h: 3.6 };
const START = { x: -0.5, z: 3.7 };

/** The boots: seven plinths down the west side. */
const PLINTH_X = -4.55;
const PLINTH_Z = [-3.3, -2.2, -1.1, 0, 1.1, 2.2, 3.3];
const PLINTH_H = 0.92;
/** The Blender boot is 0.29 m long; on its plinth it is shown at this size. */
const BOOT_SCALE = 2.75;
/** The car's turntable. */
const CAR = { x: 2.35, z: -1.75, r: 2.85 };
/** The counter and its light boxes on the back wall. */
const COUNTER_Z = -6.45;
const BOX_X = [-3.6, -1.8, 0, 1.8, 3.6];
const BOX_Y = 1.95;
const FRIDGE = { x: 5.4, z: 4.3 };

type Zone = { id: DisplayId; inside: (x: number, z: number) => boolean };
const ZONES: Zone[] = [
  { id: "boots", inside: (x, z) => x < -2.75 && Math.abs(z) < 4.1 },
  { id: "car", inside: (x, z) => Math.hypot(x - CAR.x, z - CAR.z) < CAR.r + 1.05 },
  { id: "cans", inside: (x, z) => Math.hypot(x - FRIDGE.x, z - FRIDGE.z) < 1.75 },
  { id: "counter", inside: (x, z) => z < -4.75 && Math.abs(x) < 3.4 },
];

/** Things you can't walk through: boxes [minX, maxX, minZ, maxZ] and circles [x, z, r]. */
const BOXES: [number, number, number, number][] = [
  [-6, -4.12, -3.85, 3.85], // the plinths
  [4.7, 6, 2.9, 5.7], // fridge
  [-2.8, 2.8, -7.0, -5.9], // counter
  [-6, -5.1, 5.6, 6.6], // plant
  [5.1, 6, -7.6, -6.6], // plant
];
const CIRCLES: [number, number, number][] = [[CAR.x, CAR.z, CAR.r - 0.05]];

const WALK = 1.55; // m/s
const JOG = 3.3;

/** Settings → Look → "3D quality" (lib/star/three3d/quality.ts): Low, Medium or High. */
export type ShopQuality = Quality3d;

export interface ShopOptions {
  quality?: ShopQuality;
  /** Filming only: every drawn frame moves the game on by exactly this many
   *  seconds, however long it took to draw. Off in normal use. */
  fixedStep?: number;
  /** Which footballer walks the shop: "new" (the approved characters, with
   *  your skin, hair and kit; the default) or "old" (the first CC0 body, kept
   *  exactly as it was — Settings → "3D shop player"). */
  player?: ShopPlayer;
  /** Start just inside the front doors, facing in (arriving from the garden). */
  atDoor?: boolean;
  /** The shirt number on his back (your squad number; 10 on the test page). */
  number?: number;
}

/** Your footballer in the shop. Skin and hair are "#rrggbb". */
export interface ShopPlayer {
  look: "new" | "old";
  skin?: string;
  hair?: string;
  hairStyle?: "short" | "long" | "buzz" | "none";
}

/** The doorway in the front (south) wall: x between ±DOOR_HALF. */
const DOOR_HALF = 1.1;

/**
 * Opens the shop. If anything fails part-way, the half-built 3D is thrown away
 * properly before the error goes up, so the retry with the old body (and the
 * garden after it) doesn't leave a dead WebGL context behind on an iPhone.
 */
export async function startShop(
  container: HTMLElement, cb: ShopCallbacks, kit0: KitColours,
  displays: Record<DisplayId, Display>, opts: ShopOptions = {},
): Promise<ShopController> {
  const own: { renderer?: any } = {};
  try {
    return await buildShop(container, cb, kit0, displays, opts, own);
  } catch (e) {
    const r = own.renderer;
    if (r) { try { r.setAnimationLoop(null); r.dispose(); r.forceContextLoss(); r.domElement.remove(); } catch { /* already gone */ } }
    throw e;
  }
}

async function buildShop(
  container: HTMLElement, cb: ShopCallbacks, kit0: KitColours,
  displays: Record<DisplayId, Display>, opts: ShopOptions, own: { renderer?: any },
): Promise<ShopController> {
  // 3D quality: one tier, chosen before the renderer (Settings, else Auto).
  // High is the New look exactly as it was on 5 Oct 2026.
  let tier: Quality3d = opts.quality ?? quality3dTier();
  let prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { DRACOLoader }: any = await import("three/examples/jsm/loaders/DRACOLoader.js");
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const { mergeGeometries, toCreasedNormals }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
  own.renderer = renderer;
  rememberGpu(renderer);
  // LAG (Harry, 5 Oct 2026): the tier's still cap standing still (High 1.5x
  // a CSS pixel), its moving cap while walking (High 1x: 2.25x fewer pixels
  // while the picture moves), and dynamic resolution a little below that
  // while walking if frames are slow.
  const dpr = window.devicePixelRatio || 1;
  // look H standing still: the screen's real pixels, capped per tier; moving stays the tier's cap (lag)
  const STILL_H: Record<string, number> = { low: 1.25, medium: 2, high: 2.5 };
  const stillPR = () => Math.min(dpr, look3dStyle() === "h" ? Math.max(prof.maxPixelRatio, STILL_H[tier] ?? 1.5) : prof.maxPixelRatio);
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
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  const BG = "#120e0b";
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 22, 42);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.32;
  // Settings → Look → "3D look: H": the broadcast pass indoors (Old: exactly as before)
  const hEnh = look3dStyle() === "h" ? (await import("../style3d/real/enhance")).enhanceH(THREE, renderer, scene, tier, "indoor", { exposure: 1.1 }) : null;

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 60);
  let disposed = false;

  // ── Light: a warm, dim room; a spotlight on everything for sale ──
  scene.add(new THREE.HemisphereLight("#ffe8cf", "#2a1a10", 0.55));
  const fill = new THREE.DirectionalLight("#ffe4c4", 0.45);
  fill.position.set(-2, 6, 9);
  scene.add(fill);
  const spot = (colour: string, power: number, x: number, y: number, z: number, tx: number, ty: number, tz: number, angle: number, pen = 0.55, dist = 9) => {
    const s = new THREE.SpotLight(colour, power, dist, angle, pen, 2);
    s.position.set(x, y, z);
    s.target.position.set(tx, ty, tz);
    scene.add(s, s.target);
    return s;
  };
  const carSpot = spot("#fff3e4", 150, CAR.x + 0.3, ROOM.h - 0.08, CAR.z + 0.6, CAR.x, 0, CAR.z, 0.72, 0.5, 12);
  carSpot.castShadow = prof.shadows;
  // its shadow is drawn again only while something under it moves (the
  // turntable, a few times a second; you walking near it)
  carSpot.shadow.autoUpdate = false;
  const CAR_MAP = 1024; // High: the full map; Medium: half (shadowSizeFor)
  carSpot.shadow.mapSize.set(shadowSizeFor(prof, CAR_MAP) || CAR_MAP, shadowSizeFor(prof, CAR_MAP) || CAR_MAP);
  carSpot.shadow.bias = -0.0004;
  carSpot.shadow.normalBias = 0.03;
  carSpot.shadow.camera.near = 0.5;
  carSpot.shadow.camera.far = 8;
  // LAG (7 Oct 2026): six spotlights meant every lit pixel in the room worked
  // out six lights. The New shop keeps two real ones (the car's, with its
  // shadow, and ONE wide light along the boot plinths; Low keeps only the
  // car's) and paints the other pools on as soft glows that cost almost
  // nothing. The Old shop player (Settings → "3D shop player: Old") keeps the
  // six, exactly as before.
  const fewLights = (opts.player?.look ?? "new") === "new";
  const pools: any[] = [];
  const canvasTexOf = (cv: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  if (!fewLights) {
    spot("#d9e8ff", 45, CAR.x + 3.2, ROOM.h - 0.1, CAR.z + 3.0, CAR.x, 0.6, CAR.z, 0.55, 0.7, 10); // a cool kicker on the paint
    for (const z of [-2.2, 0, 2.2]) spot("#ffdcae", 70, -2.7, ROOM.h - 0.08, z, PLINTH_X, PLINTH_H, z, 0.62, 0.55, 8);
    spot("#ffe6c2", 70, 0, ROOM.h - 0.08, -4.4, 0, 1.2, COUNTER_Z - 0.6, 1.0, 0.6, 9);
  } else {
    // one wide warm light down the plinth row in place of three (not on Low)
    if (tier !== "low") spot("#ffdcae", 125, -2.6, ROOM.h - 0.08, 0, PLINTH_X, PLINTH_H, 0, 0.98, 0.7, 10);
    const poolT = canvasTexOf(poolCanvas(1.25));
    const roundT = canvasTexOf(poolCanvas(1));
    const pool = (t: any, colour: string, strength: number, w: number, h: number, x: number, y: number, z: number, rx: number, ry: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
        map: t, color: new THREE.Color(colour).multiplyScalar(strength), transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, fog: false,
      }));
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, 0);
      m.renderOrder = 1;
      scene.add(m);
      pools.push(m);
      return m;
    };
    // the three scallops of light up the wall behind the boots
    for (const z of [-2.2, 0, 2.2]) pool(poolT, "#ffcf98", tier === "low" ? 0.42 : 0.3, 2.3, 2.9, -ROOM.x + 0.13, 1.75, z, 0, Math.PI / 2);
    // the wash on the back wall over the counter, and its spill on the floor
    pool(poolT, "#ffd9a8", 0.3, 6.4, 3.2, 0, 1.75, -ROOM.z + 0.13, 0, 0);
    pool(roundT, "#ffd9a8", 0.12, 4.6, 3.0, 0, 0.012, COUNTER_Z + 1.4, -Math.PI / 2, 0);
    // on Low, the plinth row's floor glow too (its light is gone)
    if (tier === "low") pool(roundT, "#ffcf98", 0.14, 2.6, 7.6, PLINTH_X + 1.6, 0.012, 0, -Math.PI / 2, 0);
  }

  // ── Materials and helpers ──
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, ...o });
  const glow = (c: string, i = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  const canvasTex = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, shadow = false) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.receiveShadow = true;
    me.castShadow = shadow;
    scene.add(me);
    return me;
  };
  const neon = (text: string, ink: string, w: number, x: number, y: number, z: number, ry: number) => {
    const cv = neonCanvas(text, ink);
    const t = canvasTex(cv);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, (w * cv.height) / cv.width),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };
  const blobT = canvasTex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, parent: any = scene, y = 0.012, opacity = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.renderOrder = 1;
    parent.add(m);
    return m;
  };

  // ── The room ──
  const floorT = canvasTex(floorCanvas());
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  floorT.repeat.set(4, 5.3);
  // dark polished boards: low roughness, so the lights sheen across them
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), mat("#6e4c35", { map: floorT, roughness: 0.3, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallM = mat("#2e2620", { roughness: 0.92 });
  const panelM = mat("#3b2c22", { roughness: 0.6 });
  const trimM = mat("#c79a4b", { roughness: 0.35, metalness: 0.8 });
  // back (north), west, east walls
  box(ROOM.x * 2, ROOM.h, 0.1, wallM, 0, ROOM.h / 2, -ROOM.z);
  box(0.1, ROOM.h, ROOM.z * 2, wallM, -ROOM.x, ROOM.h / 2, 0);
  box(0.1, ROOM.h, ROOM.z * 2, wallM, ROOM.x, ROOM.h / 2, 0);
  // south wall with the door gap (2.4 wide, 2.6 high)
  box(ROOM.x - 1.2, ROOM.h, 0.1, wallM, -(ROOM.x + 1.2) / 2, ROOM.h / 2, ROOM.z);
  box(ROOM.x - 1.2, ROOM.h, 0.1, wallM, (ROOM.x + 1.2) / 2, ROOM.h / 2, ROOM.z);
  box(2.4, ROOM.h - 2.6, 0.1, wallM, 0, 2.6 + (ROOM.h - 2.6) / 2, ROOM.z);
  // walnut panelling, a gold rail and a warm cove light round the walls
  box(0.05, 1.1, ROOM.z * 2 - 0.2, panelM, -ROOM.x + 0.08, 0.55, 0);
  box(0.05, 1.1, ROOM.z * 2 - 0.2, panelM, ROOM.x - 0.08, 0.55, 0);
  box(ROOM.x * 2 - 0.2, 1.1, 0.05, panelM, 0, 0.55, -ROOM.z + 0.08);
  box(0.06, 0.03, ROOM.z * 2 - 0.2, trimM, -ROOM.x + 0.1, 1.12, 0);
  box(0.06, 0.03, ROOM.z * 2 - 0.2, trimM, ROOM.x - 0.1, 1.12, 0);
  box(ROOM.x * 2 - 0.2, 0.03, 0.06, trimM, 0, 1.12, -ROOM.z + 0.1);
  box(0.04, 0.04, ROOM.z * 2 - 0.3, glow("#ffb867", 2.2), -ROOM.x + 0.12, ROOM.h - 0.25, 0);
  box(0.04, 0.04, ROOM.z * 2 - 0.3, glow("#ffb867", 2.2), ROOM.x - 0.12, ROOM.h - 0.25, 0);
  box(ROOM.x * 2 - 0.3, 0.04, 0.04, glow("#ffb867", 2.2), 0, ROOM.h - 0.25, -ROOM.z + 0.12);
  // daylight outside the door, and the glass doors standing open
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: "#d9e6f5" }));
  outside.position.set(0, 1.6, ROOM.z + 1.2);
  outside.rotation.y = Math.PI;
  scene.add(outside);
  const glassM = new THREE.MeshStandardMaterial({ color: "#a9c8e6", transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false });
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.5, 0.04), glassM);
    d.position.set(s * 1.55, 1.25, ROOM.z - 0.45);
    d.rotation.y = s * 1.2;
    scene.add(d);
  }
  // a dark ceiling with round downlights
  box(ROOM.x * 2, 0.08, ROOM.z * 2, mat("#1f1813", { roughness: 0.9, emissive: "#0d0906", emissiveIntensity: 1 }), 0, ROOM.h, 0);
  const downG = new THREE.CircleGeometry(0.11, 20);
  const downM = glow("#fff1d6", 3);
  for (const [x, z] of [[-2.7, -2.2], [-2.7, 0], [-2.7, 2.2], [0, -4.4], [CAR.x + 0.3, CAR.z + 0.6], [CAR.x + 3.2, CAR.z + 3.0],
    [-1.5, 4.5], [1.8, 4.5], [-1.2, 1.2], [4.2, 3.0]] as [number, number][]) {
    const d = new THREE.Mesh(downG, downM);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, ROOM.h - 0.045, z);
    scene.add(d);
  }
  // a runner up the middle
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 7.5), mat("#4a1c1f", { roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-1.0, 0.006, 3.6);
  rug.receiveShadow = true;
  scene.add(rug);
  const rugEdge = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 7.6), mat("#b88a3e", { roughness: 0.6, metalness: 0.4 }));
  rugEdge.rotation.x = -Math.PI / 2;
  rugEdge.position.set(-1.0, 0.004, 3.6);
  scene.add(rugEdge);
  // plants in brass pots
  const plant = (x: number, z: number) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.6, 20), mat("#b58a45", { roughness: 0.35, metalness: 0.7 }));
    pot.position.set(x, 0.3, z);
    pot.castShadow = true;
    scene.add(pot);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), mat("#2d5a33", { flatShading: true, roughness: 0.8 }));
    leaves.position.set(x, 1.2, z);
    leaves.scale.set(1, 1.45, 1);
    leaves.castShadow = true;
    scene.add(leaves);
    blob(1.1, 1.1, x, z);
  };
  plant(-5.5, 6.1);
  plant(5.5, -7.1);
  // Look H: parquet, panelling, coffers, practical lights, lit wall units (./hRoom.ts); Old: as before
  const hRoom = hEnh ? await dressShopH(THREE, scene, renderer, ROOM, { floor, wallM, panelM, tier }).catch((e) => { console.error("shop look H room failed", e); return null; }) : null;

  // ── Floating price tags ──
  type Tag = { sprite: any; tex: any; key: string; base: [number, number, number]; display: DisplayId; index: number };
  const tags: Tag[] = [];
  let owned: Record<string, string> = {};
  const fromPrice = (display: DisplayId, index: number) => {
    const it = displays[display].items[index];
    const p = Math.min(...it.levels.map((l) => l.price));
    return `${it.levels.length > 1 ? "from " : ""}★${formatMoney(p)}`;
  };
  const tagText = (display: DisplayId, index: number) => {
    const it = displays[display].items[index];
    return { name: display === "cans" ? "KIB Cans" : it.name, price: fromPrice(display, index), tag: owned[it.id] ?? null };
  };
  const makeTag = (display: DisplayId, index: number, x: number, y: number, z: number, w = 1.05) => {
    const t = tagText(display, index);
    const tex = canvasTex(labelCanvas(t.name, t.price, t.tag));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
    sp.scale.set(w, (w * 168) / 512, 1);
    sp.position.set(x, y, z);
    sp.renderOrder = 5;
    scene.add(sp);
    const tg: Tag = { sprite: sp, tex, key: JSON.stringify(t), base: [x, y, z], display, index };
    tags.push(tg);
    return tg;
  };
  const redrawTags = () => {
    for (const tg of tags) {
      const t = tagText(tg.display, tg.index);
      const key = JSON.stringify(t);
      if (key === tg.key) continue;
      tg.key = key;
      tg.tex.image = labelCanvas(t.name, t.price, t.tag);
      tg.tex.needsUpdate = true;
    }
  };

  // things a tap can pick: mesh -> which item
  const pickables: any[] = [];
  const pickable = (o: any, display: DisplayId, index: number) => {
    o.traverse((c: any) => { if (c.isMesh) { c.userData.pick = { display, index }; pickables.push(c); } });
  };

  // ── The loaders ──
  const draco = new DRACOLoader();
  draco.setDecoderPath("/star/shop3d/draco/");
  draco.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco); // boots and cars
  await withMeshopt(loader); // people, clips, the old player (scripts/perf3d/shrink-models.mjs)
  let loaded = 0;
  /**
   * THE CARS AND BOOTS LOOKED ODD (Harry, 9 Oct 2026: "the cars and boots still
   * look odd in the shop"). Three causes, all in how the files are drawn:
   *  1. Every face was exported smooth (tools/shop3d/export_items.py sets
   *     use_smooth on all of them after cutting the triangle count down), so
   *     the panel lines, wheel arches, sole edge and studs melt into one soft
   *     blob, like clay. Normals are worked out again with a crease: faces
   *     meeting at more than CREASE stay sharp, curved panels stay smooth.
   *  2. The paint never reflected the room: without its own environment a
   *     material takes the scene's, at environmentIntensity 0.32, so a car
   *     with a full clear coat read as matte plastic. Each item now has the
   *     room's reflection at full strength (boots a little less).
   *  3. The clear coat is mirror-smooth (roughness 0.05): the turntable's
   *     spotlights made a pin-point hot spot that the H look's bloom blew into
   *     a white smear across the bonnet. The coat is a touch less sharp, so
   *     the highlight is a shine, not a flare.
   * Look H only (Settings → Look → "3D look"); Old draws them exactly as before.
   */
  const CREASE = (38 * Math.PI) / 180;
  const showroomFinish = (o: any, car: boolean) => {
    if (o.geometry && !o.geometry.userData.creased) {
      const g2 = toCreasedNormals(o.geometry, CREASE);
      g2.userData.creased = true;
      o.geometry.dispose();
      o.geometry = g2;
    }
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.isMeshStandardMaterial) continue;
      m.envMap = envTex;
      m.envMapIntensity = car ? 1.0 : 0.7;
      if (m.clearcoat > 0) m.clearcoatRoughness = Math.max(m.clearcoatRoughness ?? 0, car ? 0.14 : 0.2);
      if (m.roughness < 0.12) m.roughness = 0.12; // glass and chrome: still glossy, no pin-point flare
      m.needsUpdate = true;
    }
  };
  const models = new Map<string, Promise<any>>();
  const loadModel = (url: string) => {
    if (!models.has(url)) {
      models.set(url, loader.loadAsync(url).then((g: any) => {
        loaded++;
        g.scene.traverse((o: any) => {
          if (!o.isMesh) return;
          o.castShadow = true;
          o.receiveShadow = true;
          const m = o.material;
          if (m) { m.envMapIntensity = 1.4; if (m.map) m.map.anisotropy = 4; }
          if (hEnh) showroomFinish(o, /\/car-/.test(url));
        });
        return g.scene;
      }));
    }
    return models.get(url)!;
  };

  // ── The boots, one on each plinth ──
  const plinthTopM = mat("#e9e1d3", { roughness: 0.25, metalness: 0.0 });
  // look H: the spot above blew the cream top into a white glow the boot floated on; a stone grey, less glossy
  if (hEnh) { plinthTopM.color.set("#9a9186"); plinthTopM.roughness = 0.55; }
  const plinthM = mat("#1c1714", { roughness: 0.32, metalness: 0.25 });
  box(1.1, 0.04, 8.0, mat("#100c0a", { roughness: 0.25, metalness: 0.3 }), PLINTH_X, 0.02, 0); // a dark stage under the row
  box(0.06, 2.6, 8.2, mat("#211915", { roughness: 0.55 }), -ROOM.x + 0.14, 1.85, 0); // a dark wall panel behind
  neon("BOOTS", "#ffb347", 2.6, -ROOM.x + 0.2, 2.9, 0, Math.PI / 2);
  const bootSlots: { group: any; ring: any; tag: Tag; z: number; spin: number }[] = [];
  const ringG = new THREE.TorusGeometry(0.395, 0.012, 8, 48);
  displays.boots.items.forEach((it, i) => {
    const z = PLINTH_Z[i] ?? i;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, PLINTH_H, 32), plinthM);
    col.position.set(PLINTH_X, PLINTH_H / 2, z);
    col.castShadow = true;
    col.receiveShadow = true;
    scene.add(col);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.035, 32), plinthTopM);
    top.position.set(PLINTH_X, PLINTH_H + 0.017, z);
    top.receiveShadow = true;
    scene.add(top);
    const ring = new THREE.Mesh(ringG, glow(it.colour, 0.9));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(PLINTH_X, PLINTH_H + 0.002, z);
    scene.add(ring);
    blob(0.95, 0.95, PLINTH_X, z);
    const group = new THREE.Group();
    group.position.set(PLINTH_X, PLINTH_H + 0.035, z);
    group.scale.setScalar(BOOT_SCALE);
    scene.add(group);
    blob(0.32, 0.18, 0, 0, group, 0.002, 0.8);
    pickable(col, "boots", i);
    const tag = makeTag("boots", i, PLINTH_X + 0.15, PLINTH_H + 0.78, z, 0.98);
    pickable(tag.sprite, "boots", i);
    bootSlots.push({ group, ring, tag, z, spin: i * 0.9 });
    if (it.model) {
      loadModel(it.model).then((m) => {
        if (disposed) return;
        const b = m.clone();
        group.add(b);
        pickable(b, "boots", i);
      }).catch((e) => console.error("boot model", e));
    }
  });

  // ── The car on its turntable ──
  const table = new THREE.Group();
  table.position.set(CAR.x, 0, CAR.z);
  scene.add(table);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(CAR.r, CAR.r + 0.05, 0.12, 64), mat("#1a1715", { metalness: 0.55, roughness: 0.25 }));
  disc.position.y = 0.06;
  disc.receiveShadow = true;
  table.add(disc);
  const discTop = new THREE.Mesh(new THREE.CircleGeometry(CAR.r - 0.12, 64), mat("#2a2420", { metalness: 0.3, roughness: 0.35 }));
  discTop.rotation.x = -Math.PI / 2;
  discTop.position.y = 0.122;
  discTop.receiveShadow = true;
  table.add(discTop);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(CAR.r + 0.02, 0.022, 6, 96), glow("#ffc46b", 2.4));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.125;
  table.add(ring);
  pickable(disc, "car", 0);
  const carHolder = new THREE.Group();
  carHolder.position.y = 0.124;
  table.add(carHolder);
  blob(5.6, 2.9, 0, 0, carHolder, 0.004, 0.95);
  let carIndex = -1;
  let carWant = 0;
  let carPop = 1; // grows the new car in
  const carTag = makeTag("car", 0, CAR.x, 2.35, CAR.z, 1.3);
  pickable(carTag.sprite, "car", 0);
  const showCar = (i: number) => {
    carWant = i;
    const it = displays.car.items[i];
    if (!it?.model) return;
    loadModel(it.model).then((m) => {
      if (disposed || carWant !== i || carIndex === i) return;
      carIndex = i;
      for (const c of [...carHolder.children]) if (c.userData.car) carHolder.remove(c);
      const c = m.clone();
      c.userData.car = true;
      carHolder.add(c);
      pickable(c, "car", i);
      carPop = 0;
      carTag.index = i;
      redrawTags();
    }).catch((e) => console.error("car model", e));
  };
  neon("MOTORS", "#7fd4ff", 2.4, ROOM.x - 0.08, 2.85, CAR.z, -Math.PI / 2);

  // ── The KIB fridge (east, by the door) ──
  const fx = FRIDGE.x, fz = FRIDGE.z;
  box(1.1, 2.3, 2.6, mat("#d9dde2", { roughness: 0.3, metalness: 0.4 }), fx + 0.05, 1.15, fz, true);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.9), glow("#f0f8ff", 1.0));
  inside.position.set(fx - 0.15, 1.2, fz);
  inside.rotation.y = -Math.PI / 2;
  scene.add(inside);
  const canG = new THREE.CylinderGeometry(0.05, 0.05, 0.17, 16);
  const PER = 9;
  const cansMesh = new THREE.InstancedMesh(canG, mat("#ffffff", { roughness: 0.25, metalness: 0.75 }), 3 * 3 * PER);
  const tmp = new THREE.Object3D();
  let ci = 0;
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 0.55 + shelf * 0.55;
    box(0.5, 0.025, 2.3, mat("#cfd6de", { roughness: 0.2, metalness: 0.5 }), fx - 0.4, y - 0.1, fz);
    for (let col = 0; col < 3; col++) {
      for (let k = 0; k < PER; k++) {
        tmp.position.set(fx - 0.55 + (k % 3) * 0.11, y, fz - 1.0 + col * 0.75 + Math.floor(k / 3) * 0.11);
        tmp.updateMatrix();
        cansMesh.setMatrixAt(ci, tmp.matrix);
        cansMesh.setColorAt(ci, new THREE.Color(CAN_COLOURS[col]));
        ci++;
      }
    }
  }
  scene.add(cansMesh);
  pickable(cansMesh, "cans", 0);
  const fridgeGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), glassM);
  fridgeGlass.position.set(fx - 0.52, 1.2, fz);
  fridgeGlass.rotation.y = -Math.PI / 2;
  scene.add(fridgeGlass);
  neon("KIB CANS", "#ff8a1f", 2.0, fx - 0.52, 2.6, fz, -Math.PI / 2);
  pickable(makeTag("cans", 0, fx - 1.0, 2.05, fz, 1.0).sprite, "cans", 0);
  blob(1.6, 3.0, fx, fz);

  // ── The counter, and the watches and jewellery in light boxes behind it ──
  box(5.4, 1.0, 0.95, mat("#e8e0d2", { roughness: 0.35 }), 0, 0.5, COUNTER_Z, true);
  box(5.5, 0.05, 1.05, mat("#1d1814", { roughness: 0.2, metalness: 0.5 }), 0, 1.02, COUNTER_Z);
  box(5.4, 0.04, 0.02, glow("#ffcf6e", 2.5), 0, 0.2, COUNTER_Z + 0.49);
  box(0.42, 0.3, 0.32, mat("#1a1d24"), 2.1, 1.2, COUNTER_Z - 0.05, true);
  box(0.36, 0.22, 0.02, glow("#5ce1a1", 1.4), 2.1, 1.4, COUNTER_Z + 0.12);
  blob(6.2, 1.6, 0, COUNTER_Z);
  neon("KNOWITBALL", "#ffd27a", 4.2, 0, 3.05, -ROOM.z + 0.12, 0);
  const texLoader = new THREE.TextureLoader();
  const boxM: any[] = [];
  const boxLevel: number[] = [];
  const frameM = mat("#c79a4b", { roughness: 0.3, metalness: 0.85 });
  displays.counter.items.forEach((it, i) => {
    const x = BOX_X[i] ?? 0;
    const zb = -ROOM.z + 0.16;
    box(1.32, 1.06, 0.06, frameM, x, BOX_Y, zb);
    // the light box: a warm white panel the picture sits on
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.96), new THREE.MeshBasicMaterial({ color: "#f3ead9", toneMapped: false }));
    panel.position.set(x, BOX_Y, zb + 0.035);
    scene.add(panel);
    const pm = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, color: "#ffffff" });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), pm);
    pic.position.set(x, BOX_Y, zb + 0.04);
    scene.add(pic);
    boxM.push(pm);
    boxLevel.push(0);
    pickable(panel, "counter", i);
    pickable(pic, "counter", i);
    pickable(makeTag("counter", i, x, BOX_Y + 0.78, zb + 0.35, 1.0).sprite, "counter", i);
  });
  const showPicture = (i: number, level: number) => {
    const it = displays.counter.items[i];
    if (!it?.picture || boxLevel[i] === level) return;
    boxLevel[i] = level;
    texLoader.load(it.picture(level), (t: any) => {
      if (disposed || boxLevel[i] !== level) { t.dispose(); return; }
      t.colorSpace = THREE.SRGBColorSpace;
      const old = boxM[i].map;
      boxM[i].map = t;
      boxM[i].needsUpdate = true;
      old?.dispose?.();
    });
  };
  displays.counter.items.forEach((_, i) => showPicture(i, 3));

  // ── The footballer ──
  const newLook = (opts.player?.look ?? "new") === "new";
  let player: any;
  let mixer: any;
  let idleA: any, walkA: any, jogA: any, buyA: any;
  let person: Person3D | null = null;
  const kitU = {
    uShirt: { value: new THREE.Color(kit0.shirt) },
    uTrim: { value: new THREE.Color(kit0.trim) },
    uBoot: { value: new THREE.Color("#141416") },
    uNum: { value: canvasTex(numberCanvas(opts.number ?? 10, "#ffffff")) },
    uPelvis: { value: new THREE.Vector3() },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uRight: { value: new THREE.Vector3(1, 0, 0) },
    uFwd: { value: new THREE.Vector3(0, 0, 1) },
  };
  const dressNew = (k: KitColours) => {
    if (!person) return;
    dressPerson3d(THREE, person, {
      skin: opts.player?.skin ?? "#c68642", hair: opts.player?.hair ?? "#2b1b12",
      kit: k, number: kitU.uNum.value,
    });
  };
  if (newLook) {
    // The approved character (people3d.ts): your skin, hair and kit. There is
    // no walk clip: the jog, slowed down, is the walk. The jog has its travel
    // taken out, so the body moves only where the stick moves it.
    const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
    const model = playerModelFor(opts.player?.hairStyle);
    // The body: the one body (Settings → Look → "3D people: New") or the old one.
    const [g, a] = await Promise.all([loadPeople3d(loader, model, people3dLook()), loadPeople3d(loader, "anims")]);
    person = makePerson3d(THREE, SkeletonUtils as any, g, a, { outline: prof.outlines ? 0.006 : 0, castShadow: true });
    player = person.root;
    mixer = person.mixer;
    idleA = person.actions.idle;
    // a real walk (the jog pulled back towards standing: lib/star/walkClip.ts)
    walkA = mixer.clipAction(makeWalkClip(THREE, person.actions.jog.getClip(), person.actions.idle.getClip()));
    walkA.play(); walkA.setEffectiveWeight(0);
    jogA = person.actions.jog;
    buyA = person.actions.celebrate;
    dressNew(kit0);
    relaxHands(THREE, person);
  } else {
    const [charGltf, animGltf] = await Promise.all([
      loader.loadAsync("/star/shop3d/character.glb"),
      loader.loadAsync("/star/shop3d/anims.glb").then((g: any) => withMocapOwn(loader, g, "ual")),
    ]);
    player = charGltf.scene;
    player.traverse((o: any) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.isSkinnedMesh && o.material?.name === "Skin") dressInKit(THREE, o, kitU);
      // the pack's hair texture is grey: tint it dark brown (eyebrows share it)
      if (o.material?.name === "Hair") o.material.color.set("#4a2e1c");
    });
    mixer = new THREE.AnimationMixer(player);
    const clip = (n: string) => animGltf.animations.find((a: any) => a.name === n);
    const act = (n: string) => {
      const a = mixer.clipAction(clip(n));
      a.play();
      a.setEffectiveWeight(0);
      return a;
    };
    idleA = act("Idle_Loop");
    walkA = act("Walk_Loop");
    jogA = act("Jog_Fwd_Loop");
    buyA = mixer.clipAction(clip("Interact"));
  }
  // from the garden: a few steps in from the doors, so the camera fits behind
  const start = opts.atDoor ? { x: 0, z: ROOM.z - 3.4 } : START;
  player.position.set(start.x, 0, start.z);
  player.rotation.y = Math.PI; // facing into the shop (-z)
  scene.add(player);
  const playerBlob = blob(0.9, 0.9, start.x, start.z, scene, 0.014, 0.9);
  for (const a of [idleA, walkA, jogA]) a.setEffectiveWeight(0);
  idleA.setEffectiveWeight(1);
  buyA.setLoop(THREE.LoopOnce, 1);
  buyA.clampWhenFinished = false;
  let buying = 0; // seconds left of the buy gesture

  hRoom?.bakeReflections();

  // ── State ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0;
  let yaw = Math.PI; // facing
  let camYaw = 0; // camera looks along -z at 0
  let orbitHold = 0;
  const orb = new OrbitCam(); // the look-around drag, eased (shared with the garden)
  let near: DisplayId | null = null;
  let frames = 0, fpsT0 = performance.now(), slowSeconds = 0;
  let gameT = 0;
  let framed = false, frame = 0;
  let sel: { display: DisplayId; index: number } = { display: "car", index: 0 };
  const filmLog: [number, number][] = [];
  let lastOff = -1; // the camera's view offset, in pixels
  // tap to move (lib/star/tapWalk.ts)
  const walker = new TapWalker();
  const marker = makeTapMarker(THREE, scene);
  let grid: WalkGrid | null = null;
  let faceTo: XZ | null = null;
  const stopWalk = () => { if (walker.active) { walker.cancel(); marker.fade(); } faceTo = null; };

  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) return;
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
    // a tall phone screen sees more of the room with a wider lens
    camera.fov = w / h < 0.7 ? 60 : 54;
    lastOff = -1;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  const angDiff = (a: number, b: number) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };

  let leftByDoor = false;
  const collide = (x: number, z: number) => {
    const r = 0.32;
    x = Math.max(-ROOM.x + r, Math.min(ROOM.x - r, x));
    // the front doorway leads outside when there is somewhere to go
    const inDoor = !!cb.onDoor && Math.abs(x) < DOOR_HALF - 0.15;
    z = Math.max(-ROOM.z + r, Math.min(inDoor ? ROOM.z + 0.9 : ROOM.z - 0.4, z));
    if (inDoor && z > ROOM.z + 0.25 && !leftByDoor) { leftByDoor = true; cb.onDoor?.(); }
    for (const [x0, x1, z0, z1] of BOXES) {
      if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) {
        const push = [x - (x0 - r), x1 + r - x, z - (z0 - r), z1 + r - z];
        const m = Math.min(...push);
        if (m === push[0]) x = x0 - r; else if (m === push[1]) x = x1 + r; else if (m === push[2]) z = z0 - r; else z = z1 + r;
      }
    }
    for (const [cx, cz, cr] of CIRCLES) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < cr + r && d > 1e-6) { x = cx + (dx / d) * (cr + r); z = cz + (dz / d) * (cr + r); }
    }
    return [x, z];
  };

  /** Where the camera goes, and looks, to show the picked item close up. */
  const focusShot = (): { cam: [number, number, number]; look: [number, number, number] } => {
    const { display, index } = sel;
    if (display === "boots") {
      const z = PLINTH_Z[index] ?? 0;
      const side = z > 2.5 ? -1 : 1;
      return { cam: [-1.95, 2.05, z + side * 1.55], look: [PLINTH_X, PLINTH_H + 0.22, z + side * 0.1] };
    }
    if (display === "car") {
      // from wherever he is standing, three-quarters on and a bit high
      let a = Math.atan2(player.position.x - CAR.x, player.position.z - CAR.z) + 0.55;
      if (!isFinite(a)) a = 0.6;
      const d = 7.4;
      let cx = CAR.x + Math.sin(a) * d, cz = CAR.z + Math.cos(a) * d;
      cx = Math.max(-ROOM.x + 0.4, Math.min(ROOM.x - 0.4, cx));
      cz = Math.max(-ROOM.z + 0.4, Math.min(ROOM.z - 0.4, cz));
      return { cam: [cx, 2.9, cz], look: [CAR.x, 0.35, CAR.z] };
    }
    if (display === "counter") {
      const x = BOX_X[index] ?? 0;
      return { cam: [x * 0.7, 1.75, -4.15], look: [x, BOX_Y - 0.1, -ROOM.z] };
    }
    return { cam: [2.6, 1.8, FRIDGE.z + 0.9], look: [FRIDGE.x, 1.2, FRIDGE.z] };
  };

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const want = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  let first = true;

  /** Somewhere he can stand (for the tap-walk's path), with a little room. */
  const isFree = (x: number, z: number) => {
    const r = 0.4;
    if (Math.abs(x) > ROOM.x - r || z < -ROOM.z + r || z > ROOM.z - 0.45) return false;
    for (const [x0, x1, z0, z1] of BOXES) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
    for (const [cx, cz, cr] of CIRCLES) if (Math.hypot(x - cx, z - cz) < cr + r) return false;
    return true;
  };
  /** Where to stand for each display item (inside its zone, so its card opens), and what to look at. */
  const standFor = (p: Picked): { at: XZ; face: XZ } => {
    if (p.display === "boots") { const z = PLINTH_Z[p.index] ?? 0; return { at: [-3.35, z], face: [PLINTH_X, z] }; }
    if (p.display === "counter") { const x = BOX_X[p.index] ?? 0; return { at: [Math.max(-3.2, Math.min(3.2, x)), -5.15], face: [x, -ROOM.z] }; }
    if (p.display === "cans") return { at: [FRIDGE.x - 1.35, FRIDGE.z], face: [FRIDGE.x, FRIDGE.z] };
    // the car: the nearest side of the turntable to where he is
    let a = Math.atan2(player.position.x - CAR.x, player.position.z - CAR.z);
    if (!isFinite(a)) a = 0;
    const d = CAR.r + 0.55;
    return { at: [CAR.x + Math.sin(a) * d, CAR.z + Math.cos(a) * d], face: [CAR.x, CAR.z] };
  };
  const walkTo = (to: XZ, face: XZ | null) => {
    grid ??= buildGrid(-ROOM.x, ROOM.x, -ROOM.z, ROOM.z, 0.25, isFree);
    const path = findPath(grid, [player.position.x, player.position.z], to);
    if (!path) return false;
    faceTo = null;
    walker.go(path, { onArrive: () => { marker.fade(); faceTo = face; } });
    const g = path[path.length - 1];
    marker.show(g[0], g[1], 0.02);
    orbitHold = 0;
    return true;
  };

  // LAG: still is 30 frames a second at full pixels; walking, every frame at
  // fewer pixels. The car's shadow is redrawn only as the turntable turns
  // (ten times a second) or when you move near it.
  let acc = 0, busy = true, busyT = 0, stillT = 0, drawn = 0, shadowRenders = 0, shadowT = 0, capAlways = false;
  /** Too slow for three seconds: one tier down (High → Medium → Low), never
   *  straight to the bottom. Antialias stays (it is fixed with the context). */
  const stepDown = (): boolean => {
    const next = stepDownTier(tier);
    if (!next) return false;
    tier = next; prof = TIER_PROFILES[tier];
    dyn = makeDyn(); dynPR = Math.min(dpr, prof.movePixelRatio);
    pr = stillPR(); renderer.setPixelRatio(pr);
    if (!prof.shadows) { carSpot.castShadow = false; renderer.shadowMap.enabled = false; }
    else {
      const n = shadowSizeFor(prof, CAR_MAP);
      if (n !== carSpot.shadow.mapSize.x) { carSpot.shadow.map?.dispose(); carSpot.shadow.map = null; carSpot.shadow.mapSize.set(n, n); carSpot.shadow.needsUpdate = true; renderer.shadowMap.needsUpdate = true; }
    }
    if (!prof.outlines && person) person.outline.visible = false;
    resize();
    return true;
  };
  const frozen = freezeStatic(THREE, mergeGeometries, scene, new Set<any>([player, table, ...bootSlots.map((b) => b.group), ...bootSlots.map((b) => b.ring), ...pickables]));
  // warm up: every shader built before the first frame, so the first steps don't stutter
  try { await renderer.compileAsync(scene, camera); } catch { /* compiled on first use instead */ }
  if (disposed) throw new Error("disposed");

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    let dt: number;
    if (opts.fixedStep) dt = opts.fixedStep;
    else {
      acc += Math.min(0.25, clock.getDelta());
      // still: 30 a second; moving: the tier's cap (High and Medium every frame, Low 30)
      const cap = busy && !capAlways ? prof.fpsCap : prof.stillFps;
      if (cap < 60 && acc < 1 / (cap + 1)) return;
      dt = Math.min(0.05, acc);
      acc = 0;
    }
    gameT += dt;
    if (opts.fixedStep) filmLog.push([Date.now(), gameT]);

    // input: stick, else keys
    let ix = stick.x, iy = stick.y;
    if (keys.size) {
      ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      iy = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const m = Math.hypot(ix, iy) || 1;
      const run = keys.has("shift") ? 1 : 0.6;
      ix = (ix / m) * run; iy = (iy / m) * run;
    }
    let mag = Math.min(1, Math.hypot(ix, iy));
    let wantYaw: number | null = null;
    if (mag >= 0.08) {
      // stick is relative to the camera
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const dx = fx * iy + rx * ix, dz = fz * iy + rz * ix;
      wantYaw = Math.atan2(dx, dz);
    } else if (walker.active) {
      const st = walker.step(player.position.x, player.position.z, dt);
      if (st) {
        wantYaw = st.yaw;
        // turning round first: don't stride off the wrong way meanwhile
        mag = st.push * Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(angDiff(yaw, st.yaw)))));
      } else if (!walker.active && marker.visible) marker.fade();
    }
    const target = mag < 0.08 ? 0 : mag < 0.75 ? WALK * (mag / 0.75) : WALK + (JOG - WALK) * ((mag - 0.75) / 0.25);
    speed += (target - speed) * Math.min(1, dt * 8);
    if (buying > 0) speed *= 0.8;
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
    playerBlob.position.set(nx, 0.014, nz);

    // animation blend
    const wWalk = speed < WALK ? speed / WALK : Math.max(0, 1 - (speed - WALK) / (JOG - WALK));
    const wJog = speed <= WALK ? 0 : Math.min(1, (speed - WALK) / (JOG - WALK));
    const wIdle = Math.max(0, 1 - speed / WALK);
    const dur = buyA.getClip().duration;
    const gesture = buying > 0 ? Math.min(1, buying / 0.3, (dur - buying) / 0.3) : 0;
    idleA.setEffectiveWeight(wIdle * (1 - gesture));
    walkA.setEffectiveWeight(wWalk * (1 - gesture));
    jogA.setEffectiveWeight(wJog * (1 - gesture));
    buyA.setEffectiveWeight(gesture);
    if (newLook) {
      // the walk and the jog share one stride timing, so they share one pace
      // and the feet stay together while one blends into the other
      const ts = Math.max(0.5, speed / (1.7 + 1.3 * wJog));
      walkA.timeScale = ts; jogA.timeScale = ts;
    } else {
      walkA.timeScale = Math.max(0.6, speed / 1.45);
      jogA.timeScale = Math.max(0.8, speed / 3.2);
    }
    if (buying > 0) buying -= dt;
    mixer.update(dt);

    // a card is open: he turns to face what's picked
    const shot = framed ? focusShot() : null;
    if (shot && speed < 0.3 && mag < 0.08) {
      const w2 = Math.atan2(shot.look[0] - player.position.x, shot.look[2] - player.position.z);
      yaw += angDiff(yaw, w2) * Math.min(1, dt * 5);
      player.rotation.y = yaw;
    }

    // camera: follows behind him; with a card open it moves in on the item
    camYaw += orb.step(dt);
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) camYaw += angDiff(camYaw, yaw + Math.PI) * Math.min(1, dt * 1.6);
    frame += ((shot && orbitHold <= 0 ? 1 : 0) - frame) * Math.min(1, dt * 2.6);
    const cf = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const cr = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const [camUp, camBack] = orb.lift(2.85, 4.6, 0.95); // the drag's tilt, same distance from him
    want.set(player.position.x, camUp, player.position.z).addScaledVector(cf, -camBack).addScaledVector(cr, 0.3);
    wantLook.set(player.position.x, 0.95, player.position.z).addScaledVector(cf, 2.4).addScaledVector(cr, 0.15);
    if (shot) {
      want.lerp(new THREE.Vector3(...shot.cam), frame);
      wantLook.lerp(new THREE.Vector3(...shot.look), frame);
    }
    want.x = Math.max(-ROOM.x + 0.3, Math.min(ROOM.x - 0.3, want.x));
    want.z = Math.max(-ROOM.z + 0.3, Math.min(ROOM.z - 0.35, want.z));
    // walking out of the door: the camera stays inside, looking out
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; }
    else { camPos.lerp(want, Math.min(1, dt * 5)); camLook.lerp(wantLook, Math.min(1, dt * 6)); }
    // the eased camera stays inside the room too (it used to cut a corner through the wall while catching up)
    camPos.x = Math.max(-ROOM.x + 0.3, Math.min(ROOM.x - 0.3, camPos.x));
    camPos.z = Math.max(-ROOM.z + 0.3, Math.min(ROOM.z - 0.35, camPos.z));
    camPos.y = Math.max(CAM_MIN_Y, Math.min(ROOM.h - 0.25, camPos.y));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // with a card open, slide the picture up so the item sits above the card
    const vw = container.clientWidth || 1, vh = container.clientHeight || 1;
    const offY = Math.round(frame * 0.17 * vh);
    if (offY !== lastOff) {
      lastOff = offY;
      if (offY > 0) camera.setViewOffset(vw, vh, 0, offY, vw, vh); else camera.clearViewOffset();
    }

    // the turntable turns, the boots turn slowly on their plinths
    table.rotation.y += dt * 0.22;
    if (carPop < 1) { carPop = Math.min(1, carPop + dt * 2.2); }
    const pop = 1 - Math.pow(1 - carPop, 3);
    carHolder.scale.setScalar(0.85 + 0.15 * pop);
    bootSlots.forEach((b, i) => {
      const on = sel.display === "boots" && sel.index === i;
      b.group.rotation.y = b.spin + gameT * (on ? 0.6 : 0.25);
      const s = BOOT_SCALE * (on ? 1.12 : 1);
      b.group.scale.setScalar(b.group.scale.x + (s - b.group.scale.x) * Math.min(1, dt * 6));
      b.group.position.y = PLINTH_H + 0.035 + (on ? 0.04 + 0.02 * Math.sin(gameT * 2.2) : 0);
      b.ring.material.emissiveIntensity = on ? 2.6 + 0.6 * Math.sin(gameT * 4) : 0.9;
    });
    // tags: full when you're near, fading out across the room
    for (const tg of tags) {
      const d = Math.hypot(tg.base[0] - player.position.x, tg.base[2] - player.position.z);
      const on = framed && tg.display === sel.display && tg.index === sel.index && (tg.display !== "car" || true);
      const a = on ? 1 : Math.max(0, Math.min(1, (7.5 - d) / 2.5)) * (framed ? 0.35 : 1);
      tg.sprite.material.opacity = a;
      tg.sprite.visible = a > 0.02;
      tg.sprite.position.y = tg.base[1] + 0.03 * Math.sin(gameT * 1.6 + tg.base[2]);
    }

    // which display is he at?
    let now: DisplayId | null = null;
    for (const zn of ZONES) {
      if (zn.inside(player.position.x, player.position.z)) { now = zn.id; break; }
    }
    if (now !== near) { near = now; cb.onNear(near); }

    if (carSpot.castShadow) {
      shadowT -= dt;
      const nearCar = Math.hypot(player.position.x - CAR.x, player.position.z - CAR.z) < CAR.r + 3.5;
      if (shadowT <= 0 || (nearCar && speed > 0.05)) {
        carSpot.shadow.needsUpdate = true;
        shadowT = 0.1;
        shadowRenders++;
      }
    }
    if (hEnh) hEnh.render(scene, camera); else renderer.render(scene, camera);
    drawn++;
    // busy (walking, turning, the camera moving): every frame, fewer pixels
    busy = speed > 0.05 || mag > 0.05 || walker.active || orbitHold > 0 || orb.moving || !!faceTo || Math.abs(frame - (shot && orbitHold <= 0 ? 1 : 0)) > 0.01 || camPos.distanceToSquared(want) > 1e-4;
    if (busy) { busyT += dt; stillT = 0; } else { stillT += dt; busyT = 0; }
    if (!opts.fixedStep) {
      // dynamic resolution: judged only while moving at the full cap
      if (busy && !capAlways) dyn.frame(performance.now()); else dyn.pause();
      const wantPR = busyT > 0.25 ? movePR() : stillT > 0.5 ? stillPR() : pr;
      if (wantPR !== pr) { pr = wantPR; renderer.setPixelRatio(pr); lastOff = -1; }
    }
    // frames per real second; a phone that can't keep up drops to fewer pixels
    frames++;
    const nowMs = performance.now();
    if (nowMs - fpsT0 >= 1000) {
      const fps = Math.round((frames * 1000) / (nowMs - fpsT0));
      cb.onFps(fps);
      frames = 0; fpsT0 = nowMs;
      if (!opts.fixedStep) {
        // still runs at 30 on purpose: only count a slow second against what
        // was asked for
        slowSeconds = fps < (busy && !capAlways && prof.fpsCap === 60 ? 28 : 22) ? slowSeconds + 1 : 0;
        // three slow seconds: one tier down; still too slow at Low: 30 a second always
        if (slowSeconds >= 3) {
          slowSeconds = 0;
          if (!stepDown()) capAlways = true;
        }
      }
    }
  });

  const ray = new THREE.Raycaster();
  const ctrl: ShopController = {
    setStick: (x, y) => { stick = { x, y }; if (Math.hypot(x, y) > 0.05) stopWalk(); },
    setCardOpen: (open) => { framed = open; if (open) orbitHold = 0; },
    setKit: (k) => { kitU.uShirt.value.set(k.shirt); kitU.uTrim.value.set(k.trim); dressNew(k); },
    select: (display, index) => {
      sel = { display, index };
      if (display === "car") showCar(index);
    },
    setLevel: (display, index, level) => {
      if (display === "counter") showPicture(index, level);
    },
    setOwned: (o) => { owned = o; redrawTags(); },
    nearestItem: (display) => {
      if (display === "boots") {
        let best = 0, bd = Infinity;
        PLINTH_Z.forEach((z, i) => { const d = Math.abs(z - player.position.z); if (d < bd) { bd = d; best = i; } });
        return Math.min(best, displays.boots.items.length - 1);
      }
      if (display === "counter") {
        let best = 0, bd = Infinity;
        BOX_X.forEach((x, i) => { const d = Math.abs(x - player.position.x); if (d < bd) { bd = d; best = i; } });
        return Math.min(best, displays.counter.items.length - 1);
      }
      if (display === "car") return Math.max(0, carIndex);
      return 0;
    },
    playBuy: () => {
      buyA.reset();
      buyA.play();
      buying = buyA.getClip().duration;
    },
    orbit: (dx, dy = 0) => { orb.drag(dx, dy); orbitHold = 1.5; },
    pick: (px, py) => {
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(pickables.filter((o) => o.visible !== false), false)[0];
      const p = hit?.object?.userData?.pick as Picked | undefined;
      if (!p) return null;
      return p.display === "car" ? { display: "car", index: Math.max(0, carIndex) } : p;
    },
    tap: (px, py) => {
      const p = ctrl.pick(px, py);
      if (p) { const s0 = standFor(p); walkTo(s0.at, s0.face); return { item: p }; }
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (!hit || Math.abs(hit.x) > ROOM.x + 1 || Math.abs(hit.z) > ROOM.z + 1) return null;
      return walkTo([hit.x, hit.z], null) ? { item: null } : null;
    },
    walkToItem: (p) => { const s0 = standFor(p); return walkTo(s0.at, s0.face); },
    walking: () => ({ to: walker.goal ? [walker.goal[0], walker.goal[1]] : null, active: walker.active }),
    place: (x, z, y = yaw) => {
      stopWalk();
      player.position.x = x; player.position.z = z; yaw = y; camYaw = y + Math.PI; orb.reset(); first = true;
    },
    where: () => ({ x: player.position.x, z: player.position.z, yaw, camYaw, t: gameT }),
    filmLog: () => filmLog,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), loaded, shadowRenders, frames: drawn, merged: frozen, quality: tier }),
    dispose: () => {
      disposed = true;
      hEnh?.dispose();
      hRoom?.dispose();
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
      draco.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      // give the phone its 3D back now (iPhone Safari allows only a few at
      // once, and the shop and the garden swap often)
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
  showCar(0);
  return ctrl;
}

/** Paint the kit onto the bare body (see kit.ts): shirt, shorts in the trim
 *  colour, socks with a trim band, dark boots and a number on the back. */
export function dressInKit(THREE: any, mesh: any, U: any, cacheKey = "shop3d-kit") {
  const g = mesh.geometry;
  const sk = mesh.skeleton;
  sk.calculateInverses?.();
  const bind = mesh.bindMatrix;
  const pos = g.attributes.position;
  const bp = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(bind);
    bp[i * 3] = v.x; bp[i * 3 + 1] = v.y; bp[i * 3 + 2] = v.z;
  }
  const heads: V3[] = sk.boneInverses.map((inv: any) => {
    const m = inv.clone().invert();
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    return [p.x, p.y, p.z] as V3;
  });
  const names: string[] = sk.bones.map((b: any) => b.name);
  const masks = kitMasks({
    positions: bp,
    skinIndex: g.attributes.skinIndex.array,
    skinWeight: g.attributes.skinWeight.array,
    boneNames: names,
    boneHeads: heads,
  });
  g.setAttribute("aKit", new THREE.BufferAttribute(masks, 4));

  // body axes in bind space, for the number on the back
  const H = (n: string) => new THREE.Vector3(...heads[names.indexOf(n)]);
  const pelvis = H("pelvis");
  const up = H("Head").sub(pelvis).normalize();
  const fwd = H("ball_l").sub(H("foot_l"));
  fwd.addScaledVector(up, -fwd.dot(up)).normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  U.uPelvis.value.copy(pelvis);
  U.uUp.value.copy(up);
  U.uFwd.value.copy(fwd);
  U.uRight.value.copy(right);

  const m = mesh.material;
  m.onBeforeCompile = (sh: any) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aKit;\nvarying vec4 vKit;\nvarying vec3 vBind;\nvarying vec3 vBindN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvKit = aKit;\nvBind = (bindMatrix * vec4(position, 1.0)).xyz;\nvBindN = mat3(bindMatrix) * normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec4 vKit; varying vec3 vBind; varying vec3 vBindN;
uniform vec3 uShirt; uniform vec3 uTrim; uniform vec3 uBoot; uniform sampler2D uNum;
uniform vec3 uPelvis; uniform vec3 uUp; uniform vec3 uRight; uniform vec3 uFwd;
float kitKitAmt = 0.0; float kitRough = 0.8;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  vec4 k = vKit;
  vec4 c = clamp(k / max(fwidth(k), vec4(1e-4)) + 0.5, 0.0, 1.0);
  float boot = c.w;
  float sock = c.z * (1.0 - boot);
  float shirt = c.x * (1.0 - boot) * (1.0 - sock);
  float shorts = c.y * (1.0 - shirt) * (1.0 - boot) * (1.0 - sock);
  vec3 sc = uShirt;
  // a trim edge on the sleeves, collar and hem
  sc = mix(sc, uTrim, step(k.x, 0.016) * 0.9);
  // the number on the back
  vec3 p = vBind - uPelvis;
  float hh = dot(p, uUp);
  float xx = dot(p, uRight);
  float back = smoothstep(-0.25, -0.55, dot(normalize(vBindN), uFwd));
  vec2 nuv = vec2(0.5 - xx / 0.30, (hh - 0.43) / 0.30 + 0.5);
  if (nuv.x > 0.0 && nuv.x < 1.0 && nuv.y > 0.0 && nuv.y < 1.0) {
    float a = texture2D(uNum, nuv).a * back;
    sc = mix(sc, uTrim, a);
  }
  vec3 sockC = mix(uShirt, uTrim, step(k.z, 0.035));
  vec3 kitC = sc * shirt + uTrim * shorts + sockC * sock + uBoot * boot;
  kitKitAmt = clamp(shirt + shorts + sock + boot, 0.0, 1.0);
  // fabric is lit a touch flatter than skin
  diffuseColor.rgb = mix(diffuseColor.rgb, kitC * 0.92, kitKitAmt);
  kitRough = mix(0.82, 0.35, boot);
}`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, kitRough, kitKitAmt);")
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\nvec3 kitGeoN = normal;")
      .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize(mix(normal, kitGeoN, kitKitAmt * 0.85));");
  };
  m.customProgramCacheKey = () => cacheKey;
  m.needsUpdate = true;
}
