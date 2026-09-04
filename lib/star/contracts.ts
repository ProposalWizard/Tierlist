import type { CareerState, Contract } from "./types";
import { getTuning } from "./tuningStore";

/**
 * CONTRACT CLAUSES
 *
 * A contract was a wage, two bonuses and a number of seasons. Every deal in the
 * game was the same deal at a different price, so renewing was a question of
 * "is this more" and nothing else.
 *
 * Three clauses, each of which makes a contract a shape rather than a number:
 *
 *  - an APPEARANCE FEE, which pays a squad player for turning up and is worth
 *    nothing to somebody who plays every week;
 *  - a LOYALTY BONUS, paid at the end of a season you stayed for, which is the
 *    only thing in the career that pays you for NOT taking a transfer;
 *  - a RELEASE CLAUSE, which cuts both ways — it is the price at which a club
 *    cannot say no, so a low one gets you moves you would not otherwise be
 *    offered and a high one keeps you where you are.
 */

export interface ClauseSummary {
  label: string;
  detail: string;
}

/**
 * What a club is willing to put in a deal.
 *
 * Shaped by who you are to them: a fringe player is offered appearance money
 * because that is what he is worth, a star is offered loyalty money because they
 * are frightened of losing him, and the release clause is set relative to the
 * wage so it scales with the deal rather than with the era.
 */
export function offerClauses(career: CareerState, wage: number, rng: () => number): Partial<Contract> {
  const star = career.starRating;
  const out: Partial<Contract> = {};

  // Appearance money for players who are not certain to play.
  if (star < 3.4 || rng() < getTuning("contracts.appearanceFeeChance")) {
    out.appearanceFee = Math.max(1, Math.round(wage * getTuning("contracts.appearanceFeePct")));
  }
  // Loyalty for players they are worried about.
  if (star >= 3.0 && rng() < getTuning("contracts.loyaltyBonusChance")) {
    out.loyaltyBonus = Math.max(2, Math.round(wage * getTuning("contracts.loyaltyBonusPct")));
  }
  // And a price at which they cannot say no.
  if (rng() < getTuning("contracts.releaseClauseChance")) {
    // Cheaper for a lesser player, and never so low that it is free.
    const multiple = getTuning("contracts.releaseClauseBase") + star * getTuning("contracts.releaseClauseStarMult") + rng() * 10;
    out.releaseClause = Math.max(10, Math.round(wage * multiple));
  }
  return out;
}

export function clauseSummary(contract: Contract): ClauseSummary[] {
  const out: ClauseSummary[] = [];
  if (contract.appearanceFee) {
    out.push({ label: "Appearance fee", detail: `★${contract.appearanceFee} every match you play` });
  }
  if (contract.loyaltyBonus) {
    out.push({ label: "Loyalty bonus", detail: `★${contract.loyaltyBonus} at the end of every season you stay` });
  }
  if (contract.releaseClause) {
    out.push({ label: "Release clause", detail: `★${contract.releaseClause} — at that price the club cannot refuse` });
  }
  return out;
}

/**
 * What a club would have to pay to trigger the clause.
 *
 * A buying club's means come from its strength: the best sides in the division
 * can meet almost anything, the worst can meet almost nothing. A clause a club
 * can meet turns an offer it would never otherwise have made into one it can.
 */
export function canTriggerClause(contract: Contract, buyerStrength: number, wage: number): boolean {
  if (!contract.releaseClause) return false;
  const means = Math.round(wage * (getTuning("contracts.buyerMeansBase") + (buyerStrength / 100) * getTuning("contracts.buyerMeansStrengthMult")));
  return means >= contract.releaseClause;
}

/** Match-day money from the deal itself, on top of the wage. */
export function appearanceMoney(contract: Contract): number {
  return contract.appearanceFee ?? 0;
}

/** Paid at a season rollover, only if you are still here. */
export function loyaltyMoney(contract: Contract, stayed: boolean): number {
  return stayed ? (contract.loyaltyBonus ?? 0) : 0;
}
