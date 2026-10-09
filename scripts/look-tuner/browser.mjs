// scripts/look-tuner/browser.mjs — open a 3D screen in a software-WebGL phone browser (no graphics card here),
// wait until it has built, and take stills. Shared by the look-tuner, tools/bake3d/capture.mjs and the stills.
import { chromium } from "playwright";
import fs from "node:fs";

export async function openPhone(url, o = {}) {
  const [W, H] = (o.size ?? "390x844").split("x").map(Number);
  const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
  const browser = await chromium.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: o.dsf ?? 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  if (o.init) await page.addInitScript(o.init);
  if (o.storage) await page.addInitScript((kv) => { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); }, o.storage);
  page.on("pageerror", (e) => console.error("[page error]", e.message.slice(0, 300)));
  if (o.onConsole) page.on("console", o.onConsole);
  if (o.verbose) page.on("console", (m) => { if (m.type() === "error") console.error("[console]", m.text().slice(0, 200)); });
  await page.goto(url, { waitUntil: "load", timeout: 240000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  if (o.waitFor) await page.waitForFunction(o.waitFor, null, { timeout: 300000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(o.settleMs ?? 2500);
  await page.addStyleTag({ content: "[data-page-guide]{display:none !important}" });
  return { browser, page };
}

/** Two animation frames: the canvas has presented what was drawn. */
export const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
