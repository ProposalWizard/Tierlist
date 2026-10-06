/**
 * THE GUARD OF HONOUR — the walk-out before the farewell match (Leo, 6 Oct
 * 2026: "both teams in two lines clapping"). Your XI on one side, the
 * Rivals XI on the other, everyone clapping, and you walking out between
 * them towards the camera; at the end you stop and wave.
 *
 * Pure: where everyone stands and when everything happens. The 3D scene is
 * lib/star/farewell3d.ts; the screen around it is components/star/GuardOfHonour.tsx.
 * Metres; y up; you walk towards +z (the camera); a person's own left is +x
 * in his rest pose (people3d.ts).
 */
import type { Quality3d } from "./three3d/quality";

export const GUARD = {
  /** Each line's distance from the middle of the path. */
  gapX: 1.15,
  /** Between two men in a line. */
  spacing: 1.05,
  /** The nearest pair. */
  firstZ: -0.6,
  /** You start this far beyond the far pair. */
  startBeyond: 2.4,
  /** You stop here: just past the nearest pair. */
  stopZ: 0.95,
  /** The walk, in seconds from the start. */
  walkFrom: 0.5,
  walkTo: 8.0,
  /** The wave, then it is over. */
  end: 10.4,
  /** Claps a second. */
  clapHz: 2.2,
} as const;

/** How many men in each line, by the phone's 3D quality. */
export function lineLength(tier: Quality3d): number {
  return tier === "low" ? 4 : tier === "medium" ? 6 : 8;
}

/**
 * How many men in each line clap live, nearest first. The rest hold one
 * clap, still (a phone on Low quality has less to spare).
 */
export function clappers(tier: Quality3d): number {
  return tier === "low" ? 2 : lineLength(tier);
}

/** The nearest few in each line get the thin outline; further back it is too thin to see. */
export const OUTLINED = 3;

/** Where the i-th pair stands along the path (0 = nearest the camera). */
export function lineZ(i: number): number {
  return GUARD.firstZ - i * GUARD.spacing;
}

/** Where you start: beyond the far pair. */
export function startZ(n: number): number {
  return lineZ(Math.max(0, n - 1)) - GUARD.startBeyond;
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** How far along the walk you are (0..1) at time t: eased in and out. */
export function walkProgress(t: number): number {
  return smooth((t - GUARD.walkFrom) / (GUARD.walkTo - GUARD.walkFrom));
}

/** Where you are on the path at time t. */
export function youZAt(t: number, n: number): number {
  const a = startZ(n);
  return a + (GUARD.stopZ - a) * walkProgress(t);
}

/** Your walking speed at time t (m/s), for how fast the legs go. */
export function youSpeedAt(t: number, n: number, dt = 1 / 30): number {
  return Math.abs(youZAt(t + dt, n) - youZAt(t, n)) / dt;
}

/** How far apart a man's hands are (metres, palm to palm) at time t. A clap: apart, then together. */
export function clapGap(t: number, phase: number): number {
  const s = 0.5 + 0.5 * Math.cos(2 * Math.PI * GUARD.clapHz * t + phase);
  // A clap is quick together and slower apart: sharpen the meeting.
  return 0.012 + 0.13 * Math.pow(s, 0.7);
}

/** The wave's share of the last part (0 while walking, 1 once stopped). */
export function waveWeight(t: number): number {
  return smooth((t - (GUARD.walkTo - 0.3)) / 0.6);
}

/** A seeded number in [0, 1) for man i (look, clap timing). */
export function guardRand(seed: number, i: number, k: number): number {
  let h = (seed ^ Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
