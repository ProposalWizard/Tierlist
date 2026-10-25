/**
 * THE LEAF — the falling-leaf free kick (lib/star/leafFlight.ts, wired in
 * lib/star/kindRules/freeKick.ts; Star Pass reward, piece 4).
 *
 * Pinned:
 *   1. every other free kick is exactly as before: no run-up, or any other
 *      run-up, gives the same strike decision and the same flight, to the bit;
 *   2. a Leaf kick flies a different SHAPE: early it holds its line (higher,
 *      less bend), late it dips and swerves (more drop and bend per metre),
 *      and it arrives about where the same strike would have;
 *   3. a replay of a Leaf kick flies the same way;
 *   4. scoring, the same seeds and the same kicks with and without The Leaf
 *      (the sensible taker of tests/star/freeKickRules.mts, keeper 62): the
 *      Leaf adds at most about 3 percentage points.
 *
 * Run: npx tsx tests/star/leafFreeKick.mts   (LEAF_N=600 for a bigger sample)
 */
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, keeperSaveRadius, type Outcome, type Scenario, type Ball,
} from "../../lib/star/canvasEngine";
import { makeChance } from "../../lib/star/chanceMaker";
import { strikeKind, stepKind, replayStrike, type StrikeDecision } from "../../lib/star/kindRules";
import { CX, POST_L, POST_R, GOAL_H } from "../../lib/star/pitch";
import { LEAF, leafExtra } from "../../lib/star/leafFlight";
import { LEAF_RUNUP, FREE_KICK_RUNUPS, REWARD_RUNUPS, takerFreeKickRunup, takerPenaltyRunup } from "../../lib/star/runupStyles";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SUB = 1 / 180;

function served(seed: number, ks = 62): Scenario {
  const rng = mulberry32(seed);
  const sc = makeChance({ source: { from: "kind", kind: "free_kick" }, rng, strength: { keeper: ks, team: 60, vision: 55 }, memory: null }).sc;
  initDefenders(sc, rng);
  return sc;
}
const wallOf = (sc: Scenario) => sc.defenders.filter((d) => d.baseRole === "hold" && Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 12.5);

function fly(sc: Scenario, ball: Ball, rng: () => number, kd: StrikeDecision | null, watch?: () => void): Outcome | null {
  let out: Outcome | null = null;
  for (let i = 0; i < 3000 && !out; i++) {
    stepDefenders(sc, SUB, ball.pos, false, ball);
    stepKeeper(sc, SUB);
    stepReactions(sc, ball, SUB, rng);
    stepKind(sc, ball, SUB, kd);
    out = stepBall(ball, sc, rng, SUB);
    watch?.();
  }
  return out;
}

// ── 0. The contract ────────────────────────────────────────────────────────
console.log("\nTHE LEAF: the run-up");
{
  const leaf = FREE_KICK_RUNUPS.find((s) => s.id === "fk_leaf");
  ok(!!leaf && leaf.name === "The Leaf" && leaf.player === "Juninho", `fk_leaf is "The Leaf", Juninho's (${leaf?.name}, ${leaf?.player})`);
  ok(LEAF_RUNUP === "fk_leaf" && REWARD_RUNUPS.has("fk_leaf") && REWARD_RUNUPS.has("golden"), "The Leaf and the Golden Run-up are reward styles");
  let leafs = 0, golds = 0;
  for (let i = 0; i < 3000; i++) { if (takerFreeKickRunup(`p${i}`) === "fk_leaf") leafs++; if (takerPenaltyRunup(`p${i}`) === "golden") golds++; }
  ok(leafs === 0 && golds === 0, "no team-mate or opponent is ever handed a reward run-up (3,000 names)");
  ok(leafExtra(0) < 0 && leafExtra(1) > 0 && leafExtra(-0.1) === 0 && leafExtra(1.1) === 0, "less bend and drop early, more late, nothing outside the flight");
  // At steady pace ∫(1−u)e(u)du would be 0 at balance 1/6; the real ball slows,
  // so a little more is held back early (checked on the end spot in part 2).
  let I = 0; const n = 2000; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n; I += (1 - u) * leafExtra(u) / n; }
  ok(I < 0 && I > -0.03, `the shape mostly moves the bend and drop rather than adding any (∫(1−u)·e = ${I.toFixed(4)})`);
}

// ── 1. Every other free kick is exactly as before ─────────────────────────
console.log("\nEVERY OTHER FREE KICK: unchanged");
{
  let sameDecision = 0, sameFlight = 0; const N = 120;
  const others = [undefined, "fk_standard", "fk_calm_curl", "fk_power_stance", "golden", "standard"];
  for (let s = 0; s < N; s++) {
    const kick = (runup: string | undefined) => {
      const sc = served(3000 + s);
      const rng = mulberry32(s + 11);
      const side = Math.sign(sc.ball.x - CX) || 1;
      const ball = launch(sc, { x: CX - side * 2.6 - sc.ball.x, y: -sc.ball.y }, 0.9, { cx: side * 0.7, cy: 0.35 }, { power: 75, technique: 75 }, rng);
      const kd = strikeKind(sc, ball, mulberry32(s ^ 0x6b1d), { keeperStrength: 62, power: 75, technique: 75, ...(runup ? { runup } : {}) });
      const out = fly(sc, ball, rng, kd);
      return { kd: JSON.stringify(kd), out, x: ball.pos.x, y: ball.pos.y, z: ball.z };
    };
    const base = kick(undefined);
    const rest = others.slice(1).map(kick);
    if (rest.every((r) => r.kd === base.kd)) sameDecision++;
    if (rest.every((r) => r.out === base.out && r.x === base.x && r.y === base.y && r.z === base.z)) sameFlight++;
  }
  ok(sameDecision === N, `the strike decision is the same with no run-up or any other (${sameDecision}/${N})`);
  ok(sameFlight === N, `…and the ball flies exactly the same, to the bit (${sameFlight}/${N})`);
}

// ── 2. The shape: holds its line, then dips and swerves late ──────────────
console.log("\nTHE SHAPE");
interface P { u: number; x: number; z: number }
function path(leaf: boolean, power: number, cx: number, cy: number, D = 25): P[] {
  const sc = JSON.parse(JSON.stringify(buildScenario("free_kick", mulberry32(1), 62, 60, 55))) as Scenario;
  sc.defenders = []; sc.keeper.done = true; sc.receiverDone = true; sc.runner = null; sc.secondaryRunners = [];
  sc.follower = { x: -80, y: 200, active: false, shot: false } as Scenario["follower"];
  sc.viewport = { x1: -300, x2: 300, y1: -300, y2: 300 } as Scenario["viewport"];
  sc.ball = { x: CX, y: D }; sc.player = { x: CX, y: D + 2 };
  const half = () => 0.5;
  const ball = launch(sc, { x: 0, y: -1 }, power, { cx, cy }, { power: 80, technique: 80 }, half);
  const kd: StrikeDecision = { kind: "free_kick", data: { jump: true, react: 0.2, drill: false, ...(leaf ? { leaf: true } : {}) } };
  replayStrike(sc, ball, kd);
  const pts: P[] = [];
  for (let i = 0; i < 900; i++) {
    stepKind(sc, ball, SUB, kd);
    stepBall(ball, sc, half, SUB);
    pts.push({ u: (D - ball.pos.y) / D, x: ball.pos.x - CX, z: ball.z });
    if (ball.pos.y <= 0 || ball.z <= 0 || ball.inNet) break;
  }
  return pts;
}
const at = (ps: P[], u: number) => ps.find((p) => p.u >= u) ?? ps[ps.length - 1];
{
  // A curled, lifted free kick from 25 m, straight on.
  const plain = path(false, 0.9, 0.8, 0.4), leaf = path(true, 0.9, 0.8, 0.4);
  const p4 = at(plain, 0.4), l4 = at(leaf, 0.4);
  const pEnd = at(plain, 0.999), lEnd = at(leaf, 0.999);
  console.log(`    at 40% of the way (by the wall): plain bend ${p4.x.toFixed(2)} m height ${p4.z.toFixed(2)} m · Leaf bend ${l4.x.toFixed(2)} m height ${l4.z.toFixed(2)} m`);
  console.log(`    at the goal line:                plain bend ${pEnd.x.toFixed(2)} m height ${pEnd.z.toFixed(2)} m · Leaf bend ${lEnd.x.toFixed(2)} m height ${lEnd.z.toFixed(2)} m`);
  ok(l4.z > p4.z + 0.05 && Math.abs(l4.x) < Math.abs(p4.x), "early it holds its line: higher and straighter by the wall");
  // How much of its total bend / drop comes in the last 30 % of the way.
  const share = (ps: P[], key: "x" | "z") => {
    const a = at(ps, 0.7), e = at(ps, 0.999), s = ps[0];
    // Drop measured from the line it was on at 70 %: the curvature that is left.
    const total = Math.abs(e[key] - s[key]) || 1e-9;
    return Math.abs(e[key] - a[key]) / total;
  };
  const late = (ps: P[]) => { const a = at(ps, 0.7), b = at(ps, 0.85), e = at(ps, 0.999); return (e.z - b.z) - (b.z - a.z); };
  ok(share(leaf, "x") > share(plain, "x") + 0.08, `it swerves late: ${(share(leaf, "x") * 100).toFixed(0)}% of its bend comes in the last 30% (plain ${(share(plain, "x") * 100).toFixed(0)}%)`);
  ok(late(leaf) < late(plain) - 0.05, `it dips late: the drop speeds up more over the last 30% (${late(leaf).toFixed(2)} m vs ${late(plain).toFixed(2)} m)`);
  ok(Math.abs(lEnd.x - pEnd.x) < 0.6 && Math.abs(lEnd.z - pEnd.z) < 0.6, `…and arrives near where the same strike would have (${Math.abs(lEnd.x - pEnd.x).toFixed(2)} m across, ${Math.abs(lEnd.z - pEnd.z).toFixed(2)} m up)`);
  // Over many strikes (18-30 m, every power and curl) it lands on average
  // where the same strike would have: a shape, not a power-up.
  let n = 0, bend = 0, up = 0;
  for (const D of [18, 22, 26, 30]) for (const power of [0.75, 0.9, 1]) for (const cx of [-0.8, -0.4, 0.4, 0.8]) for (const cy of [0.1, 0.35, 0.6]) {
    const p = path(false, power, cx, cy, D), l = path(true, power, cx, cy, D);
    const pe = p[p.length - 1], le = l[l.length - 1];
    if (pe.u < 0.999 || le.u < 0.999) continue; // came down short
    bend += Math.abs(le.x) - Math.abs(pe.x); up += le.z - pe.z; n++;
  }
  ok(n > 80 && Math.abs(bend / n) < 0.15 && Math.abs(up / n) < 0.15, `on average it ends where it would have (${n} strikes: ${(bend / n).toFixed(2)} m more bend, ${(up / n).toFixed(2)} m higher)`);
  // A knuckled one (no sidespin) only gets the dip.
  const kp = path(false, 0.95, 0, 0.3), kl = path(true, 0.95, 0, 0.3);
  ok(Math.abs(at(kl, 0.999).x - at(kp, 0.999).x) < 1e-6, "a strike with no sidespin gets no extra bend, only the dip");
}

// ── 3. A replay flies the same way ────────────────────────────────────────
console.log("\nA REPLAY");
{
  let same = 0; const N = 30;
  for (let s = 0; s < N; s++) {
    const kick = () => {
      const sc = served(8100 + s);
      const rng = mulberry32(s + 7);
      const ball = launch(sc, { x: CX + 2.2 - sc.ball.x, y: -sc.ball.y }, 0.92, { cx: 0.7, cy: 0.35 }, { power: 80, technique: 80 }, rng);
      return { sc, ball, rng };
    };
    const a = kick();
    const kd = strikeKind(a.sc, a.ball, mulberry32(s * 7), { keeperStrength: 62, power: 80, technique: 80, runup: LEAF_RUNUP });
    const ra = fly(a.sc, a.ball, a.rng, kd);
    const b = kick();
    const kd2 = JSON.parse(JSON.stringify(kd)) as StrikeDecision;
    replayStrike(b.sc, b.ball, kd2);
    const rb = fly(b.sc, b.ball, b.rng, kd2);
    if (kd?.data.leaf === true && ra === rb && a.ball.pos.x === b.ball.pos.x && a.ball.z === b.ball.z) same++;
  }
  ok(same === N, `a replayed Leaf kick flies and ends the same way (${same}/${N})`);
}

// ── 4. Scoring with and without The Leaf (same seeds, same kicks) ─────────
console.log("\nSCORING");
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
// The taker of tests/star/freeKickRules.mts: he picks his strike off the
// ORDINARY flight (what a player expects), then misses his line a little.
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
      const kdist = Math.hypot(Math.max(0, Math.abs(tx - k.x) - travel), (Q.z - 0.95) * 1.15) - reach;
      const score = Math.min(wm / 0.5, kdist / 0.6, (GOAL_H - 0.12 - Q.z) / 0.4, (Math.min(tx - POST_L, POST_R - tx) - 0.12) / 0.5);
      if (!best || score > best.score) best = { dir: { x: sa, y: -ca }, power: e.power, cx: e.cx, cy: e.cy, score };
    }
  }
  return best;
}
function gauss(r: () => number) { let s = 0; for (let i = 0; i < 6; i++) s += r(); return (s - 3) / Math.sqrt(0.5); }
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Goals from N kicks, the same seeds each way; `leaf` only adds the run-up to the strike context. */
function convert(sk: { power: number; technique: number }, N: number, leaf: boolean, ks = 62) {
  let goals = 0;
  for (let s = 0; s < N; s++) {
    const sc = served(1000 + s, ks);
    const p = plan(sc, sk);
    if (!p) continue;
    const r = mulberry32((5000 + s) ^ 0x51f15e);
    const a = gauss(r) * 1.5 * Math.PI / 180;
    const dir = { x: p.dir.x * Math.cos(a) - p.dir.y * Math.sin(a), y: p.dir.x * Math.sin(a) + p.dir.y * Math.cos(a) };
    const rng = mulberry32((5000 + s) * 31 + 7);
    const ball = launch(sc, dir, clamp(p.power + gauss(r) * 0.05, 0.05, 1),
      { cx: clamp(p.cx + gauss(r) * 0.1, -1, 1), cy: clamp(p.cy + gauss(r) * 0.1, -1, 1) }, sk, rng);
    const kd = strikeKind(sc, ball, mulberry32((5000 + s) ^ 0x6b1d), { keeperStrength: ks, power: sk.power, technique: sk.technique, ...(leaf ? { runup: LEAF_RUNUP } : {}) });
    const out = fly(sc, ball, rng, kd);
    if (out === "goal" || out === "rebound") goals++;
  }
  return goals / N;
}
/** A spread of ordinary attempts (any aim on the goal, any contact): the kick a real player throws in. */
function mixed(N: number, leaf: boolean) {
  let goals = 0;
  for (let s = 0; s < N; s++) {
    const sc = served(20000 + s);
    const r = mulberry32(s * 977 + 3);
    const tx = POST_L + 0.3 + r() * (POST_R - POST_L - 0.6);
    const L = Math.hypot(tx - sc.ball.x, sc.ball.y);
    const dir = { x: (tx - sc.ball.x) / L, y: -sc.ball.y / L };
    const sk = { power: 55 + r() * 35, technique: 55 + r() * 35 };
    const rng = mulberry32(s + 401);
    const ball = launch(sc, dir, 0.6 + r() * 0.4, { cx: r() * 2 - 1, cy: r() * 1.2 - 0.4 }, sk, rng);
    const kd = strikeKind(sc, ball, mulberry32(s ^ 0x77), { keeperStrength: 62, ...sk, ...(leaf ? { runup: LEAF_RUNUP } : {}) });
    const out = fly(sc, ball, rng, kd);
    if (out === "goal" || out === "rebound") goals++;
  }
  return goals / N;
}
{
  const N = Number(process.env.LEAF_N ?? 300);
  const pp = (v: number) => `${(v * 100).toFixed(1)}%`;
  const rows: [string, number, number][] = [
    ["ordinary taker (P50/T50)", convert({ power: 50, technique: 50 }, N, false), convert({ power: 50, technique: 50 }, N, true)],
    ["specialist (P85/T85)", convert({ power: 85, technique: 85 }, N, false), convert({ power: 85, technique: 85 }, N, true)],
    ["any strike at goal (mixed)", mixed(N * 2, false), mixed(N * 2, true)],
  ];
  console.log(`    LEAF.shape = ${LEAF.shape}, keeper 62, the same seeds and kicks each way:`);
  for (const [what, a, b] of rows) console.log(`    ${what.padEnd(28)} without ${pp(a).padStart(6)} · with The Leaf ${pp(b).padStart(6)} · ${(b - a >= 0 ? "+" : "")}${((b - a) * 100).toFixed(1)} pts`);
  for (const [what, a, b] of rows) ok(b - a <= 0.035, `${what}: The Leaf adds at most ~3 points (${((b - a) * 100).toFixed(1)})`);
  ok(rows.some(([, a, b]) => b !== a), "…and it does change some outcomes (it is a real flight, not a picture)");
}

if (failed) { console.log(`\nFAIL (${failed})`); process.exit(1); }
console.log("\nPASS — The Leaf: other free kicks unchanged to the bit; it holds its line, dips and swerves late; at most ~+3 points");
