/**
 * A player's photo, fitted for a 3D head (null if it can't be read). Gives up
 * after 3 s. The same steps the 3D crossbar challenge uses
 * (components/star/Training3D.tsx keeps its own copy, untouched).
 */
import { fitFace } from "../faceFit";
import { PHOTO_FACES } from "../faceStyle";
import type { FacePic } from "../people3d";

export async function faceFromUrl(url: string | undefined): Promise<{ face: FacePic; skin: string } | null> {
  // Photo faces are off (PHOTO_FACES, faceStyle.ts): every 3D head is the
  // drawn Style A one. Hidden until the photo revamp (Harry, 12 Oct 2026).
  if (!PHOTO_FACES) return null;
  if (!url || typeof createImageBitmap !== "function") return null;
  const job = fetch(url, { mode: "cors" })
    .then((r) => (r.ok ? r.blob() : null))
    .then((b) => (b ? createImageBitmap(b, { resizeHeight: 320, resizeQuality: "medium" }) : null))
    .then((bmp) => {
      if (!bmp) return null;
      const fit = fitFace(bmp, 320, url);
      bmp.close();
      return fit ? { face: { canvas: fit.canvas, chinX: fit.chinX, chinY: fit.chinY, faceH: fit.faceH }, skin: fit.skin } : null;
    })
    .catch(() => null);
  return Promise.race([job, new Promise<null>((res) => setTimeout(() => res(null), 3000))]);
}
