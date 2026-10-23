// BUILD-UP MIX STILLS (22 Oct 2026; Harry: "sometimes I still want fast long
// balls and tiki taka"). In the real match at phone size (390x844), switch On:
// Infinite Highlights (CanvasMatch through EnginePlay). Plays chance after
// chance until it has `--per` build-ups of each style (long, tiki, carry; read
// from window.__starLastBuildUp, lib/star/fhr/builders.ts), then plays each
// found one again and takes a still at its start, middle and end. Each still is
// written the moment it is made; then one sheet of them all.
//
//   node scripts/fhr/buildup-mix-stills.mjs [--url=http://localhost:3115] [--out=docs/handoffs/2026-10-22-buildup-mix] [--per=2]
import { phone } from "../film/rec.mjs";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3115");
const OUT = arg("out", "docs/handoffs/2026-10-22-buildup-mix");
const PER = Number(arg("per", "2"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { browser, context, page } = await phone({ deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.addInitScript(() => {
  localStorage.setItem("star-fhr", "on");
  localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(["one_on_one", "cutback", "tight_angle", "long_range", "byline_cross", "header", "volley"]));
  localStorage.setItem("star-fhr-adjust", JSON.stringify({ moment: "auto", length: "auto", intensity: "auto" }));
});
await page.goto(`${URL0}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.locator(".ih-play").first().waitFor({ timeout: 300000 });
await wait(2500);
await page.locator(".ih-stage").first().scrollIntoViewIfNeeded();

const last = () => page.evaluate(() => globalThis.__starLastBuildUp ?? null);
const label = () => page.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null);
async function play() {
  await page.evaluate(() => { globalThis.__starLastBuildUp = null; });
  await page.locator(".ih-play").first().click();
  for (let i = 0; i < 40; i++) { await wait(100); const b = await last(); if (b) return b; }
  return null;
}
async function stop() { await page.locator(".ih-play").first().click(); await wait(400); }
async function next() { await page.locator(".ih-next").first().click(); await wait(700); }

const have = { long: 0, tiki: 0, carry: 0 };
const shots = [];
for (let i = 0; i < 160 && Object.values(have).some((v) => v < PER); i++) {
  const b = await play();
  const want = b && b.what === "open" && !b.offside && b.style && have[b.style] < PER;
  await stop();
  if (want) {
    const n = ++have[b.style];
    const tag = `${b.style}-${n}`;
    console.log("found", tag, JSON.stringify(b));
    // Again, with the stills: start, middle, end of the build-up.
    await page.evaluate(() => { globalThis.__starLastBuildUp = null; });
    await page.locator(".ih-play").first().click();
    const t0 = Date.now();
    for (let k = 0; k < 100 && !(await label()); k++) await wait(20);
    const at = [0.12, b.durS / 2, Math.max(0.2, b.durS - 0.3)];
    const names = ["start", "middle", "end"];
    for (let k = 0; k < 3; k++) {
      const due = t0 + at[k] * 1000 - Date.now();
      if (due > 0) await wait(due);
      const path = `${OUT}/mix-${tag}-${k + 1}-${names[k]}.jpg`;
      await page.screenshot({ path, type: "jpeg", quality: 74 });
      console.log("still:", path, `(${((Date.now() - t0) / 1000).toFixed(2)} s of ${b.durS.toFixed(2)})`);
      shots.push({ tag, k, path, kind: b.kind, durS: b.durS, passes: b.passes });
    }
    await wait(800);
    await stop();
  }
  await next();
}
console.log("styles found:", JSON.stringify(have), "errors:", errors.length ? errors.slice(0, 3) : "none");

// One sheet: a row per build-up, start / middle / end.
const rows = [...new Set(shots.map((s) => s.tag))];
const fs = await import("node:fs");
const img = (p) => `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`;
const html = `<html><body style="margin:0;background:#111;font:600 15px system-ui;color:#fff">${rows.map((t) => {
  const r = shots.filter((s) => s.tag === t);
  return `<div style="padding:8px 8px 2px">${t.replace("-", " #")} · ${r[0].kind} · ${r[0].durS.toFixed(1)} s · ${r[0].passes} passes</div><div style="display:flex;gap:6px;padding:0 8px 10px">${r.map((s) => `<img src="${img(s.path)}" style="width:234px;height:506px;object-fit:cover;border-radius:6px">`).join("")}</div>`;
}).join("")}</body></html>`;
const sheet = await browser.newPage({ viewport: { width: 734, height: 600 } });
await sheet.setContent(html);
await sheet.screenshot({ path: `${OUT}/mix-sheet.jpg`, type: "jpeg", quality: 78, fullPage: true });
console.log("sheet:", `${OUT}/mix-sheet.jpg`);
await browser.close();
