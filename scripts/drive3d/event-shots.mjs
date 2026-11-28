#!/usr/bin/env node
// scripts/drive3d/event-shots.mjs — STILLS OF THE DRIVE'S EVENTS (lib/star/drive3d/events.ts) on a 390×844 phone
// (deviceScaleFactor 1): for each event, the card as it opens (the set piece by the road behind it), what you
// press (yes; the camera is left alone, so the fine shows), and the outcome card with its effect.
//
//   node scripts/drive3d/event-shots.mjs --out DIR [--base http://localhost:3111] [--q medium] [--only rain,breakdown]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const outDir = path.resolve(opt("out", "event-shots"));
const base = opt("base", "http://localhost:3111");
const q = opt("q", "medium");
const only = opt("only", null)?.split(",");
fs.mkdirSync(outDir, { recursive: true });
const EVENTS = [["fan-crossing", "yes"], ["speed-camera", null], ["mate-race", "yes"], ["breakdown", "yes"], ["rain", null]];
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"] });
try {
  for (const [id, press] of EVENTS) {
    if (only && !only.includes(id)) continue;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { try { localStorage.setItem("kib-cookie-consent", "no"); } catch { /* fine */ } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("pageerror", e.message));
    await page.goto(`${base}/star-drive3d-dev?film=1&bare=1&car=sports&call=none&event=${id}&q=${q}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.waitForFunction(() => !!window.__drive && !!window.__frameStep, null, { timeout: 300000 });
    await page.addStyleTag({ content: ".tr-float,[data-cookie-banner],[class*=\"fixed left-0 top-1/2\"],[data-page-guide],[data-pageguide],.page-guide{display:none!important}" });
    await page.waitForTimeout(800);
    let t = 0, step = 0, pressed = false, raced = false;
    const shot = async (n) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(outDir, `e-${id}-${n}.png`) }); const st = await page.evaluate(() => window.__drive.stats()); console.log(`  ${id} ${n}: ${st.calls} draws, ${st.triangles} triangles (${q})`); };
    while (t < 42) {
      t += 0.2;
      await page.evaluate((tt) => window.__frameStep.seek(tt), t);
      await page.waitForTimeout(30);
      const st = await page.evaluate(() => { const S = window.__drive.S; return { state: S.eventState, racing: S.raceT0 >= 0, phase: S.phase, mph: Math.round(S.car.v * 2.237), v: S.car.v, helpAt: S.helpAt, effects: S.effects }; });
      if (step === 0 && (st.state === "open" || st.state === "done")) {
        // let the set piece come into view a little before the still
        const wait = id === "fan-crossing" ? 0 : id === "breakdown" ? 1.0 : id === "speed-camera" ? 0.6 : id === "mate-race" ? 1.2 : 2.6;
        t += wait; await page.evaluate((tt) => window.__frameStep.seek(tt), t);
        // the fan: the still once the car has stopped for him on the crossing
        if (id === "fan-crossing") for (let k = 0; k < 40; k++) { const v = await page.evaluate(() => window.__drive.S.car.v); if (v < 0.05) break; t += 0.2; await page.evaluate((tt) => window.__frameStep.seek(tt), t); }
        await shot("1-card"); step = 1;
        console.log(id, "card at", t.toFixed(1), "s", st.mph, "mph");
        if (press) { await page.click(`[data-drive-event-answer="${press}"]`).catch((e) => console.error("click", e.message)); pressed = true; }
      } else if (step === 1 && id === "breakdown" && st.helpAt >= 0 && !raced) {
        t += 0.6; await page.evaluate((tt) => window.__frameStep.seek(tt), t);
        await shot("2-pulled-over"); raced = true;
      } else if (step === 1 && st.racing && !raced) {
        t += 2.2; await page.evaluate((tt) => window.__frameStep.seek(tt), t);
        await shot("2-racing"); raced = true;
      } else if (step === 1 && st.state === "done") {
        if (id === "speed-camera") { await page.waitForTimeout(60); await page.screenshot({ path: path.join(outDir, `e-${id}-2-flash.png`) }); t += 0.4; await page.evaluate((tt) => window.__frameStep.seek(tt), t); }
        if (id === "fan-crossing") { t += 0.9; await page.evaluate((tt) => window.__frameStep.seek(tt), t); } // he walks off
        await shot("3-outcome"); step = 2;
        console.log(id, "outcome at", t.toFixed(1), "s", JSON.stringify(st.effects), pressed ? "(pressed yes)" : "");
        break;
      }
    }
    if (step < 2) console.log(id, "did not finish", step);
    await ctx.close();
  }
} finally { await browser.close(); }
