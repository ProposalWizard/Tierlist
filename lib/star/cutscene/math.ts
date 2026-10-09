/**
 * Small pure helpers for the cut-scene system (no three.js): easing, a seeded
 * random stream, paths, vectors as [x, y, z].
 */
import type { Vec3 } from "./types";

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smooth = (k: number) => { const x = clamp(k); return x * x * (3 - 2 * x); };
export const smoother = (k: number) => { const x = clamp(k); return x * x * x * (x * (x * 6 - 15) + 10); };
export const easeOut = (k: number) => { const x = clamp(k); return 1 - (1 - x) * (1 - x); };
export const easeIn = (k: number) => { const x = clamp(k); return x * x; };
/** 0 → 1 over [a, b], smoothed. */
export const seg = (t: number, a: number, b: number) => (b <= a ? (t >= b ? 1 : 0) : smooth((t - a) / (b - a)));
/** A window: fades in over [at, at+inn], holds, fades out over [end-out, end]. */
export function windowWeight(t: number, at: number, end: number, inn = 0.25, out = 0.25): number {
  if (t < at || t > end) return 0;
  const a = inn > 0 ? smooth((t - at) / inn) : 1;
  const b = out > 0 ? smooth((end - t) / out) : 1;
  return Math.min(a, b);
}

export const v3 = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  dist: (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a: Vec3, b: Vec3, k: number): Vec3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
};

/** Yaw (radians, 0 faces +z) that looks from a to b on the floor. */
export const yawTo = (from: Vec3, to: Vec3) => Math.atan2(to[0] - from[0], to[2] - from[2]);
/** The unit floor direction a yaw faces. */
export const yawDir = (yaw: number): Vec3 => [Math.sin(yaw), 0, Math.cos(yaw)];
/** Shortest turn from a to b. */
export const angleDiff = (a: number, b: number) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const lerpAngle = (a: number, b: number, k: number) => a + angleDiff(a, b) * k;

/** A seeded random stream (mulberry32). Same seed, same numbers. */
export function rng(seed: number) {
  let s = (seed >>> 0) || 0x9e3779b9;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a: number, b: number) => a + (b - a) * next(),
    int: (a: number, b: number) => Math.floor(a + (b - a + 1) * next()),
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length) % xs.length],
    chance: (p: number) => next() < p,
    /** Pick by weight. */
    weighted: <T>(xs: readonly { w: number; v: T }[]): T => {
      const tot = xs.reduce((s, x) => s + Math.max(0, x.w), 0);
      let r = next() * tot;
      for (const x of xs) { r -= Math.max(0, x.w); if (r <= 0) return x.v; }
      return xs[xs.length - 1].v;
    },
  };
}
export type Rng = ReturnType<typeof rng>;

/** A stable number from a string (for seeding by name). */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Smooth noise in time (handheld shake): −1..1, seeded. */
export function noise1(t: number, seed: number): number {
  const i = Math.floor(t), f = t - i;
  const h = (n: number) => { const x = Math.sin((n + seed * 0.618) * 127.1) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
  const k = f * f * (3 - 2 * f);
  return h(i) * (1 - k) + h(i + 1) * k;
}

/**
 * A path through points (Catmull-Rom), walked at an even speed: `at(u)`
 * for u in 0..1 is the point `u` of the way ALONG it (by distance), and
 * `dir(u)` the way it heads there.
 */
export function makePath(pts: Vec3[]) {
  const P = pts.length === 1 ? [pts[0], pts[0]] : pts;
  const raw = (s: number): Vec3 => {
    const n = P.length - 1;
    const x = clamp(s, 0, 1) * n;
    const i = Math.min(n - 1, Math.floor(x)), f = x - i;
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
    const c = (a: number, b: number, cc: number, d: number) =>
      0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
    return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1]), c(p0[2], p1[2], p2[2], p3[2])];
  };
  const N = 64;
  const samples: Vec3[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= N; i++) samples.push(raw(i / N));
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + v3.dist(samples[i - 1], samples[i]));
  const length = cum[N];
  const at = (u: number): Vec3 => {
    if (length < 1e-6) return samples[0];
    const d = clamp(u) * length;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
    const k = (d - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
    return v3.lerp(samples[lo], samples[hi], k);
  };
  const dir = (u: number): Vec3 => {
    const a = at(Math.max(0, u - 0.01)), b = at(Math.min(1, u + 0.01));
    const d: Vec3 = [b[0] - a[0], 0, b[2] - a[2]];
    return Math.hypot(d[0], d[2]) < 1e-6 ? [0, 0, 1] : v3.norm(d);
  };
  return { length, at, dir };
}

/** Field of view (vertical, degrees) of a full-frame lens of `mm` on a screen `aspect` wide/high. */
export function lensToFov(mm: number, aspect = 9 / 19.5): number {
  // A lens is quoted for a landscape 36 × 24 frame. On a portrait phone the
  // short side is across: give the 24 mm side to the width, so a 50 mm
  // close-up on a phone is as wide across as on a landscape screen.
  const half = Math.atan(12 / mm);
  if (aspect >= 1) return (2 * half * 180) / Math.PI;
  return (2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI;
}

/** The vertical extent (metres) a camera with this vertical fov sees at this distance. */
export const viewHeight = (fovDeg: number, dist: number) => 2 * dist * Math.tan((fovDeg * Math.PI) / 360);
/** The distance at which a vertical extent `h` fills this vertical fov. */
export const distForHeight = (fovDeg: number, h: number) => h / 2 / Math.tan((fovDeg * Math.PI) / 360);
