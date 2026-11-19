/**
 * WEB ONLY (the look check, phone/tools/look). metro.config.js sends every
 * `import … from "@shopify/react-native-skia"` here when bundling for a browser;
 * the Android bundle never reads this file.
 *
 * Skia's web Canvas spreads its `style` into a plain <div>, so a style LIST
 * ([{ width, height }, style], fine on a phone) crashes the page. Here the list
 * is flattened into one style first. Everything else is Skia as it is.
 */
import { createElement, forwardRef } from "react";
import { StyleSheet } from "react-native";
import { Canvas as SkiaCanvas, matchFont as skiaMatchFont } from "@shopify/react-native-skia";
import { webFont } from "./fonts";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Skia's own web canvas (plain JS)
import { JsiSkCanvas } from "@shopify/react-native-skia/lib/module/skia/web/JsiSkCanvas";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Skia's own web surface maker (plain JS)
import { JsiSkSurfaceFactory } from "@shopify/react-native-skia/lib/module/skia/web/JsiSkSurfaceFactory";

export * from "@shopify/react-native-skia";

// Each offscreen surface on the web is a new WebGL context, and a browser keeps
// only 16: the sprite tints alone used them up and the pitch went blank. On the
// web they are plain (processor) surfaces instead; they draw the same.
(JsiSkSurfaceFactory as unknown as { prototype: { MakeOffscreen: unknown; Make: (w: number, h: number) => unknown } }).prototype.MakeOffscreen =
  function MakeOffscreen(this: { Make: (w: number, h: number) => unknown }, w: number, h: number) { return this.Make(w, h); };

// Skia's web canvas draws an SVG (club badges, flags) at its own size and
// ignores the width and height asked for; on a phone it is scaled into the box.
// Scaled here the same way.
type WebCanvas = { CanvasKit: { MakeImageFromCanvasImageSource: (s: unknown) => { width(): number; height(): number } | null }; ref: { save(): number; restore(): void; scale(x: number, y: number): void; drawImage(i: unknown, x: number, y: number): void } };
(JsiSkCanvas as unknown as { prototype: { drawSvg: (this: WebCanvas, svg: { ref: unknown }, w?: number, h?: number) => void } }).prototype.drawSvg = function drawSvg(svg, w, h) {
  const el = svg.ref as { width?: number; height?: number };
  if (w && h && typeof el.width === "number") { el.width = Math.ceil(w * 2); el.height = Math.ceil(h * 2); }
  const image = this.CanvasKit.MakeImageFromCanvasImageSource(svg.ref);
  if (!image) return;
  const iw = image.width(), ih = image.height();
  this.ref.save();
  if (w && h && iw && ih) this.ref.scale(w / iw, h / ih);
  this.ref.drawImage(image, 0, 0);
  this.ref.restore();
};

/** The phone's matchFont finds Roboto on the phone; here, the Roboto files the look check serves. */
export const matchFont: typeof skiaMatchFont = (style) => webFont(style as never) ?? skiaMatchFont(style);

type CanvasProps = Parameters<typeof SkiaCanvas>[0];
export const Canvas = forwardRef<unknown, CanvasProps>(function Canvas(props, ref) {
  const style = StyleSheet.flatten((props as { style?: unknown }).style as never) as { width?: unknown; height?: unknown } | undefined;
  // A browser keeps only 16 live WebGL canvases; a league table has 20+ badges and
  // the oldest went blank. Small drawings (badges, flags, small figures) are drawn
  // once and handed to a plain canvas instead (Skia's own web option).
  const w = style?.width, h = style?.height;
  const small = typeof w === "number" && typeof h === "number" && w * h <= 160 * 160;
  return createElement(SkiaCanvas as never, { ...props, style, ref, ...(small ? { __destroyWebGLContextAfterRender: true } : {}) } as never);
}) as unknown as typeof SkiaCanvas;
