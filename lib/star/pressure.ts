/**
 * CLOSED DOWN WHILE YOU PULL BACK — plan v0.15, item 22.
 *
 * Harry: "by the time you're in the prem … closest opponent closing down the
 * ball as soon as you're dragging back" — and, deciding the prototype: the
 * lighter setting ("so you can time the pass"), in the Premier League always
 * (ordered run or not), and when he reaches you "you're either tackled or
 * fouled": about 1 in 3 is a foul (2 in 3 from behind — see FROM BEHIND),
 * a free kick outside the box and a penalty inside it.
 *
 * One number, 0..1, the `pressure` prop on the match. The real match passes
 * the career's division (below); the Play Area passes its own dial. The
 * closing-down itself runs in the match file's aim phase, never in the
 * engine: the match file calls pressStep below once a frame.
 */
import type { CareerDivision } from "./calendar";

/** How hard the nearest opponent closes you down, by division. */
export function pressureForDivision(division: CareerDivision | string | undefined): number {
  if (division === "premier") return 1;
  if (division === "championship") return 0.5;
  return 0;
}

/** The Play Area's dial: "real" follows the division. */
export type PressureDial = "real" | "off" | "light" | "full";
export const PRESSURE_DIALS: { id: PressureDial; label: string }[] = [
  { id: "real", label: "Real (by division)" },
  { id: "off", label: "Off" },
  { id: "light", label: "Light" },
  { id: "full", label: "Premier League" },
];
export function pressureFromDial(dial: PressureDial, division: CareerDivision | string | undefined): number {
  if (dial === "off") return 0;
  if (dial === "light") return 0.5;
  if (dial === "full") return 1;
  return pressureForDivision(division);
}

/**
 * Closing speed at full pressure, metres a second — a jog, not a sprint.
 * Harry's pick (b), the lighter one: a Premier League through ball is lost
 * after about 2.6 s (the prototype's 2.6 m/s lost it after 1.9 s). Every kind
 * and division scales off this one number.
 */
export const PRESS_SPEED = 1.83;
/** He reads your drag this long before he sets off. */
export const PRESS_REACT_S = 0.3;
/** Close enough to take it off you. */
export const PRESS_WIN_R = 0.9;
/** When he gets there: this share are fouls, the rest clean tackles. */
export const FOUL_SHARE = 1 / 3;

// ── FROM BEHIND (Harry, 1 Oct 2026) ──────────────────────────────────────────
//
// Playing a real match: "that intercepts it even though he's on the wrong side
// of me … if the player's behind you they should be more likely to foul you",
// and "if the player behind me fouled it should have been a pen". The closer
// was the nearest defender wherever he stood and ran in a straight line at the
// ball — through your own body when you were between them (47% of served
// one-on-ones). Harry chose: (a) he goes round you, never through you; (b) a
// man coming from behind you fouls you more often, and in the box a foul is a
// penalty (as it already was). From in front, nothing changes.

/**
 * He never comes closer to your middle than this. Not your body's real width
 * (about 0.6 m) but the drawn one: the match draws figures larger than life,
 * about 1.6 m shoulder to shoulder, so at 0.75 m he was seen walking across
 * your figure (filmed). 1.3 m keeps the two figures side by side.
 */
export const PRESS_BODY_R = 1.3;
/** A closer who has to come past you fouls you this often (from in front: FOUL_SHARE). */
export const FOUL_SHARE_BEHIND = 2 / 3;

type P = { x: number; y: number };

/**
 * Is he behind you — on your side of the ball, so he has to come past you to
 * get to it? Judged once, where he stands when you start the pull: within 60°
 * of your own bearing from the ball.
 */
export function pressFromBehind(presser: P, ball: P, you: P): boolean {
  const ax = presser.x - ball.x, ay = presser.y - ball.y;
  const bx = you.x - ball.x, by = you.y - ball.y;
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return false;
  return (ax * bx + ay * by) / (la * lb) > 0.5;
}

/** How often he fouls you when he gets there. */
export function foulShareFor(fromBehind: boolean): number {
  return fromBehind ? FOUL_SHARE_BEHIND : FOUL_SHARE;
}

/**
 * One step of the closer, at most `maxStep` metres: straight at the ball, and
 * where that would take him inside `PRESS_BODY_R` of your middle he walks
 * round you instead, along that circle, towards the ball's side of you. If he
 * started closer than that, he never gets closer and eases out to it as he
 * goes round. He stops
 * `PRESS_WIN_R / 2` short of the ball, as before. Moves `p` in place.
 */
export function pressStep(p: P, ball: P, you: P, maxStep: number): void {
  const dx = ball.x - p.x, dy = ball.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6 || maxStep <= 0) return;
  const step = Math.min(maxStep, dist - PRESS_WIN_R * 0.5);
  if (step <= 0) return;
  const keep = Math.min(PRESS_BODY_R, Math.hypot(p.x - you.x, p.y - you.y));
  const nx = p.x + (dx / dist) * step, ny = p.y + (dy / dist) * step;
  if (Math.hypot(nx - you.x, ny - you.y) >= keep) { p.x = nx; p.y = ny; return; }
  // Round you, the short way to the ball's bearing — easing out to
  // PRESS_BODY_R as he goes if he started tighter than that.
  const r = Math.max(Math.min(PRESS_BODY_R, keep + step * 0.6), 1e-3);
  const a = Math.atan2(p.y - you.y, p.x - you.x);
  const ab = Math.atan2(ball.y - you.y, ball.x - you.x);
  let da = ab - a;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da <= -Math.PI) da += 2 * Math.PI;
  if (Math.abs(da) < 1e-9) return;   // already on the ball's side of you
  const turn = Math.sign(da) * Math.min(Math.abs(da), step / r);
  p.x = you.x + Math.cos(a + turn) * r;
  p.y = you.y + Math.sin(a + turn) * r;
}

/** His closing speed at this pressure. */
export function pressSpeedFor(pressure: number): number {
  return PRESS_SPEED * Math.max(0, Math.min(1, pressure));
}

/** How long, from the moment your pull passes the dead zone, until he takes
 *  it off you — for a man `dist` metres from the ball (Infinity: never). */
export function timeToPress(dist: number, pressure: number): number {
  const v = pressSpeedFor(pressure);
  if (v <= 0) return Infinity;
  return PRESS_REACT_S + Math.max(0, dist - PRESS_WIN_R) / v;
}
