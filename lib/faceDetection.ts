/**
 * lib/faceDetection.ts
 *
 * NON-DESTRUCTIVE client-side face detection using face-api.js (TinyFaceDetector).
 *
 * Returns a target position as a percentage (0-100 for both x and y). The
 * calling code uses this to set CSS `background-position` so thumbnails frame
 * the full head, while the original image is preserved for zoom and manual
 * crop.
 *
 * Positioning strategy: face-api.js boxes cover roughly eyebrows→chin, so we
 * bias the Y target UPWARD by ~50% of the box height (above the eyebrows),
 * which corresponds to the top of the head with some padding. This ensures
 * cover crops show the full head rather than cutting off the hairline.
 *
 * Results are cached in localStorage keyed by image URL to avoid reprocessing
 * on subsequent visits (eliminates the half-second flash on revisit).
 *
 * Models must be placed in /public/models/:
 *   - tiny_face_detector_model-weights_manifest.json
 *   - tiny_face_detector_model-shard1
 */

import * as faceapi from "face-api.js";

/** Target background-position as a percentage of the image dimensions (0–100). */
export interface FaceCenter {
  x: number; // percentage from left
  y: number; // percentage from top
}

/** Result of processImage: the original file + optional face position. */
export interface ProcessedImage {
  file: File;
  faceCenter: FaceCenter | null;
}

// ── localStorage cache ──────────────────────────────────────────────────────
// Bump the version suffix whenever the positioning algorithm changes so old
// cached values (computed with the old algorithm) are invalidated automatically.
const CACHE_KEY = "tierlist:faceCenters:v2";

type CacheShape = Record<string, FaceCenter>;

function readCache(): CacheShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheShape) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: CacheShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota errors etc.
  }
}

/** Get cached face position for an image URL, or null if not cached. */
export function getCachedFace(url: string): FaceCenter | null {
  const cache = readCache();
  return cache[url] ?? null;
}

/** Store a face position for an image URL. */
export function setCachedFace(url: string, face: FaceCenter): void {
  const cache = readCache();
  cache[url] = face;
  writeCache(cache);
}

// ── model loading ───────────────────────────────────────────────────────────
let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

/**
 * Load TinyFaceDetector model from /models (served from public/).
 * Safe to call multiple times — only loads once.
 */
async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoading) {
    await modelsLoading;
    return;
  }

  modelsLoading = faceapi.nets.tinyFaceDetector
    .loadFromUri("/models")
    .then(() => {
      modelsLoaded = true;
    });

  await modelsLoading;
}

/**
 * Load a File (or Blob URL) into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for face detection"));
    img.src = src;
  });
}

/**
 * Resize an image onto a canvas so the longest side is at most maxPx.
 * Returns the canvas and the scale factor used.
 */
function resizeToCanvas(
  img: HTMLImageElement,
  maxPx: number
): { canvas: HTMLCanvasElement; scale: number } {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  let scale = 1;

  if (w > maxPx || h > maxPx) {
    scale = maxPx / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);

  return { canvas, scale };
}

/**
 * Convert a detected face box to a target background-position percentage.
 *
 * face-api.js boxes run from eyebrows down to chin. To keep the top of the
 * head visible with some padding above, we shift the Y target upward by 50%
 * of the box height (≈ above the eyebrows, around the hairline). The X
 * target is simply the horizontal centre of the face.
 */
function boxToFaceCenter(
  box: { x: number; y: number; width: number; height: number },
  scale: number,
  naturalW: number,
  naturalH: number
): FaceCenter {
  const faceCenterXPx = (box.x + box.width / 2) / scale;
  // Bias upward by 50% of box height — targets top of head, not face centre.
  const targetYPx = Math.max(0, (box.y - box.height * 0.5) / scale);

  return {
    x: Math.round((faceCenterXPx / naturalW) * 100),
    y: Math.round((targetYPx / naturalH) * 100),
  };
}

/**
 * Detect a face in a File and return its target position as a percentage.
 * The file is NEVER modified — only analysed.
 *
 * @returns ProcessedImage with the original file and face position (or null)
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  try {
    if (typeof window === "undefined") return { file, faceCenter: null };

    await ensureModelsLoaded();

    const url = URL.createObjectURL(file);
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }

    // Resize to 512px max for fast detection
    const { canvas, scale } = resizeToCanvas(img, 512);

    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    );

    if (!detection) return { file, faceCenter: null };

    const faceCenter = boxToFaceCenter(
      detection.box,
      scale,
      img.naturalWidth,
      img.naturalHeight
    );

    return { file, faceCenter };
  } catch {
    // If anything fails, return the original file with no face data
    return { file, faceCenter: null };
  }
}

/**
 * Detect a face in an image loaded from a URL (e.g. from Supabase Storage).
 * Used on the play page to face-centre images that are already uploaded.
 *
 * Checks the localStorage cache first; if missing, runs detection and stores
 * the result so future visits apply the position synchronously.
 *
 * @returns FaceCenter or null
 */
export async function detectFaceFromUrl(imageUrl: string): Promise<FaceCenter | null> {
  try {
    if (typeof window === "undefined") return null;

    const cached = getCachedFace(imageUrl);
    if (cached) return cached;

    await ensureModelsLoaded();

    const img = await loadImage(imageUrl);
    const { canvas, scale } = resizeToCanvas(img, 512);

    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    );

    if (!detection) return null;

    const faceCenter = boxToFaceCenter(
      detection.box,
      scale,
      img.naturalWidth,
      img.naturalHeight
    );

    setCachedFace(imageUrl, faceCenter);
    return faceCenter;
  } catch {
    return null;
  }
}
