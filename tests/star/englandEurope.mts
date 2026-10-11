import { makeInitialCareer, resolveSeasonWinners } from "../../lib/star/careerFlow";
import { membershipOf } from "../../lib/star/promotion";
import { poolFor } from "../../lib/star/euro";
import { englishTopFlightTable } from "../../lib/star/englishTopFlight";
import {
  CHAMPIONSHIP_CLUBS, LEAGUE_ONE_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS, PREMIER_LEAGUE_CLUBS,
} from "../../lib/star/clubs";
import { mulberry32 } from "../../lib/star/season";
import type { CareerDivision } from "../../lib/star/calendar";
import type { CareerState, StarPlayer, LeagueTeam } from "../../lib/star/types";

/**
 * ENGLAND'S EUROPEAN CLUBS COME FROM THE PREMIER LEAGUE.
 *
 * Found 5 Oct 2026 (Leo): outside the Premier League, resolveSeasonWinners
 * built England's Champions/Europa League entrants from YOUR OWN division's
 * table, so now and then a Championship (or lower) club "won" the Champions
 * League. euro.ts's seasonField made the same mistake for the field itself:
 * from season 2 on, a League One career's "England" in Europe was League One.
 * Measured over 200 seeded seasons per division.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

/** A finished, seeded table for the division you play in. */
function finished(career: CareerState, seed: number): CareerState {
  const rng = mulberry32(seed);
  const league: LeagueTeam[] = career.league.map((t) => {
    const points = Math.round(30 + rng() * 60);
    return { ...t, played: 46, won: Math.floor(points / 3), drawn: points % 3, lost: 0, goalsFor: points, goalsAgainst: 40, points };
  });
  return { ...career, league };
}

const DIVS: [CareerDivision, readonly string[]][] = [
  ["championship", CHAMPIONSHIP_CLUBS],
  ["league_one", LEAGUE_ONE_CLUBS],
  ["national_league_south", NATIONAL_LEAGUE_SOUTH_CLUBS],
];

let bad = 0, total = 0, badField = 0;
for (const [division, clubs] of DIVS) {
  const base = makeInitialCareer(playerAt(clubs[0]), [...clubs], division);
  const premier = new Set(membershipOf(base).premier);
  const ownDivision = new Set(clubs);
  for (let s = 1; s <= 200; s++) {
    const career = finished({ ...base, season: s }, s * 31 + division.length);
    const w = resolveSeasonWinners(career);
    total++;
    // The only way a club below the Premier League reaches Europe is winning
    // the FA Cup or League Cup (the real rule, kept). Anything else is the bug.
    const cupWinners = new Set([w.faCup, w.leagueCup].filter(Boolean));
    for (const name of [w.championsLeague, w.europaLeague]) {
      if (name && ownDivision.has(name) && !cupWinners.has(name)) bad++;
    }
    if (s >= 2 && s <= 40) {
      // The real field: no club from your own (lower) division unless it's you.
      const field = [...poolFor("Champions League", career), ...poolFor("Europa League", career)];
      const intruders = field.filter(c => ownDivision.has(c.name) && c.name !== career.player.club);
      if (intruders.length) badField++;
      const english = new Set(field.filter(c => premier.has(c.name)).map(c => c.name)).size;
      check(english >= 8, `${division} season ${s}: ${english} Premier League clubs in Europe (want 8+)`);
    }
  }
}
console.log(`European winners from your own lower division: ${bad} in ${total} seasons`);
console.log(`Seasons whose European field held lower-division clubs: ${badField} in ${DIVS.length * 39}`);
check(bad === 0, `a lower-division club won a European trophy ${bad} times`);
check(badField === 0, `${badField} seasons put lower-division clubs in the European field`);

// ── The stand-in Premier League table ──────────────────────────────────────
{
  const base = makeInitialCareer(playerAt(CHAMPIONSHIP_CLUBS[0]), [...CHAMPIONSHIP_CLUBS], "championship");
  const a = englishTopFlightTable({ ...base, season: 3 });
  const b = englishTopFlightTable({ ...base, season: 3 });
  check(a.length === 20, `the stand-in table has 20 clubs (got ${a.length})`);
  check(a.every(t => t.played === 38), "every club played 38");
  check(JSON.stringify(a) === JSON.stringify(b), "same season, same table");
  check(a.every(t => membershipOf(base).premier.includes(t.name)), "only Premier League clubs");
  // In the Premier League it is simply your own table.
  const pl = makeInitialCareer(playerAt(PREMIER_LEAGUE_CLUBS[0]), [...PREMIER_LEAGUE_CLUBS], "premier");
  check(englishTopFlightTable(pl) === pl.league, "in the Premier League the real table is used");
}

if (problems.length) {
  console.error(problems.slice(0, 20).join("\n"));
  process.exit(1);
}
console.log("englandEurope: all checks passed");
