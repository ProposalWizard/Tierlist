import {
  startTrial, difficultyFor, keeperBonusFor, stageScore, recordStage, noteReload,
  nextStage, trialComplete, trialScore, TRIAL_STAGES, SHARP_KEEPER_BONUS,
  RELOAD_DIFFICULTY_STEP, RELOAD_DIFFICULTY_CAP, type TrialStage,
} from "../../lib/star/trial";

/**
 * THE TRIAL'S OWN ARITHMETIC.
 *
 * Three properties carry this file, and all three are things that would be
 * invisible in a screenshot and expensive to discover live:
 *
 *  1. **Nothing is re-rolled.** The same seed is the same afternoon, forever.
 *     If this breaks, closing and re-opening the app becomes a way to shop
 *     for an easy trial, which is the exact behaviour the design is built to
 *     make costly rather than free.
 *  2. **A result, once decided, is final.** `recordStage` is idempotent, which
 *     is what makes "never lose progress" safe to promise — the result is on
 *     the career before the next screen renders, and a resume cannot replace
 *     a bad score with a better one.
 *  3. **Harder is worth more.** The same performance scores higher when more
 *     was asked of it. Tested as a property across the whole range rather
 *     than at one convenient pair of numbers.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── The same seed is the same trial ─────────────────────────────────────
{
  for (const seed of [1, 7, 99, 12345, 0xbeef]) {
    const a = startTrial(seed);
    const b = startTrial(seed);
    check(a.baseDifficulty === b.baseDifficulty, `seed ${seed}: base difficulty is reproducible`);
    check(
      JSON.stringify(a.stageRolls) === JSON.stringify(b.stageRolls),
      `seed ${seed}: every stage roll is reproducible`,
    );
    check(a.adversity === b.adversity, `seed ${seed}: adversity is reproducible`);
    check(a.adversityStage === b.adversityStage, `seed ${seed}: which stage it lands on is reproducible`);
  }

  // …and different seeds are genuinely different afternoons, or the roll is
  // decorative.
  const seen = new Set(Array.from({ length: 200 }, (_, i) => startTrial(i).baseDifficulty.toFixed(4)));
  check(seen.size > 150, `200 seeds should give many different trials, got ${seen.size}`);
}

// ── Difficulty is bounded, and every stage is real ──────────────────────
{
  let anyEasy = false, anyHard = false;
  for (let seed = 1; seed <= 400; seed++) {
    const t = startTrial(seed);
    for (const stage of TRIAL_STAGES) {
      const d = difficultyFor(t, stage);
      check(d >= 0 && d <= 1 && Number.isFinite(d), `difficulty stayed in 0-1 (${d})`);
      if (d < 0.25) anyEasy = true;
      if (d > 0.75) anyHard = true;
    }
  }
  check(anyEasy, "some trials should be genuinely easy");
  check(anyHard, "some trials should be genuinely hard");

  // A trial should have a SHAPE — a stage you found hard and one you didn't
  // — rather than being uniformly one number.
  let shaped = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const t = startTrial(seed);
    const ds = TRIAL_STAGES.map(s => difficultyFor(t, s));
    if (Math.max(...ds) - Math.min(...ds) > 0.15) shaped++;
  }
  check(shaped > 150, `most trials should vary stage to stage, only ${shaped}/200 did`);
}

// ── Re-opening the app costs, a little, and stops costing ───────────────
{
  const base = startTrial(42);
  const stage: TrialStage = "penalties";
  const d0 = difficultyFor(base, stage);

  let t = base;
  const climbed: number[] = [];
  for (let i = 0; i < 20; i++) {
    t = noteReload(t);
    climbed.push(difficultyFor(t, stage));
  }

  check(t.reloads === 20, "every resume is counted");
  check(climbed[0] > d0 || d0 === 1, "the first resume already costs something");
  for (let i = 1; i < climbed.length; i++) {
    check(climbed[i] >= climbed[i - 1], "difficulty never goes DOWN as you re-open the app");
  }
  // Capped: a player who genuinely lost signal is not punished indefinitely.
  const capped = Math.min(1, d0 + RELOAD_DIFFICULTY_CAP);
  check(
    Math.abs(climbed[climbed.length - 1] - capped) < 1e-9,
    `twenty resumes should hit the cap (${capped}), got ${climbed[climbed.length - 1]}`,
  );
  check(
    RELOAD_DIFFICULTY_CAP / RELOAD_DIFFICULTY_STEP === 5,
    "the cap should be reached in a handful of resumes, not dozens",
  );

  // And a negative or nonsense count can never make the trial EASIER than
  // its own roll — that would be a way to cheat rather than a guard against
  // one.
  check(
    difficultyFor({ ...base, reloads: -99 }, stage) === d0,
    "a nonsense reload count cannot reduce difficulty below the real roll",
  );
}

// ── Adversity is real, lands somewhere it bites, and only there ─────────
{
  let withAdversity = 0;
  const landedOn = new Set<string>();
  for (let seed = 1; seed <= 600; seed++) {
    const t = startTrial(seed);
    if (t.adversity === null) {
      check(t.adversityStage === null, "no adversity means no stage carries it");
      for (const s of TRIAL_STAGES) {
        check(keeperBonusFor(t, s) === 0, "a trial with no adversity has no keeper bonus anywhere");
      }
      continue;
    }
    withAdversity++;
    check(t.adversityStage !== null, "an adversity event lands on a real stage");
    landedOn.add(t.adversityStage!);

    // Exactly one stage carries it, and it is a stage with a keeper in it.
    const carrying = TRIAL_STAGES.filter(s => keeperBonusFor(t, s) > 0);
    check(carrying.length === 1, `exactly one stage carries the adversity, got ${carrying.length}`);
    check(keeperBonusFor(t, t.adversityStage!) === SHARP_KEEPER_BONUS, "…and it is worth the full bonus");
    check(
      t.adversityStage !== "dribbling" && t.adversityStage !== "vision",
      `a sharp keeper must not land on ${t.adversityStage} — there is no keeper to beat`,
    );
  }
  check(withAdversity > 100 && withAdversity < 400, `adversity should be occasional, fired ${withAdversity}/600`);
  check(landedOn.size === 3, `it should be able to land on any keeper stage, saw ${landedOn.size}`);
}

// ── Harder is worth more — as a property, not one lucky pair ────────────
{
  for (const q of [0, 0.25, 0.5, 0.75, 1]) {
    let last = -1;
    for (let d = 0; d <= 1.0001; d += 0.05) {
      const s = stageScore(q, d);
      check(s >= 0 && s <= 100, `score stayed in 0-100 (${s})`);
      check(s >= last, `the same performance (${q}) must never be worth LESS when it was harder`);
      last = s;
    }
  }
  // And better is worth more at a fixed difficulty.
  for (const d of [0, 0.3, 0.6, 1]) {
    let last = -1;
    for (let q = 0; q <= 1.0001; q += 0.05) {
      const s = stageScore(q, d);
      check(s >= last, `a better performance must never score LESS at difficulty ${d}`);
      last = s;
    }
  }
  check(stageScore(0, 0) === 0 && stageScore(0, 1) === 0, "doing nothing scores nothing, however hard it was");
  check(stageScore(1, 1) === 100, "a perfect stage in the hardest trial is worth the full 100");
  check(stageScore(1, 0) === 70, "a perfect stage in the easiest trial is worth less than one in a hard trial");
  // Garbage in cannot produce a score outside the range.
  for (const [q, d] of [[-5, 0.5], [5, 0.5], [0.5, -5], [0.5, 5], [NaN, 0.5]] as const) {
    const s = stageScore(q, d);
    check(Number.isFinite(s) && s >= 0 && s <= 100, `nonsense input (${q}, ${d}) still gave a sane score, got ${s}`);
  }
}

// ── A decided stage is decided ──────────────────────────────────────────
{
  const t0 = startTrial(7);
  const t1 = recordStage(t0, "penalties", 0.8);
  check(t1.results.penalties !== undefined, "a stage result is written");
  check(t0.results.penalties === undefined, "…without mutating the trial it was written from");

  const first = t1.results.penalties!.score;
  const t2 = recordStage(t1, "penalties", 1.0);
  check(t2 === t1, "recording a stage that already has a result is a genuine no-op");
  check(t2.results.penalties!.score === first, "…and cannot replace a bad score with a better one");

  // The realistic version of that attack: play badly, close the app, come
  // back, play the same stage well. The first score stands — and the resume
  // has made everything after it harder.
  const cheated = recordStage(noteReload(t1), "penalties", 1.0);
  check(cheated.results.penalties!.score === first, "re-opening the app cannot rescore a finished stage");
  check(
    difficultyFor(cheated, "freeKicks") > difficultyFor(t1, "freeKicks"),
    "…and it has made the rest of the trial harder",
  );

  // The stored difficulty is the one the stage was actually played at.
  check(
    t1.results.penalties!.difficulty === difficultyFor(t0, "penalties"),
    "a result remembers how hard the stage actually was",
  );
}

// ── Walking the stages ──────────────────────────────────────────────────
{
  let t = startTrial(11);
  check(nextStage(t) === TRIAL_STAGES[0], "a fresh trial starts at the first stage");
  check(!trialComplete(t), "a fresh trial is not complete");
  check(trialScore(t) === 0, "a trial with nothing played scores nothing");

  for (const [i, stage] of TRIAL_STAGES.entries()) {
    check(nextStage(t) === stage, `stage ${i + 1} comes next`);
    t = recordStage(t, stage, 0.6);
  }
  check(nextStage(t) === null, "there is nothing left after the last stage");
  check(trialComplete(t), "the trial is complete");

  const score = trialScore(t);
  check(score > 0 && score <= 100, `a played trial scores in range, got ${score}`);

  // An abandoned trial scores like a part-played one, not like a failure and
  // not like a full one.
  const half = TRIAL_STAGES.slice(0, 3).reduce((acc, s) => recordStage(acc, s, 1), startTrial(11));
  const full = TRIAL_STAGES.reduce((acc, s) => recordStage(acc, s, 1), startTrial(11));
  check(trialScore(half) < trialScore(full), "three perfect stages score less than five");
  check(trialScore(half) > 0, "…but three perfect stages are not worth nothing");
  check(
    Math.abs(trialScore(half) - trialScore(full) * 0.6) < 2,
    "three of five stages should be worth about three fifths",
  );

  // Every stage counts the same — no stage is secretly worth more.
  const perStage = TRIAL_STAGES.map(only => {
    const t2 = recordStage(startTrial(11), only, 1);
    return trialScore(t2) * TRIAL_STAGES.length;
  });
  const spread = Math.max(...perStage) - Math.min(...perStage);
  check(spread <= 100 * 0.6 + 6, `no stage should dominate the trial score (spread ${spread})`);
}

// ── A trial survives being written to disk and read back ────────────────
{
  const t = TRIAL_STAGES.slice(0, 2).reduce((acc, s) => recordStage(acc, s, 0.7), startTrial(2024));
  const back = JSON.parse(JSON.stringify(t)) as typeof t;
  check(JSON.stringify(back) === JSON.stringify(t), "a trial round-trips through JSON unchanged");
  check(nextStage(back) === TRIAL_STAGES[2], "…and resumes at the right stage");
  check(trialScore(back) === trialScore(t), "…with the same score");
  for (const s of TRIAL_STAGES) {
    check(difficultyFor(back, s) === difficultyFor(t, s), `…and the same difficulty for ${s}`);
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the trial is seeded, final once decided, and worth more when it was harder");
