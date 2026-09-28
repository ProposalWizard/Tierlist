/**
 * WHERE A SCANNED FACE SITS IN ITS PICTURE.
 *
 * The face scan (faceScan.ts) straightens, sizes and centres every photo the
 * same way, so the eyes and the chin land on the same spots in every scanned
 * portrait. Anything drawing a scanned head (faceFit.ts for the home avatar)
 * reads the face's position from here instead of guessing it.
 *
 * Kept in its own tiny file so faceFit.ts can read it without pulling in the
 * scanner (and the scanner's 16 MB of models are only ever fetched when a
 * scan actually runs).
 */
export const SCAN_LAYOUT = {
  /** The stored portrait is a transparent square this many px wide. */
  size: 320,
  /** Middle of the face, as a fraction of the width. */
  cx: 0.5,
  /** The line through the eyes, as a fraction of the height. */
  eyeY: 0.44,
  /** The chin, as a fraction of the height. */
  chinY: 0.74,
};

/** Eye line to chin, as a fraction of the size. */
export const SCAN_EYE_TO_CHIN = SCAN_LAYOUT.chinY - SCAN_LAYOUT.eyeY;

/**
 * Is this picture a scanned portrait? A scan is a square data-URL picture
 * that is see-through in all four corners. An old cropped photo (portrait.ts
 * encodePortrait) is always a solid WebP/JPEG square, a fake face is not
 * square, and a database photo is not a data URL.
 */
export function looksScanned(url: string, w: number, h: number, cornerAlpha: number[]): boolean {
  if (!url.startsWith("data:")) return false;
  if (w !== h || w < 128) return false;
  return cornerAlpha.length === 4 && cornerAlpha.every((a) => a < 8);
}
