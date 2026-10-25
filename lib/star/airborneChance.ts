/**
 * AIRBORNE CHANCES — a ball that reaches you in the air is a header or a
 * volley (Mikey, gameplay review 13 Oct 2026: "if it does a bouncing ball,
 * your chance should be a volley. If the ball is in the air, it should be a
 * header … the ball would start in the air, and you could see little shadow
 * below it … the ball would start its trajectory from being in the air").
 *
 * Behind a test switch, off by default (Developer tools, and
 * ?airborne=new on /star-bigger-dev). Off: the strike screen is exactly as
 * before (a third of close chances bobble on the grass, for no reason).
 * On:
 *  - the pointless bobble is gone: a ball at your feet sits still;
 *  - about 1 close chance in 10 arrives in the air (a header), about 1 in 8
 *    bouncing (a volley) — rare, as asked;
 *  - the strike screen shows the ball off the ground with its shadow on the
 *    grass under it;
 *  - the shot starts from the height the ball was at when you hit it. A
 *    header is softer and nods down; a volley comes off a little harder.
 */
import { useSyncExternalStore } from "react";
import { markLanding, type Ball, type Contact, type Scenario } from "./canvasEngine";
import type { BallMotion } from "@/components/star/ContactBall";

const KEY = "star-airborne-v2";
let override: boolean | null = null;
const listeners = new Set<() => void>();

export function setAirborneOverride(v: boolean | null): void { override = v; listeners.forEach((f) => f()); }
export function airborneOn(): boolean {
  if (override !== null) return override;
  try { return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function setAirborne(v: boolean): void {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* in memory only */ }
  listeners.forEach((f) => f());
}
export function useAirborne(): boolean {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    airborneOn, () => false,
  );
}

/** Chances that can arrive in the air (a cross or a looped ball into the box). */
const HEADER_KINDS = new Set(["cutback", "tight_angle", "byline_cross"]);
/** Chances that can arrive bouncing. */
const VOLLEY_KINDS = new Set(["one_on_one", "tight_angle", "long_range", "cutback", "through_ball"]);
/** Out of 100 seeds: 0..HEADER_SHARE-1 a header, then VOLLEY_SHARE more a volley. */
export const HEADER_SHARE = 10;
export const VOLLEY_SHARE = 12;

/** The strike screen's ball for this chance with the switch on. Seeded, no rng draw. */
export function airborneMotion(kind: string, seed: number): BallMotion {
  if (kind === "header") return "float";
  if (kind === "volley") return "bounce";
  const h = (Math.imul(seed ^ 0x51ed, 2654435761) >>> 0) % 100;
  if (HEADER_KINDS.has(kind) && h < HEADER_SHARE) return "float";
  if (VOLLEY_KINDS.has(kind) && h >= HEADER_SHARE && h < HEADER_SHARE + VOLLEY_SHARE) return "bounce";
  return "still";
}

/** How the ball was in the air when you hit it. `lift` is 0 (on the grass)
 *  to 1 (the top of its bounce / the cross at head height). `cx`/`cy`: where
 *  on the ball (the contact screen's tap); `tech`: your technique. All three
 *  are kept on the strike so a goal replay strikes it the same way; absent
 *  (older replays, the airborne test switch's own tests) = dead centre. */
export interface AirStrike {
  kind: "header" | "volley"; lift: number; cx?: number; cy?: number; tech?: number;
  /** Your Aerial & Acrobatics (aerial.ts). When present it is read instead of
   *  `tech` to soften a mis-hit, and it sets a header's pace. Absent (the
   *  match today, older replays) = exactly the strike as before. */
  aerial?: number;
}
export type StrikeContact = Contact & { air?: AirStrike };

import { HEADER_Z, VOLLEY_MAX_Z, airZOf } from "./airDrawings";
import { aerialHeaderPace, aerialVolleyPace, headerJump } from "./aerial";
export { HEADER_Z, VOLLEY_MAX_Z };
const HEADER_PACE = 0.72;          // a header is softer than a strike
const VOLLEY_PACE = 1.06;          // a clean volley comes off hot

// ─────────────────────────────────────────────────────────────────────────
//  WHERE YOU MET IT (B10, 20 Oct 2026: "a header aims with the head; a volley
//  punishes a mistimed strike more; hitting the centre of the ball matters
//  more"). A ground shot struck off-centre only curls (canvasEngine launch);
//  a ball met in the air also goes off line.
// ─────────────────────────────────────────────────────────────────────────

/** Inside this far from the centre (in ball radii, sideways) nothing goes off line. */
export const AIR_CENTRE_R = 0.2;

/**
 * THE PERFECT CIRCLE GROWS WITH AERIAL (Harry, 22 Oct 2026: "having a better
 * aerial stat should make the circle to get perfect bigger"). The clean middle
 * of a ball met in the air, in ball radii: AIR_CENTRE_R at Aerial 60 (exactly
 * today's), AIR_CENTRE_PER_POINT more or less for every point either side,
 * held between AIR_CENTRE_MIN_R and AIR_CENTRE_MAX_R. Aerial 30: 0.11, 60:
 * 0.20, 90: 0.29. Absent (a strike without Aerial): AIR_CENTRE_R, as before.
 * The circle on the contact screen is drawn from the same number.
 */
export const AIR_CENTRE_PER_POINT = 0.003;
export const AIR_CENTRE_MIN_R = 0.1;
export const AIR_CENTRE_MAX_R = 0.32;
export function airCentreR(aerial?: number): number {
  if (aerial === undefined || !Number.isFinite(aerial)) return AIR_CENTRE_R;
  return Math.max(AIR_CENTRE_MIN_R, Math.min(AIR_CENTRE_MAX_R, AIR_CENTRE_R + (aerial - 60) * AIR_CENTRE_PER_POINT));
}
/** A header met on the very edge of the ball glances off this far (degrees), and loses this share of its pace. */
export const HEADER_GLANCE_DEG = 22;
export const HEADER_GLANCE_PACE = 0.35;
/** A header met under the ball (below this) loops up: + m/s up per ball radius under it. */
export const HEADER_LOOP_FROM = 0.45;
export const HEADER_LOOP_VZ = 3;
/** A volley met on the very edge slices this far off line (degrees). */
export const VOLLEY_SLICE_DEG = 26;
/** A volley's sweet timing: met as it drops between these heights (share of the bounce). */
export const VOLLEY_SWEET: readonly [number, number] = [0.25, 0.9];
/** Mistimed: at the top of the bounce it balloons (+ m/s up at worst); near the grass it is scuffed (pace lost at worst, degrees off line at worst). */
export const VOLLEY_BALLOON_VZ = 2;
export const VOLLEY_SCUFF_PACE = 0.35;
export const VOLLEY_SCUFF_DEG = 12;
/** A volley met under the ball skies (m/s up per ball radius past 0.4); over the top it goes into the ground. */
export const VOLLEY_SKY_VZ = 5;

export interface AirRead {
  /** What the screen says once you have hit it. */
  label: string;
  good: boolean;
  /** Degrees off the line you aimed (+ = towards +x, the right as you face the goal). */
  turnDeg: number;
  /** × the pace. */
  pace: number;
  /** m/s added to the rise. */
  vzAdd: number;
}

/**
 * How a ball met in the air came off, from where you hit it and when. Pure, no
 * random number: the same tap is always the same strike (and the same replay).
 * Technique softens every miss: ×1.12 at 30, ×1 at 50, ×0.76 at 90.
 */
export function airContactRead(air: AirStrike, ballZ?: number): AirRead {
  const cx = Math.max(-1, Math.min(1, air.cx ?? 0));
  const cy = Math.max(-1, Math.min(1, air.cy ?? 0));
  const lift = Math.max(0, Math.min(1, air.lift));
  // Aerial & Acrobatics governs a ball met in the air (Harry, Q7, 21 Oct
  // 2026); a strike without it (the match until it hands Aerial over) keeps
  // reading Technique, so nothing moves until then.
  const k = airForgiveness(air);
  const R0 = airCentreR(air.aerial);
  const side = Math.max(0, Math.abs(cx) - R0) / (1 - R0);
  // Met on the right side of the ball, it goes left (and the other way round),
  // the same way the engine curls it (positive spin bends it left).
  const away = cx > 0 ? -1 : cx < 0 ? 1 : 0;
  if (air.kind === "header") {
    const loop = Math.max(0, cy - HEADER_LOOP_FROM);
    const read: AirRead = {
      label: "FIRM HEADER", good: true,
      turnDeg: away * side * HEADER_GLANCE_DEG * k,
      pace: 1 - HEADER_GLANCE_PACE * side * k,
      vzAdd: loop * HEADER_LOOP_VZ * k,
    };
    if (side > 0.45) read.label = "GLANCED", read.good = false;
    else if (cy > 0.6) read.label = "LOOPED UP", read.good = false;
    else if (cy < -0.25) read.label = "NODDED DOWN";
    // Above your reach (aerial.ts headerJump): met at a stretch, softer and
    // up off the top of your head. Only with Aerial and a height on the strike.
    const st = headerStretch(ballZ, air.aerial);
    if (st > 0) {
      read.pace *= 1 - HEADER_STRETCH_PACE * st;
      read.vzAdd += HEADER_STRETCH_VZ * st;
      if (st >= 0.999) read.label = "JUST A TOUCH", read.good = false;
      else if (read.good) read.label = "STRETCHED", read.good = false;
    }
    return read;
  }
  const [lo, hi] = VOLLEY_SWEET;
  const early = lift > hi ? (lift - hi) / (1 - hi) : 0;   // at the top of the bounce
  const late = lift < lo ? (lo - lift) / lo : 0;          // nearly on the grass
  const sky = Math.max(0, cy - 0.4), ground = Math.max(0, -0.55 - cy);
  const read: AirRead = {
    label: "SWEET VOLLEY", good: true,
    turnDeg: (away * side * VOLLEY_SLICE_DEG + (away || 1) * late * VOLLEY_SCUFF_DEG) * k,
    pace: (1 - VOLLEY_SCUFF_PACE * late * k) * (1 - 0.2 * side * k),
    vzAdd: (early * VOLLEY_BALLOON_VZ + sky * VOLLEY_SKY_VZ - ground * 4) * k,
  };
  if (early > 0.35 || late > 0.35) read.label = "MISTIMED", read.good = false;
  else if (side > 0.4) read.label = "SLICED", read.good = false;
  else if (cy > 0.55) read.label = "SKIED", read.good = false;
  return read;
}

/**
 * How much a mis-hit is made worse (>1) or forgiven (<1). Technique: ×1.12
 * at 30, ×1 at 50, ×0.76 at 90 (B10). Aerial, when the strike carries it, is
 * read on a steeper line pinned at 60 (the same ×0.94 Technique 60 gives,
 * so a 60 plays as today): ×1.42 at 30, ×0.46 at 90. Measured with
 * scripts/aerial/measure.mts.
 */
export const AERIAL_FORGIVE_SLOPE = 1.6;
export function airForgiveness(air: Pick<AirStrike, "tech" | "aerial">): number {
  if (air.aerial !== undefined && Number.isFinite(air.aerial)) {
    return Math.max(0.4, Math.min(1.5, 0.94 - ((air.aerial - 60) / 100) * AERIAL_FORGIVE_SLOPE));
  }
  return Math.max(0.6, Math.min(1.25, 1.3 - ((air.tech ?? 50) / 100) * 0.6));
}

/** The struck ball, started from where it really was. Same object, changed. */
export function applyAirborne(ball: Ball, scenario: Scenario, air: AirStrike | undefined): Ball {
  if (!air) return ball;
  const lift = Math.max(0, Math.min(1, air.lift));
  // This chance's own height (airDrawings.ts airZOf: the kind's usual height
  // unless the chance carries its own); the airborne test switch's header on
  // another kind of chance keeps the usual one.
  const top = scenario.kind === air.kind ? airZOf(scenario) : air.kind === "header" ? HEADER_Z : VOLLEY_MAX_Z;
  // How far above (+) or below (-) the usual header height you met it (m): 0
  // whenever heights do not vary, so the strike is then exactly as before.
  const aboveM = air.kind === "header" ? (top - HEADER_Z) * (0.85 + 0.15 * lift) : 0;
  const metZ = air.kind === "header" ? top * (0.85 + 0.15 * lift) : top * lift;
  const read = airContactRead(air, metZ);
  if (air.kind === "header") {
    ball.z = metZ;
    // Aerial sets how hard it is headed: ×0.8 at 30, ×1 at 60, ×1.2 at 90.
    const hp = HEADER_PACE * aerialHeaderPace(air.aerial);
    ball.vel = { x: ball.vel.x * hp, y: ball.vel.y * hp };
    // Nodded down: whatever lift the contact gave is mostly taken away.
    ball.vz = Math.max(-4, Math.min(2.5, ball.vz * 0.35 - 1.2));
    // The height it was met at is (mostly) taken back over the flight, the
    // volley's way: a header met at 2.5 m is nodded down harder, so it does
    // not sail over the men in front of it just for being high.
    if (aboveM !== 0) {
      const speed = Math.max(4, Math.abs(ball.vel.y));
      const t = Math.max(0.25, Math.abs(ball.pos.y) / speed);
      ball.vz -= (aboveM * (aboveM > 0 ? HEADER_Z_TAKEBACK_UP : HEADER_Z_TAKEBACK_DOWN)) / t;
    }
    ball.spin *= 0.3;
    ball.topspin = 0;
    offLine(ball, read);
  } else {
    ball.z = Math.max(0.15, top * lift);
    const vp = VOLLEY_PACE * aerialVolleyPace(air.aerial);
    ball.vel = { x: ball.vel.x * vp, y: ball.vel.y * vp };
    // The height it starts at is taken back over the flight, so a volley
    // struck through the middle arrives about where the same shot off the
    // grass would — a knee-high ball does not fly over the bar by itself.
    // Where you hit it still lifts or keeps it down as usual.
    const speed = Math.max(4, Math.abs(ball.vel.y));
    const t = Math.max(0.25, Math.abs(ball.pos.y) / speed);
    ball.vz = ball.vz - ball.z / t;
    offLine(ball, read);
  }
  ball.resting = false;
  markLanding(ball, scenario);
  return ball;
}

// ─────────────────────────────────────────────────────────────────────────
//  HOW HIGH YOU MET IT (headers piece 4, 22 Oct 2026). With AIR_HEIGHT_VARIES
//  a header is met anywhere from 1.5 to 2.6 m. Left alone, a high one flew
//  over the defenders' block (the engine's block reach is head height, 1.9 m)
//  and the goal rate jumped (60: 27 → 37 per 100, 90: 39 → 49). A pace or
//  miss penalty for a high ball was tried and dropped: it hit weak headers
//  far harder than strong ones (30: -6, 90: +1). What works is the nod: a
//  ball met high is headed DOWN harder (you get over it), so it still meets
//  the men in front of it. Measured with scripts/aerial/heights.mts: every
//  level stays within 2 per 100 of the fixed-height rate.
// ─────────────────────────────────────────────────────────────────────────

/** How much of the height difference is taken back over the flight. 1 = the
 *  ball reaches the goal line exactly as high as a usual header would. A ball
 *  met above the usual height is nodded down harder than that (you get over
 *  it): HEADER_Z_TAKEBACK_UP; a low, stooping header is lifted back by
 *  exactly its difference: HEADER_Z_TAKEBACK_DOWN. */
export const HEADER_Z_TAKEBACK_UP = 3;
export const HEADER_Z_TAKEBACK_DOWN = 1;

/** A ball this far above your reach (m) is barely touched (stretch 1). */
export const HEADER_OVER_MAX_M = 0.3;
/** At full stretch the header loses this share of its pace, and goes up this much (m/s). */
export const HEADER_STRETCH_PACE = 0.45;
export const HEADER_STRETCH_VZ = 1.5;
/**
 * How stretched a header is: 0 within your reach, 1 at HEADER_OVER_MAX_M or
 * more above it. 0 whenever the strike has no Aerial or no height (older
 * replays, the airborne test switch): exactly as before.
 */
export function headerStretch(ballZ: number | undefined, aerial: number | undefined): number {
  if (ballZ === undefined || aerial === undefined || !Number.isFinite(ballZ) || !Number.isFinite(aerial)) return 0;
  return Math.min(1, headerJump(ballZ, aerial).overM / HEADER_OVER_MAX_M);
}

/** Turn, slow and lift the struck ball by a read (a clean, central hit: no change). */
function offLine(ball: Ball, read: AirRead): void {
  if (read.turnDeg) {
    const a = (read.turnDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    ball.vel = { x: ball.vel.x * c - ball.vel.y * s, y: ball.vel.x * s + ball.vel.y * c };
  }
  if (read.pace !== 1) ball.vel = { x: ball.vel.x * read.pace, y: ball.vel.y * read.pace };
  ball.vz += read.vzAdd;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE STRIKE SCREEN IS TIMED FOR A BALL IN THE AIR (Harry, 0.108h, 24 Oct
//  2026: "the header animation needs to be quicker, it standing still after
//  a live animation for too long is weird, maybe have it be timed").
//  "Head it?" / "Volley it?" get the penalty run-up's own countdown (the ring
//  round the ball, ContactBall timeLimitS). Run out and you meet it late.
// ─────────────────────────────────────────────────────────────────────────

/** Seconds to meet a header / a volley at Aerial 60. */
export const AIR_TIMER_HEADER_S = 1.5;
export const AIR_TIMER_VOLLEY_S = 1.3;
/** More time per Aerial point over 60: +0.3 s at 90. */
export const AIR_TIMER_PER_PT = 0.01;
/** Less time per point under 60, half as steep: -0.15 s at 30. (The full
 *  slope, 1.0 s for a volley at Aerial 30, ran out on 39 of 100 assumed
 *  human taps and cost 6 goals per 100: scripts/aerial/timer-measure.mts.) */
export const AIR_TIMER_PER_PT_UNDER = 0.005;
/** Aerial is read between these for the timer. */
export const AIR_TIMER_AERIAL_MIN = 30;
export const AIR_TIMER_AERIAL_MAX = 100;

/**
 * How long the strike screen waits for a ball in the air, in seconds:
 * header 1.5 s and volley 1.3 s at Aerial 60; 0.01 s more per point over,
 * 0.005 s less per point under (Aerial 30: 1.35 / 1.15, 90: 1.8 / 1.6,
 * 100: 1.9 / 1.7). Absent Aerial = 60.
 */
export function airStrikeTimerS(kind: "header" | "volley", aerial?: number): number {
  const a = aerial === undefined || !Number.isFinite(aerial) ? 60
    : Math.max(AIR_TIMER_AERIAL_MIN, Math.min(AIR_TIMER_AERIAL_MAX, aerial));
  const base = kind === "header" ? AIR_TIMER_HEADER_S : AIR_TIMER_VOLLEY_S;
  const add = a >= 60 ? (a - 60) * AIR_TIMER_PER_PT : (a - 60) * AIR_TIMER_PER_PT_UNDER;
  return Math.round((base + add) * 100) / 100;
}

/**
 * The touch you get when the timer runs out: late, so the ball clips you
 * off-centre. A header comes off the side and under the ball (GLANCED, looped
 * up); a volley is met nearly on the grass and off-centre (MISTIMED, scuffed).
 * `side` is which way the ball sits (+1 right, -1 left): it is met on that
 * side. No random draw, so the match's random stream is untouched. It goes
 * through the normal strike (airContactRead / applyAirborne), so Aerial still
 * softens it a little.
 */
export function airLateContact(kind: "header" | "volley", lift: number, side: number): { cx: number; cy: number; lift: number } {
  const s = side < 0 ? -1 : 1;
  if (kind === "header") return { cx: 0.8 * s, cy: 0.55, lift: Math.max(0, Math.min(1, lift)) };
  return { cx: 0.6 * s, cy: 0.35, lift: 0.04 };
}
