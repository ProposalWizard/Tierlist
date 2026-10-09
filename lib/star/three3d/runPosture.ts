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
          relaxWrist(h, rest.get(h)!, { keep: WRIST_KEEP });
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



/**
 * THE HAND-RELAX STEP, shared by the running arms (above) and the standing arms
 * (below): bring a wrist back towards its rest bend. `keep` keeps that share of
 * the bend (the run keeps WRIST_KEEP); `maxDeg` caps what is left.
 */
export function relaxWrist(h: THREE.Object3D, restQ: THREE.Quaternion, o: { keep?: number; maxDeg?: number }) {
  if (o.keep !== undefined) h.quaternion.slerp(restQ, 1 - o.keep);
  if (o.maxDeg !== undefined) {
    const wa = h.quaternion.angleTo(restQ), lim = (o.maxDeg * Math.PI) / 180;
    if (wa > lim) h.quaternion.slerp(restQ, 1 - lim / wa);
  }
  h.updateMatrixWorld(true);
}

/**
 * THE STANDING ARMS AND HANDS (Harry, 9 Oct 2026, on the Style A heads sheet:
 * "what is happening with those arms/hands?" — stiff straight arms, wrists bent
 * back, palms turned backwards, fingers fanned out like claws).
 *
 * Baked into a person's OWN copy of each standing idle (people3d.ts clones every
 * clip per person; footballAnims.ts addClips does the same), so shared clips stay
 * as they are. At every key of the clip, each arm:
 *   - the wrist goes back to within IDLE_WRIST_MAX of straight (relaxWrist);
 *   - the elbow is softly bent (IDLE_ELBOW_BEND, the hand moves forward);
 *   - the hand hangs IDLE_HAND_OUT from the middle of the hips (arms off the hips);
 *   - the forearm turns so the palm faces the thigh.
 * And the fingers rest loosely curled (RELAXED_FINGERS_DEG, people3d.ts poses
 * them; the Style A bodies' fingers are weighted by build_toon_bodies.py).
 * Measured in tests/star/runPosture.mts on the real bodies.
 */
export const IDLE_POSTURE_CLIPS = new Set(["idle", "boss-idle", "Idle_Loop"]);
/** Degrees. */
export const IDLE_WRIST_MAX = 8;
export const IDLE_ELBOW_BEND = 13;
/** Metres from the middle of the hips, sideways, that each hand hangs at least. */
export const IDLE_HAND_OUT = 0.21;

/**
 * Relaxed fingers, degrees per joint (root first), on top of the sculpt's own
 * soft bend (the generated hands are modelled a little curled, ~10–15° a joint),
 * so the index ends ~30° a joint as asked; the others progressively more; the
 * thumb along the index.
 */
export const RELAXED_FINGERS_DEG = {
  thumb: [5, 9, 7] as [number, number, number],
  index: [18, 20, 14] as [number, number, number],
  middle: [21, 22, 16] as [number, number, number],
  ring: [23, 25, 18] as [number, number, number],
  little: [26, 27, 20] as [number, number, number],
  thumbSwing: 14,
};

export interface ArmMeasure { elbow: number; wrist: number; out: number; palmIn: number }

/**
 * Bake the idle arms into `clip` (its quaternion tracks for the arm bones are
 * replaced). `root` is the person's skeleton (posed and put back to rest here);
 * `palm` each hand's palm direction in the hand bone's own frame (people3d hand.L/R.palm).
 * Returns the worst values before and after, for the tests.
 */
export function relaxIdleArms(
  T: Three, root: THREE.Object3D, bones: Record<string, THREE.Bone>, clip: THREE.AnimationClip,
  palm: { L: THREE.Vector3; R: THREE.Vector3 },
): { before: ArmMeasure; after: ArmMeasure } | null {
  const need = ["Hips", "LeftArm", "RightArm", "LeftForeArm", "RightForeArm", "LeftHand", "RightHand"];
  if (need.some((n) => !bones[n])) return null;
  const key = clip.tracks.find((t) => t.name === "LeftArm.quaternion") ?? clip.tracks.find((t) => t.name.endsWith(".quaternion"));
  if (!key) return null;
  const saved = Object.values(bones).map((b) => [b, b.position.clone(), b.quaternion.clone()] as const);
  const rest = new Map(saved.map(([b, , q]) => [b, q.clone()] as const));
  const mixer = new T.AnimationMixer(root);
  const act = mixer.clipAction(clip);
  act.play();
  const v = () => new T.Vector3();
  // Read world positions and turns straight off matrixWorld. Every change below keeps it current
  // (the clip's pose → root.updateMatrixWorld, a turn → o.updateMatrixWorld, relaxWrist does its own),
  // so this is the same numbers as getWorldPosition/getWorldQuaternion, without those re-walking the
  // whole chain to the root on every call: half the cost of each new head's first idle (lag pass 4).
  root.updateWorldMatrix(true, false);
  const P = (o: THREE.Object3D) => v().setFromMatrixPosition(o.matrixWorld);
  const dp = new T.Vector3(), ds = new T.Vector3();
  const WQ = (o: THREE.Object3D, q = new T.Quaternion()) => { o.matrixWorld.decompose(dp, q, ds); return q; };
  const d2r = Math.PI / 180;
  const turnWorld = (o: THREE.Object3D, axis: THREE.Vector3, ang: number) => {
    const wq = WQ(o);
    const r = new T.Quaternion().setFromAxisAngle(axis, ang);
    const pw = WQ(o.parent!);
    o.quaternion.copy(pw.invert().multiply(r.multiply(wq)));
    o.updateMatrixWorld(true);
  };
  const turnFor = (o: THREE.Object3D, axis: THREE.Vector3, ang: number, score: () => number) => {
    if (Math.abs(ang) < 1e-5) return;
    const s0 = score();
    turnWorld(o, axis, ang);
    if (score() < s0) turnWorld(o, axis, -2 * ang);
  };
  const elbowOf = (a: THREE.Object3D, f: THREE.Object3D, h: THREE.Object3D) => { const e = P(f); return P(a).sub(e).angleTo(P(h).sub(e)); };
  const sides = [
    { a: bones.LeftArm, f: bones.LeftForeArm, h: bones.LeftHand, sg: 1, palm: palm.L },
    { a: bones.RightArm, f: bones.RightForeArm, h: bones.RightHand, sg: -1, palm: palm.R },
  ];
  const fresh = (): ArmMeasure => ({ elbow: 180, wrist: 0, out: 9, palmIn: 1 });
  const before = fresh(), after = fresh();
  const measure = (m: ArmMeasure, across: THREE.Vector3) => {
    const hp = P(bones.Hips);
    for (const s of sides) {
      m.elbow = Math.min(m.elbow, elbowOf(s.a, s.f, s.h) / d2r);
      m.wrist = Math.max(m.wrist, s.h.quaternion.angleTo(rest.get(s.h as THREE.Bone)!) / d2r);
      m.out = Math.min(m.out, P(s.h).sub(hp).dot(across) * s.sg);
      const pw = s.palm.clone().applyQuaternion(WQ(s.h));
      m.palmIn = Math.min(m.palmIn, pw.dot(across.clone().multiplyScalar(-s.sg)));
    }
  };
  const WRITE = sides.flatMap((s) => [s.a, s.f, s.h]);
  const times = Array.from(key.times);
  const vals = WRITE.map(() => [] as number[]);
  const up = new T.Vector3(0, 1, 0);
  for (const t of times) {
    for (const o of WRITE) o.quaternion.copy(rest.get(o as THREE.Bone)!);
    mixer.setTime(t);
    root.updateMatrixWorld(true);
    // his left → right is +x → -x in his own frame; "across" points to HIS left
    const across = P(bones.LeftArm).sub(P(bones.RightArm)); across.y = 0; across.normalize();
    const fwd = across.clone().cross(up).normalize(); // his front (+z at rest)
    measure(before, across);
    const hp = () => P(bones.Hips);
    for (const s of sides) {
      // 1. the wrist nearly straight
      relaxWrist(s.h, rest.get(s.h as THREE.Bone)!, { maxDeg: IDLE_WRIST_MAX });
      const armLen = Math.max(0.2, P(s.a).distanceTo(P(s.h)));
      // 2. the hand away from the hips
      const outOf = () => P(s.h).sub(hp()).dot(across) * s.sg;
      for (let it = 0; it < 3; it++) {
        const inn = IDLE_HAND_OUT - outOf();
        if (inn > 0.002) turnFor(s.a, fwd, Math.min(0.4, inn / armLen), outOf);
      }
      // 3. the elbow softly bent, the hand forward
      const want = (180 - IDLE_ELBOW_BEND) * d2r;
      const el = elbowOf(s.a, s.f, s.h);
      if (el > want) {
        const fwdOf = () => P(s.h).sub(hp()).dot(fwd);
        turnFor(s.f, across, el - want, fwdOf);
      } else if (el < want - 3 * d2r) {
        // bent more than a relaxed arm (the capture's idle folds it ~27°): open it to the same bend
        const e = P(s.f), n = P(s.a).sub(e).cross(P(s.h).sub(e)).normalize();
        turnFor(s.f, n, want - el, () => -Math.abs(elbowOf(s.a, s.f, s.h) - want));
      }
      // 4. the palm towards the thigh: turn the forearm about its own line
      const axis = P(s.h).sub(P(s.f)).normalize();
      const inward = across.clone().multiplyScalar(-s.sg);
      const palmW = () => s.palm.clone().applyQuaternion(WQ(s.h));
      const proj = (x: THREE.Vector3) => x.clone().sub(axis.clone().multiplyScalar(x.dot(axis))).normalize();
      const a0 = proj(palmW()), b0 = proj(inward);
      const ang = Math.acos(Math.max(-1, Math.min(1, a0.dot(b0)))) * 0.85;
      if (ang > 0.02) turnFor(s.f, axis, ang, () => palmW().dot(inward));
    }
    root.updateMatrixWorld(true);
    measure(after, across);
    WRITE.forEach((o, i) => vals[i].push(o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w));
  }
  act.stop();
  mixer.uncacheRoot(root);
  WRITE.forEach((o, i) => {
    const name = `${o.name}.quaternion`;
    const tr = new T.QuaternionKeyframeTrack(name, times, vals[i]);
    const k = clip.tracks.findIndex((x) => x.name === name);
    if (k >= 0) clip.tracks[k] = tr; else clip.tracks.push(tr);
  });
  for (const [b, p, q] of saved) { b.position.copy(p); b.quaternion.copy(q); }
  root.updateMatrixWorld(true);
  return { before, after };
}

/**
 * STYLE A SPRINT LEAN ("Style A sprint looks crouched", 9 Oct 2026). On the
 * capture's own skeleton the sprint leans 14° (the run 12°), but on the Style
 * A body's shorter torso the same spine turns read as a 20° hunch. Each
 * moving loop is brought back to at most TOON_LEAN_MAX of forward lean
 * (hips → neck, averaged over the loop) by turning the lowest spine bone back
 * about his own left-right line; the legs, arms and the loop's rhythm are
 * untouched. Returns the lean before and after (degrees), for the tests.
 */
export const TOON_LEAN_MAX: Record<string, number> = { sprint: 14, run: 12, jog: 12 };
export function levelToonLean(
  T: Three, root: THREE.Object3D, bones: Record<string, THREE.Bone>, clip: THREE.AnimationClip, maxDeg: number,
): { before: number; after: number } | null {
  const spineName = ["Spine02", "spine_01"].find((n) => bones[n]);
  const neck = bones.neck ?? bones.neck_01;
  const hips = bones.Hips ?? bones.pelvis;
  if (!spineName || !neck || !hips) return null;
  const spine = bones[spineName];
  const name = `${spineName}.quaternion`;
  const track = clip.tracks.find((t) => t.name === name);
  if (!track) return null;
  const saved = Object.values(bones).map((b) => [b, b.position.clone(), b.quaternion.clone()] as const);
  const mixer = new T.AnimationMixer(root);
  const act = mixer.clipAction(clip);
  act.play();
  const times = Array.from(track.times);
  const H = new T.Vector3(), N = new T.Vector3();
  const leanAt = (t: number) => {
    mixer.setTime(t);
    root.updateMatrixWorld(true);
    hips.getWorldPosition(H); neck.getWorldPosition(N);
    const d = N.sub(H);
    return Math.atan2(d.z, d.y) * 180 / Math.PI;
  };
  const mean = () => times.reduce((s, t) => s + leanAt(t), 0) / Math.max(1, times.length);
  const before = mean();
  const excess = before - maxDeg;
  if (excess <= 0.5) { act.stop(); mixer.uncacheRoot(root); for (const [b, p, q] of saved) { b.position.copy(p); b.quaternion.copy(q); } root.updateMatrixWorld(true); return { before, after: before }; }
  const v = Float32Array.from(track.values as ArrayLike<number>);
  const right = new T.Vector3(1, 0, 0);
  const pq = new T.Quaternion(), r = new T.Quaternion(), q = new T.Quaternion();
  times.forEach((t, i) => {
    mixer.setTime(t);
    root.updateMatrixWorld(true);
    // his left-right line, in the spine's parent frame: turn back by the excess
    spine.parent!.getWorldQuaternion(pq);
    const axis = right.clone().applyQuaternion(pq.invert()).normalize();
    r.setFromAxisAngle(axis, (-excess * Math.PI) / 180);
    q.set(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]);
    q.premultiply(r);
    v[i * 4] = q.x; v[i * 4 + 1] = q.y; v[i * 4 + 2] = q.z; v[i * 4 + 3] = q.w;
  });
  track.values = v as never;
  act.stop();
  mixer.uncacheRoot(root);
  const m2 = new T.AnimationMixer(root);
  const a2 = m2.clipAction(clip); a2.play();
  let after = 0;
  for (const t of times) { m2.setTime(t); root.updateMatrixWorld(true); hips.getWorldPosition(H); neck.getWorldPosition(N); const d = N.sub(H); after += Math.atan2(d.z, d.y) * 180 / Math.PI / times.length; }
  a2.stop(); m2.uncacheRoot(root);
  for (const [b, p, qq] of saved) { b.position.copy(p); b.quaternion.copy(qq); }
  root.updateMatrixWorld(true);
  return { before, after };
}
