/**
 * THE FOOT HE KICKS WITH, ON SCREEN (v0.25, item 4).
 *
 * Harry, live, 2 Oct 2026: the foot chosen on the profile (left or right,
 * step 10) should decide which foot takes the set pieces and penalties in the
 * animation. A left-footer runs up from the right of the ball and strikes with
 * his left — the mirror of a right-footer.
 *
 * PICTURE ONLY. Nothing here moves the ball, the aim, the keeper or where the
 * game thinks you are standing (`scenario.player`). CanvasMatch draws the
 * taker on the mirrored side of the ball and swings the right leg; the kick
 * itself is exactly the same kick.
 */
import { backDir } from "./penaltyRunup";
import type { PreferredFoot } from "./playerIdentity";

type Vec2 = { x: number; y: number };

/** +1 right foot, −1 left foot — the sign the body drawing reads (BodyPose.kickFoot). */
export function footSign(foot: PreferredFoot | undefined | null): 1 | -1 {
  return foot === "left" ? -1 : 1;
}

/**
 * Which side of the ball he runs up from, in penaltyRunup.ts's `sideOf`
 * terms (+1 = to the right of a taker facing goal). A right-footer comes from
 * his left, a left-footer from his right.
 */
export function runupSideFor(sign: number): 1 | -1 {
  return sign < 0 ? 1 : -1;
}

/**
 * Where to DRAW the taker: `p` itself, or `p` mirrored across the straight
 * line behind the ball (towards the goal) when it is on the wrong side for
 * his foot. Distance from the ball is kept exactly, so the run-up is the same
 * length and shape, only from the other side.
 */
export function drawnTakerAt(ball: Vec2, p: Vec2, sign: number): { at: Vec2; mirrored: boolean } {
  const b = backDir(ball);
  const lateral = (p.x - ball.x) * b.y - (p.y - ball.y) * b.x;
  if (Math.abs(lateral) < 0.05 || Math.sign(lateral) === runupSideFor(sign)) return { at: p, mirrored: false };
  // n is the unit sideways direction (lateral of n = 1).
  return { at: { x: p.x - 2 * lateral * b.y, y: p.y + 2 * lateral * b.x }, mirrored: true };
}

/**
 * A team-mate or an opponent over the ball: a stable foot from his id or
 * name, about one in five left-footed (roughly the real share).
 */
export function takerFootSign(key: string | undefined | null): 1 | -1 {
  const k = (key ?? "").trim();
  if (!k) return 1;
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return h % 5 === 0 ? -1 : 1;
}

/**
 * The player's own foot, for a screen that plays the match without the career
 * in hand (the trial and training mount the engine through EngineFeature,
 * which is given skills, not the save). The star page sets it whenever the
 * career's foot is known; CanvasMatch prefers the career it was given.
 */
let active: PreferredFoot | undefined;
export function setActiveFoot(foot: PreferredFoot | undefined | null): void {
  active = foot === "left" || foot === "right" ? foot : undefined;
}
export function activeFoot(): PreferredFoot | undefined {
  return active;
}
