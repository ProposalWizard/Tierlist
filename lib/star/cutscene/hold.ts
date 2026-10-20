/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HOLDING THINGS (B5b, 20 Oct 2026; Harry: "natural movement while … holding
 * objects"). Shared by every cut scene, through the people layer's API
 * (reach, hand, gripFrame), so any body and any prop gets it:
 *
 *   gripTo      a hand's GRIP POINT (inside the closed fingers, where the
 *               prop's handle sits) on a point, not its wrist.
 *   liftPlace   where a two-handled cup goes when it is lifted over the head:
 *               as high as the arms really reach, and forward only as far as
 *               it takes for the base to clear his head (worked out from his
 *               own arm length and the cup's own size).
 *   chestPlace  the same cup held up in front of the chest, bowl at the chin.
 *
 * The prop itself is always placed FROM the hands (director.ts placeProps), so
 * whatever the arms reach, it sits in the palms; these only choose where the
 * hands go so that the hold looks right and nothing passes through his head.
 */
import type { CutsceneActor, HandPose, Vec3 } from "./types";

type V = any;

/** A held prop's measures in its own frame (props3d.ts): its handles and its box, already scaled. */
export interface HeldProp {
  handles: Record<string, Vec3>;
  min: Vec3;
  max: Vec3;
  /** How far it reaches out in front (its own +z / −z, whichever is more), in height bands of its own frame. */
  front: { y0: number; y1: number; z: number }[];
}

/**
 * Put the hand's grip point (gripFrame: inside the curled fingers) on `want`, the hand along/palm as asked:
 * a few passes, each moving the wrist by the miss. `w` < 1 blends from the pose before.
 */
export function gripTo(T: any, a: CutsceneActor, hand: "L" | "R", grip: HandPose, want: V, along: V | null, palm: V | null, pole: V | undefined, w: number) {
  if (w <= 0) return;
  const S = hand === "R" ? "Right" : "Left";
  const bones = [`${S}Shoulder`, `${S}Arm`, `${S}ForeArm`, `${S}Hand`].map((n) => a.bone(n)).filter(Boolean) as any[];
  const saved = bones.map((b) => b.quaternion.clone());
  // part of the way (a hold blending in, or one hold handing over to the next): the grip point goes part
  // of the way in a straight line and the hand turns part of the way, and the grip stays exact (B5b: blending
  // the arm's turns instead let a cup slip 2.5 cm out of the hands between two holds)
  const now = w < 1 && a.handFrame ? a.handFrame(hand) : null;
  if (now && along && palm) {
    want = a.gripFrame(hand, grip).pos.lerp(want, w);
    along = now.along.clone().lerp(along, w).normalize();
    palm = now.palm.clone().lerp(palm, w).normalize();
  }
  let wrist = want.clone().add(new T.Vector3(0, 0.08, 0));
  for (let i = 0; i < 4; i++) {
    bones.forEach((b, j) => b.quaternion.copy(saved[j]));
    a.root.updateMatrixWorld(true);
    a.reach(hand, wrist, along, palm, 1, pole);
    a.hand(hand, grip, 1);
    const g = a.gripFrame(hand, grip).pos;
    wrist = wrist.add(want.clone().sub(g));
  }
  if (w < 1 && !(now && along && palm)) {
    const solved = bones.map((b) => b.quaternion.clone());
    bones.forEach((b, j) => { b.quaternion.copy(saved[j]).slerp(solved[j], w); });
    a.root.updateMatrixWorld(true);
  }
}

/** How far a hand's grip point can get from its shoulder (upper arm + forearm + wrist to grip), metres. */
export function armReach(T: any, a: CutsceneActor, hand: "L" | "R"): number {
  const S = hand === "R" ? "Right" : "Left";
  const p = (n: string) => { const b = a.bone(n); const v = new T.Vector3(); b?.getWorldPosition(v); return v; };
  const sh = p(`${S}Arm`), el = p(`${S}ForeArm`), wr = p(`${S}Hand`);
  const g = a.gripFrame(hand, "grip").pos;
  return sh.distanceTo(el) + el.distanceTo(wr) + wr.distanceTo(g) * 0.9;
}

export interface LiftInput {
  /** The shoulder joint, actor frame (x his left, y up from his feet, z his front): the left one; the right is its mirror. */
  shoulder: Vec3;
  /** Shoulder to grip point, metres. */
  reach: number;
  /** His crown (top of the head and hair), chin and the front of his face, actor frame. */
  crownY: number;
  chinY: number;
  faceZ: number;
  /** The head's middle front-to-back (actor frame z). */
  headZ: number;
  /** Half the distance between the cup's two handles, and its height from the handles down to its base. */
  half: number;
  drop: number;
  /** How far the cup reaches out in front, by height band measured from the handles (negative: below them). */
  front: { y0: number; y1: number; z: number }[];
}
export interface LiftPlace { y: number; z: number; clear: number; straight: number }

/** At most this share of the arm's full length (a lift is near straight arms; fully straight looks locked). */
export const LIFT_REACH = 0.97;
/** The base clears his crown by this much, or his face by this much in front. */
export const LIFT_CLEAR = { over: 0.035, front: 0.025 };

/**
 * The handles' middle when the cup is held up over his head (actor frame):
 * the highest the arms reach, moved forward only as far as it takes for the
 * base to clear his head. Pure: tests/star/propHold.mts.
 */
export function liftPlace(i: LiftInput): LiftPlace {
  const R = i.reach * LIFT_REACH;
  let best: LiftPlace | null = null;
  for (let z = i.headZ; z <= i.headZ + 0.5; z += 0.01) {
    const dx = i.half - Math.abs(i.shoulder[0]), dz = z - i.shoulder[2];
    const rem = R * R - dx * dx - dz * dz;
    if (rem <= 0) break;
    const y = i.shoulder[1] + Math.sqrt(rem);
    const bottom = y - i.drop;
    const over = bottom - (i.crownY + LIFT_CLEAR.over);
    // in front of the face: only the parts of the cup at the head's height count (the narrow stem and base, not the bowl above)
    let front = Infinity;
    for (const b of i.front) {
      const lo = y + b.y0, hi = y + b.y1;
      if (hi < i.chinY - 0.02 || lo > i.crownY + LIFT_CLEAR.over) continue;
      front = Math.min(front, z - b.z - (i.faceZ + LIFT_CLEAR.front));
    }
    const clear = Math.max(over, front === Infinity ? 1 : front);
    const straight = Math.sqrt(rem) / R;
    if (clear >= 0) return { y, z, clear, straight };
    if (!best || clear > best.clear) best = { y, z, clear, straight };
  }
  return best ?? { y: i.shoulder[1] + R * 0.8, z: i.headZ + 0.3, clear: -1, straight: 0.8 };
}

/** The handles' middle when the cup is held in front of the chest (actor frame): the bowl at chin height, a forearm out. */
export function chestPlace(shoulderY: number, drop: number, top: number): { y: number; z: number } {
  // the rim just under the chin (his face shows over it; 2 cm over the shoulder joints), the base no lower than the belt
  const y = Math.max(shoulderY + 0.02 - top, shoulderY - 0.6 + drop);
  return { y: Math.min(y, shoulderY - 0.05), z: 0.32 };
}

/** The world rotation taking the frame (x, y) to (X, Y): a held tool's own axes onto where they should point. */
export function basisTurn(T: any, x: V, y: V, X: V, Y: V) {
  const f = (a: V, b: V) => {
    const u = a.clone().normalize();
    const v = b.clone().sub(u.clone().multiplyScalar(b.dot(u))).normalize();
    const w = new T.Vector3().crossVectors(u, v);
    return new T.Matrix4().makeBasis(u, v, w);
  };
  const from = f(x, y), to = f(X, Y);
  return new T.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
}

/** A prop's measures for holding (its handles and box in its own frame, scaled). */
export function heldPropOf(T: any, p: { group: any; handles: Record<string, Vec3> }): HeldProp {
  const g = p.group;
  const q = g.quaternion.clone(), pos = g.position.clone();
  g.quaternion.identity(); g.position.set(0, 0, 0); g.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(g);
  g.quaternion.copy(q); g.position.copy(pos); g.updateMatrixWorld(true);
  const s = g.scale;
  const handles: Record<string, Vec3> = {};
  for (const [k, h] of Object.entries(p.handles)) handles[k] = [h[0] * s.x, h[1] * s.y, h[2] * s.z];
  // its reach out in front, in 12 height bands (from its own vertices; a handle at the side does not count)
  // (the box is scaled; the vertices below are read in its own unscaled frame)
  const N = 12, lo = box.isEmpty() ? 0 : box.min.y / (s.y || 1), hi = box.isEmpty() ? 0 : box.max.y / (s.y || 1);
  const band = new Array(N).fill(0);
  if (!box.isEmpty()) {
    const v = new T.Vector3(), inv = new T.Matrix4().copy(g.matrixWorld).invert();
    g.updateMatrixWorld(true);
    g.traverse((o: any) => {
      const pos = o.isMesh ? o.geometry?.attributes?.position : null;
      if (!pos) return;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
        const j = Math.min(N - 1, Math.max(0, Math.floor(((v.y - lo) / Math.max(1e-6, hi - lo)) * N)));
        band[j] = Math.max(band[j], Math.abs(v.z) * s.z);
      }
    });
  }
  const front = band.map((z, j) => ({ y0: (lo + ((hi - lo) * j) / N) * s.y, y1: (lo + ((hi - lo) * (j + 1)) / N) * s.y, z }));
  return { handles, min: box.isEmpty() ? [0, 0, 0] : box.min.toArray(), max: box.isEmpty() ? [0, 0, 0] : box.max.toArray(), front };
}

/**
 * Where a two-handed prop goes, FROM the hands: its handles' middle on the
 * grips' middle, its left handle towards the left hand, upright to his front
 * (`yaw`: his facing). So it always sits in both palms, wherever they reached.
 */
export function twoHandPlace(T: any, a: CutsceneActor, handles: Record<string, Vec3>, scale: V, yaw: number): { pos: V; q: V } {
  const gl = a.gripFrame("L", "grip").pos, gr = a.gripFrame("R", "grip").pos;
  const hl = new T.Vector3(...(handles.L ?? [0.1, 0, 0])), hr = new T.Vector3(...(handles.R ?? [-0.1, 0, 0]));
  const X = gl.clone().sub(gr).normalize();
  const fwd = new T.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const Y = new T.Vector3().crossVectors(fwd, X).normalize();
  const Z = new T.Vector3().crossVectors(X, Y).normalize();
  const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
  const mid = gl.clone().add(gr).multiplyScalar(0.5);
  const hm = hl.add(hr).multiplyScalar(0.5).multiply(scale).applyQuaternion(q);
  return { pos: mid.sub(hm), q };
}
