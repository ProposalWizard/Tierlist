// Perf harness: runs the REAL scene modules (bundled straight from the
// worktree) with a render() hook that measures every on-screen frame.
import * as THREE from "three";
import { startGarden } from "@/lib/star/garden3d/scene";
import { startShop } from "@/lib/star/shop3d/scene";
import { startCasino } from "@/lib/star/casino3d/scene";
import { shopDisplays } from "@/lib/star/shop3d/catalogue";
import { createSigningScene } from "@/lib/star/signing3dScene";
import * as P from "@/lib/star/three3d/perf";
import { createEngineView } from "@/lib/star/style3d/engineView";
import { resolveStyle } from "@/lib/star/style3d/styles";
import { createDirector } from "@/lib/star/cutscene/director";
import { FIXTURES } from "@/lib/star/cutscene/fixtures";
import { startFrameStats } from "@/lib/star/three3d/frameStats";
import { startHome } from "@/lib/star/home3d/scene";
import { CASUAL_SETS, BOOT_LOD } from "@/lib/star/home3d/outfits";
import { cabinetSlots } from "@/lib/star/home3d/trophies";
import { cabinetSize } from "@/lib/star/home3d/homes";
import { createPlay3DScene } from "@/lib/star/play3d/scene";
import { makeFreeRoam } from "@/lib/star/play3d/freeRoam";
import { play3dH } from "@/lib/star/style3d/real/play3dH";
import { loadToonHead, loadPeople3d, makePerson3d, dressPerson3d } from "@/lib/star/people3d";
import { withMeshopt } from "@/lib/star/three3d/meshopt";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
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
  (M.scenes ||= new Set()).add(this);
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
  async casino(opts: any = {}) {
    M.t0 = performance.now();
    const c = await startCasino(stage(), { onNear() {}, onFps() {}, onArrive() {} } as any, {
      quality: opts.quality ?? "high", fixedStep: 1 / 30, kit: KIT, number: 10, player: { look: opts.look ?? "new", skin: "#e0b89a", hair: "#3d2616", hairStyle: "short" } as any,
    });
    M.ready = performance.now();
    M.ctrl = c;
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
    let facing = "up";
    const bp = { x: 34, y: 17.2 };
    const f = () => ({
      t: performance.now() / 1000, phase: "aim", kind: "one_on_one",
      cam: { viewport: { x1: 10, x2: 58, y1: -4, y2: 44 }, facing, tilt: null, W: 390, H: 600 },
      ball: { x: bp.x, y: bp.y, z: 0.11, vx: 0, vy: 0, vz: 0, live: true, inNet: false }, landing: null,
      keeper: { x: 34, y: 1.2, dive: 0, saveLunge: 0, saveDir: 0, saveKind: null, idleT: performance.now() / 1000 - t0, shirt: "#16a34a", shorts: "#111111", drawn: true },
      figures, aim: null, ring: null, goalSide: null, goalInView: true, orders: null,
    });
    // M.switchChance(): a new chance (a new kind, a new framing, new men) to time the cut (window.__M.vf: ms per frame() call)
    let chance = 0;
    let vp = { x1: 10, x2: 58, y1: -4, y2: 44 };
    let kind = "one_on_one";
    M.vf = [] as { t: number; ms: number; chance: number }[];
    // fresh=true: every man a new sid (the worst case: 20 new bodies at once). Default: the real game's
    // way (CanvasMatch reuses "mate0", "run1", "def3" …), a different number of each per kind.
    const COUNTS: Record<string, [number, number, number]> = { corner: [6, 3, 9], one_on_one: [1, 1, 2], cutback: [3, 2, 5], through_ball: [2, 2, 4], long_range: [3, 1, 6] };
    M.switchChance = (k = "corner", fresh = false) => {
      chance++; kind = k; vp = chance % 2 ? { x1: 30, x2: 68, y1: -4, y2: 30 } : { x1: 10, x2: 58, y1: -4, y2: 44 };
      figures.length = 1;
      const sh = (chance % 2) * 8;
      // a corner is the side-on picture (the 2D's turned facing), the camera swung to the corner flag's side
      facing = k === "corner" ? (chance % 4 < 2 ? "left" : "right") : "up";
      const you0 = figures[0];
      if (k === "corner") { you0.x = facing === "left" ? 66 : 2; you0.y = 1; } else { you0.x = 34 + sh - 4; you0.y = k === "long_range" ? 26 : 16; }
      bp.x = you0.x + 0.6; bp.y = you0.y - 0.6;
      if (fresh) {
        us.forEach(([x, y], i) => figures.push(fig(`c${chance}m${i}`, x + sh, y - 6, "us")));
        them.forEach(([x, y], i) => figures.push(fig(`c${chance}d${i}`, x + sh, y - 4, "them")));
        return;
      }
      const [nm, nr, nd] = COUNTS[k] ?? [4, 2, 6];
      for (let i = 0; i < nm; i++) figures.push(fig(`mate${i}`, us[i][0] + sh, us[i][1] - 6, "us"));
      for (let i = 0; i < nr; i++) figures.push(fig(`run${i}`, us[9 - i][0] + sh, us[9 - i][1] - 10, "us"));
      for (let i = 0; i < nd; i++) figures.push(fig(`def${i}`, them[i][0] + sh, them[i][1] - 4, "them"));
    };
    let on = true;
    const tick = () => { if (!on) return; const fr: any = f(); fr.kind = kind; fr.cam.viewport = vp; const a = performance.now(); v.frame(fr); M.vf.push({ t: a, ms: performance.now() - a, chance }); requestAnimationFrame(tick); };
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
  /** Your house (a flat), in your kit. */
  async home(opts: any = {}) {
    M.t0 = performance.now();
    const c = await startHome(stage(), { onNear() {} }, {
      tier: opts.tier ?? "flat", kits: { home: { shirt: KIT.shirt, trim: KIT.trim }, away: { shirt: "#ffffff", trim: "#111111" } } as any, number: 10,
      worn: { kind: "kit", kit: "home", boots: "#141416" } as any, skin: "#e0b89a", hair: "#3d2616", hairStyle: "short",
      slots: cabinetSlots({ trophies: [], awards: [], ballonDorWins: 0 } as any, cabinetSize(opts.tier ?? "flat")), cars: [], boots: [{ id: "plain", label: "Plain black", colour: "#141416", model: BOOT_LOD.starter }], casual: CASUAL_SETS,
    }, { quality: opts.quality ?? "medium", fixedStep: 1 / 30 });
    M.ready = performance.now();
    M.ctrl = c;
    return true;
  },
  /** A 3D drill (Free Roam) in look H: you, two team-mates, a keeper. */
  async drill(opts: any = {}) {
    M.t0 = performance.now();
    const sk = { overall: 75, pace: 75, power: 75, technique: 75 };
    const { world } = makeFreeRoam({ seed: 7, you: { id: "you", name: "You", skills: sk }, mates: [{ id: "m1", name: "A", skills: sk }, { id: "m2", name: "B", skills: sk }] });
    const h = await play3dH(world, { colours: { home: KIT.shirt, home2: KIT.trim, away: "#1d4ed8" } as any });
    const people: any = {};
    for (const p of world.players) people[p.id] = { skin: "#e0b89a", hair: "#3d2616", hairStyle: "short" };
    const c = await createPlay3DScene(stage(), world, { kit: KIT, people }, { camera: "practice", quality: opts.quality ?? "medium", ...(h.opts as any), onFrame: (dt: number) => h.frame(dt) });
    M.ready = performance.now();
    M.ctrl = { dispose() { c.dispose(); h.dispose(); } };
    return true;
  },
  /** Home / title screen: your Style A player alone (ToonHomePlayer's load: one head + the clips). */
  async toon() {
    M.t0 = performance.now();
    const el = stage();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(220, 320); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight("#b9cdf0", "#4a5a2a", 1.2));
    const loader = await withMeshopt(new GLTFLoader());
    const [g, anims] = await Promise.all([loadToonHead(loader as any, "h1"), loadPeople3d(loader as any, "anims", "new")]);
    const p = makePerson3d(THREE as any, ((SkeletonUtils as any).default ?? SkeletonUtils) as any, g, anims, { outline: 0.006, you: true });
    dressPerson3d(THREE as any, p, { skin: "#e0b89a", hair: "#3d2616", kit: KIT, number: null });
    scene.add(p.root);
    const cam = new THREE.PerspectiveCamera(18, 220 / 320, 0.1, 40); cam.position.set(0, 1, 7); cam.lookAt(0, 0.9, 0);
    let on = true;
    const tick = () => { if (!on) return; renderer.render(scene, cam); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    M.ready = performance.now();
    M.ctrl = { dispose() { on = false; renderer.dispose(); renderer.domElement.remove(); } };
    return true;
  },
  /**
   * One person from loadPeople3d under the page's own Settings (set the look keys in
   * localStorage first: "star-look-player-style" old + "star-look-3d-body" human/before for
   * the human or the one body). Lag pass 4: a still of each packed model against the plain one.
   */
  async person(opts: any = {}) {
    M.t0 = performance.now();
    const el = stage();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(220, 320); el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight("#b9cdf0", "#4a5a2a", 1.2)); const sun = new THREE.DirectionalLight("#ffffff", 2); sun.position.set(2, 4, 5); scene.add(sun);
    const loader = await withMeshopt(new GLTFLoader());
    const [g, anims] = await Promise.all([loadPeople3d(loader as any, opts.model ?? "player", "new"), loadPeople3d(loader as any, "anims", "new")]);
    const p = makePerson3d(THREE as any, ((SkeletonUtils as any).default ?? SkeletonUtils) as any, g, anims, { outline: 0.006, you: true });
    dressPerson3d(THREE as any, p, { skin: "#e0b89a", hair: "#3d2616", kit: KIT, number: null });
    scene.add(p.root);
    const cam = new THREE.PerspectiveCamera(18, 220 / 320, 0.1, 40); cam.position.set(0, 1, 7); cam.lookAt(0, 0.9, 0);
    let on = true;
    const tick = () => { if (!on) return; renderer.render(scene, cam); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    M.ready = performance.now();
    M.ctrl = { dispose() { on = false; renderer.dispose(); renderer.domElement.remove(); } };
    return true;
  },
  /** Home's idle early download for a place (perf.ts preloadScene), then window.__preloadDone. */
  async preload(scene: string) {
    const name = ({ toon: "home", drill: "home", career: "home", cut: "home" } as any)[scene] ?? scene;
    await P.preloadScene(name);
    await new Promise((r) => setTimeout(r, 200));
    (window as any).__preloadDone = true;
  },
  dispose() { M.ctrl?.dispose?.(); M.ctrl = null; },
};

// ?auto=<scene>: start a scene on load (tools/bake3d/capture.mjs opens the page and waits for window.__M.ready)
{
  const auto = new URLSearchParams(location.search).get("auto");
  if (auto && (window as any).H[auto]) void (window as any).H[auto]({ quality: new URLSearchParams(location.search).get("q") ?? "high" });
}
