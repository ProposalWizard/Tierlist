import * as faceapi from "face-api.js";

let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;

  if (modelsLoading) {
    await modelsLoading;
    return;
  }

  console.log("📦 Loading face detection model...");

  modelsLoading = faceapi.nets.tinyFaceDetector
    .loadFromUri("/models")
    .then(() => {
      modelsLoaded = true;
      console.log("✅ Models loaded");
    });

  await modelsLoading;
}

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
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

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
      0.9
    );
  });
}

export async function processImage(file: File): Promise<File> {
  try {
    console.log("=== 🧠 PROCESSING IMAGE ===");

    await ensureModelsLoaded();

    const img = await loadImageFromFile(file);

    const { canvas, scale } = resizeToCanvas(img, 512);

    console.log("🔍 Running face detection...");

    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.2,
      })
    );

    console.log("📊 Detection result:", detection);

    if (!detection) {
      console.log("❌ No face detected — using original image");
      return file;
    }

    console.log("✅ Face detected — cropping");

    const box = detection.box;

    const origX = box.x / scale;
    const origY = box.y / scale;
    const origW = box.width / scale;
    const origH = box.height / scale;

    const padX = origW * 0.6;
    const padY = origH * 0.6;

    const cropX = Math.max(0, Math.round(origX - padX));
    const cropY = Math.max(0, Math.round(origY - padY));
    const cropRight = Math.min(
      img.naturalWidth,
      Math.round(origX + origW + padX)
    );
    const cropBottom = Math.min(
      img.naturalHeight,
      Math.round(origY + origH + padY)
    );

    const cropW = cropRight - cropX;
    const cropH = cropBottom - cropY;

    if (cropW < 20 || cropH < 20) {
      console.log("⚠️ Crop too small — using original");
      return file;
    }

    const name = file.name.replace(/\.[^/.]+$/, ".webp");

    return await cropToFile(img, cropX, cropY, cropW, cropH, name);
  } catch (err) {
    console.error("💥 Face processing failed:", err);
    return file;
  }
}
