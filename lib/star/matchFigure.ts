/**
 * THE ONE PLACE THE MATCH DRAWS A MAN — so swapping the figures is one edit.
 *
 * Harry (3 Oct 2026) plans to replace the drawn figures with pre-rendered 3D
 * sprites. Every footballer and keeper the match paints comes through
 * `drawMatchFigure`, in either view:
 *
 *   - "classic": exactly the call CanvasMatch always made (drawFigureAt /
 *     drawKeeperAt), shadow and all.
 *   - "new" (lib/star/matchView.ts, option D): a soft contact shadow thrown
 *     to one side, then the same body with a thin dark outline round it.
 *
 * A sprite swap replaces the body call below; the shadow, the outline and
 * every call site stay as they are.
 */
import {
  drawFigureAt, drawKeeperAt,
  type FigureLook, type FigureDrawOpts, type KeeperPose, FIGURE_HEIGHT_R,
} from "./fiveASide/render";
import { drawSoftShadow } from "./figure3d";
import type { FaceStyle } from "./faceStyle";
import type { FakeFaceStyle } from "./fakeFaceStyle";

export interface MatchFigureSpec {
  look: FigureLook;
  faceStyle: FaceStyle;
  fakeFaceStyle: FakeFaceStyle;
  opts: FigureDrawOpts;
  /** Given: a goalkeeper in this pose. */
  keeper?: KeeperPose;
}

/** Off-screen scratch canvases for the outline, reused for every figure. */
let bodyCv: HTMLCanvasElement | null = null;
let rimCv: HTMLCanvasElement | null = null;
function scratch(w: number, h: number): [CanvasRenderingContext2D, CanvasRenderingContext2D] | null {
  if (typeof document === "undefined") return null;
  if (!bodyCv) { bodyCv = document.createElement("canvas"); rimCv = document.createElement("canvas"); }
  for (const c of [bodyCv, rimCv!]) {
    if (c.width < w) c.width = w;
    if (c.height < h) c.height = h;
  }
  const a = bodyCv.getContext("2d"), b = rimCv!.getContext("2d");
  return a && b ? [a, b] : null;
}

/** The outline's colour: near-black with a little green, not pure black. */
const RIM = "rgba(8,22,10,0.82)";

function paintBody(ctx: CanvasRenderingContext2D, x: number, groundY: number, r: number, s: MatchFigureSpec, opts: FigureDrawOpts) {
  if (s.keeper) drawKeeperAt(ctx, x, groundY, r, s.look, s.keeper, s.faceStyle, s.fakeFaceStyle, opts);
  else drawFigureAt(ctx, x, groundY, r, s.look, s.faceStyle, s.fakeFaceStyle, opts);
}

/**
 * One man, boots at (x, groundY) on the screen, anatomy unit `r` (see
 * figureRForHeight). `view` is the match view this frame is drawn in.
 */
export function drawMatchFigure(
  ctx: CanvasRenderingContext2D,
  view: "new" | "classic",
  x: number, groundY: number, r: number,
  spec: MatchFigureSpec,
): void {
  if (view === "classic") { paintBody(ctx, x, groundY, r, spec, spec.opts); return; }

  // ── The contact shadow: soft, a little long, thrown to the lower right ──
  const sr = spec.opts.shadowR ?? r * 0.34;
  drawSoftShadow(ctx, x + r * 0.22, groundY + r * 0.05, sr * 1.25, r * 0.17);

  // ── The body, outlined ──
  // Painted off screen, then stamped round itself in a dark silhouette so
  // the edge follows the actual figure (head, arms, a diving keeper) rather
  // than a box or a circle.
  const halfW = Math.ceil(r * 3.4);
  const top = Math.ceil(r * (FIGURE_HEIGHT_R + 2.2));
  const bottom = Math.ceil(r * 1.4);
  const w = halfW * 2, h = top + bottom;
  const sc = scratch(w, h);
  if (!sc) { paintBody(ctx, x, groundY, r, spec, spec.opts); return; }
  const [b, rim] = sc;
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.clearRect(0, 0, w, h);
  // The man without his own shadow — his shadow is the one above.
  paintBody(b, halfW, top, r, spec, { ...spec.opts, shadowR: 0 });

  rim.setTransform(1, 0, 0, 1, 0, 0);
  rim.globalCompositeOperation = "source-over";
  rim.clearRect(0, 0, w, h);
  const t = Math.max(1, Math.min(3, r * 0.07));
  const src = bodyCv!;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    rim.drawImage(src, 0, 0, w, h, Math.cos(a) * t, Math.sin(a) * t, w, h);
  }
  rim.globalCompositeOperation = "source-in";
  rim.fillStyle = RIM;
  rim.fillRect(0, 0, w, h);
  rim.globalCompositeOperation = "source-over";
  rim.drawImage(src, 0, 0, w, h, 0, 0, w, h);

  ctx.drawImage(rimCv!, 0, 0, w, h, x - halfW, groundY - top, w, h);
}
