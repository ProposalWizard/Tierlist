/**
 * FILM: a real career match in the weather (Leo's update, part "weather"; hub job 25 Oct 2026).
 *
 *   node scripts/film/scenes/weather-match.mjs <port> <rain|wind> <outDir> --seed <seed.json>
 *
 * Opens on a seed save at its first match (celebrations.mjs setup makes one), with Leo's
 * update and its "weather" part on. The weather is the match's own: the only thing set is
 * the career's home city, whose length is part of the fixture's weather roll (weather.ts),
 * so the first match is certainly rainy (rain) or windy (wind). REAL PLAY ONLY: every chance
 * is a real drag and a real strike (lofted in the wind clip, by tapping low on the ball);
 * nothing moves the ball. The game's own sound is recorded (audio-tap.mjs / audio-pcm.mjs).
 * Writes outDir/<clip>.webm, <clip>.wav and <clip>.json (marks, seconds into the recording).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { installAudioTap } from "./audio-tap.mjs";
import { startPcm, stopPcm } from "./audio-pcm.mjs";

const [PORT, CLIP, OUT] = process.argv.slice(2);
const arg = (f, d) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : d; };
const SEED = arg("--seed", path.join(OUT, "seed.json"));
const STRIKES = Number(arg("--strikes", "3"));
const CITY = { rain: "Leeds", wind: "Margate" }[CLIP];   // 5 letters: rain; 7: a 12 m/s wind (season 1, week 1, Maidstone seed)
const CHROME = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const KEY = "star-career-v2::anon";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const vidDir = path.join(OUT, `vid-${CLIP}`);
fs.rmSync(vidDir, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(path.join(OUT, `prof-${CLIP}`), {
  executablePath: CHROME, args: ["--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  recordVideo: { dir: vidDir, size: { width: 390, height: 844 } },
});
const T0 = Date.now();
const at = () => (Date.now() - T0) / 1000;
const log = (...a) => console.log(at().toFixed(1), ...a);
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push("PAGE: " + e.message));
await ctx.addInitScript(() => { window.addEventListener("play", (e) => { if (e.target instanceof HTMLMediaElement) e.stopPropagation(); }, true); });
await installAudioTap(ctx);
const seed = JSON.parse(fs.readFileSync(SEED, "utf8"));
await pg.addInitScript(([seed, key, city]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.clear();
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
  const c = JSON.parse(localStorage.getItem(key));
  c.homeCity = city;
  localStorage.setItem(key, JSON.stringify(c));
  localStorage.setItem("star-career-saved-at-v1::anon", String(Date.now() + 1e6));
  localStorage.setItem("star-look-match-3d", "off");
  // Leo's update on with its weather part; celebrations and big moments off so the clip stays on the weather.
  localStorage.setItem("kib-update-leo-2026-10-24", JSON.stringify({ on: true, off: ["celebrations", "bigMoments"] }));
}, [seed, KEY, CITY]);
await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(1500);
const pcm = await startPcm(pg, at).catch((e) => { log("no audio tap:", e.message); return null; });
const marks = { clip: CLIP, city: CITY, strikes: [] };
let strikes = 0;
while (strikes < STRIKES && at() < 420) {
  if (!marks.lineup && (await pg.locator("[data-lineup-intro]").count())) {
    marks.lineup = at(); marks.lineupText = (await pg.locator("[data-lineup-intro]").innerText()).split("\n").filter((l) => / · /.test(l)).slice(0, 2);
    log("line-up", JSON.stringify(marks.lineupText)); await wait(3500);
  }
  const ph = await pg.evaluate(() => window.__starMatch?.phase?.());
  if (!marks.layer && (await pg.locator("[data-weather-layer]").count())) { marks.layer = at(); log("weather drawn"); }
  // A first-time pointer tour (PointerTour.tsx): its box is the thing to tap.
  const tour = pg.locator("span:visible").filter({ hasText: /^(Next ▸|Got it)$/ }).first();
  if (await tour.count()) { await tour.click({ timeout: 2000 }).catch(() => {}); await wait(500); continue; }
  if (!ph || ph === "feed") {
    let clicked = false;
    for (const re of [/^thanks/i, /get out there/i, /play match|kick off/i, /team sheets/i, /second half|^next|play on|resume/i, /^▶ *play|^play$/i, /continue|tap to hear|^ok$|skip|close|done/i]) {
      const b = pg.locator("button:visible").filter({ hasText: re }).first();
      if (await b.count()) { await b.click({ timeout: 2000 }).catch(() => {}); clicked = true; break; }
    }
    if (!clicked && ph === "feed") await pg.mouse.click(195, 400);
    if (!clicked && !ph && !marks.lineup) await pg.mouse.click(195, 420);
    await wait(900);
    continue;
  }
  if (ph !== "aim") { await wait(200); continue; }
  await wait(900);   // let the chance be seen before the strike
  const aim = await pg.evaluate(() => {
    const fr = window.__starMatch.frame();
    const by = (r) => fr.men.find((m) => m.role === r);
    const pl = by("postL"), pr = by("postR"), b = by("ball"), k = by("keeper");
    if (!pl || !pr || !b) return null;
    const u = (k ? k.x < 34 : true) ? 0.8 : 0.2;
    return { tx: pl.cx + (pr.cx - pl.cx) * u, ty: pl.cy + (pr.cy - pl.cy) * u, bx: b.cx, by: b.cy, kind: fr.kind };
  });
  if (!aim) { await wait(300); continue; }
  let dx = aim.bx - aim.tx, dy = aim.by - aim.ty; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  let pull = 40;
  for (let i = 0; i < 24; i++) { const pw = await pg.evaluate(([x, y]) => window.__starMatch.power(x, y), [dx * pull, dy * pull]); if (pw >= 0.85) break; pull += 6; }
  await pg.mouse.move(aim.bx, aim.by); await pg.mouse.down();
  for (let i = 1; i <= 14; i++) { await pg.mouse.move(aim.bx + dx * pull * i / 14, aim.by + dy * pull * i / 14); await wait(30); }
  await pg.mouse.up(); await wait(600);
  const ballBtn = pg.locator('div.cursor-pointer[style*="aspect-ratio"]').first();
  for (let i = 0; i < 8; i++) { if (await ballBtn.count()) break; await wait(250); }
  // Wind: strike it low on the ball so it rises (the wind works on a ball in the air). Rain: a clean, driven strike.
  if (await ballBtn.count()) { const bb = await ballBtn.boundingBox(); if (bb) await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.width * (CLIP === "wind" ? 0.8 : 0.5)); }
  const s = { t: at(), kind: aim.kind };
  log("strike", strikes + 1, aim.kind);
  let left = false;
  for (let i = 0; i < 200; i++) {
    const p = await pg.evaluate(() => window.__starMatch?.phase?.());
    if (p !== "aim") left = true;
    if (left && (p === "result" || p === "feed" || p === "aim")) { s.result = at(); break; }
    if (!left && at() - s.t > 2) break;
    await wait(50);
  }
  if (!left) { log("the drag did not take"); continue; }
  await wait(2500); s.end = at();
  marks.strikes.push(s); strikes++;
}
marks.errors = [...new Set(errors)];
try { if (pcm) marks.audioAt = await stopPcm(pg, path.join(OUT, `${CLIP}.wav`), pcm); } catch (e) { log("audio not saved:", e.message); }
fs.writeFileSync(path.join(OUT, `${CLIP}.json`), JSON.stringify(marks, null, 1));
await ctx.close();
const vids = fs.existsSync(vidDir) ? fs.readdirSync(vidDir).map((f) => path.join(vidDir, f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size) : [];
if (vids[0]) fs.renameSync(vids[0], path.join(OUT, `${CLIP}.webm`));
log("done", JSON.stringify(marks));
