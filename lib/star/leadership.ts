import type { CareerState, Reputation } from "./types";
import { castVote, type VoteTally } from "./voting";
import { clampReputation } from "./reputation";
import { type GoverningBody, influenceIn } from "./governingBodies";

/**
 * PRESIDENT / KING — THE END-GAME POWER FANTASY (§5), PREVIOUSLY CUT.
 *
 * §5's own framing: "at extreme reputation/power, aim to become president
 * or 'king' of your own country, or of a governing body like FIFA."
 * Explicitly cut from the original rollout plan for having "no concrete
 * mechanic given yet" — this is that missing design, built the same way
 * every other phase was: reused infrastructure, not an invented parallel
 * system.
 *
 * ── Why this is "president of a governing body," not "president of a country" ──
 *
 * Nothing in this engine models a country as its own entity — no
 * population, no national government, no national budget. A governing
 * body (FA/UEFA/FIFA/CONMEBOL — governingBodies.ts) IS a real, modelled
 * thing with its own influence stat and its own real powers (the Rule
 * Book, forced league movement), and the FA already stands in for
 * "England" everywhere else this game touches national football. Becoming
 * president of one is the honest, buildable version of "president/king of
 * your own country" — inventing a second, parallel country-government
 * model just for this framing would be exactly the kind of fake depth
 * this whole feature has avoided everywhere else. "King" isn't a separate
 * tier above "president" here, for the same reason: no throne exists in
 * this world for it to be king OF that a governing-body presidency isn't
 * already the real top of.
 *
 * ── What it actually grants ──
 *
 * Real, bounded authority — reusing the exact machinery every other rule
 * change/forced movement/vote already goes through, never a second
 * version of any of them: a president of a body can PROPOSE any rule
 * change in it regardless of their own influence level, and can OVERRULE
 * any vote in it outright, at the body's own normal overrule reputation
 * cost — see ruleBook.ts's `proposeRuleChangeVote`/`canOverruleRuleVote`
 * and forcedMovement.ts's `canForceClubMovement`, both of which check
 * `isBodyPresident` as an alternative path alongside their ordinary
 * influence thresholds.
 */

const PRESIDENCY_REPUTATION_THRESHOLD = 90;
const PRESIDENCY_INFLUENCE_THRESHOLD = 90;
/** A "world congress" scale vote — bigger than any single body's own
 *  rule-change electorate (300), since this is electing a head of the
 *  whole body, not deciding one rule. */
const PRESIDENCY_ELECTORATE = 500;

export function isBodyPresident(career: CareerState, body: GoverningBody): boolean {
  return (career.governingBodyPresidencies ?? []).includes(body);
}

export function canStandForBodyPresidency(career: CareerState, body: GoverningBody): boolean {
  return !isBodyPresident(career, body)
    && career.reputation.world >= PRESIDENCY_REPUTATION_THRESHOLD
    && influenceIn(career, body) >= PRESIDENCY_INFLUENCE_THRESHOLD;
}

export interface PresidencyVoteProposal {
  body: GoverningBody;
  tally: VoteTally;
}

export function proposeBodyPresidencyVote(
  career: CareerState, body: GoverningBody, rng: () => number,
): { ok: true; proposal: PresidencyVoteProposal } | { ok: false; reason: string } {
  if (!canStandForBodyPresidency(career, body)) {
    return {
      ok: false,
      reason: isBodyPresident(career, body)
        ? "Already president of this body"
        : `Needs ${PRESIDENCY_REPUTATION_THRESHOLD}+ world reputation and ${PRESIDENCY_INFLUENCE_THRESHOLD}+ influence in this body`,
    };
  }
  const biasStrength = (career.reputation.world - 50) / 50;
  const tally = castVote(
    `Elect you president of ${body}?`,
    [{ id: "yes", label: "Elect" }, { id: "no", label: "Reject" }],
    PRESIDENCY_ELECTORATE, "yes", biasStrength, rng,
  );
  return { ok: true, proposal: { body, tally } };
}

/** A step above even standing for election — the bar to overrule a lost
 *  presidency vote outright. Deliberately higher than the standing
 *  threshold itself: winning the right to run is not the same as being
 *  powerful enough to simply declare the result. */
const PRESIDENCY_OVERRULE_REPUTATION = 95;
const PRESIDENCY_OVERRULE_INFLUENCE = 95;
const PRESIDENCY_VOTE_HELD_GAIN = 3;
const PRESIDENCY_OVERRULE_COST = 20;

export function canOverrulePresidencyVote(career: CareerState, body: GoverningBody): boolean {
  return career.reputation.world >= PRESIDENCY_OVERRULE_REPUTATION && influenceIn(career, body) >= PRESIDENCY_OVERRULE_INFLUENCE;
}

function nudgeWorld(reputation: Reputation, delta: number): Reputation {
  return { ...reputation, world: clampReputation(reputation.world + delta) };
}

export function resolveBodyPresidencyVote(
  career: CareerState, proposal: PresidencyVoteProposal, overrule: boolean,
): { career: CareerState; ok: boolean; reason?: string } {
  let next = { ...career, reputation: nudgeWorld(career.reputation, PRESIDENCY_VOTE_HELD_GAIN) };
  const passed = proposal.tally.winner === "yes";
  if (!passed && overrule) {
    if (!canOverrulePresidencyVote(next, proposal.body)) {
      return { career: next, ok: false, reason: "Not enough standing to overrule this vote" };
    }
    next = { ...next, reputation: nudgeWorld(next.reputation, -PRESIDENCY_OVERRULE_COST) };
  } else if (!passed) {
    return { career: next, ok: false, reason: "The vote was rejected" };
  }
  return {
    career: { ...next, governingBodyPresidencies: [...(next.governingBodyPresidencies ?? []), proposal.body] },
    ok: true,
  };
}
