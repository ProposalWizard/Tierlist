import { DEFAULT_FACE_STYLE, CROP_VIEWPORT, type FaceStyle } from "./faceStyle";
import { sourceRect } from "./portrait";

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
 * ── The crop, and why the outline is a plain circle again ──
 *
 * An earlier version assumed real player photos were alpha-cut-out
 * headshots and tried to trace that shape for the outline. Reported back
 * directly that they're plain rectangles — neck and shirt included: "some
 * of the picture is in it that i dont want in it." So the real fix wasn't a
 * cleverer outline, it was a genuine CROP — `style.crop` (a `CropView`,
 * `lib/star/portrait.ts` — the exact same pan/zoom geometry the existing
 * "Your photo" picker already uses) decides which rectangle of the source
 * photo `sourceRect` samples, and THAT clipped-to-a-circle result is what
 * the outline traces — a plain circular stroke is correct again once the
 * circle itself is what's actually being shown, not an approximation of it.
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

  if (hasPhoto) {
    const rect = sourceRect(style.crop, face!.naturalWidth, face!.naturalHeight, CROP_VIEWPORT);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face!, rect.sx, rect.sy, rect.sw, rect.sh, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  if (style.outlineEnabled) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, figureR * 0.10 * style.outlineWidth);
    ctx.strokeStyle = style.outlineColor;
    ctx.stroke();
  }
}
