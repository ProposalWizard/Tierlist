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

if (problems.length) {
  console.error("FAIL safeCompile\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("ok safeCompile — a failed or stuck shader warm-up always finishes");
