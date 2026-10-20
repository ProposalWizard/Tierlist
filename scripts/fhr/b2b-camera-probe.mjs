// B2b (Full highlights rebuild, 20 Oct 2026): the camera at the hand-over, in
// the real match. Harry: "The highlights need to end on the actual camera we
// have been using in game … I don't want that to drift."
//
//   node scripts/fhr/b2b-camera-probe.mjs [--url=http://localhost:3062] [--size=390x844] [--n=8] [--out=<json>]
//
// Plays Infinite Match (/star-play-dev → Infinite Match: the real CanvasMatch
// through EnginePlay, the same loadScenario path as a career match) with the
// switch On. Every animation frame it reads the camera the match drew with
// (window.__starMatch.frame(): the frame in pitch metres, facing, tilt, and
// where both goalposts land on the glass). For each build-up it compares the
// LAST build-up frame with the FIRST frame of the chance, and the chance's
// first frame with the chance's camera a second later (a re-frame after the
// hand-over would show there):
//   centre — the goal's middle on the glass (px), scale — post-to-post px,
//   angle — the post line's turn on the glass + the camera tilt.
// Then it shoots (so the match moves on) and waits for the next build-up.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const arg = (k, d) => process.argv.slice(2).find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const URL0 = arg("url", "http://localhost:3062");
const [W, H] = arg("size", "390x844").split("x").map(Number);
const N = Number(arg("n", "8"));
const OUT = arg("out", "");
// --resize=1: a window resize event 1 s into every build-up (a phone's address bar
// sliding away does this). The chance's camera must not follow the build-up's men.
const RESIZE = arg("resize", "0") === "1";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const exe = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--disable-dev-shm-usage"] });
const mobile = W < 600;
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
await context.addInitScript(() => {
  localStorage.setItem("star-fhr", "on");
  localStorage.setItem("star-match-speed", "8");
  // Every frame: the camera the match drew with, and whether a build-up label is up.
  const rec = (window.__camRec = []);
  const tick = () => {
    try {
      const m = window.__starMatch;
      if (m && m.frame) {
        const f = m.frame();
        const pl = f.men.find((x) => x.role === "postL"), pr = f.men.find((x) => x.role === "postR");
        const lab = document.querySelector("[data-buildup]")?.textContent ?? null;
        rec.push({
          t: performance.now(), phase: m.phase(), kind: f.kind, lab,
          cam: f.cam, facing: f.facing, tilt: f.tilt, zoom: f.zoom,
          cx: (pl.cx + pr.cx) / 2, cy: (pl.cy + pr.cy) / 2, span: Math.hypot(pr.cx - pl.cx, pr.cy - pl.cy),
          ang: (Math.atan2(pr.cy - pl.cy, pr.cx - pl.cx) * 180) / Math.PI,
          box: f.box,
        });
        if (rec.length > 4000) rec.splice(0, 1000);
      }
    } catch { /* not ready */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL0}/star-play-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.getByText("Infinite Match", { exact: false }).first().click({ timeout: 120000 });
await page.waitForFunction(() => !!window.__starMatch, null, { timeout: 180000 });
await wait(1500);

async function shoot() {
  const b = await page.evaluate(() => window.__starMatch?.ball?.());
  if (!b) return "no-ball";
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(b.x, b.y + (90 * i) / 12); await wait(16); }
  await page.mouse.up();
  await wait(700);
  const ball = page.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  if (await ball.count()) {
    const bb = await ball.boundingBox();
    if (bb) { const r = bb.width / 2; await page.mouse.click(bb.x + r, bb.y + r + 0.15 * r); }
  }
  return "struck";
}

const results = [];
for (let k = 0; k < N; k++) {
  // Wait for a build-up to start (or a chance with none: shoot it and go on).
  let saw = false;
  for (let i = 0; i < 400; i++) {
    const lab = await page.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null);
    if (lab) { saw = true; break; }
    const ph = await page.evaluate(() => window.__starMatch?.phase?.());
    if (ph === "aim" && i > 40) { await shoot(); await wait(500); }
    if (i % 20 === 19) {
      // A pause (half time, a stoppage) waits for its button.
      const b = page.locator("button:visible").filter({ hasText: /continue|second half|kick off|play on|resume/i }).first();
      if (await b.count()) await b.click({ timeout: 2000 }).catch(() => {});
      if (process.env.PROBE_DEBUG && i % 100 === 99) { console.log("waiting, phase", ph); await page.screenshot({ path: `${process.env.PROBE_DEBUG}/wait-${k}-${i}.jpg`, type: "jpeg" }); }
    }
    await wait(100);
  }
  if (!saw) break;
  const t0 = await page.evaluate(() => performance.now());
  if (RESIZE) { await wait(1000); await page.evaluate(() => window.dispatchEvent(new Event("resize"))); }
  // …and to end, then a second and a half of the chance.
  for (let i = 0; i < 200; i++) {
    const lab = await page.evaluate(() => document.querySelector("[data-buildup]")?.textContent ?? null);
    if (!lab) break;
    await wait(50);
  }
  await wait(1600);
  // The camera the match frames this chance with, everyone on his spot: a resize
  // now re-frames it from the drawing. Any change = the chance was on another camera.
  const before = await page.evaluate(() => window.__camRec[window.__camRec.length - 1]);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await wait(300);
  const after = await page.evaluate(() => window.__camRec[window.__camRec.length - 1]);
  const recs = await page.evaluate((from) => window.__camRec.filter((r) => r.t >= from), t0);
  // The hand-over: the last frame the build-up camera drew (label up), then the first without.
  const iEnd = recs.findIndex((r, i) => i > 0 && recs[i - 1].lab && !r.lab);
  if (iEnd > 0) {
    const a = recs[iEnd - 1], b = recs[iEnd], c = recs.find((r) => r.t > b.t + 1000) ?? recs[recs.length - 1];
    // The biggest frame-to-frame step in the last half-second of the build-up (how it lands).
    let maxStep = 0;
    for (let i = Math.max(1, iEnd - 30); i <= iEnd; i++) maxStep = Math.max(maxStep, Math.hypot(recs[i].cx - recs[i - 1].cx, recs[i].cy - recs[i - 1].cy));
    const d = (p, q) => ({
      centrePx: +Math.hypot(p.cx - q.cx, p.cy - q.cy).toFixed(2),
      scalePct: +((Math.abs(p.span - q.span) / q.span) * 100).toFixed(3),
      angleDeg: +(Math.abs(p.ang - q.ang) + Math.abs(p.tilt - q.tilt)).toFixed(3),
      facing: p.facing === q.facing,
    });
    const row = { kind: b.kind, ending: a.lab, lastBuildUpVsFirstChance: d(a, b), firstChanceVs1sLater: d(b, c), chanceVsReframed: before && after && before.phase === "aim" ? d(before, after) : null, maxStepLastHalfSecondPx: +maxStep.toFixed(2), canvas: `${Math.round(b.box.w)}x${Math.round(b.box.h)}` };
    results.push(row);
    console.log(JSON.stringify(row));
  }
  // Move the match on.
  for (let i = 0; i < 30; i++) {
    const ph = await page.evaluate(() => window.__starMatch?.phase?.());
    if (ph === "aim") { await shoot(); break; }
    await wait(200);
  }
  await wait(2500);
}
if (OUT) writeFileSync(OUT, JSON.stringify({ size: `${W}x${H}`, results, errors: errors.slice(0, 5) }, null, 1));
console.log(`${W}x${H}: ${results.length} hand-overs; errors: ${errors.length ? errors.slice(0, 3).join(" | ") : "none"}`);
await browser.close();
