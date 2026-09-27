/**
 * PENALTIES YOU WATCH (v0.15 items 6 and 7) — measured on the real engine.
 *
 *   - Penalties won in any move (hiddenMatch's `livePenalties`, which the real
 *     match always sets): how often a side wins one, top to bottom (2,000
 *     unseen matches a row). Harry: "a top team should get one every 6–7
 *     games".
 *   - A team-mate's (or an opponent's) automatic penalty — planPenalty,
 *     struck through the real engine the way CanvasMatch strikes it: the
 *     penalty rules, a few steps back, the 2.4 s run-up with the keeper
 *     brain's hop, launch() with his skills, brainStrike. What it converts at
 *     is what the unseen match uses while you are off the pitch
 *     (`OFF_PITCH_PEN_CONVERT`).
 *   - Who takes them: the shootout order, the designated taker, and each star
 *     counting double towards your own penalty duty.
 *
 * Run: npx tsx tests/star/penaltyTaking.mts
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
import { newMatch, advanceUntilInvolved, resolveScenario, PENALTY_WON_IN_BOX, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import {
  planPenalty, takerSkills, aimFor, shootoutOrder, designatedTaker, takerRating, yourPenaltyRating,
  OFF_PITCH_PEN_CONVERT, PENALTY_STAR_WEIGHT, type PenaltyTaker,
} from "../../lib/star/penaltyTaking";
import { setPieceDuties } from "../../lib/star/setPieces";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

// ─────────────────────────────────────────────────────────────────────────
console.log("\nHOW OFTEN A SIDE WINS A PENALTY (2,000 unseen matches a row)");
function perGame(teamStrength: number, livePenalties: boolean, n = 2000): number {
  let pens = 0;
  for (let m = 0; m < n; m++) {
    const rng = mulberry32(11 + m * 7919);
    const oppStrength = 58 + Math.floor(rng() * 29);
    const inputs: HiddenMatchInputs = {
      teamStrength, oppStrength, playerSkill: 70, pace: 70, freeKick: 50, position: "ST",
      energyMode: "medium", home: m % 2 === 0, livePenalties,
    };
    const st = newMatch(rng);
    for (let guard = 0; guard < 400; guard++) {
      const s = advanceUntilInvolved(st, inputs, rng, 90);
      if (!s.request) break;
      if (s.request.kinds.length === 1 && s.request.kinds[0] === "penalty") {
        pens++;
        resolveScenario(st, rng() < OFF_PITCH_PEN_CONVERT ? "goal" : "saved");
        continue;
      }
      const u = rng();
      resolveScenario(st, u < 0.25 ? "goal" : u < 0.4 ? "delivered" : "saved");
    }
  }
  return pens / n;
}
{
  const rows: [string, number][] = [["top (85)", 85], ["middle (72)", 72], ["bottom (60)", 60]];
  const after: Record<string, number> = {};
  for (const [label, s] of rows) {
    const b = perGame(s, false), a = perGame(s, true);
    after[label] = a;
    console.log(`  ${label.padEnd(12)} before ${b.toFixed(3)}/game (1 in ${(1 / b).toFixed(1)})   after ${a.toFixed(3)}/game (1 in ${(1 / a).toFixed(1)})`);
  }
  const top = after["top (85)"];
  ok(top >= 1 / 8 && top <= 1 / 5, `a top side wins one every ~6 games (1 in ${(1 / top).toFixed(1)}; PENALTY_WON_IN_BOX = ${PENALTY_WON_IN_BOX})`);
  ok(after["top (85)"] > after["bottom (60)"], "a better side wins more of them");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nA TEAM-MATE'S PENALTY, STRUCK FOR HIM ON THE REAL ENGINE (keeper 62)");
/** One automatic kick, the way CanvasMatch takes it: rules, stand back, run-up (with the keeper brain), strike. */
function autoKick(seed: number, rating: number, ks: number): boolean {
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, ks, 60, 55);
  enforceHardRules(sc);
  initDefenders(sc, rng);
  sc.player = standBack(sc.ball, sc.player);
  brainSetup(sc, (seed ^ 0x4b7e) >>> 0, ks, { penalty: penaltyReadFor(ks) });
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
  const N = 1500;
  const rates: Record<number, number> = {};
  for (const rt of [55, 70, 85]) {
    let s = 0;
    for (let i = 0; i < N; i++) if (autoKick(5000 + i * 7919 + rt * 13, rt, 62)) s++;
    rates[rt] = s / N;
    console.log(`  taker ${rt}: scored ${pct(rates[rt])}`);
  }
  // The typical designated taker (a side's best finisher) sits around 70-85.
  const typical = (rates[70] + rates[85]) / 2;
  console.log(`  a typical taker (70-85): ${pct(typical)}; OFF_PITCH_PEN_CONVERT = ${pct(OFF_PITCH_PEN_CONVERT)}`);
  ok(Math.abs(typical - OFF_PITCH_PEN_CONVERT) <= 0.05, `the unseen match's penalty rate matches a live team-mate's kick (${pct(typical)} vs ${pct(OFF_PITCH_PEN_CONVERT)})`);
  // With the v0.15 keeper (he dives almost every time, once) placement barely
  // separates takers: every rating lands in the real match's own band.
  ok([55, 70, 85].every((r) => rates[r] >= 0.7 && rates[r] <= 0.82), `every taker scores like a real-match penalty, 70-82 % (${[55, 70, 85].map((r) => pct(rates[r])).join(" / ")})`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nWHO TAKES THEM");
{
  const m = (id: string, rating: number, isGK = false): PenaltyTaker => ({ id, name: id, shortName: id, rating, isGK });
  const mates = [m("a", 70), m("gk", 90, true), m("b", 85), m("c", 60)];
  const you: PenaltyTaker = { ...m("you", 75), you: true };
  const order = shootoutOrder(mates, you);
  ok(order.map((p) => p.id).join(",") === "b,you,a,c,gk", `the shootout order: best first, you where your rating puts you, the keeper last (${order.map((p) => p.id).join(",")})`);
  ok(designatedTaker(mates)?.id === "b", "the designated taker is the best outfield taker");
  ok(takerRating({ shooting: 88, overall: 70 }) === 88 && takerRating({ overall: 70 }) === 70 && takerRating({}) === 62, "a taker's rating is his finishing, then his overall");
  ok(yourPenaltyRating({ technique: 60, freeKick: 70 }, 2) === 60 * 0.4 + 70 * 0.6 + 6, "your rating is your dead-ball strike plus a little per star");
}
{
  // Each star counts double towards the penalty duty (free kicks unchanged).
  const career = {
    skills: { freeKick: 40 }, starRating: 3, status: "1st Team",
    player: { club: "X" }, league: [{ name: "X", strength: 80 }],
  } as unknown as Parameters<typeof setPieceDuties>[0];
  const d = setPieceDuties(career, "1st Team");
  ok(PENALTY_STAR_WEIGHT === 8 && d.penaltyStarWeight === 8, "each star counts 8 towards the penalty duty");
  ok(d.penaltyStanding === 40 + 3 * 8 && d.penalties, `a 3★ player with free kick 40 is on penalties at a club of 80 (${d.penaltyStanding} ≥ ${d.penaltyNeeded})`);
  ok(!d.freeKicks, "…but not on free kicks (still 4 a star there)");
  ok(!setPieceDuties(career, "1st Team", { penaltyStarWeight: 4 }).penalties, "at the old weight (4) he would not have been");
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
