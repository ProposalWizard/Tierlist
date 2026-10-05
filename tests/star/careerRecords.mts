import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { perClubTotals, allSeasons, historyRowFor } from "../../lib/star/careerRecords";
import { sortLeague } from "../../lib/star/season";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * YOUR OWN RECORDS (home-screen prototype, 27 Sep 2026): the Stats page's
 * "All seasons" and "Records" tabs are fed by creditMatchResult (bests) and
 * advanceSeason (one archive row per season). See lib/star/careerRecords.ts.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const player = (): StarPlayer => ({ firstName: "Test", lastName: "Player", age: 24, position: "ST", club: "Arsenal", nationality: "England" } as StarPlayer);
const base = () => makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
const stats = (over: Partial<MatchStats>): MatchStats => ({
  chances: 3, goals: 0, assists: 0, passes: 8, rating: 7.0, starMan: false,
  bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
  sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0, ...over,
});
const nextLeague = (c: CareerState): Fixture => c.fixtures.find((f) => (f.kind ?? "league") === "league" && !f.played)!;

// ── A 30 m goal sets furthestGoal ──
{
  const c0 = base();
  const f = nextLeague(c0);
  const { career } = creditMatchResult(c0, f, stats({
    goals: 1, homeScore: 1, awayScore: 0,
    goalEvents: [{ minute: 20, scorer: "Test Player", isUserGoal: true, distance: 30 }],
  }));
  check(career.careerBests?.furthestGoal?.metres === 30, `a 30 m goal sets furthestGoal (${career.careerBests?.furthestGoal?.metres})`);
  check(career.careerBests?.furthestGoal?.opponent === f.opponent, "and remembers who it was against");
  // A shorter one later does not replace it.
  const f2 = nextLeague(career);
  const { career: c2 } = creditMatchResult(career, f2, stats({
    goals: 1, goalEvents: [{ minute: 10, scorer: "Test Player", isUserGoal: true, distance: 12 }],
  }));
  check(c2.careerBests?.furthestGoal?.metres === 30, "a 12 m goal later leaves the 30 m record alone");
  // Your assist: the pass length when known.
  const f3 = nextLeague(c2);
  const { career: c3 } = creditMatchResult(c2, f3, stats({
    assists: 1, goalEvents: [{ minute: 55, scorer: "Mate", assist: "Test Player", isUserGoal: false, distance: 25, passLength: 41 }],
  }));
  check(c3.careerBests?.furthestAssist?.metres === 41, `your assist records the pass length (${c3.careerBests?.furthestAssist?.metres})`);
  // Replaying a match changes nothing.
  const { career: again } = creditMatchResult(c3, f3, stats({ goals: 1, goalEvents: [{ minute: 1, scorer: "Test Player", isUserGoal: true, distance: 60 }] }));
  check(again.careerBests?.furthestGoal?.metres === 30, "a replayed fixture never sets a record");
}

// ── A hat-trick sets mostGoalsMatch, and the season bests follow ──
{
  const c0 = base();
  const { career } = creditMatchResult(c0, nextLeague(c0), stats({ goals: 3, homeScore: 3, awayScore: 1 }));
  check(career.careerBests?.mostGoalsMatch?.goals === 3, `a hat-trick sets mostGoalsMatch (${career.careerBests?.mostGoalsMatch?.goals})`);
  const { career: c2 } = creditMatchResult(career, nextLeague(career), stats({ goals: 1, assists: 2 }));
  check(c2.careerBests?.mostGoalsMatch?.goals === 3, "a one-goal game later leaves it at 3");
  check(c2.careerBests?.mostGoalsSeason?.goals === 4, `most goals in a season climbs with the season (${c2.careerBests?.mostGoalsSeason?.goals})`);
  check(c2.careerBests?.mostAssistsSeason?.assists === 2, "most assists in a season too");
}

// ── advanceSeason pushes exactly one archive row ──
{
  let c = base();
  for (let i = 0; i < 3; i++) c = creditMatchResult(c, nextLeague(c), stats({ goals: 1, rating: 8 })).career;
  const before = c.seasonArchive?.length ?? 0;
  const { career: next } = advanceSeason(c, false);
  const rows = next.seasonArchive ?? [];
  check(rows.length === before + 1, `advanceSeason pushes one archive row (${before} → ${rows.length})`);
  const r = rows[rows.length - 1];
  check(r?.season === c.season && r.club === "Arsenal", "for the season just played, at the club it was played for");
  check(r?.apps === 3 && r.goals === 3 && r.avgRating === 8, `with its apps/goals/rating (${JSON.stringify(r)})`);
  check(next.seasonStats.appearances === 0, "and the new season starts empty");
  const clubs = perClubTotals(next);
  check(clubs.length === 1 && clubs[0].apps === 3 && clubs[0].seasons === 1, "per-club totals read the archive");
  check(allSeasons(next).length === 1, "an unplayed new season is not listed yet");
}

// ── advanceSeason writes one history row, every season, played or not ──
{
  let c = base();
  // Season 1: three games. Season 2: none at all.
  for (let i = 0; i < 3; i++) c = creditMatchResult(c, nextLeague(c), stats({ goals: 1, rating: 8 })).career;
  const s1 = c;
  c = advanceSeason(c, false).career;
  const s2 = c;
  c = advanceSeason(c, false).career;
  const rows = c.seasonHistory ?? [];
  check(rows.length === 2, `two rollovers write two history rows, even with no games in one (${rows.length})`);
  const [r1, r2] = rows;
  check(r1?.season === 1 && r2?.season === 2, `one per season, in order (${rows.map(r => r.season)})`);
  check(r1?.club === "Arsenal" && r1.division === "premier", `with the club and division (${r1?.club}, ${r1?.division})`);
  const pos = sortLeague(s1.league).findIndex(t => t.name === "Arsenal") + 1;
  check(r1?.position === pos && r1.teams === s1.league.length, `and where the club finished (${r1?.position}/${r1?.teams}, table says ${pos})`);
  check(r1?.winners.league === sortLeague(s1.league)[0].name, `the league winner is the top of that table (${r1?.winners.league})`);
  check(!!r1?.winners.faCup && !!r1.winners.leagueCup, `both cups have a winner (${r1?.winners.faCup}, ${r1?.winners.leagueCup})`);
  check(!!r1?.winners.championsLeague && !!r1.winners.europaLeague, "in the Premier League, Europe's winners are kept");
  check(!!r1?.ballonDor?.winner && typeof r1.ballonDor.yourRank === "number", `the Ballon d'Or winner and your place (${JSON.stringify(r1?.ballonDor)})`);
  check(r1?.age === s1.player.age && r2?.age === s2.player.age, `your age that season (${r1?.age}, ${r2?.age})`);
  check(r1?.fame === s1.fame && r1.money === s1.money && r1.overall === s1.starRating, "and where you stood when it ended");
  // The archive (your own numbers) still only lists the season you played in.
  check((c.seasonArchive ?? []).length === 1, `the stats archive is unchanged: played seasons only (${c.seasonArchive?.length})`);
  // Rolling the same season twice keeps one row (a replayed rollover).
  const again = advanceSeason({ ...s2, seasonHistory: c.seasonHistory }, false).career;
  check((again.seasonHistory ?? []).filter(r => r.season === 2).length === 1, "a season rolled twice still has one row");
}

// ── Outside the top flight, Europe's winners are not recorded ──
{
  const c = base();
  const row = historyRowFor({ ...c, division: "championship", euroState: undefined }, {
    division: "championship", position: 5, teams: 24, move: null,
    winners: { league: "Leeds United", faCup: "Arsenal", leagueCup: "Chelsea", championsLeague: "Leeds United", europaLeague: "Hull City" },
  });
  check(!row.winners.championsLeague && !row.winners.europaLeague, `a Championship season keeps no Champions/Europa League winner (${JSON.stringify(row.winners)})`);
  check(row.winners.league === "Leeds United" && row.winners.faCup === "Arsenal", "but keeps its own league and the cups");
}

if (problems.length) { console.error("careerRecords FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("careerRecords: all checks passed");
