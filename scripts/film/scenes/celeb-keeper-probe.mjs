/**
 * PROBE: does the keeper keep his pitch spot while the celebration camera follows you? (chat 1, 25 Oct 2026)
 * Copy of leo-switch-stills.mjs: after your goal, 5 frames 0.8 s apart (<mode>-celeb-0..4.jpg).
 *
 *   node scripts/film/scenes/leo-switch-stills.mjs <port> <seed.json> <outDir> <off|on>
 *
 * Plays the seed save's match with real shots. Writes:
 *   <mode>-big-chance.jpg    the first chance, asked to be a big moment (dev-only __bigMomentNext,
 *                             the same door as an 85'+ level chance; ON: the banner is up; OFF: none)
 *   <mode>-after-goal.jpg     2 s after your goal (ON: the run to the corner + "Tap to skip"; OFF: neither)
 * and <mode>.json with what the page showed at those moments.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [PORT, SEED, OUT, MODE] = process.argv.slice(2);
const ON = MODE === "on";
fs.mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now(), at = () => ((Date.now() - T0) / 1000).toFixed(1), log = (...a) => console.log(at(), ...a);
const prof = path.join(OUT, `prof-${MODE}`);
fs.rmSync(prof, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(prof, {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--disable-dev-shm-usage"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
});
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
// MOVE=<shop item id> picks the equipped celebration (default the knee slide)
const ITEM = process.env.MOVE || "celeb-knee-slide";
await pg.addInitScript(([seed, on, item]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem("star-career-v2::anon"));
  c.ownedAccessories = [...new Set([...(c.ownedAccessories || []), item])];
  c.equippedAccessories = { ...(c.equippedAccessories || {}), celebration: item };
  localStorage.setItem("star-career-v2::anon", JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", "off");
  // Leo's 24 Oct update (lib/star/leoUpdate.ts): the whole update on or off on this device
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on, off: [] }));
}, [seed, ON, ITEM]);
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(6000);
const out = { mode: MODE };
const shot = (name) => pg.screenshot({ path: path.join(OUT, `${MODE}-${name}.jpg`), type: "jpeg", quality: 70 }).catch(() => {});
// The score bar's words (the two numbers change when anyone scores).
const bar = () => pg.evaluate(() => document.body.innerText.slice(0, 200).replace(/\s+/g, " "));
let goalShot = false, lateShot = false, fails = 0, tries = 0;
while (Date.now() - T0 < 20 * 60000 && !(goalShot && lateShot)) {
  // dev only (compiled out of the live site): mark the next chance as a big moment.
  // With the switch OFF the match ignores it (leoUpdateOn("bigMoments") is checked first).
  const st = await pg.evaluate(() => { window.__bigMomentNext = true; return { ph: window.__starMatch?.phase?.() ?? null, big: !!document.querySelector("[data-big-moment]") }; }).catch(() => ({}));
  if (!st.ph || st.ph === "feed") {
    let clicked = false;
    for (const re of [/get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await b.count().catch(() => 0)) { await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked) await pg.mouse.click(195, 420).catch(() => {});
    await wait(1200); continue;
  }
  if (st.ph !== "aim") { await wait(250); continue; }
  if (!lateShot) {
    // the chance has just opened: ON shows the banner for 1.9 s, OFF shows nothing
    await wait(500); lateShot = true;
    out.chance = { banner: await pg.evaluate(() => !!document.querySelector("[data-big-moment]")), bar: await bar() };
    await shot("big-chance"); log("chance", JSON.stringify(out.chance));
    await wait(1500);
  }
  const aim = await pg.evaluate(() => {
    const fr = window.__starMatch.frame(); const by = (r) => fr.men.find((x) => x.role === r);
    const pl = by("postL"), pr = by("postR"), k = by("keeper"), b = by("ball");
    if (!pl || !pr || !b) return null;
    const u = (k ? k.x < 34 : Math.random() < 0.5) ? 0.82 + Math.random() * 0.1 : 0.18 - Math.random() * 0.1;
    return { tx: pl.cx + (pr.cx - pl.cx) * u, ty: pl.cy + (pr.cy - pl.cy) * u, bx: b.cx, by: b.cy };
  }).catch(() => null);
  if (!aim) { await wait(300); continue; }
  // REAL SHOTS ONLY: nothing here moves the ball; the match decides.
  let dx = aim.bx - aim.tx, dy = aim.by - aim.ty; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  let pull = 40; const want = 0.8 + Math.random() * 0.15;
  for (let i = 0; i < 24; i++) { const pw = await pg.evaluate(([x, y]) => window.__starMatch.power(x, y), [dx * pull, dy * pull]); if (pw >= want) break; pull += 6; }
  const goalWords = () => pg.evaluate(() => (document.body.innerText.match(/GOAL/g) || []).length).catch(() => 0);
  const before = await goalWords(); const off = fails * 4;
  await pg.mouse.move(aim.bx + dx * off, aim.by + dy * off); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { await pg.mouse.move(aim.bx + dx * (off + pull * i / 14), aim.by + dy * (off + pull * i / 14)); await wait(30); }
  await pg.mouse.up(); await wait(600);
  const ballBtn = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  for (let i = 0; i < 8; i++) { if (await ballBtn.count()) break; await wait(250); }
  if (await ballBtn.count()) { const bb = await ballBtn.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2); }
  const strike = Date.now(); tries++;
  let left = false, scored = false;
  for (let i = 0; i < 160; i++) {
    // the match's own "GOAL!" word comes up on a goal (the score bar's numbers include the clock, so not those)
    if ((await goalWords()) > before) { scored = true; break; }
    const ph = await pg.evaluate(() => window.__starMatch?.phase?.()).catch(() => null);
    if (ph !== "aim") left = true;
    if (ph === "aim" && (left || Date.now() - strike > 1500)) break;
    await wait(50);
  }
  if (!left && !scored) { tries--; fails++; log("drag did not take"); if (fails >= 5) break; continue; }
  fails = 0;
  if (!scored) { log("try", tries, "no goal"); await wait(4000); continue; }
  // 5 frames across the run and the celebration. Each logs where the match says the keeper
  // stands (his pitch spot, put through the camera) and where the goal posts are on screen.
  goalShot = true; out.frames = [];
  const N = Number(process.env.FRAMES || 5), GAP = Number(process.env.GAP_MS || 800);
  for (let i = 0; i < N; i++) {
    const f = await pg.evaluate(() => {
      const fr = window.__starMatch.frame(); const by = (r) => fr.men.find((x) => x.role === r);
      const k = by("keeper"), pl = by("postL"), pr = by("postR");
      return { keeper: k && { x: k.x, y: k.y, cx: k.cx, cy: k.cy }, postL: pl && { cx: pl.cx, cy: pl.cy }, postR: pr && { cx: pr.cx, cy: pr.cy }, cam: fr.cam, celeb: !!document.querySelector("[data-celebration]"),
        // the drawn spots the 3D view is handed (RealGame3D's dev hook): how near the nearest man is to you
        near: (() => { const ef = window.__engineFrame; const you = ef?.figures?.find((g) => g.sid === "you"); if (!you) return null;
          let best = null; for (const g of ef.figures) { if (g.sid === "you") continue; const d = Math.hypot(g.x - you.x, g.y - you.y); if (!best || d < best.d) best = { d: Math.round(d * 100) / 100, sid: g.sid }; } return best; })() };
    }).catch((e) => ({ err: e.message }));
    f.t = i * GAP / 1000; out.frames.push(f);
    await shot(`celeb-${i}`); log("frame", i, JSON.stringify(f));
    // SKIP=1: a tap 1.5 s in must close the celebration (how long it takes to go)
    if (process.env.SKIP && i === 3) {
      const t0 = Date.now(); await pg.mouse.click(195, 420);
      let gone = null; for (let k = 0; k < 40; k++) { if (!(await pg.evaluate(() => !!document.querySelector("[data-celebration]")))) { gone = (Date.now() - t0) / 1000; break; } await wait(25); }
      out.skip = { goneAfterS: gone }; log("skip", JSON.stringify(out.skip));
    }
    await wait(GAP);
  }
  // the match saves the goal's recording once the celebration is over (for the goal-video check)
  await wait(8000);
  lateShot = true;
}
out.errors = errors;
fs.writeFileSync(path.join(OUT, `${MODE}.json`), JSON.stringify(out, null, 1));
log(JSON.stringify(out));
await ctx.close();
