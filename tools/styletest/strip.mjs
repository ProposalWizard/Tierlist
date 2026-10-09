// Strips the vec3 custom attributes Blender's glTF importer cannot merge (look test only).
import { createRequire } from "module";
const [, , src, dst, tools] = process.argv;
const req = createRequire(tools + "/package.json");
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives())
  for (const s of p.listSemantics()) if (s === "_ANCHOR" || s === "_ANCHORW" || s === "_DEL") p.setAttribute(s, null);
const root = doc.getRoot();
console.log("extras", JSON.stringify(root.listMeshes().map((m) => [m.getName(), m.getExtras()]).slice(0, 3)).slice(0, 2000));
console.log("scene extras", JSON.stringify(root.listScenes()[0].getExtras()).slice(0, 3000));
await io.write(dst, doc);
