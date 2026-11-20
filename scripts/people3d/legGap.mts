/**
 * LEG GAP — on a real Style A body, posed through the cut-scene actor as the
 * director poses it, how close the two legs come during each gait clip and
 * the sits: the nearest point of one leg's skin to the other's (below the
 * crotch), the knees' and ankles' spacing across, and his stance.
 *   npx tsx scripts/people3d/legGap.mts [clip ...]
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { readFileSync } from "node:fs";
import { createStubPeople } from "../../lib/star/cutscene/peopleStub";

function strip(raw: Buffer): ArrayBuffer {
  const jl = raw.readUInt32LE(12);
  const js = JSON.parse(raw.subarray(20, 20 + jl).toString());
  delete js.textures; delete js.images; delete js.samplers;
  for (const m of js.materials ?? []) { delete m.occlusionTexture; delete m.normalTexture; delete m.emissiveTexture; if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; } }
  js.extensionsUsed = (js.extensionsUsed ?? []).filter((e: string) => e !== "EXT_texture_webp" && e !== "KHR_texture_basisu");
  js.extensionsRequired = (js.extensionsRequired ?? []).filter((e: string) => e !== "EXT_texture_webp" && e !== "KHR_texture_basisu");
  const jb = Buffer.from(JSON.stringify(js)); const pad = Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20);
  const rest = raw.subarray(20 + jl);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jb.length + pad.length + rest.length, 8); head.writeUInt32LE(jb.length + pad.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([head, jb, pad, rest]);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
}
const loader = {
  setMeshoptDecoder() { return this; },
  async loadAsync(url: string) {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder as never);
    return new Promise((res, rej) => l.parse(strip(readFileSync("public" + url.split("?")[0])), "", res, rej));
  },
};
const people = createStubPeople({ T: THREE, SkeletonUtils: SkeletonUtils as never, loader, body: "new" });
const actor = await people.create({ id: "you", role: "you", look: { body: "player", outfit: "kit", kit: { shirt: "#d61f26", trim: "#ffffff" } } as never, outline: 0, castShadow: false });
const person = (actor as unknown as { person: { body: THREE.SkinnedMesh; bones: Record<string, THREE.Bone>; root: THREE.Object3D; actions: Record<string, THREE.AnimationAction> } }).person;
const body = person.body;
const si = body.geometry.getAttribute("skinIndex"), sw = body.geometry.getAttribute("skinWeight");
const bones = body.skeleton.bones;
const bi = (n: string) => bones.findIndex((b) => b.name === n);
const LL = new Set([bi("LeftUpLeg"), bi("LeftLeg")]), RL = new Set([bi("RightUpLeg"), bi("RightLeg")]);
const Lv: number[] = [], Rv: number[] = [];
for (let i = 0; i < si.count; i++) {
  let best = -1, bw = 0;
  for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); }
  if (LL.has(best)) Lv.push(i); else if (RL.has(best)) Rv.push(i);
}
const wp = (b: THREE.Bone) => b.getWorldPosition(new THREE.Vector3());
export function measure(clip: string, n = 30, extra?: (t: number) => void) {
  const a = actor;
  const dur = a.clipDuration(clip);
  let worst = Infinity, kneeMin = Infinity, ankMin = Infinity, ankMax = -Infinity, hipW = 0, cross = 0, worstT = 0;
  const v = new THREE.Vector3();
  for (let f = 0; f < n; f++) {
    const t = (f / n) * dur;
    a.beginFrame();
    a.poseClips([[clip, t, 1]]);
    a.setRoot([0, 0, 0], 0);
    extra?.(t);
    a.endFrame();
    person.root.updateMatrixWorld(true);
    body.skeleton.update();
    const B = person.bones;
    hipW = Math.abs(wp(B.LeftUpLeg).x - wp(B.RightUpLeg).x);
    const kx = wp(B.LeftLeg).x - wp(B.RightLeg).x, ax = wp(B.LeftFoot).x - wp(B.RightFoot).x;
    if (process.env.TRACE) process.stdout.write(`${(ax*100).toFixed(0)},${(kx*100).toFixed(0)} `);
    kneeMin = Math.min(kneeMin, kx); ankMin = Math.min(ankMin, ax); ankMax = Math.max(ankMax, ax);
    const crotch = Math.min(wp(B.LeftUpLeg).y, wp(B.RightUpLeg).y) - Number(process.env.BAND ?? 0.18);
    const pts = (ids: number[]) => ids.filter((_, j) => j % 2 === 0).map((i) => body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld).clone()).filter((p) => p.y < crotch);
    const L = pts(Lv), R = pts(Rv);
    // inner points only: the third of each leg nearest the middle
    let d = Infinity;
    for (const p of L) for (const q of R) { const dd = p.distanceToSquared(q); if (dd < d) d = dd; }
    d = Math.sqrt(d);
    // crossed: a left point further right than the right leg's nearest point at the same height & depth
    if (d < worst) { worst = d; worstT = t; }
    if (d < 0.012) cross++;
  }
  return { clip, dur: +dur.toFixed(2), hipW: +(hipW * 100).toFixed(1), kneeMinCm: +(kneeMin * 100).toFixed(1), ankMinCm: +(ankMin * 100).toFixed(1), ankMaxCm: +(ankMax * 100).toFixed(1), nearestCm: +(worst * 100).toFixed(1), atT: +worstT.toFixed(2), touchingFrames: `${cross}/${n}` };
}
const clips = process.argv.slice(2).length ? process.argv.slice(2) : ["idle", "walk", "walk_confident", "slump_walk", "jog", "run", "sprint", "sit_idle", "sitidle"];
console.log("clips on body:", actor.clips().filter((c) => /walk|jog|run|sprint|sit|idle/.test(c)).join(" "));
for (const c of clips) { if (!person.actions[c]) { console.log(c, "missing"); continue; } console.log(JSON.stringify(measure(c))); }
// ── the sits: thigh, shin and foot, at the moment the cut scenes hold ──
if (process.env.SIT) {
  for (const [clip, hold] of [["sit_idle", 0.35], ["sitidle", 0.45], ["boss-sit", 0.45], ["slot_sit", 0.5]] as const) {
    if (!person.actions[clip]) continue;
    const a = actor; a.beginFrame(); a.poseClips([[clip, hold * a.clipDuration(clip), 1]]); a.setRoot([0, 0, 0], 0); a.endFrame();
    person.root.updateMatrixWorld(true);
    const B = person.bones; const at = (n: string) => wp(B[n]);
    const deg = (a: THREE.Vector3, b: THREE.Vector3) => (Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z)) * 180) / Math.PI;
    const toe = B.LeftToeBase ?? B.LeftToe_End ?? B.LeftFoot;
    console.log(JSON.stringify({ clip, hipsY: +at("Hips").y.toFixed(3), hipJointY: +at("LeftUpLeg").y.toFixed(3), kneeY: +at("LeftLeg").y.toFixed(3), ankleY: +at("LeftFoot").y.toFixed(3), toeY: +wp(toe).y.toFixed(3),
      thighDeg: +deg(at("LeftUpLeg"), at("LeftLeg")).toFixed(0), shinDeg: +deg(at("LeftLeg"), at("LeftFoot")).toFixed(0), kneeAheadOfHip: +(at("LeftLeg").z - at("LeftUpLeg").z).toFixed(3), ankleAheadOfKnee: +(at("LeftFoot").z - at("LeftLeg").z).toFixed(3),
      thighLen: +at("LeftUpLeg").distanceTo(at("LeftLeg")).toFixed(3), shinLen: +at("LeftLeg").distanceTo(at("LeftFoot")).toFixed(3), standAnkleY: person.meta.joints.LeftFoot[1] }));
  }
}
// ── the body itself, standing in its file pose: where the hip joints are against the thighs' own skin ──
if (process.env.REST) {
  const a = actor; a.beginFrame(); a.poseClips([]); a.setRoot([0, 0, 0], 0); a.endFrame();
  person.root.updateMatrixWorld(true); body.skeleton.update();
  const v = new THREE.Vector3();
  const band = (ids: number[], y0: number, y1: number) => { let sx = 0, n = 0, mn = 9, mx = -9; for (const i of ids) { body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld); if (v.y > y0 && v.y < y1) { sx += v.x; n++; mn = Math.min(mn, v.x); mx = Math.max(mx, v.x); } } return { mid: +(sx / Math.max(1, n) * 100).toFixed(1), inner: +(mn * 100).toFixed(1), outer: +(mx * 100).toFixed(1) }; };
  const B = person.bones;
  console.log(JSON.stringify({ hipJointX: +(wp(B.LeftUpLeg).x * 100).toFixed(1), kneeX: +(wp(B.LeftLeg).x * 100).toFixed(1), ankleX: +(wp(B.LeftFoot).x * 100).toFixed(1),
    thighTop: band(Lv, wp(B.LeftUpLeg).y - 0.12, wp(B.LeftUpLeg).y - 0.06), thighMid: band(Lv, wp(B.LeftUpLeg).y - 0.22, wp(B.LeftUpLeg).y - 0.16), knee: band(Lv, wp(B.LeftLeg).y - 0.03, wp(B.LeftLeg).y + 0.03), ankle: band(Lv, wp(B.LeftFoot).y - 0.02, wp(B.LeftFoot).y + 0.05) }));
}
// ── the boot: heel to toe and across, against his height (a size check: RUL-3D-006) ──
if (process.env.BOOT) {
  const a = actor; a.beginFrame(); a.poseClips([]); a.setRoot([0, 0, 0], 0); a.endFrame();
  person.root.updateMatrixWorld(true); body.skeleton.update();
  const fb = new Set([bi("LeftFoot"), bi("LeftToeBase")]); const v = new THREE.Vector3(); const box = new THREE.Box3();
  for (let i = 0; i < si.count; i++) { let best = -1, bw = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); } if (fb.has(best)) box.expandByPoint(body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld)); }
  const all = new THREE.Box3(); for (let i = 0; i < si.count; i += 5) all.expandByPoint(body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld));
  console.log(JSON.stringify({ bootLengthCm: +((box.max.z - box.min.z) * 100).toFixed(1), bootWidthCm: +((box.max.x - box.min.x) * 100).toFixed(1), heightCm: +((all.max.y - all.min.y) * 100).toFixed(1) }));
}
