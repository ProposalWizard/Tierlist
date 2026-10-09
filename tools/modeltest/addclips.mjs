// Copies named mocap clips onto a fitted player GLB by bone (node) name, the way
// three.js plays them in the game (model test only).
// node tools/modeltest/addclips.mjs <player.glb> <mocap.glb> <out.glb> <toolsDir> run,kick_r,...
import { createRequire } from "module";
const [, , dst0, mocap, out, tools, names] = process.argv;
const req = createRequire(tools + "/package.json");
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(dst0);
const src = await io.read(mocap);
const want = new Set(names.split(","));
const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
const buf = doc.getRoot().listBuffers()[0];
let missing = new Set();
for (const a of src.getRoot().listAnimations()) {
  if (!want.has(a.getName())) continue;
  const na = doc.createAnimation(a.getName());
  for (const ch of a.listChannels()) {
    const tn = ch.getTargetNode()?.getName();
    const node = byName.get(tn);
    if (!node) { missing.add(tn); continue; }
    const s = ch.getSampler();
    const inp = doc.createAccessor().setArray(s.getInput().getArray().slice()).setType("SCALAR").setBuffer(buf);
    const o = s.getOutput();
    const outp = doc.createAccessor().setArray(o.getArray().slice()).setType(o.getType()).setBuffer(buf);
    const ns = doc.createAnimationSampler().setInput(inp).setOutput(outp).setInterpolation(s.getInterpolation());
    na.addSampler(ns);
    na.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(ch.getTargetPath()).setSampler(ns));
  }
  console.log("clip", a.getName(), na.listChannels().length, "channels");
}
if (missing.size) console.log("missing nodes", [...missing].join(","));
await io.write(out, doc);
