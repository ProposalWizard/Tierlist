#!/usr/bin/env node
/**
 * Your player's barber cuts as contact sheets (/star-3d-bench-dev/hair), saved as PNGs.
 *   node scripts/bench3d/hair-sheet.mjs OUTDIR "name::query" ...
 *   e.g. "coily::cuts=afro:0,highTop:2,locsLong:3,twists:1&head=h1&skin=deep"
 *        "grow::grow=buzz:coily:0&weeks=0,6,12&head=h3&skin=brown"
 * Needs a dev server: BASE=http://localhost:3112 (default). Chrome with SwiftShader WebGL.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [out = ".", ...sets] = process.argv.slice(2);
const BASE = process.env.BASE ?? "http://localhost:3112";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const s of sets) {
  const [name, query] = s.split("::");
  const p = await b.newPage({ viewport: { width: 1960, height: 1300 } });
  p.on("pageerror", (e) => console.log(name, "PAGEERR", e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") console.log(name, "ERR", m.text().slice(0, 300)); });
  const t0 = Date.now();
  await p.goto(`${BASE}/star-3d-bench-dev/hair?${query ?? ""}`, { timeout: 240000 });
  await p.waitForFunction("window.__sheetDone === true", null, { timeout: 900000, polling: 1000 });
  const status = await p.evaluate(() => document.querySelector("[data-hair-status]")?.textContent ?? "");
  const data = await p.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
  const file = path.join(out, `hair-${name}.png`);
  fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  console.log(`${file}  (${((Date.now() - t0) / 1000).toFixed(0)} s)  ${status.slice(0, 600)}`);
  await p.close();
}
await b.close();
