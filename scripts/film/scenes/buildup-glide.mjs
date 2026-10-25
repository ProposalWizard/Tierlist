// Scene: Full-highlights build-ups on Infinite Highlights, one clip per style.
//
//   node scripts/film/scenes/buildup-glide.mjs <baseUrl> <outDir> <name> [styles=long,tiki] [maxTries=25]
//
// Plays chance after chance (open-play kinds) and keeps the FIRST build-up of
// each asked style (lib/star/fhr/builders.ts writes the last one's style to
// globalThis.__starLastBuildUp), filmed from Play to a second after the chance
// is yours. Writes <outDir>/<name>-<style>.mp4 + .jpg (a still mid-move) and
// <outDir>/<name>-cam-<style>.json: the camera every frame (for counting
// reversals / jumps in the real page).
import { phone, startRec, stopRec, shot } from "../rec.mjs";
import fs from "node:fs";

const [base = "http://localhost:3191", outDir = "/tmp", name = "buildup", stylesArg = "long,tiki", triesArg = "25"] = process.argv.slice(2);
const want = new Set(stylesArg.split(","));
const { browser, page } = await phone();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`${base}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.evaluate(() => { localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(["one_on_one", "through_ball", "long_range", "cutback", "tight_angle"])); });
await page.reload({ waitUntil: "networkidle", timeout: 300000 });
{ const w = page.getByRole("button", { name: "Watch these" }); if (await w.count()) await w.click(); }
await page.waitForSelector(".ih-play", { timeout: 120000 });
await page.waitForTimeout(800);
for (let k = 0; k < Number(triesArg) && want.size; k++) {
  if (k > 0) { await page.click(".ih-next"); await page.waitForTimeout(600); }
  await page.evaluate(() => { globalThis.__starLastBuildUp = null; window.__camLog = []; });
  const r = await startRec(page);
  if (/play/i.test(await page.locator(".ih-play").innerText())) await page.click(".ih-play");
  await page.waitForFunction(() => !!window.__starMatch, null, { timeout: 30000 });
  // Log the camera each frame while the build-up plays.
  await page.evaluate(() => {
    const log = window.__camLog; const t0 = performance.now();
    const tick = () => { const m = window.__starMatch; if (!m) return; const f = m.frame(); log.push({ t: (performance.now() - t0) / 1000, cam: f.cam, phase: m.phase(), ball: m.ball(), lead: !!document.querySelector("[data-buildup]") }); if (log.length < 900) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(400);
  const bu = await page.evaluate(() => globalThis.__starLastBuildUp);
  const style = bu?.style;
  if (!bu || !style || !want.has(style)) {
    await r.cdp.send("Page.stopScreencast").catch(() => {});
    await page.click(".ih-play").catch(() => {}); // stop
    console.log(`chance ${k + 1}: ${bu ? `${bu.kind} ${style ?? bu.what}` : "no build-up"} — skipped`);
    await page.waitForTimeout(400);
    continue;
  }
  want.delete(style);
  const len = bu.durS;
  await page.waitForTimeout(Math.max(0, len * 500 - 400));
  await shot(page, `${outDir}/${name}-${style}.jpg`);
  await page.waitForFunction(() => !/tap to skip/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await stopRec(r, `${outDir}/${name}-${style}.mp4`, { holdEnd: 0.4 });
  const log = await page.evaluate(() => window.__camLog);
  fs.writeFileSync(`${outDir}/${name}-cam-${style}.json`, JSON.stringify({ kind: bu.kind, durS: len, log }));
  console.log(`chance ${k + 1}: ${bu.kind} ${style}, ${len.toFixed(2)} s build-up — filmed`);
  await page.click(".ih-play").catch(() => {});
  await page.waitForTimeout(400);
}
if (want.size) console.log(`not found: ${[...want].join(", ")}`);
console.log(`page errors: ${errs.length}${errs.length ? " " + errs.slice(0, 3).join(" | ") : ""}`);
await browser.close();
