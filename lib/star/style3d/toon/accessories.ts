/**
 * WATCHES, CHAINS, HEADPHONES, SUNGLASSES AND CAPS ON A PERSON (Harry, 28 Nov 2026: "buying boots/accessories needs
 * to translate onto your guy … in your wardrobe / wearable for the rest").
 *
 *   wearAccessories(T, p, looks)   after dressPerson3d and dressCloth: one skinned mesh, ONE draw, for everything
 *                                  he wears (lib/star/wearables.ts AccessoryLook: colours, stones, shine by level).
 *
 * Every piece is fitted to THIS body, as it stands in its bind pose, by measuring it (the cloth's rule: shaped from
 * the body, never a fixed size that a bigger build or a hood would swallow):
 *   watch       a band round the left forearm 3.5 cm above the wrist, sized from the skin (or the sleeve's cuff)
 *               there, the case on the back of the wrist (the hand's own palm direction, from its finger bones)
 *   chain       a loop that rests on the neck and chest: at each of 48 angles round the neck the outermost point
 *               of skin or cloth at the chain's height, pushed out by its own thickness and 1.5 mm
 *   headphones  a band behind the neck and two cups on the collarbones, the same way
 *   sunglasses  lenses in front of the eyes (the face's front at eye height), arms along the sides of the head
 *   cap         a crown wrapped over the whole head and hair (the furthest point in each of 160 directions, +6 mm),
 *               a peak at the front
 * So nothing passes into the body or the cloth at rest (RUL-3D-005), and the sizes are the body's own (RUL-3D-006).
 * Each vertex takes the skin weights of the body points it was fitted on (the chain, point by point; the watch,
 * sunglasses and cap, their region's average), so it moves with the body in every clip.
 *
 * Cost: one draw and 1.2k to 5k triangles per person (no ink line: they are small). Low quality: no stones.
 */
import type * as THREE from "three";
import type { Person3D } from "../../people3d";
import type { AccessoryLook } from "../../wearables";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

type Three = typeof import("three");
type V = THREE.Vector3;

/** Every point of the body and its cloth in the bind pose, in his own frame (root at the origin, facing +z). */
interface Cloud { p: Float32Array; n: number; si: Uint16Array; sw: Float32Array }

/** What was built (read by the bench and the tests). */
export interface WornAccessories { mesh: THREE.SkinnedMesh; tris: number; kinds: string[] }

const NAME = "Accessories";

export function wearAccessories(T: Three, p: Person3D, looks: AccessoryLook[], opts: { low?: boolean } = {}): WornAccessories | null {
  const parent = p.body.parent;
  if (!parent) return null;
  // a second call (a change of watch) replaces what he wore
  for (const o of [...parent.children]) if (o.name === NAME) { parent.remove(o); disposeMesh(o as THREE.Mesh); }
  if (!looks.length) return null;
  const B = p.bones;
  if (!B.LeftHand || !B.LeftForeArm || !B.neck || !B.Head) return null;

  // the bind pose, his root at the origin facing +z (put back afterwards)
  const saved = new Map<THREE.Bone, [V, THREE.Quaternion, V]>();
  for (const b of p.body.skeleton.bones) saved.set(b, [b.position.clone(), b.quaternion.clone(), b.scale.clone()]);
  const rp = p.root.position.clone(), rq = p.root.quaternion.clone(), rs = p.root.scale.clone();
  p.root.position.set(0, 0, 0); p.root.quaternion.identity(); p.root.scale.set(1, 1, 1);
  // measured as he stands when built (before any clip): his bones as bound. `poseRest` would put back the FILE's
  // rest, which a body rebuilt to other proportions (toon/proportions.ts) no longer has: its face was measured 1-2 cm
  // off where it is drawn, and the lenses sank into the cheeks
  p.root.updateMatrixWorld(true);
  const W = (n: string) => { const v = new T.Vector3(); B[n]?.getWorldPosition(v); return v; };
  try {
    const cloud = cloudOf(T, p);
    HEAD_BONE = p.bones.Head ? p.body.skeleton.bones.indexOf(p.bones.Head) : -1;
    const parts: THREE.BufferGeometry[] = [];
    const kinds: string[] = [];
    let squash: ((x: V) => V | null) | null = null;
    for (const look of looks) {
      if (look.slot === "head") {
        const cp = cap(T, cloud, W, look);
        if (cp) { parts.push(cp.geo); kinds.push(look.kind); squash = cp.squash; }
        continue;
      }
      const g = look.slot === "wrist" ? watch(T, cloud, W, look, !!opts.low)
        : look.kind === "headphones" ? headphones(T, cloud, W, look)
        : look.slot === "neck" ? chain(T, cloud, W, look, !!opts.low)
        : look.slot === "eyes" ? shades(T, cloud, W, look) : null;
      if (g) { parts.push(g); kinds.push(look.kind); }
    }
    if (!parts.length) return null;
    const geo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    parts.forEach((g) => g.dispose());
    if (!geo) return null;
    // his own frame → the body's geometry space, point by point through its own skin weights (a Style A head is
    // drawn bigger than the file's: its bones carry a scale, so one matrix for the whole body is not enough)
    p.body.updateMatrixWorld(true);
    const inv = skinInverse(T, p);
    const gp = geo.getAttribute("position") as THREE.BufferAttribute, gn = geo.getAttribute("normal") as THREE.BufferAttribute;
    const gsi = geo.getAttribute("skinIndex") as THREE.BufferAttribute, gsw = geo.getAttribute("skinWeight") as THREE.BufferAttribute;
    const pv = new T.Vector3(), nv = new T.Vector3(), n3 = new T.Matrix3();
    for (let i = 0; i < gp.count; i++) {
      const M = inv(gsi, gsw, i);
      pv.fromBufferAttribute(gp, i).applyMatrix4(M); gp.setXYZ(i, pv.x, pv.y, pv.z);
      nv.fromBufferAttribute(gn, i).applyMatrix3(n3.setFromMatrix4(M)).normalize(); gn.setXYZ(i, nv.x, nv.y, nv.z);
    }
    // a cap presses the hair in: his own copy of the body's mesh, every point outside the crown moved inside it
    if (squash && !(globalThis as { __noSquash?: boolean }).__noSquash) squashBody(T, p, squash, inv);
    geo.computeBoundingSphere();
    const mesh = new T.SkinnedMesh(geo, accessoryMaterial(T));
    mesh.name = NAME; mesh.frustumCulled = false; mesh.castShadow = p.body.castShadow; mesh.userData.kinds = kinds;
    parent.add(mesh);
    mesh.bind(p.body.skeleton, p.body.bindMatrix);
    return { mesh, tris: geo.getAttribute("position").count / 3, kinds };
  } finally {
    saved.forEach(([pos, q, sc], b) => { b.position.copy(pos); b.quaternion.copy(q); b.scale.copy(sc); });
    p.root.position.copy(rp); p.root.quaternion.copy(rq); p.root.scale.copy(rs);
    p.root.updateMatrixWorld(true);
  }
}

/** Move the body's points that stand out of the cap inside it (his own copy of the mesh; the outline shares it). */
/**
 * World (his frame, bind pose) → a mesh's geometry space for a point with given skin weights: the inverse of
 * world · bindMatrixInverse · Σ w (bone world · bone inverse) · bindMatrix. Cached by weights.
 */
function skinInverse(T: Three, p: Person3D) {
  const sk = p.body.skeleton, cache = new Map<string, THREE.Matrix4>();
  const BM = sk.bones.map((b, k) => b.matrixWorld.clone().multiply(sk.boneInverses[k]));
  const pre = p.body.matrixWorld.clone().multiply(p.body.bindMatrixInverse), post = p.body.bindMatrix;
  return (si: THREE.BufferAttribute, sw: THREE.BufferAttribute, i: number): THREE.Matrix4 => {
    let key = "";
    for (let q = 0; q < 4; q++) key += `${si.getComponent(i, q)}:${sw.getComponent(i, q).toFixed(3)},`;
    let m = cache.get(key);
    if (m) return m;
    const e = new Array(16).fill(0);
    for (let q = 0; q < 4; q++) {
      const w = sw.getComponent(i, q);
      if (!w) continue;
      const b = BM[si.getComponent(i, q)];
      if (!b) continue;
      for (let k = 0; k < 16; k++) e[k] += b.elements[k] * w;
    }
    m = pre.clone().multiply(new T.Matrix4().fromArray(e)).multiply(post).invert();
    cache.set(key, m);
    return m;
  };
}

function squashBody(T: Three, p: Person3D, squash: (x: V) => V | null, inv: ReturnType<typeof skinInverse>) {
  const src = p.body.geometry;
  const geo = src.clone(), ink = src.clone();
  const pos = geo.getAttribute("position") as THREE.BufferAttribute, ipos = ink.getAttribute("position") as THREE.BufferAttribute;
  // the paint keeps the file's own rest (hair stays hair where it was pressed in: toon/shader.ts TOON_AREST)
  if (!geo.getAttribute("aRest")) geo.setAttribute("aRest", new T.BufferAttribute(new Float32Array(pos.array as ArrayLike<number>), 3));
  const si = src.getAttribute("skinIndex") as THREE.BufferAttribute, sw = src.getAttribute("skinWeight") as THREE.BufferAttribute;
  const v = new T.Vector3(), head = new T.Vector3();
  p.bones.Head.getWorldPosition(head);
  let moved = 0;
  for (let i = 0; i < pos.count; i++) {
    p.body.getVertexPosition(i, v);
    v.applyMatrix4(p.body.matrixWorld);
    const to = squash(v);
    if (!to) continue;
    const M = inv(si, sw, i);
    // the ink line's copy goes deeper still: it is drawn 1.5 cm nearer the camera (people3d.ts outline) and would
    // show through the crown as dark streaks
    const deep = to.clone().lerp(head, 0.4).applyMatrix4(M);
    to.applyMatrix4(M);
    pos.setXYZ(i, to.x, to.y, to.z);
    ipos.setXYZ(i, deep.x, deep.y, deep.z);
    moved++;
  }
  if (!moved) { geo.dispose(); ink.dispose(); return; }
  pos.needsUpdate = true; ipos.needsUpdate = true; // (normals kept: pressed-in hair still faces out)
  geo.userData = { ...src.userData, squashed: moved };
  p.body.geometry = geo;
  p.outline.geometry = ink;
  const mat = p.body.material as THREE.Material & { defines?: Record<string, string> };
  if (!mat.defines || !("TOON_AREST" in mat.defines)) { mat.defines = { ...(mat.defines ?? {}), TOON_AREST: "" }; mat.needsUpdate = true; }
  // check: nothing left outside the crown (read by the bench: geometry.userData.squashLeft)
  let left = 0;
  for (let i = 0; i < pos.count; i++) { p.body.getVertexPosition(i, v); v.applyMatrix4(p.body.matrixWorld); const to = squash(v); if (to && to.distanceTo(v) > 0.002) left++; }
  geo.userData.squashLeft = left;
}

function disposeMesh(m: THREE.Mesh) { m.geometry?.dispose(); (m.material as THREE.Material | undefined)?.dispose?.(); }

/** The body and every cloth piece over it (not the ink lines), skinned into his frame. */
function cloudOf(T: Three, p: Person3D): Cloud {
  const meshes = (p.body.parent?.children ?? []).filter((o): o is THREE.SkinnedMesh =>
    (o as THREE.SkinnedMesh).isSkinnedMesh && o !== p.outline && o.name !== "ClothInk" && o.name !== NAME && (o.visible || o === p.body));
  let n = 0;
  for (const m of meshes) n += m.geometry.getAttribute("position").count;
  const P = new Float32Array(n * 3), SI = new Uint16Array(n * 4), SWt = new Float32Array(n * 4);
  const v = new T.Vector3();
  let k = 0;
  for (const m of meshes) {
    m.updateMatrixWorld(true);
    const g = m.geometry, c = g.getAttribute("position").count;
    const si = g.getAttribute("skinIndex"), sw = g.getAttribute("skinWeight");
    for (let i = 0; i < c; i++, k++) {
      m.getVertexPosition(i, v);
      v.applyMatrix4(m.matrixWorld);
      P[k * 3] = v.x; P[k * 3 + 1] = v.y; P[k * 3 + 2] = v.z;
      for (let q = 0; q < 4; q++) { SI[k * 4 + q] = si ? si.getComponent(i, q) : 0; SWt[k * 4 + q] = sw ? sw.getComponent(i, q) : q === 0 ? 1 : 0; }
    }
  }
  return { p: P, n: k, si: SI, sw: SWt };
}

/** Weights averaged over some cloud points, the four biggest kept. */
function avgWeights(c: Cloud, idx: number[]): [number[], number[]] {
  const acc = new Map<number, number>();
  for (const i of idx) for (let q = 0; q < 4; q++) { const w = c.sw[i * 4 + q]; if (w > 0) acc.set(c.si[i * 4 + q], (acc.get(c.si[i * 4 + q]) ?? 0) + w); }
  const top = Array.from(acc.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, e) => s + e[1], 0) || 1;
  const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
  top.forEach(([b, w], q) => { si[q] = b; sw[q] = w / sum; });
  if (!top.length) sw[0] = 1;
  return [si, sw];
}

/** All the weight on the one bone that carries most of these points (a rigid piece: sunglasses, a cap). */
function rigidWeights(c: Cloud, idx: number[]): [number[], number[]] {
  // the Head bone itself when there is one (the points' own majority could be the neck on some builds: the glasses
  // then followed the neck while the face followed the head, and the face came through the lenses in a pose)
  if (HEAD_BONE >= 0) return [[HEAD_BONE, 0, 0, 0], [1, 0, 0, 0]];
  const [si] = avgWeights(c, idx);
  return [[si[0], 0, 0, 0], [1, 0, 0, 0]];
}
let HEAD_BONE = -1;

/** Colour, shine and weights on a piece (every vertex the same, or by a function of the vertex). */
function finish(T: Three, g: THREE.BufferGeometry, hex: string, shine: number, w: [number[], number[]] | ((i: number, pos: V) => [number[], number[]])): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  if (ng !== g) g.dispose();
  for (const a of Object.keys(ng.attributes)) if (a !== "position" && a !== "normal") ng.deleteAttribute(a);
  if (!ng.getAttribute("normal")) ng.computeVertexNormals();
  const n = ng.getAttribute("position").count;
  const col = new T.Color(hex).convertSRGBToLinear();
  const C = new Float32Array(n * 3), S = new Float32Array(n), SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  const v = new T.Vector3();
  for (let i = 0; i < n; i++) {
    C[i * 3] = col.r; C[i * 3 + 1] = col.g; C[i * 3 + 2] = col.b; S[i] = shine;
    const [si, sw] = typeof w === "function" ? w(i, v.fromBufferAttribute(ng.getAttribute("position") as THREE.BufferAttribute, i)) : w;
    for (let q = 0; q < 4; q++) { SI[i * 4 + q] = si[q]; SW[i * 4 + q] = sw[q]; }
  }
  ng.setAttribute("color", new T.BufferAttribute(C, 3));
  ng.setAttribute("aShine", new T.BufferAttribute(S, 1));
  ng.setAttribute("skinIndex", new T.Uint16BufferAttribute(SI, 4));
  ng.setAttribute("skinWeight", new T.BufferAttribute(SW, 4));
  return ng;
}

/** A piece placed by a basis (x, y, z axes and an origin). */
function place(T: Three, g: THREE.BufferGeometry, o: V, x: V, y: V, z: V): THREE.BufferGeometry {
  g.applyMatrix4(new T.Matrix4().makeBasis(x, y, z).setPosition(o));
  return g;
}

// ── the watch ─────────────────────────────────────────────────────────────

function watch(T: Three, c: Cloud, W: (n: string) => V, look: AccessoryLook, low: boolean): THREE.BufferGeometry | null {
  const hand = W("LeftHand"), fore = W("LeftForeArm");
  const a = hand.clone().sub(fore).normalize();                  // along the forearm, to the hand
  const ctr = hand.clone().addScaledVector(a, -0.035);
  // the back of the hand: from its finger bones (index → little across, wrist → middle along)
  const along = W("LeftHandMiddle1").sub(hand), across = W("LeftHandIndex1").sub(W("LeftHandLittle1"));
  let back = new T.Vector3().crossVectors(along, across).multiplyScalar(-1);
  if (back.lengthSq() < 1e-8) back = new T.Vector3(1, 0, 0);
  back.addScaledVector(a, -back.dot(a)).normalize();
  const side = new T.Vector3().crossVectors(a, back).normalize();
  // the skin (or a sleeve's cuff) round that point: its radius at 32 angles
  const N = 32, R = new Array(N).fill(0), idx: number[] = [];
  const d = new T.Vector3();
  for (let i = 0; i < c.n; i++) {
    d.set(c.p[i * 3] - ctr.x, c.p[i * 3 + 1] - ctr.y, c.p[i * 3 + 2] - ctr.z);
    const t = d.dot(a);
    if (Math.abs(t) > 0.026) continue; // (a bare forearm has a ring of points every ~3 cm)
    d.addScaledVector(a, -t);
    const r = d.length();
    if (r > 0.075) continue;
    idx.push(i);
    const k = Math.floor(((Math.atan2(d.dot(side), d.dot(back)) / (Math.PI * 2)) + 1) * N) % N;
    R[k] = Math.max(R[k], r);
  }
  if (idx.length < 6) { console.info(`[accessories] no wrist found (${idx.length} points)`, ctr.toArray().map((x) => +x.toFixed(3))); return null; }
  const Rr = dilateSmooth(R, 2).map((r) => r + 0.0018);
  const w = avgWeights(c, idx);
  const lux = look.kind === "luxwatch", smart = look.kind === "smartwatch";
  const out: THREE.BufferGeometry[] = [];
  // the strap / bracelet: 1.7 cm wide (2 cm for a smartwatch's rubber), 2.2 mm thick, following the arm
  out.push(finish(T, bandRing(T, Rr, ctr, a, back, side, smart ? 0.02 : 0.017, 0.0022), look.main, look.shine * (smart ? 0.3 : 1), w));
  // a metal bracelet (L3 and up, not the smartwatch): its links as rings across the band
  if (!smart && look.level >= 3) {
    for (let k = 0; k < 32; k += 2) {
      const q = (k / 32) * Math.PI * 2, r = Rr[k] + 0.0023;
      const at = ctr.clone().addScaledVector(back, Math.cos(q) * r).addScaledVector(side, Math.sin(q) * r);
      const n = back.clone().multiplyScalar(Math.cos(q)).addScaledVector(side, Math.sin(q)).normalize();
      const lk = new T.BoxGeometry(0.0016, 0.0005, 0.0165);
      out.push(finish(T, place(T, lk, at, new T.Vector3().crossVectors(n, a), n, a), look.second, look.shine, w));
    }
  }
  // the case on the back of the wrist, turned a little towards the front so it is seen
  const fwd = new T.Vector3(0, 0, 1).addScaledVector(a, -a.z).normalize();
  const faceDir = back.clone().addScaledVector(fwd, 0.35).normalize();
  const fSide = new T.Vector3().crossVectors(a, faceDir).normalize();
  const k0 = Math.round(((Math.atan2(faceDir.dot(side), faceDir.dot(back)) / (Math.PI * 2)) + 1) * 32) % 32;
  const rBack = Rr[k0] + 0.0022;
  const caseR = lux ? 0.0185 : 0.0175, caseH = smart ? 0.0085 : 0.0075;
  const base = ctr.clone().addScaledVector(faceDir, rBack - 0.0015);
  const top = base.clone().addScaledVector(faceDir, caseH);
  // lugs: the case joined to the strap above and below
  for (const sg of [-1, 1]) {
    const lug = new T.BoxGeometry(caseR * 0.85, caseH * 0.5, 0.0055);
    out.push(finish(T, place(T, lug, base.clone().addScaledVector(faceDir, caseH * 0.25).addScaledVector(a, sg * caseR * 0.92), fSide, faceDir, a), look.second, look.shine, w));
  }
  if (smart) {
    // a rounded square, a black glass screen with a bright ring and time
    const caseG = new T.BoxGeometry(caseR * 1.75, caseH, caseR * 2.05);
    out.push(finish(T, place(T, caseG, base.clone().addScaledVector(faceDir, caseH / 2), fSide, faceDir, a), look.second, look.shine, w));
    const scr = new T.BoxGeometry(caseR * 1.5, 0.0008, caseR * 1.8);
    out.push(finish(T, place(T, scr, top.clone().addScaledVector(faceDir, 0.0002), fSide, faceDir, a), "#0b0d12", 1, w));
    const ring = new T.TorusGeometry(caseR * 0.55, 0.0011, 4, 24); ring.rotateX(Math.PI / 2);
    out.push(finish(T, place(T, ring, top.clone().addScaledVector(faceDir, 0.0008), fSide, faceDir, a), look.detail, 1, w));
    for (const [x0, len] of [[-0.004, 0.006], [0.003, 0.004]] as const) {
      const bar = new T.BoxGeometry(0.0013, 0.0006, len); bar.translate(x0, 0, 0);
      out.push(finish(T, place(T, bar, top.clone().addScaledVector(faceDir, 0.0009), fSide, faceDir, a), "#ffffff", 1, w));
    }
  } else {
    const caseG = new T.CylinderGeometry(caseR, caseR * 1.04, caseH, 32, 1);
    out.push(finish(T, place(T, caseG, base.clone().addScaledVector(faceDir, caseH / 2), fSide, faceDir, a), look.second, look.shine, w));
    // the bezel: a bright ring round the dial
    const bez = new T.TorusGeometry(caseR * 0.9, caseR * 0.1, 6, 32); bez.rotateX(Math.PI / 2);
    out.push(finish(T, place(T, bez, top, fSide, faceDir, a), look.second, Math.min(1, look.shine + 0.2), w));
    // the dial (a light face), its twelve markers and the two hands
    const dial = new T.CylinderGeometry(caseR * 0.8, caseR * 0.8, 0.0008, 32);
    out.push(finish(T, place(T, dial, top.clone().addScaledVector(faceDir, 0.0002), fSide, faceDir, a), look.detail, 0.6, w));
    const mark = look.level >= 4 ? look.second : "#2a2c33";
    for (let m = 0; m < 12; m++) {
      const q = (m / 12) * Math.PI * 2, big = m % 3 === 0;
      const mk = new T.BoxGeometry(big ? 0.0014 : 0.0009, 0.0006, big ? 0.0036 : 0.0022);
      mk.translate(0, 0, caseR * 0.62); mk.rotateY(q);
      out.push(finish(T, place(T, mk, top.clone().addScaledVector(faceDir, 0.0007), fSide, faceDir, a), mark, 0.8, w));
    }
    for (const [len, ang, wd] of [[0.45, 0.95, 0.0016], [0.66, -0.55, 0.0011]] as const) {
      const h = new T.BoxGeometry(wd, 0.0006, caseR * len);
      h.translate(0, 0, caseR * len * 0.45); h.rotateY(ang);
      out.push(finish(T, place(T, h, top.clone().addScaledVector(faceDir, 0.0011), fSide, faceDir, a), "#16171c", 0.6, w));
    }
    const pin = new T.CylinderGeometry(0.0013, 0.0013, 0.001, 8);
    out.push(finish(T, place(T, pin, top.clone().addScaledVector(faceDir, 0.0013), fSide, faceDir, a), look.second, 1, w));
    // the crown at 3 o'clock
    const crown = new T.CylinderGeometry(0.0021, 0.0021, 0.0034, 10); crown.rotateZ(Math.PI / 2);
    out.push(finish(T, place(T, crown, base.clone().addScaledVector(faceDir, caseH * 0.5).addScaledVector(fSide, -(caseR + 0.0016)), fSide, faceDir, a), look.second, look.shine, w));
  }
  // stones round the bezel
  if (look.stones > 0 && !low && !smart) {
    for (let st = 0; st < look.stones; st++) {
      const q = (st / look.stones) * Math.PI * 2;
      const g = new T.OctahedronGeometry(0.0015, 0);
      const at = top.clone().addScaledVector(faceDir, 0.0012).addScaledVector(fSide, Math.cos(q) * caseR * 0.9).addScaledVector(a, Math.sin(q) * caseR * 0.9);
      out.push(finish(T, place(T, g, at, fSide, faceDir, a), "#ffffff", 1, w));
    }
  }
  return mergeGeometries(out, false);
}

/** Radii by angle: grown to the biggest of each neighbourhood, then smoothed, never under the raw value. */
function dilateSmooth(R: number[], k: number): number[] {
  const N = R.length;
  const fill = R.map((r, i) => (r > 0 ? r : Math.max(...[-2, -1, 1, 2].map((o) => R[(i + o + N) % N]))));
  const dil = fill.map((_, i) => { let m = 0; for (let o = -k; o <= k; o++) m = Math.max(m, fill[(i + o + N) % N]); return m; });
  const sm = dil.map((_, i) => { let s = 0; for (let o = -k; o <= k; o++) s += dil[(i + o + N) % N]; return s / (2 * k + 1); });
  return sm.map((r, i) => Math.max(r, fill[i]));
}

/** A flat band round an axis, radius by angle (Rr), width along the axis, thickness outwards. */
function bandRing(T: Three, Rr: number[], ctr: V, a: V, x: V, y: V, width: number, thick: number): THREE.BufferGeometry {
  const N = Rr.length, pos: number[] = [], ind: number[] = [];
  const P = (k: number, r: number, t: number) => {
    const q = (k / N) * Math.PI * 2;
    const v = ctr.clone().addScaledVector(x, Math.cos(q) * r).addScaledVector(y, Math.sin(q) * r).addScaledVector(a, t);
    pos.push(v.x, v.y, v.z);
  };
  // four rings: inner low, outer low, outer high, inner high
  for (let k = 0; k < N; k++) { const r = Rr[k]; P(k, r, -width / 2); P(k, r + thick, -width / 2); P(k, r + thick, width / 2); P(k, r, width / 2); }
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    for (let s = 0; s < 4; s++) {
      const s2 = (s + 1) % 4;
      const A = k * 4 + s, Bv = k * 4 + s2, C = k2 * 4 + s2, D = k2 * 4 + s;
      ind.push(A, D, C, A, C, Bv);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setIndex(ind);
  g.computeVertexNormals();
  const ng = g.toNonIndexed(); g.dispose();
  return ng;
}

// ── the chain and the necklace ────────────────────────────────────────────

/**
 * The loop round the neck (0 = the front). Behind and at the sides it LIES on the shoulders: at a radius just
 * outside the neck (and any collar or hood), on top of whatever is there. At the front it HANGS down the chest:
 * the outermost skin or cloth at its height. Both pushed out by `out`. Returns the points and, for each, the body
 * point it rests on (its skin weights move it).
 */
function neckLoop(T: Three, c: Cloud, W: (n: string) => V, dropFront: number, lift: number, out: number, N = 48, vee = 1.4) {
  const neck = W("neck"), head = W("Head");
  const ax = neck.x, az = neck.z + 0.008;
  const y0 = neck.y + lift;
  const FRONT = 0.35;
  /** The outermost point at a height, along an angle: [radius, index]. */
  const radial = (dx: number, dz: number, y: number, rMax: number, band = 0.011): [number, number] => {
    let best = 0, bi = -1;
    for (let i = 0; i < c.n; i++) {
      const py = c.p[i * 3 + 1];
      if (Math.abs(py - y) > band) continue;
      const rx = c.p[i * 3] - ax, rz = c.p[i * 3 + 2] - az;
      const r = rx * dx + rz * dz;
      if (r <= 0 || r > rMax) continue;
      if (Math.abs(rx * dz - rz * dx) > Math.max(0.01, r * 0.15)) continue;
      if (r > best) { best = r; bi = i; }
    }
    return [best, bi];
  };
  /** The top of what lies at a radius along an angle (the shoulder under the loop, never the neck inside it): [y, index]. */
  const topAt = (dx: number, dz: number, r0: number, below: number): [number, number] => {
    let best = -1, bi = -1;
    for (let i = 0; i < c.n; i++) {
      const py = c.p[i * 3 + 1];
      if (py > below || py < below - 0.25) continue;
      const rx = c.p[i * 3] - ax, rz = c.p[i * 3 + 2] - az;
      const r = rx * dx + rz * dz;
      if (Math.abs(r - r0) > 0.006 || Math.abs(rx * dz - rz * dx) > 0.012) continue;
      if (py > best) { best = py; bi = i; }
    }
    return [best, bi];
  };
  const P: V[] = [], near: number[] = [];
  let yJoin = y0;
  // the back and sides first (so the front knows where it joins), then the front
  const order = Array.from({ length: N }, (_, k) => k).sort((a, b) => Math.cos((a / N) * Math.PI * 2) - Math.cos((b / N) * Math.PI * 2));
  const tmp: ({ p: V; i: number } | null)[] = new Array(N).fill(null);
  for (const k of order) {
    const q = (k / N) * Math.PI * 2, dx = Math.sin(q), dz = Math.cos(q), f = Math.max(0, dz);
    if (f < FRONT) {
      // just outside the neck (its skin, a collar, a hood) at the neck's base, then on top of what is there
      const [rn] = radial(dx, dz, y0 + 0.012, 0.11, 0.008);
      const r = Math.max(0.058 + 0.008 * Math.abs(dx), rn + out + 0.003);
      const x = ax + dx * r, z = az + dz * r;
      const [yt, it] = topAt(dx, dz, r, y0 + 0.03);
      const y = Math.max(y0, yt > 0 ? yt + out : y0);
      tmp[k] = { p: new T.Vector3(x, y, z), i: it };
      if (f > FRONT - 0.12) yJoin = Math.min(yJoin, y);
    } else {
      const t = (f - FRONT) / (1 - FRONT);
      const y = yJoin - dropFront * Math.pow(t, vee);
      const [r, i] = radial(dx, dz, y, 0.2);
      tmp[k] = { p: new T.Vector3(ax + dx * (r + out), y, az + dz * (r + out)), i };
    }
  }
  for (let k = 0; k < N; k++) { P.push(tmp[k]!.p); near.push(tmp[k]!.i); }
  // smooth the loop (a chain has no kinks), never into the body: each point only ever moves outwards or up
  for (let it = 0; it < 14; it++) {
    const Q = P.map((p) => p.clone());
    for (let k = 0; k < N; k++) {
      const a = Q[(k + N - 1) % N], b = Q[(k + 1) % N], m = a.clone().add(b).multiplyScalar(0.5);
      const rOld = Math.hypot(P[k].x - ax, P[k].z - az), rNew = Math.hypot(m.x - ax, m.z - az);
      if (rNew >= rOld) { P[k].x = m.x; P[k].z = m.z; }
      // (only behind and at the sides: the front hangs down the chest by design)
      if (m.y > P[k].y && Math.cos((k / N) * Math.PI * 2) < FRONT) P[k].y = m.y;
    }
  }
  // a point the scan missed takes the nearest found point's weights
  for (let k = 0; k < N; k++) if (near[k] < 0) { for (let o = 1; o < N; o++) { const j = near[(k + o) % N] >= 0 ? (k + o) % N : near[(k - o + N) % N] >= 0 ? (k - o + N) % N : -1; if (j >= 0) { near[k] = near[j]; break; } } }
  return { P, near };
}

function chain(T: Three, c: Cloud, W: (n: string) => V, look: AccessoryLook, low: boolean): THREE.BufferGeometry | null {
  const necklace = look.kind === "necklace";
  const th = look.thick;
  const { P, near } = neckLoop(T, c, W, necklace ? 0.075 : 0.095, -0.028, th * 1.5 + 0.0012, 48, 1.0);
  if (near.some((i) => i < 0)) return null;
  const N = P.length;
  const curve = new T.CatmullRomCurve3(P, true, "centripetal");
  // links: the tube's radius swells and narrows every `pitch` (a run of small beads/links, read as a chain at phone size)
  const len = curve.getLength(), pitch = necklace ? 0.0036 : 0.003 + th * 1.2;
  const links = Math.max(40, Math.round(len / pitch));
  const RPL = 2, RS = low ? 4 : 5, TS = links * RPL;
  const tube = new T.TubeGeometry(curve, TS, th, RS, true);
  const pos = tube.getAttribute("position") as THREE.BufferAttribute;
  const ring = new Float32Array(pos.count);
  const pt = new T.Vector3(), cen = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const j = Math.floor(i / (RS + 1));
    ring[i] = j;
    curve.getPointAt((j % TS) / TS, cen);
    const ph = (j % RPL) / RPL;
    const k = 0.45 + 0.85 * Math.sin(Math.PI * (ph + 0.5 / RPL));
    pt.fromBufferAttribute(pos, i).sub(cen).multiplyScalar(k).add(cen);
    pos.setXYZ(i, pt.x, pt.y, pt.z);
  }
  tube.setAttribute("aRing", new T.BufferAttribute(ring, 1));
  tube.computeVertexNormals();
  const idxW = Array.from({ length: N }, (_, k) => avgWeights(c, [near[k]]));
  const tubeW = tube.toNonIndexed(); tube.dispose();
  const rings = tubeW.getAttribute("aRing") as THREE.BufferAttribute;
  const out: THREE.BufferGeometry[] = [finish(T, tubeW, look.main, look.shine, (i) => idxW[Math.round((rings.getX(i) / TS) * N) % N])];
  // the pendant at the front, small: a drop for the necklace, a disc from L4 for the chain
  const front = P[0], fw = idxW[0];
  const outN = new T.Vector3(front.x - W("neck").x, 0, front.z - W("neck").z).normalize();
  const sideV = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), outN).normalize();
  const dn = new T.Vector3().crossVectors(outN, sideV).normalize();
  if (necklace) {
    const gem = new T.OctahedronGeometry(0.0055, 0); gem.scale(0.8, 1.3, 0.5);
    out.push(finish(T, place(T, gem, front.clone().addScaledVector(dn, -0.008).addScaledVector(outN, 0.0025), sideV, dn.clone().multiplyScalar(-1), outN), look.detail, 1, fw));
    if (!low) for (let st = 1; st < Math.max(1, look.stones); st++) {
      const sd = st % 2 ? 1 : -1, step = Math.ceil(st / 2);
      const kk = (sd > 0 ? step * 2 : N - step * 2) % N;
      const g = new T.OctahedronGeometry(0.0024, 0);
      out.push(finish(T, place(T, g, P[kk].clone().addScaledVector(outN, 0.0012), sideV, dn, outN), "#ffffff", 1, idxW[kk]));
    }
  } else if (look.level >= 4) {
    const med = new T.CylinderGeometry(0.0065, 0.0065, 0.0018, 20); med.rotateX(Math.PI / 2);
    out.push(finish(T, place(T, med, front.clone().addScaledVector(dn, -0.0085).addScaledVector(outN, 0.002), sideV, dn, outN), look.second, look.shine, fw));
    if (look.stones > 0 && !low) {
      const g = new T.OctahedronGeometry(0.0026, 0);
      out.push(finish(T, place(T, g, front.clone().addScaledVector(dn, -0.0085).addScaledVector(outN, 0.0035), sideV, dn, outN), "#ffffff", 1, fw));
    }
  }
  return mergeGeometries(out, false);
}

// ── headphones round the neck ─────────────────────────────────────────────

function headphones(T: Three, c: Cloud, W: (n: string) => V, look: AccessoryLook): THREE.BufferGeometry | null {
  const cupT = 0.022, cupR = 0.036;
  const { P, near } = neckLoop(T, c, W, 0.03, -0.005, 0.008, 48);
  if (near.some((i) => i < 0)) return null;
  const N = P.length, idxW = Array.from({ length: N }, (_, k) => avgWeights(c, [near[k]]));
  // the band: behind the neck from one cup to the other (angles 60° → 300° the long way, through the back)
  const k0 = Math.round(N * 0.17), k1 = N - k0;
  const arc = P.slice(k0, k1 + 1);
  const curve = new T.CatmullRomCurve3(arc, false, "centripetal");
  const TS = 40, RS = 8;
  const tube = new T.TubeGeometry(curve, TS, 0.0075, RS, false);
  const ring = new Float32Array(tube.getAttribute("position").count);
  for (let i = 0; i < ring.length; i++) ring[i] = Math.floor(i / (RS + 1));
  tube.setAttribute("aRing", new T.BufferAttribute(ring, 1));
  const tw = tube.toNonIndexed(); tube.dispose();
  const rings = tw.getAttribute("aRing") as THREE.BufferAttribute;
  const out: THREE.BufferGeometry[] = [finish(T, tw, look.main, look.shine, (i) => idxW[(k0 + Math.round((rings.getX(i) / TS) * (k1 - k0))) % N])];
  // the cups: on the collarbones each side of the neck, facing out and forward
  const neck = W("neck");
  for (const k of [k0, k1]) {
    const at = P[k % N];
    const outN = new T.Vector3(at.x - neck.x, 0, at.z - neck.z).normalize();
    const up = new T.Vector3(0, 1, 0), sideV = new T.Vector3().crossVectors(up, outN).normalize();
    const cup = new T.CylinderGeometry(cupR, cupR * 0.94, cupT, 22);
    const o = at.clone().addScaledVector(outN, cupT / 2 - 0.004).addScaledVector(up, -cupR * 0.55);
    out.push(finish(T, place(T, cup, o, sideV, outN, new T.Vector3().crossVectors(sideV, outN)), look.second, look.shine * 0.6, idxW[k % N]));
    const pad = new T.CylinderGeometry(cupR * 0.62, cupR * 0.62, 0.002, 22);
    out.push(finish(T, place(T, pad, o.clone().addScaledVector(outN, cupT / 2), sideV, outN, new T.Vector3().crossVectors(sideV, outN)), look.detail, look.shine, idxW[k % N]));
  }
  return mergeGeometries(out, false);
}

// ── sunglasses ────────────────────────────────────────────────────────────

/** The head points: everything above the jaw that moves with the Head bone. */
function headPoints(c: Cloud, W: (n: string) => V, yMin: number): number[] {
  const head = W("Head");
  const out: number[] = [];
  for (let i = 0; i < c.n; i++) {
    if (c.p[i * 3 + 1] < yMin) continue;
    const dx = c.p[i * 3] - head.x, dz = c.p[i * 3 + 2] - head.z;
    if (dx * dx + dz * dz > 0.16 * 0.16) continue;
    out.push(i);
  }
  return out;
}

function shades(T: Three, c: Cloud, W: (n: string) => V, look: AccessoryLook): THREE.BufferGeometry | null {
  const head = W("Head"), hf = W("headfront");
  const pts = headPoints(c, W, head.y - 0.02);
  if (pts.length < 50) return null;
  const w = rigidWeights(c, pts); // the head is rigid: all on its main bone (an average with the neck slid the cap over the brow as he moved)
  // eye height: a little over the Head joint, the face's own (meta face eyeY is 2.2 cm above it on the files)
  const hs = hf.distanceTo(head) / 0.093;
  const eyeY = head.y + 0.022 * hs;
  let zf = -1, xs = 0;
  for (const i of pts) {
    const x = c.p[i * 3], y = c.p[i * 3 + 1], z = c.p[i * 3 + 2];
    if (Math.abs(y - eyeY + 0.002) < 0.021 * hs && Math.abs(x - head.x) < 0.07 * hs && z > head.z) zf = Math.max(zf, z); // the whole lens box clear of the brows, nose and cheeks
    if (Math.abs(y - eyeY) < 0.015 && z < hf.z - 0.015 && z > head.z + 0.03 * hs && Math.abs(x - head.x) < 0.1 * hs) xs = Math.max(xs, Math.abs(x - head.x)); // the temples, in front of the ears
  }
  if (zf < 0) return null;
  const out: THREE.BufferGeometry[] = [];
  // the nose bridge (the centre strip at eye height) and the cheeks under the lenses: the front sits just clear of both
  let zn = -1, zc = -1;
  for (const i of pts) {
    const x = c.p[i * 3] - head.x, y = c.p[i * 3 + 1], z = c.p[i * 3 + 2];
    if (z <= head.z) continue;
    if (Math.abs(y - eyeY) < 0.01 * hs && Math.abs(x) < 0.012 * hs) zn = Math.max(zn, z);
    else if (Math.abs(y - eyeY + 0.002) < 0.019 * hs && Math.abs(x) < 0.06 * hs) zc = Math.max(zc, z);
  }
  const frame = 0.0022, half = Math.max(0.05 * hs, xs + 0.002);
  // (the bridge wide enough to sit on the nose, never across it: the lens's inner lower corner was cut by the nose)
  const bw = 0.014 * hs;
  const lensW = Math.min(0.05 * hs, half - bw - frame * 2), lensH = 0.027 * hs, lensX = bw + frame + lensW / 2;
  // the lens plane: just in front of every point of the face behind either lens (nose sides, cheeks, brows)
  const lensY = eyeY + 0.003;
  let zBox = -1;
  for (const i of pts) {
    const x = Math.abs(c.p[i * 3] - head.x), y = c.p[i * 3 + 1], z = c.p[i * 3 + 2];
    if (z > head.z && Math.abs(x - lensX) < lensW / 2 + frame + 0.004 && Math.abs(y - lensY) < lensH / 2 + frame + 0.012) zBox = Math.max(zBox, z);
  }
  // (+ a margin that grows with the head's drawn scale: a big-headed build's cheeks came 1 cm further forward than measured
  // in its clips — not understood yet; measured on the bench, c1 1.09 needs none, c2 1.22 about 1.2 cm)
  const zl = Math.max(zn + 0.005, zBox + 0.0045 + Math.max(0, hs - 1.12) * 0.12);
  if ((globalThis as { __accDebug?: boolean }).__accDebug) console.info(`[accessories] shades head ${head.toArray().map((v) => v.toFixed(3))} zn ${zn.toFixed(3)} zBox ${zBox.toFixed(3)} zl ${zl.toFixed(3)} lensX ${lensX.toFixed(3)} lensW ${lensW.toFixed(3)} hs ${hs.toFixed(2)}`);
  for (const sd of [-1, 1]) {
    const lens = roundedPlate(T, lensW, lensH, 0.011, 0.0016);
    lens.rotateY(sd * 0.05);
    lens.translate(head.x + sd * lensX, lensY, zl);
    out.push(finish(T, lens, look.second, 1, w));
    const rim = roundedRing(T, lensW + frame * 2, lensH + frame * 2, 0.012, frame, 0.0026);
    rim.rotateY(sd * 0.05);
    rim.translate(head.x + sd * lensX, lensY, zl + 0.0004);
    out.push(finish(T, rim, look.main, look.shine, w));
  }
  // the bridge over the nose
  const bridge = new T.TubeGeometry(new T.QuadraticBezierCurve3(new T.Vector3(head.x - bw, lensY + 0.007, zl), new T.Vector3(head.x, lensY + 0.011, zl + 0.0015), new T.Vector3(head.x + bw, lensY + 0.007, zl)), 6, 0.0014, 5, false);
  out.push(finish(T, bridge, look.main, look.shine, w));
  // the arms: from the frame's outer corner back along the side of the head, 2 mm off it, to over the ear
  const outer = lensX + lensW / 2 + frame;
  const armY = lensY + 0.008;
  const sideAt = (z: number, sd: number) => {
    let m = 0;
    for (const i of pts) {
      const y = c.p[i * 3 + 1], zz = c.p[i * 3 + 2], x = (c.p[i * 3] - head.x) * sd;
      if (x <= 0 || Math.abs(y - armY) > 0.012 || Math.abs(zz - z) > 0.008) continue;
      m = Math.max(m, x);
    }
    return m;
  };
  const zEnd = head.z - 0.025 * hs;
  for (const sd of [-1, 1]) {
    const pts3: V[] = [new T.Vector3(head.x + sd * (outer - 0.001), armY, zl - 0.001)];
    const steps = 6;
    let lastX = outer;
    for (let k = 1; k <= steps; k++) {
      const z = zl - 0.006 + ((zEnd - (zl - 0.006)) * k) / steps;
      const sx = sideAt(z, sd);
      lastX = Math.max(sx + 0.0022, k === 1 ? outer - 0.002 : 0);
      pts3.push(new T.Vector3(head.x + sd * lastX, armY - (k === steps ? 0.006 : 0), z));
    }
    const arm = new T.TubeGeometry(new T.CatmullRomCurve3(pts3), 18, 0.0014, 5, false);
    out.push(finish(T, arm, look.detail, look.shine, w));
  }
  return mergeGeometries(out, false);
}

/** A flat plate with rounded corners, centred, facing +z. */
function roundedPlate(T: Three, w: number, h: number, r: number, d: number): THREE.BufferGeometry {
  const s = new T.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r * 0.6); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r * 0.6); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -d / 2);
  return g;
}
/** A rounded rectangle's frame (a ring of width `f`), depth d. */
function roundedRing(T: Three, w: number, h: number, r: number, f: number, d: number): THREE.BufferGeometry {
  const shape = (W: number, H: number, R: number, cw: boolean) => {
    const s = new T.Path();
    const x = -W / 2, y = -H / 2;
    const pts: [number, number][] = [];
    const seg = (cx: number, cy: number, a0: number) => { for (let k = 0; k <= 4; k++) { const a = a0 + (k / 4) * (Math.PI / 2); pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); } };
    seg(x + W - R, y + R, -Math.PI / 2); seg(x + W - R, y + H - R, 0); seg(x + R, y + H - R, Math.PI / 2); seg(x + R, y + R, Math.PI);
    if (cw) pts.reverse();
    s.moveTo(...pts[0]); for (const p of pts.slice(1)) s.lineTo(...p);
    return s;
  };
  const outer = new T.Shape((shape(w, h, r, false) as THREE.Path).getPoints());
  outer.holes.push(shape(w - f * 2, h - f * 2, Math.max(0.002, r - f), true));
  const g = new T.ExtrudeGeometry(outer, { depth: d, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -d / 2);
  return g;
}

// ── the cap ───────────────────────────────────────────────────────────────

/**
 * The cap: a crown of a cap's own shape (a dome 11 cm over the brim at this head's size), its brim the head's own
 * width at the brow, the peak at the front. Hair that would stand out of it (a quiff, a top knot) is pressed in
 * under the crown (`squash`: the body's own copy of its mesh, moved inside the crown, so nothing pokes through).
 */
function cap(T: Three, c: Cloud, W: (n: string) => V, look: AccessoryLook): { geo: THREE.BufferGeometry; squash: (x: V) => V | null } | null {
  const head = W("Head"), end = W("head_end");
  const C = head.clone().lerp(end, 0.45);
  const pts = headPoints(c, W, head.y + 0.015);
  if (pts.length < 50) return null;
  const w = rigidWeights(c, pts); // the head is rigid: all on its main bone (an average with the neck slid the cap over the brow as he moved)
  // the head's own scale (a cartoon head is drawn bigger than the file's; head → headfront is 9.3 cm on the files)
  const hs = W("headfront").distanceTo(head) / 0.093;
  const browY = head.y + 0.052 * hs;
  const NA = 40, NE = 10;
  /** The head's outermost point at a height, along an azimuth (horizontal distance from C). */
  const horiz = (dx: number, dz: number, y: number) => {
    let best = 0.05;
    for (const i of pts) {
      if (Math.abs(c.p[i * 3 + 1] - y) > 0.008) continue;
      const rx = c.p[i * 3] - C.x, rz = c.p[i * 3 + 2] - C.z, r = rx * dx + rz * dz;
      if (r > best && Math.abs(rx * dz - rz * dx) < Math.max(0.012, r * 0.2)) best = r;
    }
    return best;
  };
  // the brim line (height and radius by azimuth): the brow at the front, over the ears, lower at the back
  const ybA: number[] = [], rbRaw: number[] = [];
  for (let a = 0; a < NA; a++) {
    const th = (a / NA) * Math.PI * 2, front = Math.cos(th);
    // (a baseball cap sits at the brow in front and rides up at the sides and back: his hair shows below it there)
    const yb = browY + 0.014 * hs + (1 - front) * 0.012 * hs;
    ybA.push(yb);
    // the head's own width there, read a little higher up too (the skull, not an ear or a tuft at the brim line)
    const hz = horiz(Math.sin(th), front, yb), hHi = horiz(Math.sin(th), front, yb + 0.022 * hs);
    rbRaw.push((front > 0.5 ? Math.max(hz, hHi) : Math.min(hz, hHi + 0.006)) + 0.003);
  }
  const rb = dilateSmooth(rbRaw, 3);
  const top = browY + 0.094 * hs; // a shallow crown (a deeper one read as a helmet)
  /** The crown at a height fraction s (0 brim, 1 top): its horizontal radius at azimuth index a. */
  const crownR = (a: number, s: number) => rb[a] * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, s), 2)), 0.55);
  const crownY = (a: number, s: number) => ybA[a] + (top - ybA[a]) * s;
  const TH = 0.003;
  const pos: number[] = [], ind: number[] = [];
  const P = (e: number, a: number, extra: number) => {
    const s = Math.sin((e / NE) * Math.PI / 2), th = (a / NA) * Math.PI * 2;
    const r = crownR(a % NA, s) + extra;
    pos.push(C.x + Math.sin(th) * r, crownY(a % NA, s) + extra * s, C.z + Math.cos(th) * r);
  };
  for (let e = 0; e <= NE; e++) for (let a = 0; a < NA; a++) P(e, a, TH);           // outside
  for (let e = 0; e <= NE; e++) for (let a = 0; a < NA; a++) P(e, a, 0);            // inside
  const o = (e: number, a: number) => e * NA + (a % NA), iIn = (e: number, a: number) => (NE + 1) * NA + e * NA + (a % NA);
  for (let e = 0; e < NE; e++) for (let a = 0; a < NA; a++) {
    ind.push(o(e, a), o(e, a + 1), o(e + 1, a + 1), o(e, a), o(e + 1, a + 1), o(e + 1, a));
    ind.push(iIn(e, a), iIn(e + 1, a + 1), iIn(e, a + 1), iIn(e, a), iIn(e + 1, a), iIn(e + 1, a + 1));
  }
  for (let a = 0; a < NA; a++) ind.push(o(0, a), iIn(0, a), iIn(0, a + 1), o(0, a), iIn(0, a + 1), o(0, a + 1)); // the edge
  const crown = new T.BufferGeometry();
  crown.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  crown.setIndex(ind);
  crown.computeVertexNormals();
  const cn = crown.toNonIndexed(); crown.dispose();
  const out: THREE.BufferGeometry[] = [finish(T, cn, look.main, 0.08, w)]; // cotton: hardly any shine
  // the six panel seams: thin raised lines from the brim to the top
  const seamHex = `#${new T.Color(look.main).multiplyScalar(0.78).getHexString()}`;
  for (const k of [0, 3]) {
    const a = Math.round((k / 6) * NA) % NA;
    const line: V[] = [];
    for (let e = 0; e <= NE; e++) { const s = Math.sin((e / NE) * Math.PI / 2), th = (a / NA) * Math.PI * 2, r = crownR(a, s) + TH + 0.0006; line.push(new T.Vector3(C.x + Math.sin(th) * r, crownY(a, s) + (TH + 0.0006) * s, C.z + Math.cos(th) * r)); }
    const seam = new T.TubeGeometry(new T.CatmullRomCurve3(line), 12, 0.0007, 4, false);
    out.push(finish(T, seam, seamHex, look.shine * 0.3, w));
  }
  // the peak: from the front of the brim, 6.5 cm forward, tipped down a little, curved across
  const peak: number[] = [], pi: number[] = [];
  const span = 7, rows = 5;
  for (let rI = 0; rI <= rows; rI++) for (let s = -span; s <= span; s++) {
    const a = (s + NA) % NA, th = (a / NA) * Math.PI * 2;
    const fwd = new T.Vector3(Math.sin(th), 0, Math.cos(th));
    const t = (rI / rows) * 0.068 * hs * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s) / (span + 0.5), 2)), 0.55);
    const base = new T.Vector3(C.x + Math.sin(th) * (rb[a] + TH * 0.5), ybA[a] + 0.002, C.z + Math.cos(th) * (rb[a] + TH * 0.5));
    // forward and a little down, the sides curved down more (a worn-in peak)
    const v = base.addScaledVector(fwd, t).add(new T.Vector3(0, -t * 0.2 - Math.pow(Math.abs(s) / span, 2) * (0.004 + t * 0.35), 0));
    peak.push(v.x, v.y, v.z);
  }
  const PW = span * 2 + 1, pg = (rI: number, s: number) => rI * PW + s;
  for (let rI = 0; rI < rows; rI++) for (let s = 0; s < PW - 1; s++) pi.push(pg(rI, s), pg(rI + 1, s), pg(rI + 1, s + 1), pg(rI, s), pg(rI + 1, s + 1), pg(rI, s + 1));
  const topG = new T.BufferGeometry(); topG.setAttribute("position", new T.Float32BufferAttribute(peak, 3)); topG.setIndex(pi);
  const under = new T.BufferGeometry(); under.setAttribute("position", new T.Float32BufferAttribute(peak.map((v, i) => (i % 3 === 1 ? v - 0.004 : v)), 3));
  under.setIndex(pi.map((_, i) => pi[i - (i % 3) + [0, 2, 1][i % 3]]));
  // the peak's top in the crown's colour, its underside the second colour
  for (const [g, hex] of [[topG, look.main], [under, look.second]] as const) { g.computeVertexNormals(); const ng = g.toNonIndexed(); g.dispose(); out.push(finish(T, ng, hex, look.shine * 0.4, w)); }
  // the peak's front edge
  const edge: V[] = [];
  for (let s = -span; s <= span; s++) edge.push(new T.Vector3(peak[pg(rows, s + span) * 3], peak[pg(rows, s + span) * 3 + 1] - 0.002, peak[pg(rows, s + span) * 3 + 2]));
  out.push(finish(T, new T.TubeGeometry(new T.CatmullRomCurve3(edge), 24, 0.0019, 5, false), seamHex, look.shine * 0.4, w));
  // the button on top and a small badge on the front panel
  const btn = new T.SphereGeometry(0.0065, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  btn.translate(C.x, top + TH - 0.001, C.z);
  out.push(finish(T, btn, look.main, look.shine, w));
  // (a small disc lying on the crown: its axis along the crown's own normal there)
  const at = (sv: number) => new T.Vector3(C.x, crownY(0, sv) + TH * sv, C.z + crownR(0, sv) + TH);
  const sB = 0.32, pB = at(sB), up = at(sB + 0.03).sub(at(sB - 0.03)).normalize();
  const nB = new T.Vector3().crossVectors(new T.Vector3(1, 0, 0), up).normalize();
  const badge = new T.CylinderGeometry(0.0085 * hs, 0.0085 * hs, 0.0012, 18);
  out.push(finish(T, place(T, badge, pB.addScaledVector(nB, 0.0009), new T.Vector3(1, 0, 0), nB, new T.Vector3().crossVectors(new T.Vector3(1, 0, 0), nB)), look.detail, look.shine * 0.5, w));
  const geo = mergeGeometries(out, false);
  /** A body point outside the crown (above the brim) → pressed just inside it; else null. */
  const squash = (x: V): V | null => {
    const dx = x.x - C.x, dz = x.z - C.z;
    const th = Math.atan2(dx, dz), a = ((Math.round((th / (Math.PI * 2)) * NA) % NA) + NA) % NA;
    // under the brim line: a fringe standing out in front of the brow goes back under the peak (never the brows,
    // which are inside the brim's own width, measured at that height)
    if (x.y <= ybA[a] + 0.004) {
      const rr = Math.hypot(dx, dz), rIn = rb[a] - 0.004;
      if (x.y < browY - 0.014 || rr <= rIn || Math.cos(th) < 0.2) return null;
      return new T.Vector3(C.x + (dx / rr) * rIn, x.y, C.z + (dz / rr) * rIn);
    }
    // under the crown's top, then inside its width at that height (the minimum over the neighbouring azimuths)
    const y = Math.min(x.y, top - 0.007);
    const sY = (y - ybA[a]) / (top - ybA[a]);
    const rMax = Math.max(0, Math.min(crownR(a, sY), crownR((a + 1) % NA, sY), crownR((a + NA - 1) % NA, sY)) - 0.004);
    const r = Math.hypot(dx, dz);
    if (r <= rMax && y === x.y) return null;
    const k = r > rMax ? rMax / Math.max(r, 1e-6) : 1;
    return new T.Vector3(C.x + dx * k, y, C.z + dz * k);
  };
  return geo ? { geo, squash } : null;
}

// ── the material: one for everything, shine per vertex ────────────────────

/** Phong with vertex colours; the highlight's strength is each vertex's own shine (metal bright, rubber dull). */
export function accessoryMaterial(T: Three): THREE.Material {
  const m = new T.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, shininess: 70, specular: new T.Color(0.9, 0.88, 0.82) });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aShine; varying float vShine;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvShine = aShine;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vShine;\nvec3 tnWB(vec3 c) { return mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), 0.6); }")
      // a camera's white balance on the lights (HOME_WB, as the cloth): a warm room turned gold orange and silver brass
      .replace("#include <lights_phong_pars_fragment>", (T.ShaderChunk as Record<string, string>).lights_phong_pars_fragment
        .replace("vec3 irradiance = dotNL * directLight.color;", "vec3 irradiance = dotNL * tnWB(directLight.color);")
        .replace("reflectedLight.indirectDiffuse += irradiance *", "reflectedLight.indirectDiffuse += tnWB(irradiance) *"))
      .replace("#include <specularmap_fragment>", "float specularStrength = vShine;")
      // never darker than ~half its own colour: a place lit by its environment map, not by lights (the garden,
      // look H) left Phong only a weak sky light, and a white cap or a silver chain read black there
      .replace("#include <opaque_fragment>", "outgoingLight = max(outgoingLight, diffuseColor.rgb * 0.55);\n#include <opaque_fragment>");
  };
  m.customProgramCacheKey = () => "kib-accessories-v3";
  return m;
}
