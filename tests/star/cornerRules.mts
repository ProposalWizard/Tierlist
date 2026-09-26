/**
 * THE CORNER RULESET (lib/star/kindRules/corner.ts).
 *
 * Harry's research, real Premier League: 2.8-4% of corners lead to a goal;
 * about 30% of crossed corners reach an attacker (Arsenal, the best at it,
 * 14 of 47); a ball that reaches the head goes in about 1 time in 5 (Arsenal
 * 3 of 14) — reaching the head is the hard part. Defenders usually outnumber
 * attackers, one marks the main target tightly, most corners are cleared.
 *
 * Measured before the rule, on the corner the match serves: 62-75% of
 * deliveries reached a team-mate and 13-21% ended in a goal; defenders were
 * outnumbered in every picture; the target had a man within 1.5 m 12% of
 * the time.
 *
 * This file pins the picture (setup), the first-contact funnel (strike +
 * flight), that the man who wins it actually runs there at a footballer's
 * pace, and that a saved goal replays the same way.
 *
 *   npx tsx tests/star/cornerRules.mts
 */
import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall, launch, goalInView,
  type Scenario, type Ball, type Outcome, type Vec2, type KickSkills,
} from "../../lib/star/canvasEngine";
import { nextAuthoredShape, applyAuthoredShape } from "../../lib/star/authoredChance";
import { setPieceSkills } from "../../lib/star/setPieces";
import { ruleFor, type StrikeDecision, type StrikeContext } from "../../lib/star/kindRules";
import { cornerRules, cornerContest } from "../../lib/star/kindRules/corner";
import { isSwitchedOff } from "../../lib/star/switchedOffKinds";
import { CX, POST_L, POST_R, BOX_DEPTH } from "../../lib/star/pitch";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 180; // CanvasMatch: 3 substeps of a 60 fps frame

// kindRules/index.ts's setupKind / strikeKind / stepKind / replayStrike, line
// for line, called on the corner module directly: under tsx, index.ts's own
// "./corner" import can load a second copy of the module, and cornerContest
// must read the same copy the strike was played through.
const setupKind = (sc: Scenario, rng: () => number, ctx: Parameters<NonNullable<typeof cornerRules.setup>>[2]) => cornerRules.setup!(sc, rng, ctx);
function strikeKind(sc: Scenario, ball: Ball, rand: () => number, ctx: StrikeContext): StrikeDecision | null {
  const draws = Array.from({ length: cornerRules.draws ?? 4 }, () => rand());
  const d = cornerRules.decide!(sc, ball, draws, ctx);
  if (d) cornerRules.apply?.(sc, ball, d);
  return d;
}
const stepKind = (sc: Scenario, ball: Ball, dt: number, d: StrikeDecision | null) => { if (d) cornerRules.step?.(sc, ball, dt, d); };
const replayStrike = (sc: Scenario, ball: Ball, d: StrikeDecision) => cornerRules.apply?.(sc, ball, d);
const seedOf = (i: number) => i * 7919 + 13;

/** The corner exactly as the match serves it (CanvasMatch.loadScenario). */
function served(seed: number, memory: string[]) {
  const rng = mulberry32(seed);
  const sc = buildScenario("corner", rng, 62, 60, 55);
  const shape = nextAuthoredShape("corner", rng, memory);
  if (shape) {
    applyAuthoredShape(sc, shape);
    memory.push(shape.sourceId);
    if (memory.length > 3) memory.shift();
  }
  const attackersBefore = attackers(sc).length;
  const defendersBefore = sc.defenders.map(d => ({ x: d.x, y: d.y }));
  setupKind(sc, rng, { appliedAuthored: !!shape, appliedPlan: false, keeperStrength: 62 });
  initDefenders(sc, rng);
  return { sc, attackersBefore, defendersBefore };
}

function attackers(sc: Scenario): Vec2[] {
  const out: Vec2[] = [];
  if (sc.runner) out.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) out.push(r.pos);
  if (goalInView(sc.kind)) out.push(sc.follower);
  for (const t of sc.teammates) out.push(t);
  return out;
}

// ── 1. THE PICTURE ───────────────────────────────────────────────────────────
{
  const N = 600, mem: string[] = [];
  let movedFar = 0;
  let outnumbered = 0, tight = 0, post = 0, byKeeper = 0, kindOk = 0, offside = 0, tooNear = 0, outOfView = 0, behindLine = 0, moved = 0;
  for (let i = 0; i < N; i++) {
    const { sc, defendersBefore } = served(seedOf(i), mem);
    const att = attackers(sc);
    if (sc.defenders.length >= att.length) outnumbered++;
    const t = sc.runner!.pos;
    if (sc.defenders.some(d => Math.hypot(d.x - t.x, d.y - t.y) <= 1.5 && d.y <= t.y + 0.3)) tight++;
    const side = sc.ball.x >= CX ? 1 : -1;
    const nearPost = side > 0 ? POST_R : POST_L;
    if (sc.defenders.some(d => d.y < 2.2 && Math.abs(d.x - nearPost) < 1.6)) post++;
    if (sc.defenders.some(d => Math.hypot(d.x - sc.keeper.x, d.y - sc.keeper.y) < 3.2)) byKeeper++;
    if (sc.kind === "corner" && !isSwitchedOff(sc.kind)) kindOk++;
    // A flick-on would judge offside against the second-last opponent.
    const ys = [...sc.defenders.map(d => d.y), sc.keeper.y].sort((a, b) => a - b);
    if (att.some(m => m.y < ys[1] - 0.01 && m.y < sc.ball.y - 0.01)) offside++;
    // Men brought in: 9.15 m from the kick, on the pitch, in the picture.
    sc.defenders.slice(defendersBefore.length).forEach(d => {
      if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 9.15) tooNear++;
      if (d.y < 0.3) behindLine++;
      const vp = sc.viewport;
      if (d.x < vp.x1 || d.x > vp.x2 || d.y > vp.y2) outOfView++;
    });
    // The drawn defence stays where it was drawn, bar one spare man who is
    // sent to mark the target — and he comes from close by.
    let movedHere = 0;
    defendersBefore.forEach((p, k) => {
      const r = Math.hypot(sc.defenders[k].x - p.x, sc.defenders[k].y - p.y);
      if (r > 1e-9) { movedHere++; movedFar = Math.max(movedFar, r); }
    });
    moved = Math.max(moved, movedHere);
  }
  console.log(`  picture: def ≥ att ${pct(outnumbered, N)} · target marked tight & goal-side ${pct(tight, N)} · near-post man ${pct(post, N)} · body by keeper ${pct(byKeeper, N)} · offside ${offside}`);
  check(outnumbered === N, `defenders match or outnumber attackers in every picture (${outnumbered}/${N}; before the rule 0%)`);
  check(tight / N >= 0.85, `the target has a man within 1.5 m and goal-side of him (${pct(tight, N)}; before 12%)`);
  check(post / N >= 0.95, `a man on the near post (${pct(post, N)}; before 31%)`);
  check(byKeeper / N >= 0.95, `a body in front of the keeper (${pct(byKeeper, N)})`);
  check(kindOk === N, `the chance stays a corner and never a switched-off kind (${kindOk}/${N})`);
  check(offside === 0, `no attacker beyond the second-last opponent (${offside})`);
  check(tooNear === 0 && behindLine === 0 && outOfView === 0,
    `every man brought in is 9.15 m from the ball, on the pitch and in the picture (near ${tooNear}, behind ${behindLine}, out of view ${outOfView})`);
  check(moved <= 1 && movedFar <= 7.5, `at most one drawn defender is moved, and not far (most in one picture ${moved}, furthest ${movedFar.toFixed(1)} m)`);
}

// ── 2. THE FUNNEL ────────────────────────────────────────────────────────────

type Level = "ordinary" | "good";
interface Tally {
  n: number; reached: number; shots: number; goals: number; reachedGoals: number;
  first: Record<string, number>;
  decided: Record<string, number>; decidedAndHappened: Record<string, number>;
  maxDefStep: number; maxKeeperStep: number; maxJump: number;
  defenceLostToMate: number;
}

function skillsFor(d: Level): KickSkills {
  const base = d === "ordinary" ? { power: 45, technique: 45 } : { power: 80, technique: 80 };
  return setPieceSkills(base, d === "ordinary" ? 40 : 85, "corner");
}

function giveHeaderTakers(sc: Scenario, h: Level) {
  const v = h === "ordinary" ? 55 : 85;
  const who = { id: "h", name: "H", shortName: "H", position: "CB", shooting: v, overall: v, physical: v };
  if (sc.runner) sc.runner.who = who;
  for (const r of sc.secondaryRunners) r.who = who;
  sc.follower.who = who;
}

/** A delivery aimed at the target: driven (low contact) or lofted (under the ball). */
function deliver(sc: Scenario, seed: number, lofted: boolean, sk: KickSkills): { ball: Ball; rng: () => number } {
  const rng = mulberry32(seed * 31 + 7);
  const tgt = sc.runner!.pos;
  const d = Math.hypot(tgt.x - sc.ball.x, tgt.y - sc.ball.y);
  const dir = { x: tgt.x - sc.ball.x + (rng() - 0.5), y: tgt.y - sc.ball.y + (rng() - 0.5) };
  const power = Math.min(0.95, 0.2 + d / 32) * (0.92 + rng() * 0.16);
  const contact = { cx: (rng() - 0.5) * 0.6, cy: lofted ? 0.2 + rng() * 0.6 : -0.1 - rng() * 0.4 };
  return { ball: launch(sc, dir, power, contact, sk, rng), rng };
}

interface Flight { res: Outcome | null; first: string; reached: boolean; shot: boolean; ball: Ball }

function fly(sc: Scenario, ball: Ball, rng: () => number, kd: StrikeDecision | null, t?: Tally): Flight {
  let facing = sc.facing ?? "up";
  let res: Outcome | null = null, first: string | null = null, shot = false;
  const saves0 = sc.keeper.saves;
  for (let i = 0; i < 4000 && !res; i++) {
    if (facing !== "up" && sc.crossSwitchView) {
      const v = sc.crossSwitchView;
      if (ball.pos.y < (sc.crossSwitchY ?? 0) && ball.pos.x > v.x1 - 1 && ball.pos.x < v.x2 + 1) {
        facing = "up"; sc.viewport = { ...v };
      }
    }
    const before = sc.defenders.map(d => ({ x: d.x, y: d.y }));
    const kBefore = { x: sc.keeper.x, y: sc.keeper.y };
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    stepKind(sc, ball, DT, kd);
    if (t && !first) {
      // Measured across the whole of this frame's movers — the engine's own
      // reactions (2.6 m/s) plus the rule's run — before the ball has been touched.
      sc.defenders.forEach((d, k) => {
        t.maxDefStep = Math.max(t.maxDefStep, Math.hypot(d.x - before[k].x, d.y - before[k].y) / DT);
        t.maxJump = Math.max(t.maxJump, d.z ?? 0);
      });
      t.maxKeeperStep = Math.max(t.maxKeeperStep, Math.hypot(sc.keeper.x - kBefore.x, sc.keeper.y - kBefore.y) / DT);
    }
    const reachedBefore = !!sc.receiverReached, shotsBefore = sc.receiverShots ?? 0, touch = ball.lastTouch;
    res = stepBall(ball, sc, rng, DT);
    if (!first) {
      if (!reachedBefore && sc.receiverReached) first = "mate";
      else if (sc.keeper.saves > saves0) first = "keeper";
      else if (touch !== "defence" && ball.lastTouch === "defence") first = "defender";
      else if (res === "tackled" || res === "blocked") first = "defender";
      else if (res) first = res === "goal" ? "direct" : "out";
    }
    if ((sc.receiverShots ?? 0) > shotsBefore) shot = true;
  }
  return { res, first: first ?? "none", reached: first === "mate", shot, ball };
}

function funnel(deliverer: Level, taker: Level, lofted: boolean, N: number): Tally {
  const t: Tally = { n: 0, reached: 0, shots: 0, goals: 0, reachedGoals: 0, first: {}, decided: {}, decidedAndHappened: {}, maxDefStep: 0, maxKeeperStep: 0, maxJump: 0, defenceLostToMate: 0 };
  const mem: string[] = [];
  const sk = skillsFor(deliverer);
  for (let i = 0; i < N; i++) {
    const seed = seedOf(i);
    const { sc } = served(seed, mem);
    giveHeaderTakers(sc, taker);
    const { ball, rng } = deliver(sc, seed, lofted, sk);
    const kd = strikeKind(sc, ball, mulberry32(seed ^ 0x6b1d), { keeperStrength: 62, power: sk.power, technique: sk.technique });
    const f = fly(sc, ball, rng, kd, t);
    t.n++;
    t.first[f.first] = (t.first[f.first] ?? 0) + 1;
    const o = cornerContest(kd)?.outcome ?? "unread";
    t.decided[o] = (t.decided[o] ?? 0) + 1;
    if ((o === "defender" || o === "keeper" || o === "mate") && f.first === o) t.decidedAndHappened[o] = (t.decidedAndHappened[o] ?? 0) + 1;
    if ((o === "defender" || o === "keeper") && f.first === "mate") t.defenceLostToMate++;
    if (f.reached) t.reached++;
    if (f.shot) t.shots++;
    const scored = f.res === "goal" || f.res === "rebound";
    if (scored) { t.goals++; if (f.reached) t.reachedGoals++; }
  }
  return t;
}

const N = 700;
const rows: Record<string, Tally> = {};
for (const lofted of [false, true])
  for (const deliverer of ["ordinary", "good"] as Level[])
    for (const taker of ["ordinary", "good"] as Level[])
      rows[`${lofted ? "lofted" : "driven"}/${deliverer}/${taker}`] = funnel(deliverer, taker, lofted, N);

const sum = (keys: string[], f: (t: Tally) => number) => keys.reduce((s, k) => s + f(rows[k]), 0);
const keysWhere = (p: (k: string) => boolean) => Object.keys(rows).filter(p);
const all = Object.keys(rows);
const rate = (keys: string[], f: (t: Tally) => number) => sum(keys, f) / sum(keys, t => t.n);

for (const [k, t] of Object.entries(rows)) {
  console.log(`  ${k.padEnd(24)} reached ${pct(t.reached, t.n).padStart(6)} · goal ${pct(t.goals, t.n).padStart(5)} · goal once reached ${pct(t.reachedGoals, t.reached).padStart(6)} · first: ${Object.entries(t.first).sort((a, b) => b[1] - a[1]).map(([f, v]) => `${f} ${pct(v, t.n)}`).join(" ")}`);
}

{
  const reach = rate(all, t => t.reached), goal = rate(all, t => t.goals);
  check(reach >= 0.18 && reach <= 0.32, `about 3 in 10 deliveries (or fewer) reach a team-mate (${(reach * 100).toFixed(1)}%; before 62-75%)`);
  check(goal >= 0.025 && goal <= 0.065, `a corner produces a goal a few times in a hundred (${(goal * 100).toFixed(1)}%; before 13-21%)`);
  const cleared = rate(all, t => (t.first.defender ?? 0) + (t.first.keeper ?? 0));
  check(cleared >= 0.45, `most deliveries are cleared, blocked or claimed first (${(cleared * 100).toFixed(1)}%)`);
  const keeper = rate(all, t => t.first.keeper ?? 0);
  check(keeper > 0.005, `the keeper comes and claims some (${(keeper * 100).toFixed(1)}%; before ~0.3%)`);

  const ord = keysWhere(k => k.includes("/ordinary/ordinary"));
  const best = keysWhere(k => k.includes("/good/good"));
  const ordGoal = rate(ord, t => t.goals), bestGoal = rate(best, t => t.goals);
  check(ordGoal >= 0.015 && ordGoal <= 0.05, `an ordinary deliverer to an ordinary header scores ${(ordGoal * 100).toFixed(1)}% (target 3-4%)`);
  check(bestGoal > ordGoal * 1.5, `a good deliverer to a good header clearly does better (${(bestGoal * 100).toFixed(1)}% vs ${(ordGoal * 100).toFixed(1)}%)`);
  const bestConv = sum(best, t => t.reachedGoals) / sum(best, t => t.reached);
  check(bestConv >= 0.13 && bestConv <= 0.33, `for a good side about 1 in 5 balls that reach the head go in (${(bestConv * 100).toFixed(1)}%)`);

  // Each lever on its own.
  const goodDel = keysWhere(k => k.includes("/good/")), ordDel = keysWhere(k => k.includes("/ordinary/"));
  check(rate(goodDel, t => t.reached) > rate(ordDel, t => t.reached) + 0.02,
    `a better deliverer reaches his man more often (${pct(sum(goodDel, t => t.reached), sum(goodDel, t => t.n))} vs ${pct(sum(ordDel, t => t.reached), sum(ordDel, t => t.n))})`);
  const goodTaker = keysWhere(k => k.endsWith("/good")), ordTaker = keysWhere(k => k.endsWith("/ordinary"));
  check(rate(goodTaker, t => t.reached) > rate(ordTaker, t => t.reached) + 0.02,
    `a stronger header of the ball wins it more often (${pct(sum(goodTaker, t => t.reached), sum(goodTaker, t => t.n))} vs ${pct(sum(ordTaker, t => t.reached), sum(ordTaker, t => t.n))})`);

  // What was decided at the strike is what the pitch shows.
  // (The keeper's misses are almost all a defender standing in the flight
  // who gets a head to it first — still the defence's ball.)
  for (const [o, bar] of [["defender", 0.93], ["keeper", 0.8]] as const) {
    const dec = sum(all, t => t.decided[o] ?? 0), hap = sum(all, t => t.decidedAndHappened[o] ?? 0);
    check(dec > 0 && hap / dec >= bar, `a ${o} who is given the ball gets there first (${hap}/${dec})`);
  }
  const lost = sum(all, t => (t.decided.defender ?? 0) + (t.decided.keeper ?? 0) - (t.decidedAndHappened.defender ?? 0) - (t.decidedAndHappened.keeper ?? 0));
  const toMate = sum(all, t => t.defenceLostToMate);
  check(toMate <= Math.max(3, lost * 0.5), `a ball the defence was given rarely reaches a team-mate first (${toMate} times)`);

  // A footballer's pace, never a teleport. The engine's own reactions add up
  // to 2.6 m/s on top of the rule's run for a man it has also set moving.
  const defStep = Math.max(...all.map(k => rows[k].maxDefStep));
  const kStep = Math.max(...all.map(k => rows[k].maxKeeperStep));
  const jump = Math.max(...all.map(k => rows[k].maxJump));
  console.log(`  pace: fastest defender ${defStep.toFixed(2)} m/s · fastest keeper ${kStep.toFixed(2)} m/s · highest jump ${jump.toFixed(2)} m · reached ${(reach * 100).toFixed(1)}% · goal ${(goal * 100).toFixed(1)}% · cleared/claimed first ${(cleared * 100).toFixed(1)}% · keeper first ${(keeper * 100).toFixed(1)}%`);
  check(defStep <= 7.0 + 1e-6, `no defender moves faster than a 7 m/s sprint in flight (max ${defStep.toFixed(2)} m/s)`);
  check(kStep <= 7.0 + 1e-6, `the keeper comes off his line at no more than 7 m/s (max ${kStep.toFixed(2)} m/s)`);
  check(jump <= 0.81, `a defender's jump stays human (max ${jump.toFixed(2)} m off the ground)`);
}

// ── 3. A SAVED GOAL REPLAYS THE SAME WAY ─────────────────────────────────────
{
  const sk = skillsFor("good");
  let tried = 0, same = 0;
  const mem: string[] = [];
  for (let i = 0; i < 400 && tried < 120; i++) {
    const seed = seedOf(i);
    const memBefore = [...mem];
    const live = served(seed, mem);
    giveHeaderTakers(live.sc, "good");
    const snapshot = JSON.parse(JSON.stringify(live.sc)) as Scenario;
    const a = deliver(live.sc, seed, true, sk);
    const kd = strikeKind(live.sc, a.ball, mulberry32(seed ^ 0x6b1d), { keeperStrength: 62, power: sk.power, technique: sk.technique });
    const fa = fly(live.sc, a.ball, a.rng, kd);
    const won = cornerContest(kd)?.outcome;
    if (won !== "defender" && won !== "keeper") continue;
    tried++;
    // The replay: the scenario as it was at the strike, the same kick, and
    // the decision as it was saved (through JSON, as a replay stores it).
    const saved = JSON.parse(JSON.stringify(kd)) as StrikeDecision;
    void memBefore;
    const b = deliver(snapshot, seed, true, sk);
    replayStrike(snapshot, b.ball, saved);
    const fb = fly(snapshot, b.ball, b.rng, saved);
    if (fa.res === fb.res && fa.first === fb.first
        && Math.abs(fa.ball.pos.x - fb.ball.pos.x) < 1e-9 && Math.abs(fa.ball.pos.y - fb.ball.pos.y) < 1e-9) same++;
  }
  console.log(`  replay: ${same}/${tried} contested corners replay exactly`);
  check(tried >= 40, `enough contested corners to replay (${tried})`);
  check(same === tried, `every contested corner replays exactly (${same}/${tried})`);
}

// The index routes corners to this ruleset (and nothing else to it).
check(typeof ruleFor("corner")?.step === "function" && ruleFor("header") === undefined, "kindRules sends a corner to the corner ruleset");

void BOX_DEPTH;
if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — corners: the defence outnumbers the attack and marks the target, most deliveries are cleared or claimed, about 1 in 5 reaches the head of a team-mate, a few in a hundred go in, delivery and heading quality both move the odds, and a saved goal replays the same way");
