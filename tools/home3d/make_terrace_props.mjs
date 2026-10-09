// THE ESTATE TERRACE'S GARDEN PIECES (Oct 2026): the estate's garden terrace
// (lib/star/home3d/roomBuild.ts buildGardenTerrace) uses a few of the 3D
// garden's own CC0 props (public/star/garden3d/props.glb: Kenney, see its
// LICENSE.txt). That file is Draco and the home's loader has no Draco decoder,
// so this copies just the pieces the terrace places, decoded, to
// public/star/home3d/terrace-props.glb; then scripts/perf3d/shrink-models.mjs
// packs it with meshopt (its POLICY keeps floats: the terrace reads the vertices).
//
//   GLTOOLS=<dir with @gltf-transform, draco3dgltf> node tools/home3d/make_terrace_props.mjs
//   node scripts/perf3d/shrink-models.mjs --tools=<same dir> star/home3d/terrace-props.glb
import { createRequire } from "node:module";
const require = createRequire(process.env.GLTOOLS ? process.env.GLTOOLS + "/x.js" : import.meta.url);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const { prune, dedup } = require("@gltf-transform/functions");
const draco3d = require("draco3dgltf");

const KEEP = new Set(["hedge", "lantern", "potted_plant", "lounge_chair", "tree_oak", "bush_large", "fence_wood"]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "draco3d.decoder": await draco3d.createDecoderModule() });
const doc = await io.read("public/star/garden3d/props.glb");
const r = doc.getRoot();
for (const e of r.listExtensionsUsed()) if (e.extensionName === "KHR_draco_mesh_compression") e.dispose();
for (const scene of r.listScenes()) for (const n of scene.listChildren()) if (!KEEP.has(n.getName())) { scene.removeChild(n); n.dispose(); }
await doc.transform(prune(), dedup());
await io.write("public/star/home3d/terrace-props.glb", doc);
let tris = 0;
for (const m of r.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
console.log(`terrace-props.glb: ${r.listScenes()[0].listChildren().map((n) => n.getName()).join(", ")} — ${tris} triangles`);
