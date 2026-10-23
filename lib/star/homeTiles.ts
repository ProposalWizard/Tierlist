/**
 * WHERE HOME'S FOUR NUMBERS SIT — Settings → "Home numbers: Sides | Top".
 *
 * Mikey, 22 Oct 2026 (master plan, his reply): "move them to the left and
 * right … goals and assists on the right and rep and fame on the left. But
 * also make it so that I can revert that change … very easily. And also make
 * it a toggle in the settings."
 *
 *   "sides" (default): Rep and Fame down the left of the player, Goals and
 *                      Assists down the right.
 *   "top":             the row of four under the next match, as before.
 *
 * Per device, like the other look switches. To put "top" back as the
 * default for everyone, change HOME_TILES_DEFAULT.
 */
import { useSyncExternalStore } from "react";

export type HomeTiles = "sides" | "top";
export const HOME_TILES_KEY = "star-home-tiles";
export const HOME_TILES_DEFAULT: HomeTiles = "sides";

let now: HomeTiles | undefined;
const listeners = new Set<() => void>();

function read(): HomeTiles {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(HOME_TILES_KEY) : null;
    return v === "sides" || v === "top" ? v : HOME_TILES_DEFAULT;
  } catch {
    return HOME_TILES_DEFAULT;
  }
}

export function homeTiles(): HomeTiles {
  if (now === undefined) now = read();
  return now;
}

export function setHomeTiles(v: HomeTiles): void {
  try { localStorage.setItem(HOME_TILES_KEY, v); } catch { /* in-memory still changes */ }
  now = v;
  listeners.forEach((f) => f());
}

export function useHomeTiles(): HomeTiles {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    homeTiles, () => HOME_TILES_DEFAULT,
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === HOME_TILES_KEY) { now = undefined; listeners.forEach((f) => f()); }
  });
}
