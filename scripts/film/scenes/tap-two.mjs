/**
 * Tap → playing on the seeded feed (Phone → Social), for the first goal video,
 * with nothing made yet: node scripts/film/scenes/tap-feed.mjs <url> <seed> [rate] [shot.jpg]
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { tapToPlaying } from "./tap-timing.mjs";
const [base, seedFile, rateArg, shotPath] = process.argv.slice(2);
const RATE = Number(rateArg || 1);
const seed = JSON.parse(readFileSync(seedFile, "utf8"));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));
pg.on("worker", w => w.on("console", m => console.log("  [w]", m.text())));
const T0 = Date.now();
pg.on("console", m => { if (/\[live\]|\[mk\]/.test(m.text())) console.log("  [p]", m.text()); });
await pg.goto(`${base}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.evaluate(async ({ career, clips }) => {
  localStorage.clear(); localStorage.setItem("kib-admin-mode", "off");
  localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
  localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
  for (const n of ["star-goal-clips", "star-goal-videos"]) await new Promise(res => { const d = indexedDB.deleteDatabase(n); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  const db = await new Promise((res, rej) => { const r = indexedDB.open("star-goal-clips", 1); r.onupgradeneeded = () => { const st = r.result.createObjectStore("clips", { keyPath: "id" }); st.createIndex("createdAt", "createdAt"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction("clips", "readwrite"); for (const c of clips) tx.objectStore("clips").put(c); await new Promise(res => { tx.oncomplete = res; }); db.close();
}, seed);
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.waitForSelector('[data-tour="nav-phone"]', { timeout: 120000 });
await pg.waitForTimeout(1500);
const cdp = await ctx.newCDPSession(pg);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
await pg.locator('[data-tour="nav-phone"]').first().click(); await pg.waitForTimeout(1200);
await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().click();
await pg.waitForSelector("[data-goal-video]", { timeout: 60000 });
// Tap the first goal video, let it play, then tap the next one.
const vids = pg.locator("[data-goal-video]");
await pg.evaluate(() => document.querySelector("[data-goal-video]").scrollIntoView({ block: "center" }));
await pg.waitForTimeout(1500);
const first = await tapToPlaying(pg, vids.first());
await pg.waitForTimeout(4000);
// The next goal video down the feed (drawn only once it comes near).
let second = null;
for (let i = 0; i < 30; i++) {
  const n = await vids.count();
  if (n >= 2) { await vids.nth(1).scrollIntoViewIfNeeded(); await pg.waitForTimeout(1500); second = await tapToPlaying(pg, vids.nth(1)); break; }
  await pg.evaluate(() => document.querySelector("[data-feed-scroll]").scrollBy({ top: 500 })); await pg.waitForTimeout(400);
}
const r = { first, second };
if (shotPath) { await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await pg.screenshot({ path: shotPath, type: "jpeg", quality: 70 }); }
console.log(JSON.stringify({ rate: RATE, ...r, errors: errors.slice(0, 3) }));
await b.close();
