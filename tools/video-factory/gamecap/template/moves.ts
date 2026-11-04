/**
 * GAMECAP MOVES — the build-up and the finish for one clip, as paths.
 *
 * Copied into app/zz-gamecap-tmp/ by tools/video-factory/gamecap/capture.mjs for
 * one capture run, then deleted. Never part of the game.
 *
 * Coordinates in a spec are "attacker's view" metres: [x, y]
 *   x = metres across from the centre of the goal, + = to the attacker's RIGHT
 *       as he faces the goal (that is the side nearer the TV camera),
 *   y = metres out from the goal line.
 * The game's pitch (lib/star/pitch.ts) has the goal at y = 0 and x = CX; the
 * attacker's right is pitch x < CX. A(x, y) below does that conversion.
 *
 * Every path is a pure function of time and the seed: the same spec is the
 * same film.
 */
import { CX, POST_L, POST_R, GOAL_H } from "@/lib/star/pitch";

export interface Pt3 { x: number; y: number; z: number }
export type XY = [number, number];
export type Kind = "header" | "tap_in" | "long_range" | "one_on_one" | "volley" | "penalty" | "free_kick" | "miss" | "save";
export type Outcome = "goal" | "over" | "wide" | "save" | "post";

export interface Recreate {
  /** corner | cross (header); cutback (tap_in); through (one_on_one); lofted | ground (long range, volley). */
  delivery?: string;
  /** Which wing the ball comes from: "left" | "right" (attacker's view). */
  side?: "left" | "right";
  /** The passer's start spot, and where he plays it from. */
  passerStart?: XY;
  passFrom?: XY;
  /** The scorer's start spot, and where he strikes it. */
  scorerStart?: XY;
  scorerSpot?: XY;
  /** header | left | right | volley | curl | chip | ground. Left/right are written down; the figures kick with one leg. */
  finish?: string;
  /** Where in the goal: left | right | centre | near | far (attacker's view; near/far from where the ball came). */
  goalSide?: "left" | "right" | "centre" | "near" | "far";
  height?: "low" | "mid" | "high";
  /** A corner or cross that bends towards goal ("in") or away ("out"). */
  swing?: "in" | "out" | "none";
  /** goal (default) | over | wide | save | post. "miss" kind = over, "save" kind = save. */
  outcome?: Outcome;
  /** For a save: parry (default) or catch. */
  save?: "parry" | "catch";
  /** For kind miss/save: the move it is built on (default one_on_one). */
  base?: Kind;
}

export type Role = { role: "scorer" } | { role: "assister" } | { role: "def"; i: number } | { role: "keeper" } | { role: "mate"; i: number };

export interface Move {
  kind: Kind;
  base: Kind;
  outcome: Outcome;
  roles: Role[];
  paths: ((t: number) => Pt3)[];
  ball: (t: number) => Pt3;
  /** Keeper drawn state per t. */
  keeper: (t: number) => { dive: number; lunge: number; dir: number; kind: "high" | "low" | null };
  /** Body index whose z should lift for a header (the scorer) and when. */
  headerAt: number | null;
  /** Jumps for wall men: [body index, time]. */
  jumps: [number, number][];
  /** [time, kind, roleKey, mode?] — roleKey: scorer | assister | keeper | def0.. | mate0.. */
  events: [number, "pass" | "shot" | "touch" | "save", string, string?][];
  strikeT: number;
  /** When the ball crosses the goal line (goal / over / wide) or is saved. */
  endT: number;
  /** A pass/cross time, for meta. */
  passT: number | null;
  goal: boolean;
}

// ── small helpers ────────────────────────────────────────────────────────────
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rngOf(seed: string): () => number {
  let a = hashStr(seed) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * clamp01(k);
const ease = (k: number) => { const c = clamp01(k); return c * c * (3 - 2 * c); };
const P = (x: number, y: number, z = 0): Pt3 => ({ x, y, z });
/** Attacker's-view metres to pitch metres. */
const A = (x: number, y: number, z = 0): Pt3 => P(CX - x, y, z);
const AX = (xy: XY, z = 0) => A(xy[0], xy[1], z);
const cp = (p: Pt3): Pt3 => ({ x: p.x, y: p.y, z: p.z });
const along = (a: Pt3, b: Pt3, k: number): Pt3 => P(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
const dist = (a: Pt3, b: Pt3) => Math.hypot(a.x - b.x, a.y - b.y);

function path(points: [number, Pt3][]): (t: number) => Pt3 {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  return (t: number) => {
    if (t <= pts[0][0]) return cp(pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const [t1, p1] = pts[i], [t0, p0] = pts[i - 1];
      if (t <= t1) return along(p0, p1, ease((t - t0) / Math.max(1e-6, t1 - t0)));
    }
    return cp(pts[pts.length - 1][1]);
  };
}
/** Ball struck at t0 from a, at b at t1, `lift` m above the line at the middle, bending `bend` m sideways. */
function flight(a: Pt3, b: Pt3, t0: number, t1: number, lift: number, bend = 0, bendDir: [number, number] = [0, 0]): (t: number) => Pt3 {
  return (t: number) => {
    const k = clamp01((t - t0) / Math.max(1e-6, t1 - t0));
    const p = along(a, b, k);
    const h = 4 * k * (1 - k);
    p.z += lift * h;
    p.x += bendDir[0] * bend * h; p.y += bendDir[1] * bend * h;
    return p;
  };
}
/** A unit vector at right angles to a→b on the pitch, turned to point towards the goal line (y smaller). */
function goalward(a: Pt3, b: Pt3): [number, number] {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  let nx = -dy / l, ny = dx / l;
  if (ny > 0) { nx = -nx; ny = -ny; }
  return [nx, ny];
}
/** A ball rolling along the ground after `t0` from p, slowing down. */
function rollOn(p: Pt3, vx: number, vy: number, t0: number): (t: number) => Pt3 {
  return (t: number) => { const s = Math.max(0, t - t0); const k = (1 - Math.exp(-s * 1.4)) / 1.4; return P(p.x + vx * k, p.y + vy * k, Math.max(0.11, p.z * Math.exp(-s * 6))); };
}

// ── the finish: what the shot does once it is struck ────────────────────────
interface Finish {
  ball: (t: number) => Pt3;
  endT: number;
  keeperPath: ((t: number) => Pt3) | null;  // overrides the keeper body after keeperGo
  keeper: (t: number) => { dive: number; lunge: number; dir: number; kind: "high" | "low" | null };
  saveEvent: [number, string] | null;
}

function targetFor(rec: Recreate, rng: () => number, from: Pt3, keeperX: number, kind: Kind): Pt3 {
  const zOf = (h?: string) => h === "low" ? 0.25 + rng() * 0.25 : h === "mid" ? 0.9 + rng() * 0.4 : h === "high" ? 1.75 + rng() * 0.35 : null;
  let x: number;
  const left = CX + 2.4 + rng() * 0.6, right = CX - 2.4 - rng() * 0.6;   // attacker's left is pitch +x
  const nearX = from.x < CX ? Math.min(left, right) : Math.max(left, right);
  const farX = from.x < CX ? Math.max(left, right) : Math.min(left, right);
  switch (rec.goalSide) {
    case "left": x = left; break;
    case "right": x = right; break;
    case "centre": x = CX + (rng() - 0.5) * 1.2; break;
    case "near": x = Math.abs(from.x - CX) < 1.5 ? (keeperX <= CX ? left : right) : nearX; break;
    case "far": x = Math.abs(from.x - CX) < 1.5 ? (keeperX <= CX ? left : right) : farX; break;
    default: x = keeperX <= CX ? left : right;   // away from the keeper
  }
  const defZ = kind === "header" ? 0.6 + rng() * 0.9 : kind === "free_kick" ? 1.8 + rng() * 0.3 : kind === "long_range" ? 1.4 + rng() * 0.6 : kind === "volley" ? 0.8 + rng() * 0.9 : 0.2 + rng() * 0.5;
  return P(x, -0.2, zOf(rec.height) ?? defZ);
}

function makeFinish(o: Outcome, rec: Recreate, rng: () => number, from: Pt3, tS: number, kind: Kind, keeperAt: Pt3, flyS: number, lift: number, bend = 0): Finish {
  const target = targetFor(rec, rng, from, keeperAt.x, kind);
  const still = () => ({ dive: 0, lunge: 0, dir: 0, kind: null as "high" | "low" | null });
  const lineT = (a: Pt3, b: Pt3, t0: number, t1: number) => t0 + (t1 - t0) * clamp01(a.y / Math.max(1e-6, a.y - b.y));
  const bd = goalward(from, target);
  if (o === "goal") {
    const goalT = tS + flyS;
    const f = flight(from, target, tS, goalT, lift, bend, bd);
    const goT = tS + Math.min(0.12, flyS * 0.25);
    const dir = Math.sign(target.x - keeperAt.x) || 1;
    const reach = Math.max(0.6, Math.abs(target.x - keeperAt.x) - 0.7);
    const kz = target.z > 1.1 ? "high" : "low";
    return {
      ball: (t) => t < goalT ? f(t) : P(target.x, Math.max(-1.4, -0.2 - (t - goalT) * 3), Math.max(0.11, target.z - (t - goalT) * 2)),
      endT: goalT,
      keeperPath: null,
      keeper: (t) => { const l = clamp01((t - goT) / 0.35); return t < goT ? still() : { dive: dir * reach * ease(l), lunge: l, dir, kind: kz as "high" | "low" }; },
      saveEvent: [goalT, "beaten"],
    };
  }
  if (o === "over" || o === "wide") {
    const over = o === "over";
    const side = rng() < 0.5 ? -1 : 1;
    const xAt0 = over ? CX + (target.x - CX) * 0.5 + side * rng() * 0.6 : (target.x >= CX ? POST_R + 0.8 + rng() * 2 : POST_L - 0.8 - rng() * 2);
    const zAt0 = over ? GOAL_H + (kind === "header" ? 0.5 + rng() * 0.6 : 1.4 + rng() * 1.6) : 0.3 + rng() * 1.0;
    const at0 = P(xAt0, 0, zAt0);
    // Carry on the same line past the goal line.
    const dx = at0.x - from.x, dy = at0.y - from.y, dz = at0.z - from.z;
    const k1 = 1 + (over ? 7 : 5) / Math.max(4, from.y);   // into the first rows, 5-7 m behind the line
    const beyond = P(from.x + dx * k1, from.y + dy * k1, over ? Math.min(7, from.z + dz * k1 + 0.6) : 0.11);
    const crossT = tS + flyS;
    const f = flight(from, at0, tS, crossT, over ? lift * 0.6 : lift * 0.4, bend, bd);
    const fly2S = flyS * (k1 - 1);
    const g = (t: number) => { const k = clamp01((t - crossT) / fly2S); const p = along(at0, beyond, k); if (!over) p.z = Math.max(0.11, at0.z * (1 - k)); return p; };
    const rest = rollOn(beyond, (beyond.x - at0.x) * 0.15, (beyond.y - at0.y) * 0.15, crossT + fly2S);
    const dir = Math.sign(at0.x - keeperAt.x) || 1;
    const goT = tS + 0.12;
    return {
      ball: (t) => t < crossT ? f(t) : t < crossT + fly2S ? g(t) : (over ? beyond : rest(t)),
      endT: crossT,
      keeperPath: null,
      // He shapes to go and gets nowhere near it.
      keeper: () => { void dir; void goT; return still(); },
      saveEvent: null,
    };
  }
  if (o === "post") {
    const postX = target.x >= CX ? POST_R - 0.05 : POST_L + 0.05;
    const hit = P(postX, 0, Math.min(1.9, Math.max(0.5, target.z)));
    const hitT = tS + flyS;
    const f = flight(from, hit, tS, hitT, lift, bend, bd);
    const out = P(postX + (postX > CX ? -1 : 1) * 4, 7 + rng() * 3, 0.11);
    const back = flight(hit, out, hitT, hitT + 0.55, 0.6);
    const rest = rollOn(out, (out.x - hit.x) * 0.25, (out.y - hit.y) * 0.25, hitT + 0.55);
    const dir = Math.sign(hit.x - keeperAt.x) || 1;
    const goT = tS + 0.12;
    return {
      ball: (t) => t < hitT ? f(t) : t < hitT + 0.55 ? back(t) : rest(t),
      endT: hitT,
      keeperPath: null,
      keeper: (t) => { const l = clamp01((t - goT) / 0.35); return t < goT ? still() : { dive: dir * 1.2 * ease(l), lunge: l, dir, kind: hit.z > 1.1 ? "high" : "low" }; },
      saveEvent: null,
    };
  }
  // A save: the ball is aimed near enough to him that he gets there.
  const dir = Math.sign(target.x - keeperAt.x) || (rng() < 0.5 ? -1 : 1);
  const saveX = keeperAt.x + dir * (1.4 + rng() * 0.8);
  const saveZ = rec.height === "high" ? 1.7 : rec.height === "low" ? 0.3 : target.z > 1.1 ? 1.5 : 0.45;
  const savePt = P(Math.max(POST_L + 0.4, Math.min(POST_R - 0.4, saveX)), Math.max(0.6, keeperAt.y), saveZ);
  const saveT = tS + flyS * Math.max(0.6, Math.min(0.95, (from.y - savePt.y) / Math.max(0.5, from.y)));
  const f = flight(from, savePt, tS, saveT, lift * 0.7, bend, bd);
  const goT = Math.max(tS + 0.05, saveT - 0.4);
  const kz: "high" | "low" = saveZ > 1.1 ? "high" : "low";
  const keeperPath = (t: number) => along(keeperAt, P(savePt.x - dir * 0.6, savePt.y, 0), ease((t - goT) / (saveT - goT)));
  const catchIt = rec.save === "catch";
  const parryTo = P(savePt.x + dir * (5 + rng() * 2), -2.5, 0.4);
  const pf = flight(savePt, parryTo, saveT, saveT + 0.6, 1.2);
  const rest = rollOn(parryTo, dir * 1.5, -1.0, saveT + 0.6);
  return {
    ball: (t) => {
      if (t < saveT) return f(t);
      if (catchIt) { const k = keeperPath(t); return P(k.x + dir * 0.2, k.y + 0.3, Math.max(0.2, saveZ * Math.exp(-(t - saveT) * 2))); }
      return t < saveT + 0.6 ? pf(t) : rest(t);
    },
    endT: saveT,
    keeperPath: (t) => keeperPath(t),
    keeper: (t) => { const l = clamp01((t - goT) / 0.35); return t < goT ? still() : { dive: dir * 1.4 * ease(l), lunge: l, dir, kind: kz }; },
    saveEvent: [saveT, catchIt ? "catch" : "parry"],
  };
}

// ── the moves ────────────────────────────────────────────────────────────────
export interface MoveInput {
  kind: Kind;
  seed: string;
  defenders: number;
  mates: number;
  recreate?: Recreate;
}

export function planMove(inp: MoveInput): Move {
  const rec: Recreate = inp.recreate ?? {};
  const rng = rngOf(inp.seed);
  let kind = inp.kind;
  let outcome: Outcome = rec.outcome ?? "goal";
  if (kind === "miss") { outcome = rec.outcome && rec.outcome !== "goal" ? rec.outcome : "over"; kind = rec.base ?? "one_on_one"; }
  else if (kind === "save") { outcome = "save"; kind = rec.base ?? "one_on_one"; }
  // s = +1: the ball comes from the attacker's right; -1: his left.
  const s = rec.side === "right" ? 1 : rec.side === "left" ? -1 : (rng() < 0.5 ? -1 : 1);
  const nD = Math.max(0, Math.min(7, inp.defenders)), nM = Math.max(0, Math.min(6, inp.mates));
  const roles: Role[] = [{ role: "scorer" }, { role: "assister" }];
  for (let i = 0; i < nD; i++) roles.push({ role: "def", i });
  roles.push({ role: "keeper" });
  for (let i = 0; i < nM; i++) roles.push({ role: "mate", i });
  const iKeeper = 2 + nD;

  let scorer: (t: number) => Pt3, assister: (t: number) => Pt3, keeperBase: (t: number) => Pt3;
  let defs: ((t: number) => Pt3)[] = [], mates: ((t: number) => Pt3)[] = [];
  let pre: (t: number) => Pt3;              // the ball up to the strike
  let strikeT: number, from: Pt3, flyS: number, lift: number, bend = 0;
  let passT = -1;   // -1: no pass
  const events: Move["events"] = [];
  let headerAt: number | null = null;
  const jumps: [number, number][] = [];
  let shotMode = rec.finish === "header" ? "header" : rec.finish === "volley" ? "volley" : rec.finish === "curl" ? "curl" : rec.finish === "chip" ? "chip" : "ground";
  // Spare men stand where they would be; zonal spots near goal for defenders.
  const spareDef = (i: number, base: XY[]): ((t: number) => Pt3) => {
    const b = base[i % base.length]; const j = Math.floor(i / base.length);
    const p = A(b[0] + j * 1.6, b[1] + j * 1.2);
    return path([[0, p], [4, P(p.x + (rng() - 0.5), p.y - 0.6)]]);
  };

  if (kind === "header") {
    const corner = (rec.delivery ?? "corner") === "corner";
    const kickT = corner ? 1.0 : 1.25;
    const ballStart = corner ? A(s * 33.6, 0.6) : A(s * 27.5, 15);
    const passFrom = rec.passFrom ? AX(rec.passFrom) : corner ? ballStart : A(s * 25, 8.5);
    const meet = rec.scorerSpot ? AX(rec.scorerSpot, 2.2) : A(s * (rng() * 2 - 0.8), 6.5 + rng() * 2.5, 2.2);
    meet.z = 2.2;
    const flyCross = Math.max(0.9, Math.min(1.5, dist(passFrom, meet) / 26));
    strikeT = kickT + flyCross;
    const sStart = rec.scorerStart ? AX(rec.scorerStart) : A(-s * 3.5, 15.5);
    scorer = path([[0, sStart], [kickT - 0.1, along(sStart, meet, 0.25)], [strikeT, P(meet.x, meet.y + 0.3)], [strikeT + 2.2, P(meet.x - s * -6, meet.y + 5)]]);
    const aStart = rec.passerStart ? AX(rec.passerStart) : corner ? A(s * 31.0, 3.0) : A(s * 27, 17);
    assister = corner
      ? path([[0, aStart], [kickT - 0.45, aStart], [kickT, P(passFrom.x + (passFrom.x < CX ? 0.35 : -0.35), passFrom.y + 0.5)], [kickT + 2.5, P(passFrom.x + (passFrom.x < CX ? 3 : -3), passFrom.y + 3)]])
      : path([[0, aStart], [kickT, P(passFrom.x, passFrom.y + 0.6)], [kickT + 2.5, P(passFrom.x + s * 1.5, passFrom.y - 2)]]);
    const swing = rec.swing ?? (corner ? "in" : "none");
    const crossBend = swing === "none" ? 0 : 2.6;
    const bdir = goalward(passFrom, meet);
    const bendDir: [number, number] = swing === "out" ? [-bdir[0], -bdir[1]] : bdir;
    const cross = flight(passFrom, meet, kickT, strikeT, corner ? 4.2 : 3.2, crossBend, bendDir);
    pre = (t) => t < kickT ? (corner ? cp(ballStart) : along(ballStart, P(passFrom.x, passFrom.y, 0.11), ease(t / kickT))) : cross(t);
    passT = kickT;
    events.push([kickT, "pass", "assister"]);
    from = cp(meet); flyS = Math.max(0.3, dist(meet, A(0, 0)) / 22); lift = 0;
    shotMode = "header";
    headerAt = strikeT;
    // The marker, a step behind the scorer all the way.
    const zonal: XY[] = [[s * 3.0, 2.2], [-s * 1.5, 5.0], [0.5 * s, 11], [-s * 5, 8.5], [s * 6, 6.5], [-s * 8, 12], [s * 9, 13]];
    defs = Array.from({ length: nD }, (_, i) => {
      // He tracks the scorer a step behind, and stops once the ball has gone.
      if (i === 0) return (t: number) => { const u = Math.min(t, strikeT + 0.2); const p = scorer(Math.max(0, u - 0.32)); const q = scorer(u); return P(p.x + (q.x < CX ? -0.5 : 0.5), p.y + 0.9, 0); };
      if (i === 1 && corner) { const p = A(s * 4.3, 1.6); return path([[0, p], [4, p]]); }   // near post, just outside it
      return spareDef(i - 1, zonal);
    });
    const mateSpots: XY[] = [[s * 0.8, 4.4], [-s * 4.5, 11.5], [0, 17.5], [s * 7, 10], [-s * 8, 7], [s * 3, 20]];
    mates = Array.from({ length: nM }, (_, i) => { const b = A(mateSpots[i % mateSpots.length][0], mateSpots[i % mateSpots.length][1]); return path([[0, b], [kickT, P(b.x - s * 0.8, b.y - 1.2)], [strikeT + 1, P(b.x - s * 1.2, b.y - 1.8)]]); });
    const kh = A(s * 0.6, 1.3);
    keeperBase = path([[0, kh], [kickT, kh], [strikeT - 0.1, P(lerp(kh.x, meet.x, 0.35), 1.3)]]);
  } else if (kind === "tap_in") {
    passT = 1.35; strikeT = 1.92;
    const byline = rec.passFrom ? AX(rec.passFrom) : A(s * 14, 2.5);
    const meet = rec.scorerSpot ? AX(rec.scorerSpot) : A(-s * (1 + rng() * 1.5) + s * 1.5, 5.5 + rng() * 2);
    const aStart = rec.passerStart ? AX(rec.passerStart) : A(s * 17.5, 11.5);
    const sStart = rec.scorerStart ? AX(rec.scorerStart) : P(meet.x - (CX - meet.x > 0 ? 0 : 0) + s * 2, meet.y + 9);
    scorer = path([[0, sStart], [strikeT, P(meet.x, meet.y + 0.6)], [strikeT + 2.2, P(meet.x + s * 7, meet.y + 5)]]);
    assister = path([[0, aStart], [passT, P(byline.x, byline.y + 0.5)], [passT + 2.5, P(byline.x, byline.y + 2.5)]]);
    const cut = flight(byline, meet, passT, strikeT, 0);
    pre = (t) => t < passT ? along(P(aStart.x, aStart.y - 0.6, 0.11), byline, t / passT) : cut(t);
    events.push([0.4, "touch", "assister"], [passT, "pass", "assister"]);
    from = cp(meet); flyS = Math.max(0.2, dist(meet, A(0, 0)) / 26); lift = 0.1;
    const zonal: XY[] = [[s * 12.5, 4.5], [s * 0.5, 7.5], [-s * 3, 6], [s * 5, 11], [-s * 7, 9]];
    defs = Array.from({ length: nD }, (_, i) => {
      if (i === 0) return path([[0, A(s * 13.5, 8)], [passT, A(s * 13, 3.8)], [3.5, A(s * 12.5, 3.5)]]);
      if (i === 1) return (t: number) => { const p = scorer(Math.max(0, Math.min(t, strikeT + 0.2) - 0.35)); return P(p.x - s * -1.3, p.y + 1.6, 0); };
      return spareDef(i - 2, zonal);
    });
    mates = Array.from({ length: nM }, (_, i) => { const b = A(-s * (6 + i * 3), 12 + i * 3); return path([[0, b], [3, P(b.x, b.y - 3)]]); });
    const kh = A(s * 0.2, 1.2);
    keeperBase = path([[0, kh], [passT, A(s * 2.4, 0.9)], [strikeT, A(s * 1.9, 1.5)]]);
  } else if (kind === "long_range") {
    passT = 0.75; strikeT = 1.95;
    const recv = rec.scorerStart ? AX(rec.scorerStart) : A(-s * (6 + rng() * 4), 26 + rng() * 3);
    const shotFrom = rec.scorerSpot ? AX(rec.scorerSpot) : P(recv.x + s * -1.5 * -1, recv.y - 2);
    const pf = rec.passFrom ? AX(rec.passFrom) : A(s * 13, 33);
    scorer = path([[0, P(recv.x, recv.y + 3)], [passT + 0.4, recv], [strikeT, P(shotFrom.x, shotFrom.y + 0.6)], [strikeT + 2.6, P(shotFrom.x + s * 5, shotFrom.y + 2)]]);
    assister = path([[0, rec.passerStart ? AX(rec.passerStart) : P(pf.x, pf.y + 1)], [passT, P(pf.x, pf.y + 0.6)], [3.5, P(pf.x, pf.y - 3)]]);
    const pass = flight(P(pf.x, pf.y, 0.11), recv, passT, passT + 0.5, rec.delivery === "lofted" ? 2 : 0.2);
    pre = (t) => t < passT ? P(pf.x, pf.y, 0.11) : t < passT + 0.5 ? pass(t) : along(recv, shotFrom, (t - passT - 0.5) / (strikeT - passT - 0.5));
    events.push([passT, "pass", "assister"], [passT + 0.5, "touch", "scorer"]);
    from = cp(shotFrom); flyS = Math.max(0.7, dist(shotFrom, A(0, 0)) / 30); lift = 2.0;
    if (shotMode === "ground" && rng() < 0.5) shotMode = "curl";
    if (shotMode === "curl") bend = 1.2;
    defs = Array.from({ length: nD }, (_, i) => {
      if (i === 0) return path([[0, P(recv.x, recv.y - 7)], [strikeT, P(shotFrom.x, shotFrom.y - 3.5)], [3.5, P(shotFrom.x, shotFrom.y - 3)]]);
      return spareDef(i - 1, [[0, 16], [s * 6, 17], [-s * 7, 15], [s * 12, 12], [-s * 12, 13]]);
    });
    mates = Array.from({ length: nM }, (_, i) => { const b = A(s * (4 + i * 5), 18 + i); return path([[0, b], [3, P(b.x, b.y - 2)]]); });
    const kh = A((rng() - 0.5) * 0.6, 1.2);
    keeperBase = path([[0, kh], [strikeT, P(kh.x, 2.2)]]);
  } else if (kind === "volley") {
    passT = 0.9; strikeT = 2.05;
    const meet = rec.scorerSpot ? AX(rec.scorerSpot, 0.7) : A(-s * (1 + rng() * 3), 12 + rng() * 3, 0.7);
    meet.z = 0.7;
    const pf = rec.passFrom ? AX(rec.passFrom) : A(s * 22, 20);
    const aStart = rec.passerStart ? AX(rec.passerStart) : A(s * 24, 24);
    const sStart = rec.scorerStart ? AX(rec.scorerStart) : P(meet.x, meet.y + 7);
    scorer = path([[0, sStart], [strikeT, P(meet.x, meet.y + 0.5)], [strikeT + 2.2, P(meet.x + s * 6, meet.y + 4)]]);
    assister = path([[0, aStart], [passT, P(pf.x, pf.y + 0.6)], [3.5, P(pf.x + s * 1, pf.y - 2)]]);
    const cross = flight(P(pf.x, pf.y, 0.11), meet, passT, strikeT, 5.0);
    pre = (t) => t < passT ? along(P(aStart.x, aStart.y - 0.6, 0.11), P(pf.x, pf.y, 0.11), t / passT) : cross(t);
    events.push([passT, "pass", "assister"]);
    from = cp(meet); flyS = Math.max(0.35, dist(meet, A(0, 0)) / 30); lift = 0.4;
    shotMode = "volley";
    defs = Array.from({ length: nD }, (_, i) => {
      if (i === 0) return (t: number) => { const p = scorer(Math.max(0, Math.min(t, strikeT + 0.2) - 0.4)); return P(p.x + (p.x < CX ? 1 : -1), p.y - 1.4, 0); };
      return spareDef(i - 1, [[s * 3, 6], [-s * 3, 7], [0, 10], [s * 8, 9]]);
    });
    mates = Array.from({ length: nM }, (_, i) => { const b = A(s * (2 + i * 4), 8 + i * 2); return path([[0, b], [3, P(b.x, b.y - 2)]]); });
    const kh = A(0, 1.5);
    keeperBase = path([[0, kh], [strikeT, P(lerp(kh.x, meet.x, 0.25), 2.2)]]);
  } else if (kind === "penalty") {
    strikeT = 1.5;
    const spot = A(0, 11);
    const runFrom = A(s * 2.4, 14.2);
    scorer = path([[0, runFrom], [0.9, runFrom], [strikeT, A(s * 0.4, 11.6)], [strikeT + 2.2, A(s * 5, 15)]]);
    assister = path([[0, A(-s * 8, 19.5)], [3.5, A(-s * 6, 19)]]);
    pre = () => cp(spot);
    from = cp(spot); flyS = 0.45; lift = 0.3;
    defs = Array.from({ length: nD }, (_, i) => spareDef(i, [[s * 6, 19.2], [-3, 20], [4, 20.5], [-7, 19.5], [8, 21]]));
    mates = Array.from({ length: nM }, (_, i) => spareDef(i, [[-s * 4, 20.5], [s * 9, 20], [-10, 21]]));
    keeperBase = path([[0, A(0, 0.6)], [4, A(0, 0.6)]]);
  } else if (kind === "free_kick") {
    strikeT = 1.4;
    const spot = rec.scorerSpot ? AX(rec.scorerSpot) : A(s * (2 + rng() * 6), 22 + rng() * 4);
    spot.z = 0;
    const toGoal = { x: CX - spot.x, y: 0 - spot.y }; const L = Math.hypot(toGoal.x, toGoal.y);
    const ux = toGoal.x / L, uy = toGoal.y / L;
    const wallC = P(spot.x + ux * 9.15, spot.y + uy * 9.15);
    const back = P(spot.x - ux * 3 + uy * 1.2, spot.y - uy * 3 - ux * 1.2);
    scorer = path([[0, back], [0.6, back], [strikeT, P(spot.x - ux * 0.5, spot.y - uy * 0.5)], [strikeT + 2.2, P(spot.x + 3, spot.y - 3)]]);
    const decoy = P(spot.x - uy * 1.4, spot.y + ux * 1.4);
    assister = path([[0, decoy], [strikeT - 0.4, decoy], [3.5, P(decoy.x - 1, decoy.y - 3)]]);
    pre = () => P(spot.x, spot.y, 0.11);
    from = P(spot.x, spot.y, 0.11); flyS = Math.max(0.8, L / 26); lift = 2.6;
    shotMode = rec.finish && rec.finish !== "left" && rec.finish !== "right" ? shotMode : "curl";
    bend = 2.0;
    const nWall = Math.min(nD, 4);
    defs = Array.from({ length: nD }, (_, i) => {
      if (i < nWall) {
        const off = (i - (nWall - 1) / 2) * 0.62 + (ux > 0 ? 0.6 : -0.6);
        const p = P(wallC.x - uy * off, wallC.y + ux * off);
        return path([[0, p], [4, p]]);
      }
      return spareDef(i - nWall, [[s * 4, 7], [-s * 4, 6], [0, 10]]);
    });
    for (let i = 0; i < nWall; i++) jumps.push([2 + i, strikeT]);
    mates = Array.from({ length: nM }, (_, i) => spareDef(i, [[-s * 6, 10], [s * 2, 12], [-s * 2, 14]]));
    // The keeper stands off to the side the wall does not cover.
    const kh = P(CX + (spot.x < CX ? 0.9 : -0.9), 0.8);
    keeperBase = path([[0, kh], [4, kh]]);
    if (!rec.goalSide) rec.goalSide = "far";
    if (!rec.height) rec.height = "high";
  } else {
    // one_on_one: a pass through, then a run in on goal.
    kind = "one_on_one";
    passT = 0.35; strikeT = 3.0;
    const recvT = 1.05;
    const x0 = -s * (2 + rng() * 6);
    const sStart = rec.scorerStart ? AX(rec.scorerStart) : A(x0, 33);
    const runTo = rec.scorerSpot ? AX(rec.scorerSpot) : A(x0 * 0.45, 11.5 + rng() * 2.5);
    const recvAt = P(lerp(sStart.x, runTo.x, 0.18), lerp(sStart.y, runTo.y, 0.18));
    const pf = rec.passFrom ? AX(rec.passFrom) : A(s * 9, 42);
    const aStart = rec.passerStart ? AX(rec.passerStart) : P(pf.x, pf.y + 2);
    const runner = path([[0, sStart], [recvT, recvAt], [strikeT, runTo], [strikeT + 2.2, P(runTo.x + s * 8, runTo.y + 1)]]);
    scorer = runner;
    assister = path([[0, aStart], [passT, P(pf.x, pf.y + 0.6)], [3.5, P(pf.x, pf.y - 8)]]);
    const pass = flight(P(pf.x, pf.y, 0.11), P(recvAt.x, recvAt.y - 0.5, 0.11), passT, recvT, rec.delivery === "lofted" ? 3 : 0.15);
    pre = (t) => {
      if (t < passT) return P(pf.x, pf.y, 0.11);
      if (t < recvT) return pass(t);
      const p = runner(t); const q = runner(Math.min(strikeT, t + 0.1));
      const vx = q.x - p.x, vy = q.y - p.y, l = Math.hypot(vx, vy) || 1;
      const ahead = 0.55 + 0.25 * Math.abs(Math.sin(t * 6));
      return P(p.x + vx / l * ahead, p.y + vy / l * ahead, 0.11);
    };
    events.push([passT, "pass", "assister"], [recvT, "touch", "scorer"], [recvT + 0.8, "touch", "scorer"], [recvT + 1.5, "touch", "scorer"]);
    from = P(runTo.x, runTo.y - 0.6, 0.11); flyS = Math.max(0.35, dist(runTo, A(0, 0)) / 30); lift = 0.3;
    if (rec.finish === "chip") { lift = 2.2; shotMode = "chip"; }
    defs = Array.from({ length: nD }, (_, i) => {
      // Chasing from the other side to the one he peels away to afterwards, a couple of metres short.
      if (i === 0) return path([[0, P(sStart.x - s * 1.5, sStart.y - 1)], [strikeT, P(runTo.x - s * 1.6, runTo.y + 2.8)], [strikeT + 1.2, P(runTo.x - s * 1.8, runTo.y + 2.0)]]);
      if (i === 1) return path([[0, A(s * 1, 27)], [strikeT, P(runTo.x - s * 3.4, runTo.y + 1.2)], [strikeT + 1.2, P(runTo.x - s * 3.6, runTo.y + 0.4)]]);
      return spareDef(i - 2, [[s * 12, 26], [-s * 12, 25], [s * 18, 30]]);
    });
    mates = Array.from({ length: nM }, (_, i) => { const b = A(s * (10 + i * 5), 34 + i * 2); return path([[0, b], [3.5, P(b.x, b.y - 10)]]); });
    const kh = A((rng() - 0.5) * 0.6, 1.2);
    keeperBase = path([[0, kh], [strikeT - 0.45, P(lerp(kh.x, runTo.x, 0.3), 4.0)], [strikeT, P(lerp(kh.x, runTo.x, 0.3), 4.2)]]);
  }

  events.push([strikeT, "shot", "scorer", shotMode]);
  const keeperAt = keeperBase(strikeT);
  const fin = makeFinish(outcome, rec, rng, from, strikeT, kind, keeperAt, flyS, lift, bend);
  if (fin.saveEvent) events.push([fin.saveEvent[0], "save", "keeper", fin.saveEvent[1]]);
  events.sort((a, b) => a[0] - b[0]);
  const keeperPath = fin.keeperPath;
  const keeperFn = keeperPath ? (t: number) => (t <= strikeT ? keeperBase(t) : keeperPath(t)) : keeperBase;
  const paths: ((t: number) => Pt3)[] = [scorer, assister, ...defs, keeperFn, ...mates];
  const ball = (t: number) => t < strikeT ? pre(t) : fin.ball(t);
  void iKeeper;
  return { kind: inp.kind, base: kind, outcome, roles, paths, ball, keeper: fin.keeper, headerAt, jumps, events, strikeT, endT: fin.endT, passT: passT >= 0 ? passT : null, goal: outcome === "goal" };
}
