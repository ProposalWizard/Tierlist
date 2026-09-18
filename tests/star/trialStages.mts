import {
  ladderLevel, REPS, penaltySetup, freeKickSetup, dribbleSetup, dribbleQuality,
  visionSetup, visionQuality, meanQuality, strikeQuality, attemptSeed,
  PENALTY_TELL_EASY, PENALTY_TELL_HARD,
} from "../../lib/star/trialStages";
import { startTrial, difficultyFor, TRIAL_STAGES, noteReload } from "../../lib/star/trial";
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

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  each stage asks more when the trial is harder, is the same trial every time, and scores in range");
