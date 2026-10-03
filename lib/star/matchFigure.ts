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
import { drawSprite, type SpriteChar, type SpriteClip, type SpriteKit } from "./sprites";
import { matchPlayersLook } from "./newLook";

/**
 * What the baked 3D figure should show (lib/star/sprites.ts). Used only in
 * the new view with "Players in the match: 3D"; anywhere else, or before the
 * sprites have loaded, the drawn figure is painted as before.
 */
export interface MatchSpriteHint {
  char: SpriteChar;
  clip: SpriteClip;
  /** Seconds into the clip. */
  t: number;
  /** Screen angle he faces (0 = right, PI/2 = down the screen). */
  facing: number;
  kit: SpriteKit;
}

export interface MatchFigureSpec {
  look: FigureLook;
  faceStyle: FaceStyle;
  fakeFaceStyle: FakeFaceStyle;
  opts: FigureDrawOpts;
  /** Given: a goalkeeper in this pose. */
  keeper?: KeeperPose;
  /** Given: the baked 3D figure to draw instead, in the new view. */
  sprite?: MatchSpriteHint;
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

  // ── The 3D figure (Settings → Look → Players in the match: 3D) ──
  // Baked with its own 1 px outline, so it is drawn straight on. A man in the
  // air (a wall jumping) is lifted off his shadow; a keeper's dive is in the
  // clip itself.
  if (spec.sprite && matchPlayersLook() === "3d") {
    const lift = spec.keeper ? 0 : Math.max(0, spec.opts.liftPx ?? 0);
    const height = r * FIGURE_HEIGHT_R * SPRITE_HEIGHT_K;
    if (drawSprite(ctx, x, groundY - lift, { ...spec.sprite, facingRad: spec.sprite.facing, height })) {
      drawMarkers(ctx, x, groundY - lift - height, r, spec.opts);
      return;
    }
  }

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

/**
 * The baked man's boots-to-crown height against the drawn one's. Its outline
 * and the tilt already add a little, so a touch under 1 puts both at about the
 * same size on the pitch (about 22 px on a phone).
 */
const SPRITE_HEIGHT_K = 0.86;

/** The star over your head and a name, upright, above a 3D figure's crown. */
function drawMarkers(ctx: CanvasRenderingContext2D, x: number, crown: number, r: number, opts: FigureDrawOpts) {
  if (opts.star) {
    ctx.save();
    ctx.beginPath();
    const sr = r * 0.22, sy = crown - sr * 1.3;
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? sr : sr * 0.45;
      const fx = x + Math.cos(a) * rad, fy = sy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(fx, fy); else ctx.lineTo(fx, fy);
    }
    ctx.closePath();
    if (opts.starRim) {
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1.5, sr * 0.34);
      ctx.strokeStyle = opts.starRim;
      ctx.stroke();
    }
    ctx.fillStyle = "#fde68a";
    ctx.fill();
    ctx.restore();
  }
  if (opts.label) {
    ctx.font = `700 ${Math.max(8, r * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    const ly = crown - r * (opts.star ? 0.78 : 0.16);
    ctx.strokeText(opts.label, x, ly);
    ctx.fillStyle = opts.labelColor ?? "#ffffff";
    ctx.fillText(opts.label, x, ly);
    ctx.textAlign = "start";
  }
}
