// Perf harness: runs the REAL scene modules (bundled straight from the
// worktree) with a render() hook that measures every on-screen frame.
import * as THREE from "three";
import { startGarden } from "@/lib/star/garden3d/scene";
import { startShop } from "@/lib/star/shop3d/scene";
import { shopDisplays } from "@/lib/star/shop3d/catalogue";
import { createSigningScene } from "@/lib/star/signing3dScene";
import * as P from "@/lib/star/three3d/perf";
import { createEngineView } from "@/lib/star/style3d/engineView";
import { resolveStyle } from "@/lib/star/style3d/styles";
import { createDirector } from "@/lib/star/cutscene/director";
import { FIXTURES } from "@/lib/star/cutscene/fixtures";
import { startFrameStats } from "@/lib/star/three3d/frameStats";
startFrameStats();
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
(window as any).P = P;
(window as any).mergeGeometries = mergeGeometries;

type Frame = { at: number; cpu: number; calls: number; tris: number };
const M: any = {
  t0: 0, frames: [] as Frame[], longtasks: [] as { at: number; d: number }[],
  renderer: null, scene: null, camera: null, finish: true, hook: null, skipUntilReady: false,
};
(window as any).__M = M;
(window as any).THREE = THREE;

try {
  new PerformanceObserver((l) => { for (const e of l.getEntries()) M.longtasks.push({ at: e.startTime, d: e.duration }); }).observe({ type: "longtask", buffered: true } as any);
} catch { /* */ }

// three r169 assigns render() per instance, so the prototype can't be
// patched. Scene.onBeforeRender/onAfterRender are called by every render():
// they time on-screen frames, and wrap the instance's render() on first
// sight so experiments (M.hook) can replace a frame.
const S: any = THREE.Scene.prototype;
let tA = 0;
const PX = new Uint8Array(4);
S.onBeforeRender = function (r: any, _s: any, _c: any, rt: any) {
  if (rt) return;
  if (!r.__wrapped) {
    r.__wrapped = true;
    const orig = r.render.bind(r);
    r.__orig = orig;
    r.render = (scene: any, camera: any) => {
      if (M.hook && r.getRenderTarget() === null) { const res = M.hook(r, scene, camera, orig); if (res === "skip") return; if (res === "done") return; }
      orig(scene, camera);
    };
  }
  M.renderer = r; M.scene = this; M.camera = _c;
  tA = performance.now();
};
S.onAfterRender = function (r: any) {
  if (r.getRenderTarget() !== null || M.scene !== this) return;
  if (M.finish) { const g = r.getContext(); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, PX); }
  push(r, tA, performance.now() - tA);
};
function push(r: any, a: number, cpu: number) {
  if (M.inHook) { M.hookCalls = (M.hookCalls || 0) + r.info.render.calls; M.hookTris = (M.hookTris || 0) + r.info.render.triangles; return; }
  M.frames.push({ tag: M.tag, at: a, cpu: cpu + (M.extraCpu || 0), calls: r.info.render.calls + (M.hookCalls || 0), tris: r.info.render.triangles + (M.hookTris || 0) });
  M.extraCpu = 0; M.hookCalls = 0; M.hookTris = 0;
}

const stage = () => document.getElementById("stage")!;
const KIT = { shirt: "#c8102e", trim: "#ffffff" };

(window as any).H = {
  async garden(opts: any = {}) {
    M.t0 = performance.now();
    const c = await startGarden(stage(), { onNear() {}, onFps() {}, onShopDoor() {} }, {
      kit: KIT, number: 10, tier: opts.tier ?? 3, stable: 3, horse: { name: "Shergar" },
      trophies: [{ name: "Premier League", count: 2, art: null }, { name: "FA Cup", count: 1, art: null }],
      cars: ["/star/shop3d/items/car-1.glb", "/star/shop3d/items/car-suv.glb"],
      sky: "day", mates: [4, 7, 9], arrive: "gate",
      player: { look: opts.look ?? "new", skin: "#e0b89a", hair: "#3d2616", hairStyle: "short" },
    }, { quality: opts.quality ?? "high", fixedStep: 1 / 30 });
    M.ready = performance.now();
    M.ctrl = c;
    return c.stats();
  },
  async shop(opts: any = {}) {
    M.t0 = performance.now();
    const c = await startShop(stage(), { onNear() {}, onFps() {} } as any, KIT, shopDisplays(), {
      quality: opts.quality ?? "high", fixedStep: 1 / 30, number: 10, player: { look: opts.look ?? "new", skin: "#e0b89a", hair: "#3d2616", hairStyle: "short" },
    });
    M.ready = performance.now();
    M.ctrl = c;
    return true;
  },
  async office(opts: any = {}) {
    M.t0 = performance.now();
    const h = await createSigningScene(stage(), {
      stage: opts.stage ?? "office",
      you: { skin: "#e0b89a", face: null, accessories: [], kit: KIT, number: 10, hair: "#3d2616", hairStyle: "short" },
      manager: { skin: "#d9a982", hairColour: "#2a2a2a", grey: 0.3, beard: false, bald: false, buzz: false },
      contract: { club: "Liverpool", playerName: "A Player", managerName: "A Manager", rows: [["Wage", "1k"]], shirt: KIT.shirt, trim: KIT.trim },
      signaturePath: "M10 40 C 40 10, 60 50, 90 20",
    });
    M.ready = performance.now();
    M.ctrl = h;
    return true;
  },
  /** The real game's 3D view (career), fed one still made-up frame of a chance, 22 men. */
  async career(opts: any = {}) {
    M.t0 = performance.now();
    const v = await createEngineView(stage(), { def: resolveStyle("real", "play"), tier: opts.tier ?? "medium", tod: opts.tod ?? "golden" });
    const fig = (sid: string, x: number, y: number, team: "us" | "them") => ({ sid, x, y, team, shirt: team === "us" ? "#c8102e" : "#1d4ed8", shorts: "#ffffff", kick: false, kickFoot: 1, drawn: true });
    const figures: any[] = [fig("you", 34, 18, "us")];
    const us = [[20, 22], [48, 22], [26, 30], [42, 30], [34, 36], [14, 40], [54, 40], [28, 48], [40, 48], [34, 60]];
    const them = [[30, 10], [38, 10], [24, 14], [44, 14], [34, 22], [18, 26], [50, 26], [30, 32], [38, 32], [34, 44]];
    us.forEach(([x, y], i) => figures.push(fig(`mate${i}`, x, y, "us")));
    them.forEach(([x, y], i) => figures.push(fig(`def${i}`, x, y, "them")));
    const t0 = performance.now() / 1000;
    const f = () => ({
      t: performance.now() / 1000, phase: "aim", kind: "one_on_one",
      cam: { viewport: { x1: 10, x2: 58, y1: -4, y2: 44 }, facing: "up", tilt: null, W: 390, H: 600 },
      ball: { x: 34, y: 17.2, z: 0.11, vx: 0, vy: 0, vz: 0, live: true, inNet: false }, landing: null,
      keeper: { x: 34, y: 1.2, dive: 0, saveLunge: 0, saveDir: 0, saveKind: null, idleT: performance.now() / 1000 - t0, shirt: "#16a34a", shorts: "#111111", drawn: true },
      figures, aim: null, ring: null, goalSide: null, goalInView: true, orders: null,
    });
    let on = true;
    const tick = () => { if (!on) return; v.frame(f() as any); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    M.ready = performance.now();
    M.ctrl = { dispose() { on = false; v.dispose(); } };
    return true;
  },
  /** A cut scene (a fixture), held still at `at` seconds. */
  async cut(opts: any = {}) {
    M.t0 = performance.now();
    const d = await createDirector(stage(), FIXTURES[opts.fixture ?? "trophy"](), { style: "real", tier: opts.tier ?? "medium", holdAt: opts.at ?? 2 });
    M.ready = performance.now();
    M.ctrl = d;
    return true;
  },
  dispose() { M.ctrl?.dispose?.(); M.ctrl = null; },
};
