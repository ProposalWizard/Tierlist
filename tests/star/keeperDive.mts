import {
  buildScenario, initDefenders, stepDefenders, stepKeeper, stepReactions, stepBall,
  launch, keeperAttempt, keeperSaveRadius, type Outcome, type ScenarioKind, type Scenario,
} from "../../lib/star/canvasEngine";
import { POST_L, POST_R } from "../../lib/star/pitch";

/**
 * THE REAL DIVE — measured, not assumed.
 *
 * Requested directly: the keeper must genuinely throw himself at everything
 * (never stand there and do nothing on a goal, never simply appear already
 * holding a ball that was "close enough"), the outcome must not read as
 * decided before he moves, and — the one hard constraint — none of this may
 * make the game noticeably easier or harder than it already was. The only
 * difference that should be FELT is that a top-corner shot now visibly, and
 * sometimes actually, beats a real stretch rather than an invisible radius.
 *
 * That last constraint is the one this file exists to prove, the same way
 * every other rebalance in this suite proves itself: by measuring the real
 * engine, not by trusting the algebra. keeperAttempt's own doc explains WHY
 * the probability ramp is built to be neutral (centred exactly on the old
 * hard cutoff); this is the check that it actually came out that way.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;
const GOAL_CX = (POST_L + POST_R) / 2;
const pct = (n: number, d: number) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;

/** A fresh keeper's real save radius at a given strength — via a real,
 *  freshly-built Scenario (keeperSaveRadius also reads keeper.saves for the
 *  wear-down factor, so a bare partial object isn't a safe stand-in). */
function freshReach(keeperStrength: number): number {
  return keeperSaveRadius(buildScenario("long_range", mulberry32(1), keeperStrength, 60));
}

// ── keeperAttempt's own probability curve, in isolation ─────────────────────
//
// A real Scenario (so keeperStrength/keeper are wired up properly), but the
// keeper's own x is pinned so `dist` is fully controlled by where xCross is
// aimed relative to it — reads back keeperAttempt's own `dist`/`reach`
// rather than a second, hand-rolled copy of the height-scaling math, so
// this can never quietly drift from what the engine itself actually does.
{
  const rng = mulberry32(1);
  const sc = buildScenario("long_range", rng, 62, 60);
  sc.keeper.x = GOAL_CX;
  sc.keeper.saves = 0;
  const reach = keeperSaveRadius(sc);
  // Height is scaled into the same distance keeperAttempt compares against
  // reach (see its own doc) — pinned level with him so xCross alone
  // controls `dist`, which is the one thing this section is varying.
  // Mirrors the engine's own private KEEPER_CENTRE_Z.
  const Z = 0.95;

  function reachRateAt(distRatio: number, n: number): { p: number; attempts: number } {
    let reaches = 0, attempts = 0;
    for (let i = 0; i < n; i++) {
      const r2 = mulberry32(i * 97 + Math.round(distRatio * 1000));
      const xCross = GOAL_CX + distRatio * reach;
      const a = keeperAttempt(sc, xCross, Z, r2);
      if (a.attempts) attempts++;
      if (a.reaches) reaches++;
    }
    return { p: reaches / n, attempts };
  }

  const deep = reachRateAt(0.3, 600);
  check(deep.p > 0.97, `well inside his reach, he gets there essentially every time (${pct(deep.p * 600, 600)})`);

  const atCutoff = reachRateAt(1.0, 800);
  check(atCutoff.p > 0.35 && atCutoff.p < 0.65,
    `right at the old hard cutoff, it is genuinely uncertain rather than a knife-edge (${pct(atCutoff.p * 800, 800)})`);

  const wayOut = reachRateAt(1.5, 600);
  check(wayOut.p < 0.03, `well past his reach, he essentially never gets there (${pct(wayOut.p * 600, 600)})`);
  check(wayOut.attempts > 0, `…but at 1.5x his reach he still THROWS himself at it`);

  const hopeless = reachRateAt(2.2, 600);
  check(hopeless.attempts === 0, `at 2.2x his reach a real keeper would not bother either, and neither does this one`);

  // The ramp is centred, not shifted — the actual property that keeps the
  // aggregate save rate where it was. Sampled at equal offsets either side
  // of the old cutoff, the two reach-rates should mirror each other.
  const below = reachRateAt(0.82, 900).p;
  const above = reachRateAt(1.18, 900).p;
  check(Math.abs((1 - below) - above) < 0.08,
    `equally short of the old cutoff or equally past it, the miss chance is symmetric (${pct((1 - below) * 900, 900)} vs ${pct(above * 900, 900)})`);
}

/**
 * Play a shot deliberately aimed at a controlled point relative to the
 * keeper — not just "past him", a SPECIFIC distance from him — and watch
 * whether it actually goes in and whether a real dive was thrown at it.
 */
function playAimed(kind: ScenarioKind, targetOffset: number, seed: number, keeperStrength = 62) {
  const rng = mulberry32(seed);
  const sc = buildScenario(kind, rng, keeperStrength, 60);
  initDefenders(sc, rng);
  const tx = GOAL_CX + targetOffset;
  const ball = launch(sc, { x: tx - sc.ball.x, y: -Math.max(sc.ball.y, 1) }, 0.92,
    { cx: 0, cy: -0.2 }, { power: 70, technique: 70 }, rng);
  let out: Outcome | null = null;
  for (let i = 0; i < 1200 && !out; i++) {
    stepDefenders(sc, DT, ball.pos, false, ball);
    stepKeeper(sc, DT);
    stepReactions(sc, ball, DT, rng);
    out = stepBall(ball, sc, rng, DT);
  }
  return { out: out ?? "none", sc, ball };
}

// ── Corners are genuinely, measurably harder — the one thing that SHOULD
// have moved ─────────────────────────────────────────────────────────────
{
  const reach = freshReach(62);
  const offsets: [string, number][] = [
    ["dead centre", 0],
    ["a metre out", 1.0],
    ["near the edge of his reach", reach * 0.95],
    ["the extreme far corner", (POST_R - POST_L) / 2 - 0.5],
  ];
  const rates = offsets.map(([label, off]) => {
    let shots = 0, goals = 0;
    for (let seed = 0; seed < 500; seed++) {
      const { out } = playAimed("long_range", off, seed * 7 + Math.round(off * 100) + 1);
      if (out === "none") continue;
      shots++;
      if (out === "goal" || out === "rebound") goals++;
    }
    return { label, off, shots, rate: goals / Math.max(1, shots) };
  });

  for (const r of rates) check(r.shots > 200, `${r.label}: enough shots to read (${r.shots})`);

  console.log("  placement → concede rate:");
  for (const r of rates) console.log(`    ${r.label.padEnd(28)} ${pct(r.rate * r.shots, r.shots)}`);

  check(rates[3].rate > rates[0].rate + 0.12,
    `the extreme corner concedes noticeably more often than dead centre (${pct(rates[3].rate * rates[3].shots, rates[3].shots)} vs ${pct(rates[0].rate * rates[0].shots, rates[0].shots)})`);
  check(rates[3].rate > rates[1].rate,
    `…and more than a shot that merely wasn't straight at him`);
}

// ── A near-miss is SEEN, not silent ─────────────────────────────────────────
//
// "No dive at all for a genuinely hopeless ball" is already proven directly
// and cleanly by the very first section above (keeperAttempt.attempts is
// false past 2.2x his reach — checked with his position and the crossing
// point both fully controlled). Re-proving it by PINNING a keeper's
// position and firing a shot at a fixed far post turns out not to be a
// clean re-check of the same thing: found by measuring, not assumed — a
// pinned keeper does not stay pinned for the ~1.5 s a long-range shot
// spends in flight, because the pre-existing "adjusting" shade (he tracks
// the ball being moved, same as he always has — see the Keeper doc in
// canvasEngine.ts) legitimately nudges him back toward its live line over
// that time, which can turn a deliberately-staged "hopeless" gap into a
// genuinely reachable one before the shot ever arrives. That is correct,
// unrelated, pre-existing behaviour, not something this rework should
// fight past with an artificial setup — so the integration-level check
// here is the positive half only, which the natural (unpinned) engine
// answers cleanly.
{
  const reach = freshReach(62);
  let nearGoals = 0, nearDived = 0, nearTotal = 0;

  for (let seed = 0; seed < 500; seed++) {
    // Just past his real reach — squarely in the "throws himself at it but
    // doesn't quite make it" band.
    const near = playAimed("long_range", reach * 1.15, seed * 13 + 3);
    if (near.out === "goal" || near.out === "rebound") {
      nearTotal++;
      if (near.sc.keeper.saveLunge > 0) nearDived++;
      nearGoals++;
    }
  }

  check(nearGoals > 30, `enough near-miss goals to read (${nearGoals})`);
  check(nearDived / Math.max(1, nearTotal) > 0.7,
    `a shot that only just beat him is SEEN beating him — a real, failed dive, not silence (${pct(nearDived, nearTotal)} of ${nearTotal})`);
}

// ── The actual promise: real shots, old rule vs new, side by side ──────────
//
// Everything above tests a piece of the mechanism. This tests the whole
// claim directly: across a realistic spread of aim (not a hand-picked
// offset), does the OLD hard-cutoff formula's prediction for the same
// sample of real shots land close to what the new, real engine actually
// does with them? `dist`/`reach` are captured exactly the way finishing.mts
// already measures "how far from the keeper it crossed" for a receiver's
// shot — the old rule's own verdict is simply `dist < reach`, recomputed
// here from the same numbers rather than a second copy of the formula.
//
// Captured at the KEEPER'S line (y = k.y), not the true goal line (y = 0) —
// a save/catch never reaches y = 0 at all (it is stopped at his own line;
// see stepBall's own "THE KEEPER'S OWN LINE" section), so measuring at the
// goal line the way finishing.mts does for a receiver's ALREADY-UNCONTESTED
// shot would silently drop every genuinely saved attempt from this sample
// — found by measuring a first version of this section that came back
// showing an impossible 100% concede rate, not assumed. `dist` mirrors
// keeperAttempt's own height-scaled distance (not just the x-gap) using
// its two private constants' real values, so it is measuring the same
// thing the engine itself compares against `reach`, just from outside.
//
// Only `out === "goal"` counts as a concede here, deliberately not
// `"rebound"` too — also found by measuring, not assumed. A first version
// of this counted both and came back showing an apparent ~9-point swing
// toward "easier", which survived even cutting the quality band in half —
// the real cause turned out to be a second, pre-existing mechanic entirely:
// a save that stays live can be followed in and scored a few frames later
// (resolveKeeper's own parry/rebound logic, unrelated to and unchanged by
// this rework), and that follow-up shot was being misread as if THIS
// formula had let the original one through. `"goal"` only — a shot that
// beat him outright, on its own first contact — is what this formula
// actually decides, so it's the only fair thing to compare against `dist`
// and `reach`, which describe that same first contact.
{
  const CENTRE_Z = 0.95, Z_SCALE = 1.15; // mirror canvasEngine.ts's own private constants
  let shots = 0, oldRuleGoals = 0, newRealGoals = 0;
  for (let seed = 0; seed < 4500; seed++) {
    const rng = mulberry32(seed * 733 + 5);
    const sc = buildScenario("long_range", rng, 55 + rng() * 20, 60);
    initDefenders(sc, rng);
    const reach = keeperSaveRadius(sc); // saves === 0 here, so this IS the reach in force
    const keeperY = sc.keeper.y;
    const side = rng() < 0.5 ? -1 : 1;
    const tx = GOAL_CX + side * ((POST_R - POST_L) / 2 - 0.5) * rng(); // anywhere across the face of goal
    const ball = launch(sc, { x: tx - sc.ball.x + (rng() - 0.5), y: -Math.max(sc.ball.y, 1) }, 0.85 + rng() * 0.15,
      { cx: (rng() - 0.5) * 0.6, cy: -0.1 - rng() * 0.35 }, { power: 55 + rng() * 30, technique: 55 + rng() * 30 }, rng);
    const keeperAt = sc.keeper.x;
    let out: Outcome | null = null, crossed = false, dist = -1;
    let prevX = ball.pos.x, prevY = ball.pos.y, prevZ = ball.z;
    for (let i = 0; i < 1200 && !out; i++) {
      stepDefenders(sc, DT, ball.pos, false, ball);
      stepKeeper(sc, DT);
      stepReactions(sc, ball, DT, rng);
      prevX = ball.pos.x; prevY = ball.pos.y; prevZ = ball.z;
      out = stepBall(ball, sc, rng, DT);
      if (!crossed && prevY > keeperY && ball.pos.y <= keeperY) {
        const f = (prevY - keeperY) / (prevY - ball.pos.y || 1);
        const xAt = prevX + (ball.pos.x - prevX) * f;
        const zAt = prevZ + (ball.z - prevZ) * f;
        dist = Math.hypot(xAt - keeperAt, (zAt - CENTRE_Z) * Z_SCALE);
        crossed = true;
      }
    }
    if (!crossed || out === "wide" || out === "post" || out === "blocked" || out === "tackled" || out === "out") continue;
    shots++;
    if (dist >= reach) oldRuleGoals++;
    if (out === "goal") newRealGoals++;
  }
  check(shots > 1500, `enough real, on-target shots to read (${shots})`);
  const diff = (newRealGoals - oldRuleGoals) / shots;
  console.log(`  old-rule-predicted: ${pct(oldRuleGoals, shots)}   new engine actual: ${pct(newRealGoals, shots)}   diff: ${(diff * 100).toFixed(1)}pp`);
  // A few points either way, not a redesign — real sampling noise alone is
  // part of this width (measured directly: a ~900-shot sample swung by
  // over a point run to run at an otherwise-identical setting), not just
  // headroom for the deliberate mistake chance on the "easier" side.
  check(diff > -0.05 && diff < 0.05,
    `the aggregate concede rate is where the old formula already put it (${(diff * 100).toFixed(1)}pp on ${pct(oldRuleGoals, shots)})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the dive is real and the corners are the difference, not the aggregate difficulty");
