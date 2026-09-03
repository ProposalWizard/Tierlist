import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { attributeOverall, computeStarRating, displayOverall, growthMultiplier, TROPHY_FAME } from "../../lib/star/rating";
import type { CareerState, MatchStats, StarPlayer, Skills } from "../../lib/star/types";

/**
 * ONE OVERALL, DERIVED FROM WHAT'S ACTUALLY REAL.
 *
 * Requested directly: stop nudging `starRating` as its own scalar and
 * derive it from `career.skills` instead — the way a real player's rating
 * is built from attributes — folding in trophies, individual honours, real
 * records beaten and a body of career stats too, since those are what a
 * real football reputation is actually built from. One shared formula
 * (rating.ts), read everywhere instead of three screens each inventing
 * their own linear map off the same number.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United",
  "Burnley", "Sunderland",
];

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 22, position: "ST",
    club: "Liverpool", nationality: "England", startYear: 2027, skinTone: "light",
    clubBadge: null, ...overrides,
  } as StarPlayer;
}

const fresh = () => makeInitialCareer(player(), CLUBS);

const MAXED_SKILLS: Skills = { pace: 100, power: 100, technique: 100, vision: 100, freeKick: 100 };
const EMPTY_SKILLS: Skills = { pace: 0, power: 0, technique: 0, vision: 0, freeKick: 0 };

// ── attributeOverall: a weighted average that sums correctly ───────────────
{
  check(attributeOverall(MAXED_SKILLS) === 100, `every skill maxed reaches exactly 100 (${attributeOverall(MAXED_SKILLS)})`);
  check(attributeOverall(EMPTY_SKILLS) === 0, "nothing trained reaches exactly 0");
  const flat50: Skills = { pace: 50, power: 50, technique: 50, vision: 50, freeKick: 50 };
  check(attributeOverall(flat50) === 50, `a flat 50 across the board is 50 regardless of weighting (${attributeOverall(flat50)})`);
}

// ── computeStarRating: floor, ceiling, and a fresh career reads as "young" ──
{
  const c = fresh();
  check(c.starRating >= 0.5 && c.starRating < 2.5,
    `a brand new career reads as unproven — low, not the old fixed 2.5 (${c.starRating.toFixed(2)})`);

  const maxed: CareerState = { ...c, skills: MAXED_SKILLS };
  check(computeStarRating(maxed) === 5, `every skill maxed alone reaches the full 5★ ceiling (${computeStarRating(maxed)})`);

  const nothing: CareerState = { ...c, skills: EMPTY_SKILLS, trophies: [], achievements: [], ballonDorWins: 0 };
  check(computeStarRating(nothing) === 0.5, `nothing trained, nothing won, floors at 0.5 rather than 0 (${computeStarRating(nothing)})`);
}

// ── Trophies, honours, records and a body of work all move the rating ──────
{
  const c = fresh();
  const baseline = computeStarRating(c);

  const withTitle: CareerState = { ...c, trophies: [{ season: 1, competition: "Premier League", club: c.player.club }] };
  check(computeStarRating(withTitle) > baseline, "a league title lifts the rating above the same-skilled baseline");

  const withBallonDor: CareerState = { ...c, ballonDorWins: 1 };
  check(computeStarRating(withBallonDor) > baseline, "a Ballon d'Or lifts it too");

  const withAchievements: CareerState = { ...c, achievements: [...c.achievements, "first-goal", "first-assist", "hat-trick"] };
  check(computeStarRating(withAchievements) > baseline, "and achievements, a little each");

  const record: CareerState = {
    ...c,
    careerLeagueStats: { goals: 260, assists: 50, appearances: 653 },
  };
  check(computeStarRating(record) > baseline, "a real Premier League career record beaten lifts it noticeably");

  const prolific: CareerState = { ...c, careerStats: { ...c.careerStats, goals: 200, assists: 100, appearances: 400 } };
  check(computeStarRating(prolific) > baseline, "a big body of career stats lifts it even without a single trophy");

  // The honours side is capped — a legend with everything still cannot
  // outweigh actually having trained the attributes.
  const everything: CareerState = {
    ...c,
    skills: EMPTY_SKILLS,
    trophies: Array.from({ length: 20 }, (_, i) => ({ season: i + 1, competition: "Premier League", club: c.player.club })),
    ballonDorWins: 10,
    achievements: [...c.achievements, "first-goal", "first-assist", "hat-trick", "10-goals", "50-goals", "100-goals"],
    careerLeagueStats: { goals: 260, assists: 50, appearances: 653 },
    careerStats: { ...c.careerStats, goals: 500, assists: 300, appearances: 700 },
  };
  check(computeStarRating(everything) < 2, `honours alone, on zero attributes, cannot reach a real rating (${computeStarRating(everything).toFixed(2)})`);
}

// ── TROPHY_FAME: still the one table careerFlow.ts's fame gain reads ───────
{
  check(TROPHY_FAME["Premier League"] === 25, "a title is still worth the most fame");
  check(TROPHY_FAME["Community Shield"] === 4, "…and a Community Shield the least of the named ones");
}

// ── displayOverall: one shared 0-100 scale, monotonic with starRating ──────
{
  check(displayOverall(0) === 30, `the floor reads as a real, if raw, prospect (${displayOverall(0)})`);
  check(displayOverall(5) === 100, `the ceiling is a genuine 100 (${displayOverall(5)})`);
  check(displayOverall(2.5) > displayOverall(1) && displayOverall(4) > displayOverall(2.5),
    "strictly increasing with star rating");
}

// ── growthMultiplier: young players develop faster, veterans plateau ───────
{
  check(growthMultiplier(18) > growthMultiplier(25), "a teenager grows faster than a player in his prime");
  check(growthMultiplier(25) > growthMultiplier(33), "…who in turn grows faster than a player past 31");
  check(growthMultiplier(33) > 0, "even a veteran keeps SOME ability to sharpen — never zero");
}

// ── creditMatchResult: a great performance grows skills, not a bare scalar ─
{
  const c = { ...fresh(), player: { ...fresh().player, age: 19 } };
  const fixture = c.fixtures.find(f => !f.played)!;
  const great: MatchStats = {
    chances: 4, goals: 2, assists: 1, passes: 30, rating: 8.5, starMan: true,
    bossChange: 5, teamChange: 3, fansChange: 8, wage: 1, goalBonus: 2,
    sponsorPay: 0, totalCash: 3, homeScore: 2, awayScore: 1, minutes: 90,
  };
  const { career: after } = creditMatchResult(c, fixture, great);
  check(after.skills.technique > c.skills.technique,
    `an 8.5-rated performance sharpens real attributes, not a separate number (${c.skills.technique} -> ${after.skills.technique})`);
  check(after.starRating > c.starRating,
    `…and the rating itself reads that straight back out (${c.starRating.toFixed(2)} -> ${after.starRating.toFixed(2)})`);

  // A replayed match must not double-credit the growth.
  const { career: replayed } = creditMatchResult(after, { ...fixture, played: false }, great);
  check(replayed.skills.technique === after.skills.technique, "a replay of the same result grants nothing a second time");
}

// ── advanceSeason: aging can pull the rating back down even as honours grow ─
{
  const veteran: CareerState = {
    ...fresh(),
    player: { ...fresh().player, age: 33 },
    skills: { pace: 90, power: 85, technique: 70, vision: 70, freeKick: 50 },
  };
  const beforeRating = computeStarRating(veteran);
  const { career: after } = advanceSeason(veteran, false);
  // Pace/power decay past 30 (careerFlow.ts's ageEffect) — with nothing won
  // this season to offset it, the derived rating should not have risen.
  check(after.skills.pace < veteran.skills.pace, "pace decays for a 34-year-old, same as it always has");
  check(after.starRating <= beforeRating + 0.05,
    `aging decay is reflected in the rating, not masked by it (${beforeRating.toFixed(2)} -> ${after.starRating.toFixed(2)})`);

  // A trophy THIS rollover should still be able to outweigh a modest decay.
  const champion: CareerState = {
    ...veteran,
    trophies: [{ season: veteran.season, competition: "Premier League", club: veteran.player.club }],
  };
  const { career: afterTitle } = advanceSeason(champion, true);
  check(afterTitle.starRating > after.starRating,
    "…but winning the league that same season still lifts you above the plain-decay case");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — one overall, derived from skills, trophies, honours, records and a body of work");
