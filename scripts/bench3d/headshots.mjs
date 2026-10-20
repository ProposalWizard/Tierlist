#!/usr/bin/env node
/**
 * The card headshots (components/star/Headshot3D.tsx, lib/star/headshot3d)
 * on the bench sheet (/star-3d-bench-dev/headshots): forgets this browser's
 * kept pictures, waits for every face, saves a phone-size still of the sheet
 * and each face's own 256 px picture, prints how long each took, then opens
 * the sheet again to check nothing is made twice (every face from the device).
 *
 *   node scripts/bench3d/headshots.mjs <outDir> [--base=http://localhost:3027]
 *
 * This machine has no graphics chip: read the numbers as "how many", not as a
 * phone's milliseconds.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const [outDir] = args.filter((a) => !a.startsWith("--"));
if (!outDir) { console.error("usage: node scripts/bench3d/headshots.mjs <outDir> [--base=…]"); process.exit(1); }
const BASE = flag("base") ?? "http://localhost:3027";
fs.mkdirSync(outDir, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
// tall enough that every card is on screen (a card only asks for its face as it nears the screen)
const ctx = await browser.newContext({ viewport: { width: 390, height: 1800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message));
const url = `${BASE}/star-3d-bench-dev/headshots`;
await page.goto(url, { waitUntil: "load", timeout: 600000 });
await page.evaluate(() => new Promise((r) => { const q = indexedDB.deleteDatabase("star-headshots"); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
const all = () => page.evaluate(() => document.querySelectorAll("[data-headshot]").length);
for (const visit of [1, 2]) {
  await page.goto(url, { waitUntil: "load", timeout: 600000 });
  await page.addStyleTag({ content: ".tr-fab,.tr-pop,[data-page-guide],[data-frame-meter]{display:none!important}" });
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const n = document.querySelectorAll("[data-headshot]").length;
    return n > 0 && document.querySelectorAll('[data-headshot-view="picture"]').length >= n; // every 3D card (the drawn column is not one)
  }, null, { timeout: 600000 });
  const s = await page.evaluate(() => window.__headshots);
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : "-");
  console.log(`visit ${visit}: ${await all()} cards, every face in ${Date.now() - t0} ms; made ${s.shotMs.length} (median ${med(s.shotMs)} ms, first ${s.shotMs[0] ?? "-"} ms), kept ${s.kept}, failed ${s.failed}; renderer + clips ${s.setupMs.join("/") || "-"} ms; head files ${s.sitterMs.join("/") || "-"} ms`);
  if (visit === 1) {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/sheet.jpg`, type: "jpeg", quality: 75, fullPage: true });
    const shots = await page.evaluate(async () => {
      const out = [];
      for (const el of document.querySelectorAll('[data-headshot-view="picture"]')) {
        const b = await (await fetch(el.querySelector("img").src)).blob();
        const u = new Uint8Array(await b.arrayBuffer());
        let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
        out.push({ id: el.getAttribute("data-headshot"), type: b.type, b64: btoa(s) });
      }
      return out;
    });
    for (const s of shots) fs.writeFileSync(`${outDir}/${s.id}.${s.type.includes("webp") ? "webp" : "png"}`, Buffer.from(s.b64, "base64"));
    console.log(`saved ${outDir}/sheet.jpg and ${shots.length} faces`);
  }
}
await browser.close();
