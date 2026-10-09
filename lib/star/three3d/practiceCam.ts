/**
 * THE PRACTICE-ARENA CAMERA — the 3D drills' shared camera (Harry, 9 Oct
 * 2026: "the camera should be set above the players shoulders not in tandem
 * with the joystick. Like fifa in the practice arena." and "the camera also
 * has to follow the ball on headers and volleys").
 *
 * The rules, in one place (tests/star/practiceCam.mts checks each one):
 *   - It sits behind you and above your shoulders: SHOULDER.up metres up,
 *     SHOULDER.back metres back, looking a little down.
 *   - It follows your POSITION smoothly (no snapping).
 *   - It turns ON ITS OWN, towards the thing it frames (the goal, or your
 *     team-mate), never faster than MAX_TURN (60° a second), eased in and out.
 *   - Your stick and your facing NEVER turn it. Nothing here reads them.
 *   - Ball track (Headers & Volleys): while a cross is in the air it lifts,
 *     steps back and turns towards the ball so you can read where it drops;
 *     then it settles behind your shoulder for the strike.
 *   - Peek (Q/E on a PC, a two-finger drag on a phone): an extra look round
 *     that springs back when you let go.
 *
 * Pure maths on the pitch plane (x across, y along, z up); no three.js here,
 * so the tests run it headless. The 3D picture (lib/star/play3d/scene.ts)
 * turns {pos, look} into a three.js camera.
 */
/** Behind you and above your shoulders. Metres. */
/** Behind you and above your shoulders (metres): up, back, and a little to the right (over the right shoulder, so you never hide what it frames); where it looks. */
export const SHOULDER = { up: 2.2, back: 4.6, side: 0.8, lookAhead: 7, lookUp: 0.4 } as const;
/** While a cross is in the air: higher and further back, so the drop is readable. */
export const TRACK = { up: 3.6, back: 6.2 } as const;
/** The fastest it ever turns on its own: 60° a second. */
export const MAX_TURN = Math.PI / 3;
/** How hard it eases towards the wanted heading (per second, per radian off). 60°/s is reached 0.42 rad (24°) off. */
export const TURN_EASE = 2.5;
/** How fast its own turn speed may change (rad/s²): no jerk at the start or end of a turn. */
export const TURN_ACCEL = 3.0;
/** How quickly it follows your position (per second). */
export const FOLLOW = 5;
/** How quickly ball-track blends in and out (per second). */
export const TRACK_EASE = 2.2;
/** The most a peek turns it (radians, 40°), and how fast a peek moves (per second). */
export const PEEK_MAX = 0.7;
export const PEEK_EASE = 6;
/** Inside this (metres) of what it frames, it stops chasing the heading (no spinning when you stand on the spot). */
const NEAR = 1.2;

export interface XY { x: number; y: number }
export interface XYZ { x: number; y: number; z: number }

export interface PracticeCam {
  /** The way it looks along the ground (0 = +x). Peek not included. */
  heading: number;
  /** Its own turn speed, rad/s (eased). */
  turn: number;
  /** Where it stands (smoothed). */
  pos: XYZ;
  /** Where it looks (smoothed). */
  look: XYZ;
  /** 0 = behind your shoulder, 1 = tracking the ball. */
  track: number;
  /** The peek now (radians), and where it is heading. */
  peek: number;
  peekWant: number;
  ready: boolean;
}

export interface PracticeFrame {
  /** You (your feet). */
  you: XY;
  /** What to keep in the picture with you: the goal, or your team-mate. */
  target: XY;
  /** The ball, and whether to track it now (a cross in the air). */
  ball?: XYZ;
  trackBall?: boolean;
}

export function makePracticeCam(heading = -Math.PI / 2): PracticeCam {
  return { heading, turn: 0, pos: { x: 0, y: 0, z: SHOULDER.up }, look: { x: 0, y: 0, z: SHOULDER.lookUp }, track: 0, peek: 0, peekWant: 0, ready: false };
}

export const wrap = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

/** The heading it wants this frame: from you to the target, or (tracking) mostly to the ball. */
export function wantedHeading(cam: PracticeCam, f: PracticeFrame): number {
  const dx = f.target.x - f.you.x, dy = f.target.y - f.you.y;
  const base = Math.hypot(dx, dy) > NEAR ? Math.atan2(dy, dx) : cam.heading;
  if (!f.ball || cam.track < 0.01) return base;
  const bx = f.ball.x - f.you.x, by = f.ball.y - f.you.y;
  if (Math.hypot(bx, by) < NEAR) return base;
  // tracking: 55% of the way from the target to the ball, so you, the ball and the goal stay readable
  const toBall = Math.atan2(by, bx);
  return wrap(base + wrap(toBall - base) * 0.55 * cam.track);
}

/** One frame. Returns the camera to draw (peek included) and the heading the stick is read against. */
export function stepPracticeCam(cam: PracticeCam, f: PracticeFrame, dt: number): { pos: XYZ; look: XYZ; heading: number } {
  dt = Math.max(0, Math.min(0.1, dt));
  // ball track blends in and out
  const wantTrack = f.trackBall && f.ball ? 1 : 0;
  cam.track += (wantTrack - cam.track) * Math.min(1, dt * TRACK_EASE);
  // the turn: eased towards the wanted heading, capped at MAX_TURN, its own speed changing smoothly
  const want = wantedHeading(cam, f);
  if (!cam.ready) { cam.heading = want; cam.turn = 0; }
  const off = wrap(want - cam.heading);
  const wantTurn = Math.max(-MAX_TURN, Math.min(MAX_TURN, off * TURN_EASE));
  const dTurn = Math.max(-TURN_ACCEL * dt, Math.min(TURN_ACCEL * dt, wantTurn - cam.turn));
  cam.turn = Math.max(-MAX_TURN, Math.min(MAX_TURN, cam.turn + dTurn));
  // never overshoot the wanted heading
  const step = cam.turn * dt;
  cam.heading = wrap(cam.heading + (Math.abs(step) > Math.abs(off) ? off : step));
  // peek springs to where the thumb or key wants it
  cam.peek += (cam.peekWant - cam.peek) * Math.min(1, dt * PEEK_EASE);
  const h = cam.heading + cam.peek;
  const fx = Math.cos(h), fy = Math.sin(h);
  const up = SHOULDER.up + (TRACK.up - SHOULDER.up) * cam.track;
  const back = SHOULDER.back + (TRACK.back - SHOULDER.back) * cam.track;
  const rx = -fy, ry = fx, side = SHOULDER.side * (1 - cam.track);
  const pos = { x: f.you.x - fx * back + rx * side, y: f.you.y - fy * back + ry * side, z: up };
  let look: XYZ = { x: f.you.x + fx * SHOULDER.lookAhead + rx * side, y: f.you.y + fy * SHOULDER.lookAhead + ry * side, z: SHOULDER.lookUp };
  if (f.ball && cam.track > 0.01) {
    // look towards the ball (its height too), as much as the track blend says
    const k = 0.4 * cam.track;
    look = { x: look.x + (f.ball.x - look.x) * k, y: look.y + (f.ball.y - look.y) * k, z: look.z + (Math.max(0.5, f.ball.z) - look.z) * k };
  }
  if (!cam.ready) { cam.pos = pos; cam.look = look; cam.ready = true; }
  const a = Math.min(1, dt * FOLLOW);
  cam.pos = { x: cam.pos.x + (pos.x - cam.pos.x) * a, y: cam.pos.y + (pos.y - cam.pos.y) * a, z: cam.pos.z + (pos.z - cam.pos.z) * a };
  cam.look = { x: cam.look.x + (look.x - cam.look.x) * a, y: cam.look.y + (look.y - cam.look.y) * a, z: cam.look.z + (look.z - cam.look.z) * a };
  return { pos: cam.pos, look: cam.look, heading: h };
}

/** Set the peek (radians, clamped to ±PEEK_MAX). 0 lets it spring back. */
export function setPeek(cam: PracticeCam, a: number) { cam.peekWant = Math.max(-PEEK_MAX, Math.min(PEEK_MAX, a)); }

/** The stick (screen x right, y down, length 0–1) as a pitch direction, read against the camera's heading. */
export function stickToPitch(heading: number, sx: number, sy: number): XY {
  const f = { x: Math.cos(heading), y: Math.sin(heading) }, r = { x: -Math.sin(heading), y: Math.cos(heading) };
  return { x: r.x * sx + f.x * -sy, y: r.y * sx + f.y * -sy };
}
