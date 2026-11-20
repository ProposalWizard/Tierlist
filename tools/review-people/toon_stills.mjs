#!/usr/bin/env node
// Stills of TODAY'S people (Style A, the toon bodies) from the game's own test pages, at phone size,
// to set beside the realistic stills (tools/review-people/realistic_people.py).
//   node tools/review-people/toon_stills.mjs <base url, e.g. http://localhost:3200> <out dir>
// Needs a dev server (NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY may be dummies) and playwright.
import { chromium } from "playwright";
import fs from "node:fs";

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SHOTS = [
  // [name, path, seconds to seek (director pages) or [] to just wait]
  ["office", "/star-3d-area-dev/office?bare=1", []],
  ["signing-page", "/star-3d-area-dev/signing?bare=1", []],
  ["cut-signing", "/star-3d-bench-dev/scene?scene=director&fixture=signing&clean=1", [2, 6, 10.1]],
  ["cut-press", "/star-3d-bench-dev/scene?scene=director&fixture=press&clean=1", [6.7]],
  ["cut-dropped", "/star-3d-bench-dev/scene?scene=director&event=dropped&stakes=0.6&emotion=sad&seed=3&clean=1", [2, 5]],
  ["cut-dropped-seed9", "/star-3d-bench-dev/scene?scene=director&event=dropped&stakes=0.6&emotion=sad&seed=9&clean=1", [2, 5]],
];
for (const [name, path, ts] of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log(name, "pageerror", e.message.slice(0, 200)));
  try {
    await page.goto(base + path, { waitUntil: "load", timeout: 240000 });
    await page.getByRole("button", { name: "No thanks" }).click({ timeout: 15000 }).catch(() => {});   // the cookie card
    if (ts.length) {
      await page.waitForFunction(() => window.__frameStep && window.__styleReady !== false, null, { timeout: 300000 });
      await page.waitForTimeout(1500);
      for (const t of ts) {
        await page.evaluate((t) => window.__frameStep.seek(Number(t)), t);
        await page.waitForTimeout(400);
        const f = `${out}/${name}-${String(t).replace(".", "_")}.png`;
        await page.screenshot({ path: f });
        console.log("still", f);
      }
    } else {
      await page.waitForSelector("canvas", { timeout: 240000 });
      await page.waitForTimeout(25000);
      const f = `${out}/${name}.png`;
      await page.screenshot({ path: f });
      console.log("still", f);
    }
  } catch (e) { console.log(name, "FAILED", String(e).slice(0, 300)); }
  await page.close();
}
await browser.close();
