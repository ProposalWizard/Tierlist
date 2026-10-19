/**
 * PHASE 1 OF THE FULL HIGHLIGHTS REBUILD — the still is the match's camera.
 *
 * Infinite Highlights' still was drawn with the chance's own builder frame
 * (`sc.viewport`), flat, with you standing on the ball. Press Play and the
 * real match (CanvasMatch, through EnginePlay) re-frames the same chance with
 * the new view's camera: its own zoom (`frameForNewView`), its own canvas shape
 * (the room on the screen, `newViewCanvasHeight`), tipped back by the camera
 * angle (cameraTilt.ts), you hidden on a shooting chance (`showYouFigure`) and
 * smaller men. So everything jumped the moment you pressed Play.
 *
 * On Infinite Highlights (its default since phase 1) the still is framed by THIS function,
 * which runs the same steps, in the same order, that CanvasMatch runs on an
 * opening picture before its first frame (see CanvasMatch: "The opening
 * scenario is built before this component mounts" → frameScenario):
 *   1. standBackForRunup — a penalty's or free kick's taker stands back;
 *   2. turnWideChance — only when Wide chances is New (decided Old today);
 *   3. the angle for this chance (corners, crosses and anything turned: flat);
 *   4. frameForNewView with that canvas shape and angle.
 * Nothing here is new framing: every function is the match's own, imported.
 * ?still=builder on that page: never called, the old builder frame.
 *
 * Checked by a browser run of 100 presses (scripts/fhr/still-vs-play.mjs):
 * the still's camera against `window.__starMatch.frame()` on Play.
 */
import { type Scenario } from "../canvasEngine";
import { frameFromScenario, type Frame } from "../scenarioFrame";
import {
  frameForNewView, turnWideChance, playZoomOf, playZoom,
  NEW_FIGURE_SCALE, NEW_OUTFIELD_SHRINK, NEW_BALL_SCALE, figureGrow, newViewCanvasHeight, matchView,
} from "../matchView";
import { hasRunup } from "../penaltyRunup";
import { standBackFor, yourRunupFor, penaltyRunupOf, freeKickRunupOf } from "../runupStyles";
import { showYouFigure } from "../newLook";
import { cameraTilt } from "../cameraTilt";

export interface MatchStill {
  /** The frame to paint: the match's camera, `you` taken out when hidden. */
  frame: Frame;
  /** The camera angle the match tips this chance by (degrees, 0 = flat). */
  tilt: number;
  /** The match canvas's height / width this was framed for. */
  hw: number;
  /** You are not drawn (open play in the new view: the ball is you). */
  youHidden: boolean;
  /** The men's, the keeper's and the ball's size against today's still. */
  figureScale: number;
  keeperScale: number;
  ballScale: number;
}

/** The camera angle CanvasMatch gives a chance (its `tiltForChance`). */
export function tiltForChance(sc: Scenario, setting: number): number {
  return sc.kind === "corner" || sc.kind === "byline_cross" || (sc.facing ?? "up") !== "up" ? 0 : setting;
}

/**
 * The match canvas's shape for a picture `widthPx` wide, given the room under
 * it (CanvasMatch: window height − pinned bars − what sits above − 12).
 */
export function matchCanvasHW(widthPx: number, roomPx: number): number {
  return newViewCanvasHeight(widthPx, roomPx) / widthPx;
}

/**
 * Frame a freshly built chance the way the real match will frame it on Play.
 * Works on a copy; `sc` is not touched. `tiltSetting`: Settings' camera angle
 * (CanvasMatch reads cameraTilt() in the new view, 0 in Classic).
 */
export function matchStill(sc0: Scenario, hw: number, tiltSetting = matchView() === "new" ? cameraTilt() : 0): MatchStill {
  const sc: Scenario = JSON.parse(JSON.stringify(sc0));
  const newView = matchView() === "new";
  // 1. CanvasMatch's standBackForRunup, with the default run-up (EnginePlay
  //    has no career, so runupStyleRef holds the defaults).
  if (hasRunup(sc.kind)) {
    const style = yourRunupFor(sc.kind, penaltyRunupOf(undefined), freeKickRunupOf(undefined));
    sc.player = standBackFor(style, sc.ball, sc.player, sc.viewport);
  }
  let tilt = 0;
  if (newView) {
    // 2–4. frameScenario's new-view branch.
    turnWideChance(sc, !hasRunup(sc.kind), hw);
    tilt = tiltForChance(sc, tiltSetting);
    const was = sc.facing ?? "up";
    const cam = frameForNewView(sc, hw, false, tilt);
    if ((sc.facing ?? "up") !== was) tilt = tiltForChance(sc, tiltSetting);
    const frame = frameFromScenario(sc);
    frame.camera = { ...cam };
    frame.facing = sc.facing;
    const youHidden = !showYouFigure(sc.kind, { newView: true });
    if (youHidden) frame.items = frame.items.filter((it) => it.side !== "you");
    // CanvasMatch's sizes (its `R`, `KR`, `BALL_PX`): the new view's men are
    // drawn smaller, and the Zoom keeps them today's size as the pitch zooms.
    const zoomDiv = playZoom() === "z2" || playZoom() === "z2max" ? playZoomOf(sc) : 1;
    const g = figureGrow() / zoomDiv;
    return {
      frame, tilt, hw, youHidden,
      figureScale: NEW_FIGURE_SCALE * NEW_OUTFIELD_SHRINK * g,
      keeperScale: NEW_FIGURE_SCALE * g,
      ballScale: NEW_BALL_SCALE * g,
    };
  }
  // Classic view: the builder's frame, as the match draws it.
  return { frame: frameFromScenario(sc), tilt: 0, hw, youHidden: false, figureScale: 1, keeperScale: 1, ballScale: 1 };
}

/**
 * The editor's picture with the match's camera on it: today's base frame
 * (items keep their ids, so every edit and save works as before), with the
 * match's camera, turn and sizes, and you where the match puts you — or not
 * drawn, as in the match.
 */
export function withMatchCamera(base: Frame, still: MatchStill): Frame {
  const you = still.frame.items.find((it) => it.side === "you");
  const items = still.youHidden
    ? base.items.filter((it) => it.side !== "you")
    : base.items.map((it) => (it.side === "you" && you ? { ...it, at: { ...you.at } } : it));
  return {
    ...base,
    items,
    camera: { ...still.frame.camera },
    facing: still.frame.facing,
    sizes: { figure: still.figureScale, keeper: still.keeperScale, ball: still.ballScale },
  };
}
