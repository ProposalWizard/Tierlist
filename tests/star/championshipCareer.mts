import { makeInitialCareer } from "../../lib/star/careerFlow";
import { CHAMPIONSHIP_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import {
  divisionOf, leagueNameFor, matchweeksFor, isPostSeason,
  CHAMPIONSHIP_LEAGUE_CUP_SLOTS, CHAMPIONSHIP_FA_CUP_SLOTS,
  LEAGUE_CUP_SLOTS, FA_CUP_SLOTS,
} from "../../lib/star/calendar";
import type { StarPlayer } from "../../lib/star/types";

/**
 * A CHAMPIONSHIP CAREER IS A REAL CAREER.
 *
 * Same game, longer season, no European football. This checks the thing
 * actually builds — twenty-four clubs, forty-six rounds of fixtures, cup
 * ties on Championship weeks rather than Premier League ones — and that
 * making one has not changed what a Premier League career gets.
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

const champClub = CHAMPIONSHIP_CLUBS[0];
// Not PREMIER_LEAGUE_CLUBS[0] (Arsenal) — Arsenal starts in the Champions
// League (see STARTING_EUROPEAN_QUALIFICATION, clubs.ts), and a club playing
// Europe deliberately gets its colliding cup rounds pushed off the raw slot
// weeks below (cupRoundWeek's inEurope push-forward, competitions.ts) — real,
// intended behaviour that has its own dedicated coverage elsewhere, not what
// this block is checking. Leeds United starts with no European place, so this
// stays a clean baseline: an ordinary Premier League career's cups still sit
// exactly on the raw weeks.
const plClub = "Leeds United";
const champ = makeInitialCareer(playerAt(champClub), [...CHAMPIONSHIP_CLUBS], "championship");
const pl = makeInitialCareer(playerAt(plClub), [...PREMIER_LEAGUE_CLUBS], "premier");

// ── It is a Championship career ─────────────────────────────────────────────
{
  check(divisionOf(champ) === "championship", `the career knows its division (${divisionOf(champ)})`);
  check(leagueNameFor(divisionOf(champ)) === "Championship",
    `and calls itself the Championship (${leagueNameFor(divisionOf(champ))})`);
  check(champ.league.length === 24, `twenty-four clubs in the table (${champ.league.length})`);
  check(champ.league.some(t => t.name === champClub), "including your own");
}

// ── Forty-six league games, and they are all inside the season ──────────────
{
  const league = champ.fixtures.filter(f => (f.kind ?? "league") === "league");
  check(league.length === 46, `forty-six league fixtures (${league.length})`);

  const weeks = league.map(f => f.week).sort((a, b) => a - b);
  check(new Set(weeks).size === 46, `one per round, none doubled up (${new Set(weeks).size} distinct)`);
  check(weeks[0] === 1 && weeks[weeks.length - 1] === 46,
    `running from round 1 to round 46 (${weeks[0]}-${weeks[weeks.length - 1]})`);
  check(league.every(f => !isPostSeason(f.week, "championship")),
    "and none of them after the season ends");

  const home = league.filter(f => f.home).length;
  check(home === 23, `twenty-three at home and twenty-three away (${home} home)`);

  const opponents = league.map(f => f.opponent);
  check(!opponents.includes(champClub), "you never play yourself");
  check(new Set(opponents).size === 23, `you play all twenty-three other clubs (${new Set(opponents).size})`);
  // Each of them exactly twice — once each way.
  const twice = Array.from(new Set(opponents)).every(o => opponents.filter(x => x === o).length === 2);
  check(twice, "each of them exactly twice");
}

// ── The cups are on Championship weeks, not Premier League ones ─────────────
{
  const cupWeeks = new Set(
    champ.fixtures.filter(f => f.kind === "cup").map(f => f.week),
  );
  const champSlots = new Set([
    ...CHAMPIONSHIP_LEAGUE_CUP_SLOTS.map(s => s.week),
    ...CHAMPIONSHIP_FA_CUP_SLOTS.map(s => s.week),
  ]);
  check(cupWeeks.size > 0, "a Championship career is entered in the cups");
  const strays = Array.from(cupWeeks).filter(w => !champSlots.has(w));
  check(strays.length === 0,
    `every cup tie is on a Championship cup week (stray weeks: ${strays.join(", ") || "none"})`);

  // The distinction is real: the two divisions' first cup rounds are
  // genuinely different week numbers, so this could not pass by accident.
  check(CHAMPIONSHIP_LEAGUE_CUP_SLOTS[0].week !== LEAGUE_CUP_SLOTS[0].week
      && CHAMPIONSHIP_FA_CUP_SLOTS[0].week !== FA_CUP_SLOTS[0].week,
    "and the two divisions really do use different cup weeks");
}

// ── No European football ────────────────────────────────────────────────────
{
  check(champ.europeanQualification === null, "a first Championship season has no European place");
  check(!champ.fixtures.some(f => f.kind === "europe"), "and no European fixtures");
}

// ── A Premier League career is untouched ────────────────────────────────────
{
  check(divisionOf(pl) === "premier", `still a Premier League career (${divisionOf(pl)})`);
  check(leagueNameFor(divisionOf(pl)) === "Premier League", "still called the Premier League");
  check(pl.league.length === 20, `twenty clubs (${pl.league.length})`);
  check(matchweeksFor(divisionOf(pl)) === 38, "still a 38-week season");

  const league = pl.fixtures.filter(f => (f.kind ?? "league") === "league");
  check(league.length === 38, `thirty-eight league fixtures (${league.length})`);
  check(league.filter(f => f.home).length === 19, "nineteen of them at home");

  const plCupWeeks = new Set(pl.fixtures.filter(f => f.kind === "cup").map(f => f.week));
  const plSlots = new Set([...LEAGUE_CUP_SLOTS.map(s => s.week), ...FA_CUP_SLOTS.map(s => s.week)]);
  const strays = Array.from(plCupWeeks).filter(w => !plSlots.has(w));
  check(strays.length === 0, `and its cups still sit on Premier League weeks (stray: ${strays.join(", ") || "none"})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a Championship career builds: 24 clubs, 46 rounds, its own cup weeks, no Europe");
