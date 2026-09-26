/**
 * The corner ruleset — see ./index.ts for how rules plug into the match.
 *
 * ── What was wrong (measured, 26 Sep 2026) ──
 *
 * On the corner the match actually serves, 62-75% of deliveries reached a
 * team-mate and 13-21% ended in a goal. Real Premier League: about 30% of
 * crossed corners reach an attacker (Arsenal, the best at it, 14 of 47) and
 * 2.8-4% of corners produce a goal. Three reasons, all in the engine's contact
 * rules rather than in anybody's finishing:
 *
 *   · a team-mate controls anything within 2.0 m of the ball's path at any
 *     height under 2.6 m, while a defender only touches it within 0.95 m and
 *     only below 1.9 m — so at head height the attacker always won;
 *   · nobody ever attacked the ball: a corner's defenders are "hold" and stand
 *     still, and the keeper never came for a cross;
 *   · defenders were outnumbered in every served picture (0% had def ≥ att).
 *
 * ── What this does ──
 *
 * SETUP (the picture): the defence matches or outnumbers the attack, the main
 * target has a man touch-tight and goal-side of him, there is a man on the
 * near post and a body in front of the keeper. The late runner at the edge of
 * the box is the last man they bother to mark.
 *
 * STRIKE: only the dice are thrown at the kick (two seeded numbers, saved
 * with a goal replay). Nothing about the flight is worked out yet.
 *
 * FLIGHT (the first contact): a beat after the kick the defence reads the
 * ball — where it will come down through each height, straight from the
 * engine's own flight helper (firstBounceAt), and which team-mate it is going
 * to. Then everybody who could get there first is weighed: every defender by
 * how far he has to run in the time the ball takes (a marker right there is a
 * real contest, a man eight metres away is not) and whether it is low enough
 * there for him to head, and the keeper if it drops into his area at a height
 * he can take. Better delivery (your set-piece technique), a better header of
 * the ball (the team-mate's physical), a better defender and a better keeper
 * all move the odds; the saved dice settle it. If the defence wins, the man
 * who won it runs there — never faster than 7 m/s, never a teleport — keeps
 * being re-aimed as the flight is re-read, and jumps as it arrives; the
 * engine's own contact rules then do the clearing (a defender's clearance, or
 * the keeper's catch / punch / tip). If the attacker wins, nothing is touched
 * and the engine plays the header or the finish as always. The flight is the
 * same on a replay, so the reading and the result are too.
 *
 * Nothing here steps a ball: the one-engine guard (scripts/one-engine-guard.mjs)
 * holds every file but the match to that.
 *
 * lib/star/canvasEngine.ts is not touched. This only moves people and sets
 * fields the engine already reads (positions, a defender's jump height, his
 * role so that the jump counts, the keeper's position).
 */
import {
  firstBounceAt, goalInView,
  type Ball, type Scenario, type Defender, type Vec2, type Identity,
} from "../canvasEngine";
import { CX, POST_L, POST_R, SIX_DEPTH, BOX_DEPTH, ARC_R } from "../pitch";
import type { KindRule, StrikeDecision } from "./index";

// ── Tunables (all measured against tests/star/cornerRules.mts) ────────────────

/** Chance a defender with a clean run at the ball wins it, before quality. */
export const CORNER_DUEL_BASE = 0.7;
/** …and the keeper, for a ball dropping into his six-yard box, at rating 0 / 100. */
export const CORNER_CLAIM_MIN = 0.35;
export const CORNER_CLAIM_MAX = 0.7;

const G = 9.8;
const DEF_REACT = 0.18;         // seconds before a defender moves off the kick
const DEF_SPRINT = 7.0;         // m/s — the fastest a defender attacks a ball
const KEEPER_SPRINT = 7.0;      // m/s — a keeper coming off his line (and his leap)
const DEF_STANDING_TOP = 1.9;   // the engine's own "head height" for a defender
const KEEPER_TOP = 2.45;        // under the engine's 2.5 m fingertip reach
const SIX_HALF = GOAL_HALF() + 5.5;
function GOAL_HALF() { return (POST_R - POST_L) / 2; }

// ── Small helpers ───────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** 0-1 quality from an identity, or a neutral value when nobody is known. */
function q(v: number | undefined, fallback: number): number {
  return clamp((v ?? fallback) / 100, 0, 1);
}

/** Every man in a blue shirt except you. */
function attackerSpots(sc: Scenario): Vec2[] {
  const out: Vec2[] = [];
  if (sc.runner) out.push(sc.runner.pos);
  for (const r of sc.secondaryRunners ?? []) out.push(r.pos);
  if (goalInView(sc.kind)) out.push(sc.follower);
  for (const t of sc.teammates ?? []) out.push(t);
  return out;
}

const inBox = (p: Vec2) => p.y <= BOX_DEPTH && Math.abs(p.x - CX) <= GOAL_HALF() + BOX_DEPTH;

// ── SETUP: the picture ──────────────────────────────────────────────────────

/** The most defenders a side has outside its keeper. */
const MAX_OUTFIELD = 10;

function setupCorner(sc: Scenario, rng: () => number): void {
  const side = sc.ball.x >= CX ? 1 : -1;
  const nearPostX = side > 0 ? POST_R : POST_L;
  const vp = sc.viewport;
  const attackers = attackerSpots(sc);

  const bodies = (): Vec2[] => [
    ...attackers, ...sc.defenders, { x: sc.keeper.x, y: sc.keeper.y }, sc.player,
  ];
  const legal = (p: Vec2, ignore?: Vec2) => {
    if (p.y < 0.3) return false;
    if (dist(p, sc.ball) < ARC_R + 0.3) return false;       // 9.15 m from the kick
    if (vp && (p.x < vp.x1 + 1 || p.x > vp.x2 - 1 || p.y > vp.y2 - 1.2)) return false;
    return bodies().every(b => b === ignore || dist(b, p) >= 0.75);
  };
  /** Nudge a spot a little until it is free, or give up. */
  const settle = (p: Vec2, ignore?: Vec2): Vec2 | null => {
    if (legal(p, ignore)) return p;
    for (let i = 0; i < 10; i++) {
      const a = rng() * Math.PI * 2, r = 0.5 + rng() * 0.9;
      const c = { x: p.x + Math.cos(a) * r, y: Math.max(0.35, p.y + Math.sin(a) * r) };
      if (legal(c, ignore)) return c;
    }
    return null;
  };
  /** Touch-tight, goal-side and a little ball-side of him. */
  const markSpot = (m: Vec2): Vec2 => {
    const gx = CX - m.x, gy = 0 - m.y, gl = Math.hypot(gx, gy) || 1;
    const bx = sc.ball.x - m.x, by = sc.ball.y - m.y, bl = Math.hypot(bx, by) || 1;
    return { x: m.x + (gx / gl) * 0.75 + (bx / bl) * 0.3, y: Math.max(0.35, m.y + (gy / gl) * 0.75 + (by / bl) * 0.3) };
  };
  const nearestDef = (p: Vec2) => sc.defenders.reduce<{ d: Defender | null; r: number }>(
    (best, d) => { const r = dist(d, p); return r < best.r ? { d, r } : best; }, { d: null, r: Infinity });
  const marking = (d: Defender) => attackers.some(a => dist(a, d) < 1.9);
  const add = (p: Vec2 | null): boolean => {
    if (!p || sc.defenders.length >= MAX_OUTFIELD) return false;
    sc.defenders.push({ x: p.x, y: p.y });
    return true;
  };

  // 1. The main target has a man on him: touch-tight and goal-side.
  const target = sc.runner?.pos;
  if (target) {
    const { d: near, r } = nearestDef(target);
    const tight = near && r <= 1.3 && near.y <= target.y + 0.3;
    if (!tight) {
      const spot = markSpot(target);
      // Borrow a spare man (not already on somebody) from close by; otherwise
      // bring one in.
      const spare = sc.defenders
        .filter(d => !marking(d) && dist(d, target) < 7)
        .sort((a, b) => dist(a, target) - dist(b, target))[0];
      const s = settle(spot, spare);
      if (s && spare) { spare.x = s.x; spare.y = s.y; }
      else add(s);
    }
  }

  // 2. A man on the near post.
  const postMan = sc.defenders.some(d => d.y < 2.2 && Math.abs(d.x - nearPostX) < 1.6);
  if (!postMan) add(settle({ x: nearPostX - side * 0.45, y: 0.55 }));

  // 3. A man at the front corner of the six-yard box, where a near-post ball
  // is flicked on — the first zonal man every side puts out.
  const frontZone = { x: CX + side * (SIX_HALF + 0.3), y: 5.2 };
  if (!sc.defenders.some(d => dist(d, frontZone) < 2.2)) add(settle(frontZone));

  // 4. A body in front of the keeper.
  const byKeeper = sc.defenders.some(d => Math.hypot(d.x - sc.keeper.x, d.y - sc.keeper.y) < 3.2);
  if (!byKeeper) add(settle({ x: sc.keeper.x + side * 1.4, y: sc.keeper.y + 2.3 }));

  // 5. Match or outnumber them: first the dangerous men nearest goal, then
  // zonal spots in the six-yard box, and only then the man at the edge.
  const want = Math.min(MAX_OUTFIELD, attackers.length + (rng() < 0.5 ? 1 : 0));
  const unmarked = () => attackers
    .filter(a => inBox(a) && !sc.defenders.some(d => dist(d, a) < 1.8))
    .sort((a, b) => dist(a, { x: CX, y: 0 }) - dist(b, { x: CX, y: 0 }));
  for (const a of unmarked()) {
    if (sc.defenders.length >= want) break;
    if (a.y > 12) continue;
    add(settle(markSpot(a)));
  }
  const ZONAL: Vec2[] = [
    { x: CX, y: 5.0 }, { x: CX + side * 4, y: 5.4 }, { x: CX - side * 4, y: 5.4 },
    { x: CX, y: 9.5 }, { x: CX + side * 7, y: 8 }, { x: CX - side * 6.5, y: 8.5 },
  ];
  for (const z of ZONAL) {
    if (sc.defenders.length >= want) break;
    if (bodies().some(b => dist(b, z) < 1.6)) continue;
    add(settle(z));
  }
  for (const a of unmarked()) {
    if (sc.defenders.length >= want) break;
    add(settle(markSpot(a)));
  }
}

// ── FLIGHT: read the delivery, find who it is going to, contest it ─────────

/** A point the ball WILL pass through: where, how high, and when (s after now). */
export interface FlightPoint {
  x: number; y: number; z: number; t: number;
  /** Past the first bounce: on the line it is travelling, not an exact point. */
  after?: boolean;
}

/** Heights (m) at which the descending flight is sampled. */
const SAMPLE_H = [2.6, 2.45, 2.3, 2.15, 2.0, 1.8, 1.6, 1.4, 1.2, 1.0, 0.8, 0.6, 0.4, 0.2, 0];
const RECEIVE_R = 2.0;          // the engine's own control radius for a team-mate
const RECEIVE_TOP = 2.6;        // …and the highest ball he can play
const BOUNCE_ON = 12;           // metres of the line after the first bounce that are read

/**
 * Where the ball is going to come down, read off the ball NOW.
 *
 * Every point comes from the engine's own flight helper, firstBounceAt — the
 * same exact flight the ball will fly, curl, drag and wind included. Asking it
 * where a copy of the ball that is `h` metres lower would land is asking where
 * the real ball will come down through height `h`; nothing here moves a ball.
 * A ball already on the ground is read along the line it is rolling on.
 * Times are the distance along the flight over the ball's pace now — an
 * estimate, used only to judge who can get there; where each man goes is
 * always one of the exact points.
 */
export function descendingPath(ball: Ball, sc: Scenario): FlightPoint[] {
  const speed = Math.hypot(ball.vel.x, ball.vel.y);
  if (speed < 0.5) return [];
  const pts: FlightPoint[] = [];
  const airborne = ball.z > 0.3 || ball.vz > 0.2;
  if (airborne) {
    for (const h of SAMPLE_H) {
      if (h >= ball.z - (ball.vz > 0 ? 0 : 0.3)) continue;
      const copy: Ball = { ...ball, pos: { ...ball.pos }, vel: { ...ball.vel }, z: ball.z - h };
      const at = firstBounceAt(copy, sc.conditions, 5);
      if (at) pts.push({ x: at.x, y: at.y, z: h, t: 0 });
    }
    // Beyond where it first lands we only know the line it is on: it skips on
    // along it, low. Good enough to judge who it is going to; a man running
    // to one of these points is re-aimed once the bounce can be read exactly.
    const n = pts.length;
    if (n >= 2 && pts[n - 1].z === 0) {
      const a = pts[n - 2], b = pts[n - 1];
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      for (let d = 0.75; d <= BOUNCE_ON; d += 0.75) {
        pts.push({ x: b.x + ((b.x - a.x) / l) * d, y: b.y + ((b.y - a.y) / l) * d, z: 0.3, t: 0, after: true });
      }
    }
  } else {
    const ux = ball.vel.x / speed, uy = ball.vel.y / speed;
    for (let d = 0.5; d <= 30; d += 0.5) pts.push({ x: ball.pos.x + ux * d, y: ball.pos.y + uy * d, z: 0, t: 0 });
  }
  // Along-the-flight distance → time at the pace it has now.
  let along = 0, px = ball.pos.x, py = ball.pos.y;
  for (const p of pts) {
    // A bounce takes some pace off it.
    along += Math.hypot(p.x - px, p.y - py) * (p.after ? 1.2 : 1);
    p.t = along / speed;
    px = p.x; py = p.y;
  }
  return pts;
}

/** The team-mates the ball can reach — the engine's own list. */
function receivers(sc: Scenario): { key: string; pos: Vec2; who?: Identity }[] {
  const out: { key: string; pos: Vec2; who?: Identity }[] = [];
  if (sc.runner) out.push({ key: "runner", pos: sc.runner.pos, who: sc.runner.who });
  sc.secondaryRunners.forEach((r, i) => out.push({ key: `support${i}`, pos: r.pos, who: r.who }));
  if (goalInView(sc.kind) && !sc.follower.shot) out.push({ key: "follower", pos: sc.follower, who: sc.follower.who });
  return out;
}

const segDist = (p: Vec2, a: Vec2, b: Vec2) => {
  const sx = b.x - a.x, sy = b.y - a.y, l2 = sx * sx + sy * sy;
  const t = l2 < 1e-9 ? 0 : clamp(((p.x - a.x) * sx + (p.y - a.y) * sy) / l2, 0, 1);
  return Math.hypot(p.x - (a.x + sx * t), p.y - (a.y + sy * t));
};

/** Metres of slack for a team-mate stepping towards the ball while it flies. */
const RECEIVE_SLACK = 0.8;

/**
 * The first team-mate the flight comes within reach of, and the last moment
 * the defence can still take it off him: a point on the flight just before
 * it gets there (between two of the engine's exact points, so within a few
 * centimetres of the real flight).
 */
export function headingFor(ball: Ball, sc: Scenario, path: FlightPoint[]) {
  const reach = RECEIVE_R + RECEIVE_SLACK;
  // Still climbing below head height: the engine can tell us where it comes
  // down through every height under the ball now, but not yet the top of the
  // flight. If a team-mate stands anywhere under that unread stretch, wait.
  if (ball.vz > 0 && ball.z < RECEIVE_TOP && path.length) {
    const first = path[0];
    if (receivers(sc).some(r => segDist(r.pos, ball.pos, first) < reach)) return null;
  }
  let prev: FlightPoint = { x: ball.pos.x, y: ball.pos.y, z: ball.z, t: 0 };
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p.z < RECEIVE_TOP) {
      for (const r of receivers(sc)) {
        if (segDist(r.pos, prev, p) >= reach) continue;
        // Walk back along this piece of the flight to where it enters his reach.
        let f = 1;
        for (let k = 0; k <= 20; k++) {
          const g = k / 20;
          const x = prev.x + (p.x - prev.x) * g, y = prev.y + (p.y - prev.y) * g;
          if (Math.hypot(r.pos.x - x, r.pos.y - y) < reach) { f = g; break; }
        }
        const lerp = (g: number): FlightPoint => ({
          x: prev.x + (p.x - prev.x) * g, y: prev.y + (p.y - prev.y) * g,
          z: prev.z + (p.z - prev.z) * g, t: prev.t + (p.t - prev.t) * g,
        });
        const segLen = Math.hypot(p.x - prev.x, p.y - prev.y) || 1;
        const last = lerp(Math.max(0, f - 0.4 / segLen));
        return { index: i, last, receiver: r };
      }
    }
    prev = p;
  }
  return null;
}

/** One man who could get there first, and where. `idx` -1 is the keeper. */
export interface CornerContender {
  idx: number;
  /** His chance of winning it, on his own. */
  w: number;
  /** The exact point on the flight he attacks, and the ball's height there. */
  x: number; y: number; z: number;
  /** Running pace he needs (m/s), and how high he has to leave the ground. */
  v: number; jump: number;
}

export interface CornerOdds {
  /** Chance the defence (a defender or the keeper) wins the first contact. */
  defence: number;
  contenders: CornerContender[];
  /** Who it is going to, if anybody. */
  receiver: string | null;
}

const IN_KEEPER_AREA = (p: Vec2) => p.y <= 8.5 && Math.abs(p.x - CX) <= SIX_HALF + 0.5;

/**
 * Who could get to the ball before the team-mate it is going to, and how
 * likely each is to win it. Pure: reads the scenario and the flight.
 *
 * Every defender picks the point on the ball's flight he can reach most
 * comfortably — the man marking the target attacks it where it arrives, the
 * man on the near post attacks it as it comes over him — and only if it is
 * low enough there to head. The keeper does the same over his own area.
 */
export function cornerOdds(
  sc: Scenario, ball: Ball, technique: number, keeperStrength: number,
  /** Re-aiming one man already running: his index (-1 keeper) and where he is. */
  only?: number, from?: Vec2,
): CornerOdds {
  const path = descendingPath(ball, sc);
  const target = headingFor(ball, sc, path);
  if (!target) return { defence: 0, contenders: [], receiver: null };
  // Anywhere on the flight before it reaches him.
  const points = [...path.slice(0, target.index).filter(p => p.t < target.last.t), target.last];
  const deliveryQ = clamp(technique / 100, 0, 1);
  const deliveryMult = 1.3 - 0.6 * deliveryQ;            // 42 → 1.05, 83 → 0.80
  const takerQ = q(target.receiver.who?.physical ?? target.receiver.who?.overall, 60);
  const takerMult = 1.35 - 0.7 * takerQ;                 // 55 → 0.97, 85 → 0.76
  const contenders: CornerContender[] = [];

  sc.defenders.forEach((d0, idx) => {
    if (only !== undefined && only !== idx) return;
    const d = only === idx && from ? { ...d0, x: from.x, y: from.y } : d0;
    const dq = q(d.who?.defending ?? d.who?.physical ?? d.who?.overall, 65);
    // How high he can get: a standing header reaches 1.9 m, a jump adds
    // 0.6-0.8 m — the same 2.6 m the attacker's own leap reaches, for an
    // average centre-back.
    const jumpMax = 0.6 + 0.2 * q(d.who?.physical, 65);
    const react = (1 - dq) * 0.1;                        // a poorer defender reads it later
    let best: FlightPoint | null = null, bestV = Infinity;
    for (const p of points) {
      if (p.z > DEF_STANDING_TOP + jumpMax) continue;
      const v = dist(d, p) / Math.max(0.05, p.t - react - 0.06);
      if (v < bestV) { bestV = v; best = p; }
    }
    if (!best || bestV > DEF_SPRINT) return;
    // Right there (a marker) is a full contest; a long run to it is not.
    const closeness = clamp((DEF_SPRINT - bestV) / (DEF_SPRINT - 1.5), 0, 1);
    const w = clamp(CORNER_DUEL_BASE * closeness * (0.7 + 0.6 * dq) * deliveryMult * takerMult, 0, 0.9);
    if (w <= 0.005) return;
    contenders.push({ idx, w, x: best.x, y: best.y, z: best.z, v: Math.min(Math.max(bestV, 1.2), DEF_SPRINT), jump: clamp(best.z - 1.55, 0, jumpMax) });
  });

  // The keeper comes for a ball dropping into his area at a height he can
  // take — the six-yard box, and a few yards beyond it less often.
  const k0 = sc.keeper;
  const k = only === -1 && from ? { ...k0, x: from.x, y: from.y } : k0;
  if (!k.done && (only === undefined || only === -1)) {
    const ks = clamp(keeperStrength / 100, 0, 1);
    let best: FlightPoint | null = null, bestScore = 0, bestV = Infinity;
    for (const p of points) {
      if (p.after || !IN_KEEPER_AREA(p) || p.z < 1.0 || p.z > KEEPER_TOP) continue;
      const v = Math.hypot(k.x - p.x, k.y - p.y) / Math.max(0.05, p.t - 0.06);
      if (v > KEEPER_SPRINT) continue;
      const closeness = clamp((KEEPER_SPRINT - v) / (KEEPER_SPRINT - 3.5), 0, 1);
      const areaMult = p.y <= SIX_DEPTH + 0.5 ? 1 : clamp(1 - (p.y - SIX_DEPTH - 0.5) / 2.5 * 0.6, 0.4, 1);
      const score = closeness * areaMult;
      if (score > bestScore) { bestScore = score; best = p; bestV = v; }
    }
    if (best) {
      // Bodies around where it drops get in his way.
      const crowd = attackerSpots(sc).filter(a => dist(a, best!) < 2.2).length;
      const crowdMult = Math.pow(0.85, crowd);
      const paceMult = Math.hypot(ball.vel.x, ball.vel.y) > 18 ? 0.75 : 1; // a whipped ball is hard to come for
      const w = clamp((CORNER_CLAIM_MIN + (CORNER_CLAIM_MAX - CORNER_CLAIM_MIN) * ks)
        * bestScore * crowdMult * paceMult * deliveryMult, 0, 0.9);
      if (w > 0.005) contenders.push({ idx: -1, w, x: best.x, y: best.y, z: best.z, v: Math.max(bestV, 1.2), jump: 0 });
    }
  }

  const defence = 1 - contenders.reduce((p, c) => p * (1 - c.w), 1);
  return { defence, contenders, receiver: target.receiver.key };
}

/** Of the defence's wins: the keeper's share first, then the defenders by weight. */
function pickWinner(odds: CornerOdds, u0: number, u1: number): CornerContender | null {
  if (!odds.contenders.length || u0 >= odds.defence) return null;
  // The keeper, if he comes, gets there first — he has his hands and the
  // whole of his area to himself.
  const keeper = odds.contenders.find(c => c.idx < 0);
  const defs = odds.contenders.filter(c => c.idx >= 0);
  const u = u1 * odds.defence;
  if (keeper && (u < keeper.w || defs.length === 0)) return keeper;
  const total = defs.reduce((s, c) => s + c.w, 0);
  let pick = (keeper ? (u - keeper.w) / Math.max(1e-9, odds.defence - keeper.w) : u1) * total;
  for (const c of defs) { if (pick < c.w) return c; pick -= c.w; }
  return defs[defs.length - 1];
}

/** Substeps between readings of the flight (each reading asks the engine
 *  where the ball comes down through fifteen heights). */
const READ_EVERY = 3;

interface FlightState {
  t: number;
  reads: number;
  /** "reading" until the flight is read; then the contest's result. */
  phase: "reading" | "mate" | "defender" | "keeper" | "none" | "over";
  win: CornerContender | null;
  p: number;
  receiver: string | null;
  jumped: boolean;
  pos: Vec2;
  saves0: number;
}
/** Per-strike running state, keyed by the decision so a replay starts fresh. */
const FLIGHT = new WeakMap<StrikeDecision, FlightState>();

/** What the contest settled on, for a test or a readout. Null before it is read. */
export function cornerContest(d: StrikeDecision | null) {
  const st = d ? FLIGHT.get(d) : undefined;
  if (!st || st.phase === "reading") return null;
  return { outcome: st.win ? (st.win.idx < 0 ? "keeper" : "defender") : st.receiver ? "mate" : "none", p: st.p, win: st.win, receiver: st.receiver };
}

function decideCorner(_sc: Scenario, _ball: Ball, draws: number[], ctx: { keeperStrength: number; technique: number }): StrikeDecision {
  // Nothing is worked out at the kick but the dice and who is involved: the
  // contest itself is read off the flight a beat later (see stepCorner), and
  // that flight is the same every time the goal is replayed.
  return {
    kind: "corner",
    data: { u0: draws[0], u1: draws[1], technique: ctx.technique, keeperStrength: ctx.keeperStrength },
  };
}

function applyCorner(sc: Scenario, _ball: Ball, d: StrikeDecision): void {
  FLIGHT.set(d, { t: 0, reads: 0, phase: "reading", win: null, p: 0, receiver: null, jumped: false, pos: { x: 0, y: 0 }, saves0: sc.keeper.saves });
}

function stepCorner(sc: Scenario, ball: Ball, dt: number, d: StrikeDecision): void {
  const st = FLIGHT.get(d);
  if (!st) return;
  st.t += dt;
  const def = st.phase === "defender" && st.win ? sc.defenders[st.win.idx] : undefined;

  // A jump comes back down whatever happened.
  if (def && ((def.z ?? 0) > 0 || (def.vz ?? 0) > 0)) {
    def.vz = (def.vz ?? 0) - G * dt;
    def.z = Math.max(0, (def.z ?? 0) + def.vz * dt);
    if (def.z === 0) def.vz = 0;
  }
  if (st.phase === "over" || st.phase === "mate" || st.phase === "none") return;
  // Somebody has played it, or it has gone: the contest is over.
  if (sc.receiverReached || ball.lastTouch === "defence" || ball.lastTouch === "keeper"
      || sc.keeper.saves > st.saves0 || ball.resting || st.t > 6) {
    st.phase = "over";
    return;
  }

  st.reads++;
  const reading = st.reads % READ_EVERY === 0;
  if (st.phase === "reading") {
    // Read every few substeps, and keep reading: a ball that drops short
    // and bounces on is read again on its next hop.
    if (!reading || st.t < DEF_REACT) return;
    const odds = cornerOdds(sc, ball, d.data.technique as number, d.data.keeperStrength as number);
    if (!odds.receiver) return;
    st.p = odds.defence;
    st.receiver = odds.receiver;
    st.win = pickWinner(odds, d.data.u0 as number, d.data.u1 as number);
    if (!st.win) { st.phase = "mate"; return; }
    if (st.win.idx >= 0) {
      const m = sc.defenders[st.win.idx];
      // Off the "hold" of a dead ball: he is attacking it now, which is also
      // what lets his jump count above a standing header's height.
      m.role = "cover";
      m.baseRole = "cover";
      st.pos = { x: m.x, y: m.y };
      st.phase = "defender";
    } else {
      sc.keeper.adjusting = false;
      sc.keeper.scrambling = false;
      st.pos = { x: sc.keeper.x, y: sc.keeper.y };
      st.phase = "keeper";
    }
  } else if (reading) {
    // Re-read the flight as it comes and keep him on it: after a bounce, or
    // as it curls, the point he is attacking moves with the ball.
    const w = st.win!;
    const again = cornerOdds(sc, ball, d.data.technique as number, d.data.keeperStrength as number, w.idx, st.pos);
    const mine = again.contenders.find(c => c.idx === w.idx);
    if (mine) {
      w.x = mine.x; w.y = mine.y; w.z = mine.z;
      w.v = Math.max(w.v, mine.v);
      if (!st.jumped) w.jump = mine.jump;
    }
  }

  const w = st.win!;
  // Run to the point on the flight he is attacking, at the pace he needs.
  const dx = w.x - st.pos.x, dy = w.y - st.pos.y, togo = Math.hypot(dx, dy);
  const stepLen = Math.min(togo, w.v * dt);
  if (togo > 1e-6) { st.pos.x += (dx / togo) * stepLen; st.pos.y += (dy / togo) * stepLen; }
  if (st.phase === "defender") {
    const m = sc.defenders[w.idx];
    m.x = st.pos.x; m.y = st.pos.y;
    // …and leave the ground so he is at the top of his jump as it arrives,
    // judged off the ball as it comes: its distance and its pace now.
    if (w.jump > 0.03 && !st.jumped) {
      const vz0 = Math.sqrt(2 * G * w.jump);
      const pace = Math.max(1, Math.hypot(ball.vel.x, ball.vel.y));
      if (Math.hypot(ball.pos.x - w.x, ball.pos.y - w.y) / pace <= vz0 / G) {
        m.vz = vz0; m.z = 0.001; st.jumped = true;
      }
    }
  } else {
    sc.keeper.x = st.pos.x; sc.keeper.y = st.pos.y;
  }
}

export const cornerRules: KindRule = {
  setup: (sc, rng) => setupCorner(sc, rng),
  draws: 2,
  decide: (sc, ball, draws, ctx) => decideCorner(sc, ball, draws, ctx),
  apply: applyCorner,
  step: stepCorner,
};
