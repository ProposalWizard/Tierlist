/**
 * REAL BALL PHYSICS — the "New" side of Settings → Gameplay → "Ball physics".
 *
 * Leo, 11 Oct 2026: "ball physics needs to be perfect." The Old physics
 * (canvasEngine.ts, untouched) used a flat 0.12/s drag only while airborne, a
 * flat 1.9 m/s² roll, a fixed 0.70/0.88 bounce, spin that never decayed in the
 * air, and posts and a bar that always sent the ball straight back out. This
 * file is the same ball, built from the numbers of a real one:
 *
 *   mass 0.43 kg, circumference 0.69 m (IFAB Law 2: 410–450 g, 68–70 cm)
 *   air density 1.225 kg/m³
 *   drag coefficient: ~0.47 slow (subcritical), ~0.24 fast (supercritical),
 *     the "drag crisis" between them around 12 m/s (wind-tunnel studies of
 *     modern match balls: Asai et al. 2007; Goff & Carré 2009–2013)
 *   grass bounce: vertical restitution 0.6 (FIFA Quality Programme: a ball
 *     dropped from 2 m rebounds 0.60–0.85 m, e = 0.55–0.65); grass friction
 *     takes horizontal speed off on a steep bounce, up to the point it rolls
 *   rolling: ~0.85 m/s² rolling resistance on cut grass (FIFA ball-roll test:
 *     4–10 m from the ramp) + a small speed-dependent grass drag + air drag
 *   spin: decays in the air (time constant ~5 s: an estimate — measurements
 *     show a kicked ball keeps most of its spin over a 1–2 s flight) and
 *     quickly on the grass (~0.7 s)
 *   posts and bar: 12 cm round (radius 6 cm), restitution 0.7 off the
 *     aluminium, the ball bounces off the round surface at the real angle —
 *     so a ball clipping the inside of the post can go in, and one hitting
 *     the outside goes wide.
 *
 * Every sum here is in metres, seconds and m/s, same as the engine.
 *
 * Off (Old) unless CanvasMatch switches it on for a chance (the device
 * setting), so every existing test still runs the Old ball exactly as before.
 * `STAR_BALL_PHYSICS=new` in the environment switches it on for a whole node
 * test run, which is how the match tests are measured under New.
 */
import type { Ball } from "./canvasEngine";
import { BALL_R, GOAL_H, POST_L, POST_R } from "./pitch";

let realOn = (() => {
  try { return typeof process !== "undefined" && process.env?.STAR_BALL_PHYSICS === "new"; } catch { return false; }
})();

/** Switch the real ball on or off (CanvasMatch, per chance, from the setting). */
export function setBallPhysics(v: "new" | "old"): void { realOn = v === "new"; }
/** Is the real ball on? */
export function realBallOn(): boolean { return realOn; }

// ── The ball and the air ─────────────────────────────────────────────────────
export const G_REAL = 9.8;
export const BALL_MASS = 0.43;
export const BALL_RADIUS = 0.69 / (2 * Math.PI);              // 0.1098 m
export const BALL_AREA = Math.PI * BALL_RADIUS * BALL_RADIUS;  // 0.0379 m²
export const AIR_RHO = 1.225;
/** ½ρA/m: drag deceleration = K_AIR · Cd · v² */
export const K_AIR = (0.5 * AIR_RHO * BALL_AREA) / BALL_MASS;  // 0.0540 /m
export const CD_SLOW = 0.47;
export const CD_FAST = 0.20;
export const CD_CRISIS_V = 11;
export const CD_CRISIS_W = 1.6;

/** The drag coefficient at a speed — the drag crisis as a smooth step. */
export function dragCoeff(v: number): number {
  return CD_FAST + (CD_SLOW - CD_FAST) / (1 + Math.exp((v - CD_CRISIS_V) / CD_CRISIS_W));
}

// ── The grass ────────────────────────────────────────────────────────────────
export const ROLL_DECEL = 0.85;   // m/s² rolling resistance
export const GRASS_DRAG = 0.05;   // /s — longer grass blades hold a faster ball more
export const BOUNCE_E = 0.6;      // vertical restitution off grass
export const GRASS_MU = 0.5;      // grass–ball friction during a bounce
/** Thin shell: sliding to rolling takes 2/5 of the slip speed off (I = ⅔mr²). */
export const ROLL_ON = 0.4;
const MIN_BOUNCE_VZ = 0.5;        // same as the Old ball: below this it rolls

// ── Spin ─────────────────────────────────────────────────────────────────────
export const SPIN_TAU_AIR = 5;     // s
export const SPIN_TAU_GROUND = 0.7;// s
const CURL_K = 0.48;               // the Old curl strength, unchanged
const BOUNCE_SPIN_KEEP = 0.82;
const BOUNCE_TOPSPIN_VZ = 0.18;
const BOUNCE_SIDESPIN_TURN = 0.12;

// ── The frame ────────────────────────────────────────────────────────────────
export const POST_RADIUS = 0.06;
export const FRAME_E = 0.7;        // off the aluminium, normal to it
export const FRAME_TANGENT_KEEP = 0.9;
export const POST_HIT_R = BALL_R + POST_RADIUS;  // 0.17 m centre to centre
/** Post centres: the inside faces are POST_L / POST_R, the post is 12 cm wide. */
export const POST_CX_L = POST_L - POST_RADIUS;
export const POST_CX_R = POST_R + POST_RADIUS;
/** The bar's centre line height. */
export const BAR_CZ = GOAL_H + POST_RADIUS;

type Cond = { drag: number; friction: number; bounce: number; wind: number } | undefined;

/** Multiply all three velocity components by this for one airborne step. */
export function airDragFactor(vx: number, vy: number, vz: number, dragMul: number, dt: number): number {
  const s = Math.hypot(vx, vy, vz);
  return 1 / (1 + K_AIR * dragCoeff(s) * dragMul * s * dt);
}

/** How much horizontal speed a rolling ball loses this step. */
export function rollDrop(s: number, fricMul: number, dragMul: number, dt: number): number {
  return (ROLL_DECEL * fricMul + GRASS_DRAG * s + K_AIR * dragCoeff(s) * dragMul * s * s) * dt;
}

/**
 * One bounce off the grass. Returns the new vertical speed and how much of the
 * horizontal speed is kept. Steep bounces lose more along the ground (the grass
 * grips the ball) up to the point it rolls; topspin rolls on, backspin checks.
 */
export function bounceReal(vzIn: number, vh: number, top: number, bounceMul: number): { vz: number; keep: number; top: number } {
  const e = BOUNCE_E * bounceMul;
  const vz = -vzIn * e * (1 - top * BOUNCE_TOPSPIN_VZ);
  if (vh < 0.01) return { vz, keep: 1, top };
  // Slip at the contact patch. `top` is the ball's forward spin as a share of
  // rolling (rω / v): 1 rolls clean (no slip), 0 none, backspin below 0.
  const slip = vh * clamp(1 - top, 0, 2);
  // A light skip barely presses into the turf, so the grass hardly grips it:
  // full grip from a 3 m/s landing up (a dropped or lofted ball), next to none
  // for the 1 m/s hop a driven ground ball makes as it leaves the boot.
  const grip = Math.min(1, (Math.abs(vzIn) / 3) ** 2);
  const loss = Math.min(GRASS_MU * grip * (1 + e) * Math.abs(vzIn), ROLL_ON * slip);
  // The same grip spins it up: a thin shell's slip falls by 2.5× the speed it
  // lost (Δv = −loss, Δ(rω) = +1.5·loss). Rolling clean = no slip = top 1.
  const vOut = Math.max(0.001, vh - loss);
  const topOut = clamp((top * vh + 1.5 * loss) / vOut, -1, 1);
  return { vz, keep: Math.max(0, vOut / vh), top: topOut };
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }

/**
 * One step of the real ball: curl, air drag, wind, gravity, move, bounce, roll.
 * The same job, in the same order, as the Old block in stepBallRaw. Returns
 * whether it bounced this step (the roll is not charged on a bounce step).
 */
export function integrateBallReal(ball: Ball, cond: Cond, dt: number): boolean {
  const dragMul = cond?.drag ?? 1;
  // Curl: the heading turns at spin · CURL_K rad/s, as before.
  const sp0 = Math.hypot(ball.vel.x, ball.vel.y);
  if (sp0 > 0.01 && Math.abs(ball.spin) > 0.0001) {
    const ax = ball.spin * CURL_K * ball.vel.y;
    const ay = ball.spin * CURL_K * -ball.vel.x;
    ball.vel.x += ax * dt;
    ball.vel.y += ay * dt;
  }
  const airborne = ball.z > 0.02;
  if (airborne) {
    const k = airDragFactor(ball.vel.x, ball.vel.y, ball.vz, dragMul, dt);
    ball.vel.x *= k; ball.vel.y *= k; ball.vz *= k;
    if (cond?.wind) ball.vel.x += cond.wind * dt;
  }
  // Spin dies away: slowly in the air, fast on the grass.
  if (ball.spin !== 0) ball.spin *= Math.exp(-dt / (airborne ? SPIN_TAU_AIR : SPIN_TAU_GROUND));

  ball.vz -= G_REAL * dt;
  ball.z += ball.vz * dt;
  ball.pos.x += ball.vel.x * dt;
  ball.pos.y += ball.vel.y * dt;

  let bounced = false;
  if (ball.z <= 0) {
    ball.z = 0;
    if (ball.vz < -MIN_BOUNCE_VZ) {
      const top = clamp(ball.topspin ?? 0, -1, 1);
      const vh = Math.hypot(ball.vel.x, ball.vel.y);
      const b = bounceReal(ball.vz, vh, top, cond?.bounce ?? 1);
      ball.vz = b.vz;
      ball.vel.x *= b.keep; ball.vel.y *= b.keep;
      if (Math.abs(ball.spin) > 0.0001) {
        const sp = Math.hypot(ball.vel.x, ball.vel.y);
        if (sp > 0.01) {
          const a = ball.spin * BOUNCE_SIDESPIN_TURN;
          const cos = Math.cos(a), sin = Math.sin(a);
          const vx = ball.vel.x, vy = ball.vel.y;
          ball.vel.x = vx * cos - vy * sin;
          ball.vel.y = vx * sin + vy * cos;
        }
      }
      ball.spin *= BOUNCE_SPIN_KEEP;
      // The grass rolls it on: after a bounce it carries forward spin.
      ball.topspin = b.top;
      bounced = true;
    } else {
      ball.vz = 0;
    }
  }
  if (ball.z <= 0.03 && !bounced && ball.vz <= 0.01) {
    const s = Math.hypot(ball.vel.x, ball.vel.y);
    const drop = rollDrop(s, cond?.friction ?? 1, dragMul, dt);
    if (s <= drop) {
      ball.vel.x = 0; ball.vel.y = 0;
      ball.resting = true;
    } else {
      const f = (s - drop) / s;
      ball.vel.x *= f; ball.vel.y *= f;
    }
  }
  return bounced;
}

/**
 * The same ball, cosmetic: after the whistle (settling, cleared). No curl.
 */
export function coastBallReal(ball: Ball, cond: Cond, dt: number): void {
  const spin = ball.spin;
  ball.spin = 0;
  integrateBallReal(ball, cond, dt);
  ball.spin = spin;
}

// ── The woodwork ─────────────────────────────────────────────────────────────

/** Earliest fraction f∈[0,1] along a→b where |p − c| = R, or null. 2-D. */
function sweepCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, R: number): number | null {
  const dx = bx - ax, dy = by - ay;
  const fx = ax - cx, fy = ay - cy;
  const A = dx * dx + dy * dy;
  const C = fx * fx + fy * fy - R * R;
  // Already touching at the start: a hit only if it is still moving in (never
  // after a bounce has sent it away — that is how a ball gets stuck in a post).
  if (C <= 0) return fx * dx + fy * dy < 0 ? 0 : null;
  if (A < 1e-12) return null;
  const B = 2 * (fx * dx + fy * dy);
  const disc = B * B - 4 * A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  return t >= 0 && t <= 1 ? t : null;
}

export interface FrameHit {
  /** Which piece: a post (with its centre x) or the bar. */
  part: "postL" | "postR" | "bar";
  /** Fraction of this step at which it touched. */
  f: number;
  /** Unit normal from the frame to the ball, in (x, y, z). */
  nx: number; ny: number; nz: number;
}

/**
 * Did the ball touch a post or the bar between `prev` and now? The posts are
 * upright cylinders at the goal line (y = 0), the bar a cylinder along x at
 * BAR_CZ. Returns the first contact this step, or null.
 */
export function frameContact(
  prevX: number, prevY: number, prevZ: number,
  x: number, y: number, z: number,
  goal: { x1: number; x2: number } = { x1: POST_L, x2: POST_R },
  crossbar: number = GOAL_H,
): FrameHit | null {
  // Quick reject: nowhere near the goal line this step.
  if (Math.min(prevY, y) > POST_HIT_R + 0.05 || Math.max(prevY, y) < -POST_HIT_R - 0.05) return null;
  const pl = goal.x1 - POST_RADIUS, pr = goal.x2 + POST_RADIUS, barZ = crossbar + POST_RADIUS;
  let best: FrameHit | null = null;
  for (const [part, cx] of [["postL", pl], ["postR", pr]] as const) {
    const f = sweepCircle(prevX, prevY, x, y, cx, 0, POST_HIT_R);
    if (f === null) continue;
    const hz = prevZ + (z - prevZ) * f;
    if (hz < 0 || hz > barZ) continue;      // under the turf or over the top of the post
    if (!best || f < best.f) {
      const hx = prevX + (x - prevX) * f, hy = prevY + (y - prevY) * f;
      const L = Math.hypot(hx - cx, hy) || 1;
      best = { part, f, nx: (hx - cx) / L, ny: hy / L, nz: 0 };
    }
  }
  {
    const f = sweepCircle(prevY, prevZ, y, z, 0, barZ, POST_HIT_R);
    if (f !== null) {
      const hx = prevX + (x - prevX) * f;
      if (hx >= pl && hx <= pr && (!best || f < best.f)) {
        const hy = prevY + (y - prevY) * f, hz = prevZ + (z - prevZ) * f;
        const L = Math.hypot(hy, hz - barZ) || 1;
        best = { part: "bar", f, nx: 0, ny: hy / L, nz: (hz - barZ) / L };
      }
    }
  }
  return best;
}

/**
 * Bounce the ball off the frame at the real angle: the speed into the post or
 * bar is reversed (×FRAME_E), the speed along it mostly kept. Puts the ball
 * where it touched, just clear of the frame. Returns true if it is now heading
 * into the goal (in off the woodwork).
 */
export function bounceOffFrame(
  ball: Ball,
  prevX: number, prevY: number, prevZ: number,
  hit: FrameHit,
  goal: { x1: number; x2: number } = { x1: POST_L, x2: POST_R },
): boolean {
  const { f, nx, ny, nz } = hit;
  const vx = ball.vel.x, vy = ball.vel.y, vz = ball.vz;
  const vn = vx * nx + vy * ny + vz * nz;
  if (vn < 0) {
    const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
    ball.vel.x = tx * FRAME_TANGENT_KEEP - FRAME_E * vn * nx;
    ball.vel.y = ty * FRAME_TANGENT_KEEP - FRAME_E * vn * ny;
    ball.vz = tz * FRAME_TANGENT_KEEP - FRAME_E * vn * nz;
  }
  // At the contact point, nudged 1 cm off the surface.
  const hx = prevX + (ball.pos.x - prevX) * f;
  const hy = prevY + (ball.pos.y - prevY) * f;
  const hz = prevZ + (ball.z - prevZ) * f;
  ball.pos.x = hx + nx * 0.01;
  ball.pos.y = hy + ny * 0.01;
  ball.z = Math.max(0, hz + nz * 0.01);
  ball.spin *= 0.25;
  // Heading in: going towards the net, and between the posts.
  const t = ball.vel.y < -0.2 ? ball.pos.y / -ball.vel.y : Infinity;
  const xAt = ball.pos.x + ball.vel.x * Math.min(t, 1);
  return ball.vel.y < -0.2 && xAt > goal.x1 && xAt < goal.x2;
}

/**
 * AIMING A STRIKE THROUGH REAL AIR.
 *
 * The engine's own team-mates solve their chips, headers and lofted passes in
 * closed form, as if there were no air (z = vz·t − ½gt²). Through real air the
 * same strike arrives later and lower: a 12 m/s chip is in the slow, high-drag
 * half of the drag crisis. So when the New ball is on, the solved strike is
 * corrected: the speed and lift that make the REAL ball reach the same spot,
 * at the same time and the same height, the vacuum solve was aiming for.
 * A few rounds of fire-and-correct; returns the input unchanged when Old.
 */
export function dragCompensate(sh: number, vz: number, dist: number, z0 = 0.08): { sh: number; vz: number } {
  if (!realOn || dist < 0.5 || sh < 0.5) return { sh, vz };
  const tWant = dist / sh;
  const zWant = z0 + vz * tWant - 0.5 * G_REAL * tWant * tWant;
  let s1 = sh, v1 = vz;
  const dt = 1 / 180;
  for (let it = 0; it < 6; it++) {
    let x = 0, z = z0, vx = s1, vzz = v1, t = 0;
    while (x < dist && t < 6) {
      const k = airDragFactor(vx, 0, vzz, 1, dt);
      vx *= k; vzz *= k;
      vzz -= G_REAL * dt;
      x += vx * dt; z += vzz * dt; t += dt;
    }
    if (t >= 6) break;
    const over = (x - dist) / Math.max(vx, 0.1);   // back to exactly dist
    const tAt = t - over, zAt = z - vzz * over;
    s1 *= tAt / tWant;
    v1 += (zWant - zAt) / tWant;
    if (Math.abs(tAt - tWant) < 1e-3 && Math.abs(zAt - zWant) < 0.01) break;
  }
  return { sh: s1, vz: v1 };
}
