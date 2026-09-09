import { CX } from "./pitch";

/**
 * FIRST-PERSON DRIBBLING — THREE WAVES, ONE TO THREE MEN EACH, THROUGH HIS
 * OWN EYES.
 *
 * Requested directly: a first-person dribbling mode — "you see through his
 * eyes... dribble through players... then be left with a chance to pass or
 * shoot" — built to feel like a real decision under time pressure rather
 * than "basically just aim and tap". This is NOT an extension of
 * `dribble.ts`'s existing run: that mechanic is deliberately top-down,
 * stationary-until-woken defenders, one flick to pick a whole LINE through
 * them, and the goal kept off-screen on purpose ("getting through is what
 * earns you the chance, it is not the chance itself"). None of that
 * transfers to a first-person camera — you cannot see a "line" through
 * several men from ground level, only whoever's actually in front of you,
 * right now. So this is a different shape entirely: three WAVES, each one
 * a bank of one to three defenders you meet together — every man in it a
 * single readable moment in his own right — he telegraphs a side, you read
 * it and burst the other way — and the goal is visible and growing from the
 * start, because in first person a growing goal on the horizon IS the sense
 * of progress.
 *
 * Originally shipped as three men engaged strictly one at a time. Changed
 * directly: "instead of three opponents... you have a random chance, so you
 * actually have three rounds instead... each wave has one to three players,
 * randomly placed on that line to start with, and then... they try to get
 * the ball off of you just like they normally do." Every man in a wave still
 * runs the exact same one-on-one duel machine below, completely
 * independently of the others in his wave — the only thing that changed is
 * how many of them there are and that they're placed across the corridor
 * BEFORE you reach them, not spawned on your lane the moment you do (see
 * "Placement" below).
 *
 * Pure simulation: no React, no canvas, no input handling, no camera. The
 * component feeds it a lane target and a burst direction; everything that
 * decides anything is here — same split `dribble.ts` already uses, and the
 * same "mutate the state, return the outcome" step shape
 * (`stepDribble(state, dt): DribbleOutcome`), not an immutable `step(s) => s`.
 *
 * ── Why a telegraph, and why each duel is still fair on its own ──
 *
 * A duel resolves on ONE number: lateral separation from the defender at the
 * moment he reaches you. Every mechanic — mirroring, lag, the telegraph
 * window, the lunge, your burst — feeds that one scalar, which is what makes
 * the whole thing testable: a scripted "read the telegraph, burst away from
 * it" oracle should win almost every time, and a scripted "do nothing"
 * should lose every time. If either of those isn't true, the duel isn't
 * actually fair, and the arithmetic below exists so it starts out that way
 * rather than being tuned by feel after the fact — and it's exactly as true
 * with three men in a wave as with one, because nothing about an individual
 * duel changed, only how many can be live in front of you together:
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
 * ── Placement: visible in advance, spread across the corridor ──
 *
 * Told directly to place them, not spawn them: each wave's men are given
 * real lanes at construction, before the run even starts — spread across
 * even bands of the corridor (`placeWave`) so a wave of two or three always
 * leaves at least one real gap, never stacked on top of each other. This
 * replaces the original single-defender "lazy spawn" (he used to snap onto
 * YOUR exact lane the instant he engaged, specifically so pre-placing him
 * couldn't let one touchline be hugged safely in advance — see the git
 * history here for that reasoning). That protection mattered most for
 * exactly one defender with the whole corridor to place him in; it matters
 * less once a wave already occupies multiple bands across the width, and it
 * is directly at odds with "randomly placed on that line to start with" —
 * so for a wave, visible-in-advance is the point, not a fairness hole. Once
 * engaged (`ENGAGE_D`), each man's lagged `read` starts from HIS OWN real
 * lane rather than snapping to yours, so he closes in the same mirroring way
 * a lazily-spawned man always did.
 *
 * ── Difficulty scaling ──
 *
 * A stronger defender does not move faster in some unreadable way — he
 * TELEGRAPHS LESS (smaller `tellT`). That is the one difficulty knob that
 * preserves fairness as it climbs: the window narrows, it never becomes a
 * guess. Scales by WAVE now (every man in a wave shares that wave's
 * strength factor) rather than by an individual's position in a single
 * flat sequence.
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
  /** Which wave he belongs to (0-based) — see `FpRunState.roundSizes` and
   *  `placeWave`. Every man in the same wave engages together. */
  round: number;
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
  /** How many men are in each wave (`defenders` is grouped by wave, in
   *  order) — length is the number of waves, e.g. `[2, 1, 3]`. */
  roundSizes: number[];
  /** Which wave is currently live — every man in it engages together, all
   *  independently of one another. -1 once every wave is resolved (or
   *  before any has engaged). */
  activeRound: number;
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
/** Exported for tests only: reading a telegraph correctly now means bursting
 *  away from where his lunge will actually LAND (his current lane +
 *  commitSide*LUNGE_REACH), not just "the opposite of commitSide" — the two
 *  were the same thing when a defender always spawned on your exact lane,
 *  but a wave's men are placed across the corridor and don't always fully
 *  close that lateral gap before committing (see `placeWave`'s own header). */
export const LUNGE_REACH = 1.1;
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

/** How many men in a wave — "one to three players", uniformly. */
function waveSize(rng: () => number): number {
  return 1 + Math.floor(rng() * 3);
}

/**
 * Real lanes for a wave's men — spread across even bands of the corridor so
 * a wave of two or three always leaves at least one real gap between any
 * two of them, never stacked on top of each other. See the file header's
 * "Placement" section on why they're placed here, upfront, rather than
 * spawned lazily the way the original single defender was.
 */
/**
 * Genuinely random, not one-per-band. An earlier version split the corridor
 * into `size` equal bands and placed one man in each — which sounds like
 * "spread across the line" but actually GUARANTEES one man on your left and
 * one on your right for every wave of two or more, every single time (measured
 * directly: a wave of three cleared under a scripted "read every telegraph
 * correctly" oracle only ~6% of the time, because you start pinched between
 * a left-band man and a right-band man before you've done anything at all —
 * no burst clears both at once). Real random placement can by chance put
 * every man on the SAME side and leave the other side wide open, which is
 * both the honest reading of "randomly placed" and the escapable case a
 * burst is actually meant to exploit. `minGap` only stops two men literally
 * overlapping — it is not a fairness mechanism.
 */
function placeWave(size: number, rng: () => number): number[] {
  const width = CORRIDOR_HALF * 2;
  const minGap = Math.min(2.2, width / (size + 1));
  const xs: number[] = [];
  for (let i = 0; i < size; i++) {
    let x = CX - CORRIDOR_HALF + rng() * width;
    for (let tries = 0; tries < 20 && xs.some(o => Math.abs(o - x) < minGap); tries++) {
      x = CX - CORRIDOR_HALF + rng() * width;
    }
    xs.push(x);
  }
  return xs;
}

/**
 * Set up a run.
 *
 * Three waves by default, each one to three men, ramped from a slightly
 * easier first wave to a tougher last one — the ramp is entirely in
 * `tellT` (see the file header): a stronger defender telegraphs less,
 * never moves in some way you can't react to at all.
 */
export function newRun(opts: {
  pace: number;
  oppStrength: number;
  rounds?: number;
  rng: () => number;
}): FpRunState {
  const { rng } = opts;
  const roundCount = opts.rounds ?? 3;

  const defenders: FpDefender[] = [];
  const roundSizes: number[] = [];
  for (let r = 0; r < roundCount; r++) {
    const size = waveSize(rng);
    roundSizes.push(size);
    const factor = roundCount > 1 ? 0.85 + 0.15 * (r / (roundCount - 1)) : 1.0;
    const str = clamp(opts.oppStrength, 0, 100) * factor;
    const y = START_Y - FIRST_DUEL_DEPTH - DUEL_GAP * r;
    for (const x of placeWave(size, rng)) {
      defenders.push({
        x,
        y,
        phase: "waiting",
        // Starts reading from his OWN real lane, not yours — he hasn't
        // been lazily snapped onto it (see the file header).
        read: x,
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
        round: r,
      });
    }
  }

  return {
    x: CX,
    y: START_Y,
    laneTarget: CX,
    speed: runSpeed(opts.pace),
    burst: null,
    defenders,
    roundSizes,
    activeRound: defenders.length > 0 ? 0 : -1,
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

/** Advance one defender by one tick. Every man in the active wave is
 *  stepped this way, independently — see `stepRun`. */
function stepDefender(idx: number, s: FpRunState, sdt: number): void {
  const def = s.defenders[idx];
  switch (def.phase) {
    case "waiting": {
      const d = s.y - def.y;
      if (d <= ENGAGE_D) {
        def.phase = "closing";
        // His `read` already starts at his own real lane (set in newRun —
        // he was placed, not lazily spawned; see the file header), so
        // nothing to reset here beyond the phase itself.
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

  // Only the frontmost unresolved WAVE is ever live — but every man inside
  // it steps independently this tick, not just one at a time (see the file
  // header). `defenders` is built wave-by-wave in `newRun`, so the first
  // unresolved entry's `round` is genuinely the lowest unresolved wave.
  let activeRound = -1;
  for (const d of s.defenders) {
    if (d.phase !== "beaten" && d.phase !== "won") { activeRound = d.round; break; }
  }
  s.activeRound = activeRound;
  if (activeRound >= 0) {
    for (let i = 0; i < s.defenders.length; i++) {
      const d = s.defenders[i];
      if (d.round !== activeRound || d.phase === "beaten" || d.phase === "won") continue;
      stepDefender(i, s, sdt);
      if (s.phase !== "running") break; // one of them won the ball — stop immediately
    }
    // The world only stays slowed while SOMEONE in the wave is actually
    // telegraphing — with up to three men able to commit at different
    // moments, a single shared timeScale has to reflect all of them, not
    // just whichever one happened to set it last.
    s.timeScale = s.defenders.some(d => d.round === activeRound && d.phase === "telegraph") ? TELE_SLOW : 1;
  } else {
    s.timeScale = 1;
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
