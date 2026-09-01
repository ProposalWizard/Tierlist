import type { CareerState, GoalReplay } from "./types";

/**
 * GOAL REPLAYS.
 *
 * The physics are a real, seeded simulation (see GoalReplay's own doc and
 * CanvasMatch's rngCallCountRef), so a goal can be watched again exactly as
 * it happened. Two pools, on purpose: `recentGoals` is what you've actually
 * scored lately, capped and churning as new ones arrive; `savedReplays` is a
 * real choice out of that pool — up to three, deliberately kept, immune to
 * the recent pool's own churn.
 *
 * Currently wired up only behind Settings' admin-only "Goal Replays"
 * section — see SettingsScreen.tsx — for testing before it's a real,
 * everybody-gets-it feature.
 */

/** How many recent goals stay available to choose a replay from. */
export const RECENT_GOALS_MAX = 8;
/** How many of those you can deliberately keep. */
export const SAVED_REPLAYS_MAX = 3;

/** A freshly-scored goal, dropped in at the front — oldest falls off the cap. */
export function addRecentGoal(career: CareerState, replay: GoalReplay): CareerState {
  return { ...career, recentGoals: [replay, ...(career.recentGoals ?? [])].slice(0, RECENT_GOALS_MAX) };
}

/** The first empty saved slot, or -1 if all three are already taken. */
export function firstEmptySlot(career: CareerState): number {
  const saved = career.savedReplays ?? [];
  return saved.length < SAVED_REPLAYS_MAX ? saved.length : -1;
}

/** Keep a goal in slot `index` (0-2), replacing whatever was there. */
export function saveReplayToSlot(career: CareerState, index: number, replay: GoalReplay): CareerState {
  const saved = [...(career.savedReplays ?? [])];
  saved[index] = replay;
  return { ...career, savedReplays: saved.slice(0, SAVED_REPLAYS_MAX) };
}

/** Free up a saved slot. */
export function deleteSavedReplay(career: CareerState, id: string): CareerState {
  return { ...career, savedReplays: (career.savedReplays ?? []).filter(r => r.id !== id) };
}
