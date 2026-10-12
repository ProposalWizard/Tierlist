// The 3D animation test grid (/star-anim3d-dev's picture) as a contact sheet: every match clip
// on its own man, at several moments through the clip (the harness's `animgrid` scene).
// Usage: node scripts/perf3d/animgrid.mjs --out=DIR [--port=3502] [--frames=5] [--ls=key=value,...]
// Writes DIR/grid-f<i>.png (one picture per moment) and prints each tile's clip and length.
import { chromium } from "playwright";
import fs from "node:fs";
const flag = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const out = flag("out", "/tmp"); fs.mkdirSync(out, { recursive: true });
const ls = Object.fromEntries((flag("ls", "") || "").split(",").filter(Boolean).map((kv) => kv.split("=")));
const N = +flag("frames", "5");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 760, height: 1400 }, deviceScaleFactor: 1 });
await ctx.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, ls);
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${flag("port", "3502")}/index.html?gov=0&fps=0`);
await page.evaluate(() => { window.__run = window.H.animgrid({ cols: 6, w: 120, h: 150 }).catch((e) => { window.__err = String(e); }); });
await page.waitForFunction(() => window.__err || window.__M.ready, null, { timeout: 300000 });
const err = await page.evaluate(() => window.__err);
if (err) { console.log(JSON.stringify({ err, errs })); process.exit(1); }
const info = await page.evaluate(() => window.__grid.info.map((x, i) => ({ label: window.__gridTiles[i], ...x })));
for (let f = 0; f < N; f++) {
  await page.evaluate((k) => { window.__grid.draw(window.__grid.info.map((x) => x.duration * k)); }, f / N);
  const box = await page.evaluate(() => { const r = document.querySelector("canvas").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await page.screenshot({ path: `${out}/grid-f${f}.png`, clip: box, timeout: 240000 });
}
console.log(JSON.stringify({ info, errs: errs.slice(0, 3) }));
await browser.close();
