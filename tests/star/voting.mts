import {
  castVote, applyVoteHeldReputation, applyOverruleReputationCost,
  OVERRULE_OWNERSHIP_THRESHOLD, OVERRULE_REPUTATION_COST, VOTE_HELD_REPUTATION_GAIN,
  type VoteOption,
} from "../../lib/star/voting";
import type { Reputation } from "../../lib/star/types";

/**
 * THE VOTING/CEREMONY ENGINE — PHASE 2 OF STAR_POWER_POLITICS.MD.
 *
 * The generic mechanic named in §3: a real tally over a real electorate,
 * biased by reputation but never guaranteed, an overrule gated by ownership
 * that costs reputation every time, and holding a vote at all nudging
 * shareholder standing up a little. This file checks the engine in
 * isolation; tests/star/investments.mts's own voting section proves it
 * wired end to end into the one real use case this phase ships (selling a
 * player from an owned club).
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

const YES_NO: VoteOption[] = [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }];

// ── castVote produces real numbers that actually add up ─────────────────────
{
  const tally = castVote("Sell him?", YES_NO, 1000, "yes", 0, mulberry32(1));
  const total = tally.counts.yes + tally.counts.no + tally.abstentions;
  check(total === 1000, `every one of the electorate is accounted for exactly once (saw ${total})`);
  check(tally.abstentions > 0 && tally.abstentions < 50, `abstentions are a small real slice of 1000, not zero and not huge (saw ${tally.abstentions})`);
  check(tally.winner === "yes" || tally.winner === "no", "the winner is always one of the real options");
}

// ── A neutral vote (no bias) splits roughly evenly across many trials ──────
{
  const trials = 40;
  let yesWins = 0;
  for (let seed = 1; seed <= trials; seed++) {
    const tally = castVote("Coin flip?", YES_NO, 2000, undefined, 0, mulberry32(seed * 733 + 1));
    const yesShare = tally.counts.yes / (tally.counts.yes + tally.counts.no);
    check(yesShare > 0.42 && yesShare < 0.58, `an unbiased vote lands close to 50/50 (seed ${seed}, saw ${(yesShare * 100).toFixed(1)}%)`);
    if (tally.winner === "yes") yesWins++;
  }
  check(yesWins > trials * 0.3 && yesWins < trials * 0.7, `across many neutral votes, both sides win a real share of the time (yes won ${yesWins}/${trials})`);
}

// ── Bias swings the odds — never guarantees them ────────────────────────────
{
  const trials = 60;
  const shares: number[] = [];
  for (let seed = 1; seed <= trials; seed++) {
    const tally = castVote("Favoured vote?", YES_NO, 2000, "yes", 1, mulberry32(seed * 991 + 3));
    shares.push(tally.counts.yes / (tally.counts.yes + tally.counts.no));
  }
  const meanShare = shares.reduce((a, b) => a + b, 0) / shares.length;
  check(meanShare > 0.55, `full positive bias genuinely favours "yes" on average (mean share ${(meanShare * 100).toFixed(1)}%)`);
  check(meanShare < 0.85, `...but bias is capped well short of a landslide guarantee (mean share ${(meanShare * 100).toFixed(1)}%)`);

  // At a SMALL electorate the same bias still leaves real room to lose —
  // checked at a scale where a single unlucky run can actually flip it,
  // rather than at the 2000-voter scale above where the law of large
  // numbers alone would make "never loses" true of almost any bias.
  let favoredWins = 0;
  const smallTrials = 200;
  for (let seed = 1; seed <= smallTrials; seed++) {
    const tally = castVote("Small favoured vote?", YES_NO, 15, "yes", 1, mulberry32(seed * 613 + 11));
    if (tally.winner === "yes") favoredWins++;
  }
  check(favoredWins < smallTrials, `even at full favourable bias, a small vote does not go the favoured way literally every time (won ${favoredWins}/${smallTrials})`);
  check(favoredWins > smallTrials * 0.5, `...but it still wins clearly more often than not (won ${favoredWins}/${smallTrials})`);
}

// ── Negative bias swings the other way ──────────────────────────────────────
{
  const tally = castVote("Unpopular?", YES_NO, 5000, "yes", -1, mulberry32(77));
  check(tally.counts.no > tally.counts.yes, `full negative bias genuinely favours the other option (yes ${tally.counts.yes}, no ${tally.counts.no})`);
}

// ── More than two options still resolves to a single real winner ───────────
{
  const options: VoteOption[] = [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }];
  const tally = castVote("Three-way?", options, 900, "b", 0.8, mulberry32(5));
  check(tally.counts.a + tally.counts.b + tally.counts.c + tally.abstentions === 900, "a three-way vote still accounts for the whole electorate");
  check(tally.winner === "b", `the strongly-favoured third option still wins its own three-way vote (winner: ${tally.winner})`);
}

// ── Reputation hooks: holding a vote helps, overruling costs, both clamp ───
{
  const rep: Reputation = { world: 50, club: 50, government: 50, shareholders: 95 };
  const held = applyVoteHeldReputation(rep);
  check(held.shareholders === 95 + VOTE_HELD_REPUTATION_GAIN || held.shareholders === 100,
    `holding a vote raises shareholder reputation by its named amount, clamped at 100 (saw ${held.shareholders})`);
  check(held.world === 50 && held.club === 50 && held.government === 50, "holding a vote only ever touches shareholder reputation");

  const low: Reputation = { world: 50, club: 50, government: 50, shareholders: 5 };
  const overruled = applyOverruleReputationCost(low);
  check(overruled.shareholders === 0, `overruling costs shareholder reputation and floors at 0 rather than going negative (saw ${overruled.shareholders})`);

  const mid: Reputation = { world: 50, club: 50, government: 50, shareholders: 50 };
  check(applyOverruleReputationCost(mid).shareholders === 50 - OVERRULE_REPUTATION_COST,
    "the overrule cost is exactly the named constant when there's room to pay it");
}

// ── The overrule threshold is genuinely above bare majority ────────────────
{
  check(OVERRULE_OWNERSHIP_THRESHOLD > 50, `the overrule bar sits above ordinary majority control, not equal to it (saw ${OVERRULE_OWNERSHIP_THRESHOLD})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a vote is a real, bounded tally, reputation biases it without ever guaranteeing it, and overruling always costs something real");
