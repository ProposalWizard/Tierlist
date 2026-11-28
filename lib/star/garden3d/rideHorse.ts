/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE HORSE YOU RIDE, AND YOU ON IT (garden levels, ./levelZones.ts). The horse is the garden's own CC0 model
 * (Quaternius' farm horse, public/star/garden3d/horse.glb, packed with meshopt) at one riding size
 * (RIDE_HORSE_SCALE: a 16-hand horse beside a 1.8 m man), its faceted mesh smoothed at load (one rounding pass,
 * skin weights carried, smooth normals) so it reads as a horse, not a stack of boxes. The tack (cloth, saddle,
 * stirrups, girth, reins) is made here, in the horse's own frame, and carried by its torso bone.
 *
 * The rider: the one body's seated clip, then thighs opened round the barrel, knees bent, feet in the irons,
 * a rider's upright seat leaning a little forward (more at speed and over a jump), hands low over the withers
 * holding the reins. `riderCheck` measures it (RUL-3D-005: nothing through the horse, nothing through himself).
 */
import { turnBoneInBody, type Person3D } from "../people3d";

export const RIDE_HORSE_SCALE = 0.3;

export interface HorseRig {
  root: any; mixer: any; idle: any; walk: any; run: any; jump: any; neck: any; head: any; torso: any; tail: any[]; blob: any;
  saddle: any; reinL: any; reinR: any; torso0inv: any; head0inv: any;
  /** The seat (on top of the saddle) and the bit, in the horse's rest frame. */
  seat0: any; bit0: any;
  /** The barrel's half width at the saddle, and the back's top (m). */
  barrel: number; backTop: number;
  /** The stirrup irons' bottoms in the rest frame (left, right). */
  irons: [any, any];
}

/**
 * Round a faceted skinned mesh once (Loop-style: every triangle into four, new points eased towards their
 * neighbours, the skin weights of a new point from its two ends). Pure geometry; returns a new BufferGeometry.
 */
export function roundSkinned(T: any, geo: any, pull = 0.22): any {
  const g0 = geo.index ? geo : (() => { const g = geo.clone(); return g; })();
  const pos = g0.attributes.position, si = g0.attributes.skinIndex, sw = g0.attributes.skinWeight;
  const col = g0.attributes.color;
  // weld by position (the file splits points per face for flat shading)
  const key = (i: number) => `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
  const weldOf = new Map<string, number>();
  const verts: { p: number[]; si: number[]; sw: number[]; c: number[] | null }[] = [];
  const remap: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    let w = weldOf.get(k);
    if (w === undefined) {
      w = verts.length; weldOf.set(k, w);
      verts.push({ p: [pos.getX(i), pos.getY(i), pos.getZ(i)], si: [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)], sw: [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], c: col ? [col.getX(i), col.getY(i), col.getZ(i)] : null });
    }
    remap.push(w);
  }
  const idx: number[] = [];
  const src = g0.index ? Array.from(g0.index.array as ArrayLike<number>) : Array.from({ length: pos.count }, (_, i) => i);
  // keep the groups (materials) as they are, triangle by triangle
  const groups: { start: number; count: number; materialIndex: number }[] = g0.groups.length ? g0.groups : [{ start: 0, count: src.length, materialIndex: 0 }];
  const triMat: number[] = [];
  for (const gr of groups) for (let t = gr.start; t < gr.start + gr.count; t += 3) { idx.push(remap[src[t]], remap[src[t + 1]], remap[src[t + 2]]); triMat.push(gr.materialIndex); }
  // neighbours, and the midpoint of each edge
  const nb: Set<number>[] = verts.map(() => new Set());
  const mid = new Map<string, number>();
  const blendSkin = (a: number, b: number) => {
    const acc = new Map<number, number>();
    for (const v of [verts[a], verts[b]]) for (let k = 0; k < 4; k++) if (v.sw[k] > 0) acc.set(v.si[k], (acc.get(v.si[k]) ?? 0) + v.sw[k] / 2);
    const top = Array.from(acc.entries()).sort((x, y) => y[1] - x[1]).slice(0, 4);
    const s = top.reduce((t, e) => t + e[1], 0) || 1;
    while (top.length < 4) top.push([0, 0]);
    return { si: top.map((e) => e[0]), sw: top.map((e) => e[1] / s) };
  };
  const midOf = (a: number, b: number) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`;
    let m = mid.get(k);
    if (m === undefined) {
      const A = verts[a], B = verts[b];
      const sk = blendSkin(a, b);
      m = verts.length;
      verts.push({ p: [(A.p[0] + B.p[0]) / 2, (A.p[1] + B.p[1]) / 2, (A.p[2] + B.p[2]) / 2], si: sk.si, sw: sk.sw, c: A.c && B.c ? [(A.c[0] + B.c[0]) / 2, (A.c[1] + B.c[1]) / 2, (A.c[2] + B.c[2]) / 2] : A.c });
      mid.set(k, m);
    }
    return m;
  };
  const n0 = verts.length;
  for (let t = 0; t < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const out: number[] = [];
  const outMat: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
    const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
    out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    for (let k = 0; k < 4; k++) outMat.push(triMat[t / 3]);
  }
  // ease the old points towards the middle of their neighbours (rounds the corners, keeps the size)
  const moved = verts.slice(0, n0).map((v, i) => {
    const ns = Array.from(nb[i]);
    if (!ns.length) return v.p;
    const avg = [0, 0, 0];
    for (const j of ns) for (let k = 0; k < 3; k++) avg[k] += verts[j].p[k] / ns.length;
    return v.p.map((x, k) => x + (avg[k] - x) * pull);
  });
  for (let i = 0; i < n0; i++) verts[i].p = moved[i];
  // sort triangles by material into groups again
  const order = Array.from({ length: outMat.length }, (_, i) => i).sort((x, y) => outMat[x] - outMat[y]);
  const fin: number[] = [];
  const newGroups: { start: number; count: number; mi: number }[] = [];
  for (const tIdx of order) {
    const mi = outMat[tIdx];
    if (!newGroups.length || newGroups[newGroups.length - 1].mi !== mi) newGroups.push({ start: fin.length, count: 0, mi });
    fin.push(out[tIdx * 3], out[tIdx * 3 + 1], out[tIdx * 3 + 2]);
    newGroups[newGroups.length - 1].count += 3;
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(verts.flatMap((v) => v.p), 3));
  g.setAttribute("skinIndex", new T.Uint16BufferAttribute(verts.flatMap((v) => v.si), 4));
  g.setAttribute("skinWeight", new T.Float32BufferAttribute(verts.flatMap((v) => v.sw), 4));
  if (col) g.setAttribute("color", new T.Float32BufferAttribute(verts.flatMap((v) => v.c ?? [1, 1, 1]), 3));
  g.setIndex(fin);
  for (const gr of newGroups) g.addGroup(gr.start, gr.count, gr.mi);
  g.computeVertexNormals();
  return g;
}

/** The ridable horse from the loaded horse.glb (cloned; the file's own copy is untouched). */
export function makeRideHorse(T: any, SkeletonUtils: any, gltf: any, blobTex: any, opts: { round?: boolean } = {}): HorseRig {
  const SK = SkeletonUtils.default ?? SkeletonUtils;
  const root = SK.clone(gltf.scene);
  root.scale.setScalar(RIDE_HORSE_SCALE);
  root.traverse((o: any) => {
    if (!o.isMesh) return;
    // left out of the picture when he is off screen (the garden's own horse was always drawn: 2 draws for nothing)
    o.castShadow = false; o.frustumCulled = true;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const fixed = ms.map((m: any) => { const c = m.clone(); c.opacity = 1; c.transparent = false; c.roughness = 0.55; c.flatShading = false; c.needsUpdate = true; return c; });
    o.material = Array.isArray(o.material) ? fixed : fixed[0];
    if (opts.round !== false && o.isSkinnedMesh) {
      // dequantise first (the packed file keeps positions as small integers): the rounding works in real units
      const g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) {
        const a = g.attributes[k];
        if (a.normalized || !(a.array instanceof Float32Array)) {
          const f = new Float32Array(a.count * a.itemSize);
          for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
          g.setAttribute(k, new T.BufferAttribute(f, a.itemSize));
        }
      }
      o.geometry = roundSkinned(T, g);
    }
  });
  root.name = "ride-horse";
  const mx = new T.AnimationMixer(root);
  const find = (n: string) => gltf.animations.find((a: any) => a.name.endsWith(n));
  const idle = mx.clipAction(find("Idle")); idle.play();
  const walk = mx.clipAction(find("WalkSlow") ?? find("Walk")); walk.play(); walk.setEffectiveWeight(0);
  const run = mx.clipAction(find("Run")); run.play(); run.setEffectiveWeight(0);
  const jump = mx.clipAction(find("Jump")); jump.play(); jump.setEffectiveWeight(0); jump.timeScale = 0;
  const bone = (n: string) => root.getObjectByName(n);
  const blob = new T.Mesh(new T.PlaneGeometry(1.3, 2.9), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.62 }));
  blob.rotation.x = -Math.PI / 2; blob.renderOrder = 1;
  const torso = bone("Torso"), head = bone("Head");
  mx.update(0);
  root.updateMatrixWorld(true);
  // his bounds from the rest pose, padded for a stride or a jump (the clips never take him further)
  root.traverse((o: any) => { if (o.isSkinnedMesh && o.computeBoundingSphere) { o.computeBoundingSphere(); if (o.boundingSphere) o.boundingSphere.radius *= 1.5; } });
  const seat0 = new T.Vector3(); torso.getWorldPosition(seat0);
  // the back's top over the torso bone, and the barrel's half width there: measured off the skin
  let backTop = seat0.y + 0.25, barrel = 0.3;
  root.traverse((o: any) => {
    if (!o.isSkinnedMesh || !o.getVertexPosition) return;
    const p = new T.Vector3(), n = o.geometry.attributes.position.count;
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, p); p.applyMatrix4(o.matrixWorld);
      if (Math.abs(p.z - seat0.z) < 0.14 && Math.abs(p.x) < 0.1) backTop = Math.max(backTop, p.y);
      if (Math.abs(p.z - seat0.z) < 0.3 && p.y > seat0.y - 0.45) barrel = Math.max(barrel, Math.abs(p.x));
    }
  });
  const torso0inv = new T.Matrix4().copy(torso.matrixWorld).invert();
  const head0inv = new T.Matrix4().copy(head.matrixWorld).invert();
  const mat = (c: string, o: any = {}) => new T.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
  const M = { leather: mat("#4a2b18", { roughness: 0.5 }), cloth: mat("#1d2a44", { roughness: 0.9 }), gold: mat("#facc15", { roughness: 0.4, emissive: "#6b4f00", emissiveIntensity: 0.3 }), steel: mat("#c9ccd1", { roughness: 0.3, metalness: 0.8 }) };
  const saddle = new T.Group();
  saddle.matrixAutoUpdate = false;
  saddle.name = "ride-saddle";
  const add = (geo: any, m: any, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const me = new T.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz);
    me.castShadow = false; saddle.add(me); return me;
  };
  const bt = backTop, sz = seat0.z, bw = barrel;
  // the saddle cloth: a curved pad over the back and down each side (about 65 degrees each way), gold piping
  const arc = Math.PI * 0.36;
  const clothGeo = new T.CylinderGeometry(bw + 0.025, bw + 0.025, 0.66, 20, 1, true, -arc, arc * 2);
  clothGeo.rotateX(-Math.PI / 2);
  add(clothGeo, M.cloth, 0, bt - bw - 0.012, sz - 0.04);
  for (const zz of [-0.37, 0.29]) add(new T.TorusGeometry(bw + 0.03, 0.01, 5, 20, arc * 2), M.gold, 0, bt - bw - 0.012, sz + zz, 0, 0, Math.PI / 2 - arc);
  // the saddle: its side profile (low seat, high cantle behind, the pommel in front) pushed out across the back
  const prof = new T.Shape();
  const L = 0.27;
  prof.moveTo(-L, 0); prof.lineTo(L, 0);
  prof.quadraticCurveTo(L + 0.03, 0.06, L - 0.01, 0.13); // the pommel's front
  prof.quadraticCurveTo(L - 0.06, 0.14, L - 0.1, 0.06); // into the seat
  prof.quadraticCurveTo(0, 0.025, -L + 0.12, 0.07); // the seat's dip
  prof.quadraticCurveTo(-L + 0.03, 0.2, -L - 0.03, 0.17); // up to the cantle
  prof.quadraticCurveTo(-L - 0.03, 0.06, -L, 0);
  const sg = new T.ExtrudeGeometry(prof, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8 });
  sg.translate(0, 0, -0.16); sg.rotateY(-Math.PI / 2); // profile along z (front +z), width across x
  sg.computeVertexNormals();
  add(sg, M.leather, 0, bt - 0.012, sz);
  // the flaps over the rider's thighs
  for (const sx of [-1, 1]) add(new T.BoxGeometry(0.02, 0.32, 0.34), M.leather, sx * (bw + 0.04), bt - 0.14, sz + 0.05, 0.18, 0, sx * 0.08);
  const irons: [any, any] = [null, null];
  for (const sx of [-1, 1]) {
    add(new T.BoxGeometry(0.03, 0.42, 0.045), M.leather, sx * (bw + 0.05), bt - 0.24, sz - 0.08); // stirrup leather
    add(new T.TorusGeometry(0.065, 0.013, 6, 12), M.steel, sx * (bw + 0.05), bt - 0.5, sz - 0.08, 0, Math.PI / 2, 0); // stirrup iron (across the foot)
    irons[sx > 0 ? 0 : 1] = new T.Vector3(sx * (bw + 0.05), bt - 0.5, sz - 0.08);
  }
  const reinL = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 1, 5), M.leather);
  const reinR = new T.Mesh(new T.CylinderGeometry(0.011, 0.011, 1, 5), M.leather);
  reinL.visible = reinR.visible = false;
  const hW = new T.Vector3(); head.getWorldPosition(hW);
  return {
    root, mixer: mx, idle, walk, run, jump, neck: bone("Neck"), head, torso, tail: ["Tail1", "Tail2", "Tail3"].map(bone).filter(Boolean), blob,
    saddle, reinL, reinR, torso0inv, head0inv,
    seat0: new T.Vector3(0, bt + 0.06, sz - 0.02), bit0: new T.Vector3(0, hW.y - 0.12, hW.z + 0.34), barrel: bw, backTop: bt, irons,
  };
}

/** The saddle follows the torso bone: call after the horse's clips have run. */
export function carryTack(rig: HorseRig) {
  rig.root.updateMatrixWorld(true);
  rig.saddle.matrix.multiplyMatrices(rig.torso.matrixWorld, rig.torso0inv);
  rig.saddle.matrixWorldNeedsUpdate = true;
  rig.saddle.updateMatrixWorld(true);
}

/** The rider's pose on top of the seated clip (degrees). `?ride*` on a test page tries others. */
export const RIDE_POSE = {
  thighOut: 40, thighDown: 38, knee: -8, foot: 14, armDown: 50, armIn: 20, fore: 70, lean: 4,
};

const tmp: Record<string, any> = {};
const SAMPLERS = new WeakMap<object, { bone: any; prop: "quaternion" | "position"; interp: any; out: any }[]>();
/** Write the seated clip ("sitidle") at time t onto the person's bones (quaternions, and the hips' position). */
export function seatedPose(p: Person3D, t: number) {
  const act = p.actions.sitidle as any;
  if (!act) return;
  let list = SAMPLERS.get(p);
  if (!list) {
    list = [];
    const clip = act.getClip();
    const byName = new Map<string, any>();
    p.root.traverse((o: any) => { if (o.isBone) byName.set(o.name, o); });
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf(".");
      const bn = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
      const bone = byName.get(bn);
      if (!bone || (prop !== "quaternion" && !(prop === "position" && bn === "Hips"))) continue;
      list.push({ bone, prop: prop as "quaternion" | "position", interp: tr.createInterpolant(), out: null });
    }
    SAMPLERS.set(p, list);
  }
  for (const s of list) {
    const r = s.interp.evaluate(t);
    if (s.prop === "quaternion") s.bone.quaternion.set(r[0], r[1], r[2], r[3]).normalize();
    else s.bone.position.set(r[0], r[1], r[2]);
  }
  p.root.updateMatrixWorld(true);
}
/**
 * Sit `p` on the horse (call after the horse's clips and carryTack): the seated clip at its upright moment,
 * hips on the seat, legs round the barrel into the irons, hands on the reins.
 * `lean` (degrees) adds to the seat's forward lean (speed, a jump).
 */
export function seatRider(T: any, p: Person3D, rig: HorseRig, yaw: number, lean = 0, pose = RIDE_POSE) {
  const v = (tmp.v ??= new T.Vector3()), hips = (tmp.h ??= new T.Vector3()), bit = (tmp.b ??= new T.Vector3()), hand = (tmp.hd ??= new T.Vector3()), up = (tmp.up ??= new T.Vector3(0, 1, 0)), dir = (tmp.dir ??= new T.Vector3()), m4 = (tmp.m4 ??= new T.Matrix4());
  for (const a of Object.values(p.actions) as any[]) a.setEffectiveWeight(0);
  // the seated clip at its upright moment, written straight onto the bones every frame (sampled from the clip
  // itself, so the pose is the same each frame whatever else the body's mixer is doing: nothing builds up)
  seatedPose(p, 0.45);
  const root = p.root;
  root.rotation.set(0, yaw, 0);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  // the legs and arms first (in his own frame), then his hips onto the seat
  // (sitting, the thigh points forward: opening it is a turn about the vertical)
  turnBoneInBody(T, p, "LeftUpLeg", [0, 1, 0], pose.thighOut);
  turnBoneInBody(T, p, "RightUpLeg", [0, 1, 0], -pose.thighOut);
  turnBoneInBody(T, p, "LeftUpLeg", [1, 0, 0], pose.thighDown);
  turnBoneInBody(T, p, "RightUpLeg", [1, 0, 0], pose.thighDown);
  turnBoneInBody(T, p, "LeftLeg", [1, 0, 0], pose.knee);
  turnBoneInBody(T, p, "RightLeg", [1, 0, 0], pose.knee);
  turnBoneInBody(T, p, "LeftFoot", [1, 0, 0], -pose.foot);
  turnBoneInBody(T, p, "RightFoot", [1, 0, 0], -pose.foot);
  turnBoneInBody(T, p, "Spine", [1, 0, 0], pose.lean + lean);
  turnBoneInBody(T, p, "LeftArm", [1, 0, 0], pose.armDown);
  turnBoneInBody(T, p, "RightArm", [1, 0, 0], pose.armDown);
  turnBoneInBody(T, p, "LeftArm", [0, 1, 0], pose.armIn);
  turnBoneInBody(T, p, "RightArm", [0, 1, 0], -pose.armIn);
  turnBoneInBody(T, p, "LeftForeArm", [1, 0, 0], -pose.fore);
  turnBoneInBody(T, p, "RightForeArm", [1, 0, 0], -pose.fore);
  v.copy(rig.seat0).applyMatrix4(rig.saddle.matrix);
  p.bones.Hips.getWorldPosition(hips);
  root.position.set(v.x - hips.x, v.y - hips.y, v.z - hips.z);
  root.updateMatrixWorld(true);
  // the reins: from the bit to each hand
  bit.copy(rig.bit0).applyMatrix4(m4.multiplyMatrices(rig.head.matrixWorld, rig.head0inv));
  for (const [side, rein] of [["Left", rig.reinL], ["Right", rig.reinR]] as [string, any][]) {
    const hb = p.bones[`${side}Hand`];
    if (!hb) continue;
    hb.getWorldPosition(hand);
    const len = hand.distanceTo(bit);
    rein.position.copy(hand).add(bit).multiplyScalar(0.5);
    rein.scale.set(1, len, 1);
    rein.quaternion.setFromUnitVectors(up, dir.copy(bit).sub(hand).normalize());
  }
}

/**
 * The pose's numbers, in the horse's frame (metres; x across, y up, z along): each joint, how far each knee,
 * ankle and foot is outside the barrel (> 0 = outside), how far each foot is from its iron, the hips above
 * the seat, the hands above the withers. RUL-3D-005: the knees and feet must be outside the horse.
 */
export function riderCheck(T: any, p: Person3D, rig: HorseRig) {
  rig.root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(rig.saddle.matrix).invert();
  const at = (n: string) => { const v = new T.Vector3(); p.bones[n]?.getWorldPosition(v); return v.applyMatrix4(inv); };
  const r3 = (v: any) => [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
  const j: Record<string, number[]> = {};
  for (const n of ["Hips", "LeftUpLeg", "RightUpLeg", "LeftLeg", "RightLeg", "LeftFoot", "RightFoot", "LeftToeBase", "RightToeBase", "LeftHand", "RightHand", "Head"]) j[n] = r3(at(n));
  const outside = (n: string) => +(Math.abs(at(n).x) - rig.barrel).toFixed(3);
  const ironGap = (side: 0 | 1) => +at(side ? "RightFoot" : "LeftFoot").distanceTo(rig.irons[side]).toFixed(3);
  return {
    joints: j, barrel: +rig.barrel.toFixed(3), backTop: +rig.backTop.toFixed(3),
    kneeOut: [outside("LeftLeg"), outside("RightLeg")], footOut: [outside("LeftFoot"), outside("RightFoot")],
    ironGap: [ironGap(0), ironGap(1)],
    hipsOverSeat: +(at("Hips").y - rig.seat0.y).toFixed(3),
  };
}
