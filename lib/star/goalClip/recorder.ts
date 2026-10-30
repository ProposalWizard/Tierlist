/**
 * THE RECORDER — writes a goal down while it is being played.
 *
 * CanvasMatch hands it what it is about to draw, every frame: where the ball
 * is, where every man is, how far the keeper's dive has got. It keeps the last
 * few seconds of that. When a goal goes in it keeps recording for a short
 * moment more (the ball in the net, the keeper on the floor), then cuts the
 * clip — from just before the first kick of the move to just after the goal —
 * and hands back a GoalTrack (track.ts).
 *
 * It never reads the engine, never draws a random number and never changes
 * anything it is given: the match plays exactly the same with it or without
 * it. Pure TypeScript, no React, so the cutting can be tested on its own.
 */
import {
  CLIP_FPS, TRACK_VERSION, SAVE_KINDS, frameStride,
  type ClipBody, type ClipEvent, type ClipEventKind, type ClipMeta, type FrameState, type GoalTrack,
} from "./track";
import { planCelebration, celebAt, roomFor, CELEB_SPECS, type CelebrationMove } from "../celebration";

/** How much of the run-up before the first kick a clip shows. */
export const LEAD_IN_S = 0.9;
/** How long after the ball crosses the line a clip keeps going. */
export const POST_GOAL_S = 2.2;
/** YOUR goal with a celebration runs on this much longer (Leo, 22 Oct 2026): the run and the move. */
export const CELEB_EXTRA_S = 2.5;
/** How long after the goal a clip runs: longer when it carries your celebration. */
export const postGoalFor = (facts: { celebration?: unknown }): number => POST_GOAL_S + (facts.celebration ? CELEB_EXTRA_S : 0);
/** The longest a clip can be. A long move is cut from the front. */
export const MAX_CLIP_S = 12;
/** How much the recorder remembers while nothing has happened yet. */
const BUFFER_S = MAX_CLIP_S + 2;

interface Sample { t: number; row: Float32Array }

/** The goal facts the match knows at the moment it is scored. */
export type GoalFacts = Omit<ClipMeta, "createdAt">;

export class GoalRecorder {
  private bodies: ClipBody[] = [];
  private samples: Sample[] = [];
  private events: ClipEvent[] = [];
  private clock = 0;
  private goal: { t: number; facts: GoalFacts } | null = null;
  private ready: GoalTrack[] = [];

  /** A new chance with these men on the pitch. Finishes any goal still being
   *  recorded first (a chance can be cut short by the next one). */
  begin(bodies: ClipBody[]): void {
    this.finishNow();
    this.bodies = bodies.map(b => ({ ...b, kit: { ...b.kit } }));
    this.samples = [];
    this.events = [];
    this.clock = 0;
  }

  /** The men this chance was begun with. */
  bodyIds(): string[] {
    return this.bodies.map(b => b.id);
  }

  /** True between begin() and the next begin(). */
  get active(): boolean {
    return this.bodies.length > 0;
  }

  /** One drawn frame. `dt` is the match's own step for this frame (seconds). */
  frame(dt: number, f: FrameState): void {
    if (!this.active || f.bodies.length !== this.bodies.length) return;
    this.clock += Math.max(0, Math.min(0.1, dt));
    const row = new Float32Array(frameStride(this.bodies.length));
    let i = 0;
    row[i++] = f.ball.x; row[i++] = f.ball.y; row[i++] = f.ball.z;
    for (const b of f.bodies) { row[i++] = b.x; row[i++] = b.y; row[i++] = b.z; }
    row[i++] = f.keeper.dive;
    row[i++] = f.keeper.lunge;
    const k = Math.max(0, SAVE_KINDS.indexOf(f.keeper.kind));
    const d = f.keeper.dir > 0 ? 1 : f.keeper.dir < 0 ? -1 : 0;
    row[i++] = (d + 1) + 3 * k;
    this.samples.push({ t: this.clock, row });
    // Forget what is too old to be in any clip — unless a goal is being cut.
    if (!this.goal) {
      let drop = 0;
      while (drop < this.samples.length && this.samples[drop].t < this.clock - BUFFER_S) drop++;
      if (drop) this.samples.splice(0, drop);
      // Events are kept for the whole chance (there are only a handful): a
      // move that began before the oldest sample still has its first kick, so
      // its clip starts as early as the recording goes rather than 2 s before
      // the goal.
    } else if (this.clock >= this.goal.t + postGoalFor(this.goal.facts)) {
      this.finishNow();
    }
  }

  /** Someone did something to the ball — now, or `ago` seconds ago (the
   *  match reads the ball's action log once a frame, a touch after the fact). */
  event(kind: ClipEventKind, who?: string, extra?: { mode?: string; save?: string }, ago = 0): void {
    if (!this.active) return;
    const t = Math.max(0, this.clock - Math.max(0, Math.min(0.2, ago)));
    this.events.push({ t, kind, ...(who ? { who } : {}), ...(extra?.mode ? { mode: extra.mode } : {}), ...(extra?.save ? { save: extra.save } : {}) });
    this.events.sort((a, b) => a.t - b.t);
  }

  /** The ball has just crossed the line. Recording goes on for POST_GOAL_S. */
  markGoal(facts: GoalFacts): void {
    if (!this.active) return;
    this.finishNow();
    this.events.push({ t: this.clock, kind: "goal", ...(facts.scorerBody ? { who: facts.scorerBody } : {}) });
    this.goal = { t: this.clock, facts };
  }

  /** Your goal: the run to the corner and the move begin now (celebration.ts). */
  celebrate(move: string, from: { x: number; y: number }): void {
    const g = this.goal;
    if (!g || !g.facts.isYou) return;
    g.facts = { ...g.facts, celebration: { move, from: [Math.round(from.x * 100) / 100, Math.round(from.y * 100) / 100], at: Math.max(0, Math.round((this.clock - g.t) * 1000) / 1000) } };
  }

  /** True while a goal's last moments are still being recorded. */
  get recordingGoal(): boolean {
    return this.goal !== null;
  }

  /** Cut whatever goal is pending, now, with what has been recorded. */
  finishNow(): void {
    const g = this.goal;
    if (!g) return;
    this.goal = null;
    const track = cutClip(this.bodies, this.samples, this.events, g.t, g.facts);
    if (track) this.ready.push(track);
  }

  /** Finished clips, oldest first. Each is handed out once. */
  take(): GoalTrack[] {
    const out = this.ready;
    this.ready = [];
    return out;
  }
}

/**
 * Cut the clip for a goal at clock `goalT` out of the samples.
 *
 * Exported for the tests: the window, the resampling and the event times are
 * the whole of what makes a replay line up with what was played.
 */
export function cutClip(
  bodies: ClipBody[], samples: Sample[], events: ClipEvent[], goalT: number, facts: GoalFacts,
): GoalTrack | null {
  if (samples.length < 2 || bodies.length === 0) return null;
  const kicks = events.filter(e => (e.kind === "shot" || e.kind === "pass") && e.t <= goalT);
  // The kick that scored: the last strike before the ball went in.
  const strike = [...kicks].reverse().find(e => e.kind === "shot") ?? kicks[kicks.length - 1];
  const first = kicks[0];
  const lastT = samples[samples.length - 1].t;
  // Every clip carries the full POST_GOAL_S after the goal. The match often
  // moves on before that (the result screen gives way to the commentary
  // after 1.3-1.8 s, measured 7 Oct 2026), so the frames after the last one
  // recorded are carried on from it: everyone eases to a stop (extendRow).
  // Before 11 Oct 2026 the clip simply ended where the recording did.
  const endT = goalT + postGoalFor(facts);
  const tail = extendRow(samples, bodies.length);
  let startT = Math.max(samples[0].t, (first ? first.t : goalT - 2) - LEAD_IN_S);
  if (endT - startT > MAX_CLIP_S) startT = endT - MAX_CLIP_S;
  if (endT - startT < 0.3) return null;

  const stride = frameStride(bodies.length);
  const n = Math.max(2, Math.floor((endT - startT) * CLIP_FPS) + 1);
  const data = new Int16Array(n * stride);
  const discrete = stride - 1;   // dirKind: never blended
  let j = 0;
  for (let k = 0; k < n; k++) {
    const T = startT + k / CLIP_FPS;
    const base = k * stride;
    if (T > lastT) {
      const row = tail(T - lastT);
      for (let c = 0; c < stride; c++) {
        const scaled = c === discrete ? row[c] : c === stride - 2 ? row[c] * 1000 : row[c] * 100;
        data[base + c] = Math.max(-32767, Math.min(32767, Math.round(scaled)));
      }
      continue;
    }
    while (j < samples.length - 2 && samples[j + 1].t <= T) j++;
    const a = samples[j], b = samples[Math.min(j + 1, samples.length - 1)];
    const span = b.t - a.t;
    const w = span > 1e-9 ? Math.max(0, Math.min(1, (T - a.t) / span)) : 0;
    for (let c = 0; c < stride; c++) {
      if (c === discrete) { data[base + c] = Math.round(w < 0.5 ? a.row[c] : b.row[c]); continue; }
      const v = a.row[c] + (b.row[c] - a.row[c]) * w;
      // The keeper's lunge (second to last) is kept in thousandths, every
      // other number in centimetres.
      const scaled = c === stride - 2 ? v * 1000 : v * 100;
      data[base + c] = Math.max(-32767, Math.min(32767, Math.round(scaled)));
    }
  }
  // Your celebration: your run and your move come from the plan the match
  // played (celebration.ts), so the video has all of it even when the match
  // was tapped past before the recording got there.
  const cel = facts.celebration;
  const youIdx = bodies.findIndex(b => b.id === "you");
  if (cel && youIdx >= 0 && cel.move in CELEB_SPECS) {
    const plan = planCelebration({ x: cel.from[0], y: cel.from[1] }, cel.move as CelebrationMove);
    const t0 = goalT + cel.at;
    for (let k = 0; k < n; k++) {
      const T = startT + k / CLIP_FPS;
      if (T < t0) continue;
      const st = celebAt(plan, T - t0);
      const c = 3 + youIdx * 3;
      data[k * stride + c] = Math.round(st.x * 100);
      data[k * stride + c + 1] = Math.round(st.y * 100);
      data[k * stride + c + 2] = 0;
      // Nobody stands on your run or where your move ends (celebration.ts roomFor):
      // the same step aside the live match draws. The recording holds raw spots.
      for (let b = 0; b < bodies.length; b++) {
        if (b === youIdx || bodies[b].id === "keeper") continue;
        const o = k * stride + 3 + b * 3;
        const m = roomFor(plan, { x: data[o] / 100, y: data[o + 1] / 100 }, T - t0);
        data[o] = Math.round(m.x * 100);
        data[o + 1] = Math.round(m.y * 100);
      }
    }
  }
  const at = (t: number) => Math.round((t - startT) * 1000) / 1000;
  const clipEvents = events
    .filter(e => e.t >= startT - 1e-9 && e.t <= endT + 1e-9)
    .map(e => ({ ...e, t: at(e.t) }));
  return {
    v: TRACK_VERSION,
    meta: {
      ...facts,
      // The scorer is the man who struck the scoring shot, when the match did
      // not say (a team-mate's finish is named by the ball's own log).
      ...(facts.scorerBody || !strike?.who ? {} : { scorerBody: strike.who }),
      createdAt: new Date().toISOString(),
    },
    fps: CLIP_FPS,
    bodies: bodies.map(b => ({ ...b })),
    data,
    n,
    goalT: at(goalT),
    strikeT: at(strike ? Math.max(startT, strike.t) : goalT),
    firstKickT: at(first ? Math.max(startT, first.t) : startT),
    events: clipEvents,
  };
}

/** How quickly everything eases to a stop after the recording ends (s). */
const TAIL_EASE_S = 0.25;

/**
 * The frame `d` seconds after the last one recorded, in raw row units.
 *
 * Everyone carries on the way they were going and eases to a stop (the ball
 * settling in the net, the runners pulling up), never a frozen still. Heights
 * (the ball's, a wall's jump) settle to the ground; the keeper's dive is held
 * where it got to. Pure: same samples, same frames.
 */
export function extendRow(samples: Sample[], bodyCount: number): (d: number) => Float32Array {
  const last = samples[samples.length - 1];
  // A velocity over the last ~0.1 s, not the last frame alone (phone frames
  // are uneven, and a tiny step makes a jumpy speed).
  let p = samples.length - 2;
  while (p > 0 && last.t - samples[p].t < 0.1) p--;
  const prev = samples[Math.max(0, p)];
  const span = last.t - prev.t;
  const stride = frameStride(bodyCount);
  const moving = 3 + 3 * bodyCount;   // ball and bodies: x, y, z triples
  return (d: number) => {
    const row = new Float32Array(stride);
    const travel = TAIL_EASE_S * (1 - Math.exp(-Math.max(0, d) / TAIL_EASE_S));
    const settle = Math.exp(-Math.max(0, d) / TAIL_EASE_S);
    for (let c = 0; c < stride; c++) {
      const v = last.row[c];
      if (c >= moving) { row[c] = v; continue; }   // the keeper: held
      if (c % 3 === 2) { row[c] = Math.max(0, v * settle); continue; }   // heights settle
      const vel = span > 1e-6 ? (v - prev.row[c]) / span : 0;
      row[c] = v + vel * travel;
    }
    return row;
  };
}
