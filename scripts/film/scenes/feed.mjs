/**
 * FILM SCENES — THE SOCIAL FEED (chat 2, 22–23 Oct 2026).
 *
 *   node scripts/film/scenes/feed.mjs <port> <scene> <outDir> [--seed f] [--rate 4]
 *   scenes: feed-scroll | feed-video | gotm-vote
 *
 * Each scene opens a seeded save (scripts/feed-bench/seed.mts: 20 matches for
 * the scroll and video, 17 for an OPEN Goal of the Month poll), goes Phone →
 * Social, and films the phone at 390×844 with rec.mjs. Writes <scene>.mp4
 * (390 wide, H.264) and <scene>.jpg into outDir. Needs a built server with
 * NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (signed-out play).
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { showTouches, startRec, stopRec, shot } from "../rec.mjs";

const [port, scene, outDir] = process.argv.slice(2);
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = `http://localhost:${port}`;
const RATE = Number(val("--rate", scene === "feed-scroll" ? "4" : "1"));
const seedFile = val("--seed", "/tmp/feed-seed.json");
mkdirSync(outDir, { recursive: true });

const exe = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: existsSync(exe) ? exe : undefined, args: ["--disable-dev-shm-usage"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await showTouches(ctx);
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));

// ── Open the seeded save (a player's phone: no admin tab) ────────────────────
const seed = JSON.parse(readFileSync(seedFile, "utf8"));
await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.evaluate(async ({ career, clips }) => {
  localStorage.clear();
  localStorage.setItem("kib-admin-mode", "off");
  localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
  localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
  for (const n of ["star-goal-clips", "star-goal-videos"]) await new Promise(res => { const d = indexedDB.deleteDatabase(n); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  const db = await new Promise((res, rej) => { const r = indexedDB.open("star-goal-clips", 1); r.onupgradeneeded = () => { const st = r.result.createObjectStore("clips", { keyPath: "id" }); st.createIndex("createdAt", "createdAt"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const tx = db.transaction("clips", "readwrite"); for (const c of clips) tx.objectStore("clips").put(c); await new Promise(res => { tx.oncomplete = res; }); db.close();
}, seed);
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.waitForSelector('[data-tour="nav-phone"]', { timeout: 120000 });
await pg.waitForTimeout(2000);
await pg.locator('[data-tour="nav-phone"]').first().tap();
await pg.waitForTimeout(1500);
const social = pg.locator("button").filter({ hasText: /Social\s*$/ }).first();
await social.waitFor({ state: "visible", timeout: 30000 });

const cdp = await ctx.newCDPSession(pg);
if (RATE > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });

/** Scroll the feed the way a thumb flick does: a smooth glide of `dy` px. */
async function swipe(dy, ms = 420) {
  await pg.evaluate(dy => document.querySelector("[data-feed-scroll]").scrollBy({ top: dy, behavior: "smooth" }), dy);
  await pg.waitForTimeout(ms);
}
async function scrollToArticle(re, maxSwipes = 40) {
  for (let i = 0; i < maxSwipes; i++) {
    const hit = await pg.evaluate((src) => {
      const re = new RegExp(src);
      const box = document.querySelector("[data-feed-scroll]").getBoundingClientRect();
      const a = Array.from(document.querySelectorAll("article")).find(x => re.test(x.innerText));
      if (!a) return null;
      const r = a.getBoundingClientRect();
      return { top: r.top - box.top, h: box.height };
    }, re.source);
    if (hit && hit.top > 0 && hit.top < hit.h * 0.45) return true;
    await swipe(hit ? Math.max(120, Math.min(600, hit.top - 60)) : 600, 450);
  }
  return false;
}
const tmp = path.join(outDir, `${scene}.raw.mp4`);
let rec;

if (scene === "feed-scroll") {
  rec = await startRec(pg);
  await pg.waitForTimeout(500);
  await social.tap();
  await pg.waitForTimeout(1800);
  // Top to bottom at a natural thumb speed.
  for (let i = 0; i < 40; i++) {
    const atEnd = await pg.evaluate(() => { const b = document.querySelector("[data-feed-scroll]"); return b.scrollTop + b.clientHeight >= b.scrollHeight - 4; });
    if (atEnd) break;
    await swipe(620, 520);
  }
  await pg.waitForTimeout(1500);
} else if (scene === "feed-video") {
  rec = await startRec(pg);
  await pg.waitForTimeout(500);
  await social.tap();
  await pg.waitForTimeout(900);
  await scrollToArticle(/HIGHLIGHTS \|/);
  // Still at once; wait until it is made, then play it.
  await pg.waitForSelector('[data-goal-video-status="ready"]', { timeout: 60000 });
  await pg.waitForTimeout(700);
  const play = pg.locator("[data-goal-video-press-play]").first();
  if (await play.count()) await play.tap(); else await pg.locator("[data-goal-video-playing]").first().tap();
  await pg.waitForTimeout(7500);
} else if (scene === "gotm-vote") {
  rec = await startRec(pg);
  await pg.waitForTimeout(500);
  await social.tap();
  await pg.waitForTimeout(900);
  await scrollToArticle(/Goal of the Month\. /);
  const poll = pg.locator("article").filter({ hasText: /Goal of the Month\. / }).first();
  await poll.locator('[data-goal-video-status="ready"]').first().waitFor({ timeout: 60000 }).catch(() => {});
  await pg.waitForTimeout(500);
  // Watch a goal: play the poll's video.
  const play = poll.locator("[data-goal-video-press-play], [data-goal-video-play]").first();
  if (await play.count()) { await play.click({ force: true }); await pg.waitForTimeout(4500); }
  // Down to the list, then vote for the second goal.
  await swipe(300, 900);
  await poll.locator("button").filter({ hasText: /^\s*Vote\s*$/ }).nth(1).click({ force: true });
  await pg.locator("text=You voted").first().waitFor({ timeout: 8000 });
  await pg.waitForTimeout(2500);
} else {
  throw new Error("unknown scene " + scene);
}

await stopRec(rec, tmp, { holdEnd: 0.6 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
await shot(pg, path.join(outDir, `${scene}.jpg`)).catch(async () => { await pg.screenshot({ path: path.join(outDir, `${scene}.jpg`), type: "jpeg", quality: 75 }); });
// 390 wide, small enough to send in WhatsApp.
const out = path.join(outDir, `${scene}.mp4`);
const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-vf", "scale=390:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-movflags", "+faststart", "-an", out]);
if (r.status !== 0) throw new Error(String(r.stderr));
spawnSync("rm", ["-f", tmp]);
console.log(`${scene}: ${out}`, errors.length ? `errors: ${[...new Set(errors)].slice(0, 3).join(" | ")}` : "no page errors");
await browser.close();
