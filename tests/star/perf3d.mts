import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  DynamicResolution, FrameGate, cameraMoved, tierFromBenchMs, tierHintFromGpu, TIER_PROFILES,
  mergeStaticByMaterial, instanceRepeats, disposeObject3D,
} from "../../lib/star/three3d/perf";

/**
 * THE SHARED 3D PERFORMANCE LAYER (lib/star/three3d/perf.ts) — the parts
 * that need no GPU: the render-scale controller, the frame gate, the tier
 * picks, and the scene-graph helpers (merge, instance, dispose).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── DynamicResolution: down fast on slow frames, up slowly, never past the tier's limits ──
{
  let pr = 0;
  const fake = { setPixelRatio: (v: number) => { pr = v; } } as unknown as T.WebGLRenderer;
  const prof = TIER_PROFILES.medium;
  const dyn = new DynamicResolution(fake, prof, { devicePixelRatio: 3 });
  check(pr === 1.5, `starts at the tier ceiling (1.5), got ${pr}`);
  let t = 1000;
  for (let i = 0; i < 40; i++) { t += 60; dyn.frame(t); } // 16 fps for 2.4 s
  check(pr < 1.5 && pr >= prof.minPixelRatio, `slow frames lower the scale (got ${pr})`);
  for (let i = 0; i < 400; i++) { t += 60; dyn.frame(t); }
  check(pr === prof.minPixelRatio, `never below the floor ${prof.minPixelRatio} (got ${pr})`);
  const low = pr;
  for (let i = 0; i < 150; i++) { t += 16.7; dyn.frame(t); } // 2.5 s of fast frames
  check(pr === low, `does not climb back within 4 s (got ${pr})`);
  for (let i = 0; i < 2000; i++) { t += 16.7; dyn.frame(t); }
  check(pr === 1.5, `fast frames climb back to the ceiling (got ${pr})`);
}

// ── an up-step that has to come straight back down is not retried for 15 s ──
{
  let pr = 0, changes = 0;
  const fake = { setPixelRatio: (v: number) => { pr = v; changes++; } } as unknown as T.WebGLRenderer;
  const dyn = new DynamicResolution(fake, { maxPixelRatio: 2, minPixelRatio: 0.5, fpsCap: 60 }, { devicePixelRatio: 2 });
  let t = 1000;
  // a phone that can hold 60 fps only at 1.0: slow above it, fast at or below it
  for (let i = 0; i < 6000; i++) { t += pr > 1 ? 40 : 16.7; dyn.frame(t); }
  check(changes < 12, `no flicker between two sizes (${changes} changes in ${(t / 1000).toFixed(0)} s)`);
  check(pr <= 1.25, `settles at a size it can hold (got ${pr})`);
}

// ── FrameGate ──
{
  const g = new FrameGate({ fpsCap: 30 });
  let drawn = 0;
  for (let i = 0; i < 120; i++) { if (g.shouldRender(i * 16.67, true)) drawn++; }
  check(drawn >= 58 && drawn <= 62, `a 30 cap draws every other 60 Hz tick (drew ${drawn}/120)`);
  const still = new FrameGate({ fpsCap: 60 });
  let n = 0;
  for (let i = 0; i < 60; i++) if (still.shouldRender(i * 16.67)) n++;
  check(n === 2, `render-on-demand: nothing moved → only the first frames draw (drew ${n})`);
  still.invalidate();
  check(still.shouldRender(2000), "invalidate() draws again");
  const cam = new T.PerspectiveCamera();
  const memo: number[] = [];
  check(cameraMoved(cam, memo), "first look counts as moved");
  check(!cameraMoved(cam, memo), "a still camera is not moved");
  cam.position.x = 0.5;
  check(cameraMoved(cam, memo), "a moved camera is moved");
}

// ── tiers ──
check(tierFromBenchMs(3) === "high" && tierFromBenchMs(10) === "medium" && tierFromBenchMs(40) === "low", "bench ms → tier");
check(tierHintFromGpu("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))") === "low", "SwiftShader is low");
check(tierHintFromGpu("Mali-T880") === "low", "old Mali is low");
check(tierHintFromGpu("Adreno (TM) 740") === "high", "Adreno 740 is high");
check(tierHintFromGpu("Apple GPU") === null, "iPhones are left to the benchmark");
check(TIER_PROFILES.low.fpsCap === 30 && !TIER_PROFILES.low.shadows, "low tier: 30 fps, no shadows");

// ── mergeStaticByMaterial: one draw per material, same picture ──
{
  const root = new T.Scene();
  const a = new T.MeshStandardMaterial(), b = new T.MeshStandardMaterial();
  const geo = new T.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 10; i++) { const m = new T.Mesh(geo, i % 2 ? a : b); m.position.set(i, 0, 0); root.add(m); }
  const moving = new T.Mesh(geo, a); moving.userData.dynamic = true; root.add(moving);
  const res = mergeStaticByMaterial(T, mergeGeometries, root);
  let meshes = 0; root.traverse((o) => { if ((o as T.Mesh).isMesh) meshes++; });
  check(res.before === 11 && res.after === 3 && meshes === 3, `11 meshes → 2 merged + 1 dynamic (got ${res.before}→${res.after}, ${meshes} in scene)`);
  const box = new T.Box3().setFromObject(root);
  check(Math.abs(box.min.x + 0.5) < 1e-6 && Math.abs(box.max.x - 9.5) < 1e-6, "merged geometry keeps every box where it was");
}

// ── instanceRepeats ──
{
  const root = new T.Group();
  const mat = new T.MeshStandardMaterial(), geo = new T.CylinderGeometry(0.1, 0.1, 1);
  for (let i = 0; i < 12; i++) { const m = new T.Mesh(geo, mat); m.position.set(i, 0, 0); root.add(m); }
  const made = instanceRepeats(T, root, 4);
  check(made === 1 && root.children.length === 1 && (root.children[0] as T.InstancedMesh).count === 12, "12 fence posts → one InstancedMesh");
}

// ── disposeObject3D frees geometry, materials and their textures once each ──
{
  const root = new T.Scene();
  const tex = new T.Texture();
  let texFreed = 0, matFreed = 0, geoFreed = 0;
  tex.addEventListener("dispose", () => texFreed++);
  const mat = new T.MeshStandardMaterial({ map: tex, normalMap: tex });
  mat.addEventListener("dispose", () => matFreed++);
  const geo = new T.BoxGeometry();
  geo.addEventListener("dispose", () => geoFreed++);
  root.add(new T.Mesh(geo, mat), new T.Mesh(geo, mat));
  disposeObject3D(root);
  check(texFreed === 1 && matFreed === 1 && geoFreed === 1, `each thing freed once (tex ${texFreed}, mat ${matFreed}, geo ${geoFreed})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the shared 3D layer: render scale holds the budget without flicker, the frame gate caps and skips, merges and instances keep the picture");
