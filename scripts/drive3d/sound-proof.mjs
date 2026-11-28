#!/usr/bin/env node
// scripts/drive3d/sound-proof.mjs — RECORD A DRIVE WITH ITS SOUND (lib/star/drive3d/sound.ts) on a 390×844 phone, in
// real time: a tap, a hold, a lane change, the call answered, the event's Yes, the hand-over, the compound's arrival.
// Playwright's video has no sound, so every AudioContext's speakers are also wired to a MediaStreamDestination and
// recorded with MediaRecorder; ffmpeg then joins the two (drive-sound.webm) and the script measures the audio:
// peak, clipped samples, loudness per second, and the player's own listening log (window.__driveSoundLog).
//
//   node scripts/drive3d/sound-proof.mjs --out DIR [--base http://localhost:3116] [--car sports] [--event fan-crossing] [--call borrow-car] [--q low]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const out = path.resolve(opt("out", "drive-sound"));
const base = opt("base", "http://localhost:3116");
const car = opt("car", "sports"), event = opt("event", "fan-crossing"), call = opt("call", "borrow-car"), q = opt("q", "low");
fs.mkdirSync(out, { recursive: true });
const exe = fs.existsSync("/opt/pw-browsers/chromium") && fs.statSync("/opt/pw-browsers/chromium").isFile() ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl", "--disable-dev-shm-usage", "--hide-scrollbars", "--autoplay-policy=user-gesture-required"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, recordVideo: { dir: out, size: { width: 390, height: 844 } } });
const t0 = Date.now();
await ctx.addInitScript(() => {
  try { localStorage.setItem("kib-cookie-consent", "no"); } catch { /* fine */ }
  window.__driveSoundLog = [];
  const orig = AudioNode.prototype.connect;
  const taps = new WeakMap();
  window.__rec = { chunks: [] };
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = orig.call(this, dest, ...rest);
    try {
      if (dest instanceof AudioDestinationNode) {
        const c = this.context;
        let d = taps.get(c);
        if (!d) {
          d = c.createMediaStreamDestination(); taps.set(c, d);
          const mr = new MediaRecorder(d.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 128000 });
          mr.ondataavailable = (e) => { if (e.data.size) window.__rec.chunks.push(e.data); };
          window.__rec.mr = mr; window.__rec.ctx = c;
        }
        orig.call(this, d);
      }
    } catch (e) { console.warn("tap", e); }
    return r;
  };
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", e.message));
const log = [];
const now = () => (Date.now() - t0) / 1000;
const note = (what) => { log.push(`${now().toFixed(2)}s ${what}`); console.log(now().toFixed(2), what); };
await page.goto(`${base}/star-drive3d-dev?bare=1&car=${car}&event=${event}&call=${call}&q=${q}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("[data-drive-pad]", { timeout: 300000 });
await page.addStyleTag({ content: ".tr-float,[data-cookie-banner],[data-page-guide],[data-pageguide],.page-guide{display:none!important}" });
note("drive ready (silent: no tap yet)");
await page.waitForTimeout(600);
const before = await page.evaluate(() => ({ state: window.__rec.ctx?.state ?? "no context", log: window.__driveSoundLog.length }));
note(`before the tap: context ${before.state}, ${before.log} sound log lines`);
await page.mouse.click(195, 400);
await page.waitForTimeout(250);
const startCt = await page.evaluate(() => { const r = window.__rec; if (!r.mr) return null; r.mr.start(500); return r.ctx.currentTime; });
const recAt = now();
note(`tap; recorder started (audio context time ${startCt?.toFixed(2)})`);
await page.waitForTimeout(800);
note("hold (faster)");
await page.mouse.move(195, 500); await page.mouse.down(); await page.waitForTimeout(3000); await page.mouse.up();
note("let go");
let answeredCall = false, answeredEvent = false, lane = false, compoundAt = -1;
while (now() < 140) {
  const st = await page.evaluate(() => { const S = window.__drive?.S; return { S: S ? { t: S.t, call: S.callState, ev: S.eventState } : null, world: !!window.__world3d }; }).catch(() => ({ S: null, world: false }));
  if (st.S) {
    if (!lane && st.S.t > 6) { await page.mouse.click(330, 400); lane = true; note("tap the right half (lane change)"); }
    if (st.S.call === "ringing" && !answeredCall) { await page.waitForTimeout(2200); await page.click('[data-drive-answer="yes"]').catch(() => {}); answeredCall = true; note("answer the call"); }
    if (st.S.ev === "open" && !answeredEvent) { await page.waitForTimeout(700); await page.click('[data-drive-event-answer="yes"]').catch(() => {}); answeredEvent = true; note("the event: Yes"); }
  }
  if (compoundAt < 0 && !st.S && st.world) { compoundAt = now(); note("the compound opens (the arrival)"); }
  if (compoundAt > 0 && now() - compoundAt > 16) break;
  await page.waitForTimeout(150);
}
note("stop");
const endCt = await page.evaluate(() => new Promise((res) => { const r = window.__rec; if (!r.mr) return res(null); const t = r.ctx.currentTime; r.mr.onstop = () => res(t); r.mr.stop(); }));
const b64 = await page.evaluate(async () => { const blob = new Blob(window.__rec.chunks, { type: "audio/webm" }); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); });
const slog = await page.evaluate(() => window.__driveSoundLog);
fs.writeFileSync(path.join(out, "drive-audio.webm"), Buffer.from(b64, "base64"));
const video = page.video();
await ctx.close();
await browser.close();
fs.renameSync(await video.path(), path.join(out, "drive-screen.webm"));
// the listening log, in seconds of the recording
const rows = slog.map((r) => [((r[0] - startCt)).toFixed(2), ...r.slice(1)].join(" "));
fs.writeFileSync(path.join(out, "sound-log.txt"), rows.join("\n") + "\n");
fs.writeFileSync(path.join(out, "timeline.txt"), log.join("\n") + `\naudio starts at ${recAt.toFixed(2)} s of the screen video; audio context ${startCt?.toFixed(2)} → ${endCt?.toFixed(2)}\n`);
// join them: the audio starts recAt seconds into the screen video
try {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(out, "drive-screen.webm"), "-itsoffset", recAt.toFixed(2), "-i", path.join(out, "drive-audio.webm"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "libopus", "-b:a", "128k", path.join(out, "drive-sound.webm")]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", path.join(out, "drive-audio.webm"), "-ac", "2", "-ar", "48000", path.join(out, "drive-audio.wav")]);
} catch (e) { console.error("ffmpeg", e.message); }
console.log("done:", out);
