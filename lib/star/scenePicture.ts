/**
 * WHAT IS ON THE PITCH — for a feature that only needs the match's mechanics.
 *
 * Asked for by Harry (24 Sep 2026): "different modes and training/trials will
 * be COMPLETELY looking different - and that can't be seen as a new build it
 * has to be allowed - i.e technique training does not need a goalie/goal yet
 * in every drill there's a keeper - now the main game is dragging into every
 * mode when we literally just need the mechanics."
 *
 * So a feature mounted on the real match (EngineFeature → CanvasMatch's
 * `scene` prop) can take things OFF the pitch. It can never add a physics rule
 * of its own: the ball, the kick, the contact and the flight are always the
 * real match's. The real career match never passes a scene.
 */
import type { Scenario } from "./canvasEngine";
import { OFF_PITCH } from "./scenarioEdit";

/** See CanvasMatch's `scene` prop. Each part defaults to on. */
export interface ScenePicture {
  /** false: the keeper is benched off the pitch — never moves, saves or draws. */
  keeper?: boolean;
  /** false: the goal frame and net are not drawn (a gate drill has no goal). */
  goal?: boolean;
  /** false: the poacher, support runners and decorative team-mates are taken off. */
  teammates?: boolean;
  /** false: no "GOAL" / "PASS" / "OFFSIDE" text or goal flash; the feature says what happened. */
  banners?: boolean;
}

/**
 * Takes off the pitch what a feature's `scene` leaves out. Nothing is deleted
 * from the engine: `canvasEngine.ts` is never edited, and a keeper and a
 * poacher are single, required fields there. So a benched keeper is walked to
 * the same far-off spot the gallery walks a removed poacher to (behind the
 * ball, so he is never offside) and marked done, which is the engine's own
 * "this keeper takes no further part" — every save and smother check reads it.
 */
export function stageScene(sc: Scenario, s: ScenePicture | undefined): void {
  if (!s) return;
  if (s.keeper === false) {
    const k = sc.keeper;
    k.x = k.startX = k.targetX = OFF_PITCH.x;
    k.y = OFF_PITCH.y;
    k.done = true;
  }
  if (s.teammates === false) {
    sc.follower.x = OFF_PITCH.x;
    sc.follower.y = OFF_PITCH.y;
    sc.teammates = [];
    sc.secondaryRunners = [];
    sc.runner = null;
    sc.passTarget = null;
    sc.receiver = null;
  }
}

