/**
 * CAMERA OPTIONS FOR THE FIRST-PERSON DRIBBLE — dials only.
 *
 * Harry, 28 Sep 2026: "a huge mode that could use this 3d stuff is the
 * dribbling mode with a camera reframe, could be much improved". Three
 * reframes to pick between, beside today's:
 *
 *   C1 "Skill cam"  low and close, over the shoulder, leaning to whichever
 *                   side the ball is on so it is always in open grass in
 *                   front of your boots — never on your legs.
 *   C2 "Broadcast"  high and behind: you are smaller, and you see every
 *                   defender's shape coming.
 *   C3 "Dynamic"    C1 when a defender is close, easing back to a higher,
 *                   wider view in open space.
 *
 * None of them touches the run: the same defenders, the same timings, the
 * same controls (firstPersonDribble.ts never reads any of this). What moves
 * is where the camera sits, and how far ahead of your boots the carried
 * ball is DRAWN (`lead`) — the ball is a picture here, the sim never reads
 * its position either.
 *
 * Measured (reasoned through the real project() / cameraFor(), not filmed —
 * scripts in the 28 Sep round): with today's camera the ball at rest sits
 * ON your legs (22 px inside the body at phone size) and overlaps your body
 * in 12 of 42 touch positions. C1 overlaps in 0 of 42 (5 px clear at rest);
 * C2 in 0 of 42; C3 in 0 near a defender and 2 in open space.
 */

export type DribbleCamera = "today" | "C1" | "C2" | "C3";

export const DRIBBLE_CAMERAS: { id: DribbleCamera; label: string; blurb: string }[] = [
  { id: "today", label: "Today", blurb: "The camera the game uses now." },
  { id: "C1", label: "C1 Skill cam", blurb: "Low and close over the shoulder; the ball always in front of your boots." },
  { id: "C2", label: "C2 Broadcast", blurb: "High and behind; see every defender's shape coming." },
  { id: "C3", label: "C3 Dynamic", blurb: "Closes in when a defender is near, pulls back in open space." },
];

export interface CamPose {
  /** Camera height, m. */
  eye: number;
  /** Tilt down, degrees. */
  pitchDeg: number;
  /** How far behind you, m. */
  offset: number;
  /** How far to the side the camera leans, m — towards the ball's side. */
  side: number;
  /** How far ahead of your boots the ball is drawn at rest, m. */
  lead: number;
  /** The camera aims at the point this far ahead of you (m), so a camera
   *  leaning to the side still has you in frame rather than at its edge.
   *  0 = looks straight down the pitch (today's camera). */
  look: number;
}

export const CAM_C1: CamPose = { eye: 2.4, pitchDeg: 15, offset: 2.8, side: 1.3, lead: 1.6, look: 4 };
export const CAM_C2: CamPose = { eye: 8, pitchDeg: 26, offset: 5, side: 0, lead: 1.7, look: 0 };
/** C3's pulled-back end (its close end is C1). */
export const CAM_C3_FAR: CamPose = { eye: 6.5, pitchDeg: 30, offset: 4.6, side: 0.6, lead: 1.7, look: 5 };

/** Between two poses, t = 0 → a, 1 → b. */
export function blendPose(a: CamPose, b: CamPose, t: number): CamPose {
  const k = Math.max(0, Math.min(1, t));
  const m = (x: number, y: number) => x + (y - x) * k;
  return { eye: m(a.eye, b.eye), pitchDeg: m(a.pitchDeg, b.pitchDeg), offset: m(a.offset, b.offset), side: m(a.side, b.side), lead: m(a.lead, b.lead), look: m(a.look, b.look) };
}

/**
 * C3: how "close" the camera should be (1 = C1, 0 = pulled back) for the
 * nearest live defender `dist` metres ahead. Near inside 5 m, fully back
 * beyond 12 m.
 */
export function closeness(dist: number): number {
  if (!Number.isFinite(dist)) return 0;
  return Math.max(0, Math.min(1, (12 - dist) / 7));
}

/** The pose for a preset (C3 needs its current closeness). */
export function poseFor(cam: Exclude<DribbleCamera, "today">, close = 0): CamPose {
  if (cam === "C1") return CAM_C1;
  if (cam === "C2") return CAM_C2;
  return blendPose(CAM_C3_FAR, CAM_C1, close);
}
