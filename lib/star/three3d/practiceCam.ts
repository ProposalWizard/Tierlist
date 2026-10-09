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
 *   - PLAY mode (Free Roam; Harry, 9 Oct 2026: "free roam camera is still bad
 *     … needs to be more dynamic"): it frames the play, not a fixed
 *     you-and-the-goal shot. With the ball at your feet it eases in tight
 *     behind your shoulder and swings towards goal as you get into shooting
 *     range. With the ball away from you (a pass between team-mates, a loose
 *     ball, a shot) it turns towards the ball and pulls back and rises the
 *     further away the ball is. It leads the way you run by sliding forward,
 *     never by turning (so the stick still never turns it). Every change is
 *     eased and rate-capped like the ball track (PLAY_EASE, PLAY_RATE).
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
/** Play mode (Free Roam). TIGHT: with the ball at your feet. WIDE: the ball 30 m+ away (pull back and rise). */
export const PLAY = {
  tight: { up: 1.9, back: 3.7 },
  wide: { up: 6.0, back: 9.0 },
  /** The ball further than this from you (m) counts as away from you. */
  awayFrom: 2.5,
  /** How far away (m) is the widest framing. */
  wideAt: 30,
  /** How much of the way from the goal to the ball it turns while the ball is away. */
  ballTurn: 0.5,
  /** Ball and goal this close in angle (radians, ~36°) both fit a phone's picture: it aims between them. */
  bothFit: 0.63,
  /** The furthest it turns off the goal towards the ball (radians, 70°). */
  maxDev: 1.22,
  /** How much of the way it looks towards the ball while the ball is away. */
  ballLook: 0.5,
  /** Shooting range (m from the goal): beyond FAR it only drifts towards goal; inside NEAR it swings round fully. */
  rangeFar: 34, rangeNear: 22,
  /** Out of range it turns towards the goal at this share of its usual pace. */
  driftShare: 0.7,
  /** Lead: it slides this many seconds of your run ahead, at most LEAD_MAX metres. */
  leadS: 0.5, leadMax: 3.2,
} as const;
/** How fast the play framing blends (per second), and its fastest change (share per second): no snaps. */
export const PLAY_EASE = 1.8;
export const PLAY_RATE = 0.9;
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
  /** Play mode: 0 = the ball's at your feet or near, 1 = it's 30 m+ away (pulled back and up). */
  away: number;
  /** Play mode: 0 = framing you, 1 = framing the ball (it's away from you, or a shot). */
  focus: number;
  /** Play mode: 0..1, tight behind your shoulder (you have the ball). */
  tight: number;
  /** Play mode: the slide ahead of your run (metres, smoothed). */
  lead: XY;
}

/** Free Roam's brief: what's happening in the play (read off the World each frame). */
export interface PlayState {
  /** Your velocity (m/s): the camera slides ahead of your run. */
  vel: XY;
  /** You have the ball. */
  have: boolean;
  /** A shot is in the air (anyone's). */
  shot?: boolean;
}

export interface PracticeFrame {
  /** You (your feet). */
  you: XY;
  /** What to keep in the picture with you: the goal, or your team-mate. */
  target: XY;
  /** The ball, and whether to track it now (a cross in the air). */
  ball?: XYZ;
  trackBall?: boolean;
  /** Play mode (Free Roam): frame the play. Unset: the drill's fixed brief, as before. */
  play?: PlayState;
}

export function makePracticeCam(heading = -Math.PI / 2): PracticeCam {
  return { heading, turn: 0, pos: { x: 0, y: 0, z: SHOULDER.up }, look: { x: 0, y: 0, z: SHOULDER.lookUp }, track: 0, peek: 0, peekWant: 0, ready: false, away: 0, focus: 0, tight: 0, lead: { x: 0, y: 0 } };
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
  if (f.play) {
    // play mode: towards goal (lazily out of shooting range), and towards the ball while it's away
    const range = Math.max(0, Math.min(1, (PLAY.rangeFar - Math.hypot(dx, dy)) / (PLAY.rangeFar - PLAY.rangeNear)));
    // with the ball it swings fully to goal; without it, it drifts there (fully once in shooting range)
    const g = Math.max(PLAY.driftShare + (1 - PLAY.driftShare) * range, cam.tight);
    const want = wrap(cam.heading + wrap(base - cam.heading) * g);
    if (!f.ball || cam.focus < 0.01) return want;
    const bx = f.ball.x - f.you.x, by = f.ball.y - f.you.y;
    if (Math.hypot(bx, by) < NEAR) return want;
    // the ball away: keep the ball AND the goal in shot when they fit (aim between them); else turn to the
    // ball but stay goal-side of it, never more than maxDev off the goal (so it comes back round quickly)
    const a = wrap(Math.atan2(by, bx) - base), half = PLAY.bothFit / 2;
    const dev = Math.max(-PLAY.maxDev, Math.min(PLAY.maxDev, Math.abs(a) < PLAY.bothFit ? a * PLAY.ballTurn : Math.sign(a) * (Math.abs(a) - half)));
    return wrap(want + wrap(base + dev - want) * cam.focus);
  }
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
  if (f.play) stepPlay(cam, f, dt);
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
  let up = SHOULDER.up + (TRACK.up - SHOULDER.up) * cam.track;
  let back = SHOULDER.back + (TRACK.back - SHOULDER.back) * cam.track;
  let sideK = 1 - cam.track;
  if (f.play) {
    // tight with the ball, pulled back and up as the ball goes away
    up += (PLAY.tight.up - SHOULDER.up) * cam.tight + (PLAY.wide.up - SHOULDER.up) * cam.away;
    back += (PLAY.tight.back - SHOULDER.back) * cam.tight + (PLAY.wide.back - SHOULDER.back) * cam.away;
    sideK *= 1 - cam.away;
  }
  const rx = -fy, ry = fx, side = SHOULDER.side * sideK;
  const lx = f.play ? cam.lead.x : 0, ly = f.play ? cam.lead.y : 0;
  const pos = { x: f.you.x + lx - fx * back + rx * side, y: f.you.y + ly - fy * back + ry * side, z: up };
  let look: XYZ = { x: f.you.x + lx * 1.4 + fx * SHOULDER.lookAhead + rx * side, y: f.you.y + ly * 1.4 + fy * SHOULDER.lookAhead + ry * side, z: SHOULDER.lookUp };
  if (f.play && f.ball && cam.focus > 0.01) {
    // the ball away (or a shot): look towards it, its height too
    const k = PLAY.ballLook * cam.focus;
    look = { x: look.x + (f.ball.x - look.x) * k, y: look.y + (f.ball.y - look.y) * k, z: look.z + (Math.max(0.5, Math.min(4, f.ball.z)) - look.z) * k };
  }
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

/** Ease `v` towards `want`: eased by PLAY_EASE, never faster than PLAY_RATE a second. */
function easeCapped(v: number, want: number, dt: number, fast = 1) {
  const d = (want - v) * Math.min(1, dt * PLAY_EASE * fast);
  return v + Math.max(-PLAY_RATE * fast * dt, Math.min(PLAY_RATE * fast * dt, d));
}

/** Play mode's blends for this frame: how far away the ball is, whether to frame it, tight or not, the lead. */
function stepPlay(cam: PracticeCam, f: PracticeFrame, dt: number) {
  const p = f.play!;
  const dBall = f.ball ? Math.hypot(f.ball.x - f.you.x, f.ball.y - f.you.y) : 0;
  const away = !p.have && dBall > PLAY.awayFrom;
  const wantAway = away ? Math.max(0.15, Math.min(1, (dBall - PLAY.awayFrom) / (PLAY.wideAt - PLAY.awayFrom))) : p.shot ? 0.35 : 0;
  const wantFocus = away || p.shot ? 1 : 0;
  if (!cam.ready) { cam.away = wantAway; cam.focus = wantFocus; cam.tight = p.have ? 1 : 0; }
  cam.away = easeCapped(cam.away, wantAway, dt);
  // the ball back at your feet: it lets go of the ball twice as fast (back round to goal sooner)
  cam.focus = easeCapped(cam.focus, wantFocus, dt, p.have ? 2 : 1);
  cam.tight = easeCapped(cam.tight, p.have ? 1 : 0, dt);
  // the lead: a slide ahead of your run (never a turn)
  const sp = Math.hypot(p.vel.x, p.vel.y), lead = Math.min(PLAY.leadMax, sp * PLAY.leadS);
  const wx = sp > 0.5 ? p.vel.x / sp * lead : 0, wy = sp > 0.5 ? p.vel.y / sp * lead : 0;
  const a = Math.min(1, dt * PLAY_EASE);
  cam.lead = { x: cam.lead.x + (wx - cam.lead.x) * a, y: cam.lead.y + (wy - cam.lead.y) * a };
}

/** Set the peek (radians, clamped to ±PEEK_MAX). 0 lets it spring back. */
export function setPeek(cam: PracticeCam, a: number) { cam.peekWant = Math.max(-PEEK_MAX, Math.min(PEEK_MAX, a)); }

/** The stick (screen x right, y down, length 0–1) as a pitch direction, read against the camera's heading. */
export function stickToPitch(heading: number, sx: number, sy: number): XY {
  const f = { x: Math.cos(heading), y: Math.sin(heading) }, r = { x: -Math.sin(heading), y: Math.cos(heading) };
  return { x: r.x * sx + f.x * -sy, y: r.y * sx + f.y * -sy };
}
