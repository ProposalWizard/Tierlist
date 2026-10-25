#!/usr/bin/env node
/**
 * THE SKIN SHEET's garden half: your 3D man in the real 3D garden
 * (/star-garden3d-dev?bare=1&skin=…&head=…) at phone size, for every skin
 * tone. For each: the game's own view (game-*.png), a close front view
 * (close-*.png) and the same close view with the skin probe's regions
 * (close-*-probe.png: face magenta, neck cyan, upper arm yellow, forearm
 * green, hand blue; toon/shader.ts setToonSkinProbe(2)). skin_sheet.py reads them.
 *
 *   node scripts/bench3d/skin-garden.mjs [--base=http://localhost:3161] [--heads=h1] [--tones=tan,deep] [--out=DIR] [--q=skinpaint=0]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : "1"]; }));
const BASE = flags.base ?? "http://localhost:3161";
const OUT = flags.out ?? "skin-out";
const heads = (flags.heads ?? "h1").split(",");
const tones = (flags.tones ?? "porcelain,fair,light,tan,olive,brown,deep,dark").split(",");
fs.mkdirSync(OUT, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const frames = (page, n) => page.evaluate((n) => new Promise((res) => { let i = 0; const f = () => (++i >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
for (const h of heads) {
  for (const t of tones) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    page.on("pageerror", (e) => console.log("pageerror", e.message));
    await page.goto(`${BASE}/star-garden3d-dev?bare=1&skin=${t}&head=${h}${flags.q ? `&${flags.q}` : ""}`, { waitUntil: "load", timeout: 300000 });
    await page.waitForFunction(() => window.__garden3d, null, { timeout: 600000 });
    await page.waitForTimeout(4000);
    await frames(page, 10);
    await page.screenshot({ path: path.join(OUT, `game-${h}-${t}.png`) });
    // a close front view: the camera 1.7 m in front of him at chest height
    await page.evaluate(() => {
      const g = window.__garden3d;
      const w = g.where();
      const fx = Math.sin(w.yaw), fz = Math.cos(w.yaw);
      g.debugCamera([w.x + fx * 1.7, 1.45, w.z + fz * 1.7], [w.x, 1.2, w.z]);
    });
    await frames(page, 8);
    await page.screenshot({ path: path.join(OUT, `close-${h}-${t}.png`) });
    await page.evaluate(() => window.__toonSkin.probe(2));
    await frames(page, 3);
    await page.screenshot({ path: path.join(OUT, `close-${h}-${t}-probe.png`) });
    await page.evaluate(() => window.__toonSkin.probe(false));
    await page.close();
    console.log("garden", h, t);
  }
}
await browser.close();
