// Bundled by tools/night-check.ts and run in a Web Worker: no `document`, no `window`, no storage, like the phone's
// JavaScript engine. It runs the phone's host (src/three/walkHost.ts) with the 3D Ballon d'Or night and the 3D
// season awards night (src/three/nightScene.ts), built from the very same data code the screens use
// (src/three/nightData.ts), and played on a clock the check sets (the screen owns the night's clock).
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setThreePlatform } from "../src/three/platform";
import { startWalkScene, type WalkHost } from "../src/three/walkHost";
import { loadBallonStart, loadAwardsStart, type BallonWalk, type AwardsWalk, type BallonData, type AwardsData, type NightCallbacks } from "../src/three/nightScene";
import { ballonData, awardsData } from "../src/three/nightData";
import { glCounts } from "../src/three/gl";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import { nightPlan } from "@/lib/star/ballonDorNight";
import { awardsPlan } from "@/lib/star/awardsNight";
import type { BallonDorEntry } from "@/lib/star/ballonDor";
import type { AwardWinner, SeasonAwardStats } from "@/lib/star/seasonAwards";
import type { Quality3d } from "@/lib/star/three3d/quality";
import type { CareerState } from "@/lib/star/types";

const g = globalThis as unknown as Record<string, unknown> & { postMessage(m: unknown): void };
g.window = g;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, String(v)); }, removeItem: (k: string) => { store.delete(k); }, clear: () => store.clear() };
const requested: string[] = [];
let host: WalkHost<BallonWalk | AwardsWalk> | null = null;
let gl: WebGL2RenderingContext | null = null;
let clockT = 0;
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
const NAMES = ["Marco Velasco", "Tomas Ferreira", "Jonas Albrecht", "Luca Moretti", "Kenji Arai", "Adrien Lacroix", "Rui Saldanha", "Emre Kaya", "Diego Rios", "Sam Okafor"];
const CLUBS = ["Chelsea", "Liverpool", "Man City", "Real Madrid", "Barcelona", "Bayern Munich", "PSG", "Inter", "Juventus", "Napoli"];

/** A career as the screens get one. */
function career(over: Record<string, unknown> = {}): CareerState {
  return {
    season: 3, week: 38,
    player: { firstName: "Sam", lastName: "Carter", club: "Arsenal", position: "ST", skinTone: "dark", hairColour: "blonde", hairStyle: "long", startYear: 2026 },
    squadNumber: 9, equippedAccessories: { head: "headband-ninja" }, equippedRewards: {}, clubKits: {},
    ...over,
  } as unknown as CareerState;
}

/** The ten on the Ballon d'Or list: you in `yourRank` (0: not on it), the rest made up. */
function entries(yourRank: number): BallonDorEntry[] {
  const out: BallonDorEntry[] = [];
  let n = 0;
  for (let rank = 1; rank <= 10; rank++) {
    const you = rank === yourRank;
    out.push({
      rank, isPlayer: you, name: you ? "Sam Carter" : NAMES[n % NAMES.length], club: you ? "Arsenal" : CLUBS[n % CLUBS.length],
      goals: 30 - rank, assists: 12 - (rank >> 1), rating: 8.4 - rank * 0.05, ratingIsReal: you, trophies: [], score: 100 - rank,
    });
    if (!you) n++;
  }
  return out;
}

/** The awards: you win the Golden Boot and Player of the Season, three others win the rest. */
function awardStats(): SeasonAwardStats {
  const w = (i: number, value: number, you = false): AwardWinner => ({ name: you ? "Sam Carter" : NAMES[i % NAMES.length], club: you ? "Arsenal" : CLUBS[i % CLUBS.length], isYou: you, value });
  const nominees: SeasonAwardStats["nominees"] = {
    goldenBoot: [w(0, 27, true), w(1, 23), w(2, 19)],
    assistKing: [w(3, 15), w(4, 12, false), w(5, 11)],
    goldenGlove: [w(6, 17), w(7, 15), w(8, 13)],
    youngPlayerOfSeason: [w(9, 88), w(0, 85), w(1, 80)],
    playerOfSeason: [w(0, 112, true), w(2, 104), w(3, 99)],
  };
  return {
    season: 3, leagueName: "Premier League",
    goldenBoot: nominees.goldenBoot![0], assistKing: nominees.assistKing![0], goldenGlove: nominees.goldenGlove![0],
    youngPlayerOfSeason: nominees.youngPlayerOfSeason![0], playerOfSeason: nominees.playerOfSeason![0],
    teamOfSeason: [], communityShieldGuess: null, superCupGuess: null, nominees,
  } as SeasonAwardStats;
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
      delete (self as unknown as { Image?: unknown }).Image; // (Hermes has no `Image`: a scene that asks for one must not get a browser's)
      self.fetch = () => Promise.reject(new TypeError("Network request failed"));
      setToonYou(YOU);
      clockT = 0;
      const t0 = performance.now();
      const clock = () => clockT;
      const place = m.place as "ballon-full" | "ballon-short" | "ballon-won" | "awards";
      let end = 0;
      let reveal = 0;
      let cb: NightCallbacks = {};
      if (place === "awards") {
        const c = career({ lastSeasonAwardStats: awardStats() });
        const plan = awardsPlan(c.lastSeasonAwardStats!, 4242);
        end = plan.end;
        reveal = plan.awards[0].revealAt;
        host = await startWalkScene<AwardsData, NightCallbacks, AwardsWalk>({
          start: loadAwardsStart(), data: awardsData(c, plan, clock), callbacks: cb,
          gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d,
        });
        reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log, end, reveal, awards: plan.awards.map((a) => ({ key: a.key, from: a.from, revealAt: a.revealAt, walkTo: a.walkTo, end: a.end, you: a.winner.isYou })) });
      } else {
        const rank = place === "ballon-full" ? 2 : place === "ballon-won" ? 1 : 0;
        const c = career();
        const plan = nightPlan(entries(rank), rank, 31 * 2026 + 3);
        end = plan.end;
        reveal = plan.revealAt;
        host = await startWalkScene<BallonData, NightCallbacks, BallonWalk>({
          start: loadBallonStart(), data: ballonData(c, plan, clock), callbacks: cb,
          gl, width: m.w as number, height: m.h as number, pixelRatio: m.pr as number, quality: m.quality as Quality3d,
        });
        reply({ ms: performance.now() - t0, requested: Array.from(new Set(requested)), log, end, reveal, plan: { kind: plan.kind, hostFrom: plan.hostFrom, callAt: plan.callAt, pauseAt: plan.pauseAt, yourPlaceAt: plan.yourPlaceAt, walks: plan.finalists.map((f) => [f.walkFrom, f.walkTo]) } });
      }
    } else if (m.op === "cmd") {
      const c = host!.controller as unknown as Record<string, (...x: unknown[]) => unknown>;
      let out: unknown = null;
      const fn = m.fn as string;
      if (fn === "call") out = await c[m.name as string](...(m.args as unknown[]));
      else if (fn === "pause") host!.pause();
      else if (fn === "resume") host!.resume();
      else if (fn === "clock") clockT = m.t as number;
      reply(out);
    } else if (m.op === "state") {
      const js = jsMs.slice().sort((a, b) => a - b);
      if (m.reset) jsMs.length = 0;
      reply({ frames: gl ? glCounts(gl).frames : 0, draws: gl ? glCounts(gl).draws : 0, log, js: { n: js.length, median: js[Math.floor(js.length / 2)] ?? 0, p95: js[Math.floor(js.length * 0.95)] ?? 0 } });
    } else if (m.op === "asked") {
      reply(Array.from(new Set(requested)));
    } else if (m.op === "dispose") {
      host?.dispose(); host = null;
      reply({ document: typeof (globalThis as { document?: unknown }).document, dpr: (globalThis as { devicePixelRatio?: number }).devicePixelRatio, log });
    }
  } catch (e) { fail(e); }
};
