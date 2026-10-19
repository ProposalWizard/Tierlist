/**
 * PHASE 2 OF THE FULL HIGHLIGHTS REBUILD — a GENERATED 4–8 s build-up before
 * every open-play chance (Harry, 19 Oct 2026: "random build up generates
 * easily … generate different build-ups every time … every open-play chance
 * gets a build-up, show all of them for now; never penalties or free kicks").
 *
 * Only with Settings → "Full highlights rebuild: On (test)" (careerBuildUp in
 * leadInGen.ts asks this file only when fhrOn()). Off: today's game exactly.
 *
 * How one is made (all seeded by the chance itself, so the same chance always
 * gets the same build-up and two chances never share one):
 *
 *   1. HOW LONG AND HOW FAST. The length is drawn from how long real attacks
 *      that end in a shot last, and the forward speed from how fast they move
 *      (patterns.json `attack`, Wyscout, 1,941 matches), cut to 4–8 s. A break
 *      (the radar's "transition") is shorter and quicker than settled play.
 *   2. THE BALL'S ROUTE, worked back from the chance's own ball. The last one
 *      or two touches come from the real sequences that most often lead to a
 *      shot (or a cross) from that part of the pitch (`chains`, the 500 most
 *      common). Before that, each earlier touch is drawn from where real
 *      passes and carries INTO that zone come from (`moves`, zone-to-zone
 *      tables, by the team's tier), leaning the way the radar says the move
 *      goes (its lane) and back up the pitch as far as the speed asks for.
 *   3. EVERYONE ELSE, from the real team shape. Each man in the chance is
 *      matched to a role (LB, CB, DM … ST) and follows where that role stands
 *      for wherever the ball is (`roles`, tracking of 27 matches), in or out
 *      of possession, plus his own small offset, which grows into exactly his
 *      place in the chance by the end. The man nearest the ball when the move
 *      starts presses it from a real pressing distance (`press`).
 *   4. WHO PLAYS IT. Each touch is played by one of the chance's own
 *      team-mates when he can get there and back in time (a better passer is
 *      picked for a pass, a better dribbler for a carry), sometimes by you (a
 *      one-two), and otherwise by a team-mate who is only in the build-up,
 *      played from out of the chance's frame. The last touch is always yours.
 *   5. CHECKED, then retried with the next seed if anything is wrong: nobody
 *      faster than a man can run (his role's top speed, his pace), nobody
 *      running through anybody (they are eased apart), nobody between the
 *      keeper and his goal, the man on the ball always at it, and nobody who
 *      is only in the build-up still inside the chance's frame at the end.
 *
 * Everyone ends EXACTLY where the drawing has him and the ball on the
 * drawing's ball, so the playable moment is unchanged. Played by the real
 * match's lead-in replay (CanvasMatch's `leadIn` prop): nothing is stepped,
 * no physics, no new loop.
 *
 * Pure: no React, no canvas. tests/star/fhr.mts measures it;
 * scripts/fhr/buildup-sheet.mts draws 48 of them to check by eye.
 */
import type { Scenario, ScenarioKind, Vec2, Viewport, Identity } from "../canvasEngine";
import { leadInEntities, ballAlong, LEAD_MAX_RUN, type LeadIn, type LeadMoment, type LeadBallKey } from "../leadIn";
import { PITCH_W, CX, HALF_LEN, GOAL_W } from "../pitch";
import PJ from "./patterns.json";

interface Patterns {
  xEdges: number[]; yEdges: number[];
  moves: Record<string, { pass: number[][]; carry: number[][]; passLen: number[][] }>;
  chains: { acts: [string, number][]; end: number; endType: string; n: number }[];
  attack: Record<string, { seconds: number[]; speed: number[]; counterShare: number }>;
  roles: { in: Record<string, number[][]>; out: Record<string, number[][]> };
  speeds: Record<string, [number, number]>;
  press: number[][];
  credit: string[];
}
const P = PJ as unknown as Patterns;
/** The credit lines the data asks for (data/opendata/LICENCES.md). */
export const FHR_DATA_CREDIT: readonly string[] = P.credit;

// ─────────────────────────────────────────────────────────────────────────
//  The numbers
// ─────────────────────────────────────────────────────────────────────────

/** The shortest and longest build-up, seconds. */
export const FHR_MIN_S = 4;
export const FHR_MAX_S = 8;
/** A break is shorter: its longest, seconds. */
export const FHR_BREAK_MAX_S = 6.5;
/** After the last touch reaches you: the moment before the chance is yours, seconds. */
export const FHR_TAIL_S = 0.25;
/** Nobody runs faster than this (m/s), whatever his pace. */
export const FHR_TOP_SPEED = LEAD_MAX_RUN;
/** Two men never closer than this while the build-up plays (m): they are eased apart. */
export const FHR_SPACE_M = 1.6;
/** The checks call two men "through each other" below this (m). */
export const FHR_OVERLAP_M = 1.0;
/** Tries with the next seed before the best one is kept. */
export const FHR_TRIES = 24;
/** How often each man's path is stored, per second. */
const HZ = 15;

/** Set pieces never get a build-up. */
const SET_PIECES: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["penalty", "free_kick", "corner"]);

/** Whether a chance gets a generated build-up (when the switch is On). Every fresh open-play chance does. */
export function fhrWantsBuildUp(kind: ScenarioKind, moment: Pick<LeadMoment, "fresh" | "pattern">): boolean {
  return !!moment.fresh && !SET_PIECES.has(kind) && moment.pattern !== "set_piece";
}

// ─────────────────────────────────────────────────────────────────────────
//  The pitch and the data's frame
// ─────────────────────────────────────────────────────────────────────────

const LEN = 2 * HALF_LEN;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Vec2, b: Vec2, f: number): Vec2 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const smooth = (f: number) => { const c = clamp(f, 0, 1); return c * c * (3 - 2 * c); };

/** A point of ours in the data's frame (x 0..100 own goal → their goal, y 0..100 left → right). */
const toData = (p: Vec2) => ({ X: (LEN - p.y) / 1.05, Y: p.x / 0.68 });
/** The data's frame (attacking) back to the pitch. */
const fromData = (X: number, Y: number): Vec2 => ({ x: Y * 0.68, y: LEN - X * 1.05 });
/** The defending team's frame back to the pitch (their own goal is our y = 0). */
const fromDataDef = (X: number, Y: number): Vec2 => ({ x: PITCH_W - Y * 0.68, y: X * 1.05 });

const XE = P.xEdges, YE = P.yEdges;
const binOf = (v: number, edges: number[]) => { for (let i = 1; i < edges.length - 1; i++) if (v < edges[i]) return i - 1; return edges.length - 2; };
/** The coarse zone (0..29) a pitch point is in, our frame. */
export function zoneOf(p: Vec2): number { const d = toData(p); return binOf(d.X, XE) * 5 + binOf(d.Y, YE); }
const mirrorZone = (z: number) => Math.floor(z / 5) * 5 + (4 - (z % 5));
/** A zone's box on the pitch. */
function zoneBox(z: number) {
  const ix = Math.floor(z / 5), iy = z % 5;
  const a = fromData(XE[ix], YE[iy]), b = fromData(XE[ix + 1], YE[iy + 1]);
  return { x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x), y1: Math.min(a.y, b.y), y2: Math.max(a.y, b.y) };
}
const zoneCentre = (z: number): Vec2 => { const b = zoneBox(z); return { x: (b.x1 + b.x2) / 2, y: (b.y1 + b.y2) / 2 }; };
const inPitch = (p: Vec2, m = 2): Vec2 => ({ x: clamp(p.x, m, PITCH_W - m), y: clamp(p.y, m + 1, LEN - m) });

// Zone centres (data units) for the role spots, which are kept per zone.
const XC = XE.slice(0, -1).map((e, i) => (e + XE[i + 1]) / 2);
const YC = YE.slice(0, -1).map((e, i) => (e + YE[i + 1]) / 2);
type RoleTable = Record<string, number[][]>;
const ROLES = P.roles as { in: RoleTable; out: RoleTable };
/** A role's average spot (and spread) for a ball at (X, Y), both in the team's own frame: blended between zone centres. */
function roleSpot(phase: "in" | "out", role: string, X: number, Y: number): [number, number, number, number] {
  const tab = ROLES[phase][role] ?? ROLES[phase].CM ?? ROLES[phase].DM;
  const fi = (v: number, c: number[]) => {
    if (v <= c[0]) return [0, 0, 0] as const;
    for (let i = 0; i < c.length - 1; i++) if (v <= c[i + 1]) return [i, i + 1, (v - c[i]) / (c[i + 1] - c[i])] as const;
    return [c.length - 1, c.length - 1, 0] as const;
  };
  const [x0, x1, fx] = fi(X, XC), [y0, y1, fy] = fi(Y, YC);
  const at = (ix: number, iy: number) => tab[ix * 5 + iy];
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const a = at(x0, y0)[k] * (1 - fy) + at(x0, y1)[k] * fy;
    const b = at(x1, y0)[k] * (1 - fy) + at(x1, y1)[k] * fy;
    out[k] = a * (1 - fx) + b * fx;
  }
  return out;
}

/** One team's ten outfield roles (a 4-3-3; both centre-backs come from the CB spot, split across). */
const SHAPE: { role: string; dy: number }[] = [
  { role: "LB", dy: 0 }, { role: "CB", dy: -9 }, { role: "CB", dy: 9 }, { role: "RB", dy: 0 },
  { role: "DM", dy: 0 }, { role: "CM", dy: 0 }, { role: "AM", dy: 0 },
  { role: "LW", dy: 0 }, { role: "ST", dy: 0 }, { role: "RW", dy: 0 },
];

// ─────────────────────────────────────────────────────────────────────────
//  Sampling from the data
// ─────────────────────────────────────────────────────────────────────────

/** A seeded random stream (mulberry32). */
function rngOf(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rng = () => number;
const gauss = (r: Rng) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function pick<T>(items: T[], w: number[], r: Rng): T {
  let tot = 0;
  for (const x of w) tot += Math.max(0, x);
  if (!(tot > 0)) return items[Math.floor(r() * items.length)];
  let u = r() * tot;
  for (let i = 0; i < items.length; i++) { u -= Math.max(0, w[i]); if (u <= 0) return items[i]; }
  return items[items.length - 1];
}
/** The quantile curve p10 / p25 / p50 / p75 / p90 as a function of u (straight between, flat past the ends). */
const QU = [0.1, 0.25, 0.5, 0.75, 0.9];
function quantile(q: number[], u: number): number {
  if (u <= QU[0]) return q[0];
  for (let i = 0; i < QU.length - 1; i++) if (u <= QU[i + 1]) return q[i] + ((q[i + 1] - q[i]) * (u - QU[i])) / (QU[i + 1] - QU[i]);
  return q[q.length - 1];
}
function cdf(q: number[], v: number): number {
  if (v <= q[0]) return QU[0];
  for (let i = 0; i < q.length - 1; i++) if (v <= q[i + 1]) return QU[i] + ((QU[i + 1] - QU[i]) * (v - q[i])) / Math.max(1e-6, q[i + 1] - q[i]);
  return QU[QU.length - 1];
}
/** A value from the data's distribution, kept between lo and hi (drawn inside that slice of it). */
const drawBetween = (q: number[], lo: number, hi: number, r: Rng) => {
  const a = cdf(q, lo), b = cdf(q, hi);
  return clamp(quantile(q, a + (b - a) * r()), lo, hi);
};

type Tier = "top" | "mid" | "bottom" | "all";
const tierOf = (strength?: number): Tier => (strength === undefined ? "all" : strength >= 78 ? "top" : strength <= 62 ? "bottom" : "mid");
type Moves = { pass: number[][]; carry: number[][]; passLen: number[][] };
const MOVES = P.moves as Record<Tier, Moves>;
type Chain = { acts: [string, number][]; end: number; endType: string; n: number };
const CHAINS = P.chains as Chain[];
const ATTACK = P.attack as Record<Tier, { seconds: number[]; speed: number[]; counterShare: number }>;
const SPEEDS = P.speeds as Record<string, [number, number]>;
const PRESS = P.press as number[][];

/** A chain's action type → how the ball moves. */
const isCarryType = (t: string) => t === "touch" || t === "dribble" || t === "acceleration";

// ─────────────────────────────────────────────────────────────────────────
//  The ball's route
// ─────────────────────────────────────────────────────────────────────────

/** One touch of the ball: a pass or a carry from `from` to `to`. */
export interface FhrAction {
  type: "pass" | "carry";
  from: Vec2;
  to: Vec2;
  /** A pass in the air: its top height (m). */
  h: number;
  /** From the data: "chain" (a real sequence into the chance) or "moves" (the zone tables). */
  src: "chain" | "moves" | "break";
  t0: number;
  t1: number;
}

const passSpeed = (len: number, h: number) => (h > 0 ? clamp(10 + 0.28 * len, 14, 21) : clamp(9 + 0.3 * len, 10, 19));
const CARRY_SPEED = 6.2;
const BREAK_CARRY_SPEED = 6.8;

interface Route { acts: FhrAction[]; durS: number; hold: number }

/** The route of the ball, worked back from the chance's ball `R`. */
function routeFor(sc: Scenario, moment: LeadMoment, r: Rng, frame: Viewport): Route | null {
  const R: Vec2 = { x: sc.ball.x, y: sc.ball.y };
  const brk = moment.pattern === "transition";
  const tier = tierOf(moment.usStrength);
  const mv = MOVES[tier] ?? MOVES.all;
  const at = ATTACK[tier] ?? ATTACK.all;
  // 1. How long, how fast.
  const T = brk ? drawBetween(at.seconds, FHR_MIN_S, FHR_BREAK_MAX_S, r) : drawBetween(at.seconds, 4.6, FHR_MAX_S, r);
  const speed = brk ? quantile(at.speed, 0.5 + 0.42 * r()) : quantile(at.speed, 0.15 + 0.5 * r());
  const room = LEN - 6 - R.y;
  const F = clamp(speed * T, Math.min(10, room), Math.max(10, room));
  const touch = () => (brk ? 0.22 + 0.35 * r() : 0.4 + 0.65 * r());
  const laneX = moment.lane === "left" ? 13.5 : moment.lane === "right" ? 54.5 : moment.lane === "centre" ? CX : null;

  // Backward: the touch that ends at `to`, from a point in zone `z`.
  const back: FhrAction[] = [];
  let cur = R;
  let used = FHR_TAIL_S; // seconds the route takes so far, the tail included
  const pointIn = (z: number, to: Vec2, type: "pass" | "carry", lenWant: number, forwardOnly: boolean): Vec2 | null => {
    const b = zoneBox(z);
    let best: Vec2 | null = null, bs = Infinity;
    for (let k = 0; k < 14; k++) {
      const p = inPitch({ x: b.x1 + (b.x2 - b.x1) * r(), y: b.y1 + (b.y2 - b.y1) * r() }, 3);
      const L = dist(p, to);
      if (type === "pass" && L < 6) continue;
      if (type === "carry" && (L < 3 || L > 18)) continue;
      // A carry goes forward (towards goal); a pass may go square or back a little.
      if (forwardOnly && p.y < to.y + 1.5) continue;
      if (!forwardOnly && p.y < to.y - 9) continue;
      // Never from inside the six-yard box, nor from on the goal line.
      if (p.y < 6 && Math.abs(p.x - CX) < 12) continue;
      const s = Math.abs(L - lenWant) + (laneX !== null ? Math.abs(p.x - laneX) * 0.08 : 0);
      if (s < bs) { bs = s; best = p; }
    }
    return best;
  };
  const durOf = (a: Omit<FhrAction, "t0" | "t1">) => { const L = dist(a.from, a.to); return a.type === "pass" ? L / passSpeed(L, a.h) : L / (brk ? BREAK_CARRY_SPEED : CARRY_SPEED); };
  const push = (a: Omit<FhrAction, "t0" | "t1">) => {
    used += durOf(a) + (back.length ? touch() : 0);
    back.push({ ...a, t0: 0, t1: 0 });
    cur = a.from;
  };
  const lenFor = (z: number, type: "pass" | "carry") => {
    if (type === "carry") return 5 + 9 * r();
    const q = mv.passLen[z];
    return clamp(q[0] + (q[2] - q[0]) * r(), 7, 34);
  };
  const loft = (L: number, t: string) => (t === "high" || t === "head" || t === "cross" || L > 28 ? Math.min(5, 1.2 + L * 0.11) : 0);

  // 2a. The last touches: a real sequence into a shot (or a cross) from here.
  const zR = zoneOf(R);
  const endType = sc.kind === "byline_cross" || sc.kind === "cutback" ? "cross" : (sc.kind === "one_on_one" || sc.kind === "tight_angle" || sc.kind === "long_range" || sc.kind === "volley" || sc.kind === "header") ? "shot" : null;
  if (endType && r() < 0.8) {
    const cands = CHAINS.flatMap((c) => c.endType !== endType ? [] : c.end === zR ? [{ c, m: false }] : mirrorZone(c.end) === zR ? [{ c, m: true }] : []);
    if (cands.length) {
      const { c, m } = pick(cands, cands.map((x) => x.c.n), r);
      for (let i = c.acts.length - 1; i >= 0; i--) {
        const [ty, z0] = c.acts[i];
        const z = m ? mirrorZone(z0) : z0;
        const type = isCarryType(ty) ? "carry" : "pass";
        // A chain may say the move began where the ball already is: then it is a carry within the zone.
        const p = pointIn(z, cur, type, lenFor(z, type), type === "carry") ?? (type === "pass" ? pointIn(z, cur, "carry", 8, true) : null);
        if (!p) break;
        const realType = dist(p, cur) < 6 ? "carry" : type;
        push({ type: realType, from: p, to: cur, h: realType === "pass" ? loft(dist(p, cur), ty) : 0, src: "chain" });
        if (used > T - 0.5) break;
      }
    }
  }
  // 2b. A break: a long ball from deep, then the touches after it.
  // 2c. Earlier touches from the zone tables until the time is used.
  let guard = 0;
  while (used < T - 0.55 && guard++ < 12) {
    const z = zoneOf(cur);
    const left = T - used;
    const progressWant = Math.max(0, F - (cur.y - R.y));
    // Break: the first touch of the move is a long ball from deep when there is room.
    if (brk && left < 2.4 && progressWant > 12 && back.every((a) => a.src !== "break")) {
      const L = clamp(22 + 14 * r(), 18, 40);
      const fromY = Math.min(LEN - 8, cur.y + L * (0.75 + 0.2 * r()));
      const dx = Math.sqrt(Math.max(0, L * L - (fromY - cur.y) ** 2)) * (r() < 0.5 ? -1 : 1);
      const p = inPitch({ x: cur.x + dx, y: fromY }, 4);
      push({ type: "pass", from: p, to: cur, h: loft(dist(p, cur), "high"), src: "break" });
      break;
    }
    const passIn = mv.pass.reduce((s, row) => s + row[z], 0), carryIn = mv.carry.reduce((s, row) => s + row[z], 0);
    const carryShare = clamp((carryIn / Math.max(1, passIn + carryIn)) * (brk ? 4 : 2.5), 0.08, 0.4);
    const type: "pass" | "carry" = back.length && back[back.length - 1].type === "carry" ? "pass" : r() < carryShare ? "carry" : "pass";
    const M = type === "pass" ? mv.pass : mv.carry;
    // Where touches into zone z come from, leaning back up the pitch as far as the speed asks.
    const stepsLeft = Math.max(1, Math.round(left / 1.5));
    const dyWant = progressWant / stepsLeft;
    const zs: number[] = [], ws: number[] = [];
    for (let i = 0; i < 30; i++) {
      const w0 = M[i][z];
      if (!w0) continue;
      const c = zoneCentre(i);
      const dy = c.y - cur.y;
      let w = w0 * Math.exp(-((dy - dyWant) ** 2) / (2 * 13 * 13));
      if (laneX !== null) w *= Math.exp(-Math.abs(c.x - laneX) / 30);
      zs.push(i); ws.push(w);
    }
    if (!zs.length) break;
    const zi = pick(zs, ws, r);
    const p = pointIn(zi, cur, type, lenFor(zi, type), type === "carry");
    if (!p) continue;
    push({ type, from: p, to: cur, h: type === "pass" ? loft(dist(p, cur), "simple") : 0, src: "moves" });
  }
  if (!back.length) return null;

  // 3. Forward: the times. A pause on the ball first, then each touch in turn.
  const acts = back.reverse();
  let t = 0.3 + 0.3 * r();
  const hold = t;
  acts.forEach((a, k) => {
    if (k > 0) t += touch();
    a.t0 = t;
    t += durOf(a);
    a.t1 = t;
  });
  let durS = t + FHR_TAIL_S;
  // Too long: drop the earliest touches (and shift time back).
  while (durS > FHR_MAX_S && acts.length > 1) {
    const cut = acts[1].t0 - 0.3;
    acts.shift();
    acts.forEach((a) => { a.t0 -= cut; a.t1 -= cut; });
    durS -= cut;
  }
  // Too short: the first pause and the touches are longer (a slower, patient move).
  if (durS < FHR_MIN_S) {
    const need = FHR_MIN_S - durS;
    const slots = acts.length; // the first pause + each touch
    const per = need / slots;
    acts.forEach((a, k) => { const sh = per * (k + 1); a.t0 += sh; a.t1 += sh; });
    durS = FHR_MIN_S;
  }
  if (durS > FHR_MAX_S + 1e-6) return null;
  void frame;
  return { acts, durS, hold };
}

// ─────────────────────────────────────────────────────────────────────────
//  The people
// ─────────────────────────────────────────────────────────────────────────

interface Person {
  key: string;
  side: "you" | "mate" | "opp" | "keeper" | "extra";
  who?: Identity;
  end: Vec2;
  role: string;
  /** His top speed, m/s. */
  vmax: number;
  /** Positions on the HZ grid, index 0 = t 0. */
  path: Vec2[];
  /** 1 = held to the ball (on it, or arriving at it) at that sample: never moved by the easing-apart. */
  pin: number[];
}

/** Who the chance's people are (their stats, where the database has them). */
function identityOf(sc: Scenario, key: string): Identity | undefined {
  const s = sc as unknown as { keeper?: { who?: Identity } };
  if (key === "keeper") return s.keeper?.who;
  if (key.startsWith("def")) return (sc.defenders[Number(key.slice(3))] as { who?: Identity } | undefined)?.who;
  if (key.startsWith("mate")) return sc.teammates[Number(key.slice(4))]?.who;
  if (key === "run") return sc.runner?.who;
  if (key.startsWith("sec")) return sc.secondaryRunners[Number(key.slice(3))]?.who;
  if (key === "follower") return sc.follower?.who;
  return undefined;
}
const stat = (who: Identity | undefined, k: "pace" | "passing" | "dribbling") => who?.[k] ?? who?.overall ?? 65;

/** The role's top speed (data p50), moved by his pace, never past FHR_TOP_SPEED. */
const topSpeedOf = (role: string, who?: Identity) => Math.min(FHR_TOP_SPEED, (SPEEDS[role]?.[0] ?? 8.2) + ((stat(who, "pace") - 65) / 35) * 0.6);

/** A finished generated build-up. */
export interface FhrBuildUp extends LeadIn {
  acts: FhrAction[];
  /** Who plays each touch (person keys; extraN = only in the build-up). */
  owners: string[];
  /** Who plays each touch, one per touch in `acts`. */
  actOwners: string[];
  /** Each person's role in the shape. */
  roles: Record<string, string>;
  /** Everyone's stored path (HZ a second), for the checks and the sheet. */
  people: { key: string; side: Person["side"]; role: string; vmax: number; path: Vec2[] }[];
  /** The checks it passed, or what was wrong with the best try. */
  problems: string[];
  /** Which try (0 = the first seed) it is. */
  tries: number;
  /** A short name for the route: P/C (pass, carry) @ zone, in order — for counting distinct build-ups. */
  signature: string;
  /** The chance's own frame it ends on. */
  frame: Viewport;
}

/** The chance's own seed (CanvasMatch hands every chance of a match the same match seed): mixed with where the chance is. */
export function chanceSeed(sc: Scenario, seed: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  const mix = (v: number) => { h = Math.imul(h ^ Math.round(v * 100), 0x85ebca6b) >>> 0; h = (h ^ (h >>> 13)) >>> 0; };
  mix(sc.ball.x); mix(sc.ball.y); mix(sc.player.x); mix(sc.player.y); mix(sc.keeper.x);
  for (const d of sc.defenders) { mix(d.x); mix(d.y); }
  for (const c of sc.kind) mix(c.charCodeAt(0));
  return h >>> 0;
}

/**
 * THE GENERATED BUILD-UP for a chance `sc` (every man where the drawing put
 * him) at the radar's `moment`. Never null: if no try passes every check, the
 * best try is returned with its problems listed (tests count these).
 */
export function fhrBuildUpFor(sc: Scenario, moment: LeadMoment): FhrBuildUp {
  const base = chanceSeed(sc, moment.seed);
  let best: FhrBuildUp | null = null;
  for (let k = 0; k < FHR_TRIES; k++) {
    const b = attempt(sc, moment, (base + k * 0x632be5ab) >>> 0, k);
    if (!b) continue;
    if (!b.problems.length) return b;
    if (!best || b.problems.length < best.problems.length) best = b;
  }
  if (best) return best;
  // Nothing at all could be made (never seen): a single pass to you from out of the frame.
  return attempt(sc, { ...moment, pattern: "transition" }, base ^ 0x55, FHR_TRIES, true)!;
}

function attempt(sc: Scenario, moment: LeadMoment, seed: number, tryNo: number, force = false): FhrBuildUp | null {
  const r = rngOf(seed);
  const frame = moment.frame ?? sc.viewport;
  const route = routeFor(sc, moment, r, frame);
  if (!route && !force) return null;
  const R: Vec2 = { x: sc.ball.x, y: sc.ball.y };
  const acts: FhrAction[] = route?.acts ?? [{ type: "pass", from: inPitch({ x: R.x, y: R.y + 30 }), to: R, h: 3, src: "break", t0: 0.4, t1: 2 }];
  const durS = route?.durS ?? FHR_MIN_S;
  const N = Math.ceil(durS * HZ);
  const tOf = (i: number) => Math.min(durS, i / HZ);

  // ── The ball ──
  const ballKeys: LeadBallKey[] = [{ t: 0, p: { ...acts[0].from } }];
  for (const a of acts) {
    ballKeys.push({ t: a.t0, p: { ...a.from } });
    ballKeys.push(a.type === "pass" ? { t: a.t1, p: { ...a.to }, pass: { h: a.h } } : { t: a.t1, p: { ...a.to } });
  }
  ballKeys.push({ t: durS, p: { ...R } });
  const ballAt = (t: number) => (t >= durS ? { x: R.x, y: R.y, z: 0 } : ballAlong(ballKeys, t));
  // Where the shape thinks the ball is: it reacts a little behind the ball.
  const lagBall: Vec2[] = [];
  {
    let q: Vec2 = { ...acts[0].from };
    const k = 1 - Math.exp(-1 / HZ / 0.9);
    for (let i = 0; i <= N; i++) { const b = ballAt(tOf(i)); q = { x: q.x + (b.x - q.x) * k, y: q.y + (b.y - q.y) * k }; lagBall.push(q); }
  }

  // ── The people, and their roles in the shape ──
  // (A man parked off the pitch — a removed poacher — is not in it: he stays where the chance has him.)
  const onPitch = (p: Vec2) => p.x > -3 && p.x < PITCH_W + 3 && p.y > -3 && p.y < LEN + 3;
  const ents = leadInEntities(sc).filter((e) => onPitch(e.get()));
  const people: Person[] = ents.map((e) => {
    const who = identityOf(sc, e.key);
    return { key: e.key, side: e.side, who, end: e.get(), role: "", vmax: 8, path: [], pin: [] };
  });
  const endBall = toData(lagBall[N]);
  const shapeSpot = (side: "us" | "them", slot: number, bd: { X: number; Y: number }): Vec2 => {
    const s = SHAPE[slot];
    if (side === "us") { const [mx, my] = roleSpot("in", s.role, bd.X, bd.Y); return fromData(mx, clamp(my + s.dy, 2, 98)); }
    const [mx, my] = roleSpot("out", s.role, 100 - bd.X, 100 - bd.Y);
    return fromDataDef(mx, clamp(my + s.dy, 2, 98));
  };
  const assign = (group: Person[], side: "us" | "them") => {
    const pairs: { i: number; j: number; d: number }[] = [];
    group.forEach((p, i) => SHAPE.forEach((_, j) => pairs.push({ i, j, d: dist(p.end, shapeSpot(side, j, endBall)) })));
    pairs.sort((a, b) => a.d - b.d);
    const usedJ = new Set<number>(), slotOf = new Map<number, number>();
    for (const pr of pairs) { if (slotOf.has(pr.i) || usedJ.has(pr.j)) continue; slotOf.set(pr.i, pr.j); usedJ.add(pr.j); }
    return slotOf;
  };
  const ours = people.filter((p) => p.side === "you" || p.side === "mate");
  const theirs = people.filter((p) => p.side === "opp");
  const keeper = people.find((p) => p.side === "keeper")!;
  const slotOurs = assign(ours, "us"), slotTheirs = assign(theirs, "them");
  // A whole-team push up or drop off (real back lines sit 21–46 m from their own goal, p25–p75).
  const teamShift = { us: gauss(r) * 3.5, them: gauss(r) * 3.5 };

  // Base path: the role's spot for where the ball is (a little behind it), plus
  // his own small offset, which grows (evenly) into exactly his place in the
  // chance. If that is faster than he can run, the whole shape he follows is
  // taken as already part-way toward the chance's ball at the start (as if the
  // team read where the move was going), a quarter more each time — never his
  // own offset dragged back, which would pull a whole line across the pitch.
  const baseOf = (p: Person, spotOf: (b: Vec2) => Vec2, shiftY: number, jitter: Vec2): Vec2[] => {
    const endSpot = spotOf(lagBall[N]);
    const offEnd = { x: p.end.x - endSpot.x, y: p.end.y - endSpot.y };
    const offStart = { x: jitter.x, y: jitter.y + shiftY };
    let path: Vec2[] = [];
    for (let k = 0; k <= 4; k++) {
      const a0 = k / 4;
      const raw: Vec2[] = [];
      for (let i = 0; i <= N; i++) {
        const f = i / N, g = 0.5 * f + 0.5 * smooth(f);
        const s = spotOf(lerp(lagBall[i], lagBall[N], a0 * (1 - f)));
        raw.push({ x: s.x + offStart.x + (offEnd.x - offStart.x) * g, y: s.y + offStart.y + (offEnd.y - offStart.y) * g });
      }
      // Smoothed over ±0.33 s (a man does not twitch with every pass), still ending exactly on his place.
      path = raw.map((_, i) => {
        let sx = 0, sy = 0, w = 0;
        for (let j = Math.max(0, i - 5); j <= Math.min(N, i + 5); j++) { const wj = 6 - Math.abs(j - i); sx += raw[j].x * wj; sy += raw[j].y * wj; w += wj; }
        return { x: sx / w, y: sy / w };
      });
      const fix = { x: p.end.x - path[N].x, y: p.end.y - path[N].y };
      path = path.map((q, i) => {
        const g = (i / N) ** 2;
        const v = { x: q.x + fix.x * g, y: q.y + fix.y * g };
        // On the pitch (the end may be on the goal line: a keeper's is).
        return { x: clamp(v.x, Math.min(0.5, p.end.x), Math.max(PITCH_W - 0.5, p.end.x)), y: clamp(v.y, Math.min(0.5, p.end.y), Math.max(LEN - 0.5, p.end.y)) };
      });
      path[N] = { ...p.end };
      if (maxSpeed(path) <= p.vmax * 0.82) break;
    }
    return path;
  };
  for (const [group, slots, side] of [[ours, slotOurs, "us"], [theirs, slotTheirs, "them"]] as const) {
    group.forEach((p, i) => {
      const slot = slots.get(i);
      p.role = slot === undefined ? "CM" : SHAPE[slot].role;
      p.vmax = topSpeedOf(p.role, p.who);
      const spotOf = (b: Vec2) => (slot === undefined ? p.end : shapeSpot(side, slot, toData(b)));
      const [, , sdx, sdy] = roleSpot(side === "us" ? "in" : "out", p.role, endBall.X, endBall.Y);
      const jit = { x: clamp(gauss(r) * sdy * 0.68 * 0.3, -4, 4), y: clamp(gauss(r) * sdx * 1.05 * 0.3, -4, 4) };
      p.path = baseOf(p, spotOf, side === "us" ? teamShift.us : -teamShift.them, jit);
      p.pin = new Array(N + 1).fill(0);
    });
  }
  keeper.role = "GK";
  keeper.vmax = topSpeedOf("GK", keeper.who);
  keeper.path = baseOf(keeper, (b) => { const bd = toData(b); const [mx, my] = roleSpot("out", "GK", 100 - bd.X, 100 - bd.Y); return fromDataDef(mx, my); }, 0, { x: 0, y: 0 });
  keeper.pin = new Array(N + 1).fill(0);

  // The man nearest the ball as the move starts presses it, from a real distance.
  {
    const b0 = acts[0].from;
    const zDef = zoneOf({ x: PITCH_W - b0.x, y: LEN - b0.y }); // the ball's zone in the defending team's frame
    const q = PRESS[zDef] ?? [3, 5, 8];
    const want = clamp(q[0] + (q[2] - q[0]) * r(), 1.8, 12);
    let near: Person | null = null, nd = Infinity;
    for (const p of theirs) { const d = dist(p.path[0], b0); if (d < nd) { nd = d; near = p; } }
    if (near && nd > want) {
      // Goal-side of the ball, between it and his goal.
      const toGoal = { x: CX - b0.x, y: 0 - b0.y }, n = Math.hypot(toGoal.x, toGoal.y) || 1;
      const spot = inPitch({ x: b0.x + (toGoal.x / n) * want + gauss(r) * 1.2, y: b0.y + (toGoal.y / n) * want });
      const old = near.path;
      // Blend his start onto the press spot, fading over the first 40% of the build-up.
      const fadeN = Math.max(4, Math.round(N * 0.4));
      const trial = old.map((p0, i) => (i >= fadeN ? p0 : lerp(spot, p0, smooth(i / fadeN))));
      if (maxSpeed(trial) <= near.vmax * 0.92) near.path = trial;
    }
  }

  // ── Who plays each touch ──
  // Possession spells: a pass ends one and starts the next; a carry stays with its man.
  interface Spell { first: number; last: number; tIn: number; tOut: number; atIn: Vec2; atOut: Vec2 }
  const spells: Spell[] = [];
  acts.forEach((a, k) => {
    if (k === 0 || acts[k - 1].type === "pass") spells.push({ first: k, last: k, tIn: k === 0 ? 0 : acts[k - 1].t1, tOut: a.t0, atIn: a.from, atOut: a.from });
    const s = spells[spells.length - 1];
    s.last = k;
    if (a.type === "carry") s.atOut = a.to;
    if (a.type === "pass") { s.tOut = a.t0; s.atOut = a.from; }
  });
  // The last spell is yours: you receive the last pass (or carry it in) and keep it.
  const lastAct = acts[acts.length - 1];
  if (lastAct.type === "pass") spells.push({ first: acts.length, last: acts.length, tIn: lastAct.t1, tOut: durS, atIn: R, atOut: R });
  else { const s = spells[spells.length - 1]; s.tOut = durS; s.atOut = R; }
  const youSpell = spells[spells.length - 1];
  const owners: string[] = new Array(spells.length).fill("");
  owners[spells.length - 1] = "you";
  const you = people.find((p) => p.key === "you")!;
  const youOff = { x: you.end.x - R.x, y: you.end.y - R.y };
  // Where a man on the ball stands: just behind it, from where it goes next.
  const ownerSpot = (t: number, next: Vec2 | null): Vec2 => {
    const b = ballAt(t);
    if (!next) return { x: b.x, y: b.y + 0.6 };
    const dx = b.x - next.x, dy = b.y - next.y, n = Math.hypot(dx, dy) || 1;
    return { x: b.x + (dx / n) * 0.65, y: b.y + (dy / n) * 0.65 };
  };
  const nextOf = (s: Spell, t: number): Vec2 | null => {
    // The carry in progress, else the pass he will play.
    for (let k = s.first; k <= Math.min(s.last, acts.length - 1); k++) { const a = acts[k]; if (t <= a.t1) return a.to; }
    return null;
  };
  const inFrame = (p: Vec2, m = 3) => p.x > frame.x1 - m && p.x < frame.x2 + m && p.y > frame.y1 - m && p.y < frame.y2 + m;
  const idx = (t: number) => clamp(Math.round(t * HZ), 0, N);
  /**
   * Where a man on the ball is from sample iA to iB: at the ball, his side of it
   * eased round over ±0.27 s as the ball's next direction changes (a carry, then
   * the pass), so he turns with it instead of jumping round it.
   */
  const heldSpots = (iA: number, iB: number, spotAt: (t: number) => Vec2): Vec2[] => {
    const raw: Vec2[] = [], off: Vec2[] = [];
    for (let i = iA; i <= iB; i++) { const t = tOf(i), b = ballAt(t), s = spotAt(t); raw.push(b); off.push({ x: s.x - b.x, y: s.y - b.y }); }
    const K = 4;
    return raw.map((b, k) => {
      let sx = 0, sy = 0, w = 0;
      for (let j = Math.max(0, k - K); j <= Math.min(off.length - 1, k + K); j++) { const wj = K + 1 - Math.abs(j - k); sx += off[j].x * wj; sy += off[j].y * wj; w += wj; }
      // (Turning right round — a carry, then a pass back — he steps over the ball rather than jumping round it.)
      return { x: b.x + sx / w, y: b.y + sy / w };
    });
  };
  const spotFor = (key: string, s: Spell) => (t: number): Vec2 => {
    const tt = clamp(t, s.tIn, s.tOut);
    if (key === "you" && s === youSpell) {
      // On the ball (behind it as you carry it), easing into the drawing's stance over the last half second.
      const b = ballAt(tt), stance = { x: b.x + youOff.x, y: b.y + youOff.y };
      const k = smooth((tt - (durS - 0.55)) / 0.5);
      return k >= 1 ? stance : lerp(ownerSpot(tt, nextOf(s, tt) ?? (tt < durS - 0.05 ? R : null)), stance, k);
    }
    return ownerSpot(tt, nextOf(s, tt));
  };
  /**
   * Man `p` takes spell `s`: held to the ball from s.tIn to s.tOut, running
   * onto it before (as late as he can at his speed, so it looks like a run)
   * and back onto his own path after (`back`). Null: he can't make it.
   */
  const onSpell = (path: Vec2[], vmax: number, s: Spell, spotAt: (t: number) => Vec2, back: boolean): { path: Vec2[]; pin: number[] } | null => {
    const iA = idx(s.tIn), iB = idx(s.tOut);
    const out = path.slice(), pin: number[] = [];
    const held = heldSpots(iA, iB, spotAt);
    for (let i = iA; i <= iB; i++) { out[i] = held[i - iA]; pin.push(i); }
    const cap = vmax * 0.97;
    const okAround = (lo: number, hi: number) => maxSpeed(out.slice(Math.max(0, lo), Math.min(N, hi) + 1)) <= cap;
    if (iA > 0) {
      const target = out[iA];
      let ok = false;
      for (let W = Math.min(5, iA); ; W = Math.min(iA, W + 2)) {
        for (let i = iA - W; i < iA; i++) out[i] = lerp(path[i], target, smooth((i - (iA - W)) / W));
        if (okAround(iA - W - 4, iA + 4)) { ok = true; break; }
        if (W >= iA) break;
      }
      if (!ok) return null;
    }
    if (back && iB < N) {
      const from = out[iB];
      const room = N - iB;
      let ok = false;
      for (let W = Math.min(5, room); ; W = Math.min(room, W + 2)) {
        for (let i = iB + 1; i <= N; i++) out[i] = i <= iB + W ? lerp(from, path[i], smooth((i - iB) / W)) : path[i];
        if (okAround(iB - 4, iB + W + 4)) { ok = true; break; }
        if (W >= room) break;
      }
      if (!ok) return null;
    }
    return { path: out, pin };
  };
  const put = (p: Person, s: Spell, back: boolean): boolean => {
    const res = onSpell(p.path, p.vmax, s, spotFor(p.key, s), back);
    if (!res) return false;
    p.path = res.path;
    for (const i of res.pin) p.pin[i] = 1;
    p.path[N] = { ...p.end };
    return true;
  };
  /**
   * A team-mate who is only in the build-up plays spell `s`: after his pass he
   * jogs on, and if that leaves him inside the chance's frame he runs on out of
   * it (he must be off the screen when the chance starts: he is not in it).
   * Null: he could not get out in time — then one of the chance's own men must play it.
   */
  const extraPlan = (s: Spell): { after: Vec2 } | null => {
    const pOut = ownerSpot(s.tOut, nextOf(s, s.tOut));
    const nxt = acts[s.last].to;
    const fwd = { x: nxt.x - pOut.x, y: nxt.y - pOut.y }, fn = Math.hypot(fwd.x, fwd.y) || 1;
    const time = Math.max(0, durS - s.tOut - 0.15);
    const jog = Math.min(2.5, 1.2 * time);
    const after = { x: pOut.x + (fwd.x / fn) * jog, y: pOut.y + (fwd.y / fn) * jog };
    if (!inFrame(after, 2)) return { after };
    const exits: Vec2[] = [
      { x: frame.x1 - 3, y: pOut.y }, { x: frame.x2 + 3, y: pOut.y }, { x: pOut.x, y: frame.y2 + 3 },
    ].filter((e) => e.x > 0.5 && e.x < PITCH_W - 0.5 && e.y < LEN - 1);
    let best: Vec2 | null = null;
    for (const e of exits) if (dist(e, pOut) <= 5 * time && (!best || dist(e, pOut) < dist(best, pOut))) best = e;
    return best ? { after: best } : null;
  };
  const extrasAt: { spell: number }[] = [];
  const taken = new Set<string>(["you"]);
  const problems: string[] = [];
  // You run onto the last pass (or are on the ball already for your carry).
  if (!put(you, youSpell, false)) problems.push("you can't get onto the last touch in time");
  for (let j = spells.length - 2; j >= 0; j--) {
    const s = spells[j];
    const carry = acts.slice(s.first, s.last + 1).some((a) => a.type === "carry");
    const passLen = acts[s.last].type === "pass" ? dist(acts[s.last].from, acts[s.last].to) : 0;
    let best: Person | null = null, bestCost = Infinity;
    for (const p of ours) {
      if (taken.has(p.key) && p.key !== "you") continue;
      // You may give it and go (a one-two): only the touch before the one you get back.
      if (p.key === "you" && (j !== spells.length - 3 || r() < 0.4)) continue;
      if (!onSpell(p.path, p.vmax, s, spotFor(p.key, s), true)) continue;
      const skill = carry ? stat(p.who, "dribbling") : passLen > 22 ? stat(p.who, "passing") : 65;
      const cost = dist(p.path[idx(s.tIn)], spotFor(p.key, s)(s.tIn)) - (skill - 65) * 0.08;
      if (cost < bestCost) { bestCost = cost; best = p; }
    }
    const outside = extraPlan(s) !== null;
    // A man of the chance when one is near enough; otherwise one who is only in the build-up, out of the frame.
    if (best && (bestCost < 14 || !outside)) {
      put(best, s, true);
      owners[j] = best.key; taken.add(best.key);
    } else {
      if (!outside) problems.push(`nobody can play touch ${j + 1} inside the chance's frame`);
      owners[j] = `extra${extrasAt.length}`;
      extrasAt.push({ spell: j });
    }
  }

  // ── The men who are only in the build-up ──
  const extras: Person[] = extrasAt.map(({ spell }, n) => {
    const s = spells[spell];
    const pIn = ownerSpot(s.tIn, nextOf(s, s.tIn));
    const pOut = ownerSpot(s.tOut, nextOf(s, s.tOut));
    // Where the next pass goes: he jogs on after it a little, then holds.
    const after = (extraPlan(s) ?? { after: pOut }).after;
    // He comes onto the ball from 6 m further back (as far as he can run in time).
    const from = s.tIn <= 0 ? pIn : (() => { const back = { x: pIn.x + (pIn.x - CX) * 0.05, y: pIn.y + 6 }; const d = dist(back, pIn), m = 5 * s.tIn; return d <= m ? back : lerp(pIn, back, m / d); })();
    const path: Vec2[] = [], pin: number[] = [];
    const iA = idx(s.tIn);
    const held = heldSpots(iA, idx(s.tOut), (t) => ownerSpot(t, nextOf(s, t)));
    for (let i = 0; i <= N; i++) {
      const t = tOf(i);
      if (t < s.tIn) { path.push(lerp(from, pIn, smooth(t / Math.max(0.01, s.tIn)))); pin.push(0); }
      else if (i - iA < held.length && i >= iA) { path.push(held[i - iA]); pin.push(1); }
      else { path.push(lerp(pOut, after, smooth((t - s.tOut) / Math.max(0.3, durS - s.tOut)))); pin.push(0); }
    }
    return { key: `extra${n}`, side: "extra", end: path[N], role: "CM", vmax: 8.5, path, pin };
  });
  const all = [...people, ...extras];

  // ── Ease everybody apart ──
  separate(all, N, durS);
  // …which can leave a short burst too quick: smoothed out where it is (never a held sample, nor the end).
  for (const p of all) calmBursts(p.path, p.pin, p.vmax, N);

  // ── The checks ──
  for (const p of all) {
    const v = maxSpeed(p.path);
    if (v > p.vmax + 0.05) problems.push(`${p.key} runs ${v.toFixed(1)} m/s (top ${p.vmax.toFixed(1)})`);
    for (const q of p.path) if (q.x < -1 || q.x > PITCH_W + 1 || q.y < -1 || q.y > LEN + 1) { problems.push(`${p.key} leaves the pitch`); break; }
  }
  for (const e of extras) if (inFrame(e.end, 1.5)) problems.push(`${e.key} is still in the chance's frame at the end`);
  const overlap = minGap(all, N, durS);
  if (overlap.d < FHR_OVERLAP_M) problems.push(`${overlap.a} and ${overlap.b} ${overlap.d.toFixed(2)} m apart at ${(overlap.i / HZ).toFixed(1)} s`);
  // Nobody between the keeper and his goal (unless the drawing has him there at the end).
  for (const p of all) {
    if (p === keeper) continue;
    const endBehind = p.end.y < keeper.end.y - 0.3 && p.end.y < 6 && Math.abs(p.end.x - CX) < GOAL_W / 2 + 3;
    if (endBehind) continue;
    for (let i = 0; i < N - Math.round(0.6 * HZ); i++) {
      const q = p.path[i], k = keeper.path[i];
      if (q.y < k.y - 0.3 && q.y < 6 && Math.abs(q.x - CX) < GOAL_W / 2 + 3) { problems.push(`${p.key} behind the keeper at ${(i / HZ).toFixed(1)} s`); break; }
    }
  }
  // The man on the ball is at it when he plays it, and the receiver when it arrives.
  const posOf = (key: string, t: number) => { const p = all.find((q) => q.key === key)!; return p.path[idx(t)]; };
  acts.forEach((a, k) => {
    const spell = spells.findIndex((s) => k >= s.first && k <= s.last);
    const o = owners[spell];
    // (You ease into the drawing's stance over the last half second: that far from it is allowed then.)
    const reach = (who: string, t: number) => (who === "you" && t > durS - 0.6 ? Math.max(1.6, Math.hypot(youOff.x, youOff.y) + 0.3) : 1.6);
    if (dist(posOf(o, a.t0), a.from) > reach(o, a.t0)) problems.push(`${o} is not on the ball for touch ${k + 1}`);
    if (a.type === "pass") {
      const rcv = owners[spell + 1];
      if (rcv && dist(posOf(rcv, a.t1), a.to) > reach(rcv, a.t1) + 0.2) problems.push(`${rcv} is not there to take touch ${k + 1}`);
    }
  });

  // ── The lead-in the match plays ──
  const byKey = new Map(all.map((p) => [p.key, p]));
  const posAt = (key: string, t: number): Vec2 | null => {
    const p = byKey.get(key);
    if (!p) return null;
    if (t >= durS) return { ...p.path[N] };
    if (t <= 0) return { ...p.path[0] };
    const f = t * HZ, i = Math.floor(f), g = f - i;
    const a = p.path[Math.min(N, i)], b = p.path[Math.min(N, i + 1)];
    return { x: a.x + (b.x - a.x) * g, y: a.y + (b.y - a.y) * g };
  };
  const roles: Record<string, string> = {};
  for (const p of all) roles[p.key] = p.side === "keeper" ? "GK" : p.role;
  const signature = acts.map((a) => `${a.type === "pass" ? "P" : "C"}${zoneOf(a.from)}`).join("-") + `>${zoneOf(R)}`;
  const brk = moment.pattern === "transition";
  return {
    durS, ballAt, posAt,
    extraMates: extras.length,
    passStart: acts.map((a) => a.t0),
    passEnd: acts.map((a) => a.t1),
    skippable: true,
    captionAt: () => (brk ? "On the break…" : "Build-up…"),
    acts, owners, roles,
    actOwners: acts.map((_, k) => owners[spells.findIndex((s) => k >= s.first && k <= s.last)] ?? "you"),
    people: all.map((p) => ({ key: p.key, side: p.side, role: roles[p.key], vmax: p.vmax, path: p.path })),
    problems, tries: tryNo, signature, frame,
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  Paths: speed, spacing
// ─────────────────────────────────────────────────────────────────────────

/** The fastest a stored path moves (m/s), over 0.2 s stretches. */
export function maxSpeed(path: Vec2[]): number {
  const w = 3; // 0.2 s at HZ
  let v = 0;
  for (let i = w; i < path.length; i++) v = Math.max(v, (dist(path[i], path[i - w]) * HZ) / w);
  return v;
}

/** Smooths a path where it is briefly faster than `vmax` (held samples and the two ends stay put). */
function calmBursts(path: Vec2[], pin: number[], vmax: number, N: number) {
  const w = 3;
  for (let it = 0; it < 40; it++) {
    const bad: number[] = [];
    for (let i = w; i <= N; i++) if ((dist(path[i], path[i - w]) * HZ) / w > vmax * 0.985) bad.push(i);
    if (!bad.length) return;
    const touch = new Set<number>();
    for (const i of bad) for (let k = i - w - 3; k <= i + 3; k++) if (k > 0 && k < N && !pin[k]) touch.add(k);
    if (!touch.size) return;
    const old = path.slice();
    for (const k of Array.from(touch)) path[k] = { x: 0.5 * old[k].x + 0.25 * (old[k - 1].x + old[k + 1].x), y: 0.5 * old[k].y + 0.25 * (old[k - 1].y + old[k + 1].y) };
  }
}

/** The closest two men come (not counting the last 0.6 s, where the drawing decides). */
function minGap(all: { key: string; path: Vec2[] }[], N: number, durS: number) {
  let best = { d: Infinity, a: "", b: "", i: 0 };
  const stop = Math.max(0, N - Math.round(0.6 * HZ));
  void durS;
  for (let i = 0; i < stop; i++) {
    for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
      const d = dist(all[a].path[i], all[b].path[i]);
      if (d < best.d) best = { d, a: all[a].key, b: all[b].key, i };
    }
  }
  return best;
}

/**
 * Eases men apart who come closer than FHR_SPACE_M: a man held to the ball is
 * never moved; nearer the end the push fades, so everyone still ends exactly
 * where the drawing has him. The push is smoothed over time, so nobody jerks.
 */
function separate(all: { path: Vec2[]; pin: number[] }[], N: number, durS: number) {
  const fade = (i: number) => clamp((durS - i / HZ) / 0.8, 0, 1);
  for (let it = 0; it < 6; it++) {
    const push: Vec2[][] = all.map(() => Array.from({ length: N + 1 }, () => ({ x: 0, y: 0 })));
    let any = false;
    for (let i = 0; i < N; i++) {
      const f = fade(i);
      if (f <= 0) continue;
      for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
        const pa = all[a].path[i], pb = all[b].path[i];
        let dx = pb.x - pa.x, dy = pb.y - pa.y;
        let d = Math.hypot(dx, dy);
        if (d >= FHR_SPACE_M) continue;
        if (d < 1e-3) { dx = (a % 2 ? 1 : -1) * 0.01; dy = 0.01; d = Math.hypot(dx, dy); }
        const need = (FHR_SPACE_M - d) * f;
        const la = all[a].pin[i] ? 0 : 1, lb = all[b].pin[i] ? 0 : 1;
        if (!la && !lb) continue;
        const sa = la / (la + lb), sb = lb / (la + lb);
        push[a][i].x -= (dx / d) * need * sa; push[a][i].y -= (dy / d) * need * sa;
        push[b][i].x += (dx / d) * need * sb; push[b][i].y += (dy / d) * need * sb;
        any = true;
      }
    }
    if (!any) break;
    // Smooth each man's push over ±0.4 s, then apply (never to a held sample, nor at the end).
    const K = 6;
    all.forEach((p, a) => {
      const sm: Vec2[] = [];
      for (let i = 0; i <= N; i++) {
        let sx = 0, sy = 0, w = 0;
        for (let k = -K; k <= K; k++) {
          const j = i + k;
          if (j < 0 || j > N) continue;
          const wk = K + 1 - Math.abs(k);
          sx += push[a][j].x * wk; sy += push[a][j].y * wk; w += wk;
        }
        sm.push({ x: (sx / w) * 2.2, y: (sy / w) * 2.2 });
      }
      for (let i = 0; i < N; i++) {
        if (p.pin[i]) continue;
        const f = fade(i);
        p.path[i] = { x: clamp(p.path[i].x + sm[i].x * f, 0.3, PITCH_W - 0.3), y: clamp(p.path[i].y + sm[i].y * f, 0.3, LEN - 0.3) };
      }
    });
  }
}
