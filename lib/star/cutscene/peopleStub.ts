/**
 * THE PEOPLE LAYER — STAND-IN. A thin adapter that gives the director the
 * agreed CutsceneActor interface (types.ts) on today's people3d bodies, so
 * the cut-scene system runs now. The real people layer (faces, expressions,
 * hand poses, props on hand bones, IK, look-at) is another builder's
 * (lib/star/cutscene/people.ts); peopleAdapter.ts swaps to it in one line.
 *
 * What this stand-in does: clips sampled from t, arm and leg IK, the one
 * body's fingers (named hand shapes), the pen grip measured off the real
 * fingertips (as the live signing does), head-and-neck look-at with a limit,
 * feet kept on the floor, a lean. What it does NOT do: faces (expression,
 * blink and mouth are accepted and only nudge the head), eyes.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ActorSpec, BodyPart, CutsceneActor, CutscenePeople, CutscenePeopleInit, Expression, HandPose, Vec3 } from "./types";
import { loadPeople3d, makePerson3d, dressPerson3d, poseFingers, fingersDeg, fingerTip, hasFingers, type FingerPose, type Person3D, type PersonModel } from "../people3d";
import { addClips, loadAnims3d } from "../three3d/footballAnims";
import { solveArm, handWorldQuat, setBoneWorldQuat, rotateBoneWorld, type HandAxes } from "../signing3dRig";
import { newNumberCanvas, drawShirtNumber } from "../signing3dTextures";

type Three = typeof import("three");

/** Finger shapes, degrees per joint (root first). Pen/shake/relax/open/flat are the live signing's own. */
export const HAND_SHAPES: Record<HandPose, Parameters<typeof fingersDeg>[0]> = {
  relax: { thumb: [5, 10, 8], index: [10, 16, 9], middle: [13, 19, 11], ring: [15, 21, 12], little: [17, 23, 14], thumbSwing: 8 },
  open: { thumb: [0, 0, 0], index: [4, 6, 4], middle: [6, 8, 5], ring: [8, 10, 6], little: [10, 12, 8], thumbSwing: -10 },
  flat: { thumb: [0, 5, 5], index: [3, 5, 3], middle: [3, 5, 3], ring: [4, 6, 4], little: [5, 7, 5], thumbSwing: 0 },
  spread: { thumb: [0, 0, 0], index: [0, 2, 2], middle: [0, 2, 2], ring: [0, 2, 2], little: [0, 2, 2], thumbSwing: -25 },
  pen: { thumb: [10, 5, 5], index: [35, 45, 20], middle: [45, 58, 30], ring: [65, 80, 45], little: [72, 85, 50], thumbSwing: 20 },
  shake: { thumb: [0, 12, 15], index: [25, 55, 35], middle: [28, 58, 38], ring: [30, 60, 40], little: [32, 62, 42], thumbSwing: 15 },
  fist: { thumb: [20, 30, 30], index: [80, 95, 60], middle: [85, 95, 60], ring: [85, 95, 60], little: [85, 95, 60], thumbSwing: 35 },
  grip: { thumb: [10, 20, 20], index: [50, 65, 40], middle: [55, 68, 42], ring: [58, 70, 44], little: [60, 72, 46], thumbSwing: 25 },
  pinch: { thumb: [10, 15, 15], index: [30, 40, 25], middle: [50, 70, 45], ring: [70, 85, 50], little: [75, 88, 52], thumbSwing: 25 },
  point: { thumb: [20, 30, 30], index: [0, 2, 2], middle: [85, 95, 60], ring: [85, 95, 60], little: [85, 95, 60], thumbSwing: 30 },
  "thumbs-up": { thumb: [-5, 0, 0], index: [80, 95, 60], middle: [85, 95, 60], ring: [85, 95, 60], little: [85, 95, 60], thumbSwing: -10 },
  clap: { thumb: [0, 4, 4], index: [2, 4, 3], middle: [2, 4, 3], ring: [3, 5, 3], little: [4, 6, 4], thumbSwing: -5 },
  wave: { thumb: [0, 0, 0], index: [0, 3, 3], middle: [0, 3, 3], ring: [2, 4, 3], little: [3, 5, 4], thumbSwing: -15 },
};
const SHAPES = new Map<HandPose, FingerPose>();
export function handShape(p: HandPose): FingerPose {
  let f = SHAPES.get(p);
  if (!f) { f = fingersDeg(HAND_SHAPES[p] ?? HAND_SHAPES.relax); SHAPES.set(p, f); }
  return f;
}
/** Blend finger poses by weight. */
function mixPose(a: FingerPose, b: FingerPose, k: number): FingerPose {
  const out: FingerPose = {};
  for (const f of ["thumb", "index", "middle", "ring", "little"] as const) {
    const x = a[f] ?? [0, 0, 0], y = b[f] ?? [0, 0, 0];
    out[f] = [0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * k) as [number, number, number];
  }
  out.thumbSwing = (a.thumbSwing ?? 0) + ((b.thumbSwing ?? 0) - (a.thumbSwing ?? 0)) * k;
  return out;
}

/** The pen between thumb and index pads, resting on the web (the live signing's GRIP). */
const GRIP = { padIn: 0.004, webOut: 0.035, tipOut: 0.032 };

export function createStubPeople(init: CutscenePeopleInit): CutscenePeople {
  const T = init.T as Three;
  const loader = init.loader as { loadAsync(url: string): Promise<unknown> };
  let animsP: Promise<[GLTF, GLTF | null, GLTF | null]> | null = null;
  const anims = () => (animsP ??= Promise.all([
    loadPeople3d(loader, "anims", init.body),
    loadAnims3d(loader as never, "football").catch(() => null),
    loadAnims3d(loader as never, "casino").catch(() => null),
  ]));
  const made: StubActor[] = [];
  return {
    async create(spec) {
      const [a, fb, cs] = await anims();
      const body = (spec.look.body ?? "player") as PersonModel;
      const model = await loadPeople3d(loader, body, init.body);
      const p = makePerson3d(T, init.SkeletonUtils, model, a, { outline: spec.outline, castShadow: spec.castShadow, outlineNear: 2.5 });
      if (fb) addClips(T, p, fb);
      if (cs) addClips(T, p, cs);
      for (const act of Object.values(p.actions)) { act.enabled = true; act.play(); act.setEffectiveWeight(0); }
      dress(T, p, spec);
      const actor = new StubActor(T, spec.id, p);
      made.push(actor);
      return actor;
    },
    dispose() { for (const a of made) a.dispose(); made.length = 0; },
  };
}

function dress(T: Three, p: Person3D, spec: ActorSpec) {
  const L = spec.look;
  const out = L.outfit ?? (L.body === "manager" ? "suit" : "kit");
  let kit = L.kit;
  const acc = [...(L.accessories ?? [])];
  if (out === "tracksuit") {
    const c = L.kit?.shirt ?? "#1f2433";
    kit = { shirt: shade(c, -0.55), trim: shade(c, -0.6) };
    acc.push({ slot: "arms", color: shade(c, -0.55) }, { slot: "neck", color: shade(c, -0.55) });
  } else if (out === "casual") {
    kit = { shirt: L.kit?.shirt ?? "#e8e4dc", trim: "#2b3442" };
  } else if (out === "keeper") {
    kit = L.kit ?? { shirt: "#16a34a", trim: "#0b3d1d" };
    acc.push({ slot: "hands", color: "#f5f5f5", color2: "#16a34a" });
  } else if (out === "training-bib") {
    kit = { shirt: "#d9f99d", trim: "#1f2433" };
  }
  let number: THREE.Texture | null = null;
  if (L.number != null && (out === "kit" || out === "keeper")) {
    const c = newNumberCanvas(); drawShirtNumber(c, L.number);
    number = new T.CanvasTexture(c); number.colorSpace = T.SRGBColorSpace;
  }
  dressPerson3d(T, p, { skin: L.skin, hair: L.hair, grey: L.grey, kit, number, accessories: acc, face: (L.face as never) ?? null });
}

/** Lighten (+) or darken (−) a hex colour. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (s: number) => { const v = (n >> s) & 255; return Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k); };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

const EXPR_HEAD: Partial<Record<Expression, number>> = { sad: 0.16, disappointed: 0.12, crying: 0.2, proud: -0.06, elated: -0.12, shout: -0.1, determined: 0.03 };

class StubActor implements CutsceneActor {
  readonly root: THREE.Object3D;
  private fingers: Record<"L" | "R", FingerPose>;
  private headRestLocal: THREE.Quaternion;
  private yaw = 0;
  private axes: Record<"L" | "R", HandAxes>;
  private exprTilt = 0;

  constructor(private T: Three, readonly id: string, readonly person: Person3D) {
    this.root = person.root;
    this.fingers = { L: handShape("relax"), R: handShape("relax") };
    // the head's world turn in the bind pose, root unturned
    person.rest.forEach(([pp, q], b) => { b.position.copy(pp); b.quaternion.copy(q); });
    person.root.rotation.set(0, 0, 0);
    person.root.updateMatrixWorld(true);
    this.headRestLocal = new T.Quaternion();
    person.bones.Head.getWorldQuaternion(this.headRestLocal);
    const ax = (s: "L" | "R"): HandAxes => {
      const h = person.hand[s];
      return { along: h.along, palm: h.palm, side: new T.Vector3().crossVectors(h.along, h.palm).normalize() };
    };
    this.axes = { L: ax("L"), R: ax("R") };
  }

  clips() { return Object.keys(this.person.actions); }
  clipDuration(n: string) { return this.person.actions[n]?.getClip().duration ?? 1; }

  beginFrame() {
    this.fingers = { L: handShape("relax"), R: handShape("relax") };
    this.exprTilt = 0;
  }

  poseClips(entries: [string, number, number][]) {
    const p = this.person;
    for (const a of Object.values(p.actions)) a.setEffectiveWeight(0);
    for (const [name, time, w] of entries) {
      const a = p.actions[name];
      if (!a) continue;
      a.enabled = true;
      a.setEffectiveWeight(w);
      a.time = Math.max(0, Math.min(time, a.getClip().duration - 1e-3));
    }
    p.base.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
    p.mixer.update(0);
    p.base.forEach(([pos, q], b) => { pos.copy(b.position); q.copy(b.quaternion); });
  }

  setRoot(pos: Vec3, yaw: number) {
    this.yaw = yaw;
    this.root.position.set(pos[0], pos[1], pos[2]);
    this.root.rotation.set(0, yaw, 0);
    this.root.updateMatrixWorld(true);
  }

  /** Keep the clip's hips over the root (gaits are run in place by the director). */
  hipsInPlace(w: number) {
    const p = this.person, h = p.bones.Hips, r = p.hipsRest;
    h.position.x += (r.x - h.position.x) * w;
    h.position.z += (r.z - h.position.z) * w;
    this.root.updateMatrixWorld(true);
  }

  bone(n: string) { return this.person.bones[n] ?? null; }

  private wp(o: THREE.Object3D) { const v = new this.T.Vector3(); o.getWorldPosition(v); return v; }
  private dirOf(x: number, y: number, z: number) {
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return new this.T.Vector3(x * c + z * s, y, -x * s + z * c).normalize();
  }

  point(part: BodyPart): THREE.Vector3 {
    const B = this.person.bones;
    switch (part) {
      case "head": return this.wp(B.Head).add(new this.T.Vector3(0, 0.1, 0));
      case "eyes": {
        const q = new this.T.Quaternion(); B.Head.getWorldQuaternion(q);
        const off = new this.T.Vector3(0, 0.125, 0.095).applyQuaternion(this.headRestLocal.clone().invert()).applyQuaternion(q);
        return this.wp(B.Head).add(off);
      }
      case "chest": return this.wp(B.Spine).add(new this.T.Vector3(0, 0.06, 0)).add(this.dirOf(0, 0, 1).multiplyScalar(0.1));
      case "hips": return this.wp(B.Hips);
      case "feet": { const a = this.wp(B.LeftFoot), b = this.wp(B.RightFoot); return a.add(b).multiplyScalar(0.5).setY(this.root.position.y); }
      case "hand.L": return this.wp(B.LeftHand);
      case "hand.R": return this.wp(B.RightHand);
      case "shoulder.L": return this.wp(B.LeftArm);
      case "shoulder.R": return this.wp(B.RightArm);
      case "knee.L": return this.wp(B.LeftLeg);
      case "knee.R": return this.wp(B.RightLeg);
    }
    return this.wp(B.Hips);
  }

  lean(rad: number, side = 0) {
    if (!rad && !side) return;
    const B = this.person.bones;
    const fwd = this.dirOf(0, 0, 1);
    const axF = new this.T.Vector3(0, 1, 0).cross(fwd).normalize();
    for (const b of ["Spine02", "Spine01", "Spine"]) {
      if (!B[b]) continue;
      if (rad) rotateBoneWorld(this.T, B[b], new this.T.Quaternion().setFromAxisAngle(axF, rad / 3));
      if (side) rotateBoneWorld(this.T, B[b], new this.T.Quaternion().setFromAxisAngle(fwd, side / 3));
    }
  }

  plantFeet(w: number) {
    if (w <= 0) return;
    this.root.updateMatrixWorld(true);
    const B = this.person.bones;
    const low = Math.min(this.wp(B.LeftFoot).y, this.wp(B.RightFoot).y) - this.root.position.y;
    const want = this.person.meta.joints.LeftFoot[1];
    this.root.position.y += Math.max(-0.12, Math.min(0.08, want - low)) * w;
    this.root.updateMatrixWorld(true);
  }

  reach(hand: "L" | "R", wrist: THREE.Vector3, along: THREE.Vector3 | null, palm: THREE.Vector3 | null, w: number, pole?: THREE.Vector3) {
    if (w <= 0) return;
    const S = hand === "R" ? "Right" : "Left";
    const B = this.person.bones;
    const ha = B[`${S}Hand`];
    const q0 = ha.quaternion.clone();
    const pl = pole ?? this.dirOf(hand === "R" ? -0.8 : 0.8, -0.55, -0.3);
    solveArm(this.T, B[`${S}Arm`], B[`${S}ForeArm`], ha, wrist, pl, w);
    if (along && palm) {
      const qa = ha.quaternion.clone();
      setBoneWorldQuat(this.T, ha, handWorldQuat(this.T, this.axes[hand], along, palm));
      if (w < 1) { ha.quaternion.copy(qa.slerp(ha.quaternion.clone(), w)); ha.updateMatrixWorld(true); }
    } else void q0;
  }

  reachFoot(foot: "L" | "R", ankle: THREE.Vector3, w: number, pole?: THREE.Vector3) {
    if (w <= 0) return;
    const S = foot === "R" ? "Right" : "Left";
    const B = this.person.bones;
    solveArm(this.T, B[`${S}UpLeg`], B[`${S}Leg`], B[`${S}Foot`], ankle, pole ?? this.dirOf(0, 0, 1), w);
  }

  hand(hand: "L" | "R", pose: HandPose, w: number) {
    if (w <= 0) return;
    this.fingers[hand] = w >= 1 ? handShape(pose) : mixPose(this.fingers[hand], handShape(pose), w);
    if (hasFingers(this.person)) poseFingers(this.T, this.person, hand, this.fingers[hand]);
  }

  private applyFingers() {
    if (!hasFingers(this.person)) return;
    poseFingers(this.T, this.person, "L", this.fingers.L);
    poseFingers(this.T, this.person, "R", this.fingers.R);
  }

  gripFrame(hand: "L" | "R", grip: HandPose) {
    const p = this.person;
    const S = hand === "R" ? "Right" : "Left";
    const hq = new this.T.Quaternion(); p.bones[`${S}Hand`].getWorldQuaternion(hq);
    const h = p.hand[hand];
    const along = h.along.clone().applyQuaternion(hq), palm = h.palm.clone().applyQuaternion(hq), thumb = h.thumb.clone().applyQuaternion(hq);
    const W = this.wp(p.bones[`${S}Hand`]);
    if (grip === "pen" && hasFingers(p)) {
      this.applyFingers();
      const ti = fingerTip(this.T, p, hand, "index")!, tt = fingerTip(this.T, p, hand, "thumb")!;
      const G = ti.clone().add(tt).multiplyScalar(0.5).addScaledVector(palm, GRIP.padIn);
      const mcpI = this.wp(p.fingers![hand].index.bones[0]), mcpT = this.wp(p.fingers![hand].thumb.bones[1]);
      const web = mcpI.add(mcpT).multiplyScalar(0.5).addScaledVector(palm, -GRIP.webOut);
      const axis = web.sub(G).normalize();
      return { pos: G.clone().addScaledVector(axis, -GRIP.tipOut), axis, up: palm.clone().negate() };
    }
    if (grip === "pen") {
      const pad = W.clone().addScaledVector(along, h.len * 0.82).addScaledVector(palm, 0.02).addScaledVector(thumb, 0.03);
      const web = W.clone().addScaledVector(along, h.len * 0.3).addScaledVector(thumb, 0.075);
      const axis = web.sub(pad).normalize();
      return { pos: pad.clone().addScaledVector(axis, -0.026), axis, up: palm.clone().negate() };
    }
    // a handle in the closed hand: across the palm, a little in from the knuckles
    const pos = W.clone().addScaledVector(along, h.len * 0.55).addScaledVector(palm, 0.035);
    const axis = new this.T.Vector3().crossVectors(along, palm).normalize().multiplyScalar(hand === "R" ? 1 : -1);
    return { pos, axis, up: palm.clone() };
  }

  lookAt(target: THREE.Vector3, w: number) {
    if (w <= 0) return;
    const B = this.person.bones;
    const T = this.T;
    const hq = new T.Quaternion(); B.Head.getWorldQuaternion(hq);
    const rootQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), this.yaw);
    const restW = rootQ.clone().multiply(this.headRestLocal);
    const delta = hq.clone().multiply(restW.clone().invert());
    const cur = this.dirOf(0, 0, 1).applyQuaternion(delta);
    const eye = this.point("eyes");
    const want = target.clone().sub(eye).normalize();
    // no owl heads: at most 75° round and 45° up/down from the body's way
    const fwd = this.dirOf(0, 0, 1);
    const flat = new T.Vector3(want.x, 0, want.z).normalize();
    let yaw = Math.atan2(fwd.clone().cross(flat).y, fwd.dot(flat));
    yaw = Math.max(-1.3, Math.min(1.3, yaw));
    const pitch = Math.max(-0.8, Math.min(0.75, Math.asin(Math.max(-1, Math.min(1, want.y)))));
    const lim = fwd.clone().applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
    lim.multiplyScalar(Math.cos(pitch)).setY(Math.sin(pitch)).normalize();
    const q = new T.Quaternion().setFromUnitVectors(cur, lim);
    q.slerp(new T.Quaternion(), 1 - w);
    rotateBoneWorld(T, B.neck, new T.Quaternion().copy(q).slerp(new T.Quaternion(), 0.55));
    // the head takes the rest, measured again after the neck moved
    const hq2 = new T.Quaternion(); B.Head.getWorldQuaternion(hq2);
    const cur2 = this.dirOf(0, 0, 1).applyQuaternion(hq2.multiply(restW.clone().invert()));
    const q2 = new T.Quaternion().setFromUnitVectors(cur2, lim).slerp(new T.Quaternion(), 1 - w);
    rotateBoneWorld(T, B.Head, q2);
  }

  setExpression(expr: Expression, amount: number) {
    // Faces belong to the people layer. The stand-in only drops or lifts the head a touch.
    this.exprTilt += (EXPR_HEAD[expr] ?? 0) * amount;
  }
  setBlink(c: number) { void c; }
  /** No jaw on these bodies: the head moves a touch with the voice (lifts on the stresses). */
  setMouth(o: number) { this.exprTilt -= o * 0.045; }

  endFrame() {
    this.applyFingers();
    if (this.exprTilt) {
      const axis = new this.T.Vector3(0, 1, 0).cross(this.dirOf(0, 0, 1)).normalize();
      rotateBoneWorld(this.T, this.person.bones.Head, new this.T.Quaternion().setFromAxisAngle(axis, this.exprTilt));
    }
    this.root.updateMatrixWorld(true);
  }

  dispose() { this.root.parent?.remove(this.root); }
}
