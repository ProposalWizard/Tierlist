import {
  newFiveMatch, applyOutcome, oppAttack, isFullTime, resultOf, zoneOf, halfAt,
  MINUTES_PER_PASSAGE, type FiveMatchState,
} from "../../lib/star/fiveASide/match";
import {
  FIVE_A_SIDE, ELEVEN_A_SIDE, rulesAreSane, fullTimeMinutes, centreSpot, goalCentreX,
} from "../../lib/star/fiveASide/rules";
import {
  passageQuality, shotPlacementQuality, fiveASideScore, summarise, stageQualityFrom, rawQuality,
} from "../../lib/star/fiveASide/score";
import { buildPassage, kickOffWorld } from "../../lib/star/fiveASide/passage";
import { insideFivePitch, FIVE_GOAL } from "../../lib/star/fiveASide/geometry";
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
{
  const sc = fakeScenario();
  const easy = { ...sc, passDifficulty: 0.1, passAmbition: 0.1 } as Scenario;
  const hard = { ...sc, passDifficulty: 0.9, passAmbition: 0.2 } as Scenario;
  const ambitious = { ...sc, passDifficulty: 0.2, passAmbition: 0.9 } as Scenario;

  check(
    passageQuality("delivered", hard, null, FIVE_A_SIDE) > passageQuality("delivered", easy, null, FIVE_A_SIDE),
    "a harder pass is worth more",
  );
  check(
    passageQuality("delivered", ambitious, null, FIVE_A_SIDE) > passageQuality("delivered", easy, null, FIVE_A_SIDE),
    "so is the ambitious ball, even when it was not technically hard",
  );
  check(
    passageQuality("delivered", easy, null, FIVE_A_SIDE) > passageQuality("tackled", easy, null, FIVE_A_SIDE),
    "any completed pass beats losing it",
  );
  for (const out of ["goal", "delivered", "saved", "tackled", "out", "short"] as const) {
    const q = passageQuality(out, sc, null, FIVE_A_SIDE);
    check(q >= 0 && q <= 1 && Number.isFinite(q), `${out} is judged in range, got ${q}`);
  }
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
  // The relationship that has to hold between the two, stated directly.
  for (const d of [0, 0.25, 0.5, 0.75, 1]) {
    // Clamped, because a strong afternoon at the hardest difficulty scales
    // past 1 and a score is capped at 100 — a real ceiling, not an error.
    const expected = Math.round(100 * Math.min(1, rawQuality(good) * (0.70 + 0.60 * d)));
    check(
      Math.abs(fiveASideScore(good, d) - expected) <= 1,
      `the stage score is the raw quality scaled by difficulty (at ${d}: ${fiveASideScore(good, d)} vs ${expected})`,
    );
  }
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
