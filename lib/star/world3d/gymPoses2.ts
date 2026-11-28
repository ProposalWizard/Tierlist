/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE GYM'S TEN NEW EXERCISES IN 3D (gym phase 2; Harry, 28 Nov 2026: "we need to make sure that things like
 * hands actually attach to the bars, we're not phasing through"). One Exercise2 per person (you, and the
 * team-mate on his own bot thumb): it puts the body where the exercise is done and poses it from the game's
 * state every frame, on top of the idle clip, with the gym's own two-bone reach (./gymPose.ts). No new clips.
 *
 * CONTACT, MEASURED, NOT GUESSED. Every hand and foot that touches something is MOVED until its skin is on it:
 *   - a hand on a bar (pull-up bar, the squat bar): the fingers closed round it and the arm moved until the
 *     middle of the closed hand is on the bar's line (the bench's method, gymPlace.ts gripBar);
 *   - a hand, forearm, foot or knee on the floor, a mat, the box or the bench: the lowest skin point of that
 *     part (body and clothes: trainers are cloth) put on the surface, the limb's target moved by what is left
 *     over, three times;
 *   - a flat foot keeps the turn it had stood up, so its sole stays flat.
 * The numbers (`contact`: the worst gap or overlap of each contact this go, in cm; `pierce`: the deepest any
 * other skin went into the floor, a bar, the box or the bench) go to the test page's debug readout and the proof.
 *
 * The exercises and where they are (GYM2 below): pull-ups on a free-standing bar by the east wall; the back
 * squat in the power rack with the rack's bar on his back; push-ups and the plank on the first mat; Nordic
 * curls (an ankle roller at the end) and the mobility flow on the second mat; box jumps and the Copenhagen
 * plank on a plyo box; the agility ladder on the floor by the south wall; landing balance on a round pad.
 */
import { PoseBlend, ease } from "./gymPose";
import { poseFingers, fingersDeg, fingerTip, relaxHands } from "../people3d";
import type { Npc } from "./npc";
import type { Gym2Kind, Gym2State } from "../gym/games2";
import { pushupDepth, PULLUP, SQUAT, BOXJUMP, LANDING, COPEN, mobilityPath } from "../gym/games2";

type V3 = any;

/** Where each of the new pieces of kit stands (m). The room (gymPlace.ts) builds them from these. */
export const GYM2 = {
  /** Mats: A (push-ups, plank) and B (Nordic, mobility); top of a mat. */
  matA: { x: 0.6, z: 1.5 }, matB: { x: 0.6, z: 2.5 }, matTop: 0.025,
  /** The free-standing pull-up bar: along x, its middle, height, radius. */
  pull: { x: 4.2, z: 2.0, y: 2.35, half: 0.55, r: 0.016 },
  /** The power rack's bar (the squat): where it rests on the hooks. */
  rack: { x: 0.3, z: -2.6, y: 1.36, r: 0.016 },
  /** The plyo box (box jumps, the Copenhagen plank): middle, half size, height by level. */
  box: { x: 2.2, z: 0.75, half: 0.25, h: [0.5, 0.58, 0.66] as const },
  /** The Copenhagen's floor mat (east of the box). */
  copenMat: { x: 3.35, z: 0.75 },
  /** The agility ladder: along x, at z, from x0 to x1, its squares. */
  ladder: { z: 2.95, x0: 2.0, x1: 4.0, squares: 5 },
  /** The landing pad. */
  pad: { x: 3.1, z: 1.55, r: 0.38 },
  /** The Nordic ankle roller (mat B's west end) and where the knees go. */
  nordic: { rollerX: -0.2, kneeX: 0.25 },
};

/** Where he starts (the room's stand point is where he walked to; this is the exercise's own spot). */
export function spot2(kind: Gym2Kind): { x: number; z: number; yaw: number } {
  const G = GYM2;
  switch (kind) {
    case "pullup": return { x: G.pull.x, z: G.pull.z + 0.55, yaw: Math.PI };
    case "squat": return { x: G.rack.x, z: G.rack.z + 0.75, yaw: Math.PI };
    case "pushup": case "plank": return { x: G.matA.x + 0.9, z: G.matA.z + 0.6, yaw: -Math.PI / 2 };
    case "nordic": case "mobility": return { x: G.matB.x - 0.2, z: G.matB.z + 0.6, yaw: Math.PI / 2 };
    case "boxjump": return { x: G.box.x, z: G.box.z + 0.65, yaw: Math.PI };
    case "copenhagen": return { x: G.copenMat.x + 0.2, z: G.copenMat.z + 0.6, yaw: -Math.PI / 2 };
    case "ladder": return { x: G.ladder.x0 - 0.3, z: G.ladder.z, yaw: Math.PI / 2 };
    case "landing": return { x: G.pad.x, z: G.pad.z + 0.6, yaw: Math.PI };
  }
}

/** The camera for this exercise (eye, look-at). */
export function shot2(kind: Gym2Kind, g: Gym2State | null): { cam: [number, number, number]; look: [number, number, number] } {
  const G = GYM2;
  // a portrait phone is narrow: each shot ~3 m off and a little high, a body lying along x filmed along its length
  switch (kind) {
    case "pullup": return { cam: [2.5, 2.2, -0.3], look: [G.pull.x, 1.6, G.pull.z] };
    case "squat": return { cam: [2.3, 1.9, -0.3], look: [G.rack.x, 0.95, G.rack.z + 0.3] };
    case "pushup": case "plank": return { cam: [-2.3, 2.1, 2.9], look: [G.matA.x + 0.15, 0.25, G.matA.z] };
    case "nordic": return { cam: [2.9, 2.2, 0.4], look: [G.matB.x - 0.2, 0.45, G.matB.z] };
    case "mobility": return { cam: [2.9, 2.2, 0.4], look: [G.matB.x, 0.6, G.matB.z] };
    case "boxjump": return { cam: [-0.1, 2.15, 3.3], look: [G.box.x, 1.0, G.box.z + 0.3] };
    case "copenhagen": {
      const side = g?.kind === "copenhagen" ? g.side : 0;
      return side ? { cam: [4.7, 1.9, -1.5], look: [G.copenMat.x - 0.35, 0.3, G.copenMat.z] } : { cam: [2.9, 1.8, 3.5], look: [G.copenMat.x - 0.3, 0.35, G.copenMat.z] };
    }
    case "ladder": return { cam: [0.6, 2.2, 1.2], look: [(G.ladder.x0 + G.ladder.x1) / 2, 0.4, G.ladder.z] };
    case "landing": return { cam: [1.3, 2.1, -0.6], look: [G.pad.x, 0.85, G.pad.z] };
  }
}


const GRIP = fingersDeg({ thumb: [18, 28, 25], index: [39, 49, 28], middle: [41, 50, 28], ring: [43, 52, 28], little: [46, 53, 28], thumbSwing: 28 });
const FLAT = fingersDeg({ thumb: [5, 5, 5], index: [6, 4, 3], middle: [6, 4, 3], ring: [6, 4, 3], little: [6, 4, 3], thumbSwing: 30 });
const FIST = fingersDeg({ thumb: [20, 30, 30], index: [70, 80, 50], middle: [72, 82, 50], ring: [74, 84, 50], little: [76, 86, 50], thumbSwing: 20 });

type Part = "LH" | "RH" | "LF" | "RF" | "LA" | "RA" | "LS" | "RS" | "T";
const PART_OF = (bone: string): Part | null => {
  if (/^LeftHand/.test(bone)) return "LH";
  if (/^RightHand/.test(bone)) return "RH";
  if (/^Left(Foot|Toe)/.test(bone)) return "LF";
  if (/^Right(Foot|Toe)/.test(bone)) return "RF";
  if (/^LeftForeArm/.test(bone)) return "LA";
  if (/^RightForeArm/.test(bone)) return "RA";
  if (/^LeftLeg/.test(bone)) return "LS";
  if (/^RightLeg/.test(bone)) return "RS";
  if (/^(Hips|Spine|neck|Head|Left(Shoulder|Arm|UpLeg)|Right(Shoulder|Arm|UpLeg))/.test(bone)) return "T";
  return null;
};

/** His skin, sorted by body part once (body and clothes), so a contact reads only its own few hundred points. */
class Skin {
  parts = new Map<Part, { m: any; idx: number[] }[]>();
  private v: V3;
  constructor(private T: any, person: any) {
    this.v = new T.Vector3();
    const meshes = [person.body, person.body.parent?.getObjectByName?.("Cloth")].filter(Boolean);
    for (const m of meshes) {
      const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      if (!si || !sw || !m.skeleton) continue;
      const lists = new Map<Part, number[]>();
      for (let i = 0; i < m.geometry.attributes.position.count; i++) {
        let bi = 0, bw = -1;
        for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; bi = si.getComponent(i, k); } }
        const p = PART_OF(m.skeleton.bones[bi]?.name ?? "");
        if (!p) continue;
        if (p === "T" && i % 3) continue; // the torso: every third point is plenty
        (lists.get(p) ?? lists.set(p, []).get(p)!).push(i);
      }
      lists.forEach((idx, p) => (this.parts.get(p) ?? this.parts.set(p, []).get(p)!).push({ m, idx }));
    }
  }
  each(p: Part, f: (v: V3) => void) {
    for (const { m, idx } of this.parts.get(p) ?? []) for (const i of idx) { m.getVertexPosition(i, this.v); this.v.applyMatrix4(m.matrixWorld); f(this.v); }
  }
  minY(p: Part): number { let y = Infinity; this.each(p, (v) => { if (v.y < y) y = v.y; }); return y; }
  /** The lowest point of a part inside a box on the floor plan (a foot on the box's top, not its edge). */
  minYIn(p: Part, x0: number, x1: number, z0: number, z1: number): number { let y = Infinity; this.each(p, (v) => { if (v.x >= x0 && v.x <= x1 && v.z >= z0 && v.z <= z1 && v.y < y) y = v.y; }); return y; }
}

export interface Contact2 { /** Worst |gap| of each contact this go (cm). */ contact: Record<string, number>; /** Deepest skin into anything this go (cm). */ pierce: Record<string, number> }

export class Exercise2 {
  kind: Gym2Kind | null = null;
  private pose: PoseBlend;
  private skin: Skin | null = null;
  private v: Record<string, V3>;
  private q: Record<string, any>;
  /** Stood up straight (measured at set-up): ankle above the sole, hips and shoulders above the floor, limb lengths. */
  private m = { ankle: 0.08, hipY: 0.95, shY: 1.45, arm: 0.55, upper: 0.29, fore: 0.26, thigh: 0.45, shin: 0.43, hipLocal: null as V3, footQ: { L: null as any, R: null as any } };
  private st: any = {};
  stats: Contact2 = { contact: {}, pierce: {} };
  private n = 0;

  constructor(private T: any, private you: Npc, private room: { props: any }) {
    this.pose = new PoseBlend(T);
    this.v = {};
    for (const k of ["a", "b", "c", "d", "e", "f", "g", "h", "up", "fw", "rt", "t", "p"]) this.v[k] = new T.Vector3();
    this.q = { a: new T.Quaternion(), b: new T.Quaternion(), m: new T.Matrix4() };
  }

  /** Before the clip poses the next frame: put back every bone turned. */
  restore() { this.pose.restore(); }

  private bones() { return this.you.person.bones; }
  private rec(kind: "contact" | "pierce", name: string, cm: number) {
    const v = +Math.abs(cm).toFixed(2);
    const s = this.stats[kind];
    if (!(name in s) || v > s[name]) s[name] = v;
  }

  // ── set up: measure him stood up, then stand him at the exercise ──
  /** `inPlace`: measure him where he stands (a team-mate on his routine, already stood at the spot in his idle). */
  setUp(kind: Gym2Kind, inPlace = false) {
    const you = this.you, T = this.T, b = this.bones();
    this.kind = kind; this.stats = { contact: {}, pierce: {} }; this.n = 0; this.st = {};
    this.skin ??= new Skin(T, you.person);
    const r = you.person.root;
    const keep = { x: r.position.x, y: r.position.y, z: r.position.z, yaw: you.yaw };
    if (!inPlace) {
      you.act({ clip: "idle" }, 1e9);
      you.place(0, 0, 0); you.y = 0;
      you.update(0, { grid: null as any, book: null as any, bodies: () => [] } as any, true);
    }
    // measured stood at the origin facing +z (the clip's pose as it is now)
    r.position.set(0, 0, 0); r.rotation.order = "YXZ"; r.rotation.set(0, 0, 0);
    r.updateMatrixWorld(true);
    const w = (n: string) => b[n].getWorldPosition(new T.Vector3());
    const sole = Math.min(this.skin.minY("LF"), this.skin.minY("RF"));
    this.m.ankle = w("LeftFoot").y - sole;
    this.m.hipY = w("Hips").y - sole;
    this.m.hipLocal = w("Hips").sub(new T.Vector3(0, sole, 0));
    this.m.shY = w("LeftArm").y - sole;
    this.m.upper = w("LeftArm").distanceTo(w("LeftForeArm"));
    this.m.fore = w("LeftForeArm").distanceTo(w("LeftHand"));
    this.m.arm = this.m.upper + this.m.fore;
    this.m.thigh = w("LeftUpLeg").distanceTo(w("LeftLeg"));
    this.m.shin = w("LeftLeg").distanceTo(w("LeftFoot"));
    this.m.footQ = { L: b.LeftFoot.getWorldQuaternion(new T.Quaternion()), R: b.RightFoot.getWorldQuaternion(new T.Quaternion()) };
    this.st.feet = { L: w("LeftFoot"), R: w("RightFoot") }; // at yaw 0, standing at the origin
    // which way each palm faces from its knuckles (stood up, palms face the thighs: towards the middle)
    for (const side of ["Left", "Right"] as const) {
      const s = side === "Left" ? "L" : "R", rig = you.person.fingers?.[s];
      if (!rig) continue;
      const n = this.palmCross(side);
      const inward = new T.Vector3(side === "Left" ? -1 : 1, 0, 0); // his left is +x stood at yaw 0
      this.st[`palm${s}`] = n && n.dot(inward) < 0 ? -1 : 1;
    }
    if (inPlace) { r.position.set(keep.x, keep.y, keep.z); r.rotation.set(0, keep.yaw, 0); r.updateMatrixWorld(true); }
  }

  tearDown() {
    const p = this.you.person;
    p.root.rotation.order = "XYZ"; p.root.rotation.x = 0; p.root.rotation.z = 0;
    relaxHands(this.T, p);
    this.kind = null;
  }

  // ── helpers ──
  /** Stand him upright at (x, y, z) facing yaw. */
  private upright(x: number, y: number, z: number, yaw: number) {
    const you = this.you, r = you.person.root;
    you.x = x; you.z = z; you.y = y; you.yaw = yaw;
    r.position.set(x, y, z); r.rotation.order = "YXZ"; r.rotation.set(0, yaw, 0);
    r.updateMatrixWorld(true);
  }
  /** Lay him along a line: `up` from his feet to his head, `left` his left side (both world). Root at `pos` (his soles). */
  private orient(pos: V3, up: V3, left: V3) {
    const T = this.T, you = this.you, r = you.person.root;
    const u = up.clone().normalize();
    const f = new T.Vector3().crossVectors(left, u).normalize();
    const l = new T.Vector3().crossVectors(u, f).normalize();
    this.q.m.makeBasis(l, u, f);
    r.quaternion.setFromRotationMatrix(this.q.m);
    r.position.copy(pos);
    you.x = pos.x; you.z = pos.z; you.y = pos.y;
    r.updateMatrixWorld(true);
  }
  private world(name: string, out?: V3) { return this.bones()[name].getWorldPosition(out ?? new this.T.Vector3()); }
  /** His right (world, flat) and front, from his shoulders and the root's facing. */
  private frame() {
    const T = this.T, r = this.you.person.root;
    const f = new T.Vector3(0, 0, 1).applyQuaternion(r.quaternion), u = new T.Vector3(0, 1, 0).applyQuaternion(r.quaternion), l = new T.Vector3(1, 0, 0).applyQuaternion(r.quaternion);
    return { f, u, l };
  }
  private limb(side: "Left" | "Right", leg: boolean) {
    const b = this.bones();
    return leg ? [b[`${side}UpLeg`], b[`${side}Leg`], b[`${side}Foot`]] : [b[`${side}Arm`], b[`${side}ForeArm`], b[`${side}Hand`]];
  }
  private reach(side: "Left" | "Right", leg: boolean, t: V3, pole: V3, w = 1) { const [a, b, c] = this.limb(side, leg); this.pose.reach(a, b, c, t, pole, w); }
  /** Keep a foot flat as it stood (turned to this yaw). */
  private flatFoot(side: "Left" | "Right", yaw: number) {
    const q = this.q.a.setFromAxisAngle(this.v.up.set(0, 1, 0), yaw).multiply(this.m.footQ[side === "Left" ? "L" : "R"]);
    this.pose.setWorld(this.bones()[`${side}Foot`], q);
  }
  /**
   * A foot planted flat on a surface at height y: the leg reached so the ankle is there, the foot turned flat,
   * then the sole's lowest point measured and the ankle moved by what is left (three goes).
   */
  private plant(side: "Left" | "Right", at: V3, y: number, pole: V3, yaw: number, name: string, check = true) {
    const t = this.v.t.copy(at); t.y = y + this.m.ankle;
    const part: Part = side === "Left" ? "LF" : "RF";
    for (let k = 0; k < 5; k++) {
      this.reach(side, true, t, pole);
      this.flatFoot(side, yaw);
      if (!this.skin) break;
      const err = y - this.skin.minY(part);
      if (Math.abs(err) < 0.0015) break;
      t.y += err;
    }
    if (check && this.skin) this.rec("contact", name, (this.skin.minY(part) - y) * 100);
  }
  /** A kneeling foot: laid back along the floor behind the shin, toes pointing back, sole up. */
  private footBack(side: "Left" | "Right") {
    const T = this.T, q0 = this.m.footQ[side === "Left" ? "L" : "R"];
    // stood: toes +z, sole down. Wanted: toes -x (behind him as he faces east), sole up
    const R = this.q.m.makeBasis(new T.Vector3(0, 0, -1), new T.Vector3(0, -1, 0), new T.Vector3(-1, 0, 0));
    const q = new T.Quaternion().setFromRotationMatrix(R).multiply(q0);
    this.pose.setWorld(this.bones()[`${side}Foot`], q);
  }
  /** Any limb's end (hand, foot) moved until a part's lowest skin is on the surface y. */
  private onSurface(side: "Left" | "Right", leg: boolean, part: Part | Part[], t0: V3, y: number, pole: V3, name: string, after?: () => void) {
    const t = this.v.p.copy(t0);
    const parts = Array.isArray(part) ? part : [part];
    const low = () => Math.min(...parts.map((p) => this.skin!.minY(p)));
    for (let k = 0; k < 6; k++) {
      this.reach(side, leg, t, pole);
      after?.();
      if (!this.skin) break;
      const err = y - low();
      if (Math.abs(err) < 0.001) break;
      t.y += err;
    }
    if (this.skin && this.n % 6 === 0) this.rec("contact", name, (low() - y) * 100);
  }
  /** The hand's palm side, unsigned: square to the knuckles' line and the fingers' line. */
  private palmCross(side: "Left" | "Right"): V3 | null {
    const T = this.T, p = this.you.person, s = side === "Left" ? "L" : "R", hand = this.bones()[`${side}Hand`], rig = p.fingers?.[s];
    if (!rig || !hand) return null;
    const H = hand.getWorldPosition(new T.Vector3()), M = rig.middle.bones[0].getWorldPosition(new T.Vector3());
    const I = rig.index.bones[0].getWorldPosition(new T.Vector3()), Lt = rig.little.bones[0].getWorldPosition(new T.Vector3());
    return new T.Vector3().crossVectors(I.sub(Lt), M.sub(H)).normalize();
  }
  /** Hand flat, fingers along `fwd`, palm down. */
  private flatHand(side: "Left" | "Right", fwd: V3, fingers = FLAT) {
    const T = this.T, p = this.you.person, s = side === "Left" ? "L" : "R", hand = this.bones()[`${side}Hand`], rig = p.fingers?.[s];
    if (!rig || !hand) return;
    poseFingers(T, p, s, fingers);
    const H = hand.getWorldPosition(new T.Vector3()), M = rig.middle.bones[0].getWorldPosition(new T.Vector3());
    this.pose.rotWorld(hand, this.q.b.setFromUnitVectors(M.sub(H).normalize(), fwd.clone().normalize()));
    // roll round the fingers' line until the palm faces down (its side measured stood up: palmCross × the sign)
    const f = fwd.clone().normalize();
    const n0 = this.palmCross(side);
    if (!n0) return;
    const curl = n0.multiplyScalar(this.st[`palm${s}`] ?? 1); curl.addScaledVector(f, -curl.dot(f));
    if (curl.lengthSq() < 1e-8) return;
    curl.normalize();
    const down = new T.Vector3(0, -1, 0).addScaledVector(f, -f.y).normalize();
    const ang = Math.atan2(new T.Vector3().crossVectors(curl, down).dot(f), curl.dot(down));
    this.pose.turn(hand, f, ang);
  }
  /**
   * A hand closed round a bar along the world x line through `bar`: fingers up past it, palm towards `palm`,
   * the arm moved until the middle of the closed hand is on the bar's line (gymPlace.ts gripBar, generalised).
   */
  private gripBar(side: "Left" | "Right", bar: V3, pole: V3, palm: V3, name: string) {
    const T = this.T, p = this.you.person, s = side === "Left" ? "L" : "R", hand = this.bones()[`${side}Hand`], rig = p.fingers?.[s];
    if (!rig || !hand) { this.reach(side, false, bar, pole); return; }
    poseFingers(T, p, s, GRIP);
    const aim = hand.getWorldPosition(new T.Vector3());
    const up = this.v.up.set(0, 1, 0);
    let gap = 9;
    for (let k = 0; k < 8; k++) {
      // fingers straight up (wrist to middle knuckle)
      const H = hand.getWorldPosition(new T.Vector3()), M = rig.middle.bones[0].getWorldPosition(new T.Vector3());
      this.pose.rotWorld(hand, this.q.b.setFromUnitVectors(M.sub(H).normalize(), up));
      // then round the vertical until the curl (the palm's side) faces `palm`
      const g0 = this.gripPoint(s);
      if (g0) {
        const now = Math.atan2(g0.pw.x, g0.pw.z), want = Math.atan2(palm.x, palm.z);
        this.pose.turn(hand, up, want - now);
      }
      const g = this.gripPoint(s);
      if (!g) return;
      const dy = bar.y - g.at.y, dz = bar.z - g.at.z;
      gap = Math.hypot(dy, dz);
      if (k === 7 || gap < 0.002) break;
      aim.y += dy; aim.z += dz;
      this.pose.reach(this.bones()[`${side}Arm`], this.bones()[`${side}ForeArm`], hand, aim, pole, 1);
    }
    if (this.n % 6 === 0) this.rec("contact", name, gap * 100);
  }
  private gripPoint(s: "L" | "R") {
    const T = this.T, p = this.you.person, rig = p.fingers?.[s];
    const tip = fingerTip(T, p, s, "middle");
    if (!rig || !tip) return null;
    const m = rig.middle.bones[0].getWorldPosition(new T.Vector3());
    const pw = new T.Vector3(tip.x - m.x, 0, tip.z - m.z).normalize();
    return { at: m.addScaledVector(pw, 0.03), pw };
  }
  /** Spine bend round a world axis, shared over the three spine bones. */
  private bend(axis: V3, angle: number) {
    const b = this.bones();
    for (const n of ["Spine", "Spine01", "Spine02"]) if (b[n]) this.pose.turn(b[n], axis, angle / 3);
  }
  /** The deepest non-hand skin into a bar along x through `c` (radius r), over |x - c.x| < half. */
  private barPierce(c: V3, r: number, half: number, name: string) {
    if (!this.skin) return;
    let deep = 0, who = "";
    for (const p of ["T", "LA", "RA", "LS", "RS", "LF", "RF"] as Part[]) this.skin.each(p, (v) => { if (Math.abs(v.x - c.x) > half) return; const d = r - Math.hypot(v.y - c.y, v.z - c.z); if (d > deep) { deep = d; who = p; } });
    this.rec("pierce", name, deep * 100);
    if (deep > 0.005) this.stats.pierce[`${name} [${who}]`] = Math.max(this.stats.pierce[`${name} [${who}]`] ?? 0, +(deep * 100).toFixed(2));
  }
  /** The deepest skin below a floor or mat (y) inside a floor box, over the given parts. */
  private floorPierce(y: number, name: string, parts: Part[] = ["T", "LA", "RA", "LS", "RS", "LF", "RF", "LH", "RH"], box?: [number, number, number, number]) {
    if (!this.skin) return;
    let deep = 0, who = "";
    for (const p of parts) this.skin.each(p, (v) => { if (box && (v.x < box[0] || v.x > box[1] || v.z < box[2] || v.z > box[3])) return; if (y - v.y > deep) { deep = y - v.y; who = p; } });
    this.rec("pierce", name, deep * 100);
    if (deep > 0.005) this.stats.pierce[`${name} [${who}]`] = Math.max(this.stats.pierce[`${name} [${who}]`] ?? 0, +(deep * 100).toFixed(2));
  }
  /** The deepest skin inside a solid box [x0,x1, y0,y1, z0,z1]. */
  private boxPierce(bx: number[], name: string, parts: Part[] = ["T", "LA", "RA", "LS", "RS", "LF", "RF", "LH", "RH"]) {
    if (!this.skin) return;
    let deep = 0;
    for (const p of parts) this.skin.each(p, (v) => {
      if (v.x < bx[0] || v.x > bx[1] || v.y < bx[2] || v.y > bx[3] || v.z < bx[4] || v.z > bx[5]) return;
      deep = Math.max(deep, Math.min(v.x - bx[0], bx[1] - v.x, v.y - bx[2], bx[3] - v.y, v.z - bx[4], bx[5] - v.z));
    });
    this.rec("pierce", name, deep * 100);
  }

  /** Where he does it, and the camera on it (spot2, shot2). */
  spot(kind: Gym2Kind) { return spot2(kind); }
  shot(kind: Gym2Kind, g: Gym2State | null) { return shot2(kind, g); }

  /** The props this exercise moves (the squat bar, the box's height), before the body is posed. */
  props(g: Gym2State, live: boolean) {
    const P = this.room.props;
    if (P.box) P.box.scale.y = GYM2.box.h[g.kind === "boxjump" ? g.height : 0] / GYM2.box.h[0];
    if (!live && P.rackBar) P.rackBar.position.set(GYM2.rack.x, GYM2.rack.y, GYM2.rack.z);
  }

  /** Pose him for this frame (after the clip). `t` = seconds into the count-in (blends him in). */
  apply(g: Gym2State, phase: "count" | "play" | "end", t: number, dt: number) {
    this.n++;
    switch (g.kind) {
      case "pullup": return this.pullup(g);
      case "squat": return this.squat(g);
      case "pushup": return this.prone(g, pushupDepth(g), false);
      case "plank": return this.prone(g, 0, true);
      case "nordic": return this.nordic(g);
      case "copenhagen": return this.copen(g);
      case "boxjump": return this.boxjump(g);
      case "ladder": return this.ladder(g, dt);
      case "landing": return this.landing(g);
      case "mobility": return this.mobility(g, phase === "count" ? Math.min(1, t / 0.8) : 1);
    }
  }

  // ── pull-ups: hanging from the bar by both hands, chin over it at the top ──
  private pullup(g: Extract<Gym2State, { kind: "pullup" }>) {
    const T = this.T, G = GYM2.pull, m = this.m;
    // bottom: arms nearly straight; top: shoulders 12 cm under the bar (the chin over it). Dropped: down to the floor.
    const hang = G.y - 0.07 - m.arm * 0.96 - m.shY, top = G.y - 0.12 - m.shY;
    const k = ease(g.y);
    let y = hang + (top - hang) * k;
    if (g.dropped) y = Math.max(0, hang - Math.min(1, g.flash.age / 0.35) * hang);
    // behind the bar by more at the top, so his face passes behind it (the bar in front of his face)
    const z = G.z + 0.07 + 0.16 * k;
    this.upright(G.x, y, z, Math.PI);
    const { f, l } = this.frame();
    // knees bent, ankles crossed behind (off the floor)
    const hip = this.world("Hips");
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const ft = this.v.a.copy(hip).addScaledVector(this.v.up.set(0, 1, 0), -(m.thigh + m.shin) * 0.82).addScaledVector(f, -0.32).addScaledVector(l, -sx * 0.03);
      if (g.dropped) { ft.copy(hip).addScaledVector(l, sx * 0.1); ft.y = Math.max(m.ankle, hip.y - m.thigh - m.shin + 0.02); }
      const pole = this.v.b.copy(hip).addScaledVector(f, 0.8).addScaledVector(l, sx * 0.1);
      this.reach(side, true, ft, pole);
    }
    if (g.dropped) {
      const age = g.flash.age;
      if (age > 0.3) { for (const side of ["Left", "Right"] as const) this.plant(side, this.world(`${side}Foot`, this.v.c), 0, this.v.d.copy(this.world("Hips")).addScaledVector(f, 0.8), Math.PI, "pull-up: feet on the floor after the drop", false); }
      return;
    }
    // hands on the bar, shoulder width and a bit, palms facing away (an overhand grip); elbows out and down
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const bar = this.v.c.set(G.x + sx * 0.3 * (l.x > 0 ? 1 : -1), G.y, G.z);
      const pole = this.v.d.copy(bar).addScaledVector(l, sx * 0.55).add(this.v.up.set(0, -0.9, 0)).addScaledVector(f, 0.1);
      this.gripBar(side, bar, pole, f, "pull-up: hands on the bar");
    }
    if (this.n % 12 === 0) { this.barPierce(this.v.e.set(G.x, G.y, G.z), G.r, G.half, "pull-up: nothing else through the bar"); this.floorPierce(0, "pull-up: nothing through the floor"); }
  }

  // ── the back squat: the rack's bar across his upper back, hands on it, sitting down between his heels ──
  private squat(g: Extract<Gym2State, { kind: "squat" }>) {
    const T = this.T, R = GYM2.rack, m = this.m, P = this.room.props;

    // where his feet were set (shoulder width, a touch turned out), in front of the rack's hooks
    const fx = 0.15;
    const z0 = R.z + 0.2;
    const d = g.d; // 0 stood up, ~0.72 parallel, 1 stuck in the hole
    const drop = d * 0.62 * m.hipY / 0.95, back = d * 0.22;
    this.upright(R.x, -drop, z0 + back, Math.PI);
    const { f, l } = this.frame();
    // the torso leans forward over his feet as he sits
    this.bend(l, d * 0.6);
    const hip = this.world("Hips");
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const at = this.v.a.set(R.x + sx * fx * (l.x > 0 ? 1 : -1), 0, z0 - 0.02);
      const pole = this.v.b.copy(at).addScaledVector(f, 0.9).addScaledVector(l, sx * 0.25).setY(hip.y);
      this.plant(side, at, 0, pole, Math.PI + sx * 0.12 * (l.x > 0 ? -1 : 1) * 0, "squat: feet flat on the floor", this.n % 6 === 0);
    }
    // the bar on his back: fixed to his upper spine where it was set (measured at the first frame: on the skin)
    const sp2 = this.bones().Spine02 ?? this.bones().Spine01;
    if (!this.st.barLocal) this.st.barLocal = this.seatBar(sp2);
    const bar = sp2.localToWorld(this.v.c.copy(this.st.barLocal));
    if (P.rackBar) { P.rackBar.position.copy(bar); P.rackBar.updateMatrixWorld(); }
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const at = this.v.d.set(bar.x + sx * 0.4 * (l.x > 0 ? 1 : -1), bar.y, bar.z);
      const pole = this.v.e.copy(at).addScaledVector(l, sx * 0.25).addScaledVector(f, -0.55).add(this.v.up.set(0, -0.6, 0));
      this.gripBar(side, at, pole, f, "squat: hands on the bar");
    }
    if (this.n % 12 === 0) { this.barPierce(bar, R.r, 0.9, "squat: the bar on his back, not in it"); this.floorPierce(0, "squat: nothing through the floor"); }
    void T;
  }
  /** Find where the bar sits on his traps: from behind his shoulders, moved in until it touches skin (no deeper). */
  private seatBar(sp2: any) {
    const T = this.T, { f } = this.frame();
    const mid = this.world("LeftArm").add(this.world("RightArm")).multiplyScalar(0.5);
    const neck = this.world("neck");
    const c = new T.Vector3();
    let best = null as V3;
    for (let k = 0; k <= 30; k++) {
      // start 18 cm behind and come forward a cm at a time; height between the shoulders and the neck
      c.copy(mid).addScaledVector(f, -0.18 + k * 0.01); c.y = mid.y + (neck.y - mid.y) * 0.35;
      let near = Infinity;
      this.skin?.each("T", (v) => { if (Math.abs(v.x - c.x) > 0.25) return; const dd = Math.hypot(v.y - c.y, v.z - c.z); if (dd < near) near = dd; });
      if (near <= GYM2.rack.r + 0.004) { best = c.clone(); break; }
    }
    best ??= c.copy(mid).addScaledVector(f, -0.09);
    return sp2.worldToLocal(best.clone());
  }

  // ── push-ups and the plank: face down along mat A, toes on the mat ──
  private prone(g: Gym2State, depth: number, plank: boolean) {
    const T = this.T, A = GYM2.matA, top = GYM2.matTop, m = this.m;
    // incline: arms straight (push-up top), chest a hand above the mat (bottom), elbows under shoulders (plank)
    const toeX = A.x + 0.82;
    const bodyLen = m.shY - 0.03;
    const shTop = top + m.arm * 0.9 + 0.03, shLow = top + 0.25, shPlank = top + m.upper + 0.105;
    let sh = plank ? shPlank : shTop + (shLow - shTop) * depth;
    let tremor = 0;
    if (g.kind === "plank") { sh -= g.sag * 0.07 + (g.strikes && g.flash.what === "collapse" && g.flash.age < 0.5 ? 0.06 * (1 - g.flash.age * 2) : 0); tremor = Math.sin(g.t * 57) * g.shake * 0.004; }
    if (g.kind === "pushup" && g.flat) sh = top + 0.13;
    // the incline found in two goes: lay him, put the toes on the mat, see where the shoulders came out, correct
    let a = Math.asin(Math.max(0.02, Math.min(0.9, (sh - top) / bodyLen)));
    const left = this.v.rt.set(0, 0, 1); // lying face down, head to the west: his left is to the south
    for (let k = 0; k < 3; k++) {
      const up = this.v.up.set(-Math.cos(a), Math.sin(a), 0);
      this.orient(this.v.a.set(toeX, top + tremor, A.z), up, left);
      // toes on the mat: lift or lower him by what the lowest toe says
      const toe = Math.min(this.skin!.minY("LF"), this.skin!.minY("RF"));
      this.you.person.root.position.y += top - toe; this.you.y = this.you.person.root.position.y; this.you.person.root.updateMatrixWorld(true);
      const shNow = (this.world("LeftArm").y + this.world("RightArm").y) / 2;
      if (k === 2 || Math.abs(shNow - sh) < 0.003) break;
      a = Math.asin(Math.max(0.02, Math.min(0.9, Math.sin(a) + (sh - shNow) / bodyLen)));
    }
    const { f, l } = this.frame();
    const fwdW = this.v.fw.set(-1, 0, 0);
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const shp = this.world(`${side}Arm`);
      if (plank) {
        // forearm flat forward from an elbow under the shoulder; a loose fist
        const wrist = this.v.b.set(shp.x - m.fore * 0.98, top + 0.035, shp.z + l.z * sx * -0.03);
        const pole = this.v.c.set(shp.x + 0.15, top - 0.5, shp.z + l.z * sx * 0.05);
        this.onSurface(side, false, side === "Left" ? ["LA", "LH"] : ["RA", "RH"], wrist, top, pole, "plank: forearms on the mat", () => this.flatHand(side, fwdW, FIST));
      } else {
        // hands flat under the shoulders, a little wider, fingers forward; elbows back and out
        const hand = this.v.b.set(shp.x - 0.04, top + 0.03, shp.z + l.z * sx * 0.1);
        const pole = this.v.c.copy(hand).add(this.v.d.set(0.45, 0.3, l.z * sx * 0.35));
        this.onSurface(side, false, side === "Left" ? "LH" : "RH", hand, top, pole, "push-up: hands flat on the mat", () => this.flatHand(side, fwdW));
      }
    }
    this.rec("contact", plank ? "plank: toes on the mat" : "push-up: toes on the mat", (Math.min(this.skin!.minY("LF"), this.skin!.minY("RF")) - top) * 100);
    if (this.n % 12 === 0) this.floorPierce(top, plank ? "plank: nothing through the mat" : "push-up: nothing through the mat");
    void T; void f;
  }

  // ── Nordic curls: kneeling on mat B, ankles under the roller, falling forward from the knees ──
  private nordic(g: Extract<Gym2State, { kind: "nordic" }>) {
    const T = this.T, B = GYM2.matB, N = GYM2.nordic, top = GYM2.matTop, m = this.m;
    const phi = ease(g.a) * 1.3; // 0 upright, ~75° at the bottom
    const knee = this.v.a.set(N.kneeX, top + 0.065, B.z);
    const up = this.v.up.set(Math.sin(phi), Math.cos(phi), 0);
    const left = this.v.rt.set(0, 0, -1); // facing east: his left is to the north
    // the hips on the thigh's line above the knee; the root (his soles, stood up) placed from them
    const hip = this.v.b.copy(knee).addScaledVector(up, m.thigh);
    this.orient(this.v.c.set(0, 0, 0), up, left);
    const r = this.you.person.root;
    const hipNow = this.world("Hips");
    r.position.add(this.v.d.subVectors(hip, hipNow)); this.you.x = r.position.x; this.you.y = r.position.y; this.you.z = r.position.z; r.updateMatrixWorld(true);
    const { f, l } = this.frame();
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const kz = knee.z + l.z * sx * 0.1;
      // the shin flat on the mat behind the knee, the ankle under the roller
      const ft = this.v.e.set(knee.x - m.shin * 0.99, top + 0.07, kz);
      const pole = this.v.f.set(knee.x + 0.6, knee.y - 0.2, kz);
      this.onSurface(side, true, side === "Left" ? "LS" : "RS", ft, top, pole, "Nordic: shins on the mat", () => this.footBack(side));
    }
    // the roller sits on his ankles (measured once, on his skin)
    if (!this.st.roller && this.skin) {
      let yTop = -Infinity;
      this.skin.each("LF", (v) => { if (Math.abs(v.x - (N.rollerX)) < 0.06 && v.y > yTop) yTop = v.y; });
      this.st.roller = isFinite(yTop) ? yTop : top + 0.12;
      if (this.room.props.roller) { this.room.props.roller.position.y = this.st.roller + 0.045 + 0.004; this.room.props.roller.updateMatrixWorld(); }
    }
    // hands: crossed on the chest, then out to catch the mat as he goes
    const catchW = Math.max(0, Math.min(1, (g.a - 0.45) / 0.4));
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const sh = this.world(`${side}Arm`);
      const chest = this.v.e.copy(sh).addScaledVector(f, 0.16).addScaledVector(l, -sx * 0.16).addScaledVector(up, -0.12);
      const floor = this.v.f.set(knee.x + 1.05, top + 0.03, knee.z + l.z * sx * 0.25);
      const target = chest.lerp(floor, ease(catchW));
      const pole = this.v.g.copy(sh).addScaledVector(l, sx * 0.4).addScaledVector(up, -0.4);
      if (catchW > 0.98) this.onSurface(side, false, side === "Left" ? "LH" : "RH", target, top, pole, "Nordic: hands catch the mat", () => this.flatHand(side, this.v.fw.set(1, 0, 0)));
      else { this.reach(side, false, target, pole); if (catchW > 0) this.flatHand(side, this.v.fw.set(1, 0, 0)); }
    }
    if (this.n % 12 === 0) { this.floorPierce(top, "Nordic: nothing through the mat"); this.boxPierce([N.rollerX - 0.05, N.rollerX + 0.05, (this.st.roller ?? 0.12) + 0.006, (this.st.roller ?? 0.12) + 0.09, B.z - 0.35, B.z + 0.35], "Nordic: nothing through the roller"); }
    void T;
  }

  // ── the Copenhagen plank: on his side, the top ankle on the box, the elbow on the mat ──
  private copen(g: Extract<Gym2State, { kind: "copenhagen" }>) {
    const T = this.T, X = GYM2.box, M = GYM2.copenMat, top = GYM2.matTop, m = this.m;
    const side = g.side; // 0: left side down, facing south; 1: right side down, facing north
    const boxTop = X.h[0];
    const ankle = this.v.a.set(X.x + X.half - 0.09, boxTop + 0.045, X.z);
    const shoulder = this.v.b.set(ankle.x + m.shY - m.ankle - 0.08, top + m.upper + 0.16 + 0.17, X.z);
    // the sag: hips lower than the straight line (the game's h: 0.7 straight; lower = sagging)
    const sag = Math.max(0, 0.72 - g.h) * 0.16;
    const up = this.v.up.subVectors(shoulder, ankle).normalize();
    const downSide = side === 0 ? 1 : -1; // left side down: his left is the world's down
    const left = this.v.rt.set(0, -downSide, 0);
    // the root (his soles' middle) a hip's half-width from the top ankle, towards the floor
    const pos = this.v.c.copy(ankle).addScaledVector(up, -m.ankle).add(this.v.d.set(0, -0.1, 0)).add(this.v.e.set(0, -sag, 0));
    this.orient(pos, up, left);
    const { f, l } = this.frame();
    const topLeg = side === 0 ? "Right" : "Left", lowLeg = side === 0 ? "Left" : "Right";
    // top leg: straight, the inside of the ankle on the box top
    const pole1 = this.v.f.copy(ankle).addScaledVector(up, 0.5).addScaledVector(f, 0.5);
    this.onSurface(topLeg, true, topLeg === "Left" ? "LF" : "RF", ankle, boxTop, pole1, "Copenhagen: ankle on the box");
    // bottom leg: bent under, the foot by the box's foot, off the mat or on it
    const lowFoot = this.v.g.set(X.x + X.half + 0.16, 0, X.z + f.z * 0.05);
    const pole2 = this.v.h.copy(lowFoot).addScaledVector(up, 0.35).addScaledVector(f, 0.6);
    this.onSurface(lowLeg, true, lowLeg === "Left" ? "LF" : "RF", lowFoot, 0, pole2, "Copenhagen: lower foot on the floor");
    // lower arm: elbow under the shoulder, forearm along the mat in front; top arm: hand on the hip
    const lowArm = side === 0 ? "Left" : "Right", topArm = side === 0 ? "Right" : "Left";
    const sh = this.world(`${lowArm}Arm`);
    const wrist = this.v.e.set(sh.x - 0.02, top + 0.035, sh.z).addScaledVector(f, m.fore * 0.97);
    const pole3 = this.v.f.set(sh.x + 0.1, sh.y - 0.2, sh.z).addScaledVector(f, -0.45);
    this.onSurface(lowArm, false, lowArm === "Left" ? ["LA", "LH"] : ["RA", "RH"], wrist, top, pole3, "Copenhagen: forearm on the mat", () => this.flatHand(lowArm, f, FIST));
    const hipTop = this.world(`${topLeg}UpLeg`).addScaledVector(l, -downSide * 0.1).addScaledVector(up, 0.06);
    const pole4 = this.v.g.copy(hipTop).addScaledVector(up, 0.35).addScaledVector(f, -0.4).add(this.v.h.set(0, 0.3, 0));
    this.reach(topArm, false, hipTop, pole4);
    if (this.n % 12 === 0) {
      this.floorPierce(top, "Copenhagen: nothing through the mat", undefined, [M.x - 0.5, M.x + 0.5, M.z - 0.3, M.z + 0.3]);
      this.floorPierce(0, "Copenhagen: nothing through the floor");
      this.boxPierce([X.x - X.half, X.x + X.half, 0, boxTop, X.z - X.half, X.z + X.half], "Copenhagen: nothing through the box");
    }
    void T;
  }

  // ── box jumps: crouch with the swing, jump onto the box, step down ──
  private boxjump(g: Extract<Gym2State, { kind: "boxjump" }>) {
    const X = GYM2.box, m = this.m;
    const H = X.h[g.height] ?? X.h[0];
    const z0 = X.z + X.half + 0.42, z1 = X.z;
    let y = 0, z = z0, crouch = 0, onBox = false, air = false;
    const clip = g.flash.what === "clip";
    if (g.phase === "ready") { crouch = 0.05 + g.needle * 0.16; }
    else if (g.phase === "air") {
      const k = Math.min(1, g.phaseT / BOXJUMP.air);
      if (clip) { z = z0 - 0.18 * Math.sin(k * Math.PI); y = 0.22 * Math.sin(k * Math.PI); crouch = k > 0.8 ? 0.2 : 0.05; air = k < 0.85; }
      else {
        const peak = H + 0.18 + 0.12 * g.power;
        z = z0 + (z1 - z0) * ease(k);
        y = k < 0.82 ? Math.sin(Math.min(1, k / 0.82) * Math.PI / 2) * peak - Math.max(0, (k - 0.5) / 0.32) ** 2 * (peak - H) : H;
        air = k < 0.82; onBox = k >= 0.82; crouch = onBox ? 0.18 * (1 - (k - 0.82) / 0.18) + 0.05 : 0.02;
      }
    } else if (g.phase === "down") {
      const k = Math.min(1, g.phaseT / BOXJUMP.down);
      if (clip) { z = z0 - 0.0; y = 0; crouch = 0.15 * (1 - k); }
      else if (k < 0.35) { z = z1; y = H; onBox = true; crouch = 0.04; }
      else { const kk = (k - 0.35) / 0.65; z = z1 + (z0 - z1) * ease(kk); y = H * (1 - ease(kk)); air = kk > 0.05 && kk < 0.9; crouch = kk > 0.9 ? 0.1 : 0.02; }
    }
    this.upright(X.x, y - crouch * m.hipY, z, Math.PI);
    const { f, l } = this.frame();
    this.bend(l, crouch * 1.4);
    const hip = this.world("Hips");
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const fx = X.x + sx * 0.12 * (l.x > 0 ? 1 : -1);
      const pole = this.v.b.set(fx, hip.y, z).addScaledVector(f, 0.9);
      if (air) {
        const ft = this.v.a.set(fx, hip.y - (m.thigh + m.shin) * 0.7, z + 0.08);
        this.reach(side, true, ft, pole); this.flatFoot(side, Math.PI);
      } else this.plant(side, this.v.a.set(fx, 0, z - 0.02), onBox ? H : 0, pole, Math.PI, onBox ? "box jump: feet on the box" : "box jump: feet on the floor", this.n % 6 === 0);
    }
    if (this.n % 12 === 0) this.boxPierce([X.x - X.half, X.x + X.half, 0, H, X.z - X.half, X.z + X.half], "box jump: nothing through the box");
  }

  // ── the agility ladder: quick feet, a foot into each square, up the ladder and back ──
  private ladder(g: Extract<Gym2State, { kind: "ladder" }>, dt: number) {
    const Lr = GYM2.ladder, m = this.m;
    const len = Lr.x1 - Lr.x0, sq = len / Lr.squares;
    // each step taken moves him half a square (eased over the step); up the ladder and back (a turn at each end)
    const since = Math.min(1, g.flash.what === "hit" || g.flash.what === "perfect" ? g.flash.age / 0.16 : 1);
    const at = Math.max(0, g.hit - 1 + ease(since));
    const span = len - 0.5, s = (at * sq / 2) % (2 * span), fwd = s < span;
    const x = Lr.x0 + 0.25 + (fwd ? s : 2 * span - s);
    const yaw = fwd ? Math.PI / 2 : -Math.PI / 2;
    const bob = g.tripped ? 0 : 0.03 * Math.abs(Math.sin(g.t * 9));
    this.upright(Math.min(Lr.x1 - 0.2, Math.max(Lr.x0 + 0.2, x)), -0.06 + bob, Lr.z, yaw);
    const { f, l } = this.frame();
    this.bend(l, 0.25);
    const hip = this.world("Hips");
    // in-in: the lead foot to this square's half, the other follows; the foot that just moved lifts and lands
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const lead = (g.hit % 2 === 0) === (side === "Left");
      const fz = Lr.z + l.z * sx * 0.11;
      const fxw = this.you.x + f.x * (lead ? 0.12 : -0.08);
      const lift = lead && since < 1 ? Math.sin(since * Math.PI) * 0.1 : 0;
      const pole = this.v.b.set(fxw, hip.y, fz).addScaledVector(f, 0.9);
      if (lift > 0.005) { this.reach(side, true, this.v.a.set(fxw, lift + m.ankle, fz), pole); this.flatFoot(side, yaw); }
      else this.plant(side, this.v.a.set(fxw, 0, fz), 0, pole, yaw, "ladder: feet on the floor", this.n % 6 === 0);
    }
    void dt;
  }

  // ── landing balance: hop, land on one leg, hold still ──
  private landing(g: Extract<Gym2State, { kind: "landing" }>) {
    const P = GYM2.pad, m = this.m;
    let y = 0, crouch = 0.03, one = false, air = false, wob = 0;
    if (g.phase === "ready") crouch = 0.04 + Math.min(1, g.phaseT / 0.3) * 0.08;
    else if (g.phase === "air") { const k = Math.min(1, g.phaseT / LANDING.air); y = Math.sin(k * Math.PI) * 0.32; air = k < 0.96; crouch = 0.02; }
    else if (g.phase === "still") { one = true; crouch = 0.12 * Math.max(0, 1 - g.phaseT / 0.35) + 0.04; wob = g.wobble; }
    else if (g.phase === "reset") { const heavy = g.flash.what === "heavy"; crouch = heavy ? 0.2 * Math.max(0, 1 - g.phaseT / LANDING.reset) : 0.04; one = !heavy && g.phaseT < 0.2; }
    this.upright(P.x, y - crouch * m.hipY, P.z, Math.PI);
    const { f, l } = this.frame();
    this.bend(l, crouch * 1.2);
    if (wob) this.bend(f, Math.sin(g.t * 7.3) * wob * 0.25);
    const hip = this.world("Hips");
    for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const fx = P.x + sx * 0.1 * (l.x > 0 ? 1 : -1);
      const pole = this.v.b.set(fx, hip.y, P.z).addScaledVector(f, 0.9);
      const lifted = (one && side === "Right") || air;
      if (lifted) {
        // the free leg: knee up in front (single-leg) or both tucked (in the air)
        const ft = this.v.a.set(fx, hip.y - (one ? m.thigh * 0.85 : (m.thigh + m.shin) * 0.75), P.z + (one ? 0.18 : 0.05));
        this.reach(side, true, ft, pole); this.flatFoot(side, Math.PI);
      } else this.plant(side, this.v.a.set(one ? P.x : fx, 0, P.z - 0.02), 0.012, pole, Math.PI, "landing: foot on the pad", this.n % 6 === 0);
    }
    // arms out for balance on one leg
    if (one) for (const side of ["Left", "Right"] as const) {
      const sx = side === "Left" ? 1 : -1;
      const sh = this.world(`${side}Arm`);
      const t = this.v.c.copy(sh).addScaledVector(l, sx * m.arm * 0.9).add(this.v.d.set(0, -0.12, 0));
      this.reach(side, false, t, this.v.e.copy(sh).addScaledVector(f, -0.4).add(this.v.d.set(0, -0.3, 0)), 0.8);
    }
  }

  // ── mobility flow on mat B: a deep lunge, side to side, the depth on your thumb ──
  private mobility(g: Extract<Gym2State, { kind: "mobility" }>, w: number) {
    const B = GYM2.matB, top = GYM2.matTop, m = this.m;
    const side = Math.floor(g.t / 7) % 2; // which leg leads
    const lead = side === 0 ? "Left" : "Right", trail = side === 0 ? "Right" : "Left";
    const depth = Math.max(0, Math.min(1, g.y)) * w;
    const x = B.x + 0.05;
    this.upright(x, top - (0.18 + depth * 0.27) * m.hipY / 0.95, B.z, Math.PI / 2);
    const { f, l } = this.frame();
    this.bend(l, depth * 0.15);
    const hip = this.world("Hips");
    const lz = (s: string) => B.z + l.z * (s === "Left" ? 1 : -1) * 0.12;
    // the lead foot flat out in front, the trail knee down towards the mat behind
    this.plant(lead, this.v.a.set(x + 0.42 + depth * 0.08, 0, lz(lead)), top, this.v.b.set(x + 1.2, hip.y, lz(lead)), Math.PI / 2, "mobility: front foot flat on the mat", this.n % 6 === 0);
    const knee = this.v.c.set(x - 0.18 - depth * 0.08, top + 0.07 + (1 - depth) * 0.22, lz(trail));
    const dy = Math.max(0, knee.y - (top + 0.05));
    const tf = this.v.d.set(knee.x - Math.sqrt(Math.max(0.01, m.shin * m.shin * 0.92 - dy * dy)), top + 0.05, knee.z);
    this.onSurface(trail, true, trail === "Left" ? "LF" : "RF", tf, top, this.v.f.copy(knee).add(this.v.e.set(0.4, -0.25, 0)), "mobility: back toes on the mat");
    // arms reach up and over, slowly, with the line
    const reachUp = 0.5 + 0.5 * Math.sin(mobilityPath(g.seed, g.t) * 6);
    for (const s of ["Left", "Right"] as const) {
      const sx = s === "Left" ? 1 : -1;
      const sh = this.world(`${s}Arm`);
      const t = this.v.g.copy(sh).add(this.v.h.set(0, m.arm * (0.6 + 0.35 * reachUp), 0)).addScaledVector(l, sx * 0.12).addScaledVector(f, 0.05);
      this.reach(s, false, t, this.v.h.copy(sh).addScaledVector(l, sx * 0.5).addScaledVector(f, -0.2), 0.85 * w);
    }
    if (this.n % 12 === 0) this.floorPierce(top, "mobility: nothing through the mat");
  }
}

/** For a quick sanity check of the numbers above in a test (no three.js). */
export const GYM2_LIMITS = { pullBarY: GYM2.pull.y, squatBand: SQUAT.band, pullReps: PULLUP.reps, copenSide: COPEN.side };
