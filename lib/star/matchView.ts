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
import type { Facing, Scenario, Vec2, Viewport } from "./canvasEngine";
import { goalInView } from "./canvasEngine";
import { PITCH_W, NET_DEPTH } from "./pitch";

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
/** The ball: this much of its zoomed-out size (option D: ~7 px). */
export const NEW_BALL_SCALE = 0.7;

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

/**
 * The new view's camera — and, applied to the scenario, its play area.
 *
 * `engine` is the frame the engine built the chance in (today's camera),
 * `hw` the canvas's height ÷ width. The result holds the canvas aspect
 * exactly (same metres per pixel both ways) and always contains `engine`
 * where the screen is big enough to.
 */
export function newViewCamera(engine: Viewport, facing: Facing, hw: number, ball: Vec2): Viewport {
  const across = NEW_VIEW_WIDTH_M;                 // screen width, in metres
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
export function frameForNewView(sc: Scenario, hw: number, keepPlayArea = false): Viewport {
  const f = sc as Framed;
  if (!f.engineFrame) f.engineFrame = { ...sc.viewport };
  const cam = newViewCamera(f.engineFrame, sc.facing ?? "up", hw, sc.ball);
  if (!keepPlayArea) sc.viewport = playAreaFor(sc, cam, f.engineFrame);
  return cam;
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
  if (goalInView(sc.kind)) return { ...cam };
  const f = sc.facing ?? "up";
  if (f === "up") return { ...cam, y1: Math.max(cam.y1, engineFrame.y1) };
  // Turned views put the goal at x = 0 ("right") or the far side ("left"): keep that edge too.
  if (f === "right") return { ...cam, x1: Math.max(cam.x1, engineFrame.x1) };
  return { ...cam, x2: Math.min(cam.x2, engineFrame.x2) };
}

/** The up-the-pitch camera a cross cuts to once it reaches the box. */
export function crossCutCamera(engineView: Viewport, hw: number, ball: Vec2): Viewport {
  return newViewCamera(engineView, "up", hw, ball);
}

/** How tall the new view's canvas is on a screen: the room left under what
 *  sits above it, between 5:8 and option D's 38 × 83, in CSS px. */
export function newViewCanvasHeight(widthPx: number, roomPx: number): number {
  const lo = widthPx * NEW_VIEW_MIN_HW, hi = widthPx * NEW_VIEW_MAX_HW;
  if (!(roomPx > 0)) return Math.round(hi);
  return Math.round(Math.max(lo, Math.min(hi, roomPx)));
}
