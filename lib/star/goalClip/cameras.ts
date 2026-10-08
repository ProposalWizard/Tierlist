/**
 * WHERE THE REPLAY IS FILMED FROM — three real camera positions.
 *
 *  - "tv": the broadcast camera, high in the main stand level with the box,
 *    panning and zooming to keep the ball and the goal in shot.
 *  - "net": low behind the goal, looking out through the net — the angle a
 *    replay cuts to.
 *  - "fan": a phone held up in the end stand by the corner flag, portrait,
 *    a little shaky, shakier when it goes in.
 *
 * Every camera is a function of the recording and the clip time only: no state
 * carried from frame to frame, no random numbers drawn at draw time. The same
 * recording filmed twice is the same film (the shake is a fixed wobble keyed
 * off the clip's id). The follow is a weighted average of where the ball is
 * over a short window, so the pan is smooth without any memory.
 */
import type { FpCamera } from "../firstPersonView";
import { CX, PITCH_W } from "../pitch";
import { frameAt, trackDuration, type GoalTrack } from "./track";
import type { StandId } from "./scene";

export type ClipAngle = "tv" | "net" | "fan";

export interface Rig {
  cam: FpCamera;
  /** Radians the picture is turned (a hand-held phone). */
  roll: number;
  /** Stands the camera sits in (not drawn). */
  skip: StandId[];
}

interface Pt { x: number; y: number; z: number }

/** Where the ball is, on average, from `t + back` to `t + ahead` (seconds,
 *  back negative), weighted to the middle. A camera operator's follow. */
export function smoothBall(track: GoalTrack, t: number, back: number, ahead: number, n = 12): Pt {
  const dur = trackDuration(track);
  let sx = 0, sy = 0, sz = 0, sw = 0;
  const mid = (back + ahead) / 2, half = Math.max(1e-3, (ahead - back) / 2);
  for (let i = 0; i <= n; i++) {
    const o = back + ((ahead - back) * i) / n;
    const tt = Math.max(0, Math.min(dur, t + o));
    const b = frameAt(track, tt).ball;
    const w = Math.exp(-(((o - mid) / half) ** 2) * 1.6);
    sx += b.x * w; sy += b.y * w; sz += b.z * w; sw += w;
  }
  return { x: sx / sw, y: sy / sw, z: sz / sw };
}

/** A fixed wobble from a few slow sines, phases taken from the clip's id. */
function wobble(seed: string, t: number, k: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const ph = (i: number) => (((h >>> (i * 5)) & 1023) / 1023) * Math.PI * 2;
  return Math.sin(t * 1.27 + ph(k)) + 0.6 * Math.sin(t * 2.91 + ph(k + 1)) + 0.3 * Math.sin(t * 7.73 + ph(k + 2));
}

function look(cam: { x: number; y: number; eye: number }, target: Pt): { forward: { x: number; y: number }; pitch: number; dist: number } {
  const dx = target.x - cam.x, dy = target.y - cam.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  return { forward: { x: dx / dist, y: dy / dist }, pitch: Math.atan2(cam.eye - target.z, dist), dist };
}

const mix = (a: Pt, b: Pt, k: number): Pt => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });

/** The camera for `angle` at clip time `t`, framing a W×H picture. */
export function rigFor(track: GoalTrack, angle: ClipAngle, t: number, W: number, H: number): Rig {
  const goal: Pt = { x: CX, y: 1.5, z: 1.0 };
  if (angle === "tv") {
    const pos = { x: -26, y: 19, eye: 14 };
    const ball = smoothBall(track, t, -0.5, 0.35);
    // Keep the goal in the picture as the ball comes in; follow the ball
    // further out.
    const toGoal = Math.hypot(ball.x - goal.x, ball.y - goal.y);
    const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.5 + 0.4 }, goal, Math.max(0.25, Math.min(0.5, 0.5 - toGoal / 80)));
    const l = look(pos, target);
    // How much pitch the picture spans across, metres, at the target.
    const span = Math.max(24, Math.min(46, toGoal * 0.9 + 18));
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (W * l.dist) / span, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"],
    };
  }
  if (angle === "net") {
    const ball = smoothBall(track, t, -0.35, 0.2);
    // Up on the first row behind the goal, over the boards, looking out.
    const pos = { x: CX + Math.max(-2.2, Math.min(2.2, (ball.x - CX) * 0.22)), y: -9, eye: 4.4 };
    const target = mix({ ...ball, z: Math.min(ball.z, 2.4) * 0.6 + 0.3 }, { x: CX, y: 12, z: 0.6 }, 0.35);
    const l = look(pos, target);
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: W * 0.82, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["end"],
    };
  }
  // A fan in the end stand by the corner, filming on a phone.
  const id = track.meta.id;
  const pos = { x: PITCH_W - 13, y: -12, eye: 8.5 };
  const ball = smoothBall(track, t, -0.45, 0.1);
  const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.5 + 0.5 }, goal, 0.42);
  const l = look(pos, target);
  // The hand: a slow drift, and a jolt when it goes in.
  const since = t - track.goalT;
  const jolt = since > 0 ? Math.exp(-since * 1.4) : 0;
  const yaw = 0.006 * wobble(id, t, 0) + 0.03 * jolt * Math.sin(t * 13.1);
  const tilt = 0.005 * wobble(id, t, 3) + 0.022 * jolt * Math.sin(t * 9.7 + 1);
  const fwd = { x: l.forward.x * Math.cos(yaw) - l.forward.y * Math.sin(yaw), y: l.forward.x * Math.sin(yaw) + l.forward.y * Math.cos(yaw) };
  // Zooms in a little on the strike, like a person pinching in.
  const zoom = 1 + 0.25 * Math.max(0, Math.min(1, (t - track.strikeT + 0.4) / 1.2));
  return {
    cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: W * 2.0 * zoom, horizon: H * 0.5, forward: fwd, pitch: l.pitch + tilt },
    roll: 0.012 * wobble(id, t, 6) + 0.05 * jolt * Math.sin(t * 7.3 + 2),
    skip: ["end"],
  };
}
