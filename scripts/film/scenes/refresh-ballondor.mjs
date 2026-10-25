import os from "node:os";
// Clip 1: Ballon d'Or night -> reload -> back on the ceremony (not Home).
import { open, startRec, stopRec, shot, banner, sleep, finish, OUT } from "./lib.mjs";
const { browser, page } = await open("33-bdor");
const r = await startRec(page);
await sleep(4000);
await banner(page, "Refresh →");
await sleep(1500);
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(7000);
const raw = `${os.tmpdir()}/raw-bdor.mp4`;
await stopRec(r, raw);
await browser.close();
finish(raw, `${OUT}/refresh-ballondor.mp4`, [[0, 99, 1]], { jpgAt: 8 });
