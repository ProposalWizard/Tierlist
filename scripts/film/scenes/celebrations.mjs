/**
 * FILM: goal celebrations and big moments (Leo, chat 1 "After you score", 22–23 Oct 2026).
 *
 *   node scripts/film/scenes/celebrations.mjs <port> <clip> <outDir> [--seed seeds/career.json]
 *
 * clip: knee-slide-2d | aeroplane-2d | roar-2d | skip | knee-slide-3d | big-moment | setup
 *   setup       plays a fresh career to its first match and writes the seed save (outDir/seed.json)
 *   the others  open on the seed save, equip the move, and take every chance for real (a full-power
 *               drag at the far corner, a clean strike) until one goes in. Nothing moves the ball:
 *               the goal, the flight and the slow motion are the match's own. big-moment sets
 *               window.__bigMomentNext (dev only), which only marks the NEXT chance served as a big
 *               moment; the shot is still real. Needs NEXT_PUBLIC_STAR_OFFLINE_DEV=1 in the build.
 *
 * Writes outDir/<clip>.webm (the raw recording) and outDir/<clip>.json (when the celebration
 * started and ended, seconds into the recording) for cut.py to trim. Phone size 390×844.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const [PORT, CLIP, OUT] = process.argv.slice(2);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const SEED = arg("--seed", path.join(OUT, "seed.json"));
const CHROME = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASE = `http://localhost:${PORT}`;
const KEY = "star-career-v2::anon";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const MOVE = { "knee-slide-2d": "knee-slide", "aeroplane-2d": "arms-out", "roar-2d": "roar", skip: "fist-pump", "knee-slide-3d": "knee-slide", "big-moment": "knee-slide" }[CLIP];
const VIEW3D = CLIP === "knee-slide-3d";
const BIG = CLIP === "big-moment";

const vidDir = path.join(OUT, `vid-${CLIP}`);
fs.rmSync(vidDir, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(path.join(OUT, `prof-${CLIP}`), {
  executablePath: CHROME, args: ["--disable-dev-shm-usage"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  ...(CLIP === "setup" ? {} : { recordVideo: { dir: vidDir, size: { width: 390, height: 844 } } }),
});
const T0 = Date.now();
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push("PAGE: " + e.message));
const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1), ...a);
const at = () => (Date.now() - T0) / 1000;

if (CLIP === "setup") {
  await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 }); await wait(8000);
  const PRIORITY = [/^SIM WHOLE TRIAL/i, /Play Match|Kick Off|KICK OFF/i, /Team sheets/i, /^▶ *Play|^Play$/i, /TAP TO HEAR|Continue|Next|Accept|Sign|Start Career|Skip|Done|OK|Close|Let's go|Begin/i];
  for (let i = 0; i < 50; i++) {
    if (await pg.evaluate((k) => { const c = JSON.parse(localStorage.getItem(k) || "{}"); return !!window.__starMatch && !c.trial; }, KEY)) break;
    const ins = pg.locator("input:visible");
    if ((await ins.count()) >= 2) { await ins.nth(0).fill("Leo").catch(() => {}); await ins.nth(1).fill("Vance").catch(() => {}); }
    let c = false;
    for (const re of PRIORITY) { const b = pg.locator("button:visible").filter({ hasText: re }).first(); if (await b.count()) { try { await b.click({ timeout: 3000 }); c = true; break; } catch { /* next */ } } }
    if (!c) await pg.mouse.click(195, 420);
    await wait(2500);
  }
  // back out to Home so the seed opens on the career, not mid-match
  const save = await pg.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("star-")).map((k) => [k, localStorage.getItem(k)])));
  fs.writeFileSync(path.join(OUT, "seed.json"), JSON.stringify(save));
  log("seed written", Object.keys(save).length, "keys");
  await ctx.close();
  process.exit(0);
}

// Open on the seed, the move equipped, the view chosen.
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await pg.addInitScript(([seed, key, move, v3d]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem(key));
  const id = "celeb-" + move;
  c.ownedAccessories = [...new Set([...(c.ownedAccessories || []), id])];
  c.equippedAccessories = { ...(c.equippedAccessories || {}), celebration: id };
  localStorage.setItem(key, JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", v3d ? "on" : "off");
}, [seed, KEY, MOVE, VIEW3D]);
await pg.goto(`${BASE}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(6000);

const celebOn = () => pg.evaluate(() => !!document.querySelector("[data-celebration]"));
const marks = { clip: CLIP, move: MOVE };
let tries = 0;
let done = false;
while (!done && at() < (VIEW3D ? 3300 : 1700)) {
  const st = await pg.evaluate(() => ({ ph: window.__starMatch?.phase?.(), k: window.__starMatch?.kind?.() }));
  if (BIG) await pg.evaluate(() => { window.__bigMomentNext = true; });
  if (!st.ph || st.ph === "feed") {
    let clicked = false;
    for (const re of [/full time/i, /get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await b.count()) { await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked && st.ph === "feed") await pg.mouse.click(195, 400);
    if (!clicked && !st.ph) await pg.mouse.click(195, 420);
    await wait(1200);
    continue;
  }
  // The match is over (post-match screens, no match on screen for a long while): give up this run.
  if (!st.ph && marks.lastAim && at() - marks.lastAim > 70) { log("match over without the goal"); break; }
  if (st.ph !== "aim") { await wait(250); continue; }
  marks.lastAim = at();
  const f = await pg.evaluate(() => ({ b: window.__starMatch.ball(), g: window.__starMatch.goal(), big: !!document.querySelector("[data-big-moment]") }));
  if (!f.g || !f.b) { await wait(300); continue; }
  // A big moment: the banner is up as the chance opens. Any other chance is still a real shot.
  if (BIG && f.big) { marks.banner = at(); log("banner"); await wait(1700); if ((await pg.evaluate(() => window.__starMatch?.phase?.())) !== "aim") continue; Object.assign(f, await pg.evaluate(() => ({ b: window.__starMatch.ball(), g: window.__starMatch.goal() }))); }
  // REAL SHOTS ONLY (Leo, 23 Oct 2026: a clip that moved the ball onto the line looked like "the player
  // shoots and the ball immediately goes in"). Nothing here touches the ball, its flight or the result:
  // a full-power drag aimed at the corner away from the keeper, a clean strike, and the match decides.
  // No goal: the next chance is the next try. Never add window.__starMatch.setBall back to a film scene.
  tries++;
  const aim = await pg.evaluate(() => {
    const fr = window.__starMatch.frame();
    const by = (r) => fr.men.find((m) => m.role === r);
    const pl = by("postL"), pr = by("postR"), k = by("keeper"), b = by("ball");
    if (!pl || !pr || !b) return null;
    const right = k ? k.x < 34 : Math.random() < 0.5;            // the far side from the keeper
    const j = Math.random() * 0.1;                                  // a little different every time
    const u = right ? 0.82 + j : 0.18 - j;                          // just inside the post
    return { tx: pl.cx + (pr.cx - pl.cx) * u, ty: pl.cy + (pr.cy - pl.cy) * u, bx: b.cx, by: b.cy };
  });
  if (!aim) { await wait(300); continue; }
  let dx = aim.bx - aim.tx, dy = aim.by - aim.ty; const Ln = Math.hypot(dx, dy) || 1; dx /= Ln; dy /= Ln;
  // the pull that gives about 85% power (the match's own drag rule)
  let pull = 40;
  const want = 0.8 + Math.random() * 0.15;
  for (let i = 0; i < 24; i++) { const pw = await pg.evaluate(([x, y]) => window.__starMatch.power(x, y), [dx * pull, dy * pull]); if (pw >= want) break; pull += 6; }
  marks.aim = at();
  await pg.mouse.move(aim.bx, aim.by); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { await pg.mouse.move(aim.bx + dx * pull * i / 14, aim.by + dy * pull * i / 14); await wait(30); }
  await pg.mouse.up(); await wait(600);
  const ballBtn = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  if (await ballBtn.count()) { const bb = await ballBtn.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width / 2); }
  marks.strike = at();
  const miss = BIG && !f.big;
  log("try", tries, "strike", JSON.stringify({ pull, big: BIG ? !!f.big : undefined }));
  let t0 = null;
  // Wait for the result. A drag that never took (still aiming 1.5 s on) is not a shot: it is not counted.
  let left = false;
  for (let i = 0; i < 160; i++) {
    if (await celebOn()) { t0 = at(); break; }
    const ph = await pg.evaluate(() => window.__starMatch?.phase?.());
    if (ph !== "aim") left = true;
    if (ph === "aim" && (left || at() - marks.strike > 1.5)) break;
    await wait(50);
  }
  if (!left && t0 === null) { tries--; log("the drag did not take; same chance again"); }
  if (t0 === null || miss) { log("no goal; next chance"); marks.banner = undefined; if (t0 !== null) await wait(6000); continue; }
  marks.tries = tries;
  marks.celebStart = t0; log("celebration");
  if (CLIP === "skip") {
    await wait(1500); marks.tap = at(); await pg.mouse.click(195, 420);
    for (let i = 0; i < 60; i++) { if (!(await celebOn())) { marks.gone = at(); break; } await wait(30); }
    await wait(3500); marks.end = at();
  } else {
    for (let i = 0; i < 400; i++) { if (!(await celebOn())) { marks.celebEnd = at(); break; } await wait(50); }
    await wait(1200); marks.end = at();
  }
  done = true;
}
marks.errors = [...new Set(errors)];
fs.writeFileSync(path.join(OUT, `${CLIP}.json`), JSON.stringify(marks, null, 1));
await ctx.close();
const vids = fs.existsSync(vidDir) ? fs.readdirSync(vidDir).map((f) => path.join(vidDir, f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size) : [];
if (vids[0]) fs.renameSync(vids[0], path.join(OUT, `${CLIP}.webm`));
log(done ? "filmed" : "NOT filmed", JSON.stringify(marks));
