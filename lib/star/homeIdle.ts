/**
 * THE HOME PLAYER'S LIFE (B5, Harry 20 Oct 2026: "players obviously have poses
 * on the home screen, looking natural and real and energetic, with their eyes
 * maybe blinking and looking around and talking, maybe slightly moving their
 * lips and holding things properly").
 *
 * What he does while you look at Home, from t alone (the same second, the same
 * pose), on a 33-second round, all from the game's own move files:
 *   idle → keepy-uppies (football.glb juggle, his own ball) → idle → a few words
 *   (mocap talk, the lips moving) → idle → a quad stretch (football.glb stretch)
 * Each change blends over HOME_IDLE_FADE seconds. Between, the eyes wander and
 * blink (toon/face.ts), and his weight shifts.
 * Pure (no three.js): tests/star/homeIdle.mts.
 */
export const HOME_IDLE_FADE = 0.45;
/** His ball at rest: by his right foot, a little ahead (his frame: x his left, y up, z ahead; metres). */
export const HOME_BALL_REST: [number, number, number] = [-0.24, 0.11, 0.3];

export interface HomeIdleBeat {
  /** The move (a clip name). */
  clip: string;
  from: number;
  dur: number;
  /** A loop played round (its own length), else once. */
  loop?: number;
  /** The lips move. */
  talk?: boolean;
  /** His ball is kept up (the clip's measured touches). */
  ball?: boolean;
  /** How his face is (toon/face.ts names). */
  face: Record<string, number>;
}

export const HOME_IDLE_ROUND = 33;
export const HOME_IDLE_BEATS: HomeIdleBeat[] = [
  { clip: "idle", from: 0, dur: 6, face: { smile: 0.35 } },
  { clip: "juggle", from: 6, dur: 6, loop: 1.2, ball: true, face: { focused: 0.5, smile: 0.2 } },
  { clip: "idle", from: 12, dur: 6, face: { proud: 0.5 } },
  { clip: "talk", from: 18, dur: 5, talk: true, face: { smile: 0.45 } },
  { clip: "idle", from: 23, dur: 4, face: { smile: 0.3 } },
  { clip: "stretch", from: 27, dur: 6, face: { determined: 0.35 } },
];

export interface HomeIdlePose {
  /** [clip, its time, weight] for poseClips; weights add to 1. */
  clips: [string, number, number][];
  /** The beat on now (and the one blending out, if any). */
  beat: HomeIdleBeat;
  /** How much of the standing idle is in the pose (0..1): the relaxed stance is laid on by this much. */
  idle: number;
  /** The ball: on his feet (juggled, 0..1 of the way) — 0 = at rest by his right foot. */
  juggle: number;
  /** Time in the juggle loop. */
  juggleT: number;
  /** The lips: 0..1 now. */
  talk: number;
  /** The face's named looks, blended. */
  face: Record<string, number>;
}

const beatAt = (tt: number) => HOME_IDLE_BEATS.find((b) => tt >= b.from && tt < b.from + b.dur) ?? HOME_IDLE_BEATS[0];

/** The clip time `s` seconds into a beat (looped, or held on its last frame). */
function clipTime(b: HomeIdleBeat, s: number, len: (clip: string) => number): number {
  const L = b.loop ?? len(b.clip);
  if (b.loop || b.clip === "idle") return ((s % L) + L) % L;
  return Math.min(Math.max(0, s), Math.max(0, L - 1e-3));
}

/**
 * The pose at t. `has(clip)` says which moves this body has (a missing one
 * plays the standing idle instead); `len(clip)` a move's length.
 */
export function homeIdleAt(t: number, has: (clip: string) => boolean, len: (clip: string) => number): HomeIdlePose {
  const tt = ((t % HOME_IDLE_ROUND) + HOME_IDLE_ROUND) % HOME_IDLE_ROUND;
  const b = beatAt(tt);
  const i = HOME_IDLE_BEATS.indexOf(b);
  const prev = HOME_IDLE_BEATS[(i + HOME_IDLE_BEATS.length - 1) % HOME_IDLE_BEATS.length];
  const into = tt - b.from;
  const k = Math.min(1, into / HOME_IDLE_FADE);
  const w = k * k * (3 - 2 * k);
  const ok = (x: HomeIdleBeat) => (has(x.clip) ? x : { ...x, clip: "idle", loop: undefined, ball: false, talk: x.talk });
  const cur = ok(b), old = ok(prev);
  const clips: [string, number, number][] = [];
  const add = (clip: string, time: number, wt: number) => {
    if (wt <= 1e-4) return;
    const same = clips.find((c) => c[0] === clip);
    if (same) { same[2] += wt; return; }
    clips.push([clip, time, wt]);
  };
  // the standing idle runs on its own clock, so blending in and out of it never jumps
  const idleT = clipTime({ clip: "idle", from: 0, dur: 0, face: {} }, tt, len);
  add(cur.clip, cur.clip === "idle" ? idleT : clipTime(cur, into, len), w);
  add(old.clip, old.clip === "idle" ? idleT : clipTime(old, old.dur + into, len), 1 - w);
  const idle = clips.filter((c) => c[0] === "idle").reduce((a, c) => a + c[2], 0);
  // the ball: up into the juggle over the fade, back down as it ends
  let juggle = 0;
  if (cur.ball) juggle = w;
  else if (old.ball) juggle = 1 - w;
  const jb = cur.ball ? cur : old.ball ? old : null;
  const juggleT = jb ? ((((cur.ball ? into : old.dur + into) % (jb.loop ?? 1.2)) + (jb.loop ?? 1.2)) % (jb.loop ?? 1.2)) : 0;
  // talking: syllables, quieter at the ends of the beat
  const talkOn = (cur.talk ? w : 0) + (old.talk ? 1 - w : 0);
  const end = cur.talk ? Math.min(1, (b.dur - into) / 0.6) : 1;
  const talk = talkOn * end * (0.25 + 0.75 * Math.abs(Math.sin(tt * 10.7) * Math.sin(tt * 3.9 + 0.7)));
  const face: Record<string, number> = {};
  for (const [n, x] of Object.entries(b.face)) face[n] = (face[n] ?? 0) + x * w;
  for (const [n, x] of Object.entries(prev.face)) face[n] = (face[n] ?? 0) + x * (1 - w);
  return { clips, beat: b, idle, juggle, juggleT, talk, face };
}

/** His weight from foot to foot while he stands: the hips' sideways sway (metres), slow and uneven. */
export function homeSway(t: number): number {
  return 0.012 * Math.sin(t * 0.47) + 0.006 * Math.sin(t * 1.13 + 1.3);
}
