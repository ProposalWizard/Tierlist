/**
 * THE SHARED 3D PERFORMANCE LAYER (Harry, 5 Oct 2026: "the less lag is BIG
 * and if we are gna make this integral you need to find out of the box
 * solutions"). Every 3D scene — the garden (garden3d/scene.ts), the shop
 * (shop3d/scene.ts), the signing and the manager's office
 * (signing3dScene.ts), the Test Area — should get its renderer, its quality
 * and its first frame from here, so a fix lands once and every scene gets it.
 *
 * Pure three.js. Every function takes `T` (the scene's own
 * `await import("three")`) so importing this file never pulls three.js into
 * a page that has no 3D on it. The Settings row lives in ./quality.ts (no
 * three.js at all).
 *
 * ── HOW A SCENE ADOPTS IT (in this order; each step stands on its own) ──
 *
 *  1. QUALITY (done in the garden, the shop, the signing and the office,
 *     6 Oct 2026). BEFORE making the renderer:
 *        const tier = opts.quality ?? quality3dTier();   // Settings, else Auto from the device
 *        const prof = TIER_PROFILES[tier];
 *     and read prof.maxPixelRatio / movePixelRatio / antialias / shadows
 *     (shadowSizeFor(prof, base)) / fpsCap / stillFps / outlines instead of
 *     hard-coding them. A scene too slow for three seconds takes ONE step
 *     down (stepDownTier), never a private "low". After the renderer:
 *     rememberGpu(renderer), so Auto knows the GPU from the next visit.
 *
 *  2. ONE RENDERER. Replace
 *        const renderer = new THREE.WebGLRenderer({...}); container.appendChild(...)
 *     with
 *        const { renderer, release } = acquireRenderer(T, container, prof);
 *     and in dispose(), replace `renderer.dispose()` (and the scene's own
 *     traverse-and-dispose) with `release(scene)`. NEVER call
 *     renderer.dispose() / forceContextLoss() on the shared one. The scene
 *     must set its own toneMapping / exposure / shadowMap on every entry
 *     (acquire resets them to three's defaults). Garden → shop → garden then
 *     costs no new WebGL context, and the shaders both scenes share (the
 *     people3d body, MeshStandardMaterial) stay compiled across the hop.
 *
 *  3. DYNAMIC RESOLUTION. After the renderer:
 *        const dyn = new DynamicResolution(renderer, prof);
 *     and once per drawn frame, `dyn.frame(now)`. (The garden and the shop
 *     run it only while you move, on the moving pixel ratio, with
 *     { maxPixelRatio: prof.movePixelRatio } and a setter of their own, and
 *     call dyn.pause() when they rest at 30 a second on purpose.) It lowers or raises the
 *     render scale (pixel ratio) in steps to hold the frame budget, so a
 *     phone that can't keep up gets fewer pixels, not a stutter.
 *
 *  4. NO FIRST-FRAME HITCH. Before the first renderer.render():
 *        await warmUp(T, renderer, scene, camera, { includeHidden: true });
 *     (uploads every texture and compiles every shader — in parallel where
 *     the phone supports it — while the loading cover is still up).
 *     And EARLIER, on a screen that leads to the scene (the dashboard, the
 *     shop button), call preloadScene("garden") so the files are already
 *     downloaded; then load with loadGltfCached(loader, url) instead of
 *     loader.loadAsync(url).
 *
 *  5. ONLY DRAW WHAT CHANGED. Fixed-camera scenes (the office between cuts,
 *     a shop card being read) wrap their render call:
 *        if (gate.shouldRender(now, cameraMoved(camera, lastCam))) renderer.render(scene, camera);
 *     and call gate.invalidate() when something animates. gate = new
 *     FrameGate({ fpsCap: prof.fpsCap }). A low-tier phone draws 30 frames a
 *     second instead of 60 — half the heat and battery for the same look.
 *
 *  6. FEWER DRAW CALLS. After building the static set (walls, floor, fences,
 *     trees, props that never move): mergeStaticByMaterial(T, mergeGeometries, root)
 *     — one draw per material instead of one per box. Repeats (fence posts,
 *     chairs, bottles): instanceRepeats(T, root). Far or idle characters
 *     (team-mates on the bench, the crowd): bakeImpostor(...) — a picture on
 *     a card instead of a skinned body.
 *
 *  7. SMALLER TEXTURES (needs new files). makeKTX2Loader(T, renderer) is
 *     ready; the GLBs need converting first (gltf-transform etc1s/uastc,
 *     outside this repo's tools), and three's basis transcoder copying to
 *     /star/three/basis/ (node_modules/three/examples/jsm/libs/basis/).
 *
 *  8. FROZEN SHADOWS. freezeStaticShadows(renderer, scene) after building:
 *     the sun's shadow map is drawn once from the static set; people keep
 *     their blob shadows. The garden must then keep its sun FIXED over the
 *     whole garden (today it follows the player; ±22 m already covers it).
 *
 *  9. 3D IN A WORKER (biggest change, biggest "page never freezes" win):
 *     ./offscreen.ts — the scene moves into a worker, the page only passes
 *     size and touches.
 *
 * MEASURED, 5 Oct 2026 (a headless Chrome with software rendering —
 * SwiftShader, no GPU — CPU slowed 4× as a phone stand-in, on a shared,
 * busy 4-core machine; so read the % changes, not the ms; same-page A/B
 * where marked, which both sides see the same load):
 *   render scale 1.5 → 1.0 (phone, DPR 3), garden    frame −48% (A/B)
 *   frozen shadow map, garden                        frame −18% (A/B), render() CPU −15% (A/B)
 *   3 team-mates as cards instead of bodies, garden  frame −34% (A/B), render() CPU −25% (A/B)
 *   static meshes merged by material, garden         draws 170 → 147, frame −3% (A/B), render() CPU −17% (A/B)
 *   office room pre-rendered behind the people       draws 53 → 5, frame −16% / −20% (A/B, 1× and 3× DPR)
 *   scene in a Web Worker (garden-sized)             page frozen 12.7 s → 0.7-1.1 s of 14 s; worst freeze 3.4-5.3 s → 0.25 s
 *   meshopt + resampled clips (file size)            garden's first files 2.1 MB → 1.1 MB (props stay Draco)
 *   warm-up (compile + 1-pixel prime)                moves the 2-7 s first-frame cost behind the cover; SwiftShader
 *                                                    has no parallel compile, so the total is the same here (reasoned
 *                                                    to be shorter on phones that have KHR_parallel_shader_compile)
 */
import type * as THREE from "three";
import { installFrameMeter } from "./frameMeter";
import { safeCompileAsync } from "./safeCompile";
import { quality3dTier, noteGpu3d, QUALITY3D_AUTO_KEY, type Quality3d, type TierProfile } from "./quality";

export type { Quality3d, TierProfile } from "./quality";
export { TIER_PROFILES, tierHintFromGpu, stepDownTier, shadowSizeFor, autoTierFromDevice } from "./quality";
type Three = typeof import("three");

// ─────────────────────────────── tiers ───────────────────────────────
// The profiles, the Auto pick and the GPU-name hint live in ./quality.ts
// (no three.js), so the Settings screen and the scenes read the same table.

/** The GPU's own name, where the browser gives it (Chrome, Safari, Firefox all do in 2026). */
export function gpuName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  try {
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const s = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    return String(s ?? "");
  } catch { return ""; }
}

/** After a scene makes its renderer: save the GPU's name, so Auto knows it from the next visit. */
export function rememberGpu(renderer: THREE.WebGLRenderer) {
  try { noteGpu3d(gpuName(renderer.getContext())); } catch { /* fine */ }
}

/** Map a benchmark frame (ms for BENCH workload) to a tier. Thresholds reasoned, see benchmarkGpu. */
export function tierFromBenchMs(ms: number): Quality3d {
  if (ms <= 6) return "high";
  if (ms <= 16) return "medium";
  return "low";
}

/**
 * A short, fixed GPU workload: 48 lit standard-material spheres filling a
 * 512x512 target, drawn 6 times, timed with a pixel read so the GPU has to
 * finish. Not used to pick the tier (that has to happen before the renderer
 * exists, see ./quality.ts); kept for the Test Area and measuring.
 */
export function benchmarkGpu(T: Three, renderer: THREE.WebGLRenderer): number {
  const rt = new T.WebGLRenderTarget(512, 512, { depthBuffer: true });
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xffffff, 0x404040, 1));
  const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(3, 5, 2); scene.add(sun);
  const geo = new T.SphereGeometry(0.5, 32, 16);
  const mat = new T.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.4, metalness: 0.2 });
  for (let i = 0; i < 48; i++) {
    const m = new T.Mesh(geo, mat);
    m.position.set((i % 8) - 3.5, Math.floor(i / 8) - 2.5, -(i % 3));
    scene.add(m);
  }
  const cam = new T.PerspectiveCamera(60, 1, 0.1, 50); cam.position.set(0, 0, 6);
  const px = new Uint8Array(4);
  const prevTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  const times: number[] = [];
  try {
    for (let i = 0; i < 8; i++) {
      const a = performance.now();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px);
      if (i >= 2) times.push(performance.now() - a); // the first two compile and upload
    }
  } finally {
    renderer.setRenderTarget(prevTarget);
    rt.dispose(); geo.dispose(); mat.dispose();
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

/** The tier to open a scene at (Settings -> Look -> "3D quality", else Auto from the device). */
export function resolveQuality3d(): Quality3d { return quality3dTier(); }

/** Forget the saved GPU name (Auto then reads from the device alone until a scene reads it again). */
export function resetAutoQuality3d() { try { localStorage.removeItem(QUALITY3D_AUTO_KEY); } catch { /* fine */ } }

// ──────────────────────── dynamic resolution ────────────────────────

/**
 * Holds a frame budget by moving the render scale (pixel ratio) in steps.
 * Measured (harness, software renderer): pixel cost is close to linear in
 * pixel count, so 1.5 → 1.0 is ~2.2× fewer pixels.
 *
 * It reads the time between frames (what the player feels), not the CPU
 * time of render() — on a phone the GPU time shows up there. Down fast
 * (0.5 s of slow frames), up slow (4 s of fast ones), and an up-step that
 * immediately had to come back down is not retried for 15 s (then 30, 60 …
 * up to 4 min), so it never
 * flickers between two sizes.
 */
export class DynamicResolution {
  scale: number;
  private emaMs = 16.7;
  private slowMs = 0;
  private fastMs = 0;
  private last = 0;
  private lockUntil = 0;
  private lastUpAt = -1e9;
  private backoffMs = 15000;
  private readonly budgetMs: number;
  constructor(
    /** The renderer, or anything that takes the scale (the garden and the shop pass their own setter). */
    private renderer: Pick<THREE.WebGLRenderer, "setPixelRatio">,
    private prof: Pick<TierProfile, "maxPixelRatio" | "minPixelRatio" | "fpsCap">,
    private opts: { step?: number; onChange?: (pixelRatio: number) => void; devicePixelRatio?: number } = {},
  ) {
    // the frame rate we try to hold: 90% of the cap (54 fps at 60, 27 at 30)
    this.budgetMs = 1000 / (prof.fpsCap * 0.9);
    this.scale = Math.min(prof.maxPixelRatio, opts.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1));
    renderer.setPixelRatio(this.scale);
  }
  /** Stop judging (the scene is resting at a lower frame rate on purpose); the next frame() starts afresh. */
  pause() { this.last = 0; this.slowMs = 0; this.fastMs = 0; this.emaMs = this.budgetMs; }
  /** Call once per drawn frame with performance.now() (or the rAF time). */
  frame(now: number) {
    if (this.last === 0) { this.last = now; return; }
    const dt = Math.min(250, now - this.last);
    this.last = now;
    this.emaMs += (dt - this.emaMs) * 0.15;
    const step = this.opts.step ?? 0.25;
    const dpr = this.opts.devicePixelRatio ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const ceil = Math.min(this.prof.maxPixelRatio, dpr);
    if (this.emaMs > this.budgetMs * 1.15) { this.slowMs += dt; this.fastMs = 0; }
    // "fast" = holding the cap. A phone at its screen rate can never look
    // faster than that, so climbing is a probe: try a step up, and step
    // straight back (and wait longer each time) if it was too much.
    else if (this.emaMs < this.budgetMs * 0.97) { this.fastMs += dt; this.slowMs = 0; }
    else { this.slowMs = 0; this.fastMs = 0; }
    if (this.slowMs > 500 && this.scale > this.prof.minPixelRatio) {
      if (now - this.lastUpAt < 2000) { this.lockUntil = now + this.backoffMs; this.backoffMs = Math.min(240000, this.backoffMs * 2); } // that up-step was too much
      this.set(Math.max(this.prof.minPixelRatio, this.scale - step));
      this.slowMs = 0;
    } else if (this.fastMs > 4000 && this.scale < ceil && now > this.lockUntil) {
      this.set(Math.min(ceil, this.scale + step));
      this.lastUpAt = now;
      this.fastMs = 0;
    }
  }
  private set(s: number) {
    if (Math.abs(s - this.scale) < 1e-3) return;
    this.scale = s;
    this.renderer.setPixelRatio(s); // setPixelRatio re-applies the current size
    this.emaMs = this.budgetMs; // judge the new size on its own frames
    this.opts.onChange?.(s);
  }
}

// ───────────────────────── one shared renderer ─────────────────────────

interface Shared { renderer: THREE.WebGLRenderer; antialias: boolean; owner: number; pending: THREE.Object3D[]; flushTimer: ReturnType<typeof setTimeout> | null }
let shared: Shared | null = null;
let ownerSeq = 0;

/**
 * The one WebGL renderer every 3D scene draws with. A new context per scene
 * costs a context creation, a fresh shader cache and — after ~16 visits on
 * some browsers — "too many active WebGL contexts", which silently kills the
 * oldest. This keeps one, moves its canvas into the scene's container and
 * resets the state a scene may have changed.
 *
 * release(root) hides the canvas and disposes `root`'s geometries,
 * materials and textures — but LATE: on the next acquire, after that
 * scene's warmUp, or after 3 s. So the shaders both scenes use are still
 * compiled when the next scene asks for them.
 */
export function acquireRenderer(T: Three, container: HTMLElement, prof: Pick<TierProfile, "antialias" | "maxPixelRatio">): { renderer: THREE.WebGLRenderer; release: (root?: THREE.Object3D | null) => void } {
  installFrameMeter();
  if (shared && (shared.antialias !== prof.antialias || shared.renderer.getContext().isContextLost())) dropSharedRenderer();
  if (!shared) {
    const renderer = new T.WebGLRenderer({ antialias: prof.antialias, powerPreference: "high-performance" });
    shared = { renderer, antialias: prof.antialias, owner: 0, pending: [], flushTimer: null };
  }
  const s = shared;
  const r = s.renderer;
  const me = ++ownerSeq;
  s.owner = me;
  // three's defaults, so no scene inherits another's look
  r.setAnimationLoop(null);
  r.setRenderTarget(null);
  r.outputColorSpace = T.SRGBColorSpace;
  r.toneMapping = T.NoToneMapping;
  r.toneMappingExposure = 1;
  r.shadowMap.enabled = false;
  r.shadowMap.type = T.PCFShadowMap;
  r.shadowMap.autoUpdate = true;
  r.shadowMap.needsUpdate = false;
  r.setClearColor(0x000000, 1);
  r.autoClear = true;
  r.localClippingEnabled = false;
  r.setPixelRatio(Math.min(prof.maxPixelRatio, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1));
  const c = r.domElement;
  c.style.display = "block";
  c.style.width = "100%";
  c.style.height = "100%";
  c.style.touchAction = "none";
  container.appendChild(c);
  return {
    renderer: r,
    release: (root) => {
      if (!shared || shared.renderer !== r) { if (root) disposeObject3D(root); return; }
      if (shared.owner === me) {
        r.setAnimationLoop(null);
        c.remove();
      }
      if (root) {
        shared.pending.push(root);
        if (shared.flushTimer) clearTimeout(shared.flushTimer);
        shared.flushTimer = setTimeout(flushReleased, 3000);
      }
    },
  };
}

/** Dispose what released scenes left behind. warmUp calls it after compiling the next scene. */
export function flushReleased() {
  if (!shared) return;
  if (shared.flushTimer) { clearTimeout(shared.flushTimer); shared.flushTimer = null; }
  const roots = shared.pending.splice(0);
  for (const root of roots) disposeObject3D(root);
  shared.renderer.renderLists.dispose();
}

/** Throw the shared context away (leaving 3D for a long time; a lost context). */
export function dropSharedRenderer() {
  if (!shared) return;
  flushReleased();
  const r = shared.renderer;
  shared = null;
  r.setAnimationLoop(null);
  r.domElement.remove();
  r.dispose();
  r.forceContextLoss();
}

/** True while a shared renderer is alive (for tests and the Test Area). */
export const hasSharedRenderer = () => !!shared;

/** Free everything under `root`: geometries, materials, every texture a material holds (uniforms too), skeleton textures. */
export function disposeObject3D(root: THREE.Object3D, keep?: Set<unknown>) {
  const seen = new Set<unknown>();
  const free = (x: { dispose?: () => void } | null | undefined) => {
    if (!x || seen.has(x) || keep?.has(x)) return;
    seen.add(x);
    x.dispose?.();
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh & THREE.SkinnedMesh;
    if (m.geometry) free(m.geometry);
    if ((m as THREE.SkinnedMesh).isSkinnedMesh) free(m.skeleton as unknown as { dispose: () => void });
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mt of mats) {
      for (const v of Object.values(mt)) if (v && (v as THREE.Texture).isTexture) free(v as THREE.Texture);
      const u = (mt as THREE.ShaderMaterial).uniforms;
      if (u) for (const val of Object.values(u)) if (val?.value && (val.value as THREE.Texture).isTexture) free(val.value as THREE.Texture);
      free(mt);
    }
  });
  const sc = root as THREE.Scene;
  if (sc.isScene) {
    if (sc.environment) free(sc.environment);
    if (sc.background && (sc.background as THREE.Texture).isTexture) free(sc.background as THREE.Texture);
  }
}

// ───────────────────────── warm-up and preload ─────────────────────────

/**
 * Before the first frame: upload every texture and compile every shader,
 * so the first second doesn't hitch. Uses compileAsync (parallel shader
 * compile — KHR_parallel_shader_compile — where the phone has it; it does
 * on Chrome Android and Safari 17+, reasoned from the extension tables).
 * includeHidden: also compile things hidden at the start (a car swapped in
 * later, the pen before the signing) — they would hitch when first shown.
 * Set the scene's lights and shadow settings BEFORE calling (the shaders
 * depend on them).
 */
export async function warmUp(T: Three, renderer: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, opts: { includeHidden?: boolean; timeoutMs?: number; prime?: boolean } = {}) {
  const hidden: THREE.Object3D[] = [];
  if (opts.includeHidden) scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  try {
    const seen = new Set<THREE.Texture>();
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      const mats = Array.isArray(m) ? m : m ? [m] : [];
      for (const mt of mats) for (const v of Object.values(mt)) {
        if (v && (v as THREE.Texture).isTexture && !seen.has(v as THREE.Texture)) { seen.add(v as THREE.Texture); renderer.initTexture(v as THREE.Texture); }
      }
    });
    // safeCompileAsync, not renderer.compileAsync: three's own can throw on
    // a timer and never settle (a material that lost its program), which left
    // the garden on its spinner (safeCompile.ts).
    const t = opts.timeoutMs ?? 8000;
    const job = safeCompileAsync(renderer, scene, camera, t);
    await Promise.race([job, new Promise((r) => setTimeout(r, t))]);
    // One real draw of a single pixel: links the programs, builds the
    // shadow-map shaders (compile() skips those), uploads the skinning
    // data — the rest of the first frame's cost — while the cover is up.
    if (opts.prime !== false) {
      const sc = renderer.getScissor(new T.Vector4());
      const test = renderer.getScissorTest();
      renderer.setScissorTest(true);
      renderer.setScissor(0, 0, 1, 1);
      try { renderer.render(scene, camera); } finally { renderer.setScissor(sc); renderer.setScissorTest(test); }
    }
  } finally {
    for (const o of hidden) o.visible = false;
  }
  flushReleased();
}

const bufCache = new Map<string, Promise<ArrayBuffer>>();

/** The files each scene loads first (its loading-cover wait). Keep in step with the scenes. */
export const SCENE_ASSETS: Record<"garden" | "shop" | "office" | "signing" | "casino", string[]> = {
  garden: ["/star/garden3d/props.glb", "/star/onebody/player.glb", "/star/people3d/anims.glb", "/star/shop3d/draco/draco_decoder.wasm", "/star/shop3d/draco/draco_wasm_wrapper.js"],
  shop: ["/star/onebody/player.glb", "/star/people3d/anims.glb", "/star/shop3d/draco/draco_decoder.wasm", "/star/shop3d/draco/draco_wasm_wrapper.js"],
  office: ["/star/onebody/manager.glb", "/star/onebody/player.glb", "/star/people3d/anims.glb", "/star/signing3d/room-golden-hour.webp"],
  signing: ["/star/onebody/manager.glb", "/star/onebody/player.glb", "/star/people3d/anims.glb", "/star/signing3d/room-golden-hour.webp"],
  // the casino room is all primitives and canvas paint: only you to load
  casino: ["/star/onebody/player.glb", "/star/people3d/anims.glb"],
};

/** Should we spend the player's data on files they may not open? Not on Save-Data or 2G. */
export function preloadAllowed(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (c?.saveData) return false;
  if (c?.effectiveType && /(^|-)2g$/.test(c.effectiveType)) return false;
  return true;
}

/** Download files now (low priority, when the page is idle) and keep them in memory for loadGltfCached. */
export function prefetch3d(urls: string[]) {
  for (const url of urls) {
    if (bufCache.has(url)) continue;
    const p = fetch(url, { priority: "low" } as RequestInit).then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.arrayBuffer(); });
    p.catch(() => bufCache.delete(url)); // a failed prefetch just falls back to a normal load
    // Only models are read back from memory; the decoder files just warm the browser cache.
    if (!url.endsWith(".glb")) p.then(() => bufCache.delete(url), () => {});
    bufCache.set(url, p);
  }
}

/**
 * Call from a screen that leads to a 3D scene (dashboard, a shop button's
 * screen): downloads the scene's files while the player reads, and loads
 * the three.js code itself, once the page is idle. Free if already done;
 * skipped on Save-Data / 2G.
 */
export function preloadScene(name: keyof typeof SCENE_ASSETS) {
  if (typeof window === "undefined" || !preloadAllowed()) return;
  const go = () => {
    prefetch3d(SCENE_ASSETS[name]);
    void import("three");
    void import("three/examples/jsm/loaders/GLTFLoader.js");
  };
  const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(go, { timeout: 3000 }); else setTimeout(go, 1500);
}

/** loader.loadAsync, but from the prefetch cache when preloadScene got there first. */
export async function loadGltfCached<G = unknown>(loader: { loadAsync(url: string): Promise<unknown>; parseAsync?(data: ArrayBuffer, path: string): Promise<unknown> }, url: string): Promise<G> {
  const p = bufCache.get(url);
  if (p && loader.parseAsync) {
    try {
      const buf = await p;
      bufCache.delete(url); // parsed once; the browser cache has it for the next visit
      return (await loader.parseAsync(buf, url.slice(0, url.lastIndexOf("/") + 1))) as G;
    } catch { /* fall through to a normal load */ }
  }
  return (await loader.loadAsync(url)) as G;
}

// ─────────────────────── render on demand / fps cap ───────────────────────

/**
 * Decides whether this rAF tick should draw. Continuous scenes (the garden
 * while you walk) use only the cap; fixed-camera scenes (the office between
 * lines) also skip frames when nothing moved — call invalidate() when
 * something animates or the camera changes.
 */
export class FrameGate {
  private dirty = 2;
  private lastDraw = -1e9;
  constructor(private opts: { fpsCap?: number; continuous?: boolean } = {}) {}
  invalidate(frames = 1) { this.dirty = Math.max(this.dirty, frames); }
  setCap(fps: number) { this.opts.fpsCap = fps; }
  shouldRender(now: number, changed = false): boolean {
    if (changed) this.invalidate();
    if (!this.opts.continuous && this.dirty <= 0) return false;
    const cap = this.opts.fpsCap ?? 60;
    // a 2 ms slack so a 60 Hz rAF still draws every other tick at a 30 cap
    if (cap < 60 && now - this.lastDraw < 1000 / cap - 2) return false;
    this.lastDraw = now;
    if (this.dirty > 0) this.dirty--;
    return true;
  }
}

/** Has the camera moved since `memo` (pass the same array every call)? */
export function cameraMoved(camera: THREE.Camera, memo: number[]): boolean {
  camera.updateMatrixWorld();
  const e = camera.matrixWorld.elements;
  const p = (camera as THREE.PerspectiveCamera).projectionMatrix.elements;
  let moved = memo.length !== 32;
  for (let i = 0; i < 16; i++) {
    if (Math.abs((memo[i] ?? NaN) - e[i]) > 1e-6 || Math.abs((memo[16 + i] ?? NaN) - p[i]) > 1e-6) moved = true;
    memo[i] = e[i]; memo[16 + i] = p[i];
  }
  return moved;
}

// ────────────────────────────── the big wins ──────────────────────────────

/**
 * Merge every static mesh under `root` that shares a material into ONE mesh
 * (world transforms baked in). Static = not skinned, not instanced, not
 * marked userData.dynamic, and with the same attribute set as its group.
 * Pass three's own mergeGeometries (three/examples/jsm/utils/BufferGeometryUtils.js).
 * Returns draw calls before/after for this subtree.
 */
export function mergeStaticByMaterial(
  T: Three,
  mergeGeometries: (gs: THREE.BufferGeometry[], useGroups?: boolean) => THREE.BufferGeometry | null,
  root: THREE.Object3D,
  opts: { filter?: (m: THREE.Mesh) => boolean; minGroup?: number } = {},
): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  let before = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    before++;
    if ((m as unknown as THREE.SkinnedMesh).isSkinnedMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    if (m.userData?.dynamic || !m.visible || (opts.filter && !opts.filter(m))) return;
    const attrs = Object.keys(m.geometry.attributes).sort().join(",") + (m.geometry.index ? "|i" : "|n");
    const key = `${(m.material as THREE.Material).uuid}|${attrs}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${m.renderOrder}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  });
  let removed = 0;
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  for (const list of Array.from(groups.values())) {
    if (list.length < (opts.minGroup ?? 2)) continue;
    const geos = list.map((m) => {
      const g = m.geometry.clone();
      g.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, m.matrixWorld));
      return g;
    });
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const one = new T.Mesh(merged, list[0].material);
    one.castShadow = list[0].castShadow; one.receiveShadow = list[0].receiveShadow; one.renderOrder = list[0].renderOrder;
    one.name = `merged:${list[0].name || (list[0].material as THREE.Material).type}`;
    root.add(one);
    for (const m of list) { m.removeFromParent(); }
    removed += list.length - 1;
  }
  return { before, after: before - removed };
}

/**
 * Turn meshes that share BOTH geometry and material into one InstancedMesh
 * per pair (fence posts, chairs, bottles, crowd seats). Same static rules
 * as mergeStaticByMaterial. Cheaper than merging when the repeats are many
 * and big (one copy of the vertices on the GPU).
 */
export function instanceRepeats(T: Three, root: THREE.Object3D, minCount = 4): number {
  root.updateMatrixWorld(true);
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material) || m.userData?.dynamic) return;
    const key = `${m.geometry.uuid}|${(m.material as THREE.Material).uuid}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  });
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  let made = 0;
  for (const list of Array.from(groups.values())) {
    if (list.length < minCount) continue;
    const im = new T.InstancedMesh(list[0].geometry, list[0].material, list.length);
    list.forEach((m, i) => im.setMatrixAt(i, new T.Matrix4().multiplyMatrices(inv, m.matrixWorld)));
    im.castShadow = list[0].castShadow; im.receiveShadow = list[0].receiveShadow;
    im.computeBoundingSphere();
    root.add(im);
    list.forEach((m) => m.removeFromParent());
    made++;
  }
  return made;
}

/**
 * A KTX2 (Basis) texture loader on the given renderer, for GLBs whose
 * textures are converted to KTX2: ~4-8× less GPU memory than PNG/WebP once
 * uploaded (they stay compressed on the GPU; a 1024² colour map is 4 MB as
 * RGBA, ~0.7-1 MB as ETC1S/ASTC — reasoned from the formats' bit rates).
 * Copy node_modules/three/examples/jsm/libs/basis/ to public/star/three/basis/.
 */
export async function makeKTX2Loader(renderer: THREE.WebGLRenderer, transcoderPath = "/star/three/basis/") {
  const { KTX2Loader } = await import("three/examples/jsm/loaders/KTX2Loader.js");
  const l = new KTX2Loader();
  l.setTranscoderPath(transcoderPath);
  l.detectSupport(renderer);
  return l;
}

/**
 * FROZEN SHADOWS — the cheap version of baked lighting. The sun's shadow
 * map is drawn ONCE with only the things that never move casting (walls,
 * trees, the shop, benches), then never again; people and animals keep the
 * blob shadow the garden already gives them. Measured (harness): skipping
 * the per-frame shadow pass cut the garden's frame 18% (GPU, same-page A/B)
 * and the page's own render() time 15% (CPU, 4× slowed). Call again
 * (refreshShadows) after anything static moves or the sun changes.
 */
export function freezeStaticShadows(renderer: THREE.WebGLRenderer, scene: THREE.Object3D) {
  scene.traverse((o) => {
    let moving = !!o.userData?.dynamic;
    for (let p: THREE.Object3D | null = o; p && !moving; p = p.parent) if ((p as THREE.SkinnedMesh).isSkinnedMesh || (p as THREE.Bone).isBone) moving = true;
    if (moving && (o as THREE.Mesh).isMesh) o.castShadow = false;
  });
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true; // drawn on the next render, then held
}
/** Redraw a frozen shadow map once (a static thing moved; the sky changed). */
export function refreshShadows(renderer: THREE.WebGLRenderer) { renderer.shadowMap.needsUpdate = true; }

/**
 * Bake a picture of `obj` (a team-mate on the bench, a crowd member) from
 * the camera's side, and return a flat card that faces the camera on Y only
 * — 2 triangles and no skinning instead of a full body. Re-bake when the
 * camera swings more than ~30° round it, or keep a few angles.
 */
export function bakeImpostor(T: Three, renderer: THREE.WebGLRenderer, obj: THREE.Object3D, viewFrom: THREE.Vector3, opts: { size?: number; scene?: THREE.Scene } = {}): THREE.Mesh {
  const size = opts.size ?? 256;
  const box = new T.Box3().setFromObject(obj);
  const centre = box.getCenter(new T.Vector3());
  const dims = box.getSize(new T.Vector3());
  const h = Math.max(dims.y, Math.hypot(dims.x, dims.z)) * 1.05;
  const cam = new T.OrthographicCamera(-h / 2, h / 2, h / 2, -h / 2, 0.01, 100);
  const dir = new T.Vector3().subVectors(viewFrom, centre).setY(0).normalize();
  cam.position.copy(centre).addScaledVector(dir, 20);
  cam.lookAt(centre);
  const rt = new T.WebGLRenderTarget(size, size, { colorSpace: T.SRGBColorSpace });
  const stage = opts.scene ?? new T.Scene();
  const parent = obj.parent;
  const own = !opts.scene;
  if (own) { stage.add(new T.HemisphereLight(0xffffff, 0x444444, 2)); stage.add(obj); }
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearAlpha();
  renderer.setClearAlpha(0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(stage, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearAlpha(prevClear);
  if (own && parent) parent.add(obj);
  const card = new T.Mesh(new T.PlaneGeometry(h, h), new T.MeshBasicMaterial({ map: rt.texture, transparent: true, alphaTest: 0.4, depthWrite: true }));
  card.position.copy(centre);
  card.lookAt(new T.Vector3(viewFrom.x, centre.y, viewFrom.z));
  card.userData.impostorTarget = rt; // dispose with the card
  return card;
}
