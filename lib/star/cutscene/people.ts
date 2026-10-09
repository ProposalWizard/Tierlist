/**
 * CUT-SCENE PEOPLE — the people layer every cut scene is built on.
 *
 * Harry, 9 Oct 2026: "build a foundation and system that will be translatable
 * for any cut scene … don't put limits." The director (lib/star/cutscene/
 * director*.ts, another builder's) drives timelines; this file is what it
 * drives. Everything is a TRACK with a weight that fades, so a script only
 * says what it wants and when:
 *
 *   const cast = await makeCast(T, scene);                 // loads the bodies + clips once
 *   const you = await cast.actor({ model: "player", skin, hair, kit, number });
 *   you.clips = [["idle", t, 1]];                         // body clips, by name
 *   you.expression("joy", 0.4);                           // face: named, blendable, fades
 *   you.look({ camera: true });                           // head + eyes (or an actor, a prop, a point)
 *   you.hand("R", "thumbsUp");                            // a hand-pose preset, per finger bone
 *   you.reach("L", point, { along, palm });               // an arm onto a point (2-bone IK)
 *   const pen = cast.prop("pen"); you.carry("R", pen, "write");   // a prop in the hand, at its grip
 *   you.aim("R", pen, "tip", paperPoint, { along, palm }); // put the pen's nib on a point
 *   you.grab("L", contract, "steady");                    // a hand onto a prop's grip
 *   cast.handshake(you, boss, { pump });                   // two right hands meet between two men
 *   cast.update(dt, camera);                               // once a frame: poses everything in order
 *
 * The body is the one the game uses (people3d.ts ONEBODY); only the head is
 * made ready for close-ups (face.ts), and only when Settings → Look →
 * "Cut-scene people" is New. Old = the person exactly as the 3D scenes make
 * them today (their own painted face, or the face picture).
 *
 * Every frame, in this order: clips → body extras (lean, hips) → legs → props
 * carried by a hand that is free → arm reaches and grabs (and the props they
 * carry) → fingers → head and eyes → face. A hand's reach always wins over
 * the clip, by its weight.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  loadPeople3d, makePerson3d, dressPerson3d, poseClips, poseFingers, mixFingers, fingerTip,
  type Person3D, type PersonModel, type PersonLook, type FingerPose, type WornThing,
} from "../people3d";
import { solveArm, setBoneWorldQuat, rotateBoneWorld, handWorldQuat, type HandAxes } from "../signing3dRig";
import { withMeshopt } from "../three3d/meshopt";
import { makeWalkClip } from "../walkClip";
import { addCutsceneFace, makeCutLight, makeToonRamp, mixFace, blendExpressions, EXPRESSIONS, NEUTRAL_FACE, setFaceColours, type CutLight, type ExpressionName, type FaceParams, type FaceRig } from "./face";
import { handPose, gripKind, type HandPoseName } from "./hands";
import { makeProp, type CutProp, type PropKind, type PropOptions, type Grip } from "./props";
import { cutscenePeopleLook, type CutscenePeopleLook } from "./look";

type Three = typeof import("three");
export type Side = "L" | "R";
export type { ExpressionName, FaceParams, HandPoseName, CutProp, PropKind, Grip };
export { EXPRESSIONS } from "./face";
export { HAND_POSE_NAMES } from "./hands";

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** A fading weight: goes to `to` over `fade` seconds. */
class Fader {
  v = 0; from = 0; to = 0; t = 1; dur = 0;
  set(to: number, fade: number) { this.from = this.v; this.to = to; this.t = 0; this.dur = Math.max(0, fade); if (this.dur === 0) { this.v = to; this.t = 1; } }
  step(dt: number) { if (this.t < 1) { this.t = Math.min(1, this.t + dt / Math.max(this.dur, 1e-4)); this.v = this.from + (this.to - this.from) * ease(this.t); } return this.v; }
}

// ── Look targets ──────────────────────────────────────────────────────────

/** What a head and eyes look at. */
export type LookTarget =
  | { camera: true }
  | { actor: Actor; part?: "eyes" | "hands" | "R" | "L" }
  | { prop: CutProp; point?: string }
  | { point: THREE.Vector3 }
  | { object: THREE.Object3D };

export interface LookOptions {
  /** How much the head turns (0 = eyes only) — default 0.8. */
  head?: number;
  /** Seconds to get there (default 0.35). */
  fade?: number;
}

// ── Reaches ───────────────────────────────────────────────────────────────

export interface ReachOptions {
  /** World direction the fingers point (default: from the shoulder to the point). */
  along?: THREE.Vector3;
  /** World direction the palm faces (default: down). */
  palm?: THREE.Vector3;
  /** Which way the elbow bends (world; default out and down). */
  pole?: THREE.Vector3;
  /** Seconds to blend in (default 0.3). */
  fade?: number;
  /** The hand pose to use while reaching (default: keep the current one). */
  pose?: HandPoseName;
  /** Worked out each frame instead (overrides along/palm/pole). */
  orient?: () => { along: THREE.Vector3; palm: THREE.Vector3; pole?: THREE.Vector3 };
}

interface ReachTrack {
  w: Fader;
  /** World point the hand's grip point goes to, its fingers and palm directions. */
  get: () => { at: THREE.Vector3; along: THREE.Vector3; palm: THREE.Vector3; pole: THREE.Vector3; prop?: { p: CutProp; grip: Grip; point: THREE.Vector3 } } | null;
  kind: "palm" | "pinch";
}

interface HandTrack { from: FingerPose; to: FingerPose; k: Fader; name: HandPoseName }

export interface ActorSpec {
  model: PersonModel;
  skin: string;
  hair?: string;
  /** Club colours (players). */
  kit?: { shirt: string; trim: string };
  number?: THREE.Texture | null;
  accessories?: WornThing[];
  /** Manager: grey hair 0 … 1, a beard 0 … 1. */
  grey?: number;
  beard?: number;
  iris?: string;
  /** Old look only: a face picture (never used by the New look: no photo faces in cut scenes). */
  face?: PersonLook["face"];
  faceSkin?: string;
  name?: string;
  /** The human body (Settings → Look → "3D body: Human"): who to build — height, build, hair, outfit … */
  human?: import("../human3d/human").HumanSpec;
}

// ── An actor ──────────────────────────────────────────────────────────────

export class Actor {
  readonly person: Person3D;
  readonly face: FaceRig | null;
  readonly root: THREE.Group;
  readonly name: string;
  /** Body clips this frame: [clip name, time (s), weight]. Set by the director. */
  clips: [string, number, number][] = [["idle", 0, 1]];
  /** Forward lean of the back (radians, + forward) and a turn of the chest (radians, + to his left). */
  lean = 0; twist = 0;
  /** Hips offset (metres, his own frame: x his left, y up, z forward) on top of the clip. */
  hips: [number, number, number] = [0, 0, 0];
  /** Mouth chatter while talking (no lip sync: the jaw moves on its own). */
  talking = false;
  /** Auto blink and small eye darts (on by default). */
  autoBlink = true;

  private T: Three;
  private cast: Cast;
  private hands: Record<Side, HandTrack>;
  private reaches: Record<Side, ReachTrack | null> = { L: null, R: null };
  private legs: Record<Side, { at: THREE.Vector3; pole: THREE.Vector3; w: Fader } | null> = { L: null, R: null };
  private exprFrom: FaceParams = { ...NEUTRAL_FACE };
  private exprTo: FaceParams = { ...NEUTRAL_FACE };
  private exprK = new Fader();
  private lookT: LookTarget | null = null;
  private lookW = new Fader();
  private lookHead = 0.8;
  private gazeNow: THREE.Vector3;
  private blinkT = 0; private nextBlink = 2; private blinkDur = 0.16; private blinkAmt = 0;
  private dartT = 0; private nextDart = 1; private dart: THREE.Vector2;
  private talkPh = 0;
  private time = 0;
  /** Rest pose → the Head bone's own frame (for eyes and look-at). */
  private restToHead: THREE.Matrix4;
  private eyeMid: THREE.Vector3;
  carried: Partial<Record<Side, { prop: CutProp; grip: Grip }>> = {};

  constructor(T: Three, cast: Cast, person: Person3D, face: FaceRig | null, name: string) {
    this.T = T; this.cast = cast; this.person = person; this.face = face; this.root = person.root; this.name = name;
    const relaxed = handPose("relaxed");
    const mk = (): HandTrack => { const k = new Fader(); k.v = 1; return { from: relaxed, to: relaxed, k, name: "relaxed" }; };
    this.hands = { L: mk(), R: mk() };
    this.gazeNow = new T.Vector3(0, 0, 1);
    this.dart = new T.Vector2();
    this.exprK.v = 1;
    const head = person.bones.Head;
    const hi = person.body.skeleton.bones.indexOf(head);
    this.restToHead = person.body.skeleton.boneInverses[hi].clone().multiply(person.body.bindMatrix);
    const lm = face?.lm;
    this.eyeMid = lm
      ? new T.Vector3((lm.eyes[0][0] + lm.eyes[1][0]) / 2, (lm.eyes[0][1] + lm.eyes[1][1]) / 2, lm.eyeZ - 0.01)
      : new T.Vector3(0, person.meta.face.eyeY, person.meta.face.frontZ - 0.03);
    this.nextBlink = 1 + Math.random() * 2.5;
  }

  // ── Face ──
  /** Go to an expression (a name, a blend of names, or raw numbers) over `fade` seconds. */
  expression(e: ExpressionName | Partial<Record<ExpressionName, number>> | FaceParams, fade = 0.35) {
    const target = typeof e === "string" ? EXPRESSIONS[e] : "smile" in e && "lid" in e ? (e as FaceParams) : blendExpressions(e as Partial<Record<ExpressionName, number>>);
    this.exprFrom = this.currentFace();
    this.exprTo = { ...target };
    this.exprK.set(0, 0); this.exprK.set(1, fade);
  }
  currentFace(): FaceParams { return mixFace(this.exprFrom, this.exprTo, this.exprK.v); }
  /** Blink now (the next auto blink is pushed back). */
  blink() { this.blinkT = 0; this.blinkAmt = 1; this.nextBlink = 2 + Math.random() * 3; }

  // ── Look ──
  look(target: LookTarget | null, o: LookOptions = {}) {
    const changed = target !== this.lookT;
    if (target) this.lookT = target;
    this.lookHead = o.head ?? 0.8;
    this.lookW.set(target ? 1 : 0, o.fade ?? 0.35);
    // A big change of target: people blink as their eyes jump.
    if (changed && target && this.autoBlink && Math.random() < 0.6) this.blink();
  }

  // ── Hands ──
  /** A hand-pose preset (or raw finger bends) over `fade` seconds. */
  hand(side: Side, pose: HandPoseName, fade = 0.2) {
    const h = this.hands[side];
    if (h.name === pose && h.k.to === 1) return;
    h.from = mixFingers(h.from, h.to, h.k.v);
    h.to = handPose(pose);
    h.name = pose;
    h.k.set(0, 0); h.k.set(1, fade);
  }
  handPose(side: Side): HandPoseName { return this.hands[side].name; }

  /** Put the hand's grip point on a world point (or a function of time), fingers and palm as given. Null lets go. */
  reach(side: Side, target: THREE.Vector3 | (() => THREE.Vector3) | null, o: ReachOptions = {}) {
    const T = this.T;
    if (!target) { if (this.reaches[side]) this.reaches[side]!.w.set(0, o.fade ?? 0.3); return; }
    if (o.pose) this.hand(side, o.pose, o.fade ?? 0.3);
    const prev = this.reaches[side];
    const w = prev?.w ?? new Fader();
    w.set(1, o.fade ?? 0.3);
    const sh = this.person.bones[side === "R" ? "RightArm" : "LeftArm"];
    this.reaches[side] = {
      w, kind: gripKind(this.hands[side].name),
      get: () => {
        const at = typeof target === "function" ? target() : target;
        const s = new T.Vector3(); sh.getWorldPosition(s);
        const or = o.orient?.();
        const along = or?.along ?? o.along?.clone() ?? at.clone().sub(s).normalize();
        const palm = or?.palm ?? o.palm?.clone() ?? new T.Vector3(0, -1, 0);
        return { at, along, palm, pole: or?.pole ?? o.pole ?? this.defaultPole(side) };
      },
    };
  }

  /** Put a hand on a prop's grip (the prop stays where the scene puts it). */
  grab(side: Side, prop: CutProp, grip: string, o: { fade?: number } = {}) {
    const T = this.T;
    const g = prop.grips[grip];
    if (!g) throw new Error(`${prop.kind} has no grip "${grip}"`);
    this.hand(side, g.pose, o.fade ?? 0.3);
    const prev = this.reaches[side];
    const w = prev?.w ?? new Fader();
    w.set(1, o.fade ?? 0.3);
    this.reaches[side] = {
      w, kind: gripKind(g.pose),
      get: () => {
        prop.obj.updateMatrixWorld(true);
        const m = prop.obj.matrixWorld;
        const at = new T.Vector3(...g.pos).applyMatrix4(m);
        const q = new T.Quaternion(); prop.obj.getWorldQuaternion(q);
        return { at, along: new T.Vector3(...g.along).applyQuaternion(q).normalize(), palm: new T.Vector3(...g.palm).applyQuaternion(q).normalize(), pole: this.defaultPole(side) };
      },
    };
  }

  /** Hold a prop in a hand: the prop follows the hand at that grip. */
  carry(side: Side, prop: CutProp, grip: string, fade = 0.2) {
    const g = prop.grips[grip];
    if (!g) throw new Error(`${prop.kind} has no grip "${grip}"`);
    this.carried[side] = { prop, grip: g };
    this.hand(side, g.pose, fade);
    if (prop.obj.parent !== this.cast.scene) this.cast.scene.add(prop.obj);
  }
  /** Let go of what that hand carries (it stays where it was). */
  drop(side: Side) { delete this.carried[side]; }

  /**
   * Move the hand so a point on the prop it carries lands on `target` — the
   * pen's nib on the paper, the trophy's top over his head — with the hand
   * turned as given (world fingers/palm directions).
   */
  aim(side: Side, prop: CutProp, point: string, target: THREE.Vector3 | (() => THREE.Vector3), o: ReachOptions & { along: THREE.Vector3; palm: THREE.Vector3 }) {
    const c = this.carried[side];
    if (!c || c.prop !== prop) this.carry(side, prop, Object.keys(prop.grips).find((k) => prop.grips[k] === c?.grip) ?? Object.keys(prop.grips)[0]);
    const T = this.T;
    const prev = this.reaches[side];
    const w = prev?.w ?? new Fader();
    w.set(1, o.fade ?? 0.3);
    const grip = this.carried[side]!.grip;
    this.reaches[side] = {
      w, kind: gripKind(grip.pose),
      get: () => ({
        at: (typeof target === "function" ? target() : target).clone(), along: o.along.clone(), palm: o.palm.clone(), pole: o.pole ?? this.defaultPole(side),
        prop: { p: prop, grip, point: new T.Vector3(...prop.points[point]) },
      }),
    };
  }

  /** A foot onto a world point (knee towards `pole`); null lets the clip have it back. */
  foot(side: Side, at: THREE.Vector3 | null, pole?: THREE.Vector3, fade = 0.3) {
    if (!at) { this.legs[side]?.w.set(0, fade); return; }
    const w = this.legs[side]?.w ?? new Fader();
    w.set(1, fade);
    this.legs[side] = { at, pole: pole ?? this.fwd(), w };
  }

  // ── Helpers ──
  /** His forward direction (world). */
  fwd(): THREE.Vector3 { const q = new this.T.Quaternion(); this.root.getWorldQuaternion(q); return new this.T.Vector3(0, 0, 1).applyQuaternion(q); }
  /** His left (world). */
  left(): THREE.Vector3 { const q = new this.T.Quaternion(); this.root.getWorldQuaternion(q); return new this.T.Vector3(1, 0, 0).applyQuaternion(q); }
  /** A point in his own frame (x his left, y up, z forward, from his feet) → world. */
  at(x: number, y: number, z: number): THREE.Vector3 { this.root.updateMatrixWorld(true); return new this.T.Vector3(x, y, z).applyMatrix4(this.root.matrixWorld); }
  /** A direction in his own frame → world. */
  dir(x: number, y: number, z: number): THREE.Vector3 { const q = new this.T.Quaternion(); this.root.getWorldQuaternion(q); return new this.T.Vector3(x, y, z).applyQuaternion(q).normalize(); }
  /** World position of a bone. */
  bone(name: string): THREE.Vector3 { const v = new this.T.Vector3(); this.person.bones[name].getWorldPosition(v); return v; }
  /** Where his eyes are (world). */
  eyes(): THREE.Vector3 { const m = new this.T.Matrix4().multiplyMatrices(this.person.bones.Head.matrixWorld, this.restToHead); return this.eyeMid.clone().applyMatrix4(m); }
  /** The grip point of a hand now (world): its palm centre or its pinch. */
  gripPoint(side: Side): THREE.Vector3 { return this.handGrip(side, gripKind(this.hands[side].name)); }

  private defaultPole(side: Side) { return this.dir(side === "L" ? 0.7 : -0.7, -0.6, -0.3); }

  private handFrame(side: Side): HandAxes {
    const h = this.person.hand[side];
    return { along: h.along, palm: h.palm, side: new this.T.Vector3().crossVectors(h.along, h.palm).normalize() };
  }

  private handGrip(side: Side, kind: "palm" | "pinch"): THREE.Vector3 {
    const T = this.T;
    const hb = this.person.bones[side === "R" ? "RightHand" : "LeftHand"];
    hb.updateMatrixWorld(true);
    if (kind === "pinch" && this.person.fingers) {
      const a = fingerTip(T, this.person, side, "index")!, b = fingerTip(T, this.person, side, "thumb")!;
      return a.add(b).multiplyScalar(0.5);
    }
    const h = this.person.hand[side];
    const q = new T.Quaternion(); hb.getWorldQuaternion(q);
    const w = new T.Vector3(); hb.getWorldPosition(w);
    return w.addScaledVector(h.along.clone().applyQuaternion(q), h.len * 0.5).addScaledVector(h.palm.clone().applyQuaternion(q), 0.022);
  }

  /** The prop's world transform for a hand holding it at `grip` (hand already posed). */
  propPose(side: Side, grip: Grip): { pos: THREE.Vector3; quat: THREE.Quaternion } {
    const T = this.T;
    const hb = this.person.bones[side === "R" ? "RightHand" : "LeftHand"];
    const hq = new T.Quaternion(); hb.getWorldQuaternion(hq);
    const h = this.person.hand[side];
    const G = this.handGrip(side, gripKind(grip.pose));
    let quat: THREE.Quaternion;
    if (grip.axis && this.person.fingers) {
      // Along the line from the pinch back over the web of the thumb.
      const f = this.person.fingers[side];
      const mi = new T.Vector3(), mt = new T.Vector3();
      f.index.bones[0].getWorldPosition(mi); f.thumb.bones[1].getWorldPosition(mt);
      const palm = h.palm.clone().applyQuaternion(hq);
      const web = mi.add(mt).multiplyScalar(0.5).addScaledVector(palm, -0.035);
      const axisUp = web.sub(G).normalize(); // towards the cap (prop +y)
      const zz = palm.clone().negate().sub(axisUp.clone().multiplyScalar(palm.clone().negate().dot(axisUp))).normalize();
      const xx = new T.Vector3().crossVectors(axisUp, zz);
      quat = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(xx, axisUp, zz));
    } else {
      const A = h.along.clone().applyQuaternion(hq), P = h.palm.clone().applyQuaternion(hq);
      const S = new T.Vector3().crossVectors(A, P);
      const ga = new T.Vector3(...grip.along).normalize();
      const gp = new T.Vector3(...grip.palm); gp.sub(ga.clone().multiplyScalar(gp.dot(ga))).normalize();
      const gs = new T.Vector3().crossVectors(ga, gp);
      const mw = new T.Matrix4().makeBasis(A, P, S);
      const ml = new T.Matrix4().makeBasis(ga, gp, gs).transpose();
      quat = new T.Quaternion().setFromRotationMatrix(mw.multiply(ml));
    }
    const pos = G.clone().sub(new T.Vector3(...grip.pos).applyQuaternion(quat));
    return { pos, quat };
  }

  // ── The frame ──
  /** @internal Called by Cast.update: clips and body. */
  _poseBody(dt: number) {
    const T = this.T, p = this.person;
    this.time += dt;
    poseClips(p, this.clips);
    if (this.hips[0] || this.hips[1] || this.hips[2]) {
      const hb = p.bones.Hips;
      hb.position.x += this.hips[0] / p.unit; hb.position.y += this.hips[1] / p.unit; hb.position.z += this.hips[2] / p.unit;
      hb.updateMatrixWorld(true);
    }
    if (this.lean || this.twist) {
      const ax = new T.Vector3().crossVectors(this.dir(0, 1, 0), this.fwd()).normalize().negate();
      const up = new T.Vector3(0, 1, 0);
      for (const b of ["Spine", "Spine01", "Spine02"]) {
        if (!p.bones[b]) continue;
        rotateBoneWorld(T, p.bones[b], new T.Quaternion().setFromAxisAngle(ax, -this.lean / 3));
        if (this.twist) rotateBoneWorld(T, p.bones[b], new T.Quaternion().setFromAxisAngle(up, this.twist / 3));
      }
    }
    for (const side of ["L", "R"] as Side[]) {
      const L = this.legs[side];
      if (!L) continue;
      const w = L.w.step(dt);
      if (w <= 0.001) continue;
      const pre = side === "R" ? "Right" : "Left";
      solveArm(T, p.bones[`${pre}UpLeg`], p.bones[`${pre}Leg`], p.bones[`${pre}Foot`], L.at, L.pole, w);
    }
    // Fingers first: a pinch's grip point depends on them.
    for (const side of ["L", "R"] as Side[]) {
      const h = this.hands[side];
      poseFingers(T, p, side, mixFingers(h.from, h.to, h.k.step(dt)));
    }
  }

  /** @internal Arms: reaches, grabs and aims; carried props follow. */
  _poseArms(dt: number) {
    const T = this.T, p = this.person;
    for (const side of ["L", "R"] as Side[]) {
      const r = this.reaches[side];
      const pre = side === "R" ? "Right" : "Left";
      if (r) {
        const w = r.w.step(dt);
        if (w <= 0.001 && r.w.to === 0) this.reaches[side] = null;
        const g = w > 0.001 ? r.get() : null;
        if (g) {
          const up = p.bones[`${pre}Arm`], lo = p.bones[`${pre}ForeArm`], hb = p.bones[`${pre}Hand`];
          const ax = this.handFrame(side);
          const qHand = handWorldQuat(T, ax, g.along, g.palm);
          // The grip point in the hand's own frame (with the fingers as posed now).
          const hq = new T.Quaternion(); hb.getWorldQuaternion(hq);
          const W0 = new T.Vector3(); hb.getWorldPosition(W0);
          const kind = g.prop ? gripKind(g.prop.grip.pose) : r.kind;
          let off = this.handGrip(side, kind).sub(W0).applyQuaternion(hq.clone().invert());
          let at = g.at.clone();
          if (g.prop) {
            // Where the prop sits relative to the hand (measured in the hand's frame), so its point lands on `at`.
            const pp = this.propPose(side, g.prop.grip);
            const ptW = g.prop.point.clone().applyQuaternion(pp.quat).add(pp.pos);
            const rel = ptW.sub(W0).applyQuaternion(hq.clone().invert());
            off = rel;
            at = g.at.clone();
          }
          const wrist = at.sub(off.applyQuaternion(qHand));
          const q0 = hb.quaternion.clone();
          solveArm(T, up, lo, hb, wrist, g.pole, w);
          const qa = hb.quaternion.clone();
          setBoneWorldQuat(T, hb, qHand);
          if (w < 1) { hb.quaternion.copy(qa.slerp(hb.quaternion.clone(), w)); hb.updateMatrixWorld(true); }
          void q0;
        }
      }
      const c = this.carried[side];
      if (c) {
        const pp = this.propPose(side, c.grip);
        c.prop.obj.position.copy(pp.pos);
        c.prop.obj.quaternion.copy(pp.quat);
        c.prop.obj.updateMatrixWorld(true);
      }
    }
  }

  /** @internal Head, eyes, face. */
  _poseHead(dt: number, camera: THREE.Camera | null) {
    const T = this.T, p = this.person;
    const lw = this.lookW.step(dt);
    const headB = p.bones.Head, neck = p.bones.neck;
    const target = this.lookT ? this.targetPoint(this.lookT, camera) : null;
    if (target && lw > 0.001) {
      // The head's facing now, from its rest facing.
      const toW = new T.Matrix4().multiplyMatrices(headB.matrixWorld, this.restToHead);
      const eye = this.eyeMid.clone().applyMatrix4(toW);
      const cur = new T.Vector3(0, 0, 1).transformDirection(toW);
      const want = target.clone().sub(eye).normalize();
      let ang = cur.angleTo(want);
      const max = 1.1;
      if (ang > max) { const ax = new T.Vector3().crossVectors(cur, want).normalize(); want.copy(cur).applyAxisAngle(ax, max); ang = max; }
      const q = new T.Quaternion().setFromUnitVectors(cur, want);
      const k = lw * this.lookHead;
      const qn = new T.Quaternion().slerp(q, k * 0.4);
      rotateBoneWorld(T, neck, qn);
      headB.updateMatrixWorld(true);
      const toW2 = new T.Matrix4().multiplyMatrices(headB.matrixWorld, this.restToHead);
      const cur2 = new T.Vector3(0, 0, 1).transformDirection(toW2);
      const q2 = new T.Quaternion().setFromUnitVectors(cur2, want);
      rotateBoneWorld(T, headB, new T.Quaternion().slerp(q2, Math.min(1, k * 0.62 / Math.max(1e-3, 1 - k * 0.4))));
    }
    if (!this.face) return;
    // Eyes: the gaze in the head's rest frame (parallel, never crossed).
    headB.updateMatrixWorld(true);
    const toW = new T.Matrix4().multiplyMatrices(headB.matrixWorld, this.restToHead);
    const g = new T.Vector3(0, 0, 1);
    if (target && lw > 0.001) {
      const eye = this.eyeMid.clone().applyMatrix4(toW);
      const d = target.clone().sub(eye);
      if (d.length() < 0.6) d.setLength(0.6);
      const local = d.add(eye).applyMatrix4(toW.clone().invert()).sub(this.eyeMid).normalize();
      g.lerp(local, lw).normalize();
    }
    // Small darts.
    if (this.autoBlink) {
      this.dartT += dt;
      if (this.dartT > this.nextDart) {
        this.dartT = 0; this.nextDart = 0.5 + Math.random() * 1.6;
        this.dart.set((Math.random() - 0.5) * 0.07, (Math.random() - 0.5) * 0.04);
      }
    }
    const yaw = Math.max(-0.45, Math.min(0.45, Math.atan2(g.x, g.z) + this.dart.x));
    const pitch = Math.max(-0.35, Math.min(0.3, Math.asin(Math.max(-1, Math.min(1, g.y))) + this.dart.y));
    const want = new T.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    this.gazeNow.lerp(want, 1 - Math.exp(-dt * 30)).normalize();
    this.face.gaze.copy(this.gazeNow);
    // Blink.
    if (this.autoBlink) {
      this.blinkT += dt;
      if (this.blinkT > this.nextBlink && this.blinkAmt <= 0) { this.blinkAmt = 1; this.blinkT = 0; this.nextBlink = 2 + Math.random() * 3.5; this.blinkDur = 0.14 + Math.random() * 0.06; }
    }
    let blink = 0;
    if (this.blinkAmt > 0) {
      const t = this.blinkT / this.blinkDur;
      blink = t < 0.4 ? t / 0.4 : t < 0.55 ? 1 : Math.max(0, 1 - (t - 0.55) / 0.45);
      if (t >= 1) { this.blinkAmt = 0; blink = 0; if (Math.random() < 0.12) { this.blinkAmt = 1; this.blinkT = -0.08; } }
    }
    // Face.
    const f = this.currentFace();
    this.exprK.step(dt);
    if (this.talking) {
      this.talkPh += dt;
      const s = Math.sin(this.talkPh * 13) * 0.5 + Math.sin(this.talkPh * 7.3 + 1) * 0.5;
      f.open = Math.max(f.open, 0.08 + 0.17 * Math.max(0, s));
    }
    this.face.params = f;
    this.face.apply(camera, blink);
  }

  private targetPoint(t: LookTarget, camera: THREE.Camera | null): THREE.Vector3 | null {
    const T = this.T;
    if ("camera" in t) { if (!camera) return null; const v = new T.Vector3(); camera.getWorldPosition(v); return v; }
    if ("actor" in t) {
      if (t.part === "R" || t.part === "L") return t.actor.gripPoint(t.part);
      if (t.part === "hands") return t.actor.gripPoint("R").add(t.actor.gripPoint("L")).multiplyScalar(0.5);
      return t.actor.eyes();
    }
    if ("prop" in t) { t.prop.obj.updateMatrixWorld(true); return new T.Vector3(...(t.point ? t.prop.points[t.point] : [0, 0, 0])).applyMatrix4(t.prop.obj.matrixWorld); }
    if ("point" in t) return t.point.clone();
    const v = new T.Vector3(); t.object.getWorldPosition(v); return v;
  }

  dispose() { this.face?.dispose(); }
}

// ── The cast: everyone in a scene, loaded once ─────────────────────────────

export interface Handshake {
  a: Actor; b: Actor;
  /** Height of the meeting point (default 1.08 m). */
  y: number;
  /** Up-down pumping (0 … 1). */
  pump: number;
  w: Fader;
}

export class Cast {
  readonly T: Three;
  readonly scene: THREE.Scene;
  readonly light: CutLight;
  readonly ramp: THREE.Texture;
  look: CutscenePeopleLook;
  actors: Actor[] = [];
  props: CutProp[] = [];
  private shakes: Handshake[] = [];
  private anims: GLTF;
  private loader: { loadAsync(u: string): Promise<unknown> };
  private SkeletonUtils: { clone(o: THREE.Object3D): THREE.Object3D };
  private time = 0;

  constructor(T: Three, scene: THREE.Scene, anims: GLTF, loader: { loadAsync(u: string): Promise<unknown> }, SU: { clone(o: THREE.Object3D): THREE.Object3D }, look: CutscenePeopleLook) {
    this.T = T; this.scene = scene; this.anims = anims; this.loader = loader; this.SkeletonUtils = SU; this.look = look;
    this.light = makeCutLight(T);
    this.ramp = makeToonRamp(T);
  }

  /** A person, dressed, in the scene. */
  async actor(spec: ActorSpec, opts: { outline?: number } = {}): Promise<Actor> {
    const T = this.T;
    const model = await loadPeople3d(this.loader, spec.model, "new");
    const p = makePerson3d(T, this.SkeletonUtils, model, this.anims, { outline: opts.outline ?? 0.003, outlineNear: 1.6, human: spec.human });
    const isNew = this.look === "new";
    dressPerson3d(T, p, {
      skin: spec.skin, hair: spec.hair, kit: spec.kit, number: spec.number ?? null, accessories: spec.accessories, grey: spec.grey,
      face: isNew ? null : spec.face ?? null, faceSkin: spec.faceSkin,
    });
    let face: FaceRig | null = null;
    // The human body has its own head (eyes, brows, painted lips); the old heads get the cut-scene face.
    if (isNew && !Array.isArray(p.body.material)) {
      const hair = spec.model === "manager"
        ? "#" + new T.Color(spec.hair ?? "#3a2a20").lerp(new T.Color("#c9c9c9"), spec.grey ?? 0.6).getHexString()
        : spec.hair;
      face = addCutsceneFace(T, p, { skin: spec.skin, hair, iris: spec.iris, beard: spec.beard, light: this.light, ramp: this.ramp });
    }
    // Clips everyone has: a walk made from the jog.
    if (p.actions.jog && p.actions.idle && !p.actions.walk) {
      const clip = makeWalkClip(T, p.actions.jog.getClip(), p.actions.idle.getClip());
      clip.name = "walk";
      const a = p.mixer.clipAction(clip); a.play(); a.setEffectiveWeight(0); p.actions.walk = a;
    }
    this.scene.add(p.root);
    const a = new Actor(T, this, p, face, spec.name ?? spec.model);
    this.actors.push(a);
    return a;
  }

  /** Add a set of clips to an actor by file (e.g. the football moves): the names stay the same when the clips are replaced. */
  async addClips(a: Actor, url: string) {
    const g = (await (this.loader as { loadAsync(u: string): Promise<GLTF> }).loadAsync(url)) as GLTF;
    const p = a.person;
    const k = p.hipsRest.y / ((g.scene.userData as { hipsY?: number }).hipsY || p.hipsRest.y);
    for (const clip of g.animations) {
      if (p.actions[clip.name]) continue;
      const c = clip.clone();
      for (const tr of c.tracks) if (tr.name.endsWith(".position")) { const v = tr.values.slice(); for (let i = 0; i < v.length; i++) v[i] *= k; tr.values = v; }
      const act = p.mixer.clipAction(c); act.play(); act.setEffectiveWeight(0); p.actions[clip.name] = act;
    }
  }

  prop(kind: PropKind, o: Omit<PropOptions, "ramp"> = {}): CutProp {
    const pr = makeProp(this.T, kind, { ...o, ramp: this.ramp });
    this.scene.add(pr.obj);
    this.props.push(pr);
    return pr;
  }

  /** Two right hands meet between two men, palm to palm, thumbs up; `pump` shakes them. Null `b` stops it. */
  handshake(a: Actor, b: Actor | null, o: { y?: number; pump?: number; fade?: number } = {}) {
    let s = this.shakes.find((x) => x.a === a);
    if (!b) { if (s) { s.w.set(0, o.fade ?? 0.3); a.reach("R", null, { fade: o.fade }); s.b.reach("R", null, { fade: o.fade }); } return; }
    if (!s) { s = { a, b, y: 1.08, pump: 0, w: new Fader() }; this.shakes.push(s); }
    s.y = o.y ?? s.y; s.pump = o.pump ?? s.pump;
    s.w.set(1, o.fade ?? 0.35);
    const sh = s;
    const T = this.T;
    const meet = () => {
      const ra = a.bone("RightArm"), rb = b.bone("RightArm");
      const m = ra.add(rb).multiplyScalar(0.5);
      m.y = sh.y + Math.sin(this.time * Math.PI * 2 * 2.2) * 0.022 * sh.pump;
      return m;
    };
    for (const [me, other] of [[a, b], [b, a]] as const) {
      me.hand("R", "shake", o.fade ?? 0.35);
      me.reach("R", () => {
        const m = meet();
        const to = other.bone("Hips").sub(me.bone("Hips")); to.y = 0; to.normalize();
        // My palm faces his: to my left of the line between us (right hands).
        const left = new T.Vector3(-to.z, 0, to.x);
        return m.addScaledVector(left, 0.022).addScaledVector(to, -0.012);
      }, {
        fade: o.fade ?? 0.35,
        orient: () => {
          // Fingers forward and a touch down, palm towards the other man.
          const to = other.bone("Hips").sub(me.bone("Hips")); to.y = 0; to.normalize();
          const left = new T.Vector3(-to.z, 0, to.x);
          return {
            along: to.clone().add(new T.Vector3(0, -0.15, 0)).normalize(),
            palm: left.clone().negate(),
            pole: left.clone().multiplyScalar(0.3).add(new T.Vector3(0, -1, 0)).add(to.clone().multiplyScalar(-0.3)).normalize(),
          };
        },
      });
    }
  }

  /** Once a frame, after the director has set clips, roots and tracks. */
  update(dt: number, camera: THREE.Camera | null) {
    this.time += dt;
    for (const s of this.shakes) s.w.step(dt);
    for (const a of this.actors) { a.root.updateMatrixWorld(true); a._poseBody(dt); }
    for (const a of this.actors) a._poseArms(dt);
    for (const a of this.actors) a._poseHead(dt, camera);
    if (camera) camera.updateMatrixWorld();
  }

  /** Take every actor, prop and handshake out (the cast can be filled again). */
  clear() {
    for (const a of this.actors) { a.dispose(); this.scene.remove(a.root); }
    for (const p of this.props) { p.dispose(); p.obj.parent?.remove(p.obj); }
    this.actors = []; this.props = []; this.shakes = [];
  }

  /** New actors from now on use this look (New: the cut-scene face; Old: as the 3D scenes are today). */
  setLook(look: CutscenePeopleLook) { this.look = look; }

  dispose() { this.clear(); this.ramp.dispose(); }
}

/** Load the people's clips and make a cast for a scene. `look` defaults to Settings → Look → "Cut-scene people". */
export async function makeCast(T: Three, scene: THREE.Scene, o: { look?: CutscenePeopleLook } = {}): Promise<Cast> {
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const loader = await withMeshopt(new GLTFLoader());
  const anims = await loadPeople3d(loader, "anims");
  return new Cast(T, scene, anims, loader, SkeletonUtils, o.look ?? cutscenePeopleLook());
}

export { setFaceColours };
