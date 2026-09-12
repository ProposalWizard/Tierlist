import { playerMarketValue } from "../../lib/star/marketValue";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { StarPlayer } from "../../lib/star/types";

/**
 * MARKET VALUE — A REAL ESTIMATE, NOT AN ARBITRARY NUMBER.
 *
 * Requested directly: a value based on overall, age, potential tier, and a
 * small club-reputation tilt, that a real transfer fee should land AROUND.
 * These checks are about the SHAPE holding up — a better player is worth
 * more, a young player with potential is worth more than an old one at the
 * same rating, and nothing produces a negative or absurd number.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 20, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

const career = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
const club = career.league[0].name;

// ── A better player is worth more ───────────────────────────────────────
{
  const low = playerMarketValue({ overall: 65, age: 25 }, club, career);
  const mid = playerMarketValue({ overall: 78, age: 25 }, club, career);
  const high = playerMarketValue({ overall: 90, age: 25 }, club, career);
  check(low < mid && mid < high, `value climbs with overall (${low} < ${mid} < ${high})`);
  // Steeper at the top than the bottom — the whole point of the exponential curve.
  check((high - mid) > (mid - low), `the gap at the top of the scale is bigger than the gap in the middle (${high - mid} vs ${mid - low})`);
}

// ── Age: prime years, youth premium, decline past 28 ────────────────────
{
  const veryYoung = playerMarketValue({ overall: 80, age: 18 }, club, career);
  const prime = playerMarketValue({ overall: 80, age: 25 }, club, career);
  const veteran = playerMarketValue({ overall: 80, age: 35 }, club, career);
  check(veryYoung > prime, `an 18-year-old is worth more than a 25-year-old at the same overall (${veryYoung} vs ${prime})`);
  check(prime > veteran, `a 25-year-old is worth more than a 35-year-old at the same overall (${prime} vs ${veteran})`);
  check(veteran > 0, "a veteran still has some real value, never zero or negative");
}

// ── Potential tiers, and the tag mattering less the older the player ────
{
  const none = playerMarketValue({ overall: 78, age: 19 }, club, career);
  const high = playerMarketValue({ overall: 78, age: 19, highPotential: true }, club, career);
  const worldClass = playerMarketValue({ overall: 78, age: 19, worldClassPotential: true }, club, career);
  check(none < high, `High Potential adds real value at 19 (${none} vs ${high})`);
  check(high < worldClass, `World Class Potential is worth more than High Potential at the same age (${high} vs ${worldClass})`);

  const highOld = playerMarketValue({ overall: 78, age: 32, highPotential: true }, club, career);
  const noneOld = playerMarketValue({ overall: 78, age: 32 }, club, career);
  const premiumYoung = high - none;
  const premiumOld = highOld - noneOld;
  check(premiumOld < premiumYoung, `the potential premium is much smaller on a 32-year-old than a 19-year-old (${premiumOld} vs ${premiumYoung})`);
}

// ── Never negative, never absurd for a real-world number range ─────────
{
  const worstCase = playerMarketValue({ overall: 40, age: 39 }, club, career);
  check(worstCase > 0, `even a poor, old player has a positive value (${worstCase})`);
  const bestCase = playerMarketValue({ overall: 99, age: 17, worldClassPotential: true }, club, career);
  check(bestCase > worstCase * 10, `a genuine wonderkid is worth an order of magnitude more than a poor veteran (${bestCase} vs ${worstCase})`);
  check(Number.isFinite(bestCase) && Number.isFinite(worstCase), "values are always finite numbers");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — market value climbs steeply with rating, rewards youth and real potential, decays with age, and never goes negative or absurd");
