/**
 * FILM A REAL KEEPER SAVE, FRAME-STEPPED. Adapted from scripts/film/scenes/vgoal.mjs.
 *   node vsave.mjs <port> <catch|dive> <outDir> --seed seed.json [--view3d]
 * Real shots only (a drag + clean tap, nothing moves the ball). A take is kept when the
 * keeper saves it: catch = save result "catch"; dive = saveKind low/high/fingertip.
 * Filming starts on the strike screen just before the tap and runs 4 s after contact.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { installVClock, vStart, vCapture, vDiscard, vStep, vUntil, vStopAudio, vLog, encode } from "../vclock.mjs";

const [PORT, WANT, OUT] = process.argv.slice(2);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const SEED = arg("--seed", path.join(OUT, "seed.json"));
const V3D = process.argv.includes("--view3d");
const LOOK = arg("--look", "natural");
const TAG = WANT + (process.env.CPOW ? "p" + process.env.CPOW : "") + "-" + LOOK + (V3D ? "-3d" : "") + (process.env.NOLONG ? "-close" : "");
const FPS = 60;
const AFTER_S = +arg("--after", "4");
const CHROME = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
const KEY = "star-career-v2::anon";
const realWait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4), ...a);

const ctx = await chromium.launchPersistentContext(path.join(OUT, `prof-${TAG}`), {
  executablePath: CHROME, args: ["--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
});
await installVClock(ctx, { fps: FPS, audioMaxS: 600 });
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await ctx.addInitScript(([seed, key, v3d, look]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem(key));
  delete c.unlocks;
  localStorage.setItem(key, JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", v3d ? "on" : "off");
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
  localStorage.setItem("kib-keeper-look", look);
  if (v3d) window.__ev3dDiag = {};
}, [seed, KEY, V3D, LOOK]);
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await realWait(6000);
await vStart(pg);
log("clock is ours");

const phase = () => pg.evaluate(() => window.__starMatch?.phase?.() ?? null);
const probe = () => {
  const sm = window.__starMatch; if (!sm) return null;
  const b = sm.ball?.(); const bs = sm.ballState?.();
  let k = null, kk = null;
  try { const f = sm.frame(); k = f.men.find((m) => m.role === "keeper"); kk = f.sc.keeper; } catch { /* */ }
  const sv = (bs?.actionLog ?? []).filter((a) => a.kind === "save").map((a) => a.save);
  return { ph: sm.phase(), b: b ? [Math.round(b.x), Math.round(b.y)] : null, z: bs ? +(bs.z ?? 0).toFixed(2) : null,
    bp: bs ? [+bs.pos.x.toFixed(2), +bs.pos.y.toFixed(2)] : null,
    k: k ? [Math.round(k.cx), Math.round(k.cy), +k.x.toFixed(2), +k.y.toFixed(2)] : null,
    dive: kk ? +(kk.dive ?? 0).toFixed(2) : null, kind: kk?.saveKind ?? null, done: kk?.done ?? null, sv };
};
const marks = { want: TAG, fps: FPS };
let tries = 0, done = false, dir = null, audioMark = 0, frameAtTap = 0;
let nullRun = 0;
for (let loop = 0; loop < 6000 && !done; loop++) {
  const ph = await phase();
  nullRun = ph ? 0 : nullRun + 1;
  if (nullRun > 160 && tries > 0) { log("match over, stopping"); break; }
  if (loop % 40 === 0) {
    const btns = (await pg.locator("button:visible").allInnerTexts().catch(() => [])).slice(0, 8).map((t) => t.replace(/\s+/g, " ").slice(0, 20));
    log("loop", loop, "phase", ph, "tries", tries, JSON.stringify(btns));
    await pg.screenshot({ path: path.join(OUT, `debug-${TAG}.jpg`), type: "jpeg", quality: 50 }).catch(() => {});
  }
  if (!ph || ph === "feed") {
    let clicked = false;
    const tip = pg.getByText(/^\s*(Next ▸|Got it)\s*$/).first();
    if (await tip.isVisible().catch(() => false)) { await tip.click({ timeout: 2000 }).catch(() => {}); await vStep(pg, 20); continue; }
    for (const re of [/^\s*thanks!?\s*$|^\s*got it\s*$|^\s*skip tour\s*$/i, /full time/i, /get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await b.count()) { await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) await pg.mouse.click(195, ph === "feed" ? 400 : 420);
    await vStep(pg, 40);
    continue;
  }
  if (ph !== "aim") { await vStep(pg, 6); continue; }
  await vStep(pg, 24);
  const aim = await pg.evaluate(([want, CSIDE]) => {
    const fr = window.__starMatch.frame();
    const by = (r) => fr.men.find((m) => m.role === r);
    const pl = by("postL"), pr = by("postR"), b = by("ball"), k = by("keeper");
    if (!pl || !pr || !b || !k) return null;
    // where the keeper stands along the goal line (0 = left post, 1 = right post)
    const ku = Math.max(0.1, Math.min(0.9, (k.x - (34 - 3.66)) / 7.32));
    let u;
    if (want === "dcatch") u = ku + (ku < 0.5 ? 1 : -1) * (0.11 + Math.random() * 0.08);
    else if (want === "catch") u = ku + (CSIDE ? (ku < 0.5 ? 1 : -1) * CSIDE : (Math.random() - 0.5) * 0.12);
    else { const side = ku < 0.5 ? 1 : -1; u = ku + side * (0.2 + Math.random() * 0.12); }
    u = Math.max(0.08, Math.min(0.92, u));
    return { tx: pl.cx + (pr.cx - pl.cx) * u, ty: pl.cy + (pr.cy - pl.cy) * u, bx: b.cx, by: b.cy, ku, u, kind: fr.kind };
  }, [WANT, +(process.env.CSIDE || 0)]);
  if (!aim) { await vStep(pg, 10); continue; }
  tries++;
  let dx = aim.bx - aim.tx, dy = aim.by - aim.ty; const Ln = Math.hypot(dx, dy) || 1; dx /= Ln; dy /= Ln;
  const wantPow = WANT === "dcatch" ? 0.35 + Math.random() * 0.2 : WANT === "catch" ? +(process.env.CPOW || 0.6) : 0.72;
  let pull = 30;
  for (let i = 0; i < 30; i++) { const pw = await pg.evaluate(([x, y]) => window.__starMatch.power(x, y), [dx * pull, dy * pull]); if (pw >= wantPow) break; pull += 5; }
  await pg.mouse.move(aim.bx, aim.by); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { await pg.mouse.move(aim.bx + dx * pull * i / 14, aim.by + dy * pull * i / 14); await vStep(pg, 2); }
  await pg.mouse.up();
  const ballSel = 'div.cursor-pointer[style*="aspect-ratio"]';
  const strikeScreen = await vUntil(pg, (s) => !!document.querySelector(s), 240, ballSel);
  dir = path.join(OUT, `frames-${TAG}-${tries}`);
  fs.rmSync(dir, { recursive: true, force: true });
  if (strikeScreen) {
    await vStep(pg, 16);
    audioMark = await vCapture(pg, dir, { probe });
    await vStep(pg, 14);
    frameAtTap = 14;
    const bb = await pg.locator(ballSel).first().boundingBox();
    if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2);
  } else {
    // no strike screen: a pass or a chance with no shot; not filmed, play it out fast
    log("try", tries, "no strike screen", aim.kind);
    for (let i = 0; i < 60; i++) { const p = await phase(); if (p === "aim" && i > 2) break; if (p === "feed" || !p) break; await vStep(pg, 10); }
    continue;
  }
  // until the keeper touches it, or the chance is over
  let contact = -1, left = false, n = frameAtTap;
  for (let i = 0; i < 400; i++) {
    const p = await pg.evaluate(() => { const sm = window.__starMatch; const bs = sm?.ballState?.(); const kk = (() => { try { return sm.frame().sc.keeper; } catch { return null; } })(); return { ph: sm?.phase?.() ?? null, sv: (bs?.actionLog ?? []).filter((a) => a.kind === "save").map((a) => a.save), kind: kk?.saveKind ?? null }; });
    if (p.sv.some((s) => s !== "beaten") || p.kind) { contact = n; break; }
    if (p.ph !== "aim" && p.ph !== "flight") left = true;
    if (left && (p.ph === "aim" || p.ph === "feed" || !p.ph)) break;
    await vStep(pg, 1); n++;
  }
  let res = null;
  if (contact >= 0) {
    res = await pg.evaluate(() => { const sm = window.__starMatch; const bs = sm.ballState(); const kk = sm.frame().sc.keeper; const c = (bs?.actionLog ?? []).find((a) => a.kind === "save" && a.save === "catch"); return { sv: (bs?.actionLog ?? []).filter((a) => a.kind === "save").map((a) => a.save), kind: kk.saveKind, dx: c?.at ? +Math.abs(c.at.x - kk.x).toFixed(2) : null, z: c?.at ? +c.at.z.toFixed(2) : null }; });
  }
  const ok = res && !(process.env.NOLONG && aim.kind === "long_range") && (WANT === "dcatch" ? res.sv.includes("catch") && (res.dx ?? 0) >= 0.7 : WANT === "any" ? !res.sv.includes("beaten") : WANT === "catch" ? res.sv.includes("catch") : ["low", "high", "fingertip"].includes(res.kind) && !res.sv.includes("beaten"));
  log("try", tries, JSON.stringify({ aimU: +aim.u.toFixed(2), ku: +aim.ku.toFixed(2), kind: aim.kind, strikeScreen, contact, res, ok }));
  if (!ok) {
    await vCapture(pg, null);
    await vDiscard(pg, audioMark);
    fs.rmSync(dir, { recursive: true, force: true });
    dir = null;
    continue;
  }
  marks.tapFrame = frameAtTap; marks.contactFrame = contact; marks.res = res; marks.aim = aim;
  await vStep(pg, Math.round(AFTER_S * FPS));
  done = true;
}
const probeLog = vLog(pg);
await vCapture(pg, null);
const wav = done ? await vStopAudio(pg, path.join(OUT, `${TAG}.wav`)).catch((e) => { log("no sound:", e.message); return null; }) : null;
marks.tries = tries; marks.errors = [...new Set(errors)]; marks.done = done; marks.audioMark = audioMark; marks.framesDir = dir;
await ctx.close();
if (done) {
  fs.writeFileSync(path.join(OUT, `${TAG}-probe.json`), JSON.stringify(probeLog));
  marks.wav = wav?.wav ?? null;
}
fs.writeFileSync(path.join(OUT, `${TAG}.json`), JSON.stringify(marks, null, 1));
log(done ? "filmed" : "NOT filmed", JSON.stringify(marks));
