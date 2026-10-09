/**
 * THE BROADCAST CAMERA for the career match in 3D (Settings → Look → "3D
 * camera: New", lib/star/style3d/realGameLook.ts).
 *
 * Harry, 9 Oct 2026, on his iPhone (Chelsea v Brentford): "dragging is having
 * to be done off the pitch alot and players too big, angle too low" — one
 * chance drawn straight top-down with dot men, one with you at the very
 * bottom edge, one with three huge men and half the frame empty grass.
 *
 * One camera for every chance kind, worked out here (pure: no three.js, so
 * tests/star/broadcastCam.mts checks it over every kind and many seeds):
 *
 *   - ONE ANGLE: `elevDeg` (40°) down from the horizon, always. Never top-down,
 *     never at the grass. Corners and side-on chances use the same angle,
 *     turned to suit (the 2D's side-on facing, swung `sideYawDeg` round
 *     behind the attack so the goal has depth).
 *   - ROOM TO DRAG: the anchor (the ball while you aim; where the ball was
 *     struck from while it flies) sits at `ballAt` (60%) of the screen's
 *     height, so 40% of the canvas below it is pitch. The drag starts and
 *     travels on the grass.
 *   - THE ACTION ONLY: the ball, you, the team-mates you can pass to, the
 *     nearest defenders, the keeper and goal mouth when the goal is in range.
 *     The camera comes as close as lets all of that fit.
 *   - MEN A SET SIZE: the figure scale k is picked so a man standing at the
 *     anchor is `manShare` (10%) of the canvas height (measured through this
 *     camera, not a fixed 1.6×), within [kMin, kMax].
 *
 * Pitch metres in, as engineFrame: x across (goal centre CX), y out from the
 * goal line, z up. Three: X = x − CX, Y = z, Z = y.
 */
import { CX } from "../pitch";

export type BcFacing = "up" | "left" | "right";

export interface BcPoint { x: number; y: number; z?: number }

export interface BcInput {
  /** Placed at `ballAt` of the screen height (the ball while aiming). */
  anchor: BcPoint;
  /** Everything that must be on the screen (the ball, the men in the action, goal posts …). */
  points: BcPoint[];
  facing: BcFacing;
  /** Canvas, CSS px. */
  W: number;
  H: number;
  /** The share of the canvas height the phone actually shows (0..1 from the top), default all. */
  vis?: { a: number; b: number };
}

export const BROADCAST = {
  /** Degrees down from the horizon. */
  elevDeg: 40,
  /** Vertical field of view, degrees. */
  fov: 40,
  /** The anchor (ball) this far down the screen. */
  ballAt: 0.6,
  /** … rising to this at most when the action is wide (see solveBroadcast). */
  ballAtMin: 0.55,
  /** Nothing framed above this share (a slim strip of stand shows) … */
  top: 0.07,
  /** … or below this. */
  bottom: 0.96,
  /** Room at the sides, CSS px. */
  marginPx: 14,
  /** A man at the anchor is this share of the canvas height. */
  manShare: 0.1,
  /** A man's true height, m. */
  manH: 1.8,
  kMin: 1,
  kMax: 3.2,
  /** Side-on chances: the camera swung this far round towards behind the attack. */
  sideYawDeg: 30,
  /**
   * Facing up with the ball out wide: the camera swung round behind the ball
   * towards the goal by this share of the ball→goal angle, at most `swingMaxDeg`
   * (a tight angle is filmed along the line of the shot, so the goal and the
   * ball both fit a phone held upright).
   */
  swingShare: 0.7,
  swingMaxDeg: 40,
  /** Never further than this (m). */
  Dmax: 160,
  /** The goal mouth joins the framing when the ball is this near the goal line (m). */
  goalRange: 30,
  /** The defenders kept on screen: this many nearest the ball, within `nearR` m. */
  nearDefenders: 2,
  nearR: 9,
  /** Any man this near the ball stays on screen. */
  closeR: 6,
  /** Our men this near the ball stay on screen (the ones you can pass to). */
  mateR: 24,
  /** … at most this many of them, the nearest, and none more than this far across (m): a winger 20 m wide may go off. */
  mates: 3,
  mateSide: 16,
};
export type BroadcastParams = typeof BROADCAST;

export interface BcCamera {
  /** Where the camera looks, on the grass (three X, Z). */
  tx: number;
  tz: number;
  /** Unit vector on the grass from the look point towards the camera (three X, Z). */
  ax: number;
  az: number;
  elev: number;
  D: number;
  fov: number;
  /** Figure scale (× life size). */
  k: number;
  /** A man at the anchor, share of the canvas height, at scale k. */
  man: number;
  /** The anchor's share down the screen. */
  anchorShare: number;
}

/** The camera's ground direction (towards the camera) for a 2D facing. */
export function azimuthFor(facing: BcFacing, P: BroadcastParams = BROADCAST, anchor?: BcPoint): { ax: number; az: number } {
  if (facing === "up") {
    if (!anchor) return { ax: 0, az: 1 };
    const ang = Math.atan2(anchor.x - CX, Math.max(4, anchor.y));
    const lim = (P.swingMaxDeg * Math.PI) / 180;
    const a = Math.max(-lim, Math.min(lim, ang * P.swingShare));
    return { ax: Math.sin(a), az: Math.cos(a) };
  }
  const s = (P.sideYawDeg * Math.PI) / 180;
  return { ax: (facing === "right" ? 1 : -1) * Math.cos(s), az: Math.sin(s) };
}

/** Project a pitch point through a broadcast camera: horizontal −1..1, and share down the screen. */
export function bcProject(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number, p: BcPoint): { nx: number; fr: number; depth: number } {
  const tV = Math.tan((c.fov * Math.PI) / 360), tH = tV * (W / H);
  const rx = p.x - CX - c.tx, rz = p.y - c.tz, z = p.z ?? 0;
  const along = rx * c.ax + rz * c.az;
  const side = rx * c.az - rz * c.ax;
  const se = Math.sin(c.elev), ce = Math.cos(c.elev);
  const depth = c.D - along * ce - z * se;
  const yc = -along * se + z * ce;
  return { nx: side / (Math.max(0.05, depth) * tH), fr: (1 - yc / (Math.max(0.05, depth) * tV)) / 2, depth };
}

/** Three.js placement for a solved camera. */
export function bcPose(c: BcCamera): { pos: [number, number, number]; look: [number, number, number] } {
  const ce = Math.cos(c.elev), se = Math.sin(c.elev);
  return { pos: [c.tx + c.ax * c.D * ce, c.D * se, c.tz + c.az * c.D * ce], look: [c.tx, 0, c.tz] };
}

/**
 * Solve the broadcast camera for one frame. When the action is too wide for
 * a man to reach the target size at `ballAt`, the anchor may rise to
 * `ballAtMin` (still ≥ 35% pitch below it) if that frames it closer.
 */
export function solveBroadcast(inp: BcInput, P: BroadcastParams = BROADCAST): BcCamera {
  const c = solveAt(inp, P, P.ballAt);
  if (c.man >= P.manShare * 0.98 || P.ballAtMin >= P.ballAt) return c;
  const c2 = solveAt(inp, P, P.ballAtMin);
  return c2.man > c.man + 0.002 ? c2 : c;
}

function solveAt(inp: BcInput, P: BroadcastParams, ballAt: number): BcCamera {
  const { W, H } = inp;
  const vis = inp.vis ?? { a: 0, b: 1 };
  const sh = (v: number) => vis.a + v * (vis.b - vis.a);
  const sb = sh(ballAt), top = sh(P.top), bottom = sh(P.bottom);
  const elev = (P.elevDeg * Math.PI) / 180;
  const se = Math.sin(elev), ce = Math.cos(elev);
  const tV = Math.tan((P.fov * Math.PI) / 360), tH = tV * (W / Math.max(1, H));
  const { ax, az } = azimuthFor(inp.facing, P, inp.anchor);
  const A = inp.anchor;
  const q = (2 * sb - 1) * tV;
  const xLim = 1 - (2 * P.marginPx) / Math.max(1, W);

  /** The look point for distance D (the anchor at `sb`), and its side offset. */
  const camAt = (D: number) => {
    const alongA = (q * D) / (se + q * ce);
    // relative to the anchor: along/side and depth of each point
    const rel = inp.points.map((p) => {
      const rx = p.x - A.x, rz = p.y - A.y, z = p.z ?? 0;
      const al = alongA + rx * ax + rz * az;
      const sd = rx * az - rz * ax;
      const depth = D - al * ce - z * se;
      return { al, sd, z, depth };
    });
    // centre the group across: the side offset that balances the outermost two
    let lo = -60, hi = 60;
    const span = (s: number) => {
      let mx = -Infinity, mn = Infinity;
      for (const r of rel) { if (r.depth <= 0.1) continue; const nx = (r.sd + s) / (r.depth * tH); mx = Math.max(mx, nx); mn = Math.min(mn, nx); }
      return mx + mn;
    };
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (span(m) > 0) hi = m; else lo = m; }
    // the anchor itself never past 70% of the way to a side
    const depthA = D - alongA * ce;
    const sMax = 0.7 * depthA * tH;
    const s = Math.max(-sMax, Math.min(sMax, (lo + hi) / 2));
    const tx = A.x - CX - ax * alongA - az * s;
    const tz = A.y - az * alongA + ax * s;
    return { tx, tz, ax, az, elev, D, fov: P.fov };
  };
  const fits = (D: number) => {
    const c = camAt(D);
    for (const p of inp.points) {
      const s = bcProject(c, W, H, p);
      if (s.depth <= 0.5) return false;
      if (Math.abs(s.nx) > xLim || s.fr < top || s.fr > bottom) return false;
    }
    return true;
  };
  const manAt = (D: number, k: number) => {
    const c = camAt(D);
    return bcProject(c, W, H, { x: A.x, y: A.y, z: 0 }).fr - bcProject(c, W, H, { x: A.x, y: A.y, z: P.manH * k }).fr;
  };
  // never so close that a true-size man is bigger than the target
  let lo = 2, hi = P.Dmax;
  if (manAt(hi, P.kMin) > P.manShare) lo = hi;
  else for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (manAt(m, P.kMin) > P.manShare) lo = m; else hi = m; }
  const Dsize = hi;
  let D = Dsize;
  if (!fits(D)) {
    let a = D, b = P.Dmax;
    if (!fits(b)) D = b;
    else { for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (fits(m)) b = m; else a = m; } D = b; }
  }
  const h1 = manAt(D, 1);
  const k = Math.max(P.kMin, Math.min(P.kMax, P.manShare / Math.max(1e-6, h1)));
  const c = camAt(D);
  return { ...c, k, man: manAt(D, k), anchorShare: bcProject(c, W, H, { x: A.x, y: A.y }).fr };
}

export interface BcFigure { sid: string; x: number; y: number; team: "us" | "them" }

/**
 * The points a chance frames: the ball, you, our men you can pass to, the
 * nearest defenders, anyone close to the ball, and — goal in range — the goal
 * mouth (posts and bar) and a keeper the 2D drew.
 */
export function actionPoints(
  ball: BcPoint, figures: BcFigure[], keeper: { x: number; y: number; drawn?: boolean } | null,
  goalInView: boolean, P: BroadcastParams = BROADCAST,
): BcPoint[] {
  const near = (g: { x: number; y: number }) => Math.hypot(g.x - ball.x, g.y - ball.y);
  const them = figures.filter((g) => g.team === "them" && near(g) <= P.nearR).sort((a, b) => near(a) - near(b)).slice(0, P.nearDefenders);
  const mates = figures.filter((g) => g.team === "us" && g.sid !== "you" && near(g) <= P.mateR && Math.abs(g.x - ball.x) <= P.mateSide)
    .sort((a, b) => near(a) - near(b)).slice(0, P.mates);
  const keep = figures.filter((g) => g.sid === "you" || them.includes(g) || mates.includes(g) || near(g) <= P.closeR);
  const pts: BcPoint[] = [{ x: ball.x, y: ball.y, z: Math.max(0, ball.z ?? 0) }, ...keep.map((g) => ({ x: g.x, y: g.y }))];
  if (goalInView || ball.y < P.goalRange) {
    pts.push({ x: CX - 3.66, y: 0 }, { x: CX + 3.66, y: 0 }, { x: CX - 3.66, y: 0, z: 2.44 }, { x: CX + 3.66, y: 0, z: 2.44 });
    if (keeper && keeper.drawn !== false) pts.push({ x: keeper.x, y: keeper.y });
  }
  return pts;
}
