/**
 * THE TRIAL'S SHOOTOUT RIG (Harry, 1 Oct 2026: "rigs the game so it always has
 * you having to score the winning pen"; 2 Oct 2026: two team-mates take our
 * first two, you take the last, and "it could be any organization of outcomes
 * to get to that").
 *
 * Three halves:
 *
 *  1. The scripts, over thousands of saves: level before your kick every time,
 *     every one of the 10 paths turns up, 0-0 / 1-1 / 2-2 each about a third,
 *     and consecutive saves usually differ.
 *  2. The misses and the run-ups: no two of a save's first three misses look
 *     alike, the two team-mates never miss the same way (v0.25), and five
 *     takers run up five different ways.
 *  3. The plans that rule hands the real engine, struck the way CanvasMatch
 *     strikes an automatic penalty (rules, run-up, keeper brain, launch()), at
 *     every keeper strength the shootout uses on either side: a "goal" plan
 *     goes in and every "miss" style stays out, essentially every time. A rig
 *     the engine can disagree with would show a goal the score says was missed.
 *
 * Run: npx tsx tests/star/trialShootoutRig.mts
 */
import {
  createRig, createRigScript, rigApply, rigNextSide, rigIntent, rigGoals, isYourKick, isTeamMateKick,
  winningPenaltyScored, rigPlanFor, rigKeeperRead, pickRunups, idForRunup, MISS_STYLES,
  SHOOTOUT_KICKS, SHOOTOUT_TOTAL, type RigState, type MissStyle,
} from "../../lib/star/trialShootoutRig";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions, type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { enforceHardRules } from "../../lib/star/kindRules";
import { brainSetup, brainAim, brainRunUp, brainStrike, brainStep } from "../../lib/star/keeperBrain";
import { RUNUP, runupPath, standBack, playerAt, goalLineX } from "../../lib/star/penaltyRunup";
import { aimFor, takerSkills, type PenaltyPlan } from "../../lib/star/penaltyTaking";
import { takerPenaltyRunup } from "../../lib/star/runupStyles";
import { shootoutOurKeeperFor, shootoutKeeperFor } from "../../lib/star/trialStages";
import { startTrial } from "../../lib/star/trial";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

/** Play one save's automatic kicks exactly as scripted (or with `flip` kicks going the other way). */
function playTo(seed: number, flip = -1): RigState {
  const script = createRigScript(seed);
  let st: RigState = createRig();
  while (!isYourKick(st) && !st.over) {
    const want = rigIntent(st, script);
    st = rigApply(st, st.kicks.length === flip ? !want : want);
  }
  return st;
}

console.log("\nTHE SCRIPTS, OVER 3,000 SAVES");
{
  ok(SHOOTOUT_KICKS === 3 && SHOOTOUT_TOTAL === 6, "three kicks each, six in all");
  const N = 3000;
  let level = 0, yoursLast = 0, mateFirstTwo = 0, sameAsLast = 0;
  const levels = [0, 0, 0];
  const paths = new Set<string>();
  let prev = "";
  for (let s = 0; s < N; s++) {
    const st = playTo(s * 7919 + 1);
    const t = rigGoals(st.kicks, "them"), u = rigGoals(st.kicks, "you");
    if (t === u) level++;
    levels[Math.min(2, u)]++;
    if (isYourKick(st) && st.kicks.length === SHOOTOUT_TOTAL - 1) yoursLast++;
    const key = st.kicks.map(k => (k.scored ? "1" : "0")).join("");
    paths.add(key);
    if (key === prev) sameAsLast++;
    prev = key;
    // Our first two kicks were team-mates', never yours.
    let stp: RigState = createRig(), mates = 0;
    for (const k of st.kicks) { if (isTeamMateKick(stp)) mates++; stp = rigApply(stp, k.scored); }
    if (mates === SHOOTOUT_KICKS - 1) mateFirstTwo++;
  }
  console.log(`  levels before your kick: 0-0 ${levels[0]}, 1-1 ${levels[1]}, 2-2 ${levels[2]} (of ${N}); ${paths.size} different paths; same path as the save before: ${(sameAsLast / N * 100).toFixed(1)}%`);
  ok(level === N, `level every time your kick is up (${level}/${N})`);
  ok(yoursLast === N, "your kick is always the sixth and last");
  ok(mateFirstTwo === N, "the Trialists' first two kicks are always team-mates'");
  ok(paths.size === 10, `all 10 paths to level turn up (${paths.size})`);
  ok(levels.every(n => n > N * 0.28 && n < N * 0.39), "0-0, 1-1 and 2-2 each about a third");
  ok(sameAsLast < N * 0.2, "one save rarely repeats the path of the save before");
  ok(paths.has("00000"), "Harry's example turns up: they miss three, we miss two, then you");

  // Your kick decides it.
  let winOnGoal = true;
  for (let s = 0; s < 200; s++) {
    const st = playTo(s + 11);
    const won = rigApply(st, true), level2 = rigApply(st, false);
    winOnGoal &&= won.over && won.winner === "you" && winningPenaltyScored(won);
    winOnGoal &&= level2.over && level2.winner === null && !winningPenaltyScored(level2);
  }
  ok(winOnGoal, "score your kick and you win; miss it and it stays level");

  // One automatic kick goes against its plan (the engine disagreed): the rest
  // of the kicks absorb it when they still can.
  let tried = 0, recovered = 0, beforeLast = 0, beforeLastRecovered = 0;
  for (let s = 0; s < 400; s++) {
    for (let flip = 0; flip < SHOOTOUT_TOTAL - 1; flip++) {
      const st = playTo(s * 31 + 5, flip);
      tried++;
      const lv = rigGoals(st.kicks, "them") === rigGoals(st.kicks, "you");
      if (lv) recovered++;
      if (flip < SHOOTOUT_TOTAL - 2) { beforeLast++; if (lv) beforeLastRecovered++; }
    }
  }
  console.log(`  one kick off script: still level ${recovered}/${tried}; when it is not the last automatic kick, ${beforeLastRecovered}/${beforeLast}`);
  ok(beforeLastRecovered / beforeLast > 0.6, "a surprise before the last automatic kick is usually absorbed");
}

console.log("\nMISSES AND RUN-UPS");
{
  let distinct = 0, total = 0, bothSides = 0;
  for (let s = 0; s < 1000; s++) {
    const sc = createRigScript(s * 13 + 3);
    const ms: MissStyle[] = [];
    sc.intents.forEach((g, i) => { if (!g) ms.push(sc.misses[i]); });
    const firstThree = ms.slice(0, 3);
    if (firstThree.length > 1) { total++; if (new Set(firstThree).size === firstThree.length) distinct++; }
    if (new Set(sc.sides).size === 2) bothSides++;
  }
  ok(distinct === total, `no two of a save's first three misses look alike (${distinct}/${total})`);
  ok(bothSides > 900, `kicks go both ways in a save (${bothSides}/1000)`);
  ok(MISS_STYLES.length === 3, "three ways to miss: wide, skied, over");

  // v0.25 (Harry's live test, point 8: "team-mates missed the same way
  // twice"). Before: the 0-0 path could give both team-mates the same style
  // (the miss bag refilled between them), and an off-script miss was always
  // "wide". Now, whatever happens on the night, they differ.
  let mateSame = 0, mateSameSide = 0, backToBack = 0, pairs = 0;
  for (let s = 0; s < 5000; s++) {
    const sc = createRigScript(s * 7 + 11);
    if (sc.misses[1] === sc.misses[3]) mateSame++;
    if (sc.sides[1] === sc.sides[3]) mateSameSide++;
    // Planned misses back to back, and an off-script miss against the kick before it.
    for (let i = 0; i + 1 < sc.misses.length; i++) {
      if (sc.intents[i] && !sc.intents[i + 1]) continue;
      pairs++; if (sc.misses[i] === sc.misses[i + 1]) backToBack++;
    }
  }
  ok(mateSame === 0, `the two team-mates never miss the same way (${mateSame}/5000 saves)`);
  ok(mateSameSide === 0, `the two team-mates go opposite ways (${mateSameSide}/5000 saves)`);
  ok(backToBack === 0, `no two kicks in a row miss the same way (${backToBack}/${pairs} pairs)`);

  let allDistinct = true, allMatch = true;
  for (let s = 0; s < 300; s++) {
    const r = pickRunups(s * 977 + 1, 5);
    allDistinct &&= new Set(r).size === 5;
    r.forEach((style, i) => { allMatch &&= takerPenaltyRunup(idForRunup(`t${s}-${i}`, style)) === style; });
  }
  ok(allDistinct, "five takers, five different run-ups");
  ok(allMatch, "each taker's id makes the match pick exactly his run-up");
}

console.log("\nTHE PLANS THE RIG HANDS THE REAL ENGINE");
function kick(seed: number, plan: PenaltyPlan, ks: number, read: { commitChance: number; readChance: number; metres: number }, rating: number): string {
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
  const N = 150;
  const t = { ...startTrial(9), adversity: null, adversityStage: null };
  // Every keeper an automatic kick faces: ours on their three, theirs on our two.
  const keepers = [
    ...[0, 1, 2].map(r => ({ label: `our keeper, their kick ${r + 1}`, k: shootoutOurKeeperFor(r) })),
    ...[0, 1].map(r => ({ label: `their keeper, our kick ${r + 1}`, k: shootoutKeeperFor(t, r) })),
  ];
  for (const { label, k } of keepers) {
    let goals = 0;
    const missOut: Record<string, number> = {};
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1;
      const rating = 52 + (i % 5) * 9;
      const tech = takerSkills(rating).technique;
      const g = kick(4000 + i * 7919 + k.keeperStrength * 31, rigPlanFor(true, side, tech), k.keeperStrength, rigKeeperRead(true, k.read), rating);
      if (g === "goal" || g === "rebound") goals++;
      for (const m of MISS_STYLES) {
        const r = kick(9000 + i * 7919 + k.keeperStrength * 31 + m.length, rigPlanFor(false, side, tech, m), k.keeperStrength, rigKeeperRead(false, k.read), rating);
        if (r !== "goal" && r !== "rebound") missOut[m] = (missOut[m] ?? 0) + 1;
      }
    }
    console.log(`  ${label} (keeper ${k.keeperStrength}): goals in ${goals}/${N}; misses out — ${MISS_STYLES.map(m => `${m} ${missOut[m] ?? 0}`).join(", ")} /${N}`);
    ok(goals >= N * 0.98, `a rigged goal goes in (${label})`);
    for (const m of MISS_STYLES) ok((missOut[m] ?? 0) >= N * 0.99, `a rigged "${m}" miss stays out (${label})`);
  }
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
