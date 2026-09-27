/**
 * lib/star/kindRules — THE HARD RULESETS, PER CHANCE KIND.
 *
 * Asked for directly (Harry, 26 Sep 2026): working rulesets for long range,
 * corners and free kicks, from real Premier League numbers (penalties live in
 * lib/star/penaltyKeeper.ts, which already hooks the strike). Each kind's
 * rules sit in their own file here and plug into the match at two moments:
 *
 *   setup  — once the chance is built (after the chance formula and any
 *            authored drawing), before the defence is given its roles:
 *            where people stand, the wall, the keeper's spot.
 *   strike — the instant you hit the ball: a decision (the keeper's read, who
 *            wins the first contact at a corner), then applied. The decision
 *            is saved with a goal replay, so the replay plays the same way.
 *   step   — optional, every flight substep, for a rule that has to act
 *            while the ball is travelling.
 *
 * All of this is ADDED around the engine. lib/star/canvasEngine.ts is never
 * touched (Mikey's rule): a rule moves people and sets the public fields the
 * engine already reads (keeper.scrambling/targetX, defender positions).
 *
 * A kind with no entry below behaves exactly as before.
 */
import type { Ball, Scenario } from "../canvasEngine";
import { freeKickRules } from "./freeKick";

export interface SetupContext {
  /** The chance was laid over a hand-made drawing (authoredChance.ts). */
  appliedAuthored: boolean;
  /** The chance formula placed it (chanceFormula.ts). */
  appliedPlan: boolean;
  keeperStrength: number;
}

export interface StrikeContext {
  keeperStrength: number;
  /** Your technique for a dead ball, 0-100, when the match knows it. */
  setPieceSkill?: number;
  /** Your shooting power / technique, 0-100. */
  power: number;
  technique: number;
}

/** A strike-time decision: plain data, so it can ride along in a replay. */
export interface StrikeDecision {
  kind: string;
  data: Record<string, number | string | boolean | null>;
}

export interface KindRule {
  setup?(sc: Scenario, rng: () => number, ctx: SetupContext): void;
  /** How many uniform random numbers `decide` wants. */
  draws?: number;
  decide?(sc: Scenario, ball: Ball, draws: number[], ctx: StrikeContext): StrikeDecision | null;
  apply?(sc: Scenario, ball: Ball, d: StrikeDecision): void;
  step?(sc: Scenario, ball: Ball, dt: number, d: StrikeDecision): void;
}

// Long range and corners deliberately have NO entry (Harry, 26 Sep 2026:
// "go back to EXACTLY how we did it for one on ones, take the current base
// scenarios and work from those, don't add rules outside of that"). They are
// the drawings plus the rule set scanned off them (lib/star/scenarioRules.ts,
// lib/star/authoredChance.ts), nothing added on top.
const RULES: Partial<Record<string, KindRule>> = {
  free_kick: freeKickRules,
};

export function ruleFor(kind: string | undefined): KindRule | undefined {
  return kind ? RULES[kind] : undefined;
}

/** Setup-time rules for this chance's kind. A no-op for any other kind. */
export function setupKind(sc: Scenario, rng: () => number, ctx: SetupContext): void {
  ruleFor(sc.kind)?.setup?.(sc, rng, ctx);
}

/** Strike-time rules: decide and apply. Returns the decision to save with a replay. */
export function strikeKind(sc: Scenario, ball: Ball, rand: () => number, ctx: StrikeContext): StrikeDecision | null {
  const r = ruleFor(sc.kind);
  if (!r?.decide) return null;
  const draws = Array.from({ length: r.draws ?? 4 }, () => rand());
  const d = r.decide(sc, ball, draws, ctx);
  if (d) r.apply?.(sc, ball, d);
  return d;
}

/** A replay: apply the decision the live strike made. */
export function replayStrike(sc: Scenario, ball: Ball, d: StrikeDecision): void {
  ruleFor(d.kind)?.apply?.(sc, ball, d);
}

/** Every flight substep, for a rule that acts while the ball travels. */
export function stepKind(sc: Scenario, ball: Ball, dt: number, d: StrikeDecision | null): void {
  if (!d) return;
  ruleFor(d.kind)?.step?.(sc, ball, dt, d);
}
