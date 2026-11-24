/**
 * OFFSCREEN CANVASES AND PICTURES, FOR THE FEW DRAWERS THAT NEED THEM.
 *
 * Some website drawings paint onto a hidden canvas first and then stamp it
 * (the Home figure's rim lights, heroFigure.ts `compositeLit`, make
 * `document.createElement("canvas")` canvases). The phone has no `document`.
 *
 * - `OffscreenCanvas2D`: a canvas with real pixels (a Skia surface), with
 *   width/height, getContext("2d") → Ctx2D, and drawImage-able.
 * - `withCanvasDocument(Skia, fn)`: runs `fn` with a tiny `document` whose
 *   createElement("canvas") makes OffscreenCanvas2D. Only for the length of
 *   that one call; outside it `document` is undefined again, so the rest of
 *   the app (and lib/star's own "no browser" checks) are unchanged.
 * - `faceRef(url)` / `loadedFace(url, image)`: the "face picture" lib/star
 *   drawers take (they read src, complete, naturalWidth, naturalHeight), with
 *   the Skia image when it has loaded.
 */
import type { Skia as SkiaValue, SkImage, SkSurface } from "@shopify/react-native-skia";
type SkiaApi = typeof SkiaValue;
import { Ctx2D, type FontFor } from "./ctx2d";

export class OffscreenCanvas2D {
  private w: number;
  private h: number;
  private surface: SkSurface | null = null;
  private ctx: Ctx2D | null = null;
  private snap: { v: number; img: SkImage } | null = null;
  readonly style: Record<string, string> = {};
  constructor(private Skia: SkiaApi, w = 300, h = 150, private fontFor?: FontFor) { this.w = w; this.h = h; }

  get width() { return this.w; }
  set width(v: number) { this.w = Math.max(0, Math.floor(v) || 0); this.drop(); }
  get height() { return this.h; }
  set height(v: number) { this.h = Math.max(0, Math.floor(v) || 0); this.drop(); }
  /** Changing the size wipes the canvas, as in a browser. */
  private drop() { this.surface = null; this.snap = null; if (this.ctx) this.ctx = null; }

  getContext(kind: string): Ctx2D | null {
    if (kind !== "2d") return null;
    if (this.ctx) return this.ctx;
    this.surface = this.Skia.Surface.Make(Math.max(1, this.w), Math.max(1, this.h));
    if (!this.surface) return null;
    this.ctx = new Ctx2D(this.Skia, this.surface.getCanvas(), { width: this.w, height: this.h, fontFor: this.fontFor, pixels: true, canvasObject: this });
    return this.ctx;
  }
  /** Its picture as a Skia image (taken again only after it changes). */
  __skiaImage(): SkImage | null {
    if (!this.w || !this.h) return null;
    if (!this.surface || !this.ctx) { this.getContext("2d"); }
    if (!this.surface || !this.ctx) return null;
    if (this.snap && this.snap.v === this.ctx.version) return this.snap.img;
    this.surface.flush();
    const img = this.surface.makeImageSnapshot();
    this.snap = { v: this.ctx.version, img };
    return img;
  }
  /**
   * The picture was handed on (uploaded to the GL: src/three/gl.ts): let go of the snapshot now. Each redraw of the canvas takes a
   * new one (a copy of its pixels, 2.3 MB for the signing's contract) and the old ones were only freed when the JavaScript engine
   * next collected, which it does not do for native memory it cannot see (the contract is redrawn every frame while the name is written).
   */
  __release() {
    const s = this.snap;
    this.snap = null;
    try { s?.img.dispose?.(); } catch { /* already gone */ }
  }
  addEventListener() { /* no events offscreen */ }
  removeEventListener() { /* no events offscreen */ }
}

/**
 * Run `fn` with a stand-in `document` that can make canvases. Synchronous
 * only: the stand-in is gone again before anything else in the app runs.
 */
export function withCanvasDocument<T>(Skia: SkiaApi, fn: () => T, fontFor?: FontFor): T {
  const g = globalThis as { document?: unknown };
  if (g.document !== undefined) return fn();
  g.document = {
    createElement(tag: string) {
      if (String(tag).toLowerCase() !== "canvas") throw new Error(`draw: document.createElement("${tag}") is not available on the phone`);
      return new OffscreenCanvas2D(Skia, 300, 150, fontFor);
    },
  };
  try { return fn(); } finally { delete g.document; }
}

/** The face picture a lib/star drawer is given (it reads these four fields). */
export interface FacePicture {
  src: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  /** The decoded picture, once loaded. */
  skImage?: SkImage | null;
  __skiaImage?: () => SkImage | null;
}

/** The website's own address: lib/star tells fake faces from real ones by the path in the URL. */
export const SITE = "https://knowitball.co.uk";

/**
 * The full address a browser would give a picture path: the site in front,
 * spaces and the like escaped ("/ChatGPT Image Sep 15, 2026….png" is a real
 * fake-face file name).
 */
export function absoluteUrl(url: string): string {
  if (/^[a-z]+:/i.test(url)) return url;
  return SITE + encodeURI(url.startsWith("/") ? url : "/" + url);
}
/** A face picture that has not loaded (what the website has until the photo arrives). */
export function faceRef(url: string): FacePicture {
  return { src: absoluteUrl(url), complete: false, naturalWidth: 0, naturalHeight: 0 };
}
/** The same face picture once its image has loaded. */
export function loadedFace(url: string, image: SkImage): FacePicture {
  const f = faceRef(url);
  return { ...f, complete: true, naturalWidth: image.width(), naturalHeight: image.height(), skImage: image, __skiaImage: () => image };
}
