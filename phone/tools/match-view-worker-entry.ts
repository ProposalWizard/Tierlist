// Bundled by tools/match-view-check.ts and run in a Web Worker: no `document`, no `window`, no storage, like the phone's
// JavaScript engine. It runs the phone's host (src/three/walkHost.ts) with the 3D match view's scene
// (src/three/matchViewScene.ts) and is handed real match frames (tools/match-view-frames.ts built them from the phone's one
// driver, with src/three/matchFrame.ts), one after another, as the match screen hands them to the view.
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setThreePlatform } from "../src/three/platform";
import { startWalkScene, type WalkHost } from "../src/three/walkHost";
import { loadMatchViewStart, type MatchViewController } from "../src/three/matchViewScene";
import { glCounts } from "../src/three/gl";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import type { EngineFrame } from "@/lib/star/engineFrame";
import type { Quality3d } from "@/lib/star/three3d/quality";
import type { TimeOfDay } from "@/lib/star/style3d/real/assets";

const g = globalThis as unknown as Record<string, unknown> & { postMessage(m: unknown): void };
g.window = g;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() };
const requested: string[] = [];
let host: WalkHost<MatchViewController> | null = null;
let gl: WebGL2RenderingContext | null = null;
const log: string[] = [];
const jsMs: number[] = [];
const origWarn = console.warn.bind(console), origErr = console.error.bind(console);
console.warn = (...a: unknown[]) => { log.push("warn: " + a.map(String).join(" ")); origWarn(...a); };
console.error = (...a: unknown[]) => { log.push("error: " + a.map(String).join(" ")); origErr(...a); };
self.addEventListener("error", (e) => { log.push("uncaught: " + (e as ErrorEvent).message); });
self.addEventListener("unhandledrejection", (e) => { log.push("unhandled: " + String((e as PromiseRejectionEvent).reason)); });
let realFetch: typeof fetch | null = null;
let frames: EngineFrame[] = [];
let fed = 0;

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

const YOU = { body: "c2" as const, head: "h2" as const, skin: "#c68642", hair: "#2b1d14", name: "KANE" };
const sleep0 = () => new Promise((r) => setTimeout(r, 0));

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data as { id: number; op: string; [k: string]: unknown };
  const reply = (v: unknown) => g.postMessage({ id: m.id, ok: true, v });
  const fail = (e: unknown) => g.postMessage({ id: m.id, ok: false, e: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) });
  try {
    if (m.op === "start") {
      gl = (m.canvas as OffscreenCanvas).getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" }) as WebGL2RenderingContext;
      realFetch = self.fetch.bind(self);
      await platform();
      (self as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas = undefined;
      delete (self as unknown as { createImageBitmap?: unknown }).createImageBitmap;
      self.fetch = () => Promise.reject(new TypeError("Network request failed"));
      setToonYou(YOU);
      const t0 = performance.now();
      host = await startWalkScene({ start: loadMatchViewStart(), data: { tod: m.tod as TimeOfDay }, callbacks: {}, gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d });
      reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log });
    } else if (m.op === "load") {
      frames = m.frames as EngineFrame[];
      fed = 0;
      reply(frames.length);
    } else if (m.op === "feed") {
      // hand `n` frames, one after another, as the screen does; the time of each call is the JS cost of the 3D frame
      const n = Math.min(m.n as number, frames.length - fed);
      const errs: string[] = [];
      for (let i = 0; i < n; i++) {
        const f = frames[fed++];
        const a = performance.now();
        try { host!.controller.frame(f); } catch (e) { errs.push(String(e instanceof Error ? e.stack : e)); }
        jsMs.push(performance.now() - a);
        await sleep0();
      }
      reply({ fed, errs: errs.slice(0, 3), nErrs: errs.length });
    } else if (m.op === "seek") {
      fed = m.to as number;
      reply(fed);
    } else if (m.op === "cmd") {
      const fn = m.fn as string;
      if (fn === "pause") host!.pause();
      else if (fn === "resume") host!.resume();
      else if (fn === "visible") host!.controller.setVisible(!!m.on);
      reply(null);
    } else if (m.op === "state") {
      const js = jsMs.slice().sort((a, b) => a - b);
      if (m.reset) jsMs.length = 0;
      const c = gl ? glCounts(gl) : { frames: 0, draws: 0, tris: 0 };
      reply({ frames: c.frames, draws: c.draws, tris: c.tris, log, fed, js: { n: js.length, median: js[Math.floor(js.length / 2)] ?? 0, p95: js[Math.floor(js.length * 0.95)] ?? 0, max: js[js.length - 1] ?? 0 } });
    } else if (m.op === "asked") {
      reply(Array.from(new Set(requested)));
    } else if (m.op === "dispose") {
      host?.dispose(); host = null;
      reply({ document: typeof (globalThis as { document?: unknown }).document, dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio, log });
    }
  } catch (e) { fail(e); }
};
