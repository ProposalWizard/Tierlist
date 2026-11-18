/**
 * THE CAMERA: pitch metres <-> screen pixels, exactly as the website's match
 * does it (CanvasMatch toPx / pitchFromPointer / screenPull), including the
 * 20 degree tilt (lib/star/cameraTilt.ts) and the quarter turn of a side-on
 * chance. Pure sums, no drawing.
 */
import { tiltFor, canvasToScreen, screenToCanvas, type Tilt } from "@/lib/star/cameraTilt";
import { VIEW_ASPECT, type Viewport } from "@/lib/star/canvasEngine";

export type Facing = "up" | "left" | "right";

export interface Cam {
  vp: Viewport;
  facing: Facing;
  W: number;
  H: number;
  tilt: Tilt | null;
}

export function makeCam(vp: Viewport, facing: Facing, tiltDeg: number, W: number, H: number): Cam {
  return { vp, facing, W, H, tilt: tiltFor(tiltDeg, W, H) };
}

/** Pitch point -> canvas fraction (0..1), turn included (CanvasMatch screenPull's toScreen). */
export function toFrac(c: Cam, p: { x: number; y: number }): { sx: number; sy: number } {
  const vp = c.vp, W = vp.x2 - vp.x1, H = vp.y2 - vp.y1;
  const fx = (p.x - vp.x1) / W, fy = (p.y - vp.y1) / H;
  if (c.facing === "right") return { sx: 1 - fy, sy: fx };
  if (c.facing === "left") return { sx: fy, sy: 1 - fx };
  return { sx: fx, sy: fy };
}

/** Pitch point -> screen px, through the tilt. `k` is how much bigger things draw there (perspective). */
export function toScreen(c: Cam, p: { x: number; y: number }): { X: number; Y: number; k: number } {
  const f = toFrac(c, p);
  const g = canvasToScreen(c.tilt, f.sx, f.sy, c.W, c.H);
  let k = 1;
  if (c.tilt) {
    const t = c.tilt, y = (f.sy - 0.5) * t.H;
    k = t.s / (1 - (t.s * y * t.sin) / t.d);
  }
  return { X: g.X, Y: g.Y, k };
}

/** Screen px -> pitch point (CanvasMatch pitchFromPointer). */
export function fromScreen(c: Cam, X: number, Y: number): { x: number; y: number } {
  const { sx, sy } = screenToCanvas(c.tilt, X, Y, c.W, c.H);
  const vp = c.vp;
  const fx = c.facing === "right" ? sy : c.facing === "left" ? 1 - sy : sx;
  const fy = c.facing === "right" ? 1 - sx : c.facing === "left" ? sx : sy;
  return { x: fx * (vp.x2 - vp.x1) + vp.x1, y: fy * (vp.y2 - vp.y1) + vp.y1 };
}

/** Metres across the screen per screen px (CanvasMatch pxToM). */
export function pxToM(c: Cam, px: number): number {
  const across = c.facing === "up" ? c.vp.x2 - c.vp.x1 : c.vp.y2 - c.vp.y1;
  return c.W > 0 ? (px * across) / c.W : 0;
}

/**
 * How far the drag point is from the ball, measured on the glass as a share
 * of the classic 5:8 canvas this width would have (CanvasMatch screenPull,
 * new view): the same thumb travel kicks exactly as hard as on the website.
 */
export function screenPull(c: Cam, drag: { x: number; y: number }, ball: { x: number; y: number }): number {
  const onGlass = (q: { sx: number; sy: number }) => {
    if (!c.tilt) return q;
    const g = canvasToScreen(c.tilt, q.sx, q.sy, c.tilt.W, c.tilt.H);
    return { sx: g.X / c.tilt.W, sy: g.Y / c.tilt.H };
  };
  const a = onGlass(toFrac(c, drag)), b = onGlass(toFrac(c, ball));
  const aspect = c.W > 0 && c.H > 0 ? c.W / c.H : VIEW_ASPECT;
  const pull = Math.hypot((a.sx - b.sx) * aspect, a.sy - b.sy);
  const refH = c.W / VIEW_ASPECT;
  return refH > 0 && c.H > 0 ? pull * (c.H / refH) : pull;
}

/** The ball-grab radius in metres (BALL_GRAB_FRACTION of the classic height, CanvasMatch sameOnScreenM). */
export function grabMetres(c: Cam, share: number): number {
  return pxToM(c, share * (c.W / VIEW_ASPECT));
}
