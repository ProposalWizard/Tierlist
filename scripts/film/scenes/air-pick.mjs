// Scene: ONE header or volley in the new flow (lib/star/airPick.ts, 25 Oct 2026):
// see the chance → your man goes up → the timer and the goal → the result.
//
//   node scripts/film/scenes/air-pick.mjs <baseUrl> <out.mp4> <hl|drill> <header|volley> <good|late> [drillLevel]
//
// hl    = Infinite Highlights (/star-highlights-dev), that kind only, with the build-up.
// drill = the Head & Volley drill (/star-training-dev → Aerial → level), first rep (a header).
// good  = tap the far corner (low) from the keeper while the timer is in the green.
//         NEED_GOAL=1 keeps trying (TRIES, default 8) until one goes in.
// late  = never tap: the timer runs out (TOO LATE) and the late touch is struck.
// MAX_Z (default 2.15 m): a good header skips crosses above your reach.
// STILLS=1 also saves three stills of the timer screen (<out>.pick-1..3.jpg).
//
// The clip starts about 1 s before the cross (the build-up's last pass, or the
// moment the drill's rep opens) and ends 1 s after the result. Writes <out.mp4>
// (≤ 4 MB) and <out.jpg> (the timer screen, mid-band), and prints the times.
import { phone, startRec, stopRec } from "../rec.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const [base = "http://localhost:3205", out = "/tmp/airpick.mp4", where = "hl", kind = "header", how = "good", lvlArg = "6"] = process.argv.slice(2);
const MAX_Z = Number(process.env.MAX_Z ?? 2.15); // good header: a cross you can reach
const { browser, page } = await phone();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

async function armClock() {
  await page.evaluate(() => {
    const ev = (window.__ev = { cross: null, aim: null, open: null, flight: null, result: null, label: null, goal: null, lead: null });
    let lastPhase = null;
    const tick = () => {
      const m = window.__starMatch;
      if (m) {
        const now = Date.now() / 1000;
        const L = m.leadIn && m.leadIn();
        // The cross: the build-up's last pass. Kept up to date, so a build-up
        // played again (after an offside) is timed from its own last run.
        if (L) {
          const ps = L.passStart && L.passStart.length ? L.passStart[L.passStart.length - 1] : null;
          if (ps !== null && L.t >= ps) ev.cross = now - (L.t - ps);
          ev.lead = { durS: L.durS, at: now - L.t };
        }
        const ph = m.phase();
        if (ph === "aim" && ev.aim === null && !L) ev.aim = now;
        if (ph !== lastPhase) {
          if (ph === "contact" && ev.open === null) ev.open = now;
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

async function waitHandOver() {
  await page.waitForFunction(() => window.__starMatch && window.__starMatch.phase() === "aim" && !window.__starMatch.leadIn(), null, { timeout: 90000 });
}

const stills = [];
async function pick() {
  await page.waitForSelector("[data-air-pick]", { timeout: 15000 });
  // The tap is made inside the page, on the match's own clock, so a slow
  // screenshot (or a busy machine) can never make it miss the green.
  const tapped = how === "late" ? null : page.evaluate(() => new Promise((done) => {
    const step = () => {
      const a = window.__starMatch.airPick();
      if (!a || a.tapped) return done(null);
      if (a.u >= a.bandFrom + 0.35 * (1 - a.bandFrom)) {
        const g = document.querySelector("[data-air-goal]").getBoundingClientRect();
        const gx = (a.keeperGx < 0 ? 1 : -1) * 0.82, gy = 0.18;
        const x = g.left + ((gx + 1) / 2) * g.width, y = g.top + (1 - gy) * g.height;
        const el = document.elementFromPoint(x, y) ?? document.querySelector("[data-air-goal]");
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "touch", isPrimary: true }));
        // the white touch dot rec.mjs draws for a real finger
        const dot = document.createElement("div");
        Object.assign(dot.style, { position: "fixed", left: `${x - 14}px`, top: `${y - 14}px`, width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.75)", border: "2px solid rgba(0,0,0,0.5)", zIndex: 99999, pointerEvents: "none" });
        document.body.appendChild(dot); setTimeout(() => dot.remove(), 350);
        return done({ u: a.u, bandFrom: a.bandFrom, gx });
      }
      requestAnimationFrame(step);
    };
    step();
  }));
  if (process.env.STILLS) {
    await page.waitForTimeout(200);
    stills.push(out.replace(/\.mp4$/, ".pick-1.jpg")); await page.screenshot({ path: stills.at(-1) });
    await page.waitForFunction(() => { const a = window.__starMatch.airPick(); return !a || a.tapped || a.u > 0.72; }, null, { timeout: 10000, polling: 16 }).catch(() => {});
    stills.push(out.replace(/\.mp4$/, ".pick-2.jpg")); await page.screenshot({ path: stills.at(-1) });
  }
  const t = await tapped;
  if (t) console.log(`tapped at ${(t.u * 100).toFixed(0)}% of the timer (green from ${(t.bandFrom * 100).toFixed(0)}%), gx ${t.gx}`);
  if (process.env.STILLS) { await page.waitForTimeout(60); stills.push(out.replace(/\.mp4$/, ".pick-3.jpg")); await page.screenshot({ path: stills.at(-1) }); }
}

let r = null, ok = false;
if (where === "drill") {
  await page.goto(`${base}/star-training-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForLoadState("networkidle", { timeout: 300000 }).catch(() => {});
  for (let k = 0; k < 20; k++) {
    await page.getByRole("tab", { name: /Aerial/ }).click({ timeout: 120000 });
    await page.waitForTimeout(700);
    if (/header|volley/i.test(await page.locator(".tr-tile").first().innerText())) break;
  }
  await page.locator(".tr-tile").nth(Number(lvlArg) - 1).click();
  await page.waitForTimeout(400);
  r = await startRec(page);
  await armClock();
  await page.getByRole("button", { name: /Let.s go/ }).click();
  await waitHandOver();
  await page.evaluate(() => { window.__ev.cross = window.__ev.aim; });
  await pick();
  ok = true;
} else {
  await page.goto(`${base}/star-highlights-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.evaluate((k) => { localStorage.setItem("star-highlights-kinds-v1", JSON.stringify([k])); }, kind);
  await page.reload({ waitUntil: "networkidle", timeout: 300000 });
  { const w = page.getByRole("button", { name: "Watch these" }); if (await w.count()) await w.click(); }
  await page.waitForSelector(".ih-play", { timeout: 120000 });
  await page.waitForTimeout(800);
  for (let k = 0; k < Number(process.env.TRIES ?? 8) && !ok; k++) {
    if (k > 0) { await page.click(".ih-next"); await page.waitForTimeout(500); }
    r = await startRec(page);
    await armClock();
    if (/play/i.test(await page.locator(".ih-play").innerText())) await page.click(".ih-play");
    await waitHandOver();
    const z = await page.evaluate(() => window.__starMatch.frame().sc.airZ ?? 1.85);
    if (how === "good" && kind === "header" && z > MAX_Z) {
      console.log(`chance ${k + 1}: cross at ${z.toFixed(2)} m, out of reach, next`);
      await r.cdp.send("Page.stopScreencast").catch(() => {});
      r = null;
      continue;
    }
    stills.length = 0;
    await pick();
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

const rel = (t) => (t === null || t === undefined ? null : Math.max(0, t - v0));
const crossT = rel(ev.cross ?? (ev.aim !== null ? ev.aim - 1.2 : null));
// The cross is played about 2 s before the timer opens; a build-up whose last
// pass is not the cross must not drag the start back further than that.
const t0 = Math.max(0, crossT - (where === "drill" ? 0.05 : 0.9), ev.lead ? rel(ev.lead.at) + 0.05 : 0, where === "drill" ? 0 : rel(ev.open) - 2.0);
const endAt = ev.goal !== null ? Math.min(rel(ev.goal), rel(ev.result) ?? Infinity) : (rel(ev.result) ?? rel(ev.flight) + 2.5);
const tEnd = Math.min(endAt + 1.0, rel(ev.flight) + (where === "drill" ? 2.2 : 5));
const ff = (args) => { const s = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]); if (s.status !== 0) throw new Error(s.stderr.toString()); };
for (const crf of [26, 30, 34]) {
  ff(["-ss", t0.toFixed(3), "-to", tEnd.toFixed(3), "-i", raw, "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-movflags", "+faststart", "-an", out]);
  if (fs.statSync(out).size <= 4 * 1024 * 1024) break;
}
fs.rmSync(raw, { force: true });
const at = (t) => (t === null ? "?" : (t - t0).toFixed(1));
// Poster: the timer screen, most of the way through.
const posterT = Math.max(0, (rel(ev.flight) ?? rel(ev.open) + 1) - t0 - 0.35);
ff(["-ss", posterT.toFixed(3), "-i", out, "-frames:v", "1", "-q:v", "3", out.replace(/\.mp4$/, ".jpg")]);
console.log(JSON.stringify({ out, size: fs.statSync(out).size, dur: +(tEnd - t0).toFixed(2), label: ev.label, stills,
  at: { cross: at(crossT), aim: at(rel(ev.aim)), timer: at(rel(ev.open)), struck: at(rel(ev.flight)), goal: at(rel(ev.goal)), result: at(rel(ev.result)) }, errors: errs.length, errs }));
