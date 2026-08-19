import { averageStartingXIRating, syncLeagueStrengthFromSquads } from "../../lib/star/leagueSquads";
import { buildLeague } from "../../lib/star/season";
import type { LeagueSquad, LeaguePlayer } from "../../lib/star/types";

/**
 * A CLUB'S STRENGTH, READ OFF THE MEN WHO'D ACTUALLY START.
 *
 * Reported: strength should be "an average strength rating which takes the
 * average rating of the team's starting 11... if players on their team
 * change or develop new ratings then it should adjust itself" — rather than
 * a number rolled once when the division was built and never touched again.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(overall: number, i: number): LeaguePlayer {
  return { id: `p${i}`, name: `Player ${i}`, position: "CM", overall, goals: 0, assists: 0 };
}

function squadOf(overalls: number[]): LeagueSquad {
  return { club: "Test FC", players: overalls.map((o, i) => player(o, i)) };
}

// ── The average itself ──────────────────────────────────────────────────────
{
  // Eleven at 80, nine at 50 (bench) — only the first eleven should count.
  const overalls = [...Array(11).fill(80), ...Array(9).fill(50)];
  const rating = averageStartingXIRating(squadOf(overalls));
  check(rating === 80, `only the first eleven are averaged, bench ignored (got ${rating})`);
}
{
  // A thin squad (fewer than eleven) averages whoever exists rather than
  // dividing by eleven regardless — a club that only has eight men on record
  // is not secretly three own-goals worse than its actual eight suggest.
  const rating = averageStartingXIRating(squadOf([90, 90, 90]));
  check(rating === 90, `a thin squad averages what it actually has (got ${rating})`);
}
{
  const rating = averageStartingXIRating(undefined);
  check(rating === null, "no squad at all reads as no answer, not a zero");
}
{
  const rating = averageStartingXIRating({ club: "Empty FC", players: [] });
  check(rating === null, "an empty squad reads as no answer too");
}
{
  // Rounds rather than truncates — 74.545... should read as 75, not 74.
  const rating = averageStartingXIRating(squadOf([...Array(10).fill(74), 80]));
  check(rating === 75, `rounds to the nearest whole rating (got ${rating})`);
}

// ── Applying it across the division ─────────────────────────────────────────
{
  const CLUBS = ["Liverpool", "Arsenal", "Chelsea", "Everton"];
  const league = buildLeague(CLUBS, "Liverpool");
  const before = new Map(league.map(t => [t.name, t.strength]));

  // Only two of the four clubs have a squad on file — the other two should
  // keep whatever strength they already had, not get reset to zero/undefined.
  const squads: LeagueSquad[] = [
    squadOf(Array(11).fill(88)),
    squadOf(Array(11).fill(60)),
  ];
  squads[0].club = "Liverpool";
  squads[1].club = "Arsenal";

  const synced = syncLeagueStrengthFromSquads(league, squads);
  const byName = new Map(synced.map(t => [t.name, t.strength]));

  check(byName.get("Liverpool") === 88, `a club with a squad on file reads its real average (${byName.get("Liverpool")})`);
  check(byName.get("Arsenal") === 60, `…and a weaker squad reads weaker (${byName.get("Arsenal")})`);
  check(byName.get("Chelsea") === before.get("Chelsea"),
    "a club with no squad on file keeps its existing strength rather than losing it");
  check(byName.get("Everton") === before.get("Everton"),
    "same for the other one — nobody is silently reset");

  // A club's own attributes (played/points/etc) are untouched — this is a
  // strength-only patch, not a full team replacement.
  const liverpool = synced.find(t => t.name === "Liverpool")!;
  const originalLiverpool = league.find(t => t.name === "Liverpool")!;
  check(liverpool.played === originalLiverpool.played && liverpool.points === originalLiverpool.points,
    "syncing strength does not touch the rest of the table row");
}

// ── It really does move when the squad does ─────────────────────────────────
{
  const league = buildLeague(["Liverpool"], "Liverpool");
  const weak = syncLeagueStrengthFromSquads(league, [{ club: "Liverpool", players: Array(11).fill(0).map((_, i) => player(55, i)) }]);
  const strong = syncLeagueStrengthFromSquads(league, [{ club: "Liverpool", players: Array(11).fill(0).map((_, i) => player(92, i)) }]);
  check(weak[0].strength === 55 && strong[0].strength === 92,
    `a transfer or a development jump changes the club's strength, not just its squad (${weak[0].strength} vs ${strong[0].strength})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — a club's strength is a live reading of who would actually start, not a number rolled once");
