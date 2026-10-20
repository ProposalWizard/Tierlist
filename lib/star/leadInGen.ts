/**
 * BUILD-UPS BEFORE A CHANCE — made from the match's own moment.
 *
 * Harry, 14 Oct 2026: "I like build up being on some chances and not other.
 * Like one on ones. Some long shots. Crosses where ur in the middle etc."
 *
 * Only with Settings → Chances: New (newChancesOn()). Old: no build-up, the
 * game exactly as before. With Full highlights rebuild: On (test), every fresh
 * open-play chance gets the rebuild's generated build-up instead
 * (lib/star/fhr/buildUp.ts, phase 2); this file's own builder is then unused.
 *
 * Before some fresh open-play chances in the real match, 2-3 seconds of play
 * come first, then the chance is yours exactly as its drawing places it:
 *
 *   settled play (the radar's "settled")  → 2-3 short passes down the lane,
 *                                           the last one to you;
 *   a break (the radar's "transition")    → one long ball forward to you,
 *                                           then you carry it onto the spot.
 *
 * Everyone starts in the team shape of the full-match replay (sim90.ts's
 * shapeOf, through teamShapesAt) for where the ball is when the move starts,
 * pulled toward his place in the chance only as far as he needs to get there
 * without running faster than a man can. Everyone ends EXACTLY where the
 * drawing has him, the ball ends on the drawing's ball, and the camera
 * (leadIn.ts's leadInCamera: it follows the passes, then is fixed once the
 * ball is in the 6-yard box) ends on the chance's own frame. A tap skips it.
 *
 * It is played by the real match (CanvasMatch's `leadIn` prop) as a replay of
 * these positions: nothing is stepped, no physics, no new loop.
 *
 * Pure: no React, no canvas. tests/star/leadInGen.mts measures it.
 */
import type { Scenario, ScenarioKind, Vec2 } from "./canvasEngine";
import {
  leadInEntities, ballAlong, LEAD_MAX_RUN,
  type LeadIn, type LeadMoment, type LeadBallKey, type LeadEntity,
} from "./leadIn";
import { teamShapesAt } from "./sim90";
import { mulberry32 } from "./season";
import { newChancesOn } from "./newChances";
import { fhrOn } from "./fhr/toggle";
import { fhrBuildUpFor, fhrWantsBuildUp } from "./fhr/buildUp";
import { realMomentLeadIn } from "./fhr/realMomentHighlights";
import { PITCH_W, CX, HALF_LEN } from "./pitch";

// ─────────────────────────────────────────────────────────────────────────
//  WHICH CHANCES GET A BUILD-UP — the one table to change.
// ─────────────────────────────────────────────────────────────────────────
//
// The share of these chances that get one (1 = always, 0.5 = about half,
// decided by the chance's own seed so the same chance always does the same).
// A kind not listed gets none. Set pieces (penalty, free kick, corner) never
// get one, and neither does a move carrying on (a pass that found its man,
// a lay-off, a re-touch): the play before it has just happened on screen.
//
// Note on crosses: in every drawn cross and cutback YOU are the man on the
// ball at the byline (measured: 0 of 200 drawn crosses, 2 of 200 cutbacks
// have you in the middle). So their build-up ends with the ball reaching YOU
// out wide. A cross with you in the middle would be the header / volley
// kinds, which are switched off (switchedOffKinds.ts).
export const BUILD_UP_KINDS: Partial<Record<ScenarioKind, number>> = {
  one_on_one: 1,
  long_range: 0.5,
  byline_cross: 1,
  cutback: 1,
};

/** Kinds that are set pieces: never a build-up, whatever the table says. */
const SET_PIECES: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["penalty", "free_kick", "corner"]);

/** Whether this chance gets a build-up (before the setting is checked). */
export function wantsBuildUp(kind: ScenarioKind, moment: Pick<LeadMoment, "fresh" | "seed" | "pattern">): boolean {
  if (!moment.fresh || SET_PIECES.has(kind) || moment.pattern === "set_piece") return false;
  const share = BUILD_UP_KINDS[kind] ?? 0;
  if (share >= 1) return true;
  if (share <= 0) return false;
  return mulberry32((moment.seed ^ 0x6c1d5e3b) >>> 0)() < share;
}

// ─────────────────────────────────────────────────────────────────────────
//  The numbers
// ─────────────────────────────────────────────────────────────────────────

/** The pause on the ball before the first pass, seconds. */
export const BUILD_HOLD_S = 0.3;
/** A team-mate's touch between receiving and passing it on, seconds. */
export const BUILD_TOUCH_S = 0.2;
/** The shortest a build-up lasts, seconds (a quick one is played a little slower). */
export const BUILD_MIN_S = 2;
/** After the last pass reaches you: the moment before the chance is yours. */
export const BUILD_TAIL_S = 0.2;
/** A short pass takes this long, seconds, whatever its length: a longer one is simply driven harder. */
export const SHORT_PASS_S = 0.7;
/** A pass from a man who is only in the build-up may be driven from this far (m), so he plays it from out of the chance's frame. */
export const PUSH_OUT_M = 28;
/** A long ball's speed, m/s (it is in the air). */
export const LONG_BALL_SPEED = 22;
/** Carrying it, m/s. */
export const CARRY_SPEED = 6.5;
/** Short passes: how long each one is (m). */
export const SHORT_PASS_M: [number, number] = [9, 13];
/** A break: the long ball's length (m) and the carry after it (m). */
export const LONG_BALL_M: [number, number] = [22, 30];
export const CARRY_M: [number, number] = [4, 7];
/** The longest long ball, m: one from a man only in the build-up is played from out of the chance's frame. */
export const LONG_BALL_MAX_M = 42;
/**
 * The fastest a man runs, on average, along one stretch of his path. Each
 * stretch eases in and out (half of a smooth start and stop, half steady), so
 * his top speed is 1.25 × this: 7 m/s average stays under LEAD_MAX_RUN (9).
 */
const EASE_PEAK = 1.25;
export const RUN_AVG = (LEAD_MAX_RUN / EASE_PEAK) * 0.97;

// ─────────────────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const LANE_X = { left: 13.5, centre: CX, right: 54.5 } as const;
const inPitch = (p: Vec2): Vec2 => ({ x: clamp(p.x, 3, PITCH_W - 3), y: clamp(p.y, 2, 2 * HALF_LEN - 3) });

/** One stretch of a man's path. */
interface Key { t: number; p: Vec2 }
/** Half a smooth start-and-stop, half steady: the top speed is EASE_PEAK × the average. */
const ease = (f: number) => { const c = clamp(f, 0, 1); return 0.5 * c + 0.5 * c * c * (3 - 2 * c); };
function along(keys: Key[], t: number): Vec2 {
  if (t <= keys[0].t) return { ...keys[0].p };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const g = b.t > a.t ? ease((t - a.t) / (b.t - a.t)) : 1;
      return { x: a.p.x + (b.p.x - a.p.x) * g, y: a.p.y + (b.p.y - a.p.y) * g };
    }
  }
  return { ...keys[keys.length - 1].p };
}
/** A start no further from `to` than a man covers in `s` seconds at RUN_AVG. */
const reachable = (from: Vec2, to: Vec2, s: number): Vec2 => {
  const d = dist(from, to), r = RUN_AVG * Math.max(0, s);
  if (d <= r) return { ...from };
  const k = r / d;
  return { x: to.x + (from.x - to.x) * k, y: to.y + (from.y - to.y) * k };
};

/** Greedy nearest pairs: each end spot gets the nearest unused shape slot. */
function matchSlots(ends: Vec2[], slots: Vec2[]): (Vec2 | null)[] {
  const pairs: { i: number; j: number; d: number }[] = [];
  ends.forEach((e, i) => slots.forEach((s, j) => pairs.push({ i, j, d: dist(e, s) })));
  pairs.sort((a, b) => a.d - b.d);
  const out: (Vec2 | null)[] = ends.map(() => null);
  const usedJ = new Set<number>();
  for (const pr of pairs) {
    if (out[pr.i] || usedJ.has(pr.j)) continue;
    out[pr.i] = { ...slots[pr.j] };
    usedJ.add(pr.j);
  }
  return out;
}

export interface BuildUp extends LeadIn {
  kind: "passes" | "break";
  ballKeys: LeadBallKey[];
  /** Each man's path keys (entity keys, and extra0… for men only in the build-up). */
  paths: Map<string, Key[]>;
  /** Where each of the chance's people would have stood in the team shape (before any pull toward the chance). */
  shape: Map<string, Vec2>;
  /** Who plays each pass (entity key or extraN), in order. */
  passers: string[];
  passStart: number[];
  passEnd: number[];
}

/**
 * The build-up for a chance `sc` (the chance as the match has set it up, every
 * man where the drawing put him) at the radar's `moment`.
 */
export function buildUpFor(sc: Scenario, moment: LeadMoment): BuildUp {
  const rng = mulberry32((moment.seed ^ 0x2b0e1d97) >>> 0);
  const between = (r: [number, number]) => r[0] + (r[1] - r[0]) * rng();
  const R: Vec2 = { x: sc.ball.x, y: sc.ball.y };
  const ents = leadInEntities(sc);
  const endOf = new Map<string, Vec2>(ents.map((e) => [e.key, e.get()]));
  const youEnd = endOf.get("you")!;
  const off = { x: youEnd.x - R.x, y: youEnd.y - R.y };
  const brk = moment.pattern === "transition";

  // ── The ball's route, worked back from the chance's ball ──
  // Back = away from goal (+y), toward the lane the radar says the move is in.
  const laneX = moment.lane ? (LANE_X[moment.lane] + R.x) / 2 : R.x;
  const stepBack = (from: Vec2, len: number, zig: number): Vec2 => {
    const toLane = clamp((laneX - from.x) * 0.35, -6, 6);
    let dx = toLane + zig, dy = Math.sqrt(Math.max(1, len * len - dx * dx));
    // Wide at the byline: come back up the wing, not across the face of goal.
    if (from.y < 8 && Math.abs(from.x - CX) > 18) dx = clamp(dx, -3, 3);
    const n = Math.hypot(dx, dy) || 1;
    dx = (dx / n) * len; dy = (dy / n) * len;
    return inPitch({ x: from.x + dx, y: Math.max(from.y + 4, from.y + dy) });
  };
  // The chance's own frame: men only in the build-up must be out of it when
  // they go, or they would vanish in front of you as the chance starts.
  const frame = moment.frame ?? sc.viewport;
  // (3 m clear of it: he jogs on a little after his pass.)
  const inFrame = (p: Vec2) => p.x > frame.x1 - 3 && p.x < frame.x2 + 3 && p.y > frame.y1 - 3 && p.y < frame.y2 + 3;
  /** Further back along the pass (away from `to`) until out of the frame, no longer than `maxLen`. */
  const pushOut = (O: Vec2, to: Vec2, maxLen: number): Vec2 => {
    const dx = O.x - to.x, dy = O.y - to.y, n = Math.hypot(dx, dy) || 1;
    let p = O;
    for (let len = n; inFrame(p) && len + 1.5 <= maxLen; ) { len += 1.5; p = inPitch({ x: to.x + (dx / n) * len, y: to.y + (dy / n) * len }); }
    return p;
  };
  // A pass is played by one of the chance's own team-mates whenever one can
  // be there and still get back to his place in the chance in time.
  const mateKeys = ents.filter((e) => e.side === "mate").map((e) => e.key);
  const anchoredTaken = new Set<string>();
  const anchor = (to: Vec2, ideal: Vec2, left: number, minLen: number, maxLen: number): { key: string; from: Vec2 } | null => {
    let best: { key: string; from: Vec2 } | null = null, bs = Infinity;
    // He stands 0.7 m behind the ball as he plays it: that is taken off his reach.
    const r = RUN_AVG * left - 0.8;
    for (const k of mateKeys) {
      if (anchoredTaken.has(k)) continue;
      const E = endOf.get(k)!;
      const dd = dist(ideal, E);
      const O = inPitch(dd <= r ? { ...ideal } : { x: E.x + ((ideal.x - E.x) * r) / dd, y: E.y + ((ideal.y - E.y) * r) / dd });
      const len = dist(O, to);
      if (len < minLen || len > maxLen || O.y < to.y - 8 || dist(O, E) > r) continue;
      const score = dist(O, ideal);
      if (score < bs) { bs = score; best = { key: k, from: O }; }
    }
    if (best) anchoredTaken.add(best.key);
    return best;
  };
  const ballKeys: LeadBallKey[] = [];
  let passStart: number[] = [], passEnd: number[] = [];
  const origins: Vec2[] = []; // where each pass is played from, in order
  const anchored: (string | null)[] = []; // the chance's team-mate who plays it, if one can
  let carryFrom: Vec2 | null = null, carryStart = 0;
  let youReceiveAt: Vec2, youReceiveT: number;
  let durS: number;
  if (brk) {
    // One long ball from deep, landing a few metres short of the chance's
    // ball, then you carry it there.
    const back = { x: R.x - off.x, y: R.y - off.y };
    const carryDir = { x: back.x - R.x, y: back.y - R.y };
    const cn = Math.hypot(carryDir.x, carryDir.y) || 1;
    const carryLen = between(CARRY_M);
    // Carried up the pitch (from further out than the ball), toward goal.
    const cdx = (carryDir.x / cn) * 0.3, cdy = Math.max(0.6, Math.abs(carryDir.y / cn));
    const cm = Math.hypot(cdx, cdy);
    carryFrom = inPitch({ x: R.x + (cdx / cm) * carryLen, y: R.y + (cdy / cm) * carryLen });
    const ideal = stepBack(carryFrom, between(LONG_BALL_M), (rng() - 0.5) * 14);
    // (The least time he has after it: the shortest flight, the touch, the carry.)
    const a = anchor(carryFrom, ideal, 0.9 + 0.2 + dist(carryFrom, R) / CARRY_SPEED, 16, LONG_BALL_M[1] + 4);
    const O0 = a ? a.from : pushOut(ideal, carryFrom, LONG_BALL_MAX_M);
    origins.push(O0); anchored.push(a?.key ?? null);
    const d = dist(O0, carryFrom);
    const t0 = BUILD_HOLD_S, t1 = t0 + clamp(d / LONG_BALL_SPEED, 0.9, 1.7);
    ballKeys.push({ t: 0, p: { ...O0 } }, { t: t0, p: { ...O0 } }, { t: t1, p: { ...carryFrom }, pass: { h: Math.min(5, d * 0.13) } });
    passStart.push(t0); passEnd.push(t1);
    carryStart = t1 + 0.1;
    const t2 = carryStart + dist(carryFrom, R) / CARRY_SPEED;
    ballKeys.push({ t: carryStart, p: { ...carryFrom } }, { t: t2, p: { ...R } });
    durS = t2 + 0.1;
    youReceiveAt = { x: carryFrom.x + off.x, y: carryFrom.y + off.y };
    youReceiveT = t1;
  } else {
    // Two or three short passes down the lane, the last one to you. Worked
    // back from you: each pass from where a team-mate of the chance can be.
    const n = rng() < 0.5 ? 2 : 3;
    const pts: Vec2[] = [R];
    let zig = rng() < 0.5 ? -1 : 1;
    for (let j = 0; j < n; j++) {
      const to = pts[0];
      // How long after this pass is played the chance starts.
      const left = BUILD_TAIL_S + j * BUILD_TOUCH_S + (j + 1) * SHORT_PASS_S;
      const ideal = stepBack(to, between(SHORT_PASS_M), zig * (3 + rng() * 4));
      zig = -zig;
      const a = anchor(to, ideal, left, 5, 20);
      pts.unshift(a ? a.from : pushOut(ideal, to, PUSH_OUT_M));
      anchored.unshift(a?.key ?? null);
    }
    let t = BUILD_HOLD_S;
    ballKeys.push({ t: 0, p: { ...pts[0] } }, { t, p: { ...pts[0] } });
    for (let k = 0; k < n; k++) {
      origins.push(pts[k]);
      if (k > 0) { t += BUILD_TOUCH_S; ballKeys.push({ t, p: { ...pts[k] } }); }
      passStart.push(t);
      t += SHORT_PASS_S;
      passEnd.push(t);
      ballKeys.push({ t, p: k === n - 1 ? { ...R } : { ...pts[k + 1] }, pass: { h: 0 } });
    }
    durS = t + BUILD_TAIL_S;
    ballKeys.push({ t: durS, p: { ...R } });
    youReceiveAt = { ...youEnd };
    youReceiveT = passEnd[n - 1];
  }
  // Never shorter than BUILD_MIN_S: a quick one is played a little slower.
  if (durS < BUILD_MIN_S) {
    const k = BUILD_MIN_S / durS;
    for (const q of ballKeys) q.t *= k;
    passStart = passStart.map((x) => x * k); passEnd = passEnd.map((x) => x * k);
    carryStart *= k; youReceiveT *= k; durS = BUILD_MIN_S;
  }

  // ── Everyone's team shape where the move starts ──
  const shapes = teamShapesAt({
    us: moment.us ?? "Your side", them: moment.them ?? "Opponents",
    usStrength: moment.usStrength, themStrength: moment.themStrength,
    ball: origins[0], seed: moment.seed,
  });
  const keeperEnt = ents.find((e) => e.side === "keeper")!;
  const opps = ents.filter((e) => e.side === "opp");
  const mates = ents.filter((e) => e.side === "mate" || e.side === "you");
  const shape = new Map<string, Vec2>();
  shape.set(keeperEnt.key, { ...shapes.them[0] });
  matchSlots(opps.map((e) => endOf.get(e.key)!), shapes.them.slice(1)).forEach((s, i) => { if (s) shape.set(opps[i].key, s); });
  matchSlots(mates.map((e) => endOf.get(e.key)!), shapes.us.slice(1)).forEach((s, i) => { if (s) shape.set(mates[i].key, s); });

  // ── Who plays each pass ──
  // A man on the ball stands just behind it (away from where it goes).
  const onBall = (from: Vec2, to: Vec2): Vec2 => {
    const dx = from.x - to.x, dy = from.y - to.y, n = Math.hypot(dx, dy) || 1;
    return { x: from.x + (dx / n) * 0.7, y: from.y + (dy / n) * 0.7 };
  };
  const target = (k: number) => (k + 1 < origins.length ? origins[k + 1] : brk ? carryFrom! : R);
  const paths = new Map<string, Key[]>();
  const passers: string[] = [];
  const taken = new Set<string>(["you"]);
  let extras = 0;
  for (let k = 0; k < origins.length; k++) {
    const spot = onBall(origins[k], target(k));
    const tIn = k === 0 ? 0 : passEnd[k - 1];
    const tOut = passStart[k];
    // The chance's team-mate the pass was placed for, if he can still get back.
    const cand = anchored[k];
    const ok = cand && !taken.has(cand) && dist(spot, endOf.get(cand)!) / Math.max(0.1, durS - tOut) <= RUN_AVG;
    let who: string;
    if (ok) {
      who = cand!;
      const end = endOf.get(who)!;
      paths.set(who, k === 0
        ? [{ t: 0, p: spot }, { t: tOut, p: spot }, { t: durS, p: { ...end } }]
        : [{ t: 0, p: reachable(shape.get(who) ?? end, spot, tIn) }, { t: tIn, p: spot }, { t: tOut, p: spot }, { t: durS, p: { ...end } }]);
    } else {
      // Nobody can: a team-mate who is only in the build-up, played from out
      // of the chance's frame where it can be. He stays where he played it.
      who = `extra${extras++}`;
      const startP = k === 0 ? spot : reachable({ x: spot.x, y: spot.y + 6 }, spot, tIn);
      const fwd = { x: R.x - spot.x, y: R.y - spot.y }, fn = Math.hypot(fwd.x, fwd.y) || 1;
      const jog = Math.min(1.5, RUN_AVG * 0.3 * (durS - tOut));
      const after = { x: spot.x + (fwd.x / fn) * jog, y: spot.y + (fwd.y / fn) * jog };
      paths.set(who, k === 0
        ? [{ t: 0, p: spot }, { t: tOut, p: spot }, { t: durS, p: after }]
        : [{ t: 0, p: startP }, { t: tIn, p: spot }, { t: tOut, p: spot }, { t: durS, p: after }]);
    }
    taken.add(who);
    passers.push(who);
  }

  // ── You: from the shape onto the last pass ──
  const youShape = shape.get("you") ?? youEnd;
  const youStart = reachable(youShape, youReceiveAt, youReceiveT);
  paths.set("you", [{ t: 0, p: youStart }, { t: youReceiveT, p: youReceiveAt }, { t: durS, p: { ...youEnd } }]);

  // ── Everyone else: from the shape straight to his place in the chance ──
  for (const e of ents) {
    if (paths.has(e.key)) continue;
    const end = endOf.get(e.key)!;
    const from = shape.get(e.key) ?? end;
    paths.set(e.key, [{ t: 0, p: reachable(from, end, durS) }, { t: durS, p: { ...end } }]);
  }

  const ballAt = (t: number) => (t >= durS ? { x: R.x, y: R.y, z: 0 } : ballAlong(ballKeys, t));
  return {
    kind: brk ? "break" : "passes",
    durS, ballKeys, paths, shape, passers, passStart, passEnd,
    extraMates: extras,
    skippable: true,
    ballAt,
    posAt: (key, t) => {
      const path = paths.get(key);
      if (!path) return null;
      if (t >= durS) return { ...path[path.length - 1].p };
      // On a break you carry it: at the ball, where the chance has you beside it.
      if (key === "you" && carryFrom && t >= carryStart) {
        const b = ballAt(t);
        return { x: b.x + off.x, y: b.y + off.y };
      }
      if (key === "you" && carryFrom && t >= youReceiveT) return { ...youReceiveAt };
      return along(path, t);
    },
    captionAt: (t) => (brk ? (t < (passEnd[0] ?? 0) ? "Launched forward…" : "Onto it — carry it on") : "Build-up…"),
  };
}

/** The keys of everyone a build-up moves (for the camera and the tests). */
export const buildUpKeys = (sc: Scenario, b: BuildUp): string[] => [
  ...leadInEntities(sc).map((e: LeadEntity) => e.key),
  ...Array.from({ length: b.extraMates ?? 0 }, (_, i) => `extra${i}`),
];

/**
 * THE CAREER'S BUILD-UPS: CanvasMatch's `leadIn` prop on the real match
 * (app/star-dev/page.tsx). Null — no build-up, the chance exactly as before —
 * unless Chances is New and this chance is one the table lists.
 */
export function careerBuildUp(sc: Scenario, moment?: LeadMoment): LeadIn | null {
  if (!moment || moment.opening) return null;
  // A real moment (Real moment highlights, lib/star/fhr/realMomentHighlights.ts):
  // its build-up is the real 4 s before the shot, everyone where he really ran.
  const real = realMomentLeadIn(sc, moment);
  if (real) return real;
  // Full highlights rebuild: On (test) — phase 2: every fresh open-play chance
  // gets a GENERATED 4–8 s build-up (lib/star/fhr/buildUp.ts). Off: below, as before.
  if (fhrOn()) return fhrWantsBuildUp(sc.kind, moment) ? fhrBuildUpFor(sc, moment) : null;
  if (!newChancesOn()) return null;
  if (!wantsBuildUp(sc.kind, moment)) return null;
  return buildUpFor(sc, moment);
}
