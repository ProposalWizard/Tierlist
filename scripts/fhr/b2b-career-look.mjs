// B2b: one quick look in the REAL game (the career match, /star-dev, signed
// out — lib/star/devMode.ts) at 390x844 with Full highlights rebuild On.
// Gets into a match the way the drift audit's career-match.mjs does (the
// priority buttons, the dev "sim whole trial"), then waits for a build-up and
// takes a still mid-build-up and at the hand-over; prints the pitch width,
// the build-up the career built, and any page errors.
//
//   node scripts/fhr/b2b-career-look.mjs [--url=http://localhost:3062] [--out=docs/handoffs/2026-10-20-builds/b2b] [--profile=<dir>]
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3062");
const OUT = arg("out", "docs/handoffs/2026-10-20-builds/b2b");
const PROFILE = arg("profile", mkdtempSync(path.join(os.tmpdir(), "b2b-career-")));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--disable-dev-shm-usage"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
});
await ctx.addInitScript(() => { localStorage.setItem("star-fhr", "on"); localStorage.setItem("star-match-speed", "8"); });
const pg = ctx.pages()[0] || await ctx.newPage();
const errors = [];
pg.on("pageerror", (e) => errors.push(e.message));
await pg.goto(`${URL0}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(9000);
const PRIORITY = [/^SIM WHOLE TRIAL/i, /Play Match|Kick Off|KICK OFF/i, /Team sheets/i, /^▶ *Play|^Play$/i, /TAP TO HEAR|Continue|Next|Accept|Sign|Start Career|Skip|Done|OK|Close|Let's go|Begin/i];
const inMatch = () => pg.evaluate(() => !!window.__starMatch && !!document.querySelector("canvas"));
for (let i = 0; i < 60 && !(await inMatch()); i++) {
  if (await pg.locator("input:visible").count()) {
    const ins = pg.locator("input:visible");
    if (await ins.count() >= 2) { await ins.nth(0).fill("Leo").catch(() => {}); await ins.nth(1).fill("Vance").catch(() => {}); }
  }
  let clicked = false;
  for (const re of PRIORITY) {
    const b = pg.locator("button:visible").filter({ hasText: re }).first();
    if (await b.count()) { try { await b.click({ timeout: 3000 }); clicked = true; break; } catch { /* next */ } }
  }
  if (!clicked) await pg.mouse.click(195, 420);
  await wait(2500);
}
console.log("in the match:", await inMatch());
// Wait for a build-up (shoot any chance that comes without one, so the match moves on).
let got = false;
for (let i = 0; i < 900 && !got; i++) {
  const lab = await pg.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null);
  if (lab) {
    got = true;
    await wait(1200);
    await pg.screenshot({ path: `${OUT}/b2b-career-buildup.jpg`, type: "jpeg", quality: 74 });
    console.log("still:", `${OUT}/b2b-career-buildup.jpg`, "—", lab, JSON.stringify(await pg.evaluate(() => globalThis.__starLastBuildUp ?? null)));
    for (let j = 0; j < 300; j++) { if (!(await pg.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null))) break; await wait(50); }
    await wait(250);
    await pg.screenshot({ path: `${OUT}/b2b-career-handover.jpg`, type: "jpeg", quality: 74 });
    console.log("still:", `${OUT}/b2b-career-handover.jpg`);
    const box = await pg.evaluate(() => { const c = document.querySelector("canvas"); const r = c?.parentElement?.getBoundingClientRect(); return r ? `${Math.round(r.width)}x${Math.round(r.height)}` : null; });
    console.log("pitch box:", box);
    break;
  }
  const ph = await pg.evaluate(() => window.__starMatch?.phase?.());
  if (ph === "aim" && i % 30 === 29) {
    const b = await pg.evaluate(() => window.__starMatch?.ball?.());
    if (b) { await pg.mouse.move(b.x, b.y); await pg.mouse.down(); for (let k = 1; k <= 10; k++) { await pg.mouse.move(b.x, b.y + 9 * k); await wait(16); } await pg.mouse.up(); await wait(700);
      const ball = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
      if (await ball.count()) { const bb = await ball.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2); } }
  }
  if (i % 40 === 39) { const b = pg.locator("button:visible").filter({ hasText: /continue|second half|kick off|play on|resume/i }).first(); if (await b.count()) await b.click({ timeout: 2000 }).catch(() => {}); }
  await wait(200);
}
console.log("build-up seen:", got, "errors:", errors.length ? [...new Set(errors)].slice(0, 5) : "none");
await ctx.close();
