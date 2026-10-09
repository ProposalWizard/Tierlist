// Do a scene's shader programs survive leaving and coming back? Counts the shared renderer's
// programs (renderer.info.programs) after the first open, after leaving, and after the revisit's
// first frame, and lists the cache keys the revisit built new. Lag pass 4, 9 Oct 2026.
//   node scripts/perf3d/progcache.mjs career [port]
import { chromium } from "playwright";
const scene = process.argv[2] || "career", port = process.argv[3] || "3502";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror", String(e).slice(0, 200)));
await page.goto(`http://localhost:${port}/index.html?gov=0`);
const r = await page.evaluate(async (s) => {
  const M = window.__M; M.finish = false;
  const keys = () => (M.renderer?.info.programs ?? []).map((p) => p.cacheKey);
  const open = async () => { M.frames.length = 0; M.ready = 0; const t = performance.now(); await window.H[s]({}); while (!M.frames.some((f) => f.at >= M.ready)) await new Promise((r) => setTimeout(r, 16)); return Math.round(performance.now() - t); };
  const first1 = await open();
  await new Promise((r) => setTimeout(r, 3000));
  const k1 = keys();
  window.H.dispose();
  await new Promise((r) => setTimeout(r, 500));
  const kLeft = keys();
  const first2 = await open();
  const k2 = keys();
  const old = new Set(kLeft);
  const fresh = k2.filter((k) => !old.has(k));
  // how a fresh key differs from the nearest old one (first differing chunk)
  const diff = fresh.slice(0, 6).map((k) => {
    let best = null, bestN = -1;
    for (const o of k1) { let n = 0; while (n < k.length && k[n] === o[n]) n++; if (n > bestN) { bestN = n; best = o; } }
    return { at: bestN, fresh: k.slice(Math.max(0, bestN - 40), bestN + 80), old: best?.slice(Math.max(0, bestN - 40), bestN + 80) };
  });
  return { first1, first2, afterOpen: k1.length, afterLeave: kLeft.length, afterRevisit: k2.length, fresh: fresh.length, diff };
}, scene);
console.log(JSON.stringify(r, null, 1));
await b.close();
