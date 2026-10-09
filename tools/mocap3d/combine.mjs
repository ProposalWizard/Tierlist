// node combine.mjs body.glb anims.glb out.glb [names,comma]
// Body (unpacked) + the clips of anims.glb, retargeted by node name, hips translation
// scaled like people3d.ts does (body hips rest y / anims hipsY).
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
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder }).setVertexLayout(VertexLayout.SEPARATE);
const body = await io.read(process.argv[2]);
const anim = await io.read(process.argv[3]);
const only = process.argv[5] ? new Set(process.argv[5].split(",")) : null;
for (const a of body.getRoot().listAnimations()) a.dispose();
const byName = new Map(body.getRoot().listNodes().map((n) => [n.getName(), n]));
const hipsY = anim.getRoot().listScenes()[0].getExtras()?.hipsY;
const bodyHips = byName.get("Hips") ?? byName.get("pelvis");
const k = hipsY && bodyHips ? bodyHips.getTranslation()[1] / hipsY : 1;
const buf = body.getRoot().listBuffers()[0];
for (const a of anim.getRoot().listAnimations()) {
  if (only && !only.has(a.getName())) continue;
  const na = body.createAnimation(a.getName());
  for (const ch of a.listChannels()) {
    const tn = byName.get(ch.getTargetNode().getName());
    if (!tn) continue;
    const s = ch.getSampler();
    const inp = body.createAccessor().setType("SCALAR").setArray(new Float32Array(s.getInput().getArray())).setBuffer(buf);
    let arr = new Float32Array(s.getOutput().getArray());
    if (ch.getTargetPath() === "translation") arr = arr.map((v) => v * k);
    const out = body.createAccessor().setType(s.getOutput().getType()).setArray(arr).setBuffer(buf);
    const ns = body.createAnimationSampler().setInput(inp).setOutput(out).setInterpolation(s.getInterpolation());
    na.addSampler(ns);
    na.addChannel(body.createAnimationChannel().setTargetNode(tn).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
}
await io.write(process.argv[4], body);
console.log("ok", process.argv[4], "k", k);
