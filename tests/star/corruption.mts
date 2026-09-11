import {
  bribeVote, rollCaught, applyGettingCaught, blackMarketPrice, exposureRisk,
  BASE_EXPOSURE_RISK, LAWYER_FEE, type CorruptAct,
} from "../../lib/star/corruption";
import { castVote, type VoteOption } from "../../lib/star/voting";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * CORRUPTION — PHASE 5 OF STAR_POWER_POLITICS.MD.
 *
 * §4.3's bribery, lawyers, and illegal-equipment black market, built as one
 * shared "risk of exposure → consequence" mechanic rather than three
 * separate systems. Checks: a bribe genuinely swings real votes but is
 * capped, never buying an outright landslide; lawyers genuinely cut the
 * risk of getting caught without ever removing it; getting caught applies
 * a real fine, a real world-reputation hit, damaged relationships, and a
 * real suspension — reusing `career.injury`'s own shape rather than a
 * second mechanic; and the black-market markup is real and consistent.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 25, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function freshCareer(overrides: Partial<CareerState> = {}): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, money: 1_000_000, ...overrides };
}

const YES_NO: VoteOption[] = [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }];

// ── bribeVote genuinely swings real votes, capped, never a landslide ──────
{
  const tally = castVote("Test?", YES_NO, 10000, "no", 0.8, mulberry32(1)); // "no" heavily favoured
  check(tally.winner === "no", "fixture assumption: 'no' really is winning before any bribe");

  const bribed = bribeVote(tally, "yes", 50000);
  check(bribed.counts.yes > tally.counts.yes, "a real bribe genuinely moves real votes toward the target");
  check(bribed.counts.no < tally.counts.no, "…taken from the option that actually had them");
  check(bribed.counts.yes + bribed.counts.no + bribed.abstentions === tally.electorate, "the whole electorate is still accounted for after a bribe");

  const hugeBribe = bribeVote(tally, "yes", 100_000_000);
  const moved = hugeBribe.counts.yes - tally.counts.yes;
  check(moved <= tally.electorate * 0.16, `even an enormous bribe is capped, not an outright landslide (moved ${moved} of ${tally.electorate})`);

  const zeroBribe = bribeVote(tally, "yes", 0);
  check(zeroBribe.counts.yes === tally.counts.yes, "a zero bribe changes nothing");

  const fakeOption = bribeVote(tally, "not-a-real-option", 10000);
  check(fakeOption.counts.yes === tally.counts.yes && fakeOption.counts.no === tally.counts.no, "bribing toward a non-existent option is a safe no-op");
}

// ── Lawyers genuinely cut exposure risk, but never to zero ────────────────
{
  for (const act of ["bribery", "blackMarket", "lawyers"] as CorruptAct[]) {
    const withoutLawyers = exposureRisk(act, false);
    const withLawyers = exposureRisk(act, true);
    check(withoutLawyers === BASE_EXPOSURE_RISK[act], `${act}'s baseline risk matches the named constant`);
    if (act !== "lawyers") {
      check(withLawyers < withoutLawyers, `hiring lawyers genuinely lowers ${act}'s risk (${withLawyers} vs ${withoutLawyers})`);
      check(withLawyers > 0, `…but never removes the risk entirely for ${act} (saw ${withLawyers})`);
    }
  }

  let caughtWithout = 0, caughtWith = 0;
  const trials = 300;
  for (let seed = 1; seed <= trials; seed++) {
    if (rollCaught("bribery", false, mulberry32(seed * 3 + 1))) caughtWithout++;
    if (rollCaught("bribery", true, mulberry32(seed * 3 + 1))) caughtWith++;
  }
  check(caughtWith < caughtWithout, `across many trials, lawyers really do reduce how often you're caught (with ${caughtWith}, without ${caughtWithout})`);
  check(caughtWith > 0, "…but being caught is still genuinely possible even with lawyers");
}

// ── Getting caught: a real, shared consequence ─────────────────────────────
{
  const career = freshCareer();
  const caught = applyGettingCaught(career, "bribery", 20000, "Caught bribing officials");
  check(caught.money < career.money, "getting caught genuinely costs real money");
  check(career.money - caught.money <= 50000, "…but the fine is capped, not unbounded");
  check(caught.reputation.world < career.reputation.world, "…and genuinely costs world reputation");
  check(caught.relationships.boss < career.relationships.boss, "…and damages your standing with the boss");
  check(caught.relationships.fans < career.relationships.fans, "…and damages your standing with fans");
  check(!!caught.injury && caught.injury.weeksRemaining > 0, "…and genuinely forces you out of the team for real weeks — a suspension");
  check(caught.injury!.note.length > 0, "…with a real reason recorded, not a blank note");

  const alreadyInjured = { ...career, injury: { weeksRemaining: 1, note: "A real injury, unrelated" } };
  const caughtToo = applyGettingCaught(alreadyInjured, "blackMarket", 5000, "Caught buying banned boots");
  check(caughtToo.injury === alreadyInjured.injury, "a genuine existing injury is never overwritten by a suspension stacking on top of it");

  const bigFine = applyGettingCaught({ ...career, money: 10 }, "bribery", 1_000_000, "x");
  check(bigFine.money === 0, "a fine bigger than your money floors at 0, never goes negative");
}

// ── Black market pricing: a real, consistent markup ────────────────────────
{
  check(blackMarketPrice(1000) > 1000, "the black market genuinely charges more than the legal price");
  check(blackMarketPrice(1000) === blackMarketPrice(500) * 2, "the markup is a consistent multiplier, not an arbitrary flat fee");
}

// ── LAWYER_FEE is a real, positive, flat cost ──────────────────────────────
check(LAWYER_FEE > 0, "hiring lawyers costs something real");

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — bribery genuinely sways votes within a real cap, lawyers cut exposure risk without removing it, and getting caught applies one real, shared, bounded consequence");
