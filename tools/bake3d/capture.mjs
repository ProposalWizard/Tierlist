#!/usr/bin/env node
// tools/bake3d/capture.mjs — CAPTURE THE STILL PARTS OF A 3D SET, for baking its light in Blender.
//
// Opens a 3D screen in the phone browser, catches its three.js scene (three's own devtools hook), and writes
// every mesh that never moves — stands, roofs, walls, trees, the ground — as world-space triangles with a
// colour (its material colour × the average of its picture). People (skinned), the ball, glass, light
// shafts and the sky dome are left out: they do not block light the same way, or they move.
//
//   node tools/bake3d/capture.mjs <url> --out DIR/set.json [--wait "js expression"] [--skip name,name] [--settle 4000]
//
// Writes set.json (meshes: name, colour, triangle range) and set.bin (Float32 xyz per vertex, Uint32 indices).
import fs from "node:fs";
import path from "node:path";
import { openPhone, settle } from "../../scripts/look-tuner/browser.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const url = args[0];
const out = path.resolve(opt("out", "set.json"));
const skip = (opt("skip", "") || "").split(",").filter(Boolean);
const storage = opt("storage") ? JSON.parse(opt("storage")) : undefined;

const { browser, page } = await openPhone(url, {
  init: () => {
    // three.js announces every Scene and renderer it makes to a devtools hook, if one exists
    const seen = [];
    const hook = new EventTarget();
    hook.addEventListener("observe", (e) => { if (e.detail && e.detail.isScene) seen.push(e.detail); });
    window.__THREE_DEVTOOLS__ = hook;
    window.__bakeScenes = seen;
  },
  storage,
  waitFor: opt("wait", "window.__bakeScenes && window.__bakeScenes.length > 0"),
  settleMs: Number(opt("settle", "5000")),
  verbose: true,
});
await page.evaluate(async () => { if (window.__frameStep) await window.__frameStep.seek(0.2); });
await settle(page);

const dump = await page.evaluate((skipNames) => {
  const scenes = window.__bakeScenes;
  const count = (s) => { let n = 0; s.traverse((o) => { if (o.isMesh) n++; }); return n; };
  const scene = scenes.slice().sort((a, b) => count(b) - count(a))[0];
  scene.updateMatrixWorld(true);
  // people: everything under a top-level group that holds a skinned mesh
  const dynamic = new Set();
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    let r = o; while (r.parent && r.parent !== scene) r = r.parent;
    r.traverse((c) => dynamic.add(c));
  });
  const avgCache = new Map();
  const toLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const mapAverage = (tex) => {
    if (!tex || !tex.image) return null;
    if (avgCache.has(tex.image)) return avgCache.get(tex.image);
    let res = null;
    try {
      const im = tex.image;
      const c = document.createElement("canvas"); c.width = c.height = 8;
      const g = c.getContext("2d");
      if (im.data && im.width) { res = null; } else { g.drawImage(im, 0, 0, 8, 8); const d = g.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 30) continue; r += toLin(d[i] / 255); gg += toLin(d[i + 1] / 255); b += toLin(d[i + 2] / 255); n++; } if (n) res = [r / n, gg / n, b / n]; }
    } catch { res = null; }
    avgCache.set(tex.image, res);
    return res;
  };
  const meshes = [];
  const pos = [];
  const idx = [];
  const v = { x: 0, y: 0, z: 0 };
  const apply = (m, x, y, z) => { const e = m.elements; const w = e[3] * x + e[7] * y + e[11] * z + e[15] || 1; v.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) / w; v.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) / w; v.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) / w; };
  const mul = (a, b) => { const ae = a.elements, be = b.elements, out = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += ae[i + k * 4] * be[k + j * 4]; out[i + j * 4] = s; } return { elements: out }; };
  const skipped = [];
  scene.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || dynamic.has(o)) return;
    let vis = true; for (let p = o; p; p = p.parent) if (p.visible === false) vis = false;
    if (!vis) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    const name = o.name || o.parent?.name || "";
    const g = o.geometry;
    if (!g || !g.attributes.position) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const why = mat.isShaderMaterial ? "shader" : (mat.transparent && (mat.opacity < 0.5 || mat.blending === 2 || mat.alphaMap || mat.alphaTest > 0)) ? "see-through" : g.boundingSphere.radius > 300 || mat.side === 1 ? "sky-size" : g.boundingSphere.radius < 0.16 && !o.isInstancedMesh ? "tiny" : skipNames.some((s) => name.includes(s)) ? "named" : null;
    if (why) { skipped.push(`${name || o.type}:${why}`); return; }
    const col = mat.color ? [mat.color.r, mat.color.g, mat.color.b] : [0.5, 0.5, 0.5];
    const avg = mapAverage(mat.map);
    const alb = avg ? [col[0] * avg[0], col[1] * avg[1], col[2] * avg[2]] : col;
    const pa = g.attributes.position;
    const ix = g.index ? g.index.array : null;
    const nTri = ix ? ix.length / 3 : pa.count / 3;
    const insts = o.isInstancedMesh ? o.count : 1;
    const first = idx.length / 3;
    for (let k = 0; k < insts; k++) {
      let M = o.matrixWorld;
      if (o.isInstancedMesh) { const im = { elements: Array.from(o.instanceMatrix.array.slice(k * 16, k * 16 + 16)) }; M = mul(o.matrixWorld, im); }
      const base = pos.length / 3;
      for (let i = 0; i < pa.count; i++) { apply(M, pa.getX(i), pa.getY(i), pa.getZ(i)); pos.push(v.x, v.y, v.z); }
      for (let t = 0; t < nTri * 3; t++) idx.push(base + (ix ? ix[t] : t));
    }
    meshes.push({ name, type: o.type, albedo: alb.map((x) => +x.toFixed(4)), firstTri: first, triCount: idx.length / 3 - first, side: mat.side ?? 0, emissive: mat.isMeshBasicMaterial ? 1 : 0 });
  });
  const b64 = (arr) => { const u8 = new Uint8Array(arr.buffer); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  return { meshes, skipped, nVert: pos.length / 3, nTri: idx.length / 3, pos: b64(new Float32Array(pos)), idx: b64(new Uint32Array(idx)) };
}, skip);

const posBuf = Buffer.from(dump.pos, "base64"), idxBuf = Buffer.from(dump.idx, "base64");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out.replace(/\.json$/, ".bin"), Buffer.concat([posBuf, idxBuf]));
fs.writeFileSync(out, JSON.stringify({ url, nVert: dump.nVert, nTri: dump.nTri, meshes: dump.meshes, skipped: dump.skipped }, null, 1));
console.log(`captured ${dump.meshes.length} meshes, ${dump.nVert} vertices, ${dump.nTri} triangles -> ${out}`);
console.log(`left out: ${[...new Set(dump.skipped)].slice(0, 40).join(", ")}`);
await browser.close();
