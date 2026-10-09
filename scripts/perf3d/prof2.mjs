// CPU profile of the Nth open of a scene in one page (2 = the revisit: leave and open again),
// with self and inclusive time, so the cost between "ready" and the first frame has a name.
// Lag pass 4, 9 Oct 2026.
//   node scripts/perf3d/prof2.mjs career [port] [visit=2] [&query]
import { chromium } from "playwright";
const scene = process.argv[2], port = process.argv[3] || "3502", visit = +(process.argv[4] || 2), q = process.argv[5] || "";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("console", (m) => { if (/\[t\]/.test(m.text())) console.log(m.text()); });
page.on("pageerror", (e) => console.error("pageerror", String(e).slice(0, 200)));
const cdp = await ctx.newCDPSession(page);
if (process.env.THROTTLE) await cdp.send("Emulation.setCPUThrottlingRate", { rate: +process.env.THROTTLE });
await page.goto(`http://localhost:${port}/index.html?gov=0${q}`);
await page.evaluate(() => { window.__M.finish = false; });
const open = () => page.evaluate(async (s) => {
  const M = window.__M; M.frames.length = 0; M.ready = 0;
  const t = performance.now(); await window.H[s]({}); const ready = performance.now() - t;
  while (!M.frames.some((f) => f.at >= M.ready)) await new Promise((r) => setTimeout(r, 16));
  const f = M.frames.find((x) => x.at >= M.ready);
  return { ready: Math.round(ready), first: Math.round(f.at + f.cpu - t) };
}, scene);
for (let i = 1; i < visit; i++) { console.log("visit", i, JSON.stringify(await open())); await page.evaluate(() => { window.__M.finish = true; }); await page.waitForTimeout(+(process.env.STAY || 0)); await page.evaluate(() => { window.__M.finish = false; }); await page.evaluate(() => window.H.dispose()); await page.waitForTimeout(500); }
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
await cdp.send("Profiler.start");
const r = await open();
const { profile } = await cdp.send("Profiler.stop");
console.log("visit", visit, JSON.stringify(r));
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const counts = new Map(); profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (profile.timeDeltas[i] || 0)));
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const name = (n) => `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`;
const self = new Map(), incl = new Map();
for (const [id, us] of counts) {
  const n = byId.get(id); self.set(name(n), (self.get(name(n)) || 0) + us);
  const seen = new Set(); let p = id;
  while (p) { const k = name(byId.get(p)); if (!seen.has(k)) { seen.add(k); incl.set(k, (incl.get(k) || 0) + us); } p = parent.get(p); }
}
const top = +(process.env.TOP || 45);
console.log("--- self"); [...self].sort((a, b) => b[1] - a[1]).slice(0, 20).forEach(([k, us]) => console.log((us / 1000).toFixed(0).padStart(7), k));
console.log("--- inclusive"); [...incl].sort((a, b) => b[1] - a[1]).slice(0, top).forEach(([k, us]) => console.log((us / 1000).toFixed(0).padStart(7), k));
await b.close();
