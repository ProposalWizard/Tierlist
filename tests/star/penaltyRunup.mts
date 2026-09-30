/**
 * THE RUN-UP (v0.15, permanent) — measured on the real engine.
 *
 * Every penalty is struck the way CanvasMatch strikes one: Harry's penalty
 * rules on the picture, you a few steps back (penaltyRunup.ts's standBack),
 * the keeper brain set up with this keeper's penalty rule set, a moment of
 * aiming, then the 2.4 s run-up — the keeper brain's `brainRunUp` every frame
 * (the ONE keeper: he may hop, and a hop is his side) — then launch(),
 * `brainStrike` and the same 180 Hz loop with `brainStep`.
 *
 * Pinned:
 *   - the real match (keeper 62, 1,500 kicks, the realistic spread) still
 *     scores ~75-80 % overall and ~75 % into the corners with the run-up;
 *   - a taker who ignores the keeper scores what he scored without a run-up;
 *   - he never hops (Harry, 27 Sep) — but leans: on about a third of kicks
 *     he shuffles half a metre to a random side before the strike, and a
 *     corner on the side he leaned AWAY from scores more;
 *   - the nudge, the path (penalty and free kick), the scuff;
 *   - item 5r: what counts as a cheeky strike, and what it costs;
 *   - item 7b: the trial keeper, kick by kick, through the run-up.
 *
 * Run: npx tsx tests/star/penaltyRunup.mts
 */
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders, stepReactions,
  type Scenario, type Vec2, type Ball,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { enforceHardRules } from "../../lib/star/kindRules";
import {
  brainSetup, brainAim, brainRunUp, brainStrike, brainStep, brainStateOf, hopChance, KEEPER_BRAIN,
} from "../../lib/star/keeperBrain";
import { penaltyReadFor, type PenaltyReadSettings } from "../../lib/star/penaltyKeeper";
import {
  RUNUP, strikeTimerFor, hasRunup, canNudge, runupPath, standBack, plantBeside, playerAt, goalLineX, nudgedDir, nudgeFromDrag,
  scuffStrike, isChip, cheekyStrike, isCheekyMiss,
} from "../../lib/star/penaltyRunup";
import { cheekyMissReputation, REPUTATION_EVENTS } from "../../lib/star/reputation";
import { penaltyRampFor, REPS } from "../../lib/star/trialStages";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

type Taker = "none" | "ignores" | "away" | "toward" | "scuff";
interface Kick { off: number; power: number; cy: number }
type Keeper = { ks: number; read: PenaltyReadSettings };
const real = (ks: number): Keeper => ({ ks, read: penaltyReadFor(ks) });

function kickFor(zone: "placed" | "corner" | "middle" | "chip", rng: () => number): Kick {
  const side = rng() < 0.5 ? -1 : 1, p = 0.6 + rng() * 0.3, cy = -1 + rng() * 1.25;
  switch (zone) {
    case "placed": return { off: side * (1.4 + 2.15 * Math.sqrt(rng())), power: p, cy };
    case "corner": return { off: side * (2.9 + rng() * 0.65), power: p, cy };
    case "middle": return { off: (rng() - 0.5) * 0.8, power: p, cy };
    case "chip": return { off: (rng() - 0.5) * 0.6, power: 0.4 + rng() * 0.05, cy: 0.3 + rng() * 0.45 };
  }
}
/** The realistic spread tests/star/penaltyKeeper.mts measures against. */
function mixKick(rng: () => number): Kick {
  const u = rng();
  return kickFor(u < 0.7 ? "placed" : u < 0.9 ? "middle" : "chip", rng);
}

interface Out { scored: boolean; hopped: number; leaned: number; went: boolean; diveDir: number }

/** One penalty, struck the way CanvasMatch strikes it. `taker` = what you do during the run-up. */
function penalty(seed: number, k: Kick, taker: Taker, keeper: Keeper, skills = { power: 60, technique: 60 }): Out {
  const rng = mulberry32(seed);
  const sc: Scenario = buildScenario("penalty", rng, keeper.ks, 60, 55);
  enforceHardRules(sc);
  initDefenders(sc, rng);
  if (taker !== "none") sc.player = standBack(sc.ball, sc.player);
  brainSetup(sc, (seed ^ 0x4b7e) >>> 0, keeper.ks, { penalty: keeper.read });
  for (let t = 0; t < 1.5; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainAim(sc, 1 / 60); }
  const cx = (sc.goal.x1 + sc.goal.x2) / 2;
  const dx = cx + k.off - sc.ball.x, dy = 0 - sc.ball.y, L = Math.hypot(dx, dy);
  let dir: Vec2 = { x: dx / L, y: dy / L };
  let power = k.power, contact = { cx: 0, cy: k.cy };
  if (taker !== "none") {
    const path = runupPath(sc.ball, sc.player);
    let nudge = 0;
    for (let t = 0; t < RUNUP.runupS; t += 1 / 60) {
      stepKeeper(sc, 1 / 60);
      const now = nudgedDir(sc.ball, dir, nudge);
      brainRunUp(sc, 1 / 60, t + 1 / 60, goalLineX(sc.ball, now));
      sc.player = playerAt(path, (t + 1 / 60) / RUNUP.runupS);
      // Reacting: the moment he has hopped, swing the aim to the far side of
      // him (away) or the side he hopped (toward).
      const hop = brainStateOf(sc)?.hopSide ?? 0;
      if (hop !== 0 && (taker === "away" || taker === "toward") && nudge === 0) {
        const at = goalLineX(sc.ball, dir) - cx;
        const want = taker === "away" ? -hop : hop;
        if (Math.sign(at) !== want) nudge = want * Math.max(1.6, Math.abs(at)) - at;
        else nudge = 1e-9;
      }
    }
    dir = nudgedDir(sc.ball, dir, nudge);
    if (taker === "scuff") {
      const s = scuffStrike(dir, power, mulberry32((seed ^ 0x5c0ff) >>> 0));
      dir = s.dir; power = s.power; contact = s.contact;
    }
  }
  const hopped = brainStateOf(sc)?.hopSide ?? 0;
  const leaned = brainStateOf(sc)?.leanSide ?? 0;
  const ball = launch(sc, dir, power, contact, skills, rng);
  brainStrike(sc, ball, (seed ^ 0x5eed) >>> 0);
  const st = brainStateOf(sc);
  const went = !!st && st.reason !== "stayed";
  const diveDir = st?.dir ?? 0;
  let res: string | null = null;
  for (let t = 0; !res && t < 8; t += 1 / 180) {
    const h = 1 / 180;
    stepDefenders(sc, h, ball.pos, false, ball);
    stepKeeper(sc, h);
    stepReactions(sc, ball, h, rng);
    brainStep(sc, ball, h);
    res = stepBall(ball, sc, rng, h);
  }
  return { scored: (res === "goal" || res === "rebound") && !sc.follower.shot, hopped, leaned, went, diveDir };
}

function scored(taker: Taker, n: number, keeper: Keeper, gen: (rng: () => number) => Kick = mixKick, skills?: { power: number; technique: number }): number {
  let s = 0;
  for (let i = 0; i < n; i++) {
    const seed = 1000 + i * 7919;
    if (penalty(seed, gen(mulberry32((seed ^ 0xa11ce) >>> 0)), taker, keeper, skills).scored) s++;
  }
  return s / n;
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE REAL MATCH WITH THE RUN-UP (keeper 62, 1,500 kicks)");
const N = 1500;
const K62 = real(62);
const before = scored("none", N, K62);
const ignores = scored("ignores", N, K62);
const corners = scored("ignores", N, K62, (g) => kickFor("corner", g));
const cornersBefore = scored("none", N, K62, (g) => kickFor("corner", g));
const away = scored("away", N, K62), toward = scored("toward", N, K62), scuff = scored("scuff", N, K62);
console.log(`  no run-up ${pct(before)}  run-up, ignoring him ${pct(ignores)}  swinging away from his hop ${pct(away)}  toward it ${pct(toward)}  scuffed ${pct(scuff)}`);
console.log(`  corners: no run-up ${pct(cornersBefore)}  run-up ${pct(corners)}`);
ok(ignores >= 0.74 && ignores <= 0.81, `overall still ~75-80 % with the run-up (${pct(ignores)})`);
ok(corners > 0.71 && corners < 0.79, `a corner still scores about 75 % (${pct(corners)})`);
ok(Math.abs(ignores - before) <= 0.025, `ignoring the keeper scores what it did without a run-up (${pct(ignores)} vs ${pct(before)})`);
// The keeper no longer hops (Harry, 27 Sep), so there is nothing to read:
// watching him and swinging the aim changes nothing.
ok(away === ignores && toward === ignores, `with no hop there is nothing to read (away ${pct(away)}, toward ${pct(toward)}, ignoring ${pct(ignores)})`);
ok(scuff < ignores - 0.2, `a scuff is a clearly worse kick (${pct(scuff)} vs ${pct(ignores)})`);

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE KEEPER DOESN'T HOP — HE SOMETIMES LEANS (the brain's, one decision)");
{
  for (const ks of [40, 62, 85]) {
    let hops = 0, n = 1500, sideOk = 0, sideN = 0, far = 0;
    for (let i = 0; i < n; i++) {
      const seed = 50 + i * 131;
      const o = penalty(seed, mixKick(mulberry32(seed ^ 0x77)), "ignores", real(ks));
      if (o.hopped !== 0) {
        hops++;
        if (o.went && o.diveDir !== 0) { sideN++; if (o.diveDir === o.hopped) sideOk++; }
      }
    }
    void far;
    const share = hops / n, want = hopChance(ks);
    console.log(`  keeper ${ks}: hopped on ${pct(share)} of run-ups (asked ${pct(want)})`);
    ok(share === 0 && want === 0, `keeper ${ks} never hops (${pct(share)})`);
    void sideOk; void sideN;
  }
  // THE LEAN (not a hop): about a third of run-ups, half a metre, a random
  // side — and never more than that.
  let maxOff = 0, leans = 0, done = 0;
  for (let i = 0; i < 300; i++) {
    const rng = mulberry32(900 + i);
    const sc = buildScenario("penalty", rng, 62, 60, 55);
    enforceHardRules(sc); initDefenders(sc, rng);
    const x0 = sc.keeper.x;
    brainSetup(sc, i, 62, { penalty: penaltyReadFor(62) });
    // The shortest run-up there is (Two Steps, 1.7 s): the lean is finished by then.
    for (let t = 0; t < 1.7; t += 1 / 60) { stepKeeper(sc, 1 / 60); brainRunUp(sc, 1 / 60, t, x0 + 3); }
    const off = Math.abs(sc.keeper.x - x0);
    maxOff = Math.max(maxOff, off);
    if ((brainStateOf(sc)?.leanSide ?? 0) !== 0) { leans++; if (Math.abs(off - KEEPER_BRAIN.leanDistM) < 0.05) done++; }
  }
  ok(leans >= 75 && leans <= 135, `he leans on about a third of run-ups (${leans} of 300, asked ${KEEPER_BRAIN.leanChance * 100}%)`);
  ok(done === leans, `…the whole ${KEEPER_BRAIN.leanDistM} m, before even a 1.7 s run-up ends (${done} of ${leans})`);
  ok(maxOff <= KEEPER_BRAIN.leanDistM + 1e-6, `…and never further (${maxOff.toFixed(3)} m)`);
  // Leaning is a guess: the corner he leaned away from goes in more.
  const row = (off: number) => {
    const by = { left: [0, 0], none: [0, 0], right: [0, 0] } as Record<string, number[]>;
    for (let i = 0; i < 400; i++) {
      const seed = 3000 + i * 7919;
      const kr = mulberry32((seed ^ 0xa11ce) >>> 0);
      const k = { off: off + (kr() - 0.5) * 0.6, power: 0.6 + kr() * 0.3, cy: -1 + kr() * 1.25 };
      const o = penalty(seed, k, "ignores", K62);
      const key = o.leaned < 0 ? "left" : o.leaned > 0 ? "right" : "none";
      by[key][0]++; if (o.scored) by[key][1]++;
    }
    return Object.fromEntries(Object.entries(by).map(([k, [n, g]]) => [k, n ? g / n : NaN])) as Record<string, number>;
  };
  const rightCorner = row(3.0), leftCorner = row(-3.0);
  console.log(`  right corner: he leaned left ${pct(rightCorner.left)}, didn't lean ${pct(rightCorner.none)}, leaned right ${pct(rightCorner.right)}`);
  console.log(`  left corner:  he leaned left ${pct(leftCorner.left)}, didn't lean ${pct(leftCorner.none)}, leaned right ${pct(leftCorner.right)}`);
  ok(rightCorner.left > rightCorner.none + 0.05 && rightCorner.right < rightCorner.none, "leaning left makes a right-corner kick score more, leaning right less");
  ok(leftCorner.right > leftCorner.none + 0.03, "…and leaning right makes a left-corner kick score more");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nWHERE YOU STAND, WHERE YOU GO");
{
  ok(hasRunup("penalty") && hasRunup("free_kick") && !hasRunup("one_on_one") && !hasRunup("corner"), "a run-up for penalties and direct free kicks only");
  ok(canNudge("penalty") && !canNudge("free_kick"), "only a penalty lets you swing your aim on the way");
  const ball = { x: 34, y: 11 };
  const a = standBack(ball, { x: 35.3, y: 11.15 });
  const d = Math.hypot(a.x - ball.x, a.y - ball.y);
  ok(Math.abs(d - RUNUP.startBack) < 1e-9 && a.y > ball.y && a.x > ball.x, `a few steps back (${d.toFixed(2)} m), behind the ball, on the side he was drawn`);
  const b = standBack(ball, { x: 34, y: 12.8 });
  ok(b.x < ball.x, "…and on the left when he was drawn dead behind it (a right-footer)");
  const p = plantBeside(ball, { x: 35.3, y: 11.15 });
  ok(Math.hypot(p.x - ball.x, p.y - ball.y) < 0.7, "the run-up ends with his standing foot beside the ball");
  const path = runupPath(ball, { x: 35.3, y: 11.15 });
  const mid = playerAt(path, 0.5), end = playerAt(path, 1), start = playerAt(path, 0);
  ok(start.x === path.from.x && end.x === path.to.x && mid.y < path.from.y && mid.y > path.to.y, "…jogging in a straight line between the two");
  // A free kick out on the right: he starts further from goal than the ball,
  // behind it on the line from the goal, never nearer the goal.
  const fk = { x: 42, y: 22 };
  const s = standBack(fk, { x: 42, y: 23 });
  const goalD = (q: Vec2) => Math.hypot(q.x - 34, q.y);
  ok(goalD(s) > goalD(fk) + 2.5 && Math.abs(Math.hypot(s.x - fk.x, s.y - fk.y) - RUNUP.startBack) < 1e-9, `a free kick's run-up starts ${RUNUP.startBack} m back from the ball, away from goal`);
  ok(Math.hypot(plantBeside(fk, { x: 42, y: 23 }).x - fk.x, plantBeside(fk, { x: 42, y: 23 }).y - fk.y) < 0.7, "…and ends beside the ball");
  // The nudge.
  const dir0 = (() => { const dx = 31.5 - ball.x, dy = -ball.y, L = Math.hypot(dx, dy); return { x: dx / L, y: dy / L }; })();
  ok(Math.abs(goalLineX(ball, dir0) - 31.5) < 1e-9, "the aim crosses the goal line where it's pointed");
  ok(Math.abs(goalLineX(ball, nudgedDir(ball, dir0, 2)) - 33.5) < 1e-9, "a 2 m nudge moves it exactly 2 m along the line");
  ok(Math.abs(goalLineX(ball, nudgedDir(ball, dir0, 9)) - (31.5 + RUNUP.nudgeMaxM)) < 1e-9, `…and never more than ${RUNUP.nudgeMaxM} m`);
  ok(Math.abs(nudgeFromDrag(100, 366, 26.25) - (100 / 366) * 26.25 / RUNUP.nudgeFingerRatio) < 1e-12, "a finger movement maps to metres on this phone's own scale");
  // 1.0 s (Harry, 27 Sep) became 1.8 s: Mikey's playtest, 28 Sep 2026, ran out of time on it.
  ok(RUNUP.timerS === 1.8, "the strike screen's countdown is 1.8 s");
ok(strikeTimerFor("penalty") === 1.8 && strikeTimerFor("free_kick") === 3, "a free kick gives you 3 s, a penalty 1.8 s (Harry 27 Sep; penalty lengthened for Mikey 28 Sep)");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nTHE SCUFF");
{
  const r = mulberry32(3);
  let okAll = true;
  for (let i = 0; i < 500; i++) {
    const s = scuffStrike({ x: 0, y: -1 }, 0.8, r);
    if (Math.abs(s.power - 0.8 * RUNUP.scuffPower) > 1e-12) okAll = false;
    if (Math.abs(s.angleDeg) > RUNUP.scuffAngleDeg) okAll = false;
    if (!(s.contact.cy < -0.45 && s.contact.cy > -0.95)) okAll = false;
    if (Math.abs(Math.hypot(s.dir.x, s.dir.y) - 1) > 1e-9) okAll = false;
  }
  ok(okAll, `${RUNUP.scuffPower * 100} % of the power, within ${RUNUP.scuffAngleDeg}° of your line, on the top half of the ball — every time`);
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nITEM 5r — WHAT COUNTS AS CHEEKY (option c)");
{
  const rng = mulberry32(11);
  const sc = buildScenario("penalty", rng, 62, 60, 55);
  enforceHardRules(sc);
  const cx = (sc.goal.x1 + sc.goal.x2) / 2;
  const strike = (off: number, power: number, cy: number): Ball => {
    const dx = cx + off - sc.ball.x, dy = -sc.ball.y, L = Math.hypot(dx, dy);
    return launch(JSON.parse(JSON.stringify(sc)), { x: dx / L, y: dy / L }, power, { cx: 0, cy }, { power: 99, technique: 99 }, mulberry32(5));
  };
  const panenka = strike(0, 0.42, 0.5), drive = strike(0.2, 0.8, -0.3), corner = strike(3.0, 0.8, -0.3);
  ok(isChip(panenka) && !isChip(drive), "a Panenka is a chip; a driven kick is not");
  ok(cheekyStrike("penalty", panenka, cx, true) === "chip", "a chipped penalty is cheeky");
  ok(cheekyStrike("penalty", drive, cx, true) === "penalty-middle", "a penalty driven down the middle is cheeky");
  ok(cheekyStrike("penalty", corner, cx, true) === null, "a penalty in the corner is not");
  ok(cheekyStrike("one_on_one", panenka, cx, true) === "chip" && cheekyStrike("one_on_one", drive, cx, true) === null, "in open play only a chip at goal counts");
  ok(cheekyStrike("one_on_one", panenka, cx, false) === null, "…a chipped pass does not");
  ok(cheekyStrike("free_kick", panenka, cx, true) === null && cheekyStrike("corner", panenka, cx, true) === null, "…and a set piece lifted over a wall is not open play");
  ok(isCheekyMiss("saved") && isCheekyMiss("over") && isCheekyMiss("caught") && !isCheekyMiss("goal") && !isCheekyMiss("rebound"), "only a kick that didn't go in is a miss");
  ok(REPUTATION_EVENTS.cheekyMiss === -1, "it costs 1 reputation point");
  ok(cheekyMissReputation(1) === -1 && cheekyMissReputation(2) === -2 && cheekyMissReputation(5) === -2 && cheekyMissReputation(0) === 0, "…at most 2 in one match");
}

// ─────────────────────────────────────────────────────────────────────────
console.log("\nITEM 7b — THE TRIAL KEEPER, KICK BY KICK (through the run-up, 1,000 kicks each)");
{
  const tsk = { power: 55, technique: 55 };
  const rates: number[] = [];
  for (let rep = 0; rep < REPS.penalties; rep++) {
    const r = penaltyRampFor(rep, REPS.penalties);
    const keeper: Keeper = { ks: r.keeperStrength, read: penaltyReadFor(r.keeperStrength, r.read) };
    const s = scored("ignores", 1000, keeper, mixKick, tsk);
    rates.push(s);
    console.log(`  kick ${rep + 1}: keeper ${r.keeperStrength}, goes ${pct(r.read.commitChance)}, reads ${pct(r.read.readChance)}, dives ${r.read.metres} m → scored ${pct(s)}`);
  }
  // A1 re-pinned the old one-keeper-per-day trial at easiest 55.9 %, hardest
  // 38.6 % (tests/star/penaltyKeeper.mts). The ramp starts at or a little
  // above the easiest day and ends at or a little below the hardest.
  ok(rates[0] >= 0.52 && rates[0] <= 0.66, `kick 1 is a fair keeper: ${pct(rates[0])} (easiest day 55.9 %)`);
  ok(rates[rates.length - 1] >= 0.28 && rates[rates.length - 1] <= 0.42, `the last kick is his best: ${pct(rates[rates.length - 1])} (hardest day 38.6 %)`);
  ok(rates.every((v, i) => i === 0 || v < rates[i - 1]), "every kick is harder than the one before");
  ok(rates[0] < ignores - 0.1, `even kick 1 is harder than a real match (${pct(rates[0])} vs ${pct(ignores)})`);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
if (failed) process.exit(1);
