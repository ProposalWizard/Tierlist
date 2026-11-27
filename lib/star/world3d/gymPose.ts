/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE GYM'S POSES (lib/star/world3d/gymPlace.ts): what your body does on the bench, at the heavy
 * bag and when the treadmill throws you off. The capture library has no lifting or punching clip,
 * so these are POSE BLENDS on top of a clip that is playing (idle, the boxer's bounce): a two-bone
 * reach for each arm and leg (an elbow or a knee bends towards a pole point, so it never folds the
 * wrong way), and a small turn of the spine for a punch. Every bone it turns is put back before the
 * clip poses the next frame, so nothing winds up over time (npc.ts does the same for its gestures).
 *
 * No body part into the machine (RUL-3D-005): the hands go to the bar's grip or the bag's skin, and
 * the scene measures the deepest skin point inside the bench pad (gymPlace.ts benchPierceCm).
 */
type V3 = any;

export class PoseBlend {
  private saved = new Map<any, any>();
  private v: Record<string, V3>;
  private q: Record<string, any>;
  constructor(private T: any) {
    this.v = { a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3(), d: new T.Vector3(), e: new T.Vector3(), u: new T.Vector3(), w: new T.Vector3() };
    this.q = { p: new T.Quaternion(), d: new T.Quaternion(), r: new T.Quaternion() };
  }
  /** Put back every bone turned since the last call (call before the clip poses the next frame). */
  restore() {
    this.saved.forEach((q, bone) => { bone.quaternion.copy(q); });
    this.saved.clear();
  }
  /** Turn a bone by a world-space rotation (remembering how the clip left it). */
  rotWorld(bone: any, dWorld: any) {
    if (!bone?.parent) return;
    const { p, r } = this.q;
    if (!this.saved.has(bone)) this.saved.set(bone, bone.quaternion.clone());
    bone.parent.getWorldQuaternion(p);
    r.copy(p).invert().multiply(dWorld).multiply(p).multiply(bone.quaternion);
    bone.quaternion.copy(r);
    bone.updateMatrixWorld(true);
  }
  /** Turn a bone round a world axis by an angle (radians). */
  turn(bone: any, axis: V3, angle: number) {
    if (!bone || Math.abs(angle) < 1e-5) return;
    this.q.d.setFromAxisAngle(axis, angle);
    this.rotWorld(bone, this.q.d);
  }
  /**
   * Two-bone reach: the end of `c` (a hand, a foot) to `target`, the middle joint (`b`: elbow, knee)
   * bent towards the world point `pole`, blended by w (0 = the clip, 1 = all the way). Lengths are the
   * body's own; a target out of reach is met along the line, arm or leg straight.
   */
  reach(a: any, b: any, c: any, target: V3, pole: V3, w = 1) {
    if (!a || !b || !c || w <= 0.001) return;
    const { a: A, b: B, c: C, d: Tg, e: P, u, w: bend } = this.v;
    a.getWorldPosition(A); b.getWorldPosition(B); c.getWorldPosition(C);
    const L1 = A.distanceTo(B), L2 = B.distanceTo(C);
    Tg.copy(C).lerp(target, w);
    u.subVectors(Tg, A);
    let d = u.length();
    if (d < 1e-5) return;
    u.multiplyScalar(1 / d);
    d = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min(L1 + L2 - 1e-3, d));
    // the bend: the pole's direction, square to the line from the joint to the target
    P.subVectors(pole, A);
    bend.copy(P).addScaledVector(u, -P.dot(u));
    if (bend.lengthSq() < 1e-8) bend.set(0, 1, 0).addScaledVector(u, -u.y);
    bend.normalize();
    const cosA = Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    // where the middle joint should be
    const want = P.copy(A).addScaledVector(u, L1 * cosA).addScaledVector(bend, L1 * sinA);
    const cur = this.v.c.subVectors(B, A).normalize();
    const goal = this.v.e.subVectors(want, A).normalize();
    this.q.d.setFromUnitVectors(cur, goal);
    this.rotWorld(a, this.q.d);
    // then the lower bone onto the target
    b.getWorldPosition(B); c.getWorldPosition(C);
    const cur2 = this.v.c.subVectors(C, B).normalize();
    const goal2 = this.v.e.copy(A).addScaledVector(u, d).sub(B).normalize();
    this.q.d.setFromUnitVectors(cur2, goal2);
    this.rotWorld(b, this.q.d);
  }
}

/** Ease in-out (0..1). */
export const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
