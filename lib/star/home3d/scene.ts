/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * YOUR HOME, IN 3D — one room you walk round, built like the 3D shop and the
 * garden (Harry, 9 Oct 2026: "imagine you actually had your current house with
 * all your stuff and that's where you change clothes").
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
import { freezeStatic } from "../freezeStatic";
import { numberCanvas, blobCanvas } from "../shop3d/textures";
import { roomPreset, type HomeTier } from "./homes";
import type { CabinetSlot, TrophyShape } from "./trophies";
import type { Worn, BootChoice, Kit2, CasualSet } from "./outfits";
import { buildWearer, repaintKit, type WearInput } from "./wear";
import {
  floorCanvas, wallCanvas, floorShadeCanvas, glowCanvas, patchCanvas, viewCanvas,
  driveBackCanvas, driveCanvas, platesCanvas, signCanvas,
} from "./textures";

export type HomeSpot = "wardrobe" | "cabinet" | "drive";

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
}

export interface HomeCallbacks {
  /** He is standing at a spot (its card should open), or left it. */
  onNear: (spot: HomeSpot | null) => void;
  onFps?: (fps: number) => void;
  /** He walked out of the front door (to the 3D garden). Absent: the door is shut. */
  onDoor?: () => void;
  /** The phone took the 3D away. */
  onContextLost?: () => void;
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
  stats: () => { calls: number; triangles: number; pixelRatio: number; quality: string; merged?: { before: number; after: number }; mirror: boolean };
  dispose: () => void;
}

/** The mirror's own drawing layer: only what the mirror should show. */
const MIRROR_LAYER = 5;

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
  const R = roomPreset(data.tier);
  const W2 = R.w / 2, D2 = R.d / 2, H = R.h;
  const THREE: any = await import("three");
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

  // ── Helpers ──
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });
  const glowM = (c: string, i = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  const tex = (cv: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = prof.anisotropy;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  const mirrorSees: any[] = [];
  const seen = (o: any) => { o.traverse((c: any) => c.layers.enable(MIRROR_LAYER)); mirrorSees.push(o); return o; };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, o: { cast?: boolean; parent?: any } = {}) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.receiveShadow = true;
    me.castShadow = !!o.cast;
    (o.parent ?? scene).add(me);
    return me;
  };
  const plane = (w: number, h: number, m: any, x: number, y: number, z: number, rx = 0, ry = 0) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(x, y, z);
    me.rotation.set(rx, ry, 0);
    scene.add(me);
    return me;
  };
  const glowT = tex(glowCanvas());
  const patchT = tex(patchCanvas());
  /** A painted light: an additive glow (costs one cheap draw, no light). */
  const glow = (t: any, colour: string, k: number, w: number, h: number, x: number, y: number, z: number, rx: number, ry: number) => {
    const me = plane(w, h, new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(colour).multiplyScalar(k), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), x, y, z, rx, ry);
    me.renderOrder = 2;
    return me;
  };
  const blobT = tex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, opacity = 0.9) => {
    const me = plane(w, d, new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }), x, 0.012, z, -Math.PI / 2);
    me.renderOrder = 1;
    return me;
  };

  // ── The plan (metres; north is -z) ──
  const T_WALL = 0.12;
  /** The wardrobe along the west wall, then the mirror. */
  const WARD = { z0: -D2 + 0.45, z1: -D2 + 0.45 + R.wardrobe, depth: 0.62, h: Math.min(2.25, H - 0.2) };
  const MIRROR = { z: WARD.z1 + 0.6, w: 0.74, h: 1.8, y: 0.12 };
  /** The trophy cabinet on the back wall. */
  const CAB = { cols: R.cabinet.cols, rows: R.cabinet.rows, cw: 0.6, rh: 0.42, base: 0.5, depth: 0.42 };
  const cabW = CAB.cols * CAB.cw + 0.2;
  const cabH = CAB.base + CAB.rows * CAB.rh + 0.12;
  /** The drive window in the east wall. */
  const DRIVE = { z: -R.d * 0.08, w: Math.min(3.4, R.d - 2.6), y0: 0.55, y1: Math.min(H - 0.3, 2.4) };
  /** The back windows, either side of the cabinet. */
  const side = W2 - cabW / 2;
  const bwW = Math.max(0.8, Math.min(1.7, side - 0.6));
  const BACKWIN = (R.backWindows === 2 ? [-1, 1] : [1]).map((s) => ({ x: s * (cabW / 2 + 0.3 + bwW / 2), w: bwW, y0: 0.85, y1: Math.min(H - 0.35, 2.35) }));
  /** The front door out to the garden. */
  const DOOR = { half: 0.55, h: 2.15 };
  /** The sofa against the front wall, right of the door. */
  const SOFA = { x0: DOOR.half + 0.5, x1: Math.min(W2 - 0.35, DOOR.half + 0.5 + 2.1), z: D2 - 0.48, d: 0.85 };

  // ── The room ──
  const floorT = tex(floorCanvas(R.floor), [R.w / (R.floor === "marble" || R.floor === "stone" ? 2.2 : 1.6), R.d / (R.floor === "marble" || R.floor === "stone" ? 2.2 : 1.6)]);
  const floorM = mat("#ffffff", { map: floorT, roughness: R.floor === "carpet" ? 0.95 : R.floor === "marble" ? 0.18 : R.floor === "stone" ? 0.5 : 0.42, metalness: 0 });
  const floor = plane(R.w, R.d, floorM, 0, 0, 0, -Math.PI / 2);
  floor.receiveShadow = true;
  seen(floor);
  // the painted shade round the floor's edge (the corners, the foot of each wall)
  const shadeM = new THREE.MeshBasicMaterial({ map: tex(floorShadeCanvas()), transparent: true, depthWrite: false });
  const fshade = plane(R.w, R.d, shadeM, 0, 0.004, 0, -Math.PI / 2);
  fshade.renderOrder = 1;
  seen(fshade);
  const wallT = tex(wallCanvas(R.wall));
  const wallM = mat("#ffffff", { map: wallT, roughness: 0.92 });
  const panelM = mat(R.panel, { roughness: R.tier === "estate" ? 0.45 : 0.7 });
  const trimM = mat(R.trim, { roughness: 0.5 });
  const metalM = mat(R.metal, { roughness: 0.32, metalness: 0.85 });
  /**
   * One wall, with openings: `along` x or z, at `at`, from -len/2..len/2,
   * holes as { c (centre along), w, y0, y1 }. Pieces between and round the holes.
   */
  type Hole = { c: number; w: number; y0: number; y1: number };
  const wall = (along: "x" | "z", at: number, len: number, holes: Hole[], m: any, y0 = 0, y1 = H, thick = T_WALL, inset = 0) => {
    const out: any[] = [];
    const put = (a0: number, a1: number, b0: number, b1: number) => {
      if (a1 - a0 < 0.01 || b1 - b0 < 0.01) return;
      const c = (a0 + a1) / 2, l = a1 - a0, hy = b1 - b0;
      const me = along === "x" ? box(l, hy, thick, m, c, (b0 + b1) / 2, at + inset) : box(thick, hy, l, m, at + inset, (b0 + b1) / 2, c);
      out.push(me);
    };
    const hs = [...holes].sort((a, b) => a.c - b.c);
    let a = -len / 2;
    for (const h of hs) {
      put(a, h.c - h.w / 2, y0, y1);
      put(h.c - h.w / 2, h.c + h.w / 2, y0, Math.max(y0, Math.min(y1, h.y0)));
      put(h.c - h.w / 2, h.c + h.w / 2, Math.min(y1, Math.max(y0, h.y1)), y1);
      a = h.c + h.w / 2;
    }
    put(a, len / 2, y0, y1);
    return out;
  };
  const backHoles: Hole[] = BACKWIN.map((b) => ({ c: b.x, w: b.w, y0: b.y0, y1: b.y1 }));
  const eastHoles: Hole[] = [{ c: DRIVE.z, w: DRIVE.w, y0: DRIVE.y0, y1: DRIVE.y1 }];
  const doorHoles: Hole[] = [{ c: 0, w: DOOR.half * 2, y0: 0, y1: DOOR.h }];
  const backWall = wall("x", -D2 - T_WALL / 2, R.w + T_WALL * 2, backHoles, wallM);
  wall("z", -W2 - T_WALL / 2, R.d, [], wallM);
  const eastWall = wall("z", W2 + T_WALL / 2, R.d, eastHoles, wallM);
  const frontWall = wall("x", D2 + T_WALL / 2, R.w + T_WALL * 2, doorHoles, wallM);
  // the mirror shows the room's far side: the east wall and its window, the front wall
  for (const m of [...eastWall, ...frontWall, ...backWall]) seen(m);
  // the ceiling
  const ceil = plane(R.w, R.d, mat(R.trim, { roughness: 0.95 }), 0, H, 0, Math.PI / 2);
  void ceil;
  // panelling to the dado rail (villa, estate), skirting everywhere, a cornice
  const dado = 1.0;
  if (R.panelled) {
    wall("x", -D2, R.w, backHoles, panelM, 0, dado, 0.03, 0.03);
    wall("z", -W2, R.d, [], panelM, 0, dado, 0.03, 0.03);
    wall("z", W2, R.d, eastHoles, panelM, 0, dado, 0.03, -0.03);
    wall("x", D2, R.w, doorHoles, panelM, 0, dado, 0.03, -0.03);
    for (const [al, at, len, holes, sgn] of [["x", -D2, R.w, backHoles, 1], ["z", -W2, R.d, [], 1], ["z", W2, R.d, eastHoles, -1], ["x", D2, R.w, doorHoles, -1]] as ["x" | "z", number, number, Hole[], number][]) {
      wall(al, at, len, holes.map((h) => ({ ...h, y0: Math.min(h.y0, dado + 0.04) })), trimM, dado, dado + 0.04, 0.05, sgn * 0.045);
    }
  }
  for (const [al, at, len, holes, sgn] of [["x", -D2, R.w, backHoles, 1], ["z", -W2, R.d, [], 1], ["z", W2, R.d, eastHoles, -1], ["x", D2, R.w, doorHoles, -1]] as ["x" | "z", number, number, Hole[], number][]) {
    wall(al, at, len, holes, trimM, 0, 0.11, 0.025, sgn * 0.02); // skirting
    wall(al, at, len, [], trimM, H - 0.09, H, 0.06, sgn * 0.035); // cornice
  }

  // ── Windows: frames, glass, what is outside ──
  const frameM = mat(R.tier === "penthouse" ? "#2b2b2e" : R.trim, { roughness: 0.45 });
  const glassM = new THREE.MeshStandardMaterial({ color: "#cfe3f4", transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.2, depthWrite: false });
  const winFrame = (along: "x" | "z", at: number, sgn: number, h: Hole, glass = true) => {
    const t = 0.07, dd = 0.16;
    const pc = (l: number, hh: number, a: number, y: number) => (along === "x" ? box(l, hh, dd, frameM, a, y, at + sgn * 0.0) : box(dd, hh, l, frameM, at, y, a));
    pc(h.w + t * 2, t, h.c, h.y1 + t / 2);
    pc(h.w + t * 2, t, h.c, h.y0 - t / 2);
    pc(t, h.y1 - h.y0, h.c - h.w / 2 - t / 2, (h.y0 + h.y1) / 2);
    pc(t, h.y1 - h.y0, h.c + h.w / 2 + t / 2, (h.y0 + h.y1) / 2);
    // a sill inside, a mullion in a wide window
    if (along === "x") box(h.w + 0.2, 0.04, 0.24, trimM, h.c, h.y0 - 0.02, at + sgn * 0.1);
    else box(0.24, 0.04, h.w + 0.2, trimM, at + sgn * 0.1, h.y0 - 0.02, h.c);
    if (h.w > 1.8) pc(0.05, h.y1 - h.y0, h.c, (h.y0 + h.y1) / 2);
    if (!glass) return;
    const g = along === "x" ? plane(h.w, h.y1 - h.y0, glassM, h.c, (h.y0 + h.y1) / 2, at) : plane(h.w, h.y1 - h.y0, glassM, at, (h.y0 + h.y1) / 2, h.c, 0, Math.PI / 2);
    g.renderOrder = 3;
  };
  for (const h of backHoles) winFrame("x", -D2, 1, h);
  winFrame("z", W2, -1, eastHoles[0]);
  // the back windows' view: one painted plane outside
  const viewM = new THREE.MeshBasicMaterial({ map: tex(viewCanvas(R.view)), fog: false });
  plane(R.w + 7, 7.5, viewM, 0, 2.1, -D2 - 3.4);
  // the drive: ground, the backdrop across it, the cars (loaded below)
  const driveT = tex(driveCanvas(R.drive), [6, 8]);
  const driveG = plane(12, 18, mat("#ffffff", { map: driveT, roughness: 0.95 }), W2 + 6, -0.02, 0, -Math.PI / 2);
  driveG.receiveShadow = true;
  seen(driveG);
  const driveBack = plane(22, 8, new THREE.MeshBasicMaterial({ map: tex(driveBackCanvas(R.drive)), fog: false }), W2 + 9.5, 3.4, 0, 0, -Math.PI / 2);
  seen(driveBack);
  if (R.drive === "street") { box(0.25, 0.14, 18, mat("#a9adb1", { roughness: 0.9 }), W2 + 1.2, 0.05, 0); }
  // the door out to the garden: a bright garden beyond it, a sign over it
  const doorView = new THREE.MeshBasicMaterial({ map: tex(viewCanvas("garden")), fog: false });
  plane(5, 4, doorView, 0, 1.6, D2 + 2.2, 0, Math.PI);
  winFrame("x", D2, -1, { c: 0, w: DOOR.half * 2, y0: 0.0001, y1: DOOR.h }, false);
  const signM = new THREE.MeshBasicMaterial({ map: tex(signCanvas(cb.onDoor ? "GARDEN" : "HOME")), transparent: true });
  plane(0.9, 0.225, signM, 0, Math.min(H - 0.2, DOOR.h + 0.25), D2 - 0.02, 0, Math.PI);
  // the sun's patches on the floor, the light through the door
  glow(patchT, "#ffd9a0", 0.32, 1.9, DRIVE.w * 0.95, W2 - 1.2, 0.008, DRIVE.z + 0.35, -Math.PI / 2, 0);
  for (const b of BACKWIN) glow(patchT, "#ffe6c0", 0.14, b.w * 0.9, 1.2, b.x + 0.15, 0.007, -D2 + 0.75, -Math.PI / 2, 0);
  glow(patchT, "#fff0d6", 0.16, DOOR.half * 2, 1.4, 0, 0.007, D2 - 0.75, -Math.PI / 2, 0);

  // ── Ceiling lights (emissive discs; the chandelier on the grand tiers) ──
  const downG = new THREE.CircleGeometry(0.09, 18);
  const downM = glowM("#fff1d6", 3);
  for (const x of [-W2 * 0.5, W2 * 0.5]) for (const z of [-D2 * 0.5, D2 * 0.45]) {
    const d = new THREE.Mesh(downG, downM);
    d.rotation.x = Math.PI / 2;
    d.position.set(x, H - 0.01, z);
    scene.add(d);
  }
  if (R.chandelier) {
    const cy = H - 0.75;
    box(0.02, 0.6, 0.02, metalM, 0, H - 0.3, 0.3);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 32), metalM);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, cy, 0.3); scene.add(ring);
    const crystalG = new THREE.OctahedronGeometry(0.06, 0);
    const crystalM = glowM("#fff6e0", 2.4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const c = new THREE.Mesh(crystalG, crystalM);
      c.position.set(Math.cos(a) * 0.42, cy - 0.12, 0.3 + Math.sin(a) * 0.42);
      c.scale.set(0.7, 1.4, 0.7);
      scene.add(c);
    }
    glow(glowT, "#ffe2b0", 0.18, 2.6, 2.6, 0, H - 0.02, 0.3, Math.PI / 2, 0);
  }

  // ── Furniture: a sofa and table by the door, a rug, a floor lamp, plants ──
  const fabricM = mat(R.tier === "estate" ? "#5b2a2a" : R.tier === "villa" ? "#e8e0d0" : R.tier === "penthouse" ? "#3a3d44" : "#6d7b8a", { roughness: 0.95 });
  const woodM = mat(R.tier === "estate" || R.tier === "villa" ? "#4a2e1c" : R.tier === "penthouse" ? "#1e1e22" : "#d8d0c2", { roughness: 0.55 });
  const sofaL = Math.max(0, SOFA.x1 - SOFA.x0);
  const solids: [number, number, number, number][] = [];
  if (sofaL > 1.2) {
    const cx = (SOFA.x0 + SOFA.x1) / 2;
    box(sofaL, 0.42, SOFA.d, fabricM, cx, 0.21, SOFA.z, { cast: true });
    box(sofaL, 0.5, 0.2, fabricM, cx, 0.62, SOFA.z + SOFA.d / 2 - 0.1, { cast: true });
    box(0.18, 0.28, SOFA.d, fabricM, SOFA.x0 + 0.09, 0.56, SOFA.z, { cast: true });
    box(0.18, 0.28, SOFA.d, fabricM, SOFA.x1 - 0.09, 0.56, SOFA.z, { cast: true });
    solids.push([SOFA.x0, SOFA.x1, SOFA.z - SOFA.d / 2, D2]);
    // the coffee table
    const tz = SOFA.z - SOFA.d / 2 - 0.55;
    box(Math.min(1.1, sofaL * 0.6), 0.05, 0.55, woodM, cx, 0.42, tz, { cast: true });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.04, 0.4, 0.04, woodM, cx + sx * (Math.min(1.1, sofaL * 0.6) / 2 - 0.05), 0.2, tz + sz * 0.22);
    solids.push([cx - 0.6, cx + 0.6, tz - 0.32, tz + 0.32]);
  }
  // the rug
  const rugW = Math.min(R.w * 0.5, 3.4), rugD = Math.min(R.d * 0.38, 2.6);
  const rugM = mat(R.tier === "estate" ? "#6b2a2a" : R.tier === "villa" ? "#c9b48e" : R.tier === "starter" ? "#5e6a74" : "#7d6a58", { roughness: 1 });
  const rug = plane(rugW, rugD, rugM, 0.35, 0.006, 0.3, -Math.PI / 2);
  rug.receiveShadow = true;
  seen(rug);
  // the floor lamp in the front-left corner and its pool of light up the wall
  const lampX = -W2 + 0.45, lampZ = D2 - 0.45;
  box(0.3, 0.03, 0.3, metalM, lampX, 0.015, lampZ);
  box(0.03, 1.45, 0.03, metalM, lampX, 0.75, lampZ);
  const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.26, 18, 1, true), glowM("#ffd9a0", 1.3));
  shadeMesh.position.set(lampX, 1.55, lampZ);
  scene.add(shadeMesh);
  glow(glowT, "#ffcf8a", 0.28, 1.6, 2.2, lampX + 0.6, 1.5, D2 - 0.02, 0, Math.PI);
  glow(glowT, "#ffcf8a", 0.22, 1.6, 2.2, -W2 + 0.02, 1.5, lampZ - 0.5, 0, Math.PI / 2);
  solids.push([lampX - 0.2, lampX + 0.2, lampZ - 0.2, lampZ + 0.2]);
  // plants: corners left free by the cabinet and windows
  const potM = mat(R.metal, { roughness: 0.4, metalness: 0.6 });
  const leafM = mat("#2f5a35", { flatShading: true, roughness: 0.85 });
  const plantAt = [[W2 - 0.4, D2 - 0.4], [W2 - 0.4, -D2 + 0.4], [-W2 + 0.4, MIRROR.z + 0.9], [cabW / 2 + 0.25, -D2 + 0.35]].slice(0, R.plants)
    .filter(([x, z]) => !(x > SOFA.x0 - 0.3 && x < SOFA.x1 + 0.3 && z > SOFA.z - 0.6) && z < D2 - 0.2 && Math.abs(x) < W2);
  for (const [x, z] of plantAt) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 16), potM);
    pot.position.set(x, 0.21, z); pot.castShadow = true; scene.add(pot);
    const lv = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), leafM);
    lv.position.set(x, 0.85, z); lv.scale.set(1, 1.4, 1); lv.castShadow = true; scene.add(lv);
    blob(0.8, 0.8, x, z);
    solids.push([x - 0.25, x + 0.25, z - 0.25, z + 0.25]);
  }

  // ── The wardrobe (west wall) ──
  const lacquer = R.tier === "estate" || R.tier === "villa" ? mat("#4a2e1c", { roughness: 0.45 }) : R.tier === "penthouse" ? mat("#2a2a2e", { roughness: 0.4 }) : mat("#ece7de", { roughness: 0.55 });
  const innerM = mat(R.tier === "estate" || R.tier === "villa" ? "#6b4a32" : "#f4efe6", { roughness: 0.7 });
  const wx = -W2 + WARD.depth / 2, wl = WARD.z1 - WARD.z0, wzc = (WARD.z0 + WARD.z1) / 2;
  box(0.03, WARD.h, wl, innerM, -W2 + 0.03, WARD.h / 2, wzc); // back
  box(WARD.depth, 0.05, wl + 0.06, lacquer, wx, WARD.h, wzc, { cast: true }); // top
  box(WARD.depth, 0.06, wl + 0.06, lacquer, wx, 0.03, wzc); // floor
  for (const z of [WARD.z0, WARD.z1]) box(WARD.depth, WARD.h, 0.04, lacquer, wx, WARD.h / 2, z, { cast: true }); // ends
  box(WARD.depth - 0.04, 0.03, wl - 0.04, lacquer, wx, 0.36, wzc); // the boot shelf
  const railY = WARD.h - 0.22;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, wl - 0.06, 10), metalM);
  rail.rotation.x = Math.PI / 2; rail.position.set(-W2 + 0.32, railY, wzc); scene.add(rail);
  // a warm strip of light under the top (painted)
  box(0.03, 0.02, wl - 0.1, glowM("#ffd9a0", 2.0), -W2 + 0.45, WARD.h - 0.05, wzc);
  glow(glowT, "#ffcf8a", 0.16, wl * 1.1, 1.8, -W2 + 0.06, WARD.h - 0.8, wzc, 0, Math.PI / 2);
  solids.push([-W2, -W2 + WARD.depth + 0.02, WARD.z0 - 0.04, WARD.z1 + 0.04]);

  /** The garments on the rail: one mesh, painted by vertex colour (each casual set, then the two kits). */
  const garments = (() => {
    const items: { top: string; low: string; kit: boolean }[] = [
      ...data.casual.map((s) => { const [a, b] = s.swatch(data.kits.home); return { top: a, low: b, kit: false }; }),
      { top: data.kits.home.shirt, low: data.kits.home.trim, kit: true },
      { top: data.kits.away.shirt, low: data.kits.away.trim, kit: true },
    ];
    const step = (wl - 0.22) / Math.max(1, items.length - 1);
    const parts: any[] = [];
    const piece = (g: any, colour: string, m: any) => {
      g.applyMatrix4(m);
      const ng = g.index ? g.toNonIndexed() : g;
      const c = new THREE.Color(colour);
      const n = ng.attributes.position.count;
      const cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
      ng.setAttribute("color", new THREE.BufferAttribute(cols, 3));
      ng.deleteAttribute("uv");
      parts.push(ng);
    };
    const M = (x: number, y: number, z: number, ry: number, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), new THREE.Vector3(1, 1, 1));
    items.forEach((it, i) => {
      const z = WARD.z0 + 0.11 + i * step;
      const x = -W2 + 0.32;
      const ry = 1.15; // mostly side-on, as clothes hang on a rail, a little of the front showing
      const top = railY - 0.06;
      const L = (lx: number, ly: number, lz: number) => new THREE.Vector3(lx, ly, lz).applyEuler(new THREE.Euler(0, ry, 0)).add(new THREE.Vector3(x, 0, z));
      const at = (lx: number, ly: number, rz = 0) => { const p = L(lx, 0, 0); return M(p.x, ly, p.z, ry, rz); };
      // hook and shoulders
      piece(new THREE.CylinderGeometry(0.006, 0.006, 0.07, 6), "#9aa0a6", at(0, top + 0.035));
      piece(new THREE.BoxGeometry(0.4, 0.06, 0.06), it.top, at(0, top - 0.03));
      // the body of the top, the sleeves (short on a kit)
      piece(new THREE.BoxGeometry(0.4, it.kit ? 0.5 : 0.62, 0.07), it.top, at(0, top - (it.kit ? 0.28 : 0.34)));
      const sl = it.kit ? 0.18 : 0.5;
      piece(new THREE.BoxGeometry(0.11, sl, 0.06), it.top, at(-0.24, top - 0.03 - sl / 2, -0.18));
      piece(new THREE.BoxGeometry(0.11, sl, 0.06), it.top, at(0.24, top - 0.03 - sl / 2, 0.18));
      // under it, what goes with it: shorts for a kit, trousers for a set (hung over a bar)
      if (it.kit) piece(new THREE.BoxGeometry(0.34, 0.2, 0.05), it.low, at(0, top - 0.66));
      else {
        piece(new THREE.BoxGeometry(0.15, 0.55, 0.05), it.low, at(-0.08, top - 0.97));
        piece(new THREE.BoxGeometry(0.15, 0.55, 0.05), it.low, at(0.08, top - 0.97));
      }
    });
    const merged = mergeGeometries(parts);
    for (const p of parts) p.dispose();
    const me = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    me.castShadow = true; me.receiveShadow = true;
    scene.add(me);
    return me;
  })();

  // ── The mirror (full length, beside the wardrobe) ──
  const mx = -W2 + 0.035;
  const mFrameM = metalM;
  box(0.04, MIRROR.h + 0.1, 0.06, mFrameM, mx, MIRROR.y + MIRROR.h / 2, MIRROR.z - MIRROR.w / 2 - 0.02);
  box(0.04, MIRROR.h + 0.1, 0.06, mFrameM, mx, MIRROR.y + MIRROR.h / 2, MIRROR.z + MIRROR.w / 2 + 0.02);
  box(0.04, 0.06, MIRROR.w + 0.1, mFrameM, mx, MIRROR.y + MIRROR.h + 0.02, MIRROR.z);
  box(0.04, 0.06, MIRROR.w + 0.1, mFrameM, mx, MIRROR.y - 0.02, MIRROR.z);
  // behind the live mirror: dark glass (what you see from far off, and on Low)
  const darkGlass = plane(MIRROR.w, MIRROR.h, mat("#3a4048", { roughness: 0.08, metalness: 0.9, envMapIntensity: 1.2 }), mx - 0.004, MIRROR.y + MIRROR.h / 2, MIRROR.z, 0, Math.PI / 2);
  void darkGlass;
  const MIRROR_PX: Record<Quality3d, number> = { low: 0, medium: 256, high: 384 };
  let mirror: any = null;
  const makeMirror = () => {
    const px = MIRROR_PX[tier];
    if (!px) return null;
    const m = new Reflector(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), { textureWidth: px, textureHeight: Math.round((px * MIRROR.h) / MIRROR.w), color: 0xd8dde2, clipBias: 0.003 });
    m.position.set(mx + 0.002, MIRROR.y + MIRROR.h / 2, MIRROR.z);
    m.rotation.y = Math.PI / 2;
    // the mirror draws only its own layer: you, the floor, the far walls and the drive
    m.camera.layers.set(MIRROR_LAYER);
    m.visible = false;
    scene.add(m);
    return m;
  };
  mirror = makeMirror();
  solids.push([-W2, -W2 + 0.12, MIRROR.z - MIRROR.w / 2 - 0.05, MIRROR.z + MIRROR.w / 2 + 0.05]);

  // ── The trophy cabinet (back wall) ──
  const cabZ = -D2 + CAB.depth / 2 + 0.02;
  const cabWoodM = R.tier === "estate" || R.tier === "villa" ? mat("#3b2416", { roughness: 0.4 }) : R.tier === "penthouse" ? mat("#1c1c20", { roughness: 0.35 }) : mat("#5a4030", { roughness: 0.5 });
  box(cabW, CAB.base, CAB.depth, cabWoodM, 0, CAB.base / 2, cabZ, { cast: true }); // the cupboard under it
  box(cabW + 0.06, 0.05, CAB.depth + 0.04, cabWoodM, 0, cabH, cabZ, { cast: true }); // the top
  box(cabW, cabH - CAB.base, 0.03, mat("#2a1d14", { roughness: 0.6, emissive: "#3a2410", emissiveIntensity: 0.5 }), 0, (CAB.base + cabH) / 2, -D2 + 0.035); // a warm-lit back
  for (const sx of [-1, 1]) box(0.05, cabH - CAB.base, CAB.depth, cabWoodM, sx * (cabW / 2 - 0.025), (CAB.base + cabH) / 2, cabZ, { cast: true });
  for (let c = 1; c < CAB.cols; c++) box(0.025, cabH - CAB.base - 0.02, CAB.depth - 0.04, cabWoodM, -cabW / 2 + 0.1 + c * CAB.cw, (CAB.base + cabH) / 2, cabZ);
  const shelfM = new THREE.MeshStandardMaterial({ color: "#dfe8ee", transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
  for (let r = 1; r < CAB.rows; r++) box(cabW - 0.1, 0.02, CAB.depth - 0.05, shelfM, 0, CAB.base + r * CAB.rh, cabZ);
  // each shelf's light: a strip under the shelf above (emissive) and a painted wash on the back
  for (let r = 0; r < CAB.rows; r++) {
    const y = CAB.base + (r + 1) * CAB.rh - 0.02;
    box(cabW - 0.14, 0.012, 0.02, glowM("#fff1d6", 2.4), 0, y - 0.01, cabZ + CAB.depth / 2 - 0.06);
  }
  glow(glowT, "#ffe0a8", 0.22, cabW * 1.05, (cabH - CAB.base) * 1.15, 0, (CAB.base + cabH) / 2, -D2 + 0.06, 0, 0);
  const cabGlass = plane(cabW - 0.08, cabH - CAB.base, glassM, 0, (CAB.base + cabH) / 2, cabZ + CAB.depth / 2 + 0.005);
  cabGlass.renderOrder = 3;
  solids.push([-cabW / 2 - 0.05, cabW / 2 + 0.05, -D2, -D2 + CAB.depth + 0.06]);

  /** The trophies: gold in one mesh, silver in one, the not-yet-won as faint shapes in one; the plates in one. */
  const trophies = buildTrophies();
  function trophyGeo(shape: TrophyShape): any[] {
    const g: any[] = [];
    const lathe = (pts: [number, number][], seg = 18) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    const base = () => lathe([[0, 0], [0.065, 0], [0.065, 0.03], [0.05, 0.035], [0.05, 0.05], [0, 0.05]], 16);
    const at = (geo: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, s: [number, number, number] = [1, 1, 1]) => {
      geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(...s)));
      g.push(geo);
    };
    if (shape === "cup" || shape === "jug") {
      const big = shape === "jug";
      at(base(), 0, 0, 0);
      at(lathe(big
        ? [[0, 0.05], [0.025, 0.05], [0.018, 0.1], [0.03, 0.13], [0.07, 0.19], [0.085, 0.25], [0.08, 0.3], [0.072, 0.305], [0, 0.305]]
        : [[0, 0.05], [0.022, 0.05], [0.014, 0.11], [0.026, 0.13], [0.065, 0.19], [0.075, 0.24], [0.07, 0.245], [0, 0.245]]), 0, 0, 0);
      const hr = big ? 0.06 : 0.04;
      for (const s of [-1, 1]) at(new THREE.TorusGeometry(hr, 0.008, 6, 12, Math.PI), s * (big ? 0.085 : 0.07), big ? 0.235 : 0.19, 0, 0, 0, s * Math.PI / 2);
    } else if (shape === "ball") {
      at(base(), 0, 0, 0);
      at(lathe([[0, 0.05], [0.03, 0.05], [0.02, 0.09], [0.035, 0.1], [0, 0.1]]), 0, 0, 0);
      at(new THREE.SphereGeometry(0.075, 20, 14), 0, 0.17, 0);
    } else if (shape === "globe") {
      at(base(), 0, 0, 0);
      at(lathe([[0, 0.05], [0.03, 0.05], [0.016, 0.1], [0.04, 0.17], [0, 0.17]]), 0, 0, 0);
      at(new THREE.SphereGeometry(0.06, 18, 12), 0, 0.225, 0);
      at(new THREE.TorusGeometry(0.075, 0.006, 6, 24), 0, 0.225, 0, 0.5, 0, 0);
      at(new THREE.TorusGeometry(0.075, 0.006, 6, 24), 0, 0.225, 0, -0.5, 0.9, 0);
    } else if (shape === "boot") {
      at(new THREE.BoxGeometry(0.17, 0.05, 0.1), 0, 0.025, 0);
      at(new THREE.BoxGeometry(0.15, 0.06, 0.06), -0.01, 0.08, 0);
      at(new THREE.BoxGeometry(0.06, 0.08, 0.06), -0.05, 0.14, 0);
      at(new THREE.SphereGeometry(0.035, 12, 8), 0.06, 0.08, 0, 0, 0, 0, [1.3, 0.85, 0.9]);
    } else if (shape === "plaque") {
      at(new THREE.BoxGeometry(0.17, 0.03, 0.08), 0, 0.015, 0);
      at(new THREE.BoxGeometry(0.15, 0.2, 0.02), 0, 0.13, 0, -0.12, 0, 0);
      at(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 18), 0, 0.15, 0.015, Math.PI / 2 - 0.12, 0, 0);
    } else {
      // a star on a column
      at(base(), 0, 0, 0);
      at(new THREE.CylinderGeometry(0.014, 0.02, 0.1, 10), 0, 0.1, 0);
      const st = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? 0.035 : 0.085;
        if (i === 0) st.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else st.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      at(new THREE.ExtrudeGeometry(st, { depth: 0.02, bevelEnabled: false }), 0, 0.23, -0.01);
    }
    return g;
  }
  function buildTrophies() {
    const gold: any[] = [], silver: any[] = [], ghost: any[] = [], plates: any[] = [];
    const { canvas: platesCv, rows } = platesCanvas(data.slots.map((s) => ({ name: s.name, count: s.count, won: s.won })));
    const clean = (geo: any) => {
      const g2 = geo.index ? geo.toNonIndexed() : geo;
      for (const k of Object.keys(g2.attributes)) if (k !== "position" && k !== "normal") g2.deleteAttribute(k);
      g2.clearGroups();
      return g2;
    };
    data.slots.slice(0, CAB.cols * CAB.rows).forEach((s, i) => {
      const col = i % CAB.cols, row = CAB.rows - 1 - Math.floor(i / CAB.cols); // the best on the top shelf
      const x = -cabW / 2 + 0.1 + (col + 0.5) * CAB.cw;
      const y = CAB.base + row * CAB.rh + (row > 0 ? 0.012 : 0);
      const z = cabZ - 0.02;
      const big = s.name === "Ballon d'Or" || s.name === "World Cup" || s.name === "Champions League" ? 1.12 : 1;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(big, big, big));
      for (const g of trophyGeo(s.shape)) {
        g.applyMatrix4(m);
        (s.won ? (s.metal === "gold" ? gold : silver) : ghost).push(clean(g));
      }
      // its name plate on the shelf's front edge (a slice of the plates picture)
      const pg = new THREE.PlaneGeometry(CAB.cw - 0.08, (CAB.cw - 0.08) * (96 / 512));
      const uv = pg.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / rows);
      pg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.035, cabZ + CAB.depth / 2 - 0.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0)), new THREE.Vector3(1, 1, 1)));
      plates.push(pg);
    });
    const meshOf = (list: any[], m: any) => {
      if (!list.length) return null;
      const me = new THREE.Mesh(mergeGeometries(list), m);
      for (const g of list) g.dispose();
      me.castShadow = false;
      scene.add(me);
      return me;
    };
    const goldM = mat("#e2b44a", { roughness: 0.22, metalness: 1, envMapIntensity: 1.6 });
    const silverM = mat("#d9dde2", { roughness: 0.2, metalness: 1, envMapIntensity: 1.6 });
    const ghostM = new THREE.MeshBasicMaterial({ color: "#fff4dc", transparent: true, opacity: 0.1, depthWrite: false });
    const plateT = tex(platesCv);
    const plateM = new THREE.MeshStandardMaterial({ map: plateT, roughness: 0.4, metalness: 0.3 });
    return {
      gold: meshOf(gold, goldM), silver: meshOf(silver, silverM), ghost: meshOf(ghost, ghostM),
      plates: (() => { const me = new THREE.Mesh(mergeGeometries(plates), plateM); for (const g of plates) g.dispose(); scene.add(me); return me; })(),
    };
  }

  // ── Pick volumes (invisible boxes a tap can hit) ──
  const pickables: any[] = [];
  const pickBox = (spot: HomeSpot, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
    me.visible = false;
    me.position.set(x, y, z);
    me.userData.spot = spot;
    scene.add(me);
    pickables.push(me);
  };
  pickBox("wardrobe", WARD.depth + 0.1, WARD.h, MIRROR.z + MIRROR.w / 2 - WARD.z0 + 0.1, wx, WARD.h / 2, (WARD.z0 + MIRROR.z + MIRROR.w / 2) / 2);
  pickBox("cabinet", cabW, cabH, CAB.depth + 0.1, 0, cabH / 2, cabZ);
  pickBox("drive", 0.4, DRIVE.y1 - DRIVE.y0, DRIVE.w, W2, (DRIVE.y0 + DRIVE.y1) / 2, DRIVE.z);

  // ── Loaders ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);

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
  const START = { x: 0, z: Math.max(0, D2 - 2.5) };
  me.person.root.position.set(START.x, 0, START.z);
  me.person.root.rotation.y = Math.PI;
  scene.add(me.person.root);
  const meBlob = blob(0.85, 0.85, START.x, START.z, 0.75);

  // ── Your cars on the drive, your boots on the shelf (loaded after the room shows) ──
  const props = new THREE.Group();
  scene.add(props);
  const fitLen = (root: any, len: number, alongZ: boolean) => {
    root.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(root);
    const sz = b.getSize(new THREE.Vector3());
    if (sz.z > sz.x) root.rotation.y = Math.PI / 2; // long side along x first
    root.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(root);
    root.scale.multiplyScalar(len / Math.max(b.max.x - b.min.x, 1e-3));
    if (alongZ) root.rotation.y += Math.PI / 2;
    root.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(root);
    const c = b.getCenter(new THREE.Vector3());
    root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b.min.y;
  };
  const loadProps = async () => {
    const jobs: Promise<void>[] = [];
    const n = Math.min(R.cars, data.cars.length);
    const span = 2.7;
    data.cars.slice(0, n).forEach((car, i) => {
      jobs.push(loader.loadAsync(car.model).then((g: any) => {
        if (disposed) return;
        const holder = new THREE.Group();
        const root = g.scene;
        root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.envMap = envTex; o.material.envMapIntensity = 1; } } });
        fitLen(root, car.length, false); // nose towards the house
        holder.add(root);
        holder.position.set(W2 + 2.2 + car.length / 2, 0, DRIVE.z + (i - (n - 1) / 2) * span);
        holder.rotation.y = Math.PI;
        props.add(seen(holder));
      }).catch((e: unknown) => console.error("home: car", car.model, e)));
    });
    data.boots.slice(0, 2).forEach((b, i) => {
      if (!b.model) return;
      jobs.push(loader.loadAsync(b.model).then((g: any) => {
        if (disposed) return;
        for (const side of [-1, 1]) {
          const root = side < 0 ? g.scene : g.scene.clone(true);
          if (side < 0) root.traverse((o: any) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.color.set(b.id === "plain" ? "#3a3a3a" : b.colour).lerp(new THREE.Color("#ffffff"), 0.35); } });
          fitLen(root, 0.3, true);
          const holder = new THREE.Group();
          holder.add(root);
          const z = WARD.z1 - 0.2 - i * 0.42 + side * 0.07;
          holder.position.set(-W2 + 0.3, 0.375, z);
          holder.rotation.y = -0.25;
          root.traverse((o: any) => { if (o.isMesh) o.castShadow = true; });
          props.add(holder);
        }
      }).catch((e: unknown) => console.error("home: boot", b.model, e)));
    });
    await Promise.all(jobs);
    shadowDirty = true;
  };

  // ── Join every still piece (one draw per material) ──
  const keep = new Set<any>([me.person.root, props, garments, trophies.gold, trophies.silver, trophies.ghost, trophies.plates, meBlob, ...pickables, mirror].filter(Boolean));
  // the mirror's own layer must survive joining: pieces it sees join only with each other
  const frozen = freezeStatic(THREE, mergeGeometries, scene, keep);
  // look H draws into its pass's picture: build the shaders for THAT (enhance.ts compile), not the screen
  try { await (hEnh ? hEnh.compile(scene, camera) : renderer.compileAsync(scene, camera)); } catch { /* compiled on first use */ }
  if (disposed) throw new Error("disposed");

  // ── State ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0, yaw = Math.PI, camYaw = 0, orbitHold = 0;
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
  const collide = (x: number, z: number): [number, number] => {
    x = Math.max(-W2 + RR, Math.min(W2 - RR, x));
    const inDoor = !!cb.onDoor && Math.abs(x) < DOOR.half - 0.1;
    z = Math.max(-D2 + RR, Math.min(inDoor ? D2 + 0.9 : D2 - RR, z));
    if (inDoor && z > D2 + 0.25 && !leftByDoor) { leftByDoor = true; cb.onDoor?.(); }
    for (const [x0, x1, z0, z1] of solids) {
      if (x > x0 - RR && x < x1 + RR && z > z0 - RR && z < z1 + RR) {
        const push = [x - (x0 - RR), x1 + RR - x, z - (z0 - RR), z1 + RR - z];
        const m = Math.min(...push);
        if (m === push[0]) x = x0 - RR; else if (m === push[1]) x = x1 + RR; else if (m === push[2]) z = z0 - RR; else z = z1 + RR;
      }
    }
    return [x, z];
  };
  const isFree = (x: number, z: number) => {
    const r = 0.36;
    if (Math.abs(x) > W2 - r || z < -D2 + r || z > D2 - r) return false;
    for (const [x0, x1, z0, z1] of solids) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
    return true;
  };
  /** Where each spot is stood at, and what he looks at there. */
  const MIRROR_SPOT: XZ = [-W2 + 1.05, MIRROR.z];
  const standFor = (s: HomeSpot): { at: XZ; face: XZ } => {
    const p = me.person.root.position;
    if (s === "wardrobe") return { at: MIRROR_SPOT, face: [-W2, MIRROR.z] };
    if (s === "cabinet") return { at: [Math.max(-cabW / 2 + 0.3, Math.min(cabW / 2 - 0.3, p.x * 0.5)), -D2 + CAB.depth + 0.95], face: [0, -D2] };
    return { at: [W2 - 0.95, DRIVE.z], face: [W2 + 3, DRIVE.z] };
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
  const zoneAt = (x: number, z: number): { spot: HomeSpot; front: XZ } | null => {
    if (x < -W2 + 1.75 && z > WARD.z0 - 0.3 && z < MIRROR.z + 0.8) return { spot: "wardrobe", front: [-W2 + WARD.depth, Math.max(WARD.z0, Math.min(MIRROR.z, z))] };
    if (z < -D2 + CAB.depth + 1.5 && Math.abs(x) < cabW / 2 + 0.35) return { spot: "cabinet", front: [Math.max(-cabW / 2, Math.min(cabW / 2, x)), -D2 + CAB.depth] };
    if (x > W2 - 1.6 && Math.abs(z - DRIVE.z) < DRIVE.w / 2 + 0.3) return { spot: "drive", front: [W2, Math.max(DRIVE.z - DRIVE.w / 2, Math.min(DRIVE.z + DRIVE.w / 2, z))] };
    return null;
  };
  /** The camera's shot of a spot with its card open. */
  const shotOf = (s: HomeSpot): { cam: [number, number, number]; look: [number, number, number] } => {
    // stood back and to one side, so you see him and, beside him, him in the mirror
    // (the line from the camera to his reflection crosses the glass ~0.25 m off its middle, and misses him)
    if (s === "wardrobe") return { cam: [Math.min(W2 - 0.35, -W2 + 3.4), 1.55, Math.min(D2 - 0.35, MIRROR.z + 1.0)], look: [-W2 + 0.3, 1.1, MIRROR.z + 0.15] };
    if (s === "cabinet") return { cam: [0.35, 1.5, Math.min(D2 - 0.35, -D2 + CAB.depth + 2.2)], look: [0, CAB.base + (cabH - CAB.base) * 0.55, -D2] };
    return { cam: [W2 - 2.1, 1.65, DRIVE.z + 0.9], look: [W2 + 4, 0.7, DRIVE.z - 0.3] };
  };

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
        try { await (hEnh ? hEnh.compile(scene, camera) : renderer.compileAsync(scene, camera)); } catch { /* first use */ }
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
    if (!MIRROR_PX[tier] && mirror) { scene.remove(mirror); mirror.dispose?.(); mirror = null; }
    if (!prof.outlines) me.person.outline.visible = false;
    resize();
    return true;
  };
  void loadProps();

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
    else if (speed > 0.3) camYaw += angDiff(camYaw, yaw + Math.PI) * Math.min(1, dt * 1.6);
    const shot = framed ? shotOf(framed) : null;
    frame += ((shot && orbitHold <= 0 ? 1 : 0) - frame) * Math.min(1, dt * 2.6);
    const back = Math.min(3.3, R.d * 0.42);
    const cf = scratchCf.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const crr = scratchCr.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
    const [camUp, camBack] = orb.lift(Math.min(H - 0.25, 2.35), back, 1.0);
    want.set(P.x, camUp, P.z).addScaledVector(cf, -camBack).addScaledVector(crr, 0.25);
    wantLook.set(P.x, 1.0, P.z).addScaledVector(cf, 2.0).addScaledVector(crr, 0.1);
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
    if (mirror) mirror.visible = framed === "wardrobe" || (P.x < -W2 + 3.2 && Math.abs(P.z - MIRROR.z) < 3.2) || !!dbgCam;
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
      const hit = ray.intersectObjects(pickables, false)[0];
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
        if (Math.hypot(p.x - MIRROR_SPOT[0], p.z - MIRROR_SPOT[1]) > 0.35) walkTo(MIRROR_SPOT, [-W2, MIRROR.z]);
        else faceTo = [-W2, MIRROR.z];
      }
    },
    wear,
    place: (x, z, y = yaw) => { stopWalk(); me.person.root.position.set(x, 0, z); yaw = y; camYaw = y + Math.PI; orb.reset(); first = true; shadowDirty = true; },
    where: () => ({ x: me.person.root.position.x, z: me.person.root.position.z, yaw, t: gameT, changing }),
    debugCamera: (pos, look = [0, 1, 0]) => { dbgCam = pos ? { pos, look } : null; lastOff = -1; },
    plan: () => ({ tier: data.tier, w: R.w, d: R.d, h: R.h, mirror: MIRROR_SPOT, wardrobe: WARD, cabinet: { w: cabW, h: cabH, z: cabZ }, drive: DRIVE, door: [0, D2], slots: data.slots.length }),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), quality: tier, merged: frozen, mirror: !!mirror?.visible }),
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
      mirror?.dispose?.();
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
