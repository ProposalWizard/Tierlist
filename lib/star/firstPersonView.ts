/**
 * THE FIRST-PERSON CAMERA — AN HONEST PERSPECTIVE PROJECTION, NOT A TRICK.
 *
 * Split out from `firstPersonRender.ts` for one reason: this is the one
 * genuinely novel piece of math in the whole first-person dribbling modes,
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
 * player's eye height and looks ahead; `project()` is a real divide-by-
 * depth, and "looking slightly downward" is implemented as a shifted
 * principal point (`horizon` sits at 0.42·H instead of 0.5·H), not a pitch
 * rotation — no trigonometry needed for that part.
 *
 * ── Two cameras live here, sharing the same projection ──
 *
 * The one-on-one duel mode never turns — it only ever TRANSLATES along the
 * corridor, always facing the same fixed world direction, so `cam.forward`
 * is left at its default. The open-run mode (mirroring `dribble.ts`'s own
 * mechanics — a swipe sets a heading in ANY direction, not just left/right)
 * genuinely needs the camera to turn to face wherever that heading points,
 * or "first person" would stop meaning anything the moment you ran at an
 * angle. `project()` supports both through one optional `forward` vector:
 * world coordinates are resolved into the camera's own forward/right axes
 * before the divide, so the default `forward = {x:0, y:-1}` case reduces
 * back to exactly the old fixed-axis formula (verified in
 * tests/star/firstPersonView.mts) — nothing about the duel mode's camera
 * changed by adding this.
 *
 * `project`/`unprojectAtDepth` are an exact inverse pair for the DEFAULT
 * (non-rotated) camera, the same relationship `pxFromPitch`/`pitchFromPx`
 * already are — a screen pixel and the world point it was computed from
 * must always agree. `unprojectAtDepth`/`groundAt` are not (yet) rotation-
 * aware; nothing that needs hit-testing against a rotated camera exists in
 * this codebase, so they stay simple rather than generalised on spec.
 *
 * ── A third, optional degree of freedom: pitch ──
 *
 * Requested directly: the open-run mode dropped you straight into a duel
 * with no establishing shot, so a chaser standing off to the side was
 * genuinely hard to notice without already turning toward him — "the user
 * needs to understand the situation... without using information boxes and
 * text." The fix is a real camera move, not a UI overlay: start elevated
 * and tilted down over the frozen situation, then swoop down and level out
 * into the ordinary eye-level view before the run begins.
 *
 * `pitch` (radians, positive = tilted downward) is the camera's rotation
 * around its own lateral (`right`) axis, applied AFTER the yaw rotation
 * `forward`/`right` already do — a standard two-axis FPS camera. Worked
 * through by hand (and checked in tests/star/firstPersonView.mts): with
 * `relX = x - cam.x`, `relY = y - cam.y`, `relZ = z - cam.eye`,
 *
 *   d0    = relX·fwd.x + relY·fwd.y        (the old, pitch-free forward distance)
 *   u     = relX·right.x + relY·right.y    (lateral — pitch never touches this)
 *   depth = d0·cos(pitch) − relZ·sin(pitch)
 *   v     = d0·sin(pitch) + relZ·cos(pitch)
 *   px    = W/2 + u·(focal/depth)
 *   py    = horizon − v·(focal/depth)
 *
 * At `pitch = 0`, `depth = d0` and `v = relZ` exactly — the original
 * formulas, unchanged. Every existing caller (the duel mode, and the
 * open-run mode's own ordinary gameplay camera) never sets `pitch`, so
 * `?? 0` makes this purely additive.
 */

export interface FpCamera {
  /** Pitch x — the eye's position. */
  x: number;
  /** Pitch y — the eye's position. */
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
  /** Unit vector, the direction the camera looks in, on the ground plane.
   *  Defaults to {0,-1} (world "up") when omitted — the duel mode's camera
   *  never sets this and behaves exactly as it always has. */
  forward?: { x: number; y: number };
  /** Radians, positive = tilted downward, applied around the camera's own
   *  lateral axis after `forward`'s yaw. Defaults to 0 (dead level) — see
   *  the file header's own derivation. Only the open-run mode's
   *  establishing-shot intro ever sets this away from 0. */
  pitch?: number;
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

const DEFAULT_FORWARD = { x: 0, y: -1 };

/** Build a camera at a given pitch position and canvas size. `forward`
 *  defaults to world "up" — pass it explicitly for a camera that turns to
 *  face a heading (see the file header). `pitch` defaults to dead level. */
export function cameraFor(
  pos: { x: number; y: number }, W: number, H: number,
  opts: { eye?: number; forward?: { x: number; y: number }; pitch?: number } = {},
): FpCamera {
  return {
    x: pos.x, y: pos.y, eye: opts.eye ?? EYE, W, H,
    focal: FOCAL_K * W, horizon: HORIZON_F * H, forward: opts.forward, pitch: opts.pitch,
  };
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
  const fwd = cam.forward ?? DEFAULT_FORWARD;
  const right = { x: -fwd.y, y: fwd.x };
  const relX = x - cam.x, relY = y - cam.y;
  const relZ = z - cam.eye;
  const d0 = relX * fwd.x + relY * fwd.y;
  const u = relX * right.x + relY * right.y;

  const pitch = cam.pitch;
  let depth: number, v: number;
  if (!pitch) {
    // The common, dead-level case — no trig, matches the original formula
    // exactly (see the file header: this is `pitch = 0` of the general one).
    depth = d0;
    v = relZ;
  } else {
    const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
    depth = d0 * cosP - relZ * sinP;
    v = d0 * sinP + relZ * cosP;
  }
  if (depth <= NEAR) return null;
  const scale = cam.focal / depth;
  return {
    px: cam.W / 2 + u * scale,
    py: cam.horizon - v * scale,
    scale,
  };
}

/**
 * Where the true visual horizon (the vanishing point for anything at eye
 * height) actually falls, given the camera's pitch — `cam.horizon` alone is
 * only that at `pitch = 0`; tilting the camera down shifts it up the screen
 * by `tan(pitch) · focal` (derived in the file header: a point at `z = eye`,
 * i.e. `relZ = 0`, as `d0 → ∞`, projects to `py → horizon − tan(pitch)·focal`).
 * `firstPersonRender.ts` uses this — not `cam.horizon` directly — to split
 * sky from ground, so the establishing shot's steep tilt doesn't leave the
 * grass starting at the wrong row.
 */
export function horizonPx(cam: FpCamera): number {
  return cam.horizon - Math.tan(cam.pitch ?? 0) * cam.focal;
}

/**
 * The inverse of `project` for the DEFAULT (non-rotated) camera, given a
 * depth already known (e.g. "the ball is always 1.7 m ahead of you").
 */
export function unprojectAtDepth(
  cam: FpCamera, px: number, py: number, depth: number,
): { x: number; y: number; z: number } {
  const u = (px - cam.W / 2) * depth / cam.focal;
  const z = cam.eye - (py - cam.horizon) * depth / cam.focal;
  return { x: cam.x + u, y: cam.y - depth, z };
}

/**
 * Where a screen point lands on the GROUND (z = 0) for the DEFAULT
 * (non-rotated) camera — for hit-testing a tap against the turf. Above the
 * horizon is sky, never a point on the pitch: returns null rather than a
 * negative depth (a real bug class — without this guard, a tap on the sky
 * would silently compute as a point behind the camera).
 */
export function groundAt(cam: FpCamera, px: number, py: number): { x: number; y: number } | null {
  if (py <= cam.horizon) return null;
  const depth = cam.focal * cam.eye / (py - cam.horizon);
  const u = (px - cam.W / 2) * depth / cam.focal;
  return { x: cam.x + u, y: cam.y - depth };
}
