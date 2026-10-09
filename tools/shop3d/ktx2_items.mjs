// PACKED PICTURES FOR THE 3D SHOP'S GENERATED ITEMS (speed job B, 9 Oct 2026).
//
// The shop's Higgsfield models (public/star/shop3d/items/*-hf.glb) carry three
// 1024 maps each as WebP. A WebP is unpacked to full RGBA on the phone's
// graphics chip: ~5.6 MB a map with its mipmaps, ~17 MB a model — the shop
// held ~377 MB of pictures (lag pass 3), the biggest memory risk on an iPhone.
// This writes a twin of each model beside it, `<name>-hf.ktx2.glb`, whose maps
// are KTX2 (KHR_texture_basisu): colour maps as ETC1S (high quality, sRGB),
// normal / roughness-metal / occlusion maps as UASTC + Zstandard (the format
// that keeps normals clean). On the chip they stay packed (ASTC / ETC2 / BC7,
// 1 byte a pixel or less): about a quarter of the memory. Same model, same
// look. The shop loads the twin when the phone can read KTX2 and falls back to
// the plain file on any failure (lib/star/shop3d/scene.ts, loadModel).
//
// Tools (kept out of the project's packages; install them anywhere):
//   npm i --prefix /some/dir ktx2-encoder@0.6.0 sharp@0.33.5 @gltf-transform/core@4 @gltf-transform/extensions@4 meshoptimizer
//   KIB_TOOLS=/some/dir node tools/shop3d/ktx2_items.mjs            every *-hf.glb whose twin is missing or older
//   KIB_TOOLS=/some/dir node tools/shop3d/ktx2_items.mjs --force    all of them
//   KIB_TOOLS=/some/dir node tools/shop3d/ktx2_items.mjs --inspect  sizes only
// Then: node scripts/perf3d/asset-versions.mjs (the new files' hashes).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const dirArg = process.argv.find((a) => a.startsWith("--dir="));
const dir = dirArg ? path.resolve(dirArg.slice(6)) : path.join(new URL(".", import.meta.url).pathname, "../../public/star/shop3d/items");
/** --etc1s: every map ETC1S (smallest files; normals a little softer). Default: colour ETC1S, the rest UASTC. */
const allEtc1s = process.argv.includes("--etc1s");
const toolsDir = process.env.KIB_TOOLS;
if (!toolsDir) { console.error("set KIB_TOOLS to a folder with the tools installed (see the header)"); process.exit(1); }
void createRequire;
const imp = async (name, sub = "") => {
  // ESM entry of a package installed in KIB_TOOLS
  const pkgDir = path.join(path.resolve(toolsDir), "node_modules", name);
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  let entry = sub ? pkg.exports?.[sub] : pkg.exports?.["."] ?? pkg.module ?? pkg.main;
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

const force = process.argv.includes("--force"), inspect = process.argv.includes("--inspect");
const slotsOf = (doc, tex) => {
  const out = new Set();
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getBaseColorTexture() === tex) out.add("color");
    if (m.getEmissiveTexture() === tex) out.add("color");
    if (m.getNormalTexture() === tex) out.add("normal");
    if (m.getMetallicRoughnessTexture() === tex || m.getOcclusionTexture() === tex) out.add("data");
  }
  return out;
};
let before = 0, after = 0, gpuWebp = 0, gpuKtx = 0;
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith("-hf.glb")).sort()) {
  const src = path.join(dir, f), out = src.replace(/\.glb$/, ".ktx2.glb");
  const doc = await io.read(src);
  const texs = doc.getRoot().listTextures();
  const sizes = [];
  for (const t of texs) {
    if (t.getMimeType() === "image/ktx2") continue;
    const m = await sharp(Buffer.from(t.getImage())).metadata();
    sizes.push(`${m.width}x${m.height}`);
    gpuWebp += m.width * m.height * 4 * 1.333;
    gpuKtx += m.width * m.height * 1 * 1.333;
  }
  if (inspect) { console.log(f, `${(fs.statSync(src).size / 1024) | 0} KB`, sizes.join(" ")); continue; }
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) { console.log(`up to date ${f}`); continue; }
  const t0 = Date.now();
  for (const t of texs) {
    if (t.getMimeType() === "image/ktx2") continue;
    const kinds = slotsOf(doc, t);
    const color = allEtc1s || (kinds.has("color") && !kinds.has("normal") && !kinds.has("data"));
    const normal = kinds.has("normal");
    const { data, info } = await sharp(Buffer.from(t.getImage())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width % 4 || info.height % 4) { console.log(`  kept ${t.getName() || "map"} ${info.width}x${info.height} (not a multiple of 4)`); continue; }
    const k = await encodeToKTX2(new Uint8Array(data), {
      type: 1, imageDecoder: async () => ({ width: info.width, height: info.height, data: new Uint8Array(data) }),
      isUASTC: !color, qualityLevel: 230, compressionLevel: 2, needSupercompression: !color,
      isPerceptual: color, isKTX2File: true, isSetKTX2SRGBTransferFunc: color, generateMipmap: true,
      isNormalMap: normal, isYFlip: false, enableRDO: !color, rdoQualityLevel: 1,
    });
    t.setImage(new Uint8Array(k)).setMimeType("image/ktx2");
  }
  doc.createExtension(KHRTextureBasisu).setRequired(true);
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === "EXT_texture_webp") e.dispose();
  await io.write(out, doc);
  before += fs.statSync(src).size; after += fs.statSync(out).size;
  console.log(`${f}: ${(fs.statSync(src).size / 1024) | 0} KB → ${(fs.statSync(out).size / 1024) | 0} KB (${Date.now() - t0} ms)`);
}
if (!inspect && before) console.log(`files ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
console.log(`pictures on the chip, every model at once: ${(gpuWebp / 1048576) | 0} MB as WebP → ~${(gpuKtx / 1048576) | 0} MB as KTX2`);
