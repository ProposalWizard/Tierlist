/**
 * THE SHOPPING STREET, phase 1: the plan (pure, no three.js; tests/star/street3d.mts).
 *
 * Harry, 28 Nov 2026: "driving, horse riding, garden levels, shopping, fixing any problems between
 * 3d places". Row 7 of docs/research/gym-compound-driving-2026-11-27.md: "the bigger shop street
 * (showroom, boutique, barber, public gym)". Phase 1 is a short high street you walk down from the
 * garden gate, with four doors:
 *
 *   the 3D shop        (east)  → the 3D shop (phase shop-3d); its front doors bring you back here
 *   the car showroom   (east)  → the shop's Cars aisle (MenuShop "cars")
 *   the boutique       (west)  → the shop's Drip aisle (MenuShop "drip")
 *   the barber         (west)  → a "coming soon" card (no barber game yet); you stay on the street
 *
 * Plan (metres): the street runs north (-z) to south (+z). The road is x in [-ROAD, ROAD], the
 * pavements run to the shop fronts at x = ±FRONT. You arrive from the garden lane at the south
 * end; walking off the south end takes you back to the garden. The public gym (row 7) and the
 * drive here (docs/plans/DRIVING_PLAN.md) are later phases.
 */
import type { CareerState } from "../types";
import { LIFESTYLE_ALL_LEVELS, baseIdOf } from "../shopData";
import { formatMoney, MONEY_SIGN } from "../money";

/** Half the road's width (kerb to kerb). */
export const ROAD = 3.3;
/** Where the shop fronts stand (x = ±FRONT). */
export const FRONT = 7.4;
/** The north end: the face of the building across the top of the street. */
export const NORTH = -26;
/** The south end: past here you are back on the lane to your garden. */
export const SOUTH = 21.5;
/** Your body's radius (as the garden: lib/star/garden3d/scene.ts RR). */
export const BODY = 0.32;

export type StreetDoor = "shop" | "cars" | "drip" | "barber";
/** Where you appear: the lane from the garden, or outside a door you came out of. */
export type StreetArrive = "gate" | StreetDoor;

export interface StreetShop {
  id: StreetDoor;
  /** +1 east side (front faces west), -1 west side (front faces east). */
  side: 1 | -1;
  /** The middle of the front along the street, and how wide it is. */
  z: number;
  width: number;
  /** Half the doorway's width. */
  doorHalf: number;
  /** The fascia. Our own names only (no real brands). */
  name: string;
  /** False: the door is shut (the barber), walking up to it shows its card instead. */
  opens: boolean;
}

export const STREET_SHOPS: StreetShop[] = [
  { id: "shop", side: 1, z: -7, width: 12, doorHalf: 1.2, name: "KNOWITBALL", opens: true },
  { id: "cars", side: 1, z: 9.5, width: 13, doorHalf: 1.2, name: "KIB MOTORS", opens: true },
  { id: "drip", side: -1, z: -6, width: 10, doorHalf: 1.0, name: "THE DRIP", opens: true },
  { id: "barber", side: -1, z: 8, width: 7, doorHalf: 0.8, name: "BARBER", opens: false },
];

export const shopOf = (id: StreetDoor): StreetShop => STREET_SHOPS.find((s) => s.id === id)!;

/** What a door leads to in the career (app/star-dev/page.tsx reads this). */
export type DoorRoute =
  | { kind: "phase"; phase: "shop-3d" }
  | { kind: "menu"; phase: "shop-lifestyle"; cat: "cars" | "drip" }
  | { kind: "card"; card: "barber" };

export function doorRoute(id: StreetDoor): DoorRoute {
  if (id === "shop") return { kind: "phase", phase: "shop-3d" };
  if (id === "cars") return { kind: "menu", phase: "shop-lifestyle", cat: "cars" };
  if (id === "drip") return { kind: "menu", phase: "shop-lifestyle", cat: "drip" };
  return { kind: "card", card: "barber" };
}

/** Where you stand when you arrive: [x, z, yaw] (yaw 0 faces south, π faces north). */
export function arrivalOf(a: StreetArrive): [number, number, number] {
  if (a === "gate") return [-5.6, 18.2, Math.PI];
  const s = shopOf(a);
  // a step out of the door, facing across the street
  return [s.side * (FRONT - 1.7), s.z, s.side > 0 ? -Math.PI / 2 : Math.PI / 2];
}

/** The doorway a point is in (a body's width inside the door's opening, at the front), or null. */
export function doorwayAt(x: number, z: number): StreetShop | null {
  for (const s of STREET_SHOPS) {
    if (Math.abs(z - s.z) < s.doorHalf - 0.2 && s.side * x > FRONT - 0.9) return s;
  }
  return null;
}

/** Far enough through the doorway to go in (the screen changes); for a shut door, close enough to knock. */
export function throughDoor(s: StreetShop, x: number): boolean {
  return s.opens ? s.side * x > FRONT + 0.1 : s.side * x > FRONT - BODY - 0.05;
}

/** How deep into a doorway you may step (the open doors' recess), past the front line. */
export const DOOR_RECESS = 0.6;

/** Walked off the south end, back towards the garden. */
export const leftSouth = (z: number) => z > SOUTH + 0.2;

/** The walkable box (the shop fronts, the building across the north end, the lane at the south). */
export const WALK_BOX: [number, number, number, number] = [-FRONT + BODY, FRONT - BODY, NORTH + 0.6 + BODY, SOUTH + 0.6];

// ── Street furniture: every piece's footprint, so the walk and the people keep off it ──
/** Lamp posts and trees stand in the pavement at x = ±FURN, never in front of a door. */
export const FURN = 4.25;
const clearOfDoors = (side: 1 | -1, z: number, room: number) => STREET_SHOPS.every((s) => s.side !== side || Math.abs(z - s.z) > s.doorHalf + room);
export const LAMPS: [number, number][] = [];
export const TREES: [number, number][] = [];
for (const side of [-1, 1] as const) {
  for (let z = -22; z <= 20; z += 8.5) if (clearOfDoors(side, z, 1.4)) LAMPS.push([side * FURN, z]);
  // (none at the bottom of the street: you arrive there and see up it, not into a crown)
  for (let z = -17.75; z <= 12; z += 8.5) if (clearOfDoors(side, z, 2.2)) TREES.push([side * FURN, z]);
}
/** Benches along the pavement: [x, z, facing yaw]. */
export const BENCHES: [number, number, number][] = [[FURN, 5.2, -Math.PI / 2], [-FURN, -11.6, Math.PI / 2], [-FURN, 14.0, Math.PI / 2]];
/** The zebra crossing (centre z): the people cross the road only here. */
export const ZEBRA_Z = 1.5;
/** Parked cars along the kerbs: model id, x, z (pointing along the street). */
export const PARKED: { id: string; x: number; z: number; ry: number }[] = [
  { id: "car-2", x: 2.15, z: -16, ry: Math.PI },
  { id: "suv", x: 2.15, z: -3.6, ry: Math.PI },
  { id: "classic", x: 2.15, z: 17.2, ry: Math.PI },
  { id: "car-1", x: -2.15, z: -14.5, ry: 0 },
  { id: "car-3", x: -2.15, z: 14.2, ry: 0 },
];
/** A parked car's footprint, half its width and half its length (the shop's real lengths, outfits.ts CAR_LENGTH). */
export const CAR_HALF: [number, number] = [1.0, 2.5];

/** Solid boxes [x0, x1, z0, z1] on the ground (the walk keeps a body's width off them). */
export function streetSolids(): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (const [x, z] of LAMPS) out.push([x - 0.14, x + 0.14, z - 0.14, z + 0.14]);
  for (const [x, z] of TREES) out.push([x - 0.55, x + 0.55, z - 0.55, z + 0.55]);
  for (const [x, z, ry] of BENCHES) {
    const along = Math.abs(Math.sin(ry)) < 0.5; // facing north/south: long along x
    out.push(along ? [x - 0.9, x + 0.9, z - 0.3, z + 0.3] : [x - 0.3, x + 0.3, z - 0.9, z + 0.9]);
  }
  for (const c of PARKED) out.push([c.x - CAR_HALF[0], c.x + CAR_HALF[0], c.z - CAR_HALF[1], c.z + CAR_HALF[1]]);
  // the planters either side of each open door
  for (const s of STREET_SHOPS) if (s.opens) for (const dz of [-1, 1]) {
    const x = s.side * (FRONT - 0.45), z = s.z + dz * (s.doorHalf + 0.75);
    out.push([x - 0.3, x + 0.3, z - 0.3, z + 0.3]);
  }
  return out;
}

/** Can a body stand here (inside the street, off every solid)? */
export function streetFree(x: number, z: number, r = BODY, solids = streetSolids()): boolean {
  const [x0, x1, z0, z1] = WALK_BOX;
  if (x < x0 - BODY + r || x > x1 + BODY - r || z < z0 - BODY + r || z > z1) return false;
  for (const [a, b, c, d] of solids) if (x > a - r && x < b + r && z > c - r && z < d + r) return false;
  return true;
}

// ── The people walking up and down ──
/** A walker's body (the world kit's BODY_R, world3d/npc.ts). */
export const WALKER_R = 0.3;
/** Where the people may walk: the pavements, and the road only on the zebra (they never step out between cars). */
export function walkerFree(x: number, z: number, solids = streetSolids()): boolean {
  if (!streetFree(x, z, WALKER_R + 0.05, solids)) return false;
  if (z > SOUTH - 0.5) return false;
  return !(Math.abs(x) < ROAD + 0.25 && Math.abs(z - ZEBRA_Z) > 1.0);
}
/** Where the people walk between: along each pavement (x = ±PAVE), the zebra's two ends, and outside each window. */
export const PAVE = 5.7;
export function walkPoints(): [number, number][] {
  const out: [number, number][] = [];
  for (const side of [-1, 1]) for (let z = -22; z <= 19; z += 6) out.push([side * PAVE, z]);
  out.push([-PAVE, ZEBRA_Z], [PAVE, ZEBRA_Z]);
  for (const s of STREET_SHOPS) for (const dz of [-1, 1]) out.push([s.side * (FRONT - 1.0), s.z + dz * (s.doorHalf + 2.0)]);
  return out;
}
/** A walk from a to b crosses the road (it must use the zebra). */
export const crossesRoad = (ax: number, bx: number) => Math.sign(ax) !== Math.sign(bx);

// ── The windows: what the showroom and the boutique show, from the shop's own items and prices ──
/** The car families, cheapest first (the shop's own order of price). */
const CAR_ORDER = ["car-1", "car-2", "suv", "car-3", "classic", "car-4"];
const DRIP_ORDER = ["cap", "shades", "suit", "silver", "gold", "rolex", "diamond"];

export interface WindowItem { id: string; name: string; price: number; priceText: string }

/** The level-1 item of a family, as the shop sells it (shopData LIFESTYLE_ALL_LEVELS). */
function firstLevel(id: string): WindowItem | null {
  const it = LIFESTYLE_ALL_LEVELS.find((x) => baseIdOf(x) === id && (x.level ?? 1) === 1) ?? LIFESTYLE_ALL_LEVELS.find((x) => baseIdOf(x) === id);
  if (!it) return null;
  return { id, name: it.name, price: it.price, priceText: `${MONEY_SIGN}${formatMoney(it.price)}` };
}

/** The showroom's car: the cheapest family you do not own yet (all owned: the dearest). */
export function showroomCar(career: Pick<CareerState, "ownedItems">): WindowItem {
  const owned = new Set((career.ownedItems ?? []).map((x) => baseIdOf(x)));
  const id = CAR_ORDER.find((c) => !owned.has(c)) ?? CAR_ORDER[CAR_ORDER.length - 1];
  return firstLevel(id)!;
}

/** The boutique's window: the next two drip families you do not own yet. */
export function boutiqueWindow(career: Pick<CareerState, "ownedItems">): WindowItem[] {
  const owned = new Set((career.ownedItems ?? []).map((x) => baseIdOf(x)));
  const want = DRIP_ORDER.filter((d) => !owned.has(d));
  return (want.length ? want : DRIP_ORDER.slice(-2)).slice(0, 2).map(firstLevel).filter((x): x is WindowItem => !!x);
}
