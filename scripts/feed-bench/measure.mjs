/**
 * FEED BENCH — MEASURE. Loads seed.mts's career into /star-dev at phone size
 * (390×844) with the CPU slowed 6× (a cheap phone), opens the Phone feed and
 * times it:
 *   open      tap → first post painted
 *   longest   longest task while the feed opens / while scrolling (ms)
 *   video     tap → first goal video ready to play
 *   reopen    the same, leaving the feed and coming back
 *
 *   node scripts/feed-bench/measure.mjs --seed /tmp/feed-seed.json [--rate 6] [--shots dir]
 * Needs `npm run dev` on :3000 (signed-out play needs dev mode).
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3000");
const RATE = Number(val("--rate", "6"));
const SHOTS = val("--shots", "");
const seed = JSON.parse(readFileSync(val("--seed", "/tmp/feed-seed.json"), "utf8"));
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
// --desktop: a PC window (1440×900, mouse, no phone settings).
const DESKTOP = argv.includes("--desktop");
const ctx = await browser.newContext(DESKTOP
  ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
  : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", e => errors.push(e.message));
browser.on("disconnected", () => console.log("BROWSER GONE"));
pg.on("crash", () => console.log("PAGE CRASHED"));
pg.on("console", m => { if (m.type() === "error" && !/googletagmanager|flagcdn|ERR_TUNNEL|ERR_CERT|status of (4|5)\d\d/i.test(m.text())) errors.push(m.text().slice(0, 200)); });

// Long tasks from the very start, kept on window.
await pg.addInitScript(() => {
  window.__lt = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true }); } catch {}
});
await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
const PLAYER = argv.includes("--player");
// Leo's 24 Oct update switch (lib/star/leoUpdate.ts): the fast feed is behind it.
const LEO = val("--leo", "on") === "on";
await pg.evaluate(async ({ career, clips, player, leo }) => {
  localStorage.clear();
  if (leo) localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
  // --player: a player's phone, not the team's (no admin tab).
  if (player) localStorage.setItem("kib-admin-mode", "off");
  localStorage.setItem("star-career-v2::anon", JSON.stringify(career));
  localStorage.setItem("star-career-phase-v1::anon", JSON.stringify({ phase: "dashboard" }));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now()));
  await new Promise(res => { const d = indexedDB.deleteDatabase("star-goal-clips"); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  await new Promise(res => { const d = indexedDB.deleteDatabase("star-goal-videos"); d.onsuccess = d.onerror = d.onblocked = () => res(); });
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open("star-goal-clips", 1);
    r.onupgradeneeded = () => { const st = r.result.createObjectStore("clips", { keyPath: "id" }); st.createIndex("createdAt", "createdAt"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = db.transaction("clips", "readwrite");
  for (const c of clips) tx.objectStore("clips").put(c);
  await new Promise(res => { tx.oncomplete = res; });
  db.close();
}, { ...seed, player: PLAYER, leo: LEO });
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.waitForTimeout(4000);
// Warm the feed's code once (dev server compiles on first use), then leave it.
await noCookies();
const phoneBtn = pg.locator('[data-tour="nav-phone"]').first();
await phoneBtn.click(); await pg.waitForTimeout(3000);
await pg.locator("button").filter({ hasText: /Social\s*$/ }).first().click().catch(() => {}); await pg.waitForTimeout(8000);
const otherNav = async () => { const b = pg.locator('[data-tour="nav-training"]').first(); await b.click(); await pg.waitForTimeout(2500); };
await otherNav();
// Fresh tab state: nothing made in memory, nothing kept on the phone.
await pg.evaluate(() => new Promise(res => { const d = indexedDB.deleteDatabase("star-goal-videos"); d.onsuccess = d.onerror = d.onblocked = () => res(); }));
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.evaluate(() => new Promise(res => { const d = indexedDB.deleteDatabase("star-goal-videos"); d.onsuccess = d.onerror = d.onblocked = () => res(); }));
await pg.waitForTimeout(4000);

let cdp = await ctx.newCDPSession(pg);

async function socialButton() {
  return pg.locator("button").filter({ hasText: /Social\s*$/ }).first();
}
async function noCookies() {
  const b = pg.locator("button").filter({ hasText: /^\s*No thanks\s*$/ }).first();
  if (await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await pg.waitForTimeout(400); }
}
async function openFeed(label) {
  await noCookies();
  await pg.waitForSelector('[data-tour="nav-phone"]', { timeout: 120000 });
  // The phone first (not timed), at full speed; then the Social app, timed.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await pg.locator('[data-tour="nav-phone"]').first().click();
  await pg.waitForTimeout(1500);
  if (!(await (await socialButton()).isVisible().catch(() => false))) {
    const home = pg.locator("button").filter({ hasText: /^\s*HOME\s*$/i }).first();
    if (await home.isEnabled().catch(() => false)) { await home.click(); await pg.waitForTimeout(1200); }
  }
  await (await socialButton()).waitFor({ state: "visible", timeout: 30000 });
  await pg.waitForTimeout(1000);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  const r = await pg.evaluate(async () => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => /Social\s*$/.test(b.innerText));
    const t0 = performance.now();
    btn.click();
    const raf = () => new Promise(r => requestAnimationFrame(() => r()));
    let painted = null, posts = 0;
    for (let i = 0; i < 2000; i++) {
      await raf();
      const a = document.querySelectorAll("article");
      if (a.length) { await raf(); painted = performance.now() - t0; posts = document.querySelectorAll("article").length; break; }
    }
    // first video ready (or the first still drawn), up to 90 s
    let video = null, still = null;
    const until = t0 + 90000;
    while (performance.now() < until) {
      if (still === null && document.querySelector("[data-goal-video] canvas")) still = performance.now() - t0;
      if (document.querySelector('[data-goal-video-status="ready"]')) { video = performance.now() - t0; break; }
      await new Promise(r => setTimeout(r, 50));
    }
    const lt = window.__lt.filter(([s]) => s >= t0);
    const openLt = lt.filter(([s]) => s < t0 + (painted ?? 0) + 1000);
    return { painted, posts, video, still, t0,
      openLongest: Math.round(Math.max(0, ...openLt.map(x => x[1]))),
      lt10s: lt.filter(([s]) => s < t0 + 10000).map(x => Math.round(x[1])) };
  });
  if (SHOTS) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await pg.screenshot({ path: `${SHOTS}/${label}.jpg`, type: "jpeg", quality: 70, timeout: 120000 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
  }
  return r;
}

async function scrollFeed() {
  await pg.evaluate(n => { window.__steps = n; }, Number(val("--steps", "400")));
  return pg.evaluate(async () => {
    const box = Array.from(document.querySelectorAll(".overflow-y-auto")).filter(el => el.querySelector("article")).sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
    if (!box) return null;
    const t0 = performance.now();
    let steps = 0;
    while (box.scrollTop + box.clientHeight < box.scrollHeight - 2 && steps < Number(window.__steps || 400)) {
      box.scrollTop += 120; steps++;
      await new Promise(r => requestAnimationFrame(() => r()));
      await new Promise(r => setTimeout(r, 30));
    }
    const t1 = performance.now();
    await new Promise(r => setTimeout(r, 500));
    const lt = window.__lt.filter(([s]) => s >= t0 && s <= t1 + 500).map(x => Math.round(x[1]));
    return { ms: Math.round(t1 - t0), steps, height: box.scrollHeight, longTasks: lt.length, longest: Math.max(0, ...lt), over100: lt.filter(x => x > 100).length, total: lt.reduce((a, b) => a + b, 0) };
  });
}

await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
const PROFILE = argv.includes("--profile");
const PROFILE_OPEN = argv.includes("--profile-open");
if (PROFILE_OPEN) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
const first = await openFeed("open-1");
const domPosts = first.posts;
if (PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.start"); }
const TRACE = argv.includes("--trace");
const traceEvents = [];
if (TRACE) {
  cdp.on("Tracing.dataCollected", d => traceEvents.push(...d.value));
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,v8,blink.user_timing", transferMode: "ReportEvents" });
}
const scroll = PROFILE_OPEN ? null : await scrollFeed();
if (TRACE) {
  const ended = new Promise(r => cdp.once("Tracing.tracingComplete", r));
  await cdp.send("Tracing.end"); await ended;
  const main = traceEvents.find(e => e.name === "thread_name" && e.args?.name === "CrRendererMain");
  const ev = traceEvents.filter(e => e.ph === "X" && e.pid === main?.pid && e.tid === main?.tid);
  const tasks = ev.filter(e => e.name === "RunTask" && e.dur > Number(val("--trace-ms", "100")) * 1000).sort((a, b) => b.dur - a.dur);
  console.log(`TRACE long tasks >100ms: ${tasks.length}`);
  for (const t of tasks.slice(0, 14)) {
    const kids = ev.filter(e => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.name !== "RunTask");
    const by = new Map();
    for (const k of kids) {
      // only direct-ish children: top-level kinds
      const name = k.name === "FunctionCall" ? `FunctionCall ${(k.args?.data?.url || "").split("/").slice(-1)[0]}:${k.args?.data?.functionName || ""}` : k.name;
      by.set(name, Math.max(by.get(name) || 0, 0) + k.dur / 1000);
    }
    const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([n, d]) => `${n} ${Math.round(d)}`).join(" | ");
    console.log(`  ${Math.round(t.dur / 1000)} ms: ${top}`);
  }
}
if (PROFILE || PROFILE_OPEN) {
  const { profile } = await cdp.send("Profiler.stop");
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  const dt = profile.timeDeltas; 
  profile.samples.forEach((id, i) => { const n = byId.get(id); const f = n.callFrame; const k = `${f.functionName || "(anon)"} ${f.url.split("/").slice(-2).join("/")}:${f.lineNumber}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  console.log("PROFILE self ms:\n" + top.map(([k, v]) => `${Math.round(v)}\t${k}`).join("\n"));
}
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
if (SHOTS) await pg.screenshot({ path: `${SHOTS}/scrolled.jpg`, type: "jpeg", quality: 70, timeout: 120000 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await otherNav();
const again = await openFeed("open-2");
// A new session (page reload): what the phone kept on disk.
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await pg.reload({ waitUntil: "networkidle", timeout: 180000 });
await pg.waitForTimeout(4000);
cdp = await ctx.newCDPSession(pg);
const reload = await openFeed("open-3-reload");

const f = v => v === null || v === undefined ? "—" : `${Math.round(v)} ms`;
console.log(`${DESKTOP ? "DESKTOP 1440×900 · " : ""}${PLAYER ? "player view" : "admin view (team)"} · update ${LEO ? "on" : "off"} · CPU ${RATE}× · ${DESKTOP ? "1440×900" : "390×844"} · posts in seed ${seed.career.media.posts.length}`);
console.log(`open (first)     painted ${f(first.painted)} · posts drawn ${domPosts} · longest task while opening ${first.openLongest} ms · still ${f(first.still)} · first video ready ${f(first.video)}`);
console.log(`long tasks 10 s after open: ${first.lt10s.length} (longest ${Math.max(0, ...first.lt10s)} ms, >100ms: ${first.lt10s.filter(x => x > 100).length})`);
console.log(`scroll           ${JSON.stringify(scroll)}`);
console.log(`open (again)     painted ${f(again.painted)} · longest ${again.openLongest} ms · first video ready ${f(again.video)}`);
console.log(`open (new visit) painted ${f(reload.painted)} · longest ${reload.openLongest} ms · first video ready ${f(reload.video)}`);
console.log(`errors: ${errors.length ? [...new Set(errors)].slice(0, 6).join(" | ") : "none"}`);
console.log("JSON " + JSON.stringify({ first, scroll, again, reload }));
await browser.close();
