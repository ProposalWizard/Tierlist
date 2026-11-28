/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE WORLD KIT'S TEST PLACES — the house lounge and a garden, alive
 * (Harry, 20 Nov 2026: every 3D area needs "characters interact with the
 * world. Are they walking around?"). Phase 1 of docs/research/world-3d-2026-11-20.md,
 * on the test page /star-world3d-dev only (RUL-UI-002): the real game's house
 * and garden are not changed.
 *
 *  - HOUSE: the real house's lounge (home3d/roomBuild.ts, tier "house"):
 *    sit on the sofa, watch the TV (it comes on), take a can from the fridge.
 *  - GARDEN: a small garden built here: two team-mates on the bench chat,
 *    now and then one stands up and stretches; another arrives at the gate,
 *    walks to the bench, sits, drinks, chats and leaves again, on a seeded
 *    routine (./routine.ts). Tap one to talk (a card; the living world's
 *    chat, lib/star/life/social.ts, through the page).
 *
 * Everything uses the kit: ./smartObject.ts (what can be used), ./npc.ts
 * (people, you included), ./routine.ts (the clock), ./interact.ts (the card),
 * ./budget.ts (how many people animate). Camera D (three3d/followCam.ts).
 * One loop: renderer.setAnimationLoop. ?film: window.__frameStep (frameStep.ts).
 */
import { plantMesh } from "../home3d/plants";
import { installAssetVersions } from "../three3d/assetUrl";
import { TIER_PROFILES, quality3dTier, shadowSizeFor, deviceKind, currentDeviceInfo, type Quality3d } from "../three3d/quality";
import { acquireRenderer, rememberGpu, loadGltfCached } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, toonHeadsFor, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { addClips, clipInfo, loadAnims3d } from "../three3d/footballAnims";
import { FOLLOW_CAM_D, FollowBoom, FollowZoom, attachFollowZoom, boxRoom, capOnLine, loadFollowZoom, riseForMin, zoomedFollowCam } from "../three3d/followCam";
import { ViewCam, findHeadBone, headWorld, loadViewMode, showBody, type ViewMode } from "../three3d/viewCam";
import { OrbitCam } from "../three3d/orbitCam";
import { buildGrid, makeTapMarker, type WalkGrid, type XZ } from "../tapWalk";
import { angDiff } from "../three3d/animBlend";
import { numberCanvas, blobCanvas } from "../shop3d/textures";
import { lawnCanvasSoft, meadowCanvas, hedgeCanvas, gravelCanvas, boardsCanvas, brickCanvas, skyCanvas, slateCanvas } from "../garden3d/textures";
import { toonSkinFor, toonHairFor } from "../style3d/toon/bodies";
import { publishFrameStep } from "../frameStep";
import { safeCompileAsync } from "../three3d/safeCompile";
import { seatObject, tvObject, standObject, SmartSet, SlotBook, yawTo, type SmartObject } from "./smartObject";
import { Npc, measureSit, sitRootFor, BODY_R, type Body, type NpcWorld } from "./npc";
import { DayClock, RoutineRunner, planRoutine, GARDEN_VISITOR, BENCH_MATE, type PlannedStep } from "./routine";
import { npcBudget, planBudget, animatesOn } from "./budget";
import { objectCard, personCard, smallTalk, talkSpot, type InteractCard } from "./interact";

export type WorldPlace = "house" | "garden" | "gym" | "compound";

export interface WorldPerson { id: string; name: string; number: number }

export interface WorldOptions {
  place: WorldPlace;
  quality?: Quality3d;
  kit: { shirt: string; trim: string };
  /** Your shirt number. */
  number: number;
  /** Your club (the team-mates' looks come from the people presets for it). */
  club?: string;
  /** The garden's team-mates: two on the bench, then the one who drops round. */
  mates: WorldPerson[];
  /** How much faster than real time the clock runs (default 4). */
  rate?: number;
  /** A filmed run: "sofa" | "fridge" | "visitor" | "talk" (scripted taps, frame-stepped). */
  demo?: string | null;
  /** The living world's chat with a team-mate (lib/star/life/social.ts chat), or null when it says no. */
  chat?: (id: string) => { line: string; change?: string } | null;
  /** The compound's sky (the garden's looks): "day" | "sunset" | "night". */
  sky?: string | null;
}

export interface WorldStatus { clock: string; people: { id: string; name: string; doing: string }[]; fitness?: GymFitness }

/** The gym's three stats, the ring and the window, for the test page's strip (lib/star/gym/progress.ts gymView). */
export type GymFitness = ReturnType<typeof import("../gym/progress").gymView> & { week: number; /** the test page's body slider (1-4), null = from the gym's own points */ body: number | null };

export interface WorldCallbacks {
  onCard: (card: InteractCard | null) => void;
  onStatus?: (s: WorldStatus) => void;
  onContextLost?: () => void;
  /** The gym: the mini-game's screen, every frame (no React state: components/star/GymHud.tsx writes it straight to the page). */
  onGym?: (f: import("./gymPlace").GymHudFrame) => void;
  /** A door that leads to another place (the compound's gym door): the page opens it. */
  onGo?: (place: WorldPlace) => void;
}

export interface WorldController {
  tap: (clientX: number, clientY: number) => void;
  act: (action: string) => void;
  /** A scripted tap on a thing or a person by id (the demos and the filming). */
  tapId: (id: string) => void;
  /** The gym: your thumb on the screen (press = true, let go = false). */
  gymHold: (on: boolean) => void;
  /** Tests: a bot thumb at this skill (0..1), or null for yours. */
  gymBot: (skill: number | null) => void;
  /** Frames drawn and the main thread's milliseconds (step, render) since the last call. */
  perf: () => { frames: number; stepMs: number; renderMs: number };
  stats: () => { calls: number; triangles: number; tier: Quality3d; people: number; animated: number };
  debug: () => Record<string, unknown>;
  /** First person | third person (the eye button; lib/star/three3d/viewCam.ts), remembered per device. */
  setView: (m: ViewMode) => void;
  viewMode: () => ViewMode;
  /** Tests and the measuring script: stand you here, facing `yaw`, the camera settled behind you. */
  teleport: (x: number, z: number, yaw: number) => void;
  dispose: () => void;
}

type Demo = { place: WorldPlace; duration: number; rate?: number; steps: [number, string][]; you?: [number, number, number]; watch?: string; zoom?: number; /** the gym: the body slider's level (1-4) */ body?: number };
/** The ten new exercises' demos: start a step away from the spot, walk up, play it with a good thumb. */
const GYM2_DEMO_FROM: Record<string, [number, number]> = { pullup: [4.2, 3.2], squat: [0.3, -1.1], pushup: [1.5, 2.8], plank: [1.5, 2.8], nordic: [0.4, 2.3], mobility: [0.4, 2.3], boxjump: [2.2, 2.1], copenhagen: [3.55, 2.0], ladder: [1.6, 3.5], landing: [3.1, 2.8] };
const GYM2_DEMOS: Record<string, Demo> = {
  ...Object.fromEntries(Object.entries(GYM2_DEMO_FROM).map(([k, at]) => [k, { place: "gym", duration: 40, steps: [[0.2, `tap:${k}`], [0.25, "bot:1"], [0.3, "act:use"]], you: [at[0], at[1], Math.PI] } as Demo])),
  // the body strip: stood still by the mirror at gym levels 1 to 4 (pin the camera in front for the stills)
  ...Object.fromEntries([1, 2, 3, 4].map((lv) => [`body${lv}`, { place: "gym", duration: 4, steps: [], you: [-1.0, -1.2, Math.PI], body: lv } as Demo])),
};

/** The demos: what happens when (seconds), and how long each runs. */
const DEMOS: Record<string, Demo> = {
  sofa: { place: "house", duration: 14, steps: [[0.4, "tap:tv"], [4.6, "act:use"], [11.4, "act:leave"]] },
  fridge: { place: "house", duration: 15, steps: [[0.4, "tap:fridge"], [5.0, "act:use"]] },
  visitor: { place: "garden", duration: 34, rate: 10, steps: [], you: [-0.3, 1.9, 2.6], watch: "mate-2", zoom: 0.5 },
  talk: { place: "garden", duration: 11, steps: [[0.4, "tap:mate-0"], [7.4, "act:chat"]] },
  // the gym film: walk in to the bench, a set (a good thumb), up, over to the treadmill, a bad thumb: off the back
  // bench → treadmill: a short set, up, and he walks across the room and up onto the belt (no cut)
  walk: { place: "gym", duration: 15, steps: [[0.2, "tap:bench"], [0.4, "bot:1"], [0.4, "act:use"], [4.3, "act:gym:quit"], [5.0, "tap:treadmill"], [5.1, "act:use"]], you: [-1.4, 0.3, Math.PI] },
  gym: { place: "gym", duration: 19, steps: [[0.2, "tap:bench"], [2.9, "bot:1"], [2.9, "act:use"], [9.6, "act:gym:quit"], [10.3, "tap:treadmill"], [10.7, "bot:0"], [10.7, "act:use"]], you: [-1.2, 1.4, Math.PI] },
  bench: { place: "gym", duration: 32, steps: [[0.2, "tap:bench"], [3.6, "bot:1"], [3.6, "act:use"]], you: [-0.9, 2.4, Math.PI] },
  treadmill: { place: "gym", duration: 36, steps: [[0.2, "tap:treadmill"], [3.6, "bot:1"], [3.6, "act:use"]], you: [1.4, 1.2, Math.PI] },
  fall: { place: "gym", duration: 14, steps: [[0.2, "tap:treadmill"], [3.6, "bot:0"], [3.6, "act:use"]], you: [1.4, 1.2, Math.PI] },
  bag: { place: "gym", duration: 31, steps: [[0.2, "tap:bag"], [3.0, "bot:1"], [3.0, "act:use"]], you: [-1.2, 2.6, Math.PI] },
  // the compound: just parked, through the gate, across the forecourt, in at the gym door (go: = tap it, go in when there)
  arrive: { place: "compound", duration: 26, steps: [[0.8, "go:door-gym"]] },
  // the compound: the people at work (a check that nobody sticks)
  compound: { place: "compound", duration: 60, steps: [] },
  // phase 2 (gymPoses2.ts): one demo per new exercise (walk up, the fade, a good thumb), ?demo=pullup etc.
  ...GYM2_DEMOS,
  // the tour: box jumps, landing balance, pull-ups, the ladder (a few seconds of each)
  tour: { place: "gym", duration: 30, steps: [[0.1, "bot:1"], [0.1, "go:boxjump"], [5.6, "act:gym:quit"], [5.65, "go:landing"], [12.8, "act:gym:quit"], [12.85, "go:pullup"], [20.6, "act:gym:quit"], [20.65, "go:ladder"]], you: [2.2, 2.05, Math.PI] },
};
export const WORLD_DEMOS = DEMOS;
/** The gym mirror's picture, as a share of the screen's pixels each way (Low: plain dark glass, no live mirror). */
const GYM_MIRROR_SCALE: Record<Quality3d, number> = { low: 0, medium: 0.5, high: 0.75 };
/** Where the gym's team-mate starts (by the far treadmill). */
const GYM_MATE_START: [number, number] = [3.9, 0.2];

export async function startWorld3d(container: HTMLElement, cb: WorldCallbacks, opts: WorldOptions): Promise<WorldController> {
  const own: { release?: (root?: any) => void; root?: any } = {};
  try {
    return await build(container, cb, opts, own);
  } catch (e) {
    if (own.release) { try { own.release(own.root); } catch { /* gone */ } }
    throw e;
  }
}

async function build(container: HTMLElement, cb: WorldCallbacks, opts: WorldOptions, own: { release?: (root?: any) => void; root?: any }): Promise<WorldController> {
  const demo = opts.demo ? DEMOS[opts.demo] ?? null : null;
  const place: WorldPlace = demo?.place ?? opts.place;
  const tier: Quality3d = opts.quality ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const dk = deviceKind(currentDeviceInfo());
  const budget = npcBudget(tier, dk === "iphone" || dk === "android");
  const THREE: any = await import("three");
  await installAssetVersions();
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkeletonUtils.default ?? SkeletonUtils;

  // ── Renderer: the one shared renderer (three3d/perf.ts) ──
  const { renderer, release, isOwner } = acquireRenderer(THREE, container, prof);
  own.release = release;
  rememberGpu(renderer);
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(dpr, prof.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = place === "house" ? 1.05 : 1.0;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  let disposed = false;
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  own.root = scene;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = place === "house" ? 0.4 : 0.5;
  const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 120);

  const tex = (cv: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = prof.anisotropy;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, parent: any = scene, cast = true) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = true;
    parent.add(me);
    return me;
  };
  const blobT = tex(blobCanvas());
  const blob = (size: number, opacity = 0.75) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }));
    me.rotation.x = -Math.PI / 2; me.renderOrder = 1;
    scene.add(me);
    return me;
  };

  // ── The place: its walls and furniture, its smart objects ──
  type Built = { objects: SmartObject[]; solids: [number, number, number, number][]; bounds: [number, number, number, number]; you: { x: number; z: number; yaw: number }; ceil: number; camBox: [number, number, number, number] };
  let tvScreen: { on: (v: boolean) => void; tick: (dt: number) => void } | null = null;
  let fridgeDoor: { open: (v: boolean) => void; tick: (dt: number) => void } | null = null;
  let gate: { inside: XZ; outside: XZ } = { inside: [0, 0], outside: [0, 0] };
  let sun: any;
  let built: Built;

  let gymRoom: import("./gymPlace").GymRoomOut | null = null;
  let compound: import("./compoundPlace").CompoundOut | null = null;
  let carsLod: { update: (camera: any) => void } | null = null;
  const CP = place === "compound" ? await import("./compoundPlan") : null;
  if (place === "house") built = await buildHouse();
  else if (place === "gym") built = await buildGym();
  else if (place === "compound") built = await buildCompoundPlace();
  else built = buildGarden();

  async function buildCompoundPlace(): Promise<Built> {
    const { buildCompound, parseCompoundSky } = await import("./compoundPlace");
    const sky = parseCompoundSky(opts.sky);
    // the garden's textured trees (Harry, 28 Nov: "the textured trees so much better"): its leaf atlas and material
    const CT = await import("../garden3d/cardTrees");
    const atlas = await CT.loadCardAtlas(THREE, renderer).catch((e: unknown) => { console.error("compound tree atlas", e); return null; });
    const cardMaterial = atlas ? CT.cardMaterial(THREE, atlas.map, atlas.nrm) : null;
    const c = buildCompound({ THREE, scene, prof, tier, kit: opts.kit, club: opts.club, sky, cardMaterial });
    compound = c;
    renderer.toneMappingExposure = sky === "night" ? 1.15 : 1.0;
    scene.environmentIntensity = sky === "night" ? 0.15 : 0.35;
    camera.far = 420; camera.updateProjectionMatrix();
    // the parked cars: the game's own car models (the house's drive cars), loaded before the joining
    const { addParkedCars } = await import("./compoundPlace");
    const carLoader = new GLTFLoader();
    await withMeshopt(carLoader);
    carsLod = await addParkedCars(THREE, c.carPark, (u) => carLoader.loadAsync(u), tier);
    sun = c.sun;
    const n = shadowSizeFor(prof, 2048) || 1024;
    sun.shadow.mapSize.set(n, n);
    // every still piece joined by material within its zone (the zones are the culling boxes)
    const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
    const { freezeStatic } = await import("../freezeStatic");
    const keep = new Set<any>(c.moving);
    scene.traverse((o: any) => { if (o.userData?.kind === "plants") keep.add(o); });
    freezeStatic(THREE, mergeGeometries, scene, keep);
    return { objects: c.objects, solids: c.solids, bounds: c.bounds, you: c.you, ceil: c.ceil, camBox: c.camBox };
  }

  async function buildGym(): Promise<Built> {
    const { buildGymRoom } = await import("./gymPlace");
    const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
    renderer.toneMappingExposure = 1.05;
    scene.environmentIntensity = 0.45;
    const { Reflector }: any = await import("three/examples/jsm/objects/Reflector.js");
    const { MIRROR_PX } = await import("../home3d/roomBuild");
    gymRoom = buildGymRoom({ THREE, scene, prof, kit: opts.kit, club: opts.club, mergeGeometries, Reflector, mirrorPx: MIRROR_PX[tier] * 4, mirrorScale: GYM_MIRROR_SCALE[tier] });
    sun = gymRoom.sun;
    const n = shadowSizeFor(prof, 1024) || 1024;
    sun.shadow.mapSize.set(n, n);
    return { objects: gymRoom.objects, solids: gymRoom.solids, bounds: gymRoom.bounds, you: gymRoom.you, ceil: gymRoom.ceil, camBox: gymRoom.camBox };
  }

  async function buildHouse(): Promise<Built> {
    const { buildRoom } = await import("../home3d/roomBuild");
    const { roomsFor } = await import("../home3d/homes");
    const { CASUAL_SETS } = await import("../home3d/outfits");
    const { NO_STUFF } = await import("../home3d/rooms");
    const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
    const { Reflector }: any = await import("three/examples/jsm/objects/Reflector.js");
    const loader = new GLTFLoader();
    await withMeshopt(loader);
    const rooms = roomsFor("house", "new");
    const env = { THREE, mergeGeometries, Reflector, prof, quality: tier, envTex, doorOpen: false, glb: (u: string) => loader.loadAsync(u), cloneSkinned: (o: any) => SK.clone(o) };
    const room = buildRoom(env as any, { tier: "house", rooms, kits: { home: opts.kit, away: { shirt: "#f4f4f4", trim: opts.kit.shirt } }, slots: [], cars: [], boots: [], casual: CASUAL_SETS, stuff: { ...NO_STUFF, tv: true, console: true, cans: 8 } }, "lounge");
    scene.add(room.group);
    scene.background = new THREE.Color("#1a1612");
    const W2 = room.w2, D2 = room.d2;
    const hemi = new THREE.HemisphereLight("#fff3e2", "#6a5440", 1.05);
    scene.add(hemi);
    sun = new THREE.DirectionalLight("#ffe0b0", 1.7);
    sun.position.set(W2 + 5, 5.5, -1.5);
    sun.target.position.set(-0.5, 0, 0.5);
    scene.add(sun, sun.target);
    sun.castShadow = prof.shadows;
    const n = shadowSizeFor(prof, 1024) || 1024;
    sun.shadow.mapSize.set(n, n);
    const s = Math.max(W2, D2) + 1;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.5, far: 20 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    // the TV's picture (the lounge's TV on the west wall: roomBuild.ts, 1.9 m with a bought TV)
    const tvW = 1.9, tvH = tvW * 0.56;
    {
      const cv = document.createElement("canvas"); cv.width = 320; cv.height = 180;
      const g = cv.getContext("2d")!;
      const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(tvW - 0.08, tvH - 0.08), m);
      scr.position.set(-W2 + 0.12, 1.35, 0); scr.rotation.y = Math.PI / 2; scr.visible = false;
      room.group.add(scr);
      let on = false, tt = 0, acc = 0;
      const draw = () => {
        // a match on TV: the pitch, two teams' dots and the ball moving, a score bug
        g.fillStyle = "#2f7d32"; g.fillRect(0, 0, 320, 180);
        for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#2b7330" : "#348a37"; g.fillRect(i * 40, 0, 40, 180); }
        g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 2; g.strokeRect(10, 14, 300, 152); g.beginPath(); g.moveTo(160, 14); g.lineTo(160, 166); g.stroke();
        g.beginPath(); g.arc(160, 90, 24, 0, Math.PI * 2); g.stroke();
        const bx = 160 + Math.sin(tt * 0.7) * 110, by = 90 + Math.sin(tt * 1.3) * 50;
        for (let i = 0; i < 6; i++) {
          g.fillStyle = i < 3 ? opts.kit.shirt : "#f2f2f2";
          g.beginPath(); g.arc(bx + Math.sin(tt * 0.9 + i * 2) * 40 + (i - 2.5) * 14, by + Math.cos(tt * 1.1 + i) * 30, 5, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = "#fff"; g.beginPath(); g.arc(bx, by, 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = "rgba(0,0,0,0.7)"; g.fillRect(12, 16, 92, 20); g.fillStyle = "#fff"; g.font = "bold 13px sans-serif"; g.fillText(`KIB 1-0 ${String(Math.floor(tt / 2) % 90).padStart(2, "0")}'`, 18, 31);
        t.needsUpdate = true;
      };
      tvScreen = {
        on: (v) => { on = v; scr.visible = v; if (v) draw(); },
        tick: (dt) => { if (!on) return; tt += dt; acc += dt; if (acc > 0.1) { acc = 0; draw(); } },
      };
    }
    // the fridge stocked (Harry: "the fridge looks empty"): the lounge's fridge is a closed box with a
    // lit front, so a shallow shelved front goes on it, 24 KIB cans on four shelves (one instanced
    // draw), a cool light strip, and the glass door over them, hinged on its left
    {
      const fx = -W2 + 0.45 + 0.05, fz = -D2 + 0.4;
      const F0 = fz + 0.3, DEP = 0.14;
      const dark = mat("#2a2d33", { roughness: 0.4, metalness: 0.5 });
      const shelfM = mat("#dfe7ee", { roughness: 0.3, metalness: 0.2, emissive: "#9fc4e0", emissiveIntensity: 0.25 });
      for (const sx of [-1, 1]) box(0.03, 1.5, DEP, dark, fx + sx * 0.295, 0.75, F0 + DEP / 2, room.group, false);
      box(0.62, 0.04, DEP, dark, fx, 1.48, F0 + DEP / 2, room.group, false);
      box(0.62, 0.06, DEP, dark, fx, 0.03, F0 + DEP / 2, room.group, false);
      const glowStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.02), new THREE.MeshBasicMaterial({ color: "#e6f4ff", toneMapped: false }));
      glowStrip.position.set(fx, 1.44, F0 + 0.04); glowStrip.rotation.x = -Math.PI / 2; room.group.add(glowStrip);
      const SH = [0.18, 0.5, 0.82, 1.14];
      for (const y of SH) box(0.56, 0.012, DEP - 0.02, shelfM, fx, y, F0 + DEP / 2, room.group, false);
      const canG2 = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12);
      const cans = new THREE.InstancedMesh(canG2, mat("#ffffff", { roughness: 0.3, metalness: 0.7 }), SH.length * 6);
      const m4 = new THREE.Matrix4(), col = new THREE.Color();
      const KIB = ["#d7263d", "#e2b44a", "#2563eb"];
      let k = 0;
      SH.forEach((y, row) => { for (let i = 0; i < 6; i++) { m4.makeTranslation(fx - 0.22 + i * 0.088, y + 0.066, F0 + 0.07); cans.setMatrixAt(k, m4); cans.setColorAt(k, col.set(KIB[(i + row) % 3])); k++; } });
      room.group.add(cans);
      room.solids.push([fx - 0.31, fx + 0.31, F0, F0 + DEP + 0.02]);
      const hinge = new THREE.Group();
      hinge.position.set(fx - 0.29, 0, F0 + DEP + 0.005);
      room.group.add(hinge);
      const glass = mat("#bfe3ff", { transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.2 });
      box(0.58, 1.4, 0.02, glass, 0.29, 0.78, 0.01, hinge, false);
      box(0.03, 1.4, 0.035, dark, 0.57, 0.78, 0.015, hinge, false);
      box(0.58, 0.04, 0.035, dark, 0.29, 1.47, 0.015, hinge, false);
      box(0.58, 0.04, 0.035, dark, 0.29, 0.09, 0.015, hinge, false);
      let want = 0, a = 0;
      fridgeDoor = { open: (v) => { want = v ? 1 : 0; }, tick: (dt) => { a += (want - a) * Math.min(1, dt * 5); hinge.rotation.y = -a * 1.75; } };
    }
    // the smart objects: the sofa (three seats facing the TV), the TV, the fridge
    // sofa: roomBuild.ts sofa(…, 2.3, 0.55, 0.25, "w"): seat front at x 0.11, cushion top 0.445
    const sofa = seatObject({ id: "sofa", label: "Sofa", at: [0.27, 0.25], facing: -Math.PI / 2, seats: 3, y: 0.445, spacing: 0.63, front: 0.16, verb: "Sit down", lines: ["Feet up for a bit."] });
    const tv = tvObject({ id: "tv", at: [-W2 + 0.2, 0], via: "sofa", lines: ["The weekend's highlights are on."] });
    const fridge = standObject({
      // he stands 0.75 m off its glass: the reach bends him forward about half a metre, so his head
      // and chest stay outside the fridge (RUL-3D-005; at 0.45 m his head went into it)
      id: "fridge", kind: "fridge", label: "Drinks fridge", front: [fx0(W2), -D2 + 0.4 + 0.3 + 0.14 + 0.72], face: [fx0(W2), -D2 + 0.3], verb: "Take a can",
      lines: ["Your KIB cans, cold."], enter: { clip: "pickup", speed: 1.7 }, loop: [{ clip: "idle", secs: 1.2 }],
      effect: { energy: 1, text: "Ice cold. Energy +1" }, stay: [1.2, 1.2], pickR: 0.6,
    });
    return {
      objects: [sofa, tv, fridge], solids: room.solids,
      bounds: [-W2, W2, -D2, D2], // far enough from the south wall that camera D opens settled (its whole boom behind him: followCam.ts)
      you: { x: -1.3, z: Math.max(-0.5, D2 - 0.3 - FOLLOW_CAM_D.back - 0.05), yaw: Math.PI }, ceil: room.h - 0.15,
      camBox: [-W2 + 0.25, W2 - 0.25, -D2 + 0.25, D2 - 0.25],
    };
  }
  function fx0(W2: number) { return -W2 + 0.45 + 0.05; }

  function buildGarden(): Built {
    // light: an afternoon sun over the house, a sky light
    scene.background = tex(skyCanvas("#7fb2e6", "#bcd7ef", "#e9efe8"));
    scene.fog = new THREE.Fog("#dfe8e6", 26, 70);
    scene.add(new THREE.HemisphereLight("#eaf3ff", "#5d7a3f", 1.1));
    sun = new THREE.DirectionalLight("#fff0d8", 2.1);
    sun.position.set(-8, 14, 9);
    sun.target.position.set(-1, 0, 1);
    scene.add(sun, sun.target);
    sun.castShadow = prof.shadows;
    const n = shadowSizeFor(prof, 2048) || 1024;
    sun.shadow.mapSize.set(n, n);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    // ground: the lawn inside the hedge, a meadow outside, gravel paths
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(17, 18), mat("#ffffff", { map: tex(lawnCanvasSoft(), [5, 5]), roughness: 0.95 }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0.002, -1.5); lawn.receiveShadow = true; scene.add(lawn);
    const meadow = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat("#ffffff", { map: tex(meadowCanvas(), [18, 18]), roughness: 1 }));
    meadow.rotation.x = -Math.PI / 2; meadow.receiveShadow = true; scene.add(meadow);
    const gravelM = mat("#ffffff", { map: tex(gravelCanvas(), [1, 6]), roughness: 1 });
    const path = (w: number, d: number, x: number, z: number, ry = 0) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), gravelM); p.rotation.set(-Math.PI / 2, 0, ry); p.position.set(x, 0.006, z); p.receiveShadow = true; scene.add(p); };
    path(1.5, 6.5, 0, 9.5);
    path(1.5, 8, 0, 3.6);
    path(1.4, 4.4, -2.6, 1.4, Math.PI / 2);
    // the hedge round it, with the gate in the south side
    const hedgeM = mat("#ffffff", { map: tex(hedgeCanvas(), [6, 1]), roughness: 0.95 });
    const solids: [number, number, number, number][] = [];
    const hedge = (x0: number, x1: number, z0: number, z1: number) => { box(x1 - x0, 1.7, z1 - z0, hedgeM, (x0 + x1) / 2, 0.85, (z0 + z1) / 2); solids.push([x0, x1, z0, z1]); };
    hedge(-8.6, -7.9, -10.4, 7.6); hedge(7.9, 8.6, -10.4, 7.6);
    hedge(-8.6, -1.2, 6.9, 7.6); hedge(1.2, 8.6, 6.9, 7.6);
    const brickM = mat("#ffffff", { map: tex(brickCanvas(), [1, 2]), roughness: 0.9 });
    for (const sx of [-1, 1]) { box(0.5, 2.0, 0.5, brickM, sx * 1.2, 1.0, 7.25); box(0.6, 0.1, 0.6, mat("#cfc6b8"), sx * 1.2, 2.05, 7.25); solids.push([sx * 1.2 - 0.25, sx * 1.2 + 0.25, 7.0, 7.5]); }
    // the gate's two wooden leaves, swung open into the garden
    const woodM = mat("#ffffff", { map: tex(boardsCanvas("#7a5232"), [1, 1]), roughness: 0.75 });
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * 0.95, 0, 7.15); g.rotation.y = sx * 1.25; scene.add(g);
      for (let k = 0; k < 5; k++) box(0.12, 1.2, 0.04, woodM, -sx * (0.1 + k * 0.17), 0.6, 0, g);
      box(0.9, 0.08, 0.05, woodM, -sx * 0.44, 1.0, 0.02, g); box(0.9, 0.08, 0.05, woodM, -sx * 0.44, 0.3, 0.02, g);
    }
    gate = { inside: [0, 5.6], outside: [0, 9.4] };
    // the house: its back wall, windows, the back door, a slate roof edge
    box(17, 4.6, 0.5, brickM, 0, 2.3, -10.6); solids.push([-8.6, 8.6, -10.9, -10.3]);
    const glassM = mat("#2a3946", { roughness: 0.15, metalness: 0.4, envMapIntensity: 1.2 });
    const sillM = mat("#e9e2d6", { roughness: 0.7 });
    for (const x of [-5.2, -2.2, 3.2, 6.0]) { box(1.4, 1.3, 0.06, glassM, x, 2.0, -10.33, scene, false); box(1.55, 0.08, 0.16, sillM, x, 1.32, -10.28, scene, false); }
    box(1.2, 2.2, 0.06, woodM, 0.6, 1.1, -10.33, scene, false);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(17.6, 0.25, 1.4), mat("#ffffff", { map: tex(slateCanvas(), [6, 1]), roughness: 0.8 }));
    roof.position.set(0, 4.7, -10.3); roof.castShadow = true; scene.add(roof);
    // the patio by the house
    const pav = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.6), mat("#cdc4b4", { roughness: 0.9 }));
    pav.rotation.x = -Math.PI / 2; pav.position.set(0, 0.008, -8.9); pav.receiveShadow = true; scene.add(pav);
    // the pergola and the bench on the west side, facing east into the garden
    const BX = -5.4, BZ = 1.4, SEAT_Y = 0.46, LEN = 2.8, DEPTH = 0.5;
    const ironM = mat("#24262a", { roughness: 0.45, metalness: 0.6 });
    for (let k = 0; k < 5; k++) box(0.09, 0.045, LEN, woodM, BX - DEPTH / 2 + 0.05 + k * 0.1, SEAT_Y - 0.022, BZ);
    for (let k = 0; k < 3; k++) box(0.04, 0.1, LEN, woodM, BX - DEPTH / 2 - 0.02, SEAT_Y + 0.2 + k * 0.14, BZ);
    for (const dz of [-LEN / 2 + 0.12, 0, LEN / 2 - 0.12]) {
      box(DEPTH, 0.05, 0.05, ironM, BX, SEAT_Y - 0.07, BZ + dz);
      box(0.05, SEAT_Y - 0.05, 0.05, ironM, BX + DEPTH / 2 - 0.06, (SEAT_Y - 0.05) / 2, BZ + dz);
      box(0.05, SEAT_Y + 0.5, 0.05, ironM, BX - DEPTH / 2 - 0.02, (SEAT_Y + 0.5) / 2, BZ + dz);
    }
    solids.push([BX - DEPTH / 2 - 0.05, BX + DEPTH / 2 - 0.1, BZ - LEN / 2, BZ + LEN / 2]);
    const gw = 2.6, gd = 4.2;
    for (const [px, pz] of [[BX - 0.7, BZ - gd / 2], [BX + gw - 0.7, BZ - gd / 2], [BX - 0.7, BZ + gd / 2], [BX + gw - 0.7, BZ + gd / 2]]) {
      box(0.16, 2.7, 0.16, woodM, px, 1.35, pz); solids.push([px - 0.1, px + 0.1, pz - 0.1, pz + 0.1]);
    }
    for (const z of [BZ - gd / 2, BZ + gd / 2]) box(gw + 0.4, 0.14, 0.12, woodM, BX + gw / 2 - 0.7, 2.72, z);
    for (let k = 0; k < 7; k++) box(0.08, 0.1, gd + 0.4, woodM, BX - 0.7 + (k / 6) * gw, 2.86, BZ);
    // a low table in front of the bench, a can on it
    box(0.5, 0.04, 0.9, woodM, BX + 1.25, 0.42, BZ); for (const sz of [-1, 1]) box(0.4, 0.4, 0.04, woodM, BX + 1.25, 0.2, BZ + sz * 0.4);
    solids.push([BX + 0.95, BX + 1.55, BZ - 0.5, BZ + 0.5]);
    // planters and clipped topiary, a few trees outside the hedge
    const plantM = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75 });
    const potM = mat("#b5683f", { roughness: 0.85 });
    for (const [x, z] of [[4.8, -6.4], [-4.0, -7.0], [6.4, 4.6], [3.0, 1.2]]) {
      box(0.6, 0.5, 0.6, potM, x, 0.25, z);
      // real leaves (home3d/plants.ts), not a ball
      const s = plantMesh(THREE, (["monstera", "palm", "fiddle", "monstera"] as const)[Math.abs(Math.round(x + z)) % 4], Math.abs(x * 31 + z * 17), { h: 1.4, pot: "#3b2a1e", material: plantM }); s.position.set(x, 0.38, z); scene.add(s);
      solids.push([x - 0.35, x + 0.35, z - 0.35, z + 0.35]);
    }
    for (const [x, z, r] of [[-11, -4, 2.2], [11, -2, 2.6], [-10.5, 6, 2], [10.5, 8, 2.3], [-3, -14, 2.8], [5, -14.5, 2.4]]) {
      // a palm tree: the real-leaf palm, tree-sized, its own trunk (home3d/plants.ts), not a ball
      const cr = plantMesh(THREE, "palm", Math.abs(x * 7 + z * 13), { h: 1.6, pot: null, material: plantM, scale: r * 1.6 }); cr.position.set(x, 0, z); scene.add(cr);
    }
    // the bench: four seats facing east (feet at the seat's front edge, hips 0.32 m back from it)
    const bench = seatObject({
      // hips 0.2 m behind the front edge: his knees just over it, his shins hanging clear in front
      // (at 0.42 m back the shins went through the bench's front: measured 8 cm, the seat check below)
      id: "bench", label: "Garden bench", at: [BX + DEPTH / 2 - 0.2, BZ], facing: Math.PI / 2, seats: 4, y: SEAT_Y, spacing: 0.66, front: 0.2,
      verb: "Sit down", lines: ["Sit with the lads for a bit."],
    });
    const gateObj = standObject({ id: "gate", kind: "gate", label: "Garden gate", front: gate.inside, face: [0, 7.2], verb: "Look out", lines: ["The lane outside. Your team-mates come in this way."], pickR: 1.2, pickH: 2.2, who: "anyone" });
    return {
      objects: [bench, gateObj], solids,
      bounds: [-8.6, 8.6, -10.4, 11.5], you: { x: 1.6, z: 3.4, yaw: Math.PI * 0.85 }, ceil: 30,
      camBox: [-8.0, 8.0, -10.0, 14],
    };
  }

  const objects = new SmartSet(built.objects);
  const book = new SlotBook();
  // the walk grid: inside the place, round every solid (a body's width off it)
  const [bx0, bx1, bz0, bz1] = built.bounds;
  const grid: WalkGrid = buildGrid(bx0, bx1, bz0, bz1, CP ? CP.COMPOUND.cell : 0.2, (x, z) => {
    if (x < bx0 + BODY_R || x > bx1 - BODY_R || z < bz0 + BODY_R || z > bz1 - BODY_R) return false;
    for (const [a, b, c, d] of built.solids) if (x > a - BODY_R && x < b + BODY_R && z > c - BODY_R && z < d + BODY_R) return false;
    return true;
  });

  // ── People: their bodies and clips ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  // the compound: the coach and the kit man (staff), then up to four team-mates (./compoundPlan.ts PEOPLE)
  type Cast = WorldPerson & { slot?: string; role?: "player" | "staff"; title?: string };
  let pi = 0;
  const cast: Cast[] | null = CP ? CP.PEOPLE.flatMap((pp): Cast[] => {
    if (pp.role === "staff") return [{ slot: pp.slot, id: `staff-${pp.slot}`, name: pp.slot === "kitman" ? "Den" : "Coach", number: 0, role: "staff", title: pp.slot === "kitman" ? "Kit man" : "First-team coach" }];
    const pl = opts.mates[pi++];
    return pl ? [{ ...pl, slot: pp.slot, role: "player", title: pp.title }] : [];
  }) : null;
  const mates: Cast[] = place === "garden" ? opts.mates.slice(0, 3) : place === "gym" ? opts.mates.slice(0, 1) : (cast ?? []).slice(0, budget.present - 1); // the tier's cap on people in a place (budget.ts: Low 6 with you)
  // the team-mates are cast from the people presets (lib/star/people/presets.ts): their own
  // head, build, hair and drawn face (the face system), no two alike
  const PR = await import("../people/presets");
  const looks = PR.castScene(mates.map((m) => ({ id: `world-mate-${m.id}`, role: m.role ?? "player", club: opts.club ?? "Arsenal" })));
  const who = [{ you: true }];
  const heads = Array.from(new Set([...toonHeadsFor(who), ...looks.map((l) => l.head)]));
  const [charG, animG, footG] = await Promise.all([
    loadPeople3d(loader, "player", people3dLook(), heads),
    loadPeople3d(loader, "anims", people3dLook()),
    loadAnims3d(loader, "football"),
  ]);
  if (disposed) throw new Error("disposed");
  const walkInfo = clipInfo(footG, "walk"), jogInfo = clipInfo(footG, "jog");
  const canG = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12);
  const canM = mat("#d7263d", { roughness: 0.3, metalness: 0.7 });
  const outline = prof.outlines ? 0.006 : 0;
  const FI = await import("../style3d/toon/faceIdApply");
  const FACE = await import("../style3d/toon/face");
  const HAIR = await import("../style3d/toon/hair");
  const faces = new Map<Npc, { rig: any; seed: number }>();
  const hairs: any[] = [];
  const makeOne = async (id: string, o: { you?: boolean; staff?: boolean; number: number; kit: { shirt: string; trim: string }; look?: (typeof looks)[number] }) => {
    const L = o.look;
    const p: Person3D = makePerson3d(THREE, SK, charG, animG, { outline, castShadow: true, ...(o.you ? { you: true } : L ? { who: L.id, toonHead: L.head, toonBody: L.build } : { who: id }) });
    if (L) dressPerson3d(THREE, p, { ...L.dress, ...(o.staff && L.dress.suit ? {} : { kit: { ...(L.kit ?? {}), ...o.kit } }), number: o.staff ? null : tex(numberCanvas(o.number, "#ffffff")) } as any);
    else dressPerson3d(THREE, p, { skin: o.you ? "#c68642" : toonSkinFor(id), hair: o.you ? "#2b1b12" : toonHairFor(id), kit: o.kit, number: tex(numberCanvas(o.number, "#ffffff")) });
    if (place === "gym" || (place === "compound" && !o.staff)) {
      // the gym kit (Harry: "gym kit = club training top/shorts"): real cloth, no number; the shirt a shade under the club's
      const CL = await import("../style3d/toon/clothes");
      const { shadeHex } = await import("../style3d/toon/clothes/casual");
      const top = o.you ? shadeHex(opts.kit.shirt, -0.12) : shadeHex(opts.kit.shirt, -0.45);
      const base: any = L ? L.dress : { skin: o.you ? "#c68642" : toonSkinFor(id), hair: o.you ? "#2b1b12" : toonHairFor(id) };
      // trainers and ankle socks, not boots and long socks (clothes/outfits.ts "gym": a flat cupsole, laces, bare calves)
      const shoes = o.you ? "#2f3a4c" : "#d8d4cb"; // trainers: a slate pair for you, off-white for him (never the kit's white boots)
      const accessories = [...((base.accessories ?? []) as any[]).filter((a) => a.slot !== "boots"), { slot: "boots", color: shoes }];
      dressPerson3d(THREE, p, { ...base, accessories, kit: { shirt: top, trim: opts.kit.trim, shorts: "#1d1f24", socks: "#f2f2ef" }, number: null } as any);
      // the compound: everyone (you too) in the painted training kit: real cloth is ~6-13k more triangles a man, and the phone budget is 90k
      if (place === "gym") CL.dressCloth(THREE, p, "gym", L?.id ?? id, { whiteBalance: CL.HOME_WB, colours: { shoes } });
    }
    let rig: any = null;
    if (L) {
      // a phone draws the face at half detail (faceIdApply.ts FACE_DETAIL)
      FI.applyToonFaceId(THREE, p, L.faceId, { detail: FI.FACE_DETAIL[tier] });
      rig = FACE.addToonFace(THREE, p);
      rig?.set({ face: FACE.toonFaceFor({}), blink: 0 });
      if (L.hairMesh) { const h = await HAIR.wearToonHair(THREE, loader, p, L.hairMesh, { outline: outline ? 0.0045 : 0 }); if (h) hairs.push(h); }
    }
    relaxHands(THREE, p);
    addClips(THREE, p, footG);
    const hipsRest = p.rest.get(p.bones.Hips)?.[0].y ?? p.bones.Hips.position.y;
    const hy = (footG.scene?.userData as any)?.hipsY as number | undefined;
    const size = hy ? hipsRest / hy : 1;
    const loco = [
      ...(walkInfo?.speed ? [{ name: "walk", speed: walkInfo.speed * size }] : []),
      ...(jogInfo?.speed ? [{ name: "jog", speed: jogInfo.speed * size }] : []),
    ];
    scene.add(p.root);
    const sit = measureSit(THREE, p);
    const n = new Npc(THREE, p, { id, loco, sit });
    if (rig) faces.set(n, { rig, seed: hashSeed(id) });
    // NPCs: a soft blob, no cast shadow on a phone (as the garden's bench mates)
    if (!o.you && tier !== "high") p.body.castShadow = false;
    return n;
  };
  const you = await makeOne("you", { you: true, number: opts.number, kit: opts.kit });
  you.name = "You";
  if (demo?.you) you.place(demo.you[0], demo.you[1], demo.you[2]);
  else you.place(built.you.x, built.you.z, built.you.yaw);
  const watch = demo?.watch ?? null;
  const away = { shirt: "#f2f2f2", trim: opts.kit.shirt };
  const npcs: Npc[] = [];
  const titles = new Map<Npc, string>();
  for (let i = 0; i < mates.length; i++) {
    const m = mates[i];
    const n = await makeOne(m.slot ?? `mate-${i}`, { number: m.number, staff: m.role === "staff", kit: i === 2 && !cast ? away : opts.kit, look: looks[i] });
    npcs.push(n);
    n.name = m.name;
    if (m.title) titles.set(n, m.title);
  }
  const people = [you, ...npcs];
  // the compound: a far man draws coarse triangles (./farBodies.ts), an off-screen one none (three3d/cullPeople.ts)
  const FAR_M: Record<Quality3d, number> = { low: 9, medium: 11, high: 22 };
  let farB: import("./farBodies").FarBodies | null = null;
  if (CP) {
    const { farBodies } = await import("./farBodies");
    const { cullSkinned } = await import("../three3d/cullPeople");
    for (const n of people) cullSkinned(THREE, n.root);
    // the coarse set's cube: 1/22 of a man's height on Low, 1/32 Medium, 1/46 High
    farB = farBodies(THREE, npcs.map((n) => ({ root: n.root, where: () => n.bodyXZ() })), { far: FAR_M[tier], cellOfHeight: tier === "low" ? 22 : tier === "medium" ? 32 : 46 });
  }
  const blobs = new Map<Npc, any>(people.map((n) => [n, blob(0.9, n === you ? 0.8 : 0.7)]));
  const holdCan = (n: Npc, on: boolean) => {
    const hand = n.person.bones.RightHand;
    if (!hand) return;
    if (on && !n.prop) {
      const c = new THREE.Mesh(canG, canM);
      c.scale.setScalar(1 / n.person.unit);
      c.position.set(0, 0.07 / n.person.unit, 0.03 / n.person.unit);
      c.castShadow = false;
      hand.add(c);
      n.prop = c;
    } else if (!on && n.prop) { hand.remove(n.prop); n.prop = null; }
  };

  const propG = new THREE.BoxGeometry(1, 1, 1);
  const propM = { clipboard: mat("#e9e4d6", { roughness: 0.7 }), bag: mat("#1c1f25", { roughness: 0.8 }) };
  const holdProp = (n: Npc, kind: "clipboard" | "bag") => {
    const hand = n.person.bones.RightHand;
    if (!hand || n.prop) return;
    const c = new THREE.Mesh(propG, propM[kind]);
    const u = 1 / n.person.unit;
    if (kind === "clipboard") { c.scale.set(0.23 * u, 0.32 * u, 0.012 * u); c.position.set(0.02 * u, 0.12 * u, 0.06 * u); }
    else { c.scale.set(0.16 * u, 0.3 * u, 0.42 * u); c.position.set(0, 0.2 * u, 0); }
    c.castShadow = false;
    hand.add(c);
    n.prop = c;
  };

  const world: NpcWorld = {
    grid, book,
    bodies: (): Body[] => people.filter((p) => p.root.visible && p.state !== "hidden").map((p) => { const [x, z] = p.bodyXZ(); return { id: p.id, x, z, r: BODY_R }; }),
  };

  // ── The clock and the routines (garden) ──
  const rate = demo?.rate ?? opts.rate ?? (CP ? CP.COMPOUND_RATE : 4);
  const clock = new DayClock(CP ? 9 * 60 + 40 : 15 * 60, rate);
  const runners = new Map<Npc, RoutineRunner>();
  const paused = new Set<Npc>();
  const bench = objects.get("bench");
  if (place === "garden" && bench) {
    npcs.slice(0, 2).forEach((n, i) => {
      n.sitNow(world, bench, { slot: `s${i}` });
      runners.set(n, new RoutineRunner(planRoutine(n.id, BENCH_MATE, clock.minute, clock.minute + 600, 20261120 + i)));
    });
    const v = npcs[2];
    if (v) {
      v.show(false);
      const rt = planRoutine(v.id, GARDEN_VISITOR, clock.minute, clock.minute + 600, 77);
      // the first visit straight away (a second in), so the place is never empty for long
      const shift = rt.steps.length ? rt.steps[0].at - (clock.minute + rate / 60) : 0;
      for (const s of rt.steps) { s.at -= shift; s.until -= shift; }
      runners.set(v, new RoutineRunner(rt));
      holdCan(v, true);
    }
  }
  if (place === "gym" && npcs[0]) {
    const R = await import("./routine");
    const n = npcs[0];
    // the team-mate's session: a run on the far treadmill, a drink, a stretch on the mat, round again
    n.place(GYM_MATE_START[0], GYM_MATE_START[1], Math.PI);
    runners.set(n, new RoutineRunner(planRoutine(n.id, R.GYM_MATE, clock.minute, clock.minute + 600, 20261127)));
  }
  if (CP && compound) {
    // the compound's people: each on his own routine (./compoundPlan.ts ROUTINES), from his start spot
    npcs.forEach((n, i) => {
      const pp = CP.PEOPLE.find((x) => x.slot === n.id);
      if (!pp) return;
      n.place(pp.start[0], pp.start[1], pp.startYaw);
      const fb = objects.get(CP.FORECOURT_BENCH.id);
      if (pp.routine === "compound-bench" && fb) n.sitNow(world, fb, { slot: "s0" });
      runners.set(n, new RoutineRunner(planRoutine(n.id, CP.ROUTINES[pp.routine] as any, clock.minute, clock.minute + 600, 20261128 + i)));
      if (pp.prop) holdProp(n, pp.prop);
    });
  }
  const objOf = (target: string): SmartObject | undefined => target.startsWith("kind:") ? objects.ofKind(target.slice(5) as any)[0] : objects.get(target);
  /** A step's game minutes in real seconds (rate = times faster than real time). */
  const realSecs = (s: PlannedStep) => Math.max(1, ((s.until - s.at) * 60) / rate);
  const startStep = (n: Npc, s: PlannedStep, r: RoutineRunner) => {
    const d = s.do;
    if (d.kind === "arrive") {
      n.place(gate.outside[0], gate.outside[1], Math.PI);
      n.show(true);
      n.walkTo(world, gate.inside, { onArrive: () => r.done() });
    } else if (d.kind === "use") {
      const o = objOf(d.target);
      if (!o) { r.done(); return; }
      if (n.using === o && n.state !== "exit") return;
      const go = () => { if (!n.use(world, o, { loop: d.loop })) r.done(); };
      if (n.seated) n.leave(go); else go();
    } else if (d.kind === "stretch") {
      const go = () => n.act({ clip: "stretch", or: ["idle"] }, realSecs(s));
      if (n.seated) n.leave(go); else go();
    } else if (d.kind === "leave") {
      const go = () => n.walkTo(world, gate.inside, { onArrive: () => n.walkTo(world, gate.outside, { onArrive: () => { n.show(false); r.done(); } }) });
      if (n.seated) n.leave(go); else go();
    } else r.done();
  };
  const stopStep = (n: Npc, s: PlannedStep, r: RoutineRunner) => {
    if (s.do.kind !== "use" || !n.seated) return;
    // straight on to the same seat again (no stretch this time): he just stays sat
    const next = r.routine.steps[r.index + 1];
    if (next && next.do.kind === "use" && next.do.target === s.do.target && next.at - s.until < 0.05) return;
    n.leave();
  };

  // ── The gym: the mini-games (./gymPlace.ts GymSession) and your Strength / Cardio / Focus (lib/star/gym/progress.ts) ──
  const GP = place === "gym" ? await import("../gym/progress") : null;
  const GG = place === "gym" ? await import("../gym/games") : null;
  let gymState = GP ? GP.newGym() : null;
  const gymGap = { season: 1, week: 1 };
  let gym: import("./gymPlace").GymSession | null = null;
  // the body follows the gym (lib/star/gym/body.ts): the gym's own points a window late, or the test page's slider
  let bodyLevel: number | null = demo?.body ?? null;
  const GB = place === "gym" ? await import("../gym/body") : null;
  const TB = place === "gym" ? await import("../style3d/toon/bodies") : null;
  const applyBody = () => {
    if (!GB || !TB || !GP || !gymState) return;
    const inner = you.person.root.children[0];
    const base = TB.TOON_BUILD_SCALE[(you.person as any).toon ?? "c1"] ?? [1, 1, 1];
    const pts = bodyLevel != null ? { strength: GB.pointsForLevel(bodyLevel), cardio: GB.pointsForLevel(bodyLevel) / 2 } : GP.bodyPoints(gymState, gymGap);
    const k = GB.gymBodyScale(pts);
    inner?.scale.set(base[0] * k[0], base[1] * k[1], base[2] * k[2]);
    inner?.updateMatrixWorld(true);
  };
  const fitness = (): GymFitness | undefined => (GP && gymState ? { ...GP.gymView(gymState, gymGap), week: gymGap.week, body: bodyLevel } : undefined);
  applyBody();
  if (gymRoom && GP && GG) {
    const { GymSession } = await import("./gymPlace");
    const size = (() => { const hipsRest = you.person.rest.get(you.person.bones.Hips)?.[0].y ?? you.person.bones.Hips.position.y; const hy = (footG.scene?.userData as any)?.hipsY as number | undefined; return hy ? hipsRest / hy : 1; })();
    gym = new GymSession(THREE, gymRoom, you, {
      levelOf: (k) => GP.levelOf(gymState!.points[GP.STAT_OF[k]]),
      clipSpeed: (name) => (clipInfo(footG, name)?.speed ?? (name === "sprint" ? 6.5 : name === "run" ? 4.5 : 3)) * size,
      seed: 7,
      onResult: (r, quit) => {
        book.release(you.id);
        const out = GP.doExercise(gymState!, gymGap, r);
        gymState = out.gym;
        applyBody();
        if (demo && quit) return; // the film moves straight on
        show({ key: `gym:${r.kind}`, sub: GG.GAME_NAMES[r.kind], title: r.failed ? (r.kind === "treadmill" ? "Off the back!" : "Too fast!") : quit ? "Stopped early" : "Set done", lines: [r.headline + ".", out.words], actions: [{ id: "close", label: "OK", primary: true }] });
      },
    });
  }
  const mateBeltSpeed = place === "gym" ? (clipInfo(footG, "jog")?.speed ?? 3) : 0;
  // the team-mate on phase 2's kit: while his routine has him "using" one of the new exercises, he plays it
  // on a bot thumb with his own Exercise2 (the same poses and contacts as yours); a finished go starts again
  const G2 = place === "gym" ? await import("../gym/games2") : null;
  const PZ2 = place === "gym" ? await import("./gymPoses2") : null;
  const mateGym = new Map<Npc, { kind: import("../gym/games2").Gym2Kind; ex: import("./gymPoses2").Exercise2; game: import("../gym/games2").Gym2State; n: number }>();
  const mateGymFrame = (n: Npc, dt: number) => {
    if (!G2 || !PZ2 || !gymRoom) return;
    const cur = mateGym.get(n);
    const o = n.using;
    const on = n.state === "use" && !!o?.game && (G2.GYM2_KINDS as string[]).includes(o.game);
    if (!on) { if (cur) { cur.ex.tearDown(); mateGym.delete(n); const s0 = o?.slots[0]; if (s0) n.place(n.x, n.z, n.yaw); } return; }
    const kind = o!.game as import("../gym/games2").Gym2Kind;
    let m = cur;
    if (!m || m.kind !== kind) {
      const ex = new PZ2.Exercise2(THREE, n, gymRoom);
      ex.setUp(kind, true);
      m = { kind, ex, game: G2.start2(kind, 2, 11 + mateGym.size), n: 0 };
      mateGym.set(n, m);
    }
    m.game = G2.step2(m.game, dt, G2.botHold2(m.game, 1));
    if (m.game.done) m.game = G2.start2(kind, 2, 11 + ++m.n);
    m.ex.apply(m.game, "play", 9, dt);
  };

  // ── Tapping: a person, a thing, else the floor; walk up; one card ──
  const marker = makeTapMarker(THREE, scene);
  let card: InteractCard | null = null;
  let pending: { obj: SmartObject; slot: string | null } | null = null;
  let talking: Npc | null = null;
  const visits = new Map<string, number>();
  let autoGo: string | null = null, autoAt = -1;
  const show = (c: InteractCard | null) => {
    card = c; cb.onCard(c);
    if (autoGo && c?.key === `obj:${autoGo}`) { autoGo = null; autoAt = simT + 0.6; }
  };
  const endTalk = () => {
    if (talking) {
      talking.lookAt = null;
      if (paused.has(talking)) { paused.delete(talking); const r = runners.get(talking); const cur = r?.current; if (r && cur) startStep(talking, cur, r); }
      talking = null;
    }
  };
  const compoundTalk = (n: Npc, who: string, visit: number): string[] => {
    const at = n.using?.id ?? "";
    const LINES: Record<string, string[]> = {
      "staff-coach": ["Ten minutes, then we start. Rondos first.", "Gaffer wants intensity today. Don't make me shout."],
      "staff-kitman": ["Your kit's on your peg. Boots are cleaned.", "Don't nick my cones again."],
      mate: at.startsWith("warm") ? ["Hamstrings are tight. Long week.", "Coach has got the poles out. Sprints, then."] : at.startsWith("arr") ? ["Morning! Nice motor.", "Traffic was a nightmare on the way in."] : at === "fc-bench" ? ["Five more minutes of sun.", "Gym first or straight out?"] : ["Morning.", "Big session today."],
    };
    const l = LINES[who] ?? LINES.mate;
    return [l[visit % l.length], l[(visit + 1) % l.length]];
  };
  const doingOf = (n: Npc): "sat" | "drink" | "stand" | "arrive" => n.seated ? (n.prop ? "drink" : "sat") : n.state === "walk" ? "arrive" : "stand";
  const tapPerson = (n: Npc) => {
    endTalk();
    pending = null;
    show(null);
    const go = () => {
      const him = n.bodyXZ();
      const spot = talkSpot(him, n.yaw, [you.x, you.z]);
      // a walker stops for you
      if (!n.seated && n.state === "walk") { paused.add(n); n.stop(); }
      talking = n;
      const arrive = () => {
        if (talking !== n || card?.key === `person:${n.id}`) return;
        n.lookAt = [you.x, you.z];
        if (!n.seated && n.state === "stand") n.face(yawTo([n.x, n.z], [you.x, you.z]));
        const k = (visits.get(n.id) ?? 0) + 1; visits.set(n.id, k);
        const staff = titles.get(n) && titles.get(n) !== "Team-mate";
        show(personCard({ id: n.id, name: n.name, role: titles.get(n), lines: CP ? compoundTalk(n, staff ? n.id : "mate", k) : smallTalk(n.id, doingOf(n), clock.phase(), k), chat: !!opts.chat && !staff }));
      };
      if (Math.hypot(spot[0] - you.x, spot[1] - you.z) < 0.3) { you.face(yawTo([you.x, you.z], him), arrive); return; }
      marker.show(spot[0], spot[1]);
      if (!you.walkTo(world, spot, { face: yawTo(spot, him), onArrive: () => { marker.fade(); arrive(); } })) { arrive(); }
    };
    if (you.seated) you.leave(go); else go();
  };
  const tapObject = (o: SmartObject) => {
    endTalk();
    show(null);
    const host = objects.host(o);
    if (you.using === host) { pending = { obj: o, slot: null }; show(objectCard(o, { using: true })); return; }
    const go = () => {
      const free = book.free(host);
      if (!free.length && host.slots.length) { show(objectCard(o, { taken: true })); return; }
      const slot = free.length ? free.slice().sort((a, b) => Math.hypot(a.stand[0] - you.x, a.stand[1] - you.z) - Math.hypot(b.stand[0] - you.x, b.stand[1] - you.z))[0] : null;
      pending = { obj: o, slot: slot?.id ?? null };
      if (!slot) { show(objectCard(o)); return; }
      const spot = sitRootFor(slot, you.sit).at;
      marker.show(spot[0], spot[1]);
      const ok = you.walkTo(world, spot, { face: slot.facing, onArrive: () => { marker.fade(); if (pending?.obj === o) show(objectCard(o)); } });
      if (!ok) show(objectCard(o));
    };
    if (you.seated) you.leave(go); else go();
  };
  const tapFloor = (p: XZ) => {
    endTalk(); pending = null; show(null);
    const go = () => { marker.show(p[0], p[1]); you.walkTo(world, p, { onArrive: () => marker.fade() }); };
    if (you.seated) you.leave(go); else go();
  };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tap = (clientX: number, clientY: number) => {
    if (gym?.active) return; // your thumb is on the mini-game
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    // a person: a standing cylinder round his body (seated: lower)
    let best: { t: number; n: Npc } | null = null;
    for (const n of npcs) {
      if (!n.root.visible) continue;
      const [px, pz] = n.bodyXZ();
      const t = rayCyl(o, d, px, pz, 0.38, n.seated ? 1.35 : 1.9);
      if (t !== null && (!best || t < best.t)) best = { t, n };
    }
    // a thing
    let bestO: { t: number; o: SmartObject } | null = null;
    for (const ob of objects.list) {
      const t = rayCyl(o, d, ob.pick.at[0], ob.pick.at[1], ob.pick.r, ob.pick.h);
      if (t !== null && (!bestO || t < bestO.t)) bestO = { t, o: ob };
    }
    if (best && (!bestO || best.t <= bestO.t + 0.3)) return tapPerson(best.n);
    if (bestO) return tapObject(bestO.o);
    if (d.y < -1e-3) {
      const t = -o.y / d.y;
      tapFloor([o.x + d.x * t, o.z + d.z * t]);
    }
  };
  const act = (a: string) => {
    if (a === "close") { endTalk(); pending = null; show(null); return; }
    if (a === "gym:quit") { gym?.quit(); return; }
    if (a.startsWith("gym:body:")) { const v = a.slice(9); bodyLevel = v === "auto" ? null : Number(v); applyBody(); statusT = 0; return; }
    if (a === "gym:nextWeek" && GP && gymState) {
      // a match played: the next gap between matches (the window counts down; miss it and you slip)
      gymGap.week++;
      applyBody();
      const v = GP.gymView(gymState, gymGap);
      show({ key: "gym:week", sub: `Week ${gymGap.week}`, title: "A match later", lines: [v.window >= 0 ? `Workout window: ${v.window === 0 ? "last week to train" : `${v.window + 1} weeks left`}.` : v.slipping ? `You missed the window: Strength and Cardio will slip ${GP.SLIP * v.slipping}.` : "No workout window open: your next visit opens one."], actions: [{ id: "close", label: "OK", primary: true }] });
      return;
    }
    if (a === "use" && pending?.obj.game && gym) {
      marker.fade();
      const o = pending.obj;
      if (o.id === "treadmill2" && npcs.some((n) => n.using?.id === "treadmill2-belt")) { show(objectCard(o, { taken: true })); return; }
      // the team-mate on it (phase 2's kit is shared): taken; else it is yours until the result card
      if (!book.free(o).length && o.slots.length) { show(objectCard(o, { taken: true })); return; }
      if (o.slots.length) book.book(o, you.id);
      pending = null;
      show(null);
      // stood at the machine: the session takes it from here (the fade, the game, the result card)
      const startIt = () => gym!.begin(o);
      const s = o.slots[0];
      // he walks to the machine (from another machine too: no cut), then the session takes over
      if (Math.hypot(you.x - s.stand[0], you.z - s.stand[1]) > 0.3) { if (!you.walkTo(world, s.stand, { face: o.game === "treadmill" ? null : s.facing, onArrive: startIt })) startIt(); }
      else startIt();
      return;
    }
    if (a === "use" && pending && CP && compound) {
      const o = pending.obj;
      const d = CP.DOORS.find((x) => x.id === o.id);
      if (d) {
        pending = null; marker.fade();
        if (d.leads === "gym") { show(null); fadeWant = 1; goingTo = "gym"; return; }
        show({ key: `obj:${o.id}`, sub: "Coming soon", title: o.label, lines: CP.DOOR_SOON[o.id] ?? ["Coming soon."], actions: [{ id: "close", label: "OK", primary: true }] });
        return;
      }
      if (o.id === "gate") { pending = null; show(null); marker.show(0, 20.4); you.walkTo(world, [0, 20.4], { face: Math.PI, onArrive: () => marker.fade() }); return; }
      if (o.id === "board") { pending = null; show({ key: "obj:board", title: "Photo taken", lines: ["You and the crest. One for the socials."], actions: [{ id: "close", label: "OK", primary: true }] }); return; }
    }
    if (a === "chat" && talking) {
      const res = opts.chat?.(talking.id) ?? null;
      const c0 = card;
      show(personCard({ id: talking.id, name: talking.name, lines: res ? [res.line] : ["You already had a proper chat this week.", ...(c0?.lines.slice(0, 1) ?? [])], chat: false, change: res?.change }));
      return;
    }
    if (a === "leave") {
      const o = pending?.obj;
      you.leave(() => { if (o?.kind === "tv") tvScreen?.on(false); holdCan(you, false); show(null); });
      pending = null;
      return;
    }
    if (a === "use" && pending) {
      marker.fade();
      const o = pending.obj, host = objects.host(o);
      const okUse = you.use(world, host, {
        slot: pending.slot ?? undefined,
        loop: o.loop,
        secs: o.kind === "fridge" ? o.stay[0] : Infinity,
        onStart: () => { if (o.kind === "fridge") fridgeDoor?.open(true); },
        onIn: () => {
          if (o.kind === "tv") tvScreen?.on(true);
          if (o.kind === "fridge") holdCan(you, true);
          show(objectCard(o, { using: true }));
        },
        onOut: () => { if (o.id === "cooler" && GP && gymState) gymState = GP.takeProtein(gymState, gymGap); if (o.kind === "fridge") { fridgeDoor?.open(false); you.face(you.yaw + Math.PI, () => you.sip(true)); show({ key: `obj:${o.id}`, title: o.label, lines: [o.effect?.text ?? "Done."], actions: [{ id: "close", label: "OK", primary: true }] }); } },
      });
      if (!okUse) show(objectCard(o, { taken: true }));
      else show(null);
    }
  };
  const tapId = (id: string) => {
    const n = npcs.find((x) => x.id === id);
    if (n) return tapPerson(n);
    const o = objects.get(id);
    if (o) return tapObject(o);
  };
  // a drag looks round (left/right turns, up/down tilts; in first person, the eyes)
  const orb = new OrbitCam();
  let orbitHold = 0;
  const onPointer = (() => {
    let down: { x: number; y: number; t: number } | null = null;
    let lastP: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; lastP = { x: e.clientX, y: e.clientY }; };
    const pm = (e: PointerEvent) => {
      if (!lastP || !down || container.dataset.pinching || gym?.shot()) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12) return; // a tap, not a drag (yet)
      const dx = e.clientX - lastP.x, dy = e.clientY - lastP.y;
      lastP = { x: e.clientX, y: e.clientY };
      orb.drag(dx, view.first ? 0 : dy); view.drag(dy); orbitHold = 1.5;
    };
    const pu = (e: PointerEvent) => {
      lastP = null;
      if (!down || container.dataset.pinching) { down = null; return; }
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12 && performance.now() - down.t < 600) tap(e.clientX, e.clientY);
      down = null;
    };
    renderer.domElement.addEventListener("pointerdown", pd);
    renderer.domElement.addEventListener("pointerup", pu);
    renderer.domElement.addEventListener("pointermove", pm);
    return () => { renderer.domElement.removeEventListener("pointerdown", pd); renderer.domElement.removeEventListener("pointerup", pu); renderer.domElement.removeEventListener("pointermove", pm); };
  })();

  // ── Camera D: behind you, pinch / wheel zooms out (three3d/followCam.ts) ──
  const zoom = new FollowZoom(demo ? demo.zoom ?? 0 : loadFollowZoom());
  const detachZoom = attachFollowZoom(container, zoom);
  const boom = new FollowBoom();
  let CS = zoomedFollowCam(zoom.now);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let camYaw = you.yaw + Math.PI;
  let camSide = 0;
  let first = true;
  /** First person | third person (the eye button), eased; using something steps back out to third (../three3d/viewCam.ts). */
  const view = new ViewCam(demo ? "third" : loadViewMode());
  const viewHead = new THREE.Vector3();
  let headBone: any = null;
  const placeView = (dt: number, busy: boolean) => {
    view.step(dt, busy);
    headBone ??= findHeadBone(you.root);
    showBody(you.root, view.place(camera, camPos, camLook, headWorld(headBone, you.root, viewHead), -Math.sin(camYaw), -Math.cos(camYaw), built.ceil, dt)); // in his eyes: not drawn (root.visible is "here or away" to the world kit)
  };
  const [cx0, cx1, cz0, cz1] = built.camBox;
  // the compound: the boom also stops short of the fence, the gate's railings, the hut and the building (it went
  // through the railing as you turned in at the gate, 28 Nov)
  const tall = CP ? CP.tallSolids() : null;
  const freeBehind = (dx: number, dz: number) => {
    const f = boxRoom(you.x, you.z, dx, dz, cx0, cx1, cz0, cz1);
    return tall ? Math.min(f, Math.max(0.6, CP!.rayToBoxes(you.x, you.z, dx, dz, tall) - 0.35)) : f;
  };
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? CS.fov : 50;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  let shotWas = false;
  // stills only: a fixed camera from the test harness (window.__world3dCam([x,y,z],[x,y,z]) / null), for close-ups
  let camPin: { cam: number[]; look: number[] } | null = null;
  (window as any).__world3dCam = (cam: number[] | null, look?: number[]) => { camPin = cam && look ? { cam, look } : null; };
  const stepCam = (dt: number) => {
    if (camPin) { camera.position.set(camPin.cam[0], camPin.cam[1], camPin.cam[2]); camera.lookAt(camPin.look[0], camPin.look[1], camPin.look[2]); return; }
    // a gym mini-game: its own shot (set while the screen is black, eased after)
    const sh = gym?.shot();
    if (sh) {
      want.set(sh.cam[0], sh.cam[1], sh.cam[2]); wantLook.set(sh.look[0], sh.look[1], sh.look[2]);
      // a cut behind the black screen, or (he walked on: no black) a glide from where the camera is
      if (!shotWas && !gym?.easeIn) { camPos.copy(want); camLook.copy(wantLook); shotWas = true; }
      else { shotWas = true; camPos.lerp(want, Math.min(1, dt * 3)); camLook.lerp(wantLook, Math.min(1, dt * 3)); }
      placeView(dt, true); // the mini-game's own shot (first person steps out to it)
      return;
    }
    if (shotWas) { shotWas = false; first = true; camYaw = you.yaw + Math.PI; }
    zoom.step(dt);
    CS = zoomedFollowCam(zoom.now);
    const aspect = (container.clientWidth || 1) / (container.clientHeight || 1);
    if (aspect < 0.7 && Math.abs(camera.fov - CS.fov) > 1e-3) { camera.fov = CS.fov; camera.updateProjectionMatrix(); }
    // behind him: swings round slowly as he turns, faster when he walks
    const k = you.speed > 0.3 ? CS.yawK : you.seated ? 0.8 : watch ? 1.2 : 0.5;
    camYaw += orb.step(dt);
    if (orbitHold > 0) orbitHold -= dt;
    else camYaw += angDiff(camYaw, you.yaw + Math.PI) * Math.min(1, dt * k);
    const cfx = -Math.sin(camYaw), cfz = -Math.cos(camYaw);
    if (first) boom.reset();
    const len = boom.step(CS.back, freeBehind(-cfx, -cfz), dt);
    const short = CS.back - len;
    const up = riseForMin(len, Math.min(built.ceil, CS.height + short * CS.riseIfShort), built.ceil);
    // talking: over his right shoulder, so the man he talks to is not hidden behind him
    camSide += ((talking && card ? 0.75 : 0) - camSide) * Math.min(1, dt * 3);
    const rx = -cfz, rz = cfx; // the camera's right on the floor
    want.set(you.x - cfx * len + rx * camSide, up, you.z - cfz * len + rz * camSide);
    const lookY = you.seated ? CS.lookY - 0.25 : CS.lookY;
    wantLook.set(you.x + cfx * CS.lookAhead + rx * camSide * 0.2, lookY, you.z + cfz * CS.lookAhead + rz * camSide * 0.2);
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; }
    else { camPos.lerp(want, Math.min(1, dt * CS.posK)); camLook.lerp(wantLook, Math.min(1, dt * CS.lookK)); }
    const flat = capOnLine(camPos, you.x, you.z, freeBehind);
    camPos.y = riseForMin(flat, camPos.y, built.ceil);
    placeView(dt, !!you.using || you.seated || !!(talking && card));
  };

  // ── The fade to black through a door (the compound's gym door) ──
  let fade = 0, fadeWant = 0, goingTo: WorldPlace | null = null, went = false;
  const fadeM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false });
  const fadeQ = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), fadeM);
  fadeQ.position.z = -0.3; fadeQ.renderOrder = 999; fadeQ.frustumCulled = false; fadeQ.visible = false;
  camera.add(fadeQ); scene.add(camera);
  const stepFade = (dt: number) => {
    if (fade === fadeWant) return;
    fade = fadeWant > fade ? Math.min(fadeWant, fade + dt * 1.4) : Math.max(fadeWant, fade - dt * 1.4);
    fadeM.opacity = fade; fadeQ.visible = fade > 0.001;
    // through the door: the page opens the next place (a filmed demo just holds the black)
    if (fade >= 1 && goingTo && !went) { went = true; if (!demo) cb.onGo?.(goingTo); }
  };
  // the compound: how long each person has been on the same thing (the "never stuck" check)
  const same = new Map<Npc, { key: string; t: number; most: number }>();
  const stepSame = (dt: number) => {
    for (const n of npcs) {
      const key = `${n.state}|${n.using?.id ?? ""}`;
      const e = same.get(n);
      if (!e || e.key !== key) same.set(n, { key, t: 0, most: e?.most ?? 0 });
      else { e.t += dt; e.most = Math.max(e.most, e.t); }
    }
  };

  // ── One frame ──
  let frameN = 0, shadowT = 0, statusT = 0, animated = 0;
  let simT = 0;
  const demoSteps = demo ? demo.steps.slice() : [];
  let goNext: string | null = null;
  const frustum = new THREE.Frustum();
  const pm = new THREE.Matrix4();
  const tv3 = new THREE.Vector3();
  const lastPosed = new Map<Npc, number>();
  const step = (dt: number) => {
    simT += dt;
    while (demoSteps.length && demoSteps[0][0] <= simT) {
      const [, what] = demoSteps.shift()!;
      if (what.startsWith("tap:")) tapId(what.slice(4)); else if (what.startsWith("act:")) act(what.slice(4));
      else if (what.startsWith("bot:") && gym) gym.bot = Number(what.slice(4));
      else if (what.startsWith("go:") && CP) { autoGo = what.slice(3); tapId(autoGo); } // the compound: tap it, go in when its card opens
      else if (what.startsWith("go:")) goNext = what.slice(3);
    }
    if (autoAt >= 0 && simT >= autoAt) { autoAt = -1; act("use"); }
    // a filmed tour: the next exercise as soon as the last one has finished (tap it, walk there, start)
    if (goNext && !gym?.active) { tapId(goNext); act("use"); goNext = null; }
    clock.advance(dt);
    // a filmed run can have you turn to watch someone (the camera turns with you)
    if (watch && you.state === "stand") {
      const w = npcs.find((n) => n.id === watch);
      if (w?.root.visible) { const want = yawTo([you.x, you.z], w.bodyXZ()); if (Math.abs(angDiff(you.yaw, want)) > 0.35) you.face(want); }
    }
    runners.forEach((r, n) => { if (!paused.has(n)) r.tick(clock.minute + (clock.day * 1440), (s) => startStep(n, s, r), (s) => stopStep(n, s, r)); });
    // the bench chat: seated people look at a neighbour now and then (seeded by the clock, not random)
    for (const n of npcs) {
      if (n === talking || !n.seated) { if (n !== talking && !n.seated) n.lookAt = null; continue; }
      const nb = npcs.filter((m) => m !== n && m.seated && m.root.visible);
      const ph = Math.floor((simT + npcs.indexOf(n) * 2.3) / 3.1) % 3;
      n.lookAt = nb.length && ph !== 2 ? nb[ph % nb.length].bodyXZ() : null;
    }
    // the budget: who is posed this frame
    camera.updateMatrixWorld();
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm);
    const vis = npcs.filter((n) => n.root.visible);
    const plan = planBudget(vis.map((n) => { const [x, z] = n.bodyXZ(); tv3.set(x, 1, z); return { id: n.id, dist: Math.hypot(x - camera.position.x, z - camera.position.z), onScreen: frustum.containsPoint(tv3), moving: n.moving }; }), budget);
    animated = 0;
    gym?.step(dt);
    if (gymRoom) {
      // the team-mate's belt runs while he is on it
      const b2 = gymRoom.props.belts.find((b) => b.id === "treadmill2");
      const on = npcs.some((n) => n.using?.id === "treadmill2" && n.state === "use");
      if (b2) b2.speed += ((on ? mateBeltSpeed : 0) - b2.speed) * Math.min(1, dt * 3);
    }
    you.update(dt, world, true);
    gym?.afterPose(dt);
    mateGym.forEach((m) => m.ex.restore());
    vis.forEach((n, i) => {
      const every = plan[i].every;
      const on = animatesOn(every, frameN, i + 1);
      const since = (lastPosed.get(n) ?? 0) + dt;
      if (n.update(dt, world, on, since)) { lastPosed.set(n, 0); animated++; } else lastPosed.set(n, since);
    });
    for (const n of npcs) if (!n.root.visible) n.update(dt, world, false);
    if (place === "gym") for (const n of npcs) if (n.root.visible) mateGymFrame(n, dt);
    // the soft shadow under each person (the compound: not past 22 m from the camera, where it is a few pixels and still a draw)
    blobs.forEach((b, n) => { const [x, z] = n.bodyXZ(); b.visible = n.root.visible && (!CP || Math.hypot(x - camera.position.x, z - camera.position.z) < 22); b.position.set(x, 0.012, z); });
    faces.forEach((f, n) => { if (n.root.visible) f.rig.set({ blink: FACE.blinkAt(simT, f.seed) }); });
    for (const h of hairs) h.update?.(dt);
    tvScreen?.tick(dt);
    fridgeDoor?.tick(dt);
    marker.update(dt);
    stepCam(dt);
    if (compound) {
      compound.update(camera);
      farB?.update(camera.position);
      carsLod?.update(camera);
      compound.tick(dt);
      if (compound.follow(you.x, you.z)) renderer.shadowMap.needsUpdate = true;
      stepFade(dt);
      stepSame(dt);
    }
    if (gym && cb.onGym) cb.onGym(gym.hud());
    // the sun's shadow: drawn again only while someone moves
    if (sun?.castShadow) {
      shadowT -= dt;
      // only bodies that cast a real shadow count: on a phone the team-mates have a soft blob instead,
      // so their walking never redraws the whole shadow map (measured: 18 → 97 draws a frame when it did)
      const moving = people.some((p) => p.root.visible && p.moving && p.person.body.castShadow) || frameN < 3;
      if (moving && shadowT <= 0) { renderer.shadowMap.needsUpdate = true; shadowT = 0.1; }
    }
    statusT -= dt;
    if (statusT <= 0 && cb.onStatus) {
      statusT = 0.5;
      cb.onStatus({ fitness: fitness(), clock: clock.hhmm, people: npcs.map((n) => ({ id: n.id, name: n.name, doing: !n.root.visible ? "away" : CP ? (n.state === "walk" ? "walking" : n.using?.kind === "seat" ? "on the bench" : n.using?.label?.toLowerCase() ?? "standing") : place === "gym" && n.using ? (n.using.id === "treadmill2-belt" ? "running" : n.using.id === "mat" ? "stretching" : n.using.id === "cooler" ? "a drink" : n.using.label) : n.seated ? (n.prop ? "on the bench, a drink" : "on the bench") : n.state === "walk" ? "walking" : n.state === "act" ? "stretching" : "standing" })) });
    }
    frameN++;
  };

  let cull: { stats(): { checked: number; skipped: number }; dispose(): void } | null = null;
  const c0 = compound as import("./compoundPlace").CompoundOut | null; // (set inside buildCompoundPlace: TS can't see it)
  if (c0) {
    const { tightCull } = await import("../three3d/tightCull");
    const c = c0;
    cull = tightCull(THREE, scene, renderer, { moving: new Set<any>([...people.map((p) => p.root), ...c.moving, camera]), extraHide: (cam) => c.hidden(cam) });
  }
  try { await safeCompileAsync(renderer, scene, camera); } catch { /* compiled on first use */ }
  if (disposed) throw new Error("disposed");

  let last = performance.now();
  let filming = false;
  const perf = { frames: 0, stepMs: 0, renderMs: 0 };
  const loop = () => {
    if (filming || disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    step(dt);
    const mid = performance.now();
    renderer.render(scene, camera);
    // the main thread's cost of a frame (the phone measurement: scripts read ctrl.perf())
    perf.frames++; perf.stepMs += mid - now; perf.renderMs += performance.now() - mid;
  };
  // a filmed demo waits for the film tool's seek (frameStep.ts): nothing moves before frame 0
  if (demo) { stepCam(0); renderer.render(scene, camera); }
  else if (isOwner()) renderer.setAnimationLoop(loop);
  // filming: be at exactly second t (fixed 1/30 steps, forward only)
  const FIX = 1 / 30;
  const unpublish = publishFrameStep({
    duration: demo?.duration ?? 10,
    seek: (t: number) => {
      if (!filming) { filming = true; renderer.setAnimationLoop(null); }
      while (simT + FIX / 2 < t) step(FIX);
      if (frameN === 0) stepCam(0);
      renderer.render(scene, camera);
    },
  });

  const ctrl: WorldController = {
    tap, act, tapId,
    gymHold: (on: boolean) => { if (gym) gym.hold = on; },
    gymBot: (skill: number | null) => { if (gym) gym.bot = skill; },
    perf: () => { const o = { ...perf }; perf.frames = 0; perf.stepMs = 0; perf.renderMs = 0; return o; },
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, tier, people: people.filter((p) => p.root.visible).length, animated }),
    setView: (m) => { view.set(m); },
    teleport: (x, z, yaw) => { if (you.seated) return; you.stop(); you.place(x, z, yaw); camYaw = yaw + Math.PI; first = true; if (compound?.follow(x, z)) renderer.shadowMap.needsUpdate = true; },
    viewMode: () => view.mode,
    debug: () => ({
      place, tier, budget, clock: clock.hhmm, simT: +simT.toFixed(2),
      you: you.info(), people: npcs.map((n) => n.info()),
      routines: npcs.map((n) => { const r = runners.get(n); return r ? { id: n.id, i: r.index, step: r.current?.do.kind, at: r.current?.at.toFixed(1), until: r.current?.until.toFixed(1), next: r.routine.steps[r.index + 1]?.do.kind, nextAt: r.routine.steps[r.index + 1]?.at.toFixed(1) } : null; }), book: book.all(),
      sit: people.map((p) => ({ id: p.id, fit: p.sit })),
      // the seat check: each seated person's seat underside against the seat top (cm; + = above)
      // the seat check (RUL-3D-005, a body never into the furniture): every skin point of each seated
      // person inside the seat's slab (from 20 cm behind his hips to its front edge, 32 cm either side,
      // the top 8 cm), the deepest in cm (0 = nothing in it)
      seats: people.filter((p) => p.state === "use" && p.using?.kind === "seat" || (p.state === "use" && p.using?.via)).map((p) => {
        const host = objects.host(p.using!);
        const slot = host.slots.find((x) => book.holderOf(host.id, x.id) === p.id) ?? host.slots[0];
        const s = slot.seat!;
        const f = [Math.sin(slot.facing), Math.cos(slot.facing)], r = [Math.cos(slot.facing), -Math.sin(slot.facing)];
        const body: any = p.person.body;
        body.skeleton?.update?.();
        const v = new THREE.Vector3();
        let deep = 0, n = 0;
        const parts: Record<string, { n: number; deep: number; along: number }> = {};
        for (let k = 0; k < body.geometry.attributes.position.count; k += 2) {
          body.getVertexPosition(k, v); v.applyMatrix4(body.matrixWorld);
          const dx = v.x - s.at[0], dz = v.z - s.at[1];
          const along = dx * f[0] + dz * f[1], side = dx * r[0] + dz * r[1];
          if (along < -0.2 || along > (s.front ?? 0.3) || Math.abs(side) > 0.32) continue;
          if (v.y < s.y && v.y > s.y - 0.08) {
            deep = Math.max(deep, s.y - v.y); n++;
            const bi = body.geometry.attributes.skinIndex, bw = body.geometry.attributes.skinWeight;
            let best = 0; for (let c = 1; c < 4; c++) if (bw.getComponent(k, c) > bw.getComponent(k, best)) best = c;
            const bn = body.skeleton.bones[bi.getComponent(k, best)]?.name ?? "?";
            const e = parts[bn] ?? (parts[bn] = { n: 0, deep: 0, along: 0 });
            e.n++; e.deep = Math.max(e.deep, +((s.y - v.y) * 100).toFixed(1)); e.along = +along.toFixed(2);
          }
        }
        return { id: p.id, pierceCm: +(deep * 100).toFixed(1), points: n, liftCm: +(p.y * 100).toFixed(1), parts };
      }),
      minGap: (() => { let m = Infinity; const b = world.bodies(); for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) m = Math.min(m, Math.hypot(b[i].x - b[j].x, b[i].z - b[j].z)); return +m.toFixed(2); })(),
      card: card?.title ?? null,
      compound: compound ? { ...compound.stats(), cull: cull?.stats(), far: farB?.stats(), fade: +fade.toFixed(2), mostSameS: npcs.map((n) => ({ id: n.id, now: +(same.get(n)?.t ?? 0).toFixed(1), most: +(same.get(n)?.most ?? 0).toFixed(1), doing: same.get(n)?.key })) } : null,
      gym: gym ? { ex2: gym.ex2.stats, mate: mateGym.size ? Array.from(mateGym.values()).map((m) => ({ kind: m.kind, stats: m.ex.stats })) : null, body: (() => { const inner = you.person.root.children[0]; return inner ? [+inner.scale.x.toFixed(4), +inner.scale.y.toFixed(4), +inner.scale.z.toFixed(4)] : null; })(), phase: gym.phase, kind: gym.kind, benchPierceCm: gym.benchPierceCm, gripGapCm: gym.gripGapCm, barPierceCm: gym.barPierceCm, railPierceCm: gym.railPierceCm, info: gym.active ? gym.info() : null, game: gym.game ? { t: +gym.game.t.toFixed(2), done: gym.game.done } : null, fitness: fitness() } : null,
      stats: ctrl.stats(),
    }),
    dispose: () => {
      disposed = true;
      unpublish();
      if ((window as any).__world3d === ctrl) delete (window as any).__world3d;
      delete (window as any).__world3dCam;
      if (isOwner()) renderer.setAnimationLoop(null);
      ro.disconnect();
      detachZoom();
      onPointer();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      marker.dispose();
      cull?.dispose();
      compound?.dispose();
      fadeM.dispose(); propG.dispose();
      gym?.dispose();
      gymRoom?.mirror?.dispose?.();
      envTex.dispose(); pmrem.dispose();
      release(scene);
    },
  };
  (window as any).__world3d = ctrl;
  (window as any).__world3dScene = scene; // dev page only: the triangle breakdown in scripts/world3d
  (window as any).__world3dProbe = (id: string, clip: string, times: number[]) => {
    const n = people.find((x) => x.id === id)!;
    const p = n.person;
    const out: any[] = [];
    for (const t of times) {
      for (const a of Object.values(p.actions)) a.setEffectiveWeight(0);
      const a = p.actions[clip]; a.enabled = true; a.play(); a.setEffectiveWeight(1); a.time = t; a.timeScale = 0;
      p.mixer.update(0); p.root.updateMatrixWorld(true);
      const loc = (b: any) => { const v = new THREE.Vector3(); b.getWorldPosition(v); return p.root.worldToLocal(v).toArray().map((x: number) => +x.toFixed(3)); };
      out.push({ t, hips: loc(p.bones.Hips), lf: loc(p.bones.LeftFoot), rf: loc(p.bones.RightFoot), lul: loc(p.bones.LeftUpLeg), head: loc(p.bones.Head) });
    }
    return out;
  };
  return ctrl;
}

/** Where a ray first meets a standing cylinder (centre x,z, radius r, from the floor to h), or null. */
function rayCyl(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, cx: number, cz: number, r: number, h: number): number | null {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
    if (t < 0) continue;
    const y = o.y + d.y * t;
    if (y >= 0 && y <= h) return t;
  }
  // through the top cap
  if (Math.abs(d.y) > 1e-6) {
    const t = (h - o.y) / d.y;
    if (t > 0) { const x = ox + d.x * t, z = oz + d.z * t; if (x * x + z * z <= r * r) return t; }
  }
  return null;
}

/** A small number from an id (a person's blink timing). */
function hashSeed(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return h;
}
