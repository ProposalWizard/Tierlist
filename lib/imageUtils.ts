/** Allowed MIME types for image uploads */
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml", "image/bmp", "image/avif"] as const;

/** Human-readable accept string for file inputs */
export const ACCEPT_IMAGE_TYPES = ALLOWED_IMAGE_TYPES.join(",");

/** Returns true if the file has an allowed image MIME type */
export function isAllowedImageType(file: File): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

/**
 * Resizes an image so the longest side is at most 1200px,
 * then encodes it as WebP at 75% quality.
 * Returns a new File with a .webp extension.
 */
export function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const MAX = 1200;
      let { naturalWidth: w, naturalHeight: h } = img;

      if (w > MAX || h > MAX) {
        if (w >= h) {
          h = Math.round((h / w) * MAX);
          w = MAX;
        } else {
          w = Math.round((w / h) * MAX);
          h = MAX;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Canvas toBlob failed")); return; }
          const name = file.name.replace(/\.[^/.]+$/, ".webp");
          resolve(new File([blob], name, { type: "image/webp" }));
        },
        "image/webp",
        0.75
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}
