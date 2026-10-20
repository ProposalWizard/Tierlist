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
 * Without the posture (POSTURE below, for the standing and walking clips) the legs, the spine, the head, the hand's own pose and the clip's timing
 * are untouched. Pure apart from the clip it rewrites.
 */
import type * as THREE from "three";

type Three = typeof import("three");

/**
 * POSTURE (B5c, Harry 23:21: "whyyyy is the posture so weird, there has to be a
 * solution"). Measured from the side on our own skeleton (tools/motionref/sagittal.mts)
 * and with the same detector on the 28 reference videos and on our renders
 * (tools/motionref/posture.py): the capture idle stands with the head 7.6 cm
 * ahead of the shoulders, the shoulders 5.6 cm ahead of the hips, the hips 6.3 cm
 * ahead of the ankles (the whole man leaning on his toes) and the relaxed knee
 * bent 27° with the hips not over the standing leg. A real man stands near the
 * plumb line: ear over shoulder over hip, hips a little ahead of the ankles, the
 * standing knee soft, the hips shifted over the standing leg.
 * Before the shoulders and arms, at every key of a standing or walking clip
 * (POSTURE_CLIPS; never a dive, a sit or a kick), each a ceiling only: a pose
 * already inside it is left alone, so it settles once and stays (every body):
 *   0a. STILL CLIPS: the hips go back over the feet (at most HIP_FWD of the torso
 *       ahead of the ankles), over the standing leg (SHIFT of the way), and up
 *       until the standing knee is soft, not bent (KNEE_STANCE); both legs are
 *       solved back onto their own feet (the feet do not move).
 *   0b. CHEST UP: the shoulders over the hips (at most SH_FWD of the torso ahead;
 *       walking SH_FWD_MOVE), the turn spread up the spine.
 *   0c. HEAD BACK: the head's middle over the shoulders (HEAD_FWD), the neck
 *       taking it back, the head keeping where it looks (a tucked chin, not a
 *       raised one).
 *   0d. SHOULDERS BACK: a collarbone rolled forward of its bind place goes back.
 *   and, in 2, a standing man's hanging arm is held a little out from his side
 *   (ARM_OUT), by his thigh rather than in front of it (HAND_FWD), with the
 *   elbow softer (ELBOW).
 */
export const POSTURE = {
  /** Ceilings, as shares of the torso (hip joints to shoulder joints). */
  HEAD_FWD: 0.12, HEAD_FWD_MOVE: 0.14,
  SH_FWD: 0.08, SH_FWD_MOVE: 0.12,
  HIP_FWD: 0.02,
  /** The standing knee, degrees (straighter is left alone). */
  KNEE_STANCE: 6,
  /** The hips this share of the way over the standing foot (from between the feet). */
  SHIFT: 0.3,
  /** A collarbone this far (metres) forward of its bind place before it is taken back. */
  CLAV_FWD: 0.01,
  /** Standing, a hanging arm's elbow is bent at least this (real people: 17-22 deg, ours 13), degrees. */
  ELBOW: 18,
  /** Standing still, a hanging upper arm is at least this far out from his side, seen from the front, degrees
   * (real people hold the arms out more than ours did: 15-20 deg against 7-10, measured the same way). */
  ARM_OUT: 9,
  /** Standing still, the hands at most this far (metres) ahead of the hip joints: a real arm hangs by the
   * thigh, not in front of it (the capture idle: 14.6 cm ahead). */
  HAND_FWD: 0.07,
};
/** The clips the posture is for (standing, talking, walking). Not the emotional slumps, dives, sits, kicks or hugs. */
export const POSTURE_CLIPS = new Set([
  "idle", "boss-idle", "boss-talk", "boss-wave", "wave", "talk", "nod", "point", "applause", "handshake", "shirt_hold",
  "walk", "walk_confident", "dealer_idle", "bartender_idle", "pickup",
]);
/** Of those, the ones standing still (the legs and hips are set too). */
export const STILL_CLIPS = new Set([
  "idle", "boss-idle", "boss-talk", "boss-wave", "wave", "talk", "nod", "point", "applause", "handshake", "shirt_hold",
  "dealer_idle", "bartender_idle",
]);

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
  /** The legs as tubes (thigh, shin: rings of skin round each bone) and the head as an ellipsoid, at the bind pose: the arms keep off these too (Harry: "any body part can't overlap inside another"). */
  tubes: { bone: string; A: THREE.Vector3; u: THREE.Vector3; len: number; rings: { t: number; c: THREE.Vector3; r: number }[] }[];
  head: { c: THREE.Vector3; ax: THREE.Vector3 } | null;
  /** Bind world matrices of the bones the tubes and the head ride on. */
  bindM: Record<string, THREE.Matrix4>;
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
  const LEGS = ["LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot", "Head"].filter((n) => bones[n]);
  // the toes (which way his feet point: his front, for the posture)
  const TOES = ["LeftToeBase", "RightToeBase"].filter((n) => bones[n]);
  if (need.some((n) => !bones[n])) return null;
  inner.updateMatrixWorld(true);
  // the chain: every ancestor of the needed bones up to the hips
  const set = new Set<string>();
  for (const n of [...need, ...LEGS, ...TOES, ...[mid.L, mid.R].filter((x): x is string => !!x)]) { let b: THREE.Object3D | null = bones[n]; while (b && (b as THREE.Bone).isBone) { set.add(b.name); if (b.name === NAMES.hips) break; b = b.parent; } }
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
  const other: Record<string, THREE.Vector3[]> = {};
  const tcat: string[] = [];
  const arm: Record<string, THREE.Vector3[]> = {};
  const v = new T.Vector3();
  for (let i = 0; i < pos.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const d = names[best];
    if (d === "LeftLeg" || d === "RightLeg" || d === "Head") { body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld); (other[d] ??= []).push(v.clone()); }
    if (!TORSO_BONES.has(d) && !ARM_BONES.has(d)) continue;
    body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld);
    if (TORSO_BONES.has(d)) { torso.push(v.clone()); cap.push(d === "LeftShoulder" || d === "RightShoulder"); tcat.push(d); } else (arm[d] ??= []).push(v.clone());
  }
  const hip = W(NAMES.hips), neck = W(NAMES.neck);
  const armY = (W(NAMES.L.arm).y + W(NAMES.R.arm).y) / 2;
  // slices every 2 cm from the hip joint to the neck (the thighs are tubes of their own, below)
  const slices: ShoulderBody["slices"] = [];
  // above the armpit only the chest itself (front and back), not the shoulder caps the arms hang from
  const yTop = neck.y - 0.05, yLow = hip.y - 0.08, yPit = armY - 0.09;
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
  // the legs and the head
  const tubes: ShoulderBody["tubes"] = [];
  for (const [bone, to, skinOf] of [["LeftUpLeg", "LeftLeg", "LeftUpLeg"], ["LeftLeg", "LeftFoot", "LeftLeg"], ["RightUpLeg", "RightLeg", "RightUpLeg"], ["RightLeg", "RightFoot", "RightLeg"]] as const) {
    if (!bones[bone] || !bones[to]) continue;
    const pts = skinOf.endsWith("UpLeg") ? torso.filter((_, i) => tcat[i] === skinOf) : (other[skinOf] ?? []);
    const A = W(bone), u = W(to).sub(A); const len = u.length(); u.divideScalar(len);
    const rr: ShoulderBody["tubes"][number]["rings"] = [];
    for (let t = 0.15; t < 0.95; t += 0.1) {
      const at = A.clone().addScaledVector(u, t * len);
      const ring = pts.filter((q) => Math.abs(q.clone().sub(at).dot(u)) < 0.012);
      if (ring.length < 5) continue;
      const c = ring.reduce((m, q) => m.add(q), new T.Vector3()).divideScalar(ring.length);
      c.addScaledVector(u, -c.clone().sub(at).dot(u));
      const ds = ring.map((q) => { const d = q.clone().sub(c); return d.addScaledVector(u, -d.dot(u)).length(); }).sort((a, b) => a - b);
      rr.push({ t, c, r: ds[Math.floor(ds.length / 2)] });
    }
    if (rr.length) tubes.push({ bone, A, u, len, rings: rr });
  }
  let head: ShoulderBody["head"] = null;
  const hp = other.Head ?? [];
  if (hp.length) {
    const c = hp.reduce((m, q) => m.add(q), new T.Vector3()).divideScalar(hp.length);
    const ax = new T.Vector3();
    for (const q of hp) { ax.x = Math.max(ax.x, Math.abs(q.x - c.x)); ax.y = Math.max(ax.y, Math.abs(q.y - c.y)); ax.z = Math.max(ax.z, Math.abs(q.z - c.z)); }
    head = { c, ax: ax.multiplyScalar(0.85) };
  }
  const bindM: Record<string, THREE.Matrix4> = {};
  for (const n of LEGS) bindM[n] = bones[n].matrixWorld.clone();
  const up = neck.clone().sub(W(NAMES.chest)).normalize();
  const elev = (c: string, a: string) => Math.asin(Math.max(-1, Math.min(1, W(a).sub(W(c)).normalize().dot(up))));
  return {
    key, order, parent, top, restPos, restQ, scale,
    hipsBind: bones[NAMES.hips].matrixWorld.clone(), chestBind: bones[NAMES.chest].matrixWorld.clone(),
    slices, hipY: hip.y, neckY: neck.y, rings, tubes, head, bindM,
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
export function settleClip(T: Three, sb: ShoulderBody, clip: THREE.AnimationClip, opts: { posture?: boolean } = {}): SettleReport | null {
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

  // ── 0. POSTURE (see POSTURE at the top) ──
  const legI = (s: "Left" | "Right") => ({ up: idx(`${s}UpLeg`), leg: idx(`${s}Leg`), foot: idx(`${s}Foot`), toe: idx(`${s}ToeBase`) });
  const LG = { L: legI("Left"), R: legI("Right") };
  const iHead = idx("Head");
  const spineI = ["Spine02", "Spine01", NAMES.chest].map(idx).filter((i) => i >= 0);
  // the posture once, on the first body (settle_clips.mts): set per body, each would move it again under the others' cleared arms
  const doPosture = !!opts.posture && POSTURE_CLIPS.has(clip.name) && LG.L.foot >= 0 && LG.R.foot >= 0 && LG.L.toe >= 0 && LG.R.toe >= 0 && iHead >= 0 && !!sb.head;
  const still = doPosture && STILL_CLIPS.has(clip.name);
  const topInv = sb.top.clone().invert();
  const headBindInv = sb.bindM.Head ? sb.bindM.Head.clone().invert() : null;
  const sstep = (a: number, b: number, x: number) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const mid2 = (a: number, b: number) => P(a).add(P(b)).multiplyScalar(0.5);
  /** His own frame this pose: up, front (where his toes point), across (to his left), and the joints. */
  const body = () => {
    const up = new T.Vector3(0, 1, 0);
    const across = P(LG.L.up).sub(P(LG.R.up)); across.y = 0; across.normalize();
    const fwd = new T.Vector3().crossVectors(across, up).normalize();
    const toes = P(LG.L.toe).sub(P(LG.L.foot)).add(P(LG.R.toe).sub(P(LG.R.foot))); toes.y = 0;
    if (fwd.dot(toes) < 0) { fwd.negate(); across.negate(); }
    const hip = mid2(LG.L.up, LG.R.up), ank = mid2(LG.L.foot, LG.R.foot), sh = mid2(ix.L.arm, ix.R.arm);
    const head = headBindInv ? sb.head!.c.clone().applyMatrix4(headBindInv).applyMatrix4(Wm[iHead]) : P(iHead);
    return { up, fwd, across, hip, ank, sh, head, torso: Math.max(0.2, sh.distanceTo(hip)) };
  };
  // the bind pose's hip height and each collarbone's forward place against the neck
  for (let i = 0; i < n; i++) { lq[i].copy(sb.restQ[i]); lp[i].copy(sb.restPos[i]); }
  fk();
  const bindHipY = doPosture ? mid2(LG.L.up, LG.R.up).y : 1;
  const clavFwd0 = { L: 0, R: 0 };
  if (doPosture) { const f = body(); for (const s of ["L", "R"] as const) clavFwd0[s] = P(ix[s].arm).sub(P(iN)).dot(f.fwd); }
  const kneeOf = (g: { up: number; leg: number; foot: number }) => 180 - P(g.up).sub(P(g.leg)).angleTo(P(g.foot).sub(P(g.leg))) / d2r;
  /** Turn bone i about a world axis by ang, the way that makes score() smaller (tries both). */
  const turnLess = (i: number, axis: THREE.Vector3, ang: number, score: () => number) => {
    const s0 = score();
    turnWorld(i, new T.Quaternion().setFromAxisAngle(axis, ang)); fk(i);
    if (score() > s0) { turnWorld(i, new T.Quaternion().setFromAxisAngle(axis, -2 * ang)); fk(i); }
  };
  /** Two bones (thigh, shin) back onto a foot place: knee in the plane it was in, the foot keeping its turn. */
  const legOnto = (g: { up: number; leg: number; foot: number }, F: THREE.Vector3, footQ: THREE.Quaternion, pole: THREE.Vector3) => {
    const A = P(g.up), K = P(g.leg), Fn = P(g.foot);
    const a = A.distanceTo(K), b = K.distanceTo(Fn);
    const to = F.clone().sub(A); const d0 = to.length(); to.divideScalar(d0);
    const d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, d0));
    const ca = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), sa = Math.sqrt(1 - ca * ca);
    const pn = pole.clone().addScaledVector(to, -pole.dot(to)).normalize();
    const K2 = A.clone().addScaledVector(to, a * ca).addScaledVector(pn, a * sa);
    turnWorld(g.up, new T.Quaternion().setFromUnitVectors(K.clone().sub(A).normalize(), K2.clone().sub(A).normalize())); fk(g.up);
    const K3 = P(g.leg);
    turnWorld(g.leg, new T.Quaternion().setFromUnitVectors(P(g.foot).sub(K3).normalize(), F.clone().sub(K3).normalize())); fk(g.leg);
    lq[g.foot].copy(parentWQ(g.foot).invert().multiply(footQ)).normalize(); fk(g.foot);
  };
  const posture = (): number => {
    if (!doPosture) return 0;
    let f = body();
    const wU = sstep(0.82, 0.92, f.hip.y / bindHipY) * sstep(Math.cos(40 * d2r), Math.cos(25 * d2r), P(iN).sub(f.hip).normalize().y);
    if (wU <= 0) return 0;
    // 0a. still: the hips back over the feet, over the standing leg, the standing knee soft
    if (still) {
      const feet = { L: P(LG.L.foot), R: P(LG.R.foot) }, footQ = { L: WQ(LG.L.foot), R: WQ(LG.R.foot) };
      const pole = { L: P(LG.L.leg).sub(f.hip), R: P(LG.R.leg).sub(f.hip) };
      const kb = { L: kneeOf(LG.L), R: kneeOf(LG.R) };
      const stance: "L" | "R" = kb.L <= kb.R ? "L" : "R";
      const relaxed = kb.L - kb.R > 6 || kb.R - kb.L > 6;
      const shift = new T.Vector3();
      const ahead = f.hip.clone().sub(f.ank).dot(f.fwd) - POSTURE.HIP_FWD * f.torso;
      if (ahead > 0) shift.addScaledVector(f.fwd, -ahead);
      if (relaxed) {
        const want = feet[stance].clone().sub(f.ank).dot(f.across) * POSTURE.SHIFT, now = f.hip.clone().sub(f.ank).dot(f.across);
        if (Math.abs(want) > Math.abs(now) && Math.sign(want) === Math.sign(want - now)) shift.addScaledVector(f.across, want - now);
      }
      // the height: the standing knee at KNEE_STANCE at most (or as it is, if straighter)
      const g = LG[stance];
      const a = P(g.up).distanceTo(P(g.leg)), b = P(g.leg).distanceTo(P(g.foot));
      const kn = Math.min(kb[stance], POSTURE.KNEE_STANCE) * d2r;
      const dWant = Math.sqrt(a * a + b * b + 2 * a * b * Math.cos(kn));
      const hs = P(g.up).add(shift), hor = Math.hypot(hs.x - feet[stance].x, hs.z - feet[stance].z);
      if (dWant > hor) shift.y = feet[stance].y + Math.sqrt(dWant * dWant - hor * hor) - P(g.up).y;
      // never so high the other leg cannot reach its foot (knee 3° at least)
      const o: "L" | "R" = stance === "L" ? "R" : "L", go = LG[o];
      const ao = P(go.up).distanceTo(P(go.leg)), bo = P(go.leg).distanceTo(P(go.foot));
      const dMax = Math.sqrt(ao * ao + bo * bo + 2 * ao * bo * Math.cos(3 * d2r));
      const ho = P(go.up).add(shift), horO = Math.hypot(ho.x - feet[o].x, ho.z - feet[o].z);
      if (dMax > horO) shift.y = Math.min(shift.y, feet[o].y + Math.sqrt(dMax * dMax - horO * horO) - P(go.up).y);
      shift.multiplyScalar(wU);
      if (shift.lengthSq() > 1e-8) {
        const hw = P(iH).add(shift);
        lp[iH].copy(hw.applyMatrix4(topInv)); fk();
        legOnto(LG.L, feet.L, footQ.L, pole.L);
        legOnto(LG.R, feet.R, footQ.R, pole.R);
      }
      f = body();
    }
    // 0b. chest up: the shoulders over the hips, the turn spread up the spine
    const shMax = (still ? POSTURE.SH_FWD : POSTURE.SH_FWD_MOVE) * f.torso;
    const shAhead = () => mid2(ix.L.arm, ix.R.arm).sub(mid2(LG.L.up, LG.R.up)).dot(f.fwd);
    const e = shAhead() - shMax;
    if (e > 0.002 && spineI.length) {
      const ang = Math.atan2(e, f.torso) * wU;
      spineI.forEach((i, j) => turnLess(i, f.across, ang * [0.4, 0.3, 0.3][j], shAhead));
    }
    // 0c. head back over the shoulders: the neck takes it back, the head keeps where it looks
    const hdMax = (still ? POSTURE.HEAD_FWD : POSTURE.HEAD_FWD_MOVE) * f.torso;
    const hdAhead = () => { const b2 = body(); return b2.head.clone().sub(b2.sh).dot(f.fwd); };
    const e2 = hdAhead() - hdMax;
    if (e2 > 0.002) {
      const headQ = WQ(iHead);
      const len = Math.max(0.08, body().head.distanceTo(P(iN)));
      turnLess(iN, f.across, Math.atan2(e2, len) * wU, hdAhead);
      lq[iHead].copy(parentWQ(iHead).invert().multiply(headQ)).normalize(); fk(iHead);
    }
    // 0d. a collarbone rolled forward goes back (the upper arm keeps where it points)
    for (const s of ["L", "R"] as const) {
      const c = ix[s];
      const fw = () => P(c.arm).sub(P(iN)).dot(f.fwd);
      const e3 = fw() - clavFwd0[s] - POSTURE.CLAV_FWD;
      if (e3 <= 0) continue;
      const armW = WQ(c.arm), lev = Math.max(0.05, P(c.arm).distanceTo(P(c.clav)));
      turnLess(c.clav, new T.Vector3(0, 1, 0), Math.atan2(e3 + 0.5 * POSTURE.CLAV_FWD, lev) * wU, fw);
      lq[c.arm].copy(parentWQ(c.arm).invert().multiply(armW)).normalize(); fk(c.clav);
    }
    return wU;
  };

  // how deep a world point goes into the torso (0: outside), and the outward way, on this pose
  const toBindH = new T.Matrix4(), toBindC = new T.Matrix4(), fromBindH = new T.Matrix4(), fromBindC = new T.Matrix4();
  const legTo: Record<string, { to: THREE.Matrix4; from: THREE.Matrix4 }> = {};
  const boneToBind = (b: string) => legTo[b];
  const framePose = () => {
    for (const [b, M] of Object.entries(sb.bindM)) {
      const i = idx(b); if (i < 0) continue;
      const to = new T.Matrix4().multiplyMatrices(M, new T.Matrix4().copy(Wm[i]).invert());
      legTo[b] = { to, from: to.clone().invert() };
    }
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
    // the legs and the head (each mapped back onto its bind pose by its own bone)
    for (const tb of sb.tubes) {
      const M = boneToBind(tb.bone); if (!M) continue;
      const pb = pw.clone().applyMatrix4(M.to);
      const t = pb.clone().sub(tb.A).dot(tb.u) / tb.len;
      const rs = tb.rings;
      if (t < rs[0].t || t > rs[rs.length - 1].t) continue;
      let k = 0; while (k < rs.length - 1 && rs[k + 1].t < t) k++;
      const r0 = rs[k], r1 = rs[Math.min(k + 1, rs.length - 1)];
      const f = r1.t > r0.t ? (t - r0.t) / (r1.t - r0.t) : 0;
      const c = r0.c.clone().lerp(r1.c, f);
      const off = pb.clone().sub(c); off.addScaledVector(tb.u, -off.dot(tb.u));
      const rho = off.length();
      const d = r0.r + (r1.r - r0.r) * f + r + CLEARANCE - rho;
      if (d > best.d) {
        const nb = rho > 1e-4 ? off.divideScalar(rho) : new T.Vector3(1, 0, 0);
        const o = pb.clone().applyMatrix4(M.from), tt = pb.clone().add(nb).applyMatrix4(M.from);
        best = { d, n: tt.sub(o).normalize() };
      }
    }
    if (sb.head) {
      const M = boneToBind("Head");
      if (M) {
        const pb = pw.clone().applyMatrix4(M.to), dv = pb.clone().sub(sb.head.c);
        const ax = sb.head.ax.clone().addScalar(r + CLEARANCE);
        const sc = Math.hypot(dv.x / ax.x, dv.y / ax.y, dv.z / ax.z);
        if (sc < 1) {
          const d = (1 - sc) * dv.length() / Math.max(sc, 0.2);
          if (d > best.d) {
            const nb = dv.lengthSq() > 1e-8 ? dv.clone().normalize() : new T.Vector3(0, 0, 1);
            const o = pb.clone().applyMatrix4(M.from), tt = pb.clone().add(nb).applyMatrix4(M.from);
            best = { d, n: tt.sub(o).normalize() };
          }
        }
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
  // the posture's bones (0): the spine, neck and head; standing still, the hips and legs too
  const postBones = !doPosture ? [] : [...spineI, iN, iHead, ...(still ? [iH, LG.L.up, LG.L.leg, LG.L.foot, LG.R.up, LG.R.leg, LG.R.foot] : [])].filter((i, j, a) => i >= 0 && a.indexOf(i) === j);
  for (const b of postBones) out[sb.order[b]] = [];
  const hipsOut: number[] = [];
  /** Per key, per side: the arm's push off the body, as a rotation vector in the chest's own frame. */
  const push: Record<"L" | "R", THREE.Vector3[]> = { L: [], R: [] };
  const local = { L: [] as THREE.Quaternion[][], R: [] as THREE.Quaternion[][] };
  let clavB = 0, clavA = 0, inB = 0;
  /** The whole pose at each key after 0–2 (the arm turns of 3 go on top in the second pass). */
  const snap: { q: THREE.Quaternion[]; p: THREE.Vector3[] }[] = [];
  const evalKey = (t: number) => {
    for (let i = 0; i < n; i++) {
      const q = qTr[i]; if (q) { const v = q.evaluate(t); lq[i].set(v[0], v[1], v[2], v[3]).normalize(); } else lq[i].copy(sb.restQ[i]);
      const p = pTr[i]; if (p) { const v = p.evaluate(t); lp[i].set(v[0], v[1], v[2]); } else lp[i].copy(sb.restPos[i]);
    }
    fk();
  };
  for (let k = 0; k < K; k++) {
    evalKey(times[k]);
    const wP = posture();
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
      // 2. standing still, a hanging arm a little out from his side (POSTURE.ARM_OUT)
      if (still && wP > 0 && armUp < 35) {
        const abd = () => { const u = P(c.fore).sub(P(c.arm)); return Math.atan2(Math.abs(u.dot(across)), -u.dot(up)) / d2r; };
        const e4 = POSTURE.ARM_OUT - abd();
        if (e4 > 0.5) turnLess(c.arm, fwd, e4 * d2r * wP, () => -abd());
      }
      // 2. a hanging arm's elbow never locked straight (softer standing: POSTURE.ELBOW)
      if (armUp < 60) {
        const el = P(c.arm).sub(P(c.fore)).angleTo(P(c.hand).sub(P(c.fore))) / d2r;
        const want = 180 - (wP > 0 ? ELBOW_SOFT + (POSTURE.ELBOW - ELBOW_SOFT) * wP : ELBOW_SOFT);
        if (el > want) {
          const before = P(c.hand).dot(fwd);
          turnWorld(c.fore, new T.Quaternion().setFromAxisAngle(across, (el - want) * d2r));
          fk(c.fore);
          if (P(c.hand).dot(fwd) < before) { turnWorld(c.fore, new T.Quaternion().setFromAxisAngle(across, -2 * (el - want) * d2r)); fk(c.fore); }
        }
      }
      // standing still, the hand back beside the thigh (POSTURE.HAND_FWD), after the elbow has its bend
      if (still && wP > 0 && armUp < 35) {
        const hf = () => P(c.hand).sub(mid2(LG.L.up, LG.R.up)).dot(fwd);
        const e5 = hf() - POSTURE.HAND_FWD;
        if (e5 > 0.003) turnLess(c.arm, across, Math.atan2(e5, Math.max(0.3, P(c.hand).distanceTo(P(c.arm)))) * wP, hf);
      }
    }
    snap.push({ q: lq.map((q) => q.clone()), p: lp.map((v) => v.clone()) });
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
    for (let i = 0; i < n; i++) { lq[i].copy(snap[k].q[i]); lp[i].copy(snap[k].p[i]); }
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
    for (const b of postBones) { const q = lq[b]; out[sb.order[b]].push(q.x, q.y, q.z, q.w); }
    hipsOut.push(lp[iH].x, lp[iH].y, lp[iH].z);
  }
  for (const b of [...writeBones, ...postBones]) {
    const name = `${sb.order[b]}.quaternion`;
    const tr = new T.QuaternionKeyframeTrack(name, times, out[sb.order[b]]);
    const i = clip.tracks.findIndex((x) => x.name === name);
    if (i >= 0) clip.tracks[i] = tr; else clip.tracks.push(tr);
  }
  if (still) {
    const name = `${NAMES.hips}.position`;
    const tr = new T.VectorKeyframeTrack(name, times, hipsOut);
    const i = clip.tracks.findIndex((x) => x.name === name);
    if (i >= 0) clip.tracks[i] = tr; else clip.tracks.push(tr);
  }
  void tmpQ;
  return { clip: clip.name, clavBefore: clavB / d2r, clavAfter: clavA / d2r, inBefore: Math.max(0, inB) * 100, inAfter: Math.max(0, inA) * 100, turned };
}

/**
 * THE SAME CLEARANCE, LIVE, for a pose the clips did not make (cut-scene IK:
 * a hand reached to a desk, a pen, a cup; a "ref-…" hold). After the reaches,
 * each arm whose elbow, forearm, wrist, palm or finger ends would be inside his
 * torso, legs or head turns about the shoulder just enough to come out (at
 * most PUSH_LIVE_MAX). Stateless (a function of the pose alone), so a seekable
 * cut scene stays seekable; the push is proportional to the depth, so it grows
 * and fades smoothly as the pose moves. `w` scales it (0 = off).
 */
export const PUSH_LIVE_MAX = 25;
export function clearArmsLive(T: Three, sb: ShoulderBody, bones: Record<string, THREE.Bone>, w = 1, skip?: { L?: boolean; R?: boolean }): number {
  if (w <= 0) return 0;
  const need = ["Hips", "Spine", NAMES.L.arm, NAMES.R.arm, NAMES.L.fore, NAMES.R.fore, NAMES.L.hand, NAMES.R.hand];
  if (need.some((n) => !bones[n])) return 0;
  const P = (n: string) => new T.Vector3().setFromMatrixPosition(bones[n].matrixWorld);
  const WQ = (n: string) => { const q = new T.Quaternion(); bones[n].matrixWorld.decompose(new T.Vector3(), q, new T.Vector3()); return q; };
  const to = (bind: THREE.Matrix4, n: string) => { const m = new T.Matrix4().multiplyMatrices(bind, bones[n].matrixWorld.clone().invert()); return { to: m, from: m.clone().invert() }; };
  let mH = to(sb.hipsBind, "Hips"), mC = to(sb.chestBind, "Spine");
  const legs: Record<string, { to: THREE.Matrix4; from: THREE.Matrix4 }> = {};
  const refresh = () => {
    mH = to(sb.hipsBind, "Hips"); mC = to(sb.chestBind, "Spine");
    for (const b of Object.keys(sb.bindM)) if (bones[b]) legs[b] = to(sb.bindM[b], b);
  };
  refresh();
  const mid = sb.hipY + (sb.neckY - sb.hipY) * 0.35;
  const depthOf = (pw: THREE.Vector3, r: number): { d: number; n: THREE.Vector3 } => {
    let best = { d: 0, n: new T.Vector3() };
    const out = (pb: THREE.Vector3, nb: THREE.Vector3, from: THREE.Matrix4, d: number) => {
      if (d <= best.d) return;
      const o = pb.clone().applyMatrix4(from), t = pb.clone().add(nb).applyMatrix4(from);
      best = { d, n: t.sub(o).normalize() };
    };
    for (const [m, lo, hi] of [[mH, -1, mid + 0.06], [mC, mid - 0.06, 9]] as const) {
      const pb = pw.clone().applyMatrix4(m.to);
      if (pb.y < lo || pb.y > hi) continue;
      const s = sb.slices;
      if (!s.length || pb.y < s[0].y - 0.01 || pb.y > s[s.length - 1].y + 0.01) continue;
      let k = 0; while (k < s.length - 1 && s[k + 1].y < pb.y) k++;
      const sl = s[k];
      const dx = pb.x - sl.cx, dz = pb.z - sl.cz, rho = Math.hypot(dx, dz);
      const f = (((Math.atan2(dz, dx) / (2 * Math.PI)) * BINS) + BINS) % BINS, kk = Math.floor(f), u = f - kk;
      const R = sl.r[kk % BINS] * (1 - u) + sl.r[(kk + 1) % BINS] * u;
      out(pb, rho > 1e-4 ? new T.Vector3(dx / rho, 0, dz / rho) : new T.Vector3(1, 0, 0), m.from, R + r + CLEARANCE - rho);
    }
    for (const tb of sb.tubes) {
      const M = legs[tb.bone]; if (!M) continue;
      const pb = pw.clone().applyMatrix4(M.to);
      const t = pb.clone().sub(tb.A).dot(tb.u) / tb.len, rs = tb.rings;
      if (t < rs[0].t || t > rs[rs.length - 1].t) continue;
      let k = 0; while (k < rs.length - 1 && rs[k + 1].t < t) k++;
      const r0 = rs[k], r1 = rs[Math.min(k + 1, rs.length - 1)];
      const f = r1.t > r0.t ? (t - r0.t) / (r1.t - r0.t) : 0;
      const off = pb.clone().sub(r0.c.clone().lerp(r1.c, f)); off.addScaledVector(tb.u, -off.dot(tb.u));
      const rho = off.length();
      out(pb, rho > 1e-4 ? off.divideScalar(rho) : new T.Vector3(1, 0, 0), M.from, r0.r + (r1.r - r0.r) * f + r + CLEARANCE - rho);
    }
    if (sb.head && legs.Head) {
      const pb = pw.clone().applyMatrix4(legs.Head.to), dv = pb.clone().sub(sb.head.c);
      const ax = sb.head.ax.clone().addScalar(r + CLEARANCE);
      const sc = Math.hypot(dv.x / ax.x, dv.y / ax.y, dv.z / ax.z);
      if (sc < 1) out(pb, dv.lengthSq() > 1e-8 ? dv.clone().normalize() : new T.Vector3(0, 0, 1), legs.Head.from, (1 - sc) * dv.length() / Math.max(sc, 0.2));
    }
    return best;
  };
  let turned = 0;
  for (const s of ["L", "R"] as const) {
    // a hand on a prop's handle stays there (the prop would slip out of it)
    if (skip?.[s]) continue;
    const arm = NAMES[s].arm;
    const pts = () => sb.rings[s].filter((g) => bones[g.bone] && bones[g.to]).map((g) => [P(g.bone).lerp(P(g.to), g.t).add(g.off.clone().applyQuaternion(WQ(g.bone))), g.r] as const);
    let total = 0;
    for (let it = 0; it < 4; it++) {
      let worst = { d: 0, n: new T.Vector3(), p: new T.Vector3() };
      for (const [p, r] of pts()) { const x = depthOf(p, r); if (x.d > worst.d) worst = { ...x, p }; }
      if (worst.d <= 0.002) break;
      const lever = worst.p.clone().sub(P(arm));
      const ax = lever.clone().cross(worst.n); const len = ax.length();
      if (len < 1e-5) break;
      const ang = Math.min(0.15, (worst.d + 0.002) / Math.max(0.05, len)) * w;
      if (total + ang > (PUSH_LIVE_MAX * Math.PI) / 180) break;
      total += ang;
      const b = bones[arm];
      const pq = new T.Quaternion(); b.parent!.matrixWorld.decompose(new T.Vector3(), pq, new T.Vector3());
      const wq = pq.clone().multiply(b.quaternion);
      b.quaternion.copy(pq.invert().multiply(new T.Quaternion().setFromAxisAngle(ax.divideScalar(len), ang).multiply(wq))).normalize();
      b.updateMatrixWorld(true);
      refresh();
    }
    turned = Math.max(turned, (total * 180) / Math.PI);
  }
  return turned;
}
