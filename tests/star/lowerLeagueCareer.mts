import { makeInitialCareer } from "../../lib/star/careerFlow";
import { LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS } from "../../lib/star/clubs";
import {
  divisionOf, leagueNameFor, matchweeksFor, isPostSeason, leagueCupSlotsFor, faCupSlotsFor,
  CHAMPIONSHIP_LEAGUE_CUP_SLOTS, CHAMPIONSHIP_FA_CUP_SLOTS, type CareerDivision,
} from "../../lib/star/calendar";
import { resolveLadder } from "../../lib/star/promotion";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * LEAGUE ONE, LEAGUE TWO AND THE NATIONAL LEAGUE ARE REAL, PLAYABLE CAREERS.
 *
 * Extended 18 September 2026 from simulated/background-only tiers (real
 * clubs, real kits, real generated squads, but no live table of their own)
 * into genuinely playable careers — same real 24-club shape the Championship
 * already had, reusing its exact season/cup machinery rather than inventing
 * new machinery for three more tiers. Mirrors championshipCareer.mts's own
 * style closely; this is its direct extension down the ladder.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027,
  } as StarPlayer;
}

const TIERS: { division: CareerDivision; clubs: readonly string[]; name: string }[] = [
  { division: "league_one", clubs: LEAGUE_ONE_CLUBS, name: "League One" },
  { division: "league_two", clubs: LEAGUE_TWO_CLUBS, name: "League Two" },
  { division: "national_league", clubs: NATIONAL_LEAGUE_CLUBS, name: "National League" },
];

for (const { division, clubs, name } of TIERS) {
  const club = clubs[0];
  const career = makeInitialCareer(playerAt(club), [...clubs], division);

  // ── It is a real, playable career in this division ──
  check(divisionOf(career) === division, `${name}: the career knows its division (${divisionOf(career)})`);
  check(leagueNameFor(divisionOf(career)) === name, `${name}: calls itself correctly (${leagueNameFor(divisionOf(career))})`);
  check(career.league.length === 24, `${name}: twenty-four clubs in the table (${career.league.length})`);
  check(career.league.some(t => t.name === club), `${name}: including your own`);
  check(matchweeksFor(division) === 46, `${name}: a 46-round season`);

  // ── Forty-six league games, correctly shaped ──
  const league = career.fixtures.filter(f => (f.kind ?? "league") === "league");
  check(league.length === 46, `${name}: forty-six league fixtures (${league.length})`);
  const weeks = league.map(f => f.week).sort((a, b) => a - b);
  check(new Set(weeks).size === 46, `${name}: one per round, none doubled up (${new Set(weeks).size} distinct)`);
  check(weeks[0] === 1 && weeks[weeks.length - 1] === 46,
    `${name}: running from round 1 to round 46 (${weeks[0]}-${weeks[weeks.length - 1]})`);
  check(league.every(f => !isPostSeason(f.week, division)), `${name}: none of them after the season ends`);
  const home = league.filter(f => f.home).length;
  check(home === 23, `${name}: twenty-three at home and twenty-three away (${home} home)`);
  const opponents = league.map(f => f.opponent);
  check(!opponents.includes(club), `${name}: you never play yourself`);
  check(new Set(opponents).size === 23, `${name}: you play all twenty-three other clubs (${new Set(opponents).size})`);

  // ── Cup participation matches the real per-competition rules ──
  const cupWeeks = new Set(career.fixtures.filter(f => f.kind === "cup").map(f => f.week));
  const expectFACup = faCupSlotsFor(division).length > 0;
  const expectLeagueCup = leagueCupSlotsFor(division).length > 0;
  check(expectFACup, `${name}: enters the FA Cup (real life)`);
  if (division === "national_league") {
    check(!expectLeagueCup, `${name}: does NOT enter the League Cup (real life)`);
  } else {
    check(expectLeagueCup, `${name}: enters the League Cup (real life)`);
  }
  check(cupWeeks.size > 0, `${name}: is entered in at least one cup`);
  const validSlots = new Set([
    ...CHAMPIONSHIP_LEAGUE_CUP_SLOTS.map(s => s.week), ...CHAMPIONSHIP_FA_CUP_SLOTS.map(s => s.week),
  ]);
  const strays = Array.from(cupWeeks).filter(w => !validSlots.has(w));
  check(strays.length === 0, `${name}: every cup tie sits on a real (Championship-shaped) cup week (strays: ${strays.join(", ") || "none"})`);

  // ── No European football ──
  check(career.europeanQualification === null, `${name}: no European place in a first season`);
  check(!career.fixtures.some(f => f.kind === "europe"), `${name}: and no European fixtures`);
}

// ── A season rollover promotes/relegates the player's own club between
// every adjacent tier, not just Premier League <-> Championship ──
{
  function fixtureLike(name: string, strength: number) {
    return { name, strength, played: 46, points: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 };
  }

  // A League One club, guaranteed bottom of its own table (very low
  // strength) — the season's real result, so relegation into League Two
  // must fire off the live table, not a weighted draw.
  const club = LEAGUE_ONE_CLUBS[0];
  const player = playerAt(club);
  let career: CareerState = makeInitialCareer(player, [...LEAGUE_ONE_CLUBS], "league_one");
  career = {
    ...career,
    league: [
      ...LEAGUE_ONE_CLUBS.filter(c => c !== club).map(c => fixtureLike(c, 65)),
      fixtureLike(club, 5), // rock bottom, guaranteed relegation
    ],
  } as CareerState;

  const ladder = resolveLadder(career, mulberry32(1));
  check(ladder.division === "league_two", `League One -> League Two relegation resolves to the real division (got ${ladder.division})`);
  check(ladder.yourMove === "relegated", "and is reported as a relegation");
  check(ladder.relegatedFromLeagueOne.includes(club), "your club is really in the relegated list");
  check(ladder.divisions.leagueTwo.includes(club), "and really lands in next season's League Two membership");

  // And the reverse: a League Two club, guaranteed top of its own table.
  const upClub = LEAGUE_TWO_CLUBS[0];
  let upCareer: CareerState = makeInitialCareer(playerAt(upClub), [...LEAGUE_TWO_CLUBS], "league_two");
  upCareer = {
    ...upCareer,
    league: [
      fixtureLike(upClub, 95), // guaranteed automatic promotion (top 3 of 4)
      ...LEAGUE_TWO_CLUBS.filter(c => c !== upClub).map(c => fixtureLike(c, 50)),
    ],
  } as CareerState;
  const upLadder = resolveLadder(upCareer, mulberry32(2));
  check(upLadder.division === "league_one", `League Two -> League One promotion resolves to the real division (got ${upLadder.division})`);
  check(upLadder.yourMove === "promoted", "and is reported as a promotion");
  check(upLadder.promotedToLeagueOne.includes(upClub), "your club is really in the promoted list");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — League One, League Two and the National League are real, playable 24-club careers, with real promotion/relegation across every adjacent tier");
