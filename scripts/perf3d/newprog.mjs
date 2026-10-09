// Which shaders a scene still builds on its FIRST frames (after its loading
// cover is gone), i.e. what its warm-up missed. Counts every program linked
// before and after the scene says it is ready. Speed job B, 9 Oct 2026.
//   node scripts/perf3d/newprog.mjs garden [port]
import { chromium } from "playwright";
const scene = process.argv[2] || "garden", port = process.argv[3] || "3512";
const b = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.addInitScript(() => {
  const links = (window.__links = []);
  for (const P of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    const lp = P.linkProgram, ss = P.shaderSource, ls = new WeakMap(), att = P.attachShader;
    P.shaderSource = function (sh, src) { ls.set(sh, src); return ss.call(this, sh, src); };
    P.attachShader = function (pr, sh) { const a = pr.__src || (pr.__src = []); a.push(ls.get(sh) || ""); return att.call(this, pr, sh); };
    P.linkProgram = function (pr) {
      const src = (pr.__src || []).join("\n");
      const name = (src.match(/#define SHADER_NAME (.*)/) || [])[1] || "?";
      const flags = ["USE_SKINNING", "USE_ENVMAP", "USE_SHADOWMAP", "TONE_MAPPING", "USE_MAP", "DEPTH_PACKING"].filter((f) => src.includes(`#define ${f}`)).join(",");
      links.push({ at: performance.now(), name, flags });
      return lp.call(this, pr);
    };
  }
});
await page.goto(`http://localhost:${port}/index.html?gov=0`);
const r = await page.evaluate(async (s) => {
  const M = window.__M; M.finish = false;
  const t0 = performance.now();
  await window.H[s]({});
  const ready = performance.now();
  while (!M.frames.some((f) => f.at >= M.ready)) await new Promise((r) => setTimeout(r, 16));
  const first = performance.now();
  await new Promise((r) => setTimeout(r, 2000));
  const L = window.__links;
  const after = L.filter((l) => l.at >= ready);
  const by = {};
  for (const l of after) { const k = `${l.name} [${l.flags}]`; by[k] = (by[k] || 0) + 1; }
  return { readyMs: Math.round(ready - t0), firstMs: Math.round(first - t0), linksBeforeReady: L.length - after.length, linksAfterReady: after.length, afterReady: by };
}, scene);
console.log(JSON.stringify(r, null, 1));
await b.close();
