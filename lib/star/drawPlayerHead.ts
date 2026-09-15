import { DEFAULT_FACE_STYLE, type FaceStyle } from "./faceStyle";

/**
 * The one place a head — real photo or the plain fallback circle — actually
 * gets drawn. Both `footballer()` and the keeper's own separate figure
 * (CanvasMatch.tsx) call this, and so does the Face Editor's own live
 * preview (FaceEditorScreen.tsx). Extracted specifically so those two things
 * can never quietly drift apart — an editor that shows you one thing while a
 * real match draws something subtly different would defeat the entire point
 * of it.
 *
 * Runs in the figure's own LOCAL coordinate space (already translated to his
 * feet and rotated to his facing, same as every other body part) — `cx0`/
 * `cy0` are where the head sits by default, before any style is applied.
 *
 * `headBaseR` is the head's own base radius (footballer's `r * 0.26`, the
 * keeper's own `KR * 0.28`) — style.scale is the ONLY thing that then grows
 * or shrinks it, so passing an already-scaled radius here would double it up.
 * `figureR` is the whole figure's own r/KR, kept separate purely because the
 * outline's base thickness has always been a fraction of THAT, not of the
 * head — matches the exact pre-editor stroke-width formula when
 * `outlineWidth` is left at its default 1.
 *
 * ── The outline hugs the PHOTO, not a circle ──
 *
 * The first version stroked the circular clip boundary — which meant the
 * "outline" was really just a ring drawn over the photo, ignoring what the
 * photo actually shows. Corrected on direct feedback: "an outline around
 * the FACES (not the image file which may include transparent area)... i
 * wanna see a face with the outline going around every pixel of the face."
 * A real player photo (SoFIFA's own renders) is typically a head/bust
 * cut out on a transparent background, not a filled rectangle — so a real
 * player now draws at his photo's own natural alpha shape (no circular
 * clip at all) with a genuine outline traced around THAT shape, and the
 * backing circle is what shows through anywhere the photo itself is
 * transparent. There's no comparable alpha shape for the no-photo
 * fallback (it's a circle Claude drew, not a photograph), so that case
 * keeps a plain circular stroke.
 */
export function drawPlayerHead(
  ctx: CanvasRenderingContext2D,
  cx0: number,
  cy0: number,
  headBaseR: number,
  figureR: number,
  face: HTMLImageElement | undefined,
  style: FaceStyle = DEFAULT_FACE_STYLE,
): void {
  const r = headBaseR * style.scale;
  const cx = cx0 + style.offsetX * headBaseR;
  const cy = cy0 + style.offsetY * headBaseR;
  const hasPhoto = !!face && face.complete && face.naturalWidth > 0;
  const outlinePx = Math.max(1, figureR * 0.10 * style.outlineWidth);

  // The backing fill is what "no photo" has always looked like — drawn
  // regardless of the toggle whenever there's no photo to show at all, so a
  // generated squad's players (and anyone real whose photo hasn't loaded
  // yet) are never left with an invisible head just because backing is off.
  // For a real photo it's what shows through any transparent part of it.
  if (style.showBacking || !hasPhoto) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = style.backingColor;
    ctx.fill();
  }

  if (hasPhoto) {
    const dx = cx - r, dy = cy - r, d = r * 2;
    if (style.outlineEnabled) {
      const silhouette = silhouetteFor(face!, style.outlineColor);
      if (silhouette) stampOutline(ctx, silhouette, dx, dy, d, d, outlinePx);
    }
    // The real photo, drawn last so it covers the middle of its own
    // dilated silhouette above — only the ring the dilation newly exposed
    // stays visible, which is the outline.
    ctx.drawImage(face!, dx, dy, d, d);
  } else if (style.outlineEnabled) {
    // No photo, nothing to trace — the plain circle IS the shape.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = outlinePx;
    ctx.strokeStyle = style.outlineColor;
    ctx.stroke();
  }
}

/**
 * A solid-colour silhouette of `img`'s own alpha shape, at its natural
 * resolution — cached per (image, colour) so a real match, redrawing every
 * figure every frame, only ever pays for this once per photo rather than
 * once per frame. Scaling to whatever size a given figure actually draws
 * at happens later, in stampOutline, via drawImage's own destination size —
 * never re-rendered per size, per figure, or per frame.
 */
const silhouetteCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

function silhouetteFor(img: HTMLImageElement, color: string): HTMLCanvasElement | null {
  let byColor = silhouetteCache.get(img);
  if (!byColor) { byColor = new Map(); silhouetteCache.set(img, byColor); }
  const cached = byColor.get(color);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const octx = canvas.getContext("2d");
  if (!octx) return null;
  octx.drawImage(img, 0, 0);
  // Recolours every VISIBLE pixel to the outline colour, keeping the same
  // alpha shape — the standard "solid silhouette of a sprite" trick.
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = color;
  octx.fillRect(0, 0, canvas.width, canvas.height);
  byColor.set(color, canvas);
  return canvas;
}

/** Stamps `silhouette` around a ring of the given pixel radius so the shape
 *  reads as dilated outward by that much in every direction — drawing the
 *  real photo on top afterward then leaves only that newly-exposed ring
 *  visible, which is the outline. A fixed step count is enough regardless
 *  of width: outlinePx is already a small multiple of a small base
 *  formula, so the ring itself is never more than a few pixels. */
function stampOutline(
  ctx: CanvasRenderingContext2D,
  silhouette: HTMLCanvasElement,
  dx: number, dy: number, dw: number, dh: number,
  widthPx: number,
): void {
  const STEPS = 12;
  for (let i = 0; i < STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    ctx.drawImage(silhouette, dx + Math.cos(a) * widthPx, dy + Math.sin(a) * widthPx, dw, dh);
  }
}
