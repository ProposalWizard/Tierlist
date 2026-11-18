/**
 * WHAT THE PHONE'S 3D NEEDS FROM ITS SURROUNDINGS, IN ONE PLACE.
 *
 * The 3D code (./loader.ts, ./gl.ts) runs the same on the phone and in the
 * headless check (phone/tools/three-check.ts). Only these differ:
 * - `bytes(url)`: a website file address ("/star/people3d/toon-p1.glb") →
 *   its bytes (phone: the copy bundled in phone/assets/3d, ./assets.ts).
 * - `Skia`: the drawing library (phone: react-native-skia; the check:
 *   CanvasKit, the same Skia). Used to unpack the WebP pictures inside the
 *   3D files, and for the small canvases the game draws shirt numbers on.
 */
import type { Skia as SkiaValue, SkImage } from "@shopify/react-native-skia";
import type { FontFor } from "../draw/ctx2d";

export type SkiaApi = typeof SkiaValue;

export interface ThreePlatform {
  bytes(url: string): Promise<ArrayBuffer>;
  Skia: SkiaApi;
  /** Canvas fonts → the phone's fonts (shirt numbers, names). */
  fontFor?: FontFor;
}

let platform: ThreePlatform | null = null;
export function setThreePlatform(p: ThreePlatform) { platform = p; }
export function threePlatform(): ThreePlatform {
  if (!platform) throw new Error("3D: no platform set (setThreePlatform)");
  return platform;
}

/** RGBA_8888 and unpremultiplied alpha (Skia's enum values; the same on the phone and in CanvasKit). */
const RGBA_8888 = 4, UNPREMUL = 3;

/** A picture's pixels, top row first, straight (unpremultiplied) alpha. */
export function rgbaOf(img: SkImage): { width: number; height: number; data: Uint8Array } | null {
  const width = img.width(), height = img.height();
  const px = img.readPixels(0, 0, { width, height, colorType: RGBA_8888, alphaType: UNPREMUL } as never);
  if (!px) return null;
  const data = px instanceof Uint8Array ? px : new Uint8Array((px as Float32Array).buffer);
  return { width, height, data };
}

/** Unpack a picture file (WebP, PNG, JPEG) into pixels. */
export function decodePicture(bytes: Uint8Array): { width: number; height: number; data: Uint8Array } | null {
  const S = threePlatform().Skia;
  const img = S.Image.MakeImageFromEncoded(S.Data.fromBytes(bytes));
  if (!img) return null;
  const out = rgbaOf(img);
  img.dispose?.();
  return out;
}
