import type { CareerState, Reputation } from "./types";
import { castVote, type VoteTally } from "./voting";
import { clampReputation } from "./reputation";
import { type GoverningBody, canProposeRuleChange, influenceIn } from "./governingBodies";
import { isBodyPresident } from "./leadership";

/**
 * THE RULE BOOK — PHASE 4 OF STAR_POWER_POLITICS.MD.
 *
 * Starts with the EASIEST, most mechanically self-contained rules only —
 * pure numeric parameters the season/match engine already has a natural
 * home for: points per result, no-draws-go-to-penalties, and match length.
 * Deliberately excludes the offside toggle, squad-size changes, and any
 * competition-format-shaped rule (Phase 6 — those need real match-engine or
 * team-sheet work this phase shouldn't be blocked on).
 *
 * ── Scope, honestly stated ──
 *
 * All three rules only actually reach the FA's own competitions — the
 * Premier League/Championship table this career plays in (`career.league`,
 * via season.ts's `playLeagueWeek`/`updateLeagueWithUserResult`) and the
 * player's own live match (`components/star/CanvasMatch.tsx`'s match
 * length). UEFA/FIFA/CONMEBOL entries exist in `career.ruleBook` as real
 * data (see governingBodies.ts), but nothing in this engine simulates
 * Europe or international football deeply enough for these three rules to
 * show any visible effect there yet — an honest gap, not a silent one.
 *
 * Match length's own scope is narrower still: it changes when the match
 * actually ends and how fast in-match energy drains, both cleanly
 * parameterised already. It does NOT retune `matchLog.ts`'s commentary-
 * density pacing (`halfTimeSplit`/`dwellFor`), which stays calibrated for a
 * 90-minute match — a shorter or longer match still plays correctly start
 * to finish, just without that pacing curve re-tuned for a length nobody
 * asked to have tuned yet. Reported directly by the rollout plan itself as
 * the heaviest lift of the three; this is the deliberately contained slice
 * of it that ships now.
 */

export interface PointsRule {
  win: number;
  draw: number;
  loss: number;
}

export const CLASSIC_POINTS: PointsRule = { win: 3, draw: 1, loss: 0 };

export interface RuleBook {
  points: PointsRule;
  /** Every drawn match goes straight to penalties instead (§4.4 #3). */
  noDraws: boolean;
  /** §4.4 #2 — see this file's own header for what "match length" does and does not retune. */
  matchLengthMinutes: number;
  /** §4.3/§4.4 #6 — boot ids (shopData.ts's BOOTS_CATALOGUE) banned by this
   *  body. Phase 5's corruption.ts is what actually lets you buy one
   *  anyway, from "shady guys," at a real risk. */
  bannedItems: string[];
  /** §4.4 #1 — Phase 6. A real, wired toggle: see canvasEngine.ts's
   *  `setOffsideRuleEnabled`, driven off this field in CanvasMatch.tsx. */
  offsideAbolished: boolean;
  /** §4.4 #5 — Phase 6. Real, votable data with an HONEST gap: the match
   *  engine and every team-sheet screen still assume exactly 11 a side —
   *  changing this number changes nothing on the pitch yet. See Phase 6's
   *  own note in STAR_POWER_POLITICS.md for why that's a stated, accepted
   *  limitation rather than a silent one. */
  squadSize: number;
  /** §4.4 #11 — Phase 6. Extra Champions/Europa League places for the FA's
   *  own clubs, layered on top of `competitions.ts`'s ordinary top-5/6th-7th
   *  split. Read off UEFA's own rule book (`ruleBookFor(career, "UEFA")`),
   *  since UEFA is the body that actually controls these competitions —
   *  not the FA, which only controls who's eligible to be considered. */
  extraChampionsLeagueSlots: number;
  extraEuropaLeagueSlots: number;
  /** §4.4 #7 — Phase 6. Real, votable data with an HONEST gap: euro.ts's
   *  Champions League simulation still runs the current single
   *  league-table phase regardless of this flag — see Phase 6's own note
   *  in STAR_POWER_POLITICS.md for why rewriting that simulation was
   *  scoped OUT of this pass rather than risked half-done. */
  championsLeagueFormat: "league" | "groups";
}

export const DEFAULT_RULE_BOOK: RuleBook = {
  points: CLASSIC_POINTS, noDraws: false, matchLengthMinutes: 90, bannedItems: [],
  offsideAbolished: false, squadSize: 11,
  extraChampionsLeagueSlots: 0, extraEuropaLeagueSlots: 0,
  championsLeagueFormat: "league",
};

export function ruleBookFor(career: CareerState, body: GoverningBody): RuleBook {
  return career.ruleBook?.[body] ?? DEFAULT_RULE_BOOK;
}

/**
 * The shootout itself — the exact edge formula euro.ts's own `settleTie`
 * already uses for a European tie decided on penalties, reused rather than
 * inventing a second "how likely is the better side to win a shootout"
 * number: a coin weighted by quality, bounded well inside a toss.
 */
export function resolvePenalties(strengthA: number, strengthB: number, rng: () => number): "a" | "b" {
  const edge = Math.max(0.3, Math.min(0.7, 0.5 + (strengthA - strengthB) / 200));
  return rng() < edge ? "a" : "b";
}

export interface ResultTotals {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
}

/**
 * Apply one result to both sides' league totals, under whatever points/
 * no-draws rule is active — the one shared function `playLeagueWeek` and
 * `updateLeagueWithUserResult` (season.ts) both now call, so the rule is
 * honoured identically whether the match was simulated or actually played.
 * `rng` is only ever consulted when the match is a genuine draw AND
 * `rules.noDraws` is active — every other path is exactly as deterministic
 * as it always was, which is why every existing caller that doesn't pass a
 * rule book at all sees byte-identical behaviour to before this file
 * existed.
 */
export function applyResult(
  rules: RuleBook,
  home: ResultTotals, away: ResultTotals,
  homeScore: number, awayScore: number,
  homeStrength: number, awayStrength: number,
  rng: () => number,
): { home: ResultTotals; away: ResultTotals; wentToPenalties: boolean; penaltyWinner?: "home" | "away" } {
  const H = { ...home, played: home.played + 1 };
  const A = { ...away, played: away.played + 1 };

  if (homeScore !== awayScore) {
    const homeWon = homeScore > awayScore;
    if (homeWon) { H.won++; H.points += rules.points.win; A.lost++; A.points += rules.points.loss; }
    else { A.won++; A.points += rules.points.win; H.lost++; H.points += rules.points.loss; }
    return { home: H, away: A, wentToPenalties: false };
  }

  if (!rules.noDraws) {
    H.drawn++; H.points += rules.points.draw;
    A.drawn++; A.points += rules.points.draw;
    return { home: H, away: A, wentToPenalties: false };
  }

  const winner = resolvePenalties(homeStrength, awayStrength, rng);
  if (winner === "a") { H.won++; H.points += rules.points.win; A.lost++; A.points += rules.points.loss; }
  else { A.won++; A.points += rules.points.win; H.lost++; H.points += rules.points.loss; }
  return { home: H, away: A, wentToPenalties: true, penaltyWinner: winner === "a" ? "home" : "away" };
}

// ── A real vote to change a rule ────────────────────────────────────────────

/** Above this influence, a rule change can be forced through regardless of
 *  the vote — the same "above a power threshold, overrule outright" shape
 *  as a club vote's overrule, at a deliberately higher bar than merely
 *  proposing one. */
export const RULE_OVERRULE_INFLUENCE_THRESHOLD = 80;

/** Overruling a governing body costs WORLD reputation, not shareholder —
 *  this is the world stage, not a boardroom. */
const RULE_OVERRULE_WORLD_COST = 15;
const RULE_VOTE_HELD_WORLD_GAIN = 2;
const GOVERNING_BODY_ELECTORATE = 300; // roughly "however many member associations get a vote"

export interface RuleChangeProposal {
  body: GoverningBody;
  change: Partial<RuleBook>;
  tally: VoteTally;
}

/**
 * How disruptive a change reads to the fans — §4.6, read literally: "fans
 * generally don't like change... you would probably be hated quite a bit
 * for changing big things," independent of whether the vote passed. Each
 * rule's own distance from the classic setup is a real, if simple, number;
 * `noDraws` (abolishing draws outright) is treated as inherently large
 * rather than measured against a baseline that doesn't apply to a boolean.
 */
function changeMagnitude(current: RuleBook, change: Partial<RuleBook>): number {
  let magnitude = 0;
  if (change.points) {
    magnitude += Math.abs(change.points.win - current.points.win)
      + Math.abs(change.points.draw - current.points.draw)
      + Math.abs(change.points.loss - current.points.loss);
  }
  if (change.noDraws !== undefined && change.noDraws !== current.noDraws) magnitude += 8;
  if (change.matchLengthMinutes !== undefined) magnitude += Math.abs(change.matchLengthMinutes - current.matchLengthMinutes) / 10;
  if (change.bannedItems) {
    const before = new Set(current.bannedItems);
    const after = new Set(change.bannedItems);
    for (const id of Array.from(after)) if (!before.has(id)) magnitude += 4;
    for (const id of Array.from(before)) if (!after.has(id)) magnitude += 4;
  }
  if (change.offsideAbolished !== undefined && change.offsideAbolished !== current.offsideAbolished) magnitude += 12;
  if (change.squadSize !== undefined) magnitude += Math.abs(change.squadSize - current.squadSize) * 1.5;
  if (change.extraChampionsLeagueSlots !== undefined) magnitude += Math.abs(change.extraChampionsLeagueSlots - current.extraChampionsLeagueSlots) * 2;
  if (change.extraEuropaLeagueSlots !== undefined) magnitude += Math.abs(change.extraEuropaLeagueSlots - current.extraEuropaLeagueSlots) * 2;
  if (change.championsLeagueFormat !== undefined && change.championsLeagueFormat !== current.championsLeagueFormat) magnitude += 10;
  return magnitude;
}

/** Fan reputation cost for a rule change, once it actually lands — bounded
 *  so even a wild swing can't wipe fan reputation out in one vote. */
export function fanCostOf(current: RuleBook, change: Partial<RuleBook>): number {
  return Math.max(1, Math.min(15, Math.round(changeMagnitude(current, change))));
}

export function proposeRuleChangeVote(
  career: CareerState, body: GoverningBody, change: Partial<RuleBook>, rng: () => number,
): { ok: true; proposal: RuleChangeProposal } | { ok: false; reason: string } {
  if (!canProposeRuleChange(career, body) && !isBodyPresident(career, body)) {
    return { ok: false, reason: "Not enough influence in this governing body" };
  }
  const biasStrength = (career.reputation.world - 50) / 50;
  const tally = castVote(
    `Should ${body} adopt this rule change?`,
    [{ id: "yes", label: "Adopt" }, { id: "no", label: "Reject" }],
    GOVERNING_BODY_ELECTORATE, "yes", biasStrength, rng,
  );
  return { ok: true, proposal: { body, change, tally } };
}

export function canOverruleRuleVote(career: CareerState, body: GoverningBody): boolean {
  return influenceIn(career, body) >= RULE_OVERRULE_INFLUENCE_THRESHOLD || isBodyPresident(career, body);
}

function nudgeWorld(reputation: Reputation, delta: number): Reputation {
  return { ...reputation, world: clampReputation(reputation.world + delta) };
}

export function resolveRuleChangeVote(
  career: CareerState, proposal: RuleChangeProposal, overrule: boolean,
): { career: CareerState; ok: boolean; reason?: string } {
  let next = { ...career, reputation: nudgeWorld(career.reputation, RULE_VOTE_HELD_WORLD_GAIN) };
  const passed = proposal.tally.winner === "yes";
  if (!passed && overrule) {
    if (!canOverruleRuleVote(next, proposal.body)) {
      return { career: next, ok: false, reason: "Not enough influence to overrule this vote" };
    }
    next = { ...next, reputation: nudgeWorld(next.reputation, -RULE_OVERRULE_WORLD_COST) };
  } else if (!passed) {
    return { career: next, ok: false, reason: "The vote was rejected" };
  }

  const current = ruleBookFor(next, proposal.body);
  const updated: RuleBook = { ...current, ...proposal.change };
  const fanCost = fanCostOf(current, proposal.change);
  next = {
    ...next,
    ruleBook: { ...(next.ruleBook ?? {}), [proposal.body]: updated },
    relationships: { ...next.relationships, fans: clampReputation(next.relationships.fans - fanCost) },
  };
  return { career: next, ok: true };
}
