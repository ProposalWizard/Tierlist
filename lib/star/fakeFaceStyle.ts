"use client";
import type { CropView } from "./portrait";
import { FACE_SCALE_RANGE, FACE_OFFSET_RANGE, CROP_ZOOM_RANGE } from "./faceStyle";

/**
 * How a FAKE face draws — a second, separate style from FaceStyle
 * (faceStyle.ts), because the fake headshots (lib/star/fakeFaces.ts) are a
 * completely different set of images from real player photos: different
 * framing, different zoom, different amount of neck/shoulder in frame.
 * Requested directly, once fake faces were live: "make a fake face player
 * face editor to go along with the player face editor. because the images
 * are different so need different values and cropped parts etc."
 *
 * Deliberately NARROWER than FaceStyle — only the four fields that actually
 * depend on an image's own composition (scale/offset/crop). Backing circle,
 * outline, and the facesEnabled/namesEnabled master toggles stay on the ONE
 * shared FaceStyle and apply identically to real and fake faces alike —
 * none of those are photo-composition-dependent, so splitting them would
 * just be two copies of the same on/off switch to keep in sync.
 *
 * See drawPlayerHead.ts's own doc for how the two styles actually combine
 * at draw time, and FakeFaceEditorScreen.tsx for the WYSIWYG tool that
 * edits this one, previewed against each of the seven real fake images in
 * turn rather than a squad player.
 */
export interface FakeFaceStyle {
  /** Multiplies the head's own base radius. 1.0 is the original, unscaled size. */
  scale: number;
  /** Horizontal nudge, in units of the head's own BASE (unscaled) radius. */
  offsetX: number;
  /** Vertical nudge, same units. */
  offsetY: number;
  /** Which part of a fake face's own rectangle shows inside the head circle
   *  — one shared crop applied to all seven fake images alike, same idea as
   *  FaceStyle.crop for real photos. Units of CROP_VIEWPORT (faceStyle.ts). */
  crop: CropView;
}

// The values reported directly, exact, off this editor's own sliders:
// 2.00x size, -0.06 left/right, -1.19 up/down. Crop has no numeric readout
// in this editor either — zoom is a best-effort reading off the reported
// screenshot, not a confirmed exact number. 0.75 specifically isn't
// arbitrary: at these images' own measured ~1091x1442 shape (see
// CROP_ZOOM_RANGE's own doc), that's the exact zoom at which the full
// height fits the 256px viewport with zero vertical crop — matching the
// framing shown (full face, real headroom, nothing cut off top or bottom).
// x/y are computed (the same clampOffset math the editor itself runs) to be
// genuinely centred at that zoom, not carried over from the old {0,0} —
// {0,0} would only centre it at zoom exactly 1.
export const DEFAULT_FAKE_FACE_STYLE: FakeFaceStyle = {
  scale: 2.0,
  offsetX: -0.06,
  offsetY: -1.19,
  crop: { zoom: 0.75, x: 32, y: 1.1 },
};

const KEY = "star-fake-face-style";

function numberOr(n: unknown, fallback: number): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Same bounds FaceStyle's own sliders use — a numeric range, not something
 *  that needs its own copy just because the images differ. */
export function sanitizeFakeFaceStyle(partial: Partial<FakeFaceStyle>): FakeFaceStyle {
  const s = { ...DEFAULT_FAKE_FACE_STYLE, ...partial };
  return {
    scale: clamp(numberOr(s.scale, DEFAULT_FAKE_FACE_STYLE.scale), ...FACE_SCALE_RANGE),
    offsetX: clamp(numberOr(s.offsetX, 0), ...FACE_OFFSET_RANGE),
    offsetY: clamp(numberOr(s.offsetY, 0), ...FACE_OFFSET_RANGE),
    // Same loose sanity clamp FaceStyle.crop uses — the real, precise clamp
    // (clampOffset, portrait.ts) runs at actual use time.
    crop: {
      zoom: clamp(numberOr(s.crop?.zoom, 1), ...CROP_ZOOM_RANGE),
      x: clamp(numberOr(s.crop?.x, 0), -4000, 4000),
      y: clamp(numberOr(s.crop?.y, 0), -4000, 4000),
    },
  };
}

export function loadFakeFaceStyle(): FakeFaceStyle {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitizeFakeFaceStyle(JSON.parse(raw));
  } catch { /* fall through to default */ }
  return DEFAULT_FAKE_FACE_STYLE;
}

export function saveFakeFaceStyle(style: FakeFaceStyle): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(sanitizeFakeFaceStyle(style)));
  } catch { /* ignore — worst case the preference just doesn't stick */ }
}
