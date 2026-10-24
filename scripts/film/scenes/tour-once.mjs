import os from "node:os";
// Clip 3: fresh career Home -> welcome tour (NEXT, NEXT, Play) -> sim match -> back to Home -> reload: tour does not replay.
import { open, startRec, stopRec, text, click, clickText, sleep, finish, newCareerToHome, OUT } from "./lib.mjs";
const { browser, page } = await open(null);
await newCareerToHome(page);
await sleep(1500); await clickText(page, "^CLOSE$", 1500); await sleep(1500);   // achievement popup, not filmed
const r = await startRec(page);
const T0 = Date.now(); const t = () => (Date.now() - T0) / 1000; const cuts = [];
await sleep(1800);
for (let i = 0; i < 5 && !/Tap Play/.test(await text(page)); i++) { await clickText(page, "^NEXT", 1500); await sleep(900); }
await sleep(1000);
await page.locator("button:visible", { hasText: /^\s*PLAY\s*$/i }).first().click(); await sleep(2500);   // line-up
await click(page, "⏩", 3000);
const b0 = t(); await sleep(4500); cuts.push([b0 + 0.8, t()]);                                            // sim wait
await click(page, "Continue", 5000); await sleep(1200);
let newsA = null, newsB = null;
for (let i = 0; i < 25; i++) {
  const tx = await text(page);
  if (/UNLOCKED/i.test(tx)) { await clickText(page, "^CLOSE$", 1500); await sleep(1200); continue; }
  if (/TAP TO CONTINUE/i.test(tx)) {
    if (newsA == null) newsA = t() + 1.2;
    await page.evaluate(() => { [...document.querySelectorAll("*")].filter((e) => !e.children.length && /tap to continue/i.test(e.textContent)).forEach((e) => { e.click(); e.parentElement && e.parentElement.click(); }); });
    await page.touchscreen.tap(195, 420).catch(() => {});
    await sleep(1500); continue;
  }
  if (/MY HOME/.test(tx)) { if (newsA != null && newsB == null) newsB = t(); break; }
  await sleep(800);
}
if (newsA != null && newsB != null && newsB - newsA > 3) cuts.push([newsA, newsB - 0.5]);
await sleep(2500);                                                                                          // Home, no tour
await page.reload({ waitUntil: "domcontentloaded" }); await sleep(5000);                                    // reload: still no tour
const raw = `${os.tmpdir()}/raw-tour.mp4`;
await stopRec(r, raw); await browser.close();
const segs = []; let p = 0;
for (const [c0, c1] of cuts) { segs.push([p, c0, 1]); p = c1; }
segs.push([p, 999, 1]);
finish(raw, `${OUT}/tour-once.mp4`, segs, { jpgAt: 1 });
console.log({ cuts, newsA, newsB });
