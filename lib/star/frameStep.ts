/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * FRAME STEPPING — the contract that lets a 3D screen be filmed on a machine
 * with no graphics card (Harry, 9 Oct 2026: "there HAS to be a way to get
 * around no graphics card for seeing cut scenes ... break every still up into
 * a full frame by frame action").
 *
 * Real-time capture here runs at 1-5 s per frame, so a video stutters. Instead
 * the clock is frozen: a tool (scripts/film/frames3d.mjs) says "be at second
 * t", the screen draws exactly that one frame, the tool screenshots it, and
 * then asks for t + 1/30. The frames are joined into a smooth 30 fps video.
 *
 * THE CONTRACT — any 3D screen can publish this on `window.__frameStep`:
 *
 *     { duration, seek(t), timeline? }
 *
 *   duration  seconds the thing runs (0 / absent: the tool is told on its
 *             command line).
 *   seek(t)   move the screen to t seconds and draw it ONCE. A screen that is
 *             a simulation (gameplay) advances its clock in small fixed steps
 *             up to t, drawing only the last one, and only runs forward; a
 *             screen that is a pure function of t (cut scenes) may jump.
 *             Must be deterministic: same t, same picture.
 *   timeline  optional scripted input for a simulation (see TimelineEvent).
 *
 * Dev-only plumbing: nothing here runs unless a tool calls it, and the
 * real-time loop keeps running exactly as before until `seek` is first called.
 */
import type { Action3, World } from "./play3d/world";

export interface FrameStep {
  duration: number;
  seek(t: number): void | Promise<void>;
  /** Scripted input for a simulation screen (set by the filming tool or the page). */
  timeline?: TimelineEvent[];
}

/** One scripted input, applied the first time the clock reaches `t`. `move` is in pitch units (x right, y down the pitch, -y towards the goal). */
export interface TimelineEvent {
  t: number;
  move?: { x: number; y: number };
  sprint?: boolean;
  act?: Action3;
}

export function publishFrameStep(fs: FrameStep): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as any;
  w.__frameStep = fs;
  return () => { if (w.__frameStep === fs) delete w.__frameStep; };
}

/** The fixed sim step a stepper uses (60 Hz, like a real frame on a phone). */
export const SIM_STEP = 1 / 60;

/**
 * Turns a "run the world for dt, draw if asked" function into `seek(t)`.
 * Forward only: it keeps its own clock and applies the timeline's events as
 * the clock passes them. Seeking to the current time just draws again.
 */
export function makeWorldSeek(world: World, run: (dt: number, draw: boolean) => void, getTimeline: () => TimelineEvent[] | undefined) {
  let now = 0;
  let next = 0;
  return (t: number) => {
    const tl = (getTimeline() ?? []).slice().sort((a, b) => a.t - b.t);
    if (t < now - 1e-6) throw new Error(`frame-step: gameplay only runs forward (asked ${t}, at ${now.toFixed(3)})`);
    const apply = (upTo: number) => {
      while (next < tl.length && tl[next].t <= upTo + 1e-9) {
        const e = tl[next++];
        if (e.move || e.sprint !== undefined) world.input = { move: e.move ?? world.input.move, sprint: e.sprint ?? world.input.sprint };
        if (e.act) world.act(e.act);
      }
    };
    if (t - now < 1e-6) { apply(now); run(0, true); return; }
    while (t - now > 1e-6) {
      apply(now);
      const dt = Math.min(SIM_STEP, t - now);
      now += dt;
      run(dt, t - now <= 1e-6);
    }
  };
}

/**
 * Built-in scripted demos for the gameplay screens (`?demo=NAME` on the Style
 * Testing page). Pitch units: the goal is at y = 0, you start about 30 m out,
 * x grows to the right (the goal's centre is x = CX = 34).
 */
export const DEMOS: Record<string, { duration: number; timeline: TimelineEvent[] }> = {
  // jog forward with the ball (no sprint: a sprint outruns it), let go, hit it at the far corner; the keeper saves
  "dribble-shoot": {
    duration: 4,
    timeline: [
      { t: 0, move: { x: 0.3, y: -1 }, sprint: false },
      { t: 1.9, move: { x: 0, y: 0 }, sprint: false },
      { t: 2.0, act: { kind: "shoot", dir: { x: 0.33, y: -1 }, pull: 0.2 } },
    ],
  },
};
