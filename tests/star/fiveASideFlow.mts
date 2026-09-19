import {
  playOn, newFlow, bandOf, bandY, flowAfterTouch, BAND_ORDER,
  MINUTES_PER_BEAT, MAX_BEAT_MOVE, RECEIVE_RUN,
  type FiveFlowState, type Band,
} from "../../lib/star/fiveASide/flow";
import { kickOffWorld, buildPassage, buildTheirAttack, type FiveWorld } from "../../lib/star/fiveASide/passage";
import { FIVE_A_SIDE, fullTimeMinutes } from "../../lib/star/fiveASide/rules";
import { insideFivePitch } from "../../lib/star/fiveASide/geometry";
import {
  newFiveMatch, advanceFlow, applyOutcome, applyTheirAttack, resumeAction,
  type FiveMatchState,
} from "../../lib/star/fiveASide/match";
import { newMatch, advanceUntilInvolved, resolveScenario, type ScenarioResult } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";
import { setOffsideRuleEnabled } from "../../lib/star/canvasEngine";

/**
 * THE FOOTBALL YOU ARE NOT PLAYING.
 *
 * The stage was reported as useless, and the diagnosis with it:
 *
 *   "The big issue is that the highlights are essentially you passing and then
 *    respawning wherever the ball ends up. The CPUs have to be able to play
 *    without your input."
 *
 * `flow.ts` is the answer to that, and this is what checks it is actually an
 * answer. Four things matter, and none of them can be seen by looking at a
 * screen for five minutes:
 *
 *  1. **It gives you a real match's worth of involvements.** Measured against
 *     `hiddenMatch` — the thing it is modelled on — rather than against a
 *     number somebody liked, because that is what was asked for: "exactly the
 *     same as a 90 min game highlights wise but cut the game down to 45".
 *  2. **The ball actually goes somewhere.** The old stage moved it 2.97 m in a
 *     whole match. If that ever comes back, nothing on screen will say so.
 *  3. **Nobody teleports.** The whole point of carrying positions between
 *     touches is lost the moment a man can appear somewhere else.
 *  4. **You arrive in a picture the engine can play**, with space in it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const bodies = (w: FiveWorld) => [w.you, ...w.mates, ...w.opps, w.yourKeeper, w.theirKeeper];

// ── The ladder is the big match's ladder ────────────────────────────────
{
  check(BAND_ORDER.length === 5, "five bands, the same five the big match uses");
  const ys = BAND_ORDER.map(b => bandY(FIVE_A_SIDE, b));
  check(
    ys.every((y, i) => i === 0 || y < ys[i - 1]),
    `the ladder has to run from your goal to theirs, got ${ys.map(y => y.toFixed(1)).join(" → ")}`,
  );
  check(
    ys[0] > FIVE_A_SIDE.pitch.y2 * 0.75 && ys[4] < FIVE_A_SIDE.pitch.y2 * 0.25,
    "…reaching both boxes",
  );
  // And the inverse agrees with it, or territory after a touch is read wrong.
  for (const b of BAND_ORDER) {
    check(bandOf(FIVE_A_SIDE, bandY(FIVE_A_SIDE, b)) === b, `${b} reads back as itself`);
  }
  check(bandOf(FIVE_A_SIDE, 0) === "box", "a ball on their line is in their box");
  check(bandOf(FIVE_A_SIDE, 36) === "own_box", "…and one on yours is in yours");
}

// ── THE HIGHLIGHT COUNT, AGAINST THE REAL MATCH ─────────────────────────
//
// The target is not a number. It is what a real ninety minutes gives you, and
// the only honest way to know that is to run one.
{
  /** How many scenarios `hiddenMatch` calls you into in a real ninety. */
  function realMatch(pick: (rng: () => number) => ScenarioResult): number[] {
    const out: number[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed * 7919);
      const st = newMatch(rng);
      let calls = 0;
      for (let guard = 0; guard < 600; guard++) {
        const r = advanceUntilInvolved(
          st, { teamStrength: 62, oppStrength: 62, playerSkill: 65, pace: 60, home: true }, rng, 90,
        );
        if (r.fullTime) break;
        if (r.request) { calls++; resolveScenario(st, pick(rng)); }
      }
      out.push(calls);
    }
    return out;
  }

  /** …and how many the five-a-side gives you across its forty-five, played
   *  through the real reducers with the same mix of outcomes. */
  function fiveASide(pick: (rng: () => number) => ScenarioResult): number[] {
    const out: number[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const rng = mulberry32(seed * 7919);
      let m: FiveMatchState = newFiveMatch(seed, FIVE_A_SIDE);
      let calls = 0;
      for (let guard = 0; guard < 2000 && !m.over; guard++) {
        const act = resumeAction(m);
        if (act === "done") break;
        if (act === "flow") { m = advanceFlow(m, { difficulty: 0.5, playerSkill: 65 }).state; continue; }
        if (act === "opp") { m = applyTheirAttack(m, "saved", m.world); continue; }
        calls++;
        const r = pick(rng);
        const outcome = r === "goal" ? "goal" : r === "delivered" ? "delivered" : r === "lost" ? "tackled" : "saved";
        // A real picture, built from the real world, so `worldFromScenario`
        // reads back what it always reads back.
        const sc = buildPassage(m.world, { keeperStrength: 40, rng });
        m = applyOutcome(m, outcome, sc, { pos: { ...m.world.ball } } as never, 0.5);
      }
      out.push(calls);
    }
    return out;
  }

  const mixed = (rng: () => number): ScenarioResult => {
    const x = rng();
    return x < 0.1 ? "goal" : x < 0.45 ? "delivered" : x < 0.75 ? "saved" : "lost";
  };
  const shooter = (): ScenarioResult => "saved";

  for (const [label, pick] of [["a mixed player", mixed], ["a player who shoots everything", shooter]] as const) {
    const real = realMatch(pick).sort((a, b) => a - b);
    const five = fiveASide(pick).sort((a, b) => a - b);
    const rm = avg(real), fm = avg(five);
    console.log(
      `      ${label}: real 90' ${rm.toFixed(2)} (p10 ${real[30]}, p90 ${real[270]})`
      + `  |  five-a-side 45' ${fm.toFixed(2)} (p10 ${five[30]}, p90 ${five[270]})`,
    );
    check(
      Math.abs(fm - rm) < rm * 0.25,
      `${label}: the five-a-side must give the same highlight count as a real ninety `
      + `(real ${rm.toFixed(2)}, five-a-side ${fm.toFixed(2)})`,
    );
    check(fm > 4, `${label}: …and it must be a real number of them, got ${fm.toFixed(2)}`);
  }
}

// ── The ball travels, and everybody moves ───────────────────────────────
//
// The defect, measured on the old stage: over 250 matches the ball's y went
// from 18.0 to 16.0 across a WHOLE MATCH, 0.17 m per touch, and team-mates sat
// pinned at exactly 2.20 m from it by the placement rule fighting the engine's
// own reactions. Nobody moved because nothing moved them.
{
  let travelled = 0, matches = 0, frozen = 0, men = 0;
  let maxStep = 0, maxReceive = 0;
  let offPitch = 0, notFinite = 0;

  for (let seed = 1; seed <= 200; seed++) {
    const rng = mulberry32(seed * 104729);
    let world = kickOffWorld(true);
    let flow: FiveFlowState = newFlow(true);
    let budget = Math.floor(fullTimeMinutes(FIVE_A_SIDE) / MINUTES_PER_BEAT);
    let path = 0;
    const startPositions = bodies(world).map(b => ({ ...b }));
    let endPositions = startPositions;
    const furthest = startPositions.map(() => 0);

    for (let guard = 0; guard < 200 && budget > 0; guard++) {
      const r = playOn(FIVE_A_SIDE, world, flow, { difficulty: 0.5, playerSkill: 65 }, rng, budget);
      budget -= r.beatsPlayed + 1;

      for (let i = 1; i < r.beats.length; i++) {
        const a = r.beats[i - 1].world, b = r.beats[i].world;
        path += Math.abs(b.ball.y - a.ball.y);
        const steps = bodies(a).map((p, k) => Math.hypot(p.x - bodies(b)[k].x, p.y - bodies(b)[k].y));
        maxStep = Math.max(maxStep, ...steps);
        // The LAST beat of a stop is the one where somebody runs onto the
        // ball, and that run is allowed to be longer — see RECEIVE_RUN.
        if (i === r.beats.length - 1) maxReceive = Math.max(maxReceive, ...steps);
      }
      for (const b of r.beats) {
        bodies(b.world).forEach((p, k) => {
          furthest[k] = Math.max(furthest[k], Math.hypot(p.x - startPositions[k].x, p.y - startPositions[k].y));
        });
        for (const p of bodies(b.world)) {
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) notFinite++;
          else if (!insideFivePitch(p)) offPitch++;
        }
      }

      world = r.world; flow = r.flow;
      if (r.stop === "full-time") break;
      // Whatever it stopped for, the move ends and the other side has it — the
      // simplest possible stand-in for the touch this harness is not playing.
      flow = flowAfterTouch(FIVE_A_SIDE, flow, r.stop === "you" ? "them" : "you", world.ball.y);
    }

    // The eight OUTFIELDERS. A keeper who has barely moved has not frozen; he
    // has stayed on his line, which is his job and is the thing that makes the
    // goal defensible — see `keeperHome`.
    // The eight OUTFIELDERS, and what matters is whether each of them ever
    // MOVED — not where he finished. A man who tracks back to the spot he
    // kicked off from has played a match; a man who never left it has not.
    // (A keeper who barely moves has not frozen either: staying on his line is
    // his job, and is what makes the goal defensible — see `keeperHome`.)
    endPositions = bodies(world);
    for (let i = 0; i < 8; i++) {
      men++;
      if (furthest[i] < 3) frozen++;
    }
    travelled += path;
    matches++;
  }

  const meanPath = travelled / matches;
  console.log(`      ball travelled ${meanPath.toFixed(0)} m a match (the old stage: 8.4 m)`);
  check(meanPath > 100, `the ball has to actually travel — ${meanPath.toFixed(1)} m a match, was 8.4`);
  check(frozen === 0, `every outfielder must genuinely move during a match, ${frozen}/${men} never did`);
  check(offPitch === 0, `every beat has to leave everybody on the pitch, ${offPitch} did not`);
  check(notFinite === 0, `and nobody may drift to NaN, ${notFinite} did`);
  check(
    maxStep <= RECEIVE_RUN + 1e-6,
    `nobody may cover more than a run in one beat, somebody covered ${maxStep.toFixed(2)} m`,
  );
  check(
    maxReceive > MAX_BEAT_MOVE,
    `…and running onto a pass really is the exception that goes further, longest was ${maxReceive.toFixed(2)} m`,
  );
}

// ── Territory decides where the chance comes from ───────────────────────
//
// The old model rolled the same ~33% for their chance wherever the ball had
// been lost, which is what made two-nil down the likeliest scoreline. A ball
// lost in your own half has to be more dangerous than one lost in theirs.
{
  const danger = (band: Band) => {
    let theirChances = 0, yourChances = 0, n = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const rng = mulberry32(seed * 6151);
      const world = kickOffWorld(true);
      const flow: FiveFlowState = { ...newFlow(false), band };
      // A short look ahead: what does the next stretch of football produce?
      const r = playOn(FIVE_A_SIDE, world, flow, { difficulty: 0.5, playerSkill: 65 }, rng, 6);
      if (r.stop === "them") theirChances++;
      if (r.stop === "you") yourChances++;
      n++;
    }
    return { them: theirChances / n, you: yourChances / n };
  };

  const deep = danger("own_box");
  const high = danger("box");
  console.log(
    `      a turnover in your own box → their chance ${(deep.them * 100).toFixed(0)}%`
    + `, in theirs → ${(high.them * 100).toFixed(0)}%`,
  );
  check(
    deep.them > high.them * 1.5,
    `losing it in your own box must be far more dangerous than losing it in theirs `
    + `(${(deep.them * 100).toFixed(0)}% vs ${(high.them * 100).toFixed(0)}%)`,
  );
  check(
    high.you > deep.you,
    `…and winning it back high up must be worth more to you `
    + `(${(high.you * 100).toFixed(0)}% vs ${(deep.you * 100).toFixed(0)}%)`,
  );
}

// ── You arrive in a picture with space in it ────────────────────────────
//
// The engine resolves a defender standing on the ball as a tackle before the
// kick has travelled, so a chance handed over with somebody on top of it is
// not a chance. And a chance is only a chance if the goal it is aimed at is
// somewhere near.
{
  setOffsideRuleEnabled(false);
  let calls = 0, crowded = 0, inRange = 0;
  const gaps: number[] = [];
  for (let seed = 1; seed <= 500; seed++) {
    const rng = mulberry32(seed * 32749);
    let world = kickOffWorld(true);
    let flow: FiveFlowState = newFlow(true);
    for (let hop = 0; hop < 6; hop++) {
      const r = playOn(FIVE_A_SIDE, world, flow, { difficulty: 0.5, playerSkill: 65 }, rng, 40);
      world = r.world; flow = r.flow;
      if (r.stop !== "you") {
        if (r.stop === "full-time") break;
        flow = flowAfterTouch(FIVE_A_SIDE, flow, "you", world.ball.y);
        continue;
      }
      calls++;
      const nearest = Math.min(...world.opps.map(o => Math.hypot(o.x - world.ball.x, o.y - world.ball.y)));
      gaps.push(nearest);
      if (nearest < 1.8) crowded++;
      if (world.ball.y <= 15.75) inRange++;
      // The engine has to be willing to play it.
      const sc = buildPassage(world, { keeperStrength: 60, rng });
      const tooClose = sc.defenders.filter(d => Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 1.79).length;
      check(tooClose === 0, `a chance must not arrive with a defender on the ball (${tooClose} were)`);
      flow = flowAfterTouch(FIVE_A_SIDE, flow, "them", world.ball.y);
    }
  }
  console.log(
    `      ${calls} chances, nearest man ${avg(gaps).toFixed(2)} m away on average, `
    + `${(100 * inRange / Math.max(1, calls)).toFixed(0)}% with the goal on screen`,
  );
  check(calls > 300, `enough chances to measure, got ${calls}`);
  check(crowded === 0, `nobody may be standing on the ball when the move finds you, ${crowded} were`);
  // 15.75 m is where `cameraFor` stops drawing the goal on a phone-shaped box.
  // The old stage's ball never once got below 15.03, so this was 0%.
  check(
    inRange / calls > 0.5,
    `most chances must be somewhere the goal is on screen, got ${(100 * inRange / calls).toFixed(0)}%`,
  );
  setOffsideRuleEnabled(true);
}

// ── Their chance is a real chance ───────────────────────────────────────
//
// Built mirrored (see `buildTheirAttack`), so the engine never learns there is
// a second goal. The bug this caught, before it shipped: the band depth was
// mirrored TWICE, so their chances were built with the ball 24.7 m from the
// goal they were attacking and they scored 0.00 goals a match.
{
  let n = 0, sumY = 0, worst = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const rng = mulberry32(seed * 15485863);
    let world = kickOffWorld(false);
    let flow: FiveFlowState = newFlow(false);
    for (let hop = 0; hop < 6; hop++) {
      const r = playOn(FIVE_A_SIDE, world, flow, { difficulty: 0.5, playerSkill: 65 }, rng, 40);
      world = r.world; flow = r.flow;
      if (r.stop === "full-time") break;
      if (r.stop !== "them") { flow = flowAfterTouch(FIVE_A_SIDE, flow, "them", world.ball.y); continue; }
      const sc = buildTheirAttack(world, { keeperStrength: 55, rng });
      n++;
      sumY += sc.ball.y;
      worst = Math.max(worst, sc.ball.y);
      check(
        sc.keeper.y < 7,
        `your keeper has to be in the goal they are shooting at, he was at ${sc.keeper.y.toFixed(1)}`,
      );
      check(sc.defenders.length === 4, "your four outfielders are the ones defending it");
      flow = flowAfterTouch(FIVE_A_SIDE, flow, "you", world.ball.y);
    }
  }
  const mean = sumY / Math.max(1, n);
  console.log(`      ${n} of their chances, struck from ${mean.toFixed(1)} m out (the bug: 24.7 m)`);
  check(n > 200, `enough of their chances to measure, got ${n}`);
  check(mean < 12, `their chances must come from somewhere near your goal, got ${mean.toFixed(1)} m`);
  check(worst < 20, `…and none of them from the far side of halfway, worst was ${worst.toFixed(1)} m`);
}

// ── The same stream is the same football ────────────────────────────────
{
  for (const seed of [3, 77, 4242]) {
    const a = advanceFlow(newFiveMatch(seed), { difficulty: 0.5, playerSkill: 65 });
    const b = advanceFlow(newFiveMatch(seed), { difficulty: 0.5, playerSkill: 65 });
    check(
      JSON.stringify(a.beats) === JSON.stringify(b.beats) && a.stop === b.stop,
      `seed ${seed}: the same save plays the same football, beat for beat`,
    );
    check(a.beats.length > 0, `seed ${seed}: …and there is football to play`);
    check(a.state.draws > 0, `seed ${seed}: …which really was rolled for`);
  }
  // The beats are NOT in the save — a snapshot of ten players ninety times a
  // match has no business in a career file.
  const r = advanceFlow(newFiveMatch(5), { difficulty: 0.5, playerSkill: 65 });
  check(
    !JSON.stringify(r.state).includes("\"beats\""),
    "the beats are thrown away rather than written into the save",
  );
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the CPUs play without you, the ball travels, and the chances are real");
