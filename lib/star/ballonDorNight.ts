/**
 * THE BALLON D'OR NIGHT — who stands where and when everything happens
 * (STAR_ROADMAP.md #7: "your player walks up, a famous player hosts and calls
 * the winner up, the final three on podiums").
 *
 * Pure. The 3D stage is lib/star/ballonDor3d.ts; the screen around it (and the
 * drawn stage for a phone that can't run 3D) is components/star/BallonDorNight.tsx.
 * Both read this one plan, so the words on screen and the people on the stage
 * keep the same time.
 *
 *   Full night (you are in the top three), about 21 s:
 *     the room → the host → the three walk up one by one as he calls each name
 *     → "And the winner is…" → a pause → the name, the golden ball, the light.
 *   Short night (you are not), about 15 s:
 *     the room → the three walk up together → the call → the name → your place.
 *
 * Metres; y up; the stage faces +z (the camera). The podium slots are x = -1.6,
 * 0, +1.6. The host stands to the right of the podiums at his lectern.
 */
import type { BallonDorEntry } from "./ballonDor";

export type NightKind = "full" | "short";

export interface Finalist {
  entry: BallonDorEntry;
  /** 1, 2 or 3 (hidden until the reveal). */
  rank: number;
  /** Which podium: -1 left, 0 middle, 1 right (not by rank: the middle must not give it away). */
  slot: -1 | 0 | 1;
  /** When he starts walking on, and when he is on his podium (seconds). */
  walkFrom: number;
  walkTo: number;
}

export interface NightPlan {
  kind: NightKind;
  finalists: Finalist[];
  /** Your place (1..10), or 0 when you were not on the list. */
  yourRank: number;
  /** The beats, seconds from the start. */
  hostFrom: number;
  callAt: number;
  pauseAt: number;
  revealAt: number;
  /** When your own place is said (after the winner has had his moment). */
  yourPlaceAt: number;
  end: number;
}

/** Podium x for a slot, and its height before and after the reveal. */
export const PODIUM = {
  gap: 1.6,
  /** All three the same height until the winner is named (no giveaway). */
  even: 0.45,
  /** After the reveal: 1st, 2nd, 3rd. */
  rankHeight: [0.9, 0.62, 0.42] as readonly number[],
  /** How long the podiums take to rise to their places. */
  rise: 1.1,
  /** Where everyone comes on from (stage left, the camera's left). */
  enterX: -5.2,
  /** The host's lectern. */
  hostX: 3.3,
} as const;

/** Small, seeded: the same night is laid out the same way every time. */
function rand(seed: number, k: number): number {
  let h = (seed * 2654435761 + k * 40503) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489917) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The night's plan from the shortlist (computeBallonDorShortlist's entries,
 * best first) and your place on it (0 = not on the list).
 */
export function nightPlan(entries: readonly BallonDorEntry[], yourRank: number, seed = 1): NightPlan {
  const top = entries.slice(0, 3);
  const full = yourRank >= 1 && yourRank <= 3;
  // Which podium each of the three takes: a seeded shuffle, so the winner is
  // in the middle only one night in three.
  const slots: (-1 | 0 | 1)[] = [-1, 0, 1];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed, i) * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  // The walk-on order: the left podium first, so nobody walks through anyone.
  const order = top.map((e, i) => ({ e, rank: i + 1, slot: slots[i] })).sort((a, b) => a.slot - b.slot);
  const hostFrom = full ? 2.6 : 2.0;
  const walkStart = full ? 4.2 : 3.0;
  const each = full ? 2.0 : 0.75; // full: one at a time as the host calls each; short: in a line, a stride apart
  const walkLen = full ? 2.3 : 2.6;
  const finalists: Finalist[] = order.map((o, k) => ({
    entry: o.e, rank: o.rank, slot: o.slot,
    walkFrom: walkStart + k * each,
    walkTo: walkStart + k * each + walkLen,
  })).sort((a, b) => a.rank - b.rank);
  const lastOn = Math.max(...finalists.map((f) => f.walkTo), walkStart);
  const callAt = lastOn + (full ? 0.6 : 0.3);
  const pauseAt = callAt + 2.0;
  const revealAt = pauseAt + (full ? 2.2 : 1.4);
  const yourPlaceAt = yourRank === 1 ? revealAt : revealAt + (full ? 3.0 : 2.4);
  const end = yourPlaceAt + (full ? 3.6 : 2.6);
  return { kind: full ? "full" : "short", finalists, yourRank, hostFrom, callAt, pauseAt, revealAt, yourPlaceAt, end };
}

/** Where a podium stands across the stage. */
export function podiumX(slot: -1 | 0 | 1): number {
  return slot * PODIUM.gap;
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** A podium's height at time t: even until the reveal, then up or down to its rank's. */
export function podiumHeightAt(plan: NightPlan, rank: number, t: number): number {
  const k = smooth((t - plan.revealAt) / PODIUM.rise);
  return PODIUM.even + (PODIUM.rankHeight[rank - 1] - PODIUM.even) * k;
}

/** Where a finalist is on the floor at time t (x), and whether he has reached his podium. */
export function finalistXAt(f: Finalist, t: number): { x: number; walking: boolean; on: boolean; seen: boolean } {
  const to = podiumX(f.slot);
  if (t < f.walkFrom) return { x: PODIUM.enterX, walking: false, on: false, seen: false };
  const k = (t - f.walkFrom) / (f.walkTo - f.walkFrom);
  if (k >= 1) return { x: to, walking: false, on: true, seen: true };
  return { x: PODIUM.enterX + (to - PODIUM.enterX) * smooth(k), walking: true, on: false, seen: true };
}

/** The finalist the host is calling up at time t (full night only), else null. */
export function callingAt(plan: NightPlan, t: number): Finalist | null {
  if (plan.kind !== "full") return null;
  const on = [...plan.finalists].sort((a, b) => a.walkFrom - b.walkFrom);
  for (let i = on.length - 1; i >= 0; i--) {
    if (t >= on[i].walkFrom - 0.4 && t < on[i].walkTo) return on[i];
  }
  return null;
}

export type NightBeat = "room" | "host" | "walk" | "call" | "pause" | "reveal" | "yours" | "done";

/** Which beat the night is on. */
export function beatAt(plan: NightPlan, t: number): NightBeat {
  if (t >= plan.end) return "done";
  if (plan.yourRank !== 1 && t >= plan.yourPlaceAt) return "yours";
  if (t >= plan.revealAt) return "reveal";
  if (t >= plan.pauseAt) return "pause";
  if (t >= plan.callAt) return "call";
  const firstWalk = Math.min(...plan.finalists.map((f) => f.walkFrom));
  if (t >= firstWalk) return "walk";
  if (t >= plan.hostFrom) return "host";
  return "room";
}

/** The words for your place: "2nd", "3rd", "7th". */
export function placeWord(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
  return `${n}${s}`;
}
