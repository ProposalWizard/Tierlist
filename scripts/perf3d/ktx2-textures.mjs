// KTX2 copies of the big 3D colour pictures (9 Oct 2026, lag pass 2).
//
// A WebP is small to download but is unpacked to full RGBA on the phone's
// graphics chip: a 1536×860 crowd is ~7 MB there. The same picture as KTX2
// (Basis ETC1S) stays packed on the chip (~1 byte a pixel or less), so the
// 3D places hold ~4× less picture memory. Each .ktx2 sits beside its WebP;
// the game tries the .ktx2 and falls back to the WebP if anything fails
// (lib/star/three3d/ktx2.ts).
//
// Only COLOUR maps whose sides are multiples of 4 (block-compressed formats
// need that on some desktop chips); normal and data maps stay WebP (ETC1S
// is poor at them, and they are small).
//
//   npm i --no-save ktx2-encoder@0.6.0 sharp@0.33.5
//   node scripts/perf3d/ktx2-textures.mjs            every file in LIST (skips ones already newer than their source)
//   node scripts/perf3d/ktx2-textures.mjs --force    re-encode all
import fs from "node:fs";
import path from "node:path";

const pub = path.join(new URL(".", import.meta.url).pathname, "../../public/star");
/** The colour maps, by folder. ETC1S quality 0-255 (higher = closer to the source, bigger file). */
export const LIST = [
  "h3d/crowd.webp", "h3d/sky-day.webp", "h3d/sky-golden.webp", "h3d/sky-night.webp", "h3d/grass-col.webp",
  "garden3d/h/bark.webp", "garden3d/h/leaves.webp", "garden3d/h/needles.webp", "garden3d/h/paving.webp", "garden3d/h/straw.webp", "garden3d/h/blooms.webp",
  "shop3d/h/parquet.webp", "shop3d/h/planks.webp",
];
const QUALITY = 255;

let encodeToKTX2, sharp;
try {
  ({ encodeToKTX2 } = await import("ktx2-encoder"));
  sharp = (await import("sharp")).default;
} catch {
  console.error("needs: npm i --no-save ktx2-encoder@0.6.0 sharp@0.33.5");
  process.exit(1);
}
const force = process.argv.includes("--force");
for (const rel of LIST) {
  const src = path.join(pub, rel), out = src.replace(/\.(webp|png|jpe?g)$/i, ".ktx2");
  if (!fs.existsSync(src)) { console.log(`missing ${rel}`); continue; }
  if (!force && fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) { console.log(`up to date ${rel}`); continue; }
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width % 4 || info.height % 4) { console.log(`skipped ${rel}: ${info.width}x${info.height} is not a multiple of 4`); continue; }
  const t = Date.now();
  const k = await encodeToKTX2(new Uint8Array(data), {
    type: 1, imageDecoder: async () => ({ width: info.width, height: info.height, data: new Uint8Array(data) }),
    isUASTC: false, qualityLevel: QUALITY, compressionLevel: 2, isPerceptual: true, generateMipmap: true,
    // three draws a WebP with flipY; a KTX2 is uploaded as stored, so store it bottom row first
    isYFlip: true,
  });
  fs.writeFileSync(out, k);
  console.log(`${rel} ${info.width}x${info.height}: webp ${(fs.statSync(src).size / 1024).toFixed(0)} KB → ktx2 ${(k.length / 1024).toFixed(0)} KB (${Date.now() - t} ms)`);
}
