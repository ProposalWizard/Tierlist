// scripts/film/rec.mjs — THE way to film the game for patch notes and reviews.
// Standing rule (Harry, 1 Oct 2026, after tiny cropped GIFs with no playhead:
// "this should be standard"). Every clip and screenshot goes through here so
// they all look the same: the WHOLE phone screen
// (390x844 CSS px), rendered at 2x so text is sharp, saved as a real MP4
// (H.264, plays with a playhead on any phone) or a full-screen JPG.
//
//   import { phone, startRec, stopRec, shot, poster } from "<repo>/scripts/film/rec.mjs";
//   const { browser, page } = await phone();          // 390x844 @2x, touch on
//   await page.goto(url);
//   const r = await startRec(page);                     // starts filming
//   ... drive the game ...
//   await stopRec(r, "/abs/out/01-thing-after.mp4");    // stops + encodes
//   await shot(page, "/abs/out/01-thing-after.jpg");    // full phone screen
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ffmpeg: , else the copy pip's imageio-ffmpeg ships, else the PATH.
function findFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const r = spawnSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]);
  const p = r.status === 0 ? r.stdout.toString().trim() : "";
  return p && fs.existsSync(p) ? p : "ffmpeg";
}
const FFMPEG = findFfmpeg();
export const W = 390, H = 844;

// A soft dot wherever a finger touches, so a viewer can see what was tapped
// or dragged. Drawn in the page itself, so it lands in both clips and shots.
export async function showTouches(target) {
  await target.addInitScript(() => {
    const css = "position:fixed;z-index:2147483647;pointer-events:none;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;background:rgba(255,255,255,.45);border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 2px rgba(0,0,0,.35);transition:opacity .25s";
    let dot = null;
    const put = (x, y) => { if (!dot) { dot = document.createElement("div"); dot.style.cssText = css; (document.body || document.documentElement).appendChild(dot); } dot.style.left = x + "px"; dot.style.top = y + "px"; dot.style.opacity = "1"; };
    const hide = () => { if (dot) dot.style.opacity = "0"; };
    addEventListener("pointerdown", (e) => put(e.clientX, e.clientY), true);
    addEventListener("pointermove", (e) => { if (e.buttons) put(e.clientX, e.clientY); }, true);
    addEventListener("pointerup", hide, true);
    addEventListener("pointercancel", hide, true);
  });
}

export async function phone(opts = {}) {
  const exe = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
  const browser = await chromium.launch({ args: ["--disable-dev-shm-usage"], ...(exe && fs.statSync(exe).isFile() ? { executablePath: exe } : {}) });
  const context = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    ...opts,
  });
  if (opts.touches !== false) await showTouches(context);
  const page = await context.newPage();
  return { browser, context, page };
}

export async function startRec(page) {
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  cdp.on("Page.screencastFrame", async (f) => {
    frames.push({ data: f.data, t: f.metadata.timestamp });
    try { await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch {}
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * 2, maxHeight: H * 2, everyNthFrame: 1 });
  return { cdp, frames, page, t0: Date.now() / 1000 };
}

// Encodes to a constant 30 fps MP4, 720 px wide, holding the last frame for
// `holdEnd` seconds so the clip doesn't end on the action.
export async function stopRec(r, outMp4, { holdEnd = 0.8 } = {}) {
  await new Promise((res) => setTimeout(res, 150));
  const tEnd = Date.now() / 1000;
  await r.cdp.send("Page.stopScreencast").catch(() => {});
  const fr = r.frames;
  if (!fr.length) throw new Error("no frames recorded — did the page paint?");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rec-"));
  const lines = [];
  fr.forEach((f, i) => {
    const p = path.join(dir, `f${String(i).padStart(5, "0")}.jpg`);
    fs.writeFileSync(p, Buffer.from(f.data, "base64"));
    const next = i + 1 < fr.length ? fr[i + 1].t : Math.max(tEnd, f.t + 0.05);
    lines.push(`file '${p}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  });
  const last = path.join(dir, `f${String(fr.length - 1).padStart(5, "0")}.jpg`);
  lines.push(`file '${last}'`, `duration ${holdEnd}`, `file '${last}'`);
  fs.writeFileSync(path.join(dir, "list.txt"), lines.join("\n"));
  fs.mkdirSync(path.dirname(outMp4), { recursive: true });
  const res = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
    "-vf", "fps=30,scale=720:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "24",
    "-movflags", "+faststart", "-an", outMp4]);
  fs.rmSync(dir, { recursive: true, force: true });
  if (res.status !== 0) throw new Error("ffmpeg failed: " + res.stderr?.toString());
  return outMp4;
}

// Full phone screen, 2x, saved as JPG (quality 88).
export async function shot(page, outJpg, opts = {}) {
  fs.mkdirSync(path.dirname(outJpg), { recursive: true });
  await page.screenshot({ path: outJpg, type: "jpeg", quality: 88, ...opts });
  return outJpg;
}

// A slowed (factor 2 = half speed) or sped-up (factor 0.25 = 4x) copy of a clip.
export function retime(inMp4, outMp4, factor) {
  const res = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-i", inMp4, "-vf", `setpts=${factor}*PTS,fps=30,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-movflags", "+faststart", "-an", outMp4]);
  if (res.status !== 0) throw new Error("ffmpeg failed: " + res.stderr?.toString());
  return outMp4;
}

// The first frame of a clip as its cover picture (shown before it plays).
export function poster(inMp4, outJpg, atSec = 0.3) {
  const res = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-ss", String(atSec), "-i", inMp4, "-frames:v", "1", "-q:v", "3", outJpg]);
  if (res.status !== 0) throw new Error("ffmpeg failed: " + res.stderr?.toString());
  return outJpg;
}
