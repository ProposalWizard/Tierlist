import { PITCH_W, CX } from "./pitch";

/**
 * THE DRIBBLE
 *
 * Chapter 6 of the specification is a whole chapter on dribbling, and the game
 * had none of it — you were a fixed point who struck the ball and never moved.
 *
 * The doc is explicit that NSS dribbling is not tricks: "New Star Soccer treats
 * dribbling as a tactical positioning tool… The player is almost never rewarded
 * simply because they continued dribbling. Instead, dribbling is rewarded when
 * it creates a better football decision." Getting through is not the end of the
 * move; it is what earns you the chance at the end of it.
 *
 * The shape is a run from deep to the edge of their box. You flick in the
 * direction you want to go and you keep going in it until you flick again.
 * Defenders start scattered and are not paying attention — they wake when you
 * come near, and then they chase. Nobody is trying to stand in front of you at
 * kick-off, so the run is about the line you pick through them rather than
 * reaction speed.
 *
 * Pure simulation: no React, no canvas, no input handling. The component draws
 * it and feeds it flicks; everything that decides anything is here.
 */

export interface Vec2 { x: number; y: number; }

export interface Chaser {
  x: number;
  y: number;
  /** Metres per second. Varied per defender so they do not move as one object. */
  speed: number;
  /** Has he noticed you? They start switched off and wake at close range. */
  awake: boolean;
}

export type DribbleOutcome = "running" | "through" | "lost" | "out";

export interface DribbleState {
  /** You, with the ball at your feet. */
  pos: Vec2;
  /** Where you are running. Unit vector; changed by a flick. */
  heading: Vec2;
  speed: number;
  chasers: Chaser[];
  /** Cross this and you are through. */
  targetY: number;
  /** Where the run began, for the progress bar. */
  startY: number;
  /** Sides of the corridor. Leave it and the move dies. */
  minX: number;
  maxX: number;
  elapsed: number;
  outcome: DribbleOutcome;
  /** Set on the frame a chaser takes it, so the renderer can show who. */
  beatenBy: number | null;
}

// ── Tuned constants ─────────────────────────────────────────────────────────

/** How fast you run with the ball before pace is counted. */
const BASE_SPEED = 5.0;
/**
 * …and what pace buys on top.
 *
 * This is the whole job of the Pace attribute, which until now was trainable,
 * had an achievement, and was read by no code in the match at all.
 */
const PACE_SPEED = 3.2;

/**
 * How fast they close, before their own variation.
 *
 * Deliberately in the same band as a middling player rather than above it. At
 * 5.0 + strength the chasers outran a pace-20 player in a straight line no
 * matter what he did, and 500 runs at pace 20 produced not one that got
 * through — pace below a threshold was not "slow", it was locked out. A
 * defender should be beaten by the line you pick, and pace should decide how
 * much room that line needs.
 */
const CHASER_BASE = 4.6;
const CHASER_STRENGTH = 1.4;

/** He notices you inside this. */
const WAKE_R = 6.5;
/** …and takes it off you inside this. */
const TACKLE_R = 0.9;

/** Length of the run, and how wide you may stray. */
const RUN_LENGTH = 20;
const CORRIDOR = 34;

/** A run that goes nowhere still has to end. */
export const DRIBBLE_TIMEOUT = 14;

export function dribbleSpeed(pace: number): number {
  return BASE_SPEED + Math.max(0, Math.min(100, pace)) / 100 * PACE_SPEED;
}

/**
 * Set up a run.
 *
 * Chasers are placed across the corridor at staggered depths and never directly
 * on the starting line — a defender already standing in front of you at the
 * whistle would make the opening flick a guess rather than a read.
 */
export function newDribble(opts: {
  pace: number;
  oppStrength: number;
  chasers?: number;
  rng: () => number;
}): DribbleState {
  const { rng } = opts;
  const startY = 34 + rng() * 6;
  const targetY = startY - RUN_LENGTH;
  const startX = CX + (rng() - 0.5) * 12;

  const count = opts.chasers ?? 3;
  const chasers: Chaser[] = [];
  for (let i = 0; i < count; i++) {
    // Spread across the width in bands so two never start on top of each other,
    // and down the run so they are met one at a time rather than as a wall.
    const band = (i + 0.5) / count;
    const x = clamp(
      startX - CORRIDOR / 2 + band * CORRIDOR + (rng() - 0.5) * 5,
      startX - CORRIDOR / 2 + 2,
      startX + CORRIDOR / 2 - 2,
    );
    const depth = 0.25 + (i / Math.max(1, count - 1)) * 0.6 + (rng() - 0.5) * 0.12;
    chasers.push({
      x,
      y: startY - RUN_LENGTH * clamp(depth, 0.18, 0.92),
      speed: (CHASER_BASE + (opts.oppStrength / 100) * CHASER_STRENGTH) * (0.92 + rng() * 0.16),
      awake: false,
    });
  }

  return {
    pos: { x: startX, y: startY },
    heading: { x: 0, y: -1 },
    speed: dribbleSpeed(opts.pace),
    chasers,
    targetY,
    startY,
    minX: Math.max(1.5, startX - CORRIDOR / 2),
    maxX: Math.min(PITCH_W - 1.5, startX + CORRIDOR / 2),
    elapsed: 0,
    outcome: "running",
    beatenBy: null,
  };
}

/**
 * Point the run somewhere new.
 *
 * A flick is a direction and nothing else — there is no speed control, because
 * the decision the run is asking is "which way", not "how fast". A flick that
 * would send you backwards down the pitch is allowed; it is sometimes the right
 * answer, and disallowing it would be the engine making the decision for you.
 */
export function flick(state: DribbleState, dx: number, dy: number) {
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return;
  state.heading = { x: dx / len, y: dy / len };
}

/** Advance the run by one step. */
export function stepDribble(state: DribbleState, dt: number): DribbleOutcome {
  if (state.outcome !== "running") return state.outcome;
  state.elapsed += dt;

  state.pos.x += state.heading.x * state.speed * dt;
  state.pos.y += state.heading.y * state.speed * dt;

  for (let i = 0; i < state.chasers.length; i++) {
    const c = state.chasers[i];
    const dx = state.pos.x - c.x, dy = state.pos.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;

    // He is not watching you until you come near. Once he is, he stays awake —
    // beating a man should mean beating him, not stepping out of his radius and
    // having him forget you were ever there.
    if (!c.awake && dist < WAKE_R) c.awake = true;
    if (!c.awake) continue;

    if (dist < TACKLE_R) {
      state.outcome = "lost";
      state.beatenBy = i;
      return state.outcome;
    }

    // Run at where you ARE, not where you will be. A defender who solved the
    // interception perfectly could never be beaten by pace, which is the one
    // thing this whole scenario exists to reward.
    const step = Math.min(dist, c.speed * dt);
    c.x += (dx / dist) * step;
    c.y += (dy / dist) * step;
  }

  if (state.pos.y <= state.targetY) { state.outcome = "through"; return state.outcome; }
  if (state.pos.x < state.minX || state.pos.x > state.maxX) { state.outcome = "out"; return state.outcome; }
  if (state.pos.y > state.startY + 8) { state.outcome = "out"; return state.outcome; }
  if (state.elapsed > DRIBBLE_TIMEOUT) { state.outcome = "lost"; return state.outcome; }

  return "running";
}

/** How far through the run you are, 0-1. For the progress bar. */
export function dribbleProgress(state: DribbleState): number {
  const total = state.startY - state.targetY;
  if (total <= 0) return 1;
  return clamp((state.startY - state.pos.y) / total, 0, 1);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
