#!/usr/bin/env node
// Stills of a cut scene at chosen seconds, at phone size, through the
// frame-step hook (window.__frameStep.seek(t) draws exactly that moment).
//
//   node scripts/cutscene/stills.mjs "<url>" <outPrefix> <t> [t ...] [--sheet]
//
// e.g. node scripts/cutscene/stills.mjs "http://localhost:3000/star-style-dev?scene=director&fixture=signing&clean=1" /tmp/sign 2 6 9 12
// --sheet also writes <outPrefix>-sheet.png: every still side by side, labelled.
import { chromium } from "playwright";
import fs from "node:fs";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const sheet = process.argv.includes("--sheet");
const [url, prefix, ...ts] = args;
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error" && !/CERT_AUTHORITY|favicon/.test(m.text())) console.log("console", m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "load", timeout: 240000 });
await page.waitForFunction(() => window.__frameStep && window.__styleReady !== false, null, { timeout: 300000 });
await page.waitForTimeout(1500);
const files = [];
for (const t of ts) {
  await page.evaluate((t) => window.__frameStep.seek(Number(t)), t);
  await page.waitForTimeout(250);
  const f = `${prefix}-${String(t).replace(".", "_")}.png`;
  await page.screenshot({ path: f });
  files.push([t, f]);
  console.log("still", f);
}
if (sheet && files.length) {
  const imgs = files.map(([t, f]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${t}s</figcaption></figure>`).join("");
  const p2 = await browser.newPage({ viewport: { width: 200 * files.length, height: 460 } });
  await p2.setContent(`<style>body{margin:0;display:flex;background:#111;color:#fff;font:12px sans-serif}figure{margin:2px;width:196px}img{width:196px}</style>${imgs}`);
  await p2.screenshot({ path: `${prefix}-sheet.png` });
  console.log("sheet", `${prefix}-sheet.png`);
}
await browser.close();
