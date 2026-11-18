/**
 * THE SAVED VIDEO'S FRAMES AS PIXELS — encode.ts draws each frame onto a
 * w x h canvas and hands it to the encoder; this is that canvas on the phone:
 * a Skia surface of the edit's own size (one pixel per website pixel), black
 * underneath, the frame drawn by match/goalClip/render.ts through the
 * phone's canvas-2D stand-in in its own layer (as recordDrawing does), read
 * back as RGBA bytes for the encoder (modules/goal-video-encoder).
 * No phone APIs here, so tools/goal-video-file.ts runs it headless.
 */
import type { Skia as SkiaValue, SkSurface } from "@shopify/react-native-skia";
import type { Edit } from "@/lib/star/goalClip/edit";
import { Ctx2D, type FontFor } from "../../draw/ctx2d";
import { withCanvasDocument } from "../../draw/offscreen";
import { drawEditFrame, type ClipCredit } from "./render";

type SkiaApi = typeof SkiaValue;
/** Skia's RGBA_8888 and premultiplied alpha (ColorType / AlphaType), as numbers so this file needs no phone import. */
const RGBA_8888 = 4, PREMUL = 2;

export interface FrameReader { read(edit: Edit, t: number, credit?: ClipCredit): Uint8Array; dispose(): void }

export function videoFrameReader(Skia: SkiaApi, w: number, h: number, fontFor?: FontFor): FrameReader {
  const surface: SkSurface | null = Skia.Surface.Make(w, h);
  if (!surface) throw new Error("no drawing surface");
  const canvas = surface.getCanvas();
  const black = Skia.Color("#000000");
  return {
    read(edit, t, credit) {
      canvas.clear(black);
      canvas.saveLayer();
      const ctx = new Ctx2D(Skia, canvas, { width: w, height: h, fontFor });
      try {
        withCanvasDocument(Skia, () => drawEditFrame(ctx as unknown as CanvasRenderingContext2D, edit, t, credit), fontFor);
      } finally {
        ctx.reset();
        canvas.restore();
      }
      surface.flush();
      const img = surface.makeImageSnapshot();
      const px = img.readPixels(0, 0, { width: w, height: h, colorType: RGBA_8888, alphaType: PREMUL });
      (img as unknown as { dispose?: () => void }).dispose?.();
      if (!(px instanceof Uint8Array)) throw new Error("could not read the frame");
      return px;
    },
    dispose() { (surface as unknown as { dispose?: () => void }).dispose?.(); },
  };
}
