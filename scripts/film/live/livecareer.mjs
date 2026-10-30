/**
 * LIVE CHANCES IN A CAREER MATCH: plays a real career match (/star-dev) with
 * Settings → Updates → Live chances on, swinging at a mix of moments, and
 * reports each chance: did it go live, the swing read, the result.
 *   node scripts/film/live/livecareer.mjs <port> <outDir> --seed seed.json [--secs 300] [--view3d] [--shots]
 * Needs an offline-dev build (window.__live and window.__starMatch probes).
 * Real play only: drags and releases, nothing moves the ball.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { installVClock, vStart, vStep } from "../vclock.mjs";

const [PORT, OUT] = process.argv.slice(2);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const SEED = arg("--seed", path.join(OUT, "seed.json"));
const SECS = +arg("--secs", "300");
const V3D = process.argv.includes("--view3d");
const SHOTS = process.argv.includes("--shots");
const KEY = "star-career-v2::anon";
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4), ...a);
fs.mkdirSync(OUT, { recursive: true });
const prof = path.join(OUT, `prof-live-${process.pid}`);
const ctx = await chromium.launchPersistentContext(prof, {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1, hasTouch: true, isMobile: true,
});
await installVClock(ctx, { fps: 60, audioMaxS: 1 });
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await ctx.addInitScript(([seed, key, v3d]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem(key)); delete c.unlocks; localStorage.setItem(key, JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", v3d ? "on" : "off");
  localStorage.setItem("kib-live-chances", JSON.stringify({ on: true }));
  window.__ev3dDiag = {};
}, [seed, KEY, V3D]);
// Every swing the match reads (CanvasMatch dispatches kib-live-swing).
await ctx.addInitScript(() => { window.__liveSwings = []; window.addEventListener("kib-live-swing", (e) => window.__liveSwings.push(e.detail)); });
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await new Promise((r) => setTimeout(r, 5000));
await vStart(pg);
const phase = () => pg.evaluate(() => window.__starMatch?.phase?.() ?? null);
const live = () => pg.evaluate(() => (window.__live ? JSON.parse(JSON.stringify(window.__live)) : null));
const TARGETS = [0, 0, -0.6, 0.6, "none", 0.15, -1.6];
let n = 0, liveN = 0, staticN = 0, nullRun = 0;
// In 3D the spot is pressed where the 3D camera draws it (engineView's dev projector).
const glass = async (L) => {
  if (!L) return L;
  const g = await pg.evaluate((sp) => {
    const pj = window.__ev3dProject; if (!pj) return null;
    // the 3D view's own box (its touch layer), which is what it projects into
    const box = [...document.querySelectorAll("div")].find((d) => d.style.pointerEvents === "auto" && d.style.inset === "0px" && d.querySelector("canvas"));
    const r = box?.getBoundingClientRect(); if (!r) return null;
    const q = pj(sp.x, sp.y, 0); return { x: r.left + q.X, y: r.top + q.Y };
  }, L.plan.spot);
  return g ? { ...L, spotPx: g } : L;
};
const rows = [];
while ((Date.now() - T0) / 1000 < SECS) {
  const ph = await phase();
  nullRun = ph ? 0 : nullRun + 1;
  if (nullRun > 160 && n > 0) { log("match over"); break; }
  if (!ph || ph === "feed") {
    const tip = pg.getByText(/^\s*(Next ▸|Got it)\s*$/).first();
    if (await tip.isVisible().catch(() => false)) { await tip.click({ timeout: 2000 }).catch(() => {}); await vStep(pg, 20); continue; }
    let clicked = false;
    for (const re of [/^\s*no thanks\s*$/i, /^\s*thanks!?\s*$|^\s*got it\s*$|^\s*skip tour\s*$/i, /full time/i, /get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await b.count()) { if (process.env.LIVE_DBG) log("click", (await b.innerText().catch(() => "?")).slice(0, 30)); await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) await pg.mouse.click(195, ph === "feed" ? 400 : 420);
    if (process.env.LIVE_DBG) await pg.screenshot({ path: path.join(OUT, "nav.jpg"), type: "jpeg" });
    await vStep(pg, 40);
    continue;
  }
  if (ph !== "aim") { await vStep(pg, 4); continue; }
  // A new chance: wait out the build-up (up to 14 s), then see whether it is live.
  await pg.evaluate(() => { window.__live = undefined; });
  let L = null, kind = "";
  for (let i = 0; i < 840; i++) {
    await vStep(pg, 1);
    L = await live();
    if (L) break;
    const st = await pg.evaluate(() => ({ p: window.__starMatch?.phase?.(), lead: !!window.__starMatch?.leadIn?.() }));
    if (st.p !== "aim") break;
    if (i > 60 && !st.lead) break; // no build-up running and nothing live: a static chance
  }
  n++;
  kind = await pg.evaluate(() => window.__starMatch?.kind?.() ?? "");
  if (!L) {
    staticN++;
    log("chance", n, kind || "?", "STATIC");
    // Play it the old way: a drag from the ball, then the strike screen's centre.
    const b = await pg.evaluate(() => window.__starMatch?.frame?.()?.men?.find((m) => m.role === "ball") ?? null);
    // A header or volley opens its own ball screen: tap its middle when it shows.
    if (["header", "volley"].includes(kind)) {
      for (let i = 0; i < 400; i++) {
        await vStep(pg, 1);
        const bb = await pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first().boundingBox().catch(() => null);
        if (bb) { await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2); break; }
        const p = await phase(); if (p !== "aim" && p !== "contact") break;
      }
    } else if (b && (await phase()) === "aim") {
      await pg.mouse.move(b.cx, b.cy); await pg.mouse.down();
      for (let i = 1; i <= 10; i++) { await pg.mouse.move(b.cx, b.cy + 9 * i); await vStep(pg, 2); }
      await pg.mouse.up();
      for (let i = 0; i < 240; i++) {
        await vStep(pg, 1);
        const s = 'div.cursor-pointer[style*="aspect-ratio"]';
        const bb = await pg.locator(s).first().boundingBox().catch(() => null);
        if (bb) { await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2); break; }
        if ((await phase()) !== "contact" && (await phase()) !== "aim") break;
      }
    }
    for (let i = 0; i < 400; i++) { await vStep(pg, 1); const p = await phase(); if (p !== "flight" && p !== "aim" && p !== "contact") break; }
    for (let i = 0; i < 400; i++) { await vStep(pg, 2); const p = await phase(); if (p !== "result") break; }
    continue;
  }
  liveN++;
  const target = TARGETS[liveN % TARGETS.length];
  if (SHOTS) await pg.screenshot({ path: path.join(OUT, `l${liveN}-a.jpg`), type: "jpeg", quality: 80 });
  let held = false, swung = false, shotB = false, locked = false, bb = null;
  for (let i = 0; i < 900; i++) {
    L = await glass(await live());
    if (!L || !["aim", "contact"].includes(await phase())) break;
    if (SHOTS && !shotB && L.along > -2.5) { shotB = true; await pg.screenshot({ path: path.join(OUT, `l${liveN}-b.jpg`), type: "jpeg", quality: 80 }); }
    if (target !== "none" && !held) {
      await pg.mouse.move(L.spotPx.x, L.spotPx.y);
      if (process.env.LIVE_DBG) log("before", JSON.stringify(await pg.evaluate(([x, y]) => ({ inp: window.__cam3dInput?.() ?? null, el: document.elementFromPoint(x, y)?.getAttribute("style")?.slice(0, 60) ?? null }), [L.spotPx.x, L.spotPx.y])));
      await pg.mouse.down();
      if (process.env.LIVE_DBG) log("down", JSON.stringify(await pg.evaluate(() => window.__cam3dInput?.() ?? null)));
      for (let k = 1; k <= 6; k++) { await pg.mouse.move(L.spotPx.x + 2 * k, L.spotPx.y + 14 * k); await vStep(pg, 1); }
      held = true;
      if (process.env.LIVE_DBG) log("press", JSON.stringify(L.spotPx), JSON.stringify(await pg.evaluate(() => ({ proj: !!window.__ev3dProject, inp: window.__cam3dInput?.() ?? null }))));
    }
    // The strike screen (on by default): let go at once to lock the aim, then tap the small ball at the moment.
    if (held && !locked) { await pg.mouse.up(); locked = true; await vStep(pg, 2); bb = await pg.locator("[data-contact-compact] div.cursor-pointer").first().boundingBox().catch(() => null); }
    if (held && !swung && L.along >= target) {
      if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
      swung = true;
      await vStep(pg, 6);
      if (SHOTS) await pg.screenshot({ path: path.join(OUT, `l${liveN}-c.jpg`), type: "jpeg", quality: 80 });
      break;
    }
    await vStep(pg, 1);
  }
  if (held && !swung && !locked) await pg.mouse.up();
  let res = "";
  for (let i = 0; i < 700; i++) {
    await vStep(pg, 1);
    const p = await phase();
    if (p === "result" && !res) { res = "result"; if (SHOTS) { await vStep(pg, 50); await pg.screenshot({ path: path.join(OUT, `l${liveN}-d.jpg`), type: "jpeg", quality: 80 }); } }
    if (p !== "flight" && p !== "result" && p !== "aim" && p !== "contact") break;
    if (p === "aim" && i > 60) break;
  }
  const last = await pg.evaluate(() => (window.__liveSwings ?? []).at(-1) ?? null);
  await pg.evaluate(() => { window.__liveSwings = []; });
  const line = await pg.evaluate(() => (window.__starMatch?.lines?.() ?? []).slice(-3).join(" / ")).catch(() => "");
  const row = { n, kind, made: L?.made, target, read: last ? (last.hit ? `${last.timing} ${last.along.toFixed(2)} p${Math.round(last.power * 100)}` : `miss-${last.why}`) : (target === "none" ? "let go" : "none"), line };
  rows.push(row);
  log("chance", n, kind, "LIVE", JSON.stringify(row));
}
fs.writeFileSync(path.join(OUT, `livecareer${V3D ? "-3d" : ""}.json`), JSON.stringify({ n, liveN, staticN, rows, errors: [...new Set(errors)] }, null, 1));
log("done", JSON.stringify({ n, liveN, staticN, errors: [...new Set(errors)] }));
await ctx.close();
fs.rmSync(prof, { recursive: true, force: true });
