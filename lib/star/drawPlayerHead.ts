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

  // The backing fill is what "no photo" has always looked like — drawn
  // regardless of the toggle whenever there's no photo to show at all, so a
  // generated squad's players (and anyone real whose photo hasn't loaded
  // yet) are never left with an invisible head just because backing is off.
  if (style.showBacking || !hasPhoto) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = style.backingColor;
    ctx.fill();
  }

  if (hasPhoto) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(face!, cx - r, cy - r, r * 2, r * 2);
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
