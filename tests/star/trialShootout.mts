/**
 * THE TRIAL'S NEW STAGES (1 Oct 2026): through the gate and the shootout.
 *
 *   - The gate IS training's technique drill: same ladder, same cones, same
 *     judging — the trial only picks the rung from its difficulty.
 *   - The shootout: both keepers on the same kick-by-kick ramp, the
 *     adversity only ever on THEIR keeper, marked on the share of your kicks
 *     that went in.
 *   - On the real engine, an automatic taker scores about the same against
 *     either keeper — a shootout is close to even on an average day.
 *
 * Run: npx tsx tests/star/trialShootout.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { enforceHardRules } from "../../lib/star/kindRules";
import { brainSetup, brainAim, brainRunUp, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import { penaltyReadFor } from "../../lib/star/penaltyKeeper";
import { RUNUP, runupPath, standBack, playerAt, goalLineX } from "../../lib/star/penaltyRunup";
import { planPenalty, takerSkills, aimFor } from "../../lib/star/penaltyTaking";
import { techniqueDrill } from "../../lib/star/trainingDrills";
import { startTrial, difficultyFor, keeperBonusFor, SHARP_KEEPER_BONUS, type TrialProgress } from "../../lib/star/trial";
import {
  REPS, ladderLevel, techniqueSetup, shootoutKeeperFor, shootoutOurKeeperFor, shootoutQuality,
  shootoutTheirRating, penaltyRampFor, PENALTY_RAMP_FIRST, PENALTY_RAMP_LAST, COLD_KEEPER_READ_BONUS,
} from "../../lib/star/trialStages";

const problems: string[] = [];
const check = (c: boolean, what: string) => { if (!c) problems.push(what); };
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const withDay = (d: number, extra: Partial<TrialProgress> = {}): TrialProgress =>
  ({ ...startTrial(5), baseDifficulty: d, stageRolls: { technique: 0, shootout: 0 } as never, adversity: null, adversityStage: null, ...extra });

// ── The gate is training's gate ──────────────────────────────────────────
for (const d of [0, 0.34, 0.8]) {
  const t = withDay(d);
  for (let rep = 0; rep < REPS.technique; rep++) {
    const a = techniqueSetup(t, rep);
    const b = techniqueDrill(ladderLevel(difficultyFor(t, "technique")), rep);
    check(JSON.stringify(a) === JSON.stringify(b), `the trial's gate is training's gate (day ${d}, rep ${rep})`);
  }
}
check(techniqueSetup(withDay(0.9), 0).gateWidth < techniqueSetup(withDay(0), 0).gateWidth,
  "a harder day narrows the gate");

// ── The shootout keepers ─────────────────────────────────────────────────
{
  const t = withDay(0.5);
  for (let k = 0; k < 8; k++) {
    const theirs = shootoutKeeperFor(t, k), ours = shootoutOurKeeperFor(k);
    check(JSON.stringify(theirs) === JSON.stringify(ours), `both keepers are on the same ramp at kick ${k + 1}`);
  }
  check(shootoutKeeperFor(t, 0).keeperStrength === PENALTY_RAMP_FIRST.keeperStrength, "kick 1: a fair keeper");
  check(shootoutKeeperFor(t, REPS.shootout - 1).keeperStrength === PENALTY_RAMP_LAST.keeperStrength, `kick ${REPS.shootout}: his best`);
  check(shootoutKeeperFor(t, 9).keeperStrength === PENALTY_RAMP_LAST.keeperStrength, "sudden death stays at his best");
  check(shootoutKeeperFor(t, 2).keeperStrength === penaltyRampFor(2, REPS.shootout).keeperStrength, "the ramp is the trial's own");

  const sharp = withDay(0.5, { adversity: "sharp-keeper", adversityStage: "shootout" });
  check(keeperBonusFor(sharp, "shootout") === SHARP_KEEPER_BONUS, "a sharp keeper can land on the shootout");
  check(shootoutKeeperFor(sharp, 0).keeperStrength === PENALTY_RAMP_FIRST.keeperStrength + SHARP_KEEPER_BONUS,
    "…and it is THEIR keeper who is sharper");
  const cold = withDay(0.5, { adversity: "cold-keeper", adversityStage: "shootout" });
  check(Math.abs(shootoutKeeperFor(cold, 0).read.readChance - (PENALTY_RAMP_FIRST.readChance + COLD_KEEPER_READ_BONUS)) < 1e-9,
    "a cold keeper reads you better");
  check(shootoutTheirRating(withDay(1)) > shootoutTheirRating(withDay(0)), "a harder day brings better takers");
}

// ── The mark ─────────────────────────────────────────────────────────────
check(shootoutQuality([]) === 0, "no kicks, no mark");
check(shootoutQuality([true, true, false, true, false]) === 0.6, "3 of 5 is 0.6");
check(shootoutQuality([true, true, true, true, true, false, true]) === 6 / 7, "sudden death kicks count too");

// ── On the real engine: neither side starts ahead ────────────────────────
function kick(seed: number, rating: number, ks: number, read: { commitChance: number; readChance: number; metres: number }): boolean {
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, ks, 60, 55);
  enforceHardRules(sc);
  initDefenders(sc, rng);
  sc.player = standBack(sc.ball, sc.player);
  brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { penalty: penaltyReadFor(ks, read) });
  for (let t = 0; t < 0.7; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); }
  const plan = planPenalty(rating, mulberry32((seed ^ 0x7a11c) >>> 0));
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
    stepReactions(sc, ball, h, rng);
    brainStep(sc, ball, h);
    res = stepBall(ball, sc, rng, h);
  }
  return (res === "goal" || res === "rebound") && !sc.follower.shot;
}
{
  const N = 240, t = withDay(0.34);
  let you = 0, them = 0;
  for (let i = 0; i < N; i++) {
    const k = i % REPS.shootout;
    const kp = shootoutKeeperFor(t, k), ko = shootoutOurKeeperFor(k);
    if (kick(3000 + i * 7919, 60, kp.keeperStrength, kp.read)) you++;
    if (kick(8000 + i * 7919, shootoutTheirRating(t), ko.keeperStrength, ko.read)) them++;
  }
  console.log(`  over the shootout's kicks: a 60-rated stand-in for you ${pct(you / N)}, their takers ${pct(them / N)}`);
  // Their kicks are rigged in the trial now (lib/star/trialShootoutRig.ts,
  // tests/star/trialShootoutRig.mts), so "neither side starts well ahead" is no
  // longer a claim about the trial; the keepers still ramp together, and your
  // kicks are still genuinely uncertain (below).
  console.log(`  (their side, unrigged, for reference: ${pct(them / N)})`);
  check(you / N > 0.35 && you / N < 0.8, `a shootout kick is genuinely uncertain (${pct(you / N)})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the gate is training's gate, the shootout keepers ramp together, and your kicks are genuinely uncertain");
