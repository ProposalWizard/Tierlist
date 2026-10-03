/**
 * A DEFENDER NEVER PLAYS THE REBOUND AT HIS OWN KEEPER (v0.25, item 20).
 *
 * Harry, live on his phone, 2 Oct 2026: a long shot was saved, the ball came
 * back out, and an opposition defender "shot" the loose ball at his own
 * keeper, who saved it.
 *
 * What did it, measured over 4,800 played chances
 * (scratchpad/v025/feel/defTouch.mts): not the engine's clearance — every
 * `clearBall` goes up the pitch, 0 of 343 at goal. It was the block
 * deflection (lib/star/deflection.ts, v0.15 item 16), which CanvasMatch
 * applies after a "blocked". Two of its three shapes carry on goalwards:
 * a "glance" at goal 79% of the time and a "loop" 69%. On a rebound, a
 * team-mate's poke at the loose ball hits the defender, and the glance rolls
 * on into the keeper's arms. On screen it is the defender shooting at his own
 * goal.
 *
 * The rule here: once the keeper or the woodwork has touched the ball in this
 * move (the second phase), a defender who gets a body on it sends it AWAY from
 * his goal. The first block of your own strike is untouched: Harry asked for
 * that to be able to "bounce off into the goal at a weird angle" (v0.15).
 *
 * Pure, and draws no random numbers, so the match's stream and a goal replay
 * are exactly what they were. Nothing in lib/star/canvasEngine.ts changes.
 */
import { markLanding, type Ball, type Scenario } from "./canvasEngine";

/** The keeper or the frame has already had it this move. */
export function isSecondPhase(ball: Ball, sc: Scenario): boolean {
  return sc.keeper.saves > 0 || ball.deflected === "keeper" || ball.deflected === "frame";
}

/**
 * Turn a ball travelling at the goal line (y = 0) back out, by mirroring its
 * run up the pitch. Speed, height and the sideways part are kept, so it
 * still reads as the same touch, only the right way.
 */
export function turnAwayFromGoal(ball: Ball, sc: Scenario): boolean {
  if (ball.vel.y >= 0) return false;
  ball.vel = { x: ball.vel.x, y: -ball.vel.y };
  ball.spin = -ball.spin;
  markLanding(ball, sc);
  return true;
}

/** After a block deflection (deflection.ts): a rebound is played away, never at goal. */
export function steerDeflectionFromOwnGoal(ball: Ball, sc: Scenario): boolean {
  if (!isSecondPhase(ball, sc)) return false;
  return turnAwayFromGoal(ball, sc);
}

/**
 * The 50-50 on a loose ball (canvasEngine's "short" with the defence last on
 * it): the move is over and the ball rolls on after the whistle. It rolls
 * away from his goal, not on into his keeper.
 */
export function clearLooseWin(ball: Ball, sc: Scenario): boolean {
  if (ball.lastTouch !== "defence" || !ball.settling) return false;
  return turnAwayFromGoal(ball, sc);
}
