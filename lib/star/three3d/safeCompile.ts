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

export async function safeCompileAsync(
  renderer: THREE.WebGLRenderer | CompileRenderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  timeoutMs = SAFE_COMPILE_TIMEOUT_MS,
): Promise<void> {
  const r = renderer as unknown as CompileRenderer;
  let materials: unknown[];
  try {
    const out = r.compile(scene, camera);
    materials = out && typeof (out as Iterable<unknown>)[Symbol.iterator] === "function" ? Array.from(out as Iterable<unknown>) : [];
  } catch {
    return; // nothing compiled up front: built on first use
  }
  let parallel = false;
  try { parallel = !!r.extensions && r.extensions.get("KHR_parallel_shader_compile") != null; } catch { /* treat as absent */ }
  // Without the parallel-compile extension a program reports ready at once
  // (three.js); with it, ask until each one is done.
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
  const end = Date.now() + timeoutMs;
  await new Promise<void>((resolve) => {
    const check = () => {
      pending.forEach((m) => { if (ready(m)) pending.delete(m); });
      if (pending.size === 0 || Date.now() >= end) { resolve(); return; }
      setTimeout(check, 10);
    };
    if (parallel) check(); else setTimeout(check, 10);
  });
}
