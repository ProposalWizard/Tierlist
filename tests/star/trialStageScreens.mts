import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepDefenders,
  VIEW_ASPECT, type Ball, type Outcome, type Scenario,
} from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { POST_L, POST_R, NET_DEPTH, CX, PEN_SPOT_Y } from "../../lib/star/pitch";
import { startTrial } from "../../lib/star/trial";
import {
  REPS, freeKickSetup, visionSetup, penaltySetup, attemptSeed,
} from "../../lib/star/trialStages";
import {
  buildPenaltyScenario, strikeCamera,
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
  for (let s = 0; s < 40; s++) {
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

if (problems.length) {
  console.error("FAIL — trial stage screens");
  for (const p of problems) console.error("  · " + p);
  process.exit(1);
}
console.log("PASS — the three trial stages build real scenarios, frame them, and draw a fair vision picture");
