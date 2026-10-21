/**
 * FLUID MOVEMENT (B5c, Harry 20 Oct 2026: "I don't like how robotic the arms
 * can end up being at times … there needs to be fluidity").
 *
 * What made the cut-scene arms robotic, measured (tools/motionref, numbers in
 * docs/handoffs/2026-10-20-builds/b5c/README.md):
 *   1. hands pinned by IK to a fixed point for seconds (a wrist dead still 45–87%
 *      of a scene; real people in the reference videos: 0–1%);
 *   2. every arm joint arriving at once (a solved IK arm has no overlap);
 *   3. the collarbone never moving, so the arm swings from a fixed socket;
 *   4. lifts on straight-line ramps that start and stop dead, and clap / pump /
 *      wave rhythms like a metronome.
 * These helpers are the fixes. All are pure functions of t (cut scenes are
 * seekable: nothing remembers the last frame).
 */

const TAU = Math.PI * 2;

/**
 * `?fluid=old` on any page plays the cut-scene arms exactly as they were on
 * 20 Oct 2026 (pinned holds, no overlap, fixed collarbone, the old beats) for
 * a before/after. Not a Settings row (Harry 12 Oct: decide, don't toggle).
 */
export const FLUID_ON = { on: typeof window === "undefined" || new URLSearchParams(window.location.search).get("fluid") !== "old" };

/** A stable small number per actor id (each man wobbles his own way). */
export function actorSeed(id: string): number {
  let h = 7;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return h / 37;
}

/** A small smooth wander, -1..1, from t and a seed: three slow sines at odd ratios (never repeats in a scene). */
export function wander(t: number, seed: number): number {
  const s = seed * 12.9898;
  return (Math.sin(t * 0.61 + s) * 0.5 + Math.sin(t * 1.37 + s * 1.7) * 0.32 + Math.sin(t * 2.21 + s * 2.3) * 0.18);
}

/**
 * How far a held hand drifts from its mark, metres, in the actor's frame
 * (x his left, y up, z front): breathing lifts it (~0.25 Hz), the body sways
 * it. A real hand on a table or holding a shirt is never still to the
 * millimetre; this keeps it alive without moving it off the thing it holds.
 */
export function liveDrift(t: number, seed: number, amount = 1): [number, number, number] {
  const breath = Math.sin(t * TAU * 0.24 + seed) * 0.006;
  return [wander(t, seed + 1) * 0.010 * amount, (breath + wander(t, seed + 2) * 0.006) * amount, wander(t, seed + 3) * 0.008 * amount];
}

/** The overlap lags (s): the forearm follows the upper arm, the hand follows the forearm. */
export const OVERLAP = { lower: 0.07, hand: 0.14 };

/**
 * The collarbone with the arm (radians): it lifts when the hand goes above
 * the shoulder and rolls forward on a long reach. `up` and `fwd` are the
 * wrist's height above and reach in front of the shoulder, in arm lengths.
 * At most ~16° up and ~9° forward, eased in (a real shoulder starts to shrug
 * once the hand passes chest height).
 */
export function shoulderFollow(up: number, fwd: number): { raise: number; forward: number } {
  const u = Math.max(0, Math.min(1, (up + 0.35) / 1.15));
  const f = Math.max(0, Math.min(1, (fwd - 0.35) / 0.55));
  const e = (x: number) => x * x * (3 - 2 * x);
  return { raise: e(u) * 0.28, forward: e(f) * 0.16 };
}

/** Minimum-jerk 0→1 (the shape of a real reach: soft start, soft stop). */
export const minJerk = (u: number): number => {
  const x = Math.max(0, Math.min(1, u));
  return x * x * x * (10 - 15 * x + 6 * x * x);
};

/**
 * A lift that a person would make: a small dip first (anticipation), a
 * minimum-jerk rise, a little overshoot and a settle. 0 before `at`, 1 after
 * it has settled. `dur` is the rise itself.
 */
export function liftCurve(t: number, at: number, dur: number): number {
  if (t <= at - 0.18) return 0;
  if (t < at) { const k = (t - (at - 0.18)) / 0.18; return -0.06 * Math.sin(k * Math.PI * 0.5); }
  const u = (t - at) / dur;
  if (u < 1) return -0.06 * (1 - minJerk(u * 3)) + minJerk(u) * 1.06;
  const s = (t - at - dur) / 0.45;
  return s >= 1 ? 1 : 1 + 0.06 * Math.cos(s * Math.PI * 0.5) * (1 - s);
}

/**
 * A rhythm that a person keeps (claps, pumps, waves): `rate` beats a second
 * with a little drift in tempo and in size, so no two beats are the same.
 * Returns the phase in beats (use frac for where in the beat) and a size 0.8..1.15.
 */
export function humanBeat(t: number, rate: number, seed: number): { phase: number; size: number } {
  const phase = t * rate + 0.09 * Math.sin(t * 0.83 + seed) + 0.05 * Math.sin(t * 2.1 + seed * 2.7);
  return { phase, size: 1 + 0.12 * wander(t * 0.8, seed + 9) };
}

/**
 * One clap: hands apart 1 → together 0 → apart. A real clap closes faster than
 * it opens and rests a touch at the top; no sharp turn except at the contact.
 */
export function clapGap(phase: number): number {
  const f = phase - Math.floor(phase);
  if (f < 0.38) { const k = f / 0.38; return 1 - k * k; } // closing, speeding up into the hit
  const k = (f - 0.38) / 0.62;
  return minJerk(k); // opening, eased, settles at the top
}
