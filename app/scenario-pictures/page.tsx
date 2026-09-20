"use client";

/**
 * SCENARIO PICTURES — see every chance the game can currently serve, at once.
 *
 * Requested directly: "give me a test page named scenario-pictures that i could
 * see them all before u start the build". This is the human check before the
 * generative chance formula is built — a dense contact sheet of what the real
 * builders produce TODAY (after the offside / central-channel / formation-
 * coverage fixes), so the goofy ones can be pointed at rather than described.
 *
 * It invents nothing. Every cell is the REAL `buildScenario` output for that
 * kind at a fixed seed, with the REAL `applyFormationShape` positional layer
 * applied on top, drawn through the shared `fiveASide/render` primitives — the
 * same path the scenario gallery uses. Change the controls and every picture
 * rebuilds from the real code.
 *
 * Yellow dashes = the offside line the engine would judge against (second-last
 * opponent, keeper included). If an attacker is above it, that chance is
 * illegal — which is exactly the sort of thing this page exists to expose.
 */

import { useEffect, useRef, useState } from "react";
import {
  SCENARIO_KINDS,
  buildScenario,
  goalInView,
  type Scenario,
  type ScenarioKind,
  type Vec2,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { ELEVEN_A_SIDE_ATTACK, type MatchRules } from "@/lib/star/fiveASide/rules";
import {
  projectionFor, drawPitch, drawGoal, drawFigure, drawKeeper, drawBall,
  type Projection, type FigureLook,
} from "@/lib/star/fiveASide/render";
import { applyFormationShape } from "@/lib/star/formationShape";
import { PLAYSTYLES, type Playstyle } from "@/lib/star/playstyle";
import { FORMATIONS, formationOf } from "@/lib/star/formations";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";

const YOU: Omit<FigureLook, "label" | "star"> = { shirt: "#1d4ed8", shorts: "#1e3a8a", trim: "#fff" };
const OPP: Omit<FigureLook, "label" | "star"> = { shirt: "#dc2626", shorts: "#7f1d1d", trim: "#fff" };
const KEEP: Omit<FigureLook, "label" | "star"> = { shirt: "#16a34a", shorts: "#14532d", trim: "#fff" };
const MATE: Omit<FigureLook, "label" | "star"> = { shirt: "#3b82f6", shorts: "#1e3a8a", trim: "#fff" };
const FACE = DEFAULT_FACE_STYLE;
const FAKE = DEFAULT_FAKE_FACE_STYLE;

const MATCHUPS = [
  { id: "even", label: "Even (70v70)", atk: 70, def: 70 },
  { id: "strong", label: "You stronger (90v55)", atk: 90, def: 55 },
  { id: "weak", label: "You weaker (55v90)", atk: 55, def: 90 },
];

/** The offside line the engine judges against — second-last opponent, keeper
 *  counted only when the goal is in view. Mirrors canvasEngine's opponentLine. */
function offsideLineFor(sc: Scenario): number | null {
  if (!goalInView(sc.kind) || sc.kind === "corner") return null;
  const ys = sc.defenders.map(d => d.y);
  ys.push(sc.keeper.y);
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  return ys[1];
}

/** Anything obviously wrong with this picture, named in plain English so a
 *  non-coder can scan for it rather than squint. Deliberately conservative —
 *  it only flags what is genuinely illegal or unfootballing. */
function faultsOf(sc: Scenario): string[] {
  const out: string[] = [];
  const line = offsideLineFor(sc);
  if (line !== null) {
    const atts: Vec2[] = [];
    if (sc.runner) atts.push(sc.runner.pos);
    for (const r of sc.secondaryRunners) atts.push(r.pos);
    if (goalInView(sc.kind)) atts.push({ x: sc.follower.x, y: sc.follower.y });
    if (atts.some(a => a.y < line - 0.01)) out.push("attacker offside");
  }
  const ballDist = sc.ball.y;
  if (goalInView(sc.kind) && ballDist <= 24 && sc.defenders.length > 0) {
    if (!sc.defenders.some(d => Math.abs(d.x - 34) <= 6.5)) out.push("empty central channel");
  }
  // Adjacent back-line gap, the "gap like that in the box" measure.
  if (goalInView(sc.kind) && sc.defenders.length >= 2 && ballDist <= 25) {
    const xs = sc.defenders.map(d => d.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] - xs[i - 1] > 11) { out.push("11m+ hole in the line"); break; }
    }
  }
  if (sc.defenders.some(d => d.y < sc.keeper.y)) out.push("defender behind his keeper");
  return out;
}

interface Cell {
  key: string;
  kind: ScenarioKind;
  seed: number;
  sc: Scenario;
  faults: string[];
}

function buildCells(
  formationId: string, playstyleId: Playstyle, atk: number, def: number,
  perKind: number, kinds: ScenarioKind[],
): Cell[] {
  const formation = formationOf(formationId);
  const playstyle = PLAYSTYLES[playstyleId];
  const cells: Cell[] = [];
  for (const kind of kinds) {
    for (let i = 0; i < perKind; i++) {
      const seed = 2200 + i * 37;
      const sc = buildScenario(kind, mulberry32(seed));
      applyFormationShape(sc, { formation, playstyle, attackerStrength: atk, defenderStrength: def });
      cells.push({ key: `${kind}-${seed}`, kind, seed, sc, faults: faultsOf(sc) });
    }
  }
  return cells;
}

function paint(canvas: HTMLCanvasElement, sc: Scenario, cssW: number): void {
  const rules: MatchRules = ELEVEN_A_SIDE_ATTACK;
  const vp = sc.viewport;
  const vpW = vp.x2 - vp.x1, vpH = vp.y2 - vp.y1;
  let w = cssW, h = Math.round((cssW * vpH) / vpW);
  const MAX_H = 300;
  if (h > MAX_H) { h = MAX_H; w = Math.round((MAX_H * vpW) / vpH); }
  const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const p: Projection = projectionFor(rules, w, h, vp);
  drawPitch(ctx, rules, p);
  if (goalInView(sc.kind)) drawGoal(ctx, rules, p, 0);

  const line = offsideLineFor(sc);
  if (line !== null) {
    const yy = p.py(line);
    ctx.save();
    ctx.strokeStyle = "rgba(250,204,21,.9)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
    ctx.restore();
  }

  for (const d of sc.defenders) drawFigure(ctx, p, { x: d.x, y: d.y }, { ...OPP }, FACE, FAKE);
  drawKeeper(ctx, p, { x: sc.keeper.x, y: sc.keeper.y }, { ...KEEP }, { dive: 0, lunge: 0 }, FACE, FAKE);
  if (sc.runner) drawFigure(ctx, p, { ...sc.runner.pos }, { ...MATE }, FACE, FAKE);
  for (const r of sc.secondaryRunners) drawFigure(ctx, p, { ...r.pos }, { ...MATE }, FACE, FAKE);
  if (goalInView(sc.kind)) drawFigure(ctx, p, { x: sc.follower.x, y: sc.follower.y }, { ...MATE }, FACE, FAKE);
  for (const t of sc.teammates) drawFigure(ctx, p, { x: t.x, y: t.y }, { ...MATE }, FACE, FAKE);
  drawFigure(ctx, p, { ...sc.player }, { ...YOU, star: true }, FACE, FAKE);
  drawBall(ctx, p, sc.ball);
}

function Picture({ cell, size }: { cell: Cell; size: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => { if (ref.current) paint(ref.current, cell.sc, size); }, [cell, size]);
  const bad = cell.faults.length > 0;
  return (
    <div style={{
      background: "#0b1220",
      border: bad ? "2px solid #f87171" : "1px solid #1e293b",
      borderRadius: 8, padding: 6,
    }}>
      <div style={{ fontWeight: 800, fontSize: 11, marginBottom: 3 }}>{cell.kind}</div>
      <canvas ref={ref} style={{ display: "block", borderRadius: 4, background: "#14532d" }} />
      {bad && (
        <div style={{ color: "#fca5a5", fontSize: 10, fontWeight: 800, marginTop: 4 }}>
          ⚠ {cell.faults.join(" · ")}
        </div>
      )}
    </div>
  );
}

const SEL: React.CSSProperties = {
  background: "#0b1220", color: "#e2e8f0", border: "1px solid #334155",
  borderRadius: 8, padding: "5px 9px", fontSize: 13, fontWeight: 700,
};

export default function ScenarioPicturesPage() {
  const [formationId, setFormationId] = useState("433");
  const [playstyleId, setPlaystyleId] = useState<Playstyle>("mid-block");
  const [matchupId, setMatchupId] = useState("even");
  const [perKind, setPerKind] = useState(6);
  const [size, setSize] = useState(210);
  const [onlyFaults, setOnlyFaults] = useState(false);

  const m = MATCHUPS.find(x => x.id === matchupId) ?? MATCHUPS[0];
  const all = buildCells(formationId, playstyleId, m.atk, m.def, perKind, [...SCENARIO_KINDS]);
  const cells = onlyFaults ? all.filter(c => c.faults.length > 0) : all;
  const faulty = all.filter(c => c.faults.length > 0).length;

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "#e2e8f0", padding: "20px 14px 70px" }}>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 4px" }}>Scenario Pictures</h1>
      <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 13, maxWidth: 780, lineHeight: 1.5 }}>
        Every chance the game can serve right now, built from the real scenario builders with the real
        formation/playstyle layer on top — not mock-ups. Yellow dashes = the offside line.
        A <span style={{ color: "#fca5a5", fontWeight: 800 }}>red border</span> means the picture is
        genuinely wrong (attacker offside, empty middle of the box, an 11m hole in the line, or a defender
        behind his own keeper). Change the controls and everything rebuilds.
      </p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select value={formationId} onChange={e => setFormationId(e.target.value)} style={SEL}>
          {FORMATIONS.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={playstyleId} onChange={e => setPlaystyleId(e.target.value as Playstyle)} style={SEL}>
          {Object.values(PLAYSTYLES).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={matchupId} onChange={e => setMatchupId(e.target.value)} style={SEL}>
          {MATCHUPS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
        <select value={perKind} onChange={e => setPerKind(Number(e.target.value))} style={SEL}>
          {[3, 6, 10, 16].map(n => <option key={n} value={n}>{n} per kind</option>)}
        </select>
        <select value={size} onChange={e => setSize(Number(e.target.value))} style={SEL}>
          {[150, 210, 280].map(n => <option key={n} value={n}>{n === 150 ? "small" : n === 210 ? "medium" : "large"}</option>)}
        </select>
        <label style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={onlyFaults} onChange={e => setOnlyFaults(e.target.checked)} />
          only show broken
        </label>
      </div>

      <div style={{
        marginBottom: 16, fontSize: 13, fontWeight: 800,
        color: faulty === 0 ? "#4ade80" : "#fca5a5",
      }}>
        {faulty === 0
          ? `${all.length} pictures · none flagged as broken`
          : `${all.length} pictures · ${faulty} flagged as broken (${(faulty / all.length * 100).toFixed(1)}%)`}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {cells.map(c => <Picture key={c.key} cell={c} size={size} />)}
      </div>
    </main>
  );
}
