#!/usr/bin/env node
/**
 * Film one drawn face (the face system, lib/star/style3d/toon/faceId.ts) changing emotion and blinking
 * (/star-3d-bench-dev/people?set=faceplay), frame by frame.
 *   node scripts/bench3d/face-film.mjs OUTDIR [person ...]      (default: person 9; the people are set=faceids' 28)
 * Needs a dev server (BASE, default http://localhost:3200), Chrome with SwiftShader, ffmpeg.
 * Writes face-<person>.mp4 (the 8 emotions, 1.2 s each, 0.5 s between, 30 a second).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const [out = ".", ...who0] = process.argv.slice(2);
const who = who0.length ? who0 : ["9"];
const BASE = process.env.BASE ?? "http://localhost:3200";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const person of who) {
  const p = await b.newPage({ viewport: { width: 700, height: 800 } });
  p.on("pageerror", (e) => console.log(person, "PAGEERR", e.message.slice(0, 300)));
  await p.goto(`${BASE}/star-3d-bench-dev/people?set=faceplay&person=${person}&play=0${process.env.QUERY ? `&${process.env.QUERY}` : ""}`, { timeout: 240000 });
  await p.waitForFunction("window.__sheetDone === true", null, { timeout: 600000, polling: 500 });
  const frames = await p.evaluate(() => window.__faceFrames);
  const dir = path.join(out, `frames-face-${person}`);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < frames; i++) {
    const data = await p.evaluate((k) => { window.__faceFrame(k); return document.querySelector("#swing-canvas").toDataURL("image/jpeg", 0.93); }, i);
    fs.writeFileSync(path.join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  }
  const file = path.join(out, `face-${person}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(dir, "%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", file]);
  if (!process.env.KEEP_FRAMES) fs.rmSync(dir, { recursive: true });
  console.log(file);
  await p.close();
}
await b.close();
