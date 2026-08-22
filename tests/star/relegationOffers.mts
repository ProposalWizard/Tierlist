import { generateRelegationOffers } from "../../lib/star/relegationOffers";
import { acceptOffer } from "../../lib/star/transfers";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { mulberry32, sortLeague } from "../../lib/star/season";
import { CHAMPIONSHIP_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * A NEW CLUB WHEN THE OLD ONE GOES DOWN.
 *
 * Relegation out of the Championship removes the "stay put" option the
 * ordinary transfer window has — the pool has no season to stay for — so
 * this generator has one job the ordinary one does not: never come back
 * empty.
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

function seasonWithReputation(starRating: number, goals: number): CareerState {
  const clubs = [...CHAMPIONSHIP_CLUBS];
  const you = clubs[clubs.length - 2];
  const career = makeInitialCareer(playerAt(you), clubs, "championship");
  return {
    ...career,
    starRating,
    seasonStats: { ...career.seasonStats, goals },
    form: [7.5, 7.8, 7.2, 7.9, 8.1],
    league: career.league.map((t, i) => ({
      ...t, played: 46, won: 46 - i, drawn: 0, lost: i,
      goalsFor: (46 - i) * 3, goalsAgainst: 0, points: (46 - i) * 3,
    })),
  };
}

// ── Never empty ──────────────────────────────────────────────────────────
{
  const career = seasonWithReputation(2.0, 3);
  const offers = generateRelegationOffers(career, mulberry32(1));
  check(offers.length >= 1, `at least one offer even on a poor season (${offers.length})`);
}

// ── Never your own club, never another relegated one ────────────────────
{
  const career = seasonWithReputation(3.5, 12);
  const bottom = sortLeague(career.league).map(t => t.name).slice(-3);
  const offers = generateRelegationOffers(career, mulberry32(2));
  check(offers.every(o => o.club !== career.player.club), "never yourself");
  check(offers.every(o => !bottom.includes(o.club)), "never one of the other relegated clubs");
}

// ── A real signing works end to end ──────────────────────────────────────
{
  const career = seasonWithReputation(3.2, 9);
  const offers = generateRelegationOffers(career, mulberry32(3));
  const moved = acceptOffer(career, offers[0]);
  check(moved.player.club === offers[0].club, "the signature actually changes your club");
  check(moved.contract.club === offers[0].club, "and the contract");
  check(moved.squad.length > 0, "and a squad comes with the new shirt");
}

// ── A Premier League move is possible only after an outstanding season ──
{
  const weak = seasonWithReputation(2.2, 4);
  const strong = seasonWithReputation(4.9, 34);
  let weakSawPL = false, strongSawPL = false;
  for (let seed = 0; seed < 40; seed++) {
    if (generateRelegationOffers(weak, mulberry32(seed)).some(o => PREMIER_LEAGUE_CLUBS.includes(o.club))) {
      weakSawPL = true;
    }
    if (generateRelegationOffers(strong, mulberry32(seed + 1000)).some(o => PREMIER_LEAGUE_CLUBS.includes(o.club))) {
      strongSawPL = true;
    }
  }
  check(!weakSawPL, "a weak relegated season never draws Premier League interest");
  check(strongSawPL, "an outstanding one sometimes does, across enough tries");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — relegation always finds you a new club, and rarely a Premier League one");
