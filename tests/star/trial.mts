import {
  startTrial, difficultyFor, scoringDifficultyFor, keeperBonusFor, stageScore,
  reloadDifficultyBump, recordStage, noteReload, beginStage, resumeInterrupted,
  nextStage, trialComplete, trialScore, TRIAL_STAGES, SHARP_KEEPER_BONUS,
  RELOAD_DIFFICULTY_STEP, RELOAD_DIFFICULTY_CAP, RELOAD_GRACE,
  SCORE_BASE, SCORE_DIFFICULTY_SPAN, TRIAL_ADVERSITY, ADVERSITY_CHANCE,
  adversityFor, adversityOn, adversityWeightFor,
  type TrialStage, type TrialAdversityId,
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
 *  3. **Re-opening the app cannot change the score at all, and past two
 *     resumes it makes the football much harder.** This has been wrong in
 *     both directions. It used to PAY — the reload bump went into the same
 *     difficulty figure the score was multiplied by, so ten resumes turned a
 *     perfect trial on seed 0 from 73 into 81. The fix for that was a quiet
 *     haircut on the recorded quality, and that has now been overruled too:
 *     "don't give their score a penalty, just kind of troll them, just make
 *     it hard". So the property tested here is no longer "a resume costs
 *     score" but the sharper pair — a resume moves the score by EXACTLY
 *     nothing, and past `RELOAD_GRACE` it moves what the drills ask by a
 *     lot. Tested by measurement across hundreds of seeds rather than by
 *     reading the formula, because reading the formula is exactly what
 *     missed it the first time.
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

// ── Two resumes are free; the third onward is steep ─────────────────────
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

  // The grace period, which is the half of this the player is meant to
  // benefit from: somebody whose train went into a tunnel twice pays NOTHING,
  // not "almost nothing". `climbed[i]` is the difficulty after i+1 resumes,
  // and the first of those is free anyway (nothing had been played yet), so
  // the first genuinely charged one is `climbed[1]`.
  for (let i = 0; i <= RELOAD_GRACE; i++) {
    check(climbed[i] === d0, `resume ${i + 1} is still free (${climbed[i]} vs ${d0})`);
  }
  check(
    climbed[RELOAD_GRACE + 1] > d0 || d0 === 1,
    "…and the one past the grace period is not",
  );

  // Steep once it starts, not a token nudge. The step is what makes this a
  // troll rather than a tax — six times the old one.
  check(
    RELOAD_DIFFICULTY_STEP >= 0.15,
    `a charged resume should genuinely hurt the football, step is ${RELOAD_DIFFICULTY_STEP}`,
  );
  for (let i = 1; i < climbed.length; i++) {
    check(climbed[i] >= climbed[i - 1], "difficulty never goes DOWN as you re-open the app");
  }
  const capped = Math.min(1, d0 + RELOAD_DIFFICULTY_CAP);
  check(
    Math.abs(climbed[climbed.length - 1] - capped) < 1e-9,
    `twenty resumes should hit the cap (${capped}), got ${climbed[climbed.length - 1]}`,
  );
  check(
    RELOAD_DIFFICULTY_CAP / RELOAD_DIFFICULTY_STEP === 5,
    "the cap should be reached in a handful of charged resumes, not dozens",
  );

  // The bump on its own, away from any trial: free through the grace period,
  // linear after it, capped, and never negative however the field is
  // tampered with. A hand-edited save claiming -99 resumes must not buy an
  // easier trial.
  for (let r = 0; r <= RELOAD_GRACE; r++) {
    check(reloadDifficultyBump(r) === 0, `${r} charged resumes cost nothing`);
  }
  check(
    Math.abs(reloadDifficultyBump(RELOAD_GRACE + 1) - RELOAD_DIFFICULTY_STEP) < 1e-9,
    "the first charged resume past the grace period is exactly one step",
  );
  check(reloadDifficultyBump(10_000) === RELOAD_DIFFICULTY_CAP, "…and it caps");
  for (const junk of [-99, -1, NaN, Infinity, -Infinity]) {
    check(reloadDifficultyBump(junk) === 0, `a nonsense reload count (${junk}) buys nothing`);
  }
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

// ── The adversity catalogue itself is coherent ──────────────────────────
//
// v1 had one event, so "the catalogue" was a string literal and there was
// nothing to check. There are eleven now, nine of which genuinely change the
// football and two of which are captions, and the difference between those
// two groups is load-bearing: a caption that earned score would be paying a
// player for a thing that never happened.
{
  const ids = TRIAL_ADVERSITY.map(e => e.id);
  check(new Set(ids).size === ids.length, "no two events share an id");
  check(TRIAL_ADVERSITY.length >= 10, `around ten events was the ask, got ${TRIAL_ADVERSITY.length}`);

  for (const e of TRIAL_ADVERSITY) {
    check(e.label.length > 0 && e.blurb.length > 0, `${e.id} says what it is`);
    check(e.stages.length > 0, `${e.id} can actually land somewhere`);
    check(new Set(e.stages).size === e.stages.length, `${e.id} lists each stage once`);
    check(e.weight >= 0 && e.weight <= 1, `${e.id}'s weight is in range (${e.weight})`);
    // The rule the whole flavour/real split rests on, in both directions.
    check(
      e.flavour === (e.weight === 0),
      `${e.id}: flavour means worth nothing, and worth nothing means flavour`,
    );
  }
  const real = TRIAL_ADVERSITY.filter(e => !e.flavour);
  const flavour = TRIAL_ADVERSITY.filter(e => e.flavour);
  check(real.length >= 8, `most of them should genuinely bite, ${real.length} do`);
  check(flavour.length >= 1 && flavour.length <= 3,
    `a couple of pure-flavour ones, got ${flavour.length}`);

  // A save naming an event this build has never heard of reads as "nothing
  // went against you" rather than crashing the trial it is attached to.
  check(
    adversityFor({ adversity: "a-thing-from-the-future" as TrialAdversityId }) === null,
    "an unknown event id resolves to nothing rather than throwing",
  );
  check(adversityFor({ adversity: null }) === null, "…and so does no event at all");
}

// ── A drawn event lands where it bites, and nowhere else ────────────────
{
  let withAdversity = 0, withReal = 0;
  const drawn = new Set<string>();
  for (let seed = 1; seed <= 2000; seed++) {
    const t = startTrial(seed);
    if (t.adversity === null) {
      check(t.adversityStage === null, "no adversity means no stage carries it");
      for (const s of TRIAL_STAGES) {
        check(keeperBonusFor(t, s) === 0, "a trial with no adversity has no keeper bonus anywhere");
        check(adversityWeightFor(t, s) === 0, "…and no stage is worth more for it");
        check(adversityOn(t, s) === null, "…and no stage reports one");
      }
      continue;
    }
    withAdversity++;
    drawn.add(t.adversity);
    const ev = adversityFor(t);
    check(ev !== null, `a drawn event (${t.adversity}) is in the catalogue`);
    check(t.adversityStage !== null, "an adversity event lands on a real stage");
    if (!ev || !t.adversityStage) continue;
    if (!ev.flavour) withReal++;

    // It landed on a stage it can actually do something to — a sharper
    // keeper means nothing in the dribbling stage, and a shorter look at the
    // picture means nothing outside the vision stage.
    check(
      ev.stages.includes(t.adversityStage),
      `${ev.id} landed on ${t.adversityStage}, which is not on its own list`,
    );

    // Exactly one stage carries it, and every other stage is untouched.
    const carrying = TRIAL_STAGES.filter(s => adversityOn(t, s) !== null);
    check(carrying.length === 1 && carrying[0] === t.adversityStage,
      `exactly one stage carries the event, got ${carrying.length}`);
    for (const s of TRIAL_STAGES) {
      if (s === t.adversityStage) continue;
      check(adversityWeightFor(t, s) === 0, `${s} is worth nothing extra for an event elsewhere`);
      check(keeperBonusFor(t, s) === 0, `${s} gets no keeper bonus for an event elsewhere`);
    }

    // The keeper bonus is the SHARP KEEPER's, and only his. Ten other events
    // exist now and none of them may quietly hand out a save-radius bonus.
    const keeperStages = TRIAL_STAGES.filter(s => keeperBonusFor(t, s) > 0);
    if (ev.id === "sharp-keeper") {
      check(keeperStages.length === 1, "a sharp keeper lands on exactly one stage");
      check(keeperBonusFor(t, t.adversityStage) === SHARP_KEEPER_BONUS, "…and is worth the full bonus");
      check(
        t.adversityStage !== "dribbling" && t.adversityStage !== "vision",
        `a sharp keeper must not land on ${t.adversityStage} — there is no keeper to beat`,
      );
    } else {
      check(keeperStages.length === 0, `${ev.id} must not hand out a keeper bonus`);
    }

    // ── What the event is WORTH, which only a real one is ──
    //
    // "If you performed better in a harder trial… they're worth more" — so a
    // real event adds to what the stage was worth, and a caption adds
    // exactly nothing, because a caption changed no football.
    const worthWith = scoringDifficultyFor(t, t.adversityStage);
    const worthWithout = scoringDifficultyFor(
      { ...t, adversity: null, adversityStage: null }, t.adversityStage,
    );
    if (ev.flavour) {
      check(worthWith === worthWithout, `${ev.id} is a caption and must be worth nothing`);
    } else {
      check(
        worthWith > worthWithout || worthWithout === 1,
        `${ev.id} made the stage harder and should be worth more for it`,
      );
    }
  }

  // Every event in the catalogue is reachable. One that never draws is a
  // dead entry wearing a weight.
  for (const e of TRIAL_ADVERSITY) {
    check(drawn.has(e.id), `${e.id} never came up in 2000 trials`);
  }

  // The rate. `ADVERSITY_CHANCE` is deliberately above the old 0.34 so that
  // the two flavour events sit ON TOP of the old rate of a genuinely harder
  // afternoon rather than taking a slice out of it — checked here, because
  // that reasoning is only true if the roll really is uniform over the
  // catalogue.
  const rate = withAdversity / 2000, realRate = withReal / 2000;
  check(Math.abs(rate - ADVERSITY_CHANCE) < 0.05,
    `something should go on in about ${ADVERSITY_CHANCE} of trials, got ${rate.toFixed(3)}`);
  check(Math.abs(realRate - 0.34) < 0.05,
    `a genuinely harder afternoon should still be about a third, got ${realRate.toFixed(3)}`);
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

// ── Re-opening the app changes the SCORE by exactly nothing ─────────────
//
// This property has been wrong in both directions, which is why it is
// measured rather than read.
//
// It used to PAY: the reload bump lived in the same difficulty figure the
// score was multiplied by, so every resume raised the multiplier on every
// stage still to come, and perfect play on seed 0 scored 73 clean and 81
// after ten resumes. That was fixed by splitting the two figures and adding a
// quiet 2 %-per-resume haircut on the recorded quality — which has now been
// overruled in turn:
//
//   "Don't give their score a penalty. Just kind of troll them. Just make it
//    hard, way harder than it should be, and keep that score the same."
//
// So the bar is no longer "a resume costs something". It is stricter than
// that in one direction and deliberately empty in the other: the score for a
// given performance must be IDENTICAL however many times the app was
// re-opened, and the football must get much harder. Reloading stops paying
// because a farmer cannot produce the performance any more, not because a
// multiplier quietly ate the number he can see.
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
  check(lowered === 0, `…and none may lower it either, ${lowered} did`);
  check(level > 0, "the measurement actually ran");

  // The quality that gets recorded is the quality that was played. No
  // haircut, no hidden multiplier — a result a player cannot recompute is a
  // result nobody should trust.
  for (const reloads of [0, 1, 5, 40]) {
    let t = startTrial(3);
    for (let i = 0; i < reloads; i++) t = noteReload(t);
    check(
      recordStage(t, "penalties", 0.8).results.penalties!.quality === 0.8,
      `${reloads} resumes still record the quality actually played`,
    );
  }

  // The whole trial, end to end, on the seed the original bug was measured
  // on. Farming it must be worth exactly nothing — not "slightly less", which
  // is what the haircut version gave.
  const perfect = (reloads: number) => {
    let t = startTrial(0);
    for (let i = 0; i < reloads; i++) t = noteReload(t);
    return trialScore(TRIAL_STAGES.reduce((acc, s) => recordStage(acc, s, 1), t));
  };
  check(perfect(10) === perfect(0), `farming seed 0 must not pay (${perfect(10)} vs ${perfect(0)})`);
  check(perfect(30) === perfect(0), "…however far past the difficulty cap it is farmed");

  // …and the reason that is safe: the football itself is a different
  // afternoon. A farmed trial ASKS for much more even though it cannot score
  // higher for it, which is the whole of the inverted penalty.
  let t = startTrial(9);
  const asked0 = difficultyFor(t, "freeKicks");
  const worth0 = scoringDifficultyFor(t, "freeKicks");
  for (let i = 0; i < 8; i++) t = noteReload(t);
  check(
    difficultyFor(t, "freeKicks") >= Math.min(1, asked0 + 4 * RELOAD_DIFFICULTY_STEP),
    "eight resumes should make the stage ask for a great deal more",
  );
  check(
    scoringDifficultyFor(t, "freeKicks") === worth0,
    "…and still cannot change what the stage is WORTH",
  );

  // The one thing a resume is still allowed to change about the RECORD: the
  // difficulty it remembers, which is the afternoon's own story and not the
  // score's arithmetic.
  check(
    recordStage(t, "freeKicks", 0.5).results.freeKicks!.difficulty >
      recordStage(startTrial(9), "freeKicks", 0.5).results.freeKicks!.difficulty,
    "a resumed stage remembers that it was played harder",
  );
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
  // back, play the same stage well. The first score stands.
  const cheated = recordStage(noteReload(t1), "penalties", 1.0);
  check(cheated.results.penalties!.score === first, "re-opening the app cannot rescore a finished stage");

  // …and once he stops being somebody whose phone died and starts being
  // somebody farming the app, the rest of the trial is a different
  // afternoon. Deliberately checked past `RELOAD_GRACE` rather than at one
  // resume: the first two are free ON PURPOSE, which is the half of this
  // design the honest player benefits from.
  let farmed = t1;
  for (let i = 0; i <= RELOAD_GRACE + 1; i++) farmed = noteReload(farmed);
  check(
    difficultyFor(farmed, "freeKicks") > difficultyFor(t1, "freeKicks"),
    "…and farming it has made the rest of the trial harder",
  );
  check(
    difficultyFor(recordStage(noteReload(t1), "penalties", 1), "freeKicks")
      === difficultyFor(t1, "freeKicks"),
    "…while one honest resume has changed nothing at all",
  );

  // The stored difficulty is the one the stage was actually played at — the
  // full figure the drills were built from, which is what the result card's
  // "they made that hard" line is talking about.
  check(
    t1.results.penalties!.difficulty ===
      Math.min(1, difficultyFor(t0, "penalties") + adversityWeightFor(t0, "penalties")),
    "a result remembers how hard the stage actually was — bad break and all",
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
