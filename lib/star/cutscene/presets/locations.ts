/**
 * LOCATION PRESETS — the data half of each set (the 3D half is
 * locations3d.ts). Every set has named MARKS (where people stand, sit, where
 * props rest), a default mood, and a "line": the axis two people usually
 * face along, so the cameras keep to one side of it (the 180° rule).
 *
 * Metres, y up, yaw in radians (0 faces +z). Each set's own origin.
 */
import type { LocationId, MoodId, Vec3 } from "../types";

export interface Mark { pos: Vec3; yaw: number }

export interface LocationPreset {
  id: LocationId;
  name: string;
  mood: MoodId;
  /** Indoors: the sky is mostly hidden, the set's own lamps light it. */
  indoor: boolean;
  marks: Record<string, Mark>;
  /** Where an establishing shot sees the whole set from, and looks at. */
  establish: { pos: Vec3; look: Vec3; lens: number };
  /** Walls the camera must stay inside (x0, x1, z0, z1; y max): shots are pulled back inside. */
  bounds?: { min: Vec3; max: Vec3 };
  /** Height of the floor at a point (stages). */
  floorAt?: (x: number, z: number) => number;
}

const m = (x: number, y: number, z: number, yawDeg = 0): Mark => ({ pos: [x, y, z], yaw: (yawDeg * Math.PI) / 180 });

// THE OFFICE — the same desk as the live 3D signing (signing3dScene.ts):
// desk centre on the floor at the origin, the manager's side −z (the window
// behind him), yours +z. Desk 1.4 × 0.68, top 0.76.
export const DESK = { w: 1.4, d: 0.68, top: 0.76 };
export const SEAT_Z = 0.72;

export const LOCATIONS: Record<LocationId, LocationPreset> = {
  office: {
    id: "office", name: "The manager's office", mood: "golden-hour", indoor: true,
    marks: {
      "chair.boss": m(0, 0, -SEAT_Z, 0),
      "chair.you": m(0, 0, SEAT_Z, 180),
      "chairpos.boss": m(0, 0, -(SEAT_Z - 0.3), 0),
      "chairpos.you": m(0, 0, SEAT_Z - 0.3, 180),
      door: m(1.9, 0, 2.05, 200),
      "enter.you": m(1.5, 0, 1.6, 225),
      "stand.you": m(0.05, 0, 1.12, 180),
      "stand.boss": m(-0.05, 0, -1.12, 0),
      "side.boss": m(-1.0, 0, 0.55, 90),
      "photo.you": m(-0.36, 0, 1.25, 0),
      "photo.boss": m(0.36, 0, 1.25, 0),
      "photo.cam": m(0, 1.45, 2.35, 180),
      window: m(0, 1.8, -2.2, 0),
      contract: m(0, DESK.top + 0.0055, 0.13, 0),
      "contract.start": m(0, DESK.top + 0.0055, -0.14, 180),
      "pen.rest": m(0.2, DESK.top + 0.0055, 0.2, 0),
      "shirt.rest": m(-0.45, DESK.top + 0.01, -0.05, 0),
      desk: m(0, DESK.top, 0, 0),
    },
    establish: { pos: [1.95, 1.62, 2.15], look: [-0.2, 1.05, -0.6], lens: 22 },
    bounds: { min: [-2.3, 0.2, -2.1], max: [2.3, 2.9, 2.4] },
  },
  pitch: {
    id: "pitch", name: "The pitch", mood: "golden-hour", indoor: false,
    // the stadium's own coordinates: X across (−34..34), Z out from the near goal line
    marks: {
      goal: m(0, 0, 0, 0),
      "goal.line": m(0, 0, 0.4, 0),
      spot: m(0, 0, 11, 180),
      "box.edge": m(0, 0, 16.5, 180),
      "box.left": m(-9, 0, 15, 160),
      "run.start": m(-5.5, 0, 24, 160),
      "shot.spot": m(-2.6, 0, 14.2, 170),
      "corner.R": m(33.2, 0, 0.8, 0),
      "corner.L": m(-33.2, 0, 0.8, 0),
      "flag.R": m(34, 0, 0, 0),
      "celebrate": m(-7.4, 0, 22.1, -25),
      centre: m(0, 0, 52.5, 180),
      "podium": m(0, 0, 40, 180),
      "podium.top": m(0, 0.62, 40, 180),
      "touchline": m(-33, 0, 40, 90),
      "crowd.near": m(0, 0, -6, 0),
    },
    establish: { pos: [-26, 10.5, 30], look: [-2, 0.8, 12], lens: 24 },
  },
  tunnel: {
    id: "tunnel", name: "The tunnel", mood: "golden-hour", indoor: true,
    // corridor along +z; the pitch through the mouth at z = 18
    marks: {
      door: m(0, 0, -1, 0),
      ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`home.${i}`, m(-0.55, 0, 9.4 - i * 1.05, 0)])),
      ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`away.${i}`, m(0.55, 0, 9.4 - i * 1.05, 0)])),
      "you.start": m(-0.55, 0, 8.35, 0),
      mouth: m(0, 0, 18, 0),
      "out.you": m(-0.6, 0, 24, 0),
      "out.away": m(0.6, 0, 24, 0),
      "ref": m(0, 0, 10.6, 0),
      "kid": m(-0.55, 0, 8.95, 0),
      "camera.end": m(0, 1.5, 16, 180),
    },
    establish: { pos: [0.9, 1.9, 14.5], look: [-0.3, 1.3, 6], lens: 24 },
    bounds: { min: [-1.55, 0.25, -1.5], max: [1.55, 2.6, 40] },
  },
  "dressing-room": {
    id: "dressing-room", name: "The dressing room", mood: "interior-warm", indoor: true,
    marks: {
      centre: m(0, 0, 0, 180),
      speech: m(0, 0, -1.8, 0),
      "bench.you": m(-2.3, 0, 0.6, 90),
      "bench.0": m(-2.3, 0, -0.9, 90), "bench.1": m(-2.3, 0, 2.0, 90),
      "bench.2": m(2.3, 0, -0.9, -90), "bench.3": m(2.3, 0, 0.6, -90), "bench.4": m(2.3, 0, 2.0, -90),
      door: m(0, 0, 3.2, 180),
      "peg.you": m(-2.85, 1.55, 0.6, 90),
    },
    establish: { pos: [1.6, 2.2, 3.0], look: [-0.6, 1.0, -0.6], lens: 20 },
    bounds: { min: [-2.9, 0.25, -2.9], max: [2.9, 2.8, 3.3] },
  },
  "awards-stage": {
    id: "awards-stage", name: "The awards stage", mood: "spotlight", indoor: true,
    marks: {
      "stage.centre": m(0, 0.9, -0.4, 0),
      "stage.presenter": m(1.25, 0.9, -0.6, -60),
      lectern: m(1.35, 0.9, -0.2, -30),
      "steps": m(-3.0, 0, 1.6, 0),
      "steps.top": m(-2.2, 0.9, 0.2, 60),
      "seat.you": m(-1.2, 0, 4.2, 180),
      audience: m(0, 0, 6, 180),
    },
    establish: { pos: [0, 2.4, 9.5], look: [0, 1.6, -0.5], lens: 24 },
    floorAt: (x, z) => (Math.abs(x) < 4 && z > -2.5 && z < 0.9 ? 0.9 : 0),
  },
  "press-room": {
    id: "press-room", name: "The press room", mood: "interior-cool", indoor: true,
    marks: {
      "seat.you": m(-0.45, 0, -0.55, 0),
      "seat.boss": m(0.55, 0, -0.55, 0),
      "seat.host": m(1.4, 0, -0.55, -10),
      table: m(0, 0.74, 0, 0),
      "mic.you": m(-0.45, 0.74, -0.08, 180),
      "mic.boss": m(0.55, 0.74, -0.08, 180),
      journalist: m(-0.9, 0, 3.1, 180),
      "journalist.2": m(1.3, 0, 3.9, 190),
      "row.0": m(0, 0, 2.6, 180), "row.1": m(0, 0, 3.6, 180), "row.2": m(0, 0, 4.6, 180),
      cameras: m(0, 1.5, 6.2, 180),
    },
    establish: { pos: [2.4, 1.8, 5.2], look: [0, 1.0, -0.4], lens: 24 },
    bounds: { min: [-4.2, 0.25, -1.4], max: [4.2, 3.2, 7] },
  },
  "training-ground": {
    id: "training-ground", name: "The training ground", mood: "golden-hour", indoor: false,
    marks: {
      centre: m(0, 0, 0, 180), "cones": m(-3, 0, 4, 0), goal: m(0, 0, -12, 0),
      "touchline": m(-8, 0, 2, 90), "you": m(0.5, 0, 1.5, 200), "coach": m(-1.4, 0, 2.6, 140),
    },
    establish: { pos: [7, 3.2, 10], look: [0, 0.8, 0], lens: 24 },
  },
  airport: {
    id: "airport", name: "Arrivals", mood: "golden-hour", indoor: true,
    marks: {
      doors: m(0, 0, -5.5, 0), "walk.mid": m(0, 0, -1, 0), "walk.end": m(0, 0, 4.5, 0),
      "fans.L": m(-2.4, 0, 1, 90), "fans.R": m(2.4, 0, 1, -90), agent: m(0.7, 0, -5.9, 0),
    },
    establish: { pos: [3.2, 2.2, 7.2], look: [0, 1.2, -1.5], lens: 22 },
    bounds: { min: [-6, 0.25, -7], max: [6, 5, 9] },
  },
  garden: {
    id: "garden", name: "The garden", mood: "golden-hour", indoor: false,
    marks: { patio: m(0, 0, 0, 180), lawn: m(0, 0, 5, 180), door: m(0, 0, -3.2, 180), bench: m(-2.5, 0, 2, 90) },
    establish: { pos: [4, 2.4, 9], look: [0, 1.0, 1], lens: 24 },
  },
};

/** A mark's place, or a point as given. */
export function resolvePoint(loc: LocationPreset, p: string | Vec3): Vec3 {
  if (typeof p !== "string") return p;
  const mk = loc.marks[p];
  if (!mk) throw new Error(`no mark "${p}" in ${loc.id}`);
  return mk.pos;
}
export function markYaw(loc: LocationPreset, p: string): number | null { return loc.marks[p]?.yaw ?? null; }
