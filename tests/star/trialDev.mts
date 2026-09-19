import {
  startTrial, recordStage, trialComplete, trialScore, nextStage, noteReload,
  difficultyFor, RELOAD_GRACE, TRIAL_STAGES, type TrialProgress,
} from "../../lib/star/trial";
import {
  simStage, simRemaining, simScore, stageToSkip,
  TRIAL_SIM_LEVELS, TRIAL_SIM_QUALITY,
} from "../../lib/star/trialDev";
import { NO_INTEREST_BELOW } from "../../lib/star/scoutOffers";

/**
 * THE DEV SKIP/SIM TOOL.
 *
 * The tool exists so the screens AFTER the trial can be reached without
 * playing five stages, so what actually has to be true is that a simmed trial
 * is indistinguishable, downstream, from a played one: real results, written
 * through the real `recordStage`, with the real difficulty and the real
 * anti-cheat still applied. If any of that stopped being true the tool would
 * be testing itself rather than the game.
 *
 * The panel itself is a React component and cannot be run here — same standing
 * limitation every screen in this project has. What can be run is every number
 * it produces.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── A simmed trial is a REAL trial ──────────────────────────────────────
{
  const t = simRemaining(startTrial(4242), "average");
  check(trialComplete(t), "simming the whole trial fills every stage");
  for (const s of TRIAL_STAGES) {
    const r = t.results[s];
    check(!!r, `${s} has a result`);
    if (!r) continue;
    // The same three-fields-explain-each-other invariant a played stage has.
    check(r.score >= 0 && r.score <= 100, `${s} score is in range`);
    check(r.quality > 0 && r.quality <= 1, `${s} quality is in range`);
    check(r.difficulty >= 0 && r.difficulty <= 1, `${s} difficulty is in range`);
    check(typeof r.decidedAt === "number" && r.decidedAt > 0, `${s} is stamped`);
  }
  check(trialScore(t) === simScore(startTrial(4242), "average"),
    "simScore previews exactly what the button produces");
}

// ── The three levels are genuinely three different outcomes ─────────────
//
// Not three points on a line — the whole reason the toggle exists is to reach
// DIFFERENT downstream states cheaply, and the most interesting of those (the
// free-agent life, nobody signs you) is the one a "poor" sim has to actually
// reach. Measured over real seeds rather than asserted off the constants.
{
  const seeds = Array.from({ length: 200 }, (_, i) => i * 7919 + 11);
  const scoreAt = (level: (typeof TRIAL_SIM_LEVELS)[number]) =>
    seeds.map(s => simScore(startTrial(s), level));

  const poor = scoreAt("poor"), avg = scoreAt("average"), great = scoreAt("great");
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  check(mean(poor) < mean(avg) && mean(avg) < mean(great),
    "poor < average < great, on real seeds");
  check(poor.every(v => v < NO_INTEREST_BELOW),
    "a POOR sim always lands under the no-interest bar — the free-agent branch is reachable");
  check(avg.every(v => v > NO_INTEREST_BELOW + 15),
    "an AVERAGE sim always clears the bar comfortably");
  check(great.every(v => v >= 90),
    "a GREAT sim always lands up where the top of the ladder is in play");
}

// ── Obviously synthetic: five near-identical stage scores ───────────────
//
// The tool adds no jitter on purpose. The only spread a simmed trial has is
// the one `stageScore` itself puts there by pricing each stage against its own
// difficulty roll, which is a 0.95-1.00 multiplier — so five stages can never
// differ by more than a handful of points, which no real afternoon looks like.
{
  for (const level of TRIAL_SIM_LEVELS) {
    const t = simRemaining(startTrial(99), level);
    const scores = TRIAL_STAGES.map(s => t.results[s]!.score);
    const spread = Math.max(...scores) - Math.min(...scores);
    check(spread <= 6, `a ${level} sim's five stage scores sit within a few points of each other`);
  }
}

// ── Skipping one stage at a time gets to the same place ─────────────────
{
  let t: TrialProgress = startTrial(31337);
  let guard = 0;
  while (!trialComplete(t) && guard++ < 10) {
    const s = stageToSkip(t);
    check(s === nextStage(t), "stageToSkip is the stage the sequencer is on");
    t = simStage(t, s!, "great");
  }
  check(trialComplete(t), "skipping one stage at a time finishes the trial");
  check(trialScore(t) === simScore(startTrial(31337), "great"),
    "…and arrives at exactly the score simming the whole thing would have");
}

// ── It never overwrites something genuinely played ──────────────────────
{
  const played = recordStage(startTrial(7), "penalties", 1);
  const simmed = simRemaining(played, "poor");
  check(simmed.results.penalties!.score === played.results.penalties!.score,
    "a stage that was really played keeps its real score when the rest is simmed");
  check(simmed.results.penalties!.quality === played.results.penalties!.quality,
    "…quality and all");
  check(simmed.results.freeKicks!.score < played.results.penalties!.score,
    "…while the simmed stages around it carry the simmed level");
}

// ── The anti-cheat applies here exactly as it does to real play ─────────
//
// The rule this used to check was "a simmed trial still pays the reload
// haircut" — and the haircut is gone, deliberately: "don't give their score a
// penalty, just kind of troll them, just make it hard." So the rule it checks
// now is the one that replaced it, and it is the stricter of the two, because
// the dev tool is exactly where an accidental divergence would hide.
//
// A simmed stage is handed a flat quality and never plays a drill, so the
// difficulty side of the inverted penalty — the whole of what a resume now
// costs — cannot reach it at all. That is fine and it is not a cheat, for
// precisely the reason it would have BEEN one under the old design: the score
// no longer moves with the resume count for anybody, played or simmed. What
// must hold is that the tool has not quietly acquired a second scoring model
// on the way: a farmed trial and a clean one must sim to the SAME number, the
// same way two real players performing identically now score the same.
{
  let farmed = startTrial(55);
  for (let i = 0; i < 8; i++) farmed = noteReload({ ...farmed, inProgress: "penalties" });
  check(farmed.reloads > 0, "the test actually charged some resumes");
  check(simScore(farmed, "great") === simScore(startTrial(55), "great"),
    "a simmed trial's score is untouched by the resume count, exactly like a played one");

  // And the half that DOES still apply: the stages the farmer has left to
  // play are genuinely harder, whether or not he then reaches for the dev
  // tool. The tool skips the football; it does not un-charge the resumes.
  check(farmed.reloads > RELOAD_GRACE, "the test charged enough to get past the grace period");
  check(
    difficultyFor(farmed, "freeKicks") > difficultyFor(startTrial(55), "freeKicks"),
    "…and the trial it was reached from is still the harder afternoon",
  );
}

// ── The half-played five-a-side is dropped, same as a played one ────────
{
  const t = { ...startTrial(8), fiveASide: { pretend: "snapshot" } } as TrialProgress;
  const skippedOther = simStage(t, "penalties", "average");
  check(skippedOther.fiveASide !== undefined,
    "skipping another stage leaves a half-played five-a-side alone");
  const simmed = simRemaining(t, "average");
  check(simmed.fiveASide === undefined,
    "filling the five-a-side drops its stale snapshot rather than saving it forever");
}

// ── The levels are the levels ───────────────────────────────────────────
{
  check(TRIAL_SIM_LEVELS.length === 3, "three levels");
  check(TRIAL_SIM_QUALITY.poor < TRIAL_SIM_QUALITY.average
    && TRIAL_SIM_QUALITY.average < TRIAL_SIM_QUALITY.great, "…in order");
  check(TRIAL_SIM_LEVELS.every(l => TRIAL_SIM_QUALITY[l] > 0 && TRIAL_SIM_QUALITY[l] <= 1),
    "…all real qualities");
  check(stageToSkip(simRemaining(startTrial(1), "poor")) === null,
    "nothing left to skip once the trial is full");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  the dev sim writes real trial results, reaches three genuinely different outcomes, and cannot be used to beat the anti-cheat");
