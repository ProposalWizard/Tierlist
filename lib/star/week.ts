import type { CareerState } from "./types";
import { getTuning } from "./tuningStore";

/**
 * THE WEEK BETWEEN MATCHES
 *
 * Three things a week between matches — train a skill, work on a relationship,
 * or actually rest. Energy is spent by playing (see creditMatchResult) and
 * earned back by a deliberate choice — Rest — OR, for any action you leave
 * unspent, automatically the moment you actually go to play the next match:
 * `projectedEnergy` below is what that credit will be, read by the pre-match
 * screen so it shows the real number you're about to have rather than the
 * stale one from before this week's actions were accounted for, and applied
 * for real (see app/star-dev/page.tsx's `handlePlayMatch`) the moment you
 * commit to playing — not merely by navigating to look at the pre-match
 * screen, so backing out to train or rest instead still spends those actions
 * normally. There used to be a separate "Skip to Match Day" button for this;
 * removed on request — it did the same thing an unused action already does
 * automatically, just for a different, inconsistent amount, and pressing it
 * was never really what was being asked for. What energy is never given back
 * by is the week simply turning over regardless of what was actually done
 * with it — an earlier version topped itself up automatically every week no
 * matter what, which made it a number that moved on its own rather than
 * something you managed; training a skill or working on a relationship is
 * still a real trade against resting THAT action, same as it always was.
 * See CareerState.energy's own doc comment.
 */

/**
 * How many things you can do between matches, and what Rest buys back — all
 * editable at /star-tuning-dev (see lib/star/tuning.ts). Read once, at
 * module load, the same way these were a plain hardcoded `const` before —
 * an edit in the tuning editor takes effect next time the app loads, not
 * instantly mid-session.
 */
export const WEEK_ACTIONS = getTuning("energy.weekActions");
export const REST_HAPPINESS = getTuning("energy.restHappiness");
/** What Rest buys back, alongside happiness — and what every action you
 *  instead leave unspent is worth too, credited automatically the moment
 *  you actually go and play (see `projectedEnergy` below). */
export const REST_ENERGY = getTuning("energy.restEnergy");

export function actionsLeft(career: CareerState): number {
  return career.weekActions ?? WEEK_ACTIONS;
}

export function canAct(career: CareerState): boolean {
  return actionsLeft(career) > 0;
}

/**
 * Spend one of the week's actions.
 *
 * Returns the career unchanged when there is nothing left to spend, so a caller
 * that forgets to check cannot go negative — the screens disable the buttons,
 * and this is the backstop.
 */
export function spendAction(career: CareerState): CareerState {
  const left = actionsLeft(career);
  if (left <= 0) return career;
  return { ...career, weekActions: left - 1 };
}

/** Put your feet up. Costs a day, buys back some happiness and energy. */
export function rest(career: CareerState): CareerState {
  if (!canAct(career)) return career;
  return {
    ...spendAction(career),
    happiness: Math.min(100, career.happiness + REST_HAPPINESS),
    energy: Math.min(100, career.energy + REST_ENERGY),
  };
}

/**
 * What your energy will actually be once you go and play — every action
 * still sitting unspent this week counts for exactly what Rest would have
 * given it, added on top of where you are now and capped at 100.
 *
 * Requested directly: not having to press Rest three separate times just to
 * bank the energy an otherwise-empty week was going to hand back anyway —
 * this is that credit, computed rather than manually claimed. The pre-match
 * screen reads it to show what you're really about to have; `handlePlayMatch`
 * (app/star-dev/page.tsx) applies it for real — spending every remaining
 * action and setting `energy` to this — the moment you actually commit to
 * playing, not merely by looking at the screen first.
 */
export function projectedEnergy(career: CareerState): number {
  return Math.min(100, career.energy + actionsLeft(career) * REST_ENERGY);
}

/**
 * Roll the week over. Called wherever a fixture is settled — played or missed —
 * because that is what ends a week.
 */
export function startNewWeek(): { weekActions: number } {
  return { weekActions: WEEK_ACTIONS };
}
