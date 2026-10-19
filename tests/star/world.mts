import { readFileSync } from "fs";
import { makeInitialCareer, advanceSeason, simulateMissedFixture, resolveSeasonWinners } from "../../lib/star/careerFlow";
import { resolveLadder, membershipOf, ratingFor } from "../../lib/star/promotion";
import { mulberry32, sortLeague } from "../../lib/star/season";
import { fixtureTimestamp, divisionOf, type CareerDivision } from "../../lib/star/calendar";
import { nextFixtureFor } from "../../lib/star/competitions";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, NATIONAL_LEAGUE_CLUBS,
} from "../../lib/star/clubs";
import { openWorld, advanceWorld, finishWorld, worldOf, shieldPairs, SEASON_ONE_HOLDERS } from "../../lib/star/world";
import { squadRating, dataRating, DIVISION_LEVEL } from "../../lib/star/world/clubRating";
import type { CareerState, LeagueSquad, StarPlayer } from "../../lib/star/types";
import type { WorldState } from "../../lib/star/world/types";

/**
 * THE WORLD SEASON (docs/WORLD_SEASON.md): every league, cup and European
 * competition you are not in, played for real on its own dates.
 *
 * The squads are the real FC 27 ones (best 16 of every club with a real
 * squad, fetched 19 Oct 2026 through /api/star/league-squads):
 * fixtures/worldSquads_fc27.json.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const REAL: Record<string, { xi: number[]; pos: string[] }> =
  JSON.parse(readFileSync(new URL("./fixtures/worldSquads_fc27.json", import.meta.url), "utf8"));
const SQUADS: LeagueSquad[] = Object.entries(REAL).map(([club, s]) => ({
  club,
  players: s.xi.map((overall, i) => ({
    id: `fx:${club}:${i}`, name: `${club.split(" ")[0]} Player${i}`, position: s.pos[i] as never,
    overall, goals: 0, assists: 0,
  })),
}));

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function careerIn(division: CareerDivision, clubs: readonly string[], season = 1): CareerState {
  const c = makeInitialCareer(playerAt(clubs[0]), [...clubs], division);
  return { ...c, season, externalSquads: SQUADS.filter(s => !clubs.includes(s.club)) };
}

const tablesOf = (w: WorldState) => JSON.stringify({
  l: w.leagues.map(l => [l.division, l.teams, l.scorers, l.played]),
  e: w.europe.map(e => [e.competition, e.table, e.winner, e.koRounds]),
  c: w.leagueCup?.winner, s: w.shields,
});

// ── 1. Ratings: real squads, and club data where there are none ────────────
{
  const c = careerIn("league_one", LEAGUE_ONE_CLUBS);
  const r = (club: string) => ratingFor(c, club);
  check(r("Arsenal") > r("Sunderland"), `Arsenal (${r("Arsenal")}) rated above Sunderland (${r("Sunderland")})`);
  check(r("Manchester City") >= 84, `Man City from its real XI (${r("Manchester City")})`);
  check(Math.abs(r("Coventry City") - 73) < 1, `Coventry from its real XI, 73 (${r("Coventry City")})`);
  check(r("Arsenal") > r("Coventry City") + 10, "a top club rated well above a promoted one");
  // An invented National League squad is rated from club data, ±4 of 55.
  const invented: LeagueSquad = { club: "Woking", players: Array.from({ length: 16 }, (_, i) => ({ id: `gen:Woking:${i}`, name: "x", position: "CM" as never, overall: 99, goals: 0, assists: 0 })) };
  check(squadRating(invented) === null, "an invented squad is not a real rating");
  const nl = dataRating("Woking", "national_league", NATIONAL_LEAGUE_CLUBS);
  check(Math.abs(nl - DIVISION_LEVEL.national_league) <= 4, `club data keeps a club within 4 of its level (${nl})`);
}

// ── 2. Live, a round at a time, gives exactly what all-at-once gives ───────
for (const [division, clubs] of [["league_one", LEAGUE_ONE_CLUBS], ["premier", PREMIER_LEAGUE_CLUBS]] as const) {
  const c = careerIn(division, clubs);
  const opened = openWorld(c);
  const once = advanceWorld(c, opened, Infinity);
  let live = opened;
  const start = fixtureTimestamp(2027, 1, 0, "cup", division);
  for (let day = 0; day <= 330; day += 3) live = advanceWorld(c, live, start + day * 86_400_000);
  live = advanceWorld(c, live, Infinity);
  check(tablesOf(live) === tablesOf(once), `${division}: playing it live gives the same season as playing it at the end`);
  check(tablesOf(finishWorld(c)) === tablesOf(once), `${division}: finishWorld is the same season`);
}

// ── 3. Everything finishes, and adds up ────────────────────────────────────
{
  const c = careerIn("national_league", NATIONAL_LEAGUE_CLUBS);
  const w = finishWorld(c);
  check(!w.leagues.some(l => l.division === "national_league"), "your own league is not in the world");
  check(w.leagues.length === 6, `six other leagues (${w.leagues.length})`);
  for (const l of w.leagues) {
    const games = l.division === "premier" ? 38 : 46;
    check(l.teams.every(t => t.played === games), `${l.division}: every club played ${games}`);
    const pts = l.teams.reduce((s, t) => s + t.points, 0);
    const draws = l.teams.reduce((s, t) => s + t.drawn, 0) / 2;
    const matches = l.teams.length * games / 2;
    check(pts === matches * 3 - draws, `${l.division}: points add up`);
    const gf = l.teams.reduce((s, t) => s + t.goalsFor, 0), ga = l.teams.reduce((s, t) => s + t.goalsAgainst, 0);
    check(gf === ga, `${l.division}: goals for = goals against`);
  }
  for (const e of w.europe) {
    check(e.table.length === 36 && e.table.every(r => r.played === 8), `${e.competition}: 36 clubs, 8 games each`);
    check(!!e.winner && e.clubs.some(x => x.name === e.winner), `${e.competition}: the winner (${e.winner}) was in the field`);
    const opp = new Map<string, Set<string>>();
    check(e.koRounds === 5, `${e.competition}: all five knockout rounds played`);
    void opp;
  }
  check(!!w.leagueCup?.winner, `the League Cup is played without you (winner ${w.leagueCup?.winner})`);
  check(w.shields.length === 2 && w.shields.every(s => !!s.winner), "both season-1 shields played");
  check(w.shields.some(s => s.home === "Arsenal" && s.away === "Manchester City"), "Community Shield 2026: Arsenal v Man City");
  check(w.shields.some(s => s.home === "Paris Saint-Germain" && s.away === "Aston Villa"), "Super Cup 2026: PSG v Aston Villa");
  const pl = w.leagues.find(l => l.division === "premier")!;
  const goals = Object.values(pl.scorers).reduce((s, [g]) => s + g, 0);
  const total = pl.teams.reduce((s, t) => s + t.goalsFor, 0);
  check(goals === total, `every Premier League goal has a scorer (${goals}/${total})`);
}

// ── 4. Up and down follow the tables ───────────────────────────────────────
{
  const c = careerIn("premier", PREMIER_LEAGUE_CLUBS);
  const w = finishWorld(c);
  const ladder = resolveLadder(c, mulberry32(c.season * 90247 + c.league.length * 13));
  const champ = sortLeague(w.leagues.find(l => l.division === "championship")!.teams).map(t => t.name);
  const l1 = sortLeague(w.leagues.find(l => l.division === "league_one")!.teams).map(t => t.name);
  check(JSON.stringify([...ladder.relegatedFromChampionship].sort()) === JSON.stringify(champ.slice(-3).sort()),
    `Championship's bottom three go down (${ladder.relegatedFromChampionship.join(", ")})`);
  check(ladder.promotedToPremier.slice(0, 2).join() === champ.slice(0, 2).join(), "Championship's top two go up automatically");
  check(champ.slice(2, 6).includes(ladder.promotedToPremier[2]), "the third goes up through the play-offs (3rd-6th)");
  check(ladder.promotedToChampionship.slice(0, 2).join() === l1.slice(0, 2).join(), "League One's top two go up");
  check(ladder.worldPlayOffs.length >= 5, `every other division's play-offs are played (${ladder.worldPlayOffs.length})`);
  const all = Object.values(ladder.divisions).flat();
  check(new Set(all).size === all.length, "nobody is in two divisions");
  check(ladder.divisions.premier.length === 20 && ladder.divisions.championship.length === 24, "divisions keep their size");
}

// ── 5. Realism, with the real squads ───────────────────────────────────────
{
  let arsenalDown = 0, outsideField = 0, seasons = 0;
  const titles: Record<string, number> = {};
  for (let season = 1; season <= 60; season++) {
    const c = careerIn("league_one", LEAGUE_ONE_CLUBS, season);
    const w = finishWorld(c);
    const pl = sortLeague(w.leagues.find(l => l.division === "premier")!.teams);
    if (pl.slice(-3).some(t => t.name === "Arsenal")) arsenalDown++;
    titles[pl[0].name] = (titles[pl[0].name] ?? 0) + 1;
    for (const e of w.europe) if (e.winner && !e.clubs.some(x => x.name === e.winner)) outsideField++;
    seasons++;
  }
  check(arsenalDown === 0, `Arsenal relegated ${arsenalDown} times in ${seasons} seasons`);
  const top = Object.entries(titles).sort((a, b) => b[1] - a[1])[0];
  check(["Arsenal", "Manchester City", "Liverpool", "Chelsea", "Manchester United"].includes(top[0]), `most titles to a big club (${top[0]} ${top[1]})`);
  check(outsideField === 0, "no European winner from outside the field");
  console.log(`  realism: ${seasons} seasons, Arsenal relegated ${arsenalDown}, most titles ${top[0]} ${top[1]}`);
}

// ── 6. A match moves the world; the rollover keeps last season ──────────────
{
  let c = careerIn("championship", CHAMPIONSHIP_CLUBS);
  const f = nextFixtureFor(c)!;
  c = simulateMissedFixture(c, f).career;
  check(!!c.world && c.world.season === 1, "the world is saved after a match");
  const pl = c.world!.leagues.find(l => l.division === "premier")!;
  check(pl.played >= 1, `the Premier League's first round is played by the time yours is (${pl.played})`);
  const winners = resolveSeasonWinners(c);
  check(!!winners.premierLeague && PREMIER_LEAGUE_CLUBS.includes(winners.premierLeague), `a Premier League champion (${winners.premierLeague})`);
  check(winners.communityShield === "Arsenal" || winners.communityShield === "Manchester City", "the Community Shield winner is one of its two clubs");
  const w = finishWorld(c);
  const el = w.europe.find(e => e.competition === "Europa League")!;
  check(el.clubs.some(x => x.name === winners.europaLeague), `the Europa League winner was in the Europa League (${winners.europaLeague})`);
  check(winners.leagueCup !== undefined, "a League Cup winner");
  const next = advanceSeason(c, false).career;
  check(next.world === undefined, "the new season's world opens at its first match");
  check(next.lastTopFlight?.length === 20, "last season's Premier League order is kept");
  check(next.lastTopFlight?.[0] === winners.premierLeague, "…best first");
  check((next.lastWorld?.tables.length ?? 0) >= 9, `last season's tables are kept (${next.lastWorld?.tables.length})`);
  check(next.lastSeasonWinners?.premierLeague === winners.premierLeague, "the Premier League champions are remembered");
  const shields = shieldPairs(next);
  const cs = shields.find(s => s.competition === "Community Shield");
  check(!cs || cs.home === winners.premierLeague || cs.away === winners.faCup, "season 2's Community Shield is the real holders");
  // England's European entrants come from last season's real table.
  const w2 = worldOf(next);
  const cl = w2.europe.find(e => e.competition === "Champions League");
  if (cl) {
    const english = cl.clubs.map(x => x.name).filter(n => next.lastTopFlight!.includes(n));
    check(english.every(n => next.lastTopFlight!.indexOf(n) < 8 || n === winners.championsLeague || n === winners.europaLeague),
      `England's Champions League clubs finished high last season (${english.map(n => `${n} ${next.lastTopFlight!.indexOf(n) + 1}`).join(", ")})`);
  }
}

// ── 7. Cost ─────────────────────────────────────────────────────────────────
{
  const c = careerIn("league_two", [...membershipOf(careerIn("league_one", LEAGUE_ONE_CLUBS)).leagueTwo]);
  const t0 = performance.now();
  const w = advanceWorld(c, openWorld(c), Infinity);
  const ms = performance.now() - t0;
  const bytes = JSON.stringify(w).length;
  check(ms < 2000, `a whole season of everything in under 2 s (${ms.toFixed(0)} ms)`);
  check(bytes < 150_000, `the world adds under 150 KB to a save (${(bytes / 1024).toFixed(0)} KB)`);
  let opened = openWorld(c);
  const start = fixtureTimestamp(2027, 1, 0, "cup", divisionOf(c));
  const week: number[] = [];
  for (let d = 7; d <= 320; d += 7) {
    const t = performance.now();
    opened = advanceWorld(c, opened, start + d * 86_400_000);
    week.push(performance.now() - t);
  }
  week.sort((a, b) => a - b);
  console.log(`  cost: season ${ms.toFixed(0)} ms, one week median ${week[week.length >> 1].toFixed(1)} ms (max ${week[week.length - 1].toFixed(1)}), ${(bytes / 1024).toFixed(0)} KB`);
}

void SEASON_ONE_HOLDERS;
if (problems.length) {
  console.error("FAIL world:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("ok world");
