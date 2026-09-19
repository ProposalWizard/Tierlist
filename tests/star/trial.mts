import {
  startTrial, difficultyFor, scoringDifficultyFor, keeperBonusFor, stageScore,
  reloadQualityHaircut, recordStage, noteReload, beginStage, resumeInterrupted,
  nextStage, trialComplete, trialScore, TRIAL_STAGES, SHARP_KEEPER_BONUS,
  RELOAD_DIFFICULTY_STEP, RELOAD_DIFFICULTY_CAP, RELOAD_QUALITY_STEP,
  RELOAD_QUALITY_FLOOR, SCORE_BASE, SCORE_DIFFICULTY_SPAN, type TrialStage,
} from "../../lib/star/trial";

/**
 * THE TRIAL'S OWN ARITHMETIC.
 *
 * Four properties carry this file, and all four are things that would be
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
 *  3. **Re-opening the app can only ever cost.** It used to PAY: the reload
 *     bump went into the same difficulty figure the score was multiplied by,
 *     so ten resumes turned a perfect trial on seed 0 from 73 into 81. Tested
 *     by measurement across hundreds of seeds rather than by reading the
 *     formula, because reading the formula is exactly what missed it.
 *  4. **Skill is always the ceiling, and always visible.** Perfect play
 *     reaches 95-100 whatever difficulty was rolled — it used to cap at 70 on
 *     an easy roll, which put the best outcome in the game out of reach on a
 *     dice the player never sees — and the score moves for every extra bit of
 *     quality at every difficulty, with no plateau at the top where a very
 *     good player and a perfect one score the same.
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

  check(t.resumes === 20, "every resume is seen");
  check(t.reloads === 19, "…and every one of them but the innocent first is charged for");
  // The first load of an untouched trial is the one right after career
  // creation. Nothing has been played, so there is nothing to retry.
  check(climbed[0] === d0, "the first load after creating a career is free");
  check(climbed[1] > d0 || d0 === 1, "…and the second, which walked out of stage one, is not");
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

// ── A resume only counts when it interrupted something ──────────────────
//
// The anti-cheat was billing two loads that nobody chose: the first one after
// career creation, and a phone throwing away a backgrounded tab. The first is
// provable from the trial's own data; the second needs the stage screen to say
// what it was showing, which is what `beginStage` is for.
{
  const fresh = startTrial(3001);
  check(!resumeInterrupted(fresh), "a brand-new trial's first load interrupted nothing");
  check(noteReload(fresh).reloads === 0, "…so it is not charged for");
  check(noteReload(fresh).resumes === 1, "…but it is remembered, so the next one knows");
  check(
    resumeInterrupted(noteReload(fresh)),
    "a SECOND load of an untouched trial means you walked out of stage one",
  );

  // Mid-trial there is no doubt at all: a stage is decided and the next is not.
  const started = recordStage(startTrial(3001), "penalties", 0.5);
  check(resumeInterrupted(started), "coming back to a part-played trial is a real resume");
  check(noteReload(started).reloads === 1, "…and is charged for immediately");

  // A trial with nothing left to come back into cannot be farmed.
  const done = TRIAL_STAGES.reduce((acc, s) => recordStage(acc, s, 0.5), startTrial(3001));
  check(!resumeInterrupted(done), "a finished trial has nothing left to interrupt");
  check(noteReload(done).reloads === 0, "…so re-opening it costs nothing");

  // With the marker kept, both innocent cases are exact — including the one
  // the fallback cannot see. Backgrounding on a between-stages result card is
  // not a decision the player made.
  const between = { ...started, inProgress: null };
  check(!resumeInterrupted(between), "a tab evicted between stages is not a resume");
  check(noteReload(between).reloads === 0, "…and is not charged for");
  const inside = beginStage(started, "freeKicks");
  check(inside.inProgress === "freeKicks", "beginStage records what you walked into");
  check(resumeInterrupted(inside), "…and walking out of it mid-stage is a real resume");
  check(
    !resumeInterrupted(beginStage(started, "penalties")),
    "a stale marker on a stage that already has a result cannot charge twice",
  );
  // The marker is only ever cleared for a trial that is actually keeping one —
  // otherwise recording stage one would silently switch the anti-cheat off for
  // the rest of the trial.
  check(
    recordStage(startTrial(3001), "penalties", 0.5).inProgress === undefined,
    "recordStage does not invent a marker nobody is keeping",
  );
  check(
    recordStage(inside, "freeKicks", 0.5).inProgress === null,
    "…and does clear one that somebody is",
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

// ── The ceiling: perfect play is worth ~100 on ANY afternoon ────────────
//
// It used to be worth 70 on the easiest one, and difficulty comes out at
// exactly 0 for about one stage roll in nine — so the best outcome in the
// game was being withheld on a dice nobody sees. Checked at every tenth of
// the range rather than at the two ends, because the two ends are exactly
// what the old formula got right.
{
  for (let d = 0; d <= 1.0001; d += 0.1) {
    const s = stageScore(1, d);
    check(s >= 95, `flawless play at difficulty ${d.toFixed(1)} should reach 95+, got ${s}`);
    check(s <= 100, `…and never break the scale, got ${s}`);
  }
  check(stageScore(1, 1) === 100, "a perfect stage in the hardest trial is worth the full 100");

  // A whole perfect trial, on every seed, not just a convenient one.
  let lowest = 100, highest = 0;
  for (let seed = 0; seed < 1500; seed++) {
    const t = TRIAL_STAGES.reduce((acc, s) => recordStage(acc, s, 1), startTrial(seed));
    lowest = Math.min(lowest, trialScore(t));
    highest = Math.max(highest, trialScore(t));
  }
  check(lowest >= 95, `a perfect trial should never score under 95, worst seed gave ${lowest}`);
  check(highest === 100, `…and a perfect trial on a hard afternoon should reach 100, best was ${highest}`);
}

// ── No plateau: every extra bit of quality moves the number ──────────────
//
// On a hard roll the old formula's product ran past 1 and got clamped, so
// everything from about 78 % quality upward scored the same 100 — the top
// quarter of skill was invisible and a very good player got a perfect
// player's offer. Strictness is checked at a step (0.02) coarse enough that
// rounding to a whole number cannot mask it: the shallowest slope in the
// whole surface is 95 points per unit of quality, so 0.02 is worth 1.9
// points, and two values 1.9 apart cannot round to the same integer.
{
  for (let d = 0; d <= 1.0001; d += 0.1) {
    let last = -1;
    for (let q = 0; q <= 1.0001; q += 0.02) {
      const s = stageScore(q, d);
      check(s >= 0 && s <= 100, `score stayed in 0-100 (${s})`);
      check(
        s > last,
        `at difficulty ${d.toFixed(1)}, quality ${q.toFixed(2)} must score MORE than the step below (${s} vs ${last})`,
      );
      last = s;
    }
    check(last >= 95, `…and the top of that run is a real top (${last})`);
  }
}

// ── Difficulty decides how HARD quality is to earn, not what it is worth ─
//
// The drills read `difficultyFor` and get genuinely harder. The scoring reads
// quality. All that is left in the score is a tie-break, so that two
// identical afternoons are not literally identical when one was harder — the
// story itself is told by the label on the result card, off the stored
// difficulty.
{
  for (const q of [0, 0.25, 0.5, 0.75, 1]) {
    let last = -1;
    for (let d = 0; d <= 1.0001; d += 0.05) {
      const s = stageScore(q, d);
      check(s >= last, `the same performance (${q}) must never be worth LESS when it was harder`);
      last = s;
    }
  }
  const spread = stageScore(1, 1) - stageScore(1, 0);
  check(
    spread === Math.round(100 * SCORE_DIFFICULTY_SPAN),
    `difficulty should only be a tie-break now, worth ${spread} points end to end`,
  );
  check(SCORE_BASE + SCORE_DIFFICULTY_SPAN === 1, "the hardest afternoon is worth exactly the full scale");
  check(stageScore(0, 0) === 0 && stageScore(0, 1) === 0, "doing nothing scores nothing, however hard it was");

  // Garbage in cannot produce a score outside the range.
  for (const [q, d] of [[-5, 0.5], [5, 0.5], [0.5, -5], [0.5, 5], [NaN, 0.5]] as const) {
    const s = stageScore(q, d);
    check(Number.isFinite(s) && s >= 0 && s <= 100, `nonsense input (${q}, ${d}) still gave a sane score, got ${s}`);
  }
}

// ── Re-opening the app can only ever COST ───────────────────────────────
//
// The bug this replaces: the reload bump lived in the same difficulty figure
// the score was multiplied by, so every resume raised the multiplier on every
// stage still to come. Perfect play on seed 0 scored 73 clean and 81 after
// ten resumes. Measured here rather than read, because reading is what missed
// it — every seed, every stage, a real spread of qualities, a real spread of
// resume counts.
{
  let raised = 0, lowered = 0, level = 0;
  for (let seed = 0; seed < 300; seed++) {
    for (const stage of TRIAL_STAGES) {
      for (const q of [0.15, 0.4, 0.65, 0.9, 1]) {
        const clean = recordStage(startTrial(seed), stage, q).results[stage]!.score;
        let t = startTrial(seed);
        for (let r = 1; r <= 10; r++) {
          t = noteReload(t);
          const s = recordStage(t, stage, q).results[stage]!.score;
          if (s > clean) raised++;
          else if (s < clean) lowered++;
          else level++;
        }
      }
    }
  }
  check(raised === 0, `no resume may ever raise a stage's score, ${raised} did`);
  check(lowered > level, `…and it should usually cost something real (${lowered} down, ${level} level)`);

  // The whole trial, end to end, on the seed the bug was measured on.
  const perfect = (reloads: number) => {
    let t = startTrial(0);
    for (let i = 0; i < reloads; i++) t = noteReload(t);
    return trialScore(TRIAL_STAGES.reduce((acc, s) => recordStage(acc, s, 1), t));
  };
  check(perfect(10) < perfect(0), `farming seed 0 must not pay (${perfect(10)} vs ${perfect(0)})`);
  check(perfect(30) < perfect(10), "…and it must keep not paying long past the difficulty cap");

  // The bump still reaches the drills, which is where it was always meant to
  // bite: a farmed trial genuinely plays harder even though it cannot score
  // higher for it.
  let t = startTrial(9);
  const asked0 = difficultyFor(t, "freeKicks");
  const worth0 = scoringDifficultyFor(t, "freeKicks");
  for (let i = 0; i < 8; i++) t = noteReload(t);
  check(difficultyFor(t, "freeKicks") > asked0, "resuming still makes the stage ASK for more");
  check(
    scoringDifficultyFor(t, "freeKicks") === worth0,
    "…and still cannot change what the stage is WORTH",
  );

  // The haircut itself: gentle, starts at nothing, never stops until the floor.
  check(reloadQualityHaircut(0) === 1, "a player who just played their trial is untouched");
  check(Math.abs(reloadQualityHaircut(2) - (1 - 2 * RELOAD_QUALITY_STEP)) < 1e-9, "two lost-signal resumes cost 4 %");
  check(reloadQualityHaircut(5) < reloadQualityHaircut(4), "it keeps costing past the difficulty cap");
  check(reloadQualityHaircut(1000) === RELOAD_QUALITY_FLOOR, "…down to a floor, so it is a cost and not a lockout");
  check(reloadQualityHaircut(-7) === 1 && reloadQualityHaircut(NaN) === 1, "a nonsense count cannot hand out a bonus");
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

  // The stored difficulty is the one the stage was actually played at — the
  // full figure the drills were built from, which is what the result card's
  // "they made that hard" line is talking about.
  check(
    t1.results.penalties!.difficulty === difficultyFor(t0, "penalties"),
    "a result remembers how hard the stage actually was",
  );
  // …and a stored result can be recomputed from its own fields, so nobody has
  // to take the number on trust. Checked on a resumed trial too, where the
  // stored difficulty and the scored one genuinely differ.
  for (const t of [t1, recordStage(noteReload(noteReload(startTrial(7))), "penalties", 0.8)]) {
    const r = t.results.penalties!;
    check(
      r.score === stageScore(r.quality, scoringDifficultyFor(t, "penalties")),
      `a result explains its own score (${r.score})`,
    );
  }
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
  check(
    spread <= 100 * SCORE_DIFFICULTY_SPAN + 6,
    `no stage should dominate the trial score (spread ${spread})`,
  );
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
console.log("PASS  the trial is seeded, final once decided, unreachable by farming, and always winnable on skill");
