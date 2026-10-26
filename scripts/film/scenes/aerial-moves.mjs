// Scene: ONE aerial move (lib/star/aerialMoves.ts, 25 Oct 2026): the cross,
// your man's take-off and rise, the ball screen opening on the frame his
// head / foot meets it, the tap, the follow-through. (A copy of air-tap.mjs
// with the contact moment caught.)
//
//   node scripts/film/scenes/aerial-moves.mjs <baseUrl> <out.mp4> <hl|drill> <header|volley> <good|late> [drillLevel]
//   QS="airmove=bicycle" picks the move (a dev switch: only the SITUATION, never
//   the outcome — film-pass rule 6). QS="airmoves=old" films the old flow.
//
// Also writes <out>-contact.png: the pitch canvas on the frame the ball screen
// opened (what is under the screen), and prints the probe's numbers
// (window.__starMatch.aerial(): the move, the ball-to-contact gap in px).
//
// hl    = Infinite Highlights (/star-highlights-dev), that kind only, with the build-up.
// drill = the Head & Volley drill (/star-training-dev → Aerial → level), first rep.
// good  = tap the side of the ball that sends it to the far corner from the
//         keeper (a header on top, a volley as it drops through the green).
//         NEED_GOAL=1 keeps trying (TRIES, default 8) until one really goes in.
// late  = never tap: the ring runs out (TOO LATE) and the late touch is struck.
//
// Nothing is faked: the scene only taps, as a finger would (film-pass rule 6).
// Prints the times, and how big the men are drawn through the clip
// (figPx: head to boots, CSS px) and the camera's zoom, so a zoom-in shows.
import { phone, startRec, stopRec } from "../rec.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const [base = "http://localhost:3205", out = "/tmp/airtap.mp4", where = "hl", kind = "header", how = "good", lvlArg = "6"] = process.argv.slice(2);
const { browser, page } = await phone();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

async function armClock() {
  await page.evaluate(() => {
    const ev = (window.__ev = { cross: null, aim: null, open: null, flight: null, result: null, label: null, goal: null, lead: null, fig: [], ball: [] });
    let lastPhase = null;
    const tick = () => {
      const m = window.__starMatch;
      if (m) {
        const now = Date.now() / 1000;
        const L = m.leadIn && m.leadIn();
        if (L) {
          const ps = L.passStart && L.passStart.length ? L.passStart[L.passStart.length - 1] : null;
          if (ps !== null && L.t >= ps) ev.cross = now - (L.t - ps);
          ev.lead = { durS: L.durS, at: now - L.t };
        }
        const ph = m.phase();
        if (ph === "aim" && ev.aim === null && !L) ev.aim = now;
        if (ph !== lastPhase) {
          if (ph === "contact" && ev.open === null) {
            ev.open = now;
            // The pitch under the ball screen, on the frame it opened, and the probe's numbers.
            try { const c = [...document.querySelectorAll("canvas")].sort((a, b) => b.width * b.height - a.width * a.height)[0]; ev.contactPng = c ? c.toDataURL("image/png") : null; } catch { /* */ }
            try { const f = m.frame(); ev.contactFrame = { figPx: f.figPx, zoom: f.zoom, across: f.metres && f.metres.across, canvas: f.canvas }; } catch { /* */ }
            try { ev.probe = m.aerial ? m.aerial() : null; } catch { /* */ }
          }
          if (ph === "flight" && ev.flight === null) ev.flight = now;
          if (ph === "flight" && !ev.launch) { try { const f = m.frame(); ev.launch = { keeperX: f.sc.keeper.x, ballAt: f.sc.ball, posts: f.men.filter((q) => q.role.startsWith("post")).map((q) => q.x) }; } catch { /* */ } }
          if (ev.flight !== null && ph !== "flight" && ev.result === null) ev.result = now;
          lastPhase = ph;
        }
        if (ph === "flight" && ev.launch && !ev.launch.vel) { const b = m.ballState && m.ballState(); if (b && Math.hypot(b.vel.x, b.vel.y) > 1) ev.launch.vel = { x: +b.vel.x.toFixed(2), y: +b.vel.y.toFixed(2), z: +b.vz.toFixed(2), px: +b.pos.x.toFixed(2), py: +b.pos.y.toFixed(2) }; }
        if ((ph === "flight" || ph === "result") && ev.flight !== null && ev.goal === null) { const b = m.ballState && m.ballState(); if (b && b.inNet) ev.goal = now; }
        // How big a man is drawn, and the zoom, every few frames.
        if (ev.fig.length < 4000 && Math.random() < 0.3) { try { const f = m.frame(); ev.fig.push({ t: now, ph, fig: f.figPx, zoom: f.zoom, across: f.metres && f.metres.across }); } catch { /* */ } }
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

/** The ball screen: tap it (in the page, on its own clock), or let the ring run out. */
async function tapBall() {
  await page.waitForFunction(() => window.__starMatch.phase() === "contact", null, { timeout: 15000 });
  if (how === "late") return null;
  const f = await page.evaluate(() => window.__starMatch.frame());
  const keeperX = f.sc.keeper.x, goalX = (f.men.find((m) => m.role === "postL").x + f.men.find((m) => m.role === "postR").x) / 2;
  // Its left side sends it right: the far corner from the keeper.
  const cx = keeperX < goalX ? -0.6 : 0.6, cy = kind === "header" ? -0.35 : -0.1;
  return page.evaluate(({ cx, cy, kind }) => new Promise((done) => {
    const t0 = performance.now();
    let lastB = null;
    const step = () => {
      if (window.__starMatch.phase() !== "contact") return done(null);
      const ball = document.querySelector('div.cursor-pointer[style*="aspect-ratio"]');
      const el = performance.now() - t0;
      let go = false;
      if (kind === "header") go = el > 650;
      else {
        // The volley: as it drops through the green on the height meter.
        const mk = document.querySelector("[data-volley-meter] .bg-white");
        const mm = mk ? /([\d.]+)%/.exec(mk.style.bottom) : null; const b = mm ? parseFloat(mm[1]) : NaN;
        go = el > 300 && Number.isFinite(b) && lastB !== null && b < lastB && b > 35 && b < 75;
        lastB = b;
      }
      if (go && ball) {
        const r = ball.getBoundingClientRect(), rr = r.width / 2;
        const x = r.left + rr + cx * rr, y = r.top + rr + cy * rr;
        const tgt = document.elementFromPoint(x, y) ?? ball;
        // …and lift the finger (rec.mjs hides its touch dot on pointerup).
        setTimeout(() => window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x, clientY: y, pointerType: "touch", isPrimary: true })), 120);
        tgt.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: "touch", isPrimary: true }));
        const dot = document.createElement("div");
        Object.assign(dot.style, { position: "fixed", left: `${x - 14}px`, top: `${y - 14}px`, width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.75)", border: "2px solid rgba(0,0,0,0.5)", zIndex: 99999, pointerEvents: "none" });
        document.body.appendChild(dot); setTimeout(() => dot.remove(), 350);
        return done({ ms: Math.round(el), cx, cy });
      }
      requestAnimationFrame(step);
    };
    step();
  }), { cx, cy, kind });
}

let r = null, ok = false, tap = null;
if (where === "drill") {
  await page.goto(`${base}/star-training-dev${process.env.QS ? "?" + process.env.QS : ""}`, { waitUntil: "domcontentloaded", timeout: 300000 });
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
  tap = await tapBall();
  ok = true;
} else {
  await page.goto(`${base}/star-highlights-dev${process.env.QS ? "?" + process.env.QS : ""}`, { waitUntil: "domcontentloaded", timeout: 300000 });
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
    tap = await tapBall();
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
const t0 = Math.max(0, crossT - (where === "drill" ? 0.05 : 1.0), ev.lead ? rel(ev.lead.at) + 0.05 : 0);
const endAt = ev.goal !== null ? Math.min(rel(ev.goal), rel(ev.result) ?? Infinity) : (rel(ev.result) ?? rel(ev.flight) + 2.5);
const tEnd = Math.min(endAt + 1.0, rel(ev.flight) + (where === "drill" ? 2.2 : 5));
const ff = (args) => { const s = spawnSync("ffmpeg", ["-y", "-loglevel", "error", ...args]); if (s.status !== 0) throw new Error(s.stderr.toString()); };
// Under 0.5 MB: 540 px wide, the crf raised until it fits.
for (const crf of [28, 32, 36, 40]) {
  ff(["-ss", t0.toFixed(3), "-to", tEnd.toFixed(3), "-i", raw, "-vf", "fps=30,scale=540:-2,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-movflags", "+faststart", "-an", out]);
  if (fs.statSync(out).size <= 500 * 1024) break;
}
fs.rmSync(raw, { force: true });
const at = (t) => (t === null ? "?" : (t - t0).toFixed(2));
// Poster: the ball screen, just before the tap.
const posterT = Math.max(0, (rel(ev.flight) ?? rel(ev.open) + 1) - t0 - 0.4);
ff(["-ss", posterT.toFixed(3), "-i", out, "-frames:v", "1", "-q:v", "4", out.replace(/\.mp4$/, ".jpg")]);
// How big the men were drawn, from the hand-over to the result.
const span = ev.fig.filter((s) => s.t >= (ev.aim ?? 0) && (ev.result === null || s.t <= ev.result) && Number.isFinite(s.fig));
const figs = span.map((s) => s.fig), zooms = span.map((s) => s.zoom), across = span.map((s) => s.across).filter(Number.isFinite);
const mm = (a) => (a.length ? `${Math.min(...a).toFixed(2)}..${Math.max(...a).toFixed(2)}` : "?");
if (ev.contactPng) fs.writeFileSync(out.replace(/\.mp4$/, "-contact.png"), Buffer.from(ev.contactPng.slice(ev.contactPng.indexOf(",") + 1), "base64"));
// A 4 fps frame sheet of the whole clip, each frame stamped with its time.
ff(["-i", out, "-vf", "fps=4,scale=270:-2,drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=14:fontcolor=white:box=1:boxcolor=black@0.6,tile=6x4", "-frames:v", "1", "-q:v", "3", out.replace(/\.mp4$/, "-sheet.jpg")]);
console.log(JSON.stringify({ out, size: fs.statSync(out).size, dur: +(tEnd - t0).toFixed(2), label: ev.label, tap,
  at: { cross: at(crossT), handOver: at(rel(ev.aim)), ballScreen: at(rel(ev.open)), struck: at(rel(ev.flight)), goal: at(rel(ev.goal)), result: at(rel(ev.result)) },
  launch: ev.launch, figPx: mm(figs), zoom: mm(zooms), metresAcross: mm(across), atContact: ev.contactFrame, probe: ev.probe, errors: errs.length, errs }));
