/**
 * WHAT A THUMB DID, in a dribble duel (Dribble duels: New). Shared by the
 * first-person duel and the top-down one in the match view, so the moves are
 * the same under your thumb whichever you play.
 *
 *   flick sideways (fast)       knock it past / cut inside — read mid-drag by the screen
 *   tap a side                  drop of the shoulder, selling that side
 *   swipe down on a side        step-over, selling that side
 *   drag                        steer (as before)
 */
export type DribbleRelease =
  | { kind: "shoulder"; side: -1 | 1 }
  | { kind: "stepover"; side: -1 | 1 }
  | { kind: "none" };

export const GESTURE = {
  /** A tap: moved less than this share of the width, released within tapMs. */
  tapMove: 0.035,
  tapMs: 280,
  /** A step-over swipe: at least this share of the width down, mostly down, quick. */
  downMin: 0.07,
  downRatio: 1.4,
  downMs: 450,
};

/** Read a finished touch. `side` is which half of the screen it began on. */
export function classifyRelease(
  start: { x: number; y: number; t: number },
  end: { x: number; y: number; t: number },
  width: number, left: number,
): DribbleRelease {
  const dx = end.x - start.x, dy = end.y - start.y, ms = end.t - start.t;
  const side: -1 | 1 = start.x - left < width / 2 ? -1 : 1;
  if (dy > GESTURE.downMin * width && dy > GESTURE.downRatio * Math.abs(dx) && ms <= GESTURE.downMs) return { kind: "stepover", side };
  if (Math.hypot(dx, dy) <= GESTURE.tapMove * width && ms <= GESTURE.tapMs) return { kind: "shoulder", side };
  return { kind: "none" };
}
