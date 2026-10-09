/**
 * SPEED MEASUREMENTS for app start and the 2D match (speed job D, 9 Oct 2026).
 *
 * Against a production server (`next build && next start`, built with
 * NEXT_PUBLIC_STAR_OFFLINE_DEV=1 so a signed-out save plays). Phone-sized,
 * CPU slowed 4x and the network held to "Fast 4G" (9 Mbit/s, 150 ms) — about
 * a mid iPhone on mobile data.
 *
 *   npx tsx scripts/perf2d/make-save.mts > /tmp/save.json
 *   node scripts/perf2d/measure.mjs http://localhost:3123 /tmp/save.json [shotsDir]
 *
 * Prints one JSON object: JS downloaded before Home could be tapped (cold and
 * warm), time to Home, long tasks on Home, time from KICK OFF to the first
 * match frame, frame times and long tasks in the match, React commits a
 * second during the match.
 */
import { chromium, devices } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const BASE = process.argv[2] || "http://localhost:3123";
const SAVE = JSON.parse(readFileSync(process.argv[3], "utf8"));
const SHOTS = process.argv[4];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 13"] });

// Before any page script: the save, a long-task log and a React commit counter.
await ctx.addInitScript((save) => {
  try { if (!localStorage.getItem("perf-seeded")) { for (const [k, v] of Object.entries(save)) localStorage.setItem(k, v); localStorage.setItem("perf-seeded", "1"); } } catch {}
  window.__perf = { long: [], commits: 0 };
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__perf.long.push([Math.round(e.startTime), Math.round(e.duration)]); })
      .observe({ type: "longtask", buffered: true });
  } catch {}
  // React reports every commit to the devtools hook, production builds too.
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true, renderers: new Map(), inject() { return 1; },
    onCommitFiberRoot() { window.__perf.commits++; }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    checkDCE() {},
  };
}, SAVE);

const pg = await ctx.newPage();
const cdp = await ctx.newCDPSession(pg);
await cdp.send("Network.enable");
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 });

const errors = [];
pg.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));

// Bytes per request (encoded, on the wire), with the time each finished.
let reqs = new Map();
cdp.on("Network.responseReceived", (e) => { const r = reqs.get(e.requestId) || {}; r.url = e.response.url; r.type = e.type; r.cached = e.response.fromDiskCache || e.response.fromMemoryCache || e.response.status === 304; reqs.set(e.requestId, r); });
cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId) || {}; r.bytes = e.encodedDataLength; r.done = Date.now(); reqs.set(e.requestId, r); });

const shot = async (n) => { if (SHOTS) await pg.screenshot({ path: `${SHOTS}/${n}.png` }); };

/** Wait until the career screen answers taps: a visible button, then no long task for 1 s. */
async function load(label) {
  reqs = new Map();
  const t0 = Date.now();
  await pg.goto(`${BASE}/star-dev`, { waitUntil: "commit" });
  await pg.locator("button:visible").first().waitFor({ timeout: 120000 });
  const tButton = Date.now() - t0;
  // Quiet: no long task in the last second (checked against the page's own log).
  let tQuiet = null;
  for (let i = 0; i < 240; i++) {
    const q = await pg.evaluate(() => { const now = performance.now(); const l = window.__perf.long; const last = l.length ? l[l.length - 1][0] + l[l.length - 1][1] : 0; return now - last > 1000 ? last : null; });
    if (q !== null) { tQuiet = q; break; }
    await pg.waitForTimeout(250);
  }
  const navStart = await pg.evaluate(() => performance.timeOrigin);
  const cut = navStart + (tQuiet ?? 0) + 1000;
  const js = [...reqs.values()].filter((r) => r.type === "Script" && r.done && r.done <= Math.max(cut, t0 + tButton));
  const kb = (a) => Math.round(a.reduce((s, r) => s + (r.bytes || 0), 0) / 1024);
  const res = {
    label, msToFirstButton: tButton, msToHomeQuiet: tQuiet, jsFiles: js.length, jsKBOnWire: kb(js),
    jsFromNetworkKB: kb(js.filter((r) => !r.cached)),
    longTasksDuringLoad: await pg.evaluate(() => window.__perf.long.length),
    longestTaskMs: await pg.evaluate(() => Math.max(0, ...window.__perf.long.map((l) => l[1]))),
  };
  await shot(label);
  return res;
}

const out = {};
out.cold = await load("cold");
out.warm = await load("warm");

// Ten seconds on Home doing nothing: long tasks and commits.
await pg.evaluate(() => { window.__perf.long = []; window.__perf.commits = 0; });
await pg.waitForTimeout(10000);
out.homeIdle10s = await pg.evaluate(() => ({ longTasks: window.__perf.long.length, longTaskMs: window.__perf.long.reduce((s, l) => s + l[1], 0), commits: window.__perf.commits }));

// Swipe through Home's pages once: long tasks per swipe.
const texts = async () => (await pg.locator("button:visible").allInnerTexts()).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
out.homeButtons = (await texts()).slice(0, 25);

// Into the match: tap through whatever stands between Home and kick-off.
const tap = async (re, timeout = 3000) => {
  const b = pg.locator("button:visible").filter({ hasText: re }).first();
  try { await b.waitFor({ state: "visible", timeout }); await b.click(); return true; } catch { return false; }
};
const route = [];
for (let i = 0; i < 30; i++) {
  if (route.some((r) => /KICK OFF|Play Match/.test(r))) break;
  const btns = await texts();
  const pick = [/KICK OFF/i, /Team sheets/i, /Play Match/i, /^NEXT/i, /Got it/i, /^Done/i, /^Skip/i, /^Continue/i, /^Close/i, /Let.s go/i, /^▶? *PLAY$/i]
    .find((re) => btns.some((b) => re.test(b)));
  if (!pick) { route.push("stuck: " + btns.slice(0, 10).join(" | ")); break; }
  const isKick = /KICK OFF|Play Match/.test(String(pick));
  if (isKick) await pg.evaluate(() => { document.querySelectorAll("canvas").forEach((c) => { c.dataset.before = "1"; }); window.__kick = performance.now(); window.__perf.long = []; window.__perf.commits = 0; });
  await tap(pick);
  route.push(String(pick));
  await pg.waitForTimeout(isKick ? 50 : 1500);
}
out.route = route;
await shot("route-end");

// First drawn frame of the match canvas: poll its pixels.
const tFirst = await pg.evaluate(async () => {
  const t0 = window.__kick ?? performance.now();
  for (let i = 0; i < 600; i++) {
    for (const c of document.querySelectorAll("canvas")) {
      if (c.dataset.before || c.getBoundingClientRect().height < 300 || c.width === 0) continue;
      const g = c.getContext("2d"); // null on a 3D canvas
      if (!g) continue;
      const d = g.getImageData(c.width / 2, c.height / 2, 1, 1).data;
      if (d[3] > 0) return performance.now() - t0;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
});
out.msKickOffToFirstFrame = tFirst === null ? null : Math.round(tFirst);
out.kickOffLongTasks = await pg.evaluate(() => { const l = window.__perf.long; return { count: l.length, totalMs: l.reduce((s, x) => s + x[1], 0), worstMs: Math.max(0, ...l.map((x) => x[1])) }; });

// On the bench: the commentary runs until you are sent on. Tap through and
// time the pitch's first frame from that tap.
const getOut = pg.locator("button:visible").filter({ hasText: /GET OUT THERE|Come on|Go on/i }).first();
try {
  await getOut.waitFor({ state: "visible", timeout: 30000 });
  await pg.evaluate(() => { document.querySelectorAll("canvas").forEach((c) => { if (c.getBoundingClientRect().height >= 300) c.dataset.before = "1"; else delete c.dataset.before; }); window.__kick = performance.now(); window.__perf.long = []; });
  await getOut.click();
  // The match is up when its dev hook says it is waiting for your aim, plus one drawn frame.
  const t = await pg.evaluate(async () => {
    const t0 = window.__kick;
    for (let i = 0; i < 1200; i++) {
      if (window.__starMatch && window.__starMatch.phase() === "aim") {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return performance.now() - t0;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    return null;
  });
  out.msGetOutToFirstPitchFrame = t === null ? null : Math.round(t);
  out.getOutLongTasks = await pg.evaluate(() => { const l = window.__perf.long; return { count: l.length, totalMs: l.reduce((s, x) => s + x[1], 0), worstMs: Math.max(0, ...l.map((x) => x[1])) }; });
  await pg.waitForTimeout(1500);
} catch { out.msGetOutToFirstPitchFrame = "not on the bench"; }

// The match running: frame times, long tasks, React commits. Two windows:
// 5 s waiting to aim, then a real kick (pull back from the ball, tap the
// contact ball) and 6 s of the ball in flight and everyone moving.
async function window_(ms) {
  await pg.evaluate(() => { window.__perf.long = []; window.__perf.commits = 0; });
  const frames = await pg.evaluate(async (ms) => {
    const d = []; let last = performance.now(); const end = last + ms;
    await new Promise((res) => { const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    return d;
  }, ms);
  frames.sort((a, b) => a - b);
  const pct = (q) => Math.round(frames[Math.min(frames.length - 1, Math.floor(frames.length * q))] * 10) / 10;
  return {
    frames: frames.length, fps: Math.round(frames.length / (ms / 1000)), p50ms: pct(0.5), p95ms: pct(0.95), worstMs: Math.round(frames[frames.length - 1]),
    over33ms: frames.filter((f) => f > 33.4).length,
    ...(await pg.evaluate((ms) => ({ longTasks: window.__perf.long.length, longTaskMs: window.__perf.long.reduce((s, l) => s + l[1], 0), reactCommitsPerSec: window.__perf.commits / (ms / 1000) }), ms)),
  };
}
out.matchAiming5s = await window_(5000);
const ballAt = await pg.evaluate(() => (window.__starMatch ? window.__starMatch.ball() : null));
const goalAt = await pg.evaluate(() => (window.__starMatch ? window.__starMatch.goal() : null));
if (ballAt && goalAt) {
  const dx = goalAt.x - ballAt.x, dy = goalAt.y - ballAt.y, L = Math.hypot(dx, dy) || 1;
  await pg.mouse.move(ballAt.x, ballAt.y); await pg.mouse.down();
  for (let i = 1; i <= 10; i++) { await pg.mouse.move(ballAt.x - (dx / L) * 9 * i, ballAt.y - (dy / L) * 9 * i); await pg.waitForTimeout(16); }
  await pg.mouse.up();
  const ball = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  try { await ball.waitFor({ timeout: 4000 }); const b = await ball.boundingBox(); if (b) await pg.mouse.click(b.x + b.width / 2, b.y + b.height / 2); out.kicked = true; } catch { out.kicked = "no contact screen"; }
  out.matchFlight6s = await window_(6000);
}
await shot("match");
out.errors = errors.slice(0, 8);
console.log(JSON.stringify(out, null, 2));
await browser.close();
