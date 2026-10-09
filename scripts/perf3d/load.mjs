// How long each 3D place takes to open (speed job B, 9 Oct 2026: "loading
// times eradicated"). Runs the REAL scene modules in the harness page, on a
// phone-sized screen, with Chrome's own "Fast 4G" network and the page's
// thread slowed 4x, and reports for each place:
//   cold    — first visit ever: nothing cached
//   warm    — a later day: a new page load, the browser's HTTP cache kept
//   revisit — the same session: leave the place and open it again
//   preload — the same as cold, but Home's idle preload ran first (H.preload)
// Each number is ms from "open" to the first picture on screen (first), to
// the place taking input (ready), the bytes and the requests it needed
// (304s counted as requests: on Fast 4G each one costs a round trip).
//
//   node scripts/perf3d/build.mjs
//   node scripts/perf3d/serve.mjs --cache=vercel &
//   node scripts/perf3d/load.mjs garden,shop,casino,office,career,cut,home,drill,toon [--runs=cold,warm,revisit,preload]
//
// SwiftShader draws here (no graphics chip): the CPU half of a load is real,
// the GPU half (shader compile, uploads) is many times a phone's. Compare
// before and after on this machine, not with a phone.
import { chromium } from "playwright";
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const scenes = (args[0] && !args[0].startsWith("--") ? args[0] : "garden").split(",");
const runs = flag("runs", "cold,warm,revisit").split(",");
const port = flag("port", "3502");
const q = flag("q", "");
const FAST4G = { offline: false, latency: 165, downloadThroughput: (9e6 / 8) * 0.9, uploadThroughput: (1.5e6 / 8) * 0.9 };

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--js-flags=--max-old-space-size=1024"] });

async function newPage(ctx) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", FAST4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const net = { bytes: 0, reqs: 0, r304: 0 };
  cdp.on("Network.loadingFinished", (e) => { net.bytes += e.encodedDataLength; });
  cdp.on("Network.responseReceived", (e) => { if (!/\/star\/|\/shop\//.test(e.response.url)) return; net.reqs++; if (e.response.status === 304) net.r304++; });
  page.on("pageerror", (e) => console.error("pageerror", String(e).slice(0, 200)));
  await page.goto(`http://localhost:${port}/index.html?gov=0${q}`);
  return { page, net };
}

async function enter(page, net, scene) {
  const n0 = { ...net };
  const r = await page.evaluate(async (s) => {
    const M = window.__M;
    M.frames.length = 0; M.ready = 0;
    const t = performance.now();
    try { await window.H[s]({}); } catch (e) { return { err: String(e) }; }
    const ready = M.ready - t;
    // the first picture shown: the first frame drawn at or after ready (the warm-up's 1-pixel draw doesn't count)
    const t1 = performance.now();
    while (!M.frames.some((f) => f.at >= M.ready) && performance.now() - t1 < 60000) await new Promise((r) => setTimeout(r, 16));
    const f = M.frames.find((x) => x.at >= M.ready);
    return { ready: Math.round(ready), first: f ? Math.round(f.at + f.cpu - t) : null };
  }, scene);
  r.kb = Math.round((net.bytes - n0.bytes) / 1024);
  r.reqs = net.reqs - n0.reqs;
  r.r304 = net.r304 - n0.r304;
  return r;
}

const out = [];
for (const scene of scenes) {
  const row = { scene };
  for (const run of runs) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    let { page, net } = await newPage(ctx);
    if (run === "warm") {
      await enter(page, net, scene); await page.evaluate(() => window.H.dispose());
      await page.close();
      ({ page, net } = await newPage(ctx));
    } else if (run === "revisit") {
      await enter(page, net, scene); await page.evaluate(() => window.H.dispose());
      await page.waitForTimeout(500);
    } else if (run === "preload") {
      await page.evaluate((s) => window.H.preload?.(s), scene);
      await page.waitForFunction(() => window.__preloadDone === true, null, { timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    row[run] = await enter(page, net, scene);
    await page.evaluate(() => window.H.dispose()).catch(() => {});
    await ctx.close();
    console.error(scene, run, JSON.stringify(row[run]));
  }
  out.push(row);
}
console.log(JSON.stringify(out));
await browser.close();
