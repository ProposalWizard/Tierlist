import type { CareerState } from "./types";

/**
 * GOVERNING BODIES — PHASE 4 OF STAR_POWER_POLITICS.MD.
 *
 * "Once you have enough power/reputation, you can invest influence in a
 * governing body" (§4.1) — a new, smaller version of the club-investment
 * system in investments.ts, priced in a single "influence" number (0-100)
 * per body rather than a percentage of a club, since there is no club-sized
 * asset here to own a share of. Scoped per §4.2's real structural map: a
 * body only ever governs the competitions it actually runs.
 */

export type GoverningBody = "FA" | "UEFA" | "FIFA" | "CONMEBOL";

export const GOVERNING_BODIES: GoverningBody[] = ["FA", "UEFA", "FIFA", "CONMEBOL"];

/**
 * §4.2's own table, reproduced as real data. Only the FA's competitions
 * (Premier League/Championship, this career's own table) are actually
 * affected by anything Phase 4 ships — UEFA/FIFA/CONMEBOL exist here as
 * real, investable bodies with a real home for a later phase's rules, not
 * because this phase's three rules already reach European or international
 * football (they don't; see ruleBook.ts's own note on scope).
 */
export const GOVERNING_BODY_COMPETITIONS: Record<GoverningBody, string[]> = {
  FA: ["Premier League", "Championship", "FA Cup", "League Cup"],
  UEFA: ["Champions League", "Europa League", "Conference League"],
  FIFA: ["World Cup"],
  CONMEBOL: ["Copa América"],
};

export function influenceIn(career: CareerState, body: GoverningBody): number {
  return career.governingBodyInfluence?.[body] ?? 0;
}

function clampInfluence(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * How much money buys one point of influence — a flat rate, not priced off any
 * live valuation the way a club stake is: there is no analogous "how good is
 * this body right now" fact to read, so unlike `clubValuation` this is
 * deliberately just a constant.
 *
 * ── DERIVED, not multiplied ──
 *
 * The old figure (500) predates the 14 Sep 2026 rescale and was missed by it,
 * which left ★50,000 — two and a half weeks of a Manchester United wage —
 * buying total control of FIFA. Found in review.
 *
 * But the obvious fix, multiplying by `MONEY_SCALE` like every other stranded
 * value, is wrong here and it is worth saying why: it would price full
 * influence at ★100,000,000, roughly thirty times the most expensive thing in
 * the entire shop, and nobody would ever buy any. A value that was never
 * derived in the first place cannot be repaired by scaling it; it has to be
 * derived now.
 *
 * So it is priced against the top of the shop, which is the one place in the
 * game that already says what a huge amount of money looks like: the Private
 * Island at ★3,000,000. Full influence (100 points) in one body costs
 * ★2,000,000 — a genuine late-career purchase, in the same bracket as the
 * biggest thing you can own, and meaningfully out of reach of a young player
 * who has just signed.
 */
export const MONEY_PER_INFLUENCE_POINT = 20_000;

/** What total control of one governing body actually costs, for anything that
 *  wants to state the price rather than re-derive it. */
export const FULL_INFLUENCE_COST = MONEY_PER_INFLUENCE_POINT * 100;

export function investInfluence(career: CareerState, body: GoverningBody, amount: number): CareerState | { ok: false; reason: string } {
  if (amount <= 0) return { ok: false, reason: "Invest a positive amount" };
  if (amount > career.money) return { ok: false, reason: "Not enough money" };
  const gained = amount / MONEY_PER_INFLUENCE_POINT;
  const next = clampInfluence(influenceIn(career, body) + gained);
  return {
    ...career,
    money: career.money - amount,
    governingBodyInfluence: { ...(career.governingBodyInfluence ?? {}), [body]: next },
  };
}

/** Enough influence to PROPOSE a rule change through this body's own vote —
 *  well short of the overrule bar (see ruleBook.ts), since proposing one is
 *  meant to be reachable, not the same tier of power as forcing one
 *  through. */
export const RULE_PROPOSAL_INFLUENCE_THRESHOLD = 40;

export function canProposeRuleChange(career: CareerState, body: GoverningBody): boolean {
  return influenceIn(career, body) >= RULE_PROPOSAL_INFLUENCE_THRESHOLD;
}
