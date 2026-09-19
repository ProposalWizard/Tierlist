import { VIEW_ASPECT, type Vec2, type Viewport } from "../canvasEngine";
import { CX } from "../pitch";

/**
 * THE FIVE-A-SIDE PITCH, AND WHY IT IS THE SHAPE IT IS.
 *
 * The match engine's camera never zooms — "a tactics board does not zoom", as
 * its own note puts it. Every situation in the game, from a penalty to a
 * corner, is framed by the same fixed rectangle: `VIEW_H` metres deep, and
 * `VIEW_H × VIEW_ASPECT` wide. That is 42 × 26.25.
 *
 * That constant is the single fact this whole feature rests on, because the
 * engine treats the frame as the world. A ball more than a metre outside
 * `scenario.viewport` is out of play (`stepBallRaw`), and nobody reacts to it
 * out there (`stepReactions`). So a pitch that fits INSIDE one frame is a
 * pitch the engine can already play on, unmodified — and a pitch that does
 * not fit is a rewrite of the engine.
 *
 * A real five-a-side pitch fits. The FA's recommended small-sided dimensions
 * run up to about 36.5 × 27.4 m and futsal is 25-42 × 16-25 m, so 24 × 36
 * sits comfortably in the middle of what a real one is. Dropped into the
 * frame the engine already uses for every corner, it leaves a metre of grass
 * either side, a metre and a half behind your own goal line, and the far net
 * fully in shot.
 *
 * ── Nothing in the engine changes ──
 *
 * `Scenario.viewport` is a plain field that any caller may set — the match
 * itself already overwrites it mid-move when a cross cuts to the box view.
 * Setting our own rectangle is using the engine, not altering it.
 */

/** The engine's own frame depth. Not exported by the engine, so it is
 *  restated here and then PINNED BY TEST to the frame the engine really
 *  builds for a corner — if the engine's own number ever moves, the test
 *  fails rather than this silently disagreeing with it. */
const VIEW_H = 42;

/**
 * The camera. Identical, to the centimetre, to the frame every corner and
 * byline cross in the game is already played in (the engine's private
 * `WIDE_DELIVERY_VIEW`, which it exposes on those scenarios as
 * `crossSwitchView`).
 *
 * Derived the same way the engine derives it rather than copied as four
 * literals, so there is one formula and not two numbers to keep in step.
 */
export const FIVE_VIEW: Viewport = (() => {
  const w = VIEW_H * VIEW_ASPECT;
  return { x1: CX - w / 2, x2: CX + w / 2, y1: -4.5, y2: -4.5 + VIEW_H };
})();

/**
 * The pitch itself, inside that frame. The goal you attack is the engine's
 * own goal line at `y = 0`; your own goal is at `y = FIVE_PITCH.y2`.
 *
 * The margins are deliberate, not slack: the engine calls a ball out at the
 * FRAME edge, which is a metre or so beyond our touchline, so a ball that
 * has genuinely left our pitch is still being simulated when we catch it.
 * That is what lets the match layer resolve a throw-in itself instead of the
 * engine deciding the passage is over.
 */
export const FIVE_PITCH: Viewport = { x1: 22, x2: 46, y1: 0, y2: 36 };

export const FIVE_PITCH_W = FIVE_PITCH.x2 - FIVE_PITCH.x1;   // 24
export const FIVE_PITCH_L = FIVE_PITCH.y2 - FIVE_PITCH.y1;   // 36
/** Halfway, for kick-offs. */
export const FIVE_HALFWAY_Y = (FIVE_PITCH.y1 + FIVE_PITCH.y2) / 2;

/**
 * How far up the frame a ball you are about to strike may sit.
 *
 * You aim by dragging BACKWARDS from the ball, so a ball at the very bottom
 * of the screen is one you cannot pull the arrow far enough for — the drag
 * runs off the bottom of the canvas and the shot sticks. The engine solves
 * this privately, inside `buildScenario`, by keeping the ball out of the
 * bottom fifth of the frame. Because we build our own scenarios and never
 * call `buildScenario`, that rule does not come with them and we have to
 * apply it ourselves.
 *
 * In football terms it is not a restriction at all: it means your keeper
 * rolls the ball out to you a few metres off your own line rather than
 * placing it on the line.
 */
export const KICK_FLOOR_Y = FIVE_VIEW.y2 - (FIVE_VIEW.y2 - FIVE_VIEW.y1) * 0.2;

/**
 * THE GOAL — sized against the keeper who has to guard it, not against a tape
 * measure.
 *
 * ── What this used to be, and why it was wrong ──
 *
 * It was 3.66 m: a real twelve-foot five-a-side goal, about 15% of a 24 m
 * pitch, which is the proportion futsal uses. Every word of that is true and
 * the result was unplayable, because the goal is only half of the question.
 *
 * MEASURED, by sweeping goal width against the keeper's reach: **a clean
 * one-on-one at 3.66 m converts 0.0% of the time.** The engine's keeper has a
 * save radius of about 2.32 m, tuned against a 7.32 m goal where that covers
 * under a third of the mouth. On a 3.66 m goal it covers ALL of it — he does
 * not have to dive, or move, or guess. There is no shot that beats him,
 * however well struck, so the small goal was not "hard", it was closed.
 *
 * Neither lever fixes it alone. Width alone would need about 7 m, which is an
 * eleven-a-side goal on a 24 m pitch — the shooting gallery this note was
 * originally written to avoid. The best pair measured was 4.8 m with the
 * keeper's reach cut by a quarter (68.2%), and that reach cut is only
 * reachable by adding a per-scenario multiplier inside `canvasEngine.ts`,
 * which is the one file this whole feature exists without touching.
 *
 * ── So: 5.2 m, with the keeper floored ──
 *
 * 5.2 m against the weakest keeper the stage's own range allows (see
 * `FIVE_KEEPER_STRENGTH`) lands a corner-aimed one-on-one at 63.5%, and 54.2%
 * as actually played with a real thumb — just inside the 64-71% a real match
 * gives the same chance.
 *
 * It is 22% of the pitch width rather than 15%, and that is a deliberate,
 * stated departure from the real laws: the pitch is real, the goal is sized
 * for the keeper this engine actually has. A goal nobody can score in is not a
 * more faithful five-a-side, it is a broken one.
 *
 * ── The thing to watch, and it has bitten this project before ──
 *
 * A generous keeper does not only make scoring easier — it makes PLACEMENT
 * STOP MATTERING, which is worse. The penalties stage shipped a keeper tuned
 * so kindly that a shot straight down the middle went in 96% of the time, and
 * aiming stopped being a decision. tests/star/fiveASide.mts measures the
 * middle, a half-way ball and a corner separately for exactly that reason.
 *
 * ── The bar ──
 *
 * The real goal is 1.22 m high (four feet). This is futsal's 2 m, and that is
 * a deliberate compromise rather than an oversight: the engine's striking
 * model — how much lift you get from where you hit the ball — is tuned against
 * a 2.44 m crossbar, and a 1.22 m bar would send a large share of ordinary,
 * well-struck shots over it.
 *
 * Nothing in the engine was changed to allow any of this. `Scenario.goal` and
 * `Scenario.crossbar` are fields every scenario in the game already carries.
 */
export const FIVE_GOAL_W = 5.2;
export const FIVE_CROSSBAR = 2.0;
/**
 * The opposing keeper, floored.
 *
 * The stage's own range is `40 + difficulty * 45`, so 40 is the bottom of it —
 * this is not a new number, it is the weakest setting the stage could already
 * ask for, applied always.
 *
 * ── The consequence, stated rather than discovered later ──
 *
 * There is no headroom left on this dial. The five-a-side can no longer be
 * made harder by making the keeper better, because he is already as bad as the
 * range allows. Difficulty has to come from the quality of the chance you are
 * given instead — how far out it is, how much pressure is on it, how often it
 * comes at all — all of which `flow.ts` decides and all of which already scale
 * with `difficulty`.
 */
export const FIVE_KEEPER_STRENGTH = 40;
export const FIVE_GOAL = { x1: CX - FIVE_GOAL_W / 2, x2: CX + FIVE_GOAL_W / 2 };

/** Is this ball still on our pitch? The engine only notices at the frame
 *  edge, which is wider — see FIVE_PITCH's note. */
export function insideFivePitch(p: Vec2): boolean {
  return p.x >= FIVE_PITCH.x1 && p.x <= FIVE_PITCH.x2
    && p.y >= FIVE_PITCH.y1 && p.y <= FIVE_PITCH.y2;
}

/** Which way a ball left the pitch, or null if it has not. Checked in this
 *  order because a ball over the goal line near a corner flag is a goal-line
 *  ball, not a touchline one. */
export function leftPitch(p: Vec2): "goal-line-theirs" | "goal-line-ours" | "touchline" | null {
  if (p.y < FIVE_PITCH.y1) return "goal-line-theirs";
  if (p.y > FIVE_PITCH.y2) return "goal-line-ours";
  if (p.x < FIVE_PITCH.x1 || p.x > FIVE_PITCH.x2) return "touchline";
  return null;
}

/**
 * Turn the pitch around.
 *
 * The engine only knows one direction: you attack `y = 0`. When the OTHER
 * side attacks, their move is handed to the engine mirrored, resolved by the
 * real physics, and the result mirrored back for the screen — so the engine
 * never learns there is a second goal, and we never have to teach it.
 *
 * An involution: mirroring twice returns exactly what you started with,
 * which is the property the round trip depends on and which the tests pin.
 */
export function mirror(p: Vec2): Vec2 {
  return { x: 2 * CX - p.x, y: FIVE_PITCH.y2 - p.y };
}

/** Keep a point on the pitch — for placing a restart, never for deciding
 *  whether a ball went out (that is `leftPitch`, and it must be allowed to
 *  say yes). */
export function clampToPitch(p: Vec2, inset = 0): Vec2 {
  const cl = (v: number, lo: number, hi: number) => Math.max(lo + inset, Math.min(hi - inset, v));
  return {
    x: cl(p.x, FIVE_PITCH.x1, FIVE_PITCH.x2),
    y: cl(p.y, FIVE_PITCH.y1, FIVE_PITCH.y2),
  };
}
