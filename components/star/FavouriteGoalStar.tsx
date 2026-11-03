"use client";

/**
 * The ⭐ that keeps one of your goals as a favourite (Leo, 31 Oct 2026: "u
 * should be able to save which goals u want, like ur favourite ones").
 * Leo's update part "seasonEnd" only, and only when the career screen has
 * published the favourites (lib/star/favouriteGoalsStore.ts): otherwise it
 * draws nothing.
 *
 *  - FavouriteStar: a goal of the list (Stats → Goals).
 *  - FavouriteForClips: under a goal video in the feed; shown when exactly
 *    one of its recordings is a goal of yours.
 */
import { useMemo } from "react";
import { useLeoUpdate } from "@/lib/star/leoUpdate";
import { toggleFavouriteGoal, useFavouriteGoals } from "@/lib/star/favouriteGoalsStore";
import { goalOfClip } from "@/lib/star/favouriteGoals";

export function useFavouritesOn(): boolean {
  const on = useLeoUpdate("seasonEnd");
  const favs = useFavouriteGoals();
  return on && favs.ready;
}

export function FavouriteStar({ goalId, className = "" }: { goalId: string; className?: string }) {
  const on = useFavouritesOn();
  const favs = useFavouriteGoals();
  if (!on) return null;
  const fav = favs.favs.has(goalId);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleFavouriteGoal(goalId); }}
      className={`kib-press grid h-11 w-11 shrink-0 place-items-center text-[22px] leading-none ${fav ? "text-amber-300" : "text-white/55"} ${className}`}
      aria-label={fav ? "Remove from favourites" : "Save as a favourite"}
      aria-pressed={fav}
      data-goal-fav={fav ? "on" : "off"}
    >
      {fav ? "★" : "☆"}
    </button>
  );
}

export function FavouriteForClips({ clipIds }: { clipIds: string[] }) {
  const on = useFavouritesOn();
  const favs = useFavouriteGoals();
  const key = clipIds.join(",");
  const goal = useMemo(() => {
    const mine = clipIds.map((id) => goalOfClip(favs.log, id)).filter((g) => !!g);
    return mine.length === 1 ? mine[0] : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, favs.log]);
  if (!on || !goal) return null;
  const fav = favs.favs.has(goal.id);
  return (
    <button
      onClick={() => toggleFavouriteGoal(goal.id)}
      className={`flex items-center gap-1 whitespace-nowrap ${fav ? "text-amber-300" : "hover:text-white"}`}
      aria-pressed={fav}
      data-goal-video-fav={fav ? "on" : "off"}
    >
      <span className="text-[15px] leading-none" aria-hidden>{fav ? "★" : "☆"}</span>
      {fav ? "Favourite ✓" : "Favourite"}
    </button>
  );
}
