"use client";

/**
 * SCENARIO GALLERY — deterministic dev scaffolding for the Road to Ballon d'Or
 * match layer. NOT a game feature and NOT reachable from nav.
 *
 * ── Why this exists ──
 *
 * The formation and five-a-side shape builders are the hardest thing in this
 * game to eyeball, and the only honest way to judge a change to them (does the
 * back four still hold its line, did the diamond actually appear) is a
 * seed-matched before/after screenshot. Playing a match to reach one specific
 * scenario is expensive and non-deterministic; this page renders every
 * scenario kind, at a HARD-CODED seed per cell, straight from the REAL
 * builders, so a `star-playtest` screenshot of it before and after a builder
 * change is a true like-for-like comparison.
 *
 * ── The two games are completely split ──
 *
 * The top tabs switch between the real (11-a-side) game and five-a-side — you
 * only ever look at one game's scenarios at a time, so there is no chance of
 * mistaking one for the other. Each game keeps its own controls.
 *
 * ── Formation toggle ──
 *
 * The real-game view has a formation dropdown. It does two things: it re-casts
 * every scenario against the chosen opponent formation (via the real
 * `castDefence`), and it draws that formation's own slot layout as a reference
 * diagram — the shape the opponent is MEANT to hold. Today `castDefence` only
 * assigns WHO each defender is, not WHERE (defender positions are owned by the
 * scenario builder), so the scenario shapes do not yet change with the
 * formation — the reference diagram is what they should grow toward once the
 * 11-a-side positional layer lands. That gap is the finding this page exists to
 * make visible.
 *
 * ── What it deliberately does not do ──
 *
 * It changes no game behaviour. It only READS `buildScenario`,
 * `defensiveShape`, `attackingShape`, `buildPassage`, `castDefence`,
 * `formationOf` and the shared `render.ts` draw primitives — the same functions
 * a real match calls — and paints their output onto small labelled canvases.
 */

import { useEffect, useRef, useState } from "react";
import {
  SCENARIO_KINDS,
  buildScenario,
  goalInView,
  type Scenario,
  type Vec2,
  type Identity,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import {
  ELEVEN_A_SIDE_ATTACK,
  FIVE_A_SIDE,
  type MatchRules,
} from "@/lib/star/fiveASide/rules";
import {
  projectionFor,
  drawPitch,
  drawGoal,
  drawFigure,
  drawKeeper,
  drawBall,
  type Projection,
  type FigureLook,
} from "@/lib/star/fiveASide/render";
import { defensiveShape, DEFEND_ROLES } from "@/lib/star/fiveASide/shape";
import { attackingShape, ATTACK_ROLES } from "@/lib/star/fiveASide/attack";
import { buildPassage, type FiveWorld } from "@/lib/star/fiveASide/passage";
import {
  FIVE_KEEPER_STRENGTH,
  FIVE_HALFWAY_Y,
} from "@/lib/star/fiveASide/geometry";
import { castDefence, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { FORMATIONS, formationOf, type Formation } from "@/lib/star/formations";
import { applyFormationShape, defensiveLineOf } from "@/lib/star/formationShape";
import { PLAYSTYLES, type Playstyle } from "@/lib/star/playstyle";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import ScenarioEditor from "@/components/star/ScenarioEditor";
import type { MatchScenario, ScenarioSide, ScenarioMomentKind } from "@/lib/star/scenarios";
import {
  listScenarios,
  fetchSharedScenarios,
  saveScenarioShared,
  deleteScenarioShared,
} from "@/lib/star/scenarioStore";

// ── Kit looks. Not real club kits — just enough colour to tell the three
//    groups apart on a diagram: your side blue, theirs red, a keeper green. ──
const YOU: Omit<FigureLook, "label" | "star"> = { shirt: "#1d4ed8", shorts: "#1e3a8a", trim: "#ffffff" };
const OPP: Omit<FigureLook, "label" | "star"> = { shirt: "#dc2626", shorts: "#7f1d1d", trim: "#ffffff" };
const KEEP: Omit<FigureLook, "label" | "star"> = { shirt: "#16a34a", shorts: "#14532d", trim: "#ffffff" };
const MATE: Omit<FigureLook, "label" | "star"> = { shirt: "#3b82f6", shorts: "#1e3a8a", trim: "#ffffff" };

const FACE = DEFAULT_FACE_STYLE;
const FAKE = DEFAULT_FAKE_FACE_STYLE;

/** One thing to draw. A figure, a keeper, or (via `keeper`) a keeper pose. */
interface Item {
  at: Vec2;
  look: FigureLook;
  keeper?: boolean;
  /** Which side he is on. Carried so a frame can be written out as a real
   *  `MatchScenario` (lib/star/scenarios.ts) — its players are sided, and the
   *  kit colour alone is not something to reverse-engineer a side from. */
  side: ScenarioSide;
}

interface Frame {
  rules: MatchRules;
  camera: MatchRules["view"];
  /** null = no goal drawn (a midfield situation with none in view). */
  goalAtY: number | null;
  /** null = no offside line. */
  offsideY: number | null;
  /** Which item indices form the opponent back line + keeper, so the offside
   *  line can be RE-derived live as those figures are dragged in the editor.
   *  null when the situation has no offside line at all. */
  offsideFrom: { defenderIdx: number[]; keeperIdx: number } | null;
  items: Item[];
  ball: Vec2;
}

/** The offside line the engine would judge against: the second-last opponent.
 *  Replicated from `opponentLine` (canvasEngine.ts, not exported) — keeper
 *  counts only when the goal is in view, exactly as there. */
function offsideLineFor(sc: Scenario): number | null {
  if (!goalInView(sc.kind) || sc.kind === "corner") return null;
  const ys = sc.defenders.map((d) => d.y);
  ys.push(sc.keeper.y);
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  return ys[1];
}

const idLabel = (who: Identity | undefined, fallback: string): string =>
  who?.shortName ?? who?.name ?? fallback;

/** Turn a built Scenario into a flat list of things to paint. */
function frameFromScenario(sc: Scenario): Frame {
  const items: Item[] = [];

  // Their back line + keeper.
  sc.defenders.forEach((d, i) => {
    items.push({ at: { x: d.x, y: d.y }, look: { ...OPP, label: idLabel(d.who, `D${i + 1}`) }, side: "opponent" });
  });
  items.push({
    at: { x: sc.keeper.x, y: sc.keeper.y },
    look: { ...KEEP, label: idLabel(sc.keeper.who, "GK") },
    keeper: true,
    side: "opponent",
  });

  // Your options: the target runner, support runners, the poacher.
  if (sc.runner) {
    items.push({ at: { ...sc.runner.pos }, look: { ...MATE, label: idLabel(sc.runner.who, "TARGET") }, side: "teammate" });
  }
  sc.secondaryRunners.forEach((r, i) => {
    items.push({
      at: { ...r.pos },
      look: { ...MATE, label: idLabel(r.who, r.role === "support" ? "SUP" : `R${i + 1}`) },
      side: "teammate",
    });
  });
  if (goalInView(sc.kind)) {
    items.push({ at: { x: sc.follower.x, y: sc.follower.y }, look: { ...MATE, label: idLabel(sc.follower.who, "POACH") }, side: "teammate" });
  }
  // Decorative team-mates (crossers etc.).
  sc.teammates.forEach((t, i) => {
    items.push({ at: { x: t.x, y: t.y }, look: { ...MATE, label: idLabel(t.who, `T${i + 1}`) }, side: "teammate" });
  });

  // You, with a star so you are always findable.
  items.push({ at: { ...sc.player }, look: { ...YOU, label: "YOU", star: true }, side: "you" });

  // The defenders were pushed first (indices 0..nDef-1), the keeper straight
  // after them — so the offside line can be re-derived from those items alone.
  const nDef = sc.defenders.length;
  const offside = offsideLineFor(sc);

  return {
    rules: ELEVEN_A_SIDE_ATTACK,
    camera: sc.viewport,
    goalAtY: goalInView(sc.kind) ? 0 : null,
    offsideY: offside,
    offsideFrom:
      offside !== null
        ? { defenderIdx: sc.defenders.map((_, i) => i), keeperIdx: nDef }
        : null,
    items,
    ball: { ...sc.ball },
  };
}

/** The offside line RE-DERIVED from a frame's CURRENT item positions — so a
 *  dragged defender moves the line with it. Same rule as `offsideLineFor`
 *  (second-last of the back line + keeper), just read off the live items. */
function computeOffside(frame: Frame): number | null {
  const meta = frame.offsideFrom;
  if (!meta) return null;
  const ys = meta.defenderIdx
    .map((i) => frame.items[i]?.at.y)
    .filter((y): y is number => typeof y === "number");
  const kY = frame.items[meta.keeperIdx]?.at.y;
  if (typeof kY === "number") ys.push(kY);
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  return ys[1];
}

/** The CSS pixel size a frame paints at — the same computation `paint` uses,
 *  factored out so the pointer-to-metre inverse can share the exact numbers.
 *  The camera never changes while editing, so this is stable per cell. */
function frameCssSize(frame: Frame): { cssW: number; cssH: number } {
  const vpW = frame.camera.x2 - frame.camera.x1;
  const vpH = frame.camera.y2 - frame.camera.y1;
  const CSS_W = 340;
  let cssW = CSS_W;
  let cssH = Math.round((CSS_W * vpH) / vpW);
  const MAX_H = 560;
  if (cssH > MAX_H) { cssH = MAX_H; cssW = Math.round((MAX_H * vpW) / vpH); }
  const MAX_W = 460;
  if (cssW > MAX_W) { cssW = MAX_W; cssH = Math.round((MAX_W * vpH) / vpW); }
  return { cssW, cssH };
}

/** Paint a frame onto a canvas, sized to the camera's own aspect so nothing
 *  is stretched (px/py must share a scale). */
function paint(canvas: HTMLCanvasElement, frame: Frame): void {
  // Keep a cell from becoming a skyscraper (a long-range viewport is very
  // tall); `frameCssSize` holds the true aspect while capping both axes.
  const { cssW, cssH } = frameCssSize(frame);

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

  // Re-derived from the CURRENT positions, so a dragged defender drags the
  // line with it rather than leaving a stale one behind.
  const offY = computeOffside(frame);
  if (offY !== null) drawOffsideLine(ctx, p, cssW, offY);

  for (const it of frame.items) {
    if (it.keeper) drawKeeper(ctx, p, it.at, it.look, { dive: 0, lunge: 0 }, FACE, FAKE);
    else drawFigure(ctx, p, it.at, it.look, FACE, FAKE);
  }
  drawBall(ctx, p, frame.ball);
}

function drawOffsideLine(ctx: CanvasRenderingContext2D, p: Projection, w: number, y: number): void {
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
  ctx.fillStyle = "rgba(250, 204, 21, 0.95)";
  ctx.font = "700 10px system-ui, sans-serif";
  ctx.fillText("offside line", 4, yy - 3);
  ctx.restore();
}

// ── The formation reference diagram ────────────────────────────────────────
// A self-contained painter (does not go through projectionFor) that draws a
// formation's own slot layout on a portrait pitch, oriented so the opponent's
// goal (the one you attack) is at the TOP — matching the scenario frames'
// attack-toward-the-top convention. This is the shape the opponent is MEANT to
// hold; it is not what the scenario builder currently produces.
function paintFormationRef(canvas: HTMLCanvasElement, f: Formation): void {
  const cssW = 300;
  const cssH = 420;
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Pitch.
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, 0, cssW, cssH);
  const M = 22;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(M, M, cssW - 2 * M, cssH - 2 * M);
  // Halfway line + centre circle.
  ctx.beginPath();
  ctx.moveTo(M, cssH / 2);
  ctx.lineTo(cssW - M, cssH / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cssW / 2, cssH / 2, 34, 0, Math.PI * 2);
  ctx.stroke();
  // The goal you attack, at the top.
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cssW / 2 - 34, M);
  ctx.lineTo(cssW / 2 + 34, M);
  ctx.stroke();

  const px = (fx: number) => M + fx * (cssW - 2 * M);
  // fy: GK ~0.94 sits near their own goal; that goal is at the TOP here, so a
  // higher fy maps nearer the top.
  const py = (fy: number) => M + (1 - fy) * (cssH - 2 * M);

  for (const s of f.slots) {
    const x = px(s.x);
    const y = py(s.y);
    const isGK = s.role === "GK";
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = isGK ? "#16a34a" : "#dc2626";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 9px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.label ?? s.role, x, y);
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ─────────────────────────────────────────────────────────────────────────
//  CELL DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────

interface Cell {
  key: string;
  title: string;
  subtitle: string;
  frame: Frame;
  /** For the exported ground-truth record. */
  kind: string;
  seed: number | null;
  game: "eleven" | "five";
}

/** Build a minimal opponent XI from a formation — enough for `castDefence` to
 *  assign identities (it reads position + depth `y` + isGK). Positions are NOT
 *  taken from the formation: castDefence only sets `who`. */
function oppXIFromFormationId(id: string): OpponentSheetPlayer[] {
  const f = formationOf(id);
  return f.slots.map((s, i) => ({
    id: `f-${id}-${i}`,
    name: `${s.label ?? s.role} ${i + 1}`,
    shortName: s.label ?? s.role,
    position: s.role,
    isGK: s.role === "GK",
    y: s.y,
  }));
}

/** One scenario of every kind, at a fixed seed each, cast against the chosen
 *  opponent formation AND reshaped by the real positional layer (formation ×
 *  playstyle × strength gap). applyFormationShape self-gates to the kinds it
 *  owns (long_range, tight_angle), so calling it on every cell moves the
 *  defenders only where the layer is meant to act and no-ops the rest. */
/**
 * A BASE SCENARIO: the canonical situation itself, straight from the real
 * builder at a fixed seed, with NO formation layer on top.
 *
 * Reported directly — "the formation stuff is too complicated rn on the
 * gallery, we need BASE scenarios to then change across formations" — and
 * this is what that means structurally. The thing you look at, edit and save
 * is the situation; a formation is a TRANSFORM applied to it, shown per
 * scenario in its own comparison strip (`FormationStrip`), never a dropdown
 * sitting over the whole gallery.
 */
function baseCells(): Cell[] {
  return SCENARIO_KINDS.map((kind, i) => {
    const seed = 1000 + i;
    return {
      key: `main-${kind}`,
      title: kind,
      subtitle: `base \u00b7 seed ${seed}`,
      frame: frameFromScenario(buildScenario(kind, mulberry32(seed))),
      kind,
      seed,
      game: "eleven" as const,
    };
  });
}

/** The three defensive shapes worth comparing a base scenario across: a
 *  back-three system (which defends as a five), a back four, and a genuine
 *  back five. Picked so the strip always shows the real spread rather than
 *  three formations that happen to defend identically. */
const COMPARE_FORMATIONS = ["352", "433", "523"];

/**
 * The scenario kinds `applyFormationShape` actually owns, mirrored here so
 * the comparison strip can SAY when it is showing you three identical
 * shapes rather than letting that read as a broken transform.
 *
 * Deliberately a local copy rather than an import: `APPLY_KINDS` is private
 * to formationShape.ts, that file is another lane's, and a dev tool reaching
 * into it would make a private detail public for a label. If the two ever
 * drift the only cost is this caption, never a wrong render — the strip
 * always calls the real `applyFormationShape`, whatever this says.
 */
const APPLY_SHAPE_KINDS = new Set<string>([
  "long_range", "tight_angle", "one_on_one", "cutback",
  "volley", "header", "byline_cross", "through_ball",
]);

/**
 * Push a frame's edited positions BACK onto a real `Scenario`, in the exact
 * order `frameFromScenario` pushed them out.
 *
 * This is what makes the across-formations strip honest: the positional
 * layer (`applyFormationShape`) reads the scenario's own defenders and
 * keeper, so a comparison built from the UNEDITED builder output would be
 * showing the formation transform applied to a scenario you no longer have.
 * The two orderings are kept in step by construction — both walk defenders,
 * keeper, runner, secondary runners, follower, teammates, you.
 */
function applyOverrideToScenario(sc: Scenario, ov: PosOverride | undefined): void {
  if (!hasEdits(ov)) return;
  const at = (i: number) => ov!.items[i];
  let i = 0;
  for (const d of sc.defenders) { const p = at(i++); if (p) { d.x = p.x; d.y = p.y; } }
  { const p = at(i++); if (p) { sc.keeper.x = p.x; sc.keeper.y = p.y; } }
  if (sc.runner) { const p = at(i++); if (p) { sc.runner.pos.x = p.x; sc.runner.pos.y = p.y; } }
  for (const r of sc.secondaryRunners) { const p = at(i++); if (p) { r.pos.x = p.x; r.pos.y = p.y; } }
  if (goalInView(sc.kind)) { const p = at(i++); if (p) { sc.follower.x = p.x; sc.follower.y = p.y; } }
  for (const t of sc.teammates) { const p = at(i++); if (p) { t.x = p.x; t.y = p.y; } }
  { const p = at(i++); if (p) { sc.player.x = p.x; sc.player.y = p.y; } }
  if (ov!.ball) { sc.ball.x = ov!.ball.x; sc.ball.y = ov!.ball.y; }
}

/** The SAME base scenario (edits and all), re-cast and reshaped against one
 *  opponent formation. `applyFormationShape` self-gates to the eight kinds
 *  it owns, so a kind it does not shape comes back as the base with real
 *  identities cast onto it — which is itself the honest answer. */
function shapedFrame(
  cell: Cell,
  override: PosOverride | undefined,
  formationId: string,
  playstyleId: Playstyle,
  attackerStrength: number,
  defenderStrength: number,
): Frame {
  const sc = buildScenario(cell.kind as (typeof SCENARIO_KINDS)[number], mulberry32(cell.seed ?? 0));
  applyOverrideToScenario(sc, override);
  castDefence(sc, oppXIFromFormationId(formationId));
  applyFormationShape(sc, {
    formation: formationOf(formationId),
    playstyle: PLAYSTYLES[playstyleId],
    attackerStrength,
    defenderStrength,
  });
  return frameFromScenario(sc);
}

// ───────────────────────────────────────────────────────
//  SAVING A BASE SCENARIO — into the SAME pool the Scenario Builder writes
// ───────────────────────────────────────────────────────

/** One shared pool, not two. A base scenario saved here is a real
 *  `MatchScenario` in `star_scenarios`, the same table and the same shape
 *  Mikey's builder writes — both tools use the same real pitch metres, so
 *  there is nothing to translate. `source` (scenarios.ts) carries the chance
 *  kind and seed, which `MatchScenario.kind` deliberately cannot. */
const gallerySlug = (cellKey: string) => `gallery-${cellKey}`;

/** MatchScenario.kind names dead-ball/kickoff MOMENTS — a different list
 *  from the engine's chance kinds on purpose. Only three of them line up;
 *  everything else is genuinely open play, and `source.kind` keeps the real
 *  answer either way. */
function momentKindFor(chanceKind: string): ScenarioMomentKind {
  if (chanceKind === "corner") return "corner";
  if (chanceKind === "free_kick" || chanceKind === "penalty") return "free_kick";
  return "open_play";
}

function frameToMatchScenario(cell: Cell, frame: Frame): MatchScenario {
  const vp = frame.camera;
  return {
    id: gallerySlug(cell.key),
    name: cell.title,
    kind: momentKindFor(cell.kind),
    camera: {
      centerX: round2((vp.x1 + vp.x2) / 2),
      centerY: round2((vp.y1 + vp.y2) / 2),
      viewHeight: round2(vp.y2 - vp.y1),
      // The gallery always draws un-rotated; the game rotates the camera for
      // a crossing situation, the shared primitives here do not.
      facing: "up",
    },
    ball: roundVec(frame.ball),
    players: frame.items.map((it, i) => ({
      id: `i${i}`,
      side: it.side,
      x: round2(it.at.x),
      y: round2(it.at.y),
      label: it.look.label,
    })),
    updatedAt: Date.now(),
    source: { tool: "gallery", kind: cell.kind, seed: cell.seed },
  };
}

/** The saved positions, back as the gallery's own index-keyed override — so
 *  a saved scenario is applied through the exact same path a live drag is,
 *  never a second way of placing the same figures. */
function overrideFromMatchScenario(ms: MatchScenario): PosOverride {
  const items: Record<number, Vec2> = {};
  ms.players.forEach((p, i) => {
    const idx = p.id.startsWith("i") ? Number(p.id.slice(1)) : i;
    items[Number.isFinite(idx) ? idx : i] = { x: p.x, y: p.y };
  });
  return { items, ball: { x: ms.ball.x, y: ms.ball.y } };
}

// ── Five-a-side ──

/** A fixed 5-a-side world with the ball in the last third, for a chance. */
function fiveChanceWorld(): FiveWorld {
  // FIVE_PITCH is x 22..46, y 0..36, goal defended/attacked at y = 0.
  return {
    ball: { x: 30, y: 9 },
    you: { x: 32, y: 9.5 },
    mates: [
      { x: 26, y: 6 },
      { x: 38, y: 7 },
      { x: 34, y: 3.5 },
    ],
    yourKeeper: { x: 34, y: 33 },
    opps: [
      { x: 31, y: 4.5 },
      { x: 37, y: 5.5 },
      { x: 27, y: 8 },
      { x: 34, y: 2.5 },
    ],
    theirKeeper: { x: 34, y: 1.2 },
  };
}

/** A defensive-shape frame: the real `defensiveShape` slots against a fixed
 *  attacking spread. This is where "four on the goal line" vs "a diamond"
 *  shows up before/after a shape change. */
function fiveDefensiveFrame(): Frame {
  // Canonical frame: attackers go toward y1 (goal defended at y = 0).
  const ball: Vec2 = { x: 30, y: 10 };
  const attackers: Vec2[] = [
    { x: 30, y: 10 }, // carrier
    { x: 24, y: 7 },
    { x: 40, y: 8 },
    { x: 34, y: 5 },
  ];
  const shape = defensiveShape(FIVE_A_SIDE, ball, attackers);
  const items: Item[] = [];
  attackers.forEach((a, i) => {
    items.push({ at: { ...a }, look: { ...MATE, label: i === 0 ? "BALL-CARRIER" : `A${i}`, star: i === 0 }, side: i === 0 ? "you" : "teammate" });
  });
  shape.slots.forEach((s, i) => {
    items.push({ at: { ...s }, look: { ...OPP, label: DEFEND_ROLES[i] }, side: "opponent" });
  });
  return {
    rules: FIVE_A_SIDE,
    camera: FIVE_A_SIDE.view,
    goalAtY: 0,
    offsideY: null,
    offsideFrom: null,
    items,
    ball,
  };
}

/** An attacking-shape frame: the real `attackingShape` slots against a fixed
 *  defensive block. This is where the 1-2-1 / 2-2 structure shows. */
function fiveAttackingFrame(): Frame {
  const ball: Vec2 = { x: 31, y: 20 };
  const ay = 18; // the move's band depth
  const defenders: Vec2[] = [
    { x: 30, y: 8 },
    { x: 38, y: 9 },
    { x: 26, y: 11 },
    { x: 34, y: 6 },
  ];
  const shape = attackingShape(FIVE_A_SIDE, ay, ball, defenders);
  const items: Item[] = [];
  defenders.forEach((d, i) => {
    items.push({ at: { ...d }, look: { ...OPP, label: `D${i + 1}` }, side: "opponent" });
  });
  shape.slots.forEach((s, i) => {
    items.push({
      at: { ...s },
      look: { ...MATE, label: ATTACK_ROLES[i], star: i === shape.yours },
      side: i === shape.yours ? "you" : "teammate",
    });
  });
  return {
    rules: FIVE_A_SIDE,
    camera: FIVE_A_SIDE.view,
    goalAtY: 0,
    offsideY: null,
    offsideFrom: null,
    items,
    ball,
  };
}

function fiveCells(): Cell[] {
  const cells: Cell[] = [];
  cells.push({
    key: "five-defensive",
    title: "5-a-side defensive shape",
    subtitle: "defensiveShape() · fixed spread",
    frame: fiveDefensiveFrame(),
    kind: "five-defensive",
    seed: null,
    game: "five",
  });
  cells.push({
    key: "five-attacking",
    title: "5-a-side attacking shape",
    subtitle: `attackingShape() · band y18 (${FIVE_HALFWAY_Y.toFixed(0)}=halfway)`,
    frame: fiveAttackingFrame(),
    kind: "five-attacking",
    seed: null,
    game: "five",
  });
  const seed = 3000;
  const chance = buildPassage(fiveChanceWorld(), {
    keeperStrength: FIVE_KEEPER_STRENGTH,
    rng: mulberry32(seed),
  });
  cells.push({
    key: "five-chance",
    title: "5-a-side chance",
    subtitle: `buildPassage · seed ${seed} · kind ${chance.kind}`,
    frame: frameFromScenario(chance),
    kind: chance.kind,
    seed,
    game: "five",
  });
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────
//  EDITING — drag figures/ball to their target positions, capture as JSON
// ─────────────────────────────────────────────────────────────────────────

/**
 * A per-cell set of position overrides ON TOP of the builder's own output.
 * Keyed by item INDEX — stable per cell, because the builders never add or
 * remove items at a fixed seed, and `castDefence` only re-labels the existing
 * defenders, never reshuffles them. Stored positionally rather than as a whole
 * frame so an edit survives a formation change (which re-labels but never
 * re-positions) and stays independent of the drawn kit/label.
 */
interface PosOverride {
  items: Record<number, Vec2>;
  ball?: Vec2;
}
type EditStore = Record<string, PosOverride>;

interface EditProps {
  edits: EditStore;
  setOverride: (key: string, ov: PosOverride) => void;
  clearOverride: (key: string) => void;
}

/**
 * The saved-scenario layer, threaded down to each base-scenario card.
 *
 * A card never talks to the API itself — it hands its finished
 * `MatchScenario` up, so exactly one place decides what "saved" means, and
 * that place only ever says it once the SERVER has confirmed the write.
 */
interface SaveProps {
  /** Every scenario this gallery has saved, by cell key. */
  saved: Record<string, MatchScenario>;
  saveCell: (cell: Cell, frame: Frame) => Promise<boolean>;
  revertCell: (cell: Cell) => Promise<boolean>;
  busy: Record<string, "saving" | "reverting" | undefined>;
  flash: Record<string, { ok: boolean; text: string } | undefined>;
  /** True once the server has said star_scenarios.sql hasn't been run. */
  migrationMissing: boolean;
}

const EDIT_KEY = "star-gallery-edits-v1";

function loadEdits(): EditStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EDIT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as EditStore) : {};
  } catch {
    return {};
  }
}

function saveEdits(store: EditStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EDIT_KEY, JSON.stringify(store));
  } catch {
    /* a dev tool is not worth crashing over a full quota */
  }
}

/** Does this override actually move anything? An empty one is "untouched". */
function hasEdits(ov: PosOverride | undefined): boolean {
  return !!ov && (Object.keys(ov.items).length > 0 || !!ov.ball);
}

function cloneOverride(ov: PosOverride | undefined): PosOverride {
  const items: Record<number, Vec2> = {};
  if (ov) for (const k of Object.keys(ov.items)) items[Number(k)] = { ...ov.items[Number(k)] };
  return { items, ball: ov?.ball ? { ...ov.ball } : undefined };
}

/** A paint-ready frame with any overridden positions applied over the builder's. */
function applyOverride(frame: Frame, ov: PosOverride | undefined): Frame {
  if (!hasEdits(ov)) return frame;
  const items = frame.items.map((it, i) =>
    ov!.items[i] ? { ...it, at: { ...ov!.items[i] } } : it,
  );
  const ball = ov!.ball ? { ...ov!.ball } : frame.ball;
  return { ...frame, items, ball };
}

// +0 turns a rounded -0 back into 0 so the JSON never reads "-0".
const round2 = (v: number) => Math.round(v * 100) / 100 + 0;
const roundVec = (v: Vec2) => ({ x: round2(v.x), y: round2(v.y) });

/** The clean ground-truth record for one edited cell. */
function exportRecord(cell: Cell, edited: Frame, formationId: string) {
  return {
    cell: cell.key,
    game: cell.game,
    kind: cell.kind,
    seed: cell.seed,
    ...(cell.game === "eleven" ? { formation: formationId } : {}),
    ball: roundVec(edited.ball),
    items: edited.items.map((it, i) => ({
      index: i,
      role: it.look.label ?? `#${i}`,
      keeper: !!it.keeper,
      at: roundVec(it.at),
    })),
  };
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    /* give up quietly — this is a dev tool */
  }
}

// The anatomy render.ts uses, replicated for hit-testing only (do NOT edit
// render.ts). A figure's feet sit at py(at.y); its body rises above that.
const HIT_FIGURE_R = 1.05; // render.ts FIGURE_R
const HIT_BODY_UP = 0.67; // ~mid-torso, in units of r, above the feet anchor

// ── UI ─────────────────────────────────────────────────────────────────────

const SMALL_BTN: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #334155",
  background: "#0f172a",
  color: "#e2e8f0",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

/**
 * An EDITABLE gallery cell. Drag any figure or the ball to a new position; the
 * grabbed point stays under the pointer (a rigid translate, not a snap), so the
 * inverse of `projectionFor` has to be exact — see `pointerToWorld`. Live drag
 * repaints THIS canvas directly (no parent re-render), committing to the shared
 * edit store on release.
 */
function GalleryCell({
  cell,
  override,
  onCommit,
  onReset,
  formationId,
  save,
  children,
}: {
  cell: Cell;
  override: PosOverride | undefined;
  onCommit: (key: string, ov: PosOverride) => void;
  onReset: (key: string) => void;
  formationId: string;
  /** Absent for the five-a-side cards, which are not saved anywhere. */
  save?: SaveProps;
  /** The across-formations strip, rendered under this card when open. */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  // Live override during a drag: a pointer-move mutates this and repaints this
  // one canvas, without a setState that would rebuild every cell mid-drag.
  const workingRef = useRef<PosOverride | null>(null);
  const dragRef = useRef<{ target: "ball" | number; offX: number; offY: number } | null>(null);
  const [showJson, setShowJson] = useState(false);

  const { cssW, cssH } = frameCssSize(cell.frame);
  const vp = cell.frame.camera;

  // A SAVED scenario IS this cell's starting point, not an edit sitting on
  // top of one — that is what "permanently changes that scenario" means. It
  // is applied through the exact same `applyOverride` path a live drag uses,
  // so there is never a second way of placing the same figures; an unsaved
  // drag then layers on top, Reset drops the unsaved part, and Revert (the
  // button below) is what goes back to the builder's own output.
  const savedScenario = save?.saved[cell.key];
  const baseFrame: Frame = applyOverride(
    cell.frame,
    savedScenario ? overrideFromMatchScenario(savedScenario) : undefined,
  );

  const effectiveOverride = (): PosOverride | undefined => workingRef.current ?? override;
  const currentFrame = (): Frame => applyOverride(baseFrame, effectiveOverride());
  const repaint = (): void => { if (ref.current) paint(ref.current, currentFrame()); };

  // Repaint when the base frame (a fresh cell object each render), the saved
  // scenario, or the committed override changes. A drag repaints directly,
  // so it is not here.
  useEffect(() => {
    repaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, override, savedScenario]);

  // ── The INVERSE of projectionFor's px/py, using paint's exact cssW/cssH ──
  //   px(x) = (x - vp.x1) * (cssW / (vp.x2 - vp.x1))  ⇒  x = cx * (vp.x2-vp.x1)/cssW + vp.x1
  function pointerToWorld(e: React.PointerEvent<HTMLCanvasElement>): Vec2 {
    const rect = ref.current!.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (cssW / (rect.width || cssW));
    const cy = (e.clientY - rect.top) * (cssH / (rect.height || cssH));
    return {
      x: cx * ((vp.x2 - vp.x1) / cssW) + vp.x1,
      y: cy * ((vp.y2 - vp.y1) / cssH) + vp.y1,
    };
  }

  /** Nearest grabbable to a world point, or null. Figures are grabbed by their
   *  mid-body (drawn above the feet anchor); the ball by its centre. */
  function grabTargetAt(world: Vec2): "ball" | number | null {
    const frame = currentFrame();
    const p = projectionFor(frame.rules, cssW, cssH, frame.camera);
    const r = Math.max(7, p.unit * HIT_FIGURE_R);
    const wx = p.px(world.x), wy = p.py(world.y);
    let best: "ball" | number | null = null;
    let bestD = Infinity;
    frame.items.forEach((it, i) => {
      const sx = p.px(it.at.x);
      const sy = p.py(it.at.y) - r * HIT_BODY_UP;
      const d = Math.hypot(sx - wx, sy - wy);
      if (d < r * 1.15 && d < bestD) { bestD = d; best = i; }
    });
    const bd = Math.hypot(p.px(frame.ball.x) - wx, p.py(frame.ball.y) - wy);
    if (bd < Math.max(14, r * 0.6) && bd < bestD) { best = "ball"; }
    return best;
  }

  const clampToView = (v: Vec2): Vec2 => ({
    x: Math.max(vp.x1, Math.min(vp.x2, v.x)),
    y: Math.max(vp.y1, Math.min(vp.y2, v.y)),
  });

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const world = pointerToWorld(e);
    const target = grabTargetAt(world);
    if (target === null) return;
    e.preventDefault();
    const frame = currentFrame();
    const at = target === "ball" ? frame.ball : frame.items[target].at;
    // Record the grabbed point's offset from the anchor, so the SAME point
    // stays under the cursor as we drag (the figure translates rigidly).
    dragRef.current = { target, offX: at.x - world.x, offY: at.y - world.y };
    workingRef.current = cloneOverride(effectiveOverride());
    ref.current?.setPointerCapture(e.pointerId);
    if (ref.current) ref.current.style.cursor = "grabbing";
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) {
      if (ref.current) {
        const t = grabTargetAt(pointerToWorld(e));
        ref.current.style.cursor = t === null ? "default" : "grab";
      }
      return;
    }
    const world = pointerToWorld(e);
    const next = clampToView({ x: world.x + drag.offX, y: world.y + drag.offY });
    const wk = workingRef.current ?? { items: {} };
    if (drag.target === "ball") wk.ball = next;
    else wk.items[drag.target] = next;
    workingRef.current = wk;
    repaint();
  }

  function endDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const wk = workingRef.current;
    workingRef.current = null;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (ref.current) ref.current.style.cursor = "grab";
    if (wk) onCommit(cell.key, wk);
  }

  const edited = hasEdits(override);
  const liveFrame = applyOverride(baseFrame, override);
  const json = JSON.stringify(exportRecord(cell, liveFrame, formationId), null, 2);

  const busy = save?.busy[cell.key];
  const flash = save?.flash[cell.key];

  return (
    <div
      data-cell={cell.key}
      style={{
        background: "#0b1220",
        border: edited ? "1px solid #38bdf8" : savedScenario ? "1px solid #22c55e" : "1px solid #1e293b",
        borderRadius: 10,
        padding: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{cell.title}</div>
        {save && (savedScenario ? (
          <span style={{ fontSize: 10, fontWeight: 800, color: "#bbf7d0", background: "#14532d", borderRadius: 4, padding: "1px 6px" }}>
            saved \u00b7 overriding
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", background: "#1e293b", borderRadius: 4, padding: "1px 6px" }}>
            built-in
          </span>
        ))}
        {edited && (
          <span style={{ fontSize: 10, fontWeight: 800, color: "#38bdf8", background: "#0c4a6e", borderRadius: 4, padding: "1px 6px" }}>
            unsaved edits
          </span>
        )}
      </div>
      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontFamily: "monospace" }}>
        {cell.subtitle}
      </div>
      <canvas
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ display: "block", borderRadius: 6, background: "#14532d", cursor: "grab", touchAction: "none" }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {save && (
          <>
            <button
              style={{
                ...SMALL_BTN,
                background: edited ? "#166534" : "#0f172a",
                borderColor: edited ? "#22c55e" : "#334155",
                opacity: busy ? 0.6 : 1,
                cursor: busy ? "default" : "pointer",
              }}
              disabled={!!busy}
              onClick={() => { void save.saveCell(cell, liveFrame); }}
              title="Save this geometry to the database \u2014 it becomes the real scenario, on every device"
            >
              {busy === "saving" ? "Saving\u2026" : edited ? "Save \u2713" : "Save"}
            </button>
            <button
              style={{
                ...SMALL_BTN,
                opacity: savedScenario && !busy ? 1 : 0.4,
                cursor: savedScenario && !busy ? "pointer" : "default",
              }}
              disabled={!savedScenario || !!busy}
              onClick={() => { void save.revertCell(cell); }}
              title="Delete the saved version \u2014 this scenario goes back to the built-in one everywhere"
            >
              {busy === "reverting" ? "Reverting\u2026" : "Revert to built-in"}
            </button>
          </>
        )}
        <button style={SMALL_BTN} onClick={() => { copyText(json); setShowJson((s) => !s); }}>
          Export{showJson ? " ▲" : " ▼"}
        </button>
        <button
          style={{ ...SMALL_BTN, opacity: edited ? 1 : 0.4, cursor: edited ? "pointer" : "default" }}
          disabled={!edited}
          onClick={() => onReset(cell.key)}
        >
          Reset
        </button>
      </div>
      {flash && (
        <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, lineHeight: 1.4, color: flash.ok ? "#4ade80" : "#fca5a5" }}>
          {flash.text}
        </div>
      )}
      <div style={{ fontSize: 10, color: "#475569", marginTop: 6 }}>
        drag figures/ball \u00b7 Reset drops unsaved edits
      </div>
      {children}
      {showJson && (
        <pre
          style={{
            marginTop: 8,
            background: "#020617",
            border: "1px solid #1e293b",
            borderRadius: 6,
            padding: 8,
            fontSize: 10,
            lineHeight: 1.4,
            maxHeight: 220,
            overflow: "auto",
            color: "#cbd5e1",
            whiteSpace: "pre",
            userSelect: "text",
          }}
        >
          {json}
        </pre>
      )}
    </div>
  );
}

function FormationRefCell({ formation }: { formation: Formation }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) paintFormationRef(ref.current, formation);
  }, [formation]);
  return (
    <div
      data-cell={`formation-ref-${formation.id}`}
      style={{ background: "#0b1220", border: "1px solid #7c2d12", borderRadius: 10, padding: 8 }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
        Formation reference — {formation.name}
      </div>
      <div style={{ color: "#fb923c", fontSize: 11, marginBottom: 8, fontFamily: "monospace" }}>
        the shape the opponent SHOULD hold (attack toward the top)
      </div>
      <canvas ref={ref} style={{ display: "block", borderRadius: 6, background: "#14532d" }} />
    </div>
  );
}

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  padding: "8px 18px",
  borderRadius: 8,
  border: active ? "1px solid #38bdf8" : "1px solid #1e293b",
  background: active ? "#0c4a6e" : "#0b1220",
  color: active ? "#e0f2fe" : "#94a3b8",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
});

/** Copy-all / reset-all across every cell the user has actually touched. */
function EditToolbar({
  cells,
  edits,
  clearOverride,
  formationId,
}: {
  cells: Cell[];
  edits: EditStore;
  clearOverride: (key: string) => void;
  formationId: string;
}) {
  const touched = cells.filter((c) => hasEdits(edits[c.key]));
  const active = touched.length > 0;
  const copyAll = () => {
    const payload = touched.map((c) =>
      exportRecord(c, applyOverride(c.frame, edits[c.key]), formationId),
    );
    copyText(JSON.stringify(payload, null, 2));
  };
  const resetAll = () => { for (const c of touched) clearOverride(c.key); };
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
      <button
        style={{
          ...SMALL_BTN,
          background: active ? "#0c4a6e" : "#0f172a",
          borderColor: active ? "#38bdf8" : "#334155",
          opacity: active ? 1 : 0.5,
          cursor: active ? "pointer" : "default",
        }}
        disabled={!active}
        onClick={copyAll}
      >
        Copy all edited ({touched.length})
      </button>
      <button
        style={{ ...SMALL_BTN, opacity: active ? 1 : 0.5, cursor: active ? "pointer" : "default" }}
        disabled={!active}
        onClick={resetAll}
      >
        Reset all edited
      </button>
    </div>
  );
}

// Strength matchup presets → (yourStrength, oppStrength) for the positional layer.
const MATCHUPS: { id: string; label: string; atk: number; def: number }[] = [
  { id: "even", label: "Even (70v70)", atk: 70, def: 70 },
  { id: "you-strong", label: "You stronger (90v55)", atk: 90, def: 55 },
  { id: "you-weak", label: "You weaker (55v90)", atk: 55, def: 90 },
];

const SELECT_STYLE: React.CSSProperties = {
  background: "#0b1220",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 14,
  fontWeight: 700,
};

/** One read-only canvas. Used by the across-formations strip, which is a
 *  comparison, not another place to drag things. */
function MiniFrame({ frame, label, note }: { frame: Frame; label: string; note: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => { if (ref.current) paint(ref.current, frame); }, [frame]);
  return (
    <div style={{ background: "#0b1220", border: "1px solid #334155", borderRadius: 8, padding: 6 }}>
      <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 1 }}>{label}</div>
      <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 6, fontFamily: "monospace" }}>{note}</div>
      <canvas ref={ref} style={{ display: "block", borderRadius: 6, background: "#14532d" }} />
    </div>
  );
}

/**
 * THE FORMATION TRANSFORM, viewed per scenario.
 *
 * The same base scenario — including whatever has been dragged or saved on
 * it — rendered against a back-three, a back-four and a back-five, side by
 * side, so what changes is the ONE situation across shapes rather than the
 * whole gallery flipping to a different formation at once. Playstyle and the
 * strength matchup live here too, for the same reason: they are properties
 * of the comparison, not of the scenario.
 */
function FormationStrip({ cell, override }: { cell: Cell; override: PosOverride | undefined }) {
  const [playstyleId, setPlaystyleId] = useState<Playstyle>("mid-block");
  const [matchupId, setMatchupId] = useState("even");
  const matchup = MATCHUPS.find((m) => m.id === matchupId) ?? MATCHUPS[0];
  const shapes = APPLY_SHAPE_KINDS.has(cell.kind);

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #1e293b", paddingTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 12, color: "#fb923c" }}>Across formations</span>
        <select
          value={playstyleId}
          onChange={(e) => setPlaystyleId(e.target.value as Playstyle)}
          style={{ ...SELECT_STYLE, fontSize: 12, padding: "4px 8px" }}
        >
          {Object.values(PLAYSTYLES).map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.name}</option>
          ))}
        </select>
        <select
          value={matchupId}
          onChange={(e) => setMatchupId(e.target.value)}
          style={{ ...SELECT_STYLE, fontSize: 12, padding: "4px 8px" }}
        >
          {MATCHUPS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>
      {!shapes && (
        <div style={{ color: "#fbbf24", fontSize: 11, fontWeight: 700, marginBottom: 8, maxWidth: 700, lineHeight: 1.5 }}>
          The positional layer doesn&rsquo;t own this kind (dead balls have their own wall-and-box setups;
          a midfield situation has no defensive block in frame), so these three differ only in WHO is cast
          into each shirt, not where anyone stands. That gap is real, and stating it is the point.
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {COMPARE_FORMATIONS.map((fid) => {
          const f = formationOf(fid);
          const line = defensiveLineOf(f);
          return (
            <MiniFrame
              key={fid}
              frame={shapedFrame(cell, override, fid, playstyleId, matchup.atk, matchup.def)}
              label={f.name}
              note={`defends as a back ${line.count}${line.isBack5 ? " (wing-backs drop)" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function ElevenView({ edits, setOverride, clearOverride, save }: EditProps & { save: SaveProps }) {
  const cells = baseCells();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <p style={{ margin: "0 0 10px", color: "#4ade80", fontSize: 13, maxWidth: 820, lineHeight: 1.5 }}>
        <b>These are the BASE scenarios</b> &mdash; the thirteen canonical situations
        <code> buildScenario</code> produces, one fixed seed each, with no formation layer on top. This is
        the thing you look at, edit and save. Blue = your side (star = you), red = opponents, green =
        keeper, yellow dashes = the offside line the engine would judge against.
      </p>
      <p style={{ margin: "0 0 16px", color: "#7dd3fc", fontSize: 13, maxWidth: 820, lineHeight: 1.5 }}>
        <b>Formation is a transform on top, per scenario.</b> Open <b>Across formations</b> on any card to
        see that same situation against a back-three, a back-four and a back-five side by side (playstyle
        and the strength matchup live in there too). <b>Save</b> writes the geometry to the shared
        database, so it is the real scenario on every device; <b>Revert to built-in</b> deletes that saved
        version again. Drag anything, then Save.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        {cells.map((c) => (
          <div key={c.key} style={{ display: "flex", flexDirection: "column" }}>
            <GalleryCell
              cell={c}
              override={edits[c.key]}
              onCommit={setOverride}
              onReset={clearOverride}
              formationId=""
              save={save}
            >
              <div style={{ marginTop: 8 }}>
                <button
                  style={{ ...SMALL_BTN, borderColor: "#7c2d12", color: "#fdba74" }}
                  onClick={() => setOpen((k) => (k === c.key ? null : c.key))}
                >
                  {open === c.key ? "Hide across formations \u25b2" : "Across formations \u25bc"}
                </button>
              </div>
              {open === c.key && <FormationStrip cell={c} override={edits[c.key]} />}
            </GalleryCell>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "28px 0 8px" }}>Formation reference shapes</h3>
      <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 13, maxWidth: 760 }}>
        The three formations the comparison strip uses, as their own slot layouts &mdash; the shape the
        opponent is MEANT to hold (attack toward the top).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        {COMPARE_FORMATIONS.map((fid) => (
          <FormationRefCell key={fid} formation={formationOf(fid)} />
        ))}
      </div>
    </div>
  );
}

function FiveView({ edits, setOverride, clearOverride }: EditProps) {
  const cells = fiveCells();
  return (
    <div>
      <p style={{ margin: "0 0 16px", color: "#94a3b8", fontSize: 13, maxWidth: 760 }}>
        Real <code>fiveASide/</code> shapes at fixed seeds. <code>defensiveShape</code> (where &ldquo;four
        on the goal line&rdquo; vs a diamond shows), <code>attackingShape</code> (the 1-2-1 / 2-2
        structure), and a full chance from <code>buildPassage</code>. This is a separate game from the
        11-a-side view — its own pitch, its own rules.
      </p>
      <p style={{ margin: "0 0 16px", color: "#7dd3fc", fontSize: 13, maxWidth: 760, lineHeight: 1.5 }}>
        <b>Editable.</b> Drag figures/ball to the target shape, then <code>Export</code> (per cell or all
        edited) for a ground-truth JSON record. Edits persist across reloads.
      </p>
      <EditToolbar cells={cells} edits={edits} clearOverride={clearOverride} formationId="" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        {cells.map((c) => (
          <GalleryCell
            key={c.key}
            cell={c}
            override={edits[c.key]}
            onCommit={setOverride}
            onReset={clearOverride}
            formationId=""
          />
        ))}
      </div>
    </div>
  );
}

/**
 * MIKEY'S SCENARIO BUILDER, hosted here.
 *
 * The same component the standalone /star-scenario-dev sandbox renders —
 * imported, not forked or rewritten, so there is exactly one builder and a
 * change to it shows up in both places. The two other tabs READ the real
 * builders at fixed seeds; this one WRITES hand-placed scenarios
 * (lib/star/scenarios.ts's MatchScenario, in real pitch metres) into the
 * shared star_scenarios table. Its own Save/Delete, its own "migration not
 * run" banner, and its own honest "saved on this device ONLY" wording all
 * live inside the component — nothing is duplicated out here.
 */
function BuilderView() {
  return (
    <div>
      <p style={{ margin: "0 0 8px", color: "#94a3b8", fontSize: 13, maxWidth: 820, lineHeight: 1.5 }}>
        Hand-build a scenario: place teammates and opponents, set the ball (it follows the You marker), and
        frame the camera — straight, or the quarter-turn left/right the real match actually shoots a cross
        from. Coordinates are <b>real pitch metres</b> (<code>lib/star/pitch.ts</code>), the one shape that
        could be handed straight to the real renderer with no translation.
      </p>
      <p style={{ margin: "0 0 16px", color: "#7dd3fc", fontSize: 13, maxWidth: 820, lineHeight: 1.5 }}>
        <b>Saving is shared.</b> Every scenario goes to the <code>star_scenarios</code> table, so it is
        there on every device, not just in this browser — and deleting one removes it everywhere. Writing
        needs an admin sign-in (same gate as the Lineups page); if it fails, the save says so rather than
        showing a tick.
      </p>
      <div style={{ background: "#030712", borderRadius: 12, padding: 12 }}>
        <ScenarioEditor />
      </div>
    </div>
  );
}

export default function StarGalleryDevPage() {
  const [view, setView] = useState<"eleven" | "five" | "builder">("eleven");

  // The shared edit store, lifted here so edits survive tab switches and both
  // views' "copy all edited" can see them. Persisted straight through the
  // setters (not a save-effect) to sidestep an initial "{} overwrites the
  // saved store" race; loaded once on mount after the {} first render, so
  // server and client agree on the first paint.
  const [edits, setEdits] = useState<EditStore>({});
  useEffect(() => {
    const loaded = loadEdits();
    if (Object.keys(loaded).length) setEdits(loaded);
  }, []);

  const setOverride = (key: string, ov: PosOverride) =>
    setEdits((prev) => {
      let next: EditStore;
      if (hasEdits(ov)) next = { ...prev, [key]: ov };
      else { next = { ...prev }; delete next[key]; }
      saveEdits(next);
      return next;
    });
  const clearOverride = (key: string) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      saveEdits(next);
      return next;
    });

  const editProps: EditProps = { edits, setOverride, clearOverride };

  // ── Saved base scenarios ────────────────────────────────────────────────
  // Read synchronously from the local cache on mount (so the gallery opens
  // on the saved geometry rather than flashing the builder's output first),
  // then refreshed from the server, which is the real source of truth.
  const [saved, setSaved] = useState<Record<string, MatchScenario>>({});
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, "saving" | "reverting" | undefined>>({});
  const [flash, setFlash] = useState<Record<string, { ok: boolean; text: string } | undefined>>({});

  /** The shared pool holds the Scenario Builder's own hand-placed scenarios
   *  too; only the ones this gallery saved map back onto a cell. */
  const indexGallery = (all: MatchScenario[]): Record<string, MatchScenario> => {
    const out: Record<string, MatchScenario> = {};
    for (const sc of all) {
      if (sc.source?.tool === "gallery" && sc.id.startsWith("gallery-")) {
        out[sc.id.slice("gallery-".length)] = sc;
      }
    }
    return out;
  };

  useEffect(() => {
    setSaved(indexGallery(listScenarios()));
    void fetchSharedScenarios().then((r) => {
      setSaved(indexGallery(listScenarios()));
      if (r.migrationMissing) setMigrationMissing(true);
      else if (!r.ok && r.message) setLoadNote(r.message);
    });
  }, []);

  const flashFor = (key: string, ok: boolean, text: string) => {
    setFlash((f) => ({ ...f, [key]: { ok, text } }));
    window.setTimeout(() => setFlash((f) => ({ ...f, [key]: undefined })), 7000);
  };

  /**
   * "Saved" only ever means the SERVER said so. A refused write leaves the
   * card's unsaved-edits badge exactly where it was and says why — never a
   * green tick over something that reached no other device.
   */
  const saveCell = async (cell: Cell, frame: Frame): Promise<boolean> => {
    setBusy((b) => ({ ...b, [cell.key]: "saving" }));
    const scenario = frameToMatchScenario(cell, frame);
    const res = await saveScenarioShared(scenario);
    setBusy((b) => ({ ...b, [cell.key]: undefined }));
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) {
      flashFor(cell.key, false, `Not saved to the database — ${res.message} Your edits are still here.`);
      return false;
    }
    setSaved((m) => ({ ...m, [cell.key]: scenario }));
    // The geometry now lives in the saved scenario, so leaving the local
    // override in place would count it twice (as "unsaved edits" on itself).
    clearOverride(cell.key);
    flashFor(cell.key, true, "Saved — this is the scenario now, on every device.");
    return true;
  };

  const revertCell = async (cell: Cell): Promise<boolean> => {
    setBusy((b) => ({ ...b, [cell.key]: "reverting" }));
    const res = await deleteScenarioShared(gallerySlug(cell.key));
    setBusy((b) => ({ ...b, [cell.key]: undefined }));
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) {
      flashFor(cell.key, false, `Not reverted — ${res.message}`);
      return false;
    }
    setSaved((m) => { const next = { ...m }; delete next[cell.key]; return next; });
    clearOverride(cell.key);
    flashFor(cell.key, true, "Reverted — back to the built-in scenario everywhere.");
    return true;
  };

  const saveProps: SaveProps = { saved, saveCell, revertCell, busy, flash, migrationMissing };
  const savedCount = Object.keys(saved).length;

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", padding: "24px 16px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 6px" }}>Scenario Gallery</h1>
      <p style={{ margin: "0 0 12px", color: "#94a3b8", fontSize: 14, maxWidth: 760 }}>
        Deterministic dev scaffolding. Every cell is built from the real scenario/shape builders at a
        fixed seed, so a screenshot before and after a builder change is a true like-for-like comparison.
        This page changes no game behaviour.
      </p>
      <p style={{ margin: "0 0 12px", color: "#7dd3fc", fontSize: 14, maxWidth: 820, lineHeight: 1.5 }}>
        It is now also a <b>scenario editor</b>: drag players and the ball into the positions a scenario
        SHOULD have, then <b>Save</b> — the geometry goes to the shared database, so it is the real
        scenario on every device, not just in this browser. The third tab hosts the full{" "}
        <b>Scenario Builder</b>, for hand-placing a scenario from scratch.
      </p>

      {migrationMissing && (
        <div
          style={{
            margin: "0 0 16px",
            maxWidth: 840,
            background: "#450a0a",
            border: "1px solid #ef4444",
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            lineHeight: 1.55,
            color: "#fecaca",
            fontWeight: 700,
          }}
        >
          <b>Saving is off — the database table doesn&rsquo;t exist yet.</b> Run{" "}
          <code>supabase/migrations/star_scenarios.sql</code> in the Supabase SQL Editor. Until then you
          can still drag and Export, but a Save will fail and say so — nothing is silently lost, and
          nothing you drag reaches any other device.
        </div>
      )}
      {!migrationMissing && loadNote && (
        <div style={{ margin: "0 0 16px", maxWidth: 840, fontSize: 13, fontWeight: 700, color: "#fca5a5" }}>
          {loadNote}
        </div>
      )}
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 12 }}>
        {savedCount === 0
          ? "No saved scenarios yet — every base scenario below is the built-in one."
          : `${savedCount} saved scenario${savedCount === 1 ? "" : "s"} currently overriding the built-in geometry.`}
        {" "}Saving needs an admin sign-in (same gate as the Lineups page).
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <button style={TAB_BTN(view === "eleven")} onClick={() => setView("eleven")}>
          Real game (11-a-side)
        </button>
        <button style={TAB_BTN(view === "five")} onClick={() => setView("five")}>
          Five-a-side
        </button>
        <button style={TAB_BTN(view === "builder")} onClick={() => setView("builder")}>
          Scenario Builder
        </button>
      </div>

      {view === "eleven" && <ElevenView {...editProps} save={saveProps} />}
      {view === "five" && <FiveView {...editProps} />}
      {view === "builder" && <BuilderView />}
    </main>
  );
}
