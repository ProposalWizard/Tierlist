/**
 * CATCH CHECK: plays real chances in a career match, NOT filmed, and checks every
 * frame after the keeper catches the ball that the ball is drawn in his hands.
 *   node catchcheck.mjs <port> <outDir> --seed seed.json [--look natural] [--secs 360] [--play]
 *   --play: the play area's Infinite Match (chance after chance, far more saves a minute).
 * Needs a build with NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (CanvasMatch's window.__kDbg probe).
 * Real play only: drags and taps, nothing moves the ball. Shots are aimed at the
 * keeper, just beside him and at the corners, so every kind of save turns up.
 * Writes <outDir>/catchcheck-<look>.jsonl: one line per catch, with the frames where
 * the ball was NOT drawn in his hands ("loose") and how far it was from him.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { installVClock, vStart, vStep, vUntil } from "../vclock.mjs";

const [PORT, OUT] = process.argv.slice(2);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const SEED = arg("--seed", path.join(OUT, "seed.json"));
const LOOK = arg("--look", "natural");
const SECS = +arg("--secs", "360");
const SHOTS = process.argv.includes("--shots");
const V3D = process.argv.includes("--view3d");
const CHROME = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
const KEY = "star-career-v2::anon";
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4), ...a);
const prof = path.join(OUT, `prof-cc-${LOOK}-${process.pid}`);
fs.rmSync(prof, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(prof, {
  executablePath: CHROME, args: ["--disable-dev-shm-usage"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 3 : 1, hasTouch: true, isMobile: true,
});
await installVClock(ctx, { fps: 60, audioMaxS: 1 });
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await ctx.addInitScript(([seed, key, look, v3d, deadOff]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem(key)); delete c.unlocks; localStorage.setItem(key, JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", v3d ? "on" : "off");
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
  localStorage.setItem("kib-keeper-look", look);
  if (deadOff) localStorage.setItem("kib-dev-deadball-off", "1");
}, [seed, KEY, LOOK, V3D, process.argv.includes("--fix-off")]);
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
const PLAY = process.argv.includes("--play");
if (PLAY) {
  // The play area's Infinite Match: the same real match, chance after chance, no career screens between.
  await pg.goto(`http://localhost:${PORT}/star-play-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await new Promise((r) => setTimeout(r, 4000));
  await pg.getByText(/infinite match/i).first().click();
  await new Promise((r) => setTimeout(r, 4000));
} else {
  await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await new Promise((r) => setTimeout(r, 5000));
}
await vStart(pg);

const outFile = path.join(OUT, `catchcheck-${LOOK}${V3D ? "-3d" : ""}.jsonl`);
const phase = () => pg.evaluate(() => window.__starMatch?.phase?.() ?? null);
const dbg = () => pg.evaluate(() => { const d = window.__kDbg; return d ? JSON.parse(JSON.stringify(d)) : null; });

// One catch being watched: from the first frame the match says "caught" until the chance is over.
let lastT = -1, cur = null, catches = 0, loose = 0, tries = 0, frame = 0;
// A loose ball left still in the air after a save (not held): counted per chance.
let still = null, frozen = 0, frozenShots = 0;
const watchFrozen = async (d) => {
  // a ball off the grass (above 15 cm), not in the net, not held, on screen
  if (!d || !d.saves || d.caught || !d.free || d.phase !== "result" || d.free.inNet || !(d.free.z > 0.15) || d.free.x < 0 || d.free.y < 0 || d.free.x > 800 || d.free.y > 1700) { still = null; return; }
  if (still && Math.abs(still.x - d.free.x) < 0.6 && Math.abs(still.y - d.free.y) < 0.6) {
    still.n++;
    if (still.n === 24) {
      frozen++;
      log("FROZEN ball after", d.saves, d.kind, JSON.stringify(d.free));
      if (frozenShots++ < 6) await pg.screenshot({ path: path.join(OUT, `frozen-${LOOK}-${process.pid}-${frozen}.jpg`), type: "jpeg", quality: 70 }).catch(() => {});
    }
  } else still = { x: d.free.x, y: d.free.y, n: 0 };
};
const watch = async () => {
  const d = await dbg();
  frame++;
  if (!d) return;
  await watchFrozen(d);
  if (d.caught && !cur) cur = { kind: d.kind, show: d.show, move: d.move, ending: d.ending, frames: 0, looseFrames: 0, netFrames: 0, staleFrames: 0, maxGap: 0, firstLoose: null };
  if (cur && !d.caught) { finish(); return; }
  if (cur && d.t === lastT) { cur.staleFrames++; return; }
  lastT = d.t;
  if (cur && (!d.ball || !d.keeper)) { cur.frames++; cur.looseFrames++; if (!cur.firstLoose) cur.firstLoose = { frame: cur.frames, why: "no ball drawn" }; return; }
  if (!cur || !d.ball || !d.keeper) return;
  cur.frames++;
  // --shots: pictures of every catch at set moments, to check by eye
  if (SHOTS && [1, 2, 3, 4, 6, 9, 14, 20, 30, 45, 60, 80, 100, 120, 150].includes(cur.frames)) {
    // close up round the keeper (2x picture), the frame number on the file
    // canvas drawing units -> page pixels (the match canvas is the biggest one on the page)
    const m = await pg.evaluate(() => {
      const cs = [...document.querySelectorAll("canvas")].map((c) => ({ c, r: c.getBoundingClientRect() })).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height);
      const t = cs[0]; if (!t) return null;
      return { l: t.r.left, t: t.r.top, k: t.r.width / (t.c.width / (window.devicePixelRatio || 1)), dpr: window.devicePixelRatio || 1 };
    });
    const name = `shot-${LOOK}${V3D ? "-3d" : ""}-${process.pid}-${catches}-f${String(cur.frames).padStart(3, "0")}`;
    try {
      await pg.screenshot({ path: path.join(OUT, name + ".jpg"), type: "jpeg", quality: 85 });
      fs.writeFileSync(path.join(OUT, name + ".json"), JSON.stringify({ m, keeper: d.keeper, ball: d.ball }));
    } catch (e) { log("shot failed", e.message.slice(0, 120)); }
  }
  // gap: ball to the middle of his body, in keeper heights
  const gap = Math.hypot(d.ball.x - d.keeper.x, d.ball.y - (d.keeper.y - d.keeper.h * 0.45)) / d.keeper.h;
  cur.maxGap = Math.max(cur.maxGap, +gap.toFixed(2));
  cur.show = cur.show || d.show; cur.move = d.move ?? cur.move; cur.ending = d.ending ?? cur.ending;
  if (d.net) cur.netFrames++;
  if (!d.holds && !d.net) {
    cur.looseFrames++;
    if (!cur.firstLoose) {
      cur.firstLoose = { frame: cur.frames, gap: +gap.toFixed(2), show: d.show, move: d.move, ending: d.ending };
      await pg.screenshot({ path: path.join(OUT, `loose-${LOOK}-${process.pid}-${catches}.jpg`), type: "jpeg", quality: 60 }).catch(() => {});
    }
  }
};
const finish = () => {
  if (!cur) return;
  catches++; if (cur.looseFrames) loose++;
  fs.appendFileSync(outFile, JSON.stringify({ look: LOOK, ...cur }) + "\n");
  log("catch", catches, cur.looseFrames ? `LOOSE ${cur.looseFrames}/${cur.frames}` : `held ${cur.frames} (chest net ${cur.netFrames}, stale ${cur.staleFrames})`, JSON.stringify(cur.firstLoose ?? { move: cur.move, maxGap: cur.maxGap }));
  cur = null;
};

let nullRun = 0;
while ((Date.now() - T0) / 1000 < SECS) {
  const ph = await phase();
  nullRun = ph ? 0 : nullRun + 1;
  if (nullRun > 160 && tries > 0) { log("match over"); break; }
  if (!ph || ph === "feed") {
    finish();
    const tip = pg.getByText(/^\s*(Next ▸|Got it)\s*$/).first();
    if (await tip.isVisible().catch(() => false)) { await tip.click({ timeout: 2000 }).catch(() => {}); await vStep(pg, 20); continue; }
    let clicked = false;
    for (const re of [/^\s*thanks!?\s*$|^\s*got it\s*$|^\s*skip tour\s*$/i, /full time/i, /get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await b.count()) { await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) await pg.mouse.click(195, ph === "feed" ? 400 : 420);
    await vStep(pg, 40);
    continue;
  }
  if (ph !== "aim") { await vStep(pg, 2); await watch(); continue; }
  // --sideshots: one picture of each chance as it starts (to see the keeper on a side-on camera)
  if (process.argv.includes("--sideshots") && tries < 40) await pg.screenshot({ path: path.join(OUT, `aim-${LOOK}-${process.pid}-${tries}.jpg`), type: "jpeg", quality: 60 }).catch(() => {});
  await vStep(pg, 20);
  const r = Math.random();
  const aim = await pg.evaluate((r) => {
    const fr = window.__starMatch.frame();
    const by = (n) => fr.men.find((m) => m.role === n);
    const pl = by("postL"), pr = by("postR"), b = by("ball"), k = by("keeper");
    if (!pl || !pr || !b || !k) return null;
    const ku = Math.max(0.1, Math.min(0.9, (k.x - (34 - 3.66)) / 7.32));
    const side = ku < 0.5 ? 1 : -1;
    // 35% at him, 35% just beside him (diving-catch window), 30% for a corner
    const u = r < 0.35 ? ku + (Math.random() - 0.5) * 0.1 : r < 0.7 ? ku + side * (0.11 + Math.random() * 0.08) : (side > 0 ? 0.88 : 0.12);
    const uu = Math.max(0.06, Math.min(0.94, u));
    return { tx: pl.cx + (pr.cx - pl.cx) * uu, ty: pl.cy + (pr.cy - pl.cy) * uu, bx: b.cx, by: b.cy };
  }, r);
  if (!aim) { await vStep(pg, 10); continue; }
  tries++;
  let dx = aim.bx - aim.tx, dy = aim.by - aim.ty; const Ln = Math.hypot(dx, dy) || 1; dx /= Ln; dy /= Ln;
  const wantPow = r < 0.7 ? 0.32 + Math.random() * 0.3 : 0.7;
  let pull = 30;
  for (let i = 0; i < 30; i++) { const pw = await pg.evaluate(([x, y]) => window.__starMatch.power(x, y), [dx * pull, dy * pull]); if (pw >= wantPow) break; pull += 5; }
  await pg.mouse.move(aim.bx, aim.by); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { await pg.mouse.move(aim.bx + dx * pull * i / 14, aim.by + dy * pull * i / 14); await vStep(pg, 2); }
  await pg.mouse.up();
  const ballSel = 'div.cursor-pointer[style*="aspect-ratio"]';
  if (await vUntil(pg, (s) => !!document.querySelector(s), 240, ballSel)) {
    await vStep(pg, 20);
    const bb = await pg.locator(ballSel).first().boundingBox();
    if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2);
  }
  // follow the chance frame by frame
  let seen = "", kindNow = "";
  for (let i = 0; i < 420; i++) {
    await vStep(pg, 1); await watch();
    if (i % 4 === 0) {
      const o = await pg.evaluate(() => { const bs = window.__starMatch?.ballState?.(); const sv = (bs?.actionLog ?? []).filter((a) => a.kind === "save").map((a) => a.save); return { sv: sv.join(","), sp: bs ? +Math.hypot(bs.vel.x, bs.vel.y).toFixed(1) : 0, k: window.__kDbg?.kind ?? "" }; });
      if (o.sv.length > seen.length) seen = o.sv;
      kindNow = o.k || kindNow;
    }
    const p = await phase(); if (p === "aim" && i > 30) break; if (!p || p === "feed") break;
  }
  log("try", tries, kindNow, "saves:", seen || "-");
  finish();
}
finish();
await ctx.close();
fs.rmSync(prof, { recursive: true, force: true });
log("done", JSON.stringify({ tries, catches, loose, frozen, errors: [...new Set(errors)] }));
