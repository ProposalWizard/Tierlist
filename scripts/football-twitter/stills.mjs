/**
 * Phone stills (390×844) of the Football Twitter feed, scrolling down.
 *   node scripts/football-twitter/stills.mjs <port> <seed.json> <outDir> [count=12]
 * Needs a built server with NEXT_PUBLIC_STAR_OFFLINE_DEV=1. Turns Leo's
 * update switch on (every part, so "footballTwitter" too).
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const [port, seedFile, outDir, countArg] = process.argv.slice(2);
const COUNT = Number(countArg ?? 12);
mkdirSync(outDir, { recursive: true });
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));

const seed = JSON.parse(readFileSync(seedFile, "utf8"));
await pg.goto(`http://localhost:${port}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.evaluate(async ({ career, clips }) => {
  localStorage.clear();
  localStorage.setItem("kib-admin-mode", "off");
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
  localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
  localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
  for (const n of ["star-goal-clips", "star-goal-videos"]) await new Promise(res => { const d = indexedDB.deleteDatabase(n); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  const db = await new Promise((res, rej) => { const r = indexedDB.open("star-goal-clips", 1); r.onupgradeneeded = () => { const st = r.result.createObjectStore("clips", { keyPath: "id" }); st.createIndex("createdAt", "createdAt"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction("clips", "readwrite"); for (const c of clips) tx.objectStore("clips").put(c); await new Promise(res => { tx.oncomplete = res; }); db.close();
}, seed);
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
const noThanks = pg.locator("button").filter({ hasText: /No thanks/i }).first();
if (await noThanks.count()) await noThanks.click().catch(() => {});
await pg.waitForSelector('[data-tour="nav-phone"]', { timeout: 120000 });
await pg.waitForTimeout(1500);
if (await noThanks.count()) await noThanks.click().catch(() => {});
await pg.locator('[data-tour="nav-phone"]').first().tap();
await pg.waitForTimeout(1200);
await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().tap();
await pg.waitForTimeout(2500);

const texts = [];
for (let i = 0; i < COUNT; i++) {
  await pg.screenshot({ path: path.join(outDir, `feed-${String(i + 1).padStart(2, "0")}.jpg`), type: "jpeg", quality: 80 });
  texts.push(...await pg.evaluate(() => Array.from(document.querySelectorAll("[data-feed-scroll] article")).map(a => a.innerText)));
  const atEnd = await pg.evaluate(() => { const b = document.querySelector("[data-feed-scroll]"); b.scrollBy({ top: 700 }); return b.scrollTop + b.clientHeight >= b.scrollHeight - 4; });
  await pg.waitForTimeout(900);
  if (atEnd) break;
}
// Close-ups (feed v2): TikTok posts (sound line, TikTok counts) and quotes that carry their video.
// The feed only keeps posts near the screen, so walk it again from the top.
await pg.evaluate(() => document.querySelector("[data-feed-scroll]").scrollTo({ top: 0 }));
await pg.waitForTimeout(900);
const shot = { tiktok: new Set(), "quote-video": new Set() };
for (let step = 0; step < 60; step++) {
  for (const [sel, name] of [["article[data-tiktok]", "tiktok"], ["article:has([data-quote-video])", "quote-video"]]) {
    const els = pg.locator(sel);
    for (let i = 0; i < await els.count(); i++) {
      const el = els.nth(i);
      const key = (await el.innerText().catch(() => "")).slice(0, 80);
      if (!key || shot[name].has(key) || shot[name].size >= 3) continue;
      shot[name].add(key);
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await pg.waitForTimeout(1500);
      await el.screenshot({ path: path.join(outDir, `${name}-${shot[name].size}.jpg`), type: "jpeg", quality: 82 }).catch(e => console.log(`${name}: ${e.message}`));
    }
  }
  const atEnd = await pg.evaluate(() => { const b = document.querySelector("[data-feed-scroll]"); b.scrollBy({ top: 500 }); return b.scrollTop + b.clientHeight >= b.scrollHeight - 4; });
  await pg.waitForTimeout(500);
  if (atEnd) break;
}
console.log(`close-ups: ${shot.tiktok.size} TikTok, ${shot["quote-video"].size} quote-video`);
const uniq = [...new Set(texts)];
const bad = uniq.filter(t => /undefined|NaN|\{|\}/.test(t));
console.log(`${uniq.length} posts seen; ${bad.length} with holes`, bad.slice(0, 3));
console.log(errors.length ? `page errors: ${[...new Set(errors)].slice(0, 3).join(" | ")}` : "no page errors");
await browser.close();
