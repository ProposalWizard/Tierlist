/**
 * WEB ONLY (the look check, phone/tools/look). The Android app never reads this
 * file: on a phone `./offscreen` is offscreen.ts.
 *
 * On a phone there is no `document`, so offscreen.ts lends the drawers a stand-in
 * one whose canvases are Skia surfaces. A browser HAS a real `document` (and it
 * cannot be swapped), so the drawers made real browser canvases that Skia cannot
 * draw ("a drawing failed: drawImage …"). Here, for the length of one drawing,
 * the real document's createElement("canvas") hands out the same Skia canvases
 * the phone uses. Everything else is offscreen.ts as it is.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: the phone's own file (an explicit .ts so this file does not load itself)
import * as Base from "./offscreen.ts";
import type { SkiaApi } from "../three/platform";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: as above
export * from "./offscreen.ts";

type FontFor = ConstructorParameters<typeof Base.OffscreenCanvas2D>[3];

export function withCanvasDocument<T>(Skia: SkiaApi, fn: () => T, fontFor?: FontFor): T {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc) return (Base.withCanvasDocument as typeof withCanvasDocument)(Skia, fn, fontFor);
  const own = Object.prototype.hasOwnProperty.call(doc, "createElement");
  const before = doc.createElement;
  (doc as unknown as { createElement: (t: string) => unknown }).createElement = (tag: string) =>
    String(tag).toLowerCase() === "canvas" ? new Base.OffscreenCanvas2D(Skia, 300, 150, fontFor) : before.call(doc, tag);
  try { return fn(); } finally {
    if (own) (doc as unknown as { createElement: unknown }).createElement = before;
    else delete (doc as unknown as { createElement?: unknown }).createElement;
  }
}
