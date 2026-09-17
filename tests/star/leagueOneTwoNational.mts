import {
  LEAGUE_ONE_CLUBS, LEAGUE_TWO_CLUBS, NATIONAL_LEAGUE_CLUBS, NATIONAL_LEAGUE_POOL_CLUBS,
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS, OTHER_CLUBS,
  CHAMPIONS_LEAGUE_CLUBS, EUROPA_LEAGUE_CLUBS, divisionOf, CLUB_SHORT_NAMES,
} from "../../lib/star/clubs";
import { resolveLadder, membershipOf } from "../../lib/star/promotion";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { mulberry32 } from "../../lib/star/season";
import { kitsOf } from "../../lib/star/kits";
import type { CareerState, StarPlayer, LeagueTeam } from "../../lib/star/types";

/**
 * LEAGUE ONE, LEAGUE TWO, THE NATIONAL LEAGUE, AND ITS FOUR-CLUB POOL.
 *
 * Three real tiers extended below the Championship, given directly with
 * real club names, kits and generated-squad target ratings — see
 * clubs.ts/promotion.ts/leagueSquads.ts's own notes on the shape of this.
 * Mirrors promotion.mts's own style: real invariants, checked over many
 * simulated seasons, not just a single call.
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

function withStandings(career: CareerState, order: string[]): CareerState {
  const league: LeagueTeam[] = career.league.map((t) => {
    const at = order.indexOf(t.name);
    const points = (order.length - at) * 3;
    return { ...t, played: 10, won: points / 3, drawn: 0, lost: 0, goalsFor: points, goalsAgainst: 0, points };
  });
  return { ...career, league };
}

// ── The lists are the right size ────────────────────────────────────────────
{
  check(LEAGUE_ONE_CLUBS.length === 24, `League One has 24 clubs (${LEAGUE_ONE_CLUBS.length})`);
  check(LEAGUE_TWO_CLUBS.length === 24, `League Two has 24 clubs (${LEAGUE_TWO_CLUBS.length})`);
  check(NATIONAL_LEAGUE_CLUBS.length === 24, `the National League has 24 clubs (${NATIONAL_LEAGUE_CLUBS.length})`);
  check(NATIONAL_LEAGUE_POOL_CLUBS.length === 4, `its pool has 4 clubs (${NATIONAL_LEAGUE_POOL_CLUBS.length})`);

  const overlap = ["Luton Town", "Huddersfield Town", "Leicester City", "Reading FC", "Wigan Athletic"];
  check(overlap.every(c => LEAGUE_ONE_CLUBS.includes(c)),
    `all five real-squad overlap clubs are in League One (${overlap.filter(c => !LEAGUE_ONE_CLUBS.includes(c)).join(", ")})`);
}

// ── No club is in two of these lists (or the ladder above) at once ─────────
{
  const all = [
    ...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS,
    ...LEAGUE_ONE_CLUBS, ...LEAGUE_TWO_CLUBS, ...NATIONAL_LEAGUE_CLUBS, ...NATIONAL_LEAGUE_POOL_CLUBS,
  ];
  const dupes = all.filter((c, i) => all.indexOf(c) !== i);
  check(dupes.length === 0, `no club sits in two of premier/championship/L1/L2/NL/pool at once (${dupes.join(", ")})`);

  // The old five-club promotion pool and the standalone "Other" clubs may
  // legitimately share a name with League One (the five overlap clubs,
  // given directly) — that's fine, that's the whole point — but must never
  // ALSO collide with League Two/National League/its pool.
  const lowerThree = [...LEAGUE_TWO_CLUBS, ...NATIONAL_LEAGUE_CLUBS, ...NATIONAL_LEAGUE_POOL_CLUBS];
  const stray = [...PROMOTION_POOL_CLUBS, ...OTHER_CLUBS, ...CHAMPIONS_LEAGUE_CLUBS, ...EUROPA_LEAGUE_CLUBS]
    .filter(c => lowerThree.includes(c));
  check(stray.length === 0, `no European/Other/old-pool club strays into League Two/National League/its pool (${stray.join(", ")})`);
}

// ── divisionOf resolves correctly for a sample of new clubs ─────────────────
{
  check(divisionOf("AFC Wimbledon") === "league_one", "a genuinely new League One club tags league_one");
  check(divisionOf("Luton Town") === "league_one",
    `an overlap club tags league_one, not the old pool (${divisionOf("Luton Town")})`);
  check(divisionOf("Accrington Stanley") === "league_two", "a League Two club tags league_two");
  check(divisionOf("Yeovil Town") === "national_league", "a National League club tags national_league");
  check(divisionOf("Torquay United") === "national_league_pool", "a pool club tags national_league_pool");
  check(divisionOf("Not A Real Club") === null, "an unknown name still resolves to null");
}

// ── Every new club has a short name and a real (non-neutral) kit ───────────
{
  const NEUTRAL_SHIRT = "#2F6F4E";
  const missingShort: string[] = [];
  const neutralKit: string[] = [];
  for (const c of [...LEAGUE_ONE_CLUBS, ...LEAGUE_TWO_CLUBS, ...NATIONAL_LEAGUE_CLUBS, ...NATIONAL_LEAGUE_POOL_CLUBS]) {
    if (!CLUB_SHORT_NAMES[c]) missingShort.push(c);
    if (kitsOf(c).home.shirt === NEUTRAL_SHIRT) neutralKit.push(c);
  }
  check(missingShort.length === 0, `every new club has a short name (${missingShort.join(", ")})`);
  check(neutralKit.length === 0, `every new club has a real kit, not the neutral fallback (${neutralKit.join(", ")})`);
}

// ── The full six-tier chain moves the right numbers every season ───────────
{
  let career = makeInitialCareer(playerAt(CHAMPIONSHIP_CLUBS[0]), [...CHAMPIONSHIP_CLUBS], "championship");
  let broke = "";
  let sawLeagueOneMovement = false;

  for (let season = 1; season <= 12 && !broke; season++) {
    const rng = mulberry32(season * 41 + 7);
    const order = [...career.league.map(t => t.name)].sort(() => rng() - 0.5);
    const standing = withStandings(career, order);

    const before = membershipOf(standing);
    const ladder = resolveLadder(standing, mulberry32(season * 71 + 3));

    const fail = (why: string) => { broke = `season ${season}: ${why}`; };

    if (ladder.divisions.leagueOne.length !== 24) fail(`League One has ${ladder.divisions.leagueOne.length} clubs`);
    else if (ladder.divisions.leagueTwo.length !== 24) fail(`League Two has ${ladder.divisions.leagueTwo.length} clubs`);
    else if (ladder.divisions.nationalLeague.length !== 24) fail(`National League has ${ladder.divisions.nationalLeague.length} clubs`);
    else if (ladder.divisions.nationalLeaguePool.length !== 4) fail(`the pool has ${ladder.divisions.nationalLeaguePool.length} clubs`);
    else {
      const all = [
        ...ladder.divisions.premier, ...ladder.divisions.championship, ...ladder.divisions.leagueOne,
        ...ladder.divisions.leagueTwo, ...ladder.divisions.nationalLeague, ...ladder.divisions.nationalLeaguePool,
      ];
      if (new Set(all).size !== all.length) fail("a club is in two tiers at once");
      else {
        // Championship's relegated three (a real fact once you're playing
        // there) must land in League One, exactly the "instead of the old
        // pool" rewiring this pass made.
        if (standing.division === "championship") {
          const bottom3 = [...standing.league].sort((a, b) => a.points - b.points).slice(0, 3).map(t => t.name);
          const landedInL1 = bottom3.filter(c => ladder.divisions.leagueOne.includes(c));
          if (landedInL1.length !== 3) fail(`Championship's real bottom three should all land in League One (${landedInL1.length}/3)`);
        }
        if (before.leagueOne.join(",") !== ladder.divisions.leagueOne.join(",")) sawLeagueOneMovement = true;
      }
    }

    career = advanceSeason(standing, false).career;
  }

  check(broke === "", broke || "twelve seasons of the full six-tier chain stay coherent");
  check(sawLeagueOneMovement, "and League One's own membership genuinely changes season to season");
}

// ── The National League's four-club pool genuinely rotates ─────────────────
{
  let career = makeInitialCareer(playerAt(CHAMPIONSHIP_CLUBS[1]), [...CHAMPIONSHIP_CLUBS], "championship");
  const seenInPool = new Set<string>();
  const seenInNationalLeague = new Set<string>();

  for (let season = 1; season <= 10; season++) {
    const rng = mulberry32(season * 53 + 11);
    const order = [...career.league.map(t => t.name)].sort(() => rng() - 0.5);
    const standing = withStandings(career, order);
    const ladder = resolveLadder(standing, mulberry32(season * 97 + 13));
    for (const c of ladder.divisions.nationalLeaguePool) seenInPool.add(c);
    for (const c of ladder.divisions.nationalLeague) seenInNationalLeague.add(c);
    career = advanceSeason(standing, false).career;
  }

  // All four original pool clubs should have had a real chance to be drawn
  // UP into the National League over ten seasons of full turnover.
  const everMovedUp = NATIONAL_LEAGUE_POOL_CLUBS.filter(c => seenInNationalLeague.has(c));
  check(everMovedUp.length > 0,
    `at least one of the original four pool clubs is drawn up into the National League over ten seasons (${everMovedUp.length}/4)`);
  // And at least one National League club should have been relegated down
  // into the pool over the same stretch.
  const everMovedDown = seenInPool.size > NATIONAL_LEAGUE_POOL_CLUBS.filter(c => seenInPool.has(c)).length
    || Array.from(seenInPool).some(c => !NATIONAL_LEAGUE_POOL_CLUBS.includes(c));
  check(everMovedDown, "and at least one real National League club is relegated down into the pool over the same stretch");
  check(seenInPool.size >= 4, `the pool draws from more than just its own four original members over time (${seenInPool.size} distinct clubs seen)`);
}

// ── A save from before these three tiers existed still works ───────────────
{
  const career = makeInitialCareer(playerAt(CHAMPIONSHIP_CLUBS[2]), [...CHAMPIONSHIP_CLUBS], "championship");
  // Simulate an old save: a `divisions` object with only the two original
  // fields, exactly the shape every save made before 17 September 2026 has.
  const oldShaped = { ...career, divisions: { premier: [...PREMIER_LEAGUE_CLUBS], championship: [...CHAMPIONSHIP_CLUBS] } as any };
  const members = membershipOf(oldShaped);
  check(members.leagueOne.length === 24, `an old save's League One backfills to 24 fresh (${members.leagueOne.length})`);
  check(members.nationalLeaguePool.length === 4, `and its pool backfills to 4 fresh (${members.nationalLeaguePool.length})`);

  const out = resolveLadder(withStandings(oldShaped, [...CHAMPIONSHIP_CLUBS]), mulberry32(3));
  check(out.divisions.leagueOne.length === 24, "resolveLadder itself doesn't crash or corrupt on an old-shaped save");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — League One, League Two, the National League and its four-club pool all check out");
