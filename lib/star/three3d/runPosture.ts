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

/** Bone names on each skeleton: chest, neck, head, the two clavicles, upper arms, forearms and hands. */
export interface PostureBones {
  hips: string; chest: string; neck: string; head: string; clavL: string; clavR: string; armL: string; armR: string;
  foreL: string; foreR: string; handL: string; handR: string;
}
export const PEOPLE_POSTURE: PostureBones = {
  hips: "Hips", chest: "Spine02", neck: "neck", head: "Head", clavL: "LeftShoulder", clavR: "RightShoulder", armL: "LeftArm", armR: "RightArm",
  foreL: "LeftForeArm", foreR: "RightForeArm", handL: "LeftHand", handR: "RightHand",
};
export const UAL_POSTURE: PostureBones = {
  hips: "pelvis", chest: "spine_03", neck: "neck_01", head: "Head", clavL: "clavicle_l", clavR: "clavicle_r", armL: "upperarm_l", armR: "upperarm_r",
  foreL: "lowerarm_l", foreR: "lowerarm_r", handL: "hand_l", handR: "hand_r",
};

/**
 * THE RUNNING ARMS (Harry, 9 Oct 2026, on the sprint still: "what's this hand
 * being back sprinting?"). The capture's back hand folds onto the lower back,
 * behind the spine and across it; the front hand pokes forward flat. Each
 * arm, on the run loops, at every key:
 *   - the wrist goes most of the way back to straight (WRIST_KEEP of its bend kept);
 *   - a forward arm swings up until the hand is near FRONT_HAND_HIGH above
 *     the pelvis (chest to chin), less on the run and jog;
 *   - the elbow is held between ELBOW_MIN and ELBOW_MAX degrees;
 *   - the back hand never goes more than HAND_BEHIND_MAX behind the pelvis,
 *     and always stays HAND_OUT_MIN out from the middle (beside the hip,
 *     never behind the back or across the spine).
 * The sprint gets all of it; the run and the jog a smaller swing (ARM_SWING).
 */
export const ARM_SWING: Record<string, number> = { sprint: 1, run: 0.6, jog: 0.35, Jog_Fwd_Loop: 0.35 };
export const WRIST_KEEP = 0.15;
/** The front hand at full swing this high above the pelvis, metres (about chest to chin); the run and jog less. */
export const FRONT_HAND_HIGH = 0.4;
export const ELBOW_MIN = 80;
export const ELBOW_MAX = 100;
export const HAND_BEHIND_MAX = 0.05;
export const HAND_OUT_MIN = 0.17;

/** The loops it is applied to (the capture's moving loops, both skeletons). */
export const RUN_POSTURE_CLIPS = new Set(["walk", "jog", "run", "sprint", "dribble_run", "Jog_Fwd_Loop", "Walk_Loop"]);

const done = new WeakSet<object>();

export interface PostureReport {
  clip: string; neckBefore: number; neckAfter: number; headBefore: number; headAfter: number; gapBefore: number; gapAfter: number;
  /** Arms (run loops only): furthest a hand goes behind the pelvis (m), the least it is out from the middle (m), the highest hand above the pelvis (m), the most the wrist bends (deg), the elbow's range (deg). */
  arms?: { before: ArmStats; after: ArmStats };
}
export interface ArmStats { behind: number; out: number; high: number; wrist: number; elbowMin: number; elbowMax: number }

/**
 * Rewrite the moving loops' neck, head and clavicle tracks (see top). `g`: a
 * loaded clip file whose scene holds the skeleton. Returns what it measured
 * (average forward lean of neck and head beyond the chest, degrees; neck base
 * above the shoulder line, metres) before and after.
 */
export function uprightRunPosture(T: Three, g: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }, bones: PostureBones): PostureReport[] {
  const scene = g.scene;
  const get = (n: string) => scene.getObjectByName(n) as THREE.Object3D | undefined;
  const B = {
    hips: get(bones.hips), chest: get(bones.chest), neck: get(bones.neck), head: get(bones.head), clavL: get(bones.clavL), clavR: get(bones.clavR), armL: get(bones.armL), armR: get(bones.armR),
    foreL: get(bones.foreL), foreR: get(bones.foreR), handL: get(bones.handL), handR: get(bones.handR),
  };
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
  const WRITE = [["neck", B.neck!], ["head", B.head!], ["clavL", B.clavL!], ["clavR", B.clavR!], ["armL", B.armL!], ["armR", B.armR!], ["foreL", B.foreL!], ["foreR", B.foreR!], ["handL", B.handL!], ["handR", B.handR!]] as const;
  const rest = new Map(WRITE.map(([, o]) => [o, o.quaternion.clone()] as const));
  const d2r = Math.PI / 180;
  /** Turn `o` about `axis` by ±ang, whichever way makes `score` bigger. */
  const turnFor = (o: THREE.Object3D, axis: THREE.Vector3, ang: number, score: () => number) => {
    if (Math.abs(ang) < 1e-5) return;
    const s0 = score();
    turnWorld(o, axis, ang);
    if (score() < s0) turnWorld(o, axis, -2 * ang);
  };
  const elbowOf = (a: THREE.Object3D, f: THREE.Object3D, h: THREE.Object3D) => { const e = P(f); return P(a).sub(e).angleTo(P(h).sub(e)); };
  /** Wrist bend: the hand's turn against its forearm, compared with the rest pose's, degrees. */
  const wristOf = (h: THREE.Object3D) => h.quaternion.angleTo(rest.get(h)!) / d2r;
  const armStats = (fwd: THREE.Vector3, across: THREE.Vector3, st: ArmStats) => {
    const hp = P(B.hips!);
    for (const [a, f, h, sg] of [[B.armL!, B.foreL!, B.handL!, -1], [B.armR!, B.foreR!, B.handR!, 1]] as const) {
      const rel = P(h).sub(hp);
      st.behind = Math.max(st.behind, -rel.dot(fwd));
      st.out = Math.min(st.out, rel.dot(across) * sg);
      st.high = Math.max(st.high, rel.y);
      st.wrist = Math.max(st.wrist, wristOf(h));
      const el = elbowOf(a, f, h) / d2r;
      st.elbowMin = Math.min(st.elbowMin, el); st.elbowMax = Math.max(st.elbowMax, el);
    }
  };
  const freshStats = (): ArmStats => ({ behind: -9, out: 9, high: -9, wrist: 0, elbowMin: 999, elbowMax: 0 });

  for (const clip of g.animations) {
    if (!RUN_POSTURE_CLIPS.has(clip.name) || done.has(clip)) continue;
    const track = (b: THREE.Object3D) => clip.tracks.find((t) => t.name === `${b.name}.quaternion`);
    const nt = track(B.neck!);
    if (!nt) continue;
    done.add(clip);
    const times = Array.from(nt.times);
    const vals: Record<string, number[]> = Object.fromEntries(WRITE.map(([k]) => [k, [] as number[]]));
    const swing = ARM_SWING[clip.name] ?? 0;
    const before = freshStats(), after = freshStats();
    const rep = { clip: clip.name, neckBefore: 0, neckAfter: 0, headBefore: 0, headAfter: 0, gapBefore: 0, gapAfter: 0 };
    mixer.stopAllAction();
    const act = mixer.clipAction(clip);
    act.reset().play();
    for (const t of times) {
      // a bone the clip has no track for starts every key from its rest (not from the last key's fix)
      for (const [, o] of WRITE) { const r = rest.get(o); if (r) o.quaternion.copy(r); }
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
      // the arms (run loops)
      if (swing > 0) {
        armStats(fwd, across, before);
        const hp = () => P(B.hips!);
        for (const [a, f, h, sg] of [[B.armL!, B.foreL!, B.handL!, -1], [B.armR!, B.foreR!, B.handR!, 1]] as const) {
          // the wrist nearly straight
          h.quaternion.slerp(rest.get(h)!, 1 - WRIST_KEEP);
          h.updateMatrixWorld(true);
          const fwdOf = () => P(h).sub(hp()).dot(fwd);
          const outOf = () => P(h).sub(hp()).dot(across) * sg;
          const armLen = Math.max(0.2, P(a).distanceTo(P(h)));
          // the elbow held bent
          const el = elbowOf(a, f, h), want = Math.max(ELBOW_MIN * d2r, Math.min(ELBOW_MAX * d2r, el));
          if (Math.abs(el - want) > 1e-3) {
            const e = P(f), n = P(a).sub(e).cross(P(h).sub(e)).normalize();
            turnFor(f, n, el - want, () => -Math.abs(elbowOf(a, f, h) - want));
          }
          // a few small passes: the front hand up towards the chest, the back hand beside the hip
          const fo0 = fwdOf();
          const wantHigh = FRONT_HAND_HIGH * (0.6 + 0.4 * swing) * Math.min(1, Math.max(0, fo0) / 0.2);
          for (let it = 0; it < 4; it++) {
            const hy = P(h).y - hp().y;
            if (fo0 > 0 && hy < wantHigh) turnFor(a, across, Math.min(0.5, (wantHigh - hy) / armLen), () => P(h).y);
            const be = -fwdOf() - HAND_BEHIND_MAX;
            if (be > 0) turnFor(a, across, Math.min(0.6, be / armLen), fwdOf);
            const inn = HAND_OUT_MIN - outOf();
            if (inn > 0) turnFor(a, fwd, Math.min(0.5, inn / armLen), outOf);
          }
        }
        armStats(fwd, across, after);
      }
      rep.neckAfter += (lean(B.neck!, P(B.head!), fwd) - chestLean) / times.length;
      rep.headAfter += (tip ? lean(B.head!, P(tip), fwd) : 0) / times.length;
      for (const [k, o] of WRITE) vals[k].push(o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w);
    }
    act.stop();
    // write the tracks back on the neck's key times
    for (const [k, o] of WRITE) {
      if (swing <= 0 && /^(arm|fore|hand)/.test(k)) continue;
      const name = `${o.name}.quaternion`;
      const i = clip.tracks.findIndex((t) => t.name === name);
      const nt2 = new T.QuaternionKeyframeTrack(name, times, vals[k]);
      if (i >= 0) clip.tracks[i] = nt2; else clip.tracks.push(nt2);
    }
    const r2d = (x: number) => (x * 180) / Math.PI;
    out.push({ ...rep, ...(swing > 0 ? { arms: { before, after } } : {}), neckBefore: r2d(rep.neckBefore), neckAfter: r2d(rep.neckAfter), headBefore: r2d(rep.headBefore), headAfter: r2d(rep.headAfter) });
  }
  mixer.uncacheRoot(scene);
  // the file's skeleton back as it was
  for (const [o, p, q, s] of allRest) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
  scene.updateMatrixWorld(true);
  return out;
}
