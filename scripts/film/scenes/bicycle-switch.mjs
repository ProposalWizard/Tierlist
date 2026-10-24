/**
 * STILLS: the strike screen with Leo's 24 Oct update switch OFF and ON
 * (lib/star/leoUpdate.ts, part "bicycle").
 *
 *   node scripts/film/scenes/bicycle-switch.mjs <port> <off|on> <out.jpg> [momentIdx=6]
 *
 * A real overhead moment on /star-real-moments-dev (Fully real shots → Header
 * → the `momentIdx`th "Overhead" row → ▶ Play), aimed at goal, stopped on the
 * strike screen. OFF: "Head it?" with no Bicycle! button. ON: the button.
 */
import { chromium } from "playwright";
const [port = "3300", mode = "off", out = "/tmp/switch.jpg", idxS = "6"] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await c.addInitScript((on) => {
  try { localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on, off: [] })); } catch { /* */ }
}, mode === "on");
const pg = await c.newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(e.message));
await pg.goto(`http://localhost:${port}/star-real-moments-dev`, { waitUntil: "networkidle", timeout: 120000 });
await pg.waitForTimeout(2500);
await pg.getByText(/Fully real shots/).first().click(); await pg.waitForTimeout(1000);
await pg.getByRole("button", { name: /^Header$/ }).first().click(); await pg.waitForTimeout(1200);
await pg.locator("[data-moment]").filter({ hasText: "Overhead" }).nth(+idxS).click(); await pg.waitForTimeout(1000);
await pg.getByRole("button", { name: /Play/ }).first().click();
await pg.waitForFunction(() => window.__starMatch && window.__starMatch.phase() === "aim", null, { timeout: 60000 });
await pg.waitForTimeout(1200);
const { ball, goal } = await pg.evaluate(() => ({ ball: window.__starMatch.ball(), goal: window.__starMatch.goal() }));
const dx = ball.x - goal.x, dy = ball.y - goal.y, L = Math.hypot(dx, dy) || 1;
await pg.mouse.move(ball.x, ball.y); await pg.mouse.down();
for (let i = 1; i <= 14; i++) { await pg.mouse.move(ball.x + (dx / L) * 90 * i / 14, ball.y + (dy / L) * 90 * i / 14); await pg.waitForTimeout(16); }
await pg.mouse.up();
await pg.waitForFunction(() => window.__starMatch.phase() === "contact", null, { timeout: 8000 });
await pg.waitForTimeout(1200);
const title = await pg.evaluate(() => document.body.innerText.match(/HEAD IT\?|Head it\?/i)?.[0] ?? null);
const buttons = await pg.locator("[data-bicycle-button]").count();
await pg.screenshot({ path: out, type: "jpeg", quality: 72 });
console.log(JSON.stringify({ mode, title, bicycleButtons: buttons, errs }));
await b.close();
