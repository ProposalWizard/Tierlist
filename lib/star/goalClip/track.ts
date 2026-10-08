/**
 * A GOAL, RECORDED — every frame of it, exactly as it was played.
 *
 * Leo, 7 Oct 2026: "the goal replays should always be the same, not just
 * remaking the situation and letting it play again because randomness means
 * its not always a real replica of the goal."
 *
 * The old replay (GoalReplay, goalReplays.ts) kept the seed and the strike and
 * ran the physics again. Anything the seed does not cover — a frame that took
 * a little longer, the keeper's idle drift while you aimed — and the second
 * run is a different goal. So this does not simulate anything. While the real
 * match plays, CanvasMatch writes down where every man and the ball actually
 * were on every frame (recorder.ts). A replay draws those positions back. The
 * same recording gives the same video every time, from any camera.
 *
 * This file is the format: what a recording holds, how it packs small (16-bit
 * centimetres, about 15 KB a goal) and how a moment between two recorded
 * frames is read (straight-line in-between, so slow motion is smooth).
 * No canvas, no React, no physics.
 */
import type { SaveKind } from "../canvasEngine";

/** Frames a recording keeps per second. The match draws at the screen's rate;
 *  the recorder resamples to this. 30 is what a phone video plays at. */
export const CLIP_FPS = 30;

/** The track format's version. A reader refuses anything else rather than
 *  drawing nonsense. */
export const TRACK_VERSION = 1;

/** What a man is drawn as. */
export type ClipRole = "you" | "mate" | "opp" | "keeper";

export interface ClipKit {
  shirt: string;
  shorts: string;
  socks?: string;
}

/** One man in the recording. Fixed for the whole clip. */
export interface ClipBody {
  /** The id the match draws him under: "you", "follower", "run0", "mate0",
   *  "def0", "keeper". Kick and save events name him by this. */
  id: string;
  role: ClipRole;
  side: "us" | "them";
  /** His short name, when he has one. */
  name?: string;
  /** His photo (an http(s) or site path). Never a data: URL — your own
   *  photo is passed in at draw time instead (it can be 50 KB). */
  face?: string;
  kit: ClipKit;
}

export type ClipEventKind = "shot" | "pass" | "clearance" | "block" | "touch" | "save" | "post" | "goal";

/** Something a man did to the ball, at clip time `t` (seconds). */
export interface ClipEvent {
  t: number;
  kind: ClipEventKind;
  /** The body id of who did it. */
  who?: string;
  /** "ground" | "volley" | "header" | "chip" | "curl" for a strike. */
  mode?: string;
  /** For a save: "catch" | "parry" | "fumble" | "push" | "beaten". */
  save?: string;
}

/** About the goal: who, when, the match it was in. */
export interface ClipMeta {
  /** The clip's id — also on the match's GoalEvent, so a post can find it. */
  id: string;
  createdAt: string;
  /** Match minute (the commentary clock). */
  minute: number;
  /** As the scoreboard shows it: "63", "90+2". */
  minuteLabel: string;
  scorer: string;
  scorerShort: string;
  /** The body id of the scorer, when he is on the recording. */
  scorerBody?: string;
  isYou: boolean;
  assist?: string;
  /** How it was scored: the chance kind, or "rebound". */
  how?: string;
  home: string;
  away: string;
  youAreHome: boolean;
  /** The score after this goal went in, [home, away]. */
  scoreAfter?: [number, number];
  competition?: string;
  /** Weather drawn in the match: "rain", "snow", … or absent for clear. */
  weather?: string;
  /** Your career's season and week, so a reel can find a match's goals. */
  season?: number;
  week?: number;
}

export interface GoalTrack {
  v: typeof TRACK_VERSION;
  meta: ClipMeta;
  fps: number;
  bodies: ClipBody[];
  /** Packed frames — see FRAME LAYOUT below. */
  data: Int16Array;
  /** Frame count. */
  n: number;
  /** Clip seconds at which the ball crossed the goal line. */
  goalT: number;
  /** Clip seconds of the strike that scored. */
  strikeT: number;
  /** Clip seconds of the first kick of the move (yours, or the set-piece
   *  taker's). The lead-in starts a little before it. */
  firstKickT: number;
  events: ClipEvent[];
}

// ── FRAME LAYOUT ────────────────────────────────────────────────────────────
//
// One frame is `stride` 16-bit numbers:
//   ball x, y, z                                 (cm)
//   for each body, in `bodies` order: x, y, z    (cm; z is a wall's jump)
//   keeper: dive (cm), lunge (×1000), dirKind
// where dirKind = (saveDir + 1) + 3 × (index in SAVE_KINDS, or 0 for none).
// Pitch coordinates (lib/star/pitch.ts): x across 0–68 m, y up the pitch from
// the goal line (negative is behind it), z up. All of it fits in ±327 m.

/** Index 0 is "no save being played". */
export const SAVE_KINDS: (SaveKind | null)[] = [null, "catch", "central", "low", "high", "fingertip"];

export function frameStride(bodies: number): number {
  return 3 + 3 * bodies + 3;
}

export interface Pt3 { x: number; y: number; z: number }

export interface KeeperState {
  /** Signed lean/dive extension, metres (Keeper.dive). */
  dive: number;
  /** 0..1, how far into a save lunge he is (Keeper.saveLunge). */
  lunge: number;
  /** -1, 0 or +1: which way the save lunge goes (Keeper.saveDir). */
  dir: number;
  kind: SaveKind | null;
}

/** Everything drawn on one frame. */
export interface FrameState {
  ball: Pt3;
  bodies: Pt3[];
  keeper: KeeperState;
}

const cm = (m: number) => Math.max(-32767, Math.min(32767, Math.round(m * 100)));

/** Pack one frame's numbers (the recorder's job, kept here beside the reader). */
export function packFrame(f: FrameState, out: Int16Array, at: number): void {
  let i = at;
  out[i++] = cm(f.ball.x); out[i++] = cm(f.ball.y); out[i++] = cm(f.ball.z);
  for (const b of f.bodies) { out[i++] = cm(b.x); out[i++] = cm(b.y); out[i++] = cm(b.z); }
  out[i++] = cm(f.keeper.dive);
  out[i++] = Math.max(0, Math.min(32767, Math.round(f.keeper.lunge * 1000)));
  const k = Math.max(0, SAVE_KINDS.indexOf(f.keeper.kind));
  const d = f.keeper.dir > 0 ? 1 : f.keeper.dir < 0 ? -1 : 0;
  out[i++] = (d + 1) + 3 * k;
}

function readFrame(track: GoalTrack, frame: number): FrameState {
  const nb = track.bodies.length;
  const stride = frameStride(nb);
  const f = Math.max(0, Math.min(track.n - 1, frame));
  const d = track.data;
  let i = f * stride;
  const ball = { x: d[i++] / 100, y: d[i++] / 100, z: d[i++] / 100 };
  const bodies: Pt3[] = [];
  for (let b = 0; b < nb; b++) bodies.push({ x: d[i++] / 100, y: d[i++] / 100, z: d[i++] / 100 });
  const dive = d[i++] / 100;
  const lunge = d[i++] / 1000;
  const dk = d[i++];
  const dir = (dk % 3) - 1;
  const kind = SAVE_KINDS[Math.floor(dk / 3)] ?? null;
  return { ball, bodies, keeper: { dive, lunge, dir, kind } };
}

/** The clip's length in seconds. */
export function trackDuration(track: GoalTrack): number {
  return Math.max(0, (track.n - 1) / track.fps);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpPt = (a: Pt3, b: Pt3, k: number): Pt3 => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), z: lerp(a.z, b.z, k) });

/**
 * The picture at clip time `t` (seconds). Exactly a recorded frame when `t`
 * lands on one; a straight-line in-between otherwise, so a replay slowed to a
 * quarter of the speed is still smooth. The keeper's save kind and direction
 * are never blended — they come from the nearer frame.
 */
export function frameAt(track: GoalTrack, t: number): FrameState {
  const pos = Math.max(0, Math.min(track.n - 1, t * track.fps));
  const f0 = Math.floor(pos);
  const k = pos - f0;
  const a = readFrame(track, f0);
  if (k < 1e-6 || f0 >= track.n - 1) return a;
  const b = readFrame(track, f0 + 1);
  return {
    ball: lerpPt(a.ball, b.ball, k),
    bodies: a.bodies.map((p, i) => lerpPt(p, b.bodies[i], k)),
    keeper: {
      dive: lerp(a.keeper.dive, b.keeper.dive, k),
      lunge: lerp(a.keeper.lunge, b.keeper.lunge, k),
      dir: k < 0.5 ? a.keeper.dir : b.keeper.dir,
      kind: k < 0.5 ? a.keeper.kind : b.keeper.kind,
    },
  };
}

/** Where body `i` is heading at `t` (m/s), from the frames either side. */
export function bodyVelocity(track: GoalTrack, i: number, t: number): { vx: number; vy: number } {
  const h = 1 / track.fps;
  const a = frameAt(track, Math.max(0, t - h)).bodies[i];
  const b = frameAt(track, Math.min(trackDuration(track), t + h)).bodies[i];
  const span = Math.min(trackDuration(track), t + h) - Math.max(0, t - h);
  if (!a || !b || span <= 0) return { vx: 0, vy: 0 };
  return { vx: (b.x - a.x) / span, vy: (b.y - a.y) / span };
}

// ── Packing for storage ─────────────────────────────────────────────────────

function toBase64(bytes: Uint8Array): string {
  let s = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  return btoa(s);
}
function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** A recording as plain JSON (fixtures, tests, a copy you can paste). */
export interface StoredTrack extends Omit<GoalTrack, "data"> {
  /** Little-endian Int16 frames, base64. */
  data: string;
}

/** Int16 → bytes, always little-endian whatever the machine is. */
function int16ToBytes(a: Int16Array): Uint8Array {
  const out = new Uint8Array(a.length * 2);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < a.length; i++) dv.setInt16(i * 2, a[i], true);
  return out;
}
function bytesToInt16(b: Uint8Array): Int16Array {
  const out = new Int16Array(Math.floor(b.length / 2));
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < out.length; i++) out[i] = dv.getInt16(i * 2, true);
  return out;
}

export function trackToStored(t: GoalTrack): StoredTrack {
  return { ...t, data: toBase64(int16ToBytes(t.data)) };
}

/** Null for anything that is not a complete, current-version recording. */
export function trackFromStored(s: unknown): GoalTrack | null {
  if (!s || typeof s !== "object") return null;
  const o = s as StoredTrack;
  if (o.v !== TRACK_VERSION || typeof o.data !== "string" || !Array.isArray(o.bodies) || !o.meta) return null;
  let data: Int16Array;
  try { data = bytesToInt16(fromBase64(o.data)); } catch { return null; }
  const stride = frameStride(o.bodies.length);
  if (!(o.n > 0) || data.length !== stride * o.n || !(o.fps > 0)) return null;
  return { ...o, data };
}

/** About how many bytes a recording takes stored. */
export function trackBytes(t: GoalTrack): number {
  return t.data.length * 2 + JSON.stringify({ ...t, data: "" }).length;
}
