// node deplate.mjs in.glb out.glb [debug.png]
// Finds the invented number plates (light, low-colour panels at either end of a car, centred,
// at bumper height, facing out) and paints their texels a plain dark grey, so no lettering shows.
import { createRequire } from "node:module";
const require = createRequire(process.env.GLTOOLS ? process.env.GLTOOLS + "/x.js" : import.meta.url);
const { NodeIO } = require("@gltf-transform/core");
const { ALL_EXTENSIONS } = require("@gltf-transform/extensions");
const sharp = require("sharp");
const [inp, out] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inp);
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
const P = prim.getAttribute("POSITION"), N = prim.getAttribute("NORMAL"), UV = prim.getAttribute("TEXCOORD_0"), I = prim.getIndices();
const tex = prim.getMaterial().getBaseColorTexture();
const img = sharp(Buffer.from(tex.getImage()));
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const TW = info.width, TH = info.height, C = info.channels;
const n = P.getCount(), lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], v = [];
for (let i = 0; i < n; i++) { P.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
const ext = hi.map((h, k) => h - lo[k]);
const L = ext[0] > ext[2] ? 0 : 2, Wd = L === 0 ? 2 : 0;
const tri = I.getCount() / 3;
const pos = (i) => P.getElement(i, []), uvOf = (i) => UV.getElement(i, []), nrm = (i) => (N ? N.getElement(i, []) : [0, 0, 0]);
const sample = (u, vv) => { const x = Math.min(TW - 1, Math.max(0, Math.floor(u * TW))), y = Math.min(TH - 1, Math.max(0, Math.floor(vv * TH))); const o = (y * TW + x) * C; return [data[o], data[o + 1], data[o + 2]]; };
const zoneOK = (c, nn) => {
  const endD = Math.min(c[L] - lo[L], hi[L] - c[L]) / ext[L];
  const midW = Math.abs(c[Wd] - (lo[Wd] + hi[Wd]) / 2) / ext[Wd];
  const hy = (c[1] - lo[1]) / ext[1];
  return endD < 0.08 && midW < 0.2 && hy > 0.12 && hy < 0.6 && Math.abs(nn[L]) > 0.45;
};
const cand = [];
for (let t = 0; t < tri; t++) {
  const ids = [I.getScalar(t * 3), I.getScalar(t * 3 + 1), I.getScalar(t * 3 + 2)];
  const ps = ids.map(pos), c = [0, 1, 2].map((k) => (ps[0][k] + ps[1][k] + ps[2][k]) / 3);
  const ns = ids.map(nrm), nn = [0, 1, 2].map((k) => ns[0][k] + ns[1][k] + ns[2][k]);
  const ln = Math.hypot(...nn) || 1; nn.forEach((_, k) => (nn[k] /= ln));
  if (!zoneOK(c, nn)) continue;
  const us = ids.map(uvOf), uc = [(us[0][0] + us[1][0] + us[2][0]) / 3, (us[0][1] + us[1][1] + us[2][1]) / 3];
  const [r, g, b] = sample(uc[0], uc[1]);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx > 175 && mx - mn < 40) {
    // lettering: a plate patch has dark marks right next to the white (chrome and paint do not)
    let dark = 0;
    for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) { const q = sample(uc[0] + dx / TW, uc[1] + dy / TH); if (Math.max(...q) < 70) dark++; }
    cand.push({ t, c, dark, end: c[L] - lo[L] < hi[L] - c[L] ? -1 : 1 });
  }
}
// each plate: the box round its light triangles at that end, a little bigger; paint every outward triangle in it
const painted = new Set();
for (const end of [-1, 1]) {
  const lettered = cand.filter((x) => x.end === end && x.dark >= 3);
  const cs = lettered.length >= 4 ? lettered : cand.filter((x) => x.end === end);
  if (cs.length < 4) continue;
  // a real plate's size round the middle of the light triangles (a 0.52 × 0.11 m plate on a ~4.3 m car)
  const med = [0, 1, 2].map((k) => { const s = cs.map((x) => x.c[k]).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; });
  const half = [0, 0, 0];
  half[L] = 0.035 * ext[L]; half[Wd] = 0.07 * ext[L]; half[1] = 0.02 * ext[L];
  const blo = med.map((m, k) => m - half[k]), bhi = med.map((m, k) => m + half[k]);
  const pad = 0;
  for (let t = 0; t < tri; t++) {
    const ids = [I.getScalar(t * 3), I.getScalar(t * 3 + 1), I.getScalar(t * 3 + 2)];
    const ps = ids.map(pos), c = [0, 1, 2].map((k) => (ps[0][k] + ps[1][k] + ps[2][k]) / 3);
    if ([0, 1, 2].every((k) => c[k] >= blo[k] - pad && c[k] <= bhi[k] + pad)) painted.add(t);
  }
}
// rasterise those triangles in UV space
const fill = [28, 28, 30];
let px = 0;
for (const t of painted) {
  const us = [0, 1, 2].map((j) => uvOf(I.getScalar(t * 3 + j))).map(([u, vv]) => [u * TW, vv * TH]);
  const x0 = Math.floor(Math.min(...us.map((p) => p[0]))) - 2, x1 = Math.ceil(Math.max(...us.map((p) => p[0]))) + 2;
  const y0 = Math.floor(Math.min(...us.map((p) => p[1]))) - 2, y1 = Math.ceil(Math.max(...us.map((p) => p[1]))) + 2;
  const [a, b, c] = us;
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-9) continue;
  for (let y = Math.max(0, y0); y <= Math.min(TH - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(TW - 1, x1); x++) {
    const p = [x + 0.5, y + 0.5];
    const w0 = ((b[0] - p[0]) * (c[1] - p[1]) - (c[0] - p[0]) * (b[1] - p[1])) / area;
    const w1 = ((c[0] - p[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (c[1] - p[1])) / area;
    const w2 = 1 - w0 - w1, e = -0.08; // a little past the edge, so no light seam stays
    if (w0 < e || w1 < e || w2 < e) continue;
    const o = (y * TW + x) * C; data[o] = fill[0]; data[o + 1] = fill[1]; data[o + 2] = fill[2]; px++;
  }
}
const isPng = tex.getMimeType() === "image/png";
const outImg = sharp(data, { raw: { width: TW, height: TH, channels: C } });
tex.setImage(new Uint8Array(await (isPng ? outImg.png() : outImg.jpeg({ quality: 90 })).toBuffer()));
await io.write(out, doc);
console.log(`${inp.split("/").pop()}: ${cand.length} light plate triangles, ${painted.size} painted, ${px} texels`);
