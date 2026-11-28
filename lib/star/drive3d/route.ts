/**
 * THE DRIVE'S ROAD (driving phase 1, 28 Nov 2026; docs/plans/DRIVING_PLAN.md §2-3).
 * One fixed route, not a city: your street → a roundabout → a country lane → the compound
 * gate → the car park. Pure numbers (no three.js): the road line sampled every metre with
 * its heading and bend, the speed each part allows, and where things stand along it.
 *
 * Axes: x/z on the ground, y up; heading h means the direction (sin h, cos h). Left of a
 * driver facing +z is +x, so the LEFT side of the road (UK: you drive on the left) is
 * offset +, the other lane −.
 */

export type PieceKind = "street" | "roundabout" | "link" | "lane" | "approach" | "park";

/** A straight (`turn` 0) or an arc of `turn` radians (+ = left) on radius `r`. */
export interface Piece { kind: PieceKind; len?: number; r?: number; turn?: number; speed: number }

export interface RoutePoint { s: number; x: number; z: number; h: number; /** 1/radius, + = bending left */ k: number; kind: PieceKind }

export interface Route {
  pts: RoutePoint[];
  length: number;
  /** Where the compound barrier stands (s), and where your bay is (the end). */
  gateS: number;
  /** The roundabout's island (centre and the island's radius). */
  island: { x: number; z: number; r: number; ringOuter: number };
  /** Per sample: the speed the road allows here (m/s), braking for what is ahead already folded in. */
  limit: number[];
}

/** Lane centres (m from the road line): yours on the left, the other side's on the right. */
export const LANE = 1.75;
/** Road half-width: your street and the lane are both two lanes. */
export const ROAD_HALF = 3.5;
export const ACCEL = 3.2;
export const BRAKE = 5.5;
/** Sideways grip the auto-drive keeps under (m/s²): a calm drive, no squeal. */
export const LAT_G = 4.6;
/** Hold to go faster: how much quicker than the road's cruise. */
export const HOLD_BOOST = 1.32;

/**
 * The drive in. Cruise speeds: 30 mph street (13.4 m/s), the roundabout by its bend, 45 mph lane.
 * Sized so the auto-drive takes 25-30 s gate to gate (tests/star/drive.mts measures it).
 */
export const DRIVE_IN: Piece[] = [
  { kind: "street", len: 84, speed: 14 },
  { kind: "street", len: 14, speed: 10 },
  // the roundabout, straight over: in to the left, round the island (it is on your right), out to the left
  { kind: "roundabout", r: 12, turn: 0.62, speed: 9 },
  { kind: "roundabout", r: 15, turn: -1.24, speed: 9 },
  { kind: "roundabout", r: 12, turn: 0.62, speed: 9 },
  { kind: "link", len: 22, speed: 15 },
  // the country lane: three long bends
  { kind: "lane", r: 95, turn: 0.34, speed: 22 },
  { kind: "lane", len: 26, speed: 22 },
  { kind: "lane", r: 100, turn: -0.5, speed: 22 },
  { kind: "lane", len: 30, speed: 22 },
  { kind: "lane", r: 110, turn: 0.16, speed: 22 },
  { kind: "approach", len: 34, speed: 13 },
  // through the barrier, the car park: a short straight, then right into your bay
  { kind: "park", len: 11, speed: 8 },
  { kind: "park", r: 7.5, turn: -Math.PI / 2, speed: 5.5 },
  { kind: "park", len: 3, speed: 3 },
];

/** Index of the roundabout's middle arc in DRIVE_IN (its centre is the island). */
const ISLAND_PIECE = 3;

export function buildRoute(pieces: Piece[] = DRIVE_IN, step = 1): Route {
  const pts: RoutePoint[] = [];
  const zone: number[] = [];
  let x = 0, z = 0, h = 0, s = 0;
  let island = { x: 0, z: 0, r: 9, ringOuter: 18 };
  let gateS = 0;
  pieces.forEach((p, i) => {
    if (p.kind === "park" && gateS === 0) gateS = s;
    const arc = !!p.turn && !!p.r;
    const len = arc ? Math.abs(p.turn!) * p.r! : p.len!;
    const k = arc ? Math.sign(p.turn!) / p.r! : 0;
    if (i === ISLAND_PIECE && arc) {
      // centre of a right-hand arc: to the right of the car (−x side of its heading)
      const sgn = Math.sign(p.turn!);
      island = { x: x + Math.cos(h) * p.r! * sgn, z: z - Math.sin(h) * p.r! * sgn, r: p.r! - LANE - 2.6, ringOuter: p.r! + LANE + 2.4 };
    }
    const n = Math.max(1, Math.round(len / step));
    const ds = len / n;
    for (let j = 0; j < n; j++) {
      pts.push({ s, x, z, h, k, kind: p.kind });
      zone.push(p.speed);
      // exact arc / straight step
      if (k === 0) { x += Math.sin(h) * ds; z += Math.cos(h) * ds; }
      else {
        const dh = k * ds;
        const r = 1 / k;
        // a left turn (k > 0) raises h (facing +z, the left is +x = h π/2); the centre is r to the left
        const cx = x + Math.cos(h) * r, cz = z - Math.sin(h) * r;
        const h2 = h + dh;
        x = cx - Math.cos(h2) * r; z = cz + Math.sin(h2) * r;
        h = h2;
      }
      s += ds;
    }
  });
  pts.push({ s, x, z, h, k: 0, kind: pieces[pieces.length - 1].kind });
  zone.push(0);
  // the speed allowed: the zone's cruise, the bend's grip, then braking for what is ahead
  const limit = pts.map((p, i) => Math.min(zone[i], p.k ? Math.sqrt(LAT_G / Math.abs(p.k)) : 99));
  limit[limit.length - 1] = 0;
  for (let i = limit.length - 2; i >= 0; i--) {
    const d = pts[i + 1].s - pts[i].s;
    limit[i] = Math.min(limit[i], Math.sqrt(limit[i + 1] ** 2 + 2 * BRAKE * 0.75 * d));
  }
  return { pts, length: s, gateS, island, limit };
}

/** The road line at distance s (interpolated): position, heading, bend, the allowed speed. */
export function at(route: Route, s: number): RoutePoint & { limit: number } {
  const P = route.pts;
  const c = Math.max(0, Math.min(route.length, s));
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].s <= c) lo = m; else hi = m; }
  const a = P[lo], b = P[hi];
  const f = b.s > a.s ? (c - a.s) / (b.s - a.s) : 0;
  let dh = b.h - a.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
  return { s: c, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, h: a.h + dh * f, k: a.k, kind: a.kind, limit: route.limit[lo] + (route.limit[hi] - route.limit[lo]) * f };
}

/** A point `off` metres to the left (+) of the road line at s. */
export function offsetAt(route: Route, s: number, off: number): { x: number; z: number; h: number } {
  const p = at(route, s);
  return { x: p.x + Math.cos(p.h) * off, z: p.z - Math.sin(p.h) * off, h: p.h };
}

/**
 * The left normal of heading h. Check: facing +z (h = 0) the left is +x.
 * (sin h, cos h) forward → (cos h, −sin h) left.
 */
export const leftOf = (h: number): [number, number] => [Math.cos(h), -Math.sin(h)];
