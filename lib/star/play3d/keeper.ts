/**
 * PLAY3D KEEPER — for any 3D drill that wants one. Pure.
 *
 * Ideas from the 2D keeper (he does not know where you aimed: he sees the
 * ball leave the foot, reacts after a delay, then dives at his own speed and
 * reach) but the logic lives here, in 3D, never in canvasEngine.ts.
 *
 * His rating (overall) sets reaction, dive speed, reach and how often he
 * holds rather than parries.
 */
import { BALL_R, CX, GOAL_H, POST_L, POST_R, clamp, skill01 } from "./constants";
import type { Ball3 } from "./ball";
import { stepMover, towards, type P3 } from "./player";
import { gauss, type Rng } from "./rng";

export type KeeperEvent = "save" | "catch" | "claim" | null;

/** Where he stands: on the line from goal centre to the ball, a little off his line. */
export function keeperSpot(b: Ball3): { x: number; y: number } {
  const dx = b.x - CX, dy = Math.max(1, b.y);
  const d = Math.hypot(dx, dy);
  const off = clamp(d * 0.1, 0.6, 2.2);
  return { x: clamp(CX + dx / d * off, POST_L + 0.4, POST_R - 0.4), y: Math.max(0.5, dy / d * off) };
}

/**
 * One step. `holding` = he has it. `shot` = a strike towards goal is live (the
 * World says so when someone shoots). Returns what he did to the ball.
 */
export function stepKeeper3d(k: P3, b: Ball3, dt: number, rng: Rng, holding: boolean): KeeperEvent {
  const r = skill01(k.skills.overall);
  const m = k.mind;
  if (holding) {
    stepMover(k, { x: 0, y: 0 }, false, dt, Math.atan2(b.y - k.y, b.x - k.x));
    k.dive = undefined;
    m.mode = "set";
    return null;
  }
  // a shot coming? ball travelling at the goal, fast, still in front of him
  const coming = b.vy < -5 && b.y > k.y - 0.2 && !b.inNet;
  if (m.mode !== "dive" && coming) {
    const t = (b.y - k.y) / -b.vy;
    const cx = b.x + b.vx * t, cz = b.z + b.vz * t - 4.9 * t * t;
    if (cx > POST_L - 1.2 && cx < POST_R + 1.2 && cz < GOAL_H + 0.8) {
      m.mode = "dive";
      m.react = 0.24 - r * 0.12 + Math.abs(gauss(rng)) * 0.04;
      m.tx = cx + gauss(rng) * (0.35 - r * 0.25);
      m.tz = clamp(cz, 0.2, GOAL_H + 0.2);
      m.x0 = k.x; m.dt = 0;
    }
  }
  if (m.mode === "dive") {
    m.dt = (m.dt as number) + dt;
    const react = m.react as number;
    if ((m.dt as number) < react) {
      stepMover(k, { x: 0, y: 0 }, false, dt, -Math.PI / 2 + Math.PI);
    } else {
      const tx = m.tx as number, tz = m.tz as number, x0 = m.x0 as number;
      const side = Math.sign(tx - x0) || 1;
      const reach = 1.1 + r * 1.6; // how far his body can go sideways
      const speed = 4.5 + r * 3.5;
      const wantX = clamp(tx - side * 0.75, x0 - reach, x0 + reach);
      const step = clamp(wantX - k.x, -speed * dt, speed * dt);
      k.x += step;
      const prog = clamp(((m.dt as number) - react) / 0.35, 0, 1);
      k.dive = { side, up: clamp((tz - 0.4) / 2, 0, 1), t: prog };
      k.act = "dive";
      // his hands and body
      const hx = k.x + side * 0.8 * prog, hz = 0.6 + (tz - 0.6) * prog;
      const dHands = Math.hypot(b.x - hx, b.y - k.y, b.z - hz);
      const dBody = Math.hypot(b.x - k.x, b.y - k.y, Math.max(0, b.z - 1.8));
      const grab = 0.42 + r * 0.22;
      if (b.vy < 0 && (dHands < grab || dBody < 0.42)) {
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        const hold = sp < 12 + r * 12 && dHands < grab * 0.8 && rng() < 0.4 + r * 0.5;
        m.mode = "down"; m.dt = 0;
        if (hold) { k.act = "catch"; k.actT = 0; return "catch"; }
        b.vy = Math.abs(b.vy) * (0.25 + rng() * 0.2);
        b.vx = b.vx * 0.3 + side * (2 + rng() * 4);
        b.vz = 1.5 + rng() * 2.5;
        b.spin = 0;
        k.act = "dive"; k.actT = 0;
        return "save";
      }
      if ((m.dt as number) > react + 1.4) { m.mode = "down"; m.dt = 0; }
    }
    return null;
  }
  if (m.mode === "down") {
    m.dt = (m.dt as number) + dt;
    if ((m.dt as number) > 0.8) { m.mode = "set"; k.dive = undefined; }
    return null;
  }
  // set: take up his spot, face the ball, claim anything loose and slow near him
  const s = keeperSpot(b);
  stepMover(k, towards(k, s.x, s.y, 1), Math.hypot(s.x - k.x, s.y - k.y) > 3, dt, Math.atan2(b.y - k.y, b.x - k.x));
  const near = Math.hypot(b.x - k.x, b.y - k.y);
  if (near < 1.1 && b.z < 2.3 && Math.hypot(b.vx, b.vy) < 9 && k.cooldown <= 0 && b.z >= BALL_R - 1e-6) {
    k.act = "catch"; k.actT = 0;
    return "claim";
  }
  return null;
}
