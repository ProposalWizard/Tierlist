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
 *     paced to the ball, once. During the run-up (penaltyRunup.ts) he may
 *     lean (`leanChance`, about a third of kicks): a half-metre shuffle to a
 *     random side before the strike, and his dive runs from there. (The old
 *     hop, `hopChance`, is switched off.)
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
import type { Ball, Scenario, KeeperClaim } from "./canvasEngine";
import { keeperSaveRadius } from "./canvasEngine";
import { CX, POST_L, POST_R } from "./pitch";
import { decidePenaltyRead, penaltyReadFor, type PenaltyReadSettings } from "./penaltyKeeper";
import { testAreaSetting } from "./compareSwitches";
import { oldKeepers, oldKeeperPro, oldKeeperFeel } from "./gameplayVersion";
import { getTuning } from "./tuningStore";

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
  walkCap: 2.2,
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
   * How often he hops during a run-up: OFF (0, 0). Harry, 27 Sep 2026: the
   * "hop" he asked for was the TAKER's run-up style (a Bruno Fernandes skip),
   * not the keeper hopping — "you've mistaken that one". The machinery stays
   * (share for a 40-rated keeper up to a 95, straight between) so a keeper
   * feint can be turned back on here if it's ever wanted.
   */
  hopShare: [0, 0] as [number, number],
  /** When in the run-up he hops, seconds after you let go (a random point in
   *  this window) — early enough to be seen, late enough to be a read. */
  hopAt: [1.0, 1.8] as [number, number],
  /**
   * THE LEAN — not the hop. Harry, 27 Sep 2026: "on the keeper have it be
   * random chance they do that" — the keeper "moving over to one side as we
   * shoot to help reach corners, it's just not called a 'hop'". On a penalty,
   * once per kick, this share of keepers shuffle `leanDistM` to a random side
   * during the run-up, before the strike. It is a guess, not a read: the side
   * is a coin flip, whatever you aimed. His ordinary dive then runs from where
   * the lean left him — so he reaches further toward the side he leaned and
   * less far toward the other.
   */
  leanChance: 0.35,
  /** How far he shuffles (m). */
  leanDistM: 0.5,
  /** When in the run-up he leans, seconds after you let go — finished (at
   *  his walking pace) before the shortest run-up (Two Steps, 1.7 s) strikes. */
  leanAt: [0.5, 1.1] as [number, number],
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
 * THE KEEPER IS ONLY HUMAN (Leo, 5 Oct 2026): "Goalies being overpowered and
 * far too good in general … more emphasis on top corner shots going in that
 * goalies cant reach, worse goalies dont move as good or predict as good."
 * And a behind-the-scenes VISION rule: "if there are players between the ball
 * and the goalie blocking the goalies view then that should at least slightly
 * make them act worse … the more blocked they are the worse it is (although
 * again; this should only affect them a little at most)."
 *
 * Nothing here is in canvasEngine.ts. The top corner works through the one
 * public dial the engine already reads for "how far can he reach right now"
 * (`Scenario.keeperReach`, the same field a committed dive already shrinks);
 * vision works on the brain's own reaction, timing and read. Measured in
 * tests/star/keeperHuman.mts.
 */
export const KEEPER_HUMAN = {
  /**
   * THE TOP CORNER. The engine's save test is an ellipse (height scaled into
   * distance), so a ball high AND wide of him is judged as if he reached it
   * as well as one the same distance away along the ground. He can't: the
   * diagonal stretch up into the corner is the shortest reach a keeper has.
   * While a shot that will cross his line high and wide of him is coming,
   * his reach is cut — ramping in from `topZ[0]` to `topZ[1]` metres high at
   * his line, and from `topWide[0]` to `topWide[1]` metres to his side.
   * Penalties keep their own calibrated rule set (penaltyKeeper.ts).
   */
  topZ: [1.3, 1.9] as [number, number],
  topWide: [0.7, 1.9] as [number, number],
  /** The cut at full height and width: a 40-rated keeper → a 95. */
  topCut: [getTuning("keepers.topCutWeak"), getTuning("keepers.topCutStrong")] as [number, number],
  /**
   * VISION. A body counts when it stands within `bodyR` metres of the line
   * from the ball to him, between them. One closer to HIM hides more of the
   * strike (it fills more of his view), so it weighs up to 1; one by the ball
   * from 0.6. Blockage = the weights' sum / `fullAt`, capped at 1.
   */
  bodyR: 0.8,
  fullAt: 2,
  /** At full blockage: seconds added to his reaction… */
  visionLate: getTuning("keepers.visionLate"),
  /** …seconds later he leaves his feet… */
  visionDiveLate: getTuning("keepers.visionDiveLate"),
  /** …how much bigger his first two reads' error is (×1+)… */
  visionReadErr: getTuning("keepers.visionReadErr"),
  /** …and the chance his first read is the wrong way. */
  visionWrongWay: getTuning("keepers.visionWrongWay"),
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
  /** false = he sees through bodies (the keeper before 5 Oct 2026; for measuring). Absent = on. */
  vision?: boolean;
  /** false = no top-corner reach cut (the keeper before 5 Oct 2026; for measuring). Absent = on. */
  topCorner?: boolean;
  /** KEEPER PRO on/off for this chance. Absent = Settings → Gameplay → Keeper pro. */
  pro?: boolean;
  /** KEEPER FEEL on/off (Oct 13; needs pro). Absent = Settings → Gameplay → Keeper feel. */
  feel?: boolean;
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
  /** Anticipation: 0 below 65, then a keeper who reads the run-up. (The
   *  run-up hop itself is `hopChance`, on every keeper — v0.15.) */
  anticipStep: number;
}

/**
 * Leo, 5 Oct 2026: "worse goalies dont move as good or predict as good." The
 * elite end (95) is where it was; the bottom end (40 and below) is pushed
 * further down, so the gap between a poor keeper and a good one is wider on
 * every one of these: he sets worse, reacts later, reads worse, steps and
 * dives slower and less far. Before (40 → 95): correction 0.35 → 0.95, rt
 * 0.30 → 0.20 s, readErr 1.3 → 0.4 m, dive 4.8 → 6.2 m/s. Measured in
 * tests/star/keeperHuman.mts.
 */
export function abilities(rating: number): Abilities {
  const r = clamp(Number.isFinite(rating) ? rating : 62, 20, 99);
  if (oldKeepers()) return abilitiesBefore(r);
  return {
    rating: r,
    correction: 0.27 + 0.68 * grow(r, 40, 95, 1.2),
    posErr: 1.3 - 1.10 * grow(r, 40, 95, 1.3),
    badSet: 0.32 - 0.28 * grow(r, 40, 95, 1.0),
    setSpeed: 1.3 + 1.3 * grow(r, 40, 95, 1.0),
    rt: 0.33 - 0.13 * grow(r, 40, 95, 1.2),
    rtSd: 0.035,
    lateChance: 0.25 - 0.22 * grow(r, 40, 95, 1.0),
    lateExtra: 0.15,
    readErr: 1.65 - 1.25 * grow(r, 40, 95, 1.4),
    timingErr: 0.14 - 0.09 * grow(r, 40, 95, 1.2),
    stepSpeed: 1.65 + 0.95 * grow(r, 40, 95, 1.0),
    diveSpeed: 4.5 + 1.7 * grow(r, 40, 95, 1.2),
    maxTravel: 2.2 + 1.0 * grow(r, 40, 95, 1.5),
    diveWindow: 0.33 + 0.10 * grow(r, 40, 95, 1.0),
    anticipStep: 0.9 * grow(r, 65, 95, 1.6),
  };
}

/** Settings → Gameplay → Keepers: Old. The keeper's skills exactly as they
 *  were before 5 Oct 2026, so the change can be compared and undone. */
function abilitiesBefore(r: number): Abilities {
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

/**
 * How far he may walk from the drawn spot for this kind of chance: a RADIUS,
 * metres in any direction. It was two separate caps (2.2 m sideways, 1.8 m
 * forward), so a diagonal walk reached 2.8 m — past the "up to 2.2 m" Harry
 * set (final playtest, 27 Sep 2026).
 */
export function walkCapFor(kind: string): number {
  return kind === "tight_angle" ? KEEPER_BRAIN.walkCapTight : KEEPER_BRAIN.walkCap;
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
  /** Where he stood before that hop. */
  hopFromX?: number | null;
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
  /** A penalty run-up: when he will hop (s), or -1 = he won't; null = not decided yet. */
  hopAt: number | null;
  /** A penalty run-up: where he stood before the hop (his dive is measured from here). */
  hopFromX: number | null;
  /** A penalty run-up: when he will lean (s), or -1 = he won't; null = not decided yet. */
  leanAt: number | null;
  /** …and to which side (−1 / +1), and whether he has gone yet. */
  leanSide: number;
  leaned: boolean;
  /** 0..1: how much harder this shot is to read, from the open-play dial and its distance. */
  farRead: number;
  /** 0..1: how much of his view of this strike was hidden (KEEPER_HUMAN vision). */
  blocked: number;
  /** Vision: his first read of this shot goes the wrong way. */
  wrongRead: boolean;
  /** The top-corner cut is on his reach right now. */
  cutOn: boolean;
  /** Where he stood when this shot was struck. */
  shotX: number;
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
  // ── KEEPER PRO ──
  pro: boolean;
  /** This delivery has been read for a claim (reset by each new strike / reception). */
  claimRead: boolean;
  /** He is coming for it: where, and from when (s after he read it). */
  claimGo: { x: number; y: number; at: number; t: number } | null;
  /** His full standing reach (m) for this shot, read at the strike. */
  fullR: number;
  // ── KEEPER FEEL (Oct 13) ──
  feel: boolean;
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
    /** The run-up lean: the side he shuffled (0 = he didn't, or not yet). */
    leanSide: st.leaned ? st.leanSide : 0,
  };
}

/**
 * The salt a match mount mixes into every keeper seed it hands this brain
 * (setup, strike, the penalty read). A feature's own picture (Infinite
 * Highlights, the gallery's Play, the trial, a shootout) mounts the match
 * afresh with the same seed every time, so without it every kick there drew
 * the same keeper: 200 of 200 highlight penalties dived the same way and none
 * hopped (final playtest, 27 Sep 2026). The real match takes 0 — its seeded,
 * replayable stream is untouched; a goal replay restores him from his
 * snapshot either way.
 */
export function keeperSaltFor(feature: boolean, random: () => number = Math.random): number {
  return feature ? (random() * 0x100000000) >>> 0 : 0;
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
    nextReadT: 0, reads: 0, timingErr: 0, locked: false, diveFloor: ab.diveWindow, penFloor: 1, hopSide: 0, hopAt: null, hopFromX: null, leanAt: null, leanSide: 0, leaned: false, farRead: 0, blocked: 0, wrongRead: false, cutOn: false, shotX: k.x,
    lastShot: false, ownShot: false, lastRecv: null, planted: false, reason: "",
    moveAtT: null, stepAtT: null, diveAtT: null, wrongFooted: false,
    pro: sc.kind !== "penalty" && (opts.pro ?? (!oldKeeperPro() || !oldKeeperFeel())), claimRead: false, claimGo: null, fullR: 2.4,
    feel: false,
  };
  // KEEPER FEEL builds on Keeper pro: New plays pro as well.
  st.feel = st.pro && (opts.feel ?? !oldKeeperFeel());
  if (st.feel) sc.keeperFeel = true; else delete sc.keeperFeel;
  // KEEPER PRO: the engine's half (resolveKeeperPro, keeperClaimTouch) is
  // switched on by this one flag, and only here. Old leaves the scenario
  // exactly as it was.
  if (st.pro) sc.keeperPro = true; else delete sc.keeperPro;
  k.claim = null;
  // A real keeper's own spot (the Real shots test page, keeperHoldsStart):
  // he is already where he really stood, so he does not walk to ours. Absent
  // in the real game: planSet exactly as before.
  st.setTarget = sc.keeperHoldsStart ? { x: k.x, y: k.y } : planSet(sc, st, sc.ball);
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
    const d = st.pro ? proDepth(sc, ball) : idealDepth(ball);
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
  tx = clamp(tx, POST_L - 1.2, POST_R + 1.2);
  ty = clamp(ty, 0.4, Math.max(0.4, D - 3));
  // The cap last, as a circle round the drawn spot: never further than `cap`
  // in any direction (inside the bounds above whenever he was drawn inside them).
  const wx = tx - k.x, wy = ty - k.y, walk = Math.hypot(wx, wy);
  if (walk > cap) { tx = k.x + (wx / walk) * cap; ty = k.y + (wy / walk) * cap; }
  return { x: tx, y: ty };
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
  // KEEPER PRO: coming OUT at a man clean through is a run, not a side-step.
  const fwd = st.pro && st.setTarget.y - k.y > 0.5;
  moveToward(sc, st, st.setTarget, fwd ? st.ab.setSpeed * KEEPER_PRO_BRAIN.rushSpeed : st.ab.setSpeed, dt);
  // His lean and his scramble are measured from where he actually stands —
  // not from a spot the drawing moved him away from (the stale-startX bug).
  k.startX = k.x; k.targetX = k.x; k.adjusting = false;
}

/** The chance a keeper of this rating hops during a penalty run-up. */
export function hopChance(rating: number): number {
  const [lo, hi] = KEEPER_BRAIN.hopShare;
  return lo + (hi - lo) * grow(clamp(Number.isFinite(rating) ? rating : 62, 20, 99), 40, 95, 1.0);
}

/**
 * A penalty's run-up (lib/star/penaltyRunup.ts calls this every frame of it):
 * on about half of kicks (`hopChance`, a little more for a better keeper) he
 * takes ONE small hop, at a point in `KEEPER_BRAIN.hopAt`, toward the side he
 * reads from your arrow (his rule set's `readChance`). It is only a hop
 * (`KEEPER_BRAIN.hopM`) — it buys him no ground — but it IS his choice: if he
 * dives, he dives that way (onShot); he cannot change direction after it.
 * A keeper who doesn't hop decides at the strike, off your real kick.
 * `aimX` = where the arrow crosses the goal line now.
 */
export function brainRunUp(sc: Scenario, dt: number, runT: number, aimX: number): void {
  const st = states.get(sc);
  if (!st || sc.kind !== "penalty" || sc.keeper.done) return;
  const k = sc.keeper;
  if (st.hopAt === null) {
    const [a, b] = KEEPER_BRAIN.hopAt;
    const go = st.rng() < hopChance(st.ab.rating);
    const at = a + st.rng() * (b - a);
    st.hopAt = go ? at : -1;
  }
  if (st.hopSide === 0 && st.hopAt >= 0 && runT >= st.hopAt) {
    const read = (st.opts.penalty ?? penaltyReadFor(st.ab.rating)).readChance;
    const aimedSide = Math.abs(aimX - k.x) < 0.5 ? (st.rng() < 0.5 ? -1 : 1) : Math.sign(aimX - k.x);
    st.hopSide = st.rng() < read ? aimedSide : -aimedSide;
    st.hopFromX = k.x;
    st.setTarget = { x: k.x + st.hopSide * KEEPER_BRAIN.hopM, y: k.y };
    st.reason = "hopped";
  }
  // The lean (KEEPER_BRAIN.leanChance): rolled once per kick, off his own
  // stream — never the match's — then a shuffle to a random side.
  if (st.leanAt === null) {
    const go = st.rng() < KEEPER_BRAIN.leanChance;
    st.leanSide = st.rng() < 0.5 ? -1 : 1;
    const [a, b] = KEEPER_BRAIN.leanAt;
    const at = a + st.rng() * (b - a);
    st.leanAt = go ? at : -1;
  }
  if (!st.leaned && st.leanAt >= 0 && runT >= st.leanAt) {
    st.leaned = true;
    st.setTarget = { x: st.setTarget.x + st.leanSide * KEEPER_BRAIN.leanDistM, y: st.setTarget.y };
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

/**
 * VISION: how much of his view of the strike is hidden, 0..1 (KEEPER_HUMAN).
 * Everybody on the pitch but him and the striker counts — defenders and
 * attackers alike block a keeper's sight.
 */
export function sightlineBlockage(sc: Scenario, from: { x: number; y: number }): number {
  const H = KEEPER_HUMAN;
  const k = sc.keeper;
  const bodies: { x: number; y: number }[] = [];
  for (const d of sc.defenders) bodies.push(d);
  for (const t of sc.teammates ?? []) bodies.push(t);
  if (sc.runner) bodies.push(sc.runner.pos);
  for (const r of sc.secondaryRunners ?? []) bodies.push(r.pos);
  // A follower parked off the picture (the drawing had no spot for him) is not there.
  const f = sc.follower;
  if (f && f.x > -100 && f.y < 200) bodies.push(f);
  const vx = k.x - from.x, vy = k.y - from.y, L2 = vx * vx + vy * vy;
  if (L2 < 1) return 0;
  const L = Math.sqrt(L2);
  let sum = 0;
  for (const p of bodies) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const t = ((p.x - from.x) * vx + (p.y - from.y) * vy) / L2;
    // Between them: not the striker's own shadow, not stood on the keeper.
    if (t < 0.08 || t > 0.95) continue;
    const lat = Math.abs((p.x - from.x) * vy - (p.y - from.y) * vx) / L;
    if (lat >= H.bodyR) continue;
    sum += (1 - lat / H.bodyR) * (0.6 + 0.4 * t);
  }
  return clamp(sum / H.fullAt, 0, 1);
}

/**
 * THE TOP CORNER: the share of his reach he keeps against this ball, 1 = all
 * of it (KEEPER_HUMAN.topZ/topWide/topCut). Read off where the ball will
 * cross his line (straight line across, gravity for height), so it follows
 * the ball as it bends and dips. "Wide" is measured from `fromX`, where he
 * stood when it was struck: getting across first does not make the corner
 * any lower — he still has to go up and across for it in one movement.
 * Pure: reads the scenario and the ball only.
 */
export function topCornerReach(sc: Scenario, ball: Ball, fromX: number = sc.keeper.x): number {
  const H = KEEPER_HUMAN;
  const k = sc.keeper;
  if (!(ball.vel.y < -0.5) || ball.pos.y <= k.y) return 1;
  const t = (ball.pos.y - k.y) / -ball.vel.y;
  const x = ball.pos.x + ball.vel.x * t;
  const z = ball.z + ball.vz * t - 4.9 * t * t;
  const high = clamp((z - H.topZ[0]) / (H.topZ[1] - H.topZ[0]), 0, 1);
  if (high <= 0) return 1;
  const wide = clamp((Math.abs(x - fromX) - H.topWide[0]) / (H.topWide[1] - H.topWide[0]), 0, 1);
  if (wide <= 0) return 1;
  const g = grow(clamp(Number.isFinite(sc.keeperStrength) ? sc.keeperStrength : 62, 20, 99), 40, 95, 1.0);
  const cut = H.topCut[0] + (H.topCut[1] - H.topCut[0]) * g;
  return 1 - cut * high * wide;
}

/** The instant a shot at goal is struck (yours, or a team-mate's). */
function onShot(sc: Scenario, st: State, ball: Ball) {
  const { ab, rng } = st;
  const k = sc.keeper;
  st.t = 0; st.dir = 0; st.stepTravelled = 0; st.diveTravelled = 0; st.reads = 0; st.locked = false;
  st.moveAtT = null; st.stepAtT = null; st.diveAtT = null; st.wrongFooted = false;
  k.startX = k.x; k.targetX = k.x; k.adjusting = false; k.committedDir = undefined;
  sc.keeperReach = st.baseReach;
  st.shotX = k.x; st.cutOn = false;
  if (st.pro) {
    k.claim = null; st.claimGo = null;
    const kr = sc.keeperReach; sc.keeperReach = st.baseReach;
    st.fullR = keeperSaveRadius(sc);
    sc.keeperReach = kr;
  }
  let rt = ab.rt + gauss(rng) * ab.rtSd;
  if (rng() < ab.lateChance) rt += ab.lateExtra;
  if (st.moving) rt += KEEPER_BRAIN.caughtMoving;
  // ── THE OPEN-PLAY DIAL (long shots, and the through balls finished from
  // distance) ── below 1 a shot from distance is harder to read: his reads
  // start later, are worse, and stay worse (it dips and moves in the air).
  const raw = st.opts.openPlay ?? KEEPER_BRAIN.openPlay;
  // KEEPER PRO reads distance better at every setting of the dial (the
  // Play Area's Hard / Middle / Easier still go in that order).
  const dial = st.pro ? 1 - (1 - raw) * KEEPER_PRO_BRAIN.farReadShare : raw;
  st.farRead = sc.kind !== "penalty" ? (1 - dial) * farness(ball) : 0;
  rt += KEEPER_BRAIN.farReadLate * st.farRead;
  st.timingErr = gauss(rng) * ab.timingErr * KEEPER_BRAIN.timingScale;
  // ── VISION (KEEPER_HUMAN) ── bodies between the strike and him: a beat
  // later to react, a touch later to go, a worse first read, and now and
  // then a first read the wrong way. Small, and capped at full blockage. Its
  // one random draw is taken only when somebody is in the way, so a clear
  // view leaves his stream exactly as it was.
  st.blocked = 0; st.wrongRead = false;
  if (sc.kind !== "penalty" && st.opts.vision !== false && !oldKeepers()) {
    const b = sightlineBlockage(sc, ball.pos);
    if (b > 0) {
      const H = KEEPER_HUMAN;
      st.blocked = b;
      rt += H.visionLate * b;
      st.timingErr -= H.visionDiveLate * b;
      st.wrongRead = rng() < H.visionWrongWay * b;
    }
  }
  st.rt = Math.max(0.10, rt);
  st.phase = "wait";
  st.reason = st.moving ? "caught moving" : st.blocked > 0.5 ? "unsighted" : "";
  if (sc.kind === "penalty") {
    // THE PENALTY RULE SET (penaltyKeeper.ts) decides: whether he goes, which
    // way, how far, with what reach — and whether he reads one down the middle.
    const s = st.opts.penalty ?? penaltyReadFor(ab.rating);
    const d = decidePenaltyRead(sc, ball, s, [rng(), rng()]);
    if (!d.went) { st.reason = "stayed"; return; }
    // A keeper who hopped in the run-up has chosen: he cannot change direction.
    const side = st.hopSide !== 0 ? st.hopSide : d.side;
    st.dir = side;
    // The hop buys him no ground: the dive lands where it would have from
    // where he stood before it (KEEPER_BRAIN.hopM is the look, not the reach).
    st.target = (st.hopFromX ?? k.x) + side * d.metres;
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
  else { st.lastShot = false; st.phase = "set"; st.planted = false; st.claimRead = false; }
}

// ─────────────────────────────────────────────────────────────────────────
//  PHASES B-D — WAIT, STEP, DIVE (every flight substep)
// ─────────────────────────────────────────────────────────────────────────

function read(sc: Scenario, st: State, ball: Ball, errScale: number): boolean {
  const k = sc.keeper;
  const xTrue = crossXAt(ball, k.y);
  if (xTrue === null) return false;
  const far = st.farRead;
  // Vision: his first two reads were made round the bodies in the way.
  const unsighted = st.reads < 2 ? 1 + KEEPER_HUMAN.visionReadErr * st.blocked : 1;
  let scale = Math.max(errScale, KEEPER_BRAIN.farReadFloor * far) * (1 + KEEPER_BRAIN.farReadErr * far) * unsighted;
  // KEEPER FEEL: the nearer it gets the better he sees it — a ball still a
  // second away is read as before, one about to arrive far more truly.
  const Tf = st.feel ? timeToLine(ball, k.y) : 99;
  if (st.feel) scale *= KEEPER_FEEL_BRAIN.readScale * clamp(KEEPER_FEEL_BRAIN.readNear + KEEPER_FEEL_BRAIN.readPerS * Tf, KEEPER_FEEL_BRAIN.readNear, 1);
  const xEst = xTrue + gauss(st.rng) * st.ab.readErr * scale;
  let off = xEst - k.x;
  // …and once in a while the first one is the wrong way entirely.
  if (st.reads === 0 && st.wrongRead) off = -off;
  const newDir = Math.abs(off) < 0.3 ? 0 : Math.sign(off);
  const short = newDir === 0 ? 0 : newDir * Math.min(0.25, Math.abs(off) * 0.3);
  // KEEPER FEEL: still on his feet with time in hand, he simply changes his
  // mind and shuffles back; wrong-footed only once it is nearly on him.
  if (st.feel && st.locked && newDir !== 0 && newDir !== st.dir && Tf > KEEPER_FEEL_BRAIN.adjustT) st.locked = false;
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
  brainStepInner(sc, ball, dt);
  const st = states.get(sc);
  if (st) { if (st.pro) applyProReach(sc, st, ball); else applyTopCorner(sc, st, ball); }
}

/**
 * THE TOP CORNER (KEEPER_HUMAN): every substep, after he has moved and
 * before the engine judges the ball, his reach against a shot that will
 * cross his line high and wide of him. Computed fresh each step from the
 * reach he would otherwise have (his dive's window, or his standing reach),
 * so it never compounds, and handed back the moment the shot is over.
 */
function applyTopCorner(sc: Scenario, st: State, ball: Ball | null): void {
  const k = sc.keeper;
  const live = !!ball && sc.kind !== "penalty" && st.opts.topCorner !== false && !oldKeepers() && !k.done
    && (st.phase === "wait" || st.phase === "step" || st.phase === "dive")
    && st.lastShot && k.saves === 0 && !k.scrambling
    && ball.lastTouch === "attack" && !ball.loose && ball.pos.y > k.y;
  if (!live) {
    // Hand his reach back: his dive's window in the air, his own otherwise.
    if (st.cutOn) { if (st.phase === "dive") windowReach(sc, st); else sc.keeperReach = st.baseReach; }
    st.cutOn = false;
    return;
  }
  const f = topCornerReach(sc, ball!, st.shotX);
  // In the air his reach is his dive's window (recomputed, never last step's cut).
  if (st.phase === "dive") windowReach(sc, st);
  const base = st.phase === "dive" ? sc.keeperReach : st.baseReach;
  if (f < 1) { sc.keeperReach = (base ?? 1) * f; st.cutOn = true; }
  else { if (st.cutOn && st.phase !== "dive") sc.keeperReach = st.baseReach; st.cutOn = false; }
}

function brainStepInner(sc: Scenario, ball: Ball | null, dt: number): void {
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
    // KEEPER PRO: he comes for a cross or an overhit through ball he can
    // reach first, and steps up toward a man about to be through.
    if (st.pro && proOffBall(sc, st, ball, dt)) return;
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
      st.setTarget = stepToward({ x: k.x, y: k.y }, ideal, st.pro && clearThrough(sc, recv) ? KEEPER_PRO_BRAIN.rushStep : KEEPER_BRAIN.receptionStep);
      st.claimRead = false;
      st.phase = "set";
      st.planted = false;
    } else if (!recv && ball.owner === "you" && st.phase === "set" && !st.planted) {
      // A cross in the air: he stays in his crossing stance and PLANTS — a
      // keeper who drifts toward where it will drop is the one a header beats.
      st.planted = true; st.setTarget = { x: k.x, y: k.y }; st.moving = false;
    }
    if (st.phase === "set" || st.phase === "wait") {
      const fwd = st.pro && st.setTarget.y - k.y > 0.5;
      moveToward(sc, st, st.setTarget, fwd ? ab.setSpeed * KEEPER_PRO_BRAIN.rushSpeed : ab.setSpeed, dt);
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
    // KEEPER FEEL: a ball coming at him (within an arm and a step) is not
    // dived at: he gets his body behind it and takes it on his feet, at full
    // standing reach — the "set" save, where a lunge used to cut his reach.
    const behindIt = st.feel && Math.abs(st.target - k.x) <= KEEPER_FEEL_BRAIN.standWithin;
    if (!behindIt && T <= need + KEEPER_BRAIN.diveLead + st.timingErr) {
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
//  KEEPER FEEL (Oct 13 gameplay update) — on top of Keeper pro
// ─────────────────────────────────────────────────────────────────────────
//
// Measured with Keeper pro alone (scratch harness, keeper 70, shots of under
// 18 m/s struck straight at him): 13% went in. He read the crossing point with
// half a metre of error even with a second to look at it, locked his side on
// two reads, and threw a lunge at the last moment that cut his reach to about
// 40%. A soft shot at a keeper is his. The engine's half (holding more at the
// body, fewer parries back into danger) is KEEPER_FEEL in canvasEngine.ts.
export const KEEPER_FEEL_BRAIN = {
  /** Read error × readScale × (readNear + readPerS × seconds still to come, capped at 1). */
  readScale: 0.9,
  readNear: 0.4,
  readPerS: 0.9,
  /** With more than this left (s) he may change his mind instead of being wrong-footed. */
  adjustT: 0.45,
  /** A ball crossing within this of him (m) is taken on his feet, not dived at. */
  standWithin: 0.9,
};

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
    opts: JSON.parse(JSON.stringify(st.opts)) as BrainOptions, hopSide: st.hopSide, hopFromX: st.hopFromX,
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
  st.hopFromX = s.hopFromX ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
//  KEEPER PRO (Leo v0.15, 11 Oct 2026) — positioning, rushing out, claims
// ─────────────────────────────────────────────────────────────────────────
//
// Settings → Gameplay → Keeper pro. New: everything below, plus the engine's
// resolveKeeperPro / keeperClaimTouch (canvasEngine.ts). Old: none of it runs
// and the keeper is exactly the one from before. Real-football numbers and
// the before/after measurements: docs/gameplay15/keeper.md; the test:
// tests/star/keeperPro.mts.

export const KEEPER_PRO_BRAIN = {
  /** A man clean through, centrally, inside this distance (m): the keeper comes out to meet him. */
  rushWithin: 24,
  rushWide: 12,
  /**
   * TIME TO DIVE. His reach before he has reacted: an arm's length (m)…
   * …and the seconds from his reaction to full stretch. Sports-science
   * figures: a keeper's reaction to a strike is about 0.2-0.3 s and a full
   * dive into the corner takes about 0.5-0.7 s after it. Tuned so an
   * 80-rated keeper's save % by distance lands on the real one (docs/gameplay15/keeper.md).
   */
  handNow: 1.3,
  handFull: 0.35,
  /** A man clean through: he is at least this far off his line (m) — real one-on-ones 2.0-2.5 m at every distance, where a scramble from 7 m finds him at 1.2 m. */
  throughDepth: 2.3,
  /** While a pass is on its way to a man about to be clean through, he comes off his line by up to this much (m). */
  rushCap: 2.2,
  /** Coming forward is a run: × his side-step speed. */
  rushSpeed: 1.9,
  /** The step toward a team-mate who has received it clean through (m). */
  rushStep: 1.8,
  /** A defender within this many metres of the line from the ball to goal, goal-side of it, means he is not clean through. */
  coverLane: 2.0,
  /**
   * The open-play dial (KEEPER_BRAIN.openPlay) with Keeper pro on: how much
   * of the dial's "hard to read from distance" is left. Middle (0.55) plays
   * as 0.8. Before, a well-struck shot from 22 m+ on target beat an
   * 80-rated keeper 17-33% of the time; real Premier League keepers concede
   * 8-10% of on-target shots from there (StatsBomb 2015/16).
   */
  farReadShare: 0.45,
  // ── Claims (crosses and through balls) ──
  /** How deep he commands his box for a ball in the air: a 40 → a 95 (m from his line). */
  aerialDepth: [6.0, 9.0] as [number, number],
  /** A ball on the ground: anywhere in his area. */
  groundDepth: 16.5, groundWide: 16,
  /** Reaction to a delivery (s), 40 → 95, and his run (m/s). */
  react: [0.32, 0.2] as [number, number],
  run: [4.6, 6.2] as [number, number],
  /** He only comes if he gets there this much sooner than any attacker (s), 40 → 95. */
  margin: [0.4, 0.15] as [number, number],
  /** How high he can take it (m), 40 → 95. */
  top: [2.55, 2.85] as [number, number],
  /** Of crosses he comes for: a flap at fresh air, 40 → 95… */
  flap: [0.08, 0.02] as [number, number],
  /** …and a punch rather than a catch (more when an attacker is close, or it is high). */
  punch: 0.15, punchContested: 0.22, punchHigh: 0.12, punchGood: -0.1,
  /** An attacker can take the ball this close to him (m), up to this height (a jumping header, m), after this start (s), running this fast (m/s). Above his reach it is the keeper's: his hands go higher than any head. */
  attackerReach: 1.0, attackerTop: 2.3, attackerStart: 0.15, attackerRun: 7.0,
  /** In his six-yard box he takes a ball an attacker would reach up to this much sooner (s): he has hands, and it is his box. */
  sixEdge: 0.2,
};

const proG = (r: number) => grow(clamp(r, 20, 99), 40, 95, 1.0);
const lerp2 = (ab: [number, number], g: number) => ab[0] + (ab[1] - ab[0]) * g;

/** Is a man with the ball at `at` clean through: central, close enough, nobody goal-side in the way? */
export function clearThrough(sc: Scenario, at: { x: number; y: number }): boolean {
  const P = KEEPER_PRO_BRAIN;
  if (Math.abs(at.x - CX) > P.rushWide) return false;
  const D = Math.hypot(at.x - CX, at.y);
  if (D > P.rushWithin || D < 7) return false;
  for (const d of sc.defenders) {
    if (!(d.y < at.y - 0.5) || d.y < 0) continue;
    const f = (at.y - d.y) / Math.max(0.5, at.y);
    const lineX = at.x + (CX - at.x) * f;
    if (Math.abs(d.x - lineX) < P.coverLane) return false;
  }
  return true;
}

const smooth01 = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * KEEPER PRO: how far off his line he sets for a ball at `ball` — the real
 * keepers' depth (StatsBomb, Premier League 2015/16, 9,800 shots, keeper's
 * spot in the freeze frame at the strike): 1.2 m for a shot from under 8 m,
 * 1.6 m from 8-12, 2.3-2.4 m from 12-22, 1.8-1.9 m from 22 m out. The old
 * curve fell to 0.9 m for a long shot (measured 1.1 m in the game). A man
 * clean through: at least `throughDepth` (real one-on-ones: 2.0-2.5 m).
 */
export function proDepth(sc: Scenario, ball: { x: number; y: number }): number {
  const D = Math.hypot(ball.x - CX, ball.y);
  const ang = Math.atan2(Math.abs(ball.x - CX), Math.max(0.5, ball.y));
  let d = 1.0 + 1.4 * smooth01(5, 15, D) - 0.5 * smooth01(20, 28, D);
  if (clearThrough(sc, ball)) d = Math.max(d, KEEPER_PRO_BRAIN.throughDepth);
  const wideCut = 1 - 0.45 * Math.sin(ang);
  return clamp(d * wideCut, 0.8, Math.max(0.8, ball.y - 4));
}

interface ClaimPlan { x: number; y: number; z: number; t: number; tK: number; tA: number; aerial: boolean }

/**
 * Read a delivery (a cross, a pass, a through ball): where it will be, and
 * whether he gets there clearly before any of our men. Returns his claim, or
 * the spot one of ours will meet it (for stepping up to a man through), or nothing.
 */
function readDelivery(sc: Scenario, st: State, ball: Ball): { claim: ClaimPlan | null; meet: { x: number; y: number } | null } {
  const P = KEEPER_PRO_BRAIN;
  const k = sc.keeper;
  const g = proG(st.ab.rating);
  const react = lerp2(P.react, g), run = lerp2(P.run, g), margin = lerp2(P.margin, g), top = lerp2(P.top, g);
  const aerialDepth = lerp2(P.aerialDepth, g);
  const ours: { x: number; y: number }[] = [];
  if (sc.runner) ours.push(sc.runner.pos);
  for (const r of sc.secondaryRunners ?? []) ours.push(r.pos);
  const f = sc.follower;
  if (f && f.x > -100 && f.y < 200 && !f.shot) ours.push(f);
  let x = ball.pos.x, y = ball.pos.y, z = ball.z, vx = ball.vel.x, vy = ball.vel.y, vz = ball.vz;
  const dt = 0.02;
  for (let t = dt; t <= 2.6; t += dt) {
    // A plain flight: gravity, a bounce, rolling friction. Good to a few
    // tenths of a metre over the second or two that matter.
    x += vx * dt; y += vy * dt;
    if (z > 0 || vz > 0) {
      vz -= 9.81 * dt; z += vz * dt;
      if (z < 0) { z = 0; if (vz < -2) { vz = -vz * 0.5; vx *= 0.8; vy *= 0.8; } else vz = 0; }
    } else {
      const sp = Math.hypot(vx, vy), drop = 1.9 * dt;
      if (sp <= drop) { vx = 0; vy = 0; } else { vx *= (sp - drop) / sp; vy *= (sp - drop) / sp; }
    }
    if (y < 0.2) break;
    let tA = Infinity;
    for (const a of ours) tA = Math.min(tA, P.attackerStart + Math.max(0, Math.hypot(a.x - x, a.y - y) - P.attackerReach) / P.attackerRun);
    const aerial = z > 0.9;
    const inArea = aerial
      ? y <= aerialDepth && Math.abs(x - CX) <= 9.16
      : y <= P.groundDepth && Math.abs(x - CX) <= P.groundWide;
    if (inArea && z <= top) {
      // His six-yard box is his: there a keeper who arrives with them takes it.
      const six = y <= 5.5 && Math.abs(x - CX) <= 9.16;
      const tK = react + Math.max(0, Math.hypot(x - k.x, y - k.y) - 0.6) / run;
      if (tK <= t && tK + (six ? -P.sixEdge : margin) <= tA) return { claim: { x, y, z, t, tK, tA, aerial }, meet: null };
    }
    if (z <= P.attackerTop && tA <= t) return { claim: null, meet: { x, y } };
    if (Math.hypot(vx, vy) < 0.3 && z === 0) break;
  }
  return { claim: null, meet: null };
}

/**
 * KEEPER PRO, every substep while the ball is ours but not a shot. Returns
 * true when it has moved him this step (the ordinary "set" logic then stands
 * down).
 */
function proOffBall(sc: Scenario, st: State, ball: Ball, dt: number): boolean {
  const P = KEEPER_PRO_BRAIN;
  const k = sc.keeper;
  const g = proG(st.ab.rating);
  if (st.claimGo) {
    const live = !!k.claim && !ball.loose && ball.lastTouch === "attack";
    if (!live) {
      // It is over (caught, punched, flapped at, or one of ours got there):
      // he is where he is; he resets from there.
      st.claimGo = null; k.claim = null;
      st.setTarget = { x: k.x, y: k.y }; st.planted = true; st.moving = false;
      return false;
    }
    st.claimGo.t += dt;
    if (st.claimGo.t >= st.claimGo.at) {
      moveToward(sc, st, { x: st.claimGo.x, y: st.claimGo.y }, lerp2(P.run, g), dt);
      k.startX = k.x; k.targetX = k.x;
    }
    return true;
  }
  if (st.phase !== "set" || st.claimRead) return false;
  if (ball.loose || ball.resting || ball.lastTouch !== "attack") return false;
  if (Math.hypot(ball.vel.x, ball.vel.y) < 5) return false;
  st.claimRead = true;
  const { claim, meet } = readDelivery(sc, st, ball);
  if (claim) {
    const r = st.rng;
    const flap = r() < lerp2(P.flap, g) * (claim.aerial ? 1 : 0.3);
    const contested = claim.tA - claim.tK < 0.6;
    const punch = claim.aerial && r() < P.punch + (contested ? P.punchContested : 0) + (claim.z > 2.2 ? P.punchHigh : 0) + P.punchGood * g;
    const dir = (Math.sign(claim.x - CX) || (r() < 0.5 ? -1 : 1)) * (0.3 + r() * 0.9);
    const c: KeeperClaim = {
      x: claim.x, y: claim.y, act: flap ? "miss" : punch ? "punch" : "catch", dir, pace: r(),
      reach: claim.aerial ? 1.0 : 1.1, top: lerp2(P.top, g),
    };
    k.claim = c;
    st.claimGo = { x: claim.x, y: claim.y, at: lerp2(P.react, g), t: 0 };
    st.reason = claim.aerial ? "came for it" : "swept up";
    return true;
  }
  if (meet && clearThrough(sc, meet)) {
    // Played through to one of ours: he comes off his line to meet him
    // while the ball is still travelling, not after it has arrived.
    const ideal = planSet(sc, st, meet);
    st.setTarget = stepToward({ x: k.x, y: k.y }, ideal, P.rushCap);
    st.reason = "comes out";
  }
  return false;
}

/**
 * KEEPER PRO: his reach while a shot is coming, every substep. The engine's
 * reach is a full-length dive from where he stands — but a dive takes time.
 * A ball that arrives before he has reacted meets only what his hands can
 * already cover (`handNow`, about an arm's length); from his reaction his
 * hands spread to the full stretch over `handFull` seconds. A shot from 25 m
 * gives him all of it; one from 8 m, struck hard, barely any. On top: the
 * top-corner cut (KEEPER_HUMAN), and a dive's own window, as before.
 * Computed fresh each step from his un-cut reach, so nothing compounds.
 */
function applyProReach(sc: Scenario, st: State, ball: Ball | null): void {
  const k = sc.keeper;
  const live = !!ball && !k.done
    && (st.phase === "wait" || st.phase === "step" || st.phase === "dive")
    && st.lastShot && k.saves === 0 && !k.scrambling
    && ball.lastTouch === "attack" && !ball.loose && ball.pos.y > k.y;
  if (!live) {
    if (st.cutOn) { if (st.phase === "dive") windowReach(sc, st); else sc.keeperReach = st.baseReach; }
    st.cutOn = false;
    return;
  }
  if (st.phase === "dive") windowReach(sc, st);
  const r0 = st.phase === "dive" ? (sc.keeperReach ?? 1) : (st.baseReach ?? 1);
  const top = st.opts.topCorner !== false && !oldKeepers() ? topCornerReach(sc, ball!, st.shotX) : 1;
  const P = KEEPER_PRO_BRAIN;
  const full = Math.max(0.5, st.fullR);
  const hand = P.handNow + (full - P.handNow) * clamp((st.t - st.rt) / P.handFull, 0, 1);
  const time = clamp(hand / full, 0, 1);
  const f = top * time;
  if (f < 0.999) { sc.keeperReach = r0 * f; st.cutOn = true; }
  else { sc.keeperReach = st.phase === "dive" ? r0 : st.baseReach; st.cutOn = false; }
}
