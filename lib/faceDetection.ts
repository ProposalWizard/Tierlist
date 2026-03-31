/**
 * lib/faceDetection.ts
 *
 * Client-side face detection using face-api.js (TinyFaceDetector).
 * Detects a face in an image and crops around it with padding.
 * If no face is found, the original image is returned unchanged.
 *
 * Models must be placed in /public/models/:
 *   - tiny_face_detector_model-weights_manifest.json
 *   - tiny_face_detector_model-shard1
 */

import * as faceapi from "face-api.js";

// Track whether models have been loaded to avoid reloading
let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

/**
 * Load TinyFaceDetector model from /models (served from public/).
 * Safe to call multiple times — only loads once.
 */
async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;

  // If already loading, wait for that promise
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
 * Load a File into an HTMLImageElement.
 */
function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for face detection"));
    };
    img.src = url;
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
 * Crop a region from the original image and return it as a WebP File.
 *
 * @param img       The full-resolution source image
 * @param x         Crop region x (in original image coords)
 * @param y         Crop region y
 * @param cropW     Crop region width
 * @param cropH     Crop region height
 * @param fileName  Output file name
 */
function cropToFile(
  img: HTMLImageElement,
  x: number,
  y: number,
  cropW: number,
  cropH: number,
  fileName: string
): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = cropW;
    canvas.height = cropH;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, x, y, cropW, cropH, 0, 0, cropW, cropH);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to crop image"));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/webp" }));
      },
      "image/webp",
      0.85
    );
  });
}

/**
 * processImage — Main entry point.
 *
 * 1. Loads the image
 * 2. Resizes to 512px max for fast face detection
 * 3. Detects a single face using TinyFaceDetector
 * 4. If found: crops around the face with ~50% padding, returns cropped File
 * 5. If not found: returns the original file unchanged
 *
 * @param file  The image File from a file input
 * @returns     A File — either face-cropped or the original
 */
export async function processImage(file: File): Promise<File> {
  try {
    // Load the face detection model (no-op if already loaded)
    await ensureModelsLoaded();

    // Load the full-resolution image
    const img = await loadImageFromFile(file);

    // Resize to 512px max for fast detection
    const { canvas, scale } = resizeToCanvas(img, 512);

    // Run face detection on the resized canvas
    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
    );

    // No face found — return the original file as-is
    if (!detection) return file;

    // Map the detected face box back to original image coordinates
    const box = detection.box;
    const origX = box.x / scale;
    const origY = box.y / scale;
    const origW = box.width / scale;
    const origH = box.height / scale;

    // Add ~50% padding around the face
    const padX = origW * 0.5;
    const padY = origH * 0.5;

    // Calculate crop region, clamped to image bounds
    const cropX = Math.max(0, Math.round(origX - padX));
    const cropY = Math.max(0, Math.round(origY - padY));
    const cropRight = Math.min(img.naturalWidth, Math.round(origX + origW + padX));
    const cropBottom = Math.min(img.naturalHeight, Math.round(origY + origH + padY));
    const cropW = cropRight - cropX;
    const cropH = cropBottom - cropY;

    // Sanity check: crop must be a reasonable size
    if (cropW < 20 || cropH < 20) return file;

    // Crop from the original full-res image
    const name = file.name.replace(/\.[^/.]+$/, ".webp");
    return await cropToFile(img, cropX, cropY, cropW, cropH, name);
  } catch {
    // If anything fails, return the original file safely
    return file;
  }
}
