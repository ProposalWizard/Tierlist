/**
 * Live chances check (lib/star/liveChance.ts): plays the test page
 * /star-live-chances-dev in a real browser and swings at chosen moments.
 * Needs an offline-dev build (NEXT_PUBLIC_STAR_OFFLINE_DEV=1) on PORT, which
 * exposes window.__live (the live ball, the spot, the last swing).
 *
 *   node scripts/film/live/livecheck.mjs --port 3421 --n 12 --at 0 [--shots dir] [--nobuild] [--off]
 *
 * --at  where to swing, metres along the pass from the spot (-0.6 early,
 *       0 sweet, 0.6 late, "none" never swing).
 * Prints one line per chance: kind, the swing read, the outcome the match gave.
 */
import { chromium } from "playwright";
import fs from "node:fs";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const PORT = arg("port", "3421"), N = Number(arg("n", "8")), AT = arg("at", "0"), SHOTS = arg("shots", "");
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--disable-dev-shm-usage"] }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
if (flag("view3d")) await ctx.addInitScript(() => { localStorage.setItem("star-look-match-3d", "on"); window.__ev3dDiag = {}; });
const pg = await ctx.newPage();
const errors = [];
pg.on("pageerror", (e) => errors.push(String(e)));
pg.on("console", (m) => { if (m.type() === "error" || /3D/.test(m.text())) errors.push(m.text()); });
await pg.goto(`http://localhost:${PORT}/star-live-chances-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await pg.waitForSelector("[data-live-switch]", { timeout: 120000 });
if (flag("nobuild")) await pg.getByText("No build-up (a made-up pass)").click();
if (flag("off")) await pg.getByText("Live: Off (the game as now)").click();
// --nostrike: letting go is the kick. Default: the kick screen (let go at the moment, then tap where on the ball).
const STRIKE = !flag("nostrike");
if (!STRIKE) await pg.getByText("Kick screen: Off (letting go = the kick)").click();
// --tap cx,cy: where on the kick screen's ball to tap (-1..1; cy +1 = the bottom, a chip)
const TAP = (arg("tap", "0,0")).split(",").map(Number);
// --preset "World class (92)" | "A young player (45)" | "Good (70)": the test page's pretend player
if (arg("preset", "")) await pg.getByText(arg("preset", ""), { exact: false }).first().click();
await pg.waitForTimeout(1500);
const sleep = (ms) => pg.waitForTimeout(ms);
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
for (let i = 0; i < N; i++) {
  if (i > 0) { await pg.getByText("Next chance", { exact: true }).click(); await sleep(400); }
  await pg.evaluate(() => { window.__live = undefined; });
  const t0 = Date.now();
  let live = null;
  while (Date.now() - t0 < 25000) {
    live = await pg.evaluate(() => window.__live ?? null);
    if (live) break;
    await sleep(60);
  }
  const kind = await pg.locator("[data-live-kinds]").evaluate(() => document.body.innerText.match(/#\d+ of \d+ · ([a-z ]+)/)?.[1] ?? "?");
  if (!live) { rows.push({ i, kind, live: false }); console.log(i, kind, "NOT LIVE (no __live)"); continue; }
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/c${i}-a-handover.png` });
  let swung = false, shotMid = false;
  const t1 = Date.now();
  while (Date.now() - t1 < 12000) {
    const L = await glass(await pg.evaluate(() => window.__live));
    if (!L) break;
    if (L.last || (L.along > 2.5)) break;
    if (SHOTS && !shotMid && L.along > -3) { shotMid = true; await pg.screenshot({ path: `${SHOTS}/c${i}-b-coming.png` }); }
    if (AT !== "none" && !swung) {
      // Grab on the spot early, pull back toward our own goal (down the screen), let go at the chosen moment.
      if (!pg.__held && flag("probe")) console.log("at spot:", await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); if (!e) return "none"; const ch = []; let q = e; for (let i = 0; i < 5 && q; i++) { ch.push(`${q.tagName}.${String(q.className).slice(0, 40)}[${q.getAttribute("style")?.slice(0, 80) ?? ""}]`); q = q.parentElement; } return ch.join(" < "); }, [L.spotPx.x, L.spotPx.y]), JSON.stringify(L.spotPx));
      if (!pg.__held) { await pg.mouse.move(L.spotPx.x, L.spotPx.y); await pg.mouse.down(); await pg.mouse.move(L.spotPx.x + 6, L.spotPx.y + 40, { steps: 4 }); await pg.mouse.move(L.spotPx.x + 8, L.spotPx.y + 95, { steps: 6 }); pg.__held = true; }
      if (L.along >= Number(AT)) {
        await pg.mouse.up(); pg.__held = false;
        if (STRIKE) {
          // the normal kick screen opens (in reach): tap where on the ball
          const sel = 'div.cursor-pointer[style*="aspect-ratio"]';
          let bb = null;
          for (let k = 0; k < 60 && !bb; k++) { bb = await pg.locator(sel).first().boundingBox().catch(() => null); if (!bb) await sleep(30); }
          if (SHOTS) await pg.screenshot({ path: `${SHOTS}/c${i}-b2-kickscreen.png` });
          if (bb) await pg.mouse.click(bb.x + bb.width / 2 * (1 + TAP[0] * 0.8), bb.y + bb.height / 2 * (1 + TAP[1] * 0.8));
          else console.log("no kick screen (out of reach?)");
        }
        swung = true; await sleep(80); if (SHOTS) await pg.screenshot({ path: `${SHOTS}/c${i}-c-strike.png` });
      }
    }
    await sleep(16);
  }
  if (pg.__held) { await pg.mouse.up(); pg.__held = false; }
  await sleep(2600);
  if (SHOTS) await pg.screenshot({ path: `${SHOTS}/c${i}-d-after.png` });
  const verdict = await pg.locator("[data-live-verdict]").innerText();
  const last = await pg.evaluate(() => window.__live?.last ?? null);
  const log = await pg.evaluate(() => { const t = document.body.innerText; const i = t.toUpperCase().indexOf("YOUR LAST CHANCES"); return i < 0 ? "" : t.slice(i + 18, i + 140).split("\n").filter(Boolean)[0] ?? ""; });
  const feed = await pg.evaluate(() => (window.__liveOutcomes ?? []).slice(-2).map((o) => `${o.kind}:${o.outcome}${o.youShot ? "(shot)" : ""}`));
  rows.push({ i, kind, live: true, made: live.made, slow: live.plan.slow, v1: live.plan.v1, verdict, last, log });
  console.log(i, kind, live.made ? "(made-up)" : "", `slow ${live.plan.slow.toFixed(2)} v1 ${live.plan.v1.toFixed(1)}`, "|", verdict, "|", log, feed ? JSON.stringify(feed).slice(0, 300) : "");
}
console.log("errors:", errors.length, errors.filter((e) => !/Failed to load resource/.test(e)).slice(0, 3).map((e) => e.slice(0, 600)).join(" || "));
if (SHOTS) fs.writeFileSync(`${SHOTS}/rows.json`, JSON.stringify(rows, null, 1));
await browser.close();
