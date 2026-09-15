import { DEFAULT_FACE_STYLE, CROP_VIEWPORT, type FaceStyle } from "./faceStyle";
import { sourceRect } from "./portrait";
import { getFaceOutline, requestFaceOutline, type FaceEllipse } from "./faceOutline";

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
 * ── The crop ──
 *
 * An earlier version assumed real player photos were alpha-cut-out
 * headshots and tried to trace that shape for the outline. Reported back
 * directly that they're plain rectangles — neck and shirt included: "some
 * of the picture is in it that i dont want in it." So the real fix wasn't a
 * cleverer outline, it was a genuine CROP — `style.crop` (a `CropView`,
 * `lib/star/portrait.ts` — the exact same pan/zoom geometry the existing
 * "Your photo" picker already uses) decides which rectangle of the source
 * photo `sourceRect` samples.
 *
 * ── The outline traces the real detected face, not the crop circle ──
 *
 * A plain circular stroke around the crop was tried next and reported back
 * as still not what was wanted: "the outline is still for the circle not
 * the face." `faceOutline.ts` runs real face detection (face-api.js,
 * already a dependency of this codebase for tierlist thumbnail centering)
 * per photo, cached, and returns an ellipse in the SAME crop-transformed
 * local space `sourceRect` already puts the photo itself in — so the
 * outline actually hugs the specific face in that specific photo. Detection
 * is async and only ever resolves after this function has already returned
 * once or twice, so a not-yet-known photo (or one no face was found in, or
 * one with no photo at all) falls back to the plain circular stroke —
 * never a blocked draw, never a missing outline.
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
  // facesEnabled is a master off switch for real photos — with it off, every
  // figure gets exactly the same fallback treatment a player with no photo
  // on file already gets (the backing circle below), never a blank head.
  const hasPhoto = style.facesEnabled && !!face && face.complete && face.naturalWidth > 0;

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

  // Computed once, up here, so the outline block below can reuse the exact
  // same crop rectangle the photo itself was drawn with — the two must never
  // disagree about which part of the source photo "here" refers to.
  const rect = hasPhoto
    ? sourceRect(style.crop, face!.naturalWidth, face!.naturalHeight, CROP_VIEWPORT)
    : null;

  if (hasPhoto && rect) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face!, rect.sx, rect.sy, rect.sw, rect.sh, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  if (style.outlineEnabled) {
    ctx.lineWidth = Math.max(1, figureR * 0.10 * style.outlineWidth);
    ctx.strokeStyle = style.outlineColor;

    let shape: FaceEllipse | null = null;
    if (hasPhoto && rect) {
      requestFaceOutline(face!.src);
      // getFaceOutline's undefined ("not yet known") and null ("no face
      // found") both mean the same thing here: draw the fallback circle.
      shape = getFaceOutline(face!.src) ?? null;
    }

    if (shape && rect) {
      // The same photo→local-head-space mapping sourceRect's own consumer
      // (the drawImage call above) uses: a point at fraction (u,v) across
      // the sampled rect lands at cx/cy ± (u/v - 0.5) * the full 2r
      // diameter. Uniform (never stretching — sourceRect's sw always equals
      // sh, a square crop viewport), so a real ellipse stays a real ellipse
      // through the transform, just scaled and moved.
      const faceCxPx = shape.cx * face!.naturalWidth;
      const faceCyPx = shape.cy * face!.naturalHeight;
      const u = (faceCxPx - rect.sx) / rect.sw;
      const v = (faceCyPx - rect.sy) / rect.sh;
      const ex = cx + (u - 0.5) * r * 2;
      const ey = cy + (v - 0.5) * r * 2;
      // A light sanity clamp, not a real bound on ordinary variation — this
      // has never been seen live, so a genuinely bad detection (a mislabeled
      // photo, an unusual crop) gets caught here rather than drawing a huge
      // or vanishingly small stray shape nowhere near the actual head.
      const erx = clamp((shape.rx * face!.naturalWidth / rect.sw) * r * 2, r * 0.3, r * 1.4);
      const ery = clamp((shape.ry * face!.naturalHeight / rect.sh) * r * 2, r * 0.3, r * 1.4);
      ctx.beginPath();
      ctx.ellipse(ex, ey, erx, ery, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // No photo, no detection yet, or no face found in this one — the
      // original plain circle, exactly as it has always looked.
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
