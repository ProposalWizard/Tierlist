// Scene: ONE header, cross to result, for the header look (headerBeat.ts, 25 Oct 2026).
//
//   node scripts/film/scenes/header-beat.mjs <baseUrl> <out.mp4> <hl|drill> <good|late> [drillLevel]
//
// hl    = Infinite Highlights (/star-highlights-dev), headers only, with the build-up.
// drill = the Head & Volley drill (/star-training-dev → Aerial → level), first rep (a header).
// good  = aim at goal, then head it on top of the ball early (≈0.4 s into the timer).
//         hl only: skips crosses out of reach (MAX_Z, default 2.15 m); NEED_GOAL=1 keeps
//         trying (TRIES, default 8) until one goes in.
// late  = aim, then never tap: the timer runs out (TOO LATE) and the header is met late.
//
// The clip is cut to start about 1 s before the cross is struck and end about
// 1 s after the result. Writes <out.mp4> (≤ 4 MB) and the same-name .jpg (the
// moment the ball comes off his head), and prints a "Look for" line with times.
import { phone, startRec, stopRec } from "../rec.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const [base = "http://localhost:3197", out = "/tmp/header.mp4", where = "hl", how = "good", lvlArg = "6"] = process.argv.slice(2);
const MAX_Z = Number(process.env.MAX_Z ?? 2.15); // good: a cross you can reach (no "JUST A TOUCH")
const { browser, page } = await phone();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

// In-page event clock: wall-clock seconds of each moment, read off the match.
async function armClock() {
  await page.evaluate(() => {
    const ev = (window.__ev = { cross: null, aim: null, contact: null, flight: null, result: null, label: null, goal: null });
    let lastPhase = null;
    const tick = () => {
      const m = window.__starMatch;
      if (m) {
        const now = Date.now() / 1000;
        const L = m.leadIn && m.leadIn();
        if (L && !ev.lead) ev.lead = { durS: L.durS, passStart: L.passStart, passEnd: L.passEnd, at: now - L.t };
        if (L && ev.cross === null) {
          const ps = L.passStart && L.passStart.length ? L.passStart[L.passStart.length - 1] : null;
          if (ps !== null && L.t >= ps) ev.cross = now - (L.t - ps);
        }
        const ph = m.phase();
        if (ph === "aim" && ev.aim === null && !L) ev.aim = now;
        if (ph !== lastPhase) {
          if (ph === "aim" && ev.aim === null && !L) ev.aim = now;
          if (ph === "contact" && ev.contact === null) ev.contact = now;
          if (ph === "flight" && ev.flight === null) ev.flight = now;
          if (ev.flight !== null && ph !== "flight" && ev.result === null) ev.result = now;
          lastPhase = ph;
        }
        if ((ph === "flight" || ph === "result") && ev.flight !== null && ev.goal === null) { const b = m.ballState && m.ballState(); if (b && b.inNet) ev.goal = now; }
        const g = document.querySelector("[data-contact-grade]");
        if (g && !ev.label) ev.label = g.getAttribute("data-contact-grade");
      }
      if (ev.result === null || Date.now() / 1000 - ev.result < 3) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function aimAndStrike() {
  // "aim" is also the phase while a build-up plays: wait for the hand-over.
  await page.waitForFunction(() => window.__starMatch && window.__starMatch.phase() === "aim" && !window.__starMatch.leadIn(), null, { timeout: 90000 });
  const sc = await page.evaluate(() => window.__starMatch.frame().sc);
  return sc;
}

async function dragAim() {
  await page.waitForFunction(() => !/tap to skip/i.test(document.body.innerText), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  // The camera can still be settling after the hand-over: wait until the ball holds still on the glass.
  for (let i = 0, prev = null; i < 40; i++) {
    const b = await page.evaluate(() => window.__starMatch.ball());
    if (prev && Math.hypot(b.x - prev.x, b.y - prev.y) < 0.5) break;
    prev = b; await page.waitForTimeout(80);
  }
  const fr = await page.evaluate(() => ({ ball: window.__starMatch.ball(), goal: window.__starMatch.goal() }));
  const dx = fr.ball.x - fr.goal.x, dy = fr.ball.y - fr.goal.y, L = Math.hypot(dx, dy) || 1;
  await page.mouse.move(fr.ball.x, fr.ball.y); await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(fr.ball.x + (dx / L) * 110 * i / 14, fr.ball.y + (dy / L) * 110 * i / 14); await page.waitForTimeout(16); }
  if (process.env.SHOTS) await page.screenshot({ path: out.replace(/\.mp4$/, `.aim${Date.now() % 100000}.jpg`) });
  await page.mouse.up();
  await page.waitForFunction(() => window.__starMatch.phase() === "contact", null, { timeout: 8000 }).catch(async (e) => {
    await page.screenshot({ path: out.replace(/\.mp4$/, ".fail.jpg") });
    console.log("no strike screen", JSON.stringify(fr), await page.evaluate(() => JSON.stringify({ ph: window.__starMatch.phase(), ball: window.__starMatch.ball(), f: (({ cam, canvas, box, tilt, zoom, facing }) => ({ cam, canvas, box, tilt, zoom, facing }))(window.__starMatch.frame()), b: window.__starMatch.frame().sc.ball })));
    throw e;
  });
}

async function strike() {
  if (how === "late") return;
  await page.waitForTimeout(380);
  const b = page.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  const bb = await b.boundingBox();
  if (bb) { const rr = bb.width / 2; await page.mouse.click(bb.x + rr, bb.y + rr - 0.12 * rr); }
}

let r = null, ok = false;
if (where === "drill") {
  await page.goto(`${base}/star-training-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForLoadState("networkidle", { timeout: 300000 }).catch(() => {});
  for (let k = 0; k < 20; k++) {
    await page.getByRole("tab", { name: /Aerial/ }).click({ timeout: 120000 });
    await page.waitForTimeout(700);
    if (/header|volley/.test(await page.locator(".tr-tile").first().innerText())) break;
  }
  await page.locator(".tr-tile").nth(Number(lvlArg) - 1).click();
  await page.waitForTimeout(400);
  r = await startRec(page);
  await armClock();
  await page.getByRole("button", { name: /Let.s go/ }).click();
  await aimAndStrike();
  // No build-up in the drill: the cross is drawn coming in from the crosser as the rep opens.
  await page.evaluate(() => { window.__ev.cross = window.__ev.aim; });
  await dragAim(); await strike();
  ok = true;
} else {
  await page.goto(`${base}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.evaluate(() => { localStorage.setItem("star-highlights-kinds-v1", JSON.stringify(["header"])); });
  await page.reload({ waitUntil: "networkidle", timeout: 300000 });
  { const w = page.getByRole("button", { name: "Watch these" }); if (await w.count()) await w.click(); }
  await page.waitForSelector(".ih-play", { timeout: 120000 });
  await page.waitForTimeout(800);
  for (let k = 0; k < Number(process.env.TRIES ?? 8) && !ok; k++) {
    if (k > 0) { await page.click(".ih-next"); await page.waitForTimeout(500); }
    r = await startRec(page);
    await armClock();
    if (/play/i.test(await page.locator(".ih-play").innerText())) await page.click(".ih-play");
    const sc = await aimAndStrike();
    const z = sc.airZ ?? 1.85;
    if (how === "good" && z > MAX_Z) {
      console.log(`chance ${k + 1}: cross at ${z.toFixed(2)} m, out of reach, next`);
      await r.cdp.send("Page.stopScreencast").catch(() => {});
      r = null;
      continue;
    }
    await dragAim(); await strike();
    if (how === "good" && process.env.NEED_GOAL) {
      await page.waitForFunction(() => window.__ev.result !== null, null, { timeout: 20000 }).catch(() => {});
      const e = await page.evaluate(() => window.__ev);
      if (!e.goal) {
        console.log(`chance ${k + 1}: ${e.label}, no goal, next`);
        await r.cdp.send("Page.stopScreencast").catch(() => {});
        r = null;
        continue;
      }
    }
    ok = true;
  }
}
if (!ok || !r) { console.log("no usable chance"); await browser.close(); process.exit(1); }
await page.waitForFunction(() => window.__ev && window.__ev.result !== null, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1300);
const ev = await page.evaluate(() => window.__ev);
const v0 = r.frames[0].t;
const raw = out.replace(/\.mp4$/, ".raw.mp4");
await stopRec(r, raw, { holdEnd: 0.2 });
await browser.close();

const rel = (t) => (t === null ? null : Math.max(0, t - v0));
const crossT = rel(ev.cross ?? (ev.aim !== null ? ev.aim - 1.2 : null));
// Never before the build-up itself starts (the page is still loading then).
const t0 = Math.max(0, crossT - (where === "drill" ? 0.05 : 1.0), ev.lead ? rel(ev.lead.at) + 0.05 : 0);
const tEnd = Math.min(ev.goal !== null ? rel(ev.goal) + 1.8 : (rel(ev.result) ?? rel(ev.flight) + 2) + 1.0, rel(ev.flight) + 4.5);
const ff = (args) => { const s = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]); if (s.status !== 0) throw new Error(s.stderr.toString()); };
for (const crf of [26, 30, 34]) {
  ff(["-ss", t0.toFixed(3), "-to", tEnd.toFixed(3), "-i", raw, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-movflags", "+faststart", "-an", out]);
  if (fs.statSync(out).size <= 4 * 1024 * 1024) break;
}
fs.rmSync(raw, { force: true });
const at = (t) => (t === null ? "?" : (t - t0).toFixed(1));
// The poster: the ball coming off his head (the end of the rise, just after the strike screen closes).
const posterT = Math.max(0, rel(ev.flight) - t0 + 0.2);
ff(["-ss", posterT.toFixed(3), "-i", out, "-frames:v", "1", "-q:v", "3", out.replace(/\.mp4$/, ".jpg")]);
console.log(JSON.stringify({ out, size: fs.statSync(out).size, dur: +(tEnd - t0).toFixed(2), label: ev.label,
  lead: ev.lead ? { durS: ev.lead.durS, passStart: ev.lead.passStart, startAt: at(rel(ev.lead.at)) } : null,
  at: { cross: at(crossT), aim: at(rel(ev.aim)), headIt: at(rel(ev.contact)), header: at(rel(ev.flight)), result: at(rel(ev.result)), goal: at(rel(ev.goal)) }, errors: errs.length }));
