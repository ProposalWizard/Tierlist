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
import {
  nextSim,
  newSimMemory,
  buildSimScenario,
  simFaults,
  pictureKey,
  type SimSpec,
} from "@/lib/star/gallerySim";
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
    items.push({ at: { x: sc.follower.x, y: sc.follower.y }, look: { ...MATE, label: idLabel(sc.follower.who, "POACH") }, side: "teammate" });
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
function computeOffside(frame: Frame): number | null {
  if (!frame.offsideFrom) return null;
  const ys = frame.items.filter((it) => it.side === "opponent").map((it) => it.at.y);
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

interface Mark { at: Vec2; ball?: boolean; tone: "red" | "amber" | "select" }

const MARK_INK: Record<Mark["tone"], string> = {
  red: "rgba(239,68,68,0.95)",
  amber: "rgba(245,158,11,0.95)",
  select: "rgba(56,189,248,0.98)",
};

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
  /** Present only on a SIMULATED cell — the chance the game rolled, kept so
   *  the picture is rebuilt exactly rather than re-rolled. */
  sim?: SimSpec;
}

/** Fixed seeds per kind, so a picture is identical on every refresh.
 *  The FIRST is the gallery's original seed for that kind (1000 + its index),
 *  which keeps every already-saved scenario and already-dragged edit pointing
 *  at the same version it always did. Every version after the tenth follows
 *  the same arithmetic, so "+ Add version" appends rather than reshuffles. */
const DEFAULT_VERSIONS_PER_KIND = 10;
const MAX_VERSIONS_PER_KIND = 60;
function seedsForKind(kind: ScenarioKind, count = DEFAULT_VERSIONS_PER_KIND): number[] {
  const i = SCENARIO_KINDS.indexOf(kind);
  const base = 1000 + i;
  const rest: number[] = [];
  for (let k = 1; k < Math.max(1, count); k++) rest.push(7000 + i * 100 + k);
  return [base, ...rest];
}
function cellKeyFor(kind: ScenarioKind, seed: number): string {
  const base = 1000 + SCENARIO_KINDS.indexOf(kind);
  return seed === base ? `main-${kind}` : `v-${kind}-${seed}`;
}

/** HOW MANY versions each kind shows. Grows by one per "+ Add version" and is
 *  remembered, so the grid a person builds up is still there next time. */
const COUNT_KEY = "star-gallery-version-counts-v1";
type CountStore = Record<string, number>;
function loadCounts(): CountStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(COUNT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as CountStore) : {};
  } catch { return {}; }
}
function saveCounts(store: CountStore): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(COUNT_KEY, JSON.stringify(store)); } catch { /* dev tool */ }
}

/** The scenario a cell stands for, rebuilt from scratch — a base version from
 *  its seed, a simulated one from its spec. One place, so the picture, the
 *  fault rings and the formation strip can never be looking at different
 *  scenarios. */
function rebuildScenario(cell: Cell): Scenario {
  if (cell.sim) return buildSimScenario(cell.sim);
  const sc = buildScenario(cell.kind as ScenarioKind, mulberry32(cell.seed ?? 0));
  fixBaseScenario(sc);
  return sc;
}

/** A BASE SCENARIO: the canonical situation straight from the real builder at
 *  a fixed seed, CORRECTED by `fixBaseScenario`, with no formation layer. */
function buildCell(kind: ScenarioKind, seed: number): Cell {
  const cell: Cell = {
    key: cellKeyFor(kind, seed),
    kind,
    seed,
    game: "eleven",
    frame: { } as Frame,
    title: kind,
  };
  cell.frame = frameFromScenario(rebuildScenario(cell));
  return cell;
}

/** A SIMULATED cell — one press of Simulate, as a cell the rest of the screen
 *  treats exactly like any other: draggable, fault-ringed, savable. */
function simCell(spec: SimSpec): Cell {
  const cell: Cell = {
    key: `sim-${spec.kind}-${spec.seed}`,
    kind: spec.kind,
    seed: spec.seed,
    game: "eleven",
    frame: { } as Frame,
    title: `${spec.kind} (sim)`,
    sim: spec,
  };
  cell.frame = frameFromScenario(rebuildScenario(cell));
  return cell;
}

// Built once per kind and kept — the builders are pure at a fixed seed, so
// rebuilding them on every render would be work for an identical picture.
const ELEVEN_CACHE = new Map<string, Cell[]>();
function elevenVersions(kind: ScenarioKind, count = DEFAULT_VERSIONS_PER_KIND): Cell[] {
  const ck = `${kind}:${count}`;
  const hit = ELEVEN_CACHE.get(ck);
  if (hit) return hit;
  const cells = seedsForKind(kind, count).map((s) => buildCell(kind, s));
  ELEVEN_CACHE.set(ck, cells);
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
  const sc = rebuildScenario(cell);
  applyOverrideToScenario(sc, mergeOverrides(overrides));
  // A simulated picture is judged by `planFaults` (chanceFormula.ts), which is
  // `scenarioFaults` plus the camera's own rules — the same judgement the
  // formula's own harness makes. A base version has no plan and is judged by
  // `scenarioFaults` alone, exactly as before.
  const raw = cell.sim ? simFaults(sc, cell.sim.planId) : scenarioFaults(sc);
  const split = splitFaults(cell.kind, raw);
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
  const at = (i: number) => ov!.items[String(i)];
  const gone = new Set(ov!.removed ?? []);
  const isGone = (i: number) => gone.has(String(i));

  // Which base index each part of the scenario occupies — the same walk
  // `frameFromScenario` does, recorded as it goes so a removal knows which
  // array to splice.
  const defIdx: number[] = [];
  const secIdx: number[] = [];
  const mateIdx: number[] = [];
  let runnerIdx = -1;

  let i = 0;
  for (const d of sc.defenders) { defIdx.push(i); const p = at(i++); if (p) { d.x = p.x; d.y = p.y; } }
  { const p = at(i++); if (p) { sc.keeper.x = p.x; sc.keeper.y = p.y; } }
  if (sc.runner) { runnerIdx = i; const p = at(i++); if (p) { sc.runner.pos.x = p.x; sc.runner.pos.y = p.y; } }
  for (const r of sc.secondaryRunners) { secIdx.push(i); const p = at(i++); if (p) { r.pos.x = p.x; r.pos.y = p.y; } }
  if (goalInView(sc.kind)) { const p = at(i++); if (p) { sc.follower.x = p.x; sc.follower.y = p.y; } }
  for (const t of sc.teammates) { mateIdx.push(i); const p = at(i++); if (p) { t.x = p.x; t.y = p.y; } }
  { const p = at(i++); if (p) { sc.player.x = p.x; sc.player.y = p.y; } }
  if (ov!.ball) { sc.ball.x = ov!.ball.x; sc.ball.y = ov!.ball.y; }

  // ── Figures taken OUT ──
  // Descending, so an earlier splice never shifts a later one. Only the
  // arrays a body can honestly be removed from: the keeper, the poacher and
  // you are not offered as removable in the editor, so they are never here.
  for (let k = mateIdx.length - 1; k >= 0; k--) if (isGone(mateIdx[k])) sc.teammates.splice(k, 1);
  for (let k = secIdx.length - 1; k >= 0; k--) if (isGone(secIdx[k])) sc.secondaryRunners.splice(k, 1);
  if (runnerIdx >= 0 && isGone(runnerIdx)) { sc.runner = null; sc.passTarget = null; }
  for (let k = defIdx.length - 1; k >= 0; k--) if (isGone(defIdx[k])) sc.defenders.splice(k, 1);

  // ── Figures put IN ──
  // An opponent becomes a real defender, so the offside line and every fault
  // rule genuinely count him. A team-mate becomes one of `sc.teammates` — the
  // decorative bodies a crosser or a box-filler already is — deliberately NOT
  // a runner, because a runner is a PASS TARGET and adding one would change
  // what the chance is, not just who is standing in it.
  for (const a of ov!.added ?? []) {
    const p = ov!.items[a.id];
    if (!p || gone.has(a.id)) continue;
    if (a.side === "opponent") sc.defenders.push({ x: p.x, y: p.y, role: "hold", baseRole: "hold" });
    else if (a.side === "teammate") sc.teammates.push({ x: p.x, y: p.y });
  }
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
  const sc = rebuildScenario(cell);
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
    // `i0`, `i1`, … for the builder's own figures (the exact ids this has
    // always written, so a scenario saved before the editor could add or
    // remove anyone still loads), `iadd1`, `iadd2`, … for added ones. A
    // builder figure that was REMOVED is simply not in the list, which is how
    // a removal survives a save.
    players: frame.items.map((it) => ({
      id: `i${it.id}`,
      side: it.side,
      x: round2(it.at.x),
      y: round2(it.at.y),
      label: it.look.label,
    })),
    updatedAt: Date.now(),
    source: { tool: "gallery", kind: cell.kind, seed: cell.seed, planId: cell.sim?.planId ?? null },
  };
}

/** The saved positions, back as the gallery's own index-keyed override — so a
 *  saved scenario is applied through the exact same path a live drag is. */
function overrideFromMatchScenario(ms: MatchScenario, baseCount: number): PosOverride {
  const items: Record<string, Vec2> = {};
  const added: { id: string; side: ScenarioSide }[] = [];
  const seenBase = new Set<string>();
  ms.players.forEach((p, i) => {
    const id = p.id.startsWith("i") ? p.id.slice(1) : String(i);
    items[id] = { x: p.x, y: p.y };
    if (/^\d+$/.test(id)) seenBase.add(id);
    else added.push({ id, side: p.side });
  });
  // Any builder figure the saved picture does not contain was taken out in
  // the editor — the absence IS the removal.
  const removed: string[] = [];
  for (let i = 0; i < baseCount; i++) if (!seenBase.has(String(i))) removed.push(String(i));
  return {
    items,
    ball: { x: ms.ball.x, y: ms.ball.y },
    removed: removed.length ? removed : undefined,
    added: added.length ? added : undefined,
  };
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
      id: it.id,
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
  const items: Omit<Item, "id">[] = [];
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
  return { rules: FIVE_A_SIDE, camera: FIVE_A_SIDE.view, goalAtY: 0, offsideY: null, offsideFrom: null, items: items.map((it, i) => ({ ...it, id: String(i) })), ball };
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
  const items: Omit<Item, "id">[] = [];
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
  return { rules: FIVE_A_SIDE, camera: FIVE_A_SIDE.view, goalAtY: 0, offsideY: null, offsideFrom: null, items: items.map((it, i) => ({ ...it, id: String(i) })), ball };
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

/**
 * A per-cell set of editor changes.
 *
 * `items` is keyed by `Item.id` — `"0"`, `"1"`, … for a figure the builder
 * made (the same numbers this store has always used, so every edit already on
 * disk still reads), `"add1"`, `"add2"`, … for one added here. Keying by
 * identity rather than array position is what lets a figure be removed without
 * shifting every later figure's edit onto the wrong man.
 */
interface PosOverride {
  items: Record<string, Vec2>;
  ball?: Vec2;
  /** Item ids hidden — a defender taken out of the picture. */
  removed?: string[];
  /** Figures put INTO the picture. Their position lives in `items`, same as
   *  everyone else's, so a new figure is dragged and saved by exactly the
   *  same path a built-in one is. */
  added?: { id: string; side: ScenarioSide }[];
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
  return !!ov && (
    Object.keys(ov.items).length > 0
    || !!ov.ball
    || !!ov.removed?.length
    || !!ov.added?.length
  );
}

function cloneOverride(ov: PosOverride | undefined): PosOverride {
  const items: Record<string, Vec2> = {};
  if (ov) for (const k of Object.keys(ov.items)) items[k] = { ...ov.items[k] };
  return {
    items,
    ball: ov?.ball ? { ...ov.ball } : undefined,
    removed: ov?.removed ? [...ov.removed] : undefined,
    added: ov?.added ? ov.added.map((a) => ({ ...a })) : undefined,
  };
}

const lookFor = (side: ScenarioSide): Omit<FigureLook, "label" | "star"> =>
  side === "opponent" ? OPP : side === "you" ? YOU : MATE;

/**
 * A paint-ready frame with the editor's changes applied over the builder's.
 *
 * Applied in one pass, by id: a removed figure drops out, a moved one moves,
 * and an added one is appended. Composes — the saved scenario is applied
 * first and a live drag on top of it, and because everything is keyed by id
 * the second pass can move or remove a figure the first pass added.
 */
function applyOverride(frame: Frame, ov: PosOverride | undefined): Frame {
  if (!hasEdits(ov)) return frame;
  const gone = new Set(ov!.removed ?? []);
  const items: Item[] = [];
  for (const it of frame.items) {
    if (gone.has(it.id)) continue;
    items.push(ov!.items[it.id] ? { ...it, at: { ...ov!.items[it.id] } } : it);
  }
  const present = new Set(items.map((it) => it.id));
  for (const a of ov!.added ?? []) {
    if (gone.has(a.id) || present.has(a.id)) continue;
    const at = ov!.items[a.id];
    if (!at) continue;
    items.push({
      id: a.id,
      at: { ...at },
      look: { ...lookFor(a.side), label: a.side === "opponent" ? "OPP" : "MATE" },
      side: a.side,
      removable: true,
    });
  }
  const ball = ov!.ball ? { ...ov!.ball } : frame.ball;
  return { ...frame, items, ball };
}

/**
 * Where a newly added figure goes: the emptiest sensible spot inside the frame.
 *
 * Candidates are a fixed grid inset from the camera's own edges (so nobody is
 * ever dropped half off screen), scored on how far they are from everyone
 * already standing there, with a pull toward the part of the pitch that side
 * belongs in — an opponent between the ball and the goal he is defending, a
 * team-mate alongside the ball. Deterministic: the same picture and the same
 * side always put him in the same place.
 */
function freeSpotFor(frame: Frame, side: ScenarioSide): Vec2 {
  const vp = frame.camera;
  // Enough room that his NAME, drawn above his head, is inside the frame too.
  const inset = 3.2;
  const x1 = vp.x1 + inset, x2 = vp.x2 - inset;
  const y1 = vp.y1 + inset, y2 = vp.y2 - inset;
  const goalY = frame.goalAtY ?? y1;
  const wantY = side === "opponent"
    ? (frame.ball.y + goalY) / 2
    : frame.ball.y - (frame.ball.y - goalY) * 0.25;

  let best: Vec2 = { x: (x1 + x2) / 2, y: wantY };
  let bestScore = -Infinity;
  const COLS = 7, ROWS = 9;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const at = {
        x: x1 + ((x2 - x1) * (c + 0.5)) / COLS,
        y: y1 + ((y2 - y1) * (r + 0.5)) / ROWS,
      };
      let near = Math.hypot(at.x - frame.ball.x, at.y - frame.ball.y);
      for (const it of frame.items) {
        near = Math.min(near, Math.hypot(at.x - it.at.x, at.y - it.at.y));
      }
      // Room first, then the right part of the pitch for his own shirt.
      const score = Math.min(near, 6) * 2 - Math.abs(at.y - wantY) * 0.35;
      if (score > bestScore) { bestScore = score; best = at; }
    }
  }
  return best;
}

/**
 * Two sets of changes as one.
 *
 * The saved scenario and a live drag on top of it are separate overrides, and
 * `applyOverrideToScenario` walks the scenario's own arrays as it goes — so
 * applying them one after another would have the SECOND walk counting a back
 * line the FIRST had already added to or spliced, and putting every edit after
 * that on the wrong man. Merged first, there is only ever one walk.
 */
function mergeOverrides(ovs: (PosOverride | undefined)[]): PosOverride | undefined {
  const real = ovs.filter((o): o is PosOverride => hasEdits(o));
  if (real.length === 0) return undefined;
  if (real.length === 1) return real[0];
  const items: Record<string, Vec2> = {};
  const removed = new Set<string>();
  const added: { id: string; side: ScenarioSide }[] = [];
  let ball: Vec2 | undefined;
  for (const ov of real) {
    for (const k of Object.keys(ov.items)) items[k] = { ...ov.items[k] };
    for (const r of ov.removed ?? []) removed.add(r);
    for (const a of ov.added ?? []) if (!added.some((x) => x.id === a.id)) added.push({ ...a });
    if (ov.ball) ball = { ...ov.ball };
  }
  return {
    items,
    ball,
    removed: removed.size ? Array.from(removed) : undefined,
    added: added.length ? added : undefined,
  };
}

/** The next free `add…` id for a cell, given everything already on it. */
function nextAddedId(ovs: (PosOverride | undefined)[]): string {
  let max = 0;
  for (const ov of ovs) {
    for (const a of ov?.added ?? []) {
      const n = Number(a.id.replace(/^add/, ""));
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `add${max + 1}`;
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
function fillCanvas(c: HTMLCanvasElement): void {
  c.style.width = "100%";
  c.style.height = "100%";
  c.style.objectFit = "cover";
  c.style.display = "block";
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Point a `cover` crop at where the football actually is.
 *
 * A home tile is a wide letterbox cut out of a tall portrait frame, and each
 * kind frames its camera differently — a fixed crop would show midfield grass
 * for one kind and cut the box off for another. So the crop is aimed at the
 * frame's own centre of action (every figure, plus the ball), solved through
 * object-position's real geometry rather than guessed.
 */
function focusCanvas(c: HTMLCanvasElement, frame: Frame): void {
  const box = c.parentElement;
  const boxW = box?.clientWidth ?? 0;
  const boxH = box?.clientHeight ?? 0;
  if (!boxW || !boxH) { c.style.objectPosition = "center"; return; }
  const { cssW, cssH } = frameCssSize(frame);
  const scale = Math.max(boxW / cssW, boxH / cssH);
  const sW = cssW * scale, sH = cssH * scale;

  let tx = frame.ball.x, ty = frame.ball.y, n = 1;
  for (const it of frame.items) { tx += it.at.x; ty += it.at.y; n++; }
  tx /= n; ty /= n;

  const fx = (tx - frame.camera.x1) / (frame.camera.x2 - frame.camera.x1);
  const fy = (ty - frame.camera.y1) / (frame.camera.y2 - frame.camera.y1);
  const px = sW > boxW + 0.5 ? clamp01((fx * sW - boxW / 2) / (sW - boxW)) : 0.5;
  const py = sH > boxH + 0.5 ? clamp01((fy * sH - boxH / 2) / (sH - boxH)) : 0.5;
  c.style.objectPosition = `${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%`;
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
    fillCanvas(ref.current);
    focusCanvas(ref.current, frame);
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
          background: "linear-gradient(180deg, rgba(3,6,14,0.30) 0%, rgba(3,6,14,0.05) 38%, rgba(3,6,14,0.72) 78%, rgba(3,6,14,0.95) 100%)",
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
  onOpen, warning, wide,
}: { onOpen: (s: "eleven" | "five" | "builder") => void; warning: string | null; wide: boolean }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const tiles = useMemo(
    () => [
      { word: "11-a-side", frame: elevenVersions("one_on_one")[0].frame, go: "eleven" as const },
      { word: "5-a-side", frame: fiveVersions("defensive")[0].frame, go: "five" as const },
      { word: "Scenario Builder", frame: elevenVersions("free_kick")[0].frame, go: "builder" as const },
    ],
    [],
  );
  return (
    <div
      style={{
        position: "relative", height: "100%", display: "flex",
        flexDirection: wide ? "row" : "column", gap: wide ? 18 : 12, padding: wide ? 24 : 14,
      }}
    >
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
  const savedOv = saved ? overrideFromMatchScenario(saved, cell.frame.items.length) : undefined;
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
  cell, baseFrame, override, marks, onCommit, edited, selectedId, onSelect,
}: {
  cell: Cell;
  baseFrame: Frame;
  override: PosOverride | undefined;
  marks: Mark[];
  onCommit: (key: string, ov: PosOverride) => void;
  edited: boolean;
  /** Which figure is tapped, for the add/remove controls under the picture. */
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const workingRef = useRef<PosOverride | null>(null);
  const dragRef = useRef<{ target: "ball" | string; offX: number; offY: number } | null>(null);

  const { cssW, cssH } = frameCssSize(baseFrame);
  const vp = baseFrame.camera;

  const effectiveOverride = (): PosOverride | undefined => workingRef.current ?? override;
  const currentFrame = (): Frame => applyOverride(baseFrame, effectiveOverride());
  const repaint = (live: boolean): void => {
    if (!ref.current) return;
    const frame = currentFrame();
    const sel = frame.items.find((it) => it.id === selectedId);
    const ring: Mark[] = sel ? [{ at: { ...sel.at }, tone: "select" }] : [];
    // Mid-drag the fault rings would be stale (they are derived from a rebuilt
    // scenario, not the canvas), so the picture drops them and gets them back
    // the instant the drag commits. The selection ring stays — it is the thing
    // under your finger.
    paintMarked(ref.current, frame, live ? ring : [...marks, ...ring]);
  };

  useEffect(() => {
    repaint(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, baseFrame, override, marks, selectedId]);

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
  function grabTargetAt(world: Vec2): "ball" | string | null {
    const frame = currentFrame();
    const p = projectionFor(frame.rules, cssW, cssH, frame.camera);
    const r = Math.max(7, p.unit * HIT_FIGURE_R);
    const wx = p.px(world.x), wy = p.py(world.y);
    let best: "ball" | string | null = null;
    let bestD = Infinity;
    frame.items.forEach((it) => {
      const sx = p.px(it.at.x);
      const sy = p.py(it.at.y) - r * HIT_BODY_UP;
      const d = Math.hypot(sx - wx, sy - wy);
      if (d < r * 1.15 && d < bestD) { bestD = d; best = it.id; }
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
    if (target === null) { onSelect(null); return; }
    e.preventDefault();
    onSelect(target === "ball" ? null : target);
    const frame = currentFrame();
    const at = target === "ball" ? frame.ball : frame.items.find((it) => it.id === target)!.at;
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
  useEffect(() => {
    if (!ref.current) return;
    paint(ref.current, frame);
    // `paint` sizes the canvas in real pixels; a comparison tile is whatever
    // width the column gives it, so the px size is traded for a fluid one
    // afterwards (the drawing itself is unaffected — only how it is scaled).
    ref.current.style.width = "100%";
    ref.current.style.height = "auto";
  }, [frame]);
  return (
    <div style={{ background: CARD, border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: 8, minWidth: 0 }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: INK }}>{label}</div>
      <div style={{ color: MUTED, fontSize: 10.5, marginBottom: 6 }}>{note}</div>
      <canvas ref={ref} style={{ display: "block", borderRadius: 10, background: "#14532d" }} />
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
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
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
  /** Which figure is tapped, for the add/remove controls. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /**
   * Across formations is OFF until asked for.
   *
   * Reported directly: "the across formations and the even stronger/weaker
   * stuff right now is kind of irrelevant… it's taking up 60% of the screen
   * and it doesn't actually even work… for now it would make more sense to
   * have that space be the simulate random option or just nothing there."
   * Kept behind a toggle rather than deleted — he wants it back later.
   */
  const [showFormations, setShowFormations] = useState(false);
  /** The simulated chance currently on screen, if Simulate has been pressed. */
  const [sim, setSim] = useState<Cell | null>(null);

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

  // ── How many versions each kind shows ──
  const [counts, setCounts] = useState<CountStore>({});
  useEffect(() => {
    const loaded = loadCounts();
    if (Object.keys(loaded).length) setCounts(loaded);
  }, []);
  const countFor = useCallback(
    (k: string) => Math.max(1, Math.min(MAX_VERSIONS_PER_KIND, counts[k] ?? DEFAULT_VERSIONS_PER_KIND)),
    [counts],
  );
  const addVersion = useCallback((k: string) => {
    setCounts((prev) => {
      const now = Math.max(1, Math.min(MAX_VERSIONS_PER_KIND, prev[k] ?? DEFAULT_VERSIONS_PER_KIND));
      const next = { ...prev, [k]: Math.min(MAX_VERSIONS_PER_KIND, now + 1) };
      saveCounts(next);
      return next;
    });
  }, []);

  /**
   * SIMULATE — one press, one chance, the way the match generates one.
   *
   * The stream is seeded per kind rather than taken from `Math.random`, so the
   * first press on a one-on-one shows the same picture today as tomorrow and
   * anything seen can be got back to. The anti-repeat is `selectChance`'s own
   * memory (lib/star/scenarioSelect.ts), carried between presses — there is
   * one anti-repeat in this codebase and this is not a second one.
   */
  const simStreamRef = useRef<{
    kind: string;
    rng: () => number;
    mem: ReturnType<typeof newSimMemory>;
    last?: string;
  } | null>(null);
  const simulate = useCallback((kind: string) => {
    let st = simStreamRef.current;
    if (!st || st.kind !== kind) {
      st = { kind, rng: mulberry32(90210 + SCENARIO_KINDS.indexOf(kind as ScenarioKind) * 7919), mem: newSimMemory() };
      simStreamRef.current = st;
    }
    const spec = nextSim(kind as ScenarioKind, st.rng, st.mem, st.last);
    const next = simCell(spec);
    st.last = pictureKey(rebuildScenario(next));
    setSim(next);
    setSelectedId(null);
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
    () => (game === "eleven" ? elevenVersions(kindId as ScenarioKind, countFor(kindId)) : fiveVersions(fiveId)),
    [game, kindId, fiveId, countFor],
  );
  const activeGroupId = game === "eleven" ? kindId : fiveId;

  const chips = useMemo(() => {
    if (game === "eleven") {
      return KIND_ORDER.map((k) => {
        const keys = seedsForKind(k, countFor(k)).map((s) => cellKeyFor(k, s));
        return { id: k, label: kindLabel(k), done: reviewedCount(reviews, keys), total: keys.length };
      });
    }
    return FIVE_GROUPS.map((g) => {
      const keys = fiveVersions(g.id).map((c) => c.key);
      return { id: g.id, label: g.label, done: reviewedCount(reviews, keys), total: keys.length };
    });
  }, [game, reviews, countFor]);

  const openGroup = (g: "eleven" | "five") => { setGame(g); setScreen(g); setSim(null); };
  const openVersion = (i: number) => { setVersionIdx(i); setScreen("version"); setSim(null); setSelectedId(null); };

  const baseCell = versions[Math.min(versionIdx, versions.length - 1)];
  // A simulated chance stands in for the version underneath it, so every
  // control on this screen — drag, fault rings, Save, Export — works on it
  // exactly as it works on a built-in version.
  const showingSim = !!sim && game === "eleven" && sim.kind === kindId;
  const cell = showingSim ? sim! : baseCell;

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
    return shell(
      <HomeScreen
        onOpen={(s) => (s === "builder" ? setScreen("builder") : openGroup(s))}
        warning={warning}
        wide={wide}
      />,
      true,
    );
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
          gridTemplateColumns: wide ? "repeat(auto-fill, minmax(230px, 1fr))" : "1fr 1fr",
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
        {game === "eleven" && countFor(kindId) < MAX_VERSIONS_PER_KIND && (
          <button
            onClick={() => addVersion(kindId)}
            style={{
              width: "100%", aspectRatio: "5 / 8", borderRadius: 18, cursor: "pointer",
              border: "1px dashed rgba(255,255,255,0.22)", background: "rgba(255,255,255,0.035)",
              color: MUTED, fontSize: 15, fontWeight: 800, display: "grid", placeItems: "center",
              lineHeight: 1.4,
            }}
          >
            <span style={{ display: "grid", placeItems: "center", gap: 4 }}>
              <span style={{ fontSize: 30, fontWeight: 300, color: INK }}>+</span>
              <span>Add version</span>
            </span>
          </button>
        )}
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
  const savedOv = savedScenario ? overrideFromMatchScenario(savedScenario, cell.frame.items.length) : undefined;
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
    setSim(null);
    setSelectedId(null);
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
  const editBtn = (off: boolean): React.CSSProperties => ({
    flex: 1, height: 42, borderRadius: 13, cursor: off ? "default" : "pointer",
    border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
    color: off ? "rgba(138,151,170,0.45)" : INK, fontSize: 13.5, fontWeight: 700,
  });

  // ── Adding and removing figures ──
  const selectedItem = liveFrame.items.find((it) => it.id === selectedId);
  const canRemove = !!selectedItem?.removable;

  const addFigure = (side: ScenarioSide) => {
    const id = nextAddedId([savedOv, override]);
    const ov = cloneOverride(override);
    ov.items[id] = freeSpotFor(liveFrame, side);
    ov.added = [...(ov.added ?? []), { id, side }];
    setOverride(cell.key, ov);
    setSelectedId(id);
  };

  const removeFigure = (id: string) => {
    const ov = cloneOverride(override);
    if ((ov.added ?? []).some((a) => a.id === id)) {
      // Added and removed in the same sitting — drop him outright rather than
      // leaving a figure on the books that is also on the hidden list.
      ov.added = (ov.added ?? []).filter((a) => a.id !== id);
      delete ov.items[id];
    } else {
      ov.removed = [...(ov.removed ?? []), id];
    }
    setOverride(cell.key, ov);
    setSelectedId(null);
  };

  // ── Simulate, and the formation strip it replaced ──
  const simulatePanel = cell.game === "eleven" ? (
    <div style={{ display: "grid", gap: 8 }}>
      <button
        onClick={() => simulate(kindId)}
        style={{
          width: "100%", height: 54, borderRadius: 16, cursor: "pointer",
          border: "1px solid rgba(56,189,248,0.55)", background: "rgba(14,116,144,0.38)",
          color: "#e0f2fe", fontSize: 17, fontWeight: 800,
        }}
      >
        {showingSim ? "Simulate again" : "Simulate"}
      </button>
      {showingSim && (
        <button
          onClick={() => { setSim(null); setSelectedId(null); }}
          style={{
            width: "100%", height: 40, borderRadius: 13, cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
            color: MUTED, fontSize: 13.5, fontWeight: 700,
          }}
        >
          Back to version {versionIdx + 1}
        </button>
      )}
    </div>
  ) : null;

  const formationPanel = cell.game === "eleven" ? (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setShowFormations((v) => !v)}
        style={{
          width: "100%", height: 40, borderRadius: 13, cursor: "pointer",
          border: "1px solid rgba(255,255,255,0.09)", background: "transparent",
          color: MUTED, fontSize: 13, fontWeight: 700,
        }}
      >
        Across formations {showFormations ? "\u2303" : "\u2304"}
      </button>
      {showFormations && (
        <div style={{ marginTop: 12 }}>
          <FormationStrip cell={cell} override={mergeOverrides([savedOv, override])} />
        </div>
      )}
    </div>
  ) : null;

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
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {!showingSim && versions.length > 1 && (
          <>
            <button onClick={() => go(-1)} style={arrowStyle("left")}>&#8249;</button>
            <button onClick={() => go(1)} style={arrowStyle("right")}>&#8250;</button>
          </>
        )}
      </div>

      {cell.game === "eleven" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={editBtn(false)} onClick={() => addFigure("teammate")}>+ Team-mate</button>
          <button style={editBtn(false)} onClick={() => addFigure("opponent")}>+ Opponent</button>
          <button
            style={editBtn(!canRemove)}
            disabled={!canRemove}
            onClick={() => selectedId && removeFigure(selectedId)}
          >
            Remove
          </button>
        </div>
      )}

      {analysis.faults.length > 0 && (
        <div style={{ color: "#f87171", fontSize: 13.5, fontWeight: 700, marginTop: 10, textAlign: "center", lineHeight: 1.4 }}>
          {analysis.faults[0]}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "14px 0 12px", visibility: showingSim ? "hidden" : "visible" }}>
        {versions.map((v, i) => (
          <button
            key={v.key}
            onClick={() => { setVersionIdx(i); setSim(null); setSelectedId(null); }}
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

      {!wide && (
        <div style={{ marginTop: 14 }}>
          {simulatePanel}
          {formationPanel}
        </div>
      )}
    </div>
  );

  return shell(
    <>
      {header(
        `${game === "eleven" ? kindLabel(cell.kind) : (FIVE_GROUPS.find((g) => g.id === fiveId)?.label ?? "")}`,
        () => { setScreen(game); setSim(null); setSelectedId(null); },
        <span style={{ color: showingSim ? "#7dd3fc" : MUTED, fontSize: 13, fontWeight: 800, flex: "none" }}>
          {showingSim ? "SIM" : `${versionIdx + 1} / ${versions.length}`}
        </span>,
      )}
      {wide ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)", gap: 16, padding: "0 14px 24px", alignItems: "start" }}>
          {pane}
          <div style={{ padding: "12px 0 24px", maxWidth: 560 }}>
            {simulatePanel}
            {formationPanel}
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
