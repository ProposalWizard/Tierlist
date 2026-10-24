/** The lowest skin point of a football clip, every 0.1 s, on two Style A bodies: below 0 = through the grass, well above 0 when lying = floating.
 *  npx tsx tools/anims3d/look/ground.mts [clip] */
import * as THREE from "three";
import { parse, stripped, nodeBody } from "../../motionref/nodeBody.mts";
const clipName = process.argv[2] ?? "bicycle";
const fb = await parse(stripped("public/star/anims3d/football.glb"));
const clip = fb.animations.find((c: THREE.AnimationClip) => c.name === clipName);
for (const spec of ["public/star/people3d/toon-p1.glb@c2", "public/star/people3d/toon-f2.glb"]) {
  const nb = await nodeBody(spec);
  const mixer = new THREE.AnimationMixer(nb.inner);
  // as the game gives a body its clips (footballAnims.addClips): the hips' height brought to this body's
  const k = nb.hipsRest.y / (fb.scene.userData.hipsY || nb.hipsRest.y);
  const c = clip.clone();
  for (const tr of c.tracks) if (tr.name.endsWith(".position")) { const vv = tr.values.slice(); for (let i = 0; i < vv.length; i++) vv[i] *= k; tr.values = vv; }
  const a = mixer.clipAction(c); a.play();
  const pos = nb.body.geometry.getAttribute("position"), N = pos.count, v = new THREE.Vector3();
  const names = nb.body.skeleton.bones.map((b) => b.name);
  const si = nb.body.geometry.getAttribute("skinIndex"), sw = nb.body.geometry.getAttribute("skinWeight");
  const top: string[] = [];
  const rows: string[] = [];
  for (let f = 0; f <= Math.round(clip.duration * 30); f++) {
    mixer.setTime(Math.min(f / 30, clip.duration - 1e-4)); nb.root.updateMatrixWorld(true);
    let lo = 1e9, who = "";
    for (let i = 0; i < N; i += 2) { nb.body.getVertexPosition(i, v).applyMatrix4(nb.body.matrixWorld); if (v.y < lo) { lo = v.y; let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = sw.getComponent(i, k); if (x > w) { w = x; b = si.getComponent(i, k); } } who = names[b]; } }
    if (f % 3 === 0) rows.push(`${(f / 30).toFixed(2)}:${(lo * 100).toFixed(1)}cm(${who})`);
  }
  const ct = fb.scene.userData.clips?.[clipName]?.contact;
  if (ct !== undefined) {
    mixer.setTime(ct); nb.root.updateMatrixWorld(true);
    const A = nb.bones.RightFoot.getWorldPosition(new THREE.Vector3()), T = nb.bones.RightToeBase.getWorldPosition(new THREE.Vector3());
    const ip = A.multiplyScalar(0.45).add(T.multiplyScalar(0.55));
    rows.push(`| contact ${ct}s right instep at [${ip.toArray().map((x) => x.toFixed(2)).join(", ")}] m`);
  }
  // the fastest any bone turns in one 60 fps frame (keyed clips: no flips over 60°)
  let worst = 0, wb = "", wt = 0;
  const prev = new Map<string, THREE.Quaternion>();
  for (let f = 0; f <= Math.round(clip.duration * 60); f++) {
    mixer.setTime(Math.min(f / 60, clip.duration - 1e-4));
    for (const [n, bn] of Object.entries(nb.bones)) {
      const q = bn.quaternion.clone(), p = prev.get(n);
      if (p) { const d = (p.angleTo(q) * 180) / Math.PI; if (d > worst) { worst = d; wb = n; wt = f / 60; } }
      prev.set(n, q);
    }
  }
  rows.push(`| fastest bone turn ${worst.toFixed(1)}° in 1/60 s (${wb} at ${wt.toFixed(2)} s)`);
  console.log(spec, rows.join(" "));
}
