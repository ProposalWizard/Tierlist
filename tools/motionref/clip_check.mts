/** Every clip in a file: key times rising and finite, values finite. npx tsx tools/motionref/clip_check.mts file.glb [...] */
import * as THREE from "three";
import { parse, stripped } from "./nodeBody.mts";
let bad = 0;
for (const f of process.argv.slice(2)) {
  const g = await parse(stripped(f));
  for (const c of g.animations as THREE.AnimationClip[]) {
    for (const t of c.tracks) {
      const tm = t.times, v = t.values;
      let ok = true;
      for (let i = 0; i < tm.length; i++) if (!Number.isFinite(tm[i]) || (i && tm[i] < tm[i - 1])) ok = false;
      for (let i = 0; i < v.length; i++) if (!Number.isFinite(v[i])) ok = false;
      if (!ok) {
        bad++;
        const bi = Array.from(tm).findIndex((x, i) => !Number.isFinite(x) || (i > 0 && x < tm[i - 1])), bv = Array.from(v).findIndex((x) => !Number.isFinite(x));
        console.log(`${f} ${c.name} ${t.name}: bad keys (${tm.length} keys / ${v.length} values; first bad time #${bi} ${bi >= 0 ? tm[bi] : ""}, first bad value #${bv})`);
      }
    }
  }
  console.log(`${f}: ${(g.animations as THREE.AnimationClip[]).length} clips checked`);
}
process.exit(bad ? 1 : 0);
