import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, mediaOf } from "../../lib/star/media/feed";
import { buildRoster } from "../../lib/star/media/accounts";
import { leagueNameFor, type CareerDivision } from "../../lib/star/calendar";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS,
} from "../../lib/star/clubs";
import type { CareerState, Fixture, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THE LEAGUE ACCOUNT IS YOUR DIVISION'S (11 Oct 2026).
 *
 * Seen in a playtest (7 Oct 2026): a National League South career's feed had
 * "The League ✓ @PremierLeague … HIGHLIGHTS | Southport 4-1 Brackley Town".
 * The roster always built one league account, @PremierLeague, and a league
 * fixture's competition defaulted to "Premier League" for every division.
 * Now the league account is named after the division you play in, and a
 * match's competition is that division.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function careerIn(division: CareerDivision, clubs: readonly string[], seed: number): CareerState {
  const player: StarPlayer = {
    firstName: "Michael", lastName: "Sancho", age: 18, skinTone: "light",
    club: clubs[seed % clubs.length], clubBadge: null, position: "ST",
    nationality: "England", startYear: 2026,
  } as StarPlayer;
  return makeInitialCareer(player, [...clubs], division);
}

function playOne(career: CareerState, seed: number): CareerState | null {
  const fixture: Fixture | undefined = career.fixtures.find(f => !f.played && f.week === career.week)
    ?? career.fixtures.find(f => !f.played);
  if (!fixture) return null;
  const name = `${career.player.firstName} ${career.player.lastName}`;
  const events: GoalEvent[] = [
    { minute: 22, scorer: name, isUserGoal: true, how: "one_on_one", distance: 10 },
    { minute: 70 + (seed % 15), scorer: name, isUserGoal: true, how: "cutback", distance: 8 },
  ];
  const stats: MatchStats = {
    chances: 5, goals: 2, assists: 0, passes: 30, rating: 8.1, starMan: true,
    bossChange: 1, teamChange: 1, fansChange: 2, wage: 1, goalBonus: 1, sponsorPay: 0,
    totalCash: 3, homeScore: fixture.home ? 2 : 1, awayScore: fixture.home ? 1 : 2, goalEvents: events, minutes: 90,
  };
  const { career: after } = creditMatchResult(career, fixture, stats);
  after.media = generateForMatch(career, after, fixture, stats);
  const rest = (after.results ?? []).filter(r => r.week === fixture.week && r.home !== after.player.club && r.away !== after.player.club);
  if (rest.length) after.media = generateForLeagueWeek(after, rest);
  return after;
}

const CASES: [CareerDivision, readonly string[]][] = [
  ["premier", PREMIER_LEAGUE_CLUBS],
  ["championship", CHAMPIONSHIP_CLUBS],
  ["league_two", LEAGUE_TWO_CLUBS],
  ["national_league_south", NATIONAL_LEAGUE_SOUTH_CLUBS],
];

let wrong = 0, leaguePosts = 0, highlights = 0;
for (const [division, clubs] of CASES) {
  const want = leagueNameFor(division);
  const roster = buildRoster(careerIn(division, clubs, 1));
  const leagueAccs = roster.filter(a => a.archetype === "league");
  check(leagueAccs.length === 1, `${division}: one league account (${leagueAccs.length})`);
  check(leagueAccs[0]?.name === want, `${division}: the league account is "${want}" (got "${leagueAccs[0]?.name}")`);
  const pl = division === "premier";
  check(pl === roster.some(a => a.handle === "@PremierLeague"), `${division}: @PremierLeague ${pl ? "is" : "is not"} on the roster`);

  for (let seed = 1; seed <= 3; seed++) {
    let c: CareerState | null = careerIn(division, clubs, seed);
    for (let w = 0; w < 8 && c; w++) c = playOne(c, seed * 100 + w);
    if (!c) continue;
    for (const p of mediaOf(c).posts) {
      if (p.author.archetype !== "league") continue;
      leaguePosts++;
      if (p.text.startsWith("HIGHLIGHTS")) highlights++;
      if (p.author.name !== want || (!pl && p.author.handle === "@PremierLeague")) {
        wrong++;
        if (wrong <= 3) problems.push(`${division}: "${p.author.name}" ${p.author.handle} posted "${p.text.slice(0, 70)}"`);
      }
    }
  }
}
console.log(`League-account posts: ${leaguePosts} (${highlights} highlights), wrong division: ${wrong}`);
check(leaguePosts > 20, `the league accounts actually post (${leaguePosts})`);
check(highlights > 0, `league accounts post match highlights (${highlights})`);
check(wrong === 0, `${wrong} league-account posts named the wrong division`);

if (problems.length) {
  console.error("leagueAccount FAILED:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("leagueAccount: all checks passed");
