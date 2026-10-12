/**
 * THE 2D'S OWN FRAME, IN 3D — Settings → Look → "3D camera: New".
 *
 * Harry, 12 Oct 2026, from his iPhone: "the framing is not exactly the same on
 * 3d and 2d so ur trying to draw the same chance but things get cut out. Like
 * on 2d it might be able to be a shot but on 3d it seems like a build up."
 * One corner chance had the camera inside the near stand, its roof over two
 * thirds of the screen.
 *
 * The 2D chance camera is a pitch rectangle (`viewport`), turned by `facing`,
 * then tipped back by the canvas tilt (lib/star/cameraTilt.ts), which crops the
 * near corners. `visibleQuad` is the exact patch of grass that ends up on the
 * phone. `solveMatch2D` puts a 3D camera (50–60° down, the 2D's own facing,
 * never turned) so that patch fills the screen: its corners on the screen's
 * edges, nothing of it cut, as little extra as the angle allows. A man on its
 * far edge keeps his head on screen; a goal in it keeps its bar.
 *
 * Pure (no three.js): tests/star/match2dCam.mts checks it over every chance kind.
 * Pitch metres as engineFrame: x across (goal centre CX), y out from the goal
 * line, z up. Three: X = x − CX, Y = z, Z = y.
 */
import { CX } from "../pitch";
import { canvasToScreen, screenToCanvas, type Tilt } from "../cameraTilt";
import { bcProject, type BcCamera, type BcFacing, type BcPoint } from "./broadcastCam";

export interface Frame2D {
  viewport: { x1: number; x2: number; y1: number; y2: number };
  facing: BcFacing;
  tilt: Tilt | null;
  /** Canvas box, CSS px. */
  W: number;
  H: number;
}

export const MATCH2D = {
  /** Candidate angles down from the horizon to the screen's middle (Harry: "about 40–60°"). */
  elevs: [50, 55, 60] as number[],
  /** Candidate vertical fields of view (a longer lens is closer to the 2D's own shape). */
  fovs: [26, 32, 38] as number[],
  /** Preferred angle; the others cost a little in the choice. */
  prefElev: 55,
  /** Room at every edge, CSS px. */
  marginPx: 3,
  /** Every man and the keeper, × life size, always (one size: PR #710's rule). Set to match the 2D's men at the same framing: the 2D's men measure 1.58–2.60× (median 1.72) a life-size 3D man there (tests/star/match2dCam.mts prints it): 1.75 is the median. */
  fig: 1.75,
  /** A man's true height, m. */
  manH: 1.8,
};
export type Match2DParams = typeof MATCH2D;

/** Canvas fraction (0..1 each way) -> pitch metres, for the 2D frame. */
export function canvasToPitch(f: Frame2D, sx: number, sy: number): BcPoint {
  const v = f.viewport;
  let fx: number, fy: number;
  if (f.facing === "right") { fy = 1 - sx; fx = sy; }
  else if (f.facing === "left") { fy = sx; fx = 1 - sy; }
  else { fx = sx; fy = sy; }
  return { x: v.x1 + fx * (v.x2 - v.x1), y: v.y1 + fy * (v.y2 - v.y1) };
}

/** Pitch metres -> where the 2D puts it on the phone (CSS px inside the box). */
export function pitchTo2dScreen(f: Frame2D, p: BcPoint): { X: number; Y: number } {
  const v = f.viewport;
  const fx = (p.x - v.x1) / (v.x2 - v.x1), fy = (p.y - v.y1) / (v.y2 - v.y1);
  const sx = f.facing === "right" ? 1 - fy : f.facing === "left" ? fy : fx;
  const sy = f.facing === "right" ? fx : f.facing === "left" ? 1 - fx : fy;
  return canvasToScreen(f.tilt, sx, sy, f.W, f.H);
}

/** Is a pitch spot on the 2D phone screen? */
export function on2dScreen(f: Frame2D, p: BcPoint, marginPx = 0): boolean {
  const s = pitchTo2dScreen(f, p);
  return s.X >= marginPx && s.X <= f.W - marginPx && s.Y >= marginPx && s.Y <= f.H - marginPx;
}

/**
 * The grass the 2D shows on the phone, as 4 pitch points in screen order:
 * top-left, top-right, bottom-right, bottom-left. (The tilt is a projection, so
 * the screen's edges are straight lines on the grass: 4 corners say it all.)
 */
export function visibleQuad(f: Frame2D): BcPoint[] {
  const c = (X: number, Y: number) => {
    const q = screenToCanvas(f.tilt, X, Y, f.W, f.H);
    return canvasToPitch(f, Math.max(0, Math.min(1, q.sx)), Math.max(0, Math.min(1, q.sy)));
  };
  return [c(0, 0), c(f.W, 0), c(f.W, f.H), c(0, f.H)];
}

/** The camera's ground direction (towards the camera): the 2D's own "down the screen". */
export function azimuth2D(facing: BcFacing): { ax: number; az: number } {
  return facing === "right" ? { ax: 1, az: 0 } : facing === "left" ? { ax: -1, az: 0 } : { ax: 0, az: 1 };
}

export function inPoly(poly: BcPoint[], p: BcPoint): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** The points a 2D frame makes the 3D keep on screen: its grass corners, heads on its far edge, a goal's bar. */
export function frame2dPoints(f: Frame2D, P: Match2DParams = MATCH2D): BcPoint[] {
  const q = visibleQuad(f);
  const head = P.manH * P.fig;
  const pts: BcPoint[] = [...q, { ...q[0], z: head }, { ...q[1], z: head }];
  for (const px of [CX - 3.66, CX + 3.66]) {
    const post = { x: px, y: 0 };
    if (inPoly(q, post)) pts.push({ ...post, z: 2.44 });
  }
  return pts;
}

export interface Match2DCamera extends BcCamera {
  /** Share of the grass on the 3D screen that the 2D does not show (0 = the same patch exactly). */
  extra: number;
  /** Nearest framed point's depth from the camera, m (the near clip sits inside it). */
  minDepth: number;
  elevDeg: number;
}

/** Where a 3D camera puts a screen ray on the grass (null: above the horizon). */
export function groundUnder(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number, nx: number, nyUp: number): BcPoint | null {
  const tV = Math.tan((c.fov * Math.PI) / 360), tH = tV * (W / H);
  const se = Math.sin(c.elev), ce = Math.cos(c.elev);
  const fwd = { x: -c.ax * ce, y: -se, z: -c.az * ce };
  const up = { x: -c.ax * se, y: ce, z: -c.az * se };
  const rt = { x: c.az, y: 0, z: -c.ax };
  const d = { x: fwd.x + rt.x * nx * tH + up.x * nyUp * tV, y: fwd.y + up.y * nyUp * tV, z: fwd.z + rt.z * nx * tH + up.z * nyUp * tV };
  if (d.y >= -1e-6) return null;
  const pos = { x: c.tx + c.ax * c.D * ce, y: c.D * se, z: c.tz + c.az * c.D * ce };
  const t = -pos.y / d.y;
  return { x: pos.x + d.x * t + CX, y: pos.z + d.z * t };
}

function fitAt(f: Frame2D, pts: BcPoint[], elevDeg: number, fov: number, P: Match2DParams): Match2DCamera {
  const { W, H } = f;
  const { ax, az } = azimuth2D(f.facing);
  const elev = (elevDeg * Math.PI) / 180;
  const mx = 1 - (2 * P.marginPx) / Math.max(1, W), myTop = P.marginPx / Math.max(1, H), myBot = 1 - myTop;
  let gx = 0, gy = 0;
  for (const p of pts) { gx += p.x; gy += p.y; }
  gx /= pts.length; gy /= pts.length;
  const cam = (D: number, a: number, s: number) => ({ tx: gx - CX - ax * a - az * s, tz: gy - az * a + ax * s, ax, az, elev, D, fov });
  const centred = (D: number) => {
    // up/down: the top and bottom points equally far from the screen's edges
    let lo = -120, hi = 120;
    const vbal = (a: number) => {
      let mn = Infinity, mxf = -Infinity;
      for (const p of pts) { const r = bcProject(cam(D, a, 0), W, H, p); if (r.depth <= 0.1) return 9; mn = Math.min(mn, r.fr); mxf = Math.max(mxf, r.fr); }
      return mn + mxf - 1;
    };
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (vbal(m) > 0) hi = m; else lo = m; }
    const a = (lo + hi) / 2;
    let sl = -120, sh = 120;
    const hbal = (s: number) => {
      let mn = Infinity, mxn = -Infinity;
      for (const p of pts) { const r = bcProject(cam(D, a, s), W, H, p); mn = Math.min(mn, r.nx); mxn = Math.max(mxn, r.nx); }
      return mn + mxn;
    };
    for (let i = 0; i < 40; i++) { const m = (sl + sh) / 2; if (hbal(m) > 0) sh = m; else sl = m; }
    return cam(D, a, (sl + sh) / 2);
  };
  const fits = (D: number) => {
    const c = centred(D);
    for (const p of pts) {
      const r = bcProject(c, W, H, p);
      if (r.depth <= 0.5 || Math.abs(r.nx) > mx || r.fr < myTop || r.fr > myBot) return false;
    }
    return true;
  };
  let lo = 4, hi = 600;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
  const c = centred(hi);
  const quad = visibleQuad(f);
  let ground = 0, outside = 0;
  for (let j = 0; j < 24; j++) for (let i = 0; i < 12; i++) {
    const g = groundUnder(c, W, H, ((i + 0.5) / 12) * 2 - 1, 1 - ((j + 0.5) / 24) * 2);
    if (!g) continue;
    ground++;
    if (!inPoly(quad, g)) outside++;
  }
  let minDepth = Infinity;
  for (const p of pts) minDepth = Math.min(minDepth, bcProject(c, W, H, p).depth);
  const anchor = { x: (quad[2].x + quad[3].x) / 2, y: (quad[2].y + quad[3].y) / 2 };
  const man = bcProject(c, W, H, anchor).fr - bcProject(c, W, H, { ...anchor, z: P.manH * P.fig }).fr;
  return { ...c, k: P.fig, man, anchorShare: bcProject(c, W, H, anchor).fr, extra: ground ? outside / ground : 0, minDepth, elevDeg };
}

/**
 * The 3D camera that shows the 2D's frame: every candidate angle and lens
 * tried, the one with the least extra grass kept (a small cost for leaving
 * `prefElev`). Pass `pick` to hold a chosen angle and lens through a chance.
 */
export function solveMatch2D(f: Frame2D, P: Match2DParams = MATCH2D, pick?: { elevDeg: number; fov: number }): Match2DCamera {
  const pts = frame2dPoints(f, P);
  if (pick) return fitAt(f, pts, pick.elevDeg, pick.fov, P);
  let best: Match2DCamera | null = null, bestScore = Infinity;
  for (const e of P.elevs) for (const fov of P.fovs) {
    const c = fitAt(f, pts, e, fov, P);
    const score = c.extra + Math.abs(e - P.prefElev) * 0.004;
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best!;
}
