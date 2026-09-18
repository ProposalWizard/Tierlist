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

/**
 * MOVE CLAUSES ONTO A DIFFERENT WAGE, KEEPING THEIR MEANING.
 *
 * Every clause `offerClauses` writes is `wage × some multiple` — an
 * appearance fee is a fraction of a week, a release clause is a couple of
 * dozen weeks. That multiple is what the clause actually MEANS, and it is
 * what `canTriggerClause` compares against: it works out a buyer's means as
 * `wage × (base + strength)` and tests it against the release clause. Both
 * sides are wage-derived, so the comparison is scale-invariant and a wage
 * ten times bigger changes nothing about how hard the clause is to trigger.
 *
 * That only holds while the clause and the wage came from the SAME number.
 *
 * ── Why this exists ──
 *
 * Clauses are written when an offer is BUILT. Wage negotiation happens
 * afterwards. So the moment you can haggle your wage upward, the release
 * clause stays pinned to the wage you were first offered while the trigger
 * test uses the wage you actually signed — and the clause silently becomes
 * far easier to meet. The better you negotiated, the faster you would get
 * sold out from under yourself, which is the opposite of the intended
 * reward.
 *
 * Rescaling rather than re-rolling is deliberate: re-rolling would need an
 * rng at the point of signing and would let a player who negotiated well
 * also reroll into softer clauses, which is a second, different reward.
 * This keeps the terms they were offered and only restates them in the
 * currency they signed for.
 *
 * Keeps the same floors `offerClauses` applies, so a rescale downward can
 * never produce a free release clause.
 */
export function rescaleClauses(
  clauses: Partial<Contract>,
  fromWage: number,
  toWage: number,
): Partial<Contract> {
  // A missing or nonsensical source wage would turn every clause into NaN or
  // Infinity, which is far worse than leaving them alone.
  if (!(fromWage > 0) || !(toWage > 0) || fromWage === toWage) return { ...clauses };

  const factor = toWage / fromWage;
  const out: Partial<Contract> = { ...clauses };

  if (clauses.appearanceFee !== undefined) {
    out.appearanceFee = Math.max(1, Math.round(clauses.appearanceFee * factor));
  }
  if (clauses.loyaltyBonus !== undefined) {
    out.loyaltyBonus = Math.max(2, Math.round(clauses.loyaltyBonus * factor));
  }
  if (clauses.releaseClause !== undefined) {
    out.releaseClause = Math.max(10, Math.round(clauses.releaseClause * factor));
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
