/**
 * PLAY3D BALL — the ball every 3D game plays with. Pure (no three.js).
 *
 * Same flight as the 2D match (canvasEngine.ts stepBallRaw: curl
 * perpendicular to travel, air drag only off the ground, gravity, bounce with
 * topspin and sidespin, rolling resistance only while rolling), with the
 * numbers from ./constants.ts. What 3D adds: the ball is a real sphere that
 * can strike a round post and a round bar and come off them, and it sits in a
 * real net.
 *
 * Frame: pitch metres. x across, y out from the goal line (net is y < 0),
 * z = height of the ball's CENTRE (on the grass z = BALL_R).
 */
import {
  AIR_DRAG, BALL_R, BOUNCE_H, BOUNCE_SPIN_KEEP, BOUNCE_TOPSPIN_H, BOUNCE_TOPSPIN_VZ, BOUNCE_VZ, CURL_K, FRAME_BOUNCE,
  FRAME_R, G, GOAL_H, GROUND_FRICTION, MIN_BOUNCE_VZ, NET_BACK, POST_L, POST_R,
} from "./constants";

export interface Ball3 {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  /** Side spin (the 2D `spin`): positive curls LEFT of travel. */
  spin: number;
  /** −1 backspin … +1 topspin. */
  topspin: number;
  /** In the net (after a goal): the net holds it. */
  inNet: boolean;
}

export interface GoalShape { x1: number; x2: number; h: number; back: number }
/** The real goal at the y = 0 end. */
export const GOAL: GoalShape = { x1: POST_L, x2: POST_R, h: GOAL_H, back: NET_BACK };

export type BallEventKind = "bounce" | "post" | "bar" | "goal" | "byline";
export interface BallEvent { kind: BallEventKind; x: number; y: number; z: number }

export function newBall(x: number, y: number, z = BALL_R): Ball3 {
  return { x, y, z, vx: 0, vy: 0, vz: 0, spin: 0, topspin: 0, inNet: false };
}

export const onGround = (b: Ball3) => b.z <= BALL_R + 0.03 && Math.abs(b.vz) < 0.6;
export const groundSpeed = (b: Ball3) => Math.hypot(b.vx, b.vy);

const SUB = 1 / 240;

/** Advance the ball `dt` seconds. Returns what it hit. */
export function stepBall3d(b: Ball3, dt: number, goal: GoalShape | null = GOAL): BallEvent[] {
  const out: BallEvent[] = [];
  let left = dt;
  while (left > 1e-9) {
    const h = Math.min(SUB, left);
    left -= h;
    sub(b, h, goal, out);
  }
  return out;
}

function sub(b: Ball3, dt: number, goal: GoalShape | null, out: BallEvent[]) {
  const prevY = b.y;
  const airborne = b.z > BALL_R + 0.02;
  // curl
  if (airborne && Math.abs(b.spin) > 1e-4) {
    const ax = b.spin * CURL_K * b.vy, ay = b.spin * CURL_K * -b.vx;
    b.vx += ax * dt; b.vy += ay * dt;
  }
  if (airborne) { const k = Math.max(0, 1 - AIR_DRAG * dt); b.vx *= k; b.vy *= k; }
  b.vz -= G * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;

  let bounced = false;
  if (b.z <= BALL_R) {
    b.z = BALL_R;
    if (b.vz < -MIN_BOUNCE_VZ) {
      const top = Math.max(-1, Math.min(1, b.topspin));
      b.vz = -b.vz * BOUNCE_VZ * (1 - top * BOUNCE_TOPSPIN_VZ);
      const keep = BOUNCE_H * (1 + top * BOUNCE_TOPSPIN_H);
      b.vx *= keep; b.vy *= keep;
      b.spin *= BOUNCE_SPIN_KEEP;
      bounced = true;
      if (b.vz > 1) out.push({ kind: "bounce", x: b.x, y: b.y, z: b.z });
    } else b.vz = 0;
  }
  if (!bounced && b.z <= BALL_R + 0.03 && b.vz <= 0.01) {
    const s = Math.hypot(b.vx, b.vy), drop = GROUND_FRICTION * dt;
    if (s <= drop) { b.vx = 0; b.vy = 0; b.spin = 0; }
    else { const f = (s - drop) / s; b.vx *= f; b.vy *= f; }
  }

  if (!goal) return;
  const hit = FRAME_R + BALL_R;
  // posts: upright cylinders at (x1, 0) and (x2, 0)
  if (b.z < goal.h + FRAME_R && Math.abs(b.y) < hit + 0.05) {
    for (const px of [goal.x1, goal.x2]) {
      const dx = b.x - px, dy = b.y;
      const d = Math.hypot(dx, dy);
      if (d < hit && d > 1e-6) {
        const nx = dx / d, ny = dy / d;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + FRAME_BOUNCE) * vn * nx; b.vy -= (1 + FRAME_BOUNCE) * vn * ny;
          b.spin *= 0.3;
          out.push({ kind: "post", x: b.x, y: b.y, z: b.z });
        }
        b.x = px + nx * hit; b.y = ny * hit;
      }
    }
  }
  // the bar: a cylinder along x at (y 0, z h)
  if (b.x > goal.x1 - FRAME_R && b.x < goal.x2 + FRAME_R) {
    const dy = b.y, dz = b.z - goal.h;
    const d = Math.hypot(dy, dz);
    if (d < hit && d > 1e-6) {
      const ny = dy / d, nz = dz / d;
      const vn = b.vy * ny + b.vz * nz;
      if (vn < 0) {
        b.vy -= (1 + FRAME_BOUNCE) * vn * ny; b.vz -= (1 + FRAME_BOUNCE) * vn * nz;
        b.spin *= 0.3;
        out.push({ kind: "bar", x: b.x, y: b.y, z: b.z });
      }
      b.y = ny * hit; b.z = goal.h + nz * hit;
    }
  }
  // crossing the line
  if (prevY > 0 && b.y <= 0 && !b.inNet) {
    if (b.x > goal.x1 && b.x < goal.x2 && b.z < goal.h) { b.inNet = true; out.push({ kind: "goal", x: b.x, y: b.y, z: b.z }); }
    else out.push({ kind: "byline", x: b.x, y: b.y, z: b.z });
  }
  // the net holds it
  if (b.inNet) {
    const k = Math.max(0, 1 - 3 * dt);
    b.vx *= k; b.vy *= k;
    const backY = -goal.back + BALL_R;
    if (b.y < backY) { b.y = backY; b.vy = Math.abs(b.vy) * 0.1; }
    if (b.y > -BALL_R && b.vy > 0) { b.vy = -b.vy * 0.2; b.y = -BALL_R; }
    if (b.x < goal.x1 + BALL_R) { b.x = goal.x1 + BALL_R; b.vx = Math.abs(b.vx) * 0.2; }
    if (b.x > goal.x2 - BALL_R) { b.x = goal.x2 - BALL_R; b.vx = -Math.abs(b.vx) * 0.2; }
    const roof = goal.h * (1 + b.y / goal.back) - BALL_R;
    if (b.z > roof) { b.z = Math.max(BALL_R, roof); if (b.vz > 0) b.vz = 0; }
  }
}

/** Where a ball now on its way will be after `t` seconds (no goal, no bounce rules beyond the grass). */
export function predictBall(b: Ball3, t: number): Ball3 {
  const c = { ...b };
  stepBall3d(c, t, null);
  return c;
}

/**
 * When a dropping ball will next be at height `z` (seconds from now), and
 * where, ignoring curl. null if it never comes down through it.
 */
export function whenAtHeight(b: Ball3, z: number): { t: number; x: number; y: number } | null {
  // z(t) = b.z + vz t − ½ g t²  → solve the later root
  const a = -0.5 * 9.8, bb = b.vz, c = b.z - z;
  const disc = bb * bb - 4 * a * c;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * a);
  if (!(t >= 0)) return null;
  const k = 1 - AIR_DRAG * t / 2;
  return { t, x: b.x + b.vx * t * k, y: b.y + b.vy * t * k };
}
