// Real Goals load time at a 6x CPU throttle (chat 5, 22 Oct 2026). Needs `next start` on PORT (default 3300).
// node scripts/star-sandbox/real-goals-loadtime.mjs [runs] [path]
import { chromium } from "playwright";
const PORT = process.env.PORT ?? 3300, runs = Number(process.argv[2] ?? 3), path = process.argv[3] ?? "";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const rows = [];
for (let i = 0; i < runs; i++) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  if (process.env.BLOCK) await p.route(/file=league-/, (r) => r.abort());
  const cdp = await ctx.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  let bytes = 0; p.on("response", async (r) => { if (r.url().includes("real-moments")) { try { bytes += (await r.body()).length; } catch { /* */ } } });
  const t0 = Date.now();
  await p.goto(`http://localhost:${PORT}/star-real-goals-dev${path}`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("[data-path-home], [data-path]", { timeout: 120000 }); const tHome = Date.now() - t0;
  await p.waitForSelector('[data-daily]:not([data-daily="loading"]), [data-path] [data-level-map] [data-level]', { timeout: 120000 }); const tDaily = Date.now() - t0;
  await p.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 120000 }); const tAll = Date.now() - t0;
  // How long a tap takes to answer once loaded (main thread busy?).
  const lag = await p.evaluate(() => new Promise((res) => { const s = performance.now(); setTimeout(() => res(performance.now() - s), 0); }));
  rows.push({ tHome, tDaily, tAll, kb: Math.round(bytes / 1024), lag: Math.round(lag) });
  await ctx.close();
}
console.log(JSON.stringify(rows));
await b.close();
