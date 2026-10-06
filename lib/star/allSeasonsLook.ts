/**
 * THE ALL SEASONS PAGE'S LOOK SWITCH — Settings → Look → "All seasons:
 * New | Old". One phone at a time, New by default.
 *
 * Leo, 5 Oct 2026: put the career overview's seasons list, its goals-by-
 * season chart and its cabinet into the in-game All seasons page. New is
 * that (components/star/AllSeasonsNew.tsx). Old is the page as it was: three
 * tables (StatsTabs' AllSeasons). Every new look gets a toggle and the old
 * one stays (Harry, 3 Oct 2026). Same pattern as lib/star/garden3d/look.ts.
 */
import { useSyncExternalStore } from "react";

export type AllSeasonsLook = "new" | "old";
export const ALL_SEASONS_LOOK_KEY = "star-all-seasons-look";
let stored: AllSeasonsLook | undefined;
const listeners = new Set<() => void>();

function read(): AllSeasonsLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(ALL_SEASONS_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ALL_SEASONS_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function allSeasonsLook(): AllSeasonsLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setAllSeasonsLook(v: AllSeasonsLook): void {
  try { localStorage.setItem(ALL_SEASONS_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useAllSeasonsLook(): AllSeasonsLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    allSeasonsLook, () => "new" as const,
  );
}
