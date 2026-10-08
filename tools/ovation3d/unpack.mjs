// Unpack a game GLB so Blender can read it: meshopt off, 16-bit positions
// back to metres (and the bind matrices with them), WebP textures to PNG.
//   node tools/ovation3d/unpack.mjs <in.glb> <out.glb> [--tools=<dir with the glTF packages>]
import { createRequire } from "node:module";
import path from "node:path";
const toolsArg = process.argv.find((a) => a.startsWith("--tools="))?.slice(8);
const req = createRequire(path.join(path.resolve(toolsArg || process.cwd()), "noop.js"));
const { NodeIO, VertexLayout } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { MeshoptDecoder } = req("meshoptimizer");
const sharp = req("sharp");
const [inp, out] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder }).setVertexLayout(VertexLayout.SEPARATE);
const doc = await io.read(inp);
const root = doc.getRoot();
for (const e of root.listExtensionsUsed()) if (/meshopt|quantization|texture_webp/i.test(e.extensionName)) e.dispose();
const q = root.getDefaultScene()?.getExtras()?.quant;
for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
  for (const sem of prim.listSemantics()) {
    const acc = prim.getAttribute(sem);
    const n = acc.getCount(), k = acc.getElementSize();
    const el = [];
    const isJoint = sem.startsWith("JOINTS");
    const arr = isJoint ? new Uint16Array(n * k) : new Float32Array(n * k);
    for (let i = 0; i < n; i++) { acc.getElement(i, el); for (let j = 0; j < k; j++) arr[i * k + j] = el[j]; }
    if (sem === "POSITION" && q) for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) arr[i * 3 + j] = arr[i * 3 + j] * q.scale + q.offset[j];
    if (sem === "NORMAL") for (let i = 0; i < n; i++) { const l = Math.hypot(arr[i*3],arr[i*3+1],arr[i*3+2]) || 1; for (let j = 0; j < 3; j++) arr[i*3+j] /= l; }
    if (sem.startsWith("WEIGHTS")) for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < 4; j++) s += arr[i*4+j]; for (let j = 0; j < 4; j++) arr[i*4+j] /= (s || 1); }
    const na = doc.createAccessor().setType(acc.getType()).setArray(arr).setBuffer(acc.getBuffer());
    prim.setAttribute(sem, na);
  }
}
// The bind matrices were made for the 16-bit positions: take that out too
// (as people3d.ts dequantize() does: boneInverse x D^-1).
if (q) for (const skin of root.listSkins()) {
  const acc = skin.getInverseBindMatrices();
  const a = acc.getArray().slice();
  const s = q.scale, o = q.offset;
  for (let m = 0; m < a.length / 16; m++) {
    const M = a.subarray(m * 16, m * 16 + 16); // column-major
    const out = new Float32Array(16);
    // D^-1 = scale 1/s, translate -o/s
    const Di = [1/s,0,0,0, 0,1/s,0,0, 0,0,1/s,0, -o[0]/s,-o[1]/s,-o[2]/s,1];
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let v = 0; for (let k = 0; k < 4; k++) v += M[k * 4 + r] * Di[c * 4 + k]; out[c * 4 + r] = v; }
    a.set(out, m * 16);
  }
  skin.setInverseBindMatrices(doc.createAccessor().setType("MAT4").setArray(a).setBuffer(acc.getBuffer()));
  root.getDefaultScene().setExtras({ ...root.getDefaultScene().getExtras(), quant: undefined, unpacked: true });
}
for (const tex of root.listTextures()) {
  if (tex.getMimeType() === "image/webp") { tex.setImage(await sharp(Buffer.from(tex.getImage())).png().toBuffer()); tex.setMimeType("image/png"); tex.setURI(tex.getURI().replace(/\.webp$/, ".png")); }
}
for (const acc of root.listAccessors()) if (!acc.listParents().some(p => p !== root)) acc.dispose();
await io.write(out, doc);
console.log("wrote", out);
