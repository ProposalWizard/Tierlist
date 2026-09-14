"use client";

/**
 * How big a real player's photo draws on the pitch — a personal display
 * preference, not a game fact, so it lives in localStorage on its own
 * rather than on CareerState (same idea as "star-match-muted"/
 * "star-match-speed" in CanvasMatch.tsx): it never needs to sync across
 * devices or survive a save-slot switch, and adding it here risked no
 * migration, no save-schema change, nothing cloud-side to get wrong.
 *
 * Reported directly, from a real phone screenshot: the plain head circle
 * every figure has always drawn was barely big enough to tell two players
 * apart even before a photo was involved — "way too small i can barely see
 * their faces or who it is". DEFAULT is deliberately bigger than the old,
 * unscaled 1.0 baseline so the fix is felt immediately; the slider (see
 * FaceScalePanel) is the real answer, since there's no visually-verified
 * "correct" size to land on without a live look at an actual phone.
 */
const KEY = "star-face-scale";
export const FACE_SCALE_MIN = 1;
export const FACE_SCALE_MAX = 2.2;
export const FACE_SCALE_DEFAULT = 1.4;

function clampScale(n: number): number {
  return Math.min(FACE_SCALE_MAX, Math.max(FACE_SCALE_MIN, n));
}

export function loadFaceScale(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return FACE_SCALE_DEFAULT;
    const n = Number(raw);
    return Number.isFinite(n) ? clampScale(n) : FACE_SCALE_DEFAULT;
  } catch {
    return FACE_SCALE_DEFAULT;
  }
}

export function saveFaceScale(scale: number): void {
  try {
    localStorage.setItem(KEY, String(clampScale(scale)));
  } catch { /* ignore — worst case the preference just doesn't stick */ }
}
