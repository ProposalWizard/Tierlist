/**
 * THE HOME SCREEN LOOK SWITCH — Settings → Look → "Home screen:
 * New | Old". One phone at a time, New by default.
 *
 * Harry, 9 Oct 2026 (screenshots of Home and the title): "I think we just
 * need the players to look really fun and good", "remove the goal … (goals in
 * the middle of the pitch)", "make the rep/fame + goals and assists and the
 * cans more prominent". New = big stat tiles and cans near the top, no goal,
 * your player through one hook (components/star/HomePlayer.tsx). Old = Home
 * and the title exactly as they were. Every new look gets a toggle and the
 * old one stays (Harry, 3 Oct 2026). Same pattern as allSeasonsLook.ts.
 */
import { useSyncExternalStore } from "react";

export type HomeLook = "new" | "old";
export const HOME_LOOK_KEY = "star-home-look";
let stored: HomeLook | undefined;
const listeners = new Set<() => void>();

function read(): HomeLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(HOME_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === HOME_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function homeLook(): HomeLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setHomeLook(v: HomeLook): void {
  try { localStorage.setItem(HOME_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useHomeLook(): HomeLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    homeLook, () => "new" as const,
  );
}
