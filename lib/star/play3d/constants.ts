/**
 * PLAY3D — THE SHARED BASICS OF EVERY FULLY 3D GAME.
 *
 * Harry (8 Oct 2026): "we will use the same rule for all 3d games so the
 * engine cant drift", and "what u have as a base is already good with the 2d
 * to 3d kicking". So this file is the ONE place the 3D games get their ball,
 * gravity, grass and kick numbers from, and every number that the 2D match
 * already has is either imported or copied here with its source named.
 *
 * Read-only towards the 2D game: nothing here changes lib/star/canvasEngine.ts.
 * The drag-to-power maths is IMPORTED from lib/star/kickInput.ts (the 2D
 * match's own drag maths as plain functions), so a finger movement buys the
 * same power in 3D as it does in a match.
 *
 * Units: pitch metres, the 2D game's frame. x across the pitch (0..68, goal
 * centre at CX = 34), y out from the goal line (goal line y = 0, the field is
 * y > 0, the net is y < 0), z up (height of the ball's CENTRE).
 */
import { BALL_R, CX, GOAL_H, GOAL_W, POST_L, POST_R, PEN_SPOT_Y, BOX_DEPTH, PITCH_W, HALF_LEN } from "../pitch";
import { powerFromPull, MIN_PULL, MIN_POWER } from "../kickInput";

export { BALL_R, CX, GOAL_H, GOAL_W, POST_L, POST_R, PEN_SPOT_Y, BOX_DEPTH, PITCH_W, HALF_LEN };
export { powerFromPull, MIN_PULL, MIN_POWER };

// ── The ball in the air and on the grass ─────────────────────────────────────
// Copied from lib/star/canvasEngine.ts's "Tunable constants" block (private
// there, so copied, not imported). Change them there first, then here.
/** canvasEngine.ts `G`. */
export const G = 9.8;
/** canvasEngine.ts `AIR_DRAG`: per-second horizontal drag while airborne. */
export const AIR_DRAG = 0.12;
/** canvasEngine.ts `GROUND_FRICTION`: m/s² rolling resistance. */
export const GROUND_FRICTION = 1.9;
/** canvasEngine.ts `BOUNCE_VZ`: vertical restitution off turf. */
export const BOUNCE_VZ = 0.7;
/** canvasEngine.ts `BOUNCE_H`: horizontal speed kept on a bounce. */
export const BOUNCE_H = 0.88;
/** canvasEngine.ts `MIN_BOUNCE_VZ`: below this it stops bouncing and rolls. */
export const MIN_BOUNCE_VZ = 0.5;
/** canvasEngine.ts `BOUNCE_SPIN_KEEP`: curl survives a bounce. */
export const BOUNCE_SPIN_KEEP = 0.82;
/** canvasEngine.ts `BOUNCE_TOPSPIN_VZ` / `BOUNCE_TOPSPIN_H`. */
export const BOUNCE_TOPSPIN_VZ = 0.18;
export const BOUNCE_TOPSPIN_H = 0.1;
/** canvasEngine.ts `CURL_K`: Magnus-ish bend, perpendicular to travel. */
export const CURL_K = 0.48;

// ── The goal (3D only: the 2D game has no posts to bounce off) ───────────────
/** Post and bar radius (the 3D training pitch draws them at 0.06 m). */
export const FRAME_R = 0.06;
/** How deep the net runs behind the line (the 3D pitch draws 1.9 m). */
export const NET_BACK = 1.9;
/** Restitution off the woodwork. */
export const FRAME_BOUNCE = 0.62;

// ── Kicks: the 2D match's launch() maths, as plain numbers ───────────────────
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** canvasEngine.ts `loftRange`: how much lift a player's technique lets him use. */
export function loftRange(technique: number): number { return 0.55 + clamp(technique, 0, 100) / 100 * 0.45; }
/** canvasEngine.ts `curlRange`: how much curl. */
export function curlRange(technique: number): number { return 0.42 + clamp(technique, 0, 100) / 100 * 0.58; }

/** Where the boot meets the ball: cx −1..1 (right side = +), cy −1..1 (bottom = +). Same as the 2D `Contact`. */
export interface Contact3 { cx: number; cy: number }

/**
 * One strike, exactly as the 2D match's `launch()` builds it (canvasEngine.ts):
 * horizontal speed `Sh`, vertical `vz`, side `spin`, `topspin`, and the
 * aim error in degrees for this technique and power. Pure: the caller rolls
 * the noise.
 */
export function strikeNumbers(power: number, contact: Contact3, powerSkill: number, technique: number) {
  const usableCy = contact.cy * loftRange(technique);
  const loft = clamp((usableCy + 1) / 2, 0, 1);
  const tMax = clamp((loftRange(technique) + 1) / 2, 0, 1);
  const lift = Math.sqrt(loft * tMax);
  const sigmaDeg = (1 - technique / 100) * 2.2 + power * (1 - technique / 100) * 1.6;
  const Sh = power * (18 + powerSkill * 0.18) * (1 - loft * 0.25);
  // VZ_POWER_FLOOR 0.88, VZ_POWER_WEIGHT 0.12 (canvasEngine.ts)
  const vz = lift * (7.5 + powerSkill * 0.035) * (0.88 + power * 0.12);
  const spin = contact.cx * curlRange(technique) * 1.85 * power;
  const topspin = clamp(-usableCy, -1, 1) * (0.5 + technique / 200);
  return { Sh, vz, spin, topspin, sigmaDeg };
}

// ── People ───────────────────────────────────────────────────────────────────
/** Jogging speed, m/s, for a pace-50 player. */
export const JOG_SPEED = 4.2;
/** Sprint top speed, m/s: 7.0 at pace 0 up to 9.2 at pace 100. */
export function sprintSpeed(pace: number): number { return 7 + clamp(pace, 0, 100) / 100 * 2.2; }
/** Acceleration (m/s²): quicker players get there sooner. */
export function accel(pace: number): number { return 6 + clamp(pace, 0, 100) / 100 * 3; }
/** Braking, m/s². */
export const DECEL = 11;
/** How fast a man can turn, rad/s, standing vs flat out. */
export const TURN_STAND = 10;
export const TURN_SPRINT = 4.2;

/** How far from his feet a man can reach a ball: foot, body, jump. */
export const REACH_FOOT = 0.75;
export const REACH_JUMP_Z = 2.35;

/** The fixed physics step every 3D game runs at (the World's clock). */
export const STEP = 1 / 120;

/** A skill 0-100 (missing → 60) as 0..1. */
export const skill01 = (s: number | undefined) => clamp(s ?? 60, 0, 100) / 100;
export { clamp };
