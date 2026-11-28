/**
 * DEN'S HUNDRED — the picture for each ball, built from the match engine's own
 * scenario builder (buildScenario, initDefenders), exactly as training's power
 * drill builds its strike (TrainingMinigame buildStrikeFrom). No physics here:
 * the screen hands this to EngineFeature (the real CanvasMatch), and the
 * measuring script (scripts/life/hundred-measure.mts) hands it to the engine's
 * own step functions.
 *
 * Each ball is one of the match's own balls (v4):
 *  - on the volley / a header: the match's own volley and header chances (the
 *    strike screen's bouncing and floating ball, its timing ring, its rules);
 *  - the cut-back: a ball at your feet that the strike screen rolls (its own
 *    "bobble"), picked by the chance's seed (seedFor);
 *  - the dummy: one of the match's own defenders, standing still (a "hold"
 *    man, the free-kick wall's role): the engine's own block rule, so a low
 *    drive really hits him and a chip really clears him.
 *
 * What is drill-only dressing: where the ball sits, Den's keeper numbers
 * (strength and reach, both the engine's own fields), the tyre, the bucket, the
 * skip and Den himself (decoration markers the engine never reads; Den is drawn
 * by the match's own figure painter at the match's own size, so he and you are
 * one scale) and the close camera.
 */
import { buildScenario, initDefenders, type Scenario, type ScenarioKind } from "../canvasEngine";
import { CX, GOAL_H, PITCH_W, POST_L, POST_R } from "../pitch";
import { FRAME_TOP_FOR_GOAL } from "../goalFrame";
import { SKIP_H, type Feed } from "./drill";

export interface DrillMarker {
  x: number; y: number; color?: string; z?: number;
  shape?: "cone" | "ring" | "bucket" | "skip" | "man";
  r?: number; rope?: number;
  /** A skip's half-length (y) when r is its half-width (x); a man's shorts colour. */
  l?: number; trim?: string;
  /** A man's name over his head. */
  label?: string;
}

/** The close camera: the goal, the ball and a man behind it, so the small targets read on a phone.
 *  `also` are other spots that must be in the picture (Den, the skip). */
export function closeFrame(ballX: number, ballY: number, also: { x: number; y: number }[] = []) {
  // Tight: the goal with half a metre either side, you and the ball, little else. The frame is
  // made as tall and narrow as the phone's canvas so the match does not pad it with empty grass.
  let x1 = Math.min(ballX - 2.2, POST_L - 0.5), x2 = Math.max(ballX + 2.2, POST_R + 0.5);
  // 2 m either side of Den: the phone crops the canvas's edges a little, and he must be whole.
  for (const p of also) { x1 = Math.min(x1, p.x - 2); x2 = Math.max(x2, p.x + 2); }
  const w = x2 - x1;
  const h = Math.max(w * 1.6, ballY - FRAME_TOP_FOR_GOAL + 2.6);
  const ww = Math.max(w, h / 1.85);
  const cx = Math.max(ww / 2, Math.min(PITCH_W - ww / 2, (x1 + x2) / 2));
  return { x1: cx - ww / 2, x2: cx + ww / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
}

/** Where Den stands for this ball (null: he is in goal, the match's own keeper). */
export function feederSpot(f: Feed): { x: number; y: number } | null {
  if (f.keeper) return null;
  const bx = CX + f.x;
  if (f.feeder) return { x: bx + f.feeder.dx, y: Math.max(0.8, f.dist + f.feeder.dy) };
  // Otherwise by his bag: a stride to your left and a little in front, watching.
  return { x: bx - 3.0, y: f.dist - 1.2 };
}

/** The match's own kind of chance for this ball. */
function engineKind(f: Feed): ScenarioKind {
  return f.engine === "volley" ? "volley" : f.engine === "header" ? "header" : "long_range";
}

/** The match's strike screen rolls a ball at your feet for about a third of seeds (CanvasMatch
 *  contactMotion: "bobble"). The cut-back takes the first seed from `base` that rolls; every
 *  other ball keeps `base`. Pure: the same night, the same seeds. */
export function seedFor(f: Feed, base: number): number {
  if (!f.rolling) return base;
  for (let s = base; s < base + 200; s++) if (((Math.imul(s, 2654435761) >>> 0) % 100) < 35) return s;
  return base;
}

/** One ball's scenario: the match's own chance of that kind with the ball moved to Den's spot,
 *  nobody in the way but the dummy, and Den (or nobody) in goal. */
export function hundredScenario(f: Feed, rng: () => number): Scenario {
  const ks = f.keeper ? f.keeper.strength : 0;
  const sc = buildScenario(engineKind(f), rng, ks, 60, 55);
  sc.ball = { x: CX + f.x, y: f.dist };
  sc.player = { x: sc.ball.x - 0.4, y: f.dist + 0.8 };
  sc.keeperStrength = ks;
  sc.defenders = f.dummy ? [{ x: sc.ball.x + 0.15, y: Math.max(2, f.dist - f.dummy) }] : [];
  initDefenders(sc, rng);
  // The dummy never moves: the engine's own "hold" man (a free-kick wall's role) stays put while
  // the ball is live and only blocks what reaches him under head height.
  for (const d of sc.defenders) { d.role = "hold"; d.baseRole = "hold"; d.speed = 0; d.fixed = true; }
  // Den is short and slow: the engine's own reach multiplier (Scenario.keeperReach).
  if (f.keeper) sc.keeperReach = f.keeper.reach;
  const den = feederSpot(f);
  const also = den ? [den] : [];
  if (f.target.kind === "skip") also.push({ x: f.target.x + f.target.w, y: f.target.y }, { x: f.target.x - f.target.w, y: f.target.y });
  sc.viewport = closeFrame(sc.ball.x, sc.ball.y, also);
  return sc;
}

/** Den's kit-man colours: a navy club tracksuit, its gold trim. */
export const DEN_KIT = { shirt: "#1e293b", trim: "#f5b942" };

/** What is drawn for this ball: its target, and Den where he stands (decoration only). */
export function hundredMarkers(f: Feed, denName?: string): DrillMarker[] | undefined {
  const t = f.target;
  const out: DrillMarker[] = [];
  if (t.kind === "tyre") out.push({ x: t.x, y: 0.05, z: t.z, shape: "ring", r: t.r, rope: Math.max(0, GOAL_H - t.z - t.r) });
  if (t.kind === "bucket") out.push({ x: t.x, y: 0.1, shape: "bucket", r: 0.75, color: "#f43f5e" });
  if (t.kind === "skip") out.push({ x: t.x, y: t.y, shape: "skip", r: t.w, l: t.l, z: SKIP_H, color: "#eab308" });
  if (t.kind === "corner") {
    // Two cones on the line marking the corner he called.
    const a = t.side === "L" ? POST_L + 0.15 : POST_R - 0.15;
    const b = t.side === "L" ? POST_L + 1.4 : POST_R - 1.4;
    out.push({ x: a, y: 0.6, color: "#86efac" }, { x: b, y: 0.6, color: "#86efac" });
  }
  if (t.kind === "either") {
    // A cone 1.4 m inside each post: in between is "too central".
    out.push({ x: POST_L + 1.4, y: 0.6, color: "#86efac" }, { x: POST_R - 1.4, y: 0.6, color: "#86efac" });
  }
  const den = feederSpot(f);
  if (den) out.push({ x: den.x, y: den.y, shape: "man", color: DEN_KIT.shirt, trim: DEN_KIT.trim, label: denName });
  return out.length ? out : undefined;
}
