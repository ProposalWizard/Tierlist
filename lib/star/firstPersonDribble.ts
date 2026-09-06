import { CX } from "./pitch";

/**
 * FIRST-PERSON DRIBBLING — THREE MEN, ONE AT A TIME, THROUGH HIS OWN EYES.
 *
 * Requested directly: a first-person dribbling mode — "you see through his
 * eyes... dribble through players... then be left with a chance to pass or
 * shoot" — built to feel like a real decision under time pressure rather
 * than "basically just aim and tap". This is NOT an extension of
 * `dribble.ts`'s existing run: that mechanic is deliberately top-down,
 * stationary-until-woken defenders, one flick to pick a whole LINE through
 * them, and the goal kept off-screen on purpose ("getting through is what
 * earns you the chance, it is not the chance itself"). None of that
 * transfers to a first-person camera — you cannot see a "line" through three
 * men from ground level, only the one in front of you, right now. So this
 * is a different shape entirely: three SEQUENTIAL one-on-one duels, each one
 * a single readable moment — he telegraphs a side, you read it and burst the
 * other way — and the goal is visible and growing from the start, because in
 * first person a growing goal on the horizon IS the sense of progress.
 *
 * Pure simulation: no React, no canvas, no input handling, no camera. The
 * component feeds it a lane target and a burst direction; everything that
 * decides anything is here — same split `dribble.ts` already uses, and the
 * same "mutate the state, return the outcome" step shape
 * (`stepDribble(state, dt): DribbleOutcome`), not an immutable `step(s) => s`.
 *
 * ── Why sequential, and why a telegraph ──
 *
 * A duel resolves on ONE number: lateral separation from the defender at the
 * moment he reaches you. Every mechanic — mirroring, lag, the telegraph
 * window, the lunge, your burst — feeds that one scalar, which is what makes
 * the whole thing testable: a scripted "read the telegraph, burst away from
 * it" oracle should win almost every time, and a scripted "do nothing"
 * should lose every time. If either of those isn't true, the duel isn't
 * actually fair, and the arithmetic below exists so it starts out that way
 * rather than being tuned by feel after the fact:
 *
 *   closure rate  ≈ yourSpeed + closeSpeed ≈ 6.5 + 3.3 ≈ 9.8 m/s
 *   commit depth  = ~5.2 m  →  ~0.53 s from commit to contact
 *   telegraph     = ~0.30 s of that, slowed by TELE_SLOW → ~0.42 s wall-clock
 *   do nothing    : sep ≈ LUNGE_REACH alone ≈ 1.1 m  <  CLEAR_SEP — his own
 *                   guess, with you frozen, can never be enough by itself.
 *   burst away    : sep ≈ 2.2 (you) + 1.1 (him, wrong way) ≈ 3.3 m ≫ CLEAR_SEP
 *   burst wrong   : sep ≈ |2.2 − 1.1| ≈ 1.1 m  <  CLEAR_SEP
 *   steer only    : STEER_SPEED × (tellT + LUNGE_T) < CLEAR_SEP, ALWAYS —
 *                   steering alone must never be enough; only a burst can
 *                   beat a man. Easiest relationship to break while tuning;
 *                   it has its own test.
 *
 * ── The lazy spawn (not a cosmetic choice) ──
 *
 * A defender's lane is not fixed at construction — he spawns ON YOUR LANE
 * the instant he engages (`ENGAGE_D`). With a 9 m half-corridor and only
 * ~12 m of engage depth to work with, pre-placing him would let one
 * touchline be hugged safely the whole way through — he is the man who
 * steps out to meet you, not an obstacle you can route around in advance.
 * Still fully deterministic under the seeded RNG.
 *
 * ── Difficulty scaling ──
 *
 * A stronger defender does not move faster in some unreadable way — he
 * TELEGRAPHS LESS (smaller `tellT`). That is the one difficulty knob that
 * preserves fairness as it climbs: the window narrows, it never becomes a
 * guess.
 */

export interface Vec2 { x: number; y: number; }

export type RunPhase = "running" | "clear" | "lost";

export type DefenderPhase =
  | "waiting"     // standing off, not yet worth engaging
  | "closing"     // coming to meet you, mirroring your lane with a lag
  | "telegraph"   // shoulder dropped, side already chosen — the window
  | "committed"   // gone; can no longer change side
  | "beaten"
  | "won";

export interface FpDefender {
  /** Pitch x — his lane. Not meaningful until he engages; see spawnAt. */
  x: number;
  /** Pitch y — his starting depth. Advances toward you once engaged. */
  y: number;
  phase: DefenderPhase;
  /** His lagged read of your lane — what he steers toward, not where you
   *  actually are this instant. */
  read: number;
  /** m/s he can shuffle sideways while mirroring. Always faster than
   *  STEER_SPEED — you cannot out-jog him, only a burst beats him. */
  mirrorSpeed: number;
  /** Seconds of lag in his read of your lane. Smaller = sharper defender. */
  lagT: number;
  /** m/s he closes the depth between you. */
  closeSpeed: number;
  /** Depth at which he commits to a side. Jittered per man. */
  commitD: number;
  /** How long the telegraph shows before he goes. THE difficulty dial —
   *  smaller in a stronger defender, never a speed you can't react to. */
  tellT: number;
  /** Counts down through "telegraph". */
  tell: number;
  /** Chosen the instant the telegraph starts, from your drift at that
   *  moment — so it is genuinely readable, not decided in advance. */
  commitSide: -1 | 1;
  /** Which way he goes if you haven't shown him a side to react to. */
  bias: -1 | 1;
  /** His lane the instant he committed — the lunge is measured from here. */
  lungeFrom: number;
  /** 0→1 through the lunge, driving his lateral lurch. */
  lunge: number;
  /** Lateral separation the duel was actually judged on — set on
   *  resolution; the one number every test reads. */
  sepAtContact?: number;
}

export interface FpBurst {
  dir: -1 | 1;
  /** Seconds into the burst. */
  t: number;
  /** Metres of lateral travel already delivered, so the ease-out is exact
   *  regardless of frame rate. */
  done: number;
}

export interface FpRunState {
  /** Your lane, pitch x. */
  x: number;
  /** Your depth, pitch y — counts DOWN toward the goal line at y = 0. */
  y: number;
  /** Where the steer input is asking the lane to be. */
  laneTarget: number;
  /** Forward m/s before any burst boost. */
  speed: number;
  burst: FpBurst | null;
  defenders: FpDefender[];
  /** Index of the defender currently being duelled, or -1 once all three
   *  are resolved (or before any has engaged). */
  active: number;
  minX: number;
  maxX: number;
  startY: number;
  /** Cross this with every defender beaten and the run is clear. */
  clearY: number;
  /** 1 normally; dips during a telegraph so the moment reads as a moment.
   *  Lives in the sim, not the component, so a test sees exactly what the
   *  player would. */
  timeScale: number;
  /** Seconds remaining before another burst can fire. */
  burstLock: number;
  elapsed: number;
  phase: RunPhase;
  /** Index of the defender who won the ball, if the run was lost that way;
   *  null for a timeout. */
  lostTo: number | null;
  /** Metres run, monotonic — drives camera bob/stripes without ever being
   *  able to desync from speed. */
  stride: number;
  /** The same seeded RNG the run was created with — kept on the state so
   *  every in-flight decision (the lazy spawn jitter) stays reproducible
   *  under `stepRun`, which otherwise takes no source of randomness at all. */
  rng: () => number;
}

// ── Tuned constants ─────────────────────────────────────────────────────────

/** How far out the run starts — the goal is a sliver on the horizon here. */
export const START_Y = 48;
/** Depth of the first duel, and the gap between each one after it. */
const FIRST_DUEL_DEPTH = 16;
const DUEL_GAP = 9;
/** Cross this and, with every duel won, the run is clear — roughly the
 *  penalty spot. */
export const CLEAR_Y = 12;
export const CORRIDOR_HALF = 9;

export const BASE_SPEED = 5.2;
export const PACE_SPEED = 2.2;
/** Deliberately slower than any defender's mirrorSpeed — steering can
 *  narrow a gap, it can never by itself beat a man. */
export const STEER_SPEED = 2.0;

export const BURST_T = 0.35;
export const BURST_LATERAL = 2.2;
export const BURST_BOOST = 1.25;
export const BURST_LOCK = 0.55;

const ENGAGE_D = 12;
const COMMIT_D_BASE = 5.2;
const TELL_BASE = 0.30;
const LUNGE_T = 0.22;
/**
 * How far he lurches once committed. Deliberately LESS than CLEAR_SEP — if
 * you never move at all, `lungeFrom` sits essentially on top of you (he
 * mirrored you the whole way in), so his own lunge is the ONLY source of
 * separation on offer, in a direction his guess picked, not yours. If that
 * alone could clear CLEAR_SEP, a frozen player would "win" duels purely off
 * a lucky guess, which is backwards — separation has to come from what YOU
 * do (a burst, or drift shown before he commits), never from his lunge on
 * its own. Kept comfortably under CLEAR_SEP so "do nothing" is a hard,
 * always-lose invariant (see tests/star/firstPersonDribble.mts).
 */
const LUNGE_REACH = 1.1;
/** How much the world slows during a telegraph, so the window is long
 *  enough to actually read on a phone. */
export const TELE_SLOW = 0.72;
/** Same spirit as dribble.ts's TACKLE_R (0.9) — how close counts as
 *  "reached you". */
export const CONTACT_D = 0.85;
/** The one number every duel is judged on. */
export const CLEAR_SEP = 1.35;
/** Drift bigger than this and he reads which way you're going. */
const SHOW_SIDE = 0.35;
/** A run that goes nowhere still has to end. */
export const RUN_TIMEOUT = 20;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

export function runSpeed(pace: number): number {
  return BASE_SPEED + clamp(pace, 0, 100) / 100 * PACE_SPEED;
}

/**
 * Set up a run.
 *
 * Three defenders by default, ramped from a slightly easier first man to a
 * tougher last one — the ramp is entirely in `tellT` (see the file header):
 * a stronger defender telegraphs less, never moves in some way you can't
 * react to at all.
 */
export function newRun(opts: {
  pace: number;
  oppStrength: number;
  defenders?: number;
  rng: () => number;
}): FpRunState {
  const { rng } = opts;
  const count = opts.defenders ?? 3;

  const defenders: FpDefender[] = [];
  for (let i = 0; i < count; i++) {
    const factor = count > 1 ? 0.85 + 0.15 * (i / (count - 1)) : 1.0;
    const str = clamp(opts.oppStrength, 0, 100) * factor;
    defenders.push({
      x: 0,
      y: START_Y - FIRST_DUEL_DEPTH - DUEL_GAP * i,
      phase: "waiting",
      read: 0,
      mirrorSpeed: 2.0 + (str / 100) * 1.6,
      lagT: 0.32 - (str / 100) * 0.14,
      closeSpeed: 2.6 + (str / 100) * 1.4,
      commitD: COMMIT_D_BASE * (0.85 + rng() * 0.30),
      tellT: TELL_BASE * (1.25 - (str / 100) * 0.5),
      tell: 0,
      commitSide: 1,
      bias: rng() < 0.5 ? -1 : 1,
      lungeFrom: 0,
      lunge: 0,
    });
  }

  return {
    x: CX,
    y: START_Y,
    laneTarget: CX,
    speed: runSpeed(opts.pace),
    burst: null,
    defenders,
    active: defenders.length > 0 ? 0 : -1,
    minX: CX - CORRIDOR_HALF,
    maxX: CX + CORRIDOR_HALF,
    startY: START_Y,
    clearY: CLEAR_Y,
    timeScale: 1,
    burstLock: 0,
    elapsed: 0,
    phase: "running",
    lostTo: null,
    stride: 0,
    rng,
  };
}

/** Continuous lane request, in pitch metres. Call on every pointer move. */
export function applySteer(s: FpRunState, laneTarget: number): void {
  s.laneTarget = clamp(laneTarget, s.minX, s.maxX);
}

/** The decisive knock past him. Returns false if a burst is still locked
 *  out from the last one — the component can use that to ignore a
 *  double-flick rather than silently swallowing it. */
export function applyBurst(s: FpRunState, dir: -1 | 1): boolean {
  if (s.phase !== "running" || s.burst || s.burstLock > 0) return false;
  s.burst = { dir, t: 0, done: 0 };
  s.burstLock = BURST_LOCK;
  return true;
}

function pickSide(def: FpDefender, s: FpRunState): -1 | 1 {
  const drift = s.x - def.x;
  return Math.abs(drift) > SHOW_SIDE ? (drift > 0 ? 1 : -1) : def.bias;
}

/** Advance the currently-active defender by one tick. Only ever one man is
 *  live at a time — sequential duels, not a wall of three. */
function stepDefender(idx: number, s: FpRunState, sdt: number): void {
  const def = s.defenders[idx];
  switch (def.phase) {
    case "waiting": {
      const d = s.y - def.y;
      if (d <= ENGAGE_D) {
        def.phase = "closing";
        // Spawn his lane on yours the instant he steps out — see the file
        // header: pre-placing him would make one touchline safe in advance.
        def.x = def.read = s.x + (s.rng() - 0.5) * 1.2;
      }
      return;
    }
    case "closing": {
      def.read += (s.x - def.read) * Math.min(1, sdt / def.lagT);
      def.x += clamp(def.read - def.x, -def.mirrorSpeed * sdt, def.mirrorSpeed * sdt);
      def.y += def.closeSpeed * sdt;
      if (s.y - def.y <= def.commitD) {
        def.phase = "telegraph";
        def.commitSide = pickSide(def, s);
        def.tell = def.tellT;
        s.timeScale = TELE_SLOW;
      }
      break;
    }
    case "telegraph": {
      // Lateral is frozen — this is what makes the window real.
      def.tell -= sdt;
      def.y += def.closeSpeed * sdt;
      if (def.tell <= 0) {
        def.phase = "committed";
        def.lungeFrom = def.x;
        def.lunge = 0;
        s.timeScale = 1;
      }
      break;
    }
    case "committed": {
      def.lunge = Math.min(1, def.lunge + sdt / LUNGE_T);
      def.x = def.lungeFrom + def.commitSide * LUNGE_REACH * easeOutCubic(def.lunge);
      def.y += def.closeSpeed * sdt;
      break;
    }
    default:
      return;
  }

  if (s.y - def.y <= CONTACT_D) {
    const sep = Math.abs(s.x - def.x);
    def.sepAtContact = sep;
    if (sep >= CLEAR_SEP) {
      def.phase = "beaten";
      // A jostle, not a wall — the run loses a little of its pace getting
      // past him and then keeps going, it doesn't get punished twice.
      s.speed *= 0.94;
    } else {
      def.phase = "won";
      s.phase = "lost";
      s.lostTo = idx;
    }
  }
}

/** Advance the run by one tick. */
export function stepRun(s: FpRunState, dt: number): RunPhase {
  if (s.phase !== "running") return s.phase;

  const sdt = dt * s.timeScale;
  s.elapsed += sdt;
  s.burstLock = Math.max(0, s.burstLock - sdt);

  // Burst — a decisive lateral knock, eased out over BURST_T.
  let boost = 1;
  if (s.burst) {
    const b = s.burst;
    b.t += sdt;
    const f = easeOutCubic(b.t / BURST_T);
    const target = BURST_LATERAL * f;
    s.x += b.dir * (target - b.done);
    b.done = target;
    boost = 1 + (BURST_BOOST - 1) * (1 - clamp(b.t / BURST_T, 0, 1));
    if (b.t >= BURST_T) s.burst = null;
  }

  // Steer — always slower than a defender's mirror; see the file header.
  s.x += clamp(s.laneTarget - s.x, -STEER_SPEED * sdt, STEER_SPEED * sdt);
  // Clamp, never lose the ball for drifting wide — dribble.ts's own lesson.
  s.x = clamp(s.x, s.minX, s.maxX);

  const forward = s.speed * boost;
  s.y -= forward * sdt;
  s.stride += forward * sdt;

  // Only the frontmost unresolved defender is ever live.
  let activeIdx = -1;
  for (let i = 0; i < s.defenders.length; i++) {
    const p = s.defenders[i].phase;
    if (p !== "beaten" && p !== "won") { activeIdx = i; break; }
  }
  s.active = activeIdx;
  if (activeIdx >= 0) {
    stepDefender(activeIdx, s, sdt);
  }
  if (s.phase !== "running") return s.phase;

  const allBeaten = s.defenders.every(d => d.phase === "beaten");
  if (allBeaten && s.y <= s.clearY) {
    s.phase = "clear";
    return s.phase;
  }
  if (s.elapsed > RUN_TIMEOUT) {
    s.phase = "lost";
    s.lostTo = null;
    return s.phase;
  }

  return "running";
}

/** How far through the run you are, 0-1. For a progress bar / HUD. */
export function runProgress(s: FpRunState): number {
  const total = s.startY - s.clearY;
  if (total <= 0) return 1;
  return clamp((s.startY - s.y) / total, 0, 1);
}
