/**
 * THE MAN ON THE BALL IN THE 3D MATCH: where he stands before a kick, and which
 * moment of the run-up-and-strike clip he is in (Harry, 12 Oct 2026: "We should be
 * using the penalty animations, why is he just stood next to the ball").
 *
 * Picture only. The 2D match (CanvasMatch) decides everything:
 *  - a penalty or a direct free kick: the 2D already stands you a few steps back
 *    (runupStyles.ts standBackFor) and walks you in over the run-up (`runS`). The 3D
 *    plays the real run-up-and-strike capture (`kick_r` / `kick_l`, CMU 11_01) timed
 *    off the 2D's own run-up clock, so the plant lands when the 2D's strike screen opens;
 *  - a corner and open play: the 2D draws no run-up. The 3D stands you behind the ball
 *    in the shot's direction (a ready-to-strike stance, never beside it) and, when the
 *    strike screen opens, plays the last steps of the same clip into the plant.
 * Pure (no three.js): tests/star/setPiece3d.mts.
 */
import { CX } from "../pitch";

export interface P2 { x: number; y: number }

export const SET_PIECE_3D = {
  /** Corner: this far back from the ball, this many degrees off the line behind it (the kick-foot's side). */
  cornerBack: 2.6, cornerAngleDeg: 35,
  /** Open play: a short set stance behind the ball. */
  openBack: 1.3, openAngleDeg: 12,
  /** The last steps into the ball once the strike screen opens, seconds (corner / open play). */
  cornerApproachS: 1.0, openApproachS: 0.45,
  /** The run-up clip is used for at most this long before the plant (the 2D's walk-in does the rest with the gait). */
  maxRunClipS: 1.2,
};

/** Where the kick goes: the aim's tip, else the goal (a corner: the penalty spot). */
export function shotTarget(kind: string, aim: { from: P2; to: P2 } | null | undefined, ball: P2): P2 {
  if (aim && Math.hypot(aim.to.x - aim.from.x, aim.to.y - aim.from.y) > 0.3) {
    return { x: ball.x + (aim.to.x - aim.from.x), y: ball.y + (aim.to.y - aim.from.y) };
  }
  return kind === "corner" ? { x: CX, y: 11 } : { x: CX, y: 0 };
}

/**
 * The stance: `back` metres behind the ball on the line from the target through it, turned
 * `angleDeg` toward the kick-foot's side (a right-footer comes from his left, as
 * penaltyRunup.ts's sideOf). `foot` +1 right, −1 left.
 */
export function stanceSpot(ball: P2, target: P2, back: number, angleDeg: number, foot: number): P2 {
  let dx = target.x - ball.x, dy = target.y - ball.y;
  const L = Math.hypot(dx, dy) || 1;
  dx /= L; dy /= L;
  const bx = -dx, by = -dy; // straight back
  const side = foot < 0 ? 1 : -1;
  const a = (angleDeg * Math.PI) / 180, s = side * Math.sin(a), c = Math.cos(a);
  return { x: ball.x + (bx * c + by * s) * back, y: ball.y + (by * c - bx * s) * back };
}

/** The stance for this kind of kick (corner or open play). */
export function stanceFor(kind: string, ball: P2, target: P2, foot: number): P2 {
  const P = SET_PIECE_3D;
  return kind === "corner"
    ? stanceSpot(ball, target, P.cornerBack, P.cornerAngleDeg, foot)
    : stanceSpot(ball, target, P.openBack, P.openAngleDeg, foot);
}

export function approachSFor(kind: string): number {
  return kind === "corner" ? SET_PIECE_3D.cornerApproachS : SET_PIECE_3D.openApproachS;
}

/**
 * A penalty / free kick run-up: the clip time to show, `rem` seconds before the 2D's
 * plant, holding at `hold` (the backswing the strike screen keeps). Null: too early,
 * he is still walking in on the gait.
 */
export function runClipTime(runS: number, t: number, hold: number): number | null {
  const rem = Math.max(0, runS - t);
  const lead = Math.min(hold, SET_PIECE_3D.maxRunClipS);
  return rem <= lead ? hold - rem : null;
}

/** How far into the clip segment (0..1): the share of the way from the 2D's path to the foot-on-ball spot. */
export function runBlend(runS: number, t: number, hold: number): number {
  const rem = Math.max(0, runS - t);
  const lead = Math.min(hold, SET_PIECE_3D.maxRunClipS);
  return rem >= lead ? 0 : 1 - rem / lead;
}
