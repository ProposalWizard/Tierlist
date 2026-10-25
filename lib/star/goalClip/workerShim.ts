/**
 * WHAT THE VIDEO WORKER NEEDS TO LOOK LIKE A PAGE (speed pass, 22 Oct 2026).
 *
 * The goal-video drawing code (render.ts, ../sprites.ts) was written for the
 * page: it makes canvases with `document`, loads pictures with `Image`, and
 * reads a setting or two from localStorage. A Web Worker has none of these,
 * but it has OffscreenCanvas, fetch and createImageBitmap, which do the same
 * jobs. This file gives the worker just enough of a page for that code to run
 * unchanged, so the video made in the worker is the same video, frame for
 * frame. Imported FIRST by clip.worker.ts, before anything that draws.
 * Never imported by the page.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const g = self as any;

if (typeof g.document === "undefined" && typeof g.OffscreenCanvas === "function") {
  // `window` checks in the drawing code (canMakeVideo, requestIdleCallback…).
  if (typeof g.window === "undefined") g.window = g;

  g.document = {
    createElement(tag: string) {
      if (tag !== "canvas") throw new Error(`worker: no <${tag}>`);
      return new g.OffscreenCanvas(1, 1);
    },
    body: { appendChild() { /* nothing to show */ } },
  };

  /** A picture: fetched and decoded off any page, then drawn as a bitmap. */
  class WorkerImage {
    bitmap: ImageBitmap | null = null;
    naturalWidth = 0;
    naturalHeight = 0;
    width = 0;
    height = 0;
    decoding = "async";
    onload: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    private _src = "";
    get src() { return this._src; }
    set src(v: string) {
      this._src = v;
      fetch(v)
        .then(r => { if (!r.ok) throw new Error(`${r.status} ${v}`); return r.blob(); })
        .then(b => g.__origCreateImageBitmap(b))
        .then((bm: ImageBitmap) => {
          this.bitmap = bm;
          this.naturalWidth = this.width = bm.width;
          this.naturalHeight = this.height = bm.height;
          this.onload?.();
        })
        .catch(e => this.onerror?.(e));
    }
    decode() { return Promise.resolve(); }
  }
  g.Image = WorkerImage;
  g.HTMLImageElement = WorkerImage;

  // createImageBitmap and drawImage take the picture inside a WorkerImage.
  g.__origCreateImageBitmap = g.createImageBitmap.bind(g);
  g.createImageBitmap = (src: any, ...rest: any[]) =>
    g.__origCreateImageBitmap(src instanceof WorkerImage ? src.bitmap : src, ...rest);
  const proto = g.OffscreenCanvasRenderingContext2D?.prototype;
  if (proto) {
    const draw = proto.drawImage;
    proto.drawImage = function (src: any, ...rest: any[]) {
      return draw.call(this, src instanceof WorkerImage ? src.bitmap : src, ...rest);
    };
  }

  // The page's settings, sent with each job (setWorkerSettings).
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
    clear: () => store.clear(),
  };
  g.__setWorkerSettings = (all: Record<string, string>) => {
    for (const [k, v] of Object.entries(all)) store.set(k, v);
  };
}

export {};
