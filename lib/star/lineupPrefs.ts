/**
 * SKIP THE LINE-UP ANIMATION — OFF BY DEFAULT (v0.23.1, P30/P75: "you could
 * literally just go straight into this … it could just be an ability to turn
 * it off, like the post-match reactions").
 *
 * A per-device preference, the same shape as postMatchPrefs.ts. On: Play goes
 * straight from the energy check into the match. Off: the line-up draws in
 * and kicks off by itself (a tap anywhere still skips ahead).
 */
const KEY = "star-skip-lineup";

export function getSkipLineup(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setSkipLineup(skip: boolean): void {
  try { localStorage.setItem(KEY, skip ? "1" : "0"); } catch { /* ignore */ }
}
