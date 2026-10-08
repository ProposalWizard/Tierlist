/**
 * PLAY3D PEOPLE — one shape for everyone on a 3D pitch (you, team-mates,
 * opponents, the keeper), and how they move. Pure.
 *
 * Movement: walk/jog/sprint with real acceleration and a turn rate that
 * drops as he speeds up, so a sprinting man runs wide round a turn.
 */
import { DECEL, JOG_SPEED, TURN_SPRINT, TURN_STAND, accel, clamp, sprintSpeed } from "./constants";

export interface Skills3 {
  overall: number;
  pace: number;
  power: number;
  technique: number;
  /** The six-stat wheel where known (the career's SquadPlayer fields); else overall. */
  passing?: number;
  shooting?: number;
  dribbling?: number;
  defending?: number;
}

/** What the renderer should show him doing (it picks the clip). */
export type Act3 =
  | "none" | "touch" | "pass" | "loft" | "shot" | "volley" | "header"
  | "juggle-foot" | "juggle-thigh" | "juggle-head" | "tackle" | "dive" | "throw" | "catch" | "celebrate" | "miss"
  /** Head down, hands on head (knocked out, a miss that hurt). */
  | "slump";

export interface P3 {
  id: string;
  name: string;
  /** Side: 0 = yours. In a free-for-all every man has his own. */
  team: number;
  human: boolean;
  /** Off the pitch (a scorer stepping off in Wembley, a man knocked out). Not stepped, never touches the ball. */
  active: boolean;
  /**
   * Off the pitch but still in the picture (standing by the post, walking
   * off). Only means something while `active` is false: the World never
   * steps him and he never touches the ball; a drill walks him itself
   * (stepMover) and the picture keeps drawing him.
   */
  sideline?: boolean;
  keeper: boolean;
  x: number; y: number;
  vx: number; vy: number;
  /** Which way he faces, radians in the pitch plane (0 = +x, −π/2 = towards the goal at y = 0). */
  facing: number;
  skills: Skills3;
  /** Seconds before he may touch the ball again (just touched it, or just lost a tackle). */
  cooldown: number;
  /** Last action and how long ago (the renderer plays it once). */
  act: Act3;
  actT: number;
  /** A brain's own scratch state. */
  mind: Record<string, number | string | boolean | undefined>;
  /** A keeper's dive: lateral reach used (−1..1) and height 0..1, for the renderer. */
  dive?: { side: number; up: number; t: number };
  photo?: string;
}

export function makePlayer(o: Partial<P3> & { id: string; x: number; y: number; skills: Skills3 }): P3 {
  return {
    name: o.id, team: 0, human: false, active: true, keeper: false,
    vx: 0, vy: 0, facing: -Math.PI / 2, cooldown: 0, act: "none", actT: 9, mind: {},
    ...o,
  };
}

/** A made-up man of this overall, his other numbers around it. */
export function skillsOf(overall: number, extra: Partial<Skills3> = {}): Skills3 {
  const o = clamp(overall, 30, 99);
  return { overall: o, pace: o, power: o, technique: o, ...extra };
}

export const speedOf = (p: P3) => Math.hypot(p.vx, p.vy);

/** Shortest signed angle from a to b. */
export function angDiff(a: number, b: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Move a man one step. `want` is where he wants to go as a vector whose
 * length (0..1) is how hard he pushes the stick; `sprint` lets him go flat out.
 * `face` (optional) turns him to a heading while standing (a keeper squaring up).
 */
export function stepMover(p: P3, want: { x: number; y: number }, sprint: boolean, dt: number, face?: number) {
  const mag = Math.min(1, Math.hypot(want.x, want.y));
  const top = (sprint ? sprintSpeed(p.skills.pace) : JOG_SPEED) * mag;
  const sp = speedOf(p);
  // turning: limited by how fast he is going
  if (mag > 0.05) {
    const target = Math.atan2(want.y, want.x);
    const rate = TURN_STAND + (TURN_SPRINT - TURN_STAND) * Math.min(1, sp / 8);
    const d = angDiff(p.facing, target);
    p.facing += clamp(d, -rate * dt, rate * dt);
  } else if (face !== undefined) {
    const d = angDiff(p.facing, face);
    p.facing += clamp(d, -TURN_STAND * dt, TURN_STAND * dt);
  }
  // speed along the way he now faces (a man can't run sideways at full pelt)
  const along = mag > 0.05 ? Math.max(0, Math.cos(angDiff(p.facing, Math.atan2(want.y, want.x)))) : 0;
  const goal = top * along;
  const next = sp < goal ? Math.min(goal, sp + accel(p.skills.pace) * dt) : Math.max(goal, sp - DECEL * dt);
  p.vx = Math.cos(p.facing) * next;
  p.vy = Math.sin(p.facing) * next;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt);
  p.actT += dt;
}

/** Push towards a point: a want-vector at full stick, eased off over the last `ease` metres. */
export function towards(p: P3, x: number, y: number, ease = 1.5): { x: number; y: number } {
  const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
  if (d < 0.05) return { x: 0, y: 0 };
  const k = Math.min(1, d / ease);
  return { x: dx / d * k, y: dy / d * k };
}

/** How long he needs to run to a point (rough: turn, then accelerate to sprint). */
export function timeToReach(p: P3, x: number, y: number): number {
  const d = Math.hypot(x - p.x, y - p.y);
  const top = sprintSpeed(p.skills.pace);
  const a = accel(p.skills.pace);
  const v0 = speedOf(p);
  const turn = Math.abs(angDiff(p.facing, Math.atan2(y - p.y, x - p.x))) / TURN_STAND;
  const tAcc = (top - v0) / a, dAcc = v0 * tAcc + 0.5 * a * tAcc * tAcc;
  const run = d <= dAcc ? (-v0 + Math.sqrt(v0 * v0 + 2 * a * d)) / a : tAcc + (d - dAcc) / top;
  return turn + run;
}
