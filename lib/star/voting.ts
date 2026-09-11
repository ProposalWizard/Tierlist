import type { Reputation } from "./types";
import { clampReputation } from "./reputation";

/**
 * THE VOTING/CEREMONY ENGINE — PHASE 2 OF STAR_POWER_POLITICS.MD.
 *
 * The one reusable system everything else in the brief (§3) goes through:
 * club business, kit votes, fan votes, governing-body rule changes — every
 * one of them is "a proposal, put to some electorate, decided by real
 * numbers, biased by reputation, overridable at a cost." This file is that
 * system and nothing else — it doesn't know about players, clubs, or rules,
 * only proposals and tallies, so any future call site (Phase 3's kit vote,
 * Phase 4's rule-book vote) plugs into the exact same three functions.
 *
 * Proven end to end on the simplest real case that already existed: selling
 * a player out of a club you own (see investments.ts's
 * `proposeSellPlayerVote`/`resolveSellPlayerVote`) — routed through a real
 * vote instead of an instant boardroom action, with the overrule option
 * gated by ownership. This phase is "the voting system works," not "every
 * use of it exists" — kit votes, fan votes and the Rule Book itself are
 * later phases building on exactly this.
 *
 * ── Why the tally is rolled once, not simulated live ──
 *
 * The brief's own presentation note — offer the proposal, then a live count
 * climbing and settling — describes an ANIMATION, not a requirement that the
 * result be computed incrementally. Every other "spin to a result" moment in
 * this codebase already works this way (Casino.tsx's slot reels roll a known
 * final result, then animate toward it) — `castVote` rolls the real, final
 * tally in one deterministic pass off a seeded `rng`, and the ceremony
 * component's job is purely to animate a UI counter toward numbers that are
 * already decided, exactly like a bookmaker's numbers are exact before the
 * "counting up" TV graphic ever plays.
 */

export interface VoteOption {
  id: string;
  label: string;
}

export interface VoteTally {
  question: string;
  options: VoteOption[];
  /** Total eligible voters, abstentions included. */
  electorate: number;
  /** Real vote counts per option id — always sums with `abstentions` to `electorate`. */
  counts: Record<string, number>;
  abstentions: number;
  /** The option id with the most votes. Ties resolve to whichever option was listed first. */
  winner: string;
}

/** However big or small the electorate, some fraction never turns out —
 *  the brief's own worked example (638 votes, 2 abstentions) is roughly
 *  0.3%; kept as a named constant since a governing-body-scale vote in a
 *  later phase may reasonably want a different figure, not a copy-pasted
 *  magic number. */
export const ABSTENTION_RATE = 0.003;

/**
 * How far reputation can swing an individual voter's real preference away
 * from a coin flip — the brief is explicit this biases the ODDS, it is
 * never a guarantee. At `biasStrength = 1` (fully in your favour) a voter
 * still only leans 80/20, not 100/0: even a beloved figure can lose a vote
 * on a bad day, which is the entire point of it being a real roll.
 */
const MAX_SWING = 0.3;

/**
 * Cast a real vote of `electorate` people over `options`, with the result
 * biased toward `favoredOptionId` by `biasStrength` (0 = neutral coin flip
 * across every option, 1 = as favourable as this system ever gets). Every
 * individual "voter" is its own roll against `rng`, so the final tally is a
 * real distribution, not a formula's straight-line output — the same
 * option can plausibly still lose even at strong positive bias.
 */
export function castVote(
  question: string,
  options: VoteOption[],
  electorate: number,
  favoredOptionId: string | undefined,
  biasStrength: number,
  rng: () => number,
): VoteTally {
  const counts: Record<string, number> = {};
  for (const o of options) counts[o.id] = 0;
  const n = options.length;
  const hasFavorite = favoredOptionId !== undefined && options.some(o => o.id === favoredOptionId);
  const swing = Math.max(-1, Math.min(1, biasStrength)) * MAX_SWING;
  const favoredShare = hasFavorite ? 1 / n + swing * (1 - 1 / n) : 1 / n;
  const otherShare = hasFavorite && n > 1 ? (1 - favoredShare) / (n - 1) : 1 / n;
  const shareFor = (id: string) => (hasFavorite && id === favoredOptionId ? favoredShare : otherShare);

  let abstentions = 0;
  for (let i = 0; i < electorate; i++) {
    const roll = rng();
    if (roll < ABSTENTION_RATE) { abstentions++; continue; }
    // Re-roll a fresh, independent draw for WHICH option this voter picks —
    // reusing `roll` here would correlate turnout with choice for no reason.
    const pick = rng();
    let acc = 0;
    let chosen = options[n - 1].id;
    for (const o of options) {
      acc += shareFor(o.id);
      if (pick < acc) { chosen = o.id; break; }
    }
    counts[chosen]++;
  }

  let winner = options[0].id;
  for (const o of options) if (counts[o.id] > counts[winner]) winner = o.id;

  return { question, options, electorate, counts, abstentions, winner };
}

// ── Overrule ──────────────────────────────────────────────────────────────

/** Above this ownership share, a club-scoped vote can be overruled outright
 *  — deliberately set ABOVE bare majority (50%): the brief's own framing
 *  ("almost like you are some sort of dictator") reads as a step beyond
 *  ordinary majority control, not a synonym for it. A 51-75% owner gets a
 *  real vote with a real result; only a 75%+ owner can force the outcome. */
export const OVERRULE_OWNERSHIP_THRESHOLD = 75;

/** What overruling costs, in shareholder reputation — a direct, immediate
 *  penalty every time, per the brief ("costs reputation... every time"),
 *  regardless of whether the overruled result would have gone your way
 *  anyway. Deliberately larger than any single season's ordinary movement
 *  (see reputation.ts's `clubReputationFromSeason`, which tops out at ±8)
 *  — overruling your own shareholders should sting more than a bad season
 *  does, since it is a choice, not a result you were merely judged on. */
export const OVERRULE_REPUTATION_COST = 12;

/** Holding ANY real vote — even one you were required to hold — nudges
 *  shareholder reputation up a little: "letting people feel heard is
 *  itself worth something." A future phase can add a genuinely OPTIONAL
 *  "call a vote purely to build reputation" action once more decisions
 *  exist that don't already require one; this hook fires for every vote
 *  this phase's call sites hold, mandatory or not. */
export const VOTE_HELD_REPUTATION_GAIN = 2;

export function applyVoteHeldReputation(rep: Reputation): Reputation {
  return { ...rep, shareholders: clampReputation(rep.shareholders + VOTE_HELD_REPUTATION_GAIN) };
}

export function applyOverruleReputationCost(rep: Reputation): Reputation {
  return { ...rep, shareholders: clampReputation(rep.shareholders - OVERRULE_REPUTATION_COST) };
}
