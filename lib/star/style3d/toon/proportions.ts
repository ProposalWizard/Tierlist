/**
 * STYLE A PROPORTIONS (B5b, 20 Oct 2026; Harry: "we now need to figure out how
 * to make the bodies not look badly proportioned").
 *
 * Measured off the eight Style A head files (the joints in each file's own
 * metadata, after the 1.1 head scale; scripts/bench3d/proportions.mjs prints
 * the table) against real men of the same height (Drillis & Contini's
 * fractions of height, the usual reference for body segments):
 *
 *                        today (8 heads)      a real 1.86 m man
 *   head, chin to crown  0.34–0.40 m          0.24 m  (1.4–1.6× too big)
 *   heads tall           4.7–5.5              7.7
 *   hip joint height     0.46–0.48 × height   0.53 × height (legs 86–91 %)
 *   thigh                0.35–0.38 m          0.46 m  (77–84 %)
 *   knee height          0.50–0.53 m          0.53 m  (right)
 *   hip to neck base     0.59–0.63 m          0.53 m  (112–118 %: a long body)
 *   shoulder joints      0.74–0.77 × height   0.80 × height (6–10 cm low: sloped)
 *   upper arm            0.25–0.27 m          0.35 m  (73–78 %)
 *   forearm              0.26–0.27 m          0.27 m  (right)
 *   chin to shoulders    9 cm                 14 cm   (no neck)
 *
 * So the head is big, the body long, the thighs and upper arms short, the
 * shoulders low. The knees, elbows and forearms are already in the right place.
 *
 * A proportion is a change to the BUILD, never to the man's scale (Harry,
 * 12 Oct 2026: "no changes in size for any player"): his root scale, his
 * place and his height are left alone. What changes, worked out once per head
 * file in the bind pose (warpToonBody):
 *   - the head made smaller (its bone's scale) on a longer neck (it rises);
 *   - the body shorter: the hips rise towards the neck, the thighs grow by the
 *     same, so the knees and feet stay where they were;
 *   - the shoulders squarer: up and a little out, the upper arms longer by the
 *     same, so the elbows stay where they were.
 * The head and face are never moved in the file (the face's measured spots,
 * the kit lines and the number on the back are all painted from the file's
 * own rest positions; a warped body carries those as `aRest`).
 *
 * A (today) is the default and builds nothing new. B and C are shown ONLY on
 * test pages, by `?prop=b|c`, until Harry picks one.
 */
import type * as THREE from "three";

type Three = typeof import("three");

export type ToonPropId = "a" | "b" | "c";
export const TOON_PROP_IDS: readonly ToonPropId[] = ["a", "b", "c"];

export interface ToonProportions {
  id: ToonPropId;
  label: string;
  /** The head bone's scale (Style A's own dial, TOON_LOOK_DEFAULT.head; today 1.1). */
  head: number;
  /** Metres the head rises on a longer neck. */
  neck: number;
  /** Metres the hips rise towards the neck (a shorter body; the thighs grow by the same). */
  hipRise: number;
  /** Metres the shoulder joints rise (the upper arms grow by the same: the elbows stay). */
  shoulderUp: number;
  /** Metres each shoulder moves out. */
  shoulderOut: number;
}

export const TOON_PROPORTIONS: Record<ToonPropId, ToonProportions> = {
  a: { id: "a", label: "A · today", head: 1.1, neck: 0, hipRise: 0, shoulderUp: 0, shoulderOut: 0 },
  b: { id: "b", label: "B · modest", head: 0.97, neck: 0.03, hipRise: 0.045, shoulderUp: 0.025, shoulderOut: 0 },
  c: { id: "c", label: "C · bolder", head: 0.86, neck: 0.05, hipRise: 0.085, shoulderUp: 0.045, shoulderOut: 0.008 },
};

/** Which proportions this page shows: `?prop=b|c` on a test page, else today's (A). */
export const TOON_PROP: { id: ToonPropId } = {
  id: (() => {
    if (typeof window === "undefined") return "a";
    const q = new URLSearchParams(window.location.search).get("prop");
    return q === "b" || q === "c" ? q : "a";
  })(),
};
export function toonProportions(id: ToonPropId = TOON_PROP.id): ToonProportions { return TOON_PROPORTIONS[id] ?? TOON_PROPORTIONS.a; }

/** Does this build change the body at all? (A does not: nothing is rebuilt.) */
export function propChangesBody(p: ToonProportions): boolean { return !!(p.hipRise || p.shoulderUp || p.shoulderOut || p.neck); }

type V3 = [number, number, number];
/** A 3×4 affine, row-major [a b c tx; d e f ty; g h i tz]. */
export type Affine = [number, number, number, number, number, number, number, number, number, number, number, number];
const I: Affine = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
export function apply(A: Affine, p: V3): V3 {
  return [A[0] * p[0] + A[1] * p[1] + A[2] * p[2] + A[3], A[4] * p[0] + A[5] * p[1] + A[6] * p[2] + A[7], A[8] * p[0] + A[9] * p[1] + A[10] * p[2] + A[11]];
}
/** M about the point c: x → c + M (x − c). */
function about(M: [number, number, number, number, number, number, number, number, number], c: V3): Affine {
  const t = [c[0] - (M[0] * c[0] + M[1] * c[1] + M[2] * c[2]), c[1] - (M[3] * c[0] + M[4] * c[1] + M[5] * c[2]), c[2] - (M[6] * c[0] + M[7] * c[1] + M[8] * c[2])];
  return [M[0], M[1], M[2], t[0], M[3], M[4], M[5], t[1], M[6], M[7], M[8], t[2]];
}
/** Stretch by k along the unit direction u: I + (k − 1) u uᵀ. */
function along(u: V3, k: number): [number, number, number, number, number, number, number, number, number] {
  const s = k - 1;
  return [1 + s * u[0] * u[0], s * u[0] * u[1], s * u[0] * u[2], s * u[1] * u[0], 1 + s * u[1] * u[1], s * u[1] * u[2], s * u[2] * u[0], s * u[2] * u[1], 1 + s * u[2] * u[2]];
}
const moved = (A: Affine, d: V3): Affine => [A[0], A[1], A[2], A[3] + d[0], A[4], A[5], A[6], A[7] + d[1], A[8], A[9], A[10], A[11] + d[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

const TORSO = new Set(["Hips", "Spine02", "Spine01", "Spine"]);

/**
 * Each bone's change, as an affine on the rest pose (world metres, the man
 * facing +z, his left +x). `joints`: each bone's rest head; `parent`: each
 * bone's parent bone (or null). Pure: tested in tests/star/toonProportions.mts.
 *
 * A child bone moves with the point of its parent where it joins (so nothing
 * tears at a joint) and then makes its own change about its own joint.
 */
export function proportionAffines(joints: Record<string, V3>, parent: Record<string, string | null>, p: ToonProportions): Record<string, Affine> {
  const J = (n: string): V3 => joints[n] ?? [0, 0, 0];
  const out: Record<string, Affine> = {};
  const neck = J("neck");
  const hipY = (J("LeftUpLeg")[1] + J("RightUpLeg")[1]) / 2;
  const torsoK = 1 - p.hipRise / Math.max(0.2, neck[1] - hipY);
  // the body: shorter towards the neck (the neck, the head and the face do not move)
  const torso = about([1, 0, 0, 0, torsoK, 0, 0, 0, 1], neck);
  const own = (n: string, d: V3): Affine => {
    const side = n.startsWith("Left") ? "Left" : n.startsWith("Right") ? "Right" : "";
    if (n === `${side}UpLeg` && side) {
      // the thigh grows by the hips' rise: the knee stays at its height
      const hip = J(n), knee = J(`${side}Leg`);
      const k = 1 + d[1] / Math.max(0.1, hip[1] - knee[1]);
      return about(along(unit(sub(knee, hip)), k), hip);
    }
    if (n === `${side}Shoulder` && side) {
      // the collar bone: its outer end up and out, its inner end where it was
      const a = J(n), b = J(`${side}Arm`);
      const L = b[0] - a[0];
      if (Math.abs(L) < 1e-3) return I;
      return about([1 + p.shoulderOut / Math.abs(L), 0, 0, p.shoulderUp / L, 1, 0, 0, 0, 1], a);
    }
    if (n === `${side}Arm` && side) {
      // the upper arm grows by the shoulder's rise: the elbow stays at its height
      const sh = J(n), el = J(`${side}ForeArm`);
      const k = 1 + d[1] / Math.max(0.1, sh[1] - el[1]);
      return about(along(unit(sub(el, sh)), k), sh);
    }
    return I;
  };
  const visit = (n: string) => {
    if (out[n]) return out[n];
    const par = parent[n];
    if (TORSO.has(n)) out[n] = torso;
    else if (!par) out[n] = own(n, [0, 0, 0]);
    else {
      const A = visit(par);
      const d = sub(apply(A, J(n)), J(n));
      out[n] = moved(own(n, d), d);
    }
    return out[n];
  };
  for (const n of Object.keys(joints)) visit(n);
  return out;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

/**
 * Rebuild one freshly cloned Style A person to the proportions `p`, in its
 * bind pose, BEFORE anything reads its rest (makePerson3d calls it straight
 * after the clone, with the root unturned and the build scale still 1).
 * Returns the hips' rest before (the seated clips keep it: the chair does not
 * move and the shins are as long as they were), or null when nothing changed.
 */
export function warpToonBody(T: Three, root: THREE.Object3D, body: THREE.SkinnedMesh, p: ToonProportions): { hipsRestBefore: THREE.Vector3 } | null {
  if (!propChangesBody(p)) return null;
  const sk = body.skeleton;
  root.updateMatrixWorld(true);
  const bones = sk.bones;
  const names = bones.map((b) => b.name);
  const joints: Record<string, V3> = {};
  const parent: Record<string, string | null> = {};
  const W = bones.map((b) => b.matrixWorld.clone());
  bones.forEach((b, i) => {
    const v = new T.Vector3().setFromMatrixPosition(W[i]);
    joints[b.name] = [v.x, v.y, v.z];
    parent[b.name] = (b.parent as THREE.Bone | null)?.isBone ? b.parent!.name : null;
  });
  const hips = bones.find((b) => b.name === "Hips");
  const hipsRestBefore = hips ? hips.position.clone() : new T.Vector3();
  const A = proportionAffines(joints, parent, p);
  const Ai = names.map((n) => A[n] ?? I);

  // the rest skin: every bone's (world · inverse bind) is the same matrix C at rest
  const C = W[0].clone().multiply(sk.boneInverses[0]);
  const G = body.matrixWorld.clone().multiply(body.bindMatrixInverse).multiply(C).multiply(body.bindMatrix);
  const Ginv = G.clone().invert();

  // ── the geometry: each vertex follows its bones' changes by its weights (cached per head file and build) ──
  const src = body.geometry;
  const key = `${src.uuid}|${p.id}`;
  let g = geoCache.get(key);
  if (!g) {
    const pos = src.getAttribute("position") as THREE.BufferAttribute;
    const si = src.getAttribute("skinIndex") as THREE.BufferAttribute;
    const sw = src.getAttribute("skinWeight") as THREE.BufferAttribute;
    const out = new Float32Array(pos.count * 3);
    const v = new T.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(G);
      const P: V3 = [v.x, v.y, v.z];
      let x = 0, y = 0, z = 0, ws = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w <= 0) continue;
        const q = apply(Ai[si.getComponent(i, k)] ?? I, P);
        x += q[0] * w; y += q[1] * w; z += q[2] * w; ws += w;
      }
      if (ws > 0) { x /= ws; y /= ws; z /= ws; } else { x = P[0]; y = P[1]; z = P[2]; }
      v.set(x, y, z).applyMatrix4(Ginv);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    g = new T.BufferGeometry();
    for (const [k, a] of Object.entries(src.attributes)) if (k !== "position") g.setAttribute(k, a);
    g.setAttribute("position", new T.BufferAttribute(out, 3));
    // the file's own rest: the kit lines, the number, the face are painted from it (toon/shader.ts TOON_AREST)
    g.setAttribute("aRest", pos);
    if (src.index) g.setIndex(src.index);
    for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    g.computeBoundingBox(); g.computeBoundingSphere();
    g.userData = { ...src.userData, toonProp: p.id };
    geoCache.set(key, g);
  }
  body.geometry = g;

  // ── the skeleton: each joint where its parent's change takes it, turns kept ──
  const newW: THREE.Matrix4[] = [];
  bones.forEach((b, i) => {
    const par = parent[b.name];
    const at = par ? apply(A[par] ?? I, joints[b.name]) : apply(Ai[i], joints[b.name]);
    const m = W[i].clone();
    m.setPosition(at[0], at[1], at[2]);
    newW[i] = m;
  });
  const idx = new Map(bones.map((b, i) => [b, i]));
  bones.forEach((b, i) => {
    const pb = b.parent as THREE.Object3D;
    const pw = (pb as THREE.Bone).isBone ? newW[idx.get(pb as THREE.Bone)!] : pb.matrixWorld;
    const local = pw.clone().invert().multiply(newW[i]);
    b.position.setFromMatrixPosition(local);
  });
  // a fresh array: the clone shares its source's inverse binds (SkeletonUtils.clone)
  sk.boneInverses = newW.map((m) => m.clone().invert().multiply(C));
  // the head on a longer neck: the head bone rises, its binding kept, so the head and face move up whole
  const head = bones.find((b) => b.name === "Head");
  if (head && p.neck) {
    const nw = newW[idx.get(head.parent as THREE.Bone) ?? -1] ?? (head.parent as THREE.Object3D).matrixWorld;
    // a world rise, in the neck bone's own units and turn
    head.position.add(new T.Vector3(0, p.neck, 0).applyMatrix3(new T.Matrix3().setFromMatrix4(nw).invert()));
  }
  root.updateMatrixWorld(true);
  return { hipsRestBefore };
}
