/**
 * DEN'S HUNDRED — the picture for each ball, built from the match engine's own
 * scenario builder (buildScenario, initDefenders), exactly as training's power
 * drill builds its strike (TrainingMinigame buildStrikeFrom). No physics here:
 * the screen hands this to EngineFeature (the real CanvasMatch), and the
 * measuring script (scripts/life/hundred-measure.mts) hands it to the engine's
 * own step functions.
 *
 * What is drill-only dressing: where the ball sits, Den's keeper numbers
 * (strength and reach, both the engine's own fields), the tyre and the bucket
 * (decoration markers the engine never reads) and the close camera.
 */
import { buildScenario, initDefenders, type Scenario } from "../canvasEngine";
import { CX, GOAL_H, PITCH_W, POST_L, POST_R } from "../pitch";
import { FRAME_TOP_FOR_GOAL } from "../goalFrame";
import type { Feed } from "./drill";

export interface DrillMarker { x: number; y: number; color?: string; z?: number; shape?: "cone" | "ring" | "bucket"; r?: number; rope?: number }

/** The close camera: the goal, the ball and a man behind it, so the small targets read on a phone. */
export function closeFrame(ballX: number, ballY: number) {
  const x1 = Math.min(ballX - 4, POST_L - 1.4), x2 = Math.max(ballX + 4, POST_R + 1.4);
  const w = Math.max(10.5, x2 - x1);
  const h = Math.max(w * 1.25, ballY + 4);
  const ww = Math.max(w, h * 0.62);
  const cx = Math.max(ww / 2, Math.min(PITCH_W - ww / 2, (x1 + x2) / 2));
  return { x1: cx - ww / 2, x2: cx + ww / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
}

/** One ball's scenario: the match's long-range chance with the ball moved to Den's spot,
 *  nobody in the way, and Den (or nobody) in goal. */
export function hundredScenario(f: Feed, rng: () => number): Scenario {
  const ks = f.keeper ? f.keeper.strength : 0;
  const sc = buildScenario("long_range", rng, ks, 60, 55);
  sc.ball = { x: CX + f.x, y: f.dist };
  sc.player = { x: sc.ball.x - 0.4, y: f.dist + 0.8 };
  sc.keeperStrength = ks;
  initDefenders(sc, rng);
  sc.defenders = [];
  // Den is short and slow: the engine's own reach multiplier (Scenario.keeperReach).
  if (f.keeper) sc.keeperReach = f.keeper.reach;
  sc.viewport = closeFrame(sc.ball.x, sc.ball.y);
  return sc;
}

/** What is drawn for this ball's target (decoration only). */
export function hundredMarkers(f: Feed): DrillMarker[] | undefined {
  const t = f.target;
  if (t.kind === "tyre") return [{ x: t.x, y: 0.05, z: t.z, shape: "ring", r: t.r, rope: Math.max(0, GOAL_H - t.z - t.r) }];
  if (t.kind === "bucket") return [{ x: t.x, y: 0.1, shape: "bucket", r: 0.45 }];
  if (t.kind === "corner") {
    // Two cones on the line marking the corner he called.
    const a = t.side === "L" ? POST_L + 0.15 : POST_R - 0.15;
    const b = t.side === "L" ? POST_L + 1.4 : POST_R - 1.4;
    return [{ x: a, y: 0.6, color: "#86efac" }, { x: b, y: 0.6, color: "#86efac" }];
  }
  return undefined;
}
