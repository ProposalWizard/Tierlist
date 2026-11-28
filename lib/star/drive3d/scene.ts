/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE DRIVE, DRAWN (driving phase 1, 28 Nov 2026; docs/plans/DRIVING_PLAN.md). Test page only
 * (/star-drive3d-dev, RUL-UI-002): not in the career yet.
 *
 * Draws ./drive.ts: your street (brick semis, front hedges, lamp posts, parked cars), the
 * roundabout, the country lane (hedges, textured trees: garden3d/cardTrees.ts, never the blocky
 * ones), and a STAND-IN compound at the end (gate, barrier, hut, car park, a training block):
 * the real compound (lib/star/world3d/compound*, another builder's) is not merged yet; swap it
 * in at `buildCompound`. Your car is the cut-wheel copy (tools/cars/cut_wheels.py): wheels spin
 * with the distance, the fronts steer. Two team-mates by the door turn to look.
 *
 * Speed (S20 Low target: ≤37 draws, ≤35k triangles): the scenery is joined by material (one
 * draw each: road, verges, hedges, house walls, roofs, props, trees), your car is the light copy
 * on Low, no traffic on Low, a blob under the car, no shadow map below High, fog hides the far end.
 * One loop (renderer.setAnimationLoop); ?film: window.__frameStep (frameStep.ts) seeks the sim.
 */
import { installAssetVersions } from "../three3d/assetUrl";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer, rememberGpu, loadGltfCached } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { publishFrameStep } from "../frameStep";
import { blobCanvas } from "../shop3d/textures";
import { brickCanvas, hedgeCanvas, slateCanvas, meadowCanvas, skyCanvas } from "../garden3d/textures";
import { addCardTree, addCardBush, cardGeometry, cardMaterial, loadCardAtlas, newCardBin, placeCardsSince } from "../garden3d/cardTrees";
import { at, offsetAt, LANE, ROAD_HALF, type Route } from "./route";
import { newDrive, stepDrive, answerCall, chooseFork, skipDrive, cycleCam, liveCam, barrierLift, arrivalShot, matesTurn, arrivalLine, INTRO_S, STEP, type DriveSession, type DriveScript, type ForkChoice, type DriveCam } from "./drive";
import { DRIVE_CARS, carFile, toLinear, type DriveCarId } from "./cars";
import type { SteerMode } from "./car";
import type { CallMemory } from "./calls";

export interface DriveSceneOptions {
  car: DriveCarId;
  leg: "in" | "back";
  quality?: Quality3d;
  mode: SteerMode;
  /** Force a call ("none" = no call; absent = the seeded one-in-three). */
  call?: string;
  seed?: number;
  /** A scripted thumb (the film). */
  script?: DriveScript;
  names: { mate: string; mate2: string; car: string; club: string };
  kit: { shirt: string; trim: string };
  /** A film page: the clock waits for window.__frameStep.seek. */
  film?: boolean;
  /** Without people (faster load for the speed test). */
  noPeople?: boolean;
}

export interface DriveUi {
  phase: DriveSession["phase"];
  mph: number;
  cam: DriveCam;
  call: { caller: string; lines: string[]; yes: string; no: string; state: DriveSession["callState"]; answer: DriveSession["callAnswer"]; reply?: string; effect?: string; since: number } | null;
  fade: number;
  caption: string | null;
  fork: boolean;
  forkChoice: ForkChoice | null;
  blocked: boolean;
  lane: "left" | "right";
  t: number;
}

export interface DriveCallbacks {
  onUi: (ui: DriveUi) => void;
  onDone: (r: { skipped: boolean; fork: ForkChoice | null; memories: CallMemory[] }) => void;
  onMemory?: (m: CallMemory) => void;
  onContextLost?: () => void;
}

export interface DriveController {
  hold: (on: boolean) => void;
  tap: (side: -1 | 1) => void;
  side: (v: number) => void;
  answer: (a: "yes" | "no") => void;
  fork: (c: ForkChoice) => void;
  skip: () => void;
  cam: () => void;
  stats: () => { calls: number; triangles: number; tier: Quality3d; fps: number };
  dispose: () => void;
}

const COMPOUND_HALF = 26;
/** Your garden gate along your street (your house is the first on the left); the car waits 6 m before it. */
const GATE_S = 6;

export async function startDrive(container: HTMLElement, cb: DriveCallbacks, opts: DriveSceneOptions): Promise<DriveController> {
  const own: { release?: (root?: any) => void; root?: any } = {};
  try { return await build(container, cb, opts, own); } catch (e) {
    if (own.release) { try { own.release(own.root); } catch { /* gone */ } }
    throw e;
  }
}

async function build(container: HTMLElement, cb: DriveCallbacks, opts: DriveSceneOptions, own: { release?: (root?: any) => void; root?: any }): Promise<DriveController> {
  const tier: Quality3d = opts.quality ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  await installAssetVersions();
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const BGU: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const merge = (gs: any[]) => BGU.mergeGeometries(gs, false);

  const { renderer, release, isOwner } = acquireRenderer(THREE, container, prof);
  own.release = release;
  rememberGpu(renderer);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const realShadow = tier === "high";
  renderer.shadowMap.enabled = realShadow;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let disposed = false;
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  own.root = scene;
  const FOG = { low: 68, medium: 85, high: 120 }[tier];
  const SKY_LOW = new THREE.Color("#cfe0ea");
  scene.fog = new THREE.Fog(SKY_LOW, FOG * 0.55, FOG);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, FOG + 30);
  // the sky: a gradient behind everything (one full-screen draw), the fog's colour at the bottom
  const skyT = new THREE.CanvasTexture(skyCanvas("#6f9fd0", "#a9c8e2", "#cfe0ea"));
  skyT.colorSpace = THREE.SRGBColorSpace;
  scene.background = skyT;
  // car paint reads on a little reflected sky
  if (tier !== "low") {
    const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
  }
  // a fresh morning: warm low sun, cool sky fill
  const hemi = new THREE.HemisphereLight("#d9e9ff", "#5d6b46", tier === "low" ? 1.55 : 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff1d6", 2.3);
  sun.position.set(-40, 55, 30);
  scene.add(sun, sun.target);
  if (realShadow) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const sc = sun.shadow.camera; sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 140;
    sun.shadow.bias = -0.0004;
  }

  const S = newDrive({
    leg: opts.leg, tier, seed: opts.seed ?? 7, mode: opts.mode, spec: { wheelR: 0.42, wheelbase: 2.6 },
    call: opts.call, names: { mate: opts.names.mate, car: opts.names.car, club: opts.names.club },
  });
  S.script = opts.script;
  const R: Route = S.route;

  const tex = (cv: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, prof.anisotropy ?? 4);
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };

  // ── bounds of the route (the ground) ──
  let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
  for (const p of R.pts) { mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mnz = Math.min(mnz, p.z); mxz = Math.max(mxz, p.z); }
  const PAD = 90;
  {
    const w = mxx - mnx + PAD * 2, d = mxz - mnz + PAD * 2;
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate((mnx + mxx) / 2, -0.02, (mnz + mxz) / 2);
    const m = new THREE.MeshStandardMaterial({ map: tex(meadowCanvas(), [w / 9, d / 9]), roughness: 1, color: "#b8c79c" });
    const me = new THREE.Mesh(g, m); me.receiveShadow = realShadow; scene.add(me);
  }

  // ── the road: one ribbon (asphalt with lines), the roundabout ring, the arms ──
  const roadCv = asphaltCanvas();
  const roadT = tex(roadCv); roadT.wrapT = THREE.RepeatWrapping;
  const roadM = new THREE.MeshStandardMaterial({ map: roadT, roughness: 0.92, color: "#ffffff" });
  const roadGs: any[] = [];
  // the roundabout and the car park are plain asphalt (u from the clean column); streets and lanes have lines
  roadGs.push(ribbon(THREE, R, 0, R.length, -ROAD_HALF, ROAD_HALF, 0.0, (k) => (k === "roundabout" || k === "park" ? [0.02, 0.06] : [0, 1])));
  {
    const I = R.island;
    const ring = new THREE.RingGeometry(I.r, I.ringOuter, 48, 1); ring.rotateX(-Math.PI / 2); ring.translate(I.x, 0.004, I.z);
    setUv(ring, 0.04, 0.5);
    roadGs.push(ring);
    // the other two arms (left and right), so it reads as a real junction
    for (const a of [Math.PI / 2, -Math.PI / 2]) {
      const h = at(R, R.pts.find((p) => p.kind === "roundabout")!.s).h + a;
      const arm = new THREE.PlaneGeometry(ROAD_HALF * 2, 40); arm.rotateX(-Math.PI / 2);
      arm.translate(0, 0.003, I.ringOuter + 18); arm.rotateY(h); arm.translate(I.x, 0, I.z);
      setUv(arm, 0.5, 0.5, true);
      roadGs.push(arm);
    }
  }
  const roadMesh = new THREE.Mesh(merge(roadGs.map((g) => g.index ? g.toNonIndexed() : g)), roadM);
  roadMesh.receiveShadow = realShadow;
  scene.add(roadMesh);

  // ── pavements and kerbs (street), verges (lane): one draw ──
  const paveM = new THREE.MeshStandardMaterial({ color: "#b9b4aa", roughness: 0.95 });
  const paveGs: any[] = [];
  for (const [a, b] of spans(R, (k) => k === "street")) {
    paveGs.push(ribbon(THREE, R, a, b, ROAD_HALF, ROAD_HALF + 2.2, 0.12));
    paveGs.push(ribbon(THREE, R, a, b, -ROAD_HALF - 2.2, -ROAD_HALF, 0.12));
  }
  {
    // the roundabout island: a raised kerb ring (the grass on it is the meadow)
    const I = R.island;
    const kerb = new THREE.RingGeometry(I.r - 0.4, I.r, 48, 1); kerb.rotateX(-Math.PI / 2); kerb.translate(I.x, 0.14, I.z);
    paveGs.push(kerb);
  }
  scene.add(new THREE.Mesh(merge(paveGs.map((g) => (g.index ? g.toNonIndexed() : g)).map(stripUv)), paveM));

  // ── props in plain colours (lamp posts, walls, fences, the gate, the signpost): one draw, vertex colours ──
  const propGs: any[] = [];
  const propBox = (w: number, h: number, d: number, x: number, y: number, z: number, ry: number, col: string) => {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateY(ry); g.translate(x, y, z);
    paint(THREE, g, col); propGs.push(stripUv(g.toNonIndexed()));
  };

  // ── houses (your street): brick walls with windows (one picture), slate roofs ──
  const wallCv = houseCanvas();
  const wallT = tex(wallCv);
  const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: 0.9 });
  const roofT = tex(slateCanvas(), [3, 2]);
  const roofM = new THREE.MeshStandardMaterial({ map: roofT, roughness: 0.85, color: "#8d8f96" });
  const wallGs: any[] = [], roofGs: any[] = [];
  const hedgeT = tex(hedgeCanvas(), [1, 1]); hedgeT.wrapS = hedgeT.wrapT = THREE.RepeatWrapping;
  const hedgeM = new THREE.MeshStandardMaterial({ map: hedgeT, roughness: 1, color: "#c9dcb0" });
  const hedgeGs: any[] = [];
  const streetSpans = spans(R, (k) => k === "street");
  for (const [a, b] of streetSpans) {
    for (let s = a + 6; s < b - 5; s += 12.5) {
      for (const side of [1, -1]) {
        // your house is the first on the left (s 6): its garden gate is in the gap of its hedge
        const set = ROAD_HALF + 2.2 + 5.5 + 4;
        const p = offsetAt(R, s, side * set);
        const ry = p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        house(THREE, wallGs, roofGs, p.x, p.z, ry, (Math.floor(s) * 7 + (side > 0 ? 3 : 0)) % 5);
        // front garden hedge with a gap for the path
        const hp = offsetAt(R, s, side * (ROAD_HALF + 2.2 + 0.4));
        for (const off of [-3.6, 3.6]) {
          const q = offsetAt(R, s + off, side * (ROAD_HALF + 2.2 + 0.4));
          hedgeGs.push(hedgeBox(THREE, 4.8, 0.95, 0.6, q.x, q.z, q.h));
        }
        void hp;
        // a lamp post every other house, on the kerb
        if (Math.round(s / 12.5) % 2 === 0) {
          const lp = offsetAt(R, s + 6, side * (ROAD_HALF + 0.5));
          propBox(0.12, 5.2, 0.12, lp.x, 2.6, lp.z, lp.h, "#4a4f55");
          const arm = offsetAt(R, s + 6, side * (ROAD_HALF + 0.05));
          propBox(0.9, 0.1, 0.12, arm.x, 5.15, arm.z, lp.h + Math.PI / 2, "#4a4f55");
          propBox(0.42, 0.12, 0.2, arm.x - Math.cos(lp.h) * side * 0.3, 5.07, arm.z + Math.sin(lp.h) * side * 0.3, lp.h + Math.PI / 2, "#f3efd8");
        }
      }
    }
  }
  // YOUR garden gate (the drive starts here; your car waits a few metres back): a white gate, swung open
  if (opts.leg === "in") {
    const g = offsetAt(R, GATE_S, ROAD_HALF + 2.2 + 0.4);
    propBox(1.3, 1.0, 0.07, g.x - Math.sin(g.h) * 0.2, 0.5, g.z - Math.cos(g.h) * 0.2, g.h + Math.PI / 2 + 0.9, "#f4f2ec");
    propBox(0.14, 1.25, 0.14, g.x + Math.sin(g.h) * 0.75, 0.62, g.z + Math.cos(g.h) * 0.75, g.h, "#f4f2ec");
    propBox(0.14, 1.25, 0.14, g.x - Math.sin(g.h) * 0.75, 0.62, g.z - Math.cos(g.h) * 0.75, g.h, "#f4f2ec");
  }
  // the lane: hedges both sides with field gates now and then; a farm track where the slow car turns off
  const laneSpans = spans(R, (k) => k === "lane" || k === "link" || k === "approach");
  for (const [a, b] of laneSpans) {
    for (const side of [1, -1]) {
      let s = a;
      while (s < b) {
        const e = Math.min(b, s + 22 + ((s * 13) % 9));
        hedgeGs.push(hedgeRibbon(THREE, R, s, e, side * (ROAD_HALF + 1.4), 1.7, 1.1));
        s = e + 4;
      }
    }
  }
  scene.add(new THREE.Mesh(merge(wallGs), wallM), new THREE.Mesh(merge(roofGs), roofM), new THREE.Mesh(merge(hedgeGs.map(fixUv)), hedgeM));

  // ── trees and bushes: the textured card trees (garden3d/cardTrees.ts), all in one draw ──
  const atlas = await loadCardAtlas(THREE, renderer).catch(() => null);
  if (atlas) {
    const bin = newCardBin();
    const lod = tier === "low" ? 2 : 1;
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // behind the houses (street), along the lane (both sides, behind the hedge), round the compound
    const treeAt = (s: number, off: number, hM: number, pine = false) => {
      const p = offsetAt(R, s, off);
      const from = bin.p.length / 9;
      addCardTree(THREE, bin, { h: 1.3, w: 0.8, pine, seed: Math.floor(rnd() * 1e6), lod: lod as 0 | 1 | 2 });
      placeCardsSince(bin, from, p.x, 0, p.z, hM / 1.3, rnd() * 6.28);
    };
    for (const [a, b] of streetSpans) for (let s = a + 3; s < b; s += 16) for (const side of [1, -1]) treeAt(s + rnd() * 6, side * (ROAD_HALF + 22 + rnd() * 6), 9 + rnd() * 4);
    for (const [a, b] of laneSpans) {
      for (let s = a + 4; s < b; s += tier === "low" ? 15 : 10) {
        for (const side of [1, -1]) if (rnd() < 0.72) treeAt(s + rnd() * 5, side * (ROAD_HALF + 4.5 + rnd() * 9), 7 + rnd() * 6, rnd() < 0.15);
        if (tier !== "low" && rnd() < 0.5) { const p = offsetAt(R, s, (rnd() < 0.5 ? 1 : -1) * (ROAD_HALF + 2.6)); addCardBush(THREE, bin, { x: p.x, z: p.z, s: 1.3 + rnd(), seed: Math.floor(rnd() * 1e6), lod: lod as 0 | 1 | 2 }); }
      }
    }
    // the roundabout island: a tree and bushes
    { const I = R.island; const from = bin.p.length / 9; addCardTree(THREE, bin, { h: 1.3, w: 0.8, pine: false, seed: 77, lod: lod as 0 | 1 | 2 }); placeCardsSince(bin, from, I.x, 0, I.z, 8 / 1.3, 0); for (let i = 0; i < 6; i++) addCardBush(THREE, bin, { x: I.x + Math.cos(i) * 5, z: I.z + Math.sin(i) * 5, s: 1.4, seed: 90 + i, lod: lod as 0 | 1 | 2 }); }
    if (opts.leg === "in") { const end = at(R, R.gateS); for (let i = 0; i < 9; i++) treeAt(R.gateS + 8 + i * 4, (i % 2 ? 1 : -1) * (COMPOUND_HALF + 4 + rnd() * 5), 9 + rnd() * 3); void end; }
    // cut into 70 m squares, one draw each, so only the squares in view are drawn (the whole route is
    // one long strip: one joined mesh would send every tree every frame)
    const tmat = cardMaterial(THREE, atlas.map, tier === "low" ? null : atlas.nrm);
    const cells = new Map<string, ReturnType<typeof newCardBin>>();
    for (let i = 0; i < bin.p.length; i += 9) {
      const tri = i / 9;
      const key = `${Math.floor(bin.p[i] / 70)},${Math.floor(bin.p[i + 2] / 70)}`;
      let c = cells.get(key); if (!c) { c = newCardBin(); cells.set(key, c); }
      c.p.push(...bin.p.slice(i, i + 9)); c.n.push(...bin.n.slice(i, i + 9)); c.c.push(...bin.c.slice(i, i + 9)); c.uv.push(...bin.uv.slice(tri * 6, tri * 6 + 6));
    }
    for (const c of Array.from(cells.values())) {
      const tm = new THREE.Mesh(cardGeometry(THREE, c), tmat);
      tm.castShadow = realShadow;
      scene.add(tm);
    }
  }

  // ── the compound (stand-in) or the fork ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  let barrierArm: any = null;
  const parkedFiles: { file: string; x: number; z: number; ry: number; paint?: string; from: [number, number, number] }[] = [];
  let doorSpot: { x: number; z: number; face: number; cam: [number, number]; look: [number, number]; car: [number, number] } | null = null;
  if (opts.leg === "in") {
    const r = buildCompound(THREE, tier === "low", roadM, R, propBox, propGs, roadGs.length >= 0 ? scene : scene, tex, merge, parkedFiles);
    barrierArm = r.arm; doorSpot = r.door;
  } else {
    buildFork(THREE, R, propBox, scene, tex);
  }
  // parked cars in your street (the light copies, as they are; one draw each)
  if (opts.leg === "in") {
    // on the neighbours' drives, nose to the house (the road stays clear for you and the traffic)
    const plan: [number, number, string][] = [[18.5, -1, "family"], [43.5, 1, "suv"], [68.5, -1, "classic"]];
    for (const [s, side, id] of plan.slice(0, tier === "low" ? 2 : 3)) {
      const p = offsetAt(R, s, side * (ROAD_HALF + 2.2 + 2.7));
      parkedFiles.push({ file: `/star/home3d/car-${id}-lod.glb`, x: p.x, z: p.z, ry: p.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2), from: DRIVE_CARS[id as DriveCarId].paint });
    }
  }
  scene.add(new THREE.Mesh(merge(propGs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })));

  // ── cars: yours (cut wheels), the traffic (cut light copies, repainted), the parked ones ──
  const lodMine = tier === "low";
  const myG: any = await loadGltfCached(loader, carFile(opts.car, lodMine));
  if (disposed) throw new Error("disposed");
  const mine = rigCar(THREE, myG.scene.clone(true));
  mine.root.traverse((o: any) => { if (o.isMesh) { o.castShadow = realShadow; } });
  scene.add(mine.root);
  S.opts.spec = { wheelR: mine.wheelR, wheelbase: mine.wheelbase };
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(blobCanvas()), transparent: true, depthWrite: false, opacity: 0.85 }));
  blob.rotation.x = -Math.PI / 2; blob.scale.set(mine.width * 1.25, DRIVE_CARS[opts.car].length * 1.15, 1); blob.renderOrder = 2;
  scene.add(blob);

  const traffic: { id: string; rig: ReturnType<typeof rigCar> }[] = [];
  for (const c of S.traffic) {
    const g: any = await loadGltfCached(loader, carFile(c.model as DriveCarId, true));
    const rig = rigCar(THREE, g.scene.clone(true));
    repaint(THREE, rig.root, DRIVE_CARS[c.model as DriveCarId].paint, c.paint);
    scene.add(rig.root);
    traffic.push({ id: c.id, rig });
  }
  for (const p of parkedFiles) {
    const g: any = await loadGltfCached(loader, p.file).catch(() => null);
    if (!g) continue;
    const inner = g.scene.clone(true);
    fitCar(THREE, inner, 4.3);
    if (p.paint) repaint(THREE, inner, p.from, p.paint);
    // the light copies face +x as made: turned along the road by the holder
    const root = new THREE.Group();
    root.add(inner);
    root.position.set(p.x, 0, p.z); root.rotation.y = p.ry - Math.PI / 2;
    scene.add(root);
  }

  // ── the cabin (in-car view): dash, wheel, the phone in its mount ──
  const { RoundedBoxGeometry }: any = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
  const cabin = buildCabin(THREE, mine, RoundedBoxGeometry, merge);
  mine.root.add(cabin.group);
  cabin.group.visible = false;

  // ── the two team-mates by the door (the arrival) ──
  const mates: { root: any; mixer: any; faceTo: number; turnTo: number }[] = [];
  if (opts.leg === "in" && doorSpot && !opts.noPeople) {
    try { await addMates(THREE, loader, scene, doorSpot, opts, tier, mates); } catch (e) { console.warn("drive: team-mates", e); }
  }

  // ── run ──
  let holding = false, tapQ: -1 | 1 | 0 = 0, side = 0;
  let lastUi = "";
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  let camInit = false;
  let bayT0 = -1;
  let fps = 0, frames = 0, fpsT = performance.now();
  const memSent = new Set<number>();
  let doneSent = false;

  const place = () => {
    const c = S.car;
    const p = offsetAt(R, c.s, c.off);
    mine.root.position.set(p.x, 0, p.z);
    mine.root.rotation.y = c.yaw;
    mine.tilt.rotation.set(c.pitch, 0, c.roll);
    for (const w of mine.wheels) { w.node.rotation.x = c.spin; w.node.rotation.y = w.front ? c.steer : 0; }
    blob.position.set(p.x, 0.02, p.z); blob.rotation.z = c.yaw;
    S.traffic.forEach((t) => {
      const T = traffic.find((x) => x.id === t.id); if (!T) return;
      const q = offsetAt(R, Math.max(0, Math.min(R.length, t.s)), t.dir === 1 ? LANE : -LANE);
      T.rig.root.position.set(q.x, 0, q.z);
      T.rig.root.rotation.y = q.h + (t.dir === 1 ? 0 : Math.PI);
      const spin = (t.s / mine.wheelR) * t.dir;
      for (const w of T.rig.wheels) w.node.rotation.x = spin;
      T.rig.root.visible = t.s > 0 && t.s < R.length;
    });
    for (let i = traffic.length - 1; i >= 0; i--) if (!S.traffic.some((t) => t.id === traffic[i].id)) traffic[i].rig.root.visible = false;
    if (barrierArm) barrierArm.rotation.z = barrierLift(S) * 1.45;
    const turn = matesTurn(S);
    // the team-mates only exist for the arrival (skinned bodies are never culled by distance)
    // (and only in the bay shot: the barrier shot looks away from them, and a skinned body is not culled reliably)
    const matesOn = (S.phase === "arrive" && arrivalShot(S) === "bay") || (S.phase === "done" && !S.skipped);
    for (const m of mates) {
      m.root.visible = matesOn;
      let d = m.turnTo - m.faceTo; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      m.root.rotation.y = m.faceTo + d * turn;
    }
  };

  const aimCam = (dt: number) => {
    const c = S.car;
    const fwd = [Math.sin(c.yaw), Math.cos(c.yaw)];
    const carP = mine.root.position;
    let pos: number[], look: number[], fov = 55, snap = false;
    const which = S.phase === "arrive" ? arrivalShot(S) : null;
    const cam = liveCam(S);
    cabin.group.visible = !which && cam === "cabin" && S.phase !== "intro";
    // the car's own shell stays: from inside it is see-through (back faces), and the bonnet shows ahead
    mine.body.visible = true;
    if (S.phase === "intro") {
      // from the pavement across the road: your car at the kerb, your gate and your house behind it; a slow push in
      const k = Math.min(1, S.t / INTRO_S);
      const g = offsetAt(R, -1 + k * 0.6, -(ROAD_HALF + 1.0) + k * 0.9);
      pos = [g.x, 2.1 - k * 0.25, g.z];
      const lk = offsetAt(R, 2.0, 3.3);
      look = [lk.x, 1.3, lk.z];
      fov = 68; snap = true;
    } else if (which === "barrier") {
      // THE SHOT: low and wide by the barrier post, the car coming at you, the arm going up
      // inside the gate, just off your line, looking back through the barrier at the car coming
      const g = offsetAt(R, R.gateS + 7.5, -(ROAD_HALF + 2.2));
      pos = [g.x, 0.62, g.z];
      look = [carP.x, 0.9, carP.z];
      fov = 62; snap = true;
    } else if (which === "bay" && doorSpot) {
      // behind the two team-mates by the door, the car swinging into its bay towards them
      // from the side of the bay: the training block's glass front behind, the two by its door, your car swinging in
      const d = doorSpot;
      // a slow push in while it rolls into the bay (0.35 m/s, up to 2.5 m)
      if (bayT0 < 0) bayT0 = S.ta;
      const push = Math.min(2.5, (S.ta - bayT0) * 0.35);
      const dx = d.look[0] - d.cam[0], dz = d.look[1] - d.cam[1], dl = Math.hypot(dx, dz) || 1;
      pos = [d.cam[0] + (dx / dl) * push, 1.3, d.cam[1] + (dz / dl) * push];
      look = [d.look[0], 1.6, d.look[1]];
      fov = 44; snap = true;
    } else if (cam === "cabin" && S.callState === "ringing" && S.t - S.callSince < 2.6) {
      // the call: over the driver's shoulder onto the phone in its mount, the road through the glass above it
      pos = local(c.yaw, carP, -0.3, 1.3, 0.02);
      look = local(c.yaw, carP, -0.16, 1.0, 0.6); fov = 62; snap = true;
    } else if (cam === "cabin") {
      // the driver's seat (on the right: a UK car), looking down the road over the dash
      pos = local(c.yaw, carP, -0.36, 1.28, 0.02);
      look = local(c.yaw, carP, -0.25, 1.05, 14); fov = 60; snap = true;
    } else if (cam === "bumper") {
      pos = local(c.yaw, carP, 0, 0.62, mine.length / 2 + 0.25);
      look = local(c.yaw, carP, 0, 0.7, 25); fov = 64; snap = true;
    } else {
      // the chase camera: behind and above, a little wider and further back at speed
      const back = 6.4 + c.v * 0.09, up = 2.25 + c.v * 0.03;
      pos = [carP.x - fwd[0] * back, up, carP.z - fwd[1] * back];
      look = [carP.x + fwd[0] * 5, 1.0, carP.z + fwd[1] * 5];
      fov = 54 + Math.min(10, c.v * 0.45);
    }
    // a plan view for checking the layout (window.__driveTop = true)
    if ((window as any).__driveTop) { const e = R.pts[R.pts.length - 1]; pos = [e.x + 0.01, 38, e.z]; look = [e.x, 0, e.z]; fov = 60; snap = true; }
    const k = !camInit || snap ? 1 : Math.min(1, dt * 6);
    camPos.lerp(new THREE.Vector3(...pos), k); camLook.lerp(new THREE.Vector3(...look), !camInit || snap ? 1 : Math.min(1, dt * 9));
    if (!camInit) { camPos.set(pos[0], pos[1], pos[2]); camLook.set(look[0], look[1], look[2]); camInit = true; }
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = snap ? fov : camera.fov + (fov - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    if (realShadow) { sun.position.set(carP.x - 40, 55, carP.z + 30); sun.target.position.copy(carP); }
    cabin.phone(S.callState === "ringing" ? (Math.floor(S.t * 2.5) % 2 ? 1 : 0.55) : S.callState === "answered" ? 0.8 : 0.08, S.call?.caller ?? "");
  };

  const ui = () => {
    const call = S.call && S.callState !== "waiting" ? {
      caller: S.call.caller, lines: S.call.lines, yes: S.call.yes.label, no: S.call.no.label, state: S.callState, answer: S.callAnswer,
      reply: S.callAnswer === "yes" ? S.call.yes.reply : S.callAnswer === "no" ? S.call.no.reply : undefined,
      effect: S.callAnswer === "yes" ? S.call.yes.effect : S.callAnswer === "no" ? S.call.no.effect : undefined, since: S.callSince,
    } : null;
    const caption = S.phase === "arrive" && S.fade > 0.6 ? arrivalLine(opts.car, opts.names.mate) : null;
    const u: DriveUi = {
      phase: S.phase, mph: Math.round(S.car.v * 2.237), cam: liveCam(S), call, fade: S.fade, caption,
      fork: S.phase === "fork", forkChoice: S.fork, blocked: S.car.horn > 0, lane: S.car.off >= 0 ? "left" : "right", t: S.t,
    };
    const key = JSON.stringify({ ...u, t: Math.round(u.t * 4), fade: Math.round(u.fade * 10) });
    if (key !== lastUi) { lastUi = key; cb.onUi(u); }
    S.memories.forEach((m, i) => { if (!memSent.has(i)) { memSent.add(i); cb.onMemory?.(m); } });
    if (S.phase === "done" && !doneSent) { doneSent = true; cb.onDone({ skipped: S.skipped, fork: S.fork, memories: S.memories }); }
  };

  const sim = (dt: number) => {
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(STEP, left);
      stepDrive(S, { hold: holding, tap: tapQ, side });
      tapQ = 0;
      left -= h;
      for (const m of mates) m.mixer.update(h);
    }
  };

  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize); ro.observe(container);

  const draw = (dt: number) => { place(); aimCam(dt); renderer.render(scene, camera); ui(); };
  place(); aimCam(1);
  let filming = false;
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    if (disposed || !isOwner() || filming) return;
    // a film page (?film): nothing moves until the filming tool seeks (frameStep.ts)
    if (opts.film) { if (frames++ % 30 === 0) draw(0); return; }
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    sim(dt);
    draw(dt);
    frames++;
    if (now - fpsT > 1000) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; }
  });

  // the film: seek forward in fixed steps, draw once
  let simT = 0;
  const unpublish = publishFrameStep({
    duration: 40,
    seek: (t: number) => {
      filming = true;
      // the cameras ease every step too, so a frame-stepped film moves as the real one does
      while (simT + STEP <= t + 1e-9) { sim(STEP); simT += STEP; place(); aimCam(STEP); }
      renderer.render(scene, camera); ui();
    },
  });
  (window as any).__drive = {
    S, stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    // what is in the scene, biggest first (the speed work)
    breakdown: () => { const out: [string, number, boolean][] = []; scene.traverse((o: any) => { if (o.isMesh) { const g = o.geometry; const n = (g.index ? g.index.count : g.getAttribute("position").count) / 3; out.push([`${o.parent?.name || ""}/${o.name || o.type}`, Math.round(n), o.visible]); } }); return out.sort((x, y) => y[1] - x[1]).slice(0, 25); },
  };

  return {
    hold: (on) => { holding = on; },
    tap: (sd) => { tapQ = sd; },
    side: (v) => { side = v; },
    answer: (a) => answerCall(S, a),
    fork: (c) => chooseFork(S, c),
    skip: () => skipDrive(S),
    cam: () => cycleCam(S),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, tier, fps }),
    dispose: () => {
      disposed = true;
      unpublish();
      ro.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      delete (window as any).__drive;
      release(scene);
    },
  };
}

// ───────────────────────── helpers ─────────────────────────

/** A point `x` right… in the car's own frame (x left, y up, z forward) to the world. */
function local(yaw: number, p: any, x: number, y: number, z: number): number[] {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return [p.x + z * s + x * c, y, p.z + z * c - x * s];
}

/** Stretches of the route whose piece kind passes `f` ([from s, to s]). */
function spans(R: Route, f: (k: string) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (const p of R.pts) {
    if (f(p.kind)) { if (start < 0) start = p.s; }
    else if (start >= 0) { out.push([start, p.s]); start = -1; }
  }
  if (start >= 0) out.push([start, R.length]);
  return out;
}

/** A strip along the road from s0 to s1, between offsets a and b (left +), at height y; v runs with the distance. */
function ribbon(T: any, R: Route, s0: number, s1: number, a: number, b: number, y: number, uOf?: (kind: string) => [number, number]) {
  const pos: number[] = [], uv: number[] = [], nrm: number[] = [];
  const step = 1.5;
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  let prev: number[] | null = null;
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * (i / n);
    const p = at(R, s);
    const [u0, u1] = uOf ? uOf(p.kind) : [0, 1];
    const L = offsetAt(R, s, b), Rr = offsetAt(R, s, a);
    const v = s / 8;
    const cur = [L.x, L.z, Rr.x, Rr.z, v, u0, u1];
    if (prev) {
      // two triangles (left edge u0 → right edge u1; b is the left (+) edge)
      const [lx0, lz0, rx0, rz0, v0, pu0, pu1] = prev; const [lx1, lz1, rx1, rz1, v1] = cur;
      pos.push(lx0, y, lz0, rx0, y, rz0, lx1, y, lz1, rx0, y, rz0, rx1, y, rz1, lx1, y, lz1);
      uv.push(pu0, v0, pu1, v0, pu0, v1, pu1, v0, pu1, v1, pu0, v1);
      for (let k = 0; k < 6; k++) nrm.push(0, 1, 0);
    }
    prev = cur;
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new T.Float32BufferAttribute(nrm, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  // winding: make the top face up
  const idx = g.getAttribute("position");
  for (let i = 0; i < idx.count; i += 3) {
    const ax = idx.getX(i), az = idx.getZ(i), bx = idx.getX(i + 1), bz = idx.getZ(i + 1), cx = idx.getX(i + 2), cz = idx.getZ(i + 2);
    const cr = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    if (cr > 0) { // clockwise from above = facing down in three's right-handed y-up: swap b and c
      const t = [idx.getX(i + 1), idx.getY(i + 1), idx.getZ(i + 1)];
      idx.setXYZ(i + 1, cx, idx.getY(i + 2), cz); idx.setXYZ(i + 2, t[0], t[1], t[2]);
      const U = g.getAttribute("uv"); const tu = [U.getX(i + 1), U.getY(i + 1)]; U.setXY(i + 1, U.getX(i + 2), U.getY(i + 2)); U.setXY(i + 2, tu[0], tu[1]);
    }
  }
  return g;
}

function setUv(g: any, u: number, v: number, along = false) {
  const U = g.getAttribute("uv");
  for (let i = 0; i < U.count; i++) U.setXY(i, along ? (u === 0.5 ? U.getX(i) * 0 + 0.04 : u) : u, along ? U.getY(i) * 5 : v);
}
const stripUv = (g: any) => { const h = g.index ? g.toNonIndexed() : g; h.deleteAttribute?.("uv"); if (!h.getAttribute("color")) { /* filled by caller */ } return h; };
const fixUv = (g: any) => (g.index ? g.toNonIndexed() : g);

function paint(T: any, g: any, col: string) {
  const c = new T.Color(col);
  const n = g.getAttribute("position").count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new T.BufferAttribute(a, 3));
}

/** Asphalt with the lines: a white edge line each side, a dashed centre line; a clean column (u < 0.08) for junctions. */
function asphaltCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 256; c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#56585c"; g.fillRect(0, 0, 256, 512);
  let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 9000; i++) { const l = 28 + r() * 22; g.fillStyle = `hsla(220,4%,${l}%,0.55)`; g.fillRect(r() * 256, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5); }
  // tyre wear down each lane
  for (const x of [64, 192]) { const gr = g.createLinearGradient(x - 30, 0, x + 30, 0); gr.addColorStop(0, "rgba(30,30,32,0)"); gr.addColorStop(0.5, "rgba(30,30,32,0.22)"); gr.addColorStop(1, "rgba(30,30,32,0)"); g.fillStyle = gr; g.fillRect(x - 30, 0, 60, 512); }
  g.fillStyle = "#e9e7df";
  g.fillRect(28, 0, 5, 512); g.fillRect(223, 0, 5, 512);   // edge lines
  for (let y = 0; y < 512; y += 128) g.fillRect(125, y, 6, 64); // centre dashes
  // the clean column at the far left (u 0..0.08): plain asphalt for junctions and the car park
  g.fillStyle = "#56585c"; g.fillRect(0, 0, 20, 512);
  return c;
}

/** One house's walls: the front (brick, two windows up, a window and a door down) on the left half, plain brick on the right. */
function houseCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d")!;
  const b = brickCanvas("#9a5138");
  for (let x = 0; x < 1024; x += b.width) for (let y = 0; y < 512; y += b.height) g.drawImage(b, x, y);
  const win = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = "#efece4"; g.fillRect(x - 6, y - 6, w + 12, h + 12);
    const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, "#2b3947"); gr.addColorStop(0.6, "#4f6577"); gr.addColorStop(1, "#22303c");
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = "#efece4"; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h * 0.38, w, 5);
    g.fillStyle = "#d8d2c3"; g.fillRect(x - 10, y + h + 6, w + 20, 8);
  };
  win(70, 70, 140, 120); win(300, 70, 140, 120); win(70, 300, 160, 130);
  // the door, with a little porch roof
  g.fillStyle = "#1f3a5c"; g.fillRect(330, 290, 90, 200); g.fillStyle = "#c9a54a"; g.fillRect(400, 390, 8, 8);
  g.fillStyle = "#efece4"; g.fillRect(320, 280, 110, 10);
  return c;
}

/** A semi-detached house: walls (front picture + brick), a pitched slate roof. Variant v moves its colours a little. */
function house(T: any, walls: any[], roofs: any[], x: number, z: number, ry: number, v: number) {
  const W = 8.5, D = 7.5, H = 5.6;
  const g = new T.BoxGeometry(W, H, D).toNonIndexed();
  // the front (+z face of the box, which faces the road once turned) shows the left half of the picture; the rest plain brick
  const U = g.getAttribute("uv"); const P = g.getAttribute("position"); const N = g.getAttribute("normal");
  for (let i = 0; i < U.count; i++) {
    const front = N.getZ(i) > 0.5;
    U.setXY(i, front ? U.getX(i) * 0.5 : 0.5 + U.getX(i) * 0.5, U.getY(i));
  }
  void P; void v;
  g.translate(0, H / 2, 0); g.rotateY(ry); g.translate(x, 0, z);
  walls.push(g);
  // the roof: a triangular prism along the house's width
  const r = new T.BufferGeometry();
  const hw = W / 2 + 0.3, hd = D / 2 + 0.4, top = H + 2.6;
  const p = [
    -hw, H, hd, hw, H, hd, hw, top, 0, -hw, H, hd, hw, top, 0, -hw, top, 0, // front slope
    hw, H, -hd, -hw, H, -hd, -hw, top, 0, hw, H, -hd, -hw, top, 0, hw, top, 0, // back slope
    -hw, H, -hd, -hw, H, hd, -hw, top, 0, hw, H, hd, hw, H, -hd, hw, top, 0, // gable ends
  ];
  r.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  const uv: number[] = []; for (let i = 0; i < p.length / 3; i++) uv.push((p[i * 3] + hw) / (2 * hw), (p[i * 3 + 1] - H) / 2.6);
  r.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  r.computeVertexNormals();
  r.rotateY(ry); r.translate(x, 0, z);
  roofs.push(r);
}

function hedgeBox(T: any, len: number, h: number, w: number, x: number, z: number, ry: number) {
  const g = new T.BoxGeometry(w, h, len).toNonIndexed();
  const U = g.getAttribute("uv"); const N = g.getAttribute("normal");
  for (let i = 0; i < U.count; i++) U.setXY(i, U.getX(i) * (Math.abs(N.getX(i)) > 0.5 ? len / 2 : w / 2), U.getY(i) * h / 2);
  g.translate(0, h / 2, 0); g.rotateY(ry); g.translate(x, 0, z);
  return g;
}

/** A hedge following the road (sides and top), its picture repeated every 2 m. */
function hedgeRibbon(T: any, R: Route, s0: number, s1: number, off: number, h: number, w: number) {
  const pos: number[] = [], uv: number[] = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / 3));
  const pt = (s: number, o: number) => offsetAt(R, s, o);
  for (let i = 0; i < n; i++) {
    const sa = s0 + (s1 - s0) * (i / n), sb = s0 + (s1 - s0) * ((i + 1) / n);
    const ua = sa / 2, ub = sb / 2;
    const quad = (a0: any, b0: any, y0: number, y1: number, a1: any = a0, b1: any = b0, v0 = y0 / 2, v1 = y1 / 2) => {
      pos.push(a0.x, y0, a0.z, b0.x, y0, b0.z, b1.x, y1, b1.z, a0.x, y0, a0.z, b1.x, y1, b1.z, a1.x, y1, a1.z);
      uv.push(ua, v0, ub, v0, ub, v1, ua, v0, ub, v1, ua, v1);
    };
    const ia = pt(sa, off - w / 2 * Math.sign(off)), ib = pt(sb, off - w / 2 * Math.sign(off));
    const oa = pt(sa, off + w / 2 * Math.sign(off)), ob = pt(sb, off + w / 2 * Math.sign(off));
    quad(ia, ib, 0, h);                 // the face to the road
    quad(oa, ob, 0, h);                 // the far face
    quad(ia, ib, h, h, oa, ob, 0, w / 2); // the top
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Your car's parts: the body under a tilt group (roll, pitch), the wheels on the root (they stay on the road). */
function rigCar(T: any, root: any) {
  const out = new T.Group();
  const tilt = new T.Group();
  out.add(tilt);
  const wheels: { node: any; front: boolean }[] = [];
  const kids = [...root.children];
  let body: any = null;
  for (const k of kids) {
    if (/^wheel_/.test(k.name)) { k.rotation.order = "YXZ"; out.add(k); wheels.push({ node: k, front: /^wheel_F/.test(k.name) }); }
    else { tilt.add(k); if (!body) body = k; }
  }
  const box = new T.Box3().setFromObject(tilt);
  const fz = wheels.filter((w) => w.front).map((w) => w.node.position.z), rz = wheels.filter((w) => !w.front).map((w) => w.node.position.z);
  const wheelbase = fz.length && rz.length ? Math.abs(fz.reduce((a, b) => a + b, 0) / fz.length - rz.reduce((a, b) => a + b, 0) / rz.length) : 2.6;
  const wheelR = wheels.length ? wheels.reduce((a, w) => a + w.node.position.y, 0) / wheels.length : 0.4;
  return { root: out, tilt, body: tilt, wheels, wheelbase, wheelR, width: box.max.x - box.min.x, length: box.max.z - box.min.z };
}

/** The home's light copies come facing +x at their own size: fit to a length, on the ground, centred. */
function fitCar(T: any, root: any, length: number) {
  root.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(root); const s = b.getSize(new T.Vector3());
  root.scale.multiplyScalar(length / Math.max(s.x, s.z));
  root.updateMatrixWorld(true);
  const b2 = new T.Box3().setFromObject(root); const c = b2.getCenter(new T.Vector3());
  // `root` is not yet in a parent: its own position moves it in its holder's space
  root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b2.min.y;
}

/** Repaint a car: where the picture is the car's own paint colour, use `to` instead (keeping light and shade). */
function repaint(T: any, root: any, from: [number, number, number], to: string) {
  const f = new T.Vector3(toLinear(from[0]), toLinear(from[1]), toLinear(from[2]));
  const tc = new T.Color(to);
  const fl = Math.max(1e-3, 0.2126 * f.x + 0.7152 * f.y + 0.0722 * f.z);
  root.traverse((o: any) => {
    if (!o.isMesh || !o.material?.map || o.material.name === "plate") return; // the plates keep their colours
    const m = o.material.clone();
    m.onBeforeCompile = (sh: any) => {
      sh.uniforms.uFrom = { value: f }; sh.uniforms.uTo = { value: new T.Vector3(tc.r, tc.g, tc.b) }; sh.uniforms.uFromL = { value: fl };
      sh.fragmentShader = "uniform vec3 uFrom; uniform vec3 uTo; uniform float uFromL;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
  {
    vec3 cc = diffuseColor.rgb;
    float l = dot(cc, vec3(0.2126, 0.7152, 0.0722));
    vec3 hueA = cc / max(l, 1e-3), hueB = uFrom / uFromL;
    float near = 1.0 - smoothstep(0.18, 0.55, distance(hueA, hueB));
    near *= smoothstep(0.004, 0.02, l);
    diffuseColor.rgb = mix(cc, uTo * (l / uFromL), near);
  }`);
    };
    m.customProgramCacheKey = () => `drive-repaint-${to}`;
    o.material = m;
  });
}

/** The stand-in compound: a fence line, the gate with its barrier and hut, the car park, the training block. */
function buildCompound(T: any, low: boolean, roadM: any, R: Route, propBox: (...a: any[]) => void, propGs: any[], scene: any, tex: (cv: HTMLCanvasElement, rep?: [number, number]) => any, merge: (g: any[]) => any, parked: any[]) {
  void propGs; void merge;
  const g = at(R, R.gateS);
  const h = g.h;
  const fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h);
  const P = (along: number, left: number) => [g.x + fx * along + lx * left, g.z + fz * along + lz * left];
  // the fence: dark green railings either side of the gate, out to the compound's corners, then down its sides
  for (const side of [1, -1]) {
    for (let k = 0; k < 9; k++) {
      const [x, z] = P(0, side * (ROAD_HALF + 2 + k * 2.6 + 1.3));
      propBox(2.6, 0.08, 0.06, x, 1.9, z, h + Math.PI / 2, "#25362c");
      propBox(2.6, 0.08, 0.06, x, 0.3, z, h + Math.PI / 2, "#25362c");
      for (let j = 0; j < 6; j++) { const [bx, bz] = P(0, side * (ROAD_HALF + 2 + k * 2.6 + j * 0.44)); propBox(0.05, 2.1, 0.05, bx, 1.05, bz, h, "#25362c"); }
    }
  }
  // the barrier: a post on the right, the red-and-white arm across your lane (it lifts about the post)
  const [px, pz] = P(0, -(ROAD_HALF + 0.6));
  propBox(0.45, 1.05, 0.45, px, 0.52, pz, h, "#d9d6cf");
  propBox(0.5, 0.12, 0.5, px, 1.1, pz, h, "#c0392b");
  const armT = tex(stripesCanvas());
  const arm = new T.Group();
  arm.position.set(px, 0.95, pz);
  arm.rotation.order = "YZX";
  arm.rotation.y = h; // its +x runs from the post across the road (the left)
  const bar = new T.Mesh(new T.BoxGeometry(ROAD_HALF * 2 + 0.6, 0.11, 0.09), new T.MeshStandardMaterial({ map: armT, roughness: 0.5 }));
  bar.position.x = -(ROAD_HALF + 0.3) * -1; // from the post across the road
  arm.add(bar);
  scene.add(arm);
  // the gatehouse: a small white hut with a dark window, on the right
  const [hx, hz] = P(-2.5, -(ROAD_HALF + 3.2));
  propBox(2.6, 2.5, 2.4, hx, 1.25, hz, h, "#e8e6e0");
  propBox(2.8, 0.18, 2.6, hx, 2.6, hz, h, "#3a3f46");
  const [wx, wz] = P(-2.5 + 1.21, -(ROAD_HALF + 3.2));
  propBox(1.6, 0.9, 0.05, wx, 1.55, wz, h, "#22303c");
  // the car park: the bays end at the route's end; the training block beyond them
  // the bay is where your car comes to rest (the road line's end, your lane's offset to the left)
  const endL = offsetAt(R, R.length, LANE);
  const end = { x: endL.x, z: endL.z, h: endL.h };
  const ef = [Math.sin(end.h), Math.cos(end.h)], el = [Math.cos(end.h), -Math.sin(end.h)];
  const E = (fwd: number, left: number) => [end.x + ef[0] * fwd + el[0] * left, end.z + ef[1] * fwd + el[1] * left];
  // bay lines: white strips either side of each bay (yours in the middle), five bays
  for (let b = -2; b <= 3; b++) {
    const [lx2, lz2] = E(0, b * 2.8 - 1.4);
    propBox(0.1, 0.012, 5.0, lx2, 0.01, lz2, end.h, "#f1efe8");
  }
  // team-mates' cars in the bays either side of yours (the light copies, repainted)
  // all on the left of your bay, behind the two team-mates: the bay shot looks across from the right, nothing in its way
  // the bay next to yours stays empty: the two team-mates stand in front of it, nothing between them and the bay shot
  const mates: [number, string, string][] = [[5.6, "sports", "#1d2733"], [8.4, "suv", "#e9e6df"], [-5.6, "family", "#6b1f24"]];
  // Low: one team-mate's car (the two people are most of the arrival's triangles)
  for (const [off, id, col] of mates.slice(0, low ? 1 : 2)) {
    const [x, z] = E(0, off);
    parked.push({ file: `/star/home3d/car-${id}-lod.glb`, x, z, ry: end.h, paint: col, from: DRIVE_CARS[id as DriveCarId].paint });
  }
  // the training block: long, low, grey cladding with a glass front and the club's band; the door in front of your bay
  const [bx, bz] = E(12, 0);
  const blockT = tex(blockCanvas());
  const block = new T.Mesh(new T.BoxGeometry(30, 6.5, 7).toNonIndexed(), new T.MeshStandardMaterial({ map: blockT, roughness: 0.6 }));
  { const U = block.geometry.getAttribute("uv"), N = block.geometry.getAttribute("normal"); for (let i = 0; i < U.count; i++) if (N.getZ(i) < 0.5) U.setXY(i, 0.98, 0.02); }
  block.position.set(bx, 3.25, bz);
  block.rotation.y = end.h + Math.PI; // its picture faces the car park
  scene.add(block);
  // a flat roof edge
  propBox(30.6, 0.35, 7.6, bx, 6.6, bz, end.h, "#2c3036");
  // the two team-mates on the walkway at the front corner of your bay, on the way to the door
  const [dx, dz] = E(3.0, 2.6);
  // the bay shot: from the block's wall, over the team-mates' shoulders, at your car coming in
  // the bay shot: low, from behind the bay on the aisle side; your car sweeps in past the lens and rolls
  // away into the bay, towards the two by the door (they turn: their faces to camera), the block behind
  const [cx, cz] = E(-11.5, -1.5);
  const [kx, kz] = E(2, 1.0);
  // the car park's tarmac: from the gate road to the block, either side of the bays
  {
    const a = E(-16, 0), w = 30, d = 25;
    const slab = new T.PlaneGeometry(w, d); slab.rotateX(-Math.PI / 2);
    const U = slab.getAttribute("uv"); for (let i = 0; i < U.count; i++) U.setXY(i, 0.04, U.getY(i) * 4);
    slab.rotateY(end.h); slab.translate((a[0] + E(8.5, 0)[0]) / 2, 0.002, (a[1] + E(8.5, 0)[1]) / 2);
    const m = new T.Mesh(slab, roadM); m.receiveShadow = false; scene.add(m);
  }
  return { arm, door: { x: dx, z: dz, face: end.h + Math.PI, cam: [cx, cz] as [number, number], look: [kx, kz] as [number, number], car: [end.x, end.z] as [number, number] } };
}

/** The fork at the end of the drive back: a signpost (Home / Casino / Shop) and the three roads. */
function buildFork(T: any, R: Route, propBox: (...a: any[]) => void, scene: any, tex: (cv: HTMLCanvasElement, rep?: [number, number]) => any) {
  const end = R.pts[R.pts.length - 1];
  const f = [Math.sin(end.h), Math.cos(end.h)], l = [Math.cos(end.h), -Math.sin(end.h)];
  const E = (fwd: number, left: number) => [end.x + f[0] * fwd + l[0] * left, end.z + f[1] * fwd + l[1] * left];
  const [sx, sz] = E(6, 4.6);
  propBox(0.14, 3.4, 0.14, sx, 1.7, sz, end.h, "#3b3f45");
  const sign = new T.Mesh(new T.PlaneGeometry(2.4, 1.5), new T.MeshStandardMaterial({ map: tex(forkSignCanvas()), roughness: 0.5, side: T.DoubleSide }));
  sign.position.set(sx, 2.6, sz); sign.rotation.y = end.h + Math.PI;
  scene.add(sign);
}

function stripesCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 256; c.height = 16;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#f4f2ec" : "#c0392b"; g.fillRect(i * 32, 0, 32, 16); }
  return c;
}

function blockCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a9099"; g.fillRect(0, 0, 1024, 256);
  for (let x = 0; x < 1024; x += 32) { g.fillStyle = x % 64 ? "#858b94" : "#8f959e"; g.fillRect(x, 0, 32, 256); }
  // the glass front, the door in the middle
  const gr = g.createLinearGradient(0, 70, 0, 230); gr.addColorStop(0, "#9fb6c8"); gr.addColorStop(1, "#30414f");
  g.fillStyle = gr; g.fillRect(40, 80, 944, 150);
  g.fillStyle = "#3a3f46"; for (let x = 40; x <= 984; x += 59) g.fillRect(x - 2, 80, 4, 150);
  g.fillStyle = "#1c242c"; g.fillRect(482, 110, 60, 120);
  // the band and the sign
  g.fillStyle = "#b3122e"; g.fillRect(0, 30, 1024, 30);
  g.fillStyle = "#ffffff"; g.font = "bold 22px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("FIRST TEAM TRAINING CENTRE", 512, 53);
  return c;
}

function forkSignCanvas(): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 512; c.height = 320;
  const g = c.getContext("2d")!;
  g.fillStyle = "#14532d"; g.fillRect(0, 0, 512, 320);
  g.strokeStyle = "#ffffff"; g.lineWidth = 8; g.strokeRect(8, 8, 496, 304);
  g.fillStyle = "#ffffff"; g.font = "bold 52px system-ui, sans-serif"; g.textAlign = "left";
  g.fillText("← Home", 40, 95); g.fillText("↑ Casino", 40, 185); g.fillText("Shop →", 40, 275);
  return c;
}

/**
 * The in-car view: a moulded dashboard (soft-touch dark plastic, a binnacle over the dials in front of the
 * driver, vents, a centre screen), a three-spoke wheel, and the phone in a vent mount. The phone is the
 * game's phone (components/star/HousePhone: thin black frame, rounded glass), drawn here in 3D: its screen
 * shows the incoming call (`phone(glow, caller)`). Right-hand drive: the driver sits at −x.
 */
function buildCabin(T: any, mine: ReturnType<typeof rigCar>, RB: any, merge?: (g: any[]) => any) {
  const g = new T.Group();
  const soft = new T.MeshStandardMaterial({ color: "#26282d", roughness: 0.82 });
  const top = new T.MeshStandardMaterial({ color: "#1b1c20", roughness: 0.9 });
  const trim = new T.MeshStandardMaterial({ color: "#5d6168", roughness: 0.35, metalness: 0.6 });
  const leather = new T.MeshStandardMaterial({ color: "#151619", roughness: 0.6 });
  // the dash: a side profile (forward z, up y) extruded across the car
  const prof = new T.Shape();
  prof.moveTo(1.12, 0.98);                                    // under the windscreen
  prof.bezierCurveTo(0.95, 1.07, 0.78, 1.06, 0.66, 1.0);      // the top, rolling towards you
  prof.bezierCurveTo(0.6, 0.97, 0.58, 0.9, 0.6, 0.82);        // its face
  prof.lineTo(0.66, 0.6); prof.lineTo(1.12, 0.6); prof.closePath();
  const dashG = new T.ExtrudeGeometry(prof, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 14 });
  dashG.rotateY(-Math.PI / 2); // the shape's x (forward) → +z, extruded along −x
  dashG.translate(0.81, 0, 0);
  g.add(new T.Mesh(dashG, soft));
  // the binnacle hood over the dials (driver's side)
  const hood = new T.Mesh(new RB(0.4, 0.07, 0.2, 3, 0.03), top);
  hood.position.set(-0.36, 1.07, 0.74); hood.rotation.x = 0.08; g.add(hood);
  // the dials: a glowing cluster behind the wheel
  const dcv = document.createElement("canvas"); dcv.width = 256; dcv.height = 96;
  {
    const x = dcv.getContext("2d")!; x.fillStyle = "#07080a"; x.fillRect(0, 0, 256, 96);
    for (const cx of [64, 192]) { x.strokeStyle = "#3ec5ff"; x.lineWidth = 4; x.beginPath(); x.arc(cx, 56, 34, Math.PI * 0.8, Math.PI * 2.2); x.stroke(); x.strokeStyle = "#ff5a3c"; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, 56); x.lineTo(cx + 24, 36); x.stroke(); }
    x.fillStyle = "#e8f6ff"; x.font = "bold 18px system-ui"; x.textAlign = "center"; x.fillText("D", 128, 62);
  }
  const dtex = new T.CanvasTexture(dcv); dtex.colorSpace = T.SRGBColorSpace;
  const dials = new T.Mesh(new T.PlaneGeometry(0.3, 0.11), new T.MeshBasicMaterial({ map: dtex, toneMapped: false }));
  dials.position.set(-0.36, 0.97, 0.69); dials.rotation.y = Math.PI; dials.rotation.x = -0.25; g.add(dials);
  // the centre screen (the route), two vents either side of it
  const scv = document.createElement("canvas"); scv.width = 256; scv.height = 160;
  {
    const x = scv.getContext("2d")!; const gr = x.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, "#0e2233"); gr.addColorStop(1, "#06121c"); x.fillStyle = gr; x.fillRect(0, 0, 256, 160);
    x.strokeStyle = "#2b6f9e"; x.lineWidth = 6; x.beginPath(); x.moveTo(30, 120); x.bezierCurveTo(90, 60, 150, 140, 226, 40); x.stroke();
    x.fillStyle = "#cfe9ff"; x.font = "bold 20px system-ui"; x.fillText("Training ground · 6 min", 14, 30);
  }
  const stex = new T.CanvasTexture(scv); stex.colorSpace = T.SRGBColorSpace;
  const scr = new T.Mesh(new T.PlaneGeometry(0.24, 0.15), new T.MeshBasicMaterial({ map: stex, toneMapped: false }));
  scr.position.set(0.12, 0.96, 0.64); scr.rotation.y = Math.PI; scr.rotation.x = -0.3; g.add(scr);
  // a brushed trim strip across the dash face, a darker lower face
  const strip = new T.Mesh(new T.BoxGeometry(1.5, 0.012, 0.01), trim); strip.position.set(0.05, 0.915, 0.6); g.add(strip);
  const lower = new T.Mesh(new T.BoxGeometry(1.55, 0.2, 0.02), top); lower.position.set(0, 0.76, 0.66); g.add(lower);
  for (const vx of [-0.05, 0.3]) {
    const vent = new T.Mesh(new T.BoxGeometry(0.13, 0.055, 0.02), leather); vent.position.set(vx, 0.875, 0.615); g.add(vent);
    for (let k = 0; k < 3; k++) { const slat = new T.Mesh(new T.BoxGeometry(0.12, 0.004, 0.012), trim); slat.position.set(vx, 0.86 + k * 0.015, 0.603); g.add(slat); }
  }
  // the windscreen frame: A-pillars, the roof's front edge, the mirror (the car's shell is see-through from inside)
  for (const x of [-0.82, 0.82]) { const p = new T.Mesh(new T.BoxGeometry(0.07, 0.8, 0.09), top); p.position.set(x, 1.38, 0.92); p.rotation.x = -0.6; p.rotation.z = x < 0 ? 0.08 : -0.08; g.add(p); }
  const roof = new T.Mesh(new T.BoxGeometry(1.75, 0.07, 0.55), top); roof.position.set(0, 1.74, 0.5); g.add(roof);
  const rmirror = new T.Mesh(new T.BoxGeometry(0.22, 0.06, 0.02), top); rmirror.position.set(0, 1.62, 0.62); g.add(rmirror);
  // the wheel: a thick leather rim, three spokes, the hub
  const wheel = new T.Group();
  wheel.add(new T.Mesh(new T.TorusGeometry(0.175, 0.024, 12, 40), leather));
  for (const a of [-Math.PI / 2, 0.15, Math.PI - 0.15]) { const sp = new T.Mesh(new T.BoxGeometry(0.15, 0.03, 0.02), soft); sp.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0); sp.rotation.z = a; wheel.add(sp); }
  const hub = new T.Mesh(new T.CylinderGeometry(0.06, 0.065, 0.05, 24), soft); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const badge = new T.Mesh(new T.CircleGeometry(0.02, 20), trim); badge.position.z = -0.026; badge.rotation.y = Math.PI; wheel.add(badge);
  wheel.position.set(-0.36, 0.9, 0.5); wheel.rotation.x = -0.42;
  const column = new T.Mesh(new T.CylinderGeometry(0.035, 0.04, 0.25, 12), soft); column.rotation.x = Math.PI / 2 - 0.42; column.position.set(-0.36, 0.86, 0.6); g.add(column);
  g.add(wheel);
  // the mount on the centre vent: a short arm with a ball joint, a cradle with side grips
  const mx = -0.08, my = 1.06, mz = 0.58; // on the vent just left of the wheel, where a driver can reach it
  const arm = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.08, 10), trim); arm.position.set(mx, 0.93, mz - 0.01); g.add(arm);
  const ball = new T.Mesh(new T.SphereGeometry(0.015, 14, 10), trim); ball.position.set(mx, 0.97, mz - 0.015); g.add(ball);
  const phone = new T.Group();
  const cradle = new T.Mesh(new RB(0.09, 0.05, 0.012, 3, 0.004), leather); cradle.position.set(0, -0.06, 0.008); phone.add(cradle);
  for (const sx of [-1, 1]) { const grip = new T.Mesh(new T.BoxGeometry(0.008, 0.05, 0.016), leather); grip.position.set(sx * 0.041, -0.01, 0.004); phone.add(grip); }
  // the phone itself: thin dark frame, rounded corners, edge-to-edge glass
  phone.add(new T.Mesh(new RB(0.074, 0.156, 0.008, 4, 0.009), new T.MeshStandardMaterial({ color: "#1c1d21", roughness: 0.35, metalness: 0.5 })));
  const cv = document.createElement("canvas"); cv.width = 236; cv.height = 500;
  const ct = new T.CanvasTexture(cv); ct.colorSpace = T.SRGBColorSpace;
  const glass = new T.Mesh(new T.PlaneGeometry(0.068, 0.15), new T.MeshBasicMaterial({ map: ct, toneMapped: false, transparent: true }));
  glass.position.z = -0.0042; glass.rotation.y = Math.PI; phone.add(glass);
  phone.position.set(mx, my, mz - 0.02); phone.rotation.x = 0.18; phone.rotation.y = 0.35; // the glass faces the driver (−z), turned towards his seat
  g.add(phone);
  let last = "";
  const rr = (x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, R: number) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); };
  const draw = (glow: number, caller: string) => {
    const key = `${glow.toFixed(2)}|${caller}`;
    if (key === last) return; last = key;
    const x = cv.getContext("2d")!;
    x.clearRect(0, 0, 236, 500);
    rr(x, 0, 0, 236, 500, 30); x.save(); x.clip();
    if (glow < 0.1) { x.fillStyle = "#050607"; x.fillRect(0, 0, 236, 500); }
    else {
      const gr = x.createLinearGradient(0, 0, 0, 500); gr.addColorStop(0, "#1d3b2c"); gr.addColorStop(0.55, "#0f1d17"); gr.addColorStop(1, "#090d0b"); x.fillStyle = gr; x.fillRect(0, 0, 236, 500);
      x.textAlign = "center";
      x.fillStyle = "rgba(255,255,255,.75)"; x.font = "600 15px system-ui"; x.fillText("09:12", 118, 30);
      x.fillStyle = "#e5e7eb"; x.font = "500 15px system-ui"; x.fillText("mobile", 118, 82);
      x.fillStyle = "#ffffff"; x.font = "bold 30px system-ui"; x.fillText(caller.slice(0, 14), 118, 118);
      // the avatar, pulsing with the ring
      x.fillStyle = `rgba(34,197,94,${0.25 + 0.35 * glow})`; x.beginPath(); x.arc(118, 205, 56 + 8 * glow, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#16a34a"; x.beginPath(); x.arc(118, 205, 48, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.font = "bold 44px system-ui"; x.fillText((caller[0] ?? "?").toUpperCase(), 118, 221);
      // decline / accept
      x.fillStyle = "#ef4444"; x.beginPath(); x.arc(60, 420, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#22c55e"; x.beginPath(); x.arc(176, 420, 30, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#fff"; x.font = "bold 13px system-ui"; x.fillText("Decline", 60, 470); x.fillText("Accept", 176, 470);
      x.strokeStyle = "#fff"; x.lineWidth = 5; x.lineCap = "round";
      x.beginPath(); x.moveTo(48, 424); x.lineTo(72, 424); x.stroke();
      x.beginPath(); x.arc(176, 420, 12, Math.PI * 0.8, Math.PI * 1.9); x.stroke();
    }
    x.restore();
    ct.needsUpdate = true;
  };
  draw(0.08, "");
  void mine;
  // join the still parts by material (one draw each): the cabin is ~30 small pieces
  if (merge) {
    g.updateMatrixWorld(true);
    const byMat = new Map<any, any[]>();
    const drop: any[] = [];
    g.traverse((o: any) => {
      if (!o.isMesh || o.material.map) return;
      let p = o.parent; while (p && p !== g) { if (p === phone) return; p = p.parent; }
      const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (k !== "position" && k !== "normal") geo.deleteAttribute(k);
      (byMat.get(o.material) ?? byMat.set(o.material, []).get(o.material)!).push(geo);
      drop.push(o);
    });
    for (const o of drop) o.parent.remove(o);
    for (const [m, geos] of Array.from(byMat.entries())) g.add(new T.Mesh(merge(geos), m));
  }
  return { group: g, phone: draw };
}

/** The two team-mates by the door, chatting, who turn to look when you pull in. */
async function addMates(T: any, loader: any, scene: any, door: { x: number; z: number; face: number; car: [number, number] }, opts: DriveSceneOptions, tier: Quality3d, out: { root: any; mixer: any; faceTo: number; turnTo: number }[]) {
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkeletonUtils.default ?? SkeletonUtils;
  const { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, toonHeadsFor } = await import("../people3d");
  const { people3dLook } = await import("../look3d");
  const { addClips, loadAnims3d } = await import("../three3d/footballAnims");
  const PR = await import("../people/presets");
  const looks = PR.castScene([0, 1].map((i) => ({ id: `drive-mate-${i}`, role: "player" as const, club: opts.names.club || "Arsenal" })));
  const heads = Array.from(new Set([...toonHeadsFor([]), ...looks.map((l: any) => l.head)]));
  const [charG, animG, footG] = await Promise.all([loadPeople3d(loader, "player", people3dLook(), heads), loadPeople3d(loader, "anims", people3dLook()), loadAnims3d(loader, "football")]);
  const FI = await import("../style3d/toon/faceIdApply");
  const FACE = await import("../style3d/toon/face");
  const HAIR = await import("../style3d/toon/hair");
  // two at the door, a step apart, side-on to each other
  const fx = Math.sin(door.face), fz = Math.cos(door.face), lx = Math.cos(door.face), lz = -Math.sin(door.face);
  const spots = [[-0.5, 0.35], [0.5, -0.35]];
  // Low: one team-mate (each body is 14.6k triangles; the arrival keeps to the phone budget)
  for (let i = 0; i < (tier === "low" ? 1 : 2); i++) {
    const L: any = looks[i];
    const p: any = makePerson3d(T, SK, charG, animG, { outline: 0, castShadow: false, who: L.id, toonHead: L.head, toonBody: L.build } as any);
    dressPerson3d(T, p, { ...L.dress, kit: { ...(L.kit ?? {}), shirt: shade(opts.kit.shirt), trim: opts.kit.trim, shorts: "#1d1f24", socks: "#1d1f24" }, number: null } as any);
    try { FI.applyToonFaceId(T, p, L.faceId, { detail: FI.FACE_DETAIL[tier] }); const rig = FACE.addToonFace(T, p); rig?.set({ face: FACE.toonFaceFor({}), blink: 0 }); } catch { /* no face */ }
    if (L.hairMesh) { try { await HAIR.wearToonHair(T, loader, p, L.hairMesh, { outline: 0 }); } catch { /* bald */ } }
    relaxHands(T, p);
    addClips(T, p, footG);
    const at2 = (k: number) => [door.x + lx * spots[k][0] + fx * spots[k][1], door.z + lz * spots[k][0] + fz * spots[k][1]];
    const [x, z] = at2(i), [ox, oz] = at2(1 - i);
    p.root.position.set(x, 0, z);
    // facing each other (chatting), then round to your car in its bay
    const faceTo = Math.atan2(ox - x, oz - z);
    const turnTo = Math.atan2(door.car[0] - x, door.car[1] - z);
    p.root.rotation.y = faceTo;
    const idle = p.actions.idle ?? Object.values(p.actions)[0];
    (idle as any)?.reset().play();
    (idle as any)?.setEffectiveTime?.(i * 1.3);
    scene.add(p.root);
    out.push({ root: p.root, mixer: p.mixer, faceTo, turnTo });
  }
}

/** The club's training top: the shirt colour a shade darker. */
function shade(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.62)).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
}

