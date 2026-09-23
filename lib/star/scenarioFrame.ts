/**
 * SCENARIO FRAMES — the one way a built `Scenario` becomes a picture.
 *
 * Lifted out of `app/star-gallery-dev/page.tsx` UNCHANGED so a second screen
 * (Infinite Highlights, `app/star-highlights-dev/page.tsx`) draws chances and
 * rings their faults with exactly the same code the gallery does. There is one
 * renderer in this project; a second, approximate one would quietly disagree
 * with the game and the disagreement would be invisible.
 *
 * Nothing here changes game behaviour — it only READS `buildScenario`'s output
 * and the shared `fiveASide/render.ts` primitives.
 */

import {
  goalInView,
  type Scenario,
  type Vec2,
  type Identity,
} from "./canvasEngine";
import { CX } from "./pitch";
import { ELEVEN_A_SIDE_ATTACK, type MatchRules } from "./fiveASide/rules";
import {
  projectionFor,
  drawPitch,
  drawGoal,
  drawFigure,
  drawKeeper,
  drawBall,
  MATCH_SCALE,
  type Projection,
  type FigureLook,
} from "./fiveASide/render";
import { offsideLineOf } from "./baseScenario";
import { DEFAULT_FACE_STYLE } from "./faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "./fakeFaceStyle";
import type { ScenarioSide } from "./scenarios";

// ── Kit looks. Not real club kits — just enough colour to tell the three
//    groups apart on a diagram: your side blue, theirs red, a keeper green. ──
export const YOU: Omit<FigureLook, "label" | "star"> = { shirt: "#1d4ed8", shorts: "#1e3a8a", trim: "#ffffff" };
export const OPP: Omit<FigureLook, "label" | "star"> = { shirt: "#dc2626", shorts: "#7f1d1d", trim: "#ffffff" };
export const KEEP: Omit<FigureLook, "label" | "star"> = { shirt: "#16a34a", shorts: "#14532d", trim: "#ffffff" };
export const MATE: Omit<FigureLook, "label" | "star"> = { shirt: "#3b82f6", shorts: "#1e3a8a", trim: "#ffffff" };

export const FACE = DEFAULT_FACE_STYLE;
export const FAKE = DEFAULT_FAKE_FACE_STYLE;

// ─────────────────────────────────────────────────────────────────────────
//  FRAMES — unchanged from the original gallery. A Frame is the flat list of
//  things to paint; `paint` puts it on a canvas.
// ─────────────────────────────────────────────────────────────────────────

/** One thing to draw. A figure, a keeper, or (via `keeper`) a keeper pose. */
export interface Item {
  /**
   * Stable identity, NOT the array position.
   *
   * A figure the builder made is `"0"`, `"1"`, … in `frameFromScenario`'s own
   * push order — the exact numbers every already-saved edit and every already
   * saved `MatchScenario` is keyed by, so nothing on disk had to change. A
   * figure ADDED in the editor is `"add1"`, `"add2"`, … Position overrides,
   * removals and the save format all key off this, which is what lets a figure
   * be added or removed without shifting everyone else's edits by one.
   */
  id: string;
  at: Vec2;
  look: FigureLook;
  keeper?: boolean;
  /**
   * Can the editor take him out? The keeper, the poacher and YOU cannot —
   * every one of them is a required part of the Scenario the fault rules are
   * judged against, so hiding one would leave the picture saying something
   * different from the rings on it. Everyone else can.
   */
  removable?: boolean;
  /** Which side he is on — carried so a frame can be written out as a real
   *  `MatchScenario` (lib/star/scenarios.ts), whose players are sided. */
  side: ScenarioSide;
}

export interface Frame {
  rules: MatchRules;
  camera: MatchRules["view"];
  /** null = no goal drawn (a midfield situation with none in view). */
  goalAtY: number | null;
  offsideY: number | null;
  /** Which item indices form the opponent back line + keeper, so the offside
   *  line can be RE-derived live as those figures are dragged. */
  offsideFrom: { defenderIdx: number[]; keeperIdx: number } | null;
  items: Item[];
  ball: Vec2;
}

export const idLabel = (who: Identity | undefined, fallback: string): string =>
  who?.shortName ?? who?.name ?? fallback;

/** Turn a built Scenario into a flat list of things to paint.
 *  ORDER MATTERS: defenders, keeper, runner, secondary runners, follower,
 *  teammates, you — `applyOverrideToScenario` and `markIndices` both walk it. */
export function frameFromScenario(sc: Scenario): Frame {
  const items: Omit<Item, "id">[] = [];

  sc.defenders.forEach((d, i) => {
    items.push({ at: { x: d.x, y: d.y }, look: { ...OPP, label: idLabel(d.who, `D${i + 1}`) }, side: "opponent", removable: true });
  });
  items.push({
    at: { x: sc.keeper.x, y: sc.keeper.y },
    look: { ...KEEP, label: idLabel(sc.keeper.who, "GK") },
    keeper: true,
    side: "opponent",
  });

  if (sc.runner) {
    items.push({ at: { ...sc.runner.pos }, look: { ...MATE, label: idLabel(sc.runner.who, "TARGET") }, side: "teammate", removable: true });
  }
  sc.secondaryRunners.forEach((r, i) => {
    items.push({
      at: { ...r.pos },
      look: { ...MATE, label: idLabel(r.who, r.role === "support" ? "SUP" : `R${i + 1}`) },
      side: "teammate",
      removable: true,
    });
  });
  if (goalInView(sc.kind)) {
    // Removable, like every other team-mate. He used to be the ONE team-mate
    // the editor would not take out — and in a one-on-one he is often one of
    // only two on screen, which is why it read as "I can't remove teammates".
    items.push({ at: { x: sc.follower.x, y: sc.follower.y }, look: { ...MATE, label: idLabel(sc.follower.who, "POACH") }, side: "teammate", removable: true });
  }
  sc.teammates.forEach((t, i) => {
    items.push({ at: { x: t.x, y: t.y }, look: { ...MATE, label: idLabel(t.who, `T${i + 1}`) }, side: "teammate", removable: true });
  });

  items.push({ at: { ...sc.player }, look: { ...YOU, label: "YOU", star: true }, side: "you" });

  const withIds: Item[] = items.map((it, i) => ({ ...it, id: String(i) }));
  const nDef = sc.defenders.length;
  const offside = offsideLineOf(sc);

  return {
    rules: ELEVEN_A_SIDE_ATTACK,
    camera: sc.viewport,
    goalAtY: goalInView(sc.kind) ? 0 : null,
    offsideY: offside,
    offsideFrom:
      offside !== null
        ? { defenderIdx: sc.defenders.map((_, i) => i), keeperIdx: nDef }
        : null,
    items: withIds,
    ball: { ...sc.ball },
  };
}

/** The offside line RE-DERIVED from a frame's CURRENT item positions, so a
 *  dragged defender moves the line with it — and so does one added or removed
 *  in the editor. Read off every opponent figure on the frame (which is the
 *  back line plus the keeper), rather than off the index list the builder
 *  captured, because those indices stop meaning anything the moment the
 *  editor adds or removes a body. */
export function computeOffside(frame: Frame): number | null {
  if (!frame.offsideFrom) return null;
  const ys = frame.items.filter((it) => it.side === "opponent").map((it) => it.at.y);
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  return ys[1];
}

/** The CSS pixel size a frame paints at — shared with the pointer-to-metre
 *  inverse so the two can never disagree. */
/**
 * How big to draw a frame, in CSS pixels, keeping the camera's own aspect.
 *
 * The defaults are phone-sized, which is right for a thumbnail in a grid and
 * wrong for the one picture you are actually working on. Reported directly
 * on a desktop screenshot: "there's way more space on PC for the scenario
 * gallery to have the scenario more centralised when I'm actually in there".
 * So the single-scenario view passes a bigger box; nothing else changes.
 */
export interface FrameSizing {
  /** Width to aim for before the caps apply. */
  baseW?: number;
  maxW?: number;
  maxH?: number;
}

export function frameCssSize(frame: Frame, size: FrameSizing = {}): { cssW: number; cssH: number } {
  const { baseW = 340, maxW = 460, maxH = 560 } = size;
  const vpW = frame.camera.x2 - frame.camera.x1;
  const vpH = frame.camera.y2 - frame.camera.y1;
  let cssW = baseW;
  let cssH = Math.round((baseW * vpH) / vpW);
  if (cssH > maxH) { cssH = maxH; cssW = Math.round((maxH * vpW) / vpH); }
  if (cssW > maxW) { cssW = maxW; cssH = Math.round((maxW * vpH) / vpW); }
  return { cssW, cssH };
}

/** Paint a frame onto a canvas, sized to the camera's own aspect. */
export function paint(canvas: HTMLCanvasElement, frame: Frame, size: FrameSizing = {}): void {
  // The painter OWNS the canvas size, so a caller that sizes its own element
  // and then calls paint() gets silently overruled back to the phone default.
  // That is exactly what happened to the desktop scenario view.
  const { cssW, cssH } = frameCssSize(frame, size);

  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const p: Projection = projectionFor(frame.rules, cssW, cssH, frame.camera);
  drawPitch(ctx, frame.rules, p);
  if (frame.goalAtY !== null) drawGoal(ctx, frame.rules, p, frame.goalAtY);

  const offY = computeOffside(frame);
  if (offY !== null) drawOffsideLine(ctx, p, cssW, offY);

  // Drawn at the REAL match's own size. The picture used to use the trial's
  // smaller figures, so pressing Play made every player grow by about half
  // and the whole scene looked like it had moved when nothing had. Asked for
  // directly: "the play and the pre-play should be exactly the same".
  for (const it of frame.items) {
    if (it.keeper) drawKeeper(ctx, p, it.at, it.look, { dive: 0, lunge: 0 }, FACE, FAKE, { scale: PICTURE_SCALE });
    else drawFigure(ctx, p, it.at, it.look, FACE, FAKE, { scale: PICTURE_SCALE });
  }
  drawBall(ctx, p, frame.ball, 0, PICTURE_SCALE);
}

export function drawOffsideLine(ctx: CanvasRenderingContext2D, p: Projection, w: number, y: number): void {
  const yy = p.py(y);
  ctx.save();
  ctx.strokeStyle = "rgba(250, 204, 21, 0.9)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(0, yy);
  ctx.lineTo(w, yy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────
//  FAULT RINGS — the picture says what is wrong, not a paragraph
// ─────────────────────────────────────────────────────────────────────────

// render.ts's own anatomy, replicated for hit-testing and ring placement only
// (do NOT edit render.ts). A figure's feet sit at py(at.y); its body rises.
/** How much bigger than the trial's figures the picture draws — the real
 *  match's own size (see `paint`). Hit-testing and rings use it too, so a
 *  grab or a ring still lands on the figure you see. */
export const PICTURE_SCALE = MATCH_SCALE;
export const HIT_FIGURE_R = 1.05 * PICTURE_SCALE; // render.ts FIGURE_R, at the picture's scale
export const HIT_BODY_UP = 0.67; // ~mid-torso, in units of r, above the feet anchor

export interface Mark { at: Vec2; ball?: boolean; tone: "red" | "amber" | "select" }

export const MARK_INK: Record<Mark["tone"], string> = {
  red: "rgba(239,68,68,0.95)",
  amber: "rgba(245,158,11,0.95)",
  select: "rgba(56,189,248,0.98)",
};

/** Paint a frame, then ring whatever is wrong with it. */
export function paintMarked(
  canvas: HTMLCanvasElement, frame: Frame, marks: Mark[], size: FrameSizing = {},
): void {
  paint(canvas, frame, size);
  if (!marks.length) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { cssW, cssH } = frameCssSize(frame, size);
  const p = projectionFor(frame.rules, cssW, cssH, frame.camera);
  const r = Math.max(7, p.unit * HIT_FIGURE_R);
  ctx.save();
  for (const m of marks) {
    const x = p.px(m.at.x);
    const y = m.ball ? p.py(m.at.y) : p.py(m.at.y) - r * HIT_BODY_UP;
    const rad = m.ball ? Math.max(11, r * 0.75) : r * 1.35;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = MARK_INK[m.tone];
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, rad + 2.5, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.stroke();
  }
  ctx.restore();
}

/** Everyone on your side trying to score — the same list `baseScenario.ts`
 *  judges offside against, in the same order. */
export function attackersOf(sc: Scenario): Vec2[] {
  const out: Vec2[] = [];
  if (sc.runner) out.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) out.push(r.pos);
  if (goalInView(sc.kind)) out.push({ x: sc.follower.x, y: sc.follower.y });
  return out;
}

/**
 * Which FIGURE (or the ball) each fault is actually about.
 *
 * Every string here is one `scenarioFaults` can genuinely return — matched
 * against, never re-derived, so the ring and the English can't disagree. A
 * fault about where the BALL is rings the ball; a fault about a person rings
 * that person; anything with no single culprit falls back to the ball, which
 * is where the situation is judged from.
 */
export function marksForFaults(sc: Scenario, faults: string[], tone: "red" | "amber"): Mark[] {
  const out: Mark[] = [];
  const ballMark = (): Mark => ({ at: { ...sc.ball }, ball: true, tone });

  for (const f of faults) {
    if (f === "attacker offside") {
      const line = offsideLineOf(sc);
      if (line !== null) {
        for (const a of attackersOf(sc)) if (a.y < line - 0.01) out.push({ at: { x: a.x, y: a.y }, tone });
      }
      continue;
    }
    if (f === "defender behind his own keeper") {
      for (const d of sc.defenders) if (d.y < sc.keeper.y) out.push({ at: { x: d.x, y: d.y }, tone });
      continue;
    }
    if (f === "11m+ hole in the line") {
      const deepest = Math.min(...sc.defenders.map((d) => d.y));
      const line = sc.defenders.filter((d) => d.y - deepest <= 4).sort((a, b) => a.x - b.x);
      for (let i = 1; i < line.length; i++) {
        if (line[i].x - line[i - 1].x > 11) {
          out.push({ at: { x: line[i - 1].x, y: line[i - 1].y }, tone });
          out.push({ at: { x: line[i].x, y: line[i].y }, tone });
          break;
        }
      }
      continue;
    }
    if (f.startsWith("not a one-on-one")) {
      for (const d of sc.defenders) {
        if (d.y < sc.ball.y - 0.5 && Math.abs(d.x - CX) <= 14) out.push({ at: { x: d.x, y: d.y }, tone });
      }
      continue;
    }
    // ── The four `planFaults` (chanceFormula.ts) adds on top of
    //    `scenarioFaults`. Each one names a specific body, so each one rings
    //    that body rather than falling through to the ball. The two radii are
    //    `planFaults`'s own, matched not re-derived. ──
    if (f === "defender piled on the ball") {
      for (const d of sc.defenders) {
        if (Math.hypot(d.x - sc.ball.x, d.y - sc.ball.y) < 1.4) out.push({ at: { x: d.x, y: d.y }, tone });
      }
      continue;
    }
    if (f === "defender standing on you") {
      for (const d of sc.defenders) {
        if (Math.hypot(d.x - sc.player.x, d.y - sc.player.y) < 1.2) out.push({ at: { x: d.x, y: d.y }, tone });
      }
      continue;
    }
    if (f === "you are off screen") {
      out.push({ at: { ...sc.player }, tone });
      continue;
    }
    if (f === "the pass target is off screen" && sc.runner) {
      out.push({ at: { ...sc.runner.pos }, tone });
      continue;
    }
    // Everything left is about where the ball is (too central, too far out,
    // not near the byline, off screen) or about an area in front of it (an
    // empty channel) — and a keeper off screen has nothing to ring at all.
    out.push(ballMark());
  }
  return out;
}

/**
 * One fault `scenarioFaults` reports is not a fault at all.
 *
 * A through ball's whole chance IS a runner going a yard early — real
 * receivers are beyond the line about half the time, and `fixBaseScenario`
 * deliberately exempts through_ball from its own onside repair for exactly
 * that reason. It rings AMBER and says nothing.
 */
export function splitFaults(kind: string, faults: string[]): { faults: string[]; intended: string[] } {
  const out: string[] = [];
  const intended: string[] = [];
  for (const f of faults) {
    if (kind === "through_ball" && f === "attacker offside") intended.push(f);
    else out.push(f);
  }
  return { faults: out, intended };
}
