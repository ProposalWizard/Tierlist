import type { CareerState } from "./types";

/**
 * THE WEEK BETWEEN MATCHES
 *
 * Three things a week between matches — train a skill, work on a relationship,
 * or actually rest. Energy used to be the currency this budget was spent
 * against; it has been pulled out of the game for now (see CLAUDE.md's Future
 * Work note), so the three-actions-a-week structure is what remains of the
 * tension — you still cannot do everything, you still pick.
 */

/** How many things you can do between matches. */
export const WEEK_ACTIONS = 3;
export const REST_HAPPINESS = 6;

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

/** Put your feet up. Costs a day, buys back some happiness. */
export function rest(career: CareerState): CareerState {
  if (!canAct(career)) return career;
  return {
    ...spendAction(career),
    happiness: Math.min(100, career.happiness + REST_HAPPINESS),
  };
}

/**
 * Roll the week over. Called wherever a fixture is settled — played or missed —
 * because that is what ends a week.
 */
export function startNewWeek(): { weekActions: number } {
  return { weekActions: WEEK_ACTIONS };
}
