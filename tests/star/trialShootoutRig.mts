/**
 * THE TRIAL'S SHOOTOUT RIG (Harry, 1 Oct 2026: "rigs the game so it always has
 * you having to score the winning pen").
 *
 * Two halves:
 *
 *  1. The rule, over every run you could possibly have (8 of them for three
 *     kicks): the score is LEVEL whenever your last kick is up, so that kick is
 *     the winning penalty; Academy never lead before it; and a goal on that
 *     kick wins it.
 *  2. The plans that rule hands the real engine, struck the way CanvasMatch
 *     strikes an automatic penalty (rules, run-up, keeper brain, launch()), at
 *     each keeper strength the shootout's ramp reaches: a "goal" plan goes in
 *     and a "miss" plan does not, essentially every time. A rig that the engine
 *     can disagree with would show a goal the score says was missed.
 *
 * Run: npx tsx tests/star/trialShootoutRig.mts
 */
import {
  createRig, rigApply, rigNextSide, rigTheirIntent, rigGoals, isWinningPenalty,
  winningPenaltyScored, rigPlanFor, rigKeeperRead, SHOOTOUT_KICKS, type RigState,
} from "../../lib/star/trialShootoutRig";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions, type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { enforceHardRules } from "../../lib/star/kindRules";
import { brainSetup, brainAim, brainRunUp, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import { RUNUP, runupPath, standBack, playerAt, goalLineX } from "../../lib/star/penaltyRunup";
import { aimFor, takerSkills, type PenaltyPlan } from "../../lib/star/penaltyTaking";
import { shootoutOurKeeperFor } from "../../lib/star/trialStages";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

console.log("\nTHE RULE, OVER EVERY RUN YOU COULD HAVE");
{
  ok(SHOOTOUT_KICKS === 3, `up to three kicks each (Harry's answer): ${SHOOTOUT_KICKS}`);
  let allLevel = true, neverBehind = true, winOnGoal = true, sixKicks = true, yoursLast = true;
  for (let mask = 0; mask < 1 << SHOOTOUT_KICKS; mask++) {
    let st: RigState = createRig();
    const yours = Array.from({ length: SHOOTOUT_KICKS }, (_, i) => !!(mask & (1 << i)));
    let yi = 0;
    while (!st.over) {
      const side = rigNextSide(st.kicks);
      if (side === "them") {
        st = rigApply(st, rigTheirIntent(st.kicks));
      } else {
        if (isWinningPenalty(st)) {
          allLevel &&= rigGoals(st.kicks, "you") === rigGoals(st.kicks, "them");
          const before = st;
          const wins = rigApply(before, true);
          winOnGoal &&= wins.winner === "you" && winningPenaltyScored(wins);
          const level = rigApply(before, false);
          winOnGoal &&= level.winner === null && !winningPenaltyScored(level);
        }
        st = rigApply(st, yours[yi++]);
      }
      neverBehind &&= rigGoals(st.kicks, "them") <= rigGoals(st.kicks, "you");
    }
    sixKicks &&= st.kicks.length === SHOOTOUT_KICKS * 2;
    yoursLast &&= st.kicks[st.kicks.length - 1].side === "you";
  }
  ok(allLevel, "the score is level every time your last kick is up (all 8 runs)");
  ok(winOnGoal, "scoring that kick wins the shootout; missing it leaves it level");
  ok(neverBehind, "Academy are never ahead of you");
  ok(sixKicks, "always three kicks each");
  ok(yoursLast, "the last kick of the shootout is always yours");

  // They equalise when you go ahead, and miss otherwise.
  let st = createRig();
  ok(rigTheirIntent(st.kicks) === false, "opening kick: they miss");
  st = rigApply(st, false);            // them: miss
  st = rigApply(st, true);             // you: score
  ok(rigTheirIntent(st.kicks) === true, "you scored: they equalise");
  st = rigApply(st, true);
  st = rigApply(st, false);            // you miss: level
  ok(rigTheirIntent(st.kicks) === false, "level: they miss");
}

console.log("\nTHE PLANS THE RIG HANDS THE REAL ENGINE");
function kick(seed: number, plan: PenaltyPlan, ks: number, read: { commitChance: number; readChance: number; metres: number }): string {
  const rating = 70;
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, ks, 60, 55);
  enforceHardRules(sc); initDefenders(sc, rng); sc.defenders = [];
  sc.player = standBack(sc.ball, sc.player);
  brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { penalty: read });
  for (let t = 0; t < 0.7; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); }
  const a = aimFor(sc, plan);
  const path = runupPath(sc.ball, sc.player);
  for (let t = 0; t < RUNUP.runupS; t += 1 / 60) {
    stepKeeper(sc, 1 / 60);
    brainRunUp(sc, 1 / 60, t + 1 / 60, goalLineX(sc.ball, a.dir));
    sc.player = playerAt(path, (t + 1 / 60) / RUNUP.runupS);
  }
  const ball = launch(sc, a.dir, a.power, a.contact, takerSkills(rating), rng);
  brainStrike(sc, ball, (seed ^ 0x5eed) >>> 0);
  let res: string | null = null;
  for (let t = 0; !res && t < 8; t += 1 / 180) {
    const h = 1 / 180;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, mulberry32(seed));
    brainStep(sc, ball, h);
    res = stepBall(ball, sc, rng, h);
  }
  return res ?? "none";
}
{
  const N = 200;
  for (let row = 0; row < SHOOTOUT_KICKS; row++) {
    const k = shootoutOurKeeperFor(row);
    let goals = 0, misses = 0;
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1;
      const g = kick(4000 + i * 7919 + row * 31, rigPlanFor(true, side, 70), k.keeperStrength, rigKeeperRead(true, k.read));
      if (g === "goal" || g === "rebound") goals++;
      const m = kick(9000 + i * 7919 + row * 31, rigPlanFor(false, side, 70), k.keeperStrength, rigKeeperRead(false, k.read));
      if (m !== "goal" && m !== "rebound") misses++;
    }
    console.log(`  their kick ${row + 1} (keeper ${k.keeperStrength}): rigged goals in ${goals}/${N}, rigged misses out ${misses}/${N}`);
    ok(goals >= N * 0.99, `their rigged goal goes in on kick ${row + 1} (${goals}/${N})`);
    ok(misses >= N * 0.995, `their rigged miss stays out on kick ${row + 1} (${misses}/${N})`);
  }
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
