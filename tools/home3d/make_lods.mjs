// THE HOME'S LIGHT COPIES of the shop's generated cars and boots (9 Oct 2026).
// The 3D home shows your cars through the drive window and your boots on the
// wardrobe shelf, small and far off: a 23k-triangle car there is waste. This
// reads each shop file (already meshopt-packed), simplifies it to a few
// thousand triangles with 512 px textures, and writes it unpacked to
// public/star/home3d/; then scripts/perf3d/shrink-models.mjs packs it.
// No new models were generated: these are the shop's own (see its LICENSE.txt).
//
//   GLTOOLS=<dir with tools/models3d's node_modules> node tools/home3d/make_lods.mjs
//   node scripts/perf3d/shrink-models.mjs --tools=<same dir> star/home3d/<file>.glb ...
import { createRequire } from "node:module";
const require = createRequire(process.env.GLTOOLS ? process.env.GLTOOLS + "/x.js" : import.meta.url);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { weld, simplify, prune, dedup } = require("@gltf-transform/functions");
const { MeshoptSimplifier, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");
await MeshoptSimplifier.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const SRC = "public/star/shop3d/items/";
const OUT = "public/star/home3d/";
// [source, output, triangles]
const JOBS = [
  ...["family", "hatch", "suv", "sports", "classic", "super"].map((c) => [`car-${c}-hf.glb`, `car-${c}-lod.glb`, 4000]),
  ...["starter", "speed", "control", "elite", "classic", "maestro"].map((b) => [`boot-${b}-hf.glb`, `boot-${b}-lod.glb`, 2500]),
  ["boot-hf.glb", "boot-power-lod.glb", 2500],
  // the garage's motorbike and the jet out on the estate's lawn (Oct 2026)
  ["bike-hf.glb", "bike-lod.glb", 4000],
  ["jet-hf.glb", "jet-lod.glb", 4000],
];
// ONLY=bike-lod,jet-lod remakes just those
const ONLY = (process.env.ONLY ?? "").split(",").filter(Boolean);

for (const [src, out, maxTris] of JOBS) {
  if (ONLY.length && !ONLY.some((o) => out.startsWith(o))) continue;
  const doc = await io.read(SRC + src);
  const r = doc.getRoot();
  // written unpacked: shrink-models.mjs packs it again
  for (const e of r.listExtensionsUsed()) if (e.extensionName === "EXT_meshopt_compression") e.dispose();
  const count = () => { let t = 0; for (const m of r.listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? 0) / 3; return t; };
  const t0 = count();
  await doc.transform(weld(), dedup());
  let ratio = maxTris / count();
  for (let k = 0; k < 6 && count() > maxTris; k++) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: ratio * 0.97, error: 0.02, lockBorder: false }));
    ratio = maxTris / count();
  }
  for (const t of r.listTextures()) {
    const buf = await sharp(Buffer.from(t.getImage())).resize(512, 512, { fit: "inside" }).webp({ quality: 82 }).toBuffer();
    t.setImage(new Uint8Array(buf)); t.setMimeType("image/webp");
  }
  await doc.transform(prune());
  await io.write(OUT + out, doc);
  console.log(`${src} → ${out}: tris ${t0} → ${count()}`);
}
