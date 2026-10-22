/**
 * BICYCLE KICKS (Leo, 22 Oct 2026, chat 3: "do it WELL! proper good animation
 * and move in game, and only for a ball crossed into you for a volley above
 * your head moving across").
 *
 * Plan: docs/plans/2026-10-20-flair-bicycle.md, with Leo's calls from
 * docs/plans/2026-10-22-leo-tonight (3a, 3b):
 *  - OFFERED only when the cross reaches you ABOVE YOUR HEAD and travels
 *    ACROSS you, from either side. Not a ball coming straight at you, not a
 *    ground ball, not a volley at knee height.
 *  - HOW OFTEN, when it fits: by Aerial & Acrobatics (aerial.ts). About 1 in 4
 *    at Aerial 40, every time at 80 and over. No new stat.
 *  - THE INPUT: a BICYCLE button on the strike screen (ContactBall.tsx). The
 *    ball drops across you through a height meter; hit the middle of it as it
 *    drops through the green.
 *  - THE JUDGING: like a volley (airborneChance.ts airContactRead), stricter:
 *    clean only within 0.1 ball radii of the middle, timing band 0.4-0.8 of the
 *    drop, up to 40° off line at worst; a clean one comes off ×1.2 and the
 *    keeper reacts later (he cannot read your body). A higher Aerial widens the
 *    timing band and forgives a miss.
 *
 * Nothing here places anybody: a bicycle is a way to strike a header chance
 * that already exists (research §7.8 point 5). Pure: no React, no canvas, no
 * random numbers (the offer is seeded off the chance), so a goal replay
 * strikes it the same way.
 */
import { CX } from "./pitch";
import { HITBOX_DEFAULTS } from "./hitbox";
import { airZOf } from "./airDrawings";

/** The animation's name for a bicycle strike: the ball action's `mode`, the
 *  2D clip and the 3D clip all use this one word. */
export const BICYCLE_MODE = "bicycle" as const;
export type BicycleMode = typeof BICYCLE_MODE;
/** True for a strike drawn as a bicycle kick (any mode string). */
export const isBicycleMode = (mode: string | undefined | null): boolean => mode === BICYCLE_MODE;

// ─────────────────────────────────────────────────────────────────────────
//  WHEN IT IS OFFERED
// ─────────────────────────────────────────────────────────────────────────

/** The cross must reach you at least this high (m): over the top of your head
 *  (a standing man is 1.85 m, hitbox.ts). */
export const BICYCLE_MIN_Z = HITBOX_DEFAULTS.standHeight + 0.05;
/** "Across you": the cross's line is at least this far off the line from you
 *  to goal, both ways (degrees). 45 = anything from side-on to 45° off it. A
 *  ball coming straight at you (from goal side) or straight from behind is out. */
export const BICYCLE_ACROSS_MIN_DEG = 45;

export interface CrossIn {
  /** Where the cross meets you (the chance's ball). */
  ball: { x: number; y: number };
  /** Where it was crossed from (the crosser: the chance's teammates[0]). */
  from: { x: number; y: number } | null | undefined;
  /** How high it reaches you (m, airDrawings.ts airZOf). */
  z: number;
}

/** How far the cross's line is off the line to goal (degrees, 0..90): 90 = straight across you. */
export function crossAngleDeg(c: Pick<CrossIn, "ball" | "from">): number | null {
  if (!c.from) return null;
  const ux = c.ball.x - c.from.x, uy = c.ball.y - c.from.y;
  const gx = CX - c.ball.x, gy = 0 - c.ball.y;
  const lu = Math.hypot(ux, uy), lg = Math.hypot(gx, gy);
  if (lu < 1 || lg < 0.5) return null;
  const cos = Math.abs((ux * gx + uy * gy) / (lu * lg));
  return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
}

/** Does this cross fit a bicycle kick at all (above your head, across you)? */
export function bicycleFits(c: CrossIn): boolean {
  if (!(c.z >= BICYCLE_MIN_Z)) return false;
  const a = crossAngleDeg(c);
  return a !== null && a >= BICYCLE_ACROSS_MIN_DEG;
}

/** Aerial at which it is offered 1 time in 4, and at which it is always offered. */
export const BICYCLE_OFFER_AT_40 = 0.25;
export const BICYCLE_ALWAYS_FROM = 80;
/** The share of fitting crosses where the button shows, by Aerial: 1 in 4 at
 *  40, a straight line up to every time at 80, at least 1 in 20 below 40. */
export function bicycleOfferChance(aerial: number): number {
  const a = Number.isFinite(aerial) ? aerial : 40;
  const p = BICYCLE_OFFER_AT_40 + ((a - 40) * (1 - BICYCLE_OFFER_AT_40)) / (BICYCLE_ALWAYS_FROM - 40);
  return Math.max(0.05, Math.min(1, p));
}

/** Seeded 0..1 off the chance (no random draw: the match's stream is untouched). */
export function bicycleRoll(seed: number): number {
  return ((Math.imul((seed ^ 0xb1c7c1e) >>> 0, 2654435761) >>> 0) % 10000) / 10000;
}

/** Is the BICYCLE button on the strike screen for this chance? */
export function bicycleOffered(c: CrossIn, aerial: number, seed: number): boolean {
  return bicycleFits(c) && bicycleRoll(seed) < bicycleOfferChance(aerial);
}

// ─────────────────────────────────────────────────────────────────────────
//  HOW IT IS JUDGED
// ─────────────────────────────────────────────────────────────────────────

/** Clean only inside this far from the middle (ball radii, sideways). A volley: 0.2. */
export const BICYCLE_CENTRE_R = 0.1;
/** The timing band (share of the drop, 1 = top), at Aerial 40. A volley: 0.25-0.9. */
export const BICYCLE_SWEET: readonly [number, number] = [0.4, 0.8];
/** The band widens by this much each side at Aerial 90 (straight line from 40). */
export const BICYCLE_WIDEN_AT_90 = 0.1;
/** Met on the very edge it flies this far off line (degrees). A volley: 26. */
export const BICYCLE_OFFLINE_DEG = 40;
/** A clean one comes off this much harder. A volley: ×1.06. */
export const BICYCLE_CLEAN_PACE = 1.2;
/** …and the keeper reacts this much later (s): he cannot read your body. */
export const BICYCLE_KEEPER_LATE_S = 0.14;
/** Mistimed: early (the ball still high) it balloons (+ m/s up at worst);
 *  late (the ball past you) it is scuffed (pace lost, degrees off at worst). */
export const BICYCLE_BALLOON_VZ = 4;
export const BICYCLE_SCUFF_PACE = 0.5;
export const BICYCLE_SCUFF_DEG = 18;
/** Met under the ball it skies (m/s up per ball radius past 0.3); over the top it is driven down. */
export const BICYCLE_SKY_VZ = 6;

/** The timing band for an Aerial. */
export function bicycleBand(aerial: number | undefined): [number, number] {
  const a = aerial !== undefined && Number.isFinite(aerial) ? aerial : 40;
  const w = Math.max(0, Math.min(1, (a - 40) / 50)) * BICYCLE_WIDEN_AT_90;
  return [BICYCLE_SWEET[0] - w, BICYCLE_SWEET[1] + w];
}

/** How much a miss is made worse (>1) or forgiven (<1), by Aerial: the same
 *  line airborneChance.ts uses (×1.42 at 30, ×0.94 at 60, ×0.46 at 90). */
export function bicycleForgiveness(aerial: number | undefined): number {
  const a = aerial !== undefined && Number.isFinite(aerial) ? aerial : 40;
  return Math.max(0.4, Math.min(1.5, 0.94 - ((a - 60) / 100) * 1.6));
}

export interface BicycleRead {
  label: string;
  /** Clean: struck through the middle, in the band. */
  good: boolean;
  /** Degrees off the line you aimed (+ = towards +x). */
  turnDeg: number;
  /** × the pace. */
  pace: number;
  /** m/s added to the rise. */
  vzAdd: number;
  /** Seconds later the keeper reacts (a clean one only). */
  keeperLateS: number;
}

/**
 * How a bicycle kick came off, from where you hit the ball (cx, cy: -1..1
 * ball radii, +x right, +y down) and when (`lift`: 1 top of the drop, 0 the
 * grass). Pure: the same tap is always the same strike, and the same replay.
 */
export function bicycleContactRead(t: { cx?: number; cy?: number; lift: number; aerial?: number }): BicycleRead {
  const cx = Math.max(-1, Math.min(1, t.cx ?? 0));
  const cy = Math.max(-1, Math.min(1, t.cy ?? 0));
  const lift = Math.max(0, Math.min(1, t.lift));
  const k = bicycleForgiveness(t.aerial);
  const [lo, hi] = bicycleBand(t.aerial);
  const side = Math.max(0, Math.abs(cx) - BICYCLE_CENTRE_R) / (1 - BICYCLE_CENTRE_R);
  const away = cx > 0 ? -1 : cx < 0 ? 1 : 0;
  const early = lift > hi ? (lift - hi) / (1 - hi) : 0;
  const late = lift < lo ? (lo - lift) / lo : 0;
  const sky = Math.max(0, cy - 0.3), down = Math.max(0, -0.5 - cy);
  const inBand = early === 0 && late === 0;
  const clean = inBand && side === 0 && cy <= 0.3 && cy >= -0.5;
  const read: BicycleRead = {
    label: "BICYCLE KICK!", good: clean,
    turnDeg: Math.max(-BICYCLE_OFFLINE_DEG, Math.min(BICYCLE_OFFLINE_DEG,
      (away * side * BICYCLE_OFFLINE_DEG + (away || 1) * late * BICYCLE_SCUFF_DEG) * k)),
    pace: (clean ? BICYCLE_CLEAN_PACE : 1) * (1 - BICYCLE_SCUFF_PACE * late * k) * (1 - 0.3 * side * k),
    vzAdd: (early * BICYCLE_BALLOON_VZ + sky * BICYCLE_SKY_VZ - down * 3) * k,
    keeperLateS: clean ? BICYCLE_KEEPER_LATE_S : 0,
  };
  if (!clean) {
    if (early > 0) read.label = "TOO EARLY";
    else if (late > 0) read.label = "TOO LATE";
    else if (side > 0) read.label = side > 0.35 ? "SLICED" : "OFF THE MIDDLE";
    else if (sky > 0) read.label = "SKIED";
    else read.label = "SCUFFED";
  }
  return read;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE STRIKE SCREEN'S BALL: a cross dropping across you
// ─────────────────────────────────────────────────────────────────────────

/**
 * Where the ball is on the strike screen in bicycle mode, `t` seconds in, as
 * fractions of the play area (as ContactBall's ballMotionAt), and its `lift`
 * (1 = the top, 0 = the grass). It comes in high from one side and drops
 * across you, then the next cross comes in: one drop every `period` s.
 * `fromLeft`: which side the cross comes from.
 */
export function bicycleMotionAt(t: number, period: number, fromLeft: boolean): { x: number; y: number; lift: number } {
  const u = ((t / period) % 1 + 1) % 1;            // 0..1 through one drop
  const lift = Math.cos((Math.PI / 2) * u);        // 1 at the top, slows near it, 0 at the grass
  const sx = fromLeft ? -1 : 1;
  const x = sx * (0.16 - 0.32 * u);                // crosses the screen
  return { x, y: -0.5 * lift, lift };
}

/** One drop takes this long (s) at Aerial 40, longer (easier) with Aerial. */
export function bicyclePeriodS(aerial: number | undefined): number {
  const a = aerial !== undefined && Number.isFinite(aerial) ? aerial : 40;
  return 1.5 + Math.max(0, Math.min(60, a - 40)) / 60 * 0.6;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE MATCH'S QUESTION: is the button on for this chance?
// ─────────────────────────────────────────────────────────────────────────
/** The bits of a chance the offer reads (canvasEngine Scenario fits). */
export interface BicycleChance {
  kind: string;
  airZ?: number;
  ball: { x: number; y: number };
  teammates: { x: number; y: number }[];
}

/** The cross into this chance: where it meets you, where from, how high. Null: not a header chance. */
export function crossInto(sc: BicycleChance): CrossIn | null {
  if (sc.kind !== "header") return null;
  return { ball: sc.ball, from: sc.teammates[0] ?? null, z: airZOf(sc) };
}

/** The strike screen's `bicycle` prop for this chance: on (and from which side), or undefined. */
export function bicycleOfferFor(sc: BicycleChance, aerial: number | undefined, seed: number): { fromLeft: boolean } | undefined {
  const c = crossInto(sc);
  if (!c || !c.from || !bicycleOffered(c, aerial ?? 40, seed)) return undefined;
  return { fromLeft: c.from.x < c.ball.x };
}
