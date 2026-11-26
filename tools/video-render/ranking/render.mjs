// node render.mjs data.json out.mp4 [music.mp3]  (Mikey, 26 Nov 2026): the ranking countdown, frame by frame.
import { chromium } from "playwright"; import fs from "node:fs"; import { spawn } from "node:child_process"; import path from "node:path";
const [dataPath, out, music] = process.argv.slice(2); const D = JSON.parse(fs.readFileSync(dataPath, "utf8")); const FPS = 30;
const dur = (D.t0 ?? 0.35) + (D.top - D.shown - 5) * D.step + D.endHold;
const br = await chromium.launch({ args: ["--allow-file-access-from-files"] }); const p = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto("file://" + path.resolve(path.dirname(new URL(import.meta.url).pathname), "ranking.html")); await p.evaluate(async (d) => window.setup(d), D);
const args = ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-"]; if (music) args.push("-i", music);
args.push("-t", String(dur), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium"); if (music) args.push("-c:a", "aac", "-b:a", "160k", "-af", `afade=t=out:st=${dur - 1.2}:d=1.2`, "-shortest"); args.push("-movflags", "+faststart", out);
const ff = spawn("ffmpeg", args, { stdio: ["pipe", "inherit", "inherit"] });
for (let f = 0; f < Math.ceil(dur * FPS); f++) { const b64 = await p.evaluate((t) => { window.draw(t); return document.getElementById("c").toDataURL("image/jpeg", 0.92).split(",")[1]; }, f / FPS); if (!ff.stdin.write(Buffer.from(b64, "base64"))) await new Promise(r => ff.stdin.once("drain", r)); }
ff.stdin.end(); await new Promise(r => ff.on("close", r)); await br.close(); console.log("done", out, dur.toFixed(1) + "s");
