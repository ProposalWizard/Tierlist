/**
 * THE RUNNING NECK (Harry, 9 Oct 2026, on the 3D shop: "neck hella weird when
 * running"). On the capture's run and sprint the neck pitches forward off the
 * chest (15–16°), the head drops another 13–23° on top, and the shoulders ride
 * up past the base of the neck (the neck ends 1.6–4.6 cm BELOW the shoulder
 * line; standing it is 1.5 cm above). On our body that reads as no neck.
 *
 * Fix, baked into the loop clips once when the file loads (so the shop, the
 * garden and the 3D drills all get it): at every key the pose is sampled on
 * the file's own skeleton and
 *   - the neck is brought back to at most NECK_LEAN_MAX
 *     forward of the chest (the lean stays in the hips and chest), the head
 *     keeping where it looks (and never more than HEAD_LEAN_MAX down);
 *   - each shoulder is turned down until the neck stands at least
 *     SHOULDER_DROP_TO above the shoulder joints (as standing).
 * Only a forward excess and a raised shoulder are taken out; anything already
 * upright is left as it is. Pure apart from the clip values it rewrites.
 */
import type * as THREE from "three";

type Three = typeof import("three");

/** Forward lean, degrees, the neck and the head may have beyond the chest's own. */
export const NECK_LEAN_MAX = 5;
/** The neck's base this far above the shoulder joints, metres (standing: 0.015). */
export const SHOULDER_DROP_TO = 0.012;
/** The head itself (base → top) leans no more than this forward of upright, degrees (standing still it is about 13°). */
export const HEAD_LEAN_MAX = 16;

/** Bone names on each skeleton: chest, neck, head, the two clavicles, the two upper arms. */
export interface PostureBones { hips: string; chest: string; neck: string; head: string; clavL: string; clavR: string; armL: string; armR: string }
export const PEOPLE_POSTURE: PostureBones = { hips: "Hips", chest: "Spine02", neck: "neck", head: "Head", clavL: "LeftShoulder", clavR: "RightShoulder", armL: "LeftArm", armR: "RightArm" };
export const UAL_POSTURE: PostureBones = { hips: "pelvis", chest: "spine_03", neck: "neck_01", head: "Head", clavL: "clavicle_l", clavR: "clavicle_r", armL: "upperarm_l", armR: "upperarm_r" };

/** The loops it is applied to (the capture's moving loops, both skeletons). */
export const RUN_POSTURE_CLIPS = new Set(["walk", "jog", "run", "sprint", "dribble_run", "Jog_Fwd_Loop", "Walk_Loop"]);

const done = new WeakSet<object>();

export interface PostureReport { clip: string; neckBefore: number; neckAfter: number; headBefore: number; headAfter: number; gapBefore: number; gapAfter: number }

/**
 * Rewrite the moving loops' neck, head and clavicle tracks (see top). `g`: a
 * loaded clip file whose scene holds the skeleton. Returns what it measured
 * (average forward lean of neck and head beyond the chest, degrees; neck base
 * above the shoulder line, metres) before and after.
 */
export function uprightRunPosture(T: Three, g: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }, bones: PostureBones): PostureReport[] {
  const scene = g.scene;
  const get = (n: string) => scene.getObjectByName(n) as THREE.Object3D | undefined;
  const B = { hips: get(bones.hips), chest: get(bones.chest), neck: get(bones.neck), head: get(bones.head), clavL: get(bones.clavL), clavR: get(bones.clavR), armL: get(bones.armL), armR: get(bones.armR) };
  if (Object.values(B).some((b) => !b)) return [];
  const out: PostureReport[] = [];
  const allRest: [THREE.Object3D, THREE.Vector3, THREE.Quaternion, THREE.Vector3][] = [];
  scene.traverse((o) => allRest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  const mixer = new T.AnimationMixer(scene);
  const v = () => new T.Vector3();
  const P = (o: THREE.Object3D) => o.getWorldPosition(v());
  const up = new T.Vector3(0, 1, 0);
  /** Forward and across (left → right shoulder) for this pose. */
  const frame = () => {
    const across = P(B.armR!).sub(P(B.armL!)); across.y = 0; across.normalize();
    const fwd = up.clone().cross(across).normalize();
    return { across, fwd };
  };
  /** Forward lean of a → b against vertical, radians. */
  const lean = (a: THREE.Object3D, b: THREE.Vector3, fwd: THREE.Vector3) => { const d = b.clone().sub(P(a)); return Math.atan2(d.dot(fwd), d.y); };
  /** Turn a bone in the world by `ang` about `axis`, written back to its local rotation. */
  const turnWorld = (o: THREE.Object3D, axis: THREE.Vector3, ang: number) => {
    const wq = o.getWorldQuaternion(new T.Quaternion());
    const r = new T.Quaternion().setFromAxisAngle(axis, ang);
    const pw = o.parent!.getWorldQuaternion(new T.Quaternion());
    o.quaternion.copy(pw.invert().multiply(r.multiply(wq)));
    o.updateMatrixWorld(true);
  };
  const gap = () => P(B.neck!).y - (P(B.armL!).y + P(B.armR!).y) / 2;
  const lim = (NECK_LEAN_MAX * Math.PI) / 180;
  const rest = new Map([B.neck!, B.head!, B.clavL!, B.clavR!].map((o) => [o, o.quaternion.clone()] as const));

  for (const clip of g.animations) {
    if (!RUN_POSTURE_CLIPS.has(clip.name) || done.has(clip)) continue;
    const track = (b: THREE.Object3D) => clip.tracks.find((t) => t.name === `${b.name}.quaternion`);
    const nt = track(B.neck!);
    if (!nt) continue;
    done.add(clip);
    const times = Array.from(nt.times);
    const vals: Record<string, number[]> = { neck: [], head: [], clavL: [], clavR: [] };
    const rep = { clip: clip.name, neckBefore: 0, neckAfter: 0, headBefore: 0, headAfter: 0, gapBefore: 0, gapAfter: 0 };
    mixer.stopAllAction();
    const act = mixer.clipAction(clip);
    act.reset().play();
    for (const t of times) {
      // a bone the clip has no track for starts every key from its rest (not from the last key's fix)
      for (const o of [B.neck!, B.head!, B.clavL!, B.clavR!]) { const r = rest.get(o); if (r) o.quaternion.copy(r); }
      mixer.setTime(t);
      scene.updateMatrixWorld(true);
      const { across, fwd } = frame();
      const chestLean = lean(B.hips!, P(B.chest!), fwd);
      rep.gapBefore += gap() / times.length;
      // the neck: chest → head base
      const nl = lean(B.neck!, P(B.head!), fwd) - chestLean;
      rep.neckBefore += nl / times.length;
      // turning about `across` by +a tips the bone's far end forward (checked below by measuring)
      const fixNeck = (o: THREE.Object3D, from: THREE.Object3D, to: () => THREE.Vector3, before: number) => {
        if (before <= lim) return;
        const excess = before - lim;
        turnWorld(o, across, -excess);
        const after = lean(from, to(), fwd) - chestLean;
        if (after > before) { turnWorld(o, across, 2 * excess); }
      };
      // the head keeps where it was looking while the neck straightens under it (else he'd look at the sky)
      const headWorld = B.head!.getWorldQuaternion(new T.Quaternion());
      fixNeck(B.neck!, B.neck!, () => P(B.head!), nl);
      const pw = B.head!.parent!.getWorldQuaternion(new T.Quaternion());
      B.head!.quaternion.copy(pw.invert().multiply(headWorld));
      B.head!.updateMatrixWorld(true);
      // the head: its own lean (head base → top of the head) in the world, no more than standing's + a little
      const tip = B.head!.children.find((c) => /_end$|end$/i.test(c.name)) as THREE.Object3D | undefined;
      if (tip) {
        const hl = lean(B.head!, P(tip), fwd);
        rep.headBefore += hl / times.length;
        const hmax = (HEAD_LEAN_MAX * Math.PI) / 180;
        if (hl > hmax) {
          turnWorld(B.head!, across, -(hl - hmax));
          if (lean(B.head!, P(tip), fwd) > hl) turnWorld(B.head!, across, 2 * (hl - hmax));
        }
      }
      // the shoulders: down until the neck stands clear of them

      for (const [cl, side] of [[B.clavL!, -1], [B.clavR!, 1]] as const) {
        const arm = side < 0 ? B.armL! : B.armR!;
        const lift = (P(B.neck!).y - SHOULDER_DROP_TO) - P(arm).y;
        if (lift >= 0) continue;
        const len = Math.max(0.05, P(cl).distanceTo(P(arm)));
        const a = Math.min(0.35, -lift / len);
        const y0 = P(arm).y;
        turnWorld(cl, fwd, a);
        if (P(arm).y > y0) turnWorld(cl, fwd, -2 * a);
      }
      rep.gapAfter += gap() / times.length;
      rep.neckAfter += (lean(B.neck!, P(B.head!), fwd) - chestLean) / times.length;
      rep.headAfter += (tip ? lean(B.head!, P(tip), fwd) : 0) / times.length;
      for (const [k, o] of [["neck", B.neck!], ["head", B.head!], ["clavL", B.clavL!], ["clavR", B.clavR!]] as const) vals[k].push(o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w);
    }
    act.stop();
    // write the tracks back on the neck's key times
    for (const [k, o] of [["neck", B.neck!], ["head", B.head!], ["clavL", B.clavL!], ["clavR", B.clavR!]] as const) {
      const name = `${o.name}.quaternion`;
      const i = clip.tracks.findIndex((t) => t.name === name);
      const nt2 = new T.QuaternionKeyframeTrack(name, times, vals[k]);
      if (i >= 0) clip.tracks[i] = nt2; else clip.tracks.push(nt2);
    }
    const r2d = (x: number) => (x * 180) / Math.PI;
    out.push({ ...rep, neckBefore: r2d(rep.neckBefore), neckAfter: r2d(rep.neckAfter), headBefore: r2d(rep.headBefore), headAfter: r2d(rep.headAfter) });
  }
  mixer.uncacheRoot(scene);
  // the file's skeleton back as it was
  for (const [o, p, q, s] of allRest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
  scene.updateMatrixWorld(true);
  return out;
}
