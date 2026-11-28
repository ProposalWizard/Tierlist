// THE WHEEL TOOL, step 1 of 3 (driving phase 1, 28 Nov 2026). Blender 4.0 cannot read the
// game's packed GLBs (meshopt geometry, WebP pictures), so this writes a plain copy first:
// meshopt decoded, WebP turned back into PNG, and (optionally) the mesh simplified to a
// triangle cap (the Family Car is 36k; the 3D rule is 25k).
//
//   GLTOOLS=<dir with tools/models3d's node_modules> node tools/cars/unpack.mjs in.glb out.glb [maxTris]
//
// Then: blender -b -P tools/cars/cut_wheels.py -- out.glb cut.glb ... (see run_all.sh).
import { createRequire } from "node:module";
const require = createRequire(process.env.GLTOOLS ? process.env.GLTOOLS + "/x.js" : import.meta.url);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { weld, simplify } = require("@gltf-transform/functions");
const { MeshoptDecoder, MeshoptSimplifier } = require("meshoptimizer");
const sharp = require("sharp");
await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const [src, out, cap] = process.argv.slice(2);
const doc = await io.read(src);
const root = doc.getRoot();
const tris = () => root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3, 0), 0);
const before = tris();
if (cap && before > Number(cap)) {
  // weld first (Tripo meshes come split per face), then simplify to the cap; UV seams are kept
  await doc.transform(weld({ tolerance: 0.0001 }), simplify({ simplifier: MeshoptSimplifier, ratio: (Number(cap) * 0.97) / before, error: 0.002, lockBorder: true }));
}
for (const e of root.listExtensionsUsed()) e.dispose();
for (const t of root.listTextures()) {
  if (t.getMimeType() !== "image/png" && t.getMimeType() !== "image/jpeg") t.setImage(await sharp(Buffer.from(t.getImage())).png().toBuffer()).setMimeType("image/png");
}
await io.write(out, doc);
console.log(JSON.stringify({ src, out, trisBefore: before, trisAfter: tris() }));
