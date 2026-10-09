#!/usr/bin/env node
// scripts/film/frames3d.mjs — FRAME-STEPPED FILMING of a 3D screen, for a machine with no graphics card.
//
// Real-time capture here runs at 1-5 s per frame, so videos stutter. This freezes the clock instead:
// for every frame it asks the page to be at EXACTLY second t (window.__frameStep.seek(t), the contract in
// lib/star/frameStep.ts), draws that one frame, screenshots it, and moves on 1/fps. Join the frames with
// frames3d_encode.py for a smooth 30 fps video. Slow to make, perfect to watch.
//
//   node scripts/film/frames3d.mjs <url> --out DIR [--duration S] [--fps 30] [--size 390x844] [--dsf 2]
//                                  [--from F] [--to F] [--shot page|canvas|<css selector>] [--png]
//                                  [--timeline file.json] [--wait-ms 1500] [--limit-time 0]
//
//   --duration   seconds to film (default: the page's own __frameStep.duration)
//   --from/--to  frame numbers [from, to) — film part of it; frames already on disk are skipped (resumable)
//   --shot       what to screenshot: the whole phone screen (default), the first <canvas>, or a CSS selector
//   --timeline   JSON array of scripted input for a simulation screen: [{ "t":0, "move":{"x":0,"y":-1} }, ...]
//   --hide       extra CSS selector(s) to hide in the frames (the admin "eye" button is always hidden)
//   --png        lossless frames (bigger, slower); default JPEG quality 92
//   --ls         saved settings before load, "key=value,key2=value2" (star-3d-quality=medium films a phone's tier)
//
// Writes DIR/frame_00000.jpg … and DIR/frames.json (fps, size, count, url) for the encoder.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const url = args[0] && !args[0].startsWith("--") ? args[0] : null;
if (!url || !opt("out")) {
  console.error("usage: node scripts/film/frames3d.mjs <url> --out DIR [--duration S] [--fps 30] [--size 390x844] [--dsf 2] [--from F] [--to F] [--shot page|canvas|selector] [--png] [--timeline file.json]");
  process.exit(2);
}
const out = path.resolve(opt("out"));
const fps = Number(opt("fps", "30"));
const [W, H] = opt("size", "390x844").split("x").map(Number);
const dsf = Number(opt("dsf", "2"));
const ext = flag("png") ? "png" : "jpg";
const shotWhat = opt("shot", "page");
const waitMs = Number(opt("wait-ms", "1500"));
fs.mkdirSync(out, { recursive: true });

const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({
  ...(exe ? { executablePath: exe } : {}),
  // software WebGL (no graphics card): SwiftShader through ANGLE
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars"],
});
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
// --ls "key=value,key2=value2": saved settings before the page loads (e.g. star-3d-quality=medium: film a phone's tier, not the software-GPU one)
const lsPairs = (opt("ls", "") || "").split(",").filter(Boolean).map((kv) => kv.split("="));
if (lsPairs.length) await context.addInitScript((pairs) => { for (const [k, v] of pairs) localStorage.setItem(k, v); }, lsPairs);
const page = await context.newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message));
page.on("console", (m) => { if (m.type() === "error") console.error("[console]", m.text().slice(0, 200)); });

console.log(`loading ${url}`);
await page.goto(url, { waitUntil: "load", timeout: 180000 });
// textures and models: wait for the network to go quiet (Next's dev socket never does, so cap it) …
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
// … and for the page to say it has built the scene and published a stepper
await page.waitForFunction(() => window.__frameStep && (window.__styleReady === undefined || window.__styleReady === true), null, { timeout: 240000 });
await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(waitMs);

// dev furniture that should not be in a video (the admin "eye" button, plus anything given with --hide ".a,.b")
const hide = ["[data-page-guide]", ...(opt("hide", "") ? [opt("hide")] : [])].join(",");
await page.addStyleTag({ content: `${hide}{display:none !important}` });

const timelineFile = opt("timeline");
if (timelineFile) {
  const tl = JSON.parse(fs.readFileSync(timelineFile, "utf8"));
  await page.evaluate((t) => { window.__frameStep.timeline = t; }, tl);
}
const pageDuration = await page.evaluate(() => window.__frameStep.duration || 0);
const duration = Number(opt("duration", pageDuration));
if (!(duration > 0)) { console.error("no duration: pass --duration (the page did not say how long it runs)"); await browser.close(); process.exit(2); }
const total = Math.ceil(duration * fps);
const from = Number(opt("from", "0")), to = Math.min(total, Number(opt("to", String(total))));
console.log(`filming ${duration}s at ${fps} fps = ${total} frames (doing ${from}..${to - 1}) at ${W * dsf}x${H * dsf} -> ${out}`);

const nameOf = (i) => path.join(out, `frame_${String(i).padStart(5, "0")}.${ext}`);
const t0 = Date.now();
let done = 0, skipped = 0;
for (let i = from; i < to; i++) {
  if (fs.existsSync(nameOf(i)) && fs.statSync(nameOf(i)).size > 0) { skipped++; continue; }
  const t = i / fps;
  const f0 = Date.now();
  // be at exactly t, draw once, then let the page and the compositor settle (two animation frames)
  await page.evaluate(async (tt) => {
    await window.__frameStep.seek(tt);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, t);
  const tmp = nameOf(i) + ".part";
  const shotOpts = ext === "jpg" ? { type: "jpeg", quality: 92 } : { type: "png" };
  if (shotWhat === "page") await page.screenshot({ path: tmp, ...shotOpts });
  else await page.locator(shotWhat === "canvas" ? "canvas" : shotWhat).first().screenshot({ path: tmp, ...shotOpts });
  fs.renameSync(tmp, nameOf(i));
  done++;
  if (done % 5 === 0 || i === to - 1) {
    const spf = (Date.now() - t0) / 1000 / done;
    const left = (to - i - 1) * spf;
    console.log(`frame ${i + 1}/${to}  t=${t.toFixed(2)}s  ${spf.toFixed(2)} s/frame (last ${((Date.now() - f0) / 1000).toFixed(2)})  ~${Math.round(left)}s left`);
  }
}
const secs = (Date.now() - t0) / 1000;
fs.writeFileSync(path.join(out, "frames.json"), JSON.stringify({ fps, width: W * dsf, height: H * dsf, count: total, duration, ext, url }, null, 2));
console.log(`done: ${done} new frames, ${skipped} already on disk, ${secs.toFixed(1)}s total${done ? `, ${(secs / done).toFixed(2)} s/frame` : ""}`);
await browser.close();
