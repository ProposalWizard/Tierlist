// Phase 2 in a real browser: /star-fhr-dev's generated build-up, played by the
// real match. For N build-ups ("Generate another" between them): a still early,
// half-way and once the chance is yours, and whether the build-up ran its full
// length and handed over. Page errors are counted.
//
//   node scripts/fhr/buildup-browser.mjs [port=3054] [N=3] [outDir]
import { chromium, devices } from "playwright";
const port = Number(process.argv[2] ?? 3054);
const n = Number(process.argv[3] ?? 3);
const out = process.argv[4] ?? "docs/handoffs/2026-10-19-ui-lookover/built-pages";
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--disable-dev-shm-usage"] });
const pg = await (await b.newContext({ ...devices["iPhone 13"] })).newPage();
const errs = [];
pg.on("pageerror", (e) => errs.push(String(e)));
pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
await pg.goto(`http://localhost:${port}/star-fhr-dev`, { waitUntil: "domcontentloaded", timeout: 600000 });
await pg.waitForSelector("[data-fhr-buildup] canvas", { timeout: 600000 });
const state = () => pg.evaluate(() => { const e = document.querySelector("[data-fhr-buildup]"); return { s: e?.getAttribute("data-fhr-buildup-state"), t: Number(e?.getAttribute("data-fhr-buildup-t")), len: Number(e?.getAttribute("data-fhr-buildup-len")) }; });
const shot = async (name) => {
  const el = await pg.$("[data-fhr-buildup]");
  await el.scrollIntoViewIfNeeded();
  await el.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 80 });
};
for (let k = 1; k <= n; k++) {
  if (k > 1) { await pg.getByText("Generate another").click(); await pg.waitForTimeout(300); }
  const t0 = Date.now();
  let first = null, mid = false, ended = null, maxT = 0;
  while (Date.now() - t0 < 60000) {
    const s = await state();
    maxT = Math.max(maxT, s.t || 0);
    if (!first && s.s === "buildup" && s.t > 0.3) { first = s; await shot(`fhr-buildup-live-${k}a`); }
    if (first && !mid && s.t > s.len / 2) { mid = true; await shot(`fhr-buildup-live-${k}b`); }
    if (s.s === "play") { ended = s; await pg.waitForTimeout(400); await shot(`fhr-buildup-live-${k}c`); break; }
    await pg.waitForTimeout(120);
  }
  console.log(`build-up ${k}: length ${first?.len ?? "?"} s, ran to ${maxT.toFixed(2)} s, ${ended ? "handed over to the chance" : "NEVER handed over"} in ${((Date.now() - t0) / 1000).toFixed(1)} s wall`);
}
console.log(`page errors: ${errs.length}${errs.length ? "\n  " + errs.slice(0, 5).join("\n  ") : ""}`);
await b.close();
