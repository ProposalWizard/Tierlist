#!/usr/bin/env node
// scripts/world3d/compound-measure.mjs — THE TRAINING COMPOUND'S SPEED, from every viewpoint, on a Galaxy S20 profile.
//
// Opens /star-world3d-dev?place=compound on a phone screen like Mikey's S20 (412×915 at 2.625 pixels per point,
// an S20 browser name, the page's own thread slowed 4×), stands you at each viewpoint of lib/star/world3d/compoundPlan.ts
// COMPOUND_VIEWS, turns the camera all the way round (8 ways), and reads the draw calls and triangles of the frame
// (window.__world3d.stats()). Standing still, then walking (the sun's shadow is redrawn while you walk).
// Prints a table and a COMPOUND_MEASURED literal to paste into compoundPlan.ts (tests/star/compound.mts checks it).
//
//   node scripts/world3d/compound-measure.mjs [--base http://localhost:3108] [--tiers medium,low,high] [--shots DIR]
//
// No graphics card here: SwiftShader draws it, so read the counts, not the frame times.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const base = opt("base", "http://localhost:3108");
const tiers = opt("tiers", "medium,low,high").split(",");
const shots = opt("shots", null);
const only = opt("views", null);
if (shots) fs.mkdirSync(shots, { recursive: true });

// the same list as compoundPlan.ts COMPOUND_VIEWS (kept in step by hand: the test compares the names)
// [name, x, z, what the still looks at (x, z)]
const VIEWS = [
  ["car park", -3.4, 34.6, 0, 10], ["gate", 0, 22, 0, 5], ["forecourt", -6, 13, -6, 5], ["gym door", -11, 10.9, -11, 5],
  ["stand", 22.4, 4, 62, 1], ["pitch A", 44, 2, 62, -6], ["pitch B", 50, -40, 70, -42], ["pitch C", 0, -30, 0, -42],
].filter(([n]) => !only || only.split(",").includes(n));
const YAWS = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => (k * Math.PI) / 4);

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage"] });
const UA = "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const out = {};
try {
  for (const tier of tiers) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: UA });
    await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); } catch { /* fine */ } });
  const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    page.on("pageerror", (e) => console.error("pageerror", e.message));
    await page.goto(`${base}/star-world3d-dev?place=compound&bare=1&clean=1&q=${tier}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 });
    await page.waitForTimeout(4000);
    await page.addStyleTag({ content: ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide]{display:none!important}" }); // no chat bubble or cookie banner in a still
    const rows = [];
    for (const [name, x, z, lx, lz] of VIEWS) {
      let still = { draws: 0, triangles: 0 }, walk = { draws: 0, triangles: 0 };
      for (const yaw of YAWS) {
        await page.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 }); // (a code change reloads the page)
        await page.evaluate(([x, z, yaw]) => window.__world3d.teleport(x, z, yaw), [x, z, yaw]);
        await page.waitForTimeout(1600); // the shadow redraw after the move is over; a still frame
        const s = await page.evaluate(() => window.__world3d.stats());
        still = { draws: Math.max(still.draws, s.calls), triangles: Math.max(still.triangles, s.triangles) };
      }
      if (shots && tier === "medium") {
        // the still of this view: looking at what is there (the counts above are the worst of all 8 ways)
        await page.evaluate(([x, z, yaw]) => window.__world3d.teleport(x, z, yaw), [x, z, Math.atan2(lx - x, lz - z)]);
        await page.waitForTimeout(1600);
        await page.screenshot({ path: path.join(shots, `view-${name.replace(/\s+/g, "-")}.jpg`), quality: 85 });
      }
      // walking: tap the floor ahead and read every frame for 2.5 s (the shadow is redrawn as you go)
      for (const yaw of [YAWS[0], YAWS[4]]) {
        await page.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 }); // (a code change reloads the page)
        await page.evaluate(([x, z, yaw]) => window.__world3d.teleport(x, z, yaw), [x, z, yaw]);
        await page.waitForTimeout(800);
        await page.evaluate(() => { const c = document.querySelector("canvas").getBoundingClientRect(); window.__world3d.tap(c.left + c.width / 2, c.top + c.height * 0.42); });
        const t0 = Date.now();
        while (Date.now() - t0 < 2500) {
          const s = await page.evaluate(() => window.__world3d.stats());
          walk = { draws: Math.max(walk.draws, s.calls), triangles: Math.max(walk.triangles, s.triangles) };
          await page.waitForTimeout(120);
        }
      }
      rows.push({ view: name, tier, still, walk });
      console.log(`${tier.padEnd(6)} ${name.padEnd(10)} still ${String(still.draws).padStart(3)} draws ${String(still.triangles).padStart(7)} tris | walking ${String(walk.draws).padStart(3)} draws ${String(walk.triangles).padStart(7)} tris`);
    }
    out[tier] = rows;
    await ctx.close();
  }
} finally { await browser.close(); }
console.log("\nexport const COMPOUND_MEASURED = " + JSON.stringify(Object.values(out).flat().map((r) => ({ view: r.view, tier: r.tier, draws: r.still.draws, triangles: r.still.triangles, walkDraws: r.walk.draws, walkTriangles: r.walk.triangles }))) + ";");
