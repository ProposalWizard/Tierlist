// Scene: Stats → ⚽ Goals (/star-goals-gallery-dev, 80 goals · 4 seasons).
// node scripts/film/scenes/goals-gallery.mjs <base-url> <out-dir>
// Scrolls the list, taps a goal with a ▶ video and lets it play, closes it,
// then opens Hall of Fame → Best goals. Writes goals-gallery-raw.mp4 and
// marks.json (seconds into the raw clip of each step) for the cut.
import { phone, startRec, stopRec, shot } from "/home/user/film-leo/scripts/film/rec.mjs";
import fs from "node:fs";
import { hideChrome } from "./lib-season.mjs";

const base = process.argv[2] ?? "http://localhost:3300";
const out = process.argv[3] ?? ".";
const { browser, page } = await phone();
const marks = {};
let t0 = 0;
const mark = (k) => { marks[k] = (Date.now() - t0) / 1000; };
const smooth = async (px, ms) => {
  // Steady scroll of `px` over `ms`, like a thumb.
  const steps = Math.round(ms / 33);
  for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy(0, d), px / steps); await page.waitForTimeout(33); }
};
try {
  await page.goto(`${base}/star-goals-gallery-dev`, { waitUntil: "networkidle" });
  await hideChrome(page);
  await page.getByText(/recordings in this browser/).waitFor({ timeout: 60000 });
  await page.locator("[data-career-goals]").waitFor();
  await page.waitForTimeout(1500); // stills of the first rows
  // Gallery top just under the page's own header.
  await page.evaluate(() => { const el = document.querySelector("[data-gallery-phone]"); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 8); });
  await page.waitForTimeout(800);
  await shot(page, `${out}/gg-top.jpg`);
  const r = await startRec(page); t0 = Date.now();
  await page.waitForTimeout(800);
  mark("scroll"); await smooth(1300, 3500); await page.waitForTimeout(500);
  await smooth(-900, 1800); await page.waitForTimeout(400);
  // The first row in view with a video on this phone.
  const row = page.locator("[data-goal-row]").filter({ has: page.locator('[aria-label="Video on this phone"]') });
  const n = await row.count();
  let pick = row.first();
  for (let i = 0; i < n; i++) { const b = await row.nth(i).boundingBox(); if (b && b.y > 120 && b.y < 700) { pick = row.nth(i); break; } }
  mark("tap"); await pick.tap();
  await page.locator("[data-goal-sheet]").waitFor();
  await page.waitForTimeout(7000); mark("videoEnd");
  await shot(page, `${out}/gg-video.jpg`);
  await page.locator('[data-goal-sheet] [aria-label="Close"]').tap();
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(500);
  mark("hall"); await page.getByRole("button", { name: "Hall of Fame", exact: true }).tap();
  await page.locator("[data-best-goals-sheet]").waitFor();
  await page.waitForTimeout(2000);
  await shot(page, `${out}/gg-hall.jpg`);
  await page.locator("[data-best-goals-sheet]").evaluate(async (el) => { for (let i = 0; i < 60; i++) { el.scrollBy(0, 10); await new Promise((r) => setTimeout(r, 33)); } });
  await page.waitForTimeout(1500); mark("end");
  await stopRec(r, `${out}/goals-gallery-raw.mp4`);
  fs.writeFileSync(`${out}/marks.json`, JSON.stringify(marks));
  console.log(JSON.stringify(marks));
} finally { await browser.close(); }
