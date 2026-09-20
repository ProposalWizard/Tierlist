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
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";

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
}

interface Frame {
  rules: MatchRules;
  camera: MatchRules["view"];
  /** null = no goal drawn (a midfield situation with none in view). */
  goalAtY: number | null;
  /** null = no offside line. */
  offsideY: number | null;
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
    items.push({ at: { x: d.x, y: d.y }, look: { ...OPP, label: idLabel(d.who, `D${i + 1}`) } });
  });
  items.push({
    at: { x: sc.keeper.x, y: sc.keeper.y },
    look: { ...KEEP, label: idLabel(sc.keeper.who, "GK") },
    keeper: true,
  });

  // Your options: the target runner, support runners, the poacher.
  if (sc.runner) {
    items.push({ at: { ...sc.runner.pos }, look: { ...MATE, label: idLabel(sc.runner.who, "TARGET") } });
  }
  sc.secondaryRunners.forEach((r, i) => {
    items.push({
      at: { ...r.pos },
      look: { ...MATE, label: idLabel(r.who, r.role === "support" ? "SUP" : `R${i + 1}`) },
    });
  });
  if (goalInView(sc.kind)) {
    items.push({ at: { x: sc.follower.x, y: sc.follower.y }, look: { ...MATE, label: idLabel(sc.follower.who, "POACH") } });
  }
  // Decorative team-mates (crossers etc.).
  sc.teammates.forEach((t, i) => {
    items.push({ at: { x: t.x, y: t.y }, look: { ...MATE, label: idLabel(t.who, `T${i + 1}`) } });
  });

  // You, with a star so you are always findable.
  items.push({ at: { ...sc.player }, look: { ...YOU, label: "YOU", star: true } });

  return {
    rules: ELEVEN_A_SIDE_ATTACK,
    camera: sc.viewport,
    goalAtY: goalInView(sc.kind) ? 0 : null,
    offsideY: offsideLineFor(sc),
    items,
    ball: { ...sc.ball },
  };
}

/** Paint a frame onto a canvas, sized to the camera's own aspect so nothing
 *  is stretched (px/py must share a scale). */
function paint(canvas: HTMLCanvasElement, frame: Frame): void {
  const vpW = frame.camera.x2 - frame.camera.x1;
  const vpH = frame.camera.y2 - frame.camera.y1;
  const CSS_W = 340;
  let cssW = CSS_W;
  let cssH = Math.round((CSS_W * vpH) / vpW);
  // Keep a cell from becoming a skyscraper (a long-range viewport is very
  // tall); shrink width to hold the true aspect if we cap the height.
  const MAX_H = 560;
  if (cssH > MAX_H) { cssH = MAX_H; cssW = Math.round((MAX_H * vpW) / vpH); }
  const MAX_W = 460;
  if (cssW > MAX_W) { cssW = MAX_W; cssH = Math.round((MAX_W * vpH) / vpW); }

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

  if (frame.offsideY !== null) drawOffsideLine(ctx, p, cssW, frame.offsideY);

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
 *  opponent formation. */
function mainCells(formationId: string): Cell[] {
  const opp = oppXIFromFormationId(formationId);
  return SCENARIO_KINDS.map((kind, i) => {
    const seed = 1000 + i;
    const sc = buildScenario(kind, mulberry32(seed));
    castDefence(sc, opp);
    return {
      key: `main-${kind}`,
      title: kind,
      subtitle: `buildScenario · seed ${seed} · vs ${formationId}`,
      frame: frameFromScenario(sc),
    };
  });
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
    items.push({ at: { ...a }, look: { ...MATE, label: i === 0 ? "BALL-CARRIER" : `A${i}`, star: i === 0 } });
  });
  shape.slots.forEach((s, i) => {
    items.push({ at: { ...s }, look: { ...OPP, label: DEFEND_ROLES[i] } });
  });
  return {
    rules: FIVE_A_SIDE,
    camera: FIVE_A_SIDE.view,
    goalAtY: 0,
    offsideY: null,
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
    items.push({ at: { ...d }, look: { ...OPP, label: `D${i + 1}` } });
  });
  shape.slots.forEach((s, i) => {
    items.push({
      at: { ...s },
      look: { ...MATE, label: ATTACK_ROLES[i], star: i === shape.yours },
    });
  });
  return {
    rules: FIVE_A_SIDE,
    camera: FIVE_A_SIDE.view,
    goalAtY: 0,
    offsideY: null,
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
  });
  cells.push({
    key: "five-attacking",
    title: "5-a-side attacking shape",
    subtitle: `attackingShape() · band y18 (${FIVE_HALFWAY_Y.toFixed(0)}=halfway)`,
    frame: fiveAttackingFrame(),
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
  });
  return cells;
}

// ── UI ─────────────────────────────────────────────────────────────────────

function GalleryCell({ cell }: { cell: Cell }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) paint(ref.current, cell.frame);
  }, [cell]);
  return (
    <div
      data-cell={cell.key}
      style={{ background: "#0b1220", border: "1px solid #1e293b", borderRadius: 10, padding: 8 }}
    >
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>{cell.title}</div>
      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 8, fontFamily: "monospace" }}>
        {cell.subtitle}
      </div>
      <canvas ref={ref} style={{ display: "block", borderRadius: 6, background: "#14532d" }} />
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

function ElevenView() {
  const [formationId, setFormationId] = useState("433");
  const formation = formationOf(formationId);
  const cells = mainCells(formationId);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <label style={{ fontWeight: 700, fontSize: 14 }}>Opponent formation:</label>
        <select
          value={formationId}
          onChange={(e) => setFormationId(e.target.value)}
          style={{
            background: "#0b1220",
            color: "#e2e8f0",
            border: "1px solid #334155",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {FORMATIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <p style={{ margin: "0 0 16px", color: "#fb923c", fontSize: 13, maxWidth: 760, lineHeight: 1.5 }}>
        Changing the formation re-casts every scenario below against it (via the real{" "}
        <code>castDefence</code>) AND redraws the reference shape. <b>Today the scenario shapes do not
        move</b> — <code>castDefence</code> only assigns WHO each defender is, not WHERE — so only the
        assigned names change. The reference card shows what the shape should become once the 11-a-side
        positional layer lands. That gap is the finding, not a page bug.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 28 }}>
        <FormationRefCell formation={formation} />
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Every scenario kind</h3>
      <p style={{ margin: "0 0 16px", color: "#94a3b8", fontSize: 13, maxWidth: 760 }}>
        The 13 kinds from <code>buildScenario</code>, one seed each. Blue = your side (star = you), red =
        opponents, green = keeper. Yellow dashes = the offside line the engine would judge against.
        Corner/byline are drawn un-rotated (the game rotates the camera for facing; the shared primitives
        do not).
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        {cells.map((c) => (
          <GalleryCell key={c.key} cell={c} />
        ))}
      </div>
    </div>
  );
}

function FiveView() {
  const cells = fiveCells();
  return (
    <div>
      <p style={{ margin: "0 0 16px", color: "#94a3b8", fontSize: 13, maxWidth: 760 }}>
        Real <code>fiveASide/</code> shapes at fixed seeds. <code>defensiveShape</code> (where &ldquo;four
        on the goal line&rdquo; vs a diamond shows), <code>attackingShape</code> (the 1-2-1 / 2-2
        structure), and a full chance from <code>buildPassage</code>. This is a separate game from the
        11-a-side view — its own pitch, its own rules.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        {cells.map((c) => (
          <GalleryCell key={c.key} cell={c} />
        ))}
      </div>
    </div>
  );
}

export default function StarGalleryDevPage() {
  const [view, setView] = useState<"eleven" | "five">("eleven");
  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", padding: "24px 16px 80px" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 6px" }}>Scenario Gallery</h1>
      <p style={{ margin: "0 0 20px", color: "#94a3b8", fontSize: 14, maxWidth: 760 }}>
        Deterministic dev scaffolding. Every cell is built from the real scenario/shape builders at a
        fixed seed, so a screenshot before and after a builder change is a true like-for-like comparison.
        This page changes no game behaviour.
      </p>

      <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
        <button style={TAB_BTN(view === "eleven")} onClick={() => setView("eleven")}>
          Real game (11-a-side)
        </button>
        <button style={TAB_BTN(view === "five")} onClick={() => setView("five")}>
          Five-a-side
        </button>
      </div>

      {view === "eleven" ? <ElevenView /> : <FiveView />}
    </main>
  );
}
