import { DEFAULT_FACE_STYLE, CROP_VIEWPORT, type FaceStyle } from "./faceStyle";
import { DEFAULT_FAKE_FACE_STYLE, type FakeFaceStyle } from "./fakeFaceStyle";
import { FAKE_FACES } from "./fakeFaces";
import { sourceRect } from "./portrait";

/**
 * The one place a head — real photo, outline, and all — actually gets
 * drawn. Both `footballer()` and the keeper's own separate figure
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
 * ── The crop ──
 *
 * `style.crop` (a `CropView`, `lib/star/portrait.ts` — the exact same
 * pan/zoom geometry the existing "Your photo" picker already uses) decides
 * which rectangle of the source photo `sourceRect` samples — added after
 * real player photos turned out to include more than just the face (neck,
 * a bit of shirt collar), so there needed to be a way to pick which part of
 * the photo actually shows.
 *
 * ── The outline traces the photo's own real alpha shape ──
 *
 * Two shape-based attempts (a padded bounding-box ellipse, then a 68-point
 * facial-landmark jaw contour) both drew a shape STANDING IN for the face
 * rather than the actual image content — the landmark version specifically
 * excludes hair, since no landmark model tracks it. Reported back directly:
 * "i just want the IMAGE (not the transparent areas) as in the visible
 * image; so the head; face and hair and whatever is visible, to be able to
 * be outlined." That's not a shape to approximate — it's the photo's own
 * real alpha boundary, whatever it actually is.
 *
 * `silhouetteFor()` recolours every visible (non-transparent) pixel of the
 * CROPPED region to the outline colour via `globalCompositeOperation =
 * "source-in"` (the standard "solid silhouette of a sprite" technique), and
 * `stampOutline()` stamps that silhouette at 12 points around a small ring
 * before the real photo draws on top — the real photo covers the middle of
 * its own dilated shadow, leaving only the newly-exposed ring visible, which
 * reads as an outline hugging whatever the photo's own alpha shape actually
 * is: head, hair, and anything else genuinely opaque in that photo. The
 * photo itself no longer clips to a circle — a circle clip would trim away
 * exactly the hair/silhouette detail the outline exists to trace, and the
 * backing fill (still a plain circle, unchanged) already covers anywhere
 * the unclipped photo doesn't reach.
 *
 * A player with no photo has no real alpha shape to trace, so that case
 * keeps a plain circular stroke — there's nothing dishonest to fake there.
 *
 * ── Real style vs. fake style ──
 *
 * `style` (FaceStyle) also governs a FAKE face (lib/star/fakeFaces.ts) —
 * the backing circle, the outline, and the facesEnabled/namesEnabled master
 * toggles are photo-composition-independent, so real and fake share the one
 * set. But `scale`/`offsetX`/`offsetY`/`crop` are NOT — the fake headshots
 * are a different batch of images with their own framing, so applying the
 * real photos' tuned crop to them looks wrong. `isFakeFaceImage` detects
 * this from the loaded image's own `src` (no caller needs to say so
 * explicitly), and those four fields are swapped in from `fakeStyle`
 * (FakeFaceStyle, fakeFaceStyle.ts) whenever it fires — see
 * FakeFaceEditorScreen.tsx for the tool that tunes it.
 */
export function isFakeFaceImage(face: HTMLImageElement): boolean {
  try {
    const path = decodeURIComponent(new URL(face.src).pathname);
    return (FAKE_FACES as readonly string[]).includes(path);
  } catch {
    return false;
  }
}

export function drawPlayerHead(
  ctx: CanvasRenderingContext2D,
  cx0: number,
  cy0: number,
  headBaseR: number,
  figureR: number,
  face: HTMLImageElement | undefined,
  style: FaceStyle = DEFAULT_FACE_STYLE,
  fakeStyle: FakeFaceStyle = DEFAULT_FAKE_FACE_STYLE,
): void {
  const usingFake = !!face && isFakeFaceImage(face);
  const effective = usingFake
    ? { ...style, scale: fakeStyle.scale, offsetX: fakeStyle.offsetX, offsetY: fakeStyle.offsetY, crop: fakeStyle.crop }
    : style;
  const r = headBaseR * effective.scale;
  const cx = cx0 + effective.offsetX * headBaseR;
  const cy = cy0 + effective.offsetY * headBaseR;
  // facesEnabled is a master off switch for real photos — with it off, every
  // figure gets exactly the same fallback treatment a player with no photo
  // on file already gets (the backing circle below), never a blank head.
  const hasPhoto = effective.facesEnabled && !!face && face.complete && face.naturalWidth > 0;

  // The backing fill is what "no photo" has always looked like — drawn
  // regardless of the toggle whenever there's no photo to show at all, so a
  // generated squad's players (and anyone real whose photo hasn't loaded
  // yet) are never left with an invisible head just because backing is off.
  // For a real photo it's what shows through anywhere the photo's own real
  // alpha shape doesn't reach (it no longer clips to a circle — see above).
  if (effective.showBacking || !hasPhoto) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = effective.backingColor;
    ctx.fill();
  }

  // Computed once, up here, so the outline block below samples the exact
  // same cropped rectangle the photo itself draws — the two must never
  // disagree about which part of the source photo "here" refers to.
  // `effective.crop` — a fake face's own crop when this is one, never the
  // real photos' tuned crop applied to a differently-framed image.
  const rect = hasPhoto
    ? sourceRect(effective.crop, face!.naturalWidth, face!.naturalHeight, CROP_VIEWPORT)
    : null;

  if (effective.outlineEnabled && hasPhoto && rect) {
    const dilate = Math.max(1, figureR * 0.10 * effective.outlineWidth);
    stampOutline(ctx, face!, rect, cx - r, cy - r, r * 2, dilate, effective.outlineColor);
  }

  if (hasPhoto && rect) {
    // No circle clip — the photo draws at its own real shape. A circle here
    // would trim away exactly the hair/silhouette detail the outline above
    // exists to trace.
    ctx.drawImage(face!, rect.sx, rect.sy, rect.sw, rect.sh, cx - r, cy - r, r * 2, r * 2);
  }

  if (effective.outlineEnabled && !(hasPhoto && rect)) {
    // No photo to trace a real alpha shape from — the plain circular
    // stroke this always fell back to. Nothing dishonest to fake here.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, figureR * 0.10 * effective.outlineWidth);
    ctx.strokeStyle = effective.outlineColor;
    ctx.stroke();
  }
}

/**
 * A solid-colour silhouette of `face`'s own real alpha shape, at its
 * natural resolution — genuinely expensive to build (a full offscreen
 * drawImage + composite pass) but only ever needs building once per
 * (photo, outline colour), since a real match calls this every frame for
 * every figure on the pitch. Cached per photo actually seen; rescaled
 * cheaply at draw time via drawImage's own destination sizing.
 */
const silhouetteCache = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

function silhouetteFor(face: HTMLImageElement, color: string): HTMLCanvasElement | null {
  let byColor = silhouetteCache.get(face);
  if (!byColor) {
    byColor = new Map();
    silhouetteCache.set(face, byColor);
  }
  const cached = byColor.get(color);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = face.naturalWidth;
  canvas.height = face.naturalHeight;
  const sctx = canvas.getContext("2d");
  if (!sctx) return null;

  sctx.drawImage(face, 0, 0);
  // The standard "solid silhouette of a sprite" trick: source-in keeps only
  // the pixels the drawn image already made non-transparent, replacing
  // their colour outright — the RESULT's own alpha shape is identical to
  // the photo's, just a flat colour instead of the real image.
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = color;
  sctx.fillRect(0, 0, canvas.width, canvas.height);

  byColor.set(color, canvas);
  return canvas;
}

const RING_POINTS = 12;

/**
 * Stamps `face`'s own silhouette at RING_POINTS positions around a ring of
 * radius `dilate`, all sampling the SAME cropped source rectangle the real
 * photo itself draws at `dx,dy,size,size` — so once the real photo draws on
 * top of this (by the caller, immediately after), it covers the centre of
 * its own dilated shadow, leaving only the newly-exposed ring visible. That
 * ring reads as an outline hugging the photo's own real shape, whatever it
 * actually is — never a shape approximating it.
 */
function stampOutline(
  ctx: CanvasRenderingContext2D,
  face: HTMLImageElement,
  rect: { sx: number; sy: number; sw: number; sh: number },
  dx: number,
  dy: number,
  size: number,
  dilate: number,
  color: string,
): void {
  const silhouette = silhouetteFor(face, color);
  if (!silhouette) return;
  for (let i = 0; i < RING_POINTS; i++) {
    const angle = (i / RING_POINTS) * Math.PI * 2;
    const ox = Math.cos(angle) * dilate;
    const oy = Math.sin(angle) * dilate;
    ctx.drawImage(silhouette, rect.sx, rect.sy, rect.sw, rect.sh, dx + ox, dy + oy, size, size);
  }
}
