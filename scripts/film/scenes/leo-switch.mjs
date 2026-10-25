/** Feed with Leo's 24 Oct update off or on: node leo-switch.mjs <url> <seed> on|off <shot.jpg> */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const [base, seedFile, mode, shot] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedFile, "utf8"));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = []; pg.on("pageerror", e => errors.push(e.message));
await pg.goto(`${base}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.evaluate(async ({ career, clips, on }) => {
  localStorage.clear(); localStorage.setItem("kib-admin-mode", "off");
  if (on) localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
  localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
  localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
  for (const n of ["star-goal-clips", "star-goal-videos"]) await new Promise(res => { const d = indexedDB.deleteDatabase(n); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  const db = await new Promise((res, rej) => { const r = indexedDB.open("star-goal-clips", 1); r.onupgradeneeded = () => { const st = r.result.createObjectStore("clips", { keyPath: "id" }); st.createIndex("createdAt", "createdAt"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction("clips", "readwrite"); for (const c of clips) tx.objectStore("clips").put(c); await new Promise(res => { tx.oncomplete = res; }); db.close();
}, { ...seed, on: mode === "on" });
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.waitForSelector('[data-tour="nav-phone"]', { timeout: 120000 });
await pg.locator('[data-tour="nav-phone"]').first().click(); await pg.waitForTimeout(1200);
await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().click();
await pg.waitForTimeout(4000);
// Down to where the Goal of the Month poll is (when there is one), else the first video post.
await pg.evaluate(async () => {
  const box = document.querySelector("[data-feed-scroll]");
  for (let i = 0; i < 40 && !Array.from(document.querySelectorAll("article")).some(x => /Goal of the Month\. /.test(x.innerText)) && box.scrollTop + box.clientHeight < box.scrollHeight - 4; i++) {
    box.scrollBy({ top: 400 }); await new Promise(r => setTimeout(r, 200));
  }
  const arts = Array.from(document.querySelectorAll("article"));
  const a = arts.find(x => /Goal of the Month\. /.test(x.innerText)) ?? arts.find(x => x.querySelector("[data-goal-video]"));
  a?.scrollIntoView({ block: "start" });
});
await pg.waitForTimeout(4000);
const st = await pg.evaluate(() => ({
  articles: document.querySelectorAll("article").length,
  slots: document.querySelectorAll("[data-feed-slot]").length,
  gotm: Array.from(document.querySelectorAll("article")).filter(x => /Goal of the Month/.test(x.innerText)).length,
  videos: document.querySelectorAll("[data-goal-video]").length,
  workers: performance.getEntriesByType("resource").filter(e => /clip_worker/.test(e.name)).length,
}));
await pg.screenshot({ path: shot, type: "jpeg", quality: 72 });
console.log(mode, JSON.stringify(st), errors.length ? errors.slice(0, 2) : "no errors");
await b.close();
