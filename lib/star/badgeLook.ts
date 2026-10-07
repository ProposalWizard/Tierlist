/**
 * CLUB BADGES LOOK SWITCH — Settings → Look → "Club badges: New | Old".
 * One phone at a time, New by default.
 *
 * Harry's standing rule (3 Oct 2026): every new look gets a toggle and the
 * old one stays playable. New = the drawn badges (lib/star/clubBadge.ts).
 * Old = the kit-colour circle with the club's initials.
 */
import { useSyncExternalStore } from "react";

export type BadgeLook = "new" | "old";
export const BADGE_LOOK_KEY = "star-badge-look";
let stored: BadgeLook | undefined;
const listeners = new Set<() => void>();

function read(): BadgeLook {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(BADGE_LOOK_KEY) === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === BADGE_LOOK_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function badgeLook(): BadgeLook {
  if (stored === undefined) stored = read();
  return stored;
}

export function setBadgeLook(v: BadgeLook): void {
  try { localStorage.setItem(BADGE_LOOK_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

export function useBadgeLook(): BadgeLook {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    badgeLook, () => "new" as const,
  );
}
