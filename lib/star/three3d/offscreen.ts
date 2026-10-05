/**
 * 3D IN A WEB WORKER — the out-of-the-box option that measured biggest for
 * "the page never stutters" (5 Oct 2026 harness, software renderer, CPU
 * slowed 4× like a phone): the same garden-sized scene loading and drawing
 * froze the page for 12.7-12.9 s of a 14 s window on the page (24 UI frames,
 * worst freeze 3.4-5.3 s); in a worker the page lost 0.7-1.1 s (700+ UI
 * frames, worst freeze 0.22-0.25 s). The 3D itself was no faster — it just
 * stops blocking buttons, scrolling, the loading spinner and React.
 *
 * This file is the bridge only: the page gives the worker the canvas, its
 * size and the player's touches; the worker owns three.js, the loaders and
 * the loop. A scene adopts it by moving its build function into a worker
 * file that has NO `document`/`window` (canvas textures become
 * `new OffscreenCanvas(w, h)`; `window.devicePixelRatio` comes in the init
 * message) and answering these messages. Its controller calls (setStick,
 * orbit, pick …) become postMessage calls.
 *
 * Support (reasoned from the browser tables): OffscreenCanvas + WebGL in a
 * worker — Chrome/Android since 69, Safari/iOS since 17. Older phones get
 * the scene on the page as today (canRender3dInWorker() false).
 */

export interface WorkerCanvasInit { type: "init"; canvas: OffscreenCanvas; width: number; height: number; dpr: number; [k: string]: unknown }
export type WorkerCanvasMsg =
  | WorkerCanvasInit
  | { type: "resize"; width: number; height: number; dpr: number }
  | { type: "pointer"; kind: "down" | "move" | "up" | "cancel"; id: number; x: number; y: number }
  | { type: "visible"; visible: boolean }
  | { type: "call"; name: string; args: unknown[]; reply?: number }
  | { type: "dispose" };

/** Can this browser draw WebGL in a worker? */
export function canRender3dInWorker(): boolean {
  if (typeof window === "undefined" || typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return false;
  if (typeof HTMLCanvasElement === "undefined" || !("transferControlToOffscreen" in HTMLCanvasElement.prototype)) return false;
  try { return !!new OffscreenCanvas(1, 1).getContext("webgl2"); } catch { return false; }
}

/**
 * Page side: put a canvas in `container`, hand it to `worker`, keep the
 * worker told about size, visibility and touches. `call(name, …args)` runs
 * a controller method in the worker and resolves with its answer.
 */
export function mountWorkerCanvas(container: HTMLElement, worker: Worker, init: Record<string, unknown> = {}) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none";
  container.appendChild(canvas);
  const off = canvas.transferControlToOffscreen();
  const size = () => ({ width: container.clientWidth || 1, height: container.clientHeight || 1, dpr: window.devicePixelRatio || 1 });
  worker.postMessage({ type: "init", canvas: off, ...size(), ...init } satisfies WorkerCanvasInit, [off]);
  const ro = new ResizeObserver(() => worker.postMessage({ type: "resize", ...size() }));
  ro.observe(container);
  const vis = () => worker.postMessage({ type: "visible", visible: !document.hidden });
  document.addEventListener("visibilitychange", vis);
  const ptr = (kind: "down" | "move" | "up" | "cancel") => (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    worker.postMessage({ type: "pointer", kind, id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const handlers: [keyof HTMLElementEventMap, (e: PointerEvent) => void][] = [
    ["pointerdown", ptr("down")], ["pointermove", ptr("move")], ["pointerup", ptr("up")], ["pointercancel", ptr("cancel")],
  ];
  for (const [k, h] of handlers) canvas.addEventListener(k, h as EventListener);
  let seq = 0;
  const waiting = new Map<number, (v: unknown) => void>();
  const onMsg = (e: MessageEvent) => {
    const d = e.data as { type?: string; reply?: number; value?: unknown };
    if (d?.type === "reply" && typeof d.reply === "number") { waiting.get(d.reply)?.(d.value); waiting.delete(d.reply); }
  };
  worker.addEventListener("message", onMsg);
  return {
    canvas,
    call: (name: string, ...args: unknown[]) => new Promise((res) => { const reply = ++seq; waiting.set(reply, res); worker.postMessage({ type: "call", name, args, reply }); }),
    send: (name: string, ...args: unknown[]) => worker.postMessage({ type: "call", name, args }),
    dispose: () => {
      worker.postMessage({ type: "dispose" });
      ro.disconnect();
      document.removeEventListener("visibilitychange", vis);
      worker.removeEventListener("message", onMsg);
      canvas.remove();
      setTimeout(() => worker.terminate(), 500);
    },
  };
}

/**
 * Worker side: `serveWorkerCanvas(build)` — build(init) makes the scene on
 * init.canvas and returns its controller (an object of methods); resize,
 * visibility, pointer and call messages are routed to it.
 */
export function serveWorkerCanvas(build: (init: WorkerCanvasInit) => Promise<Record<string, (...a: never[]) => unknown> & { resize?(w: number, h: number, dpr: number): void; pointer?(m: Extract<WorkerCanvasMsg, { type: "pointer" }>): void; visible?(v: boolean): void; dispose?(): void }>) {
  const scope = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage(m: unknown): void };
  let ctrl: Awaited<ReturnType<typeof build>> | null = null;
  const queue: WorkerCanvasMsg[] = [];
  const handle = async (m: WorkerCanvasMsg) => {
    if (!ctrl) { queue.push(m); return; }
    if (m.type === "resize") ctrl.resize?.(m.width, m.height, m.dpr);
    else if (m.type === "pointer") ctrl.pointer?.(m);
    else if (m.type === "visible") ctrl.visible?.(m.visible);
    else if (m.type === "dispose") { ctrl.dispose?.(); ctrl = null; }
    else if (m.type === "call") {
      const f = (ctrl as Record<string, unknown>)[m.name];
      const value = typeof f === "function" ? await (f as (...a: unknown[]) => unknown).apply(ctrl, m.args) : undefined;
      if (m.reply) scope.postMessage({ type: "reply", reply: m.reply, value });
    }
  };
  scope.onmessage = async (e: MessageEvent) => {
    const m = e.data as WorkerCanvasMsg;
    if (m.type === "init") {
      ctrl = await build(m);
      for (const q of queue.splice(0)) await handle(q);
      return;
    }
    await handle(m);
  };
}
