/**
 * Phone close-ups (390 wide) of posts with replies (Leo, round 4): ordinary
 * threads, arguments ("Replying to @…") and TikTok comment sections.
 *   node scripts/football-twitter/replyStills.mjs <port> <seed.json> <outDir> [each=4]
 * Seed from scripts/football-twitter/seed.mts. Needs a server with
 * NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (dev or built). Same set-up as stills.mjs.
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const [port, seedFile, outDir, eachArg] = process.argv.slice(2);
const EACH = Number(eachArg ?? 4);
mkdirSync(outDir, { recursive: true });
const exe = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));

const seed = JSON.parse(readFileSync(seedFile, "utf8"));
await pg.goto(`http://localhost:${port}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await pg.evaluate(async ({ career }) => {
  localStorage.clear();
  localStorage.setItem("kib-admin-mode", "off");
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
  localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
  localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
}, seed);
await pg.reload({ waitUntil: "networkidle", timeout: 300000 });
const noThanks = pg.locator("button").filter({ hasText: /No thanks/i }).first();
if (await noThanks.count()) await noThanks.click().catch(() => {});
await pg.waitForSelector('[data-tour="nav-phone"]', { timeout: 180000 });
await pg.waitForTimeout(1500);
if (await noThanks.count()) await noThanks.click().catch(() => {});
await pg.locator('[data-tour="nav-phone"]').first().tap();
await pg.waitForTimeout(1200);
await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().tap();
await pg.waitForTimeout(2500);
await pg.screenshot({ path: path.join(outDir, "feed-top.jpg"), type: "jpeg", quality: 80 });

const kinds = [
  ["article:has([data-tiktok-comments])", "tiktok-comments"],
  ["article:has([data-reply-to])", "argument"],
  ["article:has([data-replies])", "thread"],
];
const shot = Object.fromEntries(kinds.map(([, n]) => [n, new Set()]));
const texts = [];
for (let step = 0; step < 80; step++) {
  for (const [sel, name] of kinds) {
    const els = pg.locator(sel);
    for (let i = 0; i < await els.count(); i++) {
      if (shot[name].size >= EACH) break;
      const el = els.nth(i);
      const key = (await el.innerText()).slice(0, 120);
      if ([...Object.values(shot)].some(s => s.has(key))) continue;
      shot[name].add(key);
      // A post taller than the screen (a TikTok video) is clipped by the feed's
      // scroller: show its replies on screen and take the screen instead.
      const replies = el.locator("[data-tiktok-comments], [data-replies]").first();
      await replies.evaluate(r => r.scrollIntoView({ block: "end" })).catch(() => {});
      await pg.waitForTimeout(400);
      const box = await el.boundingBox();
      const file = path.join(outDir, `${name}-${shot[name].size}.jpg`);
      if (box && box.height > 780) await pg.screenshot({ path: file, type: "jpeg", quality: 82 });
      else await el.screenshot({ path: file, type: "jpeg", quality: 82 }).catch(() => {});
      texts.push(`[${name}]\n${await el.innerText()}`);
    }
  }
  if (Object.values(shot).every(s => s.size >= EACH)) break;
  const atEnd = await pg.evaluate(() => { const b = document.querySelector("[data-feed-scroll]"); b.scrollBy({ top: 600 }); return b.scrollTop + b.clientHeight >= b.scrollHeight - 4; });
  await pg.waitForTimeout(700);
  if (atEnd) break;
}
writeFileSync(path.join(outDir, "stills-text.txt"), texts.join("\n\n-----\n\n"));
console.log(JSON.stringify(Object.fromEntries(Object.entries(shot).map(([k, v]) => [k, v.size]))), errors.length ? `page errors: ${errors.slice(0, 3).join(" | ")}` : "no page errors");
await browser.close();
