/**
 * THE LOOK-AROUND CAMERA, shared by the 3D garden and the 3D shop.
 *
 * Harry, 9 Oct 2026: "the camera is super sensitive in the 3D modes and
 * doesn't work well." Before: a drag turned the camera 0.008 rad per pixel
 * (45.8° per 100 px, half a turn across a phone) and the turn went in at
 * once. Now:
 *   - half the turn: ORBIT_DEG_PER_100PX (22.9° per 100 px);
 *   - smoothed: a drag sets where the camera is going, and it eases there
 *     (ORBIT_EASE per second, never a snap); a jumpy pointer event is capped;
 *   - an up/down drag tilts the camera, held between PITCH_MIN and PITCH_MAX
 *     (it can never flip over, nor go under the floor: minCamY);
 *   - both scenes use these same numbers.
 * Pure (no three.js): tests/star/orbitCam.mts checks it.
 */

/** Turn per pixel of drag (radians). Was 0.008 in both scenes. */
export const ORBIT_RAD_PER_PX = 0.004;
export const ORBIT_DEG_PER_100PX = (ORBIT_RAD_PER_PX * 100 * 180) / Math.PI;
/** Before this change, for the record. */
export const ORBIT_RAD_PER_PX_OLD = 0.008;
/** How fast the camera catches up with the drag (1/s: about 90% there in 0.2 s). */
export const ORBIT_EASE = 12;
/** One pointer event moves at most this many pixels (a dropped frame or a jump is not a whip-pan). */
export const ORBIT_MAX_STEP_PX = 60;
/** Up/down drag tilts less than left/right turns. */
export const PITCH_PER_PX = ORBIT_RAD_PER_PX * 0.6;
/** Tilt from the normal follow view (radians): a little lower, or higher to look down on him. */
export const PITCH_MIN = -0.12;
export const PITCH_MAX = 0.42;
/** The camera never goes lower than this (metres). */
export const CAM_MIN_Y = 0.6;

export class OrbitCam {
  /** Turn still to come (radians): eased in each frame. */
  private yawLeft = 0;
  private pitchWant = 0;
  /** The tilt now (radians, PITCH_MIN..PITCH_MAX). */
  pitch = 0;

  /** A drag of dx, dy pixels (screen right / down). */
  drag(dx: number, dy = 0): void {
    const cx = Math.max(-ORBIT_MAX_STEP_PX, Math.min(ORBIT_MAX_STEP_PX, dx || 0));
    const cy = Math.max(-ORBIT_MAX_STEP_PX, Math.min(ORBIT_MAX_STEP_PX, dy || 0));
    this.yawLeft -= cx * ORBIT_RAD_PER_PX;
    this.pitchWant = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitchWant + cy * PITCH_PER_PX));
  }

  /** Is a turn or tilt still easing in? */
  get moving(): boolean { return Math.abs(this.yawLeft) > 1e-4 || Math.abs(this.pitchWant - this.pitch) > 1e-4; }

  /** Advance dt seconds: the yaw to add to the camera this frame. */
  step(dt: number): number {
    const k = 1 - Math.exp(-ORBIT_EASE * Math.max(0, dt));
    const d = this.yawLeft * k;
    this.yawLeft -= d;
    if (Math.abs(this.yawLeft) < 1e-5) this.yawLeft = 0;
    this.pitch += (this.pitchWant - this.pitch) * k;
    return d;
  }

  /** Forget any turn still to come (the camera was placed). */
  reset(): void { this.yawLeft = 0; }

  /**
   * The camera's height for a follow camera `back` metres behind at `baseY`,
   * tilted by the pitch about the point he is looked at (`lookY`), never under CAM_MIN_Y.
   * Returns [height, how much nearer in the boom comes] so the distance to him stays the same.
   */
  lift(baseY: number, back: number, lookY: number): [number, number] {
    const a0 = Math.atan2(baseY - lookY, back);
    const r = Math.hypot(baseY - lookY, back);
    const a = Math.max(-0.35, Math.min(1.25, a0 + this.pitch)); // never past straight down: no flip
    return [Math.max(CAM_MIN_Y, lookY + r * Math.sin(a)), r * Math.cos(a)];
  }
}
