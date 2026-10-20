import type { Vec2 } from "./canvasEngine";
import { backDir } from "./penaltyRunup";
import { runupSideFor } from "./kickFoot";
import { CX } from "./pitch";

/**
 * WHERE YOUR MAN STANDS WHEN A CHANCE OPENS (Mikey, 20 Oct 2026).
 *
 * Your player is drawn on every chance now ("I like the player to be there").
 * The risk of drawing him on shooting chances was his body covering the ball
 * or the aim arrow. So when a chance opens, before you see it, he is moved to
 * a spot beside and behind the ball, on the side your foot runs up from, where
 * on screen his body touches neither the ball (and its ring) nor the arrow's
 * corridor towards goal. The ball, the aim and the strike are untouched.
 *
 * Pure and in screen space, because "covers" is a question about the picture:
 * `toPx` is the match's own projection, `R` its figure size in pixels.
 */

export interface SpotInput {
  ball: Vec2;
  player: Vec2;
  /** The kicking foot: 1 right, -1 left (kickFoot.ts footSign). */
  foot: number;
  toPx: (x: number, y: number) => { px: number; py: number };
  /** Figure size in pixels (CanvasMatch's R). The body is drawn up from the feet. */
  R: number;
  /** The ball's drawn radius in pixels. */
  ballR: number;
  /** The longest aim arrow, in metres (CanvasMatch: heightSpan × 0.132). */
  arrowM: number;
}

/** The body's box on screen: 2.5 R tall above the feet (MATCH_FIGURE_HEIGHT_R),
 *  a shoulder's width either side, a little shadow below. */
function bodyBox(at: { px: number; py: number }, R: number) {
  return { x1: at.px - 0.5 * R, x2: at.px + 0.5 * R, y1: at.py - 2.55 * R, y2: at.py + 0.25 * R };
}

function boxHitsCircle(b: ReturnType<typeof bodyBox>, cx: number, cy: number, r: number): boolean {
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < r * r;
}

/** Does the man drawn at `p` cover the ball, its ring, or the arrow's corridor? */
export function coversBallOrArrow(p: Vec2, s: SpotInput): boolean {
  const box = bodyBox(s.toPx(p.x, p.y), s.R);
  const b = s.toPx(s.ball.x, s.ball.y);
  // The ball with its ring (2.3 × the ball, CanvasMatch's ringOnBall) and a little air.
  if (boxHitsCircle(box, b.px, b.py, s.ballR * 2.6)) return true;
  // The arrow: from the ball towards the goal, a ball's width either side.
  const back = backDir(s.ball);
  for (let i = 1; i <= 12; i++) {
    const m = (s.arrowM * i) / 12;
    const q = s.toPx(s.ball.x - back.x * m, s.ball.y - back.y * m);
    if (boxHitsCircle(box, q.px, q.py, s.ballR * 1.6)) return true;
  }
  return false;
}

/**
 * The spot to stand on: where he already is if that is clear; otherwise the
 * clear spot nearest a natural stance (a stride behind, a stride to the side
 * your foot runs up from), trying your side before the other.
 */
export function clearYouSpot(s: SpotInput): Vec2 {
  if (!coversBallOrArrow(s.player, s)) return s.player;
  const back = backDir(s.ball);
  // Sideways, + = to the right of a taker facing the goal (penaltyRunup sideOf).
  const side = { x: back.y, y: -back.x };
  const yours = runupSideFor(s.foot);
  let best: Vec2 | null = null;
  let bestCost = Infinity;
  for (const sgn of [yours, -yours]) {
    for (const bk of [0.4, 0.7, 1.0, 1.4, 1.9]) {
      for (const lat of [0.6, 0.9, 1.2, 1.6, 2.1, 2.7]) {
        const p = {
          x: s.ball.x + back.x * bk + side.x * sgn * lat,
          y: s.ball.y + back.y * bk + side.y * sgn * lat,
        };
        if (coversBallOrArrow(p, s)) continue;
        const cost = Math.hypot(bk - 0.7, lat - 0.9) + (sgn === yours ? 0 : 1.5);
        if (cost < bestCost) { bestCost = cost; best = p; }
      }
    }
  }
  return best ?? s.player;
}

/** The goal's centre, for tests and callers that want it. */
export const GOAL_CENTRE: Vec2 = { x: CX, y: 0 };
