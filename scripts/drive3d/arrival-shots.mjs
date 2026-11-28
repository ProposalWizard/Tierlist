#!/usr/bin/env node
// scripts/drive3d/arrival-shots.mjs — STILLS AND NUMBERS OF THE DRIVE'S ARRIVAL AT THE REAL COMPOUND
// (lib/star/drive3d/arrival.ts, drawn by lib/star/world3d/testScene.ts opts.arrive).
//
// Opens /star-world3d-dev?place=compound&arrive=<car>&demo=drive on a 390×844 phone (deviceScaleFactor 1), steps the
// film clock (window.__frameStep) through the arrival, saves a still at each named moment, and prints the worst
// frame's draws and triangles in each shot (the arrival's budget: Low 35k, Medium 60k triangles).
//
//   node scripts/drive3d/arrival-shots.mjs --out DIR [--base http://localhost:3111] [--q medium] [--car sports] [--at name=sec,...]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const outDir = path.resolve(opt("out", "arrival-shots"));
const base = opt("base", "http://localhost:3111");
const q = opt("q", "medium"), car = opt("car", "sports");
const scale = Number(opt("dsf", "1"));
fs.mkdirSync(outDir, { recursive: true });
// [name, second]
const STILLS = opt("at", "") ? opt("at", "").split(",").map((p) => p.split("=")).map(([n, t]) => [n, Number(t)]) : [
  ["a1-road", 1.2], ["a2-barrier-lift", 3.4], ["a3-under-the-arm", 4.4], ["a4-bay-swing", 7.6], ["a5-bay-in", 9.6], ["a6-stopped", 11.2], ["a7-by-your-car", 13.2],
];
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); } catch { /* fine */ } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error("console", m.text().slice(0, 300)); });
  await page.goto(`${base}/star-world3d-dev?place=compound&arrive=${car}&demo=drive&bare=1&clean=1&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await page.waitForFunction(() => !!window.__world3d && !!window.__frameStep, null, { timeout: 300000 });
  await page.addStyleTag({ content: ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}" });
  await page.waitForTimeout(1500);
  const worst = {};
  let t = 0;
  const end = Math.max(...STILLS.map((s) => s[1]));
  const want = STILLS.slice().sort((a, b) => a[1] - b[1]);
  while (t <= end + 1e-6) {
    await page.evaluate((tt) => window.__frameStep.seek(tt), t);
    const s = await page.evaluate(() => { const st = window.__world3d.stats(); const d = window.__world3d.debug(); return { ...st, shot: d.arrival?.shot ?? null, phase: d.arrival?.phase ?? null }; });
    const k = s.phase === "roll" || s.phase === "door" ? s.shot : "out";
    if (!worst[k] || s.triangles > worst[k].triangles) worst[k] = { t: +t.toFixed(2), calls: s.calls, triangles: s.triangles, people: s.people };
    while (want.length && want[0][1] <= t + 1e-6) {
      const [name] = want.shift();
      await page.screenshot({ path: path.join(outDir, `${name}.png`) });
      console.log(`${name} t=${t.toFixed(1)} ${s.shot}/${s.phase} draws=${s.calls} tris=${s.triangles}`);
    }
    t += 0.2;
  }
  console.log("WORST", JSON.stringify({ q, car, worst }));
} finally { await browser.close(); }
