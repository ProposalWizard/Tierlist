/**
 * HEADERS AND VOLLEYS YOU SEE HAPPEN (Harry, 25 Oct 2026).
 *
 * His words, on the live "tap the ball" headers and volleys: "I want us to
 * see the animation of the player going up. The second that the player's
 * head, foot, bicycle kick, or whatever (a side volley) touches the ball ...
 * 4, 5, 6 different animations based on the aerial acrobatic skill, based on
 * flair, based on the angle of the ball, the height of the ball." And: "The
 * most important thing is when the player's foot, head, chest, scorpion
 * kick, bicycle kick, whatever, touches the ball, that's when it brings up
 * the screen with the ball to tap on it. The function is right."
 *
 * The flow (CanvasMatch, real match, highlights, the Head & Volley drill):
 *  1. The cross comes in. Your man goes for it: take-off and rise (riseS),
 *     the move's own frames.
 *  2. The frame his head / chest / laces / instep / overhead foot / heel
 *     touches the ball, the "Head it?" / "Volley it?" screen opens. The ball
 *     is drawn ON that contact point (the baked sprite's own point, see
 *     tools/sprites/new/aerials.js), not near it.
 *  3. You tap the ball, as before (airTap.ts). The strike leaves from the
 *     contact point and he plays the follow-through (followS).
 *
 * Which move: the ball's height and the angle it comes in at, your Aerial &
 * Acrobatics, and your flair. There is no Flair stat in the game (Skills:
 * pace, power, technique, vision, freeKick, aerial), so Technique stands in
 * for flair. Bicycle and scorpion kicks are rare and gated on both.
 *
 * The move tints the strike only slightly (aerialStrikeTint): a bicycle or a
 * scorpion is struck with a little more spread (higher variance), a diving
 * header a little harder. Measured with scripts/aerial/tap-measure.mts
 * --moves: goals per 100 within 2 of no tint at Aerial 30 / 60 / 90.
 *
 * Pure: no React, no canvas. The only randomness is a hash of the chance's
 * seed, so the same chance always picks the same move.
 */
import { headerJump } from "./aerial";
import { offlineDevPlayEnabled } from "./devMode";

export type AerialMove =
  | "standHeader" | "jumpHeader" | "divingHeader"
  | "chestVolley" | "frontVolley" | "sideVolley"
  | "bicycle" | "scorpion";

export const AERIAL_MOVES: readonly AerialMove[] = [
  "standHeader", "jumpHeader", "divingHeader", "chestVolley", "frontVolley", "sideVolley", "bicycle", "scorpion",
];

/** What touches the ball. */
export type ContactPart = "head" | "chest" | "laces" | "instep" | "overheadFoot" | "heel";
/** Which of the baked points (sprites.ts SpritePoints) is the ball's centre at contact. */
export type ContactPoint = "head" | "chest" | "foot";

/** Which way he faces at the contact, against the line to goal. */
export type AerialFacing = "goal" | "ball" | "acrossRight" | "awayGoal";

export interface AerialMoveSpec {
  kind: "header" | "volley";
  part: ContactPart;
  point: ContactPoint;
  /** Its 3D clip (sprites.ts, atlas 3). */
  clip: string;
  /** Frames in the baked clip, and the one where the ball is met. */
  frames: number;
  contactFrame: number;
  /** A chest-down volley also touches the ball on the chest on the way: that frame (else -1). */
  chestFrame: number;
  /** Seconds from take-off to the touch (before the ball screen). */
  riseS: number;
  /** Seconds of follow-through after the tap (before he is back to running). */
  followS: number;
  /** Least / most he is off the grass at the touch, in the match's metres of
   *  height (the ball's scale, which draws a metre of height ~1.4x a man's own:
   *  the old header beat let him rise up to 1.6 of his height for the same reason). */
  minLiftM: number;
  maxLiftM: number;
  /** When in the rise he leaves the grass (share of riseS). */
  airborneAt: number;
  facing: AerialFacing;
  /** The banner word, for the special ones (else ""). */
  banner: string;
  /** How it tints the strike: power × powerK, aim spread ± spreadDeg (seeded). */
  powerK: number;
  spreadDeg: number;
}

export const AERIAL_SPECS: Readonly<Record<AerialMove, AerialMoveSpec>> = {
  standHeader: { kind: "header", part: "head", point: "head", clip: "airStandHeader", frames: 6, contactFrame: 3, chestFrame: -1, riseS: 0.36, followS: 0.4, minLiftM: 0, maxLiftM: 0.2, airborneAt: 0.5, facing: "goal", banner: "", powerK: 0.97, spreadDeg: 0 },
  jumpHeader: { kind: "header", part: "head", point: "head", clip: "airJumpHeader", frames: 7, contactFrame: 4, chestFrame: -1, riseS: 0.48, followS: 0.45, minLiftM: 0.12, maxLiftM: 1.45, airborneAt: 0.3, facing: "goal", banner: "", powerK: 1, spreadDeg: 0 },
  divingHeader: { kind: "header", part: "head", point: "head", clip: "airDivingHeader", frames: 7, contactFrame: 4, chestFrame: -1, riseS: 0.5, followS: 0.55, minLiftM: 0.2, maxLiftM: 1.3, airborneAt: 0.25, facing: "goal", banner: "DIVING HEADER", powerK: 1.05, spreadDeg: 1.5 },
  chestVolley: { kind: "volley", part: "laces", point: "foot", clip: "airChestVolley", frames: 7, contactFrame: 5, chestFrame: 1, riseS: 0.62, followS: 0.4, minLiftM: 0, maxLiftM: 0.15, airborneAt: 1, facing: "goal", banner: "", powerK: 0.98, spreadDeg: 0.5 },
  frontVolley: { kind: "volley", part: "laces", point: "foot", clip: "airFrontVolley", frames: 6, contactFrame: 3, chestFrame: -1, riseS: 0.4, followS: 0.4, minLiftM: 0, maxLiftM: 0.3, airborneAt: 0.8, facing: "goal", banner: "", powerK: 1, spreadDeg: 0 },
  sideVolley: { kind: "volley", part: "instep", point: "foot", clip: "airSideVolley", frames: 6, contactFrame: 3, chestFrame: -1, riseS: 0.42, followS: 0.45, minLiftM: 0, maxLiftM: 0.5, airborneAt: 0.6, facing: "acrossRight", banner: "", powerK: 1.02, spreadDeg: 1 },
  bicycle: { kind: "volley", part: "overheadFoot", point: "foot", clip: "airBicycle", frames: 7, contactFrame: 4, chestFrame: -1, riseS: 0.55, followS: 0.6, minLiftM: 0.1, maxLiftM: 1.2, airborneAt: 0.2, facing: "awayGoal", banner: "BICYCLE KICK!", powerK: 1.03, spreadDeg: 3.5 },
  scorpion: { kind: "volley", part: "heel", point: "foot", clip: "airScorpion", frames: 7, contactFrame: 4, chestFrame: -1, riseS: 0.55, followS: 0.6, minLiftM: 0.05, maxLiftM: 1.0, airborneAt: 0.2, facing: "awayGoal", banner: "SCORPION KICK!", powerK: 0.95, spreadDeg: 4.5 },
};

/**
 * Seconds the touch is shown on the pitch before the ball screen covers it:
 * long enough to see (three frames at 30 fps), short enough that the screen
 * still opens "the second" it touches.
 */
export const CONTACT_SHOW_S = 0.1;

/** Every move's 3D clip name (the aerial atlas). */
export const AERIAL_CLIPS: readonly string[] = AERIAL_MOVES.map((m) => AERIAL_SPECS[m].clip);

export interface AerialPickIn {
  kind: "header" | "volley";
  /** How high the ball arrives (m): a header's cross, a volley's top (airDrawings.ts airZOf). */
  ballZ: number;
  /** The way the ball is travelling on the grass as it arrives (any length; zero = straight at goal). */
  inDir: { x: number; y: number };
  /** From the ball to the middle of the goal (any length). */
  toGoal: { x: number; y: number };
  /** Aerial & Acrobatics, 0-100. */
  aerial: number;
  /** Flair, 0-100 (Technique stands in: there is no Flair stat). */
  flair: number;
  /** The chance's own number: the same chance picks the same move. */
  seed: number;
}

/**
 * How far the ball has to turn (degrees, 0-180): between the way it is
 * travelling and the way to goal. ~0: it comes from behind you, already
 * heading for goal (you are back to goal: bicycle / scorpion country).
 * ~90: a cross from the wing (side volley, a header). ~180: it comes back at
 * you from the goal end (a cut-back: a front volley).
 */
export function turnAngleDeg(inDir: { x: number; y: number }, toGoal: { x: number; y: number }): number {
  const a = Math.hypot(inDir.x, inDir.y), b = Math.hypot(toGoal.x, toGoal.y);
  if (!(a > 1e-9) || !(b > 1e-9)) return 90;
  const c = (inDir.x * toGoal.x + inDir.y * toGoal.y) / (a * b);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Two independent rolls, 0..1, from the chance's seed. */
export function moveRolls(seed: number): [number, number] {
  let h = (seed ^ 0x2f6b9d3) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  let g = Math.imul(h ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  g = Math.imul(g ^ (g >>> 13), 0xc2b2ae35) >>> 0;
  g = (g ^ (g >>> 16)) >>> 0;
  return [h / 4294967296, g / 4294967296];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The gates for the special ones (exported so the test reads the same numbers). */
export const BICYCLE_GATE = { aerial: 72, flair: 65, minZ: 0.9, maxTurn: 80 } as const;
export const SCORPION_GATE = { aerial: 78, flair: 80, minZ: 0.6, maxZ: 1.15, maxTurn: 65 } as const;
export const DIVING_GATE = { aerial: 45, maxZ: 1.8, turn: [40, 140] as const } as const;

/** Bicycle chance when its gate is open: 6% at the gate, 30% at 100 in both. */
export function bicycleChance(aerial: number, flair: number): number {
  if (aerial < BICYCLE_GATE.aerial || flair < BICYCLE_GATE.flair) return 0;
  const k = Math.min(clamp01((aerial - BICYCLE_GATE.aerial) / (100 - BICYCLE_GATE.aerial)), clamp01((flair - BICYCLE_GATE.flair) / (100 - BICYCLE_GATE.flair)));
  return 0.06 + 0.24 * k;
}
/** Scorpion chance when its gate is open: 3% at the gate, 12% at 100 in both. */
export function scorpionChance(aerial: number, flair: number): number {
  if (aerial < SCORPION_GATE.aerial || flair < SCORPION_GATE.flair) return 0;
  const k = Math.min(clamp01((aerial - SCORPION_GATE.aerial) / (100 - SCORPION_GATE.aerial)), clamp01((flair - SCORPION_GATE.flair) / (100 - SCORPION_GATE.flair)));
  return 0.03 + 0.09 * k;
}
/** Diving header chance on a low cross from the side: 12% at the gate, 45% at Aerial 100. */
export function divingChance(aerial: number): number {
  if (aerial < DIVING_GATE.aerial) return 0;
  return 0.12 + 0.33 * clamp01((aerial - DIVING_GATE.aerial) / (100 - DIVING_GATE.aerial));
}

/**
 * Which move your man makes for this ball. A header chance is always a
 * header (the strike screen and the physics are the header's); a volley
 * chance one of the volleys. The move only changes the picture, and the
 * strike's tint by a little.
 */
export function pickAerialMove(p: AerialPickIn): AerialMove {
  const turn = turnAngleDeg(p.inDir, p.toGoal);
  const [u, v] = moveRolls(p.seed);
  if (p.kind === "header") {
    if (p.ballZ <= DIVING_GATE.maxZ && turn >= DIVING_GATE.turn[0] && turn <= DIVING_GATE.turn[1] && u < divingChance(p.aerial)) return "divingHeader";
    return headerJump(p.ballZ, p.aerial).jumpM >= 0.12 ? "jumpHeader" : "standHeader";
  }
  // Volleys. The rare ones first, each on its own roll so one never eats the other's chance.
  if (turn <= SCORPION_GATE.maxTurn && p.ballZ >= SCORPION_GATE.minZ && p.ballZ <= SCORPION_GATE.maxZ && v < scorpionChance(p.aerial, p.flair)) return "scorpion";
  if (turn <= BICYCLE_GATE.maxTurn && p.ballZ >= BICYCLE_GATE.minZ && u < bicycleChance(p.aerial, p.flair)) return "bicycle";
  if (p.ballZ >= 1.15) return "chestVolley";
  if (turn >= 55 && turn <= 125 && p.ballZ >= 0.55) return "sideVolley";
  return "frontVolley";
}

/**
 * The screen angle he faces at the touch (canvas: 0 = right, PI/2 = down),
 * from the screen angle to goal and the screen angle the ball comes FROM.
 * A right-footed side volley sends the ball off to his front-left, so he
 * faces 50° to the right of the goal line (a left-footer the mirror).
 */
export function aerialFacing(move: AerialMove, goalAng: number, fromBallAng: number, foot: number): number {
  const f = AERIAL_SPECS[move].facing;
  const blend = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
  switch (f) {
    case "goal": return move === "divingHeader" ? blend(goalAng, fromBallAng, 0.25) : blend(goalAng, fromBallAng, 0.3);
    case "ball": return fromBallAng;
    case "acrossRight": return goalAng + (foot >= 0 ? 1 : -1) * (50 * Math.PI) / 180;
    case "awayGoal": return goalAng + Math.PI;
  }
}

/** Where he is in the move `e` seconds after take-off (rise), or after the tap (follow). */
export interface AerialPhase {
  /** The baked frame to show (0 .. frames-1). */
  frame: number;
  /** 0..1 of the way from where he stood to where he meets the ball. */
  moveU: number;
  /** 0..1 of his height at the touch he is off the grass now. */
  liftK: number;
}

const easeOut = (u: number) => 1 - (1 - u) * (1 - u);
const smooth = (u: number) => u * u * (3 - 2 * u);

/** Before the touch: the take-off and rise. At e = riseS: the contact frame, the full lift. */
export function aerialRise(move: AerialMove, e: number): AerialPhase {
  const s = AERIAL_SPECS[move];
  const u = clamp01(e / Math.max(1e-3, s.riseS));
  const frame = u >= 1 ? s.contactFrame : Math.min(s.contactFrame - 1, Math.floor(u * s.contactFrame));
  const a = s.airborneAt;
  const liftK = a >= 1 ? (u >= 1 ? 1 : 0) : smooth(clamp01((u - a) / (1 - a)));
  return { frame, moveU: easeOut(u), liftK };
}

/** After the tap: the contact frame held, then the follow-through, and down to the grass. */
export function aerialFollow(move: AerialMove, e: number): AerialPhase & { done: boolean } {
  const s = AERIAL_SPECS[move];
  const u = clamp01(e / Math.max(1e-3, s.followS));
  const after = s.frames - 1 - s.contactFrame;
  const frame = after <= 0 ? s.contactFrame : Math.min(s.frames - 1, s.contactFrame + 1 + Math.floor(u * after * 0.999));
  return { frame: e <= 0 ? s.contactFrame : frame, moveU: 1, liftK: 1 - smooth(u), done: e >= s.followS };
}

/**
 * The strike's tint: power × powerK and the aim turned up to ± spreadDeg,
 * from the chance's own seed (never the match's random stream). A bicycle
 * or scorpion is the widest (higher variance); a standing header the
 * softest. Returns the new aim.
 */
export function aerialStrikeTint(move: AerialMove, dir: { x: number; y: number }, power: number, seed: number): { dir: { x: number; y: number }; power: number } {
  const s = AERIAL_SPECS[move];
  const [u, v] = moveRolls((seed ^ 0x51ed27) >>> 0);
  // Triangular, -1..1: most strikes near the middle, a few at the edge.
  const t = u + v - 1;
  const a = (t * s.spreadDeg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  return { dir: { x: dir.x * c - dir.y * sn, y: dir.x * sn + dir.y * c }, power: Math.max(0.05, Math.min(1, power * s.powerK)) };
}

/**
 * How high (px) he must be lifted at the touch so the contact point is ON a
 * ball drawn `ballUpPx` above its shadow, when the contact point stands
 * `contactUpPx` above his boots in the baked frame (both screen px). Held to
 * the move's jump range (in px: metres × pxPerM). Returns the lift and the
 * height the ball is then drawn at, so the two always meet exactly: when the
 * jump can't reach (or can't go lower), the drawn ball is moved, never the
 * contact point (looks only; the strike starts where the physics says).
 */
export function liftToMeet(move: AerialMove, ballUpPx: number, contactUpPx: number, pxPerM: number): { liftPx: number; ballUpPx: number } {
  const s = AERIAL_SPECS[move];
  const want = ballUpPx - contactUpPx;
  const liftPx = Math.max(s.minLiftM * pxPerM, Math.min(s.maxLiftM * pxPerM, want));
  return { liftPx, ballUpPx: contactUpPx + liftPx };
}

// The switch. On is the game (RUL-UI-001). The old flow (the ball screen after
// AIR_TAP_OPEN_S, the header jump after the tap) is kept for the test pages
// only, to measure against: ?airmoves=old (or localStorage star-air-moves = "old").
const KEY = "star-air-moves";
export function aerialMovesOn(): boolean {
  try {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("airmoves");
      if (q === "old") return false;
      if (q === "new") return true;
    }
    return typeof localStorage === "undefined" || localStorage.getItem(KEY) !== "old";
  } catch { return true; }
}

/** Test pages only (filming): force one move on every header/volley, ?airmove=<move>. Null in the game. */
export function forcedAerialMove(kind: "header" | "volley"): AerialMove | null {
  try {
    if (typeof window === "undefined") return null;
    if (!offlineDevPlayEnabled()) return null;
    const q = new URLSearchParams(window.location.search).get("airmove") as AerialMove | null;
    if (q && (AERIAL_MOVES as readonly string[]).includes(q) && AERIAL_SPECS[q].kind === kind) return q;
  } catch { /* the game's own pick */ }
  return null;
}
