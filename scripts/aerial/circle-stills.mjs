// The header/volley "perfect" circle at Aerial 30 / 60 / 90 (22 Oct 2026; Harry:
// "having a better aerial stat should make the circle to get perfect bigger").
// The real ContactBall on the media lab (?contact=float|bounce&aerial=N), 390x844.
//   node scripts/aerial/circle-stills.mjs [--url=http://localhost:3115] [--out=docs/handoffs/2026-10-22-buildup-mix]
import { phone } from "../film/rec.mjs";
const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3115");
const OUT = arg("out", "docs/handoffs/2026-10-22-buildup-mix");
const { browser, page } = await phone({ deviceScaleFactor: 1 });
const shots = [];
for (const motion of ["float", "bounce"]) {
  for (const a of [30, 60, 90]) {
    await page.goto(`${URL0}/star-dev/media-lab?contact=${motion}&aerial=${a}`, { waitUntil: "domcontentloaded", timeout: 300000 });
    await page.locator("[data-air-centre]").first().waitFor({ timeout: 300000 });
    await page.waitForTimeout(900);
    const r = await page.locator("[data-air-centre]").first().getAttribute("data-air-centre-r");
    const path = `${OUT}/aerial-circle-${motion === "float" ? "header" : "volley"}-${a}.jpg`;
    await page.screenshot({ path, type: "jpeg", quality: 80 });
    console.log("still:", path, "r =", r);
    shots.push({ path, a, motion, r });
  }
}
const fs = await import("node:fs");
const img = (p) => `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`;
const html = `<html><body style="margin:0;background:#111;font:600 15px system-ui;color:#fff">${["float", "bounce"].map((m) => `<div style="padding:8px">${m === "float" ? "Header" : "Volley"}: Aerial 30 / 60 / 90</div><div style="display:flex;gap:6px;padding:0 8px 10px">${shots.filter((s) => s.motion === m).map((s) => `<div><img src="${img(s.path)}" style="width:234px;height:506px;object-fit:cover;border-radius:6px"><div style="text-align:center">Aerial ${s.a} · circle ${Number(s.r).toFixed(2)}</div></div>`).join("")}</div>`).join("")}</body></html>`;
const sheet = await browser.newPage({ viewport: { width: 734, height: 600 } });
await sheet.setContent(html);
await sheet.screenshot({ path: `${OUT}/aerial-circle-sheet.jpg`, type: "jpeg", quality: 80, fullPage: true });
console.log("sheet:", `${OUT}/aerial-circle-sheet.jpg`);
await browser.close();
