// Bundled by tools/signing-check.ts and run in a Web Worker: no `document`, no `window`, no storage, like the phone's
// JavaScript engine. It runs the phone's host (src/three/walkHost.ts) with the 3D signing and the manager's office
// (src/three/signingScene.ts), built from the very same data code the screens use (src/three/signingData.ts).
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setThreePlatform } from "../src/three/platform";
import { startWalkScene, type WalkHost } from "../src/three/walkHost";
import { loadSigningStart, type SigningWalk, type SigningCallbacks, type SigningData } from "../src/three/signingScene";
import { signingPlan, officeData, type SigningPlan } from "../src/three/signingData";
import { glCounts } from "../src/three/gl";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import type { Quality3d } from "@/lib/star/three3d/quality";
import type { CareerState } from "@/lib/star/types";

const g = globalThis as unknown as Record<string, unknown> & { postMessage(m: unknown): void };
g.window = g;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() };
const requested: string[] = [];
let host: WalkHost<SigningWalk> | null = null;
let plan: SigningPlan | null = null;
let gl: WebGL2RenderingContext | null = null;
const events: string[] = [];
const log: string[] = [];
const jsMs: number[] = [];
const origWarn = console.warn.bind(console), origErr = console.error.bind(console);
console.warn = (...a: unknown[]) => { log.push("warn: " + a.map(String).join(" ")); origWarn(...a); };
console.error = (...a: unknown[]) => { log.push("error: " + a.map(String).join(" ")); origErr(...a); };
self.addEventListener("error", (e) => { log.push("uncaught: " + (e as ErrorEvent).message); });
self.addEventListener("unhandledrejection", (e) => { log.push("unhandled: " + String((e as PromiseRejectionEvent).reason)); });
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
/** A career as the screens get one: dark skin, long hair, a club, a contract, a shirt number, the aviators. */
function career(over: Record<string, unknown> = {}): CareerState {
  return {
    season: 2, week: 7,
    player: { firstName: "Sam", lastName: "Carter", club: "Arsenal", position: "ST", skinTone: "medium", hairColour: "black", hairStyle: "short" },
    contract: { club: "Arsenal", wage: 4200, seasonsRemaining: 3, goalBonus: 200, assistBonus: 100 },
    squadNumber: 9, equippedAccessories: { head: "sweatband" }, equippedRewards: {}, clubKits: {},
    manager: { name: "Oscar Bianchi" },
    ...over,
  } as unknown as CareerState;
}

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data as { id: number; op: string; [k: string]: unknown };
  const reply = (v: unknown) => g.postMessage({ id: m.id, ok: true, v });
  const fail = (e: unknown) => g.postMessage({ id: m.id, ok: false, e: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) });
  try {
    if (m.op === "start") {
      const glRef = m.canvas as OffscreenCanvas;
      gl = glRef.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" }) as WebGL2RenderingContext;
      realFetch = self.fetch.bind(self);
      const rawRaf = self.requestAnimationFrame.bind(self);
      self.requestAnimationFrame = (cb) => rawRaf((t) => { const a = performance.now(); cb(t); jsMs.push(performance.now() - a); if (jsMs.length > 900) jsMs.shift(); });
      await platform();
      // the phone has none of these: the scene must meet only what the host gives it
      (self as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas = undefined;
      delete (self as unknown as { createImageBitmap?: unknown }).createImageBitmap;
      delete (self as unknown as { IntersectionObserver?: unknown }).IntersectionObserver;
      self.fetch = () => Promise.reject(new TypeError("Network request failed"));
      setToonYou(YOU);
      const t0 = performance.now();
      // the transfer is the loaded one: a dark skin, long hair, an accessory in every slot and the Star Pass aviators (their files, their models)
      const loaded = m.kind === "transfer" || m.place === "office" ? {
        player: { firstName: "Sam", lastName: "Carter", club: "Arsenal", position: "ST", skinTone: "dark", hairColour: "blonde", hairStyle: "long" },
        equippedAccessories: { head: "headband-ninja", neck: "snood-black", arms: "sleeves-white", wrists: "tape-white" },
        equippedRewards: { eyes: "pass-gold-aviators" },
      } : {};
      const c = career({ ...loaded, ...((m.career as Record<string, unknown>) ?? {}) });
      let data: SigningData;
      if (m.place === "office") data = officeData(c);
      else {
        plan = signingPlan(c, "Arsenal", "Oscar Bianchi", { kind: (m.kind as "trial" | "transfer") ?? "trial", ...(m.kind === "transfer" ? { terms: { wage: 9000, seasonsRemaining: 4, position: "Striker" } } : {}) });
        data = plan.data;
      }
      const cb: SigningCallbacks = { onEvent: (e) => { events.push(e); } };
      host = await startWalkScene<SigningData, SigningCallbacks, SigningWalk>({
        start: loadSigningStart(), data, callbacks: cb,
        gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d,
      });
      reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log, lines: plan?.lines.length ?? 0, rows: plan?.data.contract.rows ?? [] });
    } else if (m.op === "cmd") {
      const c = host!.controller as unknown as Record<string, (...x: unknown[]) => unknown>;
      let out: unknown = null;
      const fn = m.fn as string;
      if (fn === "call") out = await c[m.name as string](...(m.args as unknown[]));
      else if (fn === "pause") host!.pause();
      else if (fn === "resume") host!.resume();
      reply(out);
    } else if (m.op === "state") {
      const js = jsMs.slice().sort((a, b) => a - b);
      if (m.reset) jsMs.length = 0;
      reply({ frames: gl ? glCounts(gl).frames : 0, draws: gl ? glCounts(gl).draws : 0, events, log, js: { n: js.length, median: js[Math.floor(js.length / 2)] ?? 0, p95: js[Math.floor(js.length * 0.95)] ?? 0 } });
    } else if (m.op === "asked") {
      reply(Array.from(new Set(requested)));
    } else if (m.op === "dispose") {
      host?.dispose(); host = null;
      reply({ document: typeof (globalThis as { document?: unknown }).document, dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio, io: typeof (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver, log });
    }
  } catch (e) { fail(e); }
};
