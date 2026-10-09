/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ONE ROOM OF YOUR HOME, IN 3D — built on its own, and freed on its own.
 *
 * ./scene.ts keeps the renderer, the lights, you, the camera and the walking;
 * it asks this file for one room at a time (./rooms.ts says which rooms a
 * home has and where their doors are). Every room is built round the middle
 * of the world (0, 0), north is -z. Everything a room makes hangs under its
 * own group, so `dispose()` frees all of it: shapes, materials, pictures and
 * the mirror's picture.
 *
 * "main" is the one-room home exactly as it was before rooms (the starter
 * flat, the flat, and every tier on the Old look). The new rooms reuse its
 * pieces: the wardrobe and mirror, the trophy cabinet, the drive window.
 *
 * Budgets per room (Harry's speed rules, docs/3D_HANDBOOK.md): at most 50
 * draws and 45k triangles, at most two new 1024 pictures (the window views),
 * the mirror only in the dressing room (and off on Low). Checked headless in
 * tests/star/home3d.mts.
 */
import { freezeStatic } from "../freezeStatic";
import { blobCanvas } from "../shop3d/textures";
import type { Quality3d } from "../three3d/quality";
import { roomPreset, type HomeTier, type RoomId, type RoomPreset, type WindowView } from "./homes";
import { roomPlan, carsIn, NO_STUFF, ROOM_LABEL, TERRACE_PROPS, JET_LOD, HORSE_MODEL, type DoorPlan, type HomeSpot, type HomeStuff, type RoomPlan, type Wall } from "./rooms";
import type { CabinetSlot, TrophyShape } from "./trophies";
import type { BootChoice, CasualSet, Kit2 } from "./outfits";
import type { XZ } from "../tapWalk";
import {
  floorCanvas, wallCanvas, floorShadeCanvas, glowCanvas, patchCanvas, viewCanvas,
  driveBackCanvas, driveCanvas, platesCanvas, signCanvas,
} from "./textures";

/** The mirror's own drawing layer: only what the mirror should show. */
export const MIRROR_LAYER = 5;
/** The mirror's picture size per quality (none on Low). */
export const MIRROR_PX: Record<Quality3d, number> = { low: 0, medium: 256, high: 384 };

/** What a room needs from the home and the shell. */
export interface RoomInput {
  tier: HomeTier;
  rooms: RoomId[];
  kits: { home: Kit2; away: Kit2 };
  slots: CabinetSlot[];
  cars: { id: string; model: string; length: number }[];
  boots: BootChoice[];
  casual: CasualSet[];
  stuff?: HomeStuff;
  /** The motorbike's model (the garage), if you own one. */
  bikeModel?: string | null;
  /** Your club (its name on the cinema screen). */
  club?: string;
  /** Your club's badge as an SVG picture (on the cinema screen). */
  badge?: string;
}

export interface RoomEnv {
  THREE: any;
  mergeGeometries: (g: any[]) => any;
  Reflector: any;
  prof: { anisotropy: number };
  quality: Quality3d;
  envTex: any;
  /** The front door opens (a career or the test page goes to the garden). */
  doorOpen: boolean;
  /** A loaded model (cached by the shell: fetched once, cloned per room). */
  glb: (url: string) => Promise<any>;
  /** Clone a skinned model (SkeletonUtils.clone): the horse on the grounds. */
  cloneSkinned?: (o: any) => any;
}

export type Box2 = [number, number, number, number];

export interface BuiltRoom {
  id: RoomId;
  plan: RoomPlan;
  w2: number;
  d2: number;
  h: number;
  group: any;
  solids: Box2[];
  pickables: any[];
  doors: DoorPlan[];
  /** Which spot he is in, and the nearest point of its front. */
  zoneAt: (x: number, z: number) => { spot: HomeSpot; front: XZ } | null;
  /** Where a spot is stood at, and what he looks at there. */
  standFor: (s: HomeSpot, at: XZ) => { at: XZ; face: XZ };
  /** The camera's shot of a spot with its card open. */
  shotOf: (s: HomeSpot) => { cam: [number, number, number]; look: [number, number, number] };
  mirror: any | null;
  mirrorSpot: XZ | null;
  mirrorFace: XZ | null;
  /** The mirror should be live with him here. */
  mirrorNear: (x: number, z: number) => boolean;
  /** Take the mirror away (the quality stepped down to Low). */
  dropMirror: () => void;
  /** Where he starts if he arrives by no door. */
  start: { x: number; z: number; yaw: number };
  /** How the room's merging went (still pieces joined into one draw per material). */
  frozen: { before: number; after: number };
  /** Cars, boots, the bike: loaded after the room shows. */
  loadProps: () => Promise<void>;
  /** Free everything the room made. */
  dispose: () => void;
}

/** The helpers every room builds with, all hanging under `root`. */
function makeKit(env: RoomEnv, root: any, o: { oneGlowDraw?: boolean } = {}) {
  const { THREE } = env;
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o });
  const glowM = (c: string, i = 1.6) => new THREE.MeshStandardMaterial({ color: "#000000", emissive: c, emissiveIntensity: i });
  const tex = (cv: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = env.prof.anisotropy;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  const seen = (o: any) => { o.traverse((c: any) => c.layers.enable(MIRROR_LAYER)); return o; };
  const box = (w: number, h: number, d: number, m: any, x: number, y: number, z: number, o: { cast?: boolean; parent?: any } = {}) => {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    me.position.set(x, y, z);
    me.receiveShadow = true;
    me.castShadow = !!o.cast;
    (o.parent ?? root).add(me);
    return me;
  };
  const plane = (w: number, h: number, m: any, x: number, y: number, z: number, rx = 0, ry = 0) => {
    const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    me.position.set(x, y, z);
    me.rotation.set(rx, ry, 0);
    root.add(me);
    return me;
  };
  const glowT = tex(glowCanvas());
  const patchT = tex(patchCanvas());
  /** A painted light: an additive glow (costs one cheap draw, no light). */
  // the new rooms tint each glow in its shape's vertex colours, so every glow of a picture joins into one draw
  const glowParts = new Map<any, any[]>();
  const glow = (t: any, colour: string, k: number, w: number, h: number, x: number, y: number, z: number, rx: number, ry: number) => {
    if (o.oneGlowDraw) {
      const g = new THREE.PlaneGeometry(w, h);
      const c = new THREE.Color(colour).multiplyScalar(k);
      const n = g.attributes.position.count;
      const cols = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(1, 1, 1)));
      if (!glowParts.has(t)) glowParts.set(t, []);
      glowParts.get(t)!.push(g);
      return null;
    }
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
  const add = (o: any) => { root.add(o); return o; };
  /** The new rooms: join every glow of a picture into one mesh (kept out of freezeStatic, which drops vertex colours). */
  const flushGlows = (merge: (g: any[]) => any): any[] => {
    const out: any[] = [];
    glowParts.forEach((parts, t) => {
      const me = new THREE.Mesh(merge(parts), new THREE.MeshBasicMaterial({ map: t, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      for (const p of parts) p.dispose();
      me.renderOrder = 2;
      root.add(me);
      out.push(me);
    });
    glowParts.clear();
    return out;
  };
  return { THREE, root, add, flushGlows, mat, glowM, tex, seen, box, plane, glow, glowT, patchT, blob };
}
type Kit = ReturnType<typeof makeKit>;

/** An opening in a wall: its middle along the wall, its width, its bottom and top. */
type Hole = { c: number; w: number; y0: number; y1: number };

/**
 * One wall, with openings: `along` x or z, at `at`, from -len/2..len/2,
 * holes as { c (centre along), w, y0, y1 }. Pieces between and round the holes.
 */
function wallWith(k: Kit, H: number, along: "x" | "z", at: number, len: number, holes: Hole[], m: any, y0 = 0, y1 = H, thick = 0.12, inset = 0) {
  const out: any[] = [];
  const put = (a0: number, a1: number, b0: number, b1: number) => {
    if (a1 - a0 < 0.01 || b1 - b0 < 0.01) return;
    const c = (a0 + a1) / 2, l = a1 - a0, hy = b1 - b0;
    const me = along === "x" ? k.box(l, hy, thick, m, c, (b0 + b1) / 2, at + inset) : k.box(thick, hy, l, m, at + inset, (b0 + b1) / 2, c);
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
}

/** A window's or door's frame, and its glass. */
function frameWith(k: Kit, frameM: any, trimM: any, glassM: any) {
  return (along: "x" | "z", at: number, sgn: number, h: Hole, glass = true) => {
    const t = 0.07, dd = 0.16;
    const pc = (l: number, hh: number, a: number, y: number) => (along === "x" ? k.box(l, hh, dd, frameM, a, y, at + sgn * 0.0) : k.box(dd, hh, l, frameM, at, y, a));
    pc(h.w + t * 2, t, h.c, h.y1 + t / 2);
    pc(h.w + t * 2, t, h.c, h.y0 - t / 2);
    pc(t, h.y1 - h.y0, h.c - h.w / 2 - t / 2, (h.y0 + h.y1) / 2);
    pc(t, h.y1 - h.y0, h.c + h.w / 2 + t / 2, (h.y0 + h.y1) / 2);
    // a sill inside, a mullion in a wide window
    if (along === "x") k.box(h.w + 0.2, 0.04, 0.24, trimM, h.c, h.y0 - 0.02, at + sgn * 0.1);
    else k.box(0.24, 0.04, h.w + 0.2, trimM, at + sgn * 0.1, h.y0 - 0.02, h.c);
    if (h.w > 1.8) pc(0.05, h.y1 - h.y0, h.c, (h.y0 + h.y1) / 2);
    if (!glass) return;
    const g = along === "x" ? k.plane(h.w, h.y1 - h.y0, glassM, h.c, (h.y0 + h.y1) / 2, at) : k.plane(h.w, h.y1 - h.y0, glassM, at, (h.y0 + h.y1) / 2, h.c, 0, Math.PI / 2);
    g.renderOrder = 3;
  };
}

// ── The pieces the rooms share ───────────────────────────────────────────

/** The wardrobe's and mirror's places, along the west wall from its north end. */
function wardPlan(W2: number, D2: number, H: number, len: number) {
  const WARD = { z0: -D2 + 0.45, z1: -D2 + 0.45 + len, depth: 0.62, h: Math.min(2.25, H - 0.2) };
  const MIRROR = { z: WARD.z1 + 0.6, w: 0.74, h: 1.8, y: 0.12 };
  return { WARD, MIRROR, W2 };
}

/** The wardrobe (west wall), its garments, the full-length mirror, and the boots on its shelf. */
function wardrobeSet(k: Kit, env: RoomEnv, R: RoomPreset, inp: RoomInput, W2: number, H: number, metalM: any, P: ReturnType<typeof wardPlan>) {
  const { THREE } = k;
  const { WARD, MIRROR } = P;
  const solids: Box2[] = [];
  const lacquer = R.tier === "estate" || R.tier === "villa" ? k.mat("#4a2e1c", { roughness: 0.45 }) : R.tier === "penthouse" ? k.mat("#2a2a2e", { roughness: 0.4 }) : k.mat("#ece7de", { roughness: 0.55 });
  const innerM = k.mat(R.tier === "estate" || R.tier === "villa" ? "#6b4a32" : "#f4efe6", { roughness: 0.7 });
  const wx = -W2 + WARD.depth / 2, wl = WARD.z1 - WARD.z0, wzc = (WARD.z0 + WARD.z1) / 2;
  k.box(0.03, WARD.h, wl, innerM, -W2 + 0.03, WARD.h / 2, wzc); // back
  k.box(WARD.depth, 0.05, wl + 0.06, lacquer, wx, WARD.h, wzc, { cast: true }); // top
  k.box(WARD.depth, 0.06, wl + 0.06, lacquer, wx, 0.03, wzc); // floor
  for (const z of [WARD.z0, WARD.z1]) k.box(WARD.depth, WARD.h, 0.04, lacquer, wx, WARD.h / 2, z, { cast: true }); // ends
  k.box(WARD.depth - 0.04, 0.03, wl - 0.04, lacquer, wx, 0.36, wzc); // the boot shelf
  const railY = WARD.h - 0.22;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, wl - 0.06, 10), metalM);
  rail.rotation.x = Math.PI / 2; rail.position.set(-W2 + 0.32, railY, wzc); k.add(rail);
  // a warm strip of light under the top (painted)
  k.box(0.03, 0.02, wl - 0.1, k.glowM("#ffd9a0", 2.0), -W2 + 0.45, WARD.h - 0.05, wzc);
  k.glow(k.glowT, "#ffcf8a", 0.16, wl * 1.1, 1.8, -W2 + 0.06, WARD.h - 0.8, wzc, 0, Math.PI / 2);
  solids.push([-W2, -W2 + WARD.depth + 0.02, WARD.z0 - 0.04, WARD.z1 + 0.04]);

  /** The garments on the rail: one mesh, painted by vertex colour (each casual set, then the two kits). */
  const garments = (() => {
    const items: { top: string; low: string; kit: boolean }[] = [
      ...inp.casual.map((s) => { const [a, b] = s.swatch(inp.kits.home); return { top: a, low: b, kit: false }; }),
      { top: inp.kits.home.shirt, low: inp.kits.home.trim, kit: true },
      { top: inp.kits.away.shirt, low: inp.kits.away.trim, kit: true },
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
    const merged = env.mergeGeometries(parts);
    for (const p of parts) p.dispose();
    const me = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }));
    me.castShadow = true; me.receiveShadow = true;
    k.add(me);
    return me;
  })();

  // ── The mirror (full length, beside the wardrobe) ──
  const mx = -W2 + 0.035;
  const mFrameM = metalM;
  k.box(0.04, MIRROR.h + 0.1, 0.06, mFrameM, mx, MIRROR.y + MIRROR.h / 2, MIRROR.z - MIRROR.w / 2 - 0.02);
  k.box(0.04, MIRROR.h + 0.1, 0.06, mFrameM, mx, MIRROR.y + MIRROR.h / 2, MIRROR.z + MIRROR.w / 2 + 0.02);
  k.box(0.04, 0.06, MIRROR.w + 0.1, mFrameM, mx, MIRROR.y + MIRROR.h + 0.02, MIRROR.z);
  k.box(0.04, 0.06, MIRROR.w + 0.1, mFrameM, mx, MIRROR.y - 0.02, MIRROR.z);
  // behind the live mirror: dark glass (what you see from far off, and on Low)
  k.plane(MIRROR.w, MIRROR.h, k.mat("#3a4048", { roughness: 0.08, metalness: 0.9, envMapIntensity: 1.2 }), mx - 0.004, MIRROR.y + MIRROR.h / 2, MIRROR.z, 0, Math.PI / 2);
  const makeMirror = () => {
    const px = MIRROR_PX[env.quality];
    if (!px) return null;
    const m = new env.Reflector(new THREE.PlaneGeometry(MIRROR.w, MIRROR.h), { textureWidth: px, textureHeight: Math.round((px * MIRROR.h) / MIRROR.w), color: 0xd8dde2, clipBias: 0.003 });
    m.position.set(mx + 0.002, MIRROR.y + MIRROR.h / 2, MIRROR.z);
    m.rotation.y = Math.PI / 2;
    // the mirror draws only its own layer: you, the floor, the far walls and the drive
    m.camera.layers.set(MIRROR_LAYER);
    m.visible = false;
    k.add(m);
    return m;
  };
  const mirror = makeMirror();
  solids.push([-W2, -W2 + 0.12, MIRROR.z - MIRROR.w / 2 - 0.05, MIRROR.z + MIRROR.w / 2 + 0.05]);

  /** The boots on the shelf (loaded after the room shows). */
  const loadBoots = (props: any, fitLen: (root: any, len: number, alongZ: boolean) => void, alive: () => boolean) => inp.boots.slice(0, 2).map((b, i) => {
    if (!b.model) return Promise.resolve();
    return env.glb(b.model).then((g: any) => {
      if (!alive()) return;
      const src = g.scene.clone(true);
      for (const side of [-1, 1]) {
        const root = side < 0 ? src : src.clone(true);
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
    }).catch((e: unknown) => console.error("home: boot", b.model, e));
  });

  const wardH = WARD.h;
  return { WARD, MIRROR, garments, mirror, makeMirror, solids, loadBoots, wx, wardH, mirrorSpot: [-W2 + 1.05, MIRROR.z] as XZ, mirrorFace: [-W2, MIRROR.z] as XZ };
}

/** The trophy cabinet's places, on the north wall. */
function cabPlan(R: { cabinet: { cols: number; rows: number } }, D2: number) {
  const CAB = { cols: R.cabinet.cols, rows: R.cabinet.rows, cw: 0.6, rh: 0.42, base: 0.5, depth: 0.42 };
  const cabW = CAB.cols * CAB.cw + 0.2;
  const cabH = CAB.base + CAB.rows * CAB.rh + 0.12;
  const cabZ = -D2 + CAB.depth / 2 + 0.02;
  return { CAB, cabW, cabH, cabZ, D2 };
}

/** The trophy cabinet on the north wall and its trophies (your real ones). */
function cabinetSet(k: Kit, env: RoomEnv, R: RoomPreset, slots: CabinetSlot[], glassM: any, C: ReturnType<typeof cabPlan>) {
  const { THREE } = k;
  const { CAB, cabW, cabH, cabZ, D2 } = C;
  const root = k.root;
  const solids: Box2[] = [];
  const cabWoodM = R.tier === "estate" || R.tier === "villa" ? k.mat("#3b2416", { roughness: 0.4 }) : R.tier === "penthouse" ? k.mat("#1c1c20", { roughness: 0.35 }) : k.mat("#5a4030", { roughness: 0.5 });
  k.box(cabW, CAB.base, CAB.depth, cabWoodM, 0, CAB.base / 2, cabZ, { cast: true }); // the cupboard under it
  k.box(cabW + 0.06, 0.05, CAB.depth + 0.04, cabWoodM, 0, cabH, cabZ, { cast: true }); // the top
  k.box(cabW, cabH - CAB.base, 0.03, k.mat("#2a1d14", { roughness: 0.6, emissive: "#3a2410", emissiveIntensity: 0.5 }), 0, (CAB.base + cabH) / 2, -D2 + 0.035); // a warm-lit back
  for (const sx of [-1, 1]) k.box(0.05, cabH - CAB.base, CAB.depth, cabWoodM, sx * (cabW / 2 - 0.025), (CAB.base + cabH) / 2, cabZ, { cast: true });
  for (let c = 1; c < CAB.cols; c++) k.box(0.025, cabH - CAB.base - 0.02, CAB.depth - 0.04, cabWoodM, -cabW / 2 + 0.1 + c * CAB.cw, (CAB.base + cabH) / 2, cabZ);
  const shelfM = new THREE.MeshStandardMaterial({ color: "#dfe8ee", transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 });
  for (let r = 1; r < CAB.rows; r++) k.box(cabW - 0.1, 0.02, CAB.depth - 0.05, shelfM, 0, CAB.base + r * CAB.rh, cabZ);
  // each shelf's light: a strip under the shelf above (emissive) and a painted wash on the back
  for (let r = 0; r < CAB.rows; r++) {
    const y = CAB.base + (r + 1) * CAB.rh - 0.02;
    k.box(cabW - 0.14, 0.012, 0.02, k.glowM("#fff1d6", 2.4), 0, y - 0.01, cabZ + CAB.depth / 2 - 0.06);
  }
  k.glow(k.glowT, "#ffe0a8", 0.22, cabW * 1.05, (cabH - CAB.base) * 1.15, 0, (CAB.base + cabH) / 2, -D2 + 0.06, 0, 0);
  const cabGlass = k.plane(cabW - 0.08, cabH - CAB.base, glassM, 0, (CAB.base + cabH) / 2, cabZ + CAB.depth / 2 + 0.005);
  cabGlass.renderOrder = 3;
  solids.push([-cabW / 2 - 0.05, cabW / 2 + 0.05, -D2, -D2 + CAB.depth + 0.06]);

  /** The trophies: gold in one mesh, silver in one, the not-yet-won as faint shapes in one; the plates in one. */
  const gold: any[] = [], silver: any[] = [], ghost: any[] = [], plates: any[] = [];
  const { canvas: platesCv, rows } = platesCanvas(slots.map((s) => ({ name: s.name, count: s.count, won: s.won })));
  slots.slice(0, CAB.cols * CAB.rows).forEach((s, i) => {
    const col = i % CAB.cols, row = CAB.rows - 1 - Math.floor(i / CAB.cols); // the best on the top shelf
    const x = -cabW / 2 + 0.1 + (col + 0.5) * CAB.cw;
    const y = CAB.base + row * CAB.rh + (row > 0 ? 0.012 : 0);
    const z = cabZ - 0.02;
    const big = s.name === "Ballon d'Or" || s.name === "World Cup" || s.name === "Champions League" ? 1.12 : 1;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(big, big, big));
    for (const g of trophyGeo(THREE, s.shape)) {
      g.applyMatrix4(m);
      (s.won ? (s.metal === "gold" ? gold : silver) : ghost).push(cleanGeo(g));
    }
    // its name plate on the shelf's front edge (a slice of the plates picture)
    const pg = new THREE.PlaneGeometry(CAB.cw - 0.08, (CAB.cw - 0.08) * (96 / 512));
    const uv = pg.attributes.uv;
    for (let q = 0; q < uv.count; q++) uv.setY(q, 1 - (i + 1 - uv.getY(q)) / rows);
    pg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.035, cabZ + CAB.depth / 2 - 0.05), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0)), new THREE.Vector3(1, 1, 1)));
    plates.push(pg);
  });
  const meshOf = (list: any[], m: any) => {
    if (!list.length) return null;
    const me = new THREE.Mesh(env.mergeGeometries(list), m);
    for (const g of list) g.dispose();
    me.castShadow = false;
    root.add(me);
    return me;
  };
  const goldM = k.mat("#e2b44a", { roughness: 0.22, metalness: 1, envMapIntensity: 1.6 });
  const silverM = k.mat("#d9dde2", { roughness: 0.2, metalness: 1, envMapIntensity: 1.6 });
  const ghostM = new THREE.MeshBasicMaterial({ color: "#fff4dc", transparent: true, opacity: 0.1, depthWrite: false });
  const plateT = k.tex(platesCv);
  const plateM = new THREE.MeshStandardMaterial({ map: plateT, roughness: 0.4, metalness: 0.3 });
  const trophies = {
    gold: meshOf(gold, goldM), silver: meshOf(silver, silverM), ghost: meshOf(ghost, ghostM),
    plates: (() => { const me = new THREE.Mesh(env.mergeGeometries(plates), plateM); for (const g of plates) g.dispose(); root.add(me); return me; })(),
  };
  return { solids, trophies, goldM, silverM, ghostM };
}

function cleanGeo(geo: any) {
  const g2 = geo.index ? geo.toNonIndexed() : geo;
  if (g2 !== geo) geo.dispose();
  for (const k of Object.keys(g2.attributes)) if (k !== "position" && k !== "normal") g2.deleteAttribute(k);
  g2.clearGroups();
  return g2;
}

/** A trophy's shape, made in code (no real trophy's shape). */
export function trophyGeo(THREE: any, shape: TrophyShape): any[] {
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

/** Fit a loaded model to a length, standing on the floor at (0, 0). */
function fitLenWith(THREE: any) {
  return (root: any, len: number, alongZ: boolean) => {
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
}

/** The drive outside an east window: the ground, the backdrop across it, the kerb. Cars come later. */
function driveSet(k: Kit, R: RoomPreset, W2: number) {
  const { THREE } = k;
  const driveT = k.tex(driveCanvas(R.drive), [6, 8]);
  const driveG = k.plane(12, 18, k.mat("#ffffff", { map: driveT, roughness: 0.95 }), W2 + 6, -0.02, 0, -Math.PI / 2);
  driveG.receiveShadow = true;
  k.seen(driveG);
  const driveBack = k.plane(22, 8, new THREE.MeshBasicMaterial({ map: k.tex(driveBackCanvas(R.drive)), fog: false }), W2 + 9.5, 3.4, 0, 0, -Math.PI / 2);
  k.seen(driveBack);
  if (R.drive === "street") { k.box(0.25, 0.14, 18, k.mat("#a9adb1", { roughness: 0.9 }), W2 + 1.2, 0.05, 0); }
  return [driveG, driveBack];
}

/** Your cars on the drive (best first), loaded after the room shows. */
function loadCars(env: RoomEnv, cars: RoomInput["cars"], n: number, place: (i: number, n: number, len: number) => [number, number, number], props: any, fitLen: ReturnType<typeof fitLenWith>, alive: () => boolean, seen: (o: any) => any) {
  const { THREE } = env;
  return cars.slice(0, n).map((car, i) => env.glb(car.model).then((g: any) => {
    if (!alive()) return;
    const holder = new THREE.Group();
    const root = g.scene.clone(true);
    root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material.envMap = env.envTex; o.material.envMapIntensity = 1; } } });
    fitLen(root, car.length, false); // nose towards the house
    holder.add(root);
    const [x, z, ry] = place(i, Math.min(n, cars.length), car.length);
    holder.position.set(x, 0, z);
    holder.rotation.y = ry;
    props.add(seen(holder));
  }).catch((e: unknown) => console.error("home: car", car.model, e)));
}

/** Free everything under a room's group: shapes, materials, their pictures, the mirror's picture. */
export function disposeGroup(group: any) {
  group.parent?.remove(group);
  const tex = new Set<any>();
  group.traverse((o: any) => {
    if (!o.isSkinnedMesh) o.geometry?.dispose?.();
    const m = o.material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) {
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap", "lightMap", "bumpMap"]) if (x[k]) tex.add(x[k]);
      if (x.uniforms?.tDiffuse?.value) tex.add(x.uniforms.tDiffuse.value);
      x.dispose?.();
    }
    if (o.isReflector || o.getRenderTarget) o.dispose?.();
  });
  tex.forEach((t) => t.dispose?.());
}

/** A spot he can stand on (the walk grid): inside the walls, clear of every piece of furniture. */
export function roomFree(room: Pick<BuiltRoom, "w2" | "d2" | "solids">, x: number, z: number): boolean {
  const r = 0.36;
  if (Math.abs(x) > room.w2 - r || z < -room.d2 + r || z > room.d2 - r) return false;
  for (const [x0, x1, z0, z1] of room.solids) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return false;
  return true;
}

// ── The rooms ────────────────────────────────────────────────────────────

/** Build one room of a home. Everything it makes hangs under `group`. */
export function buildRoom(env: RoomEnv, inp: RoomInput, id: RoomId): BuiltRoom {
  if (id === "main") return buildMain(env, inp);
  return buildNew(env, inp, id);
}

/** The one-room home, exactly as it was before rooms (the Old look, the starter flat and the flat). */
function buildMain(env: RoomEnv, inp: RoomInput): BuiltRoom {
  const { THREE } = env;
  const R = roomPreset(inp.tier);
  const W2 = R.w / 2, D2 = R.d / 2, H = R.h;
  const group = new THREE.Group();
  group.name = "room-main";
  const k = makeKit(env, group);
  const { mat, glowM, tex, seen, box, plane, glow, glowT, patchT, blob } = k;
  const plan = roomPlan(inp.tier, "main", inp.rooms.includes("main") ? inp.rooms : ["main"]);
  let alive = true;

  // ── The plan (metres; north is -z) ──
  const T_WALL = 0.12;
  const WP = wardPlan(W2, D2, H, R.wardrobe);
  const { WARD, MIRROR } = WP;
  const CP = cabPlan(R, D2);
  const { CAB, cabW, cabH, cabZ } = CP;
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
  const wall = (along: "x" | "z", at: number, len: number, holes: Hole[], m: any, y0 = 0, y1 = H, thick = T_WALL, inset = 0) => wallWith(k, H, along, at, len, holes, m, y0, y1, thick, inset);
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
  plane(R.w, R.d, mat(R.trim, { roughness: 0.95 }), 0, H, 0, Math.PI / 2);
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
  const winFrame = frameWith(k, frameM, trimM, glassM);
  for (const h of backHoles) winFrame("x", -D2, 1, h);
  winFrame("z", W2, -1, eastHoles[0]);
  // the back windows' view: one painted plane outside
  const viewM = new THREE.MeshBasicMaterial({ map: tex(viewCanvas(R.view)), fog: false });
  plane(R.w + 7, 7.5, viewM, 0, 2.1, -D2 - 3.4);
  // the drive: ground, the backdrop across it, the cars (loaded below)
  driveSet(k, R, W2);
  // the door out to the garden: a bright garden beyond it, a sign over it
  // (the flat on the New look: the door leads to its hallway nook, a lit wall beyond)
  const toNook = plan.doors[0]?.to === "nook";
  const doorView = toNook
    ? new THREE.MeshBasicMaterial({ map: tex(wallCanvas(R.wall)), color: new THREE.Color("#e6d8c2"), fog: false })
    : new THREE.MeshBasicMaterial({ map: tex(viewCanvas("garden")), fog: false });
  plane(toNook ? 2.6 : 5, toNook ? 2.6 : 4, doorView, 0, toNook ? 1.3 : 1.6, D2 + (toNook ? 1.6 : 2.2), 0, Math.PI);
  winFrame("x", D2, -1, { c: 0, w: DOOR.half * 2, y0: 0.0001, y1: DOOR.h }, false);
  const signM = new THREE.MeshBasicMaterial({ map: tex(signCanvas(toNook ? "HALLWAY" : env.doorOpen ? "GARDEN" : "HOME")), transparent: true });
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
    group.add(d);
  }
  if (R.chandelier) chandelier(k, metalM, H, 0, 0.3);

  // ── Furniture: a sofa and table by the door, a rug, a floor lamp, plants ──
  const fabricM = mat(R.tier === "estate" ? "#5b2a2a" : R.tier === "villa" ? "#e8e0d0" : R.tier === "penthouse" ? "#3a3d44" : "#6d7b8a", { roughness: 0.95 });
  const woodM = mat(R.tier === "estate" || R.tier === "villa" ? "#4a2e1c" : R.tier === "penthouse" ? "#1e1e22" : "#d8d0c2", { roughness: 0.55 });
  const sofaL = Math.max(0, SOFA.x1 - SOFA.x0);
  const solids: Box2[] = [];
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
  solids.push(floorLamp(k, metalM, lampX, lampZ, [[lampX + 0.6, 1.5, D2 - 0.02, 0, Math.PI], [-W2 + 0.02, 1.5, lampZ - 0.5, 0, Math.PI / 2]]));
  // plants: corners left free by the cabinet and windows
  const potM = mat(R.metal, { roughness: 0.4, metalness: 0.6 });
  const leafM = mat("#2f5a35", { flatShading: true, roughness: 0.85 });
  const plantAt = [[W2 - 0.4, D2 - 0.4], [W2 - 0.4, -D2 + 0.4], [-W2 + 0.4, MIRROR.z + 0.9], [cabW / 2 + 0.25, -D2 + 0.35]].slice(0, R.plants)
    .filter(([x, z]) => !(x > SOFA.x0 - 0.3 && x < SOFA.x1 + 0.3 && z > SOFA.z - 0.6) && z < D2 - 0.2 && Math.abs(x) < W2);
  for (const [x, z] of plantAt) solids.push(plant(k, potM, leafM, x, z));

  // ── The wardrobe (west wall) and the mirror ──
  const ward = wardrobeSet(k, env, R, inp, W2, H, metalM, WP);
  solids.push(...ward.solids);

  // ── The trophy cabinet (back wall) ──
  const cab = cabinetSet(k, env, R, inp.slots, glassM, CP);
  solids.push(...cab.solids);

  // ── Pick volumes (invisible boxes a tap can hit) ──
  const pickables: any[] = [];
  const pickBox = pickWith(k, pickables);
  pickBox("wardrobe", WARD.depth + 0.1, WARD.h, MIRROR.z + MIRROR.w / 2 - WARD.z0 + 0.1, ward.wx, WARD.h / 2, (WARD.z0 + MIRROR.z + MIRROR.w / 2) / 2);
  pickBox("cabinet", cabW, cabH, CAB.depth + 0.1, 0, cabH / 2, cabZ);
  pickBox("drive", 0.4, DRIVE.y1 - DRIVE.y0, DRIVE.w, W2, (DRIVE.y0 + DRIVE.y1) / 2, DRIVE.z);

  // ── Your cars on the drive, your boots on the shelf (loaded after the room shows) ──
  const props = new THREE.Group();
  group.add(props);
  const fitLen = fitLenWith(THREE);
  let mirror = ward.mirror;
  const keep = new Set<any>([props, ward.garments, cab.trophies.gold, cab.trophies.silver, cab.trophies.ghost, cab.trophies.plates, ...pickables, mirror].filter(Boolean));
  const frozen = freezeStatic(THREE, env.mergeGeometries, group, keep);

  const built: BuiltRoom = {
    id: "main", plan, w2: W2, d2: D2, h: H, group, solids, pickables,
    doors: plan.doors.filter((d) => d.to !== "garden" || env.doorOpen),
    zoneAt: (x, z) => {
      if (x < -W2 + 1.75 && z > WARD.z0 - 0.3 && z < MIRROR.z + 0.8) return { spot: "wardrobe", front: [-W2 + WARD.depth, Math.max(WARD.z0, Math.min(MIRROR.z, z))] };
      if (z < -D2 + CAB.depth + 1.5 && Math.abs(x) < cabW / 2 + 0.35) return { spot: "cabinet", front: [Math.max(-cabW / 2, Math.min(cabW / 2, x)), -D2 + CAB.depth] };
      if (x > W2 - 1.6 && Math.abs(z - DRIVE.z) < DRIVE.w / 2 + 0.3) return { spot: "drive", front: [W2, Math.max(DRIVE.z - DRIVE.w / 2, Math.min(DRIVE.z + DRIVE.w / 2, z))] };
      return null;
    },
    standFor: (s, p) => {
      if (s === "wardrobe") return { at: ward.mirrorSpot, face: ward.mirrorFace };
      if (s === "cabinet") return { at: [Math.max(-cabW / 2 + 0.3, Math.min(cabW / 2 - 0.3, p[0] * 0.5)), -D2 + CAB.depth + 0.95], face: [0, -D2] };
      return { at: [W2 - 0.95, DRIVE.z], face: [W2 + 3, DRIVE.z] };
    },
    shotOf: (s) => {
      // stood back and to one side, so you see him and, beside him, him in the mirror
      // (the line from the camera to his reflection crosses the glass ~0.25 m off its middle, and misses him)
      if (s === "wardrobe") return { cam: [Math.min(W2 - 0.35, -W2 + 3.4), 1.55, Math.min(D2 - 0.35, MIRROR.z + 1.0)], look: [-W2 + 0.3, 1.1, MIRROR.z + 0.15] };
      if (s === "cabinet") return { cam: [0.35, 1.5, Math.min(D2 - 0.35, -D2 + CAB.depth + 2.2)], look: [0, CAB.base + (cabH - CAB.base) * 0.55, -D2] };
      return { cam: [W2 - 2.1, 1.65, DRIVE.z + 0.9], look: [W2 + 4, 0.7, DRIVE.z - 0.3] };
    },
    get mirror() { return mirror; },
    mirrorSpot: ward.mirrorSpot,
    mirrorFace: ward.mirrorFace,
    mirrorNear: (x, z) => x < -W2 + 3.2 && Math.abs(z - MIRROR.z) < 3.2,
    dropMirror: () => { if (mirror) { group.remove(mirror); mirror.dispose?.(); mirror = null; } },
    start: { x: 0, z: Math.max(0, D2 - 2.5), yaw: Math.PI },
    frozen,
    loadProps: async () => {
      const jobs: Promise<void>[] = [];
      const n = Math.min(R.cars, inp.cars.length);
      const span = 2.7;
      jobs.push(...loadCars(env, inp.cars, n, (i, nn, len) => [W2 + 2.2 + len / 2, DRIVE.z + (i - (nn - 1) / 2) * span, Math.PI], props, fitLen, () => alive, seen));
      jobs.push(...ward.loadBoots(props, fitLen, () => alive));
      await Promise.all(jobs);
    },
    dispose: () => { alive = false; disposeGroup(group); mirror = null; },
  } as BuiltRoom;
  return built;
}

/** A pick volume (an invisible box a tap can hit). */
function pickWith(k: Kit, pickables: any[]) {
  return (spot: HomeSpot, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const me = new k.THREE.Mesh(new k.THREE.BoxGeometry(w, h, d), new k.THREE.MeshBasicMaterial());
    me.visible = false;
    me.position.set(x, y, z);
    me.userData.spot = spot;
    k.add(me);
    pickables.push(me);
  };
}

/** A chandelier: a brass ring of glowing crystals (no real light) and its glow on the ceiling. */
function chandelier(k: Kit, metalM: any, H: number, x: number, z: number) {
  const { THREE } = k;
  k.box(0.02, 0.6, 0.02, metalM, x, H - 0.3, z);
  const root = k.root;
  const cy = H - 0.75;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 8, 32), metalM);
  ring.rotation.x = Math.PI / 2; ring.position.set(x, cy, z); root.add(ring);
  const crystalG = new THREE.OctahedronGeometry(0.06, 0);
  const crystalM = k.glowM("#fff6e0", 2.4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const c = new THREE.Mesh(crystalG, crystalM);
    c.position.set(x + Math.cos(a) * 0.42, cy - 0.12, z + Math.sin(a) * 0.42);
    c.scale.set(0.7, 1.4, 0.7);
    root.add(c);
  }
  k.glow(k.glowT, "#ffe2b0", 0.18, 2.6, 2.6, x, H - 0.02, z, Math.PI / 2, 0);
}

/** A floor lamp and the pools of light it paints on the walls near it. Its footprint. */
function floorLamp(k: Kit, metalM: any, x: number, z: number, pools: [number, number, number, number, number][]): Box2 {
  const { THREE } = k;
  k.box(0.3, 0.03, 0.3, metalM, x, 0.015, z);
  const pole = k.box(0.03, 1.45, 0.03, metalM, x, 0.75, z);
  const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.26, 18, 1, true), k.glowM("#ffd9a0", 1.3));
  shadeMesh.position.set(x, 1.55, z);
  k.add(shadeMesh);
  void pole;
  pools.forEach(([px, py, pz, rx, ry], i) => k.glow(k.glowT, "#ffcf8a", i === 0 ? 0.28 : 0.22, 1.6, 2.2, px, py, pz, rx, ry));
  return [x - 0.2, x + 0.2, z - 0.2, z + 0.2];
}

/** A potted plant. Its footprint. */
function plant(k: Kit, potM: any, leafM: any, x: number, z: number): Box2 {
  const { THREE } = k;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 16), potM);
  const root = k.root;
  pot.position.set(x, 0.21, z); pot.castShadow = true; root.add(pot);
  const lv = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), leafM);
  lv.position.set(x, 0.85, z); lv.scale.set(1, 1.4, 1); lv.castShadow = true; root.add(lv);
  k.blob(0.8, 0.8, x, z);
  return [x - 0.25, x + 0.25, z - 0.25, z + 0.25];
}

// ── The new rooms (House: New) ───────────────────────────────────────────

/** A window in a new room: which wall, its middle along it, its width, and what is outside. */
interface WinSpec { wall: Wall; c: number; w: number; y0: number; y1: number; view?: WindowView | "drive" | null }

/** Wall → its line, its length and which way is in. */
function wallLine(wall: Wall, W2: number, D2: number) {
  const T = 0.12;
  if (wall === "n") return { along: "x" as const, at: -D2, out: -D2 - T / 2, len: W2 * 2, sgn: 1 };
  if (wall === "s") return { along: "x" as const, at: D2, out: D2 + T / 2, len: W2 * 2, sgn: -1 };
  if (wall === "w") return { along: "z" as const, at: -W2, out: -W2 - T / 2, len: D2 * 2, sgn: 1 };
  return { along: "z" as const, at: W2, out: W2 + T / 2, len: D2 * 2, sgn: -1 };
}

/** Each room's own colours over the home's preset. */
const ROOM_LOOK: Partial<Record<RoomId, { wall?: string; floor?: RoomPreset["floor"]; panelled?: boolean; dark?: boolean; rough?: number }>> = {
  hallway: {},
  trophy: { wall: "#2c3442", dark: true },
  cinema: { wall: "#2a2026", floor: "carpet", dark: true },
  games: { wall: "#3a4a3e" },
  gym: { wall: "#d9dcdf", floor: "boards" },
  // a polished floor: the cars stand in its shine
  garage: { wall: "#bfc3c6", floor: "stone", rough: 0.14 },
  terrace: { floor: "boards" },
  gardenTerrace: { floor: "stone" },
};

/**
 * The shell of a new room: floor, walls with its doorways and windows, the
 * ceiling, skirting, cornice, panelling on the grand tiers, frames and glass,
 * what is beyond each doorway (the garden, or the next room's sign).
 */
function shellOf(k: Kit, env: RoomEnv, R: RoomPreset, plan: RoomPlan, wins: WinSpec[], o: { ceiling?: boolean; open?: Wall[]; parapet?: { h: number; from: number; glass?: boolean } } = {}) {
  const { THREE } = k;
  const W2 = plan.w / 2, D2 = plan.d / 2, H = plan.h;
  const look = ROOM_LOOK[plan.id] ?? {};
  const floorKind = look.floor ?? R.floor;
  const tile = floorKind === "marble" || floorKind === "stone" ? 2.2 : 1.6;
  const floorM = k.mat("#ffffff", { map: k.tex(floorCanvas(floorKind), [plan.w / tile, plan.d / tile]), roughness: look.rough ?? (floorKind === "carpet" ? 0.95 : floorKind === "marble" ? 0.18 : floorKind === "stone" ? 0.5 : 0.42), envMapIntensity: look.rough !== undefined && look.rough < 0.3 ? 1.6 : 1 });
  const floor = k.plane(plan.w, plan.d, floorM, 0, 0, 0, -Math.PI / 2);
  floor.receiveShadow = true;
  k.seen(floor);
  const fshade = k.plane(plan.w, plan.d, new THREE.MeshBasicMaterial({ map: k.tex(floorShadeCanvas()), transparent: true, depthWrite: false }), 0, 0.004, 0, -Math.PI / 2);
  fshade.renderOrder = 1;
  k.seen(fshade);
  const wallM = k.mat("#ffffff", { map: k.tex(wallCanvas(look.wall ?? R.wall)), roughness: 0.92 });
  const panelM = k.mat(R.panel, { roughness: R.tier === "estate" ? 0.45 : 0.7 });
  const trimM = k.mat(look.dark ? "#1c1814" : R.trim, { roughness: 0.5 });
  const metalM = k.mat(R.metal, { roughness: 0.32, metalness: 0.85 });
  const frameM = k.mat(R.tier === "penthouse" ? "#2b2b2e" : look.dark ? "#1c1814" : R.trim, { roughness: 0.45 });
  const glassM = new THREE.MeshStandardMaterial({ color: "#cfe3f4", transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.2, depthWrite: false });
  const winFrame = frameWith(k, frameM, trimM, glassM);
  const DOOR_H = 2.15;
  const holes: Record<Wall, Hole[]> = { n: [], s: [], e: [], w: [] };
  for (const d of plan.doors) holes[d.wall].push({ c: d.wall === "n" || d.wall === "s" ? d.x : d.z, w: d.half * 2, y0: 0, y1: DOOR_H });
  for (const w of wins) holes[w.wall].push({ c: w.c, w: w.w, y0: w.y0, y1: w.y1 });
  const open = new Set(o.open ?? []);
  const par = o.parapet ?? { h: 0.95, from: 0 };
  // an open side (a terrace): a parapet (stone, or glass on a metal rail) instead of a wall
  const glassRailM = par.glass ? new THREE.MeshStandardMaterial({ color: "#d8ecf6", transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.3, depthWrite: false }) : null;
  for (const wl of Array.from(open)) {
    const L = wallLine(wl, W2, D2);
    const len = L.along === "x" ? L.len + 0.24 : L.len;
    if (glassRailM) {
      for (const p of wallWith(k, H, L.along, L.out, len, [], glassRailM, par.from, par.h, 0.03)) p.renderOrder = 3;
      wallWith(k, H, L.along, L.out, len, [], metalM, par.h, par.h + 0.05, 0.07); // the top rail
      wallWith(k, H, L.along, L.out, len, [], trimM, par.from, 0.06, 0.16); // the kerb
    } else {
      wallWith(k, H, L.along, L.out, len, [], wallM, par.from, par.h, 0.24);
      wallWith(k, H, L.along, L.out, len + 0.12, [], trimM, par.h, par.h + 0.07, 0.34); // the coping
    }
  }
  for (const wl of ["n", "s", "e", "w"] as Wall[]) {
    if (open.has(wl)) continue;
    const L = wallLine(wl, W2, D2);
    const len = L.along === "x" ? L.len + 0.24 : L.len;
    const pieces = wallWith(k, H, L.along, L.out, len, holes[wl], wallM);
    if (wl !== "w") for (const p of pieces) k.seen(p); // the mirror (west wall) sees the far walls
    wallWith(k, H, L.along, L.at, L.len, holes[wl], trimM, 0, 0.11, 0.025, L.sgn * 0.02); // skirting
    wallWith(k, H, L.along, L.at, L.len, [], trimM, H - 0.09, H, 0.06, L.sgn * 0.035); // cornice
    if (R.panelled && !look.dark) {
      wallWith(k, H, L.along, L.at, L.len, holes[wl], panelM, 0, 1.0, 0.03, L.sgn * 0.03);
      wallWith(k, H, L.along, L.at, L.len, holes[wl].map((h) => ({ ...h, y0: Math.min(h.y0, 1.04) })), trimM, 1.0, 1.04, 0.05, L.sgn * 0.045);
    }
  }
  if (o.ceiling !== false) k.plane(plan.w, plan.d, k.mat(look.dark ? "#191512" : R.trim, { roughness: 0.95 }), 0, H, 0, Math.PI / 2);
  // windows: frame, glass, the view outside (one painted plane per wall)
  const views = new Map<string, any>();
  for (const w of wins) {
    const L = wallLine(w.wall, W2, D2);
    winFrame(L.along, L.at, L.sgn, { c: w.c, w: w.w, y0: w.y0, y1: w.y1 });
    if (!w.view || w.view === "drive") continue;
    if (!views.has(w.view)) views.set(w.view, new THREE.MeshBasicMaterial({ map: k.tex(viewCanvas(w.view)), fog: false }));
    const vm = views.get(w.view);
    const dist = 3.4;
    if (L.along === "x") k.plane(Math.max(6, w.w * 3), 7.5, vm, w.c, 2.1, L.at - L.sgn * dist, 0, L.sgn > 0 ? 0 : Math.PI);
    else k.plane(Math.max(6, w.w * 3), 7.5, vm, L.at - L.sgn * dist, 2.1, w.c, 0, L.sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
    // the sun's patch on the floor under it
    const px = L.along === "x" ? w.c : L.at + L.sgn * 0.75, pz = L.along === "x" ? L.at + L.sgn * 0.75 : w.c;
    k.glow(k.patchT, "#ffe6c0", 0.14, L.along === "x" ? w.w * 0.9 : 1.2, L.along === "x" ? 1.2 : w.w * 0.9, px, 0.007, pz, -Math.PI / 2, 0);
  }
  // doorways: a frame, what is beyond, a sign over it (every sign on one picture, one draw)
  let gardenM: any = null;
  const beyondM = new Map<string, any>();
  const signTexts = plan.doors.map((d) => (d.to === "garden" ? (env.doorOpen ? "GARDEN" : "HOME") : ROOM_LABEL[d.to].toUpperCase()));
  const signAtlas = document.createElement("canvas");
  signAtlas.width = 512; signAtlas.height = 128 * Math.max(1, signTexts.length);
  const sctx = signAtlas.getContext("2d");
  signTexts.forEach((t, i) => sctx?.drawImage(signCanvas(t), 0, i * 128));
  const signM = new THREE.MeshBasicMaterial({ map: k.tex(signAtlas), transparent: true });
  plan.doors.forEach((d, di) => {
    const L = wallLine(d.wall, W2, D2);
    const c = L.along === "x" ? d.x : d.z;
    winFrame(L.along, L.at, L.sgn, { c, w: d.half * 2, y0: 0.0001, y1: DOOR_H }, false);
    const ry = d.wall === "n" ? 0 : d.wall === "s" ? Math.PI : d.wall === "w" ? Math.PI / 2 : -Math.PI / 2;
    const out = (dist: number): [number, number] => [d.x - d.nx * dist, d.z - d.nz * dist];
    if (d.to === "garden") {
      gardenM ??= new THREE.MeshBasicMaterial({ map: k.tex(viewCanvas("garden")), fog: false });
      const [gx, gz] = out(2.2);
      k.plane(5, 4, gardenM, gx, 1.6, gz, 0, ry);
      k.glow(k.patchT, "#fff0d6", 0.16, L.along === "x" ? d.half * 2 : 1.4, L.along === "x" ? 1.4 : d.half * 2, d.x + d.nx * 0.75, 0.007, d.z + d.nz * 0.75, -Math.PI / 2, 0);
    } else {
      // the next room, beyond: a lit wall and a strip of its floor
      const [bx, bz] = out(1.6);
      // the next room's wall, lit (a dark room is shown half lit, so the doorway never reads as a hole)
      const nextWall = "#" + new THREE.Color(ROOM_LOOK[d.to]?.wall ?? R.wall).lerp(new THREE.Color("#f0e2c8"), ROOM_LOOK[d.to]?.dark ? 0.55 : 0.1).getHexString();
      if (!beyondM.has(nextWall)) beyondM.set(nextWall, new THREE.MeshBasicMaterial({ map: k.tex(wallCanvas(nextWall)), color: new THREE.Color("#e6d8c2"), fog: false }));
      k.plane(2.4, DOOR_H + 0.4, beyondM.get(nextWall), bx, (DOOR_H + 0.4) / 2, bz, 0, ry);
      const [fx, fz] = out(0.8);
      k.plane(L.along === "x" ? d.half * 2 : 1.6, L.along === "x" ? 1.6 : d.half * 2, floorM, fx, 0.0, fz, -Math.PI / 2, 0);
      // light from the next room spilling in across the floor
      k.glow(k.patchT, "#ffe2b8", 0.22, L.along === "x" ? d.half * 2.2 : 1.5, L.along === "x" ? 1.5 : d.half * 2.2, d.x + d.nx * 0.7, 0.008, d.z + d.nz * 0.7, -Math.PI / 2, 0);
    }
    const [sx, sz] = [d.x + d.nx * 0.02, d.z + d.nz * 0.02];
    const sign = k.plane(0.9, 0.225, signM, sx, Math.min(H - 0.2, DOOR_H + 0.25), sz, 0, ry + Math.PI);
    const uv = sign.geometry.attributes.uv;
    const rows = signTexts.length;
    for (let q = 0; q < uv.count; q++) uv.setY(q, 1 - (di + 1 - uv.getY(q)) / rows);
  });
  // downlights
  const downG = new THREE.CircleGeometry(0.09, 18);
  const downM = k.glowM("#fff1d6", 3);
  const root = floor.parent;
  if (o.ceiling !== false) for (const x of [-W2 * 0.5, W2 * 0.5]) for (const z of [-D2 * 0.5, D2 * 0.45]) {
    const dl = new THREE.Mesh(downG, downM);
    dl.rotation.x = Math.PI / 2;
    dl.position.set(x, H - 0.01, z);
    root.add(dl);
  }
  return { W2, D2, H, floorM, wallM, trimM, metalM, glassM, frameM, root };
}

/** An empty plinth (something you have not bought yet), or one with a thing on it. Its footprint. */
function plinth(k: Kit, m: any, x: number, z: number, w = 0.5, h = 0.9): Box2 {
  k.box(w, h, w, m, x, h / 2, z, { cast: true });
  k.box(w + 0.06, 0.04, w + 0.06, m, x, h + 0.02, z);
  return [x - w / 2 - 0.03, x + w / 2 + 0.03, z - w / 2 - 0.03, z + w / 2 + 0.03];
}

/** A football shirt in a frame on a wall (your kits): one mesh painted by vertex colour, the frame apart. */
function framedShirt(k: Kit, env: RoomEnv, kit: Kit2, number: string, frameM: any, x: number, y: number, z: number, ry: number) {
  const { THREE } = k;
  const parts: any[] = [];
  const at = (g: any, colour: string, lx: number, ly: number, lz: number, rz = 0) => {
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(lx, ly, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rz)), new THREE.Vector3(1, 1, 1)));
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    const c = new THREE.Color(colour);
    const n = ng.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    ng.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    ng.deleteAttribute("uv");
    parts.push(ng);
  };
  at(new THREE.BoxGeometry(1.0, 1.2, 0.03), "#f4efe6", 0, 0, -0.01); // the mount
  at(new THREE.BoxGeometry(0.56, 0.7, 0.02), kit.shirt, 0, -0.06, 0.01); // the body
  for (const s of [-1, 1]) {
    at(new THREE.BoxGeometry(0.26, 0.2, 0.02), kit.shirt, s * 0.36, 0.17, 0.01, s * -0.42); // a sleeve
    at(new THREE.BoxGeometry(0.06, 0.2, 0.021), kit.trim, s * 0.47, 0.09, 0.012, s * -0.42); // its cuff
  }
  at(new THREE.BoxGeometry(0.18, 0.04, 0.021), kit.trim, 0, 0.27, 0.013); // the collar
  at(new THREE.BoxGeometry(0.56, 0.035, 0.021), kit.trim, 0, -0.39, 0.012); // the hem
  void number;
  const g = env.mergeGeometries(parts);
  for (const p of parts) p.dispose();
  const shirtM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  shirtM.userData.keep = true; // freezeStatic drops vertex colours: never join it
  const shirt = new THREE.Mesh(g, shirtM);
  const holder = new THREE.Group();
  holder.add(shirt);
  // the frame
  const fr = (w: number, h: number, fx: number, fy: number) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameM); me.position.set(fx, fy, 0); holder.add(me); };
  fr(1.1, 0.06, 0, 0.63); fr(1.1, 0.06, 0, -0.63); fr(0.06, 1.3, -0.53, 0); fr(0.06, 1.3, 0.53, 0);
  holder.position.set(x, y, z);
  holder.rotation.y = ry;
  flattenInto(k, holder);
}

/** Move a built group's pieces straight into the room (so they join the room's draws: freezeStatic joins per parent). */
function flattenInto(k: Kit, g: any) {
  g.updateMatrix();
  for (const c of [...g.children]) { c.applyMatrix4(g.matrix); k.add(c); }
}

/**
 * A rounded box (a cushion, an arm): a box with a few segments whose edges
 * are pulled round to radius r. Its normals point out of the rounding, so it
 * shades soft, like fabric over foam.
 */
export function roundedBox(THREE: any, w: number, h: number, d: number, r: number, seg = 4): any {
  const g = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  r = Math.max(0.001, Math.min(r, w / 2, h / 2, d / 2));
  const p = g.attributes.position, n = g.attributes.normal;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    dir.subVectors(v, c);
    if (dir.lengthSq() < 1e-12) continue;
    dir.normalize();
    v.copy(c).addScaledVector(dir, r);
    p.setXYZ(i, v.x, v.y, v.z);
    n.setXYZ(i, dir.x, dir.y, dir.z);
  }
  return g;
}

/**
 * A sofa facing `facing` (its seat looks that way), its middle at (x, z): a
 * base on short legs, rounded arms, a back, loose seat cushions and back
 * cushions leaning on it. All in the fabric (one draw once frozen), the legs
 * in `legM`. Its footprint.
 */
function sofa(k: Kit, fabricM: any, len: number, x: number, z: number, facing: "w" | "n" | "s", legM?: any): Box2 {
  const { THREE } = k;
  const d = 0.88;
  const g = new THREE.Group();
  const soft = (w: number, h: number, dd: number, r: number, lx: number, ly: number, lz: number, rx = 0) => {
    const me = new THREE.Mesh(roundedBox(THREE, w, h, dd, r), fabricM);
    me.position.set(lx, ly, lz);
    me.rotation.x = rx;
    me.castShadow = true; me.receiveShadow = true;
    g.add(me);
  };
  // the base (on legs), the back frame, the two arms
  soft(len, 0.22, d, 0.05, 0, 0.19, 0);
  soft(len, 0.56, 0.2, 0.08, 0, 0.58, d / 2 - 0.1);
  for (const sx of [-1, 1]) soft(0.2, 0.36, d, 0.09, sx * (len / 2 - 0.1), 0.44, 0);
  // loose cushions: the seat in two or three, the back ones leaning on the frame
  const n = len > 1.9 ? 3 : 2;
  const inner = len - 0.4;
  const cw = (inner - 0.025 * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const cx = -inner / 2 + cw / 2 + i * (cw + 0.025);
    soft(cw, 0.15, d - 0.26, 0.06, cx, 0.37, -0.06);
    soft(cw, 0.44, 0.17, 0.08, cx, 0.66, d / 2 - 0.27, 0.16);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, 0.08, 0.05, legM ?? fabricM, sx * (len / 2 - 0.08), 0.04, sz * (d / 2 - 0.08), { cast: true, parent: g });
  g.rotation.y = facing === "n" ? 0 : facing === "s" ? Math.PI : Math.PI / 2;
  g.position.set(x, 0, z);
  flattenInto(k, g);
  const along = facing === "w";
  return along ? [x - d / 2, x + d / 2, z - len / 2, z + len / 2] : [x - len / 2, x + len / 2, z - d / 2, z + d / 2];
}

/**
 * Many small coloured pieces as ONE draw: each piece is painted in its
 * vertices' colour and joined into one mesh at `done()` (the pool table, the
 * gym, the seats, the tool wall). `at(x, z, ry)` places the next pieces in a
 * turned frame (a seat's own left/right, front/back); `at()` goes back.
 */
function painter(k: Kit, env: RoomEnv) {
  const { THREE } = k;
  const parts: any[] = [];
  let frame = new THREE.Matrix4();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  const put = (g: any, colour: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    g.applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), one));
    g.applyMatrix4(frame);
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng !== g) g.dispose();
    col.set(colour);
    const n = ng.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = col.r; cols[i * 3 + 1] = col.g; cols[i * 3 + 2] = col.b; }
    ng.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    if (ng.attributes.uv) ng.deleteAttribute("uv");
    parts.push(ng);
  };
  return {
    at(x = 0, z = 0, ry = 0, y = 0) { frame = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), one); },
    box(w: number, h: number, d: number, c: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) { put(new THREE.BoxGeometry(w, h, d), c, x, y, z, rx, ry, rz); },
    soft(w: number, h: number, d: number, r: number, c: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) { put(roundedBox(THREE, w, h, d, r, 3), c, x, y, z, rx, ry, rz); },
    cyl(rt: number, rb: number, h: number, c: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, seg = 12) { put(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y, z, rx, ry, rz); },
    ball(r: number, c: string, x: number, y: number, z: number, seg = 10) { put(new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.7))), c, x, y, z); },
    ring(r: number, t: number, c: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) { put(new THREE.TorusGeometry(r, t, 6, 18), c, x, y, z, rx, ry, rz); },
    geo(g: any, c: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { put(g, c, x, y, z, rx, ry, rz); },
    /** Join every piece so far into one mesh (one draw) in the room. */
    done(o: { roughness?: number; metalness?: number; env?: number; cast?: boolean } = {}): any {
      frame = new THREE.Matrix4();
      if (!parts.length) return null;
      const g = env.mergeGeometries(parts);
      for (const x of parts) x.dispose();
      parts.length = 0;
      const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.roughness ?? 0.8, metalness: o.metalness ?? 0, envMapIntensity: o.env ?? 1 });
      m.userData.keep = true; // freezeStatic drops vertex colours: never join it
      const me = new THREE.Mesh(g, m);
      me.castShadow = o.cast ?? true;
      me.receiveShadow = true;
      k.add(me);
      return me;
    },
  };
}
type Painter = ReturnType<typeof painter>;

/** Still water: a flat sheet that shines (the pool, the fountain). */
function waterMat(THREE: any) {
  return new THREE.MeshStandardMaterial({ color: "#2b93bd", roughness: 0.04, metalness: 0.15, envMapIntensity: 1.8, emissive: "#0b4660", emissiveIntensity: 0.55 });
}

/** A flat disc of a material, lying on the floor at height y. */
function disc(k: Kit, r: number, m: any, x: number, y: number, z: number, seg = 28) {
  const me = new k.THREE.Mesh(new k.THREE.CircleGeometry(r, seg), m);
  me.rotation.x = -Math.PI / 2;
  me.position.set(x, y, z);
  me.receiveShadow = true;
  k.add(me);
  return me;
}

/** A sky over an open terrace: a big dome, light at the horizon, blue above (one draw). */
function skyDome(k: Kit, top: string, low: string) {
  const { THREE } = k;
  const g = new THREE.SphereGeometry(60, 18, 10);
  const p = g.attributes.position;
  const a = new THREE.Color(top), b = new THREE.Color(low), c = new THREE.Color();
  const cols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = Math.max(0, Math.min(1, p.getY(i) / 40));
    c.copy(b).lerp(a, Math.sqrt(t));
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const me = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
  me.renderOrder = -1;
  k.add(me);
  return me;
}

/** What the room-building pieces share inside one room. */
interface Ctx {
  k: Kit;
  env: RoomEnv;
  inp: RoomInput;
  R: RoomPreset;
  plan: RoomPlan;
  W2: number;
  D2: number;
  H: number;
  stuff: HomeStuff;
  solids: Box2[];
  props: any;
  keep: Set<any>;
  fitLen: ReturnType<typeof fitLenWith>;
  propJobs: (() => Promise<void>[])[];
  alive: () => boolean;
  wood: string;
  woodM: any;
  fabricM: any;
  potM: any;
  leafM: any;
  plinthM: any;
}

/** A shelf of your watches and cans on a wall (an empty stand for each you have not bought). */
function showShelf(c: Ctx, P: Painter, S: Painter, x: number, z: number, ry: number) {
  P.at(x, z, ry);
  S.at(x, z, ry);
  for (const y of [1.1, 1.55]) P.box(1.4, 0.04, 0.26, c.wood, 0, y, 0);
  for (const sx of [-0.66, 0.66]) P.box(0.04, 0.5, 0.22, c.wood, sx, 1.32, 0);
  (["smart", "gold", "luxury"] as const).forEach((w, i) => {
    const lx = -0.45 + i * 0.45;
    P.box(0.12, 0.1, 0.08, "#2b2b30", lx, 1.17, 0);
    if (c.stuff.watches.includes(w)) S.ring(0.06, 0.014, w === "smart" ? "#1b1d22" : w === "gold" ? "#e2b44a" : "#d9dde2", lx, 1.25, 0.01);
  });
  const n = Math.min(5, c.stuff.cans);
  for (let i = 0; i < 5; i++) {
    const lx = -0.56 + i * 0.28;
    if (i < n) S.cyl(0.035, 0.035, 0.13, i % 2 ? "#e2b44a" : "#d7263d", lx, 1.635, 0);
    else P.box(0.07, 0.01, 0.07, "#2b2b30", lx, 1.575, 0);
  }
  P.at(); S.at();
}

/** Load a model, fit it to a length and stand it at (x, y, z) turned ry (after the room shows). */
function propModel(c: Ctx, url: string, len: number, x: number, y: number, z: number, ry: number, o: { skinned?: boolean } = {}) {
  const { THREE } = c.k;
  c.propJobs.push(() => [c.env.glb(url).then((g: any) => {
    if (!c.alive()) return;
    const root = o.skinned && c.env.cloneSkinned ? c.env.cloneSkinned(g.scene) : g.scene.clone(true);
    root.traverse((m: any) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; if (m.material && !o.skinned) m.material.envMap = c.env.envTex; } });
    c.fitLen(root, len, false);
    const holder = new THREE.Group();
    holder.add(root);
    holder.position.set(x, y, z);
    holder.rotation.y = ry;
    c.props.add(holder);
  }).catch((e: unknown) => console.error("home: model", url, e))]);
}

// ── The villa's and estate's rooms, the penthouse terrace, the flat's nook ──

/** The garage: your cars in their bays (an empty plinth for each bay without), the bike, a tool wall, the garage door. */
function buildGarage(c: Ctx) {
  const { k, env, inp, W2, D2, H, stuff, solids } = c;
  const shell = shellOf(k, env, c.R, c.plan, []);
  const P = painter(k, env), S = painter(k, env);
  // the garage door on the north wall: a closed roller door in a frame, its motor above
  const dw = Math.min(6.4, c.plan.w - 2.4), dh = Math.min(2.7, H - 0.5);
  const dz = -D2 + 0.07;
  let slat = 0;
  for (let y = 0.06; y < dh; y += 0.15) P.box(dw, 0.135, 0.05, slat++ % 2 ? "#d9dcdf" : "#c7ccd1", 0, y + 0.07, dz);
  for (const sx of [-1, 1]) P.box(0.16, dh + 0.16, 0.12, "#4a4e54", sx * (dw / 2 + 0.08), (dh + 0.16) / 2, dz);
  P.box(dw + 0.32, 0.3, 0.3, "#4a4e54", 0, dh + 0.23, dz + 0.08);
  k.glow(k.patchT, "#fff2d8", 0.18, dw, 0.5, 0, 0.008, dz + 0.3, -Math.PI / 2, 0); // daylight under the door
  // four bays: painted lines, a light over each, a car (or an empty turntable plinth)
  const nBays = 4;
  const s = Math.min(2.6, (c.plan.w - 0.8) / nBays);
  const carL = 4.7, z0 = -D2 + 0.6, zc = z0 + carL / 2;
  const xs = Array.from({ length: nBays }, (_, i) => (i - (nBays - 1) / 2) * s);
  for (let i = 0; i <= nBays; i++) P.box(0.07, 0.004, carL + 0.3, "#e8c33a", (i - nBays / 2) * s, 0.003, zc);
  const nCars = Math.min(carsIn("garage", inp.tier), inp.cars.length);
  const stripM = k.glowM("#f4fbff", 2.6);
  xs.forEach((x, i) => {
    k.box(0.12, 0.04, carL * 0.8, stripM, x, H - 0.03, zc);
    k.glow(k.glowT, "#e8f2ff", 0.16, 1.6, carL, x, H - 0.02, zc, Math.PI / 2, 0);
    k.glow(k.patchT, "#fff4e0", 0.2, s * 0.86, carL * 0.9, x, 0.009, zc, -Math.PI / 2, 0);
    if (i >= nCars) {
      // an empty bay: a low turntable plinth, waiting for a car
      P.cyl(1.05, 1.1, 0.08, "#2a2c30", x, 0.04, zc, 0, 0, 0, 28);
      P.cyl(1.0, 1.0, 0.012, "#3a3d42", x, 0.085, zc, 0, 0, 0, 28);
      S.ring(1.07, 0.018, "#c8a24a", x, 0.08, zc, Math.PI / 2);
    }
    solids.push([x - 1.05, x + 1.05, z0 - 0.1, z0 + carL]);
  });
  // the cars face out of their bays (towards you), side by side
  c.propJobs.push(() => loadCars(env, inp.cars, nCars, (i) => [xs[i], zc, -Math.PI / 2], c.props, c.fitLen, c.alive, k.seen));
  // the tool wall (south): a workbench, a pegboard of tools, a red tool chest
  const bl = Math.min(3.0, W2 - 0.4), bx = -0.2, bz = D2 - 0.34;
  P.box(bl, 0.06, 0.64, c.wood, bx, 0.92, bz);
  P.box(bl - 0.04, 0.84, 0.58, "#a42a2a", bx, 0.44, bz + 0.02);
  for (let i = 0; i < 5; i++) for (const y of [0.75, 0.45]) P.box(bl / 5 - 0.06, 0.012, 0.01, "#d8d8d8", bx - bl / 2 + (i + 0.5) * (bl / 5), y, bz - 0.28);
  P.box(bl, 1.2, 0.03, "#c9a77a", bx, 1.7, D2 - 0.03);
  const tones = ["#c0c4c9", "#d24a2a", "#2a62d2", "#e8c33a", "#2b2b30"];
  for (let i = 0; i < 12; i++) {
    const tx = bx - bl / 2 + 0.25 + i * ((bl - 0.5) / 11);
    const kind = i % 4, col = tones[i % tones.length], zz = D2 - 0.06;
    if (kind === 0) { P.box(0.03, 0.26 + (i % 3) * 0.05, 0.015, "#c0c4c9", tx, 1.75, zz); P.ring(0.03, 0.01, "#c0c4c9", tx, 1.9 + (i % 3) * 0.025, zz); }
    else if (kind === 1) { P.cyl(0.018, 0.018, 0.18, col, tx, 1.62, zz); P.cyl(0.005, 0.005, 0.14, "#c0c4c9", tx, 1.46, zz); }
    else if (kind === 2) { P.box(0.03, 0.3, 0.02, "#7a5230", tx, 1.7, zz); P.box(0.14, 0.05, 0.04, "#3a3d42", tx, 1.86, zz - 0.01); }
    else P.ring(0.09, 0.02, col, tx, 1.95, zz - 0.01);
  }
  k.box(bl * 0.9, 0.025, 0.05, k.glowM("#fff1d6", 2.4), bx, 2.3, D2 - 0.1);
  k.glow(k.glowT, "#fff1d6", 0.24, bl * 1.1, 1.8, bx, 1.6, D2 - 0.05, 0, Math.PI);
  solids.push([bx - bl / 2 - 0.05, bx + bl / 2 + 0.05, bz - 0.36, D2]);
  const tcx = bx + bl / 2 + 0.6;
  if (tcx + 0.45 < W2 - 2.6) {
    P.box(0.9, 1.05, 0.5, "#b22a2a", tcx, 0.525, D2 - 0.3);
    for (let i = 0; i < 5; i++) P.box(0.82, 0.01, 0.01, "#e0e0e0", tcx, 0.2 + i * 0.18, D2 - 0.555);
    solids.push([tcx - 0.5, tcx + 0.5, D2 - 0.6, D2]);
  }
  // your club's colours as a band round the walls
  for (const [w, x, z, ry] of [[c.plan.w, 0, -D2 + 0.012, 0], [c.plan.w, 0, D2 - 0.012, 0], [c.plan.d, -W2 + 0.012, 0, Math.PI / 2], [c.plan.d, W2 - 0.012, 0, Math.PI / 2]] as [number, number, number, number][]) {
    P.box(w, 0.12, 0.01, inp.kits.home.shirt, x, 2.6, z, 0, ry);
    P.box(w, 0.04, 0.01, inp.kits.home.trim, x, 2.5, z, 0, ry);
  }
  // the motorbike on its mat by the east wall (an empty plinth until you buy one)
  const bkx = W2 - 1.35, bkz = D2 - 1.05;
  P.box(2.3, 0.02, 0.9, "#1d1f23", bkx, 0.01, bkz);
  if (stuff.bike && inp.bikeModel) {
    propModel(c, inp.bikeModel, 2.05, bkx, 0.02, bkz, Math.PI);
    solids.push([bkx - 1.15, bkx + 1.15, bkz - 0.45, bkz + 0.45]);
  } else solids.push(plinth(k, c.plinthM, bkx, bkz, 0.5, 0.7));
  k.glow(k.patchT, "#fff4e0", 0.18, 2.3, 1.1, bkx, 0.009, bkz, -Math.PI / 2, 0);
  P.done({ roughness: 0.6 });
  S.done({ roughness: 0.25, metalness: 0.9, env: 1.4, cast: false });
  return shell;
}

/** The games room: a pool table under its lamp (the hero), a pool in a stone surround, a shelf of your watches and cans. */
function buildGames(c: Ctx) {
  const { k, env, W2, D2, H, solids } = c;
  const { THREE } = k;
  const shell = shellOf(k, env, c.R, c.plan, [{ wall: "n", c: W2 * 0.4, w: 2.2, y0: 0.7, y1: Math.min(H - 0.35, 2.4), view: c.R.view }]);
  const P = painter(k, env), S = painter(k, env);
  // the pool: still water in a stone surround along the west wall
  const px0 = -W2 + 0.75, px1 = px0 + Math.min(3.2, W2 - 1.2), pz0 = -D2 + 0.8, pz1 = D2 - 1.7;
  const pw = px1 - px0, pd = pz1 - pz0, pcx = (px0 + px1) / 2, pcz = (pz0 + pz1) / 2;
  const stone = "#e7dfcf";
  P.box(pw + 0.6, 0.1, 0.3, stone, pcx, 0.05, pz0 - 0.15);
  P.box(pw + 0.6, 0.1, 0.3, stone, pcx, 0.05, pz1 + 0.15);
  P.box(0.3, 0.1, pd, stone, px0 - 0.15, 0.05, pcz);
  P.box(0.3, 0.1, pd, stone, px1 + 0.15, 0.05, pcz);
  k.plane(pw, pd, waterMat(THREE), pcx, 0.03, pcz, -Math.PI / 2).receiveShadow = true;
  k.glow(k.glowT, "#8fe8ff", 0.35, pw * 0.8, pd * 0.6, pcx, 0.04, pcz, -Math.PI / 2, 0); // its underwater lights
  k.glow(k.glowT, "#7fd6f0", 0.12, pw * 1.2, pd * 0.9, pcx, H - 0.02, pcz, Math.PI / 2, 0); // their shimmer on the ceiling
  for (const sx of [-0.25, 0.25]) { S.cyl(0.02, 0.02, 0.9, "#d9dde2", pcx + sx, 0.45, pz0 + 0.05); S.ring(0.12, 0.02, "#d9dde2", pcx + sx, 0.9, pz0 + 0.17, 0, Math.PI / 2); }
  solids.push([px0 - 0.3, px1 + 0.3, pz0 - 0.3, pz1 + 0.3]);
  // two loungers at the pool's south end
  const loungers = [px0 + 0.6, px0 + 1.8].filter((lx) => lx < px1);
  for (const lx of loungers) {
    P.at(lx, pz1 + 0.95, 0);
    P.soft(0.62, 0.1, 1.5, 0.04, "#f2ede4", 0, 0.32, 0);
    P.soft(0.62, 0.1, 0.6, 0.04, "#f2ede4", 0, 0.5, -0.78, -0.7);
    for (const sx of [-0.27, 0.27]) for (const sz of [-0.6, 0.6]) P.box(0.04, 0.27, 0.04, "#4a3a2c", sx, 0.135, sz);
    P.at();
  }
  if (loungers.length) solids.push([px0 + 0.2, loungers[loungers.length - 1] + 0.4, pz1 + 0.2, pz1 + 1.75]);
  // the pool table (the hero): legs, body, cloth, cushions, rails, pockets, the balls racked, a cue
  const tx = Math.min(W2 - 1.8, Math.max(px1 + 1.6, W2 * 0.4)), tz = -0.4;
  const cw = 1.27, cl = 2.54, wood = c.wood, cloth = "#1f6b3a";
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.16, 0.62, 0.16, wood, tx + sx * (cw / 2), 0.31, tz + sz * (cl / 2 - 0.1));
  P.box(cw + 0.24, 0.2, cl + 0.24, wood, tx, 0.68, tz);
  P.box(cw, 0.04, cl, cloth, tx, 0.8, tz);
  for (const sx of [-1, 1]) { P.box(0.05, 0.05, cl - 0.16, cloth, tx + sx * (cw / 2 - 0.02), 0.84, tz); P.box(0.13, 0.05, cl + 0.26, wood, tx + sx * (cw / 2 + 0.06), 0.84, tz); }
  for (const sz of [-1, 1]) { P.box(cw - 0.16, 0.05, 0.05, cloth, tx, 0.84, tz + sz * (cl / 2 - 0.02)); P.box(cw + 0.26, 0.05, 0.13, wood, tx, 0.84, tz + sz * (cl / 2 + 0.06)); }
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) P.cyl(0.065, 0.065, 0.02, "#0b0b0c", tx + sx * (cw / 2 - 0.01), 0.866, tz + sz * (cl / 2 - 0.01), 0, 0, 0, 10);
  const ballCols = ["#f2c230", "#2156c9", "#d42a2a", "#5a2a8a", "#f07a1a", "#1d8a3a", "#7a1c1c", "#0b0b0c", "#f2c230", "#2156c9"];
  let bi = 0;
  for (let row = 0; row < 4; row++) for (let j = 0; j <= row; j++) P.ball(0.028, ballCols[bi++ % ballCols.length], tx + (j - row / 2) * 0.058, 0.85, tz - cl / 4 - row * 0.05, 8);
  P.ball(0.028, "#f6f3ea", tx, 0.85, tz + cl / 4, 8);
  P.cyl(0.006, 0.011, 1.45, "#c8a476", tx + 0.25, 0.86, tz + 0.35, Math.PI / 2, 0, 0.35);
  solids.push([tx - cw / 2 - 0.22, tx + cw / 2 + 0.22, tz - cl / 2 - 0.22, tz + cl / 2 + 0.22]);
  // its lamp: a long green shade on two rods, lit underneath
  P.box(0.4, 0.14, 1.7, "#1d3b2a", tx, H - 0.95, tz);
  for (const sz of [-0.6, 0.6]) S.cyl(0.008, 0.008, 0.85, "#c8a24a", tx, H - 0.45, tz + sz);
  k.box(0.32, 0.01, 1.6, k.glowM("#fff1d6", 2.6), tx, H - 1.03, tz);
  k.glow(k.patchT, "#fff0d0", 0.34, cw + 0.4, cl + 0.3, tx, 0.88, tz, -Math.PI / 2, 0);
  k.glow(k.glowT, "#fff0d0", 0.2, 3.0, 3.8, tx, 0.01, tz, -Math.PI / 2, 0);
  // a cue rack on the east wall, the shelf of your things beside it
  const rz = Math.min(D2 - 1.1, tz + 1.9);
  P.box(0.04, 1.3, 0.6, wood, W2 - 0.03, 1.3, rz);
  for (let i = 0; i < 4; i++) P.cyl(0.008, 0.014, 1.45, i % 2 ? "#c8a476" : "#8a5a32", W2 - 0.07, 1.0, rz - 0.21 + i * 0.14);
  const shz = Math.max(-D2 + 0.9, tz - 1.6);
  showShelf(c, P, S, W2 - 0.15, shz, -Math.PI / 2);
  k.glow(k.glowT, "#ffe0a8", 0.18, 1.8, 1.2, W2 - 0.03, 1.35, shz, 0, -Math.PI / 2);
  solids.push([W2 - 0.3, W2, rz - 0.35, rz + 0.35], [W2 - 0.3, W2, shz - 0.72, shz + 0.72]);
  solids.push(plant(k, c.potM, c.leafM, W2 - 0.4, D2 - 0.4));
  P.done({ roughness: 0.7 });
  S.done({ roughness: 0.22, metalness: 0.95, env: 1.5, cast: false });
  if (c.R.chandelier) chandelier(k, shell.metalM, H, pcx, pcz);
  return shell;
}

/** The screen picture: your club's badge on a dark field (drawn in when the badge picture arrives). */
function screenTexture(k: Kit, inp: RoomInput) {
  const cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 512;
  const g = cv.getContext("2d");
  if (g) {
    const gr = g.createRadialGradient(512, 230, 40, 512, 256, 600);
    gr.addColorStop(0, "#1c2740"); gr.addColorStop(1, "#05070c");
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 512);
    g.globalAlpha = 0.55;
    g.fillStyle = inp.kits.home.shirt; g.fillRect(0, 470, 1024, 14);
    g.fillStyle = inp.kits.home.trim; g.fillRect(0, 486, 1024, 6);
    g.globalAlpha = 1;
    if (inp.club) {
      g.fillStyle = "rgba(255,255,255,0.88)";
      g.font = "600 34px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      g.textAlign = "center";
      g.fillText(inp.club.toUpperCase(), 512, 440);
    }
  }
  const t = k.tex(cv);
  if (inp.badge && g && typeof Image !== "undefined") {
    const img = new Image();
    img.onload = () => { g.drawImage(img, 512 - 165, 50, 330, 330); t.needsUpdate = true; };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(inp.badge);
  }
  return t;
}

/** The cinema: a big screen showing your club's badge (the hero), rows of recliners, a starry ceiling, a snack bar. */
function buildCinema(c: Ctx) {
  const { k, env, inp, W2, D2, H, stuff, solids } = c;
  const { THREE } = k;
  const shell = shellOf(k, env, c.R, c.plan, []);
  const P = painter(k, env), S = painter(k, env);
  // the screen in a black frame, speakers either side
  const sw = Math.min(4.8, c.plan.w - 1.8), sh = sw * 0.5, sy = 0.7 + sh / 2;
  P.box(sw + 0.2, sh + 0.2, 0.08, "#0a0a0c", 0, sy, -D2 + 0.05);
  const screen = k.plane(sw, sh, new THREE.MeshBasicMaterial({ map: screenTexture(k, inp), toneMapped: false }), 0, sy, -D2 + 0.1);
  c.keep.add(screen);
  for (const sx of [-1, 1]) {
    P.box(0.42, 1.5, 0.36, "#141417", sx * (sw / 2 + 0.45), 0.75, -D2 + 0.25);
    for (const y of [0.45, 0.95, 1.3]) P.cyl(0.11, 0.11, 0.02, "#2a2a30", sx * (sw / 2 + 0.45), y, -D2 + 0.44, Math.PI / 2);
  }
  solids.push([-sw / 2 - 0.7, sw / 2 + 0.7, -D2, -D2 + 0.5]);
  // the screen's light on the room
  k.glow(k.glowT, "#9ab8ff", 0.3, sw * 1.4, 3.2, 0, 0.012, -D2 + 1.6, -Math.PI / 2, 0);
  k.glow(k.glowT, "#9ab8ff", 0.16, sw * 1.3, 2.2, 0, H - 0.02, -D2 + 1.2, Math.PI / 2, 0);
  // two rows of recliners, an aisle down the middle, the back row on a step
  const seatCol = "#7a1c24", armCol = "#2a1a1c";
  const per = Math.max(2, Math.min(3, Math.floor((W2 - 0.6 - 0.35) / 0.85)));
  const rows = [{ z: -0.15, y: 0 }, { z: 1.35, y: 0.24 }];
  P.box(c.plan.w, 0.24, 1.3, "#3a2a30", 0, 0.12, rows[1].z + 0.05);
  P.box(c.plan.w - 0.1, 0.02, 0.04, "#d8b46a", 0, 0.245, rows[1].z - 0.6); // the step's edge
  k.glow(k.patchT, "#ffd9a0", 0.16, c.plan.w, 0.3, 0, 0.012, rows[1].z - 0.72, -Math.PI / 2, 0);
  for (const r of rows) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < per; i++) {
        P.at(side * (0.55 + 0.425 + i * 0.85), r.z, 0, r.y);
        P.soft(0.66, 0.2, 0.7, 0.06, seatCol, 0, 0.42, 0);
        P.box(0.7, 0.3, 0.72, armCol, 0, 0.17, 0.02);
        P.soft(0.66, 0.66, 0.2, 0.08, seatCol, 0, 0.78, 0.36, 0.12);
        for (const ax of [-0.41, 0.41]) { P.soft(0.14, 0.32, 0.8, 0.05, armCol, ax, 0.46, 0.02); S.at(side * (0.55 + 0.425 + i * 0.85), r.z, 0, r.y); S.cyl(0.04, 0.03, 0.05, "#c8cdd2", ax, 0.63, -0.25); S.at(); }
        P.at();
      }
      const x0 = side * 0.55, x1 = side * (0.55 + per * 0.85 + 0.06);
      solids.push([Math.min(x0, x1), Math.max(x0, x1), r.z - 0.42, r.z + 0.5]);
    }
  }
  // stars in the ceiling: tiny lights, one draw
  const nStars = 90;
  const stars = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 5, 4), k.glowM("#fff8e8", 3), nStars);
  const m = new THREE.Matrix4();
  let sd = 7;
  const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < nStars; i++) { m.makeTranslation((rnd() - 0.5) * (c.plan.w - 0.4), H - 0.012, (rnd() - 0.5) * (c.plan.d - 0.4)); stars.setMatrixAt(i, m); }
  k.add(stars);
  c.keep.add(stars);
  // sconces on the side walls
  const sconceM = k.glowM("#ffcf8a", 1.6);
  for (const sx of [-1, 1]) for (const z of [-0.6, 1.6]) {
    k.box(0.06, 0.24, 0.14, sconceM, sx * (W2 - 0.04), 1.9, z);
    k.glow(k.glowT, "#ffb870", 0.22, 1.0, 1.6, sx * (W2 - 0.03), 2.0, z, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
  }
  // the snack bar in the back corner: your KIB cans (an empty plinth without)
  const bx = -W2 + 0.65, bz = D2 - 0.55;
  if (stuff.cans > 0) {
    P.box(1.0, 0.95, 0.5, "#1c1416", bx, 0.475, bz);
    P.box(1.04, 0.04, 0.54, c.wood, bx, 0.97, bz);
    for (let i = 0; i < Math.min(6, stuff.cans); i++) S.cyl(0.035, 0.035, 0.13, i % 2 ? "#e2b44a" : "#d7263d", bx - 0.36 + i * 0.14, 1.055, bz);
    solids.push([bx - 0.55, bx + 0.55, bz - 0.3, D2]);
  } else solids.push(plinth(k, c.plinthM, bx, bz, 0.5, 0.9));
  k.glow(k.glowT, "#ffcf8a", 0.16, 1.4, 1.4, bx, 1.4, D2 - 0.03, 0, Math.PI);
  P.done({ roughness: 0.85 });
  S.done({ roughness: 0.25, metalness: 0.9, env: 1.4, cast: false });
  return shell;
}

/** The gym: a power rack with a bar loaded in your club's colours (the hero), a bench, a treadmill, dumbbells, a mirror wall, a fridge of cans. */
function buildGym(c: Ctx) {
  const { k, env, inp, W2, D2, H, stuff, solids } = c;
  const shell = shellOf(k, env, c.R, c.plan, [{ wall: "w", c: D2 * 0.35, w: 1.6, y0: 0.9, y1: Math.min(H - 0.35, 2.4), view: c.R.view }]);
  const P = painter(k, env), S = painter(k, env);
  const steel = "#1d1f23", plate = inp.kits.home.shirt, plate2 = inp.kits.home.trim;
  // rubber flooring under the kit
  P.box(c.plan.w - 0.6, 0.012, 3.0, "#2b2d31", 0, 0.006, -D2 + 1.8);
  // the mirror wall (north): dark glass behind the rack
  k.plane(c.plan.w - 1.0, 1.8, k.mat("#3a4048", { roughness: 0.06, metalness: 0.95, envMapIntensity: 1.4 }), 0, 1.25, -D2 + 0.02);
  P.box(c.plan.w - 0.9, 0.04, 0.04, "#c0c4c9", 0, 2.17, -D2 + 0.03);
  // the power rack
  const rx = -W2 + 1.6, rz = -D2 + 1.25, rw = 1.25, rd = 1.2, rh = Math.min(2.35, H - 0.4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(0.07, rh, 0.07, steel, rx + sx * rw / 2, rh / 2, rz + sz * rd / 2);
  for (const sz of [-1, 1]) P.box(rw + 0.07, 0.07, 0.07, steel, rx, rh, rz + sz * rd / 2);
  for (const sx of [-1, 1]) { P.box(0.07, 0.07, rd + 0.07, steel, rx + sx * rw / 2, rh, rz); P.box(0.1, 0.06, 0.12, plate, rx + sx * rw / 2, 1.3, rz + rd / 2 - 0.05); }
  // the bar on its hooks, loaded with plates in your colours
  const barZ = rz + rd / 2 - 0.05;
  S.cyl(0.016, 0.016, 2.2, "#d9dde2", rx, 1.38, barZ, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) {
    P.cyl(0.225, 0.225, 0.05, plate, rx + sx * 0.82, 1.38, barZ, 0, 0, Math.PI / 2, 20);
    P.cyl(0.2, 0.2, 0.04, plate2, rx + sx * 0.88, 1.38, barZ, 0, 0, Math.PI / 2, 20);
    S.cyl(0.04, 0.04, 0.04, "#d9dde2", rx + sx * 0.93, 1.38, barZ, 0, 0, Math.PI / 2);
  }
  // the bench under it
  P.soft(0.3, 0.1, 1.2, 0.04, "#1a1a1d", rx, 0.45, rz + 0.1);
  for (const sz of [-0.45, 0.45]) P.box(0.08, 0.4, 0.08, steel, rx, 0.2, rz + 0.1 + sz);
  k.glow(k.patchT, "#fff4e0", 0.2, 2.2, 2.2, rx, 0.012, rz, -Math.PI / 2, 0);
  solids.push([rx - rw / 2 - 0.95, rx + rw / 2 + 0.95, rz - rd / 2 - 0.1, rz + rd / 2 + 0.25]);
  // a plate tree beside it
  const ptx = rx + rw / 2 + 0.85, ptz = -D2 + 0.45;
  P.cyl(0.03, 0.03, 1.1, steel, ptx, 0.55, ptz);
  P.box(0.5, 0.04, 0.5, steel, ptx, 0.02, ptz);
  for (const [y, rr, cc] of [[0.35, 0.225, plate], [0.42, 0.225, plate], [0.68, 0.16, plate2], [0.74, 0.16, plate2]] as [number, number, string][]) P.cyl(rr, rr, 0.05, cc, ptx, y, ptz + 0.08, Math.PI / 2, 0, 0, 18);
  // the treadmill along the east wall, its screen lit
  const tmx = W2 - 0.6, tmz = -D2 + 1.45;
  P.box(0.84, 0.18, 1.9, "#2a2c30", tmx, 0.09, tmz);
  P.box(0.56, 0.02, 1.6, "#141416", tmx, 0.19, tmz + 0.05);
  for (const sx of [-1, 1]) P.box(0.06, 1.15, 0.06, "#3a3d42", tmx + sx * 0.38, 0.75, tmz - 0.85);
  P.box(0.84, 0.3, 0.12, "#2a2c30", tmx, 1.35, tmz - 0.86, -0.4);
  k.box(0.4, 0.2, 0.01, k.glowM("#4aa3ff", 1.8), tmx, 1.37, tmz - 0.79, { parent: undefined });
  for (const sx of [-1, 1]) S.cyl(0.018, 0.018, 0.55, "#c0c4c9", tmx + sx * 0.38, 1.08, tmz - 0.58, Math.PI / 2);
  solids.push([tmx - 0.48, W2, tmz - 1.0, tmz + 1.0]);
  // a dumbbell rack along the west wall
  const dbz0 = rz + rd / 2 + 1.3, dbz1 = Math.min(D2 - 0.5, dbz0 + 2.0), dbx = -W2 + 0.35;
  for (const y of [0.35, 0.7]) P.box(0.5, 0.04, dbz1 - dbz0, steel, dbx, y, (dbz0 + dbz1) / 2);
  for (const sz of [dbz0 + 0.05, dbz1 - 0.05]) P.box(0.5, 0.75, 0.05, steel, dbx, 0.375, sz);
  const pairs = Math.max(2, Math.floor((dbz1 - dbz0) / 0.38));
  for (let i = 0; i < pairs; i++) for (const [y, side] of [[0.37, -0.1], [0.72, 0.1]] as [number, number][]) {
    const z = dbz0 + 0.2 + i * ((dbz1 - dbz0 - 0.4) / Math.max(1, pairs - 1));
    const r = 0.05 + (i / pairs) * 0.035;
    S.cyl(0.014, 0.014, 0.3, "#c0c4c9", dbx + side, y + r, z, 0, 0, Math.PI / 2);
    for (const e2 of [-0.15, 0.15]) P.cyl(r, r, 0.07, "#151517", dbx + side + e2, y + r, z, 0, 0, Math.PI / 2, 6);
  }
  solids.push([-W2, dbx + 0.3, dbz0 - 0.05, dbz1 + 0.05]);
  // kettlebells in front of it
  for (let i = 0; i < 3; i++) { P.ball(0.1 + i * 0.015, "#151517", -W2 + 1.3 + i * 0.35, 0.11 + i * 0.015, dbz1 - 0.2, 10); P.ring(0.06, 0.015, "#151517", -W2 + 1.3 + i * 0.35, 0.25 + i * 0.03, dbz1 - 0.2); }
  solids.push([-W2 + 1.1, -W2 + 2.2, dbz1 - 0.45, dbz1 + 0.05]);
  // a drinks fridge by the door: your KIB cans behind the glass (an empty lit fridge without)
  const fx = W2 - 0.42, fz = D2 - 0.42;
  P.box(0.6, 1.2, 0.6, "#2a2d33", fx, 0.6, fz);
  k.plane(0.48, 1.0, k.mat("#000000", { emissive: "#bfe3ff", emissiveIntensity: 0.35, roughness: 0.2 }), fx - 0.305, 0.62, fz, 0, -Math.PI / 2);
  for (let i = 0; i < Math.min(8, stuff.cans); i++) S.cyl(0.033, 0.033, 0.12, i % 2 ? "#e2b44a" : "#d7263d", fx - 0.36, 0.3 + Math.floor(i / 4) * 0.36, fz - 0.15 + (i % 4) * 0.1);
  solids.push([fx - 0.35, W2, fz - 0.35, D2]);
  // your colours as a stripe round the walls
  for (const [w, x, z, ry] of [[c.plan.w, 0, D2 - 0.012, 0], [c.plan.d, -W2 + 0.012, 0, Math.PI / 2], [c.plan.d, W2 - 0.012, 0, Math.PI / 2]] as [number, number, number, number][]) {
    P.box(w, 0.14, 0.01, plate, x, 2.55, z, 0, ry);
    P.box(w, 0.04, 0.01, plate2, x, 2.43, z, 0, ry);
  }
  const stripM = k.glowM("#f4fbff", 2.4);
  for (const x of [-W2 * 0.5, W2 * 0.5]) k.box(0.1, 0.03, 1.8, stripM, x, H - 0.02, -D2 + 1.6);
  P.done({ roughness: 0.65 });
  S.done({ roughness: 0.22, metalness: 0.95, env: 1.4, cast: false });
  return shell;
}

/** The estate's garden terrace: a fountain (the hero), lanterns, a hedge, plants, the grounds; your jet and horse out there if you own them. */
function buildGardenTerrace(c: Ctx) {
  const { k, env, W2, D2, H, stuff, solids } = c;
  const { THREE } = k;
  const below = -0.6;
  // the house wall behind you (north) with a lit window; open on the other three sides over a stone balustrade
  const winC = Math.min(W2 - 1.2, 2.2), winY1 = Math.min(H - 0.5, 2.5);
  const shell = shellOf(k, env, c.R, c.plan, [{ wall: "n", c: winC, w: 1.6, y0: 0.7, y1: winY1, view: null }], { ceiling: false, open: ["e", "w", "s"], parapet: { h: 0.92, from: below } });
  const P = painter(k, env);
  skyDome(k, "#6f9fd6", "#f6dcb6");
  // the house's warm room behind the window
  k.plane(1.6, winY1 - 0.7, new THREE.MeshBasicMaterial({ color: new THREE.Color("#f0c58a").multiplyScalar(0.9), toneMapped: false }), winC, (0.7 + winY1) / 2, -D2 - 0.3);
  // the lawn below the terrace and the grounds beyond (one painted picture)
  k.plane(90, 90, k.mat("#6f8f4a", { roughness: 1 }), 0, below, 0, -Math.PI / 2).receiveShadow = true;
  const groundsM = new THREE.MeshBasicMaterial({ map: k.tex(viewCanvas("grounds")), fog: false });
  const far = 26;
  k.plane(60, 16, groundsM, 0, below + 5.5, D2 + far, 0, Math.PI);
  k.plane(60, 16, groundsM, W2 + far, below + 5.5, 0, 0, -Math.PI / 2);
  k.plane(60, 16, groundsM, -W2 - far, below + 5.5, 0, 0, Math.PI / 2);
  // the fountain (the hero): a stone basin, a column and a bowl, water in both, water falling from the bowl
  const fx = 0.6, fz = 0.7;
  const stone = "#ddd3c0";
  const lathe = (pts: number[][], seg: number) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  P.geo(lathe([[0, 0], [1.18, 0], [1.24, 0.08], [1.24, 0.46], [1.14, 0.5], [1.06, 0.46], [1.04, 0.12], [0, 0.12]], 28), stone, fx, 0, fz);
  P.cyl(0.16, 0.22, 0.95, stone, fx, 0.55, fz, 0, 0, 0, 14);
  P.geo(lathe([[0, 0], [0.12, 0], [0.5, 0.14], [0.58, 0.2], [0.56, 0.24], [0.46, 0.2], [0, 0.18]], 22), stone, fx, 0.98, fz);
  P.cyl(0.05, 0.08, 0.3, stone, fx, 1.33, fz, 0, 0, 0, 10);
  P.ball(0.08, stone, fx, 1.5, fz, 10);
  const wM = waterMat(THREE);
  disc(k, 1.05, wM, fx, 0.4, fz);
  disc(k, 0.48, wM, fx, 1.15, fz, 20);
  k.glow(k.glowT, "#bff0ff", 0.25, 2.0, 2.0, fx, 0.42, fz, -Math.PI / 2, 0);
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.72, 20, 1, true), new THREE.MeshBasicMaterial({ color: "#cdefff", transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
  fall.position.set(fx, 0.8, fz);
  fall.renderOrder = 3;
  k.add(fall);
  c.keep.add(fall);
  solids.push([fx - 1.35, fx + 1.35, fz - 1.35, fz + 1.35]);
  // a table and three chairs by the house
  const tbx = W2 - 1.4, tbz = -D2 + 1.3;
  P.cyl(0.45, 0.45, 0.04, "#2b2b30", tbx, 0.74, tbz, 0, 0, 0, 20);
  P.cyl(0.04, 0.04, 0.72, "#2b2b30", tbx, 0.37, tbz);
  P.cyl(0.25, 0.28, 0.03, "#2b2b30", tbx, 0.015, tbz, 0, 0, 0, 14);
  for (const a of [0.6, 2.4, 4.2]) {
    P.at(tbx + Math.sin(a) * 0.78, tbz + Math.cos(a) * 0.78, a + Math.PI);
    P.soft(0.46, 0.08, 0.46, 0.03, "#efe7d8", 0, 0.45, 0);
    P.box(0.46, 0.5, 0.04, "#2b2b30", 0, 0.7, -0.22);
    for (const sx of [-0.2, 0.2]) for (const sz of [-0.2, 0.2]) P.box(0.03, 0.42, 0.03, "#2b2b30", sx, 0.21, sz);
    P.at();
  }
  solids.push([tbx - 1.2, Math.min(W2, tbx + 1.2), tbz - 1.2, tbz + 1.15]);
  // plants either side of the door
  const door = c.plan.doors[0];
  for (const sx of [-1, 1]) solids.push(plant(k, c.potM, c.leafM, (door?.x ?? 0) + sx * 1.15, -D2 + 0.45));
  // the jet out on the lawn, the horse by his paddock: if you own them, else their empty stand
  const jx = W2 + 9, jz = D2 + 14;
  P.cyl(4.2, 4.2, 0.03, "#8f9188", jx, below + 0.015, jz, 0, 0, 0, 32);
  P.ring(3.6, 0.08, "#f2efe6", jx, below + 0.04, jz, Math.PI / 2);
  if (stuff.jet) propModel(c, JET_LOD, 12, jx, below + 0.03, jz, 0.7);
  const hx = -W2 - 4.5, hz = D2 + 3.5;
  if (stuff.horse) propModel(c, HORSE_MODEL, 2.3, hx, below, hz, 2.1, { skinned: true });
  else P.box(0.9, 0.5, 0.9, "#cfc6b4", hx, below + 0.25, hz);
  // lights round the edge (painted pools; the lanterns arrive with the garden's models)
  for (const [x, z] of [[-W2 + 0.2, D2 - 0.2], [W2 - 0.2, D2 - 0.2], [-W2 + 0.2, -D2 + 0.4], [W2 - 0.2, -D2 + 0.4]] as [number, number][]) k.glow(k.glowT, "#ffcf8a", 0.24, 1.6, 1.6, x, 0.012, z, -Math.PI / 2, 0);
  // the garden's own models: hedges and bushes on the lawn, lanterns on the balustrade, potted plants, loungers, a paddock fence
  const placements: [string, number, number, number, number, number][] = []; // name, x, y, z, scale, ry
  for (let z = -D2 + 0.8; z < D2 + 0.5; z += 1.05) for (const sx of [-1, 1]) placements.push(["hedge", sx * (W2 + 0.7), below, z, 1.1, Math.PI / 2]);
  for (let x = -W2 + 0.5; x < W2; x += 1.05) placements.push(["hedge", x, below, D2 + 0.7, 1.1, 0]);
  for (const [x, z] of [[-W2 + 0.12, D2 - 0.12], [W2 - 0.12, D2 - 0.12], [-W2 + 0.12, -D2 + 0.6], [W2 - 0.12, -D2 + 0.6]] as [number, number][]) placements.push(["lantern", x, 0.99, z, 0.9, 0]);
  for (const [x, z] of [[-W2 + 0.55, D2 - 0.55], [W2 - 0.55, D2 - 0.55]] as [number, number][]) placements.push(["potted_plant", x, 0, z, 1.3, 0]);
  placements.push(["lounge_chair", -W2 + 1.1, 0, 0.4, 1.0, Math.PI / 2], ["lounge_chair", -W2 + 1.1, 0, 1.6, 1.0, Math.PI / 2]);
  for (const [x, z] of [[-6, 9], [5, 11], [12, 4], [-12, 6]] as [number, number][]) placements.push(["tree_oak", x, below, D2 + z, 2.4, x]);
  for (const [x, z] of [[-3, 3], [3.5, 4], [9, 2]] as [number, number][]) placements.push(["bush_large", x, below, D2 + z, 1.3, x]);
  for (let i = 0; i < 6; i++) placements.push(["fence_wood", hx - 2.5 + i * 1.0, below, hz - 2.2, 1.0, 0], ["fence_wood", hx - 2.5 + i * 1.0, below, hz + 2.2, 1.0, 0]);
  solids.push([-W2 + 0.6, -W2 + 1.6, -0.6, 2.6]);
  solids.push([-W2, -W2 + 0.85, D2 - 0.85, D2], [W2 - 0.85, W2, D2 - 0.85, D2]);
  c.propJobs.push(() => [env.glb(TERRACE_PROPS).then((g: any) => {
    if (!c.alive()) return;
    const byName = new Map<string, any>();
    g.scene.updateMatrixWorld(true);
    for (const top of g.scene.children) byName.set(top.name, top);
    // every placed piece joined into one draw per material
    const byMat = new Map<any, any[]>();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (const [name, x, y, z, s, ry] of placements) {
      const top = byName.get(name);
      if (!top) continue;
      const inv = top.matrixWorld.clone().invert();
      m4.compose(v.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), sc.set(s, s, s));
      top.traverse((o: any) => {
        if (!o.isMesh) return;
        let geo = o.geometry.clone();
        geo.applyMatrix4(inv.clone().multiply(o.matrixWorld));
        geo.applyMatrix4(m4);
        if (geo.index) { const ng = geo.toNonIndexed(); geo.dispose(); geo = ng; }
        for (const key of Object.keys(geo.attributes)) if (key !== "position" && key !== "normal" && key !== "uv") geo.deleteAttribute(key);
        if (!byMat.has(o.material)) byMat.set(o.material, []);
        byMat.get(o.material)!.push(geo);
      });
    }
    byMat.forEach((list, mat) => {
      if (!list.every((x) => !!x.attributes.uv)) for (const x of list) if (x.attributes.uv) x.deleteAttribute("uv");
      const merged = env.mergeGeometries(list);
      for (const x of list) x.dispose();
      if (!merged) return;
      const me = new THREE.Mesh(merged, mat.clone());
      me.castShadow = true; me.receiveShadow = true;
      c.props.add(me);
    });
  }).catch((e2: unknown) => console.error("home: terrace props", e2))]);
  P.done({ roughness: 0.75 });
  return shell;
}

/** The penthouse terrace: the city all round over glass, plants, an outdoor sofa; through the glass behind you, your best car on show. */
function buildPenthouseTerrace(c: Ctx) {
  const { k, env, inp, W2, D2, H, solids } = c;
  const { THREE } = k;
  const door = c.plan.doors[0];
  const dx = door?.x ?? 0;
  // the glass front of the penthouse (south) beside the door: floor to ceiling
  const gx0 = -W2 + 0.35, gx1 = dx - (door?.half ?? 0.55) - 0.4;
  const gw = Math.max(1.2, gx1 - gx0), gc = gx0 + gw / 2;
  const shell = shellOf(k, env, c.R, c.plan, [{ wall: "s", c: gc, w: gw, y0: 0.06, y1: H - 0.25, view: null }], { ceiling: false, open: ["n", "e", "w"], parapet: { h: 1.05, from: 0, glass: true } });
  const P = painter(k, env);
  skyDome(k, "#5f8fd0", "#f2d0a8");
  // the city all round, its towers far below
  const cityM = new THREE.MeshBasicMaterial({ map: k.tex(viewCanvas("skyline")), fog: false });
  const far = 9;
  k.plane(44, 22, cityM, 0, -2, -D2 - far, 0, 0);
  k.plane(44, 22, cityM, W2 + far, -2, 0, 0, -Math.PI / 2);
  k.plane(44, 22, cityM, -W2 - far, -2, 0, 0, Math.PI / 2);
  // the car gallery behind the glass: a dark polished floor, a lit back wall, your best car (an empty plinth without)
  const gz = D2 + 2.0;
  k.plane(gw + 1.2, 4.2, k.mat("#1d1f24", { roughness: 0.18, metalness: 0.3, envMapIntensity: 1.5 }), gc, 0.0, D2 + 2.1, -Math.PI / 2);
  const galleryM = new THREE.MeshBasicMaterial({ color: "#2a2c31" });
  k.plane(gw + 1.2, H, new THREE.MeshBasicMaterial({ map: k.tex(wallCanvas("#3a3d44")), color: new THREE.Color("#c9ccd2"), fog: false }), gc, H / 2, D2 + 4.1, 0, Math.PI);
  for (const sx of [-1, 1]) k.plane(4.2, H, galleryM, gc + sx * (gw / 2 + 0.6), H / 2, D2 + 2.1, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
  k.plane(gw + 1.2, 4.2, galleryM, gc, H, D2 + 2.1, Math.PI / 2);
  k.box(gw * 0.8, 0.03, 0.12, k.glowM("#f4fbff", 2.6), gc, H - 0.05, gz);
  k.glow(k.patchT, "#fff4e0", 0.3, Math.min(gw, 4.6), 2.4, gc, 0.01, gz, -Math.PI / 2, 0);
  k.glow(k.glowT, "#e8f0ff", 0.22, gw + 1, 2.4, gc, 1.4, D2 + 4.05, 0, Math.PI);
  if (inp.cars.length) c.propJobs.push(() => loadCars(env, inp.cars, 1, () => [gc, gz, 0], c.props, c.fitLen, c.alive, k.seen));
  else plinth(k, c.plinthM, gc, gz, 0.6, 0.6);
  // the outdoor sofa facing the view, a low table, a rug
  const sx = -0.6, sz = 0.35;
  solids.push(sofa(k, c.fabricM, Math.min(2.4, W2 + 0.4), sx, sz, "n", c.woodM));
  P.box(1.1, 0.06, 0.55, c.wood, sx, 0.36, sz - 1.0);
  for (const a of [-1, 1]) for (const b of [-1, 1]) P.box(0.05, 0.33, 0.05, c.wood, sx + a * 0.5, 0.165, sz - 1.0 + b * 0.22);
  solids.push([sx - 0.6, sx + 0.6, sz - 1.32, sz - 0.68]);
  k.plane(2.6, 2.0, k.mat("#c9b48e", { roughness: 1 }), sx, 0.007, sz - 0.6, -Math.PI / 2);
  // planters along the glass, a low hedge in each
  for (const [x, z, w, d] of [[W2 - 0.3, -0.3, 0.5, Math.min(2.6, c.plan.d - 1.6)], [-W2 + 1.5, -D2 + 0.3, 1.8, 0.5]] as [number, number, number, number][]) {
    P.box(w, 0.5, d, "#2b2b30", x, 0.25, z);
    P.soft(w - 0.06, 0.32, d - 0.06, 0.12, "#3f6b3a", x, 0.62, z);
    solids.push([x - w / 2, x + w / 2, z - d / 2, z + d / 2]);
  }
  solids.push(plant(k, c.potM, c.leafM, -W2 + 0.4, D2 - 0.4));
  solids.push(plant(k, c.potM, c.leafM, W2 - 0.4, -D2 + 0.4));
  // string lights over the terrace between two posts
  const posts: [number, number][] = [[-W2 + 0.15, -D2 + 0.15], [W2 - 0.15, D2 - 0.9]];
  for (const [x, z] of posts) P.box(0.06, 2.6, 0.06, "#2b2b30", x, 1.3, z);
  const nB = 16;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), k.glowM("#ffd9a0", 2.6), nB);
  const m = new THREE.Matrix4();
  for (let i = 0; i < nB; i++) {
    const t = (i + 0.5) / nB;
    m.makeTranslation(posts[0][0] + (posts[1][0] - posts[0][0]) * t, 2.55 - Math.sin(t * Math.PI) * 0.45, posts[0][1] + (posts[1][1] - posts[0][1]) * t);
    bulbs.setMatrixAt(i, m);
  }
  k.add(bulbs);
  c.keep.add(bulbs);
  k.glow(k.glowT, "#ffd9a0", 0.12, 3.2, 3.2, 0, 0.01, 0, -Math.PI / 2, 0);
  P.done({ roughness: 0.7 });
  return shell;
}

/** The flat's hallway nook: a boot bench with your boots on it, your kits on the hooks above, a slim table for your keys. */
function buildNook(c: Ctx) {
  const { k, env, inp, W2, D2, H, solids } = c;
  const { THREE } = k;
  const shell = shellOf(k, env, c.R, c.plan, []);
  const P = painter(k, env);
  // a runner and a doormat
  k.plane(0.9, c.plan.d - 1.2, k.mat("#7d4f3a", { roughness: 1 }), 0, 0.006, 0, -Math.PI / 2);
  k.plane(0.9, 0.55, k.mat("#3b3128", { roughness: 1 }), 0, 0.007, D2 - 0.4, -Math.PI / 2);
  // the boot bench (west wall), a cushion in your colours
  const bx = -W2 + 0.22, bl = Math.min(1.5, c.plan.d - 1.6);
  P.box(0.4, 0.06, bl, c.wood, bx, 0.44, 0);
  P.box(0.38, 0.03, bl - 0.04, c.wood, bx, 0.14, 0);
  for (const sz of [-1, 1]) P.box(0.4, 0.44, 0.05, c.wood, bx, 0.22, sz * (bl / 2 - 0.025));
  P.soft(0.38, 0.07, bl * 0.55, 0.03, inp.kits.home.shirt, bx, 0.505, bl * 0.2);
  // the hooks above it: your home shirt, your away shirt, a scarf in your colours
  P.box(0.04, 0.1, bl + 0.1, c.wood, -W2 + 0.03, 1.72, 0);
  const hang = (z: number, top: string, trim: string) => {
    P.cyl(0.01, 0.01, 0.1, "#9aa0a6", -W2 + 0.08, 1.72, z, 0, 0, Math.PI / 2);
    P.box(0.06, 0.6, 0.42, top, -W2 + 0.12, 1.4, z);
    for (const s of [-1, 1]) P.box(0.05, 0.16, 0.14, top, -W2 + 0.12, 1.62, z + s * 0.26, s * 0.5);
    P.box(0.065, 0.04, 0.16, trim, -W2 + 0.125, 1.69, z);
  };
  hang(-bl / 2 + 0.3, inp.kits.home.shirt, inp.kits.home.trim);
  hang(0.15, inp.kits.away.shirt, inp.kits.away.trim);
  for (let i = 0; i < 6; i++) P.box(0.03, 0.14, 0.16, i % 2 ? inp.kits.home.trim : inp.kits.home.shirt, -W2 + 0.09, 1.55 - i * 0.14, bl / 2 - 0.15);
  solids.push([-W2, -W2 + 0.44, -bl / 2 - 0.03, bl / 2 + 0.03]);
  // your boots on the bench's lower shelf (loaded after the room shows)
  c.propJobs.push(() => inp.boots.slice(0, 2).map((b, i) => {
    if (!b.model) return Promise.resolve();
    return env.glb(b.model).then((g: any) => {
      if (!c.alive()) return;
      for (const side of [-1, 1]) {
        const root = g.scene.clone(true);
        root.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; if (o.material) { o.material = o.material.clone(); o.material.color.set(b.id === "plain" ? "#3a3a3a" : b.colour).lerp(new THREE.Color("#ffffff"), 0.35); } } });
        c.fitLen(root, 0.3, true);
        const holder = new THREE.Group();
        holder.add(root);
        holder.position.set(bx, 0.16, -bl / 2 + 0.3 + i * 0.45 + side * 0.08);
        holder.rotation.y = Math.PI / 2 + 0.2;
        c.props.add(holder);
      }
    }).catch((e: unknown) => console.error("home: nook boot", b.model, e));
  }));
  // a slim table on the east wall: a bowl for your keys, a lamp, a round mirror above
  const tz = -0.25;
  P.box(0.28, 0.04, 0.9, c.wood, W2 - 0.16, 0.85, tz);
  for (const sz of [-1, 1]) P.box(0.04, 0.83, 0.04, c.wood, W2 - 0.26, 0.415, tz + sz * 0.4);
  P.cyl(0.08, 0.05, 0.04, "#d8cfc0", W2 - 0.16, 0.89, tz + 0.2, 0, 0, 0, 14);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 14, 1, true), k.glowM("#ffd9a0", 1.3));
  lamp.position.set(W2 - 0.16, 1.12, tz - 0.25);
  k.add(lamp);
  P.cyl(0.012, 0.012, 0.2, "#b08d57", W2 - 0.16, 0.97, tz - 0.25);
  k.glow(k.glowT, "#ffcf8a", 0.24, 1.2, 1.5, W2 - 0.02, 1.25, tz - 0.2, 0, -Math.PI / 2);
  P.cyl(0.36, 0.36, 0.03, "#b08d57", W2 - 0.03, 1.6, tz, 0, 0, Math.PI / 2, 28);
  const glassDisc = new THREE.Mesh(new THREE.CircleGeometry(0.33, 28), k.mat("#3a4048", { roughness: 0.08, metalness: 0.9, envMapIntensity: 1.2 }));
  glassDisc.position.set(W2 - 0.05, 1.6, tz);
  glassDisc.rotation.y = -Math.PI / 2;
  k.add(glassDisc);
  solids.push([W2 - 0.32, W2, tz - 0.48, tz + 0.48]);
  // a pendant over the middle
  const pend = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), k.glowM("#fff1d6", 2.2));
  pend.position.set(0, H - 0.6, 0);
  k.add(pend);
  P.cyl(0.006, 0.006, 0.5, "#2b2b30", 0, H - 0.27, 0);
  k.glow(k.glowT, "#ffe2b0", 0.18, 1.8, 1.8, 0, H - 0.02, 0, Math.PI / 2, 0);
  P.done({ roughness: 0.7 });
  return shell;
}

/** Build one of the new rooms. */
function buildNew(env: RoomEnv, inp: RoomInput, id: RoomId): BuiltRoom {
  const { THREE } = env;
  const R = roomPreset(inp.tier);
  const plan = roomPlan(inp.tier, id, inp.rooms);
  const W2 = plan.w / 2, D2 = plan.d / 2, H = plan.h;
  const group = new THREE.Group();
  group.name = `room-${id}`;
  const k = makeKit(env, group, { oneGlowDraw: true });
  const stuff = inp.stuff ?? NO_STUFF;
  let alive = true;
  const solids: Box2[] = [];
  const pickables: any[] = [];
  const pickBox = pickWith(k, pickables);
  const props = new THREE.Group();
  group.add(props);
  const keep = new Set<any>([props]);
  const fitLen = fitLenWith(THREE);
  const propJobs: (() => Promise<void>[])[] = [];
  let mirror: any = null;
  let mirrorSpot: XZ | null = null, mirrorFace: XZ | null = null;
  let mirrorNear = (_x: number, _z: number) => false;
  const zones: ((x: number, z: number) => { spot: HomeSpot; front: XZ } | null)[] = [];
  const stands: Partial<Record<HomeSpot, (p: XZ) => { at: XZ; face: XZ }>> = {};
  const shots: Partial<Record<HomeSpot, { cam: [number, number, number]; look: [number, number, number] }>> = {};
  const wood = R.tier === "estate" || R.tier === "villa" ? "#4a2e1c" : R.tier === "penthouse" ? "#1e1e22" : "#8a6a4c";
  const woodM = k.mat(wood, { roughness: 0.55 });
  const fabricM = k.mat(R.tier === "estate" ? "#5b2a2a" : R.tier === "villa" ? "#e8e0d0" : R.tier === "penthouse" ? "#3a3d44" : "#6d7b8a", { roughness: 0.95 });
  const potM = k.mat(R.metal, { roughness: 0.4, metalness: 0.6 });
  const leafM = k.mat("#2f5a35", { flatShading: true, roughness: 0.85 });
  const plinthM = k.mat("#ece6dc", { roughness: 0.6 });

  /** A drive window on the east wall: the cars outside, the "drive" spot. */
  const driveWindow = (zc: number, w: number) => {
    const DRIVE = { z: zc, w, y0: 0.55, y1: Math.min(H - 0.3, 2.4) };
    driveSet(k, R, W2);
    k.glow(k.patchT, "#ffd9a0", 0.32, 1.9, DRIVE.w * 0.95, W2 - 1.2, 0.008, DRIVE.z + 0.35, -Math.PI / 2, 0);
    pickBox("drive", 0.4, DRIVE.y1 - DRIVE.y0, DRIVE.w, W2, (DRIVE.y0 + DRIVE.y1) / 2, DRIVE.z);
    zones.push((x, z) => (x > W2 - 1.6 && Math.abs(z - DRIVE.z) < DRIVE.w / 2 + 0.3 ? { spot: "drive", front: [W2, Math.max(DRIVE.z - DRIVE.w / 2, Math.min(DRIVE.z + DRIVE.w / 2, z))] } : null));
    stands.drive = () => ({ at: [W2 - 0.95, DRIVE.z], face: [W2 + 3, DRIVE.z] });
    shots.drive = { cam: [W2 - 2.1, 1.65, DRIVE.z + 0.9], look: [W2 + 4, 0.7, DRIVE.z - 0.3] };
    const n = Math.min(carsIn(id, inp.tier), inp.cars.length);
    propJobs.push(() => loadCars(env, inp.cars, n, (i, nn, len) => [W2 + 2.2 + len / 2, DRIVE.z + (i - (nn - 1) / 2) * 2.7, Math.PI], props, fitLen, () => alive, k.seen));
    return { wall: "e" as Wall, c: DRIVE.z, w: DRIVE.w, y0: DRIVE.y0, y1: DRIVE.y1, view: "drive" as const };
  };

  /** The trophy cabinet on the north wall: the "cabinet" spot. */
  const cabinet = (glassM: any) => {
    const CP = cabPlan(R, D2);
    const { CAB, cabW, cabH, cabZ } = CP;
    const cab = cabinetSet(k, env, R, inp.slots, glassM, CP);
    solids.push(...cab.solids);
    for (const t of Object.values(cab.trophies)) if (t) keep.add(t);
    pickBox("cabinet", cabW, cabH, CAB.depth + 0.1, 0, cabH / 2, cabZ);
    zones.push((x, z) => (z < -D2 + CAB.depth + 1.5 && Math.abs(x) < cabW / 2 + 0.35 ? { spot: "cabinet", front: [Math.max(-cabW / 2, Math.min(cabW / 2, x)), -D2 + CAB.depth] } : null));
    stands.cabinet = (p) => ({ at: [Math.max(-cabW / 2 + 0.3, Math.min(cabW / 2 - 0.3, p[0] * 0.5)), -D2 + CAB.depth + 0.95], face: [0, -D2] });
    shots.cabinet = { cam: [0.35, 1.5, Math.min(D2 - 0.35, -D2 + CAB.depth + 2.2)], look: [0, CAB.base + (cabH - CAB.base) * 0.55, -D2] };
    return cab;
  };

  let shell: ReturnType<typeof shellOf>;

  if (id === "hallway") {
    shell = shellOf(k, env, R, plan, []);
    const { metalM } = shell;
    // a runner down the middle, a doormat at the front door
    k.seen(k.plane(1.3, plan.d - 1.4, k.mat(R.tier === "estate" ? "#6b2a2a" : "#7d4f3a", { roughness: 1 }), 0, 0.006, 0.2, -Math.PI / 2));
    k.plane(1.0, 0.6, k.mat("#3b3128", { roughness: 1 }), 0, 0.007, D2 - 0.45, -Math.PI / 2);
    // a console table on the west wall, north end, a lamp on it, your home shirt framed above
    const cz = -D2 + 1.05;
    k.box(0.4, 0.05, 1.2, woodM, -W2 + 0.22, 0.82, cz, { cast: true });
    for (const sz of [-1, 1]) k.box(0.36, 0.8, 0.04, woodM, -W2 + 0.22, 0.4, cz + sz * 0.56);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.2, 14, 1, true), k.glowM("#ffd9a0", 1.3));
    lamp.position.set(-W2 + 0.22, 1.1, cz - 0.35); group.add(lamp);
    k.box(0.02, 0.22, 0.02, metalM, -W2 + 0.22, 0.95, cz - 0.35);
    k.box(0.16, 0.05, 0.16, k.mat("#d8cfc0", { roughness: 0.5 }), -W2 + 0.22, 0.87, cz + 0.25); // a bowl for your keys
    k.glow(k.glowT, "#ffcf8a", 0.24, 1.4, 1.8, -W2 + 0.02, 1.3, cz - 0.3, 0, Math.PI / 2);
    framedShirt(k, env, inp.kits.home, "", woodM, -W2 + 0.04, 1.75, cz, Math.PI / 2);
    solids.push([-W2, -W2 + 0.45, cz - 0.65, cz + 0.65]);
    // a coat stand by the front door, a plant in the far corner
    const csx = W2 - 0.35, csz = D2 - 0.4;
    k.box(0.04, 1.75, 0.04, woodM, csx, 0.875, csz, { cast: true });
    k.box(0.36, 0.03, 0.36, woodM, csx, 0.015, csz);
    k.box(0.44, 0.5, 0.18, k.mat(inp.kits.away.shirt, { roughness: 0.9 }), csx, 1.35, csz, { cast: true }); // your away top on a hook
    solids.push([csx - 0.25, csx + 0.25, csz - 0.25, csz + 0.25]);
    solids.push(plant(k, potM, leafM, W2 - 0.4, -D2 + 0.4));
    // a pendant over the middle
    const pend = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), k.glowM("#fff1d6", 2.2));
    pend.position.set(0, H - 0.75, -0.3); group.add(pend);
    k.box(0.015, 0.6, 0.015, metalM, 0, H - 0.3, -0.3);
    k.glow(k.glowT, "#ffe2b0", 0.18, 2.2, 2.2, 0, H - 0.02, -0.3, Math.PI / 2, 0);
    if (R.chandelier) chandelier(k, metalM, H, 0, 1.4);
  } else if (id === "lounge") {
    const hasCab = plan.spots.includes("cabinet");
    // the drive window on the east wall, north of the doorway; a big window south onto the garden
    const ew = driveWindow(-D2 * 0.38, Math.min(2.6, plan.d * 0.42));
    const southDoor = plan.doors.some((d) => d.wall === "s");
    const wins: WinSpec[] = [ew];
    if (!southDoor) wins.push({ wall: "s", c: -0.6, w: 2.2, y0: 0.6, y1: Math.min(H - 0.35, 2.35), view: R.view });
    // (the penthouse lounge: its glass terrace is the view; the front door shows the landing)
    shell = shellOf(k, env, R, plan, wins);
    const { metalM, glassM } = shell;
    if (hasCab) cabinet(glassM);
    // the TV on the west wall (big when you bought one), on a low unit; the games console under it
    const tvW = stuff.tv ? 1.9 : 1.1, tvH = tvW * 0.56;
    const tvZ = hasCab ? 0 : 0;
    const tvX = hasCab ? -W2 + 0.25 : -W2 + 0.25;
    if (!hasCab) {
      k.box(0.42, 0.45, 2.2, woodM, -W2 + 0.22, 0.225, tvZ, { cast: true });
      k.box(0.06, tvH, tvW, k.mat("#0c0d10", { roughness: 0.25, metalness: 0.4 }), -W2 + 0.08, 1.35, tvZ);
      k.plane(tvW - 0.06, tvH - 0.06, k.mat("#000000", { emissive: "#1e3a5c", emissiveIntensity: 0.6, roughness: 0.2 }), -W2 + 0.115, 1.35, tvZ, 0, Math.PI / 2);
      if (stuff.console) k.box(0.3, 0.07, 0.38, k.mat("#e8e8ea", { roughness: 0.4 }), -W2 + 0.22, 0.485, tvZ + 0.6);
      solids.push([-W2, -W2 + 0.45, tvZ - 1.12, tvZ + 1.12]);
    }
    void tvX;
    // the sofa facing the TV (or the cabinet), the coffee table, a rug
    const sx = hasCab ? 0.2 : 0.55;
    if (hasCab) solids.push(sofa(k, fabricM, 2.2, 0.2, 0.5, "n", woodM));
    else solids.push(sofa(k, fabricM, 2.3, sx, 0.25, "w", woodM));
    const tx = hasCab ? 0.2 : sx - 1.05, tz = hasCab ? -0.55 : 0.25;
    k.box(hasCab ? 1.1 : 0.55, 0.05, hasCab ? 0.55 : 1.1, woodM, tx, 0.42, tz, { cast: true });
    for (const a of [-1, 1]) for (const b of [-1, 1]) k.box(0.04, 0.4, 0.04, woodM, tx + a * (hasCab ? 0.5 : 0.22), 0.2, tz + b * (hasCab ? 0.22 : 0.5));
    solids.push(hasCab ? [tx - 0.6, tx + 0.6, tz - 0.32, tz + 0.32] : [tx - 0.32, tx + 0.32, tz - 0.6, tz + 0.6]);
    const rug = k.plane(Math.min(plan.w * 0.5, 3.2), Math.min(plan.d * 0.45, 2.8), k.mat(R.tier === "estate" ? "#6b2a2a" : R.tier === "villa" ? "#c9b48e" : "#7d6a58", { roughness: 1 }), hasCab ? 0.2 : -0.1, 0.006, 0.1, -Math.PI / 2);
    rug.receiveShadow = true; k.seen(rug);
    // the drinks fridge in the north-west corner: your KIB cans behind the glass (an empty lit fridge without)
    const fx = -W2 + 0.45, fz = -D2 + 0.4;
    if (!hasCab) {
      k.box(0.62, 1.5, 0.6, k.mat("#2a2d33", { roughness: 0.4, metalness: 0.5 }), fx + 0.05, 0.75, fz, { cast: true });
      k.plane(0.5, 1.3, k.mat("#000000", { emissive: "#bfe3ff", emissiveIntensity: 0.35, roughness: 0.2 }), fx + 0.05, 0.78, fz + 0.305);
      const n = Math.min(12, stuff.cans);
      if (n > 0) {
        const canG = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 10);
        const cans = new THREE.InstancedMesh(canG, k.mat("#d7263d", { roughness: 0.3, metalness: 0.7 }), n);
        const m = new THREE.Matrix4();
        for (let i = 0; i < n; i++) { m.makeTranslation(fx - 0.12 + (i % 4) * 0.1, 0.33 + Math.floor(i / 4) * 0.36, fz + 0.18); cans.setMatrixAt(i, m); }
        group.add(cans);
      }
      solids.push([fx - 0.3, fx + 0.38, fz - 0.35, fz + 0.35]);
    }
    // your art on the north wall (an empty frame waiting for one), a floor lamp, plants
    const artX = hasCab ? 0 : 0.6;
    if (!hasCab) {
      k.box(1.5, 1.0, 0.05, woodM, artX, 1.65, -D2 + 0.04);
      k.plane(1.36, 0.86, stuff.art ? k.mat("#c0603a", { roughness: 0.8, emissive: "#3a1a10", emissiveIntensity: 0.3 }) : k.mat("#efe9df", { roughness: 0.9 }), artX, 1.65, -D2 + 0.07);
      if (stuff.art) { k.box(0.5, 0.35, 0.01, k.mat("#2f5a7a", { roughness: 0.8 }), artX - 0.25, 1.75, -D2 + 0.075); k.box(0.3, 0.5, 0.01, k.mat("#e2b44a", { roughness: 0.8 }), artX + 0.35, 1.55, -D2 + 0.08); }
      k.glow(k.glowT, "#ffe0a8", 0.2, 2.0, 1.6, artX, 1.9, -D2 + 0.09, 0, 0);
    }
    if (!hasCab) {
      // the hero wall: your two shirts framed either side of the TV, in the club's colours
      framedShirt(k, env, inp.kits.home, "", woodM, -W2 + 0.04, 1.6, tvZ - 1.75, Math.PI / 2);
      framedShirt(k, env, inp.kits.away, "", woodM, -W2 + 0.04, 1.6, tvZ + 1.75, Math.PI / 2);
      k.glow(k.glowT, "#ffe0a8", 0.22, 5.2, 2.0, -W2 + 0.06, 1.7, tvZ, 0, Math.PI / 2);
      // club-colour cushions on the sofa, a club-colour throw over its arm
      const cushM = k.mat(inp.kits.home.shirt, { roughness: 0.95 });
      for (const dz of [-0.62, 0.62]) {
        const cu = new THREE.Mesh(roundedBox(THREE, 0.14, 0.36, 0.38, 0.06), cushM);
        cu.position.set(sx + 0.06, 0.66, 0.25 + dz); cu.rotation.set(0, 0, -0.22); cu.castShadow = true;
        group.add(cu);
      }
      const throwM = new THREE.Mesh(roundedBox(THREE, 0.42, 0.05, 0.34, 0.02), k.mat(inp.kits.home.trim, { roughness: 0.95 }));
      throwM.position.set(sx + 0.05, 0.47, 0.25 + 0.95); throwM.castShadow = true;
      group.add(throwM);
      // a wall shelf by the window: your watches and cans on show (empty stands for what you have not bought)
      const shx = W2 - 1.4, shz = D2 - 0.17;
      for (const y of [1.1, 1.55]) k.box(1.4, 0.04, 0.26, woodM, shx, y, shz, { cast: true });
      const gold = k.mat("#e2b44a", { roughness: 0.22, metalness: 1, envMapIntensity: 1.6 });
      const silver = k.mat("#d9dde2", { roughness: 0.2, metalness: 1, envMapIntensity: 1.6 });
      const stand = k.mat("#2b2b30", { roughness: 0.5 });
      ["smart", "gold", "luxury"].forEach((w, i) => {
        const x = shx - 0.45 + i * 0.45;
        k.box(0.12, 0.1, 0.08, stand, x, 1.17, shz);
        if (stuff.watches.includes(w as "smart" | "gold" | "luxury")) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 20), w === "smart" ? k.mat("#1b1d22", { roughness: 0.3 }) : w === "gold" ? gold : silver);
          ring.position.set(x, 1.25, shz); k.add(ring);
        }
      });
      const nCans = Math.min(5, stuff.cans);
      for (let i = 0; i < 5; i++) {
        const x = shx - 0.56 + i * 0.28;
        if (i < nCans) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.13, 12), k.mat(i % 2 ? "#e2b44a" : "#d7263d", { roughness: 0.3, metalness: 0.7 })); c.position.set(x, 1.635, shz); k.add(c); }
        else k.box(0.07, 0.01, 0.07, stand, x, 1.575, shz);
      }
      k.glow(k.glowT, "#ffe0a8", 0.18, 1.8, 1.2, shx, 1.35, D2 - 0.03, 0, Math.PI);
    }
    solids.push(floorLamp(k, metalM, W2 - 0.45, -D2 + 0.45, [[W2 - 0.03, 1.5, -D2 + 1.05, 0, -Math.PI / 2]]));
    solids.push(plant(k, potM, leafM, -W2 + 0.4, D2 - 0.4));
    if (R.chandelier) chandelier(k, metalM, H, 0, 0.3);
  } else if (id === "dressing") {
    shell = shellOf(k, env, R, plan, [{ wall: "e", c: -0.6, w: 1.2, y0: 0.9, y1: Math.min(H - 0.35, 2.3), view: R.view }]);
    const { metalM, glassM } = shell;
    const WP = wardPlan(W2, D2, H, Math.min(R.wardrobe, plan.d - 2.2));
    const ward = wardrobeSet(k, env, R, inp, W2, H, metalM, WP);
    solids.push(...ward.solids);
    keep.add(ward.garments);
    mirror = ward.mirror;
    if (mirror) keep.add(mirror);
    mirrorSpot = ward.mirrorSpot; mirrorFace = ward.mirrorFace;
    const { WARD, MIRROR } = WP;
    mirrorNear = (x, z) => x < -W2 + 3.2 && Math.abs(z - MIRROR.z) < 3.2;
    pickBox("wardrobe", WARD.depth + 0.1, WARD.h, MIRROR.z + MIRROR.w / 2 - WARD.z0 + 0.1, ward.wx, WARD.h / 2, (WARD.z0 + MIRROR.z + MIRROR.w / 2) / 2);
    zones.push((x, z) => (x < -W2 + 1.75 && z > WARD.z0 - 0.3 && z < MIRROR.z + 0.8 ? { spot: "wardrobe", front: [-W2 + WARD.depth, Math.max(WARD.z0, Math.min(MIRROR.z, z))] } : null));
    stands.wardrobe = () => ({ at: ward.mirrorSpot, face: ward.mirrorFace });
    shots.wardrobe = { cam: [Math.min(W2 - 0.35, -W2 + 3.4), 1.55, Math.min(D2 - 0.35, MIRROR.z + 1.0)], look: [-W2 + 0.3, 1.1, MIRROR.z + 0.15] };
    propJobs.push(() => ward.loadBoots(props, fitLen, () => alive));
    // the glass island: your watches and jewellery under glass (empty cushions for what you have not bought)
    const ix = 0.75, iz = -0.5, iw = 0.8, il = 1.6;
    k.box(iw, 0.82, il, woodM, ix, 0.41, iz, { cast: true });
    k.box(iw - 0.06, 0.02, il - 0.06, k.mat("#2b1e2a", { roughness: 0.9 }), ix, 0.835, iz);
    const top = k.box(iw, 0.14, il, glassM, ix, 0.91, iz);
    top.renderOrder = 3;
    for (const sx of [-1, 1]) k.box(0.02, 0.012, il - 0.1, k.glowM("#fff1d6", 1.8), ix + sx * (iw / 2 - 0.06), 0.975, iz);
    const goldM = k.mat("#e2b44a", { roughness: 0.22, metalness: 1, envMapIntensity: 1.6 });
    const silverM = k.mat("#d9dde2", { roughness: 0.2, metalness: 1, envMapIntensity: 1.6 });
    const cushion = k.mat("#4a3346", { roughness: 1 });
    const slotsZ = [-0.55, -0.18, 0.18, 0.55];
    const items: (null | ((x: number, z: number) => void))[] = [
      stuff.watches.includes("smart") ? (x, z) => { k.box(0.07, 0.015, 0.08, k.mat("#1b1d22", { roughness: 0.3 }), x, 0.855, z); k.box(0.05, 0.003, 0.06, k.glowM("#4aa3ff", 1.6), x, 0.864, z); } : null,
      stuff.watches.includes("gold") ? (x, z) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), goldM); r.rotation.x = Math.PI / 2; r.position.set(x, 0.855, z); group.add(r); k.box(0.06, 0.016, 0.06, goldM, x, 0.86, z); } : null,
      stuff.watches.includes("luxury") ? (x, z) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), silverM); r.rotation.x = Math.PI / 2; r.position.set(x, 0.855, z); group.add(r); k.box(0.06, 0.016, 0.06, k.mat("#1c3a6b", { roughness: 0.1, metalness: 0.6 }), x, 0.86, z); } : null,
      stuff.jewellery.length ? (x, z) => { for (let i = 0; i < stuff.jewellery.length; i++) { const j = stuff.jewellery[i]; const r = new THREE.Mesh(new THREE.TorusGeometry(0.07 - i * 0.015, 0.006, 6, 24), j === "diamond" ? k.mat("#f2f6ff", { roughness: 0.05, metalness: 0.3, emissive: "#9ab4ff", emissiveIntensity: 0.25 }) : silverM); r.rotation.x = Math.PI / 2; r.position.set(x, 0.852 + i * 0.004, z); group.add(r); } } : null,
    ];
    slotsZ.forEach((dz, i) => {
      k.box(0.16, 0.02, 0.16, cushion, ix, 0.845, iz + dz);
      items[i]?.(ix, iz + dz);
    });
    solids.push([ix - iw / 2 - 0.02, ix + iw / 2 + 0.02, iz - il / 2 - 0.02, iz + il / 2 + 0.02]);
    // your suit on a stand by the window (an empty stand without)
    const stx = W2 - 0.5, stz = -D2 + 0.55;
    k.box(0.04, 1.2, 0.04, metalM, stx, 0.6, stz);
    k.box(0.32, 0.03, 0.32, metalM, stx, 0.015, stz);
    if (stuff.suit) {
      k.box(0.46, 0.66, 0.24, k.mat("#1f2430", { roughness: 0.8 }), stx, 1.38, stz, { cast: true });
      k.box(0.1, 0.3, 0.01, k.mat("#f4efe6", { roughness: 0.8 }), stx, 1.55, stz + 0.125);
    } else k.box(0.42, 0.08, 0.06, metalM, stx, 1.68, stz);
    solids.push([stx - 0.28, stx + 0.28, stz - 0.25, stz + 0.25]);
    // a pouffe, a plant
    k.box(0.5, 0.42, 0.5, fabricM, -0.2, 0.21, D2 - 1.3, { cast: true });
    solids.push([-0.45, 0.05, D2 - 1.55, D2 - 1.05]);
    solids.push(plant(k, potM, leafM, W2 - 0.4, D2 - 0.4));
    if (R.chandelier) chandelier(k, metalM, H, 0.4, -0.2);
  } else if (id === "trophy") {
    shell = shellOf(k, env, R, plan, []);
    const { metalM, glassM } = shell;
    cabinet(glassM);
    // both kits framed on the side walls, a spotlight on each
    framedShirt(k, env, inp.kits.home, "", woodM, -W2 + 0.04, 1.55, -0.2, Math.PI / 2);
    framedShirt(k, env, inp.kits.away, "", woodM, W2 - 0.04, 1.55, -0.2, -Math.PI / 2);
    k.glow(k.glowT, "#ffe0a8", 0.3, 1.8, 2.2, -W2 + 0.07, 1.6, -0.2, 0, Math.PI / 2);
    k.glow(k.glowT, "#ffe0a8", 0.3, 1.8, 2.2, W2 - 0.07, 1.6, -0.2, 0, -Math.PI / 2);
    // the Ballon d'Or on a plinth in the middle (an empty one that waits for it)
    const bd = inp.slots.find((s) => s.name === "Ballon d'Or");
    const bx = W2 - 1.25, bz = 0.75;
    solids.push(plinth(k, k.mat("#1a1a1e", { roughness: 0.3, metalness: 0.4 }), bx, bz, 0.5, 0.85));
    const g = trophyGeo(THREE, "ball").map(cleanGeo);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(bx, 0.89, bz), new THREE.Quaternion(), new THREE.Vector3(1.9, 1.9, 1.9));
    for (const x of g) x.applyMatrix4(m);
    const won = !!bd?.won;
    const ball = new THREE.Mesh(env.mergeGeometries(g), won ? k.mat("#e2b44a", { roughness: 0.22, metalness: 1, envMapIntensity: 1.6 }) : new THREE.MeshBasicMaterial({ color: "#fff4dc", transparent: true, opacity: 0.12, depthWrite: false }));
    for (const x of g) x.dispose();
    group.add(ball);
    keep.add(ball);
    k.glow(k.glowT, "#ffe9b8", won ? 0.35 : 0.15, 1.6, 1.6, bx, H - 0.02, bz, Math.PI / 2, 0);
    k.glow(k.patchT, "#ffe9b8", won ? 0.22 : 0.1, 1.4, 1.4, bx, 0.008, bz, -Math.PI / 2, 0);
    // a bench by the door to sit and look at it all, plants in the far corners
    k.box(1.3, 0.42, 0.45, k.mat("#3a2c22", { roughness: 0.6 }), -W2 + 1.0, 0.21, D2 - 0.35, { cast: true });
    solids.push([-W2 + 0.3, -W2 + 1.7, D2 - 0.6, D2]);
    solids.push(plant(k, potM, leafM, -W2 + 0.4, -D2 + 0.4));
    solids.push(plant(k, potM, leafM, W2 - 0.4, -D2 + 0.4));
    if (R.chandelier) chandelier(k, metalM, H, -0.6, 0.5);
  } else {
    // the villa's and estate's rooms, the penthouse terrace, the flat's nook
    const ctx: Ctx = {
      k, env, inp, R, plan, W2, D2, H, stuff, solids, props, keep, fitLen, propJobs, alive: () => alive,
      wood, woodM, fabricM, potM, leafM, plinthM,
    };
    const make: Partial<Record<RoomId, (c: Ctx) => ReturnType<typeof shellOf>>> = {
      garage: buildGarage, games: buildGames, cinema: buildCinema, gym: buildGym,
      gardenTerrace: buildGardenTerrace, terrace: buildPenthouseTerrace, nook: buildNook,
    };
    const f = make[id];
    if (f) shell = f(ctx);
    else {
      // a room with nothing built for it yet: an honest bare room with plinths, so a tier never breaks
      shell = shellOf(k, env, R, plan, []);
      for (const [x, z] of [[-W2 + 1, -D2 + 1], [W2 - 1, -D2 + 1]] as XZ[]) solids.push(plinth(k, plinthM, x, z));
    }
    if (R.chandelier && (id === "cinema" || id === "gym" || id === "nook")) chandelier(k, shell.metalM, H, 0, id === "cinema" ? 1.0 : 0.2);
  }

  for (const gl of k.flushGlows(env.mergeGeometries)) keep.add(gl);
  const frozen = freezeStatic(THREE, env.mergeGeometries, group, new Set(Array.from(keep).concat(pickables).filter(Boolean)));
  const front = plan.doors[0];
  const start = front ? { x: front.x + front.nx * 1.0, z: front.z + front.nz * 1.0, yaw: Math.atan2(front.nx, front.nz) } : { x: 0, z: 0, yaw: Math.PI };

  const room: BuiltRoom = {
    id, plan, w2: W2, d2: D2, h: H, group, solids, pickables,
    doors: plan.doors.filter((d) => d.to !== "garden" || env.doorOpen),
    zoneAt: (x, z) => { for (const f of zones) { const r = f(x, z); if (r) return r; } return null; },
    standFor: (s, p) => stands[s]?.(p) ?? { at: p, face: [p[0], p[1] - 1] },
    shotOf: (s) => shots[s] ?? { cam: [0, 1.6, D2 - 0.4], look: [0, 1, -D2] },
    get mirror() { return mirror; },
    mirrorSpot, mirrorFace,
    mirrorNear: (x, z) => mirrorNear(x, z),
    dropMirror: () => { if (mirror) { mirror.parent?.remove(mirror); mirror.dispose?.(); mirror = null; } },
    start,
    frozen,
    loadProps: async () => { await Promise.all(propJobs.flatMap((f) => f())); },
    dispose: () => { alive = false; disposeGroup(group); mirror = null; },
  } as BuiltRoom;
  return room;
}
