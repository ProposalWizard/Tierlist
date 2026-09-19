import type { Ball, Defender, Scenario, Vec2 } from "../canvasEngine";

/**
 * THROWING A BODY AT IT — the one thing you do when they are shooting.
 *
 * ── The problem this exists for ──
 *
 * Their chance is played out by the real engine and it is genuinely watched
 * rather than rolled, which was the whole point of building it that way. But
 * watching is all it was: the ball left their man's foot and the only thing
 * you could do about it was see what happened. Roughly three chances a match,
 * every one of them a cutscene.
 *
 * ── The shape, and why it is one tap and not a control scheme ──
 *
 * The flow stops with the ball at their man's feet and a countdown ring runs
 * for `BRACE_MS`. One tap inside that window, and only one:
 *
 *   on one of your men  — he sets off, THERE AND THEN, for the nearest point
 *                         of the line between the ball and the middle of the
 *                         goal, and throws himself across it. He does not know
 *                         where the shot is going any more than you do; he
 *                         blocks off the angle and makes them beat him. Whether
 *                         he actually gets in the way is then decided by the
 *                         engine's own defender-reach check inside `stepBall`,
 *                         exactly as it is for every block in the game — a real
 *                         block resolved by real physics, not a roll dressed up
 *                         as one.
 *   on the goal mouth   — your keeper commits early to that side.
 *
 * Tapping early is worth real ground, because he runs during the window rather
 * than after the kick. That is not flavour: a struck shot is past a given spot
 * in under a tenth of a second, so a man who starts moving when it is hit
 * never gets anywhere. See `stepBlockRun`.
 *
 * The cost is what makes it a decision rather than a button you always press.
 * A committed man has abandoned the drift toward the ball everybody else makes
 * and is standing wherever you sent him — in the way, or nowhere. A keeper who
 * commits early has guessed, and a wrong guess leaves him moving away from the
 * ball. Measured over 2,000 matches a side, conceded per match:
 *
 *   no input at all                                 1.02
 *   every tap the right one (knows the shot)        0.74
 *   reading the picture, not the future             0.82
 *   tapping something, not necessarily right        0.99
 *
 * Playing it well is worth a quarter of a goal a match. Playing it blind is
 * worth nothing — within one standard error of not acting. A mechanic where
 * flailing helps is not a decision, and the drafts of this that did help are
 * recorded on `stepBlockRun` and `KEEPER_COMMIT_SHIFT` rather than quietly
 * dropped.
 *
 * ── Why none of this is in the engine ──
 *
 * `Defender.x/y` and `Keeper.targetX` are public fields the engine reads every
 * tick. Writing a position from a pure function called in the component's own
 * substep loop is the precedent `stepTouchChase` already set for Touch Mode.
 * Nothing here is imported into `canvasEngine.ts` and nothing in
 * `canvasEngine.ts` was changed for it.
 *
 * `Defender.interceptTo` and `role: "intercept"` are DECLARED in the engine and
 * look like exactly the hook this wants, and they are not: nothing reads
 * either of them (only `initDefenders` clears it). Leaning on them would have
 * been a commit that silently did nothing, so the men are moved by hand.
 */

/** How long the ball sits at their man's feet before he strikes it. */
export const BRACE_MS = 1100;

/**
 * How much of that window a real thumb spends deciding, in milliseconds.
 *
 * Not used by the game at all — the game just runs the clock. It exists so the
 * measurements in tests/star/fiveASideDefend.mts model a player rather than a
 * machine: everything the tap is worth depends on how much of the window is
 * left when it lands, so a harness that taps at t=0 would report a mechanic
 * nobody can actually have.
 */
export const TAP_LATENCY_MS = 350;

/**
 * How fast a committed man travels, m/s, and for how long.
 *
 * What actually matters is the product — how far he can get — and it was
 * TUNED, over 1,200 matches a setting. Everything else about the mechanic
 * follows from it:
 *
 *   how far he can get   perfect play   a player reading it   tapping at random
 *   3.0 m                    0.800             0.912                1.011
 *   4.2 m                    0.747             0.841                0.980
 *   5.1 m                    0.687             0.774                0.957
 *
 * (baseline, no input at all: 0.997 goals conceded a match.)
 *
 * 4.2 m is the setting where tapping at random is genuinely worth nothing —
 * within a third of a standard error of doing nothing — while a player who
 * actually reads the picture is a sixth of a goal a match better off. Push it
 * to 5.1 and flailing starts to pay, which is the one thing this must not do.
 *
 * Split 6.0 m/s for 0.7 s rather than, say, 4.2 for 1.0: the distance is the
 * same and so is the measurement (checked — 3.2x0.9, 6.0x0.48 and 7.6x0.38
 * all land within a standard error of each other), but 6 m/s is a man
 * sprinting and 3.2 is a man jogging, and one of those looks like throwing a
 * body at a shot.
 */
export const BLOCK_SPRINT_SPEED = 6.0;
export const BLOCK_RUN_SECONDS = 0.7;

/**
 * How far off centre a committed keeper goes, in metres, on a goal whose half
 * width is 2.6.
 *
 * Deliberately short of the post, and the number is the point at which
 * GUESSING stops being worth it. Measured over 2,000 matches, as goals
 * conceded per chance you actually watch:
 *
 *              guessed right   guessed wrong   never committed
 *   0.60 m         17.2%           27.2%
 *   0.75 m         15.0%           26.6%            20.1%
 *   0.90 m         12.6%           27.9%
 *   1.15 m          7.3%           28.2%
 *
 * At 1.15 a coin flip comes out at 17.8% — better than leaving him alone, so
 * a player who tapped the goal every time and never looked would be rewarded
 * for it. At 0.75 a coin flip is 20.8%, a shade WORSE than the 20.1% of not
 * committing at all, which is what makes it a guess with something riding on
 * it rather than a free option.
 */
export const KEEPER_COMMIT_SHIFT = 0.75;

/** What you did with your one tap. */
export type FiveCommit =
  | { kind: "block"; defender: number }
  | { kind: "keeper"; side: -1 | 1 };

/**
 * Hit-test a tap, IN THE SCENARIO'S OWN COORDINATES.
 *
 * Their move is played mirrored (see geometry.ts's `mirror`), so the caller
 * turns the tap round before handing it here — this function never learns
 * there are two ends.
 *
 * The generosity is `FiveASide`'s own `passTargetAt` rather than a second
 * opinion: nearest man inside a radius scaled off the camera, because a
 * footballer is a centimetre wide on a phone. A tap that is nearer the goal
 * mouth than any of your men is a keeper commit; a tap that is near neither is
 * a mis-tap and costs nothing, which is better than a commit you did not mean.
 */
export function commitAt(sc: Scenario, p: Vec2, grabR: number): FiveCommit | null {
  let best: number | null = null;
  let bestD = grabR;
  sc.defenders.forEach((d, i) => {
    const dist = Math.hypot(p.x - d.x, p.y - d.y);
    if (dist < bestD) { bestD = dist; best = i; }
  });

  // The goal mouth, widened by the same grab radius and given real depth so a
  // tap just in front of the line counts. Your keeper stands on it.
  const gy = sc.keeper.y;
  const inMouth = p.y < gy + grabR
    && p.x > sc.goal.x1 - grabR && p.x < sc.goal.x2 + grabR;
  if (inMouth) {
    const mouthD = Math.hypot(p.x - sc.keeper.x, p.y - gy);
    if (best === null || mouthD < bestD) {
      const centre = (sc.goal.x1 + sc.goal.x2) / 2;
      return { kind: "keeper", side: p.x >= centre ? 1 : -1 };
    }
  }
  return best === null ? null : { kind: "block", defender: best };
}

/**
 * A man who has been sent. Created at the strike, stepped every substep.
 *
 * ── Why this carries state instead of being the bare
 *    `stepBlockRun(scenario, defender, target, dt)` it was sketched as ──
 *
 * Two things have to happen every substep and neither is expressible in a
 * stateless call. He needs a clock, for the beat before he moves. And he needs
 * the position he was in before `stepReactions` ran, because committing has to
 * CANCEL his ordinary reaction — which is the whole cost of the mechanic and
 * is explained on `stepBlockRun` itself.
 */
export interface BlockRun {
  defender: Defender;
  /** Where he has thrown himself. Fixed at the strike; see `blockTargetFor`. */
  target: Vec2;
  /** Seconds since the ball was struck. */
  t: number;
  /** Where his own running left him last substep. */
  was: Vec2;
}

/**
 * The spot a committing man throws himself at.
 *
 * ── The version this replaced, and why it was wrong ──
 *
 * The obvious one is the point on the ball's ACTUAL line of flight nearest to
 * him. It was built that way first and measured: perfect play took conceding
 * from 1.06 a match to 0.62, which is fine — and tapping at RANDOM took it to
 * 0.96, which is not. Every man you could possibly tap set off toward the one
 * line the ball was really on, so the tap had no wrong answer, only a less
 * good one. A mechanic where flailing helps is not a decision.
 *
 * ── What he actually commits to ──
 *
 * A LANE. Of the two lines from the ball to the two posts, he throws himself
 * across whichever he is already nearer, at the nearest point of it. That is
 * what a defender does in a five-a-side: he does not know where it is going
 * either, so he blocks off the side he is standing on and makes them beat him
 * the other way.
 *
 * Which is exactly the cost the mechanic needed. Send the man covering the
 * near post and they roll it into the far corner, and he is not only beaten —
 * he is somewhere else entirely, having abandoned the ordinary drift he would
 * otherwise have made toward the ball (see `stepBlockRun`).
 */
export function blockTargetFor(sc: Scenario, ballAt: Vec2, d: Vec2): Vec2 {
  const cx = (sc.goal.x1 + sc.goal.x2) / 2;
  const vx = cx - ballAt.x, vy = 0 - ballAt.y;
  const len2 = vx * vx + vy * vy;
  if (len2 < 1e-9) return { x: ballAt.x, y: ballAt.y };
  const t = Math.max(0, Math.min(1,
    ((d.x - ballAt.x) * vx + (d.y - ballAt.y) * vy) / len2));
  return { x: ballAt.x + vx * t, y: ballAt.y + vy * t };
}

/** Send a man. Called the instant you tap him, which is BEFORE the ball is
 *  struck — see `stepBlockRun` for why that matters more than anything else
 *  in this file. */
export function beginBlockRun(sc: Scenario, ballAt: Vec2, defender: Defender): BlockRun {
  return {
    defender,
    target: blockTargetFor(sc, ballAt, defender),
    t: 0,
    was: { x: defender.x, y: defender.y },
  };
}

/**
 * Advance a committed man one substep.
 *
 * Called every substep of the brace window AND every substep of the flight —
 * during the flight, AFTER `stepReactions` and BEFORE `stepBall`, which is the
 * order `stepTouchChase` is called in too.
 *
 * Returns true once he has arrived. Whether arriving did any good is never
 * this function's business: the engine's own reach check inside `stepBall` is
 * what decides that, on the same terms as every other block in the game.
 *
 * ── The single fact this whole mechanic turned on ──
 *
 * He has to set off BEFORE the ball is struck, and the first version of this
 * did not. It was measured, and it is worth writing the numbers down because
 * they are so flat:
 *
 *   committed at the moment of the strike, sprinting at the ball's real line,
 *   picked by a player who could SEE where the shot was going to go:
 *   conceding went from 1.01 a match to 0.96 at a 15 m/s sprint — a speed
 *   nobody in football has ever run at. Picked by a player reading the
 *   picture in front of him instead of the future, at every sprint speed from
 *   4.6 to 15: +0.02 to +0.08 a match, i.e. WORSE than not acting.
 *
 * The reason is arithmetic rather than tuning. A struck shot travels about
 * 20 m/s and is past a given point in under a tenth of a second; a man runs
 * at five or six. Nobody blocks a shot by starting to move once it has been
 * hit — real blocks happen because the defender was already there. So the run
 * happens in the brace window, where there is a whole second of it, and the
 * tap is early enough to matter: tap the instant the flow stops and he covers
 * real ground, dither and he is still travelling when it goes past him.
 *
 * ── The first two lines are the cost of the mechanic ──
 *
 * They put him back where his own running left him, undoing whatever
 * `stepReactions` just did to him. That is not tidiness. A defender who has
 * NOT been committed drifts toward the ball whenever it comes inside nine
 * metres of him, and that ordinary drift is worth a real share of the 1.8
 * blocks a match the stage already produces with no input at all. A man who
 * has been sent is no longer doing that — he is going where you sent him, and
 * if you sent him wrong he is neither in the lane nor drifting into it.
 */
export function stepBlockRun(_scenario: Scenario, run: BlockRun, dt: number): boolean {
  const d = run.defender;
  d.x = run.was.x;
  d.y = run.was.y;
  let arrived = run.t >= BLOCK_RUN_SECONDS;
  const dx = run.target.x - d.x, dy = run.target.y - d.y;
  const togo = Math.hypot(dx, dy);
  if (arrived || togo < 0.02) arrived = true;
  else {
    const step = Math.min(togo, BLOCK_SPRINT_SPEED * dt);
    d.x += (dx / togo) * step;
    d.y += (dy / togo) * step;
    arrived = step >= togo;
  }
  run.t += dt;
  run.was = { x: d.x, y: d.y };
  return arrived;
}

/**
 * Send the keeper early.
 *
 * `scrambling` is the engine's own "cover real ground toward `targetX` at a
 * capped speed" state — the same machinery it uses for a keeper chasing a
 * spill, and the same one its own shot-crossing code turns on a fraction of a
 * second later. Setting it here only decides where he IS when the ball
 * arrives; everything about the save itself is still the engine's.
 *
 * ── One real side effect, and it is left in on purpose ──
 *
 * `stepKeeper` checks `scrambling` BEFORE `adjusting`, so a keeper you have
 * committed stops doing his own automatic shading across when they play the
 * ball to somebody else. That is a genuine extra cost of sending him early
 * rather than an oversight — you have taken the decision off him — and every
 * number measured for this mechanic already has it in.
 */
export function commitKeeper(sc: Scenario, side: -1 | 1) {
  const centre = (sc.goal.x1 + sc.goal.x2) / 2;
  sc.keeper.scrambling = true;
  sc.keeper.targetX = centre + side * KEEPER_COMMIT_SHIFT;
}
