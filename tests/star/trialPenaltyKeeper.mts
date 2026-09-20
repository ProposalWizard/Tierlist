import {
  launch, stepBall, stepKeeper, stepDefenders, stepBallInNet,
  type Ball, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { PEN_SPOT_Y } from "../../lib/star/pitch";
import { startTrial } from "../../lib/star/trial";
import {
  buildPenaltyScenario, keeperDrawPose,
} from "../../components/star/stages/TrialPenalties";

/**
 * THE TRIAL PENALTY KEEPER DOES NOT FLIP.
 *
 * Reported directly: "the goalie is doing the complete wrong thing… diving one
 * way before diving towards the ball. It's still broken." He leaned/set himself
 * to one side (his guess) and then, once the ball was struck, dived the OTHER
 * way onto the ball — even a ball he had no chance of reaching. A real penalty
 * keeper commits to a side before the kick and dives THAT way, right sometimes
 * and wrong sometimes; he does not un-commit in flight.
 *
 * The engine's own save test (`stepBall`, "THE KEEPER'S OWN LINE") points the
 * keeper's `x`/`saveDir`/`dive` straight at the ball's crossing point the moment
 * it reaches his line — correct for a ball he reaches (a save IS toward the
 * ball), wrong for one he never gets near. `keeperDrawPose` (TrialPenalties.tsx)
 * is where the trial re-commits a BEATEN penalty keeper to the side he actually
 * set himself on. This file proves it two ways: a pure unit check of every
 * branch, and an end-to-end run of the real engine across many seeds, forcing
 * kicks to the OPPOSITE side from his guess (the exact case that used to flip).
 *
 * The builder and the pose function are imported from the component itself, not
 * re-derived — the same discipline trialStageScreens.mts follows, so a local
 * copy can't pass while the screen does something else.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const DT = 1 / 60;

// ── 1. keeperDrawPose, every branch, in isolation ───────────────────────────
//
// goalCentreX = 100 throughout; the numbers are chosen so "toward the ball" and
// "toward his committed side" are OPPOSITE, which is the only case that can flip.
{
  const GC = 100;

  // Committed LEFT (startX left of centre), engine dragging him RIGHT toward a
  // ball that beat him on the open side: saveDir +1, x pulled right of startX.
  const beatenLeftGuess = keeperDrawPose(
    { x: 101.5, startX: 98.5, dive: 1.2, saveDir: 1, saveLunge: 0.6, saves: 0 },
    true, GC,
  );
  check(beatenLeftGuess.dive < 0,
    `beaten penalty, guessed left: must dive LEFT (his guess), got dive=${beatenLeftGuess.dive}`);
  check(beatenLeftGuess.x <= 98.5,
    `beaten penalty, guessed left: body must go LEFT of his set spot, got x=${beatenLeftGuess.x}`);

  // Committed RIGHT, engine dragging him LEFT toward the open-side ball.
  const beatenRightGuess = keeperDrawPose(
    { x: 98.5, startX: 101.5, dive: 1.2, saveDir: -1, saveLunge: 0.6, saves: 0 },
    true, GC,
  );
  check(beatenRightGuess.dive > 0,
    `beaten penalty, guessed right: must dive RIGHT (his guess), got dive=${beatenRightGuess.dive}`);
  check(beatenRightGuess.x >= 101.5,
    `beaten penalty, guessed right: body must go RIGHT of his set spot, got x=${beatenRightGuess.x}`);

  // A SAVE (saves > 0) — even a penalty save dives toward the ball, because he
  // genuinely got there. saveDir toward the ball must be honoured.
  const saved = keeperDrawPose(
    { x: 101, startX: 98.5, dive: 1.0, saveDir: 1, saveLunge: 0.8, saves: 1 },
    true, GC,
  );
  check(saved.dive > 0,
    `penalty save: must dive toward the ball (saveDir), got dive=${saved.dive}`);
  check(saved.x === 101,
    `penalty save: drawn at engine x (he reached it), got x=${saved.x}`);

  // A FREE KICK — the keeper genuinely reads it off the boot, so the reactive
  // dive toward the ball is right even when it opposes where he was standing.
  const freeKick = keeperDrawPose(
    { x: 101.5, startX: 98.5, dive: 1.2, saveDir: 1, saveLunge: 0.6, saves: 0 },
    false, GC,
  );
  check(freeKick.dive > 0,
    `free kick beaten: reactive dive toward the ball is kept, got dive=${freeKick.dive}`);
  check(freeKick.x === 101.5,
    `free kick: drawn at engine x, got x=${freeKick.x}`);

  // PRE-STRIKE (no lunge yet, dive settled to 0): set on his line, upright, at x.
  const preStrike = keeperDrawPose(
    { x: 98.5, startX: 98.5, dive: 0, saveDir: 0, saveLunge: 0, saves: 0 },
    true, GC,
  );
  check(preStrike.dive === 0 && preStrike.lunge === 0 && preStrike.x === 98.5,
    `pre-strike: upright on his set spot, got ${JSON.stringify(preStrike)}`);
}

// ── 2. The real engine, forced to the opposite side from his guess ──────────
//
// Runs the exact flight substep loop StrikeStage uses. For each rep it reads
// the keeper's committed side off startX and aims at the OPPOSITE corner, which
// is precisely the kick that used to make him flip. Records the sign of the
// drawn dive on every frame the lunge is live, and — for every attempt he was
// genuinely BEATEN on (he threw himself but never got a touch) — asserts the
// drawn dive is always his committed side and never once the ball's side.
{
  const rng0 = mulberry32(12345);
  const trial = startTrial(Math.floor(rng0() * 1e9));

  let beaten = 0;          // attempts he lunged at but never touched
  let saved = 0;           // attempts he got a hand to
  let flipsAvoided = 0;    // beaten attempts where the ball's side ≠ his guess
  const skills = { power: 78, technique: 70 };

  for (let seed = 0; seed < 900; seed++) {
    const rng = mulberry32((seed * 0x9e3779b1) >>> 0);
    const rep = seed % 4;
    const sc: Scenario = buildPenaltyScenario(trial, rep, rng);
    const goalCx = (sc.goal.x1 + sc.goal.x2) / 2;
    const committed = Math.sign(sc.keeper.startX - goalCx);
    if (committed === 0) continue; // never happens for a penalty, but be safe

    // Aim at the corner on the OPPOSITE side to his guess — the flip case.
    // Just inside the far post, driven low: dir points from the spot to there.
    const farPost = committed > 0 ? sc.goal.x1 : sc.goal.x2;
    const targetX = farPost + committed * 0.9; // 0.9m inside the post
    const dir = { x: targetX - sc.ball.x, y: -(PEN_SPOT_Y + 0.2) };
    const contact = { cx: committed > 0 ? -0.35 : 0.35, cy: -0.15 };

    const ball: Ball = launch(sc, dir, 0.9, contact, skills, rng);

    let outcome: Outcome | null = null;
    let t = 0;
    const signs: number[] = [];      // nonzero drawn-dive signs while lunging
    const drawSides: number[] = [];  // the ball-side the engine wanted (saveDir)

    for (let frame = 0; frame < 600 && !outcome; frame++) {
      t += DT;
      if (ball.inNet) { stepBallInNet(ball, DT); }
      else {
        for (let i = 0; i < 3 && !outcome; i++) {
          const h = DT / 3;
          stepDefenders(sc, h, sc.player, false, ball);
          stepKeeper(sc, h);
          const res = stepBall(ball, sc, rng, h);
          if (res) { outcome = res; if (!ball.overBar) ball.settling = true; }
        }
      }
      // Sample the drawn pose exactly as paintTrialScene would this frame.
      if (sc.keeper.saveLunge > 0) {
        const pose = keeperDrawPose(sc.keeper, true, goalCx);
        if (Math.sign(pose.dive) !== 0) signs.push(Math.sign(pose.dive));
        if (sc.keeper.saveDir !== 0) drawSides.push(sc.keeper.saveDir);
      }
      if (t > 9) break;
    }

    if (sc.keeper.saveLunge <= 0) continue; // he never went — nothing to judge

    if (sc.keeper.saves > 0) { saved++; continue; }
    beaten++;

    // Every frame he was drawn diving, it must be his committed side — never
    // the other way, and never a flip between frames.
    const allCommitted = signs.length > 0 && signs.every(s => s === committed);
    check(allCommitted,
      `seed ${seed}: beaten penalty drew dive signs ${JSON.stringify(signs)}, `
      + `committed=${committed} — must all equal his guess (no flip)`);

    // The engine genuinely wanted to send him the OTHER way (that's the bug we
    // are correcting) — confirm the test is exercising the real flip case.
    if (drawSides.some(s => s === -committed)) flipsAvoided++;
  }

  check(beaten >= 30,
    `expected to observe many beaten penalties, only saw ${beaten} — test not exercising the case`);
  check(flipsAvoided >= 20,
    `expected the engine to want to flip on many beaten kicks (proving the fix bites), `
    + `only ${flipsAvoided} — aim harness may not be forcing the opposite side`);

  // eslint-disable-next-line no-console
  console.log(
    `[trialPenaltyKeeper] beaten=${beaten} saved=${saved} `
    + `engine-would-have-flipped-but-didn't=${flipsAvoided}`,
  );
}

if (problems.length) {
  console.error("trialPenaltyKeeper FAILED:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("trialPenaltyKeeper: all checks passed");
