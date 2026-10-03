/**
 * OFFLINE SPRITE BAKER — the small "simple clean modern 3D" match figures.
 *
 * Renders the rigged player and keeper models (GLB, not committed — 10 MB
 * each) from above with a slight tilt, in 8 facings (keeper 4), clip by clip,
 * into two atlases per character set:
 *   - a colour atlas (kit flattened to plain lit white, a 1 px dark outline
 *     at the game's size, boots dark), and
 *   - a mask atlas: red = shirt, green = shorts, blue = socks, so the game can
 *     tint any club's kit at runtime (lib/star/sprites.ts) and keep skin/hair.
 *
 * Run:   node tools/sprites/bake.mjs [assetDir] [--preview tilt,tilt…]
 * Needs: three (site package) and Playwright's Chromium (both already here).
 * Writes public/star/sprites/{atlas-*.webp,mask-*.png,index.json}.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const require = createRequire(import.meta.url);
const threeDir = path.resolve(path.dirname(require.resolve("three")), "..");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const assetDir = path.resolve(args.find((a) => !a.startsWith("--")) ?? process.env.SPRITE_ASSETS ?? ".");
const previewArg = args.indexOf("--preview");
const preview = previewArg >= 0 ? args[previewArg + 1] : null;
const outDir = path.join(root, "public/star/sprites");
const scratchOut = process.env.SPRITE_PREVIEW_OUT ?? path.join(here, "preview");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file;
  if (u.startsWith("/three/")) file = path.join(threeDir, u.slice(7));
  else if (u.startsWith("/assets/")) file = path.join(assetDir, u.slice(8));
  else file = path.join(here, u.slice(1) || "bake.html");
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  page.on("console", (m) => { if (m.type() === "log" || m.type() === "error") console.log("[page]", m.text()); });
  await page.goto(`http://127.0.0.1:${port}/bake.html`);
  await page.waitForFunction(() => window.bakerReady === true, null, { timeout: 60000 });
  const dataOf = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  if (preview) {
    fs.mkdirSync(scratchOut, { recursive: true });
    const res = await page.evaluate((p) => window.preview(p), preview);
    for (const [name, url] of Object.entries(res)) {
      fs.writeFileSync(path.join(scratchOut, name), dataOf(url));
      console.log("wrote", path.join(scratchOut, name));
    }
  } else {
    const t0 = Date.now();
    const res = await page.evaluate(() => window.bakeAll());
    fs.mkdirSync(outDir, { recursive: true });
    for (const f of fs.readdirSync(outDir)) if (/^(atlas|mask)-.*\.(webp|png)$/.test(f)) fs.unlinkSync(path.join(outDir, f));
    let total = 0;
    for (const [name, url] of Object.entries(res.files)) {
      const buf = dataOf(url);
      total += buf.length;
      fs.writeFileSync(path.join(outDir, name), buf);
      console.log(name, (buf.length / 1024).toFixed(0), "KB");
    }
    const idx = JSON.stringify(res.index);
    fs.writeFileSync(path.join(outDir, "index.json"), idx);
    total += idx.length;
    console.log("index.json", (idx.length / 1024).toFixed(0), "KB · total", (total / 1024).toFixed(0), "KB · frames", res.frames, "·", ((Date.now() - t0) / 1000).toFixed(0), "s");
  }
} finally {
  await browser.close();
  server.close();
}
