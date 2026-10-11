/**
 * HOW THE MATCH IS FILMED — "new" or "classic". Settings → Match view.
 *
 * Harry, 3 Oct 2026, picking option D of the v0.26 zoom-out prototype:
 *   - straight top-down, flat, zoomed out to about 38 m across, so on a
 *     390 × 844 phone the pitch fills the screen's height (about 83 m: from
 *     just behind the goal to past the halfway line). Classic is 26 × 42 m.
 *   - a soft two-tone checker mow, thin crisp lines, a soft vignette;
 *   - figures about 0.8 of their zoomed size, with a thin dark outline and a
 *     contact shadow to one side; the ball about 0.7 of its zoomed size.
 *
 * "classic" is exactly the match as it was before this file existed, kept
 * reachable from Settings. Like the player look (figureSkin.ts) this is a
 * module-level value rather than a prop, so every screen that plays the
 * match — the real match AND every EnginePlay / EngineFeature screen —
 * follows it without a new prop (the one-engine guard compares props).
 *
 * THE OUT LINE. The engine calls a ball "out" when it leaves
 * `scenario.viewport`. In the new view that rectangle is the CAMERA (built
 * here, applied from CanvasMatch after the chance is built), so the play area
 * grows with what you can see. Where defenders are first placed is not
 * touched: that still happens inside the engine's own 42 m frame.
 */
import { useSyncExternalStore } from "react";
import type { Facing, Scenario, ScenarioKind, Vec2, Viewport } from "./canvasEngine";
import { goalInView, standOff } from "./canvasEngine";
import { wideChances } from "./wideChances";
/** Tests and measuring scripts: force Wide chances (re-exported so they set the copy this file reads). */
export { setWideChancesOverride } from "./wideChances";
import { PITCH_W, NET_DEPTH, POST_L, POST_R } from "./pitch";
import { tiltFor, visibleOnScreen, canvasToScreen } from "./cameraTilt";
import { chanceFraming } from "./chanceFraming";
import { oldActionCamera } from "./gameplayVersion";

export type MatchView = "new" | "classic";

/** THE ONE LINE: the view everyone gets when nobody has chosen. */
export const MATCH_VIEW_DEFAULT: MatchView = "new";
export const MATCH_VIEW_KEY = "star-match-view";

let override: MatchView | null = null;
let stored: MatchView | null | undefined;
const listeners = new Set<() => void>();

function readStored(): MatchView | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const v = localStorage.getItem(MATCH_VIEW_KEY);
    return v === "new" || v === "classic" ? v : null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === MATCH_VIEW_KEY) { stored = undefined; listeners.forEach((f) => f()); }
  });
}

/** The view to film the match in right now. */
export function matchView(): MatchView {
  if (override) return override;
  if (stored === undefined) stored = readStored();
  return stored ?? MATCH_VIEW_DEFAULT;
}

/** This phone's own choice (Settings). */
export function storedMatchView(): MatchView {
  if (stored === undefined) stored = readStored();
  return stored ?? MATCH_VIEW_DEFAULT;
}

export function setMatchView(v: MatchView): void {
  try { localStorage.setItem(MATCH_VIEW_KEY, v); } catch { /* in-memory still changes */ }
  stored = v;
  listeners.forEach((f) => f());
}

/** Force a view while a screen is open (a side-by-side). Returns the undo. */
export function setMatchViewOverride(v: MatchView | null): () => void {
  const before = override;
  override = v;
  listeners.forEach((f) => f());
  return () => { override = before; listeners.forEach((f) => f()); };
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** Settings' copy of the choice, kept in step with other tabs. */
export function useStoredMatchView(): MatchView {
  return useSyncExternalStore(subscribe, storedMatchView, () => MATCH_VIEW_DEFAULT);
}

// ─────────────────────────────────────────────────────────────────────────────
// The new view's numbers
// ─────────────────────────────────────────────────────────────────────────────

/** Metres of pitch across the screen's width. */
export const NEW_VIEW_WIDTH_M = 38;
/** The tallest the canvas may be, as height ÷ width: 83 m tall at 38 m across
 *  (option D on a 390 × 844 phone). A shorter screen shows less pitch below. */
export const NEW_VIEW_MAX_HW = 83 / 38;
/** Never shorter than the classic 5:8 canvas. */
export const NEW_VIEW_MIN_HW = 8 / 5;
/** Figures: this much of their zoomed-out size (option D: ~22 px on a phone). */
export const NEW_FIGURE_SCALE = 0.8;
/** Outfield players on top of NEW_FIGURE_SCALE (Harry, 9 Oct 2026: "I like 0.8 but
 *  with the goalie at 1x"). The keeper keeps his size; the ball shrinks with the men. */
export const NEW_OUTFIELD_SHRINK = 0.8;
/** The ball: this much of its zoomed-out size (option D: ~7 px, now 0.8 of that). */
export const NEW_BALL_SCALE = 0.7 * NEW_OUTFIELD_SHRINK;

/** How far behind the goal line the frame starts (the net plus a little). */
const BEHIND_GOAL_M = NET_DEPTH + 2.6;
/** Grass left under the bottom of a situation's own frame, when it fits. */
const BOTTOM_ROOM_M = 6;
/** The most grass shown past a touchline in the ordinary view. */
const EDGE_M = 4;
/** Side-on (a corner, a byline cross): at most this much grass past the FAR
 *  touchline, so the picture is never mostly empty grass beyond the pitch. */
const TURNED_FAR_M = 7.5;
/** …and at most this much past the NEAR one (where the ball is, and where you
 *  pull back to strike it). */
const TURNED_NEAR_M = 8;
/** Side-on, the ball is hung this far down the screen when that fits. */
const TURNED_BALL_DOWN = 0.8;

// ─────────────────────────────────────────────────────────────────────────────
// How far each kind of highlight is zoomed out
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Metres across the screen, per kind of highlight. Harry, 3 Oct 2026:
 *   "different zooms for different highlights … Long shot - full zoom out,
 *    Cutbacks/crosses - final 3rd, Build up - zoomed in on the passing players
 *    only, Corner - final 3rd, etc etc."
 *
 * Facing up the pitch this is the screen's width. Side-on (a corner, a byline
 * cross) the screen's width is pitch DEPTH, so the number is how far out from
 * the goal you can see: 32 m is the box and the ground just past the D, the
 * final third.
 *
 * "passers" (build-up, midfield pass) is not a fixed number: the camera fits
 * the ball, you, the men you can pass to and any defender standing in those
 * lanes, and nothing else (`PASSERS_*` below).
 *
 * A camera is never narrower than the frame the engine built the chance in, so
 * nobody the engine placed for a shot is ever off the screen.
 */
export const NEW_VIEW_KIND_WIDTH_M: Record<ScenarioKind, number | "passers"> = {
  long_range: NEW_VIEW_WIDTH_M,  // full zoom out
  free_kick: 34,
  through_ball: 32,
  one_on_one: 30,
  corner: 32,                    // side-on: goal to just past the D
  byline_cross: 30,              // side-on
  cutback: 28,                   // final third
  tight_angle: 28,
  volley: 27,
  header: 27,
  penalty: 27,
  buildup: "passers",
  midfield_pass: "passers",
};
/** Where a cross is watched once it reaches the box (the cut to "up"). */
export const NEW_VIEW_CROSS_CUT_WIDTH_M = 28;

/** Build-up: never tighter than this across (the figures stay legible)… */
const PASSERS_MIN_M = 22;
/** …room either side of the outermost passer, and above/below them. */
const PASSERS_SIDE_M = 5;
const PASSERS_END_M = 6;
/** A defender this close to a passing lane is in the picture. */
const PASSERS_LANE_M = 6;

/** Metres across the screen for this chance: its kind's number, never narrower
 *  than the engine's own frame (plus half a metre). */
function acrossFor(kind: ScenarioKind, engine: Viewport, facing: Facing): number | "passers" {
  const want = NEW_VIEW_KIND_WIDTH_M[kind] ?? NEW_VIEW_WIDTH_M;
  if (want === "passers") return want;
  const engineAcross = facing === "up" ? engine.x2 - engine.x1 : engine.y2 - engine.y1;
  return Math.min(NEW_VIEW_WIDTH_M, Math.max(want, engineAcross + 0.5));
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** The people a build-up camera has to show: the ball, you, every man you can
 *  pass to (where he is and where he is running), and defenders in those lanes. */
export function passersOf(sc: Scenario): Vec2[] {
  const pts: Vec2[] = [sc.ball, sc.player];
  const runners = [...(sc.runner ? [sc.runner] : []), ...(sc.secondaryRunners ?? [])];
  for (const r of runners) pts.push(r.pos, r.to);
  const lanes: [Vec2, Vec2][] = runners.flatMap((r) => [[sc.ball, r.pos], [sc.ball, r.to]] as [Vec2, Vec2][]);
  for (const d of sc.defenders) {
    if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) <= PASSERS_LANE_M
        || lanes.some(([a, b]) => distToSegment(d, a, b) <= PASSERS_LANE_M)) pts.push(d);
  }
  return pts;
}

/**
 * The tight build-up camera: the smallest frame at the canvas's shape that
 * holds `pts` with room round them, between PASSERS_MIN_M and the full zoom.
 */
function passersCamera(pts: Vec2[], facing: Facing, hw: number): Viewport {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const h = Math.max(NEW_VIEW_MIN_HW, hw);
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  if (facing === "up") {
    const across = Math.min(NEW_VIEW_WIDTH_M, Math.max(PASSERS_MIN_M,
      x2 - x1 + 2 * PASSERS_SIDE_M, (y2 - y1 + 2 * PASSERS_END_M) / h));
    const down = across * h;
    let vx1 = cx - across / 2;
    vx1 = Math.max(-EDGE_M, Math.min(PITCH_W + EDGE_M - across, vx1));
    return { x1: vx1, x2: vx1 + across, y1: cy - down / 2, y2: cy + down / 2 };
  }
  // Side-on: across the screen is pitch y, down it pitch x.
  const across = Math.min(NEW_VIEW_WIDTH_M, Math.max(PASSERS_MIN_M,
    y2 - y1 + 2 * PASSERS_SIDE_M, (x2 - x1 + 2 * PASSERS_END_M) / h));
  const down = across * h;
  return { x1: cx - down / 2, x2: cx + down / 2, y1: cy - across / 2, y2: cy + across / 2 };
}

/** Build-up, fitted (camera round 3): room either side of the outermost passer… */
const PASSERS_FIT_SIDE_M = 2.5;
/** …above the highest and below the lowest… */
const PASSERS_FIT_END_M = 4;
/** …and never tighter than this across. */
const PASSERS_FIT_MIN_M = 16;
/** A stray pass leaves the screen at most this far before it is out, at a side. */
const PASSERS_FIT_OUT_M = 4;

/**
 * The build-up camera fitted to the passers (camera round 3). passersCameraFor
 * below hangs the camera from the engine's out line and keeps it at least
 * the engine's width, so on a phone (twice as tall as wide) the passers sat
 * in a band across the middle with empty grass above and below: 43–53% of
 * the screen under the lowest man in the real match.
 *
 * Here the camera is the tightest frame at the canvas's shape that holds the
 * passers on the glass (2.5 m off a side, 4 m below the lowest), hung from
 * the engine's out line. The play area is untouched (playAreaFor keeps the
 * engine's frame), so nothing goes out sooner; a stray pass may leave a SIDE
 * of the screen up to PASSERS_FIT_OUT_M before it is out, never the top.
 * Used by Match camera New (12 Oct 2026), via frameForNewView.
 */
/** Is anybody in the chance cut in half by an edge of camera `v` (up the pitch)? */
function halfCut(sc: Scenario, v: Viewport, H: number, tiltDeg: number): boolean {
  const t = tiltFor(tiltDeg, 1, H);
  return bodiesOf(sc).some((p) => {
    const c = fracOf(v, "up", p), g = canvasToScreen(t, c.sx, c.sy, 1, H);
    const inside = Math.min(g.X, 1 - g.X, g.Y, H - g.Y);
    return inside < WHOLLY_ON_EDGE && inside > -CLEARLY_OFF_EDGE;
  });
}

export function passersFit(sc: Scenario, engine: Viewport, hw: number, tiltDeg = 0): Viewport {
  const pts = passersOf(sc).filter(onThePitch);
  const H = Math.max(NEW_VIEW_MIN_HW, hw);
  const t = tiltFor(tiltDeg, 1, H);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x1 = Math.min(...xs), x2 = Math.max(...xs), y1 = Math.min(...ys), y2 = Math.max(...ys);
  const cx = (x1 + x2) / 2;
  // The play area's sides stay the engine's (2 m past a touchline at most):
  // a stray pass may leave the screen at most PASSERS_FIT_OUT_M before it is out.
  const ex1 = Math.max(engine.x1, -2), ex2 = Math.min(engine.x2, PITCH_W + 2);
  let across = Math.max(PASSERS_FIT_MIN_M, x2 - x1 + 2 * PASSERS_FIT_SIDE_M, (y2 - y1 + 2 * PASSERS_FIT_END_M) / H,
    ex2 - ex1 - 2 * PASSERS_FIT_OUT_M);
  for (;; across += 0.25) {
    const down = across * H;
    let vx1 = cx - across / 2;
    vx1 = Math.max(Math.min(x1 - PASSERS_FIT_SIDE_M, -EDGE_M), Math.min(Math.max(x2 + PASSERS_FIT_SIDE_M, PITCH_W + EDGE_M) - across, vx1));
    vx1 = Math.max(ex2 - PASSERS_FIT_OUT_M - across, Math.min(ex1 + PASSERS_FIT_OUT_M, vx1));
    // The top edge IS the engine's goal-side out line, as passersCameraFor's:
    // above it an out line sits in the visible grass (the "ball stops" bug),
    // below it a forward ball flies off the screen while still in play (both
    // seen in playtest films, 3 Oct 2026). The bottom comes up to the passers.
    if (engine.y1 + down < y2 + PASSERS_FIT_END_M && across < NEW_VIEW_WIDTH_M) continue;
    const top = engine.y1;
    const v: Viewport = { x1: vx1, x2: vx1 + across, y1: top, y2: top + down };
    const fits = pts.every((p) => {
      const c = fracOf(v, "up", p);
      return t ? visibleOnScreen(t, c.sx, c.sy, TILT_FIT_MARGIN) : c.sx >= 0 && c.sx <= 1 && c.sy >= 0 && c.sy <= 1;
    }) && !halfCut(sc, v, H, tiltDeg);
    if (fits || across >= NEW_VIEW_WIDTH_M) return v;
  }
}

/**
 * The build-up camera. Its top edge IS the engine's goal-side out line and it
 * is never narrower than the engine's frame, so the play area and the screen
 * are the same rectangle: a long ball leaves the screen at the moment it goes
 * out. Fitting the passers alone (3 Oct 2026, first version) let a ball go
 * out in the middle of the visible grass and sit there — "the ball stops" —
 * or fly off the top of a tighter camera while still in play (playtest film).
 * The passers are always inside the engine's frame, so they are on screen.
 */
function passersCameraFor(sc: Scenario, engine: Viewport, facing: Facing, hw: number): Viewport {
  if (facing !== "up") return passersCamera(passersOf(sc), facing, hw);
  const h = Math.max(NEW_VIEW_MIN_HW, hw);
  const across = Math.min(NEW_VIEW_WIDTH_M, Math.max(PASSERS_MIN_M, engine.x2 - engine.x1 + 0.5));
  const cx = (engine.x1 + engine.x2) / 2;
  let x1 = cx - across / 2;
  x1 = Math.max(Math.min(engine.x1, -EDGE_M), Math.min(Math.max(engine.x2, PITCH_W + EDGE_M) - across, x1));
  return { x1, x2: x1 + across, y1: engine.y1, y2: engine.y1 + across * h };
}

/**
 * The new view's camera — and, applied to the scenario, its play area.
 *
 * `engine` is the frame the engine built the chance in (today's camera),
 * `hw` the canvas's height ÷ width. The result holds the canvas aspect
 * exactly (same metres per pixel both ways) and always contains `engine`
 * where the screen is big enough to.
 */
export function newViewCamera(
  engine: Viewport, facing: Facing, hw: number, ball: Vec2, acrossM: number = NEW_VIEW_WIDTH_M,
): Viewport {
  const across = acrossM;                          // screen width, in metres
  const down = across * Math.max(NEW_VIEW_MIN_HW, hw); // screen height, in metres

  if (facing === "up") {
    // Across: centred on the situation, never more than EDGE_M off the pitch.
    const cx = (engine.x1 + engine.x2) / 2;
    let x1 = cx - across / 2;
    x1 = Math.max(-EDGE_M, Math.min(PITCH_W + EDGE_M - across, x1));
    // Down: hung from just behind the goal, unless the situation is so deep
    // that its own frame would fall off the bottom.
    const want = Math.max(-BEHIND_GOAL_M, engine.y2 + BOTTOM_ROOM_M - down);
    const y1 = Math.min(engine.y1, want);
    return { x1, x2: x1 + across, y1, y2: y1 + down };
  }

  // Side-on. The screen's width is pitch depth (y), its height pitch width (x).
  // Depth starts where the engine's side view does (just behind the goal).
  const y1 = engine.y1;
  // Work as if facing "right" (pitch x runs DOWN the screen, the ball's
  // touchline at the bottom); "left" is the mirror image.
  const mirror = facing === "left";
  const bx = mirror ? PITCH_W - ball.x : ball.x;
  const hi = PITCH_W + TURNED_NEAR_M;          // lowest the bottom edge may sit
  const lo = down - TURNED_FAR_M;              // the top edge no further than this past the far line
  let x2 = bx + (1 - TURNED_BALL_DOWN) * down;
  x2 = Math.min(hi, Math.max(lo, x2));
  if (lo > hi) x2 = hi;
  const x1 = x2 - down;
  const xs = mirror ? { x1: PITCH_W - x2, x2: PITCH_W - x1 } : { x1, x2 };
  return { ...xs, y1, y2: y1 + across };
}

/** Camera round 3 (fitAction, tighter side-on and build-up cameras). */
// Settings → Look → Gameplay → "Match camera: New | Old" (gameplayVersion.ts).
// Read at each framing, so a flip takes effect on the next chance. Tests and
// test pages may force it (null: follow the setting).
let actionFitOverride: boolean | null = null;
export function setActionFit(v: boolean | null): void { actionFitOverride = v; }
export function actionFitOn(): boolean { return actionFitOverride ?? !oldActionCamera(); }

/** The scenario as CanvasMatch frames it: the engine's own frame, kept. */
type Framed = Scenario & { engineFrame?: Viewport; playZoom?: number; wideChecked?: boolean };

/** The frame the engine built this chance in (today's camera). */
export function engineFrameOf(sc: Scenario): Viewport {
  return (sc as Framed).engineFrame ?? sc.viewport;
}

/**
 * Put a built chance into the new view: remember the engine's frame, and make
 * the play area the camera. Safe to call twice (a touch-on continuation reuses
 * its scenario). Returns the camera.
 *
 * `keepPlayArea`: a goal replay keeps the play area it was recorded with, so
 * it replays exactly.
 */
export function frameForNewView(sc: Scenario, hw: number, keepPlayArea = false, tiltDeg = 0): Viewport {
  const f = sc as Framed;
  if (!f.engineFrame) f.engineFrame = { ...sc.viewport };
  const facing = sc.facing ?? "up";
  const base = cameraFor(sc, f.engineFrame, hw);
  const today = fitCameraToTilt(base, facing, hw, tiltDeg, keyPointsOf(sc));
  let cam = today;
  f.playZoom = 1;
  // A wide chance turned side-on (Wide chances: New): the men and the ball
  // stay the size they are upright, as the Zoom keeps them — only the pitch
  // zooms. Upright the screen is the kind's width across; side-on, `across`.
  if (facing !== "up" && WIDE_TURN_KINDS.includes(sc.kind)) {
    const upright = acrossFor(sc.kind, f.engineFrame, "up");
    const across = cam.y2 - cam.y1;
    if (typeof upright === "number" && across > 0) f.playZoom = upright / across;
  }
  // Chance framing "Zoom" (lib/star/chanceFraming.ts): only up the pitch with
  // the goal in the picture. Side-on chances (corners, byline crosses) and
  // build-up stay exactly as they were.
  if (playZoom() !== "off" && facing === "up" && goalInView(sc.kind)) {
    const z = zoomToPlay(base, sc, hw);
    const zc = playZoom() === "z2max" ? z : fitCameraToTilt(z, facing, hw, tiltDeg, keyPointsOf(sc));
    if (playZoom() === "z2" && actionFitOn()) {
      // Match camera: New (camera round 3). Every candidate camera is held to
      // the one rule — the action wholly on the glass, nobody else cut in
      // half by an edge (framingFaults) — and the tightest that keeps it wins.
      const cands: Viewport[] = [today];
      if (z !== base) cands.push(zc);
      const fit = fitToPlay(base, sc, hw, tiltDeg);
      if (fit) cands.push(fit);
      const act = fitAction(base, sc, hw, tiltDeg);
      if (act) cands.push(act);
      // Tightest first. A camera a little wider than today is allowed only
      // when nothing tighter keeps the action on screen (a man in the action
      // that today's camera, which does not promise him, crops).
      let bestK = 0;
      for (const c of cands) {
        const k = (today.x2 - today.x1) / (c.x2 - c.x1);
        if (k <= bestK + 1e-9) continue;
        if (framingFaults(sc, c, hw, tiltDeg).length) continue;
        cam = c; bestK = k;
      }
      f.playZoom = bestK > 0 ? bestK : 1;
      if (bestK === 0) cam = today;
    } else {
    const k = (today.x2 - today.x1) / (zc.x2 - zc.x1);
    // Never wider than today (the tilt fit can pull a zoomed camera back past it).
    if (z !== base && k > 1.001) { cam = zc; f.playZoom = k; }
    // The default (Zoom): also try fitting on the glass, zoom and pan chosen
    // together under the tilt (fitToPlay), and keep whichever is tighter.
    if (playZoom() === "z2") {
      const fit = fitToPlay(base, sc, hw, tiltDeg);
      const kf = fit ? (today.x2 - today.x1) / (fit.x2 - fit.x1) : 1;
      if (fit && kf > Math.max(1.001, f.playZoom ?? 1)) { cam = fit; f.playZoom = kf; }
    }
    }
  }
  // Build-up and midfield passes, Match camera New (camera round 3): the
  // camera fitted to the passers (passersFit), when it is tighter and keeps
  // the rule. The men stay today's size, as the Zoom keeps them.
  if (playZoom() !== "off" && actionFitOn() && facing === "up" && acrossFor(sc.kind, f.engineFrame, "up") === "passers") {
    const pf = passersFit(sc, f.engineFrame, hw, tiltDeg);
    const k = (today.x2 - today.x1) / (pf.x2 - pf.x1);
    if (k > 1.001 && !framingFaults(sc, pf, hw, tiltDeg).length) {
      cam = pf;
      f.playZoom = playZoom() === "z1" ? 1 : k;
    }
  }
  if (!keepPlayArea) sc.viewport = playAreaFor(sc, cam, f.engineFrame);
  return cam;
}

// ─────────────────────────────────────────────────────────────────────────────
// ZOOM TO THE PLAY — Settings → Look → "Chance framing: Zoom | Old"
// (lib/star/chanceFraming.ts). The canvas keeps its size; the camera zooms in
// so the screen ends about ZOOM_ROOM_M below the lowest man, as far as it can
// without cutting anyone off. Harry picked "z2" (9 Oct 2026): the men and the
// ball stay today's size on screen, only the pitch zooms. "z1" (figures grow)
// and "z2max" (zoom all the way, men may be cut off) are reachable only from
// the test page /star-zoomgrass-dev.
// ─────────────────────────────────────────────────────────────────────────────
export type PlayZoom = "off" | "z1" | "z2" | "z2max";
let playZoomOverride: PlayZoom | null = null;
export function playZoom(): PlayZoom {
  if (playZoomOverride) return playZoomOverride;
  return chanceFraming() === "zoom" ? "z2" : "off";
}
/** The test page's own choice (null: follow Settings). */
export function setPlayZoomOverride(v: PlayZoom | null): void { playZoomOverride = v; probe = v !== null; }
let probe = false;
/** The zoom test page is open (it reads the camera through window.__zg). */
export function playZoomProbe(): boolean { return probe; }
/** The zoom the last framing used for this chance (1 = today). */
export function playZoomOf(sc: Scenario): number { return (sc as Framed).playZoom ?? 1; }

/** Grass kept below the lowest man. */
export const ZOOM_ROOM_M = 6;
/** A man's centre at least this far from a side edge / the top edge. */
const ZOOM_SIDE_M = 0.9;
const ZOOM_TOP_M = 1;
/** Never more than this much zoom. */
export const ZOOM_MAX = 2.5;
/** At least this much grass below the ball, to pull back into. */
export const ZOOM_MIN_PULL_M = 5;

/**
 * Is this man actually on the pitch? A man a chance does not use is walked
 * to (-400, 400), "behind the ball and off the picture" (authoredChance.ts
 * OFF_THE_PICTURE, scenarioEdit.ts OFF_PITCH, scenePicture.ts): a drawing
 * with no poacher parks the follower there, and so does EVERY Kane drawing.
 * Same test as chanceMaker.ts's `parked`.
 */
export function onThePitch(p: Vec2): boolean {
  return !(p.x < -50 || p.x > PITCH_W + 50 || p.y > 150 || p.y < -50);
}

/**
 * Everyone in the chance (the follower too when he is drawn), and nobody
 * who has been parked off the picture.
 *
 * THE EMPTY-GRASS BUG (Harry, 11 Oct 2026: "the camera view where it shows a
 * huge area of the pitch where no one's at — yeah that's just bugged"). The
 * parked follower used to be counted as a man to keep on screen. The zoom
 * cannot fit a man 400 m away, so it gave up and served the kind's widest
 * camera: on 5-14% of drawn chances (one-on-ones 10%, cutbacks 9%, free kicks
 * 9%) and on EVERY Kane drawing. Measured on Kane one-on-ones: the people
 * covered 11% of the screen, 66% of it empty grass below them.
 */
export function bodiesOf(sc: Scenario): Vec2[] {
  const decorative = sc.kind === "volley" || sc.kind === "header";
  const pts: Vec2[] = [sc.ball, sc.player, ...sc.defenders, ...(decorative ? [] : sc.teammates)];
  if (sc.runner) pts.push(sc.runner.pos);
  for (const r of sc.secondaryRunners ?? []) pts.push(r.pos);
  if (sc.follower && goalInView(sc.kind)) pts.push(sc.follower);
  return pts.filter(onThePitch);
}

/**
 * Zoom `cam` in about the top-centre of the screen (where the goal hangs),
 * panning sideways as needed, so the screen ends ZOOM_ROOM_M below the
 * lowest man with everyone, the goal and the keeper still in view. Same
 * aspect, so the canvas and the drag are untouched. Steps the zoom down
 * until it fits; 1 = no zoom.
 */
export function zoomToPlay(cam: Viewport, sc: Scenario, hw: number): Viewport {
  const facing = sc.facing ?? "up";
  const spanX = cam.x2 - cam.x1, spanY = cam.y2 - cam.y1;
  const across = facing === "up" ? spanX : spanY;
  const down = facing === "up" ? spanY : spanX;
  void hw;
  const bodies = bodiesOf(sc).map((p) => fracOf(cam, facing, p));
  const key = goalInView(sc.kind)
    ? [{ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }].filter(onThePitch).map((p) => fracOf(cam, facing, p))
    : [];
  const ballF = fracOf(cam, facing, sc.ball);
  const low = Math.max(...bodies.map((b) => b.sy));
  for (let k = Math.min(ZOOM_MAX, 1 / (low + ZOOM_ROOM_M / down)); k > 1; k -= 0.02) {
    if ((1 - ballF.sy * k) * (down / k) < ZOOM_MIN_PULL_M) continue;
    const mx = (ZOOM_SIDE_M * k) / across, my = (ZOOM_TOP_M * k) / down;
    if (bodies.some((b) => b.sy * k < my) && playZoom() !== "z2max") continue;
    let pLo = -Infinity, pHi = Infinity;
    const need = (sx: number, m: number) => {
      const a = 0.5 + (sx - 0.5) * k;
      pLo = Math.max(pLo, m - a); pHi = Math.min(pHi, 1 - m - a);
    };
    bodies.forEach((b) => need(b.sx, mx));
    key.forEach((b) => need(b.sx, 0));
    // "z2max" (the option past the line): zoom all the way, men may fall off
    // the sides; the pan keeps the cut even on both sides.
    if (pLo > pHi && playZoom() === "z2max") return zoomView(cam, facing, k, (pLo + pHi) / 2);
    if (pLo > pHi) continue;
    let p = Math.max(pLo, Math.min(pHi, 0));
    if (facing === "up") {
      // Keep no more than EDGE_M past a touchline when that fits.
      const w = spanX / k;
      const x1At = (q: number) => cam.x1 + (0.5 + (-0.5 - q) / k) * spanX;
      const want = Math.max(-EDGE_M, Math.min(PITCH_W + EDGE_M - w, x1At(p)));
      p = Math.max(pLo, Math.min(pHi, p - ((want - x1At(p)) / spanX) * k));
    }
    return zoomView(cam, facing, k, p);
  }
  return cam;
}

/** `cam` zoomed k× about the screen's top-centre, then panned p (new-screen widths). */
function zoomView(cam: Viewport, facing: Facing, k: number, p: number): Viewport {
  const spanX = cam.x2 - cam.x1, spanY = cam.y2 - cam.y1;
  const s0 = 0.5 + (-0.5 - p) / k, s1 = 0.5 + (0.5 - p) / k;  // old sx at the new edges
  const t1 = 1 / k;                                           // old sy at the new bottom
  if (facing === "up") return { x1: cam.x1 + s0 * spanX, x2: cam.x1 + s1 * spanX, y1: cam.y1, y2: cam.y1 + t1 * spanY };
  if (facing === "right") return { x1: cam.x1, x2: cam.x1 + t1 * spanX, y1: cam.y1 + (1 - s1) * spanY, y2: cam.y1 + (1 - s0) * spanY };
  return { x1: cam.x2 - t1 * spanX, x2: cam.x2, y1: cam.y1 + s0 * spanY, y2: cam.y1 + s1 * spanY };
}

/**
 * FIT THE CAMERA TO THE PLAY, ON THE GLASS (Harry, 11 Oct 2026: "the camera
 * view where it shows a huge area of the pitch where no one's at — that's
 * just bugged").
 *
 * zoomToPlay above fits the play on the FLAT canvas, and then the tilt fit
 * (fitCameraToTilt) pulls the whole camera back about the top of the screen
 * until the near corners — which a tipped-back picture crops — hold everyone
 * again. That second step undid most of the zoom: it grows the picture in
 * every direction to rescue one man near a bottom corner, and it never pans.
 * Measured on served chances (150 a kind, 20°, 390 px phone): grass below the
 * lowest man was 60% of the screen on a tight angle, 54% on a cutback, 55% on
 * a penalty, 39% on a through ball (28% flat).
 *
 * Here the zoom and the pan are chosen together against what the phone
 * actually shows once tipped back: the tightest frame (zooming about the top
 * centre, where the goal hangs, so the goal never moves on screen) that still
 * shows, on the glass,
 *   · every man in the chance (0.9 m off a side, 1 m off the top),
 *   · the keeper and both posts,
 *   · ZOOM_ROOM_M of grass below the lowest man, and
 *   · ZOOM_MIN_PULL_M below the ball to pull back into.
 * Among the pans that work, the one nearest the kind's own camera is taken.
 * Nothing about the chance moves; only the camera. The canvas keeps its size
 * and the drag is read on the glass, so the same pull kicks exactly as hard.
 *
 * Returns null when not even the widest allowed camera (TILT_FIT_MAX) holds
 * them; the caller then keeps today's camera.
 */
export function fitToPlay(base: Viewport, sc: Scenario, hw: number, tiltDeg = 0): Viewport | null {
  const spanX = base.x2 - base.x1, spanY = base.y2 - base.y1;
  const H = Math.max(NEW_VIEW_MIN_HW, hw);
  const t = tiltFor(tiltDeg, 1, H);
  // Flat, the canvas IS the glass and the canvas checks below are the whole test.
  const onGlass = (sx: number, sy: number, m: number): boolean => !t || visibleOnScreen(t, sx, sy, m);
  const men = bodiesOf(sc).map((p) => fracOf(base, "up", p));
  const goal = [{ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }].filter(onThePitch).map((p) => fracOf(base, "up", p));
  const ball = fracOf(base, "up", sc.ball);
  const low = men.reduce((a, b) => (b.sy > a.sy ? b : a), men[0]);
  const roomF = ZOOM_ROOM_M / spanY, pullF = ZOOM_MIN_PULL_M / spanY;
  // Under the tilt the glass's own margin; flat, the same share as the tilt fit.
  const gm = TILT_FIT_MARGIN;
  const kHi = ZOOM_MAX, kLo = 1 / TILT_FIT_MAX;
  for (let k = kHi; k >= kLo - 1e-9; k -= 0.01) {
    const across = spanX / k, down = spanY / k;
    // Canvas: every man inside, 0.9 m off a side, 1 m off the top; room below.
    if (low.sy * k + roomF * k > 1 + 1e-9) continue;
    if (ball.sy * k + pullF * k > 1 + 1e-9) continue;
    const mx = ZOOM_SIDE_M / across, my = ZOOM_TOP_M / down;
    if (men.some((b) => b.sy * k < my)) continue;
    let pLo = -Infinity, pHi = Infinity;
    const need = (sx: number, m: number) => {
      const a = 0.5 + (sx - 0.5) * k;
      pLo = Math.max(pLo, m - a); pHi = Math.min(pHi, 1 - m - a);
    };
    men.forEach((b) => need(b.sx, mx));
    goal.forEach((b) => need(b.sx, 0));
    if (pLo > pHi + 1e-12) continue;
    // The glass: try pans from the kind's own camera (p = 0) outwards.
    const pans: number[] = [];
    const p0 = Math.max(pLo, Math.min(pHi, 0));
    pans.push(p0);
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      const d = ((pHi - pLo) * i) / steps;
      if (p0 + d <= pHi + 1e-12) pans.push(p0 + d);
      if (p0 - d >= pLo - 1e-12) pans.push(p0 - d);
    }
    const sxAt = (sx: number, p: number) => 0.5 + (sx - 0.5) * k + p;
    for (const p of pans) {
      if (t) {
        if (!men.every((b) => onGlass(sxAt(b.sx, p), b.sy * k, gm))) continue;
        if (!goal.every((b) => onGlass(sxAt(b.sx, p), b.sy * k, gm))) continue;
        if (!onGlass(sxAt(low.sx, p), low.sy * k + roomF * k, 0)) continue;
        if (!onGlass(sxAt(ball.sx, p), ball.sy * k + pullF * k, 0)) continue;
      }
      // Keep no more than EDGE_M past a touchline when that fits (as zoomToPlay).
      let q = p;
      const w = spanX / k;
      const x1At = (pp: number) => base.x1 + (0.5 + (-0.5 - pp) / k) * spanX;
      const want = Math.max(-EDGE_M, Math.min(PITCH_W + EDGE_M - w, x1At(q)));
      const q2 = Math.max(pLo, Math.min(pHi, q - ((want - x1At(q)) / spanX) * k));
      if (q2 !== q && (!t || (men.every((b) => onGlass(sxAt(b.sx, q2), b.sy * k, gm))
          && goal.every((b) => onGlass(sxAt(b.sx, q2), b.sy * k, gm))
          && onGlass(sxAt(low.sx, q2), low.sy * k + roomF * k, 0)
          && onGlass(sxAt(ball.sx, q2), ball.sy * k + pullF * k, 0)))) q = q2;
      return zoomView(base, "up", k, q);
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAME THE ACTION, NOT EVERYBODY (camera round 3, 11 Oct 2026)
//
// A phone's match canvas is about twice as tall as it is wide (366 × 744 px on
// a 390 × 844 phone). fitToPlay keeps EVERY man on the glass, so one man
// standing out wide — a defender 9 m off the ball and behind it, a team-mate
// on the far wing — fixes the camera's width, and the height that comes with
// that width is mostly empty grass. Measured in the real match (390 × 844,
// 20°): a one-on-one 35% empty below the lowest man, a tight angle 54%, a
// through ball 28%.
//
// Here the camera is fitted to the people who are part of the chance (the
// ball, you, the keeper and goal, every team-mate near enough to pass to and
// every defender near the ball, marking a team-mate or between the ball and
// the goal). Anyone else is shown when he fits, and never cut in half by an
// edge: he is either wholly on the screen or clearly off it.
// ─────────────────────────────────────────────────────────────────────────────

/** A defender this close to the ball is in the chance. */
export const ACTION_BALL_M = 9;
/** A team-mate this close to the ball is a pass you can see. */
export const ACTION_MATE_M = 15;
/** A defender this close to a team-mate in the chance is marking him. */
const ACTION_MARK_M = 3.5;
/** A defender goal-side of the ball, this far either side of the line from the ball to the posts. */
const ACTION_LANE_M = 4;

/** The people a goal-facing chance is about, and everybody else on the pitch. */
export function actionOf(sc: Scenario): { must: Vec2[]; extra: Vec2[] } {
  const ball = sc.ball;
  const near = (p: Vec2, r: number) => Math.hypot(p.x - ball.x, p.y - ball.y) <= r;
  const must: Vec2[] = [ball, sc.player];
  const extra: Vec2[] = [];
  // A penalty is the taker, the ball and the keeper: the others wait outside the box.
  if (sc.kind === "penalty") {
    for (const p of bodiesOf(sc)) if (p !== ball && p !== sc.player) extra.push(p);
    return { must: must.filter(onThePitch), extra };
  }
  const mates: Vec2[] = [];
  if (sc.runner) mates.push(sc.runner.pos);
  for (const r of sc.secondaryRunners ?? []) mates.push(r.pos);
  if (sc.follower && goalInView(sc.kind)) mates.push(sc.follower);
  const decorative = sc.kind === "volley" || sc.kind === "header";
  if (!decorative) mates.push(...sc.teammates);
  const keptMates: Vec2[] = [];
  for (const m of mates.filter(onThePitch)) {
    // The man the pass is aimed at is always in the picture.
    if ((sc.runner && m === sc.runner.pos) || near(m, ACTION_MATE_M)) { must.push(m); keptMates.push(m); } else extra.push(m);
  }
  const loX = Math.min(ball.x, POST_L) - ACTION_LANE_M, hiX = Math.max(ball.x, POST_R) + ACTION_LANE_M;
  for (const d of sc.defenders.filter(onThePitch)) {
    const inLane = d.y <= ball.y + 1.5 && d.x >= loX && d.x <= hiX;
    const marking = keptMates.some((m) => Math.hypot(d.x - m.x, d.y - m.y) <= ACTION_MARK_M);
    if (near(d, ACTION_BALL_M) || inLane || marking) must.push(d); else extra.push(d);
  }
  return { must: must.filter(onThePitch), extra };
}

/**
 * What a framed chance promises to show (for tests and test pages):
 * `must` is always wholly on the screen; each of `extra` is wholly on it or
 * clearly off it, never cut in half by an edge. With the Match camera on New,
 * an up-the-pitch chance with the goal in view promises only its action
 * (actionOf) plus the keeper and posts; everything else promises everybody.
 */
export function framingPromise(sc: Scenario): { must: Vec2[]; extra: Vec2[] } {
  if (actionFitOn() && playZoom() === "z2" && (sc.facing ?? "up") === "up" && goalInView(sc.kind)) {
    const { must, extra } = actionOf(sc);
    const goal = [{ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }].filter(onThePitch);
    return { must: [...must, ...goal], extra };
  }
  if (actionFitOn() && playZoom() !== "off" && (sc.facing ?? "up") === "up" && NEW_VIEW_KIND_WIDTH_M[sc.kind] === "passers") {
    const must = passersOf(sc).filter(onThePitch);
    return { must, extra: bodiesOf(sc).filter((p) => !must.includes(p)) };
  }
  return { must: keyPointsOf(sc), extra: [] };
}

/** A man counts as wholly on the screen this far inside an edge (screen widths)… */
export const WHOLLY_ON_EDGE = 0.015;
/** …and as clearly off it this far outside one. Between the two he is cut in half. */
export const CLEARLY_OFF_EDGE = 0.04;

/**
 * Check a framed chance against its promise (framingPromise): every `must`
 * on the screen as seen (tilt included), every `extra` wholly on or clearly
 * off. Returns what broke, in words; empty when the camera keeps its promise.
 */
export function framingFaults(sc: Scenario, cam: Viewport, hw: number, tiltDeg = 0): string[] {
  const H = Math.max(NEW_VIEW_MIN_HW, hw);
  const t = tiltFor(tiltDeg, 1, H);
  const facing = sc.facing ?? "up";
  const out: string[] = [];
  const { must, extra } = framingPromise(sc);
  const at = (p: Vec2) => { const c = fracOf(cam, facing, p); return canvasToScreen(t, c.sx, c.sy, 1, H); };
  for (const p of must) {
    const c = fracOf(cam, facing, p);
    if (!visibleOnScreen(t, c.sx, c.sy)) out.push(`(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) in the action is off the screen`);
  }
  for (const p of extra) {
    const g = at(p);
    // In screen widths from each edge (negative = outside).
    const inside = Math.min(g.X, 1 - g.X, g.Y, H - g.Y);
    if (inside < WHOLLY_ON_EDGE && inside > -CLEARLY_OFF_EDGE) out.push(`(${p.x.toFixed(1)}, ${p.y.toFixed(1)}) is cut in half by an edge`);
  }
  return out;
}

/** Grass kept below the lowest man in the action (he is wholly on the screen, with a strip under him). */
export const ACTION_ROOM_M = 3.5;
/** A man counts as clearly off the screen this far past an edge (screen widths). */
const ACTION_OFF_EDGE = 0.04;

/**
 * The tightest camera, zooming about the top-centre as fitToPlay does, that
 * shows on the glass every man in `actionOf(sc).must` (0.9 m off a side, 1 m
 * off the top), the keeper and both posts, ZOOM_ROOM_M below the lowest of
 * them and ZOOM_MIN_PULL_M below the ball, and that cuts nobody else in half.
 * Among the pans that work it keeps the most of everybody else, then the one
 * that centres the action. Null when even the widest camera cannot.
 */
export function fitAction(base: Viewport, sc: Scenario, hw: number, tiltDeg = 0): Viewport | null {
  const spanX = base.x2 - base.x1, spanY = base.y2 - base.y1;
  const H = Math.max(NEW_VIEW_MIN_HW, hw);
  const t = tiltFor(tiltDeg, 1, H);
  const { must, extra } = actionOf(sc);
  const men = must.map((p) => fracOf(base, "up", p));
  const others = extra.map((p) => fracOf(base, "up", p));
  const goal = [{ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }].filter(onThePitch).map((p) => fracOf(base, "up", p));
  const ball = fracOf(base, "up", sc.ball);
  const low = men.reduce((a, b) => (b.sy > a.sy ? b : a), men[0]);
  const roomF = ACTION_ROOM_M / spanY, pullF = ZOOM_MIN_PULL_M / spanY;
  const gm = TILT_FIT_MARGIN;
  // On the glass, in screen widths (x 0..1, y 0..H).
  const glass = (sx: number, sy: number) => (t ? canvasToScreen(t, sx, sy, 1, H) : { X: sx, Y: sy * H });
  const onGlass = (sx: number, sy: number, m: number): boolean => (t ? visibleOnScreen(t, sx, sy, m) : sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1);
  const allMen = [...men, ...others];
  const midX = (Math.min(...men.map((b) => b.sx), ...goal.map((b) => b.sx)) + Math.max(...men.map((b) => b.sx), ...goal.map((b) => b.sx))) / 2;
  for (let k = ZOOM_MAX; k >= 1 / TILT_FIT_MAX - 1e-9; k -= 0.01) {
    const across = spanX / k, down = spanY / k;
    if (low.sy * k + roomF * k > 1 + 1e-9) continue;
    if (ball.sy * k + pullF * k > 1 + 1e-9) continue;
    const mx = ZOOM_SIDE_M / across, my = ZOOM_TOP_M / down;
    if (men.some((b) => b.sy * k < my)) continue;
    let pLo = -Infinity, pHi = Infinity;
    const need = (sx: number, m: number) => {
      const a = 0.5 + (sx - 0.5) * k;
      pLo = Math.max(pLo, m - a); pHi = Math.min(pHi, 1 - m - a);
    };
    men.forEach((b) => need(b.sx, mx));
    goal.forEach((b) => need(b.sx, 0));
    if (pLo > pHi + 1e-12) continue;
    const sxAt = (sx: number, p: number) => 0.5 + (sx - 0.5) * k + p;
    const x1At = (p: number) => base.x1 + (0.5 + (-0.5 - p) / k) * spanX;
    const pMid = Math.max(pLo, Math.min(pHi, 0.5 - (0.5 + (midX - 0.5) * k)));
    let best: { p: number; shown: number; off: number; edge: boolean } | null = null;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const p = pHi > pLo ? pLo + ((pHi - pLo) * i) / steps : pLo;
      if (!men.every((b) => onGlass(sxAt(b.sx, p), b.sy * k, gm))) continue;
      if (!goal.every((b) => onGlass(sxAt(b.sx, p), b.sy * k, gm))) continue;
      if (!onGlass(sxAt(low.sx, p), low.sy * k + roomF * k, 0)) continue;
      if (!onGlass(sxAt(ball.sx, p), ball.sy * k + pullF * k, 0)) continue;
      // Nobody half on: wholly inside, or clearly past an edge.
      let shown = 0, half = false;
      for (const b of allMen) {
        const sx = sxAt(b.sx, p), sy = b.sy * k;
        if (onGlass(sx, sy, gm)) { shown++; continue; }
        const g = glass(sx, sy);
        const off = g.X < -ACTION_OFF_EDGE || g.X > 1 + ACTION_OFF_EDGE || g.Y > H + ACTION_OFF_EDGE || g.Y < -ACTION_OFF_EDGE;
        if (!off) { half = true; break; }
      }
      if (half) continue;
      // No more than EDGE_M of grass past a touchline, when that can be had.
      const x1 = x1At(p), edge = x1 >= -EDGE_M - 1e-6 && x1 + spanX / k <= PITCH_W + EDGE_M + 1e-6;
      const c = { p, shown, off: Math.abs(p - pMid), edge };
      if (!best || (c.edge && !best.edge) || (c.edge === best.edge && (c.shown > best.shown || (c.shown === best.shown && c.off < best.off)))) best = c;
    }
    if (best) return zoomView(base, "up", k, best.p);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// WIDE CHANCES SIDE-ON — Settings → Look → "Wide chances: New | Old"
// (lib/star/wideChances.ts). Old by default.
//
// A tight angle, a cutback and a penalty put their people in a strip about
// 20–25 m wide near the goal line. Upright, a phone-shaped camera that wide is
// about twice as tall, so even after fitToPlay the grass below the lowest man
// was 58% / 50% / 55% of the screen (390 px phone, 20° tilt). Turned a quarter
// turn — the camera corners and byline crosses already use — the strip's
// width runs DOWN the tall screen, and the camera is fitted to the people.
// Measured (150 a kind): grass below 58→23%, 50→21%, 55→24%; nobody cut off.
// ─────────────────────────────────────────────────────────────────────────────

/** The kinds New turns side-on. */
export const WIDE_TURN_KINDS: readonly ScenarioKind[] = ["tight_angle", "cutback", "penalty"];
/** Side-on: pitch behind the goal line (the net plus a little). */
const SIDE_BEHIND_M = NET_DEPTH + 1.8;
/** Side-on: grass past the deepest man, and past the outermost man up and down. */
const SIDE_DEPTH_ROOM_M = 2;
const SIDE_EDGE_ROOM_M = 2;
/** Side-on: room behind the ball to pull back into, as a share of the screen's width. */
const SIDE_PULL_SHARE = 0.24;
/** Side-on: never tighter than this across (pitch depth), never wider than the full zoom. */
const SIDE_MIN_ACROSS_M = 16;

/** Would New turn this chance side-on? (The setting is read by the caller.) */
export function turnsSideOn(sc: Scenario): boolean {
  return WIDE_TURN_KINDS.includes(sc.kind) && (sc.facing ?? "up") === "up";
}

/**
 * Turn a freshly built wide chance side-on, when Wide chances is New. Turns
 * the scenario (its `facing`) and stands you beside the ball on the turned
 * screen (canvasEngine's own standOff), so the ball is not on your chest.
 * Call before the chance is framed; does nothing to a chance already turned,
 * to any other kind, or with the setting on Old. Returns whether it turned.
 */
export function turnWideChance(sc: Scenario, restand = true, hw = NEW_VIEW_MAX_HW): boolean {
  const f = sc as Framed;
  if (wideChances() !== "new" || !turnsSideOn(sc) || f.wideChecked) return false;
  // Decided once per chance: a resize re-frames it but never flips it.
  f.wideChecked = true;
  // Turn only when side-on is the tighter picture. A cutback with runners
  // arriving from 30 m out is deep as well as wide; side-on it needed a
  // wider camera than upright (pitch above and below everyone), so it stays.
  const upright = acrossFor(sc.kind, engineFrameOf(sc), "up");
  const was = sc.facing;
  sc.facing = sideOnFacing(sc);
  const cam = sideOnCamera(sc, hw);
  if (typeof upright === "number" && cam.y2 - cam.y1 > upright + 1e-6) { sc.facing = was; return false; }
  // A penalty's taker already stands back for his run-up (pitch geometry,
  // which reads the same side-on), so he is left where he is.
  if (restand) standOff(sc);
  return true;
}

/** Which way a turned wide chance faces: the ball's own side, as a corner does. */
export function sideOnFacing(sc: Scenario): Facing {
  return sc.ball.x >= PITCH_W / 2 ? "right" : "left";
}

/**
 * The side-on camera for a wide chance: the tightest turned frame (the
 * screen's width is pitch depth from just behind the goal; its height pitch
 * width) that holds every man, the keeper and both posts with room round
 * them, and room behind the ball to pull back into.
 */
export function sideOnCamera(sc: Scenario, hw: number): Viewport {
  const facing = sc.facing === "left" ? "left" : "right";
  const H = Math.max(NEW_VIEW_MIN_HW, hw);
  const goal = [{ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }].filter(onThePitch);
  const pts = [...bodiesOf(sc), ...goal];
  const y1 = -SIDE_BEHIND_M;
  const maxY = Math.max(...pts.map((p) => p.y));
  const xLo = Math.min(...pts.map((p) => p.x)) - SIDE_EDGE_ROOM_M;
  const xHi = Math.max(...pts.map((p) => p.x)) + SIDE_EDGE_ROOM_M;
  // Where the ball goes next: a cutback to the man it is pulled back to, anything else at goal.
  const target = sc.kind === "cutback" && sc.runner ? sc.runner.pos : { x: PITCH_W / 2, y: 0 };
  const dx = target.x - sc.ball.x, dy = target.y - sc.ball.y, L = Math.hypot(dx, dy) || 1;
  const lo = Math.max(SIDE_MIN_ACROSS_M, maxY + SIDE_DEPTH_ROOM_M - y1, (xHi - xLo) / H);
  for (let across = lo; ; across += 0.25) {
    const down = across * H;
    const y2 = y1 + across;
    const pull = SIDE_PULL_SHARE * across;
    const px = sc.ball.x - (dx / L) * pull, py = sc.ball.y - (dy / L) * pull;
    if (py > y2 && across < NEW_VIEW_WIDTH_M) continue;
    // Pan down the screen: centred on the people, then nearer the pull room.
    const need = [xLo, xHi, px - 0.5, px + 0.5];
    const nLo = Math.min(...need), nHi = Math.max(...need);
    if (nHi - nLo > down && across < NEW_VIEW_WIDTH_M) continue;
    let x1 = (xLo + xHi) / 2 - down / 2;
    x1 = Math.min(nLo, Math.max(nHi - down, x1));
    return { x1, x2: x1 + down, y1, y2 };
  }
}

/** The camera for this chance: its kind's zoom (NEW_VIEW_KIND_WIDTH_M). */
export function cameraFor(sc: Scenario, engineFrame: Viewport, hw: number): Viewport {
  const facing = sc.facing ?? "up";
  if (facing !== "up" && WIDE_TURN_KINDS.includes(sc.kind)) return sideOnCamera(sc, hw);
  const across = acrossFor(sc.kind, engineFrame, facing);
  if (across === "passers") return passersCameraFor(sc, engineFrame, facing, hw);
  return newViewCamera(engineFrame, facing, hw, sc.ball, across);
}

/**
 * The play area (what the engine calls "out") for the new view: the camera,
 * EXCEPT on the goal side of a chance whose goal the engine never puts in
 * view (build-up, midfield pass). Those chances have no keeper and no back
 * line near goal, so a camera-sized play area let a long ball roll 48 m into
 * an empty net (playtest, 3 Oct 2026). Their goal-side edge stays where the
 * engine's own frame had it, as in Classic: past it the ball is out.
 */
export function playAreaFor(sc: Scenario, cam: Viewport, engineFrame: Viewport): Viewport {
  // Never smaller than the engine's own frame (Classic's out line): a tighter
  // camera must not make a pass go out sooner than it does in Classic.
  const area: Viewport = {
    x1: Math.min(cam.x1, engineFrame.x1), x2: Math.max(cam.x2, engineFrame.x2),
    y1: Math.min(cam.y1, engineFrame.y1), y2: Math.max(cam.y2, engineFrame.y2),
  };
  if (goalInView(sc.kind)) return area;
  const f = sc.facing ?? "up";
  // The goal-side edge is the engine's own, exactly as in Classic.
  if (f === "up") return { ...area, y1: engineFrame.y1 };
  // Turned views put the goal at x = 0 ("right") or the far side ("left"): keep that edge too.
  if (f === "right") return { ...area, x1: engineFrame.x1 };
  return { ...area, x2: engineFrame.x2 };
}

/** The up-the-pitch camera a cross cuts to once it reaches the box. */
export function crossCutCamera(engineView: Viewport, hw: number, ball: Vec2, tiltDeg = 0): Viewport {
  const across = Math.min(NEW_VIEW_WIDTH_M, Math.max(NEW_VIEW_CROSS_CUT_WIDTH_M, engineView.x2 - engineView.x1 + 0.5));
  const cam = newViewCamera(engineView, "up", hw, ball, across);
  return fitCameraToTilt(cam, "up", hw, tiltDeg, [ball, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }]);
}

/** How tall the new view's canvas is on a screen: the room left under what
 *  sits above it, between 5:8 and option D's 38 × 83, in CSS px. */
export function newViewCanvasHeight(widthPx: number, roomPx: number): number {
  const lo = widthPx * NEW_VIEW_MIN_HW, hi = widthPx * NEW_VIEW_MAX_HW;
  if (!(roomPx > 0)) return Math.round(hi);
  return Math.round(Math.max(lo, Math.min(hi, roomPx)));
}

// ─────────────────────────────────────────────────────────────────────────────
// The camera angle (lib/star/cameraTilt.ts)
// ─────────────────────────────────────────────────────────────────────────────

/** What must stay on the screen once the picture is tipped back: the ball,
 *  you, every player in the chance, and the goal and keeper when they are
 *  part of it. (Everyone, not just the ball and the pass target, since the
 *  playtest at 30° cut an arm off a defender in the bottom corner. Measured
 *  cost: at most 6% more zoom-out at 20°, 16% at 30°.) */
export function keyPointsOf(sc: Scenario): Vec2[] {
  // A volley's or header's team-mate is the crosser out by the touchline,
  // which the engine never frames either (those two kinds are switched off).
  const decorative = sc.kind === "volley" || sc.kind === "header";
  const pts: Vec2[] = [sc.ball, sc.player, ...sc.defenders, ...(decorative ? [] : sc.teammates)];
  if (sc.runner) pts.push(sc.runner.pos);
  for (const r of sc.secondaryRunners ?? []) pts.push(r.pos);
  if (goalInView(sc.kind)) pts.push({ x: sc.keeper.x, y: sc.keeper.y }, { x: POST_L, y: 0 }, { x: POST_R, y: 0 });
  // A parked man (or a keeper a mode has taken off, scenePicture.ts) is not
  // in the picture: chasing him would pull the camera back to its limit.
  return pts.filter(onThePitch);
}

/** The largest the camera may grow to keep them in view (×). */
const TILT_FIT_MAX = 1.45;
/** Room kept from the screen's edge, as a share of its width. */
const TILT_FIT_MARGIN = 0.03;

function fracOf(v: Viewport, facing: Facing, p: Vec2): { sx: number; sy: number } {
  const fx = (p.x - v.x1) / (v.x2 - v.x1), fy = (p.y - v.y1) / (v.y2 - v.y1);
  if (facing === "right") return { sx: 1 - fy, sy: fx };
  if (facing === "left") return { sx: fy, sy: 1 - fx };
  return { sx: fx, sy: fy };
}

/**
 * Tipping the picture back crops its near corners. When something that must
 * be seen would fall off, the camera pulls back a step at a time about the
 * top-centre of the screen (the far end, where the goal hangs) until it is
 * in view. Nothing at risk: the camera comes back unchanged.
 *
 * Flat gets the same check, with nothing cropped: a man in the chance
 * standing past the kind's zoom is pulled into view the same way. It used to
 * skip flat entirely, so on the Flat camera a drawn cutback left a man off
 * screen in 92 of 150 chances, and the New chances' extra players sat off
 * screen in almost all of them (v0.27 known issue).
 */
export function fitCameraToTilt(cam: Viewport, facing: Facing, hw: number, tiltDeg: number, pts: Vec2[]): Viewport {
  const t = tiltFor(tiltDeg, 1, Math.max(NEW_VIEW_MIN_HW, hw));
  const inView = (sx: number, sy: number): boolean => t
    ? visibleOnScreen(t, sx, sy, TILT_FIT_MARGIN)
    : sx >= TILT_FIT_MARGIN && sx <= 1 - TILT_FIT_MARGIN && sy >= TILT_FIT_MARGIN && sy <= 1 - TILT_FIT_MARGIN;
  // The pitch point at the top-centre of the screen.
  const ax = facing === "right" ? cam.x1 : facing === "left" ? cam.x2 : (cam.x1 + cam.x2) / 2;
  const ay = facing === "up" ? cam.y1 : (cam.y1 + cam.y2) / 2;
  const grow = (k: number): Viewport => ({
    x1: ax + (cam.x1 - ax) * k, x2: ax + (cam.x2 - ax) * k,
    y1: ay + (cam.y1 - ay) * k, y2: ay + (cam.y2 - ay) * k,
  });
  for (let k = 1; k <= TILT_FIT_MAX + 1e-9; k += 0.025) {
    const v = grow(k);
    if (pts.every((p) => { const c = fracOf(v, facing, p); return inView(c.sx, c.sy); })) return v;
  }
  return grow(TILT_FIT_MAX);
}
