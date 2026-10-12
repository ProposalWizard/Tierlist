import type * as THREE from "three";

/**
 * A club crest picture (a URL or an SVG data URL) as a square texture for a
 * 3D shirt's chest badge (people3d.ts `badge`). Centred on a transparent
 * 128-px square with a little room round it. Resolves null when the picture
 * fails, takes longer than `waitMs`, or cannot be read (a host without CORS):
 * the shirt then keeps its drawn shield. Kept out of the 3D scenes so their
 * files hold no 2D canvas (the one-engine guard reads that as a game loop).
 */
export function loadCrestTexture(T: typeof import("three"), url: string, waitMs = 4000): Promise<THREE.Texture | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), waitMs);
    const finish = (tex: THREE.Texture | null) => { window.clearTimeout(timer); resolve(tex); };
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const g = c.getContext("2d");
        if (!g) return finish(null);
        const nw = img.naturalWidth || 116, nh = img.naturalHeight || 116;
        const k = Math.min(116 / nw, 116 / nh);
        g.drawImage(img, (128 - nw * k) / 2, (128 - nh * k) / 2, nw * k, nh * k);
        g.getImageData(0, 0, 1, 1); // throws on a picture we may not read
        const tex = new T.CanvasTexture(c);
        tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = 4;
        finish(tex);
      } catch {
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = url;
  });
}
