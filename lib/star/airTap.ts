/**
 * HEADERS AND VOLLEYS: NO ARROW, STRAIGHT TO THE BALL (Harry, 25 Oct 2026).
 *
 * His words, on the redesign that came before this one: "When I said get rid
 * of the arrow animation, what I literally meant was skip straight to the
 * ball-hitting animation that we had with the headers, where you just click
 * on the ball. Not make a whole new game up." And: "it's just about maybe
 * clicking the ball at the right time, in the right place, so that your
 * movement still matters." The same for volleys.
 *
 * The flow (real match, highlights, the Head & Volley drill):
 *  1. The build-up plays and the cross comes in, once (the old glide camera).
 *  2. No drag-back arrow: after AIR_TAP_OPEN_S of the cross still creeping
 *     in, the old "Head it?" / "Volley it?" ball screen opens, with its
 *     draining ring (airborneChance.ts airStrikeTimerS).
 *  3. You tap the ball. WHEN: before the ring runs out (a volley: as it
 *     drops through the green). WHERE: where on the ball sets the strike,
 *     as it always did (top nods it down, under loops it up), and now ALSO
 *     the direction, because there is no arrow to aim with any more:
 *       - hit the ball's LEFT side and it goes RIGHT, and the other way round
 *         (the way the contact model already turns a ball met off-centre);
 *       - AIR_TAP_POST_CX of the radius out is the post (AIR_TAP_INSET_M in);
 *       - the clean middle is a band airTapCleanR wide either side, which
 *         grows with Aerial (the old perfect circle's job). Past it the ball
 *         is met on its edge and glances, as before.
 *  4. Your movement still matters: the line is from where the ball is (where
 *     the chance has put you) to that spot on the goal line.
 *
 * Nothing new in the physics: the tap becomes an aim + the contact the old
 * screen made, and goes through the same launch + applyAirborne +
 * airContactRead. Numbers tuned with scripts/aerial/tap-measure.mts so goals
 * per 100 stay within about 2 of the timed screen (timer-measure.mts).
 *
 * Pure: no React, no canvas, no random numbers.
 */
import { CX, GOAL_W } from "./pitch";
import { airCentreR } from "./airborneChance";

export type AirKind = "header" | "volley";

// The switch. On is the game (RUL-UI-001). The old drag-back arrow is kept for
// the test pages only: ?airtap=old (or localStorage star-air-tap = "old").
const KEY = "star-air-tap";
export function airTapOn(): boolean {
  try {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("airtap");
      if (q === "old") return false;
      if (q === "new") return true;
    }
    return typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "old";
  } catch { return true; }
}

/** Seconds of the cross still creeping in on the pitch before the ball screen opens. */
export const AIR_TAP_OPEN_S = 0.3;
/** …and with no build-up before it (the Head & Volley drill), so the cross is seen coming in first. */
export const AIR_TAP_OPEN_NO_LEAD_S = 0.8;

/** A tap this far from the middle of the ball (share of its radius, sideways) aims at the post. */
export const AIR_TAP_POST_CX = 0.8;
/** The post is aimed this far inside it (m). */
export const AIR_TAP_INSET_M = 0.3;
/** The power a header / a volley is struck with (no arrow to pull). */
export const AIR_TAP_POWER: Readonly<Record<AirKind, number>> = { header: 0.85, volley: 0.92 };
/** The clean middle, sideways: PAD + K × the old perfect circle's radius
 *  (airCentreR). Header 0.79 / 0.84 / 0.89 of the radius at Aerial 30 / 60 /
 *  90; volley 0.69 / 0.81 / 0.93 (a volley punishes a miss more, B10).
 *  Tuned with scripts/aerial/tap-measure.mts. */
export const AIR_TAP_CLEAN_PAD: Readonly<Record<AirKind, number>> = { header: 0.72, volley: 0.55 };
export const AIR_TAP_CLEAN_K: Readonly<Record<AirKind, number>> = { header: 0.6, volley: 1.3 };

/** How far either side of the middle (share of the radius) a tap is still clean. */
export function airTapCleanR(kind: AirKind, aerial?: number): number {
  return Math.min(0.95, AIR_TAP_CLEAN_PAD[kind] + AIR_TAP_CLEAN_K[kind] * airCentreR(aerial));
}

/** Where a tap `cx` across the ball (-1 left edge … 1 right edge) aims, on the goal line (pitch x). */
export function airTapAimX(cx: number): number {
  const g = Math.max(-1, Math.min(1, cx / AIR_TAP_POST_CX));
  return CX - g * (GOAL_W / 2 - AIR_TAP_INSET_M);
}

/** The aim and power of a tap `cx` across the ball, from where the ball is. */
export function airTapAim(kind: AirKind, ball: { x: number; y: number }, cx: number): { dir: { x: number; y: number }; power: number } {
  const dx = airTapAimX(cx) - ball.x, dy = -ball.y, L = Math.hypot(dx, dy) || 1;
  return { dir: { x: dx / L, y: dy / L }, power: AIR_TAP_POWER[kind] };
}

/**
 * The sideways spot the contact model reads for a tap `cx`. Inside the clean
 * band it is inside the old perfect circle (no glance: the side only aimed
 * it); past the band it is outside the circle by the same share, so an edge
 * tap still glances exactly as an edge tap did. Same sign: a glance turns
 * the ball the same way the aim did.
 */
export function airTapContactCx(kind: AirKind, cx: number, aerial?: number): number {
  const a = Math.min(1, Math.abs(cx)), s = cx < 0 ? -1 : 1;
  const W = airTapCleanR(kind, aerial), R0 = airCentreR(aerial);
  if (a <= W) return s * a * (R0 / W) * 0.999;
  return s * (R0 + (1 - R0) * (a - W) / (1 - W));
}

export interface AirTap { cx: number; cy: number; lift?: number; late?: boolean }

/**
 * The strike a tap on the ball makes: the aim (from the tap's side) and the
 * contact the old path reads. A late touch (the ring ran out) keeps its own
 * contact (airLateContact, already on the edge) and goes at the middle.
 */
export function airTapStrike(kind: AirKind, ball: { x: number; y: number }, tap: AirTap, aerial?: number): {
  contact: AirTap; aim: { dir: { x: number; y: number }; power: number };
} {
  if (tap.late) return { contact: tap, aim: airTapAim(kind, ball, 0) };
  return { contact: { ...tap, cx: airTapContactCx(kind, tap.cx, aerial) }, aim: airTapAim(kind, ball, tap.cx) };
}
