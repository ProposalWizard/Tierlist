import { makeInitialCareer, creditMatchResult, resolveSeasonWinners } from "../../lib/star/careerFlow";
import { nextFixtureFor, advanceEliminatedCups } from "../../lib/star/competitions";
import { stillIn, currentRound } from "../../lib/star/cups";
import { fixtureTimestamp, divisionOf } from "../../lib/star/calendar";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState } from "../../lib/star/types";

/**
 * A REAL BUG, REPORTED DIRECTLY: knocked out of the FA Cup in the Round of
 * 64 in season 1, then checked the FA Cup screen and it already showed a
 * full winner — the entire rest of the competition, every remaining round,
 * had been simulated instantly the moment the player was eliminated.
 *
 * The fix: once you're out, the cup keeps resolving one real round at a
 * time, on its own real calendar weeks, exactly like it would if you were
 * still in it — never all at once, instantly, on elimination. See
 * competitions.ts's settleCupTie (the elimination branch no longer calls
 * finishCupToWinner) and advanceEliminatedCups (the new per-fixture
 * mechanism that replaces it), both wired into careerFlow.ts's
 * creditMatchResult and simulateMissedFixture.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United",
  "Burnley", "Sunderland",
];

function player() {
  return {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST", skinTone: "light",
    club: "Liverpool", nationality: "England", startYear: 2027,
  } as never;
}

function statsFor(scored: number, conceded: number) {
  return {
    homeScore: scored, awayScore: conceded, chances: 2, goals: 0, assists: 0, passes: 10,
    rating: 6.5, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
  } as never;
}

/** Play whatever league/other fixtures come next until the given
 *  competition's tie for the player comes round, then hand in the result. */
function playUntilTieAndLose(c: CareerState, competition: string): CareerState {
  let guard = 0;
  while (guard++ < 60) {
    const fx = nextFixtureFor(c)!;
    if (fx.competition === competition) {
      return creditMatchResult(c, fx, statsFor(fx.home ? 0 : 3, fx.home ? 3 : 0)).career;
    }
    c = creditMatchResult(c, fx, statsFor(1, 1)).career;
  }
  throw new Error(`never reached a ${competition} tie`);
}

// ── Elimination does not finish the competition ─────────────────────────────
{
  let c: CareerState = makeInitialCareer(player(), CLUBS);
  c = playUntilTieAndLose(c, "FA Cup");

  const st = c.cupState!.find(s => s.competition === "FA Cup")!;
  check(!stillIn(st, "Liverpool"), "Liverpool is genuinely out of the FA Cup");
  check(!st.winner, "…but the FA Cup does NOT already have a winner the instant you're eliminated");
  check(st.rounds.length === 2, `the next round is drawn but not yet played (${st.rounds.length} rounds so far)`);
  check(!!currentRound(st) && currentRound(st)!.ties.some(t => t.hs === undefined),
    "the open round has real, unplayed ties in it");
}

// ── The League Cup behaves the same way, independently ──────────────────────
{
  let c: CareerState = makeInitialCareer(player(), CLUBS);
  c = playUntilTieAndLose(c, "League Cup");

  const faSt = c.cupState!.find(s => s.competition === "FA Cup")!;
  const lcSt = c.cupState!.find(s => s.competition === "League Cup")!;
  check(!lcSt.winner, "the League Cup does not instantly finish either");
  check(stillIn(faSt, "Liverpool") || faSt.rounds.length <= 1,
    "the FA Cup is untouched by the League Cup elimination — a still-separate competition");
}

// ── Round-by-round: nothing advances before its own real calendar week ──────
{
  let c: CareerState = makeInitialCareer(player(), CLUBS);
  c = playUntilTieAndLose(c, "FA Cup");
  const afterElimination = c.cupState!.find(s => s.competition === "FA Cup")!;
  const roundsRightAfter = afterElimination.rounds.length;

  // Advance the clock to a timestamp BEFORE the next round's real week —
  // nothing should move.
  const division = divisionOf(c);
  const earlyClock = fixtureTimestamp(c.player.startYear, c.season, 1, "cup", division);
  const untouched = advanceEliminatedCups(c, earlyClock, mulberry32(1));
  const untouchedSt = untouched.find(s => s.competition === "FA Cup")!;
  check(untouchedSt.rounds.length === roundsRightAfter && !untouchedSt.winner,
    "a timestamp before the next round's real week advances nothing");

  // Advance the clock all the way to the end of the season — the whole rest
  // of the competition should now have played out, one round validly built
  // on the last, to a real winner.
  const lateClock = fixtureTimestamp(c.player.startYear, c.season, 60, "cup", division);
  const finished = advanceEliminatedCups(c, lateClock, mulberry32(2));
  const finishedSt = finished.find(s => s.competition === "FA Cup")!;
  check(!!finishedSt.winner, "given enough real time, the competition genuinely reaches a winner");
  check(finishedSt.rounds.length === 6, `all six FA Cup rounds are there (${finishedSt.rounds.length})`);
  check(finishedSt.rounds.every(r => r.ties.every(t => t.hs !== undefined)),
    "every tie in every round is actually played, not skipped");
}

// ── Playing on through real fixtures genuinely advances the cup one round
// at a time, matching the real calendar rather than jumping straight to a
// winner ─────────────────────────────────────────────────────────────────
{
  let c: CareerState = makeInitialCareer(player(), CLUBS);
  c = playUntilTieAndLose(c, "FA Cup");
  let st = c.cupState!.find(s => s.competition === "FA Cup")!;
  check(!st.winner, "still no winner right after elimination");

  const roundCounts: number[] = [st.rounds.length];
  // Play every one of the player's own remaining fixtures this season one at
  // a time and watch the FA Cup progress. The Final's own real week can
  // genuinely fall AFTER the player's own last scheduled fixture (nothing
  // left in `career.fixtures` to trigger it via advanceEliminatedCups) — see
  // the season-end backstop check below for how that last stretch is
  // guaranteed to resolve. What matters here is that it never jumps straight
  // from "just eliminated" to a full winner on the very next fixture played.
  for (let i = 0; i < 60; i++) {
    const fx = nextFixtureFor(c);
    if (!fx) break;
    c = creditMatchResult(c, fx, statsFor(1, 1)).career;
    st = c.cupState!.find(s => s.competition === "FA Cup")!;
    roundCounts.push(st.rounds.length);
    if (st.winner) break;
  }
  check(st.rounds.length === 6, `by the end of the season's fixtures, the FA Cup has reached its Final round (${st.rounds.length})`);
  // The round count should climb gradually (1 -> 6), never skip straight
  // from its post-elimination value to the final round count in one fixture.
  const distinctCounts = new Set(roundCounts);
  check(distinctCounts.size > 2,
    `the competition passed through several distinct round counts on the way to a winner, not one instant jump (${roundCounts.join(",")})`);
  check(roundCounts[0] === 2 && roundCounts[1] === 2,
    "the very next fixture played right after elimination does not itself finish the competition");
}

// ── The season-end backstop still guarantees a real winner ──────────────────
{
  let c: CareerState = makeInitialCareer(player(), CLUBS);
  c = playUntilTieAndLose(c, "FA Cup");
  // Never let the per-fixture mechanism finish the cup naturally — jump
  // straight to resolveSeasonWinners (the same function advanceSeason's
  // rollover calls) instead of playing on.
  const winners = resolveSeasonWinners(c);
  check(!!winners.faCup, "resolveSeasonWinners always produces a real FA Cup winner, even mid-competition");
  check(!!winners.leagueCup, "…and a real League Cup winner too");
}

// ── A cup you are still in is left alone by advanceEliminatedCups ───────────
{
  let c: CareerState = makeInitialCareer(player(), CLUBS);
  const before = JSON.stringify(c.cupState);
  const clock = fixtureTimestamp(c.player.startYear, c.season, 60, "cup", divisionOf(c));
  const after = advanceEliminatedCups(c, clock, mulberry32(3));
  check(JSON.stringify(after) === before,
    "a cup the player is still in is never touched by advanceEliminatedCups — settleCupTie owns it");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — elimination from a domestic cup no longer instantly resolves the rest of the competition; it progresses one real round at a time, and the season-end backstop still guarantees a real winner");
