// Live playback: does the sound stay with the picture? Samples the picture
// clock (progress bar) and the playing sound's position every 0.5 s, with a
// pause/resume in the middle and a seek.
// node .measure/live.mjs <baseUrl> <goals> <outJson>
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const [base = "http://localhost:3500", goalsArg = "20", out = ".measure/live.json"] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: 420, height: 860 } })).newPage();
await page.addInitScript(() => {
  const w = window;
  w.__starts = [];
  const orig = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when, offset, dur) {
    if (this.context instanceof AudioContext && this.buffer && this.buffer.duration > 20) {
      const rec = { ctx: this.context, ctxAt: this.context.currentTime, offset: offset ?? 0, perf: performance.now(), stopped: false };
      w.__starts.push(rec);
      const st = this.stop.bind(this);
      this.stop = (...a) => { rec.stopped = true; return st(...a); };
      this.addEventListener("ended", () => { rec.stopped = true; });
    }
    return orig.call(this, when, offset, dur);
  };
});
await page.goto(`${base}/star-season-reel-dev`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: goalsArg, exact: true }).click();
await page.getByRole("button", { name: "Every goal" }).click();
await page.getByRole("button", { name: /Play the reel/ }).click();
await page.waitForSelector('[data-reel-sound="ready"]', { timeout: 120000 });
// From the top, so the whole run is measured.
await page.evaluate(() => window.__seasonReel.seek(0, false));

const sample = () => page.evaluate(() => {
  const r = window.__seasonReel;
  const bar = document.querySelector("[data-season-reel] .bg-white.h-full");
  const pct = parseFloat(bar?.style.width || "0");
  const pic = pct / 100 * r.duration;
  const live = window.__starts.filter((s) => !s.stopped);
  const s = live[live.length - 1];
  const own = r.sync ? r.sync() : null;
  if (!s) return { pic, audio: null, starts: window.__starts.length, own };
  const c = s.ctx;
  const pos = s.offset + (c.currentTime - s.ctxAt);
  let heard = null;
  try {
    const o = c.getOutputTimestamp();
    if (o && o.performanceTime) heard = s.offset + (o.contextTime + (performance.now() - o.performanceTime) / 1000 - s.ctxAt);
  } catch { /* none */ }
  return { own, pic, audio: pos, heard, outLat: c.outputLatency ?? null, baseLat: c.baseLatency ?? null, starts: window.__starts.length, state: c.state };
});

const rows = [];
const t0 = Date.now();
const until = async (ms, label) => {
  while (Date.now() - t0 < ms) {
    const s = await sample();
    rows.push({ wall: (Date.now() - t0) / 1000, label, ...s });
    await page.waitForTimeout(500);
  }
};
if (process.argv[5] === "straight") {
  await until(20000, "run");
  await until(45000, "after pause"); // (no pause: one straight run, start to end)
  await until(74000, "to the end");
} else {
  await until(20000, "run");
  await page.click("canvas"); // pause
  await page.waitForTimeout(3000);
  await page.click("[data-reel-resume]"); // resume
  await until(40000, "after pause");
  await page.evaluate(() => window.__seasonReel.seek(55, false)); // seek
  await until(60000, "after seek");
  await until(80000, "to the end");
}
writeFileSync(out, JSON.stringify(rows, null, 1));
const d = rows.filter((r) => r.audio != null && r.pic > 0.5 && r.pic < 71).map((r) => ({ ...r, d: (r.audio - r.pic) * 1000, dh: r.heard != null ? (r.heard - r.pic) * 1000 : null }));
for (const lab of ["run", "after pause", "after seek", "to the end"]) {
  const x = d.filter((r) => r.label === lab);
  if (!x.length) continue;
  const v = x.map((r) => r.d).sort((a, b) => a - b), h = x.filter((r) => r.dh != null).map((r) => r.dh).sort((a, b) => a - b);
  console.log(`${lab}: n ${x.length}, scheduled-audio minus picture: median ${v[v.length >> 1].toFixed(0)} ms, min ${v[0].toFixed(0)}, max ${v[v.length - 1].toFixed(0)}; heard minus picture: median ${h.length ? h[h.length >> 1].toFixed(0) : "-"} ms`);
}
console.log("restarts", rows[rows.length - 1].starts, "outputLatency", rows.find((r) => r.outLat != null)?.outLat, "baseLatency", rows.find((r) => r.baseLat != null)?.baseLat);
await browser.close();
const own = rows.filter((r) => r.own && r.own.heard != null && r.own.picture > 0.5 && r.own.picture < 71).map((r) => (r.own.heard - r.own.picture) * 1000).sort((a, b) => a - b);
if (own.length) console.log(`screen probe (fresh clocks), heard minus picture: n ${own.length}, median ${own[own.length >> 1].toFixed(1)} ms, min ${own[0].toFixed(1)}, max ${own[own.length - 1].toFixed(1)}`);
