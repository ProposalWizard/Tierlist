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
const DESKTOP = process.argv.includes("--desktop");
const ctx = await b.newContext(DESKTOP ? { viewport: { width: 1440, height: 900 } } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));
pg.on("worker", w => w.on("console", m => console.log("  [w]", m.text())));
const T0 = Date.now();
pg.on("console", m => { if (/\[live\]|\[mk\]/.test(m.text())) console.log("  [p]", m.text()); });
await pg.goto(`${base}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.evaluate(async ({ career, clips }) => {
  localStorage.clear(); localStorage.setItem("kib-admin-mode", "off");
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
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
{ const nt = pg.locator("button").filter({ hasText: /^\s*No thanks\s*$/ }).first(); if (await nt.isVisible().catch(() => false)) await nt.click(); }
await pg.locator('[data-tour="nav-phone"]').first().click(); await pg.waitForTimeout(1200);
await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().click();
await pg.waitForSelector("[data-goal-video]", { timeout: 60000 });
await pg.evaluate(() => document.querySelector("[data-goal-video]").scrollIntoView({ block: "center" }));
await pg.waitForTimeout(1500);
const w = pg.locator("[data-goal-video]").first();
const status = await w.getAttribute("data-goal-video-status");
const r = await tapToPlaying(pg, w);
await pg.waitForTimeout(2500);
const after = await pg.evaluate(() => ({ live: document.querySelector("[data-goal-video-live]")?.getAttribute("data-goal-video-live"), status: document.querySelector("[data-goal-video]")?.getAttribute("data-goal-video-status") }));
if (shotPath) { await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }); await pg.screenshot({ path: shotPath, type: "jpeg", quality: 70 }); }
console.log(JSON.stringify({ rate: RATE, statusAtTap: status, ...r, after, errors: errors.slice(0, 3) }));
await b.close();
