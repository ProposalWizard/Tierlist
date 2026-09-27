/**
 * MATCH-DAY PREFERENCES (v0.15). Per-device, not career data — the same
 * convention as postMatchPrefs.ts and the match speed/mute keys.
 *
 *   - Live-score notifications (item 35): the clubs whose goals pop up during
 *     your match. None are ticked by default.
 *   - Developer info (item 24): the substitute's minute and ladder on the
 *     pre-match card. Off for normal players; Settings → Developer tools.
 */

const FOLLOW_KEY = "star-live-score-teams";
const DEV_INFO_KEY = "star-dev-info";

/** The clubs you have ticked for live-score notifications. */
export function followedTeams(): string[] {
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function setFollowedTeams(clubs: string[]): void {
  try { localStorage.setItem(FOLLOW_KEY, JSON.stringify(Array.from(new Set(clubs)))); } catch { /* ignore */ }
}

/** Tick or untick one club. Returns the new list. */
export function toggleFollowedTeam(club: string): string[] {
  const now = followedTeams();
  const next = now.includes(club) ? now.filter((c) => c !== club) : [...now, club];
  setFollowedTeams(next);
  return next;
}

/** Developer info on screen (the sub's planned minute and ladder). Off by default. */
export function devInfoOn(): boolean {
  try { return localStorage.getItem(DEV_INFO_KEY) === "1"; } catch { return false; }
}

export function setDevInfo(on: boolean): void {
  try { localStorage.setItem(DEV_INFO_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}
