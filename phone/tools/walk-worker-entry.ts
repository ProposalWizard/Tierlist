// Bundled by tools/walk-check.ts and run in a Web Worker: a worker has NO `document`, no
// `window`, no storage and no DOM, like the phone's JavaScript engine, so this runs the
// phone's walk-around host (src/three/walkHost.ts) the way the phone does: the scene's
// container, `document`, captions and pictures are the stand-ins, the GL is a plain
// context (here an OffscreenCanvas's), the pictures are unpacked by Skia (CanvasKit).
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setThreePlatform } from "../src/three/platform";
import { startWalkScene, type WalkHost } from "../src/three/walkHost";
import { loadGardenStart } from "../src/three/gardenScene";
import { glCounts } from "../src/three/gl";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import { kitsOf } from "@/lib/star/kits";
import type { GardenData, GardenController, GardenCallbacks } from "@/lib/star/garden3d/scene";
import type { Quality3d } from "@/lib/star/three3d/quality";

const g = globalThis as unknown as Record<string, unknown> & { postMessage(m: unknown): void };
// what the phone's own startup gives (phone/src/appFlags.ts): `window`, storage, the address
g.window = g;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() };
const requested: string[] = [];
let host: WalkHost<GardenController> | null = null;
let gl: WebGL2RenderingContext | null = null;
let near: string | null = null;
let doors: string[] = [];
let glRef: OffscreenCanvas | null = null;
const log: string[] = [];
const jsMs: number[] = [];
const origWarn = console.warn.bind(console), origErr = console.error.bind(console);
console.warn = (...a: unknown[]) => { log.push("warn: " + a.map(String).join(" ")); origWarn(...a); };
console.error = (...a: unknown[]) => { log.push("error: " + a.map(String).join(" ")); origErr(...a); };
self.addEventListener("error", (e) => { log.push("uncaught: " + (e as ErrorEvent).message); });
self.addEventListener("unhandledrejection", (e) => { log.push("unhandled: " + String((e as PromiseRejectionEvent).reason)); });

/** The check's own file reader (our server), kept before the worker's fetch is taken away: the phone has no website to fetch from. */
let realFetch: typeof fetch | null = null;

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

function gardenData(arrive: GardenData["arrive"], sky: GardenData["sky"]): GardenData {
  return {
    kit: kitsOf("Arsenal").home,
    number: 9, tier: 3, stable: 3,
    horse: { name: "Comet" },
    trophies: [{ name: "Premier League", count: 2, art: null }, { name: "FA Cup", count: 1, art: null }, { name: "Golden Boot", count: 1, art: null }],
    cars: ["/star/shop3d/items/car-1.glb", "/star/shop3d/items/car-2.glb", "/star/shop3d/items/classic.glb".replace("classic", "car-classic")],
    sky, mates: [7, 4, 11], arrive,
    player: { look: "new", skin: "#c68642", hair: "#2b1d14", hairStyle: "short" },
  };
}

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data as { id: number; op: string; [k: string]: unknown };
  const reply = (v: unknown) => g.postMessage({ id: m.id, ok: true, v });
  const fail = (e: unknown) => g.postMessage({ id: m.id, ok: false, e: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) });
  try {
    if (m.op === "start") {
      glRef = m.canvas as OffscreenCanvas;
      gl = glRef.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" }) as WebGL2RenderingContext;
      realFetch = self.fetch.bind(self);
      // how long each frame's JavaScript runs (the scene's loop and the host's): the number that matters on a phone,
      // where the graphics chip draws on its own and JavaScript is the slower part
      const rawRaf = self.requestAnimationFrame.bind(self);
      self.requestAnimationFrame = (cb) => rawRaf((t) => { const a = performance.now(); cb(t); jsMs.push(performance.now() - a); if (jsMs.length > 900) jsMs.shift(); });
      await platform();
      // the phone has none of these: the scene must meet only what the host gives it
      (self as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas = undefined;
      delete (self as unknown as { createImageBitmap?: unknown }).createImageBitmap;
      self.fetch = () => Promise.reject(new TypeError("Network request failed"));
      setToonYou(YOU);
      const t0 = performance.now();
      const cbs: GardenCallbacks = {
        onNear: (s) => { near = s; },
        onFps: () => {},
        onShopDoor: () => { doors.push("shop"); },
        onTrainingGate: () => { doors.push("training"); },
        onContextLost: () => { doors.push("lost"); },
      };
      host = await startWalkScene<GardenData, GardenCallbacks, GardenController>({
        start: loadGardenStart(), data: gardenData(m.arrive as GardenData["arrive"], m.sky as GardenData["sky"]), callbacks: cbs,
        gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d,
      });
      (self as unknown as { __host: unknown }).__host = host;
      reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log });
    } else if (m.op === "cmd") {
      const c = host!.controller;
      const a = m.args as number[];
      const fn = m.fn as string;
      let out: unknown = null;
      if (fn === "place") c.place(a[0], a[1], a[2]);
      else if (fn === "stick") c.setStick(a[0], a[1]);
      else if (fn === "tap") out = c.tap?.(a[0], a[1]);
      else if (fn === "orbit") c.orbit(a[0], a[1]);
      else if (fn === "cam") c.debugCamera?.(a.length ? [a[0], a[1], a[2]] : null, a.length ? [a[3], a[4], a[5]] : undefined);
      else if (fn === "pause") host!.pause();
      else if (fn === "resume") host!.resume();
      else if (fn === "pointer") host!.pointer(m.type as never, a[0], a[1], a[2]);
      reply(out);
    } else if (m.op === "state") {
      const c = host!.controller;
      const js = jsMs.slice().sort((a, b) => a - b);
      if (m.reset) jsMs.length = 0;
      reply({ where: c.where(), near, doors, stats: c.stats(), frames: gl ? glCounts(gl).frames : 0, pinching: host!.pinching(), log, walking: c.walking?.(), js: { n: js.length, median: js[Math.floor(js.length / 2)] ?? 0, p95: js[Math.floor(js.length * 0.95)] ?? 0 } });
    } else if (m.op === "dispose") {
      host?.dispose(); host = null;
      reply({ document: typeof (globalThis as { document?: unknown }).document, dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio, log });
    }
  } catch (e) { fail(e); }
};
