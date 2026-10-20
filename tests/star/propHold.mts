/**
 * HOLDING THINGS (lib/star/cutscene/hold.ts, perform3d.ts, peopleStub.ts holdTool; B5b).
 * On a real Style A body (toon-p1, its skeleton and fingers, no pictures: Node
 * has no image decoder), posed the way the director poses it:
 *   - the trophy held at the chest, then lifted: every frame of the lift
 *     (t 0 → 1.2 s in 1/30 s steps) each hand's grip point is on its handle
 *     (the cup is placed from the hands, as the director does), the handles
 *     reach the place the lift asked for, and no part of the cup passes inside
 *     his head;
 *   - the pen held to write: its tip on the paper point and its barrel 40–65°
 *     up off the paper (before B5b: 9°);
 *   - the lift's solver alone, for short and long arms.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { readFileSync } from "node:fs";
import { createStubPeople } from "../../lib/star/cutscene/peopleStub";
import { buildProp } from "../../lib/star/cutscene/props3d";
import { applyPose, toActor, type PoseCtx } from "../../lib/star/cutscene/perform3d";
import { heldPropOf, liftPlace, twoHandPlace, LIFT_CLEAR } from "../../lib/star/cutscene/hold";
import type { CutsceneActor } from "../../lib/star/cutscene/types";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const cm = (m: number) => `${(m * 100).toFixed(1)} cm`;

// ── a loader that reads public/ and drops the pictures ──
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
    const path = "public" + url.split("?")[0];
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder as never);
    return new Promise((res, rej) => l.parse(strip(readFileSync(path)), "", res, rej));
  },
};

const people = createStubPeople({ T: THREE, SkeletonUtils: SkeletonUtils as never, loader, body: "new" });
const actor = await people.create({ id: "you", role: "you", look: { body: "player", outfit: "kit", kit: { shirt: "#d61f26", trim: "#ffffff" } } as never, outline: 0, castShadow: false });
const kit = { mat: (c: string, o: { metal?: number; rough?: number } = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: o.metal ?? 0, roughness: o.rough ?? 0.8 }) } as never;
const txt = { club: "Test FC", player: "Bench Player", surname: "Player", manager: "Boss", number: 9, rows: [], shirt: "#d61f26", trim: "#ffffff" };
const cup = buildProp(THREE, kit, { id: "trophy", kind: "trophy-cup" }, txt);
const held = heldPropOf(THREE, cup);

const yaw = Math.PI; // he faces −z, as at the podium
const pose = (a: CutsceneActor, t: number) => {
  a.beginFrame();
  a.poseClips([["idle", 0.6 + t * 0.4, 1]]);
  a.setRoot([0, 0, 40], yaw);
  a.plantFeet(1);
  const r = a.root.position;
  const c: PoseCtx = { T: THREE, t, local: 0, yaw, root: [r.x, r.y, r.z], prop: held };
  // the trophy beat: held at the chest, then lifted from 1.1 s (blend in 0.35 s), as beats.ts trophyLift
  const wChest = t < 1.3 ? 1 : Math.max(0, 1 - (t - 1.3) / 0.3);
  const wUp = t < 1.1 ? 0 : Math.min(1, (t - 1.1) / 0.35);
  if (wChest > 0) applyPose(a, "trophy-chest", wChest, { ...c, local: t });
  if (wUp > 0) applyPose(a, "trophy-overhead", wUp, { ...c, local: t - 1.1 });
  // as director.ts: B5c's arm clearance runs after the poses, but leaves a hand on a held prop alone
  a.clearArms?.(1, { L: true, R: true });
  a.endFrame();
  return c;
};

// the head's own points (its skinned vertices weighted mostly to the head) this frame
const body = (actor as unknown as { person: { body: THREE.SkinnedMesh } }).person.body;
const headIdx: number[] = [];
{
  const si = body.geometry.getAttribute("skinIndex"), sw = body.geometry.getAttribute("skinWeight");
  const bones = body.skeleton.bones;
  const headBone = bones.findIndex((b) => b.name === "Head");
  for (let i = 0; i < si.count; i += 1) for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === headBone && sw.getComponent(i, k) > 0.6) { headIdx.push(i); break; }
}
const headBox = () => {
  body.skeleton.update();
  const b = new THREE.Box3(), v = new THREE.Vector3();
  for (const i of headIdx) { body.getVertexPosition(i, v); b.expandByPoint(v.applyMatrix4(body.matrixWorld)); }
  return b;
};
// the cup's own points in the world
const cupPoints = () => {
  const out: THREE.Vector3[] = [];
  cup.group.updateMatrixWorld(true);
  cup.group.traverse((o: THREE.Object3D) => {
    const m = o as THREE.Mesh;
    const pos = m.isMesh ? m.geometry.getAttribute("position") : null;
    if (!pos) return;
    for (let i = 0; i < pos.count; i += 3) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  });
  return out;
};

let worstGrip = 0, worstHead = Infinity, frames = 0, worstTarget = 0;
let topLift = { y: 0, z: 0 };
for (let f = 0; f <= 54; f++) {
  const t = f / 30;
  const c = pose(actor, t);
  const pl = twoHandPlace(THREE, actor, cup.handles, cup.group.scale, yaw);
  cup.group.position.copy(pl.pos); cup.group.quaternion.copy(pl.q); cup.group.updateMatrixWorld(true);
  // each grip on its handle
  for (const s of ["L", "R"] as const) {
    const h = new THREE.Vector3(...cup.handles[s]).applyMatrix4(cup.group.matrixWorld);
    const dg = h.distanceTo(actor.gripFrame(s, "grip").pos); if (process.env.HOLD_DEBUG && dg > 0.008) console.log(`t ${t.toFixed(2)} ${s} ${cm(dg)}`);
    worstGrip = Math.max(worstGrip, dg);
  }
  // nothing of the cup inside his head (a point inside the head's box, shrunk by 1 cm, is a clip)
  const hb = headBox();
  const inner = hb.clone().expandByScalar(-0.01);
  let clear = Infinity;
  for (const p of cupPoints()) {
    if (inner.containsPoint(p)) clear = Math.min(clear, -inner.distanceToPoint(p) - 0.001);
    else clear = Math.min(clear, hb.distanceToPoint(p));
  }
  worstHead = Math.min(worstHead, clear);
  if (t >= 1.6) {
    const mid = new THREE.Vector3(...cup.handles.L).add(new THREE.Vector3(...cup.handles.R)).multiplyScalar(0.5).applyMatrix4(cup.group.matrixWorld);
    const la = toActor(c, mid);
    topLift = { y: la[1], z: la[2] };
  }
  frames++;
}
console.log(`trophy: ${frames} frames, grip to handle worst ${cm(worstGrip)}, cup to head nearest ${cm(worstHead)}; lifted handles at ${topLift.y.toFixed(2)} m up, ${cm(topLift.z)} in front of him`);
check(worstGrip < 0.01, `a hand left its handle by ${cm(worstGrip)}`);
check(worstHead >= 0, `the cup passed ${cm(-worstHead)} inside his head`);
check(topLift.y > 1.85, `the lift is only ${topLift.y.toFixed(2)} m up (his crown is ~1.86)`);
void worstTarget;

// ── the pen: tip on the paper, barrel ~50° up ──
{
  const a = actor;
  a.beginFrame();
  a.poseClips([["sitidle", 0.45, 1]]);
  a.setRoot([0, 0, 0.7], Math.PI);
  a.lean(0.3);
  const tip = new THREE.Vector3(0.05, 0.77, 0.25);
  const local = (x: number, y: number, z: number) => new THREE.Vector3(x * Math.cos(Math.PI) + z * Math.sin(Math.PI), y, -x * Math.sin(Math.PI) + z * Math.cos(Math.PI)).normalize();
  a.holdTool!("R", "pen", tip, local(-0.3, 0.78, -0.55), local(-0.5, 0.85, -0.1), 1, local(-0.7, -0.6, -0.2));
  a.endFrame();
  const g = a.gripFrame("R", "pen");
  const up = (Math.asin(Math.max(-1, Math.min(1, g.axis.y))) * 180) / Math.PI;
  console.log(`pen: tip ${cm(g.pos.distanceTo(tip))} from the paper point, barrel ${up.toFixed(0)}° up off the paper`);
  check(g.pos.distanceTo(tip) < 0.006, `the pen's tip is ${cm(g.pos.distanceTo(tip))} off the paper point`);
  check(up >= 40 && up <= 65, `the pen stands ${up.toFixed(0)}° up (want 40–65°)`);
}

// ── the lift solver on its own ──
{
  const base = { crownY: 1.86, chinY: 1.5, faceZ: 0.17, headZ: 0.03, half: 0.235, drop: 0.27, front: [{ y0: -0.27, y1: -0.15, z: 0.078 }, { y0: -0.15, y1: 0, z: 0.06 }, { y0: 0, y1: 0.23, z: 0.157 }] };
  const short = liftPlace({ ...base, shoulder: [0.22, 1.39, 0], reach: 0.6 });
  const long = liftPlace({ ...base, shoulder: [0.22, 1.5, 0], reach: 0.72 });
  console.log(`lift: short arms → ${short.y.toFixed(2)} m up, ${cm(short.z)} forward; long arms → ${long.y.toFixed(2)} m up, ${cm(long.z)} forward`);
  check(short.clear >= 0 && long.clear >= 0, "the solver left the cup in the head");
  check(long.z < short.z, "longer arms do not lift it straighter");
  check(long.y - base.drop >= base.crownY + LIFT_CLEAR.over - 1e-6 || long.z - 0.078 >= base.faceZ, "long arms: the base neither clears the crown nor the face");
}

people.dispose();
if (problems.length) { console.log(`FAIL — ${problems.length} problem(s):`); for (const p of problems) console.log("  " + p); process.exit(1); }
console.log("propHold: all checks pass");
