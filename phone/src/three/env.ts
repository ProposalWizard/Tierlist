/**
 * THE FEW BROWSER PIECES THE GAME'S 3D CODE EXPECTS, ON THE PHONE.
 *
 * three.js and lib/star's 3D scenes were written for a browser. The phone
 * gives them only what they touch, nothing more:
 * - TextDecoder (three reads the file's header with it) when the engine has none;
 * - navigator.userAgent as "" when missing (three's loader reads it);
 * - a ResizeObserver that never fires (a phone screen in portrait does not
 *   change size under a scene; the scenes size themselves once at the start);
 * - `withSceneDocument(fn)`: while a 3D scene is being built, a `document`
 *   whose createElement("canvas") gives a Skia canvas (shirt numbers, labels)
 *   and whose createElementNS(…, "canvas") gives the GL canvas the scene's
 *   WebGLRenderer draws into (./gl.ts). Outside that build `document` is gone
 *   again, so the rest of the app (and lib/star's "no browser" checks) are
 *   unchanged.
 */
import { OffscreenCanvas2D } from "../draw/offscreen";
import { threePlatform } from "./platform";

let done = false;
export function ensureThreeEnv() {
  if (done) return;
  done = true;
  const g = globalThis as Record<string, unknown>;
  if (typeof g.TextDecoder === "undefined") g.TextDecoder = Utf8Decoder;
  const nav = g.navigator as Record<string, unknown> | undefined;
  if (nav && typeof nav.userAgent !== "string") {
    try { nav.userAgent = ""; } catch { /* read-only: three guards */ }
  }
  if (typeof g.ResizeObserver === "undefined") {
    g.ResizeObserver = class { observe() { /* never resizes */ } unobserve() { /* no-op */ } disconnect() { /* no-op */ } };
  }
}

/** UTF-8 only (all three asks of it). */
class Utf8Decoder {
  decode(input?: ArrayBufferView | ArrayBuffer): string {
    if (!input) return "";
    const b = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    let out = "";
    let i = 0;
    const chunk: number[] = [];
    const flush = () => { out += String.fromCharCode.apply(null, chunk as never); chunk.length = 0; };
    while (i < b.length) {
      const c = b[i++];
      let cp = c;
      if (c >= 0xf0) cp = ((c & 0x07) << 18) | ((b[i++] & 0x3f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
      else if (c >= 0xe0) cp = ((c & 0x0f) << 12) | ((b[i++] & 0x3f) << 6) | (b[i++] & 0x3f);
      else if (c >= 0xc0) cp = ((c & 0x1f) << 6) | (b[i++] & 0x3f);
      if (cp > 0xffff) { cp -= 0x10000; chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff)); }
      else chunk.push(cp);
      if (chunk.length > 4096) flush();
    }
    flush();
    return out;
  }
}

/** The GL canvas a scene's WebGLRenderer will take next (set by ./farewellScenes.ts). */
let nextGlCanvas: unknown = null;
export function offerGlCanvas(c: unknown) { nextGlCanvas = c; }
/** Take the offered GL canvas (once). */
export function takeGlCanvas(): unknown { const c = nextGlCanvas; nextGlCanvas = null; return c; }

let depth = 0;
/** True while a 3D scene is being built (the headless check reads it). */
export const sceneBuildActive = () => depth > 0;

function standIn() {
  const Skia = threePlatform().Skia;
  const canvas2d = () => new OffscreenCanvas2D(Skia, 300, 150, threePlatform().fontFor);
  return {
    __kib3d: true,
    createElement(tag: string) {
      if (String(tag).toLowerCase() === "canvas") return canvas2d();
      throw new Error(`3D: document.createElement("${tag}") is not available on the phone`);
    },
    createElementNS(_ns: string, tag: string) {
      if (String(tag).toLowerCase() !== "canvas") throw new Error(`3D: document.createElementNS("${tag}") is not available on the phone`);
      return takeGlCanvas() ?? canvas2d();
    },
  };
}

/**
 * Run an async 3D build with a stand-in `document` (see the top). Builds may
 * overlap; the stand-in goes when the last one ends. Where a real document
 * exists (the headless check in a browser) it is left alone.
 */
export async function withSceneDocument<T>(fn: () => Promise<T>): Promise<T> {
  ensureThreeEnv();
  const g = globalThis as { document?: unknown };
  const real = g.document !== undefined && !(g.document as { __kib3d?: boolean }).__kib3d;
  if (depth++ === 0 && !real) g.document = standIn();
  try { return await fn(); } finally {
    if (--depth === 0 && !real) delete g.document;
  }
}

/** The same, for a short synchronous piece (dressing a man: his shirt number canvas). */
export function withSceneDocumentSync<T>(fn: () => T): T {
  ensureThreeEnv();
  const g = globalThis as { document?: unknown };
  const real = g.document !== undefined && !(g.document as { __kib3d?: boolean }).__kib3d;
  if (depth++ === 0 && !real) g.document = standIn();
  try { return fn(); } finally {
    if (--depth === 0 && !real) delete g.document;
  }
}
