// Style A in the 3D match vs Home (12 Oct 2026). One still + counters of the career
// match at phone size, under the look keys you pass, plus a 4× crop of one man.
// Usage: node scripts/perf3d/styleA.mjs <label> --out=DIR [--scene=career|homeman] [--opts=JSON] [--tier=medium] [--ls=key=value,key=value] [--port=3502] [--q=k=v&k=v]
// Counters are the frame meter's (draws, triangles, skinned). No ms: this machine has no graphics chip.
import { chromium } from "playwright";
import fs from "node:fs";
const label = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "run";
const flag = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const out = flag("out", "/tmp"); fs.mkdirSync(out, { recursive: true });
const ls = Object.fromEntries((flag("ls", "") || "").split(",").filter(Boolean).map((kv) => kv.split("=")));
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: +flag("dpr", "3") });
await ctx.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, ls);
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
const q = flag("q", "");
await page.goto(`http://localhost:${flag("port", "3502")}/index.html?gov=0&fps=0${q ? "&" + q : ""}`);
const sceneName = flag("scene", "career");
const opts = sceneName === "career" ? { tier: flag("tier", "medium"), tod: flag("tod", "golden"), ...JSON.parse(flag("opts", "{}")) } : JSON.parse(flag("opts", "{}"));
await page.evaluate(([s, o]) => { window.__run = window.H[s](o).catch((e) => { window.__err = String(e); }); }, [sceneName, opts]);
await page.waitForFunction(() => window.__err || window.__M.ready, null, { timeout: 300000 });
const err = await page.evaluate(() => window.__err);
if (err) { console.log(JSON.stringify({ label, err, errs })); process.exit(1); }
await page.waitForTimeout(+flag("settle", "16000"));
const since = await page.evaluate(() => performance.now());
await page.waitForTimeout(+flag("window", "6000"));
const m = await page.evaluate((since) => {
  const all = (window.__frame3dAll ? window.__frame3dAll() : []).filter((f) => f.t >= since);
  const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const k = (key) => med(all.map((f) => f[key] || 0));
  return { frames: all.length, draws: k("draws"), tris: Math.round(k("tris") ?? 0), skinned: k("skinnedDraws"), shadowDraws: k("shadowDraws"), posts: k("posts"), pr: window.__M.renderer?.getPixelRatio?.() };
}, since);
const shot = `${out}/${label}.png`;
await page.screenshot({ path: shot, timeout: 240000 });
console.log(JSON.stringify({ label, ...m, shot, errs: errs.slice(0, 3) }));
await browser.close();
