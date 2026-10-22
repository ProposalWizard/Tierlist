/**
 * WIND, RAIN SKID AND THE STATE OF THE PITCH (Leo, 22 Oct 2026, chat 4).
 *
 * Leo: "wind bends the ball, rain makes it skid faster, really dry on a bad
 * pitch, like a bad lower-league stadium, means less bounce and the ball stops
 * dead at worst."
 *
 * TEST PAGE ONLY for now (plan 4a): /star-weather-dev builds these conditions.
 * The real game's `conditionsFor` (weather.ts) never sets the new fields, and
 * every hook below does nothing when its field is absent, so the career match
 * plays exactly as before (tests/star/weatherFingerprint.mts proves it).
 *
 * The three new things, all in metres and seconds like the engine:
 *
 *  1. WIND as a direction and a speed (`windV`, m/s at 10 m up). The ball feels
 *     the air moving past it, not still air: drag acts on the ball's speed
 *     RELATIVE to the wind. So a cross-wind pushes it sideways relative to its
 *     flight, a head-wind cuts its carry and a tail-wind adds to it. The wind
 *     is weaker near the grass (a log profile, as over any field), so a ball
 *     bends more the HIGHER it goes and the LONGER it is up there. A ball on
 *     the ground is not touched.
 *  2. RAIN SKID (`skid`, 0..1): the share of the pace a bounce would take off
 *     that a wet surface lets the ball keep. With the lower rolling friction
 *     rain already had, a wet ball skids on and rolls further.
 *  3. A BAD DRY PITCH (`deadBelow`, m/s): below this rolling speed the rough,
 *     baked turf grabs the ball (extra slowing up to `DEAD_GRAB` at a crawl),
 *     so at worst it stops dead. Its low bounce and high friction ride on the
 *     old `bounce` and `friction` multipliers.
 */
import { K_AIR, dragCoeff } from "./ballPhysics";

/** The new, optional parts of a match's conditions. Absent = as before. */
export interface PitchWeatherExtras {
  /** Wind velocity at 10 m, in pitch axes (x across, y up the pitch: +y is
   *  away from the goal you attack). m/s. */
  windV?: { x: number; y: number };
  /** 0..1: how much of a bounce's lost pace a wet surface gives back. */
  skid?: number;
  /** m/s: a rolling ball slower than this is grabbed by a bad dry pitch. */
  deadBelow?: number;
}

/** How hard a bad dry pitch grabs a ball at a crawl, m/s². */
export const DEAD_GRAB = 7;
/** Wind profile: roughness length of a grass pitch, and the reference height. */
const Z0 = 0.03, ZREF = 10;
const LOG_REF = Math.log(ZREF / Z0);

/** The share of the 10 m wind felt at height z (0.2 at 10 cm, 0.6 at 1 m, 1 at 10 m). */
export function windAtHeight(z: number): number {
  return Math.max(0, Math.min(1.15, Math.log(Math.max(z, 0.1) / Z0) / LOG_REF));
}

/**
 * The extra acceleration the wind gives a ball in the air, over the still-air
 * drag the ball already has: drag on the speed relative to the air, minus
 * drag on the speed relative to the ground. m/s² in (x, y, z).
 */
export function windAccel(
  vx: number, vy: number, vz: number, z: number, w: { x: number; y: number }, exact = true,
): { ax: number; ay: number; az: number } {
  const f = windAtHeight(z);
  const wx = w.x * f, wy = w.y * f;
  const rx = vx - wx, ry = vy - wy;
  const sRel = Math.hypot(rx, ry, vz), s = Math.hypot(vx, vy, vz);
  const kRel = K_AIR * dragCoeff(sRel) * sRel, k = K_AIR * dragCoeff(s) * s;
  // The Old ball has much less air drag than a real one (a flat 0.12/s), so
  // "real drag minus still-air drag" would hand a tail wind drag the Old ball
  // never had. It gets the push alone: the wind's own share, kRel·w.
  if (!exact) return { ax: kRel * wx, ay: kRel * wy, az: 0 };
  return { ax: -kRel * rx + k * vx, ay: -kRel * ry + k * vy, az: -kRel * vz + k * vz };
}

type BallLike = { vel: { x: number; y: number }; vz: number; z: number };

/** Push an airborne ball by the wind for one step. Nothing when there is no `windV`. */
export function applyWind(ball: BallLike, cond: PitchWeatherExtras | undefined, dt: number, exact = true): void {
  const w = cond?.windV;
  if (!w || (w.x === 0 && w.y === 0)) return;
  const a = windAccel(ball.vel.x, ball.vel.y, ball.vz, ball.z, w, exact);
  ball.vel.x += a.ax * dt; ball.vel.y += a.ay * dt; ball.vz += a.az * dt;
}

/** A bounce's horizontal keep on a wet surface. Unchanged when there is no `skid`. */
export function skidKeep(keep: number, cond: PitchWeatherExtras | undefined): number {
  const s = cond?.skid;
  if (!s) return keep;
  return keep + (1 - keep) * Math.max(0, Math.min(1, s));
}

/** A rolling ball's speed drop this step on a bad dry pitch. Unchanged when there is no `deadBelow`. */
export function grabDrop(drop: number, speed: number, cond: PitchWeatherExtras | undefined, dt: number): number {
  const d = cond?.deadBelow;
  if (!d || speed >= d) return drop;
  return drop + DEAD_GRAB * (1 - speed / d) * dt;
}
