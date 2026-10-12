/**
 * WHERE A 3D MAN STANDS, FROM WHERE THE 2D MATCH PUT HIM (Harry, 12 Oct 2026:
 * "players are kicking and jumping / half teleporting with the ball").
 *
 * The 2D match decides where every man is; the 3D view only draws him. Some
 * frames the 2D spot jumps a metre or three (a man re-placed when a chance
 * chains, a runner snapped onto his mark, the frame rate dipping). Drawn as it
 * came, he teleports, and the jump read as a sprint for a frame, so his legs
 * flickered into the sprint clip too.
 *
 * Now the drawn man follows the 2D spot at a man's top speed (`maxSpeed`),
 * never more than `maxLag` metres behind it, and a jump over `snapM` (a new
 * chance, a cut) is taken at once. Drawing only: the 2D game, its touches and
 * its results never read this. Pure: tests/star/animSmoothMatch.mts measures it.
 */
export const FOLLOW = {
  /** Over this (m) in one frame is a cut: put him there at once. */
  snapM: 4,
  /** Never more than this far behind the 2D spot (m). */
  maxLag: 3.5,
  /** A man's top speed on the drawn pitch (m/s): faster 2D moves are caught up over a few frames. */
  maxSpeed: 12,
};
export type FollowParams = typeof FOLLOW;

export interface FollowPoint { x: number; y: number }

/**
 * One frame: where to draw him, from where he was drawn (`p`) and where the 2D
 * put him (`target`). `snapped` says it was a cut (reset his pace and pose).
 */
export function followStep(p: FollowPoint, target: FollowPoint, dt: number, P: FollowParams = FOLLOW): { x: number; y: number; snapped: boolean } {
  const dx = target.x - p.x, dy = target.y - p.y;
  const d = Math.hypot(dx, dy);
  if (!(d > 1e-9)) return { x: target.x, y: target.y, snapped: false };
  if (d > P.snapM || !(dt > 0)) return { x: target.x, y: target.y, snapped: d > P.snapM };
  const move = Math.min(d, Math.max(P.maxSpeed * dt, d - P.maxLag));
  return { x: p.x + (dx / d) * move, y: p.y + (dy / d) * move, snapped: false };
}
