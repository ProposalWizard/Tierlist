/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE BARBER'S SHOP, IN 3D (28 Nov 2026; plan docs/plans/STAR_PASS_BARBER_FOOD_PLAN.md section 2, phase B3).
 * One small room behind the shopping street's BARBER door, code-built in the street's look (no new models): a
 * chequered floor, cream walls over a red dado, the long mirror (a live mirror on Medium and High) over a counter of
 * tins and clippers, two red barber chairs, the waiting bench with a customer on it, the till counter, the pole.
 *
 * You walk in (the same footballer as the street: home3d/wear.ts buildWearer in the wardrobe's outfit), sit in your
 * chair, and the screen round it (components/star/Barber3D.tsx) shows the style list. Each style is put on YOUR head
 * at once (`preview`: the modelled hair swapped, the scalp and beard repainted; a style on another skull rebuilds
 * you in the chair), and the chair turns slowly so you see it from every side (`setTurn`, or drag: `spin`).
 * `cut` plays the cut: the barber steps up behind you with his clippers for a few seconds, then the mirror.
 * `leave` stands you up and walks you out of the door (cb.onLeft).
 *
 * Budget: the room's still pieces join into a few draws (one per material); three people. The plan: ./plan.ts.
 */
import { installAssetVersions } from "../three3d/assetUrl";
import { blobCanvas } from "../shop3d/textures";
import { loadPeople3d, makePerson3d, dressPerson3d, relaxHands, type Person3D } from "../people3d";
import { people3dLook } from "../look3d";
import { dressCloth, offPitchWear, HOME_WB } from "../style3d/toon/clothes";
import { TIER_PROFILES, quality3dTier, type Quality3d } from "../three3d/quality";
import { acquireRenderer, rememberGpu, awaitSmoothFrame, abandonedSceneError, abandonedContainer } from "../three3d/perf";
import { withMeshopt } from "../three3d/meshopt";
import { addClips, clipInfo, loadAnims3d } from "../three3d/footballAnims";

import { setToonYou, toonYou, type ToonHead, type YourHairLook } from "../style3d/toon/bodies";
import type { Worn, Kit2 } from "../home3d/outfits";
import {
  HALF_W, HALF_D, ROOM_H, DOOR_X, DOOR_HALF, CHAIRS, CHAIR_YAW, YOUR_CHAIR, SEAT_Y, MIRROR, SHELF, BENCH, COUNTER,
  BARBER_SPOT, BARBER_WAIT, walkIn, walkOut, shotOf, type Shot, type XZ,
} from "./plan";

export interface BarberData {
  kits: { home: Kit2; away: Kit2 };
  player: { skin: string; hair: string };
  /** What you wear (outfits.ts wornAt, as on the street). */
  worn: Worn;
  /** Your look as you walk in (barber.ts yourHairLook3d). */
  look: YourHairLook;
  /** Start already in the chair (the test page and stills). */
  seated?: boolean;
  club?: string;
}

export type BarberState = "walking" | "sitting" | "seated" | "cutting" | "leaving";
export interface BarberCallbacks {
  onState?: (s: BarberState) => void;
  /** Walked out of the door. */
  onLeft?: () => void;
  onContextLost?: () => void;
}

export interface BarberController {
  /** Put this look on your head now (the style list). */
  preview: (look: YourHairLook) => Promise<void>;
  /** The chair turns by itself (the turntable), or stops facing the mirror. */
  setTurn: (on: boolean) => void;
  /** Drag: turn the chair by hand (pixels). */
  spin: (dx: number) => void;
  /** The cut (about 3.5 s): resolves when you see yourself in the mirror with `look` on. */
  cut: (look: YourHairLook, secs?: number) => Promise<void>;
  /** Stand up and walk out (cb.onLeft at the door). */
  leave: () => void;
  shot: (s: Shot) => void;
  stats: () => { calls: number; triangles: number; quality: Quality3d; head: string; hair: string | null; state: BarberState };
  dispose: () => void;
}

export interface BarberOptions { isDead?: () => boolean; quality?: Quality3d; fixedStep?: number }

const PALETTE = {
  wall: "#efe6d4", dado: "#7a1c1c", trim: "#c9a14f", wood: "#5b3a26", dark: "#1d1d1f", chair: "#8b1a1a", chrome: "#c9ccd1",
  ceiling: "#f4efe4", leather: "#3b2a20",
};

async function buildBarber(container: HTMLElement, cb: BarberCallbacks, data: BarberData, opts: BarberOptions, own: { release?: (root?: any) => void; root?: any }): Promise<BarberController> {
  const gone = () => !!opts.isDead?.() || abandonedContainer(container);
  const tier: Quality3d = opts.quality ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const THREE: any = await import("three");
  await installAssetVersions();
  const { GLTFLoader }: any = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils: any = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const SK = SkeletonUtils.default ?? SkeletonUtils;
  const { RoomEnvironment }: any = await import("three/examples/jsm/environments/RoomEnvironment.js");
  const { mergeGeometries }: any = await import("three/examples/jsm/utils/BufferGeometryUtils.js");
  const { Reflector }: any = await import("three/examples/jsm/objects/Reflector.js");
  const { RoundedBoxGeometry }: any = await import("three/examples/jsm/geometries/RoundedBoxGeometry.js");
  if (gone()) throw abandonedSceneError();

  const { renderer, release, isOwner } = acquireRenderer(THREE, container, prof);
  own.release = release;
  rememberGpu(renderer);
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(Math.min(dpr, prof.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  let disposed = false;
  const onLost = (e: Event) => { e.preventDefault(); if (!disposed) cb.onContextLost?.(); };
  renderer.domElement.addEventListener("webglcontextlost", onLost);

  const scene = new THREE.Scene();
  own.root = scene;
  scene.background = new THREE.Color("#2a2420");
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = 0.35;
  const camera = new THREE.PerspectiveCamera(56, 1, 0.05, 40);
  const breathe = async () => { await new Promise<void>((r) => setTimeout(r, 0)); if (disposed || gone()) throw abandonedSceneError(); };

  // ── little builders ──
  const tex = (c: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.max(2, prof.anisotropy);
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  const memo = new Map<string, any>();
  const mat = (c: string, o: any = {}) => {
    const plain = Object.values(o).every((v) => v === null || typeof v !== "object");
    const key = plain ? c + JSON.stringify(o) : "";
    if (plain && memo.has(key)) return memo.get(key);
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });
    if (plain) memo.set(key, m);
    return m;
  };
  const glow = (c: string, i = 1.6) => mat("#000000", { emissive: c, emissiveIntensity: i, roughness: 1 });
  const byMat = new Map<any, any[]>();
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), s4 = new THREE.Vector3();
  const put = (geo: any, m: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.applyMatrix4(m4.compose(v4.set(x, y, z), q4.setFromEuler(e4.set(rx, ry, rz)), s4.set(sx, sy, sz)));
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!byMat.has(m)) byMat.set(m, []);
    byMat.get(m)!.push(g);
  };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, ry = 0) => put(new THREE.BoxGeometry(w, h, d), m, x, y, z, 0, ry);
  /** A padded, rounded box (the chairs' leather, the bench). */
  const soft = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, r = 0.035, rx = 0) => put(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)), m, x, y, z, rx);
  const cyl = (rt: number, rb: number, h: number, m: any, x: number, y: number, z: number, seg = 20) => put(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
  const flush = (parent: any = scene) => {
    byMat.forEach((list, m) => { const me = new THREE.Mesh(mergeGeometries(list), m); me.matrixAutoUpdate = false; me.updateMatrix(); parent.add(me); });
    byMat.clear();
  };

  // ── light: a warm room, lamps overhead, daylight from the windows ──
  scene.add(new THREE.HemisphereLight("#fff1dc", "#5a4030", 1.15));
  const key = new THREE.DirectionalLight("#ffe2bf", 1.6);
  key.position.set(1.6, 3.2, 2.6);
  scene.add(key);
  const day = new THREE.DirectionalLight("#cfe0ff", 0.55);
  day.position.set(0.5, 1.5, 6);
  scene.add(day);

  // ── the room ──
  const floorC = document.createElement("canvas"); floorC.width = floorC.height = 256;
  { const g = floorC.getContext("2d")!; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#ece6da" : "#1f1f22"; g.fillRect(i * 64, j * 64, 64, 64); } g.fillStyle = "rgba(0,0,0,0.05)"; for (let k = 0; k < 4; k++) { g.fillRect(k * 64, 0, 1, 256); g.fillRect(0, k * 64, 256, 1); } }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALF_W * 2, HALF_D * 2), new THREE.MeshStandardMaterial({ map: tex(floorC, [HALF_W * 2 / 1.2, HALF_D * 2 / 1.2]), roughness: 0.35, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const wallM = mat(PALETTE.wall, { roughness: 0.85 }), dadoM = mat(PALETTE.dado, { roughness: 0.5 }), trimM = mat(PALETTE.trim, { roughness: 0.35, metalness: 0.6 });
  const woodM = mat(PALETTE.wood, { roughness: 0.55 }), darkM = mat(PALETTE.dark, { roughness: 0.4 }), chromeM = mat(PALETTE.chrome, { roughness: 0.2, metalness: 0.9 });
  const DADO = 1.0;
  // the walls: back, left (the mirror wall), right, and the front with its door and two windows
  const wall = (x: number, z: number, w: number, d: number, h = ROOM_H, y0 = 0) => box(w, h, d, wallM, x, y0 + h / 2, z);
  const dado = (x: number, z: number, w: number, d: number) => { box(w, DADO, d, dadoM, x, DADO / 2, z); box(w + (w > d ? 0 : 0.02), 0.05, d + (d > w ? 0 : 0.02), trimM, x, DADO + 0.025, z); };
  wall(0, -HALF_D - 0.05, HALF_W * 2, 0.1); dado(0, -HALF_D + 0.01, HALF_W * 2, 0.03);
  wall(-HALF_W - 0.05, 0, 0.1, HALF_D * 2); dado(-HALF_W + 0.01, 0, 0.03, HALF_D * 2);
  wall(HALF_W + 0.05, 0, 0.1, HALF_D * 2); dado(HALF_W - 0.01, 0, 0.03, HALF_D * 2);
  // front wall: pieces round the door (x DOOR_X ± DOOR_HALF, 2.2 m high) and two windows (1.0 to 2.3 m)
  const FZ = HALF_D + 0.05, DH = 2.2;
  const segs: [number, number][] = [[-HALF_W, DOOR_X - DOOR_HALF], [DOOR_X + DOOR_HALF, HALF_W]];
  for (const [a, b] of segs) {
    const w = b - a, mid = (a + b) / 2;
    box(w, DADO, 0.1, dadoM, mid, DADO / 2, FZ);
    box(w, 0.06, 0.14, trimM, mid, DADO + 0.03, FZ - 0.02);
    // a window in each piece, the wall round it
    const winW = Math.min(1.6, w - 0.5), wx = mid;
    box((w - winW) / 2, ROOM_H - DADO, 0.1, wallM, a + (w - winW) / 4, DADO + (ROOM_H - DADO) / 2, FZ);
    box((w - winW) / 2, ROOM_H - DADO, 0.1, wallM, b - (w - winW) / 4, DADO + (ROOM_H - DADO) / 2, FZ);
    box(winW, ROOM_H - 2.3, 0.1, wallM, wx, 2.3 + (ROOM_H - 2.3) / 2, FZ);
    // the window frame and the street outside (a bright picture)
    for (const dx of [-winW / 2, 0, winW / 2]) box(0.05, 1.3, 0.12, woodM, wx + dx, 1.65, FZ);
    for (const y of [1.0, 2.3]) box(winW + 0.05, 0.05, 0.12, woodM, wx, y, FZ);
  }
  box(DOOR_HALF * 2, ROOM_H - DH, 0.1, wallM, DOOR_X, DH + (ROOM_H - DH) / 2, FZ);
  for (const dx of [-DOOR_HALF, DOOR_HALF]) box(0.08, DH, 0.16, woodM, DOOR_X + dx, DH / 2, FZ);
  box(DOOR_HALF * 2 + 0.16, 0.08, 0.16, woodM, DOOR_X, DH, FZ);
  // the ceiling, a cornice, three pendant lamps
  box(HALF_W * 2, 0.06, HALF_D * 2, mat(PALETTE.ceiling, { roughness: 0.95 }), 0, ROOM_H, 0);
  for (const [x, z, w, d] of [[0, -HALF_D + 0.04, HALF_W * 2, 0.08], [-HALF_W + 0.04, 0, 0.08, HALF_D * 2], [HALF_W - 0.04, 0, 0.08, HALF_D * 2]] as const) box(w, 0.1, d, trimM, x, ROOM_H - 0.08, z);
  for (const [x, z] of [[-1.3, 0.55], [-1.3, -1.45], [0.9, 0.2]] as const) {
    cyl(0.008, 0.008, 0.5, darkM, x, ROOM_H - 0.25, z, 6);
    put(new THREE.CylinderGeometry(0.06, 0.2, 0.16, 20, 1, true), mat("#1f3a2a", { roughness: 0.4, side: THREE.DoubleSide }), x, ROOM_H - 0.56, z);
    put(new THREE.SphereGeometry(0.06, 12, 8), glow("#fff0d0", 2.6), x, ROOM_H - 0.6, z);
  }
  // the mirror wall: a gilt frame round the long mirror, the counter of tins and clippers under it
  const MX = -HALF_W + 0.06;
  box(0.04, MIRROR.h + 0.12, 0.06, trimM, MX, MIRROR.y, -MIRROR.w / 2 - 0.03 - 0.45);
  box(0.04, MIRROR.h + 0.12, 0.06, trimM, MX, MIRROR.y, MIRROR.w / 2 + 0.03 - 0.45);
  box(0.04, 0.06, MIRROR.w + 0.12, trimM, MX, MIRROR.y + MIRROR.h / 2 + 0.03, -0.45);
  box(0.04, 0.06, MIRROR.w + 0.12, trimM, MX, MIRROR.y - MIRROR.h / 2 - 0.03, -0.45);
  const mirrorZ = -0.45;
  // behind the live mirror: dark glass (Low, or before it draws)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), mat("#3a4048", { roughness: 0.06, metalness: 0.9, envMapIntensity: 1.3 }));
  glass.position.set(MX - 0.012, MIRROR.y, mirrorZ); glass.rotation.y = Math.PI / 2;
  scene.add(glass);
  box(SHELF.d, 0.06, HALF_D * 2 - 0.4, mat("#f1ede4", { roughness: 0.25, metalness: 0.1 }), -HALF_W + SHELF.d / 2, SHELF.y, -0.45); // marble top
  box(SHELF.d - 0.04, SHELF.y - 0.06, HALF_D * 2 - 0.44, woodM, -HALF_W + SHELF.d / 2 - 0.02, (SHELF.y - 0.06) / 2, -0.45);
  for (let k = 0; k < 6; k++) box(0.01, SHELF.y - 0.22, 0.6, mat("#4a2e1f", { roughness: 0.6 }), -HALF_W + SHELF.d - 0.01, (SHELF.y - 0.06) / 2, -2.6 + k * 0.85);
  // the tins, bottles and a jar of combs on the counter (a seeded row)
  const tinCols = ["#b91c1c", "#1d3f8a", "#c9a14f", "#e5e7eb", "#14532d", "#111827", "#7c2d12"];
  for (let i = 0; i < 18; i++) {
    const z = -2.75 + i * 0.27 + ((i * 37) % 7) * 0.012, x = -HALF_W + 0.12 + ((i * 13) % 3) * 0.06;
    if (Math.abs(z - CHAIRS[0][1]) < 0.35 || Math.abs(z - CHAIRS[1][1]) < 0.35) continue; // clear in front of each chair
    const c = mat(tinCols[(i * 5) % tinCols.length], { roughness: 0.35, metalness: 0.4 });
    if (i % 3 === 0) { cyl(0.035, 0.035, 0.18, c, x, SHELF.y + 0.12, z, 12); cyl(0.012, 0.012, 0.05, chromeM, x, SHELF.y + 0.235, z, 8); }
    else cyl(0.05, 0.05, 0.06, c, x, SHELF.y + 0.06, z, 16);
  }
  // a jar of blue barbicide with combs, and clippers lying on a towel, by your chair
  put(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16), mat("#2b6cb0", { roughness: 0.1, transparent: true, opacity: 0.75 }), -HALF_W + 0.2, SHELF.y + 0.13, CHAIRS[0][1] + 0.45);
  box(0.22, 0.02, 0.3, mat("#f4f4f4", { roughness: 0.95 }), -HALF_W + 0.2, SHELF.y + 0.04, CHAIRS[0][1] - 0.42);
  box(0.05, 0.035, 0.13, darkM, -HALF_W + 0.2, SHELF.y + 0.07, CHAIRS[0][1] - 0.42);
  // the shelf over the mirror: more tins and a row of framed photos (team shots in made-up kits)
  box(0.18, 0.03, HALF_D * 2 - 0.8, woodM, -HALF_W + 0.09, MIRROR.y + MIRROR.h / 2 + 0.25, -0.45);
  for (let i = 0; i < 10; i++) cyl(0.04, 0.04, 0.11, mat(tinCols[(i * 3) % tinCols.length], { roughness: 0.4, metalness: 0.4 }), -HALF_W + 0.1, MIRROR.y + MIRROR.h / 2 + 0.32, -2.7 + i * 0.5, 12);
  // the right wall: framed pictures of cuts, the waiting bench, the till counter, the pole
  const styleBoard = document.createElement("canvas"); styleBoard.width = 512; styleBoard.height = 256;
  {
    const g = styleBoard.getContext("2d")!;
    g.fillStyle = "#1f1b18"; g.fillRect(0, 0, 512, 256);
    g.fillStyle = "#f4e3b5"; g.font = "bold 30px Georgia, serif"; g.textAlign = "center"; g.fillText("CUTS & SHAVES", 256, 40);
    const rows = [["Cut", "Fade", "Shave"], ["Beard trim", "Waves", "Locs"]];
    g.font = "22px Georgia, serif";
    rows.forEach((r, j) => r.forEach((w, i) => { g.fillStyle = "#e9dcc0"; g.fillText(w, 96 + i * 160, 104 + j * 70); }));
    g.strokeStyle = "#c9a14f"; g.lineWidth = 3; g.strokeRect(8, 8, 496, 240);
  }
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), new THREE.MeshStandardMaterial({ map: tex(styleBoard), roughness: 0.9 }));
  board.position.set(HALF_W - 0.02, 1.95, -1.2); board.rotation.y = -Math.PI / 2;
  scene.add(board);
  // the bench: dark leather on a wood frame
  soft(0.46, 0.09, BENCH.len, mat(PALETTE.leather, { roughness: 0.45 }), BENCH.x, BENCH.y - 0.045, BENCH.z, 0.035);
  soft(0.1, 0.5, BENCH.len, mat(PALETTE.leather, { roughness: 0.45 }), HALF_W - 0.08, BENCH.y + 0.25, BENCH.z, 0.04);
  for (const dz of [-BENCH.len / 2 + 0.08, BENCH.len / 2 - 0.08]) box(0.42, BENCH.y - 0.08, 0.06, woodM, BENCH.x, (BENCH.y - 0.08) / 2, BENCH.z + dz);
  // the till counter
  box(COUNTER.w, COUNTER.h, COUNTER.d, woodM, COUNTER.x, COUNTER.h / 2, COUNTER.z);
  box(COUNTER.w + 0.06, 0.05, COUNTER.d + 0.06, mat("#f1ede4", { roughness: 0.25 }), COUNTER.x, COUNTER.h + 0.025, COUNTER.z);
  box(0.3, 0.2, 0.26, darkM, COUNTER.x + 0.3, COUNTER.h + 0.15, COUNTER.z);
  box(0.24, 0.02, 0.2, mat("#3a3f45", { roughness: 0.3 }), COUNTER.x + 0.3, COUNTER.h + 0.26, COUNTER.z - 0.02);
  // a plant in the corner
  cyl(0.18, 0.14, 0.4, mat("#7a1c1c", { roughness: 0.5 }), HALF_W - 0.3, 0.2, -HALF_D + 0.3, 16);
  put(new THREE.IcosahedronGeometry(0.34, 1), mat("#2f5a3c", { roughness: 0.8 }), HALF_W - 0.3, 0.72, -HALF_D + 0.3);
  // the two barber chairs: a chrome base, a red seat and back, arms, a footrest; yours turns (its own group)
  const chairAt = (parent: any) => {
    // the base: a round chrome foot, the pump column with its collar, the pedal
    cyl(0.28, 0.31, 0.05, chromeM, 0, 0.025, 0, 32);
    cyl(0.2, 0.24, 0.04, darkM, 0, 0.065, 0, 28);
    cyl(0.055, 0.065, SEAT_Y - 0.2, chromeM, 0, (SEAT_Y - 0.2) / 2 + 0.08, 0, 16);
    cyl(0.1, 0.1, 0.05, chromeM, 0, SEAT_Y - 0.17, 0, 20);
    box(0.05, 0.02, 0.18, chromeM, 0.18, 0.06, 0.18);
    const red = mat(PALETTE.chair, { roughness: 0.32, metalness: 0.05 }), seam = mat("#5e1010", { roughness: 0.45 });
    // the padded seat (its top at SEAT_Y), the back in two cushions, the headrest on its chrome post
    soft(0.54, 0.13, 0.52, red, 0, SEAT_Y - 0.065, 0.01, 0.05);
    box(0.5, 0.06, 0.48, darkM, 0, SEAT_Y - 0.15, 0.01);
    soft(0.52, 0.34, 0.11, red, 0, SEAT_Y + 0.21, -0.27, 0.045, -0.12);
    soft(0.52, 0.27, 0.11, red, 0, SEAT_Y + 0.5, -0.305, 0.045, -0.12);
    box(0.5, 0.012, 0.11, seam, 0, SEAT_Y + 0.365, -0.287);
    box(0.48, 0.05, 0.09, chromeM, 0, SEAT_Y + 0.05, -0.3);
    cyl(0.013, 0.013, 0.16, chromeM, 0, SEAT_Y + 0.69, -0.33, 8);
    soft(0.32, 0.14, 0.09, red, 0, SEAT_Y + 0.8, -0.33, 0.04);
    // the arms: padded tops on chrome
    for (const dx of [-0.3, 0.3]) {
      soft(0.08, 0.06, 0.44, red, dx, SEAT_Y + 0.21, 0.0, 0.025);
      box(0.025, 0.2, 0.025, chromeM, dx, SEAT_Y + 0.08, 0.17);
      box(0.025, 0.2, 0.025, chromeM, dx, SEAT_Y + 0.08, -0.17);
    }
    // the footrest
    box(0.42, 0.025, 0.16, chromeM, 0, 0.22, 0.44);
    for (let k = -2; k <= 2; k++) box(0.4, 0.008, 0.012, darkM, 0, 0.236, 0.44 + k * 0.025);
    box(0.025, 0.22, 0.025, chromeM, -0.12, 0.33, 0.33); box(0.025, 0.22, 0.025, chromeM, 0.12, 0.33, 0.33);
    flush(parent);
  };
  flush();
  const chairs: any[] = [];
  for (const [x, z] of CHAIRS) {
    const g = new THREE.Group();
    g.position.set(x, 0, z); g.rotation.y = CHAIR_YAW; // its front (+z in its own frame) faces the mirror (-x)
    scene.add(g);
    chairAt(g);
    chairs.push(g);
  }
  // the pole on the wall by the door, turning
  const poleC = document.createElement("canvas"); poleC.width = 64; poleC.height = 256;
  { const g = poleC.getContext("2d")!; g.fillStyle = "#f8f8f6"; g.fillRect(0, 0, 64, 256); for (let k = -4; k < 12; k++) for (const [col, off] of [["#b91c1c", 0], ["#1d3f8a", 32]] as [string, number][]) { g.fillStyle = col; g.beginPath(); g.moveTo(0, k * 64 + off); g.lineTo(64, k * 64 + off + 32); g.lineTo(64, k * 64 + off + 48); g.lineTo(0, k * 64 + off + 16); g.closePath(); g.fill(); } }
  const poleT = tex(poleC, [1, 1.5]);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 18, 1, true), new THREE.MeshStandardMaterial({ map: poleT, emissive: "#ffffff", emissiveMap: poleT, emissiveIntensity: 0.3, roughness: 0.3 }));
  pole.position.set(HALF_W - 0.14, 1.9, 1.0);
  scene.add(pole);
  for (const dy of [-0.38, 0.38]) put(new THREE.SphereGeometry(0.085, 12, 8), trimM, HALF_W - 0.14, 1.9 + dy, 1.0);
  flush();
  // the street through the windows and the door (bright, not lit by the room)
  const streetC = document.createElement("canvas"); streetC.width = 256; streetC.height = 192;
  { const g = streetC.getContext("2d")!; const sky = g.createLinearGradient(0, 0, 0, 192); sky.addColorStop(0, "#a9c6e2"); sky.addColorStop(1, "#f7d39c"); g.fillStyle = sky; g.fillRect(0, 0, 256, 192); g.fillStyle = "#c9a27a"; g.fillRect(0, 60, 256, 90); for (let i = 0; i < 6; i++) { g.fillStyle = "#e9d8b8"; g.fillRect(12 + i * 42, 74, 24, 30); } g.fillStyle = "#3d3d40"; g.fillRect(0, 150, 256, 42); }
  const outside = new THREE.MeshBasicMaterial({ map: tex(streetC), toneMapped: false, fog: false });
  for (const [a, b] of segs) {
    const w = Math.min(1.6, b - a - 0.5);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.3), outside);
    pl.position.set((a + b) / 2, 1.65, FZ + 0.2); pl.rotation.y = Math.PI;
    scene.add(pl);
  }
  const doorPic = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_HALF * 2, DH), outside);
  doorPic.position.set(DOOR_X, DH / 2, FZ + 0.6); doorPic.rotation.y = Math.PI;
  scene.add(doorPic);
  // soft shadows under the chairs and people
  const blobT = tex(blobCanvas());
  const blob = (w: number, x: number, z: number, o = 0.6) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false, opacity: o })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.006, z); m.renderOrder = 1; scene.add(m); return m; };
  for (const [x, z] of CHAIRS) blob(0.9, x, z, 0.55);
  // the live mirror (Medium and High): the room and you in it
  const MIRROR_PX: Record<string, number> = { low: 0, medium: 512, high: 1024 };
  let mirror: any = null;
  if (MIRROR_PX[tier]) {
    const px = MIRROR_PX[tier];
    mirror = new Reflector(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), { textureWidth: px, textureHeight: Math.round((px * MIRROR.h) / MIRROR.w), color: 0xd4d9de, clipBias: 0.003 });
    mirror.position.set(MX - 0.008, MIRROR.y, mirrorZ); mirror.rotation.y = Math.PI / 2;
    scene.add(mirror);
  }
  await breathe();

  // ── the people ──
  const loader = await withMeshopt(new GLTFLoader());
  const { buildWearer } = await import("../home3d/wear");
  const PR = await import("../people/presets");
  const looks = PR.castScene([{ id: "barber-rico", role: "fan", club: data.club ?? "Arsenal" }, { id: "barber-waiting-1", role: "player", club: data.club ?? "Arsenal" }]);
  const heads = Array.from(new Set(looks.map((l) => l.head)));
  const [charG, animG, footG] = await Promise.all([
    loadPeople3d(loader, "player", people3dLook(), heads),
    loadPeople3d(loader, "anims", people3dLook()),
    loadAnims3d(loader, "football"),
  ]);
  if (disposed || gone()) throw abandonedSceneError();
  const FI = await import("../style3d/toon/faceIdApply");
  const FACE = await import("../style3d/toon/face");
  const HAIR = await import("../style3d/toon/hair");
  const { wearYourHair } = await import("../style3d/toon/yourHair");
  const outline = prof.outlines ? 0.006 : 0;
  const hairs: any[] = [];
  const preset = async (L: any) => {
    const p: Person3D = makePerson3d(THREE, SK, charG as any, animG, { outline, castShadow: false, who: L.id, toonHead: L.head, toonBody: L.build } as any);
    dressPerson3d(THREE, p, { ...L.dress, kit: { ...(L.kit ?? {}), ...data.kits.home }, number: null } as any);
    const ow = offPitchWear(L.id, "family", data.kits.home);
    dressCloth(THREE, p, ow.kind, L.id, { colours: ow.colours, whiteBalance: HOME_WB });
    FI.applyToonFaceId(THREE, p, L.faceId, { detail: FI.FACE_DETAIL[tier] });
    const rig = FACE.addToonFace(THREE, p);
    rig?.set({ face: FACE.toonFaceFor({}), blink: 0 });
    if (L.hairMesh) { const h = await HAIR.wearToonHair(THREE, loader, p, L.hairMesh, { outline: outline ? 0.0045 : 0 }).catch(() => null); if (h) hairs.push(h); }
    relaxHands(THREE, p);
    addClips(THREE, p, footG);
    scene.add(p.root);
    return p;
  };
  /** Play one clip on a person (others off). `hold`: stop at that time (a held pose). */
  const playOn = (p: Person3D, name: string, o: { hold?: number; from?: number; speed?: number; once?: boolean } = {}) => {
    const a = p.actions[name] ?? p.actions.idle;
    for (const x of Object.values(p.actions)) if (x !== a) { x.setEffectiveWeight(0); x.stop(); }
    a.reset(); a.enabled = true; a.setEffectiveWeight(1);
    a.setLoop(o.once || o.hold !== undefined ? THREE.LoopOnce : THREE.LoopRepeat, o.once || o.hold !== undefined ? 1 : Infinity);
    a.clampWhenFinished = true;
    a.time = o.from ?? 0; a.timeScale = o.speed ?? 1;
    a.play();
    (p as any).__hold = o.hold;
    (p as any).__act = a;
  };
  const holdStep = (p: Person3D) => {
    const a = (p as any).__act, h = (p as any).__hold;
    if (a && h !== undefined && ((a.timeScale > 0 && a.time >= h) || (a.timeScale < 0 && a.time <= h))) { a.time = h; a.timeScale = 0; }
  };

  // the barber (a made-up man, presets.ts) and a customer waiting on the bench
  const barber = await preset(looks[0]);
  barber.root.position.set(BARBER_WAIT[0], 0, BARBER_WAIT[1]);
  barber.root.rotation.y = Math.atan2(CHAIRS[0][0] - BARBER_WAIT[0], CHAIRS[0][1] - BARBER_WAIT[1]);
  playOn(barber, "idle");
  blob(0.8, BARBER_WAIT[0], BARBER_WAIT[1]);
  // his clippers, in his right hand
  const clippers = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.05), mat("#1d1d1f", { roughness: 0.35, metalness: 0.3 }));
  const hand = barber.bones.RightHand ?? barber.bones.RightForeArm;
  if (hand) { hand.add(clippers); clippers.position.set(0, 0.08 / (barber.unit || 1), 0); clippers.scale.setScalar(1 / (barber.unit || 1)); }
  clippers.visible = false;
  const waiting = await preset(looks[1]);
  await breathe();

  // ── you ──
  let you: Person3D;
  let state: BarberState = data.seated ? "seated" : "walking";
  const chair = chairs[YOUR_CHAIR];
  const pivot = new THREE.Group();
  pivot.position.copy(chair.position);
  scene.add(pivot);
  const yourBlob = blob(0.85, ENTER_X(), ENTER_Z());
  function ENTER_X() { return walkIn()[0][0]; }
  function ENTER_Z() { return walkIn()[0][1]; }
  let currentLook: YourHairLook = data.look;
  /** Build you (your head as the look says), wearing the outfit, the look's hair on. */
  const buildYou = async (look: YourHairLook): Promise<Person3D> => {
    setToonYou({ hairLook: look });
    const p = await buildWearer(THREE, SkeletonUtils, loader, { worn: data.worn, kits: data.kits, number: null, skin: data.player.skin, hair: data.player.hair, outline, castShadow: false });
    addClips(THREE, p, footG);
    if (look.mesh) await wearYourHair(THREE, p, look.mesh).catch(() => null);
    return p;
  };
  you = await buildYou(currentLook);
  if (disposed || gone()) throw abandonedSceneError();
  // seated: your root in the turning pivot at the chair (his frame faces the mirror)
  /**
   * Where his root goes in the chair (the pivot's frame: +z is the way he faces) so that, in the held seated pose,
   * his hip joints are 9 cm over the seat (the skin and the trousers under them rest on it: world3d's measured
   * 8.5 cm) and a little back from its middle. Measured on this body in that pose.
   */
  const seatRoot = (p: Person3D, seatY = SEAT_Y): [number, number, number] => {
    const a = p.actions.sit_down;
    if (!a || !p.bones.Hips) return [0, seatY - 0.45, 0];
    const saved = Object.values(p.actions).map((x) => [x, x.getEffectiveWeight(), x.time, x.enabled, x.timeScale] as const);
    for (const [x] of saved) x.setEffectiveWeight(0);
    const rp = p.root.position.clone(), rr = p.root.rotation.y, par = p.root.parent;
    scene.add(p.root); p.root.position.set(0, 0, 0); p.root.rotation.y = 0;
    a.enabled = true; a.play(); a.setEffectiveWeight(1); a.time = 1.55; a.timeScale = 0;
    p.mixer.update(0); a.time = 1.55; p.mixer.update(0);
    p.root.updateMatrixWorld(true);
    const h = p.bones.Hips.getWorldPosition(new THREE.Vector3());
    for (const [x, w, t, en, ts] of saved) { x.setEffectiveWeight(w); x.time = t; x.enabled = en; x.timeScale = ts; }
    if (par) par.add(p.root); else p.root.removeFromParent();
    p.root.position.copy(rp); p.root.rotation.y = rr;
    return [-h.x, seatY + 0.09 - h.y, -0.03 - h.z];
  };
  const seatYou = (p: Person3D) => {
    const r = seatRoot(p);
    pivot.add(p.root);
    p.root.position.set(...r);
    p.root.rotation.y = 0;
    playOn(p, "sit_down", { hold: 1.55, from: 1.55 });
  };
  // the customer on the bench, sat the same way (his seat's middle, facing the room)
  {
    const [ox, oy, oz] = seatRoot(waiting, BENCH.y);
    const yw = BENCH.yaw, cx = BENCH.x - 0.02, cz = BENCH.z + 0.35;
    waiting.root.position.set(cx + ox * Math.cos(yw) + oz * Math.sin(yw), oy, cz - ox * Math.sin(yw) + oz * Math.cos(yw));
    waiting.root.rotation.y = yw;
    playOn(waiting, "sit_down", { hold: 1.55, from: 1.55 });
  }
  let spinYaw = 0, turning = false, spinVel = 0, turnT = 0;
  const baseYaw = CHAIR_YAW;
  pivot.rotation.y = baseYaw;
  chair.rotation.y = baseYaw;
  if (data.seated) seatYou(you);
  else {
    scene.add(you.root);
    const [x, z] = walkIn()[0];
    you.root.position.set(x, 0, z);
    you.root.rotation.y = Math.PI;
  }
  const walkClip = you.actions.walk ? "walk" : "jog";
  const walkSpeed = (() => { const w = clipInfo(footG, "walk")?.speed; const hipsRest = you.rest.get(you.bones.Hips)?.[0].y ?? 1; const hy = (footG.scene?.userData as any)?.hipsY; return w ? w * (hy ? hipsRest / hy : 1) : 1.1; })();

  // ── the walk in, the sit, the walk out ──
  let path: XZ[] = [];
  let pathI = 0;
  let afterPath: (() => void) | null = null;
  const walkAlong = (pts: XZ[], then: () => void) => {
    path = pts; pathI = 1; afterPath = then;
    if (pivot.children.includes(you.root)) { scene.attach(you.root); you.root.position.y = 0; }
    playOn(you, walkClip, { speed: walkClip === "jog" ? 0.6 : 1 });
  };
  const setState = (s: BarberState) => { state = s; cb.onState?.(s); };
  let sitT = -1;
  const sitDown = () => {
    // turn the chair back to the mirror, then sit (the capture's own sit, held: world3d's rule)
    spinYaw = 0; pivot.rotation.y = baseYaw; chair.rotation.y = baseYaw;
    const r = seatRoot(you);
    pivot.add(you.root);
    you.root.position.set(...r);
    you.root.rotation.y = 0;
    playOn(you, "sit_down", { hold: 1.55 });
    sitT = 0;
    setState("sitting");
  };
  if (!data.seated) walkAlong(walkIn(), sitDown);

  // ── camera: fixed shots, eased between ──
  let tall = true;
  const resize = () => {
    const w = container.clientWidth || 390, h = container.clientHeight || 844;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    tall = w / h < 0.8;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  let shotNow: Shot = data.seated ? "chair" : "enter";
  const camPos = new THREE.Vector3(...shotOf(shotNow, tall).pos), camLook = new THREE.Vector3(...shotOf(shotNow, tall).look);
  let camFov = shotOf(shotNow, tall).fov;
  const setShot = (s: Shot) => { shotNow = s; };

  // ── the cut ──
  let cutT = -1, cutSecs = 3.5, cutDone: (() => void) | null = null, cutLook: YourHairLook | null = null;
  const barberHome = new THREE.Vector3(BARBER_WAIT[0], 0, BARBER_WAIT[1]);
  const barberWork = new THREE.Vector3(BARBER_SPOT[0], 0, BARBER_SPOT[1]);

  // ── the preview: the look on your head now ──
  let building = 0;
  const preview = async (look: YourHairLook) => {
    const my = ++building;
    currentLook = look;
    setToonYou({ hairLook: look });
    if (look.head === you.toonHead) {
      // same skull: repaint the scalp and beard, swap the modelled hair
      const u = you.u as any;
      u.uHairCut?.value.set(look.cut.scalp, look.cut.beard, look.cut.stubble, look.cut.pattern);
      await wearYourHair(THREE, you, look.mesh);
      return;
    }
    // another skull: you again, in the chair as you were
    const p = await buildYou(look);
    if (my !== building || disposed) { p.root.removeFromParent(); return; }
    const old = you;
    you = p;
    if (state === "seated" || state === "cutting") seatYou(p);
    else { scene.add(p.root); p.root.position.copy(old.root.position); p.root.rotation.y = old.root.rotation.y; }
    old.root.removeFromParent();
  };

  // ── the loop ──
  let last = performance.now(), gameT = 0, drawn = 0;
  const tmp = new THREE.Vector3();
  const frame = () => {
    if (disposed) return;
    const now = performance.now();
    const dt = opts.fixedStep ?? Math.min(0.05, (now - last) / 1000);
    last = now;
    gameT += dt;
    // you walking
    if (path.length && pathI < path.length) {
      const [tx, tz] = path[pathI];
      const dx = tx - you.root.position.x, dz = tz - you.root.position.z, d = Math.hypot(dx, dz);
      const step = walkSpeed * dt;
      const want = Math.atan2(dx, dz);
      let dy = want - you.root.rotation.y; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
      you.root.rotation.y += dy * Math.min(1, dt * 8);
      if (d <= step) { you.root.position.x = tx; you.root.position.z = tz; pathI++; if (pathI >= path.length) { path = []; const f = afterPath; afterPath = null; f?.(); } }
      else { you.root.position.x += (dx / d) * step; you.root.position.z += (dz / d) * step; }
    }
    if (sitT >= 0) { sitT += dt; if (sitT > 1.6) { sitT = -1; setState("seated"); setShot("chair"); } }
    holdStep(you); holdStep(waiting); holdStep(barber);
    // the turntable: the chair turns slowly; a drag turns it and lets go with a little spin
    // (a barber's chair swivels: side to side, about 70 degrees each way, so the style is seen from the front, the
    // three-quarter and the side, and the chair's back never hides it)
    if (state === "seated" && turning) { turnT += dt; spinYaw += (Math.sin(turnT * 0.7) * 1.2 - spinYaw) * Math.min(1, dt * 3); }
    if (Math.abs(spinVel) > 1e-3) { spinYaw += spinVel * dt; spinVel *= Math.pow(0.04, dt); }
    if (state === "seated" || state === "cutting" || state === "sitting") { pivot.rotation.y = baseYaw + spinYaw; chair.rotation.y = baseYaw + spinYaw; }
    // the barber: walks up behind you for the cut, back to the counter after
    if (cutT >= 0) {
      cutT += dt;
      const k = Math.min(1, cutT / 0.8), back = Math.max(0, Math.min(1, (cutT - cutSecs + 0.6) / 0.6));
      tmp.copy(barberHome).lerp(barberWork, k * (1 - back));
      barber.root.position.copy(tmp);
      // he faces your head (a little round it as he works)
      const hx = CHAIRS[0][0] - barber.root.position.x, hz = CHAIRS[0][1] - barber.root.position.z;
      barber.root.rotation.y = Math.atan2(hx, hz) + Math.sin(cutT * 2.2) * 0.25 * k * (1 - back);
      clippers.visible = k > 0.5 && back < 0.5;
      spinYaw = Math.sin(cutT * 0.9) * 0.35 * k * (1 - back);
      if (cutT > cutSecs * 0.55 && cutLook) { const l = cutLook; cutLook = null; void preview(l); }
      if (cutT >= cutSecs) { cutT = -1; clippers.visible = false; spinYaw = 0; playOn(barber, "idle"); setState("seated"); setShot("mirror"); const f = cutDone; cutDone = null; f?.(); }
    }
    yourBlob.position.set(you.root.getWorldPosition(tmp).x, 0.006, tmp.z);
    you.mixer.update(dt); barber.mixer.update(dt); waiting.mixer.update(dt);
    for (const h of hairs) h.update?.(dt);
    poleT.offset.y = (gameT * 0.35) % 1;
    // the camera eases to the shot
    const sh = shotOf(shotNow, tall);
    const k = Math.min(1, dt * 3.2);
    camPos.lerp(tmp.set(...sh.pos), k); camLook.lerp(new THREE.Vector3(...sh.look), k);
    camFov += (sh.fov - camFov) * k;
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (Math.abs(camera.fov - camFov) > 1e-3) { camera.fov = camFov; camera.updateProjectionMatrix(); }
    if (mirror) mirror.visible = camera.position.x > MX + 0.2;
    renderer.info.autoReset = false; renderer.info.reset();
    renderer.render(scene, camera);
    renderer.info.autoReset = true;
    drawn++;
  };
  if (isOwner()) renderer.setAnimationLoop(frame);
  setState(state);

  const ctrl: BarberController = {
    preview,
    setTurn: (on) => { turning = on; if (!on) { spinVel = 0; } },
    spin: (dx) => { if (state !== "seated") return; spinYaw += dx * 0.012; spinVel = dx * 0.4; },
    cut: (look, secs = 3.5) => new Promise<void>((res) => {
      if (state !== "seated") { void preview(look).then(res); return; }
      turning = false; spinVel = 0;
      cutSecs = secs; cutT = 0; cutLook = look; cutDone = res;
      playOn(barber, barber.actions.talk ? "talk" : "idle");
      setState("cutting");
      setShot("cut");
    }),
    leave: () => {
      if (state === "leaving") return;
      turning = false; spinVel = 0; spinYaw = 0;
      setState("leaving");
      setShot("leave");
      // stand up: the sit played backwards, then the walk out
      playOn(you, "sit_down", { from: 1.6, speed: -1.15, hold: 0 });
      window.setTimeout(() => {
        if (disposed) return;
        walkAlong(walkOut(), () => { if (!disposed) cb.onLeft?.(); });
      }, 1300);
    },
    shot: setShot,
    stats: () => {
      const hp = new THREE.Vector3(); you.bones.Head?.getWorldPosition(hp);
      const hip = new THREE.Vector3(); you.bones.Hips?.getWorldPosition(hip);
      const r = (v: any) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality: tier, head: String(you.toonHead), hair: currentLook.mesh ?? null, state, headAt: r(hp), hipsAt: r(hip), root: r(you.root.getWorldPosition(new THREE.Vector3())), cam: r(camera.position) } as any;
    },
    dispose: () => {
      disposed = true;
      if (isOwner()) renderer.setAnimationLoop(null);
      ro.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      mirror?.dispose?.();
      envTex.dispose();
      release(scene);
    },
  };
  void frame;
  await awaitSmoothFrame(renderer, { isDead: () => disposed || gone(), isOwner });
  if (disposed || gone()) { ctrl.dispose(); throw abandonedSceneError(); }
  return ctrl;
}

/** Opens the barber's. A half-built 3D is thrown away properly before an error goes up. */
export async function startBarber(container: HTMLElement, cb: BarberCallbacks, data: BarberData, opts: BarberOptions = {}): Promise<BarberController> {
  const own: { release?: (root?: any) => void; root?: any } = {};
  const before = toonYou().hairLook;
  try {
    return await buildBarber(container, cb, data, opts, own);
  } catch (e) {
    setToonYou({ hairLook: before });
    if (own.release) { try { own.release(own.root); } catch { /* already gone */ } }
    throw e;
  }
}

export type { ToonHead };
