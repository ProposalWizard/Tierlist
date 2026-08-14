/**
 * YOUR FACE.
 *
 * Every other footballer in the division has a photograph in the database. You
 * do not, because you were invented at the start of the career, and the cards
 * that show eight faces have to do something about the ninth. The default is the
 * back of your shirt — club colours, your squad number — which is always
 * available and never looks broken. This is the other option: a picture you take
 * once, and then it is you on the graphics.
 *
 * ── It never leaves the browser ──
 *
 * The result is a data URI stored on the career, which already lives in
 * localStorage. No upload, no bucket, no row, nothing to moderate and nothing to
 * delete when a career is deleted. A 256px WebP at quality 0.8 measures 8–18 KB,
 * against a career that is otherwise around 300 KB and a budget of 5 MB.
 *
 * ── Why it gets treated rather than dropped in ──
 *
 * A photograph of you has a room behind it. The database portraits are cut-outs
 * on transparent. Side by side in a grid of eight, an untreated photo is
 * instantly the one that looks pasted in — so it goes through the same duotone
 * the transfer graphic uses (see media/graphics/palette.ts), which puts it in
 * the club's colours and makes the background a texture rather than a mistake.
 * That is a rendering decision and lives in the component; what is here is the
 * geometry and the encoding.
 */

/** The square the picture is cropped to. */
export const PORTRAIT_SIZE = 256;

/** Measured: 0.8 is where a face stops improving and the file keeps growing. */
export const PORTRAIT_QUALITY = 0.8;

/**
 * Refuse anything past this.
 *
 * A career that will not save is very much worse than a career with no
 * photograph on it, and localStorage fails by throwing on the write — long after
 * the point where anybody could connect it to having chosen a picture.
 */
export const MAX_PORTRAIT_BYTES = 120_000;

export interface CropView {
  /** 1 is "just covers the square". Above that is zoomed in. */
  zoom: number;
  /** Top-left of the drawn image relative to the viewport, in viewport pixels. */
  x: number;
  y: number;
}

/** The scale at which the image just covers the square — the starting point. */
export function coverScale(iw: number, ih: number, viewport: number): number {
  if (iw <= 0 || ih <= 0) return 1;
  return Math.max(viewport / iw, viewport / ih);
}

/**
 * Keep the square covered.
 *
 * Dragging is unbounded input and the crop is a promise that every pixel of the
 * output came from the picture. Without this you can drag the face out of frame
 * and export a square of blank canvas.
 */
export function clampOffset(v: CropView, iw: number, ih: number, viewport: number): CropView {
  const s = coverScale(iw, ih, viewport) * Math.max(1, v.zoom);
  const w = iw * s;
  const h = ih * s;
  return {
    zoom: Math.max(1, v.zoom),
    x: Math.min(0, Math.max(viewport - w, v.x)),
    y: Math.min(0, Math.max(viewport - h, v.y)),
  };
}

/** The rectangle of the ORIGINAL image that the viewport is showing. */
export function sourceRect(v: CropView, iw: number, ih: number, viewport: number) {
  const c = clampOffset(v, iw, ih, viewport);
  const s = coverScale(iw, ih, viewport) * c.zoom;
  return { sx: -c.x / s, sy: -c.y / s, sw: viewport / s, sh: viewport / s };
}

/**
 * Centre the square on the picture.
 *
 * What the picker opens on, and the answer for anybody who does not want to
 * drag anything: most photographs of a person have the person in the middle.
 */
export function initialView(iw: number, ih: number, viewport: number): CropView {
  const s = coverScale(iw, ih, viewport);
  return { zoom: 1, x: (viewport - iw * s) / 2, y: (viewport - ih * s) / 2 };
}

/**
 * Square, small, and as a data URI.
 *
 * WebP where the browser has it — every browser this game runs on does, but
 * `toDataURL` answers a format it cannot encode by silently returning a PNG,
 * and a PNG of a photograph is roughly ten times the size. So the result is
 * checked rather than assumed, and JPEG is the fallback rather than a surprise.
 */
export function encodePortrait(
  source: CanvasImageSource,
  rect: { sx: number; sy: number; sw: number; sh: number },
  size = PORTRAIT_SIZE,
): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, size, size);

  const webp = canvas.toDataURL("image/webp", PORTRAIT_QUALITY);
  const out = webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/jpeg", PORTRAIT_QUALITY);
  return out.length > MAX_PORTRAIT_BYTES ? canvas.toDataURL("image/jpeg", 0.6) : out;
}

/** Roughly what a data URI costs in storage. Base64 is four bytes for three. */
export function portraitBytes(dataUri: string): number {
  const comma = dataUri.indexOf(",");
  if (comma < 0) return dataUri.length;
  return Math.round((dataUri.length - comma - 1) * 0.75);
}
