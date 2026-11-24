/**
 * THE PHONE'S GRAPHICS CHIP, AS three.js EXPECTS A BROWSER'S WebGL2.
 *
 * expo-gl gives a real OpenGL ES 3 context with the WebGL2 calls. Three
 * differences from a browser matter to three.js and are handled here, on the
 * context itself (the way expo-three does it), so three's own code runs as is:
 * 1. Pictures: a browser uploads an <img> or <canvas> straight to the chip.
 *    The phone's are Skia canvases (shirt numbers, ./env.ts) and unpacked
 *    pixels; `texImage2D`/`texSubImage2D` given one of those upload its
 *    pixels instead.
 * 2. Flip and premultiply on upload (UNPACK_FLIP_Y_WEBGL,
 *    UNPACK_PREMULTIPLY_ALPHA_WEBGL) are done here on the pixels, so the
 *    result is the browser's whatever the phone's driver supports.
 * 3. A finished frame must be handed to the screen (`endFrameEXP`): done once
 *    after the JavaScript that drew it, however many draws it made.
 * `sceneCanvas(gl)` is the stand-in <canvas> a WebGLRenderer is given.
 */
import { rgbaOf } from "./platform";

type GL = WebGL2RenderingContext & { endFrameEXP?: () => void; __kib?: KibGl };
interface KibGl { draws: number; tris: number; frames: number; present: boolean }

const FLIP_Y = 0x9240, PREMULTIPLY = 0x9241, COLORSPACE_CONV = 0x9243;

/** Pixels of a picture source three hands to texImage2D (null: not one of ours). */
function pixelsOf(src: unknown): { width: number; height: number; data: Uint8Array } | null {
  const s = src as { __skiaImage?: () => unknown; data?: unknown; width?: number; height?: number } | null;
  if (!s) return null;
  if (typeof s.__skiaImage === "function") {
    const img = s.__skiaImage();
    return img ? rgbaOf(img as never) : null;
  }
  if (s.data && ArrayBuffer.isView(s.data) && typeof s.width === "number" && typeof s.height === "number") {
    const d = s.data as ArrayBufferView;
    return { width: s.width, height: s.height, data: new Uint8Array(d.buffer, d.byteOffset, d.byteLength) };
  }
  return null;
}

function flipRows(data: Uint8Array, w: number, h: number, bpp: number): Uint8Array {
  const row = w * bpp;
  const out = new Uint8Array(data.length);
  for (let y = 0; y < h; y++) out.set(data.subarray(y * row, y * row + row), (h - 1 - y) * row);
  return out;
}
function premultiply(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3];
    if (a === 255) continue;
    out[i] = (out[i] * a + 127) / 255;
    out[i + 1] = (out[i + 1] * a + 127) / 255;
    out[i + 2] = (out[i + 2] * a + 127) / 255;
  }
  return out;
}

/** Make an expo-gl context speak WebGL2 the way three.js uses it (once per context). */
export function prepareGl(glIn: WebGL2RenderingContext, opts: { present?: boolean } = {}): WebGL2RenderingContext {
  const gl = glIn as GL;
  if (gl.__kib) return gl;
  const st: KibGl = { draws: 0, tris: 0, frames: 0, present: opts.present !== false };
  gl.__kib = st;
  const g = gl as unknown as Record<string, (...a: unknown[]) => unknown>;
  let flipY = false, premul = false;

  const pixelStorei = g.pixelStorei.bind(gl);
  g.pixelStorei = (pname: unknown, param: unknown) => {
    if (pname === FLIP_Y) { flipY = !!param; return; }
    if (pname === PREMULTIPLY) { premul = !!param; return; }
    if (pname === COLORSPACE_CONV) return;
    pixelStorei(pname, param);
  };
  const fix = (data: Uint8Array, w: number, h: number, format: number, type: number) => {
    if (type !== gl.UNSIGNED_BYTE) return data;
    const bpp = format === gl.RGBA ? 4 : format === gl.RGB ? 3 : format === gl.RG ? 2 : 1;
    let d = data;
    if (premul && bpp === 4) d = premultiply(d);
    if (flipY) d = flipRows(d, w, h, bpp);
    return d;
  };

  // A browser's own <canvas> or <img> (only the web build of the app has them: a phone's pictures are Skia's)
  // is uploaded by the browser itself, which flips and premultiplies only if told to just for this call.
  const asBrowser = (f: () => unknown) => {
    if (!flipY && !premul) return f();
    pixelStorei(FLIP_Y, flipY ? 1 : 0); pixelStorei(PREMULTIPLY, premul ? 1 : 0);
    try { return f(); } finally { pixelStorei(FLIP_Y, 0); pixelStorei(PREMULTIPLY, 0); }
  };
  const texImage2D = g.texImage2D.bind(gl);
  g.texImage2D = (...a: unknown[]) => {
    if (a.length === 6) {
      // (target, level, internalformat, format, type, source): a picture, not raw pixels
      const px = pixelsOf(a[5]);
      if (!px) return asBrowser(() => texImage2D(...a)); // a browser's own <canvas>/<img> (the web build, the headless check)
      return texImage2D(a[0], a[1], a[2], px.width, px.height, 0, a[3], a[4], fix(px.data, px.width, px.height, a[3] as number, a[4] as number));
    }
    if (a.length >= 9 && a[8] && ArrayBuffer.isView(a[8]) && (flipY || premul)) {
      const v = a[8] as ArrayBufferView;
      a[8] = fix(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), a[3] as number, a[4] as number, a[6] as number, a[7] as number);
    }
    return texImage2D(...a);
  };
  const texSubImage2D = g.texSubImage2D.bind(gl);
  g.texSubImage2D = (...a: unknown[]) => {
    if (a.length === 7) {
      // (target, level, x, y, format, type, source)
      const px = pixelsOf(a[6]);
      if (!px) return asBrowser(() => texSubImage2D(...a)); // a browser's own <canvas>/<img> (the web build, the headless check)
      return texSubImage2D(a[0], a[1], a[2], a[3], px.width, px.height, a[4], a[5], fix(px.data, px.width, px.height, a[4] as number, a[5] as number));
    }
    if (a.length >= 9 && a[8] && ArrayBuffer.isView(a[8]) && (flipY || premul)) {
      const v = a[8] as ArrayBufferView;
      a[8] = fix(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), a[4] as number, a[5] as number, a[6] as number, a[7] as number);
    }
    return texSubImage2D(...a);
  };

  if (typeof g.getContextAttributes !== "function" || !safe(() => g.getContextAttributes())) {
    g.getContextAttributes = () => ({ alpha: true, antialias: false, depth: true, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false, powerPreference: "default", desynchronized: false });
  }
  if (typeof g.getShaderPrecisionFormat !== "function" || !safe(() => g.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT))) {
    g.getShaderPrecisionFormat = () => ({ precision: 23, rangeMin: 127, rangeMax: 127 });
  }

  // a frame is handed to the screen once, after the JavaScript that drew it
  let queued = false;
  const end = () => { queued = false; st.frames++; if (st.present) gl.endFrameEXP?.(); };
  for (const name of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced", "drawRangeElements"]) {
    const f = g[name];
    if (typeof f !== "function") continue;
    const bound = f.bind(gl);
    // where the vertex count (and the instance count) sit in each call's arguments
    const at = name === "drawArrays" ? [2, -1] : name === "drawArraysInstanced" ? [2, 3] : name === "drawElementsInstanced" ? [1, 4] : name === "drawRangeElements" ? [3, -1] : [1, -1];
    g[name] = (...a: unknown[]) => {
      st.draws++;
      // triangles (for "Show 3D speed" and the checks): TRIANGLES = 4, STRIP = 5, FAN = 6
      const mode = a[0] as number, n = Number(a[at[0]]) || 0, inst = at[1] >= 0 ? Number(a[at[1]]) || 1 : 1;
      st.tris += (mode === 4 ? n / 3 : mode === 5 || mode === 6 ? Math.max(0, n - 2) : 0) * inst;
      if (!queued) { queued = true; void Promise.resolve().then(end); }
      return bound(...a);
    };
  }
  return gl;
}

function safe<T>(f: () => T): T | null { try { return f(); } catch { return null; } }

/** Draw calls and frames handed to the screen so far on this context (the frame meter). */
export function glCounts(gl: WebGL2RenderingContext): { draws: number; tris: number; frames: number } {
  const k = (gl as GL).__kib;
  return { draws: k?.draws ?? 0, tris: Math.round(k?.tris ?? 0), frames: k?.frames ?? 0 };
}

/**
 * The stand-in <canvas> a WebGLRenderer is given: its size is the GL view's
 * own pixels (the drawing buffer), and getContext answers the phone's GL.
 */
export function sceneCanvas(gl: WebGL2RenderingContext) {
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  return {
    width: w, height: h,
    clientWidth: w, clientHeight: h,
    style: {} as Record<string, string>,
    addEventListener() { /* no events: touches come from React Native */ },
    removeEventListener() { /* no-op */ },
    setAttribute() { /* no-op */ },
    remove() { /* the GL view is React Native's */ },
    getContext: () => gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0 }),
  };
}
