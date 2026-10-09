/**
 * PLAY3D KEEPER — for any 3D drill that wants one. Pure.
 *
 * Ideas from the 2D keeper (he does not know where you aimed: he sees the
 * ball leave the foot, reacts after a delay, then dives at his own speed and
 * reach) but the logic lives here, in 3D, never in canvasEngine.ts.
 *
 * His rating (overall) sets reaction, dive speed, reach and how often he
 * holds rather than parries.
 *
 * THE RULE (Harry, 9 Oct 2026: "the goalie is infinitely diving"): he dives
 * only for a real shot (a strike the World counted: never a pass, a cross or
 * a ball you are running with), only if it is on target, and only once per
 * shot. A shot at him he gets his body behind instead of diving. After a dive
 * he lies a beat, gets up, and side-steps back to his spot, square to the ball.
 *
 * The old bug: any ball rolling at the goal faster than 5 m/s counted as a
 * shot. Sprinting with the ball knocks it ahead at 7-9 m/s, so he dived 0.46 s
 * after kick-off and again every 1.6 s while you ran at him.
 */
import { BALL_R, CX, GOAL_H, POST_L, POST_R, clamp, skill01 } from "./constants";
import type { Ball3 } from "./ball";
import { stepMover, towards, type P3 } from "./player";
import { gauss, type Rng } from "./rng";

export type KeeperEvent = "save" | "catch" | "claim" | null;

/** How far outside a post (m) and above the bar a shot can be and still make him dive (a near miss he can't be sure of). */
export const DIVE_MARGIN_X = 0.3;
export const DIVE_MARGIN_Z = 0.3;
/** A shot this close to him sideways (m) he gets his body behind: no dive. */
export const BLOCK_X = 0.75;
/** He comes off his line for a ball on the grass this close to goal (y, m), this central, and this near him. */
export const RUSH_Y = 7, RUSH_X = 9, RUSH_R = 4.5;
/** A shot reaching him in under READ_TIME s is read worse, up to READ_RUSH m more error (a close-range strike is half a guess). */
export const READ_TIME = 0.75, READ_RUSH = 0.7;
/**
 * How good he is (Harry, 9 Oct 2026: "why is the goalie unstoppable in free roam").
 * The old numbers (react 0.24 s, read error 0.35 m, reach 1.1 + 1.6, dive 4.5 + 3.5 m/s,
 * grab 0.42 + 0.22) let him cover the whole goal: 86–100% of on-target shots saved,
 * corners included. Real keepers move about 3–5 m/s across the goal and save roughly
 * 70% of on-target shots, far fewer into the corners. tests/star/play3dKeeperRate.mts pins it.
 */
export const KEEPER_REACT = 0.3, KEEPER_READ_ERR = 0.55;
export const KEEPER_REACH = 0.7, KEEPER_REACH_SKILL = 1.0;
export const KEEPER_DIVE_SPEED = 3.2, KEEPER_DIVE_SKILL = 1.8;
export const KEEPER_GRAB = 0.34;
/**
 * A strike from close in (under CLOSE_RANGE m from him: a header or volley off a
 * cross, a first-time finish in the box). He has watched the cross come in and is
 * set, low and expecting it, so he goes on reflex: a quicker start (CLOSE_REACT
 * instead of KEEPER_REACT), an explosive spring across (CLOSE_SPRING m/s more dive
 * speed) and a full star-jump spread (CLOSE_REACH m more sideways). Spring and
 * spread scale with his rating (x1.0 at 60, x1.2 at 80). Full effect at CLOSE_FULL m
 * and nearer, none at CLOSE_RANGE. Free Roam's shots from 12 m (10.8 m+ from him)
 * and further are untouched (play3dKeeperRate.mts).
 * Without it, Headers & Volleys went from 3.1 to 5.7 goals per 10 against a
 * 60 keeper when the keeper above was made beatable (9 Oct 2026).
 */
export const CLOSE_RANGE = 10.5, CLOSE_FULL = 7.5;
export const CLOSE_REACT = 0.1, CLOSE_SPRING = 4, CLOSE_REACH = 0.9;

/** Where he stands: on the line from goal centre to the ball, a little off his line. */
export function keeperSpot(b: Ball3): { x: number; y: number } {
  const dx = b.x - CX, dy = Math.max(1, b.y);
  const d = Math.hypot(dx, dy);
  const off = clamp(d * 0.1, 0.6, 2.2);
  return { x: clamp(CX + dx / d * off, POST_L + 0.4, POST_R - 0.4), y: Math.max(0.5, dy / d * off) };
}

/** Where a ball in flight crosses his line (y = k.y), and when. null if it is not coming at him. */
export function shotLine(k: P3, b: Ball3): { x: number; z: number; t: number } | null {
  if (b.vy > -4 || b.y <= k.y - 0.2 || b.inNet) return null;
  const t = (b.y - k.y) / -b.vy;
  if (t > 3) return null;
  return { x: b.x + b.vx * t, z: b.z + b.vz * t - 4.9 * t * t, t };
}

/** Would this shot go in if nobody touched it (inside the posts, under the bar, with the margins above)? */
export function onTarget(line: { x: number; z: number }): boolean {
  return line.x > POST_L - DIVE_MARGIN_X && line.x < POST_R + DIVE_MARGIN_X && line.z < GOAL_H + DIVE_MARGIN_Z;
}

/**
 * One step. `holding` = he has it. `shot` = the number of the strike in
 * flight (World.shotSeq while World.shotBy is set), 0 when there is none.
 */
export function stepKeeper3d(k: P3, b: Ball3, dt: number, rng: Rng, holding: boolean, shot = 0, rushOk = true): KeeperEvent {
  const r = skill01(k.skills.overall);
  const m = k.mind;
  if (holding) {
    stepMover(k, { x: 0, y: 0 }, false, dt, Math.atan2(b.y - k.y, b.x - k.x));
    k.dive = undefined;
    m.mode = "set";
    return null;
  }
  // a shot: he reads it once, as it leaves the foot
  if (shot > 0 && m.shot !== shot && (m.mode === "set" || m.mode === undefined)) {
    const line = shotLine(k, b);
    m.shot = shot; // one read per shot: wide now is wide later
    if (line && onTarget(line)) {
      // how close in the strike is (0 = 10 m+ away, 1 = 7 m or nearer): a reflex save
      const close = clamp((CLOSE_RANGE - Math.hypot(b.x - k.x, b.y - k.y)) / (CLOSE_RANGE - CLOSE_FULL), 0, 1);
      m.close = close;
      m.react = KEEPER_REACT + (CLOSE_REACT - KEEPER_REACT) * close - r * 0.1 + Math.abs(gauss(rng)) * 0.05;
      // his read: worse the less time he has (a close-range header or volley is a guess)
      const rush = clamp(1 - line.t / READ_TIME, 0, 1);
      m.tx = clamp(line.x + gauss(rng) * (KEEPER_READ_ERR - r * 0.25 + rush * READ_RUSH), POST_L - 0.6, POST_R + 0.6);
      m.tz = clamp(line.z, 0.2, GOAL_H + 0.2);
      m.x0 = k.x; m.dt = 0;
      // a ball coming straight at him he reads well (it doesn't move across his eyes): block it standing
      if (Math.abs(line.x - k.x) < BLOCK_X && (m.tz as number) < 1.9) { m.mode = "block"; m.tx = line.x + gauss(rng) * 0.1; }
      else m.mode = Math.abs((m.tx as number) - k.x) < BLOCK_X && (m.tz as number) < 1.9 ? "block" : "dive";
    }
  }
  if (m.mode === "block") {
    // straight at him: across a step, body behind it, hands to it
    m.dt = (m.dt as number) + dt;
    const tx = m.tx as number, tz = m.tz as number;
    shuffle(k, (m.dt as number) > (m.react as number) ? tx : k.x, k.y, 3.2 + r * 1.5, dt, b);
    const hz = clamp(tz, 0.3, 1.9);
    const dHands = Math.hypot(b.x - k.x, b.y - k.y, b.z - hz);
    const dBody = Math.hypot(b.x - k.x, b.y - k.y, Math.max(0, b.z - 1.8));
    const grab = 0.42 + r * 0.22;
    if (b.vy < 0 && (dHands < grab || dBody < 0.42)) return meetBall(k, b, rng, r, dHands < grab * 0.8, Math.sign(b.vx) || 1);
    if (b.y < k.y - 0.6 || b.vy >= 0 || (m.dt as number) > 2) m.mode = "set";
    return null;
  }
  if (m.mode === "dive") {
    m.dt = (m.dt as number) + dt;
    const react = m.react as number;
    if ((m.dt as number) < react) {
      shuffle(k, k.x, k.y, 0, dt, b);
    } else {
      const tx = m.tx as number, tz = m.tz as number, x0 = m.x0 as number;
      const side = Math.sign(tx - x0) || 1;
      const reach = KEEPER_REACH + r * KEEPER_REACH_SKILL + ((m.close as number) ?? 0) * CLOSE_REACH * (0.4 + r); // how far his body can go sideways
      const speed = KEEPER_DIVE_SPEED + r * KEEPER_DIVE_SKILL + ((m.close as number) ?? 0) * CLOSE_SPRING * (0.4 + r); // m/s across his goal
      const wantX = clamp(tx - side * 0.75, x0 - reach, x0 + reach);
      const step = clamp(wantX - k.x, -speed * dt, speed * dt);
      k.x += step;
      k.vx = 0; k.vy = 0;
      const prog = clamp(((m.dt as number) - react) / 0.35, 0, 1);
      k.dive = { side, up: clamp((tz - 0.4) / 2, 0, 1), t: prog };
      k.act = "dive";
      // his hands and body
      // high AND wide is the hardest save: a full stretch can't also go all the way up
      const stretch = clamp(Math.abs(wantX - x0) / Math.max(0.1, reach), 0, 1);
      const topZ = 2.45 - stretch * (0.55 - r * 0.25);
      const hx = k.x + side * 0.8 * prog, hz = 0.6 + (Math.min(tz, topZ) - 0.6) * prog;
      const dHands = Math.hypot(b.x - hx, b.y - k.y, b.z - hz);
      const dBody = Math.hypot(b.x - k.x, b.y - k.y, Math.max(0, b.z - 1.8));
      const grab = KEEPER_GRAB + r * 0.16;
      if (b.vy < 0 && (dHands < grab || dBody < 0.42)) return meetBall(k, b, rng, r, dHands < grab * 0.8, side);
      if ((m.dt as number) > react + 1.4 || (prog >= 1 && b.y < k.y - 1)) { m.mode = "down"; m.dt = 0; }
    }
    return null;
  }
  if (m.mode === "down") {
    // on the floor a beat, then up
    m.dt = (m.dt as number) + dt;
    k.vx = 0; k.vy = 0;
    if ((m.dt as number) > 0.8) { m.mode = "set"; k.dive = undefined; }
    return null;
  }
  // set: take up his spot, face the ball, claim anything loose and slow near him
  m.mode = "set";
  k.dive = undefined;
  const near = Math.hypot(b.x - k.x, b.y - k.y);
  const bs = Math.hypot(b.vx, b.vy);
  // a loose ball on the grass (nobody on it, no pass or shot), close to him, near his goal: he comes out and smothers it
  const rush = rushOk && b.z < 0.6 && b.y < RUSH_Y && Math.abs(b.x - CX) < RUSH_X && near < RUSH_R && bs < 12 && k.cooldown <= 0;
  const s = rush ? { x: b.x + b.vx * 0.15, y: Math.max(0.4, b.y + b.vy * 0.15) } : keeperSpot(b);
  if (rush || Math.hypot(s.x - k.x, s.y - k.y) > 3) stepMover(k, towards(k, s.x, s.y, 0.3), true, dt, Math.atan2(b.y - k.y, b.x - k.x));
  else shuffle(k, s.x, s.y, 2.6 + r * 1.2, dt, b);
  if (near < 1.1 + (rush ? 0.15 + r * 0.25 : 0) && b.z < 2.3 && bs < (rush ? 12 : 9) && k.cooldown <= 0 && b.z >= BALL_R - 1e-6) {
    k.act = "catch"; k.actT = 0;
    return "claim";
  }
  return null;
}

/**
 * A keeper's side-step: towards a point at up to `speed` m/s without turning
 * his back, square to the ball (stepMover would turn him to walk there).
 * Small steps show as the ready shuffle.
 */
function shuffle(k: P3, x: number, y: number, speed: number, dt: number, b: Ball3) {
  const dx = x - k.x, dy = y - k.y, d = Math.hypot(dx, dy);
  const v = Math.min(speed, d / Math.max(dt, 0.15));
  const tvx = d > 1e-6 ? dx / d * v : 0, tvy = d > 1e-6 ? dy / d * v : 0;
  const ease = Math.min(1, 14 * dt);
  k.vx += (tvx - k.vx) * ease; k.vy += (tvy - k.vy) * ease;
  k.x += k.vx * dt; k.y += k.vy * dt;
  let df = Math.atan2(b.y - k.y, b.x - k.x) - k.facing;
  while (df > Math.PI) df -= 2 * Math.PI;
  while (df < -Math.PI) df += 2 * Math.PI;
  k.facing += clamp(df, -8 * dt, 8 * dt);
  if (k.cooldown > 0) k.cooldown = Math.max(0, k.cooldown - dt);
  k.actT += dt;
}

/** He gets to it: hold it (slow enough, clean hands, his rating) or parry it away to the side. */
function meetBall(k: P3, b: Ball3, rng: Rng, r: number, clean: boolean, side: number): KeeperEvent {
  const m = k.mind;
  const sp = Math.hypot(b.vx, b.vy, b.vz);
  const hold = clean && sp < 12 + r * 12 && rng() < 0.4 + r * 0.5;
  const dived = !!k.dive;
  m.mode = dived ? "down" : "set"; m.dt = 0;
  if (hold) { k.act = "catch"; k.actT = 0; return "catch"; }
  b.vy = Math.abs(b.vy) * (0.25 + rng() * 0.2);
  b.vx = b.vx * 0.3 + side * (2 + rng() * 4);
  b.vz = 1.5 + rng() * 2.5;
  b.spin = 0;
  k.cooldown = 0.5;
  k.act = dived ? "dive" : "catch"; k.actT = 0;
  return "save";
}
