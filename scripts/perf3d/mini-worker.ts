import { buildMini } from "./mini";
self.onmessage = (e: MessageEvent) => {
  const { canvas, w, h, pr, base } = e.data;
  buildMini(canvas, w, h, pr, base, (ms, first) => (self as any).postMessage({ ms, first, at: performance.now() + performance.timeOrigin }))
    .catch((err) => (self as any).postMessage({ err: String(err) }));
};
