"use client";
import type { CropView } from "./portrait";

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
 *
 * `crop` was added after real player photos turned out to be plain
 * rectangles (neck and shirt included), not the alpha-cut-out headshots an
 * earlier version assumed — reported directly: "some of the picture is in
 * it that i dont want in it, like the neck and a bit of the shirt." Reuses
 * `CropView`/`sourceRect` (lib/star/portrait.ts) — the exact same pan/zoom
 * math the existing "Your photo" picker (PortraitPicker.tsx) already uses —
 * rather than a second copy of that geometry.
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
  /** Which part of a REAL PHOTO's own rectangle shows inside the head circle
   *  — one shared crop applied to every real player's photo alike, same as
   *  every other field here. Defined in units of CROP_VIEWPORT, exactly the
   *  way PortraitPicker's own crop stage defines its CropView. */
  crop: CropView;
  /** Master on/off for real photos. Off falls every figure back to the same
   *  plain backing-circle treatment a player with no photo on file already
   *  gets — see drawPlayerHead's own hasPhoto check — never an invisible head. */
  facesEnabled: boolean;
  /** Real names in clear text above each figure's head — a second, independent
   *  display mode requested alongside faces ("a toggle for player names
   *  instead"), not a replacement wired into drawPlayerHead itself: names draw
   *  upright in screen space via footballer()'s own existing label mechanism
   *  (CanvasMatch.tsx), since counter-rotating text to stay legible while a
   *  figure turns is a different problem than anything a head-circle style
   *  needs to solve. Off by default — an opt-in on top of faces, not instead
   *  of them, unless the user turns faces off too. */
  namesEnabled: boolean;
}

/** The exact figure-drawing SKIN colour (CanvasMatch.tsx), so "no photo, backing on" looks
 *  identical to how every head on the pitch has always looked. */
export const HEAD_SKIN = "#c68642";

/** The reference square the shared crop is defined against — see FaceStyle.crop.
 *  Only a unit of measurement for stored x/y; the Face Editor's own crop
 *  viewport is sized to exactly this many pixels so a drag needs no separate
 *  conversion factor, and drawPlayerHead reads it back at whatever size a
 *  given figure actually draws at, via sourceRect's own destination-agnostic
 *  math — never re-interpreted differently in the two places it's used. */
export const CROP_VIEWPORT = 256;

export const DEFAULT_FACE_STYLE: FaceStyle = {
  scale: 1.4,
  offsetX: 0,
  offsetY: 0,
  showBacking: true,
  backingColor: HEAD_SKIN,
  outlineEnabled: true,
  outlineColor: "rgba(0,0,0,0.35)",
  outlineWidth: 1,
  crop: { zoom: 1, x: 0, y: 0 },
  facesEnabled: true,
  namesEnabled: false,
};

const KEY = "star-face-style";
const LEGACY_SCALE_KEY = "star-face-scale";

// Widened directly on request ("give me more freedom to customise") after
// the original ±1 head-radius / 3x cap turned out too tight to put a face
// meaningfully higher or bigger than its default spot.
export const FACE_SCALE_RANGE: [number, number] = [0.5, 5];
export const FACE_OFFSET_RANGE: [number, number] = [-3, 3];
/** CropView.zoom range — 1 is "just covers the circle", matching that
 *  interface's own doc; above that is zoomed in. */
export const CROP_ZOOM_RANGE: [number, number] = [1, 4];

/** Exported so the global-default fetch (below) can clamp whatever an admin
 *  posted through exactly the same rules a locally-saved style already goes
 *  through — one real set of bounds, not a second copy of them. */
export function sanitize(partial: Partial<FaceStyle>): FaceStyle {
  const s = { ...DEFAULT_FACE_STYLE, ...partial };
  return {
    scale: clamp(numberOr(s.scale, DEFAULT_FACE_STYLE.scale), ...FACE_SCALE_RANGE),
    offsetX: clamp(numberOr(s.offsetX, 0), ...FACE_OFFSET_RANGE),
    offsetY: clamp(numberOr(s.offsetY, 0), ...FACE_OFFSET_RANGE),
    showBacking: !!s.showBacking,
    backingColor: typeof s.backingColor === "string" && s.backingColor ? s.backingColor : HEAD_SKIN,
    outlineEnabled: !!s.outlineEnabled,
    outlineColor: typeof s.outlineColor === "string" && s.outlineColor ? s.outlineColor : DEFAULT_FACE_STYLE.outlineColor,
    outlineWidth: clamp(numberOr(s.outlineWidth, 1), 0, 4),
    // Only a loose sanity clamp — x/y can't be meaningfully bounded without
    // a real image's own dimensions, which aren't available here. The real,
    // precise clamp (clampOffset, portrait.ts) runs at actual use time, both
    // in the editor's drag handler and effectively at draw time via
    // sourceRect, which is written to tolerate an out-of-range view anyway.
    crop: {
      zoom: clamp(numberOr(s.crop?.zoom, 1), ...CROP_ZOOM_RANGE),
      x: clamp(numberOr(s.crop?.x, 0), -4000, 4000),
      y: clamp(numberOr(s.crop?.y, 0), -4000, 4000),
    },
    facesEnabled: !!s.facesEnabled,
    namesEnabled: !!s.namesEnabled,
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

/**
 * True once this device has ever actually saved its own style — including
 * via the old single-slider key. Drives whether the admin's global default
 * (below) is allowed to apply: a real local override always wins, exactly
 * "unless the user changes it."
 */
export function hasFaceStyleOverride(): boolean {
  try {
    return localStorage.getItem(KEY) !== null || localStorage.getItem(LEGACY_SCALE_KEY) !== null;
  } catch { return false; }
}

/**
 * The admin's own global default (see supabase/migrations/
 * star_face_style_default.sql and app/api/star/face-style-default/route.ts)
 * — "an admin button to set the custom player face values as official and
 * global default values... so it naturally looks like that unless the user
 * changes it." Deliberately never written into the KEY a local override
 * lives under: callers apply the result to their own in-memory ref/state,
 * so a device that has never customised its own style keeps tracking
 * whatever the admin sets NEXT too, rather than freezing at whatever was
 * first fetched. Returns null on any failure (offline, or the migration
 * hasn't been run yet) — callers fall back to DEFAULT_FACE_STYLE, same as
 * every other pending-migration feature in this codebase.
 */
export async function fetchGlobalDefaultFaceStyle(): Promise<FaceStyle | null> {
  try {
    const res = await fetch("/api/star/face-style-default");
    if (!res.ok) return null;
    const data = await res.json() as { style?: Partial<FaceStyle> | null };
    return data?.style ? sanitize(data.style) : null;
  } catch {
    return null;
  }
}
