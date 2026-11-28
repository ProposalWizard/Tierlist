/**
 * EVERY STRIDE FITTED TO THE BODY THAT WALKS IT (Harry, Nov 2026, in order: "the walking animation… legs like
 * squeezing past each other… the quality is like jittering"; "the feet still seem abnormally close together";
 * "find walking animations and match them to our style/bodies"). Measured with scripts/walk3d/measure.mts.
 *
 * WHAT WAS WRONG, measured on the real bodies in their kit cloth (c1, c2, c3 alike, as a share of the hip
 * joints' width): the motion-capture walk (CMU 16_15) plants the feet 47% of the hips apart, 9 to 11 cm. That is
 * a real man's step width (8 to 13 cm between heel centres), but a real man's boot is 9 cm wide and ours, on a
 * toon body, 11 to 12: so every step the swinging boot went 3 to 4 cm INTO the planted ankle, and from the front
 * the feet landed on one line. The jog crossed over (-10%), the run 5%, the sprint 24%, the slump walk 34%: the
 * capture actors' legs were slim, ours are not. The Quaternius UAL walks (stylised bodies like ours) plant at 88%.
 *
 * THE FIX, once per body and clip when a person is made (cached, shared by everyone with the same head):
 *   1. Each foot's plants are measured on this body (its side position while it is on the ground).
 *   2. If a foot is planted nearer the middle than half of STRIDE_SHARE of the hips, that ankle is moved out by
 *      the same amount on every frame (two-bone leg IK, the knee's bend kept in its own plane, the foot keeps its exact turn): the clip's
 *      stride, timing, knee lift and sway are untouched, only where across the feet land.
 *   3. The clip's real ground speed on this body (how fast a planted foot goes back) is kept (groundSpeedOf),
 *      so anything that moves him (ClipPlayer.loco, the cut scenes) runs the stride clock off the ground:
 *      the planted foot stays put.
 * `?stride=0` on any 3D page (STRIDE=0 in the tests): the clips as the files have them.
 */
import type * as THREE from "three";

type Three = typeof import("three");

/**
 * Where the feet are planted, as a share of the hip joints' width (only ever widened). A real adult walks at
 * about 55%; our legs and boots are fuller, so a walk is planted under the hips (the UAL walks: 88%), a run a
 * little inside them (runners land nearer the middle), never on one line.
 */
export const STRIDE_SHARE: Record<string, number> = {
  walk: 0.96, slump_walk: 0.96, Walk_Loop: 0.96,
  jog: 0.68, run: 0.66, sprint: 0.64, dribble_run: 0.66, Jog_Fwd_Loop: 0.68,
};
/** The loops whose ground speed is measured (everything that walks or runs). */
export const LOCO_CLIPS = new Set(["walk", "walk_relaxed", "walk_formal", "slump_walk", "jog", "jog_easy", "run", "sprint", "dribble_run", "Walk_Loop", "Jog_Fwd_Loop"]);

export function strideOn(): boolean {
  try {
    if (typeof window === "undefined") return !(typeof process !== "undefined" && process.env?.STRIDE === "0");
    return new URLSearchParams(window.location.search).get("stride") !== "0";
  } catch { return true; }
}

const SPEED = new WeakMap<THREE.AnimationClip, number>();
/** The clip's own ground speed on the body it was fitted to (m/s at timeScale 1): a planted foot's speed backwards. */
export function groundSpeedOf(clip: THREE.AnimationClip | null | undefined): number | undefined { return clip ? SPEED.get(clip) : undefined; }

/** The body a fit belongs to: its file and proportions (a build only scales it, and the fit is in unscaled metres). */
export const strideKey = (meta: { file?: unknown; model?: unknown }, head?: string, prop?: string) => `${String(meta.file ?? meta.model ?? "")}|${head ?? ""}|${prop ?? "a"}`;

export interface StrideFit { tracks: { name: string; times: Float32Array; values: Float32Array }[]; before: number; after: number; hip: number; speed: number; carriage?: CarriageReport }
const CACHE = new Map<string, StrideFit | null>();

/**
 * Fit one clip (a person's own copy) to the body. `inner`: the person's scaled group (bones under it), worked in
 * its own unscaled frame, so one fit serves every build of a head. `key`: the body file (head + proportions).
 */
export function fitStride(T: Three, inner: THREE.Object3D, bones: Record<string, THREE.Bone>, clip: THREE.AnimationClip, key: string): StrideFit | null {
  if (!LOCO_CLIPS.has(clip.name)) return null;
  const ck = `${key}|${clip.name}|${clip.duration.toFixed(4)}|${strideOn() ? 1 : 0}`;
  let fit = CACHE.get(ck);
  if (fit === undefined) {
    fit = measureAndFit(T, inner, bones, clip, strideOn() ? STRIDE_SHARE[clip.name] ?? 0 : 0);
    // a light walk's carriage (upright back, head up, arms that swing): read off the clip's own curves, before any track is replaced
    if (fit && strideOn() && carriageOn() && CARRIAGE[clip.name]) { const c = fitCarriage(T, inner, bones, clip, CARRIAGE[clip.name]); if (c) { fit.tracks.push(...c.tracks); fit.carriage = c.report; } }
    CACHE.set(ck, fit);
  }
  if (!fit) return null;
  if (fit.tracks.length) {
    const names = new Set(fit.tracks.map((t) => t.name));
    clip.tracks = clip.tracks.filter((t) => !names.has(t.name));
    for (const t of fit.tracks) clip.tracks.push(new T.QuaternionKeyframeTrack(t.name, t.times as never, t.values as never));
  }
  SPEED.set(clip, fit.speed);
  return fit;
}

function measureAndFit(T: Three, inner: THREE.Object3D, bones: Record<string, THREE.Bone>, clip: THREE.AnimationClip, share: number): StrideFit | null {
  const SIDES = [["Left", 1], ["Right", -1]] as const;
  const leg = SIDES.map(([S]) => ({ t: bones[`${S}UpLeg`], k: bones[`${S}Leg`], f: bones[`${S}Foot`] }));
  if (leg.some((l) => !l.t || !l.k || !l.f) || !bones.Hips) return null;
  // every animated bone, read straight off the clip's own curves (no mixer: nothing else is disturbed)
  const drive: { o: THREE.Object3D; q: boolean; it: THREE.Interpolant }[] = [];
  for (const tr of clip.tracks) {
    const dot = tr.name.lastIndexOf(".");
    const o = inner.getObjectByName(tr.name.slice(0, dot));
    const prop = tr.name.slice(dot + 1);
    if (o && (prop === "quaternion" || prop === "position")) drive.push({ o, q: prop === "quaternion", it: tr.createInterpolant() });
  }
  const saved: [THREE.Object3D, THREE.Vector3, THREE.Quaternion][] = drive.map((d) => [d.o, d.o.position.clone(), d.o.quaternion.clone()]);
  const pose = (t: number) => {
    for (const d of drive) { const r = d.it.evaluate(t); if (d.q) d.o.quaternion.fromArray(r as unknown as number[]); else d.o.position.fromArray(r as unknown as number[]); }
    inner.updateMatrixWorld(true);
  };
  // the person's unscaled frame: +x his left, +z his front, metres
  inner.updateWorldMatrix(true, false);
  const inv = new T.Matrix4().copy(inner.matrixWorld).invert();
  const M = new T.Matrix4(), dp = new T.Vector3(), ds = new T.Vector3();
  const P = (o: THREE.Object3D) => new T.Vector3().setFromMatrixPosition(M.multiplyMatrices(inv, o.matrixWorld));
  const Q = (o: THREE.Object3D) => { const q = new T.Quaternion(); M.multiplyMatrices(inv, o.matrixWorld).decompose(dp, q, ds); return q; };
  const D = clip.duration;
  const N = Math.max(8, Math.round(D * 30));
  const times = Float32Array.from({ length: N + 1 }, (_, i) => (i / N) * D);
  // 1. this body's plants: ankle heights, sides, the hips' width
  const ank: THREE.Vector3[][] = [[], []];
  let hipW = 0, mid = 0;
  for (let i = 0; i <= N; i++) {
    pose(times[i]);
    leg.forEach((l, s) => ank[s].push(P(l.f)));
    const hl = P(leg[0].t).x, hr = P(leg[1].t).x;
    hipW += (hl - hr) / (N + 1); mid += (hl + hr) / 2 / (N + 1);
  }
  const stance = ank.map((a) => { const lo = Math.min(...a.map((v) => v.y)); return a.map((v) => v.y < lo + 0.015); });
  const meanX = (s: number) => { const xs = ank[s].filter((_, i) => stance[s][i]).map((v) => v.x); return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length); };
  const before = meanX(0) - meanX(1);
  const back: number[] = [];
  const dt = D / N;
  for (let s = 0; s < 2; s++) for (let i = 0; i < N; i++) if (stance[s][i] && stance[s][i + 1]) back.push(-(ank[s][i + 1].z - ank[s][i].z) / dt);
  back.sort((a, b) => a - b);
  const speed = back.length ? back[Math.floor(back.length / 2)] : 0;
  // each foot on its own: a capture that plants one foot across the middle (the jog's right) moves that one more.
  // (Moving a run's feet out only while they are down was tried: the thighs then passed 2.2 cm into each other
  // mid-swing, against 0 when the whole stride moves.)
  const outs = [Math.max(0, (share * hipW) / 2 - (meanX(0) - mid)), Math.max(0, (share * hipW) / 2 - (mid - meanX(1)))];
  const fit: StrideFit = { tracks: [], before, after: before, hip: hipW, speed };
  if (outs[0] < 0.002 && outs[1] < 0.002) { restore(saved, inner); return fit; }
  // 2. each ankle out by `out`, every frame: two-bone IK, the knee in its own bend plane, the foot's turn kept
  const vals = leg.map(() => ({ t: new Float32Array((N + 1) * 4), k: new Float32Array((N + 1) * 4), f: new Float32Array((N + 1) * 4) }));
  const fwd = new T.Vector3(0, 0, 1);
  for (let i = 0; i <= N; i++) {
    pose(times[i]);
    leg.forEach((l, s) => {
      const sg = SIDES[s][1];
      const H = P(l.t), K = P(l.k), A = P(l.f);
      const qPar = Q(l.t.parent!), qT = Q(l.t), qK = Q(l.k), qF = Q(l.f);
      const l1 = H.distanceTo(K), l2 = K.distanceTo(A);
      const A2 = A.clone().add(new T.Vector3(sg * outs[s], 0, 0));
      const toA = A2.clone().sub(H);
      const d = Math.min(Math.max(toA.length(), Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
      const n = toA.normalize();
      // the knee's side of the hip-ankle line, as the clip had it (a straight leg: forward)
      const a0 = A.clone().sub(H).normalize();
      const pole = K.clone().sub(H); pole.sub(a0.clone().multiplyScalar(pole.dot(a0)));
      if (pole.lengthSq() < 1e-8) pole.copy(fwd);
      pole.sub(n.clone().multiplyScalar(pole.dot(n))).normalize();
      const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
      const K2 = H.clone().add(n.clone().multiplyScalar(along)).add(pole.multiplyScalar(Math.sqrt(Math.max(0, l1 * l1 - along * along))));
      const rT = new T.Quaternion().setFromUnitVectors(K.clone().sub(H).normalize(), K2.clone().sub(H).normalize());
      const qT2 = rT.clone().multiply(qT);
      const shinNow = A.clone().sub(K).applyQuaternion(rT).normalize();
      const qK2 = new T.Quaternion().setFromUnitVectors(shinNow, A2.clone().sub(K2).normalize()).multiply(rT).multiply(qK);
      const lt = qPar.clone().invert().multiply(qT2), lk = qT2.clone().invert().multiply(qK2), lf = qK2.clone().invert().multiply(qF);
      lt.toArray(vals[s].t, i * 4); lk.toArray(vals[s].k, i * 4); lf.toArray(vals[s].f, i * 4);
    });
  }
  leg.forEach((l, s) => {
    fit.tracks.push({ name: `${l.t.name}.quaternion`, times, values: vals[s].t });
    fit.tracks.push({ name: `${l.k.name}.quaternion`, times, values: vals[s].k });
    fit.tracks.push({ name: `${l.f.name}.quaternion`, times, values: vals[s].f });
  });
  fit.after = before + outs[0] + outs[1];
  restore(saved, inner);
  return fit;
}

function restore(saved: [THREE.Object3D, THREE.Vector3, THREE.Quaternion][], inner: THREE.Object3D) {
  for (const [o, p, q] of saved) { o.position.copy(p); o.quaternion.copy(q); }
  inner.updateMatrixWorld(true);
}

/**
 * A FIT YOUNG FOOTBALLER'S CARRIAGE (Harry, 28 Nov 2026, on the 22-man walk-out: "walking improved but seems a bit
 * heavy for some"). Measured with scripts/walk3d/gait.mts on c1, c2 and c3 (the same on all three, as the clips are):
 *
 *                 back lean   neck forward   face down   hands' swing
 *   walk (CMU)       2.7°          9°           -2°          22 cm
 *   walk_relaxed    10.6°         41°            9°          32 cm
 *   walk_formal      7.7°         39°            7°           7 cm
 *
 * The two Quaternius walks, dealt to 64 of every 100 people, carry the head 40° in front of the shoulders and the
 * back bent forward: on our big-headed bodies that reads as a trudge, a man carrying a weight. walk_formal's arms
 * also hang (7 cm of swing against a real walker's 20 to 30). Fixed once per body when the person is made, on
 * every frame of the loop, the legs and the rhythm untouched:
 *   - the lowest spine bone turned back about his left-right line until the back leans `lean` degrees (mean);
 *   - the neck turned back until it stands at most `neck` degrees in front of upright (mean);
 *   - the head turned so the face looks level, as on the capture walk (`face` degrees down);
 *   - (swing) each upper arm's swing about its own mean pose made bigger until the hands travel `swing` m.
 * `?carriage=0` on any 3D page (CARRIAGE=0 in the tests): the clips' own carriage.
 */
export interface Carriage { lean: number; neck: number; face: number; swing?: number }
export const CARRIAGE: Record<string, Carriage> = {
  walk_relaxed: { lean: 4, neck: 14, face: 1 },
  walk_formal: { lean: 4, neck: 14, face: 1, swing: 0.24 },
};
export interface CarriageReport { lean: [number, number]; neck: [number, number]; face: [number, number]; swing: [number, number] }

export function carriageOn(): boolean {
  try {
    if (typeof window === "undefined") return !(typeof process !== "undefined" && process.env?.CARRIAGE === "0");
    return new URLSearchParams(window.location.search).get("carriage") !== "0";
  } catch { return true; }
}

function fitCarriage(T: Three, inner: THREE.Object3D, bones: Record<string, THREE.Bone>, clip: THREE.AnimationClip, want: Carriage): { tracks: StrideFit["tracks"]; report: CarriageReport } | null {
  const spine = bones.Spine02, neck = bones.neck, head = bones.Head, front = bones.headfront, hips = bones.Hips;
  const arms = [bones.LeftArm, bones.RightArm], hands = [bones.LeftHand, bones.RightHand];
  if (!spine || !neck || !head || !front || !hips || arms.some((a) => !a) || hands.some((h) => !h)) return null;
  const drive: { o: THREE.Object3D; q: boolean; it: THREE.Interpolant }[] = [];
  for (const tr of clip.tracks) {
    const dot = tr.name.lastIndexOf(".");
    const o = inner.getObjectByName(tr.name.slice(0, dot));
    const prop = tr.name.slice(dot + 1);
    if (o && (prop === "quaternion" || prop === "position")) drive.push({ o, q: prop === "quaternion", it: tr.createInterpolant() });
  }
  const saved: [THREE.Object3D, THREE.Vector3, THREE.Quaternion][] = drive.map((d) => [d.o, d.o.position.clone(), d.o.quaternion.clone()]);
  const pose = (t: number) => {
    for (const d of drive) { const r = d.it.evaluate(t); if (d.q) d.o.quaternion.fromArray(r as unknown as number[]); else d.o.position.fromArray(r as unknown as number[]); }
    inner.updateMatrixWorld(true);
  };
  inner.updateWorldMatrix(true, false);
  const inv = new T.Matrix4().copy(inner.matrixWorld).invert();
  const M = new T.Matrix4(), dp = new T.Vector3(), ds = new T.Vector3();
  const P = (o: THREE.Object3D) => new T.Vector3().setFromMatrixPosition(M.multiplyMatrices(inv, o.matrixWorld));
  const Q = (o: THREE.Object3D) => { const q = new T.Quaternion(); M.multiplyMatrices(inv, o.matrixWorld).decompose(dp, q, ds); return q; };
  const deg = 180 / Math.PI;
  const leanOf = () => { const d = P(neck).sub(P(hips)); return Math.atan2(d.z, d.y) * deg; };
  const neckOf = () => { const d = P(head).sub(P(neck)); return Math.atan2(d.z, d.y) * deg; };
  const faceOf = () => { const a = P(head), b = P(front); return Math.atan2(a.y - b.y, Math.hypot(b.x - a.x, b.z - a.z)) * deg; };
  const swingOf = (zs: number[]) => Math.max(...zs) - Math.min(...zs);
  const handZ = () => P(hands[0]).z - P(hips).z;
  const D = clip.duration;
  const N = Math.max(8, Math.round(D * 30));
  const times = Float32Array.from({ length: N + 1 }, (_, i) => (i / N) * D);
  // turn a bone by `ang` (degrees) about his left-right line, in his own frame
  const X = new T.Vector3(1, 0, 0);
  const turn = (o: THREE.Object3D, ang: number) => {
    if (Math.abs(ang) < 1e-3) return;
    const r = new T.Quaternion().setFromAxisAngle(X, ang / deg);
    o.quaternion.copy(Q(o.parent!).invert().multiply(r.multiply(Q(o))));
    o.updateMatrixWorld(true);
  };
  // one frame with the turns (degrees) and the arms' swing made `amp` times bigger about their mean pose in his
  // own frame (the hands' swing is the torso's turn and the arm's together: the arm alone runs against the torso)
  const meanW = arms.map(() => new T.Quaternion(0, 0, 0, 0));
  const dq = new T.Quaternion(), ax = new T.Vector3();
  const frame = (i: number, e: { lean: number; neck: number; face: number; amp: number }) => {
    pose(times[i]);
    turn(spine, -e.lean);
    turn(neck, -e.neck);
    turn(head, -e.face);
    if (e.amp > 1.01) arms.forEach((a, s) => {
      // only the swing forward and back (the turn about his left-right line) grows: a bigger sideways part
      // brought the hand 3 cm into the hip. And the arm held 4 degrees further out from the body.
      dq.copy(Q(a)).multiply(meanW[s].clone().invert());
      if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
      const tw = new T.Quaternion(dq.x, 0, 0, dq.w).normalize();
      const rest = dq.clone().multiply(tw.clone().invert());
      const ang = 2 * Math.atan2(tw.x, tw.w);
      const out = new T.Quaternion().setFromAxisAngle(ax.set(0, 0, 1), ((s === 0 ? 1 : -1) * 4) / deg);
      const q2 = out.multiply(rest).multiply(new T.Quaternion().setFromAxisAngle(X, ang * e.amp)).multiply(meanW[s]);
      a.quaternion.copy(Q(a.parent!).invert().multiply(q2));
      a.updateMatrixWorld(true);
    });
  };
  const measure = (e: { lean: number; neck: number; face: number; amp: number }, arm = false) => {
    let lean = 0, nk = 0, face = 0; const hz: number[] = [];
    if (arm) meanW.forEach((m) => m.set(0, 0, 0, 0));
    for (let i = 0; i < N; i++) {
      frame(i, e);
      lean += leanOf() / N; nk += neckOf() / N; face += faceOf() / N; hz.push(handZ());
      if (arm) arms.forEach((a, s) => { const q = Q(a), m = meanW[s]; const sg = m.x * q.x + m.y * q.y + m.z * q.z + m.w * q.w < 0 ? -1 : 1; m.set(m.x + sg * q.x, m.y + sg * q.y, m.z + sg * q.z, m.w + sg * q.w); });
    }
    if (arm) meanW.forEach((m) => m.normalize());
    return { lean, neck: nk, face, swing: swingOf(hz) };
  };
  // 1. as the clip has it; then the turns, found in a few passes (each bone's turn moves the ones above it)
  const e = { lean: 0, neck: 0, face: 0, amp: 1 };
  const m0 = measure(e);
  let m = m0;
  for (let k = 0; k < 4; k++) {
    e.lean = Math.max(0, e.lean + (m.lean - want.lean));
    m = measure(e);
    e.neck = Math.max(0, e.neck + (m.neck - want.neck));
    m = measure(e);
    e.face += m.face - want.face;
    m = measure(e, k === 0);
  }
  if (want.swing && m.swing > 0.01) {
    for (let k = 0; k < 4; k++) { e.amp = Math.min(4.5, Math.max(1, e.amp * (want.swing / Math.max(0.01, m.swing)))); m = measure(e); }
  }
  // 2. written on every key
  const W = [spine, neck, head, ...(e.amp > 1.01 ? arms : [])];
  const vals = W.map(() => new Float32Array((N + 1) * 4));
  for (let i = 0; i <= N; i++) { frame(i, e); W.forEach((o, k) => o.quaternion.toArray(vals[k], i * 4)); }
  for (const [o, p, q] of saved) { o.position.copy(p); o.quaternion.copy(q); }
  inner.updateMatrixWorld(true);
  return {
    tracks: W.map((o, k) => ({ name: `${o.name}.quaternion`, times, values: vals[k] })),
    report: { lean: [m0.lean, m.lean], neck: [m0.neck, m.neck], face: [m0.face, m.face], swing: [m0.swing, m.swing] },
  };
}

/** The carriage fit of a clip on a body, if it had one (for the tests and the gait bench). */
export function carriageReportOf(key: string, clip: THREE.AnimationClip): CarriageReport | undefined {
  for (const [k, f] of Array.from(CACHE.entries())) if (k.startsWith(`${key}|${clip.name}|`) && f?.carriage) return f.carriage;
  return undefined;
}
