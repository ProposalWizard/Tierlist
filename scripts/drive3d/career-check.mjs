#!/usr/bin/env node
// scripts/drive3d/career-check.mjs — THE DRIVE IN THE CAREER, end to end (behind its setting, switched on here):
// a fresh signed-out career → Home → Garden → stand at the training gate → "Training ›" → the drive (skipped) →
// the compound (you at your car) → "Drive home" → the drive back (skipped) → the fork → the garden.
// Stills at each step at 390×844 (deviceScaleFactor 1). Needs the dev server (development mode: offline career).
//
//   node scripts/drive3d/career-check.mjs --out DIR [--base http://localhost:3111]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const out = path.resolve(opt("out", "career-check"));
const base = opt("base", "http://localhost:3111");
fs.mkdirSync(out, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage"] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-drive-to-training", "on"); } catch { /* fine */ } });
  const pg = await ctx.newPage();
  pg.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message}`));
  pg.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errors.push(`CONSOLE ${m.text().slice(0, 200)}`); });
  let n = 0;
  const shot = async (name) => { await pg.addStyleTag({ content: ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide]{display:none!important}" }).catch(() => {}); await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) }); console.log("still", name); };
  const click = async (re, timeout = 6000) => { const b = pg.locator("button:visible").filter({ hasText: re }).first(); try { await b.waitFor({ state: "visible", timeout }); await b.click(); await pg.waitForTimeout(1500); return true; } catch { return false; } };
  await pg.goto(`${base}/star-dev`, { waitUntil: "domcontentloaded", timeout: 240000 });
  await pg.waitForTimeout(6000);
  const inputs = pg.locator("input");
  if (await inputs.count()) {
    await inputs.first().fill("Test"); await inputs.nth(1).fill("Driver");
    await click(/Next|Continue/i); await click(/Arsenal/i); await click(/Start Career/i);
    await pg.waitForTimeout(4000);
  }
  // the trial: the dev panel's "Sim whole trial", then past whatever stands between a new career and Home
  for (let k = 0; k < 3; k++) {
    if (!(await pg.locator("button:visible").filter({ hasText: /Sim whole trial/i }).count())) await click(/Dev: Skip \/ Sim Trial/i, 8000);
    if (await click(/Sim whole trial/i, 5000)) break;
  }
  await pg.waitForTimeout(5000);
  for (let i = 0; i < 40; i++) {
    if (await pg.locator("button:visible").filter({ hasText: /Garden/i }).count()) break;
    // a form on the way (who are you?): fill the empty name boxes
    const boxes = pg.locator("input[type=text]:visible, input:not([type]):visible");
    for (let j = 0; j < Math.min(2, await boxes.count()); j++) if (!(await boxes.nth(j).inputValue())) await boxes.nth(j).fill(j ? "Driver" : "Test");
    if (!(await click(/^(?!.*DEV).*(Continue|Next|Done|OK|Got it|Let's go|Start|Sign|Accept|Join|Pick|Choose|Close)/i, 3000))) { console.log("stuck at:", (await pg.locator("button:visible").allInnerTexts()).slice(0, 14).join(" | ")); break; }
  }
  await shot("home");
  if (!(await click(/Garden/i, 10000))) console.log("no Garden button: buttons =", (await pg.locator("button:visible").allInnerTexts()).slice(0, 20).join(" | "));
  await pg.waitForFunction(() => !!window.__garden3d, null, { timeout: 150000 });
  await pg.waitForTimeout(3000);
  await pg.evaluate(() => window.__garden3d.showView?.("training"));
  await pg.waitForTimeout(2500);
  await shot("garden-at-training-gate");
  if (!(await click(/Training/i, 8000))) console.log("no Training button");
  await pg.waitForSelector("[data-drive-career]", { timeout: 60000 });
  await pg.waitForFunction(() => document.querySelector("[data-drive3d]")?.getAttribute("data-drive3d") === "ready", null, { timeout: 300000 });
  await pg.waitForTimeout(2500);
  await shot("drive-in");
  await pg.click("[data-drive-skip]");
  await pg.waitForSelector("[data-drive-career=compound]", { timeout: 60000 });
  await pg.waitForFunction(() => document.querySelector("[data-world3d]")?.getAttribute("data-world3d") === "ready", null, { timeout: 300000 });
  await pg.waitForSelector("[data-drive-home]", { timeout: 60000 });
  await pg.waitForTimeout(2500);
  await shot("compound-at-your-car");
  await pg.click("[data-drive-home]");
  await pg.waitForSelector("[data-drive-career=back]", { timeout: 60000 });
  await pg.waitForFunction(() => document.querySelector("[data-drive3d]")?.getAttribute("data-drive3d") === "ready", null, { timeout: 300000 });
  await pg.waitForTimeout(2500);
  await shot("drive-back");
  await pg.click("[data-drive-skip]");
  await pg.waitForTimeout(2500);
  await shot("after-skip-back");
  const back = await pg.evaluate(() => ({ garden: !!window.__garden3d, drive: !!document.querySelector("[data-drive-career]") }));
  console.log("after the drive back:", JSON.stringify(back));
} finally {
  console.log(errors.length ? `ERRORS:\n${errors.slice(0, 12).join("\n")}` : "no page errors");
  await browser.close();
}
