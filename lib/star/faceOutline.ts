"use client";
import { detectFaceBoxFromUrl, type FaceBox } from "@/lib/faceDetection";

/**
 * THE OUTLINE ACTUALLY HUGS THE FACE — not a generic circle.
 *
 * Two earlier attempts at "outline" both guessed wrong: the first traced the
 * photo's own alpha shape, assuming a transparent cut-out (real photos turned
 * out to be plain opaque rectangles — that traced a rectangle, not a face);
 * the second reverted to a plain circular stroke tracing the crop boundary,
 * which is honest about the crop but still just a circle, not the actual
 * face in that specific photo. Reported back directly, plainly: "the outline
 * is still for the circle not the face."
 *
 * This is the real fix: face-api.js's TinyFaceDetector (already a dependency
 * of this codebase, already used by lib/faceDetection.ts to auto-centre
 * tierlist thumbnails) finds the ACTUAL face in each specific photo, and the
 * outline traces an ellipse built from THAT — a different shape per player,
 * not one generic circle for all of them.
 *
 * Detection is real, per-image work — far too slow to run on every draw call,
 * so it is requested once per distinct photo URL, cached (memory + localStorage,
 * same two-tier idea lib/faceDetection.ts's own cache already uses), and
 * every caller reads back only whatever is already known. A photo that's
 * still being detected, or where detection found nothing, or that failed to
 * load at all, draws with the plain circular stroke drawPlayerHead.ts has
 * always used — never a blocked draw call, never a missing outline.
 */

/** Fractions (0-1) of the image's own natural width/height — matches
 *  lib/faceDetection.ts's FaceBox, resolution-independent for the same reason. */
export interface FaceEllipse {
  cx: number; cy: number; rx: number; ry: number;
}

// face-api's box runs roughly eyebrows→chin (see lib/faceDetection.ts's own
// boxToFaceCenter doc) — snug around the eyes/nose/mouth, not the whole head.
// Padded outward so the outline reads as "around the head" rather than
// hugging just the inner features; more above than below for the same
// hairline reason boxToFaceCenter biases its own Y target upward by 50%.
// Exported so tests can check ellipseFromBox's real output against these
// exact real numbers rather than a second, driftable copy of them.
export const PAD_X = 0.28;
export const PAD_Y_TOP = 0.45;
export const PAD_Y_BOTTOM = 0.20;

export function ellipseFromBox(box: FaceBox): FaceEllipse {
  const padX = box.width * PAD_X;
  const padTop = box.height * PAD_Y_TOP;
  const padBottom = box.height * PAD_Y_BOTTOM;
  const x0 = box.x - padX, x1 = box.x + box.width + padX;
  const y0 = box.y - padTop, y1 = box.y + box.height + padBottom;
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    rx: (x1 - x0) / 2,
    ry: (y1 - y0) / 2,
  };
}

const CACHE_KEY = "star-face-outline-v1";
// null = detection genuinely ran and found no face (a bad photo, a
// silhouette, a crest used as a placeholder) — distinct from "not yet known
// either way," so a real miss is never retried every single load.
type StoredCache = Record<string, FaceEllipse | null>;

function readCache(): StoredCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) as StoredCache : {};
  } catch {
    return {};
  }
}

function writeCache(cache: StoredCache): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore — worst case this device just re-detects next load
  }
}

const memory = new Map<string, FaceEllipse | null>();
const inFlight = new Set<string>();

/**
 * Synchronous, never blocks a draw call. Three real states:
 *   - a real FaceEllipse: draw the real outline
 *   - null: detection ran, genuinely found nothing — draw the fallback circle
 *   - undefined: not yet known (never requested, or still in flight) — draw
 *     the fallback circle for now; call requestFaceOutline to start finding out.
 */
export function getFaceOutline(url: string): FaceEllipse | null | undefined {
  if (memory.has(url)) return memory.get(url) ?? null;
  const stored = readCache();
  if (url in stored) {
    memory.set(url, stored[url]);
    return stored[url];
  }
  return undefined;
}

/**
 * Fire-and-forget from every real call site — none of them await it, same
 * "call it every frame, it only fires once" shape as CanvasMatch.tsx's own
 * getFaceImage(). Returns its promise anyway (harmless for a caller that
 * ignores it) purely so tests can await the real async detection settling
 * without a setTimeout(0) guess. `detect` is injectable so the cache/
 * memoisation logic itself is testable without a real browser/face-api.js —
 * defaults to the real detector.
 */
export function requestFaceOutline(
  url: string,
  detect: (url: string) => Promise<FaceBox | null> = detectFaceBoxFromUrl,
): Promise<void> {
  if (memory.has(url) || inFlight.has(url)) return Promise.resolve();
  inFlight.add(url);
  return detect(url)
    .then((box) => {
      const shape = box ? ellipseFromBox(box) : null;
      memory.set(url, shape);
      const stored = readCache();
      stored[url] = shape;
      writeCache(stored);
    })
    .catch(() => {
      // Treat a rejected detection the same as "found nothing" rather than
      // leaving it perpetually undefined and re-tried every draw call —
      // matches detectFaceBoxFromUrl's own try/catch-to-null contract, this
      // is just the belt-and-braces copy for a promise that somehow still
      // rejected past that.
      memory.set(url, null);
    })
    .finally(() => { inFlight.delete(url); });
}
