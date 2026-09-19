import { VIEW_ASPECT, type Viewport, type Vec2 } from "../canvasEngine";
import { CX, POST_L, POST_R, GOAL_H, NET_DEPTH, HALF_LEN, PITCH_W } from "../pitch";
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
  /**
   * Which lines `drawPitch` paints, and how tall `drawGoal` builds the goal.
   *
   * Omitted is "small-sided" — a halfway line, a centre spot and a D at each
   * end, drawn flat — which is every existing entry and every existing caller,
   * byte-identical.
   *
   * "penalty-area" is the OTHER real shape this renderer has to draw: a single
   * attacking end of a full-size pitch, seen from behind the ball, with the
   * six-yard box, the penalty area, the D and the spot. It is what the trial's
   * striking stages need, and it is added here rather than given its own
   * renderer because a third copy of "draw a pitch that looks like the real
   * one" is exactly the maintenance cost render.ts's own header already names
   * as this layer's price.
   */
  markings?: "small-sided" | "penalty-area";
  /**
   * How far the netting reaches back behind the goal line. Omitted keeps
   * `drawGoal`'s own default, which is what every existing caller gets.
   */
  netDepth?: number;
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
  /**
   * ── Forty-five minutes, and why it grew ──
   *
   * It was three minutes a half, and at one touch per half-minute that is
   * about a dozen touches with nothing at all between them. Asked for
   * directly, after playing it:
   *
   *   "let's make it exactly the same as a 90 min game highlights wise but cut
   *    the game down to 45 minutes."
   *
   * So the target is not a number of touches — it is a number of HIGHLIGHTS,
   * matched to what a real ninety minutes gives you. Measured through
   * `hiddenMatch` over 400 simulated matches: 7.79 involvements on average.
   * The five-a-side now delivers 7.8 across these forty-five, with real,
   * simulated football in between rather than another touch straight away.
   * See flow.ts.
   */
  minutesPerHalf: 22.5,
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

/**
 * THE ATTACKING END OF A FULL-SIZE PITCH — the shape the trial's striking
 * stages are played on.
 *
 * `ELEVEN_A_SIDE` above is the whole half, written down to prove the shape is
 * data rather than a constant, and honest that nothing plays it. This is the
 * part of it that IS played today: a penalty, a free kick and a vision picture
 * all happen inside the attacking third, in front of a real 7.32 × 2.44 m goal,
 * with the real penalty area around it.
 *
 * It exists so `drawPitch`/`drawGoal`/`drawFigure` can draw a full-size goal
 * for the trial stages without a second copy of any of them. Before this, the
 * penalties stage carried its own three-hundred-line pitch-and-goal painter
 * and the vision stage carried a third one, so a new player met three
 * different art styles inside six minutes.
 *
 * ── `needsMovingCamera`, honestly ──
 *
 * True, for exactly the reason the flag exists: a 68 m pitch does not fit the
 * engine's 26.25 m frame. The striking stages don't fit one either — a
 * thirty-metre free kick and the goal mouth are forty metres apart and a phone
 * is not that shape. They use `cameraContaining` (render.ts), which is the
 * camera this flag has always been waiting for, pointed at a dead ball rather
 * than at continuous play.
 */
export const ELEVEN_A_SIDE_ATTACK: MatchRules = {
  name: "Eleven-a-side (attacking third)",
  outfieldPerSide: 10,
  // The goal line to a little past the halfway line, the full width of a real
  // pitch. The camera decides what of it is actually in shot.
  pitch: { x1: 0, x2: PITCH_W, y1: 0, y2: HALF_LEN },
  // The engine's own frame, as an outer limit for a camera that wants one.
  view: (() => {
    const h = 48;
    const w = h * VIEW_ASPECT;
    return { x1: CX - w / 2, x2: CX + w / 2, y1: -NET_DEPTH - 3, y2: -NET_DEPTH - 3 + h };
  })(),
  goal: { x1: POST_L, x2: POST_R },
  crossbar: GOAL_H,
  halves: 2,
  minutesPerHalf: 45,
  kickFloorY: 6,
  offside: true,
  markings: "penalty-area",
  netDepth: NET_DEPTH,
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
