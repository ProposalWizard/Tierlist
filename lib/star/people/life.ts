/**
 * EACH PERSON'S OWN MOTION, for every Person3D (people round 2, 21 Nov 2026; Harry: "no variations - 22 players
 * walking at the same pace in the same time. No life in their faces, everyone static").
 *
 * From his id alone, the same every time (no randomness, no memory): where in a stride or an idle he starts,
 * how fast his idle runs, which of the walks he has, how much his arms swing, how he carries himself, how often
 * he looks about, and his own walking pace (within 8% either way). "you" is the middle of every range.
 * Read by the cut scenes (cutscene/timeline.ts, director.ts) and the world's walking people (world3d/npc.ts).
 * Pure: no three.js.
 */
import { hashStr } from "../cutscene/math";

export interface OwnMotion {
  /** 0..1: where in a stride or an idle he starts. */
  phase: number;
  /** His idle's speed (0.88..1.12). */
  rate: number;
  /** He has the other walk (walk_confident: longer, more upright). About a third of people. */
  otherWalk: boolean;
  /** Arm swing (0.75..1.25). */
  arms: number;
  /** Carriage: forward lean and side lean (radians). */
  lean: number;
  side: number;
  /** His head's own turn (radians) and how restless his eyes are (0.6..1.5). */
  head: number;
  restless: number;
  /** His walking pace in open space (0.92..1.08 of the usual): the stride clock follows the ground, so the feet keep up. */
  pace: number;
}

export function ownMotion(id: string): OwnMotion {
  if (id === "you") return { phase: 0, rate: 1, otherWalk: false, arms: 1, lean: 0, side: 0, head: 0, restless: 1, pace: 1 };
  const h = (k: string) => (hashStr(`${id}#${k}`) >>> 0) / 4294967296;
  return {
    phase: h("phase"), rate: 0.88 + 0.24 * h("rate"), otherWalk: h("walk") < 0.34, arms: 0.75 + 0.5 * h("arms"),
    lean: (h("lean") - 0.5) * 0.07, side: (h("side") - 0.5) * 0.03, head: (h("head") - 0.5) * 0.12, restless: 0.6 + 0.9 * h("restless"),
    pace: 0.92 + 0.16 * h("pace"),
  };
}

/** A small number from an id, for the face's blink and glance patterns (blinkAt, wanderGaze). */
export const lifeSeed = (id: string) => ((hashStr(`${id}#face`) >>> 0) % 10007) / 97;
