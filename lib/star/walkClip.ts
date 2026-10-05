/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * A WALK FOR THE ONE BODY (open since v0.26: "the walk is just the jog
 * slowed down, and it looks like it").
 *
 * The people's clips (public/star/people3d/anims.glb) have a jog but no walk,
 * and the old pack's Walk_Loop is on a different skeleton. So the walk is made
 * from the jog itself, on this body's own bones: every joint is pulled most of
 * the way back towards the standing pose. The knees lift a little, the arms
 * hang and swing a little with nearly straight elbows, and the hips bob only
 * a couple of centimetres: a walk, not a jog in slow motion. Same timing as
 * the jog (one stride each foot), played a little slower.
 */

/** How much of the jog each joint keeps (the rest is the standing pose). */
const KEEP: [RegExp, number][] = [
  [/UpLeg/, 0.6],
  [/(Left|Right)Leg\b/, 0.5],
  [/Foot|ToeBase/, 0.5],
  [/ForeArm/, 0.22],
  [/(Left|Right)Arm\b/, 0.42],
  [/Hand/, 0.3],
  [/Shoulder/, 0.35],
  [/Spine/, 0.35],
  [/neck|Head/i, 0.3],
  [/Hips/, 0.4],
];
const keepFor = (bone: string) => KEEP.find(([re]) => re.test(bone))?.[1] ?? 0.4;

/**
 * The walk clip, from this person's own jog and idle clips (as makePerson3d
 * made them, hips height already fitted to the body).
 */
export function makeWalkClip(THREE: any, jog: any, idle: any): any {
  const idleTrack = (name: string) => idle.tracks.find((t: any) => t.name === name);
  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const tracks = jog.tracks.map((t: any) => {
    const bone = t.name.split(".")[0];
    const it = idleTrack(t.name);
    const v = new Float32Array(t.values.length);
    if (t.name.endsWith(".quaternion")) {
      const k = keepFor(bone);
      if (it) q0.fromArray(it.values, 0); else q0.set(0, 0, 0, 1);
      for (let i = 0; i < t.values.length; i += 4) {
        q1.fromArray(t.values, i);
        // the short way round
        if (q0.dot(q1) < 0) q1.set(-q1.x, -q1.y, -q1.z, -q1.w);
        q2.slerpQuaternions(q0, q1, k).toArray(v, i);
      }
      return new THREE.QuaternionKeyframeTrack(t.name, t.times.slice(), v);
    }
    if (t.name.endsWith(".position")) {
      // the hips: the standing height, with a small bob from the jog
      const n = t.values.length / 3;
      const mean = [0, 0, 0], base = [0, 0, 0];
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) mean[c] += t.values[i * 3 + c] / n;
      if (it) {
        const m = it.values.length / 3;
        for (let i = 0; i < m; i++) for (let c = 0; c < 3; c++) base[c] += it.values[i * 3 + c] / m;
      } else for (let c = 0; c < 3; c++) base[c] = mean[c];
      for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) v[i * 3 + c] = base[c] + (t.values[i * 3 + c] - mean[c]) * (c === 1 ? 0.3 : 0.4);
      return new THREE.VectorKeyframeTrack(t.name, t.times.slice(), v);
    }
    return t.clone();
  });
  return new THREE.AnimationClip("walk", jog.duration, tracks);
}
