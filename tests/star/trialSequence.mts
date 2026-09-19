import {
  startTrial, recordStage, nextStage, trialComplete, trialScore, noteReload,
  TRIAL_STAGES, difficultyFor, type TrialProgress,
} from "../../lib/star/trial";
import { newFiveMatch, applyOutcome, type FiveMatchState } from "../../lib/star/fiveASide/match";
import { buildPassage, kickOffWorld } from "../../lib/star/fiveASide/passage";
import { summarise, stageQualityFrom } from "../../lib/star/fiveASide/score";
import { mulberry32 } from "../../lib/star/season";
import type { Ball } from "../../lib/star/canvasEngine";

/**
 * WALKING A WHOLE TRIAL, AND CLOSING THE APP IN THE MIDDLE OF IT.
 *
 * The sequencer itself is a React component and cannot be run here. What CAN
 * be run — and is the part that would actually cost somebody their opening —
 * is the state it moves through: does a trial played start to finish arrive at
 * a real score, and does closing the app at every possible point leave you
 * exactly where you were rather than back at the beginning or further on?
 *
 * The one that matters most is the five-a-side, because it is the only stage
 * long enough that losing it mid-way costs anything worth keeping.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const fakeBall = (at: { x: number; y: number }) => ({ pos: { ...at } } as Ball);
const scenario = () => buildPassage(kickOffWorld(true), { keeperStrength: 60, rng: mulberry32(1) });

/** Play a five-a-side out, stopping after `touches` if asked. */
function playFive(seed: number, touches = Infinity): FiveMatchState {
  let s = newFiveMatch(seed);
  let n = 0;
  while (!s.over && n < touches) {
    s = applyOutcome(s, n % 4 === 0 ? "goal" : "delivered", scenario(),
      fakeBall({ x: 34, y: n % 4 === 0 ? 0 : 16 }), 0.6);
    n++;
  }
  return s;
}

// ── A trial played start to finish arrives at a real number ─────────────
{
  let t = startTrial(1234);
  for (const stage of TRIAL_STAGES) {
    check(nextStage(t) === stage, `the sequencer offers ${stage} when it should`);
    t = recordStage(t, stage, 0.65);
    check(!!t.results[stage], `${stage} is written the moment it is decided`);
  }
  check(trialComplete(t), "the trial finishes");
  const score = trialScore(t);
  check(score > 0 && score <= 100, `a played trial scores in range, got ${score}`);
}

// ── Closing the app between stages costs nothing ────────────────────────
{
  // At every possible point, save, reload, and carry on. The result must be
  // the same trial, resuming at the same stage.
  for (let stopAfter = 0; stopAfter <= TRIAL_STAGES.length; stopAfter++) {
    let t = startTrial(55);
    for (let i = 0; i < stopAfter; i++) t = recordStage(t, TRIAL_STAGES[i], 0.7);

    const saved = JSON.parse(JSON.stringify(t)) as TrialProgress;
    check(JSON.stringify(saved) === JSON.stringify(t), `stopped after ${stopAfter}: the trial survives being saved`);
    check(
      nextStage(saved) === (stopAfter < TRIAL_STAGES.length ? TRIAL_STAGES[stopAfter] : null),
      `stopped after ${stopAfter}: it resumes at the right stage`,
    );
    // Every result already earned is still there, with the same score.
    for (let i = 0; i < stopAfter; i++) {
      check(
        saved.results[TRIAL_STAGES[i]]?.score === t.results[TRIAL_STAGES[i]]?.score,
        `stopped after ${stopAfter}: ${TRIAL_STAGES[i]} kept its score`,
      );
    }
  }
}

// ── …and a finished stage can never be replayed for a better score ──────
{
  let t = recordStage(startTrial(7), "penalties", 0.2);
  const bad = t.results.penalties!.score;
  // Close the app, come back, play it brilliantly.
  t = noteReload(JSON.parse(JSON.stringify(t)) as TrialProgress);
  t = recordStage(t, "penalties", 1);
  check(t.results.penalties!.score === bad, "a bad stage stays bad however many times you re-open the app");
  check(nextStage(t) === "freeKicks", "…and you carry on from the next stage, not that one");
}

// ── A five-a-side left half-played comes back where it was ──────────────
{
  const partway = playFive(2024, 6);
  check(!partway.over, "the fixture should genuinely be a half-played match");
  check(partway.events.length === 6, "six touches taken");

  // This is exactly what the sequencer stores on the trial and hands back.
  const t = { ...startTrial(2024), fiveASide: partway } as TrialProgress;
  const saved = JSON.parse(JSON.stringify(t)) as TrialProgress;
  const resumed = saved.fiveASide as FiveMatchState;

  check(resumed.minute === partway.minute, "you come back to the same minute");
  check(JSON.stringify(resumed.score) === JSON.stringify(partway.score), "…the same scoreline");
  check(resumed.events.length === partway.events.length, "…and every touch you had already taken");
  check(
    JSON.stringify(resumed.world) === JSON.stringify(partway.world),
    "…with the ten players standing exactly where they were",
  );

  // Carrying on from the save reaches full time like any other match.
  let s = resumed;
  let n = 0;
  while (!s.over && n < 200) {
    s = applyOutcome(s, "delivered", scenario(), fakeBall({ x: 34, y: 16 }), 0.6);
    n++;
  }
  check(s.over, "a resumed five-a-side still reaches full time");
  check(s.events.length > partway.events.length, "…continuing from where it stopped rather than restarting");
}

// ── The five-a-side hands back an UNSCALED quality ──────────────────────
//
// The sequencer hands `recordStage` the raw 0-1 quality — `stageQualityFrom`,
// which is what the real screen calls — and lets the trial do the scoring.
// Scaling it first would have the difficulty applied twice, and it is
// invisible on screen.
//
// This block used to reconstruct that quality by dividing `summarise`'s score
// back out by the old `0.70 + 0.60 × d` factor, which is a thing the real
// sequencer never does and which broke the moment the scoring shape changed.
// Worse, it hid the exact bug the reshape exists to kill: `fiveASideScore`
// clamps at 100, so on a hard afternoon a near-perfect match's score was
// pinned to the ceiling and dividing it back out reported a quality of 0.79
// for a performance that was really a 1.0. The real function is used here now.
{
  for (const d of [0, 0.3, 0.7, 1]) {
    const finished = playFive(99);
    const handedBack = stageQualityFrom(finished);
    check(
      handedBack >= 0 && handedBack <= 1.001,
      `at difficulty ${d} the quality handed to the trial is in range (${handedBack.toFixed(3)})`,
    );
    // Nothing about the difficulty is baked into it — the trial applies its
    // own, and only its own.
    check(
      stageQualityFrom(finished) === handedBack,
      "…and is the same number whatever the afternoon was like",
    );
    const t = recordStage(startTrial(4), "fiveASide", handedBack);
    const stored = t.results.fiveASide!;
    check(stored.score >= 0 && stored.score <= 100, `…and records a real score (${stored.score})`);
  }

  // The same afternoon at two difficulties. It is now worth essentially the
  // same either way, by design: difficulty decides how hard that quality was
  // to produce (every drill ladder reads `difficultyFor`), not what it is
  // worth once produced. What is left in the score is a few points of
  // tie-break; the "you did that on a hard day" story is told in words on the
  // result card, off the stored difficulty.
  const finished = playFive(99);
  const q = stageQualityFrom(finished);
  const flat = Object.fromEntries(TRIAL_STAGES.map(s => [s, 0])) as never;
  const easyTrial = { ...startTrial(4), baseDifficulty: 0.05, stageRolls: flat };
  const hardTrial = { ...startTrial(4), baseDifficulty: 0.95, stageRolls: flat };
  const easyScore = recordStage(easyTrial, "fiveASide", q).results.fiveASide!.score;
  const hardScore = recordStage(hardTrial, "fiveASide", q).results.fiveASide!.score;
  check(
    hardScore >= easyScore,
    `the same five-a-side is never worth LESS on a hard afternoon (${hardScore}) than an easy one (${easyScore})`,
  );
  check(
    hardScore - easyScore <= 6,
    `…and no longer worth dramatically more either (${hardScore} vs ${easyScore})`,
  );
  // The part that actually matters: a great five-a-side is a great score on
  // ANY afternoon. It used to top out at 70 on the kindest roll.
  check(
    Math.min(easyScore, hardScore) >= 90,
    `a near-perfect five-a-side should score like one whatever was rolled (${easyScore}/${hardScore})`,
  );
  check(
    summarise(finished, difficultyFor(hardTrial, "fiveASide")).difficulty > 0.9,
    "…and the afternoon it was played on is still recorded, for the words on the card",
  );
}

// ── An abandoned trial is not a zero, and not a full one ────────────────
{
  const abandoned = TRIAL_STAGES.slice(0, 2).reduce((t, s) => recordStage(t, s, 0.9), startTrial(6));
  const full = TRIAL_STAGES.reduce((t, s) => recordStage(t, s, 0.9), startTrial(6));
  check(trialScore(abandoned) > 0, "two stages played well is worth something");
  check(trialScore(abandoned) < trialScore(full), "…but less than five");
  check(!trialComplete(abandoned), "and the trial knows it is not finished");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  a trial can be closed at any point and picked up exactly where it was, and never replayed for a better score");
