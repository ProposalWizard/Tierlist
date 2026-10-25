/**
 * A HEADER THAT LOOKS LIKE A HEADER (Harry, 25 Oct 2026, after the 0.108h
 * header videos: "that header animation and function does not work at all
 * in those videos, not too sure what I'm meant to be seeing").
 *
 * What the videos showed: the cross stopped dead in the air while you aimed,
 * your man stood to one side of it, and after "Head it?" the ball simply
 * drifted off the spot. Nobody jumped and nothing came off a head.
 *
 * Drawing only. Nothing here moves the struck ball, the engine or the random
 * stream, so goal rates are exactly what they were:
 *  1. THE CROSS KEEPS MOVING. The last CROSS_TAIL_S of the cross slows down
 *     smoothly (full speed at first, never a stop) and keeps creeping in
 *     while you aim. Where the strike starts (the chance's ball) is unchanged.
 *  2. YOU GO UP AND MEET IT. When you head it, the strike is held for
 *     HEADER_RISE_S (the match's wind-up beat): your man moves under the ball
 *     and jumps, the ball comes the last of the way onto his head, and it
 *     leaves at the top of his jump. Met late (the timer ran out), the
 *     contact comes early in the jump, before he is up: a glance.
 * Pure: no canvas, no React, no random numbers.
 */
import { HEADER_S } from "./actionAnim";
import { airArrival, type AirHeighted } from "./airDrawings";

/** Seconds of the cross that are slowed into the aim (its last part). */
export const CROSS_TAIL_S = 0.35;
/** m/s along the ground of a cross drawn when no build-up played (the drill). */
export const CROSS_SPEED_MS = 17;
/** Seconds the strike is held while you rise to meet the ball. */
export const HEADER_RISE_S = 0.24;
/** A late header (the timer ran out) meets the ball this far into the jump (share of HEADER_S). */
export const HEADER_LATE_AT = 0.28;

/**
 * Seconds of the cross still to come, `s` seconds after it began to slow.
 * At s = 0 it is `tail` and falls at full speed (slope -1); it then slows for
 * ever and never reaches 0, so the ball is never still.
 */
export function tailLeft(s: number, tail = CROSS_TAIL_S): number {
  return (tail * tail) / (tail + Math.max(0, s));
}

/**
 * The time on a build-up's clock the ball is drawn at, for a header. Up to
 * `durS - tail` it is the build-up's own time; after that the last `tail`
 * seconds are stretched (tailLeft). Keep calling it past durS (while you aim)
 * with t = durS + seconds aimed: the ball keeps creeping in.
 */
export function crossDrawT(t: number, durS: number, tail = CROSS_TAIL_S): number {
  const from = durS - tail;
  if (t <= from) return t;
  return durS - tailLeft(t - from, tail);
}

export interface CrossPath { durS: number; at(t: number): { x: number; y: number; z: number } }

/**
 * The cross when no build-up played (the Head & Volley drill, a chance with
 * build-ups off): from the crosser (airArrival) to the chance's ball, along
 * the ground at CROSS_SPEED_MS, over the arc airArrival gives. Null when the
 * chance has no crosser.
 */
export function syntheticCross(sc: AirHeighted & { ball: { x: number; y: number }; teammates: { x: number; y: number }[] }): CrossPath | null {
  const a = airArrival(sc);
  if (!a) return null;
  const to = sc.ball;
  const L = Math.hypot(to.x - a.from.x, to.y - a.from.y);
  const durS = Math.max(0.6, L / CROSS_SPEED_MS);
  const z0 = 0.3, z1 = a.endZ;
  const h = Math.max(0, a.apex - (z0 + z1) / 2);
  return {
    durS,
    at(t: number) {
      const u = Math.max(0, Math.min(1, t / durS));
      return { x: a.from.x + (to.x - a.from.x) * u, y: a.from.y + (to.y - a.from.y) * u, z: z0 + (z1 - z0) * u + 4 * h * u * (1 - u) };
    },
  };
}

export interface HeaderBeat {
  /** Seconds into the header animation (actionAnim HEADER_S) to draw him at. */
  animE: number;
  /** 0..1: how far he has moved from where he stood to under the ball. */
  moveU: number;
  /** 0..1: how far the ball has come from where it was drawn to his head. */
  ballU: number;
  /** 0..1: how high he is (1 = the top of the jump). */
  up: number;
}

const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
const easeIn = (u: number) => u * u;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Your header, `e` seconds after you hit it on the strike screen. The ball
 * leaves at e = rise (the end of the match's wind-up). A clean header meets
 * it at the top of the jump; a late one (`late`) early in the jump, lower.
 */
export function headerBeat(e: number, rise = HEADER_RISE_S, late = false): HeaderBeat {
  const meetAt = (late ? HEADER_LATE_AT : 0.5) * HEADER_S;
  const animE = Math.max(0, e + meetAt - Math.max(rise, 1e-3));
  const u = clamp01(animE / HEADER_S);
  const k = clamp01(e / Math.max(rise, 1e-3));
  return { animE, moveU: easeOut(k), ballU: easeIn(k), up: Math.sin(Math.PI * u) };
}

/** His head, as a share of his drawn height above his boots. */
export const HEAD_AT = 0.92;
/** The least jump drawn, as a share of his height: a header always leaves the ground visibly. */
export const MIN_JUMP = 0.6;
/** Seconds after the ball leaves his head for its drawn height to settle back to its real one. */
export const BALL_SETTLE_S = 0.2;

/**
 * How far (px) to lift your man at the top of his jump so his head meets a
 * ball drawn `ballPx` above the grass, when he stands `figPx` tall: at least
 * MIN_JUMP of his height (a jump should read), at most 1.6 of it.
 */
export function headerLiftPx(ballPx: number, figPx: number): number {
  return Math.max(MIN_JUMP * figPx, Math.min(1.6 * figPx, ballPx - HEAD_AT * figPx));
}

/**
 * How much of the gap between the ball's real height and his head (when his
 * head is above it) the ball is drawn up by, `e` seconds into the beat: it
 * rises onto his head through the wind-up, sits there at contact, and settles
 * back to its real height over BALL_SETTLE_S once it has left. Looks only.
 */
export function headerBallLiftK(e: number, rise = HEADER_RISE_S): number {
  if (e < rise) return easeIn(clamp01(e / Math.max(rise, 1e-3)));
  return Math.max(0, 1 - (e - rise) / BALL_SETTLE_S);
}
