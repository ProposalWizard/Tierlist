/**
 * BIG MOMENTS — Leo's tonight plan, part 5 (22 Oct 2026, approved, choice 5a).
 *
 * "85th minute, level or one down, a chance falls to you. The game makes you
 * feel it." Before the chance: a BIG MOMENT banner, the crowd rises, a
 * heartbeat under the sound. If you score: the last half-second of the shot in
 * slow motion, a huge roar, the late commentary call and the turning-point
 * music. If you miss: a groan; nothing else changes.
 *
 * Pure: the match (CanvasMatch) asks these two questions and does the rest.
 */
import { POST_L, POST_R, GOAL_H } from "./pitch";

/** From this minute of a 90 (scaled to the match's own length). Extra time counts. */
export const BIG_MOMENT_MINUTE = 85;
/** How much of the shot plays slowed (s of match time) and how slow. */
export const BIG_SLOW_S = 0.5;
export const BIG_SLOW_RATE = 0.3;

/**
 * Is this chance a big moment? `minute` on the match's own clock, `length`
 * its full time (90, or a shorter rule book's); `us`/`them` the score as it is
 * served; `goalInPicture`: a chance you can score from.
 */
export function isBigMoment(minute: number, length: number, us: number, them: number, goalInPicture: boolean): boolean {
  if (!goalInPicture || !(length > 0)) return false;
  if (minute < (length * BIG_MOMENT_MINUTE) / 90) return false;
  const d = us - them;
  return d === 0 || d === -1;
}

/**
 * Is a struck ball about to go in: heading at the goal line (y = 0), there
 * within `BIG_SLOW_S`, between the posts and under the bar when it gets there?
 * Pitch metres; the ball's height `z` and climb `vz` in metres and m/s.
 */
export function headingIn(pos: { x: number; y: number }, z: number, vel: { x: number; y: number }, vz: number, g = 9.81): boolean {
  if (!(vel.y < -0.5) || pos.y < 0) return false;
  const t = pos.y / -vel.y;
  if (t > BIG_SLOW_S) return false;
  const x = pos.x + vel.x * t;
  const h = z + vz * t - 0.5 * g * t * t;
  return x > POST_L + 0.1 && x < POST_R - 0.1 && h < GOAL_H - 0.05;
}
