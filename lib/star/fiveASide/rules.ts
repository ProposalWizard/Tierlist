import type { Viewport, Vec2 } from "../canvasEngine";
import { CX, POST_L, POST_R, GOAL_H } from "../pitch";
import { FIVE_PITCH, FIVE_VIEW, FIVE_GOAL, FIVE_CROSSBAR } from "./geometry";

/**
 * WHAT KIND OF FOOTBALL THIS IS.
 *
 * Everything the match layer needs to know about the shape of the game, as
 * data rather than as constants baked into the code: how big the pitch is, how
 * many a side, how big the goals are, how long it lasts.
 *
 * ── Why this exists at all, when only one of them is built ──
 *
 * Asked for directly, and it is the reason this file is here rather than a
 * handful of hard-coded fives:
 *
 *   "we also need to add this new match playing to the 11 aside goals — for
 *    now it isn't going to supersede the engine we've worked on but I could
 *    see it being good in the future, like when u get certain boots you get to
 *    play more of the match, or if you get to a certain level"
 *
 * Today you play the handful of moments the ball reaches you and the other
 * eighty-nine minutes are simulated. Continuous play would let you keep
 * playing after your touch instead of cutting away — which is the same
 * passages-in-a-row machinery a five-a-side needs, pointed at a full pitch.
 *
 * That is a real feature of its own and wants its own round. The only thing
 * this file is for is making sure the five-a-side does not make it HARDER: if
 * "four outfielders on a 24 × 36 pitch with a small goal" is written into
 * every function, an eleven-a-side version is a rewrite. Written as data, it
 * is a second entry in this file.
 *
 * The third caller is nearer than the eleven-a-side one: the five-a-side comes
 * back at the top of a training drill ladder, which is a third place that will
 * want its own shape (a smaller pitch, fewer men, a shorter game).
 */
export interface MatchRules {
  /** What to call it on screen. */
  name: string;
  /** Outfield players per side, not counting the keeper. */
  outfieldPerSide: number;
  /** The playable area, in the engine's own pitch metres. */
  pitch: Viewport;
  /** The camera. Must contain `pitch` with room to spare — see geometry.ts. */
  view: Viewport;
  /** The goal being attacked (`y = 0`), and how high its bar is. */
  goal: { x1: number; x2: number };
  crossbar: number;
  /** Halves, and how long each is in match minutes. */
  halves: number;
  minutesPerHalf: number;
  /**
   * How far up the frame a strikeable ball may sit, so there is room to drag
   * backwards and aim. See KICK_FLOOR_Y.
   */
  kickFloorY: number;
  /** Is there an offside law? A five-a-side has none. */
  offside: boolean;
  /**
   * True when this shape is too big to fit in one camera frame, so it cannot
   * actually be played until the camera learns to follow the ball.
   *
   * This is a real, stated limitation rather than a flag invented to make a
   * sanity check pass. The engine's frame is a fixed 26.25 x 42 m window that
   * does not zoom; a real pitch is 68 m wide. There is no arrangement of those
   * two numbers that shows a full pitch, so a continuous eleven-a-side match
   * needs a moving camera — genuine work, and work this file has not done.
   *
   * Everything ELSE about the shape (squad sizes, goal, laws, clock) is real
   * data today, which is the whole point: when somebody builds the moving
   * camera, they build a camera, not a second match layer.
   */
  needsMovingCamera?: boolean;
}

/** The one that is actually built. */
export const FIVE_A_SIDE: MatchRules = {
  name: "Five-a-side",
  outfieldPerSide: 4,
  pitch: FIVE_PITCH,
  view: FIVE_VIEW,
  goal: FIVE_GOAL,
  crossbar: FIVE_CROSSBAR,
  halves: 2,
  minutesPerHalf: 3,
  kickFloorY: FIVE_VIEW.y2 - (FIVE_VIEW.y2 - FIVE_VIEW.y1) * 0.2,
  offside: false,
};

/**
 * The shape a continuous ELEVEN-a-side match would be, written out so the
 * claim "this is a parameter, not a constant" is checkable rather than a
 * promise. Nothing plays it yet.
 *
 * Honest about what it does NOT solve: the camera. A real pitch is 68 × 105 m
 * and the engine's frame is a fixed 26.25 × 42 m window that does not zoom, so
 * a continuous eleven-a-side match cannot show the whole pitch the way a
 * five-a-side can — it would have to move the camera with the ball, which is a
 * real piece of work this file does not pretend to have done. What IS settled
 * here is that the squad sizes, the goal, the laws and the clock are all data.
 */
export const ELEVEN_A_SIDE: MatchRules = {
  name: "Eleven-a-side",
  outfieldPerSide: 10,
  // A real half of a real pitch. Deliberately NOT trimmed to whatever would
  // fit the fixed frame: shrinking the pitch to suit the camera would be
  // writing down a lie about the shape of football to make a check pass.
  pitch: { x1: 0, x2: 68, y1: 0, y2: 52.5 },
  view: FIVE_VIEW,
  goal: { x1: POST_L, x2: POST_R },
  crossbar: GOAL_H,
  halves: 2,
  minutesPerHalf: 45,
  kickFloorY: FIVE_VIEW.y2 - (FIVE_VIEW.y2 - FIVE_VIEW.y1) * 0.2,
  offside: true,
  // The honest part. See the field's own note.
  needsMovingCamera: true,
};

/** Kick-off spot — the middle of the pitch, whatever size it is. */
export function centreSpot(rules: MatchRules): Vec2 {
  return {
    x: (rules.pitch.x1 + rules.pitch.x2) / 2,
    y: (rules.pitch.y1 + rules.pitch.y2) / 2,
  };
}

/** Total match minutes. */
export function fullTimeMinutes(rules: MatchRules): number {
  return rules.halves * rules.minutesPerHalf;
}

/** Where the halfway line is, for deciding whether a pass is a pass or a
 *  lay-off for a shot. */
export function halfwayY(rules: MatchRules): number {
  return (rules.pitch.y1 + rules.pitch.y2) / 2;
}

/** The centre of the goal being attacked. */
export function goalCentreX(rules: MatchRules): number {
  return (rules.goal.x1 + rules.goal.x2) / 2;
}

/** Sanity: is this a shape the engine can actually play? Used by the tests,
 *  and by anybody adding a third entry above. */
export function rulesAreSane(rules: MatchRules): string[] {
  const bad: string[] = [];
  const { pitch, view, goal } = rules;
  if (pitch.x1 >= pitch.x2 || pitch.y1 >= pitch.y2) bad.push("the pitch has no area");
  if (goal.x1 >= goal.x2) bad.push("the goal has no width");
  if (goal.x1 < pitch.x1 || goal.x2 > pitch.x2) bad.push("the goal is not on the pitch");
  // A shape that admits it needs a moving camera is not expected to fit in
  // one frame — that is precisely what it is admitting. Checking it anyway
  // would be asking a question whose answer is already written down.
  if (!rules.needsMovingCamera) {
    if (pitch.x1 < view.x1 || pitch.x2 > view.x2) bad.push("the pitch is wider than the camera");
    if (pitch.y2 > view.y2) bad.push("your own goal is off the bottom of the camera");
  }
  if (rules.outfieldPerSide < 1) bad.push("a side needs at least one outfielder");
  if (rules.crossbar <= 0) bad.push("the bar has no height");
  if (rules.halves < 1 || rules.minutesPerHalf <= 0) bad.push("the match has no length");
  if (rules.kickFloorY <= pitch.y1) bad.push("there is nowhere legal to take a kick from");
  return bad;
}
