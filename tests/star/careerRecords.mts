import { makeInitialCareer, creditMatchResult, advanceSeason, closeFinalSeason } from "../../lib/star/careerFlow";
import { acceptOffer, type TransferOffer } from "../../lib/star/transfers";
import { PREMIER_LEAGUE_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS, STEP3_NORTH_CLUBS } from "../../lib/star/clubs";
import { perClubTotals, allSeasons, historyRowFor, bestMatesOf } from "../../lib/star/careerRecords";
import { slimCareer } from "../../lib/star/hallOfFame";
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

// ── A move made at the season's end: the row is about the club you LEFT ──
// Playtest, 5 Oct 2026: Scarborough won the play-off final, the player signed
// for Peterborough that summer, and the season's row said neither up nor
// down, with Peterborough's wage and signing fee in it.
{
  // Puts `last` bottom of the table and everyone else above it, in order.
  const bottom = (c: CareerState, last: string): CareerState => {
    const others = c.league.map(t => t.name).filter(n => n !== last);
    return {
      ...c,
      league: c.league.map((t) => {
        const at = t.name === last ? c.league.length - 1 : others.indexOf(t.name);
        const points = (c.league.length - at) * 3;
        return { ...t, played: 38, won: points / 3, drawn: 0, lost: 0, goalsFor: points, goalsAgainst: 0, points };
      }),
    };
  };
  const offerFrom = (club: string, wage: number, division: TransferOffer["division"]): TransferOffer => ({
    club, strength: 70, wage, goalBonus: 0, assistBonus: 0, seasons: 3,
    signingFee: 777, clauses: {}, position: 1, pitch: "", division,
  });

  // Arsenal go down; you sign for Chelsea that summer.
  const c0 = bottom(base(), "Arsenal");
  const moved = acceptOffer(c0, offerFrom("Chelsea", c0.contract.wage + 90, "premier"));
  check(moved.transfers?.at(-1)?.fromWage === c0.contract.wage, "a move remembers the wage at the club left");
  const r = (advanceSeason(moved, false, true).career.seasonHistory ?? []).find(x => x.season === c0.season);
  check(r?.club === "Arsenal", `the row names the club the season was played for (${r?.club})`);
  check(r?.move === "relegated", `and that club's own result: Arsenal went down (${r?.move})`);
  check(r?.wage === c0.contract.wage, `with Arsenal's wage, not the new one (${r?.wage} vs ${c0.contract.wage})`);
  check(r?.money === c0.money, `and the money before the signing fee (${r?.money} vs ${c0.money})`);

  // Bottom of National League North: the club drops to Step 3 (no division
  // at all), and you are made to move. Still "down".
  const north = [...NATIONAL_LEAGUE_NORTH_CLUBS];
  const you = north[10];
  const n0 = bottom(makeInitialCareer({ ...player(), age: 16, club: you } as StarPlayer, north, "national_league_north"), you);
  const forced = acceptOffer(n0, offerFrom(north[3], n0.contract.wage, "national_league_north"));
  const nextN = advanceSeason(forced, false, true).career;
  const rn = (nextN.seasonHistory ?? []).find(x => x.season === n0.season);
  check(rn?.club === you && rn.move === "relegated", `a club sent down to Step 3 reads as down (${rn?.club}, ${rn?.move})`);
  check(STEP3_NORTH_CLUBS.length === 4, "Step 3 North still has its four waiting clubs");

  // Retiring after the last season keeps that season's up or down too.
  const last = closeFinalSeason(bottom(base(), "Arsenal"), false);
  const rl = (last.seasonHistory ?? []).find(x => x.season === c0.season);
  check(rl?.move === "relegated", `retiring keeps the last season's own result (${rl?.move})`);
  const stay = closeFinalSeason(base(), false);
  const rs = (stay.seasonHistory ?? []).find(x => x.season === c0.season);
  check(rs?.club === "Arsenal" && rs.move !== undefined, `and a mid-table last season still gets its row (${rs?.club}, ${rs?.move})`);
}

// ── Step 0 of the farewell match: each season keeps its best team-mates ──
// Leo, 6 Oct 2026: "Start one tiny thing now (step 0) so it has real
// team-mates when it is built."
{
  const c0 = base();
  // Give the squad a season: a top scorer and a top creator.
  const squad = c0.squad.map((p, i) => ({ ...p, seasonGoals: i === 9 ? 21 : i % 3, seasonAssists: i === 6 ? 14 : i % 2 }));
  const c = { ...c0, squad };
  const top = squad[9], creator = squad[6];
  const mates = bestMatesOf(squad);
  check(mates.length === 5, `five team-mates kept a season (${mates.length})`);
  check(mates[0].name === top.name && mates[0].goals === 21, `the top scorer first (${mates[0].name})`);
  check(mates.some(m => m.name === creator.name && m.assists === 14), "the top creator too");
  check(mates.some(m => m.position === "GK"), "and a keeper, so a whole side can be drawn later");
  check(new Set(mates.map(m => m.name)).size === mates.length, "nobody twice");
  check(bestMatesOf([]).length === 0 && bestMatesOf(undefined).length === 0, "no squad, no team-mates (and no crash)");

  const row = (advanceSeason(c, false).career.seasonHistory ?? []).find(x => x.season === c.season);
  check((row?.mates?.length ?? 0) === 5 && row!.mates![0].name === top.name, `the season's row keeps them (${row?.mates?.length})`);

  // A move made at the rollover: the row's team-mates are the club LEFT.
  const offer: TransferOffer = { club: "Chelsea", strength: 70, wage: c.contract.wage + 50, goalBonus: 0, assistBonus: 0, seasons: 3, signingFee: 1, clauses: {}, position: 1, pitch: "", division: "premier" };
  const moved = acceptOffer(c, offer);
  check(moved.squad[0]?.name !== squad[0]?.name || moved.squad.length !== squad.length || moved.player.club === "Chelsea", "the move swaps the squad before the rollover");
  const movedRow = (advanceSeason(moved, false, true).career.seasonHistory ?? []).find(x => x.season === c.season);
  const oldNames = new Set(squad.map(p => p.name));
  check(!!movedRow?.mates?.length && movedRow.mates.every(m => oldNames.has(m.name)), `after a summer move the row still holds the old club's team-mates (${movedRow?.mates?.map(m => m.name).join(", ")})`);
  check(movedRow?.mates?.[0]?.name === top.name, "with the old club's top scorer first");
  check(advanceSeason(moved, false, true).career.outgoingMates === undefined, "the stash is cleared once the row is written");

  // Retiring after the last season writes them too.
  const last = closeFinalSeason(c, false);
  const lastRow = (last.seasonHistory ?? []).find(x => x.season === c.season);
  check((lastRow?.mates?.length ?? 0) === 5, `the last season's row has its team-mates (${lastRow?.mates?.length})`);
  // The Hall's slim copy drops them (about 15 KB over 20 seasons).
  const slim = slimCareer(last);
  check((slim.seasonHistory ?? []).every(r => !r.mates), "the Hall of Fame copy leaves the team-mates out");
}

if (problems.length) { console.error("careerRecords FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("careerRecords: all checks passed");
