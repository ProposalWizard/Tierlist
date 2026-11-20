/**
 * THE STANCE (Harry, 20 Nov 2026, on the re-filmed cut scenes and house walk:
 * "why the legs like squeezing past each other, they look so like awkward and
 * hard to move").
 *
 * Measured on a Style A body (scripts/people3d/legGap.mts): the motion-capture
 * walk put the two ankles 0.5 to 3.5 cm apart across (a tightrope walk), the
 * jog and sprint crossed them (−3 cm: each foot landing on the other's side)
 * and the sprint crossed the knees. The skin of one shin or knee touched the
 * other in about half of every stride (walk 17 of 30 frames, jog 19, sprint
 * 15). Cause: tools/mocap3d/retarget.py puts each ankle where the actor's
 * went, scaled about the middle of his body, so the actor's narrow line comes
 * across unchanged, but our bodies' legs are thicker for their hip width
 * (Style A hips are 10.5 cm joint to joint, the thighs and calves stylised
 * full), so a line a real man walks with clears for him and brushes for us.
 *
 * Fix, baked into each body's own copy of the moving loops when the person is
 * made (makePerson3d and addClips, people3d.ts / footballAnims.ts: so every
 * cut scene, the house, the garden, the shop and the drills get it), measured
 * on that body's own skeleton (a wide-hipped body needs less than a Style A
 * one) and kept per body and clip: each leg is turned out from the hip by one
 * constant angle per clip,
 * just enough that at every key the ankle stays STANCE_ANKLE out from the
 * middle and the knee STANCE_KNEE. Constant per clip, so nothing new moves
 * during a stride and a planted foot does not slide sideways. The foot keeps
 * its own turn in the world (stays flat on the floor; it does not roll onto
 * its edge). Nothing else in the clip changes.
 */
import type * as THREE from "three";

type Three = typeof import("three");

/** The ankles' spacing across (centre to centre) at the narrowest moment of the stride, metres. */
export const STANCE_ANKLE: Record<string, number> = {
  walk: 0.11, walk_confident: 0.11, slump_walk: 0.11, Walk_Loop: 0.11,
  jog: 0.095, Jog_Fwd_Loop: 0.095, dribble_run: 0.095, run: 0.09, sprint: 0.09,
};
/** The knees' spacing across at the narrowest moment, metres. */
export const STANCE_KNEE = 0.12;
/** A knee may sit this far in from the line hip to ankle (towards the other leg), metres; more is turned back out. */
export const KNEE_IN_MAX = 0.01;
/** Never turn a leg out more than this, degrees. */
export const STANCE_MAX_DEG = 9;

export interface StanceReport { clip: string; before: { ankle: number; knee: number }; after: { ankle: number; knee: number }; deg: { L: number; R: number } }

const LEGS = { people: ["LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"], ual: ["thigh_l", "calf_l", "foot_l", "thigh_r", "calf_r", "foot_r"] } as const;
/** `?stance=0` on any 3D page: the clips as captured (for a before still). */
export function stanceOn(): boolean {
  try { return typeof window === "undefined" || new URLSearchParams(window.location.search).get("stance") !== "0"; } catch { return true; }
}
const cache = new Map<string, { report: StanceReport; values: Map<string, Float32Array> }>();

/**
 * Turn this body's copy of a moving loop's legs out (see top), in place.
 * `root`: the person (his own skeleton under it, the bones in `bones` by name);
 * `clip`: his own copy of the clip (it is changed). `key`: the body + clip, so
 * the next person on the same body reuses the answer. Null: not a moving loop,
 * or no leg bones.
 */
export function spreadClipStance(
  T: Three, root: THREE.Object3D, bones: Record<string, THREE.Object3D>, clip: THREE.AnimationClip, key: string,
): StanceReport | null {
  const ankleMin = STANCE_ANKLE[clip.name];
  if (ankleMin == null || !stanceOn()) return null;
  const names = bones.LeftUpLeg ? LEGS.people : bones.thigh_l ? LEGS.ual : null;
  if (!names) return null;
  const [tL, sL, fL, tR, sR, fR] = names.map((n) => bones[n]);
  if (![tL, sL, fL, tR, sR, fR].every(Boolean)) return null;
  const legs = [[tL, sL, fL, 1], [tR, sR, fR, -1]] as const;
  const trackOf = (o: THREE.Object3D) => clip.tracks.find((k) => k.name === `${o.name}.quaternion`);
  const hit = cache.get(key);
  if (hit) {
    for (const [name, v] of Array.from(hit.values)) { const tr = clip.tracks.find((k) => k.name === name); if (tr && tr.values.length === v.length) tr.values = Float32Array.from(v) as never; }
    return hit.report;
  }
  const tracks = legs.map(([t, , f]) => [trackOf(t), trackOf(f)] as const);
  if (tracks.some(([a, b]) => !a || !b)) return null;
  const saved = Object.values(bones).map((b) => [b, b.position.clone(), b.quaternion.clone()] as const);
  const P = (o: THREE.Object3D) => o.getWorldPosition(new T.Vector3());
  const WQ = (o: THREE.Object3D) => o.getWorldQuaternion(new T.Quaternion());
  const setWorld = (o: THREE.Object3D, wq: THREE.Quaternion) => { o.quaternion.copy(WQ(o.parent!).invert().multiply(wq)); o.updateMatrixWorld(true); };
  const frame = () => {
    const across = P(tL).sub(P(tR)); across.y = 0; across.normalize();
    const fwd = new T.Vector3(0, 1, 0).cross(across).normalize().negate();
    const mid = P(tL).add(P(tR)).multiplyScalar(0.5);
    return { across, fwd, mid };
  };
  /** The ankles' and knees' spacing across (left minus right, + = each on its own side). */
  const spacing = () => {
    const { across } = frame();
    return { knee: P(sL).sub(P(sR)).dot(across), ankle: P(fL).sub(P(fR)).dot(across) };
  };
  // + about the body's forward tips a leg towards his left; sg sends each leg out to its own side
  const turnOut = (deg: [number, number]) => {
    const { fwd, across } = frame();
    legs.forEach(([t, s, f, sg], i) => {
      const fq = WQ(f);
      if (deg[i]) setWorld(t, new T.Quaternion().setFromAxisAngle(fwd, (sg * deg[i] * Math.PI) / 180).multiply(WQ(t)));
      // the knee over the foot: a knee that falls in towards the other leg (off the hip-to-ankle line, towards
      // the middle) is turned back out about that line, the ankle staying where it is
      const h = P(t), a = P(f), k = P(s);
      const axis = a.clone().sub(h); const len = axis.length();
      if (len > 1e-4) {
        axis.divideScalar(len);
        const off = k.clone().sub(h); off.sub(axis.clone().multiplyScalar(off.dot(axis)));
        const inward = -off.dot(across) * sg, ahead = off.dot(fwd);
        if (inward > KNEE_IN_MAX && ahead > 0.01) {
          // the turn that brings the knee's sideways offset to KNEE_IN_MAX, about the leg's own line
          const want = Math.atan2(inward, ahead) - Math.atan2(KNEE_IN_MAX, ahead);
          const r = new T.Quaternion().setFromAxisAngle(axis, 0);
          for (const sgn of [1, -1]) {
            r.setFromAxisAngle(axis, sgn * want);
            const o2 = off.clone().applyQuaternion(r);
            if (-o2.dot(across) * sg < inward) break;
          }
          setWorld(t, r.multiply(WQ(t)));
        }
      }
      setWorld(f, fq);
    });
  };
  const mixer = new T.AnimationMixer(root);
  const act = mixer.clipAction(clip);
  act.play();
  // a fresh action is not applied by its first setTime(0): step it once so the first key reads the clip, not the pose before
  mixer.update(1 / 60);
  const pose = (time: number) => {
    for (const [b, p, q] of saved) { b.position.copy(p); b.quaternion.copy(q); }
    mixer.setTime(Math.max(time, 1e-4)); // exactly 0 reads the pose before, not the first key
    root.updateMatrixWorld(true);
  };
  const sample = Array.from(new Set([...Array.from(tracks[0][0]!.times), ...Array.from(tracks[1][0]!.times)])).sort((a, b) => a - b);
  const worst = (deg: [number, number]) => {
    const w = { ankle: 9, knee: 9 };
    for (const time of sample) {
      pose(time); turnOut(deg);
      const o = spacing();
      w.ankle = Math.min(w.ankle, o.ankle); w.knee = Math.min(w.knee, o.knee);
    }
    return w;
  };
  const legLen = P(tL).distanceTo(P(sL)) + P(sL).distanceTo(P(fL)) || 0.85;
  const w0 = worst([0, 0]);
  // one turn for both legs (the stride stays even); each degree on both legs widens the ankles by ~2 x legLen x 1 deg
  let a = 0;
  for (let it = 0; it < 6; it++) {
    const w = worst([a, a]);
    // the knee sits about halfway down the leg: a turn moves it half as far as the ankle
    const need = Math.max(ankleMin - w.ankle, (STANCE_KNEE - w.knee) * 2);
    if (need <= 0.001 || a >= STANCE_MAX_DEG) break;
    a = Math.min(STANCE_MAX_DEG, a + ((need / (2 * legLen)) * 180) / Math.PI);
  }
  const deg: [number, number] = [a, a];
  const w1 = worst(deg);
  const values = new Map<string, Float32Array>();
  if (deg[0] || deg[1]) {
    // every key read from the clip as it was, then written
    legs.forEach(([t, , f], i) => {
      if (!deg[i]) return;
      for (const [track, bone] of [[tracks[i][0]!, t], [tracks[i][1]!, f]] as const) {
        const vals = Float32Array.from(track.values as ArrayLike<number>);
        Array.from(track.times).forEach((time, k) => {
          pose(time); turnOut(deg);
          const q = bone.quaternion;
          vals[k * 4] = q.x; vals[k * 4 + 1] = q.y; vals[k * 4 + 2] = q.z; vals[k * 4 + 3] = q.w;
        });
        values.set(track.name, vals);
      }
    });
    for (const [name, v] of Array.from(values)) { const tr = clip.tracks.find((k) => k.name === name)!; tr.values = Float32Array.from(v) as never; }
  }
  if (typeof process !== "undefined" && process.env?.STANCE_DEBUG) {
    const rng = (f: () => void) => { let lo = 9, hi = -9; for (const time of sample) { pose(time); f(); const o = spacing(); lo = Math.min(lo, o.ankle); hi = Math.max(hi, o.ankle); } return [lo.toFixed(3), hi.toFixed(3)]; };
    console.log("  turned (no write)", rng(() => turnOut(deg)));
    for (const time of sample.slice(0, 3).concat(sample.slice(-2))) { pose(time); const b = spacing().ankle; turnOut(deg); console.log("   t", time.toFixed(3), b.toFixed(3), spacing().ankle.toFixed(3)); }
    mixer.uncacheAction(clip); mixer.uncacheClip(clip);
    const a2 = mixer.clipAction(clip); a2.play();
    console.log("  written", rng(() => {}));
  }
  act.stop();
  mixer.uncacheRoot(root);
  for (const [b, p, q] of saved) { b.position.copy(p); b.quaternion.copy(q); }
  root.updateMatrixWorld(true);
  const half = (w: typeof w0) => ({ ankle: +w.ankle.toFixed(3), knee: +w.knee.toFixed(3) });
  const report = { clip: clip.name, before: half(w0), after: half(w1), deg: { L: +deg[0].toFixed(1), R: +deg[1].toFixed(1) } };
  cache.set(key, { report, values });
  if (typeof process !== "undefined" && process.env?.STANCE_DEBUG) console.log("stance", key, JSON.stringify(report));
  return report;
}
