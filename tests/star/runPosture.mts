/**
 * THE RUNNING NECK (Harry, 9 Oct 2026: "neck hella weird when running").
 * lib/star/three3d/runPosture.ts straightens the neck and head and lowers the
 * shoulders on the capture's moving loops, both skeletons. Measured on the
 * real clip files.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { readFileSync } from "node:fs";
import { uprightRunPosture, PEOPLE_POSTURE, UAL_POSTURE, NECK_LEAN_MAX, HAND_BEHIND_MAX, ELBOW_MIN, ELBOW_MAX } from "../../lib/star/three3d/runPosture";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const load = async (f: string): Promise<any> => {
  const buf = readFileSync(f);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder as never);
  return new Promise((res, rej) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "", res, rej));
};

for (const [file, bones, label] of [["public/star/anims3d/mocap.glb", PEOPLE_POSTURE, "people"], ["public/star/anims3d/mocap-ual.glb", UAL_POSTURE, "ual"]] as const) {
  const g = await load(file);
  const durs = Object.fromEntries(g.animations.map((a: THREE.AnimationClip) => [a.name, a.duration]));
  const rep = uprightRunPosture(THREE, g, bones);
  for (const r of rep) {
    console.log(`${label} ${r.clip.padEnd(12)} neck ${r.neckBefore.toFixed(0)}° → ${r.neckAfter.toFixed(0)}°  head ${r.headBefore.toFixed(0)}° → ${r.headAfter.toFixed(0)}°  neck above shoulders ${(r.gapBefore * 100).toFixed(1)} → ${(r.gapAfter * 100).toFixed(1)} cm`);
    check(r.neckAfter <= NECK_LEAN_MAX + 2, `${label} ${r.clip}: neck still leans ${r.neckAfter.toFixed(1)}°`);
    check(r.gapAfter >= r.gapBefore - 1e-4, `${label} ${r.clip}: shoulders rose`);
  }
  check(rep.some((r) => r.clip === "run") && rep.some((r) => r.clip === "sprint"), `${label}: run and sprint were fixed`);
  const run = rep.find((r) => r.clip === "sprint");
  if (run) check(run.gapAfter > 0, `${label} sprint: the neck stands above the shoulders (${(run.gapAfter * 100).toFixed(1)} cm)`);
  // loops keep their length
  for (const a of g.animations) check(Math.abs(a.duration - durs[a.name]) < 1e-6, `${label} ${a.name} kept its length`);
  // a second call changes nothing
  check(uprightRunPosture(THREE, g, bones).length === 0, `${label}: done once per file`);
  // the running arms (Harry: "what's this hand being back sprinting?")
  const cm = (m: number) => `${(m * 100).toFixed(0)} cm`;
  for (const name of ["jog", "run", "sprint"]) {
    const a = rep.find((r) => r.clip === name)?.arms;
    if (!a) { problems.push(`${label} ${name}: arms not done`); continue; }
    console.log(`${label} ${name.padEnd(6)} arms: behind pelvis ${cm(a.before.behind)} → ${cm(a.after.behind)} · out from middle ${cm(a.before.out)} → ${cm(a.after.out)} · front hand ${cm(a.before.high)} → ${cm(a.after.high)} above pelvis · wrist ${a.before.wrist.toFixed(0)}° → ${a.after.wrist.toFixed(0)}° · elbow ${a.before.elbowMin.toFixed(0)}–${a.before.elbowMax.toFixed(0)}° → ${a.after.elbowMin.toFixed(0)}–${a.after.elbowMax.toFixed(0)}°`);
    check(a.after.behind <= HAND_BEHIND_MAX + 0.01, `${label} ${name}: the back hand stays beside the hip (${cm(a.after.behind)} behind)`);
    check(a.after.out >= 0.1, `${label} ${name}: no hand across the spine (${cm(a.after.out)} out)`);
    check(a.after.wrist <= 15, `${label} ${name}: wrist near straight (${a.after.wrist.toFixed(0)}°)`);
    check(a.after.elbowMin >= ELBOW_MIN - 1 && a.after.elbowMax <= ELBOW_MAX + 1, `${label} ${name}: elbow ${ELBOW_MIN}–${ELBOW_MAX}°`);
  }
  const sp = rep.find((r) => r.clip === "sprint")?.arms;
  if (sp) check(sp.after.high >= 0.35, `${label} sprint: the front hand comes up to the chest (${cm(sp.after.high)})`);
}

if (problems.length) { console.error("FAIL\n  " + problems.join("\n  ")); process.exit(1); }
console.log("runPosture: all good");
