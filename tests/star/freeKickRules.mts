/**
 * THE DIRECT FREE KICK RULESET (lib/star/kindRules/freeKick.ts).
 *
 * Harry, 26 Sep 2026, from real Premier League numbers: 3.9% of direct free
 * kicks went in in 2023/24 (11/283); the best specialists sit at 12-15%. The
 * wall stands 9.15 m from the ball, a central one has four to six men, and the
 * keeper stays on his line.
 *
 * Measured before the ruleset (1,800 kicks, scratch harness, same served path
 * as the match): a sensible taker who picks over / round / under the wall and
 * then misses his line by a realistic amount (1.5° of aim, 5% of power, 0.1 of
 * the ball on contact, plus the engine's own miskick) scored 74% (P50/T50) and
 * 72% (P85/T85). The keeper never moved and stood on the wall's side as often
 * as not, so any ball past the wall and out of his arms' reach went in. A
 * plain drive at goal still scored 16%.
 *
 * After (300 kicks each, keeper 62): ordinary 4.4-6.3%, specialist
 * 9.9-16.7% (mix of the three ways / the taker's own best pick); a plain drive
 * 0% (96% blocked). This file keeps the rules, and a smaller version of that
 * measurement, from quietly drifting.
 */
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, keeperSaveRadius, type Outcome, type Scenario, type Ball,
} from "../../lib/star/canvasEngine";
import { nextAuthoredShape, applyAuthoredShape } from "../../lib/star/authoredChance";
import { setupKind, strikeKind, stepKind, replayStrike, type StrikeDecision } from "../../lib/star/kindRules";
import { FREE_KICK, wallSizeFor } from "../../lib/star/kindRules/freeKick";
import { CX, POST_L, POST_R, GOAL_W, GOAL_H } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SUB = 1 / 180;
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(1)}%`;

/** The free kick as CanvasMatch.loadScenario serves it (request path, no squad). */
function served(seed: number, ks = 62): Scenario {
  const rng = mulberry32(seed);
  const sc = buildScenario("free_kick", rng, ks, 60, 55);
  const shape = nextAuthoredShape("free_kick", rng, []);
  if (shape) applyAuthoredShape(sc, shape);
  setupKind(sc, rng, { appliedAuthored: !!shape, appliedPlan: false, keeperStrength: ks });
  initDefenders(sc, rng);
  return sc;
}
const wallOf = (sc: Scenario) => sc.defenders.filter((d) => d.baseRole === "hold");

// ── 1. Where it is taken, the wall, the keeper, the man over the ball ───────
{
  let bad = 0; const sizes = { central: [] as number[], half: [] as number[], wide: [] as number[] };
  let farSide = 0, sideN = 0; const dists: number[] = [];
  for (let s = 0; s < 400; s++) {
    const sc = served(9000 + s);
    const b = sc.ball;
    const dist = Math.hypot(b.x - CX, b.y), lat = b.x - CX;
    dists.push(dist);
    const where = `seed ${9000 + s}`;
    if (dist < FREE_KICK.minDist - 0.5 || dist > FREE_KICK.maxDist + 0.01) { bad++; problems.push(`${where}: taken ${dist.toFixed(1)} m out`); }
    if (Math.abs(lat) > FREE_KICK.maxLateral + 0.01) { bad++; problems.push(`${where}: ${lat.toFixed(1)} m off centre`); }
    const wall = wallOf(sc);
    for (const d of wall) {
      const g = Math.hypot(d.x - b.x, d.y - b.y);
      if (g < 9.15 - 1e-6 || g > 11) { bad++; problems.push(`${where}: a wall man ${g.toFixed(2)} m from the ball`); break; }
    }
    const angle = (Math.atan2(Math.abs(lat), b.y) * 180) / Math.PI;
    (angle < 10 ? sizes.central : angle < 18 ? sizes.half : sizes.wide).push(wall.length);
    // The end man covers the near post: he stands on or just outside the
    // ball → near-post line (never inside it).
    if (Math.abs(lat) >= 1) {
      const side = Math.sign(lat);
      const np = { x: CX + side * GOAL_W / 2, y: 0 };
      // Distance from the ball → near-post line, + = away from the goal's middle.
      const ux = np.x - b.x, uy = np.y - b.y, L = Math.hypot(ux, uy);
      let n = { x: -uy / L, y: ux / L };
      if (n.x * side < 0) n = { x: -n.x, y: -n.y };
      const outside = (d: { x: number; y: number }) => (d.x - b.x) * n.x + (d.y - b.y) * n.y;
      const most = Math.max(...wall.map(outside));
      if (most < 0.2 || most > 1.0) { bad++; problems.push(`${where}: the end man is ${most.toFixed(2)} m outside the near-post line`); }
      sideN++;
      if (Math.sign(sc.keeper.x - CX) === -side) farSide++;
    }
    // Keeper on his line, inside his posts.
    if (sc.keeper.y > 0.8 || sc.keeper.x < POST_L + 0.5 || sc.keeper.x > POST_R - 0.5) { bad++; problems.push(`${where}: keeper at ${sc.keeper.x.toFixed(1)},${sc.keeper.y.toFixed(1)}`); }
    if (Math.abs(sc.keeper.x - CX) < FREE_KICK.keeperCheat[0] - 0.01) { bad++; problems.push(`${where}: keeper not cheated (${(sc.keeper.x - CX).toFixed(2)})`); }
    // The team-mate over the ball: behind it (never offside), clear of it.
    const f = sc.follower;
    if (f.y < b.y || Math.hypot(f.x - b.x, f.y - b.y) < 3) { bad++; problems.push(`${where}: team-mate at ${f.x.toFixed(1)},${f.y.toFixed(1)}`); }
    // Everybody inside the frame the chance is shown in.
    const vp = sc.viewport;
    for (const p of [b, sc.player, f, ...wall, sc.keeper]) {
      if (p.x < vp.x1 || p.x > vp.x2 || p.y < vp.y1 || p.y > vp.y2) { bad++; problems.push(`${where}: someone off screen at ${p.x.toFixed(1)},${p.y.toFixed(1)}`); break; }
    }
    if (bad > 12) break;
  }
  const inRange = (xs: number[], lo: number, hi: number) => xs.every((n) => n >= lo && n <= hi);
  check(sizes.central.length > 50 && inRange(sizes.central, 4, 5), `central wall is 4-5 men (${[...new Set(sizes.central)]})`);
  check(inRange(sizes.half, 3, 4), `half-angled wall is 3-4 men (${[...new Set(sizes.half)]})`);
  check(inRange(sizes.wide, 2, 3), `angled wall is 2-3 men (${[...new Set(sizes.wide)]})`);
  check(farSide / sideN > 0.97, `keeper cheats toward the far post (${pct(farSide, sideN)})`);
  const sorted = dists.slice().sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  check(med > 22.5 && med < 26, `median distance is in the real range (${med.toFixed(1)} m)`);
  check(sorted[sorted.length - 1] > 27, `some are taken from 27 m+ (${sorted[sorted.length - 1].toFixed(1)} m)`);
  check(wallSizeFor(0, 0) === 5 && wallSizeFor(0, 0.99) === 4 && wallSizeFor(25, 0) === 3 && wallSizeFor(25, 0.99) === 2, "wall size table");
}

// ── 2. A plain drive into the wall is blocked ───────────────────────────────
function fly(sc: Scenario, ball: Ball, rng: () => number, kd: StrikeDecision | null, watch?: (t: number) => void): { out: Outcome | null; touched: boolean } {
  let out: Outcome | null = null, touched = false, t = 0;
  for (let i = 0; i < 3000 && !out; i++) {
    stepDefenders(sc, SUB, ball.pos, false, ball);
    stepKeeper(sc, SUB);
    stepReactions(sc, ball, SUB, rng);
    stepKind(sc, ball, SUB, kd);
    out = stepBall(ball, sc, rng, SUB);
    t += SUB;
    watch?.(t);
    if (sc.keeper.saves > 0) touched = true;
  }
  return { out, touched };
}
{
  let blocked = 0, goals = 0; const N = 150;
  for (let s = 0; s < N; s++) {
    const sc = served(4000 + s);
    const rng = mulberry32(77 + s);
    const ball = launch(sc, { x: CX - sc.ball.x, y: -sc.ball.y }, 0.85, { cx: 0, cy: 0 }, { power: 60, technique: 60 }, rng);
    const kd = strikeKind(sc, ball, mulberry32(s ^ 0x6b1d), { keeperStrength: 62, power: 60, technique: 60 });
    const { out } = fly(sc, ball, rng, kd);
    if (out === "blocked" || out === "tackled") blocked++;
    if (out === "goal" || out === "rebound") goals++;
  }
  check(blocked / N > 0.85, `a plain drive at the middle of the goal hits the wall (${pct(blocked, N)} blocked)`);
  check(goals / N < 0.03, `…and almost never goes in (${pct(goals, N)})`);
}

// ── 3. The wall jumps — or is told to stay down ─────────────────────────────
{
  let jumped = 0, stayed = 0; const N = 200;
  for (let s = 0; s < N; s++) {
    const sc = served(6000 + s);
    const rng = mulberry32(s);
    const ball = launch(sc, { x: CX + 3 - sc.ball.x, y: -sc.ball.y }, 0.9, { cx: 0.5, cy: 0.4 }, { power: 70, technique: 70 }, rng);
    const kd = strikeKind(sc, ball, mulberry32(s * 13 + 1), { keeperStrength: 62, power: 70, technique: 70 });
    if (!kd) { problems.push("no strike decision for a free kick"); break; }
    let maxZ = 0;
    fly(sc, ball, rng, kd, () => { for (const d of wallOf(sc)) maxZ = Math.max(maxZ, d.z ?? 0); });
    if (kd.data.jump) { if (maxZ > 0.3) jumped++; } else stayed++;
  }
  const shareDown = stayed / N;
  check(Math.abs(shareDown - FREE_KICK.wallStaysDown) < 0.07, `about ${FREE_KICK.wallStaysDown * 100}% of walls stay down (${pct(stayed, N)})`);
  check(jumped / (N - stayed) > 0.95, `the rest jump (${pct(jumped, N - stayed)})`);
  // Direct check: a stay-down wall, a low shot, the wall's feet never move
  // while the ball is still coming.
  const sc = served(6123);
  const rng = mulberry32(3);
  const ball = launch(sc, { x: CX - sc.ball.x, y: -sc.ball.y }, 0.8, { cx: 0, cy: -0.6 }, { power: 60, technique: 60 }, rng);
  const kd: StrikeDecision = { kind: "free_kick", data: { jump: false, react: 0.2 } };
  replayStrike(sc, ball, kd);
  let lifted = 0;
  fly(sc, ball, rng, kd, () => { if (ball.lastTouch === "attack" && !ball.loose) for (const d of wallOf(sc)) lifted = Math.max(lifted, d.z ?? 0); });
  check(lifted === 0, `a wall told to stay down stays down (max ${lifted.toFixed(2)} m)`);
}

// ── 4. The keeper cannot see through his wall, then comes across ────────────
{
  let movedEarly = 0, cameAcross = 0, n = 0, past = 0;
  for (let s = 0; s < 160; s++) {
    const sc = served(7000 + s);
    const side = Math.sign(sc.ball.x - CX) || 1;
    // Round the outside of the wall, curled back in toward the near post.
    const rng = mulberry32(s + 5);
    const ball = launch(sc, { x: CX + side * 5.5 - sc.ball.x, y: -sc.ball.y }, 0.95, { cx: side * 0.9, cy: 0.2 }, { power: 80, technique: 80 }, rng);
    const kd = strikeKind(sc, ball, mulberry32(s), { keeperStrength: 62, power: 80, technique: 80 });
    const start = sc.keeper.x;
    const wallD = Math.min(...wallOf(sc).map((d) => Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y)));
    let early = false, maxMove = 0, cleared = false;
    fly(sc, ball, rng, kd, () => {
      const travelled = Math.hypot(ball.pos.x - sc.ball.x, ball.pos.y - sc.ball.y);
      if (travelled < wallD && Math.abs(sc.keeper.x - start) > 0.01 && sc.keeper.saves === 0) early = true;
      if (travelled > wallD + 3 && ball.lastTouch === "attack") cleared = true;
      if (sc.keeper.saves === 0) maxMove = Math.max(maxMove, Math.abs(sc.keeper.x - start));
    });
    n++;
    if (early) movedEarly++;
    if (cleared) { past++; if (maxMove > 0.5) cameAcross++; }
  }
  check(movedEarly === 0, `the keeper never moves before the ball is past his wall (${movedEarly}/${n} did)`);
  check(past > 30 && cameAcross / past > 0.8, `…and then comes across for a ball that got past it (${pct(cameAcross, past)} of ${past})`);
}

// ── 5. A replay plays the same way ──────────────────────────────────────────
{
  let same = 0; const N = 40;
  for (let s = 0; s < N; s++) {
    const kick = () => {
      const sc = served(8000 + s);
      const rng = mulberry32(s + 99);
      const ball = launch(sc, { x: CX + 2.5 - sc.ball.x, y: -sc.ball.y }, 0.92, { cx: 0.7, cy: 0.35 }, { power: 80, technique: 80 }, rng);
      return { sc, ball, rng };
    };
    const a = kick();
    const kd = strikeKind(a.sc, a.ball, mulberry32(s * 7), { keeperStrength: 62, power: 80, technique: 80 });
    if (!kd) { problems.push("no strike decision to replay"); break; }
    const ra = fly(a.sc, a.ball, a.rng, kd);
    const b = kick();
    replayStrike(b.sc, b.ball, JSON.parse(JSON.stringify(kd)));
    const rb = fly(b.sc, b.ball, b.rng, kd);
    if (ra.out === rb.out && Math.abs(a.sc.keeper.x - b.sc.keeper.x) < 1e-9) same++;
  }
  check(same === N, `a replayed free kick ends the same way (${same}/${N})`);
}

// ── 6. Conversion: a sensible taker, ordinary vs specialist ─────────────────
//
// The taker picks the strike (from a table of noise-free strikes rotated onto
// a target 0.45-1.3 m inside either post) that clears the wall by the chosen
// way with the most room, knowing the keeper comes across once he sees it.
// Then he misses his line by a realistic amount. Loose bands on purpose — 100
// kicks is ±3 points either way — the full 300-kick measurement is in the
// header above.
interface Pt { x: number; y: number; z: number; t: number; sp: number; r: number }
const libs = new Map<string, { power: number; cx: number; cy: number; pts: Pt[] }[]>();
function library(sk: { power: number; technique: number }) {
  const key = `${sk.power}`;
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
  const wr = wall.map((d) => Math.hypot(d.x - B.x, d.y - B.y));
  const rWall = Math.min(...wr), rLo = rWall - 2.2, rHi = Math.max(...wr) + 2.2;
  let best: { dir: { x: number; y: number }; power: number; cx: number; cy: number; score: number } | null = null;
  for (const tx of [POST_L + 0.45, POST_L + 0.8, POST_L + 1.3, POST_R - 0.45, POST_R - 0.8, POST_R - 1.3]) {
    const D = Math.hypot(tx - B.x, B.y), angT = Math.atan2(-B.y, tx - B.x);
    for (const e of library(sk)) {
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
function gauss(r: () => number) { let s = 0; for (let i = 0; i < 6; i++) s += r(); return (s - 3) / Math.sqrt(0.5); }
function convert(sk: { power: number; technique: number }, N: number, ks = 62) {
  let goals = 0;
  for (let s = 0; s < N; s++) {
    const sc = served(1000 + s, ks);
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
    const { out } = fly(sc, ball, rng, kd);
    if (out === "goal" || out === "rebound") goals++;
  }
  return goals / N;
}
{
  const N = 100;
  const ordinary = convert({ power: 50, technique: 50 }, N);
  const specialist = convert({ power: 85, technique: 85 }, N);
  check(ordinary >= 0.01 && ordinary <= 0.12, `an ordinary taker (P50/T50) scores a few (${(ordinary * 100).toFixed(0)}%; target 4-7%)`);
  check(specialist >= 0.06 && specialist <= 0.26, `a specialist (P85/T85) scores about one in eight (${(specialist * 100).toFixed(0)}%; target ~12%)`);
  check(specialist > ordinary, `the specialist beats the ordinary taker (${(specialist * 100).toFixed(0)}% vs ${(ordinary * 100).toFixed(0)}%)`);
  console.log(`  conversion, ${N} kicks each: ordinary ${(ordinary * 100).toFixed(0)}%, specialist ${(specialist * 100).toFixed(0)}%`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the free kick: 9.15 m wall sized by angle, keeper on his line cheating to the far post, reads it once it is past the wall; ordinary takers score a few, specialists more");
