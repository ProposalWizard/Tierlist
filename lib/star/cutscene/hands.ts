/**
 * HAND POSES for cut scenes — every finger bone of the one body
 * (lib/star/people3d.ts: 15 bones a hand), named and blendable.
 *
 * Each pose is degrees per joint, root joint first ([knuckle, middle, tip]),
 * plus `thumbSwing` (the thumb across the palm towards the fingers).
 * Worked out from close-up stills on /star-people-dev, not guessed.
 *
 * `grip` says where a held thing sits in the hand:
 *   "palm"  the middle of the palm (a cup, a ball, a shirt's shoulder, his hand)
 *   "pinch" between the thumb and index pads (a pen, a card, a scarf's edge)
 */
import { fingersDeg, type FingerPose } from "../people3d";

type J = [number, number, number];
interface HandDef { thumb: J; index: J; middle: J; ring: J; little: J; thumbSwing: number; grip: "palm" | "pinch" }

const DEFS = {
  /** Hanging at his side or resting on a desk: a loose curl. */
  relaxed: { thumb: [5, 10, 8], index: [10, 16, 9], middle: [13, 19, 11], ring: [15, 21, 12], little: [17, 23, 14], thumbSwing: 8, grip: "palm" },
  /** Open, fingers together, a little life in them. */
  open: { thumb: [0, 0, 0], index: [4, 6, 4], middle: [5, 7, 5], ring: [7, 9, 6], little: [9, 11, 8], thumbSwing: -12, grip: "palm" },
  /** Flat (on paper, on a table, a pat on the back). */
  flat: { thumb: [0, 5, 5], index: [3, 5, 3], middle: [3, 5, 3], ring: [4, 6, 4], little: [5, 7, 5], thumbSwing: 0, grip: "palm" },
  /** A wave: open and spread, thumb out. */
  wave: { thumb: [-6, -4, 0], index: [0, 2, 2], middle: [0, 2, 2], ring: [2, 4, 3], little: [4, 6, 4], thumbSwing: -24, grip: "palm" },
  /** A closed fist, thumb over the middle fingers. */
  fist: { thumb: [28, 38, 30], index: [82, 98, 62], middle: [86, 100, 62], ring: [88, 100, 60], little: [90, 98, 58], thumbSwing: 48, grip: "palm" },
  /** Pointing with the index finger. */
  point: { thumb: [22, 32, 26], index: [2, 3, 2], middle: [84, 100, 62], ring: [88, 100, 60], little: [90, 98, 58], thumbSwing: 40, grip: "palm" },
  /** Thumbs up: a fist, thumb straight. */
  thumbsUp: { thumb: [-8, -6, -2], index: [84, 98, 62], middle: [88, 100, 62], ring: [90, 100, 60], little: [92, 98, 58], thumbSwing: -10, grip: "palm" },
  /** Holding a pen to write (tripod): index and thumb pinch, the others tuck under. */
  pen: { thumb: [10, 5, 5], index: [35, 45, 20], middle: [45, 58, 30], ring: [65, 80, 45], little: [72, 85, 50], thumbSwing: 20, grip: "pinch" },
  /** Round a cup handle, a trophy's stem, a bottle (≈ 4–5 cm across). */
  cup: { thumb: [16, 26, 20], index: [46, 52, 32], middle: [50, 56, 34], ring: [52, 58, 34], little: [55, 60, 36], thumbSwing: 42, grip: "palm" },
  /** A microphone or a rail (tighter than a cup). */
  mic: { thumb: [22, 34, 26], index: [62, 70, 42], middle: [66, 74, 44], ring: [68, 76, 44], little: [70, 78, 46], thumbSwing: 46, grip: "palm" },
  /** A phone held to look at (fingers behind it, thumb on the front). */
  phone: { thumb: [6, 14, 10], index: [30, 30, 18], middle: [34, 34, 20], ring: [38, 38, 22], little: [42, 42, 24], thumbSwing: 10, grip: "palm" },
  /** The handshake: fingers round the other man's hand, thumb over his. */
  shake: { thumb: [0, 12, 15], index: [25, 55, 35], middle: [28, 58, 38], ring: [30, 60, 40], little: [32, 62, 42], thumbSwing: 15, grip: "palm" },
  /** Pinching cloth (a shirt's shoulder seam, a scarf): thumb on the front, fingers behind. */
  pinch: { thumb: [6, 16, 18], index: [34, 40, 26], middle: [44, 56, 34], ring: [54, 66, 40], little: [60, 72, 44], thumbSwing: 30, grip: "pinch" },
  /** Clapping: flat, a little cupped. */
  applause: { thumb: [0, 6, 6], index: [8, 12, 8], middle: [9, 13, 9], ring: [10, 14, 10], little: [12, 16, 10], thumbSwing: 6, grip: "palm" },
  /** Both hands on a ball: spread and curved. */
  ball: { thumb: [0, 8, 8], index: [18, 22, 14], middle: [20, 24, 15], ring: [22, 26, 16], little: [24, 28, 16], thumbSwing: -8, grip: "palm" },
  /** A fist pumped (tighter, thumb in front). */
  pump: { thumb: [30, 44, 34], index: [88, 104, 66], middle: [92, 104, 66], ring: [94, 104, 64], little: [96, 102, 62], thumbSwing: 52, grip: "palm" },
} satisfies Record<string, HandDef>;

export type HandPoseName = keyof typeof DEFS;
export const HAND_POSE_NAMES = Object.keys(DEFS) as HandPoseName[];

/** A named pose as finger bends (radians). */
export function handPose(name: HandPoseName): FingerPose {
  const d = DEFS[name];
  return fingersDeg({ thumb: d.thumb, index: d.index, middle: d.middle, ring: d.ring, little: d.little, thumbSwing: d.thumbSwing });
}

/** Where a held thing sits in this pose's hand. */
export function gripKind(name: HandPoseName): "palm" | "pinch" { return DEFS[name].grip; }
