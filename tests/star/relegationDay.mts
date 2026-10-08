import { relegationNews } from "../../lib/star/breakingNews";
import { relegationPlaces } from "../../lib/star/calendar";
import { TABLE_DETECTORS } from "../../lib/star/media/detect/table";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_NORTH_CLUBS } from "../../lib/star/clubs";
import type { CareerState, Fixture, StarPlayer } from "../../lib/star/types";
import type { MatchRecord } from "../../lib/star/media/types";

/**
 * RELEGATION DAY (Mikey, 8 Oct 2026): a news flash when the last league match
 * leaves your club in the drop, and the feed's "relegated" story uses each
 * division's real number of places (it counted the bottom three everywhere).
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

check(relegationPlaces("premier") === 3 && relegationPlaces("league_one") === 4 && relegationPlaces("league_two") === 2
  && relegationPlaces("national_league_north") === 4, "relegation places per division");

const player = (club: string) => ({ firstName: "T", lastName: "Smith", age: 22, skinTone: "light", club, clubBadge: null,
  position: "ST", nationality: "England", startYear: 2027 } as StarPlayer);
function at(clubs: string[], division: string, place: number): CareerState {
  const you = clubs[3];
  const c = makeInitialCareer(player(you), clubs, division as never);
  const order = clubs.filter(x => x !== you); order.splice(place - 1, 0, you);
  return { ...c, fixtures: c.fixtures.map(f => ({ ...f, played: true })),
    league: c.league.map(t => { const p = (clubs.length - order.indexOf(t.name)) * 3; return { ...t, points: p, won: p / 3, goalsFor: p }; }) };
}
const last = { week: 38, opponent: "X", home: true, played: true, kind: "league" } as Fixture;

for (const [clubs, div, firstDown] of [[PREMIER_LEAGUE_CLUBS, "premier", 18], [LEAGUE_TWO_CLUBS, "league_two", 23], [NATIONAL_LEAGUE_NORTH_CLUBS, "national_league_north", 21]] as const) {
  const n = clubs.length;
  check(!relegationNews(at([...clubs], div, firstDown - 1), last), `${div}: ${firstDown - 1}th is safe`);
  const news = relegationNews(at([...clubs], div, firstDown), last);
  check(!!news && news.headline.includes("RELEGATED"), `${div}: ${firstDown}th is relegated`);
  if (div === "national_league_north") check(!!news?.line.includes("new club"), "North: needs a new club");
  else check(!!news?.line.includes("cut by a quarter"), `${div}: the pay cut is named`);
  check(!!relegationNews(at([...clubs], div, n), last), `${div}: last is relegated`);
  // The feed's detector agrees.
  const rec = { kind: "league", club: "Y", opponent: "X", competition: "League", you: { name: "T Smith", shortName: "Smith", rating: 6 }, context: { managerName: "M", fame: 0, fansStanding: 50, conditions: "" }, score: { us: 0, them: 1 }, table: { clubs: n, matchesLeft: 0, relegationPlaces: relegationPlaces(div), before: { position: 10, points: 30 }, after: { position: firstDown, points: 30 }, leaderGap: 10, relegationGap: 0 } } as unknown as MatchRecord;
  const safe = { ...rec, table: { ...rec.table, after: { position: firstDown - 1, points: 30 } } } as MatchRecord;
  const fired = (r: MatchRecord) => TABLE_DETECTORS.some(d => { try { return d(r)?.id === "relegated"; } catch { return false; } });
  check(fired(rec) && !fired(safe), `${div}: feed says relegated at ${firstDown}th, not ${firstDown - 1}th`);
}
check(!relegationNews(at([...PREMIER_LEAGUE_CLUBS], "premier", 20), { ...last, kind: "cup" }), "a cup match is not relegation day");

if (problems.length) {
  console.error(`relegationDay: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("relegationDay: all good");
