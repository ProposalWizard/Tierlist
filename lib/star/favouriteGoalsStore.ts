/**
 * The ⭐ favourites, shared with every screen without threading the career
 * through each one (the season video, Stats → Goals, a goal video deep in the
 * feed).
 *
 * The career screen (app/star-dev/page.tsx) publishes the goal log, the
 * favourites and how to change them; a ⭐ button reads them here and calls
 * toggle. The change itself is lib/star/favouriteGoals.ts toggleFavourite,
 * run by the page on its own career, so the save stays the one source.
 * Nothing is published = no ⭐ button anywhere (test pages publish their own).
 */
import { useSyncExternalStore } from "react";
import type { CareerGoal } from "./goalLog";

export interface FavouritesSnap {
  /** Someone published: ⭐ buttons can show. */
  ready: boolean;
  favs: ReadonlySet<string>;
  log: readonly CareerGoal[];
}

const EMPTY: FavouritesSnap = { ready: false, favs: new Set(), log: [] };
let snap: FavouritesSnap = EMPTY;
let onToggle: ((goalId: string) => void) | null = null;
const listeners = new Set<() => void>();

function emit() { for (const l of Array.from(listeners)) l(); }

/** The career screen's goal log and favourites, and how a ⭐ tap changes them. */
export function publishFavourites(log: readonly CareerGoal[], favs: readonly string[], toggle: (goalId: string) => void): void {
  onToggle = toggle;
  const same = snap.ready && snap.log === log && snap.favs.size === favs.length && favs.every((f) => snap.favs.has(f));
  if (same) return;
  snap = { ready: true, favs: new Set(favs), log };
  emit();
}

/** The screen went away: no ⭐ until it comes back. */
export function unpublishFavourites(): void {
  onToggle = null;
  if (snap === EMPTY) return;
  snap = EMPTY;
  emit();
}

export function toggleFavouriteGoal(goalId: string): void {
  onToggle?.(goalId);
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
const get = () => snap;
const getServer = () => EMPTY;

/** React: the favourites, live. */
export function useFavouriteGoals(): FavouritesSnap {
  return useSyncExternalStore(subscribe, get, getServer);
}
