/**
 * THE TRAINING COMPOUND'S GROUND PLAN (Harry, 27-28 Nov 2026: training compounds "based on the GTA 6
 * gym" world, "change the shop area to the training compound"; the plan:
 * docs/research/gym-compound-driving-2026-11-27.md section 3, phase 1 = the grounds). On the world
 * kit's test page only (/star-world3d-dev?place=compound, RUL-UI-002): not in the career yet.
 *
 * Pure data and maths (no three.js), so a test can walk it: where everything stands, what blocks a
 * walk, the doors and where they lead, the people's routines, the zones the camera culls by, and the
 * draw budget per quality tier. ./compoundPlace.ts builds the 3D from this; ./testScene.ts runs it.
 *
 * Ground plan: metres, x across (east +), z towards the road (south +), north is -z. A facing (yaw)
 * is the way he looks: 0 = +z (south), π = -z (north), as tapWalk.ts.
 *
 *          north  (-z)
 *     ┌──────────── PITCH C ─────┐        ┌───────── PITCH B ─────────┐
 *     │  (behind the building)   │        │                           │
 *     └──────────────────────────┘        └───────────────────────────┘
 *     ┌──────── MAIN BUILDING ───────┐ S  ┌───────── PITCH A ─────────┐
 *     │ gym door · reception · canteen│ T  │  cones · poles · dummies  │
 *     └───────────────────────────────┘ A  └───────────────────────────┘
 *          forecourt, benches, flag    N
 *  ═══hedge═══ [GATE] hut ═════════════D══════════ hedge ═══════════════════
 *      crest board   CAR PARK (your car at the front row)
 *  ─────────────────────────── the road ─────────────────────────────── south (+z)
 */
import type { XZ } from "../tapWalk";

/** An axis box on the floor that a walk cannot cross: [x0, x1, z0, z1]. */
export type Solid = [number, number, number, number];

export const COMPOUND = {
  /** The walkable ground (inside the outer hedges, the car park included). */
  bounds: [-34, 94, -66, 45] as [number, number, number, number],
  /** The walk grid's cell (m): coarser than a room's 0.2, the ground is big. */
  cell: 0.4,
  /** The car park: asphalt, two rows of bays facing an aisle, the way in from the road at the east end. */
  carPark: { x0: -24, x1: 14, z0: 27, z1: 44, bayW: 2.6, bayD: 5, rowN: 27.4, rowS: 38.6, firstX: -22.7, bays: 13 },
  /** The fence line between the car park and the grounds (hedge with railings either side of the gate). */
  fenceZ: 24,
  /** The gate: an opening in the fence, brick pillars either side. */
  gate: { x0: -3, x1: 3, pillar: 0.7 },
  /** The crest board: on two posts outside the fence, west of the gate, facing the car park. */
  board: { x: -7.0, z: 25.6, w: 4.6, h: 2.4, y0: 0.9 },
  /** The security hut: inside the fence, east of the gate, its window looking at the gate. */
  hut: { x0: 4.4, x1: 8.2, z0: 19.4, z1: 23.0, h: 2.9 },
  /** The main building: its front (south) face and the three doors in it. */
  building: { x0: -19, x1: 19, z0: -7, z1: 10, h: 7.6, doorW: 2.0, doorH: 2.6 },
  /** The forecourt in front of it (paving), and the path down to the gate. */
  forecourt: { x0: -21, x1: 21, z0: 10, z1: 19 },
  /** The pitches: middle, length along x, width along z. A and B full training pitches, C a small one. */
  pitches: [
    { id: "A", x: 62, z: 1, len: 60, wid: 38 },
    { id: "B", x: 62, z: -42, len: 60, wid: 38 },
    { id: "C", x: 0, z: -36, len: 36, wid: 24 },
  ],
  /** The small stand on pitch A's west touchline, facing east. */
  stand: { x0: 25.2, x1: 29.6, z0: -8, z1: 10, rows: 4 },
  /** Where you start: just parked, beside your car in the front row, facing the gate. */
  you: { x: -3.4, z: 34.6, yaw: 3.3 },
  /** Your car's bay (front row, nearest the gate). */
  yourBay: 8,
} as const;

/** A pitch's outline on the floor. */
export const pitchBox = (p: { x: number; z: number; len: number; wid: number }): Solid => [p.x - p.len / 2, p.x + p.len / 2, p.z - p.wid / 2, p.z + p.wid / 2];

/** The middle of bay `i` in a row (z of the row's front edge), and its car's middle. */
export function bayAt(i: number, row: "N" | "S"): XZ {
  const c = COMPOUND.carPark;
  const x = c.firstX + i * c.bayW + c.bayW / 2;
  return [x, row === "N" ? c.rowN + c.bayD / 2 : c.rowS + c.bayD / 2];
}

/** Which bays have a parked car (seeded by eye: a weekday morning, the front row nearly full). Yours included. */
export const PARKED: { bay: number; row: "N" | "S"; model: CarModel; tint: string; kind: "suv" | "saloon" | "coupe" }[] = [
  { bay: 2, row: "N", model: "suv", tint: "#ffffff", kind: "suv" },
  { bay: 4, row: "N", model: "car-1", tint: "#ffffff", kind: "saloon" },
  { bay: 5, row: "N", model: "car-4", tint: "#ffffff", kind: "coupe" },
  { bay: 0, row: "N", model: "suv", tint: "#5a5f68", kind: "suv" },
  { bay: 8, row: "N", model: "car-3", tint: "#ffffff", kind: "coupe" }, // yours: the sports car from the house's drive
  { bay: 10, row: "N", model: "classic", tint: "#ffffff", kind: "saloon" },
  { bay: 11, row: "N", model: "car-2", tint: "#ffffff", kind: "saloon" },
  { bay: 3, row: "S", model: "car-1", tint: "#8fa6c8", kind: "saloon" },
  { bay: 7, row: "S", model: "car-4", tint: "#b8b8bc", kind: "coupe" },
];
/** The game's own car models (the house's drive copies, home3d/outfits.ts CAR_LOD: ~3.9k triangles each). */
export type CarModel = "car-1" | "car-2" | "suv" | "car-3" | "classic" | "car-4";

/** A car's size on the floor (m): across, along. */
export const CAR_SIZE: Record<"suv" | "saloon" | "coupe", [number, number, number]> = {
  suv: [1.95, 4.8, 1.7], saloon: [1.85, 4.7, 1.45], coupe: [1.9, 4.5, 1.3],
};

/** The doors you can tap, where you stand for each, and where each leads. */
export type DoorLeads = "gym" | "soon" | "reception";
export interface CompoundDoor { id: string; label: string; x: number; leads: DoorLeads; sign: string; lines: string[]; verb: string }
export const DOORS: CompoundDoor[] = [
  { id: "door-gym", label: "The gym", x: -11, leads: "gym", sign: "GYM", verb: "Go in", lines: ["Weights, treadmills and the bag. Your Strength, Cardio and Focus."] },
  { id: "door-reception", label: "Reception", x: 0, leads: "reception", sign: "RECEPTION", verb: "Sign in", lines: ["Sign in for the day."] },
  { id: "door-canteen", label: "The canteen", x: 11, leads: "soon", sign: "CANTEEN", verb: "Look in", lines: ["Lunch is at half twelve."] },
];
/** The card after you go through a door that leads nowhere yet. */
export const DOOR_SOON: Record<string, string[]> = {
  "door-canteen": ["The canteen is coming soon.", "You'll pick a plate here, and it will change your next session."],
  "door-reception": ["Signed in. No messages today.", "The changing room and the physio are coming soon."],
};
/** Where you stand to use a door: on the paving, a body's width clear of the wall. */
export const doorFront = (d: CompoundDoor): XZ => [d.x, COMPOUND.building.z1 + 0.9];

/** Spots the people use (each one a standing smart object in the place: ./compoundPlace.ts). */
export interface CompoundSpot { id: string; at: XZ; face: XZ; label: string }
const P = COMPOUND.pitches[0];
const PA0 = P.x - P.len / 2; // pitch A's west touchline x
export const SPOTS: CompoundSpot[] = [
  // the coach on pitch A's touchline, then out by the poles
  { id: "coach-line", at: [PA0 + 2.2, -1], face: [PA0 + 7, 4], label: "Touchline" },
  { id: "coach-poles", at: [PA0 + 8, 12.5], face: [PA0 + 16, 8], label: "By the poles" },
  // the kit man: the kit room door on the building's east end, the cones, the goal
  { id: "kit-door", at: [COMPOUND.building.x1 + 0.9, 3.5], face: [COMPOUND.building.x1, 3.5], label: "Kit room" },
  { id: "kit-cones", at: [PA0 + 9, -8], face: [PA0 + 9, -10], label: "The cones" },
  { id: "kit-goal", at: [PA0 + 3.5, -11], face: [PA0, -11], label: "The goal" },
  // two team-mates warming up on pitch A
  // two by two, face to face 2.2 m apart (the walk-spacing rule: never inside each other, never lined up close)
  { id: "warm-1", at: [PA0 + 7, 3], face: [PA0 + 7, 5.2], label: "Warm-up" },
  { id: "warm-2", at: [PA0 + 7, 5.2], face: [PA0 + 7, 3], label: "Warm-up" },
  { id: "warm-3", at: [PA0 + 16, -4], face: [PA0 + 16, -1.8], label: "Warm-up" },
  { id: "warm-4", at: [PA0 + 16, -1.8], face: [PA0 + 16, -4], label: "Warm-up" },
  // the team-mate just arriving: his car, the reception door, the forecourt
  { id: "arr-car", at: [bayAt(4, "N")[0] + 1.5, 33.4], face: [bayAt(4, "N")[0], 30], label: "His car" },
  { id: "arr-door", at: [1.4, COMPOUND.building.z1 + 0.9], face: [1.4, COMPOUND.building.z1], label: "Reception" },
  { id: "arr-chat", at: [-6.4, 15.6], face: [-8.2, 14.6], label: "Forecourt" },
  // the bench team-mate's own spot to stretch, chatting to the one who has just arrived (1.3 m apart, face to face)
  { id: "fc-stretch", at: [-7.6, 16.3], face: [-6.4, 15.6], label: "Forecourt" },
];

/** The forecourt bench (a seat for two team-mates; ./compoundPlace.ts builds it). */
export const FORECOURT_BENCH = { id: "fc-bench", at: [-9.6, 14.2] as XZ, facing: Math.PI / 2, seats: 3, y: 0.46, len: 2.2 };

/** The people (3 to 6): who they are, where they start, which routine. */
export interface CompoundPerson { slot: string; role: "player" | "staff"; title: string; start: XZ; startYaw: number; routine: string; prop?: "clipboard" | "bag" }
export const PEOPLE: CompoundPerson[] = [
  { slot: "coach", role: "staff", title: "Coach", start: SPOTS[0].at, startYaw: Math.PI / 2, routine: "compound-coach", prop: "clipboard" },
  { slot: "kitman", role: "staff", title: "Kit man", start: [COMPOUND.building.x1 + 1.4, 5], startYaw: Math.PI / 2, routine: "compound-kitman", prop: "bag" },
  { slot: "mate-0", role: "player", title: "Team-mate", start: SPOTS[5].at, startYaw: Math.PI / 2, routine: "compound-warmup-a" },
  { slot: "mate-1", role: "player", title: "Team-mate", start: SPOTS[6].at, startYaw: -Math.PI / 2, routine: "compound-warmup-b" },
  { slot: "mate-2", role: "player", title: "Team-mate", start: [bayAt(4, "N")[0] + 1.5, 33.0], startYaw: Math.PI, routine: "compound-arriver" },
  { slot: "mate-3", role: "player", title: "Team-mate", start: [-9.0, 14.2], startYaw: Math.PI / 2, routine: "compound-bench" },
];

/** Clips with stand-ins (the people's bodies may lack a capture: ./npc.ts plays the first it has). */
export const CLIP = {
  talk: { clip: "idle_talk", or: ["talk", "idle"] },
  point: { clip: "point", or: ["idle_talk", "idle"] },
  stretch: { clip: "stretch", or: ["idle"] },
  idle: { clip: "idle" },
  pickup: { clip: "pickup", or: ["idle"] },
  clap: { clip: "applause", or: ["idle"] },
  nod: { clip: "nod", or: ["idle"] },
} as const;

type Step = { do: { kind: "use"; target: string; loop?: { clip: string; or?: readonly string[]; secs?: number }[] }; mins: [number, number]; gap?: [number, number] };
/** The routines (./routine.ts RoutineTemplate shape; repeat all day). Game minutes at the clock's rate. */
export const ROUTINES: Record<string, { id: string; repeat: true; steps: Step[] }> = {
  "compound-coach": { id: "compound-coach", repeat: true, steps: [
    { do: { kind: "use", target: "coach-line", loop: [{ ...CLIP.point, secs: 3 }, { ...CLIP.idle, secs: 4 }, { ...CLIP.clap, secs: 2.5 }] }, mins: [1.6, 2.4] },
    { do: { kind: "use", target: "coach-poles", loop: [{ ...CLIP.talk, secs: 4 }, { ...CLIP.point, secs: 3 }] }, mins: [1.2, 1.8] },
  ] },
  "compound-kitman": { id: "compound-kitman", repeat: true, steps: [
    { do: { kind: "use", target: "kit-door", loop: [{ ...CLIP.idle, secs: 3 }] }, mins: [0.4, 0.7] },
    { do: { kind: "use", target: "kit-cones", loop: [{ ...CLIP.pickup, secs: 2.2 }, { ...CLIP.idle, secs: 2 }] }, mins: [0.8, 1.2] },
    { do: { kind: "use", target: "kit-goal", loop: [{ ...CLIP.pickup, secs: 2.2 }, { ...CLIP.idle, secs: 2.5 }] }, mins: [0.7, 1.0] },
  ] },
  "compound-warmup-a": { id: "compound-warmup-a", repeat: true, steps: [
    { do: { kind: "use", target: "warm-1", loop: [{ ...CLIP.stretch, secs: 5 }, { ...CLIP.talk, secs: 4 }] }, mins: [1.6, 2.2] },
    { do: { kind: "use", target: "warm-3", loop: [{ ...CLIP.stretch, secs: 5 }, { ...CLIP.idle, secs: 3 }] }, mins: [1.2, 1.8] },
  ] },
  "compound-warmup-b": { id: "compound-warmup-b", repeat: true, steps: [
    { do: { kind: "use", target: "warm-2", loop: [{ ...CLIP.talk, secs: 4 }, { ...CLIP.stretch, secs: 5 }] }, mins: [1.6, 2.2] },
    { do: { kind: "use", target: "warm-4", loop: [{ ...CLIP.idle, secs: 3 }, { ...CLIP.stretch, secs: 5 }] }, mins: [1.2, 1.8] },
  ] },
  "compound-arriver": { id: "compound-arriver", repeat: true, steps: [
    { do: { kind: "use", target: "arr-car", loop: [{ ...CLIP.idle, secs: 3 }] }, mins: [0.3, 0.5] },
    { do: { kind: "use", target: "arr-chat", loop: [{ ...CLIP.talk, secs: 4 }, { ...CLIP.nod, secs: 2 }] }, mins: [0.9, 1.3] },
    { do: { kind: "use", target: "arr-door", loop: [{ ...CLIP.idle, secs: 3 }] }, mins: [0.3, 0.5] },
  ] },
  "compound-bench": { id: "compound-bench", repeat: true, steps: [
    { do: { kind: "use", target: "fc-bench" }, mins: [1.8, 2.6] },
    { do: { kind: "use", target: "fc-stretch", loop: [{ ...CLIP.stretch, secs: 5 }, { ...CLIP.talk, secs: 3 }] }, mins: [0.6, 0.9] },
  ] },
};

/** The walk-spacing rule (as the cut scenes' crowds): two people never closer than this side by side (m); one
 *  behind the other keeps WALK_GAP_FRONT. tests/star/compound.mts walks every routine and checks it. */
export const WALK_GAP_SIDE = 0.55;
export const WALK_GAP_FRONT = 0.7;

/** How fast the compound's clock runs (times real time): a game minute is 15 real seconds. */
export const COMPOUND_RATE = 4;
/** Longest any one thing may take a person, walking included (s): the routine test holds every step to it. */
export const STUCK_MAX_S = 45;

/** Every solid on the plan: the building, the hut, the fence, the pillars, the board's posts, the
 *  parked cars, the stand, the goals, the benches, lamp posts, planters. ./compoundPlace.ts draws them. */
/** The tall things the following camera must not pass through: the fence and gate pillars, the hut, the
 *  building, the stand (cars, benches and posts are below the camera). */
export function tallSolids(): Solid[] {
  const C = COMPOUND;
  const fz = C.fenceZ, h = C.hut, b = C.building, st = C.stand;
  return [
    [C.bounds[0], C.gate.x0, fz - 0.8, fz + 0.6], [C.gate.x1, C.bounds[1], fz - 0.8, fz + 0.6], // the gates slide behind the railings
    [h.x0, h.x1, h.z0, h.z1], [b.x0, b.x1, b.z0, b.z1], [st.x0, st.x1, st.z0, st.z1],
  ];
}

/** How far a ray from (x, z) along (dx, dz) (a unit step) runs before it enters one of `boxes` (Infinity: none). */
export function rayToBoxes(x: number, z: number, dx: number, dz: number, boxes: Solid[]): number {
  let best = Infinity;
  for (const [x0, x1, z0, z1] of boxes) {
    if (x > x0 && x < x1 && z > z0 && z < z1) continue; // standing inside it (the gate's gap is not in it)
    let t0 = 0, t1 = Infinity;
    for (const [o, d, lo, hi] of [[x, dx, x0, x1], [z, dz, z0, z1]] as [number, number, number, number][]) {
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) { t0 = Infinity; break; } continue; }
      let a = (lo - o) / d, c = (hi - o) / d;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c);
    }
    if (t0 <= t1 && t0 < best) best = t0;
  }
  return best;
}

export function compoundSolids(): Solid[] {
  const C = COMPOUND;
  const s: Solid[] = [];
  const b = C.building; s.push([b.x0, b.x1, b.z0, b.z1]);
  const h = C.hut; s.push([h.x0, h.x1, h.z0, h.z1]);
  // the fence (hedge + railings), with the gate open
  const fz = C.fenceZ;
  s.push([C.bounds[0], C.gate.x0 - C.gate.pillar, fz - 0.45, fz + 0.45]);
  s.push([C.gate.x1 + C.gate.pillar, C.bounds[1], fz - 0.45, fz + 0.45]);
  for (const x of [C.gate.x0 - C.gate.pillar / 2, C.gate.x1 + C.gate.pillar / 2]) s.push([x - 0.4, x + 0.4, fz - 0.45, fz + 0.45]);
  // the board's two posts
  for (const dx of [-C.board.w / 2 + 0.3, C.board.w / 2 - 0.3]) s.push([C.board.x + dx - 0.15, C.board.x + dx + 0.15, C.board.z - 0.15, C.board.z + 0.15]);
  // parked cars (yours too)
  for (const p of PARKED) { const [x, z] = bayAt(p.bay, p.row); const [w, l] = CAR_SIZE[p.kind]; s.push([x - w / 2, x + w / 2, z - l / 2, z + l / 2]); }
  // the car park's kerb on the road side, but for the way in at the east end
  s.push([C.carPark.x0, C.carPark.x1 - 7, C.carPark.z1, C.carPark.z1 + 0.4]);
  // the car park's west kerb
  s.push([C.carPark.x0 - 0.4, C.carPark.x0, C.carPark.z0, C.carPark.z1]);
  // the stand
  const st = C.stand; s.push([st.x0, st.x1, st.z0, st.z1]);
  // goals: a box over each goal's frame and net (2 m deep)
  for (const g of goalsOf()) s.push(g.box);
  // the forecourt bench and the planters
  const fb = FORECOURT_BENCH; s.push([fb.at[0] - 0.5, fb.at[0] - 0.05, fb.at[1] - fb.len / 2, fb.at[1] + fb.len / 2]);
  for (const [x, z] of PLANTERS) s.push([x - 0.7, x + 0.7, z - 0.7, z + 0.7]);
  // lamp posts and the flagpole
  for (const [x, z] of LAMPS) s.push([x - 0.15, x + 0.15, z - 0.15, z + 0.15]);
  s.push([FLAG[0] - 0.15, FLAG[0] + 0.15, FLAG[1] - 0.15, FLAG[1] + 0.15]);
  // floodlight masts
  for (const [x, z] of MASTS) s.push([x - 0.3, x + 0.3, z - 0.3, z + 0.3]);
  // the mannequins (a wall of four) and the pole lines on pitch A
  for (const [x, z] of MANNEQUINS) s.push([x - 0.22, x + 0.22, z - 0.22, z + 0.22]);
  return s;
}

/** Goals: one at each end of each pitch, facing in. `box` is the floor box a walk avoids. */
export function goalsOf(): { x: number; z: number; face: number; w: number; h: number; box: Solid }[] {
  const out: { x: number; z: number; face: number; w: number; h: number; box: Solid }[] = [];
  for (const p of COMPOUND.pitches) {
    const w = p.id === "C" ? 5 : 7.32, h = p.id === "C" ? 2 : 2.44;
    for (const s of [-1, 1]) {
      const x = p.x + s * p.len / 2;
      out.push({ x, z: p.z, face: s < 0 ? Math.PI / 2 : -Math.PI / 2, w, h, box: s < 0 ? [x - 2, x + 0.15, p.z - w / 2 - 0.15, p.z + w / 2 + 0.15] : [x - 0.15, x + 2, p.z - w / 2 - 0.15, p.z + w / 2 + 0.15] });
    }
  }
  return out;
}

/** Planters on the forecourt (big square pots with a tree or a shrub). */
export const PLANTERS: XZ[] = [[-17, 15.5], [-4.5, 17.8], [4.5, 17.8], [17, 15.5]];
/** Lamp posts: along the path, round the forecourt and the car park. */
export const LAMPS: XZ[] = [[-2.4, 21], [2.4, 21], [-15, 18.6], [15, 18.6], [-16, 26.2], [10, 26.2], [-23, 36], [22.4, 14], [22.4, -10], [22.4, -32]];
/** The flagpole (the club's flag) by the gate path. */
export const FLAG: XZ = [-3.2, 18.6];
/** Floodlight masts: pitch A and B corners on the outer sides. */
export const MASTS: XZ[] = [[31, -19.4], [31, 21.6], [93, -19.4], [93, 21.6], [31, -62.4], [93, -62.4]];
/** Training kit on pitch A: a wall of mannequins on the edge of the box, cone lines, slalom poles. */
export const MANNEQUINS: XZ[] = [[PA0 + 20.5, -2], [PA0 + 20.5, -1.2], [PA0 + 20.5, -0.4], [PA0 + 20.5, 0.4]];
export const CONES: XZ[] = (() => {
  const out: XZ[] = [];
  for (let i = 0; i < 8; i++) out.push([PA0 + 6 + i * 1.6, -9]);
  for (let i = 0; i < 6; i++) out.push([PA0 + 26 + (i % 2) * 6, -12 + Math.floor(i / 2) * 6]);
  for (let i = 0; i < 6; i++) out.push([PA0 + 34 + i * 2.2, 14 - (i % 2) * 1.5]);
  // pitch B, a rondo square
  for (const [dx, dz] of [[-5, -5], [5, -5], [5, 5], [-5, 5]] as const) out.push([COMPOUND.pitches[1].x - 10 + dx, COMPOUND.pitches[1].z + dz]);
  return out;
})();
export const POLES: XZ[] = (() => {
  const out: XZ[] = [];
  for (let i = 0; i < 7; i++) out.push([PA0 + 15 + i * 1.4, 7 + (i % 2) * 0.9]);
  return out;
})();

/** The zones the place is cut into: each a set of joined draws the camera skips when it can't see them. */
export interface Zone { id: string; box: [number, number, number, number]; h: number }
export const ZONES: Zone[] = [
  { id: "carpark", box: [-26, 16, 25, 46], h: 4 },
  { id: "gate", box: [-12, 10, 18.5, 27], h: 4 },
  { id: "forecourt", box: [-22, 22, 10, 20], h: 7 },
  { id: "building", box: [-19.5, 19.5, -7.5, 10.5], h: 9 },
  { id: "stand", box: [24.5, 30.5, -9, 11], h: 4.5 },
  { id: "pitchA", box: [30, 94, -21, 23], h: 3 },
  { id: "pitchB", box: [30, 94, -64, -20], h: 3 },
  { id: "pitchC", box: [-20, 20, -50, -22], h: 3 },
];
/** The zone a spot is in (null: open ground). */
export function zoneAt(x: number, z: number): string | null {
  for (const zn of ZONES) if (x >= zn.box[0] && x <= zn.box[1] && z >= zn.box[2] && z <= zn.box[3]) return zn.id;
  return null;
}

/**
 * THE SPEED BUDGET (standing rule, 28 Nov 2026): wherever you stand and whichever way you look, a
 * frame may cost at most this many draw calls and triangles. Medium is where every phone starts.
 * tests/star/compound.mts holds the measured numbers (COMPOUND_MEASURED) to it.
 */
export const COMPOUND_BUDGET = {
  high: { draws: 140, triangles: 160_000 },
  medium: { draws: 90, triangles: 90_000 },
  low: { draws: 60, triangles: 70_000 },
} as const;

/** The viewpoints the budget is measured from (you stand here; the camera turns all the way round). */
export const COMPOUND_VIEWS: { id: string; at: XZ }[] = [
  { id: "car park", at: [COMPOUND.you.x, COMPOUND.you.z] },
  { id: "gate", at: [0, 22] },
  { id: "forecourt", at: [-6, 13] },
  { id: "gym door", at: [DOORS[0].x, COMPOUND.building.z1 + 0.9] },
  { id: "stand", at: [22.4, 4] },
  { id: "pitch A", at: [44, 2] },
  { id: "pitch B", at: [50, -40] },
  { id: "pitch C", at: [0, -30] },
];

/** One measured frame: a viewpoint, a tier, the worst way you can look from it, standing and walking. */
export interface CompoundMeasure { view: string; tier: "high" | "medium" | "low"; draws: number; triangles: number; walkDraws: number; walkTriangles: number }
/**
 * MEASURED (scripts/world3d/compound-measure.mjs, 28 Nov 2026): a Galaxy S20 screen (412×915 at 2.625), its browser
 * name, the page's thread slowed 4×; each viewpoint the worst of 8 ways round, standing, and the worst frame while
 * walking (the sun's shadow redrawn). Re-measure after any change to the compound and paste the script's line here.
 */
export const COMPOUND_MEASURED: CompoundMeasure[] = [
  {"view":  "car park", "tier":  "medium", "draws":  64, "triangles":  74978, "walkDraws":  48, "walkTriangles":  46933},
  {"view":  "gate", "tier":  "medium", "draws":  55, "triangles":  58754, "walkDraws":  54, "walkTriangles":  51583},
  {"view":  "forecourt", "tier":  "medium", "draws":  43, "triangles":  60578, "walkDraws":  36, "walkTriangles":  44099},
  {"view":  "gym door", "tier":  "medium", "draws":  45, "triangles":  44385, "walkDraws":  29, "walkTriangles":  28730},
  {"view":  "stand", "tier":  "medium", "draws":  52, "triangles":  56758, "walkDraws":  26, "walkTriangles":  34432},
  {"view":  "pitch A", "tier":  "medium", "draws":  45, "triangles":  65332, "walkDraws":  21, "walkTriangles":  33246},
  {"view":  "pitch B", "tier":  "medium", "draws":  68, "triangles":  57505, "walkDraws":  24, "walkTriangles":  29845},
  {"view":  "pitch C", "tier":  "medium", "draws":  38, "triangles":  37811, "walkDraws":  36, "walkTriangles":  33743},
  {"view":  "car park", "tier":  "low", "draws":  55, "triangles":  55904, "walkDraws":  38, "walkTriangles":  30524},
  {"view":  "gate", "tier":  "low", "draws":  46, "triangles":  48506, "walkDraws":  47, "walkTriangles":  32545},
  {"view":  "forecourt", "tier":  "low", "draws":  36, "triangles":  33329, "walkDraws":  34, "walkTriangles":  32193},
  {"view":  "gym door", "tier":  "low", "draws":  38, "triangles":  28512, "walkDraws":  30, "walkTriangles":  33458},
  {"view":  "stand", "tier":  "low", "draws":  43, "triangles":  41054, "walkDraws":  22, "walkTriangles":  21224},
  {"view":  "pitch A", "tier":  "low", "draws":  38, "triangles":  38125, "walkDraws":  18, "walkTriangles":  19930},
  {"view":  "pitch B", "tier":  "low", "draws":  60, "triangles":  45671, "walkDraws":  25, "walkTriangles":  25152},
  {"view":  "pitch C", "tier":  "low", "draws":  31, "triangles":  27747, "walkDraws":  26, "walkTriangles":  22924},
  {"view":  "car park", "tier":  "high", "draws":  71, "triangles":  124339, "walkDraws":  51, "walkTriangles":  82546},
  {"view":  "gate", "tier":  "high", "draws":  60, "triangles":  94192, "walkDraws":  55, "walkTriangles":  70518},
  {"view":  "forecourt", "tier":  "high", "draws":  46, "triangles":  96282, "walkDraws":  40, "walkTriangles":  88617},
  {"view":  "gym door", "tier":  "high", "draws":  50, "triangles":  91051, "walkDraws":  30, "walkTriangles":  42804},
  {"view":  "stand", "tier":  "high", "draws":  55, "triangles":  137630, "walkDraws":  27, "walkTriangles":  50948},
  {"view":  "pitch A", "tier":  "high", "draws":  39, "triangles":  107858, "walkDraws":  21, "walkTriangles":  49776},
  {"view":  "pitch B", "tier":  "high", "draws":  72, "triangles":  88704, "walkDraws":  27, "walkTriangles":  58360},
  {"view":  "pitch C", "tier":  "high", "draws":  43, "triangles":  72454, "walkDraws":  40, "walkTriangles":  67676},
];
