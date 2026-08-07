import type { CareerState } from "./types";

/**
 * THE WEEK BETWEEN MATCHES
 *
 * Energy was a one-way street. It started at 100, cost 40 a match and 15 a
 * training session, and — outside an NRG drink, a missed week or the occasional
 * dilemma — never came back. Eighteen league matches drain 720 against a pool of
 * 100, so after two or three games you sat pinned at the floor and could never
 * train again for the rest of the career. The one currency the whole life side
 * of the game runs on was unspendable by the third week of the first season.
 *
 * So a week is now a week: you rest between matches and get some of it back, and
 * what you do with the days you have is a choice rather than a formality. Three
 * things a week — train a skill, work on a relationship, or actually rest — and
 * training three times costs more than a week gives you back, which is the whole
 * tension. You cannot max everything; you pick.
 */

/** How many things you can do between matches. */
export const WEEK_ACTIONS = 3;
/** Energy a normal week between matches returns on its own. */
export const WEEK_RECOVERY = 45;
/** …and what spending one of your three on doing nothing else is worth. */
export const REST_ENERGY = 35;
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

/** Put your feet up. Costs a day, buys back a real amount of energy. */
export function rest(career: CareerState): CareerState {
  if (!canAct(career)) return career;
  return {
    ...spendAction(career),
    energy: Math.min(100, career.energy + REST_ENERGY),
    happiness: Math.min(100, career.happiness + REST_HAPPINESS),
  };
}

/**
 * Roll the week over. Called wherever a fixture is settled — played or missed —
 * because that is what ends a week.
 */
export function startNewWeek(energy: number): { energy: number; weekActions: number } {
  return {
    energy: Math.min(100, energy + WEEK_RECOVERY),
    weekActions: WEEK_ACTIONS,
  };
}
