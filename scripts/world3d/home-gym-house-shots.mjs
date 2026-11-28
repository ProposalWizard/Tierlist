#!/usr/bin/env node
// scripts/world3d/home-gym-house-shots.mjs — THE HOME GYM'S WAY IN, IN EACH HOUSE (lib/star/home3d/livingRooms.ts
// homeGymCorner): the room it stands in, from above (--top) or from a corner, the card, and a tap on "Start a workout".
// The living house of each level on /star-world3d-dev?place=house&tier=<tier>, 390×844 at 1×.
//   node scripts/world3d/home-gym-house-shots.mjs --out DIR [--base http://localhost:3112] [--only starter,villa] [--top]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const outDir = path.resolve(opt("out", "home-gym-house-shots"));
const base = opt("base", "http://localhost:3112");
const only = opt("only", null)?.split(",");
const top = args.includes("--top");
fs.mkdirSync(outDir, { recursive: true });
// the room each level's way in stands in (homes.ts LIVING_ROOMS; livingRooms.ts)
const ROOMS = [["starter", "studio"], ["flat", "bedroom"], ["penthouse", "bedroom"], ["house", "garage"], ["villa", "gym"], ["estate", "gym"]];
const HIDE = ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}";

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("kib-3d-view", "third"); } catch { /* fine */ } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
const shot = async (name) => { await page.screenshot({ path: path.join(outDir, `${name}.jpg`), quality: 86 }); console.log(name); };
try {
  for (const [tier, room] of ROOMS) {
    if (only && !only.includes(tier)) continue;
    await page.goto(`${base}/star-world3d-dev?place=house&tier=${tier}&bare=1&q=medium&visit=quiet`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForFunction(() => !!window.__home3d, null, { timeout: 300000 });
    await page.addStyleTag({ content: HIDE });
    await page.waitForTimeout(2500);
    await page.evaluate((r) => window.__home3d.goToRoom(r), room);
    await page.waitForTimeout(2500);
    const plan = await page.evaluate(() => window.__home3d.plan());
    if (top) {
      await page.evaluate(([w, d]) => window.__home3d.debugCamera([0, Math.max(w, d) * 1.25, 0.01], [0, 0, 0], 60), [plan.w, plan.d]);
      await page.waitForTimeout(900);
      await shot(`house-${tier}-${room}-top`);
      await page.evaluate(() => window.__home3d.debugCamera(null));
    }
    // the way in: tap it (he walks up), the card
    const ok = await page.evaluate(() => window.__home3d.tapThing?.("homegym") || window.__home3d.tapThing?.("mat"));
    if (!ok) { console.log(tier, "no home-gym thing in", room); continue; }
    await page.waitForTimeout(6000);
    await shot(`house-${tier}-${room}-gym-card`);
    // "Start a workout": the house fades out, the home gym opens (fading in), and its "‹ House" goes back
    if (args.includes("--go")) {
      await page.click("[data-act=gym]");
      await page.waitForFunction(() => !!window.__world3d, null, { timeout: 300000 });
      await page.addStyleTag({ content: HIDE });
      await page.waitForTimeout(400);
      await shot(`house-${tier}-${room}-gym-fading-in`);
      await page.waitForTimeout(3000);
      await shot(`house-${tier}-${room}-gym-opened`);
      await page.click("[data-world3d-back]");
      await page.waitForFunction(() => !!window.__home3d, null, { timeout: 300000 });
      await page.waitForTimeout(3500);
      await shot(`house-${tier}-${room}-back-in-the-house`);
    }
  }
} finally {
  await browser.close();
}
