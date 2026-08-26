import { skipTo, weekClosestToDate, weeksBeforeSeasonEnd, seasonEndWeek, deadlineDayWeek } from "../../lib/star/devSkip";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import { matchweeksFor } from "../../lib/star/calendar";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, StarPlayer } from "../../lib/star/types";

/**
 * A REAL SEASON, WITHOUT PLAYING ONE.
 *
 * Requested directly: three months into a save takes three months of real
 * matches to reach, which makes anything past the opening weeks nearly
 * untestable. skipTo() is a headless fast-forward — every fixture between
 * "now" and the target simulated the same way the game already simulates a
 * match you were left out of (simulateMissedFixture), transfer windows
 * included. These tests are about the SKIP MACHINERY landing where it says
 * it will and leaving a coherent save behind, not about football outcomes.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 20, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function squadFor(club: string): LeagueSquad {
  return {
    club,
    players: generateSquad(clubNameSeed(club)).map((p, i): LeaguePlayer => ({
      id: `${club}:${i}`, name: `${p.name} (${club})`, position: p.position,
      positions: p.positions ?? [p.position],
      overall: 62 + (clubNameSeed(p.name) % 20), goals: 0, assists: 0,
    })),
  };
}

function freshCareer(): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, leagueSquads: PREMIER_LEAGUE_CLUBS.map(squadFor) };
}

// ── Land exactly on the target week, with it still unplayed ────────────────
{
  const career = freshCareer();
  const target = { season: 1, week: 20 };
  const { career: after, weeksSimulated, reachedEnd } = skipTo(career, target);

  check(after.season === 1, `stays in season 1 (got ${after.season})`);
  check(!reachedEnd, "a normal in-season target is not \"reached end\"");
  check(weeksSimulated > 0, "actually simulated something to get there");

  const next = nextFixtureFor(after);
  check(!!next && next.week === 20, `next fixture is week 20's, untouched (got week ${next?.week})`);

  const playedPastTarget = after.fixtures.some(f => f.played && f.week >= 20);
  check(!playedPastTarget, "nothing at or after the target week was simulated");
  const everyEarlierWeekPlayed = after.fixtures
    .filter(f => f.week < 20 && (f.kind ?? "league") === "league")
    .every(f => f.played);
  check(everyEarlierWeekPlayed, "every league week before the target was actually played out");
}

// ── A season boundary along the way ─────────────────────────────────────────
{
  const career = freshCareer();
  const target = { season: 2, week: 5 };
  const { career: after, reachedEnd } = skipTo(career, target);

  check(after.season === 2, `rolled all the way into season 2 (got season ${after.season})`);
  check(!reachedEnd, "reaching into next season is not \"reached end\"");
  check(!after.retired, "a fresh 20-year-old is never retired by a one-season skip");
  check(after.contract.seasonsRemaining > 0, "an expiring contract is auto-renewed, never left dangling at 0");
  check(after.fixtures.length > 0, "season 2 has a real fixture list, not an empty one carried over");

  const next = nextFixtureFor(after);
  check(!!next && next.week === 5, `landed with week 5 of season 2 still unplayed (got week ${next?.week})`);
}

// ── Transfer windows actually open along the way ────────────────────────────
{
  const career = freshCareer();
  // Deep enough into the season that both the (deliberately-skipped) opening
  // window and the January window have had their moment.
  const { career: after } = skipTo(career, { season: 1, week: 25 });
  check(after.lastTransferWindowKey === "1-january",
    `the January window ran on schedule during the skip (got "${after.lastTransferWindowKey}")`);
}

// ── Already retired: a no-op, not an error ──────────────────────────────────
{
  const career = { ...freshCareer(), retired: true };
  const { career: after, weeksSimulated, reachedEnd } = skipTo(career, { season: 5, week: 1 });
  check(after === career, "a retired career comes back completely untouched");
  check(weeksSimulated === 0, "…having simulated nothing");
  check(reachedEnd, "…and reporting that there was nowhere further to go");
}

// ── Multi-season skips terminate well inside the safety valve ──────────────
{
  const career = freshCareer();
  const { reachedEnd, weeksSimulated } = skipTo(career, { season: 4, week: 1 });
  check(!reachedEnd, "three full seasons ahead is a completely reachable target");
  check(weeksSimulated < 300, `finished in a sane number of fixtures, not by tripping the safety valve (${weeksSimulated})`);
}

// ── Date/week helpers agree with the real calendar ──────────────────────────
{
  const career = freshCareer();
  const weeks = matchweeksFor(career.division ?? "premier");

  const xmas = weekClosestToDate(career, 11, 25);
  check(xmas >= 1 && xmas <= weeks, `Christmas falls inside the league season (got week ${xmas})`);

  const twoOut = weeksBeforeSeasonEnd(career, 2);
  check(twoOut === weeks - 2, `two weeks before the end is literally weeks-2 (got ${twoOut}, weeks=${weeks})`);

  const end = seasonEndWeek(career);
  check(end > weeks, `the season's actual end (cup finals) sits past the last league week (${end} vs ${weeks})`);

  const summerDeadline = deadlineDayWeek(career, "summer");
  const janDeadline = deadlineDayWeek(career, "january");
  check(summerDeadline < janDeadline, `31 August comes before 31 January on the same season's calendar (${summerDeadline} vs ${janDeadline})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("PASS — the dev skip tool lands exactly on target, rolls seasons over cleanly, and its date helpers agree with the real calendar");
