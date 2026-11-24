// Bundled by tools/podium-check.ts and run in a Web Worker: no `document`, no `window`, no storage, like the phone's
// JavaScript engine. It runs the phone's host (src/three/walkHost.ts) with a Star Pass reward on its podium
// (src/podium/podiumScene.ts), built from the same card data the Star Pass screen uses (lib/star/rewardCatalogue.ts).
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setThreePlatform } from "../src/three/platform";
import { startWalkScene, type WalkHost } from "../src/three/walkHost";
import { loadPodiumStart, type PodiumCallbacks, type PodiumController, type PodiumData } from "../src/podium/podiumScene";
import { glCounts } from "../src/three/gl";
import { findCard, fullCatalogue } from "@/lib/star/rewardCatalogue";
import type { Quality3d } from "@/lib/star/three3d/quality";

const g = globalThis as unknown as Record<string, unknown> & { postMessage(m: unknown): void };
g.window = g;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() };
const requested: string[] = [];
let host: WalkHost<PodiumController> | null = null;
let gl: WebGL2RenderingContext | null = null;
const log: string[] = [];
const origWarn = console.warn.bind(console), origErr = console.error.bind(console);
console.warn = (...a: unknown[]) => { log.push("warn: " + a.map(String).join(" ")); origWarn(...a); };
console.error = (...a: unknown[]) => { log.push("error: " + a.map(String).join(" ")); origErr(...a); };
self.addEventListener("error", (e) => { log.push("uncaught: " + (e as ErrorEvent).message); });
self.addEventListener("unhandledrejection", (e) => { log.push("unhandled: " + String((e as PromiseRejectionEvent).reason)); });
let realFetch: typeof fetch | null = null;
let platformDone = false;
const jsMs: number[] = [];

async function platform() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({ locateFile: (f: string) => "/" + f });
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  const fontBytes = new Uint8Array(await (await fetch("/font-bold.ttf")).arrayBuffer());
  const face = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(fontBytes));
  const fontFor = (spec: { size: number }) => (face ? Skia.Font(face, spec.size) : null);
  setThreePlatform({
    Skia: Skia as never,
    fontFor: fontFor as never,
    bytes: async (url) => {
      const u = url.split("?")[0];
      requested.push(u);
      const r = await realFetch!(u);
      if (!r.ok) throw new Error(`${r.status} ${u}`);
      return r.arrayBuffer();
    },
  });
}

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data as { id: number; op: string; [k: string]: unknown };
  const reply = (v: unknown) => g.postMessage({ id: m.id, ok: true, v });
  const fail = (e: unknown) => g.postMessage({ id: m.id, ok: false, e: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) });
  try {
    if (m.op === "start") {
      if (m.canvas) gl = (m.canvas as OffscreenCanvas).getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" }) as WebGL2RenderingContext;
      requested.length = 0;
      const rawRaf = self.requestAnimationFrame.bind(self);
      self.requestAnimationFrame = (cb) => rawRaf((t) => { const a = performance.now(); cb(t); jsMs.push(performance.now() - a); if (jsMs.length > 900) jsMs.shift(); });
      realFetch ??= self.fetch.bind(self);
      if (!platformDone) { await platform(); platformDone = true; }
      (self as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas = undefined;
      delete (self as unknown as { createImageBitmap?: unknown }).createImageBitmap;
      delete (self as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
      self.fetch = () => Promise.reject(new TypeError("Network request failed"));
      const card = findCard(m.card as string, fullCatalogue());
      const live = card?.art.live ?? card?.art.spin;
      if (!live) throw new Error(`no 3D art on ${m.card}`);
      const w = m.w as number, h = m.h as number;
      const k = card!.art.live ? Math.min(w / live.w, h / live.h) : 1;
      const cfg: PodiumData = card!.art.live ? { ...live, w: Math.round(live.w * k), h: Math.round(live.h * k) } : { ...live, w, h };
      const t0 = performance.now();
      host = await startWalkScene<PodiumData, PodiumCallbacks, PodiumController>({
        start: loadPodiumStart(), data: cfg, callbacks: {}, gl, width: cfg.w, height: cfg.h, pixelRatio: m.pr as number, quality: m.quality as Quality3d,
      });
      reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log, cfg: { w: cfg.w, h: cfg.h, zoom: !!cfg.zoom } });
    } else if (m.op === "cmd") {
      const c = host!.controller as unknown as Record<string, (...x: unknown[]) => unknown>;
      let out: unknown = null;
      const fn = m.fn as string;
      if (fn === "call") out = await c[m.name as string](...(m.args as unknown[]));
      else if (fn === "pause") host!.pause();
      else if (fn === "resume") host!.resume();
      else if (fn === "pointer") host!.pointer(m.type as never, 1, m.x as number, m.y as number);
      reply(out);
    } else if (m.op === "state") {
      const js = jsMs.slice().sort((a, b) => a - b);
      reply({ frames: gl ? glCounts(gl).frames : 0, draws: gl ? glCounts(gl).draws : 0, log, js: { n: js.length, median: js[Math.floor(js.length / 2)] ?? 0, p95: js[Math.floor(js.length * 0.95)] ?? 0 } });
    } else if (m.op === "asked") {
      reply(Array.from(new Set(requested)));
    } else if (m.op === "dispose") {
      host?.dispose(); host = null;
      reply({ document: typeof (globalThis as { document?: unknown }).document, dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio, log });
    }
  } catch (e) { fail(e); }
};
