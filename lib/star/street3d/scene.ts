/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE SHOPPING STREET, IN 3D (phase 1, 28 Nov 2026). Harry: "driving, horse riding, garden levels,
 * shopping, fixing any problems between 3d places" — at his standard: quality first, good on a
 * phone, nothing cheap. The plan (doors, where you stand, what each door opens, what the windows
 * show) is ./plan.ts; the screen round it is components/star/Street3D.tsx.
 *
 * A short English high street at golden hour, walked as the same footballer as the garden and the
 * 3D shop (the wardrobe outfit, home3d/wear.ts buildWearer via outfits.ts wornAt), with the same
 * camera (camera D, three3d/followCam.ts) and the first-person eye (three3d/viewCam.ts):
 *   - terraced fronts both sides: brick, stucco and stone, sash windows, cornices, slate roofs and
 *     chimneys, a civic building with a clock closing the north end, the lane to your garden south
 *   - four shop fronts: KNOWITBALL (the 3D shop, its doors open), KIB MOTORS (a car you can buy on a
 *     turning plinth behind the glass, its real shop price), THE DRIP (the boutique, real tags), the
 *     barber (shut, "opening soon", its pole turning); other fronts are closed shops so the street
 *     is never empty
 *   - the road, kerbs, a zebra with blinking beacons, parked cars (the shop's own car models, the
 *     house drive's light copies), lamps, textured trees in pits (garden3d/cardTrees.ts), benches,
 *     bins, bunting
 *   - people walking (the world kit's Npc, world3d/npc.ts: nobody walks through anybody; they keep
 *     to the pavements and cross at the zebra), stopping now and then at a window.
 * Static pieces are merged by material (freezeStatic), so the detail costs few draws.
 */
import { installAssetVersions } from "../three3d/assetUrl";
import { turnTo } from "../three3d/animBlend";
import { blobCanvas, numberCanvas } from "../shop3d/textures";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { dressCloth, offPitchWear, HOME_WB } from "../style3d/toon/clothes";
import { buildGrid, findPath, TapWalker, makeTapMarker, type WalkGrid, type XZ } from "../tapWalk";
import { makeWalkClip } from "../walkClip";
import { freezeStatic } from "../freezeStatic";
import { TIER_PROFILES, quality3dTier, stepDownTier, shadowSizeFor, type Quality3d } from "../three3d/quality";
import { Governor, sessionStartTier } from "../three3d/governor";
import { sceneSavings } from "../three3d/sceneSavings";
import { tightCull } from "../three3d/tightCull";
import { DynamicResolution, rememberGpu, loadGltfCached, acquireRenderer, awaitSmoothFrame, abandonedSceneError, abandonedContainer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { look3dStyle } from "../look3dStyle";
import { loadRealNature } from "../garden3d/realNature";
import { buildPlantZones, type TreeAt, type BushAt } from "../garden3d/plantZones";
import { cardMaterial, loadCardAtlas } from "../garden3d/cardTrees";
import { addClips, clipInfo, loadAnims3d } from "../three3d/footballAnims";
import { strideFor, type GaitBlend } from "../three3d/gaitBlend";
import { STROLL_SPEEDS, approach, stickTarget } from "../three3d/gait";
import { OrbitCam, CAM_MIN_Y } from "../three3d/orbitCam";
import { FOLLOW_CAM_D, FollowCarry, FollowZoom, attachFollowZoom, boxRoom, loadFollowZoom, riseForMin, zoomedFollowCam, type FollowCam } from "../three3d/followCam";
import { ViewCam, findHeadBone, headWorld, loadViewMode, showBody, type ViewMode } from "../three3d/viewCam";
import { pavingCanvas, skyCanvas, glowCanvas, brickCanvas, stripeCanvas, slateCanvas, hedgeCanvas } from "../garden3d/textures";
import { safeCompileAsync } from "../three3d/safeCompile";
import { carPaint } from "../home3d/roomBuild";
import { CAR_LOD, CAR_LENGTH, type Worn, type Kit2 } from "../home3d/outfits";
import { Npc, BODY_R, type Body, type NpcWorld } from "../world3d/npc";
import { SlotBook } from "../world3d/smartObject";
import { npcBudget } from "../world3d/budget";
import {
  ROAD, FRONT, NORTH, SOUTH, BODY, STREET_SHOPS, WALK_BOX, DOOR_RECESS, LAMPS, TREES, BENCHES, ZEBRA_Z, PARKED, CAR_HALF,
  arrivalOf, doorwayAt, throughDoor, leftSouth, streetSolids, walkPoints, crossesRoad, shopOf, walkerFree,
  type StreetArrive, type StreetDoor, type WindowItem,
} from "./plan";
import {
  asphaltCanvas, renderCanvas, fasciaCanvas, boutiqueCanvas, barberCanvas, soonCanvas, clockCanvas, namePlateCanvas,
  fingerCanvas, priceStandCanvas, tagCanvas, lettersCanvas,
} from "./textures";

export interface StreetData {
  /** The club kits (home first), for the kit you wear and the 3D shop's window shirts. */
  kits: { home: Kit2; away: Kit2 };
  number: number;
  player: { skin: string; hair: string; hairStyle?: "short" | "long" | "buzz" | "none" };
  /** What you wear (outfits.ts wornAt: the wardrobe's casual set, else the kit). */
  worn: Worn;
  arrive: StreetArrive;
  /** The showroom's car and the boutique's tags (./plan.ts showroomCar / boutiqueWindow). */
  showroom: WindowItem;
  boutique: WindowItem[];
}

export interface StreetCallbacks {
  /** The door you are standing at (its card), or null. "lane" = the south end, back to the garden. */
  onNear: (spot: StreetDoor | "lane" | null) => void;
  /** Walked through a door (the shut barber: walked up to it). */
  onDoor: (id: StreetDoor) => void;
  /** Walked off the south end, down the lane to your garden. Absent: the lane is a dead end. */
  onLeave?: () => void;
  onContextLost?: () => void;
}

export interface StreetController {
  setStick: (x: number, y: number) => void;
  orbit: (dx: number, dy?: number) => void;
  setView: (m: ViewMode) => void;
  viewMode: () => ViewMode;
  /** Tap to move: a tap on a shop front walks you to its door; on the ground, there. */
  tap: (clientX: number, clientY: number) => { door: StreetDoor | null } | null;
  /** For checking: stand him at (x, z), facing yaw. */
  place: (x: number, z: number, yaw?: number) => void;
  /** For checking: walk him to (x, z) (the tap-walk). */
  walkTo: (x: number, z: number) => boolean;
  where: () => { x: number; z: number; yaw: number; t: number; cam: number[] };
  stats: () => { calls: number; triangles: number; pixelRatio: number; quality: Quality3d; people: number; frames: number; merged: { before: number; after: number }; shadowRenders: number };
  /** For checking: people, their nearest gaps, the cars, the doors. */
  debug: () => Record<string, unknown>;
  /** For stills: a fixed camera (null: back to the follow camera). */
  debugCamera: (pos: [number, number, number] | null, look?: [number, number, number]) => void;
  dispose: () => void;
}

export interface StreetOptions {
  /** The screen closed while this was still building (3D places audit P1): stop at the next step. */
  isDead?: () => boolean;
  quality?: Quality3d;
  /** Filming: a fixed step per frame. */
  fixedStep?: number;
  /** How many people walk the street (default by quality: Low 1, Medium 3, High 5). */
  walkers?: number;
}

/** Sun low in the south, a little west: the street lit down its length, the east fronts warm. */
const LOOK = {
  top: "#3d73b8", mid: "#a9c6e2", low: "#f7d39c", fog: "#e8cfa8", sun: "#ffc98c", sunI: 3.2,
  hemi: ["#d6e2f0", "#5a4a2a", 0.55] as [string, string, number], exp: 1.0, env: 0.32, dir: [-0.34, 0.34, 0.88] as [number, number, number],
};
/** The fronts' wall line (shopfronts stand from FRONT to here). */
const W0 = FRONT + 0.35;
const DEPTH = 8.6;

async function buildStreet(container: HTMLElement, cb: StreetCallbacks, data: StreetData, opts: StreetOptions, own: { release?: (root?: any) => void; root?: any }): Promise<StreetController> {
  const gone = () => !!opts.isDead?.() || abandonedContainer(container);
  const ownTier: Quality3d = opts.quality ?? quality3dTier();
  let tier: Quality3d = sessionStartTier(ownTier);
  let prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  await installAssetVersions();
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkeletonUtils.default ?? SkeletonUtils;
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const dbg = new URLSearchParams(typeof location === "undefined" ? "" : location.search);
  const lookH = look3dStyle() === "h";

  // ── Renderer: the one shared renderer (three3d/perf.ts); never taken from the place on screen ──
  if (gone()) throw abandonedSceneError();
  const { renderer, release, isOwner } = acquireRenderer(THREE, container, prof);
  own.release = release;
  rememberGpu(renderer);
  const dpr = window.devicePixelRatio || 1;
  const gov = new Governor({ start: tier, ceiling: ownTier, name: "street", slowSeconds: 2, onChange: (r: any, _i: number, why: string) => {
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
  renderer.toneMappingExposure = LOOK.exp;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  let disposed = false;
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  own.root = scene;
  scene.fog = new THREE.Fog(LOOK.fog, 34, 120);
  scene.background = new THREE.Color(LOOK.fog);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = LOOK.env;
  const hEnh = lookH ? (await import("../style3d/real/enhance")).enhanceH(THREE, renderer, scene, tier, "golden", { exposure: LOOK.exp, envIntensity: LOOK.env }) : null;
  const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 180);
  const breathe = async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
    if (disposed || gone()) throw abandonedSceneError();
  };

  // ── Little builders (as the garden's) ──
  const canvasTex = (c: HTMLCanvasElement, repeat?: [number, number]) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.max(2, prof.anisotropy);
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
  const glow = (c: string, i = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  /** A tiling material whose repeat goes in each piece's own UVs (so every piece shares it and they merge). */
  const tileMat = (c: HTMLCanvasElement, tu: number, tv: number, o: any = {}) => {
    const t = canvasTex(c, [1, 1]);
    const m = mat("#ffffff", { map: t, ...o });
    m.userData.tile = [tu, tv];
    return m;
  };
  /** A box whose UVs repeat every m.userData.tile metres on each face. */
  const tiledBox = (w: number, h: number, d: number, m: any) => {
    const g = new THREE.BoxGeometry(w, h, d);
    const t = m?.userData?.tile as [number, number] | undefined;
    if (t) {
      const uv = g.attributes.uv;
      const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
      for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, (uv.getX(i) * dims[f][0]) / t[0], (uv.getY(i) * dims[f][1]) / t[1]); }
    }
    return g;
  };
  const batch = (parent: any = scene, cast = true) => {
    const byMat = new Map<any, any[]>();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const put = (geo: any, m: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), sc.set(sx, sy, sz)));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m)!.push(g);
    };
    return {
      put,
      box: (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => put(tiledBox(w, h, d, m), m, x, y, z, rx, ry, rz),
      done: () => {
        const out: any[] = [];
        byMat.forEach((list, m) => {
          const me = new THREE.Mesh(mergeGeometries(list), m);
          me.castShadow = cast && !m.transparent;
          me.receiveShadow = true;
          parent.add(me);
          out.push(me);
        });
        byMat.clear();
        return out;
      },
    };
  };
  const blobT = canvasTex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, opacity = 0.75) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.035, z);
    m.renderOrder = 1;
    scene.add(m);
    return m;
  };
  /** A flat picture facing +x (side +1 fronts face -x: rotate). */
  const facing = (side: number) => (side > 0 ? -Math.PI / 2 : Math.PI / 2);
  const X = (side: number, u: number) => side * (FRONT + u);

  // ── The sky: the garden's golden dome, the low sun, a few clouds ──
  const dome = new THREE.Mesh(new THREE.SphereGeometry(140, 24, 16),
    new THREE.MeshBasicMaterial({ map: canvasTex(skyCanvas(LOOK.top, LOOK.mid, LOOK.low)), side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(dome);
  const sunDir = new THREE.Vector3(...LOOK.dir).normalize();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(glowCanvas("255,236,200")), fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(24);
  sunSprite.position.copy(sunDir).multiplyScalar(120);
  scene.add(sunSprite);
  const cloudM = mat("#ffffff", { transparent: true, opacity: 0.88, emissive: "#ffe4c4", emissiveIntensity: 0.4 });
  const clouds: any[] = [];
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), cloudM);
      p.scale.set(2.6 + ((i * 7 + k * 3) % 5) * 0.35, 1.2 + (k % 2) * 0.4, 1.8);
      p.position.set(k * 2.2 - 3.2, (k % 3) * 0.3, (k % 2) * 1.0);
      c.add(p);
    }
    const a = (i / 6) * Math.PI * 2 + 0.4;
    c.position.set(Math.cos(a) * 62, 30 + (i % 3) * 5, Math.sin(a) * 62);
    c.lookAt(0, c.position.y, 0);
    clouds.push(c);
    scene.add(c);
  }

  // ── Light ──
  const hemiLight = new THREE.HemisphereLight(LOOK.hemi[0], LOOK.hemi[1], LOOK.hemi[2]);
  scene.add(hemiLight);
  const sun = new THREE.DirectionalLight(LOOK.sun, LOOK.sunI);
  sun.position.copy(sunDir).multiplyScalar(48);
  sun.target.position.set(0, 0, -2);
  sun.position.add(sun.target.position);
  sun.castShadow = prof.shadows;
  const SUN_MAP = 2048;
  sun.shadow.mapSize.set(shadowSizeFor(prof, SUN_MAP) || SUN_MAP, shadowSizeFor(prof, SUN_MAP) || SUN_MAP);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 28, bottom: -28, near: 1, far: 120 });
  sun.shadow.autoUpdate = true; // the shadow cache keeps the still things' shadows (sceneSavings)
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const fillLight = new THREE.PointLight("#ffe6cc", 2.2, 9, 1.6);
  fillLight.userData.moves = true;
  scene.add(fillLight);

  const nature = lookH ? await loadRealNature(THREE, renderer).catch((e) => { console.error("street nature maps failed", e); return null; }) : null;
  if (disposed || gone()) throw abandonedSceneError();
  await breathe();

  // ── The ground: road, kerbs, pavements, the lane south ──
  const flat = (w: number, d: number, m: any, x: number, z: number, y: number, tile = 0) => {
    const pg = new THREE.PlaneGeometry(w, d);
    if (tile > 0) { const uv = pg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile); }
    const p = new THREE.Mesh(pg, m);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, y, z);
    p.receiveShadow = true;
    scene.add(p);
    return p;
  };
  const roadT = canvasTex(asphaltCanvas(), [1, 1]);
  const roadM = mat("#ffffff", { map: roadT, roughness: 0.92 });
  const ZL = NORTH - 4, ZR = SOUTH + 26; // the road runs a little past each end
  flat(ROAD * 2, ZR - ZL, roadM, 0, (ZL + ZR) / 2, 0.0, 4.2);
  const paveM = nature
    ? (() => { const t = nature.paving.clone(), n = nature.pavingN.clone(); for (const m of [t, n]) { m.repeat.set(1, 1); m.needsUpdate = true; } return mat("#efe6d8", { map: t, normalMap: n, normalScale: new THREE.Vector2(1.0, 1.0), roughness: 0.88 }); })()
    : (() => { const t = canvasTex(pavingCanvas(), [1, 1]); return mat("#ece4d6", { map: t, roughness: 0.9 }); })();
  const PH = 0.12; // the pavement's height above the road
  for (const side of [-1, 1]) {
    const pw = W0 - ROAD;
    // the pavement is a slab (its kerb face is the stone kerb below)
    const p = flat(pw, SOUTH + 1.5 - NORTH, paveM, side * (ROAD + pw / 2), (NORTH + SOUTH + 1.5) / 2, PH, nature ? 2.4 : 0.9);
    p.renderOrder = 0;
  }
  // the lane south: a narrower pavement and grass verges either side
  const vergeM = mat("#6f8f45", { roughness: 1 });
  for (const side of [-1, 1]) {
    flat(1.6, 24, paveM, side * (ROAD + 0.8), SOUTH + 1.5 + 12, PH, nature ? 2.4 : 0.9);
    flat(14, 24, vergeM, side * (ROAD + 1.6 + 7), SOUTH + 1.5 + 12, PH - 0.01);
  }
  flat(60, 60, vergeM, 0, SOUTH + 50, -0.01);
  const stat = batch(scene, false); // kerbs, lines: no shadows of their own
  const kerbM = mat("#bdb5a6", { roughness: 0.8 });
  for (const side of [-1, 1]) {
    stat.box(0.16, PH + 0.02, ZR - NORTH, kerbM, side * (ROAD + 0.08), (PH + 0.02) / 2 - 0.01, (NORTH + ZR) / 2);
    // the gutter: a darker strip along the kerb
    stat.box(0.32, 0.004, ZR - NORTH, mat("#2e3034", { roughness: 0.95 }), side * (ROAD - 0.16), 0.003, (NORTH + ZR) / 2);
  }
  // road lines: the centre dashes, double yellows by the doors, the zebra
  const whiteM = mat("#f1efe9", { roughness: 0.7 });
  const yellowM = mat("#e8c33a", { roughness: 0.7 });
  for (let z = NORTH; z < ZR; z += 4.5) if (Math.abs(z - ZEBRA_Z) > 3.5) stat.box(0.12, 0.006, 2.2, whiteM, 0, 0.004, z);
  for (const side of [-1, 1]) for (const dx of [0.22, 0.34]) {
    // double yellow lines along both kerbs, broken where the cars park
    let z0 = NORTH + 0.5;
    const cuts = PARKED.filter((c) => Math.sign(c.x) === side).map((c) => [c.z - CAR_HALF[1] - 0.6, c.z + CAR_HALF[1] + 0.6]).sort((a, b) => a[0] - b[0]);
    for (const [a, b] of [...cuts, [SOUTH + 6, SOUTH + 6]]) { if (a - z0 > 0.5) stat.box(0.07, 0.006, a - z0, yellowM, side * (ROAD - dx), 0.005, (a + z0) / 2); z0 = b; }
  }
  // the parking bays: white Ts at each end
  for (const c of PARKED) for (const e of [-1, 1]) {
    const zz = c.z + e * (CAR_HALF[1] + 0.4);
    stat.box(1.9, 0.006, 0.09, whiteM, c.x, 0.005, zz);
  }
  // the zebra: stripes across the road, zig-zags either side, two beacons
  for (let k = 0; k < 7; k++) stat.box(ROAD * 2 - 0.4, 0.007, 0.42, whiteM, 0, 0.006, ZEBRA_Z - 1.3 + k * 0.43, 0);
  for (const side of [-1, 1]) for (const e of [-1, 1]) {
    for (let k = 0; k < 6; k++) {
      const z = ZEBRA_Z + e * (2.4 + k * 0.7);
      stat.box(0.08, 0.006, 0.78, whiteM, side * (ROAD - 0.5) + (k % 2 ? 0.12 : -0.12), 0.006, z, (k % 2 ? 0.3 : -0.3));
    }
  }
  stat.done();

  // ── Where you can't walk ──
  const SOLIDS = streetSolids();
  const occluders: { kind: "tree" | "car"; x: number; z: number; r: number; y0: number; y1: number }[] = [];
  for (const [x, z] of TREES) occluders.push({ kind: "tree", x, z, r: 1.5, y0: 2.2, y1: 7.5 });

  await breathe();
  // ── The buildings: terraced fronts, both sides ──
  type Wall = "brick" | "brown" | "stock" | "cream" | "white" | "sage" | "blue" | "stone" | "pink" | "clad";
  const WALL: Record<Wall, any> = {
    brick: tileMat(brickCanvas("#9a5138"), 0.45, 0.6, { roughness: 0.9 }),
    brown: tileMat(brickCanvas("#77462f"), 0.45, 0.6, { roughness: 0.9 }),
    stock: tileMat(brickCanvas("#c2a06b"), 0.45, 0.6, { roughness: 0.9 }),
    cream: tileMat(renderCanvas("#eadfc6", 3), 3, 3, { roughness: 0.85 }),
    white: tileMat(renderCanvas("#f1efe8", 5), 3, 3, { roughness: 0.85 }),
    sage: tileMat(renderCanvas("#a8b89a", 9), 3, 3, { roughness: 0.85 }),
    blue: tileMat(renderCanvas("#a9bfcc", 11), 3, 3, { roughness: 0.85 }),
    stone: tileMat(renderCanvas("#d6ccb8", 13), 2.5, 2.5, { roughness: 0.9 }),
    pink: tileMat(renderCanvas("#e3c3b6", 17), 3, 3, { roughness: 0.85 }),
    clad: mat("#2b3036", { roughness: 0.55, metalness: 0.2 }),
  };
  const trimM = mat("#ece6da", { roughness: 0.7 });
  const stoneTrimM = mat("#d9d0bf", { roughness: 0.8 });
  const blackM = mat("#1c1f23", { roughness: 0.45 });
  const roofFlatM = mat("#4b4d50", { roughness: 0.95 });
  const slateM = tileMat(slateCanvas(), 2, 2, { roughness: 0.75 });
  const winM = mat("#43535d", { roughness: 0.12, metalness: 0.45, envMapIntensity: 1.3 });
  const cladGlassM = mat("#6f8796", { roughness: 0.08, metalness: 0.6, envMapIntensity: 1.8 });
  const finM = mat("#9aa3ab", { roughness: 0.35, metalness: 0.7 });
  const winLitM = mat("#5a5446", { roughness: 0.2, metalness: 0.2, emissive: "#ffc77a", emissiveIntensity: 0.45 });
  const glassM = new THREE.MeshStandardMaterial({ color: "#a9c4cf", transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0.9, depthWrite: false, envMapIntensity: 1.6 });
  const insideM = new THREE.MeshBasicMaterial({ color: "#ffdcaa", fog: false, toneMapped: false });
  const darkInM = mat("#1d1b19", { roughness: 0.9 });
  const bodyB = batch(scene); // every wall, trim and window: merged by material
  let litSeed = 3;
  const lit = () => { litSeed = (litSeed * 16807) % 2147483647; return litSeed / 2147483647 < 0.22; };

  /** A sash window on a front at height y (its middle), along z, `w` wide, `h` tall. */
  const sash = (side: number, z: number, y: number, w = 1.05, h = 1.55, frame = trimM) => {
    const u = W0 - FRONT; // on the wall face
    bodyB.box(0.04, h, w, lit() ? winLitM : winM, X(side, u - 0.01), y, z);
    for (const dz of [-w / 2, w / 2]) bodyB.box(0.08, h + 0.08, 0.07, frame, X(side, u - 0.04), y, z + dz);
    bodyB.box(0.08, 0.07, w, frame, X(side, u - 0.04), y + h / 2, z);
    bodyB.box(0.08, 0.06, w, frame, X(side, u - 0.04), y, z); // the meeting rail
    bodyB.box(0.08, 0.05, 0.04, frame, X(side, u - 0.045), y + h / 4, z);
    bodyB.box(0.08, 0.05, 0.04, frame, X(side, u - 0.045), y - h / 4, z);
    bodyB.box(0.05, h, 0.04, frame, X(side, u - 0.045), y, z);
    bodyB.box(0.18, 0.09, w + 0.22, stoneTrimM, X(side, u - 0.09), y - h / 2 - 0.05, z); // the sill
    bodyB.box(0.08, 0.16, w + 0.18, stoneTrimM, X(side, u - 0.04), y + h / 2 + 0.1, z); // the lintel
  };

  interface Bld { side: 1 | -1; z0: number; z1: number; floors: number; wall: Wall; roof: "slate" | "parapet" | "flat"; ground: "shop" | "house" | "none"; closed?: { name: string; board: string; ink?: string; awning?: [string, string] }; /** How deep the shop behind the glass is (its back wall). */ back?: number }
  /** One building: its body, its upper windows, a cornice and its roof (the ground floor is built apart). */
  const building = (b: Bld) => {
    const L = b.z1 - b.z0, zc = (b.z0 + b.z1) / 2;
    const fh = 3.1, gh = 4.1; // floor heights (the ground floor taller)
    const H = gh + (b.floors - 1) * fh;
    const wm = WALL[b.wall];
    if (b.ground === "house") bodyB.box(DEPTH, H, L, wm, X(b.side, W0 - FRONT + DEPTH / 2), H / 2, zc);
    else {
      // a shop on the ground floor: the floors above stand on the front wall; the ground floor's own
      // wall is the shop's back wall, behind its windows and door (seen through the glass)
      const back = b.back ?? 1.5, y0 = 3.95 + PH;
      bodyB.box(DEPTH, H - y0, L, wm, X(b.side, W0 - FRONT + DEPTH / 2), y0 + (H - y0) / 2, zc);
      bodyB.box(DEPTH - back, y0, L, wm, X(b.side, back + (DEPTH - back) / 2 + (W0 - FRONT)), y0 / 2, zc);
      // the party walls at each end (no gap to see into between two fronts)
      for (const e of [-1, 1]) bodyB.box(back + 0.4, y0, 0.6, wm, X(b.side, (back + 0.4) / 2), y0 / 2, zc + e * (L / 2 - 0.3));
    }
    // the band over the shopfronts, and the cornice at the top
    bodyB.box(0.22, 0.16, L, stoneTrimM, X(b.side, W0 - FRONT - 0.1), gh + 0.02, zc);
    if (b.roof === "parapet") {
      bodyB.box(0.36, 0.3, L, stoneTrimM, X(b.side, W0 - FRONT - 0.12), H - 0.2, zc);
      bodyB.box(0.3, 0.7, L, wm, X(b.side, W0 - FRONT + 0.12), H + 0.3, zc);
      bodyB.box(0.42, 0.1, L + 0.02, stoneTrimM, X(b.side, W0 - FRONT + 0.12), H + 0.68, zc);
      bodyB.box(DEPTH - 0.6, 0.05, L - 0.2, roofFlatM, X(b.side, W0 - FRONT + DEPTH / 2 + 0.2), H + 0.03, zc);
    } else if (b.roof === "slate") {
      bodyB.box(0.3, 0.2, L, stoneTrimM, X(b.side, W0 - FRONT - 0.1), H - 0.12, zc);
      const run = 4.3, rise = 2.6, slant = Math.hypot(run, rise), pitch = Math.atan2(rise, run);
      bodyB.box(slant, 0.14, L + 0.04, slateM, X(b.side, W0 - FRONT + run / 2 - 0.15), H + rise / 2, zc, 0, 0, b.side * pitch);
      bodyB.box(0.2, 0.18, L + 0.04, mat("#2c2f35", { roughness: 0.6 }), X(b.side, W0 - FRONT + run - 0.15), H + rise + 0.04, zc);
      // the attic under the slopes: solid, so no gap shows at a gable beside a lower neighbour
      const att = new THREE.Shape();
      const ua = W0 - FRONT, ux = (u: number) => b.side * (FRONT + u);
      att.moveTo(ux(ua), H - 0.05); att.lineTo(ux(ua + 2 * run - 0.4), H - 0.05); att.lineTo(ux(ua + run - 0.15), H + rise - 0.14); att.closePath();
      const ag = new THREE.ExtrudeGeometry(att, { depth: L - 0.04, bevelEnabled: false });
      { const uv = ag.attributes.uv, t = wm.userData.tile ?? [1, 1]; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / t[0], uv.getY(i) / t[1]); }
      bodyB.put(ag, wm, 0, 0, b.z0 + 0.02);
      // the back slope (seen from the far pavement over the ridge)
      bodyB.box(slant, 0.14, L + 0.04, slateM, X(b.side, W0 - FRONT + run * 1.5 - 0.15), H + rise / 2, zc, 0, 0, -b.side * pitch);
      // a chimney stack or two on the ridge
      for (const k of L > 7 ? [-0.32, 0.32] : [0.3]) {
        const cz = zc + k * L;
        bodyB.box(0.8, 1.6, 1.2, WALL[b.wall === "clad" ? "brick" : b.wall.startsWith("b") || b.wall === "stock" ? b.wall : "brick"], X(b.side, W0 - FRONT + run - 0.15), H + rise + 0.5, cz);
        bodyB.box(0.95, 0.14, 1.35, stoneTrimM, X(b.side, W0 - FRONT + run - 0.15), H + rise + 1.33, cz);
        for (const dz of [-0.28, 0, 0.28]) bodyB.put(new THREE.CylinderGeometry(0.1, 0.12, 0.36, 8), mat("#a8603f", { roughness: 0.8 }), X(b.side, W0 - FRONT + run - 0.15), H + rise + 1.58, cz + dz);
      }
    } else {
      bodyB.box(0.3, 0.25, L, b.wall === "clad" ? blackM : stoneTrimM, X(b.side, W0 - FRONT - 0.08), H + 0.12, zc);
    }
    // the upper floors' windows, evenly spaced
    const n = Math.max(1, Math.round((L - 1.2) / 2.5));
    for (let f = 1; f < b.floors; f++) {
      const y = gh + (f - 1) * fh + 1.6;
      for (let k = 0; k < n; k++) {
        const z = b.z0 + (L * (k + 0.5)) / n;
        if (b.wall === "clad") {
          // a band of glass with an office lit behind it, slim fins between the panes
          const pw = L / n;
          bodyB.box(0.05, 2.3, pw - 0.16, k % 2 ? winLitM : cladGlassM, X(b.side, W0 - FRONT - 0.02), y - 0.1, z);
          bodyB.box(0.22, 2.5, 0.1, finM, X(b.side, W0 - FRONT - 0.1), y - 0.1, b.z0 + pw * k + 0.05);
          bodyB.box(0.18, 0.12, pw, finM, X(b.side, W0 - FRONT - 0.08), y - 1.3, z);
        } else sash(b.side, z, y, Math.min(1.15, L / n - 0.9), f === 1 ? 1.75 : 1.5);
      }
    }
    // a house front on the ground floor: a front door with a fanlight, a window either side
    if (b.ground === "house") {
      const dz = zc;
      bodyB.box(0.06, 2.3, 1.05, mat(["#22324a", "#5b1e1e", "#1f3d2c", "#2b2b2b"][Math.abs(Math.round(zc)) % 4], { roughness: 0.4 }), X(b.side, W0 - FRONT - 0.02), 1.15 + PH, dz);
      bodyB.box(0.1, 0.42, 1.05, winM, X(b.side, W0 - FRONT - 0.02), 2.55 + PH, dz);
      for (const e of [-1, 1]) bodyB.box(0.14, 2.9, 0.12, trimM, X(b.side, W0 - FRONT - 0.06), 1.45 + PH, dz + e * 0.6);
      bodyB.box(0.2, 0.14, 1.4, trimM, X(b.side, W0 - FRONT - 0.08), 2.95 + PH, dz);
      bodyB.box(0.5, 0.16, 1.4, stoneTrimM, X(b.side, W0 - FRONT - 0.2), PH + 0.08, dz); // the step
      bodyB.box(0.04, 0.05, 0.12, mat("#c9a14f", { metalness: 0.8, roughness: 0.3 }), X(b.side, W0 - FRONT - 0.07), 1.2 + PH, dz + 0.3);
      if (L > 3.4) for (const e of [-1, 1]) sash(b.side, dz + e * Math.min(1.6, L / 2 - 0.8), 1.9, 1.05, 1.6);
    }
  };

  // ── Shop fronts on the ground floor ──
  // fascia names in one atlas (one draw for every sign); window pictures likewise
  const signs: { text: string; board: string; ink?: string; serif?: boolean; sub?: string }[] = [];
  const signAt = (s: (typeof signs)[number]) => { signs.push(s); return signs.length - 1; };
  const signJobs: { i: number; side: number; z: number; w: number }[] = [];
  const shopB = batch(scene);
  /** A shopfront between z0 and z1: pilasters, fascia, two windows and a door in the middle. */
  const shopfront = (side: 1 | -1, zc: number, w: number, o: { paint: any; sign: number; doorHalf: number; door: "open" | "shut"; window: any; awning?: [string, string]; lamps?: boolean; pilaster?: any; inside?: any }) => {
    const paint = o.paint, pil = o.pilaster ?? paint, gold = mat("#c9a14f", { roughness: 0.3, metalness: 0.85 });
    const fy0 = 3.05 + PH, fy1 = 3.85 + PH;
    // fascia board, the cornice above it, a thin gold line
    shopB.box(0.3, fy1 - fy0, w, paint, X(side, 0.2), (fy0 + fy1) / 2, zc);
    shopB.box(0.5, 0.18, w + 0.3, paint, X(side, 0.12), fy1 + 0.09, zc);
    for (const y of [fy0 + 0.03, fy1 - 0.03]) shopB.box(0.04, 0.035, w - 0.3, gold, X(side, 0.04), y, zc);
    signJobs.push({ i: o.sign, side, z: zc, w: w - 0.6 });
    // pilasters at the ends and either side of the door, with capitals
    const ends = [zc - w / 2 + 0.22, zc + w / 2 - 0.22, zc - o.doorHalf - 0.2, zc + o.doorHalf + 0.2];
    for (const z of ends) {
      shopB.box(0.35, fy0 - PH, 0.4, pil, X(side, 0.175), PH + (fy0 - PH) / 2, z);
      shopB.box(0.42, 0.18, 0.5, pil, X(side, 0.14), fy0 - 0.06, z);
      shopB.box(0.4, 0.16, 0.48, pil, X(side, 0.15), PH + 0.08, z);
    }
    // the two windows: stallriser, glass with glazing bars, the lit inside
    for (const e of [-1, 1]) {
      const a = zc + e * (o.doorHalf + 0.4), b = zc + e * (w / 2 - 0.42);
      const bz = (a + b) / 2, bw = Math.abs(b - a);
      if (bw < 0.4) continue;
      shopB.box(0.26, 0.6, bw, paint, X(side, 0.22), PH + 0.3, bz);
      shopB.box(0.3, 0.08, bw, gold, X(side, 0.2), PH + 0.62, bz);
      shopB.box(0.1, 0.1, bw, paint, X(side, 0.3), fy0 - 0.12, bz);
      shopB.box(0.02, fy0 - PH - 0.78, bw, glassM, X(side, 0.3), PH + 0.66 + (fy0 - PH - 0.78) / 2, bz);
      for (const k of [-1, 1]) shopB.box(0.06, fy0 - PH - 0.8, 0.06, paint, X(side, 0.3), PH + 0.66 + (fy0 - PH - 0.8) / 2, bz + (k * bw) / 6);
      shopB.box(0.06, 0.06, bw, paint, X(side, 0.3), fy0 - 0.55, bz);
      // inside: the picture (or dark), a platform, the window's side cheeks and ceiling
      const inM = o.window ?? darkInM;
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(bw, fy0 - PH - 0.7), inM);
      pic.position.set(X(side, 1.2), PH + 0.66 + (fy0 - PH - 0.7) / 2, bz);
      pic.rotation.y = facing(side);
      scene.add(pic);
      shopB.box(0.9, 0.06, bw, mat("#5b3a26", { roughness: 0.6 }), X(side, 0.75), PH + 0.62, bz);
      const sideIn = o.inside ?? mat("#e6d3b4", { roughness: 0.8 });
      for (const k of [-1, 1]) shopB.box(0.9, fy0 - PH - 0.66, 0.04, sideIn, X(side, 0.75), PH + 0.62 + (fy0 - PH - 0.66) / 2, bz + (k * bw) / 2);
      shopB.box(0.9, 0.04, bw, sideIn, X(side, 0.75), fy0 - 0.05, bz);
    }
    // the door
    const dh = 2.75;
    shopB.box(0.3, 0.16, o.doorHalf * 2, paint, X(side, 0.3), PH + dh + 0.08, zc);
    shopB.box(0.02, fy0 - PH - dh - 0.2, o.doorHalf * 2, glassM, X(side, 0.32), PH + dh + 0.1 + (fy0 - PH - dh - 0.2) / 2, zc);
    shopB.box(0.55, 0.06, o.doorHalf * 2 + 0.5, stoneTrimM, X(side, 0.12), PH + 0.03, zc); // the step
    if (o.door === "open") {
      const inside = new THREE.Mesh(new THREE.PlaneGeometry(o.doorHalf * 2, dh), insideM);
      inside.position.set(X(side, 1.4), PH + dh / 2, zc);
      inside.rotation.y = facing(side);
      scene.add(inside);
      shopB.box(1.2, 0.03, o.doorHalf * 2, mat("#8a5a36", { roughness: 0.6 }), X(side, 0.85), PH + 0.015, zc);
      for (const k of [-1, 1]) shopB.box(1.1, dh, 0.04, o.inside ?? mat("#e6d3b4", { roughness: 0.8 }), X(side, 0.85), PH + dh / 2, zc + k * o.doorHalf);
      // both doors swung open, inwards
      const leaf = o.doorHalf - 0.04, open = 1.25;
      for (const k of [-1, 1]) {
        const hz = zc + k * o.doorHalf;
        const cu = 0.32 + (Math.sin(open) * leaf) / 2, cz = hz - k * (Math.cos(open) * leaf) / 2;
        shopB.box(0.06, dh - 0.05, leaf, paint, X(side, cu), PH + (dh - 0.05) / 2, cz, side * k * (Math.PI / 2 - open));
        shopB.box(0.08, dh - 0.9, leaf - 0.3, glassM, X(side, cu), PH + dh / 2 + 0.15, cz, side * k * (Math.PI / 2 - open));
      }
    } else {
      shopB.box(0.06, dh, o.doorHalf * 2, paint, X(side, 0.32), PH + dh / 2, zc);
      shopB.box(0.08, dh - 1.0, o.doorHalf * 2 - 0.36, o.window ? glassM : winM, X(side, 0.3), PH + dh / 2 + 0.2, zc);
      shopB.box(0.06, 0.05, 0.14, gold, X(side, 0.26), PH + 1.15, zc + o.doorHalf - 0.2);
    }
    if (o.awning) {
      const awnM = mat("#ffffff", { map: canvasTex(stripeCanvas(o.awning[0], o.awning[1]), [Math.max(1, Math.round(w / 1.6)), 1]), roughness: 0.85, side: THREE.DoubleSide });
      const drop = 0.55, reach = 1.3, tilt = Math.atan2(drop, reach);
      const aw = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(drop, reach), 0.04, w - 0.2), awnM);
      aw.position.set(X(side, -reach / 2 + 0.05), fy0 - 0.08 - drop / 2, zc);
      aw.rotation.z = side * tilt; // higher at the wall
      aw.castShadow = true; aw.receiveShadow = true;
      scene.add(aw);
      const val = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.24, w - 0.2), awnM);
      val.position.set(X(side, -reach + 0.04), fy0 - 0.08 - drop - 0.1, zc);
      scene.add(val);
    }
    if (o.lamps) for (const k of [-1, 1]) {
      shopB.box(0.16, 0.3, 0.16, glow("#ffd59a", 1.2), X(side, -0.1), PH + 2.3, zc + k * (o.doorHalf + 0.45));
      shopB.box(0.22, 0.05, 0.22, gold, X(side, -0.1), PH + 2.47, zc + k * (o.doorHalf + 0.45));
    }
    // a planter with a clipped bay either side of an open door (streetSolids keeps you off them)
    if (o.door === "open") for (const k of [-1, 1]) {
      const pz = zc + k * (o.doorHalf + 0.75);
      shopB.box(0.56, 0.56, 0.56, paint, X(side, -0.45), PH + 0.28, pz);
      shopB.box(0.62, 0.05, 0.62, gold, X(side, -0.45), PH + 0.58, pz);
      shopB.box(0.05, 0.7, 0.05, mat("#5a3b25"), X(side, -0.45), PH + 0.95, pz);
      shopB.put(new THREE.IcosahedronGeometry(0.42, 2), mat("#ffffff", { map: canvasTex(hedgeCanvas("#2c5a25"), [1, 1]), roughness: 0.95 }), X(side, -0.45), PH + 1.55, pz);
    }
  };

  // the street's buildings, north to south on each side (the four shops' ground floors are built after)
  const BLD: Bld[] = [
    // east (front faces west)
    { side: 1, z0: NORTH, z1: -19.5, floors: 3, wall: "stone", roof: "parapet", ground: "shop", closed: { name: "BOOKS & MAPS", board: "#1f3a5f", awning: ["#f2ead8", "#1f3a5f"] } },
    { side: 1, z0: -19.5, z1: -13, floors: 3, wall: "cream", roof: "slate", ground: "shop", closed: { name: "CORNER CAFE", board: "#6b2d2d", awning: ["#f6efe0", "#6b2d2d"] } },
    { side: 1, z0: -13, z1: -1, floors: 2, wall: "brick", roof: "slate", ground: "none" },
    { side: 1, z0: -1, z1: 2.8, floors: 3, wall: "sage", roof: "parapet", ground: "house" },
    { side: 1, z0: 2.8, z1: 16.2, floors: 2, wall: "clad", roof: "flat", ground: "none", back: 6.7 },
    { side: 1, z0: 16.2, z1: 23, floors: 3, wall: "brown", roof: "slate", ground: "shop", closed: { name: "FLOWERS", board: "#2f4f2a", awning: ["#f4efe2", "#2f4f2a"] } },
    // west (front faces east)
    { side: -1, z0: NORTH, z1: -18.5, floors: 3, wall: "brick", roof: "slate", ground: "shop", closed: { name: "BAKERY", board: "#7a4b1e", awning: ["#f6efe0", "#b45309"] } },
    { side: -1, z0: -18.5, z1: -11.5, floors: 3, wall: "pink", roof: "parapet", ground: "house" },
    { side: -1, z0: -11.5, z1: -0.5, floors: 3, wall: "white", roof: "parapet", ground: "none" },
    { side: -1, z0: -0.5, z1: 4.2, floors: 3, wall: "stock", roof: "slate", ground: "house" },
    { side: -1, z0: 4.2, z1: 11.8, floors: 2, wall: "cream", roof: "slate", ground: "none" },
    { side: -1, z0: 11.8, z1: 23, floors: 3, wall: "blue", roof: "parapet", ground: "shop", closed: { name: "NEWS & SWEETS", board: "#1e3a5f", awning: ["#f2ead8", "#9b1c1c"] } },
  ];
  for (const b of BLD) building(b);
  // the closed shops' fronts (lit inside, nobody home: their own fascias)
  for (const b of BLD) if (b.closed) {
    const zc = (b.z0 + b.z1) / 2, w = b.z1 - b.z0 - 0.4;
    const paint = mat(b.closed.board, { roughness: 0.45 });
    shopfront(b.side, zc, w, { paint, sign: signAt({ text: b.closed.name, board: b.closed.board, serif: true }), doorHalf: 0.6, door: "shut", window: null, awning: b.closed.awning });
  }
  await breathe();

  // ── The four shops ──
  const ART = (c: HTMLCanvasElement) => { const t = canvasTex(c); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: "#ffffff", emissiveIntensity: 0.55, roughness: 0.85 }); };
  const greenM = mat("#1f4a35", { roughness: 0.45 });
  // KNOWITBALL: the 3D shop's own front (the garden's shop: green, gold, the neon name, your kit in the window)
  {
    const s = shopOf("shop");
    shopfront(s.side, s.z, s.width, { paint: greenM, sign: signAt({ text: "KNOWITBALL", board: "#1f4a35", sub: "BOOTS · KIT · CANS · THE LOT" }), doorHalf: s.doorHalf, door: "open", window: ART(shopWindowCanvas(data.kits.home.shirt, data.kits.home.trim)), awning: ["#f2ead8", "#1f4a35"], lamps: true, inside: mat("#f3e4c8", { roughness: 0.8 }) });
  }
  // KIB MOTORS: a glass showroom; the car you could buy next turns on a plinth inside
  const showroom = { group: new THREE.Group(), car: null as any };
  {
    const s = shopOf("cars");
    const w = s.width, zc = s.z, side = s.side;
    const B = batch(scene);
    const steel = mat("#2b3036", { roughness: 0.4, metalness: 0.5 });
    const gy = 4.0;
    // the frame: a deep dark fascia, slim mullions, full-height glass
    B.box(0.5, 0.9, w + 0.2, steel, X(side, 0.15), gy + 0.05, zc);
    const n = 5;
    for (let k = 0; k <= n; k++) B.box(0.16, gy - 0.4, 0.12, steel, X(side, 0.25), PH + (gy - 0.4) / 2, zc - w / 2 + (w * k) / n);
    B.box(0.2, 0.18, w, steel, X(side, 0.25), PH + 0.09, zc);
    for (let k = 0; k < n; k++) {
      const a = zc - w / 2 + (w * k) / n + 0.08, b = zc - w / 2 + (w * (k + 1)) / n - 0.08;
      const mid = (a + b) / 2;
      if (Math.abs(mid - zc) < s.doorHalf + 0.1) continue; // the doorway (open)
      B.box(0.02, gy - 0.6, b - a, glassM, X(side, 0.3), PH + 0.2 + (gy - 0.6) / 2, mid);
    }
    // inside: a pale floor, white walls, a ceiling with light strips
    const roomD = 6.2;
    const floorM = mat("#d9dde0", { roughness: 0.22, metalness: 0.1 });
    B.box(roomD, 0.04, w - 0.2, floorM, X(side, 0.3 + roomD / 2), PH + 0.02, zc);
    const wallIn = mat("#f2f2ef", { roughness: 0.8, emissive: "#fff3dc", emissiveIntensity: 0.35 });
    B.box(0.06, gy - 0.3, w - 0.2, wallIn, X(side, 0.3 + roomD), PH + (gy - 0.3) / 2, zc);
    for (const k of [-1, 1]) B.box(roomD, gy - 0.3, 0.06, wallIn, X(side, 0.3 + roomD / 2), PH + (gy - 0.3) / 2, zc + k * (w / 2 - 0.12));
    B.box(roomD, 0.05, w - 0.2, mat("#e6e6e3", { roughness: 0.9 }), X(side, 0.3 + roomD / 2), PH + gy - 0.35, zc);
    for (const k of [-0.3, 0, 0.3]) B.box(roomD - 1, 0.04, 0.16, glow("#fffaf0", 2.2), X(side, 0.3 + roomD / 2), PH + gy - 0.38, zc + k * w);
    // the turning plinth
    B.put(new THREE.CylinderGeometry(2.6, 2.7, 0.14, 48), mat("#20242a", { roughness: 0.25, metalness: 0.6 }), X(side, 3.4), PH + 0.07, zc + 1.6);
    B.put(new THREE.CylinderGeometry(2.62, 2.62, 0.02, 48), glow("#ffd77a", 0.9), X(side, 3.4), PH + 0.145, zc + 1.6);
    B.done();
    // the name on the fascia: white letters, lit
    const name = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.5, w * 0.5 * 192 / 1024), new THREE.MeshBasicMaterial({ map: canvasTex(lettersCanvas("KIB MOTORS", "#f4f6f8")), transparent: true, depthWrite: false }));
    name.position.set(X(side, -0.11), gy + 0.05, zc);
    name.rotation.y = facing(side);
    scene.add(name);
    // the price stand (the shop's own price for that car)
    const stand = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), new THREE.MeshBasicMaterial({ map: canvasTex(priceStandCanvas(data.showroom.name, `from ${data.showroom.priceText}`)), toneMapped: false }));
    stand.position.set(X(side, 1.2), PH + 1.15, zc - 3.6);
    stand.rotation.y = facing(side);
    scene.add(stand);
    shopB.box(0.06, 0.9, 0.06, steel, X(side, 1.22), PH + 0.45, zc - 3.6);
    showroom.group.position.set(X(side, 3.4), PH + 0.15, zc + 1.6);
    scene.add(showroom.group);
  }
  // THE DRIP: the boutique (black and gold, a rail of clothes behind the glass, the shop's real tags)
  {
    const s = shopOf("drip");
    const ink = mat("#121212", { roughness: 0.35 });
    shopfront(s.side, s.z, s.width, { paint: ink, sign: signAt({ text: "THE DRIP", board: "#121212", ink: "#e9cf86", serif: true, sub: "MENSWEAR · JEWELLERY · WATCHES" }), doorHalf: s.doorHalf, door: "open", window: ART(boutiqueCanvas()), lamps: true, inside: mat("#efe2cc", { roughness: 0.8 }) });
    data.boutique.forEach((it, i) => {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.27), new THREE.MeshBasicMaterial({ map: canvasTex(tagCanvas(it.name, it.priceText)), toneMapped: false }));
      const e = i === 0 ? -1 : 1;
      tag.position.set(X(s.side, 0.62), PH + 1.05, s.z + e * (s.doorHalf + 0.4 + (s.width / 2 - 0.42 - s.doorHalf - 0.4) / 2));
      tag.rotation.y = facing(s.side);
      scene.add(tag);
    });
  }
  // THE BARBER: shut for now (no barber game yet): "opening soon" on the door, the pole turning
  const pole = { tex: null as any };
  {
    const s = shopOf("barber");
    const red = mat("#7a1c1c", { roughness: 0.45 });
    shopfront(s.side, s.z, s.width, { paint: red, pilaster: mat("#efe6d4", { roughness: 0.6 }), sign: signAt({ text: "BARBER", board: "#7a1c1c", ink: "#f4e3b5", serif: true, sub: "EST. 2026" }), doorHalf: s.doorHalf, door: "shut", window: ART(barberCanvas()), inside: mat("#e9e2d2", { roughness: 0.8 }) });
    const soon = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshBasicMaterial({ map: canvasTex(soonCanvas()), toneMapped: false }));
    soon.position.set(X(s.side, 0.24), PH + 1.75, s.z);
    soon.rotation.y = facing(s.side);
    scene.add(soon);
    // the pole: a striped glass cylinder with brass caps, on a bracket by the door
    const c = document.createElement("canvas"); c.width = 64; c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f8f8f6"; g.fillRect(0, 0, 64, 256);
    for (let k = -4; k < 12; k++) for (const [col, off] of [["#b91c1c", 0], ["#1d3f8a", 32]] as [string, number][]) {
      g.fillStyle = col; g.beginPath();
      g.moveTo(0, k * 64 + off); g.lineTo(64, k * 64 + off + 32); g.lineTo(64, k * 64 + off + 48); g.lineTo(0, k * 64 + off + 16); g.closePath(); g.fill();
    }
    const pt = canvasTex(c, [1, 1.5]);
    pole.tex = pt;
    const pz = s.z + s.width / 2 - 0.65;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.8, 20, 1, true), mat("#ffffff", { map: pt, roughness: 0.3, emissive: "#ffffff", emissiveMap: pt, emissiveIntensity: 0.25 }));
    cyl.position.set(X(s.side, -0.32), PH + 2.4, pz);
    scene.add(cyl);
    const brass = mat("#c9a14f", { roughness: 0.3, metalness: 0.85 });
    for (const dy of [-0.44, 0.44]) shopB.put(new THREE.SphereGeometry(0.11, 14, 10), brass, X(s.side, -0.32), PH + 2.4 + dy, pz);
    shopB.box(0.34, 0.05, 0.05, brass, X(s.side, -0.15), PH + 2.5, pz);
  }
  // the four shops' upper floors over their fronts (building() already drew their bodies: the BLD rows)
  // the fascia atlas: every sign in one picture
  {
    const rows = signs.length, H = 160;
    const atlas = document.createElement("canvas");
    atlas.width = 1024; atlas.height = H * rows;
    const g = atlas.getContext("2d")!;
    signs.forEach((s, i) => { if (s.text) g.drawImage(fasciaCanvas(s.text, s.board, s.ink, { serif: s.serif, sub: s.sub }), 0, i * H); else { g.fillStyle = s.board; g.fillRect(0, i * H, 1024, H); } });
    const at = canvasTex(atlas);
    const signM = mat("#ffffff", { map: at, roughness: 0.5, emissive: "#ffffff", emissiveMap: at, emissiveIntensity: 0.08 });
    const sb = batch(scene, false);
    for (const j of signJobs) {
      const h = 0.72, w = Math.min(j.w, h * 1024 / 160);
      const pg = new THREE.PlaneGeometry(w, h);
      const uv = pg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (j.i + 1 - uv.getY(i)) / rows);
      sb.put(pg, signM, X(j.side, 0.04), 3.45 + PH, j.z, 0, facing(j.side), 0);
    }
    sb.done();
  }
  shopB.done();
  await breathe();

  // ── The north end: a stone building with a clock, across the top of the street ──
  {
    const nb = batch(scene);
    const stone = WALL.stone;
    const NW = 34, NH = 11.5;
    nb.box(NW, NH, 9, stone, 0, NH / 2, NORTH - 4.5);
    nb.box(NW + 0.3, 0.4, 0.5, stoneTrimM, 0, NH - 0.2, NORTH + 0.1);
    nb.box(NW, 0.5, 0.3, stoneTrimM, 0, 4.3, NORTH + 0.1);
    // a pediment over the middle with the clock in it
    const ped = new THREE.Shape();
    ped.moveTo(-6, 0); ped.lineTo(6, 0); ped.lineTo(0, 2.6); ped.closePath();
    nb.put(new THREE.ExtrudeGeometry(ped, { depth: 0.6, bevelEnabled: false }), stone, 0, NH, NORTH - 0.5);
    nb.box(12.6, 0.3, 0.8, stoneTrimM, 0, NH + 0.1, NORTH - 0.1);
    // six columns and a run of steps
    for (let k = 0; k < 6; k++) {
      const x = -5 + k * 2;
      nb.put(new THREE.CylinderGeometry(0.32, 0.36, 4.0, 18), stoneTrimM, x, 0.5 + 2.0 + PH, NORTH + 1.2);
      nb.box(0.85, 0.25, 0.85, stoneTrimM, x, PH + 0.5 + 0.12, NORTH + 1.2);
      nb.box(0.8, 0.22, 0.8, stoneTrimM, x, PH + 4.5 + 0.11, NORTH + 1.2);
    }
    nb.box(11.4, 0.5, 2.4, stone, 0, PH + 4.6 + 0.25, NORTH + 1.0);
    for (let k = 0; k < 3; k++) nb.box(12 - k * 0.5, 0.17, 1.2 - k * 0.35, stoneTrimM, 0, PH + 0.08 + k * 0.17, NORTH + 2.4 - k * 0.35);
    nb.box(2.0, 3.2, 0.1, mat("#3b2416", { roughness: 0.5 }), 0, PH + 0.5 + 1.6, NORTH + 0.04);
    for (const x of [-3, 3]) nb.box(1.4, 2.4, 0.06, winM, x, PH + 0.5 + 1.6, NORTH + 0.03);
    for (const x of [-14, -11, -8, 8, 11, 14]) { nb.box(0.06, 2.2, 1.2, winM, x, 7.4, NORTH + 0.03); nb.box(0.06, 1.6, 1.2, winM, x, 2.4, NORTH + 0.03); }
    for (const x of [-14, -11, -8, 8, 11, 14]) { nb.box(1.4, 0.12, 0.2, stoneTrimM, x, 6.2, NORTH + 0.1); }
    for (const x of [-5, -3, -1, 1, 3, 5]) nb.box(1.0, 2.4, 0.06, winM, x, 7.6, NORTH - 0.01 + 0.04);
    nb.done();
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.85, 40), mat("#ffffff", { map: canvasTex(clockCanvas()), roughness: 0.6 }));
    clock.position.set(0, NH + 1.0, NORTH + 0.12);
    scene.add(clock);
  }
  // ── The south end: the lane to your garden (hedges, a low wall, a fingerpost) ──
  {
    const lb = batch(scene);
    const hedgeM = tileMat(hedgeCanvas(), 1.6, 1.6, { roughness: 0.95 });
    const wallM = WALL.stock;
    for (const side of [-1, 1]) {
      lb.box(0.5, 0.8, 22, wallM, side * (ROAD + 2.1), PH + 0.4, SOUTH + 1.5 + 11);
      lb.box(0.62, 0.08, 22, stoneTrimM, side * (ROAD + 2.1), PH + 0.84, SOUTH + 1.5 + 11);
      lb.box(1.1, 1.8, 22, hedgeM, side * (ROAD + 3.0), PH + 0.9, SOUTH + 1.5 + 11);
    }
    // the fingerpost
    const fp = { x: -(FRONT - 0.7), z: SOUTH + 0.1 };
    lb.put(new THREE.CylinderGeometry(0.07, 0.08, 3.0, 12), mat("#1f3d2c", { roughness: 0.5 }), fp.x, PH + 1.5, fp.z);
    lb.put(new THREE.SphereGeometry(0.1, 12, 8), mat("#c9a14f", { roughness: 0.3, metalness: 0.8 }), fp.x, PH + 3.05, fp.z);
    lb.done();
    const armM = (t: string, left = false) => new THREE.MeshStandardMaterial({ map: canvasTex(fingerCanvas(t, left)), roughness: 0.6, side: THREE.DoubleSide });
    // both arms face the street (east); the plane's right end is north, so the south arm points left
    const a1 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), armM("YOUR GARDEN", true));
    a1.position.set(fp.x, PH + 2.55, fp.z + 0.55); a1.rotation.y = Math.PI / 2; // pointing south
    scene.add(a1);
    const a2 = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), armM("HIGH STREET"));
    a2.position.set(fp.x, PH + 2.2, fp.z - 0.55); a2.rotation.y = Math.PI / 2; // pointing north
    scene.add(a2);
    SOLIDS.push([fp.x - 0.12, fp.x + 0.12, fp.z - 0.12, fp.z + 0.12]);
    // the street's name plate on the first building
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshStandardMaterial({ map: canvasTex(namePlateCanvas("HIGH STREET", "KIB 1")), roughness: 0.5 }));
    plate.position.set(X(-1, W0 - FRONT - 0.02), 3.0 + PH + 1.4, 20.5);
    plate.rotation.y = facing(-1);
    scene.add(plate);
  }
  await breathe();

  // ── Street furniture: lamps, benches, bins, bollards, the zebra's beacons, bunting ──
  const furn = batch(scene);
  const ironM = mat("#1d2024", { roughness: 0.45, metalness: 0.55 });
  const lampGlowM = glow("#ffd59a", 1.4);
  for (const [x, z] of LAMPS) {
    furn.put(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 12), ironM, x, PH + 0.25, z);
    furn.put(new THREE.CylinderGeometry(0.06, 0.09, 4.2, 10), ironM, x, PH + 2.3, z);
    // the arm out over the pavement and the lantern on it
    const ox = -Math.sign(x) * 0.42;
    furn.box(0.84, 0.05, 0.05, ironM, x + ox / 2, PH + 4.25, z);
    furn.box(0.34, 0.07, 0.34, ironM, x + ox, PH + 4.2, z);
    furn.box(0.24, 0.32, 0.24, lampGlowM, x + ox, PH + 4.0, z);
    furn.put(new THREE.ConeGeometry(0.26, 0.2, 4), ironM, x + ox, PH + 4.34, z, 0, Math.PI / 4);
    // a hanging basket of flowers on the post
    furn.put(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat("#3b2a1e"), x, PH + 3.2, z);
    furn.put(new THREE.IcosahedronGeometry(0.36, 1), mat("#3f7d34", { roughness: 0.9, flatShading: true }), x, PH + 3.25, z, 0, 0, 0, 1, 0.6, 1);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, rr = 0.3;
      furn.put(new THREE.IcosahedronGeometry(0.06, 0), mat(["#ff5a6e", "#ffd23f", "#b47cff", "#ffffff"][k % 4], { roughness: 0.6, emissive: ["#ff5a6e", "#ffd23f", "#b47cff", "#ffffff"][k % 4], emissiveIntensity: 0.1 }), x + Math.cos(a) * rr, PH + 3.2 + (k % 3) * 0.07, z + Math.sin(a) * rr);
    }
  }
  // tree pits: a dark iron grate round each trunk
  for (const [x, z] of TREES) furn.box(1.1, 0.02, 1.1, mat("#2a2a2a", { roughness: 0.7, metalness: 0.4 }), x, PH + 0.01, z);
  // benches: wooden slats on iron ends
  const woodM = mat("#8a6142", { roughness: 0.7 });
  for (const [x, z, ry] of BENCHES) {
    const fx = Math.sin(ry), fz = Math.cos(ry);
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.09), woodM); sl.position.set(0, 0.45, -0.16 + k * 0.11); g.add(sl); }
    for (let k = 0; k < 3; k++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 0.04), woodM); sl.position.set(0, 0.62 + k * 0.13, -0.24); sl.rotation.x = -0.15; g.add(sl); }
    for (const e of [-0.78, 0.78]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.48), ironM); leg.position.set(e, 0.225, 0); g.add(leg); const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), ironM); back.position.set(e, 0.68, -0.25); g.add(back); }
    g.position.set(x, PH, z);
    g.rotation.y = Math.atan2(fx, fz);
    g.updateMatrixWorld(true);
    g.traverse((o: any) => { if (o.isMesh) { const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); furn.put(geo, o.material, 0, 0, 0); } });
  }
  // bins beside each bench, bollards at the zebra, a red pillar box
  const goldBandM = mat("#c9a14f", { roughness: 0.3, metalness: 0.85 });
  for (const [x, z] of BENCHES) {
    const bz = z + 1.25;
    furn.put(new THREE.CylinderGeometry(0.24, 0.22, 0.85, 14), ironM, x, PH + 0.43, bz);
    furn.put(new THREE.CylinderGeometry(0.245, 0.245, 0.05, 14), goldBandM, x, PH + 0.7, bz);
    SOLIDS.push([x - 0.26, x + 0.26, bz - 0.26, bz + 0.26]);
  }
  for (const side of [-1, 1]) for (const e of [-1.6, 1.6]) {
    const x = side * (ROAD + 0.3), z = ZEBRA_Z + e;
    furn.put(new THREE.CylinderGeometry(0.08, 0.1, 0.9, 10), ironM, x, PH + 0.45, z);
    furn.put(new THREE.SphereGeometry(0.09, 10, 6), ironM, x, PH + 0.92, z);
  }
  const beacons: any[] = [];
  for (const side of [-1, 1]) {
    const bx = side * (ROAD + 0.45), bz = ZEBRA_Z + 1.55 * -side;
    // a black and white striped pole and its amber globe
    for (let k = 0; k < 8; k++) furn.put(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), k % 2 ? mat("#f4f4f0") : blackM, bx, PH + 0.15 + k * 0.3, bz);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), new THREE.MeshStandardMaterial({ color: "#ffb43a", emissive: "#ff9a1a", emissiveIntensity: 1.2, roughness: 0.3 }));
    globe.position.set(bx, PH + 2.6, bz);
    scene.add(globe);
    beacons.push(globe);
    SOLIDS.push([bx - 0.1, bx + 0.1, bz - 0.1, bz + 0.1]);
  }
  {
    const pb = { x: FRONT - 0.75 - 0.2, z: 3.6 };
    furn.put(new THREE.CylinderGeometry(0.28, 0.3, 1.35, 20), mat("#b3171d", { roughness: 0.4 }), pb.x, PH + 0.68, pb.z);
    furn.put(new THREE.SphereGeometry(0.29, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat("#b3171d", { roughness: 0.4 }), pb.x, PH + 1.35, pb.z);
    furn.box(0.04, 0.06, 0.3, blackM, pb.x - 0.29, PH + 1.1, pb.z);
    SOLIDS.push([pb.x - 0.32, pb.x + 0.32, pb.z - 0.32, pb.z + 0.32]);
  }
  furn.done();
  // bunting across the street: three strings of little flags, one draw
  {
    const pos: number[] = [], col: number[] = [];
    const C = ["#e63946", "#f1faee", "#1d4ed8", "#ffd23f", "#16a34a"].map((c) => new THREE.Color(c));
    for (const zc of [-16.5, -1.8, 12.6]) {
      const n = 22;
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 0.8) / n;
        const xa = -W0 + t0 * W0 * 2, xb = -W0 + t1 * W0 * 2;
        const sag = (t: number) => 6.4 - 1.1 * Math.sin(Math.PI * t);
        const ya = sag(t0), yb = sag(t1), xm = (xa + xb) / 2, ym = Math.min(ya, yb) - 0.32;
        pos.push(xa, ya, zc, xb, yb, zc, xm, ym, zc);
        const c = C[k % C.length];
        for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const bunt = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }));
    scene.add(bunt);
    const lineG = new THREE.BufferGeometry();
    const lp: number[] = [];
    for (const zc of [-16.5, -1.8, 12.6]) for (let k = 0; k < 40; k++) { const t0 = k / 40, t1 = (k + 1) / 40; lp.push(-W0 + t0 * W0 * 2, 6.4 - 1.1 * Math.sin(Math.PI * t0), zc, -W0 + t1 * W0 * 2, 6.4 - 1.1 * Math.sin(Math.PI * t1), zc); }
    lineG.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
    scene.add(new THREE.LineSegments(lineG, new THREE.LineBasicMaterial({ color: "#3a3a3a" })));
  }
  bodyB.done();
  await breathe();

  // ── Trees: textured trees in the pavement, and a tall line beyond the roofs ──
  const cardAtlas = await loadCardAtlas(THREE, renderer).catch((e) => { console.error("street tree atlas", e); return null; });
  if (disposed || gone()) throw abandonedSceneError();
  const trees: TreeAt[] = [];
  let ts = 0;
  for (const [x, z] of TREES) trees.push({ x, z, s: 3.4, ry: ts * 1.3, h: 1.7, w: 1.25, shape: "round", seed: 211 + 31 * ts++, light: "#6e9a3e", dark: "#28501f", tint: "#afcf88" });
  // beyond the roofs: tall trees behind each terrace, and round the lane south
  for (let k = 0; k < 10; k++) for (const side of [-1, 1]) trees.push({ x: side * (FRONT + DEPTH + 3 + (k % 3) * 2.5), z: NORTH + 2 + k * 5.2, s: 5.6 + (k % 4) * 0.6, ry: k, h: 1.7, w: 1.25, shape: k % 3 === 0 ? "tall" : "round", seed: 401 + k * 17 + (side > 0 ? 5 : 0), light: "#6e9a3e", dark: "#28501f", tint: "#b8d894" });
  for (let k = 0; k < 6; k++) for (const side of [-1, 1]) trees.push({ x: side * (ROAD + 6 + (k % 2) * 3), z: SOUTH + 5 + k * 4, s: 4.6 + (k % 3) * 0.5, ry: k * 2, h: 1.7, w: 1.25, shape: "round", seed: 701 + k * 13 + (side > 0 ? 3 : 0), tint: "#afcf88" });
  for (const x of [-12, -6, 0, 6, 12]) trees.push({ x, z: NORTH - 12, s: 6.0, ry: x, h: 1.7, w: 1.25, shape: "tall", seed: 901 + x, tint: "#c8e2a0" });
  const bushes: BushAt[] = [];
  const plants = buildPlantZones(THREE, trees, bushes, cardAtlas ? { style: "cards", cardMaterial: cardMaterial(THREE, cardAtlas.map, cardAtlas.nrm) } : { style: "clump" });
  plants.group.position.y = 0;
  // the street trees stand on the raised pavement
  scene.add(plants.group);
  await breathe();

  // ── Loading the people and the cars ──
  const loader = new GLTFLoader();
  await withMeshopt(loader);
  const load = (url: string) => loadGltfCached(loader, url);
  const walkers = Math.max(0, Math.min(6, opts.walkers ?? (Number(dbg.get("walkers")) || ({ low: 1, medium: 3, high: 5 } as Record<Quality3d, number>)[tier])));
  const PR = await import("../people/presets");
  const looks = PR.castScene(Array.from({ length: walkers }, (_, i) => ({ id: `street-walker-${i}`, role: (i % 3 === 2 ? "fan" : "player") as any, club: "Arsenal" })));
  const heads = Array.from(new Set(looks.map((l: any) => l.head)));
  const [charG, animG, footG] = await Promise.all([
    walkers ? loadPeople3d(loader, "player", people3dLook(), heads as any) : Promise.resolve(null),
    loadPeople3d(loader, "anims", people3dLook()),
    loadAnims3d(loader, "football"),
  ]);
  if (disposed || gone()) throw abandonedSceneError();

  // you: the wardrobe's outfit, as the house and the garden dress you (home3d/wear.ts)
  const { buildWearer } = await import("../home3d/wear");
  const person: Person3D = await buildWearer(THREE, SkeletonUtils, loader, {
    worn: data.worn, kits: data.kits, number: data.worn.kind === "kit" ? canvasTex(numberCanvas(data.number, "#ffffff")) : null,
    skin: data.player.skin, hair: data.player.hair, hairStyle: data.player.hairStyle,
    outline: prof.outlines ? 0.006 : 0, castShadow: true,
  });
  if (disposed || gone()) throw abandonedSceneError();
  const player = person.root;
  const mixer = person.mixer;
  const idleA = person.actions.idle;
  const walkA = mixer.clipAction(makeWalkClip(THREE, person.actions.jog.getClip(), person.actions.idle.getClip()));
  walkA.play();
  const jogA = person.actions.jog;
  for (const a of [idleA, walkA, jogA]) a.setEffectiveWeight(0);
  idleA.setEffectiveWeight(1);
  const st0 = arrivalOf(data.arrive);
  player.position.set(st0[0], PH, st0[1]);
  player.rotation.y = st0[2];
  scene.add(player);
  const playerBlob = blob(0.9, 0.9, st0[0], st0[1], 0.85);
  playerBlob.position.y = PH + 0.012;
  let gaitBlend: GaitBlend | null = null;
  strideFor(THREE, person, mixer, { idle: idleA, walk: walkA, jog: jogA }).then((g) => { if (!disposed) gaitBlend = g; }).catch((e) => console.error("street gait clips", e));
  await breathe();

  // the people walking: world-kit people (world3d/npc.ts), each his own look, in their own clothes
  const npcs: Npc[] = [];
  const npcBlobs: any[] = [];
  const walkInfo = clipInfo(footG, "walk");
  const FI = walkers ? await import("../style3d/toon/faceIdApply") : null;
  const FACE = walkers ? await import("../style3d/toon/face") : null;
  const HAIR = walkers ? await import("../style3d/toon/hair") : null;
  const hairs: any[] = [];
  for (let i = 0; i < walkers; i++) {
    await breathe();
    const L: any = looks[i];
    const id = L.id;
    const p: Person3D = makePerson3d(THREE, SK, charG as any, animG, { outline: prof.outlines ? 0.006 : 0, castShadow: tier === "high", who: id, toonHead: L.head, toonBody: L.build } as any);
    dressPerson3d(THREE, p, { ...L.dress, kit: { ...(L.kit ?? {}), ...data.kits.home }, number: null } as any);
    const ow = offPitchWear(id, "family", data.kits.home);
    dressCloth(THREE, p, ow.kind, id, { colours: ow.colours, whiteBalance: HOME_WB });
    FI!.applyToonFaceId(THREE, p, L.faceId, { detail: FI!.FACE_DETAIL[tier] });
    const rig = FACE!.addToonFace(THREE, p);
    rig?.set({ face: FACE!.toonFaceFor({}), blink: 0 });
    if (L.hairMesh) { const h = await HAIR!.wearToonHair(THREE, loader, p, L.hairMesh, { outline: prof.outlines ? 0.0045 : 0 }).catch(() => null); if (h) hairs.push(h); }
    relaxHands(THREE, p);
    addClips(THREE, p, footG);
    const hipsRest = p.rest.get(p.bones.Hips)?.[0].y ?? p.bones.Hips.position.y;
    const hy = (footG.scene?.userData as any)?.hipsY as number | undefined;
    const size = hy ? hipsRest / hy : 1;
    const n = new Npc(THREE, p, { id: `walker-${i}`, loco: walkInfo?.speed ? [{ name: "walk", speed: walkInfo.speed * size }] : [{ name: "walk", speed: 1.25 }] });
    p.root.position.y = PH;
    scene.add(p.root);
    npcs.push(n);
    const b = blob(0.85, 0.85, 0, 0, 0.6);
    b.position.y = PH + 0.011;
    npcBlobs.push(b);
  }
  if (disposed || gone()) throw abandonedSceneError();

  // the parked cars and the showroom's car: the shop's own car models (the house drive's light copies)
  const carRoots: any[] = [];
  const fitCar = (root: any, len: number) => {
    root.updateMatrixWorld(true);
    let b = new THREE.Box3().setFromObject(root);
    const sz = b.getSize(new THREE.Vector3());
    if (sz.x > sz.z) root.rotation.y = Math.PI / 2; // long side along z
    root.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(root);
    root.scale.multiplyScalar(len / Math.max(b.max.z - b.min.z, 1e-3));
    root.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(root);
    const c = b.getCenter(new THREE.Vector3());
    root.position.x -= c.x; root.position.z -= c.z; root.position.y -= b.min.y;
  };
  const carJobs = [...PARKED.map((c) => ({ ...c, show: false })), { id: data.showroom.id, x: 0, z: 0, ry: 0, show: true }];
  await Promise.all(carJobs.map((c) => {
    const url = CAR_LOD[c.id];
    if (!url) return Promise.resolve();
    return load(url).then((g: any) => {
      if (disposed) return;
      const holder = new THREE.Group();
      const root = g.scene.clone(true);
      root.traverse((o: any) => { if (o.isMesh) { o.castShadow = !c.show; o.receiveShadow = true; if (o.material) o.material = carPaint(o.material, envTex); } });
      fitCar(root, CAR_LENGTH[c.id] ?? 4.4);
      holder.add(root);
      if (c.show) { showroom.group.add(holder); showroom.car = holder; holder.rotation.y = 0.6; }
      else {
        holder.position.set(c.x, 0, c.z);
        holder.rotation.y = c.ry;
        scene.add(holder);
        blob(2.3, 4.9, c.x, c.z, 0.8).position.y = 0.011;
        carRoots.push(holder);
      }
    }).catch((e: any) => console.error("street car", c.id, e));
  }));
  if (disposed || gone()) throw abandonedSceneError();

  // ── The walk: you (stick, keys, tap) and the people (their own grid: pavements and the zebra) ──
  const RR = BODY;
  const isFreeYou = (x: number, z: number) => streetFree(x, z, RR + 0.06);
  function streetFree(x: number, z: number, r: number) {
    const [x0, x1, z0, z1] = WALK_BOX;
    if (x < x0 - BODY + r || x > x1 + BODY - r || z < z0 - BODY + r || z > z1) return false;
    for (const [a, b, c, d] of SOLIDS) if (x > a - r && x < b + r && z > c - r && z < d + r) return false;
    return true;
  }
  const youGrid: WalkGrid = buildGrid(WALK_BOX[0], WALK_BOX[1], WALK_BOX[2], WALK_BOX[3], 0.3, isFreeYou);
  // the people: the pavements, and the road only on the zebra (plan.ts walkerFree, with every solid here)
  const npcGrid: WalkGrid = buildGrid(WALK_BOX[0], WALK_BOX[1], WALK_BOX[2], SOUTH - 0.5, 0.25, (x, z) => walkerFree(x, z, SOLIDS));
  const youBody = (): Body => ({ id: "you", x: player.position.x, z: player.position.z, r: BODY });
  const world: NpcWorld = {
    grid: npcGrid, book: new SlotBook(),
    bodies: () => [youBody(), ...npcs.filter((n) => n.root.visible).map((n) => { const [x, z] = n.bodyXZ(); return { id: n.id, x, z, r: BODY_R }; })],
  };
  // each walker: a seeded wander between the walk points; a road crossing goes by the zebra; now and then a look in a window
  const PTS = walkPoints();
  let wseed = 20261128;
  const wr = () => { wseed = (wseed * 16807) % 2147483647; return wseed / 2147483647; };
  const plan: { route: XZ[]; wait: number; look: number | null }[] = npcs.map(() => ({ route: [], wait: 0, look: null }));
  const STARTS: [number, number, number][] = [[5.7, -14, 0], [-5.7, -2, Math.PI], [5.7, 13.5, Math.PI], [-5.7, -20, 0], [-5.7, 17, Math.PI], [5.7, -0.5, 0]];
  npcs.forEach((n, i) => { const s = STARTS[i % STARTS.length]; n.place(s[0], s[1], s[2]); });
  const nextRoute = (n: Npc, i: number) => {
    const from: XZ = [n.x, n.z];
    let to = PTS[Math.floor(wr() * PTS.length)];
    for (let k = 0; k < 6 && Math.hypot(to[0] - from[0], to[1] - from[1]) < 6; k++) to = PTS[Math.floor(wr() * PTS.length)];
    const route: XZ[] = [];
    if (crossesRoad(from[0], to[0])) route.push([Math.sign(from[0]) * (ROAD + 0.7), ZEBRA_Z], [Math.sign(to[0]) * (ROAD + 0.7), ZEBRA_Z]);
    route.push([to[0], to[1]]);
    plan[i].route = route;
    // at a shop window: stop and look for a few seconds
    const atWindow = Math.abs(to[0]) > FRONT - 1.3;
    plan[i].look = atWindow ? (to[0] > 0 ? Math.PI / 2 : -Math.PI / 2) : null;
  };
  const stepNpcs = (dt: number) => {
    npcs.forEach((n, i) => {
      const P = plan[i];
      if (n.state === "stand") {
        if (P.wait > 0) { P.wait -= dt; return; }
        if (!P.route.length) nextRoute(n, i);
        const tgt = P.route.shift()!;
        const last = !P.route.length;
        const ok = n.walkTo(world, tgt, {
          onArrive: () => {
            if (!last) return;
            if (P.look !== null) { n.face(P.look); P.wait = 3 + wr() * 4; } else P.wait = wr() < 0.3 ? 1 + wr() * 2 : 0;
          },
        });
        if (!ok) { P.route = []; P.wait = 0.5; }
      }
    });
  };

  // ── Input, camera ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0, yaw = st0[2], camYaw = st0[2] + Math.PI, orbitHold = 0;
  const yawTurn = { yaw: 0, vel: 0 };
  const orb = new OrbitCam();
  const zoom = new FollowZoom(loadFollowZoom());
  const CS: FollowCam = zoomedFollowCam(zoom.now, FOLLOW_CAM_D);
  const detachZoom = attachFollowZoom(container, zoom);
  const carry = new FollowCarry();
  const view = new ViewCam(opts.fixedStep ? "third" : loadViewMode());
  const viewHead = new THREE.Vector3();
  let headBone: any = null, seenWas = true;
  let near: StreetDoor | "lane" | null = null;
  let doorFired = false, knocked: StreetDoor | null = null, leftFired = false;
  const walker = new TapWalker();
  const markerG = new THREE.Group();
  scene.add(markerG);
  const marker = makeTapMarker(THREE, markerG);
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
  let baseFov = 54;
  const resize = () => {
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.7 ? CS.fov : 54;
    baseFov = camera.fov;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

  /** Where he may stand after a step (the fronts, the doors, the solids, the people). */
  const collide = (x: number, z: number): [number, number] => {
    const d = doorwayAt(x, z);
    if (d) {
      if (d.opens) {
        if (!doorFired && throughDoor(d, x)) { doorFired = true; cb.onDoor(d.id); }
        x = d.side * Math.min(d.side * x, FRONT + DOOR_RECESS);
        if (d.side * x > FRONT - RR) z = Math.max(d.z - d.doorHalf + RR, Math.min(d.z + d.doorHalf - RR, z));
        return [x, z];
      }
      if (throughDoor(d, x) && knocked !== d.id) { knocked = d.id; cb.onDoor(d.id); }
    }
    if (knocked && (Math.abs(z - shopOf(knocked).z) > 2 || shopOf(knocked).side * x < FRONT - 2.2)) knocked = null;
    if (cb.onLeave && leftSouth(z)) { if (!leftFired) { leftFired = true; cb.onLeave(); } }
    const [x0, x1, z0, z1] = WALK_BOX;
    x = Math.max(x0, Math.min(x1, x));
    z = Math.max(z0, Math.min(z1 + (cb.onLeave ? 0.4 : 0), z));
    for (const [a, b, c, e] of SOLIDS) {
      if (x > a - RR && x < b + RR && z > c - RR && z < e + RR) {
        const push = [x - (a - RR), b + RR - x, z - (c - RR), e + RR - z];
        const m = Math.min(...push);
        if (m === push[0]) x = a - RR; else if (m === push[1]) x = b + RR; else if (m === push[2]) z = c - RR; else z = e + RR;
      }
    }
    // the people: never through anybody (the same spacing the world kit keeps between bodies)
    for (const n of npcs) {
      if (!n.root.visible) continue;
      const [nx, nz] = n.bodyXZ();
      const dx = x - nx, dz = z - nz, dd = Math.hypot(dx, dz), min = RR + BODY_R;
      if (dd < min && dd > 1e-6) { x = nx + (dx / dd) * min; z = nz + (dz / dd) * min; }
    }
    return [x, z];
  };
  const walkTo = (to: XZ, face: XZ | null) => {
    const path = findPath(youGrid, [player.position.x, player.position.z], to);
    if (!path) return false;
    faceTo = null;
    walker.go(path, { onArrive: () => { marker.fade(); faceTo = face; } });
    const g = path[path.length - 1];
    marker.show(g[0], g[1], Math.abs(g[0]) < ROAD ? 0.04 : PH + 0.04);
    orbitHold = 0;
    return true;
  };
  /** How far the camera can stand back along (dx, dz) inside the street (the fronts, the north end). */
  const roomBack = (px: number, pz: number, dx: number, dz: number) => boxRoom(px, pz, dx, dz, -W0 + 0.25, W0 - 0.25, NORTH + 0.4, SOUTH + 20);
  /** A tree crown on the camera's line (only where its leaves are), or Infinity. */
  const treeHit = (px: number, pz: number, ux: number, uz: number, L: number, camY: number) => {
    let t = Infinity;
    for (const o of occluders) {
      if (camY < o.y0 - 0.3) continue;
      const fx = px - o.x, fz = pz - o.z;
      const b = fx * ux + fz * uz, c = fx * fx + fz * fz - o.r * o.r;
      const disc = b * b - c;
      if (disc < 0) continue;
      const tt = -b - Math.sqrt(disc);
      if (tt > 0.6 && tt < L) t = Math.min(t, tt);
    }
    return t;
  };

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let first = true;
  const v3 = new THREE.Vector3();
  const frustum = new THREE.Frustum(), projM = new THREE.Matrix4(), sph = new THREE.Sphere();
  const inView = (x: number, y: number, z: number, r: number) => frustum.intersectsSphere(sph.set(v3.set(x, y, z), r));
  let acc = 0, busy = true, busyT = 0, stillT = 0, shadowRenders = 0, drawn = 0, gameT = 0;
  let lastShadowX = NaN, lastShadowZ = NaN, lastShadowYaw = NaN, shadowDirty = true;
  let capAlways = false;
  let testCam: [[number, number, number], [number, number, number]] | null = null;
  const stepDown = (): boolean => {
    const next = stepDownTier(tier);
    if (!next) return false;
    tier = next; prof = TIER_PROFILES[tier];
    dyn = makeDyn(); dynPR = Math.min(dpr, prof.movePixelRatio);
    pr = stillPR(); renderer.setPixelRatio(pr);
    if (!prof.shadows) { sun.castShadow = false; renderer.shadowMap.enabled = false; }
    else {
      const n = shadowSizeFor(prof, SUN_MAP);
      if (n !== sun.shadow.mapSize.x) { sun.shadow.map?.dispose(); sun.shadow.map = null; sun.shadow.mapSize.set(n, n); shadowDirty = true; }
    }
    if (!prof.outlines) person.outline && (person.outline.visible = false);
    resize();
    return true;
  };

  // join the still pieces by material (one draw each), keep what moves apart
  const keep = new Set<any>([player, playerBlob, dome, sunSprite, plants.group, showroom.group, markerG, ...npcs.map((n) => n.root), ...npcBlobs, ...beacons, ...carRoots, ...clouds].filter(Boolean));
  scene.traverse((o: any) => { if (o.isMesh && o.material?.map === pole.tex) keep.add(o); });
  const frozen = dbg.has("nofreeze") ? { before: 0, after: 0 } : freezeStatic(THREE, mergeGeometries, scene, keep);
  camera.position.set(player.position.x, 3, player.position.z + 5);
  camera.lookAt(player.position.x, 1.3, player.position.z);
  const savings = sceneSavings(THREE, renderer, scene);
  const cull = tightCull(THREE, scene, renderer, { moving: keep });
  try { await (hEnh ? hEnh.compile(scene, camera) : safeCompileAsync(renderer, scene, camera)); } catch { /* compiled on first use */ }
  if (disposed || gone()) throw abandonedSceneError();

  const frame = () => {
    if (disposed) return;
    const raw = Math.min(0.25, clock.getDelta());
    let dt: number;
    if (opts.fixedStep) dt = opts.fixedStep;
    else {
      acc += raw;
      const cap = busy && !capAlways ? prof.fpsCap : prof.stillFps;
      govCap = cap;
      if (cap < 60 && acc < 1 / (cap + 1)) return;
      dt = Math.min(0.05, acc);
      gov.frame(performance.now(), govCap);
      acc = 0;
    }
    gameT += dt;
    let ix = stick.x, iy = stick.y;
    if (keys.size) {
      ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      iy = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const m = Math.hypot(ix, iy) || 1;
      const runK = keys.has("shift") ? 1 : gaitBlend ? 0.4 : 0.6;
      ix = (ix / m) * runK; iy = (iy / m) * runK;
    }
    let mag = Math.min(1, Math.hypot(ix, iy));
    let wantYaw: number | null = null;
    if (mag >= 0.08) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      wantYaw = Math.atan2(fx * iy + rx * ix, fz * iy + rz * ix);
    } else if (walker.active) {
      const s = walker.step(player.position.x, player.position.z, dt);
      if (s) { wantYaw = s.yaw; mag = s.push * Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(angDiff(yaw, s.yaw))))); }
      else if (!walker.active && marker.visible) marker.fade();
    }
    if (gaitBlend) speed = approach(speed, stickTarget(mag, keys.has("shift"), STROLL_SPEEDS), dt, STROLL_SPEEDS);
    else { const target = mag < 0.08 ? 0 : 1.55 * Math.min(1, mag / 0.75) + (mag > 0.75 ? (mag - 0.75) * 8 : 0); speed += (target - speed) * Math.min(1, dt * 8); }
    if (wantYaw !== null) yaw = turnTo(yawTurn, yaw, wantYaw, dt);
    else if (faceTo && speed < 0.4) {
      const d = angDiff(yaw, Math.atan2(faceTo[0] - player.position.x, faceTo[1] - player.position.z));
      yaw += d * Math.min(1, dt * 5);
      if (Math.abs(d) < 0.03) faceTo = null;
    }
    const [nx, nz] = collide(player.position.x + Math.sin(yaw) * speed * dt, player.position.z + Math.cos(yaw) * speed * dt);
    player.position.x = nx; player.position.z = nz;
    // off the pavement onto the road: down the kerb (12 cm), eased
    const wantY = Math.abs(nx) < ROAD + 0.05 ? 0 : PH;
    player.position.y += (wantY - player.position.y) * Math.min(1, dt * 14);
    player.rotation.y = yaw;
    playerBlob.position.set(nx, player.position.y + 0.012, nz);
    marker.update(dt);
    if (gaitBlend) gaitBlend.update(speed, dt);
    else {
      const wW = Math.min(1, speed / 1.55), wJ = Math.max(0, Math.min(1, (speed - 1.55) / 2));
      idleA.setEffectiveWeight(Math.max(0, 1 - wW)); walkA.setEffectiveWeight(wW * (1 - wJ)); jogA.setEffectiveWeight(wJ);
      const ts = Math.max(0.5, speed / (1.7 + 1.3 * wJ)); walkA.timeScale = ts; jogA.timeScale = ts;
    }
    mixer.update(dt);

    // the people
    stepNpcs(dt);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    npcs.forEach((n, i) => {
      const [x, z] = n.bodyXZ();
      const seen = inView(x, 1, z, 1.2);
      n.update(dt, world, seen);
      n.root.position.y = Math.abs(n.x) < ROAD + 0.05 ? 0 : PH;
      npcBlobs[i].position.set(x, n.root.position.y + 0.011, z);
    });
    for (const h of hairs) h.update?.(dt);
    // the beacons blink (about once a second), the barber's pole turns, the showroom's car turns slowly
    const on = Math.floor(gameT * 1.6) % 2 === 0;
    for (const b of beacons) b.material.emissiveIntensity = on ? 1.6 : 0.15;
    if (pole.tex) pole.tex.offset.y = (gameT * 0.35) % 1;
    if (showroom.car) showroom.car.rotation.y = 0.6 + gameT * 0.18;
    clouds.forEach((c, i) => { c.position.x += Math.sin(i) * dt * 0.2; });

    // camera D behind him; kept inside the street and out of the tree crowns
    zoom.step(dt);
    zoomedFollowCam(zoom.now, FOLLOW_CAM_D, CS);
    if (container.clientWidth / (container.clientHeight || 1) < 0.7 && Math.abs(camera.fov - CS.fov) > 1e-3) { camera.fov = baseFov = CS.fov; camera.updateProjectionMatrix(); }
    camYaw += orb.step(dt);
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) {
      const rb = roomBack(player.position.x, player.position.z, Math.sin(camYaw), Math.cos(camYaw));
      const toCam = rb < CS.back * 0.6 ? 0 : Math.max(0, Math.min(1, (Math.cos(angDiff(yaw, camYaw)) - 0.3) / 0.5));
      camYaw += angDiff(camYaw, yaw + Math.PI) * Math.min(1, dt * CS.yawK) * (1 - toCam);
    }
    const cfx = -Math.sin(camYaw), cfz = -Math.cos(camYaw);
    const [camUp, camBack] = orb.lift(CS.height, CS.back, CS.lookY);
    const py = player.position.y;
    want.set(player.position.x - cfx * camBack, camUp + py, player.position.z - cfz * camBack);
    wantLook.set(player.position.x + cfx * CS.lookAhead, CS.lookY + py, player.position.z + cfz * CS.lookAhead);
    {
      const hx = player.position.x, hz = player.position.z;
      const sx = want.x - hx, sz = want.z - hz, L = Math.hypot(sx, sz) || 1, ux = sx / L, uz = sz / L;
      let boom = L;
      const tw = roomBack(hx, hz, ux, uz);
      if (tw < boom) boom = Math.max(0.9, tw);
      const tt = treeHit(hx, hz, ux, uz, boom, want.y);
      if (tt < boom) boom = Math.max(1.2, tt - 0.2);
      if (boom < L) {
        want.x = hx + ux * boom; want.z = hz + uz * boom;
        want.y = riseForMin(boom, Math.max(CAM_MIN_Y + py, camUp + py - 0.75 * Math.max(0, Math.min(1, (L - boom) / 4))));
      }
    }
    const camWas = camPos.clone();
    carry.step(player.position.x, player.position.z, camPos, camLook, !first && !testCam);
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; shadowDirty = true; }
    else { camPos.lerp(want, Math.min(1, dt * 5)); camLook.lerp(wantLook, Math.min(1, dt * 6)); }
    // never eased out past a front
    camPos.x = Math.max(-W0 + 0.2, Math.min(W0 - 0.2, camPos.x));
    if (camPos.z < NORTH + 0.3) camPos.z = NORTH + 0.3;
    view.step(dt);
    headBone ??= findHeadBone(player);
    const seen = view.place(camera, camPos, camLook, headWorld(headBone, player, viewHead), -Math.sin(camYaw), -Math.cos(camYaw), 99, dt);
    if (seen !== seenWas) { seenWas = seen; showBody(player, seen); playerBlob.visible = seen; shadowDirty = true; }
    if (testCam) { camera.position.set(...testCam[0]); camera.lookAt(...testCam[1]); }
    fillLight.position.set(camPos.x * 0.6 + player.position.x * 0.4, 2.6, camPos.z * 0.6 + player.position.z * 0.4);
    camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(projM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    plants.update(camera, tier);

    // which door you are at (its card)
    let now: StreetDoor | "lane" | null = null;
    for (const s of STREET_SHOPS) if (Math.abs(nz - s.z) < s.doorHalf + 1.5 && s.side * nx > FRONT - 3.0) { now = s.id; break; }
    if (!now && nz > SOUTH - 2.2) now = "lane";
    if (now !== near) { near = now; cb.onNear(near); }
    if (doorFired && !doorwayAt(nx, nz)) doorFired = false;

    // the sun's shadow: drawn again only when someone casting one has moved
    if (sun.castShadow) {
      const moved = Math.abs(nx - lastShadowX) + Math.abs(nz - lastShadowZ) > 0.004 || Math.abs(angDiff(lastShadowYaw, yaw)) > 0.004 || speed > 0.05 || (tier === "high" && npcs.some((n) => n.moving));
      if (shadowDirty || moved || !(lastShadowX === lastShadowX)) {
        sun.shadow.needsUpdate = true;
        renderer.shadowMap.needsUpdate = true;
        shadowDirty = false;
        lastShadowX = nx; lastShadowZ = nz; lastShadowYaw = yaw;
        shadowRenders++;
      }
    }
    renderer.info.autoReset = false; renderer.info.reset();
    if (hEnh) hEnh.render(scene, camera); else renderer.render(scene, camera);
    renderer.info.autoReset = true;
    drawn++;
    // the people walk all the time: the street never rests at the still frame rate while one is in view
    const peopleMoving = npcs.some((n) => n.moving && n.root.visible);
    busy = view.moving || zoom.moving || speed > 0.05 || mag > 0.05 || walker.active || orbitHold > 0 || orb.moving || camWas.distanceToSquared(camPos) > 1e-6 || !!faceTo || peopleMoving;
    if (busy) { busyT += dt; stillT = 0; } else { stillT += dt; busyT = 0; }
    if (!opts.fixedStep) {
      if (busy && !capAlways) dyn.frame(performance.now()); else dyn.pause();
      const wantPR = busyT > 0.25 ? movePR() : stillT > 0.5 ? stillPR() : pr;
      if (wantPR !== pr) { pr = wantPR; renderer.setPixelRatio(pr); }
    }
  };
  if (isOwner()) renderer.setAnimationLoop(frame);

  const ray = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PH);
  const aim = (px: number, py: number) => {
    const rct = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((px - rct.left) / rct.width) * 2 - 1, -((py - rct.top) / rct.height) * 2 + 1), camera);
  };
  /** A tap on a front: the shop whose front it is (the plane of the fronts, by where it lands). */
  const pickDoor = (): StreetDoor | null => {
    for (const side of [-1, 1] as const) {
      const xf = side * W0;
      const d = ray.ray.direction, o = ray.ray.origin;
      if (Math.abs(d.x) < 1e-6) continue;
      const t = (xf - o.x) / d.x;
      if (t <= 0) continue;
      const y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < 0 || y > 4.4) continue;
      const s = STREET_SHOPS.find((sh) => sh.side === side && Math.abs(z - sh.z) < sh.width / 2);
      // only if the front is the first thing the tap meets (not the ground in front of it)
      const tg = ray.ray.intersectPlane(ground, new THREE.Vector3());
      if (s && (!tg || tg.distanceTo(o) > t)) return s.id;
    }
    return null;
  };
  const ctrl: StreetController = {
    setStick: (x, y) => { stick = { x, y }; if (Math.hypot(x, y) > 0.05) stopWalk(); },
    orbit: (dx, dy = 0) => { orb.drag(dx, view.first ? 0 : dy); view.drag(dy); orbitHold = 1.5; },
    setView: (m) => { view.set(m); },
    viewMode: () => view.mode,
    tap: (px, py) => {
      aim(px, py);
      const door = pickDoor();
      if (door) {
        const s = shopOf(door);
        walkTo([s.side * (FRONT - 1.3), s.z], [s.side * FRONT, s.z]);
        return { door };
      }
      const hit = ray.ray.intersectPlane(ground, new THREE.Vector3());
      if (!hit || Math.hypot(hit.x - player.position.x, hit.z - player.position.z) > 40) return null;
      return walkTo([hit.x, hit.z], null) ? { door: null } : null;
    },
    place: (x, z, y = yaw) => { stopWalk(); player.position.x = x; player.position.z = z; yaw = y; camYaw = y + Math.PI; orb.reset(); first = true; },
    walkTo: (x, z) => walkTo([x, z], null),
    where: () => ({ x: player.position.x, z: player.position.z, yaw, t: gameT, cam: camera.position.toArray().map((n: number) => +n.toFixed(2)) }),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), quality: tier, people: 1 + npcs.filter((n) => n.root.visible).length, frames: drawn, merged: frozen, shadowRenders }),
    debug: () => {
      const b = world.bodies();
      let minGap = Infinity;
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) minGap = Math.min(minGap, Math.hypot(b[i].x - b[j].x, b[i].z - b[j].z));
      const onRoad = npcs.filter((n) => Math.abs(n.x) < ROAD - 0.1 && Math.abs(n.z - ZEBRA_Z) > 1.4).length;
      return { tier, walkers: npcs.length, people: npcs.map((n) => n.info()), minGap: +minGap.toFixed(2), onRoadOffZebra: onRoad, cars: carRoots.length, showroomCar: !!showroom.car, near, cam: camera.position.toArray().map((n: number) => +n.toFixed(2)), you: [+player.position.x.toFixed(2), +player.position.z.toFixed(2)], gait: !!gaitBlend };
    },
    debugCamera: (pos, look) => { testCam = pos ? [pos, look ?? [0, 1, 0]] : null; },
    dispose: () => {
      disposed = true;
      detachZoom();
      gov.dispose();
      savings.dispose();
      cull.dispose();
      hEnh?.dispose();
      if (isOwner()) renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      marker.dispose();
      envTex.dispose();
      release(scene);
    },
  };
  // the cover stays up until the first real frames are drawn smoothly (perf.ts awaitSmoothFrame)
  await awaitSmoothFrame(renderer, { isDead: () => disposed || gone(), isOwner });
  if (disposed || gone()) { ctrl.dispose(); throw abandonedSceneError(); }
  return ctrl;
}

/** The 3D shop's window: two shirts in your kit on stands, a ball and a cup, on a warm wall. */
function shopWindowCanvas(shirt: string, trim: string): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 512; c.height = 384;
  const g = c.getContext("2d")!;
  const wall = g.createLinearGradient(0, 0, 0, 384); wall.addColorStop(0, "#f6e6c6"); wall.addColorStop(1, "#e2c896");
  g.fillStyle = wall; g.fillRect(0, 0, 512, 384);
  for (const x of [130, 380]) { const p = g.createRadialGradient(x, 30, 4, x, 120, 170); p.addColorStop(0, "rgba(255,250,230,0.9)"); p.addColorStop(1, "rgba(255,250,230,0)"); g.fillStyle = p; g.fillRect(0, 0, 512, 384); }
  g.fillStyle = "#5b3a26"; g.fillRect(0, 318, 512, 66);
  const shirtAt = (cx: number, top: number, s: number) => {
    g.fillStyle = shirt;
    g.beginPath();
    g.moveTo(cx - 0.16 * s, top + 0.56 * s); g.lineTo(cx + 0.16 * s, top + 0.56 * s); g.lineTo(cx + 0.17 * s, top + 0.14 * s); g.lineTo(cx + 0.3 * s, top + 0.23 * s); g.lineTo(cx + 0.36 * s, top + 0.14 * s);
    g.lineTo(cx + 0.2 * s, top); g.lineTo(cx + 0.07 * s, top); g.quadraticCurveTo(cx, top + 0.06 * s, cx - 0.07 * s, top); g.lineTo(cx - 0.2 * s, top);
    g.lineTo(cx - 0.36 * s, top + 0.14 * s); g.lineTo(cx - 0.3 * s, top + 0.23 * s); g.lineTo(cx - 0.17 * s, top + 0.14 * s); g.closePath(); g.fill();
    g.fillStyle = trim; g.fillRect(cx - 0.17 * s, top + 0.5 * s, 0.34 * s, 0.04 * s);
    g.fillStyle = "#c9a14f"; g.fillRect(cx - 3, top + 0.56 * s, 6, 318 - top - 0.56 * s);
  };
  shirtAt(130, 70, 300);
  shirtAt(380, 90, 260);
  // a ball and a gold cup on plinths
  g.fillStyle = "#efe6d4"; g.fillRect(232, 238, 56, 80); g.fillStyle = "#f4f4f4"; g.beginPath(); g.arc(260, 214, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#1c1c1c"; g.beginPath(); g.arc(260, 214, 8, 0, Math.PI * 2); g.fill();
  return c;
}

/**
 * Opens the street. If anything fails part-way, the half-built 3D is thrown away properly before
 * the error goes up (the shared renderer stays: three3d/perf.ts acquireRenderer).
 */
export async function startStreet(container: HTMLElement, cb: StreetCallbacks, data: StreetData, opts: StreetOptions = {}): Promise<StreetController> {
  const own: { release?: (root?: any) => void; root?: any } = {};
  try {
    return await buildStreet(container, cb, data, opts, own);
  } catch (e) {
    if (own.release) { try { own.release(own.root); } catch { /* already gone */ } }
    throw e;
  }
}
