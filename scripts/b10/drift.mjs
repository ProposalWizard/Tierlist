// B10 drift check (docs/handoffs/2026-10-19-ui-lookover/drift-audit.md): the
// Infinite Highlights Play pitch is 366 px wide on a 390 phone, 493 on a computer.
//   node scripts/b10/drift.mjs [--url=http://localhost:3041]
import { chromium } from "playwright";
const URL0 = process.argv.find((a) => a.startsWith("--url="))?.slice(6) ?? "http://localhost:3041";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [name, vp, mobile] of [["phone 390", { width: 390, height: 844 }, true], ["computer", { width: 1280, height: 900 }, false]]) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] });
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => { localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(["header"])); localStorage.setItem("star-fhr", "off"); });
  const page = await ctx.newPage();
  await page.goto(`${URL0}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.locator(".ih-play").first().waitFor({ timeout: 300000 });
  await wait(2000);
  await page.locator(".ih-play").first().click();
  for (let i = 0; i < 200; i++) { if ((await page.evaluate(() => globalThis.__starMatch?.phase?.())) === "aim") break; await wait(100); }
  const w = await page.evaluate(() => [...document.querySelectorAll(".ih-stage canvas")].map((c) => `${c.clientWidth}x${c.clientHeight}`).join(", "));
  console.log(`${name}: header chance, canvases (layout size) ${w}`);
  await browser.close();
}
