#!/usr/bin/env node
// scripts/look-tuner/probe.mjs — dev probe: list which materials carry the baked light, and the bake's uniforms.
//   node scripts/look-tuner/probe.mjs <url> [--wait "js"]
import { openPhone } from "./browser.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const { browser, page } = await openPhone(args[0], {
  init: () => { const seen = []; const hook = new EventTarget(); hook.addEventListener("observe", (e) => { if (e.detail && e.detail.isScene) seen.push(e.detail); }); window.__THREE_DEVTOOLS__ = hook; window.__bakeScenes = seen; },
  waitFor: opt("wait", "window.__bakeScenes && window.__bakeScenes.length > 0"), settleMs: 12000, dsf: 1,
});
const res = await page.evaluate(() => {
  const out = [];
  for (const sc of window.__bakeScenes) {
    sc.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      out.push({ name: o.name || o.parent?.name, type: m.type, bake: !!m.userData.bakeOn });
    });
  }
  const byKey = {};
  for (const r of out) { const k = `${r.name}|${r.type}|${r.bake}`; byKey[k] = (byKey[k] || 0) + 1; }
  // one patched material's program uniforms
  let uni = null;
  for (const sc of window.__bakeScenes) sc.traverse((o) => { const m = o.material; if (!uni && m && m.userData && m.userData.bakeOn) uni = m; });
  let u = null;
  if (uni) {
    const U = uni.userData.bakeU; const st = (img) => { if (!img) return null; const d = img.data; let s = [0, 0, 0, 0], n = d.length / 4; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 4; k++) s[k] += d[i + k]; return { w: img.width, h: img.height, depth: img.depth, mean: s.map((x) => +(x / n).toFixed(1)), mid: Array.from(d.slice((d.length >> 3) * 4 >> 2 << 2, ((d.length >> 3) * 4 >> 2 << 2) + 8)) }; };
    u = Object.fromEntries(Object.entries(U).map(([k, v]) => [k, v.value && v.value.isTexture ? st(v.value.image) : v.value && v.value.toArray ? v.value.toArray() : v.value]));
  }
  return { byKey, scenes: window.__bakeScenes.length, u };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
