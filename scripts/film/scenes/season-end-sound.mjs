/**
 * FILM: the WHOLE end of season, WITH THE GAME'S SOUND (Leo, chat 6, 25 Oct 2026).
 *
 *   node scripts/film/scenes/season-end-sound.mjs <port> <profileDir> <outDir>
 *
 * <profileDir> is a browser profile sitting on the Home screen with "End of Season" waiting
 * (its goal recordings, from real matches played in it, are in its IndexedDB). Real taps only,
 * never a moved ball. Films: End of Season → the "Your season" video (left to play to its end)
 * → the Ballon d'Or night → its result → Continue → the transfer window (Stay) → the 3D awards
 * night (left to play) → the awards page → Continue → Season Review → Continue → next season.
 *
 * Picture: Playwright's screen recording (390×844). Sound: audio-tap.mjs + audio-pcm.mjs (every
 * Web Audio node and <video>, recorded sample by sample on the audio clock).
 * Writes <outDir>/season-end.webm, season-end.wav, season-end.json (each screen's start, seconds
 * into the recording, and audioAt for cut.py --audio-at).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { installAudioTap } from "./audio-tap.mjs";
import { startPcm, stopPcm } from "./audio-pcm.mjs";
import { showTouches } from "../rec.mjs";

const [PORT, PROF, OUT] = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
const vidDir = path.join(OUT, "vid-season-end");
fs.rmSync(vidDir, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(PROF, {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  recordVideo: { dir: vidDir, size: { width: 390, height: 844 } },
});
const T0 = Date.now();
const at = () => (Date.now() - T0) / 1000;
await installAudioTap(ctx);
await showTouches(ctx);
const pg = ctx.pages()[0] || (await ctx.newPage());
const marks = { screens: [], errors: [] };
const mark = (name, extra = {}) => { const m = { name, t: +at().toFixed(2), ...extra }; marks.screens.push(m); console.log(JSON.stringify(m)); };
pg.on("pageerror", (e) => marks.errors.push(e.message.slice(0, 200)));
let closing = false;
const finish = async () => {
  if (closing) return; closing = true;
  try { if (pcm) marks.audioAt = await stopPcm(pg, path.join(OUT, "season-end.wav"), pcm); } catch (e) { marks.audioErr = e.message; }
  marks.end = at();
  fs.writeFileSync(path.join(OUT, "season-end.json"), JSON.stringify(marks, null, 1));
  await ctx.close();
  const vids = fs.readdirSync(vidDir).map((f) => path.join(vidDir, f)).sort((a, z) => fs.statSync(z).size - fs.statSync(a).size);
  fs.renameSync(vids[0], path.join(OUT, "season-end.webm"));
};
setTimeout(async () => { console.log("TIME CAP"); await finish(); process.exit(3); }, 20 * 60 * 1000);

const visibleButtons = () => pg.evaluate(() => [...document.querySelectorAll("button,[role=button]")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }).map((b) => b.innerText.replace(/\s+/g, " ").trim()).filter(Boolean)).catch(() => []);
const text = () => pg.evaluate(() => document.body.innerText.split("KNOWITBALL GAMES")[0].replace(/\s+/g, " ")).catch(() => "");
/** A real tap (mouse at the button's centre: the touch dot shows it). */
async function tap(re) {
  const h = await pg.evaluateHandle((src) => {
    const re = new RegExp(src, "i");
    return [...document.querySelectorAll("button,[role=button]")].find((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.disabled && re.test(b.innerText.replace(/\s+/g, " ").trim()); }) || null;
  }, re.source);
  const el = h.asElement();
  if (!el) return null;
  const label = (await el.innerText()).replace(/\s+/g, " ").trim().slice(0, 40);
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const b = await el.boundingBox();
  if (b) await pg.mouse.click(b.x + b.width / 2, b.y + b.height / 2); else await el.click({ force: true });
  console.log(`  tap "${label}" at ${at().toFixed(1)}`);
  return label;
}
async function until(fn, ms, every = 250) {
  const end = Date.now() + ms;
  for (;;) { const v = await fn().catch(() => null); if (v) return v; if (Date.now() > end) return null; await wait(every); }
}
async function tours() {
  for (let i = 0; i < 8; i++) {
    const n = pg.getByText(/^(NEXT\s*.?|LATER|GOT IT)$/i).first();
    if (!(await n.count())) break;
    const b = await n.boundingBox().catch(() => null);
    if (b) await pg.mouse.click(b.x + b.width / 2, b.y + b.height / 2); else await n.click({ force: true }).catch(() => {});
    await wait(400);
  }
}

await pg.goto(`http://localhost:${PORT}/star-dev`, { waitUntil: "domcontentloaded", timeout: 180000 });
await pg.waitForSelector('[data-tour="nav-play"]', { state: "visible", timeout: 180000 });
await wait(2500);
await tours();
// Pop-ups waiting on the Home screen (an achievement unlocked by the season's numbers): close them.
for (let i = 0; i < 6; i++) { if (!(await tap(/^CLOSE$/))) break; await wait(1200); }
await tours();
const pcm = await startPcm(pg, at);
await wait(1500);
mark("home");

// 1. End of Season → the season video, left to play to its end.
const must = (v, what) => { if (!v) { console.log("STUCK: " + what); marks.stuck = (marks.stuck || []).concat(what); } return v; };
must(await tap(/End of Season/), "End of Season button");
must(await until(() => pg.locator("[data-reel-ended]").count(), 90000), "reel opens");
mark("reel");
const soundReady = await until(async () => (await pg.getAttribute("[data-reel-ended]", "data-reel-sound")) === "ready", 30000);
mark("reel-sound-ready", { ok: !!soundReady });
await until(async () => (await pg.getAttribute("[data-reel-ended]", "data-reel-ended")) === "1", 180000, 500);
mark("reel-ended");
await wait(1500);
(await tap(/^CONTINUE$/)) || (await tap(/^Continue/));

// 2. The Ballon d'Or night, left to play to its result.
await until(async () => /BALLON D.OR/i.test(await text()), 30000);
mark("ballon-night");
const res = await until(async () => (await visibleButtons()).some((b) => /CONTINUE TO NEXT SEASON/i.test(b)), 150000, 500);
mark("ballon-result", { reached: !!res });
if (!res) { await tap(/^Skip/); await until(async () => (await visibleButtons()).some((b) => /CONTINUE TO NEXT SEASON/i.test(b)), 30000); mark("ballon-result-after-skip"); }
await wait(4000);
await tap(/CONTINUE TO NEXT SEASON/);

// 3. The transfer window: stay.
await until(async () => /TRANSFER WINDOW|SUMMER WINDOW/i.test(await text()), 30000);
mark("transfer");
await wait(3500);
await tap(/STAY$/);
await wait(800);
await tap(/^(STAY|YES|CONFIRM)/);   // a confirm, if there is one

// 4. The 3D awards night, left to play.
await until(async () => /SEASON AWARDS/i.test(await text()), 30000);
mark("awards-night");
const ready = await until(() => pg.evaluate(() => window.__awardsNight3dReady === true), 120000, 300);
mark("awards-night-3d-ready", { ok: !!ready });
const plan = await pg.evaluate(() => window.__awardsNight?.plan ? { awards: window.__awardsNight.plan.awards.map((a) => ({ key: a.key, from: a.from, revealAt: a.revealAt, end: a.end, you: !!a.winner?.isYou, name: a.winner?.name })) } : null).catch(() => null);
marks.awardsPlan = plan;
console.log(JSON.stringify(plan));
const ended = await until(async () => (await visibleButtons()).some((b) => /^Continue ›|^CONTINUE$/i.test(b)) || !(await pg.evaluate(() => !!window.__awardsNight)), 150000, 500);
mark("awards-night-end", { reached: !!ended });
if (!ended) await tap(/Skip all/);
await wait(1500);
await tap(/^Continue ›/);

// 5. The awards page → Continue → Season Review → Continue → the new season.
await until(async () => /SEASON AWARDS/i.test(await text()) && !(await pg.evaluate(() => !!window.__awardsNight)) && (await pg.locator("button", { hasText: /^\s*CONTINUE\s*$/i }).count()) > 0, 30000);
mark("awards-page");
await wait(2500);
for (let y = 0; y < 6; y++) { await pg.mouse.wheel(0, 500); await wait(600); }
await wait(800);
await tap(/^CONTINUE$/);
await until(async () => /SEASON REVIEW/i.test(await text()), 30000);
mark("season-review");
await wait(4000);
await tap(/^CONTINUE$/);
await until(async () => /AGE 17/.test(await text()), 30000);
mark("next-season");
await wait(2500);
// An achievement the new numbers unlocked (Golden Boot) pops up over the new season: close it.
for (let i = 0; i < 4; i++) { if (!(await tap(/^CLOSE$/))) break; await wait(1500); }
await tours();
await wait(2000);
mark("done");
await finish();
console.log(JSON.stringify(marks));
