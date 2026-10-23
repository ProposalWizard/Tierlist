import os from "node:os";
// Clip 2: "Deal agreed" in the summer window -> reload -> window list, still able to sign.
import { open, startRec, stopRec, click, banner, sleep, finish, text, OUT } from "./lib.mjs";
const { browser, page } = await open("36-window");
const r = await startRec(page);
await sleep(1000);
for (const c of ["^CLUB", "Tamworth", "NEGOTIATE ·"]) { await click(page, c); await sleep(700); }
await click(page, "Accept Offer"); await sleep(2200);          // Deal agreed
await banner(page, "Refresh →"); await sleep(1600);
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(3500);                                              // window list again
for (const c of ["^CLUB", "Tamworth", "NEGOTIATE ·"]) { await click(page, c); await sleep(900); }
await click(page, "Accept Offer"); await sleep(2200);           // can sign again
if (!/Deal agreed/i.test(await text(page))) console.log("WARN: no second deal");
const raw = `${os.tmpdir()}/raw-deal.mp4`;
await stopRec(r, raw); await browser.close();
finish(raw, `${OUT}/refresh-deal.mp4`, [[0, 999, 1]], { jpgAt: 3.4 });
