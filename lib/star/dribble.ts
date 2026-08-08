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
 * The shape is a run through midfield: you start at the bottom of the screen
 * and you have to get to the top of it. You swipe in the direction you want to
 * go and you keep going that way until you swipe again. Three or four men are
 * standing between you and the line, in different spots, and NOT MOVING — each
 * one wakes only when you come close enough to be worth going for, and then he
 * comes for the ball. So the run is about the line you pick through them, not
 * about reaction speed, and the goal is nowhere in sight: getting through is
 * what earns you the chance, it is not the chance itself.
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

/**
 * How fast you run with the ball before pace is counted.
 *
 * Slower than it was. At 5.0 + pace a run was over in a second and a half —
 * long before you had read where anybody was, let alone picked a way through
 * them. A dribble you cannot see is not a dribble.
 */
const BASE_SPEED = 4.0;
/**
 * …and what pace buys on top.
 *
 * This is the whole job of the Pace attribute, which until now was trainable,
 * had an achievement, and was read by no code in the match at all.
 */
const PACE_SPEED = 2.6;

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
const CHASER_BASE = 3.1;
const CHASER_STRENGTH = 1.1;

/** He notices you inside this — until then he is standing still, watching. */
const WAKE_R = 7;
/** …and takes it off you inside this. */
const TACKLE_R = 0.9;

/**
 * Length of the run, and how wide you may stray.
 *
 * The run happens in MIDFIELD and the length is chosen so that neither goal is
 * ever on screen. What you are being asked is "can you get past these men",
 * which is a different question from "can you finish" — the chance you earn is
 * built afterwards from wherever you got to.
 */
const RUN_LENGTH = 22;
const CORRIDOR = 19;

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
  // Deep enough that the far goal is off the top of the frame at the finish and
  // your own is off the bottom at the start.
  const startY = 50 + rng() * 3;
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
  // The sides of the run are the edges of the frame, and running into one costs
  // you the ground you were making rather than the ball. Losing possession for
  // drifting wide was the commonest way a run ended, which taught you to be
  // afraid of the one thing the situation is asking you to do — move sideways.
  state.pos.x = clamp(state.pos.x, state.minX, state.maxX);
  // Turning and running away from the line is still a way to waste it.
  if (state.pos.y > state.startY + 8) { state.outcome = "out"; return state.outcome; }
  if (state.elapsed > DRIBBLE_TIMEOUT) { state.outcome = "lost"; return state.outcome; }

  return "running";
}

/**
 * The frame the run happens in.
 *
 * The whole run, in one rectangle that never moves: the line to reach across the
 * top, you at the bottom, the men in between. It is computed once, from the run,
 * and the corridor is narrower than the frame so the sides of the run are inside
 * what you can see.
 *
 * Two versions of this were wrong. First the run inherited whatever viewport the
 * last chance had left behind, so it played out on a frame built around a goal
 * thirty metres away. Then it had a camera of its own that followed you up the
 * pitch — which is the same mistake in a politer form. The situation is not
 * somewhere on a pitch that a camera visits. The situation is this rectangle.
 */
export const DRIBBLE_PAD = 4.5;     // metres of grass beyond each end of the run

export function dribbleViewport(state: DribbleState) {
  const y1 = state.targetY - DRIBBLE_PAD;
  const y2 = state.startY + DRIBBLE_PAD;
  const w = (y2 - y1) * (3 / 4);
  const cx = clamp((state.minX + state.maxX) / 2, w / 2, PITCH_W - w / 2);
  return { x1: cx - w / 2, x2: cx + w / 2, y1, y2 };
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
