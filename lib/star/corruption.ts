import type { CareerState } from "./types";
import type { VoteTally } from "./voting";
import { clampReputation } from "./reputation";
import { tierPrice } from "./economy";

/**
 * CORRUPTION — PHASE 5 OF STAR_POWER_POLITICS.MD.
 *
 * §4.3, read as one shared mechanic rather than three unrelated ones —
 * bribery, hiring lawyers to push a deal through, and buying banned
 * equipment on the black market all reduce to the same shape: spend real
 * money to get a real advantage, at a real, rollable risk of getting
 * caught, with real consequences (a fine, damaged relationships, a real
 * suspension) when you are. Depends on Phase 1 (reputation) for the
 * consequence side and Phase 4 (the Rule Book) for there to be a real
 * illegal/legal line — a boot is only ever "banned" because a Rule Book
 * entry (`RuleBook.bannedItems`, added this phase) says so.
 */

export type CorruptAct = "bribery" | "blackMarket" | "lawyers";

/**
 * Baseline chance of getting caught, before lawyers. Lawyers exist
 * specifically to make an illegal act look legitimate, so hiring them is
 * deliberately the lowest-risk path on its own — the brief's own framing
 * ("push through deals that aren't strictly legal") reads as the
 * respectable-looking option, not a separate crime.
 */
export const BASE_EXPOSURE_RISK: Record<CorruptAct, number> = {
  bribery: 0.35,
  blackMarket: 0.25,
  lawyers: 0.08,
};

/** Hiring lawyers alongside a bribe or a black-market buy cuts the risk of
 *  THAT act too — the one place the three items in §4.3 actually combine,
 *  rather than sitting as three separate systems. */
const LAWYERS_RISK_MULTIPLIER = 0.35;

/**
 * A flat, real cost for "high-level lawyers" — every time they're hired
 * alongside a corrupt act, not scaled to that act's own size, since a
 * lawyer's fee is its own real thing, not a percentage of the bribe.
 *
 * ── ON THE CURVE, 19 Sep 2026 ──
 *
 * It was ★10,000,000, from the flat 14 Sep 2026 ×2000 rescale — which
 * against the income ladder economy.ts actually builds is 8,600 weeks of
 * Premier League income. Nobody was ever going to hire a lawyer. A figure
 * that was never derived cannot be repaired by multiplying it; it has to be
 * derived, so it is now EIGHT WEEKS of top-flight income — roughly twice
 * the best pair of boots in the game, payable several times over a rich
 * career, and genuinely out of reach of anybody who has not got there.
 */
export const LAWYER_FEE_WEEKS = 8;
export const LAWYER_FEE = tierPrice("world_class", LAWYER_FEE_WEEKS);

export function exposureRisk(act: CorruptAct, useLawyers: boolean): number {
  const base = BASE_EXPOSURE_RISK[act];
  return useLawyers && act !== "lawyers" ? base * LAWYERS_RISK_MULTIPLIER : base;
}

export function rollCaught(act: CorruptAct, useLawyers: boolean, rng: () => number): boolean {
  return rng() < exposureRisk(act, useLawyers);
}

// ── Bribery: sway a vote that's already been cast ──────────────────────────

/** How much money moves one real vote — bribing the whole electorate of a
 *  governing-body-scale vote outright would need to be effectively
 *  impossible, so this is deliberately steep: TWO WEEKS of top-flight
 *  income per vote, which puts a maxed-out bribe (see
 *  `MAX_BRIBED_VOTES_SHARE`) at the better part of a whole Premier League
 *  season's income. Derived rather than rescaled, same as LAWYER_FEE. */
const BRIBE_WEEKS_PER_VOTE = 2;
const MONEY_PER_BRIBED_VOTE = tierPrice("world_class", BRIBE_WEEKS_PER_VOTE);

/** The most votes a single bribe can move, regardless of money spent — a
 *  cap so a big enough bribe can't simply buy a landslide outright; it can
 *  tip a close vote, not manufacture a rout. */
const MAX_BRIBED_VOTES_SHARE = 0.15;

/**
 * Sway real votes toward `towardOptionId`, taken from whichever other
 * option currently has the most (the real leader, not an arbitrary one) —
 * "pay money to sway a vote... directly," applied to a tally that's
 * already been rolled (see voting.ts's own note on why a tally is decided
 * once, not simulated live: this is the same principle — you are bribing
 * real people who already voted, not rigging the roll itself).
 */
export function bribeVote(tally: VoteTally, towardOptionId: string, amount: number): VoteTally {
  if (!tally.options.some(o => o.id === towardOptionId) || amount <= 0) return tally;
  const cap = Math.floor(tally.electorate * MAX_BRIBED_VOTES_SHARE);
  let toMove = Math.min(cap, Math.floor(amount / MONEY_PER_BRIBED_VOTE));
  if (toMove <= 0) return tally;

  const counts = { ...tally.counts };
  const donors = tally.options.filter(o => o.id !== towardOptionId).sort((a, b) => counts[b.id] - counts[a.id]);
  for (const d of donors) {
    if (toMove <= 0) break;
    const take = Math.min(counts[d.id], toMove);
    counts[d.id] -= take;
    counts[towardOptionId] += take;
    toMove -= take;
  }

  let winner = tally.options[0].id;
  for (const o of tally.options) if (counts[o.id] > counts[winner]) winner = o.id;
  return { ...tally, counts, winner };
}

// ── Getting caught: one shared consequence, for any of the three acts ──────

export interface CaughtConsequence {
  fine: number;
  worldReputationHit: number;
  suspensionWeeks: number;
}

function consequenceFor(act: CorruptAct, amountInvolved: number): CaughtConsequence {
  // The cap is a whole top-flight SEASON'S income (38 weeks) — the most
  // money the game can take off you in one go without simply ending the
  // career, and derived off the ladder rather than left as the ★100,000,000
  // the flat 14 Sep 2026 rescale produced, which was about seventy years of
  // top-flight pay and therefore never once binding.
  const fine = Math.round(Math.min(amountInvolved * 0.5, tierPrice("world_class", 38)));
  const worldReputationHit = act === "bribery" ? 10 : act === "blackMarket" ? 6 : 4;
  const suspensionWeeks = act === "blackMarket" ? 2 : act === "bribery" ? 3 : 1;
  return { fine, worldReputationHit, suspensionWeeks };
}

/**
 * The real consequences, applied only when `rollCaught` actually comes back
 * true — a fine (capped, scaled to how much was actually risked), a world-
 * reputation hit, damaged relationships (boss and fans both take a real
 * hit — "damaged relationships" named directly), and a real suspension.
 * The suspension deliberately REUSES `career.injury`'s exact shape rather
 * than inventing a second "forced out of the team" mechanic — the
 * selection/pre-match code that already turns an injury into missed
 * matches doesn't care WHY you can't play, and a save built before this
 * feature existed already has an honest `null` there to work from.
 */
export function applyGettingCaught(career: CareerState, act: CorruptAct, amountInvolved: number, note: string): CareerState {
  const c = consequenceFor(act, amountInvolved);
  return {
    ...career,
    money: Math.max(0, career.money - c.fine),
    reputation: { ...career.reputation, world: clampReputation(career.reputation.world - c.worldReputationHit) },
    relationships: {
      ...career.relationships,
      boss: clampReputation(career.relationships.boss - 10),
      fans: clampReputation(career.relationships.fans - 8),
    },
    injury: career.injury ?? { weeksRemaining: c.suspensionWeeks, note },
  };
}

// ── The black market: buying something a Rule Book vote made illegal ──────

/** However much more a "shady guy" charges over the shop's own sticker
 *  price — a real, if simple, premium for the risk they're taking too. */
const BLACK_MARKET_MARKUP = 1.6;

export function blackMarketPrice(legalPrice: number): number {
  return Math.round(legalPrice * BLACK_MARKET_MARKUP);
}
