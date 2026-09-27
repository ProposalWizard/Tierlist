/**
 * PENALTY AND FREE-KICK RUN-UP STYLES — measured on the real engine.
 *
 * A style (lib/star/runupStyles.ts) is looks only. Every penalty here is
 * struck the way CanvasMatch strikes one (the harness in penaltyRunup.mts):
 * Harry's penalty rules on the picture, the taker standing back where HIS
 * style starts, the keeper brain for this keeper, a moment of aiming, then
 * the style's own run-up — its own length, path and pace, the keeper brain's
 * `brainRunUp` every frame — then launch(), `brainStrike` and the 180 Hz loop.
 *
 * Pinned:
 *   - the contract: every id, in order, Standard the free default;
 *   - scoring (keeper 62, 1,500 kicks, the same seeds and the same kicks for
 *     every style) is within 1 point of Standard's for every style;
 *   - release → strike screen is 1.5–3.2 s for every style, and Standard is
 *     exactly penaltyRunup.ts's run-up (same path, same 2.4 s);
 *   - every run ends with the standing foot beside the ball, starts behind
 *     it, stays inside the picture, and the styles really do differ;
 *   - a team-mate's or an opponent's style is the same every time for the
 *     same player, and the squad spreads across the styles.
 *
 * Run: npx tsx tests/star/runupStyles.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  type Scenario, type Vec2,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { enforceHardRules } from "../../lib/star/kindRules";
import { brainSetup, brainAim, brainRunUp, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import { penaltyReadFor } from "../../lib/star/penaltyKeeper";
import { RUNUP, runupPath, playerAt, standBack, plantBeside, goalLineX } from "../../lib/star/penaltyRunup";
import {
  RUNUP_STYLES, DEFAULT_RUNUP_STYLE, RUNUP_MOTION, runupStyleOf, isRunupStyleId, ownsRunupStyle, ownedRunupStyles,
  takerRunupStyle, standBackFor, planRunup, runupPositionAt, runupPoseAt, runupProgress, type RunupStyleId,
} from "../../lib/star/runupStyles";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE CONTRACT");
{
  const want: RunupStyleId[] = ["standard", "stroll", "skip", "sprint", "stutter", "two_step", "arc"];
  ok(RUNUP_STYLES.map((s) => s.id).join() === want.join(), `the seven ids, in order (${RUNUP_STYLES.map((s) => s.id).join(", ")})`);
  const names = ["Standard", "The Stroll", "The Skip", "The Sprint", "Stutter Step", "Two Steps", "The Arc"];
  ok(RUNUP_STYLES.map((s) => s.name).join() === names.join(), "their on-screen names");
  ok(RUNUP_STYLES.every((s) => s.blurb.length > 0), "every one has a line to show in the shop");
  ok(DEFAULT_RUNUP_STYLE === "standard", "Standard is the default");
  ok(runupStyleOf(undefined) === "standard" && runupStyleOf("moonwalk") === "standard" && runupStyleOf("skip") === "skip", "an old save or an unknown id reads as Standard");
  ok(isRunupStyleId("arc") && !isRunupStyleId("Arc"), "ids are exact");
  ok(ownsRunupStyle(undefined, "standard") && !ownsRunupStyle(undefined, "skip") && ownsRunupStyle(["skip"], "skip"), "Standard is always owned; the rest only once unlocked");
  ok(ownedRunupStyles(["arc", "stroll"]).map((s) => s.id).join() === "standard,stroll,arc", "Settings lists Standard plus what you own, in shop order");
  ok(want.every((id) => RUNUP_MOTION[id] !== undefined), "every style has its movement");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nHOW LONG, AND WHERE");
{
  for (const s of RUNUP_STYLES) {
    const T = RUNUP_MOTION[s.id].runS;
    ok(T >= 1.5 && T <= 3.2, `${s.name}: letting go → strike screen ${T.toFixed(1)} s (1.5–3.2)`);
  }
  // Standard IS penaltyRunup.ts's run-up.
  const ball = { x: 34, y: 11 }, drawn = { x: 34, y: 12.8 };
  const sb = standBackFor("standard", ball, drawn);
  const old = standBack(ball, drawn);
  ok(dist(sb, old) < 1e-12 && RUNUP_MOTION.standard.runS === RUNUP.runupS, "Standard stands exactly where it always did, for exactly 2.4 s");
  const r = planRunup("standard", ball, sb), p = runupPath(ball, drawn);
  let same = true;
  for (let t = 0; t <= RUNUP.runupS; t += 0.05) if (dist(runupPositionAt(r, t), playerAt(p, t / RUNUP.runupS)) > 1e-12) same = false;
  ok(same && runupPoseAt(r, 1) === null, "…jogs the same path at the same pace, with the match's own running figure");

  // Every style: starts behind the ball, ends beside it, in the picture.
  const view = { x1: 12, x2: 56, y1: -3.7, y2: 38.3 };
  const fk = { x: 42, y: 27 }, fkView = { x1: 18, x2: 60, y1: -4, y2: 33 };
  for (const s of RUNUP_STYLES) {
    const from = standBackFor(s.id, ball, drawn, view);
    const plan = planRunup(s.id, ball, from);
    const T = RUNUP_MOTION[s.id].runS;
    const end = runupPositionAt(plan, T), start = runupPositionAt(plan, 0);
    const beside = dist(end, plantBeside(ball, from)) < 1e-9 && dist(end, ball) < 0.7;
    ok(beside && dist(start, from) < 1e-9 && from.y > ball.y - 0.5, `${s.name}: from ${dist(from, ball).toFixed(1)} m back, ends with his standing foot beside the ball`);
    const f = standBackFor(s.id, fk, { x: 42, y: 28 }, fkView);
    const inside = f.x >= fkView.x1 + 1.5 && f.x <= fkView.x2 - 1.5 && f.y <= fkView.y2 - 1.5;
    ok(inside, `${s.name}: a free kick from 27 m still starts on screen (${f.x.toFixed(1)}, ${f.y.toFixed(1)})`);
  }

  // They really differ: start distance, time, and what the body does.
  const froms = RUNUP_STYLES.map((s) => dist(standBackFor(s.id, ball, drawn, view), ball));
  ok(Math.max(...froms) > 2.5 * Math.min(...froms), `start distances range ${Math.min(...froms).toFixed(1)}–${Math.max(...froms).toFixed(1)} m`);
  const plan = (id: RunupStyleId) => planRunup(id, ball, standBackFor(id, ball, drawn, view));
  const maxOf = (id: RunupStyleId, f: (p: NonNullable<ReturnType<typeof runupPoseAt>>) => number) => {
    let m = 0; const pl = plan(id);
    for (let t = 0; t <= RUNUP_MOTION[id].runS; t += 0.01) { const p = runupPoseAt(pl, t); if (p) m = Math.max(m, f(p)); }
    return m;
  };
  ok(maxOf("skip", (p) => p.lift) > 0.2 && RUNUP_STYLES.every((s) => s.id === "skip" || maxOf(s.id, (p) => p.lift) === 0), "only The Skip leaves the ground");
  ok(maxOf("sprint", (p) => p.crouch) > 0.4 && maxOf("sprint", (p) => Math.abs(p.legSwing)) > 1.2, "The Sprint runs low with the longest stride");
  ok(maxOf("stroll", (p) => Math.abs(p.legSwing)) < 0.45, "The Stroll takes short walking steps");
  ok(maxOf("arc", (p) => Math.abs(p.lean)) > 0.25, "The Arc leans into the bend");
  // The stutter's pause: barely moves for most of a second.
  const moved = runupProgress("stutter", 2.1) - runupProgress("stutter", 1.2);
  ok(moved < 0.05, `Stutter Step stops dead for ~1 s (${(moved * 100).toFixed(1)}% of the run in 0.9 s)`);
  ok(runupProgress("two_step", 0.6) === 0, "Two Steps stands set before its two strides");
  // The arc is curved: its middle is well off the straight line.
  const a = plan("arc"), mid = runupPositionAt(a, RUNUP_MOTION.arc.runS / 2);
  const dx = a.to.x - a.from.x, dy = a.to.y - a.from.y, L = Math.hypot(dx, dy);
  const off = Math.abs((mid.x - a.from.x) * dy - (mid.y - a.from.y) * dx) / L;
  ok(off > 0.8, `The Arc bends: ${off.toFixed(2)} m off the straight line at halfway`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nWHO SCORES — the same for every style (keeper 62, 1,500 kicks, same seeds)");
interface Kick { off: number; power: number; cy: number }
function mixKick(rng: () => number): Kick {
  const u = rng(), side = rng() < 0.5 ? -1 : 1, p = 0.6 + rng() * 0.3, cy = -1 + rng() * 1.25;
  if (u < 0.7) return { off: side * (1.4 + 2.15 * Math.sqrt(rng())), power: p, cy };
  if (u < 0.9) return { off: (rng() - 0.5) * 0.8, power: p, cy };
  return { off: (rng() - 0.5) * 0.6, power: 0.4 + rng() * 0.05, cy: 0.3 + rng() * 0.45 };
}
function penalty(seed: number, k: Kick, style: RunupStyleId, ks = 62): boolean {
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, ks, 60, 55);
  enforceHardRules(sc);
  initDefenders(sc, rng);
  sc.player = standBackFor(style, sc.ball, sc.player, sc.viewport);
  brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { penalty: penaltyReadFor(ks) });
  for (let t = 0; t < 1.5; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); }
  const cx = (sc.goal.x1 + sc.goal.x2) / 2;
  const dx = cx + k.off - sc.ball.x, dy = 0 - sc.ball.y, L = Math.hypot(dx, dy);
  const dir: Vec2 = { x: dx / L, y: dy / L };
  const plan = planRunup(style, sc.ball, sc.player);
  const T = RUNUP_MOTION[style].runS;
  for (let t = 0; t < T; t += 1 / 60) {
    stepKeeper(sc, 1 / 60);
    brainRunUp(sc, 1 / 60, t + 1 / 60, goalLineX(sc.ball, dir));
    sc.player = runupPositionAt(plan, t + 1 / 60);
  }
  const ball = launch(sc, dir, k.power, { cx: 0, cy: k.cy }, { power: 60, technique: 60 }, rng);
  brainStrike(sc, ball, (seed ^ 0x5eed) >>> 0);
  let res: string | null = null;
  for (let t = 0; !res && t < 8; t += 1 / 180) {
    const h = 1 / 180;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    brainStep(sc, ball, h);
    res = stepBall(ball, sc, rng, h);
  }
  return (res === "goal" || res === "rebound") && !sc.follower.shot;
}
{
  const N = 1500;
  const rate = (style: RunupStyleId) => {
    let s = 0;
    for (let i = 0; i < N; i++) {
      const seed = 1000 + i * 7919;
      if (penalty(seed, mixKick(mulberry32((seed ^ 0xa11ce) >>> 0)), style)) s++;
    }
    return s / N;
  };
  const std = rate("standard");
  console.log(`  Standard ${pct(std)}`);
  ok(std >= 0.74 && std <= 0.81, `Standard still scores the real match's ~75-80 % (${pct(std)})`);
  for (const s of RUNUP_STYLES) {
    if (s.id === "standard") continue;
    const r = rate(s.id);
    ok(Math.abs(r - std) <= 0.01, `${s.name}: ${pct(r)} (Standard ${pct(std)}, within 1 point)`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTEAM-MATES AND OPPONENTS");
{
  const ids = Array.from({ length: 300 }, (_, i) => `sofifa-${200000 + i * 37}`);
  const first = ids.map(takerRunupStyle);
  const again = ids.map(takerRunupStyle);
  ok(first.join() === again.join(), "the same player always runs up the same way");
  ok(takerRunupStyle("Bruno Fernandes") === takerRunupStyle("Bruno Fernandes"), "…keyed by name too, when there's no id");
  ok(takerRunupStyle("") === "standard" && takerRunupStyle(undefined) === "standard", "nobody named: Standard");
  const counts = new Map<string, number>();
  for (const s of first) counts.set(s, (counts.get(s) ?? 0) + 1);
  const spread = RUNUP_STYLES.map((s) => `${s.id} ${counts.get(s.id) ?? 0}`).join(", ");
  console.log(`  300 players: ${spread}`);
  ok(RUNUP_STYLES.every((s) => (counts.get(s.id) ?? 0) >= 20), "a squad spreads across all seven styles");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
