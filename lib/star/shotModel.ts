/**
 * SHOTS PRO — how the player's own shot leaves the boot (Leo v0.15, job 2).
 *
 * Settings → Look → Gameplay → "Shots": New | Old. Old is `launch()` exactly
 * as it was (CanvasMatch calls plain `launch`); New wraps it here. Nothing in
 * canvasEngine.ts changes: every test that calls `launch` directly still gets
 * today's ball.
 *
 * Real reference and before/after numbers: docs/gameplay15/shots.md.
 *
 * What New changes, for a ball struck AT GOAL (a pass is untouched):
 *
 *  1. HEIGHT IS AIMED, NOT GUESSED. Where you strike the ball now sets how
 *     high it ARRIVES at the goal, whatever the distance: the top of the ball
 *     skims in low, the middle comes in at hip height, below the middle rises
 *     to the top corner, the bottom is still the chip (today's physics). Old:
 *     a tap in the middle of the ball sent a full-power penalty in at 2.1 m,
 *     a few centimetres under the bar — 12% of a thumb's penalties went over.
 *
 *  2. EXECUTION ERROR THAT IS REAL AND SHOWN. A footballer does not put the
 *     ball exactly where he looks. The spread grows with how hard he hits it,
 *     shrinks with technique, and grows for a volley, a header, a strike from
 *     distance, or a man in his face. The aim arrow draws that spread as a
 *     cone (`spreadDeg`), so the arrow tells the truth.
 *
 *  3. CONTACT QUALITY. Where on the ball you tap is graded (`gradeContact`):
 *     a clean strike is a little quicker and truer, a sliced/topped/scuffed one
 *     loses pace and line — and the strike screen says which.
 *
 *  4. THE KNUCKLEBALL AND THE POWER SHOT, moved from the test match
 *     (canvasEngineTest.ts, /star-match-dev) behind their own switch
 *     ("knucklePower"). A knuckleball is a hard strike through the dead centre
 *     of the ball (no spin), and wobbles late. A power shot winds up while the
 *     defence closes, then a green circle: hit it fast for up to 1.5x pace.
 *
 * Every random draw here comes from its own seed (`shotSeed`), never the
 * match's stream, so a goal replay re-strikes the same ball.
 */
import {
  isDriveAtGoal, markLanding, clamp,
  type Ball, type Contact, type KickSkills, type Scenario, type ScenarioKind, type Vec2,
} from "./canvasEngine";
import { gameplayVersion } from "./gameplayVersion";
import { mulberry32 } from "./season";
import { fieldApplies, fieldContact, struckAtGoal } from "./shotFeel";

// ─────────────────────────────────────────────────────────────────────────
//  Switches
// ─────────────────────────────────────────────────────────────────────────

export const shotsPro = () => gameplayVersion("shotsPro") === "new";
export const knucklePowerOn = () => gameplayVersion("knucklePower") === "new";

// ─────────────────────────────────────────────────────────────────────────
//  Which strikes the model touches
// ─────────────────────────────────────────────────────────────────────────

/** Kinds whose strike is a pass or a delivery, or a dead ball with its own
 *  rules (kindRules/freeKick.ts): never touched. A free kick already converts
 *  at the real rate (6%, StatsBomb ~6%). */
const UNTOUCHED: ScenarioKind[] = ["corner", "byline_cross", "free_kick"];

/** Goal-line x of the mouth (pitch metres) and its margin for "aimed at goal". */
const AIMED_PAD = 2.5;

/** Is this drag a shot at goal (its line crosses the goal line near the mouth)? */
export function aimedAtGoal(sc: Scenario, dir: Vec2): boolean {
  if (UNTOUCHED.includes(sc.kind)) return false;
  if (!(dir.y < -0.05)) return false;
  const n = Math.hypot(dir.x, dir.y) || 1;
  const ux = dir.x / n, uy = dir.y / n;
  if (uy > -0.15) return false; // barely heading towards goal: a pass across
  const x = sc.ball.x + ux * (sc.ball.y / -uy);
  return x > sc.goal.x1 - AIMED_PAD && x < sc.goal.x2 + AIMED_PAD;
}

// ─────────────────────────────────────────────────────────────────────────
//  Contact quality
// ─────────────────────────────────────────────────────────────────────────

export type ContactGrade = "clean" | "knuckle" | "chip" | "sliced" | "topped" | "scuffed" | "plain";

export interface ContactRead {
  grade: ContactGrade;
  /** Pace multiplier. */
  power: number;
  /** Spread multiplier. */
  spread: number;
  /** What the strike screen and commentary call it ("" = nothing said). */
  label: string;
}

/** A hard strike through the dead centre knuckles. */
export const KNUCKLE_R = 0.13;
/** Taps nearer the middle than this (fraction of the radius, sideways) put no curl on it. */
export const CURL_DEAD = 0.12;
export const KNUCKLE_MIN_POWER = 0.8;

/**
 * Where you tapped the ball (cx right, cy down, radius ≤ 1; a tap in the
 * margin outside the ball arrives as exactly radius 1 — ContactBall snaps it
 * to the edge) → how good a strike that was.
 *
 * The sweet zone is everything inside 0.78 of the radius: real strikes come
 * off the laces or the inside of the foot, through the body of the ball. The
 * rim is a thin contact: off the top it is topped into the grass, off the
 * side it is sliced, and outside the ball altogether it is scuffed. The
 * bottom rim is the chip — a deliberate shot, not a mistake.
 */
export function gradeContact(c: Contact, power: number, knuckles = true, field = false): ContactRead {
  const r = Math.hypot(c.cx, c.cy);
  if (r >= 0.999) return { grade: "scuffed", power: 0.62, spread: 2.2, label: "SCUFFED" };
  if (knuckles && r < KNUCKLE_R && power >= KNUCKLE_MIN_POWER) return { grade: "knuckle", power: 1.04, spread: 1, label: "KNUCKLEBALL" };
  if (c.cy > 0.62 && Math.abs(c.cx) < 0.55) return { grade: "chip", power: 1, spread: 1, label: "" };
  if (r > 0.78) {
    if (c.cy < -0.6) return { grade: "topped", power: 0.78, spread: 1.4, label: "TOPPED" };
    // Contact field (shotFeel.ts): the side of the ball is the side-foot
    // curler, a strike on purpose — not a slice.
    if (field && Math.abs(c.cx) > 0.55) return { grade: "plain", power: 1, spread: 1.1, label: "CURLER" };
    if (Math.abs(c.cx) > 0.55) return { grade: "sliced", power: 0.88, spread: 1.8, label: "SLICED" };
    return { grade: "plain", power: 1, spread: 1.15, label: "" };
  }
  return { grade: "clean", power: 1.04, spread: 0.85, label: "CLEAN" };
}

// ─────────────────────────────────────────────────────────────────────────
//  Spread: how far off the line a footballer puts it
// ─────────────────────────────────────────────────────────────────────────

/** Harder to strike true: a volley off a moving ball, a header, a strike from
 *  distance at full stretch. Measured against StatsBomb on-target rates by
 *  kind (docs/gameplay15/shots.md). */
const KIND_SPREAD: Partial<Record<ScenarioKind, number>> = {
  volley: 1.9,
  header: 1.7,
  long_range: 1.6,
  tight_angle: 1.3,
  penalty: 0.5,
};
/** Sideways spread at technique 100 and how much a technique-0 player adds (degrees, full power). */
const SPREAD_BASE = 2.6;
const SPREAD_SKILL = 6.0;
/** Up/down spread as a share of the sideways one (an angle too, so it grows
 *  with distance: a strike from 25 m is blazed over far more than one from 8). */
const VERT_RATIO = 0.75;
/** A defender this close to the ball when it is struck hurries the shot. */
const PRESSURE_R = 2.2;
const PRESSURE_SPREAD = 1.3;

/** Sideways spread (sd, degrees) of the strike, before contact quality. */
export function spreadDeg(sc: Scenario, power: number, technique: number): number {
  const t = clamp(technique, 0, 100) / 100;
  const base = SPREAD_BASE + (1 - t) * SPREAD_SKILL;
  const effort = 0.5 + 0.5 * clamp(power, 0, 1.5) ** 2;
  return base * effort * (KIND_SPREAD[sc.kind] ?? 1) * (underPressure(sc) ? PRESSURE_SPREAD : 1);
}

/** Up/down spread (sd, metres at the goal line, `dist` metres away). */
export function spreadHeight(sc: Scenario, power: number, technique: number, dist: number): number {
  return Math.tan((spreadDeg(sc, power, technique) * VERT_RATIO * Math.PI) / 180) * dist;
}

export function underPressure(sc: Scenario): boolean {
  return sc.defenders.some((d) => Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < PRESSURE_R);
}

// ─────────────────────────────────────────────────────────────────────────
//  Height at the goal line
// ─────────────────────────────────────────────────────────────────────────

/** Tap height on the ball (cy: -1 top … +1 bottom) → the height it is meant to
 *  arrive at the goal line, metres. Above CHIP_FROM_CY, today's physics (a lob). */
export const CHIP_FROM_CY = 0.62;
/** Above the ball's middle by more than this: a drive, today's strike. */
export const DRIVE_BELOW_CY = -0.25;
const HEIGHT_AT_LINE: [number, number][] = [
  [-1, 0.12], [-0.5, 0.3], [0, 0.85], [0.3, 1.6], [CHIP_FROM_CY, 2.45],
];
export function intendedHeight(cy: number): number {
  const p = HEIGHT_AT_LINE;
  if (cy <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (cy <= p[i][0]) {
      const [a, ha] = p[i - 1], [b, hb] = p[i];
      return ha + ((cy - a) / (b - a)) * (hb - ha);
    }
  }
  return p[p.length - 1][1];
}

const G = 9.8;
const DRAG = 0.12; // canvasEngine AIR_DRAG

/** The upward speed that brings a ball travelling `speed` m/s horizontally
 *  over `dist` metres in at `height` (launched at z0). Null if it cannot get there. */
export function vzForHeight(dist: number, speed: number, height: number, z0 = 0.08): number | null {
  if (!(speed > 0.5) || !(dist > 0)) return null;
  const f = 1 - (dist * DRAG) / speed;
  if (f <= 0.05) return null;
  const T = -Math.log(f) / DRAG;
  return (height - z0 + 0.5 * G * T * T) / T;
}

// ─────────────────────────────────────────────────────────────────────────
//  The strike
// ─────────────────────────────────────────────────────────────────────────

export interface ShotExtras {
  /** A power shot's pace multiplier (1-1.5) and drift off line (degrees). */
  powerMult?: number;
  driftDeg?: number;
  /** Forced: the power shot's contact is never a knuckleball. */
  noKnuckle?: boolean;
}

export interface ShotRecord {
  seed: number;
  extras?: ShotExtras;
}

/** The engine's `launch`, handed in by the match (CanvasMatch) — this file
 *  only shapes what goes into it and what comes out (one-engine rule). */
export type Kick = (sc: Scenario, dir: Vec2, power: number, contact: Contact, skills: KickSkills, rng: () => number) => Ball;

export interface StruckShot {
  ball: Ball;
  /** Undefined when the model did not touch this kick (a pass, the switch off). */
  read?: ContactRead;
  spread?: number;
}

function gauss(r: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function rot(v: Vec2, deg: number): Vec2 {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/**
 * The player's kick, through the Shots model. A drag that is not at goal is
 * plain `launch`, draw for draw. `match` decides the switches (pass `pro:
 * false` for today's game exactly).
 */
export function launchShot(
  sc: Scenario, dir: Vec2, power: number, contact: Contact, skills: KickSkills,
  rng: () => number, rec: ShotRecord,
  opts: { pro: boolean; knuckle: boolean; field?: boolean; lift?: number },
  launch: Kick,
): StruckShot {
  const st = launchShotRaw(sc, dir, power, contact, skills, rng, rec, opts, launch);
  // Shot power (shotFeel.ts, Oct 13): a harder striker's ball rises a little
  // less, so a 100 is not "guaranteed over the bar". Only a strike at goal
  // that is still yours; never with the Shots model on (it aims the height
  // at the line itself).
  const lift = opts.lift ?? 1;
  const b = st.ball;
  if (lift !== 1 && !opts.pro && struckAtGoal(sc, dir, contact.cx) &&b.lastTouch === "attack" && !b.loose && b.vel.y < -1) {
    b.vz *= lift;
    b.shot = isDriveAtGoal(b, sc);
    b.youStruckAtGoal = b.shot;
    markLanding(b, sc);
  }
  return st;
}

function launchShotRaw(
  sc: Scenario, dir: Vec2, power: number, contact: Contact, skills: KickSkills,
  rng: () => number, rec: ShotRecord,
  opts: { pro: boolean; knuckle: boolean; field?: boolean },
  launch: Kick,
): StruckShot {
  const extras = rec.extras ?? {};
  const atGoal = aimedAtGoal(sc, dir);
  const powered = extras.powerMult && extras.powerMult > 1;
  // Contact field (shotFeel.ts, Oct 13): the tap as the ball feels it — the
  // up/down part fades toward the edges. `contact` stays the real tap for
  // grading (a side strike is a curler, not a slice).
  const field = !!opts.field && fieldApplies(sc.kind);
  const vc = field ? fieldContact(contact) : contact;
  if (!opts.pro && !(opts.knuckle && atGoal)) {
    // Today's strike (plus, when only the power shot is on, its pace and drift).
    const d = powered || extras.driftDeg ? rot(dir, extras.driftDeg ?? 0) : dir;
    return { ball: launch(sc, d, power * (extras.powerMult ?? 1), vc, skills, rng) };
  }
  if (!atGoal) {
    return { ball: launch(sc, dir, power, vc, skills, rng) };
  }
  const r = mulberry32(rec.seed >>> 0);
  const read = gradeContact(contact, power, opts.knuckle && !extras.noKnuckle, field);
  if (!opts.pro) {
    // Knuckleball/power shot on, Shots model off: today's strike + the extras.
    const d = rot(dir, extras.driftDeg ?? 0);
    const ball = launch(sc, d, power * (extras.powerMult ?? 1), vc, skills, rng);
    if (read.grade === "knuckle") makeKnuckle(ball, r);
    return { ball, read: read.grade === "knuckle" ? read : undefined };
  }
  const spread = spreadDeg(sc, power, skills.technique) * read.spread;
  const d = rot(dir, gauss(r) * spread + (extras.driftDeg ?? 0));
  const p = power * read.power * (extras.powerMult ?? 1);
  const ball = launch(sc, d, p, vc, skills, rng);
  // Only a ball still yours and still heading for goal (a header can be lost
  // in the air: applyAerialContest has already turned it into a clearance).
  if (ball.lastTouch !== "attack" || ball.loose || !(ball.vel.y < -1)) return { ball, read, spread };
  // A thumb on the middle of the ball is never dead centre. Old: every
  // hundredth of the ball's width off centre was curl, so a tap meant
  // straight bent a metre or two off the arrow at random (measured: the
  // biggest single reason the ball did not go where the arrow said). The
  // middle fifth of the ball is now a straight strike; curl starts beyond it
  // and still reaches today's full bend at the edge.
  if (contact.cx !== 0) {
    const a = Math.abs(contact.cx);
    const shaped = Math.max(0, a - CURL_DEAD) / (1 - CURL_DEAD);
    ball.spin *= shaped / a;
  }
  if (read.grade !== "chip") {
    const speed = Math.hypot(ball.vel.x, ball.vel.y);
    const dist = (ball.pos.y / -ball.vel.y) * speed;
    // Aimed at a height at the line. Struck over the top (a drive, or topped)
    // it is never lifted MORE than today's strike: from distance today's ball
    // already skids in low under the bodies in front of it (and is blocked at
    // the real rate); close in, today's "low drive" arrived at 1.3-1.9 m — a
    // full-power penalty struck on the top of the ball went in at chest height.
    const want = read.grade === "topped" ? 0.12 : intendedHeight(vc.cy);
    const vz = vzForHeight(dist, speed, want, ball.z);
    if (vz !== null) ball.vz = vc.cy < DRIVE_BELOW_CY || read.grade === "topped" ? Math.min(ball.vz, vz) : vz;
    // The up/down part of the spread, as an angle off the struck line.
    const slope = Math.tan((spreadDeg(sc, power, skills.technique) * VERT_RATIO * read.spread * Math.PI) / 180);
    ball.vz = clamp(ball.vz + gauss(r) * slope * speed, 0.2, 14);
  }
  if (read.grade === "knuckle") makeKnuckle(ball, r);
  // What launch decided from the old flight, decided again from this one.
  ball.shot = isDriveAtGoal(ball, sc);
  ball.youStruckAtGoal = ball.shot;
  markLanding(ball, sc);
  return { ball, read, spread };
}

// ─────────────────────────────────────────────────────────────────────────
//  The knuckleball (from canvasEngineTest.ts, Leo 5 Oct 2026)
// ─────────────────────────────────────────────────────────────────────────
//
// Real physics (Hong & Asai; Darbois-Texier & Clanet): a ball struck with
// almost no spin zig-zags late in its flight by about a ball's width, and the
// direction is unpredictable. Exaggerated here (0.35-0.6 m) so it can be SEEN
// on a phone; the real figure is ~0.2 m.

export interface KnuckleState { t: number; onset: number; amp: number; freq: number; phase: number; phase2: number }

const KNUCKLE_AMP: [number, number] = [0.35, 0.6];
const KNUCKLE_FREQ: [number, number] = [9, 13];
const KNUCKLE_ONSET: [number, number] = [0.16, 0.3];
const KNUCKLE_SPIN_KEEP = 0.06;

const knuckles = new WeakMap<Ball, KnuckleState>();

export function knuckleOf(ball: Ball): KnuckleState | undefined { return knuckles.get(ball); }

export function makeKnuckle(ball: Ball, r: () => number): void {
  const lerp = (a: [number, number]) => a[0] + (a[1] - a[0]) * r();
  ball.spin *= KNUCKLE_SPIN_KEEP;
  ball.topspin = 0;
  knuckles.set(ball, { t: 0, onset: lerp(KNUCKLE_ONSET), amp: lerp(KNUCKLE_AMP), freq: lerp(KNUCKLE_FREQ), phase: r() * Math.PI * 2, phase2: r() * Math.PI * 2 });
}

/** Offset (metres) from a true flight at time t — sideways and up. An offset,
 *  not a push, so it zig-zags round the line it was struck on. */
export function knuckleOffset(kn: KnuckleState, t: number): { lat: number; vert: number } {
  if (t < kn.onset) return { lat: 0, vert: 0 };
  const env = Math.min(1, (t - kn.onset) / 0.25);
  const lat = kn.amp * env * (Math.sin(kn.freq * t + kn.phase) + 0.55 * Math.sin(2.37 * kn.freq * t + kn.phase2)) / 1.55;
  const vert = kn.amp * 0.4 * env * Math.sin(1.6 * kn.freq * t + kn.phase2 + 1);
  return { lat, vert };
}

/**
 * One substep of a knuckleball's wobble, called just before `stepBall`. Only
 * while it is still yours, in the air and really travelling; once anyone has
 * touched it, it is an ordinary ball.
 */
export function stepKnuckle(ball: Ball, dt: number): void {
  const kn = knuckles.get(ball);
  if (!kn) return;
  if (ball.lastTouch !== "attack" || ball.loose || ball.inNet) { knuckles.delete(ball); return; }
  const t0 = kn.t;
  kn.t += dt;
  const sp = Math.hypot(ball.vel.x, ball.vel.y);
  if (ball.z <= 0.02 || sp <= 8) return;
  const a = knuckleOffset(kn, t0), b = knuckleOffset(kn, kn.t);
  const px = -ball.vel.y / sp, py = ball.vel.x / sp;
  ball.pos.x += px * (b.lat - a.lat);
  ball.pos.y += py * (b.lat - a.lat);
  ball.z = Math.max(0.02, ball.z + (b.vert - a.vert));
}

// ─────────────────────────────────────────────────────────────────────────
//  The power shot (from canvasEngineTest.ts, Leo 5 Oct 2026)
// ─────────────────────────────────────────────────────────────────────────
//
// Leo: "prepare more for shot, takes more time in game getting rushed, have to
// pull back leg and smash it ... a little green circle popping up on a random
// part of the ball that you have to click quickly and the longer you take the
// worse the accuracy ... maybe up to x1.5 power".

export const POWER_SHOT_WINDUP_S = 0.45;
export const POWER_SHOT_PERFECT_S = 0.22;
export const POWER_SHOT_SLOW_S = 0.85;
export const POWER_SHOT_MAX_MULT = 1.5;
export const POWER_SHOT_MAX_DRIFT_DEG = 8.5;
/** Laces, just above centre. */
export const POWER_SHOT_CONTACT: Contact = { cx: 0, cy: -0.25 };

export function powerShotQuality(reactionS: number, hitCircle: boolean): number {
  if (!hitCircle || !(reactionS >= 0)) return 0;
  if (reactionS <= POWER_SHOT_PERFECT_S) return 1;
  return clamp(1 - (reactionS - POWER_SHOT_PERFECT_S) / (POWER_SHOT_SLOW_S - POWER_SHOT_PERFECT_S), 0, 1);
}

export function powerShotStrike(quality: number, r: () => number): Required<Pick<ShotExtras, "powerMult" | "driftDeg">> {
  const q = clamp(quality, 0, 1);
  const side = r() < 0.5 ? -1 : 1;
  return {
    powerMult: 1 + (POWER_SHOT_MAX_MULT - 1) * q,
    driftDeg: side * (0.5 + (POWER_SHOT_MAX_DRIFT_DEG - 0.5) * (1 - q)),
  };
}

/** Pressing speeds while he winds up (canvasEngine's DEF_PRESS_SPEED / DEF_CONTAIN_R / DEF_COVER_SPEED). */
const WIND_PRESS_SPEED = 4.3;
const WIND_CONTAIN_R = 1.75;
const WIND_COVER_SPEED = 3.4 * 0.6;

/**
 * The wind-up: you have pulled your leg back and the pitch has not waited.
 * The nearest defender closes you down, the others slide into the line between
 * ball and goal. (The keeper keeps getting set by his own brain meanwhile.)
 */
export function stepWindUp(sc: Scenario, dt: number): void {
  const b = sc.ball;
  const gcx = (sc.goal.x1 + sc.goal.x2) / 2;
  for (const d of sc.defenders) {
    if (d.baseRole === "hold") continue;
    let tx: number, ty: number, sp: number;
    if (d.role === "press") {
      const dx = d.x - b.x, dy = d.y - b.y, dist = Math.hypot(dx, dy) || 1;
      if (dist <= WIND_CONTAIN_R) continue;
      tx = b.x + (dx / dist) * WIND_CONTAIN_R; ty = b.y + (dy / dist) * WIND_CONTAIN_R;
      sp = WIND_PRESS_SPEED;
    } else {
      const ax = gcx - b.x, ay = 0 - b.y, len2 = ax * ax + ay * ay || 1;
      const f = clamp(((d.x - b.x) * ax + (d.y - b.y) * ay) / len2, 0.15, 0.95);
      tx = b.x + ax * f; ty = b.y + ay * f;
      sp = WIND_COVER_SPEED;
    }
    const mx = tx - d.x, my = ty - d.y, m = Math.hypot(mx, my);
    if (m < 0.01) continue;
    const step = Math.min(m, sp * (d.speed ?? 1) * dt);
    d.x += (mx / m) * step; d.y += (my / m) * step;
  }
}

/** This strike's own seed: off the chance's seed and how far into it we are. */
export function shotSeedFor(seed: number, calls: number): number {
  return ((seed ^ Math.imul(calls + 1, 0x7feb352d)) ^ 0x5407) >>> 0;
}
