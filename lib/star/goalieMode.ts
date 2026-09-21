import { GOAL_W, GOAL_H } from "./pitch";

/**
 * GOALIE MODE — you are the keeper, facing a shot.
 *
 * Requested directly, as a standalone reflex minigame ("for now... a fun
 * minigame almost you can play anytime you want... lets just say its in
 * casino for now") rather than anything wired into a real career or match —
 * no integration decision has been made yet, so this is deliberately its own
 * self-contained system, not an extension of the real match engine. Also
 * deliberately: this file never imports from `canvasEngine.ts` and never
 * will — the team's own standing rule on that file is "only ever ADD to
 * gameplay, never change it, and never modify it", and the cleanest way to
 * honour that for a genuinely new, genuinely different camera and mechanic
 * is a fresh, self-contained module, same precedent `firstPersonDribble.ts`
 * and `dribble.ts` already set for exactly this reason.
 *
 * Pure simulation: no React, no canvas, no input handling. A single function
 * decides what shot you're facing (`pickShot`) and a single function decides
 * whether you stopped it (`resolveDive`) — everything the renderer needs
 * (where the ball is at any instant, how far into his dive the keeper is)
 * is derived from those two, not tracked separately, so the picture can
 * never show something the physics didn't actually decide.
 *
 * ── The one tension the whole game is built on ──
 *
 * Requested directly, in detail: "a dive takes time and u cant get up
 * quickly or move instantaneously so its ideal to dive RIGHT BEFORE or
 * RIGHT AS the shot is taken so u need quick reflexes, you obvs cant just
 * hold ur gloves somewhere and have ur guy in the air blocking a whole side
 * of a goal." That's three real constraints, and `resolveDive` implements
 * all three from one shared timeline:
 *
 *   commitT        — the instant you actually dive (tap/release), seconds
 *                     since the shot sequence began
 *   shot.strikeAtT  — when the ball is actually struck (buildupT)
 *   shot.arriveAtT  — when it reaches the goal line (buildupT + flightT)
 *
 * Two SEPARATE checks decide `reachFrac`, not one combined "hold then drift
 * back" timer — a first version tried that (timing the drift-back off how
 * long the dive sat completed before the ball actually ARRIVED), and a real
 * measured bug in a widened commit-time sweep is why it's wrong: at low
 * difficulty the ball is slow (mean flight ~0.76s) while a modest dive
 * completes in a quarter of that, so committing exactly AT the strike
 * finished so far ahead of arrival that he'd already drifted all the way
 * back to centre by the time the ball got there. Save rate was flat and low
 * from 0.9s early through committing exactly at the strike, then climbed to
 * 100% only by committing 0.35-0.5s AFTER the strike — reacting to the ball
 * already in flight. That's backwards from what was asked: waiting to see
 * it go was the winning strategy, not reflexes.
 *
 * The fix decouples "did you guess blind, early" from "is this shot slow":
 *
 *   1. `earliness = strikeAtT − commitT`, positive = committed before the
 *      strike. Inside `EARLY_GRACE_T` of the strike (reading the tell and
 *      going a LITTLE early, which is real skill) costs nothing — `ceiling`
 *      stays 1. Beyond it, `ceiling` decays toward `STALE_FLOOR` over
 *      `STALE_T` — a dive committed well before the striker even shows his
 *      hand has, physically, already sagged by the time he actually strikes
 *      it, whatever happens next. That's the whole answer to "cant just
 *      hold your gloves somewhere": the penalty is for guessing blind, not
 *      for however long the ball then happens to take.
 *   2. Given that ceiling, `timeAvailable = arriveAtT − commitT` against
 *      `diveDuration(distance)` still governs the ordinary physical limit —
 *      not enough raw time to cover the distance (a late reaction, or a
 *      fast shot) eases `reachFrac` up toward the ceiling but caps short of
 *      it, exactly as before.
 *
 * Committing exactly at the strike now always keeps the full ceiling and
 * — for anything but the hardest, fastest, widest shots — enough time to
 * reach it: the genuinely optimal play. Committing early decays smoothly;
 * committing very late still runs out of physical time to travel. The
 * sweet spot this produces is not asserted, it's what the arithmetic below
 * actually does: `tests/star/goalieMode.mts` drives real shots through
 * `resolveDive` at a sweep of commit times and checks the save rate peaks
 * at/around the strike and is clearly worse well before it, the same
 * "measure the fairness, don't just claim it" discipline
 * `firstPersonDribble.ts`'s own duel math was built and tested against.
 *
 * ── Difficulty ──
 *
 * Climbs with `streak` (consecutive saves in the current run) along every
 * axis a real shot actually gets harder on: faster (shorter `flightT`, less
 * total reflex time), better placed (`placementBias` pushes the target
 * nearer the post/bar), more shot-type variety (header/volley/curl unlock
 * as the streak grows, drive is the only kind at streak 0), and a shorter
 * tell (`tellT` — how long before the strike the striker's body actually
 * shows which way it's going). Never an unreadable one: the tell never
 * disappears entirely, the same principle `firstPersonDribble.ts`'s own
 * defenders use ("a stronger defender does not move faster in some
 * unreadable way — he telegraphs less. That is the one difficulty knob that
 * preserves fairness as it climbs").
 */

export type ShotKind = "drive" | "curl" | "header" | "volley" | "first_time";

export interface GoalieShot {
  kind: ShotKind;
  /** Metres out from the goal line the striker's effort starts from —
   *  purely for the renderer's camera/run-up animation; the physics below
   *  never reads it. */
  startY: number;
  /** Seconds from the start of the sequence to the strike itself. */
  strikeAtT: number;
  /** Seconds the tell is visible before the strike — shrinks with
   *  difficulty, never to zero. */
  tellT: number;
  /** Seconds the ball takes to travel from the strike to the goal line. */
  flightT: number;
  /** = strikeAtT + flightT. Exported so a caller never has to re-derive it
   *  and risk it drifting out of step with the two fields above. */
  arriveAtT: number;
  /** Where it's actually headed, goal-local metres: x = 0 centre (negative
   *  = keeper's left), z = 0 ground, GOAL_H = crossbar height. */
  targetX: number;
  targetZ: number;
  /** True for a shot that was never on target at all — over the bar or
   *  wide of a post regardless of the dive. A real, if increasingly rare,
   *  mercy: `offTargetChance` below tapers it away as difficulty climbs,
   *  exactly like a real striker gets more clinical, not less. */
  offTarget: boolean;
  /** Which side the tell actually points — always the true sign of
   *  targetX, so reading it correctly and diving that way is always the
   *  right call, never a decoy. */
  tellSide: -1 | 1;
  /** Which side the STRIKER himself runs up from/stands on — purely
   *  cosmetic (the renderer's own run-up/shooting-spot position), rolled
   *  independently of `tellSide`. Roughly half the time he shoots back
   *  toward his own side (a tucked-in near-post finish); the rest he's
   *  shooting across his own body to the far corner — a real, distinct
   *  picture, not just a mirrored one. Never leaks target information
   *  beyond what the tell itself already gives away — see `tellSide`. */
  strikerSide: -1 | 1;
  /** 0-1, purely cosmetic flight-path bend for the renderer — the save/goal
   *  resolution below only ever reads targetX/targetZ, so a curled shot is
   *  exactly as save-able as a straight one struck at the same target; the
   *  curve is what makes TRACKING it with your eyes harder, not a second
   *  hidden target. */
  curl: number;
}

/** Real reach — a professional keeper's lateral dive plus arm span covers
 *  a bit under the full width of the goal, never the whole thing (nobody
 *  saves a shot right in the postangle without getting a hand to it, which
 *  this deliberately allows to occasionally beat you — see MAX_REACH_X
 *  against GOAL_W/2). */
export const MAX_REACH_X = GOAL_W / 2 - 0.35;
export const MAX_REACH_Z = GOAL_H - 0.12;
/** Where he stands, set, before every shot. Centred — any shading is
 *  something the PLAYER does with the dive, never the AI doing it for you. */
export const KEEPER_SET_X = 0;
export const KEEPER_SET_Z = 0.9;

/**
 * Metres per second his dive travels once he's committed and past the
 * fixed push-off below.
 *
 * Measured, then corrected: a first pass at 9.2 m/s (a real elite lateral
 * dive speed on its own) covered the full ~3.3 m to a corner in ~0.38s —
 * comfortably under every shot's own flight time in this game, even the
 * fastest close-range ones at maximum difficulty. A real scratch harness
 * (sweeping commit time from 0.6s before the strike to 0.6s after it, with
 * perfect aim, at streak 0) showed why that's a real bug and not a nitpick:
 * save rate climbed the ENTIRE way from -0.6s to +0.35s and was still 100%
 * there — meaning committing over a THIRD of a second AFTER the ball had
 * already been struck was still a certain save. That is the opposite of
 * "quick reflexes, dive right before or as it's struck": the honest
 * optimal strategy was to wait and see, not to read anything. Slowed to
 * 6.6 m/s so a full corner dive takes ~0.55s — genuinely comparable to or
 * longer than a hard shot's own flight time, which is what makes reading
 * the tell and committing DURING it (not after the strike) load-bearing
 * rather than decorative. Re-measured after: see the header's own "real
 * peaked window" note.
 */
const DIVE_SPEED = 6.6; // m/s
/** Fixed reaction/push-off before any lateral travel starts, whatever the
 *  distance — nobody moves in zero time. */
const REACT_T = 0.05;
/**
 * Seconds before the strike you can still commit at full effectiveness —
 * reading the tell and going a LITTLE early is real skill, not a defect.
 * See the file header for the measured bug this replaced (timing the
 * penalty off the ball's own arrival instead of off the strike).
 */
const EARLY_GRACE_T = 0.15;
/** Seconds of earliness, beyond the grace window, before a blind-guess dive
 *  has fully sagged and gone stale by the time the ball is even struck. */
const STALE_T = 0.35;
/** Worst a fully stale early guess can do to your ceiling — still a body
 *  in the goal, never a guaranteed miss. */
const STALE_FLOOR = 0.12;
/** How close his final position has to be to the ball's real target to
 *  count as a save. A real keeper blocks more than just his gloves — his
 *  whole body is in the way — so this is comfortably more than a bare
 *  fingertip radius. */
const SAVE_REACH = 1.05;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1);
  return 1 - u * u * u;
}

/** Full dive time to a target `distance` metres from the set position. */
function diveDuration(distance: number): number {
  return REACT_T + distance / DIVE_SPEED;
}

// ── Shot-kind ranges ─────────────────────────────────────────────────────
//
// Real distances and real relative pace: a header is close range and quick
// because it IS close range; a curled effort is deliberately a shade slower
// than a straight drive from the same distance, because placement over
// pace is the entire idea of a finesse shot.
interface KindProfile {
  startY: [number, number];   // metres out
  speed: [number, number];    // m/s, ball pace — scales flightT with distance
  buildup: [number, number];  // seconds of run-up/receipt before the strike
  curl: [number, number];
  /** Streak at which this kind first becomes possible. drive is always on. */
  unlocksAt: number;
}
const KIND_PROFILES: Record<ShotKind, KindProfile> = {
  drive: { startY: [14, 21], speed: [21, 30], buildup: [1.0, 1.7], curl: [0, 0.15], unlocksAt: 0 },
  first_time: { startY: [7, 11], speed: [18, 27], buildup: [0.5, 0.8], curl: [0, 0.15], unlocksAt: 1 },
  curl: { startY: [12, 18], speed: [17, 24], buildup: [1.0, 1.6], curl: [0.45, 0.85], unlocksAt: 2 },
  header: { startY: [6, 10], speed: [12, 18], buildup: [0.7, 1.1], curl: [0, 0.1], unlocksAt: 3 },
  volley: { startY: [9, 14], speed: [19, 29], buildup: [0.6, 1.0], curl: [0.1, 0.4], unlocksAt: 4 },
};

/** 0-1, how hard the difficulty curve is leaning at this streak — climbs
 *  quickly at first (the jump from "any old shot" to "genuinely has to be
 *  read" should be felt early) and eases off rather than climbing forever,
 *  so a long run stays hard without becoming a mathematically unbeatable
 *  wall. */
function difficulty(streak: number): number {
  return 1 - Math.exp(-streak / 5.5);
}

function pickKind(streak: number, rng: () => number): ShotKind {
  const available = (Object.keys(KIND_PROFILES) as ShotKind[]).filter(
    (k) => streak >= KIND_PROFILES[k].unlocksAt,
  );
  return available[Math.floor(rng() * available.length)];
}

function lerp(range: [number, number], f: number): number {
  return range[0] + (range[1] - range[0]) * f;
}

/** A shot too far off target to be a real chance at all, so no keeper on
 *  earth beats a specific probability floor purely by standing there — see
 *  the file header. Shrinks toward a low but real floor as difficulty
 *  climbs, mirroring a real striker getting more clinical, not less. */
function offTargetChance(diff: number): number {
  return 0.16 - diff * 0.12; // 16% at streak 0 → 4% floor at high difficulty
}

export function pickShot(streak: number, rng: () => number): GoalieShot {
  const diff = difficulty(streak);
  const kind = pickKind(streak, rng);
  const profile = KIND_PROFILES[kind];

  const startY = lerp(profile.startY, rng());
  // Faster as difficulty climbs — up to the kind's own top pace, never past
  // it (a header never suddenly outpaces a driven shot from twice the
  // distance; each kind keeps its own real character throughout).
  const paceF = clamp(0.15 + diff * 0.85 + rng() * 0.15, 0, 1);
  const speed = lerp(profile.speed, paceF);
  const buildupT = lerp(profile.buildup, rng());
  const flightT = startY / speed;

  // Placement: further from centre and higher as difficulty climbs — a
  // genuine corner-and-top-corner bias at high streaks, a comfortable,
  // saveable-without-real-precision shot at streak 0. `side` and `height`
  // are independent rolls so a hard shot isn't ALWAYS top-corner (a firm,
  // low near-post drive is just as real a hard shot to read in time).
  const side: -1 | 1 = rng() < 0.5 ? -1 : 1;
  const placementF = clamp(0.25 + diff * 0.65 + rng() * 0.25, 0, 1);
  const targetX = side * MAX_REACH_X * placementF;
  const heightF = clamp(rng() * (0.35 + diff * 0.5), 0, 1);
  const targetZ = heightF * MAX_REACH_Z;

  // Independent of the tell — see the field's own doc. A near-post finish
  // (same side) a little more often than a far-post, cross-body one, which
  // is the rarer, more dramatic picture.
  const strikerSide: -1 | 1 = rng() < 0.55 ? side : (side === 1 ? -1 : 1);

  // Tell narrows with difficulty but never below a real, readable floor —
  // see difficulty()'s own doc and firstPersonDribble.ts's identical
  // reasoning for tellT.
  const tellT = 0.42 - diff * 0.22; // 0.42s at streak 0 → 0.20s floor

  const curl = lerp(profile.curl, rng());
  const offTarget = rng() < offTargetChance(diff);

  return {
    kind, startY, strikeAtT: buildupT, tellT, flightT,
    arriveAtT: buildupT + flightT,
    targetX, targetZ, offTarget, tellSide: side, strikerSide, curl,
  };
}

/** A short, human name for the shot, for a real on-screen tag ("HEADER FROM
 *  A CROSS", "FAR POST") — asked for directly, so the variety in `pickShot`
 *  is something a player consciously notices shot to shot, not something
 *  only the physics knows about. Pure and derived entirely from the shot
 *  itself, so it can never say something the actual shot isn't doing. */
export function shotLabel(shot: GoalieShot): string {
  switch (shot.kind) {
    case "header": return "HEADER FROM A CROSS";
    case "volley": return "VOLLEY";
    case "first_time": return "FIRST-TIME STRIKE";
    case "curl": return "CURLING EFFORT";
    case "drive":
      if (shot.startY >= 17) return "LONG RANGE";
      return shot.strikerSide === shot.tellSide ? "NEAR POST" : "FAR POST";
    default: return "SHOT";
  }
}

export interface DiveInput {
  /** Seconds since the shot sequence started — when you actually
   *  committed (tapped/released), not when you started dragging. */
  commitT: number;
  targetX: number;
  targetZ: number;
}

export interface DiveResult {
  saved: boolean;
  /** Where the keeper actually ended up, goal-local metres. */
  reachX: number;
  reachZ: number;
  /** 0-1, how far through his full possible reach to the COMMITTED target
   *  he got by arrival — drives the dive animation directly (a renderer
   *  reads this as KeeperPose.lunge). */
  reachFrac: number;
  /** True once he's past full stretch and drifting back toward centre —
   *  see the file header. */
  recovering: boolean;
  /** Metres between where he ended up and where the ball actually crossed
   *  the line — for the renderer/commentary ("inches away", "never
   *  moving"), not read by anything in this file. */
  distance: number;
}

/**
 * No dive at all — he's still standing set. A shot that beats him without
 * you ever touching the screen is exactly as real as one you dived the
 * wrong way for.
 */
const SET_RESULT: Omit<DiveResult, "saved" | "distance"> = {
  reachX: KEEPER_SET_X, reachZ: KEEPER_SET_Z, reachFrac: 0, recovering: false,
};

/**
 * How blind a guess this commit was, measured against the STRIKE, never the
 * ball's own arrival — see the file header for why that distinction is the
 * whole fix for the fairness bug this replaced. Committing after the strike
 * is never "early" (earliness goes negative, staleExcess floors at 0) —
 * only committing before it costs anything.
 */
function ceilingFor(shot: GoalieShot, commitT: number): { ceiling: number; recovering: boolean } {
  const earliness = shot.strikeAtT - commitT;
  const staleExcess = Math.max(0, earliness - EARLY_GRACE_T);
  const staleFrac = clamp(staleExcess / STALE_T, 0, 1);
  return { ceiling: 1 - staleFrac * (1 - STALE_FLOOR), recovering: staleFrac > 0 };
}

/**
 * `reachFrac` at any evaluation instant `atT`, given a dive to `distToTarget`
 * metres committed at `commitT` with a given `ceiling`. Shared by
 * `resolveDive` (evaluated once, at `shot.arriveAtT`, to decide the outcome)
 * and `liveDiveState` (evaluated every rendered frame, so the animation is
 * never anything other than a live readout of the exact same formula the
 * save/goal decision is made from — no separate, driftable easing curve for
 * the renderer to keep in sync by hand).
 */
function reachFracAt(distToTarget: number, ceiling: number, commitT: number, atT: number): number {
  const fullT = diveDuration(distToTarget);
  const timeAvailable = atT - commitT;
  if (timeAvailable <= 0) return 0;
  if (timeAvailable <= fullT) {
    // Genuinely not enough raw time to cover the distance yet — eased so the
    // dive reads as a real launch-and-stretch rather than constant-velocity.
    return (distToTarget > 0.001 ? easeOutCubic(timeAvailable / fullT) : 1) * ceiling;
  }
  // Plenty of raw time — the dive itself completes well before arrival,
  // however slow this particular shot happens to be. That costs nothing
  // extra: the only charge for early timing is the staleness ceiling above,
  // never a second penalty just for the ball taking its time.
  return ceiling;
}

export function resolveDive(shot: GoalieShot, input: DiveInput | null): DiveResult {
  if (shot.offTarget) {
    // Never a save to claim credit for — it was never coming in. Reported
    // as wide/over, not as your reflexes beating anybody.
    return { ...SET_RESULT, saved: true, distance: 0 };
  }

  if (!input) {
    const dx = shot.targetX - KEEPER_SET_X, dz = shot.targetZ - KEEPER_SET_Z;
    const distance = Math.hypot(dx, dz);
    return { ...SET_RESULT, saved: distance <= SAVE_REACH, distance };
  }

  const { ceiling, recovering } = ceilingFor(shot, input.commitT);
  const distToTarget = Math.hypot(input.targetX - KEEPER_SET_X, input.targetZ - KEEPER_SET_Z);
  const reachFrac = reachFracAt(distToTarget, ceiling, input.commitT, shot.arriveAtT);

  const reachX = KEEPER_SET_X + (input.targetX - KEEPER_SET_X) * reachFrac;
  const reachZ = KEEPER_SET_Z + (input.targetZ - KEEPER_SET_Z) * reachFrac;
  const distance = Math.hypot(shot.targetX - reachX, shot.targetZ - reachZ);
  return { saved: distance <= SAVE_REACH, reachX, reachZ, reachFrac, recovering, distance };
}

/**
 * The keeper's dive state at any instant DURING the sequence, not just the
 * final result — a renderer needs this every frame to animate the launch
 * and stretch live rather than snapping straight to the outcome. Reuses
 * `ceilingFor`/`reachFracAt` directly, so what the player watches happen is
 * never anything other than the same formula `resolveDive` will eventually
 * judge him by, evaluated a little earlier.
 */
export function liveDiveState(
  shot: GoalieShot, input: DiveInput, atT: number,
): Pick<DiveResult, "reachX" | "reachZ" | "reachFrac" | "recovering"> {
  const { ceiling, recovering } = ceilingFor(shot, input.commitT);
  const distToTarget = Math.hypot(input.targetX - KEEPER_SET_X, input.targetZ - KEEPER_SET_Z);
  const reachFrac = reachFracAt(distToTarget, ceiling, input.commitT, atT);
  const reachX = KEEPER_SET_X + (input.targetX - KEEPER_SET_X) * reachFrac;
  const reachZ = KEEPER_SET_Z + (input.targetZ - KEEPER_SET_Z) * reachFrac;
  return { reachX, reachZ, reachFrac, recovering };
}

// ── Betting ─────────────────────────────────────────────────────────────
//
// "the bet stacks the more in a row u do" — a real push-your-luck ladder:
// cash out any time and bank stake × the current multiplier, or push on for
// a bigger one at the next, harder shot. One goal conceded busts the run
// and the stake with it — no partial credit, same as every other Casino
// game here (a lost blackjack hand doesn't return half the bet either).
//
// The ladder itself climbs steeply enough to be worth the real risk of a
// harder shot (streak 5 is nearly 5x, not a token bump) but is bounded —
// EXP_CAP stops it running away to a number that would bankrupt the bank
// on one lucky run, the same reasoning `competitionBetting.ts`'s own
// realistic-max-price cap uses for the exact same failure mode.
const MULT_BASE = 1.35;
const MULT_GROWTH = 1.22;
const MULT_CAP = 12;

export function streakMultiplier(streak: number): number {
  if (streak <= 0) return 1;
  return Math.min(MULT_CAP, MULT_BASE * Math.pow(MULT_GROWTH, streak - 1));
}
