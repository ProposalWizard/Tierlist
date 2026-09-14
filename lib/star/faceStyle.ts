"use client";

/**
 * How a real player's head draws on the pitch — a personal DISPLAY
 * preference, not a game fact, so it lives in localStorage on its own
 * rather than on CareerState (same reasoning as CanvasMatch.tsx's own
 * "star-match-muted"/"star-match-speed" keys): it never needs to sync
 * across devices or survive a save-slot switch.
 *
 * Superseded a plain single-number "face scale" slider — reported directly
 * as not enough: "i want a proper well made player graphic editor... move
 * the face around, adjust the size/scale, edit things like whether or not
 * theres a normal 'face' circle behind the face picture, add/edit an
 * outline with colour and size and thickness." See FaceEditorScreen.tsx
 * (the editor itself) and drawPlayerHead.ts (the one function that actually
 * draws a head, in a real match AND in that editor's own live preview, off
 * this exact same object — so what you see there is what draws, never a
 * separate approximation that can quietly drift out of sync).
 */
export interface FaceStyle {
  /** Multiplies the head's own base radius. 1.0 is the original, unscaled size. */
  scale: number;
  /** Horizontal nudge, in units of the head's own BASE (unscaled) radius. */
  offsetX: number;
  /** Vertical nudge, same units. */
  offsetY: number;
  /** The flat fill behind/around the photo. Always drawn regardless of this
   *  when there's no photo to show at all — see drawPlayerHead's own doc —
   *  so a head is never invisible just because this is off. */
  showBacking: boolean;
  backingColor: string;
  outlineEnabled: boolean;
  outlineColor: string;
  /** Multiplies the existing base stroke-width formula. 1.0 is the original width. */
  outlineWidth: number;
}

/** The exact figure-drawing SKIN colour (CanvasMatch.tsx), so "no photo, backing on" looks
 *  identical to how every head on the pitch has always looked. */
export const HEAD_SKIN = "#c68642";

export const DEFAULT_FACE_STYLE: FaceStyle = {
  scale: 1.4,
  offsetX: 0,
  offsetY: 0,
  showBacking: true,
  backingColor: HEAD_SKIN,
  outlineEnabled: true,
  outlineColor: "rgba(0,0,0,0.35)",
  outlineWidth: 1,
};

const KEY = "star-face-style";
const LEGACY_SCALE_KEY = "star-face-scale";

function sanitize(partial: Partial<FaceStyle>): FaceStyle {
  const s = { ...DEFAULT_FACE_STYLE, ...partial };
  return {
    scale: clamp(numberOr(s.scale, DEFAULT_FACE_STYLE.scale), 0.5, 3),
    offsetX: clamp(numberOr(s.offsetX, 0), -1, 1),
    offsetY: clamp(numberOr(s.offsetY, 0), -1, 1),
    showBacking: !!s.showBacking,
    backingColor: typeof s.backingColor === "string" && s.backingColor ? s.backingColor : HEAD_SKIN,
    outlineEnabled: !!s.outlineEnabled,
    outlineColor: typeof s.outlineColor === "string" && s.outlineColor ? s.outlineColor : DEFAULT_FACE_STYLE.outlineColor,
    outlineWidth: clamp(numberOr(s.outlineWidth, 1), 0, 4),
  };
}

function numberOr(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function loadFaceStyle(): FaceStyle {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
    // A scale picked via the old slider, before this editor existed — carried
    // over once rather than silently discarded the first time this runs.
    const legacyScale = Number(localStorage.getItem(LEGACY_SCALE_KEY));
    if (Number.isFinite(legacyScale) && legacyScale > 0) return sanitize({ scale: legacyScale });
  } catch { /* fall through to default */ }
  return DEFAULT_FACE_STYLE;
}

export function saveFaceStyle(style: FaceStyle): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitize(style)));
  } catch { /* ignore — worst case the preference just doesn't stick */ }
}
