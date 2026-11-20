/**
 * THE HIP JOINTS (Harry, 20 Nov 2026: "why the legs like squeezing past each
 * other", then on the first fix "the feet still seem abnormally close
 * together", then "find walking animations and match them to our bodies").
 *
 * ROOT CAUSE, measured. Every clip (the motion-capture walk, jog, run, idle,
 * the sits) is solved on ONE skeleton whose hip joints are 19.7 cm apart: the
 * capture's own feet and knees are put where the actor's went from THOSE
 * hips. The Style A bodies were rigged one by one, and the fitting put some
 * heads' hip joints far too near the middle: Curls 11.4 cm apart, Buzz &
 * beard 9.7 cm (the legs' own skin is 20 cm apart at the knee). A clip only
 * turns bones, so on those bodies every leg hung from a hip 4 to 5 cm too far
 * in: standing, the ankles were 12 cm apart instead of 20; walking they were
 * 0.5 to 3.5 cm apart (the capture: 8 to 13) and jogging they crossed.
 *
 * FIX, on the rig, once, when a person is made (no cost per frame, every
 * clip, every scene): each hip joint is moved to stand over that leg's own
 * knee joint as the body was modelled, held within HIP_FIT_RANGE of the
 * clip skeleton's hip width (scaled by leg length), and the thigh is bound
 * again from there. The body's skin, size and proportions do not change
 * (RUL-3D-006): only the point the thigh turns about. The clips then land
 * the feet where the capture's actor put his (tests/star/gaitWidth.mts).
 * `?hipfit=0` on any 3D page: the joints as the files have them.
 */
import type * as THREE from "three";

type Three = typeof import("three");

/** The hip width a body may have against the clip skeleton's (scaled by leg length): within this, it is left or fitted to its own knees. */
export const HIP_FIT_RANGE: [number, number] = [0.97, 1.03];

export function hipFitOn(): boolean {
  try { return typeof window === "undefined" || new URLSearchParams(window.location.search).get("hipfit") !== "0"; } catch { return true; }
}

export interface HipFitReport { before: number; after: number; clip: number }

/**
 * Move a body's hip joints (see top). `root`: the person, in its file pose, unscaled.
 * `clipScene`: the clip file's own skeleton. Returns the hip width before and after and
 * the clip skeleton's (all metres at this body's leg length), or null when nothing was done.
 */
export function fitHipJoints(T: Three, root: THREE.Object3D, body: THREE.SkinnedMesh, clipScene: THREE.Object3D | null | undefined): HipFitReport | null {
  if (!hipFitOn() || !clipScene) return null;
  const bone = (n: string) => body.skeleton.bones.find((b) => b.name === n);
  const cb = (n: string) => clipScene.getObjectByName(n);
  const cT = cb("LeftUpLeg"), cK = cb("LeftLeg"), cF = cb("LeftFoot");
  const legs = (["Left", "Right"] as const).map((S) => ({ t: bone(`${S}UpLeg`), k: bone(`${S}Leg`), f: bone(`${S}Foot`) }));
  if (!cT || !cK || !cF || legs.some((l) => !l.t || !l.k || !l.f)) return null;
  // the clip skeleton: hip joint's distance out from the middle, per unit of leg length (its own units)
  const clipRatio = Math.abs(cT.position.x) / (cK.position.length() + cF.position.length());
  root.updateMatrixWorld(true);
  const P = (o: THREE.Object3D) => new T.Vector3().setFromMatrixPosition(o.matrixWorld);
  const hips = legs[0].t!.parent!;
  const mid = P(legs[0].t!).add(P(legs[1].t!)).multiplyScalar(0.5);
  const across = P(legs[0].t!).sub(P(legs[1].t!)); across.y = 0;
  const before = across.length();
  if (before < 1e-4) return null;
  across.normalize();
  const inverses = body.skeleton.boneInverses.slice();
  let after = 0, clipW = 0, moved = false;
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    const t = l.t!, k = l.k!, f = l.f!;
    const sg = i === 0 ? 1 : -1;
    const hip = P(t), knee = P(k), ank = P(f);
    const legLen = hip.distanceTo(knee) + knee.distanceTo(ank);
    const clipHalf = clipRatio * legLen;
    clipW += clipHalf;
    const kneeOut = knee.clone().sub(mid).dot(across) * sg;
    const want = Math.min(Math.max(kneeOut, clipHalf * HIP_FIT_RANGE[0]), clipHalf * HIP_FIT_RANGE[1]);
    const now = hip.clone().sub(mid).dot(across) * sg;
    after += want;
    if (Math.abs(want - now) < 0.002) { after += now - want; continue; }
    moved = true;
    const oldWorld = t.matrixWorld.clone();
    const kneeQ = k.getWorldQuaternion(new T.Quaternion());
    // the joint out along the body's own left-right line; the thigh turned to still point at the knee
    const newHip = hip.clone().add(across.clone().multiplyScalar((want - now) * sg));
    const delta = new T.Quaternion().setFromUnitVectors(knee.clone().sub(hip).normalize(), knee.clone().sub(newHip).normalize());
    const tq = delta.multiply(t.getWorldQuaternion(new T.Quaternion()));
    hips.updateMatrixWorld(true);
    t.position.copy(hips.worldToLocal(newHip.clone()));
    t.quaternion.copy(hips.getWorldQuaternion(new T.Quaternion()).invert().multiply(tq));
    t.updateMatrixWorld(true);
    // the knee joint stays where it was, the shin keeps its own turn
    k.position.copy(t.worldToLocal(knee.clone()));
    k.quaternion.copy(t.getWorldQuaternion(new T.Quaternion()).invert().multiply(kneeQ));
    k.updateMatrixWorld(true);
    // bound again: in this pose the skin is exactly where it was
    const idx = body.skeleton.bones.indexOf(t as THREE.Bone);
    inverses[idx] = new T.Matrix4().copy(t.matrixWorld).invert().multiply(oldWorld).multiply(body.skeleton.boneInverses[idx]);
  }
  if (!moved) return null;
  // this person's own list (the files' lists are shared between everyone made from one file)
  body.skeleton.boneInverses = inverses;
  root.updateMatrixWorld(true);
  return { before, after, clip: clipW };
}
