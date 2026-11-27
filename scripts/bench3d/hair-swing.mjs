#!/usr/bin/env node
/**
 * Film the hair swing test (/star-3d-bench-dev/people?set=swing) at phone size, frame by frame.
 *   node scripts/bench3d/hair-swing.mjs OUTDIR [hair ...]      (default: locsLong braids)   STILL=1: the same film with the swing off
 * Needs a dev server (BASE, default http://localhost:3200), Chrome with SwiftShader, ffmpeg. Writes swing-<hair>.mp4 (6.5 s, 30 a second).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const [out = ".", ...hairs0] = process.argv.slice(2);
const hairs = hairs0.length ? hairs0 : ["locsLong", "braids"];
const BASE = process.env.BASE ?? "http://localhost:3200";
const still = process.env.STILL === "1";
const FRAMES = 195;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const hair of hairs) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  p.on("pageerror", (e) => console.log(hair, "PAGEERR", e.message.slice(0, 300)));
  await p.goto(`${BASE}/star-3d-bench-dev/people?set=swing&hair=${hair}&play=0${still ? "&still=1" : ""}${process.env.QUERY ? `&${process.env.QUERY}` : ""}`, { timeout: 240000 });
  await p.waitForFunction("window.__sheetDone === true", null, { timeout: 600000, polling: 500 });
  const dir = path.join(out, `frames-${hair}`);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < FRAMES; i++) {
    const data = await p.evaluate((k) => { window.__swingFrame(k); return document.querySelector("#swing-canvas").toDataURL("image/jpeg", 0.93); }, i);
    fs.writeFileSync(path.join(dir, `${String(i).padStart(4, "0")}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  }
  const file = path.join(out, `swing-${hair}${still ? "-still" : ""}.mp4`);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "30", "-i", path.join(dir, "%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", file]);
  if (!process.env.KEEP_FRAMES) fs.rmSync(dir, { recursive: true });
  console.log(file);
  await p.close();
}
await b.close();
