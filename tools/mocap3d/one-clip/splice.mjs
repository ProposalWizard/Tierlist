// splice one clip (and its scene-extras meta) from a fresh build into a committed clip file; writes UNPACKED
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const [target, source, out, clip] = process.argv.slice(2);
const doc = await io.read(target), src = await io.read(source);
const root = doc.getRoot(), buffer = root.listBuffers()[0];
const names = root.listAnimations().map((a) => a.getName());
const old = root.listAnimations().find((a) => a.getName() === clip);
const sa = src.getRoot().listAnimations().find((a) => a.getName() === clip);
if (!sa) throw new Error("clip not in source");
const na = doc.createAnimation(clip);
const cache = new Map();
// always float: a packed (normalized int) source is read back to real numbers first
const acc = (a) => {
  if (!cache.has(a)) {
    const n = a.getCount() * a.getElementSize(), f = new Float32Array(n), el = [];
    for (let i = 0; i < a.getCount(); i++) { a.getElement(i, el); for (let j = 0; j < el.length; j++) f[i * el.length + j] = el[j]; }
    cache.set(a, doc.createAccessor().setType(a.getType()).setArray(f).setBuffer(buffer));
  }
  return cache.get(a);
};
for (const c of sa.listChannels()) {
  const nm = c.getTargetNode().getName();
  const node = root.listNodes().find((n) => n.getName() === nm);
  if (!node) throw new Error("no node " + nm);
  const s = c.getSampler();
  const ns = doc.createAnimationSampler().setInput(acc(s.getInput())).setOutput(acc(s.getOutput())).setInterpolation(s.getInterpolation());
  na.addSampler(ns);
  na.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(c.getTargetPath()).setSampler(ns));
}
if (old) old.dispose();
// keep the old order: move the new one to where the old one was
const list = root.listAnimations();
const sc = root.listScenes()[0], ex = sc.getExtras(), sx = src.getRoot().listScenes()[0].getExtras();
if (Math.abs(ex.hipsY - sx.hipsY) > 1e-6) throw new Error("hipsY differs");
ex.clips[clip] = sx.clips[clip];
sc.setExtras(ex);
// drop the meshopt extension: shrink-models packs again
for (const e of root.listExtensionsUsed()) if (e.extensionName === "EXT_meshopt_compression") e.dispose();
await io.write(out, doc);
console.log(out, "clips", root.listAnimations().length, "was", names.length, "index", names.indexOf(clip), "->", root.listAnimations().findIndex((a) => a.getName() === clip));
