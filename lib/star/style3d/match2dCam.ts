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
export function usesCornerCam(kind: string): boolean { return kind === "corner" && CORNER_CAM.pick !== "off"; }

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
