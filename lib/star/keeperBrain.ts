/**
 * THE KEEPER BRAIN — one goalkeeper, on top of the per-kind rules.
 *
 * Harry, on the plan's item 8: "it's programmed into the goalie to just
 * naturally know the ball is X amount away, positioning to move his body when
 * the arrow is being dragged back to get into a better position. What is the
 * best position for every type of highlight? How long to wait to dive? These
 * could be set into the goalie rather than set into the highlight."
 *
 * And at the v0.15 build: keep the per-kind rule sets (free kick, cutback,
 * penalty dive) AND the brain on top, scaled by the keeper's rating; on
 * everywhere, at the "Middle" setting of the one dial.
 *
 *   SET     while you aim: he walks from where the drawing put him toward his
 *           set spot — on the line splitting the angle between the ball and
 *           the two posts, at a depth that comes from the distance — at a
 *           side-step's pace, only part of the way (a worse keeper goes less
 *           of the way and sets worse), and never more than 2.2 m from the
 *           drawn spot (1 m in a tight-angle view).
 *   WAIT    your strike → a human reaction, 0.2-0.3 s. Nothing moves him.
 *   STEP    on his feet: he reads where it will cross his line, shuffles
 *           toward it and keeps reading. Two reads that agree lock his side;
 *           after that a read the other way can only STOP him (wrong-footed).
 *   DIVE    ONE committed dive, left as late as he dares and paced to the
 *           ball — he is still travelling when it gets there, not lying on
 *           the grass waiting for it (Harry: "the dive starts slightly too
 *           early and he reaches the end of it too fast"). His reach shrinks
 *           as he travels (the standing reach already IS a full dive from
 *           where he stands), so only the steps before it buy extra ground.
 *   ENGINE  the save is judged where it always was (canvasEngine.ts, "THE
 *           KEEPER'S OWN LINE"). The one hook he uses there is
 *           `Keeper.committedDir`, shared with the penalty keeper: a
 *           committed keeper is never turned round.
 *
 * The per-kind rules stay theirs:
 *   - a PENALTY: lib/star/penaltyKeeper.ts decides at the strike whether he
 *     goes, which way, how far and with what reach (and whether he reads one
 *     down the middle). The brain throws that dive: a touch after the strike,
 *     paced to the ball, once. A run-up hop (65+) is small, visual, and he
 *     dives the way he hopped.
 *   - a FREE KICK: lib/star/kindRules/freeKick.ts places him and moves him
 *     (the far-post cheat, the reaction once the ball clears the wall). The
 *     brain stands down for free kicks.
 *   - a CUTBACK (and any pass to a team-mate in a cutback): the engine's own
 *     reception shuffle (Keeper.adjusting). The brain takes over at the shot.
 *
 * Every ability is set by his rating, in Harry's shape: nothing below a
 * threshold, then it grows, and grows fast toward elite (`grow`).
 *
 * Design, measurements and the reasoning behind every number:
 * scratchpad design-keeper/keeper-brain.md (27 Sep 2026). Nothing here is in
 * canvasEngine.ts: it writes only the keeper's public fields (x, y, startX,
 * targetX, adjusting, dive, saveDir, saveLunge, committedDir) and
 * Scenario.keeperReach. It never sets `scrambling`: that stays the engine's
 * own signal that it has judged the ball.
 *
 * Pure: no React, no canvas. Its randomness is two seeded streams of its own
 * (one for the set-up, one from the strike), so the match's own random stream
 * is untouched and a goal replay reproduces the same keeper.
 */
import type { Ball, Scenario } from "./canvasEngine";
import { keeperSaveRadius } from "./canvasEngine";
import { CX, POST_L, POST_R } from "./pitch";
import { decidePenaltyRead, penaltyReadFor, type PenaltyReadSettings } from "./penaltyKeeper";
import { testAreaSetting } from "./compareSwitches";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** The brain's own PRNG (mulberry32) — deterministic from a seed. */
export function brainRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A near-normal draw (sum of six uniforms), sd 1. */
function gauss(r: () => number) { let s = 0; for (let i = 0; i < 6; i++) s += r(); return (s - 3) / Math.sqrt(0.5); }

/** Harry's shape: nothing until a threshold T, then it grows, and grows fast toward elite E. */
export function grow(r: number, T: number, E: number, p = 1.6): number {
  return Math.pow(clamp((r - T) / (E - T), 0, 1), p);
}

// ─────────────────────────────────────────────────────────────────────────
//  THE DIALS
// ─────────────────────────────────────────────────────────────────────────

export const KEEPER_BRAIN = {
  /**
   * How far he may walk from where the drawing put him while you aim
   * (Harry, v0.15: "up to 2.2 m", less in a tight-angle view, where the
   * drawing IS the picture and the near post is right there).
   */
  walkCapX: 2.2,
  walkCapY: 1.8,
  walkCapTight: 1.0,
  /** A team-mate receives it: the one step he gets to reset (metres). */
  receptionStep: 0.7,
  /** He re-reads the ball this often while on his feet (s). */
  readEvery: 0.12,
  /** Seconds added to his reaction when you strike while he is still walking. */
  caughtMoving: 0.12,
  /**
   * When he leaves his feet: with this much time in hand beyond what the dive
   * needs at full speed (s). The prototype went 0.05 s early on average and
   * then flew there flat out, so he landed before the ball arrived; Harry saw
   * "the dive starts slightly too early and he reaches the end of it too
   * fast". Later, and paced (below).
   */
  diveLead: 0.0,
  /** His timing error (sd) is scaled by this: a later dive with the old
   *  scatter would be late far more often than before. */
  timingScale: 0.7,
  /** A paced dive never goes slower than this share of his top dive speed. */
  diveSpeedFloor: 0.55,
  /**
   * A penalty: how long after the strike he goes (s). The ball is struck,
   * THEN he goes — a touch later than the prototype's 0.06-0.12.
   */
  penGo: [0.09, 0.15] as [number, number],
  /**
   * A penalty dive's top speed, as a share of his open-play dive speed. He
   * paces his dive to arrive with the ball, so this only bites on a long
   * dive at a hard kick. Tuned with the rule set's dive lengths (v0.15) so a
   * corner scores about 75 % and penalties overall 75-80 % (1,500 kicks).
   */
  penSpeed: 1.6,
  /** A penalty run-up hop: how far across he hops (m). Small, and visual —
   *  it buys him nothing but the side he has chosen. */
  hopM: 0.18,
  /**
   * THE ONE DIAL for how hard long shots and through balls are (Harry's
   * question 1 — he chose the Middle: `OPEN_PLAY_DIAL.middle`). It is how
   * well he reads a shot from DISTANCE — most through balls in this game are
   * finished from 18-25 m, so one dial moves both. The goal of a long shot at
   * a moving keeper is his READ: step into its line and it runs into him (the
   * engine's body check).
   *
   * Middle is 0.55 in the build, not the prototype's 0.4: the one dive is now
   * strict everywhere (a ball behind his dive beats him — canvasEngine's
   * `committedDir`, shared with the penalty keeper), which alone let in 5-9
   * points more long shots. 0.55 puts them back on the prototype's Middle
   * (600 a cell, goals conceded at 45/62/75/88 — prototype → build: long
   * shots 25.3/17.7/12.7/8.7 → 23.5/19.3/15.3/8.5 %, through balls
   * 29.7/25.8/14.8/10.5 → 27.0/21.8/13.8/8.8 %, one-on-ones
   * 38.2/31.0/23.0/17.3 → 38.2/31.7/24.0/17.3 %).
   */
  openPlay: 0.55,
  /** How the dial bites, for a shot from 26 m+ with the dial at 0: his first
   *  read comes this much later (s)… */
  farReadLate: 0.35,
  /** …his read error is this much bigger (×1+)… */
  farReadErr: 3,
  /** …and never sharpens below this share of it. */
  farReadFloor: 1.0,
};

/**
 * The three measured settings of `KEEPER_BRAIN.openPlay`. The game plays the
 * Middle; the Play Area's "Keeper: long shots & through balls" row picks
 * another on the test screens only.
 */
export const OPEN_PLAY_DIAL = { hard: 1, middle: 0.55, easier: 0 } as const;
export type OpenPlayDial = keyof typeof OPEN_PLAY_DIAL;

/** The Play Area's dial (localStorage). Never read in the real game — see compareSwitches.ts. */
export const BRAIN_DIAL_FLAG = "star-keeper-brain-dial";

/** What the dial reads here: this device's Play Area setting on a test screen, else Middle. */
export function openPlayDialHere(): OpenPlayDial {
  const d = testAreaSetting(BRAIN_DIAL_FLAG);
  return d === "hard" || d === "easier" ? d : "middle";
}

/** What a chance's brain is set up with. All optional — absent = the game's own. */
export interface BrainOptions {
  /** The penalty rule set for this keeper (penaltyKeeper.ts's penaltyReadFor,
   *  with the trial's override when there is one). Absent = the real match's. */
  penalty?: PenaltyReadSettings;
  /** 0..1, see KEEPER_BRAIN.openPlay. */
  openPlay?: number;
}

/** The options the match sets a chance up with, on this screen. */
export function brainOptionsHere(): BrainOptions {
  return { openPlay: OPEN_PLAY_DIAL[openPlayDialHere()] };
}

// ─────────────────────────────────────────────────────────────────────────
//  ABILITIES — every one set by his rating
// ─────────────────────────────────────────────────────────────────────────

export interface Abilities {
  rating: number;
  /** Share of the way from his start spot to the ideal set spot he goes while you aim. */
  correction: number;
  /** Metres (sd) of set-position error (lateral; depth uses half). */
  posErr: number;
  /** Chance he sets badly (error ×2.5). */
  badSet: number;
  /** Side-step while you aim, m/s. */
  setSpeed: number;
  /** Mean reaction, strike → first movement, s. */
  rt: number;
  rtSd: number;
  /** Chance of a slow reaction (+lateExtra). */
  lateChance: number;
  lateExtra: number;
  /** Metres (sd) of his first guess of where it crosses his line. */
  readErr: number;
  /** Seconds (sd) of when he chooses to leave his feet (+ early, − late). */
  timingErr: number;
  /** Shuffle on his feet before the dive, m/s. */
  stepSpeed: number;
  /** Once airborne, m/s (his top speed — a paced dive goes slower). */
  diveSpeed: number;
  /** One dive, metres from where he leaves his feet. */
  maxTravel: number;
  /** His reach floor once landed, as a share of the standing reach. */
  diveWindow: number;
  /** A penalty run-up hop: 0 below 65, then a keeper who reads the run-up. */
  anticipStep: number;
}

export function abilities(rating: number): Abilities {
  const r = clamp(Number.isFinite(rating) ? rating : 62, 20, 99);
  return {
    rating: r,
    correction: 0.35 + 0.60 * grow(r, 40, 95, 1.2),
    posErr: 1.0 - 0.80 * grow(r, 40, 95, 1.3),
    badSet: 0.25 - 0.21 * grow(r, 40, 95, 1.0),
    setSpeed: 1.6 + 1.0 * grow(r, 40, 95, 1.0),
    rt: 0.30 - 0.10 * grow(r, 40, 95, 1.2),
    rtSd: 0.035,
    lateChance: 0.18 - 0.15 * grow(r, 40, 95, 1.0),
    lateExtra: 0.15,
    readErr: 1.3 - 0.9 * grow(r, 40, 95, 1.4),
    timingErr: 0.12 - 0.07 * grow(r, 40, 95, 1.2),
    stepSpeed: 1.9 + 0.7 * grow(r, 40, 95, 1.0),
    diveSpeed: 4.8 + 1.4 * grow(r, 40, 95, 1.2),
    maxTravel: 2.4 + 0.8 * grow(r, 40, 95, 1.5),
    diveWindow: 0.33 + 0.10 * grow(r, 40, 95, 1.0),
    anticipStep: 0.9 * grow(r, 65, 95, 1.6),
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  WHERE HE WANTS TO BE
// ─────────────────────────────────────────────────────────────────────────

function unit(x: number, y: number) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }

/** Where the bisector of the angle (ball→left post, ball→right post) crosses depth `d`. */
export function bisectorX(ball: { x: number; y: number }, d: number, l = POST_L, r = POST_R): number {
  const a = unit(l - ball.x, 0 - ball.y), b = unit(r - ball.x, 0 - ball.y);
  const bis = unit(a.x + b.x, a.y + b.y);
  if (bis.y >= -1e-6) return (l + r) / 2;
  const t = (d - ball.y) / bis.y;
  return ball.x + bis.x * t;
}

/** How far off his line a keeper wants to be for a ball this far away (open play). */
export function idealDepth(ball: { x: number; y: number }): number {
  const D = Math.hypot(ball.x - CX, ball.y);
  const ang = Math.atan2(Math.abs(ball.x - CX), Math.max(0.5, ball.y));
  const central = clamp(3.6 - 0.10 * D, 0.9, 3.0);
  const wideCut = 1 - 0.5 * Math.sin(ang);
  return clamp(central * wideCut, 0.8, Math.max(0.8, ball.y - 4));
}

/** How far he may walk from the drawn spot for this kind of chance. */
export function walkCapFor(kind: string): { x: number; y: number } {
  if (kind === "tight_angle") return { x: KEEPER_BRAIN.walkCapTight, y: KEEPER_BRAIN.walkCapTight };
  return { x: KEEPER_BRAIN.walkCapX, y: KEEPER_BRAIN.walkCapY };
}

// ─────────────────────────────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────────────────────────────

export type BrainPhase = "set" | "wait" | "step" | "dive" | "engine";

/**
 * The plain-data part of his state: everything a goal replay needs to put him
 * back exactly as he was at the strike. Saved with the replay (GoalReplay.keeperBrain).
 */
export interface KeeperBrainSnapshot {
  rating: number;
  kind: string;
  start: { x: number; y: number };
  setTarget: { x: number; y: number };
  moving: boolean;
  baseReach: number | null;
  opts: BrainOptions;
  /** The side he hopped in a penalty run-up (0 = no hop). */
  hopSide?: number;
  /** The strike stream's seed. */
  strikeSeed: number;
}

interface State {
  ab: Abilities;
  opts: BrainOptions;
  kind: string;
  start: { x: number; y: number };
  setTarget: { x: number; y: number };
  moving: boolean;
  baseReach: number | undefined;
  /** The set-up stream until the strike, then the strike's own stream. */
  rng: () => number;
  strikeSeed: number;
  phase: BrainPhase;
  /** Seconds since the shot he is reacting to was struck. */
  t: number;
  rt: number;
  dir: number;
  target: number;
  stepTravelled: number;
  diveTravelled: number;
  nextReadT: number;
  reads: number;
  timingErr: number;
  locked: boolean;
  diveFloor: number;
  /** A penalty: his reach share while diving, from the rule set. */
  penFloor: number;
  /** A penalty run-up: the side he hopped (0 = none). */
  hopSide: number;
  /** 0..1: how much harder this shot is to read, from the open-play dial and its distance. */
  farRead: number;
  lastShot: boolean;
  ownShot: boolean;
  lastRecv: unknown;
  planted: boolean;
  /** Plain-English "why" for the pictures (caught moving / stayed / wrong-footed…). */
  reason: string;
  // ── for the pictures and the measurements ──
  moveAtT: number | null;
  stepAtT: number | null;
  diveAtT: number | null;
  wrongFooted: boolean;
}

const states = new WeakMap<Scenario, State>();

/** Read-only view of his state, for the dev probe and the measurements. */
export function brainStateOf(sc: Scenario | null | undefined) {
  const st = sc ? states.get(sc) : undefined;
  if (!st) return null;
  return {
    phase: st.phase, t: st.t, rt: st.rt, dir: st.dir, target: st.target, reads: st.reads,
    locked: st.locked, moving: st.moving, reason: st.reason, setTarget: { ...st.setTarget },
    start: { ...st.start }, moveAtT: st.moveAtT, stepAtT: st.stepAtT, diveAtT: st.diveAtT,
    wrongFooted: st.wrongFooted, diveFloor: st.diveFloor, rating: st.ab.rating,
    stepTravelled: st.stepTravelled, diveTravelled: st.diveTravelled, hopSide: st.hopSide,
  };
}

/** Does this chance have a brain? (A free kick, or a scene with no keeper, = no.) */
export function hasBrain(sc: Scenario): boolean { return states.has(sc); }

// ─────────────────────────────────────────────────────────────────────────
//  PHASE A — SET
// ─────────────────────────────────────────────────────────────────────────

/**
 * After every shape and rule has placed him, and the defence has its roles:
 * read where he starts and decide where he will get set. `seed` is this
 * chance's own; nothing is drawn from the match's stream. A free kick is left
 * to its own rules (kindRules/freeKick.ts): no brain.
 */
export function brainSetup(sc: Scenario, seed: number, rating: number, opts: BrainOptions = {}): void {
  const k = sc.keeper;
  if (k.done || sc.kind === "free_kick") { states.delete(sc); return; }
  const ab = abilities(rating);
  k.startX = k.x; k.targetX = k.x; k.adjusting = false; k.scrambling = false;
  k.committedDir = undefined;
  const rng = brainRng(((seed >>> 0) ^ 0xb7a1) >>> 0);
  const st: State = {
    ab, opts, kind: sc.kind, start: { x: k.x, y: k.y }, setTarget: { x: k.x, y: k.y }, moving: false,
    baseReach: sc.keeperReach, rng, strikeSeed: 0,
    phase: "set", t: 0, rt: 0, dir: 0, target: k.x, stepTravelled: 0, diveTravelled: 0,
    nextReadT: 0, reads: 0, timingErr: 0, locked: false, diveFloor: ab.diveWindow, penFloor: 1, hopSide: 0, farRead: 0,
    lastShot: false, ownShot: false, lastRecv: null, planted: false, reason: "",
    moveAtT: null, stepAtT: null, diveAtT: null, wrongFooted: false,
  };
  st.setTarget = planSet(sc, st, sc.ball);
  states.set(sc, st);
}

/** Where he wants to be for a ball at `ball`, from where he is now, given his ability. */
function planSet(sc: Scenario, st: State, ball: { x: number; y: number }): { x: number; y: number } {
  const { ab, rng } = st;
  const k = sc.keeper;
  // The law: a penalty keeper is on his line, where he is, until it is struck.
  if (sc.kind === "penalty") return { x: k.x, y: k.y };
  let ideal: { x: number; y: number };
  if (Math.abs(ball.x - CX) > 16 && ball.y < 8) {
    // No shot can come from here (a corner flag, the byline outside the box):
    // he sets for the DELIVERY — a metre toward the ball's side, far enough
    // off his line to attack a ball dropped in front of him.
    ideal = { x: CX + Math.sign(ball.x - CX) * 1.0, y: 1.5 };
  } else {
    const d = idealDepth(ball);
    ideal = { x: bisectorX(ball, d), y: d };
  }
  const D = Math.hypot(ball.x - CX, ball.y);
  // The walk toward the ideal spot is capped (2.2 m; 1 m in a tight angle).
  // His set error comes on top — a bad keeper can still wander further than
  // a good one walks — but never past the cap from where he was drawn.
  const cap = walkCapFor(sc.kind);
  let tx = k.x + (ideal.x - k.x) * ab.correction;
  let ty = k.y + (ideal.y - k.y) * ab.correction;
  const bad = rng() < ab.badSet ? 2.5 : 1;
  tx += gauss(rng) * ab.posErr * bad;
  ty += gauss(rng) * ab.posErr * 0.5 * bad;
  tx = k.x + clamp(tx - k.x, -cap.x, cap.x);
  ty = k.y + clamp(ty - k.y, -cap.y, cap.y);
  return {
    x: clamp(tx, POST_L - 1.2, POST_R + 1.2),
    y: clamp(ty, 0.4, Math.max(0.4, D - 3)),
  };
}

function stepToward(from: { x: number; y: number }, to: { x: number; y: number }, max: number) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d <= max) return { x: to.x, y: to.y };
  return { x: from.x + (dx / d) * max, y: from.y + (dy / d) * max };
}

function moveToward(sc: Scenario, st: State, target: { x: number; y: number }, speed: number, dt: number): boolean {
  const k = sc.keeper;
  const dx = target.x - k.x, dy = target.y - k.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.03) { st.moving = false; return true; }
  const step = Math.min(d, speed * dt);
  k.x += (dx / d) * step; k.y += (dy / d) * step;
  st.moving = true;
  // A small lean the way he is stepping (drawn only).
  if (Math.abs(dx) > 1e-4) k.dive = Math.sign(dx) * 0.35;
  return false;
}

/** Every frame while you aim/drag: he walks to his set spot, then stands. */
export function brainAim(sc: Scenario, dt: number): void {
  const st = states.get(sc);
  const k = sc.keeper;
  if (!st || k.done) return;
  moveToward(sc, st, st.setTarget, st.ab.setSpeed, dt);
  // His lean and his scramble are measured from where he actually stands —
  // not from a spot the drawing moved him away from (the stale-startX bug).
  k.startX = k.x; k.targetX = k.x; k.adjusting = false;
}

/**
 * A penalty's run-up (for a run-up to call every frame): a keeper who
 * anticipates (65+) may take ONE small hop, 1.2 s into it, toward the side he
 * reads from your arrow. It is only a hop (`KEEPER_BRAIN.hopM`) — it buys
 * him no ground — but it IS his choice: if he dives, he dives that way; he
 * cannot change direction after it. `aimX` = where the arrow points.
 */
export function brainRunUp(sc: Scenario, dt: number, runT: number, aimX: number): void {
  const st = states.get(sc);
  if (!st || sc.kind !== "penalty" || sc.keeper.done) return;
  const k = sc.keeper;
  if (st.hopSide === 0 && runT > 1.2 && st.ab.anticipStep > 0) {
    const read = (st.opts.penalty ?? penaltyReadFor(st.ab.rating)).readChance;
    const aimedSide = Math.abs(aimX - k.x) < 0.5 ? (st.rng() < 0.5 ? -1 : 1) : Math.sign(aimX - k.x);
    st.hopSide = st.rng() < read ? aimedSide : -aimedSide;
    st.setTarget = { x: k.x + st.hopSide * KEEPER_BRAIN.hopM, y: k.y };
  }
  moveToward(sc, st, st.setTarget, st.ab.setSpeed, dt);
  k.startX = k.x; k.targetX = k.x;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE STRIKE
// ─────────────────────────────────────────────────────────────────────────

function crossXAt(ball: Ball, y: number): number | null {
  if (!(ball.vel.y < -0.5)) return null;
  return ball.pos.x + ball.vel.x * ((ball.pos.y - y) / -ball.vel.y);
}
function timeToLine(ball: Ball, y: number): number {
  if (!(ball.vel.y < -0.5)) return 99;
  return Math.max(0, (ball.pos.y - y) / -ball.vel.y);
}

/** How far out a shot is struck from, for the open-play dial. */
function farness(ball: Ball): number {
  // 0 up to 16 m (a shot in the box), 1 from 26 m.
  return clamp((Math.hypot(ball.pos.x - CX, ball.pos.y) - 16) / 10, 0, 1);
}

/** The instant a shot at goal is struck (yours, or a team-mate's). */
function onShot(sc: Scenario, st: State, ball: Ball) {
  const { ab, rng } = st;
  const k = sc.keeper;
  st.t = 0; st.dir = 0; st.stepTravelled = 0; st.diveTravelled = 0; st.reads = 0; st.locked = false;
  st.moveAtT = null; st.stepAtT = null; st.diveAtT = null; st.wrongFooted = false;
  k.startX = k.x; k.targetX = k.x; k.adjusting = false; k.committedDir = undefined;
  sc.keeperReach = st.baseReach;
  let rt = ab.rt + gauss(rng) * ab.rtSd;
  if (rng() < ab.lateChance) rt += ab.lateExtra;
  if (st.moving) rt += KEEPER_BRAIN.caughtMoving;
  // ── THE OPEN-PLAY DIAL (long shots, and the through balls finished from
  // distance) ── below 1 a shot from distance is harder to read: his reads
  // start later, are worse, and stay worse (it dips and moves in the air).
  const dial = st.opts.openPlay ?? KEEPER_BRAIN.openPlay;
  st.farRead = sc.kind !== "penalty" ? (1 - dial) * farness(ball) : 0;
  rt += KEEPER_BRAIN.farReadLate * st.farRead;
  st.rt = Math.max(0.10, rt);
  st.timingErr = gauss(rng) * ab.timingErr * KEEPER_BRAIN.timingScale;
  st.phase = "wait";
  st.reason = st.moving ? "caught moving" : "";
  if (sc.kind === "penalty") {
    // THE PENALTY RULE SET (penaltyKeeper.ts) decides: whether he goes, which
    // way, how far, with what reach — and whether he reads one down the middle.
    const s = st.opts.penalty ?? penaltyReadFor(ab.rating);
    const d = decidePenaltyRead(sc, ball, s, [rng(), rng()]);
    if (!d.went) { st.reason = "stayed"; return; }
    // A keeper who hopped in the run-up has chosen: he cannot change direction.
    const side = st.hopSide !== 0 ? st.hopSide : d.side;
    st.dir = side;
    st.target = k.x + side * d.metres;
    st.penFloor = d.reach ?? 1;
    const P = KEEPER_BRAIN.penGo;
    st.rt = P[0] + rng() * (P[1] - P[0]);
    const cx = crossXAt(ball, k.y) ?? k.x;
    const off = cx - k.x;
    st.reason = Math.abs(off) < 0.5 || side === Math.sign(off) ? "guessed" : "wrong way";
  }
}

/**
 * Your own strike. Call right after `launch()`. `seed` is this strike's own
 * (the match builds it the way it builds the penalty read's), so a replay can
 * draw exactly the same keeper again.
 */
export function brainStrike(sc: Scenario, ball: Ball, seed: number): void {
  const st = states.get(sc);
  if (!st || sc.keeper.done) return;
  st.strikeSeed = seed >>> 0;
  st.rng = brainRng((st.strikeSeed ^ 0x6b1e) >>> 0);
  // In a shooting picture there is nobody to pass to, so whatever you struck
  // is a shot — including a curled one whose straight line starts outside the
  // posts (the engine's own shot test misses those).
  const shootingPicture = !sc.runner && !sc.passTarget;
  const shot = !!ball.shot || shootingPicture;
  st.ownShot = shot;
  if (shot) { onShot(sc, st, ball); st.lastShot = true; }
  else { st.lastShot = false; st.phase = "set"; st.planted = false; }
}

// ─────────────────────────────────────────────────────────────────────────
//  PHASES B-D — WAIT, STEP, DIVE (every flight substep)
// ─────────────────────────────────────────────────────────────────────────

function read(sc: Scenario, st: State, ball: Ball, errScale: number): boolean {
  const k = sc.keeper;
  const xTrue = crossXAt(ball, k.y);
  if (xTrue === null) return false;
  const far = st.farRead;
  const scale = Math.max(errScale, KEEPER_BRAIN.farReadFloor * far) * (1 + KEEPER_BRAIN.farReadErr * far);
  const xEst = xTrue + gauss(st.rng) * st.ab.readErr * scale;
  const off = xEst - k.x;
  const newDir = Math.abs(off) < 0.3 ? 0 : Math.sign(off);
  const short = newDir === 0 ? 0 : newDir * Math.min(0.25, Math.abs(off) * 0.3);
  if (st.locked && newDir !== 0 && newDir !== st.dir) {
    // Wrong-footed (a curl, a deflection): he can stop, he cannot turn round.
    st.target = k.x;
    st.wrongFooted = true;
    st.reads++;
    return true;
  }
  if (st.dir !== 0 && newDir === st.dir) st.locked = true;
  st.dir = newDir;
  st.target = k.x + clamp(off - short, -st.ab.maxTravel, st.ab.maxTravel);
  st.reads++;
  return true;
}

function leaveFeet(sc: Scenario, st: State, ball?: Ball) {
  const k = sc.keeper;
  st.phase = "dive";
  st.diveAtT = st.t;
  if (st.moveAtT === null) st.moveAtT = st.t;
  // A dive launched on a READ with time in hand is a full-length dive, hands
  // leading: full reach. One launched with no time (point blank) or on a
  // GUESS (a penalty) is a lunge: the window only — for a penalty, the reach
  // his rule set gives him while committed.
  // (Measured from the time the prototype left with — `diveLead` later plus
  // 0.05 s: the later, paced dive is the same full-length dive, it just
  // arrives with the ball instead of before it.)
  const T = ball ? timeToLine(ball, k.y) + (0.05 - KEEPER_BRAIN.diveLead) : 0;
  const timed = st.reads > 0 ? clamp((T - 0.25) / 0.35, 0, 1) : 0;
  const window = sc.kind === "penalty" ? st.penFloor : st.ab.diveWindow;
  st.diveFloor = window + (1 - window) * timed;
  k.saveDir = st.dir;
  if (k.saveLunge <= 0) k.saveLunge = 0.001;
  // ONE DIVE: the engine will not turn him round once this is set, and a
  // save or a miss leaves him finishing THIS dive (plan item 3).
  k.committedDir = st.dir !== 0 ? st.dir : undefined;
  k.targetX = st.target;
  // His lean is the DIVE, measured from where he left his feet (item 8b) —
  // and the engine's scramble keeps him within 3.2 m of this spot, so an
  // anchor back where the steps began would drag a long dive back again.
  k.startX = k.x;
}

/** His reach while in the air: the standing reach minus what the dive has already used, down to a floor. */
function windowReach(sc: Scenario, st: State) {
  const kr = sc.keeperReach;
  sc.keeperReach = st.baseReach;
  const reach = keeperSaveRadius(sc);
  sc.keeperReach = kr;
  const w = Math.max(st.diveFloor, 1 - st.diveTravelled / Math.max(0.5, reach));
  const base = st.baseReach ?? 1;
  sc.keeperReach = w < 0.999 ? base * w : st.baseReach;
}

/**
 * Every flight substep, AFTER stepKeeper/stepReactions and BEFORE stepBall
 * (the slot kindRules.stepKind has). Also called in the result phase, so a
 * dive that is still in the air lands and a beaten keeper stays committed.
 */
export function brainStep(sc: Scenario, ball: Ball | null, dt: number): void {
  const st = states.get(sc);
  const k = sc.keeper;
  if (!st || k.done) return;
  const ab = st.ab;

  // ── The engine has had its say (a save, a spill, a beaten keeper) ──
  // The brain never sets `scrambling`, so scrambling means the engine spoke.
  if (st.phase !== "engine" && (k.saves > 0 || k.scrambling)) {
    st.phase = "engine";
    // His dive is over: the engine's own reach (and its wear after a save)
    // takes back over, and the next shot at him is his to react to fresh.
    sc.keeperReach = st.baseReach;
    k.committedDir = undefined;
  }
  if (st.phase === "engine") {
    // ONE DIVE, and no second one on the end of it. The engine sends a
    // beaten keeper on toward the ball by up to his reach; a keeper who has
    // thrown himself one way lands where his own dive ends.
    if (k.saves === 0 && st.dir !== 0 && st.diveAtT !== null) {
      if ((k.targetX - st.target) * st.dir > 0) k.targetX = (k.x - st.target) * st.dir >= 0 ? k.x : st.target;
    }
    return;
  }

  // A dive in the air carries on whatever the ball does — he has to land.
  if (st.phase === "dive") {
    st.t += dt;
    const dx = st.target - k.x;
    // Paced to the ball: he aims to arrive as it does, never slower than the
    // floor and never faster than his top speed. A ball already past him (or
    // gone) — top speed, to land.
    const T = ball && ball.pos.y > k.y ? timeToLine(ball, k.y) : 0;
    const top = sc.kind === "penalty" ? ab.diveSpeed * KEEPER_BRAIN.penSpeed : ab.diveSpeed;
    const speed = T > 0.02 && T < 50 ? clamp(Math.abs(dx) / T, top * KEEPER_BRAIN.diveSpeedFloor, top) : top;
    const step = Math.min(Math.abs(dx), speed * dt);
    k.x += Math.sign(dx) * step;
    st.diveTravelled += step;
    k.dive = clamp(k.x - k.startX, -3.2, 3.2);
    windowReach(sc, st);
    // Still in the air: nothing else happens to him this step.
    if (Math.abs(st.target - k.x) > 1e-3) return;
  }
  if (!ball) return;

  // ── A new shot? (yours came through brainStrike; a team-mate's shows up as ball.shot) ──
  const shotNow = (!!ball.shot || (st.ownShot && ball.owner === "you")) && !ball.loose && ball.lastTouch === "attack";
  if (shotNow && !st.lastShot) onShot(sc, st, ball);
  st.lastShot = shotNow;
  // Landed from a dive at a shot that is still coming: he stays down.
  if (st.phase === "dive") return;

  // ── The ball is somebody else's (a pass, a cross): get set for where it is going ──
  if (!shotNow) {
    // A cutback keeps its own rule: the engine's reception shuffle
    // (Keeper.adjusting) covers the ball played back across him.
    if (sc.kind === "cutback") return;
    // Everywhere else the brain owns him while the ball is somebody else's:
    // the engine's own reception shuffle would otherwise move him too.
    k.adjusting = false; k.targetX = k.x;
    // Mid-read of a shot that has stopped being one (a block, a deflection):
    // he holds where he is until somebody strikes it again.
    if (st.phase !== "set") return;
    const recv = sc.receivedAt;
    if (recv && recv !== st.lastRecv) {
      // Played to a team-mate: ONE step toward the spot for HIS position, then
      // set. Being set beats being ideal — a first-time finish still catches
      // him mid-step.
      st.lastRecv = recv;
      const ideal = planSet(sc, st, { x: recv.x, y: recv.y });
      st.setTarget = stepToward({ x: k.x, y: k.y }, ideal, KEEPER_BRAIN.receptionStep);
      st.phase = "set";
      st.planted = false;
    } else if (!recv && ball.owner === "you" && st.phase === "set" && !st.planted) {
      // A cross in the air: he stays in his crossing stance and PLANTS — a
      // keeper who drifts toward where it will drop is the one a header beats.
      st.planted = true; st.setTarget = { x: k.x, y: k.y }; st.moving = false;
    }
    if (st.phase === "set" || st.phase === "wait") {
      moveToward(sc, st, st.setTarget, ab.setSpeed, dt);
      k.startX = k.x; k.targetX = k.x;
    }
    return;
  }

  // ── A shot is in the air ──
  st.t += dt;
  if (ball.pos.y <= k.y) return;

  if (st.phase === "wait") {
    if (sc.kind === "penalty") {
      if (st.dir !== 0 && st.t >= st.rt) leaveFeet(sc, st);
      return;
    }
    if (st.t < st.rt) return;
    if (!read(sc, st, ball, 1)) return;
    st.phase = "step";
    st.stepAtT = st.t;
    st.nextReadT = st.t + KEEPER_BRAIN.readEvery;
  }

  if (st.phase === "step") {
    // On his feet: keep reading it, shuffle toward it, and decide when to go.
    if (st.t >= st.nextReadT) {
      read(sc, st, ball, Math.max(0.5, 1 - st.reads * 0.25));
      st.nextReadT = st.t + KEEPER_BRAIN.readEvery;
    }
    const T = timeToLine(ball, k.y);
    const need = Math.abs(st.target - k.x) / ab.diveSpeed;
    if (T <= need + KEEPER_BRAIN.diveLead + st.timingErr) {
      leaveFeet(sc, st, ball);
      return;
    }
    const dx = st.target - k.x;
    const step = Math.min(Math.abs(dx), ab.stepSpeed * dt);
    if (step > 1e-6 && st.moveAtT === null) st.moveAtT = st.t;
    k.x += Math.sign(dx) * step;
    st.stepTravelled += step;
    if (step > 1e-6) k.dive = Math.sign(dx) * 0.35;
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  GOAL REPLAYS
// ─────────────────────────────────────────────────────────────────────────

/** Everything a replay needs to rebuild him as he was at the strike. Call BEFORE brainStrike. */
export function brainSnapshot(sc: Scenario, strikeSeed: number): KeeperBrainSnapshot | undefined {
  const st = states.get(sc);
  if (!st) return undefined;
  return {
    rating: st.ab.rating, kind: st.kind, start: { ...st.start }, setTarget: { ...st.setTarget },
    moving: st.moving, baseReach: st.baseReach ?? null,
    opts: JSON.parse(JSON.stringify(st.opts)) as BrainOptions, hopSide: st.hopSide,
    strikeSeed: strikeSeed >>> 0,
  };
}

/** Put him back on a replayed scenario (which already has him where he stood). Then call brainStrike. */
export function brainRestore(sc: Scenario, s: KeeperBrainSnapshot): void {
  brainSetup(sc, 0, s.rating, s.opts);
  const st = states.get(sc);
  if (!st) return;
  st.kind = s.kind;
  st.start = { ...s.start };
  st.setTarget = { ...s.setTarget };
  st.moving = s.moving;
  st.baseReach = s.baseReach ?? undefined;
  st.hopSide = s.hopSide ?? 0;
}
