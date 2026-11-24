// Bundled by tools/training-check.ts and run in a Web Worker: no `document`, no `window`, no storage, like the phone's
// JavaScript engine. It runs the phone's host (src/three/walkHost.ts) with the 3D training pitch's two scenes
// (src/three/trainingScene.ts): the Crossbar Challenge's pitch and the fully 3D drills, built from the very same
// data code the screens use (src/three/trainingData.ts).
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setThreePlatform } from "../src/three/platform";
import { startWalkScene, type WalkHost } from "../src/three/walkHost";
import { loadTrainingStart, loadDrillStart, type TrainingWalk, type DrillWalk } from "../src/three/trainingScene";
import { castFrom, drillLook, drillSceneData, drillSession, crossbarMate, crossbarSceneData, trainingSeed } from "../src/three/trainingData";
import { drillById, type DrillSession } from "@/lib/star/play3d/drills";
import { glCounts } from "../src/three/gl";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import { CROSSBAR_SPOT } from "@/lib/star/training3d/crossbar";
import type { Quality3d } from "@/lib/star/three3d/quality";
import type { CareerState } from "@/lib/star/types";

const g = globalThis as unknown as Record<string, unknown> & { postMessage(m: unknown): void };
g.window = g;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() };
const requested: string[] = [];
let host: WalkHost<TrainingWalk | DrillWalk> | null = null;
let session: DrillSession | null = null;
let gl: WebGL2RenderingContext | null = null;
const log: string[] = [];
const jsMs: number[] = [];
const origWarn = console.warn.bind(console), origErr = console.error.bind(console);
console.warn = (...a: unknown[]) => { log.push("warn: " + a.map(String).join(" ")); origWarn(...a); };
console.error = (...a: unknown[]) => { log.push("error: " + a.map(String).join(" ")); origErr(...a); };
self.addEventListener("error", (e) => { log.push("uncaught: " + (e as ErrorEvent).message); });
self.addEventListener("unhandledrejection", (e) => { log.push("unhandled: " + String((e as PromiseRejectionEvent).reason)); });
let realFetch: typeof fetch | null = null;
let frames3 = 0;

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
const squad = (n: number) => Array.from({ length: n }, (_, i) => ({
  id: `p${i}`, name: `Test Mate${i}`, shortName: `Mate${i}`, position: i === 0 ? "GK" : i < 4 ? "CB" : i < 6 ? "RB" : i < 9 ? "CM" : "ST",
  overall: 62 + i * 2, pace: 60 + i, shooting: 55 + i * 2, dribbling: 58 + i, passing: 60 + i, defending: 50 + i, physical: 60,
}));
const CAREER = {
  season: 2, week: 7, player: { club: "Arsenal", skinTone: "medium", hairColour: "black", hairStyle: "short", lastName: "Kane" },
  skills: { pace: 68, power: 70, technique: 66, vision: 64, aerial: 60 },
  squad: squad(14), trainingLevels: {}, starsBySkill: {},
} as unknown as CareerState;

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
      self.requestAnimationFrame = (cb) => rawRaf((t) => { const a = performance.now(); cb(t); jsMs.push(performance.now() - a); frames3++; if (jsMs.length > 900) jsMs.shift(); });
      await platform();
      (self as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas = undefined;
      delete (self as unknown as { createImageBitmap?: unknown }).createImageBitmap;
      self.fetch = () => Promise.reject(new TypeError("Network request failed"));
      setToonYou(YOU);
      const t0 = performance.now();
      const common = { gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d };
      if (m.place === "crossbar") {
        const mate = crossbarMate(CAREER, trainingSeed(CAREER));
        host = await startWalkScene({ start: loadTrainingStart(), data: crossbarSceneData(CAREER, mate), callbacks: {}, ...common });
      } else {
        const drill = drillById(m.drill as string)!;
        const seed = trainingSeed(CAREER);
        const cast = castFrom(CAREER, seed);
        session = drillSession(CAREER, drill, seed, cast, m.mode as string | undefined, m.options as Record<string, string> | undefined);
        const look = drillLook(CAREER, session, cast, seed);
        host = await startWalkScene({ start: loadDrillStart(), data: { ...drillSceneData(CAREER, session, look, () => { /* the check reads the world itself */ }), plain: !!m.plain }, callbacks: {}, ...common });
      }
      reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log });
    } else if (m.op === "cmd") {
      const c = host!.controller as unknown as Record<string, (...x: unknown[]) => unknown>;
      let out: unknown = null;
      const fn = m.fn as string;
      if (fn === "call") out = await c[m.name as string](...(m.args as unknown[]));
      else if (fn === "pause") host!.pause();
      else if (fn === "resume") host!.resume();
      else if (fn === "act") session!.world.act(m.action as never);
      else if (fn === "move") { session!.world.input = { move: { x: (m.x as number) || 0, y: (m.y as number) || 0 }, sprint: !!m.sprint }; }
      else if (fn === "mateShot") out = await new Promise((res) => { (host!.controller as TrainingWalk).setShooter("mate"); (host!.controller as TrainingWalk).playMateShot(m.shot as never, () => res("done")); });
      else if (fn === "engineShot") {
        // the engine's ball, as EngineFeature's onBallStep feeds it: a shot from the spot to the bar
        const t = host!.controller as TrainingWalk;
        t.resetBall(); t.play("you", "kick");
        for (let i = 0; i <= 30; i++) { const k = i / 30; t.feedEngineBall({ x: CROSSBAR_SPOT.x - 1.2 * k, y: CROSSBAR_SPOT.y * (1 - k), z: 0.11 + 2.4 * Math.sin(k * Math.PI * 0.62) }); await new Promise((r) => setTimeout(r, 30)); }
      }
      reply(out);
    } else if (m.op === "state") {
      const js = jsMs.slice().sort((a, b) => a - b);
      if (m.reset) jsMs.length = 0;
      const w = session?.world;
      const stats = (host!.controller as unknown as { stats?: () => unknown }).stats?.() ?? null;
      reply({
        frames: gl ? glCounts(gl).frames : 0, draws: gl ? glCounts(gl).draws : 0, log, stats,
        hud: session ? session.hud() : null, done: session ? session.done() : false,
        world: w ? { t: w.t, ball: { x: w.ball.x, y: w.ball.y, z: w.ball.z }, you: w.you() ? { x: w.you()!.x, y: w.you()!.y } : null } : null,
        screens: w && host ? { ball: (host.controller as DrillWalk).ballScreen?.(), heading: (host.controller as DrillWalk).heading?.() } : null,
        js: { n: js.length, median: js[Math.floor(js.length / 2)] ?? 0, p95: js[Math.floor(js.length * 0.95)] ?? 0 },
      });
    } else if (m.op === "asked") {
      reply(Array.from(new Set(requested)));
    } else if (m.op === "dispose") {
      host?.dispose(); host = null;
      reply({ document: typeof (globalThis as { document?: unknown }).document, dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio, log });
    }
  } catch (e) { fail(e); }
};
