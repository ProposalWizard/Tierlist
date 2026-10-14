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
import { SIZE3D } from "./size3d";
import { canvasToScreen, screenToCanvas, type Tilt } from "../cameraTilt";
import { bcProject, type BcCamera, type BcFacing, type BcPoint } from "./broadcastCam";
import { stanceFor, shotTarget } from "./setPiece3d";

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
  /**
   * Men's size: a man (leaned, below) at the middle of the action is this share of the
   * screen's height. Coordinator, 12 Oct 2026 (Harry wants them clearly readable): "use at
   * least the old 6% … size against the screen, not a fixed factor". The size is worked out
   * ONCE when a chance starts and held for the whole chance (PR #710: never resized as the
   * camera moves); only a new chance may pick a new size.
   */
  manShare: 0.06,
  /** … within these sizes (× life): */
  figMin: 1.5,
  figMax: 3.0,
  /** The size used to frame heads before the size is known (and by the tests). */
  fig: 1.8,
  /** A man's true height, m. */
  manH: 1.8,
  /**
   * Men lean back from the camera (feet planted, picture only) by (angle − this)°, so a man
   * reads about as tall as at 40° down whatever the angle (60° alone halves him; the 2D draws
   * him upright, full height). Lead's review of the first corner sheet: "the men are tiny".
   */
  leanFromDeg: 40,
  /** The grass beyond the pitch's edge on the camera's side the 3D keeps in frame, m (the 2D shows more of it; in 3D it is the stand's base: a black band). */
  apron: 3,
};
export type Match2DParams = typeof MATCH2D;

/**
 * ONE SIZE FOR EVERYTHING, ALWAYS (Harry, 12 Oct 2026): "no changes in size for any player
 * or goalie or goal should ever occur". Each object has ONE fixed scale (× real life), the
 * same in every chance and every frame. It never follows the camera and is never worked out
 * per chance (before: the men were sized per chance to ~6% of the screen, 1.5–3.0×).
 * A man reads smaller on a wide side-on chance: that is the camera being further away.
 *
 * `lean`: men lean back from the camera by (angle − 40°) (picture only, feet planted).
 * `goal`: the goal frame (posts, bar, net) about the middle of its line. The pitch lines
 * stay true: they sit under the ball and the men (a scaled box would move the spot off the ball).
 *
 * DEFAULT: A, real proportions (Harry on the first penalty still: "the goalie's head is out the damn goal").
 * B and C are comparison stills only (scripts/cam3d/scale.mts measures them); `current`
 * is the old per-chance median, fixed (for before stills).
 */
export interface MatchScale { man: number; keeper: number; goal: number; lean: boolean }
export const MATCH_SCALES = {
  /** The median of the old per-chance size (2.02×), held fixed; the keeper the same as a man (as the new camera drew him). */
  current: { man: 2.0, keeper: 2.0, goal: 1, lean: true },
  /** A: real life. Men, keeper and goal all true size, no lean: the man-to-goal ratio is real. */
  A: { man: SIZE3D.man, keeper: SIZE3D.keeper, goal: SIZE3D.goal, lean: false },
  /** B: men as now; the goal frame scaled up so man-to-goal on screen matches the 2D view. */
  B: { man: 2.0, keeper: 2.0, goal: 2.5, lean: true },
  /** C: halfway between A and B. */
  C: { man: 1.5, keeper: 1.5, goal: 1.75, lean: true },
} satisfies Record<string, MatchScale>;
export type MatchScaleId = keyof typeof MATCH_SCALES;
/**
 * A: real size, the one absolute size (size3d.ts SIZE3D). B, C and `current` are only numbers the
 * comparison script (scripts/cam3d/scale.mts) measures on paper; nothing in a game reads them,
 * and no address-bar flag picks them any more (?mscale= removed, 12 Oct 2026).
 */
export const MATCH_SCALE_PICK: MatchScaleId = "A";
/** The scale in use: always A, real size. Never read from the page, the camera or the chance. */
export function matchScale(): MatchScale {
  return MATCH_SCALES.A;
}

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

/**
 * The 2D's grass, minus what lies more than `apron` m past the pitch's edge on the
 * camera's side (no man stands there; in 3D it is the stand's base, a dark band).
 */
export function framedQuad(f: Frame2D, P: Match2DParams = MATCH2D): BcPoint[] {
  const { ax, az } = azimuth2D(f.facing);
  const edge = Math.abs(ax) > 0.5 ? CX : 105;
  return visibleQuad(f).map((p) => {
    const along = (p.x - CX) * ax + p.y * az;
    const over = along - (edge + P.apron);
    return over > 0 ? { x: p.x - ax * over, y: p.y - az * over } : p;
  });
}

/** The points a 2D frame makes the 3D keep on screen: its grass corners, heads on its far edge, a goal's bar. */
export function frame2dPoints(f: Frame2D, P: Match2DParams = MATCH2D): BcPoint[] {
  const q = framedQuad(f, P);
  const head = P.manH * P.figMax;
  const pts: BcPoint[] = [...q, { ...q[0], z: head }, { ...q[1], z: head }];
  for (const px of [CX - 3.66, CX + 3.66]) {
    const post = { x: px, y: 0 };
    if (inPoly(q, post)) pts.push({ ...post, z: 2.44 });
  }
  return pts;
}

/** The men's lean back from the camera (radians) at this angle down. */
export function leanFor(elevDeg: number, P: Match2DParams = MATCH2D): number {
  return (Math.max(0, elevDeg - P.leanFromDeg) * Math.PI) / 180;
}

/** A man of height h at `at`, leaned back from the camera by `lean`: his share of the screen's height. */
export function leanedManShare(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number, at: BcPoint, h: number, lean: number): number {
  const head = { x: at.x - c.ax * h * Math.sin(lean), y: at.y - c.az * h * Math.sin(lean), z: h * Math.cos(lean) };
  return bcProject(c, W, H, at).fr - bcProject(c, W, H, head).fr;
}

export interface Match2DCamera extends BcCamera {
  /** Share of the grass on the 3D screen that the 2D does not show (0 = the same patch exactly). */
  extra: number;
  /** k: the men's size for this chance (× life). man: a man there, share of the height. */
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
  const pinBottom = framedQuad(f, P).some((p, i) => p !== visibleQuad(f)[i] && (Math.abs(p.x - visibleQuad(f)[i].x) > 1e-6 || Math.abs(p.y - visibleQuad(f)[i].y) > 1e-6));
  const { ax, az } = azimuth2D(f.facing);
  const elev = (elevDeg * Math.PI) / 180;
  const mx = 1 - (2 * P.marginPx) / Math.max(1, W), myTop = P.marginPx / Math.max(1, H), myBot = 1 - myTop;
  let gx = 0, gy = 0;
  for (const p of pts) { gx += p.x; gy += p.y; }
  gx /= pts.length; gy /= pts.length;
  const cam = (D: number, a: number, s: number) => ({ tx: gx - CX - ax * a - az * s, tz: gy - az * a + ax * s, ax, az, elev, D, fov });
  const centred = (D: number) => {
    // up/down: the top and bottom points equally far from the screen's edges, except when the
    // 2D's view runs off the pitch on the camera's side: then the bottom sits on the screen's
    // bottom edge (room goes above the action, never a dark band of stand base below it)
    let lo = -120, hi = 120;
    const vbal = (a: number) => {
      let mn = Infinity, mxf = -Infinity;
      for (const p of pts) { const r = bcProject(cam(D, a, 0), W, H, p); if (r.depth <= 0.1) return 9; mn = Math.min(mn, r.fr); mxf = Math.max(mxf, r.fr); }
      return pinBottom ? mxf - myBot : mn + mxf - 1;
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
  const quad = framedQuad(f, P);
  let ground = 0, outside = 0;
  for (let j = 0; j < 24; j++) for (let i = 0; i < 12; i++) {
    const g = groundUnder(c, W, H, ((i + 0.5) / 12) * 2 - 1, 1 - ((j + 0.5) / 24) * 2);
    if (!g) continue;
    ground++;
    if (!inPoly(quad, g)) outside++;
  }
  let minDepth = Infinity;
  for (const p of pts) minDepth = Math.min(minDepth, bcProject(c, W, H, p).depth);
  // the middle of the action: the grass 65% down the screen
  const anchor = groundUnder(c, W, H, 0, -0.3) ?? { x: (quad[2].x + quad[3].x) / 2, y: (quad[2].y + quad[3].y) / 2 };
  const life = leanedManShare(c, W, H, anchor, P.manH, leanFor(elevDeg, P));
  const k = Math.max(P.figMin, Math.min(P.figMax, P.manShare / Math.max(1e-6, life)));
  return { ...c, k, man: life * k, anchorShare: bcProject(c, W, H, anchor).fr, extra: ground ? outside / ground : 0, minDepth, elevDeg };
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

/**
 * THE SET-PIECE CAMERA (Harry, 12 Oct 2026): every chance is framed like the 2D (wide) EXCEPT
 * a penalty and a direct free kick, which get a closer camera: the ball, the taker, the keeper,
 * the whole goal and the wall stay on screen, and the taker and keeper read at about
 * `targetShare` of the screen's height. Only the camera moves: nothing is scaled (the one fixed
 * scale, MATCH_SCALES, still holds). Touch still lands right: the 3D view maps every touch
 * through the grass under the finger (engineView.ts groundAt → to2dClient).
 */
export const SET_PIECE_CAM = {
  kinds: ["penalty", "free_kick"] as string[],
  elevs: [45, 50, 55, 60] as number[],
  fovs: [26, 32, 38] as number[],
  /** A man at the ball, share of the screen's height, aimed for (Harry: "about 5–6%"). */
  targetShare: 0.055,
  /** A penalty: pulled back so the man reads about 4% of the height (Harry, 12 Oct 2026). Real size, so the keeper stays under the bar. */
  penaltyShare: 0.04,
  /** Room at every edge, share of the screen (the goal's posts, the taker's feet). */
  margin: 0.04,
  /**
   * Free pitch below the ball for a full-power drag back, as a share of the screen's WIDTH:
   * the 2D's longest full-power drag (dragForFullPower at power 0 = 0.14 × DRAG_LENGTH_SCALE 0.75
   * = 0.105 of the classic 5:8 canvas height, i.e. 0.168 of the width), plus a finger's room.
   */
  dragRoomW: 0.168 + 0.03,
};

/** The free pitch below the ball the drag needs, as a share of the screen's height. */
export function dragRoomShare(W: number, H: number, S = SET_PIECE_CAM): number { return (S.dragRoomW * W) / Math.max(1, H); }

type SpCam = Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov"> & { minDepth: number; elevDeg: number };
export function usesSetPieceCam(kind: string): boolean { return SET_PIECE_CAM.kinds.includes(kind); }

/**
 * Fit a camera from this azimuth to `pts` (all on screen, centred), at angle `elevDeg` and lens
 * `fov`, no nearer than `minD`. Returns the camera and the nearest point's depth.
 */
export function fitPoints(W: number, H: number, pts: BcPoint[], ax: number, az: number, elevDeg: number, fov: number, margin: number, minD = 4): SpCam {
  const elev = (elevDeg * Math.PI) / 180;
  let gx = 0, gy = 0;
  for (const p of pts) { gx += p.x; gy += p.y; }
  gx /= pts.length; gy /= pts.length;
  const cam = (D: number, a: number, s: number) => ({ tx: gx - CX - ax * a - az * s, tz: gy - az * a + ax * s, ax, az, elev, D, fov });
  const centred = (D: number) => {
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
  const mx = 1 - 2 * margin, my0 = margin, my1 = 1 - margin;
  const fits = (D: number) => {
    const c = centred(D);
    for (const p of pts) {
      const r = bcProject(c, W, H, p);
      if (r.depth <= 0.5 || Math.abs(r.nx) > mx || r.fr < my0 || r.fr > my1) return false;
    }
    return true;
  };
  let lo = minD, hi = 600;
  if (!fits(lo)) { for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; } } else hi = lo;
  const c = centred(hi);
  let minDepth = Infinity;
  for (const p of pts) minDepth = Math.min(minDepth, bcProject(c, W, H, p).depth);
  return { ...c, minDepth, elevDeg };
}

/**
 * The closer camera for a penalty or a free kick. `keep` = the points that must stay on screen
 * (ball, taker, keeper, the goal's posts and bar, the wall: feet and heads). Tries each angle and
 * lens; keeps the one whose man at the ball is nearest `targetShare` (never nearer than all of
 * `keep` allows). Facing as the 2D. Pure: tests/star/match2dCam.mts.
 */
export function solveSetPieceCam(f: Frame2D, keep: BcPoint[], ball: BcPoint, man: MatchScale, S = SET_PIECE_CAM, target = S.targetShare): Match2DCamera {
  const { ax, az } = azimuth2D(f.facing);
  let best: (SpCam & { share: number }) | null = null, bestScore = Infinity;
  // a full drag back must fit under the ball: if the ball sits too low, keep a spot of grass
  // further towards the camera on screen too (the camera backs off / slides; nothing is scaled)
  const room = dragRoomShare(f.W, f.H, S);
  const withRoom = (e: number, fov: number, minD?: number) => {
    let pts = keep, c = fitPoints(f.W, f.H, pts, ax, az, e, fov, S.margin, minD);
    for (let i = 0, d = 1; i < 24 && bcProject(c, f.W, f.H, ball).fr > 1 - S.margin - room; i++, d += 1) {
      pts = [...keep, { x: ball.x + ax * d, y: ball.y + az * d, z: 0 }];
      c = fitPoints(f.W, f.H, pts, ax, az, e, fov, S.margin, minD);
    }
    return c;
  };
  for (const e of S.elevs) for (const fov of S.fovs) {
    let c = withRoom(e, fov);
    const lean = man.lean ? leanFor(e) : 0;
    let share = leanedManShare(c, f.W, f.H, ball, MATCH2D.manH * man.man, lean);
    // closer than the target needs: back off (more room round the action), the angle and lens kept
    if (share > target) {
      let lo = c.D, hi = c.D * 4;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        const cm = withRoom(e, fov, m);
        if (leanedManShare(cm, f.W, f.H, ball, MATCH2D.manH * man.man, lean) > target) lo = m; else hi = m;
      }
      c = withRoom(e, fov, hi);
      share = leanedManShare(c, f.W, f.H, ball, MATCH2D.manH * man.man, lean);
    }
    const score = Math.abs(share - target) + Math.abs(e - 50) * 0.0004;
    if (score < bestScore) { bestScore = score; best = { ...c, share }; }
  }
  const b = best!;
  return { ...b, k: man.man, man: b.share, anchorShare: bcProject(b, f.W, f.H, ball).fr, extra: 0 } as Match2DCamera;
}

/** What a penalty / free kick camera must keep on screen, from the frame's own men. */
export function setPieceKeep(ball: BcPoint, figures: { sid: string; x: number; y: number; team: string }[], keeper: BcPoint | null, man: MatchScale): BcPoint[] {
  const hm = MATCH2D.manH * man.man, hk = MATCH2D.manH * man.keeper, gh = 2.44 * man.goal, gw = 3.66 * man.goal;
  const pts: BcPoint[] = [{ ...ball, z: 0 }, { ...ball, z: 0.3 }];
  for (const px of [CX - gw, CX + gw]) pts.push({ x: px, y: 0, z: 0 }, { x: px, y: 0, z: gh });
  if (keeper) pts.push({ ...keeper, z: 0 }, { ...keeper, z: hk });
  for (const g of figures) {
    // the taker, and the wall: their men between the ball and the goal, near the line of the kick
    const wall = g.team === "them" && g.y < ball.y + 1 && g.y > 1 && Math.abs(g.x - ball.x) < 14;
    if (g.sid === "you" || wall) pts.push({ x: g.x, y: g.y, z: 0 }, { x: g.x, y: g.y, z: hm });
  }
  return pts;
}

/**
 * THE CORNER CAMERA (Harry, 12 Oct 2026, on a corner still with the camera 111 m away: "this still
 * looks rlly bad"). The 2D's wide frame has to fit the flag AND the box, so every man was a dot.
 * Corners get their own closer camera, like penalties and free kicks. Camera only: nothing scaled.
 *   A: the box only (its men, the keeper, the goal); the taker just off screen.
 *   B: the box from lower (38–42°) and turned ~35° more side-on; the taker at an edge.
 *   C: the set-piece way: ball, taker, the box's men, keeper and goal all kept, 45–60° down.
 * `pick` is the one in the game ("off": the 2D's own frame, as before).
 */
export const CORNER_CAM = {
  /**
   * Harry, 12 Oct 2026, on the A/B/C stills: liked B ("very cool, not executed perfectly") and C, and
   * wants the corner to START wide (B or C) and glide to A (the box) right after the kick, while the
   * ball is in the air. `pick` "glide" does that; "A" | "B" | "C" hold one framing; "off" = the 2D's frame.
   */
  pick: "glide" as "A" | "B" | "C" | "glide" | "off",
  /** The glide: the start view (B or C) seeded per corner while Harry sees both. */
  starts: ["B", "C"] as ("B" | "C")[],
  /** Seconds from the kick to the box framing (eased, never a cut). */
  glideS: 0.42,
  /** The box framing follows the ball's landing spot this much (0 none, 1 centred on it). */
  followLanding: 0.5,
  margin: 0.05,
  /** The box's men: within this far of the goal line and of the goal's middle, m. */
  boxDepth: 20,
  boxHalfW: 24,
};
/**
 * Kinds that get the corner's camera and glide in the 3D match. Harry, 12 Oct 2026: byline crosses
 * (a deep cross from wide) "the SAME rules as a corner": start wide, glide into the box from the kick,
 * following the landing spot. 3D only; the 2D frames them as before.
 */
export const CORNER_CAM_KINDS = ["corner", "byline_cross"];
export function usesCornerCam(kind: string): boolean { return CORNER_CAM_KINDS.includes(kind) && CORNER_CAM.pick !== "off"; }

export function solveCornerCam(
  f: Frame2D, ball: BcPoint, figures: { sid: string; x: number; y: number; team: string }[], keeper: BcPoint | null,
  man: MatchScale, variant: "A" | "B" | "C" = CORNER_CAM.pick === "off" || CORNER_CAM.pick === "glide" ? "C" : CORNER_CAM.pick,
): Match2DCamera {
  const hm = MATCH2D.manH * man.man, gh = 2.44 * man.goal, gw = 3.66 * man.goal;
  const box: BcPoint[] = [];
  for (const px of [CX - gw, CX + gw]) box.push({ x: px, y: 0, z: 0 }, { x: px, y: 0, z: gh });
  if (keeper) box.push({ ...keeper, z: 0 }, { ...keeper, z: MATCH2D.manH * man.keeper });
  for (const g of figures) {
    if (g.sid === "you") continue;
    if (g.y < CORNER_CAM.boxDepth && Math.abs(g.x - CX) < CORNER_CAM.boxHalfW) box.push({ x: g.x, y: g.y, z: 0 }, { x: g.x, y: g.y, z: hm });
  }
  const taker = figures.find((g) => g.sid === "you");
  const withTaker: BcPoint[] = [...box, { ...ball, z: 0 }, ...(taker ? [{ x: taker.x, y: taker.y, z: 0 }, { x: taker.x, y: taker.y, z: hm }] : [])];
  const base = azimuth2D(f.facing);
  const azs = variant === "B"
    ? [35, -35].map((d) => { const r = (d * Math.PI) / 180; return { ax: base.ax * Math.cos(r) - base.az * Math.sin(r), az: base.ax * Math.sin(r) + base.az * Math.cos(r) }; })
    : [base];
  const elevs = variant === "B" ? [38, 42] : variant === "A" ? [50, 55, 60] : [45, 50, 55, 60];
  const keep = variant === "A" ? box : withTaker;
  const mid = { x: CX, y: 8 };
  let best: (SpCam & { share: number }) | null = null;
  for (const a of azs) for (const e of elevs) for (const fov of [26, 32, 38]) {
    const c = fitPoints(f.W, f.H, keep, a.ax, a.az, e, fov, CORNER_CAM.margin);
    const share = leanedManShare(c, f.W, f.H, mid, hm, 0);
    if (!best || share > best.share) best = { ...c, share };
  }
  const b = best!;
  return { ...b, k: man.man, man: b.share, anchorShare: bcProject(b, f.W, f.H, ball).fr, extra: 0 } as Match2DCamera;
}

/**
 * THE 3D-ONLY CAMERAS FOR TWO OPEN-PLAY KINDS (Harry, 12 Oct 2026). The 2D frames these as before.
 *  - cutback: SIDE-ON, from the touchline on the ball's side (as the side-on comparison he liked),
 *    framed tight on the action (the one-on-one at ~38 m "looked great"; side-on at 85 m was too far).
 *  - tight_angle: a FIFA-style broadcast angle "from over the players, behind the player's head":
 *    low behind and above the taker, looking at goal; the goal, keeper and near defenders in view.
 * Camera only: nothing is scaled. Pure: tests/star/match2dCam.mts.
 */
export const KIND_CAM = {
  kinds: ["cutback", "tight_angle"] as string[],
  sideOn: { elevs: [40, 45, 50], fovs: [26, 32, 38], margin: 0.05 },
  /** The broadcast angle: degrees down; and the least angle off the goal line the camera looks from (opens the goal mouth). */
  behind: { elevs: [26, 30, 34], fovs: [32, 38, 44], margin: 0.04, minOffLineDeg: 32, prefElev: 30, shoulderDeg: 14 },
  /** Men kept round the goal: within this far out from the goal line and of the goal's middle, m. */
  boxDepth: 18, boxHalfW: 20,
  /** Tight angle: also men within this far of the ball. */
  nearBall: 6,
  /** Tight angle: men within this far of the line from the ball to the goal's middle are "ahead" (kept in view). */
  aheadW: 5,
  /** Tight angle: the ball's spot, share of the screen's height down (the taker below it, the goal above). */
  behindBallAt: 0.7,
  /** Tight angle: a man at the ball at most this share of the screen's height (about the one-on-one's
   *  closeness; nearer, the camera backs off; Harry: "framed as tight as the one-on-one"). */
  behindShare: 0.07,
};
function segDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2));
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
}

/**
 * Behind the taker: the camera's ground line runs through the ball (the ball in the screen's middle,
 * left to right, at `behindBallAt` down), and it comes as close as `keep` allows. Width-bound on a phone.
 */
function fitBehind(W: number, H: number, keep: BcPoint[], ball: BcPoint, ax: number, az: number, elevDeg: number, fov: number, margin: number, minD = 4): SpCam {
  const elev = (elevDeg * Math.PI) / 180;
  const cam = (D: number, a: number) => ({ tx: ball.x - CX - ax * a, tz: ball.y - az * a, ax, az, elev, D, fov });
  const at = (D: number) => {
    let lo = -80, hi = 80;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (bcProject(cam(D, m), W, H, ball).fr > KIND_CAM.behindBallAt) hi = m; else lo = m; }
    return cam(D, (lo + hi) / 2);
  };
  const fits = (D: number) => {
    const c = at(D);
    for (const p of keep) { const r = bcProject(c, W, H, p); if (r.depth <= 0.5 || Math.abs(r.nx) > 1 - 2 * margin || r.fr < margin || r.fr > 1 - margin) return false; }
    return true;
  };
  let lo = minD, hi = 400;
  if (fits(lo)) hi = lo; else for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fits(m)) hi = m; else lo = m; }
  const c = at(hi);
  let minDepth = Infinity;
  for (const p of keep) minDepth = Math.min(minDepth, bcProject(c, W, H, p).depth);
  return { ...c, minDepth, elevDeg };
}
export function usesKindCam(kind: string): boolean { return KIND_CAM.kinds.includes(kind); }

type Fig = { sid: string; x: number; y: number; team: string; kickFoot?: number };

/** The points the kind's camera keeps on screen: ball, taker, keeper, the goal, the men in the action. */
export function kindCamKeep(kind: string, ball: BcPoint, figures: Fig[], keeper: BcPoint | null, man: MatchScale): BcPoint[] {
  const hm = MATCH2D.manH * man.man, gh = 2.44 * man.goal, gw = 3.66 * man.goal;
  const pts: BcPoint[] = [{ ...ball, z: 0 }, { ...ball, z: 0.3 }];
  for (const px of [CX - gw, CX + gw]) pts.push({ x: px, y: 0, z: 0 }, { x: px, y: 0, z: gh });
  if (keeper) pts.push({ ...keeper, z: 0 }, { ...keeper, z: MATCH2D.manH * man.keeper });
  const K = KIND_CAM;
  for (const g of figures) {
    const inBox = g.y < K.boxDepth && Math.abs(g.x - CX) < K.boxHalfW;
    const near = Math.hypot(g.x - ball.x, g.y - ball.y) < K.nearBall;
    // a tight angle: what is ahead of the taker (men on or by the line from the ball to the goal), and men at the ball
    const ahead = segDist(g, ball, { x: CX, y: 0 }) < K.aheadW && g.y < ball.y + 1;
    const keep = g.sid === "you" || (kind === "cutback" ? inBox || g.sid === "run0" : ahead || near);
    if (keep) pts.push({ x: g.x, y: g.y, z: 0 }, { x: g.x, y: g.y, z: hm });
  }
  // the 3D stands you behind the ball in the shot's direction (setPiece3d.ts stanceFor), either foot
  const kf = figures.find((g) => g.sid === "you")?.kickFoot;
  for (const foot of kf ? [kf] : [1, -1]) {
    const s = stanceFor(kind, ball, shotTarget(kind, null, ball), foot);
    pts.push({ ...s, z: 0 }, { ...s, z: hm });
  }
  return pts;
}

/** The kind's camera's ground direction (towards the camera). */
export function kindCamAzimuth(kind: string, ball: BcPoint, foot = 1): { ax: number; az: number } {
  if (kind === "cutback") return { ax: ball.x >= CX ? 1 : -1, az: 0 };
  // behind the ball, on the line from the goal's middle through it, opened to at least minOffLineDeg off the goal line
  const side = ball.x >= CX ? 1 : -1;
  const off = Math.max((KIND_CAM.behind.minOffLineDeg * Math.PI) / 180, Math.atan2(Math.max(0, ball.y), Math.abs(ball.x - CX)));
  let ax = side * Math.cos(off), az = Math.sin(off);
  // over the shoulder: turned away from the side he stands on, so his body never hides the ball
  const st = stanceFor(kind, ball, shotTarget(kind, null, ball), foot);
  const cr = ax * (st.y - ball.y) - az * (st.x - ball.x);
  const r = (-Math.sign(cr || 1) * KIND_CAM.behind.shoulderDeg * Math.PI) / 180;
  [ax, az] = [ax * Math.cos(r) - az * Math.sin(r), ax * Math.sin(r) + az * Math.cos(r)];
  return { ax, az };
}

export function solveKindCam(kind: string, f: Frame2D, ball: BcPoint, figures: Fig[], keeper: BcPoint | null, man: MatchScale): Match2DCamera {
  const keep = kindCamKeep(kind, ball, figures, keeper, man);
  const { ax, az } = kindCamAzimuth(kind, ball, figures.find((g) => g.sid === "you")?.kickFoot ?? 1);
  const side = kind === "cutback";
  const S = side ? KIND_CAM.sideOn : KIND_CAM.behind;
  const hm = MATCH2D.manH * man.man;
  let best: (SpCam & { share: number; score: number }) | null = null;
  for (const e of S.elevs) for (const fov of S.fovs) {
    let c = keepDragRoom(side ? fitPoints(f.W, f.H, keep, ax, az, e, fov, S.margin) : fitBehind(f.W, f.H, keep, ball, ax, az, e, fov, S.margin), ball, f.W, f.H);
    // behind: closer than the one-on-one needs → back off (angle and lens kept)
    if (!side && leanedManShare(c, f.W, f.H, ball, hm, 0) > KIND_CAM.behindShare) {
      let lo = c.D, hi = c.D * 6;
      for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (leanedManShare(fitBehind(f.W, f.H, keep, ball, ax, az, e, fov, S.margin, m), f.W, f.H, ball, hm, 0) > KIND_CAM.behindShare) lo = m; else hi = m; }
      c = keepDragRoom(fitBehind(f.W, f.H, keep, ball, ax, az, e, fov, S.margin, hi), ball, f.W, f.H);
    }
    let off = false;
    for (const p of keep) { const r = bcProject(c, f.W, f.H, p); if (r.depth <= 0.5 || Math.abs(r.nx) > 1 || r.fr < 0 || r.fr > 1) { off = true; break; } }
    if (off) continue;
    const share = leanedManShare(c, f.W, f.H, ball, hm, 0);
    // side-on: the tightest; behind: the tightest near the preferred angle
    const score = -share + (side ? 0 : Math.abs(e - KIND_CAM.behind.prefElev) * 0.002);
    if (!best || score < best.score) best = { ...c, minDepth: Math.min(c.minDepth, ...keep.map((p) => bcProject(c, f.W, f.H, p).depth)), share, score };
  }
  if (!best) { const c = fitPoints(f.W, f.H, keep, ax, az, S.elevs[0], S.fovs[S.fovs.length - 1], S.margin); best = { ...c, share: leanedManShare(c, f.W, f.H, ball, hm, 0), score: 0 }; }
  const b = best;
  return { ...b, k: man.man, man: b.share, anchorShare: bcProject(b, f.W, f.H, ball).fr, extra: 0 } as Match2DCamera;
}

/** The whole scenario the 2D draws, seen from this camera's side (the zoom's far end for a turned camera). */
export function wideFromSide(f: Frame2D, c: Pick<BcCamera, "ax" | "az" | "fov"> & { elevDeg: number }, P: Match2DParams = MATCH2D): Match2DCamera {
  const pts = frame2dPoints(f, P);
  const w = fitPoints(f.W, f.H, pts, c.ax, c.az, c.elevDeg, c.fov, P.marginPx / Math.max(1, f.H));
  return { ...w, k: 1, man: 0, anchorShare: 0, extra: 0 } as Match2DCamera;
}

/**
 * THE CAMERA SWIPE (Harry, 12 Oct 2026): a one-finger sideways drag that does NOT start on the ball or
 * on a team-mate turns the view round the ball, to find the team-mate you want (13 Oct: a full turn, ±180°;
 * a drag across the whole screen is half a turn). At most `maxDeg` either
 * way; a drag across the whole screen turns `degPerWidth`; when the chance ends it eases back over about
 * `easeS`. Camera only: the ball keeps its spot on the screen, the distance and angle down are kept.
 * Such a drag never reaches the 2D game, so it can never start a kick (engineView.ts onDown/onMove).
 */
export const ORBIT = { maxDeg: 180, degPerWidth: 180, easeS: 0.35, startPx: 10, sideways: 1.2, centreDeg: 15, centreTilt: 5, centreS: 0.3, autoTilt: 0 };
/** autoTilt 0 (13 Oct 2026): turned views read as near top-down; the turned framing (frameTurned) now keeps the stands off the screen by backing off and sliding instead. */
/** Harry, 13 Oct 2026: a full turn round our player is allowed, so ±180° (the same view either end). */
export function clampOrbit(deg: number): number { return Math.max(-ORBIT.maxDeg, Math.min(ORBIT.maxDeg, deg)); }
/**
 * ORBIT ROUND OUR PLAYER, CENTRED (Harry, 13 Oct 2026). How far the camera's look point has moved onto the
 * ball (0 = the default framing, 1 = the ball in the middle): full once turned `centreDeg` or tilted
 * `centreTilt`, or while a finger/mouse is turning it.
 */
export function centreShare(deg: number, tilt: number, dragging = false): number {
  if (dragging) return 1;
  return Math.max(0, Math.min(1, Math.max(Math.abs(deg) / ORBIT.centreDeg, Math.abs(tilt) / ORBIT.centreTilt)));
}
/**
 * The camera with the ball (our player's spot) moved `share` of the way to the middle of the screen:
 * the look point slides along the grass onto the ball, then back towards the camera only as far as the
 * room to drag back needs (keepDragRoom). Distance, angle and lens are kept: nothing changes size.
 */
export function centreOnPivot<T extends Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">>(c: T, ball: BcPoint, share: number, W: number, H: number, S = SET_PIECE_CAM): T {
  if (share <= 0) return c;
  const full = keepDragRoom({ ...c, tx: ball.x - CX, tz: ball.y }, ball, W, H, S);
  const u = Math.min(1, share);
  return { ...c, tx: c.tx + (full.tx - c.tx) * u, tz: c.tz + (full.tz - c.tz) * u };
}
/** The camera turned `deg` round the ball (on the grass): the look point and the camera's side both turn. */
export function orbitCamera<T extends Pick<BcCamera, "tx" | "tz" | "ax" | "az">>(c: T, ball: { x: number; y: number }, deg: number): T {
  if (!deg) return c;
  const r = (deg * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  const bx = ball.x - CX, bz = ball.y;
  const dx = c.tx - bx, dz = c.tz - bz;
  return { ...c, tx: bx + dx * cs - dz * sn, tz: bz + dx * sn + dz * cs, ax: c.ax * cs - c.az * sn, az: c.ax * sn + c.az * cs };
}

/**
 * INSIDE THE BOWL (13 Oct 2026: a 90° turn on a cutback put the camera outside the stadium, a black
 * lower third). The 3D stadium (real/arena.ts), in pitch metres: the stand fronts sit gapSide 6.0 m past
 * each touchline and gapEnd 4.9 m behind each goal line; each stand runs `depth` back, its seats rising
 * as `standTop` (two tiers: lower 0.49 m up a metre back, upper from 14.5 m back, 21.7 m high at the
 * back). A turned or tilted camera stands either over the grass (inside the fronts) or over a stand, at
 * least `clear` above its seats; never outside the stadium (`margin` inside its back).
 */
export const BOWL = { x0: CX - 34 - 6.0, x1: CX + 34 + 6.0, y0: -4.9, y1: 105 + 4.9, depth: 29, margin: 2, clear: 3 };
/** How high the seats are `s` metres behind a stand's front (real/arena.ts `two` tiers), the step to the upper tier eased over 2 m. */
export function standTop(s: number): number {
  if (s <= 0) return 1.1;
  const lower = 1.1 + Math.min(s, 16.4) * (0.4 / 0.82);
  const upper = s >= 14.5 ? 12.2 + Math.min(s - 14.5, 14.6) * (0.56 / 0.86) : 0;
  // the upper tier's front face is a 4 m step: the camera's clearance ramps up over the 2 m before it, so
  // a camera turned over it rises smoothly instead of jumping (13 Oct 2026, "turning isn't clean")
  const ramp = s >= 12.5 && s < 14.5 ? lower + (12.2 - lower) * ((s - 12.5) / 2) : 0;
  return Math.max(lower, upper, ramp);
}
/** Where a camera at pitch (x, z), y m up stands: "grass" inside the stand fronts, "stand" over a stand high enough, else "out". */
export function bowlSpot(x: number, z: number, y: number): "grass" | "stand" | "out" {
  const m = BOWL.margin;
  const s = Math.max(BOWL.x0 - x, x - BOWL.x1, BOWL.y0 - z, z - BOWL.y1); // metres behind the nearest front
  if (s <= -m) return "grass";
  if (s > BOWL.depth - m) return "out";
  return y >= standTop(Math.max(0, s)) + BOWL.clear ? "stand" : "out";
}
const camSpot = (c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D">) => {
  const ce = Math.cos(c.elev);
  return bowlSpot(c.tx + CX + c.ax * c.D * ce, c.tz + c.az * c.D * ce, c.D * Math.sin(c.elev));
};
/**
 * Where a turned camera stops drawing the stands' roofs, trusses and lamps (along its ground direction, the
 * units engineView.ts clips the stadium with). Harry, 14 Oct 2026: "I only mean the top white roof, not the
 * advertising boards and fans": turned all the way (`share` 1) no roof is drawn at all; the seats, fans and
 * boards stay. On the way in (`share` 0..1) the roofs go from the camera's side outwards, so nothing pops.
 */
export function overheadClipAlong(c: Pick<BcCamera, "ax" | "az">, ball: BcPoint, share = 1): number {
  return (ball.x - CX) * c.ax + ball.y * c.az - 300 * Math.max(0, Math.min(1, share));
}
/** True when this camera stands over a stand (engineView.ts then draws the near stand's seats and clips only its roof). */
export function overStand(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D">): boolean { return camSpot(c) === "stand"; }
/**
 * INSIDE THE BOWL, SMOOTHLY. A turned or tilted camera outside the stadium first RISES (Harry, 13 Oct
 * 2026: "the zoom is too zoomed in": a higher camera at the same distance keeps the framing), by the
 * least angle that brings it inside; only if even the highest allowed angle is still outside does it
 * come closer, by the least distance, never under BOWL_MIN_D of its own distance. Both amounts are
 * found by halving (not in steps), so a camera turned one degree further moves a little, never jumps
 * (Harry, 13 Oct: "turning left right isn't clean anymore": the old 2° steps popped). The ball keeps
 * its spot on the screen. `share` (0..1) applies that part of the move; 0 (the default camera): untouched.
 */
/** The closest a camera kept inside the bowl may come, as a share of its framing's distance. */
export const BOWL_MIN_D = 0.85;
export function keepInBowl<T extends Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov"> & { minDepth?: number; elevDeg?: number }>(c: T, ball: BcPoint, share: number, W: number, H: number): T {
  const fine = (x: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D">) => camSpot(x) !== "out";
  if (share <= 0 || fine(c)) return c;
  const u = Math.min(1, share);
  const at = bcProject(c, W, H, ball);
  const e0 = (c.elev * 180) / Math.PI;
  const riseMax = Math.max(0, TILT.maxElev - e0);
  // the camera raised `r` degrees, the ball held on its screen spot
  const raised = (r: number) => holdBall(withElev(c, e0 + r), ball, at.nx, at.fr, W, H);
  let out: T;
  if (fine(raised(riseMax))) {
    let lo = 0, hi = riseMax;
    for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (fine(raised(m))) hi = m; else lo = m; }
    out = raised(hi * u);
  } else {
    const top = raised(riseMax);
    const closer = (D: number) => holdBall(withD(top, D), ball, at.nx, at.fr, W, H);
    const Dmin = c.D * BOWL_MIN_D;
    let D = Dmin;
    if (fine(closer(Dmin))) {
      let lo = Dmin, hi = c.D; // lo fine, hi not
      for (let i = 0; i < 16; i++) { const m = (lo + hi) / 2; if (fine(closer(m))) lo = m; else hi = m; }
      D = lo;
    }
    out = holdBall(withD(withElev(c, e0 + riseMax * u), c.D + (D - c.D) * u), ball, at.nx, at.fr, W, H);
  }
  return out;
}
const withElev = <T extends Pick<BcCamera, "elev"> & { elevDeg?: number }>(c: T, deg: number): T => ({ ...c, elev: (deg * Math.PI) / 180, ...(c.elevDeg !== undefined ? { elevDeg: deg } : {}) });
const withD = <T extends Pick<BcCamera, "D"> & { minDepth?: number }>(c: T, D: number): T => ({ ...c, D, ...(c.minDepth !== undefined ? { minDepth: (c.minDepth * D) / c.D } : {}) });
/** The same camera slid along the grass so `ball` lands at screen (nx, fr): every other number kept. */
export function holdBall<T extends Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">>(c: T, ball: BcPoint, nx: number, fr: number, W: number, H: number): T {
  const g = groundUnder(c, W, H, nx, 1 - 2 * fr);
  if (!g) return c;
  return { ...c, tx: c.tx + ball.x - g.x, tz: c.tz + ball.y - g.y };
}

/**
 * A TURNED CAMERA KEEPS THE GOAL AND THE PITCH (Harry, 13 Oct 2026: "the goal should always be in view
 * even with the ball centred. it just means the frame has to be moved"; "it shld also never be out of
 * play in 3d"; "now that the ball is centred in camera the zoom is too zoomed in"; "turning left right
 * isn't clean anymore").
 * Turned or tilted round our player, the camera keeps its side and lens and works out where to stand:
 *   - the ball near the middle, with the room to drag back under it (never off its box);
 *   - the whole goal mouth (both posts, the bar) on the screen, when the chance's own camera shows it;
 *   - at least `pitchMin` of the screen is pitch (grass inside the lines, plus the goal);
 *   - inside the stadium (keepInBowl).
 * Three moves only, never a size change (SIZE3D) and never closer than the turned camera: BACK (further
 * away, up to `kMax` x its distance), SLIDE (the ball off the middle) and RISE (higher; off, see riseMax).
 * Each costs a little (`cost`: backing off is cheapest, then sliding, then rising); missing the goal or
 * the pitch share costs a lot. The cheapest is found by a fixed run of small downhill steps from the
 * ball-centred camera, each a smooth function of the turn, so the camera follows the turn smoothly and
 * never snaps between two answers (tests/star/match2dCam.mts sweeps it degree by degree).
 */
export const FRAME_TURNED = {
  /** Room at the screen's edges round the goal's posts and bar, share of the half-screen. */
  margin: 0.05,
  /** Least share of the screen that is pitch (grass inside the lines, the goal): the main thing (Harry, 14 Oct 2026; a strip of fans and boards is fine). */
  pitchMin: 0.65,
  /** Where the ball may sit: |nx| at most this, at least `ballTop` down (and the drag room below). */
  ballNx: 0.88,
  ballTop: 0.12,
  /** Furthest back, x the turned camera's distance... */
  kMax: 3,
  /** ...and never further than this (m): a man stays about 2% of the screen's height or more, readable (13 Oct 2026: 200 m made dots). */
  maxD: 165,
  /** Rising (higher, a steeper look) for the pitch share, at most this many degrees (Harry, 14 Oct 2026: "I don't love
   *  seeing the stadiums": the pitch, not the stands; raising is preferred). Rising only slowly changes the share, so the
   *  needed height can move fast with the turn: the game eases the framing (easeFit). */
  riseMax: 25,
  /** ...and never steeper than this, so it keeps a real 3D look (not top-down). */
  elevCap: 70,
  /** What each move costs (back: per ln of the distance; slide: per screen half-width; rise: per riseMax); a miss costs `miss` per unit squared plus `missLin` per unit; the screen's bottom edge out over the seats costs `stand` per 10 m squared, being lifted by the stadium `lifted` per 10 degrees squared. */
  cost: { back: 1, slide: 0.6, rise: 1, miss: 400, missLin: 20, stand: 40, lifted: 40 },
  /** The search: this many downhill steps, each at most stepMax x stepDecay^k (scaled numbers), at `rate` per unit of slope. */
  iters: 30,
  stepMax: 0.3,
  stepDecay: 0.9,
  rate: 0.02,
  /** In the game, the framing glides to each frame's answer over about this long (s). */
  easeS: 0.12,
};
/** The goal mouth (posts' feet and tops) and the net's foot 1 m behind the line, which must all be on screen. */
const GOAL_MOUTH: BcPoint[] = [{ x: CX - 3.66, y: 0 }, { x: CX + 3.66, y: 0 }, { x: CX - 3.66, y: 0, z: 2.44 }, { x: CX + 3.66, y: 0, z: 2.44 },
  { x: CX - 3.66, y: -1 }, { x: CX + 3.66, y: -1 }];
/** Both posts (foot and top) and so the bar on the screen, with `margin` (share of the half-screen) to spare. */
export function goalMouthOnScreen(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number, margin = 0): boolean {
  for (const p of GOAL_MOUTH) {
    const s = bcProject(c, W, H, p);
    if (!(s.depth > 0.5 && Math.abs(s.nx) <= 1 - margin && s.fr >= margin / 2 && s.fr <= 1 - margin / 2)) return false;
  }
  return true;
}
/** Does this (untouched) camera show the goal at all: both posts, feet and tops, anywhere on screen? Then a turned one keeps the whole mouth. */
export function showsGoal(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number): boolean {
  for (const p of GOAL_MOUTH.slice(0, 4)) {
    const s = bcProject(c, W, H, p);
    if (!(s.depth > 0.5 && Math.abs(s.nx) <= 1 && s.fr >= 0 && s.fr <= 1)) return false;
  }
  return true;
}
/** The camera's frame in three.js metres: its position and right / up / forward unit vectors. */
function camBasis(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D">) {
  const se = Math.sin(c.elev), ce = Math.cos(c.elev);
  return {
    pos: [c.tx + c.ax * c.D * ce, c.D * se, c.tz + c.az * c.D * ce],
    fwd: [-c.ax * ce, -se, -c.az * ce], up: [-c.ax * se, ce, -c.az * se], rt: [c.az, 0, -c.ax],
  };
}
/** Share of the screen covered by a flat polygon in the world (pitch points, z up), cut at the near plane. */
function screenPoly(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number, poly: BcPoint[]): { a: number; cx: number; cy: number } {
  const b = camBasis(c);
  const tV = Math.tan((c.fov * Math.PI) / 360), tH = tV * (W / H);
  const dot = (a: number[], v: number[]) => a[0] * v[0] + a[1] * v[1] + a[2] * v[2];
  let pts = poly.map((p) => { const r = [p.x - CX - b.pos[0], (p.z ?? 0) - b.pos[1], p.y - b.pos[2]]; return [dot(r, b.rt), dot(r, b.up), dot(r, b.fwd)]; });
  const NEAR = 0.3;
  const clip = (arr: number[][], inside: (p: number[]) => number) => {
    const o: number[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i], q = arr[(i + 1) % arr.length], da = inside(a), dq = inside(q);
      if (da >= 0) o.push(a);
      if ((da >= 0) !== (dq >= 0)) { const t = da / (da - dq); o.push(a.map((v, k) => v + (q[k] - v) * t)); }
    }
    return o;
  };
  pts = clip(pts, (p) => p[2] - NEAR);
  const none = { a: 0, cx: 0, cy: 0 };
  if (pts.length < 3) return none;
  let s = pts.map((p) => [p[0] / (p[2] * tH), p[1] / (p[2] * tV), 0]);
  for (const f of [(p: number[]) => 1 - p[0], (p: number[]) => p[0] + 1, (p: number[]) => 1 - p[1], (p: number[]) => p[1] + 1]) { s = clip(s, f); if (s.length < 3) return none; }
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < s.length; i++) { const p = s[i], q = s[(i + 1) % s.length], k = p[0] * q[1] - q[0] * p[1]; a += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k; }
  if (Math.abs(a) < 1e-12) return none;
  // a: share of the screen; (cx, cy): its middle in screen units (x right, y UP, each −1..1)
  return { a: Math.abs(a) / 2 / 4, cx: cx / (3 * a), cy: cy / (3 * a) };
}
function screenShare(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number, poly: BcPoint[]): number { return screenPoly(c, W, H, poly).a; }
/** Share of the screen that is in play: the grass inside the lines (half a metre spare) plus the goal's mouth. */
export function pitchOnScreen(c: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number): number {
  const g = 0.5;
  const grass: BcPoint[] = [{ x: CX - 34 - g, y: -g }, { x: CX + 34 + g, y: -g }, { x: CX + 34 + g, y: 105 + g }, { x: CX - 34 - g, y: 105 + g }];
  const mouth: BcPoint[] = [{ x: CX - 3.66, y: 0 }, { x: CX + 3.66, y: 0 }, { x: CX + 3.66, y: 0, z: 2.44 }, { x: CX - 3.66, y: 0, z: 2.44 }];
  return Math.min(1, screenShare(c, W, H, grass) + screenShare(c, W, H, mouth));
}
/**
 * How far (m) the screen's bottom edge reaches behind a stand's front (0: on the grass). engineView.ts clips
 * the stadium nearer the camera than that edge, so past the front, that stand's roof lands on the picture.
 */
export function bottomOverStand(x: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number): number {
  let over = 0;
  for (const nx of [-1, 0, 1]) {
    const g = groundUnder(x, W, H, nx, -1);
    if (!g) { over = Math.max(over, 30); continue; }
    over = Math.max(over, BOWL.x0 - g.x, g.x - BOWL.x1, BOWL.y0 - g.y, g.y - BOWL.y1);
  }
  return Math.max(0, over);
}
/** The framing's own numbers (frameTurned): ln of the distance factor, the rise (degrees), the ball's screen spot. */
export interface TurnFit { lk: number; rise: number; nx: number; fr: number }
/** How far a camera misses: the goal mouth off the screen's margins, and the pitch share short of `pitchMin` (0 = fine). */
function framingMiss(x: Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">, W: number, H: number, goal: boolean, F = FRAME_TURNED): number {
  let m = 0;
  if (goal) for (const p of GOAL_MOUTH) {
    const s = bcProject(x, W, H, p);
    if (s.depth < 0.5) { m += 1 + (0.5 - s.depth) * 0.05; continue; }
    m += Math.max(0, Math.abs(s.nx) - (1 - F.margin)) + Math.max(0, F.margin / 2 - s.fr) + Math.max(0, s.fr - (1 - F.margin / 2));
  }
  m += Math.max(0, F.pitchMin - pitchOnScreen(x, W, H)) * 2;
  return m;
}
type TurnCam = Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov"> & { minDepth?: number; elevDeg?: number };
/** The turned camera `c` moved by a framing `fit`: further back, higher, the ball on its spot; kept inside the bowl. */
export function turnedPose<T extends TurnCam>(c: T, ball: BcPoint, fit: TurnFit, W: number, H: number): T {
  const e0 = (c.elev * 180) / Math.PI;
  const placed = holdBall(withD(fit.rise > 0 ? withElev(c, e0 + fit.rise) : c, c.D * Math.exp(fit.lk)), ball, fit.nx, fit.fr, W, H);
  return keepInBowl(placed, ball, 1, W, H);
}
/** The neutral framing (nothing moved): the ball in the middle, drag room kept. */
export function centredFit(W: number, H: number, S = SET_PIECE_CAM): TurnFit {
  return { lk: 0, rise: 0, nx: 0, fr: Math.min(0.5, 1 - dragRoomShare(W, H, S)) };
}
/**
 * The framing for the turned/tilted camera `c` (orbitCamera, tiltCamera): a fixed run of small downhill
 * steps on the cost above from the ball-centred start, every step a smooth function of the turn.
 */
export function solveTurnFit(c: TurnCam, ball: BcPoint, W: number, H: number, goal: boolean, F = FRAME_TURNED, S = SET_PIECE_CAM): TurnFit {
  const limit = 1 - dragRoomShare(W, H, S);
  const fr0 = Math.min(0.5, limit);
  const e0 = (c.elev * 180) / Math.PI;
  const riseTop = Math.min(F.riseMax, Math.max(0, Math.min(TILT.maxElev, F.elevCap) - e0));
  const lkMax = Math.max(0, Math.log(Math.min(F.kMax, F.maxD / c.D)));
  const lo = [0, 0, -F.ballNx, F.ballTop], hi = [lkMax, riseTop, F.ballNx, limit];
  const clampV = (v: number[]) => v.map((x, i) => Math.max(lo[i], Math.min(hi[i], x)));
  const fitOf = (v: number[]): TurnFit => ({ lk: v[0], rise: v[1], nx: v[2], fr: v[3] });
  // how far the stadium lifts the camera anyway (ball centred, nothing moved): only lift beyond that costs
  const lift0 = ((turnedPose(c, ball, { lk: 0, rise: 0, nx: 0, fr: fr0 }, W, H).elev - c.elev) * 180) / Math.PI;
  const cost = (v: number[]) => {
    const x = turnedPose(c, ball, fitOf(v), W, H);
    const miss = framingMiss(x, W, H, goal, F);
    const sx = v[2], sy = ((v[3] - fr0) * 2 * H) / W; // the slide in half-widths, both ways
    const r = F.riseMax > 0 ? v[1] / F.riseMax : 0;
    // the screen's bottom edge out over a stand costs (its roof is then drawn over the picture: the turned
    // stills of 13 Oct 2026), and so does the stadium lifting the camera (towards a top-down look)
    const forced = ((x.elev - c.elev) * 180) / Math.PI - v[1];
    const over = bottomOverStand(x, W, H);
    return F.cost.back * v[0] * v[0] + F.cost.slide * (sx * sx + sy * sy) + F.cost.rise * r * r + F.cost.miss * miss * miss + F.cost.missLin * miss
      + F.cost.stand * (over / 10) ** 2 + F.cost.lifted * (Math.max(0, forced - lift0) / 10) ** 2;
  };
  // numbers scaled to about 1; each step at most stepMax x stepDecay^k long
  const sc = [lkMax, Math.max(1, riseTop), F.ballNx, Math.max(0.05, limit - F.ballTop)];
  let v = clampV([0, 0, 0, fr0]);
  for (let k = 0; k < F.iters; k++) {
    const g = [0, 0, 0, 0], c0 = cost(v);
    for (let i = 0; i < 4; i++) {
      if (hi[i] - lo[i] < 1e-9) continue;
      // one-sided slope (inwards at a bound)
      const h = (v[i] + 1e-3 * sc[i] <= hi[i] ? 1 : -1) * 1e-3 * sc[i];
      const a = v.map((x, j) => (j === i ? x + h : x));
      g[i] = ((cost(a) - c0) / h) * sc[i];
    }
    const gl = Math.hypot(...g);
    const cap = F.stepMax * Math.pow(F.stepDecay, k);
    const m = gl > 1e-12 ? Math.min(F.rate, cap / gl) : 0;
    v = clampV(v.map((x, i) => x - m * g[i] * sc[i]));
  }
  return fitOf(v);
}
/**
 * In the game the framing is eased towards each frame's answer over FRAME_TURNED.easeS (engineView.ts),
 * so even where the answer moves fast with the turn (a corner turned past the goal), the camera glides.
 * The ball keeps exactly its eased spot on the screen; the turn itself is never delayed.
 */
export function easeFit(cur: TurnFit, want: TurnFit, dt: number, F = FRAME_TURNED): TurnFit {
  const u = Math.min(1, Math.max(0, dt) / F.easeS);
  return { lk: cur.lk + (want.lk - cur.lk) * u, rise: cur.rise + (want.rise - cur.rise) * u, nx: cur.nx + (want.nx - cur.nx) * u, fr: cur.fr + (want.fr - cur.fr) * u };
}
/**
 * The turned/tilted camera framed round the ball (see FRAME_TURNED). `share` (centreShare, eased) blends
 * from `c` (0: untouched, the default camera) to the framed camera (1). `fit`: an already-worked-out (eased)
 * framing; without one it is solved here.
 */
export function frameTurned<T extends TurnCam>(c: T, ball: BcPoint, share: number, W: number, H: number, goal: boolean, fit?: TurnFit | null): T {
  if (share <= 0) return c;
  const full = turnedPose(c, ball, fit ?? solveTurnFit(c, ball, W, H, goal), W, H);
  const u = Math.min(1, share);
  if (u >= 1) return full;
  const e = c.elev + (full.elev - c.elev) * u;
  return { ...c, tx: c.tx + (full.tx - c.tx) * u, tz: c.tz + (full.tz - c.tz) * u, D: c.D + (full.D - c.D) * u, elev: e,
    ...(c.elevDeg !== undefined ? { elevDeg: (e * 180) / Math.PI } : {}), ...(c.minDepth !== undefined && full.minDepth !== undefined ? { minDepth: c.minDepth + (full.minDepth - c.minDepth) * u } : {}) };
}

/**
 * THE BALL GRAB, ON THE GLASS (Harry, 13 Oct 2026: "I cant drag up and down in 3d it's just dragging
 * back from anywhere on the screen"). Measured cause: the 2D game's own grab zone (0.2 of the box's
 * height, about 9.6 m of grass) was tested on the GRASS, and a turned camera centred on the ball shows
 * about 18 px per metre there, so it became a ~170 px circle on a 362 px wide screen: nearly every press
 * grabbed the ball. Now every grab is bounded on the screen round the ball as seen: within `px` CSS px
 * it always grabs; out to `px` x `reach` it grabs only if the press is also in the 2D game's own zone or
 * within `groundM` of the ball on the grass. Never further: zoom and turn cannot grow it.
 */
export const BALL_GRAB = { px: 48, reach: 1.4, groundM: 3.2 };
/** The furthest a press may be from the ball's picture and still grab it, CSS px. */
export function ballGrabMaxPx(): number { return BALL_GRAB.px * BALL_GRAB.reach; }
/** Does a press `glassPx` from the ball's picture grab it? `in2dZone`: inside the 2D game's own zone; `groundM`: metres from the ball on the grass. */
export function grabsBall(glassPx: number, in2dZone: boolean, groundM: number): boolean {
  if (glassPx <= BALL_GRAB.px) return true;
  return glassPx <= ballGrabMaxPx() && (in2dZone || groundM < BALL_GRAB.groundM);
}

/**
 * THE CAMERA SWIPE, UP AND DOWN (Harry, 13 Oct 2026: "can we add up and down swiping for the camera
 * aswell as side to side?"). A one-finger drag up or down on open grass tilts the camera: up lowers
 * it (see further up the pitch), down raises it (towards top-down). At most `maxDeg` either way and
 * never outside `minElev`..`maxElev`. The distance is kept, and the ball keeps its spot on the screen
 * (the camera slides along the grass to hold it), so the room to drag back is kept too. Eases back
 * with the side-to-side swipe when the chance ends. Camera only: it never reaches the 2D game.
 */
export const TILT = { maxDeg: 25, degPerHeight: 60, minElev: 22, maxElev: 85, upright: 1.2 };
export function clampTilt(deg: number): number { return Math.max(-TILT.maxDeg, Math.min(TILT.maxDeg, deg)); }
export function tiltCamera<T extends Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov"> & { elevDeg?: number }>(c: T, ball: BcPoint, deg: number, W: number, H: number): T {
  if (!deg) return c;
  const e0 = (c.elev * 180) / Math.PI;
  const e1 = Math.max(TILT.minElev, Math.min(TILT.maxElev, e0 + deg));
  if (Math.abs(e1 - e0) < 1e-6) return c;
  const want = bcProject(c, W, H, ball).fr;
  const tilted = { ...c, elev: (e1 * Math.PI) / 180, elevDeg: e1 };
  // slide along the grass (towards/away from the camera) until the ball is back on its spot
  const at = (d: number) => ({ ...tilted, tx: tilted.tx + c.ax * d, tz: tilted.tz + c.az * d });
  const fr = (d: number) => bcProject(at(d), W, H, ball).fr;
  let lo = -200, hi = 200;
  const up = fr(hi) > fr(lo); // which way fr grows as the camera slides
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if ((fr(m) > want) === up) hi = m; else lo = m; }
  return at((lo + hi) / 2);
}

/**
 * ROOM TO DRAG BACK, EVERY CHANCE (Harry, 12 Oct 2026, on a one-on-one still: "a player wont be
 * able to drag that back on phone"). The 2D always keeps grass under the ball for the pull-back
 * (matchView.ts ZOOM_MIN_PULL_M; the set-piece camera's dragRoomW). The 3D camera must too, whatever
 * framing it is in (the default, pinched in or out, a corner's start view): the ball's spot on the
 * screen stays at least a full-power drag (plus a finger) above the bottom edge. Camera only: it
 * slides towards itself along the ground until the ball is high enough; nothing is scaled.
 * Pure: tests/star/match2dCam.mts checks every served kind.
 */
export function keepDragRoom<T extends Pick<BcCamera, "tx" | "tz" | "ax" | "az" | "elev" | "D" | "fov">>(c: T, ball: BcPoint, W: number, H: number, S = SET_PIECE_CAM): T {
  const limit = 1 - dragRoomShare(W, H, S);
  const at = (d: number) => ({ ...c, tx: c.tx + c.ax * d, tz: c.tz + c.az * d });
  const fr = (d: number) => bcProject(at(d), W, H, ball).fr;
  if (fr(0) <= limit) return c;
  let lo = 0, hi = 1;
  while (fr(hi) > limit && hi < 200) hi *= 2;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (fr(m) > limit) lo = m; else hi = m; }
  return at(hi);
}
