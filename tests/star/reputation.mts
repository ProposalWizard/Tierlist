import { clampReputation, nudgeReputation, worldReputationFromSeason, clubReputationFromSeason } from "../../lib/star/reputation";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { judgeSeason } from "../../lib/star/expectations";
import { seasonAwards } from "../../lib/star/recognition";
import { TROPHY_FAME } from "../../lib/star/rating";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer, LeagueTeam } from "../../lib/star/types";

/**
 * REPUTATION IS A REAL, MULTI-PART STAT — NOT ONE NUMBER.
 *
 * Phase 1 of STAR_POWER_POLITICS.md, ships on its own: world/club/government/
 * shareholder standing exist as real `CareerState.reputation` fields, and two
 * of them have a real (if modest) hook into things that already happen every
 * season — winning silverware nudges world reputation, and the board's own
 * end-of-season verdict (the same one that already moves the boss relationship)
 * nudges club reputation. No voting engine reads this yet — that's Phase 2 and
 * beyond. This file checks the stat exists, is bounded, and that the two hooks
 * actually fire off the real `advanceSeason` path, not just in isolation.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

/** Give the table a real, separated finishing order — same helper shape as
 *  tests/star/promotion.mts's `withStandings`. */
function withStandings(career: CareerState, order: string[]): CareerState {
  const league: LeagueTeam[] = career.league.map((t) => {
    const at = order.indexOf(t.name);
    const points = (order.length - at) * 3;
    return { ...t, played: 38, won: points / 3, drawn: 0, lost: 0, goalsFor: points * 2, goalsAgainst: 5, points };
  });
  return { ...career, league };
}

// ── clampReputation stays inside 0-100, and rounds ──────────────────────────
{
  check(clampReputation(-40) === 0, "a negative value floors at 0");
  check(clampReputation(140) === 100, "an over-100 value caps at 100");
  check(clampReputation(55.6) === 56, "an in-range value rounds rather than truncating");
  check(clampReputation(0) === 0 && clampReputation(100) === 100, "the boundaries themselves survive untouched");
}

// ── nudgeReputation only moves the keys it's given, and clamps each one ─────
{
  const rep = { world: 50, club: 50, government: 50, shareholders: 50 };
  const out = nudgeReputation(rep, { world: 10, club: -200 });
  check(out.world === 60, `world moves by exactly its own delta (saw ${out.world})`);
  check(out.club === 0, `club clamps at the floor rather than going negative (saw ${out.club})`);
  check(out.government === 50 && out.shareholders === 50, "keys not mentioned in the change set are left untouched");
  check(nudgeReputation(rep, {}) .world === 50, "an empty change set changes nothing");
}

// ── worldReputationFromSeason scales trophyFame/honourFame down, never up ──
{
  check(worldReputationFromSeason(0, 0) === 0, "no silverware, no world reputation gain");
  const plGain = worldReputationFromSeason(TROPHY_FAME["Premier League"], 0);
  check(plGain > 0 && plGain < TROPHY_FAME["Premier League"],
    `a Premier League title is worth some world reputation, but far less than its raw fame value (saw ${plGain} vs fame ${TROPHY_FAME["Premier League"]})`);
  const honourOnly = worldReputationFromSeason(0, 4);
  check(honourOnly === 1, `a single individual honour (fame 4) is worth roughly one point of world reputation (saw ${honourOnly})`);
}

// ── clubReputationFromSeason moves with the same sign as the season's score,
//    but at a smaller, independent scale from the boss relationship's bossChange ──
{
  check(clubReputationFromSeason(0) === 0, "an exactly-as-expected season moves club reputation by nothing");
  check(clubReputationFromSeason(1) === 8, `the best possible season season (+1) is worth 8, not bossChange's own 18 (saw ${clubReputationFromSeason(1)})`);
  check(clubReputationFromSeason(-1) === -8, `the worst possible season (-1) costs the same 8, the other way (saw ${clubReputationFromSeason(-1)})`);
  check(clubReputationFromSeason(0.5) === Math.round(0.5 * 8), "the mapping is linear in between");
}

// ── A brand-new career starts with a real, bounded, sensible reputation ────
{
  const career = makeInitialCareer(player("Arsenal"), [...PREMIER_LEAGUE_CLUBS], "premier");
  const rep = career.reputation;
  for (const key of ["world", "club", "government", "shareholders"] as const) {
    check(rep[key] >= 0 && rep[key] <= 100, `${key} starts inside 0-100 (saw ${rep[key]})`);
  }
  check(rep.world < 50, `a trialist is unknown to the wider football world (saw world=${rep.world})`);
  check(rep.club >= 40, `a fresh signing gets a fair, not-hostile club welcome (saw club=${rep.club})`);
}

// ── Winning the league for real, through advanceSeason, nudges world AND
//    club reputation upward — not just in the isolated formula above ────────
{
  const clubs = [...PREMIER_LEAGUE_CLUBS];
  const order = [...clubs]; // your club (order[0]) finishes top
  let career = withStandings(makeInitialCareer(player(order[0]), clubs, "premier"), order);
  // A league title this season, exactly as awardLeagueTrophyIfWon would have
  // already recorded it by the time advanceSeason runs for real.
  career = { ...career, trophies: [...career.trophies, { season: career.season, competition: "Premier League", club: order[0] }] };

  const judgement = judgeSeason(career);
  const honours = seasonAwards(career);
  const trophyFame = TROPHY_FAME["Premier League"];
  const honourFame = honours.length * 4;
  const expectedWorld = clampReputation(career.reputation.world + worldReputationFromSeason(trophyFame, honourFame));
  const expectedClub = clampReputation(career.reputation.club + clubReputationFromSeason(judgement.score));

  const before = career.reputation;
  const after = advanceSeason(career, false).career.reputation;

  check(after.world === expectedWorld, `world reputation matches the real advanceSeason hook exactly (saw ${after.world}, expected ${expectedWorld})`);
  check(after.club === expectedClub, `club reputation matches the real advanceSeason hook exactly (saw ${after.club}, expected ${expectedClub})`);
  check(after.world > before.world, `winning the league actually raised world reputation (before ${before.world}, after ${after.world})`);
  check(after.government === before.government && after.shareholders === before.shareholders,
    "government and shareholder reputation have no hook yet, and correctly don't move on their own");
}

// ── A relegation-form season through advanceSeason nudges club reputation
//    down, never below the floor ────────────────────────────────────────────
{
  const clubs = [...PREMIER_LEAGUE_CLUBS];
  // A big, high-expectation club (Arsenal) finishing dead last is a crisis at
  // ANY club's own standards — reversing the whole table (as the "winning the
  // league" block above does forwards) can land your club somewhere whose
  // own expectations are modest enough to read the same finish as "about as
  // expected," which is the wrong fixture for this test.
  const order = clubs.filter(c => c !== "Arsenal");
  order.push("Arsenal");
  const career = withStandings(makeInitialCareer(player("Arsenal"), clubs, "premier"), order);
  const judgement = judgeSeason(career);
  check(judgement.score < 0, "finishing bottom really is judged as a bad season (sanity check on the fixture)");

  const after = advanceSeason(career, false).career.reputation;
  check(after.club < career.reputation.club, `a bad season lowers club reputation (before ${career.reputation.club}, after ${after.club})`);
  check(after.club >= 0, `club reputation never goes below the floor even after a disastrous season (saw ${after.club})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — world/club/government/shareholder reputation is real, bounded, and moves off the season it just had");
