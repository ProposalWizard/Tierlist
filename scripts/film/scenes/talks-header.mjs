import os from "node:os";
// Clip 4: contract talks - counter-offer; header "Their wage offer, per week" changes with THEIR OFFER.
import { open, startRec, stopRec, click, sleep, finish, OUT, shot } from "./lib.mjs";
const { browser, page } = await open("36-window");
for (const c of ["^CLUB", "Tamworth", "NEGOTIATE ·"]) { await click(page, c); await sleep(500); }
const inp = page.locator("input:visible").first();
const r = await startRec(page);
await sleep(1800);
const head = () => page.getByText(/Their wage offer, per week/).first().innerText();
let h0 = await head(), changed = false, jpgAt = 6;
for (let i = 0; i < 4 && !changed; i++) {
  const v = +(await inp.inputValue());
  await inp.fill(String(v + 3)); await sleep(1200);
  await click(page, "Set Asking Price"); await sleep(2200);
  const h1 = await head(); console.log(h0, "->", h1);
  if (h1 !== h0) changed = true;
}
await sleep(2500);
const raw = `${os.tmpdir()}/raw-talks.mp4`;
await stopRec(r, raw); await browser.close();
console.log("changed", changed);
finish(raw, `${OUT}/talks-header.mp4`, [[0, 999, 1]], { jpgAt: 99 });
