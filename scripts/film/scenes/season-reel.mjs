// Scene: the end-of-season reel (/star-season-reel-dev), filmed in real time.
// node scripts/film/scenes/season-reel.mjs <base-url> <out-dir>
// Picks 20 goals, every goal recorded, 1 trophy; plays the reel from t=0
// (seek) while recording; writes season-reel-raw.mp4 and segs.json (the
// reel's own segment times) so the cut can keep title, a few goals, the goal
// of the season and the end card.
import { phone, startRec, stopRec } from "/home/user/film-leo/scripts/film/rec.mjs";
import fs from "node:fs";
import { hideChrome } from "./lib.mjs";

const base = process.argv[2] ?? "http://localhost:3300";
const out = process.argv[3] ?? ".";
const { browser, page } = await phone({ touches: false });
try {
  await page.goto(`${base}/star-season-reel-dev`, { waitUntil: "networkidle" });
  const pill = (t) => page.getByRole("button", { name: t, exact: true }).first().click();
  await pill("20"); await pill("Every goal");
  await page.getByRole("button", { name: "1", exact: true }).last().click(); // trophies (the goals row has a "1" too)
  await page.getByText("▶ Play the reel").click();
  await page.waitForFunction(() => !!window.__seasonReel, null, { timeout: 30000 });
  await hideChrome(page);
  await page.waitForTimeout(2500); // recordings + fonts load, reel starts
  const info = await page.evaluate(() => ({ duration: window.__seasonReel.duration, segs: window.__seasonReel.segs }));
  const r = await startRec(page);
  await page.evaluate(() => window.__seasonReel.seek(0, false));
  await page.waitForTimeout(info.duration * 1000 + 800);
  await stopRec(r, `${out}/season-reel-raw.mp4`, { holdEnd: 0.5 });
  fs.writeFileSync(`${out}/segs.json`, JSON.stringify({ ...info }, null, 1));
  console.log(JSON.stringify(info));
} finally { await browser.close(); }
