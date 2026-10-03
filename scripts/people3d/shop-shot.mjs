// Stills of the walk-around 3D shop's footballer at phone size (390x844).
//
//   node scripts/people3d/shop-shot.mjs <url> <outPrefix> [walkSeconds...]
//
// For each number: walks forward (the stick held up) for that many seconds of
// game time, then takes a still. 0 = standing. The url should carry ?film=1
// (fixed game time per drawn frame), so a still is the same every run.
import { chromium } from "playwright";

const [url, prefix, ...walks] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const logs = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text().slice(0, 300)); });
page.on("pageerror", (e) => logs.push("pageerror: " + e.message));
await page.goto(url, { waitUntil: "load", timeout: 180000 });
await page.waitForFunction(() => window.__shop3d, null, { timeout: 180000 });
let n = 0;
for (const w of walks) {
  const secs = Number(w);
  if (secs > 0) {
    await page.evaluate(() => window.__shop3d.setStick(0, 1));
    const t0 = await page.evaluate(() => window.__shop3d.where().t);
    await page.waitForFunction((t0s) => window.__shop3d.where().t >= t0s[0] + t0s[1], [t0, secs], { timeout: 600000, polling: 200 });
    // keep moving through the still: a stride, not a stop
  } else {
    await page.evaluate(() => window.__shop3d.setStick(0, 0));
    const t0 = await page.evaluate(() => window.__shop3d.where().t);
    await page.waitForFunction((t) => window.__shop3d.where().t >= t + 1.2, t0, { timeout: 600000, polling: 200 });
  }
  const out = `${prefix}-${String(n++).padStart(2, "0")}.png`;
  await page.screenshot({ path: out });
  console.log("still", out, JSON.stringify(await page.evaluate(() => window.__shop3d.where())));
}
for (const l of logs.filter((l) => !/CERT_AUTHORITY|DevTools|HMR|Fast Refresh/.test(l))) console.log(l);
await browser.close();
