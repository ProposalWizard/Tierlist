// node info.mjs a.glb b.glb ...  → triangles, textures, materials
import { createRequire } from "node:module";
const require = createRequire(process.env.GLTOOLS ? process.env.GLTOOLS + "/x.js" : import.meta.url);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { MeshoptDecoder } = require("meshoptimizer");
const draco3d = require("draco3dgltf");
const sharp = require("sharp");
import fs from "node:fs";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "draco3d.decoder": await draco3d.createDecoderModule() });
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const r = doc.getRoot();
  let tris = 0;
  for (const m of r.listMeshes()) for (const p of m.listPrimitives()) { const i = p.getIndices(); tris += (i ? i.getCount() : p.getAttribute("POSITION").getCount()) / 3; }
  const tex = [];
  for (const t of r.listTextures()) { const im = t.getImage(); let wh = "?"; try { const md = await sharp(Buffer.from(im)).metadata(); wh = `${md.width}x${md.height}`; } catch {} tex.push(`${t.getMimeType()} ${wh} ${(im.byteLength / 1024).toFixed(0)}KB`); }
  const mats = r.listMaterials().map((m) => `${m.getName()} rough=${m.getRoughnessFactor()} metal=${m.getMetallicFactor()} mr=${!!m.getMetallicRoughnessTexture()} n=${!!m.getNormalTexture()}`);
  console.log(`${f.split("/").pop()}  ${(fs.statSync(f).size / 1024).toFixed(0)}KB  tris=${tris}  meshes=${r.listMeshes().length}\n   tex: ${tex.join(" | ")}\n   mats: ${mats.join(" | ")}`);
}
