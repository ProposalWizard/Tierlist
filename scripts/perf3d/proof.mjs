// Same-page before/after for one scene: the same camera spot, the shadow cache
// (and shadow bodies) off then on, a still and the frame counters for each.
// Usage: node scripts/perf3d/proof.mjs <garden|shop|career|cut> '<json opts>' --out=DIR [--dpr=2]
// Reads window.__frame3d* (lib/star/three3d/frameStats.ts) and window.__shadowCache.
import { chromium } from "playwright";
import fs from "node:fs";
const args = process.argv.slice(2);
const flag = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const scene = args[0] || "garden";
const opts = args[1] && !args[1].startsWith("--") ? JSON.parse(args[1]) : {};
const out = flag("out", "/tmp");
const dpr = +flag("dpr", "2");
const settleMs = +flag("settle", "8000");
const holdMs = +flag("hold", "5000");
fs.mkdirSync(out, { recursive: true });

const split = args.includes("--split");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--js-flags=--max-old-space-size=1024"] });
const errs = [];
let page = null;
// --split: "before" is its own page with every saving off from the start (?shadowcache=0&shadowbody=0&lightreach=0),
// for savings that are built into the shaders (lights only where they reach); else one page, switched live.
async function open(off) {
  if (page) await page.context().close();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
  page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:3502/index.html?gov=0${off ? "&shadowcache=0&shadowbody=0&lightreach=0" : ""}`);
  await page.evaluate(([s, o]) => { window.__run = window.H[s](o).catch((e) => { window.__err = String(e); }); }, [scene, opts]);
  await page.waitForFunction(() => window.__err || window.__M.ready, null, { timeout: 300000 });
  if (await page.evaluate(() => window.__err)) { console.log(JSON.stringify({ scene, err: await page.evaluate(() => window.__err), errs })); process.exit(1); }
  await page.waitForTimeout(settleMs);
  // --act=JS: run after settling (place him, fix the camera, hold the stick)
  if (flag("act", "")) { await page.evaluate(flag("act", "")); await page.waitForTimeout(+flag("actwait", "6000")); }
  // shadow triangles: count them in the shadow targets only
  await page.evaluate(() => {
    const g = window.__M.renderer.getContext();
    const P = Object.getPrototypeOf(g);
    if (P.__st) return; P.__st = true;
    const bf = P.bindFramebuffer, de = P.drawElements, da = P.drawArrays;
    let fb = null; window.__shadowTris = 0; window.__rafN = 0; let v3; Object.defineProperty(window, "__frame3d", { configurable: true, get() { return v3; }, set(v) { v3 = v; window.__rafN++; } });
    const isShadow = (gl) => { const v = gl.getParameter(gl.VIEWPORT); return v[2] === v[3] && v[2] >= 128 && (v[2] & (v[2] - 1)) === 0 && fb; };
    P.bindFramebuffer = function (t, f) { if (t === 0x8d40 || t === 0x8ca9) fb = f; return bf.call(this, t, f); };
    P.drawElements = function (m, c, t, o) { if (m === 4 && isShadow(this)) window.__shadowTris += c / 3; return de.call(this, m, c, t, o); };
    P.drawArrays = function (m, f, c) { if (m === 4 && isShadow(this)) window.__shadowTris += c / 3; return da.call(this, m, f, c); };
  });
}
const measure = (since) => page.evaluate((since) => {
  const all = window.__frame3dAll ? window.__frame3dAll() : [];
  const last = all.filter((f) => f.t >= since);
  // the mean over the frames since the switch (the real game redraws its shadow every other frame on Medium)
  const med = (k) => last.length ? +(last.reduce((a, f) => a + f[k], 0) / last.length).toFixed(1) : null;
  const M = window.__M; const r = M.renderer;
  // GPU texture memory: every texture the renderer holds, by its real size (compressed = its own bytes)
  const seen = new Set(); let bytes = 0;
  const add = (t) => { if (!t || !t.isTexture || seen.has(t)) return; seen.add(t);
    const im = t.image; let w = 0, h = 0;
    if (t.isCubeTexture && Array.isArray(im)) { w = im[0]?.width || 0; h = (im[0]?.height || 0) * 6; } else if (im) { w = im.width || 0; h = im.height || 0; }
    if (t.isCompressedTexture && t.mipmaps?.length) { for (const m of t.mipmaps) bytes += m.data?.byteLength || 0; return; }
    const bpp = t.type === 1016 ? 8 : t.type === 1015 ? 16 : 4;
    bytes += w * h * bpp * (t.generateMipmaps !== false ? 1.33 : 1); };
  M.scene?.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) { for (const k in m) { const v = m[k]; if (v && v.isTexture) add(v); } if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) add(u.value); } });
  add(M.scene?.environment);
  const sc = window.__shadowCache ? { ...window.__shadowCache } : null;
  return { frames: last.length, draws: med("draws"), tris: Math.round(med("tris")), shadowDraws: med("shadowDraws"), skinned: med("skinnedDraws"), posts: med("posts"), pr: med("pixelRatio"),
    texMB: +(bytes / 1048576).toFixed(1), gpuTextures: r?.info?.memory?.textures, cache: sc };
}, since);
const result = { scene, opts, dpr, split };
if (!split) await open(false);
for (const mode of ["before", "after"]) {
  if (split) await open(mode === "before");
  else await page.evaluate((m) => { window.__shadowCacheOff = m === "before"; window.__shadowBodyOff = m === "before"; }, mode);
  await page.waitForTimeout(holdMs);
  const since = await page.evaluate(() => performance.now());
  const fr0 = await page.evaluate(() => [window.__shadowTris, window.__rafN]);
  await page.waitForTimeout(+flag("window", "8000"));
  const fr1 = await page.evaluate(() => [window.__shadowTris, window.__rafN]);
  const m = await measure(since);
  const nf = Math.max(1, fr1[1] - fr0[1]);
  m.shadowTrisPerFrame = Math.round((fr1[0] - fr0[0]) / nf);
  m.savings = await page.evaluate(() => window.__sceneSavings ?? null);
  const shot = `${out}/${scene}${opts.tag ? "-" + opts.tag : ""}-${mode}.png`;
  await page.screenshot({ path: shot, timeout: 240000 });
  m.still = shot;
  result[mode] = m;
}
result.errs = errs.slice(0, 5);
console.log(JSON.stringify(result));
await browser.close();
