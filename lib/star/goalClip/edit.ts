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
import { makeBetterEdit, type EditOptions } from "./editBetter";
import { makeColdEdit, isColdStyle, type EditLook, type EditMusicCue, type BeatHit } from "./editCold";
export type { EditOptions } from "./editBetter";

export type ClipStyle = "broadcast" | "reverse" | "fan" | "tiktok"
  /** Better goal videos only (switch part "betterVideos"): every goal, quick cuts, a stats card. */
  | "highlights"
  /** Cold edits only (switch part "coldEdits", editCold.ts): beat-cut edit-page videos. */
  | "cold" | "aura" | "rewind" | "statCard" | "montage" | "angles";

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
  /** Better videos only: a still held this long (seconds) at `from` (a freeze
   *  frame, or the picture behind an end card). Absent: plays from → to. */
  hold?: number;
  /** Better videos only: what is laid over the picture (betterRender.ts). */
  fx?: ShotFx;
  /** Cold edits only: the shot plays backwards, from `to` down to `from`. */
  rewind?: true;
}

/**
 * The effects on a shot of a better video (Leo's switch part "betterVideos").
 * Times marked "clip" are recording seconds; the rest are seconds into the
 * shot as it plays. All pure numbers, the same every time.
 */
export interface ShotFx {
  /** A digital zoom about the ball: `from` → `to` over the first `over` s of the shot. */
  zoom?: { from: number; to: number; over: number };
  /** A white flash at this clip time. */
  flashAt?: number;
  /** A white flash as the shot starts (a flash cut). */
  flashCut?: boolean;
  /** The picture shakes from this clip time (the goal), dying away. */
  shakeAt?: number;
  /** A small label in the corner of a replay ("REVERSE ANGLE"). */
  label?: string;
  /** A full-picture card over a held still. */
  card?: "name" | "stats";
  /** Cold edits only (editCold.ts, drawn by coldRender.ts). */
  cold?: ColdFx;
}

/** What a cold edit lays over one shot. All data, so any renderer can draw it. */
export interface ColdFx {
  /** Dim the picture round the scorer and ring him (a freeze-frame call-out). */
  spotlight?: true;
  /** A small tag in the top bar: "◀◀ REWIND", "CAM 2", "0.5x". */
  tag?: string;
  /** "3/7": which goal of a montage. */
  counter?: string;
  /** The tape look (scan lines, tracking band) on a rewind. */
  vhs?: true;
  /** A card over the held picture: the stat card, the end title, the montage's opening title. */
  card?: "stat" | "end" | "title";
  /** The stat card's rows, revealed one a beat: [label, value]. */
  rows?: [string, string][];
  /** Title words on a "title"/"end" card. */
  title?: string;
  sub?: string;
}

/**
 * Which moves the men use: the newer 3D moves (a shot, a header, a one-handed
 * dive) or the older ones. Follows Settings → Look → Animations, so a video
 * looks like the match you played.
 */
export type ClipMoves = "new" | "old";

export interface Edit {
  style: ClipStyle;
  /** Better videos (switch part "betterVideos"): drawn by betterRender.ts.
   *  Absent with the part off, so an old edit is the same object as before. */
  better?: true;
  /** 2D goal videos (switch part "videos2d"): the picture is drawn top-down
   *  (render2d.ts) under the same cut and graphics. Absent with the part off. */
  flat?: true;
  /** Better videos: the colour of the captions and cards. */
  accent?: string;
  /** Which of the poster's cuts this is (an account always cuts its own way). */
  variant: number;
  moves: ClipMoves;
  w: number;
  h: number;
  fps: number;
  tracks: GoalTrack[];
  shots: Shot[];
  /** Cold edits only (switch part "coldEdits"): the picture's grade, the music
   *  and the hits on its beats. Absent on every other edit. */
  look?: EditLook;
  music?: EditMusicCue;
  hits?: BeatHit[];
}

/** Output sizes. Even numbers (the video encoders need them). */
export const WIDE = { w: 640, h: 360 };
export const TALL = { w: 360, h: 640 };
export const EDIT_FPS = 30;

/** Slow motion speed for a replay. */
export const REPLAY_RATE = 0.45;

export function replayWindow(t: GoalTrack): { from: number; to: number } {
  const dur = trackDuration(t);
  const from = Math.max(0, Math.min(t.strikeT - 0.8, t.goalT - 1.3));
  return { from, to: Math.min(dur, t.goalT + 0.7) };
}

/** A tighter window for a second replay: just the strike and the finish. */
export function closeWindow(t: GoalTrack): { from: number; to: number } {
  const dur = trackDuration(t);
  return { from: Math.max(0, Math.min(t.strikeT - 0.35, t.goalT - 0.8)), to: Math.min(dur, t.goalT + 0.45) };
}

/** A goal headed or volleyed in: its close replay runs this slow (headers piece 5,
 *  21 Oct 2026: "slow-motion for the 0.3 s before contact … replay in the goal video"). */
export const AIR_REPLAY_RATE = 0.3;

/** Was the goal's last strike a header or a volley (the recorded strike's own mode)? */
export function airFinish(t: GoalTrack): boolean {
  const strike = t.events.filter((e) => e.kind === "shot" && e.t <= t.goalT + 0.05).pop();
  return strike?.mode === "header" || strike?.mode === "volley";
}

/** Where a clip with your celebration cuts to the tight camera (a moment into your run), or null. */
export function celebCut(t: GoalTrack): number | null {
  const c = t.meta.celebration;
  if (!c) return null;
  const at = t.goalT + c.at + 0.7;
  return at < trackDuration(t) - 0.5 ? at : null;
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
export function makeEdit(tracks: GoalTrack[], style: ClipStyle, moves: ClipMoves = "old", variant = 0, opts?: EditOptions): Edit {
  // Cold edits: only ever asked for with the switch part "coldEdits" on (clipStyle.ts).
  if (isColdStyle(style)) return makeColdEdit(tracks, style, moves, variant, opts);
  if (opts?.better) return makeBetterEdit(tracks, style, moves, variant, opts);
  // A "highlights" cut asked for with the part off: the pages' cut, as before.
  if (style === "highlights") style = "reverse";
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
      if (dur > slowTo + 0.05) shots.push({ track: i, angle: celebCut(t) !== null ? "tight" : angle, from: slowTo, to: dur, rate: 1, replay: false, caption: TIKTOK_HIT[(v + i) % TIKTOK_HIT.length] });
    });
    shots.push(replay(last, "net", closeWindow(lt), 0.5, "ONE MORE TIME"));
    return base;
  }

  const live: ClipAngle = style === "broadcast" ? "tv" : style === "reverse" ? (v % 2 ? "high" : "net") : "fan";
  tracks.forEach((t, i) => {
    // Your celebration: once you wheel away, the TV camera goes tight on you (not the fan's phone).
    const cut = style === "fan" ? null : celebCut(t);
    if (cut === null) shots.push({ track: i, angle: live, from: 0, to: trackDuration(t), rate: 1, replay: false });
    else {
      shots.push({ track: i, angle: live, from: 0, to: cut, rate: 1, replay: false });
      shots.push({ track: i, angle: "tight", from: cut, to: trackDuration(t), rate: 1, replay: false });
    }
  });
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
  // A header or a volley: the close replay (the contact and the finish) slower still.
  if (airFinish(lt)) plan[1] = { ...plan[1], rate: Math.min(plan[1].rate, AIR_REPLAY_RATE) };
  // A reel keeps to one replay, so it stays short.
  shots.push(...(reel ? plan.slice(0, 1) : plan));
  return base;
}

const TIKTOK_OPEN = ["WAIT FOR IT", "WATCH THIS", "NO WAY HE TRIES THIS", "KEEP WATCHING"];
const TIKTOK_HIT = ["UNREAL", "HE DID THAT", "COLD", "ABSOLUTE SCENES", "DISGUSTING FINISH", "SIT DOWN KEEPER"];

export function shotLength(s: Shot): number {
  if (s.hold !== undefined) return Math.max(0, s.hold);
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
      return { shot: i, t: s.hold !== undefined ? s.from : s.rewind ? s.to - into * s.rate : s.from + into * s.rate, intoShot: into };
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
const STYLE_IN_NAME: Record<ClipStyle, string> = { broadcast: "TV", reverse: "Highlights", fan: "Fan-cam", tiktok: "Edit", highlights: "Reel",
  cold: "Cold-edit", aura: "Aura-edit", rewind: "Rewind", statCard: "Stat-card", montage: "Montage", angles: "Angles" };

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
