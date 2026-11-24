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
import { makeElement, StandInImage } from "./standIn";
import { svgPathMethods } from "./svgPath";

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
  const body = makeElement("body"), head = makeElement("head"), root = makeElement("html");
  return {
    __kib3d: true,
    hidden: false,
    visibilityState: "visible",
    body, head, documentElement: root,
    createElement(tag: string) {
      const t = String(tag).toLowerCase();
      if (t === "canvas") return canvas2d();
      if (t === "img") return new StandInImage();
      // the walk-around places build captions, fades and a speed readout from plain elements
      return makeElement(t);
    },
    createElementNS(_ns: string, tag: string) {
      const t = String(tag).toLowerCase();
      if (t === "canvas") return takeGlCanvas() ?? canvas2d();
      if (t === "img") return new StandInImage();
      // the signing scene measures its signature along an SVG path (./svgPath.ts)
      if (t === "path") { const el = makeElement(t); Object.assign(el, svgPathMethods(() => el.getAttribute("d") ?? "")); return el; }
      return makeElement(t);
    },
    createTextNode(text: string) { const e = makeElement("#text"); e.textContent = text; return e; },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() { /* no page events on a phone */ },
    removeEventListener() { /* no page events on a phone */ },
  };
}

/** Where a real document exists (the web build of the app): the renderer's canvas is still the offered GL one. */
function patchRealDocument(): () => void {
  const d = (globalThis as { document?: { createElementNS: (ns: string, tag: string) => unknown } }).document;
  if (!d) return () => {};
  const own = d.createElementNS;
  d.createElementNS = function (ns: string, tag: string) {
    const t = String(tag).toLowerCase();
    if (t === "canvas" && nextGlCanvas) return takeGlCanvas();
    // pictures come from the app's own files, as on the phone (the browser would ask the page's server)
    if (t === "img") return new StandInImage();
    return own.call(d, ns, tag);
  };
  return () => { d.createElementNS = own; };
}

/**
 * Keep the stand-in `document` for as long as a walk-around place is on screen (its frame
 * loop and its late canvases still ask for one). Returns the call that lets it go.
 * Where a real document exists (the web build) nothing is changed.
 */
export function holdSceneDocument(): () => void {
  ensureThreeEnv();
  const g = globalThis as { document?: unknown };
  const real = g.document !== undefined && !(g.document as { __kib3d?: boolean }).__kib3d;
  if (depth++ === 0 && !real) g.document = standIn();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--depth === 0 && !real) delete g.document;
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
  const unpatch = real ? patchRealDocument() : () => {};
  try { return await fn(); } finally {
    unpatch();
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
