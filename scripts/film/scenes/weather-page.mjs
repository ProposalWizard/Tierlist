// The weather test page itself (chat 4): change the weather, tap a wind direction, drag the speed,
// pick a poor club pitch + dry spell; the lab's paths redraw.
//   node scripts/film/scenes/weather-page.mjs <port> <outDir>
import * as rec from "../rec.mjs";
import { pill, hideDevBadges } from "./weatherLib.mjs";
import { finish } from "./weatherFinish.mjs";
import fs from "node:fs";
const [port = "3300", outDir = "docs/handoffs/2026-10-22-leo-tonight/chat4/film"] = process.argv.slice(2);
fs.mkdirSync(outDir + "/takes", { recursive: true });
const { browser, page } = await rec.phone();
await page.goto(`http://localhost:${port}/star-weather-dev`, { waitUntil: "networkidle" });
await hideDevBadges(page);
await page.waitForTimeout(800);
const scrollTo = async (sel, offset = 0) => {
  const y = await page.locator(sel).first().evaluate((el, o) => el.getBoundingClientRect().top + window.scrollY - o, offset);
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await page.waitForTimeout(900);
};
const tap = async (loc) => { const b = await loc.boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(450); };
// Start on Clear, Long ball, in view of the weather row.
await pill(page, "Clear").click();
await pill(page, "Long ball").click();
await page.evaluate(() => window.scrollTo(0, 0));
const r = await rec.startRec(page);
await page.waitForTimeout(700);
await tap(pill(page, "Windy"));
const dots = page.locator('svg[aria-label^="Wind"] circle[r="6"]');
for (const i of [0, 4, 2]) await tap(dots.nth(i));
// Drag the speed up.
const sl = await page.locator('input[aria-label="Wind speed"]').boundingBox();
await page.mouse.move(sl.x + sl.width * 0.5, sl.y + sl.height / 2); await page.mouse.down();
for (let k = 1; k <= 12; k++) { await page.mouse.move(sl.x + sl.width * (0.5 + 0.45 * k / 12), sl.y + sl.height / 2); await page.waitForTimeout(30); }
await page.mouse.up(); await page.waitForTimeout(500);
await scrollTo("[data-lab]", 90); await page.waitForTimeout(1800);
// A poor, dry pitch.
// Back up to the top: the weather row and the pitch are both on the first screen.
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" })); await page.waitForTimeout(900);
await tap(pill(page, "Clear"));
const v = await page.locator("select option", { hasText: "Cleethorpes Town" }).first().getAttribute("value");
await page.locator("select").selectOption(v); await page.waitForTimeout(500);
await tap(pill(page, "Dry spell"));
await page.waitForTimeout(500);
await scrollTo("[data-lab]", 140);
await tap(pill(page, "Lofted pass"));
await page.waitForTimeout(2000);
const raw = `${outDir}/takes/page-0.mp4`;
await rec.stopRec(r, raw, { holdEnd: 0.5 });
await browser.close();
const out = finish([raw], `${outDir}/weather-page.mp4`, { stillAt: 6.5, crf: 24 });
console.log("weather-page", out.seconds.toFixed(1) + " s", out.mb.toFixed(2) + " MB");
