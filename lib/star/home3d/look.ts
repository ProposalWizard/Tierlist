/**
 * THE HOUSE'S LOOK SWITCH — Settings → Look → "House: New | Old".
 * One phone at a time, New by default.
 *
 * Harry, 9 Oct 2026: "the house being 1 room is a bit dead, the bigger the
 * house the bigger the space/rooms etc." New: a home of rooms you walk
 * through (homes.ts TIER_ROOMS: a house has a hallway, a lounge, a dressing
 * room and a trophy room). Old: the one room, exactly as it was. Harry's
 * standing rule (3 Oct 2026): every new look gets a toggle and the old one
 * stays playable. Same pattern as the garden's (../garden3d/look.ts).
 */
import { useSyncExternalStore } from "react";

export type HouseLook = "new" | "old";
export const HOUSE_LOOK_KEY = "star-house-look";
let stored: HouseLook | undefined;
const listeners = new Set<() => void>();

function read(): HouseLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(HOUSE_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === HOUSE_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function houseLook(): HouseLook {
  if (stored === undefined) stored = read();
  return stored;
}

/** Has this phone ever stored a choice? (A Classic phone takes Old once: gameVersions.ts.) */
export function houseLookStored(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(HOUSE_LOOK_KEY) !== null; } catch { return false; }
}

export function setHouseLook(v: HouseLook): void {
  try { localStorage.setItem(HOUSE_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useHouseLook(): HouseLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    houseLook, () => "new" as const,
  );
}
