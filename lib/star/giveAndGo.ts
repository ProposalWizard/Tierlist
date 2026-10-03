/**
 * THE GIVE-AND-GO (v0.25, Harry and Mikey's review of v0.24, point 49).
 *
 * In a picture with no goal in it (a midfield pass, a build-up) a pass is the
 * only thing you can do. How often does the ball come back to you?
 *
 *   v0.23  chainReturnChance: 0.30 + how brave the ball was — 73% / 56%.
 *   v0.24  always (100%), with a BACK TO YOU banner.
 *   v0.25  "the ambitious forward pass should almost always give the ball
 *          back … at least 90, 95 out of 100", and "a backward safe pass
 *          should be less likely":
 *            a forward pass (more than 2 m forward)  → 92 in 100
 *            a sideways or backward pass             → 60 in 100
 *
 * "Forward" is the engine's own test for an ambitious ball (canvasEngine's
 * passAmbition: a ball that did not go more than 2 m forward scores zero).
 * Pictures WITH a goal keep chainReturnChance exactly as before.
 *
 * Pure. Lives here, not in canvasEngine.ts (Mikey's rule: never modify it).
 */
import type { Scenario, Vec2 } from "./canvasEngine";

/** A forward pass in a picture with no goal: comes back this often. */
export const GIVE_AND_GO_FORWARD = 0.92;
/** A sideways or backward pass in a picture with no goal. */
export const GIVE_AND_GO_SAFE = 0.6;
/** Metres forward a ball must travel to count as forward (the engine's own 2 m). */
export const FORWARD_M = 2;

/** True when the pass from the picture's ball to `at` went forward (up the pitch). */
export function wasForwardPass(sc: Pick<Scenario, "ball">, at: Vec2): boolean {
  // The attack goes towards y = 0, so forward means a smaller y.
  return sc.ball.y - at.y > FORWARD_M;
}

/** How often a completed pass in a no-goal picture comes back to you. */
export function giveAndGoChance(sc: Pick<Scenario, "ball">, at: Vec2): number {
  return wasForwardPass(sc, at) ? GIVE_AND_GO_FORWARD : GIVE_AND_GO_SAFE;
}
