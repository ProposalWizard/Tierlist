// 3D stills of real chances (one 3D camera since 12 Oct 2026; "old" = ?cam2d=0 did nothing after that)
// (the 2D's own frame), realistic players or Style A. Reads chances.json from
// scripts/cam3d/frames.mts. Needs the perf3d harness built and served
// (node scripts/perf3d/build.mjs; node scripts/perf3d/serve.mjs &).
// Usage: node scripts/cam3d/stills.mjs DIR <old|new> <real|stylea> [--dpr=2] [--only=name,name]
import { chromium } from "playwright";
import fs from "node:fs";
const [dir, cam = "new", style = "stylea"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flag = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const only = flag("only", "") ? flag("only", "").split(",") : null;
const list = JSON.parse(fs.readFileSync(`${dir}/raw/chances.json`, "utf8")).filter((c) => !only || only.includes(c.name));
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const { W, H } = list[0].frame.cam;
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +flag("dpr", "2") });
await ctx.addInitScript((st) => {
  localStorage.setItem("star-look-3d-camera", "new");
  if (st === "stylea") localStorage.setItem("star-look-match-player-style2", "styleA");
  else localStorage.setItem("star-look-match-player-style", "real");
}, style);
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${flag("port", "3502")}/index.html?gov=0&fps=0${cam === "old" ? "&cam2d=0" : ""}${flag("q", "") ? "&" + flag("q", "") : ""}`);
for (const c of list) {
  await page.evaluate((fr) => {
    window.__M.ready = 0;
    try { window.__M.ctrl?.dispose(); } catch { /* first */ }
    window.__run = window.H.chance({ frame: fr, tier: "medium" }).catch((e) => { window.__err = String(e); });
  }, c.frame);
  await page.waitForFunction(() => window.__err || window.__M.ready, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__err);
  if (err) { console.log(c.name, "ERR", err); continue; }
  await page.waitForTimeout(+flag("settle", "9000"));
  const solve = await page.evaluate(() => window.__tvSolve);
  const shot = `${dir}/raw/3d-${cam}-${style}${flag("tag", "") ? "-" + flag("tag", "") : ""}-${c.name}.png`;
  await page.screenshot({ path: shot, timeout: 240000 });
  console.log(JSON.stringify({ name: c.name, cam, style, shot, solve }));
}
if (errs.length) console.log("page errors:", errs.slice(0, 3));
await browser.close();
