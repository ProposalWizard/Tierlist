/**
 * FILM: the bicycle kick in a real match (chat 3, 22 Oct 2026).
 *
 *   node scripts/film/scenes/bicycle.mjs <port> <goal|miss> <outDir> [momentIdx=2] [aimDeg=12] [lift=60]
 *
 * Opens /star-real-moments-dev → Fully real shots → Header → the `momentIdx`th
 * "Overhead" row → ▶ Play (the real match through ScenarioPlay). Aims from
 * the ball toward goal, turned `aimDeg`; on the strike screen presses
 * Bicycle!, waits until the height marker is at `lift` % (±1.5) and taps:
 *   goal  dead centre, marker inside the band (a clean hit);
 *   miss  dead centre, marker under the band (TOO LATE).
 * Every step is seeded except the tap's moment, which is pinned to the marker,
 * so the same arguments give the same strike. Records a 390×844 video
 * (Playwright recordVideo) to <outDir>/raw.webm and prints when the strike
 * screen opened and when it was tapped (ms from the start of the video), for
 * cutting. Prints RESULT goal|other from the banner.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [port = "3300", mode = "goal", outDir = "/tmp/film-bike", idxS = "2", aimS = "12", liftS] = process.argv.slice(2);
const IDX = +idxS, AIM = (+aimS * Math.PI) / 180, LIFT = liftS ? +liftS : mode === "goal" ? 60 : 22;
fs.mkdirSync(outDir, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, recordVideo: { dir: outDir, size: { width: 390, height: 844 } } });
const pg = await c.newPage();
const T0 = Date.now();
const at = () => Date.now() - T0;
const errs = [];
pg.on("pageerror", (e) => errs.push(e.message));
await pg.goto(`http://localhost:${port}/star-real-moments-dev`, { waitUntil: "networkidle", timeout: 120000 });
await pg.waitForTimeout(2500);
await pg.getByText(/Fully real shots/).first().click(); await pg.waitForTimeout(1000);
await pg.getByRole("button", { name: /^Header$/ }).first().click(); await pg.waitForTimeout(1200);
const rows = pg.locator("[data-moment]").filter({ hasText: "Overhead" });
await rows.nth(IDX).click(); await pg.waitForTimeout(1000);
const tPlay = at();
await pg.getByRole("button", { name: /Play/ }).first().click();
await pg.waitForFunction(() => window.__starMatch && window.__starMatch.phase() === "aim", null, { timeout: 60000 });
await pg.waitForTimeout(1200);
const { ball, goal } = await pg.evaluate(() => ({ ball: window.__starMatch.ball(), goal: window.__starMatch.goal() }));
const rx = ball.x - goal.x, ry = ball.y - goal.y;
const dx = rx * Math.cos(AIM) - ry * Math.sin(AIM), dy = rx * Math.sin(AIM) + ry * Math.cos(AIM), L = Math.hypot(dx, dy) || 1;
await pg.mouse.move(ball.x, ball.y); await pg.mouse.down();
for (let i = 1; i <= 14; i++) { await pg.mouse.move(ball.x + (dx / L) * 90 * i / 14, ball.y + (dy / L) * 90 * i / 14); await pg.waitForTimeout(16); }
await pg.mouse.up();
await pg.waitForSelector("[data-bicycle-button]", { timeout: 8000 });
const tStrike = at();
await pg.waitForTimeout(1300);
await pg.locator("[data-bicycle-button]").click();
await pg.waitForTimeout(1500);
const tap = await pg.evaluate((want) => new Promise((res) => {
  const f = () => {
    const m = document.querySelector("[data-bicycle-meter]");
    const mk = m.querySelector(".bg-white.shadow");
    const mv = parseFloat(/([\d.]+)%/.exec(mk.getAttribute("style"))[1]);
    // only on the way down (the drop), so every run strikes the same moment
    const down = window.__lastMv !== undefined && mv < window.__lastMv;
    window.__lastMv = mv;
    const ballEl = document.querySelector('div.cursor-pointer[style*="aspect-ratio"]');
    const r = ballEl.getBoundingClientRect();
    if (down && Math.abs(mv - want) < 1.5) { res({ mv, x: r.x + r.width / 2, y: r.y + r.height / 2 }); return; }
    requestAnimationFrame(f);
  };
  f();
}), LIFT);
await pg.mouse.click(tap.x, tap.y);
const tTap = at();
await pg.waitForTimeout(500);
const grade = await pg.evaluate(() => document.querySelector("[data-contact-grade]")?.textContent ?? null);
let result = "other", tBanner = null;
// A goal: the ball crosses the goal line between the posts, under the bar
// (the banner itself is drawn on the pitch canvas, not in the page text).
for (let q = 0; q < 70; q++) {
  const bs = await pg.evaluate(() => { const s = window.__starMatch?.ballState?.(); return s ? { x: s.pos.x, y: s.pos.y, z: s.z } : null; });
  if (process.env.TRACE && bs) console.error("ball", bs.x.toFixed(1), bs.y.toFixed(1), bs.z.toFixed(2));
  if (bs && !tBanner && bs.y <= 0 && Math.abs(bs.x - 34) < 3.66 && bs.z < 2.44) { result = "goal"; tBanner = at(); }
  if (tBanner && at() - tBanner > 2500) break;
  await pg.waitForTimeout(50);
}
await pg.waitForTimeout(tBanner ? 500 : 2500);
const tEnd = at();
await pg.close();
await c.close();
await b.close();
const vid = fs.readdirSync(outDir).filter((f) => f.endsWith(".webm")).map((f) => path.join(outDir, f)).sort((a, z) => fs.statSync(z).mtimeMs - fs.statSync(a).mtimeMs)[0];
fs.renameSync(vid, path.join(outDir, `raw-${mode}.webm`));
console.log(JSON.stringify({ mode, grade, mv: tap.mv, result, tPlay, tStrike, tTap, tBanner, tEnd, errs }));
