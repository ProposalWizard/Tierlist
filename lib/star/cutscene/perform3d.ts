/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PERFORMANCE — whole-body holds laid over a clip (PoseHold in types.ts),
 * through the people layer's API (reach, hand, lean, lookAt, bone). Each is
 * worked out from t and a weight; nothing remembers the last frame.
 *
 * Points are in the actor's own frame: x = his left, y up from his feet,
 * z = his front.
 */
import type { CutsceneActor, PoseHold, ReachLag, Vec3 } from "./types";
import { aimBone, rotateBoneWorld, solveArm } from "../signing3dRig";
import { FLUID_ON, clapGap, humanBeat, liftCurve, liveDrift, wander } from "./fluid";
import { refArms, type RefArmClip } from "./refMotion";
import { PRESS_DESK_TOP } from "./presets/locations";

/**
 * `lag`: the overlap weights for this hold's arms (the forearm and hand a beat
 * behind the upper arm while it blends on or off; director.ts works them out).
 * `seed`: this actor's own wobble (two men never drift in step).
 */
export interface PoseCtx { T: any; t: number; local: number; yaw: number; root: Vec3; lag?: ReachLag; seed?: number;
  /** The floor under him in the script (his mark), before his feet are planted: a seated man's root drops a few cm, a desk does not. */
  floorY?: number }

export function actorPoint(T: any, c: PoseCtx, x: number, y: number, z: number) {
  const cs = Math.cos(c.yaw), s = Math.sin(c.yaw);
  return new T.Vector3(c.root[0] + x * cs + z * s, c.root[1] + y, c.root[2] - x * s + z * cs);
}
export function actorDir(T: any, c: PoseCtx, x: number, y: number, z: number) {
  const cs = Math.cos(c.yaw), s = Math.sin(c.yaw);
  return new T.Vector3(x * cs + z * s, y, -x * s + z * cs).normalize();
}

/**
 * Both hands to points (actor frame), fingers along / palms towards (actor frame).
 * Each hand drifts a little round its mark (breathing, sway: fluid.ts liveDrift),
 * so a held pose is never frozen. `drift`: 1 each hand its own; 0..1 a prop held
 * in both hands (both share one drift, so the hands never pull it apart).
 */
function twoHands(a: CutsceneActor, c: PoseCtx, w: number, L: Vec3, R: Vec3, alongL: Vec3 | null, palmL: Vec3 | null, alongR: Vec3 | null, palmR: Vec3 | null, pole?: Vec3, drift = 1) {
  const T = c.T;
  const d = (v: Vec3 | null) => (v ? actorDir(T, c, v[0], v[1], v[2]) : null);
  const sd = c.seed ?? 0;
  const on = FLUID_ON.on ? 1 : 0;
  const dl = liveDrift(c.t, sd + 0.3, on * (drift >= 1 ? 1 : Math.max(0.5, drift)));
  const dR = drift >= 1 ? liveDrift(c.t, sd + 0.47, on) : dl;
  a.reach("L", actorPoint(T, c, L[0] + dl[0], L[1] + dl[1], L[2] + dl[2]), d(alongL), d(palmL), w, pole ? actorDir(T, c, pole[0], pole[1], pole[2]) : actorDir(T, c, 0.8, -0.5, -0.3), c.lag);
  a.reach("R", actorPoint(T, c, R[0] + dR[0], R[1] + dR[1], R[2] + dR[2]), d(alongR), d(palmR), w, pole ? actorDir(T, c, -pole[0], pole[1], pole[2]) : actorDir(T, c, -0.8, -0.5, -0.3), c.lag);
}

/** Where a side's shoulder joint is and how long that arm is (shoulder → elbow → wrist), now. */
function armOf(a: CutsceneActor, T: any, side: "L" | "R") {
  const S = side === "L" ? "Left" : "Right";
  const wpt = (n: string) => { const b = a.bone(n); const v = new T.Vector3(); if (b) b.getWorldPosition(v); return v; };
  const sh = wpt(`${S}Arm`), el = wpt(`${S}ForeArm`), wr = wpt(`${S}Hand`);
  return { sh, len: Math.max(0.3, sh.distanceTo(el) + el.distanceTo(wr)) };
}


export interface RefHoldOpts {
  /** Seconds into the reference at local 0. */
  from?: number;
  speed?: number;
  loop?: boolean;
  /** A prop in both hands: keep the hands this far apart (m), centred where the real man's were. */
  span?: number;
  /** With `span`: place the prop from this hand alone (the other was hidden in the video). */
  lead?: "L" | "R";
  /** How much of his trunk lean to copy. */
  lean?: number;
  grip?: Parameters<CutsceneActor["hand"]>[1];
  /** Turn the palms: in (towards each other), to the front, or leave the hand on the forearm. */
  palms?: "in" | "front" | "down" | null;
  /** The hands never lower than this (m above his feet): a desk top his hands rest on, not sink into. */
  floor?: number;
}

/**
 * ARMS COPIED FROM A REAL PERSON (refMotion.ts): each wrist where his was
 * (from his shoulder, scaled to this man's arm), the elbow bending the way
 * his did, at his timing.
 */
export function refHold(a: CutsceneActor, c: PoseCtx, w: number, clip: RefArmClip, o: RefHoldOpts = {}) {
  const T = c.T;
  const s = refArms(clip, (o.from ?? 0) + c.local * (o.speed ?? 1), o.loop);
  if (!s) return;
  // his trunk's lean first, so the arms are solved from where his shoulders then are
  if (o.lean) a.lean(s.lean[0] * o.lean * w, -s.lean[1] * o.lean * w);
  // his paths are in his CHEST's frame (a man leaning over a table has the table "in front"), so
  // ours go in our man's chest frame too: across the shoulders, up the spine, and out the front
  const wpt = (n: string) => { const b = a.bone(n); const v = new T.Vector3(); if (b) b.getWorldPosition(v); return v; };
  const shL = wpt("LeftArm"), shR = wpt("RightArm");
  const across = shL.clone().sub(shR).normalize();
  const upv = wpt("neck").sub(wpt("Spine02"));
  upv.sub(across.clone().multiplyScalar(upv.dot(across))).normalize();
  if (upv.lengthSq() < 0.5) upv.set(0, 1, 0);
  const fwd = new T.Vector3().crossVectors(across, upv).normalize();
  const inChest = (v: number[]) => across.clone().multiplyScalar(v[0]).addScaledVector(upv, v[1]).addScaledVector(fwd, v[2]);
  const put = (side: "L" | "R") => {
    const { sh, len } = armOf(a, T, side);
    const v = s[side], e = s[side === "L" ? "Le" : "Re"];
    const wr = sh.clone().addScaledVector(inChest(v), len);
    const el = sh.clone().addScaledVector(inChest(e), len);
    return { sh, wr, el };
  };
  const L = put("L"), R = put("R");
  if (o.span) {
    // a prop in both hands: his centre (or, with `lead`, from the one hand the tracker saw clearly:
    // in ref-trophy-lift the cup hid his right wrist), our handle spacing, his tilt of the prop
    // but never more than ~20° off level and never with the hands crossed (the real man tips the
    // cup to look at it; on our prop that read as a cup on its side)
    const left = actorDir(T, c, 1, 0, 0);
    // (lead: his height and reach from that hand, centred on our man's chest: a real cup's handles
    // are narrower than ours, so his hand's own side-to-side place would put our cup off to one side)
    const lw = o.lead === "L" ? L.wr : o.lead === "R" ? R.wr : null;
    const chestMid = L.sh.clone().add(R.sh).multiplyScalar(0.5);
    const mid = lw ? lw.clone().addScaledVector(left, chestMid.clone().sub(lw).dot(left)) : L.wr.clone().add(R.wr).multiplyScalar(0.5);
    const raw = L.wr.clone().sub(R.wr);
    const h = Math.max(0.05, raw.dot(left));
    const tilt = o.lead ? 0 : Math.max(-0.35, Math.min(0.35, Math.atan2(raw.y, h)));
    const across = left.clone().multiplyScalar(Math.cos(tilt)).add(new T.Vector3(0, Math.sin(tilt), 0));
    across.normalize().multiplyScalar(o.span / 2);
    L.wr.copy(mid).add(across); R.wr.copy(mid).sub(across);
  }
  if (o.floor !== undefined) {
    // (the real man sat lower to his table than ours does to the press desk: his hands, put on our
    // man as they were, went under the desk top)
    const fl = (c.floorY ?? c.root[1]) + o.floor;
    for (const p of [L, R]) if (p.wr.y < fl) { const dy = fl - p.wr.y; p.wr.y = fl; p.el.y += dy * 0.5; }
  }
  for (const [side, p] of [["L", L], ["R", R]] as const) {
    const mid = p.sh.clone().add(p.wr).multiplyScalar(0.5);
    const pole = p.el.clone().sub(mid);
    if (pole.lengthSq() < 1e-6) pole.copy(actorDir(T, c, side === "L" ? 0.8 : -0.8, -0.5, -0.3));
    let along: any = null, palm: any = null;
    if (o.palms) {
      along = p.wr.clone().sub(p.el).normalize();
      const sg = side === "L" ? 1 : -1;
      palm = o.palms === "in" ? actorDir(T, c, -sg, 0, 0) : o.palms === "down" ? actorDir(T, c, 0, -1, 0) : actorDir(T, c, 0, 0, 1);
      // palms down on a desk: the fingers lie flat along it, the way the forearm points
      if (o.palms === "down") { along.y = 0; if (along.lengthSq() < 1e-6) along.copy(actorDir(T, c, 0, 0, 1)); along.normalize(); }
    }
    a.reach(side, p.wr, along, palm, w, pole.normalize(), c.lag);
    if (o.grip) a.hand(side, o.grip, w);
  }
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

/**
 * LIVING ARMS (B5c): a small additive sway on top of whatever clip plays, so a
 * man standing and listening never has dead arms. Overlap built in: the upper
 * arm sways first, the forearm follows 0.15 s later, the hand 0.3 s later
 * (the same wander read at earlier times), and the collarbone rises a touch
 * with each breath. A few degrees only; any hold or reach laid on afterwards
 * replaces it on that arm. Pure: from t alone.
 */
export function liveArms(a: CutsceneActor, c: PoseCtx, amount = 1) {
  if (!FLUID_ON.on || amount <= 0) return;
  const T = c.T, sd = c.seed ?? 0, t = c.t;
  const d2r = Math.PI / 180;
  const fwd = actorDir(T, c, 0, 0, 1), left = actorDir(T, c, 1, 0, 0);
  const breath = Math.sin(t * Math.PI * 2 * 0.24 + sd);
  for (const [S, sg] of [["Left", 1], ["Right", -1]] as const) {
    const s0 = sd + (sg > 0 ? 0.11 : 0.53);
    const sh = a.bone(`${S}Shoulder`), up = a.bone(`${S}Arm`), lo = a.bone(`${S}ForeArm`), ha = a.bone(`${S}Hand`);
    if (sh) rotateBoneWorld(T, sh, new T.Quaternion().setFromAxisAngle(fwd, sg * breath * 0.8 * d2r * amount));
    // swing forward/back about his left-right line, and a little out from the side
    if (up) {
      rotateBoneWorld(T, up, new T.Quaternion().setFromAxisAngle(left, wander(t, s0) * 3.2 * d2r * amount));
      rotateBoneWorld(T, up, new T.Quaternion().setFromAxisAngle(fwd, sg * (0.5 + 0.5 * wander(t, s0 + 1)) * 1.4 * d2r * amount));
    }
    if (lo) rotateBoneWorld(T, lo, new T.Quaternion().setFromAxisAngle(left, wander(t - 0.15, s0) * 4.0 * d2r * amount));
    if (ha) rotateBoneWorld(T, ha, new T.Quaternion().setFromAxisAngle(left, wander(t - 0.3, s0) * 5.0 * d2r * amount));
  }
}

/** The knee-slide arms as they were on 20 Oct 2026 (`?fluid=old`, for before/after only). Frozen. */
function oldKneeSlide(a: CutsceneActor, c: PoseCtx, w: number, sh: number, t: number) {
  const roar = Math.min(1, Math.max(0, Math.min((t - 1.2) / 0.35, (2.5 - t) / 0.4)));
  kneel(a, c, w, 0.22 - 0.1 * roar);
  const up = Math.min(1, t / 0.5) * (1 - roar) + (t > 2.5 ? Math.min(1, (t - 2.5) / 0.5) * 0.4 : 0);
  const ox = 0.62 - 0.38 * roar, oy = sh + 0.05 + 0.3 * up - 0.12 * roar, oz = 0.12 + 0.16 * roar;
  twoHands(a, c, w, [ox, oy, oz], [-ox, oy, oz], [1 - 1.3 * roar, 0.3 + 0.5 * roar, 0.1], [0, 0.2, 1], [-1 + 1.3 * roar, 0.3 + 0.5 * roar, 0.1], [0, 0.2, 1], [0, -1, -0.6]);
  a.hand("L", roar > 0.5 ? "fist" : "spread", w); a.hand("R", roar > 0.5 ? "fist" : "spread", w);
}

export function applyPose(a: CutsceneActor, pose: PoseHold, w: number, c: PoseCtx) {
  if (w <= 0 && !(c.lag && c.lag.lower > 0)) return;
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
      if (!FLUID_ON.on) { oldKneeSlide(a, c, w, sh, t); break; }
      // B5c: the arms are a real man's on his knees (ref-goal-celebration): wide, fists in for the
      // roar, then up. His sequence is 6 s, the slide's hold ~4 s, so it plays a touch quicker.
      // The hands close into fists over half a second (were switched in one frame).
      kneel(a, c, w, 0.14);
      refHold(a, c, w, "roar", { speed: 1.35, lean: 0.6 });
      const fist = Math.max(0, Math.min(1, (t * 1.35 - 2.1) / 0.5));
      a.hand("L", "spread", w); a.hand("R", "spread", w);
      if (fist > 0) { a.hand("L", "fist", w * fist); a.hand("R", "fist", w * fist); }
      break;
    }
    case "ref-roar": refHold(a, c, w, "roar", { lean: 0.6 }); a.hand("L", "fist", w); a.hand("R", "fist", w); break;
    case "ref-talk-hands": refHold(a, c, w, "talk-hands", { loop: true, lean: 0.5, grip: "open", palms: "down", floor: PRESS_DESK_TOP + 0.09 }); break;
    case "ref-trophy-lift": refHold(a, c, w, "trophy-lift", { span: 0.42, lead: "L", lean: 0.5, grip: "grip", palms: "in" }); break;
    case "ref-wave-clap": refHold(a, c, w, "wave-clap", { lean: 0.4, grip: "open" }); break;
    case "ref-shirt-up": refHold(a, c, w, "shirt-up", { span: 0.42, lean: 0.3, grip: "pinch", palms: "front" }); break;
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
      // a person's pumps: not a metronome (fluid.ts humanBeat), each a touch different in size
      const hb = FLUID_ON.on ? humanBeat(t, 1.5, c.seed ?? 0) : { phase: t * 1.6, size: 1 };
      const k = (0.5 + 0.5 * Math.sin(hb.phase * Math.PI * 2 - Math.PI / 2)) * hb.size;
      a.reach("R", actorPoint(T, c, -0.22, sh + 0.05 + 0.32 * k, 0.22 - 0.05 * k), actorDir(T, c, 0, 1, 0.2), actorDir(T, c, 0, 0, 1), w, actorDir(T, c, -0.6, -0.8, 0), c.lag);
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
      // a real clap: closes fast into the hit, opens softer; tempo and size drift (fluid.ts)
      const hb = humanBeat(t, 1.3, c.seed ?? 0);
      const g = FLUID_ON.on ? 0.025 + 0.07 * clapGap(hb.phase) * hb.size : 0.025 + 0.07 * Math.abs(Math.sin(t * Math.PI * 2.6));
      const bob = FLUID_ON.on ? 0.012 * Math.sin(hb.phase * Math.PI * 2) : 0;
      twoHands(a, c, w, [g, chest + 0.04 + bob, 0.32], [-g, chest + 0.06 + bob, 0.32], [-0.2, 0.7, 0.7], [-1, 0, 0], [0.2, 0.7, 0.7], [1, 0, 0], [0, -1, -0.2], 0.6);
      a.hand("L", "clap", w); a.hand("R", "clap", w);
      break;
    }
    case "salute-crowd": {
      const hb = FLUID_ON.on ? humanBeat(t, 0.9, c.seed ?? 0) : { phase: t * 0.9, size: 1 };
      const k = Math.sin(hb.phase * Math.PI * 2) * hb.size;
      const dr = liveDrift(t, (c.seed ?? 0) + 5, FLUID_ON.on ? 1 : 0);
      a.reach("R", actorPoint(T, c, -0.45 + 0.08 * k + dr[0], head + 0.25 + dr[1], 0.25 + dr[2]), actorDir(T, c, -0.1 * k, 1, 0.1), actorDir(T, c, 0, 0, 1), w, actorDir(T, c, -1, -0.4, 0), c.lag);
      a.hand("R", "wave", w);
      break;
    }
    case "hold-shirt-up": {
      const y = chest + 0.02 + (FLUID_ON.on ? 0.015 * wander(t * 0.7, (c.seed ?? 0) + 4) : 0);
      twoHands(a, c, w, [0.21, y, 0.42], [-0.21, y, 0.42], [-0.2, 0.6, 0.6], [0, -0.2, 1], [0.2, 0.6, 0.6], [0, -0.2, 1], [0, -1, -0.3], 0);
      a.hand("L", "pinch", w); a.hand("R", "pinch", w);
      break;
    }
    case "trophy-overhead": {
      // was a straight-line ramp (Math.min(1, t / 0.7)) that started and stopped dead: now a dip, a rise, a settle
      const lift = FLUID_ON.on ? liftCurve(t, 0.18, 0.75) : Math.min(1, t / 0.7);
      const y = chest + 0.05 + (head + 0.5 - chest) * lift;
      twoHands(a, c, w, [0.21, y, 0.2 - 0.14 * lift], [-0.21, y, 0.2 - 0.14 * lift], [-0.4, 1, 0.1], [-1, 0, 0], [0.4, 1, 0.1], [1, 0, 0], [0, -0.4, -1], 0.8);
      a.hand("L", "grip", w); a.hand("R", "grip", w);
      a.lean(-0.1 * w * lift);
      break;
    }
    case "trophy-chest":
      twoHands(a, c, w, [0.2, chest - 0.02, 0.26], [-0.2, chest - 0.02, 0.26], [-0.3, 0.3, 1], [-1, 0, 0], [0.3, 0.3, 1], [1, 0, 0], undefined, 0);
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
