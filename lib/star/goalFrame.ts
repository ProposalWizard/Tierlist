/**
 * THE SERVED FRAME'S LAST WORD — plan v0.15, items 12 and 20.
 *
 * Runs once on every chance the match serves, after every other layer has
 * placed people and framed them (the chance formula's `frameFor`, a drawing's
 * `standardFrame`, the engine's own frame). It NEVER changes the chance: nobody
 * is moved to make the picture fit. It slides the camera and, only when a
 * slide cannot do it, pulls the camera out.
 *
 *  12 · "Unless it's a build-up highlight, the goal has to be fully in frame."
 *       The frame slides UP until the goal, drawn at its true height, fits —
 *       keeping the room below the ball that a full pull-back needs. Where one
 *       frame cannot hold both (a through ball or a long shot from far out),
 *       the camera zooms out just enough for both. Harry, v0.15: never "built
 *       closer" — the chance stays exactly where it was made.
 *
 *  20 · "Near the left or right edge you can't drag back far enough … move the
 *       camera with you, keeping the goal in view." The frame slides sideways
 *       (and up, for a cut-back pulled towards the top) until a full pull plus
 *       a thumb's width fits on the picture, with both posts kept inside. When
 *       sliding alone cannot give that room, the camera pulls out a little on
 *       its own (Harry's pick (b): no zoom button), never past 48 m unless
 *       item 12 already needed more.
 *
 * The frame is also the game's out-of-play line (`stepBall`). If a slide
 * pushes out of the picture one of the men the frame must hold (you, the
 * keeper, the poacher, the runners and where they are running to), he is
 * brought back just inside it, as the engine's own `fitToView` does at build
 * time. Zooming out never loses anyone (the frame only grows).
 */
import {
  goalInView, dragForFullPower, VIEW_ASPECT,
  type Scenario, type Viewport, type Vec2,
} from "./canvasEngine";
import { NET_DEPTH, GOAL_H, POST_L, POST_R, PITCH_W } from "./pitch";

/** The top of the goal as the match draws it: the back frame's bar, drawn at
 *  true height above the back of the net (CanvasMatch's goal block). */
export const GOAL_TOP_Y = -(NET_DEPTH + GOAL_H);
/** "The whole goal fits": the house frame every drawing was drawn in has its
 *  top edge here (camera centreY 17.3, height 42), 6 cm above the bar. */
export const FRAME_TOP_FOR_GOAL = -3.7;
/** Both posts kept at least this far inside the side edges. */
export const POST_MARGIN = 0.5;
/** A thumb's width past the end of a full pull: 16 px of the 366 px canvas. */
export const THUMB_FRAC_W = 16 / 366;
/** The widest item 20's own zoom-out may go (the corner's own frame). */
export const ZOOM_MAX_H = 48;
/** Bodies are kept this far inside the edges (fitToView's own inset). */
const INSET = 1.4;
/** The ball is kept this far from a side edge (frameFor's own `need`). */
const BALL_SIDE_NEED = 2.2;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const onPitchBody = (p: Vec2) => p.x > -100 && p.x < PITCH_W + 100 && p.y > -100 && p.y < 200;

/** The power a full pull is measured for when making room: 55, the Play
 *  Area's default and about a starting player. */
export const ROOM_FOR_POWER = 55;
/** A full-power pull, in metres, on a frame this tall. The drag is read as a
 *  fraction of the canvas HEIGHT, so in an ordinary frame it is that fraction
 *  of the frame's height in metres (and so the same pixels at any zoom). */
export function pullLenM(frameH: number): number {
  return dragForFullPower(ROOM_FOR_POWER) * frameH;
}
/** The room a full pull plus a thumb needs below the ball, as a share of the
 *  frame's height (it scales with the frame, like the pull itself). */
export function roomShare(): number {
  return dragForFullPower(ROOM_FOR_POWER) + THUMB_FRAC_W * VIEW_ASPECT;
}

const inside = (p: Vec2, v: Viewport) => p.x >= v.x1 && p.x <= v.x2 && p.y >= v.y1 && p.y <= v.y2;

/**
 * The people the frame is OBLIGED to hold — you, the keeper, and every man a
 * pass can be aimed at (chanceFormula's own list: "the ball, you, the keeper
 * and the pass target"). If a slide lost one that the old frame showed, he is
 * brought just inside it. Defenders and decorative team-mates are left where
 * the chance put them: off the edge is a legitimate place for them to be.
 */
function mustHold(sc: Scenario): Vec2[] {
  const out: Vec2[] = [sc.player];
  if (goalInView(sc.kind)) out.push(sc.keeper, sc.follower);
  for (const r of [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners]) {
    out.push(r.pos, r.to);
    if (r.commandedTo) out.push(r.commandedTo);
  }
  return out.filter(onPitchBody);
}
function pullInside(sc: Scenario, before: Viewport, after: Viewport): number {
  let moved = 0;
  const fx = (x: number) => clamp(x, after.x1 + INSET, after.x2 - INSET);
  const fy = (y: number) => clamp(y, Math.max(after.y1 + INSET, 0.3), after.y2 - INSET);
  for (const p of mustHold(sc)) {
    if (inside(p, before) && !inside(p, after)) { p.x = fx(p.x); p.y = fy(p.y); moved++; }
  }
  if (moved && sc.runner) sc.passTarget = { x: sc.runner.to.x, y: sc.runner.to.y };
  return moved;
}

export interface FrameReport {
  /** Metres the frame slid up (negative: down) to hold the goal and the pull. */
  slidUp: number;
  /** The frame's height after item 12's zoom-out (the served height = none). */
  goalZoomH: number;
  /** Metres the frame slid sideways for the pull (item 20). */
  slidSide: number;
  /** The frame's height at the end (item 20's zoom-out included). */
  zoomH: number;
  /** Bodies brought back inside the picture after a slide. */
  movedIn: number;
  /** Item 20: a full pull + thumb still does not fit after everything allowed. */
  pullShort: boolean;
}

const NONE = (h: number): FrameReport => ({ slidUp: 0, goalZoomH: h, slidSide: 0, zoomH: h, movedIn: 0, pullShort: false });

/** Where a pull can go in this chance: straight back from each natural target. */
export function naturalTargets(sc: Scenario): Vec2[] {
  const shoot = sc.kind === "one_on_one" || sc.kind === "tight_angle" || sc.kind === "long_range"
    || sc.kind === "volley" || sc.kind === "header" || sc.kind === "free_kick" || sc.kind === "penalty";
  const posts: Vec2[] = [{ x: POST_L + 0.4, y: 0 }, { x: (POST_L + POST_R) / 2, y: 0 }, { x: POST_R - 0.4, y: 0 }];
  if (shoot) return posts;
  // A passing chance is protected for the pass it is built around (the
  // cut-back, the through ball) — not for every shot you might try instead,
  // or the camera would move for a ball nobody is being asked to play.
  if (sc.passTarget) return [sc.passTarget];
  if (sc.runner) return [sc.runner.to];
  return [{ x: (POST_L + POST_R) / 2, y: 0 }];
}

/** The box a full pull (plus a thumb) needs, in pitch metres, on a frame this size. */
function pullBox(sc: Scenario, w: number, h: number) {
  const L = pullLenM(h), thumb = THUMB_FRAC_W * w;
  let lo = Infinity, hi = -Infinity, top = Infinity, bot = -Infinity;
  for (const t of naturalTargets(sc)) {
    const dx = sc.ball.x - t.x, dy = sc.ball.y - t.y, d = Math.hypot(dx, dy) || 1;
    const ex = sc.ball.x + (dx / d) * L, ey = sc.ball.y + (dy / d) * L;
    lo = Math.min(lo, ex - thumb); hi = Math.max(hi, ex + thumb);
    top = Math.min(top, ey - thumb); bot = Math.max(bot, ey + thumb);
  }
  return { lo, hi, top, bot };
}

/** Both posts in, and the ball kept clear of the side, for a frame this wide. */
function placeSideways(sc: Scenario, x1: number, w: number): number {
  x1 = Math.min(x1, POST_L - POST_MARGIN);
  x1 = Math.max(x1, POST_R + POST_MARGIN - w);
  return clamp(x1, sc.ball.x + BALL_SIDE_NEED - w, sc.ball.x - BALL_SIDE_NEED);
}

/**
 * Place a frame of this size sideways (and vertically, within what the goal
 * allows) so the pull fits, both posts stay in, and the ball keeps its side
 * room. Returns the placed frame and whether the pull fits.
 */
function placeForPull(sc: Scenario, v: Viewport): { v: Viewport; fits: boolean } {
  const w = v.x2 - v.x1, h = v.y2 - v.y1;
  const pb = pullBox(sc, w, h);
  let x1 = v.x1, y1 = v.y1;
  // sideways: the pull's far end first, then the posts win
  if (pb.hi > x1 + w) x1 = pb.hi - w;
  if (pb.lo < x1) x1 = pb.lo;
  x1 = placeSideways(sc, x1, w);
  // Up, for a pull that heads to the top (a cut-back played back towards
  // you) — but never so far that a pull the other way, or you, falls off the
  // bottom.
  if (pb.top < y1) y1 = Math.max(pb.top, Math.min(pb.bot, y1 + h) - h, sc.player.y + INSET - h);
  // the goal stays whole (its top may only go up, never down past the house frame)
  y1 = Math.min(y1, FRAME_TOP_FOR_GOAL);
  const nv = { x1, x2: x1 + w, y1, y2: y1 + h };
  const fits = pb.lo >= nv.x1 - 1e-6 && pb.hi <= nv.x2 + 1e-6 && pb.top >= nv.y1 - 1e-6;
  return { v: nv, fits };
}

/** A frame of height `H` with this top edge, centred on `cx` (then placed). */
function frameOf(sc: Scenario, cx: number, y1: number, H: number): Viewport {
  const W = H * VIEW_ASPECT;
  const x1 = placeSideways(sc, cx - W / 2, W);
  return { x1, x2: x1 + W, y1, y2: y1 + H };
}

/**
 * Item 12 then item 20, on one served chance. Mutates `sc.viewport` only —
 * and, when a slide would lose one of the men the frame must hold, brings him
 * just inside it.
 */
export function finishServedFrame(sc: Scenario): FrameReport {
  const vp0 = sc.viewport;
  if (!vp0) return NONE(0);
  const h0 = vp0.y2 - vp0.y1;
  const rep = NONE(h0);
  const turned = (sc.facing ?? "up") !== "up";
  if (turned || !goalInView(sc.kind)) return rep;
  const before = { ...vp0 };
  let v = { ...vp0 };
  const k = roomShare();
  /** The lowest point a frame of height H must still hold: a full pull
   *  below the ball, and you (drawn standing, feet on the spot). */
  const lowNeed = (H: number) => Math.max(sc.ball.y + k * H, sc.player.y + INSET);

  // ── 12 · the whole goal, and the pull below the ball ──
  {
    const h = v.y2 - v.y1;
    const cx = (v.x1 + v.x2) / 2;
    // The top edge the goal allows: at the house frame's, or higher.
    let y1 = Math.min(v.y1, FRAME_TOP_FOR_GOAL);
    // Slide down (while the goal stays whole) if the pull needs the room…
    if (y1 + h < lowNeed(h)) y1 = Math.min(FRAME_TOP_FOR_GOAL, lowNeed(h) - h);
    rep.slidUp = v.y1 - y1;
    let H = h;
    // …and where one frame cannot hold both, zoom out just enough: the top
    // stays on the goal, the bottom holds the pull (it grows with the frame).
    if (y1 + H < lowNeed(H) - 1e-6) {
      const needBall = (sc.ball.y - y1) / (1 - k);
      const needYou = sc.player.y + INSET - y1;
      H = Math.max(H, needBall, needYou);
    }
    if (H > h + 1e-6) v = frameOf(sc, cx, y1, H);
    else {
      const w = v.x2 - v.x1;
      const x1 = placeSideways(sc, v.x1, w);
      v = { x1, x2: x1 + w, y1, y2: y1 + h };
    }
    rep.goalZoomH = v.y2 - v.y1;
  }

  // ── 20 · room to pull back near the side ──
  {
    const x0 = v.x1;
    let placed = placeForPull(sc, v);
    if (!placed.fits) {
      // Pull the camera out a little: the same top edge (the goal stays where
      // it is on screen), wider and deeper, until the pull fits or 48 m.
      const h = v.y2 - v.y1;
      const cx = (v.x1 + v.x2) / 2;
      const cap = Math.max(ZOOM_MAX_H, h);
      for (let H = h + 0.5; H <= cap + 1e-6; H += 0.5) {
        const trial = placeForPull(sc, frameOf(sc, cx, v.y1, H));
        placed = trial;
        if (trial.fits) break;
      }
    }
    rep.slidSide = placed.v.x1 - x0;
    rep.pullShort = !placed.fits;
    v = placed.v;
  }

  rep.zoomH = v.y2 - v.y1;
  sc.viewport = v;
  rep.movedIn = pullInside(sc, before, v);
  return rep;
}
