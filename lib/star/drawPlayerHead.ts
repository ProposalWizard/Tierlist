import { DEFAULT_FACE_STYLE, CROP_VIEWPORT, type FaceStyle } from "./faceStyle";
import { sourceRect } from "./portrait";
import { getFaceContour, requestFaceContour, type FaceContour } from "./faceOutline";

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
 * An earlier version assumed real player photos were alpha-cut-out
 * headshots and tried to trace that shape for the outline. Reported back
 * directly that they're plain rectangles — neck and shirt included: "some
 * of the picture is in it that i dont want in it." So the real fix wasn't a
 * cleverer outline, it was a genuine CROP — `style.crop` (a `CropView`,
 * `lib/star/portrait.ts` — the exact same pan/zoom geometry the existing
 * "Your photo" picker already uses) decides which rectangle of the source
 * photo `sourceRect` samples.
 *
 * ── The outline traces the real detected face, pixel-shaped, not a stand-in ──
 *
 * A plain circular stroke around the crop was tried next, and after that a
 * box-derived ellipse — both reported back as still not what was wanted,
 * the second emphatically: "I DONT WANT A SHAPE! ... I WANT THE OUTLINE
 * AROUND THE PIXELS OF THE PLAYERS' FACES!" `faceOutline.ts` now runs real
 * 68-point facial LANDMARK detection (face-api.js, already a dependency of
 * this codebase for tierlist thumbnail centering — the landmark model is a
 * separate download added specifically for this) and returns the actual
 * detected jaw/cheek/chin contour for that one specific photo, transformed
 * point-by-point through the SAME crop mapping `sourceRect` already puts the
 * photo itself in — a real, different polygon per player, not one shape
 * for all of them. Detection is async and only ever resolves after this
 * function has already returned once or twice, so a not-yet-known photo (or
 * one no face was found in, or one with no photo at all) draws the original
 * plain circular stroke instead — never a blocked draw call, never a
 * missing outline, and no shape pretending to be a specific face it isn't.
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

    let contour: FaceContour | null = null;
    if (hasPhoto && rect) {
      requestFaceContour(face!.src);
      // getFaceContour's undefined ("not yet known") and null ("no face
      // found") both mean the same thing here: draw the fallback circle.
      contour = getFaceContour(face!.src) ?? null;
    }

    if (contour && contour.length > 0 && rect) {
      // The same photo→local-head-space mapping sourceRect's own consumer
      // (the drawImage call above) uses: a point at fraction (u,v) across
      // the sampled rect lands at cx/cy ± (u/v - 0.5) * the full 2r
      // diameter. Uniform (never stretching — sourceRect's sw always equals
      // sh, a square crop viewport) — applied per point, so the actual
      // traced jaw/cheek/chin curve moves and scales with the crop exactly
      // the way the photo underneath it does, not a re-derived approximation.
      ctx.beginPath();
      contour.forEach((p, i) => {
        const faceXPx = p.x * face!.naturalWidth;
        const faceYPx = p.y * face!.naturalHeight;
        const u = (faceXPx - rect.sx) / rect.sw;
        const v = (faceYPx - rect.sy) / rect.sh;
        const px = cx + (u - 0.5) * r * 2;
        const py = cy + (v - 0.5) * r * 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.stroke();
    } else {
      // No photo, no detection yet, or no face found in this one — the
      // plain circular stroke this whole file always had. There is no way
      // to trace "this specific face's pixels" without a real successful
      // detection to trace, so this stays deliberately plain rather than
      // another shape standing in for one.
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
