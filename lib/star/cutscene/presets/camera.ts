/**
 * CAMERA SHOT PRESETS — framing by film grammar, as plain maths.
 *
 * A shot is about a SUBJECT (an anchor: where he stands, which way he faces,
 * where his head and chest are). The preset says how much of him fills the
 * frame (the vertical extent at his distance), which lens, where the camera
 * stands round him and how high. A move (dolly, orbit, crane, zoom) runs
 * over the shot; handheld shake is seeded noise of t. Walls (a location's
 * bounds) push the camera back in, the lens widening so the framing holds.
 *
 * `side` is which side of the line of action the camera keeps to: +1 = the
 * subject's LEFT as he faces his subject2 (or his own facing).
 *
 * A TALL PHONE (B5, 20 Oct 2026; the 3D audit: 14 of 23 cut-scene stills had a
 * face or body filling the screen). A preset's `size` is the HEIGHT framed; on
 * a 9:19.5 phone that leaves a frame under half as wide, so a "medium" was a
 * chest that filled the screen and a close-up a face wider than it. `minW` is
 * the least WIDTH the shot shows at the subject (PHONE_FRAMING): on a tall
 * screen the shot widens until that much fits across, his head then sits in
 * the top part of the picture with a little room above it. A wide screen
 * already shows more than `minW`, so nothing changes there.
 */
import type { CameraMove, ShotPreset, ShotSpec, Vec3 } from "../types";
import { clamp, distForHeight, lensToFov, lerp, noise1, smooth, v3, yawDir } from "../math";

export interface Anchor {
  pos: Vec3; yaw: number;
  head: Vec3; chest: Vec3; hips: Vec3;
  /** Standing height of what is framed (a person ≈ 1.8, a prop its own). */
  height: number;
  /** A point thing (a prop or a mark), not a person. */
  thing?: boolean;
  /** A thing's own width (metres), when known (a prop's box): an insert shows all of it. */
  width?: number;
}

export interface PresetDef {
  /** Vertical extent framed at the subject, metres. */
  size: number;
  lens: number;
  /** What the frame centres on: 0 = feet, 1 = chest, 2 = head (blends between). */
  aim: number;
  /** Camera height: "eye" = level with the aim point plus this; "abs" = this many metres off the floor. */
  height: { eye?: number; abs?: number };
  /** Degrees round from straight in front. */
  angle: number;
  roll?: number;
  /** Where in the frame the aim point sits, −1..1 up (a close-up keeps the eyes high). */
  frameY?: number;
  /** The least width shown at the subject, metres (a tall phone; PHONE_FRAMING). */
  minW?: number;
}

/**
 * The least width each shot shows at its subject, metres. Picked so that on a
 * 9:19.5 phone a head is under half the screen wide (a head is ~0.25 m) and
 * the shoulders (~0.5 m) under nine tenths of it, with the arms in a medium.
 */
export const PHONE_FRAMING: Partial<Record<ShotPreset, number>> = {
  full: 1.2, "medium-wide": 1.0, medium: 0.85, "medium-close": 0.75, close: 0.68, "extreme-close": 0.6,
  "low-hero": 1.1, "high-angle": 1.3, insert: 0.42, pov: 0.9, profile: 0.8, dutch: 0.85,
};
/** On a tall phone, where his head sits: the frame's top this far over the head point (metres + share of the framed height). */
export const PHONE_HEADROOM = { m: 0.12, k: 0.14 } as const;
/**
 * The phone framing on (the bench's before/after: `?framing=old` on a test page plays the cut-scene
 * cameras as they were on 19 Oct 2026 — no width rule, inserts by the old size, the camera let into people).
 */
export const PHONE_FRAMING_ON = { on: typeof window === "undefined" || new URLSearchParams(window.location.search).get("framing") !== "old" };

export const SHOT_PRESETS: Record<ShotPreset, PresetDef> = {
  establishing: { size: 18, lens: 22, aim: 1, height: { abs: 6 }, angle: 35 },
  wide: { size: 6.5, lens: 26, aim: 1, height: { abs: 1.7 }, angle: 32 },
  full: { size: 2.6, lens: 35, aim: 0.75, height: { abs: 1.25 }, angle: 26 },
  "medium-wide": { size: 1.85, lens: 40, aim: 1.05, height: { eye: 0.1 }, angle: 24 },
  medium: { size: 1.25, lens: 45, aim: 1.4, height: { eye: 0.05 }, angle: 22, frameY: 0.08 },
  "medium-close": { size: 0.85, lens: 55, aim: 1.65, height: { eye: 0.02 }, angle: 20, frameY: 0.1 },
  close: { size: 0.52, lens: 70, aim: 1.9, height: { eye: 0.0 }, angle: 18, frameY: 0.1 },
  "extreme-close": { size: 0.26, lens: 90, aim: 2.05, height: { eye: 0 }, angle: 12 },
  ots: { size: 1.0, lens: 45, aim: 1.8, height: { eye: 0.08 }, angle: 0 },
  "two-shot": { size: 1.9, lens: 35, aim: 1.2, height: { eye: 0.05 }, angle: 90 },
  "low-hero": { size: 2.5, lens: 24, aim: 1.25, height: { abs: 0.32 }, angle: 28 },
  "high-angle": { size: 3.0, lens: 35, aim: 1, height: { eye: 2.4 }, angle: 22 },
  insert: { size: 0.62, lens: 50, aim: 1, height: { eye: 0.42 }, angle: 32 },
  pov: { size: 1.2, lens: 35, aim: 1.8, height: { eye: 0 }, angle: 0 },
  profile: { size: 1.1, lens: 50, aim: 1.7, height: { eye: 0.02 }, angle: 88 },
  dutch: { size: 1.2, lens: 40, aim: 1.5, height: { eye: 0.05 }, angle: 26, roll: 11 },
  "top-down": { size: 5, lens: 30, aim: 0.5, height: { eye: 6 }, angle: 2 },
  crowd: { size: 9, lens: 28, aim: 1, height: { abs: 2.2 }, angle: 170 },
};

export interface ShotPose { pos: Vec3; look: Vec3; fov: number; roll: number; focus: Vec3 }

const aimPoint = (a: Anchor, k: number): Vec3 => {
  if (a.thing) return a.chest;
  // 0 feet → 1 chest → 2 head
  if (k <= 1) return v3.lerp([a.pos[0], a.pos[1] + 0.05, a.pos[2]], a.chest, k);
  return v3.lerp(a.chest, a.head, Math.min(1.2, k - 1));
};

/** Where the camera is on a shot `k` (0..1) of the way through, at clip time t. */
export function shotPose(spec: ShotSpec, A: Anchor, B: Anchor | null, o: { aspect: number; k: number; t: number; seed: number; bounds?: { min: Vec3; max: Vec3 }; floor?: number }): ShotPose {
  const P = SHOT_PRESETS[spec.preset];
  const k = smooth(o.k);
  if (spec.fixed) {
    const fov = lensToFov(spec.fixed.lens ?? 35, o.aspect);
    return applyMove(spec, { pos: spec.fixed.pos, look: spec.fixed.look, fov, roll: 0, focus: spec.fixed.look }, k, o);
  }
  const lens = spec.lens ?? P.lens;
  let fov = lensToFov(lens, o.aspect);
  const side = spec.side ?? 1;
  const floor = o.floor ?? A.pos[1];

  // Facing: towards subject2 if there is one, else the subject's own way.
  let fwd: Vec3 = yawDir(A.yaw);
  if (B) { const d = v3.sub(B.pos, A.pos); d[1] = 0; if (Math.hypot(d[0], d[2]) > 0.05) fwd = v3.norm(d); }
  const left: Vec3 = [fwd[2], 0, -fwd[0]];
  const leftOf = (f: Vec3): Vec3 => [f[2], 0, -f[0]];
  void leftOf;
  let look: Vec3, pos: Vec3;

  if (spec.preset === "ots" && B) {
    // Behind B's shoulder (the one on our side), looking at A.
    const back = v3.norm([B.pos[0] - A.pos[0], 0, B.pos[2] - A.pos[2]]);
    const bLeft: Vec3 = [-left[0], 0, -left[2]]; // B faces −fwd: his left is our right
    look = v3.add(aimPoint(A, P.aim), [0, -0.02, 0]);
    pos = v3.add(B.head, v3.add(v3.scale(back, 0.62), v3.add(v3.scale(bLeft, -0.34 * side), [0, 0.06 + (spec.rise ?? 0), 0])));
    fov = lensToFov(lens, o.aspect);
  } else if (spec.preset === "pov" && B) {
    pos = v3.add(B.head, [0, -0.02, 0]);
    look = aimPoint(A, P.aim);
  } else if (spec.preset === "two-shot" && B) {
    const mid = v3.lerp(aimPoint(A, P.aim), aimPoint(B, P.aim), 0.5);
    const sep = v3.dist([A.pos[0], 0, A.pos[2]], [B.pos[0], 0, B.pos[2]]);
    const yawOff = ((spec.yaw ?? 0) * Math.PI) / 180;
    // not square-on: 35° round towards the subject's front, so on a narrow phone the two overlap in depth
    const perp = v3.norm(rotY(left, (yawOff - 0.61) * side));
    const needW = sep * 0.82 + 0.75;
    const needH = Math.max(P.size, needW / Math.max(0.3, o.aspect));
    const d = distForHeight(fov, needH);
    look = mid;
    pos = v3.add(mid, v3.add(v3.scale(perp, d * side), [0, (P.height.eye ?? 0) + (spec.rise ?? 0), 0]));
  } else {
    const ang = ((P.angle + (spec.yaw ?? 0)) * Math.PI) / 180 * side;
    const dir = rotY(fwd, ang);
    look = aimPoint(A, P.aim);
    // On a phone the frame is narrow: a full shot fits his height, a wide one its width too.
    let size = P.size * (A.thing && spec.preset !== "insert" ? Math.max(0.4, A.height / 1.8) : 1) * (A.height < 1.5 && !A.thing ? 0.85 : 1);
    // an insert shows the whole thing (a trophy, a shirt), not a slice of it
    if (PHONE_FRAMING_ON.on && A.thing && spec.preset === "insert") size = Math.max(size, A.height * 1.5);
    // a tall phone: at least this much across at the subject (PHONE_FRAMING)
    const minW = o.aspect < 1 && PHONE_FRAMING_ON.on ? phoneMinWidth(spec.preset, A) : 0;
    const narrow = minW > 0 && minW / o.aspect > size;
    if (narrow) size = minW / o.aspect;
    const d = distForHeight(fov, size);
    const y = P.height.abs !== undefined ? floor + P.height.abs : look[1] + (P.height.eye ?? 0);
    pos = [look[0] + dir[0] * d, y + (spec.rise ?? 0), look[2] + dir[2] * d];
    // keep the aim point where the preset wants it in the frame (eyes high in a close-up)
    if (narrow && !A.thing && P.aim >= 1.2) {
      // the phone's taller frame: his head near the top with a little room over it, more of him below
      look = [look[0], A.head[1] + PHONE_HEADROOM.m + PHONE_HEADROOM.k * size - size * 0.5, look[2]];
    } else if (P.frameY) look = v3.add(look, [0, -P.frameY * size * 0.5, 0]);
    // looking up/down shortens the real distance: keep the size
    const real = v3.dist(pos, look);
    if (real > 1e-3) fov = Math.min(100, fov * clamp(d / real, 0.7, 1.4));
  }
  const roll = P.roll ? P.roll * side : 0;
  let pose: ShotPose = { pos, look, fov, roll, focus: look };
  pose = applyMove(spec, pose, k, o);
  if (o.bounds) pose = keepInside(pose, o.bounds);
  return pose;
}

/** The least width a shot shows at its subject on a tall screen (0 = none). */
export function phoneMinWidth(preset: ShotPreset, A: Pick<Anchor, "thing" | "height" | "width">): number {
  const m = PHONE_FRAMING[preset] ?? 0;
  if (!m) return 0;
  // a thing: all of it across, with a margin (a shirt is wider than it is tall)
  if (A.thing) return Math.max(m, (A.width ?? A.height) * 1.35);
  return m;
}

function rotY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

function applyMove(spec: ShotSpec, p: ShotPose, k: number, o: { t: number; seed: number }): ShotPose {
  const mv: CameraMove = spec.move ?? "static";
  const amt = spec.moveAmount;
  let { pos, look, fov } = p;
  const toCam = v3.sub(pos, look);
  const d0 = v3.len(toCam);
  const dir = d0 > 1e-6 ? v3.scale(toCam, 1 / d0) : ([0, 0, 1] as Vec3);
  switch (mv) {
    case "dolly-in": { const a = amt ?? 0.35; pos = v3.add(look, v3.scale(dir, d0 * lerp(1 + a, 1, k))); break; }
    case "dolly-out": { const a = amt ?? 0.35; pos = v3.add(look, v3.scale(dir, d0 * lerp(1, 1 + a, k))); break; }
    case "push": { pos = v3.add(look, v3.scale(dir, d0 * lerp(1.12, 1, k))); break; }
    case "pull": { pos = v3.add(look, v3.scale(dir, d0 * lerp(1, 1.12, k))); break; }
    case "orbit-left": case "orbit-right": {
      const a = (((amt ?? 24) * Math.PI) / 180) * (mv === "orbit-left" ? 1 : -1) * (k - 0.5);
      const r = rotY(toCam, a);
      pos = v3.add(look, r);
      break;
    }
    case "crane-up": case "crane-down": {
      const a = (amt ?? 1.2) * (mv === "crane-up" ? 1 : -1) * (k - 0.5);
      pos = v3.add(pos, [0, a, 0]);
      break;
    }
    case "zoom-in": fov = fov / lerp(1, 1 + (amt ?? 0.3), k); break;
    case "zoom-out": fov = fov / lerp(1 + (amt ?? 0.3), 1, k); break;
    default: break;
  }
  const sh = spec.shake ?? 0;
  if (sh > 0) {
    const n = (f: number, s: number) => noise1(o.t * f, o.seed + s) * 0.6 + noise1(o.t * f * 2.7, o.seed + s + 9) * 0.4;
    pos = v3.add(pos, [n(1.3, 1) * 0.035 * sh, n(1.1, 2) * 0.025 * sh, n(0.9, 3) * 0.02 * sh]);
    look = v3.add(look, [n(1.6, 4) * 0.03 * sh, n(1.4, 5) * 0.025 * sh, 0]);
  }
  return { ...p, pos, look, fov };
}

/** Pull a camera that ended up behind a wall back in, widening the lens so the framing holds. */
export function keepInside(p: ShotPose, b: { min: Vec3; max: Vec3 }): ShotPose {
  const inside = (q: Vec3) => q[0] >= b.min[0] && q[0] <= b.max[0] && q[1] >= b.min[1] && q[1] <= b.max[1] && q[2] >= b.min[2] && q[2] <= b.max[2];
  if (inside(p.pos)) return p;
  const d0 = v3.dist(p.pos, p.look);
  let lo = 0, hi = 1; // fraction of the way from look to pos
  for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (inside(v3.lerp(p.look, p.pos, m))) lo = m; else hi = m; }
  const k = Math.max(0.15, lo * 0.97);
  const pos = v3.lerp(p.look, p.pos, k);
  const d1 = d0 * k;
  // same extent at the subject: tan(f1/2) = tan(f0/2) * d0/d1
  const f1 = (2 * Math.atan(Math.tan((p.fov * Math.PI) / 360) * (d0 / Math.max(0.05, d1))) * 180) / Math.PI;
  return { ...p, pos, fov: Math.min(105, f1) };
}

/** Blend two camera poses (a slow mix between shots). */
export function mixPose(a: ShotPose, b: ShotPose, k: number): ShotPose {
  const e = smooth(k);
  return { pos: v3.lerp(a.pos, b.pos, e), look: v3.lerp(a.look, b.look, e), fov: lerp(a.fov, b.fov, e), roll: lerp(a.roll, b.roll, e), focus: v3.lerp(a.focus, b.focus, e) };
}

/** Rough size order of presets (wide → close), for the cinema rules. */
export const SHOT_SIZE_ORDER: ShotPreset[] = ["establishing", "wide", "crowd", "full", "low-hero", "high-angle", "two-shot", "medium-wide", "medium", "ots", "profile", "dutch", "medium-close", "close", "insert", "extreme-close"];
export const shotSizeRank = (p: ShotPreset) => Math.max(0, SHOT_SIZE_ORDER.indexOf(p));
