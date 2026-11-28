#!/usr/bin/env node
/**
 * THE SHOPPING STREET'S PROOF STILLS AND FILM (phase 1, 28 Nov 2026).
 *
 *   node scripts/street3d/stills.mjs [--base=http://localhost:3113] [--out=DIR] [--q=medium] [--film=10] [only ...]
 *
 * Phone size (390 × 844, one pixel per point), the street's own test page full screen
 * (/star-street-dev?bare=1). Shots: arrive (from the garden), each shop front, walking with the
 * people, first person, the loading screen, then a short film walking up the street (recorded with
 * fixed steps and played back at real speed). Prints the frame numbers (draws, triangles) at each.
 * No graphics chip here (software WebGL): a place takes a while to open; the numbers are the scene's
 * own (draw calls and triangles do not depend on the chip).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const BASE = flag("base", "http://localhost:3113");
const OUT = flag("out", "/tmp/street-stills");
const Q = flag("q", "medium");
const FILM = Number(flag("film", "10"));
const only = args.filter((a) => !a.startsWith("--"));
const want = (id) => !only.length || only.includes(id);
fs.mkdirSync(OUT, { recursive: true });

const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-dev-shm-usage"] });
const log = (...a) => console.log(...a);

async function open(extra = "", opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...(opts.video ? { recordVideo: { dir: OUT, size: { width: 390, height: 844 } } } : {}) });
  await ctx.addInitScript((q) => { try { localStorage.setItem("kib-cookie-consent", "no"); localStorage.setItem("star-3d-quality", q); localStorage.setItem("kib-3d-view", "third"); } catch { /* fine */ } }, Q);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => log("  pageerror", e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") log("  console", m.text().slice(0, 200)); });
  const t0 = Date.now();
  await page.goto(`${BASE}/star-street-dev?bare=1&q=${Q}${extra}`, { waitUntil: "load", timeout: 300000 });
  return { ctx, page, t0 };
}
const ready = (page) => page.waitForFunction(() => !!window.__street3d && !document.querySelector("[data-kib-curtain]"), null, { timeout: 300000, polling: 500 });
const stats = (page) => page.evaluate(() => window.__street3d?.stats());
const shot = async (page, id, note = "") => {
  const file = path.join(OUT, `${id}.png`);
  await page.screenshot({ path: file });
  const s = await stats(page);
  log(`${id}: ${s ? `${s.calls} draws, ${Math.round(s.triangles / 1000)}k triangles, ${s.quality}, ${s.people} people` : "no stats"} ${note}`);
};

// the loading screen first (its still must be there: scripts/loading-stills/shoot.mjs street)
if (want("loading")) {
  const { ctx, page } = await open();
  await page.waitForSelector("[data-kib-curtain]", { timeout: 120000 }).catch(() => null);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, "loading.png") });
  log("loading: shot");
  await ctx.close();
}

const { ctx, page, t0 } = await open();
await ready(page);
log(`opened in ${((Date.now() - t0) / 1000).toFixed(1)} s (software WebGL)`);
await page.waitForTimeout(3500);
if (want("arrive")) await shot(page, "arrive", "(from the garden, bottom of the street)");

const CAMS = {
  // across the street from each front, eye height, looking at the shop
  shop: { stand: [5.6, -9.4, -2.0], cam: [0.0, 1.8, -12.2], look: [7.4, 2.4, -6.4] },
  cars: { stand: [5.6, 6.6, -2.4], cam: [-1.2, 1.8, 3.6], look: [7.4, 2.2, 10.6] },
  drip: { stand: [-5.6, -3.4, 2.2], cam: [1.2, 1.8, -0.6], look: [-7.4, 2.4, -6.8] },
  barber: { stand: [-5.6, 10.6, 2.6], cam: [1.4, 1.8, 3.2], look: [-7.4, 2.3, 8.6] },
};
for (const [id, c] of Object.entries(CAMS)) {
  if (!want(id)) continue;
  await page.evaluate((c) => { const s = window.__street3d; s.place(c.stand[0], c.stand[1], c.stand[2]); s.debugCamera(c.cam, c.look); }, c);
  await page.waitForTimeout(2500);
  await shot(page, `front-${id}`);
}
await page.evaluate(() => window.__street3d.debugCamera(null));

if (want("walk")) {
  // walking up the west pavement with the people about (the follow camera)
  await page.evaluate(() => { const s = window.__street3d; s.place(-5.4, 6, Math.PI); s.setStick(0, 0.55); });
  await page.waitForTimeout(3500);
  await shot(page, "walking", "(the follow camera, people walking)");
  const d = await page.evaluate(() => window.__street3d.debug());
  log("  people:", JSON.stringify({ minGap: d.minGap, onRoadOffZebra: d.onRoadOffZebra, walkers: d.walkers, cars: d.cars, showroomCar: d.showroomCar }));
  await page.evaluate(() => window.__street3d.setStick(0, 0));
}
if (want("first")) {
  await page.evaluate(() => { const s = window.__street3d; s.place(5.2, -1.0, Math.PI); s.setView("first"); });
  await page.waitForTimeout(2500);
  await shot(page, "first-person", "(his eyes, looking up the street)");
  await page.evaluate(() => window.__street3d.setView("third"));
}
// a standing still frame's numbers at the arrival (the frame meter's figure)
await page.evaluate(() => { const s = window.__street3d; s.place(-5.6, 18.2, Math.PI); });
await page.waitForTimeout(2500);
await shot(page, "arrive-again");
const near = await page.evaluate(() => window.__street3d.debug());
log("  debug:", JSON.stringify(near).slice(0, 400));
await ctx.close();

if (FILM > 0 && want("film")) {
  const { ctx: fc, page: fp } = await open("&film=1", { video: true });
  await ready(fp);
  await fp.waitForTimeout(1500);
  const f0 = (await stats(fp)).frames, w0 = Date.now();
  // up the west pavement, across the zebra, towards the 3D shop
  await fp.evaluate(() => { const s = window.__street3d; s.place(-5.4, 18.5, Math.PI); s.setStick(0, 0.5); });
  const frames = FILM * 30;
  await fp.waitForFunction((n) => window.__street3d.stats().frames >= n, f0 + frames, { timeout: 600000, polling: 250 });
  const secs = (Date.now() - w0) / 1000;
  await fp.evaluate(() => window.__street3d.setStick(0, 0));
  const vid = await fp.video().path();
  await fc.close();
  // played back so 30 drawn frames are one second
  const speed = secs / FILM;
  const out = path.join(OUT, "street-walk.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "1.5", "-i", vid, "-t", String(secs), "-vf", `setpts=PTS/${speed.toFixed(3)},fps=30`, "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", out]);
  log(`film: ${out} (${frames} frames drawn in ${secs.toFixed(0)} s, played ${speed.toFixed(1)}x faster)`);
  fs.rmSync(vid, { force: true });
}
await browser.close();
