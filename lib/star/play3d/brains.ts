/**
 * PLAY3D BRAINS — how an AI man decides, on the same World and the same
 * touches as you. A man's brain is `p.mind.brain` (a key below). A drill can
 * also move a man itself (Rules.brain) — Two Touch does.
 *
 *   idle      stands, faces the ball
 *   support   a free-roam team-mate: moves into space, takes a pass, gives it
 *             back to you (ahead of you), shoots if he's clean through
 *   striker   a free-for-all attacker (Wembley): chases a loose ball if he can
 *             get there first, dribbles at goal round men, shoots when it's
 *             on, closes down and pokes at whoever has it
 */
import { CX, POST_L, POST_R, clamp, skill01, type Contact3 } from "./constants";
import { cruiseSpeed, speedOf, stepMover, timeToReach, topSpeed, towards, type P3 } from "./player";
import type { World } from "./world";

export type Brain = (w: World, p: P3, dt: number) => void;

const face = (p: P3, x: number, y: number) => Math.atan2(y - p.y, x - p.x);
const distGoal = (x: number, y: number) => Math.hypot(x - CX, y);

/** Is this a shot worth taking from where he is? */
export function shouldShoot(w: World, p: P3): boolean {
  const b = w.ball;
  const d = distGoal(b.x, b.y);
  if (b.y < 2) return false;
  // the angle: how much of the goal mouth he can see
  const open = Math.abs(Math.atan2(POST_R - b.x, b.y) - Math.atan2(POST_L - b.x, b.y));
  if (d < 11 && open > 0.25) return true;
  const pressed = w.players.some((q) => q.active && q !== p && !q.keeper && w.hostile(p, q) && Math.hypot(q.x - p.x, q.y - p.y) < 2.2);
  const range = 16 + skill01(p.skills.shooting ?? p.skills.overall) * 8;
  return open > 0.3 && (d < range * 0.75 || (pressed && d < range));
}

/** An AI strike at the corner away from the keeper, as hard as the distance asks. */
export function aiShoot(w: World, p: P3) {
  const b = w.ball;
  const k = w.keeperOf();
  const far = !k ? (w.rng() < 0.5 ? -1 : 1) : k.x < CX ? 1 : -1;
  const aimX = clamp(CX + far * (2.9 + (w.rng() - 0.5) * 1.2), POST_L + 0.35, POST_R - 0.35);
  const d = distGoal(b.x, b.y);
  const power = clamp(0.5 + d / 34, 0.55, 0.97);
  // struck a touch under the middle from further out, so it rises to the goal
  const contact: Contact3 = { cx: (w.rng() - 0.5) * 0.4, cy: clamp(-0.55 + d / 45, -0.55, 0.25) };
  w.strike(p, { x: aimX - b.x, y: -b.y }, power, contact);
}

/** The drill's own shooting call if it has one (Rules.shouldShoot / Rules.shoot), else the defaults above. */
const wantsShot = (w: World, p: P3) => (w.rules.shouldShoot ? w.rules.shouldShoot(w, p) : shouldShoot(w, p));
const takeShot = (w: World, p: P3) => (w.rules.shoot ? w.rules.shoot(w, p) : aiShoot(w, p));

/** A Free Roam team-mate makes a run in behind about this often while you have the ball (s). */
export const RUN_EVERY = 3.2;

/** Send a man on a run to a point for up to `secs` (support brain). */
function startRun(w: World, p: P3, x: number, y: number, secs: number) {
  p.mind.runX = x; p.mind.runY = y; p.mind.runUntil = w.t + secs;
  w.emit({ kind: "info", who: p.id, text: "run" });
}

/**
 * A pass played into his stride: the point on the ball's coming path nearest
 * where his run already takes him (within a metre or so, low enough to take),
 * and when the ball is there. null if the pass isn't on his line.
 */
function inStride(w: World, p: P3): { x: number; y: number; t: number } | null {
  if (speedOf(p) < 2) return null;
  let best: { x: number; y: number; t: number } | null = null, bd = Infinity;
  for (const s of w.path) {
    if (s.t > 2.8) break;
    if (s.z > 1.2 || s.t < 0.15) continue;
    const d = Math.hypot(s.x - (p.x + p.vx * s.t), s.y - (p.y + p.vy * s.t));
    if (d < 1 + 0.45 * s.t && d < bd) { bd = d; best = { x: s.x, y: s.y, t: s.t }; }
  }
  return best;
}

/** The point he should run to for a loose ball, and whether he's the man to go. */
function chase(w: World, p: P3, margin: number): { x: number; y: number } | null {
  const me = w.intercept(p);
  if (!me) return null;
  let best = Infinity;
  for (const q of w.players) {
    if (!q.active || q === p || q.keeper) continue;
    if (margin < 0 && !w.hostile(p, q)) continue; // team-mates leave it to each other by margin
    const i = w.intercept(q);
    if (i) best = Math.min(best, i.t + (q.human ? 0.3 : 0));
  }
  return me.t <= best + Math.abs(margin) ? me : null;
}

export const BRAINS: Record<string, Brain> = {
  idle(w, p, dt) { stepMover(p, { x: 0, y: 0 }, false, dt, face(p, w.ball.x, w.ball.y)); },

  support(w, p, dt) {
    const b = w.ball, m = p.mind;
    const you = w.you();
    if (w.owner === p.id) {
      if (m.has === undefined) { m.has = w.t; m.hold = 0.6 + w.rng() * 0.7; }
      const held = w.t - (m.has as number);
      // you called for it (a tap, or Call for it: World.callForBall said yes)
      const called = typeof m.callUntil === "number" && w.t < (m.callUntil as number);
      if (wantsShot(w, p) && held > 0.25 && !called) { takeShot(w, p); m.has = undefined; return; }
      if (you && you.active && (held > (m.hold as number) || called)) {
        w.passBall(p, you); m.has = undefined; m.callUntil = undefined;
        // give and go: off he goes into the space ahead of him
        startRun(w, p, clamp(p.x + ((m.lane as number) ?? 1) * 3, 8, 60), clamp(p.y - 12, 7, 34), 2.4);
        return;
      }
      stepMover(p, towards(p, CX + (p.x - CX) * 0.7, Math.max(9, b.y - 6), 2), false, dt);
      return;
    }
    m.has = undefined;
    // a pass played into his stride: keep running his line and take it on the move (charging at the ball makes the touch harder)
    const meet = w.passTarget === p.id ? inStride(w, p) : null;
    if (meet) {
      // at the pace that gets him there with the ball (not flat out and past it)
      const d = Math.hypot(meet.x - p.x, meet.y - p.y), need = d / Math.max(0.2, meet.t);
      const sprint = need > cruiseSpeed(p);
      const k = Math.min(1, need / (sprint ? topSpeed(p) : cruiseSpeed(p)));
      stepMover(p, d > 0.05 ? { x: (meet.x - p.x) / d * k, y: (meet.y - p.y) / d * k } : { x: 0, y: 0 }, sprint, dt);
      return;
    }
    if (w.passTarget === p.id || (!w.owner && w.passTarget === null && chase(w, p, 0.15))) {
      const i = w.intercept(p);
      if (i) { stepMover(p, towards(p, i.x, i.y, 0.6), true, dt); return; }
    }
    // a run on: sprint to it (a give-and-go, or one in behind while you have it)
    if (typeof m.runUntil === "number" && w.t < m.runUntil) {
      const rx = m.runX as number, ry = m.runY as number;
      if (Math.hypot(rx - p.x, ry - p.y) > 0.8) { stepMover(p, towards(p, rx, ry, 1.5), true, dt); return; }
      m.runUntil = undefined;
    }
    // you have it: now and then one of the two goes in behind (never both at once)
    if (you && w.owner === you.id) {
      const lane = (m.lane as number) ?? 1;
      const other = w.players.some((q) => q !== p && q.active && !q.human && typeof q.mind.runUntil === "number" && w.t < (q.mind.runUntil as number));
      if (m.nextRun === undefined) m.nextRun = w.t + RUN_EVERY * (lane > 0 ? 0.55 : 1.1);
      if (!other && w.t > (m.nextRun as number) && you.y > 12) {
        startRun(w, p, clamp(CX + lane * (5 + w.rng() * 4), 8, 60), clamp(you.y - 11 - w.rng() * 5, 7, 30), 2.2);
        m.nextRun = w.t + RUN_EVERY * (0.8 + w.rng() * 0.6);
        return;
      }
    }
    // into space: a channel either side of you, a little ahead (towards goal)
    const lane = (m.lane as number) ?? 1;
    const ref = you ?? p;
    const tx = clamp(ref.x + lane * 9, 6, 62), ty = clamp(ref.y - 7 + lane * 1.5, 7, 40);
    const d = Math.hypot(tx - p.x, ty - p.y);
    stepMover(p, d > 1 ? towards(p, tx, ty, 3) : { x: 0, y: 0 }, d > 8, dt, face(p, b.x, b.y));
  },

  striker(w, p, dt) {
    const b = w.ball;
    const o = w.get(w.owner);
    if (o === p) {
      if (wantsShot(w, p)) { takeShot(w, p); return; }
      // dribble at goal, bending away from the nearest man in front
      let tx = CX + (b.x - CX) * 0.5, ty = 7;
      let near: P3 | null = null, nd = 5;
      for (const q of w.players) {
        if (!q.active || q === p || q.keeper || !w.hostile(p, q)) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < nd && q.y < p.y + 0.5) { nd = d; near = q; }
      }
      if (near) { const side = near.x > p.x ? -1 : 1; tx = p.x + side * 6; ty = p.y - 4; }
      // never dribble off the pitch: bend back inside a few metres from the line
      const bx = w.bounds;
      tx = clamp(tx, bx.x1 + 5, bx.x2 - 5);
      ty = clamp(ty, 4, bx.y2 - 5);
      // pinned in a corner (his target is where he stands): turn back towards the spot
      if (Math.hypot(tx - p.x, ty - p.y) < 1.5) { tx = CX; ty = 11; }
      // near a line he slows down: short touches, so he can turn back in with it
      const edge = Math.min(p.x - bx.x1, bx.x2 - p.x, bx.y2 - p.y);
      const fast = (skill01(p.skills.dribbling ?? p.skills.technique) > 0.7 || !near) && edge > 9;
      stepMover(p, towards(p, tx, ty, 2), fast, dt);
      return;
    }
    if (!o) {
      const go = chase(w, p, -0.6);
      if (go) { stepMover(p, towards(p, go.x, go.y, 0.5), true, dt); return; }
      // not first there: drop goal-side of the ball
      stepMover(p, towards(p, (b.x + CX) / 2, Math.max(4, b.y * 0.6), 2), false, dt, face(p, b.x, b.y));
      return;
    }
    if (o.keeper) {
      // the keeper has it: spread out for the throw
      const ang = (p.id.charCodeAt(p.id.length - 1) % 6) / 5 - 0.5;
      stepMover(p, towards(p, CX + ang * 30, 20 + Math.abs(ang) * 8, 2), false, dt, face(p, b.x, b.y));
      return;
    }
    if (w.hostile(p, o)) {
      // close him down: goal-side of the ball, then at it (World.tackles pokes)
      const gd = Math.hypot(CX - b.x, b.y) || 1;
      const gx = b.x + (CX - b.x) / gd * 0.6, gy = b.y - b.y / gd * 0.6;
      stepMover(p, towards(p, gx, gy, 0.3), timeToReach(p, gx, gy) > 0.6, dt);
      return;
    }
    // a team-mate has it (doubles): get in front of goal for a pass
    stepMover(p, towards(p, CX + (p.x < CX ? -6 : 6), 10, 2), speedOf(o) > 3, dt, face(p, b.x, b.y));
  },
};

/** A loose ball reached by a man with this brain: true if he did something other than control it. */
export const BRAIN_REACH: Record<string, (w: World, p: P3) => boolean> = {
  striker(w, p) {
    if (w.ball.z < 0.6 && wantsShot(w, p) && w.rng() < 0.35) { takeShot(w, p); return true; }
    return false;
  },
};

