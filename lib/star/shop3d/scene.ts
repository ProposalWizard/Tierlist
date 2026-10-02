/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D SHOP — a test-area walk-around (Harry, 1 Oct 2026: "I kinda had a
 * different idea of actually playing a 3d person going shopping").
 *
 * You are a footballer in kit, in a small lit boutique: a boots wall, a car
 * on a turntable, a fridge of KIB cans and a counter. Walk up to a display
 * and its card opens (the card itself is the page's own HTML, not drawn
 * here).
 *
 * Nothing here plays football — there is no ball and no match. three.js is
 * NOT a dependency of this repo: it is fetched at runtime from jsDelivr,
 * pinned to one version, so trying this costs nothing to the real game's
 * bundle. Its render loop is three's own `renderer.setAnimationLoop` on a
 * WebGL canvas, which only moves the walker, the turntable and the camera.
 *
 * The character is CC0: Quaternius' Universal Base Characters body + hair,
 * animated with clips from his Universal Animation Library (same skeleton) —
 * see public/star/shop3d/LICENSE.txt and tools/shop3d/build_assets.py.
 */
import type { DisplayId } from "./catalogue";
import { CAN_COLOURS } from "./catalogue";
import { kitMasks, type V3 } from "./kit";
import { signCanvas, floorCanvas, numberCanvas } from "./textures";

export const THREE_VERSION = "0.169.0";
const CDN = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}`;

export interface KitColours { shirt: string; trim: string }

export interface ShopCallbacks {
  onNear: (id: DisplayId | null) => void;
  onFps: (fps: number) => void;
}

export interface ShopController {
  /** Joystick: x right, y forward, each -1..1. */
  setStick: (x: number, y: number) => void;
  setKit: (kit: KitColours) => void;
  /** Which item on a display is picked (the boots wall lights that pair, the car repaints). */
  select: (display: DisplayId, index: number, colour: string) => void;
  /** Which item on a display you are standing nearest (the boots wall). */
  nearestItem: (display: DisplayId) => number;
  /** He reaches out — the "buy" gesture. */
  playBuy: () => void;
  /** A card is open: the camera steps back to show the display. */
  setCardOpen: (open: boolean) => void;
  /** Paint each pair on the boots wall (catalogue order). */
  setBootColours: (colours: string[]) => void;
  /** Drag on the view to swing the camera round. */
  orbit: (dxPixels: number) => void;
  /** For filming: where he is. */
  where: () => { x: number; z: number; yaw: number; camYaw: number; t: number };
  /** Filming only: [wall-clock ms, game seconds] for every frame drawn. */
  filmLog: () => [number, number][];
  /** What one frame costs to draw: draw calls and triangles. */
  stats: () => { calls: number; triangles: number; pixelRatio: number };
  dispose: () => void;
}

/** Room: x -6..6, z -8..8 (door at +z). Metres. */
const ROOM = { x: 6, z: 8, h: 3.4 };
const START = { x: 0, z: 5.3 };

const ZONES: { id: DisplayId; x: number; z: number; r: number }[] = [
  { id: "boots", x: -4.55, z: 0, r: 1.55 },
  { id: "car", x: 2.6, z: -1.6, r: 3.15 },
  { id: "cans", x: 4.0, z: 4.1, r: 1.35 },
  { id: "counter", x: 0, z: -5.0, r: 1.45 },
];

/** Things you can't walk through: boxes [minX, maxX, minZ, maxZ] and circles. */
const BOXES: [number, number, number, number][] = [
  [-6, -5.35, -3.2, 3.2], // boots wall unit
  [4.75, 6, 2.7, 5.5], // fridge
  [-2.7, 2.7, -6.95, -5.85], // counter
  [-6, -5.1, 5.6, 6.6], // plant
  [5.1, 6, -7.6, -6.6], // plant
];
const CIRCLES: [number, number, number][] = [[2.6, -1.6, 2.15]];

/** The point on a display he turns to face when its card is open. */
function facePoint(id: DisplayId, x: number, z: number): [number, number] {
  if (id === "boots") return [-5.5, Math.max(-2.4, Math.min(2.4, z))];
  if (id === "car") return [2.6, -1.6];
  if (id === "cans") return [5.4, 4.1];
  return [Math.max(-2.2, Math.min(2.2, x)), -6.5];
}

const WALK = 1.55; // m/s
const JOG = 3.3;

/** "high": shadows, 1.5x pixels. "low": no shadows, 1x pixels — for a slow phone. */
export type ShopQuality = "high" | "low";

export interface ShopOptions {
  quality?: ShopQuality;
  /** Filming only: every drawn frame moves the game on by exactly this many
   *  seconds, however long it took to draw — so a machine with no graphics
   *  chip can still film smooth, real-speed motion. Off in normal use. */
  fixedStep?: number;
}

export async function startShop(container: HTMLElement, cb: ShopCallbacks, kit0: KitColours, opts: ShopOptions = {}): Promise<ShopController> {
  const quality = opts.quality ?? "high";
  const THREE: any = await import(/* webpackIgnore: true */ `${CDN}/+esm` as string);
  const { GLTFLoader }: any = await import(/* webpackIgnore: true */ `${CDN}/examples/jsm/loaders/GLTFLoader.js/+esm` as string);
  const { RoomEnvironment }: any = await import(/* webpackIgnore: true */ `${CDN}/examples/jsm/environments/RoomEnvironment.js/+esm` as string);

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality === "high";
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#141821");
  scene.fog = new THREE.Fog("#141821", 14, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 60);

  // ── Light: one sun-ish key with shadows, a sky fill, two accents ──
  scene.add(new THREE.HemisphereLight("#e6eeff", "#4a3424", 0.75));
  const key = new THREE.DirectionalLight("#fff3e2", 1.9);
  key.position.set(3.5, 9, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera;
  sc.left = -8; sc.right = 8; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 25;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const carSpot = new THREE.SpotLight("#ffffff", 40, 9, 0.62, 0.5, 1.6);
  carSpot.position.set(2.6, ROOM.h - 0.05, -1.6);
  carSpot.target.position.set(2.6, 0, -1.6);
  scene.add(carSpot, carSpot.target);
  const bootsGlow = new THREE.PointLight("#ffe7c4", 9, 6, 1.8);
  bootsGlow.position.set(-4.2, 2.4, 0);
  scene.add(bootsGlow);

  // ── Materials ──
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
  const sign = (text: string, bg: string, ink: string, w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const t = canvasTex(signCanvas(text, { bg, ink, w: 512, h: Math.round((512 * h) / w) }));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissive: "#ffffff", emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.6 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  };

  // ── The room ──
  const floorT = canvasTex(floorCanvas());
  floorT.wrapS = floorT.wrapT = THREE.RepeatWrapping;
  floorT.repeat.set(3, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.x * 2, ROOM.z * 2), mat("#ffffff", { map: floorT, roughness: 0.5 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallM = mat("#262c38", { roughness: 0.9 });
  const skirtM = mat("#11141a", { roughness: 0.6 });
  // back (north), west, east walls
  box(ROOM.x * 2, ROOM.h, 0.1, wallM, 0, ROOM.h / 2, -ROOM.z);
  box(0.1, ROOM.h, ROOM.z * 2, wallM, -ROOM.x, ROOM.h / 2, 0);
  box(0.1, ROOM.h, ROOM.z * 2, wallM, ROOM.x, ROOM.h / 2, 0);
  // south wall with the door gap (2.4 wide, 2.6 high)
  box(ROOM.x - 1.2, ROOM.h, 0.1, wallM, -(ROOM.x + 1.2) / 2, ROOM.h / 2, ROOM.z);
  box(ROOM.x - 1.2, ROOM.h, 0.1, wallM, (ROOM.x + 1.2) / 2, ROOM.h / 2, ROOM.z);
  box(2.4, ROOM.h - 2.6, 0.1, wallM, 0, 2.6 + (ROOM.h - 2.6) / 2, ROOM.z);
  // daylight outside the door, and the glass doors standing open
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ color: "#cfe3ff" }));
  outside.position.set(0, 1.6, ROOM.z + 1.2);
  outside.rotation.y = Math.PI;
  scene.add(outside);
  const glassM = new THREE.MeshStandardMaterial({ color: "#9fc4e8", transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1 });
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.5, 0.04), glassM);
    d.position.set(s * 1.55, 1.25, ROOM.z - 0.45);
    d.rotation.y = s * 1.2;
    scene.add(d);
  }
  // skirting and a ceiling with light strips
  box(ROOM.x * 2, 0.12, 0.04, skirtM, 0, 0.06, -ROOM.z + 0.07);
  box(0.04, 0.12, ROOM.z * 2, skirtM, -ROOM.x + 0.07, 0.06, 0);
  box(0.04, 0.12, ROOM.z * 2, skirtM, ROOM.x - 0.07, 0.06, 0);
  box(ROOM.x * 2, 0.08, ROOM.z * 2, mat("#2a2f3a", { roughness: 0.95 }), 0, ROOM.h, 0);
  for (const x of [-3, 0, 3]) box(0.08, 0.02, 11, glow("#fff1dc", 1.1), x, ROOM.h - 0.05, 0);
  // a rug down the middle
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 9), mat("#3a1f24", { roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-0.6, 0.005, 1.5);
  rug.receiveShadow = true;
  scene.add(rug);
  // plants
  const plant = (x: number, z: number) => {
    box(0.55, 0.6, 0.55, mat("#e9e4dc"), x, 0.3, z, true);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat("#2f6b3a", { flatShading: true }));
    leaves.position.set(x, 1.15, z);
    leaves.scale.set(1, 1.35, 1);
    leaves.castShadow = true;
    scene.add(leaves);
  };
  plant(-5.5, 6.1);
  plant(5.5, -7.1);

  // ── The boots wall (west) ──
  box(0.5, 3, 6.4, mat("#0f1218", { roughness: 0.5 }), -5.7, 1.5, 0);
  sign("BOOTS", "#0f1218", "#ffffff", 2.4, 0.6, -5.43, 2.85, 0, Math.PI / 2);
  const shelfY = [0.8, 1.45, 2.1];
  const shelfM = mat("#f3f1ec", { roughness: 0.35 });
  for (const y of shelfY) {
    box(0.42, 0.04, 6.0, shelfM, -5.25, y, 0, false);
    box(0.02, 0.015, 5.9, glow("#ffe2b0", 3), -5.06, y - 0.03, 0);
  }
  const bootPairs: any[] = [];
  const bootMats: any[] = [];
  const BOOT_SLOTS: [number, number][] = [ // [shelf, z]
    [0, -1.6], [0, 0], [0, 1.6], [1, -0.9], [1, 0.9], [2, -0.9], [2, 0.9],
  ];
  // A football boot, from its side outline (heel at x=0, toe at x=0.29 m),
  // pushed out to a boot's width with soft edges.
  const extrude = (pts: (s: any) => void, depth: number) => {
    const sh = new THREE.Shape();
    pts(sh);
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.014, bevelSegments: 2, curveSegments: 8 });
    g.translate(-0.145, 0, -depth / 2);
    g.rotateY(Math.PI / 2);
    return g;
  };
  const bootGeo = extrude((s) => {
    s.moveTo(0.0, 0.012);
    s.lineTo(0.27, 0.012);
    s.quadraticCurveTo(0.305, 0.016, 0.296, 0.04);
    s.quadraticCurveTo(0.27, 0.062, 0.2, 0.072);
    s.quadraticCurveTo(0.13, 0.085, 0.095, 0.125);
    s.lineTo(0.08, 0.138);
    s.quadraticCurveTo(0.04, 0.128, 0.012, 0.13);
    s.quadraticCurveTo(-0.012, 0.07, 0.0, 0.012);
  }, 0.07);
  const soleGeo = extrude((s) => {
    s.moveTo(-0.004, 0.0);
    s.lineTo(0.285, 0.0);
    s.quadraticCurveTo(0.31, 0.006, 0.3, 0.02);
    s.lineTo(-0.008, 0.02);
    s.lineTo(-0.004, 0.0);
  }, 0.074);
  const stripeGeo = new THREE.BoxGeometry(0.004, 0.018, 0.12);
  const lightSole = mat("#ececec", { roughness: 0.5 });
  const darkSole = mat("#151515", { roughness: 0.5 });
  for (let i = 0; i < BOOT_SLOTS.length; i++) {
    const [s, z] = BOOT_SLOTS[i];
    const pair = new THREE.Group();
    const m = mat("#ffffff", { roughness: 0.3, metalness: 0.08 });
    bootMats.push(m);
    for (const dx of [-0.075, 0.075]) {
      const b = new THREE.Mesh(bootGeo, m);
      b.position.set(dx, 0.0, dx * 0.5);
      b.castShadow = true;
      const sole = new THREE.Mesh(soleGeo, i === 4 ? lightSole : darkSole);
      sole.position.set(dx, 0.0, dx * 0.5);
      const stripe = new THREE.Mesh(stripeGeo, i === 4 ? lightSole : darkSole);
      stripe.position.set(dx + (dx > 0 ? 0.05 : -0.05), 0.06, dx * 0.5 - 0.02);
      stripe.rotation.x = -0.35;
      pair.add(b, sole, stripe);
    }
    pair.scale.setScalar(1.5);
    pair.position.set(-5.2, shelfY[s] + 0.025, z);
    pair.rotation.y = 0.5;
    scene.add(pair);
    bootPairs.push(pair);
  }
  const bootHalo = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.42), new THREE.MeshBasicMaterial({ color: "#ffd88a", transparent: true, opacity: 0.0 }));
  bootHalo.rotation.y = Math.PI / 2;
  scene.add(bootHalo);

  // ── The car on its turntable ──
  const table = new THREE.Group();
  table.position.set(2.6, 0, -1.6);
  scene.add(table);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.1, 0.14, 48), mat("#20242c", { metalness: 0.6, roughness: 0.3 }));
  disc.position.y = 0.07;
  disc.receiveShadow = true;
  table.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.07, 0.02, 6, 64), glow("#7fd4ff", 2.5));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.145;
  table.add(ring);
  const car = new THREE.Group();
  car.position.y = 0.14;
  table.add(car);
  const paint = mat("#f2c230", { roughness: 0.28, metalness: 0.35 });
  const darkGlass = mat("#10161f", { roughness: 0.1, metalness: 0.6 });
  const carPart = (g: any, m: any, x: number, y: number, z: number) => {
    const me = new THREE.Mesh(g, m);
    me.position.set(x, y, z);
    me.castShadow = true;
    car.add(me);
    return me;
  };
  // The car from its side outline (front at +x), pushed out to its width.
  const carShape = (pts: [number, number][], depth: number, bevel: number) => {
    const sh = new THREE.Shape();
    sh.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts.slice(1)) sh.lineTo(x, y);
    const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -depth / 2);
    g.rotateY(Math.PI / 2);
    return g;
  };
  carPart(carShape([[-2.05, 0.28], [2.0, 0.28], [2.1, 0.42], [2.08, 0.6], [1.15, 0.76], [0.3, 1.12], [-0.8, 1.15],
    [-1.75, 0.86], [-2.08, 0.78], [-2.12, 0.42]], 1.62, 0.1), paint, 0, 0, 0);
  carPart(carShape([[1.08, 0.79], [0.33, 1.08], [-0.77, 1.1], [-1.62, 0.86], [1.08, 0.79]], 1.86, 0.0), darkGlass, 0, 0, 0);
  const tyreG = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 18);
  tyreG.rotateZ(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 10);
  rimG.rotateZ(Math.PI / 2);
  const tyreM = mat("#0b0b0c", { roughness: 0.9 });
  const rimM = mat("#c9ced6", { metalness: 0.9, roughness: 0.25 });
  for (const [x, z] of [[-0.86, -1.3], [0.86, -1.3], [-0.86, 1.35], [0.86, 1.35]]) {
    carPart(tyreG, tyreM, x, 0.36, z);
    carPart(rimG, rimM, x, 0.36, z);
  }
  for (const x of [-0.6, 0.6]) {
    carPart(new THREE.BoxGeometry(0.4, 0.09, 0.04), glow("#ffffff", 3), x, 0.55, -2.2);
    carPart(new THREE.BoxGeometry(0.45, 0.08, 0.04), glow("#ff2a2a", 2.5), x, 0.6, 2.22);
  }
  sign("MOTORS", "#0d1016", "#7fd4ff", 2.2, 0.5, 5.94, 2.7, -1.6, -Math.PI / 2);

  // ── The KIB fridge (east, by the door) ──
  const fx = 5.4, fz = 4.1;
  box(1.1, 2.3, 2.6, mat("#e9edf2", { roughness: 0.3, metalness: 0.3 }), fx + 0.05, 1.15, fz, true);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.9), glow("#e8f6ff", 0.9));
  inside.position.set(fx - 0.15, 1.2, fz);
  inside.rotation.y = -Math.PI / 2;
  scene.add(inside);
  const canG = new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12);
  const PER = 9;
  const cansMesh = new THREE.InstancedMesh(canG, mat("#ffffff", { roughness: 0.3, metalness: 0.7 }), 3 * 3 * PER);
  const tmp = new THREE.Object3D();
  let ci = 0;
  for (let shelf = 0; shelf < 3; shelf++) {
    const y = 0.55 + shelf * 0.55;
    box(0.5, 0.025, 2.3, mat("#cfd6de", { roughness: 0.2, metalness: 0.5 }), fx - 0.4, y - 0.1, fz);
    for (let col = 0; col < 3; col++) {
      for (let k = 0; k < PER; k++) {
        tmp.position.set(fx - 0.55 + (k % 3) * 0.1, y, fz - 1.0 + col * 0.75 + Math.floor(k / 3) * 0.1);
        tmp.updateMatrix();
        cansMesh.setMatrixAt(ci, tmp.matrix);
        cansMesh.setColorAt(ci, new THREE.Color(CAN_COLOURS[col]));
        ci++;
      }
    }
  }
  scene.add(cansMesh);
  const fridgeGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), glassM);
  fridgeGlass.position.set(fx - 0.52, 1.2, fz);
  fridgeGlass.rotation.y = -Math.PI / 2;
  scene.add(fridgeGlass);
  sign("KIB CANS", "#ff8a1f", "#140a02", 2.0, 0.42, fx - 0.5, 2.55, fz, -Math.PI / 2);

  // ── The counter (north) with a watch case and the till ──
  box(5.2, 1.0, 0.95, mat("#f4f1ea", { roughness: 0.4 }), 0, 0.5, -6.4, true);
  box(5.3, 0.05, 1.05, mat("#20242c", { roughness: 0.25, metalness: 0.4 }), 0, 1.02, -6.4);
  box(5.2, 0.04, 0.02, glow("#ffcf6e", 2.5), 0, 0.2, -5.91);
  const caseGlass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.34, 0.6), glassM);
  caseGlass.position.set(-1.1, 1.22, -6.35);
  scene.add(caseGlass);
  const watchMs: any[] = [];
  for (let i = 0; i < 5; i++) {
    const wm = mat(["#d9dde3", "#c0c6cf", "#e1b84a", "#e8f4ff", "#e1b84a"][i], { metalness: 0.95, roughness: 0.2 });
    watchMs.push(wm);
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 20), wm);
    w.position.set(-1.85 + i * 0.37, 1.13, -6.35);
    w.rotation.x = -1.1;
    scene.add(w);
  }
  box(0.42, 0.3, 0.32, mat("#1a1d24"), 1.5, 1.2, -6.45, true);
  box(0.36, 0.22, 0.02, glow("#5ce1a1", 1.4), 1.5, 1.4, -6.28);
  // back wall: the shop's name
  sign("KNOWITBALL STORE", "#0d1016", "#ffffff", 5.6, 0.7, 0, 2.55, -ROOM.z + 0.07, 0);
  box(5.8, 0.04, 0.3, shelfM, 0, 1.75, -ROOM.z + 0.2);

  // ── The footballer ──
  const loader = new GLTFLoader();
  const [charGltf, animGltf] = await Promise.all([
    loader.loadAsync("/star/shop3d/character.glb"),
    loader.loadAsync("/star/shop3d/anims.glb"),
  ]);
  const player = charGltf.scene;
  player.position.set(START.x, 0, START.z);
  player.rotation.y = Math.PI; // facing into the shop (-z)
  scene.add(player);
  const kitU = {
    uShirt: { value: new THREE.Color(kit0.shirt) },
    uTrim: { value: new THREE.Color(kit0.trim) },
    uBoot: { value: new THREE.Color("#141416") },
    uNum: { value: canvasTex(numberCanvas(10, "#ffffff")) },
    uPelvis: { value: new THREE.Vector3() },
    uUp: { value: new THREE.Vector3(0, 1, 0) },
    uRight: { value: new THREE.Vector3(1, 0, 0) },
    uFwd: { value: new THREE.Vector3(0, 0, 1) },
  };
  player.traverse((o: any) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    if (o.isSkinnedMesh && o.material?.name === "Skin") dressInKit(THREE, o, kitU);
    // the pack's hair texture is grey: tint it dark brown (eyebrows share it)
    if (o.material?.name === "Hair") o.material.color.set("#4a2e1c");
  });
  const mixer = new THREE.AnimationMixer(player);
  const clip = (n: string) => animGltf.animations.find((a: any) => a.name === n);
  const act = (n: string) => {
    const c = clip(n);
    const a = mixer.clipAction(c);
    a.play();
    a.setEffectiveWeight(0);
    return a;
  };
  const idleA = act("Idle_Loop");
  const walkA = act("Walk_Loop");
  const jogA = act("Jog_Fwd_Loop");
  idleA.setEffectiveWeight(1);
  const buyA = mixer.clipAction(clip("Interact"));
  buyA.setLoop(THREE.LoopOnce, 1);
  buyA.clampWhenFinished = false;
  let buying = 0; // seconds left of the buy gesture

  // ── State ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0;
  let yaw = Math.PI; // facing
  let camYaw = 0; // camera looks along -z at 0
  let orbitHold = 0;
  let near: DisplayId | null = null;
  let frames = 0, fpsT0 = performance.now();
  let gameT = 0;
  let framed = false, frame = 0;
  const filmLog: [number, number][] = [];
  let disposed = false;

  const onKey = (e: KeyboardEvent, down: boolean) => {
    const k = e.key.toLowerCase();
    if (!["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "shift"].includes(k)) return;
    if (down) keys.add(k); else keys.delete(k);
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

  const collide = (x: number, z: number) => {
    const r = 0.32;
    x = Math.max(-ROOM.x + r, Math.min(ROOM.x - r, x));
    z = Math.max(-ROOM.z + r, Math.min(ROOM.z - 0.4, z));
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

  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let first = true;

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    const dt = opts.fixedStep ?? Math.min(0.05, clock.getDelta());
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
    const mag = Math.min(1, Math.hypot(ix, iy));
    const target = mag < 0.08 ? 0 : mag < 0.75 ? WALK * (mag / 0.75) : WALK + (JOG - WALK) * ((mag - 0.75) / 0.25);
    speed += (target - speed) * Math.min(1, dt * 8);
    if (buying > 0) speed *= 0.8;
    if (mag >= 0.08) {
      // stick is relative to the camera
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const dx = fx * iy + rx * ix, dz = fz * iy + rz * ix;
      const want = Math.atan2(dx, dz);
      yaw += angDiff(yaw, want) * Math.min(1, dt * 10);
    }
    const [nx, nz] = collide(player.position.x + Math.sin(yaw) * speed * dt, player.position.z + Math.cos(yaw) * speed * dt);
    player.position.x = nx; player.position.z = nz;
    player.rotation.y = yaw;

    // animation blend
    const wWalk = speed < WALK ? speed / WALK : Math.max(0, 1 - (speed - WALK) / (JOG - WALK));
    const wJog = speed <= WALK ? 0 : Math.min(1, (speed - WALK) / (JOG - WALK));
    const wIdle = Math.max(0, 1 - speed / WALK);
    const dur = buyA.getClip().duration;
    const busy = buying > 0 ? Math.min(1, buying / 0.3, (dur - buying) / 0.3) : 0;
    idleA.setEffectiveWeight(wIdle * (1 - busy));
    walkA.setEffectiveWeight(wWalk * (1 - busy));
    jogA.setEffectiveWeight(wJog * (1 - busy));
    buyA.setEffectiveWeight(busy);
    walkA.timeScale = Math.max(0.6, speed / 1.45);
    jogA.timeScale = Math.max(0.8, speed / 3.2);
    if (buying > 0) buying -= dt;
    mixer.update(dt);

    // a card is open and he's stopped: he turns to the display, and so does the camera
    if (framed && near && speed < 0.3 && mag < 0.08) {
      const [tx, tz] = facePoint(near, player.position.x, player.position.z);
      const want = Math.atan2(tx - player.position.x, tz - player.position.z);
      yaw += angDiff(yaw, want) * Math.min(1, dt * 5);
      player.rotation.y = yaw;
      if (orbitHold <= 0) camYaw += angDiff(camYaw, want + Math.PI) * Math.min(1, dt * 2.5);
    }
    // camera: swings round behind him while he walks
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) camYaw += angDiff(camYaw, yaw + Math.PI) * Math.min(1, dt * 1.6);
    const cf = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    const cr = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    // pull back when a card is open, so the display is in the picture
    const pull = (frame += ((framed ? 1 : 0) - frame) * Math.min(1, dt * 3));
    const want = new THREE.Vector3(player.position.x, 2.4 + 0.25 * pull, player.position.z)
      .addScaledVector(cf, -4.1 - 1.6 * pull).addScaledVector(cr, 0.3);
    want.x = Math.max(-ROOM.x + 0.3, Math.min(ROOM.x - 0.3, want.x));
    want.z = Math.max(-ROOM.z + 0.3, Math.min(ROOM.z + 0.9, want.z));
    if (first) { camPos.copy(want); first = false; } else camPos.lerp(want, Math.min(1, dt * 6));
    camera.position.copy(camPos);
    look.set(player.position.x, 1.0, player.position.z).addScaledVector(cf, 1.8).addScaledVector(cr, 0.15);
    camera.lookAt(look);

    // the turntable turns, the picked boots glow
    table.rotation.y += dt * 0.25;
    bootHalo.material.opacity = 0.18 + 0.1 * Math.sin(gameT * 3);

    // which display is he at?
    let now: DisplayId | null = null;
    for (const zn of ZONES) {
      if (Math.hypot(player.position.x - zn.x, player.position.z - zn.z) < zn.r) { now = zn.id; break; }
    }
    if (now !== near) { near = now; cb.onNear(near); }

    renderer.render(scene, camera);
    // frames per real second (wall clock, not the capped step above)
    frames++;
    const nowMs = performance.now();
    if (nowMs - fpsT0 >= 1000) { cb.onFps(Math.round((frames * 1000) / (nowMs - fpsT0))); frames = 0; fpsT0 = nowMs; }
  });

  const ctrl: ShopController = {
    setStick: (x, y) => { stick = { x, y }; },
    setCardOpen: (open) => { framed = open; },
    setBootColours: (cs) => { bootMats.forEach((m, i) => m.color.set(cs[i] ?? "#ffffff")); },
    setKit: (k) => { kitU.uShirt.value.set(k.shirt); kitU.uTrim.value.set(k.trim); },
    select: (display, index, colour) => {
      if (display === "boots") {
        bootPairs.forEach((p, i) => p.scale.setScalar(i === index ? 1.95 : 1.5));
        const p = bootPairs[index];
        if (p) { bootHalo.position.set(-5.43, p.position.y + 0.12, p.position.z); }
      } else if (display === "car") {
        paint.color.set(colour);
      } else if (display === "counter") {
        watchMs.forEach((m, i) => { m.emissive.set(i === index ? "#3a2a00" : "#000000"); });
      }
    },
    nearestItem: (display) => {
      if (display !== "boots") return 0;
      let best = 0, bd = Infinity;
      bootPairs.forEach((p, i) => {
        const d = Math.abs(p.position.z - player.position.z) + (2.1 - p.position.y) * 0.1;
        if (d < bd) { bd = d; best = i; }
      });
      return best;
    },
    playBuy: () => {
      buyA.reset();
      buyA.play();
      buying = buyA.getClip().duration;
    },
    orbit: (dx) => { camYaw -= dx * 0.008; orbitHold = 1.5; },
    where: () => ({ x: player.position.x, z: player.position.z, yaw, camYaw, t: gameT }),
    filmLog: () => filmLog,
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() }),
    dispose: () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      scene.traverse((o: any) => {
        o.geometry?.dispose?.();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.(); });
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  return ctrl;
}

/** Paint the kit onto the bare body (see kit.ts): shirt, shorts in the trim
 *  colour, socks with a trim band, dark boots and a number on the back. */
function dressInKit(THREE: any, mesh: any, U: any) {
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
  m.customProgramCacheKey = () => "shop3d-kit";
  m.needsUpdate = true;
}
