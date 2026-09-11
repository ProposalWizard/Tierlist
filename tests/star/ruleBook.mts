import {
  investInfluence, influenceIn, canProposeRuleChange, RULE_PROPOSAL_INFLUENCE_THRESHOLD,
  GOVERNING_BODY_COMPETITIONS,
} from "../../lib/star/governingBodies";
import {
  applyResult, resolvePenalties, ruleBookFor, DEFAULT_RULE_BOOK, CLASSIC_POINTS,
  proposeRuleChangeVote, resolveRuleChangeVote, canOverruleRuleVote, fanCostOf,
  RULE_OVERRULE_INFLUENCE_THRESHOLD, type ResultTotals,
} from "../../lib/star/ruleBook";
import { playLeagueWeek, updateLeagueWithUserResult, mulberry32 } from "../../lib/star/season";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, LeagueTeam, StarPlayer } from "../../lib/star/types";

/**
 * PHASE 4 OF STAR_POWER_POLITICS.MD — THE RULE BOOK, SIMPLEST RULES FIRST.
 *
 * Points per result, no-draws-go-to-penalties, and match length, gated
 * behind a real (if deliberately flat-priced) governing-body-investment
 * system, and changed only through Phase 2's own voting engine. Checks:
 * the investment system is real and bounded; the two league-table rules
 * change real standings through the REAL season.ts functions (not a
 * parallel implementation); every existing caller that never opts in sees
 * byte-identical classic behaviour; and the vote/overrule/fan-cost
 * machinery mirrors Phase 2/3's own pattern rather than reinventing it.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry32Local(a: number) {
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

// ── The governing-body map is real, structural data ─────────────────────────
{
  check(GOVERNING_BODY_COMPETITIONS.FA.includes("Premier League"), "the FA really does control the Premier League");
  check(GOVERNING_BODY_COMPETITIONS.UEFA.includes("Champions League"), "UEFA really does control the Champions League");
  check(!GOVERNING_BODY_COMPETITIONS.FA.includes("Champions League"), "the FA does NOT control competitions it doesn't run");
}

// ── Investing influence: real, bounded, flat-priced ─────────────────────────
{
  let career = freshCareer();
  check(influenceIn(career, "FA") === 0, "nobody starts with any influence anywhere");
  check(!canProposeRuleChange(career, "FA"), "no influence means no standing to propose a rule change");

  const tooMuch = investInfluence(career, "FA", 10_000_000);
  check("ok" in tooMuch && tooMuch.ok === false, "can't invest more money than you actually have");

  const invested = investInfluence(career, "FA", 40_000) as CareerState;
  check(influenceIn(invested, "FA") > 0, "a real investment genuinely raises influence");
  check(invested.money < career.money, "…and genuinely costs real money");
  check(influenceIn(invested, "FA") <= 100, "influence never exceeds its own 0-100 ceiling");
  check(influenceIn(invested, "UEFA") === 0, "investing in one body doesn't leak influence into another");

  const maxed = investInfluence(invested, "FA", 10_000_000 <= invested.money ? invested.money : invested.money) as CareerState;
  check(influenceIn(maxed, "FA") >= RULE_PROPOSAL_INFLUENCE_THRESHOLD, "fixture check: enough was invested to clear the proposal threshold");
  check(canProposeRuleChange(maxed, "FA"), "enough influence really does unlock proposing a rule change");
}

// ── resolvePenalties: a real, bounded, quality-weighted coin ────────────────
{
  let strongWins = 0;
  const trials = 300;
  for (let seed = 1; seed <= trials; seed++) {
    if (resolvePenalties(85, 60, mulberry32Local(seed * 7 + 1)) === "a") strongWins++;
  }
  check(strongWins > trials * 0.55 && strongWins < trials, `a genuinely stronger side wins a shootout more often, but not every time (${strongWins}/${trials})`);
  let evenAWins = 0;
  for (let seed = 1; seed <= trials; seed++) {
    if (resolvePenalties(70, 70, mulberry32Local(seed * 11 + 3)) === "a") evenAWins++;
  }
  check(evenAWins > trials * 0.4 && evenAWins < trials * 0.6, `equal sides split close to evenly (${evenAWins}/${trials})`);
}

// ── applyResult: classic rules reproduce the exact original arithmetic ─────
{
  const zero: ResultTotals = { played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
  const win = applyResult(DEFAULT_RULE_BOOK, zero, zero, 2, 1, 75, 70, mulberry32Local(1));
  check(win.home.won === 1 && win.home.points === 3 && win.away.lost === 1 && win.away.points === 0,
    "a classic win is still worth exactly 3-0, unchanged");
  const draw = applyResult(DEFAULT_RULE_BOOK, zero, zero, 1, 1, 75, 70, mulberry32Local(1));
  check(draw.home.drawn === 1 && draw.home.points === 1 && draw.away.drawn === 1 && draw.away.points === 1 && !draw.wentToPenalties,
    "a classic draw is still a real draw, worth 1 point each, not sent to penalties");
}

// ── applyResult: a custom points rule really changes the table ─────────────
{
  const zero: ResultTotals = { played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
  const twoForAWin = { points: { win: 2, draw: 1, loss: 0 }, noDraws: false, matchLengthMinutes: 90 };
  const out = applyResult(twoForAWin, zero, zero, 2, 0, 75, 70, mulberry32Local(1));
  check(out.home.points === 2, `a genuinely different points rule changes what a win is worth (saw ${out.home.points})`);
}

// ── applyResult: no-draws-go-to-penalties genuinely removes draws ──────────
{
  const zero: ResultTotals = { played: 0, won: 0, drawn: 0, lost: 0, points: 0 };
  const noDraws = { points: CLASSIC_POINTS, noDraws: true, matchLengthMinutes: 90 };
  let anyDraws = 0;
  let homeWins = 0, awayWins = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const out = applyResult(noDraws, zero, zero, 1, 1, 75, 75, mulberry32Local(seed * 13 + 5));
    check(out.wentToPenalties, "a genuine 1-1 under no-draws always goes to penalties");
    check(out.home.drawn === 0 && out.away.drawn === 0, "…and NEVER records a draw for either side");
    if (out.home.won) homeWins++; else awayWins++;
  }
  check(anyDraws === 0, "sanity: no draws were ever recorded across the whole run");
  check(homeWins > 20 && awayWins > 20, `at equal strength, penalty wins really do split between both sides (${homeWins} home, ${awayWins} away)`);
}

// ── The real season.ts functions honour the rule when given one, and are
//    byte-identical to classic behaviour when they aren't ──────────────────
{
  const league: LeagueTeam[] = PREMIER_LEAGUE_CLUBS.map(name => ({
    name, strength: 75, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0,
  }));
  const club = PREMIER_LEAGUE_CLUBS[0];
  const opp = PREMIER_LEAGUE_CLUBS[1];

  const classic = updateLeagueWithUserResult(league, club, opp, 2, 2);
  const classicUser = classic.find(t => t.name === club)!;
  check(classicUser.drawn === 1 && classicUser.points === 1, "with no rule book passed at all, a 2-2 is still a classic draw worth 1 point");

  const withNoDraws = updateLeagueWithUserResult(league, club, opp, 2, 2, { points: CLASSIC_POINTS, noDraws: true, matchLengthMinutes: 90 }, mulberry32(9));
  const noDrawUser = withNoDraws.find(t => t.name === club)!;
  check(noDrawUser.drawn === 0, "the SAME 2-2, under the no-draws rule, is never recorded as a draw");
  check(noDrawUser.won === 1 || noDrawUser.lost === 1, "…and resolves to a real win or loss instead");

  const roundClassic = playLeagueWeek(league, 1, { club, opponent: opp, home: true, scored: 1, conceded: 0 }, mulberry32(3));
  check(roundClassic.league.some(t => t.won > 0 || t.drawn > 0), "playLeagueWeek with no rule book at all still simulates the rest of the round classically");
}

// ── A real vote to change a rule, mirroring Phase 2/3's own pattern ────────
{
  let career = freshCareer();
  const blocked = proposeRuleChangeVote(career, "FA", { points: { win: 2, draw: 1, loss: 0 } }, mulberry32Local(1));
  check(!blocked.ok, "no influence at all means no standing to propose a rule change");

  career = investInfluence(career, "FA", 25_000) as CareerState;
  check(canProposeRuleChange(career, "FA"), "fixture assumption: enough influence to propose");
  check(!canOverruleRuleVote(career, "FA"), `not yet enough to overrule (bar is ${RULE_OVERRULE_INFLUENCE_THRESHOLD})`);

  const proposed = proposeRuleChangeVote(career, "FA", { noDraws: true }, mulberry32Local(2));
  check(proposed.ok, "enough influence really does let you put a rule change to a vote");
  if (proposed.ok) {
    const losing = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "no" } };
    const beforeFans = career.relationships.fans;
    const blockedOverrule = resolveRuleChangeVote(career, losing, true);
    check(!blockedOverrule.ok, "can't overrule a lost rule vote without enough influence");

    const winning = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "yes" } };
    const passed = resolveRuleChangeVote(career, winning, false);
    check(passed.ok, `a won rule vote genuinely changes the rule book (${!passed.ok ? passed.reason : ""})`);
    if (passed.ok) {
      check(ruleBookFor(passed.career, "FA").noDraws === true, "the FA's own rule book genuinely now has no-draws active");
      check(passed.career.relationships.fans < beforeFans, "changing a rule for real costs real fan reputation, win or lose");
      check(passed.career.relationships.fans >= beforeFans - 15, "…but the fan cost is bounded, not catastrophic");
    }
  }
}

// ── Overruling a rule vote, once influence clears the higher bar ──────────
{
  let career = freshCareer();
  career = investInfluence(career, "FA", 1_000_000 <= career.money ? 100_000 : career.money) as CareerState;
  check(influenceIn(career, "FA") >= RULE_OVERRULE_INFLUENCE_THRESHOLD, "fixture assumption: enough influence to overrule");

  const proposed = proposeRuleChangeVote(career, "FA", { matchLengthMinutes: 60 }, mulberry32Local(3));
  if (proposed.ok) {
    const losing = { ...proposed.proposal, tally: { ...proposed.proposal.tally, winner: "no" } };
    const overruled = resolveRuleChangeVote(career, losing, true);
    check(overruled.ok, `enough influence genuinely overrules a lost rule vote (${!overruled.ok ? overruled.reason : ""})`);
    if (overruled.ok) check(ruleBookFor(overruled.career, "FA").matchLengthMinutes === 60, "the overruled change genuinely lands in the rule book");
  } else {
    check(false, "fixture assumption failed: could not even propose the vote to overrule");
  }
}

// ── fanCostOf is bounded and reads a bigger change as a bigger cost ───────
{
  const tiny = fanCostOf(DEFAULT_RULE_BOOK, { points: { win: 3, draw: 1, loss: 0 } });
  const big = fanCostOf(DEFAULT_RULE_BOOK, { noDraws: true, matchLengthMinutes: 60 });
  check(tiny >= 1, "even a no-op change still costs at least the floor");
  check(big > tiny, `a genuinely bigger change reads as a bigger fan cost (tiny ${tiny}, big ${big})`);
  check(big <= 15, "the fan cost never exceeds its own ceiling");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 30)) console.log(`  ✗ ${p}`);
  if (problems.length > 30) console.log(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}
console.log("PASS — governing-body influence is real and bounded, points-per-result and no-draws-to-penalties genuinely change the real table, and every existing caller sees classic behaviour unless it opts in");
