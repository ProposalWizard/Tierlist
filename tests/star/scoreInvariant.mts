import { newMatch, advanceTo, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";

/**
 * THE SCOREBOARD MUST MATCH THE COMMENTARY.
 *
 * Reported directly: a live match's scoreline read one goal ahead of how
 * many goals the commentary — and the post-match results page, which reads
 * off the exact same event list — actually showed. Root cause was a double
 * increment: `advanceTo`'s handed-over-chance branch bumped `userScore`
 * itself AND THEN called `resolveScenario`, which also bumps it for a
 * "goal" result. One event pushed, two points added to the board.
 *
 * This plays many seasons' worth of `advanceTo` runs (the code path only
 * reachable while the player is off the pitch — subbed, or not yet on —
 * which is exactly where the bug lived) and checks the one invariant that
 * must always hold: every point on the board has exactly one event behind
 * it. `advanceTo` is deterministic in the events it returns for a given
 * state, so this reproduces the double-count directly rather than
 * approximating it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INPUTS: HiddenMatchInputs = {
  teamStrength: 68, oppStrength: 62, energy: 80, playerSkill: 65, pace: 70, home: true,
};

let userGoalEventsTotal = 0, oppGoalEventsTotal = 0, matchesWithAUserGoal = 0;

for (let seed = 1; seed <= 400; seed++) {
  const rng = mulberry32(seed * 7919 + 13);
  const state = newMatch(rng);
  const events = advanceTo(state, INPUTS, rng, 90);

  const userGoalEvents = events.filter(e => e.isGoal && e.teammateGoal).length;
  const oppGoalEvents = events.filter(e => e.isGoal && !e.teammateGoal).length;

  check(state.userScore === userGoalEvents,
    `seed ${seed}: scoreboard says ${state.userScore} for the user's side, but only ${userGoalEvents} goal event(s) were emitted — this is exactly the reported bug`);
  check(state.oppScore === oppGoalEvents,
    `seed ${seed}: scoreboard says ${state.oppScore} for the opponent, but ${oppGoalEvents} goal event(s) were emitted`);

  userGoalEventsTotal += userGoalEvents;
  oppGoalEventsTotal += oppGoalEvents;
  if (userGoalEvents > 0) matchesWithAUserGoal++;
}

check(matchesWithAUserGoal > 50, `plenty of these 400 matches actually produced a user-side goal to check (${matchesWithAUserGoal})`);
check(userGoalEventsTotal > 0 && oppGoalEventsTotal > 0, "both sides scored across the sample, so this isn't accidentally checking an empty case");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 20)) console.log(`  ✗ ${p}`);
  if (problems.length > 20) console.log(`  ...and ${problems.length - 20} more`);
  process.exit(1);
}
console.log(`PASS — the scoreboard exactly matches the goal-event count in every one of 400 matches (${userGoalEventsTotal} user goals, ${oppGoalEventsTotal} opponent goals checked)`);
