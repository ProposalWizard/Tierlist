/**
 * lib/motionRefs.ts — THE LIST OF MOTION REFERENCES (Harry, 20 Oct 2026: "you
 * should be able to see what I mean and compare it to the real movement, the
 * real look of a person"). The page /admin/motion-refs and any later tool that
 * compares our movement with these clips read this one list.
 *
 * Files live in public/admin/motion-refs/:
 *   hq/<scene>.mp4 + hq/<scene>.jpg   best round: the clip and its 720-px start picture
 *   r1/<scene>.mp4                    first round: the clip
 *   game/<name>.jpg                   a still of our game, the thing the clip was made from
 *   ours/<scene>.mp4                  OUR rebuilt clip of the same scene (empty on purpose:
 *                                     the movement builder drops clips here, same scene name)
 *
 * All clips are 9:16, 480-540 px wide, no sound. All faces are invented.
 * Left out on purpose: the first-round "handshake" (a small dark mark on the
 * shirt that looks like a brand logo). The best-round handshake is shown.
 */

export type MotionRound = "hq" | "r1";

export interface MotionRef {
  /** Scene name. Also the file name of OUR clip in ours/. */
  scene: string;
  /** Shown on the card. */
  title: string;
  round: MotionRound;
  /** One short line: what the person does. */
  what: string;
  /** One of the five scenes that set the standard. */
  base: boolean;
  video: string;
  /** The picture the clip starts from (best round only). */
  start?: string;
  /** A still of our game this scene comes from. */
  game?: string;
  /** Said when the game still is not the exact scene. */
  gameNote?: string;
}

export const MOTION_BASE = "/admin/motion-refs";
export const oursUrl = (scene: string) => `${MOTION_BASE}/ours/${scene}.mp4`;

export const ROUND_NAME: Record<MotionRound, string> = {
  hq: "HQ round",
  r1: "First round",
};
export const ROUND_RECIPE: Record<MotionRound, string> = {
  hq: "Nano Banana Pro 4K picture, then Seedance 2.5 video",
  r1: "GPT Image 2.5 picture, then Kling 3.0 video",
};

/** The five scenes that set the standard. They come first. */
export const BASE_SCENES = ["handshake", "trophy-lift", "goal-celebration", "walkout", "press-answer"] as const;

const hq = (scene: string, title: string, what: string, game?: string, gameNote?: string): MotionRef => ({
  scene, title, what, round: "hq", base: (BASE_SCENES as readonly string[]).includes(scene),
  video: `${MOTION_BASE}/hq/${scene}.mp4`, start: `${MOTION_BASE}/hq/${scene}.jpg`,
  game: game ? `${MOTION_BASE}/game/${game}.jpg` : undefined, gameNote,
});
const r1 = (scene: string, title: string, what: string, game: string, gameNote?: string): MotionRef => ({
  scene, title, what, round: "r1", base: false,
  video: `${MOTION_BASE}/r1/${scene}.mp4`, game: `${MOTION_BASE}/game/${game}.jpg`, gameNote,
});

const MADE_FROM_FAREWELL = "Made from the farewell still";

export const MOTION_REFS: MotionRef[] = [
  // HQ round, base standard first
  hq("handshake", "Handshake (signing)", "Both stand, clasp, pump the hand, pat on the arm.", "handshake"),
  hq("trophy-lift", "Trophy lift", "Lifts the trophy, roars, lowers it. The top leaves the frame when it is held high.", "trophy-lift"),
  hq("goal-celebration", "Goal celebration", "Arms wide, fists, a rock on the knees.", "goal-celebration"),
  hq("walkout", "Walk-out", "Walks to the camera. The boots touch the bottom edge at the end.", "walkout"),
  hq("press-answer", "Press answer", "Answers with his hands, leans in. Small in the frame.", "press-answer"),
  // HQ round, the rest
  hq("shirt-photo", "Shirt photo (signing)", "Small movement only: a shoulder squeeze and a laugh.", "shirt-photo"),
  hq("farewell", "Farewell", "Wave, a nod, claps between the lines.", "farewell"),
  hq("greeting", "Greeting", "Clasp, hug, back pats, then they break.", "farewell", MADE_FROM_FAREWELL),
  hq("mentor", "Mentor", "Talks, hand on the shoulder.", "mentor"),
  hq("home-idle", "Home idle", "Weight shift, shoulders, a tap of the ball. Home stadium.", "home-idle"),
  hq("jog-stop", "Jog and stop", "Jogs, slows down, stops with hands on hips. Home stadium.", "home-idle", "Same stadium, not the same moment"),
  hq("bench-chat", "Bench chat", "Two team-mates talk on the bench."),
  hq("walk-and-talk", "Walk and talk", "Walks and talks."),
  hq("trophy-grip", "Trophy grip", "Hands grip the handles, the trophy lifts off the plinth."),
  hq("talk-to-camera", "Talk to camera", "Gestures, counts on his fingers. The boots touch the bottom edge."),
  hq("garden-walk", "Garden walk", "Walks the brick path, looks at the stable, stops. The 3D garden.", "garden"),
  hq("garden-bench", "Garden bench", "Two team-mates chat, laugh, a tap on the knee. The 3D garden.", "garden", "The garden, not the bench"),
  hq("office-manager", "Manager's office", "Talks, points, open palms. The manager's office.", "office"),
  // First round (the handshake is left out, see the note at the top)
  r1("shirt-photo", "Shirt photo (signing)", "Lifts the No. 9 shirt, hand on his shoulder.", "shirt-photo"),
  r1("trophy-lift", "Trophy lift", "Looks at it, lifts it overhead, shakes it.", "trophy-lift"),
  r1("goal-celebration", "Goal celebration", "On his knees, arms wide, roar, arms up.", "goal-celebration"),
  r1("mentor", "Mentor", "Talks, hand on the shoulder, walks off.", "mentor"),
  r1("press-answer", "Press answer", "Answers with his hands.", "press-answer"),
  r1("walkout", "Walk-out", "Down the tunnel, arms swinging loose.", "walkout"),
  r1("farewell", "Farewell", "Through the guard of honour, waves, claps.", "farewell"),
  r1("home-idle", "Home idle", "Weight shifts, shakes his arms out, keepy-ups.", "home-idle"),
  r1("greeting", "Greeting", "Clasp, one-arm hug, back pats.", "farewell", MADE_FROM_FAREWELL),
];

export type MotionView = "hq" | "r1" | "all";

/** The cards for a view. Base standard first, then the rest of the HQ round, then the first round. */
export function motionRefsFor(view: MotionView, list: MotionRef[] = MOTION_REFS): MotionRef[] {
  const rank = (m: MotionRef) => (m.round === "hq" ? (m.base ? 0 : 1) : 2);
  const shown = list.filter((m) => view === "all" || m.round === view);
  return shown
    .map((m, i) => ({ m, i }))
    .sort((a, b) => rank(a.m) - rank(b.m) || a.i - b.i)
    .map((x) => x.m);
}
