/**
 * BETTER GOAL VIDEOS — HOW THE PICTURE IS FRAMED (switch part "betterVideos").
 *
 * The camera (cameras.ts) films the recording; a better edit then zooms the
 * picture digitally (a TikTok zoom punch, a fan pinching in) and shakes it
 * (the goal). This works out that zoom and shake for one moment, as plain
 * numbers, so the drawing (betterRender.ts) and the tests (the ball stays in
 * the picture) use the very same sums. Pure: no canvas, no state.
 */
import { project } from "../firstPersonView";
import { rigFor, smoothBall } from "./cameras";
import { frameAt, type GoalTrack } from "./track";
import type { Edit, EditMoment, Shot } from "./edit";

export interface View {
  /** Zoom (1 = none) about the anchor (ax, ay), then moved by (dx, dy), pixels. */
  k: number;
  ax: number;
  ay: number;
  dx: number;
  dy: number;
}

const ease = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The zoom on a shot `into` seconds in. */
export function zoomOf(shot: Shot, into: number): number {
  const z = shot.fx?.zoom;
  if (!z) return 1;
  return z.from + (z.to - z.from) * ease(z.over > 0 ? into / z.over : 1);
}

/** The shake, pixels, at clip time `t`: strong at the goal, gone in about a second. */
export function shakeOf(shot: Shot, t: number, W: number, seed: string): { x: number; y: number } {
  const at = shot.fx?.shakeAt;
  if (at === undefined || t < at) return { x: 0, y: 0 };
  const since = t - at;
  const amp = W * 0.018 * Math.exp(-since * 3.2);
  if (amp < 0.2) return { x: 0, y: 0 };
  const ph = (hash(seed) % 1000) / 1000 * Math.PI * 2;
  return { x: amp * Math.sin(since * 47 + ph), y: amp * 0.8 * Math.sin(since * 39 + ph * 1.7 + 1) };
}

/** The point the zoom holds still: where the ball is on the picture (smoothed,
 *  so a zoom never twitches), kept off the very edges. */
export function anchorOf(track: GoalTrack, shot: Shot, t: number, W: number, H: number): { x: number; y: number } {
  const rig = rigFor(track, shot.angle, t, W, H);
  const b = shot.angle === "tight" ? frameAt(track, t).ball : smoothBall(track, t, -0.1, 0.1, 6);
  const p = project(rig.cam, b.x, b.y, b.z);
  if (!p) return { x: W / 2, y: H / 2 };
  // On the ball itself, so a zoom never pushes it out; only kept off the very
  // edges, where a shake would need a big zoom to hide them.
  return { x: Math.max(W * 0.08, Math.min(W * 0.92, p.px)), y: Math.max(H * 0.08, Math.min(H * 0.92, p.py)) };
}

/** The whole framing at one moment of a better edit. */
export function viewAt(edit: Edit, m: EditMoment): View {
  const shot = edit.shots[m.shot];
  const track = shot ? edit.tracks[shot.track] : undefined;
  if (!shot || !track) return { k: 1, ax: 0, ay: 0, dx: 0, dy: 0 };
  let k = zoomOf(shot, m.intoShot);
  const sh = shakeOf(shot, m.t, edit.w, `${track.meta.id}|${edit.variant}`);
  if (k === 1 && !sh.x && !sh.y) return { k: 1, ax: 0, ay: 0, dx: 0, dy: 0 };
  const a = anchorOf(track, shot, m.t, edit.w, edit.h);
  // A shaking picture is made just big enough that its edges never show.
  if (sh.x || sh.y) {
    const room = Math.min(a.x, edit.w - a.x, a.y, edit.h - a.y);
    k = Math.max(k, Math.min(1.35, 1 + (Math.hypot(sh.x, sh.y) + 2) / Math.max(1, room)));
  }
  return { k, ax: a.x, ay: a.y, dx: sh.x, dy: sh.y };
}

/** Where a camera-picture point ends up after the view. */
export function applyView(v: View, px: number, py: number): { x: number; y: number } {
  return { x: v.ax + v.dx + (px - v.ax) * v.k, y: v.ay + v.dy + (py - v.ay) * v.k };
}
