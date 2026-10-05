import { CX } from "./pitch";
import { oldDribble } from "./gameplayVersion";
import { getTuning } from "./tuningStore";

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
 * a bank of one to four defenders you meet together — every man in it a
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
 *
 * ── Why a wave used to crowd you, and `press` fixes it ──
 *
 * Reported directly, after actually playing it: "everyone just goes to
 * where the ball is... they just leave huge gaps [everywhere else]... it's
 * basically impossible if you get unlucky and get four players." True, and
 * exactly what the code did: every man in a wave mirrored YOUR lane
 * independently and identically (`closing`'s `read` chases `s.x`, same
 * lag/speed for all of them) — the whole point of placing a wave across
 * the corridor was to leave real gaps, but nothing stopped every man
 * closing on the SAME gap (you) at once regardless of how far he started.
 * A back four that all sprint to the ball is not a defence, it's a scrum.
 *
 * `press` fixes this at construction, once, per wave — ranked by each
 * man's distance from your fixed starting lane (`CX`), same "visible in
 * advance" spirit as placement itself: whoever starts closest presses at
 * full mirrorSpeed, exactly as a solo defender always has (so a one-man
 * wave, and the nearest man in any wave, is untouched — same math, same
 * tests). Teammates farther out press less (`PRESS_STEPS`), so they hold
 * more of their own starting ground instead of fully closing the lateral
 * gap before they commit — some of them end up laterally far enough from
 * you at commit that they were never a real threat, which is the actual
 * "leaves a real gap" a spread defence is supposed to produce. Commit
 * timing (purely depth-based) and the telegraph/lunge fairness math for
 * whoever DOES end up close are completely untouched — this only changes
 * how far a wave's outer men are willing to drift off their own line to
 * get there.
 */

export interface Vec2 { x: number; y: number; }

/**
 * A real opposing outfielder — deliberately its OWN minimal shape, the same
 * decoupling `OpponentSheetPlayer` (lib/star/lineup.ts) already uses,
 * rather than importing canvasEngine.ts's full `Identity` into what has
 * always been a standalone simulation file with zero engine coupling.
 * `defending` (falling back to `overall`) is the one real number this file
 * reads — see `newRun`'s own doc on why.
 */
export interface FpIdentity {
  id: string;
  name?: string;
  shortName?: string;
  face?: string;
  defending?: number;
  overall?: number;
}

/** "passed": you played it to a team-mate and it arrived (see `applyPass`).
 *  A pass that does not arrive ends the run as "lost", like a tackle. */
export type RunPhase = "running" | "clear" | "lost" | "passed";

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
  /** 0-1, how hard he presses toward your actual lane while closing — see
   *  `newRun`'s ranking below. 1.0 for a solo wave or a wave's nearest man;
   *  smaller for his teammates, so a bank of three or four doesn't collapse
   *  onto the exact same spot (see the file header, "Why a wave used to
   *  crowd you"). Only scales the CLOSING phase's lateral mirror — commit
   *  timing (depth-based) and the lunge/telegraph fairness math are
   *  untouched, so a man who DOES end up close still duels exactly as fairly
   *  as ever. */
  press: number;
  /** The real man this figure is, when `newRun` was given a roster — see
   *  its own doc. Purely who to draw a face and a name for; nothing in
   *  `stepDefender`'s own duel math reads this, only his `defending`/
   *  `overall` (already folded into mirrorSpeed/lagT/closeSpeed/tellT at
   *  construction, same as every other defender). */
  who?: FpIdentity;
}

export interface FpBurst {
  dir: -1 | 1;
  /** Seconds into the burst. */
  t: number;
  /** Metres of lateral travel already delivered, so the ease-out is exact
   *  regardless of frame rate. */
  done: number;
  /** 0-1, fixed the instant the burst fires — see `applyBurst`'s own
   *  header on why a burst fired too late is deliberately mostly wasted. */
  power: number;
}

/**
 * A team-mate in the background, offering himself for a pass (Leo, 5 Oct
 * 2026: "passing options in background that will be difficult (varying
 * difficulty) to pass to at any moment during dribbling"). He runs with you,
 * ahead and out wide (or through the middle), drifting, so the ball to him is
 * easy one moment and cut out the next. Only built when `newRun` is given
 * `mates`; without it a run has none and plays exactly as before.
 */
export interface FpMate {
  x: number;
  y: number;
  /** -1 left flank, 1 right flank, 0 the man through the middle. */
  lane: -1 | 0 | 1;
  /** His lateral spot, metres from the centre line, and how far he sways off it. */
  baseOff: number;
  swayAmp: number;
  /** Metres ahead of you he holds, and how far that breathes in and out. */
  baseLead: number;
  leadAmp: number;
  /** Sway speed (rad/s) and phase, so no two men move in step. */
  w: number;
  phi: number;
  /** 0 (a simple ball) → 1 (near impossible), re-read every tick from
   *  distance, defenders in the lane, a man marking him, and how straight
   *  through the ball is. See `passDifficulty`. */
  difficulty: number;
  who?: FpIdentity;
}

/** What `applyPass` decided. */
export interface FpPassResult {
  /** Index into `mates`. */
  to: number;
  success: boolean;
  difficulty: number;
  /** The chance of it arriving, as rolled against. */
  chance: number;
  /** Waves fully beaten before the ball was played. */
  afterWaves: number;
  totalWaves: number;
  /** Where he was when he received it (pitch metres). */
  at: Vec2;
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
  /** Team-mates offering a pass — empty unless `newRun` was given `mates`. */
  mates: FpMate[];
  /** Set once a pass is played (arrived or not). */
  pass: FpPassResult | null;
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
/** `press` by rank within a wave, nearest-to-you first — see the file
 *  header's "Why a wave used to crowd you" section. Rank 0 (or a solo
 *  wave) is always 1.0, so nothing changes for the case the original
 *  fairness math and tests were built against. Ranks beyond this list
 *  (a fifth-plus man, not currently reachable — waves cap at four) fall
 *  back to the last entry rather than a hole. */
/** Was [1.0, 0.62, 0.4, 0.25] until 5 Oct 2026; a wave's outer men now
 *  close the gap a little more ("harder"), still nothing like a scrum. */
const PRESS_STEPS = [1.0, 0.72, 0.5, 0.32];
/** Settings → Gameplay → Dribble runs: Old — the press and last-wave ramp from before 5 Oct 2026. */
const PRESS_STEPS_BEFORE = [1.0, 0.62, 0.4, 0.25];
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

/** Fisher-Yates off the run's own seeded rng — never mutates its input. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function runSpeed(pace: number): number {
  return BASE_SPEED + clamp(pace, 0, 100) / 100 * PACE_SPEED;
}

/** How many men in a wave — "one to four players", uniformly. */
function waveSize(rng: () => number): number {
  return 1 + Math.floor(rng() * 4);
}

/**
 * Decide every wave's size upfront, for a caller that needs a hard ceiling
 * on the run's total defender count — real gameplay, not the dev sandbox
 * (see `newRun`'s own `waveSizes` param). Requested directly: two to four
 * waves, one to four men each, but never more than ten shown across the
 * whole run — "because in a real match there's only eleven players, and
 * one of them is a goalkeeper." The cap is a hard ceiling, not a target:
 * if an early wave's random roll eats most of the budget, a later wave
 * (even one within `minRounds`) shrinks to whatever is left, and the run
 * can end up with FEWER waves than `maxRounds` would suggest rather than
 * ever exceeding `maxTotal` — `minRounds` is always reachable regardless
 * (worst case `maxRounds` waves of 1 each is 4, well under a sane cap),
 * so only the generous end of the range ever gets trimmed.
 */
export function pickWaveSizes(rng: () => number, opts?: {
  minRounds?: number; maxRounds?: number; minSize?: number; maxSize?: number; maxTotal?: number;
}): number[] {
  const minRounds = opts?.minRounds ?? 2;
  const maxRounds = opts?.maxRounds ?? 4;
  const minSize = opts?.minSize ?? 1;
  const maxSize = opts?.maxSize ?? 4;
  const maxTotal = opts?.maxTotal ?? 10;
  const roundCount = minRounds + Math.floor(rng() * (maxRounds - minRounds + 1));

  const sizes: number[] = [];
  let total = 0;
  for (let r = 0; r < roundCount; r++) {
    const remaining = maxTotal - total;
    if (remaining < minSize) break;
    const cap = Math.min(maxSize, remaining);
    const size = minSize + Math.floor(rng() * (cap - minSize + 1));
    sizes.push(size);
    total += size;
  }
  return sizes;
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
 * Three waves by default, each one to four men, ramped from a slightly
 * easier first wave to a tougher last one — the ramp is entirely in
 * `tellT` (see the file header): a stronger defender telegraphs less,
 * never moves in some way you can't react to at all.
 */
export function newRun(opts: {
  pace: number;
  oppStrength: number;
  rounds?: number;
  /** Precomputed wave sizes (see `pickWaveSizes`) — overrides both `rounds`
   *  and the internal random 1-4-per-wave roll when given, so a caller that
   *  needs a hard ceiling on the run's total defender count can decide
   *  every wave's size upfront instead of letting each one roll
   *  independently. The dev sandbox and existing tests don't pass this, so
   *  they keep rolling each wave's size exactly as before. */
  waveSizes?: number[];
  /**
   * Real opposing outfielders to cast this run's men from, instead of every
   * defender sharing the one flat `oppStrength` number — the same "players
   * play like themselves" ask that gave the match engine real curl and real
   * defenders. Shuffled once up front (so which real man lands in which
   * wave/lane still varies run to run) and cycled across however many
   * defenders the run actually builds, wrapping around if the run needs
   * more men than the roster has. A real man's own `defending` (falling
   * back to his `overall`, then to `oppStrength`) REPLACES the flat number
   * for his own mirrorSpeed/lagT/closeSpeed/tellT — it does not stack on
   * top of it — so the existing wave-to-wave ramp (`factor`, unchanged)
   * still applies on top of a real man's own quality exactly the way it
   * always applied to the flat one. Omit (the dev sandbox, every existing
   * test) and every man is exactly as anonymous and exactly as governed by
   * `oppStrength` alone as before — unchanged.
   */
  roster?: FpIdentity[];
  /**
   * Team-mates offering a pass during the run (0 = none, the default — the
   * trial, training and every existing test). 2 = one on each flank, 3 adds
   * a man through the middle. Built AFTER the defenders, so the defenders a
   * seed gives are identical with or without them.
   */
  mates?: number;
  /** Real team-mates to put in those shirts (names/faces only). */
  mateRoster?: FpIdentity[];
  /** true = the defenders from before 5 Oct 2026. Absent = Settings → Gameplay → Dribble runs. */
  classic?: boolean;
  rng: () => number;
}): FpRunState {
  const { rng } = opts;
  const classic = opts.classic ?? oldDribble();
  const roundCount = opts.waveSizes?.length ?? opts.rounds ?? 3;
  const roster = opts.roster && opts.roster.length > 0 ? shuffle(opts.roster, rng) : null;
  let rosterIdx = 0;

  const defenders: FpDefender[] = [];
  const roundSizes: number[] = [];
  for (let r = 0; r < roundCount; r++) {
    const size = opts.waveSizes ? opts.waveSizes[r] : waveSize(rng);
    roundSizes.push(size);
    // The ramp from first wave to last: 0.85 → 1.08 (was 0.85 → 1.0 until
    // 5 Oct 2026), so the last wave is a real step up, not more of the same.
    const factor = roundCount > 1 ? 0.85 + (classic ? 0.15 : 0.23) * (r / (roundCount - 1)) : 1.0;
    const y = START_Y - FIRST_DUEL_DEPTH - DUEL_GAP * r;
    const xs = placeWave(size, rng);
    // Rank this wave's men by distance from your fixed starting lane —
    // nearest presses hardest (see PRESS_STEPS / the file header). Ranking
    // at construction, off the same fixed CX placement already uses, keeps
    // a wave's whole shape decided upfront rather than shifting mid-run.
    const order = xs.map((_, i) => i).sort((a, b) => Math.abs(xs[a] - CX) - Math.abs(xs[b] - CX));
    const press = new Array<number>(size);
    const steps = classic ? PRESS_STEPS_BEFORE : PRESS_STEPS;
    order.forEach((i, rank) => { press[i] = steps[Math.min(rank, steps.length - 1)]; });
    xs.forEach((x, i) => {
      const who = roster ? roster[rosterIdx++ % roster.length] : undefined;
      const manQuality = who
        ? clamp(who.defending ?? who.overall ?? opts.oppStrength, 0, 100)
        : clamp(opts.oppStrength, 0, 100);
      const str = manQuality * factor;
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
        // The telegraph never shortens past strength 100, even on the last
        // wave's 1.08 ramp: 0.45 s wall-clock from tell to contact is the
        // phone floor (tests/star/firstPersonDribble.mts). "Harder" (5 Oct
        // 2026) comes from how hard they close, never from an unreadable tell.
        tellT: TELL_BASE * (1.25 - (Math.min(100, str) / 100) * 0.5),
        tell: 0,
        commitSide: 1,
        bias: rng() < 0.5 ? -1 : 1,
        lungeFrom: 0,
        lunge: 0,
        round: r,
        press: press[i],
        who,
      });
    });
  }

  const mates: FpMate[] = [];
  const mateCount = Math.max(0, Math.min(3, Math.floor(opts.mates ?? 0)));
  for (let i = 0; i < mateCount; i++) {
    const lane: -1 | 0 | 1 = i === 0 ? -1 : i === 1 ? 1 : 0;
    const central = lane === 0;
    mates.push({
      x: 0, y: 0, lane,
      baseOff: central ? (rng() - 0.5) * 3 : lane * (5 + rng() * 2.5),
      swayAmp: central ? 1.5 + rng() * 1.5 : 1.2 + rng() * 2,
      baseLead: central ? 16 + rng() * 6 : 7 + rng() * 5,
      leadAmp: 2 + rng() * 3,
      w: 0.9 + rng() * 0.9,
      phi: rng() * Math.PI * 2,
      difficulty: 0,
      who: opts.mateRoster && opts.mateRoster.length ? opts.mateRoster[i % opts.mateRoster.length] : undefined,
    });
  }

  const run: FpRunState = {
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
    mates,
    pass: null,
  };
  for (const m of run.mates) placeMate(run, m, 0, true);
  return run;
}

/** Continuous lane request, in pitch metres. Call on every pointer move. */
export function applySteer(s: FpRunState, laneTarget: number): void {
  s.laneTarget = clamp(laneTarget, s.minX, s.maxX);
}

/** The nearest still-live man in the currently active wave — whoever a
 *  burst fired right now would actually be judged against. */
function nearestLiveInActiveRound(s: FpRunState): FpDefender | undefined {
  let best: FpDefender | undefined;
  for (const d of s.defenders) {
    if (d.round !== s.activeRound || d.phase === "beaten" || d.phase === "won") continue;
    if (!best || s.y - d.y < s.y - best.y) best = d;
  }
  return best;
}

/**
 * The decisive knock past him. Returns false if a burst is still locked out
 * from the last one — the component can use that to ignore a double-flick
 * rather than silently swallowing it.
 *
 * Reported directly, after actually playing this: "swipe left or right...
 * you get past them every single time, you don't even have to time it."
 * Measured directly against the sim (a scratch harness, same idiom as every
 * other measured number in this file): reading the telegraph correctly and
 * bursting the instant it starts, or a while into it, or right as it ends,
 * ALL clear at roughly the same ~90%+ rate — the window was real (a burst
 * fired blind during "closing" already only clears ~4% of the time, and
 * one fired well after commit falls off fast) but it had no genuinely
 * PUNISHING edge right where it mattered: firing the instant his telegraph
 * ends and he's already committed still cleared about a third of the time,
 * which reads to a player as "no real deadline" rather than "you missed it."
 * A burst now only delivers its full, decisive kick while he's actually
 * telegraphing — the one moment this whole mechanic is built to test
 * reading. Fired once he's already committed, it's mostly wasted: his own
 * lunge is by then a fixed, non-reactive function of time (see
 * `stepDefender`'s "committed" case), so "I'll just react whenever" no
 * longer has anywhere to hide.
 */
export function applyBurst(s: FpRunState, dir: -1 | 1): boolean {
  if (s.phase !== "running" || s.burst || s.burstLock > 0) return false;
  const threat = nearestLiveInActiveRound(s);
  const power = threat?.phase === "committed" ? 0.3 : 1;
  s.burst = { dir, t: 0, done: 0, power };
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
      // `press` caps how fast he's willing to actually cover ground toward
      // that read, not the read itself — see the file header. At 1.0
      // (a solo wave, or a wave's nearest man) this is exactly the original
      // mirrorSpeed clamp; a teammate farther out moves toward you slower,
      // so he genuinely can't fully close a wide starting gap before he
      // commits, and stays a real, exploitable gap instead of arriving
      // late to the same spot everyone else did.
      const mirror = def.mirrorSpeed * def.press;
      def.x += clamp(def.read - def.x, -mirror * sdt, mirror * sdt);
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
    const target = BURST_LATERAL * b.power * f;
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

  for (const m of s.mates) placeMate(s, m, sdt, false);

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

// ── Passing options ─────────────────────────────────────────────────────────
//
// Leo, 5 Oct 2026: "passing options in background that will be difficult
// (varying difficulty) to pass to at any moment during dribbling, obvs better
// chance reward for dribbling more waves then passing compared to like
// passing after 1/3 waves." The reward lives in lib/star/dribbleReward.ts;
// here is who is free, how hard the ball to him is, and whether it arrives.

/** Never nearer the goal line than this — he is in front of you, not in the net. */
const MATE_MIN_Y = 4;
/** m/s a team-mate can shift sideways — they drift, they do not teleport. */
const MATE_SHIFT = 4.5;
/** Difficulty bands, for the ring drawn under each man. */
export const PASS_EASY_BELOW = 0.33;
export const PASS_HARD_FROM = 0.6;

export type PassBand = "easy" | "medium" | "hard";
export function passBand(difficulty: number): PassBand {
  return difficulty < PASS_EASY_BELOW ? "easy" : difficulty < PASS_HARD_FROM ? "medium" : "hard";
}

/** Move a team-mate one tick (or put him in place at the start). */
function placeMate(s: FpRunState, m: FpMate, sdt: number, snap: boolean): void {
  const t = s.elapsed;
  // Half tied to the corridor, half to you, so he stays a real option on
  // screen without copying your every step.
  const targetX = clamp(0.5 * CX + 0.5 * s.x + m.baseOff + m.swayAmp * Math.sin(m.w * t + m.phi), s.minX - 1, s.maxX + 1);
  const lead = m.baseLead + m.leadAmp * Math.sin(0.7 * m.w * t + 2 * m.phi);
  if (snap) m.x = targetX;
  else m.x += clamp(targetX - m.x, -MATE_SHIFT * sdt, MATE_SHIFT * sdt);
  m.y = Math.max(MATE_MIN_Y, s.y - lead);
  m.difficulty = passDifficulty(s, m);
}

/**
 * How hard the ball to him is right now, 0-1. Four things, all visible on
 * screen: how far he is; a defender standing in the line of the pass (the
 * biggest one — a man in the lane cuts it out); a defender right on him; and
 * how straight through the ball has to be (a ball across is easier to weight
 * than one threaded forward). Beaten men no longer count — which is why the
 * same man is often easy once you have got past the wave in front of him.
 */
export function passDifficulty(s: FpRunState, m: { x: number; y: number }): number {
  const vx = m.x - s.x, vy = m.y - s.y;
  const d2 = vx * vx + vy * vy;
  const d = Math.sqrt(d2) || 1e-6;
  const distTerm = clamp((d - 7) / 18, 0, 1);
  let block = 0, mark = 0;
  for (const def of s.defenders) {
    if (def.phase === "beaten" || def.phase === "won") continue;
    const px = def.x - s.x, py = def.y - s.y;
    const t = (px * vx + py * vy) / d2;
    if (t > 0.08 && t < 0.95) {
      const perp = Math.hypot(px - t * vx, py - t * vy);
      block = Math.max(block, clamp(1 - perp / 2.4, 0, 1));
    }
    const toMate = Math.hypot(def.x - m.x, def.y - m.y);
    mark = Math.max(mark, clamp(1 - toMate / 3, 0, 1));
  }
  const forward = clamp(-vy / d, 0, 1);
  return clamp(0.08 + 0.35 * distTerm + 0.6 * block + 0.3 * mark + 0.12 * forward, 0, 1);
}

/** The chance a pass of this difficulty arrives: about 4 in 5 on a green ring,
 *  a coin flip on amber, 1 in 8 on red (measured, tests/star/firstPersonDribble.mts). `vision` 0-100 (55 = average) is
 *  worth about ±9 points either way at the extremes. */
export function passSuccessChance(difficulty: number, vision = 55): number {
  const d = clamp(difficulty, 0, 1);
  return clamp(getTuning("dribble.passBest") - 0.5 * d - 0.9 * d * d + ((clamp(vision, 0, 100) - 55) / 100) * getTuning("dribble.passVision"), 0.05, 0.95);
}

/** Waves whose every man is beaten. */
export function wavesBeaten(s: FpRunState): number {
  let n = 0;
  for (let r = 0; r < s.roundSizes.length; r++) {
    if (s.defenders.filter(d => d.round === r).every(d => d.phase === "beaten")) n++;
  }
  return n;
}

/**
 * Play it to team-mate `idx`. Rolled against his difficulty this instant. If
 * it arrives the run ends "passed"; if not it is lost, like a tackle (no
 * defender is credited, `lostTo` stays null). Returns null — nothing happens —
 * if the run is already over or there is no such man.
 */
export function applyPass(s: FpRunState, idx: number, vision = 55): FpPassResult | null {
  if (s.phase !== "running") return null;
  const m = s.mates[idx];
  if (!m) return null;
  const difficulty = passDifficulty(s, m);
  const chance = passSuccessChance(difficulty, vision);
  const success = s.rng() < chance;
  const result: FpPassResult = {
    to: idx, success, difficulty, chance,
    afterWaves: wavesBeaten(s), totalWaves: s.roundSizes.length,
    at: { x: m.x, y: m.y },
  };
  s.pass = result;
  s.phase = success ? "passed" : "lost";
  if (!success) s.lostTo = null;
  s.timeScale = 1;
  return result;
}

/** How far through the run you are, 0-1. For a progress bar / HUD. */
export function runProgress(s: FpRunState): number {
  const total = s.startY - s.clearY;
  if (total <= 0) return 1;
  return clamp((s.startY - s.y) / total, 0, 1);
}

// ── The chase camera's shoulder lean (a picture only — the run never reads it) ──
//
// Harry, 2 Oct 2026, playing the trial's Take Him On: "the changing of the
// camera angle is a bit crazy." The C1 camera leans to whichever side the
// ball is on and aims at a point ahead of you, so every touch across your
// body swung it from one shoulder to the other: about 22° of turn in about
// half a second. The calm feel swaps shoulder only once the ball is clearly
// across (0.5 m, not 0.15 m), eases there 2.5 times more slowly, and slides
// after your lane at 3/s, not 5.5/s. It keeps the full lean: a half lean was
// tried and, now that your player is drawn again, it put the ball on his
// back (seen in a still at 390x844).
// The real match keeps the lively feel (FirstPersonDribble's `calmCamera`).
export interface CameraFeel {
  /** Share of the camera's own lean (`CamPose.side`) actually used. */
  sideScale: number;
  /** How far across (m) the ball must be before the lean swaps sides. */
  flipAt: number;
  /** /s, how fast the lean eases to its target. */
  sideRate: number;
  /** /s, how fast the camera slides after your lane (an upper limit). */
  followRate: number;
}
export const LIVELY_CAMERA: CameraFeel = { sideScale: 1, flipAt: 0.15, sideRate: 3, followRate: 5.5 };
export const CALM_CAMERA: CameraFeel = { sideScale: 1, flipAt: 0.5, sideRate: 1.2, followRate: 3 };

/** One frame of the lean: which shoulder, and how far over the camera is now. */
export function stepCameraLean(
  lean: { dir: 1 | -1; side: number },
  ballOff: number, poseSide: number, feel: CameraFeel, dt: number,
): { dir: 1 | -1; side: number } {
  let dir = lean.dir;
  if (ballOff > feel.flipAt) dir = 1;
  else if (ballOff < -feel.flipAt) dir = -1;
  const side = lean.side + (dir * poseSide * feel.sideScale - lean.side) * (1 - Math.exp(-feel.sideRate * dt));
  return { dir, side };
}

// ── Where the carried ball is DRAWN (a picture only — the run never reads it) ──
//
// Harry, 2 Oct 2026, on the trial's Take Him On: the ball drew on the
// player's hip. The real cause was two things, both in the picture:
//
//  1. Draw order. The ball is always AHEAD of you, so from a camera behind
//     you it is always FARTHER away than your body. It was drawn on top of
//     your shorts, shirt and arms anyway, so wherever its sight line crossed
//     your body it was painted onto it.
//  2. Where it sat. 1.6 m ahead, dead centre. From the C1 camera (2.4 m up,
//     2.8 m behind) a ground point 1.6 m beyond your boots lines up with your
//     waist — every point ahead of you lines up with some height on your
//     body, and the farther ahead, the higher. The camera's lean only moved
//     that sight line 0.47 m sideways, which is inside your drawn arm (0.44 m
//     out), so it landed on your hand and hip.
//
// The fix: carry it the way a dribbler does, close and just outside the
// boot on the camera's side (`restFootX`), touched forward once a stride by
// that foot (`carryLead`). Close means its sight line crosses your body at
// thigh height, not waist height; outside the boot means it crosses beside
// you, not through you. Then it can be drawn in true depth order (behind
// you) and still be seen — your own boot passes in front of it as you touch
// it, which is what a ball at your feet looks like.
// tests/star/fpBallCarry.mts measures it against the drawn body.

/** Metres run per full gait cycle of your own figure (both feet once). */
export const OWN_GAIT_M = 1.4;

export const CARRY = {
  /** Metres out from your centre line the ball rests: just outside the boot. */
  restFootX: 0.36,
  /** Metres ahead of your feet at the moment the boot touches it. */
  leadMin: 0.42,
  /** How much farther ahead the touch pushes it before you catch it up. */
  push: 0.34,
  /** Extra lead at the height of a burst (it is knocked on, not carried). */
  burstExtra: 0.5,
} as const;

/**
 * How far ahead of your feet the carried ball is drawn, this frame.
 *
 * One touch per gait cycle, by the foot on the ball's side, at the moment
 * that foot is furthest forward (the render's own gait: the right foot leads
 * at phase 3π/2, the left at π/2, phase = stride / OWN_GAIT_M · 2π). Straight
 * after the touch the ball runs away from you quickly, then you close the
 * gap until the next one.
 *
 * `burst` is 0-1, how far into a burst you are.
 */
export function carryLead(stride: number, footSide: 1 | -1, burst = 0): number {
  const phase = (stride / OWN_GAIT_M) * Math.PI * 2;
  const touchAt = footSide > 0 ? Math.PI * 1.5 : Math.PI * 0.5;
  let u = ((phase - touchAt) / (Math.PI * 2)) % 1;
  if (u < 0) u += 1;
  const away = Math.sin(Math.PI * Math.pow(u, 0.6));
  return CARRY.leadMin + CARRY.push * away + CARRY.burstExtra * clamp(burst, 0, 1);
}
