/**
 * THE TRIAL'S PENALTY SHOOTOUT — RIGGED SO YOU TAKE THE WINNING KICK.
 *
 * Harry (1 Oct 2026, reviewing the v0.20 trial): "If anything we should do a
 * full pen shootout where it rigs the game so it always has you having to
 * score the winning pen, and that's how it should end. So maybe the other ones
 * are all one attempt, it's just a tutorial on how to play the game, and then
 * you get a pen shootout to really enjoy that." And, answering the page's
 * questions: Trialist versus Academy; "do up to three on the shootout"; both
 * keepers get harder each kick; the bad-luck events stay.
 *
 * ── The rig, in one rule ──
 *
 * Academy go first in every round and you go second. **Academy score only if
 * you are ahead; otherwise they miss.** So the score is level every time it
 * is your turn, and level before your LAST kick means that kick is the
 * winning penalty: score it and the shootout is yours, miss it and it stays
 * level. It does not matter what you do with kicks one and two: miss both
 * and Academy miss all three; score both and they score their second and
 * third. Checked over every one of your 8 possible runs in
 * tests/star/trialShootoutRig.mts.
 *
 * Whether your last kick went in is the one number the trial hands on: it
 * tilts where the scout who spotted you sends you (lib/star/scoutedPlacement.ts).
 *
 * ── Their kicks are the real engine's, and decided before they are struck ──
 *
 * Their kick is struck by the match itself (penaltyTaking.ts's automatic kick,
 * the same strike a player's kick goes through). What the rig decides is the
 * PLAN that kick is given, and how their keeper-facing read is set:
 *
 *  - a miss: aimed 5.2 m off centre, 2 m past the post — wide, every time
 *    (measured on the real engine: 1,200 of 1,200 wide).
 *  - a goal: tucked into the corner (3.3 m off centre, 0.35 m inside the post)
 *    along the grass at pace, with YOUR keeper guessing the wrong way (his
 *    "read" set to 0, his dive still on). Measured: 1,996 of 2,000 in, at
 *    the strongest keeper the shootout's ramp reaches (88), and 1,999 of
 *    2,000 at the middle one.
 *
 * Nothing here moves a ball. Pure: no React, no canvas.
 */
import type { PenaltyPlan } from "./penaltyTaking";
import { sameHeight } from "./penaltyTaking";

export type RigSide = "you" | "them";
export interface RigKick { side: RigSide; scored: boolean }
export interface RigState {
  kicks: RigKick[];
  over: boolean;
  /** "you" / "them" once decided; null while it is going on, and null at the
   *  end if your last kick missed (level — it would go to sudden death). */
  winner: RigSide | null;
}

/** Up to this many kicks each. Harry: "do up to three". */
export const SHOOTOUT_KICKS = 3;

export function createRig(): RigState {
  return { kicks: [], over: false, winner: null };
}

/** Academy first, you second, every round. */
export function rigNextSide(kicks: RigKick[]): RigSide {
  return kicks.length % 2 === 0 ? "them" : "you";
}

export function rigGoals(kicks: RigKick[], side: RigSide): number {
  return kicks.filter(k => k.side === side && k.scored).length;
}

export function rigKicksTaken(kicks: RigKick[], side: RigSide): number {
  return kicks.filter(k => k.side === side).length;
}

/** The rule: Academy score only when you are ahead of them. */
export function rigTheirIntent(kicks: RigKick[]): boolean {
  return rigGoals(kicks, "you") > rigGoals(kicks, "them");
}

/** Records the kick that was just taken. */
export function rigApply(state: RigState, scored: boolean): RigState {
  if (state.over) return state;
  const side = rigNextSide(state.kicks);
  const kicks = [...state.kicks, { side, scored }];
  const over = kicks.length >= SHOOTOUT_KICKS * 2;
  const yours = rigGoals(kicks, "you"), theirs = rigGoals(kicks, "them");
  return {
    kicks,
    over,
    winner: over ? (yours > theirs ? "you" : theirs > yours ? "them" : null) : null,
  };
}

/** Is the kick that is up now your LAST — the winning penalty? */
export function isWinningPenalty(state: RigState): boolean {
  return !state.over && rigNextSide(state.kicks) === "you"
    && rigKicksTaken(state.kicks, "you") === SHOOTOUT_KICKS - 1;
}

/** Did your last kick go in? `false` while unfinished or if it missed. */
export function winningPenaltyScored(state: RigState): boolean {
  if (!state.over) return false;
  const last = state.kicks[state.kicks.length - 1];
  return !!last && last.side === "you" && last.scored;
}

/** Their goal: along the grass into the corner, 0.35 m inside the post. */
export const RIG_GOAL_OFF = 3.3;
export const RIG_GOAL_POWER = 0.94;
export const RIG_GOAL_CONTACT = -0.8;
/** Their miss: 2 m past the post. */
export const RIG_MISS_OFF = 5.2;
export const RIG_MISS_POWER = 0.75;

/**
 * The plan their kick is struck with. `techniqueOfTaker` is his rating (the
 * engine turns it into accuracy and the contact into a height — `sameHeight`
 * is the same correction every planned penalty gets).
 */
export function rigPlanFor(scores: boolean, side: 1 | -1, techniqueOfTaker: number): PenaltyPlan {
  return scores
    ? { style: "placed", off: side * RIG_GOAL_OFF, power: RIG_GOAL_POWER, cy: sameHeight(RIG_GOAL_CONTACT, techniqueOfTaker) }
    : { style: "placed", off: side * RIG_MISS_OFF, power: RIG_MISS_POWER, cy: sameHeight(0, techniqueOfTaker) };
}

/**
 * The keeper's read, for their kick: on a rigged goal he still dives (so it
 * looks like a save that did not come off) but guesses your corner wrong.
 */
export function rigKeeperRead<R extends { readChance: number }>(scores: boolean, read: R): R {
  return scores ? { ...read, readChance: 0 } : read;
}
