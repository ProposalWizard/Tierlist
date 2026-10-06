// Usage: node drive.mjs <scene> [json-opts] [--throttle=4] [--dpr=3] [--exp=name] [--steady=4000]
import { chromium } from "playwright";
import fs from "node:fs";
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.split("=")[1] : d; };
const scene = args[0] || "garden";
const opts = args[1] && !args[1].startsWith("--") ? JSON.parse(args[1]) : {};
const throttle = +flag("throttle", "4");
const dpr = +flag("dpr", "3");
const exp = flag("exp", "");
const steadyMs = +flag("steady", "4000");
const settle = +flag("settle", "1500");
const page_ = flag("page", "index.html");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:3502/${page_}`);
const cdp = await ctx.newCDPSession(page);
if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
if (exp) {
  const code = fs.readFileSync(new URL(`./exp/${exp}.js`, import.meta.url), "utf8");
  await page.evaluate(code);
}
if (args.includes("--nofinish")) await page.evaluate(() => { window.__M.finish = false; });
const t = Date.now();
await page.evaluate(([s, o]) => { window.__run = window.H[s](o).catch((e) => { window.__err = String(e); }); }, [scene, opts]);
await page.waitForFunction(() => window.__err || (window.__M.frames.length > 0 && window.__M.ready), null, { timeout: 240000 });
await page.waitForFunction((a) => { const f = window.__M.frames; if (!f.length) return false; const e = f[0].at + f[0].cpu; return performance.now() - e > a[1] + a[0] && f.filter((x) => x.at > e + a[1]).length >= 4; }, [steadyMs, settle], { timeout: 240000, polling: 500 });
if (exp && flag("act", "")) await page.evaluate(flag("act", ""));
const res = await page.evaluate(([steadyMs, settle]) => {
  const M = window.__M; if (window.__err) return { err: window.__err };
  const f = M.frames, f0 = f[0].at, f0e = f[0].at + f[0].cpu;
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
  const first = f.filter((x) => x.at <= f0e + 1000);
  const gaps = (arr) => arr.slice(1).map((x, i) => x.at - arr[i].at);
  const steady = f.filter((x) => x.at >= f0e + settle).slice(0, 400);
  const lt = M.longtasks;
  const ltEntry = lt.filter((x) => x.at >= M.t0 && x.at <= f0e + 1000);
  const r = M.renderer; const last = f[f.length - 1];
  // texture bytes (unique)
  const seen = new Set(); let texBytes = 0; let texN = 0;
  const addTex = (t) => { if (!t || !t.isTexture || seen.has(t)) return; seen.add(t); texN++;
    const im = t.image; let w = 0, h = 0;
    if (t.isCubeTexture && Array.isArray(im)) { w = (im[0]?.width||0); h = (im[0]?.height||0) * 6; }
    else if (im) { w = im.width || im.videoWidth || 0; h = im.height || im.videoHeight || 0; }
    const bpp = t.isCompressedTexture ? 1 : (t.type === 1016 || t.type === 1015 ? 8 : 4);
    texBytes += w * h * bpp * (t.generateMipmaps !== false || (t.mipmaps && t.mipmaps.length) ? 1.33 : 1); };
  M.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) for (const k in m) { const v = m[k]; if (v && v.isTexture) addTex(v); }
    if (o.material?.uniforms) for (const u of Object.values(o.material.uniforms)) if (u?.value?.isTexture) addTex(u.value); });
  addTex(M.scene.environment); addTex(M.scene.background);
  let meshes = 0, skinned = 0, shadowCasters = 0;
  M.scene.traverse((o) => { if (o.isMesh) { meshes++; if (o.isSkinnedMesh) skinned++; if (o.castShadow) shadowCasters++; } });
  const res = performance.getEntriesByType("resource");
  const dl = {}; let dlTotal = 0;
  for (const e of res) { if (e.name.includes("bundle.js")) continue; const ext = (e.name.split("?")[0].split(".").pop()); dl[ext] = (dl[ext] || 0) + e.encodedBodySize; dlTotal += e.encodedBodySize; }
  return {
    entryMs: Math.round(f0e - M.t0), firstFrameMs: Math.round(f[0].cpu), readyMs: Math.round(M.ready - M.t0),
    firstSec: { frames: first.length, maxGap: Math.round(Math.max(0, ...gaps(first))), maxCpu: Math.round(Math.max(...first.map((x) => x.cpu))) },
    entryLongTasks: { n: ltEntry.length, totalMs: Math.round(ltEntry.reduce((a, x) => a + x.d, 0)), maxMs: Math.round(Math.max(0, ...ltEntry.map((x) => x.d))) },
    steady: { frames: steady.length, msPerFrame: steady.length > 1 ? Math.round((steady[steady.length-1].at - steady[0].at) / (steady.length - 1)) : null, cpuMed: +q(steady.map((x) => x.cpu), 0.5).toFixed(1), cpuP95: +q(steady.map((x) => x.cpu), 0.95).toFixed(1), gapMed: +q(gaps(steady), 0.5).toFixed(1), gapP95: +q(gaps(steady), 0.95).toFixed(1) },
    calls: last.calls, tris: last.tris, programs: r.info.programs?.length, geometries: r.info.memory.geometries, textures: r.info.memory.textures,
    texN, texMB: +(texBytes / 1048576).toFixed(1), meshes, skinned, shadowCasters, shadows: r.shadowMap.enabled,
    canvas: `${r.domElement.width}x${r.domElement.height}`, pr: r.getPixelRatio(),
    dlKB: Math.round(dlTotal / 1024), dl: Object.fromEntries(Object.entries(dl).map(([k, v]) => [k, Math.round(v / 1024)])),
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, extra: M.extra, tagged: steady.filter((x) => x.tag).map((x) => [x.tag, Math.round(x.cpu), x.calls]),
  };
}, [steadyMs, settle]);
console.log(JSON.stringify({ scene, opts, throttle, dpr, exp, nofinish: args.includes("--nofinish"), wallS: ((Date.now() - t) / 1000).toFixed(0), ...res, errs: errs.slice(0, 5) }));
const shot = flag("shot", ""); if (shot) await page.screenshot({ path: shot });
await browser.close();
