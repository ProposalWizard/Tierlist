/**
 * The Roblox match camera (Roblox only: the website draws a flat 2D frame).
 *
 * A chance is filmed from behind the ball, looking towards goal, a little
 * above head height, and pulled back only as far as it must be to show what
 * matters: the ball, the goal mouth, you, the keeper, and the men near the
 * ball (team-mates you can pass to, defenders in the way). It is worked out
 * every frame from the picture (matchView.ts); Roblox eases towards it.
 *
 * Checked with roblox/tools/camera-preview.py (the same maths, drawn), since
 * Studio cannot be opened from here.
 * Pitch coordinates: x across (0..68), y out from the goal line (0), h up.
 */
import type { Frame } from "./matchView";

export interface Cam { pos: { x: number; y: number; h: number }; target: { x: number; y: number; h: number } }

const GOAL_CX = 34;
const ELEVATION_DEG = 34;
/** How much of the screen the picture may use (the HUD sits in the rest). */
const FIT_X = 0.86, FIT_TOP = 0.62, FIT_BOTTOM = 0.86;
const MIN_DIST = 11, MAX_DIST = 140;
/** Past this the picture is too small to play: the men furthest from the ball are let go first. */
const DIST_CAP = 40;

type P3 = { x: number; y: number; h: number };
const sub = (a: P3, b: P3): P3 => ({ x: a.x - b.x, y: a.y - b.y, h: a.h - b.h });
const dot = (a: P3, b: P3) => a.x * b.x + a.y * b.y + a.h * b.h;
const norm = (a: P3): P3 => { const l = Math.hypot(a.x, a.y, a.h) || 1; return { x: a.x / l, y: a.y / l, h: a.h / l }; };
// "up" is h; right-handed in (x, h, y) like Roblox's (X, Y, Z)
const cross = (a: P3, b: P3): P3 => {
  // in Roblox axes: X=x, Y=h, Z=y
  const ax = a.x, ay = a.h, az = a.y, bx = b.x, by = b.h, bz = b.y;
  return { x: ay * bz - az * by, h: az * bx - ax * bz, y: ax * by - ay * bx };
};

/** Where a pitch point lands on the screen, -1..1 each way (y up), or null behind the camera. */
export function project(cam: Cam, p: P3, aspect: number, vfovDeg: number): { x: number; y: number } | null {
  const fw = norm(sub(cam.target, cam.pos));
  const right = norm(cross(fw, { x: 0, y: 0, h: 1 }));
  const up = cross(right, fw);
  const d = sub(p, cam.pos);
  const depth = dot(d, fw);
  if (depth < 0.3) return null;
  const t = Math.tan((vfovDeg * Math.PI) / 360);
  return { x: dot(d, right) / depth / (t * aspect), y: dot(d, up) / depth / t };
}

function placed(target: P3, dir: { x: number; y: number }, dist: number): Cam {
  const e = (ELEVATION_DEG * Math.PI) / 180;
  return {
    pos: { x: target.x - dir.x * dist * Math.cos(e), y: target.y - dir.y * dist * Math.cos(e), h: target.h + dist * Math.sin(e) },
    target,
  };
}

function fits(cam: Cam, pts: P3[], aspect: number, vfov: number): boolean {
  for (const p of pts) {
    const s = project(cam, p, aspect, vfov);
    if (!s || Math.abs(s.x) > FIT_X || s.y > FIT_TOP || s.y < -FIT_BOTTOM) return false;
  }
  return true;
}

/** What a chance's camera must show: `core` always (the ball, the goal, you), `extra` if it can (nearest the ball first). */
export function mustSee(f: Frame): { core: P3[]; extra: P3[][] } {
  const core: P3[] = [];
  const ball = f.ball;
  if (ball) core.push({ x: ball.x, y: ball.y, h: 0 }, { x: ball.x, y: ball.y, h: (ball.z ?? 0) + 0.3 });
  const g = f.goal;
  core.push({ x: g.x1, y: 0, h: 0 }, { x: g.x2, y: 0, h: 0 }, { x: g.x1, y: 0, h: g.crossbar }, { x: g.x2, y: 0, h: g.crossbar });
  const bx = ball ? ball.x : GOAL_CX, by = ball ? ball.y : 16;
  const extra: { d: number; pts: P3[] }[] = [];
  for (const b of f.bodies) {
    const near = Math.hypot(b.x - bx, b.y - by);
    const pts = [{ x: b.x, y: b.y, h: 0 }, { x: b.x, y: b.y, h: 1.9 }];
    if (b.side === "you") core.push(...pts);
    else if (b.side === "keeper" || (b.side === "mate" && (b.option || near < 20)) || (b.side === "opp" && near < 14)) extra.push({ d: near, pts });
  }
  extra.sort((a, b) => a.d - b.d);
  return { core, extra: extra.map((e) => e.pts) };
}

function nearestFit(target: P3, dir: { x: number; y: number }, pts: P3[], aspect: number, vfov: number): number {
  let lo = MIN_DIST, hi = MAX_DIST;
  if (fits(placed(target, dir, lo), pts, aspect, vfov)) return lo;
  if (!fits(placed(target, dir, hi), pts, aspect, vfov)) return Infinity;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (fits(placed(target, dir, mid), pts, aspect, vfov)) hi = mid; else lo = mid; }
  return hi;
}
function centreOf(pts: P3[]): P3 {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, h: 0 };
}

/** The chance camera for this frame, for a screen of `aspect` (width / height) and vertical field of view. */
export function chanceCam(f: Frame, aspect: number, vfovDeg: number): Cam {
  const { core, extra } = mustSee(f);
  const ball = f.ball ?? { x: GOAL_CX, y: 18, z: 0 };
  // look from behind the ball towards goal, kept mostly up the pitch
  const gx = GOAL_CX - ball.x, gy = 0 - ball.y;
  const gl = Math.hypot(gx, gy) || 1;
  let dx = 0.55 * (gx / gl), dy = 0.55 * (gy / gl) - 0.45;
  const dl = Math.hypot(dx, dy) || 1;
  dx /= dl; dy /= dl;
  const dir = { x: dx, y: dy };
  // as many of the men near the ball as fit close enough to play
  let keep = extra.length;
  let pts = core.concat(...extra);
  while (keep > 0 && nearestFit(centreOf(pts), dir, pts, aspect, vfovDeg) > DIST_CAP) {
    keep--;
    pts = core.concat(...extra.slice(0, keep));
  }
  let target = centreOf(pts);
  let dist = nearestFit(target, dir, pts, aspect, vfovDeg);
  if (!Number.isFinite(dist)) dist = DIST_CAP;
  for (let pass = 0; pass < 2; pass++) {
    const cam = placed(target, dir, dist);
    // centre it: move the aim point by how far off centre the picture sits
    let sx0 = Infinity, sx1 = -Infinity, sy0 = Infinity, sy1 = -Infinity;
    for (const p of pts) { const s = project(cam, p, aspect, vfovDeg); if (s) { sx0 = Math.min(sx0, s.x); sx1 = Math.max(sx1, s.x); sy0 = Math.min(sy0, s.y); sy1 = Math.max(sy1, s.y); } }
    if (!Number.isFinite(sx0)) break;
    const offX = (sx0 + sx1) / 2, offY = (sy0 + sy1) / 2 - (FIT_TOP - FIT_BOTTOM) / 2;
    const t = Math.tan((vfovDeg * Math.PI) / 360);
    const rx = -dy, ry = dx; // right on the ground, for a camera looking along (dx, dy)
    const along = offY * dist * t * 1.4, side = offX * dist * t * aspect;
    target = { x: target.x + rx * side + dx * along, y: target.y + ry * side + dy * along, h: 0 };
    const d2 = nearestFit(target, dir, pts, aspect, vfovDeg);
    if (Number.isFinite(d2)) dist = d2;
  }
  return placed(target, dir, Math.max(MIN_DIST, Math.min(MAX_DIST, dist)));
}

/** Behind you, for the run (the dribble). */
export function chaseCam(you: { x: number; y: number }): Cam {
  return { pos: { x: you.x, y: you.y + 9, h: 6.5 }, target: { x: you.x, y: you.y - 10, h: 0 } };
}

/** The commentary: a slow broadcast look at the whole pitch. */
export function broadcastCam(t: number): Cam {
  return { pos: { x: 68 + 30, y: 45 + Math.sin(t * 0.05) * 6, h: 24 }, target: { x: 34 + Math.sin(t * 0.07) * 10, y: 35, h: 0 } };
}

/** The camera for any frame. */
export function cameraFor(f: Frame, aspect: number, vfovDeg: number, t: number): Cam {
  if (f.cameraMode === "broadcast") return broadcastCam(t);
  if (f.cameraMode === "chase" && f.bodies.length) return chaseCam(f.bodies[0]);
  return chanceCam(f, aspect, vfovDeg);
}
