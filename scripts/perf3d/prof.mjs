// CPU profile of one scene's open (no throttle), top self-time functions
import { chromium } from "playwright";
const scene = process.argv[2], port = process.argv[3] || "3512";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`http://localhost:${port}/index.html?gov=0`);
await page.evaluate(() => { window.__M.finish = false; }); // the harness's own per-frame readPixels off
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
await cdp.send("Profiler.start");
const r = await page.evaluate(async (s) => { const M = window.__M; const t = performance.now(); await window.H[s]({}); const ready = performance.now() - t; while (!M.frames.some((f) => f.at >= M.ready)) await new Promise((r) => setTimeout(r, 16)); return { ready, first: performance.now() - t }; }, scene);
const { profile } = await cdp.send("Profiler.stop");
console.log(JSON.stringify(r));
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; const counts = new Map();
profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
for (const [id, us] of counts) { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) || 0) + us); }
// who calls the big native costs (readPixels, shader compiles): their callers, 6 deep
const parent = new Map(); for (const n of profile.nodes) for (const c of n.children || []) parent.set(c, n.id);
const stacks = new Map();
for (const [id, us] of counts) {
  const n = byId.get(id); if (!/readPixels|getProgramInfoLog|getProgramParameter|texImage|texSubImage/.test(n.callFrame.functionName)) continue;
  const st = []; let p = parent.get(id);
  while (p && st.length < 7) { const m = byId.get(p); st.push(`${m.callFrame.functionName || "anon"}:${m.callFrame.lineNumber}:${m.callFrame.columnNumber}`); p = parent.get(p); }
  const k = n.callFrame.functionName + " <- " + st.join(" <- "); stacks.set(k, (stacks.get(k) || 0) + us);
}
[...stacks].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, us]) => console.log("STACK", (us / 1000).toFixed(0), k));
[...self].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, us]) => console.log((us / 1000).toFixed(0).padStart(7), k));
await b.close();
