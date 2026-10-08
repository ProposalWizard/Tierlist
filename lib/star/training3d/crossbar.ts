/**
 * CROSSBAR CHALLENGE — the rules (Harry, 8 Oct 2026: "full 3D training area …
 * starting game can be crossbar challenge — you vs one teammate").
 *
 * You and one real team-mate take turns from the edge of the box at an empty
 * goal, five shots each. Only the CROSSBAR scores (1 point). A post scores
 * nothing — that is the whole challenge. Level or better wins, as the
 * woodwork challenge does.
 *
 * YOUR shots are the real match engine (components/star/Training3D.tsx mounts
 * EngineFeature); this file only judges where the engine's ball went.
 * HIS shots are a cut-scene: rolled from his rating up front, then shown along
 * a scripted path (`mateBallAt`). Nothing here is ball physics.
 */
import { BOX_DEPTH, CX, GOAL_H, POST_L, POST_R } from "../pitch";
import { gameReward } from "../relationships";

export const CROSSBAR_SHOTS = 5;
/** Where every shot is struck from: the D, just outside the box. */
export const CROSSBAR_SPOT = { x: CX, y: BOX_DEPTH + 1.5 };

/** The post: the woodwork challenge's reach (relationships.ts touchingFrame). */
const HIT = 0.22;
/**
 * The bar: ball radius (0.11) plus the bar's (0.06), and a hair. Tighter than
 * the woodwork challenge's 0.22 on purpose: measured in a browser, a shot
 * that went IN under the bar (centre 2.24 m, top of the ball 3 cm clear)
 * counted as a hit with 0.22.
 */
const BAR_HIT = 0.18;

/** Is the engine's ball touching the crossbar this step? (pitch metres, z up, goal line y = 0) */
export function touchingBar(b: { x: number; y: number; z: number }): boolean {
  if (b.y > 0.6 || b.y < -0.3) return false;
  return Math.abs(b.z - GOAL_H) < BAR_HIT && b.x > POST_L - 0.05 && b.x < POST_R + 0.05;
}

/** Touching a post (below the bar). Shown, never scored. */
export function touchingPost(b: { x: number; y: number; z: number }): boolean {
  if (b.y > 0.6 || b.y < -0.3) return false;
  return (Math.abs(b.x - POST_L) < HIT || Math.abs(b.x - POST_R) < HIT) && b.z < GOAL_H - 0.05;
}

/** His chance of hitting the bar with one shot: about 1 in 10 for a 60, 1 in 5 for a 85. */
export function mateBarChance(overall: number | undefined): number {
  const ov = Math.max(40, Math.min(99, overall ?? 65));
  return Math.max(0.05, Math.min(0.25, 0.06 + (ov - 50) / 250));
}

export type MateMiss = "over" | "under" | "wide" | "post";
export interface MateShot {
  hit: boolean;
  miss?: MateMiss;
  /** Where on the goal line the ball arrives (pitch metres). */
  tx: number;
  tz: number;
  /** Where he strikes it from (a step either side of the D). */
  sx: number;
}

/** His five shots, rolled once when the challenge starts. */
export function rollMateShots(overall: number | undefined, rng: () => number, n = CROSSBAR_SHOTS): MateShot[] {
  const p = mateBarChance(overall);
  const out: MateShot[] = [];
  for (let i = 0; i < n; i++) {
    const sx = CROSSBAR_SPOT.x + (rng() - 0.5) * 3;
    if (rng() < p) {
      out.push({ hit: true, tx: POST_L + 0.7 + rng() * (POST_R - POST_L - 1.4), tz: GOAL_H, sx });
      continue;
    }
    const r = rng();
    const miss: MateMiss = r < 0.4 ? "over" : r < 0.75 ? "under" : r < 0.9 ? "wide" : "post";
    const side = rng() < 0.5 ? -1 : 1;
    if (miss === "over") out.push({ hit: false, miss, tx: POST_L + 0.5 + rng() * (POST_R - POST_L - 1), tz: GOAL_H + 0.35 + rng() * 0.9, sx });
    else if (miss === "under") out.push({ hit: false, miss, tx: POST_L + 0.6 + rng() * (POST_R - POST_L - 1.2), tz: 1.3 + rng() * 0.8, sx });
    else if (miss === "wide") out.push({ hit: false, miss, tx: CX + side * (POST_R - CX + 0.4 + rng() * 1.2), tz: 1.2 + rng() * 1.6, sx });
    else out.push({ hit: false, miss, tx: side < 0 ? POST_L : POST_R, tz: 0.9 + rng() * 1.2, sx });
  }
  return out;
}

/** How long his ball takes to reach the goal, and how long the after-bit runs. */
export const MATE_FLIGHT_S = 0.95;
export const MATE_AFTER_S = 0.9;

/**
 * THE CUT-SCENE PATH (not physics): where his ball is drawn `t` seconds after
 * he strikes it. A lofted arc to the target, then a scripted after-bit — back
 * out off the bar or post, into the net, or on past the goal.
 */
export function mateBallAt(s: MateShot, t: number): { x: number; y: number; z: number } {
  const y0 = CROSSBAR_SPOT.y;
  if (t <= MATE_FLIGHT_S) {
    const k = Math.max(0, t / MATE_FLIGHT_S);
    return { x: s.sx + (s.tx - s.sx) * k, y: y0 * (1 - k), z: 0.11 + (s.tz - 0.11) * k + 1.6 * k * (1 - k) };
  }
  const u = Math.min(1, (t - MATE_FLIGHT_S) / MATE_AFTER_S);
  const vx = (s.tx - s.sx) / MATE_FLIGHT_S;
  if (s.hit || s.miss === "post") {
    // back out towards the D, dropping to the grass and skipping once
    const drop = Math.abs(Math.cos(u * Math.PI * 1.5)) * (1 - u) * s.tz;
    return { x: s.tx + vx * 0.15 * u, y: 7 * u, z: Math.max(0.11, drop) };
  }
  if (s.miss === "under") {
    // into the back of the net, then down
    return { x: s.tx + vx * 0.1 * u, y: -1.9 * Math.min(1, u * 2.5), z: Math.max(0.11, s.tz * (1 - u)) };
  }
  // over or wide: on past the goal, falling
  return { x: s.tx + vx * 0.5 * u, y: -7 * u, z: Math.max(0.11, s.tz + 0.6 * u - 2.6 * u * u) };
}

export type CrossbarOutcome = "you" | "him" | "level";
export function crossbarWinner(you: number, him: number): CrossbarOutcome {
  return you > him ? "you" : you < him ? "him" : "level";
}

/**
 * The reward: the team relationship, exactly as the woodwork challenge moves
 * it (relationships.ts gameReward, kind "team"): a win (or a level finish)
 * is +6 / +4 / +2 / 0-1 depending how high the bar already is; a loss is -1.
 */
export function crossbarReward(you: number, him: number, team: number, roll: number): { won: boolean; gain: number } {
  const won = crossbarWinner(you, him) !== "him";
  return { won, gain: gameReward(won, team, roll, "team") };
}
