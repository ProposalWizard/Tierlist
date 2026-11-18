/**
 * <Drawn width height draw={(ctx) => ...} />: SHOW A WEBSITE DRAWING ON THE PHONE.
 *
 * `draw` gets a canvas 2D context (ctx2d.ts) and calls a lib/star drawer with
 * it, exactly as the website's <canvas> code does. The drawing is recorded
 * once into a Skia Picture and shown with <Picture/>; it is recorded again
 * only when `deps` change (default: draw, width, height). Pass a stable
 * `draw` (useCallback) or your own `deps`, or it re-records on every render.
 *
 * Props
 *   width, height  the box, in screen points
 *   draw(ctx, info) paints; info = { width, height, pixelRatio }.
 *   rawPixels      false (default): the drawer works in POINTS (ctx.canvas is
 *                  width x height) and the picture is made at the screen's
 *                  own sharpness underneath. Use this for any drawer that
 *                  does not size its canvas itself (drawFigureAt, the head
 *                  chip, the ball...).
 *                  true: ctx.canvas is width*pixelRatio by height*pixelRatio
 *                  device pixels and the drawer scales itself, exactly like a
 *                  website component that does `canvas.width = w * dpr` and
 *                  `setTransform(dpr, ...)` (PlayerAvatar -> PlayerFigure).
 *   pixelRatio     the screen's pixels per point (default PixelRatio.get(), at most 3).
 *   offscreen      default true: while drawing, a stand-in `document` can make
 *                  hidden canvases (offscreen.ts), so lib/star's cached
 *                  pieces (soft shadows, grass, sprite caches, rim lights)
 *                  work as on the website. false: drawers see no `document`.
 *   deps           when to record again.
 *   style          extra style for the <Canvas/>.
 *
 * Also exported: `recordDrawing` (the same, as a function returning the
 * SkPicture) and `phoneFontFor` (canvas fonts -> the phone's system fonts).
 */
import { useMemo, type DependencyList } from "react";
import { PixelRatio, Platform, type StyleProp, type ViewStyle } from "react-native";
import { Canvas, Group, Picture, Skia, matchFont, type SkFont, type SkPicture } from "@shopify/react-native-skia";
import { Ctx2D, type FontFor } from "./ctx2d";
import type { FontSpec } from "./css";
import { withCanvasDocument } from "./offscreen";

const GENERIC = new Set(["system-ui", "-apple-system", "blinkmacsystemfont", "segoe ui", "sans-serif", "ui-sans-serif", "helvetica", "arial", "roboto", "inter"]);
const fontCache = new Map<string, SkFont | null>();

/** A canvas font on the phone: the system sans-serif, or a named family when the phone has it. */
export const phoneFontFor: FontFor = (spec: FontSpec) => {
  const fam = spec.families.find((f) => !GENERIC.has(f.toLowerCase()) && !/^(serif|monospace|cursive|fantasy)$/i.test(f));
  const generic = spec.families.some((f) => /^monospace$/i.test(f)) ? "monospace" : spec.families.some((f) => /^serif$/i.test(f)) ? "serif" : "sans-serif";
  const family = fam ?? Platform.select({ ios: generic === "serif" ? "Times New Roman" : generic === "monospace" ? "Courier" : "Helvetica", default: generic })!;
  const weight = String(Math.min(900, Math.max(100, Math.round(spec.weight / 100) * 100))) as "400";
  const key = `${family}|${spec.size}|${weight}|${spec.italic}`;
  if (fontCache.has(key)) return fontCache.get(key)!;
  let f: SkFont | null = null;
  try { f = matchFont({ fontFamily: family, fontSize: spec.size, fontWeight: weight, fontStyle: spec.italic ? "italic" : "normal" }); }
  catch { try { f = matchFont({ fontSize: spec.size, fontWeight: weight }); } catch { f = null; } }
  fontCache.set(key, f);
  return f;
};

export interface DrawInfo { width: number; height: number; pixelRatio: number }
export type DrawFn = (ctx: CanvasRenderingContext2D, info: DrawInfo) => void;

/** The screen's pixels per point, at most 3 (as the website caps devicePixelRatio). */
export function screenPixelRatio(): number { return Math.min(3, PixelRatio.get() || 1); }

/** Record a drawing into a Skia Picture of width*pixelRatio by height*pixelRatio pixels. */
export function recordDrawing(width: number, height: number, draw: DrawFn,
  { pixelRatio = screenPixelRatio(), rawPixels = false, offscreen = true }: { pixelRatio?: number; rawPixels?: boolean; offscreen?: boolean } = {}): SkPicture {
  const W = Math.max(1, Math.round(width * pixelRatio)), H = Math.max(1, Math.round(height * pixelRatio));
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
  // Its own layer, so composite modes ("source-atop", "destination-out"...)
  // act on this drawing only, as on the website's own canvas.
  c.saveLayer();
  const ctx = new Ctx2D(Skia, c, rawPixels
    ? { width: W, height: H, fontFor: phoneFontFor }
    : { width, height, fontFor: phoneFontFor, base: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
  const run = () => draw(ctx as unknown as CanvasRenderingContext2D, { width, height, pixelRatio });
  try {
    if (offscreen) withCanvasDocument(Skia, run, phoneFontFor); else run();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[draw] a drawing failed:", e);
  }
  ctx.reset(); // closes any save() the drawer left open
  c.restore();
  return rec.finishRecordingAsPicture();
}

export function Drawn({ width, height, draw, pixelRatio = screenPixelRatio(), rawPixels = false, offscreen = true, deps, style }: {
  width: number; height: number; draw: DrawFn;
  pixelRatio?: number; rawPixels?: boolean; offscreen?: boolean; deps?: DependencyList; style?: StyleProp<ViewStyle>;
}) {
  const picture = useMemo(
    () => recordDrawing(width, height, draw, { pixelRatio, rawPixels, offscreen }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps ? [...deps, width, height, pixelRatio, rawPixels, offscreen] : [draw, width, height, pixelRatio, rawPixels, offscreen],
  );
  return (
    <Canvas style={[{ width, height }, style]}>
      <Group transform={[{ scale: 1 / pixelRatio }]}><Picture picture={picture} /></Group>
    </Canvas>
  );
}
