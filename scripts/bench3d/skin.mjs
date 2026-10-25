#!/usr/bin/env node
/**
 * THE SKIN SHEET's numbers (Harry, 23 Oct 2026: the 3D men's face a different
 * colour from their neck and arms). Opens /star-3d-bench-dev/skin for each head
 * asked, waits for every tone, and writes each render (card-HEAD-TONE.png) and
 * its probe picture (card-HEAD-TONE-probe.png). skin_sheet.py measures them.
 *
 *   node scripts/bench3d/skin.mjs [--base=http://localhost:3161] [--heads=h1,h3] [--out=DIR] [--q=extra=query]
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : "1"]; }));
const BASE = flags.base ?? "http://localhost:3161";
const OUT = flags.out ?? "skin-out";
const heads = (flags.heads ?? "h1").split(",");
fs.mkdirSync(OUT, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const all = {};
for (const h of heads) {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.goto(`${BASE}/star-3d-bench-dev/skin?head=${h}${flags.q ? `&${flags.q}` : ""}`, { waitUntil: "load", timeout: 300000 });
  await page.waitForFunction(() => window.__skinSheet, null, { timeout: 600000 });
  const sheet = await page.evaluate(() => window.__skinSheet);
  for (const r of sheet.rows) {
    fs.writeFileSync(path.join(OUT, `card-${h}-${r.tone}.png`), Buffer.from(r.url.split(",")[1], "base64"));
    fs.writeFileSync(path.join(OUT, `card-${h}-${r.tone}-probe.png`), Buffer.from(r.probe.split(",")[1], "base64"));
    delete r.url; delete r.probe;
  }
  all[h] = sheet;
  await page.screenshot({ path: path.join(OUT, `sheet-${h}.png`), fullPage: true });
  await page.close();
  console.log("done", h);
}
fs.writeFileSync(path.join(OUT, "card.json"), JSON.stringify(all, null, 1));
await browser.close();
