/**
 * scripts/star-sandbox/story-modes.mjs — plays the four story games once each on
 * /star-life-dev at phone size (390x844) and saves a still mid-play and at the result
 * (story world job D1). Usage: node scripts/star-sandbox/story-modes.mjs [--url http://localhost:3041] [--only race]
 * Stills: docs/plans/story-world-shots/D1-<mode>-<n>.png
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = val("--url", "http://localhost:3041");
const ONLY = val("--only", "");
const OUT = "docs/plans/story-world-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const report = [];

async function open(arc, beat, light3d = false) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: light3d ? 1 : 2 });
  // a software renderer (no GPU here): the game's own lowest 3D quality and the plain 3D look, so a still can be taken
  if (light3d) await ctx.addInitScript(() => { try { localStorage.setItem("star-3d-quality", "low"); localStorage.setItem("star-3d-look", "old"); } catch {} });
  const pg = await ctx.newPage();
  const errors = [];
  pg.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  pg.on("console", (m) => { if (process.env.ALL_LOGS) console.log("console:", m.type(), m.text().slice(0, 200)); if (m.type() === "error" && !/supabase|Failed to load resource|ERR_|favicon|posthog|sentry/i.test(m.text())) errors.push(`CONSOLE: ${m.text().slice(0, 200)}`); });
  await pg.goto(`${BASE}/star-life-dev?prep=fresh&full=1&shot=1&clock=off&story=${arc}&beat=${beat}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  // the cookie card covers the bottom of the phone: say no to it
  await pg.locator("button:visible", { hasText: /No thanks/ }).first().click({ timeout: 60000 }).catch(() => {});
  return { ctx, pg, errors };
}
/** Click a reply by its words (the talk screens). */
async function reply(pg, re, ms = 20000) {
  const b = pg.locator("button:visible").filter({ hasText: re }).first();
  await b.waitFor({ state: "visible", timeout: ms });
  await b.click();
  await pg.waitForTimeout(900);
}
async function shot(pg, mode, n) { const p = `${OUT}/D1-${mode}-${n}.png`; try { await pg.screenshot({ path: p, timeout: 120000 }); console.log("saved", p); } catch (e) { console.log("NO STILL", p, String(e).slice(0, 80)); } }
/** Press through the talk's narration until the reply we want shows. */
async function until(pg, re, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await pg.locator("button:visible").filter({ hasText: re }).count()) return true;
    const cont = pg.locator("button:visible").filter({ hasText: /^(Continue|Next|Go on|…|Tap to continue)/i }).first();
    if (await cont.count()) { await cont.click().catch(() => {}); await pg.waitForTimeout(600); continue; }
    await pg.mouse.click(195, 700).catch(() => {});
    await pg.waitForTimeout(700);
  }
  return false;
}
async function textOf(pg) { return (await pg.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400); }

// ── 1. the penalty ──
async function penalty() {
  const { ctx, pg, errors } = await open("arc-ten-minutes", "fix-2-penalty");
  await until(pg, /Take it/);
  await reply(pg, /Take it/);
  await pg.locator("[data-activity=penalties] canvas").first().waitFor({ timeout: 120000 });
  await pg.waitForTimeout(3500);
  await shot(pg, "penalties", 1);
  // find the ball: the match draws it white at the spot; drag back from just under the middle of the canvas's lower part
  const cv = await pg.locator("[data-activity=penalties] canvas").first().boundingBox();
  const ball = await pg.evaluate(({ x, y, w, h }) => {
    const c = document.querySelector("[data-activity=penalties] canvas");
    const g = c.getContext("2d"); const sx = c.width / w, sy = c.height / h;
    const d = g.getImageData(0, Math.floor(h * 0.35 * sy), c.width, Math.floor(h * 0.6 * sy)).data;
    let best = null, bestN = 0;
    for (let yy = 0; yy < h * 0.6; yy += 3) for (let xx = 0; xx < w; xx += 3) {
      let n = 0;
      for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) {
        const px = Math.floor((xx + dx) * sx), py = Math.floor((yy + dy) * sy);
        const i = (py * c.width + px) * 4; if (d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235) n++;
      }
      if (n > bestN) { bestN = n; best = { x: x + xx, y: y + h * 0.35 + yy }; }
    }
    return best;
  }, { x: cv.x, y: cv.y, w: cv.width, h: cv.height }).catch(() => null);
  const bx = ball?.x ?? cv.x + cv.width / 2, by = ball?.y ?? cv.y + cv.height * 0.74;
  await pg.mouse.move(bx, by); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { await pg.mouse.move(bx + 14 * i / 14, by + 120 * i / 14); await pg.waitForTimeout(20); }
  await pg.mouse.up();
  await pg.waitForTimeout(700);
  const cball = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  if (await cball.count()) { const b = await cball.boundingBox(); if (b) await pg.mouse.click(b.x + b.width / 2, b.y + b.height * 0.6); }
  await pg.waitForTimeout(1200);
  await shot(pg, "penalties", 2);
  await pg.locator("[data-mode-result]").waitFor({ timeout: 30000 }).catch(() => {});
  await shot(pg, "penalties", 3);
  const res = await pg.locator("[data-mode-result]").getAttribute("data-mode-result").catch(() => null);
  if (res) { await pg.locator("[data-continue]").click(); await pg.waitForTimeout(1500); await shot(pg, "penalties", 4); }
  report.push({ mode: "penalties", ball, result: res, after: (await textOf(pg)).slice(0, 160), errors });
  await ctx.close();
}

// ── 2. the gym board ──
async function gym() {
  const { ctx, pg, errors } = await open("arc-the-gym-board", "gym-1");
  await until(pg, /The plank\. Now/);
  await reply(pg, /The plank\. Now/);
  await pg.locator("[data-hold-pad]").waitFor({ timeout: 60000 });
  const pad = await pg.locator("[data-hold-pad]").boundingBox();
  await pg.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2);
  // a steady plank: brace, and take a quick breath (let go for a moment) every second and a half
  await pg.waitForTimeout(2300);
  const t0 = Date.now(); let shotMid = false;
  while (!(await pg.locator("[data-mode-result]").count()) && Date.now() - t0 < 60000) {
    await pg.mouse.down(); await pg.waitForTimeout(1300);
    await pg.mouse.up(); await pg.waitForTimeout(250);
    if (!shotMid && Date.now() - t0 > 9000) { await shot(pg, "gym", 1); shotMid = true; }
  }
  await shot(pg, "gym", 2);
  const res = await pg.locator("[data-mode-result]").getAttribute("data-mode-result").catch(() => null);
  if (res) { await pg.locator("[data-continue]").click(); await pg.waitForTimeout(1500); await shot(pg, "gym", 3); }
  report.push({ mode: "gym", result: res, after: (await textOf(pg)).slice(0, 160), errors });
  await ctx.close();
}

// ── 3. keep-ups (3D) ──
async function keepUps() {
  const { ctx, pg, errors } = await open("arc-keep-ups", "kup-1-bet", true);
  await until(pg, /You.re on/);
  await reply(pg, /You.re on/);
  await pg.locator("[data-activity=two-touch] canvas").first().waitFor({ timeout: 180000 }).catch(() => {});
  // wait for the 3D to load: the ball waits in your hands ("TAP TO DROP IT")
  await pg.locator("text=/TAP TO DROP IT/i").first().waitFor({ timeout: 240000 }).catch(() => {});
  await pg.waitForTimeout(8000);
  await shot(pg, "two-touch", 1);
  // the first tap drops it; then tap in a rhythm near each touch (about every 0.8 s); a slow
  // software renderer drifts off the beat, so it drops after a few
  await pg.mouse.click(260, 520);
  await pg.waitForTimeout(620);
  for (let i = 0; i < 14 && !(await pg.locator("button:visible", { hasText: /Continue/ }).count()); i++) {
    await pg.mouse.click(260, 520);
    await pg.waitForTimeout(790);
    if (i === 1) await shot(pg, "two-touch", 2);
  }
  await pg.locator("button:visible", { hasText: /Continue/ }).first().waitFor({ timeout: 90000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  await shot(pg, "two-touch", 3);
  const cont = pg.locator("button:visible").filter({ hasText: /Continue/ }).first();
  let res = null;
  if (await cont.count()) { res = "result shown"; await cont.click(); await pg.waitForTimeout(1500); await shot(pg, "two-touch", 4); }
  report.push({ mode: "two-touch", result: res, after: (await textOf(pg)).slice(0, 200), errors });
  await ctx.close();
}

// ── 4. the sprint ──
async function race() {
  const { ctx, pg, errors } = await open("arc-the-race", "rce-1-race");
  await until(pg, /Line it up/);
  await reply(pg, /Line it up/);
  await pg.locator("[data-hold-pad]").waitFor({ timeout: 60000 });
  const pad = await pg.locator("[data-hold-pad]").boundingBox();
  await pg.mouse.move(pad.x + pad.width / 2, pad.y + pad.height / 2);
  // wait for GO, then press and hold
  await pg.locator("[data-sprint-word]", { hasText: "GO!" }).waitFor({ timeout: 20000 });
  await pg.waitForTimeout(150);
  await pg.mouse.down();
  await pg.waitForTimeout(2600);
  await shot(pg, "pace-sprint", 1);
  await pg.locator("[data-mode-result]").waitFor({ timeout: 30000 }).catch(() => {});
  await pg.mouse.up();
  await shot(pg, "pace-sprint", 2);
  const res = await pg.locator("[data-mode-result]").getAttribute("data-mode-result").catch(() => null);
  if (res) { await pg.locator("[data-continue]").click(); await pg.waitForTimeout(1500); await shot(pg, "pace-sprint", 3); }
  report.push({ mode: "pace-sprint", result: res, after: (await textOf(pg)).slice(0, 160), errors });
  await ctx.close();
}

for (const [k, f] of [["penalty", penalty], ["gym", gym], ["keepups", keepUps], ["race", race]]) {
  if (ONLY && ONLY !== k) continue;
  try { await f(); } catch (e) { report.push({ mode: k, crash: String(e).slice(0, 300) }); }
}
console.log(JSON.stringify(report, null, 1));
await browser.close();
