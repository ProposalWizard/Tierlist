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
 *  to 1 (the top of its bounce / the cross at head height). */
export interface AirStrike { kind: "header" | "volley"; lift: number }
export type StrikeContact = Contact & { air?: AirStrike };

export const HEADER_Z = 1.85;      // m, a forehead on a jump
export const VOLLEY_MAX_Z = 0.95;  // m, the top of a volley's bounce
const HEADER_PACE = 0.72;          // a header is softer than a strike
const VOLLEY_PACE = 1.06;          // a clean volley comes off hot

/** The struck ball, started from where it really was. Same object, changed. */
export function applyAirborne(ball: Ball, scenario: Scenario, air: AirStrike | undefined): Ball {
  if (!air) return ball;
  const lift = Math.max(0, Math.min(1, air.lift));
  if (air.kind === "header") {
    ball.z = HEADER_Z * (0.85 + 0.15 * lift);
    ball.vel = { x: ball.vel.x * HEADER_PACE, y: ball.vel.y * HEADER_PACE };
    // Nodded down: whatever lift the contact gave is mostly taken away.
    ball.vz = Math.max(-4, Math.min(2.5, ball.vz * 0.35 - 1.2));
    ball.spin *= 0.3;
    ball.topspin = 0;
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
  }
  ball.resting = false;
  markLanding(ball, scenario);
  return ball;
}
