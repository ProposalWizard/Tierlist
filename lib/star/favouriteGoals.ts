/**
 * YOUR FAVOURITE GOALS (Leo, 31 Oct 2026: "u should be able to save which
 * goals u want, like ur favourite ones").
 *
 * A ⭐ on a goal (season video, Stats → Goals, a feed video of your goal)
 * keeps it as a favourite. The list is CareerGoal ids in the career save
 * (CareerState.favouriteGoals), so it follows you to every device. Their
 * recordings are never pruned on the phone that has them
 * (favouriteClipIds, read by the prune in app/star-dev/page.tsx).
 *
 * Pure. Tests: tests/star/seasonEnd.mts.
 */
import type { CareerState } from "./types";
import type { CareerGoal } from "./goalLog";

/** The most favourites a save keeps (about 40 bytes each). */
export const FAVOURITES_MAX = 300;

export function favouriteIds(career: CareerState | null | undefined): string[] {
  return career?.favouriteGoals ?? [];
}

export function isFavourite(career: CareerState | null | undefined, goalId: string): boolean {
  return favouriteIds(career).includes(goalId);
}

/** The list after a ⭐ tap: added at the end, or taken off. Pure. */
export function toggleFavouriteIn(list: readonly string[], goalId: string): string[] {
  if (list.includes(goalId)) return list.filter((x) => x !== goalId);
  const next = [...list, goalId];
  return next.length > FAVOURITES_MAX ? next.slice(next.length - FAVOURITES_MAX) : next;
}

/** The career after a ⭐ tap on this goal. Only goals of your own log count. */
export function toggleFavourite(career: CareerState, goalId: string): CareerState {
  if (!(career.goalLog ?? []).some((g) => g.id === goalId) && !isFavourite(career, goalId)) return career;
  return { ...career, favouriteGoals: toggleFavouriteIn(favouriteIds(career), goalId) };
}

/** Your favourite goals, in the order they were scored. */
export function favouriteGoals(career: CareerState | null | undefined): CareerGoal[] {
  const favs = new Set(favouriteIds(career));
  if (!favs.size) return [];
  return (career?.goalLog ?? []).filter((g) => favs.has(g.id));
}

/** The recordings of your favourites: never pruned from this phone. */
export function favouriteClipIds(career: CareerState | null | undefined): string[] {
  return favouriteGoals(career).map((g) => g.clipId).filter((x): x is string => !!x);
}

/** The goal of yours a recording belongs to (a feed video's ⭐). */
export function goalOfClip(log: readonly CareerGoal[], clipId: string): CareerGoal | undefined {
  return log.find((g) => g.clipId === clipId);
}
