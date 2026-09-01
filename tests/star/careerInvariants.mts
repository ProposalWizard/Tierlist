import { makeInitialCareer, creditMatchResult, advanceSeason, simulateMissedFixture } from "../../lib/star/careerFlow";
import { generateSquad, clubNameSeed } from "../../lib/star/squadData";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueSquad, LeaguePlayer, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THINGS THAT MUST BE TRUE OF EVERY CAREER, ALWAYS.
 *
 * The other suites each test one system in isolation with a hand-built
 * fixture. This one plays real careers end to end — every week of every
 * season, through transfer windows, cups, promotion and relegation — and
 * asserts the handful of things that are never allowed to be false no
 * matter which systems interacted to get there.
 *
 * That combination is the point. Nearly every bug this game has actually
 * shipped lived in the seam BETWEEN two systems that were each individually
 * correct: a transfer window rebuilding a squad and dropping a field the
 * chart read; crediting running twice on a replayed week; a rollover
 * resetting one tally and not its twin. None of those are visible from
 * inside a single-system test, and all of them are visible here.
 *
 * Deliberately checks INVARIANTS rather than exact numbers — this is a
 * generative simulation, so "the table is internally consistent" and
 * "nobody is at two clubs" hold for every seed, where "Arsenal finished
 * fourth" would only hold for one.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok && !problems.includes(what)) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 17, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function leagueSquadsFor(clubs: readonly string[], season: number): LeagueSquad[] {
  return clubs.map((c): LeagueSquad => ({
    club: c,
    players: generateSquad(clubNameSeed(c) + season).map((p, i): LeaguePlayer => ({
      // Unique across clubs, the way real ids (a sofifa_id, or
      // generatedSquad's own `gen:<club>:<i>`) are — generateSquad alone
      // hands out `sp_0`.. per call, which would collide between clubs and
      // make "nobody is at two clubs" untestable for the wrong reason.
      id: `${c}:${i}`, name: `${p.name} (${c})`, position: p.position,
      positions: p.positions ?? [p.position],
      overall: 60 + (clubNameSeed(p.name) % 22), goals: 0, assists: 0,
    })),
  }));
}

function freshCareer(): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, leagueSquads: leagueSquadsFor(PREMIER_LEAGUE_CLUBS, 1) };
}

function statsFor(us: number, them: number, home: boolean, goals: number): MatchStats {
  return {
    chances: 5, goals, assists: 1, passes: 28, rating: 7.2, starMan: goals >= 2,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: goals,
    sponsorPay: 0, totalCash: 2,
    homeScore: home ? us : them, awayScore: home ? them : us, minutes: 90,
  };
}

const finite = (n: unknown): boolean => typeof n === "number" && Number.isFinite(n);

/** Everything that must hold at any single moment in a career. */
function auditCareer(c: CareerState, when: string): void {
  // ── The league table is internally consistent ──
  for (const t of c.league) {
    check(finite(t.points) && finite(t.played) && finite(t.goalsFor) && finite(t.goalsAgainst),
      `${when}: every league table number is a real number (${t.name})`);
    check(t.points === t.won * 3 + t.drawn,
      `${when}: points always equal wins×3 + draws (${t.name}: ${t.points} vs ${t.won}×3+${t.drawn})`);
    check(t.played === t.won + t.drawn + t.lost,
      `${when}: games played always equal W+D+L (${t.name})`);
    check(t.won >= 0 && t.drawn >= 0 && t.lost >= 0 && t.goalsFor >= 0 && t.goalsAgainst >= 0,
      `${when}: no negative totals in the league table (${t.name})`);
  }

  // ── A closed division scores against itself ──
  // Every goal has a scorer's club and a conceder's club, so the two columns
  // must sum equal. They can only diverge if a result was credited to one
  // side and not the other.
  const gf = c.league.reduce((s, t) => s + t.goalsFor, 0);
  const ga = c.league.reduce((s, t) => s + t.goalsAgainst, 0);
  check(gf === ga, `${when}: goals scored across the division equal goals conceded (${gf} vs ${ga})`);

  // ── Nobody is in two dressing rooms at once ──
  const seen = new Map<string, string>();
  for (const sq of c.leagueSquads ?? []) {
    for (const p of sq.players) {
      const already = seen.get(p.id);
      check(already === undefined,
        `${when}: no player is at two clubs at once (${p.name} at ${already} and ${sq.club})`);
      seen.set(p.id, sq.club);
    }
  }

  // ── Your own squad is a real squad ──
  const mine = new Set<string>();
  for (const p of c.squad) {
    check(!mine.has(p.id), `${when}: your own squad holds no duplicate of the same player (${p.name})`);
    mine.add(p.id);
    check(finite(p.seasonGoals) && finite(p.careerGoals),
      `${when}: every team-mate's tallies are real numbers (${p.name})`);
    check(p.seasonGoals >= 0 && p.careerGoals >= 0 && p.seasonAssists >= 0 && p.careerAssists >= 0,
      `${when}: no negative goal or assist tallies (${p.name})`);
    // The league-only subset is a SUBSET — it can never exceed the total that
    // contains it. This is what a dropped/rewritten tally looks like.
    if (p.leagueGoals !== undefined) {
      check(p.leagueGoals <= p.seasonGoals,
        `${when}: league goals never exceed total season goals (${p.name}: ${p.leagueGoals} of ${p.seasonGoals})`);
    }
    if (p.leagueAssists !== undefined) {
      check(p.leagueAssists <= p.seasonAssists,
        `${when}: league assists never exceed total season assists (${p.name})`);
    }
  }

  // ── The player's own numbers ──
  check(finite(c.fame) && finite(c.starRating) && finite(c.cash ?? 0),
    `${when}: the player's own headline numbers are real numbers`);
  check((c.seasonStats?.goals ?? 0) >= 0 && (c.careerStats?.goals ?? 0) >= 0,
    `${when}: the player's own tallies are never negative`);

  // ── You are always in your own division ──
  //
  // Deliberately NOT "every club in the table has a squad": `advanceSeason`
  // drops the squads of clubs you have left behind rather than carrying dead
  // weight, and app/star-dev/page.tsx re-fetches whichever ones are missing
  // from the database on the next render. A headless test has no network, so
  // asserting that here would only be measuring the absence of a fetch.
  //
  // What must hold with no network at all is this: the club you play for is
  // in the table you are shown, and it has a squad. Fail that and the league
  // screen has no row for you and the team sheet has nobody on it.
  const tableClubs = new Set(c.league.map(t => t.name));
  check(tableClubs.has(c.player.club),
    `${when}: your own club is in your own league table (${c.player.club} is not)`);
  check(c.squad.length > 0, `${when}: you always have a squad around you`);

  // Any squad that IS present must be a real one, not an empty shell.
  for (const sq of c.leagueSquads ?? []) {
    check(sq.players.length > 0, `${when}: no club is carrying an empty squad (${sq.club})`);
  }

  // ── A loan always points somewhere real ──
  for (const l of c.activeLoans ?? []) {
    check(!!l.playerId && !!l.parentClub && !!l.loanClub,
      `${when}: an active loan always names a player, an owner and a destination`);
    check(l.parentClub !== l.loanClub,
      `${when}: nobody is ever on loan at the club that already owns him (${l.player})`);
    check(finite(l.returnSeason), `${when}: a loan always has a real season to come home for (${l.player})`);
  }
}

// ── Play it ────────────────────────────────────────────────────────────────
{
  let c = freshCareer();
  auditCareer(c, "a brand new career");

  const SEASONS = 6;
  for (let season = 1; season <= SEASONS; season++) {
    let guard = 0;
    // Play every fixture the season has, whatever the division's length —
    // the Championship's 46 and the Premier League's 38 both have to work,
    // and promotion can move you between them mid-run.
    while (guard++ < 200) {
      const next = c.fixtures.find(f => !f.played);
      if (!next) break;
      const us = (season + guard) % 4;
      const them = (guard * 3) % 3;
      const mine = Math.min(us, (guard % 3));
      c = creditMatchResult(c, next, statsFor(us, them, next.home, mine)).career;
      auditCareer(c, `season ${season}, after a match`);
    }
    check(guard < 200, `season ${season} finishes rather than looping forever`);

    const seasonBefore = c.season;
    c = advanceSeason(c, false).career;
    auditCareer(c, `season ${season}, after the rollover`);

    check(c.season === seasonBefore + 1,
      `the rollover moves the career on exactly one season (${seasonBefore} -> ${c.season})`);
    check((c.fixtures ?? []).some(f => !f.played),
      `season ${c.season} starts with fixtures still to play`);

    // ── A new season starts at nought ──
    // Both tallies, not just one: the pair diverging is exactly the shape of
    // the bug that inflated the Golden Boot mid-season.
    for (const p of c.squad) {
      check(p.seasonGoals === 0 && p.seasonAssists === 0,
        `season ${c.season} starts with every team-mate's season tallies at nought (${p.name})`);
      check((p.leagueGoals ?? 0) === 0 && (p.leagueAssists ?? 0) === 0,
        `season ${c.season} starts with every team-mate's league tallies at nought too (${p.name})`);
    }
    for (const t of c.league) {
      check(t.played === 0 && t.points === 0 && t.goalsFor === 0 && t.goalsAgainst === 0,
        `season ${c.season} starts with a blank league table (${t.name})`);
    }
  }
}

// ── Replaying the same match must not credit it twice ───────────────────────
//
// This game has shipped a double-crediting bug before (see the transfer
// window's own lastTransferWindowKey guard), so it is worth holding the line
// explicitly rather than trusting it.
{
  const c = freshCareer();
  const fixture = c.fixtures.find(f => !f.played)!;
  const stats = statsFor(2, 1, fixture.home, 2);

  const once = creditMatchResult(c, fixture, stats).career;
  const twice = creditMatchResult(once, fixture, stats).career;

  check(twice.seasonStats.goals === once.seasonStats.goals,
    `re-crediting the same match does not add the goals again (${once.seasonStats.goals} -> ${twice.seasonStats.goals})`);
  const playedOnce = once.league.reduce((s, t) => s + t.played, 0);
  const playedTwice = twice.league.reduce((s, t) => s + t.played, 0);
  check(playedOnce === playedTwice,
    `re-crediting the same match does not advance the table again (${playedOnce} -> ${playedTwice})`);
  // The calendar, the wallet, and this match's own tallies — reported
  // directly: only a subset of what creditMatchResult touches was ever
  // actually guarded against a replay. `week` is the one that matters
  // most — advancing it twice permanently skips a real week for the rest
  // of the career.
  check(twice.week === once.week,
    `a replay does not advance the calendar week again (${once.week} -> ${twice.week})`);
  check(twice.money === once.money,
    `a replay does not pay the match again (${once.money} -> ${twice.money})`);
  check(twice.leagueSeasonStats?.goals === once.leagueSeasonStats?.goals,
    `a replay does not inflate the in-season Golden Boot tally either (${once.leagueSeasonStats?.goals} -> ${twice.leagueSeasonStats?.goals})`);
  check(twice.matchFitness === once.matchFitness && twice.starRating === once.starRating && twice.fame === once.fame,
    "…nor fitness, star rating or fame");
  auditCareer(twice, "after a replayed match");
}

// ── Replaying the REAL, career-seeded FA Cup tie must not re-settle it ──────
//
// A fabricated cup fixture/run doesn't exercise this at all (an empty
// `cups` array — the state before a knockout run has actually started —
// skips the whole settlement block, `idx < 0`, trivially "passing" either
// way), so this uses the actual FA Cup tie `makeInitialCareer` seeds.
{
  const c = freshCareer();
  const fixture = c.fixtures.find(f => f.kind === "cup" && f.competition === "FA Cup")!;
  const stats = statsFor(2, 0, fixture.home, 2);

  const once = creditMatchResult(c, fixture, stats).career;
  const twice = creditMatchResult(once, fixture, stats).career;

  check(twice.fixtures.length === once.fixtures.length,
    `a replayed cup tie does not draw a second, never-played next round (${once.fixtures.length} -> ${twice.fixtures.length})`);
  check(twice.trophies.length === once.trophies.length,
    "…and cannot mint a duplicate trophy off a phantom result");
  check(JSON.stringify(twice.cups) === JSON.stringify(once.cups),
    "…and the run itself is identical either way");
}

// ── The same is true of a fixture watched from the stands ──────────────────
//
// simulateMissedFixture had no replay guard of its own at all — not even
// creditMatchResult's original, partial one.
{
  const c = freshCareer();
  const fixture = c.fixtures.find(f => !f.played)!;

  const once = simulateMissedFixture(c, fixture).career;
  const twice = simulateMissedFixture(once, fixture).career;

  check(twice.week === once.week, `watching it again does not advance the week again (${once.week} -> ${twice.week})`);
  check(twice.money === once.money, `…or pay the wage again (${once.money} -> ${twice.money})`);
  const playedOnce = once.league.reduce((s, t) => s + t.played, 0);
  const playedTwice = twice.league.reduce((s, t) => s + t.played, 0);
  check(playedOnce === playedTwice, `…or advance the table again (${playedOnce} -> ${playedTwice})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — six seasons played end to end, every invariant held");
