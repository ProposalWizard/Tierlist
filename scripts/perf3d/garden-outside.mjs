// THE GARDEN FROM OUTSIDE (garden levels): draws and triangles on Medium for the views the garden-levels budget
// names (lib/star/garden3d/gardenBudget.ts GARDEN_LEVELS_MEASURED), with a still of each.
//   node scripts/perf3d/build.mjs && node scripts/perf3d/serve.mjs &
//   node scripts/perf3d/garden-outside.mjs <out dir> [--w=412 --h=915] [--tag=after] [--only=a,b] [--q=impostor=0]
// Views: the garden gate at level 1 and 5 (where you arrive), the paddock facing the garden, the field facing
// the garden, the lane just outside the west gate, the yard. Each view: stood still 6 s, the frame meter's
// middle of the last eight frames (and their biggest: a frame that redraws the sun's shadow costs more). `--q` is put on the page's address (the scene reads ?debug flags from it).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const out = args.find((a) => !a.startsWith("--")) ?? "/tmp/garden-outside";
const W = +flag("w", "412"), Hh = +flag("h", "915"), tag = flag("tag", ""), q = flag("q", "");
fs.mkdirSync(out, { recursive: true });
const VIEWS = [
  { name: "gate-l1", xp: 0 },
  { name: "gate-l5", xp: 3400 },
  { name: "paddock-facing-garden", xp: 3400, at: [-41, -1.8, Math.PI / 2] },
  { name: "field-facing-garden", xp: 3400, at: [-58, -1.8, Math.PI / 2] },
  { name: "lane-outside-gate", xp: 3400, at: [-23, -1.8, Math.PI / 2] },
  { name: "yard-facing-garden", xp: 3400, at: [-31, -1.8, Math.PI / 2] },
  { name: "walk-in-from-paddock", xp: 3400, at: [-41, -1.8, Math.PI / 2], walkTo: [-12, -1.8] },
];
const only = flag("only", "");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = [];
for (const v of VIEWS) {
  if (only && !only.split(",").includes(v.name)) continue;
  const ctx = await browser.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:3502/index.html${q ? "?" + q : ""}`);
  await page.evaluate((xp) => { window.__run = window.H.garden({ quality: "medium", levels: xp ? { xp, horse: { name: "Copper Kettle", energy: 1, mine: true } } : undefined }).catch((e) => { window.__err = String(e); }); }, v.xp);
  await page.waitForFunction(() => window.__err || (window.__M.ready && window.__M.frames.length > 3), null, { timeout: 300000, polling: 500 });
  if (v.at) await page.evaluate((a) => window.__M.ctrl.place(a[0], a[1], a[2]), v.at);
  await page.waitForTimeout(6000);
  if (v.walkTo) {
    // walk in through the west gate, a still and the draws every 2 s (the far copy must hand over to the real garden)
    await page.evaluate((t) => window.__M.ctrl.setStick(0, 1), v.walkTo);
    for (let i = 0; i < 9; i++) {
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => { const c = window.__M.ctrl; const f = window.__M.frames.slice(-4); return { calls: Math.max(...f.map((x) => x.calls)), tris: Math.max(...f.map((x) => x.tris)), where: c.where(), far: window.__gardenFar ?? null }; });
      const file = path.join(out, `${v.name}-${i}${tag ? "-" + tag : ""}.png`);
      await page.screenshot({ path: file });
      rows.push({ view: `${v.name} ${i}`, draws: r.calls, triangles: r.tris, x: +r.where.x.toFixed(1), cam: r.where.cam, far: r.far, file });
      console.log(JSON.stringify(rows[rows.length - 1]));
    }
    await ctx.close();
    continue;
  }
  const r = await page.evaluate(() => { const c = window.__M.ctrl; const s = c.stats(); const f = window.__M.frames.slice(-8); const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]; return { calls: med(f.map((x) => x.calls)), callsMax: Math.max(...f.map((x) => x.calls)), tris: med(f.map((x) => x.tris)), s, where: c.where(), err: window.__err, far: window.__gardenFar ?? null }; });
  const file = path.join(out, `${v.name}${tag ? "-" + tag : ""}.png`);
  await page.screenshot({ path: file });
  rows.push({ view: v.name, draws: r.calls, drawsMax8: r.callsMax, triangles: r.tris, cam: r.where.cam, far: r.far, file, errs: errs.slice(0, 3), err: r.err });
  console.log(JSON.stringify(rows[rows.length - 1]));
  await ctx.close();
}
fs.writeFileSync(path.join(out, `garden-outside${tag ? "-" + tag : ""}.json`), JSON.stringify(rows, null, 1));
await browser.close();
