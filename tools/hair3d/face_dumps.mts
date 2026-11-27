/**
 * Every face type (lib/star/style3d/toon/faceShape.ts) put on a dumped hair head, written as head
 * dumps the hair check can read:  npx tsx tools/hair3d/face_dumps.mts <dump dir of h3 or m2> <out dir> <h3|m2>
 * then  blender -b --python tools/hair3d/build_hair.py -- --check <out dir>/<face> <hair dir> <h3|m2>
 * Prints how far each face moves the real head (the most, in mm).
 */
import fs from "node:fs";
import path from "node:path";
import { TOON_FACE_TYPES, TOON_FACE_IDS, faceFrame, faceShapePoint } from "../../lib/star/style3d/toon/faceShape";
import { TOON_FACE_LANDMARKS } from "../../lib/star/style3d/toon/faceLandmarks";

const [src, out, base] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(src, "head.json"), "utf8"));
const F = faceFrame(TOON_FACE_LANDMARKS[base as "h3" | "m2"]!, meta.extras.face, meta.extras.kit.collarY);
const P = new Float32Array(fs.readFileSync(path.join(src, "pos.f32")).buffer.slice(0));
for (const f of TOON_FACE_IDS) {
  if (f === "base") continue;
  const Q = new Float32Array(P.length);
  let most = 0;
  for (let i = 0; i < P.length; i += 3) {
    const o = faceShapePoint([P[i], P[i + 1], P[i + 2]], F, TOON_FACE_TYPES[f].shape, 1.2);
    most = Math.max(most, Math.hypot(o[0] - P[i], o[1] - P[i + 1], o[2] - P[i + 2]));
    Q.set(o, i);
  }
  const d = path.join(out, f);
  fs.mkdirSync(d, { recursive: true });
  for (const n of fs.readdirSync(src)) if (n !== "pos.f32" && !fs.statSync(path.join(src, n)).isDirectory()) fs.copyFileSync(path.join(src, n), path.join(d, n));
  fs.writeFileSync(path.join(d, "pos.f32"), Buffer.from(Q.buffer));
  console.log(`${base} ${f}: the most ${(most * 1000).toFixed(1)} mm (at its strongest, x1.2)`);
}
