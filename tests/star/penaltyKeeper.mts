/**
 * THE PENALTY KEEPER READS YOUR KICK — measured on the real engine.
 *
 * Every penalty is struck exactly the way CanvasMatch strikes one (launch at
 * a chosen aim, then the same per-substep loop), with the keeper's read
 * applied at the strike through lib/star/penaltyKeeper.ts. Prints the table
 * the defaults were chosen from, then checks the shape Harry asked for:
 *   - the corner stops being a near-certainty (92 % before);
 *   - the middle stays the worst place to aim, so placement still matters;
 *   - a better read (a harder trial) makes it measurably harder;
 *   - he never moves before the strike.
 *
 * Run: npx tsx tests/star/penaltyKeeper.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import {
  penaltyReadFor, decidePenaltyRead, applyPenaltyRead, PENALTY_READ_DEFAULT,
  type PenaltyReadSettings,
} from "../../lib/star/penaltyKeeper";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

/** One penalty. aimOff: metres from the centre of goal on the line. */
function penalty(seed: number, aimOff: number, read: PenaltyReadSettings | null, keeperStrength = 62): string {
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, keeperStrength, 60, 55);
  initDefenders(sc, rng);
  const cx = (sc.goal.x1 + sc.goal.x2) / 2;
  const tx = cx + aimOff + (rng() - 0.5) * 0.3, ty = 0;
  const dx = tx - sc.ball.x, dy = ty - sc.ball.y, L = Math.hypot(dx, dy);
  const ball = launch(sc, { x: dx / L, y: dy / L }, 0.72, { cx: 0, cy: 0.15 }, { power: 60, technique: 60 }, rng);
  if (read) {
    const r = mulberry32(seed ^ 0x5eed);
    applyPenaltyRead(sc, decidePenaltyRead(sc, ball, read, [r(), r()]));
  }
  let res: string | null = null;
  for (let t = 0; !res && t < 8; t += 1 / 180) {
    const h = 1 / 180;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    res = stepBall(ball, sc, rng, h);
  }
  return res ?? "none";
}

function rate(aimOff: number, read: PenaltyReadSettings | null, n = 400, ks = 62): number {
  let g = 0;
  for (let i = 0; i < n; i++) {
    // Both corners, so a side bias in the engine can't hide.
    const o = i % 2 ? aimOff : -aimOff;
    if (penalty(1000 + i * 7919, o, read, ks) === "goal") g++;
  }
  return g / n;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(6);

console.log("\nWHAT EACH SETTING DOES (goal %, n = 400 a cell, both corners)");
console.log("  setting                       corner(3.2m)  2m out   middle");
const rows: [string, PenaltyReadSettings | null][] = [
  ["before: he never moves", null],
  ["goes 80%, reads 50% (a guess)", { commitChance: 0.8, readChance: 0.5, metres: 1.4 }],
  ["goes 80%, reads 60%  DEFAULT", { commitChance: 0.8, readChance: 0.6, metres: 1.4 }],
  ["goes 80%, reads 70%", { commitChance: 0.8, readChance: 0.7, metres: 1.4 }],
  ["goes 95%, reads 70% (hard)", { commitChance: 0.95, readChance: 0.7, metres: 1.4 }],
];
const table: Record<string, number[]> = {};
for (const [name, s] of rows) {
  const r = [rate(3.2, s), rate(2.0, s), rate(0, s)];
  table[name] = r;
  console.log(`  ${name.padEnd(30)} ${pct(r[0])}      ${pct(r[1])}  ${pct(r[2])}`);
}

const before = table["before: he never moves"];
const def = table["goes 80%, reads 60%  DEFAULT"];
const hard = table["goes 95%, reads 70% (hard)"];

console.log("\nTHE SHAPE");
ok(before[0] > 0.85, `before: the corner is near-certain (${pct(before[0])}) — the problem being fixed`);
ok(def[0] < before[0] - 0.1, `with the read, the corner converts less (${pct(before[0])} → ${pct(def[0])})`);
ok(def[0] > 0.55 && def[0] < 0.85, `…but a good corner is still usually a goal (${pct(def[0])})`);
ok(def[2] < def[1] && def[2] < def[0], `the middle is still the worst place to aim (${pct(def[2])})`);
ok(hard[0] < def[0], `a harder read (the trial's dial) is measurably harder (${pct(def[0])} → ${pct(hard[0])})`);

console.log("\nTHE DIALS");
{
  const lo = penaltyReadFor(40), mid = penaltyReadFor(62), hi = penaltyReadFor(95);
  ok(lo.readChance < mid.readChance && mid.readChance < hi.readChance, `a better keeper reads better (${lo.readChance.toFixed(2)} < ${mid.readChance.toFixed(2)} < ${hi.readChance.toFixed(2)})`);
  ok(lo.readChance >= 0.5 && hi.readChance <= 0.85, "never worse than a coin flip, never a certainty");
  ok(mid.commitChance === PENALTY_READ_DEFAULT.commitChance, "a typical keeper is the default");
  ok(penaltyReadFor(62, { readChance: 0.9 }).readChance === 0.9, "an override (a harder trial rep) replaces a dial");
  ok(penaltyReadFor(62, { metres: 99 }).metres <= 3.2, "…within the engine's own reach along the line");
}

console.log("\nHE NEVER MOVES BEFORE THE STRIKE");
{
  const rng = mulberry32(42);
  const sc = buildScenario("penalty", rng, 62, 60, 55);
  initDefenders(sc, rng);
  const x0 = sc.keeper.x;
  for (let i = 0; i < 180; i++) stepKeeper(sc, 1 / 60);
  ok(Math.abs(sc.keeper.x - sc.keeper.startX) < 0.6 && !sc.keeper.scrambling,
    `three seconds of aiming: he's still set in the middle (moved ${Math.abs(sc.keeper.x - x0).toFixed(2)} m, not diving)`);
  const d = decidePenaltyRead(sc, { pos: sc.ball, vel: { x: 3, y: -25 } } as never, PENALTY_READ_DEFAULT, [0.99, 0]);
  ok(!d.went, "when the first roll says stay, he stays");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
