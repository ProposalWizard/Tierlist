import type { FpRunState } from "./firstPersonDribble";

/**
 * THE FIRST-PERSON CAMERA — AN HONEST PERSPECTIVE PROJECTION, NOT A TRICK.
 *
 * Split out from `firstPersonRender.ts` for one reason: this is the one
 * genuinely novel piece of math in the whole first-person dribbling mode,
 * and it can be tested with no canvas at all — the exact precedent
 * `tests/star/scenarioRender.mts` already sets for `pxFromPitch`/
 * `pitchFromPx`, which never touches a canvas either.
 *
 * ── Why this is not the thing that got removed before ──
 *
 * This codebase has a scar here worth naming directly: a shallow perspective
 * trick was previously removed from the real match view as "the single
 * biggest reason the game looked wrong" — because it was FAKE perspective
 * (a size fudge) bolted onto a camera that was actually looking straight
 * down. This is a different thing. The camera here genuinely sits at a
 * player's eye height and looks ahead down the corridor; `project()` is a
 * real divide-by-depth, and "looking slightly downward" is implemented as a
 * shifted principal point (`horizon` sits at 0.42·H instead of 0.5·H), not a
 * rotation — straight world lines stay straight, verticals stay vertical,
 * and no trigonometry is needed anywhere in this file. The camera also never
 * yaws: it only ever TRANSLATES along the corridor (`cam.x`/`cam.y` track
 * the run). A turn is sold in the renderer with a screen-space lean instead
 * — see firstPersonRender.ts — which is what keeps this a single divide with
 * no near-plane clipping required for any pitch marking.
 *
 * `project`/`unprojectAtDepth` are an exact inverse pair, the same
 * relationship `pxFromPitch`/`pitchFromPx` already are — a screen pixel and
 * the world point it was computed from must always agree.
 */

export interface FpCamera {
  /** Pitch x — the lane the eye is centred on. */
  x: number;
  /** Pitch y — how far up the corridor the eye has run. */
  y: number;
  /** Metres above the turf — a sprinting player's eye height. */
  eye: number;
  /** Canvas backing-store size, pixels. */
  W: number;
  H: number;
  /** Pixels — how tightly the lens is zoomed. */
  focal: number;
  /** Pixels — the principal point's y. Below the true half-height on
   *  purpose: see the file header. */
  horizon: number;
}

export const EYE = 1.55;
/** focal = FOCAL_K * W. */
export const FOCAL_K = 0.90;
/** horizon = HORIZON_F * H. */
export const HORIZON_F = 0.42;
/** Nothing nearer than this is drawn or projected — keeps every divide
 *  honest instead of exploding as depth approaches zero. */
export const NEAR = 0.35;
export const FAR = 60;

/** Build the camera for a run state at a given canvas size. */
export function cameraFor(run: FpRunState, W: number, H: number, eye: number = EYE): FpCamera {
  return { x: run.x, y: run.y, eye, W, H, focal: FOCAL_K * W, horizon: HORIZON_F * H };
}

export interface Projected {
  px: number;
  py: number;
  /** Pixels per metre AT that depth — every figure and marking is drawn in
   *  metres and multiplied by this. */
  scale: number;
}

/**
 * World point (pitch metres, z = metres above the turf) → screen pixels.
 * Returns null for anything at or behind the near plane rather than
 * dividing into a blown-up number.
 */
export function project(cam: FpCamera, x: number, y: number, z: number): Projected | null {
  const depth = cam.y - y;
  if (depth <= NEAR) return null;
  const scale = cam.focal / depth;
  const u = x - cam.x;
  return {
    px: cam.W / 2 + u * scale,
    py: cam.horizon + (cam.eye - z) * scale,
    scale,
  };
}

/**
 * The inverse of `project`, given a depth already known (e.g. "the ball is
 * always 1.7 m of depth ahead of you"). Exact inverse of `project` for any
 * point that depth actually came from.
 */
export function unprojectAtDepth(
  cam: FpCamera, px: number, py: number, depth: number,
): { x: number; y: number; z: number } {
  const u = (px - cam.W / 2) * depth / cam.focal;
  const z = cam.eye - (py - cam.horizon) * depth / cam.focal;
  return { x: cam.x + u, y: cam.y - depth, z };
}

/**
 * Where a screen point lands on the GROUND (z = 0) — for hit-testing a tap
 * against the turf. Above the horizon is sky, never a point on the pitch:
 * returns null rather than a negative depth (a real bug class — without
 * this guard, a tap on the sky would silently compute as a point behind the
 * camera).
 */
export function groundAt(cam: FpCamera, px: number, py: number): { x: number; y: number } | null {
  if (py <= cam.horizon) return null;
  const depth = cam.focal * cam.eye / (py - cam.horizon);
  const u = (px - cam.W / 2) * depth / cam.focal;
  return { x: cam.x + u, y: cam.y - depth };
}

/**
 * Where a screen point lands on the vertical plane at a given pitch y — the
 * goal plane (y = 0), specifically, for un-projecting the shot-aim drag
 * into an actual spot in the goalmouth. Null if that plane is at or behind
 * the camera.
 */
export function aimOnPlane(
  cam: FpCamera, px: number, py: number, planeY: number,
): { x: number; z: number } | null {
  const depth = cam.y - planeY;
  if (depth <= NEAR) return null;
  const x = cam.x + (px - cam.W / 2) * depth / cam.focal;
  const z = cam.eye - (py - cam.horizon) * depth / cam.focal;
  return { x, z };
}
