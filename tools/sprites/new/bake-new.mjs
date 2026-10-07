/**
 * THE ANIMATIONS: NEW 3D CLIPS — baker for the second sprite atlas.
 *
 * The first atlas (atlas-0) was baked by ../bake.mjs from GLB files that were
 * never committed. Leo, 7 Oct 2026: the baked man is the same person as
 * public/star/people3d/player.glb (checked frame by frame against atlas-0:
 * same body, hair, boots, poses from the shared anims.glb; within 1 px once
 * scaled by FIT below). So the new clips are keyframed here (defs.js, bone
 * turns on that skeleton, clips.js builds them) and baked with the same
 * camera, size, outline and kit masks as atlas-0 by bake-new.html (a copy of
 * ../bake.html that reads the people3d body and these clips). The keeper is
 * the same body with long sleeves and light gloves painted on, as atlas-0's
 * keeper was.
 *
 * Run:   node tools/sprites/new/bake-new.mjs            bake + install
 *        node tools/sprites/new/bake-new.mjs sheet player:shotKick,volley:2,0   a look sheet (to tools/sprites/new/preview/)
 *        node tools/sprites/new/bake-new.mjs spike       compare with atlas-0 (idle, jog, celebrate; keeper)
 * Needs: three (site package) and Playwright's Chromium (swiftshader, no GPU).
 * Writes public/star/sprites/{atlas-1.webp,mask-1.png} and merges only the new
 * clips (and atlases["1"]) into index.json. atlas-0, mask-0 and every old
 * clip entry are never touched.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "package.json"));
const threeDir = path.resolve(path.dirname(require.resolve("three")), "..");
const { chromium } = require("playwright");
/** The people3d body is ~4% bigger than the old bake's; this brings it to atlas-0's size. */
const FIT = "?s=0.96&dy=-0.015";
const outDir = path.join(root, "public/star/sprites");
const previewDir = path.join(here, "preview");

const [mode = "bake", arg = ""] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".glb": "model/gltf-binary", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file;
  if (u.startsWith("/three/")) file = path.join(threeDir, u.slice(7));
  else if (u.startsWith("/star/")) file = path.join(root, "public", u);
  else file = path.join(here, path.basename(u));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const dataOf = (url) => Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 800 } });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/bake-new.html${FIT}`);
  await page.waitForFunction(() => window.bakerReady === true, null, { timeout: 120000 });
  const t0 = Date.now();
  if (mode === "bake") {
    const res = await page.evaluate(() => window.bakeNew());
    let total = 0;
    for (const name of ["atlas-1.webp", "mask-1.png"]) {
      const buf = dataOf(res[name]); total += buf.length;
      fs.writeFileSync(path.join(outDir, name), buf);
      console.log(name, (buf.length / 1024).toFixed(0), "KB");
    }
    const frag = JSON.parse(res["frag.json"]);
    const p = path.join(outDir, "index.json");
    const idx = JSON.parse(fs.readFileSync(p, "utf8"));
    const old = JSON.stringify({ atlas: idx.atlas, standH: idx.standH });
    idx.atlases = { ...(idx.atlases ?? {}), 1: frag.atlas };
    for (const [c, v] of Object.entries(frag.chars)) for (const [n, cl] of Object.entries(v.clips)) {
      const was = idx.chars[c].clips[n];
      if (was && !was.atlas && !was.mirrorOf) throw new Error(`refusing to overwrite old clip ${c}.${n}`);
      idx.chars[c].clips[n] = cl;
    }
    if (JSON.stringify({ atlas: idx.atlas, standH: idx.standH }) !== old) throw new Error("atlas 0 entry changed");
    fs.writeFileSync(p, JSON.stringify(idx));
    console.log("index.json updated · total", (total / 1024).toFixed(0), "KB ·", ((Date.now() - t0) / 1000).toFixed(0), "s");
  } else {
    fs.mkdirSync(previewDir, { recursive: true });
    const res = mode === "sheet" ? await page.evaluate((a) => window.clipSheet(a), arg)
      : { ...(await page.evaluate(() => window.spike())), ...(await page.evaluate(() => window.spikeKeeper())) };
    for (const [name, v] of Object.entries(res)) {
      fs.writeFileSync(path.join(previewDir, name), typeof v === "string" && v.startsWith("data:") ? dataOf(v) : v);
      console.log("wrote", path.join(previewDir, name));
    }
  }
} finally {
  await browser.close();
  server.close();
}
