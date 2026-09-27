/**
 * CLOSED DOWN WHILE YOU PULL BACK — plan v0.15, item 22.
 *
 * Harry: "by the time you're in the prem … closest opponent closing down the
 * ball as soon as you're dragging back" — and, deciding the prototype: the
 * lighter setting ("so you can time the pass"), in the Premier League always
 * (ordered run or not), and when he reaches you "you're either tackled or
 * fouled": about 1 in 3 is a foul, a free kick outside the box and a penalty
 * inside it.
 *
 * One number, 0..1, the `pressure` prop on the match. The real match passes
 * the career's division (below); the Play Area passes its own dial. The
 * closing-down itself runs in the match file's aim phase, never in the
 * engine: nothing here moves anyone.
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
