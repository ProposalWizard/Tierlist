"use client";
import { detectFaceLandmarksFromUrl, type FaceLandmarkData, type FaceLandmarkPoint } from "@/lib/faceDetection";

/**
 * THE OUTLINE TRACES THE REAL PIXELS OF THE FACE — not a shape standing in
 * for one.
 *
 * Three earlier attempts at "outline" all guessed wrong. The first traced the
 * photo's own alpha shape, assuming a transparent cut-out (real photos turned
 * out to be plain opaque rectangles). The second reverted to a plain circular
 * stroke tracing the crop boundary — honest about the crop, still not the
 * face. The third used real face detection but only TinyFaceDetector's
 * bounding BOX, padded into an ellipse — closer, but still a generic shape,
 * and reported back emphatically as still wrong: "I DONT WANT A SHAPE! AN
 * OVAL OR FACE-LIKE SHAPE! I WANT THE OUTLINE AROUND THE PIXELS OF THE
 * PLAYERS' FACES!"
 *
 * This is the real fix: a box genuinely cannot describe a non-rectangular
 * contour, so it needed a genuinely different model — face-api.js's 68-point
 * facial LANDMARK model (already a dependency of this codebase for
 * TinyFaceDetector; the landmark model is a separate download, fetched and
 * added to public/models/ specifically for this). getJawOutline() (see
 * lib/faceDetection.ts's detectFaceLandmarksFromUrl) returns 17 REAL points
 * tracing that specific photo's own cheek/jaw/chin curve — a genuinely
 * different shape per player, not one padded ellipse for all of them.
 *
 * Detection is real, per-image work — far too slow to run on every draw call,
 * so it is requested once per distinct photo URL, cached (memory +
 * localStorage, same two-tier idea lib/faceDetection.ts's own cache already
 * uses), and every caller reads back only whatever is already known. A photo
 * that's still being detected, or where detection found nothing, or that
 * failed to load at all, draws with drawPlayerHead.ts's own plain fallback
 * circle — never a blocked draw call, never a missing outline.
 */

/** Fractions (0-1) of the image's own natural width/height, in drawing
 *  order — a closed polygon when stroked back to the first point. */
export type FaceContour = FaceLandmarkPoint[];

// No landmark model tracks hair or the forehead/skull above the eyebrows —
// there is no real per-photo data for the TOP of the head, full stop, not a
// shortcut around available data. This approximates it honestly: two
// "temple" points directly above the jaw's own two ear-height endpoints,
// and one apex between them, all offset upward from the eyebrows' own real
// top by a further fraction of the (real, per-photo) brow-to-jaw-top gap —
// so a face with a naturally taller or shorter brow-to-jaw distance gets a
// proportionally taller or shorter cap too, rather than one fixed guess.
const FOREHEAD_ALLOWANCE = 0.9;
const CROWN_PEAK = 0.15;

export function contourFromLandmarks(data: FaceLandmarkData): FaceContour {
  const { jaw, browTop } = data;
  const left = jaw[0];
  const right = jaw[jaw.length - 1];
  const jawTop = Math.min(left.y, right.y);
  const gap = jawTop - browTop;
  const foreheadY = browTop - gap * FOREHEAD_ALLOWANCE;
  const crownY = foreheadY - gap * CROWN_PEAK;

  return [
    ...jaw,
    { x: right.x, y: foreheadY },
    { x: (left.x + right.x) / 2, y: crownY },
    { x: left.x, y: foreheadY },
  ];
}

const CACHE_KEY = "star-face-contour-v1";
// null = detection genuinely ran and found no face (a bad photo, a
// silhouette, a crest used as a placeholder) — distinct from "not yet known
// either way," so a real miss is never retried every single load.
type StoredCache = Record<string, FaceContour | null>;

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

const memory = new Map<string, FaceContour | null>();
const inFlight = new Set<string>();

/**
 * Synchronous, never blocks a draw call. Three real states:
 *   - a real FaceContour: draw the real outline
 *   - null: detection ran, genuinely found nothing — draw the fallback circle
 *   - undefined: not yet known (never requested, or still in flight) — draw
 *     the fallback circle for now; call requestFaceContour to start finding out.
 */
export function getFaceContour(url: string): FaceContour | null | undefined {
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
export function requestFaceContour(
  url: string,
  detect: (url: string) => Promise<FaceLandmarkData | null> = detectFaceLandmarksFromUrl,
): Promise<void> {
  if (memory.has(url) || inFlight.has(url)) return Promise.resolve();
  inFlight.add(url);
  return detect(url)
    .then((data) => {
      const contour = data ? contourFromLandmarks(data) : null;
      memory.set(url, contour);
      const stored = readCache();
      stored[url] = contour;
      writeCache(stored);
    })
    .catch(() => {
      // Treat a rejected detection the same as "found nothing" rather than
      // leaving it perpetually undefined and re-tried every draw call —
      // matches detectFaceLandmarksFromUrl's own try/catch-to-null contract,
      // this is just the belt-and-braces copy for a promise that somehow
      // still rejected past that.
      memory.set(url, null);
    })
    .finally(() => { inFlight.delete(url); });
}
