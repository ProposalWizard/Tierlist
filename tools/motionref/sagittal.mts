/**
 * Standing posture from the side, on our own skeleton (no picture): for each
 * clip, the mean over its keys of
 *   head    the head's middle ahead of the shoulder joints (cm)  — a poked head
 *   sh      the shoulder joints ahead of the hip joints (cm)     — a rounded or leaning chest
 *   hip     the hip joints ahead of the ankles (cm)              — hips pushed forward
 *   knee    knee bend, each leg (degrees, 0 straight)
 *   chest   hips -> neck from upright (degrees, + forward)
 *   shift   the hips' middle sideways off the ankles' middle (cm; weight on one leg)
 *   clavY   the shoulder joints' height below the neck base (cm)
 *   pelvis  the hip line's tilt sideways (degrees, size only)
 *   abd     each upper arm out from his side, seen from the front (degrees, both arms' mean)
 *   elbow   elbow bend (degrees, both arms' mean, 0 straight)
 *   handF   the hands ahead of the hip joints (cm; a real hanging arm: about 0, beside the thigh)
 *   handO   the hands out past the hip joints, sideways (cm)
 *
 *   npx tsx tools/motionref/sagittal.mts [--body=file.glb@c1] [clipfile.glb:clip,clip ...]
 */
import * as THREE from "three";
import { nodeBody, parse, stripped } from "./nodeBody.mts";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"]; }));
const specs = args.filter((a) => !a.startsWith("--"));
const SPECS = specs.length ? specs : ["public/star/anims3d/mocap.glb:idle,walk,walk_confident,talk,nod,applause,handshake", "public/star/people3d/anims.glb:boss-idle,boss-talk,wave"];
const b = await nodeBody(opt.body ?? "public/star/people3d/toon-p1.glb@c1");
const B = b.bones;
const P = (n: string) => new THREE.Vector3().setFromMatrixPosition(B[n].matrixWorld);

export function measure() {
  b.root.updateMatrixWorld(true);
  const up = new THREE.Vector3(0, 1, 0);
  const across = P("LeftUpLeg").sub(P("RightUpLeg")); across.y = 0; across.normalize();
  const fwd = new THREE.Vector3().crossVectors(across, up).normalize();
  if (P("headfront").sub(P("Head")).dot(fwd) < 0) fwd.negate();
  const hip = P("LeftUpLeg").add(P("RightUpLeg")).multiplyScalar(0.5);
  const ank = P("LeftFoot").add(P("RightFoot")).multiplyScalar(0.5);
  const sh = P("LeftArm").add(P("RightArm")).multiplyScalar(0.5);
  const head = P("Head").add(P("head_end")).multiplyScalar(0.5);
  const knee = (s: string) => 180 - P(`${s}UpLeg`).sub(P(`${s}Leg`)).angleTo(P(`${s}Foot`).sub(P(`${s}Leg`))) * 180 / Math.PI;
  const neck = P("neck"), hipsJ = P("Hips");
  const cl = neck.clone().sub(hipsJ);
  return {
    head: head.clone().sub(sh).dot(fwd) * 100, sh: sh.clone().sub(hip).dot(fwd) * 100, hip: hip.clone().sub(ank).dot(fwd) * 100,
    kneeL: knee("Left"), kneeR: knee("Right"), chest: Math.atan2(cl.dot(fwd), cl.y) * 180 / Math.PI,
    shift: Math.abs(hip.clone().sub(ank).dot(across)) * 100, clavY: (neck.y - sh.y) * 100,
    pelvis: Math.abs(Math.asin((P("LeftUpLeg").y - P("RightUpLeg").y) / P("LeftUpLeg").distanceTo(P("RightUpLeg")))) * 180 / Math.PI,
    abd: (["Left", "Right"] as const).reduce((m, s) => { const u = P(`${s}ForeArm`).sub(P(`${s}Arm`)); return m + Math.atan2(Math.abs(u.dot(across)), -u.y) * 90 / Math.PI; }, 0),
    elbow: (["Left", "Right"] as const).reduce((m, s) => m + (180 - P(`${s}Arm`).sub(P(`${s}ForeArm`)).angleTo(P(`${s}Hand`).sub(P(`${s}ForeArm`))) * 180 / Math.PI) / 2, 0),
    handF: (["Left", "Right"] as const).reduce((m, s) => m + P(`${s}Hand`).sub(hip).dot(fwd) * 50, 0),
    handO: (["Left", "Right"] as const).reduce((m, s) => m + (Math.abs(P(`${s}Hand`).sub(hip).dot(across)) - Math.abs(P(`${s}UpLeg`).sub(hip).dot(across))) * 50, 0),
  };
}

const f1 = (x: number) => x.toFixed(1).padStart(6);
console.log(`body ${opt.body ?? "toon-p1@c1"}        head     sh    hip  kneeL  kneeR  chest  shift  clavY pelvis    abd  elbow  handF  handO`);
const rest = measure();
const row = (m: Record<string, number>) => ["head", "sh", "hip", "kneeL", "kneeR", "chest", "shift", "clavY", "pelvis", "abd", "elbow", "handF", "handO"].map((k) => f1(m[k])).join("");
console.log(`${"(bind)".padEnd(22)}${row(rest)}`);
for (const spec of SPECS) {
  const [file, list] = spec.split(":");
  const g = await parse(stripped(file));
  for (const name of (list ?? "").split(",").filter(Boolean)) {
    const clip = (g.animations as THREE.AnimationClip[]).find((c) => c.name === name);
    if (!clip) { console.log(`${name}: none`); continue; }
    const mixer = new THREE.AnimationMixer(b.inner);
    const act = mixer.clipAction(clip); act.play();
    const acc: Record<string, number> = {};
    const N = 24;
    for (let i = 0; i < N; i++) {
      mixer.setTime((i / N) * clip.duration);
      const m = measure();
      for (const [k, v] of Object.entries(m)) acc[k] = (acc[k] ?? 0) + v / N;
    }
    act.stop(); mixer.uncacheRoot(b.inner);
    console.log(`${name.padEnd(22)}${row(acc)}`);
  }
}
