/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 3D GARDEN — your place as a footballer, walked in 3D (Mikey, 3 Oct
 * 2026: "make this garden area also a 3D area where it's basically your
 * garden as a footballer in your life … everything is 3D").
 *
 * You are the SAME footballer as in the 3D shop (lib/star/shop3d/scene.ts):
 * the same model, kit, walk and camera. The garden, from his recording:
 *   - the sky, trees and the boundary (it grows with your home, like before)
 *   - the stable, paddock, hay and water, and your horse if you own one
 *   - the trophy cabinet: every trophy you have won, on lit shelves
 *   - the fountain, with a bird that flies down for a drink now and then
 *   - the gazebo: three team-mates on the bench with KIB cans, a potted
 *     plant, and a teqball table
 *   - parking for the cars you own
 *   - where the house was, THE SHOP: walk through its doors and you are in
 *     the 3D shop; its own front doors bring you back out here.
 *
 * Real data only (lib/star/gardenLevel.ts and the career), nothing new to
 * save. The models are free CC0 packs (Kenney, Quaternius) packed by
 * tools/garden3d/export_models.py; the people's extra moves (sitting,
 * drinking) by tools/garden3d/build_anims.py — see
 * public/star/garden3d/LICENSE.txt. three.js loads only when this opens.
 */
import { dressInKit, type KitColours } from "../shop3d/scene";
import { blobCanvas, neonCanvas, numberCanvas } from "../shop3d/textures";
import {
  lawnCanvas, gravelCanvas, pavingCanvas, strawCanvas, boardsCanvas, skyCanvas, countCanvas, glowCanvas,
} from "./textures";

export type GardenSpot = "trophies" | "horse" | "mates" | "fountain" | "cars" | "shop" | "teqball";
export type GardenSky = "day" | "sunset" | "night";

export interface GardenTrophy { name: string; count: number; art: string | null }

export interface GardenData {
  kit: KitColours;
  /** Your shirt number (the back of the shirt). */
  number: number;
  /** How grand the garden is, 0-4, from the best home you own. */
  tier: number;
  /** The stable's level, 0 = none bought, 1-5. */
  stable: number;
  horse: { name: string } | null;
  trophies: GardenTrophy[];
  /** The cars you own: their 3D model files (the shop's own). */
  cars: string[];
  sky: GardenSky;
  /** The team-mates on the bench: their shirt numbers. */
  mates: number[];
  /** Where you appear: at the shop's doors (coming out of it) or the gate. */
  arrive: "shop" | "gate";
}

export interface GardenCallbacks {
  onNear: (spot: GardenSpot | null) => void;
  onFps: (fps: number) => void;
  /** He walked through the shop's doors. */
  onShopDoor: () => void;
}

export interface GardenController {
  setStick: (x: number, y: number) => void;
  orbit: (dxPixels: number) => void;
  pick: (clientX: number, clientY: number) => GardenSpot | null;
  /** For checking: stand him at (x, z), facing yaw (radians). */
  place: (x: number, z: number, yaw?: number) => void;
  where: () => { x: number; z: number; yaw: number; t: number };
  stats: () => { calls: number; triangles: number; pixelRatio: number; loaded: number };
  /** For checking: where the horse and the bird are, and how big they draw. */
  debug: () => Record<string, unknown>;
  dispose: () => void;
}

export interface GardenOptions {
  quality?: "high" | "low";
  fixedStep?: number;
}

// ── The plan of the garden (metres; north is -z, the gate is south) ──
const LIMIT = 18.3;
const SHOP = { x0: -6, x1: 6, z0: -17.5, z1: -9, h: 5.2 };
const DOOR = { half: 1.2, h: 2.8 };
const FOUNTAIN = { x: 0, z: -2.2, r: 1.95 };
const CABINET = { x: -7.4, z: -5.8, w: 3.0, d: 2.6 };
const GAZEBO = { x: 9.4, z: 2.2, w: 3.6, d: 5.0 };
const BENCH_X = 10.75;
const TEQ = { x: 6.6, z: -3.6 };
const STABLE = { x: -15.2, z: 6.5, w: 4.2, d: 7.4 };
const PADDOCK = { x0: -13.0, x1: -6.4, z0: 0.8, z1: 12.6, gate: [5.6, 7.4] as [number, number] };
const PARK = { x0: 5.5, x1: 16.5, z0: 9.2, z1: 17.2 };
const START_SHOP = { x: 0, z: -5.3, yaw: 0 };
const START_GATE = { x: 0, z: 15.5, yaw: Math.PI };
const WALK = 1.55;
const JOG = 3.6;

const SKY: Record<GardenSky, { top: string; mid: string; low: string; fog: string; sun: string; sunI: number; hemi: [string, string, number]; exp: number }> = {
  day: { top: "#3d7fd0", mid: "#8cc0ee", low: "#dcebf5", fog: "#cfe2ee", sun: "#fff4e0", sunI: 2.4, hemi: ["#d8ecff", "#5b7a3a", 1.0], exp: 1.0 },
  sunset: { top: "#2a2c66", mid: "#e0805a", low: "#ffd39a", fog: "#e9b48c", sun: "#ffb06a", sunI: 1.9, hemi: ["#ffcfa6", "#4b4a2c", 0.8], exp: 1.05 },
  night: { top: "#04070f", mid: "#0c1730", low: "#1b2747", fog: "#111a30", sun: "#9db8ff", sunI: 0.45, hemi: ["#5a6f9c", "#1a2216", 0.42], exp: 1.15 },
};

export async function startGarden(container: HTMLElement, cb: GardenCallbacks, data: GardenData, opts: GardenOptions = {}): Promise<GardenController> {
  let quality = opts.quality ?? "high";
  const THREE: any = await import("three");
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { DRACOLoader }: any = await import("three/examples/jsm/loaders/DRACOLoader.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const look = SKY[data.sky];
  const night = data.sky === "night";

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exp;
  renderer.shadowMap.enabled = quality === "high";
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.touchAction = "none";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(look.fog, 34, 95);
  scene.background = new THREE.Color(look.fog);
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 160);
  let disposed = false;

  const canvasTex = (c: HTMLCanvasElement, repeat?: [number, number]) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
  const glow = (c: string, i = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  const add = (o: any, x = 0, y = 0, z = 0, cast = true) => {
    o.position.set(x, y, z);
    o.traverse?.((c: any) => { if (c.isMesh) { c.castShadow = cast; c.receiveShadow = true; } });
    scene.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, cast = true, parent: any = scene) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.castShadow = cast;
    me.receiveShadow = true;
    parent.add(me);
    return me;
  };
  const blobT = canvasTex(blobCanvas());
  const blob = (w: number, d: number, x: number, z: number, opacity = 0.75, parent: any = scene) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    m.renderOrder = 1;
    parent.add(m);
    return m;
  };

  // ── The sky: a dome, the sun (or moon), far hills, clouds ──
  const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 16),
    new THREE.MeshBasicMaterial({ map: canvasTex(skyCanvas(look.top, look.mid, look.low)), side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.rotation.x = 0;
  scene.add(dome);
  const sunDir = data.sky === "day" ? new THREE.Vector3(-0.5, 1.0, -0.35) : data.sky === "sunset" ? new THREE.Vector3(-0.9, 0.22, -0.6) : new THREE.Vector3(0.45, 0.9, -0.5);
  sunDir.normalize();
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(glowCanvas(night ? "210,225,255" : data.sky === "sunset" ? "255,170,100" : "255,245,215")), fog: false, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(night ? 9 : 16);
  sunSprite.position.copy(sunDir).multiplyScalar(105);
  scene.add(sunSprite);
  if (night) {
    const n = 450, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * 110; pos[i * 3 + 1] = Math.sin(e) * 110; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 110;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 0.55, fog: false, sizeAttenuation: true })));
  }
  const hillM = mat(night ? "#1d2c22" : data.sky === "sunset" ? "#4d6a3b" : "#6c9a52", { flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hillM);
    h.scale.set(16 + (i % 3) * 6, 5 + (i % 4) * 2.2, 14);
    h.position.set(Math.cos(a) * 70, -1.5, Math.sin(a) * 70);
    h.rotation.y = a;
    scene.add(h);
  }
  const cloudM = mat("#ffffff", { flatShading: true, transparent: true, opacity: night ? 0.18 : 0.92, emissive: "#ffffff", emissiveIntensity: night ? 0 : 0.25 });
  const clouds: any[] = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), cloudM);
      p.scale.set(2.4 + Math.random() * 1.6, 1.3 + Math.random() * 0.6, 1.8);
      p.position.set(k * 2.1 - 3, Math.random() * 0.7, Math.random() * 1.2);
      c.add(p);
    }
    const a = (i / 7) * Math.PI * 2;
    c.position.set(Math.cos(a) * 55, 26 + (i % 3) * 4, Math.sin(a) * 55);
    c.lookAt(0, c.position.y, 0);
    clouds.push(c);
    scene.add(c);
  }

  // ── Light ──
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2]));
  const sun = new THREE.DirectionalLight(look.sun, look.sunI);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.castShadow = quality === "high";
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 100 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  // a soft light from behind the camera, so he isn't a silhouette after dark
  const fillLight = new THREE.PointLight(night ? "#ffd9a8" : "#ffe6cc", night ? 7 : data.sky === "sunset" ? 3 : 0, 9, 1.6);
  scene.add(fillLight);

  // ── The ground ──
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), mat("#ffffff", { map: canvasTex(lawnCanvas(), [36, 36]), roughness: 0.95 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  scene.add(lawn);
  const flat = (w: number, d: number, m: any, x: number, z: number, y = 0.012, ry = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    p.rotation.x = -Math.PI / 2;
    p.rotation.z = ry;
    p.position.set(x, y, z);
    p.receiveShadow = true;
    scene.add(p);
    return p;
  };
  const paveT = canvasTex(pavingCanvas(), [1, 1]);
  const pave = (w: number, d: number, x: number, z: number) => {
    const t = paveT.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(w / 1.2, d / 1.2);
    t.needsUpdate = true;
    return flat(w, d, mat("#ffffff", { map: t, roughness: 0.9 }), x, z, 0.015);
  };
  // the path: from the shop's doors down to the gate, and out to each place
  pave(2.6, 25, 0, 3.5);
  pave(7.0, 1.8, -3.6, -5.8);
  pave(6.6, 1.8, 3.8, 2.2);
  pave(8.4, 8.4, 0, -11 + 4.2); // the forecourt in front of the shop
  flat(5.4, 5.4, mat("#ffffff", { map: canvasTex(pavingCanvas(), [4.5, 4.5]), roughness: 0.9 }), FOUNTAIN.x, FOUNTAIN.z, 0.017);
  flat(PARK.x1 - PARK.x0, PARK.z1 - PARK.z0, mat("#ffffff", { map: canvasTex(gravelCanvas(), [6, 4]), roughness: 1 }), (PARK.x0 + PARK.x1) / 2, (PARK.z0 + PARK.z1) / 2, 0.014);
  flat(PADDOCK.x1 - PADDOCK.x0, PADDOCK.z1 - PADDOCK.z0, mat("#7b8d43", { roughness: 1 }), (PADDOCK.x0 + PADDOCK.x1) / 2, (PADDOCK.z0 + PADDOCK.z1) / 2, 0.008);
  flat(6.2, 3.6, mat("#ffffff", { map: canvasTex(gravelCanvas("#b8a17a"), [3, 2]), roughness: 1 }), -10.6, 6.5, 0.011); // the stable yard
  flat(GAZEBO.w + 1.0, GAZEBO.d + 1.0, mat("#ffffff", { map: canvasTex(boardsCanvas("#9c7552"), [3, 4]), roughness: 0.8 }), GAZEBO.x, GAZEBO.z, 0.03);

  // Things the camera must not sit behind: it moves in front of them instead.
  const occluders: any[] = [];

  // ── Where you can't walk ──
  const BOXES: [number, number, number, number][] = [];
  const CIRCLES: [number, number, number][] = [];
  const solid = (x0: number, x1: number, z0: number, z1: number) => BOXES.push([x0, x1, z0, z1]);

  // ── The loaders ──
  const draco = new DRACOLoader();
  draco.setDecoderPath("/star/shop3d/draco/");
  draco.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  let loaded = 0;
  const load = (url: string) => loader.loadAsync(url).then((g: any) => { loaded++; return g; });
  const [propsG, charG, animG, gardenAnimG] = await Promise.all([
    load("/star/garden3d/props.glb"),
    load("/star/shop3d/character.glb"),
    load("/star/shop3d/anims.glb"),
    load("/star/garden3d/anims.glb"),
  ]);
  if (disposed) throw new Error("disposed");
  const pieces = new Map<string, any>();
  propsG.scene.traverse((o: any) => { if (o.isMesh) pieces.set(o.name, o); });
  /** Many copies of one piece in one draw call: [x, z, scale, rotY, sx?, sy?, sz?]. */
  const many = (key: string, at: number[][], cast = true) => {
    const src = pieces.get(key);
    if (!src || !at.length) return null;
    const im = new THREE.InstancedMesh(src.geometry, src.material, at.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    at.forEach((a, i) => {
      const [x, z, s, ry = 0, sx = 1, sy = 1, sz = 1, y = 0] = a;
      q.setFromEuler(e.set(0, ry, 0));
      m4.compose(v.set(x, y, z), q, sc.set(s * sx, s * sy, s * sz));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = cast;
    im.receiveShadow = true;
    scene.add(im);
    if (cast) occluders.push(im);
    return im;
  };
  const one = (key: string, x: number, z: number, s: number, ry = 0, y = 0) => {
    const src = pieces.get(key);
    if (!src) return null;
    const m = new THREE.Mesh(src.geometry, src.material);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.scale.setScalar(s);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // ── The boundary: it grows with your home (fence → hedge → stone wall) ──
  const edge: number[][] = [];
  const step = data.tier >= 3 ? 1.0 : data.tier >= 1 ? 1.0 : 2.0;
  const run = (x0: number, z0: number, x1: number, z1: number, gap?: [number, number]) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / step);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gap && x > gap[0] && x < gap[1]) continue;
      edge.push([x, z, ry]);
    }
  };
  const B = 19;
  run(-B, -B, -B, B);
  run(B, -B, B, B);
  run(-B, -B, B, -B);
  run(-B, B, B, B, [-1.8, 1.8]); // the gate
  if (data.tier >= 3) {
    many("wall_stone", edge.map(([x, z, ry]) => [x, z, 1, ry, 0.45, 1.25, 1.0]));
    many("pillar_stone", [[-2.1, B, 1, 0, 2.2, 1.9, 2.2], [2.1, B, 1, 0, 2.2, 1.9, 2.2], [-B, -B, 1, 0, 2.2, 1.6, 2.2], [B, -B, 1, 0, 2.2, 1.6, 2.2], [-B, B, 1, 0, 2.2, 1.6, 2.2], [B, B, 1, 0, 2.2, 1.6, 2.2]]);
  } else if (data.tier >= 1) {
    many("hedge_large", edge.map(([x, z, ry]) => [x, z, 1, ry + Math.PI / 2, 2.4, 2.4, 1.0]));
  } else {
    many("fence_planks", edge.map(([x, z, ry]) => [x, z, 1, ry + Math.PI / 2, 2.0, 3.2, 2.0]));
  }

  // ── Trees: a ring beyond the boundary, a few inside ──
  const treeKeys = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_tall", "tree_pine", "tree_pine2"];
  const treeAt: Record<string, number[][]> = {};
  const plant = (key: string, x: number, z: number, s: number, ry = 0) => { (treeAt[key] ??= []).push([x, z, s, ry]); };
  let seed = 12345;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const d = 23 + r() * 9;
    plant(treeKeys[i % treeKeys.length], Math.cos(a) * d, Math.sin(a) * d, 4.2 + r() * 2.2, r() * 6);
  }
  plant("tree_oak", -17, -15.5, 4.6, 1); plant("tree_detailed", 16.8, -15.8, 4.8, 2);
  plant("tree_fat", 17, -2, 4.2, 0.4); plant("tree_default", -17.2, -5.5, 4.4, 2.2);
  plant("tree_oak", 17.2, -9.5, 4.4, 1.3); plant("tree_tall", -3.6, 16.2, 3.6); plant("tree_tall", 3.6, 16.2, 3.6);
  for (const [k, list] of Object.entries(treeAt)) many(k, list);
  for (const [x, z] of [[-17, -15.5], [16.8, -15.8], [17, -2], [-17.2, -5.5], [17.2, -9.5], [-3.6, 16.2], [3.6, 16.2]]) CIRCLES.push([x, z, 0.8]);

  // flower beds down the path, bushes, grass tufts
  // flower beds either side of the path: dark soil, low green, bright blooms
  const soilM = mat("#4a3326", { roughness: 1 });
  const leafM = mat("#3f7d34", { roughness: 0.9, flatShading: true });
  const bloomCols = ["#ff5a6e", "#ffd23f", "#b47cff", "#ffffff", "#ff8a3d"];
  const leafAt: number[][] = [];
  const bloomAt: number[][][] = bloomCols.map(() => []);
  const beds: [number, number, number][] = [[-2.15, 7.9, 7.6], [2.15, 7.9, 7.6], [-2.15, 14.4, 3.2], [2.15, 14.4, 3.2], [-2.15, -5.4 + 6.2, 2.2], [2.15, -5.4 + 6.2, 2.2]];
  for (const [x, zc, len] of beds) {
    box(0.95, 0.12, len, soilM, x, 0.06, zc, false);
    box(1.05, 0.14, 0.08, mat("#d9d2c4"), x, 0.07, zc - len / 2, false);
    box(1.05, 0.14, 0.08, mat("#d9d2c4"), x, 0.07, zc + len / 2, false);
    for (let k = 0; k < len * 9; k++) {
      const px = x + (r() - 0.5) * 0.8, pz = zc + (r() - 0.5) * (len - 0.2);
      leafAt.push([px, pz, 0.11 + r() * 0.06]);
      if (r() < 0.75) bloomAt[Math.floor(r() * bloomCols.length)].push([px + (r() - 0.5) * 0.1, pz + (r() - 0.5) * 0.1, 0.045 + r() * 0.025]);
    }
  }
  const sphereMany = (m: any, at: number[][], y: number, geo = new THREE.IcosahedronGeometry(1, 1)) => {
    const im = new THREE.InstancedMesh(geo, m, at.length);
    const m4 = new THREE.Matrix4();
    at.forEach(([x, z, sc], i) => { m4.makeScale(sc, sc * 0.8, sc); m4.setPosition(x, y + sc * 0.5, z); im.setMatrixAt(i, m4); });
    im.receiveShadow = true;
    scene.add(im);
    return im;
  };
  sphereMany(leafM, leafAt, 0.1);
  bloomAt.forEach((at, i) => sphereMany(mat(bloomCols[i], { roughness: 0.6, emissive: bloomCols[i], emissiveIntensity: night ? 0.05 : 0.12 }), at, 0.24));
  // round leafy bushes (Kenney's read as dark spikes at this size)
  const bushM = mat("#3c7a33", { roughness: 0.85, flatShading: true });
  const bushLightM = mat("#4f9440", { roughness: 0.85, flatShading: true });
  const bushAt: number[][] = [], bushLightAt: number[][] = [];
  const bush = (x: number, z: number, sz: number) => {
    for (let k = 0; k < 5; k++) {
      const a = r() * Math.PI * 2, d = r() * sz * 0.45;
      (k % 2 ? bushLightAt : bushAt).push([x + Math.cos(a) * d, z + Math.sin(a) * d, sz * (0.42 + r() * 0.2)]);
    }
    CIRCLES.push([x, z, sz * 0.55]);
  };
  for (const [x, z] of [[-6.6, -10.2], [6.6, -10.2], [-1.9, 17.6], [1.9, 17.6], [17.6, -12.5], [-17.6, 15], [12.6, -12], [-12.4, -12.6], [CABINET.x - 0.2, CABINET.z - 2.3], [CABINET.x - 0.2, CABINET.z + 2.3]]) bush(x, z, 1.2 + r() * 0.5);
  occluders.push(sphereMany(bushM, bushAt, -0.05), sphereMany(bushLightM, bushLightAt, 0.05));
  const tufts: number[][] = [];
  for (let i = 0; i < 220; i++) {
    const x = -18 + r() * 36, z = -8 + r() * 26;
    if (Math.abs(x) < 2.2 || (x < PADDOCK.x1 + 0.5 && x > PADDOCK.x0 - 0.5 && z > PADDOCK.z0 && z < PADDOCK.z1) || (x > PARK.x0 && z > PARK.z0) || Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 3) continue;
    tufts.push([x, z, 2.2 + r() * 1.4, r() * 6]);
  }
  void tufts; // Kenney's grass reads as dark spikes at this size; the mown lawn is enough

  // ── The shop, where the house was ──
  const shopG = new THREE.Group();
  occluders.push(shopG);
  shopG.position.set((SHOP.x0 + SHOP.x1) / 2, 0, (SHOP.z0 + SHOP.z1) / 2);
  scene.add(shopG);
  const W = SHOP.x1 - SHOP.x0, D = SHOP.z1 - SHOP.z0, H = SHOP.h;
  const stoneM = mat("#efe6d6", { roughness: 0.85 });
  const darkM = mat("#2e2620", { roughness: 0.6 });
  const goldM = mat("#c79a4b", { roughness: 0.35, metalness: 0.8 });
  const front = D / 2;
  box(W, H, D - 0.4, stoneM, 0, H / 2, -0.2, true, shopG);
  const fz = front - 0.05;
  box(W + 0.4, 0.35, D + 0.4, mat("#3a2f28", { roughness: 0.7 }), 0, H + 0.17, 0, true, shopG); // roof cornice
  box(W + 0.5, 0.08, 0.5, goldM, 0, H - 0.02, front + 0.05, false, shopG);
  // the front wall in cream stone, with a dark plinth
  box((W - DOOR.half * 2) / 2, H, 0.3, stoneM, -(W / 2 + DOOR.half) / 2, H / 2, fz, true, shopG);
  box((W - DOOR.half * 2) / 2, H, 0.3, stoneM, (W / 2 + DOOR.half) / 2, H / 2, fz, true, shopG);
  box(DOOR.half * 2, H - DOOR.h, 0.3, stoneM, 0, DOOR.h + (H - DOOR.h) / 2, fz, true, shopG);
  box(W + 0.02, 0.35, 0.34, mat("#5a4c40", { roughness: 0.8 }), 0, 0.17, fz + 0.02, true, shopG);
  // a walnut frame round the doorway
  for (const sx of [-1, 1]) box(0.22, DOOR.h + 0.2, 0.42, darkM, sx * (DOOR.half + 0.11), (DOOR.h + 0.2) / 2, fz + 0.06, true, shopG);
  box(DOOR.half * 2 + 0.44, 0.24, 0.42, darkM, 0, DOOR.h + 0.12, fz + 0.06, true, shopG);
  // a dark awning over the door and windows
  const awn = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 0.08, 1.3), mat("#2b211b", { roughness: 0.6 }));
  awn.position.set(0, 3.25, fz + 0.75);
  awn.rotation.x = 0.16;
  awn.castShadow = true;
  shopG.add(awn);
  box(W - 0.6, 0.06, 0.06, goldM, 0, 3.15, fz + 1.4, false, shopG);
  const inside = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.half * 2, DOOR.h), new THREE.MeshBasicMaterial({ color: "#ffd9a0", fog: false, toneMapped: false }));
  inside.position.set(0, DOOR.h / 2, fz - 0.6);
  shopG.add(inside);
  // floor-to-ceiling shop windows either side, lit from inside
  const winM = new THREE.MeshStandardMaterial({ color: "#3a2a1c", emissive: "#ffcf8a", emissiveIntensity: night ? 1.6 : 0.85, roughness: 0.1, metalness: 0.3 });
  for (const sx of [-1, 1]) {
    box(2.6, 2.7, 0.05, winM, sx * 3.4, 1.65, fz + 0.18, false, shopG);
    box(2.8, 0.08, 0.12, goldM, sx * 3.4, 3.05, fz + 0.2, false, shopG);
    box(2.8, 0.08, 0.12, goldM, sx * 3.4, 0.27, fz + 0.2, false, shopG);
  }
  box(DOOR.half * 2 + 0.3, 0.1, 0.14, goldM, 0, DOOR.h + 0.02, fz + 0.2, false, shopG);
  // the name in lights over the door
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 6 * 192 / 1024),
    new THREE.MeshBasicMaterial({ map: canvasTex(neonCanvas("KNOWITBALL", "#ffcf6a")), transparent: true, depthWrite: false, toneMapped: false }));
  sign.position.set(0, 4.25, fz + 0.2);
  shopG.add(sign);
  // a glow on the forecourt from the door
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshBasicMaterial({ map: canvasTex(glowCanvas()), transparent: true, depthWrite: false, opacity: night ? 0.75 : 0.35 }));
  doorGlow.rotation.x = -Math.PI / 2;
  doorGlow.position.set(0, 0.025, SHOP.z1 + 1.1);
  scene.add(doorGlow);
  // pots by the door
  one("potted_plant", -1.9, SHOP.z1 + 0.55, 3.0);
  one("potted_plant", 1.9, SHOP.z1 + 0.55, 3.0);
  solid(SHOP.x0 - 0.2, SHOP.x1 + 0.2, SHOP.z0 - 0.2, SHOP.z1 + 0.1);
  CIRCLES.push([-1.9, SHOP.z1 + 0.55, 0.4], [1.9, SHOP.z1 + 0.55, 0.4]);

  // lanterns down the path (lit at night)
  const lampAt = [[-1.65, -7.2], [1.65, -7.2], [-1.65, 6], [1.65, 6], [-1.65, 13], [1.65, 13]];
  many("lantern", lampAt.map(([x, z]) => [x, z, 1.25]));
  const lampHeads: any[] = [];
  for (const [x, z] of lampAt) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), glow("#ffd28a", night ? 3.2 : 0.6));
    g.position.set(x, 1.83, z);
    scene.add(g);
    lampHeads.push(g);
    CIRCLES.push([x, z, 0.2]);
    if (night) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: canvasTex(glowCanvas()), transparent: true, depthWrite: false, opacity: 0.45 }));
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(x, 0.03, z);
      scene.add(gl);
    }
  }
  if (night) {
    for (const [x, y, z] of [[0, 2.4, SHOP.z1 + 1.6], [0, 2.4, 6], [GAZEBO.x, 2.4, GAZEBO.z], [CABINET.x, 1.8, CABINET.z]]) {
      const pl = new THREE.PointLight("#ffcf8a", 9, 9, 2);
      pl.position.set(x, y, z);
      scene.add(pl);
    }
  }

  // ── The fountain, and a bird that drops in for a drink ──
  const fountainMesh = one("fountain", FOUNTAIN.x, FOUNTAIN.z, 1.9);
  if (fountainMesh) occluders.push(fountainMesh);
  const waterM = new THREE.MeshStandardMaterial({ color: "#5aa8d6", roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.85, emissive: "#0c3550", emissiveIntensity: 0.4 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.62, 40), waterM);
  water.rotation.x = -Math.PI / 2;
  water.position.set(FOUNTAIN.x, 0.36, FOUNTAIN.z);
  scene.add(water);
  const stoneLightM = mat("#d9d2c4", { roughness: 0.7 });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.3, 16), stoneLightM);
  add(column, FOUNTAIN.x, 0.65, FOUNTAIN.z);
  occluders.push(column);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 0.28, 24), stoneLightM);
  add(bowl, FOUNTAIN.x, 1.35, FOUNTAIN.z);
  occluders.push(bowl);
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.66, 24), waterM);
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.set(FOUNTAIN.x, 1.48, FOUNTAIN.z);
  scene.add(bowlWater);
  const topper = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), stoneLightM);
  add(topper, FOUNTAIN.x, 1.72, FOUNTAIN.z);
  // the spray: drops thrown up from the top, falling into the bowls
  const DROPS = 140;
  const dropPos = new Float32Array(DROPS * 3);
  const dropVel = new Float32Array(DROPS * 3);
  const resetDrop = (i: number) => {
    const a = Math.random() * Math.PI * 2, sp = 0.35 + Math.random() * 0.35;
    dropPos[i * 3] = FOUNTAIN.x; dropPos[i * 3 + 1] = 1.78; dropPos[i * 3 + 2] = FOUNTAIN.z;
    dropVel[i * 3] = Math.cos(a) * sp; dropVel[i * 3 + 1] = 1.4 + Math.random() * 0.6; dropVel[i * 3 + 2] = Math.sin(a) * sp;
  };
  for (let i = 0; i < DROPS; i++) { resetDrop(i); dropPos[i * 3 + 1] = 1.4 + Math.random() * 0.5; }
  const dropG = new THREE.BufferGeometry();
  dropG.setAttribute("position", new THREE.BufferAttribute(dropPos, 3));
  const spray = new THREE.Points(dropG, new THREE.PointsMaterial({ color: "#e8f6ff", size: 0.07, map: canvasTex(glowCanvas("230,245,255")), transparent: true, opacity: 0.9, depthWrite: false }));
  scene.add(spray);
  CIRCLES.push([FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r]);

  // ── The trophy cabinet: a glass summer-house, your trophies on lit shelves ──
  const cab = new THREE.Group();
  cab.position.set(CABINET.x, 0, CABINET.z);
  cab.rotation.y = Math.PI / 2; // it faces the path (east)
  scene.add(cab);
  occluders.push(cab);
  const frameM = mat("#f4f1ea", { roughness: 0.5 });
  const glassM = new THREE.MeshStandardMaterial({ color: "#cfe6f5", transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false });
  const cw = CABINET.w, cd = CABINET.d, ch = 2.4;
  box(cw + 0.2, 0.18, cd + 0.2, mat("#bdb5a6"), 0, 0.09, 0, true, cab);
  for (const [x, z] of [[-cw / 2, -cd / 2], [cw / 2, -cd / 2], [-cw / 2, cd / 2], [cw / 2, cd / 2]]) box(0.1, ch, 0.1, frameM, x, 0.18 + ch / 2, z, true, cab);
  box(cw, ch, 0.04, frameM, 0, 0.18 + ch / 2, -cd / 2, true, cab); // the back wall
  for (const x of [-cw / 2, cw / 2]) box(0.03, ch, cd, glassM, x, 0.18 + ch / 2, 0, false, cab);
  box(cw, ch, 0.03, glassM, 0, 0.18 + ch / 2, cd / 2, false, cab); // glass front
  // a pitched roof
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, (cw + 0.6) * 0.72, 1.0, 4, 1), mat("#3d4a55", { roughness: 0.6, flatShading: true }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, (cd + 0.6) / (cw + 0.6));
  roof.position.set(0, 0.18 + ch + 0.5, 0);
  roof.castShadow = true;
  cab.add(roof);
  const shelfM = mat("#6b4a32", { roughness: 0.5 });
  const shelfY = [0.75, 1.35, 1.95];
  for (const y of shelfY) {
    box(cw - 0.3, 0.05, 0.55, shelfM, 0, y, -cd / 2 + 0.36, false, cab);
    box(cw - 0.32, 0.025, 0.02, glow("#ffd59a", 2.2), 0, y + 0.02, -cd / 2 + 0.64, false, cab);
  }
  const cabLight = new THREE.PointLight("#ffe2b0", night ? 6 : 3, 5, 2);
  cabLight.position.set(0, 2.2, -cd / 2 + 0.9);
  cab.add(cabLight);
  const texLoader = new THREE.TextureLoader();
  const cupM = mat("#e2b63e", { roughness: 0.25, metalness: 0.9 });
  const cupShape = [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.09, 0), new THREE.Vector2(0.09, 0.03), new THREE.Vector2(0.03, 0.05), new THREE.Vector2(0.025, 0.14), new THREE.Vector2(0.11, 0.2), new THREE.Vector2(0.13, 0.33), new THREE.Vector2(0.12, 0.34)];
  const cupGeo = new THREE.LatheGeometry(cupShape, 20);
  data.trophies.slice(0, 12).forEach((t, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    const x = -cw / 2 + 0.55 + col * ((cw - 1.1) / 3);
    const y = shelfY[2 - row] + 0.03;
    const z = -cd / 2 + 0.36;
    if (t.art) {
      texLoader.load(t.art, (tx: any) => {
        if (disposed) return;
        tx.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true }));
        const a = tx.image ? tx.image.width / tx.image.height : 0.8;
        sp.scale.set(0.46 * Math.min(1, a), 0.46 / Math.max(1, a), 1);
        sp.position.set(x, y + 0.24, z);
        cab.add(sp);
      });
    } else {
      const cup = new THREE.Mesh(cupGeo, cupM);
      cup.position.set(x, y, z);
      cup.castShadow = true;
      cab.add(cup);
    }
    if (t.count > 1) {
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(countCanvas(t.count)), transparent: true, depthWrite: false }));
      n.scale.set(0.24, 0.12, 1);
      n.position.set(x + 0.18, y + 0.08, z + 0.2);
      cab.add(n);
    }
  });
  solid(CABINET.x - cd / 2 - 0.15, CABINET.x + cd / 2 + 0.15, CABINET.z - cw / 2 - 0.15, CABINET.z + cw / 2 + 0.15);


  // ── The gazebo: a pergola, a bench, three team-mates, cans, a plant ──
  const woodM = mat("#ffffff", { map: canvasTex(boardsCanvas("#8b5e3c"), [1, 1]), roughness: 0.75 });
  const gz = GAZEBO;
  const posts = [[gz.x - gz.w / 2, gz.z - gz.d / 2], [gz.x + gz.w / 2, gz.z - gz.d / 2], [gz.x - gz.w / 2, gz.z + gz.d / 2], [gz.x + gz.w / 2, gz.z + gz.d / 2]];
  const gzG = new THREE.Group();
  scene.add(gzG);
  occluders.push(gzG);
  for (const [x, z] of posts) { box(0.16, 2.7, 0.16, woodM, x, 1.35, z, true, gzG); CIRCLES.push([x, z, 0.18]); }
  for (const z of [gz.z - gz.d / 2, gz.z + gz.d / 2]) box(gz.w + 0.5, 0.16, 0.12, woodM, gz.x, 2.72, z, true, gzG);
  for (const x of [gz.x - gz.w / 2, gz.x + gz.w / 2]) box(0.12, 0.16, gz.d + 0.5, woodM, x, 2.72, gz.z, true, gzG);
  for (let k = 0; k < 9; k++) box(gz.w + 0.7, 0.1, 0.08, woodM, gz.x, 2.86, gz.z - gz.d / 2 + (k / 8) * gz.d, true, gzG);
  // climbing green on the back beam
  // climbing leaves along the back beam
  const vineAt: number[][] = [];
  for (let k = 0; k < 26; k++) vineAt.push([gz.x + gz.w / 2 + (r() - 0.5) * 0.3, gz.z - gz.d / 2 + r() * gz.d, 0.14 + r() * 0.1]);
  occluders.push(sphereMany(leafM, vineAt, 2.66));
  // the bench: slats on dark iron legs, against the back
  const ironM = mat("#24262a", { roughness: 0.45, metalness: 0.6 });
  const seatH = 0.46, benchLen = 2.7;
  for (let k = 0; k < 4; k++) box(0.1, 0.04, benchLen, woodM, BENCH_X - 0.2 + k * 0.12, seatH, gz.z);
  for (let k = 0; k < 3; k++) box(0.04, 0.1, benchLen, woodM, BENCH_X + 0.27, seatH + 0.18 + k * 0.14, gz.z);
  for (const dz of [-benchLen / 2 + 0.1, 0, benchLen / 2 - 0.1]) {
    box(0.5, 0.05, 0.05, ironM, BENCH_X, seatH - 0.05, gz.z + dz);
    box(0.05, seatH - 0.05, 0.05, ironM, BENCH_X - 0.2, (seatH - 0.05) / 2, gz.z + dz);
    box(0.05, seatH + 0.5, 0.05, ironM, BENCH_X + 0.25, (seatH + 0.5) / 2, gz.z + dz);
  }
  solid(BENCH_X - 0.35, BENCH_X + 0.4, gz.z - benchLen / 2, gz.z + benchLen / 2);
  // a side table with the KIB cans, and the plant pot
  const tableX = BENCH_X - 0.1, tableZ = gz.z + benchLen / 2 + 0.55;
  box(0.55, 0.04, 0.55, woodM, tableX, 0.55, tableZ);
  box(0.06, 0.53, 0.06, ironM, tableX, 0.27, tableZ);
  const canColours = ["#e11d48", "#2563eb", "#7c3aed"];
  const canG = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 14);
  canColours.forEach((c, i) => {
    const can = new THREE.Mesh(canG, mat(c, { roughness: 0.3, metalness: 0.7 }));
    can.position.set(tableX - 0.12 + i * 0.12, 0.63, tableZ + (i === 1 ? 0.1 : -0.04));
    can.castShadow = true;
    scene.add(can);
  });
  const fallen = new THREE.Mesh(canG, mat("#e11d48", { roughness: 0.3, metalness: 0.7 }));
  fallen.rotation.z = Math.PI / 2;
  fallen.position.set(BENCH_X - 0.65, 0.05, gz.z - 0.9);
  scene.add(fallen);
  CIRCLES.push([tableX, tableZ, 0.35]);
  one("potted_plant", BENCH_X - 0.05, gz.z - benchLen / 2 - 0.5, 3.4);
  CIRCLES.push([BENCH_X - 0.05, gz.z - benchLen / 2 - 0.5, 0.35]);
  one("pot_large", gz.x - gz.w / 2 - 0.6, gz.z + gz.d / 2 + 0.5, 2.2);
  sphereMany(bushLightM, [[gz.x - gz.w / 2 - 0.6, gz.z + gz.d / 2 + 0.5, 0.42]], 0.35);

  // the teqball table: a curved black top (high in the middle, curving down
  // to both ends), orange arched legs, a net across the middle
  const teq = new THREE.Group();
  teq.position.set(TEQ.x, 0, TEQ.z);
  scene.add(teq);
  occluders.push(teq);
  const TL = 3.0, TW = 1.7;
  const topG = new THREE.BoxGeometry(TW, 0.05, TL, 1, 1, 30);
  const tp = topG.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const z = tp.getZ(i);
    tp.setY(i, tp.getY(i) + 0.76 - 0.11 * Math.pow(z / (TL / 2), 2) * 2.2);
  }
  topG.computeVertexNormals();
  const tTop = new THREE.Mesh(topG, mat("#1d1f22", { roughness: 0.32, metalness: 0.25 }));
  tTop.castShadow = true;
  tTop.receiveShadow = true;
  teq.add(tTop);
  const edgeG = new THREE.BoxGeometry(TW + 0.02, 0.012, TL, 1, 1, 30);
  const ep = edgeG.attributes.position;
  for (let i = 0; i < ep.count; i++) { const z = ep.getZ(i); ep.setY(i, ep.getY(i) + 0.787 - 0.11 * Math.pow(z / (TL / 2), 2) * 2.2); }
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, TL), mat("#f2f2f2"));
  line.position.y = 0.787;
  void edgeG;
  const orangeM = mat("#ff6a1a", { roughness: 0.45 });
  for (const s2 of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 24, Math.PI), orangeM);
    leg.rotation.y = Math.PI / 2;
    leg.position.set(s2 * 0.62, 0.0, 0);
    leg.scale.set(1, 1.15, 1);
    leg.castShadow = true;
    teq.add(leg);
  }
  const net = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.1, 0.15, 0.03), mat("#f4f4f4", { roughness: 0.6 }));
  net.position.set(0, 0.86, 0);
  teq.add(net);
  for (const s2 of [-1, 1]) box(0.04, 0.2, 0.04, mat("#111111"), s2 * (TW / 2 + 0.05), 0.86, 0, false, teq);
  solid(TEQ.x - 0.9, TEQ.x + 0.9, TEQ.z - 1.55, TEQ.z + 1.55);
  // a ball resting by it
  const ballM = mat("#f6f6f6", { roughness: 0.5 });
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 2), ballM);
  add(ball, TEQ.x + 1.0, 0.11, TEQ.z + 1.9);

  // ── The stable, paddock, hay and water ──
  const st = STABLE;
  const stableLv = Math.max(1, data.stable);
  const stallN = data.stable >= 4 ? 3 : data.stable >= 2 ? 2 : 1;
  const stableM = mat("#ffffff", { map: canvasTex(boardsCanvas("#7a4b2c"), [3, 1]), roughness: 0.8 });
  const sg = new THREE.Group();
  sg.position.set(st.x, 0, st.z);
  scene.add(sg);
  occluders.push(sg);
  const sh = 3.0;
  box(st.w, sh, 0.15, stableM, 0, sh / 2, -st.d / 2, true, sg);
  box(st.w, sh, 0.15, stableM, 0, sh / 2, st.d / 2, true, sg);
  box(0.15, sh, st.d, stableM, -st.w / 2, sh / 2, 0, true, sg);
  // the front: stall doors with dark openings
  const stallW = st.d / stallN;
  for (let k = 0; k < stallN; k++) {
    const zc = -st.d / 2 + stallW * (k + 0.5);
    box(0.15, sh - 1.4, stallW - 1.3, stableM, st.w / 2, 1.4 + (sh - 1.4) / 2, zc, true, sg);
    box(0.15, 1.2, stallW - 1.3, stableM, st.w / 2, 0.6, zc, true, sg);
    box(0.02, 1.0, stallW - 1.4, mat("#1a120c"), st.w / 2 - 0.05, 1.9, zc, false, sg);
    box(0.15, sh, 0.65, stableM, st.w / 2, sh / 2, zc - stallW / 2 + 0.32, true, sg);
    box(0.15, sh, 0.65, stableM, st.w / 2, sh / 2, zc + stallW / 2 - 0.32, true, sg);
    box(0.18, 0.12, stallW - 1.25, mat("#e9e2d2"), st.w / 2 + 0.02, 1.25, zc, false, sg);
  }
  // a dark pitched roof (a stone-tiled one once the stable is grand)
  const sRoofM = mat(stableLv >= 4 ? "#59473a" : "#3f2f25", { roughness: 0.7, flatShading: true });
  const sRoof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), sRoofM);
  sRoof.rotation.y = Math.PI / 4;
  sRoof.scale.set((st.w + 0.9) * 0.72, 1.5, (st.d + 0.9) * 0.72);
  sRoof.position.set(0, sh + 0.75, 0);
  sRoof.castShadow = true;
  sg.add(sRoof);
  if (stableLv >= 3) { // a little cupola with a weather vane
    box(0.8, 0.8, 0.8, mat("#f2ede2"), 0, sh + 1.6, 0, true, sg);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.6, 4), sRoofM);
    cap.rotation.y = Math.PI / 4;
    cap.position.set(0, sh + 2.3, 0);
    sg.add(cap);
  }
  solid(st.x - st.w / 2 - 0.1, st.x + st.w / 2 + 0.15, st.z - st.d / 2 - 0.1, st.z + st.d / 2 + 0.1);
  // the paddock: post-and-rail fence with a gap to walk in
  const pd = PADDOCK;
  const rails: number[][] = [];
  const railRun = (x0: number, z0: number, x1: number, z1: number, gap?: [number, number]) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 2);
    const ry = Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gap && z > gap[0] && z < gap[1]) continue;
      rails.push([x, z, 1, -ry, 2.0, 3.4, 2.0]);
    }
  };
  railRun(pd.x0, pd.z0, pd.x1, pd.z0);
  railRun(pd.x0, pd.z1, pd.x1, pd.z1);
  railRun(pd.x1, pd.z0, pd.x1, pd.z1, pd.gate);
  railRun(pd.x0, pd.z0, pd.x0, st.z - st.d / 2);
  railRun(pd.x0, st.z + st.d / 2, pd.x0, pd.z1);
  many("fence_wood", rails);
  const fenceT = 0.12;
  solid(pd.x0, pd.x1, pd.z0 - fenceT, pd.z0 + fenceT);
  solid(pd.x0, pd.x1, pd.z1 - fenceT, pd.z1 + fenceT);
  solid(pd.x1 - fenceT, pd.x1 + fenceT, pd.z0, pd.gate[0]);
  solid(pd.x1 - fenceT, pd.x1 + fenceT, pd.gate[1], pd.z1);
  // hay bales and a water trough
  const strawM = mat("#ffffff", { map: canvasTex(strawCanvas()), roughness: 1 });
  const bale = (x: number, z: number, ry: number, y = 0.42) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 18), strawM);
    b.rotation.z = Math.PI / 2;
    b.rotation.y = ry;
    add(b, x, y, z);
    CIRCLES.push([x, z, 0.6]);
  };
  bale(pd.x0 + 1.4, pd.z0 + 1.2, 0.3);
  bale(pd.x0 + 2.6, pd.z0 + 1.0, -0.2);
  if (stableLv >= 2) bale(pd.x0 + 2.0, pd.z0 + 1.1, 0.05, 1.3);
  const trough = new THREE.Group();
  box(1.8, 0.5, 0.6, mat("#8b8f94", { roughness: 0.5, metalness: 0.5 }), 0, 0.25, 0, true, trough);
  const tw = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.46), waterM);
  tw.rotation.x = -Math.PI / 2;
  tw.position.y = 0.46;
  trough.add(tw);
  trough.position.set(pd.x1 - 1.4, 0, pd.z1 - 1.0);
  scene.add(trough);
  solid(pd.x1 - 2.4, pd.x1 - 0.4, pd.z1 - 1.4, pd.z1 - 0.6);
  one("bucket", pd.x1 - 2.7, pd.z1 - 0.9, 2.6);
  one("log_stack", st.x + 0.6, st.z + st.d / 2 + 0.9, 2.6, 0.3);

  // ── Parking for your cars ──
  const bays = [8.0, 11.0, 14.0];
  const lineM = mat("#f4f1ea", { roughness: 0.6 });
  for (let k = 0; k <= bays.length; k++) flat(0.08, 5.4, lineM, bays[0] - 1.5 + k * 3, PARK.z0 + 3.6, 0.02);
  const carGroups: any[] = [];
  data.cars.slice(0, 3).forEach((url, i) => {
    load(url).then((g: any) => {
      if (disposed) return;
      const c = g.scene;
      c.rotation.y = Math.PI / 2;
      c.position.set(bays[i], 0, PARK.z0 + 3.6);
      c.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(c);
      carGroups.push(c);
    }).catch((e: any) => console.error("garden car", e));
    solid(bays[i] - 1.0, bays[i] + 1.0, PARK.z0 + 1.2, PARK.z0 + 6.0);
  });

  // ── People: you, and the team-mates on the bench ──
  const clip = (g: any, n: string) => g.animations.find((a: any) => a.name === n);
  const dress = (root: any, number: number, key: string) => {
    const U = {
      uShirt: { value: new THREE.Color(data.kit.shirt) },
      uTrim: { value: new THREE.Color(data.kit.trim) },
      uBoot: { value: new THREE.Color("#141416") },
      uNum: { value: canvasTex(numberCanvas(number, "#ffffff")) },
      uPelvis: { value: new THREE.Vector3() },
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uRight: { value: new THREE.Vector3(1, 0, 0) },
      uFwd: { value: new THREE.Vector3(0, 0, 1) },
    };
    root.traverse((o: any) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      if (o.isSkinnedMesh && o.material?.name === "Skin") {
        o.material = o.material.clone();
        o.material.name = "Skin";
        dressInKit(THREE, o, U, key);
      }
      if (o.material?.name === "Hair") { o.material = o.material.clone(); o.material.name = "Hair"; }
    });
    return U;
  };
  const player = SkeletonUtils.clone(charG.scene);
  dress(player, data.number, "garden-kit-you");
  player.traverse((o: any) => { if (o.material?.name === "Hair") o.material.color.set("#4a2e1c"); });
  const st0 = data.arrive === "shop" ? START_SHOP : START_GATE;
  player.position.set(st0.x, 0, st0.z);
  player.rotation.y = st0.yaw;
  scene.add(player);
  const playerBlob = blob(0.9, 0.9, st0.x, st0.z, 0.9);
  const mixer = new THREE.AnimationMixer(player);
  const act = (n: string) => { const a = mixer.clipAction(clip(animG, n)); a.play(); a.setEffectiveWeight(0); return a; };
  const idleA = act("Idle_Loop"), walkA = act("Walk_Loop"), jogA = act("Jog_Fwd_Loop");
  idleA.setEffectiveWeight(1);

  // three team-mates, sitting and chatting; one has a can and drinks from it
  const HAIR = ["#1b120c", "#4a2e1c", "#2b1b10"];
  const mates: { root: any; mixer: any; drink?: { a: any; sit: any; next: number; t: number } }[] = [];
  data.mates.slice(0, 3).forEach((num, i) => {
    const m = SkeletonUtils.clone(charG.scene);
    dress(m, num, `garden-kit-mate${i}`);
    m.traverse((o: any) => { if (o.material?.name === "Hair") o.material.color.set(HAIR[i % 3]); });
    const z = gz.z - benchLen / 2 + 0.5 + i * ((benchLen - 1.0) / 2);
    m.position.set(BENCH_X - 0.08, 0, z);
    m.rotation.y = -Math.PI / 2; // facing out of the gazebo (west)
    scene.add(m);
    const mx = new THREE.AnimationMixer(m);
    const name = i === 1 ? "Sitting_Talking_Loop" : "Sitting_Idle_Loop";
    const sit = mx.clipAction(clip(gardenAnimG, name));
    sit.time = i * 1.7;
    sit.play();
    const entry: (typeof mates)[number] = { root: m, mixer: mx };
    if (i === 0) {
      // a can in his right hand
      let hand: any = null;
      m.traverse((o: any) => { if (o.isBone && /hand_r$/i.test(o.name)) hand = o; });
      if (hand) {
        const can = new THREE.Mesh(canG, mat("#2563eb", { roughness: 0.3, metalness: 0.7 }));
        can.scale.setScalar(1);
        can.position.set(0.0, 0.08, 0.04);
        hand.add(can);
      }
      const drinkClip = clip(gardenAnimG, "Consume");
      if (drinkClip) {
        const a = mx.clipAction(drinkClip);
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = false;
        entry.drink = { a, sit, next: 4, t: 0 };
      }
    }
    mates.push(entry);
  });

  // ── Your horse, grazing and wandering the paddock ──
  let horse: { root: any; mixer: any; idle: any; walk: any; target: [number, number]; wait: number } | null = null;
  if (data.horse) {
    load("/star/garden3d/horse.glb").then((g: any) => {
      if (disposed) return;
      const root = g.scene;
      root.scale.setScalar(0.24);
      root.position.set(-9.5, 0, 7.5);
      // the pack's materials came through with opacity 0: make them solid
      root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material.opacity = 1; o.material.transparent = false; } });
      scene.add(root);
      const mx = new THREE.AnimationMixer(root);
      const find = (n: string) => g.animations.find((a: any) => a.name.endsWith(n));
      const idle = mx.clipAction(find("Idle")); idle.play();
      const walk = mx.clipAction(find("WalkSlow") ?? find("Walk")); walk.play(); walk.setEffectiveWeight(0);
      horse = { root, mixer: mx, idle, walk, target: [-9.5, 7.5], wait: 3 };
    }).catch((e: any) => console.error("garden horse", e));
  }

  // ── A bird: circles high, drops onto the fountain's rim, drinks, flies off ──
  let bird: { root: any; mixer: any; fly: any; idle: any; phase: "circle" | "land" | "drink" | "leave"; t: number; next: number } | null = null;
  load("/star/garden3d/bird.glb").then((g: any) => {
    if (disposed) return;
    const root = g.scene;
    root.scale.setScalar(0.04);
    root.traverse((o: any) => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; o.material.opacity = 1; o.material.transparent = false; } });
    scene.add(root);
    const mx = new THREE.AnimationMixer(root);
    const find = (n: string) => g.animations.find((a: any) => a.name.endsWith(n));
    const fly = mx.clipAction(find("Flying")); fly.play();
    const idle = mx.clipAction(find("Idle") ?? find("Flying")); idle.play(); idle.setEffectiveWeight(0);
    bird = { root, mixer: mx, fly, idle, phase: "circle", t: 0, next: 6 };
  }).catch((e: any) => console.error("garden bird", e));
  const RIM = { x: FOUNTAIN.x + 1.66, y: 0.5, z: FOUNTAIN.z };

  // ── Input, camera, the loop ──
  let stick = { x: 0, y: 0 };
  const keys = new Set<string>();
  let speed = 0, yaw = st0.yaw, camYaw = st0.yaw + Math.PI, orbitHold = 0;
  let near: GardenSpot | null = null;
  let frames = 0, fpsT0 = performance.now(), slowSeconds = 0, gameT = 0;
  let doorFired = false;
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
    camera.fov = w / h < 0.7 ? 62 : 54;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
  const collide = (x: number, z: number) => {
    const rr = 0.32;
    // the shop's doorway: walk in and you are inside
    if (Math.abs(x) < DOOR.half - 0.2 && z < SHOP.z1 + 0.7 && z > SHOP.z1 - 1.2) {
      if (!doorFired && z < SHOP.z1 - 0.1) { doorFired = true; cb.onShopDoor(); }
      return [x, Math.max(z, SHOP.z1 - 0.6)];
    }
    x = Math.max(-LIMIT, Math.min(LIMIT, x));
    z = Math.max(-LIMIT, Math.min(LIMIT, z));
    for (const [x0, x1, z0, z1] of BOXES) {
      if (x > x0 - rr && x < x1 + rr && z > z0 - rr && z < z1 + rr) {
        const push = [x - (x0 - rr), x1 + rr - x, z - (z0 - rr), z1 + rr - z];
        const m = Math.min(...push);
        if (m === push[0]) x = x0 - rr; else if (m === push[1]) x = x1 + rr; else if (m === push[2]) z = z0 - rr; else z = z1 + rr;
      }
    }
    for (const [cx, cz, cr] of CIRCLES) {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz);
      if (d < cr + rr && d > 1e-6) { x = cx + (dx / d) * (cr + rr); z = cz + (dz / d) * (cr + rr); }
    }
    return [x, z];
  };
  const ZONES: { id: GardenSpot; inside: (x: number, z: number) => boolean }[] = [
    { id: "shop", inside: (x, z) => Math.abs(x) < 3 && z < SHOP.z1 + 2.6 },
    { id: "trophies", inside: (x, z) => Math.hypot(x - CABINET.x, z - CABINET.z) < 3.4 },
    { id: "teqball", inside: (x, z) => Math.hypot(x - TEQ.x, z - TEQ.z) < 2.6 },
    { id: "mates", inside: (x, z) => x > gz.x - gz.w / 2 - 1.0 && x < gz.x + gz.w / 2 + 0.5 && Math.abs(z - gz.z) < gz.d / 2 + 0.4 },
    { id: "horse", inside: (x, z) => x > PADDOCK.x0 - 0.5 && x < PADDOCK.x1 + 1.4 && z > PADDOCK.z0 - 0.5 && z < PADDOCK.z1 + 0.5 },
    { id: "cars", inside: (x, z) => x > PARK.x0 - 0.5 && z > PARK.z0 - 0.8 },
    { id: "fountain", inside: (x, z) => Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < 3.4 },
  ];
  const clock = new THREE.Clock();
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), want = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let first = true;
  const v3 = new THREE.Vector3();
  const camRay = new THREE.Raycaster();
  const headPos = new THREE.Vector3(), rayDir = new THREE.Vector3();

  renderer.setAnimationLoop(() => {
    if (disposed) return;
    const dt = opts.fixedStep ?? Math.min(0.05, clock.getDelta());
    gameT += dt;
    let ix = stick.x, iy = stick.y;
    if (keys.size) {
      ix = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      iy = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);
      const m = Math.hypot(ix, iy) || 1;
      const runK = keys.has("shift") ? 1 : 0.6;
      ix = (ix / m) * runK; iy = (iy / m) * runK;
    }
    const mag = Math.min(1, Math.hypot(ix, iy));
    const target = mag < 0.08 ? 0 : mag < 0.75 ? WALK * (mag / 0.75) : WALK + (JOG - WALK) * ((mag - 0.75) / 0.25);
    speed += (target - speed) * Math.min(1, dt * 8);
    if (mag >= 0.08) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      yaw += angDiff(yaw, Math.atan2(fx * iy + rx * ix, fz * iy + rz * ix)) * Math.min(1, dt * 10);
    }
    const [nx, nz] = collide(player.position.x + Math.sin(yaw) * speed * dt, player.position.z + Math.cos(yaw) * speed * dt);
    player.position.x = nx; player.position.z = nz;
    player.rotation.y = yaw;
    playerBlob.position.set(nx, 0.02, nz);
    const wWalk = speed < WALK ? speed / WALK : Math.max(0, 1 - (speed - WALK) / (JOG - WALK));
    const wJog = speed <= WALK ? 0 : Math.min(1, (speed - WALK) / (JOG - WALK));
    idleA.setEffectiveWeight(Math.max(0, 1 - speed / WALK));
    walkA.setEffectiveWeight(wWalk);
    jogA.setEffectiveWeight(wJog);
    walkA.timeScale = Math.max(0.6, speed / 1.45);
    jogA.timeScale = Math.max(0.8, speed / 3.2);
    mixer.update(dt);

    // team-mates: sit, chat; the one with the can takes a drink now and then
    for (const m of mates) {
      if (m.drink) {
        const d = m.drink;
        d.next -= dt;
        if (d.next <= 0 && d.t <= 0) { d.a.reset(); d.a.play(); d.t = d.a.getClip().duration; d.next = 9 + Math.random() * 6; }
        if (d.t > 0) {
          d.t -= dt;
          const dur = d.a.getClip().duration;
          const w = Math.min(1, (dur - d.t) / 0.35, d.t / 0.35);
          // only the upper body drinks: blend the clip in lightly over the sitting pose
          d.a.setEffectiveWeight(Math.max(0, w) * 0.85);
          d.sit.setEffectiveWeight(1 - Math.max(0, w) * 0.5);
        } else { d.a.setEffectiveWeight(0); d.sit.setEffectiveWeight(1); }
      }
      m.mixer.update(dt);
    }

    // the horse: graze, then amble to somewhere else in the paddock
    if (horse) {
      const h = horse;
      const dx = h.target[0] - h.root.position.x, dz = h.target[1] - h.root.position.z, d = Math.hypot(dx, dz);
      if (d < 0.25) {
        h.wait -= dt;
        h.walk.setEffectiveWeight(Math.max(0, h.walk.getEffectiveWeight() - dt * 2));
        h.idle.setEffectiveWeight(1 - h.walk.getEffectiveWeight());
        if (h.wait <= 0) {
          h.target = [PADDOCK.x0 + 1.6 + Math.random() * (PADDOCK.x1 - PADDOCK.x0 - 3.2), PADDOCK.z0 + 2.4 + Math.random() * (PADDOCK.z1 - PADDOCK.z0 - 4.4)];
          h.wait = 4 + Math.random() * 6;
        }
      } else {
        const want2 = Math.atan2(dx, dz);
        h.root.rotation.y += angDiff(h.root.rotation.y, want2) * Math.min(1, dt * 1.6);
        const sp = 0.9 * Math.max(0, Math.cos(angDiff(h.root.rotation.y, want2)));
        h.root.position.x += Math.sin(h.root.rotation.y) * sp * dt;
        h.root.position.z += Math.cos(h.root.rotation.y) * sp * dt;
        h.walk.setEffectiveWeight(Math.min(1, h.walk.getEffectiveWeight() + dt * 2));
        h.idle.setEffectiveWeight(1 - h.walk.getEffectiveWeight());
      }
      h.mixer.update(dt);
    }

    // the bird
    if (bird) {
      const b = bird;
      b.t += dt;
      const ox = FOUNTAIN.x, oz = FOUNTAIN.z;
      if (b.phase === "circle") {
        const a = b.t * 0.45;
        v3.set(ox + Math.cos(a) * 9, 7 + Math.sin(b.t * 0.7) * 0.6, oz + Math.sin(a) * 9);
        b.root.lookAt(ox + Math.cos(a + 0.1) * 9, v3.y, oz + Math.sin(a + 0.1) * 9);
        b.root.position.copy(v3);
        b.next -= dt;
        if (b.next <= 0) { b.phase = "land"; b.t = 0; }
      } else if (b.phase === "land") {
        const p = Math.min(1, b.t / 3.2);
        const e = p * p * (3 - 2 * p);
        const sx = b.root.position.x, sz = b.root.position.z;
        const nxB = sx + (RIM.x - sx) * Math.min(1, dt * 1.8), nzB = sz + (RIM.z - sz) * Math.min(1, dt * 1.8);
        b.root.lookAt(RIM.x, b.root.position.y, RIM.z);
        b.root.position.set(nxB, 7 + (RIM.y - 7) * e, nzB);
        if (p >= 1) { b.phase = "drink"; b.t = 0; b.root.position.set(RIM.x, RIM.y, RIM.z); b.root.lookAt(ox, RIM.y, oz); }
      } else if (b.phase === "drink") {
        b.fly.setEffectiveWeight(0); b.idle.setEffectiveWeight(1);
        // a dip of the head to the water every couple of seconds
        b.root.rotation.x = Math.max(0, Math.sin(b.t * 2.6)) * 0.45;
        if (b.t > 7) { b.phase = "leave"; b.t = 0; b.root.rotation.x = 0; b.fly.setEffectiveWeight(1); b.idle.setEffectiveWeight(0); }
      } else {
        const p = Math.min(1, b.t / 3);
        b.root.position.set(RIM.x + p * 8, RIM.y + p * 7, RIM.z - p * 6);
        b.root.lookAt(RIM.x + 9, RIM.y + p * 7, RIM.z - 7);
        if (p >= 1) { b.phase = "circle"; b.t = 0; b.next = 14 + Math.random() * 10; }
      }
      b.mixer.update(dt);
    }

    // the fountain spray and gentle water
    for (let i = 0; i < DROPS; i++) {
      dropVel[i * 3 + 1] -= 9.8 * dt * 0.55;
      dropPos[i * 3] += dropVel[i * 3] * dt;
      dropPos[i * 3 + 1] += dropVel[i * 3 + 1] * dt;
      dropPos[i * 3 + 2] += dropVel[i * 3 + 2] * dt;
      if (dropPos[i * 3 + 1] < 1.45) resetDrop(i);
    }
    dropG.attributes.position.needsUpdate = true;
    waterM.emissiveIntensity = 0.35 + 0.08 * Math.sin(gameT * 2.2);
    clouds.forEach((c, i) => { c.position.x += Math.sin(i) * dt * 0.25; });

    // the camera follows behind him
    if (orbitHold > 0) orbitHold -= dt;
    else if (speed > 0.3) camYaw += angDiff(camYaw, yaw + Math.PI) * Math.min(1, dt * 1.6);
    const cfx = -Math.sin(camYaw), cfz = -Math.cos(camYaw);
    want.set(player.position.x - cfx * 5.6, 3.3, player.position.z - cfz * 5.6);
    wantLook.set(player.position.x + cfx * 2.6, 1.0, player.position.z + cfz * 2.6);
    // over the fountain: rise above it rather than look through the bowl
    const fd = Math.hypot(want.x - FOUNTAIN.x, want.z - FOUNTAIN.z);
    if (fd < FOUNTAIN.r + 1.4) want.y = 3.3 + 1.6 * Math.min(1, (FOUNTAIN.r + 1.4 - fd) / 1.4);
    // don't let the camera go into the shop's wall
    if (want.z < SHOP.z1 + 0.6 && Math.abs(want.x) < SHOP.x1 + 0.5) want.z = SHOP.z1 + 0.6;
    // something in the way between him and the camera: come in front of it
    headPos.set(player.position.x, 1.5, player.position.z);
    camRay.set(headPos, rayDir.subVectors(want, headPos).normalize());
    camRay.far = headPos.distanceTo(want);
    camRay.camera = camera;
    const block = camRay.intersectObjects(occluders.filter(Boolean), true)[0];
    if (block) want.copy(headPos).addScaledVector(rayDir, Math.max(1.2, block.distance - 0.35));
    if (first) { camPos.copy(want); camLook.copy(wantLook); first = false; }
    else { camPos.lerp(want, Math.min(1, dt * (block ? 12 : 5))); camLook.lerp(wantLook, Math.min(1, dt * 6)); }
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    fillLight.position.set(camPos.x * 0.6 + player.position.x * 0.4, 2.6, camPos.z * 0.6 + player.position.z * 0.4);
    sun.target.position.set(player.position.x, 0, player.position.z);
    sun.position.copy(sunDir).multiplyScalar(40).add(sun.target.position);

    let now: GardenSpot | null = null;
    for (const zn of ZONES) if (zn.inside(player.position.x, player.position.z)) { now = zn.id; break; }
    if (now !== near) { near = now; cb.onNear(near); }

    renderer.render(scene, camera);
    frames++;
    const nowMs = performance.now();
    if (nowMs - fpsT0 >= 1000) {
      const fps = Math.round((frames * 1000) / (nowMs - fpsT0));
      cb.onFps(fps);
      frames = 0; fpsT0 = nowMs;
      if (!opts.fixedStep && quality === "high") {
        slowSeconds = fps < 28 ? slowSeconds + 1 : 0;
        if (slowSeconds >= 3) { quality = "low"; renderer.setPixelRatio(1); sun.castShadow = false; renderer.shadowMap.enabled = false; resize(); }
      }
    }
  });

  const ray = new THREE.Raycaster();
  const targets: { obj: any; spot: GardenSpot }[] = [
    { obj: cab, spot: "trophies" }, { obj: shopG, spot: "shop" }, { obj: teq, spot: "teqball" }, { obj: sg, spot: "horse" },
  ];
  return {
    setStick: (x, y) => { stick = { x, y }; },
    orbit: (dx) => { camYaw -= dx * 0.008; orbitHold = 1.5; },
    pick: (px, py) => {
      const rct = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((px - rct.left) / rct.width) * 2 - 1, -((py - rct.top) / rct.height) * 2 + 1), camera);
      const objs = [...targets.map((t) => t.obj), ...mates.map((m) => m.root), ...(horse ? [horse.root] : []), ...carGroups];
      const hit = ray.intersectObjects(objs, true)[0];
      if (!hit) return null;
      let o = hit.object;
      while (o) {
        const t = targets.find((x) => x.obj === o);
        if (t) return t.spot;
        if (mates.some((m) => m.root === o)) return "mates";
        if (horse && horse.root === o) return "horse";
        if (carGroups.includes(o)) return "cars";
        o = o.parent;
      }
      return null;
    },
    place: (x, z, y = yaw) => { player.position.x = x; player.position.z = z; yaw = y; camYaw = y + Math.PI; first = true; },
    where: () => ({ x: player.position.x, z: player.position.z, yaw, t: gameT }),
    stats: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio(), loaded }),
    debug: () => {
      const sz = (o: any) => { const b = new THREE.Box3().setFromObject(o); const v = new THREE.Vector3(); b.getSize(v); return { min: b.min.toArray().map((n: number) => +n.toFixed(2)), size: v.toArray().map((n: number) => +n.toFixed(2)) }; };
      const precise = (o: any) => { o.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o, true); const v = new THREE.Vector3(); b.getSize(v); return { pmin: b.min.toArray().map((n: number) => +n.toFixed(2)), psize: v.toArray().map((n: number) => +n.toFixed(2)) }; };
      const mats: any[] = [];
      horse?.root.traverse((o: any) => { if (o.isMesh) mats.push({ n: o.name, vis: o.visible, skin: !!o.isSkinnedMesh, m: o.material?.name, op: o.material?.opacity, tr: o.material?.transparent, side: o.material?.side, col: o.material?.color?.getHexString?.(), mw: o.matrixWorld.elements.slice(0, 3).map((n: number) => +n.toFixed(3)) }); });
      return { horseMats: mats, cars: carGroups.length, carsWanted: data.cars, horseP: horse ? precise(horse.root) : null, birdP: bird ? precise(bird.root) : null, horse: horse ? { pos: horse.root.position.toArray(), ...sz(horse.root) } : null, bird: bird ? { pos: bird.root.position.toArray(), phase: bird.phase, ...sz(bird.root) } : null, mate0: mates[0] ? sz(mates[0].root) : null, player: sz(player) };
    },
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
      draco.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
