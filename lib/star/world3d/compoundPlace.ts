/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE TRAINING COMPOUND, IN 3D (phase 1: the grounds; Harry, 27-28 Nov 2026). Builds the plan in
 * ./compoundPlan.ts: the car park with marked bays and parked cars (code-built blocks, no car
 * models), the fence and the gate with brick pillars, the club's crest board and the security hut,
 * the forecourt, the main building's front (reception, the gym door, the canteen door), three
 * pitches with goals, mannequins, cones and poles, a small stand, lamps and floodlight masts,
 * hedges, and trees from the garden's own tree kit (garden3d/plantZones.ts + lowPolyTrees.ts, used
 * as they are). On the world kit's test page only (RUL-UI-002).
 *
 * SPEED (standing rule): every still piece goes into one of the plan's ZONES (a group each); the
 * world kit's scene joins each zone's pieces by material (freezeStatic), so a zone is a handful of
 * draws with a tight box, and three3d/tightCull.ts leaves out every zone outside the view. Repeats
 * (cars, wheels, lamps, cones, poles, mannequins, goals) are one instanced draw each. Materials are
 * shared. Zones wholly behind the building (seen from the camera) are left out too (`hiddenZones`).
 */
import { COMPOUND, ZONES, PARKED, DOORS, type CarModel, LAMPS, MASTS, FLAG, PLANTERS, CONES, POLES, MANNEQUINS, FORECOURT_BENCH, SPOTS, bayAt, compoundSolids, goalsOf, pitchBox, doorFront, type Solid } from "./compoundPlan";
import { seatObject, standObject, type SmartObject } from "./smartObject";
import { lawnCanvasSoft, hedgeCanvas, brickCanvas, skyCanvas, glowCanvas } from "../garden3d/textures";
import { buildPlantZones, hiddenBehind, type TreeAt, type BushAt, type Occluder } from "../garden3d/plantZones";
import { TREE_STYLE } from "../garden3d/lowPolyTrees";
import type { Quality3d } from "../three3d/quality";
import type { XZ } from "../tapWalk";

export type CompoundSky = "day" | "sunset" | "night";
/** The garden's three sky looks (garden3d/scene.ts SKY, the same colours), for the compound's open ground. */
const SKY: Record<CompoundSky, { top: string; mid: string; low: string; fog: string; sun: string; sunI: number; hemi: [string, string, number]; exp: number; dir: [number, number, number]; hill: string }> = {
  day: { top: "#3f78bf", mid: "#9cc2e4", low: "#f4dcb4", fog: "#e3d3b6", sun: "#ffe2b8", sunI: 2.6, hemi: ["#cfe0f4", "#4f4428", 0.95], exp: 1.0, dir: [0.55, 0.75, 0.85], hill: "#7f9a5c" },
  sunset: { top: "#2b2f66", mid: "#e2835a", low: "#ffcf8c", fog: "#eeb789", sun: "#ffa45a", sunI: 2.5, hemi: ["#ffcfa4", "#463624", 0.7], exp: 1.02, dir: [0.75, 0.3, 0.6], hill: "#7d7a4f" },
  night: { top: "#04070f", mid: "#0c1730", low: "#1b2747", fog: "#111a30", sun: "#9db8ff", sunI: 0.5, hemi: ["#5a6f9c", "#1a2216", 0.55], exp: 1.15, dir: [0.45, 0.9, -0.5], hill: "#1d2c22" },
};
/** Plain geometries joined into one (position and normal only): one draw. */
function joinGeos(THREE: any, gs: any[]) {
  const pos: number[] = [], nor: number[] = [];
  for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return out;
}
export const parseCompoundSky = (s: string | null | undefined): CompoundSky => (s === "sunset" || s === "night" ? s : "day");

export interface CompoundEnv {
  THREE: any;
  scene: any;
  prof: { anisotropy: number; shadows: boolean };
  tier: Quality3d;
  kit: { shirt: string; trim: string };
  club?: string;
  sky: CompoundSky;
}

export interface CompoundOut {
  objects: SmartObject[];
  solids: Solid[];
  bounds: [number, number, number, number];
  you: { x: number; z: number; yaw: number };
  ceil: number;
  camBox: [number, number, number, number];
  sun: any;
  /** Each frame: the trees' detail and which zones are hidden behind the building. */
  update: (camera: any) => void;
  /** Meshes to leave out of this picture (for three3d/tightCull.ts extraHide). */
  hidden: (camera: any) => any[];
  /** The sun's shadow follows you: call when you move (returns true when the shadow must be redrawn). */
  follow: (x: number, z: number) => boolean;
  /** The car park's group (the parked cars are added to it when they load: addParkedCars). */
  carPark: any;
  /** Things that move on their own (left out of the joining): the flag. */
  moving: any[];
  tick: (dt: number) => void;
  stats: () => Record<string, unknown>;
  dispose: () => void;
}

const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
function cv(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}
/** The club's crest: a shield in its colours, its initials, a ball. Drawn, not a real club badge. */
function drawCrest(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, shirt: string, trim: string, club: string) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  const shield = () => { g.beginPath(); g.moveTo(-50, -58); g.lineTo(50, -58); g.lineTo(50, 4); g.quadraticCurveTo(48, 46, 0, 66); g.quadraticCurveTo(-48, 46, -50, 4); g.closePath(); };
  shield(); g.fillStyle = trim; g.fill();
  g.save(); g.scale(0.86, 0.86); shield(); g.fillStyle = shirt; g.fill(); g.restore();
  g.fillStyle = trim; g.fillRect(-43, -14, 86, 14);
  const ini = club.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase() || "FC";
  g.fillStyle = trim; g.font = `900 30px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ini, 0, -34);
  g.beginPath(); g.arc(0, 28, 15, 0, Math.PI * 2); g.fillStyle = "#ffffff"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#111"; g.stroke();
  g.beginPath(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * Math.PI * 2) / 5; g.lineTo(Math.cos(a) * 6, 28 + Math.sin(a) * 6); } g.closePath(); g.fillStyle = "#111"; g.fill();
  g.restore();
}
/** Light ink on dark, or dark ink on light, for a colour. */
const inkOn = (hex: string) => { const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16); const l = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return l > 0.6 ? "#111318" : "#ffffff"; };

/** A pitch's grass with mowing stripes and its white lines. `small`: the small-sided pitch. */
export const RUNOFF = 2.5;
function pitchCanvas(len0: number, wid0: number, small: boolean): HTMLCanvasElement {
  // the run-off (RUNOFF m round it, a shade darker) is in the same picture: one draw a pitch
  const len = len0 + 2 * RUNOFF, wid = wid0 + 2 * RUNOFF;
  const W0 = 1024, H0 = Math.round((1024 * wid) / len);
  const [c, g0] = cv(W0, H0);
  g0.fillStyle = "#3c7f36"; g0.fillRect(0, 0, W0, H0);
  const off = (RUNOFF / len) * W0;
  g0.translate(off, off);
  const g = g0;
  const W = W0 - 2 * off, H = H0 - 2 * off;
  const px = W / len0;
  const stripes = small ? 8 : 12;
  for (let i = 0; i < stripes; i++) { g.fillStyle = i % 2 ? "#3f8a3a" : "#4a9a42"; g.fillRect((i * W) / stripes, 0, W / stripes + 1, H); }
  // a little worn grass in the goalmouths and the middle
  for (const [x, y, r] of [[0.04, 0.5, 0.06], [0.96, 0.5, 0.06], [0.5, 0.5, 0.05]]) { const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * W); gr.addColorStop(0, "rgba(140,128,74,0.35)"); gr.addColorStop(1, "rgba(140,128,74,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  g.strokeStyle = "rgba(255,255,255,0.92)"; g.lineWidth = Math.max(2, 0.12 * px);
  const m = 0.6 * px;
  g.strokeRect(m, m, W - 2 * m, H - 2 * m);
  g.beginPath(); g.moveTo(W / 2, m); g.lineTo(W / 2, H - m); g.stroke();
  g.beginPath(); g.arc(W / 2, H / 2, (small ? 4 : 7) * px, 0, Math.PI * 2); g.stroke();
  const boxD = (small ? 6 : 12) * px, boxW = (small ? 12 : 26) * px, sixD = (small ? 0 : 4.5) * px, sixW = 11 * px;
  for (const s of [0, 1]) {
    const x = s ? W - m - boxD : m;
    g.strokeRect(x, H / 2 - boxW / 2, boxD, boxW);
    if (sixD) g.strokeRect(s ? W - m - sixD : m, H / 2 - sixW / 2, sixD, sixW);
  }
  return c;
}
/** The car park's asphalt with white bay lines (two rows), as the plan's bays. */
function carParkCanvas(): HTMLCanvasElement {
  const C = COMPOUND.carPark;
  const lenX = C.x1 - C.x0, lenZ = C.z1 - C.z0;
  const W = 2048, H = Math.round((2048 * lenZ) / lenX);
  const [c, g] = cv(W, H);
  g.fillStyle = "#3d4045"; g.fillRect(0, 0, W, H);
  // speckle so it reads as asphalt
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 30000; i++) { const v = 50 + Math.floor(r() * 30); g.fillStyle = `rgba(${v},${v + 2},${v + 5},0.5)`; g.fillRect(r() * W, r() * H, 2, 2); }
  const px = W / lenX;
  const X = (x: number) => (x - C.x0) * px, Z = (z: number) => (z - C.z0) * px;
  g.strokeStyle = "rgba(245,245,240,0.9)"; g.lineWidth = Math.max(2, 0.1 * px);
  for (const row of [C.rowN, C.rowS]) {
    for (let i = 0; i <= C.bays; i++) { const x = C.firstX + i * C.bayW; g.beginPath(); g.moveTo(X(x), Z(row)); g.lineTo(X(x), Z(row + C.bayD)); g.stroke(); }
    const back = row === C.rowN ? row : row + C.bayD;
    g.beginPath(); g.moveTo(X(C.firstX), Z(back)); g.lineTo(X(C.firstX + C.bays * C.bayW), Z(back)); g.stroke();
  }
  // your bay: the club's "PLAYERS ONLY" in yellow, the aisle's arrows
  g.fillStyle = "rgba(250,204,21,0.9)"; g.font = `900 ${Math.round(0.42 * px)}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
  for (let i = 0; i < C.bays; i++) { g.save(); g.translate(X(C.firstX + i * C.bayW + C.bayW / 2), Z(C.rowN + C.bayD - 0.8)); g.fillText(i % 3 === 2 ? "STAFF" : "PLAYERS", 0, 0); g.restore(); }
  g.fillStyle = "rgba(245,245,240,0.8)";
  for (const x of [-14, -2, 8]) { const cx = X(x), cy = Z(35.5); g.beginPath(); g.moveTo(cx - 1.2 * px, cy - 0.3 * px); g.lineTo(cx + 0.4 * px, cy - 0.3 * px); g.lineTo(cx + 0.4 * px, cy - 0.7 * px); g.lineTo(cx + 1.2 * px, cy); g.lineTo(cx + 0.4 * px, cy + 0.7 * px); g.lineTo(cx + 0.4 * px, cy + 0.3 * px); g.lineTo(cx - 1.2 * px, cy + 0.3 * px); g.closePath(); g.fill(); }
  return c;
}
/** The road: asphalt, a dashed white centre line (one tile = 7 m along). */
function roadCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 128);
  g.fillStyle = "#34373c"; g.fillRect(0, 0, 256, 128);
  let s = 5; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 1500; i++) { const v = 44 + Math.floor(r() * 22); g.fillStyle = `rgba(${v},${v + 2},${v + 5},0.6)`; g.fillRect(r() * 256, r() * 128, 2, 2); }
  g.fillStyle = "#e9e9e4"; g.fillRect(0, 62, 150, 4);
  g.fillStyle = "#cfcfc8"; g.fillRect(0, 2, 256, 3); g.fillRect(0, 123, 256, 3);
  return c;
}
/** Paving slabs, light concrete, 512² tiling (one slab = 1/4 of the tile). */
function slabCanvas(): HTMLCanvasElement {
  const [c, g] = cv(256, 256);
  g.fillStyle = "#cfcbc2"; g.fillRect(0, 0, 256, 256);
  let s = 3; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = 196 + Math.floor(r() * 18); g.fillStyle = `rgb(${v},${v - 3},${v - 9})`; g.fillRect(i * 64 + 1, j * 64 + 1, 62, 62); }
  return c;
}
/** The building's sign: the crest and "<CLUB> TRAINING CENTRE". */
function buildingSign(club: string, shirt: string, trim: string): HTMLCanvasElement {
  const [c, g] = cv(1024, 160);
  g.fillStyle = "#16181d"; g.fillRect(0, 0, 1024, 160);
  drawCrest(g, 80, 80, 1.05, shirt, trim, club);
  g.fillStyle = "#f8fafc"; g.font = `900 60px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
  g.fillText(club.toUpperCase(), 160, 62);
  g.fillStyle = shirt === "#ffffff" ? trim : shirt; g.font = `800 34px ${FONT}`; g.fillText("TRAINING CENTRE", 162, 118);
  return c;
}
/** The crest board at the gate: the crest, the club's name, "TRAINING GROUND", "Players and staff only". */
function crestBoard(club: string, shirt: string, trim: string): HTMLCanvasElement {
  const [c, g] = cv(768, 400);
  g.fillStyle = shirt; g.fillRect(0, 0, 768, 400);
  g.fillStyle = trim; g.fillRect(0, 300, 768, 100);
  g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(0, 290, 768, 10);
  drawCrest(g, 150, 150, 1.9, shirt, trim, club);
  const ink = inkOn(shirt);
  g.fillStyle = ink; g.font = `900 64px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
  const name = club.toUpperCase();
  g.font = `900 ${name.length > 12 ? 46 : 64}px ${FONT}`; g.fillText(name, 290, 110);
  g.font = `800 40px ${FONT}`; g.fillText("TRAINING GROUND", 292, 180);
  g.fillStyle = inkOn(trim); g.font = `800 34px ${FONT}`; g.textAlign = "center"; g.fillText("PLAYERS AND STAFF ONLY", 384, 350);
  return c;
}
/** Door plates, one canvas each (GYM · RECEPTION · CANTEEN · SECURITY · KIT ROOM). */
function plate(text: string, accent: string): HTMLCanvasElement {
  const [c, g] = cv(512, 112);
  g.fillStyle = "#1a1d23"; g.fillRect(0, 0, 512, 112);
  g.fillStyle = accent; g.fillRect(0, 100, 512, 12);
  g.fillStyle = "#f8fafc"; g.font = `900 54px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, 52);
  return c;
}
/** The goal net (white mesh on clear). */
function netCanvas(): HTMLCanvasElement {
  const [c, g] = cv(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  return c;
}
/** The club flag on the pole. */
function flagCanvas(club: string, shirt: string, trim: string): HTMLCanvasElement {
  const [c, g] = cv(256, 160);
  g.fillStyle = shirt; g.fillRect(0, 0, 256, 160);
  g.fillStyle = trim; g.fillRect(0, 0, 256, 18); g.fillRect(0, 142, 256, 18);
  drawCrest(g, 128, 80, 0.85, shirt, trim, club);
  return c;
}

export function buildCompound(env: CompoundEnv): CompoundOut {
  const { THREE, scene, prof, kit, tier } = env;
  const club = env.club ?? "The Club";
  const sky = SKY[env.sky];
  const night = env.sky === "night";
  const C = COMPOUND;
  const disposables: any[] = [];
  const tex = (c: HTMLCanvasElement, rep?: [number, number], o: { srgb?: boolean } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = prof.anisotropy;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    disposables.push(t);
    return t;
  };
  const mat = (c: string, o: any = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o }); disposables.push(m); return m; };
  const basic = (o: any) => { const m = new THREE.MeshBasicMaterial(o); disposables.push(m); return m; };

  // ── the plates (GYM, RECEPTION, SECURITY …): one atlas picture, one material ──
  const PLATES = Array.from(new Set(["SECURITY", "KIT ROOM", club.toUpperCase().slice(0, 14), ...DOORS.map((d) => d.sign)]));
  const plateM = (() => {
    const [c, g] = cv(512, 112 * PLATES.length);
    PLATES.forEach((t, i) => g.drawImage(plate(t, kit.shirt), 0, i * 112));
    return basic({ map: tex(c), toneMapped: false });
  })();
  const platePanel = (parent: any, text: string, w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const i = Math.max(0, PLATES.indexOf(text)), n = PLATES.length;
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / n);
    const me = new THREE.Mesh(g, plateM);
    me.position.set(x, y, z); me.rotation.y = ry; me.castShadow = false; me.receiveShadow = false;
    parent.add(me);
    return me;
  };

  // ── light and sky (the garden's day / sunset / night) ──
  scene.background = tex(skyCanvas(sky.top, sky.mid, sky.low));
  scene.fog = new THREE.Fog(sky.fog, 70, 300);
  // far rolling hills all round (the garden's skyline, at the compound's size): hazy, one draw
  {
    const hills: any[] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + 0.15;
      const g = new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      g.scale(60 + (i % 3) * 22, 14 + ((i * 7) % 5) * 4, 40);
      g.rotateY(-a);
      g.translate(30 + Math.cos(a) * 190, -1, -10 + Math.sin(a) * 190);
      hills.push(g);
    }
    const hm = new THREE.Mesh(joinGeos(THREE, hills), mat(sky.hill, { roughness: 1 }));
    hm.name = "hills"; hm.castShadow = false; hm.receiveShadow = false;
    scene.add(hm);
    hills.forEach((g) => g.dispose());
    disposables.push(hm.geometry);
  }
  const hemi = new THREE.HemisphereLight(sky.hemi[0], sky.hemi[1], sky.hemi[2]);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(sky.sun, sky.sunI);
  const SUN_D = 40;
  const sunDir = new THREE.Vector3(sky.dir[0], sky.dir[1], sky.dir[2]).normalize();
  sun.castShadow = prof.shadows;
  const S = tier === "high" ? 26 : 20;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 90 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  let sunAt: XZ | null = null;
  const follow = (x: number, z: number) => {
    // the shadow box moves in steps of 6 m (snapped, so still things' shadows don't crawl)
    const sx = Math.round(x / 6) * 6, sz = Math.round(z / 6) * 6;
    if (sunAt && sunAt[0] === sx && sunAt[1] === sz) return false;
    sunAt = [sx, sz];
    sun.target.position.set(sx, 0, sz);
    sun.position.set(sx + sunDir.x * SUN_D, sunDir.y * SUN_D, sz + sunDir.z * SUN_D);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    return true;
  };
  follow(C.you.x, C.you.z);

  // ── materials (shared by every zone) ──
  const M = {
    grass: mat("#ffffff", { map: tex(lawnCanvasSoft(), [120, 120]), roughness: 0.95 }),
    asphalt: mat("#ffffff", { map: tex(carParkCanvas()), roughness: 0.92 }),
    road: mat("#ffffff", { map: tex(roadCanvas(), [60, 1]), roughness: 0.9 }),
    slabs: mat("#ffffff", { map: tex(slabCanvas(), [12, 3]), roughness: 0.9 }),
    path: mat("#ffffff", { map: tex(slabCanvas(), [1.5, 2]), roughness: 0.9 }),
    hedge: mat("#ffffff", { map: tex(hedgeCanvas(), [40, 1]), roughness: 0.95 }),
    brick: mat("#ffffff", { map: tex(brickCanvas("#8e4a35"), [1, 2]), roughness: 0.9 }),
    white: mat("#eceae4", { roughness: 0.8 }),
    clad: mat("#5a6270", { roughness: 0.55, metalness: 0.25 }),
    dark: mat("#2c3038", { roughness: 0.55, metalness: 0.3 }),
    // upper windows: a sky-blue reflective glass; the ground floor's doors and fronts: see-through, lit inside
    glass: mat("#7f9db5", { roughness: 0.1, metalness: 0.5, envMapIntensity: 1.4, emissive: "#ffd9a0", emissiveIntensity: night ? 0.45 : 0.0 }),
    see: mat("#9fc0d6", { roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.28, depthWrite: false }),
    metal: mat("#1d2026", { roughness: 0.45, metalness: 0.6 }),
    stone: mat("#d9d3c6", { roughness: 0.85 }),
    shirt: mat(kit.shirt, { roughness: 0.6 }),
    trim: mat(kit.trim, { roughness: 0.6 }),
    kerb: mat("#b9b6ae", { roughness: 0.9 }),
    lit: mat("#fff6df", { emissive: "#ffe7b0", emissiveIntensity: night ? 2.4 : 0.6, roughness: 0.5 }),
    inside: mat("#f4e6c8", { emissive: "#ffd7a0", emissiveIntensity: night ? 1.2 : 0.45, roughness: 0.8 }),
    seat: mat(kit.shirt, { roughness: 0.55 }),
    soil: mat("#6b5338", { roughness: 1 }),
    line: mat("#ffffff", { roughness: 0.6 }),
  };

  // ── zones: one group each (the scene joins a zone's pieces by material) ──
  const zone: Record<string, any> = {};
  for (const z of ZONES) { const g = new THREE.Group(); g.name = `compound-${z.id}`; g.userData.zone = z.id; scene.add(g); zone[z.id] = g; }
  const open = new THREE.Group(); open.name = "compound-open"; scene.add(open);
  const box = (parent: any, m: any, w: number, h: number, d: number, x: number, y: number, z: number, o: { ry?: number; cast?: boolean } = {}) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z); if (o.ry) me.rotation.y = o.ry;
    me.castShadow = o.cast ?? true; me.receiveShadow = true;
    parent.add(me);
    return me;
  };
  const flat = (parent: any, m: any, w: number, d: number, x: number, y: number, z: number, ry = 0) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    me.rotation.set(-Math.PI / 2, 0, ry); me.position.set(x, y, z); me.receiveShadow = true; me.castShadow = false;
    parent.add(me);
    return me;
  };
  const panel = (parent: any, m: any, w: number, h: number, x: number, y: number, z: number, ry = 0) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(x, y, z); me.rotation.y = ry; me.castShadow = false; me.receiveShadow = false;
    parent.add(me);
    return me;
  };

  // ── the ground: grass everywhere, a meadow beyond, the road ──
  const [bx0, bx1, bz0, bz1] = C.bounds;
  flat(open, M.grass, 420, 420, 30, 0, -10);
  flat(open, M.road, 420, 9, 30, 0.004, 50);
  // the hedge along the far side of the road
  box(open, M.hedge, 260, 1.6, 0.9, 30, 0.8, 55);

  // ── CAR PARK ──
  const cp = C.carPark;
  flat(zone.carpark, M.asphalt, cp.x1 - cp.x0, cp.z1 - cp.z0, (cp.x0 + cp.x1) / 2, 0.006, (cp.z0 + cp.z1) / 2);
  // the way in from the road (east end), kerbs round the rest
  flat(zone.carpark, M.road, 7, 2.4, cp.x1 - 3.5, 0.005, cp.z1 + 1.2);
  box(zone.carpark, M.kerb, cp.x1 - 7 - cp.x0, 0.14, 0.3, (cp.x0 + cp.x1 - 7) / 2, 0.07, cp.z1 + 0.15, { cast: false });
  box(zone.carpark, M.kerb, 0.3, 0.14, cp.z1 - cp.z0, cp.x0 - 0.15, 0.07, (cp.z0 + cp.z1) / 2, { cast: false });
  // a strip of grass and a low hedge on the road side
  box(zone.carpark, M.hedge, cp.x1 - 7 - cp.x0, 0.9, 0.8, (cp.x0 + cp.x1 - 7) / 2, 0.45, cp.z1 + 1.2);
  // parked cars: the game's own car models, added by addParkedCars (they load)

  // ── THE GATE, the fence, the crest board, the security hut ──
  const fz = C.fenceZ;
  {
    const G = zone.gate;
    // the hedge either side (the long runs go in the open group: they are thin and long)
    const hx0 = C.gate.x0 - C.gate.pillar, hx1 = C.gate.x1 + C.gate.pillar;
    box(open, M.hedge, hx0 - bx0, 1.8, 0.9, (bx0 + hx0) / 2, 0.9, fz);
    box(open, M.hedge, bx1 - hx1, 1.8, 0.9, (hx1 + bx1) / 2, 0.9, fz);
    // railings in front of the hedge near the gate: black bars and two rails
    const barM = M.metal;
    const runs = [[-14, hx0 - 0.1], [hx1 + 0.1, 14]] as const;
    const barG = new THREE.BoxGeometry(0.035, 1.8, 0.035); disposables.push(barG);
    const per = runs.map(([a, b]) => Math.round((b - a) / 0.16));
    const im = new THREE.InstancedMesh(barG, barM, per[0] + per[1]);
    const m4 = new THREE.Matrix4();
    let k = 0;
    runs.forEach(([a, b], r) => {
      box(G, barM, b - a, 0.06, 0.06, (a + b) / 2, 1.95, fz + 0.5, { cast: false });
      box(G, barM, b - a, 0.06, 0.06, (a + b) / 2, 0.3, fz + 0.5, { cast: false });
      for (let i = 0; i < per[r]; i++) { m4.makeTranslation(a + (i + 0.5) * ((b - a) / per[r]), 1.1, fz + 0.5); im.setMatrixAt(k++, m4); }
    });
    im.castShadow = false; im.computeBoundingSphere(); G.add(im);
    // brick pillars with stone caps and a lamp each
    for (const x of [C.gate.x0 - C.gate.pillar / 2, C.gate.x1 + C.gate.pillar / 2]) {
      box(G, M.brick, C.gate.pillar, 2.5, C.gate.pillar, x, 1.25, fz);
      box(G, M.stone, C.gate.pillar + 0.14, 0.14, C.gate.pillar + 0.14, x, 2.57, fz);
      box(G, M.metal, 0.22, 0.32, 0.22, x, 2.8, fz, { cast: false });
      box(G, M.lit, 0.16, 0.22, 0.16, x, 2.8, fz, { cast: false });
    }
    // the gate's two black leaves, swung open into the grounds
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.position.set(sx * (C.gate.x1 - 0.05), 0, fz - 0.05); leaf.rotation.y = -sx * 1.35;
      G.add(leaf);
      const lw = C.gate.x1 - 0.1;
      box(leaf, M.metal, lw, 0.08, 0.06, -sx * lw / 2, 1.85, 0, { cast: false });
      box(leaf, M.metal, lw, 0.08, 0.06, -sx * lw / 2, 0.25, 0, { cast: false });
      for (let k = 0; k < 13; k++) box(leaf, M.metal, 0.04, 1.65 + (k % 2) * 0.1, 0.04, -sx * (0.1 + k * (lw - 0.2) / 12), 1.05, 0, { cast: false });
    }
    // the path from the gate into the grounds, and a short apron outside it
    flat(G, M.path, 4.2, 8, 0, 0.007, 20);
    flat(G, M.path, 6, 3, 0, 0.007, 25.6);
    // the crest board, on two posts, facing the car park
    const B = C.board;
    for (const dx of [-B.w / 2 + 0.3, B.w / 2 - 0.3]) box(G, M.metal, 0.16, B.y0 + B.h, 0.16, B.x + dx, (B.y0 + B.h) / 2, B.z);
    box(G, M.metal, B.w + 0.16, B.h + 0.16, 0.14, B.x, B.y0 + B.h / 2, B.z - 0.06);
    const boardM = basic({ map: tex(crestBoard(club, kit.shirt, kit.trim)), toneMapped: false });
    boardM.color.setScalar(night ? 0.95 : 0.88);
    panel(G, boardM, B.w, B.h, B.x, B.y0 + B.h / 2, B.z + 0.015);
    // the security hut: white walls, a window band facing the gate, a flat roof with an overhang, a sign
    const H = C.hut, hw = H.x1 - H.x0, hd = H.z1 - H.z0, hcx = (H.x0 + H.x1) / 2, hcz = (H.z0 + H.z1) / 2;
    box(G, M.white, hw, H.h, hd, hcx, H.h / 2, hcz);
    box(G, M.clad, hw + 0.6, 0.22, hd + 0.6, hcx, H.h + 0.11, hcz);
    box(G, M.glass, 0.04, 1.0, hd - 0.8, H.x0 - 0.01, 1.55, hcz, { cast: false });
    box(G, M.inside, 0.03, 0.96, hd - 0.9, H.x0 + 0.01, 1.55, hcz, { cast: false });
    box(G, M.glass, hw - 1.4, 1.0, 0.04, hcx - 0.3, 1.55, H.z1 + 0.01, { cast: false });
    box(G, M.clad, 0.9, 2.1, 0.05, H.x1 - 0.7, 1.05, H.z1 + 0.02, { cast: false });
    platePanel(G, "SECURITY", 1.8, 0.4, hcx, H.h - 0.35, H.z1 + 0.04);
    platePanel(G, "SECURITY", 1.6, 0.36, H.x0 - 0.04, H.h - 0.35, hcz, -Math.PI / 2);
    // a car barrier arm across the way in (lifted)
    box(zone.carpark, M.white, 0.3, 1.0, 0.3, cp.x1 - 7.4, 0.5, cp.z1 - 0.3);
    const arm = box(zone.carpark, M.trim, 0.1, 4.2, 0.1, cp.x1 - 7.4, 3.0, cp.z1 - 0.3, { cast: false }); arm.rotation.z = 0.1;
  }

  // ── FORECOURT: paving, the path, planters, the bench, the flag ──
  const fc = C.forecourt;
  {
    const F = zone.forecourt;
    flat(F, M.slabs, fc.x1 - fc.x0, fc.z1 - fc.z0, (fc.x0 + fc.x1) / 2, 0.006, (fc.z0 + fc.z1) / 2);
    box(F, M.kerb, fc.x1 - fc.x0, 0.12, 0.25, (fc.x0 + fc.x1) / 2, 0.06, fc.z1 + 0.1, { cast: false });
    // planters: a stone box, soil, a small tree from the garden's kit (below, with the trees)
    for (const [x, z] of PLANTERS) { box(F, M.stone, 1.4, 0.6, 1.4, x, 0.3, z); flat(F, M.soil, 1.2, 1.2, x, 0.61, z); }
    // the bench (wood slats on a metal frame) facing east
    const fb = FORECOURT_BENCH;
    const woodM = mat("#8a5a36", { roughness: 0.75 });
    for (let k = 0; k < 4; k++) box(F, woodM, 0.1, 0.045, fb.len, fb.at[0] - 0.28 + k * 0.12, fb.y - 0.022, fb.at[1]);
    for (let k = 0; k < 2; k++) box(F, woodM, 0.04, 0.1, fb.len, fb.at[0] - 0.4, fb.y + 0.22 + k * 0.15, fb.at[1]);
    for (const dz of [-fb.len / 2 + 0.15, fb.len / 2 - 0.15]) { box(F, M.metal, 0.5, 0.05, 0.06, fb.at[0] - 0.15, fb.y - 0.07, fb.at[1] + dz); box(F, M.metal, 0.05, fb.y, 0.06, fb.at[0] + 0.05, fb.y / 2, fb.at[1] + dz); box(F, M.metal, 0.05, fb.y + 0.45, 0.06, fb.at[0] - 0.42, (fb.y + 0.45) / 2, fb.at[1] + dz); }
    // the flagpole
    box(F, M.white, 0.12, 9, 0.12, FLAG[0], 4.5, FLAG[1]);
    // a low wall with the club's name in front of the building (the photo spot)
    box(F, M.clad, 6.4, 0.9, 0.5, -11, 0.45, 18.2);
    platePanel(F, club.toUpperCase().slice(0, 14), 5.6, 0.62, -11, 0.48, 18.46);
  }
  // the flag itself moves (a slow wave): its own mesh, left out of the joining
  const flagGeo = new THREE.PlaneGeometry(2.2, 1.375, 12, 1);
  const flagBase = Float32Array.from(flagGeo.attributes.position.array as Float32Array);
  const flagM = mat("#ffffff", { map: tex(flagCanvas(club, kit.shirt, kit.trim)), side: THREE.DoubleSide, roughness: 0.8 });
  const flag = new THREE.Mesh(flagGeo, flagM);
  flag.position.set(FLAG[0] + 1.15, 8.2, FLAG[1]); flag.castShadow = false;
  scene.add(flag);
  disposables.push(flagGeo);
  let flagT = 0;

  // ── THE MAIN BUILDING (its front is the show; the back is plain) ──
  const bd = C.building;
  {
    const Bz = zone.building;
    const w = bd.x1 - bd.x0, d = bd.z1 - bd.z0, cx = (bd.x0 + bd.x1) / 2, cz = (bd.z0 + bd.z1) / 2;
    const F = bd.z1; // the front face
    // ground floor: dark cladding; first floor: white render; a club-colour band between; a parapet
    box(Bz, M.clad, w, 3.6, d, cx, 1.8, cz);
    box(Bz, M.white, w, bd.h - 3.6, d, cx, 3.6 + (bd.h - 3.6) / 2, cz);
    box(Bz, M.shirt, w + 0.08, 0.36, d + 0.08, cx, 3.62, cz, { cast: false });
    box(Bz, M.clad, w + 0.3, 0.4, d + 0.3, cx, bd.h + 0.2, cz);
    // the first floor's long ribbon windows (front and sides)
    box(Bz, M.glass, w - 3, 1.5, 0.06, cx, 5.4, F + 0.02, { cast: false });
    for (let k = 1; k < 12; k++) box(Bz, M.white, 0.12, 1.5, 0.1, bd.x0 + 1.5 + (k * (w - 3)) / 12, 5.4, F + 0.04, { cast: false });
    // the ground floor's cladding fins (a modern front, not a flat slab)
    for (let k = 0; k <= 16; k++) { const x = bd.x0 + 0.4 + (k * (w - 0.8)) / 16; if (Math.abs(x) > 5.4 && DOORS.every((d) => Math.abs(x - d.x) > 1.3) && Math.abs(Math.abs(x) - 11) > 1.85) box(Bz, M.white, 0.14, 3.4, 0.16, x, 1.7, F + 0.06, { cast: false }); }
    for (const sx of [bd.x0 - 0.02, bd.x1 + 0.02]) box(Bz, M.glass, 0.06, 1.5, d - 4, sx, 5.4, cz, { cast: false });
    // reception: a glass front in the middle, lit inside, under a canopy on two posts
    box(Bz, M.inside, 9.6, 3.1, 0.04, 0, 1.6, F + 0.01, { cast: false });
    box(Bz, M.see, 10, 3.2, 0.06, 0, 1.6, F + 0.05, { cast: false });
    // inside reception: the desk and a wall in the club's colour, seen through the glass
    box(Bz, M.shirt, 9.4, 0.5, 0.05, 0, 2.6, F - 0.02, { cast: false });
    box(Bz, M.white, 3.6, 1.1, 0.7, 0, 0.55, F - 0.6, { cast: false });
    for (let k = 0; k <= 5; k++) box(Bz, M.metal, 0.08, 3.2, 0.1, -5 + k * 2, 1.6, F + 0.08, { cast: false });
    box(Bz, M.white, 13, 0.3, 4.2, 0, 3.35, F + 2.1);
    for (const sx of [-6, 6]) box(Bz, M.white, 0.26, 3.2, 0.26, sx, 1.6, F + 3.8);
    // the sign over the canopy (lit): the crest and the club's name
    const signM = basic({ map: tex(buildingSign(club, kit.shirt, kit.trim)), toneMapped: false });
    panel(Bz, signM, 10.4, 1.62, 0, 4.42 + 0.02, F + 0.07);
    // the three doors: a frame, glass, the light inside, a plate over each
    for (const dr of DOORS) {
      const wide = dr.id === "door-reception";
      if (!wide) {
        box(Bz, M.inside, bd.doorW, bd.doorH, 0.04, dr.x, bd.doorH / 2, F + 0.02, { cast: false });
        for (const sx of [-1, 1]) box(Bz, M.metal, 0.12, bd.doorH + 0.1, 0.14, dr.x + sx * (bd.doorW / 2 + 0.06), (bd.doorH + 0.1) / 2, F + 0.07, { cast: false });
        box(Bz, M.metal, bd.doorW + 0.24, 0.12, 0.14, dr.x, bd.doorH + 0.06, F + 0.07, { cast: false });
        box(Bz, M.see, bd.doorW - 0.2, bd.doorH - 0.2, 0.04, dr.x, bd.doorH / 2, F + 0.12, { cast: false });
        box(Bz, M.metal, 0.05, bd.doorH - 0.2, 0.05, dr.x, bd.doorH / 2, F + 0.14, { cast: false });
        // a small canopy over each side door
        box(Bz, M.white, bd.doorW + 1, 0.16, 1.2, dr.x, bd.doorH + 0.45, F + 0.6);
      }
      platePanel(Bz, dr.sign, wide ? 2.6 : 2.0, wide ? 0.56 : 0.44, dr.x, wide ? 2.95 : bd.doorH + 0.22, F + (wide ? 4.22 : 0.15));
      // the doormat
      flat(Bz, M.clad, bd.doorW + 0.4, 1.2, dr.x, 0.012, F + 0.75);
    }
    // a gym window either side of the gym door: you can see it's lit inside
    for (const sx of [-1, 1]) {
      box(Bz, M.inside, 3.2, 1.7, 0.04, -11 + sx * 3.6, 1.75, F + 0.01, { cast: false });
      box(Bz, M.see, 3.4, 1.9, 0.06, -11 + sx * 3.6, 1.75, F + 0.05, { cast: false });
      // the gym through its windows: a mirror wall stripe and the racks' dark shapes
      box(Bz, M.shirt, 3.2, 0.18, 0.05, -11 + sx * 3.6, 2.3, F - 0.01, { cast: false });
      for (let k = 0; k < 3; k++) box(Bz, M.dark, 0.18, 1.2, 0.05, -11 + sx * 3.6 - 1 + k, 1.2, F - 0.02, { cast: false });
      box(Bz, M.inside, 3.2, 1.7, 0.04, 11 + sx * 3.6, 1.75, F + 0.01, { cast: false });
      box(Bz, M.see, 3.4, 1.9, 0.06, 11 + sx * 3.6, 1.75, F + 0.05, { cast: false });
    }
    // the kit room door on the east end
    box(Bz, M.metal, 0.1, 2.3, 1.6, bd.x1 + 0.05, 1.15, 3.5, { cast: false });
    platePanel(Bz, "KIT ROOM", 1.6, 0.35, bd.x1 + 0.12, 2.6, 3.5, Math.PI / 2);
    // roof kit (plant boxes) so the skyline isn't a plain slab
    box(Bz, M.kerb, 5, 1.2, 3, -9, bd.h + 0.6, -2);
    box(Bz, M.kerb, 3, 0.9, 2, 8, bd.h + 0.45, -3);
  }

  // ── THE STAND on pitch A's west touchline ──
  {
    const st = C.stand, Z = zone.stand;
    const len = st.z1 - st.z0, cz = (st.z0 + st.z1) / 2;
    const stepD = (st.x1 - st.x0) / st.rows;
    for (let r = 0; r < st.rows; r++) {
      const x = st.x1 - stepD * (r + 0.5);
      box(Z, M.stone, stepD, 0.4 * (r + 1), len, x, 0.2 * (r + 1), cz);
      // the seats: one long club-colour bench per row (one draw with the rest after joining)
      box(Z, M.seat, stepD * 0.5, 0.12, len - 0.4, x - stepD * 0.15, 0.4 * (r + 1) + 0.24, cz, { cast: false });
      box(Z, M.seat, 0.06, 0.34, len - 0.4, x - stepD * 0.42, 0.4 * (r + 1) + 0.42, cz, { cast: false });
    }
    // the roof on posts
    for (const z of [st.z0 + 0.3, cz, st.z1 - 0.3]) box(Z, M.metal, 0.16, 4.2, 0.16, st.x0 + 0.2, 2.1, z);
    const roof = box(Z, M.clad, st.x1 - st.x0 + 1.2, 0.14, len + 0.6, (st.x0 + st.x1) / 2 + 0.3, 4.15, cz); roof.rotation.z = -0.08;
    platePanel(Z, club.toUpperCase().slice(0, 14), 6, 0.5, st.x0 + 0.06, 3.65, cz, -Math.PI / 2);
  }

  // ── THE PITCHES: the grass and lines, goals, the training kit ──
  {
    const pitchTex: Record<string, any> = {};
    for (const p of C.pitches) {
      const small = p.id === "C";
      const key = small ? "C" : "AB";
      pitchTex[key] ??= mat("#ffffff", { map: tex(pitchCanvas(p.len, p.wid, small)), roughness: 0.95 });
      const Z = zone[`pitch${p.id}`];
      // the pitch with its run-off round it (one picture)
      flat(Z, pitchTex[key], p.len + 2 * RUNOFF, p.wid + 2 * RUNOFF, p.x, 0.005, p.z);
    }
    // goals: white posts and bar, a frame back to the stanchions, a net: two instanced draws for all six
    const goals = goalsOf();
    const frameParts: any[] = [];
    const post = (w: number, h: number, d: number, x: number, y: number, z: number) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); frameParts.push(g); };
    // a unit goal: 1 wide, 1 tall, facing +x (into the pitch), back at -x
    post(0.12 / 7.32, 1, 0.12 / 7.32, 0, 0.5, -0.5); post(0.12 / 7.32, 1, 0.12 / 7.32, 0, 0.5, 0.5); post(0.12 / 7.32, 0.12 / 2.44, 1.01, 0, 1, 0);
    post(0.25, 0.03, 0.02, -0.12, 0.015, -0.5); post(0.25, 0.03, 0.02, -0.12, 0.015, 0.5); post(0.02, 0.03, 1, -0.25, 0.015, 0);
    const mergeGeometries = ((gs: any[]) => { const out = new THREE.BufferGeometry(); const pos: number[] = [], nor: number[] = []; for (const g0 of gs) { const g = g0.index ? g0.toNonIndexed() : g0; pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); } out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return out; });
    const frameG = mergeGeometries(frameParts);
    const netParts: any[] = [];
    const np = (w: number, h: number, x: number, y: number, z: number, ry: number, rx = 0) => { const g = new THREE.PlaneGeometry(w, h); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z); netParts.push(g); };
    np(1, 1, -0.25, 0.5, 0, Math.PI / 2); // back
    np(0.25, 1, -0.125, 0.5, -0.5, 0); np(0.25, 1, -0.125, 0.5, 0.5, 0); // sides
    np(0.25, 1, -0.125, 1, 0, Math.PI / 2, Math.PI / 2); // roof
    const netG = (() => { const out = new THREE.BufferGeometry(); const pos: number[] = [], uv: number[] = [], nor: number[] = []; for (const g of netParts) { const gg = g.toNonIndexed(); pos.push(...gg.attributes.position.array); uv.push(...gg.attributes.uv.array); nor.push(...gg.attributes.normal.array); } out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); return out; })();
    disposables.push(frameG, netG);
    const netT = tex(netCanvas(), [10, 4]);
    const frames = new THREE.InstancedMesh(frameG, mat("#f7f7f4", { roughness: 0.4 }), goals.length);
    const nets = new THREE.InstancedMesh(netG, mat("#ffffff", { map: netT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }), goals.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    goals.forEach((g, i) => {
      // faces into the pitch: the west goal's front looks east (+x)
      q.setFromAxisAngle(up, g.face === Math.PI / 2 ? 0 : Math.PI);
      m4.compose(p3.set(g.x, 0, g.z), q, s3.set(g.w, g.h, g.w)); // the stanchions 1.8 m back at full size
      frames.setMatrixAt(i, m4); nets.setMatrixAt(i, m4);
    });
    frames.castShadow = true; nets.castShadow = false;
    for (const im of [frames, nets]) { im.computeBoundingSphere(); open.add(im); }
    // training kit on the pitches: cones, slalom poles, a wall of mannequins (one instanced draw each)
    const coneG = new THREE.ConeGeometry(0.11, 0.24, 8); coneG.translate(0, 0.12, 0);
    const poleG = new THREE.CylinderGeometry(0.018, 0.018, 1.6, 6); poleG.translate(0, 0.8, 0);
    // a mannequin: a body, shoulders, a head, on a spike (the free-kick wall dummy)
    const manG = (() => {
      const parts = [new THREE.CylinderGeometry(0.2, 0.17, 1.05, 10), new THREE.SphereGeometry(0.13, 10, 8), new THREE.BoxGeometry(0.5, 0.12, 0.22), new THREE.CylinderGeometry(0.015, 0.015, 0.5, 5)];
      parts[0].translate(0, 0.98, 0); parts[1].translate(0, 1.7, 0); parts[2].translate(0, 1.45, 0); parts[3].translate(0, 0.25, 0);
      return mergeGeometries(parts);
    })();
    disposables.push(coneG, poleG, manG);
    const cones = new THREE.InstancedMesh(coneG, mat("#ff7a1a", { roughness: 0.6 }), CONES.length);
    const poles = new THREE.InstancedMesh(poleG, mat("#ffd21a", { roughness: 0.5 }), POLES.length);
    const mans = new THREE.InstancedMesh(manG, M.shirt, MANNEQUINS.length);
    CONES.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); cones.setMatrixAt(i, m4); });
    POLES.forEach(([x, z], i) => { m4.makeTranslation(x, 0, z); poles.setMatrixAt(i, m4); });
    MANNEQUINS.forEach(([x, z], i) => { m4.compose(p3.set(x, 0, z), q.setFromAxisAngle(up, -Math.PI / 2), s3.set(1, 1, 1)); mans.setMatrixAt(i, m4); });
    cones.castShadow = false; poles.castShadow = true; mans.castShadow = true;
    for (const im of [cones, poles, mans]) { im.computeBoundingSphere(); zone.pitchA.add(im); }
    // a few training bibs and a ball bag by the kit man's goal: a bag (no ball: balls belong to the real engine)
    box(zone.pitchA, M.clad, 0.6, 0.7, 0.6, 33.2, 0.35, -12.6);
    box(zone.pitchA, mat("#d6f53a", { roughness: 0.7 }), 0.5, 0.06, 0.4, 34.2, 0.03, -12.2, { cast: false });
  }

  // ── LAMPS and FLOODLIGHT MASTS (posts and heads: instanced) ──
  {
    const postG = new THREE.CylinderGeometry(0.06, 0.08, 4.4, 8); postG.translate(0, 2.2, 0);
    const headG = new THREE.BoxGeometry(0.5, 0.12, 0.24); headG.translate(0.18, 4.42, 0);
    const mastG = new THREE.CylinderGeometry(0.14, 0.24, 16, 8); mastG.translate(0, 8, 0);
    const bankG = new THREE.BoxGeometry(1.6, 1.0, 0.25); bankG.translate(0, 16.2, 0);
    disposables.push(postG, headG, mastG, bankG);
    const posts = new THREE.InstancedMesh(postG, M.metal, LAMPS.length);
    const heads = new THREE.InstancedMesh(headG, M.lit, LAMPS.length);
    const masts = new THREE.InstancedMesh(mastG, mat("#9aa0a6", { roughness: 0.5, metalness: 0.5 }), MASTS.length);
    const banks = new THREE.InstancedMesh(bankG, M.lit, MASTS.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    LAMPS.forEach(([x, z], i) => { m4.compose(p3.set(x, 0, z), q.setFromAxisAngle(up, (i * 1.7) % 6.28), s3); posts.setMatrixAt(i, m4); heads.setMatrixAt(i, m4); });
    MASTS.forEach(([x, z], i) => { m4.compose(p3.set(x, 0, z), q.setFromAxisAngle(up, Math.atan2(62 - x, 0 - z)), s3); masts.setMatrixAt(i, m4); banks.setMatrixAt(i, m4); });
    posts.castShadow = true; masts.castShadow = true; heads.castShadow = false; banks.castShadow = false;
    for (const im of [posts, heads, masts, banks]) { im.computeBoundingSphere(); open.add(im); }
    // at night: a pool of light on the ground under each lamp (one instanced draw, no real lights)
    if (night || env.sky === "sunset") {
      const poolG = new THREE.PlaneGeometry(5, 5); poolG.rotateX(-Math.PI / 2);
      disposables.push(poolG);
      const poolM = basic({ map: tex(glowCanvas("255,220,160")), transparent: true, depthWrite: false, opacity: night ? 0.55 : 0.2, toneMapped: false, blending: THREE.AdditiveBlending });
      const pools = new THREE.InstancedMesh(poolG, poolM, LAMPS.length);
      LAMPS.forEach(([x, z], i) => { m4.makeTranslation(x, 0.03, z); pools.setMatrixAt(i, m4); });
      pools.renderOrder = 1; pools.computeBoundingSphere(); open.add(pools);
    }
  }

  // ── HEDGES round the outside, TREES from the garden's own kit (as they are) ──
  box(open, M.hedge, 0.9, 1.8, bz1 - bz0 - 21, bx0 - 0.4, 0.9, (bz0 + fz) / 2);
  box(open, M.hedge, 0.9, 1.8, fz - bz0, bx1 + 0.4, 0.9, (bz0 + fz) / 2);
  box(open, M.hedge, bx1 - bx0, 1.8, 0.9, (bx0 + bx1) / 2, 0.9, bz0 - 0.4);
  const trees: TreeAt[] = [];
  const bushes: BushAt[] = [];
  {
    let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const shapes = ["round", "wide", "tall", "pine"] as const;
    const tree = (x: number, z: number, big = 1, shape?: (typeof shapes)[number]) => trees.push({ x, z, s: 1, ry: r() * 6.28, h: (5 + r() * 3) * big, w: (3.4 + r() * 1.6) * big, shape: shape ?? shapes[Math.floor(r() * 3)], seed: Math.floor(r() * 9999) });
    // along the road, outside the car park; across the road, two staggered rows (the view back from your car)
    for (let x = -30; x <= 92; x += 9 + r() * 3) if (x < cp.x0 - 2 || x > cp.x1 + 1) tree(x, 47 + r() * 2);
    for (let x = -40; x <= 100; x += 7 + r() * 3) tree(x, 57 + r() * 2, 1.15);
    // Low: the far rows are left out (each zone of trees is a draw; Low is held to 60)
    if (tier !== "low") for (let x = -36; x <= 100; x += 9 + r() * 3) tree(x, 64 + r() * 3, 1.35, r() < 0.3 ? "pine" : "tall");
    // a line of tall trees behind the pitches and round the back (a windbreak)
    for (let z = -62; z <= 20; z += 8 + r() * 3) tree(bx1 + 5 + r() * 2, z, 1.25, "tall");
    if (tier !== "low") for (let x = -30; x <= 92; x += 8 + r() * 3) tree(x, bz0 - 5 - r() * 2, 1.2, r() < 0.4 ? "pine" : "tall");
    for (let z = -60; z <= 40; z += 8 + r() * 3) tree(bx0 - 5 - r() * 2, z, 1.15);
    // a group by the car park and the gate (seen on arrival), the forecourt's planters
    for (const [x, z] of [[-27, 26], [-28.5, 31], [-26, 37.5], [17, 26.5], [21, 30], [-14, 21.5], [-20, 21.2], [12, 21.4]] as const) tree(x, z, 0.9);
    for (const [x, z] of PLANTERS) trees.push({ x, z, s: 1, ry: r() * 6.28, h: 4.8, w: 1.7, shape: "tall", seed: Math.floor(r() * 9999) });
    // bushes along the building's front and the hut
    for (let x = -18; x <= 18; x += 1.6) if (Math.abs(x) > 6.2 && DOORS.every((d) => Math.abs(x - d.x) > 2.2)) bushes.push({ x, z: bd.z1 + 0.5, s: 0.55 + r() * 0.2, seed: Math.floor(r() * 9999) });
    for (const x of [-15, -18.5, 15, 18.5]) bushes.push({ x, z: 22.3, s: 0.8, seed: Math.floor(r() * 9999) });
  }
  const occluders: Occluder[] = [{ x0: bd.x0, x1: bd.x1, y0: 0, y1: bd.h, z0: bd.z0, z1: bd.z1 }];
  const plants = buildPlantZones(THREE, trees, bushes, { style: TREE_STYLE, occluders });
  scene.add(plants.group);

  // ── the smart objects: the doors, the people's spots, the forecourt bench ──
  const objects: SmartObject[] = [];
  for (const d of DOORS) {
    const f = doorFront(d);
    const o = standObject({ id: d.id, kind: "door", label: d.label, front: f, face: [d.x, bd.z1], verb: d.verb, lines: d.lines, pickR: 1.3, pickH: 2.8, who: "you" });
    objects.push(o);
  }
  for (const sp of SPOTS) objects.push(standObject({ id: sp.id, kind: "spot", label: sp.label, front: sp.at, face: sp.face, verb: "Stand here", stay: [20, 40], who: "people", pickR: 0.01, pickH: 0 }));
  const fb = FORECOURT_BENCH;
  objects.push(seatObject({ id: fb.id, label: "Bench", at: fb.at, facing: fb.facing, seats: fb.seats, y: fb.y, spacing: 0.66, front: 0.2, verb: "Sit down", lines: ["Watch the lads come in."] }));
  const gateObj = standObject({ id: "gate", kind: "gate", label: `${club} training ground`, front: [0, 26.6], face: [0, 24], verb: "Walk in", lines: ["Players and staff only. Security nods you through."], pickR: 2.2, pickH: 2.8, who: "you" });
  objects.push(gateObj);
  const boardObj = standObject({ id: "board", kind: "spot", label: "The crest board", front: [C.board.x, C.board.z + 1.1], face: [C.board.x, C.board.z], verb: "Take a photo", lines: [`${club}. Training ground.`, "Fans wait here on match weeks."], pickR: 2.3, pickH: 3.4, who: "you" });
  objects.push(boardObj);

  // ── PAINT: the zones' plain colours joined into one vertex-coloured draw per zone (and per shadow / no shadow) ──
  {
    const PAINT = new Set<any>([M.white, M.clad, M.dark, M.metal, M.stone, M.shirt, M.trim, M.kerb, M.seat, M.soil, M.line]);
    const paintM = mat("#ffffff", { vertexColors: true, roughness: 0.7, metalness: 0.08 });
    scene.updateMatrixWorld(true);
    for (const grp of [...Object.values(zone), open]) {
      const bins: Record<string, { pos: number[]; nor: number[]; col: number[] }> = {};
      const gone: any[] = [];
      grp.traverse((m: any) => {
        if (!m.isMesh || m.isInstancedMesh || !PAINT.has(m.material)) return;
        const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
        const key = m.castShadow ? "cast" : "flat";
        const b = bins[key] ?? (bins[key] = { pos: [], nor: [], col: [] });
        const c = m.material.color;
        const P = g.attributes.position.array, N = g.attributes.normal.array;
        for (let i = 0; i < P.length; i++) { b.pos.push(P[i]); b.nor.push(N[i]); }
        for (let i = 0; i < P.length / 3; i++) b.col.push(c.r, c.g, c.b);
        g.dispose();
        gone.push(m);
      });
      for (const m of gone) { m.parent.remove(m); m.geometry.dispose(); }
      for (const [key, b] of Object.entries(bins)) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
        g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
        g.setAttribute("color", new THREE.Float32BufferAttribute(b.col, 3));
        g.computeBoundingBox(); g.computeBoundingSphere();
        const me = new THREE.Mesh(g, paintM);
        me.castShadow = key === "cast"; me.receiveShadow = true;
        me.name = `${grp.name}-paint`;
        grp.add(me);
        disposables.push(g);
      }
    }
  }

  // zones hidden behind the building: tested every 4th frame (as the plants do)
  const zoneMeshes = new Map<string, any[]>();
  const zoneCorners = ZONES.map((z) => ({ id: z.id, corners: [z.box[0], z.box[1]].flatMap((x) => [0, z.h].flatMap((y) => [z.box[2], z.box[3]].map((zz) => [x, y, zz]))) }));
  const behind = new Set<string>();
  let tickN = 0;
  const update = (camera: any) => {
    plants.update(camera, tier);
    if (tickN++ % 4 !== 0) return;
    const e = camera.position, eye = [e.x, e.y, e.z];
    behind.clear();
    for (const z of zoneCorners) if (z.id !== "building" && hiddenBehind(eye, z.corners, occluders[0])) behind.add(z.id);
  };
  const hidden = () => {
    const out: any[] = [...plants.behind()];
    behind.forEach((id) => {
      let list = zoneMeshes.get(id);
      if (!list) { list = []; zone[id]?.traverse((m: any) => { if (m.isMesh) list!.push(m); }); zoneMeshes.set(id, list); }
      out.push(...list);
    });
    return out;
  };
  const tick = (dt: number) => {
    flagT += dt;
    const pos = flagGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = flagBase[i * 3] + 1.1; // 0 at the pole
      pos.setZ(i, Math.sin(flagT * 3.2 - x * 2.2) * 0.12 * (x / 2.2));
    }
    pos.needsUpdate = true;
  };

  return {
    objects,
    solids: compoundSolids(),
    bounds: C.bounds,
    you: { x: C.you.x, z: C.you.z, yaw: C.you.yaw },
    ceil: 30,
    camBox: [bx0 - 2, bx1 + 2, bz0 - 2, bz1 + 4],
    sun,
    update, hidden, follow, tick,
    moving: [flag],
    carPark: zone.carpark,
    stats: () => ({ zones: ZONES.length, plantZones: plants.zones, behind: Array.from(behind), trees: trees.length, bushes: bushes.length, pitchBoxes: C.pitches.map(pitchBox) }),
    dispose: () => { plants.dispose(); for (const d of disposables) d.dispose?.(); zoneMeshes.clear(); },
  };
}

/**
 * THE PARKED CARS: the game's own car models (the light copies the house's drive window shows,
 * home3d/outfits.ts CAR_LOD), several colours, one instanced draw per model. Each model is baked once to
 * plain numbers, turned to lie along z, sized to its real length (CAR_LENGTH), standing on the ground.
 * A tint multiplies the model's own paint (white = as it is). Front row nose in, back row nose out.
 */
export async function addParkedCars(THREE: any, parent: any, glb: (url: string) => Promise<any>): Promise<{ draws: number; triangles: number }> {
  const { CAR_LOD, CAR_LENGTH } = await import("../home3d/outfits");
  const { carPaint } = await import("../home3d/roomBuild");
  const used = Array.from(new Set(PARKED.map((p) => p.model))) as CarModel[];
  let draws = 0, triangles = 0;
  await Promise.all(used.map(async (model) => {
    const g = await glb(CAR_LOD[model]);
    let mesh: any = null;
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o: any) => { if (o.isMesh && !mesh) mesh = o; });
    if (!mesh) return;
    // baked to plain floats in world space (the file's positions are packed small: KHR_mesh_quantization)
    const src = mesh.geometry;
    const geo = new THREE.BufferGeometry();
    const n = src.attributes.position.count;
    const pos = new Float32Array(n * 3), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(src.attributes.position, i).applyMatrix4(mesh.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (src.attributes.uv) { const uv = new Float32Array(n * 2); for (let i = 0; i < n; i++) uv.set([src.attributes.uv.getX(i), src.attributes.uv.getY(i)], i * 2); geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); }
    if (src.index) geo.setIndex(Array.from(src.index.array as ArrayLike<number>));
    geo.computeBoundingBox();
    let bb = geo.boundingBox; const sz = bb.getSize(new THREE.Vector3());
    if (sz.x > sz.z) geo.rotateY(Math.PI / 2); // long side along z
    geo.computeBoundingBox(); bb = geo.boundingBox;
    const s = (CAR_LENGTH[model] ?? 4.4) / Math.max(1e-3, bb.max.z - bb.min.z);
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    geo.scale(s, s, s);
    geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const matl = carPaint(mesh.material, null);
    // far: the same car from fewer triangles (farBodies.ts clustering), drawn when the camera is 26 m+ from the car park
    const { clusterTriangles } = await import("./farBodies");
    const full = geo.index ? (Array.from(geo.index.array) as number[]) : Array.from({ length: n }, (_, i) => i);
    const far = clusterTriangles(geo.attributes.position, full, (CAR_LENGTH[model] ?? 4.4) / 22, undefined, geo.attributes.uv);
    geo.setIndex([...full, ...far]);
    geo.setDrawRange(0, full.length);
    const list = PARKED.filter((p) => p.model === model);
    const im = new THREE.InstancedMesh(geo, matl, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p3 = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    list.forEach((p, i) => {
      const [x, z] = bayAt(p.bay, p.row);
      q.setFromAxisAngle(up, p.row === "N" ? Math.PI : 0);
      m4.compose(p3.set(x, 0, z), q, one);
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.set(p.tint));
    });
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = true; im.receiveShadow = true;
    im.computeBoundingSphere();
    im.name = `car-${model}`;
    const cpx = (COMPOUND.carPark.x0 + COMPOUND.carPark.x1) / 2, cpz = (COMPOUND.carPark.z0 + COMPOUND.carPark.z1) / 2;
    const pick = (camera: any) => { const d = camera?.position ? Math.hypot(camera.position.x - cpx, camera.position.z - cpz) : 0; if (d > 26) geo.setDrawRange(full.length, far.length); else geo.setDrawRange(0, full.length); };
    im.onBeforeRender = (_r: any, _s: any, camera: any) => pick(camera);
    im.onBeforeShadow = () => geo.setDrawRange(0, full.length);
    parent.add(im);
    draws++; triangles += full.length / 3 * list.length;
  }).map((pr) => pr.catch((e: unknown) => console.error("compound: car", e))));
  return { draws, triangles: Math.round(triangles) };
}
