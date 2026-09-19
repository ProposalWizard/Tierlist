import { wageShareFor, wageForFixture } from "../../lib/star/wages";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";
import { dayFor, divisionOf } from "../../lib/star/calendar";
import type { CareerState, Fixture, StarPlayer } from "../../lib/star/types";

/**
 * A WAGE IS A WEEK'S WAGE.
 *
 * Paid at the weekend game if there is one, otherwise split across that
 * week's midweek games. The invariant that matters, and the one the old
 * behaviour broke: **the shares across any one week total exactly 1.**
 *
 * Before this, the wage was added once per fixture played AND once per
 * fixture missed, so a week with a midweek cup tie and a Saturday league
 * game paid two full weeks' wages. The test below that sweeps a whole real
 * season is the one that would have caught that.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027, ...overrides,
  };
}

const fx = (week: number, opponent: string, kind?: Fixture["kind"]): Fixture =>
  ({ week, opponent, home: true, played: false, ...(kind ? { kind } : {}) });

const withFixtures = (base: CareerState, fixtures: Fixture[]): CareerState =>
  ({ ...base, fixtures });

const premier = () => makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS], "premier");
const champ = () => makeInitialCareer(
  player({ club: CHAMPIONSHIP_CLUBS[0] }), [...CHAMPIONSHIP_CLUBS], "championship",
);

// ── One game in a week pays the whole week ───────────────────────────────
{
  const c = premier();
  const only = fx(3, "Chelsea");
  const one = withFixtures(c, [only]);
  check(wageShareFor(one, only) === 1, "a lone fixture in its week pays the full wage");
  check(
    wageForFixture(one, only) === c.contract.wage,
    "a lone fixture pays exactly the contract wage",
  );
}

// ── A weekend game takes the week; the midweek tie takes nothing ─────────
{
  const c = premier();
  const league = fx(5, "Chelsea");                 // Premier league week = Saturday
  const cup = fx(5, "Port Vale", "cup");
  const both = withFixtures(c, [league, cup]);

  const dLeague = dayFor(league.kind, league.week, divisionOf(both));
  check(dLeague === "saturday", `a Premier league fixture should be a Saturday, got ${dLeague}`);

  check(wageShareFor(both, league) === 1, "the weekend game pays the whole week");
  check(wageShareFor(both, cup) === 0, "a midweek tie in a week that has a weekend game pays nothing");
  check(
    near(wageShareFor(both, league) + wageShareFor(both, cup), 1),
    "a two-game week still totals exactly one week's wage",
  );
}

// ── No weekend game: split evenly across the midweek games ───────────────
{
  const c = premier();
  // Two midweek fixtures and deliberately no league game that week.
  const a = fx(9, "Ajax", "europe");
  const b = fx(9, "Port Vale", "cup");
  const midweekOnly = withFixtures(c, [a, b]);

  const days = [a, b].map(f => dayFor(f.kind, f.week, divisionOf(midweekOnly)));
  check(
    days.every(d => d !== "saturday"),
    `this fixture set should have no weekend game, got ${days.join("/")}`,
  );

  check(near(wageShareFor(midweekOnly, a), 0.5), "two midweek games split the week evenly");
  check(near(wageShareFor(midweekOnly, b), 0.5), "two midweek games split the week evenly");
  check(
    near(wageShareFor(midweekOnly, a) + wageShareFor(midweekOnly, b), 1),
    "a midweek-only week still totals exactly one week's wage",
  );
}

// ── Played or missed makes no difference — you're paid for the week ──────
{
  const c = premier();
  const league = fx(5, "Chelsea");
  const cup = fx(5, "Port Vale", "cup");
  const both = withFixtures(c, [league, cup]);
  const playedLeague = { ...league, played: true };

  check(
    wageShareFor(both, playedLeague) === wageShareFor(both, league),
    "whether a fixture was played does not change what it pays",
  );
}

// ── An unknown fixture is paid, not skipped ──────────────────────────────
{
  const c = withFixtures(premier(), [fx(2, "Chelsea")]);
  const stranger = fx(2, "A Club That Isn't In The List", "cup");
  check(
    wageShareFor(c, stranger) === 1,
    "a fixture the career doesn't know about is paid in full rather than paid nothing",
  );
}

// ── The real invariant, swept across a whole real season ─────────────────
//
// This is the test that would have caught the original bug: for every week
// that has any fixtures at all, the shares must sum to exactly one week.
for (const [label, make] of [["Premier", premier], ["Championship", champ]] as const) {
  const c = make();
  const weeks = new Set((c.fixtures ?? []).map(f => f.week));
  check(weeks.size > 0, `${label}: the season should have fixtures to sweep`);

  let bad = 0;
  let multi = 0;
  for (const w of weeks) {
    const inWeek = (c.fixtures ?? []).filter(f => f.week === w);
    if (inWeek.length > 1) multi++;
    const total = inWeek.reduce((sum, f) => sum + wageShareFor(c, f), 0);
    if (!near(total, 1)) bad++;
  }
  check(bad === 0, `${label}: ${bad} of ${weeks.size} weeks did not total exactly one week's wage`);

  // A season with no multi-fixture weeks would make this test vacuous.
  check(
    multi > 0,
    `${label}: expected at least one week with more than one fixture, or this sweep proves nothing`,
  );
}

// ── Money never exceeds a week's wage for a week ─────────────────────────
{
  const c = premier();
  const weeks = new Set((c.fixtures ?? []).map(f => f.week));
  let worst = 0;
  for (const w of weeks) {
    const inWeek = (c.fixtures ?? []).filter(f => f.week === w);
    const paid = inWeek.reduce((sum, f) => sum + wageForFixture(c, f), 0);
    worst = Math.max(worst, Math.abs(paid - c.contract.wage));
  }
  // Rounding each share independently can lose a unit or two on a split week.
  check(
    worst <= 2,
    `a week should pay one week's wage give or take rounding, worst drift was ${worst}`,
  );
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS  a week pays exactly one week's wage, however many games it has");
