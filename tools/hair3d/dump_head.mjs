#!/usr/bin/env node
/**
 * A Style A head file (public/star/people3d/toon-*.glb, meshopt-packed) → plain arrays the hair
 * builder (build_hair.py, Blender) and the head re-shaper (reshape_heads.mjs) can read:
 *   <out>/head.json   extras (meta), bone names, Head joint, counts
 *   <out>/pos.f32 nor.f32 uv.f32 idx.u32 mask.u8 (kit, skin, hair per vertex) whead.f32 (Head-bone weight)
 *   <out>/joints.u16 weights.f32 (4 per vertex, joints index head.json joints)
 *   <out>/color.png mask.png
 *   node tools/hair3d/dump_head.mjs public/star/people3d/toon-p3.glb OUT --tools=<dir with @gltf-transform, meshoptimizer, sharp>
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const [src, out] = args.filter((a) => !a.startsWith("--"));
const req = createRequire(path.join(path.resolve(opt("tools") ?? process.env.SHRINK_TOOLS ?? "."), "noop.js"));
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { MeshoptDecoder, MeshoptEncoder } = req("meshoptimizer");
const sharp = req("sharp");
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const extras = scene.getExtras();
const body = root.listNodes().find((n) => n.getName() === "Body");
const prim = body.getMesh().listPrimitives()[0];
const skin = body.getSkin();
const joints = skin.listJoints().map((j) => j.getName());
const q = extras.quant;
const n = prim.getAttribute("POSITION").getCount();
const el = (acc, i, k) => { const e = acc.getElement(i, []); return e[k]; };
const J4 = new Uint16Array(n * 4), W4 = new Float32Array(n * 4);
const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2), WH = new Float32Array(n);
const aP = prim.getAttribute("POSITION"), aN = prim.getAttribute("NORMAL"), aU = prim.getAttribute("TEXCOORD_0"), aJ = prim.getAttribute("JOINTS_0"), aW = prim.getAttribute("WEIGHTS_0");
const hi = joints.indexOf("Head");
for (let i = 0; i < n; i++) {
  const p = aP.getElement(i, []), nn = aN.getElement(i, []), u = aU.getElement(i, []), j = aJ.getElement(i, []), w = aW.getElement(i, []);
  for (let k = 0; k < 3; k++) P[i * 3 + k] = q ? p[k] * q.scale + q.offset[k] : p[k];
  const l = Math.hypot(...nn) || 1;
  for (let k = 0; k < 3; k++) N[i * 3 + k] = nn[k] / l;
  UV[i * 2] = u[0]; UV[i * 2 + 1] = u[1];
  const ws = w.reduce((a, b) => a + b, 0) || 1;
  for (let k = 0; k < 4; k++) { if (j[k] === hi) WH[i] += w[k] / ws; J4[i * 4 + k] = j[k]; W4[i * 4 + k] = w[k] / ws; }
}
const idx = Uint32Array.from(prim.getIndices().getArray());
fs.mkdirSync(out, { recursive: true });
const mat = prim.getMaterial();
const colorT = mat.getBaseColorTexture(), maskT = mat.getOcclusionTexture();
const M = new Uint8Array(n * 3);
if (maskT) {
  const { data, info } = await sharp(Buffer.from(maskT.getImage())).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < n; i++) {
    const x = Math.min(info.width - 1, Math.max(0, Math.floor(UV[i * 2] * info.width))), y = Math.min(info.height - 1, Math.max(0, Math.floor(UV[i * 2 + 1] * info.height)));
    for (let k = 0; k < 3; k++) M[i * 3 + k] = data[(y * info.width + x) * info.channels + k];
  }
  await sharp(Buffer.from(maskT.getImage())).png().toFile(path.join(out, "mask.png"));
}
await sharp(Buffer.from(colorT.getImage())).png().toFile(path.join(out, "color.png"));
const w = (f, a) => fs.writeFileSync(path.join(out, f), Buffer.from(a.buffer, a.byteOffset, a.byteLength));
w("pos.f32", P); w("nor.f32", N); w("uv.f32", UV); w("idx.u32", idx); w("mask.u8", M); w("whead.f32", WH); w("joints.u16", J4); w("weights.f32", W4);
fs.writeFileSync(path.join(out, "head.json"), JSON.stringify({ src, verts: n, tris: idx.length / 3, joints, extras, uvFlip: false }, null, 1));
console.log(`${src}: ${n} verts, ${idx.length / 3} tris, joints ${joints.length}; extras keys ${Object.keys(extras).join(", ")}`);
console.log(JSON.stringify({ face: extras.face, look: extras.look, joints: { Head: extras.joints?.Head, neck: extras.joints?.neck }, quant: q, model: extras.model }));
