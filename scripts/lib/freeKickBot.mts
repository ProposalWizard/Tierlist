/**
 * A SENSIBLE FREE-KICK TAKER, for the library builder.
 *
 * The same taker tests/star/freeKickRules.mts measures conversion with (its
 * section 6, copied here so the builder can use it without running the test):
 * he picks the strike that clears the wall with the most room, knowing the
 * keeper comes across once he sees it, then misses his line by a realistic
 * amount. Used to keep the New free kicks no easier than the team's own drawn
 * ones (scripts/chance-library.mts).
 */
import {
  buildScenario, stepDefenders, stepKeeper, stepReactions, stepBall, launch, keeperSaveRadius, initDefenders,
  type Outcome, type Scenario, type Ball,
} from "../../lib/star/canvasEngine";
import { strikeKind, stepKind, type StrikeDecision } from "../../lib/star/kindRules";
import { CX, POST_L, POST_R, GOAL_H } from "../../lib/star/pitch";

const SUB = 1 / 180;
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return (s - 3) / Math.sqrt(0.5); };
const wallOf = (sc: Scenario) => sc.defenders.filter((d) => d.baseRole === "hold" && Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 12.5);

function fly(sc: Scenario, ball: Ball, rng: () => number, kd: StrikeDecision | null): Outcome | null {
  let out: Outcome | null = null;
  for (let i = 0; i < 3000 && !out; i++) {
    stepDefenders(sc, SUB, ball.pos, false, ball);
    stepKeeper(sc, SUB);
    stepReactions(sc, ball, SUB, rng);
    stepKind(sc, ball, SUB, kd);
    out = stepBall(ball, sc, rng, SUB);
  }
  return out;
}

interface Pt { x: number; y: number; z: number; t: number; sp: number; r: number }
const libs = new Map<string, { power: number; cx: number; cy: number; pts: Pt[] }[]>();
function strikes(sk: { power: number; technique: number }) {
  const key = `${sk.power}|${sk.technique}`;
  if (libs.has(key)) return libs.get(key)!;
  const out: { power: number; cx: number; cy: number; pts: Pt[] }[] = [];
  const half = () => 0.5;
  for (let power = 0.5; power <= 1.0001; power += 0.1) for (let cy = -1; cy <= 1.0001; cy += 0.25) for (let cx = -1; cx <= 1.0001; cx += 0.25) {
    const sc = JSON.parse(JSON.stringify(buildScenario("free_kick", mulberry32(1), 62, 60, 55))) as Scenario;
    sc.defenders = []; sc.keeper.done = true; sc.receiverDone = true; sc.runner = null; sc.secondaryRunners = [];
    sc.follower = { x: -80, y: 200, active: false, shot: false } as Scenario["follower"];
    sc.viewport = { x1: -300, x2: 300, y1: -300, y2: 300 } as Scenario["viewport"];
    sc.ball = { x: CX, y: 45 }; sc.player = { x: CX, y: 47 };
    const ball = launch(sc, { x: 0, y: -1 }, power, { cx, cy }, sk, half);
    const pts: Pt[] = []; let t = 0;
    for (let i = 0; i < 700; i++) {
      stepBall(ball, sc, half, SUB); t += SUB;
      const r = Math.hypot(ball.pos.x - CX, ball.pos.y - 45);
      pts.push({ x: ball.pos.x - CX, y: ball.pos.y - 45, z: ball.z, t, sp: Math.hypot(ball.vel.x, ball.vel.y), r });
      if (r > 32 || ball.resting) break;
    }
    out.push({ power, cx, cy, pts });
  }
  libs.set(key, out);
  return out;
}

function plan(sc: Scenario, sk: { power: number; technique: number }) {
  const B = sc.ball, wall = wallOf(sc), k = sc.keeper, reach = keeperSaveRadius(sc);
  if (!wall.length) return null;
  const wr = wall.map((d) => Math.hypot(d.x - B.x, d.y - B.y));
  const rWall = Math.min(...wr), rLo = rWall - 2.2, rHi = Math.max(...wr) + 2.2;
  let best: { dir: { x: number; y: number }; power: number; cx: number; cy: number; score: number } | null = null;
  for (const tx of [POST_L + 0.45, POST_L + 0.8, POST_L + 1.3, POST_R - 0.45, POST_R - 0.8, POST_R - 1.3]) {
    const D = Math.hypot(tx - B.x, B.y), angT = Math.atan2(-B.y, tx - B.x);
    for (const e of strikes(sk)) {
      const qi = e.pts.findIndex((p) => p.r >= D);
      if (qi < 0) continue;
      const Q = e.pts[qi];
      if (Q.z > GOAL_H - 0.25) continue;
      const al = angT - Math.atan2(Q.y, Q.x), ca = Math.cos(al), sa = Math.sin(al);
      let wm = 1.5;
      for (let i = 0; i < qi; i++) {
        const p = e.pts[i];
        if (p.r < rLo || p.r > rHi) continue;
        const wx = B.x + p.x * ca - p.y * sa, wy = B.y + p.x * sa + p.y * ca;
        const tt = p.t - 0.1, foot = tt > 0 ? Math.max(0, 3.6 * tt - 4.9 * tt * tt) : 0;
        const top = Math.min(foot + 1.9, 2.05), rr = p.sp > 12 ? 0.95 : 1.15;
        for (const d of wall) {
          const h = Math.hypot(d.x - wx, d.y - wy) - rr;
          if (h < 1.5) wm = Math.min(wm, Math.max(h, p.z - top, foot - p.z));
        }
      }
      const tW = (e.pts.find((p) => p.r >= rWall + 0.4) ?? Q).t;
      const travel = 3.4 * Math.max(0, Q.t - tW - 0.28);
      const kd = Math.hypot(Math.max(0, Math.abs(tx - k.x) - travel), (Q.z - 0.95) * 1.15) - reach;
      const score = Math.min(wm / 0.5, kd / 0.6, (GOAL_H - 0.12 - Q.z) / 0.4, (Math.min(tx - POST_L, POST_R - tx) - 0.12) / 0.5);
      if (!best || score > best.score) best = { dir: { x: sa, y: -ca }, power: e.power, cx: e.cx, cy: e.cy, score };
    }
  }
  return best;
}

/**
 * How often a sensible ordinary taker (P50/T50) scores from this free kick,
 * over `n` kicks — `serve(i)` builds the picture afresh for kick i.
 */
export function freeKickRate(serve: (i: number) => Scenario, n = 24, sk = { power: 50, technique: 50 }, ks = 62): number {
  let goals = 0;
  for (let s = 0; s < n; s++) {
    const sc = serve(s);
    initDefenders(sc, mulberry32(s + 1));
    const p = plan(sc, sk);
    if (!p) continue;
    const r = mulberry32((5000 + s) ^ 0x51f15e);
    const a = gauss(r) * 1.5 * Math.PI / 180;
    const dir = { x: p.dir.x * Math.cos(a) - p.dir.y * Math.sin(a), y: p.dir.x * Math.sin(a) + p.dir.y * Math.cos(a) };
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const rng = mulberry32((5000 + s) * 31 + 7);
    const ball = launch(sc, dir, clamp(p.power + gauss(r) * 0.05, 0.05, 1),
      { cx: clamp(p.cx + gauss(r) * 0.1, -1, 1), cy: clamp(p.cy + gauss(r) * 0.1, -1, 1) }, sk, rng);
    const kd = strikeKind(sc, ball, mulberry32((5000 + s) ^ 0x6b1d), { keeperStrength: ks, power: sk.power, technique: sk.technique });
    const out = fly(sc, ball, rng, kd);
    if (out === "goal" || out === "rebound") goals++;
  }
  return goals / n;
}
