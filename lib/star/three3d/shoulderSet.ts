/**
 * SHOULDERS DOWN, ARMS OFF THE BODY (B5c, Harry 20 Oct 2026):
 *   "why is the shoulders always so awkwardly high when moving - this is a
 *    consistent problem - even when standing stationary"
 *   (on b5b/walk-options.mp4) "the arms are hitting into the body and through the body"
 *
 * Measured (tools/motionref/arm_clearance.mts, today's Style A body and the
 * four B bodies): the bodies are built with the collarbones level (0°). The
 * capture clips lift them: the idle and the applause 13°, the handshake 25°
 * (only the walk and the run loops were brought down before, runPosture.ts).
 * And the capture people were narrower in the hips and waist for their
 * shoulders than our bodies, so on our bodies the hands go through the hips
 * and the forearms through the waist: 4–13 cm deep, in EVERY frame of the
 * idle, walk, jog, handshake and applause, on every body.
 *
 * Fix, baked into each person's own copy of every clip (people3d.makePerson3d
 * and footballAnims.addClips), measured on HIS body (shoulderBodyOf: the
 * body's own torso, slice by slice, from its bind-pose skin), at each key:
 *   1. SHOULDERS: each collarbone comes down to level (the body's bind pose),
 *      except as an arm goes up past the side (a real shoulder shrugs with an
 *      arm overhead: up to SHRUG_MAX with the arm straight up). The upper arm
 *      keeps where it points; only the shoulder joint comes down.
 *   2. SOFT ELBOWS: a hanging arm is never locked straight (at least ELBOW_SOFT bent).
 *   3. ARMS CLEAR THE BODY: the upper arm, elbow, forearm, wrist and hand are
 *      kept CLEARANCE outside the torso (arm thickness included). Where one
 *      would go in, the whole arm turns about the shoulder just enough to come
 *      out, the way a real arm swings round the hip; the turn is spread over
 *      the frames around it (dilate, then blur), so the swing stays smooth.
 * The legs, the spine, the head, the hand's own pose and the clip's timing
 * are untouched. Pure apart from the clip it rewrites.
 */
import type * as THREE from "three";

type Three = typeof import("three");

/** Collarbone lift allowed with the arm straight up (a real shrug), degrees; none with the arm below ARM_SHRUG_FROM. */
export const SHRUG_MAX = 22;
export const ARM_SHRUG_FROM = 70;
/** A hanging arm's elbow is bent at least this much, degrees. */
export const ELBOW_SOFT = 10;
/** Skin to skin, metres, an arm keeps off the torso. */
export const CLEARANCE = 0.005;
/** Most the arm is turned off the body, degrees. */
export const PUSH_MAX = 40;

const NAMES = {
  hips: "Hips", chest: "Spine", neck: "neck",
  L: { clav: "LeftShoulder", arm: "LeftArm", fore: "LeftForeArm", hand: "LeftHand" },
  R: { clav: "RightShoulder", arm: "RightArm", fore: "RightForeArm", hand: "RightHand" },
} as const;
/** Bones whose skin is "the torso". */
const TORSO_BONES = new Set(["Hips", "Spine", "Spine01", "Spine02", "LeftUpLeg", "RightUpLeg", "LeftShoulder", "RightShoulder"]);
const ARM_BONES = new Set(["LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"]);
const BINS = 24;

/** One body's measures for the settle (its torso slices, arm thickness, bind collarbones). */
export interface ShoulderBody {
  key: string;
  /** Bone names in parent-first order and each one's parent index (-1: the fixed frame above the hips). */
  order: string[]; parent: number[];
  /** The fixed matrix above the hips (armature, build), and every bone's rest local position/scale. */
  top: THREE.Matrix4; restPos: THREE.Vector3[]; restQ: THREE.Quaternion[]; scale: THREE.Vector3[];
  /** Bind world matrices of the hips and the chest (to read a posed point back on the bind torso). */
  hipsBind: THREE.Matrix4; chestBind: THREE.Matrix4;
  /** Torso slices: height (bind world y), centre (x, z), radius per angle bin. */
  slices: { y: number; cx: number; cz: number; r: Float32Array }[];
  /** Bind heights of the hip joint and the neck base (for which frame reads a point). */
  hipY: number; neckY: number;
  /** The arm's skin rings (see shoulderBodyOf): on which bone, how far to the next, the ring's middle off the bone (bone frame), its radius. */
  rings: Record<"L" | "R", { bone: string; to: string; t: number; off: THREE.Vector3; r: number }[]>;
  /** Each collarbone's bind elevation against the chest's up, radians. */
  clav0: { L: number; R: number };
}

/**
 * Measure a body for the settle. `inner`: the person's model scene, the
 * bones at the bind pose, the build scale on; `body`: its skinned mesh.
 */
export function shoulderBodyOf(T: Three, inner: THREE.Object3D, bones: Record<string, THREE.Bone>, body: THREE.SkinnedMesh, key: string): ShoulderBody | null {
  const need = [NAMES.hips, NAMES.chest, NAMES.neck, ...Object.values(NAMES.L), ...Object.values(NAMES.R)];
  // the middle finger's root, when the body has fingers: the hand's own line (a fist or a bent wrist)
  const mid = { L: bones.LeftHandMiddle1 ? "LeftHandMiddle1" : null, R: bones.RightHandMiddle1 ? "RightHandMiddle1" : null };
  if (need.some((n) => !bones[n])) return null;
  inner.updateMatrixWorld(true);
  // the chain: every ancestor of the needed bones up to the hips
  const set = new Set<string>();
  for (const n of [...need, ...[mid.L, mid.R].filter((x): x is string => !!x)]) { let b: THREE.Object3D | null = bones[n]; while (b && (b as THREE.Bone).isBone) { set.add(b.name); if (b.name === NAMES.hips) break; b = b.parent; } }
  const order: string[] = [];
  const visit = (o: THREE.Object3D) => { if (set.has(o.name) && (o as THREE.Bone).isBone) order.push(o.name); o.children.forEach(visit); };
  visit(bones[NAMES.hips]);
  const parent = order.map((n) => order.indexOf(bones[n].parent?.name ?? ""));
  const top = bones[NAMES.hips].parent!.matrixWorld.clone();
  const restPos = order.map((n) => bones[n].position.clone());
  const restQ = order.map((n) => bones[n].quaternion.clone());
  const scale = order.map((n) => bones[n].scale.clone());
  const W = (n: string) => new T.Vector3().setFromMatrixPosition(bones[n].matrixWorld);

  // the skin at the bind pose, each vertex on the bone that carries it most
  const geo = body.geometry;
  const pos = geo.getAttribute("position"), si = geo.getAttribute("skinIndex"), sw = geo.getAttribute("skinWeight");
  const names = body.skeleton.bones.map((b) => b.name);
  const torso: THREE.Vector3[] = [], cap: boolean[] = [];
  const arm: Record<string, THREE.Vector3[]> = {};
  const v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const d = names[best];
    if (!TORSO_BONES.has(d) && !ARM_BONES.has(d)) continue;
    body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld);
    if (TORSO_BONES.has(d)) { torso.push(v.clone()); cap.push(d === "LeftShoulder" || d === "RightShoulder"); } else (arm[d] ??= []).push(v.clone());
  }
  const hip = W(NAMES.hips), neck = W(NAMES.neck);
  const armY = (W(NAMES.L.arm).y + W(NAMES.R.arm).y) / 2;
  // slices every 2 cm from the top of the thigh to just under the armpit
  const slices: ShoulderBody["slices"] = [];
  // above the armpit only the chest itself (front and back), not the shoulder caps the arms hang from
  const yTop = neck.y - 0.05, yLow = hip.y - 0.2, yPit = armY - 0.09;
  for (let y = yLow; y <= yTop; y += 0.02) {
    const sl = torso.filter((p, i) => Math.abs(p.y - y) < 0.012 && Math.abs(p.x - hip.x) < 0.45 && (y < yPit || (!cap[i] && Math.abs(p.x - hip.x) < 0.12)));
    if (sl.length < 12) continue;
    const zs = sl.map((p) => p.z);
    const cx = hip.x, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
    const r = new Float32Array(BINS);
    for (const p of sl) {
      const a = Math.atan2(p.z - cz, p.x - cx);
      const b = ((Math.round((a / (2 * Math.PI)) * BINS) % BINS) + BINS) % BINS;
      r[b] = Math.max(r[b], Math.hypot(p.x - cx, p.z - cz));
    }
    // an empty bin takes its neighbours'
    for (let k = 0; k < BINS; k++) if (!r[k]) { let a = 0, n = 0; for (const j of [k - 1, k + 1, k - 2, k + 2]) { const x = r[(j + BINS) % BINS]; if (x) { a += x; n++; } } r[k] = n ? a / n : 0; }
    slices.push({ y, cx, cz, r });
  }
  // the arm's own skin, ring by ring: where its middle sits off the bone (the bones are not in
  // the middle of the arm) and how thick it is there. A ring is the skin within 1.2 cm of a cut
  // across the arm; its middle is kept in the bone's own frame so it turns with the bone.
  const rings: ShoulderBody["rings"] = { L: [], R: [] };
  for (const s of ["L", "R"] as const) {
    const nm = NAMES[s];
    const skin = [...(arm[nm.arm] ?? []), ...(arm[nm.fore] ?? []), ...(arm[nm.hand] ?? [])];
    const foreLen = W(nm.fore).distanceTo(W(nm.hand));
    for (const [bone, to, t] of [[nm.arm, nm.fore, 0.9], [nm.fore, nm.hand, 0.1], [nm.fore, nm.hand, 0.5], [nm.fore, nm.hand, 0.9], [nm.fore, nm.hand, 1 + 0.05 / foreLen]] as const) {
      const A = W(bone), B = W(to), ax = B.clone().sub(A);
      const len = ax.length(); ax.divideScalar(len);
      const at = A.clone().addScaledVector(ax, t * len);
      const ring = skin.filter((p) => Math.abs(p.clone().sub(at).dot(ax)) < 0.012 && p.distanceTo(at) < 0.13);
      if (ring.length < 6) continue;
      const c = ring.reduce((m, p) => m.add(p), new T.Vector3()).divideScalar(ring.length);
      c.addScaledVector(ax, -c.clone().sub(at).dot(ax));
      const ds = ring.map((p) => { const d = p.clone().sub(c); return d.addScaledVector(ax, -d.dot(ax)).length(); }).sort((x, y) => x - y);
      const q = new T.Quaternion(); bones[bone].matrixWorld.decompose(new T.Vector3(), q, new T.Vector3());
      rings[s].push({ bone, to, t, off: c.clone().sub(at).applyQuaternion(q.invert()), r: ds[Math.floor(ds.length * 0.5)] });
    }
    // the hand along its own line: the palm, and the finger ends (thin)
    const m = mid[s];
    if (m) {
      const handSkin = arm[nm.hand] ?? [];
      const A = W(nm.hand), B = W(m), ax = B.clone().sub(A).normalize();
      const palm = handSkin.filter((p) => Math.abs(p.clone().sub(A.clone().lerp(B, 0.6)).dot(ax)) < 0.015);
      const r = palm.length ? palm.map((p) => { const d = p.clone().sub(A.clone().lerp(B, 0.6)); return d.addScaledVector(ax, -d.dot(ax)).length(); }).sort((x, y) => x - y)[Math.floor(palm.length * 0.4)] : 0.025;
      rings[s].push({ bone: nm.hand, to: m, t: 0.6, off: new T.Vector3(), r: Math.min(0.03, r) });
      rings[s].push({ bone: nm.hand, to: m, t: 1.4, off: new T.Vector3(), r: 0.015 });
    }
  }
  const up = neck.clone().sub(W(NAMES.chest)).normalize();
  const elev = (c: string, a: string) => Math.asin(Math.max(-1, Math.min(1, W(a).sub(W(c)).normalize().dot(up))));
  return {
    key, order, parent, top, restPos, restQ, scale,
    hipsBind: bones[NAMES.hips].matrixWorld.clone(), chestBind: bones[NAMES.chest].matrixWorld.clone(),
    slices, hipY: hip.y, neckY: neck.y, rings,
    clav0: { L: elev(NAMES.L.clav, NAMES.L.arm), R: elev(NAMES.R.clav, NAMES.R.arm) },
  };
}

export interface SettleReport {
  clip: string;
  /** Collarbone lift above the bind (degrees, mean over keys) before → after. */
  clavBefore: number; clavAfter: number;
  /** Deepest an arm point goes into the torso (cm) before → after, and the most the arm was turned (degrees). */
  inBefore: number; inAfter: number; turned: number;
}

const settled = new WeakMap<THREE.AnimationClip, string>();

/**
 * Rewrite a person's own copy of a clip (see top): the collarbone, upper-arm
 * and forearm quaternion tracks. Returns what it measured, or null when the
 * clip has no arm tracks or was already settled for this body.
 */
export function settleClip(T: Three, sb: ShoulderBody, clip: THREE.AnimationClip): SettleReport | null {
  if (settled.get(clip) === sb.key) return null;
  const n = sb.order.length;
  const idx = (s: string) => sb.order.indexOf(s);
  // the clip's tracks on the chain
  const qTr: (THREE.Interpolant | null)[] = sb.order.map((b) => { const t = clip.tracks.find((x) => x.name === `${b}.quaternion`); return t ? t.createInterpolant() : null; });
  const pTr: (THREE.Interpolant | null)[] = sb.order.map((b) => { const t = clip.tracks.find((x) => x.name === `${b}.position`); return t ? t.createInterpolant() : null; });
  const armTrack = clip.tracks.find((x) => x.name === `${NAMES.L.arm}.quaternion`) ?? clip.tracks.find((x) => x.name === `${NAMES.R.arm}.quaternion`);
  if (!armTrack) return null;
  settled.set(clip, sb.key);
  // the key times: the arm track's own, or 20 a second where it is sparse
  let times = Array.from(armTrack.times);
  const dur = clip.duration;
  if (times.length < dur * 20) { times = []; const k = Math.max(2, Math.ceil(dur * 20) + 1); for (let i = 0; i < k; i++) times.push((i / (k - 1)) * dur); }
  const K = times.length;

  const L = new Array(n).fill(0).map(() => new T.Matrix4());
  const Wm = new Array(n).fill(0).map(() => new T.Matrix4());
  const lq = sb.restQ.map((q) => q.clone()), lp = sb.restPos.map((p) => p.clone());
  const tmpQ = new T.Quaternion(), tmpV = new T.Vector3(), tmpS = new T.Vector3();
  const fk = (from = 0) => {
    for (let i = from; i < n; i++) {
      L[i].compose(lp[i], lq[i], sb.scale[i]);
      const p = sb.parent[i];
      Wm[i].multiplyMatrices(p < 0 ? sb.top : Wm[p], L[i]);
    }
  };
  const P = (i: number) => new T.Vector3().setFromMatrixPosition(Wm[i]);
  const WQ = (i: number) => { const q = new T.Quaternion(); Wm[i].decompose(tmpV, q, tmpS); return q; };
  const parentWQ = (i: number) => { const p = sb.parent[i]; const q = new T.Quaternion(); (p < 0 ? sb.top : Wm[p]).decompose(tmpV, q, tmpS); return q; };
  /** Turn bone i in the world by quaternion r (its subtree follows on the next fk). */
  const turnWorld = (i: number, r: THREE.Quaternion) => {
    const pw = parentWQ(i);
    const wq = pw.clone().multiply(lq[i]);
    lq[i].copy(pw.invert().multiply(r.clone().multiply(wq))).normalize();
  };
  const iH = idx(NAMES.hips), iC = idx(NAMES.chest), iN = idx(NAMES.neck);
  const side = { L: NAMES.L, R: NAMES.R } as const;
  const I = (s: "L" | "R") => ({ clav: idx(side[s].clav), arm: idx(side[s].arm), fore: idx(side[s].fore), hand: idx(side[s].hand) });
  const ix = { L: I("L"), R: I("R") };
  const d2r = Math.PI / 180;
  const hipsBindInv = sb.hipsBind.clone().invert(), chestBindInv = sb.chestBind.clone().invert();
  void hipsBindInv; void chestBindInv;

  // how deep a world point goes into the torso (0: outside), and the outward way, on this pose
  const toBindH = new T.Matrix4(), toBindC = new T.Matrix4(), fromBindH = new T.Matrix4(), fromBindC = new T.Matrix4();
  const framePose = () => {
    toBindH.multiplyMatrices(sb.hipsBind, new T.Matrix4().copy(Wm[iH]).invert());
    toBindC.multiplyMatrices(sb.chestBind, new T.Matrix4().copy(Wm[iC]).invert());
    fromBindH.copy(toBindH).invert(); fromBindC.copy(toBindC).invert();
  };
  const sliceAt = (y: number) => {
    const s = sb.slices;
    if (!s.length || y < s[0].y - 0.01 || y > s[s.length - 1].y + 0.01) return null;
    let k = 0; while (k < s.length - 1 && s[k + 1].y < y) k++;
    return s[Math.min(k, s.length - 1)];
  };
  const radiusAt = (sl: { r: Float32Array }, a: number) => {
    const f = ((a / (2 * Math.PI)) * BINS + BINS) % BINS;
    const k = Math.floor(f), u = f - k;
    return sl.r[k % BINS] * (1 - u) + sl.r[(k + 1) % BINS] * u;
  };
  const depthOf = (pw: THREE.Vector3, r: number): { d: number; n: THREE.Vector3 } => {
    let best = { d: 0, n: new T.Vector3() };
    const mid = sb.hipY + (sb.neckY - sb.hipY) * 0.35;
    for (const [to, from, lo, hi] of [[toBindH, fromBindH, -1, mid + 0.06], [toBindC, fromBindC, mid - 0.06, 9]] as const) {
      const pb = pw.clone().applyMatrix4(to);
      if (pb.y < lo || pb.y > hi) continue;
      const sl = sliceAt(pb.y);
      if (!sl) continue;
      const dx = pb.x - sl.cx, dz = pb.z - sl.cz, rho = Math.hypot(dx, dz);
      const R = radiusAt(sl, Math.atan2(dz, dx)) + r + CLEARANCE;
      const d = R - rho;
      if (d > best.d) {
        // outward, in the bind frame, back to the world
        const nb = rho > 1e-4 ? new T.Vector3(dx / rho, 0, dz / rho) : new T.Vector3(1, 0, 0);
        const o = pb.clone().applyMatrix4(from), t = pb.clone().add(nb).applyMatrix4(from);
        best = { d, n: t.sub(o).normalize() };
      }
    }
    return best;
  };
  /** The arm's test points for a side: [world point, radius]. */
  const armPoints = (s: "L" | "R"): [THREE.Vector3, number][] => sb.rings[s].map((g) => {
    const A = P(idx(g.bone)), B = P(idx(g.to));
    return [A.clone().lerp(B, g.t).add(g.off.clone().applyQuaternion(WQ(idx(g.bone)))), g.r];
  });
  const worstOf = (s: "L" | "R") => {
    let w = { d: 0, n: new T.Vector3(), p: new T.Vector3() };
    for (const [p, r] of armPoints(s)) { const x = depthOf(p, r); if (x.d > w.d) w = { ...x, p }; }
    return w;
  };

  const out: Record<string, number[]> = {};
  const writeBones = [ix.L.clav, ix.L.arm, ix.L.fore, ix.R.clav, ix.R.arm, ix.R.fore];
  for (const b of writeBones) out[sb.order[b]] = [];
  /** Per key, per side: the arm's push off the body, as a rotation vector in the chest's own frame. */
  const push: Record<"L" | "R", THREE.Vector3[]> = { L: [], R: [] };
  const local = { L: [] as THREE.Quaternion[][], R: [] as THREE.Quaternion[][] };
  let clavB = 0, clavA = 0, inB = 0;
  const evalKey = (t: number) => {
    for (let i = 0; i < n; i++) {
      const q = qTr[i]; if (q) { const v = q.evaluate(t); lq[i].set(v[0], v[1], v[2], v[3]).normalize(); } else lq[i].copy(sb.restQ[i]);
      const p = pTr[i]; if (p) { const v = p.evaluate(t); lp[i].set(v[0], v[1], v[2]); } else lp[i].copy(sb.restPos[i]);
    }
    fk();
  };
  for (let k = 0; k < K; k++) {
    evalKey(times[k]);
    const chest = P(iC), up = P(iN).sub(chest).normalize();
    const across = P(ix.L.arm).sub(P(ix.R.arm)).normalize();
    const fwd = across.clone().cross(up).normalize(); // his front
    for (const s of ["L", "R"] as const) {
      const c = ix[s];
      // 1. the collarbone down to level, but for a shrug with the arm up
      const cl = () => P(c.arm).sub(P(c.clav)).normalize();
      const e = Math.asin(Math.max(-1, Math.min(1, cl().dot(up)))) - sb.clav0[s];
      clavB += e / (2 * K);
      const armDir = P(c.fore).sub(P(c.arm)).normalize();
      const armUp = Math.acos(Math.max(-1, Math.min(1, -armDir.dot(up)))) / d2r; // 0 hanging, 180 straight up
      const allowed = Math.max(0, Math.min(1, (armUp - ARM_SHRUG_FROM) / (180 - ARM_SHRUG_FROM))) * SHRUG_MAX * d2r;
      if (e > allowed + 0.002) {
        const armW = WQ(c.arm);
        const ax = cl().cross(up).normalize();
        const r = new T.Quaternion().setFromAxisAngle(ax, -(e - allowed));
        turnWorld(c.clav, r);
        fk(c.clav);
        // the upper arm keeps pointing where it did: only the joint comes down
        const pw = parentWQ(c.arm);
        lq[c.arm].copy(pw.invert().multiply(armW)).normalize();
        fk(c.clav);
      }
      clavA += (Math.asin(Math.max(-1, Math.min(1, cl().dot(up)))) - sb.clav0[s]) / (2 * K);
      // 2. a hanging arm's elbow never locked straight
      if (armUp < 60) {
        const el = P(c.arm).sub(P(c.fore)).angleTo(P(c.hand).sub(P(c.fore))) / d2r;
        const want = 180 - ELBOW_SOFT;
        if (el > want) {
          const before = P(c.hand).dot(fwd);
          turnWorld(c.fore, new T.Quaternion().setFromAxisAngle(across, (el - want) * d2r));
          fk(c.fore);
          if (P(c.hand).dot(fwd) < before) { turnWorld(c.fore, new T.Quaternion().setFromAxisAngle(across, -2 * (el - want) * d2r)); fk(c.fore); }
        }
      }
    }
    // 3. the arms off the body: how far each arm must turn about its shoulder (kept for smoothing)
    framePose();
    const chestQ = WQ(iC), chestInv = chestQ.clone().invert();
    for (const s of ["L", "R"] as const) {
      const c = ix[s];
      local[s].push([lq[c.clav].clone(), lq[c.arm].clone(), lq[c.fore].clone()]);
      const keep = lq[c.arm].clone();
      const total = new T.Quaternion();
      const w0 = worstOf(s);
      inB = Math.max(inB, w0.d - CLEARANCE);
      for (let it = 0; it < 5; it++) {
        const w = it === 0 ? w0 : worstOf(s);
        if (w.d <= 0.001) break;
        const S = P(c.arm), lever = w.p.clone().sub(S);
        const ax = lever.clone().cross(w.n);
        const len = ax.length();
        if (len < 1e-5) break;
        ax.divideScalar(len);
        const ang = Math.min(0.2, (w.d + 0.002) / Math.max(0.05, len));
        const r = new T.Quaternion().setFromAxisAngle(ax, ang);
        turnWorld(c.arm, r); fk(c.arm);
        total.premultiply(r);
        if (2 * Math.acos(Math.min(1, Math.abs(total.w))) > PUSH_MAX * d2r) break;
      }
      lq[c.arm].copy(keep); fk(c.arm);
      // the push as a rotation vector in the chest's frame (so it can be spread over neighbouring keys)
      const tq = chestInv.clone().multiply(total).multiply(chestQ);
      if (tq.w < 0) { tq.x = -tq.x; tq.y = -tq.y; tq.z = -tq.z; tq.w = -tq.w; }
      const ang = 2 * Math.acos(Math.min(1, tq.w)), sn = Math.sqrt(Math.max(0, 1 - tq.w * tq.w));
      push[s].push(sn > 1e-6 ? new T.Vector3(tq.x / sn, tq.y / sn, tq.z / sn).multiplyScalar(ang) : new T.Vector3());
    }
  }
  // spread each push over the frames around it: the biggest within ±0.08 s, then a soft blur (σ 0.07 s)
  const loop = (() => { const a = armTrack.values, m = a.length; return m >= 8 && Math.abs(a[0] * a[m - 4] + a[1] * a[m - 3] + a[2] * a[m - 2] + a[3] * a[m - 1]) > 0.9995; })();
  const dt = dur / Math.max(1, K - 1);
  const at = (arr: THREE.Vector3[], j: number) => arr[loop ? ((j % (K - 1)) + (K - 1)) % (K - 1) : Math.max(0, Math.min(K - 1, j))];
  let turned = 0;
  for (const s of ["L", "R"] as const) {
    const wD = Math.max(1, Math.round(0.08 / dt)), sg = Math.max(0.5, 0.07 / dt), wB = Math.ceil(sg * 2.5);
    const dil = push[s].map((_, k) => { let b = at(push[s], k); for (let j = -wD; j <= wD; j++) { const x = at(push[s], k + j); if (x.length() > b.length()) b = x; } return b; });
    push[s] = dil.map((_, k) => { const acc = new T.Vector3(); let ws = 0; for (let j = -wB; j <= wB; j++) { const w = Math.exp(-(j * j) / (2 * sg * sg)); acc.addScaledVector(at(dil, k + j), w); ws += w; } return acc.divideScalar(ws); });
  }
  // apply and write
  let inA = 0;
  for (let k = 0; k < K; k++) {
    evalKey(times[k]);
    for (const s of ["L", "R"] as const) { const c = ix[s]; const [a, b, f] = local[s][k]; lq[c.clav].copy(a); lq[c.arm].copy(b); lq[c.fore].copy(f); }
    fk();
    const chestQ = WQ(iC);
    for (const s of ["L", "R"] as const) {
      const c = ix[s], v = push[s][k], ang = v.length();
      turned = Math.max(turned, ang / d2r);
      if (ang > 1e-5) {
        const r = new T.Quaternion().setFromAxisAngle(v.clone().divideScalar(ang), ang);
        turnWorld(c.arm, chestQ.clone().multiply(r).multiply(chestQ.clone().invert()));
        fk(c.arm);
      }
    }
    framePose();
    for (const s of ["L", "R"] as const) inA = Math.max(inA, worstOf(s).d - CLEARANCE);
    for (const b of writeBones) { const q = lq[b]; out[sb.order[b]].push(q.x, q.y, q.z, q.w); }
  }
  for (const b of writeBones) {
    const name = `${sb.order[b]}.quaternion`;
    const tr = new T.QuaternionKeyframeTrack(name, times, out[sb.order[b]]);
    const i = clip.tracks.findIndex((x) => x.name === name);
    if (i >= 0) clip.tracks[i] = tr; else clip.tracks.push(tr);
  }
  void tmpQ;
  return { clip: clip.name, clavBefore: clavB / d2r, clavAfter: clavA / d2r, inBefore: Math.max(0, inB) * 100, inAfter: Math.max(0, inA) * 100, turned };
}
