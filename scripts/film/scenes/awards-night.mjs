// Scene: the 3D season awards night (/star-awards-night-dev), frame by frame.
// node scripts/film/scenes/awards-night.mjs <base-url> <out-dir> [fps=15] [from=0] [to=<end of 2nd award>]
// The 3D room draws at seconds per frame in a headless browser, so a real-time
// recording stutters. Instead: window.__awardsNight.seek(t) holds the night at
// exactly t and draws once; we screenshot each step and join the frames into
// a smooth MP4 that plays at real speed. Made-up results from the test page
// (you win the Golden Boot and Player of the Season), so it is the same every run.
// Resumable: frames already on disk are skipped.
import { phone } from "/home/user/film-leo/scripts/film/rec.mjs";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { hideChrome } from "./lib-season.mjs";

const [base = "http://localhost:3300", out = ".", fpsArg = "15", fromArg, toArg] = process.argv.slice(2);
const fps = Number(fpsArg);
const frames = `${out}/frames`;
fs.mkdirSync(frames, { recursive: true });
const { browser, page } = await phone({ touches: false, deviceScaleFactor: 1 });
try {
  await page.goto(`${base}/star-awards-night-dev`, { waitUntil: "networkidle" });
  await hideChrome(page);
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.getByText("▶ Play the night").click();
  await page.waitForFunction(() => window.__awardsNight3dReady === true && !!window.__awardsNight, null, { timeout: 180000 });
  const plan = await page.evaluate(() => window.__awardsNight.plan);
  fs.writeFileSync(`${out}/plan.json`, JSON.stringify(plan, null, 1));
  const from = fromArg ? Number(fromArg) : 0;
  const to = toArg ? Number(toArg) : plan.awards[1].end;
  const n = Math.round((to - from) * fps);
  console.log(`awards: ${plan.awards.map((a) => `${a.key}${a.winner.isYou ? "(you)" : ""} ${a.from.toFixed(1)}-${a.end.toFixed(1)}`).join(", ")}; filming ${from}-${to.toFixed(1)} s, ${n} frames`);
  const t0 = Date.now();
  for (let i = 0; i <= n; i++) {
    const f = `${frames}/f${String(i).padStart(5, "0")}.jpg`;
    if (fs.existsSync(f)) continue;
    const t = from + i / fps;
    await page.evaluate((t) => window.__awardsNight.seek(t), t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: f, type: "jpeg", quality: 90 });
    if (i % 20 === 0) console.log(`frame ${i}/${n} t=${t.toFixed(2)} ${((Date.now() - t0) / 1000 / (i + 1)).toFixed(2)} s/frame`);
  }
} finally { await browser.close(); }
const r = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", `${frames}/f%05d.jpg`,
  "-vf", "scale=390:-2:flags=lanczos,fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-movflags", "+faststart", "-an", `${out}/awards-night.mp4`]);
if (r.status !== 0) throw new Error(r.stderr.toString());
console.log("wrote", `${out}/awards-night.mp4`);
