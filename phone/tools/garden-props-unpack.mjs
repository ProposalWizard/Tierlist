/**
 * MAKES THE PHONE'S COPY OF A DRACO-PACKED 3D FILE (the garden's props, the cars).
 *
 *   node phone/tools/garden-props-unpack.mjs [/star/garden3d/props.glb /star/shop3d/items/car-1.glb ...]
 *
 * Some of the website's files are packed with Draco, which needs WebAssembly; the phone's
 * JavaScript engine (Hermes) has none. This opens each file in Chromium with the website's
 * own loader, writes the same scene out as a plain .glb (same parts, names, materials,
 * pictures), and puts it in phone/assets/3d/<same path>. Nothing else changes:
 * ./src/three/assets.ts reads that copy for the website's address. With no arguments: the
 * garden's files. (tools/three-check.ts knows these files differ from the website's.)
 * Needs: esbuild and Playwright's Chromium (as tools/three-check.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const PHONE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ROOT = path.join(PHONE, "..");
const tryResolve = (f) => { try { return f(); } catch { return null; } };
const esbuildAt = tryResolve(() => require.resolve("esbuild")) ?? tryResolve(() => require.resolve("esbuild", { paths: [ROOT] }))
  ?? (() => { const npx = path.join(process.env.HOME ?? "/root", ".npm/_npx"); for (const d of fs.existsSync(npx) ? fs.readdirSync(npx) : []) { const f = path.join(npx, d, "node_modules/esbuild"); if (fs.existsSync(f)) return f; } return null; })();
if (!esbuildAt) throw new Error("esbuild not found");
const esbuild = require(esbuildAt);
const { chromium } = require(require.resolve("playwright", { paths: [ROOT] }));
const chrome = (() => {
  for (const r of [process.env.PLAYWRIGHT_BROWSERS_PATH, "/opt/pw-browsers", path.join(process.env.HOME ?? "", ".cache/ms-playwright")].filter(Boolean)) {
    if (!fs.existsSync(r)) continue;
    for (const d of fs.readdirSync(r).filter((x) => x.startsWith("chromium-")).sort().reverse()) for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) { const f = path.join(r, d, sub); if (fs.existsSync(f)) return f; }
  }
  return null;
})();
const entry = `
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
window.convert = async (url) => {
  const draco = new DRACOLoader(); draco.setDecoderPath("/star/shop3d/draco/"); draco.setDecoderConfig({ type: "wasm" });
  const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
  const g = await loader.loadAsync(url);
  const buf = await new Promise((res, rej) => new GLTFExporter().parse(g.scene.children, res, rej, { binary: true, onlyVisible: false }));
  // the exporter writes every picture as PNG (ten times the size of the website's WebP): write them as WebP again
  const dv = new DataView(buf);
  const jl = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
  const binLen = dv.getUint32(20 + jl, true);
  const bin = new Uint8Array(buf, 20 + jl + 8, binLen);
  const swap = new Map();
  for (const im of json.images || []) {
    if (im.bufferView === undefined) continue;
    const bv = json.bufferViews[im.bufferView];
    const bmp = await createImageBitmap(new Blob([bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)], { type: im.mimeType }));
    const oc = new OffscreenCanvas(bmp.width, bmp.height);
    oc.getContext("2d").drawImage(bmp, 0, 0);
    swap.set(im.bufferView, new Uint8Array(await (await oc.convertToBlob({ type: "image/webp", quality: 0.85 })).arrayBuffer()));
    im.mimeType = "image/webp";
  }
  const parts = []; let off = 0;
  json.bufferViews.forEach((bv, i) => {
    const bytes = swap.get(i) || bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
    off = (off + 3) & ~3;
    parts.push({ at: off, bytes });
    bv.byteOffset = off; bv.byteLength = bytes.length;
    off += bytes.length;
  });
  const total = (off + 3) & ~3;
  json.buffers[0].byteLength = total;
  const nb = new Uint8Array(total); for (const p of parts) nb.set(p.bytes, p.at);
  const js = new TextEncoder().encode(JSON.stringify(json)); const jpad = (4 - (js.length % 4)) % 4;
  const jb = new Uint8Array(js.length + jpad).fill(0x20); jb.set(js);
  const out = new Uint8Array(12 + 8 + jb.length + 8 + total);
  const o = new DataView(out.buffer);
  o.setUint32(0, 0x46546c67, true); o.setUint32(4, 2, true); o.setUint32(8, out.length, true);
  o.setUint32(12, jb.length, true); o.setUint32(16, 0x4e4f534a, true); out.set(jb, 20);
  o.setUint32(20 + jb.length, total, true); o.setUint32(24 + jb.length, 0x004e4942, true); out.set(nb, 28 + jb.length);
  let s = ""; for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.subarray(i, i + 8192));
  return btoa(s);
};`;
const out = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: "js" }, bundle: true, format: "iife", write: false, platform: "browser", nodePaths: [path.join(ROOT, "node_modules")] });
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error", e.message));
await page.route("http://kib.test/**", (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<html><body></body></html>" });
  const f = path.join(ROOT, "public", decodeURIComponent(u.pathname));
  return fs.existsSync(f) ? route.fulfill({ body: fs.readFileSync(f) }) : route.fulfill({ status: 404, body: "" });
});
await page.goto("http://kib.test/");
await page.addScriptTag({ content: out.outputFiles[0].text });
const files = process.argv.slice(2).length ? process.argv.slice(2) : [
  "/star/garden3d/props.glb",
  ...["car-1", "car-2", "car-suv", "car-3", "car-classic", "car-4"].map((n) => `/star/shop3d/items/${n}.glb`),
];
for (const url of files) {
  const b64 = await page.evaluate((u) => window.convert(u), url);
  const dest = path.join(PHONE, "assets/3d", url.replace(/^\/star\//, ""));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(b64, "base64"));
  console.log(`${url}: ${(fs.statSync(path.join(ROOT, "public", url)).size / 1024).toFixed(0)} KB -> ${(fs.statSync(dest).size / 1024).toFixed(0)} KB`);
}
await browser.close();
