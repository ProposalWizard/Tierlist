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
  type Scenario,
  type ScenarioKind,
  type Vec2,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { FIVE_A_SIDE, type MatchRules } from "@/lib/star/fiveASide/rules";
import { defensiveShape, DEFEND_ROLES } from "@/lib/star/fiveASide/shape";
import { attackingShape, ATTACK_ROLES } from "@/lib/star/fiveASide/attack";
import { buildPassage, type FiveWorld } from "@/lib/star/fiveASide/passage";
import { FIVE_KEEPER_STRENGTH } from "@/lib/star/fiveASide/geometry";
import { fixBaseScenario, scenarioFaults } from "@/lib/star/baseScenario";
import { castDefence, type OpponentSheetPlayer } from "@/lib/star/lineup";
import { formationOf } from "@/lib/star/formations";
import { applyFormationShape, defensiveLineOf } from "@/lib/star/formationShape";
import { PLAYSTYLES, type Playstyle } from "@/lib/star/playstyle";
import {
  nextSim,
  newSimMemory,
  buildSimScenario,
  simFaults,
  pictureKey,
  type SimSpec,
} from "@/lib/star/gallerySim";
import TuningPanel from "@/components/star/TuningPanel";
import { showSavedScenarios } from "@/lib/star/authoredChance";
import ScenarioEditor from "@/components/star/ScenarioEditor";
import type { MatchScenario, ScenarioSide } from "@/lib/star/scenarios";
import {
  listScenarios,
  fetchSharedScenarios,
  saveScenarioShared,
  saveScenario,
  deleteScenarioShared,
} from "@/lib/star/scenarioStore";
import { authoredScenarioList } from "@/lib/star/authoredScenarios";
import { statusOf, pendingCommit, newestById } from "@/lib/star/scenarioStatus";
import {
  loadCorrections, saveCorrection, makeCorrection, proposalsFrom, fetchSharedCorrections,
  FAULT_LABEL, PROPOSAL_THRESHOLD, type Correction,
} from "@/lib/star/scenarioCorrections";
import {
  loadReviews,
  saveReviews,
  reviewedCount,
  type ReviewStore,
  type ReviewVerdict,
} from "@/lib/star/scenarioReview";

import {
  OPP, MATE,
  frameFromScenario,
  frameCssSize,
  type FrameKits,
  paint,
  paintMarked,
  type Item,
  type Frame,
  type Mark,
} from "@/lib/star/scenarioFrame";
import EditableFrame from "@/components/star/EditableFrame";
import CameraPicker from "@/components/star/CameraPicker";
import ScenarioPlay from "@/components/star/ScenarioPlay";
import { testPlayWidth } from "@/lib/star/engineProfile";
import { useTestKits } from "@/components/star/EnginePlay";
import PageGuide from "@/components/admin/PageGuide";
import {
  applyOverride,
  applyOverrideToScenario,
  addFigureTo,
  removeFigureFrom,
  analyseEdited,
  hasEdits,
  frameToMatchScenario,
  loadEditStore,
  mergeOverrides,
  overrideFromMatchScenario,
  roundVec,
  saveEditStore,
  type EditStore,
  type PosOverride,
} from "@/lib/star/scenarioEdit";


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

/**
 * CARDS THAT HAVE BEEN DELETED.
 *
 * Versions are GENERATED from a count, not stored as a list, so there was no
 * way to get rid of one: "I added one and I can't delete it... I pressed the
 * X and it didn't." Delete also only ever appeared once a card was saved,
 * which is why it looked like a one-on-one-only feature — those were the only
 * saved ones. This remembers which cards are gone so a generated card can be
 * deleted like any other.
 */
const REMOVED_KEY = "star-gallery-removed-v1";
type RemovedStore = Record<string, true>;
function loadRemoved(): RemovedStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(REMOVED_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? (parsed as RemovedStore) : {};
  } catch { return {}; }
}
function saveRemoved(v: RemovedStore): void {
  try { window.localStorage.setItem(REMOVED_KEY, JSON.stringify(v)); } catch { /* a dev tool */ }
}
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

/** A card for a SAVED scenario that no generated version card covers — a
 *  sim-saved one, or a version past the current card count. Rebuilt from its
 *  own source (seed + plan), so the saved override lands on the right base
 *  exactly as it does for a generated card. This is what lets every saved
 *  scenario show on every screen, not just the ones whose seed happens to
 *  fall inside the default grid. */
function cellFromSaved(ms: MatchScenario): Cell | null {
  const kind = ms.source?.kind;
  const seed = ms.source?.seed;
  if (!kind || seed == null) return null;
  // An old Infinite Highlights save is a simulated chance — see indexGallery.
  const key = ms.id.startsWith("gallery-") ? ms.id.slice("gallery-".length)
    : ms.id.startsWith("highlight-") ? `sim-${kind}-${seed}`
    : ms.id;
  return key.startsWith("sim-")
    ? simCell({ kind: kind as ScenarioKind, seed, planId: ms.source?.planId ?? null })
    : buildCell(kind as ScenarioKind, seed);
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
  // A simulated picture is judged by `planFaults` (chanceFormula.ts), which is
  // `scenarioFaults` plus the camera's own rules — the same judgement the
  // formula's own harness makes. A base version has no plan and is judged by
  // `scenarioFaults` alone, exactly as before.
  return analyseEdited(
    cell.kind,
    () => rebuildScenario(cell),
    (sc) => (cell.sim ? simFaults(sc, cell.sim.planId) : scenarioFaults(sc)),
    overrides,
  );
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

/** Unsaved drags, this screen's own bucket — the exact key every edit already
 *  on disk was written under. */
const EDIT_KEY = "star-gallery-edits-v1";

/** This screen's half of `frameToMatchScenario`'s target: who is saving, and
 *  under what id. Byte-identical to what this page has always written. */
const saveTargetFor = (cell: Cell) => ({
  id: gallerySlug(cell.key),
  name: cell.title,
  kind: cell.kind,
  seed: cell.seed,
  planId: cell.sim?.planId ?? null,
  tool: "gallery" as const,
});

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
}: { onOpen: (s: "eleven" | "five" | "tuning") => void; warning: string | null; wide: boolean }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const tiles = useMemo(
    () => [
      { word: "11-a-side", frame: elevenVersions("one_on_one")[0].frame, go: "eleven" as const },
      { word: "5-a-side", frame: fiveVersions("defensive")[0].frame, go: "five" as const },
      { word: "Tuning & Commit", frame: elevenVersions("free_kick")[0].frame, go: "tuning" as const },
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
  cell, override, saved, verdict, onOpen, kits,
}: {
  kits?: FrameKits | null;
  cell: Cell;
  override: PosOverride | undefined;
  saved: MatchScenario | undefined;
  verdict: ReviewVerdict | undefined;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const savedOv = saved ? overrideFromMatchScenario(saved, cell.frame.items.length, cell.frame.camera) : undefined;
  const frame = applyOverride(applyOverride(cell.frame, savedOv), override);
  const analysis = useMemo(
    () => liveAnalysis(cell, [savedOv, override]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cell, saved, override],
  );

  useEffect(() => {
    if (!ref.current) return;
    paintMarked(ref.current, frame, analysis.marks, {}, cell.game === "eleven" ? kits ?? undefined : undefined);
    fillCanvas(ref.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell, saved, override, kits]);

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
  chips, activeId, onPick, wide, builderOn, onBuilder,
}: {
  chips: { id: string; label: string; done: number; total: number }[];
  activeId: string;
  onPick: (id: string) => void;
  wide: boolean;
  /** The Scenario Builder sits at the END of the list, in both games —
   *  asked for directly: "add the scenario builder to the scenario gallery
   *  page inside both 11 aside and 5 aside below all of the highlight types
   *  as a side tab". It is a different KIND of thing from a highlight type,
   *  so it gets a rule above it rather than blending into the chips. */
  builderOn?: boolean;
  onBuilder?: () => void;
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
        <button key={c.id} style={style(c.id === activeId && !builderOn)} onClick={() => onPick(c.id)}>
          {c.label} <span style={{ opacity: 0.6 }} title="in the game / saved">&middot; {c.done}/{c.total}</span>
        </button>
      ))}
      {onBuilder && (
        <>
          {wide && (
            <div style={{ height: 1, background: "rgba(255,255,255,0.09)", margin: "6px 0" }} />
          )}
          <button
            style={{
              ...style(!!builderOn),
              ...(builderOn
                ? { border: "1px solid rgba(167,139,250,0.75)", background: "rgba(109,40,217,0.38)", color: "#ede9fe" }
                : {}),
            }}
            onClick={onBuilder}
          >
            Scenario Builder
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  SCREEN 3 — ONE VERSION, big, draggable
// ─────────────────────────────────────────────────────────────────────────

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

type Screen = "home" | "eleven" | "five" | "tuning" | "version";

export default function StarGalleryDevPage() {
  const [screen, setScreen] = useState<Screen>("home");
  // The Scenario Builder tab inside the 11-a-side / 5-a-side grid. Reset
  // whenever a highlight type is picked, so the chips stay in charge.
  const [builderTab, setBuilderTab] = useState(false);
  const [game, setGame] = useState<"eleven" | "five">("eleven");
  const [kindId, setKindId] = useState<string>("one_on_one");
  const [fiveId, setFiveId] = useState<string>("defensive");
  const [versionIdx, setVersionIdx] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [wide, setWide] = useState(false);
  /** Viewport size, for the side-by-side card (see `sides`). */
  const [vp, setVp] = useState({ w: 0, h: 0 });
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
  /** The Play overlay is open on this card — see ScenarioPlay. */
  const [playing, setPlaying] = useState(false);
  /**
   * Which card has the camera picker open ("Pick on the whole pitch", the
   * Scenario Builder's own feature, asked for here on 23 Sep 2026). Keyed by
   * card so moving to another picture closes it.
   */
  const [pickCameraKey, setPickCameraKey] = useState<string | null>(null);
  const pictureRef = useRef<HTMLDivElement>(null);
  const togglePlay = () => setPlaying((v) => !v);
  /** The kits Play's match will wear (same seed and Play Area dials as
   *  ScenarioPlay → EnginePlay), so the picture is drawn in them and pressing
   *  Play changes no colours. Question 7 of patch notes v0.9. */
  const kits = useTestKits();
  /** The simulated chance currently on screen, if Simulate has been pressed. */
  const [sim, setSim] = useState<Cell | null>(null);

  // This is a full-screen dev tool, so the site's own nav/footer are hidden
  // the same way /star-dev already hides them (globals.css's immersive class).
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  useEffect(() => {
    const onResize = () => {
      setWide(window.innerWidth >= 1024);
      setVp({ w: window.innerWidth, h: window.innerHeight });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Edits ──
  const [edits, setEdits] = useState<EditStore>({});
  useEffect(() => {
    const loaded = loadEditStore(EDIT_KEY);
    if (Object.keys(loaded).length) setEdits(loaded);
  }, []);

  const setOverride = useCallback((key: string, ov: PosOverride) => {
    setEdits((prev) => {
      let next: EditStore;
      if (hasEdits(ov)) next = { ...prev, [key]: ov };
      else { next = { ...prev }; delete next[key]; }
      saveEditStore(EDIT_KEY, next);
      return next;
    });
  }, []);
  const clearOverride = useCallback((key: string) => {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      saveEditStore(EDIT_KEY, next);
      return next;
    });
  }, []);

  // ── Cards that have been deleted ──
  const [removed, setRemoved] = useState<RemovedStore>({});
  useEffect(() => {
    const loaded = loadRemoved();
    if (Object.keys(loaded).length) setRemoved(loaded);
  }, []);
  const markRemoved = useCallback((key: string) => {
    setRemoved((prev) => { const next = { ...prev, [key]: true as const }; saveRemoved(next); return next; });
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
  const [busy, setBusy] = useState<"saving" | "reverting" | "committing" | "deleting" | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);

  const indexGallery = (all: MatchScenario[]): Record<string, MatchScenario> => {
    const out: Record<string, MatchScenario> = {};
    for (const sc of all) {
      if (sc.source?.tool === "gallery" && sc.id.startsWith("gallery-")) {
        out[sc.id.slice("gallery-".length)] = sc;
      }
    }
    // A chance saved from Infinite Highlights before it saved into this list
    // (`highlight-<kind>-<seed>-<plan>`) is one of its kind's scenarios too —
    // shown as the simulated card it is, unless a gallery save of the same
    // chance already exists. New ones are saved straight into this list.
    for (const sc of all) {
      if (sc.source?.tool !== "highlights" || !sc.id.startsWith("highlight-")) continue;
      const kind = sc.source.kind, seed = sc.source.seed;
      if (!kind || seed == null) continue;
      const key = `sim-${kind}-${seed}`;
      if (!out[key]) out[key] = sc;
    }
    return out;
  };

  // The committed file is the durable source of truth — it is in every
  // build, on every device, and the FORMULA already reads it (authoredPool,
  // lib/star/authoredChance.ts). The gallery display used to read ONLY
  // Supabase, so a scenario committed to the repo drove the game for
  // everyone but was invisible on any screen whose browser had not synced
  // from Supabase — which is exactly why Leo could not see the one-on-ones
  // the game was already using. Read both, file first so a Supabase edit of
  // the same id still wins, same precedence the formula uses.
  // Newest copy per id wins — see newestById.
  const galleryPool = () => newestById([...authoredScenarioList(), ...listScenarios()]);

  // The dev tools see the team's SAVED drawings as well as the committed
  // ones, so Simulate and the rule set react to a save straight away. The
  // game never opts in — it plays the committed dataset only. Switched off
  // on the way out so a client-side hop to the Play Area can't carry it
  // into a real match. See showSavedScenarios.
  useEffect(() => {
    showSavedScenarios(true);
    return () => showSavedScenarios(false);
  }, []);

  useEffect(() => {
    setSaved(indexGallery(galleryPool()));
    void fetchSharedScenarios().then((r) => {
      setSaved(indexGallery(galleryPool()));
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
    const scenario = frameToMatchScenario(saveTargetFor(cell), frame);
    const res = await saveScenarioShared(scenario);
    setBusy(null);
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) { flashFor(false, `Not saved — ${res.message}`); return; }
    setSaved((m) => ({ ...m, [cell.key]: scenario }));
    clearOverride(cell.key);
    flashFor(true, "Saved for the team. It goes into the game when you commit it.");
  };

  const revertCell = async (cell: Cell): Promise<void> => {
    setBusy("reverting");
    const res = await deleteScenarioShared(saved[cell.key]?.id ?? gallerySlug(cell.key));
    setBusy(null);
    if (res.migrationMissing) setMigrationMissing(true);
    if (!res.ok) { flashFor(false, `Not reverted — ${res.message}`); return; }
    setSaved((m) => { const next = { ...m }; delete next[cell.key]; return next; });
    clearOverride(cell.key);
    flashFor(true, "Back to the built-in scenario.");
  };

  /**
   * Delete a scenario for good — from Supabase, from this browser, and from
   * the committed file. All three matter: the display reads the committed
   * file now, so removing it only from the database would let it come back on
   * the next load. Honest about a partial result — if the code half fails
   * (no token, a race) it says so rather than claiming a clean delete.
   */
  /**
   * DELETE THIS CARD — whatever state it is in.
   *
   * Reported: "I added one and I can't delete it... I pressed the X and it
   * didn't", and that Delete looked like it only existed for one-on-ones.
   * Two separate causes: the button only rendered once a scenario had been
   * SAVED (and one-on-ones were the only saved ones), and a generated card
   * had nowhere to be deleted TO, because versions come from a count rather
   * than a list. The X is the reject mark, not a delete — see its label.
   */
  const deleteCell = async (cell: Cell): Promise<void> => {
    const isSaved = !!saved[cell.key];
    const question = isSaved
      ? `Delete this ${kindLabel(cell.kind)} scenario everywhere — the database and the code? This cannot be undone here.`
      : `Remove this ${kindLabel(cell.kind)} card? It was never saved, so there is nothing to delete from the database or the code.`;
    if (typeof window !== "undefined" && !window.confirm(question)) return;

    // Never saved: there is nothing on a server to remove, so just take the
    // card out and stop. Doing the network round trip would report a
    // confusing failure for a card that only ever existed on this screen.
    if (!isSaved) {
      markRemoved(cell.key);
      clearOverride(cell.key);
      setVersionIdx((i) => Math.max(0, i - 1));
      flashFor(true, "Card removed.");
      return;
    }

    setBusy("deleting");
    const id = saved[cell.key]?.id ?? gallerySlug(cell.key);
    const shared = await deleteScenarioShared(id);       // Supabase + local cache
    let repoTail = "";
    try {
      const r = await fetch("/api/star/scenarios/commit", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) repoTail = ` — still in the code (${d?.error ?? r.status})`;
    } catch {
      repoTail = " — couldn't reach the server to remove it from the code";
    }
    setBusy(null);
    setSaved((m) => { const next = { ...m }; delete next[cell.key]; return next; });
    clearOverride(cell.key);
    markRemoved(cell.key);
    setVersionIdx((i) => Math.max(0, i - 1));
    if (!shared.ok && repoTail) { flashFor(false, `Delete failed — ${shared.message}${repoTail}`); return; }
    flashFor(!repoTail, repoTail ? `Removed here${repoTail}` : "Deleted — from the database and the code.");
  };

  /**
   * CORRECTIONS — "that generation was bad, here is it fixed."
   *
   * Deliberately NOT a save: a correction never becomes one of the base
   * scenarios and never tunes anything on its own. It records WHICH
   * measurable property the drag repaired, and stays silent until enough of
   * them agree to be worth proposing as a rule. See
   * lib/star/scenarioCorrections.ts for why that is the only version of this
   * that is safe.
   */
  const [corrections, setCorrections] = useState<Correction[]>([]);
  // This browser's copy first (instant), then the team's — see
  // fetchSharedCorrections. Three people's corrections now add up.
  useEffect(() => {
    setCorrections(loadCorrections());
    void fetchSharedCorrections().then((r) => setCorrections(r.corrections));
  }, []);
  const proposals = useMemo(() => proposalsFrom(corrections), [corrections]);

  const tuneCell = (cell: Cell, edited: Frame): void => {
    const target = saveTargetFor(cell);
    const before = frameToMatchScenario(target, frameFromScenario(rebuildScenario(cell)));
    const after = frameToMatchScenario(target, edited);
    const c = makeCorrection(gallerySlug(cell.key), cell.kind, before, after);
    setCorrections(saveCorrection(c));
    clearOverride(cell.key);
    if (!c.moves.length) { flashFor(false, "Nothing moved — no correction recorded."); return; }
    if (!c.faults.length) {
      flashFor(true, "Recorded. It repaired nothing measurable, so it is not evidence for a rule.");
      return;
    }
    const near = proposalsFrom([...corrections.filter((x) => x.id !== c.id), c])
      .find((pr) => pr.kind === cell.kind && c.faults.includes(pr.fault));
    flashFor(true, near
      ? `Recorded — ${near.count} now agree. A rule is proposed — ask Claude in the terminal for the tuner proposals.`
      : `Recorded: ${FAULT_LABEL[c.faults[0]]}. It stays quiet until a few more agree.`);
  };

  /**
   * Everything saved that the code does not have, or has an older copy of.
   * Recomputed from `saved`, so it is always what is genuinely outstanding
   * rather than a tally somebody has to keep.
   */
  /**
   * WHAT THIS SESSION HAS ALREADY COMMITTED.
   *
   * `pendingCommit` compares the database against `AUTHORED_SCENARIOS` — a
   * BUILD-TIME import. A successful commit writes the file in the repo and
   * starts a deploy, but the page you are looking at is still running the
   * old build, so the count cannot go down for another minute or two.
   *
   * It read as a failure. Reported directly: "the commit all button isn't
   * working, it says 16 to commit but I'm not sure if they have" — and the
   * real cost is that pressing it again makes a SECOND commit of the
   * identical content. That happened: two commits 28 seconds apart, both
   * "save 16 scenarios", with an empty diff between them.
   *
   * So a commit this session succeeded for is remembered here and taken out
   * of the count straight away. Deliberately NOT persisted: a reload gets a
   * fresh build (or the same one), and the honest answer then is whatever
   * the file actually says.
   */
  const [justCommitted, setJustCommitted] = useState<Record<string, true>>({});
  const pending = useMemo(
    () => pendingCommit(Object.values(saved)).filter((sc) => !justCommitted[sc.id]),
    [saved, justCommitted],
  );

  /**
   * The PICTURE a saved scenario actually is.
   *
   * Rebuilt exactly the way that scenario's own card rebuilds it — its base
   * from `cellFromSaved` (seed + plan), with its saved positions laid over —
   * so the last look before a commit and the card itself can never be
   * showing two different things. A scenario with no recorded source has no
   * base to rebuild from; that is a real state, so it returns null and the
   * reviewer says so rather than drawing something invented.
   */
  const frameOfSaved = useCallback((sc: MatchScenario): Frame | null => {
    const cell = cellFromSaved(sc);
    if (!cell) return null;
    return applyOverride(cell.frame, overrideFromMatchScenario(sc, cell.frame.items.length, cell.frame.camera));
  }, []);

  /** Open a saved scenario's own card, for a last edit before committing. */
  const openSavedScenario = useCallback((sc: MatchScenario) => {
    const kind = sc.source?.kind;
    if (!kind) return;
    setKindId(kind);
    openGroup("eleven");
  }, []);

  /**
   * COMMIT EVERYTHING OUTSTANDING, IN ONE COMMIT.
   *
   * Vercel rebuilds production on every commit to main, so committing one
   * scenario at a time is one deploy each. Asked for directly: "imagine all
   * three of us are doing a bunch of scenarios… we did 100, we've pressed
   * Save on all of them… we commit, and it's one production, rather than
   * every single time we save."
   *
   * The API already took an array — `commitScenarios` merges by id and
   * writes the file once — so this is one request, one commit, one deploy,
   * however many scenarios are outstanding.
   */
  const commitAllPending = async (batch: MatchScenario[]): Promise<void> => {
    if (!batch.length) return;
    setBusy("committing");
    let res: Response;
    try {
      res = await fetch("/api/star/scenarios/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarios: batch }),
      });
    } catch {
      setBusy(null);
      flashFor(false, "Not committed — couldn't reach the server.");
      return;
    }
    const body = await res.json().catch(() => ({})) as
      { ok?: boolean; error?: string; message?: string };
    setBusy(null);
    if (!res.ok || body.ok !== true) {
      const why = body.error ?? `the server refused it (${res.status}).`;
      if (res.status === 503) setCommitBlocked(why);
      flashFor(false, `Not committed — ${why}`);
      return;
    }
    // The committed file is a build-time import, so what is on screen cannot
    // re-read it until the deploy lands. Say that rather than flipping the
    // badges to "Committed" and being wrong for the next two minutes.
    setJustCommitted((m) => {
      const next = { ...m };
      for (const sc of batch) next[sc.id] = true;
      return next;
    });
    flashFor(true,
      `Committed ${batch.length} ${batch.length === 1 ? "scenario" : "scenarios"} in one commit. `
      + "Do not press it again — they are in the repo now, and the badges "
      + "catch up when the deploy finishes in a minute or two.");
  };

  /** Nothing here is optimistic — a missing GITHUB_TOKEN, a refused token or
   *  two lost races all land in the same red line, quoting the server. */
  const commitCell = async (cell: Cell, frame: Frame): Promise<void> => {
    setBusy("committing");
    const scenario = frameToMatchScenario(saveTargetFor(cell), frame);
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
    // The server saved the same copy to the shared list as it committed it
    // (see the commit route), so this browser's list follows suit.
    saveScenario(scenario);
    setSaved((m) => ({ ...m, [cell.key]: scenario }));
    clearOverride(cell.key);
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
    () => {
      if (game !== "eleven") return fiveVersions(fiveId);
      const generated = elevenVersions(kindId as ScenarioKind, countFor(kindId));
      // Every SAVED scenario of this kind that no generated card already
      // covers, appended as its own card — so all of them show, including
      // sim-saved ones and versions beyond the current count. Without this a
      // scenario could be committed, used by the game, and still invisible
      // here because its id did not line up with a grid slot.
      const have = new Set(generated.map((c) => c.key));
      const extra: Cell[] = [];
      for (const [key, ms] of Object.entries(saved)) {
        if (have.has(key) || ms.source?.kind !== kindId) continue;
        const c = cellFromSaved(ms);
        if (c) { extra.push(c); have.add(key); }
      }
      return [...generated, ...extra].filter((c) => !removed[c.key]);
    },
    [game, kindId, fiveId, countFor, saved, removed],
  );
  const activeGroupId = game === "eleven" ? kindId : fiveId;

  const chips = useMemo(() => {
    if (game === "eleven") {
      return KIND_ORDER.map((k) => {
        // THE SAME NUMBERS ON EVERY SCREEN. The chip used to count this
        // browser's generated cards (its own "+ Add version" count, minus its
        // own deleted cards) plus the saved ones, and "done" was this
        // browser's own ticks — so Harry saw 21/21, Mikey 23, for the same
        // one-on-ones. It now counts only what everyone shares: the kind's
        // SAVED scenarios, and how many of those are in the game.
        const mine = Object.values(saved).filter((ms) => ms.source?.kind === k);
        const inGame = mine.filter((ms) => statusOf(ms).tuning).length;
        return { id: k, label: kindLabel(k), done: inGame, total: mine.length };
      });
    }
    return FIVE_GROUPS.map((g) => {
      const keys = fiveVersions(g.id).map((c) => c.key).filter((key) => !removed[key]);
      return { id: g.id, label: g.label, done: reviewedCount(reviews, keys), total: keys.length };
    });
  }, [game, reviews, countFor, saved, removed]);

  const openGroup = (g: "eleven" | "five") => { setGame(g); setScreen(g); setSim(null); setBuilderTab(false); };
  const openVersion = (i: number) => { setVersionIdx(i); setScreen("version"); setSim(null); setSelectedId(null); };

  const baseCell = versions[Math.min(versionIdx, versions.length - 1)];
  // A simulated chance stands in for the version underneath it, so every
  // control on this screen — drag, fault rings, Save, Export — works on it
  // exactly as it works on a built-in version.
  const showingSim = !!sim && game === "eleven" && sim.kind === kindId;
  const cell = showingSim ? sim! : baseCell;

  /**
   * Flicking through, without hunting for the button.
   *
   * On a simulated chance the right arrow (and space, and enter) is another
   * one — that is the endless part. On a built-in version the arrows step
   * through the versions, exactly as the on-screen chevrons already did.
   */
  const stepVersion = useCallback((d: number) => {
    setVersionIdx((i) => (i + d + versions.length) % versions.length);
    setSim(null);
    setSelectedId(null);
  }, [versions.length]);

  useEffect(() => {
    if (screen !== "version") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (showingSim || e.key !== "ArrowRight") simulate(kindId);
        else stepVersion(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (showingSim) simulate(kindId);
        else stepVersion(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, showingSim, kindId, simulate, stepVersion]);

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
      <PageGuide page="/star-gallery-dev" />
    </main>
  );

  // ── HOME ──
  if (screen === "home") {
    return shell(
      <>
        <HomeScreen
          onOpen={(s) => (s === "tuning" ? setScreen("tuning") : openGroup(s))}
          warning={warning}
          wide={wide}
        />
        {/* ── ONE POINTER, NOT TWO PANELS ──
            The proposals list and the commit box both used to sit on this
            screen, and the commit box again at the bottom of the gallery.
            Reported as not being findable. They have their own page now;
            this is a one-line nudge so nobody has to remember to look. */}
        {(pending.length > 0 || corrections.length > 0) && (
          <button
            onClick={() => setScreen("tuning")}
            style={{
              margin: "0 14px 14px", padding: "11px 14px", borderRadius: 14, width: "calc(100% - 28px)",
              textAlign: "left", cursor: "pointer",
              background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.35)",
              color: "#e0f2fe", fontSize: 13, fontWeight: 800,
            }}
          >
            {[
              pending.length > 0
                ? `${pending.length} saved, not committed`
                : null,
              proposals.length > 0
                ? `${proposals.length} ${proposals.length === 1 ? "proposal" : "proposals"}`
                : corrections.length > 0
                  ? `${corrections.length} ${corrections.length === 1 ? "correction" : "corrections"}`
                  : null,
            ].filter(Boolean).join(" · ")}
            <span style={{ fontWeight: 600, opacity: 0.75 }}> — open Tuning &amp; Commit ›</span>
          </button>
        )}
      </>,
      true,
    );
  }

  // ── TUNING & COMMIT ──
  //
  // This tile used to open Mikey's Scenario Builder. It was moved out rather
  // than deleted — it still has its own page at /star-scenario-dev — because
  // the two things nobody could find, the commit box and the proposals, had
  // nowhere of their own and were buried at the bottom of a long gallery.
  if (screen === "tuning") {
    return shell(
      <>
        {header("Tuning & Commit", () => setScreen("home"))}
        <TuningPanel
          kinds={KIND_ORDER as unknown as string[]}
          proposals={proposals}
          corrections={corrections}
          pending={pending}
          frameOf={frameOfSaved}
          busy={busy}
          commitBlocked={commitBlocked}
          onCommitAll={(batch) => void commitAllPending(batch)}
          onShowKind={(k) => { setKindId(k); openGroup("eleven"); }}
          onOpenScenario={openSavedScenario}
        />
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
            kits={kits}
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
        {(() => {
          const pick = (id: string) => {
            setBuilderTab(false);
            (game === "eleven" ? setKindId : setFiveId)(id);
          };
          const body = builderTab
            ? <div style={{ padding: 10 }}><ScenarioEditor /></div>
            : grid;
          return wide ? (
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", alignItems: "start" }}>
              <div style={{ padding: 14, position: "sticky", top: 58 }}>
                <ChipRow
                  chips={chips} activeId={activeGroupId} onPick={pick} wide
                  builderOn={builderTab} onBuilder={() => setBuilderTab(true)}
                />
              </div>
              {body}
            </div>
          ) : (
            <>
              <ChipRow
                chips={chips} activeId={activeGroupId} onPick={pick} wide={false}
                builderOn={builderTab} onBuilder={() => setBuilderTab(true)}
              />
              {body}
            </>
          );
        })()}
      </>,
      false,
    );
  }

  // ── VERSION ──
  if (!cell) return shell(<div style={{ padding: 20 }}>No versions.</div>, false);

  const savedScenario = saved[cell.key];
  const savedOv = savedScenario ? overrideFromMatchScenario(savedScenario, cell.frame.items.length, cell.frame.camera) : undefined;
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
    // `whiteSpace: nowrap` and a smaller font because five of these share one
    // column now — at 13.5px "+ Team-mate" broke onto two lines and made the
    // row twice as tall as it needed to be.
    flex: 1, minWidth: 0, height: 42, borderRadius: 13, cursor: off ? "default" : "pointer",
    // 11px, 2px: six fit a 390px phone once Tune joins (at 12px "+ Mate"
    // and "Remove" were cut to "+ Ma…" and "Rem…").
    padding: "0 2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",

    border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
    color: off ? "rgba(138,151,170,0.45)" : INK, fontSize: 11, fontWeight: 700,
  });

  // ── Adding and removing figures ──
  const selectedItem = liveFrame.items.find((it) => it.id === selectedId);
  const canRemove = !!selectedItem?.removable;

  const addFigure = (side: ScenarioSide) => {
    const { override: ov, id } = addFigureTo(liveFrame, side, override, [savedOv]);
    setOverride(cell.key, ov);
    setSelectedId(id);
  };

  const removeFigure = (id: string) => {
    setOverride(cell.key, removeFigureFrom(id, override));
    setSelectedId(null);
  };

  // ── Simulate, and the formation strip it replaced ──
  //
  // Before you are simulating this is a small square, so the picture and the
  // buttons under it both fit on screen at once — asked for directly after
  // the desktop picture grew: "we could just make the simulate button a
  // little square that has a little play button on it". Once you ARE
  // simulating it becomes the wide NEXT button, because that is then the one
  // thing you press over and over.
  /** The picture in the middle with the verdict buttons down its sides —
   *  whenever the screen has room for a column either side of it. */
  /**
   * How big the picture is, and Play with it.
   *
   * Asked for (24 Sep 2026): "can't it look bigger without feeling
   * different?" It is the real match's width on a phone and grows on a
   * laptop up to 520 px wide, never taller than the screen
   * (`testPlayWidth`). Play renders at this SAME width; EnginePlay reads the
   * drag against the real match's canvas height whenever it is bigger, so
   * the same finger movement kicks exactly as hard as in a career.
   *
   * Nothing is sized until the screen has been measured — vp.w is 0 on the
   * first render, and testPlayWidth then gives the real match's default.
   */
  const pictureW = testPlayWidth(vp.w, vp.h);
  // Room for the picture AND a 96px column either side of it. Below that the
  // buttons stack underneath.
  const sides = vp.w >= pictureW + 2 * 96 + 40;
  const pictureSize = vp.w > 0 ? { baseW: pictureW, maxW: pictureW, maxH: 4000 } : undefined;
  const simulatePanel = cell.game === "eleven" ? (
    <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
      <button
        onClick={() => simulate(kindId)}
        title={showingSim ? "Next version" : "Simulate a version of this chance"}
        style={{
          width: showingSim ? "100%" : 46, height: showingSim ? 62 : 46,
          borderRadius: showingSim ? 16 : 14, cursor: "pointer",
          border: "1px solid rgba(56,189,248,0.55)", background: "rgba(14,116,144,0.38)",
          color: "#e0f2fe", fontSize: showingSim ? 21 : 16, fontWeight: 800,
          display: "grid", placeItems: "center", lineHeight: 1,
        }}
      >
        {showingSim ? "Next \u2192" : "\u25B6"}
      </button>
      {showingSim && (
        <button
          onClick={() => { setSim(null); setSelectedId(null); }}
          style={{
            width: "100%", height: 40, borderRadius: 13, cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.05)",
            color: MUTED, fontSize: 13.5, fontWeight: 700, justifySelf: "stretch",
          }}
        >
          Back to version {versionIdx + 1}
        </button>
      )}
    </div>
  ) : null;

  const formationPanel = cell.game === "eleven" ? (
    <div style={{ marginTop: 14, textAlign: "center" }}>
      <button
        onClick={() => setShowFormations((v) => !v)}
        style={{
          width: "100%", maxWidth: 240, height: 36, borderRadius: 13, cursor: "pointer",
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

  // The edit row — under the picture on a phone, full width under the three
  // columns when the verdicts sit at the sides (see `sides`).
  const editRow = cell.game === "eleven" ? (
        <>
        <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
          <button style={editBtn(false)} onClick={() => addFigure("teammate")}>+ Mate</button>
          <button style={editBtn(false)} title="Add an opponent" onClick={() => addFigure("opponent")}>+ Opp</button>
          <button
            style={editBtn(!canRemove)}
            disabled={!canRemove}
            onClick={() => selectedId && removeFigure(selectedId)}
          >
            Remove
          </button>
          {/* Play THIS picture, edits and all — see ScenarioPlay. Works the
              same on a base version and on a simulated one, because both are
              rebuilt through `rebuildScenario`. */}
          <button
            style={{ ...editBtn(false), color: playing ? "#7dd3fc" : "#4ade80" }}
            onClick={togglePlay}
          >
            {playing ? "◼ Stop" : "▶ Play"}
          </button>
          {/* Always here. A saved scenario goes from the database and the
              committed file too; an unsaved card just goes from the grid. */}
          <button
            style={{ ...editBtn(false), color: "#f87171" }}
            disabled={!!busy}
            title={savedScenario
              ? "Delete this scenario everywhere — database and code"
              : "Remove this card — it was never saved"}
            onClick={() => void deleteCell(cell)}
          >
            {busy === "deleting" ? "Deleting…" : "Delete"}
          </button>
          {/* Tune: record WHY this generation was bad, without making it one
              of the base scenarios. Only offered when there is a drag to
              learn from. See lib/star/scenarioCorrections.ts. */}
          {hasEdits(override) && (
            <button
              style={{ ...editBtn(false), color: "#c4b5fd" }}
              title="Record what was wrong with this generation — not saved as a base scenario"
              onClick={() => tuneCell(cell, liveFrame)}
            >
              Tune
            </button>
          )}
        </div>
        {/* ── CAMERA FRAMING ──
            The Scenario Builder's "Pick on the whole pitch": the picture zooms
            out to the whole pitch with the camera as a dashed frame; drag it,
            let go, and Done. Saved with the scenario, and the game frames the
            chance from there. The camera slides; it never zooms. */}
        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          <button
            style={{ ...editBtn(false), ...(pickCameraKey === cell.key ? { background: "#fbbf24", color: "#451a03" } : {}) }}
            disabled={playing}
            onClick={() => setPickCameraKey(pickCameraKey === cell.key ? null : cell.key)}
          >
            {pickCameraKey === cell.key ? "Done — back to editing" : "Camera: pick on the whole pitch"}
          </button>
        </div>
        </>
  ) : null;

  // ── The verdict buttons ──
  // Built once and placed either in a row under the picture (a narrow phone)
  // or down the SIDES of it. Asked for directly: "make the actual scenario the
  // whole middle of the screen … and then have the save and no good all on the
  // sides of it" — the row under the picture, plus Simulate's Next under that,
  // was falling off the bottom of the screen.
  const sideBtn: React.CSSProperties = sides ? { flex: "none", width: "100%", minHeight: 76 } : {};
  const noGoodBtn = (
    <button
      onClick={() => setVerdict(cell, verdict === "rejected" ? null : "rejected")}
      title="Mark this picture as no good — it stays here"
      style={{
        ...bigBtn(verdict === "rejected" ? "#7f1d1d" : "rgba(255,255,255,0.05)", verdict === "rejected" ? "#ef4444" : "rgba(255,255,255,0.09)", verdict === "rejected" ? "#fecaca" : MUTED),
        fontSize: 13, gap: 6, flexDirection: sides ? "column" : "row", ...sideBtn,
      }}
    >
      &#10005; <span style={{ fontSize: 12.5, fontWeight: 700 }}>No good</span>
    </button>
  );
  /** ✓ saves when there is something to save: an edit, or a card that is
   *  not one of this kind's scenarios yet (a simulated chance, a generated
   *  version nobody has saved). */
  const willSave = canSave && (edited || !savedScenario);
  const approveBtn = (
    <button
      onClick={() => {
        // Approving a picture that is not saved yet SAVES it — it is now one
        // of this kind's scenarios, for everyone. It used to save only when
        // something had been dragged, so approving a good simulated chance
        // as it was just marked it and threw it away: "when you're simming
        // through and you save and approve, it doesn't then add it as a
        // scenario." A card already saved and untouched is only marked.
        if (willSave) void saveCell(cell, liveFrame);
        setVerdict(cell, "approved");
      }}
      style={{
        ...bigBtn(
          verdict === "approved" ? "#14532d" : "rgba(255,255,255,0.05)",
          verdict === "approved" ? "#22c55e" : "rgba(255,255,255,0.09)",
          verdict === "approved" ? "#bbf7d0" : MUTED,
        ),
        flex: willSave ? 2.2 : 1,
        fontSize: willSave ? 15 : 19,
        ...sideBtn,
        ...(sides ? { minHeight: 120 } : {}),
      }}
    >
      {willSave ? (busy === "saving" ? "Saving…" : "Save & Approve") : "✓"}
    </button>
  );
  const moreBtn = (
    <button
      onClick={() => setSheetOpen(true)}
      style={{ ...bigBtn("rgba(255,255,255,0.05)", "rgba(255,255,255,0.09)", MUTED), ...sideBtn, ...(sides ? { minHeight: 52 } : {}) }}
    >
      &#8943;
    </button>
  );

  const paneTop = (
      <div ref={pictureRef} style={{ position: "relative" }}>
        {/* Playing swaps the PICTURE for the live match and leaves every
            control below it in place — play, correct, play again, save,
            without changing screen. */}
        {playing ? (
          <ScenarioPlay
            build={() => {
              const sc = rebuildScenario(cell);
              // The SAVED drawing first, then whatever is being dragged on
              // top of it — the same two layers, in the same order, that the
              // picture, the fault rings and the formation strip all compose.
              // Leaving `savedOv` out of this one call meant Play threw the
              // saved scenario away and played the raw generated base
              // instead. Reported directly: "the play in the scenario
              // gallery moves everything around, and the goalie isn't in the
              // same position that I place him in". Measured on the card it
              // was reported from: the drawing had the keeper on 4.6m and
              // the ball on 11.6m, Play put them on 2.2m and 19.2m.
              applyOverrideToScenario(sc, mergeOverrides([savedOv, override]));
              return sc;
            }}
            onStop={() => setPlaying(false)}
            width={pictureW}
          />
        ) : pickCameraKey === cell.key ? (
          <CameraPicker
            frame={liveFrame}
            size={pictureSize}
            onChange={(camera) => setOverride(cell.key, { ...(override ?? { items: {} }), camera })}
          />
        ) : (
        <EditableFrame
          editKey={cell.key}
          baseFrame={baseFrame}
          // Phone keeps the phone-sized default. On a desktop the picture you
          // are actually working on gets the room the screen already has.
          // Third pass at this. 340 (phone-sized everywhere) was too small on
          // a desktop, 520 x 800 was "too big", 400 x 640 still pushed the
          // buttons under it off the bottom of the screen. 350 x 560 leaves
          // the whole card — picture, edit row, verdict row, Simulate and
          // Across formations — visible at once on a 900px-tall screen.
          size={pictureSize}
          kits={cell.game === "eleven" ? kits : null}
          override={override}
          marks={analysis.marks}
          onCommit={setOverride}
          edited={edited}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSwipe={(d) => {
            if (showingSim) simulate(kindId);
            else if (versions.length > 1) stepVersion(d);
          }}
        />
        )}
        {!sides && !playing && !showingSim && versions.length > 1 && (
          <>
            <button onClick={() => go(-1)} style={arrowStyle("left")}>&#8249;</button>
            <button onClick={() => go(1)} style={arrowStyle("right")}>&#8250;</button>
          </>
        )}
      </div>
  );
  const paneBottom = (
    <>
      {!sides && editRow}


      {/* ── WHERE THIS ONE ACTUALLY IS ──
          Draft / Saved / Committed, and whether it is tuning the generator.
          Three different things were being confused for each other and the
          screen never said which was which. See lib/star/scenarioStatus.ts. */}
      {(() => {
        const st = statusOf(savedScenario ?? null);
        const unsaved = hasEdits(override);
        const tone = unsaved || st.state === "draft"
          ? { fg: "#fcd34d", bg: "rgba(245,158,11,0.15)", br: "rgba(245,158,11,0.45)" }
          : st.state === "committed"
            ? { fg: "#86efac", bg: "rgba(34,197,94,0.14)", br: "rgba(34,197,94,0.45)" }
            : { fg: "#7dd3fc", bg: "rgba(56,189,248,0.14)", br: "rgba(56,189,248,0.45)" };
        const text = unsaved
          ? "Unsaved changes — this browser only"
          : st.label;
        const tunes = unsaved ? false : st.tuning;
        return (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
              color: tone.fg, background: tone.bg, border: `1px solid ${tone.br}`,
            }}>
              {text}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: "3px 9px", borderRadius: 999,
              color: tunes ? "#c4b5fd" : MUTED,
              background: tunes ? "rgba(167,139,250,0.14)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${tunes ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.09)"}`,
            }}>
              {tunes ? "In the game" : "Not in the game yet"}
            </span>
          </div>
        );
      })()}

      {analysis.faults.length > 0 && (
        <div style={{ color: "#f87171", fontSize: 13.5, fontWeight: 700, marginTop: 10, textAlign: "center", lineHeight: 1.4 }}>
          {analysis.faults[0]}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "10px 0 9px", visibility: showingSim ? "hidden" : "visible" }}>
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

      {!sides && (
        <div style={{ display: "flex", gap: 10 }}>
          {noGoodBtn}
          {approveBtn}
          {moreBtn}
        </div>
      )}

      {flash && (
        <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, textAlign: "center", color: flash.ok ? "#4ade80" : "#fca5a5" }}>
          {flash.text}
        </div>
      )}

      {!sides && (
        <div style={{ marginTop: 14 }}>
          {simulatePanel}
          {formationPanel}
        </div>
      )}
      {sides && formationPanel}
    </>
  );
  // 12px a side, the same as the real match's own column — so the picture
  // (and Play) fits at exactly the real match's width.
  const pane = (
    <div style={{ padding: "12px 12px 24px" }}>
      {paneTop}
      {paneBottom}
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
      {sides ? (
        // THE PICTURE IN THE MIDDLE, the verdicts down its sides. The edit row
        // (+ Mate, + Opponent, Remove, Play, Delete) sits right under the
        // picture; No good on the left; ✓ / Save & Approve, the menu and
        // Simulate's Next on the right. Nothing needs scrolling to reach.
        <div style={{
          display: "grid", gridTemplateColumns: "84px auto 84px", gap: 10,
          justifyContent: "center", alignItems: "center", padding: "0 10px 24px",
        }}>
          <div style={{ display: "grid", gap: 10, alignContent: "center" }}>
            {!playing && !showingSim && versions.length > 1 && (
              <button onClick={() => go(-1)} style={sideArrow} aria-label="previous version">&#8249;</button>
            )}
            {noGoodBtn}
            {showingSim && (
              <button
                onClick={() => { setSim(null); setSelectedId(null); }}
                style={{ ...sideArrow, fontSize: 12, height: 52 }}
              >
                Back to v{versionIdx + 1}
              </button>
            )}
          </div>
          <div style={{ minWidth: 0 }}>{paneTop}</div>
          <div style={{ display: "grid", gap: 10, alignContent: "center" }}>
            {!playing && !showingSim && versions.length > 1 && (
              <button onClick={() => go(1)} style={sideArrow} aria-label="next version">&#8250;</button>
            )}
            {approveBtn}
            {moreBtn}
            {cell.game === "eleven" && (
              <button
                onClick={() => simulate(kindId)}
                title={showingSim ? "Next version" : "Simulate a version of this chance"}
                style={{
                  ...sideArrow, height: showingSim ? 76 : 52,
                  border: "1px solid rgba(56,189,248,0.55)", background: "rgba(14,116,144,0.38)",
                  color: "#e0f2fe", fontSize: showingSim ? 16 : 13,
                }}
              >
                {showingSim ? "Next \u2192" : "\u25B6 Sim"}
              </button>
            )}
          </div>
          <div style={{ gridColumn: "1 / -1", width: "100%", maxWidth: 560, justifySelf: "center" }}>
            {editRow}
            {paneBottom}
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

/** A button in one of the card's side columns. */
const sideArrow: React.CSSProperties = {
  width: "100%", height: 52, borderRadius: 14, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
  color: "#e6edf7", fontSize: 24, fontWeight: 800, lineHeight: 1,
};

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
