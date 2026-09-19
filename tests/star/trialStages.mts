import {
  ladderLevel, REPS, penaltySetup, freeKickSetup, dribbleSetup, dribbleQuality,
  visionSetup, visionQuality, meanQuality, weightedQuality, strikeQuality,
  attemptSeed, penaltyTell, teachSeen, markTeachSeen, clearTeachSeen,
  TEACHABLE_DRILLS,
  PENALTY_TELL_EASY, PENALTY_TELL_HARD, PENALTY_TELL_RAMP, REP_WEIGHT_RAMP,
  COLD_KEEPER_TELL, BIG_WALL_MEN, LONG_RANGE_M, QUICK_FEET_BONUS, EXTRA_MAN,
  SNAP_DECISION_FLOOR, CROWDED_PICTURE_MAX, TIGHT_MARGINS_FLOOR,
} from "../../lib/star/trialStages";
import {
  startTrial, difficultyFor, TRIAL_STAGES, noteReload, TRIAL_ADVERSITY,
  type TrialProgress, type TrialAdversityId, type TrialStage,
} from "../../lib/star/trial";
import { CX, PEN_SPOT_Y } from "../../lib/star/pitch";

/**
 * WHAT EACH STAGE ASKS, AND WHAT YOUR ATTEMPT WAS WORTH.
 *
 * The properties that matter here are the ones nobody would notice were wrong
 * by playing a single trial:
 *
 *  1. **Harder trials genuinely ask for more.** If difficulty does not move
 *     the setup, the whole seeded-difficulty design is decoration.
 *  2. **The same trial is the same trial.** Every setup is derived from the
 *     seed, so closing the app cannot re-roll a penalty into an easier one, or
 *     let you see which pass is the right one and then restart.
 *  3. **Nothing is scored out of range**, ever, from any input — these numbers
 *     are written onto the career.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── The ladder translation ──────────────────────────────────────────────
{
  check(ladderLevel(0) === 0, "the easiest trial asks the bottom rung");
  check(ladderLevel(1) === 100, "the hardest asks the top");
  check(ladderLevel(0.5) === 50, "and it is a straight mapping in between");
  for (const junk of [NaN, -5, 5, Infinity]) {
    const l = ladderLevel(junk);
    check(l >= 0 && l <= 100 && Number.isFinite(l), `nonsense difficulty ${junk} still gave a real rung (${l})`);
  }
}

// ── Every stage gives you a real number of attempts ─────────────────────
{
  for (const [stage, n] of Object.entries(REPS)) {
    check(n >= 3 && n <= 8, `${stage} should be a few attempts, not one and not an evening (${n})`);
  }
  check(
    Object.keys(REPS).length === TRIAL_STAGES.length - 1,
    "every stage but the five-a-side has a rep count",
  );
}

// ── Harder trials genuinely ask for more ────────────────────────────────
{
  // Two trials that really are at opposite ends, found rather than assumed.
  const easySeed = Array.from({ length: 4000 }, (_, i) => i)
    .find(i => difficultyFor(startTrial(i), "penalties") < 0.12);
  const hardSeed = Array.from({ length: 4000 }, (_, i) => i)
    .find(i => difficultyFor(startTrial(i), "penalties") > 0.85);
  check(easySeed !== undefined && hardSeed !== undefined, "the difficulty roll should reach both ends");

  if (easySeed !== undefined && hardSeed !== undefined) {
    const easy = startTrial(easySeed), hard = startTrial(hardSeed);
    check(
      penaltySetup(hard, 0).keeperStrength > penaltySetup(easy, 0).keeperStrength,
      "a harder trial puts a better keeper in the goal",
    );
    check(
      Math.abs(penaltySetup(hard, 0).keeperLean) > 0,
      "a good keeper commits to a side rather than standing still",
    );
  }

  // Across the whole range, not just at the ends.
  let lastKeeper = -1, lastDist = -1, lastWall = -1, lastWindow = 99;
  for (let d = 0; d <= 1.0001; d += 0.1) {
    const t = { ...startTrial(1), baseDifficulty: d, stageRolls: Object.fromEntries(TRIAL_STAGES.map(s => [s, 0])) as never };
    const fk = freeKickSetup(t, 0);
    const vi = visionSetup(t, 0);
    const dr = dribbleSetup(t);
    check(fk.distance >= lastDist, "a harder trial puts the free kick further out");
    check(fk.wall >= lastWall, "…with more men in the wall");
    check(fk.keeperStrength >= lastKeeper, "…and a better keeper");
    check(vi.window <= lastWindow, "a harder trial gives you less time to find the pass");
    check(dr.oppStrength > 0 && dr.defenders > 0, "somebody is always between you and the line");
    lastDist = fk.distance; lastWall = fk.wall; lastKeeper = fk.keeperStrength; lastWindow = vi.window;
  }
}

// ── Adversity lands where it should, and only there ─────────────────────
{
  // Find a trial whose sharp keeper is on the free kicks, and compare it
  // against the same trial with the adversity removed.
  const seed = Array.from({ length: 4000 }, (_, i) => i)
    .find(i => { const t = startTrial(i); return t.adversity === "sharp-keeper" && t.adversityStage === "freeKicks"; });
  check(seed !== undefined, "some trial should put a sharp keeper on the free kicks");
  if (seed !== undefined) {
    const t = startTrial(seed);
    const without = { ...t, adversity: null as never, adversityStage: null };
    check(
      freeKickSetup(t, 0).keeperStrength > freeKickSetup(without, 0).keeperStrength,
      "a sharp keeper really is harder to beat",
    );
    check(
      penaltySetup(t, 0).keeperStrength === penaltySetup(without, 0).keeperStrength,
      "…and only in the stage it landed on",
    );
    check(freeKickSetup(t, 0).keeperStrength <= 99, "however sharp, he is still a goalkeeper");
  }
}

// ── The same trial is the same trial ────────────────────────────────────
{
  for (const seed of [3, 77, 4242]) {
    const a = startTrial(seed), b = startTrial(seed);
    for (let rep = 0; rep < 6; rep++) {
      check(
        JSON.stringify(penaltySetup(a, rep)) === JSON.stringify(penaltySetup(b, rep)),
        `seed ${seed}: penalty ${rep} is the same penalty`,
      );
      check(
        JSON.stringify(freeKickSetup(a, rep)) === JSON.stringify(freeKickSetup(b, rep)),
        `seed ${seed}: free kick ${rep} is the same free kick`,
      );
      check(
        visionSetup(a, rep).correct === visionSetup(b, rep).correct,
        `seed ${seed}: the right pass is the same pass — otherwise a reload shows you the answer`,
      );
    }
  }
  // Different reps are different problems, or it is one kick five times.
  const t = startTrial(9);
  const spots = new Set(Array.from({ length: 4 }, (_, r) => JSON.stringify(freeKickSetup(t, r).ball)));
  check(spots.size > 1, "the free kicks are not all from the same spot");
  const answers = new Set(Array.from({ length: 6 }, (_, r) => visionSetup(t, r).correct));
  check(answers.size > 1, "the right pass is not always the same option");

  // …and re-opening the app, which makes the trial harder, really does change
  // what is asked — it would be a strange anti-cheat that changed nothing.
  const reloaded = noteReload(noteReload(noteReload(noteReload(noteReload(noteReload(t))))));
  check(
    freeKickSetup(reloaded, 0).keeperStrength > freeKickSetup(t, 0).keeperStrength,
    "farming the app for an easy trial really does make it harder",
  );
}

// ── A RESUME DRAWS NEW PROBLEMS, NOT THE ONES YOU JUST SAW THE ANSWER TO ──
//
// The bug this pins down, in full, because it was real and it was invisible:
// every stage's rep counter lives in React state and is never saved. So a
// resume restarts the stage at rep 1 — and while the setups were seeded off
// `trial.seed` alone, rep 1 after a resume was byte-for-byte the rep 1 you had
// just played. Watch which man rings green six times, close the app, reopen,
// tap the six you remember: near-perfect score, no football in it at all. The
// same trick retook a penalty stage against a keeper leaning the same way
// every time. `visionSetup`'s own comment claimed the opposite was true.
{
  // Built by hand rather than through `noteReload`, deliberately: WHEN a
  // resume is charged for is `trial.ts`'s business and has its own rules (a
  // load that interrupted nothing is free). What is being checked here is only
  // what a charged resume must then DO to the questions, so the input is the
  // charged state itself.
  const resume = (t: ReturnType<typeof startTrial>, n = 1) => ({ ...t, reloads: t.reloads + n });
  const base = startTrial(4242);
  const resumed = resume(base);
  check(
    attemptSeed(base) !== attemptSeed(resumed),
    "a resumed trial draws from a different seed — otherwise the whole stage is a memory test",
  );
  check(
    attemptSeed(base) === attemptSeed({ ...base }),
    "…and an unresumed trial is still exactly itself",
  );
  // Nonsense on the field cannot produce NaN — this seed feeds every rep of
  // three stages.
  for (const junk of [NaN, -3, Infinity, undefined as unknown as number]) {
    const seed = attemptSeed({ ...base, reloads: junk });
    check(Number.isInteger(seed) && seed >= 0, `reloads ${junk} still gave a real seed (${seed})`);
  }

  // The properties that actually matter, measured across many trials rather
  // than asserted off one: two trials differing ONLY in `reloads` must ask
  // different questions.
  let visionDiffered = 0, leanDiffered = 0, trials = 0;
  for (let seed = 0; seed < 300; seed++) {
    const a = startTrial(seed);
    const b = resume(a);
    trials++;
    const answersA = Array.from({ length: REPS.vision }, (_, r) => visionSetup(a, r).correct).join(",");
    const answersB = Array.from({ length: REPS.vision }, (_, r) => visionSetup(b, r).correct).join(",");
    if (answersA !== answersB) visionDiffered++;
    const leansA = Array.from({ length: REPS.penalties }, (_, r) => Math.sign(penaltySetup(a, r).keeperLean)).join(",");
    const leansB = Array.from({ length: REPS.penalties }, (_, r) => Math.sign(penaltySetup(b, r).keeperLean)).join(",");
    if (leansA !== leansB) leanDiffered++;
  }
  // Not 100 %: six answers out of three-to-eight options can coincide by luck,
  // and so can five coin flips. What must not happen is a resume that reliably
  // hands back the same afternoon.
  check(visionDiffered > trials * 0.9,
    `only ${visionDiffered}/${trials} resumes changed the vision answers`);
  check(leanDiffered > trials * 0.85,
    `only ${leanDiffered}/${trials} resumes changed which way the keeper went`);
}

// ── The penalty tell shrinks as the day gets harder ─────────────────────
//
// It used to GROW (`0.3 + 0.7 × d`), which made the hardest trials the ones
// that announced the answer loudest — shoot the other side, and the better the
// keeper the more clearly he told you which side that was.
{
  const meanTell = (d: number) => {
    const rolls = Object.fromEntries(TRIAL_STAGES.map(s => [s, 0])) as never;
    let total = 0, n = 0;
    for (let seed = 0; seed < 200; seed++) {
      const t = { ...startTrial(seed), baseDifficulty: d, stageRolls: rolls, reloads: 0 };
      for (let rep = 0; rep < REPS.penalties; rep++) { total += Math.abs(penaltySetup(t, rep).keeperLean); n++; }
    }
    return total / n;
  };
  let last = Infinity;
  for (let d = 0; d <= 1.0001; d += 0.125) {
    const tell = meanTell(d);
    check(tell < last, `the keeper's tell should shrink as the trial hardens, and did not at d=${d.toFixed(3)}`);
    last = tell;
  }
  check(PENALTY_TELL_HARD < PENALTY_TELL_EASY, "the hard-day tell is the smaller one");
  // …but never nothing. A keeper who does not commit at all is not a harder
  // read, he is no read, and the stage stops being about anything.
  check(PENALTY_TELL_HARD > 0, "he still commits at the top of the ladder");
  check(meanTell(1) > 0.05, "…by a genuinely readable amount");
}

// ── The penalty spot is the penalty spot ────────────────────────────────
{
  const p = penaltySetup(startTrial(1), 0);
  check(p.ball.x === CX && p.ball.y === PEN_SPOT_Y, "a penalty is taken from the spot");
  for (let rep = 0; rep < 5; rep++) {
    const s = penaltySetup(startTrial(1), rep);
    check(s.ball.x === CX && s.ball.y === PEN_SPOT_Y, "…every time");
    check(Math.abs(s.keeperLean) <= 1, `the keeper leans one way or the other, not off the pitch (${s.keeperLean})`);
  }
}

// ── Scoring: in range, and pointing the right way ───────────────────────
{
  // Dribbling: beating men is most of it, getting through is the rest.
  const setup = dribbleSetup(startTrial(1));
  const none = dribbleQuality({ cleared: false, beaten: 0 }, setup);
  const some = dribbleQuality({ cleared: false, beaten: Math.ceil(setup.defenders / 2) }, setup);
  const allButOne = dribbleQuality({ cleared: false, beaten: setup.defenders - 1 }, setup);
  const through = dribbleQuality({ cleared: true, beaten: setup.defenders }, setup);
  check(none === 0, "beating nobody and not getting through is worth nothing");
  check(some > none, "beating some of them is worth something");
  check(allButOne > some, "beating nearly all of them is worth more");
  check(through > allButOne, "and getting through is worth most");
  check(through <= 1, "…without going over 1");
  check(
    allButOne > dribbleQuality({ cleared: true, beaten: 0 }, setup),
    "beating four and being stopped by the fifth shows a scout more than walking through a gap",
  );

  // Vision: right man, and how fast you saw it.
  const v = visionSetup(startTrial(1), 0);
  const quick = visionQuality(v.correct, v, 0.05);
  const slow = visionQuality(v.correct, v, v.window * 0.95);
  const wrong = visionQuality((v.correct + 1) % v.options, v, 0.1);
  const nothing = visionQuality(null, v, v.window);
  check(quick > slow, "seeing it quickly is worth more than seeing it late");
  check(slow > wrong, "the right pass late still beats the wrong one");
  check(wrong > nothing, "a wrong pass beats never lifting your head");
  check(nothing === 0, "…which is worth nothing at all");
  check(quick <= 1 && slow >= 0, "vision scores stay in range");
  // Taking longer than the window cannot go negative.
  check(visionQuality(v.correct, v, 999) >= 0, "a very late correct pass is still not negative");

  // Struck shots reuse the drills' own judgement, which is already tuned.
  check(strikeQuality("goal", CX) > strikeQuality("saved", null), "scoring beats being saved");
  check(strikeQuality("saved", null) > strikeQuality("blocked", null), "being saved beats being blocked");
  for (const o of ["goal", "saved", "post", "wide", "over", "blocked", "tackled", "nonsense"]) {
    const q = strikeQuality(o, null);
    check(q >= 0 && q <= 1 && Number.isFinite(q), `${o} scored in range (${q})`);
  }
}

// ── A stage's own quality is the mean of what you did ───────────────────
{
  check(meanQuality([]) === 0, "attempting nothing is worth nothing");
  check(meanQuality([1, 1, 1]) === 1, "three perfect attempts is a perfect stage");
  check(Math.abs(meanQuality([1, 0]) - 0.5) < 1e-9, "one good and one bad is half");
  check(
    meanQuality([1, 0, 0, 0, 0]) < meanQuality([0.5, 0.5, 0.5, 0.5, 0.5]),
    "one good penalty and four bad ones is a player who scores one in five, not a good finisher",
  );
  // Junk in cannot corrupt the career.
  const junk = meanQuality([NaN, Infinity, -5, 5, 0.5]);
  check(Number.isFinite(junk) && junk >= 0 && junk <= 1, `nonsense reps still gave a real quality (${junk})`);
}

// ── The tell ramps across the reps, and lands in all three bands ────────
//
// The stage is one decision taken four times, and the ramp is what makes the
// four of them genuinely different: read him, look hard, then nothing. That
// is only true if each step actually lands in the band the screen's own
// subtitle reads it against — `> 0.55` is "he's committed", `> 0.22` is "he's
// shading one way", and anything under that is "he hasn't shown you a thing".
//
// Checked at BOTH ends of the difficulty range, because the ramp multiplies a
// ceiling that difficulty itself shrinks, and the first version of this
// collapsed to two bands on the hardest afternoons for exactly that reason:
// at a hard-end ceiling of 0.25 the three steps came out 0.25 / 0.105 / 0.03,
// which reads as "shading, nothing, nothing".
{
  const COMMITTED = 0.55, SHADING = 0.22;
  const at = (d: number): TrialProgress => {
    const t = startTrial(4242);
    return { ...t, baseDifficulty: d, stageRolls: { ...t.stageRolls, penalties: 0 } };
  };
  for (const d of [0, 0.5, 1]) {
    const t = at(d);
    check(penaltyTell(t, 0) > COMMITTED, `at difficulty ${d} the first kick is readable (${penaltyTell(t, 0)})`);
    const second = penaltyTell(t, 1);
    check(second > SHADING && second <= COMMITTED,
      `at difficulty ${d} the second kick is shaded, not obvious (${second})`);
    check(penaltyTell(t, 2) <= SHADING, `at difficulty ${d} the third kick shows nothing (${penaltyTell(t, 2)})`);
    // Strictly down, never level — a "ramp" with a flat step is one fewer
    // decision than it claims.
    check(penaltyTell(t, 0) > second && second > penaltyTell(t, 2),
      `at difficulty ${d} each kick genuinely shows less than the last`);
    // …and it HOLDS at the hardest version rather than cycling back round to
    // a telegraphed one.
    check(penaltyTell(t, 3) === penaltyTell(t, 2), "the fourth kick is the third again, not a reset");
    check(penaltyTell(t, 99) === penaltyTell(t, 2), "…and so is any rep past the end of the ramp");
  }

  // A harder afternoon shows you less on the same rep. This ran BACKWARDS
  // once — the harder the trial, the further off centre the keeper stood
  // before the run-up — so the hardest penalties in the game were the ones
  // whose answer was most obvious.
  for (const rep of [0, 1, 2]) {
    check(penaltyTell(at(1), rep) < penaltyTell(at(0), rep),
      `rep ${rep + 1} shows less on a hard day than an easy one`);
  }
  check(PENALTY_TELL_HARD < PENALTY_TELL_EASY, "the hard-day ceiling is the lower one");
  check(PENALTY_TELL_RAMP.length === 3, "three steps: committed, shading, nothing");

  // Nonsense reps resolve to a real number rather than `undefined * ceiling`.
  for (const junk of [-5, NaN, Infinity]) {
    const v = penaltyTell(at(0.5), junk);
    check(Number.isFinite(v) && v >= 0 && v <= 1, `a nonsense rep (${junk}) still gave a real tell (${v})`);
  }

  // The keeper's lean is the tell, in the direction he actually picked — the
  // magnitude is the rep's and only the SIDE is drawn. Before this, how much
  // there was to see was itself a dice roll, so the "telegraphed" rep could
  // come out at 0.03 and show nothing.
  for (let seed = 1; seed <= 60; seed++) {
    const t = startTrial(seed);
    for (let rep = 0; rep < REPS.penalties; rep++) {
      const lean = penaltySetup(t, rep).keeperLean;
      check(Math.abs(Math.abs(lean) - penaltyTell(t, rep)) < 1e-9,
        `seed ${seed} rep ${rep}: the lean is exactly the rep's own tell`);
      check(Math.abs(lean) > 0, "…and he always picks a side");
    }
  }
}

// ── Four penalties, and it is a floor ───────────────────────────────────
//
// Three was asked for and three does not hold up, which is worth proving here
// rather than leaving as a claim in a comment somebody can talk themselves
// out of. `strikeQuality`'s bands are wide on purpose — a block is 0.16, a
// save 0.34, a goal 0.55-1.0 — so at three reps a single unlucky attempt
// swings the mean by about a fifth of the whole scale.
//
// Measured against the real bands with a real pair of takers: one who scores
// 70 % of the time, one who scores 50 %, and how often the WORSE one comes
// out ahead over a stage.
{
  check(REPS.penalties >= 4, `penalties needs at least four reps, has ${REPS.penalties}`);

  // A deterministic little RNG, so this measurement is the same measurement
  // every time it runs.
  let state = 0x2545f491;
  const rnd = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
  /** One attempt from a taker who scores `p` of the time, scored through the
   *  real `strikeQuality` rather than a stand-in for it. */
  const attempt = (p: number) => {
    const r = rnd();
    if (r < p) return strikeQuality("goal", CX + (rnd() - 0.5) * 5);
    if (r < p + (1 - p) * 0.6) return strikeQuality("saved", null);
    return strikeQuality("blocked", null);
  };
  const upsetRate = (reps: number, weighted: boolean) => {
    let upsets = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const good = Array.from({ length: reps }, () => attempt(0.70));
      const poor = Array.from({ length: reps }, () => attempt(0.50));
      const score = weighted ? weightedQuality : meanQuality;
      if (score(poor) > score(good)) upsets++;
    }
    return upsets / N;
  };
  // Rep count alone, with the weighting held off, so the two changes in this
  // round are not measured as one.
  const three = upsetRate(3, false);
  const four = upsetRate(REPS.penalties, false);
  const six = upsetRate(6, false);
  // …and then what the weighting does on top, at the length actually shipped.
  const fourWeighted = upsetRate(REPS.penalties, true);

  check(three > 0.15,
    `three reps should genuinely read as a coin flip — that is why it is not three (${(three * 100).toFixed(1)}%)`);
  check(four < three,
    `${REPS.penalties} reps must be a better read than three (${(four * 100).toFixed(1)}% vs ${(three * 100).toFixed(1)}%)`);
  check(six < four,
    "…and it keeps improving with length, which is why four is a FLOOR and not a target");
  // Stated plainly rather than implied: the weighting is not an accuracy
  // measure and does not pretend to be. It exists so that surviving the
  // hardest rep is worth something, and against a taker whose quality does
  // not change rep to rep it should barely move this number either way.
  check(Math.abs(fourWeighted - four) < 0.05,
    `weighting the later reps should not distort who the better player is (${(fourWeighted * 100).toFixed(1)}% vs ${(four * 100).toFixed(1)}%)`);
  if (process.env.TRIAL_MEASURE) {
    console.log(`  flat: three ${(three * 100).toFixed(1)}%  four ${(four * 100).toFixed(1)}%  six ${(six * 100).toFixed(1)}%`
      + `  |  weighted four ${(fourWeighted * 100).toFixed(1)}%`);
  }
}

// ── The later reps are worth more, because they are harder ──────────────
//
// The other half of the ramp, and the reason the two had to ship together: a
// stage that gets harder as it goes while every rep counts the same is
// strictly a worse deal than a flat one — the last rep pays nothing extra for
// being survived and costs full price for being fluffed.
{
  check(weightedQuality([]) === 0, "attempting nothing is worth nothing");
  check(weightedQuality([1, 1, 1, 1]) === 1, "a perfect stage is still a perfect stage");
  check(weightedQuality([0, 0, 0, 0]) === 0, "…and a blank one is still blank");
  check(Math.abs(weightedQuality([0.4, 0.4, 0.4]) - 0.4) < 1e-9,
    "four identical attempts weight to exactly what they all were");

  // The property itself: the same good rep is worth more late than early.
  check(weightedQuality([0, 0, 1]) > weightedQuality([1, 0, 0]),
    "surviving the hard one at the end beats coasting the easy one at the start");
  check(weightedQuality([0, 1]) > weightedQuality([1, 0]), "…at two reps too");

  // Gentle, deliberately. A ramp steep enough to make the opening reps
  // decorative turns a four-attempt stage into one attempt with a warm-up.
  const lastShare = REP_WEIGHT_RAMP[REP_WEIGHT_RAMP.length - 1];
  check(lastShare > 1 && lastShare <= 2,
    `the last rep should count for more and not for double (${lastShare})`);
  check(REP_WEIGHT_RAMP.every((w, i) => i === 0 || w >= REP_WEIGHT_RAMP[i - 1]),
    "the weights never go back down");
  check(REP_WEIGHT_RAMP.every(w => w > 0), "every rep counts for something");

  // It can never INVERT: improving any one attempt can only ever raise the
  // stage. A weight of zero or below would break this and nothing else would
  // notice.
  for (let trial = 0; trial < 500; trial++) {
    const n = 2 + (trial % 5);
    const base = Array.from({ length: n }, (_, i) => ((trial * 7 + i * 13) % 100) / 100);
    const before = weightedQuality(base);
    for (let i = 0; i < n; i++) {
      const better = [...base];
      better[i] = Math.min(1, better[i] + 0.2);
      check(weightedQuality(better) >= before, `raising rep ${i} can never lower the stage`);
    }
  }

  // Junk in cannot corrupt the career — same bar the flat mean already met.
  const junk = weightedQuality([NaN, Infinity, -5, 5, 0.5]);
  check(Number.isFinite(junk) && junk >= 0 && junk <= 1, `nonsense reps still gave a real quality (${junk})`);
}

// ── Every adversity event does something, and only on its own stage ─────
//
// The rule the whole catalogue was written under: an event is in it because a
// real dial already existed for it, and a caption pretending to be a mechanic
// is not an event. So each one is checked against the setup it claims to
// change — and against the four setups it must leave alone.
{
  const withEvent = (id: TrialAdversityId | null, stage: TrialStage): TrialProgress => {
    const t = startTrial(2024);
    return {
      ...t,
      baseDifficulty: 0.5,
      stageRolls: { penalties: 0, freeKicks: 0, dribbling: 0, vision: 0, fiveASide: 0 },
      adversity: id,
      adversityStage: id ? stage : null,
    };
  };
  const clean = (stage: TrialStage) => withEvent(null, stage);

  // Free kicks: a sixth man, and a ball waved backwards.
  {
    const base = freeKickSetup(clean("freeKicks"), 0);
    const wall = freeKickSetup(withEvent("big-wall", "freeKicks"), 0);
    const far = freeKickSetup(withEvent("long-range", "freeKicks"), 0);
    check(wall.wall === base.wall + BIG_WALL_MEN, "one more in the wall means one more in the wall");
    check(far.distance > base.distance + LONG_RANGE_M - 1e-9, "pushed further out means further out");
    check(far.ball.y > base.ball.y, "…and the ball is actually put there");
    check(wall.distance === base.distance, "a bigger wall does not also move the ball");
    // Six is the cap — past that it is a hedge, not a wall.
    const hardWall = freeKickSetup(
      { ...withEvent("big-wall", "freeKicks"), baseDifficulty: 1 }, 3,
    );
    check(hardWall.wall <= 6, `the wall is capped at six, got ${hardWall.wall}`);
  }

  // Running at men: quicker, and one more of them.
  {
    const base = dribbleSetup(clean("dribbling"));
    const quick = dribbleSetup(withEvent("quick-feet", "dribbling"));
    const extra = dribbleSetup(withEvent("extra-man", "dribbling"));
    check(quick.oppStrength === Math.min(100, base.oppStrength + QUICK_FEET_BONUS), "they're rapid");
    check(extra.defenders === base.defenders + EXTRA_MAN, "one more body to beat");
    check(
      extra.waveSizes.reduce((a, b) => a + b, 0) === extra.defenders,
      "…and the men you are scored against are the men actually on the screen",
    );
    check(extra.waveSizes[extra.waveSizes.length - 1] > base.waveSizes[base.waveSizes.length - 1],
      "…thrown into the LAST wave, so the run gets harder as it goes");
    // The run's own ten-man ceiling still wins.
    const packed = dribbleSetup({ ...withEvent("extra-man", "dribbling"), baseDifficulty: 1 });
    check(packed.defenders <= 10, `never more than ten men, got ${packed.defenders}`);
    check(packed.waveSizes.reduce((a, b) => a + b, 0) === packed.defenders, "…and the count still matches the waves");
  }

  // Looking up: less time, more bodies, and less in it.
  {
    const base = visionSetup(clean("vision"), 0);
    const snap = visionSetup(withEvent("snap-decision", "vision"), 0);
    const crowd = visionSetup(withEvent("crowded-picture", "vision"), 0);
    const tight = visionSetup(withEvent("tight-margins", "vision"), 0);
    check(snap.window < base.window, "no time on it");
    check(snap.window >= SNAP_DECISION_FLOOR, "…but never shorter than the hardest ordinary rep in the game");
    check(crowd.options > base.options, "busy in there");
    check(crowd.options <= CROWDED_PICTURE_MAX, "…up to the ceiling the picture can be read at");
    check(crowd.correct >= 0 && crowd.correct < crowd.options, "…and the answer is still one of the men drawn");
    check(tight.margin < base.margin, "nothing in it");
    check(tight.margin >= TIGHT_MARGINS_FLOOR, "…but still a real gap rather than a guess");
  }

  // Penalties: the one that takes information away rather than adding
  // difficulty. It bites on the kicks that had a tell to take, and — honestly
  // — does nothing at all on the ones that never had one.
  {
    const cold = withEvent("cold-keeper", "penalties");
    const base = clean("penalties");
    check(penaltyTell(cold, 0) < penaltyTell(base, 0), "he gives nothing away on the first kick");
    check(Math.abs(penaltyTell(cold, 0) - penaltyTell(base, 0) * COLD_KEEPER_TELL) < 1e-9,
      "…by exactly the event's own factor");
    check(penaltyTell(cold, 2) < penaltyTell(base, 2) + 1e-9,
      "…and never shows MORE than an ordinary keeper on the no-tell kicks");
  }

  // The four stages it did not land on are untouched, whatever it was.
  for (const e of TRIAL_ADVERSITY) {
    const home = e.stages[0];
    const t = withEvent(e.id, home);
    const c = clean(home);
    for (const other of ["penalties", "freeKicks", "dribbling", "vision"] as TrialStage[]) {
      if (other === home) continue;
      const a = JSON.stringify({
        p: penaltySetup(t, 0), f: freeKickSetup(t, 0), d: dribbleSetup(t), v: visionSetup(t, 0),
      }[other[0] as "p" | "f" | "d" | "v"]);
      const b = JSON.stringify({
        p: penaltySetup(c, 0), f: freeKickSetup(c, 0), d: dribbleSetup(c), v: visionSetup(c, 0),
      }[other[0] as "p" | "f" | "d" | "v"]);
      check(a === b, `${e.id} landed on ${home} and must leave ${other} exactly alone`);
    }
  }

  // A flavour event changes NOTHING anywhere, including on its own stage.
  // That is its entire definition, and the one way it could quietly stop
  // being true is somebody reaching for `adversityOn` without checking
  // `flavour` — which is how the tell floor that used to live here went in.
  for (const e of TRIAL_ADVERSITY.filter(x => x.flavour)) {
    for (const stage of ["penalties", "freeKicks", "dribbling", "vision"] as TrialStage[]) {
      const t = withEvent(e.id, stage), c = clean(stage);
      check(JSON.stringify(penaltySetup(t, 0)) === JSON.stringify(penaltySetup(c, 0)),
        `${e.id} must not touch the penalties setup`);
      check(JSON.stringify(freeKickSetup(t, 0)) === JSON.stringify(freeKickSetup(c, 0)),
        `${e.id} must not touch the free-kick setup`);
      check(JSON.stringify(dribbleSetup(t)) === JSON.stringify(dribbleSetup(c)),
        `${e.id} must not touch the dribble setup`);
      check(JSON.stringify(visionSetup(t, 0)) === JSON.stringify(visionSetup(c, 0)),
        `${e.id} must not touch the vision setup`);
    }
  }
}

// ── The tutorial you have already read ─────────────────────────────────────
//
// Reported directly: "you should be able to get rid of the little tutorial",
// with the explicit follow-on that dismissing it should be REMEMBERED, so a
// returning player is not re-taught every trial and every retrial.
//
// The card itself is React over a canvas and is not reachable from here. The
// thing underneath it — whether this device has been taught a given drill —
// is a plain function pair, and it is the half that has to survive a reload,
// so it is the half worth pinning down.
{
  // Every read and write goes through a bare `localStorage`, the same way
  // faceStyle.ts reaches it, so a fake one can be handed to it here.
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };

  clearTeachSeen();
  check(TEACHABLE_DRILLS.every(d => !teachSeen(d)),
    "a device nobody has taught anything to reports every drill as untaught");

  // The whole point: it sticks. Nothing here reloads a module, but nothing in
  // `teachSeen` caches either — it reads storage every time, which IS what
  // surviving a reload means for a function with no state of its own.
  markTeachSeen("penalties");
  check(teachSeen("penalties"), "a dismissed drill stays dismissed");

  // Per drill, not one flag for the lot. Penalties teach the drag; free kicks
  // teach striking the side of the ball to bend it; the vision stage teaches a
  // clock that starts on its own. Dismissing one must not silently skip the
  // other two, which are genuinely different lessons.
  check(!teachSeen("freeKicks") && !teachSeen("vision") && !teachSeen("dribbling"),
    "dismissing one drill's teaching does not dismiss the others");

  for (const d of TEACHABLE_DRILLS) markTeachSeen(d);
  check(TEACHABLE_DRILLS.every(d => teachSeen(d)), "every drill can be dismissed");
  clearTeachSeen();
  check(TEACHABLE_DRILLS.every(d => !teachSeen(d)), "clearing puts every drill back to untaught");

  // Distinct keys, so this can never collide with another per-device
  // preference (`star-match-muted`, the face-style keys) sharing the store.
  markTeachSeen("vision");
  const keys = [...store.keys()];
  check(keys.length === 1 && keys[0].includes("vision") && keys[0].startsWith("star-"),
    `one namespaced key per drill (${JSON.stringify(keys)})`);
  clearTeachSeen();

  // ── Storage that throws must not take a stage down with it ──
  //
  // A private window, blocked site data, or the server render of a client
  // component all throw on `localStorage`. The honest failure is "teach the
  // drill again", never an exception on the way into a trial stage.
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  let threw = false;
  try {
    markTeachSeen("penalties");
    clearTeachSeen();
    check(teachSeen("penalties") === false, "unreadable storage reports untaught rather than throwing");
  } catch {
    threw = true;
  }
  check(!threw, "storage that throws is swallowed, not propagated into the stage");

  delete (globalThis as { localStorage?: unknown }).localStorage;
  let threwMissing = false;
  try {
    check(teachSeen("vision") === false, "no storage at all reports untaught");
    markTeachSeen("vision");
  } catch {
    threwMissing = true;
  }
  check(!threwMissing, "a missing localStorage is survived too (server render)");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  each stage asks more when the trial is harder, is the same trial every time, and scores in range");
