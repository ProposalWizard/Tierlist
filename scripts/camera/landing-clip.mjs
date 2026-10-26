// A clip of one build-up landing on its chance (25 Oct 2026, the build-up
// landing review): Play, the whole build-up, the hand-over, and about two
// seconds of the chance after it. Never touches the ball or the result.
//
//   node scripts/camera/landing-clip.mjs <baseUrl> <out.mp4> <kind> [index=0]
//
// Infinite Highlights, a 390x844 phone at 2x, build-ups On; the index-th
// chance of that kind in a fresh visit (the same chance on any build).
// Writes <out.mp4> and <out>-cam.json: the camera, the men's height and
// whether the build-up is playing, every frame (to check for a pop).
// Needs a build with NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (window.__starMatch).
import { phone, startRec, stopRec } from "../film/rec.mjs";
import fs from "node:fs";

const [base, out, kind, idxS = "0"] = process.argv.slice(2);
const idx = Number(idxS);
const { browser, context, page } = await phone({ touches: false });
await context.addInitScript((k) => {
  if (!sessionStorage.getItem("lc")) { localStorage.setItem("star-highlights-kinds-v1", JSON.stringify([k])); localStorage.setItem("star-fhr", "on"); sessionStorage.setItem("lc", "1"); }
  const rec = (window.__lp = []);
  const tick = () => {
    try {
      const m = window.__starMatch;
      if (m && m.frame) { const f = m.frame(); rec.push({ t: performance.now(), phase: m.phase(), lead: m.leadIn ? !!m.leadIn() : false, cam: f.cam, figPx: f.figPx }); }
    } catch { /* */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, kind);
await page.goto(`${base}/star-highlights-dev?fhr=on`, { waitUntil: "domcontentloaded", timeout: 600000 });
{ const w = page.getByRole("button", { name: "Watch these" }); await w.waitFor({ timeout: 120000 }).catch(() => {}); if (await w.count()) await w.click(); }
await page.waitForSelector(".ih-stage[data-still-cam]", { timeout: 120000 });
await page.waitForTimeout(800);
for (let k = 0; k < idx; k++) { await page.click("button.ih-next"); await page.waitForTimeout(300); }
const r = await startRec(page);
await page.waitForTimeout(500);
await page.evaluate(() => { window.__lp.length = 0; });
await page.click("button.ih-play");
await page.waitForFunction(() => { const r = window.__lp; return r.findIndex((x, n) => n > 0 && r[n - 1].lead && !x.lead) > 0; }, null, { timeout: 30000, polling: "raf" }).catch(() => {});
await page.waitForTimeout(2000);
await stopRec(r, out, { holdEnd: 0.4 });
const log = await page.evaluate(() => window.__lp);
fs.writeFileSync(out.replace(/\.mp4$/, "-cam.json"), JSON.stringify(log));
// The biggest frame-to-frame change in camera width and centre, and at the hand-over.
let maxW = 0, maxC = 0, hand = null;
for (let i = 1; i < log.length; i++) {
  const a = log[i - 1].cam, b = log[i].cam;
  const w = Math.abs((b.x2 - b.x1) / (a.x2 - a.x1) - 1) * 100;
  const c = Math.hypot((a.x1 + a.x2 - b.x1 - b.x2) / 2, (a.y1 + a.y2 - b.y1 - b.y2) / 2);
  maxW = Math.max(maxW, w); maxC = Math.max(maxC, c);
  if (log[i - 1].lead && !log[i].lead) hand = { widthPct: +w.toFixed(3), centreM: +c.toFixed(3), men: [log[i - 1].figPx, log[i].figPx] };
}
console.log(`${out}: ${log.length} frames; biggest step ${maxW.toFixed(2)}% width, ${maxC.toFixed(2)} m centre; hand-over ${JSON.stringify(hand)}`);
await browser.close();
