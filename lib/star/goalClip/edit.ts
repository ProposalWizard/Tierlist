/**
 * THE EDIT — which camera is on, when, and how fast, for each kind of post.
 *
 * Real football clips are cut the same few ways, so each account posts its
 * own kind:
 *  - "broadcast" (the club, the league): the TV camera live, then a slow
 *    replay from behind the goal. 16:9.
 *  - "reverse" (aggregators, stats pages, papers): behind the goal live, then
 *    the TV camera in slow motion. 16:9.
 *  - "fan" (fans, meme pages, team-mates): a phone in the stand, portrait.
 * A highlights reel is every goal of the match, live, in order, then the last
 * one again slowed down.
 *
 * Only clip times and rates live here — pure numbers, tested on their own.
 */
import { trackDuration, type GoalTrack } from "./track";
import type { ClipAngle } from "./cameras";

export type ClipStyle = "broadcast" | "reverse" | "fan";

export interface Shot {
  /** Which recording (index into Edit.tracks). */
  track: number;
  angle: ClipAngle;
  /** Clip seconds this shot plays from and to. */
  from: number;
  to: number;
  /** Playback speed: 1 live, below 1 slow motion. */
  rate: number;
  replay: boolean;
}

export interface Edit {
  style: ClipStyle;
  w: number;
  h: number;
  fps: number;
  tracks: GoalTrack[];
  shots: Shot[];
}

/** Output sizes. Even numbers (the video encoders need them). */
export const WIDE = { w: 640, h: 360 };
export const TALL = { w: 360, h: 640 };
export const EDIT_FPS = 30;

/** Slow motion speed for a replay. */
export const REPLAY_RATE = 0.45;

function replayWindow(t: GoalTrack): { from: number; to: number } {
  const dur = trackDuration(t);
  const from = Math.max(0, Math.min(t.strikeT - 0.45, t.goalT - 0.9));
  return { from, to: Math.min(dur, t.goalT + 0.85) };
}

export function makeEdit(tracks: GoalTrack[], style: ClipStyle): Edit {
  const size = style === "fan" ? TALL : WIDE;
  const shots: Shot[] = [];
  if (tracks.length === 0) return { style, ...size, fps: EDIT_FPS, tracks, shots };
  const live: ClipAngle = style === "broadcast" ? "tv" : style === "reverse" ? "net" : "fan";
  tracks.forEach((t, i) => shots.push({ track: i, angle: live, from: 0, to: trackDuration(t), rate: 1, replay: false }));
  if (style !== "fan") {
    const last = tracks.length - 1;
    const w = replayWindow(tracks[last]);
    shots.push({ track: last, angle: style === "broadcast" ? "net" : "tv", from: w.from, to: w.to, rate: REPLAY_RATE, replay: true });
  }
  return { style, ...size, fps: EDIT_FPS, tracks, shots };
}

export function shotLength(s: Shot): number {
  return Math.max(0, (s.to - s.from) / s.rate);
}

/** The finished video's length, seconds. */
export function editDuration(e: Edit): number {
  return e.shots.reduce((a, s) => a + shotLength(s), 0);
}

export function editFrameCount(e: Edit): number {
  return Math.max(1, Math.round(editDuration(e) * e.fps));
}

export interface EditMoment {
  shot: number;
  /** Clip time in that shot's recording. */
  t: number;
  /** Seconds since the shot started (for transitions). */
  intoShot: number;
}

/** What is on screen at video time `outT`. */
export function momentAt(e: Edit, outT: number): EditMoment {
  let acc = 0;
  for (let i = 0; i < e.shots.length; i++) {
    const s = e.shots[i];
    const len = shotLength(s);
    if (outT < acc + len || i === e.shots.length - 1) {
      const into = Math.max(0, Math.min(len, outT - acc));
      return { shot: i, t: s.from + into * s.rate, intoShot: into };
    }
    acc += len;
  }
  return { shot: 0, t: 0, intoShot: 0 };
}

/** The moment a still for the post is taken: the ball just about to go in,
 *  from the first shot's camera. */
export function posterMoment(e: Edit): EditMoment {
  const s = e.shots[0];
  const tr = e.tracks[s?.track ?? 0];
  if (!s || !tr) return { shot: 0, t: 0, intoShot: 0 };
  const t = Math.max(s.from, Math.min(s.to, tr.goalT - 0.12));
  return { shot: 0, t, intoShot: (t - s.from) / s.rate };
}

/** A file name a phone will keep: "Goal-Saka-63-ARS-v-CHE.mp4". */
export function clipFileName(tr: GoalTrack, ext: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Goal-${clean(tr.meta.scorerShort || tr.meta.scorer)}-${clean(tr.meta.minuteLabel)}-${clean(tr.meta.home)}-v-${clean(tr.meta.away)}.${ext}`;
}
