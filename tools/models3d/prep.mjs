// node prep.mjs in.glb out.glb maxTris   → welded, simplified to ≤ maxTris, textures ≤ 1024 px
import { createRequire } from "node:module";
const require = createRequire(process.env.GLTOOLS ? process.env.GLTOOLS + "/x.js" : import.meta.url);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { weld, simplify, prune, dedup } = require("@gltf-transform/functions");
const { MeshoptSimplifier, MeshoptDecoder } = require("meshoptimizer");
const sharp = require("sharp");
const [inp, out, maxS, texS] = process.argv.slice(2);
const TEX = Number(texS ?? 1024);
const maxTris = Number(maxS ?? 24000);
await MeshoptSimplifier.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(inp);
const r = doc.getRoot();
const count = () => { let t = 0; for (const m of r.listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? 0) / 3; return t; };
const t0 = count();
await doc.transform(weld(), dedup());
if (count() > maxTris) {
  let ratio = maxTris / count();
  for (let k = 0; k < 6 && count() > maxTris; k++) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: ratio * 0.97, error: Number(process.env.SIMPLIFY_ERR ?? 0.01), lockBorder: false }));
    ratio = maxTris / count();
  }
}
for (const t of r.listTextures()) {
  const img = sharp(Buffer.from(t.getImage()));
  const md = await img.metadata();
  if (md.width <= TEX && md.height <= TEX) continue;
  const png = t.getMimeType() === "image/png";
  const buf = await img.resize(TEX, TEX, { fit: "inside" })[png ? "png" : "jpeg"](png ? {} : { quality: 90 }).toBuffer();
  t.setImage(new Uint8Array(buf));
}
await doc.transform(prune());
await io.write(out, doc);
console.log(`${inp.split("/").pop()}: tris ${t0} → ${count()}`);
