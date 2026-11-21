// node tools/mocap3d/merge_clips.mjs <base.glb> <extra.glb> [out.glb]
// Put every clip of extra.glb into base.glb by name (a clip of the same name is
// replaced), with its measured moments (scene extras clips[name]). Both files
// must be cut for the same skeleton (same node names, same hipsY): build.py's
// output for one target. Used to add new clips (the Quaternius UAL set,
// clipdefs.py UAL_CLIPS) to mocap.glb without rebuilding every CMU clip:
//   python3 tools/mocap3d/build.py --cmu x --only <names> --out /tmp/new --no-shrink
//   node tools/mocap3d/merge_clips.mjs public/star/anims3d/mocap.glb /tmp/new/mocap.glb
//   node scripts/perf3d/shrink-models.mjs star/anims3d/mocap.glb   (then settle_clips.mts on the people file)
// Tools: SHRINK_TOOLS=<dir> as scripts/perf3d/shrink-models.mjs.
import { createRequire } from "node:module";
import path from "node:path";
const req = (() => {
  for (const dir of [process.env.SHRINK_TOOLS, new URL("../../", import.meta.url).pathname].filter(Boolean)) {
    const r = createRequire(path.join(path.resolve(dir), "noop.js"));
    try { r.resolve("@gltf-transform/core"); return r; } catch { /* next */ }
  }
  console.error("Missing tools: npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer (or SHRINK_TOOLS=<dir>)");
  process.exit(1);
})();
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { MeshoptDecoder, MeshoptEncoder } = req("meshoptimizer");
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const [basePath, extraPath, outPath = basePath] = process.argv.slice(2);
const base = await io.read(basePath);
const extra = await io.read(extraPath);
const bs = base.getRoot().listScenes()[0], es = extra.getRoot().listScenes()[0];
const bx = bs.getExtras() ?? {}, ex = es.getExtras() ?? {};
if (bx.hipsY && ex.hipsY && Math.abs(bx.hipsY - ex.hipsY) > 1e-4) { console.error("different skeletons: hipsY", bx.hipsY, ex.hipsY); process.exit(1); }
const byName = new Map(base.getRoot().listNodes().map((n) => [n.getName(), n]));
const buf = base.getRoot().listBuffers()[0];
// a packed file's keys may be normalized integers (meshopt filters): read them back as floats
const floats = (acc) => {
  const a = acc.getArray();
  if (!acc.getNormalized() || a instanceof Float32Array) return new Float32Array(a);
  const max = a instanceof Int8Array ? 127 : a instanceof Uint8Array ? 255 : a instanceof Int16Array ? 32767 : a instanceof Uint16Array ? 65535 : 1;
  return Float32Array.from(a, (v) => Math.max(v / max, -1));
};
const added = [];
for (const a of extra.getRoot().listAnimations()) {
  for (const old of base.getRoot().listAnimations()) if (old.getName() === a.getName()) old.dispose();
  const na = base.createAnimation(a.getName());
  for (const ch of a.listChannels()) {
    const tn = byName.get(ch.getTargetNode().getName());
    if (!tn) { console.error("no node", ch.getTargetNode().getName()); process.exit(1); }
    const s = ch.getSampler();
    const inp = base.createAccessor().setType("SCALAR").setArray(floats(s.getInput())).setBuffer(buf);
    const out = base.createAccessor().setType(s.getOutput().getType()).setArray(floats(s.getOutput())).setBuffer(buf);
    const ns = base.createAnimationSampler().setInput(inp).setOutput(out).setInterpolation(s.getInterpolation());
    na.addSampler(ns);
    na.addChannel(base.createAnimationChannel().setTargetNode(tn).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
  added.push(a.getName());
}
bs.setExtras({ ...bx, clips: { ...(bx.clips ?? {}), ...(ex.clips ?? {}) } });
// written unpacked: scripts/perf3d/shrink-models.mjs then packs the whole file (it skips a file already packed)
for (const e of base.getRoot().listExtensionsUsed()) if (e.extensionName === "EXT_meshopt_compression") e.dispose();
await io.write(outPath, base);
console.log("merged", added.length, "clips into", outPath, added.join(","));
