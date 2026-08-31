import { RECORDS, recordBeaten, updatePersonalBests } from "../../lib/star/records";
import { creditMatchResult, makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * RECORDS.
 *
 * The Achievements tab's new second tab — real Premier League records,
 * checked against your own best season/match/career. The arithmetic under
 * test: the running `careerLeagueStats` total only moves for league matches
 * and never double-counts a replay, `updatePersonalBests` never lets a worse
 * later season erase a better earlier one, and a Championship season
 * contributes nothing toward a Premier League record.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function baseCareer(): CareerState {
  return makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
}

function stats(over: Partial<MatchStats>): MatchStats {
  return {
    chances: 1, goals: 0, assists: 0, passes: 5, rating: 70, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0,
    sponsorPay: 0, totalCash: 0, homeScore: 1, awayScore: 0,
    ...over,
  };
}

function fixture(over: Partial<Fixture>): Fixture {
  return { week: 1, opponent: "Chelsea", home: true, played: false, kind: "league", ...over };
}

// ── A goal contest, not the achievements ────────────────────────────────────
{
  const goalsRecord = RECORDS.find(r => r.id === "pl-goals-career")!;
  check(!recordBeaten(baseCareer(), goalsRecord), "a fresh career has not beaten the all-time PL scoring record");
}

// ── Only league matches count toward the career-long tally ─────────────────
{
  let c = baseCareer();
  c = creditMatchResult(c, fixture({ week: 1, kind: "league" }), stats({ goals: 2, assists: 1 })).career;
  c = creditMatchResult(c, fixture({ week: 2, kind: "cup", competition: "FA Cup" }), stats({ goals: 5, assists: 5 })).career;
  check(c.careerLeagueStats?.goals === 2, `cup goals are not league goals (${c.careerLeagueStats?.goals})`);
  check(c.careerLeagueStats?.assists === 1, `cup assists are not league assists (${c.careerLeagueStats?.assists})`);
  check(c.careerLeagueStats?.appearances === 1, `only the league match counts as an appearance (${c.careerLeagueStats?.appearances})`);
}

// ── A replay does not double the career tally ───────────────────────────────
//
// alreadyPlayed is read off the CAREER's own fixture list, not off whatever
// the caller happens to pass — so the fixture credited here has to be a real
// one out of the generated calendar, the same way the app always calls this.
{
  let c = baseCareer();
  const f = c.fixtures.find(x => (x.kind ?? "league") === "league")!;
  c = creditMatchResult(c, f, stats({ goals: 3, assists: 1 })).career;
  const replayed = c.fixtures.find(x => x.week === f.week && (x.kind ?? "league") === "league")!;
  c = creditMatchResult(c, replayed, stats({ goals: 3, assists: 1 })).career;
  check(c.careerLeagueStats?.goals === 3, `a re-credited match does not double the total (${c.careerLeagueStats?.goals})`);
  check(c.careerLeagueStats?.appearances === 1, `…or the appearance count (${c.careerLeagueStats?.appearances})`);
}

// ── A season's best is remembered even after it resets ─────────────────────
{
  let c = baseCareer();
  c = { ...c, leagueSeasonStats: { goals: 10, assists: 18 } };
  const afterGoodSeason = updatePersonalBests(c);
  check(afterGoodSeason["pl-assists-season"] === 18, `a strong season is locked in (${afterGoodSeason["pl-assists-season"]})`);

  // The next season starts cold — leagueSeasonStats resets — and is worse.
  c = { ...c, personalBests: afterGoodSeason, leagueSeasonStats: { goals: 2, assists: 3 } };
  const afterQuietSeason = updatePersonalBests(c);
  check(afterQuietSeason["pl-assists-season"] === 18, `a quiet follow-up season does not erase the earlier best (${afterQuietSeason["pl-assists-season"]})`);
}

// ── A Championship season does not count toward a Premier League record ────
{
  let c = baseCareer();
  c = { ...c, division: "championship", leagueSeasonStats: { goals: 40, assists: 30 } };
  const best = updatePersonalBests(c);
  check(best["pl-goals-season"] === undefined, `a Championship season leaves the PL record untouched (${best["pl-goals-season"]})`);
}

// ── The record is actually reachable, and the bar is where it says it is ───
{
  const assistsRecord = RECORDS.find(r => r.id === "pl-assists-season")!;
  let c = baseCareer();
  c = { ...c, leagueSeasonStats: { goals: 0, assists: assistsRecord.value } };
  check(recordBeaten(c, assistsRecord), "matching the real total counts as beating the record");
  c = { ...c, leagueSeasonStats: { goals: 0, assists: assistsRecord.value - 1 } };
  check(!recordBeaten(c, assistsRecord), "one short of the real total is not beating it yet");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the Records tab measures the right numbers, against the right seasons");
