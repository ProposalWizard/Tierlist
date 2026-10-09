/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PERFORMANCE — whole-body holds laid over a clip (PoseHold in types.ts),
 * through the people layer's API (reach, hand, lean, lookAt, bone). Each is
 * worked out from t and a weight; nothing remembers the last frame.
 *
 * Points are in the actor's own frame: x = his left, y up from his feet,
 * z = his front.
 */
import type { CutsceneActor, PoseHold, Vec3 } from "./types";
import { aimBone, rotateBoneWorld, solveArm } from "../signing3dRig";

export interface PoseCtx { T: any; t: number; local: number; yaw: number; root: Vec3 }

export function actorPoint(T: any, c: PoseCtx, x: number, y: number, z: number) {
  const cs = Math.cos(c.yaw), s = Math.sin(c.yaw);
  return new T.Vector3(c.root[0] + x * cs + z * s, c.root[1] + y, c.root[2] - x * s + z * cs);
}
export function actorDir(T: any, c: PoseCtx, x: number, y: number, z: number) {
  const cs = Math.cos(c.yaw), s = Math.sin(c.yaw);
  return new T.Vector3(x * cs + z * s, y, -x * s + z * cs).normalize();
}

/** Both hands to points (actor frame), fingers along / palms towards (actor frame). */
function twoHands(a: CutsceneActor, c: PoseCtx, w: number, L: Vec3, R: Vec3, alongL: Vec3 | null, palmL: Vec3 | null, alongR: Vec3 | null, palmR: Vec3 | null, pole?: Vec3) {
  const T = c.T;
  const d = (v: Vec3 | null) => (v ? actorDir(T, c, v[0], v[1], v[2]) : null);
  a.reach("L", actorPoint(T, c, ...L), d(alongL), d(palmL), w, pole ? actorDir(T, c, pole[0], pole[1], pole[2]) : actorDir(T, c, 0.8, -0.5, -0.3));
  a.reach("R", actorPoint(T, c, ...R), d(alongR), d(palmR), w, pole ? actorDir(T, c, -pole[0], pole[1], pole[2]) : actorDir(T, c, -0.8, -0.5, -0.3));
}

/** Knees on the floor, back upright (knee-slide: leaning back). */
function kneel(a: CutsceneActor, c: PoseCtx, w: number, back: number) {
  const T = c.T;
  const f = actorDir(T, c, 0, 0, 1);
  const left = actorDir(T, c, 1, 0, 0);
  const wp = (b: any) => { const v = new T.Vector3(); b.getWorldPosition(v); return v; };
  for (const [S, sx] of [["Left", 1], ["Right", -1]] as const) {
    const ul = a.bone(`${S}UpLeg`), lo = a.bone(`${S}Leg`), ft = a.bone(`${S}Foot`);
    if (!ul || !lo || !ft) continue;
    const hip = wp(ul), knee = wp(lo), foot = wp(ft);
    const thigh = hip.distanceTo(knee), shin = knee.distanceTo(foot);
    const kt = hip.clone().add(new T.Vector3(0, -thigh * 0.96, 0)).add(f.clone().multiplyScalar(0.16)).add(left.clone().multiplyScalar(0.08 * sx));
    aimBone(T, ul, knee, kt, w);
    const k2 = wp(lo);
    aimBone(T, lo, wp(ft), k2.clone().add(f.clone().multiplyScalar(-shin * 0.95)).add(new T.Vector3(0, -0.04, 0)), w);
    void foot;
  }
  const lk = a.bone("LeftLeg"), rk = a.bone("RightLeg");
  if (lk && rk) {
    const ky = Math.min(wp(lk).y, wp(rk).y);
    a.root.position.y -= (ky - (c.root[1] + 0.07)) * w;
    a.root.updateMatrixWorld(true);
  }
  if (back) a.lean(-back * w);
}

export function applyPose(a: CutsceneActor, pose: PoseHold, w: number, c: PoseCtx) {
  if (w <= 0) return;
  const T = c.T;
  const sh = a.point("shoulder.L").y - c.root[1];
  const head = a.point("head").y - c.root[1];
  const chest = a.point("chest").y - c.root[1];
  const hips = a.point("hips").y - c.root[1];
  const t = c.local;
  switch (pose) {
    case "stand": case "sit": break;
    case "kneel": kneel(a, c, w, 0); break;
    case "kneel-pray": kneel(a, c, w, 0); twoHands(a, c, w, [0.02, chest + 0.05, 0.22], [-0.02, chest + 0.05, 0.22], [0, 1, 0.2], [-1, 0, 0], [0, 1, 0.2], [1, 0, 0]); a.hand("L", "flat", w); a.hand("R", "flat", w); break;
    case "knee-slide": {
      // arms flung wide, then the roar (fists pulled in), then up again: something changes every second or so
      const roar = Math.min(1, Math.max(0, Math.min((t - 1.2) / 0.35, (2.5 - t) / 0.4)));
      kneel(a, c, w, 0.22 - 0.1 * roar);
      const up = Math.min(1, t / 0.5) * (1 - roar) + (t > 2.5 ? Math.min(1, (t - 2.5) / 0.5) * 0.4 : 0);
      const ox = 0.62 - 0.38 * roar, oy = sh + 0.05 + 0.3 * up - 0.12 * roar, oz = 0.12 + 0.16 * roar;
      twoHands(a, c, w, [ox, oy, oz], [-ox, oy, oz], [1 - 1.3 * roar, 0.3 + 0.5 * roar, 0.1], [0, 0.2, 1], [-1 + 1.3 * roar, 0.3 + 0.5 * roar, 0.1], [0, 0.2, 1], [0, -1, -0.6]);
      a.hand("L", roar > 0.5 ? "fist" : "spread", w); a.hand("R", roar > 0.5 ? "fist" : "spread", w);
      break;
    }
    case "arms-wide":
      twoHands(a, c, w, [0.62, sh + 0.08, 0.14], [-0.62, sh + 0.08, 0.14], [1, 0.2, 0.15], [0, 0.1, 1], [-1, 0.2, 0.15], [0, 0.1, 1], [0, -1, -0.6]);
      a.hand("L", "spread", w); a.hand("R", "spread", w);
      break;
    case "arms-up":
      twoHands(a, c, w, [0.24, head + 0.42, 0.08], [-0.24, head + 0.42, 0.08], [0.2, 1, 0.05], [0, 0.1, 1], [-0.2, 1, 0.05], [0, 0.1, 1], [0, 0, -1]);
      a.hand("L", "fist", w); a.hand("R", "fist", w);
      a.lean(-0.12 * w);
      break;
    case "fist-pump": {
      const k = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.6 - Math.PI / 2);
      a.reach("R", actorPoint(T, c, -0.22, sh + 0.05 + 0.32 * k, 0.22 - 0.05 * k), actorDir(T, c, 0, 1, 0.2), actorDir(T, c, 0, 0, 1), w, actorDir(T, c, -0.6, -0.8, 0));
      a.hand("R", "fist", w);
      break;
    }
    case "point-sky":
      a.reach("R", actorPoint(T, c, -0.18, head + 0.5, 0.18), actorDir(T, c, 0, 1, 0.1), actorDir(T, c, 0, 0, 1), w, actorDir(T, c, -0.7, -0.3, -0.5));
      a.hand("R", "point", w);
      a.lookAt(actorPoint(T, c, -0.1, head + 6, 2), 0.8 * w);
      break;
    case "hands-on-head":
      twoHands(a, c, w, [0.12, head + 0.1, -0.02], [-0.12, head + 0.1, -0.02], [-0.6, 0.2, 0.2], [0, -1, 0], [0.6, 0.2, 0.2], [0, -1, 0], [0, 0.3, 1]);
      a.hand("L", "flat", w); a.hand("R", "flat", w);
      break;
    case "hands-on-hips":
      twoHands(a, c, w, [0.22, hips + 0.08, -0.02], [-0.22, hips + 0.08, -0.02], [0, -1, 0.2], [-1, 0, 0], [0, -1, 0.2], [1, 0, 0], [0, 0, -1]);
      break;
    case "arms-folded":
      twoHands(a, c, w, [-0.13, chest - 0.05, 0.2], [0.13, chest - 0.08, 0.2], [-1, 0, 0], [0, -0.3, -1], [1, 0, 0], [0, -0.3, -1], [0, -1, 0]);
      break;
    case "applaud": {
      const k = Math.abs(Math.sin(t * Math.PI * 2.6));
      const g = 0.025 + 0.07 * k;
      twoHands(a, c, w, [g, chest + 0.04, 0.32], [-g, chest + 0.06, 0.32], [-0.2, 0.7, 0.7], [-1, 0, 0], [0.2, 0.7, 0.7], [1, 0, 0], [0, -1, -0.2]);
      a.hand("L", "clap", w); a.hand("R", "clap", w);
      break;
    }
    case "salute-crowd": {
      const k = Math.sin(t * Math.PI * 2 * 0.9);
      a.reach("R", actorPoint(T, c, -0.45 + 0.08 * k, head + 0.25, 0.25), actorDir(T, c, -0.1 * k, 1, 0.1), actorDir(T, c, 0, 0, 1), w, actorDir(T, c, -1, -0.4, 0));
      a.hand("R", "wave", w);
      break;
    }
    case "hold-shirt-up": {
      const y = chest + 0.02;
      twoHands(a, c, w, [0.21, y, 0.42], [-0.21, y, 0.42], [-0.2, 0.6, 0.6], [0, -0.2, 1], [0.2, 0.6, 0.6], [0, -0.2, 1], [0, -1, -0.3]);
      a.hand("L", "pinch", w); a.hand("R", "pinch", w);
      break;
    }
    case "trophy-overhead": {
      const lift = Math.min(1, t / 0.7);
      const y = chest + 0.05 + (head + 0.5 - chest) * lift;
      twoHands(a, c, w, [0.21, y, 0.2 - 0.14 * lift], [-0.21, y, 0.2 - 0.14 * lift], [-0.4, 1, 0.1], [-1, 0, 0], [0.4, 1, 0.1], [1, 0, 0], [0, -0.4, -1]);
      a.hand("L", "grip", w); a.hand("R", "grip", w);
      a.lean(-0.1 * w * lift);
      break;
    }
    case "trophy-chest":
      twoHands(a, c, w, [0.2, chest - 0.02, 0.26], [-0.2, chest - 0.02, 0.26], [-0.3, 0.3, 1], [-1, 0, 0], [0.3, 0.3, 1], [1, 0, 0]);
      a.hand("L", "grip", w); a.hand("R", "grip", w);
      break;
    case "badge-kiss":
      a.reach("R", actorPoint(T, c, 0.1, chest + 0.06, 0.13), actorDir(T, c, 0.6, 0.5, 0), actorDir(T, c, 0, 0, -1), w, actorDir(T, c, -0.7, -0.6, 0.2));
      a.hand("R", "flat", w);
      a.lean(0.12 * w);
      break;
    case "head-down": {
      const n = a.bone("neck");
      if (n) rotateBoneWorld(T, n, new T.Quaternion().setFromAxisAngle(actorDir(T, c, 1, 0, 0), 0.45 * w));
      a.lean(0.1 * w);
      break;
    }
    case "lean-in": a.lean(0.3 * w); break;
    case "lean-back": a.lean(-0.18 * w); break;
    case "nod": {
      const n = a.bone("neck");
      const k = Math.max(0, Math.sin(t * Math.PI * 2 * 1.4)) * Math.max(0, 1 - t / 1.6);
      if (n) rotateBoneWorld(T, n, new T.Quaternion().setFromAxisAngle(actorDir(T, c, 1, 0, 0), 0.28 * k * w));
      break;
    }
    case "hand-on-shoulder": break; // a reach track does the hand (it needs the other man)
    case "lean-desk":
      a.lean(0.28 * w);
      twoHands(a, c, w, [0.26, 0.8, 0.42], [-0.26, 0.8, 0.42], [-0.2, -0.2, 1], [0, -1, 0], [0.2, -0.2, 1], [0, -1, 0]);
      a.hand("L", "flat", w); a.hand("R", "flat", w);
      break;
  }
  void solveArm;
}
