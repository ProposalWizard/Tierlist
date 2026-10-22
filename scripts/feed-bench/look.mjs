/**
 * FEED BENCH — LOOK. Loads the seed, opens Phone → Social at full speed,
 * waits, and reports what the goal videos did, plus a phone-size still.
 *   node scripts/feed-bench/look.mjs --seed f --shot out.jpg [--wait ms] [--scroll px]
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const seed = JSON.parse(readFileSync(val("--seed", "/tmp/feed-seed.json"), "utf8"));
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));
pg.on("console", m => { const t = m.text(); if ((m.type() === "error" || /worker/i.test(t)) && !/googletagmanager|flagcdn|ERR_TUNNEL|club_logos|status of (4|5)\d\d/i.test(t)) errors.push(m.type() + ": " + t.slice(0, 300)); });
pg.on("worker", w => { console.log("worker started:", w.url().slice(0, 90)); w.on("console", m => console.log("  [worker]", m.text().slice(0, 200))); });
await pg.goto(`${val("--url", "http://localhost:3000")}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.evaluate(async ({ career, clips }) => {
  localStorage.clear();
  localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
  localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
  for (const n of ["star-goal-clips", "star-goal-videos"]) await new Promise(res => { const d = indexedDB.deleteDatabase(n); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  const db = await new Promise((res, rej) => { const r = indexedDB.open("star-goal-clips", 1); r.onupgradeneeded = () => { const st = r.result.createObjectStore("clips", { keyPath: "id" }); st.createIndex("createdAt", "createdAt"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction("clips", "readwrite"); for (const c of clips) tx.objectStore("clips").put(c); await new Promise(res => { tx.oncomplete = res; }); db.close();
}, seed);
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.waitForSelector('[data-tour="nav-phone"]', { timeout: 120000 });
await pg.locator('[data-tour="nav-phone"]').first().click(); await pg.waitForTimeout(1500);
await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().click();
await pg.waitForTimeout(Number(val("--wait", "30000")));
const px = Number(val("--scroll", "0"));
if (px > 0) { await pg.evaluate(px => { const box = document.querySelector("[data-feed-scroll]"); if (box) box.scrollTop = px; }, px); await pg.waitForTimeout(4000); }
if (px < 0) { await pg.evaluate(n => { const v = document.querySelectorAll("[data-goal-video]")[-n - 1]; v?.scrollIntoView({ block: "center" }); }, px); await pg.waitForTimeout(6000); }
const st = await pg.evaluate(() => ({
  slots: document.querySelectorAll("[data-feed-slot]").length,
  drawn: document.querySelectorAll('[data-feed-slot="drawn"]').length,
  videos: Array.from(document.querySelectorAll("[data-goal-video]")).map(e => e.getAttribute("data-goal-video-status")),
}));
console.log(JSON.stringify(st));
await pg.screenshot({ path: val("--shot", "/tmp/look.jpg"), type: "jpeg", quality: 70 });
console.log("errors:", errors.length ? [...new Set(errors)].slice(0, 8).join("\n") : "none");
await b.close();
