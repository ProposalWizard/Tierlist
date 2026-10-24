/**
 * LOOK AT A FOOTBALL CLIP on the real Style A body (toon-p1), frame by frame,
 * side-on and three-quarter, with a 2 m height mark and the ball at `contactPoint`.
 *
 *   node tools/anims3d/look/look.mjs <clip> <out.png> [--frames=12] [--views=side,q34] [--clips=/star/anims3d/football.glb]
 *
 * Needs the site's three and Playwright's Chromium (software GL: swiftshader). Writes
 * one PNG per frame next to out.png's folder (look-<view>-<i>.png) and the sheet via sheet.py.
 * The body is drawn plain (kit red, shorts black, socks white): the game's toon shader is
 * not needed to judge a pose.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "package.json"));
const threeDir = path.resolve(path.dirname(require.resolve("three")), "..");
const { chromium } = require("playwright");
const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"]; }));
const [clip, out] = args.filter((a) => !a.startsWith("--"));
const N = +(opt.frames ?? 12), views = (opt.views ?? "side,q34").split(",");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".glb": "model/gltf-binary", ".webp": "image/webp", ".png": "image/png" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = u.startsWith("/three/") ? path.join(threeDir, u.slice(7)) : u.startsWith("/star/") ? path.join(root, "public", u) : path.join(here, path.basename(u));
  fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" }); res.end(data); });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const dir = path.dirname(path.resolve(out));
fs.mkdirSync(dir, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 420 } });
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/look.html${opt.clips ? `?clips=${opt.clips}` : ""}`);
  await page.waitForFunction(() => window.lookReady === true, null, { timeout: 120000 });
  const meta = await page.evaluate((c) => window.meta[c], clip);
  const dur = meta.duration, contact = meta.contact;
  let ts = Array.from({ length: N }, (_, i) => +(dur * i / (N - 1)).toFixed(3));
  if (opt.times) ts = opt.times.split(",").map(Number);
  else if (contact !== undefined) { const j = ts.reduce((b, t, i) => Math.abs(t - contact) < Math.abs(ts[b] - contact) ? i : b, 0); ts[j] = contact; }
  const list = [];
  for (const v of views) for (let i = 0; i < ts.length; i++) {
    const url = await page.evaluate(([c, t, v, b]) => window.shot(c, t, v, b), [clip, ts[i], v, contact !== undefined && Math.abs(ts[i] - contact) < 1e-6]);
    const f = path.join(dir, `look-${v}-${i}.png`);
    fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(",") + 1), "base64"));
    list.push([v, ts[i], f]);
  }
  fs.writeFileSync(path.join(dir, "look-list.json"), JSON.stringify({ clip, contact, frames: list }));
  execFileSync("python3", [path.join(here, "sheet.py"), path.join(dir, "look-list.json"), out], { stdio: "inherit" });
} finally { await browser.close(); server.close(); }
