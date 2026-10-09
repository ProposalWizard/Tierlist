import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { MeshoptDecoder } = req("meshoptimizer");
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(process.argv[2]);
console.log("extras", JSON.stringify(doc.getRoot().listScenes()[0].getExtras()).slice(0, 300));
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) for (const s of p.listSemantics()) {
  const a = p.getAttribute(s);
  console.log(m.getName(), s, a.getComponentType(), a.getNormalized(), a.getCount(), JSON.stringify(a.getMin([])), JSON.stringify(a.getMax([])));
}
for (const n of doc.getRoot().listNodes().slice(0, 6)) console.log(n.getName(), n.getTranslation(), n.getScale(), !!n.getMesh(), !!n.getSkin());
