let modelsLoaded = false;
let modelsLoading: Promise<void> | null = null;

async function ensureModelsLoaded(): Promise<void> {
  if (modelsLoaded) return;

  if (modelsLoading) {
    await modelsLoading;
    return;
  }

  console.log("📦 Loading face detection model...");

  modelsLoading = import("face-api.js")
    .then((faceapi) =>
      faceapi.nets.tinyFaceDetector.loadFromUri("/models")
    )
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

    // ✅ SSR SAFETY (prevents Vercel crash)
    if (typeof window === "undefined") return file;

    await ensureModelsLoaded();

    const img = await loadImageFromFile(file);

    const { canvas, scale } = resizeToCanvas(img, 512);

    console.log("🔍 Running face detection...");

    const faceapi = await import("face-api.js");

    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 512,
        scoreThreshold: 0.15,
      })
    );

    console.log("📊 Detection result:", detection);

    // ❌ No face → return original
    if (!detection) {
      console.log("❌ No face detected — returning original");
      return file;
    }

    console.log("✅ Face detected — storing position");

    // Map face box back to original image
    const box = detection.box;
    const origX = box.x / scale;
    const origY = box.y / scale;
    const origW = box.width / scale;
    const origH = box.height / scale;

    // ✅ Compute face center
    const centerX = origX + origW / 2;
    const centerY = origY + origH / 2;

    // ✅ Attach NON-DESTRUCTIVE metadata
    (file as File & { __face?: any }).__face = {
      centerX,
      centerY,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };

    return file;
  } catch (err) {
    console.log("⚠️ Face processing failed:", err);
    return file;
  }
}
