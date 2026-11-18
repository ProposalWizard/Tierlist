/**
 * The "Where do you strike it?" screen's sums, ported from the website's
 * components/star/ContactBall.tsx (read-only reference). Pure: the screen
 * (screens/MatchContact.tsx) draws it.
 */
import { airStrikeTimerS, airLateContact } from "@/lib/star/airborneChance";

export type BallMotion = "still" | "float" | "bounce" | "bobble";

/** Where the ball is, as fractions of the play area, `t` seconds in (ContactBall ballMotionAt). */
export function ballMotionAt(motion: BallMotion, t: number, period: number): { x: number; y: number } {
  if (motion === "still") return { x: 0, y: 0 };
  const phase = (t / period) % 2;
  const sweep = phase < 1 ? phase : 2 - phase;
  const x = -0.12 + 0.24 * (0.5 - 0.5 * Math.cos(Math.PI * sweep));
  if (motion === "float") return { x, y: -0.42 - 0.08 * Math.sin(Math.PI * sweep) };
  if (motion === "bounce") { const b = Math.abs(Math.sin(Math.PI * 2.5 * sweep)); return { x, y: -0.26 * b }; }
  const b = Math.abs(Math.sin(Math.PI * 6 * sweep));
  return { x: x * 0.6, y: -0.05 * b };
}

/** One sweep across: 2.2 s at technique 40, 3.4 s at 100. */
export const sweepPeriod = (technique: number) => 2.2 + Math.max(0, Math.min(100, technique) - 40) / 60 * 1.2;
/** How high the ball is now, 0..1 of this motion's top. */
export function liftOf(motion: BallMotion, y: number): number {
  const top = motion === "float" ? 0.5 : motion === "bounce" ? 0.26 : 0.05;
  return Math.max(0, Math.min(1, -y / top));
}
/** How far out from the ball's centre a touch still strikes it, in ball radii. */
export const STRIKE_ZONE_R = 1.18;
/** How long "TOO SLOW" shows before the scuffed kick (ms). */
export const TOO_SLOW_MS = 350;
/** A header or volley's verdict before the ball goes (ms); a ground strike 200 ms. */
export const AIR_VERDICT_MS = 300;
export const GROUND_TAP_MS = 200;

/** The countdown for this strike screen, seconds (or none): a run-up's own, else a ball in the air's. */
export function contactLimitS(motion: BallMotion, timeLimitS: number | null, aerial: number | undefined): number | undefined {
  const airKind = motion === "float" ? "header" : motion === "bounce" ? "volley" : null;
  return timeLimitS && timeLimitS > 0 ? timeLimitS : airKind ? airStrikeTimerS(airKind, aerial) : undefined;
}
/** A ball in the air met late (the countdown ran out). */
export function lateAirContact(motion: BallMotion, lift: number, sweepX: number) {
  const airKind = motion === "float" ? "header" : "volley";
  return { ...airLateContact(airKind, lift, sweepX), late: true };
}

/** A touch at (dx, dy) px from the ball's centre, ball radius r px: the contact, or null when off the ball. */
export function tapToContact(dx: number, dy: number, r: number): { cx: number; cy: number } | null {
  if (!(r > 0)) return null;
  let cx = dx / r, cy = dy / r;
  const d = Math.hypot(cx, cy);
  if (d > STRIKE_ZONE_R) return null;
  if (d > 1) { cx /= d; cy /= d; }
  return { cx, cy };
}
