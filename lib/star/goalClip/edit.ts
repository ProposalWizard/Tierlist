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

export type ClipStyle = "broadcast" | "reverse" | "fan" | "tiktok";

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
  /** A big caption over this shot (the TikTok cut). */
  caption?: string;
}

/**
 * Which moves the men use: the newer 3D moves (a shot, a header, a one-handed
 * dive) or the older ones. Follows Settings → Look → Animations, so a video
 * looks like the match you played.
 */
export type ClipMoves = "new" | "old";

export interface Edit {
  style: ClipStyle;
  /** Which of the poster's cuts this is (an account always cuts its own way). */
  variant: number;
  moves: ClipMoves;
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
  const from = Math.max(0, Math.min(t.strikeT - 0.8, t.goalT - 1.3));
  return { from, to: Math.min(dur, t.goalT + 0.7) };
}

/** A tighter window for a second replay: just the strike and the finish. */
function closeWindow(t: GoalTrack): { from: number; to: number } {
  const dur = trackDuration(t);
  return { from: Math.max(0, Math.min(t.strikeT - 0.35, t.goalT - 0.8)), to: Math.min(dur, t.goalT + 0.45) };
}

const replay = (track: number, angle: ClipAngle, w: { from: number; to: number }, rate: number, caption?: string): Shot =>
  ({ track, angle, from: w.from, to: w.to, rate, replay: true, ...(caption ? { caption } : {}) });

/**
 * The cut, by who posts it. Every account has a few ways of cutting a goal
 * (`variant`, from its handle), so two clubs, or a club and a highlights page,
 * never post the same video:
 *  - broadcast: TV live, then two replays (behind the goal + the spider-cam;
 *    pitch-side low + behind the goal; spider-cam + behind the goal);
 *  - reverse: behind the goal live, TV slow; or the spider-cam live, pitch-side slow;
 *  - fan: the phone in the stand, as it happened;
 *  - tiktok: tall, slows right down for the strike, big captions, then once more.
 */
export function makeEdit(tracks: GoalTrack[], style: ClipStyle, moves: ClipMoves = "old", variant = 0): Edit {
  const size = style === "fan" || style === "tiktok" ? TALL : WIDE;
  const shots: Shot[] = [];
  const v = Math.abs(Math.floor(variant));
  const base = { style, variant: v, moves, ...size, fps: EDIT_FPS, tracks, shots };
  if (tracks.length === 0) return base;
  const last = tracks.length - 1;
  const lt = tracks[last];
  const reel = tracks.length > 1;

  if (style === "tiktok") {
    const angle: ClipAngle = (["high", "side", "tv"] as const)[v % 3];
    tracks.forEach((t, i) => {
      const dur = trackDuration(t);
      const slowFrom = Math.max(0, t.strikeT - 0.3);
      const slowTo = Math.min(dur, t.goalT + 0.25);
      if (slowFrom > 0.05) shots.push({ track: i, angle, from: 0, to: slowFrom, rate: 1, replay: false, caption: i === 0 ? TIKTOK_OPEN[v % TIKTOK_OPEN.length] : undefined });
      shots.push({ track: i, angle, from: slowFrom, to: slowTo, rate: 0.35, replay: false });
      if (dur > slowTo + 0.05) shots.push({ track: i, angle, from: slowTo, to: dur, rate: 1, replay: false, caption: TIKTOK_HIT[(v + i) % TIKTOK_HIT.length] });
    });
    shots.push(replay(last, "net", closeWindow(lt), 0.5, "ONE MORE TIME"));
    return base;
  }

  const live: ClipAngle = style === "broadcast" ? "tv" : style === "reverse" ? (v % 2 ? "high" : "net") : "fan";
  tracks.forEach((t, i) => shots.push({ track: i, angle: live, from: 0, to: trackDuration(t), rate: 1, replay: false }));
  if (style === "fan") return base;

  if (style === "reverse") {
    shots.push(replay(last, v % 2 ? "side" : "tv", replayWindow(lt), REPLAY_RATE));
    return base;
  }
  // Broadcast.
  const plan: Shot[] = [
    [replay(last, "net", replayWindow(lt), REPLAY_RATE), replay(last, "high", closeWindow(lt), 0.6)],
    [replay(last, "side", replayWindow(lt), 0.4), replay(last, "net", closeWindow(lt), 0.55)],
    [replay(last, "high", replayWindow(lt), 0.5), replay(last, "net", closeWindow(lt), 0.4)],
  ][v % 3];
  // A reel keeps to one replay, so it stays short.
  shots.push(...(reel ? plan.slice(0, 1) : plan));
  return base;
}

const TIKTOK_OPEN = ["WAIT FOR IT", "WATCH THIS", "NO WAY HE TRIES THIS", "KEEP WATCHING"];
const TIKTOK_HIT = ["UNREAL", "HE DID THAT", "COLD", "ABSOLUTE SCENES", "DISGUSTING FINISH", "SIT DOWN KEEPER"];

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
/** The camera, in a saved file's name, so the TV and the fan's video of the
 *  same goal are two files, not one file saved over the other. */
const STYLE_IN_NAME: Record<ClipStyle, string> = { broadcast: "TV", reverse: "Highlights", fan: "Fan-cam", tiktok: "Edit" };

export function clipFileName(tracks: GoalTrack | GoalTrack[], ext: string, style?: ClipStyle): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const list = Array.isArray(tracks) ? tracks : [tracks];
  const tr = list[0];
  const cam = style ? `-${STYLE_IN_NAME[style]}` : "";
  if (list.length === 1) {
    return `Goal-${clean(tr.meta.scorerShort || tr.meta.scorer)}-${clean(tr.meta.minuteLabel)}-${clean(tr.meta.home)}-v-${clean(tr.meta.away)}${cam}.${ext}`;
  }
  // A reel of several goals is named after the match, not its first goal.
  const oneMatch = list.every(t => t.meta.home === tr.meta.home && t.meta.away === tr.meta.away);
  return oneMatch
    ? `Highlights-${clean(tr.meta.home)}-v-${clean(tr.meta.away)}${cam}.${ext}`
    : `Highlights-${list.length}-goals${cam}.${ext}`;
}
