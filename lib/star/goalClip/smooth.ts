/**
 * SMOOTH GOAL VIDEOS — a real goal moves like the made-up ones.
 *
 * Leo, 30 Oct 2026: "i LOVE how you make fake goals look with real looking
 * movement and build up … for real goals u show it very rigid and stiff and
 * like move one then move two then standing still and shoot etc. should look
 * smooth like the fake goals."
 *
 * Why the real ones look stiff: the match plays a chance in stages. Everyone
 * stands while you aim, then men move one after another at a set jog, each
 * going from standing to full speed (and back) in a single frame, and when
 * the ball goes in the whole pitch stops dead. The recording (recorder.ts)
 * writes all of that down faithfully.
 *
 * This takes a recording and gives back a new one that is the SAME goal
 * (Leo, 7 Oct 2026: never re-run the chance). Nothing is simulated:
 *  1. Retime: a stretch where nothing at all moves (the wait while the shot
 *     was set up) is squeezed to a short beat. Every event, the strike and
 *     the goal move with it, so they stay on their own frames.
 *  2. Lead-in: a man who stands still at the start and then sets off was
 *     already on his way: he comes in along the line of his own first run,
 *     a little slower, onto the spot he was recorded on.
 *  3. Follow-through: a man who kicks it and then stands like a statue takes
 *     a few easy steps after the ball. After the scoring strike, a man who
 *     stops dead carries on and slows down instead.
 *  4. Ease: every outfield man's path is smoothed (a Gaussian over time), so
 *     he speeds up and slows down instead of jumping between a stand and a
 *     jog. Then he is pinned back, smoothly, onto his exact recorded spot at
 *     every touch, pass and shot he made, so each kick still meets the ball.
 *  Never changed: the ball (every frame exactly as played, only retimed), the
 *  keeper (his position, dive and save timing are tied to the ball) and a
 *  man in the air (his jump height).
 *
 * Pure: no canvas, no React, no random numbers. Same recording in, same
 * smooth recording out. Applied at the call site, behind Leo's update switch
 * ("smoothGoals", lib/star/leoUpdate.ts); with it off nothing here runs.
 */
import { frameAt, frameStride, packFrame, trackDuration, type FrameState, type GoalTrack, type Pt3 } from "./track";

/** A stretch where nothing moves is squeezed to this long (s). */
export const SMOOTH_HOLD_S = 0.25;
/** Below this speed (m/s) a man, or the ball, counts as standing still. */
const STILL_V = 0.3;
/** How far the ease reaches either side of a moment (s, Gaussian sigma). */
export const SMOOTH_SIGMA_S = 0.22;
/** How wide the pin back onto a recorded touch is (s, Gaussian sigma). */
const PIN_SIGMA_S = 0.3;
/** Lead-in: the share of his first speed a man comes in at, and the most he travels (m). */
const LEAD_SHARE = 0.7;
const LEAD_MAX_M = 2.2;
/** Follow-through after a kick: how far (m) and over how long (s). */
const FOLLOW_M = 1.1;
const FOLLOW_S = 1.0;
/** After the scoring strike, a man who stops dead slows down over this (s). */
const GLIDE_TAU_S = 0.35;

const smoother = (k: number) => { const c = Math.max(0, Math.min(1, k)); return c * c * c * (c * (c * 6 - 15) + 10); };

/** Did anything move between frame f-1 and f (bodies, ball, the keeper's dive)? */
function stillBetween(a: FrameState, b: FrameState, fps: number): boolean {
  const v = (p: Pt3, q: Pt3) => Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) * fps;
  if (v(a.ball, b.ball) > STILL_V) return false;
  for (let i = 0; i < a.bodies.length; i++) if (v(a.bodies[i], b.bodies[i]) > STILL_V) return false;
  if (Math.abs(b.keeper.dive - a.keeper.dive) * fps > STILL_V || Math.abs(b.keeper.lunge - a.keeper.lunge) > 1e-3) return false;
  return true;
}

/** Stretches (clip seconds) longer than `min` where nothing moves at all, before `until`. */
export function frozenStretches(track: GoalTrack, min = SMOOTH_HOLD_S, until = track.goalT): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  let start = -1;
  let prev = frameAt(track, 0);
  for (let f = 1; f < track.n; f++) {
    const cur = frameAt(track, f / track.fps);
    const still = stillBetween(prev, cur, track.fps) && f / track.fps <= until;
    if (still && start < 0) start = f - 1;
    if ((!still || f === track.n - 1) && start >= 0) {
      const end = still ? f : f - 1;
      if ((end - start) / track.fps > min + 1e-9) out.push({ from: start / track.fps, to: end / track.fps });
      start = -1;
    }
    prev = cur;
  }
  return out;
}

/** Old clip time ↔ new clip time, as matching knots (both rising). */
interface TimeMap { old: number[]; neu: number[] }

function timeMap(track: GoalTrack): TimeMap {
  const old = [0], neu = [0];
  let shift = 0;
  for (const s of frozenStretches(track)) {
    old.push(s.from); neu.push(s.from - shift);
    // A whole number of frames, so every moving frame still lands on a recorded one.
    shift += Math.round(((s.to - s.from) - SMOOTH_HOLD_S) * track.fps) / track.fps;
    old.push(s.to); neu.push(s.to - shift);
  }
  const dur = trackDuration(track);
  old.push(dur); neu.push(dur - shift);
  return { old, neu };
}

function through(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0] + (x - xs[0]);
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const span = xs[i] - xs[i - 1];
      return span <= 1e-9 ? ys[i] : ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / span;
    }
  }
  return ys[ys.length - 1] + (x - xs[xs.length - 1]);
}

const r3 = (t: number) => Math.round(t * 1000) / 1000;

/** Gaussian smoothing of one series, edges held. */
function gauss(src: Float64Array, sigmaFrames: number): Float64Array {
  const n = src.length;
  const out = new Float64Array(n);
  const R = Math.ceil(sigmaFrames * 3);
  const w: number[] = [];
  for (let k = -R; k <= R; k++) w.push(Math.exp(-(k * k) / (2 * sigmaFrames * sigmaFrames)));
  for (let f = 0; f < n; f++) {
    let s = 0, ws = 0;
    for (let k = -R; k <= R; k++) {
      const g = Math.max(0, Math.min(n - 1, f + k));
      s += src[g] * w[k + R]; ws += w[k + R];
    }
    out[f] = s / ws;
  }
  return out;
}

/** Solve a small linear system (Gaussian elimination, partial pivot). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / d;
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[n] / row[i]));
}

/**
 * The smooth recording of `track`: the same goal, retimed and eased.
 * Returns a new track; the one given is never changed.
 */
export function smoothTrack(track: GoalTrack): GoalTrack {
  const fps = track.fps;
  const dt = 1 / fps;
  const nb = track.bodies.length;
  const map = timeMap(track);
  const newDur = map.neu[map.neu.length - 1];
  const n = Math.max(1, Math.round(newDur * fps) + 1);
  const toNew = (t: number) => r3(through(map.old, map.neu, t));
  const toOld = (t: number) => through(map.neu, map.old, t);

  // 1. Retime: every frame read from the recording at its old time.
  const frames: FrameState[] = [];
  for (let f = 0; f < n; f++) frames.push(frameAt(track, Math.min(trackDuration(track), toOld(f * dt))));
  const events = track.events.map(e => ({ ...e, t: toNew(e.t) }));
  const goalT = toNew(track.goalT), strikeT = toNew(track.strikeT), firstKickT = toNew(track.firstKickT);
  const cel = track.meta.celebration;

  const xs = Array.from({ length: nb }, (_, i) => Float64Array.from(frames, fr => fr.bodies[i].x));
  const ys = Array.from({ length: nb }, (_, i) => Float64Array.from(frames, fr => fr.bodies[i].y));
  const speedAt = (i: number, f: number) => f <= 0 || f >= n ? 0 : Math.hypot(xs[i][f] - xs[i][f - 1], ys[i][f] - ys[i][f - 1]) * fps;
  const meanSpeed = (i: number, f0: number, f1: number) => {
    let s = 0, c = 0;
    for (let f = Math.max(1, f0); f <= Math.min(n - 1, f1); f++) { s += speedAt(i, f); c++; }
    return c ? s / c : 0;
  };

  const out: { x: Float64Array; y: Float64Array }[] = [];
  for (let i = 0; i < nb; i++) {
    const body = track.bodies[i];
    const rx = xs[i], ry = ys[i];
    if (body.role === "keeper") { out.push({ x: rx, y: ry }); continue; }
    const ox = new Float64Array(n), oy = new Float64Array(n);

    // 2. Lead-in: standing at the start, then off: he was already coming in.
    let fm = -1;
    for (let f = 2; f < n; f++) if (speedAt(i, f) > 0.8 && speedAt(i, f - 1) > 0.8) { fm = f - 2; break; }
    if (fm > 3) {
      const f2 = Math.min(n - 1, fm + 6);
      const dx = rx[f2] - rx[fm], dy = ry[f2] - ry[fm];
      const len = Math.hypot(dx, dy);
      const v0 = len / ((f2 - fm) * dt);
      if (len > 0.05) {
        const ux = dx / len, uy = dy / len;
        const v = Math.min(v0 * LEAD_SHARE, LEAD_MAX_M / (fm * dt));
        for (let f = 0; f < fm; f++) { const back = v * (fm - f) * dt; ox[f] -= ux * back; oy[f] -= uy * back; }
      }
    }

    // 3a. Follow-through: he kicks it and then stands still.
    for (const e of events) {
      if (e.who !== body.id || e.mode === "header" || (e.kind !== "shot" && e.kind !== "pass" && e.kind !== "clearance")) continue;
      const fe = Math.round(e.t * fps);
      if (fe < 0 || fe >= n - 2 || meanSpeed(i, fe + 1, fe + Math.round(0.6 * fps)) > 0.5) continue;
      // He has his own run later in the clip: leave him for it.
      if (cel && body.id === "you" && e.t > goalT) continue;
      const b0 = frames[fe].ball, b1 = frames[Math.min(n - 1, fe + 3)].ball;
      const len = Math.hypot(b1.x - b0.x, b1.y - b0.y);
      if (len < 0.05) continue;
      const ux = (b1.x - b0.x) / len, uy = (b1.y - b0.y) / len;
      // Until he sets off again on his own (if he does).
      let fEnd = n;
      for (let f = fe + 2; f < n; f++) if (speedAt(i, f) > 0.8) { fEnd = f; break; }
      for (let f = fe + 1; f < n; f++) {
        const k = smoother((f - fe) * dt / FOLLOW_S);
        // Once he moves again on his own, the step eases back out so his own run is untouched.
        const fade = f < fEnd ? 1 : 1 - smoother((f - fEnd) * dt / 0.4);
        ox[f] += ux * FOLLOW_M * k * fade; oy[f] += uy * FOLLOW_M * k * fade;
      }
    }

    // 3b. After the scoring strike: nobody stops dead, he slows down.
    const fs0 = Math.round(strikeT * fps);
    for (let f = Math.max(2, fs0); f < n - 1; f++) {
      if (speedAt(i, f - 1) < 1.2 || speedAt(i, f + 1) > STILL_V) continue;
      // He stays still from here to the end.
      if (meanSpeed(i, f + 1, n - 1) > STILL_V) continue;
      const vx = (rx[f - 1] - rx[f - 2]) * fps, vy = (ry[f - 1] - ry[f - 2]) * fps;
      for (let g = f; g < n; g++) {
        const k = 1 - Math.exp(-(g - f + 1) * dt / GLIDE_TAU_S);
        ox[g] += vx * GLIDE_TAU_S * k; oy[g] += vy * GLIDE_TAU_S * k;
      }
      break;
    }

    // 4. Ease the whole path.
    const sig = SMOOTH_SIGMA_S * fps;
    const sx = gauss(Float64Array.from(rx, (v, f) => v + ox[f]), sig);
    const sy = gauss(Float64Array.from(ry, (v, f) => v + oy[f]), sig);

    // Pinned to his exact spot at every ball moment that was his.
    const pins = Array.from(new Set(events.filter(e => e.who === body.id && e.kind !== "save").map(e => Math.max(0, Math.min(n - 1, Math.round(e.t * fps))))));
    if (pins.length) {
      const ps = PIN_SIGMA_S * fps;
      const phi = (d: number) => Math.exp(-(d * d) / (2 * ps * ps));
      const A = pins.map(a => pins.map(b => phi(a - b)));
      const cx = solve(A, pins.map(p => rx[p] - sx[p]));
      const cy = solve(A, pins.map(p => ry[p] - sy[p]));
      for (let f = 0; f < n; f++) {
        for (let k = 0; k < pins.length; k++) { const w = phi(f - pins[k]); sx[f] += cx[k] * w; sy[f] += cy[k] * w; }
      }
      for (const p of pins) { sx[p] = rx[p]; sy[p] = ry[p]; }
    }

    // Your celebration run is planned smooth already (celebration.ts): from it on, the recording as played.
    if (cel && body.id === "you") {
      const f0 = Math.round((goalT + cel.at) * fps);
      const blend = Math.round(0.3 * fps);
      for (let f = Math.max(0, f0 - blend); f < n; f++) {
        const w = f >= f0 ? 1 : smoother((f - (f0 - blend)) / blend);
        sx[f] = sx[f] * (1 - w) + rx[f] * w; sy[f] = sy[f] * (1 - w) + ry[f] * w;
      }
    }
    out.push({ x: sx, y: sy });
  }

  const data = new Int16Array(frameStride(nb) * n);
  for (let f = 0; f < n; f++) {
    const fr = frames[f];
    packFrame({
      ball: fr.ball,
      bodies: fr.bodies.map((p, i) => ({ x: out[i].x[f], y: out[i].y[f], z: p.z })),
      keeper: fr.keeper,
    }, data, f * frameStride(nb));
  }
  return { ...track, meta: { ...track.meta }, bodies: track.bodies.map(b => ({ ...b })), data, n, goalT, strikeT, firstKickT, events };
}

/** Made-up goals (synth.ts) are smooth already: only recordings are eased. */
export function smoothRecorded(tracks: GoalTrack[]): GoalTrack[] {
  return tracks.map(t => (t.meta.id.startsWith("synth-") ? t : smoothTrack(t)));
}

// ── Measuring it ─────────────────────────────────────────────────────────────

export interface MotionStats {
  /** Seconds before the goal in stretches over 0.3 s where nothing moves. */
  frozenS: number;
  /** The biggest one-frame step of any outfield man (m). */
  maxStepM: number;
  /** The biggest change of speed of an outfield man in one frame, as m/s². */
  maxAccel: number;
  /** One-frame starts or stops: standing to running (or back) within a frame. */
  snaps: number;
  /** Share of outfield man-time standing still before the goal (0..1). */
  statueShare: number;
}

export function motionStats(track: GoalTrack): MotionStats {
  const fps = track.fps;
  const frozenS = frozenStretches(track, 0.3).reduce((a, s) => a + (s.to - s.from), 0);
  const frames: FrameState[] = [];
  for (let f = 0; f < track.n; f++) frames.push(frameAt(track, f / fps));
  let maxStepM = 0, maxAccel = 0, snaps = 0, still = 0, all = 0;
  track.bodies.forEach((b, i) => {
    if (b.role === "keeper") return;
    const sp: number[] = [0];
    for (let f = 1; f < track.n; f++) {
      const d = Math.hypot(frames[f].bodies[i].x - frames[f - 1].bodies[i].x, frames[f].bodies[i].y - frames[f - 1].bodies[i].y);
      maxStepM = Math.max(maxStepM, d);
      sp.push(d * fps);
      if (f / fps <= track.goalT) { all++; if (d * fps < STILL_V) still++; }
    }
    // Speed change over a tenth of a second (three frames each way): the
    // centimetre packing alone would read as a jolt frame to frame.
    const h = 3;
    for (let f = h; f < track.n - h; f++) {
      const p0 = frames[f - h].bodies[i], p1 = frames[f].bodies[i], p2 = frames[f + h].bodies[i];
      const ax = (p2.x - 2 * p1.x + p0.x) / ((h / fps) ** 2);
      const ay = (p2.y - 2 * p1.y + p0.y) / ((h / fps) ** 2);
      maxAccel = Math.max(maxAccel, Math.hypot(ax, ay));
    }
    for (let f = 2; f < track.n; f++) {
      if ((sp[f - 1] < STILL_V && sp[f] > 1.5) || (sp[f - 1] > 1.5 && sp[f] < STILL_V)) snaps++;
    }
  });
  return { frozenS, maxStepM, maxAccel, snaps, statueShare: all ? still / all : 0 };
}
