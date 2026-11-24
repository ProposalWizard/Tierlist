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
import { loadShopStart, type ShopData } from "../src/three/shopScene";
import { loadHouseStart, type HouseData } from "../src/three/houseScene";
import { houseSceneData } from "../src/three/houseData";
import type { HomeController, HomeCallbacks } from "@/lib/star/home3d/scene";
import type { HomeTier } from "@/lib/star/home3d/homes";
import { DEFAULT_OUTFIT, CASUAL_SETS, wornAt } from "@/lib/star/home3d/outfits";
import { shopDisplays } from "@/lib/star/shop3d/catalogue";
import type { ShopCallbacks, ShopController } from "@/lib/star/shop3d/scene";
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
let host: WalkHost<GardenController | ShopController | HomeController> | null = null;
let rooms: string[] = [];
let cards: unknown[] = [];
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
    trophies: [{ name: "Premier League", count: 2, art: "/star/trophies/premier-league.webp" }, { name: "FA Cup", count: 1, art: "/star/trophies/fa-cup.webp" }, { name: "Golden Boot", count: 1, art: "/star/trophies/golden-boot.webp" }, { name: "Community Shield", count: 1, art: null }],
    cars: ["/star/shop3d/items/car-1.glb", "/star/shop3d/items/car-2.glb", "/star/shop3d/items/car-classic.glb"],
    sky, mates: [7, 4, 11], arrive,
    player: { look: "new", skin: "#c68642", hair: "#2b1d14", hairStyle: "short" },
  };
}

/** What the website's test page /star-shop3d-dev builds the shop from (list prices, the new player, look H's displays). */
let STEP: number | undefined;
function shopData(atDoor: boolean): ShopData {
  return {
    kit: kitsOf("Arsenal").home, displays: shopDisplays({}, { h: true }), atDoor, number: 9, fixedStep: STEP,
    // the clothes from the wardrobe, as the screen passes them (a career that never opened the wardrobe: the hoodie)
    player: { look: "new", skin: "#c68642", hair: "#2b1d14", hairStyle: "short", worn: wornAt({ outfit: undefined, currentBoot: null } as never, "shop") },
  };
}

/** A career with every car, the bike, the jet, a horse, watches and some trophies, so every room of every home has its models. */
function houseData(tier: HomeTier, wear: "casual" | "kit", living: boolean | undefined, pov: boolean, step: number | undefined): HouseData & { tier: HomeTier; alive: boolean } {
  const item = (id: string) => ({ id, name: id, category: "item", price: 1, lifestyleValue: 1, level: 3 });
  const career = {
    player: { club: "Arsenal", skinTone: "medium", hairColour: "black", hairStyle: "short" },
    squadNumber: 9, currentBoot: null,
    ownedItems: ["car-1", "car-2", "suv", "car-3", "classic", "car-4", "bike", "jet", "tv", "smartwatch", "gold", "rolex", "silver", "diamond"].map(item),
    trophies: [{ competition: "Premier League", season: "2027/28" }, { competition: "FA Cup", season: "2027/28" }, { competition: "Champions League", season: "2028/29" }],
    awards: [{ kind: "Golden Boot", season: "2027/28" }], ballonDorWins: 1,
    squad: [1, 2, 3, 4, 5].map((n) => ({ id: `p${n}`, name: `Mate ${n}`, shortName: `Mate ${n}`, position: "CM" })),
    kibCans: { basic: 2, premium: 1, elite: 1 }, horse: { name: "Comet" },
    outfit: undefined, lastSleep: undefined, season: 1, week: 1,
  } as never;
  return houseSceneData(career, { ...DEFAULT_OUTFIT, wear }, { pov, tier, living, fixedStep: step, sleep: () => ({ rested: true, text: "A good night." }) });
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
      if (m.place === "house") {
        STEP = (m.step as number | undefined) || undefined;
        const d = houseData((m.tier as HomeTier) ?? "starter", (m.wear as "casual" | "kit") ?? "casual", m.living as boolean | undefined, !!m.pov, STEP);
        rooms = d.home.rooms ?? ["main"];
        const hcbs: HomeCallbacks = {
          onNear: (s) => { near = s; },
          onFps: () => {},
          onDoor: () => { doors.push("door"); },
          onContextLost: () => { doors.push("lost"); },
          onRoom: (id) => { doors.push(`room:${id}`); },
          onCard: (c) => { cards.push(c); },
        };
        host = await startWalkScene<HouseData, HomeCallbacks, HomeController>({
          start: loadHouseStart(), data: d, callbacks: hcbs,
          gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d,
        });
      } else if (m.place === "shop") {
        STEP = (m.step as number | undefined) || undefined;
        const scbs: ShopCallbacks = {
          onNear: (s) => { near = s; },
          onFps: () => {},
          onDoor: () => { doors.push("door"); },
          onContextLost: () => { doors.push("lost"); },
        };
        host = await startWalkScene<ShopData, ShopCallbacks, ShopController>({
          start: loadShopStart(), data: shopData(m.arrive === "door"), callbacks: scbs,
          gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d,
        });
      } else {
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
      }
      (self as unknown as { __host: unknown }).__host = host;
      reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log, rooms });
    } else if (m.op === "cmd") {
      const c = host!.controller as unknown as GardenController & ShopController & HomeController;
      const a = m.args as number[];
      const fn = m.fn as string;
      let out: unknown = null;
      // any other method of the place's controller by name (the shop's select, setLevel, setCardOpen, pick, walkToItem ...)
      if (fn === "call") out = await ((c as unknown as Record<string, (...x: unknown[]) => unknown>)[m.name as string])(...(m.args as unknown[]));
      else if (fn === "wear") await c.wear(m.what === "kit" ? { kind: "kit", kit: "away", boots: "#141416" } : { kind: "casual", set: CASUAL_SETS.find((x) => x.id === m.what) ?? CASUAL_SETS[0] });
      else if (fn === "place") c.place(a[0], a[1], a[2]);
      else if (fn === "stick") c.setStick(a[0], a[1]);
      else if (fn === "tap") out = c.tap?.(a[0], a[1]);
      else if (fn === "orbit") c.orbit(a[0], a[1]);
      else if (fn === "cam") c.debugCamera?.(a.length ? [a[0], a[1], a[2]] : null, a.length ? [a[3], a[4], a[5]] : undefined);
      else if (fn === "pause") host!.pause();
      else if (fn === "resume") host!.resume();
      else if (fn === "pointer") host!.pointer(m.type as never, a[0], a[1], a[2]);
      reply(out);
    } else if (m.op === "state") {
      const c = host!.controller as GardenController;
      const js = jsMs.slice().sort((a, b) => a - b);
      if (m.reset) jsMs.length = 0;
      reply({ where: c.where(), near, doors, cards: cards.length, room: (c as unknown as HomeController).room?.(), stats: c.stats(), frames: gl ? glCounts(gl).frames : 0, pinching: host!.pinching(), log, walking: c.walking?.(), js: { n: js.length, median: js[Math.floor(js.length / 2)] ?? 0, p95: js[Math.floor(js.length * 0.95)] ?? 0 } });
    } else if (m.op === "asked") {
      reply(Array.from(new Set(requested)));
    } else if (m.op === "dispose") {
      host?.dispose(); host = null;
      reply({ document: typeof (globalThis as { document?: unknown }).document, dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio, log });
    }
  } catch (e) { fail(e); }
};
