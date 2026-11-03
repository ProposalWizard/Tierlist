/**
 * WHERE THE REPLAY IS FILMED FROM — three real camera positions.
 *
 *  - "tv": the broadcast camera, high in the main stand level with the box,
 *    panning and zooming to keep the ball and the goal in shot.
 *  - "net": low behind the goal, looking out through the net — the angle a
 *    replay cuts to.
 *  - "fan": a phone held up in the end stand by the corner flag, portrait,
 *    a little shaky, shakier when it goes in.
 *  - "match": the main camera for a whole match (the full-match replay,
 *    /star-sim90-dev) — high in the main stand on the halfway line, panning
 *    to follow the ball the length of the pitch.
 *
 * Every camera is a function of the recording and the clip time only: no state
 * carried from frame to frame, no random numbers drawn at draw time. The same
 * recording filmed twice is the same film (the shake is a fixed wobble keyed
 * off the clip's id). The follow is a weighted average of where the ball is
 * over a short window, so the pan is smooth without any memory.
 */
import type { FpCamera } from "../firstPersonView";
import { CX, HALF_LEN, PITCH_W } from "../pitch";
import { frameAt, trackDuration, type GoalTrack } from "./track";
import type { StandId } from "./scene";

export type ClipAngle = "tv" | "net" | "fan" | "high" | "side" | "tight" | "match"
  // Better goal videos (Leo's switch part "betterVideos"): only cut to by makeEdit with that part on.
  | "reverse" | "strike" | "follow" | "spider" | "fanSide" | "fanHigh";

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
  if (angle === "match") {
    // High and steep beside the play, following the ball along and across (a slow, wide follow so a pass
    // doesn't whip the picture round). Harry, 14 Oct 2026: "I don't love seeing the stadiums": steep enough
    // (about 50° down) and moved with the ball so the frame stays on the pitch, never the stands.
    const ball = smoothBall(track, t, -1.6, 1.0, 10);
    const target = { x: Math.max(10, Math.min(42, ball.x * 0.7 + CX * 0.3)), y: Math.max(29, Math.min(HALF_LEN * 2 - 29, ball.y)), z: 0 };
    const pos = { x: target.x - 38, y: target.y, eye: 58 };
    const l = look(pos, target);
    const span = 46;
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (W * l.dist) / span, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"], // the fans and boards stay (Harry, 14 Oct 2026: only the big white roof was unwanted, and this view never shows one)
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
  if (angle === "high") {
    // The spider-cam: high up behind the man who scored, looking down the
    // line of the shot at the goal.
    const shotAt = frameAt(track, Math.max(0, track.strikeT)).ball;
    const ball = smoothBall(track, t, -0.4, 0.3);
    const back = { x: shotAt.x + (shotAt.x - CX) * 0.35, y: shotAt.y + 13 };
    const pos = { x: back.x, y: Math.max(16, back.y), eye: 12 };
    const target = mix({ ...ball, z: 0.6 }, { x: CX, y: 2, z: 1 }, 0.55);
    const l = look(pos, target);
    const span = Math.max(20, Math.min(34, Math.hypot(pos.x - CX, pos.y) * 0.75));
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (Math.max(W, H * 0.9) * l.dist) / span, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"],
    };
  }
  if (angle === "side") {
    // Low at the side of the six-yard box, at grass level, side-on to the
    // goal mouth: the keeper's dive across the picture.
    const ball = smoothBall(track, t, -0.3, 0.2);
    const left = frameAt(track, Math.max(0, track.strikeT)).ball.x < CX;
    const pos = { x: left ? CX + 23 : CX - 23, y: 7, eye: 3.2 };
    const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.5 + 0.6 }, { x: CX, y: 0.5, z: 1 }, 0.6);
    const l = look(pos, target);
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: Math.max(W, H * 0.9) * 1.6, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"],
    };
  }
  if (angle === "tight") {
    // The TV camera zoomed right in on the man who scored (the celebration).
    const pos = { x: -26, y: 19, eye: 14 };
    const si = track.bodies.findIndex(b => b.id === track.meta.scorerBody);
    const fr = frameAt(track, t);
    const who = si >= 0 ? fr.bodies[si] : fr.ball;
    const target = { x: who.x, y: who.y, z: 0.9 };
    const l = look(pos, target);
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (Math.max(W, H * 0.9) * l.dist) / 11, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"],
    };
  }
  if (angle === "reverse" || angle === "strike" || angle === "follow" || angle === "spider" || angle === "fanSide" || angle === "fanHigh") return betterRig(track, angle, t, W, H);
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

// ── Better goal videos (Leo's switch part "betterVideos", 31 Oct 2026) ──────
// New camera positions, cut to only by the better edits. The cameras above are
// unchanged. Same rules: a function of the recording and the clip time only.

/** Where the scorer is (or the ball, if the recording has no scorer). */
function scorerAt(track: GoalTrack, t: number): Pt {
  const si = track.bodies.findIndex(b => b.id === track.meta.scorerBody);
  const fr = frameAt(track, Math.max(0, Math.min(trackDuration(track), t)));
  const b = si >= 0 ? fr.bodies[si] : fr.ball;
  return { x: b.x, y: b.y, z: 0.9 };
}

/** A phone held up in the stand: drift, a jolt and a jump when it goes in,
 *  a pinch in on the strike. */
function handheld(track: GoalTrack, pos: { x: number; y: number; eye: number }, target: Pt, t: number, W: number, H: number, focal: number, skip: StandId[], k0: number): Rig {
  const id = track.meta.id;
  const l = look(pos, target);
  const since = t - track.goalT;
  const jolt = since > 0 ? Math.exp(-since * 1.2) : 0;
  const yaw = 0.008 * wobble(id, t, k0) + 0.035 * jolt * Math.sin(t * 12.3);
  const tilt = 0.007 * wobble(id, t, k0 + 3) + 0.03 * jolt * Math.sin(t * 8.9 + 1);
  const fwd = { x: l.forward.x * Math.cos(yaw) - l.forward.y * Math.sin(yaw), y: l.forward.x * Math.sin(yaw) + l.forward.y * Math.cos(yaw) };
  return {
    cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal, horizon: H * 0.5, forward: fwd, pitch: l.pitch + tilt },
    roll: 0.016 * wobble(id, t, k0 + 6) + 0.06 * jolt * Math.sin(t * 7.1 + 2),
    skip,
  };
}

function betterRig(track: GoalTrack, angle: "reverse" | "strike" | "follow" | "spider" | "fanSide" | "fanHigh", t: number, W: number, H: number): Rig {
  const goal: Pt = { x: CX, y: 1.5, z: 1.0 };
  const shotAt = frameAt(track, Math.max(0, track.strikeT)).ball;
  if (angle === "reverse") {
    // The reverse angle: the main camera's twin on the other touchline (the
    // picture is the TV's flipped left to right), a little tighter.
    const pos = { x: PITCH_W + 26, y: 19, eye: 14 };
    const ball = smoothBall(track, t, -0.45, 0.35);
    const toGoal = Math.hypot(ball.x - goal.x, ball.y - goal.y);
    const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.5 + 0.4 }, goal, Math.max(0.2, Math.min(0.45, 0.45 - toGoal / 80)));
    const l = look(pos, target);
    const span = Math.max(20, Math.min(40, toGoal * 0.85 + 15));
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (Math.max(W, H * 0.9) * l.dist) / span, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["far"],
    };
  }
  if (angle === "strike") {
    // The super slow-mo camera: low on the side of the man who strikes it,
    // tight on him and the ball, widening to follow the ball to the goal.
    const toGoal = { x: CX - shotAt.x, y: 0 - shotAt.y };
    const n = Math.max(1, Math.hypot(toGoal.x, toGoal.y));
    const dir = { x: toGoal.x / n, y: toGoal.y / n };
    // To the side of the shot nearer the main stand (x small), a little behind.
    let side = { x: -dir.y, y: dir.x };
    if (side.x > 0) side = { x: -side.x, y: -side.y };
    const pos = { x: shotAt.x + side.x * 16 - dir.x * 4, y: Math.max(4, shotAt.y + side.y * 16 - dir.y * 4), eye: 6.5 };
    const ball = smoothBall(track, t, -0.12, 0.12, 8);
    const scorer = scorerAt(track, t);
    const before = t < track.strikeT;
    const target = before ? mix({ ...ball, z: Math.min(ball.z, 2) * 0.6 + 0.3 }, scorer, 0.4) : { ...ball, z: Math.min(ball.z, 2.2) * 0.6 + 0.3 };
    const l = look(pos, target);
    const flew = Math.hypot(ball.x - shotAt.x, ball.y - shotAt.y);
    // Before the strike: wide enough for the man and the ball wherever he is.
    const gap = before ? Math.hypot(ball.x - scorer.x, ball.y - scorer.y) : 0;
    const span = Math.max(10, Math.min(26, 10 + flew * 0.8 + gap * 1.2));
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (Math.max(W, H * 0.9) * l.dist) / span, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"],
    };
  }
  if (angle === "follow") {
    // A tall picture that follows the ball (an editor's vertical crop of the
    // TV pictures): the main camera, framed on the ball with the goal near.
    const pos = { x: -26, y: 19, eye: 14 };
    const ball = smoothBall(track, t, -0.35, 0.3);
    const toGoal = Math.hypot(ball.x - goal.x, ball.y - goal.y);
    const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.5 + 0.4 }, goal, Math.max(0.05, Math.min(0.25, 0.25 - toGoal / 120)));
    const l = look(pos, target);
    const span = Math.max(13, Math.min(22, toGoal * 0.35 + 11));
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (W * l.dist) / span, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"],
    };
  }
  if (angle === "spider") {
    // The spider-cam, flown: high behind the man who scored, looking down the
    // line of the shot, far enough back that the ball at his feet and the
    // goal are both in the picture.
    const ball = smoothBall(track, t, -0.35, 0.3);
    const back = { x: shotAt.x + (shotAt.x - CX) * 0.3, y: shotAt.y + 19 };
    const pos = { x: back.x, y: Math.max(22, back.y), eye: 17 };
    const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.5 + 0.3 }, { x: CX, y: 2, z: 1 }, 0.35);
    const l = look(pos, target);
    const span = Math.max(24, Math.min(40, Math.hypot(pos.x - CX, pos.y) * 0.8));
    return {
      cam: { x: pos.x, y: pos.y, eye: pos.eye, W, H, focal: (Math.max(W, H * 0.9) * l.dist) / span, horizon: H * 0.5, forward: l.forward, pitch: l.pitch },
      roll: 0,
      skip: ["near"],
    };
  }
  if (angle === "fanSide") {
    // A phone low in the side stand near the corner flag.
    const pos = { x: -9, y: 15, eye: 5.5 };
    const ball = smoothBall(track, t, -0.45, 0.1);
    const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.5 + 0.5 }, goal, 0.38);
    return handheld(track, pos, target, t, W, H, W * 1.55, ["near"], 9);
  }
  // A phone high in the upper tier behind the goal, off to one side.
  const pos = { x: CX - 9, y: -26, eye: 19 };
  const ball = smoothBall(track, t, -0.45, 0.1);
  const target = mix({ ...ball, z: Math.min(ball.z, 2) * 0.4 + 0.3 }, goal, 0.3);
  return handheld(track, pos, target, t, W, H, W * 2.4, ["end"], 13);
}
