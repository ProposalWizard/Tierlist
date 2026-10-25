/**
 * THE TIMED HEADER AND VOLLEY, REBUILT (Harry, 25 Oct 2026, on the header
 * clip: "the ball is way too far away from the guy and you don't get to
 * really see your guy - what should really happen on these highlights is no
 * arrow drawback, you see the chance, angle - the animation happens and then
 * you get the timer to hit the ball in the right direction - this does make
 * the perfect circle bit a bit confusing and that may just have to get
 * revamped completely").
 *
 * The flow for a header or a volley (real match, highlights, the Head & Volley drill):
 *  1. You SEE it: the cross comes in, the camera close on your man.
 *  2. No arrow. Nothing to drag.
 *  3. The animation: your man moves under the ball and jumps (a volley: he
 *     sets himself as it drops). AIR_PICK_APPROACH_S.
 *  4. The moment: slow motion, a draining timer and the goal to tap. Where
 *     you tap in the goal is where you send it. WHEN you tap is how clean it
 *     is: inside the green band at the end of the timer is clean; earlier
 *     is early (a header glances and loops up, a volley balloons). The band
 *     is wider with a better Aerial (this is the perfect circle's old job).
 *     The timer running out is the late touch, exactly as before
 *     (airborneChance.ts airLateContact).
 *
 * Nothing new in the physics: a pick is turned into the strike the old
 * screen made (an aim, a power, a spot on the ball and the ball's height)
 * and goes through the same launch + applyAirborne + airContactRead.
 * The numbers below were tuned with scripts/aerial/pick-measure.mts so the
 * goals per 100 at Aerial 30/60/90 stay within about 2 of the timed screen
 * they replace (scripts/aerial/timer-measure.mts).
 *
 * Pure: no React, no canvas, no random numbers.
 */
import { CX, GOAL_W } from "./pitch";
import { airStrikeTimerS, airLateContact } from "./airborneChance";

export type AirKind = "header" | "volley";

// ─────────────────────────────────────────────────────────────────────────
//  The switch. New is the game (RUL-UI-001: decide, don't toggle). The old
//  drag + "Head it?" ball screen stays in the code, reachable only from the
//  test pages with ?airpick=old (or localStorage star-air-pick = "old").
// ─────────────────────────────────────────────────────────────────────────
const KEY = "star-air-pick";
export function airPickOn(): boolean {
  try {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("airpick");
      if (q === "old") return false;
      if (q === "new") return true;
    }
    return typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "old";
  } catch { return true; }
}

// ─────────────────────────────────────────────────────────────────────────
//  The timeline
// ─────────────────────────────────────────────────────────────────────────

/** Seconds from the chance being yours to the timer opening: the last of
 *  the cross and your man going up (or setting himself for a volley). */
export const AIR_PICK_APPROACH_S = 0.75;
/** Seconds of the cross still to come when the timer opens: in slow motion
 *  over the whole timer, it reaches your head (or foot) as the timer ends. */
export const AIR_PICK_NEAR_S = 0.03;
/** Seconds of the cross still to come when the approach starts (the cross's
 *  slowed tail, headerBeat.ts CROSS_TAIL_S). */
export const AIR_PICK_FAR_S = 0.35;
/** Seconds the ball takes from where it was to your head after the tap. */
export const AIR_PICK_RISE_S = 0.1;

/** How long the timer runs: the timed screen's own formula, unchanged
 *  (airborneChance.ts airStrikeTimerS: header 1.5 s, volley 1.3 s at Aerial
 *  60; more with a better Aerial). */
export function airPickWindowS(kind: AirKind, aerial?: number): number {
  return airStrikeTimerS(kind, aerial);
}

export interface AirPickClock {
  /** "approach" (no timer yet), "window" (the timer is running), "done" (the timer ran out). */
  stage: "approach" | "window" | "done";
  /** 0..1 through the approach. */
  approachU: number;
  /** 0..1 through the timer (0 in the approach). */
  windowU: number;
  /** Seconds of the cross still to come (AIR_PICK_FAR_S → AIR_PICK_NEAR_S → 0). */
  crossLeftS: number;
}

/** Where the moment is, `t` seconds after the chance became yours. */
export function airPickClock(t: number, windowS: number): AirPickClock {
  const ts = Math.max(0, t);
  if (ts < AIR_PICK_APPROACH_S) {
    const u = ts / AIR_PICK_APPROACH_S;
    // The cross keeps its pace into the approach and slows as he goes up.
    const k = 1 - (1 - u) * (1 - u);
    return { stage: "approach", approachU: u, windowU: 0, crossLeftS: AIR_PICK_FAR_S + (AIR_PICK_NEAR_S - AIR_PICK_FAR_S) * k };
  }
  const w = Math.max(1e-3, windowS);
  const wu = Math.min(1, (ts - AIR_PICK_APPROACH_S) / w);
  return { stage: wu >= 1 ? "done" : "window", approachU: 1, windowU: wu, crossLeftS: AIR_PICK_NEAR_S * (1 - wu) };
}

/** Seconds into the header animation (actionAnim HEADER_S = 0.55, met at the
 *  top, 0.275) to draw your man at: he goes up through the approach and hangs
 *  near the top of his jump through the timer (slow motion), arriving where
 *  the after-tap header (headerBeat with AIR_PICK_RISE_S) picks him up. */
export function airPickHeaderAnimE(c: AirPickClock, headerS = 0.55): number {
  const meet = 0.5 * headerS, hang = meet - AIR_PICK_RISE_S;
  if (c.stage === "approach") return hang * 0.8 * c.approachU;
  return hang * (0.8 + 0.2 * c.windowU);
}

// ─────────────────────────────────────────────────────────────────────────
//  WHEN you tap: the sweet band at the end of the timer
// ─────────────────────────────────────────────────────────────────────────

/** The green band at the end of the timer, in seconds: AIR_SWEET_S at Aerial
 *  60, AIR_SWEET_PER_PT more per point above 60 and AIR_SWEET_PER_PT_UNDER
 *  less per point below (gentler, as the timer is), held inside MIN..MAX
 *  and read for Aerial 30..100. A volley's band is narrower (B10, 20 Oct
 *  2026: "a volley punishes a mistimed strike more"). */
export const AIR_SWEET_S: Readonly<Record<AirKind, number>> = { header: 0.3, volley: 0.15 };
export const AIR_SWEET_PER_PT: Readonly<Record<AirKind, number>> = { header: 0.003, volley: 0.0035 };
export const AIR_SWEET_PER_PT_UNDER: Readonly<Record<AirKind, number>> = { header: 0.0005, volley: 0.0012 };
export const AIR_SWEET_MIN_S = 0.08;
export const AIR_SWEET_MAX_S = 0.55;
export function airSweetS(kind: AirKind, aerial?: number): number {
  const a = aerial === undefined || !Number.isFinite(aerial) ? 60 : Math.max(30, Math.min(100, aerial));
  const d = a - 60, per = d >= 0 ? AIR_SWEET_PER_PT[kind] : AIR_SWEET_PER_PT_UNDER[kind];
  return Math.round(Math.max(AIR_SWEET_MIN_S, Math.min(AIR_SWEET_MAX_S, AIR_SWEET_S[kind] + d * per)) * 1000) / 1000;
}
/** The band as shares of the timer: [start, 1]. */
export function airSweetBand(kind: AirKind, aerial?: number): [number, number] {
  const w = airPickWindowS(kind, aerial);
  return [Math.max(0, 1 - airSweetS(kind, aerial) / w), 1];
}
/** How early a tap is (seconds before the band) for the worst touch. */
export const AIR_EARLY_FULL_S: Readonly<Record<AirKind, number>> = { header: 0.6, volley: 0.3 };

/**
 * How mistimed a tap `tS` seconds into a `windowS` timer is: 0 inside the
 * green band, rising to 1 at AIR_EARLY_FULL_S or more before it.
 */
export function airTimingError(kind: AirKind, tS: number, windowS: number, aerial?: number): number {
  const bandStart = windowS - airSweetS(kind, aerial);
  if (tS >= bandStart) return 0;
  // A square root: a touch just early is already off (a header is met before
  // it is on your forehead; a volley on the way up), then it levels off.
  return Math.min(1, Math.sqrt((bandStart - tS) / AIR_EARLY_FULL_S[kind]));
}

// ─────────────────────────────────────────────────────────────────────────
//  WHERE you tap: a spot in the goal
// ─────────────────────────────────────────────────────────────────────────

/** The goal you tap, as -1 (left post) … 1 (right post) across and 0 (grass)
 *  … 1 (bar) up. A tap is aimed this far inside the posts (m). */
export const AIR_AIM_INSET_M = 0.3;
/** The power a header / a volley is struck with (the bot's average on the
 *  old screen: header 0.7-1.0, volley 0.75-1.0). */
export const AIR_PICK_POWER: Readonly<Record<AirKind, number>> = { header: 0.82, volley: 0.68 };

/** Where a tap at (gx, gy) on the goal aims, on the goal line (pitch x). */
export function airAimX(gx: number): number {
  const g = Math.max(-1, Math.min(1, gx));
  return CX + g * (GOAL_W / 2 - AIR_AIM_INSET_M);
}

/** The aim and power a pick strikes with: straight at that spot on the goal line. */
export function airPickAim(kind: AirKind, ball: { x: number; y: number }, gx: number): { dir: { x: number; y: number }; power: number } {
  const dx = airAimX(gx) - ball.x, dy = -ball.y, L = Math.hypot(dx, dy) || 1;
  return { dir: { x: dx / L, y: dy / L }, power: AIR_PICK_POWER[kind] };
}

/**
 * How high you aimed, as the spot on the ball the old screen read:
 *  - a header aimed low is met on top of the ball (nodded down, cy -0.35);
 *    aimed at the bar, through the middle (cy 0). Above the middle it never goes:
 *    "under the ball" is only ever a mistimed touch.
 *  - a volley aimed low is kept down (cy -0.25), aimed high is met a
 *    little under (cy 0.15).
 */
export function airAimCy(kind: AirKind, gy: number): number {
  const g = Math.max(0, Math.min(1, gy));
  return kind === "header" ? -0.35 + 0.35 * g : -0.15 + 0.35 * g;
}

/** A mistimed header: how far round the side (cx) and under (cy) the ball it is met at worst. */
/** Where in its arc a header is met (airborneChance.ts applyAirborne: 0.85 + 0.15 × this of the cross's height): the old screen's average. */
export const AIR_HEADER_LIFT = 0.92;
export const AIR_EARLY_HEADER_CX = 0.9;
export const AIR_EARLY_HEADER_CY = 0.75;
/** A mistimed volley: met nearer the top of the bounce (lift) and off-centre. */
export const AIR_SWEET_LIFT = 0.55;
export const AIR_EARLY_VOLLEY_LIFT = 0.45;
export const AIR_EARLY_VOLLEY_CX = 1;
export const AIR_EARLY_VOLLEY_CY = 0.7;

export interface AirPick {
  /** Seconds into the timer you tapped; null = the timer ran out. */
  tS: number | null;
  /** The spot in the goal (see airAimX / airAimCy). Ignored when the timer ran out. */
  gx: number; gy: number;
}

export interface AirPickStrike {
  /** The spot on the ball and the ball's height, for the old strike path (ContactBall's onContact). */
  cx: number; cy: number; lift: number;
  /** The timer ran out (the late touch). */
  late: boolean;
  /** How mistimed (0 clean … 1 worst); 1 when late. */
  err: number;
  /** The aim and power. */
  dir: { x: number; y: number }; power: number;
}

/**
 * The strike a pick makes. `side` is the side the cross comes from (+1 its
 * crosser is to the right of the ball): a mistimed touch catches the ball on
 * that side. Late = airLateContact, exactly the timed screen's late touch
 * (the aim then is where the pick's arrow was: straight at the middle).
 */
export function airPickStrike(kind: AirKind, pick: AirPick, ball: { x: number; y: number }, aerial: number | undefined, side: number): AirPickStrike {
  const s = side < 0 ? -1 : 1;
  const windowS = airPickWindowS(kind, aerial);
  if (pick.tS === null || pick.tS >= windowS) {
    const lc = airLateContact(kind, 1, s);
    return { ...lc, late: true, err: 1, ...airPickAim(kind, ball, 0) };
  }
  const e = airTimingError(kind, pick.tS, windowS, aerial);
  const aim = airPickAim(kind, ball, pick.gx);
  const cy0 = airAimCy(kind, pick.gy);
  if (kind === "header") {
    return { cx: s * e * AIR_EARLY_HEADER_CX, cy: Math.min(1, cy0 + e * AIR_EARLY_HEADER_CY), lift: AIR_HEADER_LIFT, late: false, err: e, ...aim };
  }
  return {
    cx: s * e * AIR_EARLY_VOLLEY_CX, cy: Math.min(1, cy0 + e * AIR_EARLY_VOLLEY_CY),
    lift: Math.min(1, AIR_SWEET_LIFT + e * AIR_EARLY_VOLLEY_LIFT), late: false, err: e, ...aim,
  };
}

/** Which side a header/volley's cross comes from: +1 its crosser (teammates[0]) is right of the ball. */
export function airCrossSide(sc: { ball: { x: number; y: number }; teammates: { x: number; y: number }[] }): number {
  const c = sc.teammates[0];
  if (!c) return sc.ball.x < CX ? -1 : 1;
  return c.x >= sc.ball.x ? 1 : -1;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE CAMERA: close on your man (Harry: "the ball is way too far away from
//  the guy and you don't get to really see your guy"). Through the approach
//  the chance's camera eases in to this frame: as tight as keeps the whole
//  goal (both posts, AIR_CAM_POST_M either side) and the ball (AIR_CAM_BALL_M
//  either side) in the picture, never under AIR_CAM_MIN_W across nor wider
//  than the chance's camera. Your man and the ball sit AIR_CAM_BALL_DOWN of
//  the way down (clear of the timer and the goal you tap, at the bottom),
//  the goal and its net (AIR_CAM_BEHIND_M behind the line) at the top: you
//  see the angle you are heading it at. The men grow with the zoom only to
//  the power AIR_CAM_GROW, so they read bigger without going back to the
//  "crazy big" sizes (size B ~22 px on a phone; ~26-28 px at the usual zoom).
// ─────────────────────────────────────────────────────────────────────────

export interface View { x1: number; x2: number; y1: number; y2: number }
export const AIR_CAM_MIN_W = 11;
export const AIR_CAM_POST_M = 0.8;
export const AIR_CAM_BALL_M = 4.5;
export const AIR_CAM_BALL_DOWN = 0.45;
/** At most this far down for a ball far out (a volley): the frame widens instead. */
export const AIR_CAM_BALL_MAX_DOWN = 0.55;
/** Grass behind the goal line at the top (m), at least: the net. */
export const AIR_CAM_BEHIND_M = 2.5;
export const AIR_CAM_GROW = 0.5;

/** The close frame for this ball inside the chance's camera `base` (same shape). */
export function airPickCamera(base: View, ball: { x: number; y: number }): View {
  const bw = base.x2 - base.x1, bh = base.y2 - base.y1;
  if (!(bw > 0) || !(bh > 0)) return { ...base };
  const aspect = bh / bw;
  const half = GOAL_W / 2;
  const lo = Math.min(CX - half - AIR_CAM_POST_M, ball.x - AIR_CAM_BALL_M);
  const hi = Math.max(CX + half + AIR_CAM_POST_M, ball.x + AIR_CAM_BALL_M);
  const w = Math.min(bw, Math.max(AIR_CAM_MIN_W, hi - lo, (ball.y + AIR_CAM_BEHIND_M) / (AIR_CAM_BALL_MAX_DOWN * aspect)));
  const cx = (lo + hi) / 2;
  const h = w * aspect;
  let y1 = ball.y - AIR_CAM_BALL_DOWN * h;
  y1 = Math.min(y1, -AIR_CAM_BEHIND_M);           // the goal and its net in the picture
  return { x1: cx - w / 2, x2: cx + w / 2, y1, y2: y1 + h };
}

/** Ease between two frames (u 0..1, smooth at both ends). */
export function airCamAt(from: View, to: View, u: number): View {
  const k = Math.max(0, Math.min(1, u)), e = k * k * (3 - 2 * k);
  return { x1: from.x1 + (to.x1 - from.x1) * e, x2: from.x2 + (to.x2 - from.x2) * e, y1: from.y1 + (to.y1 - from.y1) * e, y2: from.y2 + (to.y2 - from.y2) * e };
}
