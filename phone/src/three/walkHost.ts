/**
 * THE WALK-AROUND 3D PLACES ON THE PHONE: the host (no React, no phone-only
 * imports, so the headless check runs this same file: tools/walk-check.ts).
 *
 * The website's places (the garden: lib/star/garden3d/scene.ts; later the 3D
 * shop, your house, the training pitch) are all started the same way:
 *
 *     start(container, callbacks, data, opts) -> controller
 *
 * and the controller has setStick, orbit, tap, stats, dispose. This file runs
 * any of them on the phone's GL view (./Walk3D.tsx is the screen around it):
 *
 * - `container`: a hollow element of the view's size (./standIn.ts); the
 *   renderer's canvas is put in it, and touches are handed to whatever the
 *   scene listens for there (the pinch zoom listens for pointers).
 * - the renderer's canvas is a stand-in over the phone's GL (the drawing
 *   buffer's own size). A scene sets its pixel ratio as it likes while it
 *   runs (still, moving, dynamic resolution); the GL view's buffer is fixed,
 *   so what the scene draws is stretched to fill it (`fitViewport`): same
 *   picture, a fixed number of pixels, chosen once per phone (./Walk3D.tsx).
 * - the browser pieces the scene touches while it runs (a `document` for
 *   captions and canvases, `window.devicePixelRatio`, the packed-picture
 *   switch, `fetch` of the app's own files: ./bundledFetch.ts) are in place
 *   from the start until `dispose`.
 * - `pause()` holds every frame the scene asks for (the app went to the
 *   background); `resume()` lets them go on. Nothing draws while paused.
 */
import type { Quality3d } from "@/lib/star/three3d/quality";
import { holdSceneDocument, offerGlCanvas, withSceneDocument } from "./env";
import { installBundledFetch } from "./bundledFetch";
import { prepareGl } from "./gl";
import { makeContainer } from "./standIn";

/** What every walk-around scene's controller gives the host. */
export interface WalkController {
  setStick(x: number, y: number): void;
  orbit(dx: number, dy?: number): void;
  tap?(x: number, y: number): unknown;
  pick?(x: number, y: number): unknown;
  stats?(): { calls: number; triangles: number } & Record<string, unknown>;
  dispose(): void;
}

/** A scene's start function (the website's `startGarden` …). */
export type WalkStart<D, CB, C extends WalkController> = (container: HTMLElement, callbacks: CB, data: D, opts: { quality?: Quality3d }) => Promise<C>;

export interface WalkHost<C extends WalkController> {
  controller: C;
  /** Hand a touch to the scene's own listeners (the pinch zoom); x, y in points inside the view. */
  pointer(type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel", id: number, x: number, y: number): void;
  /** Two fingers are down: a look-round drag should be ignored (the scene's zoom sets this). */
  pinching(): boolean;
  pause(): void;
  resume(): void;
  /** The phone took the GL away (the view must be made again). */
  glLost(): boolean;
  dispose(): void;
}

// ── frames: hold them while paused ────────────────────────────────────────

/**
 * Wraps requestAnimationFrame for as long as a place is on screen: while paused, a
 * frame asked for is kept and handed on at `resume()`. (three.js and the scenes ask
 * `self.requestAnimationFrame` every frame, so holding the request stops the whole loop.)
 */
export function installFrameGate(onError?: (e: unknown) => void) {
  const g = globalThis as unknown as Record<string, unknown> & {
    requestAnimationFrame?: (cb: (t: number) => void) => number;
    cancelAnimationFrame?: (id: number) => void;
  };
  const real = g.requestAnimationFrame;
  const realCancel = g.cancelAnimationFrame;
  if (typeof real !== "function") return { pause() { /* no frames here */ }, resume() { /* no frames here */ }, restore() { /* nothing */ }, paused: () => false };
  let paused = false;
  let seq = 1_000_000_000;
  const held = new Map<number, (t: number) => void>();
  const moved = new Map<number, number>();
  // A scene's frame that throws must never reach the phone's global error handler: in a release app that closes the app with no
  // error screen (expo-gl's stubs throw, e.g. renderbufferStorageMultisample). It is caught here and the place is let go instead.
  const guard = (cb: (t: number) => void) => (t: number) => {
    try { cb(t); } catch (e) { console.warn("[walk 3D] a frame threw:", e); try { onError?.(e); } catch { /* nothing more to do */ } }
  };
  g.requestAnimationFrame = (cb) => {
    if (!paused) return real.call(g, guard(cb));
    const id = ++seq;
    held.set(id, cb);
    return id;
  };
  g.cancelAnimationFrame = (id) => {
    if (held.delete(id)) return;
    const m = moved.get(id);
    if (m !== undefined) { moved.delete(id); realCancel?.call(g, m); return; }
    realCancel?.call(g, id);
  };
  return {
    pause() { paused = true; },
    resume() {
      if (!paused) return;
      paused = false;
      for (const [id, cb] of Array.from(held)) { held.delete(id); moved.set(id, real.call(g, guard((t: number) => { moved.delete(id); cb(t); }))); }
    },
    paused: () => paused,
    restore() {
      g.requestAnimationFrame = real;
      if (realCancel) g.cancelAnimationFrame = realCancel;
      held.clear(); moved.clear();
    },
  };
}

// ── the GL: a canvas stand-in, and the picture stretched to the buffer ───────

/**
 * The renderer's canvas. Its width and height are what the scene writes (css size ×
 * its own pixel ratio); `scale()` is how much the drawing buffer is bigger than that.
 */
function walkCanvas(gl: WebGL2RenderingContext, cssW: number, cssH: number) {
  let vw = gl.drawingBufferWidth, vh = gl.drawingBufferHeight;
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  const canvas = {
    style: {} as Record<string, unknown>,
    clientWidth: cssW, clientHeight: cssH, offsetWidth: cssW, offsetHeight: cssH,
    get width() { return vw; },
    set width(v: number) { vw = Math.max(1, Math.floor(Number(v)) || 1); },
    get height() { return vh; },
    set height(v: number) { vh = Math.max(1, Math.floor(Number(v)) || 1); },
    addEventListener(t: string, f: (e: unknown) => void) { let s = listeners.get(t); if (!s) listeners.set(t, (s = new Set())); s.add(f); },
    removeEventListener(t: string, f: (e: unknown) => void) { listeners.get(t)?.delete(f); },
    dispatchEvent(e: { type: string }) { listeners.get(e.type)?.forEach((f) => f(e)); return true; },
    setAttribute() { /* nothing */ },
    remove() { /* the GL view is React Native's */ },
    getContext: () => gl,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: cssW, height: cssH, right: cssW, bottom: cssH, x: 0, y: 0 }),
    scale: () => ({ x: gl.drawingBufferWidth / vw, y: gl.drawingBufferHeight / vh }),
  };
  return canvas;
}

/** Whatever size the scene draws at, the picture fills the whole drawing buffer (viewport and scissor of the screen, not of a render target). */
function fitViewport(gl: WebGL2RenderingContext, canvas: { scale(): { x: number; y: number } }) {
  const g = gl as unknown as Record<string, (...a: unknown[]) => unknown>;
  if ((g as { __kibFit?: boolean }).__kibFit) return;
  (g as { __kibFit?: boolean }).__kibFit = true;
  let screenBound = true;
  const bindFb = g.bindFramebuffer.bind(gl);
  g.bindFramebuffer = (target: unknown, fb: unknown) => {
    if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) screenBound = fb == null;
    return bindFb(target, fb);
  };
  for (const name of ["viewport", "scissor"] as const) {
    const f = g[name].bind(gl);
    g[name] = (x: unknown, y: unknown, w: unknown, h: unknown) => {
      if (!screenBound) return f(x, y, w, h);
      const s = canvas.scale();
      if (Math.abs(s.x - 1) < 1e-6 && Math.abs(s.y - 1) < 1e-6) return f(x, y, w, h);
      return f(Math.round((x as number) * s.x), Math.round((y as number) * s.y), Math.round((w as number) * s.x), Math.round((h as number) * s.y));
    };
  }
}

// ── start ─────────────────────────────────────────────────────────────────

export interface StartWalkOptions<D, CB, C extends WalkController> {
  start: WalkStart<D, CB, C>;
  data: D;
  callbacks: CB;
  gl: WebGL2RenderingContext;
  /** The view's size in points (the scene's container). */
  width: number;
  height: number;
  /** The GL buffer's pixels per point (the view was laid out so drawingBufferWidth = width × this). */
  pixelRatio: number;
  quality?: Quality3d;
  /** A frame of the scene threw (caught: the app stays open). The place should be let go and its plain card shown. */
  onFrameError?: (e: unknown) => void;
  /** Crash breadcrumbs (../safety.ts markStep): called with the step reached; never throws into the host. */
  onStep?: (step: string) => void;
}

export async function startWalkScene<D, CB, C extends WalkController>(o: StartWalkOptions<D, CB, C>): Promise<WalkHost<C>> {
  const g = globalThis as unknown as { devicePixelRatio?: number; __ktx2Off?: boolean };
  const step = (t: string) => { try { o.onStep?.(t); } catch { /* breadcrumbs never stop a scene */ } };
  step("host: surroundings set");
  const hadDpr = Object.prototype.hasOwnProperty.call(g, "devicePixelRatio");
  const oldDpr = g.devicePixelRatio;
  const oldKtx = g.__ktx2Off;
  // what the scene reads as the screen's pixel ratio: the GL buffer's (it never draws more than that)
  g.devicePixelRatio = o.pixelRatio;
  // the packed-texture copies (KTX2) need a WebAssembly transcoder: the phone uses the plain pictures
  g.__ktx2Off = true;
  const releaseDoc = holdSceneDocument();
  const gate = installFrameGate((e) => { step("a frame threw"); o.onFrameError?.(e); });
  const unFetch = installBundledFetch();
  // a scene watches its container's size; here the container is hollow and never resizes (a real browser's observer would refuse it)
  const gr = globalThis as unknown as { ResizeObserver?: unknown };
  const oldRO = gr.ResizeObserver;
  gr.ResizeObserver = class { observe() { /* never resizes */ } unobserve() { /* nothing */ } disconnect() { /* nothing */ } };
  prepareGl(o.gl);
  step("host: gl prepared");
  const canvas = walkCanvas(o.gl, o.width, o.height);
  fitViewport(o.gl, canvas);
  const cont = makeContainer(o.width, o.height);
  let disposed = false;
  let controller: C | null = null;
  const undo = () => {
    gate.restore();
    unFetch();
    releaseDoc();
    g.__ktx2Off = oldKtx;
    if (hadDpr) g.devicePixelRatio = oldDpr; else { try { delete g.devicePixelRatio; } catch { /* kept */ } }
    // one shared renderer is kept between places on the website; here its GL view goes with the screen
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require("@/lib/star/three3d/perf") as typeof import("@/lib/star/three3d/perf")).dropSharedRenderer();
    } catch { /* nothing shared */ }
  };
  try {
    offerGlCanvas(canvas);
    step("scene starting");
    controller = await withSceneDocument(() => o.start(cont.el, o.callbacks, o.data, { quality: o.quality }));
  } catch (e) {
    offerGlCanvas(null);
    gr.ResizeObserver = oldRO;
    disposed = true;
    undo();
    throw e;
  }
  offerGlCanvas(null);
  step("scene started");
  gr.ResizeObserver = oldRO; // only the build watches the container: the page's own observer is back for the page
  const ctrl = controller;
  return {
    controller: ctrl,
    pointer: cont.dispatch,
    pinching: () => cont.hollow.dataset.pinching === "1",
    pause: () => gate.pause(),
    resume: () => gate.resume(),
    glLost: () => { try { return !!(o.gl as { isContextLost?: () => boolean }).isContextLost?.(); } catch { return false; } },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { ctrl.dispose(); } catch (e) { console.warn("[walk 3D] dispose", e); }
      undo();
    },
  };
}
