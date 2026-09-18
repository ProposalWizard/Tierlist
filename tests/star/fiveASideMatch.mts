import {
  newFiveMatch, applyOutcome, oppAttack, isFullTime, resultOf, zoneOf, halfAt,
  resumeAction, MINUTES_PER_PASSAGE, MINUTES_PER_OPP_ATTACK, type FiveMatchState,
} from "../../lib/star/fiveASide/match";
import {
  FIVE_A_SIDE, ELEVEN_A_SIDE, rulesAreSane, fullTimeMinutes, centreSpot, goalCentreX,
} from "../../lib/star/fiveASide/rules";
import {
  passageQuality, shotPlacementQuality, fiveASideScore, summarise, stageQualityFrom, rawQuality,
  PASS_AMBITION_BAR, SAFE_PASS_CAP, OWN_HALF_PASS_CAP, GOAL_BONUS, WIN_BONUS, isShotOutcome,
} from "../../lib/star/fiveASide/score";
import { buildPassage, kickOffWorld } from "../../lib/star/fiveASide/passage";
import { insideFivePitch, FIVE_GOAL } from "../../lib/star/fiveASide/geometry";
import { halfwayY } from "../../lib/star/fiveASide/rules";
import { stageScore } from "../../lib/star/trial";
import { mulberry32 } from "../../lib/star/season";
import type { Ball, Outcome, Scenario } from "../../lib/star/canvasEngine";

/**
 * THE MATCH AROUND THE KICKS.
 *
 * The engine plays one touch. This layer is what makes those touches a game —
 * the score, the clock, whose ball it is, and what happens when it is not
 * yours. Three properties matter most, and all three are things you could
 * stare at a screen for an hour without noticing were wrong:
 *
 *  1. **It is the same match every time from the same seed.** If it is not, a
 *     player who closes the app and re-opens it gets a different game, and the
 *     whole "resume exactly where you were" promise is a lie.
 *  2. **A match ends.** The clock must always reach full time, from any
 *     sequence of events, or somebody is stuck in a five-a-side forever.
 *  3. **Harder is worth more, and better is worth more.** Tested as properties
 *     across the whole range rather than at one convenient pair of numbers.
 *
 * Plus the one that is not about the five-a-side at all: the layer takes the
 * shape of the game as DATA, so a continuous eleven-a-side match is a
 * configuration rather than a rewrite. That was asked for directly, and a
 * claim like that is worthless unless something checks it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const fakeBall = (at: { x: number; y: number }) => ({ pos: { ...at } } as Ball);
const fakeScenario = () =>
  buildPassage(kickOffWorld(true), { keeperStrength: 60, rng: mulberry32(1) });

// ── The shapes of the game are sane, both of them ───────────────────────
{
  for (const rules of [FIVE_A_SIDE, ELEVEN_A_SIDE]) {
    const bad = rulesAreSane(rules);
    check(bad.length === 0, `${rules.name}: ${bad.join("; ")}`);
  }
  // …and the eleven-a-side shape is honest about the one thing that is NOT
  // solved. The engine's frame is a fixed 26.25 m wide and a real pitch is 68,
  // so a continuous eleven-a-side match needs a camera that follows the ball.
  // That flag is the difference between "not built yet" and "quietly broken",
  // and the pitch is a real pitch rather than one trimmed to fit a check.
  check(ELEVEN_A_SIDE.needsMovingCamera === true, "the eleven-a-side shape says it needs a moving camera");
  check(!FIVE_A_SIDE.needsMovingCamera, "the five-a-side fits in one frame and says so");
  check(
    ELEVEN_A_SIDE.pitch.x2 - ELEVEN_A_SIDE.pitch.x1 === 68,
    "the eleven-a-side pitch is a real pitch, not one shrunk to suit the camera",
  );
  check(FIVE_A_SIDE.outfieldPerSide === 4, "a five-a-side is four outfielders and a keeper");
  check(ELEVEN_A_SIDE.outfieldPerSide === 10, "an eleven-a-side is ten outfielders and a keeper");
  check(!FIVE_A_SIDE.offside, "a five-a-side has no offside");
  check(ELEVEN_A_SIDE.offside, "an eleven-a-side does");
  check(
    FIVE_A_SIDE.goal.x2 - FIVE_A_SIDE.goal.x1 < ELEVEN_A_SIDE.goal.x2 - ELEVEN_A_SIDE.goal.x1,
    "the five-a-side goal is genuinely smaller than the eleven-a-side one",
  );
  check(fullTimeMinutes(FIVE_A_SIDE) === 6, `a five-a-side is six minutes, got ${fullTimeMinutes(FIVE_A_SIDE)}`);
  check(fullTimeMinutes(ELEVEN_A_SIDE) === 90, "an eleven-a-side is ninety");
}

// ── The layer genuinely runs a different shape of game ──────────────────
//
// The claim that side size and goal size are parameters rather than constants
// is only worth making if something exercises the other setting.
{
  const five = newFiveMatch(1, FIVE_A_SIDE);
  const eleven = newFiveMatch(1, ELEVEN_A_SIDE);
  check(fullTimeMinutes(eleven.rules) > fullTimeMinutes(five.rules), "the two games are different lengths");
  check(
    centreSpot(eleven.rules).y !== centreSpot(five.rules).y,
    "…and have their kick-offs in different places",
  );
  // An eleven-a-side match runs to full time through this same layer.
  let s = eleven;
  let steps = 0;
  while (!s.over && steps < 5000) {
    s = applyOutcome(s, "delivered", fakeScenario(), fakeBall({ x: 34, y: 20 }), 0.6);
    steps++;
  }
  check(s.over, "an eleven-a-side match reaches full time through the same layer");
  check(steps < 5000, "…without running forever");
}

// ── The same seed is the same match ─────────────────────────────────────
{
  // Driven BY the seed, not just seeded — the first version of this picked its
  // outcomes with `i % 5`, so every match played out identically and only the
  // opposition's rolls varied. It passed while proving almost nothing.
  const run = (seed: number) => {
    const rng = mulberry32(seed * 7919);
    let s = newFiveMatch(seed);
    for (let i = 0; i < 40 && !s.over; i++) {
      s = rng() < 0.35
        ? oppAttack(s, 0.5, 60)
        : applyOutcome(s, rng() < 0.25 ? "goal" : "delivered", fakeScenario(),
          fakeBall({ x: 34, y: 8 }), rng());
    }
    return s;
  };
  for (const seed of [1, 42, 999]) {
    const a = run(seed), b = run(seed);
    check(
      JSON.stringify(a.score) === JSON.stringify(b.score) && a.minute === b.minute,
      `seed ${seed}: the same match plays out the same way`,
    );
  }
  // Different seeds are genuinely different matches, or the roll is decorative.
  const seen = new Set(Array.from({ length: 60 }, (_, i) => run(i).score.join("-")));
  check(seen.size > 3, `different seeds should give different matches, saw ${seen.size} distinct scores`);
}

// ── A match always ends, from any sequence at all ───────────────────────
{
  const OUTCOMES: (Outcome | "out")[] = [
    "goal", "rebound", "delivered", "saved", "caught", "post", "wide", "over",
    "blocked", "tackled", "short", "out", "touchOn",
  ];
  for (let seed = 1; seed <= 300; seed++) {
    const rng = mulberry32(seed * 31);
    let s = newFiveMatch(seed);
    let steps = 0;
    while (!s.over && steps < 1000) {
      if (rng() < 0.3) {
        s = oppAttack(s, rng(), 40 + rng() * 50);
      } else {
        const out = OUTCOMES[Math.floor(rng() * OUTCOMES.length)];
        s = applyOutcome(s, out, fakeScenario(), fakeBall({ x: 20 + rng() * 28, y: rng() * 40 }), rng());
      }
      steps++;
    }
    check(s.over, `seed ${seed}: the match must reach full time (stuck at ${s.minute}')`);
    check(s.minute <= fullTimeMinutes(s.rules), `seed ${seed}: the clock must not run past full time`);
    check(steps < 1000, `seed ${seed}: it should not take a thousand touches`);
    // Whatever happened, the ball is still somewhere legal and the score is real.
    check(insideFivePitch(s.world.ball), `seed ${seed}: the ball ends up on the pitch`);
    check(
      Number.isInteger(s.score[0]) && Number.isInteger(s.score[1]) && s.score[0] >= 0 && s.score[1] >= 0,
      `seed ${seed}: the score stays a real score`,
    );
  }
}

// ── A touch takes a believable amount of the clock ──────────────────────
{
  let s = newFiveMatch(5);
  const touches: number[] = [];
  while (!s.over && touches.length < 100) {
    s = applyOutcome(s, "delivered", fakeScenario(), fakeBall({ x: 34, y: 18 }), 0.5);
    touches.push(s.minute);
  }
  check(
    touches.length >= 10 && touches.length <= 16,
    `a five-a-side should give you roughly a dozen touches, got ${touches.length}`,
  );
  check(Math.abs(touches[0] - MINUTES_PER_PASSAGE) < 1e-9, "the clock moves by one passage per touch");
}

// ── Whose ball is it now ────────────────────────────────────────────────
{
  const sc = fakeScenario();
  const at = (y: number) => fakeBall({ x: 34, y });

  const goal = applyOutcome(newFiveMatch(1), "goal", sc, at(0), 0.9);
  check(goal.score[0] === 1, "a goal goes on the board");
  check(goal.possession === "them", "…and they kick off");
  check(goal.restart === "kick-off", "…from the middle");

  const kept = applyOutcome(newFiveMatch(1), "delivered", sc, at(20), 0.6);
  check(kept.possession === "you", "a completed pass keeps the ball");

  const saved = applyOutcome(newFiveMatch(1), "saved", sc, at(1), 0.34);
  check(saved.possession === "them", "a save is their ball");
  check(saved.restart === "goal-kick", "…from a goal kick");

  const lost = applyOutcome(newFiveMatch(1), "tackled", sc, at(20), 0.05);
  check(lost.possession === "them", "being tackled loses it");

  // Out of play, each way.
  const wide = applyOutcome(newFiveMatch(1), "out", sc, fakeBall({ x: 10, y: 20 }), 0.08);
  check(wide.restart === "kick-in", "over the touchline is a kick-in");
  const behindThem = applyOutcome(newFiveMatch(1), "out", sc, fakeBall({ x: 34, y: -2 }), 0.08);
  check(behindThem.restart === "goal-kick", "past their goal line is a goal kick");
  const behindUs = applyOutcome(newFiveMatch(1), "out", sc, fakeBall({ x: 34, y: 40 }), 0.08);
  check(behindUs.restart === "corner", "past your own line is a corner against you");
  check(
    behindUs.score[0] === 0 && behindUs.score[1] === 0,
    "…and never an own goal, which is not modelled and must not appear",
  );
}

// ── Their attacks are fair, and respond to both sides' quality ──────────
{
  const rate = (difficulty: number, keeper: number) => {
    let conceded = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed++) {
      const s = oppAttack(newFiveMatch(seed), difficulty, keeper);
      if (s.score[1] > 0) conceded++;
    }
    return conceded / N;
  };

  const weakVsGood = rate(0.1, 85);
  const strongVsPoor = rate(0.95, 25);
  const middling = rate(0.5, 55);

  check(strongVsPoor > middling, "a better side should score more often");
  check(middling > weakVsGood, "…and a better keeper should concede less");
  check(weakVsGood > 0, "even a poor side scores sometimes — nothing is a certainty");
  check(strongVsPoor < 1, "…and even a good one does not score every time");
  check(
    middling > 0.1 && middling < 0.5,
    `a middling attack against a middling keeper should be occasional, got ${(middling * 100).toFixed(0)}%`,
  );
}

// ── Placement is judged against the goal that is actually there ─────────
{
  const centre = (FIVE_GOAL.x1 + FIVE_GOAL.x2) / 2;
  const corner = FIVE_GOAL.x2 - 0.1;
  check(
    shotPlacementQuality("goal", corner, FIVE_A_SIDE) > shotPlacementQuality("goal", centre, FIVE_A_SIDE),
    "a finish into the corner beats one down the middle",
  );
  // …and on the small goal, "the corner" is much closer to the middle than it
  // would be on a full-size one. Judging against a full goal would rate every
  // five-a-side finish as central.
  const twoMetresOff = centre + 1.6;
  check(
    shotPlacementQuality("goal", twoMetresOff, FIVE_A_SIDE) > 0.9,
    "on a small goal, a finish near the post is rated as one",
  );
  check(
    shotPlacementQuality("goal", twoMetresOff, ELEVEN_A_SIDE) < shotPlacementQuality("goal", twoMetresOff, FIVE_A_SIDE),
    "the same placement is less impressive on a big goal, which is the point of judging against the real one",
  );
  check(shotPlacementQuality("saved", null, FIVE_A_SIDE) > shotPlacementQuality("blocked", null, FIVE_A_SIDE),
    "forcing a save beats being blocked");
  check(shotPlacementQuality("blocked", null, FIVE_A_SIDE) > shotPlacementQuality("tackled", null, FIVE_A_SIDE),
    "being blocked beats being dispossessed");
}

// ── A pass is judged on the engine's own reading of it ──────────────────
//
// It used to take the better of `passDifficulty` and `passAmbition` flatly,
// and this section used to assert exactly that. That assertion is GONE rather
// than weakened, because the behaviour it described is the thing that was
// wrong: ambition is a RELATIVE question and on a 24 x 36 pitch it degenerates
// to "did the ball go more than two metres forward". Measured, by playing a
// real match out through the engine: eleven consecutive two-metre nudges
// scored ambition 0.94, 0.98, then 0.99 every touch after that. So ambition
// now only counts once the ball genuinely was a ball.
{
  const up = (y: number) => ({ ...fakeScenario(), ball: { x: 34, y } } as Scenario);
  const upfield = up(halfwayY(FIVE_A_SIDE) - 6);
  const ownHalf = up(halfwayY(FIVE_A_SIDE) + 6);
  const q = (sc: Scenario) => passageQuality("delivered", sc, null, FIVE_A_SIDE);
  const withPass = (sc: Scenario, d: number, a: number) =>
    ({ ...sc, passDifficulty: d, passAmbition: a } as Scenario);

  const safe = withPass(upfield, 0.1, 0.1);
  const hard = withPass(upfield, 0.9, 0.2);
  check(q(hard) > q(safe), "a harder pass is worth more");

  // Above the bar, ambition still does exactly the job it was added for: a
  // ball that was not technically hard but WAS the brave one scores.
  const brave = withPass(upfield, PASS_AMBITION_BAR + 0.05, 0.95);
  const plain = withPass(upfield, PASS_AMBITION_BAR + 0.05, 0);
  check(q(brave) > q(plain), "above the bar, the ambitious ball is still worth more");

  // Below it, it does not — which is the whole fix. A "0.99 ambition"
  // two-metre nudge must be worth no more than any other safe ball.
  const nudge = withPass(upfield, 0.12, 0.99);
  check(
    q(nudge) <= SAFE_PASS_CAP + 1e-9,
    `a two-metre nudge that the engine calls 0.99 ambitious is still a safe ball, got ${q(nudge)}`,
  );
  check(
    Math.abs(q(nudge) - q(safe)) < 1e-9,
    "…and is worth exactly what any other safe ball is worth",
  );

  // Deeper is worth less: a safe ball in your own half has not made ground.
  check(
    q(withPass(ownHalf, 0.12, 0.99)) < q(nudge),
    "a safe ball in your own half is worth less than a safe ball up the pitch",
  );
  check(
    q(withPass(ownHalf, 0.12, 0.99)) <= OWN_HALF_PASS_CAP + 1e-9,
    "…and no more than the own-half cap",
  );

  // The incentive the whole rebalance is for, stated as a property: keeping
  // the ball is not worth more than having a go at the goal.
  check(
    q(nudge) < passageQuality("saved", upfield, null, FIVE_A_SIDE),
    "a safe completed pass is worth less than a shot the keeper had to save",
  );

  check(q(safe) > passageQuality("tackled", safe, null, FIVE_A_SIDE), "any completed pass beats losing it");
  for (const out of ["goal", "delivered", "saved", "tackled", "out", "short"] as const) {
    const v = passageQuality(out, fakeScenario(), null, FIVE_A_SIDE);
    check(v >= 0 && v <= 1 && Number.isFinite(v), `${out} is judged in range, got ${v}`);
  }
  // A scenario carrying no pass reading at all must not produce a NaN.
  const blankRead = { ...upfield, passDifficulty: undefined, passAmbition: undefined } as unknown as Scenario;
  check(Number.isFinite(q(blankRead)), "a pass the engine never read still scores a real number");
}

// ── Shots carry more of the verdict than safe touches ───────────────────
{
  check(isShotOutcome("goal") && isShotOutcome("saved") && isShotOutcome("wide"),
    "a touch at goal is a shot, whatever became of it");
  check(!isShotOutcome("delivered") && !isShotOutcome("short") && !isShotOutcome("out"),
    "a pass is not a shot");
  // Deliberately NOT counted, because the engine does not say whether a
  // blocked or tackled touch was a shot or a pass cut out.
  check(!isShotOutcome("blocked") && !isShotOutcome("tackled"),
    "the ambiguous outcomes are left out rather than guessed at");

  // Same qualities, same count of touches — only WHICH of them were shots
  // differs, and the shots have to move the number.
  const play = (outs: (Outcome | "out")[], q: number) => {
    let s = newFiveMatch(5);
    for (const o of outs) s = applyOutcome(s, o, fakeScenario(), fakeBall({ x: 34, y: 18 }), q);
    return s;
  };
  const shotsGood = rawQuality(play(["saved", "saved", "delivered", "delivered"], 0.8));
  const passesGood = rawQuality(play(["delivered", "delivered", "saved", "saved"], 0.8));
  check(Math.abs(shotsGood - passesGood) < 1e-9, "the weighting is on the outcome, not the order");

  // A player who shot and a player who passed, each judged 0.9 on the shots
  // and 0.3 on the rest: the one whose GOOD touches were the shots must win.
  let a = newFiveMatch(5), b = newFiveMatch(5);
  for (const [o, q] of [["saved", 0.9], ["saved", 0.9], ["delivered", 0.3], ["delivered", 0.3]] as const) {
    a = applyOutcome(a, o, fakeScenario(), fakeBall({ x: 34, y: 18 }), q);
  }
  for (const [o, q] of [["saved", 0.3], ["saved", 0.3], ["delivered", 0.9], ["delivered", 0.9]] as const) {
    b = applyOutcome(b, o, fakeScenario(), fakeBall({ x: 34, y: 18 }), q);
  }
  check(rawQuality(a) > rawQuality(b), "the shots carry more of the verdict than the passes");
}

// ── Half time is a reset, not a caption ─────────────────────────────────
{
  // Play into the interval and check the picture actually goes back to a
  // kick-off shape rather than carrying on from wherever the last touch left
  // everybody — which is what it used to do.
  let s = newFiveMatch(31);
  // Move everybody somewhere they could not possibly be at a kick-off.
  s = {
    ...s,
    world: {
      ...s.world,
      ball: { x: 30, y: 3 },
      mates: [{ x: 26, y: 2 }, { x: 40, y: 3 }, { x: 34, y: 4 }],
      opps: [{ x: 27, y: 4 }, { x: 41, y: 5 }, { x: 33, y: 2 }, { x: 35, y: 6 }],
    },
  };
  const kickOff = newFiveMatch(31).world;
  let crossed: FiveMatchState | null = null;
  for (let i = 0; i < 40 && !s.over; i++) {
    const before = s.half;
    s = applyOutcome(s, "delivered", fakeScenario(), fakeBall({ x: 30, y: 3 }), 0.5);
    if (s.half !== before) { crossed = s; break; }
  }
  check(crossed !== null, "the match reaches half time");
  if (crossed) {
    check(crossed.half === 2, `it is the second half afterwards, got ${crossed.half}`);
    check(crossed.restart === "kick-off", "…and it restarts with a kick-off");
    check(crossed.possession === "you", "…which is yours, so the half opens on a kick-off and not their attack");
    check(
      JSON.stringify(crossed.world) === JSON.stringify(kickOff),
      "…and everybody is back in the kick-off shape rather than where the last touch left them",
    );
    check(crossed.log.includes("Half time."), "…and it says so");
    check(!crossed.over, "half time is not full time");
  }
  // The interval must not fire twice, or the second half is a series of resets.
  if (crossed) {
    const on = applyOutcome(crossed, "delivered", fakeScenario(), fakeBall({ x: 30, y: 9 }), 0.5);
    check(on.restart !== "kick-off", "the second half only kicks off once");
    check(on.half === 2, "…and stays in the second half");
  }
}

// ── Resuming their ball plays THEIR attack first ────────────────────────
//
// The exploit this closes, in full: every touch of yours that hands the ball
// over saves the match with `possession: "them"` and the screen waits a beat
// before rolling their attack. Closing the app in that beat and re-opening it
// used to skip the attack entirely and hand you the ball wherever the restart
// had left it — after a save, two metres from their goal line, dead centre.
{
  // A real saved shot, folded in by the real reducer, so the position under
  // test is the one the game actually writes.
  let s = newFiveMatch(4242);
  s = applyOutcome(s, "saved", fakeScenario(), fakeBall({ x: 34, y: 0.4 }), 0.34);
  check(s.possession === "them", "a save hands the ball over");
  check(s.restart === "goal-kick", "…for a goal kick");
  // The tap-in that made it worth doing: the restart really is on their line.
  check(s.world.ball.y < 3, `the restart sits on their goal line (y=${s.world.ball.y})`);

  const saved = JSON.parse(JSON.stringify(s)) as FiveMatchState;
  check(resumeAction(saved) === "opp", "a resumed match with their ball plays their attack first");

  // Follow the rule through and prove the attack genuinely happened.
  const after = oppAttack(saved, 0.5, 60);
  check(
    Math.abs(after.minute - (saved.minute + MINUTES_PER_OPP_ATTACK)) < 1e-9,
    `their attack costs the clock (${saved.minute} -> ${after.minute})`,
  );
  check(after.possession === "you", "…and hands the ball back afterwards");
  check(after.draws > saved.draws, "…having actually rolled for it");
  check(
    after.world.ball.y > saved.world.ball.y,
    "…and you do not simply get the ball back where the save left it",
  );

  // The other two branches of the rule.
  check(resumeAction(after) === "passage", "with your own ball, a resume just builds the passage");
  check(resumeAction({ ...saved, over: true }) === "done", "a finished match is finished");
  check(
    resumeAction({ ...saved, over: false, minute: 999 }) === "done",
    "…and so is one whose clock has run out, however it was saved",
  );

  // Repeating the exploit must not pay: doing it ten times in a row costs the
  // clock ten times, rather than being free.
  let loop = saved;
  for (let i = 0; i < 10 && !loop.over; i++) {
    check(resumeAction(loop) !== "passage", "a re-opened app never skips their attack");
    loop = oppAttack(loop, 0.5, 60);
    if (!loop.over) loop = applyOutcome(loop, "saved", fakeScenario(), fakeBall({ x: 34, y: 0.4 }), 0.34);
  }
  check(loop.over, "ten shots and ten attacks is a whole match, not a free loop");
}

// ── The screen's own stream survives a resume too ───────────────────────
{
  // `passageDraws` is additive: a save written before it existed has no such
  // field, and must still load and still play.
  const legacy = JSON.parse(JSON.stringify(newFiveMatch(9))) as Record<string, unknown>;
  delete legacy.passageDraws;
  const old = legacy as unknown as FiveMatchState;
  check(old.passageDraws === undefined, "the fixture really is a save from before the field existed");
  const played = applyOutcome(old, "delivered", fakeScenario(), fakeBall({ x: 34, y: 18 }), 0.5);
  check(played.events.length === 1, "an old save still plays");
  check(played.passageDraws === undefined, "…and is left alone when the caller does not track a stream");
  check((old.passageDraws ?? 0) === 0, "…reading as zero, which is exactly the old behaviour");

  // A caller that DOES track one has it carried through both reducers.
  let s = newFiveMatch(9);
  s = applyOutcome(s, "saved", fakeScenario(), fakeBall({ x: 34, y: 0.4 }), 0.34, { passageDraws: 512 });
  check(s.passageDraws === 512, `the stream position is recorded, got ${s.passageDraws}`);
  const kept = oppAttack(s, 0.5, 60);
  check(kept.passageDraws === 512, "…and survives their attack when the caller does not update it");
  const moved = oppAttack(s, 0.5, 60, { passageDraws: 900 });
  check(moved.passageDraws === 900, "…or moves on when it does, because their attack is a save point too");
  check(
    JSON.stringify(JSON.parse(JSON.stringify(s)).passageDraws) === "512",
    "…and it round-trips through JSON, which is how it reaches the next session",
  );
}

// ── The stage score behaves ─────────────────────────────────────────────
{
  const played = (n: number, quality: number, goals = 0) => {
    let s = newFiveMatch(3);
    for (let i = 0; i < n && !s.over; i++) {
      s = applyOutcome(s, i < goals ? "goal" : "delivered", fakeScenario(),
        fakeBall({ x: 34, y: i < goals ? 0 : 18 }), quality);
    }
    return s;
  };

  // Harder is worth more, as a property across the range.
  const good = played(10, 0.8);
  let last = -1;
  for (let d = 0; d <= 1.0001; d += 0.05) {
    const sc = fiveASideScore(good, d);
    check(sc >= 0 && sc <= 100, `score in range at difficulty ${d.toFixed(2)}, got ${sc}`);
    check(sc >= last, "the same afternoon must never be worth less when it was harder");
    last = sc;
  }
  // Better is worth more.
  check(fiveASideScore(played(10, 0.9), 0.5) > fiveASideScore(played(10, 0.3), 0.5), "playing better scores more");
  // A blank game is worth something, but not much.
  // You did not draw that game; you were on the pitch while it was drawn.
  const blank = newFiveMatch(3);
  check(fiveASideScore(blank, 0.5) === 0, "a match you never touched the ball in scores nothing");
  check(rawQuality(blank) === 0, "…including before difficulty is taken into account");
  const poor = played(10, 0.05);
  check(fiveASideScore(poor, 0.5) < 20, `a terrible match should score badly, got ${fiveASideScore(poor, 0.5)}`);
  // Winning counts for something.
  const scored = played(10, 0.6, 3);
  const didnt = played(10, 0.6, 0);
  check(fiveASideScore(scored, 0.5) > fiveASideScore(didnt, 0.5), "scoring goals and winning is worth more");
  // Nonsense difficulty cannot produce a nonsense score.
  for (const d of [NaN, -5, 5]) {
    const sc = fiveASideScore(good, d);
    check(Number.isFinite(sc) && sc >= 0 && sc <= 100, `nonsense difficulty ${d} still scored sanely (${sc})`);
  }

  // The summary reports what actually happened.
  const sum = summarise(scored, 0.5);
  check(sum.goals === 3, `three goals reported, got ${sum.goals}`);
  check(sum.scoreline[0] === 3, "the scoreline matches");
  check(sum.result === "win", "three-nil is a win");
  check(sum.touches === scored.events.length, "every touch is counted");

  // …and the quality handed to the trial is NOT already difficulty-scaled,
  // or the scaling would be applied twice.
  const q = stageQualityFrom(good);
  check(q >= 0 && q <= 1, `stage quality in range, got ${q}`);
  check(
    q === rawQuality(good),
    "the quality handed to the trial is the unscaled one — the trial applies its own "
    + "difficulty scaling, and applying it twice would punish a hard trial twice over",
  );
  // The relationship that has to hold between the two, checked against the
  // TRIAL's own function rather than a copy of its arithmetic. This used to
  // restate `0.70 + 0.60 * d` by hand, which is how the five-a-side's own
  // number and the stage score shown a moment later on the result card came
  // to disagree once the trial's ceiling was fixed.
  for (const d of [0, 0.25, 0.5, 0.75, 1]) {
    check(
      fiveASideScore(good, d) === stageScore(rawQuality(good), d),
      `the five-a-side's own number is the trial's own formula (at ${d}: `
      + `${fiveASideScore(good, d)} vs ${stageScore(rawQuality(good), d)})`,
    );
  }
  // …and the ceiling fix reaches this screen too: perfect play must not be
  // capped below the top of the ladder on the kindest difficulty roll.
  const perfect = { ...good, events: good.events.map(e => ({ ...e, quality: 1 })), score: [3, 0] as [number, number] };
  check(
    fiveASideScore(perfect, 0) >= 95,
    `a flawless afternoon is not capped on an easy roll, got ${fiveASideScore(perfect, 0)}`,
  );
}

// ── A match survives being saved and picked up again ────────────────────
{
  let s = newFiveMatch(77);
  for (let i = 0; i < 5; i++) {
    s = applyOutcome(s, "delivered", fakeScenario(), fakeBall({ x: 34, y: 16 }), 0.6);
  }
  const saved = JSON.parse(JSON.stringify(s)) as FiveMatchState;
  check(JSON.stringify(saved) === JSON.stringify(s), "a match in progress round-trips through JSON unchanged");

  // Carrying on from the save gives the same match as never having stopped.
  const carriedOn = oppAttack(saved, 0.5, 60);
  const neverStopped = oppAttack(s, 0.5, 60);
  check(
    JSON.stringify(carriedOn.score) === JSON.stringify(neverStopped.score),
    "carrying on from a save plays out the same as never having closed the app",
  );
  check(carriedOn.draws > saved.draws, "…and the random stream moves on rather than repeating itself");
}

// ── Small helpers say true things ───────────────────────────────────────
{
  const s = newFiveMatch(1);
  check(zoneOf({ ...s, world: { ...s.world, ball: { x: 34, y: 5 } } }) === "final-third", "near their goal is the last third");
  check(zoneOf({ ...s, world: { ...s.world, ball: { x: 34, y: 30 } } }) === "own-half", "deep is your own half");
  check(halfAt(s) === 1, "a match starts in the first half");
  check(halfAt({ ...s, minute: 4 }) === 2, "past three minutes is the second half");
  check(resultOf({ ...s, score: [2, 1] }) === "win", "two-one is a win");
  check(resultOf({ ...s, score: [1, 1] }) === "draw", "one-one is a draw");
  check(resultOf({ ...s, score: [0, 1] }) === "loss", "nil-one is a loss");
  check(goalCentreX(FIVE_A_SIDE) === (FIVE_GOAL.x1 + FIVE_GOAL.x2) / 2, "the goal's centre is its centre");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the match keeps score, always ends, and is the same game from the same seed");
