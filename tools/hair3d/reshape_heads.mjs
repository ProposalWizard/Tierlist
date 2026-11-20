#!/usr/bin/env node
/**
 * NEW HEAD SHAPES for the Style A people (Harry, 20 Nov 2026: "try and model new head shapes").
 * A hair head (toon-p3 Buzz & beard, toon-mgr2 Fade & beard) is re-shaped as a mesh: every head
 * vertex moves by one smooth rule, the skull above the ears and the back of the head are left as
 * they are (so the modelled hair, tools/hair3d/build_hair.py, still fits), and the skeleton, the bone
 * weights, the picture, the kit/skin/hair mask and the UVs are kept: the eyes, brows, mouth, blinks,
 * kit and skin tones work as on the head it came from. The face's measured spots move by the same
 * rule (printed as the head's line for lib/star/style3d/toon/faceLandmarks.ts).
 *
 *   h7 Broad jaw     a wider, squarer jaw and chin
 *   h8 Long face     the face 14 mm longer from chin to brow (the skull lifted with it), narrower cheeks
 *   h9 Round face    fuller cheeks, a softer wider jaw, a shorter chin
 *   m3 Older, lined  the suit head: hollower cheeks, jowls, a heavier brow, and lines painted into the
 *                    picture (forehead, between the brows, crow's feet, under the eyes, nose to mouth)
 *
 *   node tools/hair3d/reshape_heads.mjs --tools=<dir with @gltf-transform, meshoptimizer, sharp> [h7 h8 h9 m3]
 *   node scripts/perf3d/shrink-models.mjs star/people3d/toon-p7.glb star/people3d/toon-p8.glb star/people3d/toon-p9.glb star/people3d/toon-mgr3.glb
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const ROOT = new URL("../../", import.meta.url).pathname;
const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const want = args.filter((a) => !a.startsWith("--"));
const req = createRequire(path.join(path.resolve(opt("tools") ?? process.env.SHRINK_TOOLS ?? ROOT), "noop.js"));
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { MeshoptDecoder, MeshoptEncoder } = req("meshoptimizer");
const sharp = req("sharp");
await MeshoptDecoder.ready; await MeshoptEncoder.ready;

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const gauss = (p, c, s) => Math.exp(-((p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2) / (2 * s * s));

/** The face's measured spots on the two hair heads (faceLandmarks.ts h3, m2) and their file's own face. */
const BASE = {
  h3: { file: "toon-p3", lm: {"eyes":[[-0.0515,1.6776,0.0176,0.0098],[0.0439,1.6776,0.0193,0.0098]],"iris":[[-0.0504,1.6799,0.0098],[0.0424,1.6799,0.0103]],"eyeZ":0.1458,"browY":1.7064,"nose":[-0.006,1.622,0.1931],"mouth":[-0.0001,1.5809,0.0325,0.1734],"chinY":1.5209,"colors":{"white":"#ddd5cf","lid":"#7b472d","lash":"#35231c"}} },
  m2: { file: "toon-mgr2", lm: {"eyes":[[-0.0485,1.6614,0.0189,0.0086],[0.0476,1.6612,0.019,0.0092]],"iris":[[-0.0476,1.6617,0.0097],[0.0456,1.6615,0.0103]],"eyeZ":0.1631,"browY":1.693,"nose":[-0.002,1.6126,0.213],"mouth":[0.0001,1.5837,0.0325,0.1953],"chinY":1.5487,"colors":{"white":"#c1bbb0","lid":"#8c4f32","lash":"#301d12"}} },
};

/** Each shape: the rule a rest-pose point (metres, his left +x, up +y, front +z) moves by. `F`: the base's face. */
const SHAPES = {
  h7: { base: "h3", out: "toon-p7", f: (p, F) => {
    const [x, y, z] = p;
    const w = sm(F.eyeY + 0.005, F.eyeY - 0.09, y) * sm(F.chinY - 0.042, F.chinY - 0.006, y) * sm(-0.03, 0.045, z);
    const corner = w * sm(0.03, 0.075, Math.abs(x)) * Math.exp(-(((y - (F.chinY + 0.032)) / 0.03) ** 2));
    const chin = w * sm(0.05, 0.0, Math.abs(x)) * sm(F.mouthY - 0.012, F.chinY, y);
    return [x * (1 + 0.13 * w), y - 0.007 * corner - 0.002 * chin, z + 0.004 * chin];
  } },
  h8: { base: "h3", out: "toon-p8", lift: 0.014, f: (p, F) => {
    const [x, y, z] = p;
    const back = sm(F.eyeY - 0.118, F.eyeY - 0.088, y), front = sm(F.chinY + 0.004, F.browY - 0.004, y);
    const r = mix(back, front, sm(0.0, 0.06, z));
    const narrow = sm(F.chinY - 0.03, F.chinY + 0.02, y) * sm(F.browY, F.eyeY - 0.03, y) * sm(-0.01, 0.05, z);
    return [x * (1 - 0.07 * narrow), y + 0.014 * r, z];
  } },
  h9: { base: "h3", out: "toon-p9", f: (p, F) => {
    let [x, y, z] = p;
    const s = Math.sign(x) || 1;
    const w = sm(F.eyeY - 0.012, F.eyeY - 0.078, y) * sm(F.chinY - 0.042, F.chinY - 0.006, y) * sm(-0.03, 0.045, z);
    const cheek = gauss([Math.abs(x), y, z], [0.062, F.mouthY + 0.026, F.noseZ - 0.085], 0.036);
    const chin = Math.exp(-(((y - F.chinY) / 0.022) ** 2)) * sm(0.04, 0.1, z) * sm(0.07, 0.02, Math.abs(x));
    x = x * (1 + 0.05 * w) + s * 0.0075 * cheek;
    return [x, y + 0.0065 * chin - 0.002 * cheek, z + 0.006 * cheek - 0.003 * chin];
  } },
  m3: { base: "m2", out: "toon-mgr3", lines: true, f: (p, F) => {
    let [x, y, z] = p;
    const s = Math.sign(x) || 1, ax = Math.abs(x);
    const hollow = gauss([ax, y, z], [0.06, F.mouthY + 0.034, F.noseZ - 0.085], 0.027);
    const jowl = gauss([ax, y, z], [0.052, F.lmChinY + 0.012, F.noseZ - 0.1], 0.026);
    const nose = gauss([x, y, z], [F.noseX, F.noseY, F.noseZ], 0.02);
    const brow = gauss([ax, y, z], [0.045, F.browY - 0.004, F.eyeZ + 0.012], 0.013);
    x += s * (-0.0038 * hollow + 0.0042 * jowl);
    y += -0.0045 * jowl - 0.002 * nose - 0.0015 * brow * sm(F.browY + 0.012, F.browY, y);
    z += -0.0042 * hollow + 0.002 * jowl + 0.003 * nose + 0.002 * brow * sm(F.browY + 0.012, F.browY, y);
    return [x, y, z];
  } },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });
const lmOut = {};
for (const id of want.length ? want : Object.keys(SHAPES)) {
  const sh = SHAPES[id], B = BASE[sh.base];
  const doc = await io.read(path.join(ROOT, "public/star/people3d", `${B.file}.glb`));
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const ex = structuredClone(scene.getExtras());
  const q = ex.quant;
  const body = root.listNodes().find((n) => n.getName() === "Body");
  const prim = body.getMesh().listPrimitives()[0];
  const aP = prim.getAttribute("POSITION"), aN = prim.getAttribute("NORMAL"), aU = prim.getAttribute("TEXCOORD_0");
  const n = aP.getCount();
  const lm = B.lm;
  const F = { eyeY: ex.face.eyeY, browY: ex.face.browY, chinY: ex.face.chinY, mouthY: lm.mouth[1], noseX: lm.nose[0], noseY: lm.nose[1], noseZ: lm.nose[2], eyeZ: lm.eyeZ, lmChinY: lm.chinY };
  // only the head moves: nothing below the collar, fading in over the neck
  const lo = ex.kit.collarY - 0.005;
  const f = (p) => { const k = sm(lo, lo + 0.03, p[1]); if (k <= 0) return p; const o = sh.f(p, F); return [mix(p[0], o[0], k), mix(p[1], o[1], k), mix(p[2], o[2], k)]; };
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2);
  let moved = 0, most = 0;
  for (let i = 0; i < n; i++) {
    const e = aP.getElement(i, []), nn = aN.getElement(i, []), u = aU.getElement(i, []);
    const p = [e[0] * q.scale + q.offset[0], e[1] * q.scale + q.offset[1], e[2] * q.scale + q.offset[2]];
    const o = f(p);
    const d = Math.hypot(o[0] - p[0], o[1] - p[1], o[2] - p[2]);
    if (d > 1e-5) moved++;
    most = Math.max(most, d);
    P.set(o, i * 3);
    // the normal: through the rule's own slopes (two tangents, moved, crossed)
    const l = Math.hypot(...nn) || 1; const nv = nn.map((v) => v / l);
    const t1 = Math.abs(nv[1]) < 0.9 ? [nv[2], 0, -nv[0]] : [0, nv[2], -nv[1]];
    const t1l = Math.hypot(...t1); t1.forEach((v, k) => (t1[k] = v / t1l));
    const t2 = [nv[1] * t1[2] - nv[2] * t1[1], nv[2] * t1[0] - nv[0] * t1[2], nv[0] * t1[1] - nv[1] * t1[0]];
    const E = 2e-4;
    const a = f([p[0] + t1[0] * E, p[1] + t1[1] * E, p[2] + t1[2] * E]).map((v, k) => v - o[k]);
    const b = f([p[0] + t2[0] * E, p[1] + t2[1] * E, p[2] + t2[2] * E]).map((v, k) => v - o[k]);
    let c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const cl = Math.hypot(...c) || 1; c = c.map((v) => v / cl);
    if (c[0] * nv[0] + c[1] * nv[1] + c[2] * nv[2] < 0) c = c.map((v) => -v);
    N.set(d > 1e-5 ? c : nv, i * 3);
    UV.set([u[0], u[1]], i * 2);
  }
  aP.setArray(P).setNormalized(false);
  aN.setArray(N).setNormalized(false);
  aU.setArray(UV).setNormalized(false);
  for (const sem of ["WEIGHTS_0"]) {
    const a = prim.getAttribute(sem);
    if (a && a.getNormalized()) { const W = new Float32Array(n * 4); for (let i = 0; i < n; i++) W.set(a.getElement(i, []), i * 4); a.setArray(W).setNormalized(false); }
  }
  // the packed file's bind matrices carry its own 16-bit packing (people3d.ts dequantize takes it out
  // again at load); the positions are metres now, so the matrices go back to metres too, and the
  // next packing (shrink-models.mjs) writes its own
  const ibm = body.getSkin().getInverseBindMatrices();
  const IB = new Float32Array(ibm.getCount() * 16);
  for (let k = 0; k < ibm.getCount(); k++) {
    const m = ibm.getElement(k, []);
    const o = q.offset, s = q.scale;
    const c3 = [0, 1, 2, 3].map((r) => m[12 + r] - (m[r] * o[0] + m[4 + r] * o[1] + m[8 + r] * o[2]) / s);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 4; r++) IB[k * 16 + c * 4 + r] = m[c * 4 + r] / s;
    IB.set(c3, k * 16 + 12);
  }
  ibm.setArray(IB);
  for (const e of root.listExtensionsUsed()) if (["EXT_meshopt_compression", "KHR_mesh_quantization"].includes(e.extensionName)) e.dispose();

  // the face's spots, moved by the same rule
  const pt = (x, y, z) => f([x, y, z]);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const eyes = lm.eyes.map(([x, y, hw, hh]) => { const c = pt(x, y, lm.eyeZ), a = pt(x - hw, y, lm.eyeZ), b = pt(x + hw, y, lm.eyeZ), u = pt(x, y + hh, lm.eyeZ), d = pt(x, y - hh, lm.eyeZ); return [r4(c[0]), r4(c[1]), r4((b[0] - a[0]) / 2), r4((u[1] - d[1]) / 2)]; });
  const iris = lm.iris.map(([x, y, r]) => { const c = pt(x, y, lm.eyeZ), a = pt(x - r, y, lm.eyeZ), b = pt(x + r, y, lm.eyeZ); return [r4(c[0]), r4(c[1]), r4((b[0] - a[0]) / 2)]; });
  const eyeZ = r4((pt(lm.iris[0][0], lm.iris[0][1], lm.eyeZ)[2] + pt(lm.iris[1][0], lm.iris[1][1], lm.eyeZ)[2]) / 2);
  const mo = pt(lm.mouth[0], lm.mouth[1], lm.mouth[3]), ma = pt(lm.mouth[0] - lm.mouth[2], lm.mouth[1], lm.mouth[3] - 0.01), mb = pt(lm.mouth[0] + lm.mouth[2], lm.mouth[1], lm.mouth[3] - 0.01);
  lmOut[id] = { eyes, iris, eyeZ, browY: r4(pt(0.045, lm.browY, lm.eyeZ + 0.01)[1]), nose: pt(...lm.nose).map(r4), mouth: [r4(mo[0]), r4(mo[1]), r4((mb[0] - ma[0]) / 2), r4(mo[2])], chinY: r4(pt(0, lm.chinY, lm.mouth[3] - 0.02)[1]), colors: lm.colors };
  ex.model = sh.out;
  delete ex.quant;
  const zF = ex.face.frontZ;
  ex.face = { chinY: r4(pt(0, ex.face.chinY, lm.mouth[3] - 0.03)[1]), eyeY: r4(pt(0.045, ex.face.eyeY, lm.eyeZ)[1]), browY: r4(pt(0.045, ex.face.browY, lm.eyeZ + 0.01)[1]), frontZ: r4(pt(lm.nose[0], lm.nose[1], zF)[2]) };
  if (sh.lift && ex.joints?.head_end) ex.joints.head_end = [ex.joints.head_end[0], r4(ex.joints.head_end[1] + sh.lift), ex.joints.head_end[2]];
  scene.setExtras(ex);

  if (sh.lines) await paintLines(prim, P, UV, lmOut[id]);
  const out = path.join(ROOT, "public/star/people3d", `${sh.out}.glb`);
  await io.write(out, doc);
  console.log(`${id}: ${B.file} → ${sh.out}.glb  ${moved} of ${n} vertices moved, the most ${(most * 1000).toFixed(1)} mm; face ${JSON.stringify(ex.face)}`);
  console.log(`  ${id}: ${JSON.stringify(lmOut[id])},`);
}

/**
 * The lines of an older face, painted into the head's own picture: each line is drawn on the
 * face from the front (a ray onto the mesh gives the point of the picture it lands on) as a soft
 * darker stroke about 1.3 mm wide. The skin's paint keeps the picture's light and dark, so the
 * lines take whatever skin tone he is given.
 */
async function paintLines(prim, P, UV, lm) {
  const mat = prim.getMaterial();
  const tex = mat.getBaseColorTexture();
  const { data, info } = await sharp(Buffer.from(tex.getImage())).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const idx = prim.getIndices().getArray();
  const tris = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    if (Math.min(P[a * 3 + 1], P[b * 3 + 1], P[c * 3 + 1]) < 1.45) continue;
    tris.push([a, b, c]);
  }
  /** The front-most point of the head at (x, y): where on the picture, and how many pixels a metre is there. */
  const hit = (x, y) => {
    let best = null;
    for (const [a, b, c] of tris) {
      const ax = P[a * 3], ay = P[a * 3 + 1], bx = P[b * 3], by = P[b * 3 + 1], cx = P[c * 3], cy = P[c * 3 + 1];
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(den) < 1e-12) continue;
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / den, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / den, w = 1 - u - v;
      if (u < 0 || v < 0 || w < 0) continue;
      const z = u * P[a * 3 + 2] + v * P[b * 3 + 2] + w * P[c * 3 + 2];
      if (best && z <= best.z) continue;
      const e1 = Math.hypot(bx - ax, by - ay, P[b * 3 + 2] - P[a * 3 + 2]), u1 = Math.hypot((UV[b * 2] - UV[a * 2]) * W, (UV[b * 2 + 1] - UV[a * 2 + 1]) * H);
      best = { z, px: (u * UV[a * 2] + v * UV[b * 2] + w * UV[c * 2]) * W, py: (u * UV[a * 2 + 1] + v * UV[b * 2 + 1] + w * UV[c * 2 + 1]) * H, ppm: u1 / Math.max(e1, 1e-6) };
    }
    return best;
  };
  const dark = new Float32Array(W * H);
  const stroke = (pts, width, strength) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
      const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.0004));
      for (let s = 0; s <= steps; s++) {
        const t = (k + s / steps) / (pts.length - 1);
        const h = hit(mix(x0, x1, s / steps), mix(y0, y1, s / steps));
        if (!h) continue;
        const rad = Math.max(0.8, (width / 2) * h.ppm), fade = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) ** 0.5;
        const R = Math.ceil(rad * 2);
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const X = Math.round(h.px) + dx, Y = Math.round(h.py) + dy;
          if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const d = Math.hypot(X - h.px, Y - h.py) / rad;
          const a = strength * fade * Math.exp(-d * d * 1.4);
          if (a > dark[Y * W + X]) dark[Y * W + X] = a;
        }
      }
    }
  };
  const [er, el] = lm.eyes;
  const eyeY = (er[1] + el[1]) / 2, browY = lm.browY, mouthY = lm.mouth[1], noseY = lm.nose[1];
  const arc = (x0, y0, x1, y1, bow, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [mix(x0, x1, t), mix(y0, y1, t) + bow * Math.sin(Math.PI * t)]; });
  // the forehead
  stroke(arc(-0.05, browY + 0.02, 0.05, browY + 0.02, 0.004), 0.0015, 0.3);
  stroke(arc(-0.055, browY + 0.033, 0.055, browY + 0.033, 0.0045), 0.0016, 0.34);
  stroke(arc(-0.046, browY + 0.046, 0.046, browY + 0.046, 0.004), 0.0014, 0.28);
  // between the brows
  for (const x of [-0.007, 0.008]) stroke([[x, browY - 0.006], [x * 0.9, browY + 0.012]], 0.0014, 0.34);
  for (const [e, s] of [[er, -1], [el, 1]]) {
    const cx = e[0] + s * (e[2] + 0.006), cy = e[1];
    // crow's feet
    for (const a of [-0.55, -0.05, 0.45]) stroke([[cx, cy + a * 0.004], [cx + s * 0.014 * Math.cos(a), cy + 0.014 * Math.sin(a)]], 0.0012, 0.32);
    // under the eye
    stroke(arc(e[0] - e[2] * 0.9, e[1] - e[3] - 0.006, e[0] + e[2] * 1.05, e[1] - e[3] - 0.005, -0.0055), 0.0016, 0.3);
    // nose to mouth
    stroke(arc(s * 0.021, noseY + 0.002, s * 0.039, mouthY + 0.004, 0).map(([x, y], i, A) => [x + s * 0.004 * Math.sin(Math.PI * i / (A.length - 1)), y]), 0.0019, 0.4);
    // the cheek's hollow line
    stroke(arc(s * 0.062, eyeY - 0.03, s * 0.057, mouthY + 0.012, 0), 0.0022, 0.16);
  }
  for (let i = 0; i < W * H; i++) {
    const a = dark[i];
    if (a <= 0) continue;
    data[i * C] = Math.round(data[i * C] * (1 - a * 0.82));
    data[i * C + 1] = Math.round(data[i * C + 1] * (1 - a));
    data[i * C + 2] = Math.round(data[i * C + 2] * (1 - a));
  }
  const png = await sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
  tex.setImage(new Uint8Array(png)).setMimeType("image/png");
  if (tex.getURI()) tex.setURI(tex.getURI().replace(/\.webp$/i, ".png"));
}
