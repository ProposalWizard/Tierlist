// A short "after" clip of the 3D signing (sign → handshake → Welcome), frame
// by frame: headless WebGL draws about 1 frame a second, so each frame is held
// with window.__sign3d.debugHold(t) and screenshotted, and the page's own
// timers (the SIGNED stamp, the Welcome card) run on a stepped clock.
//
//   node scripts/people3d/signing-clip.mjs <url> <framesDir> [fps=20] [from=0] [to=7.5]
//
// Then encode, e.g.  ffmpeg -framerate 20 -i <framesDir>/f%04d.png -pix_fmt yuv420p out.mp4
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const [url, dir, fpsArg = "20", fromArg = "0", toArg = "7.5"] = process.argv.slice(2);
const fps = Number(fpsArg), from = Number(fromArg), to = Number(toArg);
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.clock.install();
await page.goto(url, { waitUntil: "load", timeout: 180000 });
await page.waitForFunction(() => window.__sign3dReady, null, { timeout: 300000 });
await page.evaluate(() => window.__sign3d.debugHold(0));
for (let i = 0; i < 30 && !(await page.$("[data-sign]")); i++) {
  await page.evaluate(() => document.querySelector("[data-line]")?.click());
  await page.waitForTimeout(150);
}
await page.evaluate(() => document.querySelector("[data-sign]")?.click());
await page.clock.pauseAt(Date.now() + 2000);
const n = Math.round((to - from) * fps);
for (let i = 0; i <= n; i++) {
  const t = from + i / fps;
  await page.evaluate((t) => window.__sign3d.debugHold(t), t);
  await page.clock.runFor(Math.round(1000 / fps));
  await page.screenshot({ path: `${dir}/f${String(i).padStart(4, "0")}.png`, timeout: 120000 });
  if (i % 20 === 0) console.log("frame", i, "of", n, "t", t.toFixed(2));
}
await browser.close();
