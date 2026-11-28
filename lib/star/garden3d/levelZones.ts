/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE GARDEN'S NEW AREAS, IN 3D — what each garden level opens (../gardenLevels.ts), built into the garden scene
 * (./scene.ts) when the garden-levels setting is on (./levelsFlag.ts). The plan is ./levelLayout.ts; the riding
 * maths ./riding.ts. Level 1 builds nothing: the garden is exactly as it was.
 *
 *   - level 2: a farm gate in the west wall, a gravel lane, a yard, a timber stable (two stalls, a tack room,
 *     a slate roof), the paddock with a water trough and a mounting block, and your horse grazing in it
 *     (your own casino horse, else the stable's horse). Walk up to him: "Ride".
 *   - level 3: the field gate opens: the riding field, five jumps (red and white rails on timber wings), four
 *     bending poles, a start / finish arch; the next gate shows a gold marker; a lap has a clock and a best.
 *   - level 4: a dirt race track round the field with white rails and its own finish line.
 *   - level 5: signposts by the west gate and the field gate: fast travel to your house, the garden or the field.
 *
 * Riding (Harry: "ridable horses"): the same stick as walking (a small push walks, more trots, full canters),
 * the Gallop button (or Shift) gallops; the camera follows from higher and further back; "Get off" dismounts.
 * Mount and dismount are a short fade, so no body ever passes through the horse (RUL-3D-005); on the horse you
 * sit ON the saddle: seated clip, legs opened round the horse's barrel and into the stirrups, hands forward on
 * the reins (checked by tests/star/gardenLevels.mts's pose numbers and the stills).
 *
 * Cheap on purpose (Harry, 28 Nov 2026: "everything including 3D has to run as smoothly as possible in every
 * scenario", the Galaxy S20): every still piece of an area is joined by material into ONE draw per area
 * (yard + stable, paddock, field, track, signposts), the rails and poles that move are instanced (one draw
 * each), the new trees go into their own plant zones (one draw a zone), the horse casts no shadow (a soft blob).
 * Areas far behind the camera are left out by three's own frustum test, which works because each area's box is
 * tight. Budget: lib/star/garden3d/gardenBudget.ts (Medium ≤ 90 draws, ≤ 80k triangles from anywhere).
 */
import {
  AXIS_Z, BARN, COURSE, FIELD, FIELD_GATE_X, GATE_HALF, HORSE_HOME, LANE, PADDOCK2, PADDOCK_GATE_X, SIGNPOSTS,
  TRACK, TRACK_GATES, TRAVEL, WEST_GATE, YARD, ZONE_A, clampToRects, clearedRects, inRect, jumpBoxes, pushOut,
  passedWaypoint, rideRects, roomAlong, solidBoxes, trackPoint, walkRects, type Rect,
} from "./levelLayout";
import {
  GAIT_SPEED, gaitAt, gaitFor, drain, lapClock, newLap, stepLap, stepSpeed, turnRate, jumpResult, offSquare,
  type LapState, type LapEvent,
} from "./riding";
import { gardenChip, gardenLevelOf, GARDEN_LEVELS } from "../gardenLevels";
import { boardsCanvas, gravelCanvas, hedgeCanvas, slateCanvas, stripeCanvas, strawCanvas } from "./textures";
import { hiddenBehind, type PlantStyle } from "./plantZones";
import type { Person3D } from "../people3d";
import { RIDE_POSE, carryTack, makeRideHorse, riderCheck, seatRider, type HorseRig } from "./rideHorse";
import type { Quality3d } from "../three3d/quality";


export interface GardenLevelsOpt {
  /** Total garden XP (../gardenLevels.ts). The level comes from it. */
  xp: number;
  /** The horse you ride: your own (mine), else the stable's. */
  horse: { name: string; energy: number; mine: boolean };
  /** Best lap times (ms). */
  bestCourse?: number;
  bestTrack?: number;
}

export interface RideReport { energy: number; laps: { kind: "course" | "track"; ms: number }[] }

export interface ZoneDeps {
  THREE: any;
  scene: any;
  container: HTMLElement;
  tier: Quality3d;
  load: (url: string) => Promise<any>;
  SkeletonUtils: any;
  mergeGeometries: (g: any[]) => any;
  plantStyle: PlantStyle;
  cardMaterial: any | null;
  blobTex: any;
  night: boolean;
  dbg: URLSearchParams;
  /** The garden wall's height (m): what it hides from out in the new areas. */
  wallTop: number;
}

export interface ZoneCallbacks {
  /** A ride ended (dismount, or the garden closed while riding): put it on the career. */
  onRide?: (r: RideReport) => void;
  /** The signpost: your house. */
  onHouse?: () => void;
}

export type ExtSpot = "ride" | "signpost" | "locked";

/** What the garden scene asks of the new areas each frame. */
export interface LevelZones {
  level: number;
  /** The gap in the garden's west wall (null below level 2). */
  westGate: { z0: number; z1: number } | null;
  /** The old garden's trees and bushes standing here are not planted (they would stand in the new areas). */
  clears: (x: number, z: number) => boolean;
  /** On foot: inside the new areas (and the passage through the gate)? */
  inside: (x: number, z: number) => boolean;
  /** On foot: (x, z) kept inside the garden and the new areas, out of their fences; `garden` clamps the garden part. */
  clamp: (x: number, z: number, r: number, garden: (x: number, z: number) => [number, number]) => [number, number];
  /** The tap-walk's map size [x0, x1, z0, z1]. */
  bounds: Rect;
  /** The camera's room along a line (m), in the new areas; null when (x, z) is in the old garden. */
  room: (x: number, z: number, dx: number, dz: number) => number | null;
  /** The thing you stand by in the new areas (its card is drawn by this module). */
  spot: () => ExtSpot | null;
  /** The rider, once the garden has made him (people3d only: the old body cannot ride). */
  attachRider: (r: { person: Person3D; player: any; zeroLegs: (dt: number) => void; place: (x: number, z: number, yaw: number) => void }) => void;
  riding: () => boolean;
  /** While riding: one frame of the horse (the stick's push 0-1, the yaw it asks for, gallop held). */
  ride: (dt: number, push: number, wantYaw: number | null, gallop: boolean) => void;
  /** After the rider's mixer has run: sit him on the horse. */
  poseRider: () => void;
  /** The horse's ground speed and heading (for the camera). */
  speed: () => number;
  yaw: () => number;
  /** Where the camera should centre (the rider's position on the ground). */
  at: () => [number, number];
  /** Camera D, raised and pulled back while riding (mutates the follow-cam numbers). */
  camAdjust: (cs: { height: number; back: number; lookY: number; lookAhead: number }) => void;
  /** Every frame: the horse at rest, the marker, the plant zones' detail. */
  update: (dt: number, camera: any, px: number, pz: number) => void;
  /** Out in the new areas: the garden's own meshes the west wall hides from this camera (left out of the picture;
   *  three3d/tightCull.ts extraHide). Empty while the camera is in the garden. */
  behindWall: (camera: any) => any[];
  /** Meshes that move (left out of the garden's still-piece joining and its tight culling). */
  movers: any[];
  /** For tests and filming. */
  test: {
    mount: () => boolean;
    dismount: () => void;
    setGallop: (on: boolean) => void;
    /** Ride a route by itself: [x, z, stick push 0-1, gallop 0/1] waypoints (null: back to the stick). */
    autopilot: (route: [number, number, number, number][] | null) => void;
    state: () => Record<string, unknown>;
    travel: (to: "garden" | "field" | "paddock" | "house") => void;
    horseAt: (x: number, z: number, yaw: number) => void;
    /** The garden scene (measuring only). */
    scene: () => any;
  };
  dispose: () => void;
}

export async function buildLevelZones(d: ZoneDeps, opt: GardenLevelsOpt, cb: ZoneCallbacks): Promise<LevelZones | null> {
  const { THREE, scene } = d;
  const level = gardenLevelOf(opt.xp).level;
  if (level < 2) return null;

  // ── materials (each shared by every piece of its kind, so an area joins into a few draws) ──
  const tex = (c: HTMLCanvasElement, rep?: [number, number]) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (rep) t.repeat.set(rep[0], rep[1]);
    return t;
  };
  const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
  const M = {
    gravel: mat("#ffffff", { map: tex(gravelCanvas("#c9b48f")), roughness: 1 }),
    dirt: mat("#ffffff", { map: tex(gravelCanvas("#9c7a55")), roughness: 1 }),
    paddock: mat("#7f9446", { roughness: 1 }),
    field: mat("#ffffff", { map: tex(stripeCanvas("#7ea24b", "#73963f")), roughness: 1 }),
    white: mat("#f4f1ea", { roughness: 0.6 }),
    timber: mat("#d9cbbd", { map: tex(boardsCanvas("#8a6448")), roughness: 0.8 }), // weathered timber, not orange
    darkTimber: mat("#5c3d27", { roughness: 0.8 }),
    slate: mat("#ffffff", { map: tex(slateCanvas()), roughness: 0.75 }),
    hedge: mat("#ffffff", { map: tex(hedgeCanvas("#33612a")), roughness: 0.95 }),
    straw: mat("#ffffff", { map: tex(strawCanvas()), roughness: 1 }),
    stone: mat("#b9b1a3", { roughness: 0.9 }),
    water: mat("#4d7f9a", { roughness: 0.15, metalness: 0.1 }),
    red: mat("#c8102e", { roughness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({ color: "#facc15", emissive: "#a87d00", emissiveIntensity: d.night ? 0.9 : 0.45, roughness: 0.4 }),
    leather: mat("#4a2b18", { roughness: 0.55 }),
    cloth: mat("#1d2a44", { roughness: 0.9 }),
    steel: mat("#c9ccd1", { roughness: 0.3, metalness: 0.8 }),
  };
  const piece = (geo: any, m: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); return me; };
  // the repeat goes into each piece's own UVs (every piece shares one material)
  const tile = (g: any, ru: number, rv: number) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); return g; };

  /** One area's still pieces, joined by material. */
  const area = (name: string) => {
    const byMat = new Map<any, any[]>();
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    const put = (geo: any, m: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      g.applyMatrix4(m4.compose(v.set(x, y, z), q.setFromEuler(e.set(rx, ry, rz)), sc));
      for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m)!.push(g);
    };
    const box = (w: number, h: number, dd: number, m: any, x: number, y: number, z: number, ry = 0, texTile = 0) => {
      const g = new THREE.BoxGeometry(w, h, dd);
      if (texTile) tile(g, Math.max(w, dd) / texTile, h / texTile);
      put(g, m, x, y, z, 0, ry);
    };
    const ground = (r: Rect, m: any, y: number, tileM: number) => {
      const g = new THREE.PlaneGeometry(r[1] - r[0], r[3] - r[2]);
      tile(g, (r[1] - r[0]) / tileM, (r[3] - r[2]) / tileM);
      put(g, m, (r[0] + r[1]) / 2, y, (r[2] + r[3]) / 2, -Math.PI / 2);
    };
    const group = new THREE.Group();
    group.name = `garden-level-${name}`;
    const done = () => {
      byMat.forEach((list, m) => {
        const me = new THREE.Mesh(d.mergeGeometries(list), m);
        me.castShadow = m !== M.gravel && m !== M.dirt && m !== M.paddock && m !== M.field && m !== M.water;
        me.receiveShadow = true;
        me.name = `${name}-${m.name || "part"}`;
        me.userData.noBake = true;
        group.add(me);
      });
      scene.add(group);
      return group;
    };
    return { put, box, ground, done, group };
  };

  /** A post-and-rail fence along a line (white or timber), with optional gaps [from, to] along it. */
  const fence = (a: ReturnType<typeof area>, x0: number, z0: number, x1: number, z1: number, m: any, gaps: [number, number][] = [], h = 1.25, rails = 3) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    const ry = Math.atan2(-uz, ux);
    const runs: [number, number][] = [];
    let s = 0;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) { if (g0 > s) runs.push([s, g0]); s = g1; }
    if (s < len) runs.push([s, len]);
    for (const [r0, r1] of runs) {
      const n = Math.max(1, Math.round((r1 - r0) / 2.6));
      for (let k = 0; k <= n; k++) {
        const t = r0 + ((r1 - r0) * k) / n;
        a.box(0.13, h + 0.1, 0.13, m, x0 + ux * t, (h + 0.1) / 2, z0 + uz * t);
      }
      const mid = (r0 + r1) / 2;
      for (let i = 0; i < rails; i++) a.box(r1 - r0, 0.09, 0.05, m, x0 + ux * mid, h * (0.35 + (0.65 * i) / Math.max(1, rails - 1)) - 0.05, z0 + uz * mid, ry);
    }
  };
  /** A clipped hedge along a line. */
  const hedge = (a: ReturnType<typeof area>, x0: number, z0: number, x1: number, z1: number, gaps: [number, number][] = []) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    const ry = Math.atan2(-uz, ux);
    let s = 0;
    const runs: [number, number][] = [];
    for (const [g0, g1] of gaps) { if (g0 > s) runs.push([s, g0]); s = g1; }
    if (s < len) runs.push([s, len]);
    for (const [r0, r1] of runs) a.box(r1 - r0, 1.7, 0.9, M.hedge, x0 + ux * (r0 + r1) / 2, 0.85, z0 + uz * (r0 + r1) / 2, ry, 1.6);
  };
  /** A small sign board with words on it (canvas), on two legs. */
  const signTex = (lines: string[], w = 512, h = 256, bg = "#2a1d12", ink = "#f7f1e8") => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d")!;
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#facc15"; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = ink; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((l, i) => { g.font = `900 ${i === 0 ? 64 : 46}px system-ui, sans-serif`; g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 76); });
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  };
  const signs: any[] = [];
  const sign = (lines: string[], x: number, z: number, ry: number, wM = 1.5) => {
    const g = new THREE.Group();
    const board = new THREE.Mesh(new THREE.PlaneGeometry(wM, wM / 2), new THREE.MeshStandardMaterial({ map: signTex(lines), roughness: 0.7 }));
    board.position.y = 1.35; g.add(board);
    const back = new THREE.Mesh(new THREE.BoxGeometry(wM + 0.08, wM / 2 + 0.08, 0.05), M.darkTimber); back.position.set(0, 1.35, -0.03); g.add(back);
    for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.08), M.darkTimber); leg.position.set(sx * wM * 0.4, 0.55, -0.03); g.add(leg); }
    g.position.set(x, 0, z); g.rotation.y = ry;
    scene.add(g); signs.push(g);
    return g;
  };

  // ── LEVEL 2: the gate, the lane, the yard, the stable, the paddock ──
  const A = area("paddock");
  // the lane from the garden's west gate, gravel, with a low timber fence each side
  A.ground([LANE[0] - 0.3, LANE[1] + 0.1, LANE[2], LANE[3]], M.gravel, 0.013, 2.2);
  fence(A, LANE[1], LANE[2] - 0.05, LANE[0], LANE[2] - 0.05, M.timber, [], 1.0, 2);
  fence(A, LANE[1], LANE[3] + 0.05, LANE[0], LANE[3] + 0.05, M.timber, [], 1.0, 2);
  // the farm gate in the garden wall, its two leaves swung open into the lane
  const gw = (WEST_GATE.z1 - WEST_GATE.z0) / 2;
  for (const [zEnd, sgn] of [[WEST_GATE.z0, 1], [WEST_GATE.z1, -1]] as [number, number][]) {
    A.box(0.22, 1.9, 0.22, M.darkTimber, WEST_GATE.x - 0.05, 0.95, zEnd - sgn * 0.12);
    const leaf = new THREE.Group();
    for (let i = 0; i < 4; i++) leaf.add(piece(new THREE.BoxGeometry(gw, 0.08, 0.05), M.white, gw / 2, 0.3 + i * 0.3, 0));
    leaf.add(piece(new THREE.BoxGeometry(Math.hypot(gw, 0.9), 0.07, 0.05), M.white, gw / 2, 0.75, 0, 0, 0, Math.atan2(0.9, gw) * sgn));
    leaf.position.set(WEST_GATE.x - 0.1, 0, zEnd);
    // open: swung 100 degrees out of the garden, flat against the lane's fences
    leaf.rotation.y = Math.PI - sgn * 0.15; // pointing west down the lane, each leaf just off its fence
    leaf.updateMatrixWorld(true);
    leaf.traverse((o: any) => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); A.put(g, o.material, 0, 0, 0); } });
  }
  // the yard and the stable
  A.ground(YARD, M.gravel, 0.012, 2.4);
  A.ground([PADDOCK2[0], PADDOCK2[1], PADDOCK2[2], PADDOCK2[3]], M.paddock, 0.009, 4);
  {
    const b = BARN, w = b.x1 - b.x0, dd = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    // walls: timber boards on a stone plinth; the front (south) has two stable doors (top halves open) and the tack room door
    A.box(w + 0.2, 0.45, dd + 0.2, M.stone, cx, 0.22, cz);
    A.box(w, b.h - 0.45, 0.16, M.timber, cx, 0.45 + (b.h - 0.45) / 2, b.z0 + 0.08, 0, 1.2);
    A.box(0.16, b.h - 0.45, dd, M.timber, b.x0 + 0.08, 0.45 + (b.h - 0.45) / 2, cz, 0, 1.2);
    A.box(0.16, b.h - 0.45, dd, M.timber, b.x1 - 0.08, 0.45 + (b.h - 0.45) / 2, cz, 0, 1.2);
    // front: posts and panels round three openings
    const doors = [cx - 2.8, cx, cx + 2.8];
    const fz = b.z1 - 0.08;
    const span = [b.x0, ...doors.flatMap((x) => [x - 0.75, x + 0.75]), b.x1];
    for (let i = 0; i < span.length; i += 2) A.box(span[i + 1] - span[i], b.h - 0.45, 0.16, M.timber, (span[i] + span[i + 1]) / 2, 0.45 + (b.h - 0.45) / 2, fz, 0, 1.2);
    doors.forEach((x, i) => {
      A.box(1.5, b.h - 2.6, 0.16, M.timber, x, 2.6 + (b.h - 2.6) / 2, fz, 0, 1.2); // over the door
      A.box(1.5, 1.25, 0.1, M.darkTimber, x, 0.45 + 0.62, fz + 0.04); // the bottom half of a stable door, shut
      A.box(1.62, 0.1, 0.18, M.white, x, 2.62, fz + 0.04); // white trim
      A.box(0.1, 2.2, 0.18, M.white, x - 0.8, 1.55, fz + 0.04); A.box(0.1, 2.2, 0.18, M.white, x + 0.8, 1.55, fz + 0.04);
      if (i === 2) A.box(1.4, 1.1, 0.06, M.darkTimber, x, 1.75, fz - 0.05); // the tack room's top half shut
      else A.box(1.4, 1.1, 0.02, mat("#150e09"), x, 1.75, fz - 0.12); // dark inside the open stalls
    });
    // the roof: two slopes of slate, gable ends of timber, a ridge
    const rise = b.ridge - b.h, half = dd / 2 + 0.35, slope = Math.hypot(half, rise), ang = Math.atan2(rise, half);
    for (const s of [-1, 1]) {
      const g = new THREE.BoxGeometry(w + 0.7, 0.12, slope);
      tile(g, (w + 0.7) / 2.2, slope / 2.2);
      A.put(g, M.slate, cx, b.h + rise / 2, cz + s * half / 2, s * ang, 0, 0);
    }
    A.box(w + 0.75, 0.16, 0.2, M.darkTimber, cx, b.ridge + 0.04, cz);
    for (const x of [b.x0 + 0.08, b.x1 - 0.08]) {
      const sh = new THREE.Shape(); sh.moveTo(-dd / 2, 0); sh.lineTo(dd / 2, 0); sh.lineTo(0, rise); sh.lineTo(-dd / 2, 0);
      const g = new THREE.ShapeGeometry(sh); tile(g, 1 / 1.2, 1 / 1.2);
      A.put(g, M.timber, x, b.h, cz, 0, (x < cx ? -1 : 1) * Math.PI / 2, 0);
    }
    // a lantern over each stall door and the horse's name board over his stall
    for (const x of doors.slice(0, 2)) A.box(0.18, 0.28, 0.18, M.gold, x, 2.95, fz + 0.18);
    const nb = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), new THREE.MeshStandardMaterial({ map: signTex([opt.horse.name], 512, 154), roughness: 0.7 }));
    nb.position.set(doors[0], 3.2, fz + 0.1); scene.add(nb); signs.push(nb);
    // hay bales stacked by the tack room, a mounting block and a water trough by the paddock gate
    for (const [x, y, z] of [[b.x1 + 0.9, 0.3, b.z1 - 0.6], [b.x1 + 0.9, 0.3, b.z1 - 1.75], [b.x1 + 0.9, 0.9, b.z1 - 1.2]] as [number, number, number][]) A.box(1.1, 0.58, 1.05, M.straw, x, y, z);
    A.box(1.2, 0.55, 0.6, M.stone, -35.7, 0.27, 3.55);
    A.box(1.0, 0.06, 0.45, M.water, -35.7, 0.5, 3.55);
    A.box(0.7, 0.3, 0.9, M.stone, -38.6, 0.15, AXIS_Z - 2.4); A.box(0.7, 0.3, 0.6, M.stone, -38.6, 0.45, AXIS_Z - 2.55); // two-step block
  }
  // fences: zone A's perimeter (white post and rail), the paddock's east fence with its gate on the axis
  const gap: [number, number] = [0, 0];
  const onAxis = (from: number, dir: 1 | -1, z0: number): [number, number] => { gap[0] = (AXIS_Z - GATE_HALF - z0) * dir; void from; return [Math.min((AXIS_Z - GATE_HALF - z0) * dir, (AXIS_Z + GATE_HALF - z0) * dir), Math.max((AXIS_Z - GATE_HALF - z0) * dir, (AXIS_Z + GATE_HALF - z0) * dir)]; };
  fence(A, ZONE_A[1], ZONE_A[2], ZONE_A[0], ZONE_A[2], M.white); // north
  fence(A, ZONE_A[1], ZONE_A[3], ZONE_A[0], ZONE_A[3], M.white); // south
  fence(A, ZONE_A[1], ZONE_A[2], ZONE_A[1], ZONE_A[3], M.white, [onAxis(0, 1, ZONE_A[2])]); // east (the lane comes in)
  fence(A, PADDOCK_GATE_X, ZONE_A[2], PADDOCK_GATE_X, ZONE_A[3], M.white, [onAxis(0, 1, ZONE_A[2])]); // the paddock's east side
  fence(A, FIELD_GATE_X, ZONE_A[2], FIELD_GATE_X, ZONE_A[3], M.white, [onAxis(0, 1, ZONE_A[2])]); // west: the field gate
  // the field gate: shut (a five-bar gate) until level 3, open (swung back against the fence) from level 3
  {
    const leaf = new THREE.Group();
    const wq = GATE_HALF * 2;
    for (let i = 0; i < 5; i++) leaf.add(piece(new THREE.BoxGeometry(0.05, 0.08, wq), M.white, 0, 0.25 + i * 0.22, wq / 2));
    leaf.add(piece(new THREE.BoxGeometry(0.05, 0.07, Math.hypot(wq, 0.9)), M.white, 0, 0.7, wq / 2, Math.atan2(0.9, wq), 0, 0));
    leaf.position.set(FIELD_GATE_X, 0, AXIS_Z - GATE_HALF);
    if (level >= 3) leaf.rotation.y = -Math.PI / 2 - 0.12; // open into the field
    leaf.updateMatrixWorld(true);
    leaf.traverse((o: any) => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); A.put(g, o.material, 0, 0, 0); } });
  }
  A.done();
  if (level < 3) sign(["🔒 Riding field", `Garden level 3`], FIELD_GATE_X + 0.6, AXIS_Z + GATE_HALF + 1.3, Math.PI / 2, 1.6);

  // ── LEVEL 3: the riding field and its course ──
  const movers: any[] = [];
  let rails: any = null, poles: any = null, marker: any = null;
  const railRest: any[] = [];
  const jumps = COURSE.map((g, i) => ({ g, i })).filter((j) => j.g.kind === "jump");
  if (level >= 3) {
    const F = area("field");
    F.ground([FIELD[0], FIELD[1], FIELD[2], FIELD[3]], M.field, 0.008, 6);
    hedge(F, FIELD[1], FIELD[2], FIELD[0], FIELD[2]);
    hedge(F, FIELD[1], FIELD[3], FIELD[0], FIELD[3]);
    hedge(F, FIELD[0], FIELD[2], FIELD[0], FIELD[3]);
    // the jumps: two timber wings each (a post and three short rails), the rails themselves are instanced (they fall)
    for (const { g } of jumps) {
      for (const [x, z] of [[g.x0, Math.min(g.z0, g.z1) - 0.25], [g.x1, Math.max(g.z0, g.z1) + 0.25]]) {
        F.box(0.14, 1.45, 0.14, M.white, x, 0.72, z);
        F.box(0.14, 1.1, 0.14, M.white, x + 0.0, 0.55, z + (z < (g.z0 + g.z1) / 2 ? -0.45 : 0.45));
        for (let k = 0; k < 3; k++) F.box(0.06, 0.07, 0.5, M.timber, x, 0.3 + k * 0.35, z + (z < (g.z0 + g.z1) / 2 ? -0.22 : 0.22));
        F.box(0.5, 0.06, 0.5, M.darkTimber, x, 0.03, z);
      }
    }
    // the start / finish arch
    const s0 = COURSE[0];
    for (const z of [s0.z0 - 0.3, s0.z1 + 0.3]) F.box(0.18, 4.9, 0.18, M.white, s0.x0, 2.45, z);
    F.done();
    const arch = new THREE.Mesh(new THREE.PlaneGeometry(s0.z1 - s0.z0 + 0.8, 0.7), new THREE.MeshStandardMaterial({ map: signTex(["START · FINISH"], 768, 128, "#1a2c1a"), roughness: 0.6, side: THREE.DoubleSide }));
    arch.position.set(s0.x0, 4.6, (s0.z0 + s0.z1) / 2); arch.rotation.y = Math.PI / 2; scene.add(arch); signs.push(arch);
    // rails: two a jump (top and middle), red and white, instanced: they can drop
    const railGeo = new THREE.BoxGeometry(0.11, 0.11, 1);
    const stripes = tex(stripeCanvas("#c8102e", "#f4f1ea"), [1, 1]);
    stripes.rotation = Math.PI / 2; stripes.center.set(0.5, 0.5); stripes.repeat.set(3, 1);
    rails = new THREE.InstancedMesh(railGeo, mat("#ffffff", { map: stripes, roughness: 0.5 }), jumps.length * 2);
    rails.castShadow = true; rails.receiveShadow = true; rails.name = "course-rails";
    const m4 = new THREE.Matrix4();
    jumps.forEach(({ g }, j) => {
      const len = Math.abs(g.z1 - g.z0) + 0.4;
      for (let k = 0; k < 2; k++) {
        const y = k === 0 ? 1.0 : 0.55;
        m4.compose(new THREE.Vector3(g.x0, y, (g.z0 + g.z1) / 2), new THREE.Quaternion(), new THREE.Vector3(1, 1, len));
        rails.setMatrixAt(j * 2 + k, m4);
        railRest.push(m4.clone());
      }
    });
    scene.add(rails); movers.push(rails);
    // bending poles
    const pg = COURSE.find((g) => g.kind === "poles")!;
    const poleTex = tex(stripeCanvas("#f4f1ea", "#c8102e"), [1, 4]);
    poleTex.rotation = Math.PI / 2; poleTex.center.set(0.5, 0.5);
    poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1.8, 8), mat("#ffffff", { map: poleTex, roughness: 0.5 }), pg.poles!.length);
    poles.castShadow = true; poles.name = "course-poles";
    pg.poles!.forEach(([x, z], i) => { m4.makeTranslation(x, 0.95, z); poles.setMatrixAt(i, m4); });
    scene.add(poles); movers.push(poles);
    const bases = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.26, 0.1, 10), M.darkTimber, pg.poles!.length);
    pg.poles!.forEach(([x, z], i) => { m4.makeTranslation(x, 0.05, z); bases.setMatrixAt(i, m4); });
    scene.add(bases);
    // the next gate's marker: a gold chevron that bobs above it
    const chev = new THREE.Shape();
    chev.moveTo(-0.45, 0.35); chev.lineTo(0, -0.1); chev.lineTo(0.45, 0.35); chev.lineTo(0.45, 0.1); chev.lineTo(0, -0.35); chev.lineTo(-0.45, 0.1); chev.lineTo(-0.45, 0.35);
    marker = new THREE.Mesh(new THREE.ExtrudeGeometry(chev, { depth: 0.08, bevelEnabled: false }), M.gold);
    marker.name = "course-marker";
    marker.visible = false;
    scene.add(marker); movers.push(marker);
  }

  // ── LEVEL 4: the race track round the field ──
  if (level >= 4) {
    const T4 = area("track");
    const { cE, cW, inner, outer } = TRACK;
    const stadium = (r: number) => { const s = new THREE.Shape(); s.moveTo(cW, -r); s.lineTo(cE, -r); s.absarc(cE, 0, r, -Math.PI / 2, Math.PI / 2, false); s.lineTo(cW, r); s.absarc(cW, 0, r, Math.PI / 2, Math.PI * 1.5, false); return s; };
    const ring = stadium(outer);
    ring.holes.push(stadium(inner) as any);
    const rg = new THREE.ShapeGeometry(ring, 24);
    // plan UVs (x, z) in 3 m tiles; the shape is drawn in x / y, laid flat below
    const pos = rg.attributes.position, uv = rg.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getY(i) / 3);
    T4.put(rg, M.dirt, 0, 0.011, 0, Math.PI / 2, 0, 0);
    // white rails inside and out, a gap where the axis crosses the track (the way in from the field gate)
    for (const r of [inner - 0.25, outer + 0.25]) {
      const n = Math.round((2 * (cE - cW) + 2 * Math.PI * r) / 3.0);
      let prev: [number, number] | null = null;
      for (let k = 0; k <= n; k++) {
        const p = trackPoint(k / n, r);
        const inGap = p[0] > cE + r - 2.5 && Math.abs(p[1] - AXIS_Z) < GATE_HALF + 0.2;
        if (!inGap) T4.box(0.1, 1.0, 0.1, M.white, p[0], 0.5, p[1]);
        if (prev && !inGap) {
          const mx = (prev[0] + p[0]) / 2, mz = (prev[1] + p[1]) / 2;
          const prevGap = prev[0] > cE + r - 2.5 && Math.abs(prev[1] - AXIS_Z) < GATE_HALF + 0.2;
          if (!prevGap) T4.box(Math.hypot(p[0] - prev[0], p[1] - prev[1]) + 0.05, 0.12, 0.07, M.white, mx, 0.95, mz, Math.atan2(-(p[1] - prev[1]), p[0] - prev[0]));
        }
        prev = p;
      }
    }
    // the finish post and a red-and-white line across the dirt
    const f = TRACK_GATES[0];
    T4.box(0.2, 0.012, Math.abs(f.z1 - f.z0), M.red, f.x0, 0.016, (f.z0 + f.z1) / 2);
    T4.box(0.16, 2.4, 0.16, M.red, f.x0, 1.2, f.z0 - 0.4);
    T4.done();
    const fb = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshStandardMaterial({ map: signTex(["FINISH"], 512, 160, "#7a0c1c"), roughness: 0.6, side: THREE.DoubleSide }));
    fb.position.set(f.x0, 2.3, f.z0 - 0.4); fb.rotation.y = Math.PI / 2; scene.add(fb); signs.push(fb);
  } else if (level === 3) sign(["🔒 Race track", "Garden level 4"], FIELD[1] - 1.6, AXIS_Z - 4.2, -Math.PI / 2, 1.5);

  // ── LEVEL 5: signposts (fast travel) ──
  if (level >= 5) {
    const S = area("signs");
    for (const sp of SIGNPOSTS) {
      S.box(0.14, 2.6, 0.14, M.darkTimber, sp.x, 1.3, sp.z);
      S.box(0.3, 0.12, 0.3, M.gold, sp.x, 2.66, sp.z);
    }
    S.done();
    for (const sp of SIGNPOSTS) {
      const arms: [string, number, number][] = [["🏠 House", 2.15, Math.PI / 2], ["🌳 Garden", 1.75, Math.PI / 2 - 0.5], ["🐎 Field", 1.35, -Math.PI / 2]];
      for (const [label, y, ry] of arms) {
        const arm = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), new THREE.MeshStandardMaterial({ map: signTex([label], 512, 140, "#f4f1ea", "#2a1d12"), roughness: 0.7, side: THREE.DoubleSide }));
        // the boards' words in dark ink on cream
        (arm.material.map.image as HTMLCanvasElement).getContext("2d");
        arm.position.set(sp.x + Math.sin(ry) * 0.5, y, sp.z + Math.cos(ry) * 0.5);
        arm.rotation.y = ry + Math.PI / 2;
        scene.add(arm); signs.push(arm);
      }
    }
  } else if (level === 4) sign(["🔒 Fast travel", "Garden level 5"], SIGNPOSTS[0].x, SIGNPOSTS[0].z, Math.PI / 2, 1.4);

  // ── Trees round the new areas: planted with the garden's own trees (./levelLayout.ts levelTrees, ./scene.ts),
  // so they are the same trees in the same plant zones; the old garden's trees there are not planted (`clears`) ──
  const cleared = clearedRects(level);

  // ── Collision and the camera's room ──
  const walk = walkRects(level);
  const solids = [...solidBoxes(level), ...jumpBoxes(level)];
  const rideR = rideRects(level);
  const rideSolids = solidBoxes(level);
  const camRects: Rect[] = [...walkRects(level, -0.6), [WEST_GATE.x - 0.5, WEST_GATE.x + 0.5, -18, 18]];
  const allX0 = level >= 3 ? FIELD[0] - 1 : ZONE_A[0] - 1;
  const bounds: Rect = [allX0, 18.4, Math.min(-18.4, level >= 3 ? FIELD[2] - 1 : -18.4), Math.max(18.4, level >= 3 ? FIELD[3] + 1 : 18.4)];
  const inGardenSq = (x: number, z: number) => Math.abs(x) <= 18.3 && Math.abs(z) <= 18.3;

  // ── The horse (./rideHorse.ts) ──
  // everything that moves lives under one group (kept out of the garden's still-piece joining)
  const dyn = new THREE.Group();
  dyn.name = "garden-level-movers";
  scene.add(dyn);
  movers.push(dyn);
  let horse: HorseRig | null = null;
  const hp = { x: HORSE_HOME.x, z: HORSE_HOME.z, yaw: Math.PI * 0.75, speed: 0, energy: Math.max(0, Math.min(100, opt.horse.energy)), y: 0, pitch: 0 };
  let graze = 0, grazeT = 0, wanderTo: [number, number] | null = null, wanderWait = 3;
  d.load("/star/garden3d/horse.glb").then((g: any) => {
    if (disposed) return;
    const rig = makeRideHorse(THREE, d.SkeletonUtils, g, d.blobTex, { round: d.dbg.get("horseround") !== "0" });
    dyn.add(rig.saddle, rig.reinL, rig.reinR, rig.root, rig.blob);
    horse = rig;
    placeHorse();
  }).catch((e: any) => console.error("garden levels: horse", e));

  const placeHorse = () => {
    if (!horse) return;
    horse.root.position.set(hp.x, hp.y, hp.z);
    horse.root.rotation.set(hp.pitch, hp.yaw, 0, "YXZ");
    horse.blob.position.set(hp.x, 0.02, hp.z);
    horse.blob.rotation.z = hp.yaw;
    horse.blob.material.opacity = 0.62 * Math.max(0.35, 1 - hp.y / 1.2);
  };
  const turnBone = (() => {
    const q = new THREE.Quaternion(), qp = new THREE.Quaternion(), qi = new THREE.Quaternion();
    return (b: any, axis: any, ang: number) => {
      if (!b?.parent || Math.abs(ang) < 1e-4) return;
      b.parent.getWorldQuaternion(qp); qi.copy(qp).invert(); q.setFromAxisAngle(axis, ang);
      b.quaternion.premultiply(qp).premultiply(q).premultiply(qi);
      b.updateMatrixWorld(true);
    };
  })();
  const hAxis = new THREE.Vector3(), hUp = new THREE.Vector3(0, 1, 0);
  let horseT = Math.random() * 50;

  /** The horse's legs and body for its speed (and a jump in the air). */
  const animateHorse = (dt: number) => {
    if (!horse) return;
    const s = hp.speed;
    const wWalk = s < 0.25 ? s / 0.25 * 0 : s < 2.6 ? Math.min(1, s / 1.0) * (s < 2.0 ? 1 : 1 - (s - 2.0) / 0.6) : 0;
    const wRun = s < 2.0 ? 0 : Math.min(1, (s - 2.0) / 0.6);
    const wIdle = Math.max(0, 1 - wWalk - wRun);
    const wJump = jumpState ? Math.min(1, Math.sin(Math.PI * jumpState.p) * 1.6) : 0;
    horse.idle.setEffectiveWeight(wIdle * (1 - wJump));
    horse.walk.setEffectiveWeight(wWalk * (1 - wJump));
    horse.run.setEffectiveWeight(wRun * (1 - wJump));
    horse.jump.setEffectiveWeight(wJump);
    // the clips' paces from the ground speed (no gliding feet): WalkSlow covers ~0.65 m/s, Run ~3.4 m/s at this size
    horse.walk.timeScale = Math.max(0.6, s / 0.65);
    horse.run.timeScale = Math.max(0.9, Math.min(2.3, s / 3.4));
    if (jumpState) horse.jump.time = 0.42 + jumpState.p * 0.62;
    horse.mixer.update(dt);
    horseT += dt;
    // grazing at rest (head down, chewing), a tail that sways
    horse.root.updateMatrixWorld(true);
    hAxis.set(1, 0, 0).applyQuaternion(horse.root.quaternion);
    const gz = graze * (1 - Math.min(1, s));
    turnBone(horse.neck, hAxis, gz * 1.45);
    turnBone(horse.head, hAxis, gz * -0.35 + (gz > 0.5 ? 0.04 * Math.sin(horseT * 7) : 0));
    const sway = 0.08 * Math.sin(horseT * 1.3) + (s > 3 ? 0.25 * Math.sin(horseT * 9) * 0.3 : 0);
    horse.tail.forEach((b: any, i: number) => turnBone(b, hUp, sway * (0.6 + 0.3 * i)));
    carryTack(horse);
  };

  // ── Riding ──
  let rider: { person: Person3D; player: any; zeroLegs: (dt: number) => void; place: (x: number, z: number, yaw: number) => void } | null = null;
  let mounted = false, gallopHeld = false;
  let fade = 0, fadeDir = 0, fadeMid: (() => void) | null = null;
  let jumpState: { p: number; dur: number; h: number; gate: number } | null = null;
  let refusedAt = -1;
  let auto: { route: [number, number, number, number][]; i: number } | null = null;
  let course: LapState = newLap(), track: LapState = newLap();
  let lapsDone: { kind: "course" | "track"; ms: number }[] = [];
  let best = { course: opt.bestCourse, track: opt.bestTrack };
  let flash: { text: string; t: number; good: boolean } | null = null;
  let mode: "course" | "track" | null = null;
  const knockRail = (gateIndex: number) => {
    if (!rails) return;
    const j = jumps.findIndex((x) => x.i === gateIndex);
    if (j < 0) return;
    const m4 = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    railRest[j * 2].decompose(p, q, sc);
    // the top rail drops to the ground at the foot of the jump, a little twisted
    m4.compose(new THREE.Vector3(p.x + 0.55, 0.07, p.z + 0.1), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0.18, 0)), sc);
    rails.setMatrixAt(j * 2, m4); rails.instanceMatrix.needsUpdate = true;
  };
  const resetCourse = () => {
    if (rails) { railRest.forEach((m: any, i: number) => rails.setMatrixAt(i, m)); rails.instanceMatrix.needsUpdate = true; }
    if (poles) {
      const pg = COURSE.find((g) => g.kind === "poles")!; const m4 = new THREE.Matrix4();
      pg.poles!.forEach(([x, z], i) => { m4.makeTranslation(x, 0.95, z); poles.setMatrixAt(i, m4); }); poles.instanceMatrix.needsUpdate = true;
    }
  };
  const knockPole = (idx: number) => {
    if (!poles) return;
    const pg = COURSE.find((g) => g.kind === "poles")!;
    const [x, z] = pg.poles![idx];
    const m4 = new THREE.Matrix4().compose(new THREE.Vector3(x + Math.sin(hp.yaw) * 0.5, 0.88, z + Math.cos(hp.yaw) * 0.5), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.cos(hp.yaw) * 0.35, 0, -Math.sin(hp.yaw) * 0.35)), new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(idx, m4); poles.instanceMatrix.needsUpdate = true;
  };
  const onEvents = (kind: "course" | "track", ev: LapEvent[], lap: LapState) => {
    for (const e of ev) {
      if (e.kind === "start") {
        if (kind === "course") resetCourse();
        if (mode !== kind) { mode = kind; if (kind === "course") track = newLap(); else course = newLap(); }
        flash = { text: kind === "course" ? "Course · go" : "Track · go", t: 1.4, good: true };
      }
      if (e.kind === "jump") {
        if (e.result === "rail") { knockRail(e.gate ?? -1); flash = { text: "Rail down +2s", t: 1.6, good: false }; }
        else if (e.result === "clean") flash = { text: "Clear", t: 0.9, good: true };
      }
      if (e.kind === "pole") { const k = lap.knocked[lap.knocked.length - 1]; knockPole(k % 10); flash = { text: "Pole +1s", t: 1.4, good: false }; }
      if (e.kind === "finish" && e.time !== undefined) {
        const ms = Math.round(e.time * 1000);
        lapsDone.push({ kind, ms });
        const b = best[kind];
        if (b === undefined || ms < b) best = { ...best, [kind]: ms };
        flash = { text: `${e.best ? "New best " : "Lap "}${lapClock(e.time)}`, t: 2.6, good: !!e.best };
      }
    }
  };

  const mountNow = () => {
    if (!horse || !rider || mounted) return false;
    if (hp.energy <= 0.5) { flash = { text: `${opt.horse.name} is resting`, t: 1.8, good: false }; return false; }
    startFade(() => {
      mounted = true;
      graze = 0;
      // he turns to face where you were looking, standing where he is
      const py = rider!.player.rotation.y;
      hp.yaw = py; hp.speed = 0;
      placeHorse();
      horse!.reinL.visible = horse!.reinR.visible = true;
    });
    return true;
  };
  const dismountNow = () => {
    if (!mounted) return;
    startFade(() => {
      mounted = false; jumpState = null; hp.speed = 0; hp.y = 0; hp.pitch = 0; gallopHeld = false;
      placeHorse();
      horse!.reinL.visible = horse!.reinR.visible = false;
      // you stand on his left (near) side, facing him, clear of his body
      const px = hp.x + Math.cos(hp.yaw) * 1.05, pz = hp.z - Math.sin(hp.yaw) * 1.05;
      const [cx, cz] = clampToRects(px, pz, walk);
      if (rider) {
        rider.player.position.set(cx, 0, cz); rider.player.rotation.set(0, hp.yaw - Math.PI / 2, 0);
        rider.person.actions.sitidle?.setEffectiveWeight(0); // back on his feet: the walking loops take over again
      }
      if (marker) marker.visible = false;
      course = newLap(); track = newLap(); mode = null; resetCourse();
      cb.onRide?.({ energy: hp.energy, laps: lapsDone });
      lapsDone = [];
    });
  };
  const startFade = (mid: () => void) => { fadeDir = 1; fadeMid = mid; };

  // ── The HUD: the chip, the horse's card, the riding buttons, the lap clock, the signpost (plain DOM in the
  // garden's own box, so the test page, the harness and the game draw the same; house style: dark glass, gold) ──
  const ink = "#f7f1e8", GOLDC = "#facc15";
  const el = (tag: string, css: string, html = "") => { const e = document.createElement(tag); e.style.cssText = css; if (html) e.innerHTML = html; return e; };
  const stop = (e: Event) => e.stopPropagation();
  const hud = el("div", "position:absolute;inset:0;pointer-events:none;z-index:5;font-family:system-ui,-apple-system,sans-serif;color:" + ink);
  hud.setAttribute("data-garden-levels-hud", "");
  const glass = "background:rgba(14,12,10,0.82);border:1px solid rgba(250,204,21,0.25);border-radius:16px;backdrop-filter:blur(8px);box-shadow:0 14px 30px -14px rgba(0,0,0,.85);";
  const lvl = gardenLevelOf(opt.xp);
  const chip = el("div", `position:absolute;left:12px;top:calc(max(12px, env(safe-area-inset-top)) + 44px);${glass}border-radius:999px;padding:6px 12px 7px;font-size:12px;font-weight:900;display:flex;flex-direction:column;gap:4px;min-width:150px`);
  chip.setAttribute("data-garden-level-chip", "");
  chip.innerHTML = `<span>🌳 ${gardenChip(opt.xp)}</span><span style="display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden"><span style="display:block;height:100%;width:${Math.round(lvl.progress * 100)}%;background:${GOLDC}"></span></span>`;
  hud.appendChild(chip);
  const btn = (label: string, css = "") => {
    const b = el("button", `pointer-events:auto;height:44px;padding:0 18px;border-radius:14px;border:none;background:${GOLDC};color:#111;font-weight:900;font-size:15px;cursor:pointer;touch-action:none;${css}`, label);
    for (const ev of ["pointerdown", "pointerup", "pointermove", "click"]) b.addEventListener(ev, stop);
    return b;
  };
  const card = el("div", `position:absolute;right:12px;bottom:max(24px, calc(env(safe-area-inset-bottom) + 16px));${glass}padding:12px;display:none;align-items:center;gap:10px;pointer-events:auto`);
  for (const ev of ["pointerdown", "pointerup"]) card.addEventListener(ev, stop);
  hud.appendChild(card);
  const cardWords = el("div", "display:grid;gap:4px;min-width:110px");
  const rideBtn = btn("Ride &#8250;");
  rideBtn.addEventListener("click", () => mountNow());
  card.append(cardWords, rideBtn);
  // riding: Get off (top right, under the bar), Gallop (bottom right, hold), the lap clock (top middle)
  const offBtn = btn("Get off", `position:absolute;right:12px;top:calc(max(12px, env(safe-area-inset-top)) + 48px);height:38px;background:rgba(18,13,10,0.72);color:${ink};border:1px solid rgba(255,230,200,0.2);display:none`);
  offBtn.addEventListener("click", () => dismountNow());
  const gallop = btn("Gallop", `position:absolute;right:20px;bottom:max(34px, calc(env(safe-area-inset-bottom) + 22px));width:104px;height:104px;border-radius:999px;font-size:17px;display:none;box-shadow:0 10px 26px -10px rgba(0,0,0,.8)`);
  const gOn = (e: Event) => { e.stopPropagation(); gallopHeld = true; gallop.style.transform = "scale(0.94)"; };
  const gOff = (e: Event) => { e.stopPropagation(); gallopHeld = false; gallop.style.transform = ""; };
  gallop.addEventListener("pointerdown", gOn); gallop.addEventListener("pointerup", gOff); gallop.addEventListener("pointerleave", gOff); gallop.addEventListener("pointercancel", gOff);
  const clock = el("div", `position:absolute;left:12px;top:calc(max(12px, env(safe-area-inset-top)) + 96px);${glass}padding:8px 14px;display:none;text-align:center;min-width:150px`);
  clock.setAttribute("data-lap-clock", "");
  const flashEl = el("div", `position:absolute;left:50%;transform:translateX(-50%);top:42%;font-size:26px;font-weight:950;text-shadow:0 3px 12px rgba(0,0,0,.7);opacity:0;transition:opacity .2s;white-space:nowrap`);
  const gaitEl = el("div", `position:absolute;right:12px;top:calc(max(12px, env(safe-area-inset-top)) + 96px);${glass}padding:8px 12px;display:none;min-width:120px;font-size:12px;font-weight:900`);
  const signCard = el("div", `position:absolute;right:12px;bottom:max(24px, calc(env(safe-area-inset-bottom) + 16px));${glass}padding:12px;display:none;flex-direction:column;gap:8px;pointer-events:auto`);
  for (const ev of ["pointerdown", "pointerup"]) signCard.addEventListener(ev, stop);
  const travelTo = (to: "house" | "garden" | "field" | "paddock") => {
    if (mounted) return;
    startFade(() => {
      if (to === "house") { if (cb.onHouse) { cb.onHouse(); return; } }
      const t = to === "house" ? { x: 16.3, z: 6.6, yaw: Math.PI / 2 } : TRAVEL[to];
      if (rider) { rider.place(t.x, t.z, t.yaw); travelled = { ...t }; }
    });
  };
  let travelled: { x: number; z: number; yaw: number } | null = null;
  const sb = [btn("🏠 House", "width:100%"), btn("🌳 Garden", "width:100%;background:rgba(255,255,255,.12);color:" + ink), btn("🐎 Field", "width:100%;background:rgba(255,255,255,.12);color:" + ink)];
  sb[0].addEventListener("click", () => travelTo("house"));
  sb[1].addEventListener("click", () => travelTo("garden"));
  sb[2].addEventListener("click", () => travelTo(level >= 3 ? "field" : "paddock"));
  signCard.append(el("div", "font-weight:900;font-size:13px;opacity:.8", "Fast travel"), ...sb);
  const fadeEl = el("div", "position:absolute;inset:0;background:#0d0a07;opacity:0;pointer-events:none");
  hud.append(offBtn, gallop, clock, flashEl, gaitEl, signCard, fadeEl);
  d.container.appendChild(hud);
  let lastCard = "", lastClock = "", lastGait = "";

  const near = (): ExtSpot | null => {
    if (mounted || !rider) return null;
    const p = rider.player.position;
    if (horse && Math.hypot(p.x - hp.x, p.z - hp.z) < 2.6) return "ride";
    if (level >= 5 && SIGNPOSTS.some((s) => Math.hypot(p.x - s.x, p.z - s.z) < 2.2)) return "signpost";
    return null;
  };

  const drawHud = (dt: number) => {
    const sp = near();
    const showRide = sp === "ride";
    card.style.display = showRide ? "flex" : "none";
    if (showRide) {
      const key = `${Math.round(hp.energy)}`;
      if (key !== lastCard) {
        lastCard = key;
        const e = Math.round(hp.energy);
        cardWords.innerHTML = `<div style="font-weight:900;font-size:15px">🐎 ${opt.horse.name}</div><div style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800"><span>⚡</span><span style="flex:1;height:7px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden;min-width:60px"><span style="display:block;height:100%;width:${e}%;background:${e < 15 ? "#f87171" : GOLDC}"></span></span><b>${e}</b></div>`;
      }
      rideBtn.style.opacity = hp.energy > 0.5 ? "1" : "0.45";
    }
    signCard.style.display = sp === "signpost" ? "flex" : "none";
    offBtn.style.display = mounted ? "block" : "none";
    gallop.style.display = mounted ? "block" : "none";
    gallop.style.opacity = hp.energy >= 15 ? "1" : "0.45";
    gaitEl.style.display = mounted ? "block" : "none";
    if (mounted) {
      const g = jumpState ? "Jump" : ({ halt: "Stand", walk: "Walk", trot: "Trot", canter: "Canter", gallop: "Gallop" } as const)[gaitAt(hp.speed)];
      const e = Math.round(hp.energy);
      const key = `${g}|${e}`;
      if (key !== lastGait) {
        lastGait = key;
        gaitEl.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px"><span>🐎 ${g}</span><span>${Math.round(hp.speed * 3.6)} km/h</span></div><div style="display:flex;align-items:center;gap:6px;margin-top:5px"><span>⚡</span><span style="flex:1;height:6px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden"><span style="display:block;height:100%;width:${e}%;background:${e < 15 ? "#f87171" : GOLDC}"></span></span><b>${e}</b></div>`;
      }
    }
    const lap = mode === "course" ? course : mode === "track" ? track : null;
    const showClock = mounted && level >= 3;
    clock.style.display = showClock ? "block" : "none";
    if (showClock) {
      const b = mode ? best[mode] : best.course;
      const t = lap?.on ? lapClock(lap.t + lap.pen) : "0:00.0";
      const nextName = mode === "course" && lap?.on ? (course.next < COURSE.length ? `next ${COURSE[course.next].kind === "poles" ? "poles" : `jump ${COURSE[course.next].name}`}` : "to the finish") : mode === "track" && lap?.on ? (track.next < TRACK_GATES.length ? "round the track" : "to the finish") : level >= 4 ? "through START or FINISH" : "ride through START";
      const key = `${t}|${b}|${nextName}|${lap?.pen ?? 0}`;
      if (key !== lastClock) {
        lastClock = key;
        clock.innerHTML = `<div style="font-size:11px;font-weight:900;opacity:.75;letter-spacing:.06em">${mode === "track" ? "RACE TRACK" : mode === "course" ? "JUMP COURSE" : "LAP CLOCK"}</div><div style="font-size:26px;font-weight:950;font-variant-numeric:tabular-nums;line-height:1.1">⏱ ${t}${lap && lap.pen ? ` <span style="color:#f87171;font-size:15px">+${lap.pen}s</span>` : ""}</div><div style="font-size:11px;font-weight:800;opacity:.8">${b !== undefined ? `best ${lapClock(b / 1000)} · ` : ""}${nextName}</div>`;
      }
    }
    if (flash) {
      flash.t -= dt;
      flashEl.textContent = flash.text;
      flashEl.style.color = flash.good ? GOLDC : "#fca5a5";
      flashEl.style.opacity = flash.t > 0 ? "1" : "0";
      if (flash.t <= -0.3) flash = null;
    }
    if (fadeDir !== 0) {
      fade += fadeDir * dt / 0.22;
      if (fade >= 1) { fade = 1; fadeDir = -1; const f = fadeMid; fadeMid = null; f?.(); }
      if (fade <= 0) { fade = 0; fadeDir = 0; }
      fadeEl.style.opacity = String(fade);
    }
  };

  // the rider's pose (./rideHorse.ts RIDE_POSE; ?ride<name>=deg on a test page tries another)
  const pose = { ...RIDE_POSE };
  for (const k of Object.keys(pose) as (keyof typeof RIDE_POSE)[]) { const v = d.dbg.get(`ride${k}`); if (v !== null && Number.isFinite(+v)) pose[k] = +v; }

  const ctrl: LevelZones = {
    level,
    westGate: { z0: WEST_GATE.z0, z1: WEST_GATE.z1 },
    clears: (x, z) => cleared.some((r) => inRect(x, z, r)),
    inside: (x, z) => walk.some((r) => inRect(x, z, r)) && !solids.some((b) => x > b[0] - 0.32 && x < b[1] + 0.32 && z > b[2] - 0.32 && z < b[3] + 0.32),
    clamp: (x, z, r, garden) => {
      // in the garden square (and not heading out through the gate): the garden's own clamp
      if (inGardenSq(x, z) && !(x < -17.9 && z > WEST_GATE.z0 + r && z < WEST_GATE.z1 - r)) return garden(x, z);
      if (!walk.some((w) => inRect(x, z, w))) {
        // outside every new area: back into the garden, or the nearest new area
        const [gx, gz] = garden(x, z);
        const [ax, az] = clampToRects(x, z, walk);
        if ((gx - x) ** 2 + (gz - z) ** 2 <= (ax - x) ** 2 + (az - z) ** 2) return [gx, gz];
        x = ax; z = az;
      }
      return pushOut(x, z, solids, r);
    },
    bounds,
    room: (x, z, dx, dz) => {
      if (inGardenSq(x, z) && x > -17.6) return null;
      return roomAlong(x, z, dx, dz, camRects, 10);
    },
    spot: () => near(),
    attachRider: (r) => { rider = r; },
    riding: () => mounted,
    ride: (dt, push, wantYaw, gal) => {
      if (!horse || !mounted) return;
      // filming and tests: ride the route by itself (the stick's job done by the route, nothing else changed)
      if (auto) {
        const w = auto.route[auto.i % auto.route.length];
        if (passedWaypoint(hp.x, hp.z, hp.yaw, w)) auto.i++;
        const w2 = auto.route[auto.i % auto.route.length];
        wantYaw = Math.atan2(w2[0] - hp.x, w2[1] - hp.z);
        push = w2[2]; gal = !!w2[3];
      }
      const gait = gaitFor(push, gal || gallopHeld, hp.energy);
      hp.speed = stepSpeed(hp.speed, gait, dt);
      if (wantYaw !== null) {
        let dd = wantYaw - hp.yaw; while (dd > Math.PI) dd -= Math.PI * 2; while (dd < -Math.PI) dd += Math.PI * 2;
        const maxT = turnRate(hp.speed) * dt;
        hp.yaw += Math.max(-maxT, Math.min(maxT, dd));
      }
      hp.energy = drain(hp.energy, hp.speed, dt);
      const px = hp.x, pz = hp.z;
      let nx = px + Math.sin(hp.yaw) * hp.speed * dt, nz = pz + Math.cos(hp.yaw) * hp.speed * dt;
      // a jump: any jump ahead within take-off distance, ridden at a trot or faster, is jumped (an arc over it)
      if (!jumpState && level >= 3) {
        for (const { g, i } of jumps) {
          const span0 = Math.min(g.z0, g.z1) - 0.1, span1 = Math.max(g.z0, g.z1) + 0.1;
          const ahead = (g.x0 - px) * Math.sin(hp.yaw); // distance to the jump line along the way he is going (x only: every jump runs along z)
          const dirX = Math.sin(hp.yaw);
          if (Math.abs(dirX) < 0.35) continue; // riding along it, not at it
          const dist = (g.x0 - px) / dirX; // metres along the heading to the line
          const zAt = pz + Math.cos(hp.yaw) * dist;
          if (dist <= 0 || dist > Math.max(1.6, hp.speed * 0.28) || zAt < span0 || zAt > span1) continue;
          void ahead;
          if (jumpResult(hp.speed, offSquare(g, Math.sin(hp.yaw), Math.cos(hp.yaw))) === "refusal") {
            // too slow: he stops short and won't go (a refusal costs time in a lap; see riding.ts)
            if (refusedAt !== i) {
              refusedAt = i;
              const lap = mode === "course" ? course : null;
              if (lap?.on && lap.next === i) { lap.pen += 4; lap.faults = [...lap.faults, "refusal +4s"]; }
              flash = { text: "Refused · come in faster", t: 1.8, good: false };
            }
            hp.speed = 0; nx = px; nz = pz;
            break;
          }
          const span = 3.4;
          jumpState = { p: 0, dur: span / Math.max(3, hp.speed), h: hp.speed > 5 ? 0.85 : 0.72, gate: i };
          refusedAt = -1;
          break;
        }
      }
      if (jumpState) {
        jumpState.p += dt / jumpState.dur;
        const p = Math.min(1, jumpState.p);
        hp.y = jumpState.h * Math.sin(Math.PI * p);
        hp.pitch = -0.32 * Math.cos(Math.PI * p) * Math.sin(Math.PI * Math.min(1, p * 1.15));
        if (jumpState.p >= 1) { jumpState = null; hp.y = 0; hp.pitch = 0; }
      }
      // collision: the areas a horse may go, out of fences (a jump in the air passes over its own rails)
      [nx, nz] = clampToRects(nx, nz, rideR);
      [nx, nz] = pushOut(nx, nz, rideSolids, 0.75);
      if (Math.hypot(nx - px, nz - pz) < hp.speed * dt * 0.3 && hp.speed > 1.5 && !jumpState) hp.speed *= 0.6; // ran into a fence: slows right down
      // the laps
      if (level >= 3) {
        const c = stepLap(course, COURSE, px, pz, nx, nz, hp.speed, dt, best.course);
        course = c.lap; if (c.events.length) onEvents("course", c.events, course);
      }
      if (level >= 4) {
        const t = stepLap(track, TRACK_GATES, px, pz, nx, nz, hp.speed, dt, best.track);
        track = t.lap; if (t.events.length) onEvents("track", t.events, track);
      }
      if (mode === "course" && !course.on) mode = null;
      hp.x = nx; hp.z = nz;
      placeHorse();
      animateHorse(dt);
      rider?.zeroLegs(dt);
    },
    poseRider: () => {
      if (!horse || !rider || !mounted) return;
      carryTack(horse);
      // the seat leans with the pace, and over a jump
      const lean = (hp.speed > 6.5 ? 12 : hp.speed > 3 ? 5 : 0) + (jumpState ? 16 * Math.sin(Math.PI * jumpState.p) : 0);
      seatRider(THREE, rider.person, horse, hp.yaw, lean, pose);
    },
    speed: () => hp.speed,
    yaw: () => hp.yaw,
    at: () => [hp.x, hp.z],
    camAdjust: (cs) => {
      if (!mounted) return;
      cs.height += 1.15; cs.back += 2.4; cs.lookY += 1.0; cs.lookAhead += 1.4 + hp.speed * 0.12;
    },
    update: (dt, camera, px, pz) => {
      if (!mounted) {
        // the horse at rest: grazes, now and then ambles to a new spot in the paddock
        if (horse) {
          const inPaddock = inRect(hp.x, hp.z, PADDOCK2);
          const nearYou = Math.hypot(px - hp.x, pz - hp.z) < 3;
          if (inPaddock && !nearYou) {
            if (!wanderTo) { wanderWait -= dt; if (wanderWait <= 0) wanderTo = [PADDOCK2[0] + 2 + Math.random() * (PADDOCK2[1] - PADDOCK2[0] - 4), PADDOCK2[2] + 3 + Math.random() * (PADDOCK2[3] - PADDOCK2[2] - 6)]; }
            if (wanderTo) {
              const dx = wanderTo[0] - hp.x, dz = wanderTo[1] - hp.z, dd = Math.hypot(dx, dz);
              if (dd < 0.3) { wanderTo = null; wanderWait = 6 + Math.random() * 8; hp.speed = 0; }
              else {
                let a = Math.atan2(dx, dz) - hp.yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
                hp.yaw += Math.max(-dt, Math.min(dt, a));
                hp.speed = Math.abs(a) < 0.6 ? 1.0 : 0.3;
                hp.x += Math.sin(hp.yaw) * hp.speed * dt; hp.z += Math.cos(hp.yaw) * hp.speed * dt;
              }
            }
          } else { hp.speed = 0; wanderTo = null; }
          grazeT -= dt;
          if (grazeT <= 0) { grazeT = 4 + Math.random() * 6; graze = hp.speed > 0.1 || nearYou ? 0 : Math.random() < 0.65 ? 1 : 0; }
          if (nearYou) graze = Math.max(0, graze - dt * 2);
          placeHorse();
          // off screen: his clips don't run (nobody sees them)
          animateHorse(camera && !visibleish(camera) ? 0 : dt);
        }
      }
      // the next gate's marker over the course
      if (marker) {
        const lap = mode === "course" ? course : null;
        const g = mounted && level >= 3 ? (lap?.on ? (lap.next < COURSE.length ? COURSE[lap.next] : COURSE[0]) : COURSE[0]) : null;
        marker.visible = !!g;
        if (g) {
          horseT += 0;
          marker.position.set((g.x0 + g.x1) / 2, 2.35 + 0.18 * Math.sin(performance.now() / 260), (g.z0 + g.z1) / 2);
          marker.rotation.y += dt * 1.6;
        }
      }
      drawHud(dt);
    },
    movers,
    behindWall: (camera) => behindWall(camera),
    test: {
      mount: () => {
        if (!horse || !rider) return false;
        // stand beside him first (filming and tests)
        if (!mounted) { rider.player.position.set(hp.x + Math.cos(hp.yaw) * 1.05, 0, hp.z - Math.sin(hp.yaw) * 1.05); }
        return mountNow();
      },
      dismount: () => dismountNow(),
      setGallop: (on) => { gallopHeld = on; },
      autopilot: (route) => { auto = route ? { route, i: 0 } : null; },
      state: () => ({
        level, mounted, horse: { x: +hp.x.toFixed(2), z: +hp.z.toFixed(2), yaw: +hp.yaw.toFixed(3), speed: +hp.speed.toFixed(2), energy: +hp.energy.toFixed(2), y: +hp.y.toFixed(2), gait: gaitAt(hp.speed), jumping: !!jumpState },
        loaded: !!horse, mode, course: { on: course.on, t: +course.t.toFixed(2), pen: course.pen, next: course.next, faults: course.faults }, track: { on: track.on, t: +track.t.toFixed(2), next: track.next },
        laps: lapsDone, best, travelled, spot: near(),
        acts: rider ? Object.entries(rider.person.actions).filter(([, a]: [string, any]) => a.getEffectiveWeight() > 0.001).map(([n, a]: [string, any]) => [n, +a.getEffectiveWeight().toFixed(2), a.isRunning(), a.enabled, +a.time.toFixed(2)]) : null,
        pose: poseNumbers(),
      }),
      travel: (to) => travelTo(to),
      horseAt: (x, z, yaw) => { hp.x = x; hp.z = z; hp.yaw = yaw; hp.speed = 0; placeHorse(); },
      scene: () => scene,
    },
    dispose: () => {
      if (mounted) cb.onRide?.({ energy: hp.energy, laps: lapsDone });
      disposed = true;
      hud.remove();
      void signs;
    },
  };
  let disposed = false;
  // ── Out in the new areas, the garden behind its west wall is mostly out of sight (measured 28 Nov: 152-158 draws
  // looking back from the paddock, against 95 from the garden's gate). Everything of the garden that sits wholly
  // behind the wall from where the camera is (every corner's line of sight crosses the wall) is left out of the
  // picture; the shop's and casino's roofs, the trees and anything seen through the gate stay. ──
  const wallBoxes = [
    { x0: WEST_GATE.x - 0.45, x1: WEST_GATE.x + 0.45, y0: -1, y1: d.wallTop, z0: -19.3, z1: WEST_GATE.z0 },
    { x0: WEST_GATE.x - 0.45, x1: WEST_GATE.x + 0.45, y0: -1, y1: d.wallTop, z0: WEST_GATE.z1, z1: 19.3 },
  ];
  let wallItems: { m: any; c: number[]; r: number; corners: number[][] }[] | null = null;
  const SMALL = Number(d.dbg.get("smallcull") ?? 0.03), SMALL_FAR = Number(d.dbg.get("smallcullfar") ?? 0.07);
  let wallHidden: any[] = [], wallTick = 0;
  const mine = new Set<any>();
  const people: any[] = [];
  const pw = new THREE.Vector3();
  const behindWall = (camera: any): any[] => {
    const e = camera.position;
    if (e.x > WEST_GATE.x - 0.6) { wallHidden = []; return wallHidden; }
    if (!wallItems) {
      // once: the garden's own still meshes, each with its box (not the new areas, not anything that moves)
      scene.traverse((o: any) => { if (o.name?.startsWith("garden-level-")) o.traverse((c: any) => mine.add(c)); });
      for (const m of movers) m.traverse?.((c: any) => mine.add(c));
      wallItems = [];
      const b = new THREE.Box3();
      scene.updateMatrixWorld(true);
      scene.traverse((o: any) => {
        if (o.isSkinnedMesh && !mine.has(o)) { people.push(o); return; }
        if (!(o.isMesh || o.isPoints) || mine.has(o)) return;
        b.setFromObject(o);
        if (b.isEmpty() || b.min.x < WEST_GATE.x + 0.3 || b.max.y > 60) return; // the wall itself, the ground, the sky
        const c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2;
        wallItems!.push({ m: o, c: [c.x, c.y, c.z], r, corners: [b.min.x, b.max.x].flatMap((x) => [b.min.y, b.max.y].flatMap((y) => [b.min.z, b.max.z].map((z) => [x, y, z]))) });
      });
    }
    if (wallTick++ % 4 === 0) {
      const eye = [e.x, e.y, e.z];
      // hidden behind the wall, or too small to matter from out here (under ~1% of the view across: a pot, a lantern, a bed)
      const small = e.x < -40 ? SMALL_FAR : SMALL; // out in the field the garden is 30-60 m off: its small pieces are a few pixels
      wallHidden = wallItems.filter((it) => it.r / Math.hypot(it.c[0] - e.x, it.c[1] - e.y, it.c[2] - e.z) < small || wallBoxes.some((w) => hiddenBehind(eye, it.corners, w))).map((it) => it.m);
      // the garden's people and the bird (each a few thousand cloth triangles, measured 90k for the bench from the
      // field): out past the gate's lane they are left out of the picture altogether
      if (e.x < WEST_GATE.x - 2) for (const o of people) { o.getWorldPosition(pw); if (pw.x > WEST_GATE.x + 0.3) wallHidden.push(o); }
    }
    return wallHidden;
  };
  // a rough "is the horse in view" for skipping his clips off screen
  const fr = new THREE.Frustum(), pm = new THREE.Matrix4(), sph = new THREE.Sphere(new THREE.Vector3(), 2.2);
  const visibleish = (camera: any) => { pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); fr.setFromProjectionMatrix(pm); sph.center.set(hp.x, 1, hp.z); return fr.intersectsSphere(sph); };
  const poseNumbers = () => (horse && rider && mounted ? riderCheck(THREE, rider.person, horse) : null);
  void GAIT_SPEED; void GARDEN_LEVELS;
  return ctrl;
}
