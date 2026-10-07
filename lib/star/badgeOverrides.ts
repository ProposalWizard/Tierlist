/**
 * BADGE REDOS — what someone changed on /admin/badges (a different pattern,
 * a different symbol, or none). Kept in this browser only: there is no shared
 * table for badges yet, and the page says so. The game on the same device
 * draws the redo too, so it can be judged in place.
 *
 * "Copy changes" on /admin/badges gives the list as text, so a redo worth
 * keeping can be put into the code for everyone.
 */
import { useSyncExternalStore } from "react";
import type { BadgeOverride } from "./clubBadge";

export const BADGE_OVERRIDES_KEY = "star-badge-overrides";
const EMPTY: Record<string, BadgeOverride> = {};
let stored: Record<string, BadgeOverride> | undefined;
const listeners = new Set<() => void>();

function read(): Record<string, BadgeOverride> {
  try {
    if (typeof localStorage === "undefined") return EMPTY;
    const raw = localStorage.getItem(BADGE_OVERRIDES_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, BadgeOverride>) : EMPTY;
  } catch {
    return EMPTY;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === BADGE_OVERRIDES_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

export function badgeOverrides(): Record<string, BadgeOverride> {
  if (stored === undefined) stored = read();
  return stored;
}

/** Set (or with null, clear) one club's redo. */
export function setBadgeOverride(club: string, o: BadgeOverride | null): void {
  const next = { ...badgeOverrides() };
  if (o && Object.keys(o).length) next[club] = o;
  else delete next[club];
  stored = next;
  try { localStorage.setItem(BADGE_OVERRIDES_KEY, JSON.stringify(next)); } catch { /* in-memory still changes */ }
  listeners.forEach((f) => f());
}

export function clearBadgeOverrides(): void {
  stored = {};
  try { localStorage.removeItem(BADGE_OVERRIDES_KEY); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}

export function useBadgeOverrides(): Record<string, BadgeOverride> {
  return useSyncExternalStore(
    (f) => { listeners.add(f); return () => { listeners.delete(f); }; },
    badgeOverrides, () => EMPTY,
  );
}
