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
import { speedOf, stepMover, timeToReach, towards, type P3 } from "./player";
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
      const called = typeof m.call === "number" && w.t - (m.call as number) < 1.5;
      if (shouldShoot(w, p) && held > 0.25 && !called) { aiShoot(w, p); m.has = undefined; return; }
      if (you && you.active && (held > (m.hold as number) || called)) { w.passBall(p, you); m.has = undefined; m.call = undefined; return; }
      stepMover(p, towards(p, CX + (p.x - CX) * 0.7, Math.max(9, b.y - 6), 2), false, dt);
      return;
    }
    m.has = undefined;
    if (w.passTarget === p.id || (!w.owner && w.passTarget === null && chase(w, p, 0.15))) {
      const i = w.intercept(p);
      if (i) { stepMover(p, towards(p, i.x, i.y, 0.6), true, dt); return; }
    }
    // into space: a channel either side of you, a little ahead (towards goal)
    const lane = (m.lane as number) ?? 1;
    const ref = you ?? p;
    const tx = clamp(ref.x + lane * 11, 6, 62), ty = clamp(ref.y - 5 + lane * 2, 7, 40);
    const d = Math.hypot(tx - p.x, ty - p.y);
    stepMover(p, d > 1 ? towards(p, tx, ty, 3) : { x: 0, y: 0 }, d > 8, dt, face(p, b.x, b.y));
  },

  striker(w, p, dt) {
    const b = w.ball;
    const o = w.get(w.owner);
    if (o === p) {
      if (shouldShoot(w, p)) { aiShoot(w, p); return; }
      // dribble at goal, bending away from the nearest man in front
      let tx = CX + (b.x - CX) * 0.5, ty = 7;
      let near: P3 | null = null, nd = 5;
      for (const q of w.players) {
        if (!q.active || q === p || q.keeper || !w.hostile(p, q)) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < nd && q.y < p.y + 0.5) { nd = d; near = q; }
      }
      if (near) { const side = near.x > p.x ? -1 : 1; tx = p.x + side * 6; ty = p.y - 4; }
      const fast = skill01(p.skills.dribbling ?? p.skills.technique) > 0.7 || !near;
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
      const gx = b.x + (CX - b.x) * 0.08, gy = b.y - 0.6;
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
    if (w.ball.z < 0.6 && shouldShoot(w, p) && w.rng() < 0.35) { aiShoot(w, p); return true; }
    return false;
  },
};

