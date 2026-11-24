/**
 * THE 3D MATCH VIEW'S SCENE (the website's components/star/Match3DLayer.tsx → lib/star/style3d/engineView.ts), loaded the first
 * time a match asks for the 3D. A plain `require` on purpose (as ./gardenScene.ts): the code is always inside the app's one
 * bundle and only runs when the 3D view starts. The scene is the website's own and is not touched.
 *
 * `createEngineView(container, { def, tier, tod, tilt })` draws the match FROM the match: every call to `frame(f)` is one real
 * match frame (./matchFrame.ts builds it from the phone's one driver) and the view draws exactly that: the men where the 2D
 * picture has them, the keeper and his dive, the ball with its height. It runs no football of its own, has no loop of its own
 * (it draws inside `frame`), and takes no touch (no `canvas2d` is given, as a layer that the 2D match stays under).
 *
 * Adapted to the host's one shape, start(container, callbacks, data, { quality }): the controller has the two things the host
 * asks of every place (a stick and a look-round: a match view has neither) and `stats` for "Show 3D speed".
 */
import type { EngineFrame } from "@/lib/star/engineFrame";
import type { TimeOfDay } from "@/lib/star/style3d/real/assets";
import type { WalkController, WalkStart } from "./walkHost";

/** The website's career camera angle (Match3DLayer CAREER_3D_TILT): degrees from straight down. */
export const CAREER_3D_TILT = 45;

export interface MatchViewData {
  /** The fixture's kick-off light (lib/star/style3d/matchTod.ts matchTodFor). */
  tod: TimeOfDay;
}
export interface MatchViewController extends WalkController {
  /** One real match frame to draw. Throws if the 3D could not draw it (the screen counts those and falls back to 2D). */
  frame(f: EngineFrame): void;
  /** Draw or hide (hidden: the GL view rests, no frames are asked of the scene). */
  setVisible(on: boolean): void;
}
export type MatchViewStart = WalkStart<MatchViewData, Record<string, never>, MatchViewController>;

export function loadMatchViewStart(): MatchViewStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./gardenDeps"); // what the scenes load later with import() (three's helpers, the people)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./trainingDeps"); // look H (real/look, real/assets) and the football clips
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("./matchViewDeps"); // what the match view adds to those
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require("@/lib/star/style3d/engineView") as typeof import("@/lib/star/style3d/engineView");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const st = require("@/lib/star/style3d/styles") as typeof import("@/lib/star/style3d/styles");
  return async (container, _cb, data, opts) => {
    const view = await m.createEngineView(container, { def: st.resolveStyle("real", "play"), tier: opts.quality, tod: data.tod, tilt: CAREER_3D_TILT });
    let frames = 0;
    const c: MatchViewController = {
      setStick() { /* a match view has no stick */ },
      orbit() { /* nor a look-round */ },
      frame(f) { view.frame(f); frames++; },
      setVisible(on) { view.setVisible(on); },
      stats() { return { calls: 0, triangles: 0, quality: opts.quality ?? "?", frames }; },
      dispose() { view.dispose(); },
    };
    return c;
  };
}
