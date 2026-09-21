"use client";

/**
 * SCENARIO GALLERY — a gallery, not a document.
 *
 * Every picture on this page is built from the REAL builders at a HARD-CODED
 * seed, so a screenshot before and after a builder change is a true
 * like-for-like comparison. Nothing here changes game behaviour: it only READS
 * `buildScenario`, `fixBaseScenario`, `scenarioFaults`, `defensiveShape`,
 * `attackingShape`, `buildPassage`, `castDefence`, `applyFormationShape` and the
 * shared `render.ts` primitives.
 *
 * ── The shell ──
 *
 * Reported directly: "instead of all this yap on this front page, it's
 * literally just a scenario gallery." So the prose is gone and the picture is
 * the truth. Home is three full-bleed tiles; a game opens on a chip row of its
 * kinds and a grid of version thumbnails; a thumbnail opens on one big frame
 * you can drag, approve or reject. A fault is a RED RING on the figure (or the
 * ball) that is wrong, plus at most one red line of English — never a panel.
 * A through ball's deliberate early runner rings AMBER, uncaptioned.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SCENARIO_KINDS,
  buildScenario,
  goalInView,
  type Scenario,
  type ScenarioKind,
  type Vec2,
  type Identity,
} from "@/lib/star/canvasEngine";
import { CX } from "@/lib/star/pitch";
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
import { FIVE_KEEPER_STRENGTH } from "@/lib/star/fiveASide/geometry";
import { fixBaseScenario, scenarioFaults, offsideLineOf } from "@/lib/star/baseScenario";
import { castDefence, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { formationOf } from "@/lib/star/formations";
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
import {
  loadReviews,
  saveReviews,
  reviewedCount,
  type ReviewStore,
  type ReviewVerdict,
} from "@/lib/star/scenarioReview";

// ── Kit looks. Not real club kits — just enough colour to tell the three
//    groups apart on a diagram: your side blue, theirs red, a keeper green. ──
const YOU: Omit<FigureLook, "label" | "star"> = { shirt: "#1d4ed8", shorts: "#1e3a8a", trim: "#ffffff" };
const OPP: Omit<FigureLook, "label" | "star"> = { shirt: "#dc2626", shorts: "#7f1d1d", trim: "#ffffff" };
const KEEP: Omit<FigureLook, "label" | "star"> = { shirt: "#16a34a", shorts: "#14532d", trim: "#ffffff" };
const MATE: Omit<FigureLook, "label" | "star"> = { shirt: "#3b82f6", shorts: "#1e3a8a", trim: "#ffffff" };

const FACE = DEFAULT_FACE_STYLE;
const FAKE = DEFAULT_FAKE_FACE_STYLE;

// ─────────────────────────────────────────────────────────────────────────
//  FRAMES — unchanged from the original gallery. A Frame is the flat list of
//  things to paint; `paint` puts it on a canvas.
// ─────────────────────────────────────────────────────────────────────────

/** One thing to draw. A figure, a keeper, or (via `keeper`) a keeper pose. */
interface Item {
  at: Vec2;
  look: FigureLook;
  keeper?: boolean;
  /** Which side he is on — carried so a frame can be written out as a real
   *  `MatchScenario` (lib/star/scenarios.ts), whose players are sided. */
  side: ScenarioSide;
}

interface Frame {
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

const idLabel = (who: Identity | undefined, fallback: string): string =>
  who?.shortName ?? who?.name ?? fallback;

/** Turn a built Scenario into a flat list of things to paint.
 *  ORDER MATTERS: defenders, keeper, runner, secondary runners, follower,
 *  teammates, you — `applyOverrideToScenario` and `markIndices` both walk it. */
function frameFromScenario(sc: Scenario): Frame {
  const items: Item[] = [];

  sc.defenders.forEach((d, i) => {
    items.push({ at: { x: d.x, y: d.y }, look: { ...OPP, label: idLabel(d.who, `D${i + 1}`) }, side: "opponent" });
  });
  items.push({
    at: { x: sc.keeper.x, y: sc.keeper.y },
    look: { ...KEEP, label: idLabel(sc.keeper.who, "GK") },
    keeper: true,
    side: "opponent",
  });

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
  sc.teammates.forEach((t, i) => {
    items.push({ at: { x: t.x, y: t.y }, look: { ...MATE, label: idLabel(t.who, `T${i + 1}`) }, side: "teammate" });
  });

  items.push({ at: { ...sc.player }, look: { ...YOU, label: "YOU", star: true }, side: "you" });

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
    items,
    ball: { ...sc.ball },
  };
}

/** The offside line RE-DERIVED from a frame's CURRENT item positions, so a
 *  dragged defender moves the line with it. */
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

/** The CSS pixel size a frame paints at — shared with the pointer-to-metre
 *  inverse so the two can never disagree. */
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

/** Paint a frame onto a canvas, sized to the camera's own aspect. */
function paint(canvas: HTMLCanvasElement, frame: Frame): void {
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
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────────
//  FAULT RINGS — the picture says what is wrong, not a paragraph
// ─────────────────────────────────────────────────────────────────────────

// render.ts's own anatomy, replicated for hit-testing and ring placement only
// (do NOT edit render.ts). A figure's feet sit at py(at.y); its body rises.
const HIT_FIGURE_R = 1.05; // render.ts FIGURE_R
const HIT_BODY_UP = 0.67; // ~mid-torso, in units of r, above the feet anchor

interface Mark { at: Vec2; ball?: boolean; tone: "red" | "amber" }

/** Paint a frame, then ring whatever is wrong with it. */
function paintMarked(canvas: HTMLCanvasElement, frame: Frame, marks: Mark[]): void {
  paint(canvas, frame);
  if (!marks.length) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { cssW, cssH } = frameCssSize(frame);
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
    ctx.strokeStyle = m.tone === "red" ? "rgba(239,68,68,0.95)" : "rgba(245,158,11,0.95)";
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
function attackersOf(sc: Scenario): Vec2[] {
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
function marksForFaults(sc: Scenario, faults: string[], tone: "red" | "amber"): Mark[] {
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
    // Everything left is about where the ball is (too central, too far out,
    // not near the byline) or about an area in front of it (empty channel).
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
function splitFaults(kind: string, faults: string[]): { faults: string[]; intended: string[] } {
  const out: string[] = [];
  const intended: string[] = [];
  for (const f of faults) {
    if (kind === "through_ball" && f === "attacker offside") intended.push(f);
    else out.push(f);
  }
  return { faults: out, intended };
}

// ─────────────────────────────────────────────────────────────────────────
//  CELLS — a "version" is one kind at one fixed seed
// ─────────────────────────────────────────────────────────────────────────

interface Cell {
  key: string;
  /** The chance kind (11-a-side) or shape group id (5-a-side). */
  kind: string;
  seed: number | null;
  game: "eleven" | "five";
  frame: Frame;
  /** A human label for the export record only. */
  title: string;
}

/** Ten fixed seeds per kind, so a picture is identical on every refresh.
 *  The FIRST is the gallery's original seed for that kind (1000 + its index),
 *  which keeps every already-saved scenario and already-dragged edit pointing
 *  at the same version it always did. */
const VERSIONS_PER_KIND = 10;
function seedsForKind(kind: ScenarioKind): number[] {
  const i = SCENARIO_KINDS.indexOf(kind);
  const base = 1000 + i;
  const rest: number[] = [];
  for (let k = 1; k < VERSIONS_PER_KIND; k++) rest.push(7000 + i * 100 + k);
  return [base, ...rest];
}
function cellKeyFor(kind: ScenarioKind, seed: number): string {
  const base = 1000 + SCENARIO_KINDS.indexOf(kind);
  return seed === base ? `main-${kind}` : `v-${kind}-${seed}`;
}

/** A BASE SCENARIO: the canonical situation straight from the real builder at
 *  a fixed seed, CORRECTED by `fixBaseScenario`, with no formation layer. */
function buildCell(kind: ScenarioKind, seed: number): Cell {
  const sc = buildScenario(kind, mulberry32(seed));
  fixBaseScenario(sc);
  return {
    key: cellKeyFor(kind, seed),
    kind,
    seed,
    game: "eleven",
    frame: frameFromScenario(sc),
    title: kind,
  };
}

// Built once per kind and kept — the builders are pure at a fixed seed, so
// rebuilding them on every render would be work for an identical picture.
const ELEVEN_CACHE = new Map<string, Cell[]>();
function elevenVersions(kind: ScenarioKind): Cell[] {
  const hit = ELEVEN_CACHE.get(kind);
  if (hit) return hit;
  const cells = seedsForKind(kind).map((s) => buildCell(kind, s));
  ELEVEN_CACHE.set(kind, cells);
  return cells;
}

/** The faults of a cell AS IT CURRENTLY STANDS — builder output, corrected,
 *  with whatever has been saved or dragged on top. Re-derived rather than
 *  captured once, so the ring and the picture can never disagree. */
function liveAnalysis(
  cell: Cell,
  overrides: (PosOverride | undefined)[],
): { faults: string[]; intended: string[]; marks: Mark[] } {
  if (cell.game !== "eleven" || cell.seed === null) return { faults: [], intended: [], marks: [] };
  const sc = buildScenario(cell.kind as ScenarioKind, mulberry32(cell.seed));
  fixBaseScenario(sc);
  for (const ov of overrides) applyOverrideToScenario(sc, ov);
  const split = splitFaults(cell.kind, scenarioFaults(sc));
  return {
    faults: split.faults,
    intended: split.intended,
    marks: [
      ...marksForFaults(sc, split.faults, "red"),
      ...marksForFaults(sc, split.intended, "amber"),
    ],
  };
}

// ── The across-formations comparison (desktop only) ──

const COMPARE_FORMATIONS = ["352", "433", "523"];

/**
 * The scenario kinds `applyFormationShape` actually owns, mirrored here so the
 * comparison can SAY when it is showing three identical shapes rather than
 * letting that read as a broken transform. Deliberately a local copy:
 * APPLY_KINDS is private to formationShape.ts and that file is another lane's.
 */
const APPLY_SHAPE_KINDS = new Set<string>([
  "long_range", "tight_angle", "one_on_one", "cutback",
  "volley", "header", "byline_cross", "through_ball",
]);

/** Build a minimal opponent XI from a formation — enough for `castDefence` to
 *  assign identities (it reads position + depth `y` + isGK). */
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

/**
 * Push a frame's edited positions BACK onto a real `Scenario`, in the exact
 * order `frameFromScenario` pushed them out — so the formation transform is
 * applied to the scenario you are actually looking at, not the raw build.
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
 *  opponent formation. */
function shapedFrame(
  cell: Cell,
  override: PosOverride | undefined,
  formationId: string,
  playstyleId: Playstyle,
  attackerStrength: number,
  defenderStrength: number,
): Frame {
  const sc = buildScenario(cell.kind as ScenarioKind, mulberry32(cell.seed ?? 0));
  fixBaseScenario(sc);
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

// ─────────────────────────────────────────────────────────────────────────
//  SAVING — into the SAME pool the Scenario Builder writes
// ─────────────────────────────────────────────────────────────────────────

const gallerySlug = (cellKey: string) => `gallery-${cellKey}`;

/** MatchScenario.kind names dead-ball/kickoff MOMENTS — a different list from
 *  the engine's chance kinds on purpose. Only three of them line up. */
function momentKindFor(chanceKind: string): ScenarioMomentKind {
  if (chanceKind === "corner") return "corner";
  if (chanceKind === "free_kick" || chanceKind === "penalty") return "free_kick";
  return "open_play";
}

// +0 turns a rounded -0 back into 0 so the JSON never reads "-0".
const round2 = (v: number) => Math.round(v * 100) / 100 + 0;
const roundVec = (v: Vec2) => ({ x: round2(v.x), y: round2(v.y) });

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

/** The saved positions, back as the gallery's own index-keyed override — so a
 *  saved scenario is applied through the exact same path a live drag is. */
function overrideFromMatchScenario(ms: MatchScenario): PosOverride {
  const items: Record<number, Vec2> = {};
  ms.players.forEach((p, i) => {
    const idx = p.id.startsWith("i") ? Number(p.id.slice(1)) : i;
    items[Number.isFinite(idx) ? idx : i] = { x: p.x, y: p.y };
  });
  return { items, ball: { x: ms.ball.x, y: ms.ball.y } };
}

/** The clean ground-truth record for one edited cell. */
function exportRecord(cell: Cell, edited: Frame) {
  return {
    cell: cell.key,
    game: cell.game,
    kind: cell.kind,
    seed: cell.seed,
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

// ─────────────────────────────────────────────────────────────────────────
//  FIVE-A-SIDE — same shell, three shape groups, versions by seed
// ─────────────────────────────────────────────────────────────────────────

/** Seed 0 is the gallery's original fixed spread, byte-for-byte; every other
 *  seed jitters the INPUT positions deterministically so a group has real
 *  versions to review rather than one picture. */
const FIVE_SEEDS = [0, 4001, 4002, 4003, 4004, 4005, 4006, 4007, 4008, 4009];
const J = (rng: () => number, v: number, a: number) => v + (rng() * 2 - 1) * a;

function fiveDefensiveFrame(seed: number): Frame {
  const on = seed === 0 ? 0 : 1;
  const rng = mulberry32(seed + 1);
  const ball: Vec2 = { x: J(rng, 30, 3 * on), y: J(rng, 10, 2.5 * on) };
  const attackers: Vec2[] = [
    { ...ball },
    { x: J(rng, 24, 3 * on), y: J(rng, 7, 2 * on) },
    { x: J(rng, 40, 3 * on), y: J(rng, 8, 2 * on) },
    { x: J(rng, 34, 3 * on), y: J(rng, 5, 1.5 * on) },
  ];
  const shape = defensiveShape(FIVE_A_SIDE, ball, attackers);
  const items: Item[] = [];
  attackers.forEach((a, i) => {
    items.push({
      at: { ...a },
      look: { ...MATE, label: i === 0 ? "BALL-CARRIER" : `A${i}`, star: i === 0 },
      side: i === 0 ? "you" : "teammate",
    });
  });
  shape.slots.forEach((s, i) => {
    items.push({ at: { ...s }, look: { ...OPP, label: DEFEND_ROLES[i] }, side: "opponent" });
  });
  return { rules: FIVE_A_SIDE, camera: FIVE_A_SIDE.view, goalAtY: 0, offsideY: null, offsideFrom: null, items, ball };
}

function fiveAttackingFrame(seed: number): Frame {
  const on = seed === 0 ? 0 : 1;
  const rng = mulberry32(seed + 2);
  const ball: Vec2 = { x: J(rng, 31, 3 * on), y: J(rng, 20, 2 * on) };
  const ay = 18;
  const defenders: Vec2[] = [
    { x: J(rng, 30, 3 * on), y: J(rng, 8, 2 * on) },
    { x: J(rng, 38, 3 * on), y: J(rng, 9, 2 * on) },
    { x: J(rng, 26, 3 * on), y: J(rng, 11, 2 * on) },
    { x: J(rng, 34, 3 * on), y: J(rng, 6, 1.5 * on) },
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
  return { rules: FIVE_A_SIDE, camera: FIVE_A_SIDE.view, goalAtY: 0, offsideY: null, offsideFrom: null, items, ball };
}

/** A fixed 5-a-side world with the ball in the last third, for a chance. */
function fiveChanceWorld(seed: number): FiveWorld {
  const on = seed === 3000 ? 0 : 1;
  const rng = mulberry32(seed + 3);
  return {
    ball: { x: J(rng, 30, 3 * on), y: J(rng, 9, 2 * on) },
    you: { x: J(rng, 32, 3 * on), y: J(rng, 9.5, 2 * on) },
    mates: [
      { x: J(rng, 26, 3 * on), y: J(rng, 6, 2 * on) },
      { x: J(rng, 38, 3 * on), y: J(rng, 7, 2 * on) },
      { x: J(rng, 34, 3 * on), y: J(rng, 3.5, 1.5 * on) },
    ],
    yourKeeper: { x: 34, y: 33 },
    opps: [
      { x: J(rng, 31, 3 * on), y: J(rng, 4.5, 1.5 * on) },
      { x: J(rng, 37, 3 * on), y: J(rng, 5.5, 1.5 * on) },
      { x: J(rng, 27, 3 * on), y: J(rng, 8, 2 * on) },
      { x: J(rng, 34, 3 * on), y: J(rng, 2.5, 1 * on) },
    ],
    theirKeeper: { x: 34, y: 1.2 },
  };
}

const FIVE_CACHE = new Map<string, Cell[]>();
function fiveVersions(group: string): Cell[] {
  const hit = FIVE_CACHE.get(group);
  if (hit) return hit;
  let cells: Cell[];
  if (group === "defensive") {
    cells = FIVE_SEEDS.map((s) => ({
      key: s === 0 ? "five-defensive" : `five-defensive-${s}`,
      kind: "five-defensive", seed: s, game: "five" as const,
      frame: fiveDefensiveFrame(s), title: "5-a-side defensive shape",
    }));
  } else if (group === "attacking") {
    cells = FIVE_SEEDS.map((s) => ({
      key: s === 0 ? "five-attacking" : `five-attacking-${s}`,
      kind: "five-attacking", seed: s, game: "five" as const,
      frame: fiveAttackingFrame(s), title: "5-a-side attacking shape",
    }));
  } else {
    cells = FIVE_SEEDS.map((_, i) => {
      const seed = 3000 + i;
      const chance = buildPassage(fiveChanceWorld(seed), {
        keeperStrength: FIVE_KEEPER_STRENGTH,
        rng: mulberry32(seed),
      });
      return {
        key: seed === 3000 ? "five-chance" : `five-chance-${seed}`,
        kind: "five-chance", seed, game: "five" as const,
        frame: frameFromScenario(chance), title: "5-a-side chance",
      };
    });
  }
  FIVE_CACHE.set(group, cells);
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────
//  EDITS — drag overrides on top of the builder's own output
// ─────────────────────────────────────────────────────────────────────────

/** A per-cell set of position overrides, keyed by item INDEX — stable per
 *  cell, because the builders never add or remove items at a fixed seed. */
interface PosOverride {
  items: Record<number, Vec2>;
  ball?: Vec2;
}
type EditStore = Record<string, PosOverride>;

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

// ─────────────────────────────────────────────────────────────────────────
//  LOOK
// ─────────────────────────────────────────────────────────────────────────

const BG = "#05070d";
const CARD = "#111823";
const INK = "#f2f5f9";
const MUTED = "#8a97aa";

const KIND_ORDER: ScenarioKind[] = [
  "one_on_one", "tight_angle", "long_range", "volley", "cutback", "header",
  "through_ball", "byline_cross", "midfield_pass", "buildup", "penalty",
  "free_kick", "corner",
];
const kindLabel = (k: string) => k.replace(/_/g, " ");

const FIVE_GROUPS: { id: string; label: string }[] = [
  { id: "defensive", label: "Defensive shape" },
  { id: "attacking", label: "Attacking shape" },
  { id: "chance", label: "Chance" },
];

/** Paint into a canvas that then FILLS its box — the picture is the card, so
 *  it is never letterboxed inside one. */
function fillCanvas(c: HTMLCanvasElement, focus = "center"): void {
  c.style.width = "100%";
  c.style.height = "100%";
  c.style.objectFit = "cover";
  c.style.objectPosition = focus;
  c.style.display = "block";
}

// ─────────────────────────────────────────────────────────────────────────
//  SCREEN 1 — HOME
// ─────────────────────────────────────────────────────────────────────────

function HomeTile({
  frame, word, onOpen,
}: { frame: Frame; word: string; onOpen: () => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    paint(ref.current, frame);
    // A tile is a wide letterbox out of a tall portrait frame, so centring it
    // would show midfield grass. Bias to the goal end, where the picture is.
    fillCanvas(ref.current, "center 22%");
  }, [frame]);
  return (
    <button
      onClick={onOpen}
      style={{
        position: "relative", flex: 1, minHeight: 0, width: "100%",
        borderRadius: 26, overflow: "hidden", border: "none", padding: 0,
        background: "#0a2a17", cursor: "pointer", display: "block",
        boxShadow: "0 12px 34px rgba(0,0,0,0.55)",
      }}
    >
      <canvas ref={ref} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(3,6,14,0.35) 0%, rgba(3,6,14,0.15) 42%, rgba(3,6,14,0.88) 100%)",
        }}
      />
      <div
        style={{
          position: "absolute", left: 20, right: 20, bottom: 18,
          textAlign: "left", color: INK, fontSize: 30, fontWeight: 800,
          letterSpacing: "-0.02em", lineHeight: 1.05,
          textShadow: "0 2px 14px rgba(0,0,0,0.7)",
        }}
      >
        {word}
      </div>
    </button>
  );
}

function HomeScreen({
  onOpen, warning,
}: { onOpen: (s: "eleven" | "five" | "builder") => void; warning: string | null }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const tiles = useMemo(
    () => [
      { word: "11-a-side", frame: elevenVersions("one_on_one")[0].frame, go: "eleven" as const },
      { word: "5-a-side", frame: fiveVersions("attacking")[0].frame, go: "five" as const },
      { word: "Scenario Builder", frame: elevenVersions("corner")[0].frame, go: "builder" as const },
    ],
    [],
  );
  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", gap: 12, padding: 14 }}>
      {warning && (
        <button
          onClick={() => setNoteOpen((v) => !v)}
          aria-label="Something is unavailable"
          style={{
            position: "absolute", top: 20, right: 22, zIndex: 5,
            width: 14, height: 14, borderRadius: 999, border: "2px solid rgba(3,6,14,0.7)",
            background: "#ef4444", padding: 0, cursor: "pointer",
            boxShadow: "0 0 0 4px rgba(239,68,68,0.18)",
          }}
        />
      )}
      {warning && noteOpen && (
        <div
          style={{
            position: "absolute", top: 44, right: 16, left: 16, zIndex: 6,
            background: "#2a0d0d", border: "1px solid #ef4444", borderRadius: 14,
            padding: "10px 12px", color: "#fecaca", fontSize: 13, fontWeight: 600, lineHeight: 1.45,
          }}
        >
          {warning}
        </div>
      )}
      {tiles.map((t) => (
        <HomeTile key={t.word} frame={t.frame} word={t.word} onOpen={() => onOpen(t.go)} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  SCREEN 2/4 — CHIP ROW + THUMBNAIL GRID
// ─────────────────────────────────────────────────────────────────────────

function Thumb({
  cell, override, saved, verdict, onOpen,
}: {
  cell: Cell;
  override: PosOverride | undefined;
  saved: MatchScenario | undefined;
  verdict: ReviewVerdict | undefined;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const savedOv = saved ? overrideFromMatchScenario(saved) : undefined;
  const frame = applyOverride(applyOverride(cell.frame, savedOv), override);
  const analysis = useMemo(
    () => liveAnalysis(cell, [savedOv, override]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cell, saved, override],
  );

  useEffect(() => {
    if (!ref.current) return;
    paintMarked(ref.current, frame, analysis.marks);
    fillCanvas(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, saved, override]);

  return (
    <button
      onClick={onOpen}
      style={{
        position: "relative", width: "100%", aspectRatio: "5 / 8",
        borderRadius: 18, overflow: "hidden", padding: 0, cursor: "pointer",
        border: hasEdits(override) ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,0.07)",
        background: "#0a2a17", display: "block",
      }}
    >
      <canvas ref={ref} style={{ position: "absolute", inset: 0 }} />
      {verdict && (
        <span
          style={{
            position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: 999,
            display: "grid", placeItems: "center", fontSize: 14, fontWeight: 900, color: "#fff",
            background: verdict === "approved" ? "#16a34a" : "#dc2626",
            boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {verdict === "approved" ? "✓" : "✕"}
        </span>
      )}
      {analysis.faults.length > 0 && (
        <span
          style={{
            position: "absolute", top: 10, right: 10, width: 11, height: 11, borderRadius: 999,
            background: "#ef4444", boxShadow: "0 0 0 3px rgba(0,0,0,0.35)",
          }}
        />
      )}
    </button>
  );
}

function ChipRow({
  chips, activeId, onPick, wide,
}: {
  chips: { id: string; label: string; done: number; total: number }[];
  activeId: string;
  onPick: (id: string) => void;
  wide: boolean;
}) {
  const style = (active: boolean): React.CSSProperties => ({
    flex: "none",
    padding: wide ? "10px 14px" : "9px 14px",
    borderRadius: 999,
    border: "1px solid " + (active ? "rgba(56,189,248,0.75)" : "rgba(255,255,255,0.08)"),
    background: active ? "rgba(14,116,144,0.4)" : "rgba(255,255,255,0.045)",
    color: active ? "#e0f2fe" : MUTED,
    fontWeight: 700,
    fontSize: 13.5,
    whiteSpace: "nowrap",
    cursor: "pointer",
    textAlign: "left",
    width: wide ? "100%" : undefined,
  });
  return (
    <div
      style={
        wide
          ? { display: "flex", flexDirection: "column", gap: 6 }
          : {
              display: "flex", gap: 8, overflowX: "auto", padding: "10px 14px",
              position: "sticky", top: 0, zIndex: 4,
              background: "rgba(5,7,13,0.92)", backdropFilter: "blur(10px)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              scrollbarWidth: "none",
            }
      }
    >
      {chips.map((c) => (
        <button key={c.id} style={style(c.id === activeId)} onClick={() => onPick(c.id)}>
          {c.label} <span style={{ opacity: 0.6 }}>&middot; {c.done}/{c.total}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  SCREEN 3 — ONE VERSION, big, draggable
// ─────────────────────────────────────────────────────────────────────────

/**
 * The editable frame. Drag any figure or the ball; the grabbed point stays
 * under the pointer (a rigid translate, not a snap), so the inverse of
 * `projectionFor` has to be exact. A live drag repaints THIS canvas directly,
 * committing to the shared edit store on release.
 */
function EditableFrame({
  cell, baseFrame, override, marks, onCommit, edited,
}: {
  cell: Cell;
  baseFrame: Frame;
  override: PosOverride | undefined;
  marks: Mark[];
  onCommit: (key: string, ov: PosOverride) => void;
  edited: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const workingRef = useRef<PosOverride | null>(null);
  const dragRef = useRef<{ target: "ball" | number; offX: number; offY: number } | null>(null);

  const { cssW, cssH } = frameCssSize(baseFrame);
  const vp = baseFrame.camera;

  const effectiveOverride = (): PosOverride | undefined => workingRef.current ?? override;
  const currentFrame = (): Frame => applyOverride(baseFrame, effectiveOverride());
  const repaint = (live: boolean): void => {
    if (!ref.current) return;
    // Mid-drag the rings would be stale (they are derived from a rebuilt
    // scenario, not the canvas), so the picture drops them and gets them back
    // the instant the drag commits.
    paintMarked(ref.current, currentFrame(), live ? [] : marks);
  };

  useEffect(() => {
    repaint(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, baseFrame, override, marks]);

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
    repaint(true);
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

  return (
    <canvas
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{
        display: "block",
        margin: "0 auto",
        borderRadius: 20,
        background: "#14532d",
        cursor: "grab",
        touchAction: "none",
        border: edited ? "2px solid #38bdf8" : "2px solid rgba(255,255,255,0.06)",
      }}
    />
  );
}

/** One read-only canvas, for the across-formations comparison. */
function MiniFrame({ frame, label, note }: { frame: Frame; label: string; note: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => { if (ref.current) paint(ref.current, frame); }, [frame]);
  return (
    <div style={{ background: CARD, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 8 }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: INK }}>{label}</div>
      <div style={{ color: MUTED, fontSize: 10.5, marginBottom: 6 }}>{note}</div>
      <canvas ref={ref} style={{ display: "block", borderRadius: 10, background: "#14532d", width: "100%", height: "auto" }} />
    </div>
  );
}

/** THE FORMATION TRANSFORM, per scenario — desktop only. The same base
 *  scenario, edits and all, against a back-three, a back-four and a back-five. */
function FormationStrip({ cell, override }: { cell: Cell; override: PosOverride | undefined }) {
  const [playstyleId, setPlaystyleId] = useState<Playstyle>("mid-block");
  const [matchupId, setMatchupId] = useState("even");
  const matchup = MATCHUPS.find((m) => m.id === matchupId) ?? MATCHUPS[0];
  const shapes = APPLY_SHAPE_KINDS.has(cell.kind);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 12, color: "#fb923c" }}>Across formations</span>
        <select
          value={playstyleId}
          onChange={(e) => setPlaystyleId(e.target.value as Playstyle)}
          style={SELECT_STYLE}
        >
          {Object.values(PLAYSTYLES).map((ps) => (
            <option key={ps.id} value={ps.id}>{ps.name}</option>
          ))}
        </select>
        <select value={matchupId} onChange={(e) => setMatchupId(e.target.value)} style={SELECT_STYLE}>
          {MATCHUPS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </div>
      {!shapes && (
        <div style={{ color: "#fbbf24", fontSize: 11.5, fontWeight: 700, marginBottom: 10, lineHeight: 1.45 }}>
          The positional layer doesn&rsquo;t own this kind — these three differ only in WHO is cast into
          each shirt, not where anyone stands.
        </div>
      )}
      <div style={{ display: "grid", gap: 10 }}>
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

// Strength matchup presets → (yourStrength, oppStrength) for the positional layer.
const MATCHUPS: { id: string; label: string; atk: number; def: number }[] = [
  { id: "even", label: "Even (70v70)", atk: 70, def: 70 },
  { id: "you-strong", label: "You stronger (90v55)", atk: 90, def: 55 },
  { id: "you-weak", label: "You weaker (55v90)", atk: 55, def: 90 },
];

const SELECT_STYLE: React.CSSProperties = {
  background: "#0b1220",
  color: INK,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  padding: "5px 9px",
  fontSize: 12,
  fontWeight: 700,
};

// ─────────────────────────────────────────────────────────────────────────
//  PAGE
// ─────────────────────────────────────────────────────────────────────────

type Screen = "home" | "eleven" | "five" | "builder" | "version";

export default function StarGalleryDevPage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [game, setGame] = useState<"eleven" | "five">("eleven");
  const [kindId, setKindId] = useState<string>("one_on_one");
  const [fiveId, setFiveId] = useState<string>("defensive");
  const [versionIdx, setVersionIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wide, setWide] = useState(false);

  // This is a full-screen dev tool, so the site's own nav/footer are hidden
  // the same way /star-dev already hides them (globals.css's immersive class).
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Edits ──
  const [edits, setEdits] = useState<EditStore>({});
  useEffect(() => {
    const loaded = loadEdits();
    if (Object.keys(loaded).length) setEdits(loaded);
  }, []);

  const setOverride = useCallback((key: string, ov: PosOverride) => {
    setEdits((prev) => {
      let next: EditStore;
      if (hasEdits(ov)) next = { ...prev, [key]: ov };
      else { next = { ...prev }; delete next[key]; }
      saveEdits(next);
      return next;
    });
  }, []);
  const clearOverride = useCallback((key: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      saveEdits(next);
      return next;
    });
  }, []);

  // ── Reviews (local for now; see lib/star/scenarioReview.ts) ──
  const [reviews, setReviews] = useState<ReviewStore>({});
  useEffect(() => {
    const loaded = loadReviews();
    if (Object.keys(loaded).length) setReviews(loaded);
  }, []);
  const setVerdict = useCallback((cell: Cell, verdict: ReviewVerdict | null) => {
    setReviews((prev) => {
      const next = { ...prev };
      if (verdict === null) delete next[cell.key];
      else next[cell.key] = { key: cell.key, game: cell.game, kind: cell.kind, seed: cell.seed, verdict, at: Date.now() };
      saveReviews(next);
      return next;
    });
  }, []);

  // ── Saved base scenarios ──
  const [saved, setSaved] = useState<Record<string, MatchScenario>>({});
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [commitBlocked, setCommitBlocked] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "reverting" | "committing" | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

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
    });
  }, []);

  const flashFor = (ok: boolean, text: string) => {
    setFlash({ ok, text });
    window.setTimeout(() => setFlash(null), 6000);
  };

  /** "Saved" only ever means the SERVER said so. */
  const saveCell = async (cell: Cell, frame: Frame): Promise<void> => {
    setBusy("saving");
    const scenario = frameToMatchScenario(cell, frame);
    const res = await saveScenarioShared(scenario);
    setBusy(null);
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) { flashFor(false, `Not saved — ${res.message}`); return; }
    setSaved((m) => ({ ...m, [cell.key]: scenario }));
    clearOverride(cell.key);
    flashFor(true, "Saved — on every device.");
  };

  const revertCell = async (cell: Cell): Promise<void> => {
    setBusy("reverting");
    const res = await deleteScenarioShared(gallerySlug(cell.key));
    setBusy(null);
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) { flashFor(false, `Not reverted — ${res.message}`); return; }
    setSaved((m) => { const next = { ...m }; delete next[cell.key]; return next; });
    clearOverride(cell.key);
    flashFor(true, "Back to the built-in scenario.");
  };

  /** Nothing here is optimistic — a missing GITHUB_TOKEN, a refused token or
   *  two lost races all land in the same red line, quoting the server. */
  const commitCell = async (cell: Cell, frame: Frame): Promise<void> => {
    setBusy("committing");
    const scenario = frameToMatchScenario(cell, frame);
    let res: Response;
    try {
      res = await fetch("/api/star/scenarios/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
    } catch {
      setBusy(null);
      flashFor(false, "Not committed — couldn't reach the server.");
      return;
    }
    const body = await res.json().catch(() => ({})) as
      { ok?: boolean; error?: string; message?: string; commitSha?: string };
    setBusy(null);
    if (!res.ok || body.ok !== true) {
      const why = body.error ?? `the server refused it (${res.status}).`;
      if (res.status === 503) setCommitBlocked(why);
      flashFor(false, `Not committed — ${why}`);
      return;
    }
    flashFor(true, body.message ?? "Committed.");
  };

  // ── What the home-screen dot is about ──
  const warning = migrationMissing
    ? "Saving is off — run supabase/migrations/star_scenarios.sql in the Supabase SQL Editor. You can still drag and export."
    : commitBlocked
      ? `Commit to repo is off — ${commitBlocked}`
      : null;

  // ── The versions currently in view ──
  const versions: Cell[] = useMemo(
    () => (game === "eleven" ? elevenVersions(kindId as ScenarioKind) : fiveVersions(fiveId)),
    [game, kindId, fiveId],
  );
  const activeGroupId = game === "eleven" ? kindId : fiveId;

  const chips = useMemo(() => {
    if (game === "eleven") {
      return KIND_ORDER.map((k) => {
        const keys = seedsForKind(k).map((s) => cellKeyFor(k, s));
        return { id: k, label: kindLabel(k), done: reviewedCount(reviews, keys), total: keys.length };
      });
    }
    return FIVE_GROUPS.map((g) => {
      const keys = fiveVersions(g.id).map((c) => c.key);
      return { id: g.id, label: g.label, done: reviewedCount(reviews, keys), total: keys.length };
    });
  }, [game, reviews]);

  const openGroup = (g: "eleven" | "five") => { setGame(g); setScreen(g); };
  const openVersion = (i: number) => { setVersionIdx(i); setScreen("version"); };

  const cell = versions[Math.min(versionIdx, versions.length - 1)];

  // ── Chrome ──
  const header = (title: string, back: () => void, right?: React.ReactNode) => (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        position: "sticky", top: 0, zIndex: 6,
        background: "rgba(5,7,13,0.94)", backdropFilter: "blur(10px)",
      }}
    >
      <button
        onClick={back}
        style={{
          width: 34, height: 34, borderRadius: 999, flex: "none",
          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)",
          color: INK, fontSize: 17, fontWeight: 800, cursor: "pointer", lineHeight: 1,
        }}
      >
        &#8249;
      </button>
      <div style={{ fontSize: 19, fontWeight: 800, color: INK, letterSpacing: "-0.01em", flex: 1, minWidth: 0 }}>
        {title}
      </div>
      {right}
    </div>
  );

  const shell = (children: React.ReactNode, lock: boolean) => (
    <main
      style={{
        background: BG, color: INK, minHeight: "100dvh",
        ...(lock ? { height: "100dvh", overflow: "hidden" } : {}),
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
      }}
    >
      {children}
    </main>
  );

  // ── HOME ──
  if (screen === "home") {
    return shell(<HomeScreen onOpen={(s) => (s === "builder" ? setScreen("builder") : openGroup(s))} warning={warning} />, true);
  }

  // ── BUILDER ──
  if (screen === "builder") {
    return shell(
      <>
        {header("Scenario Builder", () => setScreen("home"))}
        <div style={{ padding: 10 }}>
          <ScenarioEditor />
        </div>
      </>,
      false,
    );
  }

  // ── GRID ──
  if (screen === "eleven" || screen === "five") {
    const grid = (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: wide ? "repeat(auto-fill, minmax(170px, 1fr))" : "1fr 1fr",
          gap: 12,
          padding: 14,
        }}
      >
        {versions.map((c, i) => (
          <Thumb
            key={c.key}
            cell={c}
            override={edits[c.key]}
            saved={saved[c.key]}
            verdict={reviews[c.key]?.verdict}
            onOpen={() => openVersion(i)}
          />
        ))}
      </div>
    );
    return shell(
      <>
        {header(game === "eleven" ? "11-a-side" : "5-a-side", () => setScreen("home"))}
        {wide ? (
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", alignItems: "start" }}>
            <div style={{ padding: 14, position: "sticky", top: 58 }}>
              <ChipRow chips={chips} activeId={activeGroupId} onPick={game === "eleven" ? setKindId : setFiveId} wide />
            </div>
            {grid}
          </div>
        ) : (
          <>
            <ChipRow chips={chips} activeId={activeGroupId} onPick={game === "eleven" ? setKindId : setFiveId} wide={false} />
            {grid}
          </>
        )}
      </>,
      false,
    );
  }

  // ── VERSION ──
  if (!cell) return shell(<div style={{ padding: 20 }}>No versions.</div>, false);

  const savedScenario = saved[cell.key];
  const savedOv = savedScenario ? overrideFromMatchScenario(savedScenario) : undefined;
  const override = edits[cell.key];
  const edited = hasEdits(override);
  const baseFrame = applyOverride(cell.frame, savedOv);
  const liveFrame = applyOverride(baseFrame, override);
  const analysis = liveAnalysis(cell, [savedOv, override]);
  const verdict = reviews[cell.key]?.verdict;
  const canSave = cell.game === "eleven";

  const go = (d: number) => {
    setVersionIdx((i) => (i + d + versions.length) % versions.length);
    setSheetOpen(false);
  };

  const bigBtn = (bg: string, border: string, color: string): React.CSSProperties => ({
    flex: 1, height: 54, borderRadius: 16, border: `1px solid ${border}`,
    background: bg, color, fontSize: 19, fontWeight: 800, cursor: "pointer",
    display: "grid", placeItems: "center",
  });
  const sheetBtn: React.CSSProperties = {
    width: "100%", padding: "14px 16px", borderRadius: 14, textAlign: "left",
    border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.05)",
    color: INK, fontSize: 15, fontWeight: 700, cursor: "pointer",
  };

  const pane = (
    <div style={{ padding: "12px 14px 24px" }}>
      <div style={{ position: "relative" }}>
        <EditableFrame
          cell={cell}
          baseFrame={baseFrame}
          override={override}
          marks={analysis.marks}
          onCommit={setOverride}
          edited={edited}
        />
        {versions.length > 1 && (
          <>
            <button onClick={() => go(-1)} style={arrowStyle("left")}>&#8249;</button>
            <button onClick={() => go(1)} style={arrowStyle("right")}>&#8250;</button>
          </>
        )}
      </div>

      {analysis.faults.length > 0 && (
        <div style={{ color: "#f87171", fontSize: 13.5, fontWeight: 700, marginTop: 10, textAlign: "center", lineHeight: 1.4 }}>
          {analysis.faults[0]}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "14px 0 12px" }}>
        {versions.map((v, i) => (
          <button
            key={v.key}
            onClick={() => setVersionIdx(i)}
            aria-label={`version ${i + 1}`}
            style={{
              width: i === versionIdx ? 20 : 7, height: 7, borderRadius: 999, padding: 0,
              border: "none", cursor: "pointer",
              background: i === versionIdx ? "#38bdf8" : "rgba(255,255,255,0.22)",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setVerdict(cell, verdict === "rejected" ? null : "rejected")}
          style={bigBtn(verdict === "rejected" ? "#7f1d1d" : "rgba(255,255,255,0.05)", verdict === "rejected" ? "#ef4444" : "rgba(255,255,255,0.09)", verdict === "rejected" ? "#fecaca" : MUTED)}
        >
          &#10005;
        </button>
        <button
          onClick={() => {
            if (edited && canSave) void saveCell(cell, liveFrame);
            setVerdict(cell, "approved");
          }}
          style={{
            ...bigBtn(
              verdict === "approved" ? "#14532d" : "rgba(255,255,255,0.05)",
              verdict === "approved" ? "#22c55e" : "rgba(255,255,255,0.09)",
              verdict === "approved" ? "#bbf7d0" : MUTED,
            ),
            flex: edited && canSave ? 2.2 : 1,
            fontSize: edited && canSave ? 15 : 19,
          }}
        >
          {edited && canSave ? (busy === "saving" ? "Saving…" : "Save & Approve") : "✓"}
        </button>
        <button
          onClick={() => setSheetOpen(true)}
          style={bigBtn("rgba(255,255,255,0.05)", "rgba(255,255,255,0.09)", MUTED)}
        >
          &#8943;
        </button>
      </div>

      {flash && (
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, textAlign: "center", color: flash.ok ? "#4ade80" : "#fca5a5" }}>
          {flash.text}
        </div>
      )}
    </div>
  );

  return shell(
    <>
      {header(
        `${game === "eleven" ? kindLabel(cell.kind) : (FIVE_GROUPS.find((g) => g.id === fiveId)?.label ?? "")}`,
        () => setScreen(game),
        <span style={{ color: MUTED, fontSize: 13, fontWeight: 700, flex: "none" }}>
          {versionIdx + 1} / {versions.length}
        </span>,
      )}
      {wide ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)", gap: 16, padding: "0 14px 24px", alignItems: "start" }}>
          {pane}
          <div style={{ padding: "12px 0 24px" }}>
            {cell.game === "eleven" && <FormationStrip cell={cell} override={override} />}
          </div>
        </div>
      ) : pane}

      {sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(2,4,10,0.65)", zIndex: 20, display: "flex", alignItems: "flex-end" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", background: "#0c1220", borderTopLeftRadius: 24, borderTopRightRadius: 24,
              padding: 14, display: "grid", gap: 8,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.2)", margin: "2px auto 8px" }} />
            {canSave && (
              <>
                <button style={sheetBtn} disabled={!!busy} onClick={() => { setSheetOpen(false); void saveCell(cell, liveFrame); }}>
                  {busy === "saving" ? "Saving…" : "Save"}
                </button>
                <button
                  style={{ ...sheetBtn, opacity: savedScenario ? 1 : 0.4 }}
                  disabled={!savedScenario || !!busy}
                  onClick={() => { setSheetOpen(false); void revertCell(cell); }}
                >
                  {busy === "reverting" ? "Reverting…" : "Revert to built-in"}
                </button>
                <button style={sheetBtn} disabled={!!busy} onClick={() => { setSheetOpen(false); void commitCell(cell, liveFrame); }}>
                  {busy === "committing" ? "Committing…" : "Commit to repo"}
                </button>
              </>
            )}
            <button
              style={sheetBtn}
              onClick={() => {
                void copyText(JSON.stringify(exportRecord(cell, liveFrame), null, 2));
                setSheetOpen(false);
                flashFor(true, "JSON copied.");
              }}
            >
              Export JSON
            </button>
            {edited && (
              <button style={sheetBtn} onClick={() => { clearOverride(cell.key); setSheetOpen(false); }}>
                Discard unsaved edits
              </button>
            )}
            <button style={{ ...sheetBtn, textAlign: "center", color: MUTED }} onClick={() => setSheetOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>,
    false,
  );
}

function arrowStyle(side: "left" | "right"): React.CSSProperties {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    [side]: 16,
    width: 38,
    height: 56,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(2,4,10,0.78)",
    color: "#e6edf7",
    fontSize: 22,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1,
    zIndex: 3,
  } as React.CSSProperties;
}
