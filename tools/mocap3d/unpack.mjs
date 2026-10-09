// node unpack.mjs in.glb out.glb — drop meshopt compression + webp (Blender 4.0 can't read them)
import { createRequire } from "node:module";
import path from "node:path";
// the packing tools (npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer sharp),
// from the repo or SHRINK_TOOLS=<dir>, as scripts/perf3d/shrink-models.mjs
const req = (() => {
  for (const dir of [process.env.SHRINK_TOOLS, new URL("../../", import.meta.url).pathname].filter(Boolean)) {
    const r = createRequire(path.join(path.resolve(dir), "noop.js"));
    try { r.resolve("@gltf-transform/core"); return r; } catch { /* next */ }
  }
  console.error("Missing tools: npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer sharp (or SHRINK_TOOLS=<dir>)");
  process.exit(1);
})();
const { NodeIO, VertexLayout } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { MeshoptDecoder } = req("meshoptimizer");
const sharp = req("sharp");
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder }).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(process.argv[2]);
const quant = doc.getRoot().listScenes()[0].getExtras()?.quant;
for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
  for (const sem of ["POSITION", "NORMAL", "TEXCOORD_0"]) {
    const a = prim.getAttribute(sem);
    if (!a || a.getComponentType() === 5126) continue;
    const n = a.getCount(), k = a.getElementSize(), out = new Float32Array(n * k), el = [];
    for (let i = 0; i < n; i++) {
      a.getElement(i, el);
      for (let j = 0; j < k; j++) out[i * k + j] = sem === "POSITION" && quant ? el[j] * quant.scale + quant.offset[j] : el[j];
      if (sem === "NORMAL") { const l = Math.hypot(out[i*3], out[i*3+1], out[i*3+2]) || 1; for (let j = 0; j < 3; j++) out[i*3+j] /= l; }
    }
    a.setArray(out).setNormalized(false);
  }
}
// the inverse bind matrices were made for the 16-bit positions: fold the metres -> ints step in
if (quant) for (const skin of doc.getRoot().listSkins()) {
  const ibm = skin.getInverseBindMatrices();
  const arr = ibm.getArray().slice();
  const s = 1 / quant.scale, o = quant.offset;
  for (let m = 0; m < ibm.getCount(); m++) {
    const M = arr.subarray(m * 16, m * 16 + 16); // column-major
    const out = new Float32Array(16);
    // out = M · S, S = scale s, translate -o*s
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) out[c * 4 + r] = M[c * 4 + r] * s;
      out[12 + r] = M[12 + r] - s * (M[r] * o[0] + M[4 + r] * o[1] + M[8 + r] * o[2]);
    }
    arr.set(out, m * 16);
  }
  ibm.setArray(arr);
}
for (const ext of doc.getRoot().listExtensionsUsed()) {
  const n = ext.extensionName;
  if (n === "EXT_meshopt_compression" || n === "KHR_mesh_quantization") ext.dispose();
}
for (const tex of doc.getRoot().listTextures()) {
  if (tex.getMimeType() === "image/webp") {
    const png = await sharp(Buffer.from(tex.getImage())).png().toBuffer();
    tex.setImage(new Uint8Array(png)).setMimeType("image/png");
  }
}
for (const ext of doc.getRoot().listExtensionsUsed()) if (ext.extensionName === "EXT_texture_webp") ext.dispose();
await io.write(process.argv[3], doc);
console.log("ok", process.argv[3]);
