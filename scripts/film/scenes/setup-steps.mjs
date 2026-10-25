import os from "node:os";
// Clip 5: new career setup shows Step 1 of 3, 2 of 3, 3 of 3.
import { open, startRec, stopRec, click, sleep, finish, OUT } from "./lib.mjs";
const { browser, page } = await open(null);
const r = await startRec(page);
await sleep(1500);
await page.locator("input:visible").nth(0).fill("Sam"); await sleep(500);
await page.locator("input:visible").nth(1).fill("Saver"); await sleep(1500);
await click(page, "^Continue"); await sleep(2500);
await click(page, "^Continue"); await sleep(2800);
const raw = `${os.tmpdir()}/raw-setup.mp4`;
await stopRec(r, raw); await browser.close();
finish(raw, `${OUT}/setup-steps.mp4`, [[0, 999, 1]], { jpgAt: 3.2 });
