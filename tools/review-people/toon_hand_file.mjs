import { createRequire } from "module";
const [, , src, dst, tools] = process.argv;
const req = createRequire(tools + "/package.json");
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
for (const n of doc.getRoot().listNodes()) if (n.getName() === "Body") n.setName("Body.skin");
for (const m of doc.getRoot().listMeshes()) { if (m.getName()==="Body") m.setName("Body.skin"); for (const p of m.listPrimitives()) for (const s of p.listSemantics()) if (s.startsWith("_")) p.setAttribute(s, null); }
for (const m of doc.getRoot().listMaterials()) { m.setBaseColorTexture(null); m.setOcclusionTexture(null); }
await io.write(dst, doc);
