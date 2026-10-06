// SIZE TEST ONLY (writes to ./out, never to public/): what a GLB would weigh
// with meshopt geometry compression + resampled animation keys. Needs, outside
// package.json:  npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf
// Usage: node scripts/perf3d/squeeze.mjs star/onebody/player.glb star/people3d/anims.glb
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, resample, quantize, meshopt, prune } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import draco3d from "draco3dgltf";
import fs from "node:fs";
import path from "node:path";
const P = new URL("../../public", import.meta.url).pathname;
const files = process.argv.slice(2);
await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const deps = { "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder };
try { deps["draco3d.decoder"] = await draco3d.createDecoderModule(); } catch {}
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies(deps);
const OUT = new URL("./out/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
let a = 0, b = 0;
for (const f of files) {
  const src = path.join(P, f);
  const doc = await io.read(src);
  const hasDraco = doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === "KHR_draco_mesh_compression");
  if (hasDraco) doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === "KHR_draco_mesh_compression").dispose();
  await doc.transform(dedup(), prune(), resample({ tolerance: 1e-4 }), quantize(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  const out = path.join(OUT, f.replace(/\//g, "_"));
  await io.write(out, doc);
  const s0 = fs.statSync(src).size, s1 = fs.statSync(out).size;
  a += s0; b += s1;
  console.log(`${f.padEnd(34)} ${(s0 / 1024).toFixed(0).padStart(5)} KB → ${(s1 / 1024).toFixed(0).padStart(5)} KB${hasDraco ? " (was draco)" : ""}`);
}
console.log(`TOTAL ${(a / 1024).toFixed(0)} KB → ${(b / 1024).toFixed(0)} KB`);
