import {
  makeInitialCareer, creditMatchResult, simulateMissedFixture, advanceSeason,
  ENERGY_MATCH_COST, INJURY_RISK_BASE, INJURY_FATIGUE_FLOOR, INJURY_RISK_FATIGUE_EXTRA,
} from "../../lib/star/careerFlow";
import { MISSED_WEEK } from "../../lib/star/selection";
import { WEEK_ACTIONS, REST_ENERGY } from "../../lib/star/week";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, Fixture, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * ENERGY, spent and earned back — and the injuries fatigue makes more
 * likely.
 *
 * The arithmetic under test: a match costs energy in proportion to the
 * minutes actually played, a replayed fixture never spends it twice, a week
 * off gives some back, a new season resets it, and injury risk is a real but
 * rare thing that climbs sharply once you are running on empty. See
 * tests/star/week.mts (Rest/Skip regen, the "legs" hook reason) and
 * tests/star/selection.mts (the two hard gates on team selection, and the
 * "Injured" status override) for the rest of the system.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, position: "ST",
    club: "Arsenal", nationality: "England",
  } as StarPlayer;
}

const base = () => makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);

function stats(over: Partial<MatchStats>): MatchStats {
  return {
    chances: 3, goals: 0, assists: 0, passes: 8, rating: 7.0, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
    sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0,
    ...over,
  };
}

function firstFixture(c: CareerState): Fixture {
  return c.fixtures.find(f => (f.kind ?? "league") === "league" && !f.played)!;
}

// ── A fresh career starts full, uninjured ───────────────────────────────────
{
  const c = base();
  check(c.energy === 100, `a new career starts at full energy (${c.energy})`);
  check(c.injury === null, "and with nothing wrong with him");
}

// ── A full ninety costs the full amount; a cameo costs less ────────────────
{
  const c = base();
  const full = creditMatchResult(c, firstFixture(c), stats({ minutes: 90 })).career;
  check(full.energy === 100 - ENERGY_MATCH_COST, `a full match costs the full amount (${full.energy})`);

  const c2 = base();
  const cameo = creditMatchResult(c2, firstFixture(c2), stats({ minutes: 20 })).career;
  const expectedShare = Math.max(0.25, 20 / 90);
  check(cameo.energy === 100 - Math.round(ENERGY_MATCH_COST * expectedShare),
    `twenty minutes costs proportionally less (${cameo.energy})`);
  check(cameo.energy > full.energy, "…and less than a full ninety");
}

// ── Energy cannot go negative ────────────────────────────────────────────────
// weekActions: 0 isolates this from the unspent-actions fairness credit below —
// this block is testing the floor itself, not that credit.
{
  let c: CareerState = { ...base(), energy: 5, weekActions: 0 };
  c = creditMatchResult(c, firstFixture(c), stats({ minutes: 90 })).career;
  check(c.energy === 0, `it floors at zero rather than going negative (${c.energy})`);
}

// ── Unspent actions credit the same energy Rest would have given ───────────
{
  const untouched: CareerState = { ...base(), energy: 5 };
  const credited = creditMatchResult(untouched, firstFixture(untouched), stats({ minutes: 90 })).career;
  const expected = Math.min(100, 5 + WEEK_ACTIONS * REST_ENERGY) - ENERGY_MATCH_COST;
  check(credited.energy === expected,
    `three unspent actions are worth three Rests before the match's own cost (${credited.energy}, expected ${expected})`);

  const partial: CareerState = { ...base(), energy: 5, weekActions: 1 };
  const partialCredited = creditMatchResult(partial, firstFixture(partial), stats({ minutes: 90 })).career;
  const partialExpected = Math.max(0, Math.min(100, 5 + 1 * REST_ENERGY) - ENERGY_MATCH_COST);
  check(partialCredited.energy === partialExpected,
    `only the actions actually left unspent are credited (${partialCredited.energy}, expected ${partialExpected})`);
}

// ── A replayed fixture does not spend the budget twice ──────────────────────
{
  const c = base();
  const f = firstFixture(c);
  const once = creditMatchResult(c, f, stats({ minutes: 90 })).career;
  const playedFixture = once.fixtures.find(x => x.week === f.week && (x.kind ?? "league") === "league")!;
  const twice = creditMatchResult(once, playedFixture, stats({ minutes: 90 })).career;
  check(twice.energy === once.energy, `re-crediting the same match does not drain it again (${once.energy} vs ${twice.energy})`);
}

// ── A week off gives some back; a new season resets it entirely ────────────
{
  const c: CareerState = { ...base(), energy: 40 };
  const missed = simulateMissedFixture(c, firstFixture(c)).career;
  check(missed.energy === 40 + MISSED_WEEK.energy, `sitting a week out is worth something (${missed.energy})`);
  check(missed.energy <= 100, "…but still respects the cap");

  const tired: CareerState = { ...base(), energy: 12, matchFitness: 40 };
  const { career: rolled } = advanceSeason(tired, false);
  check(rolled.energy === 100, `a summer off resets it completely (${rolled.energy})`);
}

// ── A season carrying an injury clears it at rollover ───────────────────────
{
  const hurt: CareerState = { ...base(), injury: { weeksRemaining: 4, note: "Test knock" } };
  const { career: rolled } = advanceSeason(hurt, false);
  check(rolled.injury === null, "nobody carries a knock into a new season untreated");
}

// ── Injury risk: rare when fresh, real but not certain when running on empty ─
{
  const rng = (seed: number) => {
    let a = seed | 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const trials = (endEnergy: number, n: number) => {
    let hurt = 0;
    for (let i = 0; i < n; i++) {
      const c = { ...base(), season: i + 1 };
      const f = firstFixture(c);
      const after = creditMatchResult(c, f, stats({ minutes: 90, endEnergy })).career;
      if (after.injury) hurt++;
    }
    return hurt / n;
  };

  const freshRate = trials(90, 1500);
  check(Math.abs(freshRate - INJURY_RISK_BASE) < 0.015,
    `a fresh player's injury rate matches the base risk (${(freshRate * 100).toFixed(2)}% vs ${(INJURY_RISK_BASE * 100).toFixed(2)}%)`);

  const exhaustedRate = trials(0, 1500);
  const expectedExhausted = INJURY_RISK_BASE + INJURY_RISK_FATIGUE_EXTRA;
  check(Math.abs(exhaustedRate - expectedExhausted) < 0.02,
    `running on empty matches the modelled ceiling (${(exhaustedRate * 100).toFixed(2)}% vs ${(expectedExhausted * 100).toFixed(2)}%)`);
  check(exhaustedRate > freshRate * 3, `fatigue is a real multiplier on the risk, not a token one (${freshRate.toFixed(3)} → ${exhaustedRate.toFixed(3)})`);
  check(exhaustedRate < 0.9, "…but it is still a risk, not a certainty");

  const atFloor = trials(INJURY_FATIGUE_FLOOR, 1500);
  check(Math.abs(atFloor - INJURY_RISK_BASE) < 0.015,
    `exactly at the fatigue floor is no different from fresh (${(atFloor * 100).toFixed(2)}%)`);

  check(rng(1)() >= 0, "the local rng helper is used");
}

// ── An injury forces you out, and the duration is weighted toward a knock ──
{
  let minor = 0, medium = 0, major = 0, n = 0;
  for (let i = 0; i < 4000 && n < 300; i++) {
    const c = { ...base(), season: i + 1 };
    const f = firstFixture(c);
    const after = creditMatchResult(c, f, stats({ minutes: 90, endEnergy: 0 })).career;
    if (!after.injury) continue;
    n++;
    const w = after.injury.weeksRemaining;
    check(w >= 1, `an injury always costs at least a week (${w})`);
    if (w <= 2) minor++; else if (w <= 4) medium++; else major++;
  }
  check(n > 100, `enough injuries landed to measure the split (${n})`);
  check(minor > medium && medium > major,
    `weighted toward a knock over a lay-off (${minor} minor, ${medium} medium, ${major} major)`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — energy is spent by playing and earned back by choice, and fatigue is a real injury risk");
