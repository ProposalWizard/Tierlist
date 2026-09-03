import type { CareerState } from "./types";

/**
 * THE WEEK BETWEEN MATCHES
 *
 * Three things a week between matches — train a skill, work on a relationship,
 * or actually rest. Energy is spent by playing (see creditMatchResult) and
 * earned back by a deliberate choice here — Rest, or skipping the rest of
 * the week outright — OR, for any action you leave unspent, automatically
 * the moment the next match starts (creditMatchResult credits REST_ENERGY
 * per unspent action there). What it is never given back by is the week
 * simply turning over regardless of what was actually done with it — an
 * earlier version of energy topped itself up automatically every week no
 * matter what, which made it a number that moved on its own rather than
 * something you managed; training a skill or working on a relationship is
 * still a real trade against resting THAT action, same as it always was.
 * See CareerState.energy's own doc comment.
 */

/** How many things you can do between matches. */
export const WEEK_ACTIONS = 3;
export const REST_HAPPINESS = 6;
/** What Rest buys back, alongside happiness — a modest top-up since it only
 *  costs one of the three actions and leaves the rest of the week free. */
export const REST_ENERGY = 20;
/** What skipping the rest of the week buys back — bigger, because it costs
 *  everything else you could have done this week instead. */
export const SKIP_ENERGY = 45;

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
 * Give up on the rest of this week's actions and coast to matchday instead.
 *
 * The literal "regenerates when skipping to the end of the week" — a real
 * trade against training or working on a relationship this week, not a free
 * top-up. Guarded on `canAct` the same way `rest` is: with no actions left
 * there is nothing left to give up, so this is a no-op rather than a second
 * helping of energy on top of whatever the week already spent.
 */
export function skipToMatchDay(career: CareerState): CareerState {
  if (!canAct(career)) return career;
  return {
    ...career,
    weekActions: 0,
    energy: Math.min(100, career.energy + SKIP_ENERGY),
  };
}

/**
 * Roll the week over. Called wherever a fixture is settled — played or missed —
 * because that is what ends a week.
 */
export function startNewWeek(): { weekActions: number } {
  return { weekActions: WEEK_ACTIONS };
}
