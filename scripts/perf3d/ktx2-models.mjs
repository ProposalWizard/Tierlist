// PACKED PICTURES FOR THE PEOPLE AND THE STAR PASS GLASSES (lag pass 4, 9 Oct 2026).
//
// The same job as tools/shop3d/ktx2_items.mjs (the shop's items), for a fixed
// list of other models: the one bodies and the human. Each gets a twin beside it, `<name>.ktx2.glb`,
// whose pictures are KTX2 (KHR_texture_basisu): colour maps as ETC1S (sRGB),
// normal maps and data maps (Style A's kit mask rides in the occlusion slot) as
// UASTC + Zstandard, which keeps them exact enough for the shader's lines. On
// the phone's graphics chip they stay packed (ASTC / ETC2 / BC): about a
// quarter of the memory of a WebP, which is unpacked to full RGBA there.
// Geometry, clips and extras (the people's userData) are copied as they are.
//
// Nothing on the page reads these pictures' pixels (checked 9 Oct 2026: the
// kit, skin and hair are recoloured in the shader; engineView's matchSizedMap
// copies a head's colour map at match size only when it is a plain picture,
// and leaves a packed one as it is). The game loads the twin when the phone
// can read KTX2 and the plain file on any failure (lib/star/three3d/ktx2.ts,
// loadModel3d).
//
// Tools (kept out of the project's packages; install them anywhere):
//   npm i --prefix /some/dir ktx2-encoder@0.6.0 sharp@0.33.5 @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer
//   KIB_TOOLS=/some/dir node scripts/perf3d/ktx2-models.mjs            every listed model whose twin is missing or older
//   KIB_TOOLS=/some/dir node scripts/perf3d/ktx2-models.mjs --force    all of them
// Then: node scripts/perf3d/asset-versions.mjs (the new files' hashes). A new
// model: add it to MODELS here, to KTX2_MODELS in lib/star/three3d/ktx2.ts and
// a POLICY skip line in scripts/perf3d/shrink-models.mjs.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Paths under public/. Keep in step with KTX2_MODELS (lib/star/three3d/ktx2.ts). */
// Not the Style A heads (ETC1S tinted the skin grey-blue on a still pair; UASTC made a head 920 KB)
// and not yet the Star Pass glasses (no still checked): see lib/star/three3d/ktx2.ts.
export const MODELS = [
  ...["player", "player-buzz", "player-long", "manager"].map((n) => `star/onebody/${n}.glb`),
  "star/human3d/human.glb",
];

const here = new URL(".", import.meta.url).pathname;
const PUB = path.join(here, "../../public");
const toolsDir = process.env.KIB_TOOLS;
if (!toolsDir) { console.error("set KIB_TOOLS to a folder with the tools installed (see the header)"); process.exit(1); }
const imp = async (name) => {
  const pkgDir = path.join(path.resolve(toolsDir), "node_modules", name);
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  let entry = pkg.exports?.["."] ?? pkg.module ?? pkg.main;
  if (entry && typeof entry === "object") entry = entry.node?.import ?? entry.import ?? entry.default ?? entry.node ?? entry.require;
  if (entry && typeof entry === "object") entry = entry.import ?? entry.default;
  return import(pathToFileURL(path.join(pkgDir, entry ?? "index.js")).href);
};
const { NodeIO } = await imp("@gltf-transform/core");
const { ALL_EXTENSIONS, KHRTextureBasisu } = await imp("@gltf-transform/extensions");
const { MeshoptDecoder, MeshoptEncoder } = await imp("meshoptimizer");
const { encodeToKTX2 } = await imp("ktx2-encoder");
const sharp = (await imp("sharp")).default;
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const force = process.argv.includes("--force");
// --only=toon-p1: just the models whose path holds this (a try); KTX2_Q / KTX2_RDO: colour quality (230) / UASTC RDO (1)
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const slotsOf = (doc, tex) => {
  const out = new Set();
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getBaseColorTexture() === tex || m.getEmissiveTexture() === tex) out.add("color");
    if (m.getNormalTexture() === tex) out.add("normal");
    if (m.getMetallicRoughnessTexture() === tex || m.getOcclusionTexture() === tex) out.add("data");
  }
  return out;
};
let before = 0, after = 0, gpuWebp = 0, gpuKtx = 0;
for (const rel of MODELS.filter((m) => !only || m.includes(only))) {
  const src = path.join(PUB, rel), out = src.replace(/\.glb$/, ".ktx2.glb");
  if (!fs.existsSync(src)) { console.log(`missing ${rel}`); continue; }
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) { console.log(`up to date ${rel}`); continue; }
  const t0 = Date.now();
  const doc = await io.read(src);
  for (const t of doc.getRoot().listTextures()) {
    if (t.getMimeType() === "image/ktx2") continue;
    const kinds = slotsOf(doc, t);
    // a picture used as colour AND as a normal/data map is packed the careful way (UASTC)
    const color = kinds.has("color") && !kinds.has("normal") && !kinds.has("data");
    const normal = kinds.has("normal");
    const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    gpuWebp += info.width * info.height * 4 * 1.333;
    if (info.width % 4 || info.height % 4) { console.log(`  kept ${t.getName() || "map"} ${info.width}x${info.height} (not a multiple of 4)`); gpuKtx += info.width * info.height * 4 * 1.333; continue; }
    gpuKtx += info.width * info.height * 1 * 1.333;
    const k = await encodeToKTX2(new Uint8Array(data), {
      type: 1, imageDecoder: async () => ({ width: info.width, height: info.height, data: new Uint8Array(data) }),
      isUASTC: !color, qualityLevel: +(process.env.KTX2_Q || 230), compressionLevel: 2, needSupercompression: !color,
      isPerceptual: color, isKTX2File: true, isSetKTX2SRGBTransferFunc: color, generateMipmap: true,
      isNormalMap: normal, isYFlip: false, enableRDO: !color, rdoQualityLevel: +(process.env.KTX2_RDO || 1),
    });
    t.setImage(new Uint8Array(k)).setMimeType("image/ktx2");
  }
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === "EXT_texture_webp") e.dispose();
  await io.write(out, doc);
  before += fs.statSync(src).size; after += fs.statSync(out).size;
  console.log(`${rel}: ${(fs.statSync(src).size / 1024) | 0} KB → ${(fs.statSync(out).size / 1024) | 0} KB (${Date.now() - t0} ms)`);
}
if (before) console.log(`files ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
if (gpuWebp) console.log(`pictures on the chip, these models: ${(gpuWebp / 1048576) | 0} MB as WebP → ~${(gpuKtx / 1048576) | 0} MB as KTX2`);
