/**
 * EACH PERSON'S OWN MOTION, for every Person3D (people round 2, 21 Nov 2026; Harry: "no variations - 22 players
 * walking at the same pace in the same time. No life in their faces, everyone static").
 *
 * From his id alone, the same every time (no randomness, no memory): where in a stride or an idle he starts,
 * how fast his idle runs, which of the walks he has, how much his arms swing, how he carries himself, how often
 * he looks about, his own walking pace (within 12% either way) and a habit. "you" is the middle of every range.
 * Read by the cut scenes (cutscene/timeline.ts, director.ts) and the world's walking people (world3d/npc.ts).
 * Pure: no three.js.
 */
import { hashStr } from "../cutscene/math";

export interface OwnMotion {
  /** 0..1: where in a stride or an idle he starts. */
  phase: number;
  /** His idle's speed (0.88..1.12). */
  rate: number;
  /** He has the more upright walk (walk_formal). */
  otherWalk: boolean;
  /**
   * HIS WALK (21 Nov 2026, Harry: "find walking animations and match them to our style/bodies, same goes for
   * standing"): one of three, seeded by id. "walk" (CMU 16_15, its feet set wider: three3d/stride.ts),
   * "walk_relaxed" and "walk_formal" (Quaternius UAL 1: an easy stroll; the same legs, arms held closer).
   * A body without his walk plays "walk". The stride clock follows the ground (WALK_SPEED), so feet never slide.
   */
  walk: WalkClip;
  /** HIS STANDING IDLE: "idle" (CMU), or the Quaternius UAL 1 weight shift ("idle_relaxed", or its mirror "idle_relaxed_m"). */
  idle: IdleClip;
  /** Arm swing (0.75..1.25). */
  arms: number;
  /** Carriage: forward lean and side lean (radians). */
  lean: number;
  side: number;
  /** His head's own turn (radians) and how restless his eyes are (0.6..1.5). */
  head: number;
  restless: number;
  /** His walking pace in open space (0.88..1.12 of the usual): the stride clock follows the ground, so the feet keep up. */
  pace: number;
  /** His habit (glancing about, looking up at the stands, clapping, pulling a sleeve, a wave) and when in a walk he does it (0..1). */
  habit: Habit;
  habitAt: number;
  /** Over a long walk he speeds up and eases off a little on his own rhythm (-0.1..0.1 of his pace). */
  surge: number;
}

export type WalkClip = "walk" | "walk_confident" | "walk_relaxed" | "walk_formal";
export type IdleClip = "idle" | "idle_relaxed" | "idle_relaxed_m";
/** Each walk's own ground speed at timeScale 1, over "walk"'s (measured in mocap.glb clips[name].speed: walk 1.05 m/s). */
export const WALK_SPEED: Record<WalkClip, number> = { walk: 1, walk_confident: 1.4 / 1.35, walk_relaxed: 0.938 / 1.05, walk_formal: 0.938 / 1.05 };
/**
 * Who gets which walk. walk_confident is NOT dealt out (28 Nov 2026, measured with scripts/walk3d/measure.mts): its
 * file holds a standing pose (the legs move 0.016 rad in the whole loop), so the fifth of people who had it glided
 * along standing still, each foot sliding 128 cm a step. The other three are real walks, fitted to our bodies
 * (three3d/stride.ts: feet planted 86 to 89% of the hips apart).
 */
const WALKS: [WalkClip, number][] = [["walk", 0.36], ["walk_relaxed", 0.34], ["walk_formal", 0.3]];
/** A small thing he does now and then while he walks or waits (cut scenes; the test scene walkout22 shows them all). */
export type Habit = "none" | "glance" | "look-up" | "clap" | "sleeve" | "wave";
const HABITS: [Habit, number][] = [["none", 0.3], ["glance", 0.22], ["look-up", 0.16], ["clap", 0.14], ["sleeve", 0.1], ["wave", 0.08]];
const IDLES: [IdleClip, number][] = [["idle", 0.4], ["idle_relaxed", 0.3], ["idle_relaxed_m", 0.3]];
const pick = <T,>(list: [T, number][], u: number): T => { let a = 0; for (const [v, w] of list) { a += w; if (u < a) return v; } return list[list.length - 1][0]; };

export function ownMotion(id: string): OwnMotion {
  if (id === "you") return { phase: 0, rate: 1, otherWalk: false, walk: "walk", idle: "idle", arms: 1, lean: 0, side: 0, head: 0, restless: 1, pace: 1, habit: "none", habitAt: 0, surge: 0 };
  const h = (k: string) => (hashStr(`${id}#${k}`) >>> 0) / 4294967296;
  const walk = pick(WALKS, h("walk"));
  return {
    phase: h("phase"), rate: 0.88 + 0.24 * h("rate"), otherWalk: walk === "walk_formal", walk, idle: pick(IDLES, h("idle")), arms: 0.75 + 0.5 * h("arms"),
    lean: (h("lean") - 0.5) * 0.07, side: (h("side") - 0.5) * 0.03, head: (h("head") - 0.5) * 0.12, restless: 0.6 + 0.9 * h("restless"),
    pace: 0.88 + 0.24 * h("pace"), habit: pick(HABITS, h("habit")), habitAt: 0.15 + 0.6 * h("habitAt"),
    surge: (h("surge") - 0.5) * 0.2,
  };
}

/** A small number from an id, for the face's blink and glance patterns (blinkAt, wanderGaze). */
export const lifeSeed = (id: string) => ((hashStr(`${id}#face`) >>> 0) % 10007) / 97;
