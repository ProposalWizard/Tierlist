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

export async function processImage(file: File): Promise<File> {
  try {
    console.log("🔥 PROCESS IMAGE FUNCTION CALLED");

    await ensureModelsLoaded();

    const img = await loadImageFromFile(file);
    const { canvas, scale } = resizeToCanvas(img, 512);

    console.log("🔍 Running face detection...");

    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.15,
      })
    );

    if (!detection) {
      console.log("❌ No face detected");
      return file;
    }

    console.log("✅ Face detected");

    const box = detection.box;

    const centerX = (box.x + box.width / 2) / scale;
    const centerY = (box.y + box.height / 2) / scale;

    // ✅ attach face data (NO cropping)
    (file as any).__face = {
      centerX,
      centerY,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };

    return file;

  } catch (err) {
    console.log("⚠️ Face detection failed:", err);
    return file;
  }
}
