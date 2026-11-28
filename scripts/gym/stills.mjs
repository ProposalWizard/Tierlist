#!/usr/bin/env node
// THE GYM'S PROOF STILLS (gym phase 2): one browser, each demo on /star-world3d-dev?demo=<kind>&film=1 seeked to the
// given seconds (the frame-stepped clock, lib/star/frameStep.ts), a 390×844 phone at 2× (the game fills the frame),
// a still of each and the debug readout (contacts, pierce, draws and triangles) as JSON.
//   node scripts/gym/stills.mjs <base url> <out dir> kind@secs[,secs][:cam=x,y,z:look=x,y,z] ...
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [base, outDir, ...jobs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("star-3d-quality", "medium"); } catch {} });
const report = {};
for (const job of jobs) {
  const [head, ...opts] = job.split(":");
  const [kind, times] = head.split("@");
  const o = Object.fromEntries(opts.map((x) => x.split("=")));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error(`[${kind}] page error`, e.message));
  await page.goto(`${base}/star-world3d-dev?demo=${kind}&film=1`, { waitUntil: "load", timeout: 240000 });
  await page.waitForFunction(() => !!window.__frameStep && !!window.__world3d, null, { timeout: 240000 });
  // dev furniture out of the picture (the admin "eye", the admin tab, the chat bubble): everything fixed but the stage
  await page.evaluate(() => { for (const el of document.querySelectorAll("body *")) { const cs = getComputedStyle(el); if (cs.position === "fixed" && !el.querySelector("canvas") && !el.closest("[data-gym-hud]")) el.style.display = "none"; } });
  report[kind] = [];
  for (const t of times.split(",").map(Number)) {
    await page.evaluate((t) => window.__frameStep.seek(t), t);
    if (o.cam) {
      await page.evaluate(([c, l]) => { window.__world3dCam(c.split(",").map(Number), l.split(",").map(Number)); }, [o.cam, o.look]);
      await page.evaluate((t) => window.__frameStep.seek(t + 0.04), t);
    }
    await page.waitForTimeout(250);
    const file = path.join(outDir, `${kind}${o.tag ?? ""}_${String(t).replace(".", "p")}s.png`);
    await page.screenshot({ path: file });
    const d = await page.evaluate(() => { const x = window.__world3d.debug(); return { gym: { ...x.gym, info: undefined, fitness: undefined }, stats: x.stats }; });
    report[kind].push({ t, file, ...d });
    console.log(kind, t, JSON.stringify(d.gym.ex2), JSON.stringify(d.stats), d.gym.phase, d.gym.body);
    if (o.cam) await page.evaluate(() => window.__world3dCam(null));
  }
  await page.close();
}
fs.writeFileSync(path.join(outDir, `report-${Date.now()}.json`), JSON.stringify(report, null, 1));
await browser.close();
