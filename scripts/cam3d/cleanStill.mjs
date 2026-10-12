// Medium's post pass on the Style A men, before | after in ONE page at one moment: the same frame
// drawn with window.__menClean.on false then true (real/post.ts MEN_CLEAN). Needs the perf3d
// harness served (node scripts/perf3d/serve.mjs) and chances.json from scripts/cam3d/frames.mts.
// Usage: node scripts/cam3d/cleanStill.mjs DIR NAME [--dpr=1.5] [--q=mscale=current]
import { chromium } from "playwright";
import fs from "node:fs";
const [dir, name] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flag = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const c = JSON.parse(fs.readFileSync(`${dir}/raw/chances.json`, "utf8")).find((x) => x.name === name);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: c.frame.cam.W, height: c.frame.cam.H }, deviceScaleFactor: +flag("dpr", "1.5") });
await ctx.addInitScript(() => { localStorage.setItem("star-look-3d-camera", "new"); localStorage.setItem("star-look-match-player-style2", "styleA"); });
const page = await ctx.newPage();
await page.goto(`http://localhost:3502/index.html?gov=0&fps=0${flag("q", "") ? "&" + flag("q", "") : ""}`);
await page.evaluate((fr) => { window.__run = window.H.chance({ frame: fr, tier: "medium" }); }, c.frame);
await page.waitForFunction(() => window.__M.ready, null, { timeout: 300000 });
await page.waitForTimeout(8000);
// freeze the moment: the next frames all carry the same time
await page.evaluate(() => { const f0 = performance.now(); performance.now = () => f0; });
await page.waitForTimeout(3000);
for (const on of [false, true]) {
  await page.evaluate((v) => { window.__menClean.on = v; }, on);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${dir}/raw/clean-${on ? "after" : "before"}-${name}.png`, timeout: 240000 });
}
console.log("done", name);
await browser.close();
