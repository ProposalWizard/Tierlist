/**
 * POST-MATCH REACTIONS — ON BY DEFAULT, TURN-OFF-ABLE.
 *
 * Requested directly: after seeing your rating and match money, some players
 * would rather go straight back to the dashboard than always pass through
 * the phone/media screen. A per-device UI preference, not game data — same
 * convention as match speed and mute (CanvasMatch.tsx's own
 * `star-match-speed`/`star-match-muted` localStorage keys) rather than
 * anything stored on CareerState, since it's about how THIS device shows the
 * game, not a fact about the career itself.
 */

const KEY = "star-postmatch-reactions";

export function getPostMatchReactionsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function setPostMatchReactionsEnabled(enabled: boolean): void {
  try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
}
