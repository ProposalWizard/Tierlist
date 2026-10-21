/**
 * SHOULDERS DOWN, ARMS OFF THE BODY (B5c, Harry 20 Oct 2026: "why is the
 * shoulders always so awkwardly high … even when standing stationary";
 * "the arms are hitting into the body and through the body").
 *
 * The shipped clip files were settled by tools/motionref/settle_clips.mts
 * (lib/star/three3d/shoulderSet.ts). Checked here on today's Style A body:
 * a settle run again on the shipped clips finds nothing left to do — the
 * collarbones are level (no shrug unless an arm is up) and no arm point goes
 * into the torso. If a clip file is rebuilt (tools/mocap3d, tools/anims3d)
 * without the settle step, this fails: run settle_clips.mts again.
 * The full skin-on-skin check: tools/motionref/arm_clearance.mts.
 *
 * POSTURE (Harry 23:21, "whyyyy is the posture so weird"): standing still, the
 * hips over the feet (the capture idle had them 6.3 cm ahead of the ankles),
 * the head over the shoulders (7.6 cm ahead), the standing knee soft, not bent.
 * Measured on the shipped idle, talk and nod (tools/motionref/sagittal.mts).
 */
import * as THREE from "three";
import { settleClip, shoulderBodyOf } from "../../lib/star/three3d/shoulderSet";
import { stripped, parse, nodeBody } from "../../tools/motionref/nodeBody.mts";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const body = await nodeBody("public/star/people3d/toon-p1.glb");
const sb = shoulderBodyOf(THREE, body.inner, body.bones, body.body, "test");
check(!!sb, "today's body has the bones the settle needs");
const KEY = ["idle", "walk", "jog", "handshake", "applause", "wave", "talk", "point", "celebrate", "celebrate_pump", "shirt_hold", "slump_walk", "walk_confident", "frustrated", "throw_out", "groan_loss"];
let seen = 0;
if (sb) {
  for (const f of ["public/star/people3d/anims.glb", "public/star/anims3d/mocap.glb", "public/star/anims3d/football.glb", "public/star/anims3d/casino.glb"]) {
    const g = await parse(stripped(f));
    for (const c of g.animations as THREE.AnimationClip[]) {
      if (!KEY.includes(c.name)) continue;
      const r = settleClip(THREE, sb, c.clone());
      if (!r) continue;
      seen++;
      check(r.clavBefore < 1.5, `${f.split("/").pop()} ${c.name}: collarbones level (lifted ${r.clavBefore.toFixed(1)}° on average)`);
      check(r.inBefore < 0.6, `${f.split("/").pop()} ${c.name}: arms clear of the body (${r.inBefore.toFixed(1)} cm in)`);
    }
  }
}
check(seen >= 12, `the standing and moving clips were checked (${seen})`);

// posture, from the side (the shipped clips as they play)
{
  const B = body.bones, P = (n: string) => new THREE.Vector3().setFromMatrixPosition(B[n].matrixWorld);
  const g = await parse(stripped("public/star/anims3d/mocap.glb"));
  for (const name of ["idle", "talk", "nod"]) {
    const clip = (g.animations as THREE.AnimationClip[]).find((c) => c.name === name);
    if (!clip) { check(false, `${name}: in mocap.glb`); continue; }
    const mixer = new THREE.AnimationMixer(body.inner); mixer.clipAction(clip).play();
    let hip = 0, head = 0, stance = 0;
    const N = 20;
    for (let i = 0; i < N; i++) {
      mixer.setTime((i / N) * clip.duration); body.root.updateMatrixWorld(true);
      const across = P("LeftUpLeg").sub(P("RightUpLeg")); across.y = 0; across.normalize();
      const fwd = new THREE.Vector3().crossVectors(across, new THREE.Vector3(0, 1, 0)).normalize();
      if (P("headfront").sub(P("Head")).dot(fwd) < 0) fwd.negate();
      const mid = (a: string, b: string) => P(a).add(P(b)).multiplyScalar(0.5);
      hip += mid("LeftUpLeg", "RightUpLeg").sub(mid("LeftFoot", "RightFoot")).dot(fwd) / N;
      head += mid("Head", "head_end").sub(mid("LeftArm", "RightArm")).dot(fwd) / N;
      const knee = (s: string) => 180 - P(`${s}UpLeg`).sub(P(`${s}Leg`)).angleTo(P(`${s}Foot`).sub(P(`${s}Leg`))) * 180 / Math.PI;
      stance += Math.min(knee("Left"), knee("Right")) / N;
    }
    mixer.stopAllAction(); mixer.uncacheRoot(body.inner);
    check(hip < 0.025, `${name}: hips over the feet (${(hip * 100).toFixed(1)} cm ahead of the ankles)`);
    check(head < 0.065, `${name}: head over the shoulders (${(head * 100).toFixed(1)} cm ahead)`);
    check(stance < 8, `${name}: the standing knee soft, not bent (${stance.toFixed(1)}°)`);
  }
}

if (problems.length) { console.error(`✗ ${problems.length} problem(s):\n  ` + problems.join("\n  ")); process.exit(1); }
console.log(`✓ shoulders down, arms off the body: ${seen} clips settled on today's body`);
