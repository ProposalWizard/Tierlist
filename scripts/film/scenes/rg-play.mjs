// Real Goals: play the first N levels of every path like a player (chat 5, 25 Oct 2026).
// Needs a built server (`next start`, NEXT_PUBLIC_STAR_OFFLINE_DEV=1) on FILM_BASE (default :3300).
//   node scripts/film/scenes/rg-play.mjs <outDir> [paths=wc,pl,...] [levels=5] [cpu=4]
// For each level: open it from the path's level map, let the real build-up play,
// then strike, aiming from the result's goal-mouth picture (how far your ball
// crossed from the real one) until it goes in (at most MAX_TRIES). Writes
// <outDir>/play.json (every level: load times, header, tries, %, stars) and a
// still of each level's start and result. Then reloads the page to check the
// stars were saved.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { findBall, BASE } from "./rg-lib.mjs";

const OUT = path.resolve(process.argv[2] ?? "rg-play-out");
const PATHS = (process.argv[3] ?? "wc,pl,liga,seriea,bundes,l1,worldies,bangers").split(",");
const LEVELS = Number(process.argv[4] ?? 5);
const CPU = Number(process.argv[5] ?? 4);
const MAX_TRIES = 12;
let tapWait = 500;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(`PAGE ${e.message.slice(0, 160)}`));
page.on("console", (m) => { const t = m.text(); if (m.type() === "error" && !/googletagmanager|ERR_TUNNEL|status of 500|status of 404|flagcdn/i.test(t)) errs.push(`CON ${t.slice(0, 160)}`); });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });
const T = () => Date.now();
const txt = async (sel) => ((await page.locator(sel).first().innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
const snap = (name) => page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: "jpeg", quality: 55 });

/** The result picture's REAL (green) and YOU (blue) dots, in its own px. */
async function dots() {
  return page.evaluate(() => {
    const svg = [...document.querySelectorAll("[data-result] svg")].pop();
    if (!svg) return null;
    const c = [...svg.querySelectorAll("circle")];
    const real = c.find((e) => e.getAttribute("fill") === "#22c55e"), you = c.find((e) => e.getAttribute("fill") === "#38bdf8");
    const xy = (e) => (e ? { x: +e.getAttribute("cx"), y: +e.getAttribute("cy") } : null);
    return { real: xy(real), you: xy(you) };
  });
}

/** Pull back from the ball and tap the contact ball. */
async function strike(dx, pull, lift) {
  const contact = 'div.cursor-pointer[style*="aspect-ratio"]';
  const mid = 195;
  const cands = (await findBall(page)).sort((a, b) => Math.abs(a[0] - mid) - Math.abs(b[0] - mid));
  for (const [x, y] of cands.slice(0, 8)) {
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 14; i++) { await page.mouse.move(x - (dx * i) / 14, y + (pull * i) / 14); await page.waitForTimeout(20); }
    await page.mouse.up(); await page.waitForTimeout(900);
    if (await page.locator(contact).count()) {
      const bb = await page.locator(contact).first().boundingBox(); const r = bb.width / 2;
      // A volley drops through the green band: tap as it does (best guess: after 0.5 s).
      await page.waitForTimeout(tapWait);
      await page.mouse.click(bb.x + r, bb.y + r * (1 + lift));
      return true;
    }
  }
  return false;
}

async function scrollToPitch() {
  await page.evaluate(() => { const c = document.querySelector("[data-playing] canvas"); if (c) window.scrollBy(0, c.getBoundingClientRect().top - 40); });
  await page.waitForTimeout(400);
}

async function playLevel(pathId, n) {
  const rec = { path: pathId, level: n + 1 };
  const card = page.locator(`[data-path="${pathId}"] [data-level="${n}"]`);
  await card.scrollIntoViewIfNeeded();
  rec.open = await card.getAttribute("data-open");
  if (rec.open !== "true") { rec.note = "locked"; return rec; }
  const t0 = T();
  await card.click();
  await page.waitForSelector("[data-playing] canvas", { timeout: 120000 });
  rec.matchReadyMs = T() - t0;
  rec.goal = await page.getAttribute("[data-playing]", "data-playing");
  await page.evaluate(() => window.scrollTo(0, 0));
  rec.header = (await txt("[data-playing]")).slice(0, 260);
  await snap(`${pathId}-${n + 1}-start`);
  // The real build-up, then "Your turn".
  const tb = T();
  const turned = await page.waitForFunction(() => /Your turn/.test(document.querySelector("[data-caption]")?.textContent ?? "") || !document.querySelector("[data-caption]"), null, { timeout: 60000 }).then(() => true).catch(() => false);
  rec.buildUpMs = T() - tb; rec.buildUpDone = turned;
  await scrollToPitch();
  let dx = 0, pull = 120, lift = 0.35; tapWait = 500;
  const hist = [];
  rec.tries = [];
  for (let i = 0; i < MAX_TRIES; i++) {
    if (i > 0 && (await page.getByText("↺ Again").count())) { await page.getByText("↺ Again").click(); await page.waitForTimeout(2600); await scrollToPitch(); }
    if (/FULL TIME/.test(await page.locator("body").innerText())) { rec.fullTime = true; await snap(`${pathId}-${n + 1}-fulltime`); break; }
    const ok = await strike(dx, pull, lift);
    if (!ok) { rec.tries.push({ dx, pull, lift, out: "no strike" }); dx = -dx + (i % 2 ? 8 : -8); continue; }
    await page.waitForSelector("[data-result]", { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(300);
    const r = await txt("[data-result]");
    const d = await dots();
    const goal = /^Goal!/i.test(r);
    const pct = Number(r.match(/(\d+)%/)?.[1] ?? 0);
    rec.tries.push({ dx, pull, lift, goal, pct, you: (r.match(/You:[^↺]*/)?.[0] ?? "").trim() });
    if (goal) { rec.scored = true; rec.pct = pct; break; }
    // Aim from the picture: across by the secant of the last two misses (the
    // screen can be turned, so the sign is learnt, not assumed); height by steps.
    if (d?.you && d.real) {
      const err = d.you.x - d.real.x;
      hist.push([dx, err]);
      if (hist.length >= 2 && Math.abs(hist[hist.length - 1][1] - hist[hist.length - 2][1]) > 2) {
        const [x1, e1] = hist[hist.length - 1], [x0, e0] = hist[hist.length - 2];
        dx = x1 - (e1 * (x1 - x0)) / (e1 - e0);
        dx = Math.max(-140, Math.min(140, dx));
      } else dx += err > 0 ? -25 : 25;
      lift += d.real.y - d.you.y > 0 ? -0.15 : 0.15; // you too high (smaller y) → lift less
      lift = Math.max(-0.6, Math.min(0.9, lift));
    } else {
      pull = pull === 120 ? 165 : 120; tapWait = tapWait === 500 ? 150 : tapWait === 150 ? 900 : 500; // a cross: try another moment
    }
  }
  await page.locator("[data-result]").scrollIntoViewIfNeeded().catch(() => {});
  await snap(`${pathId}-${n + 1}-result`);
  rec.starsShown = await page.locator("[data-result] span[style*='250, 204, 21']").count().catch(() => null);
  await page.getByRole("button", { name: "✕" }).first().click();
  await page.waitForTimeout(500);
  rec.cardStars = await card.locator("span[style*='250, 204, 21']").count().catch(() => null);
  return rec;
}

const report = { cpu: CPU, base: BASE, at: new Date().toISOString(), paths: [] };
for (const id of PATHS) {
  const t0 = T();
  await page.goto(`${BASE}/star-real-goals-dev?path=${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-path="${id}"] [data-level]`, { timeout: 180000 });
  const p = { id, pathReadyMs: T() - t0, levels: [] };
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(`${id}-0-path`);
  for (let n = 0; n < LEVELS; n++) {
    try { p.levels.push(await playLevel(id, n)); } catch (e) { p.levels.push({ level: n + 1, error: String(e).slice(0, 200) }); await snap(`${id}-${n + 1}-error`); }
    console.log(JSON.stringify(p.levels[p.levels.length - 1]).slice(0, 300));
  }
  // Saved? Reload and read the tile / total.
  await page.goto(`${BASE}/star-real-goals-dev?path=${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`[data-path="${id}"] [data-level]`, { timeout: 180000 });
  await page.waitForTimeout(800);
  p.afterReloadTotal = await txt("[data-total-stars]");
  report.paths.push(p);
  fs.writeFileSync(path.join(OUT, "play.json"), JSON.stringify(report, null, 1));
}
report.errors = errs;
fs.writeFileSync(path.join(OUT, "play.json"), JSON.stringify(report, null, 1));
console.log("errors", errs.length, errs.slice(0, 5));
await browser.close();
