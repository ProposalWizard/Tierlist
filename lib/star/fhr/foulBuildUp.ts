/**
 * FHR-4 — THE FOUL BEFORE A SET PIECE (Harry, 20 Oct 2026: "some set pieces
 * and penalties could have the foul").
 *
 * Only with Settings → "Full highlights rebuild: On" (leadInGen.ts's
 * careerBuildUp asks this file only then). Off: the game exactly as before.
 *
 * Before some free kicks and penalties the match plays the foul that won it,
 * 4–6 seconds, then the set piece is yours exactly as its drawing places it:
 *
 *   1. You drive at goal with the ball (a carry, 1.4–2.2 s).
 *   2. A defender comes across from goal-side and brings you down where the
 *      ball is: the free-kick spot, or a spot in the box for a penalty.
 *      The referee's whistle.
 *   3. A moment's pause, then everyone walks to his place: the wall lines up,
 *      the box empties for a penalty, the keeper goes back to his line, you
 *      put the ball on the spot (a penalty) and step back for your run-up.
 *
 * Everyone ends EXACTLY where the drawing has him, the ball on the drawing's
 * ball. It is played by the real match's lead-in replay (CanvasMatch's
 * `leadIn` prop): positions only, nothing stepped, a tap skips it. Corners
 * never get one (a corner is not won by a foul), nor does a set piece from a
 * foul you have just seen on screen (the match passes those as not fresh).
 *
 * Pure: no React, no canvas. tests/star/fhr.mts measures it; the sheet
 * (scripts/fhr/buildup-sheet.mts) draws them to check by eye.
 */
import type { Scenario, ScenarioKind, Vec2 } from "../canvasEngine";
import { leadInEntities, ballAlong, type LeadIn, type LeadMoment, type LeadBallKey } from "../leadIn";
import { PITCH_W, CX, HALF_LEN, GOAL_W, BOX_DEPTH, BOX_L, BOX_R, PEN_SPOT_Y } from "../pitch";
import { chanceSeed, maxSpeed, separate, calmBursts, FHR_TOP_SPEED } from "./buildUp";

// ─────────────────────────────────────────────────────────────────────────
//  THE DIALS
// ─────────────────────────────────────────────────────────────────────────

/** Share of fresh free kicks and penalties that show the foul first. */
export const FOUL_SHARE = 0.5;
/** The set pieces a foul can win. */
export const FOUL_KINDS: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["free_kick", "penalty"]);
/** The pause after the whistle before anyone walks to his place (s). */
export const FOUL_PAUSE_S = 0.7;
/** The walk to the places: never faster than this (m/s), never shorter than FOUL_SETTLE_MIN_S. */
export const FOUL_WALK = 4.2;
export const FOUL_SETTLE_MIN_S = 1.5;
/** Two men never closer than this before the last second (m), but the two in the foul. */
export const FOUL_SPACE_M = 1.0;
/** Tries with the next seed before giving up (then the set piece plays as before). */
const FOUL_TRIES = 16;

const HZ = 15;
const LEN = 2 * HALF_LEN;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Vec2, b: Vec2, f: number): Vec2 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const smooth = (f: number) => { const c = clamp(f, 0, 1); return c * c * (3 - 2 * c); };
const norm = (v: Vec2): Vec2 => { const n = Math.hypot(v.x, v.y) || 1; return { x: v.x / n, y: v.y / n }; };
const inPitch = (p: Vec2, m = 1.5): Vec2 => ({ x: clamp(p.x, m, PITCH_W - m), y: clamp(p.y, m, LEN - m) });

function rngOf(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whether this set piece shows the foul first (when the switch is On). Decided by the chance's own seed. */
export function fhrWantsFoul(sc: Scenario, moment: Pick<LeadMoment, "fresh" | "seed" | "opening">): boolean {
  if (!moment.fresh || !FOUL_KINDS.has(sc.kind)) return false;
  return rngOf((chanceSeed(sc, moment.seed) ^ 0xf0a1) >>> 0)() < FOUL_SHARE;
}

/** A finished foul build-up. */
export interface FhrFoulBuildUp extends LeadIn {
  /** When the foul is, where, and who made it. */
  foul: { at: number; spot: Vec2; by: string };
  /** Everyone's stored path (HZ a second), for the checks and the sheet. */
  people: { key: string; side: "you" | "mate" | "opp" | "keeper"; role: string; vmax: number; path: Vec2[] }[];
  problems: string[];
  tries: number;
  signature: string;
}

/** Keys for a man's path: a point at each time, eased between. */
interface Key { t: number; p: Vec2 }
function along(keys: Key[], t: number): Vec2 {
  if (t <= keys[0].t) return { ...keys[0].p };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) return lerp(a.p, b.p, b.t > a.t ? smooth((t - a.t) / (b.t - a.t)) : 1);
  }
  return { ...keys[keys.length - 1].p };
}

/**
 * THE FOUL BUILD-UP for a free kick or penalty `sc` (every man where the
 * drawing put him, you stood back for your run-up). Null when none of its
 * tries passes the checks: the set piece then plays exactly as before.
 */
export function fhrFoulBuildUpFor(sc: Scenario, moment: LeadMoment, o: { keepBest?: boolean } = {}): FhrFoulBuildUp | null {
  if (!FOUL_KINDS.has(sc.kind)) return null;
  const base = chanceSeed(sc, moment.seed) ^ 0x5f0c1;
  let best: FhrFoulBuildUp | null = null;
  for (let k = 0; k < FOUL_TRIES; k++) {
    const b = foulAttempt(sc, (base + k * 0x632be5ab) >>> 0, k);
    if (b && !b.problems.length) return b;
    if (b && (!best || b.problems.length < best.problems.length)) best = b;
  }
  // (keepBest: the sheet and the tests, to see what was wrong. The game never plays a failed one.)
  return o.keepBest ? best : null;
}

function foulAttempt(sc: Scenario, seed: number, tryNo: number): FhrFoulBuildUp | null {
  const r = rngOf(seed);
  const pen = sc.kind === "penalty";
  const onPitch = (p: Vec2) => p.x > -1 && p.x < PITCH_W + 1 && p.y > -1 && p.y < LEN + 1;
  const ents = leadInEntities(sc).filter((e) => onPitch(e.get()));
  const ends = new Map(ents.map((e) => [e.key, e.get()]));
  const youEnd = ends.get("you")!;
  const keeperEnd = ends.get("keeper")!;
  const B: Vec2 = { x: sc.ball.x, y: sc.ball.y };
  const goal: Vec2 = { x: CX, y: 0 };

  // ── Where the foul is ──
  // A free kick: on its own spot. A penalty: somewhere in the box, then the ball goes to the spot.
  const F: Vec2 = pen
    ? { x: clamp(CX + (r() - 0.5) * 24, BOX_L + 3, BOX_R - 3), y: 5.5 + r() * (BOX_DEPTH - 8) }
    : { ...B };
  // You drove at goal from further out, with a little angle on it.
  const toGoal = norm({ x: goal.x - F.x, y: goal.y - F.y });
  const side = r() < 0.5 ? -1 : 1;
  const perp = { x: -toGoal.y * side, y: toGoal.x * side };
  const carryLen = 7 + r() * 4;
  const C0 = inPitch({ x: F.x - toGoal.x * carryLen + perp.x * carryLen * 0.25, y: F.y - toGoal.y * carryLen + perp.y * carryLen * 0.25 }, 3);
  const carryDir = norm({ x: F.x - C0.x, y: F.y - C0.y });
  const HOLD = 0.35;
  const carryS = dist(C0, F) / (5.2 + r() * 1.2);
  const tF = HOLD + carryS;

  // ── Who brings you down: the defender whose place is nearest the foul ──
  const defKeys = ents.filter((e) => e.side === "opp").map((e) => e.key);
  if (!defKeys.length) return null;
  const fouler = defKeys.reduce((a, b) => (dist(ends.get(a)!, F) <= dist(ends.get(b)!, F) ? a : b));
  // He comes across from goal-side of you, onto the ball.
  const inFrom = norm({ x: toGoal.x - perp.x * 0.9, y: toGoal.y - perp.y * 0.9 });
  const atFoul = { x: F.x + inFrom.x * 0.8, y: F.y + inFrom.y * 0.8 };

  // ── Where everyone is when it happens ──
  // A penalty: the box still full (they walk out after). A free kick: no wall
  // yet, everyone in his own spot near where he will stand.
  const wallKeys = pen ? [] : defKeys.filter((k) => {
    const p = ends.get(k)!;
    const d = dist(p, B);
    const lane = norm({ x: goal.x - B.x, y: goal.y - B.y });
    const t = (p.x - B.x) * lane.x + (p.y - B.y) * lane.y;
    const off = Math.abs((p.x - B.x) * lane.y - (p.y - B.y) * lane.x);
    return d > 7 && d < 11.5 && t > 6 && off < 4;
  });
  const wallOrder = [...wallKeys].sort((a, b) => ends.get(a)!.x - ends.get(b)!.x);
  const atFoulOf = new Map<string, Vec2>();
  for (const e of ents) {
    const k = e.key, end = ends.get(k)!;
    if (k === "you") continue;
    if (k === fouler) { atFoulOf.set(k, atFoul); continue; }
    if (k === "keeper") {
      // Off his line a little, toward the ball.
      const toward = norm({ x: F.x - end.x, y: F.y - end.y });
      atFoulOf.set(k, inPitch({ x: end.x + toward.x * (0.8 + r()), y: Math.max(0.6, end.y + toward.y * (0.8 + r())) }, 0.5));
      continue;
    }
    const wi = wallOrder.indexOf(k);
    if (wi >= 0) {
      // The wall is not up yet: its men spread across, 2 m and more apart.
      const mid = (wallOrder.length - 1) / 2;
      const cx = wallOrder.reduce((s, w) => s + ends.get(w)!.x, 0) / wallOrder.length;
      atFoulOf.set(k, inPitch({ x: cx + (wi - mid) * 2.1 + (r() - 0.5) * 0.4, y: end.y + (r() - 0.4) * 2 }));
      continue;
    }
    if (pen) {
      // In the box, between his place and the foul, never on top of it.
      const f = 0.35 + r() * 0.25;
      let p = lerp(end, F, f);
      p = { x: p.x + (r() - 0.5) * 3, y: p.y + (r() - 0.5) * 3 };
      if (dist(p, F) < 3) { const a = norm({ x: p.x - F.x, y: p.y - F.y }); p = { x: F.x + a.x * 3, y: F.y + a.y * 3 }; }
      atFoulOf.set(k, inPitch(p));
    } else {
      const a = r() * Math.PI * 2, d = 1.2 + r() * 2.4;
      atFoulOf.set(k, inPitch({ x: end.x + Math.cos(a) * d, y: end.y + Math.sin(a) * d }));
    }
  }

  // ── The times ──
  let maxWalk = dist(F, youEnd) + (pen ? dist(F, B) : 0);
  atFoulOf.forEach((p, k) => { maxWalk = Math.max(maxWalk, dist(p, ends.get(k)!)); });
  const settleS = clamp(maxWalk / FOUL_WALK, FOUL_SETTLE_MIN_S, 3.4);
  const tS = tF + FOUL_PAUSE_S; // the walk to the places starts
  const durS = tS + settleS;

  // ── The ball ──
  const ballStart = { x: C0.x + carryDir.x * 0.6, y: C0.y + carryDir.y * 0.6 };
  const ballKeys: LeadBallKey[] = [{ t: 0, p: ballStart }, { t: HOLD, p: ballStart }, { t: tF, p: { ...F } }];
  let youKeys: Key[];
  if (pen) {
    // It runs loose a metre, then you fetch it and put it on the spot, and step back.
    const loose = inPitch({ x: F.x + carryDir.x * 1.1, y: F.y + carryDir.y * 1.1 });
    const fetchS = Math.max(0.35, dist(F, loose) / 3);
    const placeS = Math.max(0.5, dist(loose, B) / 3.6);
    const tFetch = tS + fetchS, tPlace = tFetch + placeS;
    const backS = Math.max(0.5, durS - tPlace);
    ballKeys.push({ t: tF + 0.35, p: loose }, { t: tFetch, p: loose }, { t: tPlace, p: { ...B } }, { t: durS, p: { ...B } });
    const behind = (p: Vec2, toward: Vec2) => { const a = norm({ x: toward.x - p.x, y: toward.y - p.y }); return { x: p.x - a.x * 0.6, y: p.y - a.y * 0.6 }; };
    youKeys = [
      { t: 0, p: behind(ballStart, F) }, { t: HOLD, p: behind(ballStart, F) }, { t: tF, p: behind(F, goal) },
      { t: tS, p: behind(F, goal) }, { t: tFetch, p: behind(loose, B) }, { t: tPlace, p: behind(B, goal) },
      { t: tPlace + backS, p: { ...youEnd } },
    ];
  } else {
    ballKeys.push({ t: durS, p: { ...B } });
    const behindF = { x: F.x - carryDir.x * 0.6, y: F.y - carryDir.y * 0.6 };
    youKeys = [
      { t: 0, p: { x: ballStart.x - carryDir.x * 0.6, y: ballStart.y - carryDir.y * 0.6 } },
      { t: HOLD, p: { x: ballStart.x - carryDir.x * 0.6, y: ballStart.y - carryDir.y * 0.6 } },
      { t: tF, p: behindF }, { t: tS, p: behindF }, { t: durS, p: { ...youEnd } },
    ];
  }
  // During the carry you are on the ball: your path follows it, a step behind.
  const youAt = (t: number): Vec2 => {
    if (t > HOLD && t < tF) { const b = ballAlong(ballKeys, t); return { x: b.x - carryDir.x * 0.6, y: b.y - carryDir.y * 0.6 }; }
    return along(youKeys, t);
  };
  const ballAt = (t: number) => (t >= durS ? { x: B.x, y: B.y, z: 0 } : ballAlong(ballKeys, t));

  // ── Everyone's keys: with the play before it, at his spot at the foul, still, then to his place ──
  const keysOf = new Map<string, Key[]>();
  atFoulOf.forEach((pf, k) => {
    const end = ends.get(k)!;
    if (k === fouler) {
      // He tracks you from goal-side, then steps in.
      const run = 4.5 + r() * 2.5;
      const s0 = inPitch({ x: pf.x + inFrom.x * run + carryDir.x * 2, y: pf.y + inFrom.y * run + carryDir.y * 2 });
      const s1 = inPitch({ x: pf.x + inFrom.x * 2.2, y: pf.y + inFrom.y * 2.2 });
      keysOf.set(k, [{ t: 0, p: s0 }, { t: Math.max(HOLD, tF - 0.6), p: s1 }, { t: tF, p: pf }, { t: tS, p: pf }, { t: durS, p: { ...end } }]);
      return;
    }
    // Earlier in the move he was a little further up the pitch, going back with it.
    const p0 = inPitch({ x: pf.x + (r() - 0.5) * 1.5, y: pf.y + (k === "keeper" ? 0.4 : 1 + r() * 2) }, k === "keeper" ? 0.5 : 1.5);
    keysOf.set(k, [{ t: 0, p: p0 }, { t: tF, p: pf }, { t: tS, p: pf }, { t: durS, p: { ...end } }]);
  });

  // ── Sample, then check ──
  const N = Math.ceil(durS * HZ);
  const tOf = (i: number) => Math.min(durS, i / HZ);
  const sideOf = new Map(ents.map((e) => [e.key, e.side]));
  // Held to the ball / to the foul (never moved apart): you while you carry it
  // (and, for a penalty, while you take it to the spot); both of you at the foul.
  const iF0 = Math.round((tF - 0.45) * HZ), iF1 = Math.round(tS * HZ);
  const youHeld = (t: number) => (t >= HOLD && t <= tS) || (pen && t >= tS && t <= durS - 0.6);
  const people = ents.map((e) => {
    const k = e.key;
    const path: Vec2[] = [], pin: number[] = [];
    for (let i = 0; i <= N; i++) {
      const t = tOf(i);
      path.push(k === "you" ? youAt(t) : along(keysOf.get(k)!, t));
      pin.push((k === "you" && youHeld(t)) || (k === fouler && i >= iF0 && i <= iF1) ? 1 : 0);
    }
    path[N] = { ...ends.get(k)! };
    return { key: k, side: sideOf.get(k)!, role: k === fouler ? "FOUL" : k === "keeper" ? "GK" : wallKeys.includes(k) ? "WALL" : sideOf.get(k) === "opp" ? "D" : k === "you" ? "YOU" : "M", vmax: FHR_TOP_SPEED, path, pin };
  });
  // Nobody walks through anybody: eased apart (the wall still closes up at the end, on the drawing).
  separate(people, N, durS);
  for (const p of people) calmBursts(p.path, p.pin, p.vmax, N);
  const problems: string[] = [];
  for (const p of people) {
    const v = maxSpeed(p.path);
    if (v > FHR_TOP_SPEED + 0.05) problems.push(`${p.key} runs ${v.toFixed(1)} m/s`);
    for (const q of p.path) if (q.x < -1 || q.x > PITCH_W + 1 || q.y < -1 || q.y > LEN + 1) { problems.push(`${p.key} leaves the pitch`); break; }
  }
  const stop = N - HZ; // the last second is the drawing's (the wall closes up)
  const late = Math.round((durS - 1.6) * HZ);
  let gap = { d: Infinity, a: "", b: "", i: 0 };
  for (let i = 0; i < stop; i++) for (let a = 0; a < people.length; a++) for (let b = a + 1; b < people.length; b++) {
    const pa = people[a], pb = people[b];
    const foulPair = (pa.key === "you" && pb.key === fouler) || (pb.key === "you" && pa.key === fouler);
    if (foulPair && i >= iF0 && i <= iF1) continue;
    // Two men the drawing stands close together (a wall): theirs to decide as they arrive.
    if (i >= late && dist(pa.path[N], pb.path[N]) < FOUL_SPACE_M + 0.3) continue;
    const d = dist(pa.path[i], pb.path[i]);
    if (d < gap.d) gap = { d, a: pa.key, b: pb.key, i };
  }
  if (gap.d < FOUL_SPACE_M) problems.push(`${gap.a} and ${gap.b} ${gap.d.toFixed(2)} m apart at ${(gap.i / HZ).toFixed(1)} s`);
  // The two in the foul do meet.
  const you = people.find((p) => p.key === "you")!, fl = people.find((p) => p.key === fouler)!;
  const iF = Math.round(tF * HZ);
  if (dist(you.path[iF], fl.path[iF]) > 1.6) problems.push("the foul is not a foul (they don't meet)");
  // Nobody between the keeper and his goal.
  const kp = people.find((p) => p.key === "keeper")!;
  for (const p of people) {
    if (p === kp) continue;
    for (let i = 0; i < N; i++) {
      const q = p.path[i], k = kp.path[i];
      if (q.y < k.y - 0.3 && q.y < 6 && Math.abs(q.x - CX) < GOAL_W / 2 + 3) { problems.push(`${p.key} behind the keeper at ${(i / HZ).toFixed(1)} s`); break; }
    }
  }
  void keeperEnd; void PEN_SPOT_Y;

  const byKey = new Map(people.map((p) => [p.key, p]));
  const posAt = (key: string, t: number): Vec2 | null => {
    const p = byKey.get(key);
    if (!p) return null;
    if (t >= durS) return { ...p.path[N] };
    if (t <= 0) return { ...p.path[0] };
    const f = t * HZ, i = Math.floor(f), g = f - i;
    const a = p.path[Math.min(N, i)], b = p.path[Math.min(N, i + 1)];
    return { x: a.x + (b.x - a.x) * g, y: a.y + (b.y - a.y) * g };
  };
  const call = pen ? "Penalty!" : "Foul! Free kick.";
  return {
    durS, ballAt, posAt,
    skippable: true,
    // The camera frames the carry, then the place where it is set up.
    passStart: [HOLD, tS], passEnd: [tF, durS - 0.1],
    // One smooth camera move (leadIn.ts glideCamera; Harry, 0.108h).
    camera: "glide" as const,
    captionAt: (t) => (t < tF ? "Build-up" : call),
    captionShown: true,
    whistleAt: tF + 0.08,
    foul: { at: tF, spot: { ...F }, by: fouler },
    people, problems, tries: tryNo,
    signature: `${sc.kind}@${Math.round(F.x)},${Math.round(F.y)}<${Math.round(C0.x)},${Math.round(C0.y)}`,
  };
}
