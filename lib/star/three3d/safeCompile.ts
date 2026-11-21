/**
 * BUILD EVERY SHADER BEFORE THE FIRST FRAME — WITHOUT EVER HANGING THE SCENE.
 *
 * three.js's own `renderer.compileAsync` checks each material's program on a
 * timer. If a material has no program by then (it was disposed, swapped or
 * reset between two checks — the scene-savings pass and a released scene's
 * clean-up both do that) the check throws
 *   "Cannot read properties of undefined (reading 'isReady')"
 * inside a setTimeout, where no try/catch can see it, and the promise never
 * settles. With a lost graphics context the check never turns true either.
 * Either way `await renderer.compileAsync(...)` waits for ever and the scene
 * sits on its loading spinner (seen on about 3 garden loads in 10, 9 Oct 2026).
 *
 * This does the same job and always finishes: a material with no program is
 * skipped, a check that throws counts as done, and after `timeoutMs` it stops
 * waiting. Anything not built here is built on first use, as before.
 */
import type * as THREE from "three";

/** The bits of a WebGLRenderer this needs (a fake in the tests). */
export interface CompileRenderer {
  compile: (scene: THREE.Object3D, camera: THREE.Camera) => Set<unknown> | Iterable<unknown> | unknown;
  properties: { get: (o: unknown) => { currentProgram?: { isReady?: () => boolean } } | undefined };
  extensions?: { get: (name: string) => unknown };
}

export const SAFE_COMPILE_TIMEOUT_MS = 8000;

/** Longest stretch of shader building before the page gets a turn (ms). */
const FINISH_SLICE_MS = 12;

type Prog = { getUniforms?: () => unknown };
type Obj = THREE.Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean; isLight?: boolean; isSkinnedMesh?: boolean; isInstancedMesh?: boolean; isBatchedMesh?: boolean; material?: unknown; geometry?: { attributes?: Record<string, unknown>; morphAttributes?: Record<string, unknown[]> } };
/** A full renderer (render target and tone mapping can be put back for each piece). */
type FullRenderer = CompileRenderer & {
  compile: (scene: THREE.Object3D, camera: THREE.Camera, target?: THREE.Object3D | null) => unknown;
  getRenderTarget: () => unknown; setRenderTarget: (t: unknown) => void; toneMapping: number;
};

/**
 * NO PARALLEL COMPILE: BUILD THE SHADERS ONE AT A TIME, BETWEEN FRAMES
 * (speed fix 3, 20 Nov 2026; docs/research/speed-audit-2026-11-20.md items 1
 * and 3: Garden 7.8 s and House 2.1 s frozen, most of it the graphics driver
 * building every shader in ONE block on the first frame).
 *
 * Without KHR_parallel_shader_compile three.js marks a program "ready" at
 * once, and every shader the scene needs is built and waited for inside the
 * first frame. Here the scene is walked one object at a time: each object
 * whose material, in its kind of mesh, has not been seen yet is compiled on
 * its own (same lights and fog: the scene is the target, as in
 * renderer.compile), and its program's first use (WebGLProgram.getUniforms:
 * link check, uniform list) is done at once, so the driver finishes that one
 * shader now. The page gets a turn between pieces. Then the whole scene is
 * compiled as before, which now finds every program built. Same programs,
 * same picture: this only does, earlier and in pieces, what three.js's own
 * first draw does. The render target and tone mapping the caller had set when
 * it called are put back for every piece (they pick the shader variant).
 *
 * A phone WITH the extension (Chrome on Android, Safari 17+) never comes
 * here: its programs build in the background and are only asked "done yet?".
 */
async function compileInPieces(r: FullRenderer, scene: THREE.Object3D, camera: THREE.Camera, end: number): Promise<void> {
  const rt = r.getRenderTarget(), tm = r.toneMapping;
  const objs: Obj[] = [];
  const keys = new Set<string>();
  const hasLight = (o: THREE.Object3D): boolean => { let l = false; o.traverse((c) => { if ((c as Obj).isLight) l = true; }); return l; };
  scene.traverse((o0) => {
    const o = o0 as Obj;
    if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite) || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const g = o.geometry;
    const kind = `${o.isSkinnedMesh ? "s" : ""}${o.isInstancedMesh ? "i" : ""}${o.isBatchedMesh ? "b" : ""}${o.receiveShadow ? "r" : ""}|${g?.attributes ? Object.keys(g.attributes).sort().join(",") : ""}|${g?.morphAttributes ? Object.keys(g.morphAttributes).length : 0}`;
    let fresh = false;
    for (const m of mats) { const k = `${(m as { uuid?: string }).uuid}|${kind}`; if (!keys.has(k)) { keys.add(k); fresh = true; } }
    // a lamp inside it would be counted twice in a piece: left to the whole-scene compile
    if (fresh && !(o.children.length && hasLight(o))) objs.push(o);
  });
  const done = new Set<unknown>();
  let t0 = performance.now();
  for (const o of objs) {
    if (Date.now() >= end) return;
    const nowT = r.getRenderTarget(), nowTm = r.toneMapping;
    let mats: unknown = null;
    try {
      r.setRenderTarget(rt); r.toneMapping = tm;
      mats = r.compile(o, camera, scene);
    } catch { /* left to the whole-scene compile */ } finally { r.setRenderTarget(nowT); r.toneMapping = nowTm; }
    if (mats && typeof (mats as Iterable<unknown>)[Symbol.iterator] === "function") {
      for (const m of Array.from(mats as Iterable<unknown>)) {
        let prog: Prog | undefined;
        try { prog = r.properties.get(m)?.currentProgram as Prog | undefined; } catch { continue; }
        if (!prog || typeof prog.getUniforms !== "function" || done.has(prog)) continue;
        done.add(prog);
        try { prog.getUniforms(); } catch { /* left to its first draw, as before */ }
      }
    }
    if (performance.now() - t0 > FINISH_SLICE_MS) {
      await new Promise((res) => setTimeout(res, 0));
      t0 = performance.now();
    }
  }
}

/** Finish (first use) each program of these materials, once, with turns between slow ones. */
async function finishOneAtATime(r: CompileRenderer, materials: unknown[], end: number): Promise<void> {
  const seen = new Set<unknown>();
  let t0 = performance.now();
  for (const m of materials) {
    if (Date.now() >= end) return;
    let prog: Prog | undefined;
    try { prog = r.properties.get(m)?.currentProgram as Prog | undefined; } catch { continue; }
    if (!prog || typeof prog.getUniforms !== "function" || seen.has(prog)) continue;
    seen.add(prog);
    try { prog.getUniforms(); } catch { /* left to its first draw, as before */ }
    if (performance.now() - t0 > FINISH_SLICE_MS) {
      await new Promise((res) => setTimeout(res, 0));
      t0 = performance.now();
    }
  }
}

const isFull = (r: CompileRenderer): r is FullRenderer => {
  const f = r as Partial<FullRenderer>;
  return typeof f.getRenderTarget === "function" && typeof f.setRenderTarget === "function" && typeof f.toneMapping === "number";
};

export async function safeCompileAsync(
  renderer: THREE.WebGLRenderer | CompileRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  timeoutMs = SAFE_COMPILE_TIMEOUT_MS,
): Promise<void> {
  const r = renderer as unknown as CompileRenderer;
  const end = Date.now() + timeoutMs;
  let parallel = false;
  try { parallel = !!r.extensions && r.extensions.get("KHR_parallel_shader_compile") != null; } catch { /* treat as absent */ }
  const rt0 = !parallel && isFull(r) ? { t: r.getRenderTarget(), tm: r.toneMapping } : null;
  if (rt0) {
    try { await compileInPieces(r as FullRenderer, scene, camera, end - 500); } catch { /* the whole-scene compile below, as before */ }
  }
  let materials: unknown[];
  const nowT = rt0 ? (r as FullRenderer).getRenderTarget() : null, nowTm = rt0 ? (r as FullRenderer).toneMapping : 0;
  try {
    // after pieces, under the caller's render target and tone mapping as they were when it called
    if (rt0) { (r as FullRenderer).setRenderTarget(rt0.t); (r as FullRenderer).toneMapping = rt0.tm; }
    const out = r.compile(scene, camera);
    materials = out && typeof (out as Iterable<unknown>)[Symbol.iterator] === "function" ? Array.from(out as Iterable<unknown>) : [];
  } catch {
    return; // nothing compiled up front: built on first use
  } finally {
    if (rt0) { (r as FullRenderer).setRenderTarget(nowT); (r as FullRenderer).toneMapping = nowTm; }
  }
  // Without the parallel-compile extension a program reports ready at once
  // (three.js); with it, ask until each one is done.
  if (!parallel) await finishOneAtATime(r, materials, end);
  const pending = new Set(materials);
  const ready = (m: unknown): boolean => {
    try {
      const prog = r.properties.get(m)?.currentProgram;
      if (!prog || typeof prog.isReady !== "function") return true; // no program: nothing to wait for
      return !!prog.isReady();
    } catch {
      return true; // a check that fails never holds the scene up
    }
  };
  await new Promise<void>((resolve) => {
    const check = () => {
      pending.forEach((m) => { if (ready(m)) pending.delete(m); });
      if (pending.size === 0 || Date.now() >= end) { resolve(); return; }
      setTimeout(check, 10);
    };
    if (parallel) check(); else setTimeout(check, 10);
  });
}
