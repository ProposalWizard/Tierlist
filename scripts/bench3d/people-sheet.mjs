#!/usr/bin/env node
/**
 * The people presets' contact sheets (/star-3d-bench-dev/people), saved as PNGs.
 *   node scripts/bench3d/people-sheet.mjs OUTDIR [set ...]     (sets: staff players today-staff today-players scene closeup hair heads)
 *   a set may carry its own query and file name: "hair&styles=locsLong,afro&base=h3::hair-locs" → sheet-hair-locs.png
 * Needs a dev server: BASE=http://localhost:3200 (default). Chrome with SwiftShader WebGL.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [out = ".", ...sets0] = process.argv.slice(2);
const sets = sets0.length ? sets0 : ["staff", "players", "today-staff", "today-players", "scene"];
const BASE = process.env.BASE ?? "http://localhost:3200";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const set0 of sets) {
  const [set, named] = set0.split("::");
  const p = await b.newPage({ viewport: { width: 1900, height: 1200 } });
  p.on("pageerror", (e) => console.log(set, "PAGEERR", e.message.slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") console.log(set, "ERR", m.text().slice(0, 300)); });
  const t0 = Date.now();
  await p.goto(`${BASE}/star-3d-bench-dev/people?set=${set}`, { timeout: 240000 });
  await p.waitForFunction("window.__sheetDone === true", null, { timeout: 900000, polling: 1000 });
  const data = await p.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
  const file = path.join(out, `sheet-${named ?? set.replace(/[&=,]/g, "-")}.png`);
  fs.writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  console.log(`${file}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  await p.close();
}
await b.close();
