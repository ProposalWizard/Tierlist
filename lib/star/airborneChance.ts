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
export interface AirStrike { kind: "header" | "volley"; lift: number; cx?: number; cy?: number; tech?: number }
export type StrikeContact = Contact & { air?: AirStrike };

import { HEADER_Z, VOLLEY_MAX_Z } from "./airDrawings";
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
export function airContactRead(air: AirStrike): AirRead {
  const cx = Math.max(-1, Math.min(1, air.cx ?? 0));
  const cy = Math.max(-1, Math.min(1, air.cy ?? 0));
  const lift = Math.max(0, Math.min(1, air.lift));
  const k = Math.max(0.6, Math.min(1.25, 1.3 - ((air.tech ?? 50) / 100) * 0.6));
  const side = Math.max(0, Math.abs(cx) - AIR_CENTRE_R) / (1 - AIR_CENTRE_R);
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

/** The struck ball, started from where it really was. Same object, changed. */
export function applyAirborne(ball: Ball, scenario: Scenario, air: AirStrike | undefined): Ball {
  if (!air) return ball;
  const lift = Math.max(0, Math.min(1, air.lift));
  const read = airContactRead(air);
  if (air.kind === "header") {
    ball.z = HEADER_Z * (0.85 + 0.15 * lift);
    ball.vel = { x: ball.vel.x * HEADER_PACE, y: ball.vel.y * HEADER_PACE };
    // Nodded down: whatever lift the contact gave is mostly taken away.
    ball.vz = Math.max(-4, Math.min(2.5, ball.vz * 0.35 - 1.2));
    ball.spin *= 0.3;
    ball.topspin = 0;
    offLine(ball, read);
  } else {
    ball.z = Math.max(0.15, VOLLEY_MAX_Z * lift);
    ball.vel = { x: ball.vel.x * VOLLEY_PACE, y: ball.vel.y * VOLLEY_PACE };
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

/** Turn, slow and lift the struck ball by a read (a clean, central hit: no change). */
function offLine(ball: Ball, read: AirRead): void {
  if (read.turnDeg) {
    const a = (read.turnDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    ball.vel = { x: ball.vel.x * c - ball.vel.y * s, y: ball.vel.x * s + ball.vel.y * c };
  }
  if (read.pace !== 1) ball.vel = { x: ball.vel.x * read.pace, y: ball.vel.y * read.pace };
  ball.vz += read.vzAdd;
}
