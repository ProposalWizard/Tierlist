/**
 * THE GIVE-AND-GO (v0.25, point 49): in a picture with no goal, how often does
 * a completed pass come back to you?
 *
 * Every pass is played through the real engine (launch → stepBall), aimed at
 * one of the men on offer, over 500 midfield passes and 500 build-ups. A pass
 * that reaches its man is scored three ways: v0.23's chainReturnChance, v0.24's
 * "always", and v0.25's giveAndGoChance. Each return is ROLLED, so the numbers
 * are counts out of the passes that arrived.
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepReactions, stepDefenders,
  chainReturnChance, type Scenario, type Runner, type Ball, type ScenarioKind, type Outcome,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { giveAndGoChance, wasForwardPass, GIVE_AND_GO_FORWARD, GIVE_AND_GO_SAFE } from "@/lib/star/giveAndGo";

let failed = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? "  ✓" : "  ✗"} ${m}`); if (!c) failed++; };
const DT = 1 / 120;

function passTo(sc: Scenario, to: Runner, rng: () => number): Ball {
  const dx = to.pos.x - sc.ball.x, dy = to.pos.y - sc.ball.y;
  const d = Math.hypot(dx, dy) || 1;
  const ball = launch(sc, { x: dx, y: dy }, 0.5, { cx: 0, cy: 0 }, { power: 70, technique: 70 }, rng);
  ball.vel = { x: (dx / d) * 16, y: (dy / d) * 16 };
  ball.vz = 0; ball.z = 0.08; ball.spin = 0;
  ball.shot = false; ball.youStruckAtGoal = false;
  return ball;
}

type Row = { forward: boolean; old: number; v24: number; v25: number };
const rows: Row[] = [];
const roll = mulberry32(4242);
for (const kind of ["midfield_pass", "buildup"] as ScenarioKind[]) {
  for (let s = 0; s < 500; s++) {
    const pick = mulberry32(7000 + s * 13);
    const rng = mulberry32(9000 + s * 31);
    const sc = buildScenario(kind, rng, 65, 60, 60);
    initDefenders(sc, rng);
    const options = [sc.runner, ...sc.secondaryRunners].filter(Boolean) as Runner[];
    if (!options.length) continue;
    const to = options[Math.floor(pick() * options.length)];
    const ball = passTo(sc, to, rng);
    let res: Outcome | null = null;
    for (let t = 0; t < 12 / DT && !res; t++) {
      stepDefenders(sc, DT, sc.player, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      res = stepBall(ball, sc, rng, DT);
    }
    if (res !== "delivered") continue;
    const at = sc.receivedAt ?? sc.runner?.pos ?? sc.passTarget;
    if (!at) continue;
    rows.push({
      forward: wasForwardPass(sc, at),
      old: roll() < chainReturnChance(sc) ? 1 : 0,
      v24: 1,
      v25: roll() < giveAndGoChance(sc, at) ? 1 : 0,
    });
  }
}
const sum = (xs: Row[], k: "old" | "v24" | "v25") => xs.reduce((a, r) => a + r[k], 0);
const pct = (xs: Row[], k: "old" | "v24" | "v25") =>
  `${sum(xs, k)}/${xs.length} (${(100 * sum(xs, k) / Math.max(1, xs.length)).toFixed(1)}%)`;
const fwd = rows.filter((r) => r.forward), safe = rows.filter((r) => !r.forward);
console.log(`\nPasses that arrived: ${rows.length} (forward ${fwd.length}, sideways/back ${safe.length})`);
console.log(`              v0.23 (old)        v0.24 (always)     v0.25 (new)`);
console.log(`forward       ${pct(fwd, "old").padEnd(18)} ${pct(fwd, "v24").padEnd(18)} ${pct(fwd, "v25")}`);
console.log(`side/back     ${pct(safe, "old").padEnd(18)} ${pct(safe, "v24").padEnd(18)} ${pct(safe, "v25")}`);
console.log(`all           ${pct(rows, "old").padEnd(18)} ${pct(rows, "v24").padEnd(18)} ${pct(rows, "v25")}\n`);

ok(rows.length >= 400, `at least 400 passes arrived (${rows.length})`);
const f = sum(fwd, "v25") / Math.max(1, fwd.length);
const b = sum(safe, "v25") / Math.max(1, safe.length);
ok(fwd.length >= 100 && f >= 0.88 && f <= 0.96, `a forward pass comes back about ${GIVE_AND_GO_FORWARD * 100} in 100 (${(f * 100).toFixed(1)}%)`);
ok(safe.length >= 50 && b >= 0.5 && b <= 0.7, `a sideways/back pass comes back about ${GIVE_AND_GO_SAFE * 100} in 100 (${(b * 100).toFixed(1)}%)`);
ok(giveAndGoChance({ ball: { x: 30, y: 50 } }, { x: 30, y: 40 }) === GIVE_AND_GO_FORWARD, "10 m forward is a forward pass");
ok(giveAndGoChance({ ball: { x: 30, y: 50 } }, { x: 30, y: 52 }) === GIVE_AND_GO_SAFE, "2 m back is a safe pass");
ok(giveAndGoChance({ ball: { x: 30, y: 50 } }, { x: 40, y: 49 }) === GIVE_AND_GO_SAFE, "a 1 m-forward square ball is a safe pass");

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASSED");
