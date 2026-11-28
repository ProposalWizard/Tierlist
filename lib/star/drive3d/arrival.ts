/**
 * THE ARRIVAL AT THE REAL COMPOUND (driving phase 2, 28 Nov 2026; docs/plans/DRIVING_PLAN.md §2.3).
 * The drive in hands over at the end of the country lane (a fade), and the training compound
 * (lib/star/world3d/compoundPlan.ts, the real one) opens with your car on its road: the low wide
 * shot by the car park's barrier (the arm lifts, you roll in), then the bay shot (the crest board,
 * the gate and the building behind, two team-mates turn to look), you swing into your bay, and on
 * the door moment you are standing at the driver's door, free to walk to the gym door.
 *
 * Pure: the route in the compound's own ground plan (metres, x east, z south; see compoundPlan.ts),
 * the car on it (./car.ts, the same simple car as the drive), the two shots, the lift, the turn,
 * the fade. lib/star/world3d/testScene.ts draws it (opts.arrive); tests/star/driveArrival.mts walks it.
 *
 *   road (z 50, heading east) ─┐  left into the way in (x 7..14), under the barrier (x 6.6, z 43.7)
 *                              └─ north, left along the aisle (z 35.5), right into bay 8 (front row)
 */
import { COMPOUND, bayAt } from "../world3d/compoundPlan";
import { buildRoute, at, offsetAt, LANE, type Piece, type Route } from "./route";
import { startCar, stepCar, type CarSpec, type CarState } from "./car";
import type { XZ } from "../tapWalk";

/** The compound's road centre line (compoundPlace.ts lays a 9 m road at z 50). */
export const ROAD_Z = 50;
/** Your bay (front row, nose to the fence): the middle of the car when parked. */
export const YOUR_BAY: XZ = bayAt(COMPOUND.yourBay, "N");
/** The barrier: its post on the west side of the way in (compoundPlace.ts), the arm across it when down. */
export const BARRIER = { x: COMPOUND.carPark.x1 - 7.4, z: COMPOUND.carPark.z1 - 0.3, len: 4.2, y: 0.95 };
/** The aisle between the two rows of bays (its middle line). */
export const AISLE_Z = (COMPOUND.carPark.rowN + COMPOUND.carPark.bayD + COMPOUND.carPark.rowS) / 2;

/** Where the car starts on the road (its x), and its speed then (m/s: about 25 mph, slowing for the turn). */
export const START_X = -16;
export const START_V = 11;
/** The car's own circles (m): in off the road, into the aisle, into the bay. Its x as it passes the barrier. */
const R_IN = 5.5, R_AISLE = 4.5, R_BAY = 4;
const IN_X = 9.5;

/**
 * The route line (the car keeps LANE to its left, as on the drive), worked from the car's own path:
 * left in on R_IN (x IN_X by the barrier), north, left on R_AISLE into the aisle, right on R_BAY into
 * the bay, nose to the fence, its middle on the bay's middle.
 */
const CAR_Z_ROAD = ROAD_Z - LANE;
export const ARRIVAL_PIECES: Piece[] = [
  { kind: "approach", len: IN_X - R_IN - START_X, speed: START_V },
  { kind: "park", r: R_IN + LANE, turn: Math.PI / 2, speed: 6 },
  { kind: "park", len: CAR_Z_ROAD - R_IN - (AISLE_Z + R_AISLE), speed: 4.5 },
  { kind: "park", r: R_AISLE + LANE, turn: Math.PI / 2, speed: 4 },
  { kind: "park", len: IN_X - R_AISLE - (YOUR_BAY[0] + R_BAY), speed: 3.5 },
  { kind: "park", r: R_BAY - LANE, turn: -Math.PI / 2, speed: 3 },
  { kind: "park", len: AISLE_Z - R_BAY - YOUR_BAY[1], speed: 2.4 },
];

export function arrivalRoute(): Route {
  return buildRoute(ARRIVAL_PIECES, 0.25, { x: START_X, z: ROAD_Z, h: Math.PI / 2 });
}

/** Where along the route (s) the car's middle crosses the barrier's line. */
export function barrierS(R: Route): number {
  for (let s = 0; s < R.length; s += 0.05) if (offsetAt(R, s, LANE).z <= BARRIER.z) return s;
  return R.length;
}

export type ArrivalPhase = "roll" | "door" | "out" | "done";
export type ArrivalShot = "barrier" | "bay";

export interface ArrivalSession {
  route: Route;
  car: CarState;
  spec: CarSpec;
  phase: ArrivalPhase;
  t: number;
  /** When the car came to rest (s of arrival time), −1 until then. */
  stoppedAt: number;
  /** When you were put beside the car (the black), −1 until then. */
  outAt: number;
  /** Black over the screen 0..1 (the door moment). */
  fade: number;
  skipped: boolean;
  bS: number;
}

export const DOOR_AFTER_STOP = 0.55;
export const FADE_OUT = 0.4;
export const FADE_IN = 0.5;
/** The bay shot takes over this far past the barrier (the car is in the car park, turning into the aisle). */
export const BAY_SHOT_AFTER = 8;
export const ASTEP = 1 / 60;

export function newArrival(spec: CarSpec = { wheelR: 0.42, wheelbase: 2.6 }): ArrivalSession {
  const route = arrivalRoute();
  const car = startCar();
  car.v = START_V;
  const p = at(route, 0);
  car.yaw = p.h;
  return { route, car, spec, phase: "roll", t: 0, stoppedAt: -1, outAt: -1, fade: 0, skipped: false, bS: barrierS(route) };
}

/** One step of the arrival. The car drives itself (no thumb: it is parking). */
export function stepArrival(A: ArrivalSession, dt = ASTEP): void {
  if (A.phase === "done") return;
  A.t += dt;
  if (A.phase === "roll") {
    stepCar(A.route, A.car, { hold: false }, dt, A.spec, { mode: "lanes", traffic: [], auto: true });
    if (A.car.s >= A.route.length - 0.05 && A.car.v < 0.05) { A.phase = "door"; A.stoppedAt = A.t; }
  } else if (A.phase === "door") {
    if (A.t > A.stoppedAt + DOOR_AFTER_STOP) A.fade = Math.min(1, A.fade + dt / FADE_OUT);
    if (A.fade >= 1) { A.phase = "out"; A.outAt = A.t; }
  } else if (A.phase === "out") {
    A.fade = Math.max(0, A.fade - dt / FADE_IN);
    if (A.fade <= 0) A.phase = "done";
  }
}

/** Skip: the car straight into its bay and you beside it (behind a short black). */
export function skipArrival(A: ArrivalSession) {
  if (A.phase === "out" || A.phase === "done") return;
  A.skipped = true;
  A.car.s = A.route.length; A.car.v = 0;
  const p = at(A.route, A.route.length); A.car.yaw = p.h; A.car.steer = 0; A.car.roll = 0; A.car.pitch = 0;
  A.phase = "out"; A.outAt = A.t; A.fade = 1;
}

/** Where the car's middle is now, and its heading. */
export function carPose(A: ArrivalSession): { x: number; z: number; yaw: number } {
  const p = offsetAt(A.route, A.car.s, A.car.off);
  return { x: p.x, z: p.z, yaw: A.car.yaw };
}

/** How far the barrier arm is up (0 down, 1 up): it lifts as you roll up to it, all the way before you reach it. */
export function liftOf(A: ArrivalSession): number {
  const d = A.car.s - (A.bS - 12);
  const x = Math.max(0, Math.min(1, d / 6));
  return x * x * (3 - 2 * x);
}

export function shotOf(A: ArrivalSession): ArrivalShot {
  return A.car.s < A.bS + BAY_SHOT_AFTER ? "barrier" : "bay";
}

/** How far the two team-mates have turned to look at you (0..1): from a beat into the bay shot. */
export function turnOf(A: ArrivalSession): number {
  const into = A.car.s - (A.bS + BAY_SHOT_AFTER + 1.5);
  const x = Math.max(0, Math.min(1, into / 5));
  return x * x * (3 - 2 * x);
}

/** The two team-mates waiting by the gate (outside the fence, in front of the bays), and who they face first. */
export const MATES_AT: [XZ, XZ] = [[-2.6, 26.0], [-3.9, 26.5]];

/**
 * The camera of each shot (x, y, z; look x, y, z; vertical fov). The barrier: low on the far side of the
 * road, looking through the way in at the barrier, the car park and the hut behind; it pans a little to
 * keep the car. The bay: from the aisle, the car swinging past into its bay, the crest board, the gate
 * and the building beyond, the two team-mates in front of them.
 */
export function arrivalCam(A: ArrivalSession): { pos: [number, number, number]; look: [number, number, number]; fov: number } {
  const c = carPose(A);
  if (shotOf(A) === "barrier") {
    // it follows the car along the road, then settles on the arm as the car turns in under it
    const k = 0.62;
    const bx = BARRIER.x + 1.8, bz = BARRIER.z;
    return { pos: [15.2, 0.9, 53.6], look: [bx + (c.x - bx) * k, 0.6, bz + (Math.min(c.z, ROAD_Z) - bz) * k], fov: 56 };
  }
  // from an empty bay across the aisle, a little high (over the car's roof to the two by the gate): the car
  // swings past and into its bay; a slow push in (up to 1.6 m)
  const into = Math.max(0, A.car.s - (A.bS + BAY_SHOT_AFTER));
  const push = Math.min(1.2, into * 0.1);
  // far enough back that the car is a third of the frame, not half of it: the building, the crest and the two read
  const P: XZ = [6.4, 43.1], L: XZ = [-2.0, 26.8];
  const dx = L[0] - P[0], dz = L[1] - P[1], dl = Math.hypot(dx, dz);
  return { pos: [P[0] + (dx / dl) * push, 2.1, P[1] + (dz / dl) * push], look: [L[0], 1.5, L[1]], fov: 46 };
}

/** Where you stand when you get out: at the driver's door (the right: a UK car), facing the gate. */
export function youOut(): { x: number; z: number; yaw: number } {
  return { x: YOUR_BAY[0] + 1.45, z: YOUR_BAY[1] + 0.6, yaw: Math.PI };
}
