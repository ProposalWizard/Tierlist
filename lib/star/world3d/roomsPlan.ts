/**
 * THE COMPOUND'S RECEPTION AND CANTEEN — the plan (28 Nov 2026). The training compound's front has three doors
 * (./compoundPlan.ts DOORS); the gym door already opened the gym. These two open their own rooms:
 *
 *   RECEPTION  a modern training-ground front desk: the receptionist behind it (tap him: the next match and the
 *              time to leave, from the career clock), the club's crest on a timber wall, a trophy cabinet (the
 *              career's own trophies), a sofa and two armchairs, a screen with the next fixture.
 *   CANTEEN    tables and chairs, the serving counter with its plates, three team-mates eating (the lunch card's
 *              own three: life/lunch.ts lunchMates), a chef behind the counter at the top (a tea urn and a tray of
 *              sandwiches at the bottom: the lunch card's words, life/lunch.ts hallOf). Walk to the counter: the
 *              SAME lunch card opens (components/star/LunchCard.tsx, its rules in life/lunch.ts, nothing copied);
 *              sit with a team-mate: the lunch card's table options for him.
 *
 * Pure data and maths (no three.js), so tests/star/compoundRooms.mts can walk it. ./roomsPlace.ts builds the 3D
 * from it; ./testScene.ts runs it (places "reception" and "canteen"). Ground plan as every room: metres, x across
 * (east +), z towards the door (south +); a facing 0 looks south (+z), π north.
 */
import type { CareerState } from "../types";
import type { XZ } from "../tapWalk";
import { clockOf, nextMatchInfo, hhmm, shortDate, dateOf, absOf, DAY_MINS } from "../life/clock";
import { hallOf, lunchMates, type HallKind } from "../life/lunch";

export type RoomId = "reception" | "canteen";
/** An axis box on the floor a walk cannot cross: [x0, x1, z0, z1]. */
export type Solid = [number, number, number, number];

/** The door you came in by: the south wall's middle. */
export const ROOM_DOOR = { w2: 0.75, h: 2.4 };

// ── RECEPTION ────────────────────────────────────────────────────────────────

export const RECEPTION = {
  W2: 5.5, D2: 4.5, H: 3.4,
  /** The desk: its body, the raised ledge's top, the worktop behind it. */
  desk: { x0: -1.9, x1: 1.9, z0: -2.0, z1: -1.2, ledge: 1.08, top: 0.76 },
  /** The receptionist stands behind the desk, facing the door. */
  clerk: { at: [0.35, -2.5] as XZ, yaw: 0 },
  /** Where you stand to talk to him: in front of the desk. */
  talk: [0.35, -0.6] as XZ,
  /** The trophy cabinet on the west wall: its box, its glass front faces east. */
  cabinet: { x0: -5.5, x1: -4.95, z0: -1.7, z1: 1.7, h: 2.1 },
  /** The next-fixture screen on the east wall (its middle z, its height and width). */
  screen: { z: 0.2, y: 1.85, w: 2.3, h: 1.3 },
  /** The sofa facing the screen (three seats), the two armchairs facing each other, the coffee table. */
  sofa: { at: [2.18, 0.2] as XZ, facing: Math.PI / 2, seats: 3, y: 0.44, spacing: 0.62, box: [1.72, 2.3, -0.82, 1.22] as Solid },
  chairs: [
    { id: "armchair-n", at: [3.6, -1.45] as XZ, facing: 0, box: [3.22, 3.98, -1.86, -1.28] as Solid },
    { id: "armchair-s", at: [3.6, 1.85] as XZ, facing: Math.PI, box: [3.22, 3.98, 2.02, 2.6] as Solid },
  ],
  table: [3.15, 3.95, -0.55, 0.95] as Solid,
  plants: [[-4.85, 3.85], [4.85, 3.85], [-4.85, -3.85], [4.85, -3.85]] as XZ[],
  /** Where you start: two steps in from the door, facing in (camera D has the room behind you to sit back in). */
  you: { x: 0, z: 2.4, yaw: Math.PI },
} as const;

export function receptionSolids(): Solid[] {
  const R = RECEPTION, s: Solid[] = [];
  s.push([R.desk.x0, R.desk.x1, R.desk.z0 - 0.05, R.desk.z1 + 0.05]);
  // behind the desk is his: a low gate either side (you never walk round to his side)
  s.push([R.desk.x0 - 0.15, R.desk.x0, -R.D2, R.desk.z1], [R.desk.x1, R.desk.x1 + 0.15, -R.D2, R.desk.z1]);
  s.push([R.cabinet.x0, R.cabinet.x1, R.cabinet.z0, R.cabinet.z1]);
  s.push(R.sofa.box, ...R.chairs.map((c) => c.box), R.table);
  for (const [x, z] of R.plants) s.push([x - 0.35, x + 0.35, z - 0.35, z + 0.35]);
  return s;
}

// ── CANTEEN ──────────────────────────────────────────────────────────────────

export const CANTEEN = {
  W2: 6, D2: 4.5, H: 3.2,
  /** The serving counter along the north wall: its box and its top. */
  counter: { x0: -4.1, x1: 2.1, z0: -3.45, z1: -2.65, top: 0.95 },
  /** Behind it: the chef (Premier League and Championship), facing the room. */
  chef: { at: [-1.0, -3.95] as XZ, yaw: 0 },
  /** Where you stand at the counter: the lunch card opens here. */
  serve: [-1.0, -2.05] as XZ,
  /** The tea urn on the counter (the lower leagues: no chef, an urn and the sandwiches). */
  urn: [1.25, -3.05] as XZ,
  /** Tables (1.6 × 0.8 m, 0.75 high), two rows either side of the aisle from the door to the counter. */
  tables: [[-3.6, -0.3], [3.0, -0.3], [-3.6, 2.7], [3.0, 2.7]] as XZ[],
  tableW2: 0.8, tableD2: 0.4, tableH: 0.75,
  /** A chair: its middle this far from the table's middle (pulled out: the knees clear the top), 0.45 either side. */
  chairOff: 0.95, chairSide: 0.45, seatY: 0.46,
  you: { x: 0, z: 2.4, yaw: Math.PI },
} as const;
/** A chair's sitter: his hips this far back from the chair's middle (towards its back), and from his hips to the
 *  seat's front edge (the thighs clear it: the seat check, RUL-3D-005). */
export const CHAIR_HIPS_BACK = 0.06;
export const CHAIR_FRONT = 0.17;
/** Where a sitter's hips go on a chair. */
export const hipsOn = (c: Chair): XZ => [c.at[0], c.at[1] + (c.facing === 0 ? -CHAIR_HIPS_BACK : CHAIR_HIPS_BACK)];

/** Every chair: its id, the table it is at, its middle (= the sitter's hips), its facing (towards the table). */
export interface Chair { id: string; table: number; at: XZ; facing: number }
export function canteenChairs(): Chair[] {
  const C = CANTEEN, out: Chair[] = [];
  C.tables.forEach(([tx, tz], t) => {
    for (const side of [-1, 1] as const) for (const sx of [-1, 1] as const) {
      // side -1: the north chairs (facing south, 0); +1: the south chairs (facing north, π)
      out.push({ id: `chair-${t}-${side < 0 ? "n" : "s"}${sx < 0 ? "w" : "e"}`, table: t, at: [tx + sx * C.chairSide, tz + side * C.chairOff], facing: side < 0 ? 0 : Math.PI });
    }
  });
  return out;
}

/** The three team-mates' chairs (lunchMates order) and, for each, the chair beside him you sit in. Two face each
 *  other across the first table, the third at the other front table. */
export const MATE_SEATS: { mate: string; you: string }[] = [
  { mate: "chair-0-sw", you: "chair-0-se" },
  { mate: "chair-0-ne", you: "chair-0-nw" },
  { mate: "chair-1-nw", you: "chair-1-ne" },
];

export function canteenSolids(): Solid[] {
  const C = CANTEEN, s: Solid[] = [];
  s.push([C.counter.x0, C.counter.x1, C.counter.z0, C.counter.z1]);
  // behind the counter is the kitchen's: you never walk round it
  s.push([C.counter.x1, C.counter.x1 + 0.2, -C.D2, C.counter.z1], [C.counter.x0 - 0.2, C.counter.x0, -C.D2, C.counter.z1]);
  for (const [tx, tz] of C.tables) s.push([tx - C.tableW2, tx + C.tableW2, tz - C.tableD2, tz + C.tableD2]);
  return s;
}

// ── Both rooms ───────────────────────────────────────────────────────────────

export const roomOf = (id: RoomId) => (id === "reception" ? RECEPTION : CANTEEN);
export const roomSolids = (id: RoomId): Solid[] => (id === "reception" ? receptionSolids() : canteenSolids());
/** The walls as solids (the door's gap in the south wall). */
export function wallSolids(id: RoomId): Solid[] {
  const { W2, D2 } = roomOf(id), d = ROOM_DOOR.w2;
  return [[-W2 - 1, -W2, -D2 - 1, D2 + 1], [W2, W2 + 1, -D2 - 1, D2 + 1], [-W2 - 1, W2 + 1, -D2 - 1, -D2], [-W2 - 1, -d, D2, D2 + 1], [d, W2 + 1, D2, D2 + 1]];
}

/** Out of a room's door: back to the compound, just outside that room's door on the forecourt. */
export function roomBack(id: RoomId): { label: string; startAt: `${RoomId}-door` } {
  return { label: "Compound", startAt: `${id}-door` };
}
/** The compound's door that leads into a room (./compoundPlan.ts DOORS ids). */
export const ROOM_DOOR_ID: Record<RoomId, string> = { reception: "door-reception", canteen: "door-canteen" };

/** The people in the rooms (invented names). The receptionist and the chef are staff, cast from the people presets. */
export const RECEPTIONIST = { id: "staff-reception", name: "Callum", title: "Reception" };
export const CHEF = { id: "staff-chef", name: "Marco", title: "Club chef" };
/** The chef is behind the counter at the top two levels (the lunch card's "chef" and "canteen" halls); lower down
 *  it is the tea urn and a tray of sandwiches on the counter, nobody behind it (the card's "counter" and "urn"). */
export const hasChef = (k: HallKind) => k === "chef" || k === "canteen";

// ── What the rooms say (from the career, read once as you walk in) ───────────

export interface RoomInfo {
  /** The receptionist's line: the next match and when you leave, from the clock. */
  desk: string[];
  /** The fixture screen: a title and lines. */
  screen: { title: string; lines: string[] };
  /** The trophy cabinet: one line per trophy (empty: none yet). */
  trophies: string[];
  /** The canteen's hall (life/lunch.ts hallOf): its kind and words, the menu board. */
  hall: { kind: HallKind; title: string; menu: [string, string][] };
  /** The three team-mates at the tables (life/lunch.ts lunchMates): the SAME three the lunch card lists. */
  mates: { id: string; name: string }[];
  /** The career clock's minute of the day (the room's clock starts there). */
  clock?: number;
}

/** Everything the two rooms show, read from the career (pure). */
export function roomInfo(c: CareerState): RoomInfo {
  const s = clockOf(c), now = absOf(s);
  const nx = nextMatchInfo(c);
  const greet = s.m < 12 * 60 ? "Morning" : s.m < 18 * 60 ? "Afternoon" : "Evening";
  let desk: string[], screen: RoomInfo["screen"];
  if (!nx) {
    desk = [`${greet}. No more matches this season.`, "Enjoy the break. You've earned it."];
    screen = { title: "SEASON OVER", lines: ["No more fixtures", "See you in pre-season"] };
  } else {
    const ha = nx.f.home ? "at home" : "away";
    const when = shortDate(dateOf(c, nx.day));
    const ko = hhmm(nx.ko);
    const daysTo = nx.day - s.d;
    const leaveDay = Math.floor(nx.leave / DAY_MINS);
    const leave = now >= nx.leave ? "The coach is outside. It's time to go."
      : leaveDay === s.d ? `You leave at ${hhmm(nx.leave)} today, so don't wander off.`
      : leaveDay === s.d + 1 ? `You leave tomorrow at ${hhmm(nx.leave)}.`
      : `You leave on ${shortDate(dateOf(c, leaveDay))} at ${hhmm(nx.leave)}.`;
    const dayWord = daysTo <= 0 ? "today" : daysTo === 1 ? "tomorrow" : when;
    desk = [`${greet}. ${nx.f.opponent} ${ha}, ${dayWord}, kick-off ${ko}.`, leave];
    screen = { title: "NEXT MATCH", lines: [`${nx.f.home ? c.player.club : nx.f.opponent} v ${nx.f.home ? nx.f.opponent : c.player.club}`, `${when} · ${ko}`, nx.f.competition ? String(nx.f.competition) : "League"] };
  }
  const trophies = (c.trophies ?? []).slice(-8).map((t) => `${t.competition} · season ${t.season}`);
  const h = hallOf(c);
  const menu: [string, string][] = (["protein", "pasta", "balanced", "treat"] as const).map((p) => [p, h.food[p]]);
  return { desk, screen, trophies, hall: { kind: h.kind, title: h.title, menu }, mates: lunchMates(c, MATE_SEATS.length).map((m) => ({ id: m.id, name: m.short })), clock: s.m };
}

/**
 * THE BUDGET: each room at most the club gym's own frame (Medium, 390×844 at 1×, room + people), measured by
 * scripts/world3d/compound-rooms-shots.mjs with the gym the same way on the same day. tests/star/compoundRooms.mts
 * holds ROOMS_MEASURED to it.
 */
export const GYM_FRAME = { draws: 38, triangles: 98_200 };
export interface RoomMeasure { room: RoomId | "gym"; view: string; draws: number; triangles: number }
export const ROOMS_MEASURED: RoomMeasure[] = [
  // measured 28 Nov 2026, Medium, 390×844 at 1× (scripts/world3d/compound-rooms-shots.mjs)
  { room: "gym", view: "gym-0-walk-in", draws: 33, triangles: 98156 },
  { room: "gym", view: "gym-0-middle", draws: 38, triangles: 98018 },
  { room: "reception", view: "reception-2-inside", draws: 14, triangles: 34060 },
  { room: "reception", view: "reception-3-desk-line", draws: 14, triangles: 34060 },
  { room: "reception", view: "reception-4-wide", draws: 14, triangles: 34060 },
  { room: "reception", view: "reception-5-wide-east", draws: 14, triangles: 34060 },
  { room: "reception", view: "reception-6-cabinet", draws: 14, triangles: 34060 },
  { room: "reception", view: "reception-7-sofa", draws: 14, triangles: 34060 },
  { room: "canteen", view: "canteen-2-inside", draws: 21, triangles: 86764 },
  { room: "canteen", view: "canteen-3-wide", draws: 22, triangles: 86758 },
  { room: "canteen", view: "canteen-4-wide-west", draws: 21, triangles: 86710 },
  { room: "canteen", view: "canteen-6-counter-lunch-open", draws: 21, triangles: 86764 },
  { room: "canteen", view: "canteen-8-sat-with-mate", draws: 23, triangles: 86760 },
  { room: "canteen", view: "canteen-9-chat", draws: 24, triangles: 86816 },
  { room: "canteen", view: "canteen-hall-canteen-wide", draws: 22, triangles: 85858 },
  { room: "canteen", view: "canteen-hall-urn-wide", draws: 19, triangles: 68176 },
];
