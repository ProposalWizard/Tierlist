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
// Touches, done by this tool between frames (the real match on the Style Testing page: a drag from the
// ball and a tap on the strike screen). Everything else in the timeline is the page's own scripted input.
//   { "t": 0.6, "drag": { "from": "ball", "dx": -30, "dy": 120, "dur": 0.5 } }   CSS px, from the ball (window.__starMatch)
//   { "t": 1.4, "contact": { "cx": 0, "cy": 0.2 } }                             a tap on the strike screen's ball (−1..1 from its centre)
const touches = [];
if (timelineFile) {
  const tl = JSON.parse(fs.readFileSync(timelineFile, "utf8"));
  for (const e of tl) {
    if (e.drag) {
      const n = Math.max(2, Math.round((e.drag.dur ?? 0.4) * fps));
      touches.push({ t: e.t, kind: "down", drag: e.drag });
      for (let k = 1; k <= n; k++) touches.push({ t: e.t + ((e.drag.dur ?? 0.4) * k) / n, kind: "move", drag: e.drag, f: k / n });
      touches.push({ t: e.t + (e.drag.dur ?? 0.4) + 1e-4, kind: "up", drag: e.drag });
    } else if (e.contact) touches.push({ t: e.t, kind: "contact", contact: e.contact });
  }
  touches.sort((a, b) => a.t - b.t);
  const own = tl.filter((e) => !e.drag && !e.contact);
  await page.evaluate((t) => { window.__frameStep.timeline = t; }, own);
}
let dragAt = null;
const doTouches = async (t) => {
  while (touches.length && touches[0].t <= t + 1e-6) {
    const e = touches.shift();
    if (e.kind === "down") {
      // the ball as seen: the 3D view's ball when one is drawn, else the 2D match's
      const b = await page.evaluate(() => window.__engineView3dBall ?? window.__starMatch?.ball?.() ?? null);
      if (!b) { console.error(`[touch] no ball to drag at t=${e.t}`); continue; }
      dragAt = b;
      await page.mouse.move(b.x, b.y); await page.mouse.down();
    } else if (e.kind === "move" && dragAt) await page.mouse.move(dragAt.x + e.drag.dx * e.f, dragAt.y + e.drag.dy * e.f);
    else if (e.kind === "up" && dragAt) { await page.mouse.up(); dragAt = null; }
    else if (e.kind === "contact") {
      const box = await page.locator('div.cursor-pointer[style*="aspect-ratio"]').first().boundingBox().catch(() => null);
      if (!box) { console.error(`[touch] no strike screen at t=${e.t}`); continue; }
      const r = box.width / 2;
      await page.mouse.click(box.x + r + (e.contact.cx ?? 0) * r, box.y + r + (e.contact.cy ?? 0) * r);
    }
  }
};
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
  if (fs.existsSync(nameOf(i)) && fs.statSync(nameOf(i)).size > 0 && !touches.length) { skipped++; continue; }
  const t = i / fps;
  const f0 = Date.now();
  await doTouches(t);
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
