/**
 * A FAILED SHADER WARM-UP NEVER BLOCKS A 3D SCENE.
 *
 * Bug (9 Oct 2026): about 3 garden loads in 10 stuck on the spinner with
 * "Cannot read properties of undefined (reading 'isReady')" inside three.js's
 * compileAsync — a material lost its program between two checks, the check
 * threw on a timer and the promise never settled. safeCompileAsync
 * (lib/star/three3d/safeCompile.ts) must always finish.
 */
import { safeCompileAsync, type CompileRenderer } from "../../lib/star/three3d/safeCompile";
import type * as THREE from "three";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const scene = {} as THREE.Object3D, camera = {} as THREE.Camera;

function fake(props: Map<unknown, { currentProgram?: { isReady?: () => boolean } } | undefined>, opts: { parallel?: boolean; compileThrows?: boolean } = {}): CompileRenderer {
  return {
    compile: () => { if (opts.compileThrows) throw new Error("context lost"); return new Set(props.keys()); },
    properties: { get: (m) => props.get(m) },
    extensions: { get: (n) => (n === "KHR_parallel_shader_compile" && opts.parallel ? {} : null) },
  };
}

async function finishes(label: string, r: CompileRenderer, timeoutMs: number, within: number) {
  const t0 = Date.now();
  let settled = false;
  const p = safeCompileAsync(r, scene, camera, timeoutMs).then(() => { settled = true; }, (e) => { problems.push(`${label}: rejected (${e})`); settled = true; });
  await Promise.race([p, new Promise((res) => setTimeout(res, within + 500))]);
  check(settled, `${label}: never finished`);
  check(Date.now() - t0 <= within + 400, `${label}: took ${Date.now() - t0} ms (allowed ${within})`);
}

// The exact crash: a material whose properties have no program.
{
  const props = new Map<unknown, { currentProgram?: { isReady?: () => boolean } } | undefined>([
    [{ id: 1 }, { currentProgram: { isReady: () => true } }],
    [{ id: 2 }, {}],          // no program — three's compileAsync throws here
    [{ id: 3 }, undefined],   // no properties at all
  ]);
  await finishes("material with no program (parallel compile)", fake(props, { parallel: true }), 5000, 300);
  await finishes("material with no program (no extension)", fake(props), 5000, 300);
}

// A check that throws counts as done.
{
  const props = new Map([[{}, { currentProgram: { isReady: () => { throw new Error("gl gone"); } } }]]);
  await finishes("isReady throws", fake(props, { parallel: true }), 5000, 300);
}

// A lost context: never ready — gives up at the timeout instead of waiting for ever.
{
  const props = new Map([[{}, { currentProgram: { isReady: () => false } }]]);
  await finishes("never ready", fake(props, { parallel: true }), 400, 400);
}

// compile itself throws: carry on at once.
await finishes("compile throws", fake(new Map(), { compileThrows: true }), 5000, 100);

// The ordinary case: waits until the programs are ready.
{
  let calls = 0;
  const props = new Map([[{}, { currentProgram: { isReady: () => ++calls >= 3 } }]]);
  await safeCompileAsync(fake(props, { parallel: true }), scene, camera, 5000);
  check(calls >= 3, `waits for a program that becomes ready (asked ${calls} times)`);
}

// No parallel compile (speed fix 3, 20 Nov 2026): each program's first use
// (getUniforms) is done before the first frame, once per program, and the page
// gets a turn between slow ones (never one block for every shader).
{
  const order: string[] = [];
  const prog = (name: string, ms: number) => ({ isReady: () => true, getUniforms: () => { order.push(name); const t = Date.now(); while (Date.now() - t < ms) { /* a slow driver */ } return {}; } });
  const shared = prog("shared", 0);
  const props = new Map<unknown, { currentProgram?: { isReady?: () => boolean } } | undefined>([
    [{ id: "a" }, { currentProgram: prog("a", 20) }],
    [{ id: "b" }, { currentProgram: shared }],
    [{ id: "c" }, { currentProgram: shared }], // two materials, one program: asked once
    [{ id: "d" }, { currentProgram: prog("d", 20) }],
    [{ id: "e" }, { currentProgram: { isReady: () => true, getUniforms: () => { throw new Error("lost"); } } }],
  ]);
  let turns = 0;
  let on = true;
  const tick = () => { if (!on) return; turns++; setTimeout(tick, 0); };
  setTimeout(tick, 0);
  await finishes("finishes each program (no extension)", fake(props), 5000, 400);
  on = false;
  check(order.join(",") === "a,shared,d", `each program's first use once, in order (got ${order.join(",")})`);
  check(turns >= 2, `the page got a turn between slow programs (${turns} turns)`);
  // with the extension: never asked for its first use here (built in the background)
  const asked: string[] = [];
  const props2 = new Map([[{}, { currentProgram: { isReady: () => true, getUniforms: () => { asked.push("x"); return {}; } } }]]);
  await finishes("parallel: only asks ready", fake(props2, { parallel: true }), 5000, 300);
  check(asked.length === 0, "with the extension, first use is left to the draw");
}

// A full renderer, no extension: built a piece at a time, each piece under the
// render target the caller had set WHEN IT CALLED (it puts its own back at once).
{
  const made = new Map<unknown, { currentProgram: { isReady: () => boolean; getUniforms: () => unknown } }>();
  const seenTargets: unknown[] = [];
  let target: unknown = "screen";
  const matA = { uuid: "A" }, matB = { uuid: "B" };
  const mesh = (m: unknown) => ({ isMesh: true, material: m, children: [] as unknown[], receiveShadow: false, geometry: { attributes: { position: 1 } }, traverse(f: (o: unknown) => void) { f(this); } });
  const meshes = [mesh(matA), mesh(matA), mesh(matB)];
  const root = { traverse(f: (o: unknown) => void) { f(root); meshes.forEach((m) => f(m)); }, children: meshes };
  const full = {
    compile: (s: { material?: unknown; traverse: (f: (o: unknown) => void) => void }) => {
      seenTargets.push(target);
      const out = new Set<unknown>();
      s.traverse((o) => { const m = (o as { material?: unknown }).material; if (m) { out.add(m); if (!made.has(m)) made.set(m, { currentProgram: { isReady: () => true, getUniforms: () => ({}) } }); } });
      return out;
    },
    properties: { get: (m: unknown) => made.get(m) },
    extensions: { get: () => null },
    getRenderTarget: () => target, setRenderTarget: (t: unknown) => { target = t; }, toneMapping: 4,
  };
  target = "picture";
  const job = safeCompileAsync(full as unknown as CompileRenderer, root as unknown as THREE.Object3D, camera, 5000);
  target = "screen"; full.toneMapping = 0; // the caller puts its own back straight away
  await job;
  check(seenTargets.length === 3, `one piece per new material, then the whole scene (got ${seenTargets.length} compiles)`);
  check(seenTargets.every((t) => t === "picture"), `every piece under the caller's target (${seenTargets.join(",")})`);
  check(target === "screen" && full.toneMapping === 0, "the caller's own target and tone mapping are left as it set them");
}

if (problems.length) {
  console.error("FAIL safeCompile\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("ok safeCompile — a failed or stuck shader warm-up always finishes");
