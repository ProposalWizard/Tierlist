/**
 * THE LEAF'S FLIGHT — "the falling leaf" (Star Pass reward, piece 4).
 *
 * A direct free kick taken with The Leaf run-up (runupStyles.ts, id
 * "fk_leaf", Juninho's) flies with a different SHAPE: the same strike — the
 * same aim, power and contact, launched by the same launch() — but its bend
 * and its drop are held back early and given late. It holds its line, then
 * dips and swerves late.
 *
 * How: every flight substep (the free-kick rule's `step`, kindRules/
 * freeKick.ts, which runs just before the engine moves the ball) adds
 *
 *     e(u) · (the curl the engine is about to give it)   sideways, and
 *     e(u) · gravity                                     downward,
 *
 * with u how far it has come from the ball to the goal line (0..1) and
 *
 *     e(u) = shape · (u² − balance).
 *
 * e is below zero early (less bend, less drop: it holds its line) and above
 * zero late (more of both: the dip and the late swerve). With balance = 1/6,
 * a ball at steady pace has ∫(1 − u)·e(u) du = 0: the extra bend and drop it
 * is given late add up to what it was spared early. A real ball slows, so
 * balance is a little higher (LEAF.balance, measured), and the ball arrives
 * about where the same strike would have — a different path, not a stronger
 * shot. Measured in tests/star/leafFreeKick.mts (the scoring
 * gain is pinned at about +3 points at most).
 *
 * Only a ball the attacker struck that is still in the air on its way in:
 * once it is touched by anybody else, comes down, or is past the line, the
 * engine has it alone again. Every other free kick never reaches here.
 *
 * Pure, no React, no canvas; canvasEngine.ts is not touched (the curl and
 * gravity numbers below are the engine's own, same in the Old and New ball).
 */
import type { Ball } from "./canvasEngine";

export const LEAF = {
  /** How strongly the bend and drop are moved from early to late (e(0) = −shape·balance, e(1) = shape·(1 − balance)). */
  shape: 1.8,
  /** Where e crosses zero (√balance of the way in). 1/6 balances a ball at steady pace exactly; a real one slows as it goes, so its late part lasts longer and needs a little more held back early. 0.195 measured: over 110+ strikes (18-30 m, every power and curl) the end spot moves 0.0-0.1 m on average (0.19: +0.07 m bend; 0.21: -0.13 m). */
  balance: 0.195,
  /** The engine's curl strength (canvasEngine.ts / ballPhysics.ts CURL_K) and gravity. */
  curlK: 0.48,
  g: 9.8,
  /** Below this height the ball is "down" and the leaf lets it go. */
  minZ: 0.05,
};

export interface LeafState {
  /** Where it was struck from, along the pitch (metres from the goal line). */
  y0: number;
  /** The goal line. */
  goalY: number;
}

/** The leaf's state for a ball just struck at goal (the goal line is y = 0). */
export function startLeaf(ball: Ball, goalY = 0): LeafState {
  return { y0: ball.pos.y, goalY };
}

/** e(u): how much extra bend and drop at this share of the way in (0 outside 0..1). */
export function leafExtra(u: number, shape = LEAF.shape): number {
  if (!(u >= 0 && u <= 1)) return 0;
  return shape * (u * u - LEAF.balance);
}

/** How far in it is: 0 at the ball, 1 on the goal line. */
export function leafProgress(st: LeafState, ball: Ball): number {
  const span = st.y0 - st.goalY;
  return Math.abs(span) < 1e-6 ? 1 : (st.y0 - ball.pos.y) / span;
}

/** Is the leaf still steering this ball? */
export function leafActive(st: LeafState, ball: Ball): boolean {
  if (ball.lastTouch !== undefined && ball.lastTouch !== "attack") return false;
  if (ball.loose || ball.inNet || ball.resting || ball.z <= LEAF.minZ) return false;
  const u = leafProgress(st, ball);
  return u >= 0 && u <= 1;
}

/** One flight substep: add this moment's extra bend and drop (before the engine moves the ball). */
export function stepLeaf(st: LeafState, ball: Ball, dt: number, shape = LEAF.shape): void {
  if (!leafActive(st, ball)) return;
  const e = leafExtra(leafProgress(st, ball), shape);
  if (e === 0) return;
  const vx = ball.vel.x, vy = ball.vel.y;
  if (Math.hypot(vx, vy) > 0.01 && Math.abs(ball.spin) > 0.0001) {
    const k = e * ball.spin * LEAF.curlK * dt;
    ball.vel.x = vx + k * vy;
    ball.vel.y = vy - k * vx;
  }
  ball.vz -= e * LEAF.g * dt;
}
