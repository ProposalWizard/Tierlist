// Real football pitch geometry, in metres.
//
// This is the single source of truth for every dimension in the match engine —
// physics, scenario building and rendering all read from here, so what the
// renderer draws is literally the same geometry the ball is tested against.
// Getting this wrong was the root of a whole family of bugs (balls "scoring"
// short of the drawn net, keepers apparently standing miles off their line,
// goals that looked three times too wide), so the numbers below are the real
// IFAB Laws of the Game figures rather than anything tuned by eye.
//
// Coordinate system:
//   x — 0 at the left touchline, PITCH_W at the right. 1 unit = 1 metre.
//   y — 0 at the attacking goal line, growing AWAY from goal (upfield).
//       The halfway line is at HALF_LEN. Behind the goal line is negative y.
//   z — metres above the turf.
//
// Both axes are metric and equally scaled, so a circle drawn on the pitch is a
// circle on screen and a distance means the same thing whichever way it points.

/** Full pitch width, touchline to touchline (IFAB: 64–75 m; 68 is standard). */
export const PITCH_W = 68;
/** Half the pitch length — the goal line to the halfway line. */
export const HALF_LEN = 52.5;
/** Centre of the pitch on the x axis. */
export const CX = PITCH_W / 2; // 34

/** Distance between the inside of the posts. */
export const GOAL_W = 7.32;
/** Underside of the crossbar. */
export const GOAL_H = 2.44;
/** Inside faces of the left and right posts. */
export const POST_L = CX - GOAL_W / 2; // 30.34
export const POST_R = CX + GOAL_W / 2; // 37.66
/** How far the net extends behind the goal line (for rendering the ball entering). */
export const NET_DEPTH = 2.0;

/** Six-yard box: 5.5 m deep, 5.5 m either side of each post. */
export const SIX_DEPTH = 5.5;
export const SIX_L = POST_L - 5.5; // 24.84
export const SIX_R = POST_R + 5.5; // 43.16

/** Penalty area: 16.5 m deep, 16.5 m either side of each post. */
export const BOX_DEPTH = 16.5;
export const BOX_L = POST_L - 16.5; // 13.84
export const BOX_R = POST_R + 16.5; // 54.16

/** Penalty spot, 11 m from the goal line, and the arc radius around it. */
export const PEN_SPOT_Y = 11;
export const ARC_R = 9.15;

/** Centre circle radius (same 9.15 m) and the corner arc radius. */
export const CENTRE_R = 9.15;
export const CORNER_R = 1;

/** Radius of the ball, used for goal-line and post collision tests. */
export const BALL_R = 0.11;

/** True when a crossing point is between the posts (goal mouth, ignoring height). */
export function insideGoalMouth(x: number): boolean {
  return x >= POST_L && x <= POST_R;
}

/** True when a crossing point clips a post rather than passing cleanly by. */
export function hitsPost(x: number): boolean {
  return (x >= POST_L - BALL_R * 2 && x < POST_L) || (x > POST_R && x <= POST_R + BALL_R * 2);
}

/** True when a point is inside the penalty area. */
export function insideBox(x: number, y: number): boolean {
  return x >= BOX_L && x <= BOX_R && y >= 0 && y <= BOX_DEPTH;
}
