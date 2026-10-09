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
import { goalInView } from "./canvasEngine";
import { PITCH_W, NET_DEPTH, POST_L, POST_R } from "./pitch";
import { tiltFor, visibleOnScreen } from "./cameraTilt";

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

/** The scenario as CanvasMatch frames it: the engine's own frame, kept. */
type Framed = Scenario & { engineFrame?: Viewport };

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
  const cam = fitCameraToTilt(cameraFor(sc, f.engineFrame, hw), sc.facing ?? "up", hw, tiltDeg, keyPointsOf(sc));
  if (!keepPlayArea) sc.viewport = playAreaFor(sc, cam, f.engineFrame);
  return cam;
}

/** The camera for this chance: its kind's zoom (NEW_VIEW_KIND_WIDTH_M). */
export function cameraFor(sc: Scenario, engineFrame: Viewport, hw: number): Viewport {
  const facing = sc.facing ?? "up";
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
  return pts;
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
