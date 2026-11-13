/**
 * tools/preview-film/ad2/render.mjs — photograph ad.html frame by frame and join it with the music.
 *
 *   node render.mjs <work dir holding foot/ and clean/> <music.mp3> <out.mp4> [--at 3.2,10.5 --stills <dir>]
 *
 * The work dir gets a copy of ad.html and cinzel.ttf in <work>/ad2/. --at: only save stills at those seconds.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const [work, music, out] = process.argv.slice(2);
const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(work, "ad2"); fs.mkdirSync(dir, { recursive: true });
fs.copyFileSync(path.join(here, "ad.html"), path.join(dir, "ad.html"));
fs.copyFileSync(path.join(work, "cinzel.ttf"), path.join(dir, "cinzel.ttf"));
const FPS = 30;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium", args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto(`file://${dir}/ad.html?foot=${encodeURIComponent("file://" + path.join(work, "foot"))}`);
const dur = await page.evaluate(() => window.DURATION);
const stage = page.locator("#stage");
if (arg("--at")) {
  const sd = arg("--stills") || path.join(dir, "stills"); fs.mkdirSync(sd, { recursive: true });
  for (const t of arg("--at").split(",").map(Number)) { await page.evaluate((t) => window.setT(t), t); await stage.screenshot({ path: path.join(sd, `t_${t.toFixed(2)}.jpg`), quality: 85 }); }
  await browser.close(); process.exit(0);
}
const fd = path.join(dir, "frames"); fs.rmSync(fd, { recursive: true, force: true }); fs.mkdirSync(fd);
const n = Math.round(dur * FPS);
for (let i = 0; i < n; i++) {
  await page.evaluate((t) => window.setT(t), i / FPS);
  await stage.screenshot({ path: path.join(fd, `f_${String(i).padStart(5, "0")}.png`) });
  if (i % 100 === 0) console.log("frame", i, "of", n);
}
await browser.close();
execFileSync("ffmpeg", ["-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(fd, "f_%05d.png"), "-i", music,
  "-filter_complex", `[1:a]afade=t=in:d=0.15,afade=t=out:st=${(dur - 0.7).toFixed(2)}:d=0.7[a]`, "-map", "0:v", "-map", "[a]", "-t", dur.toFixed(3),
  "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]);
console.log("film:", out, dur.toFixed(1) + "s");
