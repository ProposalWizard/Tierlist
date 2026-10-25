/**
 * FILM A REAL GOAL, FRAME-STEPPED (no repeated or dropped frames; sound in sync).
 *
 *   node scripts/film/scenes/vgoal.mjs <port> <knee-slide|aeroplane|big-moment|plain> <outDir> --seed seed.json [--fps 60] [--out-fps 30]
 *
 * The same play as celebrations.mjs (a real career match on a seed save, the
 * celebration equipped, every chance taken for real: a drag at the far corner and
 * a clean tap; nothing moves the ball), but on the virtual clock of
 * scripts/film/vclock.mjs: from the first chance on, the game only moves when this
 * script steps it, 1/fps s a step, and each step is captured. A chance that does
 * not go in is thrown away; the one that does is kept from the moment it opens
 * to 1.2 s after the celebration.
 * Writes outDir/<clip>.mp4 (H.264 + AAC), outDir/<clip>.jpg (the celebration),
 * outDir/<clip>.json (frames, tries, where things happened).
 * Needs a production build with NEXT_PUBLIC_STAR_OFFLINE_DEV=1 (the seed, big-moment flag).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { installVClock, vStart, vCapture, vDiscard, vStep, vUntil, vStopAudio, vLog, encode } from "../vclock.mjs";

const [PORT, CLIP, OUT] = process.argv.slice(2);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const SEED = arg("--seed", path.join(OUT, "seed.json"));
const FPS = +arg("--fps", "60"), OUT_FPS = +arg("--out-fps", "30");
const CHROME = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
const KEY = "star-career-v2::anon";
const MOVE = { "knee-slide": "knee-slide", aeroplane: "arms-out", "big-moment": "knee-slide", plain: "fist-pump" }[CLIP];
const BIG = CLIP === "big-moment";
const realWait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now();
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(0).padStart(4), ...a);

const ctx = await chromium.launchPersistentContext(path.join(OUT, `prof-v-${CLIP}`), {
  executablePath: CHROME, args: ["--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
});
await installVClock(ctx, { fps: FPS });
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await ctx.addInitScript(([seed, key, move]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem(key));
  const id = "celeb-" + move;
  c.ownedAccessories = [...new Set([...(c.ownedAccessories || []), id])];
  c.equippedAccessories = { ...(c.equippedAccessories || {}), celebration: id };
  // First-hour tours and pop-ups (25 Oct 2026) would sit over the match: a save with no
  // unlock list reads as an old save that has seen them all (lib/star/unlocks.ts hasSeen).
  delete c.unlocks;
  localStorage.setItem(key, JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", "off");
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: [] }));
}, [seed, KEY, MOVE]);
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await realWait(6000);
await vStart(pg);
log("clock is ours");

const phase = () => pg.evaluate(() => window.__starMatch?.phase?.() ?? null);
const celebOn = () => pg.evaluate(() => !!document.querySelector("[data-celebration]"));
const marks = { clip: CLIP, move: MOVE, fps: FPS, outFps: OUT_FPS };
let tries = 0, done = false, dir = null, frame0 = 0, audioMark = 0;
for (let loop = 0; loop < 4000 && !done; loop++) {
  if (BIG) await pg.evaluate(() => { window.__bigMomentNext = true; });
  const ph = await phase();
  if (loop % 25 === 0) {
    const btns = (await pg.locator("button:visible").allInnerTexts().catch(() => [])).slice(0, 8).map((t) => t.replace(/\s+/g, " ").slice(0, 20));
    log("loop", loop, "phase", ph, "frame", await pg.evaluate(() => window.__vclock.frame), JSON.stringify(btns));
    await pg.screenshot({ path: path.join(OUT, `debug-${CLIP}.jpg`), type: "jpeg", quality: 50 }).catch(() => {});
  }
  if (!ph || ph === "feed") {
    let clicked = false;
    for (const re of [/^thanks/i, /full time/i, /get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await b.count()) { await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) await pg.mouse.click(195, ph === "feed" ? 400 : 420);
    await vStep(pg, 40);
    continue;
  }
  // A big moment: film from the moment its banner comes up (during the build-up).
  const bannerUp = BIG && !dir && (await pg.evaluate(() => !!document.querySelector("[data-big-moment]")));
  if (ph !== "aim" && !bannerUp) { await vStep(pg, dir ? 1 : 6); continue; }
  // A chance: film it from here (or carry on filming from the banner).
  if (!dir) {
    tries++;
    dir = path.join(OUT, `frames-${CLIP}-${tries}`);
    fs.rmSync(dir, { recursive: true, force: true });
    // the ball on screen at every captured frame: the ground truth for the smoothness check
    audioMark = await vCapture(pg, dir, { probe: () => { const b = window.__starMatch?.ball?.(); return b ? [Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10] : null; } });
    frame0 = await pg.evaluate(() => window.__vclock.frame);
  }
  if (ph !== "aim") { await vStep(pg, 1); continue; }
  await vStep(pg, 24);
  const aim = await pg.evaluate(() => {
    const fr = window.__starMatch.frame();
    const by = (r) => fr.men.find((m) => m.role === r);
    const pl = by("postL"), pr = by("postR"), b = by("ball"), k = by("keeper");
    if (!pl || !pr || !b) return null;
    const right = k ? k.x < 34 : true;
    const u = right ? 0.86 : 0.14;
    return { tx: pl.cx + (pr.cx - pl.cx) * u, ty: pl.cy + (pr.cy - pl.cy) * u, bx: b.cx, by: b.cy };
  });
  if (!aim) { await vCapture(pg, null); await vDiscard(pg, audioMark); fs.rmSync(dir, { recursive: true, force: true }); dir = null; await vStep(pg, 10); continue; }
  let dx = aim.bx - aim.tx, dy = aim.by - aim.ty; const Ln = Math.hypot(dx, dy) || 1; dx /= Ln; dy /= Ln;
  let pull = 40;
  for (let i = 0; i < 24; i++) { const pw = await pg.evaluate(([x, y]) => window.__starMatch.power(x, y), [dx * pull, dy * pull]); if (pw >= 0.86) break; pull += 6; }
  await pg.mouse.move(aim.bx, aim.by); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { await pg.mouse.move(aim.bx + dx * pull * i / 14, aim.by + dy * pull * i / 14); await vStep(pg, 2); }
  await pg.mouse.up();
  const ballSel = 'div.cursor-pointer[style*="aspect-ratio"]';
  const strikeScreen = await vUntil(pg, (s) => !!document.querySelector(s), 240, ballSel);
  if (strikeScreen) {
    await vStep(pg, 30);
    const bb = await pg.locator(ballSel).first().boundingBox();
    if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2);
  }
  marks.strikeFrame = (await pg.evaluate(() => window.__vclock.frame)) - frame0;
  // the result: a celebration, or the match moves on
  let left = false, goal = false;
  for (let i = 0; i < 900; i++) {
    if (await celebOn()) { goal = true; break; }
    const p = await phase();
    if (p !== "aim") left = true;
    if (left && (p === "aim" || p === "feed" || !p)) break;
    await vStep(pg, 1);
  }
  const why = await pg.evaluate(() => ({ ph: window.__starMatch?.phase?.() ?? null, text: (document.querySelector("[data-contact-grade]")?.textContent ?? "") }));
  log("try", tries, goal ? "GOAL" : "no goal", JSON.stringify({ strikeScreen, pull, ...why }));
  if (!goal) {
    await vCapture(pg, null);
    await vDiscard(pg, audioMark);
    // keep the first two misses to look at (debugging the driver); throw the rest away
    if (tries <= 2) { const keep = path.join(OUT, `miss-${CLIP}-${tries}`); fs.rmSync(keep, { recursive: true, force: true }); fs.renameSync(dir, keep); } else fs.rmSync(dir, { recursive: true, force: true });
    dir = null;
    // A big moment carries on to the next chances without a second banner (CanvasMatch
    // maybeBigMoment), so for that clip a missed take reloads the page: the next chance
    // opens as a big moment of its own, banner and all.
    if (BIG) {
      await pg.reload({ waitUntil: "domcontentloaded" });
      await realWait(6000);
      await vStart(pg);
    }
    continue;
  }
  marks.celebFrame = (await pg.evaluate(() => window.__vclock.frame)) - frame0;
  await vUntil(pg, () => !document.querySelector("[data-celebration]"), 900);
  marks.celebEndFrame = (await pg.evaluate(() => window.__vclock.frame)) - frame0;
  await vStep(pg, Math.round(0.6 * FPS));
  done = true;
}
const ballLog = vLog(pg);
await vCapture(pg, null);
const wav = done ? await vStopAudio(pg, path.join(OUT, `${CLIP}.wav`)).catch((e) => { log("no sound:", e.message); return null; }) : null;
marks.tries = tries; marks.errors = [...new Set(errors)]; marks.done = done; marks.frame0 = frame0; marks.audioMark = audioMark;
await ctx.close();
if (done) {
  const e = encode(dir, wav?.wav ?? null, path.join(OUT, `${CLIP}.mp4`), { fps: FPS, outFps: OUT_FPS, audioAtS: audioMark + 1 / FPS });
  marks.seconds = e.seconds;
  const still = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort()[Math.min(marks.celebFrame + Math.round(0.9 * FPS), marks.celebEndFrame - 1)];
  if (still) fs.copyFileSync(path.join(dir, still), path.join(OUT, `${CLIP}.jpg`));
  marks.framesDir = dir;
  fs.writeFileSync(path.join(OUT, `${CLIP}-ball.json`), JSON.stringify(ballLog));
}
fs.writeFileSync(path.join(OUT, `${CLIP}.json`), JSON.stringify(marks, null, 1));
log(done ? "filmed" : "NOT filmed", JSON.stringify(marks));
