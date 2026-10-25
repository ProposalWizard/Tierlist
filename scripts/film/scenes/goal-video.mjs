/**
 * FILM: a goal video of YOUR celebration goal (Leo, chat 1, 23 Oct 2026).
 *
 *   node scripts/film/scenes/goal-video.mjs <port> <profileDir> <outDir> [style]
 *
 * <profileDir> is a browser profile that has played a celebration goal in a real match
 * (celebrations.mjs leaves one per clip: <out>/prof-<clip>), so its goal recordings are in
 * IndexedDB. Opens /star-goal-clips-dev, picks the newest recording, the given cut
 * (broadcast by default: the TV cut that goes tight on you), plays it, and records the
 * screen. Writes <outDir>/goal-video.webm + goal-video.json (when the video started).
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { installAudioTap } from "./audio-tap.mjs";
import { startPcm, stopPcm } from "./audio-pcm.mjs";

const [PORT, PROF, OUT, STYLE = "broadcast"] = process.argv.slice(2);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const vidDir = path.join(OUT, "vid-goal-video");
fs.rmSync(vidDir, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(PROF, {
  executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--disable-dev-shm-usage", "--autoplay-policy=no-user-gesture-required"],
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
  recordVideo: { dir: vidDir, size: { width: 390, height: 844 } },
});
const T0 = Date.now();
const at = () => (Date.now() - T0) / 1000;
await installAudioTap(ctx);   // the video's own sound (crowd, net, commentary): see audio-pcm.mjs
const pg = ctx.pages()[0] || (await ctx.newPage());
const errors = [];
pg.on("pageerror", (e) => errors.push(e.message));
await pg.goto(`http://localhost:${PORT}/star-goal-clips-dev`, { waitUntil: "domcontentloaded", timeout: 300000 });
await wait(1500);
const pcm = await startPcm(pg, at).catch(() => null);
await wait(5500);
const rows = await pg.locator("[data-clip-row]").allInnerTexts();
console.log("recordings", rows.length, rows[0]);
await pg.locator("[data-clip-row]").first().click();
await wait(2000);
const b = pg.locator(`[data-goal-clip-angle="${STYLE}"]`);
if (await b.count()) await b.click();
await wait(1500);
const media = pg.locator("[data-clip-chosen] canvas, [data-clip-chosen] video").first();
await media.scrollIntoViewIfNeeded();
await pg.evaluate(() => { const el = document.querySelector("[data-clip-chosen] canvas, [data-clip-chosen] video"); el?.scrollIntoView({ block: "center" }); });
await wait(800);
const box = await media.boundingBox();
const start = at();
await pg.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await wait(22000);
const marks = { start, end: at(), box, rows: rows.slice(0, 3), errors };
try { if (pcm) marks.audioAt = await stopPcm(pg, path.join(OUT, "goal-video.wav"), pcm); } catch (e) { marks.audioErr = e.message; }
fs.writeFileSync(path.join(OUT, "goal-video.json"), JSON.stringify(marks, null, 1));
await ctx.close();
const vids = fs.readdirSync(vidDir).map((f) => path.join(vidDir, f)).sort((a, z) => fs.statSync(z).size - fs.statSync(a).size);
fs.renameSync(vids[0], path.join(OUT, "goal-video.webm"));
console.log(JSON.stringify(marks));
