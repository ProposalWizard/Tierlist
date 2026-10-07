import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, clearBall, stepBallCleared, setClearanceRules, getClearanceRules, miscueChance,
  CLEARANCE_DEFAULTS, SCENARIO_KINDS,
  type Outcome, type ScenarioKind, type Ball,
} from "../../lib/star/canvasEngine";
import { deflectBlock } from "../../lib/star/deflection";
import { steerDeflectionFromOwnGoal } from "../../lib/star/defenderTouch";
import { POST_L, POST_R } from "../../lib/star/pitch";

/**
 * CLEARANCES (Mikey, 7 Oct 2026).
 *
 *  1. Show the boot: a clean clearance is 24-34 m/s, up to 60° either side of
 *     straight away from his goal (was 18-26, about ±22°), and keeps flying
 *     after the chance (stepBallCleared).
 *  2. New only: miscues (30 in 100 for a defender of 50, 10 in 100 at 90) and
 *     a boot that hits a body come off loose — the chance goes on.
 *  3. New only: one live second ball per chance; a defender who wins a loose
 *     ball boots it clean.
 *
 * Old (the default for every caller that never sets the rules) must keep
 * every outcome exactly; New is measured Old against New on the same chances.
 */

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
const DT = 1 / 60;
const GOAL_CX = (POST_L + POST_R) / 2;
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

// ── 1. The boot itself ──────────────────────────────────────────────────
setClearanceRules();
{
  const r = mulberry32(7);
  let minSp = Infinity, maxSp = 0, maxAng = 0, back = 0, draws = 0;
  for (let i = 0; i < 4000; i++) {
    const ball = { pos: { x: 34, y: 14 }, vel: { x: 0, y: -20 }, z: 0.4, vz: 0, spin: 0, resting: false, contactCd: 0, event: null } as unknown as Ball;
    let n = 0;
    clearBall(ball, () => { n++; return r(); });
    draws = Math.max(draws, n);
    const sp = Math.hypot(ball.vel.x, ball.vel.y);
    minSp = Math.min(minSp, sp); maxSp = Math.max(maxSp, sp);
    maxAng = Math.max(maxAng, Math.abs(Math.atan2(ball.vel.x, ball.vel.y)) * 180 / Math.PI);
    if (ball.vel.y <= 0) back++;
    check(ball.cleared === true, "a clearance is marked as cleared");
  }
  console.log(`clean boot: ${minSp.toFixed(1)}-${maxSp.toFixed(1)} m/s, widest ${maxAng.toFixed(1)}°, back at his goal ${back}`);
  check(minSp >= 24 - 1e-9 && maxSp <= 34 + 1e-9, "boot speed 24-34 m/s");
  check(maxAng > 55 && maxAng <= 60 + 1e-9, "boot angle reaches about 60°, never more");
  check(back === 0, "a clearance never goes back at his own goal");
  check(draws === 3, "clearBall still draws exactly three random numbers (the match's stream is unchanged)");
}

// The boot keeps flying after the chance and does not stop dead.
{
  const ball = { pos: { x: 34, y: 14 }, vel: { x: 0, y: 29 }, z: 0.3, vz: 5, spin: 0, resting: false, contactCd: 0, event: null, cleared: true } as unknown as Ball;
  for (let i = 0; i < 60; i++) stepBallCleared(ball, DT);
  console.log(`after 1 s the boot has gone ${(ball.pos.y - 14).toFixed(1)} m`);
  check(ball.pos.y - 14 > 18, "a clean boot travels well over 18 m in its first second");
}

// Miscue chance by defender quality.
check(Math.abs(miscueChance(40, { ...CLEARANCE_DEFAULTS }) - 0.30) < 1e-9, "miscue 30 in 100 at 50 or below");
check(Math.abs(miscueChance(95, { ...CLEARANCE_DEFAULTS }) - 0.10) < 1e-9, "miscue 10 in 100 at 90 or above");
check(Math.abs(miscueChance(70, { ...CLEARANCE_DEFAULTS }) - 0.20) < 1e-9, "miscue 20 in 100 at 70");

// ── 2/3. Old against New, the same chances ─────────────────────────────
const KINDS = SCENARIO_KINDS.filter(k => k !== "penalty") as ScenarioKind[];
const SHOOT: ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "volley", "header", "free_kick"];

interface Played { out: Outcome; secondBalls: number; ownGoal: boolean; miscues: number; bodyHits: number; afterSecond: Outcome | null }

function played(kind: ScenarioKind, seed: number): Played {
  const rng = mulberry32(seed * 1013 + kind.length * 7919);
  const sc = buildScenario(kind, rng, 55 + rng() * 20, 55 + rng() * 20, 55 + rng() * 20);
  initDefenders(sc, rng);
  let dir: { x: number; y: number }, power: number;
  if (SHOOT.includes(kind)) {
    const side = rng() < 0.5 ? -1 : 1;
    const tx = GOAL_CX + side * ((POST_R - POST_L) / 2 - 0.6) * (0.55 + rng() * 0.45);
    dir = { x: tx - sc.ball.x + (rng() - 0.5) * 1.2, y: -Math.max(sc.ball.y, 1) };
    power = Math.min(1, 0.42 + Math.hypot(sc.ball.x - GOAL_CX, sc.ball.y) / 40) * (0.85 + rng() * 0.3);
  } else {
    const t = sc.runner?.pos ?? sc.secondaryRunners[0]?.pos ?? { x: sc.ball.x, y: sc.ball.y - 10 };
    dir = { x: t.x - sc.ball.x + (rng() - 0.5) * 1.5, y: t.y - sc.ball.y + (rng() - 0.5) * 1.5 };
    power = Math.min(0.95, 0.2 + Math.hypot(t.x - sc.ball.x, t.y - sc.ball.y) / 32) * (0.9 + rng() * 0.2);
  }
  const ball = launch(sc, dir, power,
    { cx: (rng() - 0.5) * 0.8, cy: -0.1 - rng() * 0.45 },
    { power: 55 + rng() * 25, technique: 55 + rng() * 25 }, rng);

  // CanvasMatch's own once-a-strike block deflection, with its New rule.
  let deflections = 0, miscues = 0, bodyHits = 0;
  const clr = getClearanceRules();
  let out: Outcome | null = null;
  let secondAt = -1;
  for (let i = 0; i < 2400 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    const incoming = { vx: ball.vel.x, vy: ball.vel.y, vz: ball.vz, z: ball.z, spin: ball.spin };
    const before = sc.secondBalls ?? 0;
    for (let s = 0; s < 3 && !out; s++) {
      let res = stepBall(ball, sc, rng, DT / 3);
      if (ball.event === "miscue") { miscues++; ball.event = null; }
      if (ball.event === "clearHit") { bodyHits++; ball.event = null; }
      const left = !clr.miscues || (sc.secondBalls ?? 0) < clr.secondBalls;
      if (res === "blocked" && deflections < 1 && left) {
        deflections++;
        if (clr.miscues) sc.secondBalls = (sc.secondBalls ?? 0) + 1;
        deflectBlock(ball, sc, incoming, mulberry32(seed ^ 0xdef1));
        steerDeflectionFromOwnGoal(ball, sc);
        res = null;
      }
      if (res) out = res;
    }
    if (secondAt < 0 && (sc.secondBalls ?? 0) > before && clr.miscues) secondAt = i;
  }
  const o = out ?? "short";
  return {
    out: o, secondBalls: sc.secondBalls ?? 0, miscues, bodyHits,
    ownGoal: (o === "goal" || o === "rebound") && ball.lastTouch === "defence",
    afterSecond: secondAt >= 0 ? o : null,
  };
}

const N = 120;   // chances per kind
function run(newRules: boolean) {
  setClearanceRules({ miscues: newRules });
  const all: Played[] = [];
  for (const k of KINDS) for (let s = 1; s <= N; s++) all.push(played(k, s));
  setClearanceRules();
  return all;
}
const oldRun = run(false);
const newRun = run(true);

const goals = (r: Played[]) => r.filter(p => p.out === "goal" || p.out === "rebound").length;
const count = (r: Played[], o: Outcome) => r.filter(p => p.out === o).length;
const total = oldRun.length;
console.log(`\n${total} chances, Old → New`);
for (const o of ["goal", "rebound", "delivered", "saved", "blocked", "tackled", "short", "out", "wide", "over"] as Outcome[]) {
  console.log(`  ${o.padEnd(10)} ${pct(count(oldRun, o), total).padStart(6)} → ${pct(count(newRun, o), total).padStart(6)}`);
}
const gOld = goals(oldRun), gNew = goals(newRun);
console.log(`  goals      ${gOld} → ${gNew}  (${pct(gOld, total)} → ${pct(gNew, total)})`);
const seconds = newRun.filter(p => p.afterSecond);
const mis = newRun.reduce((a, p) => a + p.miscues, 0);
const hits = newRun.reduce((a, p) => a + p.bodyHits, 0);
console.log(`  New: ${mis} miscues, ${hits} body hits, ${seconds.length} chances with a live second ball`);
const ours = seconds.filter(p => ["goal", "rebound", "delivered", "saved", "caught", "tipped", "post", "wide", "over"].includes(p.afterSecond!)).length;
const theirs = seconds.filter(p => ["short", "tackled", "blocked"].includes(p.afterSecond!)).length;
const outOf = seconds.filter(p => p.afterSecond === "out").length;
console.log(`  after a second ball: your side played it on ${ours}, they won it ${theirs}, out of play ${outOf}`);
const ownOld = oldRun.filter(p => p.ownGoal).length, ownNew = newRun.filter(p => p.ownGoal).length;
console.log(`  own goals off a defender: ${ownOld} → ${ownNew}`);

check(newRun.every(p => p.secondBalls <= 1), "never more than one live second ball a chance");
check(seconds.length > 0 && mis > 0, "New clearances really do miscue");
check(ownNew <= ownOld, "miscues and body hits never add an own goal");
// Goals may rise a little; not a lot.
check(gNew <= gOld * 1.25 + 5, `goals rise only a little (${gOld} → ${gNew})`);

if (problems.length) {
  console.error("\nFAIL clearances:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("\nclearances: ok");
