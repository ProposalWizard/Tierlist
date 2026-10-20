#!/usr/bin/env node
/**
 * Stills of the Home player at chosen seconds of his idle round
 * (lib/star/homeIdle.ts), through window.__homeT (ToonHomePlayer holds that
 * moment). Phone size, the bench's Home shot.
 *
 *   node scripts/bench3d/home.mjs <outPrefix> <t> [t ...] [--base=http://localhost:3027] [--q=head=h4&skin=tan] [--crop]
 * --crop: also a 2× close crop of him (outPrefix-<t>-close.jpg).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2);
const flag = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const pos = args.filter((a) => !a.startsWith("--"));
const [prefix, ...ts] = pos;
const BASE = flag("base") ?? "http://localhost:3027";
const Q = flag("q") ?? "";
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: args.includes("--crop") ? 2 : 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
await page.goto(`${BASE}/star-3d-bench-dev/home${Q ? `?${Q}` : ""}`, { waitUntil: "load", timeout: 300000 });
await page.waitForFunction(() => window.__homePlayer, null, { timeout: 300000 });
await page.addStyleTag({ content: ".tr-fab,.tr-pop,[data-page-guide],[data-frame-meter]{display:none!important}" });
for (const t of ts) {
  await page.evaluate((t) => { window.__homeT = Number(t); }, t);
  await page.waitForTimeout(2500);
  const f = `${prefix}-${String(t).replace(".", "_")}.jpg`;
  await page.screenshot({ path: f, type: "jpeg", quality: 82, ...(args.includes("--crop") ? {} : {}) });
  if (args.includes("--crop")) {
    const box = await page.evaluate(() => { const r = document.querySelector("[data-toon-home]")?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null; });
    if (box) await page.screenshot({ path: `${prefix}-${String(t).replace(".", "_")}-close.jpg`, type: "jpeg", quality: 85, clip: box });
  }
  console.log("still", f);
}
await browser.close();
