/** Two clip files side by side: per clip, each track that differs (largest turn in degrees, or move in the file units). npx tsx tools/motionref/clip_diff.mts a.glb b.glb */
import * as THREE from "three";
import { parse, stripped } from "./nodeBody.mts";
const [a, b] = process.argv.slice(2);
const A = await parse(stripped(a)), B = await parse(stripped(b));
for (const ca of A.animations as THREE.AnimationClip[]) {
  const cb = (B.animations as THREE.AnimationClip[]).find((c) => c.name === ca.name);
  if (!cb) { console.log(ca.name, "MISSING"); continue; }
  const diffs: string[] = [];
  if (ca.tracks.length !== cb.tracks.length) diffs.push(`tracks ${ca.tracks.length}->${cb.tracks.length}`);
  for (const ta of ca.tracks) {
    const tb = cb.tracks.find((t) => t.name === ta.name);
    if (!tb) { diffs.push(`${ta.name} gone`); continue; }
    const ia = ta.createInterpolant(), ib = tb.createInterpolant();
    let m = 0;
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * ca.duration;
      const va = Array.from(ia.evaluate(t)), vb = Array.from(ib.evaluate(t));
      if (va.length === 4) m = Math.max(m, new THREE.Quaternion(...(va as [number, number, number, number])).normalize().angleTo(new THREE.Quaternion(...(vb as [number, number, number, number])).normalize()) * 180 / Math.PI);
      else m = Math.max(m, Math.hypot(...va.map((v, k) => v - vb[k])));
    }
    if (m > 0.3) diffs.push(`${ta.name.replace(".quaternion", "")} ${m.toFixed(1)}`);
  }
  if (diffs.length) console.log(ca.name.padEnd(18), diffs.join(", "));
}
