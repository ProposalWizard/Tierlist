/**
 * lib/faceDetection.ts
 *
 * NON-DESTRUCTIVE client-side face detection using face-api.js (TinyFaceDetector).
 *
 * Instead of cropping the image, this returns the face center as a percentage
 * (0-100 for both x and y). The calling code uses this to set CSS
 * `background-position` so thumbnails are centered on the face, while the
 * original image is preserved for zoom and manual crop.
 *
 * Models must be placed in /public/models/:
 *   - tiny_face_detector_model-weights_manifest.json
 *   - tiny_face_detector_model-shard1
 */

import * as faceapi from "face-api.js";

/** Face center as a percentage of the image dimensions (0–100). */
export interface FaceCenter {
  x: number; // percentage from left
  y: number; // percentage from top
}

/** Result of processImage: the original file + optional face position. */
export interface ProcessedImage {
  file: File;
  faceCenter: FaceCenter | null;
}

// Track whether models have been loaded to avoid reloading
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
 * Detect a face in a File and return its center as a percentage.
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

    // Map detected box back to original image coordinates
    const box = detection.box;
    const centerX = (box.x + box.width / 2) / scale;
    const centerY = (box.y + box.height / 2) / scale;

    // Convert to percentage of original image dimensions
    const faceCenter: FaceCenter = {
      x: Math.round((centerX / img.naturalWidth) * 100),
      y: Math.round((centerY / img.naturalHeight) * 100),
    };

    return { file, faceCenter };
  } catch {
    // If anything fails, return the original file with no face data
    return { file, faceCenter: null };
  }
}

/**
 * Detect a face in an image loaded from a URL (e.g. from Supabase Storage).
 * Used on the play page to face-center images that are already uploaded.
 *
 * @returns FaceCenter or null
 */
export async function detectFaceFromUrl(imageUrl: string): Promise<FaceCenter | null> {
  try {
    if (typeof window === "undefined") return null;

    await ensureModelsLoaded();

    const img = await loadImage(imageUrl);
    const { canvas, scale } = resizeToCanvas(img, 512);

    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    );

    if (!detection) return null;

    const box = detection.box;
    const centerX = (box.x + box.width / 2) / scale;
    const centerY = (box.y + box.height / 2) / scale;

    return {
      x: Math.round((centerX / img.naturalWidth) * 100),
      y: Math.round((centerY / img.naturalHeight) * 100),
    };
  } catch {
    return null;
  }
}
