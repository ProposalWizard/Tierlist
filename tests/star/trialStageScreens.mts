import { readFileSync } from "node:fs";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders,
  VIEW_ASPECT, type Ball, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { POST_L, POST_R, NET_DEPTH, CX, PEN_SPOT_Y } from "../../lib/star/pitch";
import { startTrial, type TrialProgress } from "../../lib/star/trial";
import {
  REPS, freeKickSetup, visionSetup, penaltySetup, attemptSeed, penaltyTell,
  PENALTY_COMMIT_M,
} from "../../lib/star/trialStages";
import {
  buildPenaltyScenario, strikeCamera, AIM_ARROW_LENGTH, commitKeeperGuess,
  SETTLE_BEFORE_BANNER, ownSideBodies, takerSpot, keeperDive,
} from "../../components/star/stages/TrialPenalties";
import {
  buildFreeKickScenario, freeKickView, freeKickWall,
} from "../../components/star/stages/TrialFreeKicks";
import { layoutVision } from "../../components/star/stages/TrialVision";
import { ELEVEN_A_SIDE_ATTACK, rulesAreSane } from "../../lib/star/fiveASide/rules";
import {
  cameraContaining, FIGURE_HEIGHT_R, FIGURE_HEAD_R,
} from "../../lib/star/fiveASide/render";

/**
 * THE THREE TRIAL-STAGE SCREENS — the parts of them that are not a browser.
 *
 * A canvas, a thumb and a countdown cannot be checked here and are not
 * pretended to be. What CAN be checked is everything those three things are
 * pointed at: the scenario each striking rep is actually built from, the
 * camera it is framed by, and the picture the vision stage draws.
 *
 * The builders are imported from the components themselves rather than
 * re-derived here. That is deliberate: this codebase has already been caught
 * once by a test whose own fixture encoded the bug it was meant to catch
 * (castDefence, tests/star/lineup.mts), and a local copy of "build a free
 * kick the way the screen does" would pass happily while the screen did
 * something else.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Strike a built scenario roughly at goal and run the real 3-substep loop
 *  the screens themselves run — including their deliberate omission of
 *  `stepReactions` — until the engine says what happened. Returns null if it
 *  never resolves, which is itself the interesting answer: a rep that never
 *  ends would strand the whole trial on a screen with no way forward. */
function strikeAndResolve(sc: Scenario, rng: () => number, cy: number): Outcome | null {
  const dir = { x: CX - sc.ball.x, y: -sc.ball.y };
  const ball: Ball = launch(sc, dir, 0.85, { cx: 0, cy }, { power: 60, technique: 60 }, rng);
  const dt = 1 / 60;
  // Ten seconds of match time, comfortably past the engine's own dead-ball
  // timeout and past the screen's own safety cut-off.
  for (let f = 0; f < 600; f++) {
    for (let i = 0; i < 3; i++) {
      const h = dt / 3;
      stepDefenders(sc, h, sc.player, false, ball);
      stepKeeper(sc, h);
      const res = stepBall(ball, sc, rng, h);
      if (res) return res;
    }
  }
  return null;
}

// ── 1. The free-kick camera ────────────────────────────────────────────────
//
// The engine frames a free kick for the ball IT chose, so the drill's own
// frame has to be computed from the drill's own spot. Everything the player
// has to be able to see has to be inside it, at every rung of the ladder.
{
  let tallest = 0;
  for (let s = 0; s < 120; s++) {
    const trial = startTrial(1000 + s * 7919);
    for (let rep = 0; rep < REPS.freeKicks; rep++) {
      const setup = freeKickSetup(trial, rep);
      const vp = freeKickView(setup.ball);
      const w = vp.x2 - vp.x1, h = vp.y2 - vp.y1;
      tallest = Math.max(tallest, h);
      check(Math.abs(w / h - VIEW_ASPECT) < 1e-9, "free-kick frame is not the canvas aspect");
      check(vp.x1 <= POST_L && vp.x2 >= POST_R, "free-kick frame cuts off the goal mouth");
      check(vp.y1 <= -NET_DEPTH, "free-kick frame cuts off the net");
      check(setup.ball.x > vp.x1 && setup.ball.x < vp.x2, "the ball is off the side of the frame");
      check(setup.ball.y > vp.y1 && setup.ball.y < vp.y2, "the ball is off the end of the frame");
      // The drag pulls BACK from the ball, so the room behind it is the whole
      // gesture — a frame that ends at the ball's own feet cannot be aimed in.
      check(vp.y2 - setup.ball.y >= 6.5, "no room behind the ball to drag back into");
    }
  }
  // The frame is allowed to grow so that a thirty-metre free kick is drawn
  // further away than a sixteen-metre one (see freeKickView's own note on why
  // the engine's fixed-zoom fitToView is wrong here) — but only just, or it
  // stops looking like the same camera as the rest of the game.
  check(tallest < 48, `the free-kick camera zooms out too far (tallest frame ${tallest.toFixed(1)} m)`);
}

// ── 2. The wall ────────────────────────────────────────────────────────────
{
  for (let s = 0; s < 120; s++) {
    const trial = startTrial(50_000 + s * 104_729);
    for (let rep = 0; rep < REPS.freeKicks; rep++) {
      const setup = freeKickSetup(trial, rep);
      const wall = freeKickWall(setup);
      check(wall.length === Math.max(1, Math.round(setup.wall)),
        "the wall is not the size the drill asked for");
      for (const man of wall) {
        const d = dist(man, setup.ball);
        // 9.15 m along the shot line, plus however far along the wall he
        // stands — a five-man wall's outside men are a little further away.
        check(d > 8.9 && d < 9.9, `a wall man stands ${d.toFixed(2)} m from the ball`);
        check(man.y < setup.ball.y - 4, "a wall man is not between the ball and the goal");
      }
    }
  }
}

// ── 3. The free-kick rep, built the way the screen builds it ───────────────
{
  let jumped = 0, built = 0, resolved = 0;
  for (let s = 0; s < 40; s++) {
    const trial = startTrial(900_000 + s * 7717);
    for (let rep = 0; rep < REPS.freeKicks; rep++) {
      const setup = freeKickSetup(trial, rep);
      const sc = buildFreeKickScenario(trial, rep, mulberry32((s * 31 + rep) >>> 0));
      built++;

      check(sc.ball.x === setup.ball.x && sc.ball.y === setup.ball.y,
        "the free kick is not taken from the drill's own spot");
      check(sc.keeperStrength === setup.keeperStrength,
        "the drill's keeper never reached the scenario");
      check(sc.defenders.length === Math.max(1, Math.round(setup.wall)),
        "the scenario's defenders are not the drill's wall");
      // THE ORDERING THE FILE WARNS ABOUT. `initDefenders` is what gives each
      // man his hold role and the containT the jump is timed off; a wall
      // swapped in afterwards would stand there and never leave the ground.
      for (const d of sc.defenders) {
        check(d.baseRole === "hold", "a wall man was never given his dead-ball role");
        check(d.homeX !== undefined, "a wall man was never initialised");
      }

      // And the jump itself, through the real engine.
      const ball: Ball = launch(
        sc, { x: CX - sc.ball.x, y: -sc.ball.y }, 0.8, { cx: 0, cy: 0.4 },
        { power: 60, technique: 60 }, mulberry32(7),
      );
      let peak = 0;
      for (let i = 0; i < 40; i++) {
        stepDefenders(sc, 1 / 180, sc.player, false, ball);
        peak = Math.max(peak, ...sc.defenders.map(d => d.z ?? 0));
      }
      if (peak > 0.2) jumped++;

      // A fresh scenario for the resolution check — the one above has been
      // stepped without its ball moving, which is not a real flight.
      const fresh = buildFreeKickScenario(trial, rep, mulberry32((s * 31 + rep) >>> 0));
      if (strikeAndResolve(fresh, mulberry32(99 + rep), 0.4) !== null) resolved++;
    }
  }
  check(jumped === built, `only ${jumped}/${built} walls actually jumped`);
  check(resolved === built, `only ${resolved}/${built} free kicks ever resolved`);
}

// ── 4. The penalty rep ─────────────────────────────────────────────────────
{
  let leaned = 0, leanedRight = 0, resolved = 0, built = 0;
  for (let s = 0; s < 120; s++) {
    const trial = startTrial(31_337 + s * 6151);
    for (let rep = 0; rep < REPS.penalties; rep++) {
      const setup = penaltySetup(trial, rep);
      const sc = buildPenaltyScenario(trial, rep, mulberry32((s * 17 + rep) >>> 0));
      built++;

      check(sc.ball.x === CX && sc.ball.y === PEN_SPOT_Y, "the penalty is not on the spot");
      check(sc.keeperStrength === setup.keeperStrength, "the trial's keeper never reached the scenario");
      // A lean he can actually dive from: `stepKeeper` bounds his travel
      // relative to startX, so leaving startX behind would make the lean
      // cosmetic — he would simply slide back to the middle.
      check(sc.keeper.startX === sc.keeper.x && sc.keeper.targetX === sc.keeper.x,
        "the keeper leans but dives from somewhere else");
      check(sc.keeper.x >= POST_L - 2.5 && sc.keeper.x <= POST_R + 2.5,
        "the keeper has leaned himself off the goal");

      // Only counted where the lean is big enough to beat buildPenalty's own
      // ±0.6 m of jitter on where he starts — a lean of 0.45 moves him 0.675 m,
      // which is the point at which the sign stops being the jitter's to
      // decide. Below that it genuinely is not the lean's call, and asserting
      // on it would be asserting on a coin flip.
      if (Math.abs(setup.keeperLean) > 0.45) {
        leaned++;
        if (Math.sign(sc.keeper.x - CX) === Math.sign(setup.keeperLean)) leanedRight++;
      }

      if (strikeAndResolve(sc, mulberry32(4242 + rep), -0.2) !== null) resolved++;
    }
  }
  check(leaned > 60, `only ${leaned} real leans — not enough to judge the direction`);
  check(leanedRight === leaned, `${leaned - leanedRight}/${leaned} keepers leaned the wrong way`);
  check(resolved === built, `only ${resolved}/${built} penalties ever resolved`);
}

// ── 5. The vision picture ──────────────────────────────────────────────────
//
// The one claim the whole stage rests on: the right man is genuinely the
// freest man ON SCREEN. `visionQuality` scores you against `setup.correct`,
// so a picture where somebody else looks freer is not a hard rep, it is an
// unanswerable one.
{
  let pictures = 0, fullMargin = 0, worstGapShare = Infinity;
  let tightest = Infinity;
  for (let level = 0; level <= 100; level += 5) {
    for (let rep = 0; rep < REPS.vision; rep++) {
      // A trial whose difficulty IS this rung, so the whole ladder is walked
      // rather than whatever a handful of random trials happened to roll.
      const trial = { ...startTrial(77_000 + level * 13 + rep), baseDifficulty: level / 100 };
      for (const st of Object.keys(trial.stageRolls) as (keyof typeof trial.stageRolls)[]) {
        trial.stageRolls[st] = 0;
      }
      const setup = visionSetup(trial, rep);
      const l = layoutVision(setup, trial.seed, rep);
      pictures++;

      check(l.men.length === setup.options, "the picture has the wrong number of options");

      const spaces = l.men.map(m => m.space);
      const best = Math.max(...spaces);
      check(spaces[setup.correct] === best, "the right man is not the freest man on screen");
      check(spaces.filter(v => v === best).length === 1, "two men are equally free");
      check(l.gap > 0, "the right man is only joint-freest");
      if (l.gap >= setup.margin * 0.6) fullMargin++;
      worstGapShare = Math.min(worstGapShare, l.gap / setup.margin);

      // Readable as a picture, not just as arithmetic: two team-mates drawn
      // on top of each other would make the freest man impossible to tap
      // even once you had spotted him.
      for (let i = 0; i < l.men.length; i++) {
        for (let j = i + 1; j < l.men.length; j++) {
          tightest = Math.min(tightest, dist(l.men[i], l.men[j]));
        }
      }

      // Same seed, same rep, same picture — closing the app cannot re-roll a
      // rep whose answer you have already seen.
      const again = layoutVision(setup, trial.seed, rep);
      check(JSON.stringify(again) === JSON.stringify(l), "the same rep drew a different picture");
    }
  }
  check(fullMargin === pictures,
    `${pictures - fullMargin}/${pictures} pictures fell short of the margin the drill asked for`);
  check(tightest > 3, `two team-mates were drawn ${tightest.toFixed(2)} m apart`);
  check(worstGapShare > 0.55, `worst gap was only ${(worstGapShare * 100).toFixed(0)} % of the margin`);
}

// ── 6. Somebody else finishing it ──────────────────────────────────────────
//
// Both striking stages score YOUR strike, and both grade a goal somebody else
// finished as a save rather than as a 1.0. Leaving `stepReactions` out of the
// loop LOOKS like it should make that impossible — and the guard was very
// nearly documented as dead code on exactly that reasoning. It is not:
// `stepBall` has its own way onto a loose ball. So this pins down the real
// shape of it instead. It must genuinely happen, or the guard is untested;
// and it must stay a small minority, or the stage is quietly scoring
// somebody else's finishing rather than yours.
{
  let attempts = 0, touched = 0, woke = 0;
  // 60 seeds, not 40: the sample size here was implicitly tied to the rep
  // count (40 x 8 attempts cleared the 300 bar with room), and the striking
  // stages have since gone from four kicks each to three. Raising the seeds
  // keeps the same sample rather than lowering the bar to fit.
  for (let s = 0; s < 60; s++) {
    const trial = startTrial(606_060 + s * 3391);
    for (let rep = 0; rep < REPS.penalties; rep++) {
      const sc = buildPenaltyScenario(trial, rep, mulberry32((s * 13 + rep) >>> 0));
      strikeAndResolve(sc, mulberry32(s + rep), rep % 2 ? 0.35 : -0.25);
      attempts++;
      if (sc.receiverShot) touched++;
      if (sc.follower.active) woke++;
    }
    for (let rep = 0; rep < REPS.freeKicks; rep++) {
      const sc = buildFreeKickScenario(trial, rep, mulberry32((s * 29 + rep) >>> 0));
      strikeAndResolve(sc, mulberry32(s * 3 + rep), 0.4);
      attempts++;
      if (sc.receiverShot) touched++;
      if (sc.follower.active) woke++;
    }
  }
  check(attempts > 300, "not enough struck attempts to be worth measuring");
  check(touched > 0, "no attempt was ever finished by a team-mate — the guard is untested");
  check(touched < attempts * 0.1,
    `${touched}/${attempts} attempts were finished by somebody else — too many to call rare`);
  // And the reason it stays rare: nothing ever sends him chasing, because the
  // loop does not call `stepReactions`. Worth asserting separately, because it
  // is the difference between "rare" and "one line away from common".
  check(woke === 0, `${woke}/${attempts} attempts woke the poacher without stepReactions`);
}

// ── 7. A RESUME REDRAWS THE PICTURE, NOT JUST THE ANSWER INSIDE IT ─────────
//
// `visionSetup` moving `correct` with the resume count is only half of it. If
// the PICTURE stayed the same, a resumed stage would show you the same six
// arrangements of men with the right answer moved — which is still most of the
// way to a memory test, because the picture is the thing you remember. So the
// layout is seeded from the same `attemptSeed`, and this checks it.
{
  let differed = 0, trials = 0, sameWhenNotResumed = 0;
  for (let seed = 0; seed < 150; seed++) {
    const a = startTrial(seed);
    const b = { ...a, reloads: a.reloads + 1 };
    trials++;

    const layoutsA = Array.from({ length: REPS.vision }, (_, rep) =>
      JSON.stringify(layoutVision(visionSetup(a, rep), attemptSeed(a), rep)));
    const layoutsB = Array.from({ length: REPS.vision }, (_, rep) =>
      JSON.stringify(layoutVision(visionSetup(b, rep), attemptSeed(b), rep)));
    if (layoutsA.every((l, i) => l !== layoutsB[i])) differed++;

    // …and the other half of the same rule: WITHOUT a resume, the picture is
    // still exactly itself, so leaving the app between stages costs nothing.
    const again = Array.from({ length: REPS.vision }, (_, rep) =>
      JSON.stringify(layoutVision(visionSetup(a, rep), attemptSeed(a), rep)));
    if (again.every((l, i) => l === layoutsA[i])) sameWhenNotResumed++;
  }
  check(differed === trials,
    `${trials - differed}/${trials} resumed trials redrew at least one identical vision picture`);
  check(sameWhenNotResumed === trials,
    "a trial that was NOT resumed drew a different picture — a reload must not lose your place");

  // The answers move too, which is `trialStages.mts`'s own test; here it is
  // only worth confirming the two are not accidentally the same change.
  const a = startTrial(11), b = { ...a, reloads: 1 };
  check(
    Array.from({ length: REPS.vision }, (_, r) => visionSetup(a, r).correct).join(",")
      !== Array.from({ length: REPS.vision }, (_, r) => visionSetup(b, r).correct).join(","),
    "the right man is the same man after a resume",
  );
}

// ── 8. THE CAMERA, which is why the screen no longer runs off the phone ────
//
// Measured on a simulated iPhone 13 before this: the penalties canvas was
// `aspectRatio: 5 / 8` with no height cap and ran 108 px off the bottom of a
// 664 px viewport — the first screen of a new career, a third of it below the
// fold. The fix is a phone-shaped, height-capped box plus a camera that fits
// the SHOT to the SCREEN. What that camera must guarantee is checked here at
// every canvas shape a phone can actually be.
{
  // Real phone canvas shapes, and two deliberately extreme ones — the box is
  // capped against the viewport, so it genuinely does end up short and wide on
  // a small screen, and that is exactly when a fixed-frame camera would crop.
  const SHAPES = [[356, 445], [356, 343], [356, 250], [390, 600], [300, 300], [430, 200]];

  for (let s = 0; s < 60; s++) {
    const trial = startTrial(2_000_000 + s * 7919);

    for (let rep = 0; rep < REPS.penalties; rep++) {
      const sc = buildPenaltyScenario(trial, rep, mulberry32((s * 7 + rep) >>> 0));
      for (const [W, H] of SHAPES) {
        const cam = strikeCamera(sc, sc.ball, W, H);
        const w = cam.x2 - cam.x1, h = cam.y2 - cam.y1;
        // Square pixels, or every distance on screen lies about itself.
        check(Math.abs(w / h - W / H) < 1e-6, `penalty camera is not the canvas shape at ${W}x${H}`);
        check(cam.x1 <= POST_L && cam.x2 >= POST_R, "penalty camera cuts off the goal mouth");
        check(cam.y1 <= -NET_DEPTH, "penalty camera cuts off the net");
        check(sc.ball.x > cam.x1 && sc.ball.x < cam.x2, "the ball is off the side of the shot");
        check(sc.ball.y > cam.y1 && sc.ball.y < cam.y2, "the ball is off the end of the shot");
        // The drag pulls BACK from the ball, so the room behind it is the whole
        // gesture — a shot that ended at the ball's own feet could not be aimed.
        check(cam.y2 - sc.ball.y >= 6.5, "no room behind the ball to drag back into");
        // And the men in the way, whole. A frame that stopped at the drag room
        // sliced both of a penalty's defenders off at the bottom edge — seen in
        // a screenshot after the first version of this shipped.
        for (const d of sc.defenders) {
          check(d.x > cam.x1 && d.x < cam.x2 && d.y > cam.y1 && d.y < cam.y2,
            "a man in the way is drawn half off the screen");
        }
      }
    }

    for (let rep = 0; rep < REPS.freeKicks; rep++) {
      const sc = buildFreeKickScenario(trial, rep, mulberry32((s * 13 + rep) >>> 0));
      for (const [W, H] of SHAPES) {
        const cam = strikeCamera(sc, sc.ball, W, H);
        check(Math.abs((cam.x2 - cam.x1) / (cam.y2 - cam.y1) - W / H) < 1e-6,
          `free-kick camera is not the canvas shape at ${W}x${H}`);
        check(cam.x1 <= POST_L && cam.x2 >= POST_R, "free-kick camera cuts off the goal mouth");
        check(cam.y1 <= -NET_DEPTH, "free-kick camera cuts off the net");
        check(sc.ball.x > cam.x1 && sc.ball.x < cam.x2, "the free kick is off the side of the shot");
        check(cam.y2 - sc.ball.y >= 6.5, "no room behind the free kick to drag back into");
        for (const d of sc.defenders) {
          check(d.x > cam.x1 && d.x < cam.x2 && d.y > cam.y1 && d.y < cam.y2,
            "a wall man is drawn half off the screen");
        }
      }
    }
  }

  // `cameraContaining` itself: it must GROW, never crop. That is the whole
  // difference between it and `cameraFor`, and it is what the vision stage —
  // a picture you read in one look — depends on.
  const must = { x1: 10, x2: 40, y1: -3, y2: 39 };
  for (const [W, H] of SHAPES) {
    const cam = cameraContaining(must, W, H);
    check(cam.x1 <= must.x1 && cam.x2 >= must.x2 && cam.y1 <= must.y1 && cam.y2 >= must.y2,
      `cameraContaining cropped what it was asked to contain at ${W}x${H}`);
    check(Math.abs((cam.x2 - cam.x1) / (cam.y2 - cam.y1) - W / H) < 1e-6,
      `cameraContaining did not take the canvas shape at ${W}x${H}`);
    check(Math.abs((cam.x1 + cam.x2) / 2 - (must.x1 + must.x2) / 2) < 1e-6
      && Math.abs((cam.y1 + cam.y2) / 2 - (must.y1 + must.y2) / 2) < 1e-6,
      "cameraContaining moved what it was asked to centre on");
  }
  // A canvas with no size yet must not produce NaN — this runs on the first
  // frame, before layout.
  const zero = cameraContaining(must, 0, 0);
  check(Number.isFinite(zero.x1) && Number.isFinite(zero.y2), "cameraContaining produced nonsense on a 0x0 canvas");
}

// ── 9. A FOOTBALLER IS SHAPED LIKE A FOOTBALLER ────────────────────────────
//
// Reported directly: "The graphics stink. Players are too small, too big. The
// goalie doesn't look right." Both halves are one number. The head is drawn
// through `drawPlayerHead`, which multiplies by the Face Editor's own scale
// (2.2 by default) — so the old `headBaseR = 0.3r` came out at `0.66r` radius
// on a figure `2.2r` tall: a head SIXTY PER CENT of the whole person.
//
// Pinned as a band rather than a number so the figure can still be tuned, and
// so this fails if anybody quietly walks it back toward a bowling pin.
{
  const share = FIGURE_HEAD_R / FIGURE_HEIGHT_R;
  check(share > 0.2 && share < 0.34,
    `a footballer's head is ${(share * 100).toFixed(0)} % of him — human is about a quarter`);
  check(FIGURE_HEIGHT_R > 1.5, "a figure needs a body under the head, not just a chin");
}

// ── 10. The shape the striking stages are drawn on ─────────────────────────
{
  const r = ELEVEN_A_SIDE_ATTACK;
  check(rulesAreSane(r).length === 0, `the striking stages' pitch is not sane: ${rulesAreSane(r).join("; ")}`);
  check(r.goal.x1 === POST_L && r.goal.x2 === POST_R, "the striking stages must use a real full-size goal");
  check(r.markings === "penalty-area", "…with a real penalty area drawn around it");
  check((r.crossbar ?? 0) > 2, "…and a real crossbar to lift it over");
}

// ── 11. The sharp keeper standing behind the no-tell rep ───────────────────
//
// The one combination in this stage that nobody had ever run, and the reason
// it was worth running on the real engine rather than reasoning about: the
// "keeper's on fire" event adds +15 to a keeper who is already 45 + 45·d, and
// the tell ramp takes his guess away entirely by the third kick. The biggest
// save radius in the game, behind the one rep that shows you nothing, on the
// same stage. Two mitigations were on the table — a tell floor whenever an
// event is live, or having the event pick a different stage — and the
// measurement is what decided whether either was needed.
//
// The taker modelled here is a real one rather than a machine: he reads the
// lean when there is one to read and picks a side when there is not, aims
// just inside the post, and misses by a realistic amount. Everything from
// `buildPenaltyScenario` down is the screen's own code and the real engine.
{
  const resolveAt = (
    sc: Scenario, rng: () => number, targetX: number, power: number,
    skills: { power: number; technique: number },
    commit: { lean: number; metres: number } | null,
  ): Outcome | null => {
    const dir = { x: targetX - sc.ball.x, y: -sc.ball.y };
    const ball: Ball = launch(sc, dir, power, { cx: 0, cy: -0.15 }, skills, rng);
    // The screen's own `onStrike`, which is the whole difference between a
    // keeper who is a static reach test and one who has actually guessed.
    // Leaving it out here would measure a penalty nobody plays any more.
    if (commit) commitKeeperGuess(sc, commit.lean, commit.metres);
    const dt = 1 / 60;
    for (let f = 0; f < 600; f++) {
      for (let i = 0; i < 3; i++) {
        const h = dt / 3;
        stepDefenders(sc, h, sc.player, false, ball);
        stepKeeper(sc, h);
        const res = stepBall(ball, sc, rng, h);
        if (res) return res;
      }
    }
    return null;
  };

  const convert = (
    sharp: boolean, rep: number, difficulty: number,
    skills: { power: number; technique: number }, n: number,
  ) => {
    let goals = 0;
    for (let k = 0; k < n; k++) {
      const t0 = startTrial(1000 + k);
      const t: TrialProgress = {
        ...t0,
        baseDifficulty: difficulty,
        stageRolls: { ...t0.stageRolls, penalties: 0 },
        adversity: sharp ? "sharp-keeper" : null,
        adversityStage: sharp ? "penalties" : null,
      };
      const rng = mulberry32((0x51ed270b ^ (k * 2654435761)) >>> 0);
      const sc = buildPenaltyScenario(t, rep, rng);
      // Read him if there is anything to read; otherwise pick a side.
      const tell = penaltyTell(t, rep);
      const side = tell > 0.2 ? -Math.sign(penaltySetup(t, rep).keeperLean) : (rng() < 0.5 ? -1 : 1);
      const post = side < 0 ? POST_L : POST_R;
      const targetX = post - side * (0.55 + rng() * 0.5) + (rng() - 0.5) * 1.5;
      const setup = penaltySetup(t, rep);
      const res = resolveAt(sc, rng, targetX, 0.72 + rng() * 0.18, skills,
        { lean: setup.keeperLean, metres: setup.keeperCommit });
      if (res === "goal" || res === "rebound") goals++;
    }
    return goals / n;
  };

  const N = 500;
  const GOOD = { power: 60, technique: 60 };
  const POOR = { power: 30, technique: 30 };
  const LAST = REPS.penalties - 1;

  // The four corners of the question, at the two ends of the skill range.
  const goodFirst = convert(false, 0, 0.8, GOOD, N);
  const goodLastClean = convert(false, LAST, 0.8, GOOD, N);
  const goodLastSharp = convert(true, LAST, 0.8, GOOD, N);
  // The genuinely worst cell in the game: a poor taker, the hardest possible
  // afternoon, a keeper on fire, and the rep that shows him nothing.
  const worstCell = convert(true, LAST, 1, POOR, N);
  const worstClean = convert(false, LAST, 1, POOR, N);

  if (process.env.TRIAL_MEASURE) {
    console.log(`  penalties: rep1 ${(goodFirst * 100).toFixed(1)}%  `
      + `last clean ${(goodLastClean * 100).toFixed(1)}%  last sharp ${(goodLastSharp * 100).toFixed(1)}%  `
      + `| worst cell ${(worstCell * 100).toFixed(1)}% (clean ${(worstClean * 100).toFixed(1)}%)`);
  }

  // ── The ramp is real on the pitch, not just in the numbers ──
  check(goodFirst > goodLastClean + 0.05,
    `the telegraphed first kick must genuinely be easier than the no-tell last one `
    + `(${(goodFirst * 100).toFixed(1)}% vs ${(goodLastClean * 100).toFixed(1)}%)`);

  // ── The sharp keeper genuinely bites ──
  check(goodLastSharp < goodLastClean,
    `a keeper on fire must actually be harder to beat `
    + `(${(goodLastSharp * 100).toFixed(1)}% vs ${(goodLastClean * 100).toFixed(1)}%)`);

  // ── The stage is not a free pass any more either ──
  //
  // It used to be. Measured on the real engine, the no-tell rep converted a
  // corner 88-99.8 % of the time — because the keeper was pinned to his line
  // and the save collapsed into a static reach test that a corner beats by a
  // metre at any keeper strength. Now that he commits at the strike
  // (`commitKeeperGuess`, and `penaltyCommit` for whether and how far), the
  // kick you cannot read is a real one. A ceiling as well as a floor, so a
  // future change cannot quietly put the old free goal back.
  check(goodLastClean < 0.75,
    `the rep that tells you nothing must not be a formality, got `
    + `${(goodLastClean * 100).toFixed(1)}%`);

  // ── …and stacking the sharp keeper on that rep is not a lockout ──
  //
  // This is the assertion the whole section exists for. Measured figures with
  // the keeper committing: rep 1 (readable) 95.0 %, the last rep clean
  // 50.8 %, the last rep with a keeper on fire 49.2 %, and the genuinely
  // worst cell in the game — a poor taker, the hardest afternoon, a sharp
  // keeper, and the rep that shows him nothing — 46.0 %. The bar is set at
  // 35 % so this is a real regression check on the stacking rather than a pin
  // on one run's noise. If a future change to the keeper, the ramp, the
  // commit or the bonus drops the worst cell under this, the mitigation that
  // was ruled out here (a tell floor, or the event picking a different stage)
  // becomes necessary after all.
  check(worstCell > 0.35,
    `the worst cell in the stage must still be winnable, got ${(worstCell * 100).toFixed(1)}%`);
  check(worstCell > worstClean * 0.6,
    `…and the bonus must not turn that rep into a different game entirely `
    + `(${(worstCell * 100).toFixed(1)}% against a clean ${(worstClean * 100).toFixed(1)}%)`);
}

// ── THE KEEPER ACTUALLY GOES, AND KEEPS DIVING AFTERWARDS ──────────────────
//
// Two reported bugs, one mechanism between them, and both measured rather than
// argued. See `commitKeeperGuess` (TrialPenalties.tsx) and `penaltyCommit`
// (trialStages.ts) for the full numbers; this pins the properties they rest on.
{
  const trial = startTrial(90210);

  // (1) He does not always go. A keeper who commits every single time turns
  //     the stage into a coin flip and hands you the middle of the goal —
  //     measured, that version took a 2.7 % shot to 96.8 %.
  let goes = 0, holds = 0;
  for (let seed = 0; seed < 300; seed++) {
    const t = startTrial(seed * 7919 + 3);
    for (let rep = 0; rep < REPS.penalties; rep++) {
      if (penaltySetup(t, rep).keeperCommit > 0) goes++; else holds++;
    }
  }
  const goRate = goes / (goes + holds);
  check(goRate > 0.55 && goRate < 0.92,
    `he should usually commit but genuinely sometimes hold, got ${(goRate * 100).toFixed(1)}%`);

  // (2) Which way he goes is the lean's own sign, never a second dice roll.
  //     That is what makes the stage's whole tell ramp mean something: the
  //     subtitle has always claimed "he has already guessed", and now he has.
  for (let seed = 0; seed < 60; seed++) {
    const t = startTrial(seed * 104729 + 11);
    for (let rep = 0; rep < REPS.penalties; rep++) {
      const setup = penaltySetup(t, rep);
      if (setup.keeperCommit <= 0) continue;
      const sc = buildPenaltyScenario(t, rep, mulberry32(seed + rep));
      const before = sc.keeper.startX;
      commitKeeperGuess(sc, setup.keeperLean, setup.keeperCommit);
      const wentRight = sc.keeper.targetX > before;
      check(wentRight === (setup.keeperLean >= 0),
        `he must commit to the side he is already leaning (rep ${rep}, seed ${seed})`);
      check(sc.keeper.scrambling === true, "committing must actually set him scrambling");
      check(sc.keeper.saveLunge > 0, "…and start the dive at the strike, not after it");
    }
  }

  // (3) A rep where he holds must be left completely alone — not a scramble
  //     with a zero-length target, which would still start the dive animation.
  {
    const sc = buildPenaltyScenario(trial, 0, mulberry32(5));
    const was = { x: sc.keeper.x, t: sc.keeper.targetX, s: sc.keeper.scrambling, l: sc.keeper.saveLunge };
    commitKeeperGuess(sc, 1, 0);
    check(sc.keeper.scrambling === was.s && sc.keeper.targetX === was.t
      && sc.keeper.saveLunge === was.l && sc.keeper.x === was.x,
      "a keeper who is holding his ground must be left untouched");
  }

  // (4) He genuinely travels during the flight — the point of the whole
  //     change. `stepKeeper` clamps to its own KEEPER_LATERAL_MAX, so asking
  //     for more than he can cover is capped by the engine rather than by a
  //     copy of its constant living in the screen.
  {
    const sc = buildPenaltyScenario(trial, 3, mulberry32(77));
    const x0 = sc.keeper.x;
    commitKeeperGuess(sc, 1, 999);
    for (let i = 0; i < 60; i++) stepKeeper(sc, 1 / 60);
    const moved = sc.keeper.x - x0;
    check(moved > 1, `he must actually travel when committed, moved ${moved.toFixed(2)} m`);
    check(moved < 4, `…and never further than the engine's own limit, moved ${moved.toFixed(2)} m`);
  }

  // (5) THE FROZEN DIVE. Reported as "he dives after the ball goes in the
  //     net", and measured: the screen holds the flight phase open after the
  //     outcome, and neither post-outcome branch used to call `stepKeeper`, so
  //     the dive stopped dead at 13 % and finished a second later as the
  //     banner appeared. Over 200 real penalties that was 498 ms of visibly
  //     frozen keeper within the old 1.0 s window, against 0 ms now, and the
  //     dive completes 149 ms after the outcome — the real match measures
  //     ~150 ms.
  //
  //     Checked here the only way a test can: that a keeper part-way through a
  //     dive DOES advance when stepped, which is exactly the call the two
  //     branches were missing. Whether the branches call it is the screen's
  //     own wiring and is verified by reading it, same standing limitation as
  //     every other CanvasMatch-shaped check in this file.
  {
    const sc = buildPenaltyScenario(trial, 3, mulberry32(11));
    commitKeeperGuess(sc, 1, PENALTY_COMMIT_M);
    sc.keeper.saveLunge = 0.13;   // where the old loop left him, measured
    const before = sc.keeper.saveLunge;
    let frames = 0;
    while (sc.keeper.saveLunge < 1 && frames < 120) { stepKeeper(sc, 1 / 60); frames++; }
    check(sc.keeper.saveLunge > before, "stepping a mid-dive keeper must advance the dive");
    check(sc.keeper.saveLunge >= 1 && frames < 30,
      `…and finish it promptly once stepped, took ${(frames * 1000 / 60).toFixed(0)} ms`);
  }

  // (6) The banner gate. The real match has none at all; this screen keeps a
  //     short beat so a goal is seen crossing and the dive is seen finishing,
  //     and nothing like the full second that put the worst measured attempt
  //     at 8.52 s.
  check(SETTLE_BEFORE_BANNER > 0 && SETTLE_BEFORE_BANNER <= 0.35,
    `the settle beat must be short but not nothing, got ${SETTLE_BEFORE_BANNER}s`);
}

// ── THE AIM ARROW IS THE MATCH'S ARROW ─────────────────────────────────────
//
// Reported twice, in the same words both times: "the drag arrow still doesn't
// look like the original football engine." The reason it matters is already
// written down beside `MIN_PULL` in TrialPenalties.tsx — a trial that teaches
// a different gesture from the game it is the opening of is worse than no
// trial — and it is a pair that has drifted before.
//
// Measured, before anything was changed, on the real camera a real penalty is
// framed by (iPhone 13, a 358 × 439 canvas, a 32.4 m tall camera at 13.6 px/m):
//
//   power   trial (0.11)   match (0.132)
//   0.25      12.1 px        14.5 px
//   0.50      24.1 px        29.0 px
//   1.00      48.3 px        57.9 px     — 16.7 % short at every power
//
// Everything else about the two arrows — the #fb923c → #ea580c gradient
// shaft, the round cap, the solid #f97316 head, its rgba(124,45,18,0.6) edge,
// and all four size formulas off W and `unit` — was already identical and was
// left alone. So the only thing to hold still is the length coefficient, and
// the only honest way to check it is against the match's own source: there is
// no exported constant on that side to import, and re-typing the number here
// would just be a third copy that could drift with the other two.
{
  const match = readFileSync("components/star/CanvasMatch.tsx", "utf8");

  // The one line in CanvasMatch that sets the drawn arrow length.
  const found = match.match(/lineLen\s*=\s*power\s*\*\s*heightSpan\s*\*\s*([0-9.]+)/);
  check(found !== null,
    "CanvasMatch still computes its aim arrow as power × heightSpan × <k> — "
    + "if this has been restructured, re-derive the trial's arrow against it by hand");

  if (found) {
    const theirs = Number(found[1]);
    check(Math.abs(theirs - AIM_ARROW_LENGTH) < 1e-9,
      `the trial's aim arrow must be the match's aim arrow: the trial draws `
      + `${AIM_ARROW_LENGTH} and the match now draws ${theirs}. Follow it.`);
  }

  // The power meter. CanvasMatch removed its own ("redundant with the arrow's
  // own length, which already is the power readout") and this screen was the
  // last thing still drawing one — a vertical bar down the left edge with a
  // green/amber/red fill and an "NN%" label, on the first ball anybody in this
  // game ever kicks, showing a number the real game never shows. Reported
  // directly. Checked by its most distinctive marks rather than by the word
  // "meter", which appears in prose either way.
  const trialSrc = readFileSync("components/star/stages/TrialPenalties.tsx", "utf8");
  const drawsAMeter = /ctx\.fillText\(`\$\{Math\.round\(power \* 100\)\}%`/.test(trialSrc)
    || /createLinearGradient[^;]*\n?[^;]*addColorStop\(0, "#22c55e"\)/.test(trialSrc);
  check(!drawsAMeter,
    "the trial must not draw a power percentage the real match does not draw");
  check(!/#22c55e|#eab308|#ef4444/.test(trialSrc),
    "the meter's green/amber/red fill is gone from the striking stages");
}


// ── 9. NOBODY IS ON THE PITCH WITHOUT BEING DRAWN ──────────────────────────
//
// Reported from a real playthrough of the free kicks: "there are invisible
// people there… it's probably just taking a regular free kick where you have
// players around you, and it's just made them invisible."
//
// It was. Every scenario the engine builds carries a `follower` — the one
// interactive rebound-chaser, and on a free kick he stands 9-18 m from goal,
// roughly central, i.e. straight down the flight path — plus `teammates`, and
// the taker himself. The screen drew the defenders and the keeper and nothing
// else, and `stepBall` has the follower on its reception candidate list for
// any scenario with the goal in view, so a man nobody could see was genuinely
// deciding free kicks.
//
// This holds the SCREEN's own list against the SCENARIO, rather than checking
// a re-derived list of who ought to be there — a local copy of "who should be
// drawn" would have agreed with the bug. Same trap as the castDefence fixture
// in lineup.mts.
{
  const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;

  let checkedFK = 0, checkedPen = 0;
  for (let s = 0; s < 120; s++) {
    const trial = startTrial(880_000 + s * 7919);
    for (let rep = 0; rep < REPS.freeKicks; rep++) {
      for (const [what, sc] of [
        ["free kick", buildFreeKickScenario(
          trial, rep, mulberry32(((trial.seed ^ 0x5f5e) ^ ((rep + 1) * 0x9e3779b1)) >>> 0))] as const,
        ["penalty", buildPenaltyScenario(
          trial, rep, mulberry32((trial.seed ^ ((rep + 1) * 0x9e3779b1)) >>> 0))] as const,
      ]) {
        const drawn = ownSideBodies(sc);
        if (what === "free kick") checkedFK++; else checkedPen++;

        // The poacher is the man the whole report was about.
        check(drawn.some(d => near(d, { x: sc.follower.x, y: sc.follower.y })),
          `${what}: the follower/poacher exists in the scenario and is not drawn`);
        for (const t of sc.teammates) {
          check(drawn.some(d => near(d, t)), `${what}: a team-mate is not drawn`);
        }
        if (sc.runner) {
          check(drawn.some(d => near(d, sc.runner!.pos)), `${what}: the runner is not drawn`);
        }
        for (const r of sc.secondaryRunners ?? []) {
          check(drawn.some(d => near(d, r.pos)), `${what}: a secondary runner is not drawn`);
        }
        // Count, so nothing invented is drawn either.
        const want = 1 + sc.teammates.length + (sc.runner ? 1 : 0)
          + (sc.secondaryRunners ?? []).length;
        check(drawn.length === want,
          `${what}: drew ${drawn.length} of your own side, the scenario has ${want}`);
        // Furthest from the camera first — the game's own y-sort, so a man
        // nearer the goal is never painted over one nearer you.
        for (let i = 1; i < drawn.length; i++) {
          check(drawn[i].y >= drawn[i - 1].y, `${what}: own side drawn out of depth order`);
        }

        // …and every one of them, plus the taker, is inside the frame the
        // screen actually films. Worth pinning rather than assuming: the
        // camera is what `powerFrom` normalises the drag against, so if a new
        // body ever forced `strikeCamera` to grow, the power of every kick in
        // the trial would quietly change with it.
        const cam = strikeCamera(sc, sc.ball, 358, 573);
        for (const b of [...drawn, takerSpot(sc)]) {
          check(b.x >= cam.x1 && b.x <= cam.x2 && b.y >= cam.y1 && b.y <= cam.y2,
            `${what}: a drawn body (${b.x.toFixed(1)}, ${b.y.toFixed(1)}) falls outside the camera`);
        }

        // The taker is not drawn standing on the ball he is about to drag
        // back from. Both drills put `scenario.player` directly behind it,
        // and a figure drawn up-screen from its boots puts its head exactly
        // there — the first version of this fix drew the ball on his face.
        const t = takerSpot(sc);
        check(Math.abs(t.x - sc.ball.x) >= 2.0,
          `${what}: the taker is drawn on top of the ball (${Math.abs(t.x - sc.ball.x).toFixed(2)} m across)`);
        // …and he is only ever moved ACROSS, never up or down the pitch.
        check(Math.abs(t.y - sc.player.y) < 1e-9, `${what}: the taker's depth was moved, not just his side`);
        // Never nudged into the line you are aiming down.
        const side = Math.sign(t.x - sc.ball.x);
        check(side === (sc.ball.x >= CX ? 1 : -1) || Math.abs(sc.player.x - sc.ball.x) >= 2.3,
          `${what}: the taker is drawn on the goal side of the ball`);
      }
    }
  }
  check(checkedFK > 300 && checkedPen > 300, "not enough scenarios checked");

  // A taker who is ALREADY standing off to one side (every ordinary scenario,
  // via the engine's own standOff) is left exactly where he is.
  {
    const sc = buildFreeKickScenario(startTrial(4321), 0, mulberry32(7));
    sc.player = { x: sc.ball.x + 4, y: sc.ball.y + 1 };
    const t = takerSpot(sc);
    check(t.x === sc.player.x && t.y === sc.player.y,
      "a taker already standing off to one side was moved anyway");
  }
}

// ── 10. THE KEEPER'S DIVE DOES NOT RESTART HALFWAY THROUGH ─────────────────
//
// Reported from a real playthrough of the penalties: "he's just not even
// diving the right way. It's a little bit buggy. That didn't make sense."
//
// `commitKeeperGuess` makes him pick a side and go the instant the ball is
// struck. When the ball then reaches his line, the engine's own save test
// unconditionally writes `k.saveDir = sign(xAt − k.x)` and `k.saveLunge =
// 0.001` — right for a match, where that IS the start of his dive, and wrong
// here, where it lands on a dive already fully played. On screen he snaps
// upright out of full stretch and starts a fresh dive the other way as the
// ball goes past.
//
// The bug is REPRODUCED first, off the raw engine fields, so a reader can see
// what "before" looked like instead of taking it on faith — and then the same
// run is replayed through `keeperDive` and must be clean.
{
  const runPenalty = (seed: number, rep: number, aimSide: number) => {
    const trial = startTrial(seed);
    const setup = penaltySetup(trial, rep);
    const rng = mulberry32((trial.seed ^ ((rep + 1) * 0x9e3779b1)) >>> 0);
    const sc = buildPenaltyScenario(trial, rep, rng);
    const dir = { x: aimSide * 3.2, y: -PEN_SPOT_Y };
    const ball = launch(sc, dir, 0.9, { cx: 0, cy: -0.1 }, { power: 60, technique: 60 }, rng);
    commitKeeperGuess(sc, setup.keeperLean, setup.keeperCommit);

    const raw: { dir: number; lunge: number }[] = [];
    const shown: { dive: number; lunge: number }[] = [];
    const dt = 1 / 60;
    // Past the outcome, because the reset happens exactly AT it — the screen
    // keeps stepping him through the settle beat and the result banner.
    for (let f = 0; f < 240; f++) {
      for (let i = 0; i < 3; i++) {
        const h = dt / 3;
        stepDefenders(sc, h, sc.player, false, ball);
        stepKeeper(sc, h);
        stepBall(ball, sc, rng, h);
        raw.push({ dir: sc.keeper.saveDir, lunge: sc.keeper.saveLunge });
        shown.push(keeperDive(sc.keeper));
      }
    }
    return { raw, shown, committed: setup.keeperCommit > 0 };
  };

  const flips = (xs: { dir: number }[]) => {
    let n = 0, last = 0;
    for (const x of xs) {
      if (x.dir !== 0 && last !== 0 && Math.sign(x.dir) !== Math.sign(last)) n++;
      if (x.dir !== 0) last = x.dir;
    }
    return n;
  };
  const resets = (xs: { lunge: number }[]) => {
    let n = 0;
    for (let i = 1; i < xs.length; i++) if (xs[i].lunge < xs[i - 1].lunge - 1e-9) n++;
    return n;
  };

  let reproduced = 0, committedRuns = 0;
  for (let s = 0; s < 60; s++) {
    for (let rep = 0; rep < 3; rep++) {
      for (const aim of [-1, 1]) {
        const r = runPenalty(700_000 + s * 7919, rep, aim);
        if (!r.committed) continue;
        committedRuns++;
        if (flips(r.raw) > 0 || resets(r.raw) > 0) reproduced++;

        // The fix, on the same run: what is DRAWN never flips direction once
        // he has started going, and never un-dives.
        check(flips(r.shown.map(x => ({ dir: Math.sign(x.dive) }))) === 0,
          "the drawn dive flipped direction mid-attempt");
        check(resets(r.shown) === 0, "the drawn dive collapsed and restarted mid-attempt");
      }
    }
  }
  check(committedRuns > 40, `not enough committed penalties to test (${committedRuns})`);
  // If this ever stops reproducing, the engine has changed underneath and the
  // latch may no longer be needed — which is worth being told about.
  check(reproduced > committedRuns * 0.5,
    `the raw engine fields no longer flip/reset (${reproduced}/${committedRuns}) — re-read `
    + `keeperDive's note before trusting it`);

  // A keeper who has not committed to anything is drawn standing, not diving.
  {
    const sc = buildPenaltyScenario(startTrial(99), 0, mulberry32(3));
    sc.keeper.saveLunge = 0;
    sc.keeper.dive = 0;
    const d = keeperDive(sc.keeper);
    check(d.lunge === 0 && d.dive === 0, "an uncommitted keeper is drawn mid-dive");
  }
}

if (problems.length) {
  console.error("FAIL — trial stage screens");
  for (const p of problems) console.error("  · " + p);
  process.exit(1);
}
console.log("PASS — the three trial stages build real scenarios, frame them, and draw a fair vision picture");
