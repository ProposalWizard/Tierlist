/**
 * WHERE THE GARDEN GROWS — the plan of the areas each garden level opens (pure; metres, as the garden:
 * north is -z, the garden is the square |x|, |z| < 19 with its gate in the south wall). Everything new is to
 * the WEST, through a farm gate in the west wall at the end of the side path (z = -1.8), on one straight line:
 *
 *   garden ── west gate ── lane ── yard + stable ── paddock gate ── paddock ── field gate ── riding field
 *   (x -19)                (-24)    (-36..-24)       (x -37)          (-46..-37)  (x -46.2)    (-113..-46.5)
 *
 *   level 2  the gate opens; the lane, the yard, the new stable (two stalls and a tack room), the paddock
 *   level 3  the field gate opens: the riding field and its jump course (5 jumps, 4 bending poles)
 *   level 4  a race track round the field (dirt, white rails, its own finish line)
 *   level 5  signposts by the west gate and the field gate: fast travel (house, garden, field)
 *
 * The 3D is ./levelZones.ts; the rules of a lap ./riding.ts; the levels ../gardenLevels.ts.
 */
import type { CourseGate } from "./riding";

/** An axis box [x0, x1, z0, z1]. */
export type Rect = [number, number, number, number];

export const WEST_GATE = { x: -19, z0: -2.9, z1: -0.7 };
/** The side path's line, through every gate. */
export const AXIS_Z = -1.8;
export const LANE: Rect = [-24, -19, -3.2, -0.4];
export const ZONE_A: Rect = [-46.5, -24, -13.9, 11.9];
export const YARD: Rect = [-36, -24, -6.5, 2.5];
export const BARN = { x0: -36, x1: -27, z0: -13.6, z1: -7.5, h: 3.4, ridge: 5.4 };
export const PADDOCK2: Rect = [-46.2, -37, -13.6, 11.6];
/** The gates on the axis: the paddock's (x = -37) and the field's (x = -46.2), wide enough for a horse. */
export const GATE_HALF = 1.6;
export const PADDOCK_GATE_X = -37;
export const FIELD_GATE_X = -46.2;
export const FIELD: Rect = [-113, -46.5, -21, 21];
/** The race track: two half circles (centres) joined by straights; the dirt runs from INNER to OUTER. */
export const TRACK = { cE: -68, cW: -92, inner: 13, outer: 17 };
/** Where the horse grazes, and where he stands to be mounted. */
export const HORSE_HOME = { x: -41.5, z: 2.5 };
export const SIGNPOSTS: { x: number; z: number }[] = [{ x: -21.6, z: -4.6 }, { x: -49.2, z: -4.8 }];

/** Spots fast travel puts you (x, z, facing yaw). */
export const TRAVEL = {
  garden: { x: -15.8, z: AXIS_Z, yaw: Math.PI / 2 },
  field: { x: -52, z: AXIS_Z, yaw: -Math.PI / 2 },
  paddock: { x: -30, z: AXIS_Z, yaw: -Math.PI / 2 },
} as const;

/** The jump course: the start/finish first, then the gates in order (see riding.ts stepLap). */
export const COURSE: CourseGate[] = [
  { kind: "finish", x0: -60, z0: 3, x1: -60, z1: 8, name: "Start" },
  { kind: "jump", x0: -68, z0: 4, x1: -68, z1: 7.5, name: "1" },
  { kind: "jump", x0: -80, z0: 4, x1: -80, z1: 7.5, name: "2" },
  { kind: "poles", x0: -100.5, z0: -8.5, x1: -93.5, z1: -8.5, poles: [[-97, 5], [-97, 1.5], [-97, -2], [-97, -5.5]], name: "Poles" },
  { kind: "jump", x0: -86, z0: -10.5, x1: -86, z1: -7, name: "3" },
  { kind: "jump", x0: -74, z0: -10.5, x1: -74, z1: -7, name: "4" },
  { kind: "jump", x0: -62, z0: -10.5, x1: -62, z1: -7, name: "5" },
];

/** The race track's finish (on the south straight) and a check on the north straight. */
export const TRACK_GATES: CourseGate[] = [
  { kind: "finish", x0: -80, z0: -17.3, x1: -80, z1: -12.7, name: "Finish" },
  { kind: "check", x0: -80, z0: 12.7, x1: -80, z1: 17.3, name: "Back straight" },
];

/** The track's middle line at an angle round it (for the rails and the tests): a point and the outward normal. */
export function trackPoint(t: number, r: number): [number, number] {
  // t 0..1 round the stadium: east half circle, north straight, west half circle, south straight
  const { cE, cW } = TRACK;
  const straight = cE - cW, arc = Math.PI * r, total = 2 * straight + 2 * arc;
  let d = ((t % 1) + 1) % 1 * total;
  if (d < arc) { const a = -Math.PI / 2 + d / r; return [cE + Math.cos(a) * r, Math.sin(a) * r]; }
  d -= arc;
  if (d < straight) return [cE - d, r];
  d -= straight;
  if (d < arc) { const a = Math.PI / 2 + d / r; return [cW + Math.cos(a) * r, Math.sin(a) * r]; }
  d -= arc;
  return [cW + d, -r];
}

/** Distance from (x, z) to the track's centre line of the straights / circles (0 = on the middle of the dirt). */
export function trackRadius(x: number, z: number): number {
  const { cE, cW } = TRACK;
  if (x >= cE) return Math.hypot(x - cE, z);
  if (x <= cW) return Math.hypot(x - cW, z);
  return Math.abs(z);
}

/** Every rect you can walk in at a level (on foot), each pulled in by `r` (the body's radius). */
export function walkRects(level: number, r = 0.32): Rect[] {
  const out: Rect[] = [];
  if (level < 2) return out;
  const g = WEST_GATE;
  out.push([g.x - 0.9, g.x + 1.2, g.z0 + r, g.z1 - r]); // through the gate
  out.push([LANE[0] - 0.8, LANE[1] - 0.6, LANE[2] + r, LANE[3] - r]); // (overlaps area A, so the way in is open)
  out.push([ZONE_A[0] + r, ZONE_A[1] - r, ZONE_A[2] + r, ZONE_A[3] - r]);
  if (level >= 3) {
    out.push([FIELD_GATE_X - 0.7, FIELD_GATE_X + 0.7, AXIS_Z - GATE_HALF + r, AXIS_Z + GATE_HALF - r]);
    out.push([FIELD[0] + r, FIELD[1] - r, FIELD[2] + r, FIELD[3] - r]);
  }
  return out;
}

/** Where the horse may go: the same areas past the garden gate (not the garden itself, nor its gate). */
export function rideRects(level: number, r = 0.9): Rect[] {
  if (level < 2) return [];
  const out: Rect[] = [[LANE[0] - 0.2, LANE[1] - 1.1, LANE[2] + 0.3, LANE[3] - 0.3], [ZONE_A[0] + r, ZONE_A[1] - r, ZONE_A[2] + r, ZONE_A[3] - r]];
  if (level >= 3) {
    out.push([FIELD_GATE_X - 1.2, FIELD_GATE_X + 1.2, AXIS_Z - GATE_HALF + 0.55, AXIS_Z + GATE_HALF - 0.55]);
    out.push([FIELD[0] + r, FIELD[1] - r, FIELD[2] + r, FIELD[3] - r]);
  }
  return out;
}

/** Fences and walls you cannot walk (or ride) through, at a level. Jumps are separate (`jumpBoxes`). */
export function solidBoxes(level: number): Rect[] {
  if (level < 2) return [];
  const t = 0.12;
  const b: Rect[] = [
    [BARN.x0, BARN.x1, BARN.z0, BARN.z1],
    // the paddock's east fence, with its gate on the axis
    [PADDOCK_GATE_X - t, PADDOCK_GATE_X + t, PADDOCK2[2], AXIS_Z - GATE_HALF],
    [PADDOCK_GATE_X - t, PADDOCK_GATE_X + t, AXIS_Z + GATE_HALF, PADDOCK2[3]],
    // a water trough and the mounting block by the paddock gate
    [-36.4, -35.0, 3.2, 3.9],
  ];
  // the field gate: shut until level 3
  if (level < 3) b.push([FIELD_GATE_X - 0.3, FIELD_GATE_X + 0.3, AXIS_Z - GATE_HALF - 0.1, AXIS_Z + GATE_HALF + 0.1]);
  for (const sp of level >= 5 ? SIGNPOSTS : []) b.push([sp.x - 0.15, sp.x + 0.15, sp.z - 0.15, sp.z + 0.15]);
  return b;
}

/** The jumps' boxes (solid on foot; a horse jumps them). */
export function jumpBoxes(level: number): Rect[] {
  if (level < 3) return [];
  return COURSE.filter((g) => g.kind === "jump").map((g) => [Math.min(g.x0, g.x1) - 0.25, Math.max(g.x0, g.x1) + 0.25, Math.min(g.z0, g.z1) - 0.45, Math.max(g.z0, g.z1) + 0.45]);
}

/** The ground each level opens, a little wider (trees and bushes of the old garden there are taken out). */
export function clearedRects(level: number): Rect[] {
  if (level < 2) return [];
  const out: Rect[] = [[-24.5, -18.0, -4.5, 0.9], [ZONE_A[0] - 3, ZONE_A[1] + 1, ZONE_A[2] - 3, ZONE_A[3] + 3]];
  if (level >= 3) out.push([FIELD[0] - 3, FIELD[1] + 1, FIELD[2] - 3, FIELD[3] + 3]);
  return out;
}

export const inRect = (x: number, z: number, r: Rect) => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3];

/** The nearest point of a set of rects (the point itself when it is inside one). */
export function clampToRects(x: number, z: number, rects: Rect[]): [number, number] {
  let best: [number, number] = [x, z], bd = Infinity;
  for (const r of rects) {
    if (inRect(x, z, r)) return [x, z];
    const cx = Math.max(r[0], Math.min(r[1], x)), cz = Math.max(r[2], Math.min(r[3], z));
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) { bd = d; best = [cx, cz]; }
  }
  return best;
}

/** Push (x, z) out of each box, grown by `r` (the shortest way out). */
export function pushOut(x: number, z: number, boxes: Rect[], r: number): [number, number] {
  for (const [x0, x1, z0, z1] of boxes) {
    if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) {
      const p = [x - (x0 - r), x1 + r - x, z - (z0 - r), z1 + r - z];
      const m = Math.min(...p);
      if (m === p[0]) x = x0 - r; else if (m === p[1]) x = x1 + r; else if (m === p[2]) z = z0 - r; else z = z1 + r;
    }
  }
  return [x, z];
}

/** How far a line from (x, z) along (dx, dz) stays inside the rects (stepped; at most `max` m). The camera's room. */
export function roomAlong(x: number, z: number, dx: number, dz: number, rects: Rect[], max = 9): number {
  const l = Math.hypot(dx, dz) || 1;
  const ux = dx / l, uz = dz / l;
  let t = 0;
  while (t < max) {
    const nx = x + ux * (t + 0.25), nz = z + uz * (t + 0.25);
    if (!rects.some((r) => inRect(nx, nz, r))) break;
    t += 0.25;
  }
  return t;
}

/** The trees round the new areas (pure; seeded): planted with the garden's own trees (./scene.ts), outside every open area. */
export function levelTrees(level: number): { x: number; z: number; s: number; ry: number; key: "tree_default" | "tree_oak" | "tree_fat" | "tree_pine2" }[] {
  const out: { x: number; z: number; s: number; ry: number; key: "tree_default" | "tree_oak" | "tree_fat" | "tree_pine2" }[] = [];
  if (level < 2) return out;
  const cleared = clearedRects(level);
  let seed = 777;
  const rr = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const keys = ["tree_default", "tree_oak", "tree_fat", "tree_pine2"] as const;
  const at = (x: number, z: number) => { const k = keys[Math.floor(rr() * 4)]; const s = 4.4 + rr() * 2.2, ry = rr() * 6; if (!cleared.some((r) => inRect(x, z, r))) out.push({ x, z, s, ry, key: k }); };
  const xEnd = level >= 3 ? FIELD[0] : ZONE_A[0];
  for (let x = -21; x > xEnd - 6; x -= 4.6 + rr() * 2) {
    const inField = level >= 3 && x < FIELD[1];
    at(x, (inField ? FIELD[2] : ZONE_A[2]) - 3.5 - rr() * 3);
    at(x, (inField ? FIELD[3] : ZONE_A[3]) + 3.5 + rr() * 3);
  }
  const zEdge = level >= 3 ? FIELD[3] : ZONE_A[3];
  for (let z = -zEdge - 4; z < zEdge + 4; z += 4.4 + rr() * 2) at(xEnd - 4 - rr() * 3, z);
  return out;
}

/** A clean way round the jump course (filming, tests): [x, z, stick push, gallop]. Canter the jumps, trot the poles. */
/** Waypoint reached: close to it, or close and already behind (a horse can't turn on a sixpence; never circles one). */
export function passedWaypoint(x: number, z: number, yaw: number, w: [number, number, number, number]): boolean {
  const dx = w[0] - x, dz = w[1] - z, d = Math.hypot(dx, dz);
  return d < (w[2] > 0.6 ? 2.2 : 1.3) || (d < 6 && dx * Math.sin(yaw) + dz * Math.cos(yaw) < 0);
}
export const COURSE_ROUTE: [number, number, number, number][] = [
  [-57.5, 5.6, 1, 0], [-60, 5.6, 1, 0], [-68, 5.7, 1, 0], [-80, 5.7, 1, 0], [-84.5, 5.8, 1, 0], [-91, 6.2, 0.7, 0], [-96.4, 8.6, 0.6, 0],
  [-95.6, 5, 0.6, 0], [-98.4, 1.5, 0.6, 0], [-95.6, -2, 0.6, 0], [-98.4, -5.5, 0.6, 0], [-97, -8.9, 0.7, 0],
  [-92, -9.2, 1, 0], [-86, -8.75, 1, 0], [-74, -8.75, 1, 0], [-62, -8.75, 1, 0], [-58, -6, 0.9, 0], [-56.5, 1.0, 0.9, 0], [-58.5, 5.4, 1, 0],
];
/** Round the race track at a gallop (anticlockwise seen from above: east on the south straight). */
export const TRACK_ROUTE: [number, number, number, number][] = Array.from({ length: 24 }, (_, i) => {
  const [x, z] = trackPoint(1 - i / 24, (TRACK.inner + TRACK.outer) / 2);
  return [x, z, 1, 1] as [number, number, number, number];
});
