// Real Goals chat 5: a still of every banger's start picture (build-up off), 390x844. Needs a dev server on :3200. node scripts/star-sandbox/banger-stills.mjs OUT_DIR [id,id]
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const only = process.argv[3] ? process.argv[3].split(",") : null;
const ids = JSON.parse(readFileSync("data/realmoments/bangers.json", "utf8")).goals.map((g) => g.id).filter((id) => !only || only.includes(id));
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
for (const id of ids) {
  try {
    await p.goto(`http://localhost:3200/star-real-goals-dev?play=${id}`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForSelector(`[data-playing="${id}"]`, { timeout: 120000 });
    await p.getByText(/Build-up on/).click();
    await p.waitForTimeout(2200);
    const el = await p.$(`[data-playing="${id}"]`);
    await el.screenshot({ path: `${OUT}/${id}.jpg`, type: "jpeg", quality: 55 });
    console.log("ok", id);
  } catch (e) { console.log("FAIL", id, String(e).slice(0, 120)); }
}
await b.close();
