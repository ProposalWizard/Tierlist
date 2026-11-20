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
import { installAssetVersions } from "../three3d/assetUrl";
import { TIER_PROFILES, quality3dTier, shadowSizeFor, deviceKind, currentDeviceInfo, type Quality3d } from "../three3d/quality";
import { acquireRenderer, rememberGpu, loadGltfCached } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, toonHeadsFor, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { addClips, clipInfo, loadAnims3d } from "../three3d/footballAnims";
import { FOLLOW_CAM_D, FollowBoom, FollowZoom, attachFollowZoom, boxRoom, capOnLine, loadFollowZoom, riseForMin, zoomedFollowCam } from "../three3d/followCam";
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

export type WorldPlace = "house" | "garden";

export interface WorldPerson { id: string; name: string; number: number }

export interface WorldOptions {
  place: WorldPlace;
  quality?: Quality3d;
  kit: { shirt: string; trim: string };
  /** Your shirt number. */
  number: number;
  /** The garden's team-mates: two on the bench, then the one who drops round. */
  mates: WorldPerson[];
  /** How much faster than real time the clock runs (default 4). */
  rate?: number;
  /** A filmed run: "sofa" | "fridge" | "visitor" | "talk" (scripted taps, frame-stepped). */
  demo?: string | null;
  /** The living world's chat with a team-mate (lib/star/life/social.ts chat), or null when it says no. */
  chat?: (id: string) => { line: string; change?: string } | null;
}

export interface WorldStatus { clock: string; people: { id: string; name: string; doing: string }[] }

export interface WorldCallbacks {
  onCard: (card: InteractCard | null) => void;
  onStatus?: (s: WorldStatus) => void;
  onContextLost?: () => void;
}

export interface WorldController {
  tap: (clientX: number, clientY: number) => void;
  act: (action: string) => void;
  /** A scripted tap on a thing or a person by id (the demos and the filming). */
  tapId: (id: string) => void;
  stats: () => { calls: number; triangles: number; tier: Quality3d; people: number; animated: number };
  debug: () => Record<string, unknown>;
  dispose: () => void;
}

/** The demos: what happens when (seconds), and how long each runs. */
const DEMOS: Record<string, { place: WorldPlace; duration: number; rate?: number; steps: [number, string][]; you?: [number, number, number]; watch?: string; zoom?: number }> = {
  sofa: { place: "house", duration: 13, steps: [[0.4, "tap:tv"], [3.6, "act:use"], [10.5, "act:leave"]] },
  fridge: { place: "house", duration: 15, steps: [[0.4, "tap:fridge"], [6.4, "act:use"]] },
  visitor: { place: "garden", duration: 34, rate: 10, steps: [], you: [-0.3, 1.9, 2.6], watch: "mate-2", zoom: 0.5 },
  talk: { place: "garden", duration: 11, steps: [[0.4, "tap:mate-0"], [7.4, "act:chat"]] },
};
export const WORLD_DEMOS = DEMOS;

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

  if (place === "house") built = await buildHouse();
  else built = buildGarden();

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
    // the fridge's glass door (the lounge's drinks fridge, north-west corner), hinged on its left
    {
      const fx = -W2 + 0.45 + 0.05, fz = -D2 + 0.4;
      const hinge = new THREE.Group();
      hinge.position.set(fx - 0.29, 0, fz + 0.32);
      room.group.add(hinge);
      const glass = mat("#bfe3ff", { transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.2 });
      const frame = mat("#2a2d33", { roughness: 0.4, metalness: 0.5 });
      box(0.58, 1.4, 0.03, glass, 0.29, 0.78, 0.015, hinge, false);
      box(0.03, 1.4, 0.04, frame, 0.57, 0.78, 0.02, hinge, false);
      let want = 0, a = 0;
      fridgeDoor = { open: (v) => { want = v ? 1 : 0; }, tick: (dt) => { a += (want - a) * Math.min(1, dt * 5); hinge.rotation.y = -a * 1.75; } };
    }
    // the smart objects: the sofa (three seats facing the TV), the TV, the fridge
    // sofa: roomBuild.ts sofa(…, 2.3, 0.55, 0.25, "w"): seat front at x 0.11, cushion top 0.445
    const sofa = seatObject({ id: "sofa", label: "Sofa", at: [0.43, 0.25], facing: -Math.PI / 2, seats: 3, y: 0.445, spacing: 0.63, verb: "Sit down", lines: ["Feet up for a bit."] });
    const tv = tvObject({ id: "tv", at: [-W2 + 0.2, 0], via: "sofa", lines: ["The weekend's highlights are on."] });
    const fridge = standObject({
      id: "fridge", kind: "fridge", label: "Drinks fridge", front: [fx0(W2), -D2 + 0.4 + 0.3 + 0.5], face: [fx0(W2), -D2 + 0.3], verb: "Take a can",
      lines: ["Your KIB cans, cold."], enter: { clip: "pickup", speed: 1.7 }, loop: [{ clip: "idle", secs: 3.2, gesture: "drink" }],
      effect: { energy: 1, text: "Ice cold. Energy +1" }, stay: [3.5, 3.5], pickR: 0.6,
    });
    return {
      objects: [sofa, tv, fridge], solids: room.solids,
      bounds: [-W2, W2, -D2, D2], you: { x: 1.2, z: D2 - 1.2, yaw: Math.PI }, ceil: room.h - 0.15,
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
    const leafM = mat("#3d6a2a", { roughness: 0.9 });
    const potM = mat("#b5683f", { roughness: 0.85 });
    for (const [x, z] of [[4.8, -6.4], [-4.0, -7.0], [6.4, 4.6], [3.0, 1.2]]) {
      box(0.6, 0.5, 0.6, potM, x, 0.25, z);
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), leafM); s.position.set(x, 0.85, z); s.castShadow = true; scene.add(s);
      solids.push([x - 0.35, x + 0.35, z - 0.35, z + 0.35]);
    }
    const trunkM = mat("#5a4030");
    for (const [x, z, r] of [[-11, -4, 2.2], [11, -2, 2.6], [-10.5, 6, 2], [10.5, 8, 2.3], [-3, -14, 2.8], [5, -14.5, 2.4]]) {
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 2.4, 8), trunkM); tr.position.set(x, 1.2, z); tr.castShadow = true; scene.add(tr);
      const cr = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), leafM); cr.position.set(x, 2.4 + r * 0.8, z); cr.castShadow = true; scene.add(cr);
    }
    // the bench: four seats facing east (feet at the seat's front edge, hips 0.32 m back from it)
    const bench = seatObject({
      id: "bench", label: "Garden bench", at: [BX + DEPTH / 2 - 0.1 - 0.32, BZ], facing: Math.PI / 2, seats: 4, y: SEAT_Y, spacing: 0.66,
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
  const grid: WalkGrid = buildGrid(bx0, bx1, bz0, bz1, 0.2, (x, z) => {
    if (x < bx0 + BODY_R || x > bx1 - BODY_R || z < bz0 + BODY_R || z > bz1 - BODY_R) return false;
    for (const [a, b, c, d] of built.solids) if (x > a - BODY_R && x < b + BODY_R && z > c - BODY_R && z < d + BODY_R) return false;
    return true;
  });

  // ── People: their bodies and clips ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const mates = place === "garden" ? opts.mates.slice(0, 3) : [];
  const who = [{ you: true }, ...mates.map((m) => ({ who: `world-mate-${m.id}` }))];
  const [charG, animG, footG] = await Promise.all([
    loadPeople3d(loader, "player", people3dLook(), toonHeadsFor(who)),
    loadPeople3d(loader, "anims", people3dLook()),
    loadAnims3d(loader, "football"),
  ]);
  if (disposed) throw new Error("disposed");
  const walkInfo = clipInfo(footG, "walk"), jogInfo = clipInfo(footG, "jog");
  const canG = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12);
  const canM = mat("#d7263d", { roughness: 0.3, metalness: 0.7 });
  const outline = prof.outlines ? 0.006 : 0;
  const makeOne = (id: string, o: { you?: boolean; number: number; kit: { shirt: string; trim: string } }) => {
    const p: Person3D = makePerson3d(THREE, SK, charG, animG, { outline, castShadow: true, ...(o.you ? { you: true } : { who: id }) });
    dressPerson3d(THREE, p, { skin: o.you ? "#c68642" : toonSkinFor(id), hair: o.you ? "#2b1b12" : toonHairFor(id), kit: o.kit, number: tex(numberCanvas(o.number, "#ffffff")) });
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
    // NPCs: a soft blob, no cast shadow on a phone (as the garden's bench mates)
    if (!o.you && tier !== "high") p.body.castShadow = false;
    return n;
  };
  const you = makeOne("you", { you: true, number: opts.number, kit: opts.kit });
  you.name = "You";
  if (demo?.you) you.place(demo.you[0], demo.you[1], demo.you[2]);
  else you.place(built.you.x, built.you.z, built.you.yaw);
  const watch = demo?.watch ?? null;
  const away = { shirt: "#f2f2f2", trim: opts.kit.shirt };
  const npcs: Npc[] = mates.map((m, i) => {
    const n = makeOne(`mate-${i}`, { number: m.number, kit: i === 2 ? away : opts.kit });
    n.name = m.name;
    return n;
  });
  const people = [you, ...npcs];
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

  const world: NpcWorld = {
    grid, book,
    bodies: (): Body[] => people.filter((p) => p.root.visible && p.state !== "hidden").map((p) => { const [x, z] = p.bodyXZ(); return { id: p.id, x, z, r: BODY_R }; }),
  };

  // ── The clock and the routines (garden) ──
  const rate = demo?.rate ?? opts.rate ?? 4;
  const clock = new DayClock(15 * 60, rate);
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

  // ── Tapping: a person, a thing, else the floor; walk up; one card ──
  const marker = makeTapMarker(THREE, scene);
  let card: InteractCard | null = null;
  let pending: { obj: SmartObject; slot: string | null } | null = null;
  let talking: Npc | null = null;
  const visits = new Map<string, number>();
  const show = (c: InteractCard | null) => { card = c; cb.onCard(c); };
  const endTalk = () => {
    if (talking) {
      talking.lookAt = null;
      if (paused.has(talking)) { paused.delete(talking); const r = runners.get(talking); const cur = r?.current; if (r && cur) startStep(talking, cur, r); }
      talking = null;
    }
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
        show(personCard({ id: n.id, name: n.name, lines: smallTalk(n.id, doingOf(n), clock.phase(), k), chat: !!opts.chat }));
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
          if (o.kind === "fridge") { holdCan(you, true); fridgeDoor?.open(false); }
          show(objectCard(o, { using: true }));
        },
        onOut: () => { if (o.kind === "fridge") show({ key: `obj:${o.id}`, title: o.label, lines: [o.effect?.text ?? "Done."], actions: [{ id: "close", label: "OK", primary: true }] }); },
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
  const onPointer = (() => {
    let down: { x: number; y: number; t: number } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const pu = (e: PointerEvent) => {
      if (!down || container.dataset.pinching) { down = null; return; }
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12 && performance.now() - down.t < 600) tap(e.clientX, e.clientY);
      down = null;
    };
    renderer.domElement.addEventListener("pointerdown", pd);
    renderer.domElement.addEventListener("pointerup", pu);
    return () => { renderer.domElement.removeEventListener("pointerdown", pd); renderer.domElement.removeEventListener("pointerup", pu); };
  })();

  // ── Camera D: behind you, pinch / wheel zooms out (three3d/followCam.ts) ──
  const zoom = new FollowZoom(demo ? demo.zoom ?? 0 : loadFollowZoom());
  const detachZoom = attachFollowZoom(container, zoom);
  const boom = new FollowBoom();
  let CS = zoomedFollowCam(zoom.now);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let camYaw = you.yaw + Math.PI;
  let first = true;
  const [cx0, cx1, cz0, cz1] = built.camBox;
  const freeBehind = (dx: number, dz: number) => boxRoom(you.x, you.z, dx, dz, cx0, cx1, cz0, cz1);
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
  const stepCam = (dt: number) => {
    zoom.step(dt);
    CS = zoomedFollowCam(zoom.now);
    const aspect = (container.clientWidth || 1) / (container.clientHeight || 1);
    if (aspect < 0.7 && Math.abs(camera.fov - CS.fov) > 1e-3) { camera.fov = CS.fov; camera.updateProjectionMatrix(); }
    // behind him: swings round slowly as he turns, faster when he walks
    const k = you.speed > 0.3 ? CS.yawK : you.seated ? 0.8 : watch ? 1.2 : 0.5;
    camYaw += angDiff(camYaw, you.yaw + Math.PI) * Math.min(1, dt * k);
    const cfx = -Math.sin(camYaw), cfz = -Math.cos(camYaw);
    if (first) boom.reset();
    const len = boom.step(CS.back, freeBehind(-cfx, -cfz), dt);
    const short = CS.back - len;
    const up = riseForMin(len, Math.min(built.ceil, CS.height + short * CS.riseIfShort), built.ceil);
    want.set(you.x - cfx * len, up, you.z - cfz * len);
    const lookY = you.seated ? CS.lookY - 0.25 : CS.lookY;
    wantLook.set(you.x + cfx * CS.lookAhead, lookY, you.z + cfz * CS.lookAhead);
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; }
    else { camPos.lerp(want, Math.min(1, dt * CS.posK)); camLook.lerp(wantLook, Math.min(1, dt * CS.lookK)); }
    const flat = capOnLine(camPos, you.x, you.z, freeBehind);
    camPos.y = riseForMin(flat, camPos.y, built.ceil);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  };

  // ── One frame ──
  let frameN = 0, shadowT = 0, statusT = 0, animated = 0;
  let simT = 0;
  const demoSteps = demo ? demo.steps.slice() : [];
  const frustum = new THREE.Frustum();
  const pm = new THREE.Matrix4();
  const tv3 = new THREE.Vector3();
  const lastPosed = new Map<Npc, number>();
  const step = (dt: number) => {
    simT += dt;
    while (demoSteps.length && demoSteps[0][0] <= simT) {
      const [, what] = demoSteps.shift()!;
      if (what.startsWith("tap:")) tapId(what.slice(4)); else if (what.startsWith("act:")) act(what.slice(4));
    }
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
    you.update(dt, world, true);
    vis.forEach((n, i) => {
      const every = plan[i].every;
      const on = animatesOn(every, frameN, i + 1);
      const since = (lastPosed.get(n) ?? 0) + dt;
      if (n.update(dt, world, on, since)) { lastPosed.set(n, 0); animated++; } else lastPosed.set(n, since);
    });
    for (const n of npcs) if (!n.root.visible) n.update(dt, world, false);
    blobs.forEach((b, n) => { b.visible = n.root.visible; const [x, z] = n.bodyXZ(); b.position.set(x, 0.012, z); });
    tvScreen?.tick(dt);
    fridgeDoor?.tick(dt);
    marker.update(dt);
    stepCam(dt);
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
      cb.onStatus({ clock: clock.hhmm, people: npcs.map((n) => ({ id: n.id, name: n.name, doing: !n.root.visible ? "away" : n.seated ? (n.prop ? "on the bench, a drink" : "on the bench") : n.state === "walk" ? "walking" : n.state === "act" ? "stretching" : "standing" })) });
    }
    frameN++;
  };

  try { await safeCompileAsync(renderer, scene, camera); } catch { /* compiled on first use */ }
  if (disposed) throw new Error("disposed");

  let last = performance.now();
  let filming = false;
  const loop = () => {
    if (filming || disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    step(dt);
    renderer.render(scene, camera);
  };
  if (isOwner()) renderer.setAnimationLoop(loop);
  // filming: be at exactly second t (fixed 1/30 steps, forward only)
  const FIX = 1 / 30;
  const unpublish = publishFrameStep({
    duration: demo?.duration ?? 10,
    seek: (t: number) => {
      if (!filming) { filming = true; renderer.setAnimationLoop(null); }
      while (simT + FIX / 2 < t) step(FIX);
      renderer.render(scene, camera);
    },
  });

  const ctrl: WorldController = {
    tap, act, tapId,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, tier, people: people.filter((p) => p.root.visible).length, animated }),
    debug: () => ({
      place, tier, budget, clock: clock.hhmm, simT: +simT.toFixed(2),
      you: you.info(), people: npcs.map((n) => n.info()),
      routines: npcs.map((n) => { const r = runners.get(n); return r ? { id: n.id, i: r.index, step: r.current?.do.kind, at: r.current?.at.toFixed(1), until: r.current?.until.toFixed(1), next: r.routine.steps[r.index + 1]?.do.kind, nextAt: r.routine.steps[r.index + 1]?.at.toFixed(1) } : null; }), book: book.all(),
      sit: people.map((p) => ({ id: p.id, fit: p.sit })),
      // the seat check: each seated person's seat underside against the seat top (cm; + = above)
      seats: people.filter((p) => p.state === "use" && p.using?.slots[0]?.seat).map((p) => {
        const s = p.using!.slots[0].seat!;
        return { id: p.id, gapCm: +(((p.y + (p.sit?.under ?? 0)) - s.y) * 100).toFixed(1) };
      }),
      minGap: (() => { let m = Infinity; const b = world.bodies(); for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) m = Math.min(m, Math.hypot(b[i].x - b[j].x, b[i].z - b[j].z)); return +m.toFixed(2); })(),
      card: card?.title ?? null,
      stats: ctrl.stats(),
    }),
    dispose: () => {
      disposed = true;
      unpublish();
      if (isOwner()) renderer.setAnimationLoop(null);
      ro.disconnect();
      detachZoom();
      onPointer();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      marker.dispose();
      envTex.dispose(); pmrem.dispose();
      release(scene);
    },
  };
  (window as any).__world3d = ctrl;
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
