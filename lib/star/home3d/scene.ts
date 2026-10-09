/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * YOUR HOME, IN 3D — one room you walk round, built like the 3D shop and the
 * garden (Harry, 9 Oct 2026: "imagine you actually had your current house with
 * all your stuff and that's where you change clothes").
 *
 * ROOMS (9 Oct 2026): a bigger home has more rooms (./rooms.ts plans them,
 * ./roomBuild.ts builds ONE at a time). This file keeps the renderer, the
 * lights, you, the camera and the walking; walk through a doorway and the
 * screen fades, the old room is freed, the next is built, and you arrive at
 * its matching door. Settings → Look → "House: Old" keeps the one room below.
 *
 * One parametric room (./homes.ts RoomPreset): the home you own in the shop
 * sets its size, floor, walls and what the windows look out on (a starter
 * flat before you buy one). In it:
 *   - the WARDROBE (west wall): your casual sets, your club kits and your boots
 *     on a rail and a shelf, and a full-length MIRROR beside it. Walk up (or
 *     tap it) and the page opens the wardrobe card; pick an outfit and you
 *     change into it, and see it in the mirror (./wear.ts makes the body).
 *   - the TROPHY CABINET (back wall): your real trophies and awards
 *     (./trophies.ts), each a stylised model made here in code, with a brass
 *     name plate; the big ones you have not won are faint shapes that say
 *     "Win it to fill this".
 *   - the DRIVE WINDOW (east wall): your cars on the drive outside (the
 *     shop's generated cars, light copies: tools/home3d/make_lods.mjs).
 *   - the front door leads out to the 3D garden (cb.onDoor).
 *
 * Speed (Harry's rules, docs/3D_HANDBOOK.md section 5): the light is baked in
 * (painted wall shade, floor shade, the sun's patch and lamp pools are
 * glows); live lights are one sky light and ONE sun that casts the shadows,
 * its shadow map drawn again only while you move. Still pieces are joined
 * into a few draws (freezeStatic); the trophies, plates and garments are
 * built as one mesh each. The mirror draws only you and the room's far side
 * (a layer of its own) at a small size, and only while you are near it.
 * The governor (three3d/governor.ts) and the quality tier work as in the shop.
 */
import { installAssetVersions } from "../three3d/assetUrl";
import type { Person3D } from "../people3d";
import { turnTo } from "../three3d/animBlend";
import { TIER_PROFILES, quality3dTier, stepDownTier, shadowSizeFor, type Quality3d } from "../three3d/quality";
import { Governor } from "../three3d/governor";
import { DynamicResolution, rememberGpu, noteSceneFiles } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { strideFor, type GaitBlend } from "../three3d/gaitBlend";
import { STROLL_SPEEDS, approach, stickTarget } from "../three3d/gait";
import { OrbitCam, CAM_MIN_Y } from "../three3d/orbitCam";
import { buildGrid, findPath, TapWalker, makeTapMarker, type WalkGrid, type XZ } from "../tapWalk";
import { stepDwell } from "../shop3d/dwell";
import { makeWalkClip } from "../walkClip";
import { numberCanvas, blobCanvas } from "../shop3d/textures";
import type { HomeTier, RoomId } from "./homes";
import type { CabinetSlot } from "./trophies";
import type { Worn, BootChoice, Kit2, CasualSet } from "./outfits";
import { buildWearer, repaintKit, type WearInput } from "./wear";
import { roomPlan, roomFiles, arrivalAt, arrivalDoor, type DoorPlan, type HomeSpot, type HomeStuff } from "./rooms";
import { buildRoom, disposeGroup, roomFree, MIRROR_LAYER, MIRROR_PX, type BuiltRoom, type RoomEnv, type RoomInput } from "./roomBuild";
import { safeCompileAsync } from "../three3d/safeCompile";

export type { HomeSpot } from "./rooms";

/** The room camera (Harry, 9 Oct 2026: "pull it back and up so the room reads"). */
export const ROOM_CAM = {
  /** How far behind him, metres (was 3.3, and clamped to the walls by axis, so it jammed). */
  back: 4.4,
  /** How high (was 2.35). */
  height: 2.9,
  /** The point on him it looks past (was 1.0), and how far ahead of him. */
  lookY: 0.95,
  lookAhead: 2.2,
  /** Kept off the walls and under the ceiling. */
  wallGap: 0.3,
  ceilingGap: 0.18,
  /** For each metre the walls take off the boom, the camera rises this much. */
  riseIfShort: 0.45,
};

/**
 * How long the boom can be from (px, pz) along (dx, dz) before it meets a wall
 * (the room's inside, less a gap): the camera shortens along its own line
 * instead of sliding sideways round him. Pure (tests/star/home3d.mts).
 */
export function roomCamBoom(px: number, pz: number, dx: number, dz: number, want: number, w2: number, d2: number): number {
  let t = want;
  if (dx > 1e-6) t = Math.min(t, (w2 - px) / dx); else if (dx < -1e-6) t = Math.min(t, (-w2 - px) / dx);
  if (dz > 1e-6) t = Math.min(t, (d2 - pz) / dz); else if (dz < -1e-6) t = Math.min(t, (-d2 - pz) / dz);
  return Math.max(0.6, t);
}

/**
 * Backed onto a wall (just through a doorway, by a wall), the camera swings
 * round him, up to about 70°, to where it has the most room behind him AND
 * the most room in front to look into: a three-quarter view across the room
 * instead of the back of his head or a near wall. The camera's yaw
 * (it stands along (sin yaw, cos yaw) from him). Pure (tests/star/home3d.mts).
 */
export function openCamYaw(px: number, pz: number, yaw: number, want: number, w2: number, d2: number): number {
  let best = yaw, bestScore = -1;
  for (let i = -6; i <= 6; i++) {
    const a = i * 0.2, y = yaw + a;
    // room behind him for the camera, and room in front of him for the camera to look into
    const ahead = roomCamBoom(px, pz, -Math.sin(y), -Math.cos(y), 6, w2, d2);
    const score = roomCamBoom(px, pz, Math.sin(y), Math.cos(y), want, w2, d2) + 0.6 * ahead - Math.abs(a) * 0.35;
    if (score > bestScore + 1e-6) { bestScore = score; best = y; }
  }
  return best;
}

export interface HomeData {
  tier: HomeTier;
  /** The club's kits (home, away) and your shirt number. */
  kits: { home: Kit2; away: Kit2 };
  number: number;
  /** What you are wearing as the home opens. */
  worn: Worn;
  skin: string;
  hair: string;
  hairStyle?: "short" | "long" | "buzz" | "none";
  /** The cabinet's spots (./trophies.ts cabinetSlots, sized for the tier). */
  slots: CabinetSlot[];
  /** Your cars on the drive (./outfits.ts carsOnDrive). */
  cars: { id: string; model: string; length: number }[];
  /** The boots on the wardrobe shelf (./outfits.ts bootChoices). */
  boots: BootChoice[];
  /** The rail: every casual set, then the two kits. */
  casual: CasualSet[];
  /** The rooms you walk through (./homes.ts roomsFor). Unset: the one room. */
  rooms?: RoomId[];
  /** Your watches, jewellery, cans, bike, jet... (./rooms.ts homeStuffOf). */
  stuff?: HomeStuff;
  /** The motorbike's model (the garage). */
  bikeModel?: string | null;
  /** Your club (its name on the cinema screen). */
  club?: string;
  /** Your club's drawn badge, an SVG picture (on the cinema screen). */
  badge?: string;
}

export interface HomeCallbacks {
  /** He is standing at a spot (its card should open), or left it. */
  onNear: (spot: HomeSpot | null) => void;
  onFps?: (fps: number) => void;
  /** He walked out of the front door (to the 3D garden). Absent: the door is shut. */
  onDoor?: () => void;
  /** The phone took the 3D away. */
  onContextLost?: () => void;
  /** He is in a room now (on opening, and after each doorway). */
  onRoom?: (id: RoomId, label: string) => void;
}

export interface HomeOptions {
  quality?: Quality3d;
  /** Look H (the broadcast pass) or the plain look. Unset: Settings → Look → "3D look". */
  lookH?: boolean;
  fixedStep?: number;
}

export interface HomeController {
  setStick: (x: number, y: number) => void;
  orbit: (dx: number, dy?: number) => void;
  pick: (clientX: number, clientY: number) => HomeSpot | null;
  /** Tap to move: on a spot, walk up to it (its card opens as he arrives); on the floor, walk there. */
  tap: (clientX: number, clientY: number) => { spot: HomeSpot | null } | null;
  /** Walk up to a spot (its card opens as he arrives). */
  walkToSpot: (spot: HomeSpot) => boolean;
  /** A card is open: the camera frames that spot (the wardrobe: he steps to the mirror). */
  setCardOpen: (spot: HomeSpot | null) => void;
  /** Change clothes. Resolves once he is wearing it. */
  wear: (worn: Worn) => Promise<void>;
  /** For checking: stand him at (x, z) facing yaw. */
  place: (x: number, z: number, yaw?: number) => void;
  where: () => { x: number; z: number; yaw: number; t: number; changing: boolean };
  /** For checking: a fixed test camera (null: back to the follow camera). */
  debugCamera: (pos: [number, number, number] | null, look?: [number, number, number]) => void;
  /** The room's plan, for checking: spots and their places. */
  plan: () => Record<string, unknown>;
  stats: () => { calls: number; triangles: number; pixelRatio: number; quality: string; merged?: { before: number; after: number }; mirror: boolean; room?: string; swapMs?: number };
  /** The room he is in. */
  room: () => RoomId;
  /** Every room of the home, in order (the dots). */
  rooms: () => { id: RoomId; label: string }[];
  /** Jump to a room (a dot): the fade, then he stands inside its door. */
  goToRoom: (id: RoomId) => Promise<boolean>;
  dispose: () => void;
}

/** Opens the home; on any failure the half-built renderer is let go before the error goes up. */
export async function startHome(container: HTMLElement, cb: HomeCallbacks, data: HomeData, opts: HomeOptions = {}): Promise<HomeController> {
  const own: { renderer?: any } = {};
  try {
    const t0 = performance.now();
    const c = await buildHome(container, cb, data, opts, own);
    noteSceneFiles("home", t0); // what it asked for: Home's next preload fetches exactly these (three3d/perf.ts)
    return c;
  } catch (e) {
    const r = own.renderer;
    if (r) { try { r.setAnimationLoop(null); r.dispose(); r.forceContextLoss(); r.domElement.remove(); } catch { /* gone */ } }
    throw e;
  }
}

async function buildHome(container: HTMLElement, cb: HomeCallbacks, data: HomeData, opts: HomeOptions, own: { renderer?: any }): Promise<HomeController> {
  let tier: Quality3d = opts.quality ?? quality3dTier();
  let prof = TIER_PROFILES[tier];
  const rooms: RoomId[] = data.rooms?.length ? data.rooms : ["main"];
  const plan0 = roomPlan(data.tier, rooms[0], rooms);
  /** The room you are in now: half its width and depth, its height. */
  let W2 = plan0.w / 2, D2 = plan0.d / 2, H = plan0.h;
  const THREE: any = await import("three");
  await installAssetVersions(); // every file this place asks for by its versioned address (three3d/assetUrl.ts)
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const { Reflector }: any = await import("three/examples/jsm/objects/Reflector.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const lookH = opts.lookH ?? (await import("../look3dStyle")).look3dStyle() === "h";

  // ── Renderer (as the shop: one tier chosen first, the governor, still/moving pixels) ──
  const renderer = new THREE.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
  own.renderer = renderer;
  rememberGpu(renderer);
  const dpr = window.devicePixelRatio || 1;
  let capAlways = false;
  const gov = new Governor({ start: tier, name: "home", slowSeconds: 2, onChange: (r, _i, why) => {
    if (why === "start") return;
    if (why === "down" && r.tier !== tier) { if (!stepDown()) capAlways = true; }
    pr = stillPR(); renderer.setPixelRatio(pr);
  } });
  let govCap = 60;
  const STILL_H: Record<string, number> = { low: 1.25, medium: 2, high: 2.5 };
  const stillPR = () => Math.min(dpr, lookH ? Math.max(prof.maxPixelRatio, STILL_H[tier] ?? 1.5) : prof.maxPixelRatio);
  let dynPR = Math.min(dpr, prof.movePixelRatio);
  const makeDyn = () => new DynamicResolution(
    { setPixelRatio: (v: number) => { dynPR = v; } },
    { maxPixelRatio: prof.movePixelRatio, minPixelRatio: prof.minPixelRatio, fpsCap: prof.fpsCap },
    { step: 0.125, devicePixelRatio: dpr },
  );
  let dyn = makeDyn();
  const movePR = () => Math.min(dpr, gov.rung.pixelRatio, prof.movePixelRatio, dynPR);
  let pr = stillPR();
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // drawn again only when something under the sun moves
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);
  let disposed = false;
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#1a1612");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.4;
  // Look H: the indoor broadcast pass (no baked set for the home: its shade is painted in, below)
  const hEnh = lookH ? (await import("../style3d/real/enhance")).enhanceH(THREE, renderer, scene, tier, "indoor", { exposure: 1.05, bake: null }) : null;
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 80);

  // ── Light: one sky light, one sun through the drive window (the only shadow) ──
  const hemi = new THREE.HemisphereLight("#fff3e2", "#6a5440", 1.05);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#ffe0b0", 1.7);
  sun.position.set(W2 + 5, 5.5, -1.5);
  sun.target.position.set(-0.5, 0, 0.5);
  scene.add(sun, sun.target);
  const SUN_MAP = 1024;
  sun.castShadow = prof.shadows;
  {
    const n = shadowSizeFor(prof, SUN_MAP) || SUN_MAP;
    sun.shadow.mapSize.set(n, n);
    const s = Math.max(W2, D2) + 1;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 20 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
  }
  // the mirror sees by the same light
  for (const l of [hemi, sun]) l.layers.enable(MIRROR_LAYER);

  // ── Helpers (the shell's own: your number, your shadow blob) ──
  const tex = (cv: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = prof.anisotropy;
    return t;
  };
  const seen = (o: any) => { o.traverse((c: any) => c.layers.enable(MIRROR_LAYER)); return o; };
  const blobT = tex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, opacity = 0.9) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }));
    me.position.set(x, 0.012, z);
    me.rotation.set(-Math.PI / 2, 0, 0);
    me.renderOrder = 1;
    scene.add(me);
    return me;
  };

  // ── Loaders (a model is fetched once, then cloned into each room that shows it) ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const glbCache = new Map<string, Promise<any>>();
  const glb = (url: string): Promise<any> => {
    const had = glbCache.get(url);
    if (had) return had;
    const pr: Promise<any> = loader.loadAsync(url);
    pr.catch(() => glbCache.delete(url));
    glbCache.set(url, pr);
    return pr;
  };

  // ── The room you are in: one at a time (./roomBuild.ts; which rooms, ./rooms.ts) ──
  const roomIn: RoomInput = { tier: data.tier, rooms, kits: data.kits, slots: data.slots, cars: data.cars, boots: data.boots, casual: data.casual, stuff: data.stuff, bikeModel: data.bikeModel ?? null, club: data.club, badge: data.badge };
  const env: RoomEnv = { THREE, mergeGeometries, Reflector, prof, quality: tier, envTex, doorOpen: !!cb.onDoor, glb, cloneSkinned: (o: any) => SkeletonUtils.clone(o) };
  let room: BuiltRoom = buildRoom(env, roomIn, rooms[0]);
  scene.add(room.group);
  const fitSun = () => {
    W2 = room.w2; D2 = room.d2; H = room.h;
    sun.position.set(W2 + 5, 5.5, -1.5);
    const sz = Math.max(W2, D2) + 1;
    Object.assign(sun.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz });
    sun.shadow.camera.updateProjectionMatrix();
  };
  fitSun();

  // ── You ──
  const numberTex = tex(numberCanvas(data.number, "#ffffff"));
  const wearIn = (worn: Worn): WearInput => ({
    worn, kits: data.kits, number: numberTex, skin: data.skin, hair: data.hair, hairStyle: data.hairStyle,
    outline: prof.outlines ? 0.006 : 0, castShadow: true,
  });
  type Me = { person: Person3D; worn: Worn; gait: GaitBlend | null; idle: any; walk: any; jog: any };
  const dressUp = async (worn: Worn): Promise<Me> => {
    const person = await buildWearer(THREE, SkeletonUtils, loader, wearIn(worn));
    const idle = person.actions.idle;
    const walk = person.mixer.clipAction(makeWalkClip(THREE, person.actions.jog.getClip(), person.actions.idle.getClip()));
    walk.play(); walk.setEffectiveWeight(0);
    const jog = person.actions.jog;
    for (const a of [idle, walk, jog]) a.setEffectiveWeight(0);
    idle.setEffectiveWeight(1);
    const gait = await strideFor(THREE, person, person.mixer, { idle, walk, jog }).catch((e) => { console.error("home: gait clips", e); return null; });
    seen(person.root);
    return { person, worn, gait, idle, walk, jog };
  };
  let me = await dressUp(data.worn);
  if (disposed) throw new Error("disposed");
  const START = room.start;
  me.person.root.position.set(START.x, 0, START.z);
  me.person.root.rotation.y = START.yaw;
  scene.add(me.person.root);
  const meBlob = blob(0.85, 0.85, START.x, START.z, 0.75);

  // look H draws into its pass's picture: build the shaders for THAT (enhance.ts compile), not the screen
  try { await (hEnh ? hEnh.compile(scene, camera) : safeCompileAsync(renderer, scene, camera)); } catch { /* compiled on first use */ }
  if (disposed) throw new Error("disposed");

  // ── State ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0, yaw = Math.PI, camYaw = openCamYaw(START.x, START.z, START.yaw + Math.PI, ROOM_CAM.back, room.w2 - ROOM_CAM.wallGap, room.d2 - ROOM_CAM.wallGap), orbitHold = 0;
  /** The shown facing's turn speed (three3d/animBlend.ts turnTo: turns ease in and out). */
  const yawTurn = { yaw: 0, vel: 0 };
  const orb = new OrbitCam();
  let near: HomeSpot | null = null;
  let dwellZone: HomeSpot | null = null;
  let dwell = { timer: 0, open: false };
  let arrivedAt: HomeSpot | null = null, spotWalk: HomeSpot | null = null;
  let framed: HomeSpot | null = null, frame = 0;
  let gameT = 0, frames = 0, fpsT0 = performance.now();
  let changing = false;
  let shadowDirty = true, shadowT = 0;
  let dbgCam: { pos: [number, number, number]; look: [number, number, number] } | null = null;
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
  let lastOff = -1;
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? 64 : 56;
    lastOff = -1;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  const RR = 0.3;
  let leftByDoor = false;
  /** Through a doorway: the garden (a career leaves the house) or the next room. */
  const throughDoor = (d: DoorPlan) => {
    if (d.to === "garden") { if (!leftByDoor) { leftByDoor = true; cb.onDoor?.(); } return; }
    void goToRoom(d.to, room.id);
  };
  const collide = (x: number, z: number): [number, number] => {
    // the room's walls, opened where he stands in a doorway (he can step through it)
    let x0 = -W2 + RR, x1 = W2 - RR, z0 = -D2 + RR, z1 = D2 - RR;
    const open: DoorPlan[] = [];
    for (const d of room.doors) {
      const inGap = d.wall === "n" || d.wall === "s" ? Math.abs(x - d.x) < d.half - 0.1 : Math.abs(z - d.z) < d.half - 0.1;
      if (!inGap) continue;
      if (d.wall === "s") z1 = D2 + 0.9; else if (d.wall === "n") z0 = -D2 - 0.9; else if (d.wall === "e") x1 = W2 + 0.9; else x0 = -W2 - 0.9;
      open.push(d);
    }
    x = Math.max(x0, Math.min(x1, x));
    z = Math.max(z0, Math.min(z1, z));
    // (two doors can face each other across a room: the one he is stepping through is the one he is past)
    if (!swapping) for (const d of open) {
      const past = d.wall === "s" ? z - D2 : d.wall === "n" ? -D2 - z : d.wall === "e" ? x - W2 : -W2 - x;
      if (past > 0.25) { throughDoor(d); break; }
    }
    for (const [sx0, sx1, sz0, sz1] of room.solids) {
      if (x > sx0 - RR && x < sx1 + RR && z > sz0 - RR && z < sz1 + RR) {
        const push = [x - (sx0 - RR), sx1 + RR - x, z - (sz0 - RR), sz1 + RR - z];
        const m = Math.min(...push);
        if (m === push[0]) x = sx0 - RR; else if (m === push[1]) x = sx1 + RR; else if (m === push[2]) z = sz0 - RR; else z = sz1 + RR;
      }
    }
    return [x, z];
  };
  const isFree = (x: number, z: number) => roomFree(room, x, z);
  /** Where each spot is stood at, and what he looks at there. */
  const standFor = (s: HomeSpot): { at: XZ; face: XZ } => {
    const p = me.person.root.position;
    return room.standFor(s, [p.x, p.z]);
  };
  const walkTo = (to: XZ, face: XZ | null) => {
    grid ??= buildGrid(-W2, W2, -D2, D2, 0.2, isFree);
    const p = me.person.root.position;
    const path = findPath(grid, [p.x, p.z], to);
    if (!path) return false;
    faceTo = null;
    spotWalk = null;
    walker.go(path, { onArrive: () => { marker.fade(); faceTo = face; arrivedAt = spotWalk; spotWalk = null; } });
    const g = path[path.length - 1];
    marker.show(g[0], g[1], 0.02);
    orbitHold = 0;
    return true;
  };
  /** Which spot he is in, and the nearest point of its front. */
  const zoneAt = (x: number, z: number) => room.zoneAt(x, z);
  /** The camera's shot of a spot with its card open. */
  const shotOf = (s: HomeSpot) => room.shotOf(s);

  // ── Walking from room to room: a short fade, the old room freed, the next one built ──
  let swapping = false;
  const fade = document.createElement("div");
  Object.assign(fade.style, { position: "absolute", inset: "0", background: "#120e0b", opacity: "0", transition: "opacity 0.2s ease", pointerEvents: "none" });
  container.appendChild(fade);
  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const preloaded = new Set<RoomId>();
  /** Fetch a room's models before he gets there (walking to its door). */
  const preloadRoom = (id: RoomId) => {
    if (preloaded.has(id)) return;
    preloaded.add(id);
    for (const f of roomFiles(id, data.tier, data.cars, data.boots, data.bikeModel ?? null, data.stuff)) glb(f).catch(() => { /* the room shows without it */ });
  };
  let lastSwapMs = 0;
  async function goToRoom(to: RoomId, from: RoomId | null): Promise<boolean> {
    if (swapping || disposed || !rooms.includes(to) || to === room.id) return false;
    swapping = true;
    stopWalk();
    stick = { x: 0, y: 0 };
    speed = 0;
    if (near) { near = null; cb.onNear(null); }
    fade.style.opacity = "1";
    await wait(200);
    if (disposed) return false;
    const t0 = performance.now();
    room.dispose();
    room = buildRoom(env, roomIn, to);
    scene.add(room.group);
    fitSun();
    grid = null;
    framed = null; frame = 0; dwellZone = null; dwell = { timer: 0, open: false }; arrivedAt = null; spotWalk = null;
    const door = arrivalDoor(room.plan, from);
    const at = door ? arrivalAt(door, 1.5) : room.start; // far enough in that the camera has room behind him
    me.person.root.position.set(at.x, 0, at.z);
    yaw = at.yaw; yawTurn.vel = 0; me.person.root.rotation.y = yaw;
    camYaw = openCamYaw(at.x, at.z, yaw + Math.PI, ROOM_CAM.back, room.w2 - ROOM_CAM.wallGap, room.d2 - ROOM_CAM.wallGap); orb.reset(); first = true;
    meBlob.position.set(at.x, 0.012, at.z);
    try { await (hEnh ? hEnh.compile(scene, camera) : safeCompileAsync(renderer, scene, camera)); } catch { /* first use */ }
    shadowDirty = true;
    lastSwapMs = performance.now() - t0;
    void room.loadProps().then(() => { shadowDirty = true; });
    cb.onRoom?.(room.id, room.plan.label);
    fade.style.opacity = "0";
    swapping = false;
    return true;
  }

  // ── Changing clothes ──
  let wearQueue: Promise<void> = Promise.resolve();
  const disposePerson = (p: Person3D, wasCasual: boolean) => {
    p.root.parent?.remove(p.root);
    p.mixer.stopAllAction();
    p.root.traverse((o: any) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of ms) m.dispose?.();
      if (wasCasual && o.isSkinnedMesh && o.name !== "Outline") o.geometry?.dispose?.();
    });
  };
  const wear = (worn: Worn): Promise<void> => {
    wearQueue = wearQueue.then(async () => {
      if (disposed) return;
      const cur = me.worn;
      // same body, new colours: a repaint (a kit for a kit)
      if (cur.kind === "kit" && worn.kind === "kit") { repaintKit(THREE, me.person, wearIn(worn)); me.worn = worn; return; }
      if (cur.kind === "casual" && worn.kind === "casual" && cur.set.id === worn.set.id) return;
      changing = true;
      try {
        const next = await dressUp(worn);
        if (disposed) { disposePerson(next.person, worn.kind === "casual"); return; }
        const old = me;
        next.person.root.position.copy(old.person.root.position);
        next.person.root.rotation.y = yaw;
        scene.add(next.person.root);
        me = next;
        disposePerson(old.person, old.worn.kind === "casual");
        try { await (hEnh ? hEnh.compile(scene, camera) : safeCompileAsync(renderer, scene, camera)); } catch { /* first use */ }
        shadowDirty = true;
      } finally { changing = false; }
    });
    return wearQueue;
  };

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let first = true;
  let acc = 0, busy = true, busyT = 0, stillT = 0;
  const stepDown = (): boolean => {
    const next = stepDownTier(tier);
    if (!next) return false;
    tier = next; prof = TIER_PROFILES[tier];
    dyn = makeDyn(); dynPR = Math.min(dpr, prof.movePixelRatio);
    pr = stillPR(); renderer.setPixelRatio(pr);
    if (!prof.shadows) { sun.castShadow = false; renderer.shadowMap.enabled = false; }
    env.quality = tier; env.prof = prof;
    if (!MIRROR_PX[tier]) room.dropMirror();
    if (!prof.outlines) me.person.outline.visible = false;
    resize();
    return true;
  };
  void room.loadProps().then(() => { shadowDirty = true; });
  cb.onRoom?.(room.id, room.plan.label);

  const scratchCf = new THREE.Vector3(), scratchCr = new THREE.Vector3(), scratchShot = new THREE.Vector3(); // the loop makes no garbage
  renderer.setAnimationLoop(() => {
    if (disposed) return;
    let dt: number;
    if (opts.fixedStep) dt = opts.fixedStep;
    else {
      acc += Math.min(0.25, clock.getDelta());
      const cap = busy && !capAlways ? prof.fpsCap : prof.stillFps;
      govCap = cap;
      if (cap < 60 && acc < 1 / (cap + 1)) return;
      dt = Math.min(0.05, acc);
      gov.frame(performance.now(), govCap);
      acc = 0;
    }
    gameT += dt;
    const P = me.person.root.position;

    // input: the stick, else the keys, else a tap-walk
    let ix = stick.x, iy = stick.y;
    if (keys.size) {
      ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      iy = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const m = Math.hypot(ix, iy) || 1;
      const run = keys.has("shift") ? 1 : 0.4;
      ix = (ix / m) * run; iy = (iy / m) * run;
    }
    let mag = Math.min(1, Math.hypot(ix, iy));
    let wantYaw: number | null = null;
    if (mag >= 0.08) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      wantYaw = Math.atan2(fx * iy + rx * ix, fz * iy + rz * ix);
    } else if (walker.active) {
      const st = walker.step(P.x, P.z, dt);
      if (st) { wantYaw = st.yaw; mag = st.push * Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(angDiff(yaw, st.yaw))))); }
      else if (!walker.active && marker.visible) marker.fade();
    }
    // indoors: walk and jog only (a small room has no sprint)
    speed = approach(speed, Math.min(STROLL_SPEEDS.jog, stickTarget(mag, keys.has("shift"), STROLL_SPEEDS)), dt, STROLL_SPEEDS);
    if (changing) speed = 0;
    if (wantYaw !== null && !changing) yaw = turnTo(yawTurn, yaw, wantYaw, dt);
    else if (faceTo && speed < 0.4) {
      const d = angDiff(yaw, Math.atan2(faceTo[0] - P.x, faceTo[1] - P.z));
      yaw += d * Math.min(1, dt * 5);
      if (Math.abs(d) < 0.03) faceTo = null;
    }
    marker.update(dt);
    const [nx, nz] = collide(P.x + Math.sin(yaw) * speed * dt, P.z + Math.cos(yaw) * speed * dt);
    const moved = Math.abs(nx - P.x) + Math.abs(nz - P.z) > 1e-4;
    P.x = nx; P.z = nz;
    me.person.root.rotation.y = yaw;
    meBlob.position.set(nx, 0.012, nz);
    if (me.gait) me.gait.update(speed, dt, 1);
    else {
      const wWalk = Math.min(1, speed / 1.5), wIdle = Math.max(0, 1 - speed / 1.5);
      me.idle.setEffectiveWeight(wIdle); me.walk.setEffectiveWeight(wWalk); me.jog.setEffectiveWeight(0);
      me.walk.timeScale = Math.max(0.6, speed / 1.45);
    }
    me.person.mixer.update(dt);

    // which spot is he at? (the card opens only when he stops at it or turns to it: shop3d/dwell.ts)
    const zn = zoneAt(P.x, P.z);
    const zone = zn?.spot ?? null;
    if (zone !== dwellZone) { dwellZone = zone; dwell = { timer: 0, open: false }; }
    {
      const [fx, fz] = zn?.front ?? [0, 0];
      const dist = Math.hypot(fx - P.x, fz - P.z);
      const faceOff = angDiff(yaw, Math.atan2(fx - P.x, fz - P.z));
      dwell = stepDwell(dwell.timer, dwell.open, { inZone: !!zone, dist, speed, faceOff, arrived: !!zone && arrivedAt === zone }, dt);
      if (arrivedAt && arrivedAt === zone) arrivedAt = null;
    }
    const now: HomeSpot | null = dwell.open ? zone : null;
    if (now !== near) { near = now; cb.onNear(near); }

    // camera: behind him; a card open frames its spot
    camYaw += orb.step(dt);
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) camYaw += angDiff(camYaw, openCamYaw(P.x, P.z, yaw + Math.PI, ROOM_CAM.back, W2 - ROOM_CAM.wallGap, D2 - ROOM_CAM.wallGap)) * Math.min(1, dt * 1.6);
    const shot = framed ? shotOf(framed) : null;
    frame += ((shot && orbitHold <= 0 ? 1 : 0) - frame) * Math.min(1, dt * 2.6);
    // Harry, 9 Oct 2026: the camera sat jammed behind his head in every room. Now it stands
    // back and up, like a room view in a third-person game, looking down past him into the
    // room; where a wall is closer than that, the boom shortens and the camera rises instead
    // (it never goes through a wall), so the room still reads.
    const back = Math.min(ROOM_CAM.back, Math.max(W2, D2) * 2 * 0.55);
    const cf = scratchCf.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const crr = scratchCr.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const ceil = H - ROOM_CAM.ceilingGap;
    const [camUp0, camBack0] = orb.lift(Math.min(ceil, ROOM_CAM.height), back, ROOM_CAM.lookY);
    const room2 = roomCamBoom(P.x, P.z, -cf.x, -cf.z, camBack0, W2 - ROOM_CAM.wallGap, D2 - ROOM_CAM.wallGap);
    const short = camBack0 - room2;
    const camUp = Math.min(ceil, camUp0 + short * ROOM_CAM.riseIfShort);
    want.set(P.x, camUp, P.z).addScaledVector(cf, -room2).addScaledVector(crr, 0.2);
    wantLook.set(P.x, ROOM_CAM.lookY, P.z).addScaledVector(cf, ROOM_CAM.lookAhead + short * 0.5).addScaledVector(crr, 0.1);
    if (shot) { want.lerp(scratchShot.set(...shot.cam), frame); wantLook.lerp(scratchShot.set(...shot.look), frame); }
    const inRoom = (v: any) => { v.x = Math.max(-W2 + 0.25, Math.min(W2 - 0.25, v.x)); v.z = Math.max(-D2 + 0.25, Math.min(D2 - 0.25, v.z)); v.y = Math.max(CAM_MIN_Y, Math.min(H - 0.15, v.y)); };
    inRoom(want);
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; }
    else { camPos.lerp(want, Math.min(1, dt * 5)); camLook.lerp(wantLook, Math.min(1, dt * 6)); }
    inRoom(camPos);
    if (dbgCam) { camera.position.set(...dbgCam.pos); camera.lookAt(...dbgCam.look); }
    else { camera.position.copy(camPos); camera.lookAt(camLook); }
    // a card open: the picture slides up so the spot sits above the card
    const vw = container.clientWidth || 1, vh = container.clientHeight || 1;
    const offY = dbgCam ? 0 : Math.round(frame * (framed === "wardrobe" ? 0.24 : 0.17) * vh);
    if (offY !== lastOff) { lastOff = offY; if (offY > 0) camera.setViewOffset(vw, vh, 0, offY, vw, vh); else camera.clearViewOffset(); }

    // the mirror: live only near it, or with the wardrobe open
    if (room.mirror) room.mirror.visible = framed === "wardrobe" || room.mirrorNear(P.x, P.z) || !!dbgCam;
    // fetch the next room's models while he walks to its door
    if (!swapping) for (const d of room.doors) if (d.to !== "garden" && !preloaded.has(d.to) && Math.hypot(P.x - d.x, P.z - d.z) < 2.6) preloadRoom(d.to);
    // the sun's shadow: drawn again only while something moves under it
    if (sun.castShadow) {
      shadowT -= dt;
      if (shadowDirty || ((moved || speed > 0.05) && shadowT <= 0)) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; shadowT = 0.1; }
    }
    if (hEnh) hEnh.render(scene, camera); else renderer.render(scene, camera);

    busy = speed > 0.05 || mag > 0.05 || walker.active || orbitHold > 0 || orb.moving || !!faceTo || changing || Math.abs(frame - (shot && orbitHold <= 0 ? 1 : 0)) > 0.01 || camPos.distanceToSquared(want) > 1e-4;
    if (busy) { busyT += dt; stillT = 0; } else { stillT += dt; busyT = 0; }
    if (!opts.fixedStep) {
      if (busy && !capAlways) dyn.frame(performance.now()); else dyn.pause();
      const wantPR = busyT > 0.25 ? movePR() : stillT > 0.5 ? stillPR() : pr;
      if (wantPR !== pr) { pr = wantPR; renderer.setPixelRatio(pr); lastOff = -1; }
    }
    frames++;
    const nowMs = performance.now();
    if (nowMs - fpsT0 >= 1000) { cb.onFps?.(Math.round((frames * 1000) / (nowMs - fpsT0))); frames = 0; fpsT0 = nowMs; }
  });

  const ray = new THREE.Raycaster();
  const ndc = (px: number, py: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
  };
  const ctrl: HomeController = {
    setStick: (x, y) => { stick = { x, y }; if (Math.hypot(x, y) > 0.05) stopWalk(); },
    orbit: (dx, dy = 0) => { orb.drag(dx, dy); orbitHold = 1.5; },
    pick: (px, py) => {
      ray.setFromCamera(ndc(px, py), camera);
      const hit = ray.intersectObjects(room.pickables, false)[0];
      return (hit?.object?.userData?.spot as HomeSpot | undefined) ?? null;
    },
    tap: (px, py) => {
      const s = ctrl.pick(px, py);
      if (s) { ctrl.walkToSpot(s); return { spot: s }; }
      ray.setFromCamera(ndc(px, py), camera);
      const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (!hit || Math.abs(hit.x) > W2 || Math.abs(hit.z) > D2) return null;
      return walkTo([hit.x, hit.z], null) ? { spot: null } : null;
    },
    walkToSpot: (s) => { const t = standFor(s); const ok = walkTo(t.at, t.face); if (ok) spotWalk = s; return ok; },
    setCardOpen: (s) => {
      framed = s;
      if (s) orbitHold = 0;
      // the wardrobe: step across to the mirror and face it
      if (s === "wardrobe") {
        const p = me.person.root.position;
        const ms = room.mirrorSpot, mf = room.mirrorFace;
        if (ms && mf) {
          if (Math.hypot(p.x - ms[0], p.z - ms[1]) > 0.35) walkTo(ms, mf);
          else faceTo = mf;
        }
      }
    },
    wear,
    place: (x, z, y = yaw) => { stopWalk(); me.person.root.position.set(x, 0, z); yaw = y; camYaw = y + Math.PI; orb.reset(); first = true; shadowDirty = true; },
    where: () => ({ x: me.person.root.position.x, z: me.person.root.position.z, yaw, t: gameT, changing }),
    debugCamera: (pos, look = [0, 1, 0]) => { dbgCam = pos ? { pos, look } : null; lastOff = -1; },
    plan: () => ({ tier: data.tier, room: room.id, rooms, w: W2 * 2, d: D2 * 2, h: H, mirror: room.mirrorSpot, doors: room.doors, spots: room.plan.spots, slots: data.slots.length }),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), quality: tier, merged: room.frozen, mirror: !!room.mirror?.visible, room: room.id, swapMs: Math.round(lastSwapMs) }),
    room: () => room.id,
    rooms: () => rooms.map((id) => ({ id, label: roomPlan(data.tier, id, rooms).label })),
    goToRoom: (id) => goToRoom(id, null),
    dispose: () => {
      disposed = true;
      gov.dispose();
      hEnh?.dispose();
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      marker.dispose();
      room.dispose();
      fade.remove();
      glbCache.forEach((pr) => pr.then((g: any) => disposeGroup(g.scene)).catch(() => { /* never loaded */ }));
      scene.traverse((o: any) => {
        if (!o.isSkinnedMesh) o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); });
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
  return ctrl;
}
