/**
 * WHERE EACH LOOP'S LEFT FOOT IS (for the shared stride clock, animBlend.ts).
 *
 * The capture's own "foot planted" marks are not safe to line loops up on:
 * the sprint lists a left plant at 0 s that is really the right foot, so a
 * run → sprint change started on the wrong foot (half a stride out) and the
 * legs scissored. Measured instead, off the motion itself: the moment the
 * left foot is furthest ahead of the right (just before it lands). Same rule
 * on every loop and every skeleton, so the loops line up foot for foot.
 * (Measured as the peak of the stride's first harmonic of "left foot ahead
 * of the right": the single furthest-forward sample picked the sprint's mark
 * a quarter-stride out, and a run → sprint mix slid 22 cm per metre.)
 *
 * It plays the clip on a tiny copy of the leg (hips' parents → hips → left
 * leg), so the real body is never touched. Cached per clip.
 */
import type * as THREE from "three";

type Three = typeof import("three");

export const HIPS_NAMES: string[] = ["Hips", "pelvis", "mixamorigHips", "Pelvis"];
export const LFOOT_NAMES = ["LeftFoot", "foot_l", "mixamorigLeftFoot", "Foot_L"];
export const RFOOT_NAMES = ["RightFoot", "foot_r", "mixamorigRightFoot", "Foot_R"];

const marks = new WeakMap<object, number>();

/** Left-foot-forward moment (s) of a loop, measured on the bones under `root`. Null: no leg found. */
export function footMark(T: Three, clip: THREE.AnimationClip, root: THREE.Object3D, samples = 48): number | null {
  const hit = marks.get(clip);
  if (hit !== undefined) return hit;
  let foot: THREE.Object3D | undefined, rfoot: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!foot && LFOOT_NAMES.includes(o.name)) foot = o;
    if (!rfoot && RFOOT_NAMES.includes(o.name)) rfoot = o;
  });
  if (!foot || !rfoot) return null;
  // both legs, from root down to each foot, copied as plain nodes in rest
  const chain: THREE.Object3D[] = [];
  for (const f of [foot, rfoot]) for (let o: THREE.Object3D | null = f; o && o !== root; o = o.parent) if (!chain.includes(o)) chain.push(o);
  const mini = new T.Object3D();
  const copies = new Map<THREE.Object3D, THREE.Object3D>();
  const copyOf = (o: THREE.Object3D): THREE.Object3D => {
    const have = copies.get(o);
    if (have) return have;
    const c = new T.Object3D();
    c.name = o.name;
    c.position.copy(o.position); c.quaternion.copy(o.quaternion); c.scale.copy(o.scale);
    (o.parent && o.parent !== root ? copyOf(o.parent) : mini).add(c);
    copies.set(o, c);
    return c;
  };
  chain.forEach(copyOf);
  const names = new Set(chain.map((o) => o.name));
  const tracks = clip.tracks.filter((t) => names.has(t.name.slice(0, t.name.lastIndexOf("."))));
  const mc = new T.AnimationClip(clip.name, clip.duration, tracks);
  const mixer = new T.AnimationMixer(mini);
  const a = mixer.clipAction(mc);
  a.play();
  const H = copies.get(rfoot), F = copies.get(foot);
  if (!H || !F) return null;
  const ph = new T.Vector3(), pf = new T.Vector3();
  // the stride's own rhythm: the first harmonic of (left foot ahead of right)
  // over one loop. Its peak is the left-foot-forward moment, and unlike a
  // single highest sample it does not jump on a noisy capture.
  let c = 0, s = 0;
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * clip.duration;
    a.time = t;
    mixer.update(0);
    mini.updateMatrixWorld(true);
    H.getWorldPosition(ph); F.getWorldPosition(pf);
    const d = pf.z - ph.z, ang = (2 * Math.PI * i) / samples;
    c += d * Math.cos(ang); s += d * Math.sin(ang);
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(mini);
  const at = ((((Math.atan2(s, c) / (2 * Math.PI)) % 1) + 1) % 1) * clip.duration;
  marks.set(clip, at);
  return at;
}
