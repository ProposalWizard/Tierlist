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
import { roomPlan, carsIn, NO_STUFF, ROOM_LABEL, type DoorPlan, type HomeSpot, type HomeStuff, type RoomPlan, type Wall } from "./rooms";
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
  const doorView = new THREE.MeshBasicMaterial({ map: tex(viewCanvas("garden")), fog: false });
  plane(5, 4, doorView, 0, 1.6, D2 + 2.2, 0, Math.PI);
  winFrame("x", D2, -1, { c: 0, w: DOOR.half * 2, y0: 0.0001, y1: DOOR.h }, false);
  const signM = new THREE.MeshBasicMaterial({ map: tex(signCanvas(env.doorOpen ? "GARDEN" : "HOME")), transparent: true });
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
const ROOM_LOOK: Partial<Record<RoomId, { wall?: string; floor?: RoomPreset["floor"]; panelled?: boolean; dark?: boolean }>> = {
  hallway: {},
  trophy: { wall: "#2c3442", dark: true },
  cinema: { wall: "#2a2026", floor: "carpet", dark: true },
  games: { wall: "#3a4a3e" },
  gym: { wall: "#d9dcdf", floor: "boards" },
  garage: { wall: "#bfc3c6", floor: "stone" },
};

/**
 * The shell of a new room: floor, walls with its doorways and windows, the
 * ceiling, skirting, cornice, panelling on the grand tiers, frames and glass,
 * what is beyond each doorway (the garden, or the next room's sign).
 */
function shellOf(k: Kit, env: RoomEnv, R: RoomPreset, plan: RoomPlan, wins: WinSpec[], o: { ceiling?: boolean } = {}) {
  const { THREE } = k;
  const W2 = plan.w / 2, D2 = plan.d / 2, H = plan.h;
  const look = ROOM_LOOK[plan.id] ?? {};
  const floorKind = look.floor ?? R.floor;
  const tile = floorKind === "marble" || floorKind === "stone" ? 2.2 : 1.6;
  const floorM = k.mat("#ffffff", { map: k.tex(floorCanvas(floorKind), [plan.w / tile, plan.d / tile]), roughness: floorKind === "carpet" ? 0.95 : floorKind === "marble" ? 0.18 : floorKind === "stone" ? 0.5 : 0.42 });
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
  for (const wl of ["n", "s", "e", "w"] as Wall[]) {
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

/** A sofa (seat, back, arms) facing `ry`, its middle at (x, z). Its footprint. */
function sofa(k: Kit, fabricM: any, len: number, x: number, z: number, facing: "w" | "n" | "s"): Box2 {
  const d = 0.85;
  const g = new k.THREE.Group();
  const add = (w: number, h: number, dd: number, lx: number, ly: number, lz: number) => k.box(w, h, dd, fabricM, lx, ly, lz, { cast: true, parent: g });
  add(len, 0.42, d, 0, 0.21, 0);
  add(len, 0.5, 0.2, 0, 0.62, d / 2 - 0.1);
  add(0.18, 0.28, d, -len / 2 + 0.09, 0.56, 0);
  add(0.18, 0.28, d, len / 2 - 0.09, 0.56, 0);
  // facing south by default (the back on +z ... turned so the seat faces `facing`)
  g.rotation.y = facing === "n" ? 0 : facing === "s" ? Math.PI : Math.PI / 2;
  g.position.set(x, 0, z);
  flattenInto(k, g);
  const along = facing === "w";
  return along ? [x - d / 2, x + d / 2, z - len / 2, z + len / 2] : [x - len / 2, x + len / 2, z - d / 2, z + d / 2];
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
    if (hasCab) solids.push(sofa(k, fabricM, 2.2, 0.2, 0.5, "n"));
    else solids.push(sofa(k, fabricM, 2.3, sx, 0.25, "w"));
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
      for (const dz of [-0.6, 0.6]) k.box(0.14, 0.34, 0.38, k.mat(inp.kits.home.shirt, { roughness: 0.95 }), sx + 0.22, 0.6, 0.25 + dz, { cast: true });
      k.box(0.5, 0.06, 0.3, k.mat(inp.kits.home.trim, { roughness: 0.95 }), sx, 0.44, 0.25 + 1.0);
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
    // the villa and estate rooms (to come): an honest bare room with plinths, so a tier never breaks
    shell = shellOf(k, env, R, plan, []);
    const { metalM } = shell;
    for (const [x, z] of [[-W2 + 1, -D2 + 1], [W2 - 1, -D2 + 1]] as XZ[]) solids.push(plinth(k, plinthM, x, z));
    if (R.chandelier) chandelier(k, metalM, H, 0, 0);
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
