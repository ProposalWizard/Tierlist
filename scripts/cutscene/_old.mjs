import { chromium } from "playwright";
const [url, prefix, ...ts] = process.argv.slice(2);
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("err", m.text().slice(0, 300)); });
await page.goto(url, { waitUntil: "load", timeout: 240000 });
await page.waitForFunction(() => window.__styleReady, null, { timeout: 240000 });
let n = 0;
for (const t of ts) {
  await page.evaluate((t) => window.__styleCut.seek(Number(t)), t);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${prefix}-${n++}.png` });
}
await browser.close();
