// One still + frame cost per quality tier, Old vs New tier look (Settings → Look →
// "3D quality look: New | Old", lib/star/three3d/tierLook.ts).
// Usage: node scripts/perf3d/tiers.mjs <career|garden> <high|medium|low> <new|old> --out=DIR [--port=3502] [--tod=day|golden|night] [--q=animfix=0&…] [--tag=name]
// Prints one JSON line: draws, triangles, shadow draws, posts, pixel ratio, median ms a frame
// (this machine: SwiftShader, no graphics chip — read the % change, not the ms).
import { chromium } from "playwright";
import fs from "node:fs";
const [scene = "career", tier = "medium", look = "new"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flag = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const out = flag("out", "/tmp"); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +flag("dpr", "3") });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
await page.goto(`http://localhost:${flag("port", "3502")}/index.html?gov=0&tierlook=${look}&fps=0${flag("q", "") ? "&" + flag("q", "") : ""}`);
const tod = flag("tod", "");
const opts = scene === "garden" ? { quality: tier, ...(tod ? { sky: tod } : {}) } : { tier, ...(tod ? { tod } : {}) };
await page.evaluate(([s, o]) => { window.__run = window.H[s](o).catch((e) => { window.__err = String(e); }); }, [scene, opts]);
await page.waitForFunction(() => window.__err || window.__M.ready, null, { timeout: 300000 });
const err = await page.evaluate(() => window.__err);
if (err) { console.log(JSON.stringify({ scene, tier, look, err, errs })); process.exit(1); }
await page.waitForTimeout(+flag("settle", "14000"));
const since = await page.evaluate(() => performance.now());
await page.waitForTimeout(+flag("window", "8000"));
const m = await page.evaluate((since) => {
  // whole frames from the frame meter (every pass, shadows and post included);
  // ms = the gap between frames (the harness reads a pixel back after each one, so the GPU work is in it)
  const all = (window.__frame3dAll ? window.__frame3dAll() : []).filter((f) => f.t >= since);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const gaps = all.slice(1).map((f, i) => f.t - all[i].t);
  const k = (key) => med(all.map((f) => f[key] || 0));
  return { frames: all.length, msMed: Math.round(med(gaps) ?? 0), draws: k("draws"), tris: Math.round(k("tris") ?? 0), shadowDraws: k("shadowDraws"), posts: k("posts"),
    pr: window.__M.renderer?.getPixelRatio(), tv: window.__tvSolve ? { k: +window.__tvSolve.k.toFixed(3), man: +window.__tvSolve.man.toFixed(4), D: +window.__tvSolve.D.toFixed(2) } : null };
}, since);
const shot = `${out}/${scene}${tod ? `-${tod}` : ""}-${tier}-${look}${flag("tag", "") ? "-" + flag("tag", "") : ""}.png`;
await page.screenshot({ path: shot, timeout: 240000 });
console.log(JSON.stringify({ scene, tier, look, ...m, shot, errs: errs.slice(0, 3) }));
await browser.close();
