/**
 * THE CAMERA THROUGH YOUR RUN (B14b, Harry, 21 Oct 2026: "why does ur
 * generated game look so weird and small?").
 *
 * Measured first (scripts/star-sandbox/camera-run.mjs, the real career match
 * at 390x844): B14's run never moved the camera. The half-pitch picture in
 * the B14 still is the ordinary long-range chance framing (33 m across, 68 m
 * down, men 17.8 px tall), the same before and during the run. What B14 did
 * add was a CUT when the ball came back: the catch re-framed the chance from
 * scratch (33.3 m -> 32.2 m across, the bottom edge 2.3 m higher, about 25 px
 * on the phone, in one frame).
 *
 * So, for the run:
 *   - the chance's own framing is kept, at the same size (men stay the size
 *     they were at your kick);
 *   - the camera follows the run: it pans, never zooms, only as far as it
 *     needs to keep you and the ball in the picture, and never past the
 *     chance's play area (the engine's "out" line);
 *   - when the ball comes back, the camera you were watching stays. It widens
 *     only if you, the ball and the goal would not all be on the glass, only
 *     as much as that needs, and it eases there (never a cut). The men are
 *     kept their size while it widens (the zoom divides back, as Zoom does).
 *
 * Pure: viewports in pitch metres in, viewports out.
 */
import type { Vec2, Viewport } from "./canvasEngine";

/** Room kept round you and the ball, metres: across, toward goal, behind. */
export const RUN_CAM_SIDE_M = 3;
export const RUN_CAM_TOP_M = 3;
export const RUN_CAM_BOTTOM_M = 4;
/** How fast the follow closes the gap (1/s) and its top speed (m/s). */
export const RUN_CAM_RATE = 4;
export const RUN_CAM_MAX_MS = 9;
/** The widen when the ball comes back: how long it eases (s). */
export const BACK_EASE_S = 0.5;

const W = (v: Viewport) => v.x2 - v.x1;
const Hh = (v: Viewport) => v.y2 - v.y1;

/** Pan `cam` (same size) so every point sits inside it with the margins; then keep it inside `bounds` if given. */
export function panToKeep(cam: Viewport, pts: Vec2[], bounds?: Viewport | null, side = RUN_CAM_SIDE_M, top = RUN_CAM_TOP_M, bottom = RUN_CAM_BOTTOM_M): Viewport {
  let dx = 0, dy = 0;
  if (pts.length) {
    const minX = Math.min(...pts.map((p) => p.x)) - side, maxX = Math.max(...pts.map((p) => p.x)) + side;
    const minY = Math.min(...pts.map((p) => p.y)) - top, maxY = Math.max(...pts.map((p) => p.y)) + bottom;
    if (minX < cam.x1) dx = minX - cam.x1; else if (maxX > cam.x2) dx = maxX - cam.x2;
    if (minY < cam.y1) dy = minY - cam.y1; else if (maxY > cam.y2) dy = maxY - cam.y2;
  }
  if (bounds) {
    // Never further past the play area than it already was (the follow only pans inside the engine's "out" line).
    dx = Math.max(Math.min(0, bounds.x1 - cam.x1), Math.min(Math.max(0, bounds.x2 - cam.x2), dx));
    dy = Math.max(Math.min(0, bounds.y1 - cam.y1), Math.min(Math.max(0, bounds.y2 - cam.y2), dy));
  }
  const out = { x1: cam.x1 + dx, x2: cam.x2 + dx, y1: cam.y1 + dy, y2: cam.y2 + dy };
  return out;
}

/** One frame of the follow: `cur` moves toward `want` (same size) at RUN_CAM_RATE, never faster than RUN_CAM_MAX_MS. */
export function followStep(cur: Viewport, want: Viewport, dt: number): Viewport {
  const dx = (want.x1 + want.x2) / 2 - (cur.x1 + cur.x2) / 2, dy = (want.y1 + want.y2) / 2 - (cur.y1 + cur.y2) / 2;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return cur;
  const step = Math.min(d, d * (1 - Math.exp(-RUN_CAM_RATE * dt)), RUN_CAM_MAX_MS * dt);
  const k = step / d;
  return { x1: cur.x1 + dx * k, x2: cur.x2 + dx * k, y1: cur.y1 + dy * k, y2: cur.y2 + dy * k };
}

/** Is every point inside `cam` with `m` metres to spare? */
export function holds(cam: Viewport, pts: Vec2[], m = 1.5): boolean {
  return pts.every((p) => p.x >= cam.x1 + m && p.x <= cam.x2 - m && p.y >= cam.y1 + m && p.y <= cam.y2 - m);
}

/**
 * The ball is back: the camera to settle on. `cam` itself when you, the ball
 * and the goal already fit; else the smallest same-shape widen of it (about
 * its own middle, then panned the least) that holds them all with `m` to spare.
 */
export function widenToHold(cam: Viewport, pts: Vec2[], m = 1.5): Viewport {
  if (!pts.length || holds(cam, pts, m)) return cam;
  const minX = Math.min(...pts.map((p) => p.x)) - m, maxX = Math.max(...pts.map((p) => p.x)) + m;
  const minY = Math.min(...pts.map((p) => p.y)) - m, maxY = Math.max(...pts.map((p) => p.y)) + m;
  const k = Math.max(1, (maxX - minX) / W(cam), (maxY - minY) / Hh(cam));
  const cx = (cam.x1 + cam.x2) / 2, cy = (cam.y1 + cam.y2) / 2;
  const w = W(cam) * k, h = Hh(cam) * k;
  const grown = { x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 };
  return panToKeep(grown, pts, null, m, m, m);
}

/** Between two cameras at t (0..1), eased in and out. */
export function easeCam(a: Viewport, b: Viewport, t: number): Viewport {
  const u = Math.max(0, Math.min(1, t)), s = u * u * (3 - 2 * u);
  return { x1: a.x1 + (b.x1 - a.x1) * s, x2: a.x2 + (b.x2 - a.x2) * s, y1: a.y1 + (b.y1 - a.y1) * s, y2: a.y2 + (b.y2 - a.y2) * s };
}
