/**
 * THE MATCH'S DRAG-TO-KICK MATHS, AS PLAIN FUNCTIONS.
 *
 * Asked for by Harry (24 Sep 2026): "five-a-side is its own beast so that's
 * fine, but the shooting/goal mechanics should still fully carry over
 * perfectly." An audit found five-a-side measuring the pull as
 * `hypot(Δx/W, Δy/H)` — a fraction of the width sideways and of the height
 * lengthways — so on its 5:6 canvas a sideways drag bought 20% more power per
 * pixel than the same drag up the screen, and its arrow was drawn from that
 * screen-fraction direction while the ball flew the metre direction, about
 * 20% wider than the ball went.
 *
 * These are a character-for-character port of what `CanvasMatch.tsx` does
 * today (its `pitchFromPointer`, `screenPull`, `powerFromDrag`, `MIN_PULL`
 * and the two floors in `onPointerUp`). CanvasMatch itself still has its own
 * inline copy — it is not to be edited in this round — and
 * `tests/star/kickInput.mts` re-implements that inline formula as the
 * reference and checks these agree with it number for number, so the two
 * cannot drift apart without a red test.
 *
 * Pure: no React, no canvas, no engine physics.
 */
import { clamp, dragForFullPower, VIEW_ASPECT, type Vec2, type Viewport } from "./canvasEngine";

/** Which way the frame is turned. "up" is the ordinary view; a crossing
 *  situation is watched from the side. Same meaning as CanvasMatch's own. */
export type KickFacing = "up" | "right" | "left";

/**
 * The shortest drag that counts as aiming at all, as a fraction of the canvas
 * height. CanvasMatch's own `MIN_PULL` — a mis-tap-sized floor.
 */
export const MIN_PULL = 0.008;

/**
 * The weakest strike that counts as a kick. CanvasMatch's `power < 0.02`
 * floor in `onPointerUp`.
 */
export const MIN_POWER = 0.02;

/**
 * A point on the pitch -> where it sits on the canvas, as fractions
 * (sx of the width, sy of the height). CanvasMatch's `toScreen` inside
 * `screenPull`: the exact inverse of `screenToPitch`, turn and all.
 */
export function pitchToScreen(
  p: Vec2, vp: Viewport, facing: KickFacing = "up",
): { sx: number; sy: number } {
  const W = vp.x2 - vp.x1, H = vp.y2 - vp.y1;
  const fx = (p.x - vp.x1) / W, fy = (p.y - vp.y1) / H;
  if (facing === "right") return { sx: 1 - fy, sy: fx };
  if (facing === "left") return { sx: fy, sy: 1 - fx };
  return { sx: fx, sy: fy };
}

/**
 * A spot on the canvas, as fractions of its width (sx) and height (sy) ->
 * pitch metres. CanvasMatch's `pitchFromPointer` after it has divided by the
 * element's rect. Deliberately NOT clamped to the canvas — you aim by dragging
 * back from the ball, and a ball near the edge needs dragging past it.
 */
export function screenToPitch(
  sx: number, sy: number, vp: Viewport, facing: KickFacing = "up",
): Vec2 {
  const f = facing;
  const fx = f === "right" ? sy : f === "left" ? 1 - sy : sx;
  const fy = f === "right" ? 1 - sx : f === "left" ? sx : sy;
  return {
    x: fx * (vp.x2 - vp.x1) + vp.x1,
    y: fy * (vp.y2 - vp.y1) + vp.y1,
  };
}

/**
 * How far the thumb travelled from the ball, as a fraction of the canvas
 * HEIGHT. CanvasMatch's `screenPull`.
 *
 * `aspect` is the canvas's width / height. The real match's canvas is always
 * `VIEW_ASPECT` (5:8), which is what CanvasMatch hard-codes; a screen drawn at
 * another shape passes its own, so a pixel is worth the same whichever way it
 * is dragged. Default: the match's.
 */
export function screenPull(
  drag: Vec2, ball: Vec2, vp: Viewport, facing: KickFacing = "up", aspect: number = VIEW_ASPECT,
  heightScale = 1,
): number {
  const a = pitchToScreen(drag, vp, facing), b = pitchToScreen(ball, vp, facing);
  // sx is a fraction of the canvas WIDTH and sy of its HEIGHT, so put them in
  // the same units before measuring. `heightScale` is this canvas's height over
  // the real match's (CanvasMatch's `dragReferenceHeightPx`): a screen drawn a
  // different height reads the same finger movement as the same kick.
  return Math.hypot((a.sx - b.sx) * aspect, a.sy - b.sy) * heightScale;
}

/** A pull (fraction of canvas height) -> strike power 0-1, scaled by the
 *  striker's power attribute. CanvasMatch's `powerFromDrag`, second half. */
export function powerFromPull(pull: number, powerSkill: number): number {
  return clamp(pull / dragForFullPower(powerSkill), 0, 1);
}

/** CanvasMatch's `powerFromDrag`. */
export function powerFromDrag(
  drag: Vec2, ball: Vec2, vp: Viewport, powerSkill: number,
  facing: KickFacing = "up", aspect: number = VIEW_ASPECT, heightScale = 1,
): number {
  return powerFromPull(screenPull(drag, ball, vp, facing, aspect, heightScale), powerSkill);
}

/** Which way the ball goes: from the thumb back through the ball, in pitch
 *  metres. CanvasMatch's `{ x: b.x - d.x, y: b.y - d.y }`. The arrow must be
 *  drawn along THIS, the same vector `launch` is handed. */
export function aimDirection(drag: Vec2, ball: Vec2): Vec2 {
  return { x: ball.x - drag.x, y: ball.y - drag.y };
}

/**
 * The whole gesture, settled: the direction and power to hand `launch`, or
 * null if it was not a kick. CanvasMatch's `onPointerUp` — the pull floor
 * first (a thumb that slipped), then the power floor.
 */
export function aimFromDrag(
  drag: Vec2, ball: Vec2, vp: Viewport, powerSkill: number,
  facing: KickFacing = "up", aspect: number = VIEW_ASPECT, heightScale = 1,
): { dir: Vec2; power: number } | null {
  const power = powerFromDrag(drag, ball, vp, powerSkill, facing, aspect, heightScale);
  if (screenPull(drag, ball, vp, facing, aspect, heightScale) < MIN_PULL) return null;
  if (power < MIN_POWER) return null;
  return { dir: aimDirection(drag, ball), power };
}
