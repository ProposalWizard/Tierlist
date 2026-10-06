import { chromium } from "playwright";
const mode = process.argv[2] || "main";
const throttle = +(process.argv[3] || 4);
const dpr = +(process.argv[4] || 1);
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
await page.goto("http://localhost:3502/mini.html");
const cdp = await ctx.newCDPSession(page);
if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
await page.waitForTimeout(1500);
await page.evaluate((m) => window.runMini(m), mode);
await page.waitForFunction(() => window.__err || window.__mini.frames.length >= 8, null, { timeout: 280000, polling: 500 });
const r = await page.evaluate(() => {
  const g = window.__ui.gaps, f = window.__mini.frames;
  const tEnd = f[f.length - 1].at;
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const later = f.slice(2);
  return {
    err: window.__err, firstFrameAtMs: Math.round(window.__mini.first),
    ui: { ticks: g.length, maxGapMs: Math.round(Math.max(...g)), over100: g.filter((x) => x > 100).length, blockedMs: Math.round(g.reduce((a, x) => a + Math.max(0, x - 16.7), 0)), spanMs: Math.round(tEnd - window.__mini.t0) },
    scene: { frames: f.length, firstMs: Math.round(f[0].ms), msPerFrameMed: Math.round(q(later.map((x) => x.ms), 0.5)) },
  };
});
console.log(JSON.stringify({ mode, throttle, dpr, ...r, errs }));
await browser.close();
